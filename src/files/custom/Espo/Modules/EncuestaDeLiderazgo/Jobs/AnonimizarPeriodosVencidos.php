<?php

namespace Espo\Modules\EncuestaDeLiderazgo\Jobs;

use Espo\Core\Job\JobDataLess;
use Espo\ORM\EntityManager;
use Espo\Modules\EncuestaDeLiderazgo\Traits\Loggable;
use PDO;

/**
 * Job programado: anonimiza definitivamente los periodos de encuesta de
 * liderazgo que llevan más de 1 mes cerrados (fecha_fin + 1 mes <= hoy).
 *
 * Motivo: la encuesta está diseñada para ser anónima, pero por su
 * diseño (permitir encuestas parciales y llevar el conteo de cuántas
 * evaluaciones lleva hechas cada asesor) es necesario, MIENTRAS el
 * periodo está en curso, guardar quién es el evaluador en
 * encuesta_liderazgo_asesores_por_evaluar / asesores_evaluados y en
 * encuesta_liderazgo.usuario_id/created_by_id/modified_by_id. Este job
 * rompe ese vínculo una vez que ya no hace falta.
 *
 * IMPORTANTE: este borrado de asesores_evaluados/asesores_por_evaluar
 * es FÍSICO (DELETE real), no soft-delete. Un soft-delete (deleted=1)
 * dejaría el id del evaluador perfectamente legible en la fila, lo que
 * NO cumpliría el objetivo de anonimizar. Las encuestas
 * (EncuestaLiderazgo) y sus respuestas (EncuestaLiderazgoRespuesta) NO
 * se tocan más allá de anonimizar los 3 campos de identidad: se
 * conservan para las estadísticas del periodo.
 *
 * Nada más del periodo se borra ni se toca (el registro de
 * EncuestaLiderazgoEncuesta permanece intacto).
 *
 * Para no ejecutar trabajo de más en cada corrida: primero se filtran
 * los periodos candidatos por fecha, y de esos solo se procesan los que
 * todavía tienen filas en asesores_por_evaluar (si ya no tiene ninguna,
 * ya fue anonimizado en una corrida anterior y se omite).
 *
 * Este job NO se registra para correr solo (metadata "isSystem": false),
 * hay que crear el Scheduled Job manualmente desde Administración.
 */
class AnonimizarPeriodosVencidos implements JobDataLess
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

        $periodos = $this->obtenerPeriodosCandidatos($pdo);
        if (empty($periodos)) {
            return;
        }

        set_time_limit(0);
        ini_set('memory_limit', '512M');

        foreach ($periodos as $periodo) {
            $this->anonimizarPeriodo($pdo, $periodo['id'], $periodo['name']);
        }
    }

    /**
     * Periodos cerrados hace más de 1 mes que todavía tienen filas en
     * asesores_por_evaluar (o sea, que aún no fueron anonimizados).
     */
    private function obtenerPeriodosCandidatos(PDO $pdo): array
    {
        $sql = "SELECT e.id, e.name
                FROM encuesta_liderazgo_encuesta e
                WHERE e.deleted = 0
                  AND e.fecha_fin <= (CURDATE() - INTERVAL 1 MONTH)
                  AND EXISTS (
                      SELECT 1 FROM encuesta_liderazgo_asesores_por_evaluar ape
                      WHERE ape.encuesta_liderazgo_encuesta_id = e.id
                  )";
        $sth = $pdo->prepare($sql);
        $sth->execute();
        return $sth->fetchAll(PDO::FETCH_ASSOC);
    }

    private function anonimizarPeriodo(PDO $pdo, string $periodoId, ?string $periodoNombre): void
    {
        $pdo->beginTransaction();

        try {
            // 1) Anonimizar la identidad del evaluador en las encuestas del periodo.
            //    Se conservan las encuestas y sus respuestas (estadísticas del periodo).
            $sth = $pdo->prepare(
                "UPDATE encuesta_liderazgo
                 SET usuario_id = NULL, created_by_id = NULL, modified_by_id = NULL
                 WHERE periodo_encuesta_id = ?
                   AND (usuario_id IS NOT NULL OR created_by_id IS NOT NULL OR modified_by_id IS NOT NULL)"
            );
            $sth->execute([$periodoId]);
            $encuestasAnonimizadas = $sth->rowCount();

            // 2) Borrado físico del bookkeeping que vincula evaluador <-> líder.
            $sth = $pdo->prepare(
                "DELETE FROM encuesta_liderazgo_asesores_por_evaluar
                 WHERE encuesta_liderazgo_encuesta_id = ?"
            );
            $sth->execute([$periodoId]);
            $filasBorradas = $sth->rowCount();

            $sth = $pdo->prepare(
                "DELETE FROM encuesta_liderazgo_asesores_evaluados
                 WHERE encuesta_liderazgo_encuesta_id = ?"
            );
            $sth->execute([$periodoId]);
            $evaluadosBorrados = $sth->rowCount();

            $pdo->commit();

            $this->log(
                'info',
                'User',
                null,
                'Anonimización Periodo Vencido',
                'success',
                sprintf(
                    "Periodo '%s' (%s): %d encuestas anonimizadas | %d filas de asesores_por_evaluar " .
                    "eliminadas | %d registros de asesores_evaluados eliminados.",
                    $periodoNombre ?? $periodoId,
                    $periodoId,
                    $encuestasAnonimizadas,
                    $filasBorradas,
                    $evaluadosBorrados
                )
            );
        } catch (\Throwable $e) {
            $pdo->rollBack();
            $this->log(
                'error',
                'User',
                null,
                'Anonimización Periodo Vencido',
                'error',
                "Error anonimizando periodo '{$periodoNombre}' ({$periodoId}): " . $e->getMessage()
            );
            error_log('[AnonimizarPeriodosVencidos] Error: ' . $e->getMessage());
        }
    }
}
