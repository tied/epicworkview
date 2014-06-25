package com.teamepic.plugin.rest;

import com.atlassian.crowd.embedded.api.User;
import com.atlassian.event.api.EventListener;
import com.atlassian.event.api.EventPublisher;
import com.atlassian.jira.bc.ServiceOutcome;
import com.atlassian.jira.bc.issue.search.SearchService;
import com.atlassian.jira.bc.project.ProjectService;
import com.atlassian.jira.event.issue.IssueEvent;
import com.atlassian.jira.project.Project;
import com.atlassian.jira.user.ApplicationUser;
import com.atlassian.plugins.rest.common.security.AnonymousAllowed;
import com.atlassian.sal.api.user.UserManager;
import com.atlassian.sal.api.user.UserProfile;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.InitializingBean;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.LinkedList;
import java.util.List;


/**
 * Entry point for REST calls for projects
 */
@Path("/")
public class RestResource implements InitializingBean, DisposableBean {

	private ProjectService projectService;
	private SearchService searchService;
	private UserManager userManager;
	private com.atlassian.jira.user.util.UserManager jiraUserManager;
	private EventPublisher eventPublisher;

	/**
	 * Rest resource that use dependency injection to get necessary components
	 * @param projectService - used to get projects from jira
	 * @param searchService - used to search for issue in jira
	 * @param userManager - used to get the current user from the browser session
	 * @param jiraUserManager - used to get the user in jira from the remote user
	 * @param eventPublisher - used to register listeners to jira's notification system
	 */
	public RestResource(ProjectService projectService, SearchService searchService,
					    UserManager userManager, com.atlassian.jira.user.util.UserManager jiraUserManager,
						EventPublisher eventPublisher) {
		this.projectService = projectService;
		this.searchService = searchService;
		this.userManager = userManager;
		this.jiraUserManager = jiraUserManager;
		this.eventPublisher = eventPublisher;
	}

	/**
	 * Called when the plugin has been enabled.
	 * @throws Exception
	 */
	@Override
	public void afterPropertiesSet() throws Exception {
		//remove any listeners already registered, in case jira enables this plugin without first disabling it
		eventPublisher.unregister(this);
		// register ourselves with the EventPublisher
		eventPublisher.register(this);//add this object to listen for events
	}

	/**
	 * Called when the plugin is being disabled or removed.
	 * @throws Exception
	 */
	@Override
	public void destroy() throws Exception {
		// unregister ourselves with the EventPublisher
		eventPublisher.unregister(this);
	}

	/**
	 * Gets the current user that is logged into jira
	 * @return the user currently logged in
	 */
	private User getCurrentUser()
	{
		// To get the current user, we first get the username from the session.
		// Then we pass that over to the jiraUserManager in order to get an
		// actual User object.
		UserProfile ru = userManager.getRemoteUser();

		//if there is a user profile
		if(ru != null)
		{
			ApplicationUser appUser = jiraUserManager.getUserByName(ru.getUsername());

			//if there is an application user
			if(appUser != null)
				return appUser.getDirectoryUser();
		}

		return null;
	}

	/**
	 * Called when the rest url is submitted for projects
	 * @return all the projects in jira in either xml or json viewable to the current user
	 */
	@Path("/projects")
    @GET
    @AnonymousAllowed
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public Response getProjects() {
		User user = getCurrentUser();
		//get the projects viewable to the current user
		ServiceOutcome<List<Project>> outcome =  projectService.getAllProjects(user);
		List<Project> projects = outcome != null ? outcome.get() : new LinkedList<Project>();

        return Response.ok(new RestProjectResourceModel(projects, searchService, user)).build();
    }

	/**
	 * Event listening testing
	 * @param issueEvent
	 */
	@EventListener
	public void issueEventListener(IssueEvent issueEvent) {
	}
}