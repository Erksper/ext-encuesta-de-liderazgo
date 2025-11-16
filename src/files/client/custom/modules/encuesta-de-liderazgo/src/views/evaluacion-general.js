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
            console.log('Setup evaluacion-general iniciado');
            
            this.state = {
                usuario: null,
                esCasaNacional: false,
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
        },
        
        data: function () {
            return {};
        },
        
        afterRender: function () {
            console.log('afterRender ejecutado');
            console.log('Elementos encontrados:', {
                container: this.$el.length,
                claSelect: this.$el.find('#cla-select').length,
                oficinaSelect: this.$el.find('#oficina-select').length,
                usuarioSelect: this.$el.find('#usuario-select').length
            });
            
            // Dar tiempo para que el DOM se construya
            setTimeout(function() {
                this.inicializarFiltros();
                this.cargarDatosIniciales();
            }.bind(this), 100);
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
                    
                    this.wait(false);
                    
                }.bind(this));
            }.bind(this));
        },
        
        inicializarFiltros: function () {
            console.log('Inicializando filtros...');
            
            var claSelect = this.$el.find('#cla-select');
            var oficinaSelect = this.$el.find('#oficina-select');
            var usuarioSelect = this.$el.find('#usuario-select');
            
            console.log('Inicializando filtros, elementos encontrados:', {
                cla: claSelect.length,
                oficina: oficinaSelect.length,
                usuario: usuarioSelect.length
            });
            
            if (this.state.esCasaNacional) {
                this.cargarTodosCLAs();
            } else {
                this.cargarCLAsUsuario();
            }
            
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
                this.cargarDatos();
            }.bind(this));
        },
        
        cargarTodosCLAs: function () {
            this.fetchAllTeams().then(function (teams) {
                var claPattern = /^CLA\d+$/i;
                var clas = teams.filter(t => claPattern.test(t.id));
                
                var claSelect = this.$el.find('#cla-select');
                claSelect.html('<option value="">Seleccione un CLA</option>');
                claSelect.append('<option value="CLA0">Territorio Nacional</option>');
                
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
            claSelect.append('<option value="CLA0">Territorio Nacional</option>');
            
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
            if (!this.state.esCasaNacional && this.state.oficinaSeleccionada) {
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
                var cardHtml = `
                    <div class="chart-card">
                        <h3>${categoria.name}</h3>
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
        }
        
    });
});