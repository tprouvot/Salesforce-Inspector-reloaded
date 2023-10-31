/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {Enumerable, DescribeInfo, copyToClipboard, initScrollTable} from "./data-load.js";

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
    let historyIndex = history.findIndex(e => e.query == entry.query && e.useToolingApi == entry.useToolingApi);
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
    let historyIndex = history.findIndex(e => e.query == entry.query && e.useToolingApi == entry.useToolingApi);
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
    //sort only saved query not history
    if (storageKey === "insextSavedQueryHistory") {
      history.sort((a, b) => (a.query > b.query) ? 1 : ((b.query > a.query) ? -1 : 0));
    }
    this.list = history;
  }
}

class Model {
  constructor({sfHost, args}) {
    this.sfHost = sfHost;
    this.queryInput = null;
    this.initialQuery = "";
    this.describeInfo = new DescribeInfo(this.spinFor.bind(this), () => {
      this.queryAutocompleteHandler({newDescribe: true});
      this.didUpdate();
    });

    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.userInfo = "...";
    this.winInnerHeight = 0;
    this.queryAll = false;
    this.queryTooling = false;
    this.autocompleteResults = {sobjectName: "", title: "\u00A0", results: []};
    this.autocompleteClick = null;
    this.isWorking = false;
    this.exportStatus = "Ready";
    this.exportError = null;
    this.exportedData = null;
    this.queryHistory = new QueryHistory("insextQueryHistory", 100);
    this.selectedHistoryEntry = null;
    this.savedHistory = new QueryHistory("insextSavedQueryHistory", 50);
    this.selectedSavedEntry = null;
    this.expandAutocomplete = false;
    this.expandSavedOptions = false;
    this.resultsFilter = "";
    this.autocompleteState = "";
    this.autocompleteProgress = {};
    this.exportProgress = {};
    this.queryName = "";
    this.clientId = localStorage.getItem(sfHost + "_clientId") ? localStorage.getItem(sfHost + "_clientId") : "";
    this.queryTemplates = localStorage.getItem("queryTemplates") ? this.queryTemplates = localStorage.getItem("queryTemplates").split("//") : [
      "SELECT Id FROM ",
      "SELECT Id FROM WHERE",
      "SELECT Id FROM WHERE IN",
      "SELECT Id FROM WHERE LIKE",
      "SELECT Id FROM WHERE ORDER BY"
    ];

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));

    if (args.has("query")) {
      this.initialQuery = args.get("query");
      this.queryTooling = args.has("useToolingApi");
    } else if (this.queryHistory.list[0]) {
      this.initialQuery = this.queryHistory.list[0].query;
      this.queryTooling = this.queryHistory.list[0].useToolingApi;
    } else {
      this.initialQuery = "SELECT Id FROM Account";
      this.queryTooling = false;
    }

  }
  updatedExportedData() {
    this.resultTableCallback(this.exportedData);
  }
  setResultsFilter(value) {
    this.resultsFilter = value;
    if (this.exportedData == null) {
      return;
    }
    // Recalculate visibility
    this.exportedData.updateVisibility();
    this.updatedExportedData();
  }
  setQueryName(value) {
    this.queryName = value;
  }
  setClientId(value) {
    this.clientId = value;
  }
  setQueryInput(queryInput) {
    this.queryInput = queryInput;
    queryInput.value = this.initialQuery;
    this.initialQuery = null;
  }
  toggleHelp() {
    this.showHelp = !this.showHelp;
  }
  toggleExpand() {
    this.expandAutocomplete = !this.expandAutocomplete;
  }
  toggleSavedOptions() {
    this.expandSavedOptions = !this.expandSavedOptions;
  }
  showDescribeUrl() {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", this.autocompleteResults.sobjectName);
    if (this.queryTooling) {
      args.set("useToolingApi", "1");
    }
    return "inspect.html?" + args;
  }
  selectHistoryEntry() {
    if (this.selectedHistoryEntry != null) {
      this.queryInput.value = this.selectedHistoryEntry.query;
      this.queryTooling = this.selectedHistoryEntry.useToolingApi;
      this.queryAutocompleteHandler();
      this.selectedHistoryEntry = null;
    }
  }
  selectQueryTemplate() {
    this.queryInput.value = this.selectedQueryTemplate.trimStart();
    this.queryInput.focus();
    let indexPos = this.queryInput.value.toLowerCase().indexOf("from ");
    if (indexPos !== -1) {
      this.queryInput.setRangeText("", indexPos + 5, indexPos + 5, "end");
    }
  }
  clearHistory() {
    this.queryHistory.clear();
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
      this.queryInput.value = queryStr;
      this.queryTooling = this.selectedSavedEntry.useToolingApi;
      this.queryAutocompleteHandler();
      this.selectedSavedEntry = null;
    }
  }
  clearSavedHistory() {
    this.savedHistory.clear();
  }
  addToHistory() {
    this.savedHistory.add({query: this.getQueryToSave(), useToolingApi: this.queryTooling});
  }
  saveClientId() {
    localStorage.setItem(this.sfHost + "_clientId", this.clientId);
  }
  removeFromHistory() {
    this.savedHistory.remove({query: this.getQueryToSave(), useToolingApi: this.queryTooling});
  }
  getQueryToSave() {
    return this.queryName != "" ? this.queryName + ":" + this.queryInput.value : this.queryInput.value;
  }
  autocompleteReload() {
    this.describeInfo.reloadAll();
  }
  canCopy() {
    return this.exportedData != null;
  }
  canDelete() {
    //In order to allow deletion, we should have at least 1 element and the Id field should have been included in the query
    return this.exportedData
          && (this.exportedData.countOfVisibleRecords === null /* no filtering has been done yet*/ || this.exportedData.countOfVisibleRecords > 1)
          && this.exportedData?.table?.at(0)?.find(header => header.toLowerCase() === "id");
  }
  copyAsExcel() {
    copyToClipboard(this.exportedData.csvSerialize("\t"));
  }
  copyAsCsv() {
    let separator = getSeparator();
    copyToClipboard(this.exportedData.csvSerialize(separator));
  }
  copyAsJson() {
    copyToClipboard(JSON.stringify(this.exportedData.records, null, "  "));
  }
  deleteRecords(e) {
    let separator = getSeparator();
    let data = this.exportedData.csvSerialize(separator);
    let encodedData = btoa(data);

    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("data", encodedData);

    window.open("data-import.html?" + args, getLinkTarget(e));
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
  /**
   * SOQL query autocomplete handling.
   * Put caret at the end of a word or select some text to autocomplete it.
   * Searches for both label and API name.
   * Autocompletes sobject names after the "from" keyword.
   * Autocompletes field names, if the "from" keyword exists followed by a valid object name.
   * Supports relationship fields.
   * Autocompletes field values (picklist values, date constants, boolean values).
   * Autocompletes any textual field value by performing a Salesforce API query when Ctrl+Space is pressed.
   * Inserts all autocomplete field suggestions when Ctrl+Space is pressed.
   * Supports subqueries in where clauses, but not in select clauses.
   */
  queryAutocompleteHandler(e = {}) {
    let vm = this; // eslint-disable-line consistent-this
    let useToolingApi = vm.queryTooling;
    let query = vm.queryInput.value;
    let selStart = vm.queryInput.selectionStart;
    let selEnd = vm.queryInput.selectionEnd;
    let ctrlSpace = e.ctrlSpace;

    // Skip the calculation when no change is made. This improves performance and prevents async operations (Ctrl+Space) from being canceled when they should not be.
    let newAutocompleteState = [useToolingApi, query, selStart, selEnd].join("$");
    if (newAutocompleteState == vm.autocompleteState && !ctrlSpace && !e.newDescribe) {
      return;
    }
    vm.autocompleteState = newAutocompleteState;

    // Cancel any async operation since its results will no longer be relevant.
    if (vm.autocompleteProgress.abort) {
      vm.autocompleteProgress.abort();
    }

    vm.autocompleteClick = ({value, suffix}) => {
      vm.queryInput.focus();
      //handle when selected field is the last one before "FROM" keyword, or if an existing comma is present after selection
      let indexFrom = query.toLowerCase().indexOf("from");
      if (suffix.trim() == "," && (query.substring(selEnd + 1, indexFrom).trim().length == 0 || query.substring(selEnd).trim().startsWith(",") || query.substring(selEnd).trim().toLowerCase().startsWith("from"))) {
        suffix = "";
      }
      vm.queryInput.setRangeText(value + suffix, selStart, selEnd, "end");
      //add query suffix if needed
      if (value.startsWith("FIELDS") && !query.toLowerCase().includes("limit")) {
        vm.queryInput.value += " LIMIT 200";
      }
      vm.queryAutocompleteHandler();
    };

    // Find the token we want to autocomplete. This is the selected text, or the last word before the cursor.
    let searchTerm = selStart != selEnd
      ? query.substring(selStart, selEnd)
      : query.substring(0, selStart).match(/[a-zA-Z0-9_]*$/)[0];
    selStart = selEnd - searchTerm.length;

    function sortRank({value, title}) {
      let i = 0;
      if (value.toLowerCase() == searchTerm.toLowerCase()) {
        return i;
      }
      i++;
      if (title.toLowerCase() == searchTerm.toLowerCase()) {
        return i;
      }
      i++;
      if (value.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (title.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (value.toLowerCase().includes("__" + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (value.toLowerCase().includes("_" + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      if (title.toLowerCase().includes(" " + searchTerm.toLowerCase())) {
        return i;
      }
      i++;
      return i;
    }
    function resultsSort(a, b) {
      return sortRank(a) - sortRank(b) || a.rank - b.rank || a.value.localeCompare(b.value);
    }

    // If we are just after the "from" keyword, autocomplete the sobject name
    if (query.substring(0, selStart).match(/(^|\s)from\s*$/i)) {
      let {globalStatus, globalDescribe} = vm.describeInfo.describeGlobal(useToolingApi);
      if (!globalDescribe) {
        switch (globalStatus) {
          case "loading":
            vm.autocompleteResults = {
              sobjectName: "",
              title: "Loading metadata...",
              results: []
            };
            return;
          case "loadfailed":
            vm.autocompleteResults = {
              sobjectName: "",
              title: "Loading metadata failed.",
              results: [{value: "Retry", title: "Retry"}]
            };
            vm.autocompleteClick = vm.autocompleteReload.bind(vm);
            return;
          default:
            vm.autocompleteResults = {
              sobjectName: "",
              title: "Unexpected error: " + globalStatus,
              results: []
            };
            return;
        }
      }
      vm.autocompleteResults = {
        sobjectName: "",
        title: "Objects suggestions:",
        results: new Enumerable(globalDescribe.sobjects)
          .filter(sobjectDescribe => sobjectDescribe.name.toLowerCase().includes(searchTerm.toLowerCase()) || sobjectDescribe.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(sobjectDescribe => ({value: sobjectDescribe.name, title: sobjectDescribe.label, suffix: " ", rank: 1, autocompleteType: "object", dataType: ""}))
          .toArray()
          .sort(resultsSort)
      };
      return;
    }

    let sobjectName, isAfterFrom;
    // Find out what sobject we are querying, by using the word after the "from" keyword.
    // Assuming no subqueries in the select clause, we should find the correct sobjectName. There should be only one "from" keyword, and strings (which may contain the word "from") are only allowed after the real "from" keyword.
    let fromKeywordMatch = /(^|\s)from\s+([a-z0-9_]*)/i.exec(query);
    if (fromKeywordMatch) {
      sobjectName = fromKeywordMatch[2];
      isAfterFrom = selStart > fromKeywordMatch.index + 1;
    } else {
      // We still want to find the from keyword if the user is typing just before the keyword, and there is no space.
      fromKeywordMatch = /^from\s+([a-z0-9_]*)/i.exec(query.substring(selEnd));
      if (fromKeywordMatch) {
        sobjectName = fromKeywordMatch[1];
        isAfterFrom = false;
      } else {
        vm.autocompleteResults = {
          sobjectName: "",
          title: "\"from\" keyword not found",
          results: []
        };
        return;
      }
    }
    // If we are in a subquery, try to detect that.
    fromKeywordMatch = /\(\s*select.*\sfrom\s+([a-z0-9_]*)/i.exec(query);
    if (fromKeywordMatch && fromKeywordMatch.index < selStart) {
      let subQuery = query.substring(fromKeywordMatch.index, selStart);
      // Try to detect if the subquery ends before the selection
      if (subQuery.split(")").length < subQuery.split("(").length) {
        sobjectName = fromKeywordMatch[1];
        isAfterFrom = selStart > fromKeywordMatch.index + fromKeywordMatch[0].length;
      }
    }
    let {sobjectStatus, sobjectDescribe} = vm.describeInfo.describeSobject(useToolingApi, sobjectName);
    if (!sobjectDescribe) {
      switch (sobjectStatus) {
        case "loading":
          vm.autocompleteResults = {
            sobjectName,
            title: "Loading " + sobjectName + " metadata...",
            results: []
          };
          return;
        case "loadfailed":
          vm.autocompleteResults = {
            sobjectName,
            title: "Loading " + sobjectName + " metadata failed.",
            results: [{value: "Retry", title: "Retry"}]
          };
          vm.autocompleteClick = vm.autocompleteReload.bind(vm);
          return;
        case "notfound":
          vm.autocompleteResults = {
            sobjectName,
            title: "Unknown object: " + sobjectName,
            results: []
          };
          return;
        default:
          vm.autocompleteResults = {
            sobjectName,
            title: "Unexpected error for object: " + sobjectName + ": " + sobjectStatus,
            results: []
          };
          return;
      }
    }

    /*
     * The context of a field is used to support queries on relationship fields.
     *
     * For example: If the cursor is at the end of the query "select Id from Contact where Account.Owner.Usern"
     * then the the searchTerm we want to autocomplete is "Usern", the contextPath is "Account.Owner." and the sobjectName is "Contact"
     *
     * When autocompleting field values in the query "select Id from Contact where Account.Type = 'Cus"
     * then the searchTerm we want to autocomplete is "Cus", the fieldName is "Type", the contextPath is "Account." and the sobjectName is "Contact"
     */

    let contextEnd = selStart;

    // If we are on the right hand side of a comparison operator, autocomplete field values
    let isFieldValue = query.substring(0, selStart).match(/\s*[<>=!]+\s*('?[^'\s]*)$/);
    let fieldName = null;
    if (isFieldValue) {
      let fieldEnd = selStart - isFieldValue[0].length;
      fieldName = query.substring(0, fieldEnd).match(/[a-zA-Z0-9_]*$/)[0];
      contextEnd = fieldEnd - fieldName.length;
      selStart -= isFieldValue[1].length;
    }

    /*
    contextSobjectDescribes is a set of describe results for the relevant context sobjects.
    Example: "select Subject, Who.Name from Task"
    The context sobjects for "Subject" is {"Task"}.
    The context sobjects for "Who" is {"Task"}.
    The context sobjects for "Name" is {"Contact", "Lead"}.
    */
    let contextSobjectDescribes = new Enumerable([sobjectDescribe]);
    let contextPath = query.substring(0, contextEnd).match(/[a-zA-Z0-9_.]*$/)[0];
    let sobjectStatuses = new Map(); // Keys are error statuses, values are an object name with that status. Only one object name in the value, since we only show one error message.
    if (contextPath) {
      let contextFields = contextPath.split(".");
      contextFields.pop(); // always empty
      for (let referenceFieldName of contextFields) {
        let newContextSobjectDescribes = new Set();
        for (let referencedSobjectName of contextSobjectDescribes
          .flatMap(contextSobjectDescribe => contextSobjectDescribe.fields)
          .filter(field => field.relationshipName && field.relationshipName.toLowerCase() == referenceFieldName.toLowerCase())
          .flatMap(field => field.referenceTo)
        ) {
          let {sobjectStatus, sobjectDescribe} = vm.describeInfo.describeSobject(useToolingApi, referencedSobjectName);
          if (sobjectDescribe) {
            newContextSobjectDescribes.add(sobjectDescribe);
          } else {
            sobjectStatuses.set(sobjectStatus, referencedSobjectName);
          }
        }
        contextSobjectDescribes = new Enumerable(newContextSobjectDescribes);
      }
    }

    if (!contextSobjectDescribes.some()) {
      if (sobjectStatuses.has("loading")) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Loading " + sobjectStatuses.get("loading") + " metadata...",
          results: []
        };
        return;
      }
      if (sobjectStatuses.has("loadfailed")) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Loading " + sobjectStatuses.get("loadfailed") + " metadata failed.",
          results: [{value: "Retry", title: "Retry"}]
        };
        vm.autocompleteClick = vm.autocompleteReload.bind(vm);
        return;
      }
      if (sobjectStatuses.has("notfound")) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Unknown object: " + sobjectStatuses.get("notfound"),
          results: []
        };
        return;
      }
      if (sobjectStatuses.size > 0) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Unexpected error: " + sobjectStatus,
          results: []
        };
        return;
      }
      vm.autocompleteResults = {
        sobjectName,
        title: "Unknown field: " + sobjectName + "." + contextPath,
        results: []
      };
      return;
    }

    if (isFieldValue) {
      // Autocomplete field values
      let contextValueFields = contextSobjectDescribes
        .flatMap(sobjectDescribe => sobjectDescribe.fields
          .filter(field => field.name.toLowerCase() == fieldName.toLowerCase())
          .map(field => ({sobjectDescribe, field}))
        )
        .toArray();
      if (contextValueFields.length == 0) {
        vm.autocompleteResults = {
          sobjectName,
          title: "Unknown field: " + sobjectDescribe.name + "." + contextPath + fieldName,
          results: []
        };
        return;
      }
      let fieldNames = contextValueFields.map(contextValueField => contextValueField.sobjectDescribe.name + "." + contextValueField.field.name).join(", ");
      if (ctrlSpace) {
        // Since this performs a Salesforce API call, we ask the user to opt in by pressing Ctrl+Space
        if (contextValueFields.length > 1) {
          vm.autocompleteResults = {
            sobjectName,
            title: "Multiple possible fields: " + fieldNames,
            results: []
          };
          return;
        }
        let contextValueField = contextValueFields[0];
        let queryMethod = useToolingApi ? "tooling/query" : vm.queryAll ? "queryAll" : "query";
        let acQuery = "select " + contextValueField.field.name + " from " + contextValueField.sobjectDescribe.name + " where " + contextValueField.field.name + " like '%" + searchTerm.replace(/'/g, "\\'") + "%' group by " + contextValueField.field.name + " limit 100";
        vm.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/" + queryMethod + "/?q=" + encodeURIComponent(acQuery), {progressHandler: vm.autocompleteProgress})
          .catch(err => {
            if (err.name != "AbortError") {
              vm.autocompleteResults = {
                sobjectName,
                title: "Error: " + err.message,
                results: []
              };
            }
            return null;
          })
          .then(data => {
            vm.autocompleteProgress = {};
            if (!data) {
              return;
            }
            vm.autocompleteResults = {
              sobjectName,
              title: fieldNames + " values suggestions:",
              results: new Enumerable(data.records)
                .map(record => record[contextValueField.field.name])
                .filter(value => value)
                .map(value => ({value: "'" + value + "'", title: value, suffix: " ", rank: 1, autocompleteType: "fieldValue"}))
                .toArray()
                .sort(resultsSort)
            };
          }));
        vm.autocompleteResults = {
          sobjectName,
          title: "Loading " + fieldNames + " values...",
          results: []
        };
        return;
      }
      let ar = new Enumerable(contextValueFields).flatMap(function* ({field}) {
        yield* field.picklistValues.map(pickVal => ({value: "'" + pickVal.value + "'", title: pickVal.label, suffix: " ", rank: 1, autocompleteType: "picklistValue", dataType: ""}));
        if (field.type == "boolean") {
          yield {value: "true", title: "true", suffix: " ", rank: 1};
          yield {value: "false", title: "false", suffix: " ", rank: 1};
        }
        if (field.type == "date" || field.type == "datetime") {
          let pad = (n, d) => ("000" + n).slice(-d);
          let d = new Date();
          if (field.type == "date") {
            yield {value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2), title: "Today", suffix: " ", rank: 1};
          }
          if (field.type == "datetime") {
            yield {
              value: pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2) + "T"
                + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" + pad(d.getSeconds(), 2) + "." + pad(d.getMilliseconds(), 3)
                + (d.getTimezoneOffset() <= 0 ? "+" : "-") + pad(Math.floor(Math.abs(d.getTimezoneOffset()) / 60), 2)
                + ":" + pad(Math.abs(d.getTimezoneOffset()) % 60, 2),
              title: "Now",
              suffix: " ",
              rank: 1
            };
          }
          // from https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select_dateformats.htm Winter 24
          yield {value: "YESTERDAY", title: "Starts 12:00:00 the day before and continues for 24 hours.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "TODAY", title: "Starts 12:00:00 of the current day and continues for 24 hours.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "TOMORROW", title: "Starts 12:00:00 after the current day and continues for 24 hours.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_WEEK", title: "Starts 12:00:00 on the first day of the week before the most recent first day of the week and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "THIS_WEEK", title: "Starts 12:00:00 on the most recent first day of the week before the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_WEEK", title: "Starts 12:00:00 on the most recent first day of the week after the current day and continues for seven full days. First day of the week is determined by your locale.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_MONTH", title: "Starts 12:00:00 on the first day of the month before the current day and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "THIS_MONTH", title: "Starts 12:00:00 on the first day of the month that the current day is in and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_MONTH", title: "Starts 12:00:00 on the first day of the month after the month that the current day is in and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the last 90 days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_90_DAYS", title: "Starts 12:00:00 of the current day and continues for the next 90 days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the last n days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_N_DAYS:n", title: "For the number n provided, starts 12:00:00 of the current day and continues for the next n days.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next week and continues for the next n weeks.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "N_DAYS_AGO:n", title: "Starts at 12:00:00 AM on the day n days before the current day and continues for 24 hours. (The range doesn’t include today.)", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_N_WEEKS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous week and continues for the last n weeks.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "N_WEEKS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the month that started n months before the start of the current month and continues for all the days of that month.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the first day of the next month and continues for the next n months.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_N_MONTHS:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous month and continues for the last n months.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "N_MONTHS_AGO:n", title: "For the number n provided, starts 12:00:00 of the last day of the previous month and continues for the last n months.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "THIS_QUARTER", title: "Starts 12:00:00 of the current quarter and continues to the end of the current quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_QUARTER", title: "Starts 12:00:00 of the previous quarter and continues to the end of that quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_QUARTER", title: "Starts 12:00:00 of the next quarter and continues to the end of that quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_N_QUARTERS:n", title: "Starts 12:00:00 of the next quarter and continues to the end of the nth quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_N_QUARTERS:n", title: "Starts 12:00:00 of the previous quarter and continues to the end of the previous nth quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "N_QUARTERS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the calendar quarter n quarters before the current calendar quarter and continues to the end of that quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "THIS_YEAR", title: "Starts 12:00:00 on January 1 of the current year and continues through the end of December 31 of the current year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_YEAR", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of that year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_YEAR", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of that year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the following year and continues through the end of December 31 of the nth year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_N_YEARS:n", title: "Starts 12:00:00 on January 1 of the previous year and continues through the end of December 31 of the previous nth year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "N_YEARS_AGO:n", title: "Starts at 12:00:00 AM on January 1 of the calendar year n years before the current calendar year and continues through the end of December 31 of that year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "THIS_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the current fiscal quarter and continues through the end of the last day of the fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_FISCAL_QUARTER", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of that fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the next fiscal quarter and continues through the end of the last day of the nth fiscal quarter. The fiscal year is defined in the company profile under Setup atCompany Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_N_FISCAL_QUARTERS:n", title: "Starts 12:00:00 on the first day of the last fiscal quarter and continues through the end of the last day of the previous nth fiscal quarter. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "N_FISCAL_QUARTERS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the fiscal quarter n fiscal quarters before the current fiscal quarter and continues through the end of the last day of that fiscal quarter.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "THIS_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the current fiscal year and continues through the end of the last day of the fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_FISCAL_YEAR", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of that fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "NEXT_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the next fiscal year and continues through the end of the last day of the nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "LAST_N_FISCAL_YEARS:n", title: "Starts 12:00:00 on the first day of the last fiscal year and continues through the end of the last day of the previous nth fiscal year. The fiscal year is defined in the company profile under Setup at Company Profile | Fiscal Year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
          yield {value: "N_FISCAL_YEARS_AGO:n", title: "Starts at 12:00:00 AM on the first day of the fiscal year n fiscal years ago and continues through the end of the last day of that fiscal year.", suffix: " ", rank: 1, autocompleteType: "variable", dataType: ""};
        }
        if (field.nillable) {
          yield {value: "null", title: "null", suffix: " ", rank: 1, autocompleteType: "null", dataType: ""};
        }
      })
        .filter(res => res.value.toLowerCase().includes(searchTerm.toLowerCase()) || res.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .toArray()
        .sort(resultsSort);
      vm.autocompleteResults = {
        sobjectName,
        title: fieldNames + (ar.length == 0 ? " values (Press Ctrl+Space to load suggestions):" : " values:"),
        results: ar
      };
      return;
    } else {
      // Autocomplete field names and functions
      if (ctrlSpace) {
        let ar = contextSobjectDescribes
          .flatMap(sobjectDescribe => sobjectDescribe.fields)
          .filter(field => field.name.toLowerCase().includes(searchTerm.toLowerCase()) || field.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(field => contextPath + field.name)
          .toArray();
        if (ar.length > 0) {
          vm.queryInput.focus();
          vm.queryInput.setRangeText(ar.join(", ") + (isAfterFrom ? " " : ""), selStart - contextPath.length, selEnd, "end");
        }
        vm.queryAutocompleteHandler();
        return;
      }
      vm.autocompleteResults = {
        sobjectName,
        title: contextSobjectDescribes.map(sobjectDescribe => sobjectDescribe.name).toArray().join(", ") + " fields suggestions:",
        results: contextSobjectDescribes
          .flatMap(sobjectDescribe => sobjectDescribe.fields)
          .filter(field => field.name.toLowerCase().includes(searchTerm.toLowerCase()) || field.label.toLowerCase().includes(searchTerm.toLowerCase()))
          .flatMap(function* (field) {
            yield {value: field.name, title: field.label, suffix: isAfterFrom ? " " : ", ", rank: 1, autocompleteType: "fieldName", dataType: field.type};
            if (field.relationshipName) {
              yield {value: field.relationshipName + ".", title: field.label, suffix: "", rank: 1, autocompleteType: "relationshipName", dataType: ""};
            }
          })
          .concat(
            new Enumerable(["FIELDS(ALL)", "FIELDS(STANDARD)", "FIELDS(CUSTOM)", "AVG", "COUNT", "COUNT_DISTINCT", "MIN", "MAX", "SUM", "CALENDAR_MONTH", "CALENDAR_QUARTER", "CALENDAR_YEAR", "DAY_IN_MONTH", "DAY_IN_WEEK", "DAY_IN_YEAR", "DAY_ONLY", "FISCAL_MONTH", "FISCAL_QUARTER", "FISCAL_YEAR", "HOUR_IN_DAY", "WEEK_IN_MONTH", "WEEK_IN_YEAR", "convertTimezone", "toLabel"])
              .filter(fn => fn.toLowerCase().startsWith(searchTerm.toLowerCase()))
              .map(fn => {
                if (fn.includes(")")) { //Exception to easily support functions with hardcoded parameter options
                  return {value: fn, title: fn, suffix: "", rank: 2, autocompleteType: "variable", dataType: ""};
                } else {
                  return {value: fn, title: fn + "()", suffix: "(", rank: 2, autocompleteType: "variable", dataType: ""};
                }
              })
          )
          .toArray()
          .sort(resultsSort)
      };
      return;
    }
  }
  doExport() {
    let vm = this; // eslint-disable-line consistent-this
    let exportedData = new RecordTable(vm);
    exportedData.isTooling = vm.queryTooling;
    exportedData.describeInfo = vm.describeInfo;
    exportedData.sfHost = vm.sfHost;
    let query = vm.queryInput.value;
    let queryMethod = exportedData.isTooling ? "tooling/query" : vm.queryAll ? "queryAll" : "query";
    function batchHandler(batch) {
      return batch.catch(err => {
        if (err.name == "AbortError") {
          return {records: [], done: true, totalSize: -1};
        }
        throw err;
      }).then(data => {
        exportedData.addToTable(data.records);
        if (data.totalSize != -1) {
          exportedData.totalSize = data.totalSize;
        }
        if (!data.done) {
          let pr = batchHandler(sfConn.rest(data.nextRecordsUrl, {progressHandler: vm.exportProgress}));
          vm.isWorking = true;
          vm.exportStatus = "Exporting... Completed " + exportedData.records.length + " of " + exportedData.totalSize + " record(s)";
          vm.exportError = null;
          vm.exportedData = exportedData;
          vm.updatedExportedData();
          vm.didUpdate();
          return pr;
        }
        vm.queryHistory.add({query, useToolingApi: exportedData.isTooling});
        if (exportedData.records.length == 0) {
          vm.isWorking = false;
          vm.exportStatus = data.totalSize > 0 ? "No data exported. " + data.totalSize + " record(s)." : "No data exported.";
          vm.exportError = null;
          vm.exportedData = exportedData;
          vm.updatedExportedData();
          return null;
        }
        vm.isWorking = false;
        vm.exportStatus = "Exported " + exportedData.records.length + (exportedData.records.length != exportedData.totalSize ? " of " + exportedData.totalSize : "") + " record(s)";
        vm.exportError = null;
        vm.exportedData = exportedData;
        vm.updatedExportedData();
        return null;
      }, err => {
        if (err.name != "SalesforceRestError") {
          throw err; // not a SalesforceRestError
        }
        if (exportedData.totalSize != -1) {
          // We already got some data. Show it, and indicate that not all data was exported
          vm.isWorking = false;
          vm.exportStatus = "Exported " + exportedData.records.length + " of " + exportedData.totalSize + " record(s). Stopped by error.";
          vm.exportError = null;
          vm.exportedData = exportedData;
          vm.updatedExportedData();
          return null;
        }
        vm.isWorking = false;
        vm.exportStatus = "Error";
        vm.exportError = err.message;
        vm.exportedData = null;
        vm.updatedExportedData();
        return null;
      });
    }
    vm.spinFor(batchHandler(sfConn.rest("/services/data/v" + apiVersion + "/" + queryMethod + "/?q=" + encodeURIComponent(query), {progressHandler: vm.exportProgress}))
      .catch(error => {
        console.error(error);
        vm.isWorking = false;
        vm.exportStatus = "Error";
        vm.exportError = "UNEXPECTED EXCEPTION:" + error;
        vm.exportedData = null;
        vm.updatedExportedData();
      }));
    vm.setResultsFilter("");
    vm.isWorking = true;
    vm.exportStatus = "Exporting...";
    vm.exportError = null;
    vm.exportedData = exportedData;
    vm.updatedExportedData();
  }
  stopExport() {
    this.exportProgress.abort();
  }
}

function RecordTable(vm) {
  /*
  We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
  This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
  We don't care, because we don't need a stable set of columns for our use case.
  */
  let columnIdx = new Map();
  let header = ["_"];
  function discoverColumns(record, prefix, row) {
    for (let field in record) {
      if (field == "attributes") {
        continue;
      }
      let column = prefix + field;
      let c;
      if (columnIdx.has(column)) {
        c = columnIdx.get(column);
      } else {
        c = header.length;
        columnIdx.set(column, c);
        for (let row of rt.table) {
          row.push(undefined);
        }
        header[c] = column;
        rt.colVisibilities.push(true);
      }
      row[c] = record[field];
      if (typeof record[field] == "object" && record[field] != null) {
        discoverColumns(record[field], column + ".", row);
      }
    }
  }
  function cellToString(cell) {
    if (cell == null) {
      return "";
    } else if (typeof cell == "object" && cell.attributes && cell.attributes.type) {
      return "[" + cell.attributes.type + "]";
    } else {
      return "" + cell;
    }
  }
  let isVisible = (row, filter) => !filter || row.some(cell => cellToString(cell).toLowerCase().includes(filter.toLowerCase()));
  let rt = {
    records: [],
    table: [],
    rowVisibilities: [],
    colVisibilities: [true],
    countOfVisibleRecords: null,
    isTooling: false,
    totalSize: -1,
    addToTable(expRecords) {
      rt.records = rt.records.concat(expRecords);
      if (rt.table.length == 0 && expRecords.length > 0) {
        rt.table.push(header);
        rt.rowVisibilities.push(true);
      }
      let filter = vm.resultsFilter;
      for (let record of expRecords) {
        let row = new Array(header.length);
        row[0] = record;
        rt.table.push(row);
        rt.rowVisibilities.push(isVisible(row, filter));
        discoverColumns(record, "", row);
      }
    },
    csvSerialize: separator => rt.getVisibleTable().map(row => row.map(cell => "\"" + cellToString(cell).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n"),
    updateVisibility() {
      let filter = vm.resultsFilter;
      let countOfVisibleRecords = 0;
      for (let r = 1/* always show header */; r < rt.table.length; r++) {
        rt.rowVisibilities[r] = isVisible(rt.table[r], filter);
        if (isVisible(rt.table[r], filter)) countOfVisibleRecords++;
      }
      this.countOfVisibleRecords = countOfVisibleRecords;
    },
    getVisibleTable() {
      if (vm.resultsFilter) {
        let filteredTable = [];
        for (let i = 0; i < rt.table.length; i++) {
          if (rt.rowVisibilities[i])
            filteredTable.push(rt.table[i]);
        }
        return filteredTable;
      }
      return rt.table;
    }
  };
  return rt;
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onQueryAllChange = this.onQueryAllChange.bind(this);
    this.onQueryToolingChange = this.onQueryToolingChange.bind(this);
    this.onSelectHistoryEntry = this.onSelectHistoryEntry.bind(this);
    this.onSelectQueryTemplate = this.onSelectQueryTemplate.bind(this);
    this.onClearHistory = this.onClearHistory.bind(this);
    this.onSelectSavedEntry = this.onSelectSavedEntry.bind(this);
    this.onAddToHistory = this.onAddToHistory.bind(this);
    this.onSaveClientId = this.onSaveClientId.bind(this);
    this.onRemoveFromHistory = this.onRemoveFromHistory.bind(this);
    this.onClearSavedHistory = this.onClearSavedHistory.bind(this);
    this.onToggleHelp = this.onToggleHelp.bind(this);
    this.onToggleExpand = this.onToggleExpand.bind(this);
    this.onToggleSavedOptions = this.onToggleSavedOptions.bind(this);
    this.onExport = this.onExport.bind(this);
    this.onCopyQuery = this.onCopyQuery.bind(this);
    this.onCopyAsExcel = this.onCopyAsExcel.bind(this);
    this.onCopyAsCsv = this.onCopyAsCsv.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onDeleteRecords = this.onDeleteRecords.bind(this);
    this.onResultsFilterInput = this.onResultsFilterInput.bind(this);
    this.onSetQueryName = this.onSetQueryName.bind(this);
    this.onSetClientId = this.onSetClientId.bind(this);
    this.onStopExport = this.onStopExport.bind(this);
  }
  onQueryAllChange(e) {
    let {model} = this.props;
    model.queryAll = e.target.checked;
    model.didUpdate();
  }
  onQueryToolingChange(e) {
    let {model} = this.props;
    model.queryTooling = e.target.checked;
    model.queryAutocompleteHandler();
    model.didUpdate();
  }
  onSelectHistoryEntry(e) {
    let {model} = this.props;
    model.selectedHistoryEntry = JSON.parse(e.target.value);
    model.selectHistoryEntry();
    model.didUpdate();
  }
  onSelectQueryTemplate(e) {
    let {model} = this.props;
    model.selectedQueryTemplate = e.target.value;
    model.selectQueryTemplate();
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
  onSelectSavedEntry(e) {
    let {model} = this.props;
    model.selectedSavedEntry = JSON.parse(e.target.value);
    model.selectSavedEntry();
    model.didUpdate();
  }
  onAddToHistory(e) {
    e.preventDefault();
    let {model} = this.props;
    model.addToHistory();
    model.didUpdate();
  }
  onSaveClientId(e) {
    e.preventDefault();
    let {model} = this.props;
    model.saveClientId();
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
  onToggleHelp(e) {
    e.preventDefault();
    let {model} = this.props;
    model.toggleHelp();
    model.didUpdate();
  }
  onToggleExpand(e) {
    e.preventDefault();
    let {model} = this.props;
    model.toggleExpand();
    model.didUpdate();
  }
  onToggleSavedOptions(e) {
    e.preventDefault();
    let {model} = this.props;
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onExport() {
    let {model} = this.props;
    model.doExport();
    model.didUpdate();
  }
  onCopyQuery() {
    let {model} = this.props;
    let url = new URL(window.location.href);
    let searchParams = url.searchParams;
    searchParams.set("query", model.queryInput.value);
    url.search = searchParams.toString();
    navigator.clipboard.writeText(url.toString());
    navigator.clipboard.writeText(url.toString());
    model.didUpdate();
  }
  onCopyAsExcel() {
    let {model} = this.props;
    model.copyAsExcel();
    model.didUpdate();
  }
  onCopyAsCsv() {
    let {model} = this.props;
    model.copyAsCsv();
    model.didUpdate();
  }
  onCopyAsJson() {
    let {model} = this.props;
    model.copyAsJson();
    model.didUpdate();
  }
  onDeleteRecords(e) {
    let {model} = this.props;
    model.deleteRecords(e);
    model.didUpdate();
  }
  onResultsFilterInput(e) {
    let {model} = this.props;
    model.setResultsFilter(e.target.value);
    model.didUpdate();
  }
  onSetQueryName(e) {
    let {model} = this.props;
    model.setQueryName(e.target.value);
    model.didUpdate();
  }
  onSetClientId(e) {
    let {model} = this.props;
    model.setClientId(e.target.value);
    model.didUpdate();
  }
  onStopExport() {
    let {model} = this.props;
    model.stopExport();
    model.didUpdate();
  }
  componentDidMount() {
    let {model} = this.props;
    let queryInput = this.refs.query;

    model.setQueryInput(queryInput);
    //Set the cursor focus on query text area
    if (localStorage.getItem("disableQueryInputAutoFocus") !== "true"){
      queryInput.focus();
    }

    function queryAutocompleteEvent() {
      model.queryAutocompleteHandler();
      model.didUpdate();
    }
    queryInput.addEventListener("input", queryAutocompleteEvent);
    queryInput.addEventListener("select", queryAutocompleteEvent);
    // There is no event for when caret is moved without any selection or value change, so use keyup and mouseup for that.
    queryInput.addEventListener("keyup", queryAutocompleteEvent);
    queryInput.addEventListener("mouseup", queryAutocompleteEvent);

    // We do not want to perform Salesforce API calls for autocomplete on every keystroke, so we only perform these when the user pressed Ctrl+Space
    // Chrome on Linux does not fire keypress when the Ctrl key is down, so we listen for keydown. Might be https://code.google.com/p/chromium/issues/detail?id=13891#c50
    queryInput.addEventListener("keydown", e => {
      if (e.ctrlKey && e.key == " ") {
        e.preventDefault();
        model.queryAutocompleteHandler({ctrlSpace: true});
        model.didUpdate();
      }
    });
    addEventListener("keydown", e => {
      if (e.ctrlKey && e.key == "Enter" || e.key == "F5") {
        e.preventDefault();
        model.doExport();
        model.didUpdate();
      }
    });

    this.scrollTable = initScrollTable(this.refs.scroller);
    model.resultTableCallback = this.scrollTable.dataChange;

    let recalculateHeight = this.recalculateSize.bind(this);
    if (!window.webkitURL) {
      // Firefox
      // Firefox does not fire a resize event. The next best thing is to listen to when the browser changes the style.height attribute.
      new MutationObserver(recalculateHeight).observe(queryInput, {attributes: true});
    } else {
      // Chrome
      // Chrome does not fire a resize event and does not allow us to get notified when the browser changes the style.height attribute.
      // Instead we listen to a few events which are often fired at the same time.
      // This is not required in Firefox, and Mozilla reviewers don't like it for performance reasons, so we only do this in Chrome via browser detection.
      queryInput.addEventListener("mousemove", recalculateHeight);
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
  }
  recalculateSize() {
    // Investigate if we can use the IntersectionObserver API here instead, once it is available.
    this.scrollTable.viewportChange();
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
        h("h1", {}, "Data Export"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},
          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          ),
          h("a", {href: "#", id: "help-btn", title: "Export Help", onClick: this.onToggleHelp},
            h("div", {className: "icon"})
          ),
        ),
      ),
      h("div", {className: "area"},
        h("div", {className: "area-header"},
        ),
        h("div", {className: "query-controls"},
          h("h1", {}, "Export Query"),
          h("div", {className: "query-history-controls"},
            h("select", {value: "", onChange: this.onSelectQueryTemplate, className: "query-history", title: "Check documentation to customize templates"},
              h("option", {value: null, disabled: true, defaultValue: true, hidden: true}, "Templates"),
              model.queryTemplates.map(q => h("option", {key: q, value: q}, q))
            ),
            h("div", {className: "button-group"},
              h("select", {value: JSON.stringify(model.selectedHistoryEntry), onChange: this.onSelectHistoryEntry, className: "query-history"},
                h("option", {value: JSON.stringify(null), disabled: true}, "Query History"),
                model.queryHistory.list.map(q => h("option", {key: JSON.stringify(q), value: JSON.stringify(q)}, q.query.substring(0, 300)))
              ),
              h("button", {onClick: this.onClearHistory, title: "Clear Query History"}, "Clear")
            ),
            h("div", {className: "pop-menu saveOptions", hidden: !model.expandSavedOptions},
              h("a", {href: "#", onClick: this.onRemoveFromHistory, title: "Remove query from saved history"}, "Remove Saved Query"),
              h("a", {href: "#", onClick: this.onClearSavedHistory, title: "Clear saved history"}, "Clear Saved Queries")
            ),
            h("div", {className: "button-group"},
              h("select", {value: JSON.stringify(model.selectedSavedEntry), onChange: this.onSelectSavedEntry, className: "query-history"},
                h("option", {value: JSON.stringify(null), disabled: true}, "Saved Queries"),
                model.savedHistory.list.map(q => h("option", {key: JSON.stringify(q), value: JSON.stringify(q)}, q.query.substring(0, 300)))
              ),
              h("input", {placeholder: "Query Label", type: "save", value: model.queryName, onInput: this.onSetQueryName}),
              h("button", {onClick: this.onAddToHistory, title: "Add query to saved history"}, "Save Query"),
              h("button", {className: model.expandSavedOptions ? "toggle contract" : "toggle expand", title: "Show More Options", onClick: this.onToggleSavedOptions}, h("div", {className: "button-toggle-icon"})),
              h("input", {placeholder: "Consumer Key", type: "default", value: model.clientId, onInput: this.onSetClientId}),
              h("button", {onClick: this.onSaveClientId, title: "Save Consumer Key"}, "Save"),
            ),
          ),
          h("div", {className: "query-options"},
            h("label", {},
              h("input", {type: "checkbox", checked: model.queryAll, onChange: this.onQueryAllChange, disabled: model.queryTooling}),
              " ",
              h("span", {}, "Add deleted records?")
            ),
            h("label", {title: "With the tooling API you can query more metadata, but you cannot query regular data"},
              h("input", {type: "checkbox", checked: model.queryTooling, onChange: this.onQueryToolingChange, disabled: model.queryAll}),
              " ",
              h("span", {}, "Tooling API?")
            ),
          ),
        ),
        h("textarea", {id: "query", ref: "query", style: {maxHeight: (model.winInnerHeight - 200) + "px"}}),
        h("div", {className: "autocomplete-box" + (model.expandAutocomplete ? " expanded" : "")},
          h("div", {className: "autocomplete-header"},
            h("span", {}, model.autocompleteResults.title),
            h("div", {className: "flex-right"},
              h("button", {tabIndex: 1, disabled: model.isWorking, onClick: this.onExport, title: "Ctrl+Enter / F5", className: "highlighted"}, "Run Export"),
              h("button", {tabIndex: 2, onClick: this.onCopyQuery, title: "Copy query url", className: "copy-id"}, "Export Query"),
              h("a", {tabIndex: 3, className: "button", hidden: !model.autocompleteResults.sobjectName, href: model.showDescribeUrl(), target: "_blank", title: "Show field info for the " + model.autocompleteResults.sobjectName + " object"}, model.autocompleteResults.sobjectName + " Field Info"),
              h("button", {tabIndex: 4, href: "#", className: model.expandAutocomplete ? "toggle contract" : "toggle expand", onClick: this.onToggleExpand, title: "Show all suggestions or only the first line"},
                h("div", {className: "button-icon"}),
                h("div", {className: "button-toggle-icon"})
              )
            ),
          ),
          h("div", {className: "autocomplete-results"},
            model.autocompleteResults.results.map(r =>
              h("div", {className: "autocomplete-result", key: r.value}, h("a", {tabIndex: 0, title: r.title, onClick: e => { e.preventDefault(); model.autocompleteClick(r); model.didUpdate(); }, href: "#", className: r.autocompleteType + " " + r.dataType}, h("div", {className: "autocomplete-icon"}), r.value), " ")
            )
          ),
        ),
        h("div", {hidden: !model.showHelp, className: "help-text"},
          h("h3", {}, "Export Help"),
          h("p", {}, "Use for quick one-off data exports. Enter a ", h("a", {href: "http://www.salesforce.com/us/developer/docs/soql_sosl/", target: "_blank"}, "SOQL query"), " in the box above and press Export."),
          h("p", {}, "Press Ctrl+Space to insert all field name autosuggestions or to load suggestions for field values."),
          h("p", {}, "Press Ctrl+Enter or F5 to execute the export."),
          h("p", {}, "Supports the full SOQL language. The columns in the CSV output depend on the returned data. Using subqueries may cause the output to grow rapidly. Bulk API is not supported. Large data volumes may freeze or crash your browser.")
        )
      ),
      h("div", {className: "area", id: "result-area"},
        h("div", {className: "result-bar"},
          h("h1", {}, "Export Result"),
          h("div", {className: "button-group"},
            h("button", {disabled: !model.canCopy(), onClick: this.onCopyAsExcel, title: "Copy exported data to clipboard for pasting into Excel or similar"}, "Copy (Excel format)"),
            h("button", {disabled: !model.canCopy(), onClick: this.onCopyAsCsv, title: "Copy exported data to clipboard for saving as a CSV file"}, "Copy (CSV)"),
            h("button", {disabled: !model.canCopy(), onClick: this.onCopyAsJson, title: "Copy raw API output to clipboard"}, "Copy (JSON)"),
            h("button", {disabled: !model.canDelete(), onClick: this.onDeleteRecords, title: "Open the 'Data Import' page with preloaded records to delete. 'Id' field needs to be queried", className: "delete-btn"}, "Delete Records"),
          ),
          h("input", {placeholder: "Filter Results", type: "search", value: model.resultsFilter, onInput: this.onResultsFilterInput}),
          h("span", {className: "result-status flex-right"},
            h("span", {}, model.exportStatus),
            h("button", {className: "cancel-btn", disabled: !model.isWorking, onClick: this.onStopExport}, "Stop"),
          )
        ),
        h("textarea", {id: "result-text", readOnly: true, value: model.exportError || "", hidden: model.exportError == null}),
        h("div", {id: "result-table", ref: "scroller", hidden: model.exportError != null}
          /* the scroll table goes here */
        )
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
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model, sfConn});
    }

  });

}

function getLinkTarget(e) {
  if (localStorage.getItem("openLinksInNewTab") == "true" || (e.ctrlKey || e.metaKey)) {
    return "_blank";
  } else {
    return "_top";
  }
}

function getSeparator() {
  let separator = ",";
  if (localStorage.getItem("csvSeparator")) {
    separator = localStorage.getItem("csvSeparator");
  }
  return separator;
}
