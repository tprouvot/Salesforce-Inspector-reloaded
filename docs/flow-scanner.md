# Flow Scanner User Guide

The **Flow Scanner** is a powerful tool built into Salesforce Inspector Reloaded that helps you analyze Salesforce Flows for best practices, errors, and potential issues. This guide explains how to use the Flow Scanner, what to expect, and how to get the most out of your flow analysis.

---

## What is the Flow Scanner?

The Flow Scanner automatically reviews your Salesforce Flows and checks them against a set of rules and best practices. It helps you:
- Identify errors, warnings, and improvement opportunities in your flows
- Understand where issues are located and what they mean
- Export scan results for documentation or sharing

**Built on Lightning Flow Scanner Core**

The Flow Scanner in Salesforce Inspector Reloaded is powered by the [Lightning Flow Scanner Core](https://github.com/Lightning-Flow-Scanner/lightning-flow-scanner-core), an open-source rule engine capable of conducting static analysis on Salesforce Lightning Flows, Process Builders, and Workflows. This core library provides the comprehensive rule definitions and scanning capabilities that make the Flow Scanner so powerful.

---

## How to Launch the Flow Scanner

1. **Open Salesforce Inspector Reloaded** in your browser (Chrome or Firefox).
2. Navigate to a Salesforce Flow in your org.
3. Look for the **Flow Scanner** button or option (usually available in the Inspector's UI when viewing a Flow):
![image](https://private-user-images.githubusercontent.com/45099363/471431689-222f22b0-235a-4f23-b346-6e9d6f8b275b.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NTM2OTYzMzYsIm5iZiI6MTc1MzY5NjAzNiwicGF0aCI6Ii80NTA5OTM2My80NzE0MzE2ODktMjIyZjIyYjAtMjM1YS00ZjIzLWIzNDYtNmU5ZDZmOGIyNzViLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA3MjglMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNzI4VDA5NDcxNlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTI2YmIyMzJhMzlkNzMyOWVmMzU2ZWQxMWIxZmRjZDEyYjE3NTQ3ODUyZmMxYmQyZTUwM2E5MDA1MzI4N2Y2MjImWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.aK2T9KaD2xNhUnex_FH84N5zWy0n3kCANJ0H1a8CXI4)

4. Click the **Flow Scanner** button to open the scanner overlay.

---

## What Does the Flow Scanner Analyze?

- **Flow Metadata:** The scanner fetches the flow's structure, elements, and configuration directly from Salesforce.
- **Best Practice Rules:** It checks your flow against a set of rules (e.g., naming conventions, API version, complexity, missing fault paths, etc.).
- **Customizable Checks:** You can enable or disable specific rules in the Inspector's Options page under the Flow Scanner tab.

---

## Understanding the Scan Results

After scanning, you'll see a results panel with:

- **Summary Statistics:**
  - Total issues found
  - Number of errors, warnings, and informational messages
- **Detailed Results:**
  - Issues grouped by severity (Error, Warning, Info)
  - Each rule violation is listed with details about the affected flow element
  - Click on a rule or severity group to expand/collapse details

**Severity Levels:**
- **Error:** Critical issues that should be fixed
- **Warning:** Potential problems or risky patterns
- **Info:** Recommendations or minor suggestions

Exemple of a scan result:
![image](https://private-user-images.githubusercontent.com/45099363/471435393-0a1879e1-ee4f-489b-970c-785fe8ed083f.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NTM2OTY2NTEsIm5iZiI6MTc1MzY5NjM1MSwicGF0aCI6Ii80NTA5OTM2My80NzE0MzUzOTMtMGExODc5ZTEtZWU0Zi00ODliLTk3MGMtNzg1ZmU4ZWQwODNmLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA3MjglMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNzI4VDA5NTIzMVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTIzOGMyNTI5NWZiNGEzYjA2YjBkOGJiM2I0OWUyY2VjMjZlNjQ0M2Q0NzkxMWE0ZTdiODIyODA5NTZjNTlmZjImWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.9oBlTJx8bJEigd0L1-PB0Fknp8L-G_DEME96sIAR0ps)

**No Issues?**
- If your flow passes all checks, you'll see a success message: "No Issues Found. Great job!"

---

## Exporting Scan Results

You can export the scan results as a CSV file for documentation or sharing:

1. Click the **Export** button in the results summary panel.
2. The CSV file will be downloaded automatically, named with your flow's name and the current date.
3. Open the CSV in Excel, Google Sheets, or any spreadsheet tool to review or share the findings.

---

## Customizing Rules

- Go to the **Options** page of Salesforce Inspector Reloaded.
- Select the **Flow Scanner** tab.
- Enable or disable rules as needed, or adjust rule settings (like API version threshold or naming patterns).
- Re-run the scan for updated results.

Option page:
![image](https://private-user-images.githubusercontent.com/45099363/471432388-24e2b297-7d8f-4db8-b0dd-353fcd742e5f.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NTM2OTY2NTEsIm5iZiI6MTc1MzY5NjM1MSwicGF0aCI6Ii80NTA5OTM2My80NzE0MzIzODgtMjRlMmIyOTctN2Q4Zi00ZGI4LWIwZGQtMzUzZmNkNzQyZTVmLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTA3MjglMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUwNzI4VDA5NTIzMVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWZmODczODE5MzgxYjUwOTE2NjZhZWEyYzM5YzdhYWRmMTVjNjRmY2E2ODdkMjY2ZDQ4YmMwZGVlODRmNTA1MWYmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.LxvZEr6_WUdDbvD6vM0pIyHSJg4OxpEivmVLEiMEt3Q)


---

## Accessibility & Shortcuts

- **Keyboard Navigation:**
  - Use <kbd>Tab</kbd> to move between buttons and sections
  - Press <kbd>Enter</kbd> or <kbd>Space</kbd> to expand/collapse result groups

---

## Troubleshooting

- **No Rules Enabled:** If you see a message about no rules being enabled, open the Options page and enable at least one rule.
- **Initialization Error:** If the scanner fails to load, check your network connection and ensure you're logged into Salesforce.
- **Unsupported Flow Type:** Some flow types may not be supported. The scanner will list which types are supported if this occurs.
- **Still Stuck?** Check the browser console for errors or reach out to the extension's support channels.

---

## Tips & Best Practices

- Regularly scan your flows to catch issues early.
- Review errors and warnings before deploying flows to production.
- Use the export feature to document compliance or share findings with your team.
- Keep the extension updated for the latest rules and improvements.
