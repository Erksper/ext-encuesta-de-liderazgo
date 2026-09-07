<?php
// ================================================================
// ARCHIVO TEMPORAL DE PRUEBA - BORRAR ANTES DE PASAR A PRODUCCIÓN.
// Permite disparar los jobs manualmente desde el botón agregado en
// Liderazgo/admin, para probar en ambientes sin cron configurado.
// Quitar este archivo junto con los bloques marcados como
// "TEMPORAL" en admin.js y admin.tpl.
// ================================================================

namespace Espo\Modules\EncuestaDeLiderazgo\Controllers;

use Espo\Core\Controllers\Base;
use Espo\Core\Api\Request;
use Espo\Core\Exceptions\Forbidden;
use Espo\Modules\EncuestaDeLiderazgo\Jobs\CorregirAsesoresPorEvaluar;
use Espo\Modules\EncuestaDeLiderazgo\Jobs\AnonimizarPeriodosVencidos;

class EncuestaLiderazgoJobPrueba extends Base
{
    private function debugLog(string $accion, \Throwable $e): void
    {
        $traza = str_replace(["\r\n", "\n"], ' >> ', $e->getTraceAsString());
        error_log(sprintf(
            '[EncuestaLiderazgoJobPrueba] %s: [%s] %s en %s:%d | TRAZA: %s',
            $accion,
            get_class($e),
            $e->getMessage(),
            $e->getFile(),
            $e->getLine(),
            $traza
        ));
    }

    private function checkAdmin(): void
    {
        if (!$this->getUser()->isAdmin()) {
            throw new Forbidden();
        }
    }

    public function postActionCorregirAsesores(Request $request): array
    {
        $this->checkAdmin();

        try {
            set_time_limit(600);
            ini_set('memory_limit', '512M');

            $job = new CorregirAsesoresPorEvaluar($this->getContainer()->get('entityManager'));
            $job->run();

            return [
                'success' => true,
                'message' => 'Job "Corregir Asesores Por Evaluar" ejecutado. Revisa el log de sincronización para el detalle.',
            ];
        } catch (\Throwable $e) {
            $this->debugLog('corregirAsesores', $e);
            return [
                'success' => false,
                'message' => 'Error ejecutando el job: ' . $e->getMessage(),
            ];
        }
    }

    public function postActionAnonimizarVencidos(Request $request): array
    {
        $this->checkAdmin();

        try {
            set_time_limit(600);
            ini_set('memory_limit', '512M');

            $job = new AnonimizarPeriodosVencidos($this->getContainer()->get('entityManager'));
            $job->run();

            return [
                'success' => true,
                'message' => 'Job "Anonimizar Periodos Vencidos" ejecutado. Revisa el log de sincronización para el detalle.',
            ];
        } catch (\Throwable $e) {
            $this->debugLog('anonimizarVencidos', $e);
            return [
                'success' => false,
                'message' => 'Error ejecutando el job: ' . $e->getMessage(),
            ];
        }
    }
}
