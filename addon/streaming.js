/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {csvParse} from "./csv-parse.js";
import {DescribeInfo, copyToClipboard, initScrollTable} from "./data-load.js";

// Import the CometD symbols.
import {CometD} from "./cometd/cometd.js";

const myEvent1 = {"schema":"wvzfKOWpumi4KAKipWNUVg","payload":{"FulfillmentOrderId":"0a3KD00000000mQYAQ","NewStatusCategory":"OPEN","CreatedById":"0050C000008stThQAI","OldStatus":"In Process","CreatedDate":"2024-08-07T12:12:19.078Z","OrderSummaryId":"1OsKD000000CaYS0A0","OldStatusCategory":"FULFILLING","NewStatus":"Fulfilled"},"event":{"EventUuid":"e5ba71b1-7070-4e3d-8b4a-3250c4d0385f","replayId":7661}};
const myEvent2 = {"schema":"wvzfKOWpumi4KAKipWNUVg","payload":{"FulfillmentOrderId":"0a3KD00000000mQYAQ","NewStatusCategory":"PROCESS","CreatedById":"0050C000008stThQAI","OldStatus":"In Process","CreatedDate":"2024-08-07T12:12:19.078Z","OrderSummaryId":"1OsKD000000CaYS0A0","OldStatusCategory":"FULFILLING","NewStatus":"Fulfilled"},"event":{"EventUuid":"e5ba71b1-7078-4e3d-8b4a-3250c4d0385f","replayId":7661}};
const myEvent3 = {"schema":"wvzfKOWpumi4KAKipWNUVg","payload":{"FulfillmentOrderId":"0a3KD00000000mQYAQ","NewStatusCategory":"CANCELLED","CreatedById":"0050C000008stThQAI","OldStatus":"In Process","CreatedDate":"2024-08-07T12:12:19.078Z","OrderSummaryId":"1OsKD000000CaYS0A0","OldStatusCategory":"FULFILLING","NewStatus":"Fulfilled"},"event":{"EventUuid":"e5ba71b1-7070-4e3d-8b4a-3250c470385f","replayId":7661}};
const myEvent4 = {"schema":"wvzfKOWpumi4KAKipWNUVg","payload":{"FulfillmentOrderId":"0a3KD00000000mQYAQ","NewStatusCategory":"CLOSED","CreatedById":"0050C000008stThQAI","OldStatus":"In Process","CreatedDate":"2024-08-07T12:12:19.078Z","OrderSummaryId":"1OsKD000000CaYS0A0","OldStatusCategory":"FULFILLING","NewStatus":"Fulfilled"},"event":{"EventUuid":"e5ba71b1-7078-4e3d-8b4a-3250c480385f","replayId":7661}};


const channelSuffix = "/event/";
const channelTypes = [
  //{value: "GenericEvent", label: "Generic Event"},
  {value: "StandardPlatformEvent", label: "Standard Platform Event"},
  {value: "PlatformEvent", label: "Custom Platform Event"}
  //{value: "GenericEvent", label: "Generic Event"},
  //{value: "ChangeDataCaptureEvent", label: "Change Data Capture"}
];
const defaultChannelType = "StandardPlatformEvent";

class Model {

  constructor(sfHost, sessionId, args) {
    this.sfHost = sfHost;
    this.sessionId = sessionId;
    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.userInfo = "...";
    this.events = [];
    this.selectedChannelType = defaultChannelType;
    this.channels = [];
    this.selectedChannel = "";
    this.channelListening = "";
    this.isListenning = false;
    this.selectedEvent = undefined;
    this.cometd = {};
    this.subscription = {};

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));

    if (localStorage.getItem(sfHost + "_isSandbox") != "true") {
      //change background color for production
      document.body.classList.add("prod");
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
    this.getEventChannels(defaultChannelType);
  }

  getEventChannels(channelType){
    console.log('***getEventChannels');
    console.log(channelType);
    let {model} = this.props;
    let query;
    let type = 'PE';
    switch(channelType){
      case 'StandardPlatformEvent':
        console.log("StandardPlatformEvent");
        query = "SELECT Label, QualifiedApiName, DeveloperName FROM EntityDefinition"+
                  " WHERE IsCustomizable = FALSE AND IsEverCreatable = TRUE"+ 
                  " AND QualifiedApiName LIKE '%Event' AND (NOT QualifiedApiName LIKE '%ChangeEvent')"+ 
                  " ORDER BY Label ASC LIMIT 200";
        break;
      case 'PlatformEvent':
        console.log("PlatformEvent");
        query = "SELECT QualifiedApiName, Label FROM EntityDefinition"+
                  " WHERE isCustomizable = TRUE"+
                  " AND KeyPrefix LIKE 'e%' ORDER BY Label ASC";
        break;
        case 'ChangeDataCaptureEvent':
          console.log('ChangeDataCaptureEvent');
          query = "SELECT Id, MasterLabel, DeveloperName FROM PlatformEventChannelMember";
          type = 'CDC';
      /*
      case 'GenericEvent':
        console.log("GenericEvent");
        query = "SELECT Name FROM StreamingChannel ORDER BY Name";
      */  
    }
    console.log(type);
    console.log(query);
    return sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(query))
      .then(result => {
        console.log('result');
        console.log(result);
        model.channels = [];

        result.records.forEach((channel, index) => {
          if(type == 'CDC'){
            if(index == 0){
              model.selectedChannel = channelSuffix + channel.DeveloperName;
            }
            model.channels.push({     
              name: channel.DeveloperName,
              label: channel.MasterLabel
            });
          }else{
            if(index == 0){
              model.selectedChannel = channelSuffix + channel.QualifiedApiName;
            }
            model.channels.push({     
              name: channel.QualifiedApiName,
              label: channel.Label
            });
          }
        });
        /*
        model.events.unshift(myEvent1);
        model.events.unshift(myEvent2);
        model.events.unshift(myEvent3);
        model.events.unshift(myEvent4);
        console.log('model.events');
        console.log(model.events)
        */
        model.didUpdate();
        
      }).catch(err => {
          console.error("An error occured fetching Event Channels of type " + channelType+ ": ", err.message);
      });
  }

  onChannelTypeChange(e) {
    console.log("**onChannelTypeChange");
    let {model} = this.props;
    model.selectedChannelType = e.target.value;
    console.log(model.selectedChannelType);
    this.getEventChannels(model.selectedChannelType);
  }

  onChannelSelection(e){
    console.log("***onChannelSelection");
    let {model} = this.props;
    model.selectedChannel = channelSuffix + e.target.value;
    console.log('selectedChannel : ' +model.selectedChannel);
  }

  async onSuscribeToChannel() {
    console.log("***onSuscribeToChannel");
    let {model} = this.props;
    console.log('sfHost');
    console.log(model.sfLink);
    console.log('sessionId');
    console.log(model.sessionId);
    
    // Create the CometD object.
    const cometd = new CometD();
    cometd.configure({
      url: model.sfLink + `/cometd/61.0`,
      requestHeaders: {
        Authorization: `Bearer` +model.sessionId
      },
      appendMessageTypeToURL: false
      //logLevel: 'debug'
    });
    cometd.websocketEnabled = false;

    cometd.handshake(function(h) {
      if (h.successful) {
        model.cometd = cometd;
        // Subscribe to receive messages from the server.
        model.channelListening = 'Listening on ' + model.selectedChannel + ' ...';
        model.isListenning = true;
        console.log(model.channelListening);
        model.didUpdate();
        model.subscription = cometd.subscribe(model.selectedChannel, function(m) {
            console.log(m.data);
            //console.log(JSON.stringify(m.data));
            model.events.unshift(JSON.parse(JSON.stringify(m.data)));
            console.log('model.events');
            console.log(model.events);
            model.didUpdate();
        });
      }
    });  
  }

  async onUnsuscribeToChannel() {
    console.log("***onUnsuscribeToChannel");
    let {model} = this.props;
    console.log(model.subscription);
    model.cometd.unsubscribe(model.subscription, function(unsubscribeReply) {
      if (unsubscribeReply.successful) {
        console.log("Unsubscribe sucessfully");
        model.channelListening = "";
        model.isListenning = false;
        model.didUpdate();
          // Server truly received the disconnect request
      }
    });
    model.cometd.disconnect(function(disconnectReply) {
      if (disconnectReply.successful) {
        console.log("cometD Disconnected");
      }
    });
    model.didUpdate();
  }

  onSelectEvent(e){
    e.preventDefault();
    let {model} = this.props;
    model.selectedEvent = e.target.id;
    model.didUpdate();
  }

  onToggleHelp(e) {
    //e.preventDefault();
    let {model} = this.props;
    model.toggleHelp();
    model.didUpdate();
  }

  render() {
    let {model} = this.props;
    
    return h("div", {},
      //START HEADER
      h("div", {id: "user-info"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
        h("h1", {}, "Streaming"),
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
      // END HEADER
      
      //START SUBSCRIBE CHANNEL
      h("div", {className: "area"},
        h("div", {className: "area-header"},
              h("h1", {}, "Subscribe to a channel")
        ),
        h("div", {className: "conf-line"},
          h("label", {className: "conf-input", title: "Channel Selection"},
            h("span", {className: "conf-label"}, "Channel Type :"),
            h("span", {className: "conf-value"},
              h("select", { value: model.selectedChannelType, 
                            onChange: this.onChannelTypeChange, disabled: model.isListenning
                          },
                          ...channelTypes.map((type, index) => h("option", {key: index, value: type.value}, type.label)
                          )
              )
            ),
            h("span", {className: "conf-label"}, "Channel :"),
            h("span", {className: "conf-value"},
              h("select", {value: model.eventEntity, onChange:this.onChannelSelection, disabled: model.isListenning},
                  ...model.channels.map((entity, index) => h("option", {key: index, value: entity.name}, entity.label))
              )
            ),
            h("button", {onClick: this.onSuscribeToChannel, title: "Suscribe to channel", disabled: model.isListenning}, "Subscribe"),
            h("button", {onClick: this.onUnsuscribeToChannel, title: "Unsuscribe to channel", disabled: !model.isListenning}, "Unsubscribe")
          )
        ),
        h("div", {hidden: !model.showHelp, className: "help-text"},
          h("h3", {}, "Streaming Help"),
          h("p", {}, "Use for monitor Platform Event queue."),
          h("p", {}, "Subscribe to a channel to see events in the result area. Only new events will be catched."),
          h("p", {}, "Supports Standard and Custom Platform Events")
        )
      ),
      // END SUBSCRIBE CHANNEL

      // START BODY      
      h("div", {className: "area", id: "result-area"},
        h("div", {className: "result-bar"},
          h("h1", {}, "Event Result"),
          h("span", {className: "channel-listening" }, model.channelListening)
        ),
        h("div", {id: "result-table"},
          /* the scroll table goes here*/
          h("div",{},
            model.events.map((event, index) => h("div", {onClick: this.onSelectEvent,id: index, key: index, value: event, className:` ${model.selectedEvent == index ? 'event-selected' : 'event-box'}`},
              JSON.stringify(event, null, 4))
          )
          )         
        )
      )  
      // END BODY
    )
  }
}

{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then((res) => {
    console.log('sessionId');
    console.log(res);

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

function stringIsEmpty(str) {
  return str == null || str == undefined || str.trim() == "";
}
