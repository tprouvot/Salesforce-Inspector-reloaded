/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
// Import the CometD library
import {CometD} from "./lib/cometd/cometd.js";
import {copyToClipboard} from "./data-load.js";

const channelSuffix = "/event/";
const channelTypes = [
  {value: "standardPlatformEvent", label: "Standard Platform Event"},
  {value: "platformEvent", label: "Custom Platform Event"}
];

class Model {

  constructor(sfHost, sessionId, args) {
    this.sfHost = sfHost;
    this.sessionId = sessionId;
    this.args = args;
    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.userInfo = "...";
    this.events = [];
    this.selectedChannelType = "";
    this.channels = [];
    this.stdPlatformEvent = [];
    this.customPlatformEvent = [];
    this.selectedChannel = null;
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

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));

    let trialExpDate = localStorage.getItem(sfHost + "_trialExpirationDate");
    if (localStorage.getItem(sfHost + "_isSandbox") != "true" && (!trialExpDate || trialExpDate === "null")) {
      //change background color for production
      document.body.classList.add("prod");
      this.isProd = true;
    }

    if (args.has("channel")) {
      let channel = args.get("channel");
      this.selectedChannel = channel;
      this.selectedChannelType = channel.endsWith("__e") ? "platformEvent" : "standardPlatformEvent";
    } else if (args.get("channelType")){
      this.selectedChannelType = args.get("channelType");
    } else {
      this.selectedChannelType = channelTypes[0].value;
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
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }

  copyAsJson() {
    copyToClipboard(JSON.stringify(this.selectedEvent ? this.selectedEvent : this.events, null, "    "), null, "  ");
  }

  clearEvents(){
    this.events = [];
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
    this.onSelectEvent = this.onSelectEvent.bind(this);
    this.onReplayIdChange = this.onReplayIdChange.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onClearEvents = this.onClearEvents.bind(this);
    this.confirmPopupYes = this.confirmPopupYes.bind(this);
    this.confirmPopupNo = this.confirmPopupNo.bind(this);
    this.retrievePlatformEvent = this.retrievePlatformEvent.bind(this);
    this.disableSubscribe = this.disableSubscribe.bind(this);
    this.getEventChannels();
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
        query = "SELECT QualifiedApiName, Label FROM EntityDefinition"
                    + " WHERE isCustomizable = TRUE"
                    + " AND KeyPrefix LIKE 'e%' ORDER BY Label ASC";
      }
      await sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(query))
        .then(result => {
          result.records.forEach((channel) => {
            channels.push({
              name: channel.QualifiedApiName,
              label: channel.Label + " (" + channel.QualifiedApiName + ")"
            });
          });
        })
        .catch(err => {
          console.error("An error occured fetching Event Channels of type " + channelType + ": ", err.message);
        });
      sessionStorage.setItem(sfHost + "_" + channelType, JSON.stringify(channels));
    }
    return channels;
  }

  async getEventChannels(){
    let {model} = this.props;
    switch (model.selectedChannelType){
      case "standardPlatformEvent":
        if (!model.stdPlatformEvent.length){
          model.stdPlatformEvent = await this.retrievePlatformEvent(model.selectedChannelType, model.sfHost);
        }
        model.channels = model.stdPlatformEvent;
        break;
      case "platformEvent":
        if (!model.customPlatformEvent.length){
          model.customPlatformEvent = await this.retrievePlatformEvent(model.selectedChannelType, model.sfHost);
          if (!model.customPlatformEvent.length){
            model.customPlatformEvent.push({
              name: null,
              label: "! No custom platform event found !"
            });
          }
        }
        model.channels = model.customPlatformEvent;
    }
    if (model.args.has("channel")) {
      model.selectedChannel = model.args.get("channel");
    } else {
      model.selectedChannel = model.channels[0].name;
    }
    model.didUpdate();
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

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("channel", model.selectedChannel);
    window.history.replaceState(null, "", "?" + urlParams.toString());

    model.didUpdate();
  }

  onReplayIdChange(e) {
    let {model} = this.props;
    model.replayId = e.target.value;
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
    replayExtension.setChannel(channelSuffix + model.selectedChannel);
    replayExtension.setReplay(model.replayId);
    replayExtension.setExtensionEnabled = true;
    cometd.registerExtension("SalesforceReplayExtension", replayExtension);

    cometd.handshake((h) => {
      if (h.successful) {
        model.cometd = cometd;
        // Subscribe to receive messages from the server.
        model.subscription = cometd.subscribe(channelSuffix + model.selectedChannel,
          (message) => {
            model.events.unshift(JSON.parse(JSON.stringify(message.data)));
            model.didUpdate();
          }, (subscribeReply) => {
            if (subscribeReply.successful) {
              model.channelListening = "Listening on " + channelSuffix + model.selectedChannel + " ...";
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
    let {model} = this.props;
    model.selectedEventIndex = e.target.id;
    model.selectedEvent = model.events[e.target.id];
    model.didUpdate();
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

  onToggleHelp(e) {
    let {model} = this.props;
    model.toggleHelp();
    model.didUpdate();
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
    return model.isListenning || model.selectedChannel == null;
  }

  render() {
    let {model} = this.props;

    return h("div", {},
      h("div", {id: "user-info"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
        h("h1", {}, "Event Monitor"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},

          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          ),
          h("a", {href: "#", id: "help-btn", title: "Import Help", onClick: this.onToggleHelp},
            h("div", {className: "icon"})
          ),
        ),
      ),
      h("div", {className: "area"},
        h("div", {className: "area-header"},
          h("h1", {}, "Subscribe to a channel")
        ),
        h("div", {className: "conf-line"},
          h("label", {title: "Channel Selection"},
            h("span", {className: "conf-label"}, "Channel Type :"),
            h("span", {className: "conf-value"},
              h("select", {value: model.selectedChannelType,
                onChange: this.onChannelTypeChange,
                disabled: model.isListenning
              },
              ...channelTypes.map((type, index) => h("option", {key: index, value: type.value}, type.label)
              )
              )
            ),
            h("span", {className: "conf-label"}, "Channel :"),
            h("span", {className: "conf-value"},
              h("select", {value: model.selectedChannel, onChange: this.onChannelSelection, disabled: model.isListenning},
                ...model.channels.map((entity, index) => h("option", {key: index, value: entity.name}, entity.label))
              )
            ),
            h("span", {className: "conf-label"}, "Replay From :"),
            h("span", {className: "conf-value"},
              h("input", {type: "number", className: "conf-replay-value", value: model.replayId, onChange: this.onReplayIdChange, disabled: model.isListenning})
            ),
            h("button", {onClick: this.onSuscribeToChannel, title: "Suscribe to channel", disabled: this.disableSubscribe()}, "Subscribe"),
            h("button", {onClick: this.onUnsuscribeToChannel, title: "Unsuscribe to channel", disabled: !model.isListenning}, "Unsubscribe")
          )
        ),
        h("div", {hidden: !model.showHelp, className: "help-text"},
          h("h3", {}, "Event Monitor Help"),
          h("p", {}, "Use for monitor Platform Event queue."),
          h("p", {}, "Subscribe to a channel to see events in the result area. Use 'Replay From' to define the scope."),
          h("p", {}, "Supports Standard and Custom Platform Events")
        )
      ),
      h("div", {className: "area", id: "result-area"},
        h("div", {className: "result-bar"},
          h("h1", {}, "Event Result"),
          h("div", {className: "button-group"},
            h("button", {disabled: model.events.length == 0, onClick: this.onCopyAsJson, title: "Copy raw JSON to clipboard"}, "Copy")
          ),
          h("span", {className: "channel-listening"}, model.channelListening),
          h("span", {className: "channel-error"}, model.channelError),
          h("span", {className: "result-status flex-right"},
            h("div", {className: "button-group"},
              h("button", {disabled: model.events.length == 0, onClick: this.onClearEvents, title: "Clear Events"}, "Clear")
            )
          ),
        ),
        h("div", {id: "result-table"},
          h("div", {},
            h("pre", {className: "language-json reset-margin"}, // Set the language class to JSON for Prism to highlight
              model.events.map((event, index) => h("code", {onClick: this.onSelectEvent, id: index, key: index, value: event, className: `language-json event-box ${model.selectedEventIndex == index ? "event-selected" : "event-not-selected"}`},
                JSON.stringify(event, null, 4))
              )
            )
          )
        ),
        model.confirmPopup ? h("div", {},
          h("div", {id: "confirm-replayId"},
            h("div", {id: "confirm-dialog"},
              h("h1", {}, "Important"),
              model.isProd ? h("p", {}, "WARNING : You are on a PRODUCTION.") : null,
              h("p", {}, "Use this option sparingly. Subscribing with the -2 option when a large number of event messages are stored can slow performance."),
              h("p", {}, "Hitting the daily limit can break existing integration!"),
              h("div", {className: "dialog-buttons"},
                h("button", {onClick: this.confirmPopupYes}, "Subscribe"),
                h("button", {onClick: this.confirmPopupNo, className: "cancel-btn"}, "Cancel")
              )
            )
          )
        ) : null
      )
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
