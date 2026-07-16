<link rel="stylesheet" type="text/css" href="client/custom/modules/encuesta-de-liderazgo/res/css/el-landing.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/encuesta-de-liderazgo/res/css/el-periodo.css">

<div class="el-page-header">
    <div class="el-header-icon">
        <i class="fas fa-calendar-alt"></i>
    </div>
    <div>
        <h2 class="el-page-title">{{#if esEdicion}}Editar Periodo{{else}}Crear Periodo{{/if}}</h2>
        <p class="el-page-sub">Define las fechas de la encuesta y selecciona los líderes a evaluar</p>
    </div>
</div>

<div class="record-container">
    <div class="row">
        <div class="col-md-10 col-md-offset-1">

            <div class="el-main-card">
                <div class="el-main-card-body">

                    <div class="el-periodo-fechas">
                        <div class="el-periodo-fecha-group">
                            <label for="el-fecha-inicio">Fecha de inicio</label>
                            <input type="date" id="el-fecha-inicio" value="{{fechaInicio}}">
                        </div>
                        <div class="el-periodo-fecha-group">
                            <label for="el-fecha-fin">Fecha de fin</label>
                            <input type="date" id="el-fecha-fin" value="{{fechaFin}}">
                        </div>
                    </div>
                    <div class="el-periodo-error" id="el-fechas-error">
                        La fecha de inicio debe ser anterior a la fecha de fin (no pueden ser el mismo día).
                    </div>

                    <div class="el-lideres-toolbar">
                        <input type="text" class="el-lideres-buscador" id="el-buscador-lideres"
                               placeholder="Buscar por nombre u oficina...">
                        <span class="el-lideres-contador" id="el-lideres-contador">0 líderes</span>
                    </div>

                    <div class="el-lideres-tabla-wrap">
                        <table class="el-lideres-tabla">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Oficina</th>
                                    <th>Rol</th>
                                    <th class="el-check-col">Activo</th>
                                </tr>
                            </thead>
                            <tbody id="el-lideres-tbody">
                                <tr><td colspan="4" style="text-align:center; padding: 30px;">
                                    <i class="fas fa-spinner fa-spin"></i> Cargando líderes...
                                </td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="el-periodo-acciones">
                        <a href="#Liderazgo" class="el-btn" style="width:auto; padding:10px 24px;">
                            <i class="fas fa-arrow-left"></i> Cancelar
                        </a>
                        <button class="el-btn" style="width:auto; padding:10px 24px;" data-action="guardarPeriodo">
                            <i class="fas fa-save"></i> Guardar Periodo
                        </button>
                    </div>

                </div>
            </div>

        </div>
    </div>
</div>
