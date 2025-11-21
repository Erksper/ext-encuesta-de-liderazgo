<div class="reporte-categoria-container">
    <div class="reporte-header">
        <div class="header-content">
            <div class="header-title">
                <h2 id="categoria-nombre-titulo">Cargando...</h2>
                <p>Análisis detallado por pregunta</p>
            </div>
            <!-- Texto específico por categoría -->
            <div id="texto-categoria-especifica" class="texto-categoria-especifica" style="display: none;">
                <p id="texto-categoria"></p>
            </div>
        </div>
    </div>

    <div class="reporte-content">
        <div id="loading-area" class="text-center" style="padding: 40px;">
            <span class="fas fa-spinner fa-spin" style="font-size: 40px; color: #B8A279;"></span>
            <p style="margin-top: 20px;">Cargando datos de la categoría...</p>
        </div>

        <div id="content-area" style="display: none;">
            <!-- Gauge general de la categoría -->
            <div class="categoria-gauge-card">
                <h3>Distribución de Respuestas</h3>
                <div class="gauge-wrapper">
                    <canvas id="gauge-general"></canvas>
                </div>
                <div class="gauge-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Respuestas:</span>
                        <span class="stat-value" id="total-respuestas">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Promedio:</span>
                        <span class="stat-value" id="promedio-general">0.0/10</span>
                    </div>
                </div>
                <div class="gauge-legend" style="margin-top: 20px; text-align: center;">
                    <div style="display: inline-flex; flex-wrap: wrap; gap: 15px; justify-content: center;">
                        {{#each LABELS}}
                        <div style="display: flex; align-items: center; margin: 5px;">
                            <div style="width: 16px; height: 16px; background: {{lookup ../COLORES @key}}; border-radius: 3px; margin-right: 8px; border: 1px solid #fff;"></div>
                            <span style="font-size: 12px; font-weight: 500;">{{this}}</span>
                        </div>
                        {{/each}}
                    </div>
                </div>
            </div>

            <!-- Tabla de preguntas -->
            <div class="preguntas-table-card">
                <h3>Detalle por Pregunta</h3>
                <div class="table-responsive">
                    <table class="table table-bordered" id="preguntas-table">
                        <thead>
                            <tr>
                                <th style="width: 50%;">Pregunta</th>
                                <th style="width: 10%; text-align: center;">Siempre</th>
                                <th style="width: 10%; text-align: center;">Casi Siempre</th>
                                <th style="width: 10%; text-align: center;">Pocas Veces</th>
                                <th style="width: 10%; text-align: center;">Nunca</th>
                                <th style="width: 10%; text-align: center;">Promedio</th>
                            </tr>
                        </thead>
                        <tbody id="preguntas-tbody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="no-data-area" class="text-center" style="display: none; padding: 60px;">
            <i class="fas fa-inbox" style="font-size: 64px; color: #999;"></i>
            <h3>No hay datos disponibles</h3>
            <p>No se encontraron respuestas para esta categoría con los filtros seleccionados</p>
        </div>
    </div>
</div>

<style>
.reporte-categoria-container {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.reporte-header {
    background: linear-gradient(135deg, #B8A279 0%, #D4C19C 100%);
    color: white;
    padding: 30px;
    position: relative;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 30px;
}

.header-title {
    flex: 0 0 30%; 
    min-width: 0; 
}

.header-title h2 {
    margin: 0 0 10px 0;
    font-size: 28px;
}

.header-title p {
    margin: 0;
    opacity: 0.95;
}

.texto-categoria-especifica {
    flex: 0 0 65%;
    margin-top: 0;
    padding: 15px;
    background: rgba(255,255,255,0.15);
    border-radius: 8px;
    border-left: 4px solid rgba(255,255,255,0.5);
}

.texto-categoria-especifica p {
    margin: 0;
    font-style: italic;
    opacity: 0.95;
    font-size: 14px;
    line-height: 1.4;
}

/* Para tablets */
@media (max-width: 768px) {
    .header-content {
        flex-direction: column;
        gap: 20px;
    }
    
    .texto-categoria-especifica {
        flex: 0 0 auto;
        width: 100%;
    }

    .texto-categoria-especifica {
        flex: 0 0 auto;
        width: 100%;
    }
}

.reporte-filters {
    padding: 25px;
    background: #f9f9f9;
    border-bottom: 2px solid #e0e0e0;
}

.filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
}

.filter-group {
    display: flex;
    flex-direction: column;
}

.filter-group label {
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
    font-size: 13px;
}

.filter-group select:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
}

.reporte-content {
    padding: 30px;
}

.categoria-gauge-card {
    background: white;
    border-radius: 8px;
    padding: 25px;
    margin-bottom: 30px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.categoria-gauge-card h3 {
    color: #333;
    margin: 0 0 20px 0;
    font-size: 20px;
    padding-bottom: 15px;
    border-bottom: 3px solid #B8A279;
}

.gauge-wrapper {
    position: relative;
    height: 350px;
    width: 350px;
    margin: 0 auto 20px auto;
    max-width: 100%;
}

/* Para tablets */
@media (max-width: 768px) {
    .gauge-wrapper {
        height: 280px;
        width: 280px;
    }
}

/* Para móviles */
@media (max-width: 480px) {
    .gauge-wrapper {
        height: 220px;
        width: 220px;
    }
}

.gauge-stats {
    display: flex;
    justify-content: space-around;
    padding-top: 15px;
    border-top: 1px solid #e0e0e0;
    flex-wrap: wrap;
    gap: 10px;
}

.stat-item {
    text-align: center;
    flex: 1;
    min-width: 120px;
}

.stat-label {
    display: block;
    font-size: 14px;
    color: #666;
    margin-bottom: 5px;
}

.stat-value {
    display: block;
    font-size: 18px;
    font-weight: bold;
    color: #B8A279;
}

.preguntas-table-card {
    background: white;
    border-radius: 8px;
    padding: 25px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.preguntas-table-card h3 {
    color: #333;
    margin: 0 0 20px 0;
    font-size: 20px;
    padding-bottom: 15px;
    border-bottom: 3px solid #B8A279;
}

.table-responsive {
    overflow-x: auto;
}

#preguntas-table {
    width: 100%;
    margin-bottom: 0;
}

#preguntas-table thead th {
    background: #f5f5f5;
    font-weight: 600;
    color: #333;
    padding: 12px;
    border: 1px solid #ddd;
}

#preguntas-table tbody td {
    padding: 12px;
    border: 1px solid #ddd;
    vertical-align: middle;
}

#preguntas-table tbody tr:hover {
    background: #f9f9f9;
}

.porcentaje-cell {
    text-align: center;
    font-weight: 500;
}

.promedio-cell {
    text-align: center;
    font-weight: bold;
    color: #B8A279;
    font-size: 16px;
}

/* Estilos para los porcentajes en la dona */
.chart-porcentajes {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    pointer-events: none;
}

.chart-container {
    position: relative;
    margin: 0 auto;
    width: 350px;
    height: 350px;
}

.chart-labels {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.chart-label {
    position: absolute;
    background: white;
    padding: 8px 12px; /* Aumentado de 4px 8px */
    border-radius: 6px; /* Aumentado de 4px */
    border: 2px solid;
    font-size: 13px; /* Aumentado de 11px */
    font-weight: bold;
    color: #333;
    white-space: nowrap;
    z-index: 10;
    min-width: 90px; /* Aumentado de 70px */
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.chart-label-line {
    position: absolute;
    background: #999;
    transform-origin: 0 0;
    z-index: 5;
    opacity: 0.5;
}

.chart-label-value {
    display: block;
    font-size: 12px; /* Aumentado de 10px */
    color: #666;
    margin-top: 2px; /* Aumentado de 1px */
    font-weight: normal;
}

.label-top {
    transform: translate(-50%, -100%) !important;
    margin-top: -10px !important;
}

.label-bottom {
    transform: translate(-50%, 0) !important;
    margin-top: 10px !important;
}

.label-left {
    transform: translate(-100%, -50%) !important;
    margin-left: -10px !important;
}

.label-right {
    transform: translate(0, -50%) !important;
    margin-left: 10px !important;
}

.porcentaje-dona {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    text-align: center;
    margin: 5px 0;
}
</style>