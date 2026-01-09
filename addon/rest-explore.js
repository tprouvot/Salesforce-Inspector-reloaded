/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {initScrollTable} from "./data-load.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, createSpinForMethod, copyToClipboard, isOptionEnabled} from "./utils.js";

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
  constructor({sfHost, args}) {
    this.sfHost = sfHost;
    this.apiUrls = null;
    this.initialEndpoint = "";
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.orgName = "";
    this.winInnerHeight = 0;
    this.autocompleteResults = {sobjectName: "", title: "\u00A0", results: []};
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
    this.request = {endpoint: "", method: "get", body: "", headers: ""};
    this.showHeadersEditor = false;
    this.apiList;
    this.filteredApiList;
    this.displayOptions = JSON.parse(localStorage.getItem("restExploreDisplayOptions") || "[]");
    this.requestTemplates = localStorage.getItem("requestTemplates") ? this.requestTemplates = localStorage.getItem("requestTemplates").split("//") : [
      {key: "getLimit", endpoint: `/services/data/v${apiVersion}/limits`, method: "GET", body: ""},
      {key: "executeApex", endpoint: `/services/data/v${apiVersion}/tooling/executeAnonymous/?anonymousBody=System.debug(LoggingLevel.INFO, 'Executing apex example');`, method: "GET", body: ""},
      {key: "getAccount", endpoint: `/services/data/v${apiVersion}/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+1`, method: "GET", body: ""},
      {key: "createAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/`, method: "POST", body: '{  \n"Name" : "SFIR",\n"Industry" : "Chrome Extension"\n}'},
      {key: "updateAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "PATCH", body: '{  \n"Name" : "SFIR Updated"\n}'},
      {key: "deleteccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "DELETE", body: ""}
    ];
    this.selectedTemplate = "";

    // Initialize spinFor method
    this.spinFor = createSpinForMethod(this);

    // Initialize user info model - handles all user-related properties
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    // Set orgName from sfHost
    this.orgName = this.sfHost.split(".")[0]?.toUpperCase() || "";

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
  toggleHeadersEditor() {
    this.showHeadersEditor = !this.showHeadersEditor;
    if (this.showHeadersEditor && !this.request.headers) {
      // Pre-populate with default headers when first opened
      this.request.headers = this.getDefaultHeaders();
    }
  }
  getDefaultHeaders() {
    // Get default headers that can be edited
    // Note: Authorization/X-SFDC-Session headers are set automatically based on API type
    const headers = [];
    headers.push("Accept: application/json; charset=UTF-8");
    if (this.request.body && this.request.body.length > 0) {
      headers.push("Content-Type: application/json; charset=UTF-8");
    }
    return headers.join("\n");
  }
  parseHeaders(headersText) {
    const headers = {};
    if (!headersText || !headersText.trim()) {
      return headers;
    }
    const lines = headersText.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;
      const name = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();
      if (name && value) {
        headers[name] = value;
      }
    }
    return headers;
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

  doSend() {
    const shouldCalculateDuration = isOptionEnabled("responseDuration", this.displayOptions);
    if (shouldCalculateDuration) {
      this.startTime = performance.now();
    }
    this.canSendRequest = false;
    let api = this.request.endpoint.startsWith("/services/async/") ? "bulk" : "normal";
    // Use empty string for responseType to allow access to responseText
    // This enables dynamic format detection based on Content-Type header
    let responseType = this.request.endpoint.startsWith("/services/async/") ? "xml" : "";
    this.request.method = this.request.method.toUpperCase();
    const customHeaders = this.parseHeaders(this.request.headers);
    this.spinFor(sfConn.rest(this.request.endpoint, {method: this.request.method, api, responseType, body: this.request.body, bodyType: "raw", headers: customHeaders, progressHandler: this.autocompleteProgress, useCache: false}, true)
      .catch(err => {
        this.canSendRequest = true;
        if (shouldCalculateDuration) {
          this.totalTime = performance.now() - this.startTime;
        }
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
        if (shouldCalculateDuration) {
          this.totalTime = performance.now() - this.startTime;
        }
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

  getFormatFromContentType(result) {
    const contentType = result.getResponseHeader ? result.getResponseHeader("Content-Type") : "";

    // Check if endpoint is ApexLog Body
    if (this.request.endpoint && this.request.endpoint.includes("ApexLog") && this.request.endpoint.includes("Body")) {
      return "log";
    }
    if (!contentType) {
      return result.responseType || "json";
    }
    if (contentType.includes("xml")) {
      return "xml";
    }
    if (contentType.includes("csv")) {
      return "csv";
    }
    if (contentType.includes("text/")) {
      return "text";
    }
    if (contentType.includes("application/json")) {
      return "json";
    }
    return result.responseType || "json";
  }

  getResponseText(result) {
    // When responseType is "json", response contains parsed object (or null), can't access responseText
    if (result.responseType === "json" && result.response !== null && result.response !== undefined) {
      return null; // Already parsed
    }
    // For other responseTypes, get raw text
    return result.responseText || result.response || "";
  }

  parseResponse(result, status) {
    this.resultClass = result.status < 300 ? "success" : result.status > 399 ? "error" : "";

    const format = this.getFormatFromContentType(result);
    const responseText = this.getResponseText(result);
    let responseData = null;
    const shouldCalculateSize = isOptionEnabled("responseSize", this.displayOptions);
    let responseSize = 0;

    if (responseText === null) {
      // Already parsed (responseType was "json")
      responseData = result.response;
      // Calculate size from stringified JSON only if option is enabled
      if (shouldCalculateSize && responseData !== null && responseData !== undefined) {
        responseSize = new Blob([JSON.stringify(responseData)]).size;
      }
    } else if (responseText) {
      // Calculate size from raw response text only if option is enabled
      if (shouldCalculateSize) {
        responseSize = new Blob([responseText]).size;
      }
      // Parse based on format
      if (format === "json") {
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Not valid JSON, treat as text or log
          responseData = responseText;
          const fallbackFormat = (this.request.endpoint && this.request.endpoint.includes("ApexLog") && this.request.endpoint.includes("Body")) ? "log" : "text";
          this.apiResponse = {
            status,
            code: result.status,
            format: fallbackFormat,
            value: this.formatResponse(responseText, fallbackFormat),
            size: responseSize
          };
          return;
        }
      } else {
        responseData = responseText;
      }
    }

    this.apiResponse = {
      status,
      code: result.status,
      format,
      value: responseData ? this.formatResponse(responseData, format) : "NONE",
      size: responseSize
    };

    // Extract new API endpoints from successful JSON responses
    if (this.resultClass === "success" && responseData && typeof responseData === "object" && !Array.isArray(responseData)) {
      const newApis = Object.keys(responseData)
        .filter(key => typeof responseData[key] == "string" && responseData[key].startsWith("/services/data/"))
        .map(key => ({key, "endpoint": responseData[key]}));
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
    }
    if (format === "text" || format === "log") {
      // For text/log responses, return as-is
      return typeof resp === "string" ? resp : String(resp);
    }
    // For JSON, stringify if it's an object, otherwise return as-is
    if (typeof resp === "object" && resp !== null) {
      return JSON.stringify(resp, null, "    ");
    }
    return String(resp);
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
  }

  formatBytes(bytes) {
    if (bytes === 0) {
      return "0 B";
    }
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
  }

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
    this.onToggleHeadersEditor = this.onToggleHeadersEditor.bind(this);
    this.onUpdateHeaders = this.onUpdateHeaders.bind(this);
  }
  onSelectEntry(e, list) {
    let {model} = this.props;
    const selectedRequest = list.filter(template => template.key.toString() === e.target.value)[0];
    // Preserve headers editor state and headers if they exist
    const currentHeaders = model.request.headers || "";
    const showHeadersEditor = model.showHeadersEditor;
    model.request = selectedRequest;
    // Restore headers if they were set, otherwise initialize empty
    if (!model.request.headers) {
      model.request.headers = currentHeaders || "";
    }
    model.showHeadersEditor = showHeadersEditor;
    this.refs.endpoint.value = model.request.endpoint;
    this.resetRequest(model);
    model.didUpdate();
  }
  onSelectHistoryEntry(e) {
    let {model} = this.props;
    this.onSelectEntry(e, model.queryHistory.list);
  }
  onSelectRequestTemplate(e) {
    let {model} = this.props;
    this.onSelectEntry(e, model.requestTemplates);
  }
  onSelectSavedEntry(e) {
    let {model} = this.props;
    this.onSelectEntry(e, model.savedHistory.list);
  }
  resetRequest(model) {
    model.apiResponse = "";
    model.didUpdate();
  }
  onSelectQueryMethod(e) {
    let {model} = this.props;
    model.request.method = e.target.value;
    this.canSendRequest();
    model.didUpdate();
  }
  onClearHistory(e) {
    e.preventDefault();
    let r = confirm("Are you sure you want to clear the query history?");
    if (r == true) {
      let {model} = this.props;
      model.clearHistory();
      model.didUpdate();
    }
  }
  onAddToHistory(e) {
    e.preventDefault();
    let {model} = this.props;
    model.addToHistory();
    model.didUpdate();
  }
  onRemoveFromHistory(e) {
    e.preventDefault();
    let r = confirm("Are you sure you want to remove this saved query?");
    let {model} = this.props;
    if (r == true) {
      model.removeFromHistory();
    }
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onClearSavedHistory(e) {
    e.preventDefault();
    let r = confirm("Are you sure you want to remove all saved queries?");
    let {model} = this.props;
    if (r == true) {
      model.clearSavedHistory();
    }
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onToggleSavedOptions(e) {
    e.preventDefault();
    let {model} = this.props;
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onSend() {
    let {model} = this.props;
    model.doSend();
    model.didUpdate();
  }
  onCopyAsJson() {
    let {model} = this.props;
    model.copyAsJson();
    model.didUpdate();
  }
  onClearResponse() {
    let {model} = this.props;
    model.clear();
    model.didUpdate();
  }
  onUpdateBody(e) {
    let {model} = this.props;
    model.request.body = e.target.value;
    this.canSendRequest();
    model.didUpdate();
  }
  onSetQueryName(e) {
    let {model} = this.props;
    model.setQueryName(e.target.value);
    model.didUpdate();
  }
  onSetEndpoint(e) {
    let {model} = this.props;
    model.request.endpoint = e.target.value;
    //replace current endpoint with latest on the have the autocomplete works for all api versions
    let updatedApiEndpoint = e.target.value.replace(/\/data\/v\d+\.0\//, `/data/v${apiVersion}/`);
    model.filteredApiList = model.apiList.filter(api => api.endpoint.toLowerCase().includes(updatedApiEndpoint.toLowerCase()));
    model.didUpdate();
  }
  onToggleHeadersEditor() {
    let {model} = this.props;
    model.toggleHeadersEditor();
    model.didUpdate();
  }
  onUpdateHeaders(e) {
    let {model} = this.props;
    model.request.headers = e.target.value;
    model.didUpdate();
  }
  componentDidMount() {
    let {model} = this.props;
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
      new MutationObserver(recalculateHeight).observe(endpointInput, {attributes: true});
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
    let {model} = this.props;
    model.canSendRequest = model.request.method === "GET" || model.request.body.length > 1;
  }
  autocompleteClick(value) {
    let {model} = this.props;
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
    let {model} = this.props;
    return h("div", {},
      h(PageHeader, {
        pageTitle: "REST Explorer",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        ...model.userInfoModel.getProps()
      }),
      h(
        "div",
        {
          className: "slds-m-top_xx-large sfir-page-container"
        },
        // Request card (not flexible)
        h("div", {className: "slds-card slds-m-around_medium"},
          h("div", {className: "slds-card__body slds-card__body_inner"},
            h("div", {className: "slds-card__header slds-grid slds-grid_vertical-align-center"},
              h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
                h("div", {className: "slds-media__body"},
                  h("h3", {className: " slds-card__header-title"}, "Request"),
                ),
                h("div", {},
                  h("div", {className: "slds-form-element__control"},
                    h("div", {className: "slds-grid slds-grid_align-end"},
                      h("div", {className: "slds-size_1-of-6"}),
                      h("div", {className: "slds-size-1-of-6 slds-p-horizontal_xx-small"},
                        h("div", {className: "slds-form-element__control"},
                          h("select", {value: model.selectedTemplate, onChange: this.onSelectRequestTemplate, className: "slds-select", title: "Check documentation to customize templates"},
                            h("option", {value: null, disabled: true, defaultValue: true, hidden: true}, "Templates"),
                            model.requestTemplates.map(req => h("option", {key: req.key, value: req.key}, req.method + " " + req.endpoint))
                          ),
                        )
                      ),
                      h("div", {className: "slds-size_1-of-6 slds-p-horizontal_xx-small"},
                        h("div", {className: "slds-form-element__control"},
                          h("select", {value: JSON.stringify(model.selectedHistoryEntry), onChange: this.onSelectHistoryEntry, className: "slds-select"},
                            h("option", {value: JSON.stringify(null), disabled: true}, "History"),
                            model.queryHistory.list.map(q => h("option", {key: JSON.stringify(q), value: q.key}, q.method + " " + q.endpoint))
                          ),
                        )
                      ),
                      h("div", {className: "slds-col slds-p-horizontal_xx-small slds-p-horizontal_xx-small slds-m-right_large"},
                        h("div", {className: "slds-form-element__control"},
                          h("button", {className: "slds-button slds-button_neutral", onClick: this.onClearHistory, title: "Clear Request History"}, "Clear")
                        )
                      ),
                      h("div", {className: "slds-size_1-of-6 slds-p-horizontal_xx-small"},
                        h("div", {className: "slds-form-element__control"},
                          h("select", {value: JSON.stringify(model.selectedSavedEntry), onChange: this.onSelectSavedEntry, className: "slds-select"},
                            h("option", {value: JSON.stringify(null), disabled: true}, "Saved"),
                            model.savedHistory.list.map(q => h("option", {key: JSON.stringify(q), value: q.key}, q.label + " " + q.method + " " + q.endpoint))
                          ),
                        )
                      ),
                      h("div", {className: "slds-size_1-of-6 slds-p-horizontal_xx-small"},
                        h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left"},
                          h("svg", {className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default", "aria-hidden": "true"},
                            h("use", {xlinkHref: "symbols.svg#save"})
                          ),
                          h("input", {className: "slds-input", placeholder: "Query Label", value: model.queryName, onInput: this.onSetQueryName})
                        )
                      ),
                      h("div", {className: "slds-col slds-p-left_xx-small"},
                        h("div", {className: "slds-button-group", role: "group"},
                          h("button", {
                            className: "slds-button slds-button_neutral",
                            onClick: this.onAddToHistory,
                            style: {whiteSpace: "nowrap"}
                          }, "Save Query"),
                          h("div", {ref: "buttonQueryMenu", className: "slds-dropdown-trigger slds-dropdown-trigger_click slds-button_last", onClick: (event) => event.currentTarget.classList.toggle("slds-is-open")},
                            h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled"},
                              h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
                                h("use", {xlinkHref: "symbols.svg#down"})
                              )
                            ),
                            h("div", {className: "slds-dropdown slds-dropdown_right slds-dropdown_actions"},
                              h("ul", {className: "slds-dropdown__list", role: "menu"},
                                h("li", {className: "slds-dropdown__item", role: "presentation"},
                                  h("a", {href: "#", role: "menuitem", tabIndex: "0", target: "_blank"},
                                    h("span", {onClick: this.onRemoveFromHistory, title: "Remove query from saved history"}, "Remove Saved Query")
                                  )
                                ),
                                h("li", {className: "slds-dropdown__item", role: "presentation"},
                                  h("a", {href: "#", role: "menuitem", tabIndex: "0", target: "_blank"},
                                    h("span", {onClick: this.onClearSavedHistory, title: "Clear Saved Queries"}, "Clear Saved Queries")
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
              )
            ),
            h("div", {className: "slds-card__body slds-card__body_inner"},
              h("div", {className: "slds-grid slds-grid_align-spread slds-grid_vertical-align-center"},
                h("div", {className: "slds-size_1-of-12 slds-p-right_xx-small"},
                  h("div", {className: "slds-form-element"},
                    h("div", {className: "slds-form-element__control"},
                      h("div", {className: "slds-select_container"},
                        h("select", {className: "slds-select", value: model.request.method, onChange: this.onSelectQueryMethod},
                          h("option", {key: "get", value: "GET"}, "GET"),
                          h("option", {key: "post", value: "POST"}, "POST"),
                          h("option", {key: "put", value: "PUT"}, "PUT"),
                          h("option", {key: "patch", value: "PATCH"}, "PATCH"),
                          h("option", {key: "delete", value: "DELETE"}, "DELETE")
                        )
                      )
                    )
                  )
                ),
                h("div", {className: "slds-col sfir-full-width slds-p-horizontal_xx-small"},
                  h("input", {ref: "endpoint", className: "slds-input", type: "default", placeholder: "/services/data/v" + apiVersion, onChange: this.onSetEndpoint})
                ),
                h("div", {className: "slds-col slds-text-align_right slds-p-left_xx-small"},
                  h("div", {className: "slds-grid slds-grid_vertical-align-center slds-grid_align-end slds-gutters_xx-small"},
                    h("div", {className: "slds-col"},
                      h("button", {className: "slds-button slds-button_neutral slds-button_small", onClick: this.onToggleHeadersEditor, title: model.showHeadersEditor ? "Hide Headers" : "Show Headers"}, "Headers")
                    ),
                    h("div", {className: "slds-col"},
                      h("button", {tabIndex: 1, disabled: !model.canSendRequest, onClick: this.onSend, title: "Ctrl+Enter / F5", className: "slds-button slds-button_brand slds-button_small"}, "Send")
                    )
                  )
                ),
              ),
              h("div", {className: "slds-m-top_medium"},
                model.filteredApiList?.length > 0
                  ? model.filteredApiList.map(r =>
                    h("span", {className: "slds-pill slds-pill_link slds-m-vertical_xxx-small", key: r.key},
                      h("span", {className: "slds-pill__icon_container"},
                        h("span", {className: "slds-avatar slds-avatar_circle"},
                          h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
                            h("use", {xlinkHref: "symbols.svg#link"})
                          ),
                        )
                      ),
                      h("a", {
                        href: "#",
                        className: "slds-pill__action",
                        onClick: e => { e.preventDefault(); this.autocompleteClick(r); model.didUpdate(); }
                      },
                      h("span", {className: "slds-pill__label"}, r.key)
                      ),
                    ),
                  ) : null
              ),
              model.showHeadersEditor && h("div", {className: "slds-m-top_medium"},
                h("h3", {className: "slds-text-heading_small"}, "Request Headers"),
                h("div", {className: "slds-m-top_small"},
                  h("textarea", {className: "slds-textarea", rows: 2, value: model.request.headers || "", onChange: this.onUpdateHeaders, placeholder: "Accept: application/json; charset=UTF-8\nContent-Type: application/json; charset=UTF-8"})
                )
              ),
              h("div", {className: "slds-m-top_medium"},
                h("h3", {className: "slds-text-heading_small"}, "Request Body"),
                h("div", {className: "slds-m-top_small"},
                  h("textarea", {className: "slds-textarea", rows: 6, value: model.request.body, onChange: this.onUpdateBody})
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
          h("div", {className: "slds-card__header"},
            h("div", {className: "slds-grid slds-grid_vertical-align-center slds-grid_align-spread slds-p-around_small"},
              h("div", {className: "slds-size_8-of-12"},
                h("span", {className: "slds-text-heading_small slds-m-right_small"}, "Response"),
                h("button", {className: "slds-button slds-button_neutral", disabled: !model.apiResponse, onClick: this.onCopyAsJson, title: "Copy raw API output to clipboard"}, "Copy"),
              ),
              h("div", {className: "slds-size_4-of-12 slds-text-align_right"},
                h("span", {},
                  model.apiResponse && h("div", {},
                    isOptionEnabled("responseSize", model.displayOptions) && model.apiResponse.size > 0 && h("span", {className: "slds-m-right_small"}, model.formatBytes(model.apiResponse.size)),
                    isOptionEnabled("responseDuration", model.displayOptions) && h("span", {className: "slds-m-right_small"}, model.totalTime.toFixed(1) + "ms"),
                    h("span", {className: "slds-m-right_small slds-badge slds-theme_" + model.resultClass}, "Status: " + model.apiResponse?.code),
                    h("button", {className: "slds-button slds-button_neutral", disabled: !model.apiResponse, onClick: this.onClearResponse, title: "Clear Response"}, "Clear")
                  )
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
              h("pre", {className: "reset-margin", style: {margin: 0}},
                h("code", {className: "language-" + model.apiResponse.format}, model.apiResponse.value)
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
    let model = new Model({sfHost, args});
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model, sfConn});
    }
  });

}
