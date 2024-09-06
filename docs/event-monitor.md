# Event Monitor Page

## Overview
The Event Monitor page allows users to subscribe to and display Salesforce Platform Events in real-time. It supports both Standard and Custom Platform Events. The page uses the CometD library to connect to Salesforce and stream events directly to the user's browser.

![image](https://github.com/user-attachments/assets/3194c752-01ef-4ecf-9ce3-d4d06c3eeb1c)


## Key Features
- **Subscribe to Platform Events:** Users can select a channel (Standard or Custom Platform Events) and subscribe to it to receive live updates.
- **View Events:** Events are displayed in a structured format, allowing users to monitor event data as it arrives.
- **Replay Events:** Users can specify a `Replay From` value to replay past events from a specific point in time.
- **Copy Event Data:** Users can copy the event data in JSON format for further analysis or troubleshooting.

## Replay From Parameter Warning
The `Replay From` parameter is a powerful feature that allows users to replay past events by specifying an event replay ID. However, it must be used with **great caution** in production environments.

### **Warning**
- Setting the `Replay From` parameter to `-2` (to replay all events) can quickly consume your daily limit of platform events.
- **Exceeding this limit can disrupt existing integrations and cause significant issues in a production environment.**
- Always consider the implications of replaying a large number of events, especially in a production setting.

## Usage Instructions
1. **Select Channel Type:** Choose between Standard or Custom Platform Events.
2. **Select Channel:** Pick the specific event channel you want to monitor.
3. **Set Replay From (Optional):** Define the starting point for replaying events. Use the default value `-1` to receive only new events.
4. **Subscribe:** Click the "Subscribe" button to start monitoring the selected channel.
5. **Unsubscribe:** Click the "Unsubscribe" button to stop monitoring.

## Production Considerations
If you are monitoring events in a production environment, the interface will highlight the potential risks, especially when using the replay functionality. Be cautious and ensure you fully understand the impact of subscribing to large volumes of events.

---

**Note:** Always test the functionality in a sandbox environment before deploying it to production to avoid unintended consequences.
