<link rel="stylesheet" type="text/css" href="client/custom/modules/encuesta-de-liderazgo/res/css/el-landing.css">

<div class="el-page-header">
    <div class="el-header-icon">
        <i class="fas fa-user-tie"></i>
    </div>
    <div>
        <h2 class="el-page-title">Encuesta de Liderazgo</h2>
        <p class="el-page-sub">Evaluación de gerentes, directores y coordinadores</p>
    </div>
</div>

<div class="record-container">
    <div class="row">
        <div class="col-md-8 col-md-offset-2">

            {{#if periodoActivo}}
            <div class="el-periodo-band">
                <i class="fas fa-calendar-check"></i>
                Periodo activo: <strong>{{fechaInicioDisplay}}</strong> al <strong>{{fechaFinDisplay}}</strong>
            </div>
            {{/if}}

            <div class="el-main-card">
                <div class="el-main-card-body">

                    {{#if periodoActivo}}

                        {{#if esCasaNacional}}
                        <button class="el-btn" data-action="crearEditarPeriodo">
                            <i class="fas fa-edit"></i> Editar Periodo
                        </button>
                        {{/if}}

                        {{#if esAsesor}}
                        <button class="el-btn" data-action="contestarEncuesta">
                            <i class="fas fa-clipboard-list"></i> Contestar Encuesta
                        </button>
                        {{/if}}

                        {{#if puedeVerPendientes}}
                        <button class="el-btn" data-action="verPendientes">
                            <i class="fas fa-users-cog"></i> Ver Pendientes
                        </button>
                        {{/if}}

                        {{#if puedeVerReportes}}
                        <button class="el-btn" data-action="verReportes">
                            <i class="fas fa-chart-bar"></i> Reportes
                        </button>
                        {{/if}}

                    {{else}}

                        {{#if esCasaNacional}}
                        <button class="el-btn" data-action="crearEditarPeriodo">
                            <i class="fas fa-plus-circle"></i> Crear Periodo
                        </button>
                        {{/if}}

                        {{#if puedeVerReportes}}
                        <button class="el-btn" data-action="verReportes">
                            <i class="fas fa-chart-bar"></i> Reportes
                        </button>
                        {{/if}}

                    {{/if}}

                </div>
            </div>

        </div>
    </div>
</div>
