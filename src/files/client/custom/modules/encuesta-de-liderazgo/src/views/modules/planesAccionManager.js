/**
 * PlanesAccionManager
 */
define([], function () {

    var ESTADOS_CN = {
        'pendienteCN':  { bg: '#fff3cd', color: '#856404', texto: 'Por revisar' },
        'pendienteGDC': { bg: '#d4edda', color: '#155724', texto: 'Esperando por Líder' },
        'cancelado':    { bg: '#f8d7da', color: '#721c24', texto: 'Cancelado' },
        'pausado':      { bg: '#e2e3e5', color: '#383d41', texto: 'Pausado' },
        'completado':   { bg: '#d1ecf1', color: '#0c5460', texto: 'Completado' }
    };

    var ESTADOS_GDC = {
        'pendienteCN':  { bg: '#d4edda', color: '#155724', texto: 'Esperando por Casa Nacional' },
        'pendienteGDC': { bg: '#fff3cd', color: '#856404', texto: 'Por revisar' },
        'cancelado':    { bg: '#f8d7da', color: '#721c24', texto: 'Cancelado' },
        'pausado':      { bg: '#e2e3e5', color: '#383d41', texto: 'Pausado' },
        'completado':   { bg: '#d1ecf1', color: '#0c5460', texto: 'Completado' }
    };

    var INPUT_STYLE = 'width:100%;border:2px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:14px;box-sizing:border-box;';
    var LABEL_STYLE = 'font-weight:600;color:#333;font-size:13px;display:block;margin-bottom:6px;';

    function fmtFecha(s) {
        if (!s) return '—';
        return s.substring(0, 10).split('-').reverse().join('/');
    }

    function fmtFechaHora(s) {
        if (!s) return '';
        return s.substring(0, 16).replace('T', ' ');
    }

    function iniciales(nombre) {
        if (!nombre) return '?';
        return nombre.split(' ').slice(0, 2).map(function (n) { return n[0] || ''; }).join('').toUpperCase();
    }

    function nowISO() {
        return new Date().toISOString().replace('T', ' ').substring(0, 19);
    }

    function esc(t) {
        if (!t) return '';
        return String(t).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    function buildMensajeHtml(msg, miId) {
        var mio       = msg.autorId === miId;
        var bgAvatar  = mio ? '#B8A279' : '#2C3E50';
        var bgBurbuja = mio ? '#f5f0e8' : '#f0f4f8';
        var border    = mio ? '#e0d6c4' : '#dce4ed';
        var radius    = mio ? '12px 12px 4px 12px' : '12px 12px 12px 4px';
        var dir       = mio ? 'row-reverse' : 'row';
        var align     = mio ? 'right' : 'left';
        var ini       = ((msg.autorNombre || msg.rolAutor || '?')[0] || '?').toUpperCase();
        var fecha     = fmtFechaHora(msg.fechaCreacion || msg.createdAt);

        return '<div style="display:flex;flex-direction:' + dir + ';gap:8px;margin-bottom:12px;align-items:flex-end;">' +
            '<div style="width:28px;height:28px;background:' + bgAvatar + ';border-radius:50%;display:flex;' +
                'align-items:center;justify-content:center;color:white;font-size:11px;font-weight:600;flex-shrink:0;">' + ini + '</div>' +
            '<div style="max-width:75%;">' +
                '<div style="background:' + bgBurbuja + ';border-radius:' + radius + ';padding:10px 14px;border:1px solid ' + border + ';">' +
                    '<p style="margin:0;font-size:14px;color:#333;line-height:1.5;">' + esc(msg.texto) + '</p>' +
                '</div>' +
                '<div style="font-size:11px;color:#999;margin-top:3px;text-align:' + align + ';">' +
                    esc(msg.rolAutor || '') + ' · ' + esc(fecha) +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function PlanesAccionManager(view, opciones) {
        this.view     = view;
        this.opciones = opciones || {};

        this.modulo   = this.opciones.modulo   || 'Competencias';
        this.usuarios = this.opciones.usuarios  || [];
        this.items    = this.opciones.items     || {};
        this.oficina  = this.opciones.oficina   || null;
        this.etiquetaEjecutor = this.opciones.etiquetaEjecutor || 'Evaluado';

        this.planes         = [];
        this.paginacion     = { pagina: 1, porPagina: 10, total: 0, totalPaginas: 0 };
        this.cargandoPagina = false;
        this.planActualId   = null;
        this.planActualData = null;
        this.chats          = [];

        this._resolverUsuario();
    }

    PlanesAccionManager.prototype = {

        _resolverUsuario: function () {
            var v = this.view;
            this.usuarioId      = v.usuarioActualId     || (v.getUser ? v.getUser().id : null);
            this.usuarioNombre  = v.usuarioActualNombre || (v.getUser ? v.getUser().get('name') : null);
            this.esCasaNacional    = !!v.esCasaNacional;
            this.esGerenteODirector = !!v.esGerenteODirector;

            if (v.esCasaNacional) {
                this.usuarioRol = 'Casa Nacional';
            } else if (v.rolUsuario) {
                this.usuarioRol = v.rolUsuario;
            } else if (v.esGerenteODirector) {
                this.usuarioRol = 'Líder';
            } else {
                this.usuarioRol = 'Asesor';
            }

            this.puedeCrear = this.esCasaNacional;
            this.puedeVer   = this.esCasaNacional || this.esGerenteODirector;
        },

        actualizarConfig: function (opciones) {
            opciones = opciones || {};
            if (opciones.modulo           !== undefined) this.modulo           = opciones.modulo;
            if (opciones.usuarios         !== undefined) this.usuarios         = opciones.usuarios;
            if (opciones.items            !== undefined) this.items            = opciones.items;
            if (opciones.oficina          !== undefined) this.oficina          = opciones.oficina;
            if (opciones.etiquetaEjecutor !== undefined) this.etiquetaEjecutor = opciones.etiquetaEjecutor;
            this._resolverUsuario();
        },

        _badge: function (estado) {
            var mapa = this.esCasaNacional ? ESTADOS_CN : ESTADOS_GDC;
            return mapa[estado] || { bg: '#e2e3e5', color: '#383d41', texto: estado };
        },

        cargar: function () {
            if (!this.puedeVer) return;
            this.paginacion.pagina = 1;
            this._fetchPagina(1);
        },

        irAPagina: function (pagina) {
            if (pagina < 1 || pagina > this.paginacion.totalPaginas || this.cargandoPagina) return;
            this.paginacion.pagina = pagina;
            this._fetchPagina(pagina);
        },

        _fetchPagina: function (pagina) {
            if (this.cargandoPagina) return;
            var self            = this;
            this.cargandoPagina = true;
            this._renderCargando();

            var porPagina = this.paginacion.porPagina;

            var wp = {
                'where[0][type]':      'equals',
                'where[0][attribute]': 'modulo',
                'where[0][value]':     self.modulo
            };

            var whereIdx = 1;

            if (self.oficina) {
                wp['where[' + whereIdx + '][type]']      = 'equals';
                wp['where[' + whereIdx + '][attribute]'] = 'equipoId';
                wp['where[' + whereIdx + '][value]']     = self.oficina;
                whereIdx++;
            }

            if (!self.esCasaNacional && self.esGerenteODirector) {
                wp['where[' + whereIdx + '][type]']         = 'notIn';
                wp['where[' + whereIdx + '][attribute]']    = 'estado';
                wp['where[' + whereIdx + '][value][0]']     = 'completado';
                wp['where[' + whereIdx + '][value][1]']     = 'cancelado';
                whereIdx++;
            }

            Espo.Ajax.getRequest('GesPlaAccPlanAccion', Object.assign({}, wp, { maxSize: 1, offset: 0, select: 'id' }))
                .then(function (resp) {
                    var total        = resp.total || 0;
                    var totalPaginas = Math.max(1, Math.ceil(total / porPagina));

                    self.paginacion.total        = total;
                    self.paginacion.totalPaginas = totalPaginas;
                    if (pagina > totalPaginas) pagina = totalPaginas;
                    self.paginacion.pagina = pagina;

                    if (total === 0) {
                        self.planes         = [];
                        self.cargandoPagina = false;
                        self.render();
                        return;
                    }

                    var selectFields = 'id,titulo,estado,fechaInicio,fechaFin,asesorEjecutorId,asesorEjecutorName,' +
                                       'asesorGeneradorId,asesorGeneradorName,itemEvaluado,subItemEvaluado,rolEjecutor,rolGenerador';

                    if (total <= 200) {
                        Espo.Ajax.getRequest('GesPlaAccPlanAccion', Object.assign({}, wp, {
                            select: selectFields, orderBy: 'createdAt', order: 'desc', maxSize: 200, offset: 0
                        })).then(function (r) {
                            var ordenCN  = { 'pendienteCN': 0, 'pendienteGDC': 1, 'pausado': 2, 'completado': 3, 'cancelado': 4 };
                            var ordenGDC = { 'pendienteGDC': 0, 'pendienteCN': 1, 'pausado': 2, 'completado': 3, 'cancelado': 4 };
                            var orden    = self.esCasaNacional ? ordenCN : ordenGDC;
                            var lista   = (r.list || []).sort(function (a, b) {
                                var oa = orden[a.estado] !== undefined ? orden[a.estado] : 2;
                                var ob = orden[b.estado] !== undefined ? orden[b.estado] : 2;
                                return oa - ob;
                            });
                            var ini     = (pagina - 1) * porPagina;
                            self.planes         = lista.slice(ini, ini + porPagina);
                            self.cargandoPagina = false;
                            self.render();
                        }).catch(function () {
                            self.planes = []; self.cargandoPagina = false; self.render();
                        });
                    } else {
                        Espo.Ajax.getRequest('GesPlaAccPlanAccion', Object.assign({}, wp, {
                            select: selectFields, orderBy: 'createdAt', order: 'desc',
                            maxSize: porPagina, offset: (pagina - 1) * porPagina
                        })).then(function (r) {
                            self.planes         = r.list || [];
                            self.cargandoPagina = false;
                            self.render();
                        }).catch(function () {
                            self.planes = []; self.cargandoPagina = false; self.render();
                        });
                    }
                })
                .catch(function () {
                    self.planes         = [];
                    self.cargandoPagina = false;
                    self.render();
                });
        },

        _renderCargando: function () {
            var $c = this.view.$el.find('#seccion-planes-accion');
            if (!$c.length) return;
            $c.html(this._buildHeader(true) +
                '<div style="padding:40px;text-align:center;color:#999;">' +
                    '<i class="fas fa-spinner fa-spin" style="font-size:2em;margin-bottom:12px;display:block;color:#B8A279;"></i>' +
                    '<p style="margin:0;font-size:14px;">Cargando planes de acción...</p>' +
                '</div></div>');
        },

        render: function () {
            if (!this.puedeVer) return;
            var $c = this.view.$el.find('#seccion-planes-accion');
            if (!$c.length) return;
            if (!this.paginacion) {
                this._renderCargando();
                return;
            }
            $c.html(this._buildSeccionHtml());
            this._bindSeccionEvents();
        },

        _buildHeader: function (cargando) {
            var btnNuevo = (!cargando && this.puedeCrear)
                ? '<button id="gesplacc-btn-nuevo" style="background:rgba(255,255,255,0.25);color:white;' +
                  'border:2px solid rgba(255,255,255,0.6);border-radius:8px;padding:8px 18px;font-weight:600;cursor:pointer;">' +
                  '<i class="fas fa-plus" style="margin-right:6px;"></i>Nuevo Plan</button>'
                : '';

            return '<div style="background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);' +
                        'margin-top:30px;border:1px solid #e0e0e0;">' +
                '<div style="background:linear-gradient(135deg,#B8A279 0%,#D4C19C 100%);padding:18px 24px;border-radius:12px 12px 0 0;">' +
                    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
                        '<div style="display:flex;align-items:center;gap:12px;">' +
                            '<div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:8px;' +
                                'display:flex;align-items:center;justify-content:center;">' +
                                '<i class="fas fa-clipboard-list" style="color:white;font-size:20px;"></i>' +
                            '</div>' +
                            '<div>' +
                                '<h2 style="margin:0;color:white;font-weight:700;font-size:1.3rem;">Planes de Acción</h2>' +
                                '<p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:0.85rem;">Seguimiento y gestión de mejoras</p>' +
                            '</div>' +
                        '</div>' +
                        btnNuevo +
                    '</div>' +
                '</div>';
        },

        _buildSeccionHtml: function () {
            var self   = this;
            var planes = this.planes;

            var porRevCN  = planes.filter(function (p) { return p.estado === 'pendienteCN';  }).length;
            var espGDC    = planes.filter(function (p) { return p.estado === 'pendienteGDC'; }).length;

            var cuerpo;
            if (planes.length === 0) {
                var msgVacio = this.esCasaNacional
                    ? 'No hay planes de acción registrados para esta oficina.'
                    : 'No hay planes de acción activos en tu oficina.';
                cuerpo = '<div style="text-align:center;padding:40px 20px;color:#999;">' +
                    '<i class="fas fa-clipboard" style="font-size:3em;margin-bottom:15px;display:block;"></i>' +
                    '<p>' + msgVacio + '</p>' +
                    (this.puedeCrear ? '<p style="font-size:0.9em;">Usa <strong>Nuevo Plan</strong> para crear el primero.</p>' : '') +
                    '</div>';
            } else {
                var labelEjecutor = esc(this.etiquetaEjecutor);
                var filas = planes.map(function (plan, idx) {
                    var b      = self._badge(plan.estado);
                    var nombre = plan.asesorEjecutorName || '—';
                    var sub    = plan.itemEvaluado
                        ? '<br><small style="color:#666;">' + esc(plan.itemEvaluado) +
                          (plan.subItemEvaluado ? ' › ' + esc(plan.subItemEvaluado) : '') + '</small>'
                        : '';
                    return '<tr style="border-bottom:1px solid #eee;cursor:pointer;" class="gesplacc-fila-plan" data-plan-id="' + plan.id + '">' +
                        '<td style="padding:14px 12px;text-align:center;font-weight:600;color:#B8A279;">' + (idx + 1) + '</td>' +
                        '<td style="padding:14px 12px;">' +
                            '<div style="display:flex;align-items:center;gap:10px;">' +
                                '<div style="width:32px;height:32px;background:#B8A279;border-radius:50%;display:flex;' +
                                    'align-items:center;justify-content:center;color:white;font-weight:600;flex-shrink:0;font-size:12px;">' +
                                    iniciales(nombre) + '</div>' +
                                '<span style="font-weight:500;">' + esc(nombre) + '</span>' +
                            '</div>' +
                        '</td>' +
                        '<td style="padding:14px 12px;"><strong>' + esc(plan.titulo || '—') + '</strong>' + sub + '</td>' +
                        '<td style="padding:14px 12px;text-align:center;">' + fmtFecha(plan.fechaInicio) + '</td>' +
                        '<td style="padding:14px 12px;text-align:center;">' + fmtFecha(plan.fechaFin) + '</td>' +
                        '<td style="padding:14px 12px;text-align:center;">' +
                            '<span style="background:' + b.bg + ';color:' + b.color + ';padding:5px 14px;' +
                                'border-radius:20px;font-size:0.82rem;font-weight:600;white-space:nowrap;">' + b.texto + '</span>' +
                        '</td>' +
                    '</tr>';
                }).join('');

                cuerpo = '<div style="background:#fff;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">' +
                    '<table style="width:100%;border-collapse:collapse;">' +
                    '<thead style="background:#f5f5f5;border-bottom:2px solid #B8A279;"><tr>' +
                        '<th style="padding:14px 12px;text-align:center;width:50px;font-weight:700;color:#333;">N°</th>' +
                        '<th style="padding:14px 12px;text-align:left;font-weight:700;color:#333;">' + labelEjecutor + '</th>' +
                        '<th style="padding:14px 12px;text-align:left;font-weight:700;color:#333;">Título del Plan</th>' +
                        '<th style="padding:14px 12px;text-align:center;font-weight:700;color:#333;white-space:nowrap;">Fecha Inicio</th>' +
                        '<th style="padding:14px 12px;text-align:center;font-weight:700;color:#333;white-space:nowrap;">Fecha Fin</th>' +
                        '<th style="padding:14px 12px;text-align:center;font-weight:700;color:#333;">Estado</th>' +
                    '</tr></thead>' +
                    '<tbody>' + filas + '</tbody>' +
                    '</table></div>';
            }

            var etiqPorRev, etiqEspGDC, cntPorRev, cntEspGDC;

            if (this.esCasaNacional) {
                etiqPorRev = 'Por revisar';
                etiqEspGDC = 'Esperando por Líder';
                cntPorRev = porRevCN;
                cntEspGDC = espGDC;
            } else {
                etiqPorRev = 'Por revisar';
                etiqEspGDC = 'Esperando por Casa Nacional';
                cntPorRev = espGDC;
                cntEspGDC = porRevCN;
            }

            var paginacionHtml = this._buildPaginacion();

            return this._buildHeader(false) +
                '<div style="padding:20px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:15px;">' +
                        '<div style="background:#f8f9fa;padding:10px 18px;border-radius:8px;border-left:4px solid #B8A279;font-size:14px;">' +
                            '<i class="fas fa-tasks" style="color:#B8A279;margin-right:8px;"></i>' +
                            '<strong style="color:#B8A279;">' + (this.paginacion ? this.paginacion.total : planes.length) + '</strong> planes de acción' +
                            (this.paginacion && this.paginacion.totalPaginas > 1
                                ? ' <span style="color:#999;font-size:12px;">— página ' + this.paginacion.pagina + ' de ' + this.paginacion.totalPaginas + '</span>'
                                : '') +
                        '</div>' +
                        '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
                            '<span style="background:#fff3cd;color:#856404;padding:5px 12px;border-radius:20px;font-size:0.85rem;font-weight:600;">' +
                                '<i class="fas fa-clock" style="margin-right:5px;"></i>' + etiqPorRev + ': ' + cntPorRev + '</span>' +
                            '<span style="background:#d4edda;color:#155724;padding:5px 12px;border-radius:20px;font-size:0.85rem;font-weight:600;">' +
                                '<i class="fas fa-hourglass-half" style="margin-right:5px;"></i>' + etiqEspGDC + ': ' + cntEspGDC + '</span>' +
                        '</div>' +
                    '</div>' +
                    cuerpo +
                    paginacionHtml +
                '</div>' +
            '</div>';
        },

        _buildPaginacion: function () {
            var pag = this.paginacion;
            if (!pag || pag.totalPaginas <= 1) return '';

            var actual = pag.pagina;
            var total  = pag.totalPaginas;
            var pages  = [];
            var rango  = 2;
            var inicio = Math.max(2, actual - rango);
            var fin    = Math.min(total - 1, actual + rango);

            pages.push(1);
            if (inicio > 2) pages.push('...');
            for (var i = inicio; i <= fin; i++) pages.push(i);
            if (fin < total - 1) pages.push('...');
            if (total > 1) pages.push(total);

            var btnStyle     = 'min-width:36px;height:36px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;color:#555;padding:0 8px;';
            var btnActivo    = 'min-width:36px;height:36px;border:2px solid #B8A279;background:#B8A279;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;color:white;padding:0 8px;';
            var btnDisabled  = 'min-width:36px;height:36px;border:1px solid #eee;background:#f8f9fa;border-radius:6px;cursor:not-allowed;font-size:13px;color:#ccc;padding:0 8px;';

            var btns = pages.map(function (p) {
                if (p === '...') return '<span style="padding:0 4px;color:#999;">…</span>';
                return '<button class="gesplacc-pag-btn" data-pagina="' + p + '" style="' + (p === actual ? btnActivo : btnStyle) + '">' + p + '</button>';
            }).join('');

            var prevBtn = '<button class="gesplacc-pag-btn" data-pagina="' + (actual - 1) + '" style="' + (actual <= 1 ? btnDisabled : btnStyle) + '"' + (actual <= 1 ? ' disabled' : '') + '>' +
                '<i class="fas fa-chevron-left"></i></button>';
            var nextBtn = '<button class="gesplacc-pag-btn" data-pagina="' + (actual + 1) + '" style="' + (actual >= total ? btnDisabled : btnStyle) + '"' + (actual >= total ? ' disabled' : '') + '>' +
                '<i class="fas fa-chevron-right"></i></button>';

            return '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px;padding-top:16px;border-top:1px solid #e0e0e0;">' +
                prevBtn + btns + nextBtn +
            '</div>';
        },

        _bindSeccionEvents: function () {
            var self = this;
            var $c   = this.view.$el.find('#seccion-planes-accion');

            $c.find('#gesplacc-btn-nuevo').off('click').on('click', function () {
                self._abrirModalNuevo();
            });

            $c.find('.gesplacc-fila-plan').off('click').on('click', function () {
                self._abrirModalVer($(this).data('plan-id'));
            });

            $c.find('.gesplacc-pag-btn').off('click').on('click', function () {
                var p = parseInt($(this).data('pagina'), 10);
                if (!isNaN(p)) self.irAPagina(p);
            });
        },

        _abrirModalNuevo: function () {
            var self  = this;
            this._cerrarModal();

            var today = new Date().toISOString().substring(0, 10);

            var opcsUsuarios = this.usuarios.map(function (u) {
                return '<option value="' + u.id + '">' + esc(u.name) + '</option>';
            }).join('');

            var itemKeys  = Object.keys(this.items);
            var opcsItems = itemKeys.map(function (k) {
                return '<option value="' + esc(k) + '">' + esc(k) + '</option>';
            }).join('');

            var html =
                '<div id="gesplacc-modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;' +
                    'background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">' +
                '<div style="background:#fff;border-radius:12px;width:100%;max-width:620px;max-height:92vh;' +
                    'overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +

                    '<div style="background:linear-gradient(135deg,#B8A279 0%,#D4C19C 100%);padding:20px 24px;' +
                        'border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;">' +
                        '<div style="display:flex;align-items:center;gap:12px;">' +
                            '<i class="fas fa-plus-circle" style="color:white;font-size:22px;"></i>' +
                            '<h4 style="margin:0;color:white;font-weight:700;">Nuevo Plan de Acción</h4>' +
                        '</div>' +
                        '<button id="gpa-btn-cerrar-x" style="background:rgba(255,255,255,0.2);border:none;color:white;' +
                            'width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;">&times;</button>' +
                    '</div>' +

                    '<div style="padding:24px;">' +
                        '<div style="display:grid;gap:16px;">' +

                            '<div>' +
                                '<label style="' + LABEL_STYLE + '">' + esc(self.etiquetaEjecutor) + ' *</label>' +
                                '<select id="gpa-asesorEjecutorId" style="' + INPUT_STYLE + 'background:#fff;">' +
                                    '<option value="">— Seleccionar —</option>' + opcsUsuarios +
                                '</select>' +
                            '</div>' +

                            '<div>' +
                                '<label style="' + LABEL_STYLE + '">Título del Plan *</label>' +
                                '<input id="gpa-titulo" type="text" placeholder="Ej: Mejorar técnicas de cierre..." style="' + INPUT_STYLE + '">' +
                            '</div>' +

                            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
                                '<div>' +
                                    '<label style="' + LABEL_STYLE + '">Fecha Inicio *</label>' +
                                    '<input id="gpa-fechaInicio" type="date" value="' + today + '" style="' + INPUT_STYLE + '">' +
                                '</div>' +
                                '<div>' +
                                    '<label style="' + LABEL_STYLE + '">Fecha Fin *</label>' +
                                    '<input id="gpa-fechaFin" type="date" style="' + INPUT_STYLE + '">' +
                                '</div>' +
                            '</div>' +

                            '<div>' +
                                '<label style="' + LABEL_STYLE + '">Competencia *</label>' +
                                '<select id="gpa-itemEvaluado" style="' + INPUT_STYLE + 'background:#fff;">' +
                                    '<option value="">— Seleccionar —</option>' + opcsItems +
                                '</select>' +
                            '</div>' +

                            '<div style="display:none;">' +
                                '<select id="gpa-subItemEvaluado">' +
                                    '<option value="-">-</option>' +
                                '</select>' +
                            '</div>' +

                            '<div>' +
                                '<label style="' + LABEL_STYLE + '">Plan de acción *</label>' +
                                '<textarea id="gpa-mensajeInicial" rows="4" ' +
                                    'placeholder="Describe el plan, los objetivos y los pasos a seguir..." ' +
                                    'style="' + INPUT_STYLE + 'resize:vertical;background:#fff;"></textarea>' +
                            '</div>' +

                        '</div>' +

                        '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid #e0e0e0;">' +
                            '<button id="gpa-btn-cancelar" style="padding:10px 20px;border:2px solid #B8A279;background:white;' +
                                'color:#B8A279;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">Cancelar</button>' +
                            '<button id="gpa-btn-guardar" style="padding:10px 24px;background:#B8A279;color:white;border:none;' +
                                'border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;">' +
                                '<i class="fas fa-save" style="margin-right:6px;"></i>Crear Plan</button>' +
                        '</div>' +
                    '</div>' +
                '</div></div>';

            $('body').append(html);

            $('#gpa-btn-cerrar-x, #gpa-btn-cancelar').on('click', function () { self._cerrarModal(); });

            $('#gesplacc-modal-overlay').on('click', function (e) {
                if ($(e.target).is('#gesplacc-modal-overlay')) self._cerrarModal();
            });

            $('#gpa-fechaInicio, #gpa-fechaFin').on('change', function () {
                var ini = $('#gpa-fechaInicio').val();
                var fin = $('#gpa-fechaFin').val();
                if (ini && fin && fin < ini) {
                    $('#gpa-fechaFin').css('border-color', '#dc3545');
                    $('#gpa-error-fecha').remove();
                    $('#gpa-fechaFin').after('<small id="gpa-error-fecha" style="color:#dc3545;">La fecha fin no puede ser anterior a la fecha inicio.</small>');
                } else {
                    $('#gpa-fechaFin').css('border-color', '#e0e0e0');
                    $('#gpa-error-fecha').remove();
                }
            });

            $('#gpa-itemEvaluado').on('change', function () {
                var itemSelec  = $(this).val();
                var $sub       = $('#gpa-subItemEvaluado');
                var subs       = (itemSelec && self.items[itemSelec]) ? self.items[itemSelec] : [];
                if (subs.length) {
                    var opcs = subs.map(function (s) {
                        return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
                    }).join('');
                    $sub.html('<option value="">— Seleccionar —</option>' + opcs).prop('disabled', false);
                } else {
                    $sub.html('<option value="">— Seleccionar ítem primero —</option>').prop('disabled', true);
                }
            });

            $('#gpa-btn-guardar').on('click', function () { self._guardarNuevo(); });
        },

        _guardarNuevo: function () {
            var self = this;

            var asesorId  = $('#gpa-asesorEjecutorId').val();
            var titulo    = $('#gpa-titulo').val().trim();
            var fechaIni  = $('#gpa-fechaInicio').val();
            var fechaFin  = $('#gpa-fechaFin').val();
            var item      = $('#gpa-itemEvaluado').val();
            var subItem   = '-';
            var mensaje   = $('#gpa-mensajeInicial').val().trim();

            var errores = [];
            if (!asesorId)  errores.push(self.etiquetaEjecutor);
            if (!titulo)    errores.push('Título del Plan');
            if (!fechaIni)  errores.push('Fecha Inicio');
            if (!fechaFin)  errores.push('Fecha Fin');
            if (!item)      errores.push('Ítem evaluado');
            if (!mensaje)   errores.push('Mensaje inicial');

            if (errores.length) {
                Espo.Ui.warning('Completa los campos obligatorios: ' + errores.join(', ') + '.');
                return;
            }

            if (fechaFin < fechaIni) {
                Espo.Ui.warning('La fecha fin no puede ser anterior a la fecha inicio.');
                return;
            }

            var asesorObj    = self.usuarios.filter(function (u) { return u.id === asesorId; })[0];
            var asesorNombre = asesorObj ? asesorObj.name : '';

            var data = {
                name:                        titulo,
                titulo:                      titulo,
                asesorGeneradorId:           self.usuarioId,
                rolGenerador:                self.usuarioRol,
                asesorEjecutorId:            asesorId,
                asesorEjecutorName:          asesorNombre,
                rolEjecutor:                 'Asesor',
                modulo:                      self.modulo,
                equipoId:                    self.oficina || null,
                fechaInicio:                 fechaIni + ' 00:00:00',
                fechaFin:                    fechaFin + ' 23:59:59',
                estado:                      'pendienteGDC',
                itemEvaluado:                item,
                subItemEvaluado:             subItem,
                fechaActualizacionGenerador: nowISO()
            };

            $('#gpa-btn-guardar').prop('disabled', true).text('Guardando...');

            self.view.getModelFactory().create('GesPlaAccPlanAccion', function (model) {
                model.set(data);
                model.save()
                    .then(function () {
                        self.view.getModelFactory().create('GesPlaAccChat', function (chat) {
                            chat.set({
                                name:          'Mensaje inicial',
                                planAccionId:  model.id,
                                texto:         mensaje,
                                fechaCreacion: nowISO(),
                                autorId:       self.usuarioId,
                                rolAutor:      self.usuarioRol
                            });
                            chat.save();
                        });
                        self._cerrarModal();
                        Espo.Ui.success('Plan de acción creado correctamente.');
                        setTimeout(function () { self.cargar(); }, 800);
                    })
                    .catch(function () {
                        $('#gpa-btn-guardar').prop('disabled', false).html('<i class="fas fa-save" style="margin-right:6px;"></i>Crear Plan');
                        Espo.Ui.error('Error al guardar el plan de acción.');
                    });
            });
        },

        _abrirModalVer: function (planId) {
            var self = this;
            this._cerrarModal();
            this.planActualId = planId;

            Promise.all([
                Espo.Ajax.getRequest('GesPlaAccPlanAccion/' + planId),
                Espo.Ajax.getRequest('GesPlaAccChat', {
                    'where[0][type]':      'equals',
                    'where[0][attribute]': 'planAccionId',
                    'where[0][value]':     planId,
                    orderBy:               'fechaCreacion',
                    order:                 'asc',
                    maxSize:               200
                })
            ]).then(function (results) {
                self.planActualData = results[0];
                self.chats          = results[1].list || [];
                self._renderModalVer();
            }).catch(function () {
                Espo.Ui.error('Error al cargar el plan de acción.');
            });
        },

        _renderModalVer: function () {
            var self  = this;
            var plan  = this.planActualData;
            var b     = this._badge(plan.estado);
            var puedeGestionar = this.esCasaNacional;

            var chatHtml = this.chats.length === 0
                ? '<div style="text-align:center;padding:30px;color:#999;">' +
                  '<i class="fas fa-comments" style="font-size:2em;margin-bottom:10px;display:block;"></i>Sin mensajes aún</div>'
                : this.chats.map(function (msg) { return buildMensajeHtml(msg, self.usuarioId); }).join('');

            var botonesEstado = '';
            if (puedeGestionar && plan.estado !== 'completado' && plan.estado !== 'cancelado') {
                botonesEstado =
                    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">' +
                    '<button id="gpa-btn-terminar" style="padding:6px 14px;background:#28a745;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">' +
                        '<i class="fas fa-check-circle" style="margin-right:4px;"></i>Completar</button>' +
                    (plan.estado !== 'pausado'
                        ? '<button id="gpa-btn-pausar" style="padding:6px 14px;background:#6c757d;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">' +
                          '<i class="fas fa-pause" style="margin-right:4px;"></i>Pausar</button>' : '') +
                    '<button id="gpa-btn-cancelar-plan" style="padding:6px 14px;background:#dc3545;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">' +
                        '<i class="fas fa-times-circle" style="margin-right:4px;"></i>Cancelar Plan</button>' +
                    '</div>';
            }

            var mostrarInput = plan.estado !== 'completado' && plan.estado !== 'cancelado';
            var inputChat = mostrarInput
                ? '<div style="display:flex;gap:10px;align-items:flex-end;">' +
                  '<textarea id="gpa-chatTexto" rows="2" placeholder="Escribe un mensaje... (Enter para enviar)" ' +
                  'style="flex:1;border:2px solid #e0e0e0;border-radius:8px;padding:10px 12px;font-size:14px;resize:none;"></textarea>' +
                  '<button id="gpa-btn-enviar" style="padding:10px 16px;background:#B8A279;color:white;border:none;' +
                  'border-radius:8px;font-weight:600;cursor:pointer;"><i class="fas fa-paper-plane"></i></button>' +
                  '</div>'
                : '<div style="text-align:center;padding:12px;background:#f8f9fa;border-radius:8px;color:#888;font-size:14px;">' +
                  '<i class="fas fa-lock" style="margin-right:6px;"></i>Plan ' + (plan.estado === 'completado' ? 'completado' : 'cancelado') + '. No se pueden agregar mensajes.</div>';

            var infoExtra = (plan.itemEvaluado || plan.asesorGeneradorName)
                ? '<div style="padding:12px 24px;background:#fafafa;border-bottom:1px solid #e0e0e0;flex-shrink:0;font-size:13px;color:#555;">' +
                  (plan.itemEvaluado ? '<i class="fas fa-tag" style="margin-right:6px;color:#B8A279;"></i>' +
                  '<strong>Ítem:</strong> ' + esc(plan.itemEvaluado) +
                  (plan.subItemEvaluado ? ' › ' + esc(plan.subItemEvaluado) : '') + '&nbsp;&nbsp;|&nbsp;&nbsp;' : '') +
                  '<strong>Generado por:</strong> ' + esc(plan.asesorGeneradorName || '—') + ' (' + esc(plan.rolGenerador || '—') + ')' +
                  '</div>'
                : '';

            $('body').append(
                '<div id="gesplacc-modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;' +
                    'background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">' +
                '<div style="background:#fff;border-radius:12px;width:100%;max-width:700px;max-height:90vh;' +
                    'display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +

                    '<div style="background:linear-gradient(135deg,#B8A279 0%,#D4C19C 100%);padding:20px 24px;' +
                        'border-radius:12px 12px 0 0;flex-shrink:0;">' +
                        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">' +
                            '<div style="flex:1;">' +
                                '<h4 style="margin:0 0 6px;color:white;font-weight:700;">' + esc(plan.titulo || 'Plan de Acción') + '</h4>' +
                                '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
                                    '<span style="background:' + b.bg + ';color:' + b.color + ';padding:3px 10px;' +
                                        'border-radius:20px;font-size:0.8rem;font-weight:600;" class="gpa-estado-badge">' + b.texto + '</span>' +
                                    '<span style="color:rgba(255,255,255,0.9);font-size:0.85rem;">' +
                                        '<i class="fas fa-user" style="margin-right:4px;"></i>' + esc(plan.asesorEjecutorName || '—') + '</span>' +
                                    '<span style="color:rgba(255,255,255,0.9);font-size:0.85rem;">' +
                                        '<i class="fas fa-calendar" style="margin-right:4px;"></i>' +
                                        fmtFecha(plan.fechaInicio) + ' – ' + fmtFecha(plan.fechaFin) + '</span>' +
                                '</div>' +
                            '</div>' +
                            '<button id="gpa-btn-cerrar-ver" style="background:rgba(255,255,255,0.2);border:none;color:white;' +
                                'width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;flex-shrink:0;">&times;</button>' +
                        '</div>' +
                    '</div>' +

                    infoExtra +

                    '<div style="flex:1;overflow-y:auto;padding:20px 24px;">' +
                        botonesEstado +
                        '<div id="gpa-chat-area" style="min-height:200px;max-height:320px;overflow-y:auto;' +
                            'border:1px solid #e0e0e0;border-radius:10px;padding:12px;background:#fff;margin-bottom:16px;">' +
                            chatHtml +
                        '</div>' +
                        inputChat +
                    '</div>' +

                '</div></div>'
            );

            var $chat = $('#gpa-chat-area');
            $chat.scrollTop($chat[0].scrollHeight);

            $('#gpa-btn-cerrar-ver').on('click', function () {
                self._cerrarModalYRecargar();
            });
            $('#gesplacc-modal-overlay').on('click', function (e) {
                if ($(e.target).is('#gesplacc-modal-overlay')) self._cerrarModalYRecargar();
            });

            if ($('#gpa-btn-terminar').length)     $('#gpa-btn-terminar').on('click',     function () { self._cambiarEstado('completado'); });
            if ($('#gpa-btn-pausar').length)        $('#gpa-btn-pausar').on('click',        function () { self._cambiarEstado('pausado'); });
            if ($('#gpa-btn-cancelar-plan').length) $('#gpa-btn-cancelar-plan').on('click', function () { self._cambiarEstado('cancelado'); });

            if ($('#gpa-btn-enviar').length) {
                $('#gpa-btn-enviar').on('click', function () { self._enviarMensaje(); });
                $('#gpa-chatTexto').on('keydown', function (e) {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self._enviarMensaje(); }
                });
            }
        },

        _enviarMensaje: function () {
            var self  = this;
            var texto = $('#gpa-chatTexto').val().trim();
            if (!texto) return;

            var now     = nowISO();
            var nuevoEstado = this.esCasaNacional ? 'pendienteGDC' : 'pendienteCN';
            var rolAutor    = this.usuarioRol;

            this.view.getModelFactory().create('GesPlaAccChat', function (model) {
                model.set({
                    name:          'Chat ' + self.planActualId,
                    planAccionId:  self.planActualId,
                    texto:         texto,
                    fechaCreacion: now,
                    autorId:       self.usuarioId,
                    rolAutor:      rolAutor
                });
                model.save().then(function () {
                    self.view.getModelFactory().create('GesPlaAccPlanAccion', function (planModel) {
                        planModel.id = self.planActualId;
                        planModel.fetch().then(function () {
                            var upd = { estado: nuevoEstado };
                            if (self.esCasaNacional) upd.fechaActualizacionGenerador = now;
                            else                     upd.fechaActualizacionEjecutor  = now;
                            planModel.set(upd);
                            planModel.save();
                        });
                    });

                    self.planActualData.estado = nuevoEstado;
                    var b = self._badge(nuevoEstado);
                    $('#gesplacc-modal-overlay .gpa-estado-badge')
                        .css({ background: b.bg, color: b.color }).text(b.texto);

                    self.chats.push({
                        autorId:       self.usuarioId,
                        autorNombre:   self.usuarioNombre,
                        rolAutor:      rolAutor,
                        texto:         texto,
                        fechaCreacion: now
                    });
                    $('#gpa-chatTexto').val('');
                    var $chat = $('#gpa-chat-area');
                    $chat.html(self.chats.map(function (msg) { return buildMensajeHtml(msg, self.usuarioId); }).join(''));
                    $chat.scrollTop($chat[0].scrollHeight);

                }).catch(function () { Espo.Ui.error('Error al enviar el mensaje.'); });
            });
        },

        _cambiarEstado: function (nuevoEstado) {
            var self = this;
            var now  = nowISO();

            this.view.getModelFactory().create('GesPlaAccPlanAccion', function (model) {
                model.id = self.planActualId;
                model.fetch().then(function () {
                    var upd = { estado: nuevoEstado };
                    if (self.esCasaNacional) upd.fechaActualizacionGenerador = now;
                    else                     upd.fechaActualizacionEjecutor  = now;
                    model.set(upd);
                    model.save().then(function () {
                        self._cerrarModal();
                        Espo.Ui.success('Estado del plan actualizado.');
                        setTimeout(function () { self.cargar(); }, 600);
                    }).catch(function () { Espo.Ui.error('Error al cambiar el estado.'); });
                });
            });
        },

        _cerrarModalYRecargar: function () {
            this._cerrarModal();
            this.cargar();
        },

        cerrarModal: function () { this._cerrarModal(); },
        _cerrarModal: function () { $('#gesplacc-modal-overlay').remove(); }
    };

    return PlanesAccionManager;
});