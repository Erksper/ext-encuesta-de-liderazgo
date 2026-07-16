define('encuesta-de-liderazgo:views/en-construccion', ['view'], function (View) {

    return View.extend({

        template: 'encuesta-de-liderazgo:en-construccion',

        data: function () {
            return {
                titulo: this.options.titulo || 'Próximamente'
            };
        }

    });
});
