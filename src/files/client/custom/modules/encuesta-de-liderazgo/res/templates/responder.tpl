<link rel="stylesheet" type="text/css" href="client/custom/modules/encuesta-de-liderazgo/res/css/el-landing.css">
<link rel="stylesheet" type="text/css" href="client/custom/modules/encuesta-de-liderazgo/res/css/el-encuesta.css">

<div class="record-container">
    <div class="row">
        <div class="col-md-10 col-md-offset-1">

            <!-- Tarjeta 1: título + botones -->
            <div class="el-main-card">
                <div class="el-main-card-body">
                    <div class="el-encuesta-header">
                        <div class="el-encuesta-header-info">
                            <h2>Evaluación de <span id="el-nombre-lider">...</span></h2>
                            <p>Responde todas las preguntas de cada pestaña para completar la encuesta</p>
                        </div>
                        <div class="el-encuesta-header-actions">
                            <a href="#Liderazgo/encuesta" class="el-btn" style="width:auto; padding:10px 20px; display:inline-flex;">
                                <i class="fas fa-arrow-left"></i> Volver
                            </a>
                            <button class="el-btn" style="width:auto; padding:10px 20px;" data-action="guardar">
                                <i class="fas fa-save"></i> Guardar
                            </button>
                        </div>
                    </div>

                    <div id="el-readonly-banner" class="el-readonly-banner" style="display:none;">
                        <i class="fas fa-lock"></i> Esta encuesta ya fue completada y no puede modificarse.
                    </div>
                </div>
            </div>

            <!-- Tarjeta 2: la encuesta -->
            <div class="el-main-card">
                <div class="el-main-card-body">
                    <div id="el-encuesta-loading" style="text-align:center; padding: 60px;">
                        <i class="fas fa-spinner fa-spin" style="font-size:28px;"></i>
                        <p style="margin-top:10px; color:#666;">Cargando encuesta...</p>
                    </div>

                    <div id="el-encuesta-content" style="display:none;">
                        <div class="el-tabs-nav" id="el-tabs-nav"></div>
                        <div id="el-tabs-content"></div>
                    </div>
                </div>
            </div>

            <!-- Tarjeta 3: botones al final -->
            <div class="el-main-card" id="el-encuesta-footer-card">
                <div class="el-main-card-body">
                    <div class="el-encuesta-header" style="justify-content:flex-end;">
                        <div class="el-encuesta-header-actions">
                            <a href="#Liderazgo/encuesta" class="el-btn" style="width:auto; padding:10px 20px; display:inline-flex;">
                                <i class="fas fa-arrow-left"></i> Volver
                            </a>
                            <button class="el-btn" style="width:auto; padding:10px 20px;" data-action="guardar">
                                <i class="fas fa-save"></i> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>
