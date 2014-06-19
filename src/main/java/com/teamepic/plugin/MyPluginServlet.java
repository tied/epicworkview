package com.teamepic.plugin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.servlet.*;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import com.atlassian.sal.api.auth.LoginUriProvider;
import com.atlassian.sal.api.user.UserManager;
import com.atlassian.templaterenderer.TemplateRenderer;

public class MyPluginServlet extends HttpServlet {
	
	private final UserManager userManager;
	private final LoginUriProvider loginUriProvider;
	private final TemplateRenderer templateRenderer;
	
	public MyPluginServlet(UserManager userManager,
			LoginUriProvider loginUriProvider,
			TemplateRenderer templateRenderer) {
		this.userManager = userManager;
		this.loginUriProvider = loginUriProvider;
		this.templateRenderer = templateRenderer;
	}
	
	@Override
	public void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		String username = userManager.getRemoteUsername(req);
		if (username == null || !userManager.isSystemAdmin(username)) {
			redirectToLogin(req, resp);
			return;
		}
		templateRenderer.render("epic.vm", resp.getWriter());
	}
	
	private void redirectToLogin(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.sendRedirect(loginUriProvider.getLoginUri(getUri(req)).toASCIIString());
	}
	
	private URI getUri(HttpServletRequest req) {
		StringBuffer builder = req.getRequestURL();
		if (req.getQueryString() != null) {
			builder.append("?");
			builder.append(req.getQueryString());
		}
		return URI.create(builder.toString());
	}
	
}