// client/custom/modules/encuesta-de-liderazgo/src/views/pendientes.js
define('encuesta-de-liderazgo:views/pendientes', ['view'], function (View) {

    return View.extend({

        template: 'encuesta-de-liderazgo:pendientes',

        events: {
            'keyup #el-buscador-pendientes': function (e) {
                this._filtrar(e.currentTarget.value);
            },
            'click [data-action="enviarMensajeMasivo"]': function () {
                this._enviarMensajeDummy('a todos los asesores con evaluaciones pendientes');
            },
            'click [data-action="enviarMensajeIndividual"]': function (e) {
                var $btn = $(e.currentTarget);
                if ($btn.prop('disabled')) return;
                this._enviarMensajeDummy('a ' + $btn.data('nombre'));
            }
        },

        setup: function () {
            this.datos = [];
        },

        afterRender: function () {
            this.$body = this.$el.find('#el-pendientes-body');
            this._verificarAccesoYCargar();
        },

        _verificarAccesoYCargar: function () {
            var user = this.getUser();

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({relations: {roles: true}}).then(function () {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(function (r) {
                        return r.toLowerCase();
                    });
                    var esCasaNacional = user.isAdmin() || roles.includes('casa nacional');

                    if (!esCasaNacional) {
                        this._renderAccesoDenegado();
                        return;
                    }

                    this._cargarPendientes();
                }.bind(this));
            }.bind(this));
        },

        _renderAccesoDenegado: function () {
            this.$body.html(
                '<div class="record-container"><div class="row">' +
                '<div class="col-md-6 col-md-offset-3">' +
                '<div class="el-acceso-denegado">' +
                '<div class="el-acceso-icon"><i class="fas fa-lock"></i></div>' +
                '<h4>Acceso denegado</h4>' +
                '<p>Solo Casa Nacional puede ver esta página.</p>' +
                '<a href="#Liderazgo" class="el-btn" style="width:auto; padding:10px 24px; display:inline-flex; margin-top:14px;">' +
                '<i class="fas fa-arrow-left"></i> Volver</a>' +
                '</div></div></div></div>'
            );
        },

        _cargarPendientes: function () {
            Espo.Ajax.getRequest('EncuestaLiderazgoAsesoresPorEvaluar/action/getAsesoresPendientes').then(function (resp) {
                if (!resp || !resp.success) {
                    Espo.Ui.error((resp && resp.error) || 'No se pudo cargar la información.');
                    return;
                }

                if (!resp.periodoActivo) {
                    this.$body.html(
                        '<div class="record-container"><div class="row"><div class="col-md-8 col-md-offset-2">' +
                        '<div class="el-lideres-sin-periodo" style="padding:60px 20px; text-align:center; color:#666;">' +
                        '<i class="fas fa-calendar-times" style="font-size:40px; display:block; margin-bottom:14px; color:var(--el-color-primary,#B8A279);"></i>' +
                        'No hay un periodo de encuesta activo en este momento.' +
                        '</div></div></div></div>'
                    );
                    return;
                }

                this.datos = resp.data || [];
                this._renderTabla();
            }.bind(this)).catch(function () {
                Espo.Ui.error('Ocurrió un error al cargar los pendientes.');
            });
        },

        _renderTabla: function () {
            if (!this.datos.length) {
                this.$body.html(
                    '<div class="record-container"><div class="row"><div class="col-md-8 col-md-offset-2">' +
                    '<div class="el-lideres-empty" style="padding:60px 20px; text-align:center; color:#666;">' +
                    '<i class="fas fa-check-circle" style="font-size:40px; display:block; margin-bottom:14px; color:#27AE60;"></i>' +
                    '¡Todos los asesores han completado sus evaluaciones!' +
                    '</div></div></div></div>'
                );
                return;
            }

            var filasHtml = '';
            var oficinaActual = null;

            this.datos.forEach(function (d) {
                if (d.teamName !== oficinaActual) {
                    oficinaActual = d.teamName;
                    filasHtml += '<tr class="el-oficina-group-row">' +
                        '<td colspan="4"><i class="fas fa-building"></i> ' + Handlebars.Utils.escapeExpression(oficinaActual) + '</td>' +
                        '</tr>';
                }

                var tieneTelefono = !!d.telefono;

                filasHtml += '<tr data-nombre="' + Handlebars.Utils.escapeExpression((d.name + ' ' + d.teamName).toLowerCase()) + '">' +
                    '<td>' + Handlebars.Utils.escapeExpression(d.name) + '</td>' +
                    '<td>' + Handlebars.Utils.escapeExpression(d.teamName) + '</td>' +
                    '<td style="text-align:center;"><span class="el-pendiente-count">' + d.pendientes + '/' + d.total + '</span></td>' +
                    '<td style="text-align:center;">' +
                        '<button class="el-btn-whatsapp" data-action="enviarMensajeIndividual" data-nombre="' +
                            Handlebars.Utils.escapeExpression(d.name) + '"' + (tieneTelefono ? '' : ' disabled title="Sin teléfono registrado"') + '>' +
                            '<i class="fab fa-whatsapp"></i> Enviar' +
                        '</button>' +
                    '</td>' +
                    '</tr>';
            });

            var html =
                '<div class="record-container"><div class="row"><div class="col-md-10 col-md-offset-1">' +
                '<div class="el-main-card"><div class="el-main-card-body">' +
                '<div class="el-lideres-toolbar">' +
                '<input type="text" class="el-lideres-buscador" id="el-buscador-pendientes" placeholder="Buscar por nombre u oficina...">' +
                '<span class="el-lideres-contador">' + this.datos.length + ' asesor' + (this.datos.length === 1 ? '' : 'es') + ' con pendientes</span>' +
                '<button class="el-btn" style="width:auto; padding:8px 18px;" data-action="enviarMensajeMasivo">' +
                '<i class="fab fa-whatsapp"></i> Enviar Mensaje</button>' +
                '</div>' +
                '<div class="el-lideres-tabla-wrap">' +
                '<table class="el-lideres-tabla">' +
                '<thead><tr><th>Nombre</th><th>Oficina</th><th style="text-align:center;">Pendientes</th><th style="text-align:center;">Mensaje</th></tr></thead>' +
                '<tbody id="el-pendientes-tbody">' + filasHtml + '</tbody>' +
                '</table></div></div></div>' +
                '<div style="text-align:center; margin-top:16px;">' +
                '<a href="#Liderazgo" class="el-btn" style="width:auto; padding:10px 24px; display:inline-flex;">' +
                '<i class="fas fa-arrow-left"></i> Volver</a>' +
                '</div>' +
                '</div></div></div>';

            this.$body.html(html);
        },

        _filtrar: function (texto) {
            var t = (texto || '').toLowerCase().trim();
            this.$body.find('#el-pendientes-tbody tr[data-nombre]').each(function (i, el) {
                var $el = $(el);
                $el.toggle(!t || ($el.data('nombre') || '').indexOf(t) !== -1);
            });
            // Oculta encabezados de oficina que quedaron sin filas visibles.
            this.$body.find('.el-oficina-group-row').each(function (i, el) {
                var $header = $(el);
                var $filas = $header.nextUntil('.el-oficina-group-row', 'tr[data-nombre]');
                var visible = $filas.filter(function (idx, row) { return $(row).is(':visible'); }).length > 0;
                $header.toggle(visible);
            });
        },

        _enviarMensajeDummy: function (destinatario) {
            var modalId = 'el-modal-whatsapp';
            $('#' + modalId).remove();

            var html =
                '<div class="modal fade" id="' + modalId + '" tabindex="-1" role="dialog">' +
                '  <div class="modal-dialog" role="document" style="max-width:420px;">' +
                '    <div class="modal-content" style="border-radius:12px; overflow:hidden;">' +
                '      <div class="modal-body" style="text-align:center; padding:36px 24px;">' +
                '        <div style="width:64px; height:64px; border-radius:50%; background:#E9F7EF; display:flex; align-items:center; justify-content:center; margin:0 auto 18px;">' +
                '          <i class="fab fa-whatsapp" style="font-size:30px; color:#25D366;"></i>' +
                '        </div>' +
                '        <h4 style="margin:0 0 8px;">¡Mensaje enviado!</h4>' +
                '        <p style="color:#666; margin:0 0 22px;">Se envió el mensaje de WhatsApp ' + destinatario + ' (simulado).</p>' +
                '        <button type="button" class="el-btn" style="width:auto; padding:8px 26px; display:inline-flex;" data-dismiss="modal">Aceptar</button>' +
                '      </div>' +
                '    </div>' +
                '  </div>' +
                '</div>';

            $('body').append(html);
            $('#' + modalId).modal('show');
            $('#' + modalId).on('hidden.bs.modal', function () {
                $(this).remove();
            });
        }

    });
});
