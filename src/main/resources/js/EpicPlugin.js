
var elementEnum = {
	PROJECT: 0,
	EPIC: 1,
	STORY: 2,
	SUBTASK: 3
};

// Time of most recent update
var lastUpdateTime = 0;

// Whether to continuously refresh projects
var refresh = true;

// The currently clicked epic, or null if none clicked
var clickedEpic = null;

var animatedStoryId = null;

// Unique epic id to use for fake epics
var uniqueEpicId = -1;

// Queue holding epics to animate.
// Each epic is a queue with an epic followed by stories to animate
var epicAnimationQueue = [];

// Whether Jira is using the new colors
var usingNewColors = false;

jQuery(document).ready(function() {
    var duration = 500;
    jQuery(window).scroll(function() {
        if (jQuery(this).scrollTop() > 0) {
            jQuery('#scroll-to-top').fadeIn(duration);
        } else {
            jQuery('#scroll-to-top').fadeOut(duration);
        }
    });

    jQuery('#scroll-to-top').click(function(event) {
        event.preventDefault();
        jQuery('html, body').animate({scrollTop: 0}, duration);
        return false;
    });
});

/*
 * Controller to manage table of projects
 */
function ProjectController($scope, $http, $cookieStore, $window) {
    $scope.baseURL = jQuery('input[title="baseURL"]').val();

    $scope.getBaseURL = function() {
        return $scope.baseURL;
    };

    /*
     * Finds if the element is already in the list and returns the index, based on the element ids
     * returns -1 if not found
     */
    function indexOf(list, elem) {
      var where = -1;
      var isNegative = function(number) {
  		return (typeof number === 'number' && number < 0);
  	  };
      angular.forEach(list, function(e, i) {
    	//if element ids are equal or both negative
        if(e.id === elem.id || (isNegative(e.id) && isNegative(elem.id))) {
            where = i;
        }
      });
      return where;
    }

    // returns whether the given object is contained in the given list
    function contains(a, obj) {
        var i = a.length;
        while (i--) {
           if (a[i] === obj) {
               return true;
           }
        }
        return false;
    }

    /* --------------------------------------------------------------------------------------- */
    /* ---------------------------------- Project List --------------------------------------- */
    /* --------------------------------------------------------------------------------------- */

    $scope.projects = [];

    $scope.loading = true;

    // Get all the projects in the last amount of seconds and set them in a local variable (projects)
    $scope.getProjects = function(seconds) {
        $http.get($scope.baseURL+'/rest/epic/1/projects.json?seconds='+seconds).
        success(function(data) {
            // check if using new colors
            if (!usingNewColors) {
                setColor(data);
            }
            lastUpdateTime = new Date().getTime();
            //add the new projects to the projects array
            updateElementList($scope.projects, data, elementEnum.PROJECT);
            animateEpics();
            $scope.loading = false;
        }).
        error(function() {
        	console.log("error loading projects");
        });
    };

    // Updates the current list with any changes from the new list of elements
    function updateElementList(currentList, newList, elementType) {
        angular.forEach(newList, function(element) {
            // find index of the new element in the current list
            var elementIndex = indexOf(currentList, element);
            var savedElement = null;
            // if the element isn't there and isn't a deleted element, add it
            if (elementIndex === -1 && element.timestamp !== -1) {
            	savedElement = element;
            	//add to front of list
            	currentList.unshift(element);
            	// animate
            	addToAnimationQueue(savedElement, elementType);
            	// set its state to true if it is a project and not in the list of unchecked projects
            	element.included = elementType === elementEnum.PROJECT && !contains($scope.uncheckedProjectIds, element.id);
            	// update the list held in the current element (to sort and remove elements)
            	updateChildList(savedElement, element, elementType);
            } else if (elementIndex !== -1 && element.timestamp === -1) {
            	// element in list and marked for deletion, so delete it
            	currentList.splice(elementIndex, 1);
        	} else if (elementIndex !== -1) {
        		// element in current list, so update it
            	savedElement = currentList[elementIndex];
                // animate any updated epics
                if (savedElement.timestamp !== element.timestamp) {
                    addToAnimationQueue(savedElement, elementType);
                }
                savedElement.timestamp = element.timestamp;
                savedElement.name = element.name;
                savedElement.key = element.key;
                savedElement.description = element.description;
                savedElement.contributor = element.contributor;
                // set completed field if a story
                if (elementType === elementEnum.STORY) {
                    savedElement.completed = element.completed;
                    savedElement.contributors = element.contributors;
                }
                // update the list held in the current element, if it has one
                updateChildList(savedElement, element, elementType);
            }
        });
        // sort the list and remove all old elements
        if (currentList !== undefined && currentList !== null) {
            currentList.sort(function(a, b) {
            	return b.timestamp - a.timestamp;
            });
            removeOldElements(currentList, $scope.filterDays);
        }
    }

    // update the child list of savedElement with the child list of element
    function updateChildList(savedElement, element, elementType) {
    	if (element.children !== undefined && element.children !== null) {
    		updateElementList(savedElement.children, element.children, elementType + 1);
    	}
    }
    
    function addToAnimationQueue(element, elementType) {
    	if (elementType === elementEnum.EPIC) {
    		epicAnimationQueue.push([element]);
    	} else if (elementType === elementEnum.STORY && epicAnimationQueue.length > 0) {
    		epicAnimationQueue[epicAnimationQueue.length - 1].push(element);
    	}
    }

    /*
     * Remove elements from the list that are older than days old
     * (elements should be in time order)
     */
    function removeOldElements(elements, days) {
        var time = new Date().getTime();
        var i = elements.length - 1;
        var element = elements[i];
        while (i >= 0 && ((time - element.timestamp) / (1000 * 60 * 60 * 24)) > days) {
            elements.pop();
            i--;
            element = elements[i];
        }
    }

    // Get all recently changed projects and update or add them to the local projects variable
    updateProjects = function() {
        var secsSinceUpdate = (new Date().getTime() - lastUpdateTime) / 1000;
        $scope.getProjects(Math.ceil(secsSinceUpdate));
    };

    // Loop through epics to find a non-null epic and set whether it is using new colors
    function setColor(projects) {
        for (var i = 0; i < projects.length; i++) {
            if(projects[i].children !== undefined && projects[i].children !== null) {
                var j = 0;
                var epic = projects[i].children[0];
                while (epic !== undefined && epic !== null) {
                    if (epic.id >= 0) {
                        if (epic.color[0] === '#') {
                            usingNewColors = false;
                        } else {
                            usingNewColors = true;
                        }
                        return;
                    }
                    j++;
                    epic = projects[i].children[j];
                }
            }
        }
    }

    /* --------------------------------------------------------------------------------------- */
    /* -------------------------------- Screen Navigation ------------------------------------ */
    /* --------------------------------------------------------------------------------------- */

    $scope.isFullScreen = false;

    $scope.toggleFullScreen = function() {
        jQuery("header").slideToggle();
        jQuery("footer").fadeToggle();
        $scope.isFullScreen = !$scope.isFullScreen;
    };
    
    /* --------------------------------------------------------------------------------------- */
    /* ------------------------------ Time Filter Drop Down ---------------------------------- */
    /* --------------------------------------------------------------------------------------- */
    
    $scope.filterDays = 7;
    
    $scope.changeFilterDays = function(number) {
    	$scope.filterDays = number;
    	$scope.loading = true;
    	$scope.hideEpicInfo();
    	$scope.getProjects($scope.filterDays * 24 * 60 * 60);
    };

    /* --------------------------------------------------------------------------------------- */
    /* -------------------------------- Contributor List ------------------------------------- */
    /* --------------------------------------------------------------------------------------- */

    // The max number of contributors to display
    var maxContributors = 24;

    // returns all contributors for this project in order of time worked on project
    $scope.getContributors = function(project) {
        var contributors = []; 
        getContributorsHelper(contributors, project);
        // sort contributors
        contributors.sort(function(a, b){
        	return b.timestamp - a.timestamp;
        });
        // slice off any more than max
        if (contributors.length > maxContributors) {
            return result.slice(0, maxContributors - 1);
        }
        // set project's contributor count
        project.contributorCount = contributors.length;
        return contributors;
    };

    // helper to get list of contributors
    function getContributorsHelper(result, element) {
    	if (element.contributor !== undefined && element.contributor !== null) {
    		if (indexOf(result, element.contributor) === -1) {
    			result.push(element.contributor);
    		}
    	}
    	if (element.contributors !== undefined && element.contributors !== null) {
    		angular.forEach(element.contributors, function(contributor) {
    			if (indexOf(result, contributor) === -1) {
    				result.push(contributor);
    			}
    		});
    	}
    	if (element.children !== undefined && element.children !== null) {
    		angular.forEach(element.children, function(child) {
    			getContributorsHelper(result, child);
    		});
    	}
    }

    // Return how many extra contributors there are for the project after
    // the max contributor count
    $scope.extraContributorCount = function(project) {
        if (project.contributorCount === undefined) {
            return 0;
        }
        return project.contributorCount - maxContributors + 1;
    };

    /* --------------------------------------------------------------------------------------- */
    /* ------------------------------ Other Table Columns ------------------------------------ */
    /* --------------------------------------------------------------------------------------- */

    // Returns the number of completed stories for the project
    $scope.getCompletedStories = function(project) {
        var res = 0;
        angular.forEach(project.children, function(epic) {
            angular.forEach(epic.children, function(story) {
                if (story.completed) {
                	res++;
                }
            });
        });
        return res;
    };

    // Return the difference between the current time and the given time, 
    // as a list of a number and a string
    // returns a shorter string if short is true
    $scope.millisecondToString = function(milli, short) {
        currentTime = new Date().getTime();
        lastUpdated = currentTime - milli;
        seconds = Math.round(lastUpdated / 1000);
        if (seconds < 60) {
            return short ? [seconds, "s"] : pluralize(seconds, "second");
        }
        minutes = Math.round(seconds / 60);
        if (minutes < 60) {
            return short ? [minutes, "m"] : pluralize(minutes, "minute");
        }
        hours = Math.round(minutes / 60);
        if (hours < 24) {
            return short ? [hours, "h"] : pluralize(hours, "hour");
        }
        days = Math.round(hours / 24);
        return short ? [days, "d"] : pluralize(days, "day");
    };

    // appends an "s" to the unit if the number is greater than one
    function pluralize(num, unit) {
        if (num === 1) {
            return [num, unit];
        }
        return [num, unit + "s"];
    }

    /* --------------------------------------------------------------------------------------- */
    /* --------------------------------- Project Filter -------------------------------------- */
    /* --------------------------------------------------------------------------------------- */

    $scope.query = "";

    $scope.embeddedUrl = "";

    // clear all checkboxes and update projects accordingly
    $scope.clearchkbox = function() {
        angular.forEach($scope.filteredProjects, function (project) {
            if(project.included) {
                $scope.checkProject(project);
            }
        });
    };

    // check all checkboxes and update projects accordingly
    $scope.checkchkbox = function() {
        angular.forEach($scope.filteredProjects, function (project) {
            if(!project.included) {
                $scope.checkProject(project);
            }
        });
    };

    // toggle the projects state and update the cookie for the users checked projects
    $scope.checkProject = function(project) {
        // flip the projects state
        project.included = !project.included;
        var projIndex = $scope.uncheckedProjectIds.indexOf(project.id);

        if (project.included && projIndex !== -1) {
            // remove project from unchecked projects list
            $scope.uncheckedProjectIds.splice(projIndex, 1);
        } else if(!project.included && projIndex === -1) {
            // add project to unchecked projects list
            $scope.uncheckedProjectIds.push(project.id);
        }
        // update the cookie
        $cookieStore.remove('projectIds');
        $cookieStore.put('projectIds', $scope.uncheckedProjectIds);
        $scope.cookieState();
    };

    // Sets embedded url
    $scope.cookieState = function() {
        var location = $window.location;
        $scope.embeddedUrl = [location.protocol, '//', location.host, location.pathname, '?ids=', $scope.uncheckedProjectIds.join()].join('');
    };

    $scope.search = function (item){
        if (item.name.toLowerCase().indexOf($scope.query.toLowerCase()) !== -1 ||
                item.group.toLowerCase().indexOf($scope.query.toLowerCase()) !== -1) {
            return true;
        }
        return false;
    };

    // sort the projects alphabetically by name
    $scope.alphabeticalProjects = function() {
    	var res = [];
    	angular.forEach($scope.projects, function(project) {
    		res.push(project);
    	});
        res.sort(function(a, b){
            if(a.name < b.name) {
            	return -1;
            }
            if(a.name > b.name) {
            	return 1;
            }
            return 0;
        });
        return res;
    };

    /* --------------------------------------------------------------------------------------- */
    /* ----------------------------------- Show Window --------------------------------------- */
    /* --------------------------------------------------------------------------------------- */

    $scope.url = '';
    $scope.showInfoWindow = false;
    var showWindow = false;

    // Sets whether to show the window
    $scope.setShowWindow = function(val) {
        showWindow = val;
    };

    // Returns whether to show the window
    $scope.getShowWindow = function() {
        return showWindow;
    };

    // Sets the modal to be the current user's page
    $scope.setActiveUser = function(id) {
        setupModal($scope.baseURL + "/secure/ViewProfile.jspa?name=" + id);
    };

    // Sets the modal to be the current page
    $scope.setActivePage = function(issue) {
        setupModal($scope.baseURL + "/browse/" + issue.key);
    };

    $scope.setActiveEpic = function(epic, project) {
    	if (epic.id < 0) {
    		setupModal($scope.baseURL + "/plugins/servlet/epicDetails?epic=" + project.key);
    	} else {
    		setupModal($scope.baseURL + "/plugins/servlet/epicDetails?epic=" + epic.key);
    	}
    };

    // Sets the current url to be the given one.
    // Sets a new window to open on full screen
    function setupModal(url) {
        $scope.url = url;
        if($scope.isFullScreen) {
            $scope.setShowWindow(true);
        }
        else {
            $window.location.assign($scope.url);
        }
    }

    /* --------------------------------------------------------------------------------------- */
    /* ------------------------------------ Timeout ------------------------------------------ */
    /* --------------------------------------------------------------------------------------- */

    // set timer for closing windows after inactivity
    var inactivityTimer;
    jQuery(window).mousemove(inactivityReset);
    jQuery(window).scroll(inactivityReset);

    function inactivityReset() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(function() {
            if($scope.isFullScreen) {
                jQuery('#scroll-to-top').click();
                $scope.hideEpicInfo();
                showWindow = false;
            }
        }, 30000);
    }

    $scope.hideEpicInfo = function() {
    	refresh = true;
    	clickedEpic = null;
    };

    /* --------------------------------------------------------------------------------------- */
    /* --------------------------------- Epic Animation -------------------------------------- */
    /* --------------------------------------------------------------------------------------- */

    $scope.animating = false;
    
    // Animate each epic in the queue of epics to animate
    function animateEpics() {
        var resetEpic = function(){
            clickedEpic = null;
            $scope.animating = false;
        };

        while (epicAnimationQueue.length > 0) {
        	$scope.animating = true;
            epicData = epicAnimationQueue.shift();
            epic = epicData.shift();
            clickedEpic = epic.id;
            setTimeout(resetEpic, 4000);
            for (var i = 0; i < epicData.length; i++) {
                animateStory(epicData[i]);
            }
        }
    }

    // Animate the given story
    function animateStory(story) {
        setTimeout(function() {
        	$scope.$apply(animatedStoryId = story.id);
        }, 1000);
        setTimeout(function() {
            $scope.$apply(animatedStoryId = null);
        }, 4000);
    }

    $scope.storyIsAnimated = function(id) {
        return id === animatedStoryId;
    };

    /* --------------------------------------------------------------------------------------- */
    /* -------------------------------------- Main ------------------------------------------- */
    /* --------------------------------------------------------------------------------------- */

    // get the projects which are unchecked by this user
    $scope.uncheckedProjectIds = $cookieStore.get('projectIds');
    // if the user does not have checked preferences, create one for them
    if (typeof $scope.uncheckedProjectIds === 'undefined') {
        $scope.uncheckedProjectIds = [];
        $cookieStore.put('projectIds', $scope.uncheckedProjectIds);
    }

    var stuff = $window.location.search;
    stuff = stuff.slice(1);//remove ?
    stuff = stuff.split('&');

    var key = 'ids';

    angular.forEach(stuff, function(e) {
        if(e.slice(0, key.length) === key) {
            var values = e.split('=')[1];
            if(values.length > 0) {
                values = values.split(',');

                $scope.uncheckedProjectIds = [];

                angular.forEach(values, function(element) {
                    $scope.uncheckedProjectIds.push(parseInt(element));
                });

                $cookieStore.remove('projectIds');
                $cookieStore.put('projectIds', $scope.uncheckedProjectIds);
            }
        }
    });

    $scope.cookieState();

    // Get the projects now
    $scope.getProjects($scope.filterDays * 24 * 60 * 60);

    // Update projects every 5 seconds
    setInterval(function(){
    	if (refresh) { 
    		updateProjects();
    	}
    }, 5000);

    // Refresh all projects every 5 minutes
    setInterval(function(){
    	if (refresh) {
    		$scope.getProjects($scope.filterDays * 24 * 60 * 60);
    	}
    }, 1000 * 60 * 5);
}

/*
 * Controller for the epics of a project
 * Determines which epic information to display
 */
function EpicController($scope) {

    // Set the clicked epic to be id or null if it is already id
    $scope.toggleEpic = function(e, id) {
        e.stopPropagation();
        if (clickedEpic === id) {
            clickedEpic = null;
            refresh = true;
        } else {
            clickedEpic = id;
            refresh = false; // halt project refresh if epic info is open
        }
    };

    // Returns true if the given project contains a clicked epic, false otherwise
    $scope.showEpicWindow = function(project) {
        var epic = getClickedEpic(project);
        return (epic !== null);
    };

    // Returns a list of the stories in the clicked epic of the given project.
    // Returns completed stories if completed is true, incomplete stories otherwise
    $scope.getEpicStories = function(project, completed) {
        var epic = getClickedEpic(project);
        if (epic === null) {
        	return null;
        }
        var result = [];
        for (var i = 0; i < epic.children.length; i++) {
            if (epic.children[i].completed === completed) {
                result.push(epic.children[i]);
            }
        }
        return result;
    };

    // Return the clicked epic from the given project, or none if none are clicked
    getClickedEpic = function(project) {
        for (var i = 0; i < project.children.length; i++) {
            if (project.children[i].id === clickedEpic) {
                return project.children[i];
            }
        }
        return null;
    };

    // Return whether the clicked epic is this epic
    $scope.isClicked = function(id) {
        return clickedEpic === id;
    };

    // Set a unique id for the epic
    $scope.setUniqueId = function(epic) {
        if (epic.id === -1) {
            epic.id = uniqueEpicId;
            uniqueEpicId--;
        }
    };

    $scope.getClickedEpicColor = function(project) {
        var epic = getClickedEpic(project);
        if (epic === null) {
        	return null;
        }
        return $scope.getEpicColor(epic);
    };

    // Return the epic's color
    $scope.getEpicColor = function(epic) {
        if (epic.color[0] === '#' && usingNewColors) {
            return "ghx-label-3";
        }
        return epic.color;
    };

    // Returns a list of post it positions to use for the background of the
    // given name.
    $scope.getPostItOffsets = function(epicName) {
        var list = [];
        for (var i = 0; i < epicName.length / 6; i++) {
            list[i] = i * 22;
        }
        return list;
    };

    // returns a shortened version of the given sentence
    $scope.shorten = function(sentence) {
        if (sentence.length > 32) {
            var res = sentence.substring(0, 32);
            return res + "...";
        }
        return sentence;
    };

    $scope.getFontColor = function() {
        if (usingNewColors) {
            return "#fff";
        }
        return "#000";
    };
}

//object that holds all of the custom directives for angularjs
var directives = {};

//attribute that make all the text be selected on click
directives.selectOnClick = function () {
    return {
        restrict: 'A',
        link: function (scope, element) {
            element.on('click', function () {
                this.select();
            });
        }
    };
};

//element that creates a popup window in the view
directives.modal = function() {
    return {
        restrict: 'E',
        transclude: true,
        template: '<div class="windowView" id="windowBackground"></div><div ng-transclude class="windowView"></div>'
    };
};