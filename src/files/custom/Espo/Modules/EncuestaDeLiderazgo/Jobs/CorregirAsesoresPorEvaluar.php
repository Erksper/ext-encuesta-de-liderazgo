<?php

namespace Espo\Modules\EncuestaDeLiderazgo\Jobs;

use Espo\Core\Job\JobDataLess;
use Espo\ORM\EntityManager;
use Espo\Core\Utils\Util;
use Espo\Modules\EncuestaDeLiderazgo\Traits\Loggable;
use PDO;

/**
 * Job programado: mantiene sincronizada, para el periodo ACTIVO, la
 * relación líder<->asesor de encuesta_liderazgo_asesores_evaluados /
 * encuesta_liderazgo_asesores_por_evaluar contra la realidad actual del
 * sistema (roles y oficinas de los usuarios), en una sola pasada:
 *
 *  - LÍDER: elegible si tiene rol gerente/director/coordinador, está
 *    activo y tiene una oficina resoluble (no CLA / Venezuela). Se
 *    determina exactamente igual que getActionGetLideresDisponibles.
 *  - ASESOR: elegible si tiene rol 'asesor', está activo y tiene una
 *    oficina resoluble. Igual que _bulkRegenerarAsesoresPorEvaluar.
 *
 *  1) encuesta_liderazgo_asesores_evaluados se sincroniza contra los
 *     líderes elegibles: se crea el registro si un usuario nuevo obtuvo
 *     el rol (o cambió de oficina y nunca tuvo registro), se reactiva
 *     (estado=Activo, oficina actualizada) si un líder inactivo volvió
 *     a ser elegible, se actualiza la oficina si cambió, y se marca
 *     estado=Inactivo si un líder activo dejó de ser elegible (perdió
 *     el rol, fue desactivado/eliminado, o se quedó sin oficina
 *     resoluble). Nunca se hace soft-delete de este registro aquí -
 *     eso solo lo hace el job de anonimización, un mes después de
 *     cerrado el periodo.
 *
 *  2) Cada fila de asesores_por_evaluar se valida contra el par
 *     (líder, asesor) que le corresponde HOY:
 *       - Sigue siendo válida (mismo líder Activo + mismo asesor,
 *         ambos en la misma oficina actual) -> no se toca.
 *       - Inválida porque el LÍDER ya no es elegible -> se elimina
 *         solo si NO está 'evaluado' (se conservan las contestadas).
 *       - Inválida porque el ASESOR ya no es elegible -> mismo
 *         criterio: se conservan las 'evaluado', se elimina el resto.
 *       - Inválida porque ambos siguen siendo elegibles pero sus
 *         oficinas actuales ya no coinciden (alguno de los dos se
 *         cambió de oficina) -> se elimina SIEMPRE, incluida si ya
 *         estaba 'evaluado', con cascada a la encuesta y sus
 *         respuestas (aquí sí se borra la encuesta, es la única
 *         excepción a "las encuestas no se borran").
 *       - Filas en 'no_aplica' nunca se tocan (se asume decisión
 *         manual).
 *     Los pares (líder, asesor) que corresponden hoy y no tienen fila
 *     viva se crean en 'sin_evaluar'. Si ya existía una fila 'evaluado'
 *     para ese par (se conservó en una corrida anterior), no se
 *     duplica: ya cuenta como válida.
 *
 * Alcance: solo el periodo activo (fecha_inicio <= hoy <= fecha_fin).
 * Si no hay periodo activo, el job termina de inmediato sin ninguna
 * consulta adicional ni log, para no gastar recursos.
 *
 * Este job NO se registra para correr solo: solo queda disponible como
 * tipo de Scheduled Job en el panel de administración (metadata
 * "isSystem": false). Hay que crear el registro de Scheduled Job
 * manualmente desde Administración y asignarle el cron deseado.
 */
class CorregirAsesoresPorEvaluar implements JobDataLess
{
    use Loggable;

    private EntityManager $entityManager;

    public function __construct(EntityManager $entityManager)
    {
        $this->entityManager = $entityManager;
    }

    public function run(): void
    {
        $pdo = $this->entityManager->getPDO();

        $periodoId = $this->obtenerPeriodoActivoId($pdo);
        if (!$periodoId) {
            return;
        }

        set_time_limit(0);
        ini_set('memory_limit', '512M');

        $startTime = microtime(true);

        $resumen = [
            'lideresCreados' => 0,
            'lideresReactivados' => 0,
            'lideresDesactivados' => 0,
            'lideresOficinaActualizada' => 0,
            'filasEliminadas' => 0,
            'encuestasEliminadas' => 0,
            'filasCreadas' => 0,
        ];

        $pdo->beginTransaction();

        try {
            $leaderState = $this->construirEstadoLideres($pdo);
            $advisorState = $this->construirEstadoAsesores($pdo);

            $this->sincronizarAsesoresEvaluados($pdo, $periodoId, $leaderState, $resumen);
            $this->reconciliarParesPorEvaluar($pdo, $periodoId, $leaderState, $advisorState, $resumen);

            $pdo->commit();

            $elapsed = round(microtime(true) - $startTime, 2);
            $huboCambios = array_sum($resumen) > 0;

            if ($huboCambios) {
                $this->log(
                    'info',
                    'User',
                    null,
                    'Corrección Asesores Por Evaluar',
                    'success',
                    sprintf(
                        'Líderes creados: %d | reactivados: %d | desactivados: %d | con oficina actualizada: %d ' .
                        '|| Filas eliminadas: %d (encuestas eliminadas en cascada: %d) | Filas creadas: %d | Tiempo: %ss',
                        $resumen['lideresCreados'],
                        $resumen['lideresReactivados'],
                        $resumen['lideresDesactivados'],
                        $resumen['lideresOficinaActualizada'],
                        $resumen['filasEliminadas'],
                        $resumen['encuestasEliminadas'],
                        $resumen['filasCreadas'],
                        $elapsed
                    )
                );
            }
        } catch (\Throwable $e) {
            $pdo->rollBack();
            $this->log(
                'error',
                'User',
                null,
                'Corrección Asesores Por Evaluar',
                'error',
                'Error crítico: ' . $e->getMessage()
            );
            error_log('[CorregirAsesoresPorEvaluar] Error: ' . $e->getMessage());
        }
    }

    // =========================================================
    //  Periodo activo
    // =========================================================

    private function obtenerPeriodoActivoId(PDO $pdo): ?string
    {
        $sql = "SELECT id FROM encuesta_liderazgo_encuesta
                WHERE deleted = 0 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
                ORDER BY fecha_inicio DESC LIMIT 1";
        $sth = $pdo->prepare($sql);
        $sth->execute();
        $id = $sth->fetchColumn();
        return $id ?: null;
    }

    // =========================================================
    //  Oficina actual de un conjunto de usuarios
    //  (idéntico a EncuestaLiderazgoEncuesta::_resolverOficinasPorUsuarios)
    // =========================================================

    private function resolverOficinasPorUsuarios(PDO $pdo, array $userIds): array
    {
        if (empty($userIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $sql = "SELECT tu.user_id as userId, t.id as teamId, t.name as teamName
                FROM team_user tu
                INNER JOIN team t ON tu.team_id = t.id AND t.deleted = 0
                WHERE tu.user_id IN ($placeholders) AND tu.deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute($userIds);

        $resultado = [];
        while ($row = $sth->fetch(PDO::FETCH_ASSOC)) {
            $uid = $row['userId'];
            if (isset($resultado[$uid])) {
                continue;
            }
            $esCLA = preg_match('/^CLA\d+$/i', $row['teamId']);
            $esVenezuela = (strtolower($row['teamId']) === 'venezuela' || strtolower($row['teamName']) === 'venezuela');
            if (!$esCLA && !$esVenezuela) {
                $resultado[$uid] = $row['teamId'];
            }
        }

        return $resultado;
    }

    // =========================================================
    //  Estado actual: líderes elegibles hoy -> [userId => teamId]
    //  Igual criterio que getActionGetLideresDisponibles.
    // =========================================================

    private function construirEstadoLideres(PDO $pdo): array
    {
        $sql = "SELECT DISTINCT u.id
                FROM user u
                INNER JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                INNER JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                WHERE u.deleted = 0 AND u.is_active = 1
                  AND u.user_name NOT REGEXP '^[0-9]+$'
                  AND LOWER(r.name) IN ('gerente', 'director', 'coordinador')";
        $sth = $pdo->prepare($sql);
        $sth->execute();
        $userIds = $sth->fetchAll(PDO::FETCH_COLUMN);

        return $this->resolverOficinasPorUsuarios($pdo, $userIds);
    }

    // =========================================================
    //  Estado actual: asesores elegibles hoy -> [userId => teamId]
    //  Igual criterio que _bulkRegenerarAsesoresPorEvaluar.
    // =========================================================

    private function construirEstadoAsesores(PDO $pdo): array
    {
        $sql = "SELECT DISTINCT tu.user_id as userId
                FROM team_user tu
                INNER JOIN user u ON tu.user_id = u.id AND u.deleted = 0 AND u.is_active = 1
                INNER JOIN role_user ru ON ru.user_id = u.id AND ru.deleted = 0
                INNER JOIN role r ON r.id = ru.role_id AND r.deleted = 0 AND LOWER(r.name) = 'asesor'
                WHERE tu.deleted = 0 AND u.user_name NOT REGEXP '^[0-9]+$'";
        $sth = $pdo->prepare($sql);
        $sth->execute();
        $userIds = $sth->fetchAll(PDO::FETCH_COLUMN);

        return $this->resolverOficinasPorUsuarios($pdo, $userIds);
    }

    // =========================================================
    //  1) Sincronizar encuesta_liderazgo_asesores_evaluados
    // =========================================================

    private function sincronizarAsesoresEvaluados(PDO $pdo, string $periodoId, array $leaderState, array &$resumen): void
    {
        $sql = "SELECT id, asesor_encuestado_id as liderId, estado, team_asesor_id as teamId
                FROM encuesta_liderazgo_asesores_evaluados
                WHERE encuesta_liderazgo_encuesta_id = ? AND deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute([$periodoId]);
        $registrados = [];
        foreach ($sth->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $registrados[$row['liderId']] = $row;
        }

        $nuevos = [];

        foreach ($leaderState as $liderId => $teamId) {
            $existente = $registrados[$liderId] ?? null;

            if (!$existente) {
                // Líder nunca antes registrado en este periodo -> nuevo, se agrega Activo.
                $nuevos[] = [Util::generateId(), $periodoId, $liderId, $teamId];
                $resumen['lideresCreados']++;
                continue;
            }

            if ($existente['estado'] !== 'Activo') {
                // Estaba Inactivo y volvió a ser elegible -> reactivar.
                $pdo->prepare("UPDATE encuesta_liderazgo_asesores_evaluados
                                SET estado = 'Activo', team_asesor_id = ? WHERE id = ?")
                    ->execute([$teamId, $existente['id']]);
                $resumen['lideresReactivados']++;
            } elseif ($existente['teamId'] !== $teamId) {
                // Sigue Activo pero cambió de oficina -> actualizar oficina.
                $pdo->prepare("UPDATE encuesta_liderazgo_asesores_evaluados
                                SET team_asesor_id = ? WHERE id = ?")
                    ->execute([$teamId, $existente['id']]);
                $resumen['lideresOficinaActualizada']++;
            }
            // Si sigue Activo y la oficina no cambió, no se toca.
        }

        // Líderes registrados como Activo que ya no son elegibles -> Inactivo.
        $idsADesactivar = [];
        foreach ($registrados as $liderId => $row) {
            if ($row['estado'] === 'Activo' && !isset($leaderState[$liderId])) {
                $idsADesactivar[] = $row['id'];
            }
        }
        if (!empty($idsADesactivar)) {
            $ph = implode(',', array_fill(0, count($idsADesactivar), '?'));
            $pdo->prepare("UPDATE encuesta_liderazgo_asesores_evaluados SET estado = 'Inactivo' WHERE id IN ($ph)")
                ->execute($idsADesactivar);
            $resumen['lideresDesactivados'] += count($idsADesactivar);
        }

        if (!empty($nuevos)) {
            foreach (array_chunk($nuevos, 500) as $chunk) {
                $ph = [];
                $params = [];
                foreach ($chunk as $fila) {
                    $ph[] = "(?, 0, NULL, 'Activo', ?, ?, ?)";
                    $params[] = $fila[0];
                    $params[] = $fila[1];
                    $params[] = $fila[2];
                    $params[] = $fila[3];
                }
                $sql = "INSERT INTO encuesta_liderazgo_asesores_evaluados
                        (id, deleted, name, estado, encuesta_liderazgo_encuesta_id, asesor_encuestado_id, team_asesor_id)
                        VALUES " . implode(', ', $ph);
                $pdo->prepare($sql)->execute($params);
            }
        }
    }

    // =========================================================
    //  2) Reconciliar pares (líder, asesor) de asesores_por_evaluar
    // =========================================================

    private function reconciliarParesPorEvaluar(
        PDO $pdo,
        string $periodoId,
        array $leaderState,
        array $advisorState,
        array &$resumen
    ): void {
        // Pares objetivo: mismo team, líder != asesor.
        $porTeamAsesores = [];
        foreach ($advisorState as $asesorId => $teamId) {
            $porTeamAsesores[$teamId][] = $asesorId;
        }

        $objetivo = []; // "liderId|asesorId" => true
        foreach ($leaderState as $liderId => $teamId) {
            foreach (($porTeamAsesores[$teamId] ?? []) as $asesorId) {
                if ($asesorId === $liderId) {
                    continue;
                }
                $objetivo["{$liderId}|{$asesorId}"] = true;
            }
        }

        // Filas vivas actuales del periodo.
        $sql = "SELECT id, asesor_encuestado_id as liderId, asesor_asignado_id as asesorId, evaluado
                FROM encuesta_liderazgo_asesores_por_evaluar
                WHERE encuesta_liderazgo_encuesta_id = ? AND deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute([$periodoId]);
        $existentes = $sth->fetchAll(PDO::FETCH_ASSOC);

        $existentesKeys = [];
        $idsAEliminar = [];

        foreach ($existentes as $fila) {
            $clave = "{$fila['liderId']}|{$fila['asesorId']}";
            $existentesKeys[$clave] = true;

            if (isset($objetivo[$clave])) {
                continue; // sigue siendo válida, no se toca.
            }
            if ($fila['evaluado'] === 'no_aplica') {
                continue; // decisión manual, no se toca.
            }

            $liderElegible = isset($leaderState[$fila['liderId']]);
            $asesorElegible = isset($advisorState[$fila['asesorId']]);

            if ($liderElegible && $asesorElegible) {
                // Ambos siguen siendo válidos como líder/asesor, pero sus oficinas
                // actuales ya no coinciden entre sí -> cambio de oficina: borrado duro.
                $idsAEliminar[] = $fila['id'];
            } elseif ($fila['evaluado'] !== 'evaluado') {
                // Líder o asesor ya no es elegible (eliminado/desactivado/sin rol/sin
                // oficina), y esta fila no está contestada -> se elimina.
                $idsAEliminar[] = $fila['id'];
            }
            // Si no es elegible pero SÍ está 'evaluado' -> se conserva (no se agrega a la lista).
        }

        if (!empty($idsAEliminar)) {
            [$elim, $enc] = $this->eliminarFilasPorEvaluarPorIds($pdo, $idsAEliminar);
            $resumen['filasEliminadas'] += $elim;
            $resumen['encuestasEliminadas'] += $enc;
        }

        // Pares faltantes: objetivo que no tiene fila viva -> crear 'sin_evaluar'.
        $nuevasFilas = [];
        foreach (array_keys($objetivo) as $clave) {
            if (isset($existentesKeys[$clave])) {
                continue;
            }
            [$liderId, $asesorId] = explode('|', $clave, 2);
            $nuevasFilas[] = [Util::generateId(), $periodoId, $liderId, $asesorId];
        }

        if (!empty($nuevasFilas)) {
            $this->insertarFilasPorEvaluar($pdo, $nuevasFilas);
            $resumen['filasCreadas'] += count($nuevasFilas);
        }
    }

    /**
     * Elimina (soft-delete) las filas de asesores_por_evaluar indicadas por id,
     * y en cascada elimina (soft-delete) la encuesta EncuestaLiderazgo asociada
     * (si existe) junto con sus respuestas. Solo toca lo indicado.
     *
     * @return array{0:int,1:int} [filasEliminadas, encuestasEliminadas]
     */
    private function eliminarFilasPorEvaluarPorIds(PDO $pdo, array $filaIds): array
    {
        if (empty($filaIds)) {
            return [0, 0];
        }

        $ph = implode(',', array_fill(0, count($filaIds), '?'));
        $sql = "SELECT encuesta_liderazgo_id as encuestaId
                FROM encuesta_liderazgo_asesores_por_evaluar
                WHERE id IN ($ph) AND encuesta_liderazgo_id IS NOT NULL";
        $sth = $pdo->prepare($sql);
        $sth->execute($filaIds);
        $encuestaIds = array_values(array_filter($sth->fetchAll(PDO::FETCH_COLUMN)));

        if (!empty($encuestaIds)) {
            $phE = implode(',', array_fill(0, count($encuestaIds), '?'));
            $pdo->prepare("UPDATE encuesta_liderazgo_respuesta SET deleted = 1
                            WHERE encuesta_liderazgo_id IN ($phE) AND deleted = 0")
                ->execute($encuestaIds);
            $pdo->prepare("UPDATE encuesta_liderazgo SET deleted = 1
                            WHERE id IN ($phE) AND deleted = 0")
                ->execute($encuestaIds);
        }

        $pdo->prepare("UPDATE encuesta_liderazgo_asesores_por_evaluar SET deleted = 1 WHERE id IN ($ph)")
            ->execute($filaIds);

        return [count($filaIds), count($encuestaIds)];
    }

    /**
     * Inserta en lote (chunks de 500) nuevas filas 'sin_evaluar' de
     * asesores_por_evaluar. $filas: [[id, periodoId, liderId, asesorId], ...]
     */
    private function insertarFilasPorEvaluar(PDO $pdo, array $filas): void
    {
        foreach (array_chunk($filas, 500) as $chunk) {
            $placeholdersSql = [];
            $params = [];
            foreach ($chunk as $fila) {
                $placeholdersSql[] = "(?, 0, NULL, ?, ?, ?, 'sin_evaluar')";
                $params[] = $fila[0];
                $params[] = $fila[1];
                $params[] = $fila[2];
                $params[] = $fila[3];
            }

            $sql = "INSERT INTO encuesta_liderazgo_asesores_por_evaluar
                    (id, deleted, name, encuesta_liderazgo_encuesta_id, asesor_encuestado_id, asesor_asignado_id, evaluado)
                    VALUES " . implode(', ', $placeholdersSql);
            $pdo->prepare($sql)->execute($params);
        }
    }
}
