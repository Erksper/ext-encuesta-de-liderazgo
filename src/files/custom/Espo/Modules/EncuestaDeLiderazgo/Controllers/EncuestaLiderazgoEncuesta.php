<?php

namespace Espo\Modules\EncuestaDeLiderazgo\Controllers;

use Espo\Core\Controllers\Record;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Utils\Util;

class EncuestaLiderazgoEncuesta extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    // =========================================================
    //  Helpers de roles / oficina
    // =========================================================

    private function _esCasaNacional(): bool
    {
        if ($this->getUser()->isAdmin()) {
            return true;
        }

        $pdo = $this->getEntityManager()->getPDO();
        $sql = "SELECT COUNT(*) as cnt
                FROM role_user ru
                INNER JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                WHERE ru.user_id = ? AND ru.deleted = 0 AND LOWER(r.name) = 'casa nacional'";
        $sth = $pdo->prepare($sql);
        $sth->execute([$this->getUser()->get('id')]);
        return (int) $sth->fetchColumn() > 0;
    }

    private function _resolverOficinasPorUsuarios(\PDO $pdo, array $userIds): array
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
        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
            $uid = $row['userId'];
            if (isset($resultado[$uid])) {
                continue;
            }
            $esCLA = preg_match('/^CLA\d+$/i', $row['teamId']);
            $esVenezuela = (strtolower($row['teamId']) === 'venezuela' || strtolower($row['teamName']) === 'venezuela');
            if (!$esCLA && !$esVenezuela) {
                $resultado[$uid] = ['teamId' => $row['teamId'], 'teamName' => $row['teamName']];
            }
        }

        return $resultado;
    }

    // =========================================================
    //  GET: Líderes disponibles (gerente / director / coordinador)
    // =========================================================
    public function getActionGetLideresDisponibles($params, $data, $request)
    {
        try {
            $pdo = $this->getEntityManager()->getPDO();

            $sql = "SELECT DISTINCT u.id, u.user_name as userName, u.first_name as firstName, u.last_name as lastName,
                        GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    INNER JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    INNER JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    WHERE u.deleted = 0 AND u.is_active = 1
                    GROUP BY u.id
                    HAVING roles REGEXP '(^|,)(gerente|director|coordinador)(,|$)'
                    ORDER BY u.first_name, u.last_name, u.user_name";
            $sth = $pdo->prepare($sql);
            $sth->execute();
            $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);

            $userIds = array_column($rows, 'id');
            $oficinas = $this->_resolverOficinasPorUsuarios($pdo, $userIds);

            $lideres = [];
            foreach ($rows as $row) {
                $nombre = trim(($row['firstName'] ?? '') . ' ' . ($row['lastName'] ?? ''));
                if (empty($nombre)) $nombre = $row['userName'];

                $roles = $row['roles'] ? explode(',', $row['roles']) : [];
                $rolesFiltrados = array_values(array_intersect($roles, ['gerente', 'director', 'coordinador']));

                $oficina = $oficinas[$row['id']] ?? null;

                $lideres[] = [
                    'id' => $row['id'],
                    'name' => $nombre,
                    'userName' => $row['userName'],
                    'roles' => $rolesFiltrados,
                    'teamId' => $oficina['teamId'] ?? null,
                    'teamName' => $oficina['teamName'] ?? 'Sin oficina asignada',
                ];
            }

            return ['success' => true, 'data' => $lideres, 'total' => count($lideres)];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================
    //  GET: Estado de los líderes ya guardados para un periodo (edición)
    // =========================================================
    public function getActionGetPeriodoLideres($params, $data, $request)
    {
        try {
            $periodoId = $request->get('periodoId');
            if (!$periodoId) {
                return ['success' => false, 'error' => 'ID de periodo no proporcionado'];
            }

            $registros = $this->getEntityManager()
                ->getRDBRepository('EncuestaLiderazgoAsesoresEvaluados')
                ->where(['encuestaLiderazgoEncuestaId' => $periodoId])
                ->select(['id', 'asesorEncuestadoId', 'estado'])
                ->find();

            $data = [];
            foreach ($registros as $r) {
                $data[] = [
                    'userId' => $r->get('asesorEncuestadoId'),
                    'activo' => $r->get('estado') === 'Activo',
                ];
            }

            return ['success' => true, 'data' => $data];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================
    //  POST: Guardar (crear o editar) periodo completo
    //  Reforzado para soportar creación masiva (~10,000 registros)
    //  sin depender del ORM fila por fila: inserción SQL directa
    //  en lotes, envuelta en una transacción PDO.
    // =========================================================
    public function postActionGuardarPeriodo($params, $data, $request)
    {
        // Evitar timeout del servidor ante la creación masiva de registros.
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $pdo = $this->getEntityManager()->getPDO();
        $transaccionAbierta = false;

        try {
            if (!$this->_esCasaNacional()) {
                throw new Forbidden('No tiene permisos para crear o editar periodos.');
            }

            $periodoId = $data->periodoId ?? null;
            $fechaInicio = $data->fechaInicio ?? null;
            $fechaFin = $data->fechaFin ?? null;
            $lideres = $data->lideres ?? [];

            if (!$fechaInicio || !$fechaFin) {
                throw new BadRequest('Debe indicar fecha de inicio y fecha de fin.');
            }
            if ($fechaInicio >= $fechaFin) {
                throw new BadRequest('La fecha de inicio debe ser anterior a la fecha de fin (no pueden ser el mismo día).');
            }

            $entityManager = $this->getEntityManager();

            $totalActivos = 0;
            foreach ($lideres as $l) {
                if (!empty($l->activo)) $totalActivos++;
            }

            // ── Crear o actualizar el periodo (bajo volumen, vía ORM) ──
            if ($periodoId) {
                $periodo = $entityManager->getEntity('EncuestaLiderazgoEncuesta', $periodoId);
                if (!$periodo) {
                    throw new BadRequest('El periodo indicado no existe.');
                }
            } else {
                $periodo = $entityManager->getNewEntity('EncuestaLiderazgoEncuesta');
                $periodo->set('usuarioCreadorId', $this->getUser()->get('id'));
            }

            $periodo->set([
                'name' => 'Periodo ' . $fechaInicio . ' al ' . $fechaFin,
                'fechaInicio' => $fechaInicio,
                'fechaFin' => $fechaFin,
                'totalAsesoresEvaluar' => $totalActivos,
            ]);
            $entityManager->saveEntity($periodo);
            $periodoId = $periodo->get('id');

            // ── Resolver oficinas de todos los líderes del payload ──
            $userIds = array_map(function ($l) { return $l->userId; }, $lideres);
            $oficinas = $this->_resolverOficinasPorUsuarios($pdo, $userIds);

            // ── Registros existentes de AsesoresEvaluados para este periodo (bajo volumen) ──
            $existentes = $entityManager->getRDBRepository('EncuestaLiderazgoAsesoresEvaluados')
                ->where(['encuestaLiderazgoEncuestaId' => $periodoId])
                ->find();

            $existentesPorUsuario = [];
            foreach ($existentes as $e) {
                $existentesPorUsuario[$e->get('asesorEncuestadoId')] = $e;
            }

            // ── Líderes que YA tienen filas reales en AsesoresPorEvaluar para este periodo ──
            // (para detectar y autorreparar el caso donde quedaron "Activos" sin filas generadas)
            $sqlConFilas = "SELECT DISTINCT asesor_encuestado_id
                            FROM encuesta_liderazgo_asesores_por_evaluar
                            WHERE encuesta_liderazgo_encuesta_id = ? AND deleted = 0";
            $sthConFilas = $pdo->prepare($sqlConFilas);
            $sthConFilas->execute([$periodoId]);
            $lideresConFilasExistentes = array_flip($sthConFilas->fetchAll(\PDO::FETCH_COLUMN));

            $lideresParaDesactivar = []; // userIds
            $lideresParaActivar = [];   // userId => teamId

            foreach ($lideres as $l) {
                $userId = $l->userId;
                $nuevoEstado = !empty($l->activo) ? 'Activo' : 'Inactivo';
                $oficina = $oficinas[$userId] ?? null;
                $teamId = $oficina['teamId'] ?? null;

                $registro = $existentesPorUsuario[$userId] ?? null;
                $estadoAnterior = $registro ? $registro->get('estado') : null;

                if ($registro) {
                    $registro->set(['estado' => $nuevoEstado, 'teamAsesorId' => $teamId]);
                    $entityManager->saveEntity($registro);
                } else {
                    $registro = $entityManager->getNewEntity('EncuestaLiderazgoAsesoresEvaluados');
                    $registro->set([
                        'encuestaLiderazgoEncuestaId' => $periodoId,
                        'asesorEncuestadoId' => $userId,
                        'teamAsesorId' => $teamId,
                        'estado' => $nuevoEstado,
                    ]);
                    $entityManager->saveEntity($registro);
                }

                $tieneFilas = isset($lideresConFilasExistentes[$userId]);

                $pasaAInactivo = ($estadoAnterior === 'Activo' && $nuevoEstado === 'Inactivo');
                // Se regenera si pasa a Activo, O si ya estaba Activo pero nunca llegó
                // a tener filas reales (autorreparación de un guardado previo incompleto).
                $pasaAActivo = ($nuevoEstado === 'Activo') && ($estadoAnterior !== 'Activo' || !$tieneFilas);

                if ($pasaAInactivo) {
                    $lideresParaDesactivar[] = $userId;
                } elseif ($pasaAActivo && $teamId) {
                    $lideresParaActivar[$userId] = $teamId;
                }
                // Si sigue Activo sin cambios Y ya tiene filas, no se toca (se preserva el avance).
            }

            // ── A partir de aquí, todo por SQL directo en una transacción ──
            $pdo->beginTransaction();
            $transaccionAbierta = true;

            if (!empty($lideresParaDesactivar)) {
                $this->_bulkBorrarAsesoresPorEvaluar($pdo, $periodoId, $lideresParaDesactivar);
            }

            if (!empty($lideresParaActivar)) {
                // Limpiar residuos previos antes de regenerar
                $this->_bulkBorrarAsesoresPorEvaluar($pdo, $periodoId, array_keys($lideresParaActivar));
                $this->_bulkRegenerarAsesoresPorEvaluar($pdo, $periodoId, $lideresParaActivar);
            }

            $pdo->commit();
            $transaccionAbierta = false;

            return [
                'success' => true,
                'periodoId' => $periodoId,
                'totalAsesoresEvaluar' => $totalActivos,
            ];
        } catch (Forbidden $e) {
            if ($transaccionAbierta) $pdo->rollBack();
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (BadRequest $e) {
            if ($transaccionAbierta) $pdo->rollBack();
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            if ($transaccionAbierta) $pdo->rollBack();
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Borrado lógico masivo (una sola sentencia UPDATE) de AsesoresPorEvaluar
     * para un conjunto de líderes evaluados dentro de un periodo.
     */
    private function _bulkBorrarAsesoresPorEvaluar(\PDO $pdo, string $periodoId, array $asesorEncuestadoIds): void
    {
        if (empty($asesorEncuestadoIds)) return;

        $placeholders = implode(',', array_fill(0, count($asesorEncuestadoIds), '?'));
        $sql = "UPDATE encuesta_liderazgo_asesores_por_evaluar
                SET deleted = 1
                WHERE encuesta_liderazgo_encuesta_id = ?
                  AND asesor_encuestado_id IN ($placeholders)
                  AND deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute(array_merge([$periodoId], $asesorEncuestadoIds));
    }

    /**
     * Genera en lote (INSERT multi-fila, en chunks) los registros de
     * AsesoresPorEvaluar para un conjunto de líderes recién activados.
     * $lideresConTeam: [userId => teamId]
     */
    private function _bulkRegenerarAsesoresPorEvaluar(\PDO $pdo, string $periodoId, array $lideresConTeam): void
    {
        $teamIds = array_values(array_unique(array_values($lideresConTeam)));
        if (empty($teamIds)) return;

        // Un solo query para traer todos los miembros de todas las oficinas involucradas.
        $placeholders = implode(',', array_fill(0, count($teamIds), '?'));
        $sql = "SELECT tu.team_id as teamId, tu.user_id as userId
                FROM team_user tu
                INNER JOIN user u ON tu.user_id = u.id AND u.deleted = 0 AND u.is_active = 1
                WHERE tu.team_id IN ($placeholders) AND tu.deleted = 0";
        $sth = $pdo->prepare($sql);
        $sth->execute($teamIds);

        $miembrosPorTeam = [];
        while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
            $miembrosPorTeam[$row['teamId']][] = $row['userId'];
        }

        // Armar todas las filas a insertar en memoria.
        $filas = [];
        foreach ($lideresConTeam as $liderId => $teamId) {
            $miembros = $miembrosPorTeam[$teamId] ?? [];
            foreach ($miembros as $evaluadorId) {
                if ($evaluadorId === $liderId) continue; // excluir autoevaluación
                $filas[] = [Util::generateId(), $periodoId, $liderId, $evaluadorId];
            }
        }

        if (empty($filas)) return;

        // Insertar en lotes de 500 filas para no exceder límites de placeholders/paquete.
        $chunkSize = 500;
        $chunks = array_chunk($filas, $chunkSize);

        foreach ($chunks as $chunk) {
            $placeholdersSql = [];
            $params = [];
            foreach ($chunk as $fila) {
                $placeholdersSql[] = "(?, 0, NULL, ?, ?, ?, 'sin_evaluar')";
                $params[] = $fila[0]; // id
                $params[] = $fila[1]; // periodoId
                $params[] = $fila[2]; // asesorEncuestadoId (líder)
                $params[] = $fila[3]; // asesorAsignadoId (evaluador)
            }

            $sql = "INSERT INTO encuesta_liderazgo_asesores_por_evaluar
                    (id, deleted, name, encuesta_liderazgo_encuesta_id, asesor_encuestado_id, asesor_asignado_id, evaluado)
                    VALUES " . implode(', ', $placeholdersSql);
            $insSth = $pdo->prepare($sql);
            $insSth->execute($params);
        }
    }
}
