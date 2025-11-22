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
            this.categoriaId = this.options.categoriaId || '';
            this.filtros = this.parseFiltros(this.options.filtros || '');
            
            this.textosCategorias = {
                'Comunicación': 'Esta competencia se refiere a las habilidades del líder para transmitir su mensaje y que el mismo llegue a sus interlocutores; sea internalizado, practicado y apropiado. Dentro de ésta competencia tenemos indicadores que nos pueden guiar sobre si existe o no en la práctica del líder: escucha activa, uso de preguntas poderosas, feedback generativo, conversaciones productivas, comunicación asertiva, coordinación de acciones, negociación.',
                'Trabajo en equipo': 'Esta competencia se refiere a la capacidad del líder de formar equipos de trabajo de alto desempeño. Cohesionados, respetando las individualidades pero siempre guiando al bien común. Los indicadores de cumplimiento de ésta competencia son: colaboración y cooperación, persuasión, reconocimiento del otro, relaciones interpersonales, transmisión de conocimientos, delegación, manejo del conflicto.',
                'Inspiracional y motivacional': 'Esta competencia se basa en la premisa de que un líder no es aquel que te dice qué hacer, sino que te muestra mediante su ejemplo cómo hacerlo. Su conducta es un ejemplo e inspiración para sus colaboradores, así como con su discurso motiva a que las cosas sucedan. Los indicadores de cumplimiento de ésta competencia son: ser fuerza emprendedora, autoestima, seguridad en sí mismo, reconocimiento de méritos, actitud positiva.',
                'Inteligencia emocional-social': 'Se refiere a las habilidades del líder de actuar conociendo sus emociones y reconociendo las de sus colaboradores; buscando formas efectivas de canalizarlas en beneficio personal y de la organización; también está referida a las interrelaciones con los miembros del equipo de trabajo y clientes, generación de confianza. Los indicadores de cumplimiento de ésta competencia son: generación de buen clima, autoconocimiento, autocontrol, reconocimiento de oportunidades de mejora, adaptabilidad.',
                'Desempeño': 'Esta competencia se refiere a la gestión integral del líder, su manejo del tiempo, de los reclamos, de los inconvenientes, la estructuración de su tiempo y la planificación estratégica del trabajo (propio y de su equipo), así como la evaluación y seguimiento de trabajo del equipo. Los indicadores de cumplimiento de ésta competencia son: estructuración del trabajo, innovación enmarcada en la organización, evaluación integral y permanente, formación y desarrollo de líderes, uso de herramientas de equipo.',
                'Visión estratégica organizacional': 'Esta competencia está referida al compromiso del líder para transmitir la cultura de la organización y buscar la mayor integración y alineación de sus seguidores a la misma. Los indicadores de cumplimiento de ésta competencia son: reconocimiento y transmisión de la cultura organizacional, acción estratégica, creación de oportunidades.',
                'Coherencia del liderazgo': 'Esta competencia busca evaluar la autenticidad y la credibilidad del líder. Se centra en si el líder realmente vive y ejemplifica los principios que predica (trabajo en equipo, inteligencia emocional, visión estratégica) y si todas sus manifestaciones están alineadas con el marco superior de la empresa (misión, visión y valores).'                
            };
            
            this.gaugeChart = null;
        },

        parseFiltros: function(filtrosString) {
            var filtros = {
                anio: null,
                cla: null,
                oficina: null,
                usuario: null
            };
            
            if (filtrosString) {
                var partes = filtrosString.split('-');
                
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
                COLORES: this.COLORES,
                LABELS: this.LABELS
            };
        },
        
        afterRender: function () {
            this.mostrarLoadingInicial();
            this.iniciarCargaDatos();
        },

        mostrarLoadingInicial: function () {
            this.$el.find('#loading-area').show();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').hide();
        },

        iniciarCargaDatos: function () {
            if (typeof Chart === 'undefined') {
                this.cargarChartJS();
            } else {
                this.cargarDatos();
            }
        },

        cargarChartJS: function () {
            var script = document.createElement('script');
            script.src = 'client/custom/modules/encuesta-de-liderazgo/lib/chart.min.js';
            script.onload = this.cargarDatos.bind(this);
            script.onerror = function() {
                Espo.Ui.error('Error al cargar la librería de gráficos');
                this.mostrarError('Error al cargar librerías necesarias');
            }.bind(this);
            document.head.appendChild(script);
        },
        
        cargarDatos: function () {
            console.log('Iniciando carga de datos para categoría ID:', this.categoriaId);
            
            this.fetchCategoriaById(this.categoriaId)
                .then(function (categoria) {
                    if (!categoria) {
                        console.error('Categoría no encontrada con ID:', this.categoriaId);
                        Espo.Ui.error('Categoría no encontrada con ID: ' + this.categoriaId);
                        this.mostrarNoData();
                        return Promise.reject('Categoría no encontrada');
                    }
                    
                    console.log('Categoría encontrada:', categoria.name);
                    this.$el.find('#categoria-nombre-titulo').text(categoria.name);
                    this.configurarTextoCategoria(categoria.name);
                    
                    return Promise.all([
                        this.fetchEncuestasFiltradas(),
                        this.fetchPreguntasPorCategoria(this.categoriaId)
                    ]);
                }.bind(this))
                .then(function (resultados) {
                    var encuestas = resultados[0];
                    var preguntas = resultados[1];
                    
                    console.log('Encuestas encontradas:', encuestas.length);
                    console.log('Preguntas encontradas:', preguntas.length);
                    
                    if (encuestas.length === 0 || preguntas.length === 0) {
                        console.log('No hay datos: encuestas o preguntas vacías');
                        this.mostrarNoData();
                        return Promise.reject('No hay datos');
                    }
                    
                    return this.fetchRespuestasPorEncuestas(
                        encuestas.map(e => e.id),
                        preguntas.map(p => p.id)
                    );
                }.bind(this))
                .then(function (respuestas) {
                    console.log('Respuestas encontradas:', respuestas.length);
                    
                    if (respuestas.length === 0) {
                        console.log('No hay respuestas para mostrar');
                        this.mostrarNoData();
                        return;
                    }
                    
                    this.generarGauge(respuestas);
                    this.generarTablaPreguntas(respuestas);
                    this.mostrarContenidoCompleto();
                    
                }.bind(this))
                .catch(function (error) {
                    console.error('Error en cargarDatos:', error);
                    if (error !== 'Categoría no encontrada' && error !== 'No hay datos') {
                        Espo.Ui.error('Error al cargar los datos de la categoría: ' + error);
                    }
                    this.mostrarNoData();
                }.bind(this));
        },

        configurarTextoCategoria: function (nombreCategoria) {
            var textoElement = this.$el.find('#texto-categoria');
            var contenedorElement = this.$el.find('#texto-categoria-especifica');
            
            if (this.textosCategorias.hasOwnProperty(nombreCategoria)) {
                textoElement.text(this.textosCategorias[nombreCategoria]);
                contenedorElement.show();
            } else {
                contenedorElement.hide();
            }
        },

        fetchCategoriaById: function (categoriaId) {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.getModelFactory().create('EncuestaLiderazgoCategoria', function (model) {
                    model.id = categoriaId;
                    model.fetch().then(function () {
                        resolve({
                            id: model.id,
                            name: model.get('name')
                        });
                    }).catch(function(error) {
                        reject(error);
                    });
                });
            });
        },
        
        fetchPreguntasPorCategoria: function (categoriaId) {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.getCollectionFactory().create('EncuestaLiderazgoPregunta', function (collection) {
                    collection.maxSize = 200;
                    collection.where = [
                        { 
                            type: 'equals', 
                            attribute: 'categoriaLiderazgoId', 
                            value: categoriaId 
                        }
                    ];
                    collection.data = { 
                        orderBy: 'orden', 
                        order: 'asc' 
                    };
                    
                    collection.fetch().then(function () {
                        var preguntas = collection.models.map(m => ({
                            id: m.id,
                            pregunta: m.get('pregunta'),
                            orden: m.get('orden') || 0
                        }));
                        resolve(preguntas);
                    }).catch(function(error) {
                        reject(error);
                    });
                });
            });
        },
        
        fetchEncuestasFiltradas: function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                var whereConditions = [];
                
                if (self.filtros.anio) {
                    var año = parseInt(self.filtros.anio);
                    var fechaInicio = año + '-01-01';
                    var fechaFin = año + '-12-31';
                    
                    whereConditions.push({
                        type: 'between',
                        attribute: 'fecha', 
                        value: [fechaInicio, fechaFin]
                    });
                }
                
                if (self.filtros.cla && self.filtros.cla !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'claTeamId',
                        value: self.filtros.cla
                    });
                }
                
                if (self.filtros.oficina && self.filtros.cla && self.filtros.cla !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'oficinaTeamId', 
                        value: self.filtros.oficina
                    });
                }
                
                if (self.filtros.usuario) {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'usuarioEvaluadoId',
                        value: self.filtros.usuario
                    });
                }
                
                self.getCollectionFactory().create('EncuestaLiderazgo', function (collection) {
                    var maxSize = (self.filtros.cla === 'CLA0') ? 100 : 200;
                    collection.maxSize = maxSize;
                    
                    if (whereConditions.length > 0) {
                        collection.where = whereConditions;
                    }
                    
                    collection.fetch().then(function () {
                        var encuestas = collection.models.map(m => ({
                            id: m.id,
                            fecha: m.get('fecha'),
                            usuarioEvaluadoId: m.get('usuarioEvaluadoId')
                        }));
                        console.log('Encuestas encontradas:', encuestas.length, 'para CLA:', self.filtros.cla);
                        resolve(encuestas);
                    }).catch(function(error) {
                        console.error('Error fetching encuestas:', error);
                        reject(error);
                    });
                });
            });
        },
        
        fetchRespuestasPorEncuestas: function (encuestaIds, preguntaIds) {
            var self = this;
            return new Promise(function (resolve, reject) {
                if (encuestaIds.length === 0 || preguntaIds.length === 0) {
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
                        self.getCollectionFactory().create('EncuestaLiderazgoRespuesta', function (collection) {
                            collection.maxSize = maxSize;
                            collection.offset = offset;
                            collection.where = [
                                { type: 'in', attribute: 'encuestaLiderazgoId', value: batch },
                                { type: 'in', attribute: 'preguntaId', value: preguntaIds }
                            ];
                            
                            collection.fetch().then(function () {
                                var models = collection.models || [];
                                var respuestasFiltradas = models
                                    .filter(m => m.get('seleccion'))
                                    .map(m => ({
                                        id: m.id,
                                        encuestaLiderazgoId: m.get('encuestaLiderazgoId'),
                                        preguntaId: m.get('preguntaId'),
                                        seleccion: m.get('seleccion'),
                                        texto: m.get('texto')
                                    }));
                                
                                allRespuestas = allRespuestas.concat(respuestasFiltradas);
                                
                                if (models.length === maxSize) {
                                    fetchPage(offset + maxSize);
                                } else {
                                    processBatch(batchIndex + 1);
                                }
                            }).catch(function(error) {
                                console.error('Error fetching respuestas batch:', batchIndex, error);
                                reject(error);
                            });
                        });
                    };
                    
                    fetchPage(0);
                };
                
                processBatch(0);
            });
        },
        
        generarGauge: function (respuestas) {
            var container = this.$el.find('.gauge-wrapper');
            var ctx = document.getElementById('gauge-general');
            if (!ctx) {
                return;
            }
            
            ctx.style.width = '350px';
            ctx.style.height = '350px';
            ctx.width = 350;
            ctx.height = 350;
            
            var distribucion = { '4': 0, '3': 0, '2': 0, '1': 0 };
            var totalRespuestas = 0;
            
            respuestas.forEach(r => {
                if (distribucion.hasOwnProperty(r.seleccion)) {
                    distribucion[r.seleccion]++;
                    totalRespuestas++;
                }
            });
            
            var sumaTotal = parseInt(distribucion['4']) * 4 + parseInt(distribucion['3']) * 3 + 
                        parseInt(distribucion['2']) * 2 + parseInt(distribucion['1']) * 1;
            var promedio = totalRespuestas > 0 ? (sumaTotal / totalRespuestas) : 0;
            var promedioBase10 = totalRespuestas > 0 ? (promedio / 4 * 10) : 0;
            
            this.$el.find('#total-respuestas').text(totalRespuestas);
            this.$el.find('#promedio-general').text(promedioBase10.toFixed(2) + '/10');
            
            if (this.gaugeChart) {
                this.gaugeChart.destroy();
            }
            
            container.find('.chart-labels').remove();
            
            if (typeof Chart === 'undefined') {
                return;
            }
            
            var labels = [
                this.LABELS['1'],
                this.LABELS['2'],
                this.LABELS['3'],
                this.LABELS['4']
            ];
            var data = [
                distribucion['1'],
                distribucion['2'],
                distribucion['3'],
                distribucion['4']
            ];
            var backgroundColors = [
                this.COLORES['1'],
                this.COLORES['2'],
                this.COLORES['3'],
                this.COLORES['4']
            ];
            
            var porcentajes = data.map(val => totalRespuestas > 0 ? ((val / totalRespuestas) * 100).toFixed(1) : 0);
            
            this.gaugeChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '50%',
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    var label = context.label || '';
                                    var value = context.parsed || 0;
                                    var porcentaje = totalRespuestas > 0 ? ((value / totalRespuestas) * 100).toFixed(1) : 0;
                                    return label + ': ' + value + ' (' + porcentaje + '%)';
                                }
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'etiquetasExternas',
                    afterDraw: function(chart) {
                        if (totalRespuestas === 0) return;
                        
                        var chartArea = chart.chartArea;
                        var centerX = (chartArea.left + chartArea.right) / 2;
                        var centerY = (chartArea.top + chartArea.bottom) / 2;
                        var radius = (chartArea.right - chartArea.left) / 2;
                        
                        var labelsContainer = document.createElement('div');
                        labelsContainer.className = 'chart-labels';
                        container.append(labelsContainer);
                        
                        var posicionesEtiquetas = [
                            { x: centerX - radius * 1.4, y: centerY - radius * 0.8 },
                            { x: centerX + radius * 1.4, y: centerY - radius * 0.8 },
                            { x: centerX + radius * 1.4, y: centerY + radius * 0.8 },
                            { x: centerX - radius * 1.4, y: centerY + radius * 0.8 }
                        ];
                        
                        var angleOffset = -Math.PI / 2;
                        
                        for (var i = 0; i < data.length; i++) {
                            if (data[i] === 0) continue;
                            
                            var sliceAngle = (data[i] / totalRespuestas) * 2 * Math.PI;
                            var angle = angleOffset + sliceAngle / 2;
                            var porcentaje = porcentajes[i];
                            var posicionEtiqueta = posicionesEtiquetas[i];
                            
                            var pointX = centerX + Math.cos(angle) * (radius * 0.9);
                            var pointY = centerY + Math.sin(angle) * (radius * 0.9);
                            
                            var line = document.createElement('div');
                            line.className = 'chart-label-line';
                            
                            var lineLength = Math.sqrt(
                                Math.pow(posicionEtiqueta.x - pointX, 2) + 
                                Math.pow(posicionEtiqueta.y - pointY, 2)
                            );
                            
                            var lineAngle = Math.atan2(posicionEtiqueta.y - pointY, posicionEtiqueta.x - pointX);
                            
                            line.style.width = lineLength + 'px';
                            line.style.height = '1px';
                            line.style.left = pointX + 'px';
                            line.style.top = pointY + 'px';
                            line.style.transform = 'rotate(' + lineAngle + 'rad)';
                            line.style.background = backgroundColors[i];
                            
                            labelsContainer.appendChild(line);
                            
                            var label = document.createElement('div');
                            label.className = 'chart-label';
                            label.style.left = posicionEtiqueta.x + 'px';
                            label.style.top = posicionEtiqueta.y + 'px';
                            label.style.transform = 'translate(-50%, -50%)';
                            label.style.borderColor = backgroundColors[i];
                            
                            var esFondoOscuro = (
                                backgroundColors[i] === '#333333' ||
                                backgroundColors[i] === '#6B6F47'
                            );
                            
                            if (esFondoOscuro) {
                                label.style.background = backgroundColors[i];
                                label.style.color = '#ffffff';
                                label.querySelector = function() { return null; };
                            } else {
                                label.style.background = '#ffffff';
                                label.style.color = '#333333';
                            }
                            
                            label.innerHTML = '<div style="font-weight: bold;">' + labels[i] + '</div>' + 
                                            '<div class="chart-label-value" style="color: ' + 
                                            (esFondoOscuro ? '#e0e0e0' : '#666666') + ';">' + 
                                            data[i] + ' (' + porcentaje + '%)</div>';
                            
                            labelsContainer.appendChild(label);
                            
                            angleOffset += sliceAngle;
                        }
                    }
                }]
            });
        },
        
        generarTablaPreguntas: function (respuestas) {
            var self = this;
            var tbody = this.$el.find('#preguntas-tbody');
            tbody.empty();
            
            this.fetchPreguntasPorCategoria(this.categoriaId).then(function(preguntas) {
                preguntas.sort((a, b) => a.orden - b.orden).forEach(function (pregunta) {
                    var respuestasPregunta = respuestas.filter(r => r.preguntaId === pregunta.id);
                    
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
                    var promedioBase10 = total > 0 ? (promedio / 4 * 10) : 0;
                    
                    var porcentajes = {
                        '4': total > 0 ? ((conteo['4'] / total) * 100).toFixed(1) : '0.0',
                        '3': total > 0 ? ((conteo['3'] / total) * 100).toFixed(1) : '0.0',
                        '2': total > 0 ? ((conteo['2'] / total) * 100).toFixed(1) : '0.0',
                        '1': total > 0 ? ((conteo['1'] / total) * 100).toFixed(1) : '0.0'
                    };
                    
                    var row = `
                        <tr>
                            <td>${self.escapeHtml(pregunta.pregunta)}</td>
                            <td class="porcentaje-cell">${porcentajes['4']}%</td>
                            <td class="porcentaje-cell">${porcentajes['3']}%</td>
                            <td class="porcentaje-cell">${porcentajes['2']}%</td>
                            <td class="porcentaje-cell">${porcentajes['1']}%</td>
                            <td class="promedio-cell">${promedioBase10.toFixed(2)}/10</td>
                        </tr>
                    `;
                    
                    tbody.append(row);
                });
            });
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
        
        mostrarContenidoCompleto: function () {
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').show();
            this.$el.find('#no-data-area').hide();
        },
        
        mostrarNoData: function () {
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').show();
        },
        
        mostrarError: function (mensaje) {
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').show();
            this.$el.find('#no-data-area p').text(mensaje || 'Error al cargar los datos');
        }
        
    });
});