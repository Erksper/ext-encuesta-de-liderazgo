<div class="reporte-categoria-container">
    <div class="reporte-header">
        <div class="logo-c21">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <text x="50" y="60" font-size="40" font-weight="bold" fill="#B8A279" text-anchor="middle">C21</text>
            </svg>
        </div>
        <h2>{{categoriaNombre}}</h2>
        <p>Análisis detallado por pregunta</p>
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
    </div>

    <div class="reporte-content">
        <div id="loading-area" class="text-center" style="padding: 40px;">
            <span class="fas fa-spinner fa-spin" style="font-size: 40px; color: #B8A279;"></span>
            <p style="margin-top: 20px;">Cargando datos de la categoría...</p>
        </div>

        <div id="content-area" style="display: none;">
            <!-- Gauge general de la categoría -->
            <div class="categoria-gauge-card">
                <h3>Promedio General de la Categoría</h3>
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
                        <span class="stat-value" id="promedio-general">0.0</span>
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
    height: 250px;
    margin-bottom: 20px;
}

.gauge-stats {
    display: flex;
    justify-content: space-around;
    padding-top: 15px;
    border-top: 1px solid #e0e0e0;
}

.stat-item {
    text-align: center;
}

.stat-label {
    display: block;
    font-size: 14px;
    color: #666;
    margin-bottom: 5px;
}

.stat-value {
    display: block;
    font-size: 24px;
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
</style>