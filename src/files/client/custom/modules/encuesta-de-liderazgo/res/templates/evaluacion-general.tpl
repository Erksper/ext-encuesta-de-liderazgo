<div class="reporte-liderazgo-container">
    <div class="reporte-header">
        <div class="logo-c21">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <text x="50" y="60" font-size="40" font-weight="bold" fill="#B8A279" text-anchor="middle">C21</text>
            </svg>
        </div>
        <h2>Evaluación General de Liderazgo</h2>
        <p>Análisis completo por categorías de competencias</p>
    </div>

    <div class="reporte-filters">
        <div class="filter-row">
            <div class="filter-group">
                <label for="cla-select">🏢 CLA</label>
                <select id="cla-select" class="form-control">
                    <option value="">Cargando...</option>
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
            <div class="charts-grid" id="charts-grid"></div>
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

.logo-c21 {
    position: absolute;
    top: 20px;
    right: 30px;
    width: 60px;
    height: 60px;
    background: white;
    padding: 5px;
    border-radius: 8px;
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
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 25px;
}

.chart-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    transition: transform 0.3s, box-shadow 0.3s;
}

.chart-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.12);
}

.chart-card h3 {
    color: #333;
    margin: 0 0 20px 0;
    font-size: 18px;
    padding-bottom: 12px;
    border-bottom: 3px solid #B8A279;
}

.chart-wrapper {
    position: relative;
    height: 300px;
}

.alert-info-custom {
    background: #e3f2fd;
    border-left: 4px solid #2196f3;
    color: #1976d2;
    padding: 12px 15px;
    border-radius: 4px;
    margin-top: 15px;
}

.alert-warning-custom {
    background: #fff3e0;
    border-left: 4px solid #ff9800;
    color: #f57c00;
    padding: 12px 15px;
    border-radius: 4px;
    margin-top: 15px;
}
</style>