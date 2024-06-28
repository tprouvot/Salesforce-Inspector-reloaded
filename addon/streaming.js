/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {csvParse} from "./csv-parse.js";
import {DescribeInfo, copyToClipboard, initScrollTable} from "./data-load.js";


const eventTypes = [
  {value: "platformEvent", label: "Platform Event"},
  {value: "changeDataCapture", label: "Change Data Capture"}
];

class Model {

  constructor(sfHost, sessionId, args) {
    this.sfHost = sfHost;
    this.sessionId = sessionId;
    this.importData = undefined;
    this.consecutiveFailures = 0;

    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.userInfo = "...";

    this.eventType = "PlatformEvent";
    this.eventEntity = "";
    this.eventEntities = [];
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
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onEvenTypeChange = this.onEvenTypeChange.bind(this);
    this.onSuscribeToChannel = this.onSuscribeToChannel.bind(this);
  }
  onEvenTypeChange(e) {
    let {model} = this.props;
    model.eventType = e.target.value;
    getPlafformEvents();
    model.didUpdate();

    function getPlafformEvents(){
      let query = "SELECT QualifiedApiName, Label FROM EntityDefinition WHERE isCustomizable = TRUE AND KeyPrefix LIKE 'e%' ORDER BY Label ASC";
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(query))
        .then(respEntity => {
          console.log(respEntity);
          for (let record of respEntity.records) {
            model.eventEntities.push({
              name: record.QualifiedApiName,
              label: record.Label
            })
          }
          console.log(model.eventEntities);
          model.didUpdate();
        }).catch(err => {
            console.error("list entity definitions: ", err);
        });
    }
  }

  onSuscribeToChannel(e) {
    let {model} = this.props;
    //console.log(e.target.value);
    console.log('suscribeToChannel');
    console.log('sfHost');
    console.log(model.sfLink);
    console.log('sessionId');
    console.log(model.sessionId);

    const jsConn = new jsforce.Connection({
      instanceUrl : model.sfLink,
      accessToken : model.sessionId
    });
    console.log(sfConn);

    jsConn.streaming.topic(e.target.value).subscribe(function(message) {
      console.log('Event Type : ' + message.event.type);
      console.log('Event Created : ' + message.event.createdDate);
      console.log('Object Id : ' + message.sobject.Id);
    });

  }

  /*
  componentDidMount() {
    let {model} = this.props;

    addEventListener("resize", () => { this.scrollTable.viewportChange(); });

    this.scrollTable = initScrollTable(this.refs.scroller);
    model.resultTableCallback = this.scrollTable.dataChange;
    model.updateImportTableResult();
  }*/

  /*
  componentDidUpdate() {
    let {model} = this.props;

    // We completely remove the listener when not needed (as opposed to just not setting returnValue in the listener),
    // because having the listener disables BFCache in Firefox (even if the listener does nothing).
    // Chrome does not have a BFCache.
    if (model.isWorking()) {
      if (!this.unloadListener) {
        this.unloadListener = e => {
          // Ask the user for confirmation before leaving
          e.returnValue = "The import will be stopped";
        };
        console.log("added listener");
        addEventListener("beforeunload", this.unloadListener);
      }
    } else if (this.unloadListener) {
      console.log("removed listener");
      removeEventListener("beforeunload", this.unloadListener);
    }
  }*/

  render() {
    let {model} = this.props;
    //console.log(model);
    return h("div", {},
      h("div", {id: "user-info"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
        h("h1", {}, "Data Import"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},
          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          ),
          h("a", {href: "#", id: "help-btn", title: "Import Help", onClick: this.onToggleHelpClick},
            h("div", {className: "icon"})
          ),
        ),
      ),
      h("div", {className: "conf-section"},
        h("div", {className: "conf-subsection"},
          h("div", {className: "area configure-import"},
            h("div", {className: "area-header"},
              h("h1", {}, "Configure Import")
            ),
            h("div", {className: "conf-line"},
              h("label", {className: "conf-input", title: "With the tooling API you can import more metadata, but you cannot import regular data. With the metadata API you can import custom metadata types."},
                h("span", {className: "conf-label"}, "API Type"),
                h("span", {className: "conf-value"},
                  h("select", {value: model.evenType, onChange: this.onEvenTypeChange, /*disabled: model.isWorking()*/},
                    ...eventTypes.map((type, index) => h("option", {key: index, value: type.value}, type.label))
                  )
                )
              )
            ),
            h("div", {className: "conf-line"},
              h("label", {className: "conf-input"},
                h("span", {className: "conf-label"}, "Event"),
                h("span", {className: "conf-value"},
                  h("span", model.eventEntities),
                  h("select", {value: model.eventEntity, onChange:this.onSuscribeToChannel, /*disabled: model.isWorking()*/},
                      ...model.eventEntities.map((entity, index) => h("option", {key: index, value: entity.value}, entity.label))
                  )
                )
              )
            ),
          ),
        ),
        h("div", {className: "conf-subsection columns-mapping"},
          h("div", {className: "area"},
            h("div", {className: "area-header"},
              h("h1", {}, "Field Mapping")
            )
          )
        )
      ),
      h("div", {className: "area import-actions"},
        h("div", {hidden: !model.showHelp, className: "help-text"},
          h("h3", {}, "Import Help"),
          h("p", {}, "Use for quick one-off data imports."),
          h("ul", {},
            h("li", {}, "Enter your CSV or Excel data in the box above.",
              h("ul", {},
                h("li", {}, "The input must contain a header row with field API names."),
                h("li", {}, "To use an external ID for a lookup field, the header row should contain the lookup relation name, the target sobject name and the external ID name separated by colons, e.g. \"MyLookupField__r:MyObject__c:MyExternalIdField__c\"."),
                h("li", {}, "Empty cells insert null values."),
                h("li", {}, "Number, date, time and checkbox values must conform to the relevant ", h("a", {href: "http://www.w3.org/TR/xmlschema-2/#built-in-primitive-datatypes", target: "_blank"}, "XSD datatypes"), "."),
                h("li", {}, "Columns starting with an underscore are ignored."),
                h("li", {}, "You can resume a previous import by including the \"__Status\" column in your input."),
                h("li", {}, "You can supply the other import options by clicking \"Copy options\" and pasting the options into Excel in the top left cell, just above the header row.")
              )
            ),
            h("li", {}, "Select your input format"),
            h("li", {}, "Select an action (insert, update, upsert or delete)"),
            h("li", {}, "Enter the API name of the object to import"),
            h("li", {}, "Press the Run button")
          ),
          h("p", {}, "Bulk API is not supported. Large data volumes may freeze or crash your browser.")
        ),
      ),

      h("div", {className: "area result-area"},
        h("div", {id: "result-table", ref: "scroller"}),
        model.confirmPopup ? h("div", {},
          h("div", {id: "confirm-background"},
            h("div", {id: "confirm-dialog"},
              h("h1", {}, "Import"),
              h("p", {}, "You are about to modify your data in Salesforce. This action cannot be undone."),
              h("p", {}, model.confirmPopup.text),
              h("div", {className: "dialog-buttons"},
                h("button", {onClick: this.onConfirmPopupYesClick}, model.importActionName),
                h("button", {onClick: this.onConfirmPopupNoClick, className: "cancel-btn"}, "Cancel")
              )
            )
          )
        ) : null
      )
    );
  }
}

class ColumnMapper extends React.Component {
  constructor(props) {
    super(props);
    this.onColumnValueChange = this.onColumnValueChange.bind(this);
    this.onColumnSkipClick = this.onColumnSkipClick.bind(this);
  }
  onColumnValueChange(e) {
    let {model, column} = this.props;
    column.columnValue = e.target.value;
    model.didUpdate();
  }
  onColumnSkipClick(e) {
    let {model, column} = this.props;
    e.preventDefault();
    column.columnSkip();
    model.didUpdate();
  }
  render() {
    let {model, column} = this.props;
    return h("div", {className: "conf-line"},
      h("label", {htmlFor: "col-" + column.columnIndex}, column.columnOriginalValue),
      h("div", {className: "flex-wrapper"},
        h("input", {type: "search", list: "columnlist", value: column.columnValue, onChange: this.onColumnValueChange, className: column.columnError() ? "confError" : "", disabled: model.isWorking(), id: "col-" + column.columnIndex}),
        h("div", {className: "conf-error", hidden: !column.columnError()}, h("span", {}, column.columnError()), " ", h("button", {onClick: this.onColumnSkipClick, hidden: model.isWorking(), title: "Don't import this column"}, "Skip"))
      )
    );
  }
}

class StatusBox extends React.Component {
  constructor(props) {
    super(props);
    this.onShowStatusChange = this.onShowStatusChange.bind(this);
  }
  onShowStatusChange(e) {
    let {model, name} = this.props;
    model.showStatus[name] = e.target.checked;
    model.updateImportTableResult();
    model.didUpdate();
  }
  render() {
    let {model, name} = this.props;
    return h("label", {className: model.importCounts()[name] == 0 ? "statusGroupEmpty" : ""}, h("input", {type: "checkbox", checked: model.showStatus[name], onChange: this.onShowStatusChange}), " " + model.importCounts()[name] + " " + name);
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
