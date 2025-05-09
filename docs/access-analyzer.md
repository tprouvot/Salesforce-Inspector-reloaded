# Access Analyzer

## Overview
The Access Analyzer page provides a comprehensive view of field-level access across different Salesforce components. It helps administrators and developers understand how a specific field is configured in terms of permissions, layouts, and Lightning pages. This tool is particularly useful for troubleshooting access issues and auditing field-level security settings.

## Key Features
- **Field Access Analysis:** Analyze field-level access across multiple Salesforce components
- **Profile Permissions:** View field-level security settings from the user's profile
- **Permission Set Access:** See field permissions granted through assigned permission sets
- **Layout Behavior:** Check how the field is configured in page layouts
- **Lightning Page Configuration:** Review field behavior in Lightning pages and their assignments

## Getting Started

1. Open the Access Analyzer through the pop-up menu
2. Select the object containing the field you want to analyze
3. Choose the specific field to analyze
4. Click "Analyze" to start the analysis

## Analysis Results

The analysis provides a comprehensive view across four main areas:

### Profile Access
- Shows the field-level security settings from the user's profile
- Displays whether the field is Read/Write, Read Only, or No Access

### Permission Sets
- Lists all permission sets assigned to the user that affect the field
- Shows the access level granted through each permission set

### Layout Assignment
- Displays all page layouts where the field is configured
- Shows the field behavior (Required, Read-Only, etc.) in each layout
- Indicates record type assignments for each layout

### Lightning Pages
- Lists all Lightning pages containing the field
- Shows the field's behavior in each page component
- Displays page assignments to apps and record types
- Indicates visibility rules affecting the field

## Usage Instructions

1. **Select Object:** Choose the object containing the field you want to analyze
2. **Select Field:** Pick the specific field to analyze
3. **Select User:** Choose the user whose access you want to analyze
4. **Analyze:** Click the "Analyze" button to start the analysis
5. **Review Results:** Examine the comprehensive access analysis across all components

## Best Practices

- Use this tool to audit field-level security settings
- Verify field behavior across different user interfaces
- Troubleshoot access issues by checking all permission sources
- Review Lightning page assignments to ensure proper field visibility

## Production Considerations

When analyzing field access in a production environment:
- Be aware of the impact of multiple permission sources
- Consider the hierarchy of access (Profile → Permission Sets → Layouts → Lightning Pages)
- Review all assignments to ensure proper field visibility
- Check for any conflicting settings across different components

---

**Note:** Always test field access changes in a sandbox environment before implementing them in production to avoid unintended access issues.