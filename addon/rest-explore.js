/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {initScrollTable} from "./data-load.js";
import {PageHeader} from "./components/PageHeader.js";
import {QueryToolbar, SaveQueryModal} from "./components/SldsCombobox.js";
import Toast from "./components/Toast.js";
import {renderRestItem, restDropdownEntries} from "./query-search-utils.js";
import {UserInfoModel, createSpinForMethod, createChangeGuard, copyToClipboard, isOptionEnabled, StorageHistory, formatXml} from "./utils.js";

function sameRestRequest(a, b) {
  return a.endpoint === b.endpoint && (a.method || "GET").toUpperCase() === (b.method || "GET").toUpperCase();
}

function createRestQueryHistory(storageKey, max) {
  const isSaved = storageKey === "restSavedQueryHistory";
  return new StorageHistory(storageKey, max, {
    isValidEntry: (e) => typeof e === "object" && e !== null && typeof e.endpoint === "string" && e.endpoint.length > 0,
    matchAdd: isSaved
      ? (e, ent) => sameRestRequest(e, ent) && (e.label || "") === (ent.label || "")
      : sameRestRequest,
    matchRemove: isSaved
      ? (e, ent) => (e.key && ent.key ? e.key === ent.key : sameRestRequest(e, ent) && (e.label || "") === (ent.label || ""))
      : sameRestRequest,
    sortComparator: isSaved ? (a, b) => (a.endpoint > b.endpoint ? 1 : b.endpoint > a.endpoint ? -1 : 0) : null,
    addToFront: true
  });
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
    this.queryHistory = createRestQueryHistory("restQueryHistory", 100);
    this.savedHistory = createRestQueryHistory("restSavedQueryHistory", 50);
    this.toast = null;
    this.toastTimeout = null;
    this.startTime = null;
    this.totalTime = 0;
    this.autocompleteState = "";
    this.autocompleteProgress = {};
    this.exportProgress = {};
    this.queryName = "";
    this.apiResponse = null;
    this.responseCounter = 0;
    this.canSendRequest = true;
    this.resultClass = "neutral";
    this.request = {endpoint: "", method: "GET", body: "", headers: ""};
    this.showHeadersEditor = false;
    this.apiList;
    this.filteredApiList;
    this.displayOptions = JSON.parse(localStorage.getItem("restExploreDisplayOptions") || "[]");
    this.requestTemplates = localStorage.getItem("requestTemplates")
      ? localStorage.getItem("requestTemplates").split("//").filter(Boolean).map((tpl, idx) => ({key: `tpl-${idx}`, endpoint: tpl.trim(), method: "GET", body: ""}))
      : [
        {key: "getLimit", endpoint: `/services/data/v${apiVersion}/limits`, method: "GET", body: ""},
        {key: "executeApex", endpoint: `/services/data/v${apiVersion}/tooling/executeAnonymous/?anonymousBody=System.debug(LoggingLevel.INFO, 'Executing apex example');`, method: "GET", body: ""},
        {key: "getAccount", endpoint: `/services/data/v${apiVersion}/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+1`, method: "GET", body: ""},
        {key: "createAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/`, method: "POST", body: '{  \n"Name" : "SFIR",\n"Industry" : "Chrome Extension"\n}'},
        {key: "updateAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "PATCH", body: '{  \n"Name" : "SFIR Updated"\n}'},
        {key: "deleteccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "DELETE", body: ""}
      ];

    // Initialize spinFor method
    this.spinFor = createSpinForMethod(this);

    // Initialize user info model - handles all user-related properties
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    // Set orgName from sfHost
    this.orgName = this.sfHost.split(".")[0]?.toUpperCase() || "";

    if (args.has("endpoint") && args.has("method")) {
      this.request.endpoint = args.get("endpoint");
      this.request.method = args.get("method").toUpperCase();
    } else if (this.queryHistory.list[0]) {
      this.request = {...this.queryHistory.list[0], method: (this.queryHistory.list[0].method || "GET").toUpperCase()};
      this.didUpdate();
    } else {
      this.request = {...this.requestTemplates[0]};
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
  showToast(variant, title, message) {
    clearTimeout(this.toastTimeout);
    this.toast = {variant, title, message};
    this.didUpdate();
    this.toastTimeout = setTimeout(() => {
      this.toast = null;
      this.toastTimeout = null;
      this.didUpdate();
    }, 2000);
  }
  closeToast() {
    clearTimeout(this.toastTimeout);
    this.toastTimeout = null;
    this.toast = null;
    this.didUpdate();
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
  clearSavedHistory() {
    this.savedHistory.clear();
  }
  addToHistory() {
    const endpoint = this.request.endpoint?.trim();
    if (!endpoint) {
      return false;
    }
    const entry = {
      ...this.request,
      endpoint,
      method: (this.request.method || "GET").toUpperCase(),
      key: Date.now(),
      label: this.queryName || ""
    };
    this.savedHistory.add(entry);
    const wasSaved = this.savedHistory.list.some(
      saved => sameRestRequest(saved, entry) && (saved.label || "") === entry.label
    );
    if (!wasSaved) {
      return false;
    }
    this.queryName = "";
    return true;
  }
  deleteHistoryEntry(entry) {
    this.queryHistory.remove(entry);
  }
  deleteSavedEntry(entry) {
    this.savedHistory.remove(entry);
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
    if (this.request.endpoint.trim()) {
      this.queryHistory.add({...this.request, key: Date.now()});
    }
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
        if (shouldCalculateDuration) {
          this.totalTime = performance.now() - this.startTime;
        }
        if (!result) {
          this.didUpdate();
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
          this.responseCounter++;
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
    this.responseCounter++;

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
      return formatXml(resp);
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
    this.state = {
      isSaveModalOpen: false
    };
    this.onSelectQueryMethod = this.onSelectQueryMethod.bind(this);
    this.onClearHistory = this.onClearHistory.bind(this);
    this.onOpenSaveModal = this.onOpenSaveModal.bind(this);
    this.onConfirmSaveModal = this.onConfirmSaveModal.bind(this);
    this.onCloseSaveModal = this.onCloseSaveModal.bind(this);
    this.onClearSavedHistory = this.onClearSavedHistory.bind(this);
    this.onSend = this.onSend.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onClearResponse = this.onClearResponse.bind(this);
    this.onUpdateBody = this.onUpdateBody.bind(this);
    this.onSetEndpoint = this.onSetEndpoint.bind(this);
    this.onToggleHeadersEditor = this.onToggleHeadersEditor.bind(this);
    this.onUpdateHeaders = this.onUpdateHeaders.bind(this);
    this.highlightGuard = createChangeGuard();
  }
  applyRestEntry(selectedRequest, {restoreLabel = false} = {}) {
    if (!selectedRequest) {
      return;
    }
    let {model} = this.props;
    // Preserve headers editor state and headers if they exist
    const currentHeaders = model.request.headers || "";
    const showHeadersEditor = model.showHeadersEditor;
    model.request = {
      ...selectedRequest,
      method: (selectedRequest.method || "GET").toUpperCase(),
      body: selectedRequest.body || ""
    };
    if (!model.request.headers) {
      model.request.headers = currentHeaders;
    }
    model.showHeadersEditor = showHeadersEditor;
    model.queryName = restoreLabel ? (selectedRequest.label || "") : "";
    this.refs.endpoint.value = model.request.endpoint;
    this.canSendRequest();
    this.resetRequest(model);
  }
  resetRequest(model) {
    model.apiResponse = "";
    model.responseCounter++;
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
    if (!confirm("Are you sure you want to clear the query history?")) {
      return false;
    }
    let {model} = this.props;
    model.clearHistory();
    model.didUpdate();
    return true;
  }
  onOpenSaveModal(e) {
    e.preventDefault();
    let {model} = this.props;
    if (!model.request.endpoint?.trim()) {
      return;
    }
    this.setState({isSaveModalOpen: true});
  }
  onConfirmSaveModal(label) {
    let {model} = this.props;
    model.setQueryName(label);
    this.setState({isSaveModalOpen: false});
    if (model.addToHistory()) {
      model.showToast("success", "Saved", "Query saved successfully.");
    } else {
      model.didUpdate();
    }
  }
  onCloseSaveModal() {
    this.setState({isSaveModalOpen: false});
  }
  onClearSavedHistory(e) {
    e.preventDefault();
    if (!confirm("Are you sure you want to remove all saved queries?")) {
      return false;
    }
    let {model} = this.props;
    model.clearSavedHistory();
    model.didUpdate();
    return true;
  }
  onDeleteHistoryEntry(entry) {
    let {model} = this.props;
    model.deleteHistoryEntry(entry);
    model.didUpdate();
  }
  onDeleteSavedEntry(entry) {
    if (!confirm("Are you sure you want to remove this saved query?")) {
      return;
    }
    let {model} = this.props;
    model.deleteSavedEntry(entry);
    model.didUpdate();
  }
  querySources() {
    let {model} = this.props;
    return [
      {
        id: "history",
        label: "History",
        entries: model.queryHistory.list,
        getResults: restDropdownEntries,
        renderEntry: (entry, searchValue) => renderRestItem({...entry, label: null}, searchValue),
        select: (entry) => this.applyRestEntry(entry),
        remove: (entry) => this.onDeleteHistoryEntry(entry),
        clear: this.onClearHistory,
        clearLabel: "Clear Request History",
        clearAriaLabel: "Clear list of request history"
      },
      {
        id: "saved",
        label: "Saved",
        entries: model.savedHistory.list,
        getResults: restDropdownEntries,
        renderEntry: (entry, searchValue) => renderRestItem(entry, searchValue),
        select: (entry) => this.applyRestEntry(entry, {restoreLabel: true}),
        remove: (entry) => this.onDeleteSavedEntry(entry),
        clear: this.onClearSavedHistory,
        clearLabel: "Clear Saved Queries",
        clearAriaLabel: "Clear list of saved queries"
      },
      {
        id: "templates",
        label: "Templates",
        entries: model.requestTemplates,
        getResults: restDropdownEntries,
        renderEntry: (entry, searchValue) => renderRestItem({...entry, label: null}, searchValue),
        select: (entry) => this.applyRestEntry(entry),
        remove: null,
        clear: null,
        clearLabel: "Clear",
        clearAriaLabel: "Clear list"
      }
    ];
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
  onSetEndpoint(e) {
    let {model} = this.props;
    model.request.endpoint = e.target.value;
    //replace current endpoint with latest on the have the autocomplete works for all api versions
    let updatedApiEndpoint = e.target.value.replace(/\/data\/v\d+\.0\//, `/data/v${apiVersion}/`);
    model.filteredApiList = model.apiList?.filter(api => api.endpoint.toLowerCase().includes(updatedApiEndpoint.toLowerCase()));
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
    // Only run Prism when a new query result arrived - skip when just typing in endpoint/body.
    if (this.props.model?.apiResponse && window.Prism) {
      this.highlightGuard(this.props.model.responseCounter, () => window.Prism.highlightAll());
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
  render() {
    let {model} = this.props;
    const isEndpointEmpty = !model.request.endpoint?.trim();
    return h("div", {},
      h(PageHeader, {
        pageTitle: "REST Explorer",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        ...model.userInfoModel.getProps()
      }),
      model.toast && h(Toast, {
        variant: model.toast.variant,
        title: model.toast.title,
        message: model.toast.message,
        onClose: () => model.closeToast()
      }),
      h(SaveQueryModal, {
        isOpen: this.state.isSaveModalOpen,
        defaultLabel: model.queryName,
        onSave: this.onConfirmSaveModal,
        onCancel: this.onCloseSaveModal
      }),
      h(
        "div",
        {
          className: "slds-m-top_xx-large sfir-page-container"
        },
        // Request card (not flexible)
        h("div", {className: "slds-card slds-m-around_medium"},
          h("div", {className: "slds-card__body slds-card__body_inner"},
            h("div", {className: "slds-card__header slds-grid slds-grid_vertical-align-center slds-grid_align-spread slds-wrap"},
              h("h3", {className: "slds-card__header-title slds-m-vertical_xx-small slds-m-right_small"}, "Request"),
              h(QueryToolbar, {
                sources: this.querySources()
              })
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
                h("div", {className: "slds-col slds-no-flex slds-text-align_right slds-p-left_xx-small"},
                  h("div", {className: "slds-grid slds-grid_vertical-align-center slds-grid_align-end slds-gutters_xx-small"},
                    h("div", {className: "slds-col"},
                      h("button", {className: "slds-button slds-button_neutral slds-button_small", onClick: this.onToggleHeadersEditor, title: model.showHeadersEditor ? "Hide Headers" : "Show Headers"}, "Headers")
                    ),
                    h("div", {className: "slds-col"},
                      h("button", {type: "button", className: "slds-button slds-button_neutral slds-button_small", disabled: isEndpointEmpty, onClick: this.onOpenSaveModal, title: "Add query to saved history"}, "Save Query")
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
  });

}
