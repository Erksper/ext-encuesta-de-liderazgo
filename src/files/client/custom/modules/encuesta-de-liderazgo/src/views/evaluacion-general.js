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
                fechaSeleccionada: null, // NUEVO
                claSeleccionado: null,
                oficinaSeleccionada: null,
                usuarioSeleccionado: null,
                charts: {},
                categorias: [],
                encuestas: [],
                respuestas: [],
                preguntas: []
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
                    
                    // Registrar plugin personalizado para mostrar porcentajes
                    if (typeof Chart !== 'undefined') {
                        Chart.register({
                            id: 'customLabels',
                            afterDatasetsDraw: function(chart) {
                                if (chart.config.type === 'doughnut') {
                                    var ctx = chart.ctx;
                                    chart.data.datasets.forEach(function(dataset, i) {
                                        var meta = chart.getDatasetMeta(i);
                                        if (!meta.hidden) {
                                            meta.data.forEach(function(element, index) {
                                                ctx.fillStyle = '#fff';
                                                var fontSize = 14;
                                                var fontStyle = 'bold';
                                                var fontFamily = 'Arial';
                                                ctx.font = fontStyle + ' ' + fontSize + 'px ' + fontFamily;
                                                
                                                var dataString = dataset.data[index].toString();
                                                var total = dataset.data.reduce((a, b) => a + b, 0);
                                                var percentage = ((dataset.data[index] / total) * 100).toFixed(1) + '%';
                                                
                                                ctx.textAlign = 'center';
                                                ctx.textBaseline = 'middle';
                                                
                                                var position = element.tooltipPosition();
                                                ctx.fillText(percentage, position.x, position.y);
                                            });
                                        }
                                    });
                                } else if (chart.config.type === 'bar') {
                                    var ctx = chart.ctx;
                                    chart.data.datasets.forEach(function(dataset, i) {
                                        var meta = chart.getDatasetMeta(i);
                                        if (!meta.hidden) {
                                            meta.data.forEach(function(element, index) {
                                                ctx.fillStyle = '#333';
                                                var fontSize = 12;
                                                var fontStyle = 'bold';
                                                var fontFamily = 'Arial';
                                                ctx.font = fontStyle + ' ' + fontSize + 'px ' + fontFamily;
                                                
                                                var dataString = dataset.data[index].toFixed(1) + '%';
                                                
                                                ctx.textAlign = 'left';
                                                ctx.textBaseline = 'middle';
                                                
                                                ctx.fillText(dataString, element.x + 5, element.y);
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                    
                    this.verificarCargaCompleta();
                }.bind(this);
                script.onerror = function() {
                    console.error('Error al cargar Chart.js');
                    Espo.Ui.error('Error al cargar la librería de gráficos');
                    this.wait(false);
                }.bind(this);
                document.head.appendChild(script);
            }
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
                this.cargarAniosDisponibles(); // NUEVO: Cargar años primero
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
            var usuarioCargado = this.state.usuario && this.state.usuario.teamsIds;
            
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
                this.state.fechaSeleccionada = $(e.currentTarget).val();
                this.state.claSeleccionado = null;
                this.state.oficinaSeleccionada = null;
                this.state.usuarioSeleccionado = null;
                
                // Resetear los demás filtros
                claSelect.prop('disabled', !this.state.fechaSeleccionada);
                oficinaSelect.prop('disabled', true);
                usuarioSelect.prop('disabled', true);
                
                if (this.state.fechaSeleccionada) {
                    // Cargar CLAs basados en la fecha seleccionada
                    if (this.state.esCasaNacional) {
                        this.cargarTodosCLAs();
                    } else {
                        this.cargarCLAsUsuario();
                    }
                    this.cargarDatos();
                } else {
                    claSelect.html('<option value="">Seleccione un año primero</option>');
                    oficinaSelect.html('<option value="">Seleccione un CLA primero</option>');
                    usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                }
            }.bind(this));
            
            // Los eventos existentes para cla, oficina y usuario se mantienen igual
            claSelect.on('change', function (e) {
                this.state.claSeleccionado = $(e.currentTarget).val();
                this.state.oficinaSeleccionada = null;
                this.state.usuarioSeleccionado = null;
                
                oficinaSelect.html('<option value="">Cargando...</option>');
                usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                usuarioSelect.prop('disabled', true);
                
                if (this.state.claSeleccionado === 'CLA0') {
                    oficinaSelect.html('<option value="">No disponible para Territorio Nacional</option>');
                    oficinaSelect.prop('disabled', true);
                    this.cargarDatos();
                } else if (this.state.claSeleccionado) {
                    this.cargarOficinasPorCLA(this.state.claSeleccionado);
                    this.cargarDatos();
                } else {
                    oficinaSelect.prop('disabled', true);
                    oficinaSelect.html('<option value="">Seleccione un CLA primero</option>');
                }
            }.bind(this));
            
            oficinaSelect.on('change', function (e) {
                this.state.oficinaSeleccionada = $(e.currentTarget).val();
                this.state.usuarioSeleccionado = null;
                
                if (this.state.oficinaSeleccionada) {
                    this.cargarUsuariosPorOficina(this.state.oficinaSeleccionada);
                    this.cargarDatos();
                } else {
                    usuarioSelect.html('<option value="">Seleccione una Oficina primero</option>');
                    usuarioSelect.prop('disabled', true);
                }
            }.bind(this));
            
            usuarioSelect.on('change', function (e) {
                this.state.usuarioSeleccionado = $(e.currentTarget).val();
                
                // Mostrar/ocultar sección de sugerencias
                if (this.state.usuarioSeleccionado) {
                    this.$el.find('#sugerencias-card').show();
                    this.cargarSugerencias();
                } else {
                    this.$el.find('#sugerencias-card').hide();
                }
                
                this.cargarDatos();
            }.bind(this));
        },
        
        cargarTodosCLAs: function () {
            this.fetchAllTeams().then(function (teams) {
                var claPattern = /^CLA\d+$/i;
                var clas = teams.filter(t => claPattern.test(t.id));
                
                var claSelect = this.$el.find('#cla-select');
                claSelect.html('<option value="">Seleccione un CLA</option>');
                
                // Buscar si existe un team llamado "Territorio Nacional"
                var territorioNacional = teams.find(t => 
                    t.name && t.name.toLowerCase() === 'territorio nacional'
                );
                
                if (territorioNacional) {
                    // Si existe en los teams, usar ese ID
                    claSelect.append(`<option value="${territorioNacional.id}">${territorioNacional.name}</option>`);
                } else {
                    // Si no existe, usar CLA0 como placeholder
                    claSelect.append('<option value="CLA0">Territorio Nacional</option>');
                }
                
                clas.sort((a, b) => {
                    var numA = parseInt(a.id.replace(/\D/g, ''));
                    var numB = parseInt(b.id.replace(/\D/g, ''));
                    return numA - numB;
                }).forEach(cla => {
                    claSelect.append(`<option value="${cla.id}">${cla.name || cla.id}</option>`);
                });
            }.bind(this));
        },
        
        cargarCLAsUsuario: function () {
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
            
            // Buscar si el usuario tiene un team "Territorio Nacional"
            var territorioNacionalId = teamsIds.find(id => {
                var teamName = (this.state.usuario.teamsNames[id] || '').toLowerCase();
                return teamName === 'territorio nacional';
            });
            
            // Solo agregar Territorio Nacional si el usuario es Casa Nacional Y no tiene ya ese team
            if (this.state.esCasaNacional && !territorioNacionalId) {
                claSelect.append('<option value="CLA0">Territorio Nacional</option>');
            } else if (territorioNacionalId) {
                var teamName = this.state.usuario.teamsNames[territorioNacionalId];
                claSelect.append(`<option value="${territorioNacionalId}">${teamName}</option>`);
            }
            
            if (claId) {
                var teamName = this.state.usuario.teamsNames[claId] || claId;
                claSelect.append(`<option value="${claId}">${teamName}</option>`);
                
                this.state.claSeleccionado = claId;
                claSelect.val(claId);
                
                var oficinaId = teamsIds.find(id => !claPattern.test(id) && id.toLowerCase() !== 'venezuela');
                if (oficinaId) {
                    var oficinaName = this.state.usuario.teamsNames[oficinaId] || oficinaId;
                    oficinaSelect.html(`<option value="${oficinaId}">${oficinaName}</option>`);
                    oficinaSelect.prop('disabled', false);
                    this.state.oficinaSeleccionada = oficinaId;
                    oficinaSelect.val(oficinaId);
                    
                    this.cargarUsuariosPorOficina(oficinaId);
                }
            }
        },
        
        cargarOficinasPorCLA: function (claId) {
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
            }.bind(this)).catch(function (error) {
                console.error('Error cargando oficinas:', error);
                oficinaSelect.html('<option value="">Error al cargar</option>');
            });
        },
        
        cargarUsuariosPorOficina: function (oficinaId) {
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
            }.bind(this)).catch(function (error) {
                console.error('Error cargando usuarios:', error);
                usuarioSelect.html('<option value="">Error al cargar</option>');
            });
        },
        
        cargarDatosIniciales: function () {
            if (this.state.fechaSeleccionada && !this.state.esCasaNacional && this.state.oficinaSeleccionada) {
                setTimeout(function() {
                    this.cargarDatos();
                }.bind(this), 500);
            }
        },
        
        cargarDatos: function () {
            console.log('Cargando datos con filtros:', {
                cla: this.state.claSeleccionado,
                oficina: this.state.oficinaSeleccionada,
                usuario: this.state.usuarioSeleccionado
            });
            
            this.mostrarLoading(true);
            
            Promise.all([
                this.fetchCategorias(),
                this.fetchEncuestasFiltradas()
            ]).then(function ([categorias, encuestas]) {
                this.state.categorias = categorias.filter(c => c.name.toLowerCase() !== 'general');
                this.state.encuestas = encuestas;
                
                console.log('Categorías cargadas:', this.state.categorias.length);
                console.log('Encuestas cargadas:', this.state.encuestas.length);
                
                if (this.state.encuestas.length === 0) {
                    this.mostrarNoData();
                    return Promise.resolve(null); // Retornar promise para que no falle el siguiente .then
                }
                
                return Promise.all([
                    this.fetchTodasLasPreguntas(),
                    this.fetchRespuestasPorEncuestas(this.state.encuestas.map(e => e.id))
                ]);
            }.bind(this)).then(function (resultado) {
                // Si no hay resultado (no hay encuestas), salir
                if (!resultado) return;
                
                var preguntas = resultado[0];
                var respuestas = resultado[1];
                
                if (!preguntas) return;
                
                this.state.preguntas = preguntas.filter(p => {
                    var catNombre = p.categoriaLiderazgoName || '';
                    return catNombre.toLowerCase() !== 'general';
                });
                this.state.respuestas = respuestas;
                
                console.log('Preguntas cargadas:', this.state.preguntas.length);
                console.log('Respuestas cargadas:', this.state.respuestas.length);
                
                this.generarEstadisticas();
                this.generarGraficoPromedios();
                this.generarGraficos();
                this.mostrarContenido();
            }.bind(this)).catch(function (error) {
                console.error('Error cargando datos:', error);
                Espo.Ui.error('Error al cargar los datos');
                this.mostrarNoData();
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
                var maxSize = 200;
                var allEncuestas = [];
                
                var whereConditions = [];
                
                // NUEVO: Filtro por fecha/año
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
                
                if (this.state.oficinaSeleccionada) {
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
                        borderWidth: 2
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
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
                            this.navegarACategoriaDetalle(categoriaNombre);
                        }
                    }.bind(this)
                }
            });
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
                var cardHtml = `
                    <div class="chart-card" data-categoria-nombre="${this.escapeHtml(categoriaNombre)}" style="cursor: pointer;">
                        <h3>${categoriaNombre}</h3>
                        <div class="chart-wrapper">
                            <canvas id="${canvasId}"></canvas>
                        </div>
                    </div>
                `;
                
                chartsContainer.append(cardHtml);
                
                // Agregar evento click a la card
                this.$el.find(`[data-categoria-nombre="${this.escapeHtml(categoriaNombre)}"]`).on('click', function() {
                    this.navegarACategoriaDetalle(categoriaNombre);
                }.bind(this));
                
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
                                },
                                datalabels: {
                                    formatter: function(value, context) {
                                        var percentage = ((value / total) * 100).toFixed(1);
                                        return percentage + '%';
                                    },
                                    color: '#fff',
                                    font: {
                                        weight: 'bold',
                                        size: 14
                                    }
                                }
                            }
                        }
                    });
                }.bind(this), 100);
                
            }.bind(this));
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
        },
        
        navegarACategoriaDetalle: function(categoriaNombre) {
            var categoriaEncoded = encodeURIComponent(categoriaNombre);
            this.getRouter().navigate('#Liderazgo/categoria/' + categoriaEncoded, {trigger: true});
        }
        
    });
});