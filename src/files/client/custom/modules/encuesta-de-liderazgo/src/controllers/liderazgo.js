define('encuesta-de-liderazgo:controllers/liderazgo', ['controllers/base'], function (Dep) {
    
    return Dep.extend({
        
        defaultAction: 'index',
        
        actionIndex: function () {
            // Limpiar cualquier vista anterior
            this.clearView();
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
            
            // Limpiar cualquier vista anterior
            this.clearView();
            this.main('encuesta-de-liderazgo:views/admin');
        },
        
        actionCategoria: function (options) {
            console.log('actionCategoria llamada con options:', options);
            
            var categoriaNombre = '';
            var filtrosParam = '';
            
            // Obtener parámetros
            if (options && options.categoria) {
                categoriaNombre = decodeURIComponent(options.categoria);
                // El segundo parámetro son los filtros compuestos
                if (options.filtros) {
                    filtrosParam = options.filtros;
                }
            } else {
                // Parsear desde URL
                var currentUrl = this.getRouter().getCurrentUrl();
                console.log('Current URL:', currentUrl);
                
                var match = currentUrl.match(/categoria\/([^\/]+)\/([^\/\?]+)/);
                if (match && match[1]) {
                    categoriaNombre = decodeURIComponent(match[1]);
                    filtrosParam = match[2];
                    console.log('Categoría desde URL:', categoriaNombre, 'Filtros:', filtrosParam);
                }
            }
            
            console.log('Categoría a cargar:', categoriaNombre, 'con filtros:', filtrosParam);
            
            if (!categoriaNombre) {
                console.error('No se pudo determinar el nombre de la categoría');
                Espo.Ui.warning('No se especificó una categoría válida');
                this.getRouter().navigate('#Liderazgo', {trigger: true});
                return;
            }
            
            console.log('Cargando vista categoria-detalle para:', categoriaNombre);
            
            // Cargar la vista con el nombre de la categoría y filtros
            this.main('encuesta-de-liderazgo:views/categoria-detalle', {
                categoriaNombre: categoriaNombre,
                filtros: filtrosParam
            });
        },
        // Método para limpiar vistas anteriores
        clearView: function() {
            if (this.view) {
                this.view.remove();
                this.view = null;
            }
            // También limpiar el contenedor principal
            $('#main').empty();
        }
        
    });
});