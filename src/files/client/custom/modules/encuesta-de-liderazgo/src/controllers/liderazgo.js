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
            console.log('🎯🎯🎯 ACTION CATEGORIA EJECUTADO 🎯🎯🎯');
            console.log('Options recibidas:', options);
            console.log('Tipo de options:', typeof options);
            
            var categoriaNombre = '';
            var filtrosParam = '';
            
            // CORRECCIÓN: options es directamente el string de filtros, no un objeto
            if (options && typeof options === 'string') {
                filtrosParam = options;
                console.log('✅ Filtros recibidos como string:', filtrosParam);
                
                // Parsear los filtros para extraer la categoría
                var partes = filtrosParam.split('-');
                console.log('Partes de filtros:', partes);
                
                if (partes.length >= 5) {
                    // La categoría es el primer parámetro
                    categoriaNombre = partes[0] !== 'null' ? decodeURIComponent(partes[0]) : '';
                    console.log('✅ Categoría extraída:', categoriaNombre);
                    
                    // Reconstruir filtros sin la categoría
                    var filtrosReales = {
                        anio: partes[1] !== 'null' ? partes[1] : null,
                        cla: partes[2] !== 'null' ? partes[2] : null,
                        oficina: partes[3] !== 'null' ? partes[3] : null,
                        usuario: partes[4] !== 'null' ? partes[4] : null
                    };
                    
                    console.log('✅ Filtros parseados:', filtrosReales);
                    
                    // Convertir filtros a string para categoria-detalle
                    var filtrosString = filtrosReales.anio + '-' + filtrosReales.cla + '-' + 
                                    filtrosReales.oficina + '-' + filtrosReales.usuario;
                    
                    console.log('📝 Cargando vista categoria-detalle con:', {
                        categoriaNombre: categoriaNombre,
                        filtros: filtrosString
                    });
                    
                    // Cargar la vista con los parámetros
                    this.main('encuesta-de-liderazgo:views/categoria-detalle', {
                        categoriaNombre: categoriaNombre,
                        filtros: filtrosString
                    });
                    
                } else {
                    console.error('❌ Formato de filtros incorrecto. Partes:', partes.length);
                    Espo.Ui.error('Error en los parámetros de la categoría');
                    this.getRouter().navigate('#Liderazgo', {trigger: true});
                    return;
                }
            } else {
                console.error('❌ Options no es un string válido:', options);
                Espo.Ui.error('No se especificó una categoría');
                this.getRouter().navigate('#Liderazgo', {trigger: true});
                return;
            }
            
            console.log('✅ Vista categoria-detalle solicitada');
        }
        
    });
});