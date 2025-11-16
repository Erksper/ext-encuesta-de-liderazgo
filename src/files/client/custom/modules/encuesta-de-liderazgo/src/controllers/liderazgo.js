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
            var categoriaNombre = options.categoria || '';
            
            if (categoriaNombre) {
                categoriaNombre = decodeURIComponent(categoriaNombre);
            }
            
            this.main('encuesta-de-liderazgo:views/categoria-detalle', {
                categoriaNombre: categoriaNombre,
                categoriaId: null
            });
        }
        
    });
});