// client/custom/modules/encuesta-de-liderazgo/src/views/landing.js
define('encuesta-de-liderazgo:views/landing', ['view'], function (View) {

    return View.extend({

        template: 'encuesta-de-liderazgo:landing',

        events: {
            'click [data-action="crearEditarPeriodo"]': function () {
                var url = '#Liderazgo/periodo';
                if (this.periodoActivo && this.periodoId) {
                    url += '?periodoId=' + encodeURIComponent(this.periodoId);
                }
                this.getRouter().navigate(url, {trigger: true});
            },
            'click [data-action="contestarEncuesta"]': function () {
                this.getRouter().navigate('#Liderazgo/encuesta', {trigger: true});
            },
            'click [data-action="verReportes"]': function () {
                this.getRouter().navigate('#Liderazgo/reportes', {trigger: true});
            },
            'click [data-action="verPendientes"]': function () {
                this.getRouter().navigate('#Liderazgo/pendientes', {trigger: true});
            }
        },

        setup: function () {
            var user = this.getUser();

            this.esCasaNacional = false;
            this.periodoActivo = false;
            this.periodoId = null;
            this.fechaInicioDisplay = null;
            this.fechaFinDisplay = null;

            this.wait(true);

            this.getModelFactory().create('User', function (userModel) {
                userModel.id = user.id;
                userModel.fetch({relations: {roles: true}}).then(function () {
                    var roles = Object.values(userModel.get('rolesNames') || {}).map(function (r) {
                        return r.toLowerCase();
                    });

                    this.esCasaNacional = roles.includes('casa nacional');

                    this.verificarPeriodoActivo();
                }.bind(this));
            }.bind(this));
        },

        verificarPeriodoActivo: function () {
            this.getCollectionFactory().create('EncuestaLiderazgoEncuesta', function (collection) {
                collection.fetch({
                    data: {
                        maxSize: 1,
                        orderBy: 'fechaInicio',
                        order: 'desc'
                    }
                }).then(function () {
                    if (collection.total > 0) {
                        var periodo = collection.at(0);
                        var fechaInicio = periodo.get('fechaInicio');
                        var fechaFin = periodo.get('fechaFin');

                        if (fechaInicio && fechaFin) {
                            var hoy = new Date().toISOString().split('T')[0];
                            this.periodoActivo = (hoy >= fechaInicio && hoy <= fechaFin);

                            if (this.periodoActivo) {
                                this.periodoId = periodo.id;
                                this.fechaInicioDisplay = this.getDateTime().toDisplayDate(fechaInicio);
                                this.fechaFinDisplay = this.getDateTime().toDisplayDate(fechaFin);
                            }
                        }
                    }

                    this.wait(false);
                }.bind(this)).catch(function () {
                    this.wait(false);
                }.bind(this));
            }.bind(this));
        },

        data: function () {
            return {
                esCasaNacional: this.esCasaNacional,
                periodoActivo: this.periodoActivo,
                fechaInicioDisplay: this.fechaInicioDisplay,
                fechaFinDisplay: this.fechaFinDisplay
            };
        }

    });
});
