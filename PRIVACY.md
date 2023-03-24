# Privacy Policy

The Salesforce Inspector browser extension/plugin communicates directly between the user's web browser and the Salesforce servers. No data is sent to other parties and no data is persisted outside of Salesforce servers after the user leaves the Salesforce Inspector pages.
The Inspector communicates via the official Salesforce webservice APIs on behalf of the currently logged in user. This means the Inspector will be capable of accessing nothing but the data and features the user has been granted access to in Salesforce.

All Salesforce API calls from the Inspector re-uses the access token/session used by the browser to access Salesforce. To acquire this access token the Salesforce Inspector requires permission to read browser cookie information for Salesforce domains.

To validate the accuracy of this description, inspect the source code, monitor the network traffic in your browser or take my word.


## Local Storage Policy
Local storage objects are sets of data that can be stored on your browser and/or hard drive by us.
We use local storage objects to remember your :

- Query History
- Saved Queries
- Environment type (PROD or Sandbox)
- Client Id @ Session Id (only if you're using Salesforce Extension with a connected App)

We do not use local storage objects for any other purpose. You may erase the local storage objects by deleting your browser's history.