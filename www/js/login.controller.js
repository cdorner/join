angular.module('login.controllers', [])

    .controller('LoginController', function($scope, auth, $ionicPopup, $ionicLoading, $state, $firebase, $logger, $messageListener, $helper, $join, $translate) {
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
                template: '<p>' + $translate.instant('DOING_LOGIN') + '...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'
            });
            auth.$authWithPassword({
                email: $scope.user.email,
                password: $scope.user.password
            }).then(function(authData) {
                var registrationId = window.localStorage.getItem("registrationId");

                async.waterfall([
                    function info(callback){
                        $firebase("users", authData.uid, "info").once("value", function(snapshot) {
                            if(!snapshot.exists()){
                                return callback("user not found with id " + authData.uid);
                            }
                            var user = snapshot.val();
                            user.$id = user.id;
                            callback(null, user);
                        });
                    },
                    function groups(user, callback){
                        $firebase("users", authData.uid, "groups").once("value", function(snapshot) {
                            if(user.groups){
                                if(!user.groups.public) user.groups.public = {};
                                if(!user.groups.private) user.groups.private = {};
                                if(!user.groups.activity) user.groups.activity = {};
                                if(!user.groups.invite) user.groups.invite = {};
                            } else{
                                user.groups = {public : {}, private : {}, activity : {}, invite : {}};
                            }
                            if(snapshot.exists()){
                                for(var type in snapshot.val()){
                                    var groups = snapshot.val()[type];
                                    for(var groupId in groups){
                                        var group = groups[groupId];
                                        user.groups[group.type][group.id] = group;
                                    }
                                }
                            }
                            callback(null, user);
                        });
                    },

                    function save(user, callback){
                        window.localStorage.setItem("user", JSON.stringify(user));
                        callback(null, user);
                    },

                    function updateRegistrationId(user, callback){
                        if(window.cordova){
                            var registrationId = window.localStorage.getItem("registrationId");
                            var language = navigator.language.toLowerCase();
                            $firebase("users", user.$id, "info/device").update({platform : device.platform, deviceId : device.uuid, registrationId : registrationId, utcOffset : moment().utcOffset(), language : language }, function(error){
                                if(error) {$logger.error(error);}
                                callback(null, user);
                            });
                        } else {
                            callback(null, user);
                        }
                    },

                    function  notifyUserLogin(user, callback){
                        $firebase("notifications/users/login/done/", user.$id).set({timestamp : Firebase.ServerValue.TIMESTAMP}, function(){
                            callback(null, user);
                        });
                    },
                    function  startListeningChat(user, callback){
                        $messageListener.start(user);
                        $join.start(user);
                        callback(null, user);
                    }
                ], function(error){
                    if(error){
                        window.localStorage.removeItem("user");
                        window.localStorage.removeItem("changePasswordRequired");
                        auth.$unauth();
                        $helper.toast($translate.instant('UNKNOWN_LOGIN_ERROR'));
                        return $state.go('login');
                    }
                    $ionicLoading.hide();
                    $state.go('dash');
                });
            }).catch(function(error) {
                $logger.error(error);
                if("INVALID_PASSWORD" == error.code){
                    invalidPasswordCounter += 1;
                }
                if(invalidPasswordCounter > 2){
                    $ionicLoading.hide();
                    $ionicPopup.confirm({ title: $translate.instante('WARNING'), template: $translate.instante('PASSWORD_WRONG_TOO_MANY_TIMES')}).then(function(result){
                        if(result){
                            $firebase().resetPassword({
                                email : $scope.user.email
                            }, function(error) {
                                if (error === null) {
                                    $ionicLoading.show({ template: $translate.instante('RECOVER_PASSWORD_EMAIL_SENT'), noBackdrop: true, duration: 2000 });
                                    window.localStorage.setItem("changePasswordRequired", "true");
                                } else {
                                    $ionicLoading.show({ template: $translate.instante('ERROR_WHEN_RECOVER_PASSWORD'), noBackdrop: true, duration: 2000 });
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
            $ionicPopup.alert({ title: $translate.instant('WARNING'), template: $translate.instant('LOGIN_INCORRECT')});
        };

        $scope.register = function() {
            $scope.messages = [];
            $ionicLoading.show({ template: '<p>' + $translate.instant('CREATING_USER') + '...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'});

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

                var ref = $firebase("users", databaseUser.uid, "info");
                ref.set(user, function(error){
                    if(error) {
                        $logger.error(error);
                        $scope.rollbackUserAuth();
                        return $scope.messages.push($translate.instant('ERROR_CREATING_USER'));
                    }
                    $ionicLoading.hide();
                    $state.go('login');
                    $ionicPopup.alert({ title: 'Aviso', template: $translate.instant('USER_CREATED')});
                });
            }).catch(function(error) {
                $ionicLoading.hide();
                if("EMAIL_TAKEN" == error.code ){
                    $scope.messages.push($translate.instant('EMAIL_ALREADY_IN_USE'));
                } else{
                    $logger.error(error);
                    $scope.messages.push($translate.instant('ERROR_CREATING_USER'));
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

    .controller('ChangePasswordController', function($scope, $ionicConfig, $ionicHistory, $ionicLoading, $state, $firebase, $helper, $translate) {

        var user = JSON.parse(window.localStorage.getItem("user"));
        $scope.model = {};

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.backButtonClass = $ionicConfig.backButton.icon();
            $scope.backTitle = $ionicHistory.backTitle();
        });

        $scope.updatePassword = function(){
            $ionicLoading.show({ template: '<p>' + $translate.instant('CHANGING') + '...</p><ion-spinner icon="dots" class="spinner-positive"></ion-spinner>'});

            $firebase().changePassword({
                email       : user.email,
                oldPassword : $scope.model.actualPassword,
                newPassword : $scope.model.newPassword
            }, function(error) {
                $ionicLoading.hide();
                if (error === null) {
                    window.localStorage.removeItem("changePasswordRequired");
                    $helper.toast($translate.instant('DONE'));
                    $state.go("dash");
                } else {
                    $helper.toast($translate.instant('UNKNOWN_ERROR'));
                }
            });
        };
    })

;