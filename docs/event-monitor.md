# Event Monitor Page

## Overview
The Event Monitor page allows users to subscribe to and display Salesforce Platform Events in real-time. It supports Custom Channel, Standard and Custom Platform Events. The page uses the CometD library to connect to Salesforce and stream events directly to the user's browser.

![image](https://github.com/user-attachments/assets/e24e10cf-2b6c-4d04-ad6e-3377c833ef1d)


## Key Features
- **Subscribe to Platform Events:** Users can select a channel (Standard or Custom Platform Events) and subscribe to it to receive live updates.
- **View Events:** Events are displayed in a structured format, allowing users to monitor event data as it arrives.
- **Replay Events:** Users can specify a `Replay From` value to replay past events from a specific point in time.
- **Copy Event Data:** Users can copy the event data in JSON format for further analysis or troubleshooting.

## Subscribe to an Event from the Popup
You can also directly access to the Event Monitor page and pre-select the Event from the popup by click the `Subscribe to Event` button.

<img width="278" alt="Subscribe from popup" src="https://github.com/user-attachments/assets/a087944d-df38-4e38-a05f-dcdd3bf57b28">

## Replay From Parameter Warning
The `Replay From` parameter is a powerful feature that allows users to replay past events by specifying an event replay ID. However, it must be used with **great caution** in production environments.

## Display Platform Event Allocations and pre-build queries on PlatformEventUsageMetric

<img width="1442" alt="Platform Event Allocations" src="https://github.com/user-attachments/assets/df2c5aa4-a432-4646-a450-d7a64efaae0e" />

If you are facing the error: No such column 'EventName' on entity 'PlatformEventUsageMetric', please check related [documentation](https://developer.salesforce.com/docs/atlas.en-us.244.0.api_meta.meta/api_meta/meta_platformeventsettings.htm) to enable it.

### **Warning**
- Setting the `Replay From` parameter to `-2` (to replay all events) can quickly consume your daily limit of platform events.
- **Exceeding this limit can disrupt existing integrations and cause significant issues in a production environment.**
- Always consider the implications of replaying a large number of events, especially in a production setting.

## Usage Instructions
1. **Select Channel Type:** Choose between Custom Channel, Standard or Custom Platform Events.
2. **Select Channel:** Pick the specific event channel you want to monitor.
3. **Set Replay From (Optional):** Define the starting point for replaying events. Use the default value `-1` to receive only new events.
4. **Subscribe:** Click the "Subscribe" button to start monitoring the selected channel.
5. **Unsubscribe:** Click the "Unsubscribe" button to stop monitoring.

## Production Considerations
If you are monitoring events in a production environment, the interface will highlight the potential risks, especially when using the replay functionality. Be cautious and ensure you fully understand the impact of subscribing to large volumes of events.

---

**Note:** Always test the functionality in a sandbox environment before deploying it to production to avoid unintended consequences.
