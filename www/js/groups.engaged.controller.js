angular.module('join.engaged.groups', [])

    .controller('GroupsEngagedController', function($scope, $state, $ionicPopup, $timeout, $firebase, $path) {
        var user = JSON.parse(window.localStorage.getItem("user"));
        var loaded = 0;

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.load();
        });

        $scope.refresh = function(){
            async.series([
                function refreshPrivate(callback){
                    $firebase("users", user.$id, "groups/private").once("value", function(snapshot){
                        snapshot.forEach(function(value){
                            user.groups.private[value.key()] = value.val();
                        });
                        callback();
                    });
                },

                function refreshPublic(callback){
                    $firebase("users", user.$id, "groups/public").once("value", function(snapshot){
                        snapshot.forEach(function(value){
                            user.groups.public[value.key()] = value.val();
                        });
                        callback();
                    });
                },
            ], function(){
                $scope.load();
            });

        };

        $scope.load = function(){
            var loaded = 0;
            var totalGroups = Object.keys(user.groups.public).length + Object.keys(user.groups.private).length;

            $scope.publicGroups = [];
            $scope.privateGroups = [];

            var accumulate = function(array, snapshot){
                loaded += 1;
                if(snapshot.exists()){
                    var group = snapshot.val();
                    group.$id = snapshot.key();
                    array.push(group);
                }
                $scope.refreshComplete(totalGroups, loaded);
            };

            for(var groupId in user.groups.public){
                $firebase("groups/public", groupId).once("value", function(snapshot){
                    accumulate($scope.publicGroups, snapshot);
                });
            }

            for(var groupId in user.groups.private){
                $firebase("groups/private", groupId).once("value", function(snapshot){
                    accumulate($scope.privateGroups, snapshot);
                });
            }

            $timeout(function(){
                if($scope.publicGroups.length == 0 && $scope.privateGroups.length == 0)
                    $scope.refreshComplete(0, 0);
            }, 3000);
        };

        $scope.refreshComplete = function(length, actual){
            if(length <= actual)
                $scope.$broadcast('scroll.refreshComplete');
        };

        $scope.out = function(group, type) {
            var updates = {};
            updates[$path("users", user.$id, "groups", type, group.$id)] = null;
            updates[$path("groups_participants", group.$id, user.$id)] = null;
            var notification = $firebase("notifications", "groups_participants", "removed").push();
            updates[$path("notifications", "groups_participants", "removed", notification.key())] = {groupId : group.$id, groupName : group.name, userId : user.$id, nickname : user.nickname, timestamp : Firebase.ServerValue.TIMESTAMP};

            $firebase().update(updates, function(error){
                if(error) {
                    $logger.error(error);
                    return $ionicPopup.alert({ title: 'Ops...', template: 'Houve algum problema, tente novamente.' });
                }

                delete user.groups[type][group.$id];
                window.localStorage.setItem("user", JSON.stringify(user));

                $ionicPopup.alert({ title: 'Aviso', template: 'Voce saiu desde grupo e nao recebera mais notificacoes.' });
                $scope.refresh();
            });
        };

        $scope.chat = function(group){
            $state.go("group_chat", {'type':'public', 'groupId' : group.$id});
        };
    })

;