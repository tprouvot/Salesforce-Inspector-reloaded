# Privacy Policy

The Salesforce Inspector Reloaded browser extension/plugin communicates directly between the user's web browser and the Salesforce servers. No data is sent to other parties.

We are saving some info in the browser localStorage to avoid redundant queries and save user extension's preferences. None of the saved elements are related to Salesforce SObject data (Account, Contact etc.)

You can find the list of all the localStorage saved [here](https://github.com/search?q=repo:tprouvot/Salesforce-Inspector-reloaded+"localStorage"+path:addon&type=code) and inspect what is stored by following [this tutorial](https://tprouvot.github.io/Salesforce-Inspector-reloaded/how-to/#import-export-configuration-saved-query-etc).

The extension communicates via the official Salesforce webservice APIs on behalf of the currently logged in user. This means the extension will be capable of accessing nothing but the data and features the user has been granted access to in Salesforce.

All Salesforce API calls from the Inspector re-uses the access token/session used by the browser to access Salesforce (or the generated on if API Access Control is enabled). To acquire this access token the Salesforce Inspector requires permission to read browser cookie information for Salesforce domains.

To validate the accuracy of this description, inspect the source code, monitor the network traffic in your browser or take my word.

## Local Storage Policy
Local storage objects are sets of data that can be stored on your browser and/or hard drive by us.
We use local storage objects to remember your :

- Query History
- Saved Queries
- Environment type (PROD or Sandbox)
- Client Id @ Session Id (only if you're using Salesforce Extension with a connected App)

We do not use local storage objects for any other purpose. You may erase the local storage objects by deleting your browser's history.