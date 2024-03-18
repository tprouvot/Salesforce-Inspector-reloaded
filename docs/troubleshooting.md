# Troubleshooting

## Common issues that may occurs

### Blank popup

You've just installed Salesforce Inspector Reloaded and ... the popup is blank 😥
Make sure that third party cookies are enabled in your browser:

![image](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/503852db-37fd-48fb-9a83-f3008a1be9f1)

### Salesforce Inspector Reloaded is not working anymore

One of the cause can be a domain update (Hyperforce migration, MyDomain change ...).
What you need to do is to delete the sid cookie (and website associated cookies if sid did not worked).

![image](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/637656f6-fcb0-4419-b2da-98853049c473)

### Unauthorized or Network error

If your are getting an "Unauthorized" or "Network error" while online, it is likely caused by an authentication issue.
To troubleshoot, clean Local Storage, and then try to reauthenticate in the extension, by clicking the "Click here to generate new token" button, or the "Generate Access Token" button.

When redirected to the "Data Export" tab at the end of the OAuth flow, check the URL parameters in your address bar: if it contains `error=OAUTH_APP_BLOCKED&error_description=this+app+is+blocked+by+admin` this means that your org has API Access Control enabled. In that situation, you must ask your Salesforce admin to install and allow the Salesforce Inspector Connected App before you can use it.

![image](screenshots/oauthError.png)

### Generate new token error

## If you did not enabled 'API Access Control' and continuously see the banner generate token

You may have seen this message because of an expired token, and since this was the only available option clicked on 'Generate new Token'.

Try to run this code in chrome dev console, after inspecting the extension' popup code:

```js
let tokens = Object.keys(localStorage).filter((localKey) =>
  localKey.endsWith("access_token")
);
tokens.forEach((element) => localStorage.removeItem(element));
```
