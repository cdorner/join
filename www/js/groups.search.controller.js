angular.module('join.groups.search', [])

    .controller('GroupAdvancedSearchCtrl', function($scope, $state, $ionicConfig, $ionicPopup, $ionicHistory, $path, $firebase, $logger, $helper, $join) {
        $logger.config("GroupAdvancedSearchCtrl");
        $scope.search = { };
        var user = $join.user;

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $scope.backButtonClass = $ionicConfig.backButton.icon();
            $scope.backTitle = $ionicHistory.backTitle();
            $scope.refresh();
        });

        $scope.refresh = function(){
            $scope.groups = [];
            $firebase("groups").orderByChild("type").equalTo("public").once("value", function(snapshot){
                var language = window.localStorage.getItem("language") || "en";
                snapshot.forEach(function(snapshot){
                    var group = snapshot.val();
                    if(language == group.language)
                        $scope.groups.push(group);
                });
                $scope.$broadcast('scroll.refreshComplete');
            });
        };

        $scope.new = function(){
            $state.go("create-group");
        };

        $scope.enter  = function(chosen){
            var inserts = {};
            var group = angular.copy(chosen);
            group.silent = false;
            $join.join(user, group, function(user, group, message){
                $join.user = user;
                $helper.toast(message, 3000);
                $state.go("groups");
            }, $helper.toast);
        };

        $scope.cancelSearch = function(){
            $scope.search.text = "";
        }
    })

    .controller('CreateGroupController', function($scope, $state, $ionicHistory, $ionicPopup, $ionicSlideBoxDelegate, $ionicScrollDelegate, $firebase, $firebaseArray, $path, $helper, $join, $translate) {
        var user = $join.user;
        $scope.search = { };

        $scope.$on('$ionicView.beforeEnter', function(e) {
            $ionicSlideBoxDelegate.enableSlide(false);
            $scope.init();
        });

        $scope.init = function(){
            $scope.subjects = [];
            $scope.subjects = $firebaseArray($firebase("group_subjects").orderByChild("name"));
        };

        $scope.select = function(subject){
            $scope.subject = subject;
            $scope.followers = [];
            $scope.group = {};
            $scope.platforms = subject.platforms;
            $scope.cancelSearch();

            $firebaseArray($firebase("users", user.$id, "following")).$loaded().then(function(list){
                list.forEach(function(snapshot){
                    var follower = snapshot;
                    follower.selected = false;
                    $scope.followers.push(follower);
                });
                $ionicSlideBoxDelegate.next();
                $ionicScrollDelegate.scrollTop();
            });
        };

        $scope.cancelSearch = function(){
            $scope.search.text = "";
        }

        $scope.create = function(){
            if(!$scope.group.name) return $scope.message = $translate.instant('NAME_MANDATORY');

            $scope.group.platforms = angular.copy($scope.platforms).filter(function(p){return p.selected}).map(function(p){p.allow = true;return p; });

            if($scope.group.platforms.length == 0) return $scope.message = $translate.instant('PLATFORM_MANDATORY');

            var newGroupRef = $firebase("groups").push();
            $scope.group.id = newGroupRef.key();
            $scope.group.activities = $scope.subject.activities;
            $scope.group.levels = $scope.subject.levels;
            $scope.group.photo = $scope.subject.photo;
            $scope.group.totalActivities = 0;
            $scope.group.totalParticipants = 0;
            $scope.group.registrationTimestamp = Firebase.ServerValue.TIMESTAMP;
            $scope.group.type = "private";
            $scope.group.owner = user.$id;

            var creation = {};
            creation[$path("groups", $scope.group.id)] = $scope.group;
            creation[$path("users", user.$id, "groups/private", $scope.group.id)] = $scope.group;

            var notification = $firebase("notifications/groups_participants/add").push();
            creation[$path("notifications/groups_participants/add", notification.key())] = {groupId : $scope.group.id, type : $scope.group.type, id : user.$id, nickname : user.nickname, photo : user.photo, status : "confirmed", timestamp : Firebase.ServerValue.TIMESTAMP};

            for (var i = 0; i < $scope.followers.length; i++) {
                if($scope.followers[i].selected){
                    var follower = $scope.followers[i];
                    var notification = $firebase("notifications/groups_participants/add").push();
                    creation[$path("notifications/groups_participants/add", notification.key())] = {groupId : $scope.group.id, type : $scope.group.type, id : follower.$id, nickname : follower.nickname, photo : follower.photo, status : "confirmed", timestamp : Firebase.ServerValue.TIMESTAMP};
                }
            }

            $firebase().update(creation, function(error){
                if(error) return $ionicPopup.alert({ title: $translate.instant('WARNING'), template: $translate.instant('UNKNOWN_PROBLEM_CREATE_GROUP')});

                $helper.group.updateLocal($scope.group);
                $scope.group = {};
                $scope.showMessageWhenCreateFinish();
            });
        };

        $scope.showMessageWhenCreateFinish = function(){
            $ionicPopup.alert({ title: $translate.instant('WARNING'), template: $translate.instant('GROUP_CREATED')})
                .then(function(res){
                    $ionicHistory.nextViewOptions({
                        disableBack: true
                    });
                    $state.go("groups");
                });
        };

        $scope.back = function(){
            $scope.subject = null;
            $scope.cancelSearch();
            if($ionicSlideBoxDelegate.currentIndex() == 0)
                return $ionicHistory.goBack();
            $ionicSlideBoxDelegate.previous();
        };
    })

;