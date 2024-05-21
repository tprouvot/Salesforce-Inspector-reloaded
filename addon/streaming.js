/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {ScrollTable, TableModel} from "./data-load.js";

function RecordTable() {
  let rt = {
    records: [],
    table: [["Channel", "ReplayId", "CreatedDate", "Event type", "Payload"]],
    rowVisibilities: [true],
    colVisibilities: [true, true, true, true, true],
    countOfVisibleRecords: null,
    isTooling: false,
    totalSize: -1,
    addToTable(record) {
      let row = new Array(5);
      row[0] = record.channel || (record?.event?.EventApiName);
      row[1] = record?.data?.event?.replayId || record?.event?.replayId;
      row[2] = record.data.event.createdDate || new Date();
      row[3] = record.data.event.type;
      row[4] = JSON.stringify(record);
      rt.records = rt.records.push(record);
      rt.rowVisibilities.push(true);
      rt.table.push(row);
    }
  };
  return rt;
}

class Model {
  constructor({sfHost, args}) {
    this.reactCallback = null;
    this.sfLink = "https://" + sfHost;
    this.tableModel = new TableModel(sfHost, this.didUpdate.bind(this));
    this.resultTableCallback = (d) => this.tableModel.dataChange(d);
    this.userInfo = "...";
    this.spinnerCount = 0;
    this.errorMessages = [];
    this.args = args;
    this.events = new RecordTable();
    this.isWorking = false;
    this.activeChannels = [];
    this.executeStatus = "";
    this.executeError = null;
    if (localStorage.getItem(sfHost + "_isSandbox") != "true") {
      //change background color for production
      document.body.classList.add("prod");
    }
    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));
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

  title() {
    return "Streaming";
  }

  createChannel(chanName, chanLabel, eventType) {
    let eventToChannel = {"PlatformEvent": "event", "ChangeDataCaptureEvent": "data"};
    let chanType = eventToChannel[eventType];
    let channel = {
      "FullName": chanName, //"Carbon_Comparison_Channel__chn", Account_Channel__chn
      "Metadata": {
        "channelType": chanType, // "event" or "data"
        "label": chanLabel //"Carbon Comparison Channel"
      }
    };
    this.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/tooling/sobjects/PlatformEventChannel", {method: "POST", body: channel}));
  }
  // display monitor event /lightning/setup/EventManager/home

  createChannelMember(eventMemberName, chanName, entity) {
    let channelMember = {
      "FullName": eventMemberName, //"Carbon_Comparison_Channel_chn_Carbon_Comparison_e", Account_Channel_chn_AccountChangeEvent
      "Metadata": {
        "eventChannel": chanName,
        //TODO filterExpression": "(City__c LIKE 'S%' OR City__c='New York') AND Amount__c>10.50",
        "selectedEntity": entity //"Carbon_Comparison__e" or AccountChangeEvent
      }
    };
    this.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/tooling/sobjects/PlatformEventChannelMember", {method: "POST", body: channelMember}));
  }
  createPushTopic(pushTopicName, qry, NotifyCreate, notifyUpdate, NotifyUndelete, NotifyDelete, NotifyFields) {
    let pushtopic = {
      Name: pushTopicName,
      Query: qry,
      ApiVersion: apiVersion,
      NotifyForOperationCreate: NotifyCreate,
      NotifyForOperationUpdate: notifyUpdate,
      NotifyForOperationUndelete: NotifyUndelete,
      NotifyForOperationDelete: NotifyDelete,
      NotifyForFields: NotifyFields
    };
    this.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/sobjects/PushTopic", {method: "POST", body: pushtopic}));
  }
  async getGenericChannels() {
    let query = "SELECT Id, Name, Description FROM StreamingChannel ORDER BY Name ASC";
    let eventChannels = await sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(query), {});
    return eventChannels.records.map(c => ({label: c.Name, value: c.Name}));
  }
  async getChannels(eventType) {
    let eventToChannel = {"PlatformEvent": "event", "ChangeDataCaptureEvent": "data"};
    let channelType = eventToChannel[eventType];
    let query = "SELECT DeveloperName, Id, MasterLabel FROM PlatformEventChannel WHERE channelType = '" + channelType + "' ORDER BY MasterLabel ASC";
    let eventChannels = await sfConn.rest("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent(query), {});
    return eventChannels.records.map(c => ({label: c.MasterLabel, value: c.DeveloperName}));
  }
  async getEntities(eventType) {
    switch (eventType) {
      case "ChangeDataCaptureEvent": {
        let query = "SELECT Label, QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName like '%ChangeEvent' ORDER BY Label ASC";
        let res = await sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(query), {});
        return res.records.map(c => ({label: c.Label, value: c.QualifiedApiName}));
      }
      case "PlatformEvent": {
        let standardPEQuery = "SELECT Label, QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName like '%Event' AND PublisherId != 'CDC' ORDER BY Label ASC";
        let customPEQuery = "SELECT Label, QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName like '%e' AND PublisherId = '<local>' ORDER BY Label ASC";
        let compositeQuery = {
          compositeRequest: [
            {
              "method": "GET",
              "url": "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(standardPEQuery),
              "referenceId": "standardPEQuery"
            },
            {
              "method": "GET",
              "url": "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(customPEQuery),
              "referenceId": "customPEQuery"
            }
          ]
        };
        let res = await sfConn.rest("/services/data/v" + apiVersion + "/composite", {method: "POST", body: compositeQuery});
        return res.compositeResponse
          .filter((elm) => elm.httpStatusCode == 200 && elm.body.records.length > 0)
          .flatMap((elm) => elm.body.records)
          .map(c => ({label: c.Label, value: c.QualifiedApiName}));
      }
      default:
        return [];
    }
  }
  async pollEvents(channel) {
    this.activeChannels.push(channel);
    this.events.describeInfo = this.describeInfo;
    this.events.sfHost = this.sfHost;
    let pollId = 1;
    let handshake = await sfConn.rest("/cometd/" + apiVersion, {
      method: "POST",
      body: [
        {
          "version": "1.0",
          "minimumVersion": "0.9",
          "channel": "/meta/handshake",
          "supportedConnectionTypes": ["long-polling", "callback-polling"],
          "advice": {"timeout": 60000, "interval": 0},
          "id": pollId.toString()
        }],
      bodyType: "json",
      headers: {}
    });
    pollId++;
    if (Array.isArray(handshake)) {
      handshake = handshake[0];
    }
    if (handshake == null || !handshake.successful) {
      console.log("handshake failed");
      return;
    }

    let subResponse = await sfConn.rest("/cometd/" + apiVersion, {
      method: "POST",
      body: [
        {
          "channel": "/meta/subscribe",
          "subscription": channel, // /topic/InvoiceStatementUpdates /systemTopic/Logging /event/Event_Name__e /event/Channel_Name__chn
          "id": pollId.toString(),
          "clientId": handshake.clientId
        }],
      bodyType: "json",
      headers: {}
    });
    pollId++;

    if (subResponse == null || !Array.isArray(subResponse) || !subResponse[0].successful) {
      console.log("subscription failed");
      return;
    }
    let advice = null;
    while (this.activeChannels.includes(channel)) {
      let response = await sfConn.rest("/cometd/" + apiVersion, {
        method: "POST",
        body: [
          {
            "channel": "/meta/connect",
            "connectionType": "long-polling",
            "advice": advice || {"timeout": 0},
            "id": pollId.toString(),
            "clientId": handshake.clientId
          }],
        bodyType: "json",
        headers: {}
      });
      pollId++;
      if (response == null || !Array.isArray(response)) {
        this.executeStatus = "Error";
        this.executeError = "Polling failed with empty response.";
        this.activeChannels.splice(this.activeChannels.indexOf(channel), 1);
        console.log("polling failed");
        return;
      }
      let rspFailed = response.find(rsp => rsp == null || (rsp.data == null && !rsp.successful));
      if (rspFailed) {
        this.executeStatus = "Error";
        this.executeError = rspFailed.error;
        this.activeChannels.splice(this.activeChannels.indexOf(channel), 1);
        console.log("polling failed:" + rspFailed.error);
        return;
      }
      let arsp = response.find(rsp => rsp != null && rsp.successful);
      if (arsp) {
        advice = arsp.advice;
      }
      response.filter(rsp => rsp != null && rsp.data != null && rsp.channel == channel)
        .forEach(rsp => this.events.addToTable(rsp));
    }
  }
  recalculateSize() {
    // Investigate if we can use the IntersectionObserver API here instead, once it is available.
    this.tableModel.viewportChange();
  }
}


let h = React.createElement;

class StreamingTabSelector extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.sfHost = this.model.sfHost;
    this.state = {
      selectedTabId: 1
    };
    this.tabs = [
      {
        id: 1,
        tabTitle: "Tab1",
        title: "Monitor",
        content: Monitor
      },
      {
        id: 2,
        tabTitle: "Tab2",
        title: "Subscribe",
        content: Subscribe
      }, /* TODO
      {
        id: 3,
        tabTitle: "Tab3",
        title: "Publish",
        content: Publish
      },*/
      {
        id: 4,
        tabTitle: "Tab4",
        title: "Create",
        content: Register
      }
    ];
    this.onTabSelect = this.onTabSelect.bind(this);
  }

  onTabSelect(e) {
    e.preventDefault();
    this.setState({selectedTabId: e.target.tabIndex});
  }

  render() {
    return h("div", {className: "slds-tabs_default", style: {height: "inherit"}},
      h("ul", {className: "options-tab-container slds-tabs_default__nav", role: "tablist"},
        this.tabs.map((tab) => h(StreamingTab, {key: tab.id, id: tab.id, title: tab.title, content: tab.content, onTabSelect: this.onTabSelect, selectedTabId: this.state.selectedTabId, model: this.model}))
      ),
      this.tabs
        .filter((tab) => tab.id == this.state.selectedTabId)
        .map((tab) => h(tab.content, {key: tab.id, id: tab.id, model: this.model}))
    );
  }
}

class StreamingTab extends React.Component {

  getClass() {
    return "options-tab slds-text-align_center slds-tabs_default__item" + (this.props.selectedTabId === this.props.id ? " slds-is-active" : "");
  }

  render() {
    return h("li", {key: this.props.id, className: this.getClass(), title: this.props.title, tabIndex: this.props.id, role: "presentation", onClick: this.props.onTabSelect},
      h("a", {className: "slds-tabs_default__link", href: "#", role: "tab", tabIndex: this.props.id, id: "tab-default-" + this.props.id + "__item"},
        this.props.title)
    );
  }
}
class Monitor extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
  }
  render() {
    let {model} = this.props;
    return h("div", {},
      h("textarea", {id: "result-text", readOnly: true, value: model.executeError || "", hidden: model.executeError == null}),
      h(ScrollTable, {model: model.tableModel, hidden: model.executeError != null})
    );
  }
}
class Subscribe extends React.Component {
  //TODO pollEvents(channel)
  constructor(props) {
    super(props);
    this.model = props.model;
    this.sfLink = this.model.sfLink;
    this.eventTypes = [
      {
        label: "Platform Event Channel",
        value: "PlatefomEventChannel"
      },
      {
        label: "Change Data Capture Channel",
        value: "ChangeDataCaptureEventChannel"
      },
      {
        label: "Platform event",
        value: "PlatformEvent"
      },
      {
        label: "Change Data Capture event",
        value: "ChangeDataCaptureEvent"
      },
      {
        label: "PushTopic event",
        value: "PushTopicEvent"
      },
      {
        label: "Generic event",
        value: "GenericEvent"
      }
    ];
    this.eventType = "";
    this.selectedTopic = "";
    this.topics = [];
    this.onSelectEventType = this.onSelectEventType.bind(this);
    this.onSelectTopic = this.onSelectTopic.bind(this);
    this.onUnsubscribe = this.onUnsubscribe.bind(this);
    this.onSubscribe = this.onSubscribe.bind(this);
  }
  onSelectEventType(e) {
    this.eventType = e.target.value;
    switch (this.eventType) {
      case "GenericEvent":
        this.model.getGenericChannels().then(eventChannels => {
          if (!eventChannels) {
            return;
          }
          // /u/notifications/ExampleUserChannel
          this.topics = eventChannels;
          this.model.didUpdate();
        });
        break;
      case "PushTopicEvent":
        //TODO list push topic event
        // /topic/InvoiceStatementUpdates
        break;
      case "ChangeDataCaptureEvent":
      case "PlatformEvent":
        this.model.getEntities(this.eventType).then(eventEntities => {
          if (!eventEntities) {
            return;
          }
          // /event/Event_Name__e /event/Channel_Name__chn /data/ChangeEvents
          this.topics = eventEntities;
          this.model.didUpdate();
        });
        break;
      case "PlatefomEventChannel":
        this.model.getChannels(this.eventType).then(eventChannels => {
          if (!eventChannels) {
            return;
          }
          this.topics = eventChannels;
          this.model.didUpdate();
        });
        break;
      case "ChangeDataCaptureEventChannel":
        this.model.getChannels(this.eventType).then(eventChannels => {
          if (!eventChannels) {
            return;
          }
          this.topics = eventChannels;
          this.model.didUpdate();
        });
        break;
      default:
        break;
    }
    this.model.didUpdate();
  }
  onSelectTopic(e) {
    this.selectedTopic = e.target.value;
    this.model.didUpdate();
  }
  onSubscribe(){
    let topic = "";
    switch (this.eventType) {
      case "GenericEvent":
        topic = "/u/";
        break;
      case "PushTopicEvent":
        topic = "/topic/";
        break;
      case "ChangeDataCaptureEvent":
        topic = "/data/";
        break;
      case "PlatformEvent":
        topic = "/event/";
        break;
      case "PlatefomEventChannel":
        topic = "/event/";
        break;
      case "ChangeDataCaptureEventChannel":
        topic = "/data/";
        break;
      default:
        break;
    }
    topic += this.selectedTopic;
    this.model.pollEvents(topic);
    this.model.didUpdate();
  }
  onUnsubscribe(i) {
    this.model.activeChannels.splice(i, 1);
    this.model.didUpdate();
  }
  render() {
    let self = this;
    return h("div", {},
      h("h2", {className: "slds-text-title_bold"}, "1. Select Type"),
      h("select", {className: "slds-combobox__form-element slds-input combobox-container", value: this.eventType, onChange: this.onSelectEventType, title: "Event Type"},
        h("option", {value: ""}, "types"),
        this.eventTypes.map(t => h("option", {key: t.value, value: t.value}, t.label))
      ),
      h("select", {className: "slds-combobox__form-element slds-input combobox-container", value: this.selectedTopic, onChange: this.onSelectTopic, title: "Topic"},
        this.topics.map(t => h("option", {key: t.value, value: t.value}, t.label))
      ),
      h("div", {className: "slds-p-horizontal_small"},
        h("button", {className: "slds-button slds-button_brand slds-float_right", onClick: this.onSubscribe, title: "Subscribe"}, "Subscribe")
      ),
      h("div", {},
        this.model.activeChannels.map((c, i) =>
          h("div", {key: "activeChannel" + i},
            h("span", {}, c),
            h("svg", {onClick: () => { self.onUnsubscribe(i); }, className: "topic-delete-icon"},
              h("use", {xlinkHref: "symbols.svg#delete"})
            )
          )
        )
      )
    );
  }
}
class Publish extends React.Component {
  //TODO just send payload
  render() {
    return h("div", {}, "TODO"
    );
  }
}
class RegisterPushTopic extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.onSetPushTopicName = this.onSetPushTopicName.bind(this);
    this.onSetQuery = this.onSetQuery.bind(this);
    this.onSetNotifyCreate = this.onSetNotifyCreate.bind(this);
    this.onSetNotifyUpdate = this.onSetNotifyUpdate.bind(this);
    this.onSetNotifyUndelete = this.onSetNotifyUndelete.bind(this);
    this.onSetNotifyDelete = this.onSetNotifyDelete.bind(this);
    this.onSetNotifyFields = this.onSetNotifyFields.bind(this);
    this.onCreatePushTopic = this.onCreatePushTopic.bind(this);
    this.state = {
      pushTopicName: "",
      qry: "",
      notifyCreate: false,
      notifyUpdate: false,
      notifyUndelete: false,
      notifyDelete: false,
      notifyFields: false,
    };
  }
  onSetPushTopicName(e) {
    this.setState({pushTopicName: e.target.value});
  }
  onSetQuery(e) {
    this.setState({qry: e.target.value});
  }
  onSetNotifyCreate(e) {
    this.setState({notifyCreate: e.target.value});
  }
  onSetNotifyUpdate(e) {
    this.setState({notifyUpdate: e.target.value});
  }
  onSetNotifyUndelete(e) {
    this.setState({notifyUndelete: e.target.value});
  }
  onSetNotifyDelete(e) {
    this.setState({notifyDelete: e.target.value});
  }
  onSetNotifyFields(e) {
    this.setState({notifyFields: e.target.value});
  }
  onCreatePushTopic(){
    this.model.createPushTopic(this.state.pushTopicName, this.state.qry, this.state.notifyCreate, this.state.notifyUpdate, this.state.notifyUndelete, this.state.notifyDelete, this.state.notifyFields);
  }
  render() {
    return h("div", {},
      h("div", {className: "slds-grid slds-p-horizontal_small slds-p-vertical_small"},
        h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
          h("span", {}, "Push Topic Name")
        ),
        h("div", {className: "slds-form-element__control slds-col slds-size_8-of-12 slds-gutters_small"},
          h("input", {type: "text", className: "slds-input", value: this.state.pushTopicName, onChange: this.onSetPushTopicName}),
        )
      ),
      h("div", {className: "slds-grid slds-p-horizontal_small slds-p-vertical_small"},
        h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
          h("span", {}, "Push Topic Name")
        ),
        h("div", {className: "slds-form-element__control slds-col slds-size_8-of-12 slds-gutters_small"},
          h("textarea", {className: "slds-input", value: this.state.qry, onChange: this.onSetQuery}),
        )
      ),
      h("div", {className: "slds-grid"},
        h("div", {className: "slds-col slds-size_2-of-12 slds-grid slds-p-horizontal_small slds-p-vertical_small"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("span", {className: "slds-form-element__label slds-m-bottom_none"}, "Notify create"),
            h("input", {type: "checkbox", id: "notifyCreate", "aria-describedby": "notifyCreate", className: "slds-input", checked: this.state.notifyCreate, onChange: this.onSetNotifyCreate}),
            h("span", {id: "notifyCreate", className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on"}, "Enabled"),
              h("span", {className: "slds-checkbox_off"}, "Disabled"),
            )
          )
        ),
        h("div", {className: "slds-col slds-size_2-of-12 slds-grid slds-p-horizontal_small slds-p-vertical_small"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("span", {className: "slds-form-element__label slds-m-bottom_none"}, "Notify Update"),
            h("input", {type: "checkbox", id: "notifyUpdate", "aria-describedby": "notifyUpdate", className: "slds-input", checked: this.state.notifyUpdate, onChange: this.onSetNotifyUpdate}),
            h("span", {id: "notifyUpdate", className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on"}, "Enabled"),
              h("span", {className: "slds-checkbox_off"}, "Disabled"),
            )
          )
        ),
        h("div", {className: "slds-col slds-size_2-of-12 slds-grid slds-p-horizontal_small slds-p-vertical_small"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("span", {className: "slds-form-element__label slds-m-bottom_none"}, "Notify Undelete"),
            h("input", {type: "checkbox", id: "notifyUndelete", "aria-describedby": "notifyUndelete", className: "slds-input", checked: this.state.notifyUndelete, onChange: this.onSetNotifyUndelete}),
            h("span", {id: "notifyUndelete", className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on"}, "Enabled"),
              h("span", {className: "slds-checkbox_off"}, "Disabled"),
            )
          )
        ),
        h("div", {className: "slds-col slds-size_2-of-12 slds-grid slds-p-horizontal_small slds-p-vertical_small"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("span", {className: "slds-form-element__label slds-m-bottom_none"}, "Notify Delete"),
            h("input", {type: "checkbox", id: "notifyDelete", "aria-describedby": "notifyDelete", className: "slds-input", checked: this.state.notifyDelete, onChange: this.onSetNotifyDelete}),
            h("span", {id: "notifyDelete", className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on"}, "Enabled"),
              h("span", {className: "slds-checkbox_off"}, "Disabled"),
            )
          )
        ),
        h("div", {className: "slds-col slds-size_2-of-12 slds-grid slds-p-horizontal_small slds-p-vertical_small"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("span", {className: "slds-form-element__label slds-m-bottom_none"}, "Notify Fields"),
            h("input", {type: "checkbox", id: "notifyFields", "aria-describedby": "notifyFields", className: "slds-input", checked: this.state.notifyFields, onChange: this.onSetNotifyFields}),
            h("span", {id: "notifyFields", className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on"}, "Enabled"),
              h("span", {className: "slds-checkbox_off"}, "Disabled"),
            )
          )
        )
      ),
      h("div", {className: "slds-p-horizontal_small"},
        h("button", {className: "slds-button slds-button_brand slds-float_right", onClick: this.onCreatePushTopic, title: "Create Push Topic"}, "Create Push Topic")
      )
    );
  }
}

class RegisterGenericEvent extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
  }
  render() {
    return h("div", {},
      h("a", {hidden: this.eventType != "GenericEvent", href: this.model.sfLink + "/lightning/o/StreamingChannel/list", target: "_blank"}, "Create streaming channel")
    );
  }
}
class RegisterEvent extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.sfLink = this.model.sfLink;
    this.eventType = props.eventType;
    this.channels = props.channels;
    this.entities = props.entities;
    this.channelLabel = null;
    this.channelName = null;
    this.selectedChannel = "";
    this.eventMemberName = null;
    this.selectedEntity = "";
    this.onSelectEntity = this.onSelectEntity.bind(this);
    this.onSetChannelName = this.onSetChannelName.bind(this);
    this.onSetChannelLabel = this.onSetChannelLabel.bind(this);
    this.onCreateChannel = this.onCreateChannel.bind(this);
    this.onCreateChannelMember = this.onCreateChannelMember.bind(this);
    this.onSetEventMemberName = this.onSetEventMemberName.bind(this);
    this.onSelectChannel = this.onSelectChannel.bind(this);
  }
  onSetChannelName(e) {
    //TODO check size, min size, no space
    this.channelName = e.target.value;
  }
  onSetChannelLabel(e) {
    this.channelLabel = e.target.value;
  }
  onCreateChannel() {
    //TODO check before call
    this.model.createChannel(this.channelName, this.channelLabel, this.eventType);
  }
  onCreateChannelMember() {
    //TODO check before call
    this.model.createChannelMember(this.eventMemberName, this.selectedChannelName, this.selectedEntity);
  }
  onSetEventMemberName(e) {
    //TODO check size, min size, no space
    this.eventMemberName = e.target.value;
  }
  onSelectChannel(e) {
    this.selectedChannel = e.target.value;
    this.model.didUpdate();
  }
  onSelectEntity(e) {
    this.selectedEntity = e.target.value;
    this.model.didUpdate();
  }
  render() {
    this.eventType = this.props.eventType;
    this.channels = this.props.channels;
    this.entities = this.props.entities;
    return h("div", {},
      h("h2", {className: "slds-text-title_bold"}, "2. Select Channel"),
      h("select", {className: "slds-combobox__form-element slds-input combobox-container", value: this.selectedChannel, onChange: this.onSelectChannel, title: "Channel"},
        h("option", {value: "", defaultValue: true}, "Create Channel"),
        this.channels.map(t => h("option", {key: t.value, value: t.value}, t.label))
      ),
      h("div", {hidden: this.eventType == "GenericEvent" || this.selectedChannel != ""},
        h("input", {placeholder: "Channel Name", type: "text", value: this.model.channelName, onInput: this.onSetChannelName}),
        h("input", {placeholder: "Channel Label", type: "text", value: this.model.channelLabel, onInput: this.onSetChannelLabel}),
        h("button", {onClick: this.onCreateChannel, title: "Create channel"}, "Create Channel")
      ),
      h("br", {}),
      h("h2", {className: "slds-text-title_bold"}, "3. Create " + (this.eventType == "PlatformEvent" ? "Plateform Event" : "Change Data Capture")),
      h("div", {},
        this.eventType == "PlatformEvent" ? h("a", {href: this.model.sfLink + "/lightning/setup/EventObjects/home", target: "_blank"}, "Create Platform event") : h("a", {href: this.model.sfLink + "/lightning/setup/CdcObjectEnablement/home", target: "_blank"}, "Enable Change Data Capture for entities"),
      ),
      h("br", {}),
      h("h2", {className: "slds-text-title_bold"}, "4. Add Event Channel Member"),
      h("div", {},
        h("select", {className: "slds-combobox__form-element slds-input combobox-container", value: this.selectedEntity, onChange: this.onSelectEntity, title: "Entity"},
          h("option", {value: "", defaultValue: true}, "Create Entity"),
          this.entities.map(t => h("option", {key: t.value, value: t.value}, t.label))
        ),
        h("input", {placeholder: "Event Member Name", type: "text", value: this.model.eventMemberName, onInput: this.onSetEventMemberName}),
        h("button", {onClick: this.onCreateChannelMember, title: "Create channel"}, "Create Channel")
      ),
    );
  }
}

class Register extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.sfLink = this.model.sfLink;
    this.eventTypes = [
      {
        label: "Platform event",
        value: "PlatformEvent"
      },
      {
        label: "Change Data Capture event",
        value: "ChangeDataCaptureEvent"
      },
      {
        label: "PushTopic event",
        value: "PushTopicEvent"
      },
      {
        label: "Generic event",
        value: "GenericEvent"
      }
    ];
    this.eventType = "";
    this.channels = [];
    this.entities = [];
    this.onSelectEventType = this.onSelectEventType.bind(this);
  }
  onSelectEventType(e) {
    this.eventType = e.target.value;
    if (this.eventType == "GenericEvent" || this.eventType == "PushTopicEvent") {
      this.model.didUpdate();
      return;
    }
    this.model.getChannels(this.eventType).then(eventChannels => {
      if (!eventChannels) {
        return;
      }
      this.channels = eventChannels;
      this.model.didUpdate();
    });
    this.model.getEntities(this.eventType).then(eventEntities => {
      if (!eventEntities) {
        return;
      }
      this.entities = eventEntities;
      this.model.didUpdate();
    });
    this.model.didUpdate();
  }

  //TODO handle error on create channel
  render() {
    let EventTypeForm = "";
    switch (this.eventType) {
      case "PushTopicEvent":
        EventTypeForm = h(RegisterPushTopic, {model: this.model});
        break;
      case "GenericEvent":
        EventTypeForm = h(RegisterGenericEvent, {model: this.model});
        break;
      case "PlatformEvent":
      case "ChangeDataCaptureEvent":
        EventTypeForm = h(RegisterEvent, {model: this.model, channels: this.channels, entities: this.entities, eventType: this.eventType});
        break;
      default:
        break;
    }
    return h("div", {},
      h("h2", {className: "slds-text-title_bold"}, "1. Select Type"),
      h("select", {className: "slds-combobox__form-element slds-input combobox-container", value: this.eventType, onChange: this.onSelectEventType, title: "Event Type"},
        h("option", {value: ""}, "types"),
        this.eventTypes.map(t => h("option", {key: t.value, value: t.value}, t.label))
      ),
      EventTypeForm
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }
  onClick(){
    let {model} = this.props;
    if (model && model.tableModel) {
      model.tableModel.onClick();
    }
  }
  componentDidMount() {
    let {model} = this.props;

    function resize() {
      model.didUpdate(); // Will call recalculateSize
    }
    addEventListener("resize", resize);
    resize();
  }
  componentDidUpdate() {
    let {model} = this.props;
    model.recalculateSize();
  }
  render() {
    let model = this.props.model;
    document.title = model.title();
    return (
      h("div", {},
        h("div", {id: "user-info"},
          h("a", {href: model.sfLink, className: "sf-link"},
            h("svg", {viewBox: "0 0 24 24"},
              h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          h("h1", {}, model.title()),
          h("span", {}, " / " + model.userInfo),
          h("div", {className: "flex-right"},
            h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
              h("span", {className: "slds-assistive-text"}),
              h("div", {className: "slds-spinner__dot-a"}),
              h("div", {className: "slds-spinner__dot-b"}),
            ),
          ),
        ),
        h("div", {className: "main-container slds-card slds-m-around_small"},
          h(StreamingTabSelector, {model}))
      )
    );
  }
}


{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model({sfHost, args});
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {
        model
      }), root, cb);
    };
    ReactDOM.render(h(App, {
      model
    }), root);

  });

}
