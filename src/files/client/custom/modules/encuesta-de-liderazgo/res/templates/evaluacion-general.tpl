<div class="reporte-liderazgo-container">
    <div class="reporte-header">
        {{#if esAdmin}}
        <a href="#Liderazgo/admin" class="btn-admin">
            <i class="fas fa-cog"></i> Administración
        </a>
        {{/if}}
        <h2>Evaluación General de Liderazgo</h2>
        <p>Análisis completo por categorías de competencias</p>
    </div>

    <div class="reporte-filters">
        <div class="filter-row">
            <!-- NUEVO FILTRO DE FECHA -->
            <div class="filter-group">
                <label for="fecha-select">📅 Año</label>
                <select id="fecha-select" class="form-control">
                    <option value="">Cargando...</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="cla-select">🏢 CLA</label>
                <select id="cla-select" class="form-control" disabled>
                    <option value="">Seleccione un año primero</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="oficina-select">🏪 Oficina</label>
                <select id="oficina-select" class="form-control" disabled>
                    <option value="">Seleccione un CLA primero</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="usuario-select">👤 Usuario</label>
                <select id="usuario-select" class="form-control" disabled>
                    <option value="">Seleccione una Oficina primero</option>
                </select>
            </div>
        </div>
        <div id="filter-alert"></div>
    </div>

    <div class="reporte-content">
        <div id="loading-area" class="text-center" style="padding: 40px;">
            <span class="fas fa-spinner fa-spin" style="font-size: 40px; color: #B8A279;"></span>
            <p style="margin-top: 20px;">Cargando datos de evaluaciones...</p>
        </div>

        <div id="content-area" style="display: none;">
            <div class="stats-summary" id="stats-summary"></div>
            
            <!-- Gráfico de Promedios por Categoría -->
            <div class="promedios-chart-card" id="promedios-chart-container">
                <h3>Promedio General por Categoría</h3>
                <div class="promedios-chart-wrapper">
                    <canvas id="promedios-chart"></canvas>
                </div>
            </div>
            
            <div class="charts-grid" id="charts-grid"></div>
            
            <!-- Sección de Sugerencias (solo visible cuando hay usuario seleccionado) -->
            <div class="sugerencias-card" id="sugerencias-card" style="display: none;">
                <h3>Sugerencias y Recomendaciones</h3>
                <div id="sugerencias-content">
                    <p class="loading-sugerencias">
                        <i class="fas fa-spinner fa-spin"></i> Cargando sugerencias...
                    </p>
                </div>
            </div>
        </div>

        <div id="no-data-area" class="text-center" style="display: none; padding: 60px;">
            <i class="fas fa-inbox" style="font-size: 64px; color: #999;"></i>
            <h3>No hay datos disponibles</h3>
            <p>No se encontraron evaluaciones con los filtros seleccionados</p>
        </div>
    </div>
</div>

<style>
.reporte-liderazgo-container {
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

.btn-admin {
    position: absolute;
    top: 20px;
    right: 30px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s;
    border: 2px solid rgba(255, 255, 255, 0.3);
}

.btn-admin:hover {
    background: rgba(255, 255, 255, 0.3);
    color: white;
    text-decoration: none;
    border-color: rgba(255, 255, 255, 0.5);
}

.btn-admin i {
    margin-right: 5px;
}

.reporte-header h2 {
    margin: 0 0 10px 0;
    font-size: 28px;
}

.reporte-header p {
    margin: 0;
    opacity: 0.95;
}

.reporte-filters {
    padding: 25px;
    background: #f9f9f9;
    border-bottom: 2px solid #e0e0e0;
}

.filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

@media (min-width: 1200px) {
    .filter-row {
        grid-template-columns: repeat(4, 1fr);
    }
}

@media (max-width: 1199px) and (min-width: 768px) {
    .filter-row {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 767px) {
    .filter-row {
        grid-template-columns: 1fr;
    }
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

.stats-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.stat-card {
    background: linear-gradient(135deg, #B8A279 0%, #D4C19C 100%);
    color: white;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
}

.stat-card .number {
    font-size: 36px;
    font-weight: bold;
    margin-bottom: 5px;
}

.stat-card .label {
    font-size: 14px;
    opacity: 0.9;
}

.charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 25px; 
    margin-bottom: 40px; 
    row-gap: 35px; 
}

/* TARJETAS DE GRÁFICOS MÁS ALTAS */
.chart-card {
    background: white;
    border-radius: 8px;
    padding: 25px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: transform 0.3s, box-shadow 0.3s;
    min-height: 450px; /* AUMENTADO para más altura */
}

.chart-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.12);
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.chart-header h3 {
    color: #333;
    margin: 0;
    font-size: 16px;
    padding-bottom: 10px;
    border-bottom: 3px solid #B8A279;
    flex: 1;
}

.info-icon-container {
    margin-left: 10px;
}

.info-icon {
    color: #B8A279;
    cursor: help;
    font-size: 16px;
    transition: color 0.3s;
}

.info-icon:hover {
    color: #6B6F47;
}

/* CONTENEDOR DE GRÁFICOS MÁS ALTO - SOLO UNA CONFIGURACIÓN */
.chart-wrapper {
    position: relative;
    height: 350px; /* AUMENTADO para más altura */
    max-height: 350px;
    width: 100%;
    padding: 15px; /* Más espacio alrededor */
}

.promedios-chart-card {
    background: white;
    border-radius: 8px;
    padding: 25px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    margin-bottom: 25px;
}

.promedios-chart-card h3 {
    color: #333;
    margin: 0 0 20px 0;
    font-size: 18px;
    padding-bottom: 12px;
    border-bottom: 3px solid #B8A279;
}

.promedios-chart-wrapper {
    position: relative;
    height: 400px; /* AUMENTADO para más altura */
    max-height: 400px;
    width: 100%;
    min-width: 500px;
}

/* Asegurar que el canvas de donas tenga espacio suficiente */
.chart-wrapper canvas {
    max-width: 100%;
    max-height: 100%;
}

.sugerencias-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    margin-top: 25px;
}

.sugerencias-card h3 {
    color: #333;
    margin: 0 0 20px 0;
    font-size: 18px;
    padding-bottom: 12px;
    border-bottom: 3px solid #B8A279;
}

#sugerencias-content {
    min-height: 100px;
}

.loading-sugerencias {
    text-align: center;
    color: #666;
    padding: 40px;
}

.sugerencia-item {
    background: #f9f9f9;
    border-left: 4px solid #B8A279;
    padding: 15px;
    margin-bottom: 15px;
    border-radius: 4px;
}

.sugerencia-item h4 {
    margin: 0 0 10px 0;
    color: #B8A279;
    font-size: 16px;
}

.sugerencia-item p {
    margin: 0;
    color: #555;
    line-height: 1.6;
}

.alert-info-custom {
    background: #e3f2fd;
    border-left: 4px solid #2196F3;
    padding: 15px;
    margin: 15px 0;
    border-radius: 4px;
}

/* Mejorar el tooltip */
.tooltip {
    font-size: 13px;
    max-width: 300px;
}

.tooltip-inner {
    background: #333;
    color: white;
    padding: 10px 15px;
    border-radius: 6px;
    text-align: left;
}

/* Estilos mejorados para los textos en gráficos */
.chartjs-render-monitor {
    position: relative;
}
</style>