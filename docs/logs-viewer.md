# 📋 Debug Logs Viewer

The **Debug Logs Viewer** is a powerful tool that allows you to view, filter, analyze, and manage Salesforce debug logs directly from the extension. With advanced features like AI-powered analysis, grep-like filtering, and smart pagination, it transforms the debug log experience into a productive workflow.

---

## 🚀 Getting Started

### Opening the Logs Viewer

1. Open the **Salesforce Inspector Reloaded** popup
2. Click on the **"Logs"** button in the Org tab
3. Or navigate directly to the Debug Logs page from any Salesforce org

The Logs Viewer will automatically load your most recent debug logs.

---

## ✨ Key Features

### 1. 📊 Smart Pagination & Navigation

![Pagination](screenshots/logs-pagination.png)

- **Flexible page sizes**: Choose between 10, 15, 25, 50, or 100 logs per page
- **Exact total count**: See exactly how many logs match your filters (e.g., "Logs 25 of 142")
- **Persistent preferences**: Your page size selection is saved across sessions
- **Quick navigation**: Previous/Next buttons with smart enabling/disabling
- **Lazy loading**: Logs are fetched on-demand for optimal performance

**How to use:**
- Select your preferred page size from the dropdown in the header
- Use Previous/Next buttons to navigate through pages
- The counter shows your current position (e.g., "Page 3")

---

### 2. 🔍 Advanced Filtering

#### Filter by User
- **Org-wide user list**: Picklist populated with ALL users who have generated logs in your org
- **Stable list**: The user filter never shrinks based on current page results
- **Fast search**: Quickly find logs from specific users

#### Filter by Date Range
- **From date/time**: Set a start date and time for your search
- **To date/time**: Set an end date and time for your search
- **Datetime-local input**: Native browser date picker for easy selection

#### Apply & Reset
- **Apply button**: Execute your filter criteria
- **Reset button**: Clear all filters and return to default view

**Example filters:**
```
User: John Smith
From: 2024-12-29 09:00
To: 2024-12-29 17:00
```

---

### 3. 📝 Enhanced Log Information

Each log entry displays:

#### User Column
- **User name** (resolved from UserId)
- Auto-populated from org-wide user queries
- Cached for performance

#### Action Column (Smart Parsing)
The extension intelligently extracts and formats the log action:

##### Apex Classes
```
MyApexClass · handleRequest
```

##### Triggers with Events
```
Trigger · AccountTrigger (BeforeUpdate)
```

##### LWC/Aura Actions
```
LWC · MyComponent → handleClick
```

##### VFRemote Calls
```
VFRemote: MyController invoke(myMethod)
```

##### Execute Anonymous
```
Execute Anonymous
```

##### Flows
```
Flow · My_Auto_Flow
```

#### Start Time
- Formatted local datetime
- Sortable by timestamp

#### Status
- Execution status from Salesforce
- Shows success, errors, or specific status codes

#### Size
- Log file size in KB
- Helps identify large logs that may be truncated

---

### 4. 🎬 Bulk Actions

#### Select Logs
- **Individual checkboxes**: Select specific logs
- **Select all checkbox**: Quickly select all logs on current page
- **Visual feedback**: Selected count displayed on Delete button

#### Delete Selected
- **Bulk delete**: Remove multiple logs at once
- **Confirmation dialog**: Prevents accidental deletions
- **Real-time refresh**: Log list updates immediately after deletion

**How to delete:**
1. Check the logs you want to delete
2. Click **"Delete Selected"** button
3. Confirm the action
4. Logs are deleted and the list refreshes

---

### 5. 🔎 Log Preview with Advanced Features

Click the **Preview** button on any log to open the preview modal:

![Log Preview](screenshots/logs-preview.png)

#### Search in Log (Ctrl/⌘+F)
- **Keyboard shortcut**: Press Ctrl+F (or ⌘+F on Mac) to focus search input
- **Real-time highlighting**: Matches are highlighted as you type
- **Navigation arrows**: Previous/Next buttons to jump between matches
- **Match counter**: Shows current match position (e.g., "3 / 15")
- **Enter key**: Press Enter to go to next match
- **Shift+Enter**: Go to previous match

#### Grep-like Filtering
Transform your log view with powerful filtering:

**Filter Templates:**
- **No filter**: Show all log lines
- **USER_DEBUG**: Show only USER_DEBUG statements
- **Exceptions**: Show EXCEPTION_THROWN and FATAL_ERROR lines
- **DML Operations**: Show DML_BEGIN and DML_END
- **Limits**: Show LIMIT_USAGE and CUMULATIVE_LIMIT_USAGE
- **Callouts**: Show CALLOUT_REQUEST and CALLOUT_RESPONSE
- **Flow**: Show Flow execution lines
- **Validation Rules**: Show validation-related lines
- **USER_DEBUG + Exceptions**: Combined view

**Custom Filter:**
- Type your own filter pattern
- Use `|` (pipe) for OR logic
- Example: `USER_DEBUG|EXCEPTION_THROWN|SOQL_EXECUTE_BEGIN`

#### Syntax Highlighting
- **Prism.js integration**: Beautiful code highlighting
- **Log-specific colors**: Different colors for different log event types
- **Readable formatting**: Improved line spacing and font

#### Large File Handling
- **Auto-detection**: Identifies files >1.5MB
- **Warning banner**: Alerts user about large files
- **Safe rendering**: Disables syntax highlighting for very large files to prevent browser crashes
- **Still searchable**: Search and filtering work even on large files

#### Download Log
- **One-click download**: Save the log file to your computer
- **Proper filename**: Named with log ID (e.g., `07L5g000006ABCD.log`)

---

### 6. 🤖 AI-Powered Analysis (Agentforce Integration)

![AI Analysis](screenshots/logs-ai-analysis.png)

Transform your debugging experience with AI-powered log analysis!

#### Comprehensive Analysis Sections

When you click **"Analyze with AI"**, the system performs a deep analysis covering:

1. **EXECUTIVE SUMMARY**
   - Main action or transaction executed
   - Trigger source (user action, scheduled job, API call, etc.)
   - Success/failure status
   - Overall execution time and performance

2. **EXECUTION FLOW**
   - Chronological execution steps
   - Classes, methods, and triggers invoked
   - Call stack and execution path
   - Decision points and branches

3. **DATA OPERATIONS**
   - SOQL queries with row counts and execution time
   - DML operations (inserts, updates, deletes)
   - Records affected
   - Bulk operations detection

4. **ERRORS & EXCEPTIONS**
   - All errors and exceptions identified
   - Error messages with line numbers
   - Root cause analysis
   - Stack trace breakdown

5. **PERFORMANCE ANALYSIS**
   - Total execution time
   - Slow queries (>100ms) highlighted
   - CPU time consumption
   - Database vs CPU time ratio
   - Governor limit warnings

6. **GOVERNOR LIMITS USAGE**
   - SOQL queries used vs limit
   - DML statements used vs limit
   - Heap size used vs limit
   - CPU time used vs limit
   - Limits near threshold (>70%)

7. **BEST PRACTICES & RECOMMENDATIONS**
   - Code optimization suggestions
   - Performance improvements
   - Bulkification issues
   - Security concerns
   - Specific fixes recommended

8. **DEBUG STATEMENTS**
   - All USER_DEBUG statements listed
   - Variable values and state changes
   - Debug information highlighted

#### Customizable AI Instructions ✨

**NEW FEATURE**: Customize the AI analysis instructions to focus on what matters to you!

![Custom Instructions](screenshots/logs-ai-custom-instructions.png)

**Features:**
- **Edit Mode**: Click "Edit" button to modify instructions
- **Live editing**: Changes are saved automatically
- **Per-org storage**: Each Salesforce org can have its own custom instructions
- **Customized badge**: Visual indicator when using custom instructions
- **Reset option**: One-click reset to default instructions
- **Template preservation**: Original comprehensive analysis template always available

**How to customize:**
1. Click **"Analyze with AI"** to open the modal
2. Click the **"Edit"** button
3. Modify the instructions in the textarea
4. Changes are automatically saved to localStorage
5. Click **"Analyze"** to run analysis with your custom instructions
6. Click **"Reset"** (if visible) to restore defaults

**Example custom instructions:**
```
Focus on:
1. Performance bottlenecks only
2. SOQL queries that return more than 100 records
3. Any governor limits exceeding 50%
4. Suggestions for query optimization

Skip:
- Debug statements
- Successful operations
```

#### Analysis Results

- **Formatted output**: Clean, readable analysis with proper sections
- **Copy to clipboard**: One-click copy of entire analysis
- **Scrollable view**: Full analysis displayed in modal
- **Re-analyze**: Run analysis again with different filters or instructions
- **Error handling**: Clear error messages if analysis fails

#### Using Filtered Logs with AI

💡 **Pro Tip**: Apply a grep filter before analyzing!

```
1. Open log preview
2. Select a filter template (e.g., "USER_DEBUG + Exceptions")
3. Click "Analyze with AI"
4. AI analyzes only the filtered content
```

This helps focus AI analysis on specific aspects of your log.

---

### 7. 🔗 Quick Actions

Each log row provides instant actions:

#### Preview Button
- Opens the log in preview modal
- Access to search, filter, and AI analysis

#### Download Button
- Saves log file to your computer
- Named with log ID for easy identification

#### Share Button
- Generates a unique URL for the log
- Copies URL to clipboard
- Share with team members for collaboration
- **Note**: Recipient needs appropriate Salesforce access

#### Delete Button
- Deletes individual log
- Confirmation dialog for safety
- Immediate refresh after deletion

---

## 💡 Pro Tips & Best Practices

### Efficient Debugging Workflow

1. **Start with filters**: Narrow down to the relevant time window and user
2. **Use page size wisely**: 
   - Use 10-15 for quick scanning
   - Use 50-100 when searching for specific logs
3. **Smart action labels**: Look for specific patterns in the Action column
   - Triggers show event types (BeforeUpdate, AfterInsert)
   - LWC/Aura actions show component and method names
4. **Preview before downloading**: Use preview to confirm it's the right log
5. **Apply grep filters**: Use templates to quickly find relevant log lines
6. **Search efficiently**: Use Ctrl+F to find specific text within a log
7. **AI analysis**: Let AI do the heavy lifting for complex logs
8. **Customize AI instructions**: Tailor analysis to your debugging needs

### Performance Optimization

- **Pagination**: Logs are lazy-loaded to keep the UI responsive
- **User cache**: User names are cached to minimize API calls
- **Action parsing**: Actions are parsed on-demand with caching
- **Large file handling**: Automatic detection and optimization

### Keyboard Shortcuts

- **Ctrl+F** (or ⌘+F): Focus search in preview modal
- **Enter**: Next search match
- **Shift+Enter**: Previous search match
- **Escape**: Close preview modal

### Filtering Strategies

#### Find Today's Errors
```
From: 2024-12-29 00:00
To: 2024-12-29 23:59
Grep Filter: EXCEPTION_THROWN|FATAL_ERROR
```

#### Debug Specific User Issues
```
User: John Smith
From: [start of issue]
To: [end of issue]
```

#### Performance Analysis
```
Grep Filter: LIMIT_USAGE|CUMULATIVE_LIMIT_USAGE
AI Analysis: Focus on governor limits and performance
```

#### Flow Debugging
```
Grep Filter: FLOW_CREATE_INTERVIEW|FLOW_START|FLOW_ELEMENT
```

---

## 🎯 Use Cases

### 1. Production Issue Investigation
**Scenario**: Users report errors in production

**Steps:**
1. Filter by affected user and time range
2. Preview logs showing errors
3. Use "Exceptions" grep filter
4. Run AI analysis for root cause
5. Share log URL with dev team

### 2. Performance Tuning
**Scenario**: Slow page loads reported

**Steps:**
1. Filter by time range of slow loads
2. Use "Limits" grep filter to find bottlenecks
3. Search for "SOQL_EXECUTE_BEGIN" to find queries
4. AI analysis for optimization suggestions
5. Download logs for detailed review

### 3. Flow Debugging
**Scenario**: Flow not behaving as expected

**Steps:**
1. Filter by user testing the flow
2. Use "Flow" grep filter template
3. Search for specific flow name
4. Review execution path line by line
5. AI analysis for flow logic issues

### 4. Integration Troubleshooting
**Scenario**: External API calls failing

**Steps:**
1. Use "Callouts" grep filter
2. Search for "CALLOUT_REQUEST"
3. Review request/response pairs
4. AI analysis for integration issues
5. Share findings with integration team

---

## 🔧 Technical Details

### Architecture

- **React-based UI**: Modern, responsive interface
- **Salesforce Tooling API**: Queries ApexLog objects
- **Lazy loading**: Fetches logs on-demand
- **Local storage**: Persists user preferences per org
- **Prism.js**: Syntax highlighting for logs
- **Agentforce API**: AI-powered analysis

### Data Sources

- **ApexLog**: Debug log records
- **User**: User name resolution
- **Tooling API**: Log body retrieval
- **Prompt Templates**: AI analysis instructions

### Performance Optimizations

- **Pagination**: Reduces initial load time
- **Caching**: User names and action summaries cached
- **On-demand parsing**: Actions parsed only when visible
- **Blob handling**: Large logs handled as blobs
- **Debounced search**: Smooth typing experience

### Storage Keys

Per-org localStorage keys:
- `{sfHost}_debugLogCustomInstructions`: Custom AI instructions
- `sfir.debugLog.pageSize`: Preferred page size

---

## 🎨 UI Components

### Header
- Org name badge
- Total log count
- Page size selector
- Refresh button
- Delete Selected button

### Filters Section
- User picklist
- From datetime input
- To datetime input
- Apply/Reset buttons

### Logs Table
- Checkbox column for selection
- User column with names
- Action column with smart parsing
- Start time column
- Status column
- Size column
- Actions column (Preview, Download, Share, Delete)

### Preview Modal
- Filter template selector
- Custom filter input
- Search input with navigation
- AI Analyze button
- Log content with syntax highlighting
- Download and Close buttons

### AI Analysis Modal
- Instructions view/edit toggle
- Customized badge
- Edit/Reset buttons
- Textarea for custom instructions
- Analysis results display
- Copy to clipboard button
- Loading spinner during analysis

---

## 📚 Related Documentation

- [Data Export](data-export.md): Export and query data
- [REST Explorer](rest-explorer.md): Test Salesforce APIs
- [Event Monitor](event-monitor.md): Subscribe to platform events
- [How-To Guide](how-to.md): General extension usage

---

## 🐛 Troubleshooting

### Logs not loading
- Check your user permissions for viewing debug logs
- Verify org access and authentication
- Try refreshing the page

### AI analysis failing
- Ensure Agentforce is properly configured in your org
- Check that prompt templates are available
- Verify log size is under 50K characters (automatically limited)

### Large logs slow to render
- Syntax highlighting is automatically disabled for files >1.5MB
- Use grep filtering to reduce visible content
- Download the log for external viewing

### Custom instructions not saving
- Check browser localStorage is enabled
- Verify you're on a stable network connection
- Try resetting to defaults and re-applying

---

## 🎉 Credits

The Debug Logs Viewer was developed by [Samuel Krissi](https://github.com/samuelkrissi) as part of the [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded) project.

Special thanks to the Salesforce developer community for feedback and feature requests!

---

## 🚀 Future Enhancements

Planned features for future releases:

- [ ] Export logs to JSON/CSV format
- [ ] Batch download multiple logs
- [ ] Log comparison (diff view)
- [ ] Save filter presets
- [ ] Auto-refresh with polling
- [ ] Advanced regex filtering
- [ ] Log annotations and bookmarks
- [ ] Team collaboration features
- [ ] Integration with CI/CD pipelines

Have a feature request? [Open an issue](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues) on GitHub!

---

**Happy Debugging!** 🐛🔍✨
