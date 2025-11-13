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
            this.categoriaId = this.options.categoriaId || null;
            
            console.log('Categoría nombre:', this.categoriaNombre);
            
            this.state = {
                usuario: null,
                esCasaNacional: false,
                claSeleccionado: null,
                oficinaSeleccionada: null,
                usuarioSeleccionado: null,
                gaugeChart: null,
                encuestas: [],
                respuestas: [],
                preguntas: []
            };
            
            this.wait(true);
            this.cargarUsuarioActual();
        },
        
        data: function () {
            return {
                categoriaNombre: this.categoriaNombre
            };
        },
        
        afterRender: function () {
            this.inicializarFiltros();
            this.cargarDatosIniciales();
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
                    
                }.bind(this));
            }.bind(this));
        },
        
        inicializarFiltros: function () {
            var claSelect = this.$el.find('#cla-select');
            var oficinaSelect = this.$el.find('#oficina-select');
            var usuarioSelect = this.$el.find('#usuario-select');
            
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
            } else {
                this.wait(false);
            }
        },
        
        cargarDatos: function () {
            this.mostrarLoading(true);
            
            // Primero encontrar la categoría por nombre
            this.fetchCategorias().then(function (categorias) {
                var categoria = categorias.find(c => 
                    c.name.toLowerCase() === this.categoriaNombre.toLowerCase()
                );
                
                if (!categoria) {
                    Espo.Ui.error('Categoría no encontrada: ' + this.categoriaNombre);
                    this.mostrarNoData();
                    return;
                }
                
                this.categoriaId = categoria.id;
                
                return Promise.all([
                    this.fetchEncuestasFiltradas(),
                    this.fetchPreguntasPorCategoria(categoria.id)
                ]);
            }.bind(this)).then(function ([encuestas, preguntas]) {
                if (!encuestas || !preguntas) return;
                
                this.state.encuestas = encuestas;
                this.state.preguntas = preguntas;
                
                if (this.state.encuestas.length === 0 || this.state.preguntas.length === 0) {
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
                
                if (this.state.respuestas.length === 0) {
                    this.mostrarNoData();
                    return;
                }
                
                this.generarGauge();
                this.generarTablaPreguntas();
                this.mostrarContenido();
            }.bind(this)).catch(function (error) {
                console.error('Error cargando datos:', error);
                Espo.Ui.error('Error al cargar los datos');
                this.wait(false);
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
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            allCategorias = allCategorias.concat(models.map(m => ({
                                id: m.id,
                                name: m.get('name')
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
        
        fetchPreguntasPorCategoria: function (categoriaId) {
            return new Promise(function (resolve, reject) {
                var maxSize = 200;
                var allPreguntas = [];
                
                var fetchPage = function (offset) {
                    this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function (collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        collection.where = [
                            { type: 'equals', attribute: 'categoriaLiderazgoId', value: categoriaId }
                        ];
                        
                        collection.fetch().then(function () {
                            var models = collection.models || [];
                            allPreguntas = allPreguntas.concat(models.map(m => ({
                                id: m.id,
                                pregunta: m.get('pregunta'),
                                orden: m.get('orden') || 0
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
        
        generarGauge: function () {
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
            
            this.$el.find('#total-respuestas').text(conteoTotal);
            this.$el.find('#promedio-general').text(promedio.toFixed(2));
            
            var ctx = document.getElementById('gauge-general');
            if (!ctx) return;
            
            if (this.state.gaugeChart) {
                this.state.gaugeChart.destroy();
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
                },
                plugins: [{
                    afterDraw: function(chart) {
                        var ctx = chart.ctx;
                        var width = chart.width;
                        var height = chart.height;
                        
                        ctx.restore();
                        ctx.font = 'bold 32px sans-serif';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#333';
                        
                        var text = promedio.toFixed(1);
                        var textX = Math.round((width - ctx.measureText(text).width) / 2);
                        var textY = height / 1.5;
                        
                        ctx.fillText(text, textX, textY);
                        ctx.save();
                    }
                }]
            });
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
            }
        },
        
        mostrarContenido: function () {
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').show();
            this.$el.find('#no-data-area').hide();
            this.wait(false);
        },
        
        mostrarNoData: function () {
            this.$el.find('#loading-area').hide();
            this.$el.find('#content-area').hide();
            this.$el.find('#no-data-area').show();
            this.wait(false);
        }
        
    });
});