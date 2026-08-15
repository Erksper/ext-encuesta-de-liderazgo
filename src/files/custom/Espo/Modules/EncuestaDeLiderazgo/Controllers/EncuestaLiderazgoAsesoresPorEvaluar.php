<?php

namespace Espo\Modules\EncuestaDeLiderazgo\Controllers;

use Espo\Core\Controllers\Record;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\NotFound;

class EncuestaLiderazgoAsesoresPorEvaluar extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    // =========================================================
    //  GET: Líderes pendientes de evaluar por el usuario logueado
    // =========================================================
    public function getActionGetMisLideres($params, $data, $request)
    {
        try {
            $userId = $this->getUser()->get('id');
            $pdo = $this->getEntityManager()->getPDO();

            $sqlPeriodo = "SELECT id, fecha_inicio as fechaInicio, fecha_fin as fechaFin
                           FROM encuesta_liderazgo_encuesta
                           WHERE deleted = 0 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
                           ORDER BY fecha_inicio DESC
                           LIMIT 1";
            $sth = $pdo->prepare($sqlPeriodo);
            $sth->execute();
            $periodo = $sth->fetch(\PDO::FETCH_ASSOC);

            if (!$periodo) {
                return ['success' => true, 'periodoActivo' => false, 'data' => []];
            }

            $sql = "SELECT ape.id as id, ape.evaluado as estado, ae.team_asesor_id as oficinaId,
                        u.id as leaderId, u.first_name as firstName, u.last_name as lastName, u.user_name as userName
                    FROM encuesta_liderazgo_asesores_por_evaluar ape
                    INNER JOIN user u ON ape.asesor_encuestado_id = u.id AND u.deleted = 0
                    LEFT JOIN encuesta_liderazgo_asesores_evaluados ae
                        ON ae.encuesta_liderazgo_encuesta_id = ape.encuesta_liderazgo_encuesta_id
                       AND ae.asesor_encuestado_id = ape.asesor_encuestado_id
                       AND ae.deleted = 0
                    WHERE ape.deleted = 0
                      AND ape.encuesta_liderazgo_encuesta_id = ?
                      AND ape.asesor_asignado_id = ?
                      AND ape.evaluado != 'no_aplica'
                    ORDER BY FIELD(ape.evaluado, 'parcial', 'sin_evaluar', 'evaluado'), u.first_name, u.last_name";
            $sth = $pdo->prepare($sql);
            $sth->execute([$periodo['id'], $userId]);
            $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);

            $oficinasEspeciales = $this->_obtenerOficinasEspecialesPorPeriodo($periodo['id']);

            // Cuántas evaluaciones ya "comprometió" (parcial o evaluado) este asesor,
            // por cada oficina especial que le toque.
            $comprometidosPorOficina = [];
            foreach ($rows as $row) {
                $oficinaId = $row['oficinaId'];
                if (!$oficinaId || !isset($oficinasEspeciales[$oficinaId])) continue;
                if (in_array($row['estado'], ['parcial', 'evaluado'], true)) {
                    $comprometidosPorOficina[$oficinaId] = ($comprometidosPorOficina[$oficinaId] ?? 0) + 1;
                }
            }

            $data = [];
            foreach ($rows as $row) {
                $oficinaId = $row['oficinaId'];

                // Si la oficina es especial y ya alcanzó el límite de comprometidas,
                // los "sin_evaluar" restantes de esa oficina ya no se muestran.
                if ($oficinaId && isset($oficinasEspeciales[$oficinaId]) && $row['estado'] === 'sin_evaluar') {
                    $limite = $oficinasEspeciales[$oficinaId];
                    $comprometidos = $comprometidosPorOficina[$oficinaId] ?? 0;
                    if ($comprometidos >= $limite) {
                        continue;
                    }
                }

                $nombre = trim(($row['firstName'] ?? '') . ' ' . ($row['lastName'] ?? ''));
                if (empty($nombre)) $nombre = $row['userName'];

                $data[] = [
                    'id' => $row['id'],
                    'leaderId' => $row['leaderId'],
                    'leaderName' => $nombre,
                    'estado' => $row['estado'],
                ];
            }

            return [
                'success' => true,
                'periodoActivo' => true,
                'periodoId' => $periodo['id'],
                'data' => $data,
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function _obtenerOficinasEspecialesPorPeriodo(string $periodoId): array
    {
        $registros = $this->getEntityManager()->getRDBRepository('EncuestaLiderazgoOficinaEspecial')
            ->where(['encuestaLiderazgoEncuestaId' => $periodoId])
            ->select(['teamOficinaId', 'limiteEvaluaciones'])
            ->find();

        $mapa = [];
        foreach ($registros as $r) {
            $mapa[$r->get('teamOficinaId')] = (int) $r->get('limiteEvaluaciones');
        }
        return $mapa;
    }

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

    // Minutos mínimos entre envíos. TEMPORAL para pruebas: luego pasará a ser
    // algo como 1440 (1 día).
    const MINUTOS_ENTRE_MENSAJES = 5;

    private function _minutosRestantes(?string $fechaUltimoEnvio): int
    {
        if (!$fechaUltimoEnvio) {
            return 0;
        }

        $ultimo = new \DateTime($fechaUltimoEnvio);
        $ahora = new \DateTime();
        $diffMinutos = ($ahora->getTimestamp() - $ultimo->getTimestamp()) / 60;

        $restantes = self::MINUTOS_ENTRE_MENSAJES - $diffMinutos;
        return $restantes > 0 ? (int) ceil($restantes) : 0;
    }

    /**
     * Normaliza un teléfono al formato que espera la API de WhatsApp
     * (solo dígitos, con código de país 58 adelante).
     * - Ya viene como 58 + 10 dígitos (con o sin '+'): se usa tal cual.
     * - Viene en formato local venezolano (0 + 10 dígitos): se le cambia
     *   el '0' inicial por '58'.
     * - Cualquier otro formato: caso especial no soportado, se omite (null).
     */
    private function _normalizarTelefono(?string $raw): ?string
    {
        if (!$raw) {
            return null;
        }

        $digits = preg_replace('/\D/', '', $raw);

        if (preg_match('/^58\d{10}$/', $digits)) {
            return $digits;
        }

        if (preg_match('/^0\d{10}$/', $digits)) {
            return '58' . substr($digits, 1);
        }

        return null;
    }

    /**
     * Envío real a la API de WhatsApp (Meta Graph API), usando una plantilla
     * aprobada. $parametros es una lista ordenada de valores para las
     * variables {{1}}, {{2}}, ... del cuerpo de la plantilla.
     */
    private function _enviarWhatsapp(string $telefono, string $template, array $parametros): array
    {
        $token = $this->getConfig()->get('whatsappToken');
        $phoneNumberId = $this->getConfig()->get('whatsappPhoneNumberId');

        if (!$token || !$phoneNumberId) {
            return [
                'success' => false,
                'error' => 'Falta configurar whatsappToken / whatsappPhoneNumberId en config-internal.php.',
            ];
        }

        $parametrosBody = [];
        foreach ($parametros as $i => $valor) {
            $parametrosBody[] = [
                'type' => 'text',
                'parameter_name' => (string) ($i + 1),
                'text' => (string) $valor,
            ];
        }

        $body = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $telefono,
            'type' => 'template',
            'template' => [
                'name' => $template,
                'language' => ['code' => 'ES'],
                'components' => [
                    ['type' => 'BODY', 'parameters' => $parametrosBody],
                ],
            ],
        ];

        $url = 'https://graph.facebook.com/v24.0/' . $phoneNumberId . '/messages';

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $respuesta = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errorCurl = curl_error($ch);
        curl_close($ch);

        if ($errorCurl) {
            return ['success' => false, 'error' => 'Error de conexión: ' . $errorCurl];
        }

        $respuestaData = json_decode($respuesta, true);

        if ($httpCode >= 200 && $httpCode < 300) {
            return ['success' => true];
        }

        $mensajeError = $respuestaData['error']['message'] ?? ('Error HTTP ' . $httpCode);
        return ['success' => false, 'error' => $mensajeError];
    }

    // =========================================================
    //  POST: Enviar mensaje masivo (a todos los que tienen pendientes)
    // =========================================================
    public function postActionEnviarMensajeMasivo($params, $data, $request)
    {
        try {
            if (!$this->_esCasaNacional()) {
                throw new Forbidden('No tiene permisos para enviar mensajes.');
            }

            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();

            $periodo = $this->_obtenerPeriodoActivoEntidad();
            if (!$periodo) {
                throw new BadRequest('No hay un periodo activo.');
            }

            $minutosRestantes = $this->_minutosRestantes($periodo->get('fechaUltimoEnvioGeneral'));
            if ($minutosRestantes > 0) {
                throw new BadRequest('Debes esperar ' . $minutosRestantes . ' minuto(s) más para volver a enviar el mensaje general.');
            }

            // Primer envío general de este periodo -> plantilla de invitación.
            // Envíos siguientes -> plantilla de recordatorio.
            $esPrimerEnvio = !$periodo->get('fechaUltimoEnvioGeneral');
            $template = $esPrimerEnvio ? 'evaluacin_de_liderazgo_c21' : 'amable_recordatorio_evaluacin_de_liderazgo_c21';
            $fechaFinFormateada = date('Y/m/d', strtotime($periodo->get('fechaFin')));

            // $sql = "SELECT DISTINCT asesor_asignado_id as userId
            //         FROM encuesta_liderazgo_asesores_por_evaluar
            //         WHERE deleted = 0 AND encuesta_liderazgo_encuesta_id = ?
            //           AND evaluado IN ('sin_evaluar', 'parcial')";
            // $sth = $pdo->prepare($sql);
            // $sth->execute([$periodo->get('id')]);
            // $userIds = $sth->fetchAll(\PDO::FETCH_COLUMN);

            // ==========================================================
            // === SOLO PRUEBAS: quitar este bloque para producción =====
            // Reemplaza la lista real por un puñado de IDs de prueba.
            $userIds = [
                '67f41b1f91ab648fd',
                '6904d2624fd6a66da',
                '67f90fa8216aa4c61',
                '2146',
            ];
            // === FIN BLOQUE DE PRUEBAS =================================
            // ==========================================================

            $ahora = date('Y-m-d H:i:s');
            $enviados = 0;
            $omitidosPorTelefono = 0;
            $fallidos = 0;

            foreach ($userIds as $userId) {
                $usuario = $entityManager->getEntity('User', $userId);
                if (!$usuario) continue;

                $telefono = $this->_normalizarTelefono($usuario->get('phoneNumber'));
                if (!$telefono) {
                    $omitidosPorTelefono++;
                    continue;
                }

                $nombre = $usuario->get('name');
                $parametros = $esPrimerEnvio ? [$nombre] : [$nombre, $fechaFinFormateada];

                $resultado = $this->_enviarWhatsapp($telefono, $template, $parametros);

                if ($resultado['success']) {
                    $enviados++;
                    $this->_actualizarFechaMensajeIndividual($periodo->get('id'), $userId, $ahora);
                } else {
                    $fallidos++;
                }
            }

            $periodo->set('fechaUltimoEnvioGeneral', $ahora);
            $entityManager->saveEntity($periodo);

            return [
                'success' => true,
                'fechaUltimoEnvioGeneral' => $ahora,
                'totalNotificados' => $enviados,
                'omitidosPorTelefono' => $omitidosPorTelefono,
                'fallidos' => $fallidos,
                'plantillaUsada' => $template,
            ];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================
    //  POST: Enviar mensaje individual a un asesor puntual
    //  (siempre usa la plantilla de recordatorio)
    // =========================================================
    public function postActionEnviarMensajeIndividual($params, $data, $request)
    {
        try {
            if (!$this->_esCasaNacional()) {
                throw new Forbidden('No tiene permisos para enviar mensajes.');
            }

            $userId = $data->userId ?? null;
            if (!$userId) {
                throw new BadRequest('No se indicó el asesor a notificar.');
            }

            $periodo = $this->_obtenerPeriodoActivoEntidad();
            if (!$periodo) {
                throw new BadRequest('No hay un periodo activo.');
            }

            if (!$periodo->get('fechaUltimoEnvioGeneral')) {
                throw new BadRequest('Primero hay que enviar el mensaje general al menos una vez.');
            }

            $registro = $this->getEntityManager()->getRDBRepository('EncuestaLiderazgoMensajeEvaluador')
                ->where(['encuestaLiderazgoEncuestaId' => $periodo->get('id'), 'usuarioId' => $userId])
                ->findOne();

            $minutosRestantes = $this->_minutosRestantes($registro ? $registro->get('fechaUltimoEnvio') : null);
            if ($minutosRestantes > 0) {
                throw new BadRequest('Debes esperar ' . $minutosRestantes . ' minuto(s) más para volver a enviarle un mensaje a este asesor.');
            }

            $usuario = $this->getEntityManager()->getEntity('User', $userId);
            if (!$usuario) {
                throw new BadRequest('El asesor indicado no existe.');
            }

            $telefono = $this->_normalizarTelefono($usuario->get('phoneNumber'));
            if (!$telefono) {
                throw new BadRequest('El teléfono de este asesor no es válido o no está registrado.');
            }

            $fechaFinFormateada = date('Y/m/d', strtotime($periodo->get('fechaFin')));
            $resultado = $this->_enviarWhatsapp(
                $telefono,
                'amable_recordatorio_evaluacin_de_liderazgo_c21',
                [$usuario->get('name'), $fechaFinFormateada]
            );

            if (!$resultado['success']) {
                throw new BadRequest('No se pudo enviar el mensaje: ' . $resultado['error']);
            }

            $ahora = date('Y-m-d H:i:s');
            $this->_actualizarFechaMensajeIndividual($periodo->get('id'), $userId, $ahora);

            return ['success' => true, 'fechaUltimoEnvio' => $ahora];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function _obtenerPeriodoActivoEntidad()
    {
        $pdo = $this->getEntityManager()->getPDO();
        $sql = "SELECT id FROM encuesta_liderazgo_encuesta
                WHERE deleted = 0 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
                ORDER BY fecha_inicio DESC LIMIT 1";
        $sth = $pdo->prepare($sql);
        $sth->execute();
        $id = $sth->fetchColumn();

        if (!$id) {
            return null;
        }

        return $this->getEntityManager()->getEntity('EncuestaLiderazgoEncuesta', $id);
    }

    private function _actualizarFechaMensajeIndividual(string $periodoId, string $userId, string $fecha): void
    {
        $entityManager = $this->getEntityManager();

        $registro = $entityManager->getRDBRepository('EncuestaLiderazgoMensajeEvaluador')
            ->where(['encuestaLiderazgoEncuestaId' => $periodoId, 'usuarioId' => $userId])
            ->findOne();

        if ($registro) {
            $registro->set('fechaUltimoEnvio', $fecha);
            $entityManager->saveEntity($registro);
        } else {
            $nuevo = $entityManager->getNewEntity('EncuestaLiderazgoMensajeEvaluador');
            $nuevo->set([
                'name' => 'Mensaje ' . $userId,
                'encuestaLiderazgoEncuestaId' => $periodoId,
                'usuarioId' => $userId,
                'fechaUltimoEnvio' => $fecha,
            ]);
            $entityManager->saveEntity($nuevo);
        }
    }

    private function _puedeVerPendientes(): bool
    {
        if ($this->_esCasaNacional()) {
            return true;
        }

        $pdo = $this->getEntityManager()->getPDO();
        $sql = "SELECT COUNT(*) FROM role_user ru
                INNER JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                WHERE ru.user_id = ? AND ru.deleted = 0
                  AND LOWER(r.name) IN ('gerente', 'director', 'coordinador')";
        $sth = $pdo->prepare($sql);
        $sth->execute([$this->getUser()->get('id')]);
        return (int) $sth->fetchColumn() > 0;
    }

    // =========================================================
    //  GET: Asesores con evaluaciones pendientes
    //  Casa Nacional ve todas las oficinas; gerente/director/coordinador
    //  solo ven los asesores de su propia oficina.
    //  Solo nombre + cantidad pendiente, NO cuáles líderes faltan.
    // =========================================================
    public function getActionGetAsesoresPendientes($params, $data, $request)
    {
        try {
            if (!$this->_puedeVerPendientes()) {
                throw new Forbidden('No tiene permisos para ver esta información.');
            }

            $esCasaNacional = $this->_esCasaNacional();

            $pdo = $this->getEntityManager()->getPDO();

            $sqlPeriodo = "SELECT id FROM encuesta_liderazgo_encuesta
                           WHERE deleted = 0 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()
                           ORDER BY fecha_inicio DESC LIMIT 1";
            $sth = $pdo->prepare($sqlPeriodo);
            $sth->execute();
            $periodo = $sth->fetch(\PDO::FETCH_ASSOC);

            if (!$periodo) {
                return ['success' => true, 'periodoActivo' => false, 'data' => []];
            }

            $oficinasEspeciales = $this->_obtenerOficinasEspecialesPorPeriodo($periodo['id']);

            // Se agrupa por (evaluador, oficina del líder) para poder aplicar el
            // límite de oficinas especiales por separado en cada una.
            $sql = "SELECT ape.asesor_asignado_id as userId, ae.team_asesor_id as oficinaId,
                        SUM(CASE WHEN ape.evaluado IN ('sin_evaluar', 'parcial') THEN 1 ELSE 0 END) as pendientesRaw,
                        SUM(CASE WHEN ape.evaluado = 'evaluado' THEN 1 ELSE 0 END) as evaluadoRaw,
                        COUNT(*) as totalRaw
                    FROM encuesta_liderazgo_asesores_por_evaluar ape
                    LEFT JOIN encuesta_liderazgo_asesores_evaluados ae
                        ON ae.encuesta_liderazgo_encuesta_id = ape.encuesta_liderazgo_encuesta_id
                       AND ae.asesor_encuestado_id = ape.asesor_encuestado_id
                       AND ae.deleted = 0
                    WHERE ape.deleted = 0
                      AND ape.encuesta_liderazgo_encuesta_id = ?
                      AND ape.evaluado != 'no_aplica'
                    GROUP BY ape.asesor_asignado_id, ae.team_asesor_id";
            $sth = $pdo->prepare($sql);
            $sth->execute([$periodo['id']]);
            $filasGrupo = $sth->fetchAll(\PDO::FETCH_ASSOC);

            // Sumar, por evaluador, el total y pendientes "efectivos" de cada oficina
            // (usando el límite como total si la oficina es especial).
            $porUsuario = [];
            foreach ($filasGrupo as $g) {
                $userId = $g['userId'];
                $oficinaId = $g['oficinaId'];
                $evaluadoRaw = (int) $g['evaluadoRaw'];

                if ($oficinaId && isset($oficinasEspeciales[$oficinaId])) {
                    $limite = $oficinasEspeciales[$oficinaId];
                    $totalEfectivo = $limite;
                    $pendientesEfectivo = max($limite - $evaluadoRaw, 0);
                } else {
                    $totalEfectivo = (int) $g['totalRaw'];
                    $pendientesEfectivo = (int) $g['pendientesRaw'];
                }

                if (!isset($porUsuario[$userId])) {
                    $porUsuario[$userId] = ['pendientes' => 0, 'total' => 0];
                }
                $porUsuario[$userId]['pendientes'] += $pendientesEfectivo;
                $porUsuario[$userId]['total'] += $totalEfectivo;
            }

            $filas = [];
            foreach ($porUsuario as $userId => $c) {
                if ($c['pendientes'] <= 0) continue;
                $filas[] = ['userId' => $userId, 'pendientes' => $c['pendientes'], 'total' => $c['total']];
            }

            if (empty($filas)) {
                return ['success' => true, 'periodoActivo' => true, 'data' => []];
            }

            $userIds = array_column($filas, 'userId');
            $placeholders = implode(',', array_fill(0, count($userIds), '?'));
            $sqlUsuarios = "SELECT id, user_name as userName, first_name as firstName, last_name as lastName
                            FROM user WHERE id IN ($placeholders)";
            $sthU = $pdo->prepare($sqlUsuarios);
            $sthU->execute($userIds);
            $usuariosPorId = [];
            foreach ($sthU->fetchAll(\PDO::FETCH_ASSOC) as $u) {
                $usuariosPorId[$u['id']] = $u;
            }

            // El teléfono es un campo multi-valor de Espo (no una columna directa),
            // se obtiene vía el ORM para no depender del esquema interno de esas tablas.
            $usuariosConTelefono = $this->getEntityManager()->getRDBRepository('User')
                ->select(['id', 'phoneNumber'])
                ->where(['id' => $userIds])
                ->find();
            foreach ($usuariosConTelefono as $u) {
                if (isset($usuariosPorId[$u->get('id')])) {
                    $usuariosPorId[$u->get('id')]['telefono'] = $u->get('phoneNumber');
                }
            }

            $oficinas = $this->_resolverOficinasPorUsuarios($pdo, $userIds);

            // Fechas de último mensaje individual enviado a cada uno.
            $fechasMensajeIndividual = [];
            if ($esCasaNacional) {
                $mensajesRepo = $this->getEntityManager()->getRDBRepository('EncuestaLiderazgoMensajeEvaluador')
                    ->where(['encuestaLiderazgoEncuestaId' => $periodo['id'], 'usuarioId' => $userIds])
                    ->select(['usuarioId', 'fechaUltimoEnvio'])
                    ->find();
                foreach ($mensajesRepo as $m) {
                    $fechasMensajeIndividual[$m->get('usuarioId')] = $m->get('fechaUltimoEnvio');
                }
            }

            $data = [];
            foreach ($filas as $fila) {
                $u = $usuariosPorId[$fila['userId']] ?? null;
                $nombre = $u ? trim(($u['firstName'] ?? '') . ' ' . ($u['lastName'] ?? '')) : '';
                if (empty($nombre)) $nombre = $u['userName'] ?? 'Desconocido';

                $oficina = $oficinas[$fila['userId']] ?? null;
                $fechaMensaje = $fechasMensajeIndividual[$fila['userId']] ?? null;

                $data[] = [
                    'userId' => $fila['userId'],
                    'name' => $nombre,
                    'telefono' => $u['telefono'] ?? null,
                    'teamId' => $oficina['teamId'] ?? null,
                    'teamName' => $oficina['teamName'] ?? 'Sin oficina asignada',
                    'pendientes' => (int) $fila['pendientes'],
                    'total' => (int) $fila['total'],
                    'fechaUltimoEnvio' => $fechaMensaje,
                    'minutosRestantesEnvio' => $this->_minutosRestantes($fechaMensaje),
                ];
            }

            // Gerente/director/coordinador: acotar a la propia oficina únicamente.
            if (!$esCasaNacional) {
                $miOficina = $this->_resolverOficinasPorUsuarios($pdo, [$this->getUser()->get('id')]);
                $miTeamId = $miOficina[$this->getUser()->get('id')]['teamId'] ?? null;

                $data = array_values(array_filter($data, function ($d) use ($miTeamId) {
                    return $miTeamId && $d['teamId'] === $miTeamId;
                }));
            }

            // Agrupar visualmente por oficina: se ordena por oficina y luego por nombre.
            usort($data, function ($a, $b) {
                $cmp = strcasecmp($a['teamName'], $b['teamName']);
                return $cmp !== 0 ? $cmp : strcasecmp($a['name'], $b['name']);
            });

            $fechaUltimoEnvioGeneral = null;
            $minutosRestantesGeneral = 0;
            if ($esCasaNacional) {
                $periodoEntidad = $this->getEntityManager()->getEntity('EncuestaLiderazgoEncuesta', $periodo['id']);
                $fechaUltimoEnvioGeneral = $periodoEntidad ? $periodoEntidad->get('fechaUltimoEnvioGeneral') : null;
                $minutosRestantesGeneral = $this->_minutosRestantes($fechaUltimoEnvioGeneral);
            }

            return [
                'success' => true,
                'periodoActivo' => true,
                'data' => $data,
                'puedeEnviarMensajes' => $esCasaNacional,
                'fechaUltimoEnvioGeneral' => $fechaUltimoEnvioGeneral,
                'minutosRestantesEnvioGeneral' => $minutosRestantesGeneral,
            ];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================
    //  Helper: cargar y validar el AsesoresPorEvaluar del usuario actual
    // =========================================================
    private function _cargarAsesorPorEvaluarPropio(string $id)
    {
        $entityManager = $this->getEntityManager();
        $registro = $entityManager->getEntity('EncuestaLiderazgoAsesoresPorEvaluar', $id);

        if (!$registro) {
            throw new NotFound('La evaluación indicada no existe.');
        }

        if ($registro->get('asesorAsignadoId') !== $this->getUser()->get('id')) {
            throw new Forbidden('No tiene permiso para acceder a esta evaluación.');
        }

        if (!$this->_periodoEstaActivo($registro->get('encuestaLiderazgoEncuestaId'))) {
            throw new Forbidden('El periodo de esta evaluación ya no está activo.');
        }

        // Si es una evaluación aún no iniciada y su oficina es especial, verificar
        // que el asesor no haya alcanzado ya su límite de evaluaciones comprometidas.
        if ($registro->get('evaluado') === 'sin_evaluar') {
            $this->_verificarLimiteOficinaEspecial($registro);
        }

        return $registro;
    }

    private function _verificarLimiteOficinaEspecial($registro): void
    {
        $periodoId = $registro->get('encuestaLiderazgoEncuestaId');
        $entityManager = $this->getEntityManager();

        $asesorEvaluado = $entityManager->getRDBRepository('EncuestaLiderazgoAsesoresEvaluados')
            ->where([
                'encuestaLiderazgoEncuestaId' => $periodoId,
                'asesorEncuestadoId' => $registro->get('asesorEncuestadoId'),
            ])
            ->findOne();

        $oficinaId = $asesorEvaluado ? $asesorEvaluado->get('teamAsesorId') : null;
        if (!$oficinaId) {
            return;
        }

        $oficinasEspeciales = $this->_obtenerOficinasEspecialesPorPeriodo($periodoId);
        if (!isset($oficinasEspeciales[$oficinaId])) {
            return;
        }

        $limite = $oficinasEspeciales[$oficinaId];

        $comprometidos = $this->_contarComprometidosOficina($periodoId, $registro->get('asesorAsignadoId'), $oficinaId);

        if ($comprometidos >= $limite) {
            throw new Forbidden('Ya alcanzaste el límite de ' . $limite . ' evaluaciones para esta oficina.');
        }
    }

    private function _contarComprometidosOficina(string $periodoId, string $asesorAsignadoId, string $oficinaId): int
    {
        $pdo = $this->getEntityManager()->getPDO();
        $sql = "SELECT COUNT(*) FROM encuesta_liderazgo_asesores_por_evaluar ape
                INNER JOIN encuesta_liderazgo_asesores_evaluados ae
                    ON ae.encuesta_liderazgo_encuesta_id = ape.encuesta_liderazgo_encuesta_id
                   AND ae.asesor_encuestado_id = ape.asesor_encuestado_id
                   AND ae.deleted = 0
                WHERE ape.deleted = 0
                  AND ape.encuesta_liderazgo_encuesta_id = ?
                  AND ape.asesor_asignado_id = ?
                  AND ae.team_asesor_id = ?
                  AND ape.evaluado IN ('parcial', 'evaluado')";
        $sth = $pdo->prepare($sql);
        $sth->execute([$periodoId, $asesorAsignadoId, $oficinaId]);
        return (int) $sth->fetchColumn();
    }

    private function _periodoEstaActivo(?string $periodoId): bool
    {
        if (!$periodoId) {
            return false;
        }

        $pdo = $this->getEntityManager()->getPDO();
        $sql = "SELECT COUNT(*) FROM encuesta_liderazgo_encuesta
                WHERE id = ? AND deleted = 0 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE()";
        $sth = $pdo->prepare($sql);
        $sth->execute([$periodoId]);
        return (int) $sth->fetchColumn() > 0;
    }

    // =========================================================
    //  GET: Datos completos para responder una encuesta
    //  (categorías, preguntas agrupadas por tipo, respuestas ya guardadas)
    // =========================================================
    public function getActionGetEncuestaData($params, $data, $request)
    {
        try {
            $id = $request->get('id');
            if (!$id) {
                throw new BadRequest('No se indicó la evaluación a cargar.');
            }

            $registro = $this->_cargarAsesorPorEvaluarPropio($id);
            $entityManager = $this->getEntityManager();
            $pdo = $entityManager->getPDO();

            $lider = $entityManager->getEntity('User', $registro->get('asesorEncuestadoId'));
            $leaderName = $lider ? $lider->get('name') : 'Líder';

            $estado = $registro->get('evaluado');
            $soloLectura = ($estado === 'evaluado');

            // ── Banco de preguntas: seleccion_simple primero, luego texto, por categoría ──
            $sql = "SELECT c.id as categoriaId, c.name as categoriaName, c.orden as categoriaOrden,
                        p.id as preguntaId, p.pregunta as preguntaTexto, p.tipo as tipo, p.orden as preguntaOrden
                    FROM encuesta_liderazgo_categoria c
                    INNER JOIN encuesta_liderazgo_pregunta p
                        ON p.categoria_liderazgo_id = c.id AND p.deleted = 0 AND p.activa = 1
                    WHERE c.deleted = 0
                    ORDER BY c.orden ASC,
                             CASE p.tipo WHEN 'seleccion_simple' THEN 0 ELSE 1 END ASC,
                             p.orden ASC";
            $sth = $pdo->prepare($sql);
            $sth->execute();
            $filas = $sth->fetchAll(\PDO::FETCH_ASSOC);

            // ── Respuestas ya guardadas (si existe una instancia de encuesta) ──
            $respuestasPorPregunta = [];
            $encuestaLiderazgoId = $registro->get('encuestaLiderazgoId');
            if ($encuestaLiderazgoId) {
                $sqlResp = "SELECT pregunta_id as preguntaId, seleccion, texto
                            FROM encuesta_liderazgo_respuesta
                            WHERE encuesta_liderazgo_id = ? AND deleted = 0";
                $sthR = $pdo->prepare($sqlResp);
                $sthR->execute([$encuestaLiderazgoId]);
                foreach ($sthR->fetchAll(\PDO::FETCH_ASSOC) as $r) {
                    $respuestasPorPregunta[$r['preguntaId']] = [
                        'seleccion' => $r['seleccion'],
                        'texto' => $r['texto'],
                    ];
                }
            }

            // ── Armar estructura por categoría ──
            $categorias = [];
            foreach ($filas as $fila) {
                $catId = $fila['categoriaId'];
                if (!isset($categorias[$catId])) {
                    $categorias[$catId] = [
                        'id' => $catId,
                        'name' => $fila['categoriaName'],
                        'preguntas' => [],
                    ];
                }

                $respuestaGuardada = $respuestasPorPregunta[$fila['preguntaId']] ?? null;

                $categorias[$catId]['preguntas'][] = [
                    'id' => $fila['preguntaId'],
                    'texto' => $fila['preguntaTexto'],
                    'tipo' => $fila['tipo'],
                    'seleccion' => $respuestaGuardada['seleccion'] ?? null,
                    'texto_respuesta' => $respuestaGuardada['texto'] ?? null,
                ];
            }

            return [
                'success' => true,
                'leaderName' => $leaderName,
                'estado' => $estado,
                'soloLectura' => $soloLectura,
                'categorias' => array_values($categorias),
            ];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage(), 'forbidden' => true];
        } catch (NotFound $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================
    //  POST: Guardar respuestas (parcial o completo)
    //  Detecta automáticamente si la encuesta queda completa:
    //  si TODAS las preguntas activas quedan respondidas, se marca
    //  'evaluado' y se anonimiza (se anula el usuario evaluador
    //  en la instancia EncuestaLiderazgo asociada).
    // =========================================================
    public function postActionGuardarRespuestas($params, $data, $request)
    {
        $entityManager = $this->getEntityManager();

        try {
            $id = $data->asesorPorEvaluarId ?? null;
            $respuestas = $data->respuestas ?? [];

            if (!$id) {
                throw new BadRequest('No se indicó la evaluación a guardar.');
            }

            $registro = $this->_cargarAsesorPorEvaluarPropio($id);

            if ($registro->get('evaluado') === 'evaluado') {
                throw new Forbidden('Esta encuesta ya fue completada y no puede modificarse.');
            }

            // ── Crear la instancia EncuestaLiderazgo si es el primer guardado ──
            $encuestaLiderazgoId = $registro->get('encuestaLiderazgoId');

            if (!$encuestaLiderazgoId) {
                $lider = $entityManager->getEntity('User', $registro->get('asesorEncuestadoId'));
                $leaderName = $lider ? $lider->get('name') : '';

                $instancia = $entityManager->getNewEntity('EncuestaLiderazgo');
                $instancia->set([
                    'name' => 'Encuesta Liderazgo - ' . $leaderName . ' - ' . date('Y-m-d'),
                    'fecha' => date('Y-m-d'),
                    'usuarioId' => $this->getUser()->get('id'),
                    'usuarioEvaluadoId' => $registro->get('asesorEncuestadoId'),
                    'oficinaTeamId' => $registro->get('teamAsesorId'),
                    'periodoEncuestaId' => $registro->get('encuestaLiderazgoEncuestaId'),
                ]);
                $entityManager->saveEntity($instancia);

                $encuestaLiderazgoId = $instancia->get('id');
                $registro->set('encuestaLiderazgoId', $encuestaLiderazgoId);
                $entityManager->saveEntity($registro);
            } else {
                $instancia = $entityManager->getEntity('EncuestaLiderazgo', $encuestaLiderazgoId);
            }

            // ── Upsert de cada respuesta enviada ──
            foreach ($respuestas as $r) {
                $preguntaId = $r->preguntaId ?? null;
                if (!$preguntaId) continue;

                $seleccion = property_exists($r, 'seleccion') ? $r->seleccion : null;
                $texto = property_exists($r, 'texto') ? $r->texto : null;

                // Ignorar respuestas totalmente vacías para no crear basura.
                if (empty($seleccion) && (empty($texto) || trim((string) $texto) === '')) {
                    // Si ya existía una respuesta previa, la dejamos (no se borra
                    // por enviar vacío sin querer); solo no creamos una nueva.
                    continue;
                }

                $existente = $entityManager->getRDBRepository('EncuestaLiderazgoRespuesta')
                    ->where([
                        'encuestaLiderazgoId' => $encuestaLiderazgoId,
                        'preguntaId' => $preguntaId,
                    ])
                    ->findOne();

                if ($existente) {
                    $existente->set(['seleccion' => $seleccion, 'texto' => $texto]);
                    $entityManager->saveEntity($existente);
                } else {
                    $nueva = $entityManager->getNewEntity('EncuestaLiderazgoRespuesta');
                    $nueva->set([
                        'encuestaLiderazgoId' => $encuestaLiderazgoId,
                        'preguntaId' => $preguntaId,
                        'seleccion' => $seleccion,
                        'texto' => $texto,
                    ]);
                    $entityManager->saveEntity($nueva);
                }
            }

            // ── Calcular si la encuesta quedó completa ──
            $pdo = $entityManager->getPDO();

            $sqlTotal = "SELECT COUNT(*) FROM encuesta_liderazgo_pregunta WHERE deleted = 0 AND activa = 1";
            $totalActivas = (int) $pdo->query($sqlTotal)->fetchColumn();

            $sqlRespondidas = "SELECT COUNT(DISTINCT r.pregunta_id)
                               FROM encuesta_liderazgo_respuesta r
                               INNER JOIN encuesta_liderazgo_pregunta p ON p.id = r.pregunta_id AND p.deleted = 0 AND p.activa = 1
                               WHERE r.encuesta_liderazgo_id = ? AND r.deleted = 0
                                 AND (
                                    (p.tipo = 'seleccion_simple' AND r.seleccion IS NOT NULL AND r.seleccion != '')
                                    OR (p.tipo = 'texto' AND r.texto IS NOT NULL AND r.texto != '')
                                 )";
            $sthResp = $pdo->prepare($sqlRespondidas);
            $sthResp->execute([$encuestaLiderazgoId]);
            $totalRespondidas = (int) $sthResp->fetchColumn();

            $nuevoEstado = ($totalActivas > 0 && $totalRespondidas >= $totalActivas) ? 'evaluado' : 'parcial';

            $registro->set('evaluado', $nuevoEstado);
            $entityManager->saveEntity($registro);

            if ($nuevoEstado === 'evaluado') {
                // Anonimizar: se anula el evaluador en la instancia de encuesta.
                $instancia->set('usuarioId', null);
                $entityManager->saveEntity($instancia);
            }

            return [
                'success' => true,
                'estado' => $nuevoEstado,
                'soloLectura' => ($nuevoEstado === 'evaluado'),
                'totalActivas' => $totalActivas,
                'totalRespondidas' => $totalRespondidas,
            ];
        } catch (Forbidden $e) {
            return ['success' => false, 'error' => $e->getMessage(), 'forbidden' => true];
        } catch (NotFound $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (BadRequest $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
