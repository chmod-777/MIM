var MIM = angular.module('starter.controllers', ['starter.services',
                                                 'ngCordova',
                                                 'chart.js']);
var db = null;

MIM.controller('AppController', function ($location) {
  $location.path('/app/config');
});

MIM.controller('ConfigController', function ($ionicPlatform, $ionicLoading, $location, $ionicHistory) {
  $ionicHistory.nextViewOptions({
    disableAnimate: true,
    disableBack: true,
  });

  $ionicPlatform.ready(function () {
    $ionicLoading.show({
      template: 'Loading...',
    });
    if (window.cordova) {
      window.plugins.sqlDB.copy('MIM.db', 0, function () {
        db = window.sqlitePlugin.openDatabase({name: 'MIM.db'});
        $ionicLoading.hide();
        $location.path('/app/customer');
      }, function (error) {
        console.error('There was an error copying the database: ' + error);
        db = window.sqlitePlugin.openDatabase({name: 'MIM.db'});
        $ionicLoading.hide();
        $location.path('/app/customer');
      });
    } else {
      console.log('You are using browser to test and run the app.');
      console.log('WebSQL has been deprecated http://dev.w3.org/html5/webdatabase/');
      console.log('Please, use the mobile device or emulator instead of browser.');
    }
  });
});

MIM.controller('SalesController', function ($scope, $ionicPlatform, $cordovaSQLite, $ionicPopup, Customer) {
  $scope.customers = [];
  $scope.products = [];

  Customer.all().then(function (customers) {
    $scope.customers = customers;
  });

  var productQuery = 'SELECT id, name FROM Products WHERE remaining_amount > 0';
  $cordovaSQLite.execute(db, productQuery, []).then(function (res) {
    if (res.rows.length) {
      for (var i = 0; i < res.rows.length; i++) {
        $scope.products.push({
          id: res.rows.item(i).id,
          product_name: res.rows.item(i).name,
        });
      }
    }
  }, function (error) {
    console.error(error);
  });

  $scope.addSale = function (saleData) {
    var transactQuery = 'INSERT INTO Transactions (categories, total_price, ' +
      'status, customer_id) VALUES (?, ?, ?, ?)';
    var buyQuery = 'INSERT INTO Buying (transaction_id, product_id, amount) VALUES (?, ?, ?)';
    $cordovaSQLite.execute(db, transactQuery, ["P", saleData.total_price, "1", saleData.customers]).then(function (tx) {
      $cordovaSQLite.execute(db, buyQuery, [tx.insertId, saleData.products, saleData.amount]).then(function (res) {
        console.log('Customer id ' + saleData.customers + ' and Transaction id ' +
          tx.insertId + ' are successfully inserted.');
        $scope.getRemainingAmount(saleData.products, saleData.amount);
        $scope.updateProductAmount(saleData.products, saleData.amount);
        $scope.showAlert();
        saleData.newItem = '';
      }, function (error) {
        console.error(error);
      });
    });
  };

  $scope.getRemainingAmount = function (id, amount) {
    var query = 'SELECT remaining_amount FROM Products WHERE id = ?';
    $cordovaSQLite.execute(db, query, [id]).then(function (res) {
      if (res.rows.length) {
        $scope.remaining_amount = res.rows.item(0).remaining_amount - amount;
        $scope.updateProductAmount(id, $scope.remaining_amount);
      }
    }, function (error) {
      console.error(error);
    });
  };

  $scope.updateProductAmount = function (id, remaining_amount) {
    var query = 'UPDATE Products SET remaining_amount = ? WHERE id = ?';
    $cordovaSQLite.execute(db, query, [remaining_amount, id]).then(function (res) {
      console.log('one row is affected');
    }, function (error) {
      console.error(error);
    });
  };

  $scope.showAlert = function () {
    var alertPopup = $ionicPopup.alert({
      title: 'Success',
      template: 'A new transaction has been added',
    });
    alertPopup.then(function (res) {
      console.log('Transaction is successfully added.');
    });
  };
});

MIM.controller('SalesOrderController', function ($scope, $ionicPlatform, $cordovaSQLite, $ionicModal, $ionicPopup, Customer, Product) {
  $scope.customers = [];
  $scope.products = [];
  $scope.orders = [];

  Customer.all().then(function (customers) {
    $scope.customers = customers;
  });

  Product.all().then(function (products) {
    $scope.products = products;
  });

    var query = 'SELECT t.id AS id, c.name AS name FROM Transactions t, Customers c ' +
      'WHERE categories = ? AND t.customer_id = c.id';
    $cordovaSQLite.execute(db, query, ["O"]).then(function (res) {
      if (res.rows.length) {
        for (var i = 0; i < res.rows.length; i++) {
          $scope.orders.push({
            id: res.rows.item(i).id,
            customer_name: res.rows.item(i).name,
          });
        }
      }
    }, function (error) {
      console.error(error);
    });

  $scope.addOrder = function (ordersData) {
    var transactQuery = 'INSERT INTO Transactions (categories, total_price, ' +
      'status, customer_id) VALUES (?, ?, ?, ?)';
    var orderQuery = 'INSERT INTO Buying (transaction_id, product_id, amount) VALUES (?, ?, ?)';
    var query = 'SELECT name FROM Customers WHERE id = ?';
    $cordovaSQLite.execute(db, transactQuery, ["O", ordersData.total_price, "0", ordersData.customers]).then(function (tx) {
      $cordovaSQLite.execute(db, orderQuery, [tx.insertId, ordersData.products, ordersData.amount]).then(function (res) {
        $cordovaSQLite.execute(db, query, [ordersData.customers]).then(function (res) {
          if (res.rows.length) {
            $scope.orders.push({
              id: tx.insertId,
              customer_name: res.rows.item(0).name,
            });
            ordersData.newItem = '';
            $scope.closeOrderModal();
            console.log('Customer id ' + ordersData.customers + ' and ' +
              'Transaction id ' + tx.insertId + ' are successfully inserted.');
          }
        }, function (error) {
          console.error(error);
        });
      });
    });
  };

  $ionicModal.fromTemplateUrl('templates/add_order.html', {
    scope: $scope,
    animation: 'slide-in-up',
  }).then(function (modal) {
    $scope.modal = modal;
  });

  $scope.openOrderModal = function () {
    $scope.modal.show();
  };

  $scope.closeOrderModal = function () {
    $scope.modal.hide();
  };

  $scope.$on('$destroy', function () {
    $scope.modal.remove();
  });

  $scope.deleteOrder = function (order) {
    var confirmPopup = $ionicPopup.confirm({
      title: 'Delete an Order',
      template: 'Are you sure you want to delete this sale order?',
    });
    confirmPopup.then(function (res) {
      if (res) {
        var outerQuery = 'DELETE FROM Buying WHERE transaction_id = ?';
        var innerQuery = 'DELETE FROM Transactions WHERE id = ?';
        $cordovaSQLite.execute(db, outerQuery, [order.id]).then(function (tx) {
          $cordovaSQLite.execute(db, innerQuery, [order.id]).then(function (tx) {
            $scope.orders.splice($scope.orders.indexOf(order), 1);
          });
        }, function (error) {
          console.error(error);
        });
      } else {
        console.log('You cancel deleting this sale order.');
      }
    });
  };
});

MIM.controller('OrderDetailController', function ($scope, $ionicPlatform, $cordovaSQLite, $stateParams) {
  $ionicPlatform.ready(function () {
    var query = 'SELECT p.name AS name, b.amount AS amount, t.total_price ' +
      'AS total_price FROM Transactions t, Buying b, Products p WHERE ' +
      't.id = b.transaction_id AND b.product_id = p.id AND t.id = ?';
    $cordovaSQLite.execute(db, query, [$stateParams.orderId]).then(function (res) {
      if (res.rows.length) {
          $scope.product_name = res.rows.item(0).name;
          $scope.order_amount = res.rows.item(0).amount;
          $scope.order_price = res.rows.item(0).total_price;
      }
    }, function (error) {
      console.error(error);
    });
  });
});

MIM.controller('AddInventoryController', function ($scope, $cordovaSQLite, $ionicPopup) {
  $scope.addProduct = function (productData) {
    var query = 'INSERT INTO Products (name, description, remaining_amount, ' +
      'selling_price, purchase_price) VALUES (?, ?, ?, ?, ?)';
    $cordovaSQLite.execute(db, query, [productData.name, productData.description, productData.amount, productData.selling_price, productData.purchase_price]).then(function (res) {
      console.log('Item ' + res.insertId + ' is successfully inserted.');
      $scope.showAlert();
      productData.newItem = '';
    }, function (error) {
      console.error(error);
    });
  };

  $scope.showAlert = function () {
    var alertPopup = $ionicPopup.alert({
      title: 'Success',
      template: 'A new item has been added',
    });
    alertPopup.then(function (res) {
      console.log('Item is successfully inserted.');
    });
  };
});

MIM.controller('InventoryItemsController', function ($scope, $ionicPlatform, $cordovaSQLite, $ionicModal, $ionicPopup) {
  $scope.inventory = [];
  $ionicPlatform.ready(function () {
    var query = 'SELECT id, name, remaining_amount FROM Products ORDER BY remaining_amount DESC';
    $cordovaSQLite.execute(db, query, []).then(function (res) {
      if (res.rows.length) {
        for (var i = 0; i < res.rows.length; i++) {
          $scope.inventory.push({
            id: res.rows.item(i).id,
            product_name: res.rows.item(i).name,
            product_amount: res.rows.item(i).remaining_amount,
          });
        }
      }
    }, function (error) {
      console.error(error);
    });
  });

  $scope.editItem = function (productData) {
    var query = 'UPDATE Products SET name = ?, description = ?, ' +
      'selling_price = ?, purchase_price = ?, updated_at = DATETIME(\'now\') WHERE id = ?';
    $cordovaSQLite.execute(db, query, [productData.name, productData.description, productData.selling_price, productData.purchase_price, productData.id]).then(function (res) {
      console.log('Item ' + productData.id + ' is updated.');
      productData.newItem = '';
      $scope.closeItemModal();
    }, function (error) {
      console.error(error);
    });
  };

  $ionicModal.fromTemplateUrl('templates/edit_item.html', {
    scope: $scope,
    animation: 'slide-in-up',
  }).then(function (modal) {
    $scope.modal = modal;
  });

  $scope.openItemModal = function (item) {
    $scope.productData = {};
    var query = 'SELECT id, name, description, remaining_amount, selling_price, ' +
      'purchase_price FROM Products WHERE id = ?';
    $cordovaSQLite.execute(db, query, [item.id]).then(function (res) {
      if (res.rows.length) {
        $scope.productData.id = res.rows.item(0).id;
        $scope.productData.name = res.rows.item(0).name;
        $scope.productData.description = res.rows.item(0).description;
        $scope.productData.amount = res.rows.item(0).remaining_amount;
        $scope.productData.purchase_price = res.rows.item(0).purchase_price;
        $scope.productData.selling_price = res.rows.item(0).selling_price;
      }
    }, function (error) {
      console.error(error);
    });
    $scope.modal.show();
  };

  $scope.closeItemModal = function () {
    $scope.modal.hide();
  };

  $scope.$on('$destroy', function () {
    $scope.modal.remove();
  });

  $scope.deleteItem = function (item) {
    var confirmPopup = $ionicPopup.confirm({
      title: 'Delete an Item',
      template: 'Are you sure you want to delete this item?',
    });
    confirmPopup.then(function (res) {
      if (res) {
        var query = 'DELETE FROM Products WHERE id = ?';
        $cordovaSQLite.execute(db, query, [item.id]).then(function (tx) {
          $scope.inventory.splice($scope.inventory.indexOf(item), 1);
        }, function (error) {
          console.error(error);
        });
      } else {
        console.log('You cancel deleting this item.');
      }
    });
  };
});

MIM.controller('ItemDetailController', function ($scope, $ionicPlatform, $cordovaSQLite, $stateParams) {
  $ionicPlatform.ready(function () {
    var query = 'SELECT name, description, remaining_amount, selling_price, ' +
      'purchase_price, DATETIME(created_at, \'localtime\') AS created_date, ' +
      'DATETIME(updated_at, \'localtime\') AS updated_date ' +
      'FROM Products WHERE id = ?';
    $cordovaSQLite.execute(db, query, [$stateParams.itemId]).then(function (res) {
      if (res.rows.length) {
        $scope.product_name = res.rows.item(0).name;
        $scope.product_description = res.rows.item(0).description;
        $scope.product_amount = res.rows.item(0).remaining_amount;
        $scope.purchase_price = res.rows.item(0).selling_price;
        $scope.selling_price = res.rows.item(0).purchase_price;
        $scope.created_date = res.rows.item(0).created_date;
        $scope.updated_date = res.rows.item(0).updated_date;
      }
    }, function (error) {
      console.error(error);
    });
  });
});

MIM.controller('CustomerController', function ($scope, $ionicPlatform, $cordovaSQLite, $ionicModal, $ionicPopup, Customer) {
  $scope.customers = [];

  Customer.all().then(function (customers) {
    $scope.customers = customers;
  });

  $scope.addCustomer = function (customersData) {
    var query = 'INSERT INTO Customers (name, address, telephone_number) VALUES (?, ?, ?)';
    $cordovaSQLite.execute(db, query, [customersData.name, customersData.address, customersData.phone]).then(function (res) {
      $scope.customers.push({
        id: res.insertId,
        customer_name: customersData.name,
        customer_address: customersData.address,
        customer_phone: customersData.phone,
      });
      customersData.newItem = '';
      $scope.closeCustomerModal(1);
    }, function (error) {
      console.error(error);
    });
  };

  $scope.editCustomer = function (customersData) {
    var query = 'UPDATE Customers SET name = ?, address = ?, telephone_number = ?, ' +
      'updated_at = DATETIME(\'now\') WHERE id = ?';
    $cordovaSQLite.execute(db, query, [customersData.name, customersData.address, customersData.phone, customersData.id]).then(function (res) {
      console.log('Item ' + customersData.id + ' is updated.');
      customersData.newItem = '';
      $scope.closeCustomerModal(2);
    }, function (error) {
      console.error(error);
    });
  };

  $ionicModal.fromTemplateUrl('templates/add_customer.html', {
    id: '1',
    scope: $scope,
    animation: 'slide-in-up',
  }).then(function (modal) {
    $scope.addModal = modal;
  });

  $ionicModal.fromTemplateUrl('templates/edit_customer.html', {
    id: '2',
    scope: $scope,
    animation: 'slide-in-up',
  }).then(function (modal) {
    $scope.editModal = modal;
  });

  $scope.openCustomerModal = function (index, customer) {
    $scope.customersData = {};

    if (index === 1) {
      $scope.addModal.show();
    } else {
      Customer.get(customer.id).then(function (customerData) {
        $scope.customersData.id = customerData.id;
        $scope.customersData.name = customerData.name;
        $scope.customersData.address = customerData.address;
        $scope.customersData.phone = customerData.telephone_number;
      });
      $scope.editModal.show();
    }
  };

  $scope.closeCustomerModal = function (index) {
    if (index === 1) {
      $scope.addModal.hide();
    } else {
      $scope.editModal.hide();
    }
  };

  $scope.$on('$destroy', function () {
    $scope.addModal.remove();
    $scope.editModal.remove();
  });

  $scope.deleteCustomer = function (customer) {
    var confirmPopup = $ionicPopup.confirm({
      title: 'Delete Customer',
      template: 'Are you sure you want to delete this customer?',
    });
    confirmPopup.then(function (res) {
      if (res) {
        var query = 'DELETE FROM Customers WHERE id = ?';
        $cordovaSQLite.execute(db, query, [customer.id]).then(function (tx) {
          $scope.customers.splice($scope.customers.indexOf(customer), 1);
        }, function (error) {
          console.error(error);
        });
      } else {
        console.log('You cancel deleting this customer.');
      }
    });
  };
});

MIM.controller('CustomerDetailController', function ($scope, $stateParams, Customer) {
  Customer.get($stateParams.customerId).then(function (customerDetail) {
    $scope.customer_name = customerDetail.name;
    $scope.customer_address = customerDetail.address;
    $scope.customer_phone = customerDetail.telephone_number;
    $scope.customer_joined = customerDetail.joined_date;
    $scope.customer_updated = customerDetail.updated_date;
  });
});

MIM.controller('StatisticsController', function ($scope, $ionicPlatform, $cordovaSQLite) {
  $scope.month_year = [];
  $scope.monthly_transaction = [];
  $scope.monthly_income = [];
  $scope.series = ["month-year"];
  $scope.count = [];
  $scope.total_price = [];
  $ionicPlatform.ready(function () {
    var transactionQuery = 'SELECT strftime(\'%m-%Y\', date) AS month_year, COUNT(id) AS total_transaction ' +
      'FROM Transactions GROUP BY month_year';
    $cordovaSQLite.execute(db, transactionQuery, []).then(function (res) {
      if (res.rows.length) {
        for (var i = 0; i < res.rows.length; i++) {
          $scope.month_year.push(res.rows.item(i).month_year);
          $scope.count.push(res.rows.item(i).total_transaction);
        }
      }
    }, function (error) {
      console.error(error);
    });

    $scope.monthly_transaction.push($scope.count);

    var incomeQuery = 'SELECT strftime(\'%m-%Y\', date) AS month_year, SUM(total_price) AS total_price ' +
      'FROM Transactions GROUP BY month_year';
      $cordovaSQLite.execute(db, incomeQuery, []).then(function (res) {
        if (res.rows.length) {
          for (var i = 0; i < res.rows.length; i++) {
            $scope.total_price.push(res.rows.item(i).total_price);
          }
        }
      }, function (error) {
        console.error(error);
      });

      $scope.monthly_income.push($scope.total_price);
  });
});
