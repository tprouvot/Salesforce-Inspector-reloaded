/* global React ReactDOM */
import {getLinkTarget} from "./utils.js";
import {sfConn, apiVersion} from "./inspector.js";
// Import the CometD library
import {CometD} from "./lib/cometd/cometd.js";
import {copyToClipboard} from "./data-load.js";
import {PageHeader} from "./components/PageHeader.js";

const channelTypes = [
  {value: "standardPlatformEvent", label: "Standard Platform Event", prefix: "/event/"},
  {value: "platformEvent", label: "Custom Platform Event", prefix: "/event/"},
  {value: "customChannel", label: "Custom Channel", prefix: "/event/"},
  {value: "changeEvent", label: "Change Event", prefix: "/data/"},
  {value: "realTimeEvent", label: "Real-Time Event", prefix: "/event/"}
];

class Model {

  constructor(sfHost, sessionId, args) {
    this.sfHost = sfHost;
    this.sessionId = sessionId;
    this.args = args;
    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.showMetrics = false;
    this.userInfo = "...";
    this.userFullName = "";
    this.userName = "";
    this.orgName = "";
    this.userInitials = "";
    this.events = [];
    this.selectedChannelType = "";
    this.channels = [];
    this.stdPlatformEvent = [];
    this.customPlatformEvent = [];
    this.customChannel = [];
    this.changeEvent = [];
    this.selectedChannel = "";
    this.customChannelPath = "";
    this.channelListening = "";
    this.channelError = "";
    this.isListenning = false;
    this.selectedEvent;
    this.selectedEventIndex = undefined;
    this.replayId = -1;
    this.cometd = {};
    this.subscription = {};
    this.confirmPopup = false;
    this.popConfirmed = false;
    this.isProd = false;
    this.eventFilter = "";

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
      this.userFullName = res.userFullName;
      this.userName = res.userName;
      this.orgName = this.sfHost.split(".")[0]?.toUpperCase() || "";
      // Generate initials from full name
      this.userInitials = res.userFullName
        .split(" ")
        .map(name => name.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }));

    let trialExpDate = localStorage.getItem(sfHost + "_trialExpirationDate");
    if (localStorage.getItem(sfHost + "_isSandbox") != "true" && (!trialExpDate || trialExpDate === "null")) {
      //change background color for production
      document.body.classList.add("sfir-prod");
      this.isProd = true;
    }

    if (args.has("channel")) {
      let channel = args.get("channel");
      this.selectedChannel = channel;
      this.selectedChannelType = channel.endsWith("__e") ? "platformEvent" : channel.endsWith("ChangeEvent") ? "changeEvent" : "standardPlatformEvent";
    } else if (args.get("channelType")){
      this.selectedChannelType = args.get("channelType");
    } else {
      this.selectedChannelType = channelTypes[0].value;
    }
    if (args.has("replayId")) {
      this.replayId = args.get("replayId");
    }
  }
  /**
   * Notify React that we changed something, so it will rerender the view.
   * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
   * All event listeners (functions starting with "on") should call this function if they update the model.
   * Asynchronous operations should use the spinFor function, which will call this function after the asynchronous operation completes.
   * Other functions should not call this function, since they are called by a function that does.
   * @param cb A function to be called once React has processed the update.
   */
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
    if (this.testCallback) {
      this.testCallback();
    }
  }

  copyAsJson() {
    copyToClipboard(JSON.stringify(this.selectedEvent ? this.selectedEvent : this.events.filter(event => !event.hidden), null, "    "), null, "  ");
  }

  clearEvents(){
    this.events = [];
    this.eventFilter = "";
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }


  /**
   * Show the spinner while waiting for a promise.
   * didUpdate() must be called after calling spinFor.
   * didUpdate() is called when the promise is resolved or rejected, so the caller doesn't have to call it, when it updates the model just before resolving the promise, for better performance.
   * @param promise The promise to wait for.
   */
  spinFor(promise) {
    this.spinnerCount++;
    promise
      .catch(err => {
        console.error("spinFor", err);
      })
      .then(() => {
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }

  toggleHelp() {
    this.showHelp = !this.showHelp;
  }
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.getEventChannels = this.getEventChannels.bind(this);
    this.onChannelTypeChange = this.onChannelTypeChange.bind(this);
    this.onChannelSelection = this.onChannelSelection.bind(this);
    this.onSuscribeToChannel = this.onSuscribeToChannel.bind(this);
    this.onUnsuscribeToChannel = this.onUnsuscribeToChannel.bind(this);
    this.onToggleHelp = this.onToggleHelp.bind(this);
    this.onToggleMetrics = this.onToggleMetrics.bind(this);
    this.onMetricsClick = this.onMetricsClick.bind(this);
    this.onSelectEvent = this.onSelectEvent.bind(this);
    this.onReplayIdChange = this.onReplayIdChange.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onClearEvents = this.onClearEvents.bind(this);
    this.confirmPopupYes = this.confirmPopupYes.bind(this);
    this.confirmPopupNo = this.confirmPopupNo.bind(this);
    this.retrievePlatformEvent = this.retrievePlatformEvent.bind(this);
    this.disableSubscribe = this.disableSubscribe.bind(this);
    this.onEventFilterInput = this.onEventFilterInput.bind(this);
    this.onClearAndFocusFilter = this.onClearAndFocusFilter.bind(this);
    this.onCustomChannelInput = this.onCustomChannelInput.bind(this);
    this.getEventChannels();
    this.state = {peLimits: []};
  }

  async retrievePlatformEvent(channelType, sfHost){
    let sessionChannel = JSON.parse(sessionStorage.getItem(sfHost + "_" + channelType));
    let channels = sessionChannel ? sessionChannel : [];
    let query;

    if (channels.length == 0){
      if (channelType == "standardPlatformEvent"){
        query = "SELECT Label, QualifiedApiName, DeveloperName FROM EntityDefinition"
                    + " WHERE IsCustomizable = FALSE AND IsEverCreatable = TRUE"
                    + " AND QualifiedApiName LIKE '%Event' AND (NOT QualifiedApiName LIKE '%ChangeEvent')"
                    + " ORDER BY Label ASC LIMIT 200";
      } else if (channelType == "platformEvent") {
        query = "SELECT QualifiedApiName, Label FROM EntityDefinition WHERE isCustomizable = TRUE AND KeyPrefix LIKE 'e%' ORDER BY Label ASC";
      } else if (channelType == "customChannel"){
        query = "SELECT FullName, MasterLabel FROM PlatformEventChannel ORDER BY DeveloperName";
      } else if (channelType == "changeEvent") {
        // Add "All" option first
        channels.push({
          name: "ChangeEvents",
          label: "All Change Events"
        });
        query = "SELECT MasterLabel, SelectedEntity FROM PlatformEventChannelMember WHERE EventChannel = 'ChangeEvents' ORDER BY MasterLabel";
      } else if (channelType == "realTimeEvent") {
        query = "SELECT EntityName FROM RealTimeEvent WHERE IsEnabled = true ORDER BY EntityName";
      }
      await sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(query))
        .then(result => {
          result.records.forEach((channel) => {
            let name = channel.QualifiedApiName || channel.FullName || channel.SelectedEntity || channel.EntityName;
            channels.push({
              name,
              label: channel.SelectedEntity ? channel.SelectedEntity.replace(/([A-Z])/g, " $1").replace(/__?/g, "__c") : channel.Label || channel.MasterLabel || channel.EntityName + " (" + name + ")"
            });
          });
        })
        .catch(err => {
          console.error("An error occurred fetching Event Channels of type " + channelType + ": ", err.message);
        });
      sessionStorage.setItem(sfHost + "_" + channelType, JSON.stringify(channels));
    }
    return channels;
  }

  async getEventChannels(){
    let {model} = this.props;
    const channelType = model.selectedChannelType;
    await this.handleChannelEvents(model, channelType);
    this.setSelectedChannel(model);
    model.didUpdate();
  }

  async handleChannelEvents(model, channelType) {
    const channelKey = this.getChannelTypeKey(channelType);

    if (!model[channelKey]?.length) {
      model[channelKey] = await this.retrievePlatformEvent(channelType, model.sfHost);

      // Add "No events found" message if needed
      if (!model[channelKey]?.length) {
        model[channelKey].push({name: null, label: "! No " + channelType + " found !"});
      }
    }

    model.channels = model[channelKey];
  }

  getChannelTypeKey(channelType) {
    const keyMap = {
      "platformEvent": "customPlatformEvent",
      "changeEvent": "changeEvent",
      "customChannel": "customChannel",
      "realTimeEvent": "realTimeEvents",
      "standardPlatformEvent": "stdPlatformEvent"
    };

    return keyMap[channelType] || channelType;
  }

  setSelectedChannel(model) {
    if (model.args.has("channel")) {
      model.selectedChannel = model.args.get("channel");
    } else if (model.channels?.length > 0) {
      model.selectedChannel = model.channels[0].name;
    }
  }

  onChannelTypeChange(e) {
    let {model} = this.props;
    model.selectedChannelType = e.target.value;

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("channelType", model.selectedChannelType);
    window.history.replaceState(null, "", "?" + urlParams.toString());

    this.getEventChannels();
    model.didUpdate();
  }

  onChannelSelection(e) {
    let {model} = this.props;
    model.selectedChannel = e.target.value;
    this.persistParamInUrl("channel", model.selectedChannel);
    model.didUpdate();
  }

  persistParamInUrl(name, value){
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set(name, value);
    window.history.replaceState(null, "", "?" + urlParams.toString());
  }

  onReplayIdChange(e) {
    let {model} = this.props;
    model.replayId = e.target.value;
    this.persistParamInUrl("replayId", model.replayId);
    model.popConfirmed = false;
    model.didUpdate();
  }

  async onSuscribeToChannel() {
    let {model} = this.props;
    model.spinnerCount++;
    model.didUpdate();
    //PopUp Confirmation in case of replay Id = -2
    if (model.replayId == -2 && model.popConfirmed == false){
      model.confirmPopup = true;
      model.didUpdate();
      return;
    }
    model.channelError = "";
    model.isListenning = true;

    // Create the CometD object.
    const cometd = new CometD();
    cometd.configure({
      url: model.sfLink + "/cometd/" + apiVersion,
      requestHeaders: {
        Authorization: "Bearer" + model.sessionId
      },
      appendMessageTypeToURL: false
    });
    cometd.websocketEnabled = false;

    //Load Salesforce Replay Extension
    let replayExtension = new cometdReplayExtension();

    let channelPath;
    if (model.customChannelPath) {
      channelPath = model.customChannelPath;
    } else {
      const selectedType = channelTypes.find(type => type.value === model.selectedChannelType);
      channelPath = selectedType.prefix + model.selectedChannel;
    }

    replayExtension.setChannel(channelPath);
    replayExtension.setReplay(model.replayId);
    replayExtension.setExtensionEnabled = true;
    cometd.registerExtension("SalesforceReplayExtension", replayExtension);

    cometd.handshake((h) => {
      if (h.successful) {
        model.cometd = cometd;
        // Subscribe to receive messages from the server.
        model.subscription = cometd.subscribe(channelPath,
          (message) => {
            const eventExists = model.events.some(event => event.event.replayId === message.data?.event?.replayId);
            if (!eventExists) {
              model.events.unshift(message.data);
            }
            model.didUpdate();
          }, (subscribeReply) => {
            if (subscribeReply.successful) {
              model.channelListening = "Listening on " + channelPath + " ...";
            } else {
              model.channelError = "Error : " + subscribeReply.error;
              model.isListenning = false;
            }
            model.spinnerCount--;
            model.didUpdate();
          }
        );
      }
    });
  }

  async onUnsuscribeToChannel() {
    let {model} = this.props;
    model.cometd.unsubscribe(model.subscription, (unsubscribeReply) => {
      console.log("unsubscribeReply");
      console.log(unsubscribeReply);
    });
    model.cometd.disconnect((disconnectReply) => {
      if (disconnectReply.successful) {
        model.channelListening = "";
        model.isListenning = false;
        model.didUpdate();
      }
    });
    model.didUpdate();
  }

  onSelectEvent(e){
    e.preventDefault();
    //do not trigger event selection if user is selecting some text
    if (!window.getSelection().toString()){
      let {model} = this.props;
      model.selectedEventIndex = e.target.id;
      model.selectedEvent = model.events[e.target.id];
      model.didUpdate();
    }
  }

  onCopyAsJson() {
    let {model} = this.props;
    model.copyAsJson();
    model.didUpdate();
  }

  onClearEvents(){
    let {model} = this.props;
    model.clearEvents();
    model.didUpdate();
  }

  onToggleHelp() {
    let {model} = this.props;
    model.toggleHelp();
    model.didUpdate();
  }

  onToggleMetrics(){
    let {model} = this.props;
    if (this.state.peLimits.length == 0){
      model.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/" + "limits").then(res => {
        let peLimits = [];
        Object.keys(res).forEach((key) => {
          if (key.endsWith("PlatformEvents")){
            peLimits.push({
              key,
              "label": key.replace(/([A-Z])/g, " $1"),
              "max": res[key].Max,
              "remaining": res[key].Remaining,
              "consumption": (res[key].Max - res[key].Remaining) / res[key].Max
            });
          }
        });
        //sort the list by descending consumption
        peLimits.sort((a, b) => b.consumption - a.consumption);
        this.setState({peLimits});
        model.showMetrics = !model.showMetrics;
        model.didUpdate();
      }));

    } else {
      model.showMetrics = !model.showMetrics;
      model.didUpdate();
    }
  }

  onMetricsClick(e) {
    const {model} = this.props;
    const timeSegment = e.target.innerText;
    const now = new Date();
    let startDate,
      endDate = this.getDatetime(now);

    switch (timeSegment) {
      case "Daily":
        startDate = this.getDatetime(new Date(now.setDate(now.getDate() - 29)));
        break;
      case "Hourly":
        startDate = this.getDatetime(new Date(now.setHours(now.getHours() - 24)));
        break;
      case "FifteenMinutes":
        startDate = this.getDatetime(new Date(now.setHours(now.getHours() - 1)));
        break;
    }

    const query = `SELECT EventName, EventType, UsageType, Value, StartDate, EndDate FROM PlatformEventUsageMetric
                   WHERE TimeSegment='${timeSegment}' AND StartDate > ${startDate} AND EndDate < ${endDate}`;

    const args = new URLSearchParams({host: model.sfHost, query});
    window.open(`data-export.html?${args}`, getLinkTarget(e));
    e.preventDefault();
  }

  onEventFilterInput(e) {
    let {model} = this.props;
    if (model.events) {
      model.eventFilter = e.target.value.toLowerCase();
      model.events = model.events.map(event => {
        let hidden = !JSON.stringify(event).toLowerCase().includes(model.eventFilter);
        return {
          ...event,
          hidden
        };
      });
      model.didUpdate();
    }
  }

  onClearAndFocusFilter(e) {
    e.preventDefault();
    let {model} = this.props;
    model.eventFilter = "";
    model.events = model.events.map(event => ({
      ...event,
      hidden: false
    }));
    this.refs.eventFilter.focus();
    model.didUpdate();
  }

  onCustomChannelInput(e) {
    let {model} = this.props;
    model.customChannelPath = e.target.value;
    model.didUpdate();
  }

  getDatetime(d) {
    return (
      `${this.pad(d.getFullYear(), 4)}-${this.pad(d.getMonth() + 1, 2)}-${this.pad(d.getDate(), 2)}T`
      + `${this.pad(d.getHours(), 2)}:${this.pad(d.getMinutes(), 2)}:${this.pad(d.getSeconds(), 2)}.`
      + `${this.pad(d.getMilliseconds(), 3)}${d.getTimezoneOffset() <= 0 ? "+" : "-"}${this.pad(Math.abs(d.getTimezoneOffset()) / 60, 2)}:${this.pad(Math.abs(d.getTimezoneOffset()) % 60, 2)}`
    );
  }

  pad(n, d) {
    return `000${n}`.slice(-d);
  }

  confirmPopupYes() {
    let {model} = this.props;
    model.popConfirmed = true;
    model.confirmPopup = false;
    this.onSuscribeToChannel();
  }

  confirmPopupNo() {
    let {model} = this.props;
    model.confirmPopup = false;
    model.replayId = -1;
    model.didUpdate();
  }

  disableSubscribe(){
    let {model} = this.props;
    return model.isListenning || (model.selectedChannel == null && !model.customChannelPath);
  }

  render() {
    let {model} = this.props;
    let {peLimits} = this.state;
    let filteredEvents = model.events.filter(event => !event.hidden);

    return h("div", {},
      h(PageHeader, {
        pageTitle: "Event Monitor",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        userInitials: model.userInitials,
        userFullName: model.userFullName,
        userName: model.userName,
        utilityItems: [
          h("div", {
            key: "metrics-btn",
            className: "slds-builder-header__utilities-item slds-p-top_x-small slds-p-horizontal_x-small"
          },
          h("button", {
            className: "slds-button slds-button_icon slds-button_icon-border-filled",
            title: "Show Metrics",
            onClick: this.onToggleMetrics
          },
          h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#metrics"})
          )
          )
          ),
          h("div", {
            key: "help-btn",
            className: "slds-builder-header__utilities-item slds-p-top_x-small slds-p-horizontal_x-small sfir-border-none"
          },
          h("button", {
            className: "slds-button slds-button_icon slds-button_icon-border-filled",
            title: "Event Monitor Help",
            onClick: this.onToggleHelp
          },
          h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#question"})
          )
          )
          )
        ]
      }),
      h("div", {
        className: "slds-m-top_xx-large",
        style: {
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 4rem)"
        }
      },
      // Subscribe to Channel Card
      h("div", {className: "slds-card slds-m-around_medium"},
        h("div", {className: "slds-card__body slds-card__body_inner"},
          h("div", {className: "slds-card__header"},
            h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
              h("div", {className: "slds-media__body"},
                h("h2", {className: "slds-card__header-title"}, "Subscribe to a Channel")
              )
            )
          ),
          h("div", {className: "slds-card__body slds-card__body_inner slds-m-top_small"},
            h("div", {className: "slds-form"},
              h("div", {className: "slds-form-element"},
                h("div", {className: "slds-form-element__control slds-grid slds-gutters_small slds-wrap"},
                  h("div", {className: "slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-large-size_1-of-6"},
                    h("label", {className: "slds-form-element__label"}, "Custom Channel Path"),
                    h("input", {
                      type: "text",
                      className: "slds-input",
                      value: model.customChannelPath,
                      onChange: this.onCustomChannelInput,
                      disabled: model.isListenning,
                      placeholder: "/event/LoginAsEventStream"
                    })
                  ),
                  h("div", {className: "slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-large-size_1-of-6"},
                    h("label", {className: "slds-form-element__label"}, "Channel Type"),
                    h("div", {className: "slds-select_container"},
                      h("select", {
                        className: "slds-select",
                        value: model.selectedChannelType,
                        onChange: this.onChannelTypeChange,
                        disabled: model.isListenning
                      },
                      ...channelTypes.map((type) => h("option", {key: type.value, value: type.value}, type.label))
                      )
                    )
                  ),
                  h("div", {className: "slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-large-size_1-of-6"},
                    h("label", {className: "slds-form-element__label"}, "Channel"),
                    h("div", {className: "slds-select_container"},
                      h("select", {
                        className: "slds-select",
                        value: model.selectedChannel,
                        onChange: this.onChannelSelection,
                        disabled: model.isListenning
                      },
                      ...model.channels.map((entity) => {
                        let channelName = entity.name;
                        return h("option", {key: entity.name, value: channelName}, entity.label);
                      })
                      )
                    )
                  ),
                  h("div", {className: "slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-large-size_1-of-6"},
                    h("label", {className: "slds-form-element__label"}, "Replay From"),
                    h("input", {
                      type: "number",
                      className: "slds-input",
                      value: model.replayId,
                      onChange: this.onReplayIdChange,
                      disabled: model.isListenning
                    })
                  ),
                  h("div", {className: "slds-col slds-align-bottom"},
                    h("button", {
                      className: "slds-button slds-button_brand",
                      onClick: this.onSuscribeToChannel,
                      title: "Subscribe to channel",
                      disabled: this.disableSubscribe()
                    }, "Subscribe"),
                    h("button", {
                      className: "slds-button slds-button_neutral",
                      onClick: this.onUnsuscribeToChannel,
                      title: "Unsubscribe to channel",
                      disabled: !model.isListenning
                    }, "Unsubscribe")
                  )
                )
              )
            ),
            // Help section
            !model.showHelp ? null : h("div", {className: "slds-box slds-theme_info slds-m-top_medium"},
              h("h3", {className: "slds-text-heading_small slds-m-bottom_small"}, "Event Monitor Help"),
              h("p", {className: "slds-m-bottom_x-small"}, "Use for monitor Platform Event queue."),
              h("p", {className: "slds-m-bottom_x-small"}, "Subscribe to a channel to see events in the result area. Use 'Replay From' to define the scope."),
              h("p", {}, "Supports Standard and Custom Platform Events")
            ),
            // Metrics section
            !model.showMetrics ? null : h("div", {className: "slds-box slds-theme_default slds-m-top_medium"},
              h("h3", {className: "slds-text-heading_small slds-m-bottom_small"}, "Platform Events Limits"),
              h("div", {className: "slds-m-bottom_small"},
                peLimits.map(limit =>
                  h("p", {key: limit.key, className: "slds-m-bottom_x-small"},
                    `${limit.label}: Remaining ${limit.remaining} out of ${limit.max} (${(limit.consumption * 100).toFixed(2)}% consumed)`)
                )
              ),
              h("div", {className: "slds-m-bottom_small"},
                h("p", {className: "slds-text-body_regular slds-m-bottom_x-small"}, "Query PlatformEventUsageMetric:"),
                h("div", {className: "slds-button-group"},
                  h("button", {className: "slds-button slds-button_neutral", onClick: (e) => { this.onMetricsClick(e); }}, "Daily"),
                  h("button", {className: "slds-button slds-button_neutral", onClick: (e) => { this.onMetricsClick(e); }}, "Hourly"),
                  h("button", {className: "slds-button slds-button_neutral", onClick: (e) => { this.onMetricsClick(e); }}, "FifteenMinutes")
                )
              ),
              h("div", {className: "slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_info", style: {display: "flex", alignItems: "center"}},
                h("span", {className: "slds-icon_container slds-icon-utility-info slds-m-right_x-small"},
                  h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"},
                    h("use", {xlinkHref: "symbols.svg#info_alt"})
                  )
                ),
                h("div", {},
                  "If you are facing the error: No such column 'EventName' on entity 'PlatformEventUsageMetric', please check related ",
                  h("a", {
                    href: "https://developer.salesforce.com/docs/atlas.en-us.244.0.api_meta.meta/api_meta/meta_platformeventsettings.htm",
                    target: getLinkTarget(),
                    className: "slds-text-link"
                  }, "documentation"), " to enable it."
                )
              )
            )
          )
        )
      ),
      // Event Result Card
      h("div", {
        className: "slds-card slds-m-around_medium",
        style: {
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column"
        }
      },
      h("div", {className: "slds-card__header"},
        h("div", {className: "slds-grid slds-grid_vertical-align-center slds-grid_align-spread slds-p-around_small"},
          h("div", {className: "slds-size_6-of-12"},
            h("span", {className: "slds-text-heading_small slds-m-right_small"}, "Event Results"),
            h("button", {
              className: "slds-button slds-button_neutral",
              disabled: filteredEvents.length == 0,
              onClick: this.onCopyAsJson,
              title: "Copy raw JSON to clipboard"
            }, "Copy"),
            h("button", {
              className: "slds-button slds-button_neutral slds-m-left_x-small",
              disabled: model.events.length == 0,
              onClick: this.onClearEvents,
              title: "Clear Events"
            }, "Clear")
          ),
          h("div", {className: "slds-size_6-of-12 slds-text-align_right"},
            h("div", {className: "slds-form-element slds-float_right", style: {display: "inline-block", maxWidth: "300px"}},
              h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left-right"},
                h("svg", {className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default", "aria-hidden": "true"},
                  h("use", {xlinkHref: "symbols.svg#search"})
                ),
                h("input", {
                  className: "slds-input",
                  disabled: model.events?.length == 0,
                  placeholder: "Filter events...",
                  value: model.eventFilter,
                  onChange: this.onEventFilterInput,
                  ref: "eventFilter"
                }),
                model.eventFilter ? h("button", {
                  className: "slds-button slds-button_icon slds-input__icon slds-input__icon_right",
                  title: "Clear filter",
                  onClick: this.onClearAndFocusFilter
                },
                h("svg", {className: "slds-button__icon slds-icon-text-light", "aria-hidden": "true"},
                  h("use", {xlinkHref: "symbols.svg#clear"})
                )
                ) : null
              )
            ),
            model.channelListening ? h("span", {className: "slds-badge slds-badge slds-m-right_small slds-m-top_xx-small slds-theme_success"}, model.channelListening) : null,
            model.channelError ? h("span", {className: "slds-badge slds-badge slds-m-right_small slds-m-top_xx-small slds-theme_error"}, model.channelError) : null,
            h("span", {className: "slds-badge slds-badge slds-m-right_small slds-m-top_xx-small"}, filteredEvents.length + " event" + (filteredEvents.length != 1 ? "s" : ""))
          )
        )
      ),
      h("div", {
        className: "slds-card__body slds-card__body_inner",
        style: {
          flex: "1 1 0",
          minHeight: 0,
          maxHeight: "100%",
          overflowY: "auto"
        }
      },
      h("div", {},
        h("pre", {className: "language-json reset-margin"},
          filteredEvents.map((event, index) => {
            const {hidden, ...eventWithoutHidden} = event;
            return h("code", {
              onClick: this.onSelectEvent,
              id: index,
              key: event.event.replayId,
              value: eventWithoutHidden,
              className: `language-json event-box ${model.selectedEventIndex == index ? "event-selected" : "event-not-selected"}`
            },
            JSON.stringify(eventWithoutHidden, null, 4)
            );
          },
          setTimeout(() => {
            if (window.Prism) {
              window.Prism.highlightAll();
            }
          }, 0)
          )
        )
      )
      )
      )
      ),
      // Confirmation Modal
      model.confirmPopup ? h("section", {
        role: "dialog",
        tabIndex: "-1",
        "aria-modal": "true",
        "aria-labelledby": "modal-heading-01",
        className: "slds-modal slds-fade-in-open"
      },
      h("div", {className: "slds-modal__container"},
        h("header", {className: "slds-modal__header"},
          h("h2", {id: "modal-heading-01", className: "slds-modal__title slds-hyphenate"}, "Important")
        ),
        h("div", {className: "slds-modal__content slds-p-around_medium"},
          model.isProd ? h("div", {className: "slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_error slds-m-bottom_small"},
            h("span", {className: "slds-assistive-text"}, "warning"),
            h("h2", {}, "WARNING: You are on a PRODUCTION environment.")
          ) : null,
          h("p", {className: "slds-m-bottom_small"}, "Use this option sparingly. Subscribing with the -2 option when a large number of event messages are stored can slow performance."),
          h("p", {}, "Hitting the daily limit can break existing integration!")
        ),
        h("footer", {className: "slds-modal__footer"},
          h("button", {
            className: "slds-button slds-button_neutral",
            onClick: this.confirmPopupNo
          }, "Cancel"),
          h("button", {
            className: "slds-button slds-button_brand",
            onClick: this.confirmPopupYes
          }, "Subscribe")
        )
      )
      ) : null,
      model.confirmPopup ? h("div", {className: "slds-backdrop slds-backdrop_open"}) : null
    );
  }
}

{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then((res) => {

    let root = document.getElementById("root");
    let model = new Model(sfHost, res, args);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model});
    }
  });
}

function cometdReplayExtension() {
  let REPLAY_FROM_KEY = "replay";
  let _cometd;
  let _extensionEnabled;
  let _replay;
  let _channel;

  this.setExtensionEnabled = function(extensionEnabled) {
    _extensionEnabled = extensionEnabled;
  };

  this.setReplay = function(replay) {
    _replay = parseInt(replay, 10);
  };

  this.setChannel = function(channel) {
    _channel = channel;
  };

  this.registered = function(name, cometd) {
    _cometd = cometd;
  };

  this.incoming = function(message) {
    if (message.channel === "/meta/handshake") {
      if (message.ext && message.ext[REPLAY_FROM_KEY] == true) {
        _extensionEnabled = true;
      }
    } else if (message.channel === _channel && message.data && message.data.event && message.data.event.replayId) {
      _replay = message.data.event.replayId;
    }
  };

  this.outgoing = function(message) {
    if (message.channel === "/meta/subscribe") {
      if (_extensionEnabled) {
        if (!message.ext) { message.ext = {}; }

        let replayFromMap = {};
        replayFromMap[_channel] = _replay;

        message.ext[REPLAY_FROM_KEY] = replayFromMap;
      }
    }
  };
};
