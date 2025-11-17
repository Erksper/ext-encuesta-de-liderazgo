define('encuesta-de-liderazgo:views/categoria-detalle', ['view'], function (Dep) {
    
    return Dep.extend({
        
        template: 'encuesta-de-liderazgo:categoria-detalle',
        
        COLORES: {
            '4': '#A0A57E',
            '3': '#6B6F47', 
            '2': '#D3D3D3',
            '1': '#333333'
        },
        
        LABELS: {
            '4': 'Siempre',
            '3': 'Casi Siempre', 
            '2': 'Pocas Veces',
            '1': 'Nunca'
        },
        
        setup: function () {
            console.log('Setup categoria-detalle, options:', this.options);
            
            this.categoriaNombre = this.options.categoriaNombre || 'Categoría';
            
            // Parsear parámetros compuestos desde la URL
            this.filtros = this.parseFiltrosFromUrl();
            console.log('Filtros parseados:', this.filtros);
            
            this.state = {
                filtros: this.filtros,
                gaugeChart: null,
                encuestas: [],
                respuestas: [],
                preguntas: []
            };
            
            this.wait(true);
            this.cargarDatos();
        },
        
        // NUEVO MÉTODO: Parsear parámetros compuestos
        parseFiltrosFromUrl: function() {
            var filtros = {
                anio: null,
                cla: null, 
                oficina: null,
                usuario: null
            };
            
            // Intentar obtener de options primero
            if (this.options.filtros) {
                var partes = this.options.filtros.split('-');
                if (partes.length >= 4) {
                    filtros.anio = partes[0] !== 'null' ? partes[0] : null;
                    filtros.cla = partes[1] !== 'null' ? partes[1] : null;
                    filtros.oficina = partes[2] !== 'null' ? partes[2] : null;
                    filtros.usuario = partes[3] !== 'null' ? partes[3] : null;
                }
            }
            
            return filtros;
        },
        
        data: function () {
            return {
                categoriaNombre: this.categoriaNombre,
                // Ocultar filtros ya que vienen por parámetros
                mostrarFiltros: false
            };
        },
        
        afterRender: function () {
            console.log('afterRender categoria-detalle ejecutado');
            
            // Verificar si Chart.js está cargado
            if (typeof Chart === 'undefined') {
                console.log('Cargando Chart.js para categoria-detalle...');
                this.cargarChartJS();
            } else {
                this.generarGauge();
                this.generarTablaPreguntas();
            }
        },

        cargarChartJS: function () {
            var script = document.createElement('script');
            script.src = 'client/custom/modules/encuesta-de-liderazgo/lib/chart.min.js';
            script.onload = function() {
                console.log('Chart.js cargado para categoria-detalle');
                this.generarGauge();
                this.generarTablaPreguntas();
            }.bind(this);
            script.onerror = function() {
                console.error('Error al cargar Chart.js');
                this.wait(false);
            }.bind(this);
            document.head.appendChild(script);
        },
        
        cargarDatos: function () {
            console.log('Cargando datos para categoría:', this.categoriaNombre, 'con filtros:', this.filtros);
            this.mostrarLoading(true);
            
            // Primero encontrar la categoría por nombre
            this.fetchCategorias().then(function (categorias) {
                var categoria = categorias.find(c => 
                    c.name && c.name.toLowerCase() === this.categoriaNombre.toLowerCase()
                );
                
                if (!categoria) {
                    console.error('Categoría no encontrada:', this.categoriaNombre);
                    Espo.Ui.error('Categoría no encontrada: ' + this.categoriaNombre);
                    this.mostrarNoData();
                    return;
                }
                
                this.categoriaId = categoria.id;
                console.log('ID de categoría encontrado:', this.categoriaId);
                
                return Promise.all([
                    this.fetchEncuestasFiltradas(),
                    this.fetchPreguntasPorCategoria(this.categoriaId)
                ]);
            }.bind(this)).then(function (resultados) {
                if (!resultados) return;
                
                var encuestas = resultados[0];
                var preguntas = resultados[1];
                
                this.state.encuestas = encuestas || [];
                this.state.preguntas = preguntas || [];
                
                console.log('Encuestas cargadas:', this.state.encuestas.length);
                console.log('Preguntas cargadas:', this.state.preguntas.length);
                
                if (this.state.encuestas.length === 0 || this.state.preguntas.length === 0) {
                    console.log('No hay datos suficientes');
                    this.mostrarNoData();
                    return;
                }
                
                return this.fetchRespuestasPorEncuestas(this.state.encuestas.map(e => e.id));
            }.bind(this)).then(function (respuestas) {
                if (!respuestas) return;
                
                // Filtrar solo respuestas de preguntas de esta categoría
                var preguntasIds = this.state.preguntas.map(p => p.id);
                this.state.respuestas = respuestas.filter(r => 
                    preguntasIds.includes(r.preguntaId) && r.seleccion
                );
                
                console.log('Respuestas filtradas:', this.state.respuestas.length);
                
                if (this.state.respuestas.length === 0) {
                    this.mostrarNoData();
                    return;
                }
                
                this.mostrarContenido();
                
            }.bind(this)).catch(function (error) {
                console.error('Error cargando datos:', error);
                Espo.Ui.error('Error al cargar los datos de la categoría');
                this.mostrarNoData();
            }.bind(this));
        },
        
        // MÉTODOS FETCH (solo los necesarios, eliminamos los de teams)
        
        fetchCategorias: function () {
            return new Promise(function (resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgoCategoria', function (collection) {
                    collection.maxSize = 200;
                    
                    collection.fetch().then(function () {
                        var models = collection.models || [];
                        var categorias = models.map(m => ({
                            id: m.id,
                            name: m.get('name')
                        }));
                        resolve(categorias);
                    }).catch(reject);
                }.bind(this));
            }.bind(this));
        },
        
        fetchPreguntasPorCategoria: function (categoriaId) {
            return new Promise(function (resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function (collection) {
                    collection.maxSize = 200;
                    collection.where = [
                        { type: 'equals', attribute: 'categoriaLiderazgoId', value: categoriaId }
                    ];
                    
                    collection.fetch().then(function () {
                        var models = collection.models || [];
                        var preguntas = models.map(m => ({
                            id: m.id,
                            pregunta: m.get('pregunta'),
                            orden: m.get('orden') || 0
                        }));
                        resolve(preguntas);
                    }).catch(reject);
                }.bind(this));
            }.bind(this));
        },
        
        fetchEncuestasFiltradas: function () {
            return new Promise(function (resolve, reject) {
                var maxSize = 200;
                var allEncuestas = [];
                
                var whereConditions = [];
                
                // Filtro por año
                if (this.filtros.anio) {
                    var año = parseInt(this.filtros.anio);
                    var fechaInicio = año + '-01-01';
                    var fechaFin = año + '-12-31';
                    
                    whereConditions.push({
                        type: 'between',
                        attribute: 'fecha', 
                        value: [fechaInicio, fechaFin]
                    });
                }
                
                // Filtro por CLA
                if (this.filtros.cla && this.filtros.cla !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'claTeamId',
                        value: this.filtros.cla
                    });
                }
                
                // Filtro por oficina
                if (this.filtros.oficina) {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'oficinaTeamId', 
                        value: this.filtros.oficina
                    });
                }
                
                // Filtro por usuario
                if (this.filtros.usuario) {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'usuarioEvaluadoId',
                        value: this.filtros.usuario
                    });
                }
                
                console.log('Where conditions para encuestas:', whereConditions);
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('EncuestaLiderazgo', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        collection.where = whereConditions;
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            allEncuestas = allEncuestas.concat(models.map(m => ({
                                id: m.id,
                                fecha: m.get('fecha'),
                                usuarioEvaluadoId: m.get('usuarioEvaluadoId')
                            })));
                            
                            if (models.length === maxSize && allEncuestas.length < collection.total) {
                                fetchPage(offset + maxSize);
                            } else {
                                resolve(allEncuestas);
                            }
                        }).catch(reject);
                    }.bind(this));
                }.bind(this);
                
                fetchPage(0);
            }.bind(this));
        },
        
        fetchRespuestasPorEncuestas: function (encuestaIds) {
            return new Promise(function (resolve, reject) {
                if (encuestaIds.length === 0) {
                    resolve([]);
                    return;
                }
                
                var maxSize = 200;
                var allRespuestas = [];
                
                var processBatch = function (batchIndex) {
                    if (batchIndex >= Math.ceil(encuestaIds.length / 50)) {
                        resolve(allRespuestas);
                        return;
                    }
                    
                    var batch = encuestaIds.slice(batchIndex * 50, (batchIndex + 1) * 50);
                    
                    var fetchPage = function (offset) {
                        this.getCollectionFactory().create('EncuestaLiderazgoRespuesta', function (collection) {
                            collection.maxSize = maxSize;
                            collection.offset = offset;
                            collection.where = [
                                { type: 'in', attribute: 'encuestaLiderazgoId', value: batch }
                            ];
                            
                            collection.fetch().then(function () {
                                var models = collection.models || [];
                                allRespuestas = allRespuestas.concat(models.map(m => ({
                                    id: m.id,
                                    encuestaLiderazgoId: m.get('encuestaLiderazgoId'),
                                    preguntaId: m.get('preguntaId'),
                                    seleccion: m.get('seleccion'),
                                    texto: m.get('texto')
                                })));
                                
                                if (models.length === maxSize) {
                                    fetchPage(offset + maxSize);
                                } else {
                                    processBatch(batchIndex + 1);
                                }
                            }.bind(this)).catch(reject);
                        }.bind(this));
                    }.bind(this);
                    
                    fetchPage(0);
                }.bind(this);
                
                processBatch(0);
            }.bind(this));
        },
        
        generarGauge: function () {
            console.log('Generando gauge para categoría');
            
            var ctx = document.getElementById('gauge-general');
            if (!ctx) {
                console.error('No se encontró el canvas para el gauge');
                return;
            }
            
            var sumaTotal = 0;
            var conteoTotal = 0;
            
            this.state.respuestas.forEach(r => {
                var valor = parseInt(r.seleccion, 10);
                if (!isNaN(valor)) {
                    sumaTotal += valor;
                    conteoTotal++;
                }
            });
            
            var promedio = conteoTotal > 0 ? (sumaTotal / conteoTotal) : 0;
            var porcentaje = (promedio / 4) * 100;
            
            console.log('Estadísticas gauge:', { promedio, porcentaje, totalRespuestas: conteoTotal });
            
            this.$el.find('#total-respuestas').text(conteoTotal);
            this.$el.find('#promedio-general').text(promedio.toFixed(2));
            
            if (this.state.gaugeChart) {
                this.state.gaugeChart.destroy();
            }
            
            // Asegurarse de que Chart esté disponible
            if (typeof Chart === 'undefined') {
                console.error('Chart.js no está disponible');
                return;
            }
            
            this.state.gaugeChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [porcentaje, 100 - porcentaje],
                        backgroundColor: [this.obtenerColorPorPromedio(promedio), '#e0e0e0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    circumference: 180,
                    rotation: 270,
                    cutout: '75%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    }
                }
            });
            
            console.log('Gauge generado exitosamente');
        },
        
        obtenerColorPorPromedio: function (promedio) {
            if (promedio >= 3.5) return '#A0A57E';
            if (promedio >= 2.5) return '#6B6F47';
            if (promedio >= 1.5) return '#D3D3D3';
            return '#333333';
        },
        
        generarTablaPreguntas: function () {
            var tbody = this.$el.find('#preguntas-tbody');
            tbody.empty();
            
            this.state.preguntas.sort((a, b) => a.orden - b.orden).forEach(function (pregunta) {
                var respuestasPregunta = this.state.respuestas.filter(r => r.preguntaId === pregunta.id);
                
                if (respuestasPregunta.length === 0) return;
                
                var conteo = { '4': 0, '3': 0, '2': 0, '1': 0 };
                respuestasPregunta.forEach(r => {
                    if (conteo.hasOwnProperty(r.seleccion)) {
                        conteo[r.seleccion]++;
                    }
                });
                
                var total = Object.values(conteo).reduce((a, b) => a + b, 0);
                var suma = parseInt(conteo['4']) * 4 + parseInt(conteo['3']) * 3 + 
                           parseInt(conteo['2']) * 2 + parseInt(conteo['1']) * 1;
                var promedio = total > 0 ? (suma / total) : 0;
                
                var porcentajes = {
                    '4': total > 0 ? ((conteo['4'] / total) * 100).toFixed(1) : '0.0',
                    '3': total > 0 ? ((conteo['3'] / total) * 100).toFixed(1) : '0.0',
                    '2': total > 0 ? ((conteo['2'] / total) * 100).toFixed(1) : '0.0',
                    '1': total > 0 ? ((conteo['1'] / total) * 100).toFixed(1) : '0.0'
                };
                
                var row = `
                    <tr>
                        <td>${this.escapeHtml(pregunta.pregunta)}</td>
                        <td class="porcentaje-cell">${porcentajes['4']}%</td>
                        <td class="porcentaje-cell">${porcentajes['3']}%</td>
                        <td class="porcentaje-cell">${porcentajes['2']}%</td>
                        <td class="porcentaje-cell">${porcentajes['1']}%</td>
                        <td class="promedio-cell">${promedio.toFixed(2)}</td>
                    </tr>
                `;
                
                tbody.append(row);
            }.bind(this));
        },
        
        escapeHtml: function (text) {
            if (!text) return '';
            var map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        },
        
        mostrarLoading: function (show) {
            if (show) {
                this.$el.find('#loading-area').show();
                this.$el.find('#content-area').hide();
                this.$el.find('#no-data-area').hide();
            } else {
                this.$el.find('#loading-area').hide();
            }
        },
        
        mostrarContenido: function () {
            console.log('Mostrando contenido de categoria-detalle');
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').show();
            this.$el.find('#no-data-area').hide();
            this.wait(false);
        },
        
        mostrarNoData: function () {
            console.log('Mostrando "no data" en categoria-detalle');
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').show();
            this.wait(false);
        }
        
    });
});