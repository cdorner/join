// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('join', ['ionic', 'firebase', 'database.services',
        'login.controllers',

        'join.groups.active',
        'join.groups.search',
        'join.groups.chat',
        'join.groups.options',

        'join.engaged.groups',

        'join.invite.controllers',

        'join.contacts.controllers',
    ])

    .run(function($ionicPlatform, $state, $database) {
        $ionicPlatform.ready(function() {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
                cordova.plugins.Keyboard.disableScroll(true);

            }
            if (window.StatusBar) {
                // org.apache.cordova.statusbar required
                StatusBar.styleLightContent();
            }

            var onResume = function(){
                var attempts = 0;
                var retries = setInterval(function(){
                    attempts += 1;
                    if(attempts >= 3){
                        clearInterval(retries);
                    }

                    if(window.localStorage.getItem("invite")){
                        clearInterval(retries);
                        var invite = JSON.parse(window.localStorage.getItem("invite"));
                        switch(invite.command) {
                            case "accept":
                                $state.go("group_chat", {groupId : invite.groupId, type : invite.type});
                                break;
                            case "ignore":
                                $state.go("dash", {groupId : invite.groupId, type : invite.type});
                                break;
                            case "confirmation":
                                $state.go("group_chat", {groupId : invite.groupId, type : invite.type});
                                break;
                            case "drop":
                                $state.go("dash", {groupId : invite.groupId, type : invite.type});
                                break;
                            default:
                                window.localStorage.removeItem("invite");
                        }
                    } else if(window.localStorage.getItem("chat")){
                        clearInterval(retries);
                        var chat = JSON.parse(window.localStorage.getItem("chat"));
                        window.localStorage.removeItem("chat");
                        switch(chat.command) {
                            case "open":
                                $state.go("group_chat", {groupId : chat.groupId, type : chat.type});
                                break;
                            default:
                                window.localStorage.removeItem("chat");
                        }
                    }
                }, 2000);
            }

            onResume();
            document.addEventListener("resume", onResume, false);

            document.addEventListener("backbutton", onBackKeyDown, false);

            function onBackKeyDown() {
                var location = document.location.hash;
                if(location.indexOf("#/tab/dash") == 0 || location.indexOf("#/tab/groups") == 0){
                    navigator.app.exitApp();
                }
            }
        });
    })

    .config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider) {
        $ionicConfigProvider.tabs.position('bottom');
        // Cache is disable due a problem with chats
        $ionicConfigProvider.views.maxCache(0);

        // Ionic uses AngularUI Router which uses the concept of states
        // Learn more here: https://github.com/angular-ui/ui-router
        // Set up the various states which the app can be in.
        // Each state's controller can be found in controllers.js
        $stateProvider

            .state('scaffold', {
                abstract: true,
                templateUrl: "index.html"
            })

            .state('login', {
                url: '/login',
                templateUrl: "templates/login.html",
                controller: 'LoginController'
            })

            .state('register', {
                url: '/register',
                templateUrl: 'templates/register.html',
                controller: 'LoginController'
            })

            // setup an abstract state for the tabs directive
            .state('tab', {
                url: '/tab',
                abstract: true,
                parent: "scaffold",
                templateUrl: 'templates/tabs.html'
            })

            // Each tab has its own nav history stack:

            .state('dash', {
                url: '/dash',
                parent: "tab",
                views: {
                    'tab-dash': {
                        templateUrl: 'templates/tab-dash.html',
                        controller: 'ActiveGroupsController'
                    }
                }
            })

            .state('active_group', {
                url: '/:type/:groupId',
                parent: "dash",
                views: {
                    'tab-dash@tab': {
                        templateUrl: 'templates/chat.html',
                        controller: 'GroupChatController'
                    }
                }
            })

            .state('active_group_chat_options', {
                url: '/options',
                parent: "active_group",
                views: {
                    'tab-dash@tab': {
                        templateUrl: 'templates/group-options.html',
                        controller: 'ChatOptionsController'
                    }
                }
            })

            .state('groups', {
                url: '/groups',
                parent: "tab",
                views: {
                    'tab-groups': {
                        templateUrl: 'templates/tab-groups.html',
                        controller: 'GroupsEngagedController'
                    }
                }
            })

            .state('group_chat', {
                url: 'group/:type/:groupId',
                templateUrl: 'templates/chat.html',
                controller: 'GroupChatController'
            })

            .state('group_options', {
                url: 'group/:type/:groupId/options',
                templateUrl: 'templates/group-options.html',
                controller: 'GroupOptionsController'
            })

            .state('group_participantes', {
                url: 'group/:type/:groupId/participantes',
                templateUrl: 'templates/group-participantes.html',
                controller: 'GroupParticipantesController'
            })

            .state('group_subordinates', {
                url: 'group/:type/:groupId/subordinates',
                templateUrl: 'templates/group-subordinates.html',
                controller: 'GroupSubordinatesController'
            })

            .state('edit_activity', {
                url: 'group/:type/:groupId/edit',
                templateUrl: 'templates/edit-activity.html',
                controller: 'EditActivityController'
            })

            .state('contacts', {
                url: '/contacts',
                parent: "tab",
                views: {
                    'tab-contacts': {
                        templateUrl: 'templates/tab-contacts.html',
                        controller: 'ContactsController'
                    }
                }
            })

            .state('group-advanced-search', {
                url: '/groups/search',
                templateUrl: 'templates/advanced-search.html',
                controller: 'GroupAdvancedSearchCtrl'
            })

            .state('create-group', {
                url: '/create',
                templateUrl: 'templates/create-group.html',
                controller: 'CreateGroupController'
            })

            .state('group-invite', {
                url: '/invite',
                templateUrl: 'templates/invite-group.html',
                controller: 'InviteCtrl'
            })

            .state('change-password', {
                url: '/change-password',
                templateUrl: 'templates/change-password.html',
                controller: 'ChangePasswordController'
            })
        ;

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('/login');

    });
