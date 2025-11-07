/* global React ReactDOM */
import { sfConn, apiVersion } from "./inspector.js";
/* global initButton */
import { copyToClipboard, initScrollTable } from "./data-load.js";
import { PageHeader } from "./components/PageHeader.js";

class QueryHistory {
  constructor(storageKey, max) {
    this.storageKey = storageKey;
    this.max = max;
    this.list = this._get();
  }

  _get() {
    let history;
    try {
      history = JSON.parse(localStorage[this.storageKey]);
    } catch (e) {
      // empty
    }
    if (!Array.isArray(history)) {
      history = [];
    }
    // A previous version stored just strings. Skip entries from that to avoid errors.
    history = history.filter(e => typeof e == "object");
    this.sort(this.storageKey, history);
    return history;
  }

  add(entry) {
    let history = this._get();
    let historyIndex = history.findIndex(e => e.endpoint == entry.endpoint);
    if (historyIndex > -1) {
      history.splice(historyIndex, 1);
    }
    history.splice(0, 0, entry);
    if (history.length > this.max) {
      history.pop();
    }
    localStorage[this.storageKey] = JSON.stringify(history);
    this.sort(this.storageKey, history);
  }

  remove(entry) {
    let history = this._get();
    let historyIndex = history.findIndex(e => e.endpoint == entry.endpoint);
    if (historyIndex > -1) {
      history.splice(historyIndex, 1);
    }
    localStorage[this.storageKey] = JSON.stringify(history);
    this.sort(this.storageKey, history);
  }

  clear() {
    localStorage.removeItem(this.storageKey);
    this.list = [];
  }

  sort(storageKey, history) {
    if (storageKey === "restSavedQueryHistory") {
      history.sort((a, b) => (a.endpoint > b.endpoint) ? 1 : ((b.endpoint > a.endpoint) ? -1 : 0));
    }
    this.list = history;
  }
}

class Model {
  constructor({ sfHost, args }) {
    this.sfHost = sfHost;
    this.apiUrls = null;
    this.initialEndpoint = "";
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.userInfo = "...";
    this.userFullName = "";
    this.userName = "";
    this.orgName = "";
    this.userInitials = "";
    this.winInnerHeight = 0;
    this.autocompleteResults = { sobjectName: "", title: "\u00A0", results: [] };
    this.autocompleteClick = null;
    this.isWorking = false;
    this.exportStatus = "";
    this.exportError = null;
    this.exportedData = null;
    this.queryHistory = new QueryHistory("restQueryHistory", 100);
    this.selectedHistoryEntry = null;
    this.savedHistory = new QueryHistory("restSavedQueryHistory", 50);
    this.selectedSavedEntry = null;
    this.expandSavedOptions = false;
    this.startTime = null;
    this.totalTime = 0;
    this.autocompleteState = "";
    this.autocompleteProgress = {};
    this.exportProgress = {};
    this.queryName = "";
    this.apiResponse = null;
    this.canSendRequest = true;
    this.resultClass = "neutral";
    this.request = { endpoint: "", method: "get", body: "" };
    this.apiList;
    this.filteredApiList;
    this.requestTemplates = localStorage.getItem("requestTemplates") ? this.requestTemplates = localStorage.getItem("requestTemplates").split("//") : [
      { key: "getLimit", endpoint: `/services/data/v${apiVersion}/limits`, method: "GET", body: "" },
      { key: "executeApex", endpoint: `/services/data/v${apiVersion}/tooling/executeAnonymous/?anonymousBody=System.debug(LoggingLevel.INFO, 'Executing apex example');`, method: "GET", body: "" },
      { key: "getAccount", endpoint: `/services/data/v${apiVersion}/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+1`, method: "GET", body: "" },
      { key: "createAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/`, method: "POST", body: '{  \n"Name" : "SFIR",\n"Industry" : "Chrome Extension"\n}' },
      { key: "updateAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "PATCH", body: '{  \n"Name" : "SFIR Updated"\n}' },
      { key: "deleteccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "DELETE", body: "" }
    ];
    this.selectedTemplate = "";

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

    if (args.has("endpoint") && args.has("method")) {
      this.request.endpoint = args.get("endpoint");
      this.request.method = args.get("method");
    } else if (this.queryHistory.list[0]) {
      this.request = this.queryHistory.list[0];
      this.didUpdate();
    } else {
      this.request = this.requestTemplates[0];
    }

    this.spinFor(sfConn.rest(`/services/data/v${apiVersion}/`, {})
      .catch(err => {
        if (err.name != "AbortError") {
          this.autocompleteResults = {
            title: "Error: " + err.message,
            results: []
          };
        }
        return null;
      })
      .then((result) => {
        this.apiList = Object.keys(result)
          .map(key => ({
            key,
            "endpoint": result[key]
          }))
          .sort((a, b) => a.key.localeCompare(b.key));
      }));

    if (args.has("error")) {
      this.exportError = args.get("error") + " " + args.get("error_description");
    }
  }
  updatedExportedData() {
    this.resultTableCallback(this.exportedData);
  }
  setQueryName(value) {
    this.queryName = value;
  }
  toggleSavedOptions() {
    this.expandSavedOptions = !this.expandSavedOptions;
  }
  showDescribeUrl() {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", this.autocompleteResults.sobjectName);
    return "inspect.html?" + args;
  }
  clearHistory() {
    this.queryHistory.clear();
  }
  copyAsJson() {
    copyToClipboard(this.apiResponse.value, null, "  ");
  }
  clear() {
    this.apiResponse.value = "";
  }
  selectSavedEntry() {
    let delimiter = ":";
    if (this.selectedSavedEntry != null) {
      let queryStr = "";
      if (this.selectedSavedEntry.query.includes(delimiter)) {
        let query = this.selectedSavedEntry.query.split(delimiter);
        this.queryName = query[0];
        queryStr = this.selectedSavedEntry.query.substring(this.selectedSavedEntry.query.indexOf(delimiter) + 1);
      } else {
        queryStr = this.selectedSavedEntry.query;
      }
      this.request.endpoint = queryStr;
      this.queryAutocompleteHandler();
      this.selectedSavedEntry = null;
    }
  }
  clearSavedHistory() {
    this.savedHistory.clear();
  }
  addToHistory() {
    this.request.key = Date.now();
    this.request.label = this.queryName ? this.queryName : "";
    this.savedHistory.add(this.request);
  }
  removeFromHistory() {
    this.savedHistory.remove(this.request);
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

  doSend() {
    this.startTime = performance.now();
    this.canSendRequest = false;
    let api = this.request.endpoint.startsWith("/services/async/") ? "bulk" : "normal";
    let responseType = this.request.endpoint.startsWith("/services/async/") ? "xml" : "json";
    this.request.method = this.request.method.toUpperCase();
    this.spinFor(sfConn.rest(this.request.endpoint, { method: this.request.method, api, responseType, body: this.request.body, bodyType: "raw", progressHandler: this.autocompleteProgress, useCache: false }, true)
      .catch(err => {
        this.canSendRequest = true;
        this.totalTime = performance.now() - this.startTime;
        if (err.name != "AbortError") {
          this.autocompleteResults = {
            title: "Error: " + err.message,
            results: []
          };
        }
        return null;
      })
      .then((result) => {
        //generate key with timestamp
        this.totalTime = performance.now() - this.startTime;
        this.request.key = Date.now();
        this.queryHistory.add(this.request);
        if (!result) {
          model.didUpdate();
          return;
        }
        this.parseResponse(result, "Success");
        this.canSendRequest = true;
      }));
  }

  parseResponse(result, status) {

    this.resultClass = result.status < 300 ? "success" : result.status > 399 ? "error" : "";
    let format = result.responseType.length > 0 ? result.responseType : "xml";
    this.apiResponse = {
      status,
      code: result.status,
      format,
      value: result.response ? this.formatResponse(result.response, format) : "NONE"
    };
    if (this.resultClass === "success") {
      let newApis = Object.keys(result.response)
        .filter(key => typeof result.response[key] == "string" && result.response[key].startsWith("/services/data/"))
        .map(key => ({
          key,
          "endpoint": result.response[key]
        }));
      newApis.forEach(api => {
        if (!this.apiList.some(existingApi => existingApi.key === api.key)) {
          this.apiList.push(api);
        }
      });
      this.filteredApiList = this.apiList.filter(api => api.endpoint.toLowerCase().includes(this.request.endpoint.toLowerCase()));
    }
  }

  formatResponse(resp, format) {
    if (format === "xml") {
      return this.formatXml(resp);
    } else {
      return JSON.stringify(resp, null, "    ");
    }
  }

  formatXml(sourceXml) {
    let xmlDoc = new DOMParser().parseFromString(sourceXml, "application/xml");
    let xsltDoc = new DOMParser().parseFromString([
      '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
      '  <xsl:strip-space elements="*"/>',
      '  <xsl:template match="para[content-style][not(text())]">',
      '    <xsl:value-of select="normalize-space(.)"/>',
      "  </xsl:template>",
      '  <xsl:template match="node()|@*">',
      '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
      "  </xsl:template>",
      '  <xsl:output indent="yes"/>',
      "</xsl:stylesheet>",
    ].join("\n"), "application/xml");

    let xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    let resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    let resultXml = new XMLSerializer().serializeToString(resultDoc);
    return resultXml;
  };
}


let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onSelectHistoryEntry = this.onSelectHistoryEntry.bind(this);
    this.onSelectRequestTemplate = this.onSelectRequestTemplate.bind(this);
    this.onSelectQueryMethod = this.onSelectQueryMethod.bind(this);
    this.onClearHistory = this.onClearHistory.bind(this);
    this.onSelectSavedEntry = this.onSelectSavedEntry.bind(this);
    this.onAddToHistory = this.onAddToHistory.bind(this);
    this.onRemoveFromHistory = this.onRemoveFromHistory.bind(this);
    this.onClearSavedHistory = this.onClearSavedHistory.bind(this);
    this.onToggleSavedOptions = this.onToggleSavedOptions.bind(this);
    this.onSend = this.onSend.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onClearResponse = this.onClearResponse.bind(this);
    this.onUpdateBody = this.onUpdateBody.bind(this);
    this.onSetQueryName = this.onSetQueryName.bind(this);
    this.onSetEndpoint = this.onSetEndpoint.bind(this);
  }
  onSelectEntry(e, list) {
    let { model } = this.props;
    model.request = list.filter(template => template.key.toString() === e.target.value)[0];
    this.refs.endpoint.value = model.request.endpoint;
    this.resetRequest(model);
    model.didUpdate();
  }
  onSelectHistoryEntry(e) {
    let { model } = this.props;
    this.onSelectEntry(e, model.queryHistory.list);
  }
  onSelectRequestTemplate(e) {
    let { model } = this.props;
    this.onSelectEntry(e, model.requestTemplates);
  }
  onSelectSavedEntry(e) {
    let { model } = this.props;
    this.onSelectEntry(e, model.savedHistory.list);
  }
  resetRequest(model) {
    model.apiResponse = "";
    model.didUpdate();
  }
  onSelectQueryMethod(e) {
    let { model } = this.props;
    model.request.method = e.target.value;
    this.canSendRequest();
    model.didUpdate();
  }
  onClearHistory(e) {
    e.preventDefault();
    let r = confirm("Are you sure you want to clear the query history?");
    if (r == true) {
      let { model } = this.props;
      model.clearHistory();
      model.didUpdate();
    }
  }
  onAddToHistory(e) {
    e.preventDefault();
    let { model } = this.props;
    model.addToHistory();
    model.didUpdate();
  }
  onRemoveFromHistory(e) {
    e.preventDefault();
    let r = confirm("Are you sure you want to remove this saved query?");
    let { model } = this.props;
    if (r == true) {
      model.removeFromHistory();
    }
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onClearSavedHistory(e) {
    e.preventDefault();
    let r = confirm("Are you sure you want to remove all saved queries?");
    let { model } = this.props;
    if (r == true) {
      model.clearSavedHistory();
    }
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onToggleSavedOptions(e) {
    e.preventDefault();
    let { model } = this.props;
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onSend() {
    let { model } = this.props;
    model.doSend();
    model.didUpdate();
  }
  onCopyAsJson() {
    let { model } = this.props;
    model.copyAsJson();
    model.didUpdate();
  }
  onClearResponse() {
    let { model } = this.props;
    model.clear();
    model.didUpdate();
  }
  onUpdateBody(e) {
    let { model } = this.props;
    model.request.body = e.target.value;
    this.canSendRequest();
    model.didUpdate();
  }
  onSetQueryName(e) {
    let { model } = this.props;
    model.setQueryName(e.target.value);
    model.didUpdate();
  }
  onSetEndpoint(e) {
    let { model } = this.props;
    model.request.endpoint = e.target.value;
    //replace current endpoint with latest on the have the autocomplete works for all api versions
    let updatedApiEndpoint = e.target.value.replace(/\/data\/v\d+\.0\//, `/data/v${apiVersion}/`);
    model.filteredApiList = model.apiList.filter(api => api.endpoint.toLowerCase().includes(updatedApiEndpoint.toLowerCase()));
    model.didUpdate();
  }
  componentDidMount() {
    let { model } = this.props;
    let endpointInput = this.refs.endpoint;
    endpointInput.value = model.request.endpoint;

    addEventListener("keydown", e => {
      if ((e.ctrlKey && e.key == "Enter") || e.key == "F5") {
        e.preventDefault();
        model.doSend();
        model.didUpdate();
      }
    });

    this.scrollTable = initScrollTable(this.refs.scroller);
    model.resultTableCallback = this.scrollTable.dataChange;

    let recalculateHeight = this.recalculateSize.bind(this);
    if (!window.webkitURL) {
      // Firefox
      // Firefox does not fire a resize event. The next best thing is to listen to when the browser changes the style.height attribute.
      new MutationObserver(recalculateHeight).observe(endpointInput, { attributes: true });
    } else {
      // Chrome
      // Chrome does not fire a resize event and does not allow us to get notified when the browser changes the style.height attribute.
      // Instead we listen to a few events which are often fired at the same time.
      // This is not required in Firefox, and Mozilla reviewers don't like it for performance reasons, so we only do this in Chrome via browser detection.
      endpointInput.addEventListener("mousemove", recalculateHeight);
      addEventListener("mouseup", recalculateHeight);
    }
    function resize() {
      model.winInnerHeight = innerHeight;
      model.didUpdate(); // Will call recalculateSize
    }
    addEventListener("resize", resize);
    resize();
  }
  componentDidUpdate() {
    this.recalculateSize();
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }
  canSendRequest() {
    let { model } = this.props;
    model.canSendRequest = model.request.method === "GET" || model.request.body.length > 1;
  }
  autocompleteClick(value) {
    let { model } = this.props;
    model.request.method = "GET";
    this.refs.endpoint.value = value.endpoint;
    model.request.endpoint = value.endpoint;
    model.request.body = "";
    model.filteredApiList = [];
    model.didUpdate();
  }
  recalculateSize() {
    //TODO
    // Investigate if we can use the IntersectionObserver API here instead, once it is available.
    //this.scrollTable.viewportChange();
  }
  toggleQueryMoreMenu(event) {
    this.refs.buttonQueryMenu?.classList.toggle("slds-is-open");
  }
  render() {
    let { model } = this.props;
    return h("div", {},
      h(PageHeader, {
        pageTitle: "REST Explorer",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        userInitials: model.userInitials,
        userFullName: model.userFullName,
        userName: model.userName
      }),
      h(
        "div",
        {
          className: "slds-m-top_xx-large sfir-page-container"
        },
        // Request card (not flexible)
        h("div", { className: "slds-card slds-m-around_medium" },
          h("div", { className: "slds-card__body slds-card__body_inner" },
            h("div", { className: "slds-card__header slds-grid slds-grid_vertical-align-center" },
              h("header", { className: "slds-media slds-media_center slds-has-flexi-truncate" },
                h("div", { className: "slds-media__body" },
                  h("h3", { className: " slds-card__header-title" }, "Request"),
                ),
                h("div", {},
                  h("div", { className: "slds-form-element__control" },
                    h("div", { className: "slds-grid slds-grid_align-end" },
                      h("div", { className: "slds-size_1-of-6" },),
                      h("div", { className: "slds-size-1-of-6 slds-p-horizontal_xx-small" },
                        h("div", { className: "slds-form-element__control" },
                          h("select", { value: model.selectedTemplate, onChange: this.onSelectRequestTemplate, className: "slds-select", title: "Check documentation to customize templates" },
                            h("option", { value: null, disabled: true, defaultValue: true, hidden: true }, "Templates"),
                            model.requestTemplates.map(req => h("option", { key: req.key, value: req.key }, req.method + " " + req.endpoint))
                          ),
                        )
                      ),
                      h("div", { className: "slds-size_1-of-6 slds-p-horizontal_xx-small" },
                        h("div", { className: "slds-form-element__control" },
                          h("select", { value: JSON.stringify(model.selectedHistoryEntry), onChange: this.onSelectHistoryEntry, className: "slds-select" },
                            h("option", { value: JSON.stringify(null), disabled: true }, "History"),
                            model.queryHistory.list.map(q => h("option", { key: JSON.stringify(q), value: q.key }, q.method + " " + q.endpoint))
                          ),
                        )
                      ),
                      h("div", { className: "slds-col slds-p-horizontal_xx-small slds-p-horizontal_xx-small slds-m-right_large" },
                        h("div", { className: "slds-form-element__control" },
                          h("button", { className: "slds-button slds-button_neutral", onClick: this.onClearHistory, title: "Clear Request History" }, "Clear")
                        )
                      ),
                      h("div", { className: "slds-size_1-of-6 slds-p-horizontal_xx-small" },
                        h("div", { className: "slds-form-element__control" },
                          h("select", { value: JSON.stringify(model.selectedSavedEntry), onChange: this.onSelectSavedEntry, className: "slds-select" },
                            h("option", { value: JSON.stringify(null), disabled: true }, "Saved"),
                            model.savedHistory.list.map(q => h("option", { key: JSON.stringify(q), value: q.key }, q.label + " " + q.method + " " + q.endpoint))
                          ),
                        )
                      ),
                      h("div", { className: "slds-size_1-of-6 slds-p-horizontal_xx-small" },
                        h("div", { className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left" },
                          h("svg", { className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default", "aria-hidden": "true" },
                            h("use", { xlinkHref: "symbols.svg#save" })
                          ),
                          h("input", { className: "slds-input", placeholder: "Query Label", value: model.queryName, onInput: this.onSetQueryName })
                        )
                      ),
                      h("div", { className: "slds-col slds-p-left_xx-small" },
                        h("div", { className: "slds-button-group", role: "group" },
                          h("button", {
                            className: "slds-button slds-button_neutral",
                            onClick: this.onAddToHistory,
                            style: { whiteSpace: "nowrap" }
                          }, "Save Query"),
                          h("div", { ref: "buttonQueryMenu", className: "slds-dropdown-trigger slds-dropdown-trigger_click slds-button_last", onClick: (event) => event.currentTarget.classList.toggle("slds-is-open") },
                            h("button", { className: "slds-button slds-button_icon slds-button_icon-border-filled" },
                              h("svg", { className: "slds-button__icon", "aria-hidden": "true" },
                                h("use", { xlinkHref: "symbols.svg#down" })
                              )
                            ),
                            h("div", { className: "slds-dropdown slds-dropdown_right slds-dropdown_actions" },
                              h("ul", { className: "slds-dropdown__list", role: "menu" },
                                h("li", { className: "slds-dropdown__item", role: "presentation" },
                                  h("a", { href: "#", role: "menuitem", tabIndex: "0", target: "_blank", },
                                    h("span", { onClick: this.onRemoveFromHistory, title: "Remove query from saved history" }, "Remove Saved Query")
                                  )
                                ),
                                h("li", { className: "slds-dropdown__item", role: "presentation" },
                                  h("a", { href: "#", role: "menuitem", tabIndex: "0", target: "_blank", },
                                    h("span", { onClick: this.onClearSavedHistory, title: "Clear Saved Queries" }, "Clear Saved Queries")
                                  )
                                ),
                              )
                            )
                          )
                        )
                      )
                    )
                  ),
                )
                /*
                h("fieldset", { className: "slds-form-element slds-form-element_compound" },
                  h("div", { className: "slds-form-element__control" },
                    h("div", { className: "slds-form-element__row slds-grid_align-end" },
                      h("div", { className: "slds-size_4-of-12" },
                        h("div", { className: "slds-grid" },
                          h("div", { className: "slds-col" },
                            h("div", { className: "slds-form-element" },
                              
                            )
                          ),
                          h("div", { className: "slds-col" },
                            h("div", { className: "slds-form-element" },
                              
                            )
                          ),
                          h("div", { className: "slds-col" },
                            h("div", { className: "slds-form-element" },
                              h("div", { className: "slds-form-element__control" },
                                h("button", { className: "slds-button slds-button_neutral", onClick: this.onClearHistory, title: "Clear Request History" }, "Clear")
                              )
                            )
                          )
                        )
                      ),
                      
                      ),
                    )
                  )
                )*/
              )
            ),
            h("div", { className: "slds-card__body slds-card__body_inner" },
              h("div", { className: "slds-grid slds-grid_align-spread slds-grid_vertical-align-center" },
                h("div", { className: "slds-size_1-of-12 slds-p-right_xx-small" },
                  h("div", { className: "slds-form-element" },
                    h("div", { className: "slds-form-element__control" },
                      h("div", { className: "slds-select_container" },
                        h("select", { className: "slds-select", value: model.request.method, onChange: this.onSelectQueryMethod },
                          h("option", { key: "get", value: "GET" }, "GET"),
                          h("option", { key: "post", value: "POST" }, "POST"),
                          h("option", { key: "put", value: "PUT" }, "PUT"),
                          h("option", { key: "patch", value: "PATCH" }, "PATCH"),
                          h("option", { key: "delete", value: "DELETE" }, "DELETE")
                        )
                      )
                    )
                  )
                ),
                h("div", { className: "slds-col sfir-full-width slds-p-horizontal_xx-small" },
                  h("input", { ref: "endpoint", className: "slds-input", type: "default", placeholder: "/services/data/v" + apiVersion, onChange: this.onSetEndpoint })
                ),
                h("div", { className: "slds-col slds-text-align_right slds-p-left_xx-small" },
                  h("button", { tabIndex: 1, disabled: !model.canSendRequest, onClick: this.onSend, title: "Ctrl+Enter / F5", className: "slds-button slds-button_brand" }, "Send")
                ),
              ),
              h("div", { className: "slds-m-top_medium" },
                model.filteredApiList?.length > 0
                  ? model.filteredApiList.map(r =>
                    h("span", { className: "slds-pill slds-pill_link slds-m-vertical_xxx-small", key: r.key },
                      h("span", { className: "slds-pill__icon_container" },
                        h("span", { className: "slds-avatar slds-avatar_circle" },
                          h("svg", { className: "slds-button__icon", "aria-hidden": "true" },
                            h("use", { xlinkHref: "symbols.svg#link" })
                          ),
                        )
                      ),
                      h("a", {
                        href: "#",
                        className: "slds-pill__action",
                        onClick: e => { e.preventDefault(); this.autocompleteClick(r); model.didUpdate(); }
                      },
                        h("span", { className: "slds-pill__label" }, r.key)
                      ),
                    ),
                  ) : null
              ),
              h("div", { className: "slds-m-top_medium" },
                h("h3", { className: "slds-text-heading_small" }, "Request Body"),
                h("div", { className: "slds-m-top_small" },
                  h("textarea", { className: "slds-textarea", rows: 6, value: model.request.body, onChange: this.onUpdateBody })
                )
              )
            )
          )
        ),
        // Response card (flexible, fills remaining space)
        h(
          "div",
          {
            className: "slds-card slds-m-around_medium",
            style: {
              flex: "1 1 0",
              minHeight: 0,
              display: "flex",
              flexDirection: "column"
            }
          },
          h("div", { className: "slds-card__header" },
            h("div", { className: "slds-grid slds-grid_vertical-align-center slds-grid_align-spread slds-p-around_small" },
              h("div", { className: "slds-size_8-of-12" },
                h("span", { className: "slds-text-heading_small slds-m-right_small" }, "Response"),
                h("button", { className: "slds-button slds-button_neutral", disabled: !model.apiResponse, onClick: this.onCopyAsJson, title: "Copy raw API output to clipboard" }, "Copy"),
              ),
              h("div", { className: "slds-size_4-of-12 slds-text-align_right" },
                h("span", {},
                  model.apiResponse && h("div", {},
                    h("span", { className: "slds-m-right_small" }, model.totalTime.toFixed(1) + "ms"),
                    h("span", { className: "slds-m-right_small slds-badge slds-theme_" + model.resultClass }, "Status: " + model.apiResponse?.code),
                    h("button", { className: "slds-button slds-button_neutral", disabled: !model.apiResponse, onClick: this.onClearResponse, title: "Clear Response" }, "Clear")
                  ),
                )
              ),
            )
          ),
          h(
            "div",
            {
              className: "slds-card__body slds-card__body_inner",
              ref: "scroller",
              hidden: model.exportError != null,
              style: {
                flex: "1 1 0",
                minHeight: 0,
                maxHeight: "100%",
                overflowY: "auto"
              }
            },
            model.apiResponse && h("div", {},
              h("pre", { className: "reset-margin", style: { margin: 0 } },
                h("code", { className: "language-" + model.apiResponse.format }, model.apiResponse.value)
              )
            )
          )
        )
      )
    );
  }
}

{

  let args = new URLSearchParams(location.search);
  let sfHost = args.get("host");
  let hash = new URLSearchParams(location.hash); //User-agent OAuth flow
  if (!sfHost && hash) {
    sfHost = decodeURIComponent(hash.get("instance_url")).replace(/^https?:\/\//i, "");
  }
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model({ sfHost, args });
    model.reactCallback = cb => {
      ReactDOM.render(h(App, { model }), root, cb);
    };
    ReactDOM.render(h(App, { model }), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({ model, sfConn });
    }
  });

}
