define('encuesta-de-liderazgo:controllers/liderazgo', ['controllers/base'], function (Dep) {

    return Dep.extend({

        defaultAction: 'index',

        actionIndex: function () {
            this.main('encuesta-de-liderazgo:views/landing', {
                scope: 'Liderazgo'
            });
        },

        actionReportes: function () {
            this.main('encuesta-de-liderazgo:views/evaluacion-general', {
                scope: 'Liderazgo'
            });
        },

        actionPeriodo: function (options) {
            this.main('encuesta-de-liderazgo:views/periodo', {
                scope: 'Liderazgo'
            });
        },

        actionEncuesta: function (options) {
            this.main('encuesta-de-liderazgo:views/mis-lideres', {
                scope: 'Liderazgo'
            });
        },

        actionResponder: function (asesorPorEvaluarId) {
            this.main('encuesta-de-liderazgo:views/responder', {
                scope: 'Liderazgo',
                asesorPorEvaluarId: asesorPorEvaluarId
            });
        },

        actionPendientes: function () {
            this.main('encuesta-de-liderazgo:views/pendientes', {
                scope: 'Liderazgo'
            });
        },

        actionAdmin: function () {
            if (!this.getUser().isAdmin()) {
                this.getRouter().navigate('#Liderazgo', {trigger: true});
                Espo.Ui.error('Acceso denegado. Solo administradores pueden acceder.');
                return;
            }

            this.main('encuesta-de-liderazgo:views/admin');
        },

        actionCategoria: function (options) {
            var categoriaId = '';
            var filtrosParam = '';

            if (options && typeof options === 'string') {
                filtrosParam = options;

                var partes = filtrosParam.split('-');

                if (partes.length >= 5) {
                    categoriaId = partes[0] !== 'null' ? partes[0] : '';

                    var filtrosReales = {
                        anio: partes[1] !== 'null' ? partes[1] : null,
                        cla: partes[2] !== 'null' ? partes[2] : null,
                        oficina: partes[3] !== 'null' ? partes[3] : null,
                        usuario: partes[4] !== 'null' ? partes[4] : null
                    };

                    var filtrosString = filtrosReales.anio + '-' + filtrosReales.cla + '-' +
                                    filtrosReales.oficina + '-' + filtrosReales.usuario;

                    this.main('encuesta-de-liderazgo:views/categoria-detalle', {
                        categoriaId: categoriaId,
                        filtros: filtrosString,
                        filtrosCompletos: filtrosParam
                    });

                } else {
                    Espo.Ui.error('Error en los parámetros de la categoría');
                    this.getRouter().navigate('#Liderazgo', {trigger: true});
                    return;
                }
            } else {
                Espo.Ui.error('No se especificó una categoría');
                this.getRouter().navigate('#Liderazgo', {trigger: true});
                return;
            }
        }

    });
});
