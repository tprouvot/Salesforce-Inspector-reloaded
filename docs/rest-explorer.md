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
  - CSV responses
  - Text/Log responses

- **Response Features**:

  - Copy response to clipboard
  - Clear response
  - Display response time (configurable)
  - Display response size (configurable)
  - Show HTTP status code with color-coded badges
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
- Content-Type headers (when request body is present)
- API version headers
- `Accept` header (defaults to `application/json; charset=UTF-8`)

#### Custom Request Headers

You can now customize request headers using the "Headers" button in the request section. This feature allows you to:

- **Override default headers**: Customize the `Accept` header or add additional headers as needed
- **Set Content-Type**: Specify custom Content-Type headers (e.g., `text/csv; charset=UTF-8` for CSV requests)
- **Add custom headers**: Include any additional HTTP headers required for your API calls

**Why Custom Headers?**

Custom headers are essential for:

- **API Compatibility**: Some Salesforce APIs require specific headers or header values
- **Content Negotiation**: Different response formats (CSV, XML, etc.) may require different Accept headers
- **Integration Requirements**: Third-party integrations or custom endpoints may need specific headers
- **Testing & Debugging**: Easily test different header combinations without modifying code

### Performance Metrics

- **Response Time**: Displays request duration in milliseconds
- **Response Size**: Shows response size in human-readable format (KB/MB)
- Batch processing statistics (when applicable)
- Real-time progress indicators

**Configurable Metrics:**

You can customize which metrics are displayed through the Options page:

- Navigate to **Options** → **REST Explorer** tab
- Toggle **Response Size** and **Response Duration** options
- Metrics are only calculated when enabled, improving performance when disabled

These options allow you to:

- Reduce visual clutter when metrics aren't needed
- Improve performance by disabling metric calculations
- Customize the interface to your preferences

## Usage Tips

1. Start with the pre-configured templates to learn common API patterns
2. Use the auto-completion feature to discover available endpoints
3. Save frequently used queries with descriptive labels
4. Use the copy feature to share API responses
5. Monitor response times and sizes to optimize your queries
6. Customize request headers for APIs that require specific headers
7. Use custom Content-Type headers when working with non-JSON formats (CSV, XML, etc.)

## Best Practices

1. Always verify the HTTP method before sending requests
2. Use saved queries for frequently used operations
3. Clear sensitive data from the response before sharing
4. Monitor response times and sizes for performance optimization
5. Use appropriate HTTP methods for your operations (GET for reading, POST for creating, etc.)
6. Customize headers only when necessary - default headers work for most use cases
7. When working with CSV or XML APIs, use custom Content-Type headers as needed
8. Disable response metrics in Options if you don't need them to improve performance
