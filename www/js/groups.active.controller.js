angular.module('join.groups.active', [])

    .controller('ActiveGroupsController', function($scope, $state, $ionicLoading, $ionicPopup, auth, $firebase, $path, $timeout, $ionicActionSheet) {
        var user = JSON.parse(window.localStorage.getItem("user"));

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.refresh();
            $scope.buildMessages();
        });


        $scope.showConfigurations = function() {
            var hideSheet = $ionicActionSheet.show({
                buttons: [
                    { text: 'Alterar senha' }
                ],
                titleText: 'Configurações',
                cancelText: 'Cancelar',
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
                }
            });
        };

        $scope.buildMessages = function(){
            $scope.messages = {values : []};
            if(window.localStorage.getItem("changePasswordRequired")){
                $scope.messages.values.push({ message : "Sua senha precisa ser alterada.", url : "change-password"});
            }
        };

        $scope.messageAction = function(message){
            $state.go(message.url);
        };

        $scope.refresh = function(){
            $scope.activityGroups = [];
            $scope.activityInvites = [];

            $scope.showPublicGroupSuggestions = false;
            $scope.showPublicActivitySuggestions = false;



            async.waterfall([
                function loadActivity(callback){
                    if(Object.keys(user.groups.activity).length == 0){
                        callback({found : 0});
                    }
                    var activityGroupLoaders = [];
                    for(var groupId in user.groups.activity){
                        activityGroupLoaders.push(groupId);
                    }
                    async.each(activityGroupLoaders, function(groupId, callback){
                        $firebase("groups/activity", groupId).once("value", function(snapshot){
                            if(snapshot.exists()){
                                var group = snapshot.val();
                                group.$id = snapshot.key();
                                if(group.banned && group.banned[user.$id]){
                                    delete user.groups.activity[snapshot.key()];
                                    return callback();
                                }
                                $scope.activityGroups.push(group);
                                callback();
                            } else {
                                delete user.groups.activity[snapshot.key()];
                                callback();
                            }
                        });
                    },function(error){
                        callback(null);
                    });
                },

                function loadInvites(callback){
                    var invitesGroupLoaders = [];
                    $scope.activityInvites = [];
                    $firebase("users", user.$id, "groups/invite").once("value", function(snapshot){
                        if(snapshot.exists()){
                            var invites = [];
                            snapshot.forEach(function(value){
                                invitesGroupLoaders.push(function(callback){
                                    var type = value.val().type;
                                    if(user.groups[type][value.key()] == undefined){
                                        $firebase("groups", value.val().type, value.key()).once("value", function(snapshot){
                                            if(snapshot.exists()){
                                                var group = snapshot.val();
                                                group.$id = snapshot.key();
                                                group.type = type;
                                                $scope.activityInvites.push(group);
                                                callback();
                                            } else{
                                                $firebase("users", user.$id, "groups/invite/" + value.key()).remove();
                                                callback();
                                            }
                                        });
                                    } else {
                                        $firebase("users", user.$id, "groups/invite/" + value.key()).remove();
                                        callback();
                                    }
                                });
                            });
                        }

                        async.series(invitesGroupLoaders, function(error){
                            callback(null);
                        });
                    });
                },

                function updateUser(callback){
                    window.localStorage.setItem("user", JSON.stringify(user));
                    callback();
                },

                function createSuggestions(callback){
                    var totalGroups = Object.keys(user.groups.public).length + Object.keys(user.groups.private).length + Object.keys(user.groups.activity).length;
                    if(totalGroups == 0){
                        buildPublicGroupsSuggestions(callback);
                    } else if(Object.keys(user.groups.activity).length == 0){
                        buildActivitiesSuggestions(callback);
                    } else {
                        callback();
                    }
                }
            ], function(err, result){
                $scope.$apply();
                $scope.$broadcast('scroll.refreshComplete');
            });
        };

        var buildPublicGroupsSuggestions = function(callback){
            $scope.suggestions = [];
            $scope.showPublicGroupSuggestions = true;
            $firebase("groups/public").limitToFirst(3).once("value", function(value){
                if(value.exists()){
                    value.forEach(function(v){
                        var suggestion = v.val();
                        suggestion.$id = v.key();
                        $scope.suggestions.push(suggestion);
                    });
                    callback();
                } else {
                    callback();
                }
            });
        };

        var buildActivitiesSuggestions = function(callback){
            $scope.suggestions = [];
            $scope.showPublicActivitySuggestions = true;

            var groups = {};
            for(var key in user.groups.public) groups[key] = user.groups.public[key];
            for(var key in user.groups.private) groups[key] = user.groups.private[key];

            var activitySuggestionsLoaders = [];
            for(var groupId in groups){
                activitySuggestionsLoaders.push(function(callback){
                    $firebase("groups/activity").orderByChild("parent").equalTo(groupId).limitToFirst(5).once("value", function(value){
                        if(value.exists()){
                            value.forEach(function(v){
                                var suggestion = v.val();
                                suggestion.$id = v.key();
                                if(suggestion.banned && suggestion.banned[user.$id])
                                    return;
                                $scope.suggestions.push(suggestion);
                                $scope.showPublicActivitySuggestions = true;
                            });
                            callback();
                        } else {
                            callback();
                        }
                    });
                });
            }
            async.series(activitySuggestionsLoaders, function(error){
                callback(null);
            });

        };

        $scope.out = function(group) {
            var r = $firebase();
            var updates = {};
            updates[$path("users", user.$id, "groups", "activity", group.$id)] = null;
            updates[$path("groups_participants", group.$id, user.$id)] = null;

            r.update(updates, function(error){
                if(error) {
                    $logger.error(error);
                    return $ionicPopup.alert({ title: 'Ops...', template: 'Houve algum problema, tente novamente.' });
                }

                delete user.groups.activity[group.$id];
                window.localStorage.setItem("user", JSON.stringify(user));

                $ionicLoading.show({ template: 'Voce saiu desde grupo e nao recebera mais notificacoes.', noBackdrop: true, duration: 1500 });
                $scope.refresh();
            });
        };

        $scope.join  = function(group){
            $firebase("groups", group.type, group.$id).once("value", function(snapshot){
                if(!snapshot.exists()){
                    $ionicPopup.alert({ title: 'Ops..', template: 'Parece que esse grupo não existe mais.' });
                    return $scope.refresh();
                }
                var inserts = {};
                inserts[$path("users", user.$id, "groups", group.type, group.$id)] = { silent : false};
                inserts[$path("users", user.$id, "groups", "invite", group.$id)] = null;
                inserts[$path("groups_participants", group.$id, user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo, status : 'joined',
                    ".priority" : Firebase.ServerValue.TIMESTAMP};
                var notification = $firebase("notifications", "groups_participants", "added").push();
                inserts[$path("notifications", "groups_participants", "added", notification.key())] = {groupId : group.$id, groupName : group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

                $firebase().update(inserts, function(error){
                    if(error) {
                        $logger.error(error);
                        return $ionicPopup.alert({ title: 'Ops...', template: 'Aconteceu algum problema, tente novamente.' });
                    }

                    user.groups[group.type][group.$id] = { silent : false};
                    window.localStorage.setItem("user", JSON.stringify(user));

                    $ionicPopup.alert({ title: 'Aviso', template: 'Voce entrou no grupo e agora pode participar do chat, receber e enviar convites de atividades.' })
                        .then(function(res){
                            if($scope.showPublicGroupSuggestions)
                                return $state.go("groups");
                            $scope.refresh();
                        });
                });
            });


        };

        $scope.confirm = function(group) {
            var commands = {};
            var notification = $firebase("notifications", "groups_participants", "added").push();

            commands[$path("groups_participants", group.$id, user.id)] = { status : "confirmed" };
            commands[$path("notifications", "groups_participants", "confirmed", notification.key())] = {groupId : group.$id, groupName : group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

            $firebase().update(commands, function(error){
                $ionicLoading.show({ template: "Presença confirmada.", noBackdrop: true, duration: 1500 });
            });
        };

        $scope.ignore = function(group) {
            $firebase("users", user.$id, "groups/invite/" + group.$id).remove(function(){
                $scope.refresh();
                $ionicLoading.show({ template: "Convite ignorado.", noBackdrop: true, duration: 1500 });
            });
        };

        $scope.logout = function(){
            var confirmPopup = $ionicPopup.confirm({
                title: 'Logout',
                template: 'Tem certeza que deseja sair?'
            });
            confirmPopup.then(function(res) {
                if(res) {
                    window.localStorage.removeItem("user");
                    auth.$unauth();
                    $state.go("login");
                }
            });
        };

    })

;