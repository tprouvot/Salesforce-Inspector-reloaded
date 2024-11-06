/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {copyToClipboard, initScrollTable} from "./data-load.js";
const restSavedQueryHistoryKey = "restSavedQueryHistory";
const requestTemplateKey = "requestTemplates";
const restQueryHistoryKey = "restQueryHistory";

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
    let historyIndex = history.findIndex(e => e.key == entry.key);
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
    let historyIndex = history.findIndex(e => e.key == entry.key);
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
    if (storageKey === restSavedQueryHistoryKey) {
      history.sort((a, b) => (a.key > b.key) ? 1 : ((b.key > a.key) ? -1 : 0));
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
    this.userInfo = "...";
    this.winInnerHeight = 0;
    this.autocompleteResults = {sobjectName: "", title: "\u00A0", results: []};
    this.autocompleteClick = null;
    this.isWorking = false;
    this.exportStatus = "";
    this.exportError = null;
    this.exportedData = null;
    this.queryHistory = new QueryHistory(restQueryHistoryKey, 100);
    this.selectedHistoryEntry = null;
    this.savedHistory = new QueryHistory(restSavedQueryHistoryKey, 50);
    this.selectedSavedEntry = null;
    this.startTime = null;
    this.totalTime = 0;
    this.autocompleteState = "";
    this.autocompleteProgress = {};
    this.exportProgress = {};
    this.queryName = "";
    this.apiResponse = null;
    this.canSendRequest = true;
    this.resultClass = "neutral";
    this.request = {endpoint: "", method: "get", body: ""};
    this.apiList;
    this.filteredApiList;
    this.requestTemplates = localStorage.getItem(requestTemplateKey) ? this.requestTemplates = JSON.parse(localStorage.getItem(requestTemplateKey)) : [
      {key: "getLimit", endpoint: `/services/data/v${apiVersion}/limits`, method: "GET", body: ""},
      {key: "getAccount", endpoint: `/services/data/v${apiVersion}/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+1`, method: "GET", body: ""},
      {key: "createAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/`, method: "POST", body: '{  \n"Name" : "SFIR",\n"Industry" : "Chrome Extension"\n}'},
      {key: "updateAccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "PATCH", body: '{  \n"Name" : "SFIR Updated"\n}'},
      {key: "deleteccount", endpoint: `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`, method: "DELETE", body: ""}
    ];
    this.selectedTemplate = "";
    this.lookupOptions = [{key: "all", label: "All Types", icon: "filter"}, {key: "history", label: "History", icon: "recent"}, {key: "saved", label: "Saved", icon: "individual"}, {key: "template", label: "Template", icon: "query_editor"}];
    this.lookupOption = this.lookupOptions[0];//TODO add option to persist preference in localStorage
    this.suggestedQueries = this.getSearchedList();

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
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
  clear(){
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
    this.spinFor(sfConn.rest(this.request.endpoint, {method: this.request.method, body: this.request.body, bodyType: "raw", progressHandler: this.autocompleteProgress}, true)
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
    this.apiResponse = {
      status,
      code: result.status,
      value: result.response ? JSON.stringify(result.response, null, "    ") : "NONE"
    };
    if (this.resultClass === "success"){
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
  getSearchedList() {
    const addListProperty = (arr, option) => arr.map(item => ({...item, list: option}));
    const getOption = (key) => this.lookupOptions.find(option => option.key === key);

    switch (this.lookupOption.key) {
      case "all":
        return addListProperty(this.queryHistory.list, getOption("history"))
          .concat(addListProperty(this.savedHistory.list, getOption("saved")), addListProperty(this.requestTemplates, getOption("template")));
      case "history":
        return addListProperty(this.queryHistory.list, this.lookupOption);
      case "saved":
        return addListProperty(this.savedHistory.list, this.lookupOption);
      case "template":
        return addListProperty(this.requestTemplates, this.lookupOption);
    }
    return null;
  }
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onSelectQueryMethod = this.onSelectQueryMethod.bind(this);
    this.onAddToHistory = this.onAddToHistory.bind(this);
    this.onRemoveFromHistory = this.onRemoveFromHistory.bind(this);
    this.onClearSavedHistory = this.onClearSavedHistory.bind(this);
    this.onSend = this.onSend.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onClearResponse = this.onClearResponse.bind(this);
    this.onUpdateBody = this.onUpdateBody.bind(this);
    this.onSetQueryName = this.onSetQueryName.bind(this);
    this.onSetEndpoint = this.onSetEndpoint.bind(this);
    this.handleLookupSelection = this.handleLookupSelection.bind(this);
    this.handleQuerySelection = this.handleQuerySelection.bind(this);
    this.onSaveQuery = this.onSaveQuery.bind(this);
  }
  resetRequest(model){
    model.apiResponse = "";
    this.refs.resultBar.classList.remove("success");
    this.refs.resultBar.classList.remove("error");
    model.didUpdate();
  }
  onSelectQueryMethod(e){
    let {model} = this.props;
    model.request.method = e.target.value;
    this.canSendRequest();
    model.didUpdate();
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
  onClearResponse(){
    let {model} = this.props;
    model.clear();
    model.didUpdate();
  }
  onUpdateBody(e){
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
  onSetEndpoint(e){
    let {model} = this.props;
    model.request.endpoint = e.target.value;
    model.filteredApiList = model.apiList.filter(api => api.endpoint.toLowerCase().includes(e.target.value.toLowerCase()));
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
  canSendRequest(){
    let {model} = this.props;
    model.canSendRequest = model.request.method === "GET" || model.request.body.length > 1;
  }
  autocompleteClick(value){
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
  handleLookupSelection(target){
    let {model} = this.props;
    model.lookupOption = target;
    model.suggestedQueries = model.getSearchedList();
    this.toggleQueryMenu();
    model.didUpdate();
  }
  handleQuerySelection(target){
    let {model} = this.props;
    model.request = target;
    this.refs.endpoint.value = model.request.endpoint;
    this.refs.queryName.value = model.request.label ? model.request.label : "";
    this.resetRequest(model);
    model.didUpdate();
    this.toggleSuggestedQuery();
  }
  handleQuerySelectionBlur(){
    console.log("onBlur");
    this.toggleSuggestedQuery();
  }
  onDeleteQuery(request){
    //TODO check if remove function can be used
    let {model} = this.props;
    // Determine the correct list and storage key based on model.request.list.key
    let keyList = this.getStorageKeyList(request, model);

    // Find the index of the existing request with the same key
    let suggestedQueriesIndex = model.suggestedQueries.findIndex(q => q.key === request.key);
    if (suggestedQueriesIndex > -1) {
      model.suggestedQueries.splice(suggestedQueriesIndex, 1);
    }

    let existingRequestIndex = keyList.list.findIndex(q => q.key === request.key);
    if (existingRequestIndex > -1) {
      keyList.list.splice(existingRequestIndex, 1);
    }
    localStorage[keyList.key] = JSON.stringify(keyList.list);
    model.didUpdate();
  }
  onSaveQuery() {
    //TODO check if add function can be used
    let {model} = this.props;
    model.request.label = this.refs.queryName.value;

    // Determine the correct list and storage key based on model.request.list.key
    let keyList = this.getStorageKeyList(model.request, model);

    // Find the index of the existing request with the same key
    let existingRequestIndex = keyList.list.findIndex(q => q.key === model.request.key);

    // Replace the existing request if found, otherwise add a new one
    if (existingRequestIndex !== -1) {
      keyList.list[existingRequestIndex] = {...model.request};
    } else {
      keyList.list.push({...model.request});
    }
    localStorage[keyList.key] = JSON.stringify(keyList.list);
    model.didUpdate();
  }
  getStorageKeyList(request, model){
    switch (request.list.key) {
      case "history":
        return {key: restQueryHistoryKey, list: model.queryHistory.list};
      case "saved":
        return {key: restSavedQueryHistoryKey, list: model.savedHistory.list};
      case "template":
        return {key: requestTemplateKey, list: model.requestTemplates};
      default:
        return "";
    }
  }
  toggleQueryMenu(){
    this.refs.queryMenu.classList.toggle("slds-is-open");
  }
  toggleSuggestedQuery(){
    this.refs.querySuggestions.classList.toggle("slds-is-open");
  }
  searchQuery(){
    let {model} = this.props;
    const searchTerm = this.refs.lookupSearch.value.toLowerCase();
    const searchedList = model.getSearchedList();
    model.suggestedQueries = searchedList.filter(query => {
      const bodyMatch = query.body?.toLowerCase().includes(searchTerm);
      const endpointMatch = query.endpoint.toLowerCase().includes(searchTerm);
      return bodyMatch || endpointMatch;
    });
    model.didUpdate();
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
        h("h1", {}, "REST Explore"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},
          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          )
        ),
      ),
      h("div", {className: "area"},
        h("div", {className: "area-header"},
        ),
        h("div", {className: "slds-form-element float-left"},
          h("div", {className: "slds-form-element__control"},
            h("div", {className: "slds-combobox-group"},
              h("div", {className: "slds-combobox_object-switcher slds-combobox-addon_start"},
                h("div", {className: "slds-form-element"},
                  h("label", {className: "slds-form-element__label slds-assistive-text", htmlFor: "combobox-id-1", id: "combobox-label-id-34"}, "Filter Search by:"),
                  h("div", {className: "slds-form-element__control"},
                    h("div", {className: "slds-combobox_container"},
                      h("div", {ref: "queryMenu", className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click", onClick: () => this.toggleQueryMenu(), "aria-controls": "primary-combobox-id-1"},
                        h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
                          h("div", {
                            role: "combobox",
                            tabIndex: "0",
                            onBlur: () => this.toggleQueryMenu(),
                            className: "slds-input_faux slds-combobox__input slds-combobox__input-value",
                            "aria-labelledby": "combobox-label-id-34",
                            id: "combobox-id-1-selected-value",
                            "aria-controls": "objectswitcher-listbox-id-1",
                            "aria-expanded": "false",
                            "aria-haspopup": "listbox"
                          },
                          h("span", {className: "slds-truncate", id: "combobox-value-id-25"}, model.lookupOption.label)
                          ),
                          h("span", {className: "slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"},
                            h("svg", {className: "slds-icon slds-icon slds-icon_xx-small slds-icon-text-default", "aria-hidden": "true"},
                              h("use", {xlinkHref: "symbols.svg#down"})
                            )
                          )
                        ),
                        h("div", {
                          id: "objectswitcher-listbox-id-1",
                          className: "slds-dropdown slds-dropdown_length-5 slds-dropdown_x-small slds-dropdown_left",
                          role: "listbox",
                          "aria-label": "{{Placeholder for Dropdown Items}}",
                          tabIndex: "0",
                          "aria-busy": "false"
                        },
                        h("ul", {className: "slds-listbox slds-listbox_vertical", role: "group", "aria-label": "{{Placeholder for Dropdown Options}}"},
                          h("li", {role: "presentation", className: "slds-listbox__item"},
                            h("div", {id: "option232", className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small", role: "presentation"},
                              h("h3", {className: "slds-listbox__option-header", role: "presentation"}, "Select Query Type")
                            )
                          ),
                          h("div", {id: "lookup-listbox", role: "listbox", "aria-orientation": "vertical"}, [
                            h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"}, [
                              ...model.lookupOptions.map((option) =>
                                h("li", {
                                  className: "slds-listbox__item",
                                  role: "presentation",
                                  key: option.key,
                                  "data-id": option.key,
                                  onMouseDown: () => this.handleLookupSelection(option)
                                }, [
                                  h("div", {
                                    id: `option${option.key}`,
                                    className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small slds-is-selected",
                                    role: "option"
                                  }, [
                                    h("span", {className: "slds-media__figure slds-listbox__option-icon"}, [
                                      h("span", {className: "slds-icon_container slds-icon-utility-check slds-current-color"}, [
                                        h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"}, [
                                          h("use", {xlinkHref: `symbols.svg#${option.icon}`})
                                        ])
                                      ])
                                    ]),
                                    h("span", {className: "slds-media__body"}, [
                                      h("span", {className: "slds-truncate", title: option.label}, option.label)
                                    ])
                                  ])
                                ])
                              )
                            ])
                          ])
                        )
                        )
                      )
                    )
                  )
                )
              ),
              h("div", {className: "slds-combobox_container slds-combobox-addon_end"},
                h("div", {ref: "querySuggestions", className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click", id: "primary-combobox-id-1"},
                  h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
                    h("input", {
                      type: "text",
                      className: "slds-input slds-combobox__input",
                      ref: "lookupSearch",
                      id: "combobox-id-1",
                      "aria-autocomplete": "list",
                      "aria-controls": "listbox-id-1",
                      "aria-expanded": "false",
                      "aria-haspopup": "listbox",
                      autoComplete: "off",
                      role: "combobox",
                      placeholder: "Search query...",
                      onClick: () => this.toggleSuggestedQuery(),
                      onKeyUp: () => this.searchQuery(),
                      onBlur: () => this.handleQuerySelectionBlur()
                    }),
                    h("span", {className: "slds-icon_container slds-icon-utility-search slds-input__icon slds-input__icon_right", title: "Search icon"},
                      h("svg", {className: "slds-icon slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
                        h("use", {xlinkHref: "symbols.svg#search"})
                      )
                    )
                  ),
                  h("div", {
                    id: "listbox-id-1",
                    className: "slds-dropdown slds-dropdown_length-with-icon-7 slds-dropdown_fluid",
                    role: "listbox",
                    tabIndex: "0",
                    "aria-busy": "false"
                  },
                  h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"},
                    model.suggestedQueries.map((query, index) =>
                      h("li", {
                        role: "presentation",
                        className: "slds-listbox__item",
                        key: index,
                        onMouseDown: () => this.handleQuerySelection(query)
                      },
                      h("div", {
                        id: `option${index}`,
                        className: "slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta",
                        role: "option"
                      },
                      h("span", {className: "slds-media__figure slds-listbox__option-icon"},
                        h("span", {className: "slds-icon_container slds-icon-standard-account"},
                          h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
                            h("use", {xlinkHref: `symbols.svg#${query.list.icon}`})
                          )
                        )
                      ),
                      h("span", {className: "slds-media__body", title: query.endpoint},
                        h("span", {className: "slds-listbox__option-text slds-listbox__option-text_entity"}, query.endpoint),
                        h("span", {className: "slds-listbox__option-meta slds-listbox__option-meta_entity"}, query.list.label + " • " + query.method + (query.label ? " • " + query.label : ""))
                      ),
                      h("button", {className: "slds-button slds-button_icon slds-input__icon slds-input__icon_right",
                        title: "Delete Query",
                        onClick: (event) => {
                          event.stopPropagation(); //prevent triggering handleQuerySelection
                          this.onDeleteQuery(query);
                        }},
                      h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
                        h("use", {xlinkHref: "symbols.svg#delete"})
                      )
                      )
                      )
                      )
                    )
                  )
                  )
                )
              ),
              h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left-right"},
                h("svg", {className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default"},
                  h("use", {xlinkHref: "symbols.svg#save"})
                ),
                h("input", {type: "text", ref: "queryName", id: "queryLabel", className: "slds-input slds-m-left_xx-small", placeholder: "Query Label"}),
                h("button", {onClick: this.onSaveQuery, title: "Save Query", className: "slds-m-left_xx-small"}, "Save")
              )
            )
          )
        ),
        h("div", {className: "query-controls"},
          h("h1", {}, "Request"),
          h("div", {className: "query-history-controls"}//TODO remove div ?
          )
        ),
        h("div", {className: "query-controls slds-form-element__control"},
          h("select", {value: model.request.method, onChange: this.onSelectQueryMethod, className: "query-history slds-m-right_medium", title: "Choose rest method"},
            h("option", {key: "get", value: "GET"}, "GET"),
            h("option", {key: "post", value: "POST"}, "POST"),
            h("option", {key: "put", value: "PUT"}, "PUT"),
            h("option", {key: "patch", value: "PATCH"}, "PATCH"),
            h("option", {key: "delete", value: "DELETE"}, "DELETE")
          ),
          h("input", {ref: "endpoint", className: "slds-input query-control slds-m-right_medium", type: "default", placeholder: "/services/data/v" + apiVersion, onChange: this.onSetEndpoint}),
          h("div", {className: "flex-right"},
            h("button", {tabIndex: 1, disabled: !model.canSendRequest, onClick: this.onSend, title: "Ctrl+Enter / F5", className: "highlighted"}, "Send")
          )
        ),
        h("div", {className: "autocomplete-box"},
          h("div", {className: "autocomplete-header"}),
          h("div", {className: "autocomplete-results"},
            model.filteredApiList?.length > 0 ? model.filteredApiList.map(r =>
              h("div", {className: "autocomplete-result", key: r.key}, h("a", {tabIndex: 0, title: r.key, onClick: e => { e.preventDefault(); this.autocompleteClick(r); model.didUpdate(); }, href: "#", className: "fieldName url"}, h("div", {className: "autocomplete-icon"}), r.key), " ")
            ) : null
          ),
        ),
        h("div", {className: "autocomplete-box slds-m-top_medium"},
          h("h1", {className: ""}, "Request Body"),
          h("div", {className: "slds-m-top_small"},
            h("textarea", {className: "request-body", value: model.request.body, onChange: this.onUpdateBody})
          )
        )
      ),
      h("div", {className: "area", id: "result-area"},
        h("div", {ref: "resultBar", className: `result-bar ${model.resultClass}`},
          h("h1", {}, "Response"),
          h("div", {className: "button-group"},
            h("button", {disabled: !model.apiResponse, onClick: this.onCopyAsJson, title: "Copy raw API output to clipboard"}, "Copy")
          ),
          h("span", {className: "result-status flex-right"},
            model.apiResponse && h("div",
              h("span", {}, model.totalTime.toFixed(1) + "ms"),
              h("span", {className: "slds-m-left_medium status-code"}, "Status: " + model.apiResponse.code)
            ),
            h("div", {className: "slds-m-left_medium button-group"},
              h("button", {disabled: !model.apiResponse, onClick: this.onClearResponse, title: "Clear Response"}, "Clear")
            )
          )
        ),
        h("textarea", {id: "result-text", readOnly: true, value: model.exportError || "", hidden: model.exportError == null}),
        h("div", {id: "result-table", ref: "scroller", hidden: model.exportError != null},
          model.apiResponse && h("div", {},
            h("pre", {className: "language-json reset-margin"}, // Set the language class to JSON for Prism to highlight
              h("code", {className: "language-json"}, model.apiResponse.value)
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
