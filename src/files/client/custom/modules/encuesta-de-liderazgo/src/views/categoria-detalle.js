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
            console.log('🎯🎯🎯 CATEGORIA-DETALLE SETUP INICIADO 🎯🎯🎯');
            console.log('Options recibidas:', this.options);
            
            this.categoriaNombre = this.options.categoriaNombre || 'Categoría';
            console.log('Nombre de categoría:', this.categoriaNombre);
            
            // Parsear filtros desde las opciones (ahora vienen sin la categoría)
            this.filtros = this.parseFiltros(this.options.filtros || '');
            console.log('Filtros parseados:', this.filtros);
            
            // Textos específicos por categoría
            this.textosCategorias = {
                'Comunicación': 'La comunicación efectiva es fundamental para el liderazgo. Este análisis muestra cómo se percibe la comunicación en el equipo.',
                'Toma de Decisiones': 'La capacidad de tomar decisiones acertadas es clave para el éxito del liderazgo. Revise los resultados obtenidos.',
                'Trabajo en Equipo': 'El trabajo colaborativo fortalece los resultados del equipo. Analice los indicadores de colaboración.',
                'Planificación': 'Una buena planificación es esencial para alcanzar los objetivos. Evalúe los resultados de esta categoría.'
                // Agregar más categorías y textos según sea necesario
            };
            
            this.state = {
                filtros: this.filtros,
                categoriaId: null,
                gaugeChart: null,
                encuestas: [],
                respuestas: [],
                preguntas: [],
                datosCargados: false
            };
        },

        parseFiltros: function(filtrosString) {
            console.log('Parseando filtros string:', filtrosString);
            
            var filtros = {
                anio: null,
                cla: null, 
                oficina: null,
                usuario: null
            };
            
            if (filtrosString) {
                var partes = filtrosString.split('-');
                console.log('Partes de filtros:', partes);
                
                // Ahora son 4 partes (sin la categoría)
                if (partes.length >= 4) {
                    filtros.anio = partes[0] !== 'null' ? partes[0] : null;
                    filtros.cla = partes[1] !== 'null' ? partes[1] : null;
                    filtros.oficina = partes[2] !== 'null' ? partes[2] : null;
                    filtros.usuario = partes[3] !== 'null' ? partes[3] : null;
                }
            }
            
            console.log('Filtros finales:', filtros);
            return filtros;
        },
        
        data: function () {
            return {
                categoriaNombre: this.categoriaNombre,
                filtros: this.filtros,
                COLORES: this.COLORES,
                LABELS: this.LABELS
            };
        },
        
        afterRender: function () {
            console.log('=== AFTER RENDER CATEGORIA-DETALLE ===');
            
            // Mostrar loading inicial
            this.mostrarLoadingInicial();
            
            // Configurar texto específico de categoría
            this.configurarTextoCategoria();
            
            // Iniciar carga de datos en segundo plano
            this.iniciarCargaDatos();
        },

        configurarTextoCategoria: function () {
            var textoElement = this.$el.find('#texto-categoria');
            var contenedorElement = this.$el.find('#texto-categoria-especifica');
            
            if (this.textosCategorias.hasOwnProperty(this.categoriaNombre)) {
                textoElement.text(this.textosCategorias[this.categoriaNombre]);
                contenedorElement.show();
                console.log('✅ Texto específico mostrado para categoría:', this.categoriaNombre);
            } else {
                contenedorElement.hide();
                console.log('ℹ️ No hay texto específico para categoría:', this.categoriaNombre);
            }
        },

        mostrarLoadingInicial: function () {
            console.log('Mostrando loading inicial');
            this.$el.find('#loading-area').show();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').hide();
        },

        iniciarCargaDatos: function () {
            console.log('=== INICIANDO CARGA DE DATOS EN SEGUNDO PLANO ===');
            
            // Verificar si Chart.js está cargado
            if (typeof Chart === 'undefined') {
                console.log('Cargando Chart.js...');
                this.cargarChartJS();
            } else {
                console.log('Chart.js ya está cargado, iniciando carga de datos...');
                this.cargarDatos();
            }
        },

        cargarChartJS: function () {
            var script = document.createElement('script');
            script.src = 'client/custom/modules/encuesta-de-liderazgo/lib/chart.min.js';
            script.onload = function() {
                console.log('Chart.js cargado exitosamente');
                this.cargarDatos();
            }.bind(this);
            script.onerror = function() {
                console.error('Error al cargar Chart.js');
                Espo.Ui.error('Error al cargar la librería de gráficos');
                this.mostrarError('Error al cargar librerías necesarias');
            }.bind(this);
            document.head.appendChild(script);
        },
        
        cargarDatos: function () {
            console.log('=== CARGANDO DATOS ESPECÍFICOS DE CATEGORÍA ===');
            console.log('Categoría:', this.categoriaNombre, 'Filtros:', this.filtros);
            
            // PASO 1: Encontrar la categoría por nombre
            this.fetchCategoriaByNombre(this.categoriaNombre)
                .then(function (categoria) {
                    if (!categoria) {
                        console.error('❌ Categoría no encontrada:', this.categoriaNombre);
                        Espo.Ui.error('Categoría no encontrada: ' + this.categoriaNombre);
                        this.mostrarNoData();
                        return Promise.reject('Categoría no encontrada');
                    }
                    
                    this.state.categoriaId = categoria.id;
                    console.log('✅ ID de categoría encontrado:', this.state.categoriaId);
                    
                    // PASO 2: Cargar en paralelo encuestas y preguntas DE ESTA CATEGORÍA
                    return Promise.all([
                        this.fetchEncuestasFiltradas(),
                        this.fetchPreguntasPorCategoria(this.state.categoriaId)
                    ]);
                }.bind(this))
                .then(function (resultados) {
                    var encuestas = resultados[0];
                    var preguntas = resultados[1];
                    
                    this.state.encuestas = encuestas || [];
                    this.state.preguntas = preguntas || [];
                    
                    console.log('📊 Encuestas cargadas:', this.state.encuestas.length);
                    console.log('❓ Preguntas de esta categoría:', this.state.preguntas.length);
                    
                    if (this.state.encuestas.length === 0 || this.state.preguntas.length === 0) {
                        console.log('⚠️ No hay datos suficientes');
                        this.mostrarNoData();
                        return Promise.reject('No hay datos');
                    }
                    
                    // PASO 3: Cargar SOLO respuestas de estas encuestas Y preguntas
                    return this.fetchRespuestasPorEncuestas(
                        this.state.encuestas.map(e => e.id),
                        this.state.preguntas.map(p => p.id)
                    );
                }.bind(this))
                .then(function (respuestas) {
                    this.state.respuestas = respuestas || [];
                    
                    console.log('✅ Respuestas cargadas (FILTRADAS):', this.state.respuestas.length);
                    
                    if (this.state.respuestas.length === 0) {
                        console.log('⚠️ No hay respuestas para los filtros aplicados');
                        this.mostrarNoData();
                        return;
                    }
                    
                    // Generar visualizaciones
                    this.generarGauge();
                    this.generarTablaPreguntas();
                    this.mostrarContenidoCompleto();
                    
                }.bind(this))
                .catch(function (error) {
                    console.error('❌ Error en carga de datos:', error);
                    if (error !== 'Categoría no encontrada' && error !== 'No hay datos') {
                        Espo.Ui.error('Error al cargar los datos de la categoría');
                    }
                    this.mostrarNoData();
                }.bind(this));
        },
        
        // MÉTODO OPTIMIZADO: Buscar UNA SOLA categoría por nombre
        fetchCategoriaByNombre: function (nombreCategoria) {
            console.log('Buscando categoría por nombre:', nombreCategoria);
            
            return new Promise(function (resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgoCategoria', function (collection) {
                    collection.maxSize = 1; // Solo necesitamos UNA
                    collection.where = [
                        {
                            type: 'equals',
                            attribute: 'name',
                            value: nombreCategoria
                        }
                    ];
                    
                    console.log('Where conditions para categoría:', collection.where);
                    
                    collection.fetch().then(function () {
                        console.log('Categorías encontradas:', collection.length);
                        if (collection.length > 0) {
                            var model = collection.models[0];
                            console.log('✅ Categoría encontrada:', model.id, model.get('name'));
                            resolve({
                                id: model.id,
                                name: model.get('name')
                            });
                        } else {
                            console.log('❌ No se encontró la categoría');
                            resolve(null);
                        }
                    }).catch(function(error) {
                        console.error('Error buscando categoría:', error);
                        reject(error);
                    });
                }.bind(this));
            }.bind(this));
        },
        
        // MÉTODO OPTIMIZADO: Solo preguntas de ESTA categoría
        fetchPreguntasPorCategoria: function (categoriaId) {
            console.log('Buscando preguntas para categoría ID:', categoriaId);
            
            return new Promise(function (resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function (collection) {
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
                    
                    console.log('Where conditions para preguntas:', collection.where);
                    
                    collection.fetch().then(function () {
                        var preguntas = collection.models.map(m => ({
                            id: m.id,
                            pregunta: m.get('pregunta'),
                            orden: m.get('orden') || 0
                        }));
                        console.log('✅ Preguntas encontradas:', preguntas.length);
                        resolve(preguntas);
                    }).catch(function(error) {
                        console.error('Error buscando preguntas:', error);
                        reject(error);
                    });
                }.bind(this));
            }.bind(this));
        },
        
        // MÉTODO OPTIMIZADO: Encuestas filtradas
        fetchEncuestasFiltradas: function () {
            console.log('Buscando encuestas con filtros:', this.filtros);
            
            return new Promise(function (resolve, reject) {
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
                
                this.getCollectionFactory().create('EncuestaLiderazgo', function (collection) {
                    collection.maxSize = 200;
                    collection.where = whereConditions;
                    
                    collection.fetch().then(function () {
                        var encuestas = collection.models.map(m => ({
                            id: m.id,
                            fecha: m.get('fecha'),
                            usuarioEvaluadoId: m.get('usuarioEvaluadoId')
                        }));
                        console.log('✅ Encuestas encontradas:', encuestas.length);
                        resolve(encuestas);
                    }).catch(function(error) {
                        console.error('Error buscando encuestas:', error);
                        reject(error);
                    });
                }.bind(this));
            }.bind(this));
        },
        
        // MÉTODO MÁS OPTIMIZADO: Solo respuestas de encuestas específicas Y preguntas específicas
        fetchRespuestasPorEncuestas: function (encuestaIds, preguntaIds) {
            console.log('Buscando respuestas para:', encuestaIds.length, 'encuestas y', preguntaIds.length, 'preguntas');
            
            return new Promise(function (resolve, reject) {
                if (encuestaIds.length === 0 || preguntaIds.length === 0) {
                    console.log('No hay encuestas o preguntas para buscar respuestas');
                    resolve([]);
                    return;
                }
                
                this.getCollectionFactory().create('EncuestaLiderazgoRespuesta', function (collection) {
                    collection.maxSize = 500; // Límite razonable
                    collection.where = [
                        { 
                            type: 'in', 
                            attribute: 'encuestaLiderazgoId', 
                            value: encuestaIds 
                        },
                        { 
                            type: 'in', 
                            attribute: 'preguntaId', 
                            value: preguntaIds 
                        }
                    ];
                    
                    console.log('Where conditions para respuestas:', collection.where);
                    
                    collection.fetch().then(function () {
                        var respuestas = collection.models
                            .filter(m => m.get('seleccion')) // Solo con selección
                            .map(m => ({
                                id: m.id,
                                encuestaLiderazgoId: m.get('encuestaLiderazgoId'),
                                preguntaId: m.get('preguntaId'),
                                seleccion: m.get('seleccion'),
                                texto: m.get('texto')
                            }));
                        
                        console.log('✅ Respuestas filtradas encontradas:', respuestas.length);
                        resolve(respuestas);
                    }).catch(function(error) {
                        console.error('Error buscando respuestas:', error);
                        reject(error);
                    });
                }.bind(this));
            }.bind(this));
        },
        
        generarGauge: function () {
            console.log('Generando gráfico de distribución para categoría');
            
            var container = this.$el.find('.gauge-wrapper');
            var ctx = document.getElementById('gauge-general');
            if (!ctx) {
                console.error('No se encontró el canvas para el gauge');
                return;
            }
            
            // TAMAÑO REDUCIDO DEL CANVAS
            ctx.style.width = '350px';
            ctx.style.height = '350px';
            ctx.width = 350;
            ctx.height = 350;
            
            // Calcular distribución de respuestas
            var distribucion = { '4': 0, '3': 0, '2': 0, '1': 0 };
            var totalRespuestas = 0;
            
            this.state.respuestas.forEach(r => {
                if (distribucion.hasOwnProperty(r.seleccion)) {
                    distribucion[r.seleccion]++;
                    totalRespuestas++;
                }
            });
            
            console.log('📊 Distribución de respuestas:', distribucion);
            console.log('📈 Total respuestas:', totalRespuestas);
            
            // Calcular promedio (en base 10)
            var sumaTotal = parseInt(distribucion['4']) * 4 + parseInt(distribucion['3']) * 3 + 
                        parseInt(distribucion['2']) * 2 + parseInt(distribucion['1']) * 1;
            var promedio = totalRespuestas > 0 ? (sumaTotal / totalRespuestas) : 0;
            var promedioBase10 = totalRespuestas > 0 ? (promedio / 4 * 10) : 0;
            
            // Actualizar estadísticas
            this.$el.find('#total-respuestas').text(totalRespuestas);
            this.$el.find('#promedio-general').text(promedioBase10.toFixed(2) + '/10');
            
            // Destruir chart anterior si existe
            if (this.state.gaugeChart) {
                this.state.gaugeChart.destroy();
            }
            
            // Limpiar etiquetas anteriores
            container.find('.chart-labels').remove();
            
            if (typeof Chart === 'undefined') {
                console.error('Chart.js no está disponible');
                return;
            }
            
            // Preparar datos para el gráfico - ORDENADOS de 1 a 4
            var labels = [
                this.LABELS['1'], // Nunca
                this.LABELS['2'], // Pocas Veces  
                this.LABELS['3'], // Casi Siempre
                this.LABELS['4']  // Siempre
            ];
            var data = [
                distribucion['1'], // Nunca
                distribucion['2'], // Pocas Veces
                distribucion['3'], // Casi Siempre
                distribucion['4']  // Siempre
            ];
            var backgroundColors = [
                this.COLORES['1'], // Nunca - #333333 (oscuro)
                this.COLORES['2'], // Pocas Veces - #D3D3D3 (claro)
                this.COLORES['3'], // Casi Siempre - #6B6F47 (oscuro)  
                this.COLORES['4']  // Siempre - #A0A57E (medio)
            ];
            
            // Calcular porcentajes
            var porcentajes = data.map(val => totalRespuestas > 0 ? ((val / totalRespuestas) * 100).toFixed(1) : 0);
            
            this.state.gaugeChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
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
                        
                        // Crear contenedor para etiquetas (UNA SOLA VEZ)
                        var labelsContainer = document.createElement('div');
                        labelsContainer.className = 'chart-labels';
                        container.append(labelsContainer);
                        
                        // POSICIONES PREDEFINIDAS EN ORDEN LÓGICO:
                        // 0. Nunca (valor 1) - Arriba izquierda
                        // 1. Pocas Veces (valor 2) - Arriba derecha  
                        // 2. Casi Siempre (valor 3) - Abajo derecha
                        // 3. Siempre (valor 4) - Abajo izquierda
                        var posicionesEtiquetas = [
                            { x: centerX - radius * 1.4, y: centerY - radius * 0.8 }, // Arriba izquierda - Nunca (1)
                            { x: centerX + radius * 1.4, y: centerY - radius * 0.8 }, // Arriba derecha - Pocas Veces (2)
                            { x: centerX + radius * 1.4, y: centerY + radius * 0.8 }, // Abajo derecha - Casi Siempre (3)
                            { x: centerX - radius * 1.4, y: centerY + radius * 0.8 }  // Abajo izquierda - Siempre (4)
                        ];
                        
                        var angleOffset = -Math.PI / 2; // Empezar desde arriba
                        
                        // Procesar cada segmento en orden del gráfico (1, 2, 3, 4)
                        for (var i = 0; i < data.length; i++) {
                            if (data[i] === 0) continue;
                            
                            var sliceAngle = (data[i] / totalRespuestas) * 2 * Math.PI;
                            var angle = angleOffset + sliceAngle / 2; // Ángulo al centro del segmento
                            var porcentaje = porcentajes[i];
                            var posicionEtiqueta = posicionesEtiquetas[i];
                            
                            // Punto en el borde de la dona (centro del segmento)
                            var pointX = centerX + Math.cos(angle) * (radius * 0.9);
                            var pointY = centerY + Math.sin(angle) * (radius * 0.9);
                            
                            // Crear línea conectadora
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
                            
                            // Crear etiqueta
                            var label = document.createElement('div');
                            label.className = 'chart-label';
                            label.style.left = posicionEtiqueta.x + 'px';
                            label.style.top = posicionEtiqueta.y + 'px';
                            label.style.transform = 'translate(-50%, -50%)';
                            label.style.borderColor = backgroundColors[i];
                            
                            // MEJOR CONTRASTE DE COLORES - Texto blanco para fondos oscuros
                            var esFondoOscuro = (
                                backgroundColors[i] === '#333333' ||  // Nunca - muy oscuro
                                backgroundColors[i] === '#6B6F47'     // Casi Siempre - oscuro
                            );
                            
                            if (esFondoOscuro) {
                                label.style.background = backgroundColors[i];
                                label.style.color = '#ffffff'; // Texto blanco
                                // También cambiar el color del valor/porcentaje a un gris claro
                                label.querySelector = function() { return null; }; // Evitar errores
                            } else {
                                label.style.background = '#ffffff';
                                label.style.color = '#333333'; // Texto oscuro
                            }
                            
                            // Usar innerHTML directamente para evitar problemas con querySelector
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
            
            console.log('✅ Gráfico final con etiquetas mejoradas generado exitosamente');
        },
        
        obtenerColorPorPromedio: function (promedio) {
            if (promedio >= 3.5) return '#A0A57E';
            if (promedio >= 2.5) return '#6B6F47';
            if (promedio >= 1.5) return '#D3D3D3';
            return '#333333';
        },
        
        generarTablaPreguntas: function () {
            console.log('Generando tabla de preguntas');
            
            var tbody = this.$el.find('#preguntas-tbody');
            tbody.empty();
            
            var preguntasConDatos = 0;
            
            this.state.preguntas.sort((a, b) => a.orden - b.orden).forEach(function (pregunta) {
                var respuestasPregunta = this.state.respuestas.filter(r => r.preguntaId === pregunta.id);
                
                if (respuestasPregunta.length === 0) return;
                
                preguntasConDatos++;
                
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
                var promedioBase10 = total > 0 ? (promedio / 4 * 10) : 0; // Convertir a base 10
                
                // Porcentajes normales (base 100)
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
                        <td class="promedio-cell">${promedioBase10.toFixed(2)}/10</td>
                    </tr>
                `;
                
                tbody.append(row);
            }.bind(this));
            
            console.log('✅ Tabla generada con', preguntasConDatos, 'preguntas con datos');
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
            console.log('✅ Mostrando contenido completo con datos cargados');
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').show();
            this.$el.find('#no-data-area').hide();
            this.state.datosCargados = true;
        },
        
        mostrarNoData: function () {
            console.log('⚠️ Mostrando "no data"');
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').show();
        },
        
        mostrarError: function (mensaje) {
            console.error('💥 Error:', mensaje);
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').show();
            this.$el.find('#no-data-area p').text(mensaje || 'Error al cargar los datos');
        }
        
    });
});