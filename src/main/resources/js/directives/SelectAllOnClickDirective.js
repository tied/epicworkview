(
    function() {
        angular.module('myApp').directive('selectonclick', function() {
            return {
                restrict: 'A',
                link: function(scope, element) {
                    element.on('click',function() {
                        this.select();
                    });
                }
            };
        });
    }()
);