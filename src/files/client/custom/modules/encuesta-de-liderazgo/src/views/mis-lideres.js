// client/custom/modules/encuesta-de-liderazgo/src/views/mis-lideres.js
define('encuesta-de-liderazgo:views/mis-lideres', ['view'], function (View) {

    return View.extend({

        template: 'encuesta-de-liderazgo:mis-lideres',

        events: {
            'click .el-lider-item[data-clickable="true"]': function (e) {
                var id = $(e.currentTarget).data('id');
                this.getRouter().navigate('#Liderazgo/responder/' + id, {trigger: true});
            }
        },

        setup: function () {},

        afterRender: function () {
            this.$container = this.$el.find('#el-lideres-container');
            this._cargarLideres();
        },

        _cargarLideres: function () {
            Espo.Ajax.getRequest('EncuestaLiderazgoAsesoresPorEvaluar/action/getMisLideres').then(function (resp) {
                if (!resp || !resp.success) {
                    Espo.Ui.error('No se pudo cargar la lista de líderes.');
                    return;
                }

                if (!resp.periodoActivo) {
                    this.$container.html(
                        '<div class="el-lideres-sin-periodo">' +
                        '<i class="fas fa-calendar-times"></i>' +
                        'No hay un periodo de encuesta activo en este momento.' +
                        '</div>'
                    );
                    return;
                }

                if (!resp.data || !resp.data.length) {
                    this.$container.html(
                        '<div class="el-lideres-empty">' +
                        '<i class="fas fa-check-circle"></i>' +
                        'No tienes líderes asignados para evaluar en este periodo.' +
                        '</div>'
                    );
                    return;
                }

                this._renderLista(resp.data);
            }.bind(this)).catch(function () {
                Espo.Ui.error('Ocurrió un error al cargar tus líderes pendientes.');
            });
        },

        _renderLista: function (lideres) {
            var badges = {
                sin_evaluar: {clase: 'el-badge-pendiente', icono: 'fa-circle', texto: 'Pendiente'},
                parcial: {clase: 'el-badge-parcial', icono: 'fa-hourglass-half', texto: 'En progreso'},
                evaluado: {clase: 'el-badge-completado', icono: 'fa-check', texto: 'Completado'}
            };

            var filas = lideres.map(function (l) {
                var b = badges[l.estado] || badges.sin_evaluar;
                var completado = l.estado === 'evaluado';

                return '<div class="el-lider-item' + (completado ? ' el-lider-completado' : '') + '"' +
                    ' data-id="' + l.id + '" data-clickable="' + (!completado) + '">' +
                    '<span class="el-lider-nombre">' + Handlebars.Utils.escapeExpression(l.leaderName) + '</span>' +
                    '<span class="el-lider-badge ' + b.clase + '"><i class="fas ' + b.icono + '"></i> ' + b.texto + '</span>' +
                    '</div>';
            }).join('');

            this.$container.html('<div class="el-lideres-lista">' + filas + '</div>');
        }

    });
});
