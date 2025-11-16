define('encuesta-de-liderazgo:views/admin', ['view'], function (Dep) {
    
    return Dep.extend({
        
        template: 'encuesta-de-liderazgo:admin',
        
        events: {
            'click [data-action="cargarCSV"]': 'procesarCSV'
        },
        
        setup: function () {
            this.headerTitle = 'Administración de Liderazgo';
            this.esAdmin = this.getUser().isAdmin();
            
            if (!this.esAdmin) {
                this.getRouter().navigate('#Liderazgo', {trigger: true});
                Espo.Ui.error('Acceso denegado. Solo administradores pueden acceder.');
                return;
            }
            
            this.datosPreview = null;
            this.mostrarPreviewTabla = false;
            this.tablaPreviewHTML = '';
        },
        
        data: function () {
            return {
                headerTitle: this.headerTitle,
                esAdmin: this.esAdmin,
                datosPreview: this.datosPreview,
                mostrarPreviewTabla: this.mostrarPreviewTabla,
                tablaPreviewHTML: this.tablaPreviewHTML
            };
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

            const preguntasGuardadas = await this.fetchPreguntasGuardadas();
            const preguntasDelCSV = this.extraerPreguntasDeHeaders(headers);
            const gestionResult = this.gestionarPreguntas(preguntasDelCSV, preguntasGuardadas, lineasDeDatos, headers);
            
            if (!gestionResult.esValido) {
                Espo.Ui.error(gestionResult.error);
                this.wait(false);
                return;
            }
            
            const { todasLasPreguntas, nuevasPreguntasParaAgregar } = gestionResult;
            const { encuestasValidas, erroresDeFila } = this.procesarFilasDeEncuestas(lineasDeDatos, headers, todasLasPreguntas);

            if (erroresDeFila.length > 0) {
                const mensajeError = 'Algunas filas del CSV fueron omitidas por errores:<br>' + erroresDeFila.join('<br>');
                Espo.Ui.warning(mensajeError, 10000);
            }

            if (encuestasValidas.length === 0) {
                Espo.Ui.error('No se encontraron filas de datos válidas en el archivo CSV.');
                this.wait(false);
                return;
            }

            await this.guardarDatosEnBD(encuestasValidas, nuevasPreguntasParaAgregar, preguntasDelCSV);
        },

        fetchPreguntasGuardadas: function() {
            return new Promise(function(resolve, reject) {
                const maxSize = 200;
                let todasLasPreguntas = [];
                
                const fetchPage = (offset) => {
                    this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function(collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        
                        collection.fetch().then(function() {
                            const models = collection.models || [];
                            
                            const preguntasLote = models.map(function(model) {
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
                            
                            todasLasPreguntas = todasLasPreguntas.concat(preguntasLote);
                            
                            if (models.length < maxSize || todasLasPreguntas.length >= collection.total) {
                                resolve(todasLasPreguntas);
                            } else {
                                fetchPage(offset + maxSize);
                            }
                            
                        }.bind(this)).catch(function(error) {
                            console.error('Error cargando lote de preguntas:', error);
                            resolve(todasLasPreguntas);
                        });
                    }.bind(this));
                };
                
                fetchPage(0);
                
            }.bind(this));
        },

        gestionarPreguntas: function(preguntasDelCSV, preguntasGuardadas, lineasDeDatos, headers) {
            const uniqueKey = p => `${p.categoria.toLowerCase()}::${p.texto.toLowerCase()}`;

            if (preguntasGuardadas.length === 0) {
                if (lineasDeDatos.length < 3) {
                    return { esValido: false, error: "Se necesitan al menos 3 registros de datos en el CSV para determinar el tipo de las nuevas preguntas." };
                }
                preguntasDelCSV.forEach(p => {
                    p.tipo = this.determinarTipoPreguntaPorMuestreo(p, lineasDeDatos, headers);
                });
                return { esValido: true, todasLasPreguntas: preguntasDelCSV, nuevasPreguntasParaAgregar: preguntasDelCSV };
            }

            const preguntasGuardadasMap = new Map();
            preguntasGuardadas.forEach(function(p) {
                preguntasGuardadasMap.set(uniqueKey(p), p);
            });
            
            const preguntasCSVUnicas = new Set(preguntasDelCSV.map(uniqueKey));

            let preguntasFaltantes = [];
            for (const preguntaGuardada of preguntasGuardadas) {
                const key = uniqueKey(preguntaGuardada);
                if (!preguntasCSVUnicas.has(key)) {
                    preguntasFaltantes.push(`"${preguntaGuardada.texto}" en categoría "${preguntaGuardada.categoria}"`);
                }
            }

            if (preguntasFaltantes.length > 0) {
                return { 
                    esValido: false, 
                    error: `El CSV no contiene las siguientes preguntas requeridas: ${preguntasFaltantes.join(', ')}` 
                };
            }

            let nuevasPreguntas = preguntasDelCSV.filter(p => !preguntasGuardadasMap.has(uniqueKey(p)));
            let nuevasPreguntasParaAgregar = [];
            
            if (nuevasPreguntas.length > 0) {
                if (lineasDeDatos.length >= 3) {
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
            const uniqueKey = p => `${p.categoria.toLowerCase()}::${p.texto.toLowerCase()}`;
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
                const usuarioDefectoId = await this.obtenerOCrearUsuarioDefecto();
                const mapaCategorias = await this.guardarCategorias(preguntasDelCSV);
                const mapaPreguntas = await this.guardarPreguntas(nuevasPreguntasParaAgregar, mapaCategorias);
                const resultado = await this.guardarEncuestasYRespuestas(encuestasValidas, usuarioDefectoId, mapaPreguntas);
                
                this.wait(false);
                
                if (resultado.errores.length > 0) {
                    Espo.Ui.warning(
                        `¡Proceso completado con observaciones!<br>` +
                        `Encuestas guardadas: ${resultado.guardadas}/${resultado.total}<br>` +
                        `Errores: ${resultado.errores.length}`,
                        10000
                    );
                } else {
                    Espo.Ui.success(`¡Datos guardados exitosamente!<br>Total: ${resultado.guardadas} encuestas procesadas.`);
                }
                
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
                
                this.fetchPreguntasGuardadas().then(function(preguntasExistentes) {
                    preguntasExistentes.forEach(function(p) {
                        const key = `${p.categoria.toLowerCase()}::${p.texto.toLowerCase()}`;
                        mapaPreguntas[key] = p.id;
                    });
                    
                    if (nuevasPreguntasParaAgregar.length === 0) {
                        resolve(mapaPreguntas);
                        return;
                    }
                    
                    let procesadas = 0;
                    let erroresGuardado = [];
                    
                    const guardarPregunta = (index) => {
                        if (index >= nuevasPreguntasParaAgregar.length) {
                            if (erroresGuardado.length > 0) {
                                console.warn("Errores al guardar preguntas:", erroresGuardado);
                            }
                            resolve(mapaPreguntas);
                            return;
                        }
                        
                        const pregunta = nuevasPreguntasParaAgregar[index];
                        
                        this.getModelFactory().create('EncuestaLiderazgoPregunta', function(model) {
                            const nombreCorto = pregunta.texto.length > 50 
                                ? pregunta.texto.substring(0, 47) + '...'
                                : pregunta.texto;
                            
                            model.set({
                                name: nombreCorto,
                                pregunta: pregunta.texto,
                                tipo: pregunta.tipo,
                                categoriaLiderazgoId: mapaCategorias[pregunta.categoria],
                                activa: true
                            });
                            
                            model.save().then(function() {
                                const key = `${pregunta.categoria.toLowerCase()}::${pregunta.texto.toLowerCase()}`;
                                mapaPreguntas[key] = model.id;
                                procesadas++;
                                
                                setTimeout(() => {
                                    guardarPregunta(index + 1);
                                }, 50);
                                
                            }).catch(function(error) {
                                console.error("Error guardando pregunta:", error);
                                erroresGuardado.push(`Error en pregunta "${pregunta.texto}": ${error.message}`);
                                procesadas++;
                                
                                setTimeout(() => {
                                    guardarPregunta(index + 1);
                                }, 50);
                            });
                        }.bind(this));
                    };
                    
                    guardarPregunta(0);
                    
                }.bind(this)).catch(function(error) {
                    console.error("Error cargando preguntas existentes:", error);
                    reject(error);
                });
            }.bind(this));
        },

        guardarEncuestasYRespuestas: function(encuestasValidas, usuarioDefectoId, mapaPreguntas) {
            return new Promise(function(resolve, reject) {
                let errores = [];
                let encuestasGuardadas = 0;
                
                if (encuestasValidas.length === 0) {
                    resolve({ guardadas: 0, errores: [], total: 0 });
                    return;
                }
                
                let indiceActual = 0;
                
                const procesarSiguienteEncuesta = function() {
                    if (indiceActual >= encuestasValidas.length) {
                        resolve({ 
                            guardadas: encuestasGuardadas, 
                            errores: errores,
                            total: encuestasValidas.length 
                        });
                        return;
                    }
                    
                    const encuesta = encuestasValidas[indiceActual];
                    const numeroActual = indiceActual + 1;
                    
                    Espo.Ui.notify(`Guardando encuesta ${numeroActual} de ${encuestasValidas.length}...`, 'info');
                    
                    this.guardarEncuestaCompleta(encuesta, usuarioDefectoId, mapaPreguntas)
                        .then(() => {
                            encuestasGuardadas++;
                            indiceActual++;
                            // Pequeña pausa antes de la siguiente
                            setTimeout(() => procesarSiguienteEncuesta(), 50);
                        })
                        .catch(error => {
                            errores.push('Fila ' + encuesta.numeroFila + ': ' + error.message);
                            indiceActual++;
                            setTimeout(() => procesarSiguienteEncuesta(), 50);
                        });
                    
                }.bind(this);
                
                procesarSiguienteEncuesta();
            }.bind(this));
        },
        
        guardarEncuestaCompleta: function(encuesta, usuarioDefectoId, mapaPreguntas) {
            return new Promise(function(resolve, reject) {
                this.buscarUsuarioPorNombre(encuesta.liderEvaluado).then(function(usuarioEvaluado) {
                    if (!usuarioEvaluado || !usuarioEvaluado.id) {
                        reject(new Error('Usuario "' + encuesta.liderEvaluado + '" no encontrado'));
                        return;
                    }
                    
                    this.getModelFactory().create('EncuestaLiderazgo', function(model) {
                        const datos = {
                            name: 'Evaluación ' + encuesta.liderEvaluado + ' - ' + encuesta.fecha,
                            fecha: encuesta.fecha,
                            usuarioId: usuarioDefectoId,
                            usuarioEvaluadoId: usuarioEvaluado.id
                        };
                        
                        if (usuarioEvaluado.claTeamId) datos.claTeamId = usuarioEvaluado.claTeamId;
                        if (usuarioEvaluado.oficinaTeamId) datos.oficinaTeamId = usuarioEvaluado.oficinaTeamId;
                        
                        model.set(datos);
                        
                        model.save().then(function() {
                            const encuestaId = model.id;
                            console.log(`Encuesta ${encuestaId} guardada, guardando ${encuesta.respuestas.length} respuestas...`);
                            
                            // Guardar respuestas en lotes pequeños
                            this.guardarRespuestasEnLotes(encuestaId, encuesta.respuestas, mapaPreguntas)
                                .then(function() {
                                    console.log(`Respuestas de encuesta ${encuestaId} guardadas exitosamente`);
                                    resolve();
                                })
                                .catch(reject);
                                
                        }.bind(this)).catch(reject);
                    }.bind(this));
                }.bind(this)).catch(reject);
            }.bind(this));
        },
        
        guardarRespuestasEnLotes: function(encuestaId, respuestas, mapaPreguntas) {
            return new Promise(function(resolve, reject) {
                if (respuestas.length === 0) {
                    resolve();
                    return;
                }
                
                // Procesar respuestas en lotes de 20
                const LOTE_SIZE = 20;
                let indiceActual = 0;
                let respuestasGuardadas = 0;
                
                const procesarSiguienteLote = function() {
                    if (indiceActual >= respuestas.length) {
                        console.log(`Total respuestas guardadas: ${respuestasGuardadas}/${respuestas.length}`);
                        resolve();
                        return;
                    }
                    
                    const loteFin = Math.min(indiceActual + LOTE_SIZE, respuestas.length);
                    const loteActual = respuestas.slice(indiceActual, loteFin);
                    
                    const promesasLote = loteActual.map(respuesta => {
                        return new Promise(function(resolveRespuesta) {
                            const key = `${respuesta.categoria.toLowerCase()}::${respuesta.pregunta.toLowerCase()}`;
                            const preguntaId = mapaPreguntas[key];
                            
                            if (!preguntaId) {
                                resolveRespuesta();
                                return;
                            }
                            
                            this.getModelFactory().create('EncuestaLiderazgoRespuesta', function(model) {
                                const datos = {
                                    encuestaLiderazgoId: encuestaId,
                                    preguntaId: preguntaId
                                };
                                
                                if (respuesta.tipo === 'seleccion_simple') {
                                    datos.seleccion = parseInt(respuesta.valor, 10);
                                } else {
                                    datos.texto = respuesta.valor;
                                }
                                
                                model.set(datos);
                                model.save()
                                    .then(() => {
                                        respuestasGuardadas++;
                                        resolveRespuesta();
                                    })
                                    .catch((error) => {
                                        console.error('Error guardando respuesta:', error);
                                        resolveRespuesta(); // Continuar aunque falle
                                    });
                                
                            }.bind(this));
                        }.bind(this));
                    });
                    
                    Promise.all(promesasLote).then(() => {
                        indiceActual = loteFin;
                        // Pequeña pausa entre lotes de respuestas
                        setTimeout(() => procesarSiguienteLote(), 100);
                    }).catch(() => {
                        indiceActual = loteFin;
                        setTimeout(() => procesarSiguienteLote(), 100);
                    });
                    
                }.bind(this);
                
                procesarSiguienteLote();
            }.bind(this));
        },
        
        buscarUsuarioPorNombre: function(nombre) {
            return new Promise(function(resolve, reject) {
                if (!nombre || !nombre.trim()) {
                    resolve(null);
                    return;
                }
                
                const nombreLimpio = nombre.trim();
                
                this.getCollectionFactory().create('User', function(collection) {
                    collection.fetch({
                        data: {
                            where: [
                                { type: 'equals', attribute: 'name', value: nombreLimpio }
                            ],
                            maxSize: 1
                        }
                    }).then(function() {
                        if (collection.length > 0) {
                            const usuarioEncontrado = collection.at(0);
                            const teamsIds = usuarioEncontrado.get('teamsIds') || [];
                            
                            if (teamsIds.length === 0) {
                                usuarioEncontrado.fetch().then(function() {
                                    const teamsCompletos = usuarioEncontrado.get('teamsIds') || [];
                                    
                                    let claTeamId = null;
                                    let oficinaTeamId = null;
                                    
                                    teamsCompletos.forEach(function(teamId) {
                                        if (teamId && (teamId.startsWith('CLA') || teamId.toLowerCase().includes('cla'))) {
                                            claTeamId = teamId;
                                        } else if (teamId && !oficinaTeamId) {
                                            oficinaTeamId = teamId;
                                        }
                                    });
                                    
                                    resolve({
                                        id: usuarioEncontrado.id,
                                        name: usuarioEncontrado.get('name'),
                                        claTeamId: claTeamId,
                                        oficinaTeamId: oficinaTeamId
                                    });
                                }).catch(function(error) {
                                    console.error('Error cargando usuario completo:', error);
                                    resolve({
                                        id: usuarioEncontrado.id,
                                        name: usuarioEncontrado.get('name'),
                                        claTeamId: null,
                                        oficinaTeamId: null
                                    });
                                });
                            } else {
                                let claTeamId = null;
                                let oficinaTeamId = null;
                                
                                teamsIds.forEach(function(teamId) {
                                    if (teamId && (teamId.startsWith('CLA') || teamId.toLowerCase().includes('cla'))) {
                                        claTeamId = teamId;
                                    } else if (teamId && !oficinaTeamId) {
                                        oficinaTeamId = teamId;
                                    }
                                });
                                
                                resolve({
                                    id: usuarioEncontrado.id,
                                    name: usuarioEncontrado.get('name'),
                                    claTeamId: claTeamId,
                                    oficinaTeamId: oficinaTeamId
                                });
                            }
                        } else {
                            resolve(null);
                        }
                    }.bind(this)).catch(function(error) {
                        console.error('Error en búsqueda de usuario:', error);
                        resolve(null);
                    });
                }.bind(this));
            }.bind(this));
        },
        
    });
});