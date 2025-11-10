<div class="page-header text-center">
    <h2>Evaluación de Liderazgo</h2>
</div>

<div class="record-container">
    <div class="row">
        <div class="col-md-10 col-md-offset-1">

            <div class="panel panel-default">
                <div class="panel-heading">
                    <h4 class="panel-title">
                        <i class="fas fa-chart-line"></i> Selecciona un Reporte
                    </h4>
                </div>
                <div class="panel-body">
                    <div class="row">
                        {{#each reportOptions}}
                        <div class="col-md-6 col-lg-4" style="margin-bottom: 15px;">
                            <button class="btn btn-primary btn-block report-button" 
                                    data-report-id="{{id}}" 
                                    data-report-label="{{label}}" 
                                    style="height: 60px; text-align: left;">
                                <i class="{{icon}}" style="margin-right: 10px;"></i>
                                <span>{{label}}</span>
                            </button>
                        </div>
                        {{/each}}
                    </div>
                    
                    <div class="alert alert-info" style="margin-top: 20px;">
                        <i class="fas fa-info-circle"></i>
                        <strong>Información:</strong> Selecciona uno de los reportes para ver el análisis de liderazgo.
                    </div>
                </div>
            </div>

            {{#if esAdmin}}
            <div class="panel panel-warning" style="margin-top: 30px;">
                <div class="panel-heading">
                    <h3 class="panel-title">
                        <i class="fas fa-tools"></i> Panel de Administración
                    </h3>
                </div>
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-8">
                            <h4 style="margin-top: 0;">Carga de Datos desde CSV</h4>
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
                        <p><strong>Encuestas válidas procesadas:</strong> {{datosPreview.totalEncuestas}}</p>
                        <p><strong>Categorías encontradas:</strong> {{datosPreview.categoriasUnicas}}</p>
                        <p><strong>Preguntas únicas en CSV:</strong> {{datosPreview.preguntasUnicasEnCSV}}</p>
                        <p><strong>Preguntas nuevas para agregar:</strong> {{datosPreview.preguntasParaAgregar}}</p>
                        <p><strong>Total respuestas en encuestas válidas:</strong> {{datosPreview.totalRespuestas}}</p>
                    </div>
                    {{/if}}
                </div>
            </div>
            {{/if}}
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
.panel-body .btn.btn-primary:hover,
.panel-body .btn.btn-primary:focus,
.panel-body .btn.btn-primary:active {
    background-color: #a89b78;
    border-color: #948766;
    color: #fff;
}

.report-button {
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.report-button i {
    font-size: 20px;
}

.panel-warning .panel-heading {
    background-color: #f0ad4e;
    border-color: #eea236;
    color: #fff;
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