# REST Explorer

The REST Explorer allows you to interact with Salesforce REST APIs directly from the extension. It provides a user-friendly interface to make API calls, save queries, and manage request history.

## Features

### Request Management

<ul>
  <li><strong>HTTP Methods</strong>: Support for all standard HTTP methods:
    <ul>
      <li>GET</li>
      <li>POST</li>
      <li>PUT</li>
      <li>PATCH</li>
      <li>DELETE</li>
    </ul>
  </li>
  <li><strong>Request Templates</strong>: Pre-configured templates for common operations:
    <ul>
      <li>Get Limits</li>
      <li>Execute Anonymous Apex</li>
      <li>Get Account</li>
      <li>Create Account</li>
      <li>Update Account</li>
      <li>Delete Account</li>
    </ul>
  </li>
</ul>

### Query History

- **Recent Queries**: Automatically saves your last 100 queries
- **Saved Queries**: Save up queries with custom labels
- **Query Management**:

  - Save queries with custom labels
  - Clear all saved queries
  - Clear recent query history

### Request Body

- Support for JSON request bodies
- Syntax highlighting for better readability
- Automatic formatting of request bodies

### Response Handling

- **Response Format**: Automatic detection and formatting of:

  - JSON responses
  - XML responses

- **Response Features**:

  - Copy response to clipboard
  - Clear response
  - Display response time
  - Show HTTP status code
  - Syntax highlighting for better readability

### API Discovery

- **Auto-completion**: Suggests available API endpoints as you type
- **API List**: Displays all available REST API endpoints
- **Filtering**: Real-time filtering of API endpoints based on input

### Keyboard Shortcuts

- **Send Request**:

  - Ctrl + Enter
  - F5

### User Interface

- **User Context**: Displays current user information and organization name
- **Quick Navigation**: Direct link to Salesforce Home
- **Loading Indicator**: Visual feedback during API calls
- **Error Handling**: Clear display of API errors and status codes

### Request Headers

The extension automatically handles:

- Authentication headers
- Content-Type headers
- API version headers

### Performance Metrics

- Response time tracking
- Batch processing statistics (when applicable)
- Real-time progress indicators

## Usage Tips

1. Start with the pre-configured templates to learn common API patterns
2. Use the auto-completion feature to discover available endpoints
3. Save frequently used queries with descriptive labels
4. Use the copy feature to share API responses
5. Monitor response times to optimize your queries

## Best Practices

1. Always verify the HTTP method before sending requests
2. Use saved queries for frequently used operations
3. Clear sensitive data from the response before sharing
4. Monitor response times for performance optimization
5. Use appropriate HTTP methods for your operations (GET for reading, POST for creating, etc.)