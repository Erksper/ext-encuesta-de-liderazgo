// client/custom/modules/encuesta-de-liderazgo/src/views/periodo.js
define('encuesta-de-liderazgo:views/periodo', ['view'], function (View) {

    return View.extend({

        template: 'encuesta-de-liderazgo:periodo',

        events: {
            'change #el-fecha-inicio': function () { this.validarFechas(); },
            'change #el-fecha-fin': function () { this.validarFechas(); },
            'keyup #el-buscador-lideres': function (e) { this.filtrarLideres(e.currentTarget.value); },
            'click [data-action="guardarPeriodo"]': function () { this.guardarPeriodo(); }
        },

        setup: function () {
            this.periodoId = this._obtenerPeriodoIdDeQuery();
            this.esEdicion = !!this.periodoId;
            this.lideres = [];
            this.estadosGuardados = {}; // userId -> activo(bool), solo en edición
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
                        }.bind(this));
                    }
                }

                this._renderTabla(this.lideres);
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

                var rolesHtml = (l.roles || []).map(function (r) {
                    return '<span class="el-rol-badge">' + Handlebars.Utils.escapeExpression(r) + '</span>';
                }).join(' ');

                return '<tr data-user-id="' + l.id + '" data-nombre="' +
                    Handlebars.Utils.escapeExpression((l.name + ' ' + l.teamName).toLowerCase()) + '"' +
                    (activoDefault ? '' : ' class="el-fila-inactiva"') + '>' +
                    '<td>' + Handlebars.Utils.escapeExpression(l.name) + '</td>' +
                    '<td>' + Handlebars.Utils.escapeExpression(l.teamName || 'Sin oficina') + '</td>' +
                    '<td>' + rolesHtml + '</td>' +
                    '<td class="el-check-col">' +
                        '<input type="checkbox" class="el-check-activo" ' + (activoDefault ? 'checked' : '') + '>' +
                    '</td>' +
                    '</tr>';
            }.bind(this)).join('');

            this.$tbody.html(filas);
            this.$contador.text(lideres.length + ' líder' + (lideres.length === 1 ? '' : 'es'));

            this.$tbody.off('change', '.el-check-activo').on('change', '.el-check-activo', function (e) {
                $(e.currentTarget).closest('tr').toggleClass('el-fila-inactiva', !e.currentTarget.checked);
            });
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

            this.notify('Guardando...');

            Espo.Ajax.postRequest('EncuestaLiderazgoEncuesta/action/guardarPeriodo', {
                periodoId: this.periodoId,
                fechaInicio: inicio,
                fechaFin: fin,
                lideres: lideresPayload
            }).then(function (resp) {
                this.notify(false);

                if (!resp || !resp.success) {
                    Espo.Ui.error((resp && resp.error) || 'No se pudo guardar el periodo.');
                    return;
                }

                Espo.Ui.success('Periodo guardado correctamente.');
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
