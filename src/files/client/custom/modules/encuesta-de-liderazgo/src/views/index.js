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
            
            // Crear iframe para mostrar el reporte
            var reportPath = this.obtenerRutaReporte(reportId);
            
            this.createView('iframe-view', 'views/iframe', {
                url: reportPath,
                name: reportLabel
            }, function(view) {
                this.$el.find('.record-container').hide();
                this.$el.append('<div class="report-iframe-container"></div>');
                view.setElement(this.$el.find('.report-iframe-container'));
                view.render();
            }.bind(this));
        },

        obtenerRutaReporte: function(reportId) {
            var basePath = 'client/custom/modules/encuesta-de-liderazgo/res/reportes/';
            
            if (reportId === 'evaluacion-general') {
                return basePath + 'evaluacion-general.html';
            }
            
            // Para reportes de categorías, pasar parámetros en la URL
            var categoria = reportId.replace('detalle-', '');
            return basePath + 'categoria-detalle.html?cat=' + encodeURIComponent(categoria);
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

            // PASO 1: Cargar preguntas desde la BD con paginación
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
                const maxSize = 200; // Tamaño del lote
                let todasLasPreguntas = [];
                
                const fetchPage = (offset) => {
                    this.getCollectionFactory().create('EncuestaLiderazgoPregunta', function(collection) {
                        collection.maxSize = maxSize;
                        collection.offset = offset;
                        
                        collection.fetch().then(function() {
                            const models = collection.models || [];
                            
                            // Procesar las preguntas del lote actual
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
                            
                            // Si cargamos menos del máximo, significa que no hay más páginas
                            if (models.length < maxSize || todasLasPreguntas.length >= collection.total) {
                                resolve(todasLasPreguntas);
                            } else {
                                // Cargar siguiente página
                                fetchPage(offset + maxSize);
                            }
                            
                        }.bind(this)).catch(function(error) {
                            console.error('Error cargando lote de preguntas:', error);
                            // Devolver lo que se haya cargado hasta ahora
                            resolve(todasLasPreguntas);
                        });
                    }.bind(this));
                };
                
                // Iniciar con la primera página
                fetchPage(0);
                
            }.bind(this));
        },

        gestionarPreguntas: function(preguntasDelCSV, preguntasGuardadas, lineasDeDatos, headers) {
            const uniqueKey = p => `${p.categoria.toLowerCase()}::${p.texto.toLowerCase()}`;

            // CASO A: No hay preguntas en el sistema
            if (preguntasGuardadas.length === 0) {
                if (lineasDeDatos.length < 3) {
                    return { esValido: false, error: "Se necesitan al menos 3 registros de datos en el CSV para determinar el tipo de las nuevas preguntas." };
                }
                preguntasDelCSV.forEach(p => {
                    p.tipo = this.determinarTipoPreguntaPorMuestreo(p, lineasDeDatos, headers);
                });
                return { esValido: true, todasLasPreguntas: preguntasDelCSV, nuevasPreguntasParaAgregar: preguntasDelCSV };
            }

            // CASO B: Hay preguntas en el sistema
            const preguntasGuardadasMap = new Map();
            preguntasGuardadas.forEach(function(p) {
                preguntasGuardadasMap.set(uniqueKey(p), p);
            });
            
            const preguntasCSVUnicas = new Set(preguntasDelCSV.map(uniqueKey));

            // Validar que todas las preguntas del sistema estén en el CSV
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

            // Identificar preguntas nuevas (las que están en CSV pero NO en BD)
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

            // Combinar preguntas guardadas con las nuevas (sin duplicados)
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
                // PASO 1: Verificar/Crear usuario por defecto "0"
                const usuarioDefectoId = await this.obtenerOCrearUsuarioDefecto();
                
                // PASO 2: Guardar categorías nuevas y obtener mapeo id
                const mapaCategorias = await this.guardarCategorias(preguntasDelCSV);
                
                // PASO 3: Guardar preguntas nuevas y obtener mapeo completo
                const mapaPreguntas = await this.guardarPreguntas(nuevasPreguntasParaAgregar, mapaCategorias);
                
                // PASO 4: Guardar encuestas y respuestas
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
                
                // Primero cargar TODAS las preguntas existentes
                this.fetchPreguntasGuardadas().then(function(preguntasExistentes) {
                    console.log("Preguntas existentes cargadas para mapeo:", preguntasExistentes.length);
                    
                    preguntasExistentes.forEach(function(p) {
                        const key = `${p.categoria.toLowerCase()}::${p.texto.toLowerCase()}`;
                        mapaPreguntas[key] = p.id;
                    });
                    
                    console.log("Mapa de preguntas existentes creado con", Object.keys(mapaPreguntas).length, "entradas");
                    
                    if (nuevasPreguntasParaAgregar.length === 0) {
                        console.log("No hay preguntas nuevas para agregar, usando solo las existentes");
                        resolve(mapaPreguntas);
                        return;
                    }
                    
                    console.log("Guardando", nuevasPreguntasParaAgregar.length, "preguntas nuevas...");
                    
                    let procesadas = 0;
                    let erroresGuardado = [];
                    
                    // Función para guardar una pregunta individual
                    const guardarPregunta = (index) => {
                        if (index >= nuevasPreguntasParaAgregar.length) {
                            console.log("Todas las preguntas nuevas guardadas. Total en mapa:", Object.keys(mapaPreguntas).length);
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
                                console.log(`Pregunta guardada ${procesadas}/${nuevasPreguntasParaAgregar.length}: ${nombreCorto}`);
                                
                                // Pequeño delay antes de guardar la siguiente pregunta
                                setTimeout(() => {
                                    guardarPregunta(index + 1);
                                }, 50); // 50ms de delay entre preguntas
                                
                            }).catch(function(error) {
                                console.error("Error guardando pregunta:", error);
                                erroresGuardado.push(`Error en pregunta "${pregunta.texto}": ${error.message}`);
                                procesadas++;
                                
                                // Continuar con la siguiente pregunta aunque falle
                                setTimeout(() => {
                                    guardarPregunta(index + 1);
                                }, 50);
                            });
                        }.bind(this));
                    };
                    
                    // Iniciar el proceso en serie
                    guardarPregunta(0);
                    
                }.bind(this)).catch(function(error) {
                    console.error("Error cargando preguntas existentes:", error);
                    reject(error);
                });
            }.bind(this));
        },

        guardarEncuestasYRespuestas: function(encuestasValidas, usuarioDefectoId, mapaPreguntas) {
            return new Promise(function(resolve, reject) {
                let procesadas = 0;
                let errores = [];
                let encuestasGuardadas = 0;
                
                if (encuestasValidas.length === 0) {
                    resolve({ guardadas: 0, errores: [] });
                    return;
                }
                
                const procesarEncuesta = function(encuesta, index) {
                    return new Promise(function(resolveEncuesta, rejectEncuesta) {
                        // Agregar delay entre encuestas
                        setTimeout(function() {
                            this.buscarUsuarioPorNombre(encuesta.liderEvaluado).then(function(usuarioEvaluado) {
                                if (!usuarioEvaluado || !usuarioEvaluado.id) {
                                    errores.push('Fila ' + encuesta.numeroFila + ': Usuario "' + encuesta.liderEvaluado + '" no encontrado.');
                                    resolveEncuesta();
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
                                        encuestasGuardadas++;
                                        
                                        // Guardar respuestas con más delay
                                        setTimeout(function() {
                                            this.guardarRespuestasEnLotes(encuestaId, encuesta.respuestas, mapaPreguntas).then(function() {
                                                resolveEncuesta();
                                            }).catch(function(error) {
                                                console.error('Error guardando respuestas:', error);
                                                errores.push('Fila ' + encuesta.numeroFila + ': Error al guardar respuestas.');
                                                resolveEncuesta();
                                            });
                                        }.bind(this), 100);
                                        
                                    }.bind(this)).catch(function(error) {
                                        console.error('Error guardando encuesta:', error);
                                        errores.push('Fila ' + encuesta.numeroFila + ': Error al guardar encuesta.');
                                        resolveEncuesta();
                                    });
                                }.bind(this));
                            }.bind(this)).catch(function(error) {
                                console.error('Error buscando usuario:', error);
                                errores.push('Fila ' + encuesta.numeroFila + ': Error buscando usuario.');
                                resolveEncuesta();
                            });
                        }.bind(this), index * 500); // Delay progresivo entre encuestas
                    }.bind(this));
                }.bind(this);
                
                // Procesar encuestas en serie para evitar sobrecarga
                const procesarEnSerie = function(index) {
                    if (index >= encuestasValidas.length) {
                        resolve({ 
                            guardadas: encuestasGuardadas, 
                            errores: errores,
                            total: encuestasValidas.length 
                        });
                        return;
                    }
                    
                    Espo.Ui.notify(`Guardando encuesta ${index + 1} de ${encuestasValidas.length}...`, 'info');

                    procesarEncuesta(encuestasValidas[index], index).then(function() {
                        procesarEnSerie(index + 1);
                    });
                };
                
                // Iniciar el procesamiento en serie
                procesarEnSerie(0);
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
                            
                            // Obtener los teams del usuario - usar la relación directamente
                            const teamsIds = usuarioEncontrado.get('teamsIds') || [];
                            
                            // Si no hay teams en la relación directa, intentar cargar el usuario completo
                            if (teamsIds.length === 0) {
                                usuarioEncontrado.fetch().then(function() {
                                    const teamsCompletos = usuarioEncontrado.get('teamsIds') || [];
                                    
                                    let claTeamId = null;
                                    let oficinaTeamId = null;
                                    
                                    teamsCompletos.forEach(function(teamId) {
                                        if (teamId && (teamId.startsWith('CLA') || teamId.toLowerCase().includes('cla'))) {
                                            claTeamId = teamId;
                                        } else if (teamId && !oficinaTeamId) {
                                            // El primer team que no sea CLA es la oficina
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
                                        // El primer team que no sea CLA es la oficina
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

        guardarRespuestasEnLotes: function(encuestaId, respuestas, mapaPreguntas) {
            return new Promise(function(resolve, reject) {
                let procesadas = 0;
                let errores = [];
                
                if (respuestas.length === 0) {
                    resolve();
                    return;
                }
                
                const guardarRespuestaIndividual = function(respuesta, index) {
                    return new Promise(function(resolveIndividual, rejectIndividual) {
                        const key = `${respuesta.categoria.toLowerCase()}::${respuesta.pregunta.toLowerCase()}`;
                        const preguntaId = mapaPreguntas[key];
                        
                        if (!preguntaId) {
                            resolveIndividual();
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
                            
                            // Agregar timeout para evitar sobrecarga
                            setTimeout(function() {
                                model.save().then(function() {
                                    resolveIndividual();
                                }).catch(function(error) {
                                    console.error('Error guardando respuesta:', error);
                                    errores.push(`Error en respuesta ${index + 1}: ${error.message}`);
                                    resolveIndividual(); // Resolver igual para continuar
                                });
                            }, 50 * index); // Espaciar las requests
                            
                        }.bind(this));
                    }.bind(this));
                }.bind(this);
                
                // Crear un array de promesas para todas las respuestas
                const promesas = [];
                respuestas.forEach(function(respuesta, index) {
                    promesas.push(guardarRespuestaIndividual(respuesta, index));
                });
                
                // Esperar a que todas las respuestas se procesen
                Promise.all(promesas).then(function() {
                    resolve();
                }).catch(function(error) {
                    console.error('Error en guardado de respuestas:', error);
                    resolve(); // Resolver igual para no bloquear el proceso
                });
            }.bind(this));
        }
        
    });
});