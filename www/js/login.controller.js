angular.module('login.controllers', [])

    .controller('LoginController', function($scope, auth, $ionicPopup, $ionicLoading, $state, $firebase, $logger) {
        $logger.config("LoginController");

        var invalidPasswordCounter = 0;

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.user = {};
            $scope.messages = [];

            if( $scope.isUserLogged() ){
                return $state.go('dash');
            }
        });

        $scope.isUserLogged = function () { return auth.$getAuth() != null; };
        $scope.closeApp = function(){ navigator.app.exitApp(); };

        $scope.tryLogin = function() {
            $ionicLoading.show({
                template: '<p>Realizando login...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'
            });
            auth.$authWithPassword({
                email: $scope.user.email,
                password: $scope.user.password
            }).then(function(authData) {
                var registrationId = window.localStorage.getItem("registrationId");
                var ref = $firebase("users", authData.uid);
                ref.once("value", function(snapshot){
                    var user = snapshot.val();
                    user.$id = snapshot.key();

                    if(user.groups){
                        if(!user.groups.public) user.groups.public = {};
                        if(!user.groups.private) user.groups.private = {};
                        if(!user.groups.activity) user.groups.activity = {};
                    } else{
                        user.groups = {public : {}, private : {}, activity : {}};
                    }


                    window.localStorage.setItem("user", JSON.stringify(user));

                    if(window.cordova){
                        var registrationId = window.localStorage.getItem("registrationId");
                        var language = navigator.language.toLowerCase();
                        ref.update({ device : {platform : device.platform, deviceId : device.uuid, registrationId : registrationId, utcOffset : moment().utcOffset(), language : language }  }, function(error){
                            if(error) {$logger.error(error);}
                            $ionicLoading.hide();
                            $state.go('dash');
                        });
                    } else{
                        $ionicLoading.hide();
                        $state.go('dash');
                    }
                });

            }).catch(function(error) {
                $logger.error(error);
                if("INVALID_PASSWORD" == error.code){
                    invalidPasswordCounter += 1;
                }
                if(invalidPasswordCounter > 2){
                    $ionicLoading.hide();
                    $ionicPopup.confirm({ title: 'Aviso', template: 'Senha inválida muitas vezes, deseja lembrar a senha?'}).then(function(result){
                        if(result){
                            $firebase().resetPassword({
                                email : $scope.user.email
                            }, function(error) {
                                if (error === null) {
                                    $ionicLoading.show({ template: "Um email foi enviado para que você possa recuperar sua senha.", noBackdrop: true, duration: 2000 });
                                    window.localStorage.setItem("changePasswordRequired", "true");
                                } else {
                                    $ionicLoading.show({ template: "Não foi possível recuperar sua senha, tente novamente.", noBackdrop: true, duration: 2000 });
                                }
                            });
                        }

                    });
                } else {
                    $ionicLoading.hide();
                    $scope.loginInvalid();
                }

            });
        };

        $scope.loginInvalid = function(){
            $ionicPopup.alert({ title: 'Aviso', template: 'email ou senha incorretos, tente novamente.'});
        };

        $scope.register = function() {
            $scope.messages = [];
            $ionicLoading.show({ template: '<p>Criando usuário...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'});

            auth.$createUser({
                email: $scope.user.email,
                password: $scope.user.password
            }).then(function (databaseUser) {
                var user = {
                    id : databaseUser.uid,
                    name : $scope.user.name,
                    nickname : $scope.user.gamertag,
                    email : $scope.user.email,
                    registration : Firebase.ServerValue.TIMESTAMP,
                    photo : 'https://s.gravatar.com/avatar/'+md5($scope.user.email)
                };

                var ref = $firebase("users", databaseUser.uid);
                ref.set(user, function(error){
                    if(error) {
                        $logger.error(error);
                        $scope.rollbackUserAuth();
                        return $scope.messages.push("Ops, houve algum problema para criar seu usuário.");
                    }

                    if(window.cordova){
                        var registrationId = window.localStorage.getItem("registrationId");
                        var language = navigator.language.toLowerCase();
                        ref.update({ device : { platform : device.platform, deviceId : device.uuid, registrationId : registrationId, utcOffset : moment().utcOffset(), language : language }  }, function(error){
                            if(error) {$logger.error(error);}
                            $ionicLoading.hide();
                            $state.go('login');
                            $ionicPopup.alert({ title: 'Aviso', template: 'Usuario criado, agora faça login.'});
                        });
                    } else {
                        $ionicLoading.hide();
                        $state.go('login');
                        $ionicPopup.alert({ title: 'Aviso', template: 'Usuario criado, agora faça login.'});
                    }
                });
            }).catch(function(error) {
                $ionicLoading.hide();
                if("EMAIL_TAKEN" == error.code ){
                    $scope.messages.push("Desculpe, esse email não está disponível.");
                } else{
                    $logger.error(error);
                    $scope.messages.push("Não foi possível realizar seu cadastro, tente novamente.");
                }
            });
        };

        $scope.rollbackUserAuth = function(){
            auth.$removeUser({
                email: $scope.user.email,
                password: $scope.user.password
            });
        };
    })

    .controller('ChangePasswordController', function($scope, $ionicConfig, $ionicHistory, auth, $ionicLoading, $state, $firebase, $logger) {

        var user = JSON.parse(window.localStorage.getItem("user"));
        $scope.model = {};

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.backButtonClass = $ionicConfig.backButton.icon();
            $scope.backTitle = $ionicHistory.backTitle();
        });

        $scope.updatePassword = function(){
            $ionicLoading.show({ template: '<p>Alterando...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'});

            $firebase().changePassword({
                email       : user.email,
                oldPassword : $scope.model.actualPassword,
                newPassword : $scope.model.newPassword
            }, function(error) {
                $ionicLoading.hide();
                if (error === null) {
                    window.localStorage.removeItem("changePasswordRequired");
                    $ionicLoading.show({ template: "Feito.", noBackdrop: true, duration: 1500 });
                    $state.go("dash");
                } else {
                    $ionicLoading.show({ template: "Ocorreu algum erro, tente novamente.", noBackdrop: true, duration: 2000 });
                }
            });
        };
    })

;