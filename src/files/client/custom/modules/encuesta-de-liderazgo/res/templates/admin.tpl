<div class="page-header text-center">
    <h2>Administración de Liderazgo</h2>
</div>

<div class="admin-container">
    <div class="row">
        <div class="col-md-10 col-md-offset-1">

            <!-- Panel de Carga de CSV -->
            <div class="panel panel-primary">
                <div class="panel-heading">
                    <h3 class="panel-title">
                        <i class="fas fa-upload"></i> Carga de Datos desde CSV
                    </h3>
                </div>
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h4 style="margin-top: 0;">Cargar Evaluaciones</h4>
                            <p>Selecciona un archivo CSV con las evaluaciones de liderazgo para cargar al sistema.</p>
                            <div class="form-group">
                                <input type="file" id="csv-file-input" accept=".csv" class="form-control" style="height: auto; padding: 6px 12px;">
                            </div>
                        </div>
                        <div class="col-md-4 text-right">
                            <button class="btn btn-primary btn-lg" data-action="cargarCSV" style="margin-top: 25px;">
                                <i class="fas fa-upload"></i> Cargar CSV
                            </button>
                        </div>
                    </div>
                    
                    {{#if datosPreview}}
                    <div class="alert alert-info" style="margin-top: 20px; margin-bottom: 0;">
                        <h4><i class="fas fa-info-circle"></i> Preview de Datos</h4>
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>Encuestas válidas procesadas:</strong> {{datosPreview.totalEncuestas}}</p>
                                <p><strong>Categorías encontradas:</strong> {{datosPreview.categoriasUnicas}}</p>
                                <p><strong>Preguntas únicas en CSV:</strong> {{datosPreview.preguntasUnicasEnCSV}}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Preguntas nuevas para agregar:</strong> {{datosPreview.preguntasParaAgregar}}</p>
                                <p><strong>Total respuestas en encuestas válidas:</strong> {{datosPreview.totalRespuestas}}</p>
                            </div>
                        </div>
                    </div>
                    {{/if}}
                </div>
            </div>

            <!-- Panel de Accesos Rápidos -->
            <div class="panel panel-default">
                <div class="panel-heading">
                    <h3 class="panel-title">
                        <i class="fas fa-cog"></i> Gestión de Datos
                    </h3>
                </div>
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-3 col-sm-6" style="margin-bottom: 15px;">
                            <a href="#EncuestaLiderazgoCategoria" class="btn btn-default btn-block btn-lg" style="height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                <i class="fas fa-folder" style="font-size: 24px; margin-bottom: 5px;"></i>
                                <span>Categorías</span>
                            </a>
                        </div>
                        <div class="col-md-3 col-sm-6" style="margin-bottom: 15px;">
                            <a href="#EncuestaLiderazgoPregunta" class="btn btn-default btn-block btn-lg" style="height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                <i class="fas fa-question-circle" style="font-size: 24px; margin-bottom: 5px;"></i>
                                <span>Preguntas</span>
                            </a>
                        </div>
                        <div class="col-md-3 col-sm-6" style="margin-bottom: 15px;">
                            <a href="#EncuestaLiderazgo" class="btn btn-default btn-block btn-lg" style="height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                <i class="fas fa-clipboard-list" style="font-size: 24px; margin-bottom: 5px;"></i>
                                <span>Encuestas</span>
                            </a>
                        </div>
                        <div class="col-md-3 col-sm-6" style="margin-bottom: 15px;">
                            <a href="#EncuestaLiderazgoRespuesta" class="btn btn-default btn-block btn-lg" style="height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                <i class="fas fa-comments" style="font-size: 24px; margin-bottom: 5px;"></i>
                                <span>Respuestas</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Botón de Volver -->
            <div class="text-center" style="margin-top: 20px;">
                <a href="#Liderazgo" class="btn btn-default">
                    <i class="fas fa-arrow-left"></i> Volver a Reportes
                </a>
            </div>

        </div>
    </div>
</div>

{{#if mostrarPreviewTabla}}
<div class="row" style="margin-top: 20px;">
    <div class="col-md-12">
        <div class="panel panel-info">
            <div class="panel-heading">
                <h3 class="panel-title">
                    <i class="fas fa-table"></i> Preview de Datos Procesados
                </h3>
            </div>
            <div class="panel-body" style="max-height: 500px; overflow-y: auto;">
                {{{tablaPreviewHTML}}}
            </div>
        </div>
    </div>
</div>
{{/if}}

<style>
.admin-container {
    padding: 20px 0;
}

.panel-primary .panel-heading {
    background-color: #B8A279;
    border-color: #B8A279;
}

.btn-primary {
    background-color: #B8A279;
    border-color: #B8A279;
}

.btn-primary:hover,
.btn-primary:focus,
.btn-primary:active {
    background-color: #a89b78;
    border-color: #948766;
}

#csv-file-input {
    cursor: pointer;
}

.preview-table {
    width: 100%;
    font-size: 12px;
}

.preview-table th {
    background-color: #f5f5f5;
    font-weight: bold;
    position: sticky;
    top: 0;
}

.preview-table td,
.preview-table th {
    padding: 8px;
    border: 1px solid #ddd;
}

.preview-table tr:nth-child(even) {
    background-color: #f9f9f9;
}
</style>