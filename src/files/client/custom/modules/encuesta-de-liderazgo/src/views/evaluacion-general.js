define('encuesta-de-liderazgo:views/evaluacion-general', [
    'view',
    'encuesta-de-liderazgo:views/modules/planesAccionManager'
], function (Dep, PlanesAccionManager) {
    
    return Dep.extend({
        
        template: 'encuesta-de-liderazgo:evaluacion-general',
        
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
            this.esAdmin = this.getUser().isAdmin();
            
            this.filtrosDesdeUrl = this.parseQueryParams();

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

            // ── Planes de Acción ──────────────────────────────────────────
            this.planesManager = new PlanesAccionManager(this, {
                modulo:           'Liderazgo',
                usuarios:         [],
                items:            {},
                etiquetaEjecutor: 'Lider'
            });
            // ─────────────────────────────────────────────────────────────
            
            this.wait(true);
            this.cargarUsuarioActual();
            
            if (typeof Chart === 'undefined') {
                var script = document.createElement('script');
                script.src = 'client/custom/modules/encuesta-de-liderazgo/lib/chart.min.js';
                script.onload = function() {
                    this.registrarPluginsChart();
                    this.verificarCargaCompleta();
                }.bind(this);
                script.onerror = function() {
                    Espo.Ui.error('Error al cargar la librería de gráficos');
                    this.wait(false);
                }.bind(this);
                document.head.appendChild(script);
            } else {
                this.registrarPluginsChart();
                this.verificarCargaCompleta();
            }
        },

        parseQueryParams: function() {
            var hash = window.location.hash;
            var filtros = {
                anio: null,
                cla: null,
                oficina: null,
                usuario: null
            };
            
            if (hash && hash.includes('?')) {
                var queryString = hash.split('?')[1];
                var params = new URLSearchParams(queryString);
                
                filtros.anio = params.get('anio');
                filtros.cla = params.get('cla');
                filtros.oficina = params.get('oficina');
                filtros.usuario = params.get('usuario');
            }
            
            return filtros;
        },

        registrarPluginsChart: function() {
            if (typeof Chart === 'undefined') return;

            const barLabelsPlugin = {
                id: 'barLabels',
                afterDatasetsDraw: function(chart) {
                    if (chart.config.type === 'bar') {
                        var ctx = chart.ctx;
                        
                        chart.data.datasets.forEach(function(dataset, datasetIndex) {
                            var meta = chart.getDatasetMeta(datasetIndex);
                            if (!meta.hidden) {
                                meta.data.forEach(function(element, index) {
                                    var value = dataset.data[index];
                                    
                                    if (value > 0) {
                                        if (chart.options.indexAxis === 'y') {
                                            var textX = element.x + element.width + 8;
                                            var textY = element.y;
                                            
                                            ctx.fillStyle = '#333333';
                                            ctx.font = 'bold 13px Arial';
                                            ctx.textAlign = 'left';
                                            ctx.textBaseline = 'middle';
                                            ctx.fillText(value.toFixed(1) + '%', textX, textY);
                                        } else {
                                            var textX = element.x;
                                            var textY = element.y - 5;
                                            
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
            Chart.register(barLabelsPlugin);
        },

        data: function () {
            return {
                esAdmin: this.esAdmin
            };
        },
        
        afterRender: function () {
            this.mostrarNoData();
            
            setTimeout(function() {
                this.inicializarFiltros();
                this.cargarAniosDisponibles();
            }.bind(this), 100);
        },

        inicializarFiltros: function () {
            if (this.filtrosDesdeUrl.anio) {
                this.cargaInteligenteConFiltros();
            } else {
                setTimeout(function() {
                    this.habilitarEventosFiltros();
                }.bind(this), 500);
            }
        },

        cargaInteligenteConFiltros: function() {
            this.state.fechaSeleccionada = this.filtrosDesdeUrl.anio;
            this.state.claSeleccionado = this.filtrosDesdeUrl.cla;
            this.state.oficinaSeleccionada = this.filtrosDesdeUrl.oficina;
            this.state.usuarioSeleccionado = this.filtrosDesdeUrl.usuario;
            
            this.fetchAniosDisponibles().then(function(anios) {
                var fechaSelect = this.$el.find('#fecha-select');
                fechaSelect.html('<option value="">Seleccione un año</option>');
                anios.sort((a, b) => b - a).forEach(function(anio) {
                    fechaSelect.append(`<option value="${anio}">${anio}</option>`);
                });
                fechaSelect.val(this.state.fechaSeleccionada);
                this.$el.find('#cla-select').prop('disabled', false);
                if (this.state.esCasaNacional) {
                    return this.cargarTodosCLAs();
                } else {
                    return this.cargarCLAsUsuario();
                }
            }.bind(this)).then(function() {
                var claSelect = this.$el.find('#cla-select');
                claSelect.val(this.state.claSeleccionado);
                if (this.state.claSeleccionado && this.state.claSeleccionado !== 'CLA0') {
                    return this.cargarOficinasPorCLA(this.state.claSeleccionado);
                }
            }.bind(this)).then(function() {
                if (this.state.oficinaSeleccionada) {
                    var oficinaSelect = this.$el.find('#oficina-select');
                    oficinaSelect.val(this.state.oficinaSeleccionada);
                    return this.cargarUsuariosPorOficina(this.state.oficinaSeleccionada);
                }
            }.bind(this)).then(function() {
                if (this.state.usuarioSeleccionado) {
                    var usuarioSelect = this.$el.find('#usuario-select');
                    usuarioSelect.val(this.state.usuarioSeleccionado);
                    this.$el.find('#sugerencias-card').show();
                    this.cargarSugerencias();
                }
                this.cargarDatos();
                this.habilitarEventosFiltros();
                
            }.bind(this)).catch(function(error) {
                this.mostrarNoData();
            }.bind(this));
        },

        habilitarEventosFiltros: function() {
            var fechaSelect = this.$el.find('#fecha-select');
            var claSelect = this.$el.find('#cla-select');
            var oficinaSelect = this.$el.find('#oficina-select');
            var usuarioSelect = this.$el.find('#usuario-select');
            
            fechaSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                
                this.state.fechaSeleccionada = valor;
                this.state.claSeleccionado = null;
                this.state.oficinaSeleccionada = null;
                this.state.usuarioSeleccionado = null;
                
                claSelect.prop('disabled', !this.state.fechaSeleccionada);
                oficinaSelect.prop('disabled', true);
                usuarioSelect.prop('disabled', true);
                
                if (this.state.fechaSeleccionada) {
                    claSelect.html('<option value="">Cargando CLAs...</option>');
                    if (this.state.esCasaNacional) {
                        this.cargarTodosCLAs();
                    } else {
                        this.cargarCLAsUsuario();
                    }
                } else {
                    claSelect.html('<option value="">Seleccione un año</option>');
                    oficinaSelect.html('<option value="">Seleccione un CLA primero</option>');
                    usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                    this.mostrarNoData();
                }

                this._ocultarPlanesAccion();
            }.bind(this));
            
            claSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                
                this.state.claSeleccionado = valor;
                this.state.oficinaSeleccionada = null;
                this.state.usuarioSeleccionado = null;

                this.$el.find('#sugerencias-card').hide();
                this._ocultarPlanesAccion();
                
                oficinaSelect.html('<option value="">Cargando...</option>');
                usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                usuarioSelect.prop('disabled', true);
                
                if (this.state.claSeleccionado === 'CLA0') {
                    oficinaSelect.html('<option value="">No disponible para Territorio Nacional</option>');
                    oficinaSelect.prop('disabled', true);
                    this.cargarDatos();
                } else if (this.state.claSeleccionado) {
                    this.cargarOficinasPorCLA(this.state.claSeleccionado).then(function() {
                        this.cargarDatos();
                    }.bind(this));
                } else {
                    oficinaSelect.prop('disabled', true);
                    oficinaSelect.html('<option value="">Seleccione un CLA</option>');
                    this.mostrarNoData();
                }
            }.bind(this));
            
            oficinaSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                
                this.state.oficinaSeleccionada = valor;
                this.state.usuarioSeleccionado = null;

                this.$el.find('#sugerencias-card').hide();
                
                if (this.state.oficinaSeleccionada) {
                    this.cargarUsuariosPorOficina(this.state.oficinaSeleccionada).then(function() {
                        this.cargarDatos();
                    }.bind(this));
                } else {
                    usuarioSelect.html('<option value="">Seleccione una Oficina</option>');
                    usuarioSelect.prop('disabled', true);
                    this._ocultarPlanesAccion();
                    this.cargarDatos();
                }
            }.bind(this));
            
            usuarioSelect.on('change', function (e) {
                var valor = $(e.currentTarget).val();
                
                this.state.usuarioSeleccionado = valor;
                
                if (this.state.usuarioSeleccionado) {
                    this.$el.find('#sugerencias-card').show();
                    this.cargarSugerencias();
                } else {
                    this.$el.find('#sugerencias-card').hide();
                }
                
                this.cargarDatos();
            }.bind(this));
        },

        cargarAniosDisponibles: function () {
            this.fetchAniosDisponibles().then(function(anios) {
                var fechaSelect = this.$el.find('#fecha-select');
                
                if (!this.filtrosDesdeUrl.anio) {
                    fechaSelect.html('<option value="">Seleccione un año</option>');
                    
                    anios.sort((a, b) => b - a).forEach(function(anio) {
                        fechaSelect.append(`<option value="${anio}">${anio}</option>`);
                    });
                } else {
                    var valorActual = fechaSelect.val();
                    fechaSelect.html('<option value="">Seleccione un año</option>');
                    
                    anios.sort((a, b) => b - a).forEach(function(anio) {
                        fechaSelect.append(`<option value="${anio}">${anio}</option>`);
                    });
                    
                    if (valorActual) {
                        fechaSelect.val(valorActual);
                    }
                }
                
            }.bind(this)).catch(function(error) {
                this.$el.find('#fecha-select').html('<option value="">Error al cargar</option>');
            }.bind(this));
        },

        fetchAniosDisponibles: function () {
            return new Promise(function (resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgo', function (collection) {
                    collection.maxSize = 1000;
                    
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

                    // ── exponer para PlanesAccionManager ──────────────────
                    this.esCasaNacional     = this.state.esCasaNacional;
                    // CN tiene prioridad: si es CN nunca lo tratamos como GDC
                    this.esGerenteODirector = !this.state.esCasaNacional && (roles.includes('gerente') || roles.includes('director') || roles.includes('coordinador'));
                    this.usuarioActualId    = user.id;
                    this.usuarioActualNombre = user.get('name');

                    if      (roles.includes('casa nacional'))  this.rolUsuario = 'Casa Nacional';
                    else if (roles.includes('director'))       this.rolUsuario = 'Director';
                    else if (roles.includes('gerente'))        this.rolUsuario = 'Gerente';
                    else if (roles.includes('coordinador'))    this.rolUsuario = 'Coordinador';
                    else                                       this.rolUsuario = 'Usuario';
                    // ──────────────────────────────────────────────────────
                    
                    this.state.usuario.teamsIds = userModel.get('teamsIds') || [];
                    this.state.usuario.teamsNames = userModel.get('teamsNames') || {};
                    
                    this.verificarCargaCompleta();
                    
                }.bind(this));
            }.bind(this));
        },
        
        verificarCargaCompleta: function() {
            var chartCargado = typeof Chart !== 'undefined';
            var usuarioCargado = this.state.usuario && this.state.usuario.teamsIds !== undefined;
            
            if (chartCargado && usuarioCargado) {
                this.wait(false);
            } else {
                setTimeout(function() {
                    this.verificarCargaCompleta();
                }.bind(this), 100);
            }
        },
        
        cargarTodosCLAs: function () {
            return new Promise(function (resolve, reject) {
                this.fetchAllTeams().then(function (teams) {
                    var claPattern = /^CLA\d+$/i;
                    var clas = teams.filter(t => claPattern.test(t.id));
                    
                    var claSelect = this.$el.find('#cla-select');
                    claSelect.html('<option value="">Seleccione un CLA</option>');
                    
                    var clasFiltrados = clas.filter(cla => cla.id !== 'CLA0');
                    
                    claSelect.append('<option value="CLA0">Territorio Nacional</option>');
                    
                    clasFiltrados.sort((a, b) => {
                        var numA = parseInt(a.id.replace(/\D/g, ''));
                        var numB = parseInt(b.id.replace(/\D/g, ''));
                        return numA - numB;
                    }).forEach(cla => {
                        claSelect.append(`<option value="${cla.id}">${cla.name || cla.id}</option>`);
                    });
                    
                    resolve();
                    
                }.bind(this)).catch(function(error) {
                    this.$el.find('#cla-select').html('<option value="">Error al cargar</option>');
                    resolve();
                }.bind(this));
            }.bind(this));
        },
        
        cargarCLAsUsuario: function () {
            return new Promise(function (resolve, reject) {
                var claSelect = this.$el.find('#cla-select');
                
                if (!this.state.usuario || !this.state.usuario.teamsIds) {
                    claSelect.html('<option value="">Sin equipos asignados</option>');
                    resolve();
                    return;
                }
                
                var teamsIds = this.state.usuario.teamsIds;
                var claPattern = /^CLA\d+$/i;
                var claId = teamsIds.find(id => claPattern.test(id));
                
                claSelect.html('<option value="">Seleccione un CLA</option>');
                
                claSelect.append('<option value="CLA0">Territorio Nacional</option>');
                
                if (!this.state.esCasaNacional && claId) {
                    var teamName = this.state.usuario.teamsNames[claId] || claId;
                    claSelect.append(`<option value="${claId}">${teamName}</option>`);
                } else if (this.state.esCasaNacional) {
                    this.cargarTodosCLAs().then(resolve);
                    return;
                }
                
                resolve();
            }.bind(this));
        },
        
        cargarOficinasPorCLA: function (claId) {
            var oficinaSelect = this.$el.find('#oficina-select');
            var self = this;

            // Gerente/Director/Coordinador/Asesor: solo ve su propia oficina
            if (!this.state.esCasaNacional && (this.esGerenteODirector || this.rolUsuario === 'Usuario')) {
                var claPattern2 = /^CLA\d+$/i;
                var teamsIds2   = (this.state.usuario && this.state.usuario.teamsIds) || [];
                var teamsNames2 = (this.state.usuario && this.state.usuario.teamsNames) || {};
                var miOficinaId = teamsIds2.find(function (id) {
                    return !claPattern2.test(id) && id.toLowerCase() !== 'venezuela';
                });

                oficinaSelect.html('<option value="">Todas las oficinas</option>');
                if (miOficinaId) {
                    var miOficinaNombre = teamsNames2[miOficinaId] || miOficinaId;
                    if (miOficinaNombre.toLowerCase().indexOf('venezuela') === -1) {
                        oficinaSelect.append('<option value="' + miOficinaId + '">' + miOficinaNombre + '</option>');
                    }
                }
                oficinaSelect.prop('disabled', false);
                return Promise.resolve();
            }

            // Casa Nacional: ve todas las oficinas del CLA
            return Promise.all([
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
                
                // Excluir oficinas cuyo nombre contenga "venezuela"
                var oficinas = teams.filter(function (t) {
                    return oficinasIds.has(t.id) &&
                           (t.name || '').toLowerCase().indexOf('venezuela') === -1;
                });
                
                oficinaSelect.html('<option value="">Todas las oficinas</option>');
                oficinas.forEach(oficina => {
                    oficinaSelect.append(`<option value="${oficina.id}">${oficina.name || oficina.id}</option>`);
                });
                
                oficinaSelect.prop('disabled', false);
            }.bind(this)).catch(function (error) {
                oficinaSelect.html('<option value="">Error al cargar</option>');
            });
        },
        
        cargarUsuariosPorOficina: function (oficinaId) {
            var usuarioSelect = this.$el.find('#usuario-select');
            var self = this;
            
            return this.fetchEncuestasPorOficina(oficinaId).then(function (encuestas) {
                var usuariosIds = new Set();
                encuestas.forEach(enc => {
                    if (enc.usuarioEvaluadoId) {
                        usuariosIds.add(enc.usuarioEvaluadoId);
                    }
                });
                
                return this.fetchUsuariosPorIds(Array.from(usuariosIds));
            }.bind(this)).then(function (usuarios) {
                // Filtrar usuarios cuyo nombre contenga "por la casa" (case-insensitive)
                var usuariosFiltrados = usuarios.filter(function (u) {
                    return (u.name || '').toLowerCase().indexOf('por la casa') === -1;
                });

                // Si es asesor (no CN, no GDC): solo se ve a sí mismo
                if (!self.state.esCasaNacional && !self.esGerenteODirector) {
                    usuariosFiltrados = usuariosFiltrados.filter(function (u) {
                        return u.id === self.usuarioActualId;
                    });
                }

                usuarioSelect.html('<option value="">Todos los usuarios</option>');
                usuariosFiltrados.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(usuario => {
                    usuarioSelect.append(`<option value="${usuario.id}">${usuario.name}</option>`);
                });
                
                usuarioSelect.prop('disabled', false);
            }.bind(this)).catch(function (error) {
                usuarioSelect.html('<option value="">Error al cargar</option>');
            });
        },
        
        cargarDatos: function () {
            if (this.state.cargandoDatos) {
                return;
            }
            
            if (!this.state.fechaSeleccionada) {
                this.mostrarNoData();
                return;
            }
            
            this.state.cargandoDatos = true;
            this.mostrarLoading(true);
            
            this.state.encuestas = [];
            this.state.respuestas = [];
            this.state.preguntas = [];
            
            Promise.all([
                this.fetchCategorias(),
                this.fetchEncuestasFiltradas()
            ]).then(function ([categorias, encuestas]) {
                
                this.state.categorias = categorias.filter(c => c.name.toLowerCase() !== 'general');
                this.state.encuestas = encuestas;
                
                if (this.state.encuestas.length === 0) {
                    this.mostrarNoData();
                    this.state.cargandoDatos = false;
                    return Promise.resolve(null);
                }
                
                return Promise.all([
                    this.fetchTodasLasPreguntas(),
                    this.fetchRespuestasPorEncuestas(this.state.encuestas.map(e => e.id))
                ]);
            }.bind(this)).then(function (resultado) {
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
                
                this.generarEstadisticas();
                this.generarGraficoPromedios();
                this.generarGraficos();
                
                this.mostrarContenido();

                // ── Planes de Acción ──────────────────────────────────────
                this._actualizarPlanesAccion();
                // ─────────────────────────────────────────────────────────
                
                this.state.datosCargados = true;
                this.state.cargandoDatos = false;
                
            }.bind(this)).catch(function (error) {
                Espo.Ui.error('Error al cargar los datos');
                this.mostrarNoData();
                this.state.cargandoDatos = false;
            }.bind(this));
        },

        // ── Planes de Acción: métodos de integración ──────────────────────

        /**
         * Actualiza la configuración del PlanesAccionManager y carga los planes
         * cuando hay oficina o usuario seleccionado.
         */
        _actualizarPlanesAccion: function () {
            var oficina  = this.state.oficinaSeleccionada;
            var usuario  = this.state.usuarioSeleccionado;

            // Solo mostramos planes si hay al menos oficina seleccionada
            // (y no estamos en "Territorio Nacional" CLA0 sin oficina)
            if (!oficina && !usuario) {
                this._ocultarPlanesAccion();
                return;
            }

            // Construir lista de usuarios para el selector "nuevo plan"
            var usuarios = [];
            if (usuario) {
                // Si hay un usuario específico, solo ese
                var $sel = this.$el.find('#usuario-select');
                var nombre = $sel.find('option:selected').text();
                usuarios = [{ id: usuario, name: nombre }];
            } else {
                // Todos los usuarios de la oficina actual
                var $usuarioSelect = this.$el.find('#usuario-select');
                $usuarioSelect.find('option').each(function () {
                    var val = $(this).val();
                    var txt = $(this).text();
                    if (val) usuarios.push({ id: val, name: txt });
                });
            }

            // Construir items (categorías sin subcategorías)
            var items = {};
            (this.state.categorias || []).forEach(function (cat) {
                // key = nombre categoría, value = array vacío (sin subcategorías)
                items[cat.name] = [];
            });

            this.planesManager.actualizarConfig({
                modulo:           'Liderazgo',
                usuarios:         usuarios,
                items:            items,
                oficina:          oficina || null,
                etiquetaEjecutor: 'Lider'
            });

            this.planesManager.cargar();
        },

        /** Oculta / vacía la sección de planes */
        _ocultarPlanesAccion: function () {
            var $sec = this.$el.find('#seccion-planes-accion');
            if ($sec.length) $sec.empty();
        },

        // ─────────────────────────────────────────────────────────────────
        
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
                var maxSize = 200;
                var allEncuestas = [];
                
                var whereConditions = [];
                
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
                
                if (this.state.claSeleccionado && this.state.claSeleccionado !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'claTeamId',
                        value: this.state.claSeleccionado
                    });
                }
                
                if (this.state.oficinaSeleccionada && this.state.claSeleccionado && this.state.claSeleccionado !== 'CLA0') {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'oficinaTeamId',
                        value: this.state.oficinaSeleccionada
                    });
                }
                
                if (this.state.usuarioSeleccionado) {
                    whereConditions.push({
                        type: 'equals',
                        attribute: 'usuarioEvaluadoId',
                        value: this.state.usuarioSeleccionado
                    });
                }
                
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
                
                var batchSize = encuestaIds.length > 200 ? 100 : 50;
                var totalBatches = Math.ceil(encuestaIds.length / batchSize);
                var batchesCompleted = 0;
                
                var maxParallelBatches = 3;
                var currentBatchIndex = 0;
                
                var processBatch = function (batchIndex) {
                    return new Promise(function(resolveBatch, rejectBatch) {
                        var startIdx = batchIndex * batchSize;
                        var endIdx = Math.min(startIdx + batchSize, encuestaIds.length);
                        var batchEncuestaIds = encuestaIds.slice(startIdx, endIdx);
                        
                        var batchRespuestas = [];
                        
                        var fetchPage = function (offset) {
                            this.getCollectionFactory().create('EncuestaLiderazgoRespuesta', function (collection) {
                                collection.maxSize = maxSize;
                                collection.offset = offset;
                                collection.where = [
                                    { type: 'in', attribute: 'encuestaLiderazgoId', value: batchEncuestaIds }
                                ];
                                
                                collection.fetch().then(function () {
                                    var models = collection.models || [];
                                    var respuestasFiltradas = models.map(m => ({
                                        id: m.id,
                                        encuestaLiderazgoId: m.get('encuestaLiderazgoId'),
                                        preguntaId: m.get('preguntaId'),
                                        seleccion: m.get('seleccion'),
                                        texto: m.get('texto')
                                    }));
                                    
                                    batchRespuestas = batchRespuestas.concat(respuestasFiltradas);
                                    
                                    if (models.length === maxSize && (offset + maxSize) < collection.total) {
                                        fetchPage(offset + maxSize);
                                    } else {
                                        resolveBatch(batchRespuestas);
                                    }
                                }.bind(this)).catch(function(error) {
                                    rejectBatch(error);
                                });
                            }.bind(this));
                        }.bind(this);
                        
                        fetchPage(0);
                    }.bind(this));
                }.bind(this);
                
                var processNextBatches = function() {
                    var promises = [];
                    
                    for (var i = 0; i < maxParallelBatches && currentBatchIndex < totalBatches; i++) {
                        promises.push(processBatch(currentBatchIndex));
                        currentBatchIndex++;
                    }
                    
                    if (promises.length === 0) {
                        resolve(allRespuestas);
                        return;
                    }
                    
                    Promise.all(promises).then(function(results) {
                        results.forEach(function(batchResult) {
                            allRespuestas = allRespuestas.concat(batchResult);
                        });
                        
                        batchesCompleted += promises.length;
                        
                        if (currentBatchIndex < totalBatches) {
                            processNextBatches();
                        } else {
                            resolve(allRespuestas);
                        }
                    }).catch(function(error) {
                        reject(error);
                    });
                };
                
                processNextBatches();
                
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
                return;
            }
            
            var promediosPorCategoria = [];
            var labels = [];
            var categoriaIds = [];
            
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
                
                var suma = parseInt(conteo['4']) * 4 + parseInt(conteo['3']) * 3 + 
                        parseInt(conteo['2']) * 2 + parseInt(conteo['1']) * 1;
                var promedio = (suma / total) / 4 * 100;
                
                labels.push(categoria.name);
                promediosPorCategoria.push(promedio);
                categoriaIds.push(categoria.id);
                
            }.bind(this));
            
            if (labels.length === 0) return;
            
            var existingHeader = promediosContainer.find('.chart-header');
            if (existingHeader.length === 0) {
                var textoPromedios = 'Este gráfico muestra el promedio de desempeño por categoría, calculado como porcentaje basado en las respuestas de las evaluaciones. Cada barra representa el rendimiento promedio de una categoría específica.';
                
                var headerHtml = `
                    <div class="chart-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                        <h3 style="margin: 0;">Promedio por Categoría</h3>
                        <div class="info-icon-container">
                            <i class="fas fa-info-circle info-icon" 
                            data-toggle="tooltip" 
                            title="${this.escapeHtml(textoPromedios)}"
                            style="font-size: 16px; color: #6B6F47; cursor: help;"></i>
                        </div>
                    </div>
                `;
                
                promediosContainer.prepend(headerHtml);
            }
            
            var ctx = document.getElementById('promedios-chart');
            if (!ctx) return;
            
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
                            right: 80,
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
                                },
                                font: {
                                    size: 11
                                }
                            },
                            grid: {
                                display: true,
                                color: 'rgba(0, 0, 0, 0.05)'
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
                            enabled: true,
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
                            var categoriaId = categoriaIds[index];
                            this.navegarACategoria(categoriaId);
                        }
                    }.bind(this)
                }
            });
            
            if (existingHeader.length === 0) {
                setTimeout(function() {
                    this.$el.find('#promedios-chart-container .info-icon').tooltip({
                        placement: 'auto',
                        trigger: 'hover',
                        container: '#promedios-chart-container',
                        boundary: 'viewport'
                    });
                }.bind(this), 200);
            }
        },
        
        obtenerTextoCategoria: function(nombreCategoria) {
            var textosCategorias = {
                'Comunicación': 'Esta competencia se refiere a las habilidades del líder para transmitir su mensaje y que el mismo llegue a sus interlocutores; sea internalizado, practicado y apropiado. Dentro de ésta competencia tenemos indicadores que nos pueden guiar sobre si existe o no en la práctica del líder: escucha activa, uso de preguntas poderosas, feedback generativo, conversaciones productivas, comunicación asertiva, coordinación de acciones, negociación.',
                'Trabajo en equipo': 'Esta competencia se refiere a la capacidad del líder de formar equipos de trabajo de alto desempeño. Cohesionados, respetando las individualidades pero siempre guiando al bien común. Los indicadores de cumplimiento de ésta competencia son: colaboración y cooperación, persuasión, reconocimiento del otro, relaciones interpersonales, transmisión de conocimientos, delegación, manejo del conflicto.',
                'Inspiracional y motivacional': 'Esta competencia se basa en la premisa de que un líder no es aquel que te dice qué hacer, sino que te muestra mediante su ejemplo cómo hacerlo. Su conducta es un ejemplo e inspiración para sus colaboradores, así como con su discurso motiva a que las cosas sucedan. Los indicadores de cumplimiento de ésta competencia son: ser fuerza emprendedora, autoestima, seguridad en sí mismo, reconocimiento de méritos, actitud positiva.',
                'Inteligencia emocional-social': 'Se refiere a las habilidades del líder de actuar conociendo sus emociones y reconociendo las de sus colaboradores; buscando formas efectivas de canalizarlas en beneficio personal y de la organización; también está referida a las interrelaciones con los miembros del equipo de trabajo y clientes, generación de confianza. Los indicadores de cumplimiento de ésta competencia son: generación de buen clima, autoconocimiento, autocontrol, reconocimiento de oportunidades de mejora, adaptabilidad.',
                'Desempeño': 'Esta competencia se refiere a la gestión integral del líder, su manejo del tiempo, de los reclamos, de los inconvenientes, la estructuración de su tiempo y la planificación estratégica del trabajo (propio y de su equipo), así como la evaluación y seguimiento de trabajo del equipo. Los indicadores de cumplimiento de ésta competencia son: estructuración del trabajo, innovación enmarcada en la organización, evaluación integral y permanente, formación y desarrollo de líderes, uso de herramientas de equipo.',
                'Visión estratégica organizacional': 'Esta competencia está referida al compromiso del líder para transmitir la cultura de la organización y buscar la mayor integración y alineación de sus seguidores a la misma. Los indicadores de cumplimiento de ésta competencia son: reconocimiento y transmisión de la cultura organizacional, acción estratégica, creación de oportunidades.',
                'Coherencia del liderazgo': 'Esta competencia busca evaluar la autenticidad y la credibilidad del líder. Se centra en si el líder realmente vive y ejemplifica los principios que predica (trabajo en equipo, inteligencia emocional, visión estratégica) y si todas sus manifestaciones están alineadas con el marco superior de la empresa (misión, visión y valores).'                
            };
            
            return textosCategorias[nombreCategoria] || '';
        },
        
        generarGraficos: function () {
            var chartsContainer = this.$el.find('#charts-grid');
            chartsContainer.empty();
            
            Object.values(this.state.charts).forEach(chart => {
                if (chart && chart.destroy) chart.destroy();
            });
            this.state.charts = {};

            if (!CanvasRenderingContext2D.prototype.roundRect) {
                CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
                    if (width < 2 * radius) radius = width / 2;
                    if (height < 2 * radius) radius = height / 2;
                    this.beginPath();
                    this.moveTo(x + radius, y);
                    this.arcTo(x + width, y, x + width, y + height, radius);
                    this.arcTo(x + width, y + height, x, y + height, radius);
                    this.arcTo(x, y + height, x, y, radius);
                    this.arcTo(x, y, x + width, y, radius);
                    this.closePath();
                    return this;
                };
            }

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
                    <div class="chart-card" data-categoria-id="${categoria.id}" style="cursor: pointer;">
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
                        <div class="chart-wrapper" style="height: 550px; width: 100%; position: relative; padding-bottom: 20px;">
                            <canvas id="${canvasId}" style="max-height: 550px;"></canvas>
                        </div>
                    </div>
                `;
                
                chartsContainer.append(cardHtml);
                
                setTimeout(function () {
                    var ctx = document.getElementById(canvasId);
                    if (!ctx) return;
                    
                    var totalValores = Object.values(conteo).reduce((a, b) => a + b, 0);
                    if (totalValores === 0) {
                        return;
                    }
                    
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
                            layout: {
                                padding: {
                                    top: 10,
                                    bottom: 30,
                                    left: 10,
                                    right: 10
                                }
                            },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'bottom',
                                    labels: {
                                        padding: 12,
                                        font: { 
                                            size: 11,
                                            family: 'Arial, sans-serif'
                                        },
                                        boxWidth: 12,
                                        boxHeight: 12,
                                        usePointStyle: true,
                                        pointStyle: 'circle',
                                        generateLabels: function(chart) {
                                            var data = chart.data;
                                            if (data.labels.length && data.datasets.length) {
                                                return data.labels.map(function(label, i) {
                                                    var value = data.datasets[0].data[i];
                                                    var percentage = ((value / total) * 100).toFixed(1);
                                                    return {
                                                        text: label + ' (' + value + ' - ' + percentage + '%)',
                                                        fillStyle: data.datasets[0].backgroundColor[i],
                                                        strokeStyle: data.datasets[0].borderColor || '#fff',
                                                        lineWidth: 1,
                                                        hidden: false,
                                                        index: i
                                                    };
                                                });
                                            }
                                            return [];
                                        }
                                    },
                                    maxHeight: 100,
                                    fullSize: true
                                },
                                tooltip: {
                                    enabled: true,
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    titleFont: {
                                        size: 13,
                                        weight: 'bold'
                                    },
                                    bodyFont: {
                                        size: 12
                                    },
                                    padding: 10,
                                    displayColors: true,
                                    callbacks: {
                                        label: function(context) {
                                            var label = context.label || '';
                                            var value = context.parsed || 0;
                                            var percentage = ((value / total) * 100).toFixed(1);
                                            return label + ': ' + value + ' (' + percentage + '%)';
                                        }
                                    }
                                }
                            },
                            cutout: '45%',
                            aspectRatio: 1.0
                        }
                    });
                }.bind(this), 100);
                
            }.bind(this));

            this.$el.off('click', '.chart-card').on('click', '.chart-card', function(e) {
                var $card = $(e.currentTarget);
                var categoriaId = $card.data('categoria-id');
                
                if (categoriaId) {
                    this.navegarACategoria(categoriaId);
                }
            }.bind(this));

            setTimeout(function() {
                this.$el.find('[data-toggle="tooltip"]').tooltip({
                    placement: 'auto',
                    trigger: 'hover',
                    container: '.chart-card',
                    boundary: 'viewport'
                });
            }.bind(this), 200);
        },
    
        navegarACategoria: function(categoriaIdOrName) {
            var categoriaId = categoriaIdOrName;
            
            var categoria = this.state.categorias.find(c => c.id === categoriaIdOrName);
            
            if (!categoria) {
                categoria = this.state.categorias.find(c => c.name === categoriaIdOrName);
                if (categoria) {
                    categoriaId = categoria.id;
                }
            }
            
            if (!categoriaId) {
                return;
            }
            
            var filtrosParam = [
                categoriaId,
                this.state.fechaSeleccionada || 'null',
                this.state.claSeleccionado || 'null',
                this.state.oficinaSeleccionada || 'null', 
                this.state.usuarioSeleccionado || 'null'
            ].join('-');
            
            var rutaCompleta = '#Liderazgo/categoria/' + filtrosParam;
            
            var router = this.getRouter();
            if (router) {
                router.navigate(rutaCompleta, {trigger: true});
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
            this._ocultarPlanesAccion();
        },
        
        cargarSugerencias: function () {
            var sugerenciasContent = this.$el.find('#sugerencias-content');
            sugerenciasContent.html('<p class="loading-sugerencias"><i class="fas fa-spinner fa-spin"></i> Cargando sugerencias...</p>');
            
            this.fetchPreguntasGenerales().then(function(preguntasGenerales) {
                if (preguntasGenerales.length === 0) {
                    sugerenciasContent.html('<p style="text-align: center; color: #999;">No hay preguntas de categoría General configuradas</p>');
                    return;
                }
                
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