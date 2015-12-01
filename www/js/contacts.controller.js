angular.module('join.contacts.controllers', [])

    .controller('ContactsController', function($scope, $helper, $translate, $ionicPopover, $ionicModal, $path, $firebase, $firebaseArray, $logger, $join) {
        var user = $join.user;
        $logger.config("ContactsController");

        $scope.search = {};
        $scope.user = null;

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.refresh();

            $ionicModal.fromTemplateUrl('search.html', { scope: $scope, animation: 'slide-in-up' }).then(function(modal) {
                $scope.modal = modal;
            });
        });

        $scope.refresh = function(){
            $scope.followings = $firebaseArray($firebase("users", user.$id, "following"));
            $scope.followers = $firebaseArray($firebase("users_followers", user.$id));

            $scope.followings.$loaded().then(function(){
                $scope.$broadcast('scroll.refreshComplete');
            });

        };

        $scope.openOptions = function(user, $event){
            $scope.user = user;
            $ionicPopover.fromTemplateUrl('options.html', { scope: $scope }).then(function(popover) {
                $scope.popover = popover;
                $scope.popover.show($event);
            });

        };

        $scope.follow = function(){
            var participant = $scope.user;
            var user = JSON.parse(window.localStorage.getItem("user"));
            var commands = {};

            commands[$path("users", user.$id, "following", participant.id)] = { id : participant.id, nickname : participant.nickname, photo : participant.photo, timestamp : Firebase.ServerValue.TIMESTAMP };
            commands[$path("users_followers", participant.id, user.$id)] = { id : user.$id, nickname : user.nickname, photo : user.photo, timestamp : Firebase.ServerValue.TIMESTAMP };

            $firebase().update(commands, function(error){
                if(!$logger.error(error)){
                    $helper.toast($translate.instant('DONE'));
                    $scope.popover.hide();
                    $scope.popover.remove();
                }
            });
        };

        $scope.unfollow = function(){
            var participant = $scope.user;
            var user = JSON.parse(window.localStorage.getItem("user"));
            var commands = {};

            commands[$path("users", user.$id, "following", participant.id)] = null;
            commands[$path("commands/users/unfollow/", user.$id)] = {id : user.$id, unfollow : participant.id, timestamp : Firebase.ServerValue.TIMESTAMP};

            $firebase().update(commands, function(error){
                $helper.toast($translate.instant('DONE'));
                $scope.popover.hide();
                $scope.popover.remove();
            });
        };

        $scope.showSearch = function(){
            $scope.modal.show();
            $scope.search.active = true;
        };

        $scope.isMe = function(contact){
            return user.$id == contact.id;
        };

        $scope.isMyContact = function(follower){
            return $scope.followings.some(function(following){
                return following.id == follower.id;
            });
        };

        $scope.searchContacts = function(){
            $scope.search.value = $firebaseArray($firebase("users_searches").orderByChild("searchNickname").startAt($scope.search.text.toLowerCase()));
        };

        $scope.cancelSearch = function(){
            $scope.search = {};
            $scope.modal.hide();
        };

    })
;