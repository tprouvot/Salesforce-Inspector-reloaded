# REST Explore

## Overview

Salesforce Inspector Reloaded offers a powerful way to interact with Salesforce data directly from your browser. One of the standout features is the REST API Explorer, which enables users to send REST API requests to a Salesforce instance without leaving the Inspector's interface.

This guide explains how to use the REST API Explorer in Salesforce Inspector Reloaded and covers the features available in this tool.

## REST API Explorer: How It Works

The REST API Explorer in Salesforce Inspector Reloaded allows you to make API requests to Salesforce and get responses instantly. This feature leverages the Salesforce REST API, a standard interface for interacting with your Salesforce data.

### Key Components

1. **Input Fields**
   - The interface includes several key fields:
     - **Method**: Choose the HTTP method (e.g., `GET`, `POST`, `PATCH`, `DELETE`) you want to use for the API request.
     - **URL**: Input the relative URL of the API endpoint (e.g., `/services/data/{apiVersion}/sobjects/Account/describe`).
     - **Body**: Provide JSON-formatted data when using `POST`, `PATCH`, or any other method that requires a body.

2. **Request & Response Panels**
   - The **Request** panel allows you to enter your request details sent to Salesforce.
   - The **Response** panel displays the server's response, formatted for readability. This includes the HTTP status code, response body, and any other relevant details.

3. **Buttons**
   - **Save Request**: Allows you to save the request details for future reference, facilitating repetitive actions without retyping.
   - **Send**: Executes the request with the details provided in the input fields.
   - **Clear**: Clears the response panel.
   - **Copy**: Copy the JSON response.

4. **Header**
   - **Query Type**: Select the query type you want to search for, or the type you want to save your query in. Clicking on the heart icon will set it as default and pre-select this value when loading the page.
   - **Search Input**: Enter keywords from your endpoint or query name to search for it. On the right side of the query you have the possibility to delete the query by clicking on the bin icon.
   - **Query Label**: Enter the label for your query to save.
   - **Save Button**: Allows you to save the request details for future reference, facilitating repetitive actions without retyping.

### Key Features and Tips

- **Auto-complete and History**: The URL input field supports auto-complete based on previously entered endpoints, speeding up api endpoint selection.
- **Syntax Highlighting**: JSON responses are formatted with syntax highlighting to improve readability.
- **Error Handling**: Errors are caught and displayed in the Response panel, showing HTTP error codes (e.g., `404 Not Found` or `401 Unauthorized`) along with a descriptive message.
- **Authentication**: The extension manages the OAuth token needed for authorization, so you don't have to worry about handling authentication headers manually.
- **Debugging**: Use the "Console" in your browser’s Developer Tools to see detailed logs if any unexpected behavior occurs. Salesforce Inspector Reloaded logs API interactions for troubleshooting.

## Example Use Case

Here’s a simple example to retrieve a list of Accounts:

1. **Method**: `GET`
2. **URL**: `/services/data/{apiVersion}/query/?q=SELECT+Id,Name+FROM+Account`
3. **Body**: Leave empty since `GET` does not require a request body.
4. **Send Request**: Click "Send" and observe the response which will include the list of accounts in JSON format.

## Conclusion

The REST API Explorer is a robust tool for both developers and admins who want to interact with their Salesforce data seamlessly. By providing a user-friendly interface for making REST API requests, Salesforce Inspector Reloaded simplifies the process of accessing and managing Salesforce data. Whether you're debugging an integration or testing API calls, the Explorer is a valuable addition to your toolkit.

For more details, check the [GitHub repository](https://github.com/tprouvot/Salesforce-Inspector-reloaded) or read the full [Salesforce Ben article](https://www.salesforceben.com/explore-rest-api-with-salesforce-inspector-reloaded/).
