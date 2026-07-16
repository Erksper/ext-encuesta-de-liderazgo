<?php

namespace Espo\Modules\EncuestaDeLiderazgo\Controllers;

use Espo\Core\Controllers\Record;

class EncuestaLiderazgoCategoria extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    // =========================================================
    //  GET: Detalle agregado de una categoría (gauge general +
    //  tabla por pregunta), con los mismos filtros del dashboard.
    //  Reemplaza la descarga masiva de encuestas + respuestas.
    // =========================================================
    public function getActionGetDetalleCategoria($params, $data, $request)
    {
        try {
            $categoriaId = $request->get('categoriaId');
            if (!$categoriaId) {
                return ['success' => false, 'error' => 'No se indicó la categoría.'];
            }

            $anio = $request->get('anio');
            $cla = $request->get('cla');
            $oficina = $request->get('oficina');
            $usuario = $request->get('usuario');

            $pdo = $this->getEntityManager()->getPDO();

            $where = ['el.deleted = 0'];
            $args = [];

            // ── Mismo criterio que el dashboard: el periodo abierto no se ve
            // en reportes hasta que se cierre. ──
            $sqlPeriodoActivo = "SELECT id FROM encuesta_liderazgo_encuesta
                                 WHERE deleted = 0 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
                                 ORDER BY fecha_inicio DESC LIMIT 1";
            $periodoActivoId = $pdo->query($sqlPeriodoActivo)->fetchColumn();
            if ($periodoActivoId) {
                $where[] = '(el.periodo_encuesta_id IS NULL OR el.periodo_encuesta_id != ?)';
                $args[] = $periodoActivoId;
            }

            if ($anio) {
                $where[] = 'el.fecha BETWEEN ? AND ?';
                $args[] = $anio . '-01-01';
                $args[] = $anio . '-12-31';
            }
            if ($cla && $cla !== 'CLA0') {
                $where[] = 'el.cla_team_id = ?';
                $args[] = $cla;
            }
            if ($oficina && $cla && $cla !== 'CLA0') {
                $where[] = 'el.oficina_team_id = ?';
                $args[] = $oficina;
            }
            if ($usuario) {
                $where[] = 'el.usuario_evaluado_id = ?';
                $args[] = $usuario;
            }

            $whereSql = implode(' AND ', $where);

            // ── Distribución por pregunta de esta categoría ──
            $sql = "SELECT p.id as preguntaId, p.pregunta as preguntaTexto, p.orden as preguntaOrden,
                        r.seleccion as seleccion, COUNT(*) as cnt
                    FROM encuesta_liderazgo_respuesta r
                    INNER JOIN encuesta_liderazgo_pregunta p ON p.id = r.pregunta_id AND p.deleted = 0
                    INNER JOIN encuesta_liderazgo el ON el.id = r.encuesta_liderazgo_id
                    WHERE r.deleted = 0 AND r.seleccion IS NOT NULL AND r.seleccion != ''
                      AND p.categoria_liderazgo_id = ?
                      AND $whereSql
                    GROUP BY p.id, p.pregunta, p.orden, r.seleccion";
            $sth = $pdo->prepare($sql);
            $sth->execute(array_merge([$categoriaId], $args));
            $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);

            if (empty($rows)) {
                return [
                    'success' => true,
                    'totalRespuestas' => 0,
                    'distribucionGeneral' => ['4' => 0, '3' => 0, '2' => 0, '1' => 0],
                    'preguntas' => [],
                ];
            }

            $preguntasPorId = [];
            $distribucionGeneral = ['4' => 0, '3' => 0, '2' => 0, '1' => 0];

            foreach ($rows as $row) {
                $pid = $row['preguntaId'];
                if (!isset($preguntasPorId[$pid])) {
                    $preguntasPorId[$pid] = [
                        'id' => $pid,
                        'texto' => $row['preguntaTexto'],
                        'orden' => (int) $row['preguntaOrden'],
                        'distribucion' => ['4' => 0, '3' => 0, '2' => 0, '1' => 0],
                        'total' => 0,
                    ];
                }

                $sel = (string) $row['seleccion'];
                $cnt = (int) $row['cnt'];

                if (isset($preguntasPorId[$pid]['distribucion'][$sel])) {
                    $preguntasPorId[$pid]['distribucion'][$sel] += $cnt;
                    $preguntasPorId[$pid]['total'] += $cnt;
                    $distribucionGeneral[$sel] += $cnt;
                }
            }

            $preguntas = array_values($preguntasPorId);
            usort($preguntas, function ($a, $b) { return $a['orden'] <=> $b['orden']; });

            $totalRespuestas = array_sum($distribucionGeneral);

            return [
                'success' => true,
                'totalRespuestas' => $totalRespuestas,
                'distribucionGeneral' => $distribucionGeneral,
                'preguntas' => $preguntas,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
