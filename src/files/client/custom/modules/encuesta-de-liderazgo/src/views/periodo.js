// client/custom/modules/encuesta-de-liderazgo/src/views/periodo.js
define('encuesta-de-liderazgo:views/periodo', ['view'], function (View) {

    return View.extend({

        template: 'encuesta-de-liderazgo:periodo',

        events: {
            'change #el-fecha-inicio': function () { this.validarFechas(); },
            'change #el-fecha-fin': function () { this.validarFechas(); },
            'keyup #el-buscador-lideres': function (e) { this.filtrarLideres(e.currentTarget.value); },
            'click [data-action="guardarPeriodo"]': function () { this.guardarPeriodo(); },
            'change .el-oficina-especial-check': function (e) {
                var $check = $(e.currentTarget);
                var teamId = $check.data('team-id');
                if (!this.oficinasEspecialesEstado[teamId]) this.oficinasEspecialesEstado[teamId] = {};
                this.oficinasEspecialesEstado[teamId].activada = $check.is(':checked');
                this._renderOficinasEspeciales();
            },
            'input .el-oficina-especial-limite-input': function (e) {
                var $input = $(e.currentTarget);
                var teamId = $input.data('team-id');
                if (!this.oficinasEspecialesEstado[teamId]) this.oficinasEspecialesEstado[teamId] = {};
                this.oficinasEspecialesEstado[teamId].limite = $input.val();
                this._validarLimiteOficina(teamId);
            },
            'keyup #el-buscador-oficinas': function (e) {
                this.oficinasFiltro = e.currentTarget.value || '';
                this.oficinasPagina = 1;
                this._renderOficinasEspeciales();
            },
            'click [data-oficinas-pagina]': function (e) {
                this.oficinasPagina = parseInt($(e.currentTarget).data('oficinas-pagina'), 10);
                this._renderOficinasEspeciales();
            }
        },

        setup: function () {
            this.periodoId = this._obtenerPeriodoIdDeQuery();
            this.esEdicion = !!this.periodoId;
            this.lideres = [];
            this.estadosGuardados = {}; // userId -> activo(bool), solo en edición
            this.bloqueadosParaDesactivar = {}; // userId -> true, ya evaluado por alguien
            this.oficinasEspecialesLimiteOriginal = {}; // teamId -> limite guardado (no puede bajar)
            this.oficinasEspecialesEstado = {}; // teamId -> {activada, limite}
            this.oficinasFiltro = '';
            this.oficinasPagina = 1;
            this.OFICINAS_POR_PAGINA = 8;
            this.fechaInicio = '';
            this.fechaFin = '';
        },

        data: function () {
            return {
                esEdicion: this.esEdicion,
                fechaInicio: this.fechaInicio,
                fechaFin: this.fechaFin
            };
        },

        afterRender: function () {
            this.$fechaInicio = this.$el.find('#el-fecha-inicio');
            this.$fechaFin = this.$el.find('#el-fecha-fin');
            this.$fechasError = this.$el.find('#el-fechas-error');
            this.$tbody = this.$el.find('#el-lideres-tbody');
            this.$contador = this.$el.find('#el-lideres-contador');
            this.$oficinasWrap = this.$el.find('#el-oficinas-especiales-wrap');
            this.$oficinasPaginacion = this.$el.find('#el-oficinas-paginacion');
            this.$oficinasContador = this.$el.find('#el-oficinas-contador');

            this._cargarDatos();
        },

        _obtenerPeriodoIdDeQuery: function () {
            var hash = window.location.hash || '';
            var qIndex = hash.indexOf('?');
            if (qIndex === -1) return null;

            var queryString = hash.substring(qIndex + 1);
            var params = {};
            queryString.split('&').forEach(function (pair) {
                var partes = pair.split('=');
                if (partes[0]) params[decodeURIComponent(partes[0])] = decodeURIComponent(partes[1] || '');
            });

            return params.periodoId || null;
        },

        _cargarDatos: function () {
            this.notify('Cargando...');

            var promesas = [Espo.Ajax.getRequest('EncuestaLiderazgoEncuesta/action/getLideresDisponibles')];

            if (this.esEdicion) {
                promesas.push(this._cargarPeriodoExistente());
                promesas.push(Espo.Ajax.getRequest('EncuestaLiderazgoEncuesta/action/getPeriodoLideres', {
                    periodoId: this.periodoId
                }));
                promesas.push(Espo.Ajax.getRequest('EncuestaLiderazgoEncuesta/action/getOficinasEspeciales', {
                    periodoId: this.periodoId
                }));
            }

            Promise.all(promesas).then(function (resultados) {
                this.notify(false);

                var lideresResp = resultados[0];
                if (!lideresResp || !lideresResp.success) {
                    Espo.Ui.error('No se pudo cargar la lista de líderes.');
                    return;
                }
                this.lideres = lideresResp.data || [];

                if (this.esEdicion) {
                    var estadosResp = resultados[2];
                    if (estadosResp && estadosResp.success) {
                        (estadosResp.data || []).forEach(function (e) {
                            this.estadosGuardados[e.userId] = e.activo;
                            if (e.bloqueadoParaDesactivar) {
                                this.bloqueadosParaDesactivar[e.userId] = true;
                            }
                        }.bind(this));
                    }

                    var oficinasResp = resultados[3];
                    if (oficinasResp && oficinasResp.success) {
                        (oficinasResp.data || []).forEach(function (o) {
                            this.oficinasEspecialesLimiteOriginal[o.teamId] = o.limite;
                            this.oficinasEspecialesEstado[o.teamId] = {activada: true, limite: o.limite};
                        }.bind(this));
                    }
                }

                this._renderTabla(this.lideres);
                this._renderOficinasEspeciales();
            }.bind(this)).catch(function () {
                this.notify(false);
                Espo.Ui.error('Ocurrió un error al cargar los datos del periodo.');
            }.bind(this));
        },

        _cargarPeriodoExistente: function () {
            return this.getModelFactory().create('EncuestaLiderazgoEncuesta', function (model) {
                model.id = this.periodoId;
                return model.fetch().then(function () {
                    this.fechaInicio = model.get('fechaInicio');
                    this.fechaFin = model.get('fechaFin');

                    if (this.isRendered()) {
                        this.$fechaInicio.val(this.fechaInicio);
                        this.$fechaFin.val(this.fechaFin);
                    }
                }.bind(this));
            }.bind(this));
        },

        _renderTabla: function (lideres) {
            if (!lideres.length) {
                this.$tbody.html('<tr><td colspan="4" style="text-align:center; padding:30px;">' +
                    'No se encontraron usuarios con rol gerente, director o coordinador.</td></tr>');
                this.$contador.text('0 líderes');
                return;
            }

            var filas = lideres.map(function (l) {
                var activoDefault = this.esEdicion
                    ? (this.estadosGuardados.hasOwnProperty(l.id) ? this.estadosGuardados[l.id] : true)
                    : true;
                var bloqueado = !!this.bloqueadosParaDesactivar[l.id];

                var rolesHtml = (l.roles || []).map(function (r) {
                    return '<span class="el-rol-badge">' + Handlebars.Utils.escapeExpression(r) + '</span>';
                }).join(' ');

                return '<tr data-user-id="' + l.id + '" data-team-id="' + (l.teamId || '') + '" data-team-name="' +
                    Handlebars.Utils.escapeExpression(l.teamName || '') + '" data-nombre="' +
                    Handlebars.Utils.escapeExpression((l.name + ' ' + l.teamName).toLowerCase()) + '"' +
                    (activoDefault ? '' : ' class="el-fila-inactiva"') + '>' +
                    '<td>' + Handlebars.Utils.escapeExpression(l.name) +
                        (bloqueado ? ' <i class="fas fa-lock" title="Ya fue evaluado por al menos un asesor: no se puede desactivar" style="color:#B9770E; font-size:11px;"></i>' : '') +
                    '</td>' +
                    '<td>' + Handlebars.Utils.escapeExpression(l.teamName || 'Sin oficina') + '</td>' +
                    '<td>' + rolesHtml + '</td>' +
                    '<td class="el-check-col">' +
                        '<input type="checkbox" class="el-check-activo" ' + (activoDefault ? 'checked' : '') +
                        (bloqueado ? ' disabled title="No se puede desactivar: ya fue evaluado"' : '') + '>' +
                    '</td>' +
                    '</tr>';
            }.bind(this)).join('');

            this.$tbody.html(filas);
            this.$contador.text(lideres.length + ' líder' + (lideres.length === 1 ? '' : 'es'));

            this.$tbody.off('change', '.el-check-activo').on('change', '.el-check-activo', function (e) {
                $(e.currentTarget).closest('tr').toggleClass('el-fila-inactiva', !e.currentTarget.checked);
                this._renderOficinasEspeciales();
            }.bind(this));
        },

        // ── Oficinas especiales ─────────────────────────────────────────

        _recalcularConteoOficinas: function () {
            var conteo = {}; // teamId -> {teamName, total}

            this.$tbody.find('tr[data-user-id]').each(function (i, el) {
                var $el = $(el);
                var teamId = $el.data('team-id');
                if (!teamId) return;

                var activo = $el.find('.el-check-activo').is(':checked');
                if (!activo) return;

                if (!conteo[teamId]) {
                    conteo[teamId] = {teamName: $el.data('team-name'), total: 0};
                }
                conteo[teamId].total++;
            });

            return conteo;
        },

        _renderOficinasEspeciales: function () {
            var conteo = this._recalcularConteoOficinas();
            var filtro = (this.oficinasFiltro || '').toLowerCase().trim();

            var teamIds = Object.keys(conteo).filter(function (teamId) {
                return !filtro || conteo[teamId].teamName.toLowerCase().indexOf(filtro) !== -1;
            });

            // Orden por cantidad de líderes, de mayor a menor.
            teamIds.sort(function (a, b) {
                return conteo[b].total - conteo[a].total;
            });

            this.$oficinasContador.text(teamIds.length + ' oficina' + (teamIds.length === 1 ? '' : 's'));

            if (!teamIds.length) {
                this.$oficinasWrap.html('<p style="text-align:center; color:#666; padding: 10px 0;">' +
                    'No hay oficinas que coincidan.</p>');
                this.$oficinasPaginacion.empty();
                return;
            }

            var totalPaginas = Math.max(Math.ceil(teamIds.length / this.OFICINAS_POR_PAGINA), 1);
            if (this.oficinasPagina > totalPaginas) this.oficinasPagina = totalPaginas;
            if (this.oficinasPagina < 1) this.oficinasPagina = 1;

            var inicio = (this.oficinasPagina - 1) * this.OFICINAS_POR_PAGINA;
            var teamIdsPagina = teamIds.slice(inicio, inicio + this.OFICINAS_POR_PAGINA);

            var html = teamIdsPagina.map(function (teamId) {
                var info = conteo[teamId];
                var estado = this.oficinasEspecialesEstado[teamId] || {};
                var activada = !!estado.activada;
                var limiteOriginal = this.oficinasEspecialesLimiteOriginal[teamId] || null;
                var limiteValor = (estado.limite !== undefined && estado.limite !== null) ? estado.limite : '';

                var minPermitido = limiteOriginal || 1;
                var maxPermitido = Math.max(info.total - 1, 1);

                return '<div class="el-oficina-especial-row' + (activada ? ' activa' : '') + '">' +
                    '<input type="checkbox" class="el-oficina-especial-check" data-team-id="' + teamId + '"' +
                        (activada ? ' checked' : '') + '>' +
                    '<span class="el-oficina-especial-nombre">' + Handlebars.Utils.escapeExpression(info.teamName) + '</span>' +
                    '<span class="el-oficina-especial-count">' + info.total + ' líder' + (info.total === 1 ? '' : 'es') + '</span>' +
                    '<div class="el-oficina-especial-limite">' +
                        '<label>Cada asesor evalúa:</label>' +
                        '<input type="number" class="el-oficina-especial-limite-input" data-team-id="' + teamId + '"' +
                            ' min="' + minPermitido + '" max="' + maxPermitido + '" value="' + limiteValor + '"' +
                            (activada ? '' : ' disabled') + '>' +
                    '</div>' +
                    '<span class="el-oficina-especial-error" id="el-oficina-error-' + teamId + '"></span>' +
                    '</div>';
            }.bind(this)).join('');

            this.$oficinasWrap.html(html);
            this._renderPaginacionOficinas(totalPaginas);

            // Revalidar los límites ya cargados contra los nuevos totales.
            teamIdsPagina.forEach(function (teamId) {
                if (this.oficinasEspecialesEstado[teamId] && this.oficinasEspecialesEstado[teamId].activada) {
                    this._validarLimiteOficina(teamId);
                }
            }.bind(this));
        },

        _renderPaginacionOficinas: function (totalPaginas) {
            if (totalPaginas <= 1) {
                this.$oficinasPaginacion.empty();
                return;
            }

            var botones = '';
            for (var p = 1; p <= totalPaginas; p++) {
                botones += '<button type="button" class="el-btn' + (p === this.oficinasPagina ? '' : ' el-btn-pagina-inactiva') +
                    '" data-oficinas-pagina="' + p + '" style="width:auto; min-width:36px; padding:6px 10px; margin-right:6px; font-size:12px;">' +
                    p + '</button>';
            }

            this.$oficinasPaginacion.html(
                '<div style="display:flex; justify-content:center; flex-wrap:wrap;">' + botones + '</div>'
            );
        },

        _validarLimiteOficina: function (teamId) {
            var conteo = this._recalcularConteoOficinas();
            var info = conteo[teamId];
            var estado = this.oficinasEspecialesEstado[teamId] || {};
            var $error = this.$oficinasWrap.find('#el-oficina-error-' + teamId);

            if (!estado.activada) {
                $error.removeClass('visible').text('');
                return true;
            }

            var limite = parseInt(estado.limite, 10);
            var limiteOriginal = this.oficinasEspecialesLimiteOriginal[teamId] || null;
            var total = info ? info.total : 0;

            var error = null;
            if (!limite || limite < 1) {
                error = 'Indica un límite válido.';
            } else if (total > 0 && limite >= total) {
                error = 'Debe ser menor a ' + total + ' (líderes activos de esta oficina).';
            } else if (limiteOriginal && limite < limiteOriginal) {
                error = 'No se puede bajar de ' + limiteOriginal + '.';
            }

            $error.text(error || '').toggleClass('visible', !!error);
            return !error;
        },

        filtrarLideres: function (texto) {
            var t = (texto || '').toLowerCase().trim();
            this.$tbody.find('tr[data-user-id]').each(function (i, el) {
                var $el = $(el);
                var visible = !t || ($el.data('nombre') || '').indexOf(t) !== -1;
                $el.toggle(visible);
            });
        },

        validarFechas: function () {
            var inicio = this.$fechaInicio.val();
            var fin = this.$fechaFin.val();

            if (inicio && fin && inicio >= fin) {
                this.$fechasError.addClass('visible');
                return false;
            }

            this.$fechasError.removeClass('visible');
            return true;
        },

        guardarPeriodo: function () {
            var inicio = this.$fechaInicio.val();
            var fin = this.$fechaFin.val();

            if (!inicio || !fin) {
                Espo.Ui.error('Debe indicar ambas fechas.');
                return;
            }

            if (!this.validarFechas()) {
                Espo.Ui.error('La fecha de inicio debe ser anterior a la fecha de fin.');
                return;
            }

            var lideresPayload = [];
            this.$tbody.find('tr[data-user-id]').each(function (i, el) {
                var $el = $(el);
                lideresPayload.push({
                    userId: $el.data('user-id'),
                    activo: $el.find('.el-check-activo').is(':checked')
                });
            });

            if (!lideresPayload.length) {
                Espo.Ui.error('No hay líderes disponibles para guardar.');
                return;
            }

            // ── Validar y armar el payload de oficinas especiales ──
            var oficinasEspecialesPayload = [];
            var hayErroresOficinas = false;

            Object.keys(this.oficinasEspecialesEstado).forEach(function (teamId) {
                var estado = this.oficinasEspecialesEstado[teamId];
                if (!estado || !estado.activada) return;

                if (!this._validarLimiteOficina(teamId)) {
                    hayErroresOficinas = true;
                    return;
                }

                oficinasEspecialesPayload.push({
                    teamId: teamId,
                    limite: parseInt(estado.limite, 10)
                });
            }.bind(this));

            if (hayErroresOficinas) {
                Espo.Ui.error('Revisa los límites de las oficinas especiales marcadas.');
                return;
            }

            this.notify('Guardando...');

            Espo.Ajax.postRequest('EncuestaLiderazgoEncuesta/action/guardarPeriodo', {
                periodoId: this.periodoId,
                fechaInicio: inicio,
                fechaFin: fin,
                lideres: lideresPayload,
                oficinasEspeciales: oficinasEspecialesPayload
            }).then(function (resp) {
                this.notify(false);

                if (!resp || !resp.success) {
                    Espo.Ui.error((resp && resp.error) || 'No se pudo guardar el periodo.');
                    return;
                }

                Espo.Ui.success('Periodo guardado correctamente.');

                if (resp.lideresBloqueados && resp.lideresBloqueados.length) {
                    Espo.Ui.warning('No se pudo desactivar a: ' + resp.lideresBloqueados.join(', ') +
                        ' (ya fueron evaluados por al menos un asesor).', {closeButton: true});
                }

                this.getRouter().navigate('#Liderazgo', {trigger: true});
            }.bind(this)).catch(function (xhr) {
                this.notify(false);
                var mensaje = 'Ocurrió un error al guardar el periodo.';
                try {
                    var body = JSON.parse(xhr.responseText);
                    if (body && body.error) mensaje = body.error;
                } catch (e) {}
                Espo.Ui.error(mensaje);
            }.bind(this));
        }

    });
});
