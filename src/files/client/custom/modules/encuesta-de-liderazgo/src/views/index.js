define('encuesta-de-liderazgo:views/index', ['view'], function (Dep) {
    
    return Dep.extend({
        
        template: 'encuesta-de-liderazgo:/index',
        
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
            // Verificar si la entidad existe en los metadatos para evitar errores 404
            if (!this.getMetadata().get('scopes.EncuestaLiderazgoCategoria')) {
                console.log('La entidad EncuestaLiderazgoCategoria no existe, se omitirá la carga de reportes por categoría.');
                this.wait(false);
                return;
            }

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
                    this.reRender(); // Re-renderizar para mostrar los nuevos reportes
                }.bind(this)).catch(function(xhr) {
                    // Si el error es 404, es el problema del controlador que no existe.
                    if (xhr.status === 404) {
                        console.warn("ADVERTENCIA: No se pudieron cargar las categorías de reportes. La entidad 'EncuestaLiderazgoCategoria' no tiene una API activa en el backend. Por favor, verifica que la entidad exista y ejecuta un Rebuild exitoso en EspoCRM.");
                    } else {
                        // Para otros posibles errores (ej. 500, timeout, etc.)
                        console.error('Error inesperado al cargar categorías para reportes:', xhr);
                    }
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
            // Parsear CSV usando punto y coma como delimitador
            var todasLasLineas = contenidoCSV.split('\n').filter(l => l.trim());
            
            if (todasLasLineas.length < 2) {
                Espo.Ui.error('El archivo CSV está vacío o no tiene datos.');
                this.wait(false);
                return;
            }
            
            var headers = this.parsearLineaCSV(todasLasLineas[0]);
            var lineasDeDatos = todasLasLineas.slice(1);

            // PASO 1: Cargar preguntas desde el sistema (simulado)
            const preguntasGuardadas = await this._simularFetchPreguntasGuardadas();

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
                Espo.Ui.warning(mensajeError, 10000); // Mostrar por 10 segundos
                console.warn('Errores de fila en CSV:', erroresDeFila);
            }

            if (encuestasValidas.length === 0) {
                Espo.Ui.error('No se encontraron filas de datos válidas en el archivo CSV después de las validaciones.');
                this.wait(false);
                return;
            }

            // Mostrar el preview final
            this.mostrarPreview(encuestasValidas, preguntasDelCSV, nuevasPreguntasParaAgregar.length);
        },

        gestionarPreguntas: function(preguntasDelCSV, preguntasGuardadas, lineasDeDatos, headers) {
            const uniqueKey = p => `${p.categoria}::${p.texto}`;

            // CASO A: No hay preguntas en el sistema
            if (preguntasGuardadas.length === 0) {
                console.log("No hay preguntas guardadas. Se intentarán agregar todas las del CSV.");
                if (lineasDeDatos.length < 3) {
                    return { esValido: false, error: "Se necesitan al menos 3 registros de datos en el CSV para determinar el tipo de las nuevas preguntas." };
                }
                // Determinar tipo para todas las preguntas del CSV
                preguntasDelCSV.forEach(p => {
                    p.tipo = this.determinarTipoPreguntaPorMuestreo(p, lineasDeDatos, headers);
                });
                console.log("Tipos determinados para nuevas preguntas:", preguntasDelCSV);
                return { esValido: true, todasLasPreguntas: preguntasDelCSV, nuevasPreguntasParaAgregar: preguntasDelCSV };
            }

            // CASO B: Hay preguntas en el sistema
            const preguntasGuardadasUnicas = new Set(preguntasGuardadas.map(uniqueKey));
            const preguntasCSVUnicas = new Set(preguntasDelCSV.map(uniqueKey));

            // Validar que todas las preguntas del sistema estén en el CSV
            for (const preguntaGuardada of preguntasGuardadas) {
                if (!preguntasCSVUnicas.has(uniqueKey(preguntaGuardada))) {
                    return { esValido: false, error: `Validación fallida: El archivo CSV no contiene la pregunta requerida "${preguntaGuardada.texto}" en la categoría "${preguntaGuardada.categoria}".` };
                }
            }

            // Identificar preguntas nuevas para agregar
            let nuevasPreguntas = preguntasDelCSV.filter(p => !preguntasGuardadasUnicas.has(uniqueKey(p)));
            let nuevasPreguntasParaAgregar = [];
            
            if (nuevasPreguntas.length > 0) {
                if (lineasDeDatos.length < 3) {
                    Espo.Ui.warning("Se encontraron preguntas nuevas en el CSV, pero se ignorarán porque se necesitan al menos 3 registros de datos para procesarlas.", 7000);
                } else {
                    // Determinar tipo para las nuevas preguntas
                    nuevasPreguntas.forEach(p => {
                        p.tipo = this.determinarTipoPreguntaPorMuestreo(p, lineasDeDatos, headers);
                    });
                    nuevasPreguntasParaAgregar = nuevasPreguntas;
                    console.log("Nuevas preguntas a agregar (con tipo determinado):", nuevasPreguntasParaAgregar);
                }
            }

            const todasLasPreguntas = preguntasGuardadas.concat(nuevasPreguntasParaAgregar);
            return { esValido: true, todasLasPreguntas, nuevasPreguntasParaAgregar };
        },

        determinarTipoPreguntaPorMuestreo: function(pregunta, lineasDeDatos, headers) {
            const indicePregunta = headers.indexOf(pregunta.headerOriginal);
            if (indicePregunta === -1) return 'texto'; // Fallback

            const muestras = lineasDeDatos.slice(0, 10); // Tomar hasta 10 muestras
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

            // La que tenga más votos gana. En caso de empate, prioriza seleccion_simple.
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
            
            // Formato: 3/22/2025 13:47:42 -> 2025-03-22
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
            
            headers.forEach(function(header) {
                if (!header.trim()) {
                    return; // Omitir headers vacíos
                }
                
                var categoria = 'General';
                let textoPregunta = header;
                
                // Encontrar dónde empiezan las preguntas (después de las 4 columnas base)
                const indiceTimestamp = this.encontrarIndiceColumna(headers, ['timestamp', 'fecha']);
                const indiceCLA = this.encontrarIndiceColumna(headers, ['cla', 'cla pertenece']);
                const indiceOficina = this.encontrarIndiceColumna(headers, ['oficina', 'oficinas']);
                const indiceLider = this.encontrarIndiceColumna(headers, ['lider', 'líder', 'lider a evaluar']);
                const indiceInicioPrguntas = Math.max(indiceTimestamp, indiceCLA, indiceOficina, indiceLider) + 1;
                
                // Intentar extraer categoría si está en formato "Categoria: [Pregunta]"
                const match = header.match(/^(.+?):\s*\[(.+?)\]$/);
                
                if (match) {
                    categoria = this.normalizarTexto(match[1]);
                    textoPregunta = this.normalizarTexto(match[2]);
                } else {
                    textoPregunta = this.normalizarTexto(header);
                }
                
                if (headers.indexOf(header) >= indiceInicioPrguntas) {
                    preguntas.push({
                        categoria: categoria,
                        texto: textoPregunta,
                        headerOriginal: header
                    });
                }
            }.bind(this));
            console.log('Preguntas extraídas:', preguntas);
            return preguntas;
        },
        
        normalizarTexto: function(texto) {
            if (!texto) return '';
            
            // Formato de oración: primera letra en mayúscula, el resto en minúscula.
            texto = texto.trim().toLowerCase();
            if (texto.length === 0) return texto;

            // Capitaliza la primera letra y une el resto.
            // También capitaliza la letra después de un punto y un espacio.
            texto = texto.charAt(0).toUpperCase() + texto.slice(1);
            return texto.replace(/([.?!])\s*([a-z])/g, (match, punc, char) => `${punc} ${char.toUpperCase()}`);
        },
        
        determinarTipoRespuesta: function(valor) {
            if (!valor) return 'texto';
            
            var valorTrim = valor.trim();
            
            // Si parece un número entero, lo tratamos como selección simple para la validación posterior.
            if (/^\d+$/.test(valorTrim)) {
                return 'seleccion_simple';
            }
            
            return 'texto';
        },
        
        _simularFetchPreguntasGuardadas: function() {
            console.log("Simulando fetch de preguntas guardadas en la BD...");
            
            // Devuelve una promesa para simular una llamada asíncrona
            return new Promise(function(resolve) {
                // CASO 1: No hay preguntas en la BD
                // resolve([]);
                
                // CASO 2: Ya hay 4 preguntas en la BD
                var preguntasSimuladas = [
                    { texto: 'Comparte información de manera asertiva', categoria: 'Comunicación', tipo: 'seleccion_simple' },
                    { texto: 'Escucha activamente y es receptivo a las opiniones del equipo', categoria: 'Comunicación', tipo: 'seleccion_simple' },
                    { texto: 'Presta y demuestra atención plena en las conversaciones', categoria: 'Comunicación', tipo: 'seleccion_simple' },
                    { texto: 'Expresa sus ideas con claridad y respeto a otras personas', categoria: 'Comunicación', tipo: 'seleccion_simple' }
                ];
                
                console.log("Preguntas simuladas desde BD:", preguntasSimuladas);
                resolve(preguntasSimuladas);
            });
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
                const numeroFila = index + 2; // +1 por el header, +1 por el índice base 0
                const valores = this.parsearLineaCSV(linea);

                if (valores.length !== headers.length) {
                    erroresDeFila.push(`Fila ${numeroFila}: Se omitió porque tiene ${valores.length} columnas en lugar de las ${headers.length} esperadas.`);
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

                    // Solo procesar y validar si la pregunta existe en nuestro set final de preguntas
                    if (tipoEsperado) {
                        // Validar rango para selección simple
                        if (tipoEsperado === 'seleccion_simple' && valorRespuesta) {
                            const valorNumerico = parseInt(valorRespuesta.trim(), 10);
                            if (isNaN(valorNumerico) || valorNumerico < 1 || valorNumerico > 4) {
                                erroresDeFila.push(`Fila ${numeroFila}: Valor inválido ('${valorRespuesta}') para la pregunta "${preguntaInfo.texto}". Se omitió la fila.`);
                                esFilaValida = false;
                                break;
                            }
                        }
                        
                        // Si la pregunta es válida, agregar su respuesta
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

        mostrarPreview: function(datosEncuestas, preguntasInfo, totalPreguntasParaAgregar) {
            // Calcular estadísticas
            var categoriasUnicas = new Set();
            var preguntasUnicas = new Set();
            var totalRespuestas = 0;
            const uniqueKey = p => `${p.categoria}::${p.texto}`;
            
            preguntasInfo.forEach(function(p) {
                categoriasUnicas.add(p.categoria);
                preguntasUnicas.add(uniqueKey(p));
            }.bind(this));
            
            datosEncuestas.forEach(function(e) {
                totalRespuestas += e.respuestas.length;
            });
            
            this.datosPreview = {
                totalEncuestas: datosEncuestas.length, // Encuestas que pasaron todas las validaciones
                categoriasUnicas: categoriasUnicas.size,
                preguntasUnicasEnCSV: preguntasUnicas.size, // Total de preguntas únicas en el archivo
                preguntasParaAgregar: totalPreguntasParaAgregar, // Preguntas que no existen en la BD
                totalRespuestas: totalRespuestas // Total de respuestas en las encuestas válidas
            };
            
            // Generar tabla de preview
            this.tablaPreviewHTML = this.generarTablaPreview(datosEncuestas);
            this.mostrarPreviewTabla = true;
            
            this.wait(false);
            this.reRender();
            
            Espo.Ui.success('CSV procesado y validado correctamente. Revisa el preview abajo.');
        },
        
        generarTablaPreview: function(datosEncuestas) {
            var html = '<table class="table table-bordered preview-table">';
            html += '<thead><tr>';
            html += '<th>Fecha</th>';
            html += '<th>CLA</th>';
            html += '<th>Oficina</th>';
            html += '<th>Líder Evaluado</th>';
            html += '<th>Total Respuestas</th>';
            html += '</tr></thead>';
            html += '<tbody>';
            
            datosEncuestas.forEach(function(encuesta) {
                html += '<tr>';
                html += '<td>' + encuesta.fecha + '</td>';
                html += '<td>' + encuesta.cla + '</td>';
                html += '<td>' + encuesta.oficina + '</td>';
                html += '<td>' + encuesta.liderEvaluado + '</td>';
                html += '<td>' + encuesta.respuestas.length + '</td>';
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            
            return html;
        }
        
    });
});