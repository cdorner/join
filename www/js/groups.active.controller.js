angular.module('join.groups.active', [])

    .controller('ActiveGroupsController', function($scope, $state, $ionicLoading, $ionicPopup, auth, $firebase, $path,
                                                   $ionicActionSheet, $database, $helper, $logger, $ionicScrollDelegate, $join, $translate) {
        var user = $join.user;
        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.refresh();
            $scope.buildMessages();
        });

        $scope.showConfigurations = function() {
            var hideSheet = $ionicActionSheet.show({
                buttons: [
                    { text: $translate.instant('CHANGE_PASSWORD')}
                ],
                destructiveText: $translate.instant('EXCLUDE_USER'),
                titleText: $translate.instant('CONFIGURATION'),
                cancelText: $translate.instant('CANCEL'),
                cancel: function() {
                    hideSheet();
                },
                buttonClicked: function(index) {
                    switch (index){
                        case 0 :
                            $state.go("change-password");
                            break;
                    }
                    return true;
                },
                destructiveButtonClicked : function(){
                    $ionicPopup.confirm({ title: $translate.instant('EXCLUDE_USER_WARNING'), template: $translate.instant('EXCLUDE_USER_WARNING_MESSAGE')}).then(function(response){
                        if(response){
                            $state.go("exclude-credential");
                        }
                    });
                    hideSheet();
                }
            });
        };

        $scope.buildMessages = function(){
            $scope.messages = {values : []};
            if(window.localStorage.getItem("changePasswordRequired")){
                $scope.messages.values.push({ message : $translate.instant('PASSWORD_NEEDS_CHANGE'), url : "change-password"});
            }
        };

        $scope.messageAction = function(message){
            $state.go(message.url);
        };



        $scope.refresh = function(){
            $scope.activityGroups = Object.keys(user.groups.activity).map(function(k){ return user.groups.activity[k]});
            $scope.activityInvites = Object.keys(user.groups.invite).map(function(k){ return user.groups.invite[k]});

            $scope.pageLoaded = true;

            createSuggestions();

            if(!$scope.$$phase)
                $scope.$apply();

            // Delay to give user more smooth ui
            setTimeout(function(){
                $ionicScrollDelegate.scrollTop();
                $scope.$broadcast('scroll.refreshComplete');
            }, 1000);

            synchronizeActivities();
            synchronizeInvites();
        };

        var synchronizeActivities = function(){
            async.forEachOf(user.groups.activity, function(value, key, callback){
                $firebase("users", user.$id, "groups/activity/", key).once("value", function(snapshot){
                    if(!snapshot.exists()){
                        delete user.groups.activity[key];
                        var index = $scope.activityGroups.findIndex(function(element){ element.id == key});
                        if (index == -1) $scope.activityGroups.splice(index, 1);
                    }
                    callback();
                });
            }, function(){
                window.localStorage.setItem("user", JSON.stringify(user));

                $firebase("users", user.$id, "groups/activity").once("value", function(snapshot){
                    if(snapshot.exists()){
                        var activities = [];
                        snapshot.forEach(function(activity){
                            var index = $scope.activityGroups.findIndex(function (element) { return element.id == activity.key(); });
                            if (index == -1) $scope.activityGroups.push(activity.val());
                            else {
                                var group = activity.val();
                                group.hasUnreadMessage = user.groups[group.type][group.id].hasUnreadMessage;
                                $scope.activityGroups[index] = group;
                            }
                        });

                        async.each($scope.activityGroups, function(activity, callback){
                                $firebase("groups", activity.id, "banned", user.$id).once("value", function(snapshot) {
                                    var current = this;
                                    var index = $scope.activityGroups.findIndex(function (element) { return element.id == current.id; });
                                    if (snapshot.exists()) {
                                        $scope.activityGroups.splice(index, 1);
                                        user = $helper.group.remove(user, current);
                                    } else {
                                        user.groups[this.type][this.id] = this;
                                        $scope.activityGroups[index] = this;
                                    }
                                    callback();
                                }, activity)},

                            function(){
                                if(!$scope.$$phase)
                                    $scope.$apply();
                            });
                    }
                });
            });
        };

        var synchronizeInvites = function(){
            $firebase("users", user.$id, "groups/invite").once("value", function(snapshot){
                var invites = [];

                if(!snapshot.exists()) return;

                snapshot.forEach(function(value){
                    invites.push(value.val());
                });
                async.map(invites, function(invite, callback){
                        if(user.groups[invite.type][invite.id] == undefined){
                            $firebase("groups", invite.id).once("value", function(snapshot){
                                if(snapshot.exists()){
                                    callback(null, snapshot.val());
                                } else{
                                    $firebase("users", user.$id, "groups/invite/", invite.id).remove();
                                    callback();
                                }
                            });
                        } else {
                            $firebase("users", user.$id, "groups/invite/", invite.id).remove();
                            callback(null, user.groups[invite.type][invite.id]);
                        }},
                    function(error, invites){
                        if(!$logger.error(error)){
                            $scope.activityInvites = invites;
                        }
                    });
            });
        };

        var createSuggestions = function(){
            var totalGroups = Object.keys(user.groups.public).length + Object.keys(user.groups.private).length + Object.keys(user.groups.activity).length;
            $scope.suggestions = [];
            $scope.showPublicGroupSuggestions = false;
            $scope.showPublicActivitySuggestions = false;
            if(totalGroups == 0){
                buildPublicGroupsSuggestions();
            } else if(Object.keys(user.groups.activity).length == 0){
                buildActivitiesSuggestions();
            }
        };

        var buildPublicGroupsSuggestions = function(){
            $scope.suggestions = [];
            $scope.showPublicGroupSuggestions = true;
            var language = window.localStorage.getItem("language") || "en";
            $firebase("suggestions/groups/" + language).orderByChild('type').equalTo('public').limitToFirst(3).once("value", function(value){
                if(value.exists()){
                    value.forEach(function(v){
                        var suggestion = v.val();
                        $scope.suggestions.push(suggestion);
                    });
                    if(!$scope.$$phase)
                        $scope.$apply();
                }
            });
        };

        var buildActivitiesSuggestions = function(callback){
            $scope.suggestions = [];
            $scope.showPublicActivitySuggestions = true;

            var groups = {};
            for(var key in user.groups.public) groups[key] = user.groups.public[key];
            for(var key in user.groups.private) groups[key] = user.groups.private[key];

            for(var groupId in groups){
                $firebase("groups").orderByChild("parent").equalTo(groupId).limitToFirst(3).once("value", function(value){
                    if(value.exists()){
                        value.forEach(function(v){
                            var suggestion = v.val();
                            if(suggestion.banned && suggestion.banned[user.$id])
                                return;
                            $scope.suggestions.push(suggestion);
                            if(!$scope.$$phase)
                                $scope.$apply();
                        });
                    }
                });
            }
        };

        $scope.go = function(group){
            $state.go("group_chat", {'type':group.type, 'groupId' : group.id});
        }

        $scope.cancelSuggestions = function(){
            $scope.showPublicGroupSuggestions = false;
            $scope.showPublicActivitySuggestions = false;
        };

        $scope.out = function(group) {
            $join.drop(user, group, function(user, group, message){
                $join.user = user;
                $helper.toast(message);
                $scope.refresh();
            }, $helper.toast);
        };

        $scope.join  = function(chosen){
            $firebase("groups", chosen.id).once("value", function(snapshot){
                if(!snapshot.exists()){
                    $ionicPopup.alert({ title: $translate.instant('OPS'), template: $translate.instant('GROUP_NOT_EXISTS_ANYMORE') });
                    return $scope.refresh();
                }

                var group = angular.copy(chosen);
                group.silent = false;
                $join.join(user, group, function(user, group, message){
                    $join.user = user;
                    $ionicPopup.alert({ title: $translate.instant('WARNING'), template: $translate.instant('JOIN_GROUP_SUCCESS') })
                        .then(function(res){
                            if(chosen.type == 'activity'){
                                return $scope.refresh();
                            }
                            $state.go("groups");
                        });
                }, $helper.toast);
            });
        };

        $scope.confirm = function(group) {
            $join.confirm(user, group, function(user, group, message){
                $helper.toast(message);
            }, $helper.toast);
        };

        $scope.ignore = function(group) {
            $join.ignore(user, group, function(user, group, message){
                $join.user = user;
                $helper.toast(message);
                $scope.refresh();
            }, $helper.toast);
        };

        $scope.logout = function(){
            var confirmPopup = $ionicPopup.confirm({
                title: 'Logout',
                template: 'Tem certeza que deseja sair?'
            });
            confirmPopup.then(function(res) {
                if(res) {
                    $database.flushMessagesPrior(365, function(){
                        if(user){
                            return $firebase("users", user.$id, "info/device").remove(function(){
                                window.localStorage.removeItem("user");
                                window.localStorage.removeItem("changePasswordRequired");
                                auth.$unauth();
                                $state.go("login");
                            })
                        }
                        $database.flushMessagesPrior(100);
                        window.localStorage.removeItem("user");
                        window.localStorage.removeItem("changePasswordRequired");
                        auth.$unauth();
                        $state.go("login");
                    });

                }
            });
        };

    })

    .controller('OnPushNotificationController', function($scope, $state, $firebase, $helper, $join, $translate) {

        $scope.$on('$ionicView.beforeEnter', function (e) {
            if ($scope.hasInvite()) {
                return $scope.applyPush();
            }
            $state.go("dash", {}, { reload: true });
        });

        $scope.hasInvite = function(){
            return window.localStorage.getItem("invite");
        };

        $scope.applyPush = function(){
            var user = JSON.parse(window.localStorage.getItem("user"));
            var invite = JSON.parse(window.localStorage.getItem("invite"));
            window.localStorage.removeItem("invite");
            $firebase("groups", invite.groupId).once("value", function(snapshot) {
                if (!snapshot.exists()) return $helper.toast($translate.instant('GROUP_NOT_EXISTS_ANYMORE'));
                var group = snapshot.val();
                switch(invite.command) {
                    case "accept":
                        $join.join(user, group, function(user, group, message){
                            $state.go("group_chat", {groupId : invite.groupId, type : group.type}, { reload: true });
                        }, $helper.toast);
                        break;
                    case "ignore":
                        $join.ignore(user, group, function(newUser, group, message){
                            $helper.toast(message);
                            $state.go("dash", {}, { reload: true });
                        }, $helper.toast)
                        break;
                    case "confirmation":
                        $join.confirm(user, group, function(user, group, message){$helper.toast(message) }, $helper.toast);
                        $state.go("group_chat", {groupId : invite.groupId, type : group.type}, { reload: true });
                        break;
                    case "drop":
                        $join.drop(user, group, function(newUser, group, message){
                            $helper.toast(message);
                            $state.go("dash", {}, { reload: true });
                        }, $helper.toast);
                        break;
                    default:
                        $state.go("dash", {}, { reload: true });
                }
            });
        };
    })

    .controller('ExcludeCredentialController', function($scope, $state, $firebase, $join, auth, $ionicConfig, $ionicHistory, $ionicPopup, $logger, $helper, $translate) {
        $scope.model = {};

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.backButtonClass = $ionicConfig.backButton.icon();
            $scope.backTitle = $ionicHistory.backTitle();
        });

        $scope.askConfirmationAgain = function(){
            $ionicPopup.confirm({ title: $translate.instant('FOR_LAST_TIME'), template: $translate.instant('CONFIRM_EXCLUDE_USER_AGAIN')}).then(function(response){
                if(response){
                    auth.$authWithPassword({ email: $scope.model.email, password: $scope.model.password }).then(function(authData) {
                        $firebase("users", $join.user.id).remove(function(error){
                            if($logger.error(error)) return $helper.toast($translate.instant('EXCLUDE_USER_ERROR'));

                            $firebase().removeUser({ email: $scope.model.email,  password: $scope.model.password}, function(error) {
                                if(!$logger.error(error)){
                                    $helper.toast($translate.instant('EXCLUDE_USER_DONE'), 2000);
                                    window.localStorage.removeItem("user");
                                    window.localStorage.removeItem("changePasswordRequired");
                                    auth.$unauth();
                                    $ionicHistory.clearCache();
                                    $ionicHistory.clearHistory();
                                    setTimeout(function(){
                                        if(window.cordova){
                                            navigator.app.exitApp();
                                        }
                                    }, 2000);

                                }
                            });

                        });
                    }).catch(function(error) {
                        $helper.toast($translate.instant('EXCLUDE_USER_ERROR'));
                    });
                }
            });
        };
    })
;