# API Statistics

Track and monitor all REST and SOAP API calls made to Salesforce servers. When enabled, this feature helps you understand API usage patterns, identify performance bottlenecks, and troubleshoot integration issues.

<img width="1437" height="828" alt="API Debug Stats" src="https://github.com/user-attachments/assets/d5877bde-caf3-4750-b630-7173499a4a32" />

## Features

- **Automatic Tracking**: Tracks all REST and SOAP API calls when debug mode is enabled
- **Call Metrics**: Total calls, calls by method (GET, POST, etc.), calls by endpoint
- **Performance Data**: Request durations, averages, and response times
- **Error Tracking**: Error counts per method and endpoint
- **URL Simplification**: Groups similar endpoints by removing IDs and query parameters
- **Session Management**: View session duration and reset statistics anytime

## How to Enable

API Statistics tracking is controlled through the Options page:

1. Open the **Options** page from the extension popup
2. Navigate to the **API** tab
3. Enable the **"Enable API Stats Debug Mode"** toggle
4. Once enabled, the extension automatically tracks all REST and SOAP API calls
5. Access the statistics through the API Statistics page
6. Disable the toggle when tracking is no longer needed

## Use Cases

- **Performance Monitoring**: Identify slow endpoints and track response times
- **Error Analysis**: Find high error rate endpoints and troubleshoot integration issues
- **Usage Optimization**: Identify redundant calls and optimize batch operations
- **Development & Testing**: Validate API integrations and debug API-related issues

## Best Practices

- Enable debug mode only when needed to avoid storage overhead
- Reset statistics periodically to keep data relevant
- Monitor error counts regularly to catch integration issues early
- Establish baseline metrics for comparison during troubleshooting

## Privacy & Limitations

- Statistics are stored locally in your browser (localStorage only)
- No data is transmitted to external servers
- Statistics are per browser/profile and reset when cleared
