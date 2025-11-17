define('encuesta-de-liderazgo:controllers/liderazgo', ['controllers/base'], function (Dep) {
    
    return Dep.extend({
        
        defaultAction: 'index',
        
        actionIndex: function () {
            this.main('encuesta-de-liderazgo:views/evaluacion-general', {
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
            var categoriaNombre = '';
            
            // Obtener el nombre de la categoría de diferentes formas posibles
            if (options && options.categoria) {
                categoriaNombre = decodeURIComponent(options.categoria);
            } else {
                // Intentar obtenerlo de la URL directamente
                var hash = window.location.hash;
                var match = hash.match(/categoria\/([^\/]+)/);
                if (match && match[1]) {
                    categoriaNombre = decodeURIComponent(match[1]);
                }
            }
            
            console.log('Cargando categoría detalle:', categoriaNombre);
            
            if (!categoriaNombre) {
                Espo.Ui.warning('No se especificó una categoría');
                this.getRouter().navigate('#Liderazgo', {trigger: true});
                return;
            }
            
            this.main('encuesta-de-liderazgo:views/categoria-detalle', {
                categoriaNombre: categoriaNombre,
                categoriaId: null
            });
        }
        
    });
});