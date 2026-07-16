// client/custom/modules/encuesta-de-liderazgo/src/views/responder.js
define('encuesta-de-liderazgo:views/responder', ['view'], function (View) {

    var OPCIONES_SELECCION = [
        {valor: '4', texto: '(4) Siempre'},
        {valor: '3', texto: '(3) Casi siempre'},
        {valor: '2', texto: '(2) Pocas veces'},
        {valor: '1', texto: '(1) Nunca'}
    ];

    return View.extend({

        template: 'encuesta-de-liderazgo:responder',

        events: {
            'click .el-tab-btn': function (e) {
                this._activarTab($(e.currentTarget).data('tab'));
            },
            'click .el-opcion-btn': function (e) {
                if (this.soloLectura) return;
                var $btn = $(e.currentTarget);
                var $grupo = $btn.closest('.el-opciones-seleccion');
                $grupo.find('.el-opcion-btn').removeClass('selected');
                $btn.addClass('selected');
                this._actualizarIndicadorTab($btn.closest('.el-tab-pane').attr('id'));
            },
            'input .el-pregunta-textarea': function (e) {
                if (this.soloLectura) return;
                this._actualizarIndicadorTab($(e.currentTarget).closest('.el-tab-pane').attr('id'));
            },
            'click [data-action="guardar"]': function () {
                this.guardar();
            }
        },

        setup: function () {
            this.asesorPorEvaluarId = this.options.asesorPorEvaluarId || this._obtenerIdDeRuta();
            this.categorias = [];
            this.soloLectura = false;
            this.tabActual = null;
        },

        _obtenerIdDeRuta: function () {
            // this.options no siempre propaga los parámetros de ruta dinámicos,
            // así que como red de seguridad lo leemos directo del hash:
            // #Liderazgo/responder/{asesorPorEvaluarId}
            var hash = (window.location.hash || '').replace(/^#/, '');
            var partes = hash.split('/');

            var idx = partes.indexOf('responder');
            if (idx !== -1 && partes[idx + 1]) {
                return decodeURIComponent(partes[idx + 1]);
            }
            return null;
        },

        afterRender: function () {
            this.$loading = this.$el.find('#el-encuesta-loading');
            this.$content = this.$el.find('#el-encuesta-content');
            this.$tabsNav = this.$el.find('#el-tabs-nav');
            this.$tabsContent = this.$el.find('#el-tabs-content');
            this.$nombreLider = this.$el.find('#el-nombre-lider');
            this.$readonlyBanner = this.$el.find('#el-readonly-banner');
            this.$btnGuardar = this.$el.find('[data-action="guardar"]');
            this.$footerCard = this.$el.find('#el-encuesta-footer-card');

            if (!this.asesorPorEvaluarId) {
                Espo.Ui.error('No se especificó una evaluación válida.');
                this.getRouter().navigate('#Liderazgo/encuesta', {trigger: true});
                return;
            }

            this._cargarDatos();
        },

        _cargarDatos: function () {
            Espo.Ajax.getRequest('EncuestaLiderazgoAsesoresPorEvaluar/action/getEncuestaData', {
                id: this.asesorPorEvaluarId
            }).then(function (resp) {
                this.$loading.hide();

                if (!resp || !resp.success) {
                    Espo.Ui.error((resp && resp.error) || 'No se pudo cargar la encuesta.');
                    this.getRouter().navigate('#Liderazgo/encuesta', {trigger: true});
                    return;
                }

                this.categorias = resp.categorias || [];
                this.soloLectura = !!resp.soloLectura;
                this.$nombreLider.text(resp.leaderName || '');

                if (this.soloLectura) {
                    this.$readonlyBanner.show();
                    this.$btnGuardar.hide();
                }

                this._renderTabs();
                this.$content.show();
            }.bind(this)).catch(function (xhr) {
                this.$loading.hide();
                var mensaje = 'Ocurrió un error al cargar la encuesta.';
                try {
                    var body = JSON.parse(xhr.responseText);
                    if (body && body.error) mensaje = body.error;
                } catch (e) {}
                Espo.Ui.error(mensaje);
                this.getRouter().navigate('#Liderazgo/encuesta', {trigger: true});
            }.bind(this));
        },

        _renderTabs: function () {
            if (!this.categorias.length) {
                this.$tabsContent.html('<p style="text-align:center; padding:30px; color:#666;">' +
                    'No hay categorías de preguntas configuradas.</p>');
                return;
            }

            var navHtml = '';
            var panesHtml = '';

            this.categorias.forEach(function (cat, index) {
                var tabId = 'el-tab-' + cat.id;
                var activa = index === 0;

                navHtml += '<button class="el-tab-btn' + (activa ? ' active' : '') + '" data-tab="' + tabId + '">' +
                    '<span class="el-tab-check"><i class="fas fa-check"></i></span>' +
                    Handlebars.Utils.escapeExpression(cat.name) +
                    '</button>';

                var preguntasHtml = (cat.preguntas || []).map(function (p) {
                    return this._renderPregunta(p);
                }.bind(this)).join('');

                panesHtml += '<div class="el-tab-pane' + (activa ? ' active' : '') + (this.soloLectura ? ' el-encuesta-disabled' : '') + '" id="' + tabId + '">' +
                    preguntasHtml +
                    '</div>';
            }.bind(this));

            this.$tabsNav.html(navHtml);
            this.$tabsContent.html(panesHtml);
            this.tabActual = 'el-tab-' + this.categorias[0].id;

            this.categorias.forEach(function (cat) {
                this._actualizarIndicadorTab('el-tab-' + cat.id);
            }.bind(this));
        },

        _renderPregunta: function (p) {
            var body = '';

            if (p.tipo === 'seleccion_simple') {
                var opciones = OPCIONES_SELECCION.map(function (op) {
                    var seleccionada = (String(p.seleccion) === op.valor);
                    return '<button type="button" class="el-opcion-btn' + (seleccionada ? ' selected' : '') +
                        '" data-valor="' + op.valor + '">' + op.texto + '</button>';
                }).join('');

                body = '<div class="el-opciones-seleccion" data-pregunta-id="' + p.id + '" data-tipo="seleccion_simple">' +
                    opciones + '</div>';
            } else {
                var valorTexto = p.texto_respuesta ? Handlebars.Utils.escapeExpression(p.texto_respuesta) : '';
                body = '<textarea class="el-pregunta-textarea" data-pregunta-id="' + p.id + '" data-tipo="texto"' +
                    (this.soloLectura ? ' disabled' : '') + '>' + valorTexto + '</textarea>';
            }

            return '<div class="el-pregunta-block">' +
                '<div class="el-pregunta-texto">' + Handlebars.Utils.escapeExpression(p.texto) + '</div>' +
                body +
                '</div>';
        },

        _activarTab: function (tabId) {
            this.tabActual = tabId;
            this.$tabsNav.find('.el-tab-btn').removeClass('active');
            this.$tabsNav.find('.el-tab-btn[data-tab="' + tabId + '"]').addClass('active');
            this.$tabsContent.find('.el-tab-pane').removeClass('active');
            this.$tabsContent.find('#' + tabId).addClass('active');
        },

        _actualizarIndicadorTab: function (tabId) {
            if (!tabId) return;
            var $pane = this.$tabsContent.find('#' + tabId);
            var completa = true;

            $pane.find('[data-pregunta-id]').each(function (i, el) {
                var $el = $(el);
                if ($el.data('tipo') === 'seleccion_simple') {
                    if (!$el.find('.el-opcion-btn.selected').length) completa = false;
                } else {
                    if (!$.trim($el.val() || '').length) completa = false;
                }
            });

            this.$tabsNav.find('.el-tab-btn[data-tab="' + tabId + '"]')
                .toggleClass('el-tab-completa', completa);
        },

        _recolectarRespuestas: function () {
            var respuestas = [];

            this.$tabsContent.find('[data-pregunta-id]').each(function (i, el) {
                var $el = $(el);
                var preguntaId = $el.data('pregunta-id');
                var tipo = $el.data('tipo');

                if (tipo === 'seleccion_simple') {
                    var $sel = $el.find('.el-opcion-btn.selected');
                    respuestas.push({
                        preguntaId: preguntaId,
                        seleccion: $sel.length ? $sel.data('valor').toString() : null,
                        texto: null
                    });
                } else {
                    respuestas.push({
                        preguntaId: preguntaId,
                        seleccion: null,
                        texto: $el.val() || ''
                    });
                }
            });

            return respuestas;
        },

        guardar: function () {
            if (this.soloLectura) return;

            var respuestas = this._recolectarRespuestas();

            this.notify('Guardando...');

            Espo.Ajax.postRequest('EncuestaLiderazgoAsesoresPorEvaluar/action/guardarRespuestas', {
                asesorPorEvaluarId: this.asesorPorEvaluarId,
                respuestas: respuestas
            }).then(function (resp) {
                this.notify(false);

                if (!resp || !resp.success) {
                    Espo.Ui.error((resp && resp.error) || 'No se pudo guardar la encuesta.');
                    return;
                }

                if (resp.soloLectura) {
                    Espo.Ui.success('¡Encuesta completada! Gracias por tu evaluación.');
                } else {
                    Espo.Ui.success('Progreso guardado (' + resp.totalRespondidas + '/' + resp.totalActivas + ').');
                }

                // Vuelve a la lista de líderes pendientes después de guardar.
                this.getRouter().navigate('#Liderazgo/encuesta', {trigger: true});
            }.bind(this)).catch(function (xhr) {
                this.notify(false);
                var mensaje = 'Ocurrió un error al guardar la encuesta.';
                try {
                    var body = JSON.parse(xhr.responseText);
                    if (body && body.error) mensaje = body.error;
                } catch (e) {}
                Espo.Ui.error(mensaje);
            }.bind(this));
        }

    });
});
