angular.module('join.engaged.groups', [])

    .controller('GroupsEngagedController', function($scope, $state, $ionicPopup, $firebase, $path, $helper, $logger, $join) {
        var user = $join.user;

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.load();
        });

        $scope.refresh = function(){
            async.series([
                function refreshPrivate(callback){
                    $firebase("users", user.$id, "groups/private").once("value", function(snapshot){
                        snapshot.forEach(function(value){
                            var hasUnreadMessage = false;
                            if(user.groups.private[value.key()]) hasUnreadMessage =  user.groups.private[value.key()].hasUnreadMessage;
                            user.groups.private[value.key()] = $helper.group.toLocal(value.val());
                            user.groups.private[value.key()].hasUnreadMessage = hasUnreadMessage;
                        });
                        callback();
                    });
                },

                function refreshPublic(callback){
                    $firebase("users", user.$id, "groups/public").once("value", function(snapshot){
                        snapshot.forEach(function(value){
                            var hasUnreadMessage = false;
                            if(user.groups.public[value.key()]) hasUnreadMessage =  user.groups.public[value.key()].hasUnreadMessage;
                            user.groups.public[value.key()] = $helper.group.toLocal(value.val());
                            user.groups.public[value.key()].hasUnreadMessage = hasUnreadMessage;
                        });
                        callback();
                    });
                },
            ], function(){
                window.localStorage.setItem("user", JSON.stringify(user));
                $scope.load();
            });
        };

        $scope.load = function(){
            $scope.publicGroups = $helper.orNull(user.groups.public);
            $scope.privateGroups = $helper.orNull(user.groups.private);

            $scope.pageLoaded = true;
            $scope.$broadcast('scroll.refreshComplete');
        };

        $scope.go = function(group){
            $state.go("group_chat", {'type':group.type, 'groupId' : group.id});
        }

        $scope.out = function(group, type) {
            $join.drop(user, group, function(user, group, message){
                $join.user = user;
                $helper.toast(message);
                $scope.refresh();
            }, $helper.toast);
        };

        $scope.chat = function(group){
            $state.go("group_chat", {'type':'public', 'groupId' : group.$id});
        };
    })

;