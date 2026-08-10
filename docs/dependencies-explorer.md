# Dependencies Explorer

## Overview

The Dependencies Explorer page allows users to analyze Salesforce metadata dependencies. It reveals what a metadata item depends on and what references it, helping with impact analysis, migration planning, and understanding complex relationships across your org.

<img width="1437" height="828" alt="Dependencies Explorer" src="https://github.com/user-attachments/assets/0e3838b6-84f2-42e1-9163-6d789a4d4555" />

## Key Features

- **Bidirectional Analysis:** View both "Depends On" (what your metadata requires) and "Referenced By" (what uses your metadata) directions.
- **Multiple View Modes:** Switch between a Quick Summary (deduplicated flat list) and a Dependency Tree (hierarchical parent-child relationships).
- **Package.xml Generation:** Export dependencies as a `package.xml` file for deployment.
- **Text Export:** Generate a detailed summary report with type breakdowns and counts.
- **Salesforce Links:** Navigate directly to metadata items in Salesforce Setup.
- **External Package Filtering:** Option to exclude managed/external package items from the dropdown.
- **JSON Debug View:** Inspect raw dependency data in JSON format.

## Supported Metadata Types

The Dependencies Explorer supports 20 metadata types across several categories:

| Category | Types |
|---|---|
| **Code** | Apex Classes, Apex Triggers |
| **UI (Classic)** | Visualforce Pages, Visualforce Components |
| **UI (Lightning)** | Lightning Components (Aura), Lightning Web Components |
| **Pages & Layouts** | Page Layouts, Lightning Pages (FlexiPage) |
| **Data Model** | Custom Objects, Custom Fields, Global Picklists, Validation Rules |
| **Automation** | Flows, Workflow Alerts (Email Alerts) |
| **Resources** | Static Resources, Email Templates, Custom Labels, Custom Buttons (WebLinks) |

## Usage Instructions

1. **Select a Metadata Type:** Choose the type of metadata you want to analyze (e.g., "Apex Classes").
2. **Select a Metadata Item:** Pick a specific item from the searchable dropdown. Use the checkbox to filter out external/managed packages if needed.
3. **Analyze:** Click the **Analyze Dependencies** button to fetch all dependencies.
4. **Browse Results:** Use the filter badges to switch between **Referenced By** and **Depends On** views.
5. **Change View (Depends On only):** Toggle between **Quick Summary** and **Dependency Tree** views.

## Understanding the Results

### Referenced By

Shows all metadata components that use or rely on the selected item. Results are grouped by the referencing metadata type. This answers: *"What will break if I change this?"*

### Depends On

Shows all metadata components that the selected item requires to function. This answers: *"What does this item need?"*

- **Quick Summary:** A deduplicated, flat list of distinct metadata items grouped by type.
- **Dependency Tree:** A hierarchical view showing full parent-child relationships with expand/collapse controls.

## Export Options

- **Generate Package.xml:** Creates a `package.xml` file from the "Depends On" dependencies, useful for deployment planning. You can optionally include managed package items.
- **Export Summary:** Generates a text file with an executive summary including totals, unique item counts, and a type-by-type breakdown.
- **JSON Debug:** Toggle to view the raw dependency data as syntax-highlighted JSON.

---

**Note:** The Dependencies Explorer uses the Salesforce Tooling API to query metadata dependencies. Results depend on the metadata types and relationships tracked by Salesforce.
