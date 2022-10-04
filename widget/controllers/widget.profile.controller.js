'use strict';

(function (angular) {
    angular.module('socialPluginWidget')
        .controller('ProfileCtrl', ['$scope', '$rootScope', '$routeParams', 'Buildfire', 'SubscribedUsersData', 'SocialItems','TDCardDelegate','Location', function ($scope, $rootScope, $routeParams, Buildfire, SubscribedUsersData, SocialItems, TDCardDelegate, Location) {

            var Profile = this;
            Profile.userDetails = {};
            Profile.users = [];
            Profile.wallId = null;
            Profile.showMore = false;
            Profile.noResultsText = null;
            Profile.searchOptions = {
                pageSize: 50,
                page: 0
            }
            Profile.context = null;
            Profile.languages = null;
            Profile.appSettings = null;
            Profile.SocialItems = SocialItems.getInstance();
            Profile.init = function () {
                $rootScope.showThread = false;
                var selectedUser = JSON.parse(localStorage.getItem('chosenUser'));
                   
                Profile.appSettings = Profile.SocialItems.appSettings;
                Profile.languages = Profile.SocialItems.languages.ProfileBlankState;
                if ($routeParams.wallId === "home") Profile.wallId = "";
                else Profile.wallId = $routeParams.wallId;
                Profile.SocialItems.authenticateUser(null, (err, user) => {
                    if (err) return console.error("Getting user failed.", err);
                    if (user) {
                        SubscribedUsersData.getUsersWhoFollow(user._id, Profile.wallId, function (err, users) {
                            if (err) return console.log(err);
                            Profile.users = users;
                            angular.forEach(Profile.users, function (values, key) {
                                buildfire.auth.getUserProfile({ userId: values.userId }, (err, user) => {
                                    values._userProfiles = user;
                                    $scope.$digest();
                                 })
                            })
                            angular.forEach(Profile.users, function (values, key) {
                               
                                if (values.userId === selectedUser){
                                    var lastUser = Profile.users.splice(key,1);
                                    Profile.users.push(lastUser[0]);
                                    localStorage.removeItem('chosenUser')
                                }
                            });
                            console.log(Profile.users);
                            $scope.$digest();
           
                        });
                    }
                });
            }
            // $scope.cardDestroyed = function(index) {
            //     console.log(index);
            //     var TopCard =  Profile.users[index];
            //     Profile.users.splice(index, 1);
            //     Profile.users.push(TopCard);
            //     console.log(Profile.users)
            //   };
            
            //   $scope.addCard = function() {
            //     var newCard = cardTypes[Math.floor(Math.random() * cardTypes.length)];
            //     newCard.id = Math.random();
            //     $scope.cards.push(angular.extend({}, newCard));
            //   }
            $scope.cardSwipedLeft = function(index) {
                var TopUser =  Profile.users[index];
                Profile.users.splice(index, 1);
                Profile.users.unshift(TopUser);
              };
              $scope.cardSwipedRight = function(index) {
                var TopUser =  Profile.users[index];
                Profile.users.splice(index, 1);
                Profile.users.unshift(TopUser);
              };
            $scope.clear = function () {
                $scope.searchInput = "";
                Profile.noResultsText = Profile.languages.ProfileBlankState;
                Profile.searchOptions.page = 0;
                SubscribedUsersData.getUsersWhoFollow(Profile.userDetails._id, Profile.wallId, function (err, users) {
                    if (err) return console.log(err);
                    Profile.users = users;
                    $scope.$digest();
                });
            }

            $scope.onSearchChange = function () {
                let isEmptySearch = ($scope.searchInput.length === 0);
                let minSearchLength = 1;
                if ($scope.searchInput.length === minSearchLength && !isEmptySearch) return;

                Profile.searchOptions.filter = {
                    '_buildfire.index.string1': Profile.wallId ? Profile.wallId : "",
                    $or: [

                        { "$json.userDetails.displayName": { $regex: $scope.searchInput, $options: 'i' } },
                        { "$json.userDetails.firstName": { $regex: $scope.searchInput, $options: 'i' } },
                        { "$json.userDetails.lastName": { $regex: $scope.searchInput, $options: 'i' } },
                        { "$json.userDetails.email": { $regex: $scope.searchInput, $options: 'i' } },
                    ]
                }
                Profile.searchOptions.page = 0;
                Profile.executeSearch(Profile.searchOptions);
            };
            Profile.showMembers = function () {
                Profile.SocialItems.authenticateUser(null, (err, userData) => {
                    if (err) return console.error("Getting user failed.", err);

                    if (userData) {
                        if (Profile.SocialItems.wid) {
                            Location.go('#/members/' + Profile.SocialItems.wid);
                        } else {
                            Location.go('#/members/home');
                        }
                    }
                });

            }
            Profile.executeSearch = function (query) {
                Buildfire.spinner.show();
                SubscribedUsersData.searchForUsers(query, function (err, users) {
                    if (err) return console.log(err);
                    if (users.length === Profile.searchOptions.pageSize) {
                        Profile.searchOptions.page++;
                        Profile.showMore = true;
                    }
                    else if (users.length === 0) {
                        Profile.noResultsText = Profile.languages.ProfileNoResults;
                    }
                    else {
                        Profile.showMore = false;
                    }

                    Profile.users = users.filter(el => el.userId !== Profile.SocialItems.userDetails.userId);
                    Buildfire.spinner.hide();
                    $scope.$digest();
                })
            }

            Profile.loadMore = function () {
                SubscribedUsersData.searchForUsers(Profile.searchOptions, function (err, users) {
                    if (err) return console.log(err);
                    users.map(user => {
                        Profile.users.push(user)
                    })
                    if (users.length === Profile.searchOptions.pageSize) {
                        Profile.searchOptions.page++;
                        Profile.showMore = true;
                    } else {
                        Profile.showMore = false;
                    }
                    $scope.$digest();
                });
            }


            Buildfire.datastore.onUpdate(function (response) {
                if (response.tag === "languages") {
                    let languages = {};
                    Object.keys(response.data.screenOne).forEach(e => {
                        response.data.screenOne[e].value ? languages[e] = response.data.screenOne[e].value : languages[e] = response.data.screenOne[e].defaultValue;
                    });
                    Profile.languages = languages;
                    Profile.noResultsText = languages.ProfileBlankState;
                    $scope.$digest();
                }
                else if (response.tag === "Social") {
                    Profile.appSettings = response.data.appSettings;
                    $scope.$digest();
                }
            });

            Profile.followPrivateWall = function (userId, wid, userName = null) {
                buildfire.auth.getUserProfile({ userId: userId }, (err, user) => {
                    if (err || !user) return console.log('Error while saving subscribed user data.');
                    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                    if (re.test(String(user.firstName).toLowerCase()))
                        user.firstName = 'Someone';
                    if (re.test(String(user.displayName).toLowerCase()))
                        user.displayName = 'Someone';

                    var params = {
                        userId: userId,
                        userDetails: {
                            displayName: user.displayName,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            imageUrl: user.imageUrl,
                            email: user.email,
                            lastUpdated: new Date().getTime(),
                        },
                        wallId: wid,
                        posts: [],
                        _buildfire: {
                            index: { text: userId + '-' + wid, string1: wid }
                        }
                    };

                    userName = Profile.SocialItems.getUserName(params.userDetails)
                    SubscribedUsersData.save(params, function (err) {
                        if (err) console.log('Error while saving subscribed user data.');
                        if (userName)
                            Profile.navigateToPrivateChat({ id: userId, name: userName, wid: wid });
                    });
                })
            }

            Profile.openBottomDrawer = function(user){
                console.log(user)
               // buildfire.auth.openProfile(user.userId);
                Follows.isFollowingUser(user.userId  , (err , r) =>{
                    let listItems = [];
                    if(Profile.appSettings && Profile.appSettings.seeProfile == true) listItems.push({text:'See Profile'});
                    if((Profile.appSettings && !Profile.appSettings.disablePrivateChat) || Profile.appSettings.disablePrivateChat == false) listItems.push({text:'Send Direct Message'});
                    if(Profile.appSettings.allowCommunityFeedFollow == true) listItems.push({text: r ? 'Unfollow' : 'Follow'});
                    if(listItems.length == 0) return;
                    Buildfire.components.drawer.open(
                        {
                            enableFilter:false,
                            listItems: listItems
                        },(err, result) => {
                            if (err) return console.error(err);
                            else if(result.text == "See Profile") buildfire.auth.openProfile(user.userId );
                            else if(result.text == "Send Direct Message") Profile.openPrivateChat(user );
                            else if(result.text == "Unfollow") Follows.unfollowUser(user.userId ,(err, r) => err ? console.log(err) : console.log(r));
                            else if(result.text == "Follow") Follows.followUser(user.userId ,(err, r) => err ? console.log(err) : console.log(r));
                            buildfire.components.drawer.closeDrawer();
                        }
                    );
                })
            }


            Profile.navigateToPrivateChat = function(user) {
                Profile.SocialItems.isPrivateChat = true;
                Profile.SocialItems.items = [];
                Profile.SocialItems.wid = user.wid;
                Profile.SocialItems.pageSize = 5;
                Profile.SocialItems.page = 0;
                $rootScope.showThread = true;
                $rootScope.$broadcast("loadPrivateChat");
                buildfire.history.push(Profile.SocialItems.getUserName(Profile.SocialItems.userDetails) + ' | ' + Profile.SocialItems.getUserName(user.name), {
                    isPrivateChat: true,
                    showLabelInTitlebar: true
                });
            }

            Profile.openPrivateChat = function (user) {
                console.log("openPrivateChat");
                console.log(user);

                if (Profile.appSettings && Profile.appSettings.disablePrivateChat) return;
                Profile.SocialItems.authenticateUser(null, (err, userData) => {
                    if (err) return console.error("Getting user failed.", err);
                    if (userData) {
                        let wid = null;

                        if (Profile.SocialItems.userDetails.userId && Profile.SocialItems.userDetails.userId
                            != user.userId) {
                            if (Profile.SocialItems.userDetails.userId > user.userId)
                                wid = Profile.SocialItems.userDetails.userId + user.userId;
                            else
                                wid = user.userId + Profile.SocialItems.userDetails.userId;
                                console.log(wid)

                               let userName = Profile.SocialItems.getUserName(user.userDetails)

                            SubscribedUsersData.getGroupFollowingStatus(user.userId, wid, Profile.SocialItems.context.instanceId, function (err, status) {
                                if (err) console.error('Error while getting initial group following status.', err);
                                console.log(user, status)
                                if (!status.length) {
                                    Profile.followPrivateWall(user.userId, wid, userName);
                                } else {
                                    Profile.navigateToPrivateChat({ id: user.userId, name: userName, wid: wid });
                                }
                            });

                        }
                    }
                });
            };

            Profile.init();
        }])
})(window.angular);