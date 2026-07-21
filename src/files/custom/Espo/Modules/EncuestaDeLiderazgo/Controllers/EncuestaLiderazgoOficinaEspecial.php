<?php

namespace Espo\Modules\EncuestaDeLiderazgo\Controllers;

use Espo\Core\Controllers\Record;

class EncuestaLiderazgoOficinaEspecial extends Record
{
    protected function checkAccess(): bool
    {
        return $this->getUser()->isAdmin() || $this->getUser()->isRegular();
    }

    // Las acciones para gestionar oficinas especiales (listar/guardar junto
    // con el periodo) se agregan en la Parte C.
}
