<?php

namespace Espo\Modules\EncuestaDeLiderazgo\Controllers;

use Espo\Core\Controllers\Record;

class EncuestaLiderazgo extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    // =========================================================
    //  GET: Estadísticas agregadas para el dashboard de reportes
    //  (reemplaza la descarga masiva de encuestas + respuestas
    //  al navegador: todo el cálculo se hace aquí, vía SQL).
    //
    //  Filtros (todos opcionales, mismos que usaba el frontend):
    //    anio, cla, oficina, usuario
    // =========================================================
    private function _puedeVerReportes(): bool
    {
        if ($this->getUser()->isAdmin()) {
            return true;
        }

        $pdo = $this->getEntityManager()->getPDO();
        $sql = "SELECT COUNT(*) FROM role_user ru
                INNER JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                WHERE ru.user_id = ? AND ru.deleted = 0
                  AND LOWER(r.name) IN ('gerente', 'director', 'coordinador', 'casa nacional')";
        $sth = $pdo->prepare($sql);
        $sth->execute([$this->getUser()->get('id')]);
        return (int) $sth->fetchColumn() > 0;
    }

    public function getActionGetEstadisticas($params, $data, $request)
    {
        try {
            if (!$this->_puedeVerReportes()) {
                return ['success' => false, 'error' => 'No tiene permisos para ver los reportes.'];
            }

            $anio = $request->get('anio');
            $cla = $request->get('cla');
            $oficina = $request->get('oficina');
            $usuario = $request->get('usuario');

            $pdo = $this->getEntityManager()->getPDO();

            $where = ['el.deleted = 0'];
            $args = [];

            // ── Mientras un periodo esté abierto (fecha actual dentro de su rango),
            // sus datos no deben verse en los reportes hasta que se cierre. ──
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

            // ── Totales (encuestas + usuarios evaluados distintos) ──
            $sql1 = "SELECT COUNT(*) as totalEncuestas, COUNT(DISTINCT el.usuario_evaluado_id) as usuariosEvaluados
                     FROM encuesta_liderazgo el
                     WHERE $whereSql";
            $sth = $pdo->prepare($sql1);
            $sth->execute($args);
            $totales = $sth->fetch(\PDO::FETCH_ASSOC);

            $totalEncuestas = (int) ($totales['totalEncuestas'] ?? 0);
            $usuariosEvaluados = (int) ($totales['usuariosEvaluados'] ?? 0);

            if ($totalEncuestas === 0) {
                return [
                    'success' => true,
                    'totalEncuestas' => 0,
                    'usuariosEvaluados' => 0,
                    'totalRespuestas' => 0,
                    'categorias' => [],
                ];
            }

            // ── Total de respuestas (de cualquier tipo) de esas encuestas ──
            $sql2 = "SELECT COUNT(*) as totalRespuestas
                     FROM encuesta_liderazgo_respuesta r
                     INNER JOIN encuesta_liderazgo el ON el.id = r.encuesta_liderazgo_id
                     WHERE r.deleted = 0 AND $whereSql";
            $sth2 = $pdo->prepare($sql2);
            $sth2->execute($args);
            $totalRespuestas = (int) $sth2->fetchColumn();

            // ── Distribución (4/3/2/1) por categoría, solo preguntas de selección ──
            $sqlDist = "SELECT p.categoria_liderazgo_id as categoriaId, r.seleccion as seleccion, COUNT(*) as cnt
                        FROM encuesta_liderazgo_respuesta r
                        INNER JOIN encuesta_liderazgo_pregunta p ON p.id = r.pregunta_id AND p.deleted = 0
                        INNER JOIN encuesta_liderazgo el ON el.id = r.encuesta_liderazgo_id
                        WHERE r.deleted = 0 AND r.seleccion IS NOT NULL AND r.seleccion != ''
                          AND $whereSql
                        GROUP BY p.categoria_liderazgo_id, r.seleccion";
            $sthDist = $pdo->prepare($sqlDist);
            $sthDist->execute($args);
            $distRows = $sthDist->fetchAll(\PDO::FETCH_ASSOC);

            $distribucionPorCategoria = [];
            foreach ($distRows as $row) {
                $catId = $row['categoriaId'];
                if (!isset($distribucionPorCategoria[$catId])) {
                    $distribucionPorCategoria[$catId] = ['4' => 0, '3' => 0, '2' => 0, '1' => 0];
                }
                $sel = (string) $row['seleccion'];
                if (isset($distribucionPorCategoria[$catId][$sel])) {
                    $distribucionPorCategoria[$catId][$sel] = (int) $row['cnt'];
                }
            }

            // ── Nombres/orden de categorías (excluye "general", igual que el frontend) ──
            $sqlCat = "SELECT id, name, orden FROM encuesta_liderazgo_categoria
                       WHERE deleted = 0 AND LOWER(name) != 'general'
                       ORDER BY orden ASC";
            $sthCat = $pdo->prepare($sqlCat);
            $sthCat->execute();
            $categoriasRows = $sthCat->fetchAll(\PDO::FETCH_ASSOC);

            $categorias = [];
            foreach ($categoriasRows as $cat) {
                $dist = $distribucionPorCategoria[$cat['id']] ?? null;
                if (!$dist) continue; // sin respuestas para esta categoría: se omite (igual que antes)

                $total = $dist['4'] + $dist['3'] + $dist['2'] + $dist['1'];
                if ($total === 0) continue;

                $suma = $dist['4'] * 4 + $dist['3'] * 3 + $dist['2'] * 2 + $dist['1'] * 1;
                $promedio = ($suma / $total) / 4 * 100;

                $categorias[] = [
                    'id' => $cat['id'],
                    'name' => $cat['name'],
                    'promedio' => $promedio,
                    'distribucion' => $dist,
                    'total' => $total,
                ];
            }

            return [
                'success' => true,
                'totalEncuestas' => $totalEncuestas,
                'usuariosEvaluados' => $usuariosEvaluados,
                'totalRespuestas' => $totalRespuestas,
                'categorias' => $categorias,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
