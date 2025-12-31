# Debug Logs Viewer

## Overview

The Debug Logs Viewer allows you to view, filter, analyze, and manage Salesforce debug logs directly from the extension. With advanced features like Agentforce-powered analysis, grep-like filtering, and smart pagination, it transforms the debug log experience into a productive workflow.

<img width="1437" height="827" alt="Logs Viewer" src="https://github.com/user-attachments/assets/2b916cb5-8ca8-4ebf-9d92-880b12d97d25" />

## Key Features

### Pagination & Navigation

- **Flexible page sizes**: Choose between 10, 15, 25, 50, or 100 logs per page
- **Exact total count**: See exactly how many logs match your filters (e.g., "Logs 25 of 142")
- **Persistent preferences**: Your page size selection is saved across sessions
- **Quick navigation**: Previous/Next buttons with smart enabling/disabling
- **Lazy loading**: Logs are fetched on-demand for optimal performance

### Advanced Filtering

- **Filter by User**: Picklist populated with all users who have generated logs in your org
- **Filter by Date Range**: Set start and end date/time using native browser date picker
- **Apply & Reset**: Execute filter criteria or clear all filters to return to default view

Example filters:

```text
User: John Smith
From: 2024-12-29 09:00
To: 2024-12-29 17:00
```

### Enhanced Log Information

Each log entry displays:

- **User name**: Resolved from UserId, auto-populated from org-wide user queries
- **Action**: Intelligently extracted and formatted log action:
  - Apex Classes: `MyApexClass · handleRequest`
  - Triggers: `Trigger · AccountTrigger (BeforeUpdate)`
  - LWC/Aura Actions: `LWC · MyComponent → handleClick`
  - VFRemote Calls: `VFRemote: MyController invoke(myMethod)`
  - Execute Anonymous: `Execute Anonymous`
  - Flows: `Flow · My_Auto_Flow`
  - **Note**: Detailed action information requires fetching log bodies (enabled by default)
- **Start Time**: Formatted local datetime, sortable by timestamp
- **Status**: Execution status from Salesforce
- **Size**: Log file size in KB

### Fetch Log Bodies & Search

- **Fetch Bodies Toggle**: Control whether log bodies are fetched to derive detailed action information
  - **Enabled** (default): Fetches log bodies for detailed action parsing and enables search functionality
  - **Disabled**: Reduces API calls and improves performance, but action details will be less specific
- **Search in Logs**: When fetch bodies is enabled, use the search input in the header to search across all loaded log bodies
  - Real-time filtering as you type
  - Searches within log content, not just metadata

### Bulk Actions

- **Select Logs**: Individual checkboxes or select all checkbox for current page
- **Delete Selected**: Bulk delete multiple logs with confirmation dialog
- **Real-time refresh**: Log list updates immediately after deletion

### Log Preview

Click the **Preview** button on any log to open the preview modal:

<img width="1281" height="652" alt="Log Preview" src="https://github.com/user-attachments/assets/5714396c-1a45-4293-ae51-df5893294a7c" />

#### Search in Log

- **Keyboard shortcut**: Press Ctrl+F (or ⌘+F on Mac) to focus search input
- **Real-time highlighting**: Matches are highlighted as you type
- **Navigation arrows**: Previous/Next buttons to jump between matches
- **Match counter**: Shows current match position (e.g., "3 / 15")
- **Enter key**: Press Enter to go to next match, Shift+Enter for previous match

#### Grep-like Filtering

Filter templates available:

- **No filter**: Show all log lines
- **USER_DEBUG**: Show only USER_DEBUG statements
- **Exceptions**: Show EXCEPTION_THROWN and FATAL_ERROR lines
- **DML Operations**: Show DML_BEGIN and DML_END
- **Limits**: Show LIMIT_USAGE and CUMULATIVE_LIMIT_USAGE
- **Callouts**: Show CALLOUT_REQUEST and CALLOUT_RESPONSE
- **Flow**: Show Flow execution lines
- **Validation Rules**: Show validation-related lines
- **USER_DEBUG + Exceptions**: Combined view

**Custom Filter**: Type your own filter pattern using `|` (pipe) for OR logic.

Example: `USER_DEBUG|EXCEPTION_THROWN|SOQL_EXECUTE_BEGIN`

#### Syntax Highlighting

- **Prism.js integration**: Code highlighting with log-specific colors
- **Large file handling**: Auto-detection for files >1.5MB, disables syntax highlighting for very large files to prevent browser crashes
- **Still searchable**: Search and filtering work even on large files

#### Download Log

- **One-click download**: Save the log file to your computer
- **Proper filename**: Named with log ID (e.g., `07L5g000006ABCD.log`)

### Agentforce-Powered Analysis

Transform your debugging experience with Agentforce-powered log analysis.

<img width="1262" height="656" alt="Log Analysis" src="https://github.com/user-attachments/assets/e5b3aa35-15bc-4611-91ed-ce7bbb550f70" />

When you click **"Analyze with Agentforce"**, the system performs a deep analysis covering:

1. **Executive Summary**: Main action or transaction executed, trigger source, success/failure status, overall execution time
2. **Execution Flow**: Chronological execution steps, classes, methods, and triggers invoked
3. **Data Operations**: SOQL queries with row counts, DML operations, records affected
4. **Errors & Exceptions**: All errors identified with error messages, root cause analysis, stack trace breakdown
5. **Performance Analysis**: Total execution time, slow queries (>100ms), CPU time consumption, governor limit warnings
6. **Governor Limits Usage**: SOQL queries, DML statements, heap size, CPU time used vs limits
7. **Best Practices & Recommendations**: Code optimization suggestions, performance improvements, bulkification issues
8. **Debug Statements**: All USER_DEBUG statements listed with variable values

#### Customizable Agentforce Instructions

Customize the Agentforce analysis instructions to focus on what matters to you:

<img width="1272" height="395" alt="Customized Log Analysis" src="https://github.com/user-attachments/assets/114c96e8-43b3-41dc-99cc-b7032e046e76" />

**Features:**

- **Edit Mode**: Click "Edit" button to modify instructions
- **Live editing**: Changes are saved automatically
- **Per-org storage**: Each Salesforce org can have its own custom instructions
- **Customized badge**: Visual indicator when using custom instructions
- **Reset option**: One-click reset to default instructions

**How to customize:**

1. Click **"Analyze with Agentforce"** to open the modal
2. Click the **"Edit"** button
3. Modify the instructions in the textarea
4. Changes are automatically saved to localStorage
5. Click **"Analyze"** to run analysis with your custom instructions
6. Click **"Reset"** (if visible) to restore defaults

**Example custom instructions:**

```text
Focus on:
1. Performance bottlenecks only
2. SOQL queries that return more than 100 records
3. Any governor limits exceeding 50%
4. Suggestions for query optimization

Skip:
- Debug statements
- Successful operations
```

#### Using Filtered Logs with Agentforce

Apply a grep filter before analyzing to focus Agentforce analysis on specific aspects of your log:

1. Open log preview
2. Select a filter template (e.g., "USER_DEBUG + Exceptions")
3. Click "Analyze with Agentforce"
4. Agentforce analyzes only the filtered content

### Quick Actions

Each log row provides instant actions:

- **Preview**: Opens the log in preview modal with access to search, filter, and Agentforce analysis
- **Download**: Saves log file to your computer, named with log ID
- **Share**: Generates a unique URL for the log, copies URL to clipboard (recipient needs appropriate Salesforce access)
- **Delete**: Deletes individual log with confirmation dialog and immediate refresh

## Usage Instructions

1. **Open the Logs Viewer**: Click on the **"Logs"** button in the Org tab of the Salesforce Inspector Reloaded popup, or navigate directly to the Debug Logs page from any Salesforce org

2. **Configure Fetch Bodies** (optional): Toggle the "Fetch Bodies" switch in the header to enable/disable fetching log bodies for detailed action information

3. **Search in Logs** (when fetch bodies enabled): Use the search input in the header to search across all loaded log bodies

4. **Filter Logs**: Use the user picklist and date range filters to narrow down results

5. **Select Page Size**: Choose your preferred page size from the dropdown (10, 15, 25, 50, or 100 logs per page)

6. **Preview Logs**: Click the Preview button on any log to view its contents

7. **Search in Log Preview**: Press Ctrl+F (or ⌘+F) to search within a log preview

8. **Apply Filters**: Use grep filter templates or create custom filters to focus on specific log lines

9. **Analyze with Agentforce**: Click "Analyze with Agentforce" for comprehensive log analysis

10. **Bulk Delete**: Select multiple logs using checkboxes and click "Delete Selected"

## Best Practices

1. **Start with filters**: Narrow down to the relevant time window and user before analyzing

2. **Use page size wisely**: Use 10-15 for quick scanning, 50-100 when searching for specific logs

3. **Preview before downloading**: Use preview to confirm it's the right log

4. **Apply grep filters**: Use templates to quickly find relevant log lines

5. **Search efficiently**: Use Ctrl+F to find specific text within a log

6. **Agentforce analysis**: Let Agentforce do the heavy lifting for complex logs

7. **Customize Agentforce instructions**: Tailor analysis to your debugging needs

8. **Filter before Agentforce analysis**: Apply grep filters to focus Agentforce on specific aspects

### Keyboard Shortcuts

- **Ctrl+F** (or ⌘+F): Focus search in preview modal
- **Enter**: Next search match
- **Shift+Enter**: Previous search match
- **Escape**: Close preview modal

### Filtering Strategies

**Find Today's Errors:**

```text
From: 2024-12-29 00:00
To: 2024-12-29 23:59
Grep Filter: EXCEPTION_THROWN|FATAL_ERROR
```

**Debug Specific User Issues:**

```text
User: John Smith
From: [start of issue]
To: [end of issue]
```

**Performance Analysis:**

```text
Grep Filter: LIMIT_USAGE|CUMULATIVE_LIMIT_USAGE
Agentforce Analysis: Focus on governor limits and performance
```

**Flow Debugging:**

```text
Grep Filter: FLOW_CREATE_INTERVIEW|FLOW_START|FLOW_ELEMENT
```

## Configuration Options

The Logs Viewer can be configured in the extension options:

- **Prompt Template Name**: Configure the developer name of the prompt template to use for Debug Log Analysis (default: `PromptTemplateDebugLog`)
- **Fetch log bodies for action details**: Toggle to enable/disable fetching log bodies to derive detailed action information (default: enabled)
  - When enabled: Provides detailed action parsing but increases API calls
  - When disabled: Reduces API calls and improves performance, but action details will be less specific
- **Show buttons**: Control visibility of action buttons:
  - **Share Logs**: Show/hide the share button (default: visible)
  - **Agentforce**: Show/hide the Agentforce analysis button (default: hidden)

## Troubleshooting

### Action details not showing

- Ensure "Fetch log bodies" is enabled in the header toggle or extension options
- Action details require fetching log bodies, which may increase API calls

### Agentforce analysis failing

- Ensure Agentforce is properly configured in your org
- Check that prompt templates are available
- Verify log size is under 50K characters (automatically limited)
- Ensure the Agentforce button is visible (check extension options)

### Large logs slow to render

- Syntax highlighting is automatically disabled for files >1.5MB
- Use grep filtering to reduce visible content
- Download the log for external viewing
- Consider disabling "Fetch log bodies" if performance is an issue

**Note:** The Debug Logs Viewer was developed by [Samuel Krissi](https://github.com/samuelkrissi).
