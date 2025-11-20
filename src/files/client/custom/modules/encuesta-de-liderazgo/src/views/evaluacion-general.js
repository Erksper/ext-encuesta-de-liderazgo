define('encuesta-de-liderazgo:views/evaluacion-general', ['view'], function (Dep) {
    
    return Dep.extend({
        
        template: 'encuesta-de-liderazgo:evaluacion-general',
        
        // Configuración de colores para los gráficos
        COLORES: {
            '4': '#A0A57E',  // Siempre
            '3': '#6B6F47',  // Casi Siempre
            '2': '#D3D3D3',  // Pocas Veces
            '1': '#333333'   // Nunca
        },
        
        LABELS: {
            '4': 'Siempre',
            '3': 'Casi Siempre',
            '2': 'Pocas Veces',
            '1': 'Nunca'
        },
        
        setup: function () {
            this.esAdmin = this.getUser().isAdmin();
            
            this.state = {
                usuario: null,
                esCasaNacional: false,
                fechaSeleccionada: null,
                claSeleccionado: null,
                oficinaSeleccionada: null,
                usuarioSeleccionado: null,
                charts: {},
                promediosChart: null,
                categorias: [],
                encuestas: [],
                respuestas: [],
                preguntas: [],
                datosCargados: false,
                cargandoDatos: false
            };
            
            this.wait(true);
            this.cargarUsuarioActual();
            
            // Cargar Chart.js desde archivo local si no está cargado
            if (typeof Chart === 'undefined') {
                console.log('Cargando Chart.js desde archivo local...');
                
                var script = document.createElement('script');
                script.src = 'client/custom/modules/encuesta-de-liderazgo/lib/chart.min.js';
                script.onload = function() {
                    console.log('Chart.js cargado exitosamente');
                    this.registrarPluginsChart();
                    this.verificarCargaCompleta();
                }.bind(this);
                script.onerror = function() {
                    console.error('Error al cargar Chart.js');
                    Espo.Ui.error('Error al cargar la librería de gráficos');
                    this.wait(false);
                }.bind(this);
                document.head.appendChild(script);
            } else {
                // Si Chart.js ya está cargado, registrar plugins inmediatamente
                this.registrarPluginsChart();
                this.verificarCargaCompleta();
            }
        },

        // NUEVO MÉTODO: Registrar plugins de Chart.js
        registrarPluginsChart: function() {
            if (typeof Chart === 'undefined') return;
            
            console.log('Registrando plugins personalizados...');
            
            // Plugin para mostrar porcentajes en DONAS (FUERA del borde)
            const doughnutLabelsPlugin = {
                id: 'doughnutLabels',
                afterDraw: function(chart) {
                    if (chart.config.type === 'doughnut') {
                        var ctx = chart.ctx;
                        var total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        
                        chart.data.datasets.forEach(function(dataset, i) {
                            var meta = chart.getDatasetMeta(i);
                            if (!meta.hidden) {
                                meta.data.forEach(function(element, index) {
                                    // Obtener posición del centro del segmento
                                    var model = element;
                                    var startAngle = model.startAngle;
                                    var endAngle = model.endAngle;
                                    var angle = startAngle + (endAngle - startAngle) / 2;
                                    
                                    // Calcular posición FUERA de la dona (1.15 veces el radio exterior)
                                    var radius = model.outerRadius * 1.15;
                                    var x = model.x + Math.cos(angle) * radius;
                                    var y = model.y + Math.sin(angle) * radius;
                                    
                                    // Calcular porcentaje
                                    var value = dataset.data[index];
                                    var percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                    
                                    // Configurar estilo - COLOR OSCURO
                                    ctx.fillStyle = '#333333';
                                    ctx.font = 'bold 11px Arial';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    
                                    // Dibujar porcentaje
                                    ctx.fillText(percentage, x, y);
                                });
                            }
                        });
                    }
                }
            };

            // Plugin para mostrar porcentajes en BARRAS (CORREGIDO)
            const barLabelsPlugin = {
                id: 'barLabels',
                afterDatasetsDraw: function(chart) {
                    if (chart.config.type === 'bar') {
                        var ctx = chart.ctx;
                        
                        chart.data.datasets.forEach(function(dataset, datasetIndex) {
                            var meta = chart.getDatasetMeta(datasetIndex);
                            if (!meta.hidden) {
                                meta.data.forEach(function(element, index) {
                                    // Obtener posición y valor
                                    var value = dataset.data[index];
                                    
                                    // Solo mostrar si el valor es mayor a 0
                                    if (value > 0) {
                                        var x = element.x;
                                        var y = element.y;
                                        var width = element.width;
                                        var height = element.height;
                                        
                                        // Para barras HORIZONTALES (como el de promedios)
                                        if (chart.options.indexAxis === 'y') {
                                            // Posicionar en el centro de la barra horizontal
                                            var textX = x + width / 2;
                                            var textY = y;
                                            
                                            // Configurar estilo para mejor legibilidad
                                            ctx.fillStyle = '#FFFFFF';
                                            ctx.font = 'bold 12px Arial';
                                            ctx.textAlign = 'center';
                                            ctx.textBaseline = 'middle';
                                            
                                            // Dibujar texto del porcentaje
                                            ctx.fillText(value.toFixed(1) + '%', textX, textY);
                                        } 
                                        // Para barras VERTICALES
                                        else {
                                            var textX = x;
                                            var textY = y - 15; // Posicionar arriba de la barra
                                            
                                            ctx.fillStyle = '#333333';
                                            ctx.font = 'bold 12px Arial';
                                            ctx.textAlign = 'center';
                                            ctx.textBaseline = 'bottom';
                                            
                                            ctx.fillText(value.toFixed(1) + '%', textX, textY);
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
            };

            // Registrar los plugins
            Chart.register(doughnutLabelsPlugin, barLabelsPlugin);
            console.log('Plugins registrados correctamente');
        },
        
        data: function () {
            return {
                esAdmin: this.esAdmin
            };
        },
        
        afterRender: function () {
            console.log('afterRender ejecutado');
            
            // Mostrar "No hay datos" inmediatamente
            this.mostrarNoData();
            
            // Dar tiempo para que el DOM se construya
            setTimeout(function() {
                this.inicializarFiltros();
                this.cargarAniosDisponibles();
            }.bind(this), 100);
        },

        cargarAniosDisponibles: function () {
            console.log('Cargando años disponibles...');
            
            this.fetchAniosDisponibles().then(function(anios) {
                var fechaSelect = this.$el.find('#fecha-select');
                fechaSelect.html('<option value="">Todos los años</option>');
                
                anios.sort((a, b) => b - a).forEach(function(anio) {
                    fechaSelect.append(`<option value="${anio}">${anio}</option>`);
                });
                
                console.log('Años cargados:', anios);
                
            }.bind(this)).catch(function(error) {
                console.error('Error cargando años:', error);
                this.$el.find('#fecha-select').html('<option value="">Error al cargar</option>');
            }.bind(this));
        },

        // NUEVA FUNCIÓN: Obtener años disponibles de las encuestas
        fetchAniosDisponibles: function () {
            return new Promise(function (resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgo', function (collection) {
                    collection.maxSize = 1000; // Suficiente para obtener todas las fechas
                    
                    collection.fetch().then(function () {
                        var anios = new Set();
                        var models = collection.models || [];
                        
                        models.forEach(function(model) {
                            var fecha = model.get('fecha');
                            if (fecha) {
                                var anio = new Date(fecha).getFullYear();
                                anios.add(anio);
                            }
                        });
                        
                        // Si no hay fechas, usar el año actual
                        if (anios.size === 0) {
                            anios.add(new Date().getFullYear());
                        }
                        
                        resolve(Array.from(anios));
                    }).catch(reject);
                }.bind(this));
            }.bind(this));
        },
        
        cargarUsuarioActual: function () {
            var user = this.getUser();
            this.state.usuario = user;
            
            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({ relations: { roles: true, teams: true } }).then(function() {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(r => r.toLowerCase());
                    this.state.esCasaNacional = roles.includes('casa nacional');
                    
                    this.state.usuario.teamsIds = userModel.get('teamsIds') || [];
                    this.state.usuario.teamsNames = userModel.get('teamsNames') || {};
                    
                    console.log('Usuario cargado:', {
                        nombre: user.name,
                        esCasaNacional: this.state.esCasaNacional,
                        teams: this.state.usuario.teamsIds
                    });
                    
                    // Esperar a que tanto Chart.js como el usuario estén cargados
                    this.verificarCargaCompleta();
                    
                }.bind(this));
            }.bind(this));
        },
        
        verificarCargaCompleta: function() {
            // Verificar si Chart.js está cargado y el usuario está listo
            var chartCargado = typeof Chart !== 'undefined';
            var usuarioCargado = this.state.usuario && this.state.usuario.teamsIds !== undefined;
            
            if (chartCargado && usuarioCargado) {
                console.log('Todo listo para inicializar');
                this.wait(false);
            } else {
                console.log('Esperando carga completa...', { chartCargado, usuarioCargado });
                // Volver a verificar en 100ms
                setTimeout(function() {
                    this.verificarCargaCompleta();
                }.bind(this), 100);
            }
        },
        
        inicializarFiltros: function () {
            console.log('Inicializando filtros...');
            
            var fechaSelect = this.$el.find('#fecha-select');
            var claSelect = this.$el.find('#cla-select');
            var oficinaSelect = this.$el.find('#oficina-select');
            var usuarioSelect = this.$el.find('#usuario-select');
            
            console.log('Inicializando filtros, elementos encontrados:', {
                fecha: fechaSelect.length,
                cla: claSelect.length,
                oficina: oficinaSelect.length,
                usuario: usuarioSelect.length
            });
            
            // Evento para el filtro de fecha
            fechaSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                console.log('Fecha seleccionada:', valor);
                
                this.state.fechaSeleccionada = valor;
                this.state.claSeleccionado = null;
                this.state.oficinaSeleccionada = null;
                this.state.usuarioSeleccionado = null;
                
                // Resetear los demás filtros
                claSelect.prop('disabled', !this.state.fechaSeleccionada);
                oficinaSelect.prop('disabled', true);
                usuarioSelect.prop('disabled', true);
                
                if (this.state.fechaSeleccionada) {
                    // Cargar CLAs basados en la fecha seleccionada
                    claSelect.html('<option value="">Cargando CLAs...</option>');
                    if (this.state.esCasaNacional) {
                        this.cargarTodosCLAs();
                    } else {
                        this.cargarCLAsUsuario();
                    }
                } else {
                    claSelect.html('<option value="">Seleccione un año primero</option>');
                    oficinaSelect.html('<option value="">Seleccione un CLA primero</option>');
                    usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                    this.mostrarNoData();
                }
            }.bind(this));
            
            // Evento para filtro CLA
            claSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                console.log('CLA seleccionado:', valor);
                
                this.state.claSeleccionado = valor;
                this.state.oficinaSeleccionada = null;
                this.state.usuarioSeleccionado = null;
                
                oficinaSelect.html('<option value="">Cargando...</option>');
                usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                usuarioSelect.prop('disabled', true);
                
                if (this.state.claSeleccionado === 'CLA0') {
                    // Para Territorio Nacional, no hay oficinas
                    oficinaSelect.html('<option value="">No disponible para Territorio Nacional</option>');
                    oficinaSelect.prop('disabled', true);
                    // Cargar datos inmediatamente para Territorio Nacional
                    this.cargarDatos();
                } else if (this.state.claSeleccionado) {
                    this.cargarOficinasPorCLA(this.state.claSeleccionado);
                    // CARGAR DATOS AL SELECCIONAR CLA (NUEVO)
                    this.cargarDatos();
                } else {
                    oficinaSelect.prop('disabled', true);
                    oficinaSelect.html('<option value="">Seleccione un CLA primero</option>');
                    this.mostrarNoData();
                }
            }.bind(this));
            
            // Evento para filtro Oficina
            oficinaSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                console.log('Oficina seleccionada:', valor);
                
                this.state.oficinaSeleccionada = valor;
                this.state.usuarioSeleccionado = null;
                
                if (this.state.oficinaSeleccionada) {
                    this.cargarUsuariosPorOficina(this.state.oficinaSeleccionada);
                    // Cargar datos cuando se selecciona oficina
                    this.cargarDatos();
                } else {
                    usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                    usuarioSelect.prop('disabled', true);
                    // Si no hay oficina seleccionada, cargar datos del CLA
                    this.cargarDatos();
                }
            }.bind(this));
            
            // Evento para filtro Usuario
            usuarioSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                console.log('Usuario seleccionado:', valor);
                
                this.state.usuarioSeleccionado = valor;
                
                // Mostrar/ocultar sección de sugerencias
                if (this.state.usuarioSeleccionado) {
                    this.$el.find('#sugerencias-card').show();
                    this.cargarSugerencias();
                } else {
                    this.$el.find('#sugerencias-card').hide();
                }
                
                // Recargar datos con el filtro de usuario
                this.cargarDatos();
            }.bind(this));
        },
        
        cargarTodosCLAs: function () {
            console.log('Cargando todos los CLAs para Casa Nacional...');
            
            this.fetchAllTeams().then(function (teams) {
                var claPattern = /^CLA\d+$/i;
                var clas = teams.filter(t => claPattern.test(t.id));
                
                var claSelect = this.$el.find('#cla-select');
                claSelect.html('<option value="">Seleccione un CLA</option>');
                
                // Siempre incluir Territorio Nacional para todos
                claSelect.append('<option value="CLA0">Territorio Nacional</option>');
                
                clas.sort((a, b) => {
                    var numA = parseInt(a.id.replace(/\D/g, ''));
                    var numB = parseInt(b.id.replace(/\D/g, ''));
                    return numA - numB;
                }).forEach(cla => {
                    claSelect.append(`<option value="${cla.id}">${cla.name || cla.id}</option>`);
                });
                
                console.log('CLAs cargados:', clas.length);
            }.bind(this)).catch(function(error) {
                console.error('Error cargando CLAs:', error);
                this.$el.find('#cla-select').html('<option value="">Error al cargar</option>');
            }.bind(this));
        },
        
        cargarCLAsUsuario: function () {
            console.log('Cargando CLAs para usuario no Casa Nacional...');
            
            var claSelect = this.$el.find('#cla-select');
            var oficinaSelect = this.$el.find('#oficina-select');
            
            if (!this.state.usuario || !this.state.usuario.teamsIds) {
                claSelect.html('<option value="">Sin equipos asignados</option>');
                return;
            }
            
            var teamsIds = this.state.usuario.teamsIds;
            var claPattern = /^CLA\d+$/i;
            var claId = teamsIds.find(id => claPattern.test(id));
            
            claSelect.html('<option value="">Seleccione un CLA</option>');
            
            // TODOS los usuarios pueden ver Territorio Nacional
            claSelect.append('<option value="CLA0">Territorio Nacional</option>');
            
            // Si el usuario NO es Casa Nacional, solo puede ver su CLA específico
            if (!this.state.esCasaNacional && claId) {
                var teamName = this.state.usuario.teamsNames[claId] || claId;
                claSelect.append(`<option value="${claId}">${teamName}</option>`);
                
                console.log('CLA disponible para usuario:', claId);
            } 
            // Si el usuario ES Casa Nacional, puede ver todos los CLAs
            else if (this.state.esCasaNacional) {
                this.cargarTodosCLAs();
            }
            
            // Resetear filtros dependientes
            oficinaSelect.html('<option value="">Seleccione un CLA primero</option>');
            oficinaSelect.prop('disabled', true);
        },
        
        cargarOficinasPorCLA: function (claId) {
            console.log('Cargando oficinas para CLA:', claId);
            
            var oficinaSelect = this.$el.find('#oficina-select');
            
            Promise.all([
                this.fetchAllTeams(),
                this.fetchUsuariosPorCLA(claId)
            ]).then(function ([teams, usuariosConCLA]) {
                var claPattern = /^CLA\d+$/i;
                var oficinasIds = new Set();
                
                usuariosConCLA.forEach(usuario => {
                    var teamsIds = usuario.teamsIds || [];
                    teamsIds.forEach(teamId => {
                        if (!claPattern.test(teamId) && teamId.toLowerCase() !== 'venezuela') {
                            oficinasIds.add(teamId);
                        }
                    });
                });
                
                var oficinas = teams.filter(t => oficinasIds.has(t.id));
                
                oficinaSelect.html('<option value="">Todas las oficinas</option>');
                oficinas.forEach(oficina => {
                    oficinaSelect.append(`<option value="${oficina.id}">${oficina.name || oficina.id}</option>`);
                });
                
                oficinaSelect.prop('disabled', false);
                console.log('Oficinas cargadas:', oficinas.length);
            }.bind(this)).catch(function (error) {
                console.error('Error cargando oficinas:', error);
                oficinaSelect.html('<option value="">Error al cargar</option>');
            });
        },
        
        cargarUsuariosPorOficina: function (oficinaId) {
            console.log('Cargando usuarios para oficina:', oficinaId);
            
            var usuarioSelect = this.$el.find('#usuario-select');
            
            this.fetchEncuestasPorOficina(oficinaId).then(function (encuestas) {
                var usuariosIds = new Set();
                encuestas.forEach(enc => {
                    if (enc.usuarioEvaluadoId) {
                        usuariosIds.add(enc.usuarioEvaluadoId);
                    }
                });
                
                return this.fetchUsuariosPorIds(Array.from(usuariosIds));
            }.bind(this)).then(function (usuarios) {
                usuarioSelect.html('<option value="">Todos los usuarios</option>');
                usuarios.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(usuario => {
                    usuarioSelect.append(`<option value="${usuario.id}">${usuario.name}</option>`);
                });
                
                usuarioSelect.prop('disabled', false);
                console.log('Usuarios cargados:', usuarios.length);
            }.bind(this)).catch(function (error) {
                console.error('Error cargando usuarios:', error);
                usuarioSelect.html('<option value="">Error al cargar</option>');
            });
        },
        
        cargarDatos: function () {
            // Si ya se están cargando datos, salir
            if (this.state.cargandoDatos) {
                console.log('Ya se están cargando datos, ignorando llamada...');
                return;
            }
            
            console.log('=== INICIANDO CARGA DE DATOS ===');
            console.log('Filtros activos:', {
                fecha: this.state.fechaSeleccionada,
                cla: this.state.claSeleccionado,
                oficina: this.state.oficinaSeleccionada,
                usuario: this.state.usuarioSeleccionado
            });
            
            // Validar que haya al menos un filtro básico
            if (!this.state.fechaSeleccionada) {
                console.log('No hay fecha seleccionada, mostrando "no data"');
                this.mostrarNoData();
                return;
            }
            
            this.state.cargandoDatos = true;
            this.mostrarLoading(true);
            
            // Limpiar datos anteriores
            this.state.encuestas = [];
            this.state.respuestas = [];
            this.state.preguntas = [];
            
            Promise.all([
                this.fetchCategorias(),
                this.fetchEncuestasFiltradas()
            ]).then(function ([categorias, encuestas]) {
                this.state.categorias = categorias.filter(c => c.name.toLowerCase() !== 'general');
                this.state.encuestas = encuestas;
                
                console.log('Categorías cargadas:', this.state.categorias.length);
                console.log('Encuestas FILTRADAS cargadas:', this.state.encuestas.length);
                
                if (this.state.encuestas.length === 0) {
                    console.log('No hay encuestas con los filtros aplicados');
                    this.mostrarNoData();
                    this.state.cargandoDatos = false;
                    return Promise.resolve(null);
                }
                
                return Promise.all([
                    this.fetchTodasLasPreguntas(),
                    this.fetchRespuestasPorEncuestas(this.state.encuestas.map(e => e.id))
                ]);
            }.bind(this)).then(function (resultado) {
                // Si no hay resultado (no hay encuestas), salir
                if (!resultado) {
                    this.state.cargandoDatos = false;
                    return;
                }
                
                var preguntas = resultado[0];
                var respuestas = resultado[1];
                
                if (!preguntas) {
                    this.state.cargandoDatos = false;
                    return;
                }
                
                this.state.preguntas = preguntas.filter(p => {
                    var catNombre = p.categoriaLiderazgoName || '';
                    return catNombre.toLowerCase() !== 'general';
                });
                this.state.respuestas = respuestas;
                
                console.log('Preguntas cargadas:', this.state.preguntas.length);
                console.log('Respuestas FILTRADAS cargadas:', this.state.respuestas.length);
                
                this.generarEstadisticas();
                this.generarGraficoPromedios();
                this.generarGraficos();
                this.mostrarContenido();
                
                this.state.datosCargados = true;
                this.state.cargandoDatos = false;
                
                console.log('=== CARGA DE DATOS COMPLETADA ===');
                
            }.bind(this)).catch(function (error) {
                console.error('Error cargando datos:', error);
                Espo.Ui.error('Error al cargar los datos');
                this.mostrarNoData();
                this.state.cargandoDatos = false;
            }.bind(this));
        },
        
        fetchAllTeams: function () {
            return new Promise(function (resolve, reject) {
                var maxSize = 200;
                var allTeams = [];
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('Team', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            allTeams = allTeams.concat(models.map(m => ({
                                id: m.id,
                                name: m.get('name')
                            })));
                            
                            if (models.length === maxSize && allTeams.length < collection.total) {
                                fetchPage(offset + maxSize);
                            } else {
                                resolve(allTeams);
                            }
                        }).catch(reject);
                    }.bind(this));
                }.bind(this);
                
                fetchPage(0);
            }.bind(this));
        },
        
        fetchUsuariosPorCLA: function (claId) {
            return new Promise(function (resolve, reject) {
                var maxSize = 200;
                var allUsers = [];
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('User', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        collection.data = { select: 'teamsIds,teamsNames' };
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            var filtered = models.filter(u => {
                                var teamsIds = u.get('teamsIds') || [];
                                return teamsIds.includes(claId);
                            }).map(m => ({
                                id: m.id,
                                teamsIds: m.get('teamsIds'),
                                teamsNames: m.get('teamsNames')
                            }));
                            
                            allUsers = allUsers.concat(filtered);
                            
                            if (models.length === maxSize && (offset + maxSize) < collection.total) {
                                fetchPage(offset + maxSize);
                            } else {
                                resolve(allUsers);
                            }
                        }).catch(reject);
                    }.bind(this));
                }.bind(this);
                
                fetchPage(0);
            }.bind(this));
        },
        
        fetchEncuestasPorOficina: function (oficinaId) {
            return new Promise(function (resolve, reject) {
                var maxSize = 200;
                var allEncuestas = [];
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('EncuestaLiderazgo', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        collection.where = [
                            { type: 'equals', attribute: 'oficinaTeamId', value: oficinaId }
                        ];
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            allEncuestas = allEncuestas.concat(models.map(m => ({
                                id: m.id,
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
        
        fetchUsuariosPorIds: function (userIds) {
            return Promise.all(userIds.map(id => {
                return new Promise(function (resolve) {
                    this.getModelFactory().create('User', function (model) {
                        model.id = id;
                        model.fetch().then(function () {
                            resolve({
                                id: model.id,
                                name: model.get('name')
                            });
                        }).catch(function () {
                            resolve(null);
                        });
                    }.bind(this));
                }.bind(this));
            })).then(usuarios => usuarios.filter(u => u !== null));
        },
        
        fetchCategorias: function () {
            return new Promise(function (resolve, reject) {
                var maxSize = 200;
                var allCategorias = [];
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('EncuestaLiderazgoCategoria', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        collection.data = { orderBy: 'orden', order: 'asc' };
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            allCategorias = allCategorias.concat(models.map(m => ({
                                id: m.id,
                                name: m.get('name'),
                                orden: m.get('orden')
                            })));
                            
                            if (models.length === maxSize && allCategorias.length < collection.total) {
                                fetchPage(offset + maxSize);
                            } else {
                                resolve(allCategorias);
                            }
                        }).catch(reject);
                    }.bind(this));
                }.bind(this);
                
                fetchPage(0);
            }.bind(this));
        },
        
        fetchTodasLasPreguntas: function () {
            return new Promise(function (resolve, reject) {
                var maxSize = 200;
                var allPreguntas = [];
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            allPreguntas = allPreguntas.concat(models.map(m => ({
                                id: m.id,
                                pregunta: m.get('pregunta'),
                                tipo: m.get('tipo'),
                                categoriaLiderazgoId: m.get('categoriaLiderazgoId'),
                                categoriaLiderazgoName: m.get('categoriaLiderazgoName')
                            })));
                            
                            if (models.length === maxSize && allPreguntas.length < collection.total) {
                                fetchPage(offset + maxSize);
                            } else {
                                resolve(allPreguntas);
                            }
                        }).catch(reject);
                    }.bind(this));
                }.bind(this);
                
                fetchPage(0);
            }.bind(this));
        },
        
        fetchEncuestasFiltradas: function () {
            return new Promise(function (resolve, reject) {
                console.log('Buscando encuestas con filtros:', {
                    fecha: this.state.fechaSeleccionada,
                    cla: this.state.claSeleccionado,
                    oficina: this.state.oficinaSeleccionada,
                    usuario: this.state.usuarioSeleccionado
                });
                
                var maxSize = 200;
                var allEncuestas = [];
                
                var whereConditions = [];
                
                // Filtro por fecha/año (OBLIGATORIO)
                if (this.state.fechaSeleccionada) {
                    var año = parseInt(this.state.fechaSeleccionada);
                    var fechaInicio = año + '-01-01';
                    var fechaFin = año + '-12-31';
                    
                    whereConditions.push({
                        type: 'between',
                        attribute: 'fecha',
                        value: [fechaInicio, fechaFin]
                    });
                }
                
                // Filtro por CLA (solo si no es Territorio Nacional)
                if (this.state.claSeleccionado && this.state.claSeleccionado !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'claTeamId',
                        value: this.state.claSeleccionado
                    });
                }
                
                // Filtro por oficina (solo si hay CLA seleccionado y no es Territorio Nacional)
                if (this.state.oficinaSeleccionada && this.state.claSeleccionado && this.state.claSeleccionado !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'oficinaTeamId',
                        value: this.state.oficinaSeleccionada
                    });
                }
                
                // Filtro por usuario (si está seleccionado)
                if (this.state.usuarioSeleccionado) {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'usuarioEvaluadoId',
                        value: this.state.usuarioSeleccionado
                    });
                }
                
                console.log('Condiciones WHERE para encuestas:', whereConditions);
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('EncuestaLiderazgo', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        collection.where = whereConditions;
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            var encuestasFiltradas = models.map(m => ({
                                id: m.id,
                                fecha: m.get('fecha'),
                                usuarioEvaluadoId: m.get('usuarioEvaluadoId'),
                                claTeamId: m.get('claTeamId'),
                                oficinaTeamId: m.get('oficinaTeamId')
                            }));
                            
                            allEncuestas = allEncuestas.concat(encuestasFiltradas);
                            
                            if (models.length === maxSize && allEncuestas.length < collection.total) {
                                fetchPage(offset + maxSize);
                            } else {
                                console.log('Encuestas encontradas con filtros:', allEncuestas.length);
                                console.log('Detalle de encuestas:', allEncuestas);
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
                console.log('Buscando respuestas para', encuestaIds.length, 'encuestas');
                
                if (encuestaIds.length === 0) {
                    console.log('No hay encuestas para buscar respuestas');
                    resolve([]);
                    return;
                }
                
                var maxSize = 200;
                var allRespuestas = [];
                
                var processBatch = function (batchIndex) {
                    if (batchIndex >= Math.ceil(encuestaIds.length / 50)) {
                        console.log('Total respuestas encontradas:', allRespuestas.length);
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
        
        generarEstadisticas: function () {
            var statsContainer = this.$el.find('#stats-summary');
            
            var totalEncuestas = this.state.encuestas.length;
            var totalRespuestas = this.state.respuestas.length;
            var usuariosEvaluados = new Set(this.state.encuestas.map(e => e.usuarioEvaluadoId)).size;
            
            var html = `
                <div class="stat-card">
                    <div class="number">${totalEncuestas}</div>
                    <div class="label">Evaluaciones</div>
                </div>
                <div class="stat-card">
                    <div class="number">${usuariosEvaluados}</div>
                    <div class="label">Usuarios Evaluados</div>
                </div>
                <div class="stat-card">
                    <div class="number">${totalRespuestas}</div>
                    <div class="label">Respuestas Totales</div>
                </div>
                <div class="stat-card">
                    <div class="number">${this.state.categorias.length}</div>
                    <div class="label">Categorías</div>
                </div>
            `;
            
            statsContainer.html(html);
        },
        
        generarGraficoPromedios: function () {
            var promediosContainer = this.$el.find('#promedios-chart-container');
            
            if (!promediosContainer.length) {
                console.error('Contenedor de promedios no encontrado');
                return;
            }
            
            // Calcular promedios por categoría
            var promediosPorCategoria = [];
            var labels = [];
            
            this.state.categorias.forEach(function (categoria) {
                var preguntasCategoria = this.state.preguntas.filter(p => p.categoriaLiderazgoId === categoria.id);
                
                if (preguntasCategoria.length === 0) return;
                
                var preguntasIds = preguntasCategoria.map(p => p.id);
                var respuestasCategoria = this.state.respuestas.filter(r => 
                    preguntasIds.includes(r.preguntaId) && r.seleccion
                );
                
                if (respuestasCategoria.length === 0) return;
                
                var conteo = { '4': 0, '3': 0, '2': 0, '1': 0 };
                respuestasCategoria.forEach(r => {
                    if (conteo.hasOwnProperty(r.seleccion)) {
                        conteo[r.seleccion]++;
                    }
                });
                
                var total = Object.values(conteo).reduce((a, b) => a + b, 0);
                if (total === 0) return;
                
                // Calcular promedio como porcentaje (escala 1-4 convertida a 0-100%)
                var suma = parseInt(conteo['4']) * 4 + parseInt(conteo['3']) * 3 + 
                        parseInt(conteo['2']) * 2 + parseInt(conteo['1']) * 1;
                var promedio = (suma / total) / 4 * 100; // Convertir a porcentaje
                
                labels.push(categoria.name);
                promediosPorCategoria.push(promedio);
                
            }.bind(this));
            
            if (labels.length === 0) return;
            
            var ctx = document.getElementById('promedios-chart');
            if (!ctx) return;
            
            // Destruir gráfico anterior si existe
            if (this.state.promediosChart) {
                this.state.promediosChart.destroy();
            }
            
            this.state.promediosChart = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Promedio por Categoría (%)',
                        data: promediosPorCategoria,
                        backgroundColor: promediosPorCategoria.map(p => {
                            if (p >= 75) return '#A0A57E';
                            if (p >= 50) return '#6B6F47';
                            if (p >= 25) return '#D3D3D3';
                            return '#333333';
                        }),
                        borderColor: '#fff',
                        borderWidth: 2,
                        barThickness: 25
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            left: 10,
                            right: 50,
                            top: 10,
                            bottom: 10
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: {
                                display: true
                            }
                        },
                        y: {
                            ticks: {
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    size: 12
                                }
                            },
                            grid: {
                                display: false
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return 'Promedio: ' + context.parsed.x.toFixed(1) + '%';
                                }
                            }
                        }
                    },
                    onClick: function(event, elements) {
                        if (elements && elements.length > 0) {
                            var index = elements[0].index;
                            var categoriaNombre = labels[index];
                            this.navegarACategoria(categoriaNombre);
                        }
                    }.bind(this)
                }
            });
            
            console.log('Gráfico de promedios generado con datos:', promediosPorCategoria);
        },
        
        obtenerTextoCategoria: function(nombreCategoria) {
            var textosCategorias = {
                'Comunicación': 'La comunicación efectiva es fundamental para el liderazgo. Este análisis muestra cómo se percibe la comunicación en el equipo.',
                'Toma de Decisiones': 'La capacidad de tomar decisiones acertadas es clave para el éxito del liderazgo. Revise los resultados obtenidos.',
                'Trabajo en Equipo': 'El trabajo colaborativo fortalece los resultados del equipo. Analice los indicadores de colaboración.',
                'Planificación': 'Una buena planificación es esencial para alcanzar los objetivos. Evalúe los resultados de esta categoría.'
            };
            
            return textosCategorias[nombreCategoria] || '';
        },
        
        generarGraficos: function () {
            var chartsContainer = this.$el.find('#charts-grid');
            chartsContainer.empty();
            
            // Destruir gráficos anteriores
            Object.values(this.state.charts).forEach(chart => {
                if (chart && chart.destroy) chart.destroy();
            });
            this.state.charts = {};
            
            this.state.categorias.forEach(function (categoria) {
                var preguntasCategoria = this.state.preguntas.filter(p => p.categoriaLiderazgoId === categoria.id);
                
                if (preguntasCategoria.length === 0) return;
                
                var preguntasIds = preguntasCategoria.map(p => p.id);
                var respuestasCategoria = this.state.respuestas.filter(r => 
                    preguntasIds.includes(r.preguntaId) && r.seleccion
                );
                
                if (respuestasCategoria.length === 0) return;
                
                var conteo = { '4': 0, '3': 0, '2': 0, '1': 0 };
                respuestasCategoria.forEach(r => {
                    if (conteo.hasOwnProperty(r.seleccion)) {
                        conteo[r.seleccion]++;
                    }
                });
                
                var total = Object.values(conteo).reduce((a, b) => a + b, 0);
                if (total === 0) return;
                
                var canvasId = 'chart-' + categoria.id;
                var categoriaNombre = categoria.name;
                var textoCategoria = this.obtenerTextoCategoria(categoriaNombre);
                var tieneTooltip = textoCategoria !== '';
                
                var cardHtml = `
                    <div class="chart-card" data-categoria-nombre="${this.escapeHtml(categoriaNombre)}" style="cursor: pointer;">
                        <div class="chart-header">
                            <h3>${categoriaNombre}</h3>
                            ${tieneTooltip ? `
                            <div class="info-icon-container">
                                <i class="fas fa-info-circle info-icon" 
                                   data-toggle="tooltip" 
                                   title="${this.escapeHtml(textoCategoria)}"></i>
                            </div>
                            ` : ''}
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="${canvasId}"></canvas>
                        </div>
                    </div>
                `;
                
                chartsContainer.append(cardHtml);
                
                setTimeout(function () {
                    var ctx = document.getElementById(canvasId);
                    if (!ctx) return;
                    
                    this.state.charts[canvasId] = new Chart(ctx.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(conteo).map(k => this.LABELS[k]),
                            datasets: [{
                                data: Object.values(conteo),
                                backgroundColor: Object.keys(conteo).map(k => this.COLORES[k]),
                                borderWidth: 2,
                                borderColor: '#fff'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        padding: 15,
                                        font: { size: 12 }
                                    }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            var label = context.label || '';
                                            var value = context.parsed || 0;
                                            var percentage = ((value / total) * 100).toFixed(1);
                                            return label + ': ' + value + ' (' + percentage + '%)';
                                        }
                                    }
                                }
                            }
                        }
                    });
                }.bind(this), 100);
                
            }.bind(this));

            // AGREGAR EVENT DELEGATION PARA LOS CLICKS
            this.$el.off('click', '.chart-card').on('click', '.chart-card', function(e) {
                var $card = $(e.currentTarget);
                var categoriaNombre = $card.data('categoria-nombre');
                
                if (categoriaNombre) {
                    this.navegarACategoria(categoriaNombre);
                }
            }.bind(this));

            // Inicializar tooltips después de renderizar
            setTimeout(function() {
                this.$el.find('[data-toggle="tooltip"]').tooltip({
                    placement: 'top',
                    trigger: 'hover'
                });
            }.bind(this), 200);
        },
        
        navegarACategoria: function(categoriaNombre) {
            console.log('🎯 === INICIANDO NAVEGACIÓN A CATEGORÍA ===');
            console.log('Categoría seleccionada:', categoriaNombre);
            
            // Hacer encoding de la categoría para la URL
            var categoriaEncoded = encodeURIComponent(categoriaNombre);
            console.log('Categoría encoded:', categoriaEncoded);
            
            // Crear parámetros compuestos INCLUYENDO la categoría (encoded)
            var filtrosParam = [
                categoriaEncoded,
                this.state.fechaSeleccionada || 'null',
                this.state.claSeleccionado || 'null',
                this.state.oficinaSeleccionada || 'null', 
                this.state.usuarioSeleccionado || 'null'
            ].join('-');
            
            console.log('Parámetros compuestos:', filtrosParam);
            
            var rutaCompleta = '#Liderazgo/categoria/' + filtrosParam;
            console.log('Ruta completa:', rutaCompleta);
            
            // Verificar que el router esté disponible
            var router = this.getRouter();
            console.log('Router disponible:', !!router);
            
            if (router) {
                console.log('🔵 Disparando navegación...');
                router.navigate(rutaCompleta, {trigger: true});
                console.log('✅ Navegación disparada');
            } else {
                console.error('❌ Router no disponible');
            }
        },
        
        mostrarLoading: function (show) {
            if (show) {
                this.$el.find('#loading-area').show();
                this.$el.find('#content-area').hide();
                this.$el.find('#no-data-area').hide();
            }
        },
        
        mostrarContenido: function () {
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').show();
            this.$el.find('#no-data-area').hide();
        },
        
        mostrarNoData: function () {
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').show();
        },
        
        cargarSugerencias: function () {
            var sugerenciasContent = this.$el.find('#sugerencias-content');
            sugerenciasContent.html('<p class="loading-sugerencias"><i class="fas fa-spinner fa-spin"></i> Cargando sugerencias...</p>');
            
            // Buscar preguntas de categoría "General"
            this.fetchPreguntasGenerales().then(function(preguntasGenerales) {
                if (preguntasGenerales.length === 0) {
                    sugerenciasContent.html('<p style="text-align: center; color: #999;">No hay preguntas de categoría General configuradas</p>');
                    return;
                }
                
                // Buscar respuestas del usuario seleccionado para preguntas generales
                this.fetchRespuestasGeneralesUsuario(preguntasGenerales).then(function(respuestas) {
                    this.mostrarSugerencias(preguntasGenerales, respuestas);
                }.bind(this));
                
            }.bind(this));
        },
        
        fetchPreguntasGenerales: function() {
            return new Promise(function(resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function(collection) {
                    collection.fetch({
                        data: {
                            where: [
                                { type: 'equals', attribute: 'tipo', value: 'texto' }
                            ],
                            maxSize: 200
                        }
                    }).then(function() {
                        var preguntas = collection.models
                            .filter(m => {
                                var catNombre = (m.get('categoriaLiderazgoName') || '').toLowerCase();
                                return catNombre === 'general';
                            })
                            .map(m => ({
                                id: m.id,
                                pregunta: m.get('pregunta'),
                                categoriaId: m.get('categoriaLiderazgoId')
                            }));
                        resolve(preguntas);
                    }).catch(reject);
                }.bind(this));
            }.bind(this));
        },
        
        fetchRespuestasGeneralesUsuario: function(preguntasGenerales) {
            return new Promise(function(resolve, reject) {
                if (!this.state.usuarioSeleccionado || preguntasGenerales.length === 0) {
                    resolve([]);
                    return;
                }
                
                // Buscar encuestas del usuario seleccionado
                var whereConditions = [
                    { type: 'equals', attribute: 'usuarioEvaluadoId', value: this.state.usuarioSeleccionado }
                ];
                
                if (this.state.claSeleccionado && this.state.claSeleccionado !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'claTeamId',
                        value: this.state.claSeleccionado
                    });
                }
                
                if (this.state.oficinaSeleccionada) {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'oficinaTeamId',
                        value: this.state.oficinaSeleccionada
                    });
                }
                
                this.getCollectionFactory().create('EncuestaLiderazgo', function(collection) {
                    collection.where = whereConditions;
                    collection.fetch().then(function() {
                        if (collection.length === 0) {
                            resolve([]);
                            return;
                        }
                        
                        var encuestaIds = collection.models.map(m => m.id);
                        var preguntasIds = preguntasGenerales.map(p => p.id);
                        
                        // Buscar respuestas de tipo texto
                        this.getCollectionFactory().create('EncuestaLiderazgoRespuesta', function(respCollection) {
                            respCollection.where = [
                                { type: 'in', attribute: 'encuestaLiderazgoId', value: encuestaIds },
                                { type: 'in', attribute: 'preguntaId', value: preguntasIds },
                                { type: 'isNotNull', attribute: 'texto' }
                            ];
                            respCollection.fetch().then(function() {
                                var respuestas = respCollection.models.map(m => ({
                                    preguntaId: m.get('preguntaId'),
                                    texto: m.get('texto')
                                }));
                                resolve(respuestas);
                            }).catch(function() {
                                resolve([]);
                            });
                        }.bind(this));
                        
                    }.bind(this)).catch(function() {
                        resolve([]);
                    });
                }.bind(this));
            }.bind(this));
        },
        
        mostrarSugerencias: function(preguntas, respuestas) {
            var sugerenciasContent = this.$el.find('#sugerencias-content');
            
            if (respuestas.length === 0) {
                sugerenciasContent.html('<p style="text-align: center; color: #999; padding: 40px;">No hay sugerencias registradas para este usuario</p>');
                return;
            }
            
            var html = '';
            preguntas.forEach(function(pregunta) {
                var respuestasPreg = respuestas.filter(r => r.preguntaId === pregunta.id);
                
                if (respuestasPreg.length > 0) {
                    html += '<div class="sugerencia-item">';
                    html += '<h4>' + this.escapeHtml(pregunta.pregunta) + '</h4>';
                    respuestasPreg.forEach(function(resp) {
                        html += '<p>' + this.escapeHtml(resp.texto || 'Sin respuesta') + '</p>';
                    }.bind(this));
                    html += '</div>';
                }
            }.bind(this));
            
            if (html === '') {
                html = '<p style="text-align: center; color: #999; padding: 40px;">No hay sugerencias registradas para este usuario</p>';
            }
            
            sugerenciasContent.html(html);
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
        }
        
    });
});