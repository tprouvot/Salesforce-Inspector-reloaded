# Troubleshooting

## Common issues that may occurs

### Blank popup

You've just installed Salesforce Inspector Advanced and ... the popup is blank 😥
Make sure that third party cookies are enabled in your browser:

![image](screenshots/allow_cookie.png?raw=true)

### Salesforce Inspector Advanced is not working anymore

One of the cause can be a domain update (Hyperforce migration, MyDomain change ...).
What you need to do is to delete the sid cookie (and website associated cookies if sid did not worked).

![image](screenshots/delete_cookie.png?raw=true)

### Unauthorized or Network error

If your are getting an "Unauthorized" or "Network error" while online, it is likely caused by an authentication issue.
To troubleshoot, clean Local Storage, and then try to reauthenticate in the extension, by clicking the "Click here to generate new token" button, or the "Generate Access Token" button.

When redirected to the "Data Export" tab at the end of the OAuth flow, check the URL parameters in your address bar: if it contains `error=OAUTH_APP_BLOCKED&error_description=this+app+is+blocked+by+admin` this means that your org has API Access Control enabled. In that situation, you must ask your Salesforce admin to install and allow the Salesforce Inspector Connected App before you can use it.

![image](screenshots/oauthError.png?raw=true)
