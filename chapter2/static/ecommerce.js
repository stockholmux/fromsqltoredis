angular
  .module('ecommerce', [])
  .controller(
    'ItemsCtrl',
    function($scope,$http,$window) {
      var
        getDetailOfCompanies,
        getDetailOfItems,
        getItemsByPrice,
        resultSize = 100;

      $scope.companies = {};

      getDetailOfCompanies = function(slugs) {
        $http
          .post(
            '/api/companies',
            slugs
          )
          .then(function(response) {
            response.data.forEach(function(aCompany,index) {
              $scope.companies[slugs[index]] = aCompany  
            });
          });
      };
      
      getDetailOfItems = function(slugs) {
        $http
          .post(
            '/api/items',
            slugs
          )
          .then(function(response) {
            var
              companiesSlugs = {};

            $scope.items = slugs.map(function(aSlug,index) {
              return response.data[index];
            });
            $scope.items.forEach(function(anItem) {
              companiesSlugs[anItem.manufacturer] = true;
            });
            $window.scrollTo(0, 0);
            getDetailOfCompanies(Object.keys(companiesSlugs));
          });
      };

      getItemsByPrice = function(startAt) {
        $http
          .get('/api/items-by-price/'+startAt)
          .then(function(response) {
            getDetailOfItems(response.data.items);
          });
      };

      $scope.nextPage = function() {
        $scope.currentOffset += resultSize;
        getItemsByPrice($scope.currentOffset);
      };
      $scope.prevPage = function() {
        if ($scope.currentOffset > 0) {
          $scope.currentOffset -= resultSize;
          getItemsByPrice($scope.currentOffset);
        }
      }

      $scope.currentOffset = 0;
      getItemsByPrice($scope.currentOffset);
    }
  );
