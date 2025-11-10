define('encuesta-de-liderazgo:views/index', ['view'], function (Dep) {
    
    return Dep.extend({
        
        template: 'encuesta-de-liderazgo:index',
        
        events: {
            'click .report-button': 'onReportClick',
            'click [data-action="cargarCSV"]': 'procesarCSV'
        },
        
        setup: function () {
            this.headerTitle = 'Evaluación de Liderazgo';
            this.esAdmin = this.getUser().isAdmin();
            
            this.datosPreview = null;
            this.mostrarPreviewTabla = false;
            this.tablaPreviewHTML = '';
            
            // Reportes disponibles
            this.reportOptions = [
                {
                    id: 'evaluacion-general', 
                    label: 'Evaluación General', 
                    icon: 'fas fa-chart-pie'
                }
            ];
            
            // Cargar categorías para agregar reportes detallados
            this.wait(true);
            this.cargarCategoriasParaReportes();
        },
        
        cargarCategoriasParaReportes: function() {
            this.getCollectionFactory().create('EncuestaLiderazgoCategoria', function(collection) {
                collection.fetch({
                    data: {
                        maxSize: 200,
                        orderBy: 'orden',
                        order: 'asc'
                    }
                }).then(function() {
                    collection.models.forEach(function(categoria) {
                        var nombre = categoria.get('name');
                        if (nombre && nombre.toLowerCase() !== 'general') {
                            this.reportOptions.push({
                                id: 'detalle-' + this.slugify(nombre),
                                label: nombre,
                                icon: 'fas fa-chart-bar'
                            });
                        }
                    }.bind(this));
                    
                    this.wait(false);
                }.bind(this)).catch(function(xhr) {
                    console.warn('No se pudieron cargar categorías. Probablemente no hay ninguna creada aún.');
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },
        
        slugify: function(text) {
            return text.toString().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '-')
                .replace(/[^\w\-]+/g, '')
                .replace(/\-\-+/g, '-')
                .trim();
        },
        
        data: function () {
            return {
                reportOptions: this.reportOptions,
                headerTitle: this.headerTitle,
                esAdmin: this.esAdmin,
                datosPreview: this.datosPreview,
                mostrarPreviewTabla: this.mostrarPreviewTabla,
                tablaPreviewHTML: this.tablaPreviewHTML
            };
        },
        
        onReportClick: function (e) {
            var reportId = $(e.currentTarget).data('report-id');
            var reportLabel = $(e.currentTarget).data('report-label');
            
            console.log('Reporte seleccionado:', reportId, reportLabel);
            
            Espo.Ui.notify('Reporte "' + reportLabel + '" en desarrollo', 'info');
        },
        
        procesarCSV: function() {
            var fileInput = this.$el.find('#csv-file-input')[0];
            
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                Espo.Ui.warning('Por favor selecciona un archivo CSV primero.');
                return;
            }
            
            var file = fileInput.files[0];
            
            if (!file.name.endsWith('.csv')) {
                Espo.Ui.error('El archivo debe ser un CSV.');
                return;
            }
            
            Espo.Ui.notify('Procesando CSV...', 'info');
            this.wait(true);
            
            var reader = new FileReader();
            
            reader.onload = function(e) {
                var contenidoCSV = e.target.result;
                this.iniciarProcesoDeCarga(contenidoCSV);
            }.bind(this);
            
            reader.onerror = function() {
                Espo.Ui.error('Error al leer el archivo.');
                this.wait(false);
            }.bind(this);
            
            reader.readAsText(file, 'UTF-8');
        },
        
        iniciarProcesoDeCarga: async function(contenidoCSV) {
            var todasLasLineas = contenidoCSV.split('\n').filter(l => l.trim());
            
            if (todasLasLineas.length < 2) {
                Espo.Ui.error('El archivo CSV está vacío o no tiene datos.');
                this.wait(false);
                return;
            }
            
            var headers = this.parsearLineaCSV(todasLasLineas[0]);
            var lineasDeDatos = todasLasLineas.slice(1);

            // PASO 1: Cargar preguntas desde la BD
            const preguntasGuardadas = await this.fetchPreguntasGuardadas();

            // PASO 2: Cargar preguntas desde el archivo CSV
            const preguntasDelCSV = this.extraerPreguntasDeHeaders(headers);

            // PASO 3 y 4: Comparar preguntas y gestionar las nuevas
            const gestionResult = this.gestionarPreguntas(preguntasDelCSV, preguntasGuardadas, lineasDeDatos, headers);
            if (!gestionResult.esValido) {
                Espo.Ui.error(gestionResult.error);
                this.wait(false);
                return;
            }
            const { todasLasPreguntas, nuevasPreguntasParaAgregar } = gestionResult;

            // PASO 5: Procesar y validar las filas de encuestas
            const { encuestasValidas, erroresDeFila } = this.procesarFilasDeEncuestas(lineasDeDatos, headers, todasLasPreguntas);

            // PASO 6: Mostrar inconsistencias (errores de fila)
            if (erroresDeFila.length > 0) {
                const mensajeError = 'Algunas filas del CSV fueron omitidas por errores:<br>' + erroresDeFila.join('<br>');
                Espo.Ui.warning(mensajeError, 10000);
                console.warn('Errores de fila en CSV:', erroresDeFila);
            }

            if (encuestasValidas.length === 0) {
                Espo.Ui.error('No se encontraron filas de datos válidas en el archivo CSV.');
                this.wait(false);
                return;
            }

            // PASO 7: Guardar en la base de datos
            await this.guardarDatosEnBD(encuestasValidas, nuevasPreguntasParaAgregar, preguntasDelCSV);
        },

        fetchPreguntasGuardadas: function() {
            return new Promise(function(resolve, reject) {
                this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function(collection) {
                    collection.fetch({
                        data: {
                            maxSize: 500,
                            where: [{ type: 'equals', attribute: 'activa', value: true }]
                        }
                    }).then(function() {
                        var preguntas = collection.models.map(function(model) {
                            // Obtener el nombre de la categoría
                            var categoriaId = model.get('categoriaLiderazgoId');
                            var categoriaNombre = model.get('categoriaLiderazgoName') || 'General';
                            
                            return {
                                id: model.id,
                                texto: model.get('pregunta'),
                                categoria: categoriaNombre,
                                tipo: model.get('tipo'),
                                categoriaId: categoriaId
                            };
                        });
                        console.log('Preguntas cargadas desde BD:', preguntas);
                        resolve(preguntas);
                    }.bind(this)).catch(function(error) {
                        console.log('No se pudieron cargar preguntas:', error);
                        resolve([]);
                    });
                }.bind(this));
            }.bind(this));
        },

        gestionarPreguntas: function(preguntasDelCSV, preguntasGuardadas, lineasDeDatos, headers) {
            const uniqueKey = p => `${p.categoria}::${p.texto}`;

            // CASO A: No hay preguntas en el sistema
            if (preguntasGuardadas.length === 0) {
                console.log("No hay preguntas guardadas. Se agregarán todas las del CSV.");
                if (lineasDeDatos.length < 3) {
                    return { esValido: false, error: "Se necesitan al menos 3 registros de datos en el CSV para determinar el tipo de las nuevas preguntas." };
                }
                preguntasDelCSV.forEach(p => {
                    p.tipo = this.determinarTipoPreguntaPorMuestreo(p, lineasDeDatos, headers);
                });
                return { esValido: true, todasLasPreguntas: preguntasDelCSV, nuevasPreguntasParaAgregar: preguntasDelCSV };
            }

            // CASO B: Hay preguntas en el sistema
            const preguntasGuardadasUnicas = new Set(preguntasGuardadas.map(uniqueKey));
            const preguntasCSVUnicas = new Set(preguntasDelCSV.map(uniqueKey));

            // Validar que todas las preguntas del sistema estén en el CSV
            for (const preguntaGuardada of preguntasGuardadas) {
                if (!preguntasCSVUnicas.has(uniqueKey(preguntaGuardada))) {
                    return { esValido: false, error: `El CSV no contiene la pregunta requerida "${preguntaGuardada.texto}" en la categoría "${preguntaGuardada.categoria}".` };
                }
            }

            // Identificar preguntas nuevas
            let nuevasPreguntas = preguntasDelCSV.filter(p => !preguntasGuardadasUnicas.has(uniqueKey(p)));
            let nuevasPreguntasParaAgregar = [];
            
            if (nuevasPreguntas.length > 0) {
                if (lineasDeDatos.length < 3) {
                    Espo.Ui.warning("Se encontraron preguntas nuevas pero se ignorarán (se necesitan al menos 3 registros).", 7000);
                } else {
                    nuevasPreguntas.forEach(p => {
                        p.tipo = this.determinarTipoPreguntaPorMuestreo(p, lineasDeDatos, headers);
                    });
                    nuevasPreguntasParaAgregar = nuevasPreguntas;
                }
            }

            const todasLasPreguntas = preguntasGuardadas.concat(nuevasPreguntasParaAgregar);
            return { esValido: true, todasLasPreguntas, nuevasPreguntasParaAgregar };
        },

        determinarTipoPreguntaPorMuestreo: function(pregunta, lineasDeDatos, headers) {
            const indicePregunta = headers.indexOf(pregunta.headerOriginal);
            if (indicePregunta === -1) return 'texto';

            const muestras = lineasDeDatos.slice(0, 10);
            let conteoTipos = { seleccion_simple: 0, texto: 0 };

            muestras.forEach(linea => {
                const valores = this.parsearLineaCSV(linea);
                if (valores.length > indicePregunta) {
                    const valor = valores[indicePregunta];
                    const tipo = this.determinarTipoRespuesta(valor);
                    if (conteoTipos.hasOwnProperty(tipo)) {
                        conteoTipos[tipo]++;
                    }
                }
            });

            return conteoTipos.seleccion_simple >= conteoTipos.texto ? 'seleccion_simple' : 'texto';
        },
        
        parsearLineaCSV: function(linea) {
            var valores = [];
            var valorActual = '';
            var dentroComillas = false;
            
            for (var i = 0; i < linea.length; i++) {
                var char = linea[i];
                
                if (char === '"') {
                    dentroComillas = !dentroComillas;
                } else if (char === ';' && !dentroComillas) {
                    valores.push(valorActual.trim());
                    valorActual = '';
                } else {
                    valorActual += char;
                }
            }
            
            valores.push(valorActual.trim());
            return valores;
        },
        
        encontrarIndiceColumna: function(headers, posiblesNombres) {
            for (let i = 0; i < headers.length; i++) {
                var headerLower = headers[i].toLowerCase();
                for (var j = 0; j < posiblesNombres.length; j++) {
                    if (headerLower.includes(posiblesNombres[j].toLowerCase())) {
                        return i;
                    }
                }
            }
            return -1;
        },
        
        parsearFecha: function(fechaStr) {
            if (!fechaStr) return '';
            
            var partes = fechaStr.split(' ')[0].split('/');
            
            if (partes.length === 3) {
                var mes = partes[0].padStart(2, '0');
                var dia = partes[1].padStart(2, '0');
                var anio = partes[2];
                return anio + '-' + mes + '-' + dia;
            }
            
            return fechaStr;
        },
        
        extraerPreguntasDeHeaders: function(headers) {
            const preguntas = [];
            const indiceTimestamp = this.encontrarIndiceColumna(headers, ['timestamp', 'fecha']);
            const indiceCLA = this.encontrarIndiceColumna(headers, ['cla', 'cla pertenece']);
            const indiceOficina = this.encontrarIndiceColumna(headers, ['oficina', 'oficinas']);
            const indiceLider = this.encontrarIndiceColumna(headers, ['lider', 'líder', 'lider a evaluar']);
            const indiceInicioPrguntas = Math.max(indiceTimestamp, indiceCLA, indiceOficina, indiceLider) + 1;
            
            headers.forEach(function(header, index) {
                if (!header.trim() || index < indiceInicioPrguntas) {
                    return;
                }
                
                var categoria = 'General';
                let textoPregunta = header;
                
                const match = header.match(/^(.+?):\s*\[(.+?)\]$/);
                
                if (match) {
                    categoria = this.normalizarTexto(match[1]);
                    textoPregunta = this.normalizarTexto(match[2]);
                } else {
                    textoPregunta = this.normalizarTexto(header);
                }
                
                preguntas.push({
                    categoria: categoria,
                    texto: textoPregunta,
                    headerOriginal: header
                });
            }.bind(this));
            
            return preguntas;
        },
        
        normalizarTexto: function(texto) {
            if (!texto) return '';
            
            texto = texto.trim().toLowerCase();
            if (texto.length === 0) return texto;

            texto = texto.charAt(0).toUpperCase() + texto.slice(1);
            return texto.replace(/([.?!])\s*([a-z])/g, (match, punc, char) => `${punc} ${char.toUpperCase()}`);
        },
        
        determinarTipoRespuesta: function(valor) {
            if (!valor) return 'texto';
            
            var valorTrim = valor.trim();
            
            if (/^\d+$/.test(valorTrim)) {
                return 'seleccion_simple';
            }
            
            return 'texto';
        },

        procesarFilasDeEncuestas: function(lineasDeDatos, headers, todasLasPreguntas) {
            const encuestasValidas = [];
            const erroresDeFila = [];
            const uniqueKey = p => `${p.categoria}::${p.texto}`;
            const mapaTiposPreguntas = new Map(todasLasPreguntas.map(p => [uniqueKey(p), p.tipo]));
            const preguntasDelCSV = this.extraerPreguntasDeHeaders(headers);

            const indiceTimestamp = this.encontrarIndiceColumna(headers, ['timestamp', 'fecha']);
            const indiceCLA = this.encontrarIndiceColumna(headers, ['cla', 'cla pertenece']);
            const indiceOficina = this.encontrarIndiceColumna(headers, ['oficina', 'oficinas']);
            const indiceLider = this.encontrarIndiceColumna(headers, ['lider', 'líder', 'lider a evaluar']);
            const indiceInicioPrguntas = Math.max(indiceTimestamp, indiceCLA, indiceOficina, indiceLider) + 1;

            lineasDeDatos.forEach((linea, index) => {
                const numeroFila = index + 2;
                const valores = this.parsearLineaCSV(linea);

                if (valores.length !== headers.length) {
                    erroresDeFila.push(`Fila ${numeroFila}: Omitida (${valores.length} columnas en lugar de ${headers.length}).`);
                    return;
                }

                const encuesta = {
                    fecha: this.parsearFecha(valores[indiceTimestamp] || ''),
                    cla: valores[indiceCLA] || '',
                    oficina: valores[indiceOficina] || '',
                    liderEvaluado: valores[indiceLider] || '',
                    respuestas: [],
                    numeroFila: numeroFila
                };

                let esFilaValida = true;
                for (let j = 0; j < preguntasDelCSV.length; j++) {
                    const preguntaInfo = preguntasDelCSV[j];
                    const valorRespuesta = valores[indiceInicioPrguntas + j] || '';
                    const tipoDeterminado = this.determinarTipoRespuesta(valorRespuesta);
                    const tipoEsperado = mapaTiposPreguntas.get(uniqueKey(preguntaInfo));

                    if (tipoEsperado) {
                        if (tipoEsperado === 'seleccion_simple' && valorRespuesta) {
                            const valorNumerico = parseInt(valorRespuesta.trim(), 10);
                            if (isNaN(valorNumerico) || valorNumerico < 1 || valorNumerico > 4) {
                                erroresDeFila.push(`Fila ${numeroFila}: Valor inválido ('${valorRespuesta}') para "${preguntaInfo.texto}".`);
                                esFilaValida = false;
                                break;
                            }
                        }
                        
                        encuesta.respuestas.push({
                            pregunta: preguntaInfo.texto,
                            categoria: preguntaInfo.categoria,
                            valor: valorRespuesta,
                            tipo: tipoDeterminado
                        });
                    }
                }

                if (esFilaValida) {
                    encuestasValidas.push(encuesta);
                }
            });

            return { encuestasValidas, erroresDeFila };
        },

        guardarDatosEnBD: async function(encuestasValidas, nuevasPreguntasParaAgregar, preguntasDelCSV) {
            try {
                Espo.Ui.notify('Guardando datos en la base de datos...', 'info');
                
                // PASO 1: Verificar/Crear usuario por defecto "0"
                const usuarioDefectoId = await this.obtenerOCrearUsuarioDefecto();
                
                // PASO 2: Guardar categorías nuevas y obtener mapeo id
                const mapaCategorias = await this.guardarCategorias(preguntasDelCSV);
                
                // PASO 3: Guardar preguntas nuevas y obtener mapeo completo
                const mapaPreguntas = await this.guardarPreguntas(nuevasPreguntasParaAgregar, mapaCategorias);
                
                // PASO 4: Guardar encuestas y respuestas
                await this.guardarEncuestasYRespuestas(encuestasValidas, usuarioDefectoId, mapaPreguntas);
                
                this.wait(false);
                Espo.Ui.success('¡Datos guardados exitosamente! Total: ' + encuestasValidas.length + ' encuestas.');
                
                // Limpiar preview
                this.datosPreview = null;
                this.mostrarPreviewTabla = false;
                this.$el.find('#csv-file-input').val('');
                this.reRender();
                
            } catch (error) {
                console.error('Error guardando datos:', error);
                Espo.Ui.error('Error al guardar los datos: ' + (error.message || error));
                this.wait(false);
            }
        },

        obtenerOCrearUsuarioDefecto: function() {
            return new Promise(function(resolve, reject) {
                this.getCollectionFactory().create('User', function(collection) {
                    collection.fetch({
                        data: {
                            where: [{ type: 'equals', attribute: 'name', value: '0' }]
                        }
                    }).then(function() {
                        if (collection.length > 0) {
                            resolve(collection.at(0).id);
                        } else {
                            // Crear usuario "0"
                            this.getModelFactory().create('User', function(model) {
                                model.set({
                                    userName: '0',
                                    name: '0',
                                    type: 'regular'
                                });
                                model.save().then(function() {
                                    resolve(model.id);
                                }).catch(reject);
                            }.bind(this));
                        }
                    }.bind(this)).catch(reject);
                }.bind(this));
            }.bind(this));
        },

        guardarCategorias: function(preguntasDelCSV) {
            return new Promise(function(resolve, reject) {
                const categoriasUnicas = [...new Set(preguntasDelCSV.map(p => p.categoria))];
                const mapaCategorias = {};
                let procesadas = 0;
                
                if (categoriasUnicas.length === 0) {
                    resolve(mapaCategorias);
                    return;
                }
                
                categoriasUnicas.forEach(function(nombreCategoria) {
                    this.getCollectionFactory().create('EncuestaLiderazgoCategoria', function(collection) {
                        collection.fetch({
                            data: {
                                where: [{ type: 'equals', attribute: 'name', value: nombreCategoria }]
                            }
                        }).then(function() {
                            if (collection.length > 0) {
                                mapaCategorias[nombreCategoria] = collection.at(0).id;
                                procesadas++;
                                if (procesadas === categoriasUnicas.length) resolve(mapaCategorias);
                            } else {
                                // Crear nueva categoría
                                this.getModelFactory().create('EncuestaLiderazgoCategoria', function(model) {
                                    model.set({
                                        name: nombreCategoria,
                                        orden: Object.keys(mapaCategorias).length
                                    });
                                    model.save().then(function() {
                                        mapaCategorias[nombreCategoria] = model.id;
                                        procesadas++;
                                        if (procesadas === categoriasUnicas.length) resolve(mapaCategorias);
                                    }).catch(reject);
                                }.bind(this));
                            }
                        }.bind(this)).catch(reject);
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        },

        guardarPreguntas: function(nuevasPreguntasParaAgregar, mapaCategorias) {
            return new Promise(function(resolve, reject) {
                const mapaPreguntas = {};
                
                if (nuevasPreguntasParaAgregar.length === 0) {
                    // Cargar todas las preguntas existentes
                    this.fetchPreguntasGuardadas().then(function(preguntas) {
                        preguntas.forEach(function(p) {
                            mapaPreguntas[`${p.categoria}::${p.texto}`] = p.id;
                        });
                        resolve(mapaPreguntas);
                    }).catch(reject);
                    return;
                }
                
                let procesadas = 0;
                
                nuevasPreguntasParaAgregar.forEach(function(pregunta) {
                    this.getModelFactory().create('EncuestaLiderazgoPregunta', function(model) {
                        model.set({
                            name: pregunta.texto.substring(0, 50) + '...',
                            pregunta: pregunta.texto,
                            tipo: pregunta.tipo,
                            categoriaLiderazgoId: mapaCategorias[pregunta.categoria],
                            activa: true
                        });
                        model.save().then(function() {
                            mapaPreguntas[`${pregunta.categoria}::${pregunta.texto}`] = model.id;
                            procesadas++;
                            if (procesadas === nuevasPreguntasParaAgregar.length) {
                                // Cargar también las existentes
                                this.fetchPreguntasGuardadas().then(function(preguntas) {
                                    preguntas.forEach(function(p) {
                                        if (!mapaPreguntas[`${p.categoria}::${p.texto}`]) {
                                            mapaPreguntas[`${p.categoria}::${p.texto}`] = p.id;
                                        }
                                    });
                                    resolve(mapaPreguntas);
                                }).catch(reject);
                            }
                        }.bind(this)).catch(reject);
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        },

        guardarEncuestasYRespuestas: function(encuestasValidas, usuarioDefectoId, mapaPreguntas) {
            return new Promise(function(resolve, reject) {
                let procesadas = 0;
                let errores = [];
                
                const procesarEncuesta = function(encuesta) {
                    console.log('Procesando encuesta para líder:', encuesta.liderEvaluado);
                    
                    // Buscar usuario evaluado por nombre
                    this.buscarUsuarioPorNombre(encuesta.liderEvaluado).then(function(usuarioEvaluadoId) {
                        console.log('Usuario encontrado ID:', usuarioEvaluadoId, 'para nombre:', encuesta.liderEvaluado);
                        
                        if (!usuarioEvaluadoId) {
                            console.warn('No se encontró usuario con nombre:', encuesta.liderEvaluado);
                            errores.push('Fila ' + encuesta.numeroFila + ': Usuario "' + encuesta.liderEvaluado + '" no encontrado.');
                            procesadas++;
                            if (procesadas === encuestasValidas.length) {
                                if (errores.length > 0) {
                                    console.warn('Encuestas no guardadas por usuarios no encontrados:', errores);
                                    Espo.Ui.warning('Se omitieron ' + errores.length + ' encuestas porque no se encontraron los usuarios evaluados.', 8000);
                                }
                                resolve();
                            }
                            return;
                        }
                        
                        // Buscar teams (CLA y Oficina)
                        Promise.all([
                            this.buscarTeamPorNombre(encuesta.cla),
                            this.buscarTeamPorNombre(encuesta.oficina)
                        ]).then(function(results) {
                            const claTeamId = results[0];
                            const oficinaTeamId = results[1];
                            
                            console.log('Teams encontrados - CLA:', claTeamId, 'Oficina:', oficinaTeamId);
                            
                            this.getModelFactory().create('EncuestaLiderazgo', function(model) {
                                const datos = {
                                    name: 'Evaluación ' + encuesta.liderEvaluado + ' - ' + encuesta.fecha,
                                    fecha: encuesta.fecha,
                                    usuarioId: usuarioDefectoId,
                                    usuarioEvaluadoId: usuarioEvaluadoId
                                };
                                
                                if (claTeamId) datos.claTeamId = claTeamId;
                                if (oficinaTeamId) datos.oficinaTeamId = oficinaTeamId;
                                
                                console.log('Datos a guardar en encuesta:', datos);
                                
                                model.set(datos);
                                
                                model.save().then(function() {
                                    const encuestaId = model.id;
                                    console.log('Encuesta guardada con ID:', encuestaId);
                                    
                                    // Guardar respuestas
                                    this.guardarRespuestas(encuestaId, encuesta.respuestas, mapaPreguntas).then(function() {
                                        procesadas++;
                                        console.log('Progreso:', procesadas, '/', encuestasValidas.length);
                                        if (procesadas === encuestasValidas.length) {
                                            if (errores.length > 0) {
                                                console.warn('Encuestas no guardadas:', errores);
                                                Espo.Ui.warning('Se guardaron ' + (procesadas - errores.length) + ' de ' + encuestasValidas.length + ' encuestas. Algunas filas tenían usuarios no encontrados.', 8000);
                                            }
                                            resolve();
                                        }
                                    }).catch(reject);
                                }.bind(this)).catch(function(error) {
                                    console.error('Error guardando encuesta:', error);
                                    errores.push('Fila ' + encuesta.numeroFila + ': Error al guardar.');
                                    procesadas++;
                                    if (procesadas === encuestasValidas.length) {
                                        if (errores.length > 0) {
                                            Espo.Ui.warning('Se omitieron ' + errores.length + ' encuestas por errores.', 8000);
                                        }
                                        resolve();
                                    }
                                });
                            }.bind(this));
                        }.bind(this)).catch(function(error) {
                            console.error('Error buscando teams:', error);
                            reject(error);
                        });
                    }.bind(this)).catch(function(error) {
                        console.error('Error buscando usuario:', error);
                        reject(error);
                    });
                }.bind(this);
                
                encuestasValidas.forEach(procesarEncuesta);
            }.bind(this));
        },
        
        buscarUsuarioPorNombre: function(nombre) {
            return new Promise(function(resolve, reject) {
                if (!nombre || !nombre.trim()) {
                    console.log('Búsqueda de usuario: nombre vacío');
                    resolve(null);
                    return;
                }
                
                console.log('Buscando usuario con nombre:', nombre);
                
                this.getCollectionFactory().create('User', function(collection) {
                    // Búsqueda exclusiva por nombre completo exacto
                    collection.fetch({
                        data: {
                            where: [
                                { type: 'equals', attribute: 'name', value: nombre }
                            ],
                            maxSize: 2
                        }
                    }).then(function() {
                        console.log('Resultados búsqueda exacta:', collection.length);
                        
                        if (collection.length === 1) {
                            console.log('Usuario encontrado (exacto):', collection.at(0).get('name'));
                            resolve(collection.at(0).id);
                        } else {
                            if (collection.length > 1) {
                                console.warn('Se encontró más de un usuario con el nombre "' + nombre + '". La encuesta para esta fila será omitida.');
                            } else {
                                console.log('Usuario no encontrado:', nombre);
                            }
                            resolve(null);
                        }
                    }.bind(this)).catch(function(error) {
                        console.error('Error en búsqueda de usuario:', error);
                        resolve(null);
                    });
                }.bind(this));
            }.bind(this));
        },
        
        buscarTeamPorNombre: function(nombre) {
            return new Promise(function(resolve, reject) {
                if (!nombre || !nombre.trim()) {
                    resolve(null);
                    return;
                }
                
                this.getCollectionFactory().create('Team', function(collection) {
                    collection.fetch({
                        data: {
                            where: [
                                {
                                    type: 'or',
                                    value: [
                                        { type: 'equals', attribute: 'name', value: nombre },
                                        { type: 'contains', attribute: 'name', value: nombre }
                                    ]
                                }
                            ],
                            maxSize: 1
                        }
                    }).then(function() {
                        if (collection.length > 0) {
                            resolve(collection.at(0).id);
                        } else {
                            resolve(null);
                        }
                    }).catch(function() {
                        resolve(null);
                    });
                }.bind(this));
            }.bind(this));
        },

        guardarRespuestas: function(encuestaId, respuestas, mapaPreguntas) {
            return new Promise(function(resolve, reject) {
                let procesadas = 0;
                
                if (respuestas.length === 0) {
                    resolve();
                    return;
                }
                
                respuestas.forEach(function(respuesta) {
                    const preguntaId = mapaPreguntas[`${respuesta.categoria}::${respuesta.pregunta}`];
                    
                    if (!preguntaId) {
                        console.warn('No se encontró ID para pregunta:', respuesta.pregunta);
                        procesadas++;
                        if (procesadas === respuestas.length) resolve();
                        return;
                    }
                    
                    this.getModelFactory().create('EncuestaLiderazgoRespuesta', function(model) {
                        const datos = {
                            encuestaLiderazgoId: encuestaId,
                            preguntaId: preguntaId
                        };
                        
                        if (respuesta.tipo === 'seleccion_simple') {
                            datos.seleccion = respuesta.valor;
                        } else {
                            datos.texto = respuesta.valor;
                        }
                        
                        model.set(datos);
                        model.save().then(function() {
                            procesadas++;
                            if (procesadas === respuestas.length) resolve();
                        }).catch(reject);
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        }
        
    });
});