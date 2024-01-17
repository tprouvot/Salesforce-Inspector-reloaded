/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {Enumerable, DescribeInfo, initScrollTable} from "./data-load.js";

class ScriptHistory {
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
    let historyIndex = history.findIndex(e => e.script == entry.script);
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
    let historyIndex = history.findIndex(e => e.script == entry.script);
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
    //sort only saved script not history
    if (storageKey === "insextSavedScriptHistory") {
      history.sort((a, b) => (a.script > b.script) ? 1 : ((b.script > a.script) ? -1 : 0));
    }
    this.list = history;
  }
}

class Model {
  constructor({sfHost, args}) {
    this.sfHost = sfHost;
    this.scriptInput = null;
    this.initialScript = "";
    this.describeInfo = new DescribeInfo(this.spinFor.bind(this), () => {
      this.scriptAutocompleteHandler({newDescribe: true});
      this.didUpdate();
    });

    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.numberOfLines = 1;
    this.showHelp = false;
    this.userInfo = "...";
    this.userId = null;
    this.winInnerHeight = 0;
    this.autocompleteResults = {sobjectName: "", title: "\u00A0", results: []};
    this.autocompleteClick = null;
    this.isWorking = false;
    this.executeStatus = "Ready";
    this.executeError = null;
    this.logs = null;
    this.scriptHistory = new ScriptHistory("insextScriptHistory", 100);
    this.selectedHistoryEntry = null;
    this.savedHistory = new ScriptHistory("insextSavedScriptHistory", 50);
    this.selectedSavedEntry = null;
    this.expandAutocomplete = false;
    this.expandSavedOptions = false;
    this.autocompleteState = "";
    this.autocompleteProgress = {};
    this.apexClasses = new RecordTable();
    this.scriptName = "";
    this.clientId = localStorage.getItem(sfHost + "_clientId") ? localStorage.getItem(sfHost + "_clientId") : "";
    this.scriptTemplates = localStorage.getItem("scriptTemplates") ? this.scriptTemplates = localStorage.getItem("scriptTemplates").split("//") : [
      "Id batchId= Database.executeBatch(new BatchExample(), 200);",
      "ID jobID = System.enqueueJob(new AsyncExecutionExample());"
    ];

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
      this.userId = res.userId;
      this.enableLogs();
    }));

    if (args.has("script")) {
      this.initialScript = args.get("script");
    } else if (this.scriptHistory.list[0]) {
      this.initialScript = this.scriptHistory.list[0].script;
    } else {
      this.initialScript = "";
    }

  }
  updatedLogs() {
    this.resultTableCallback(this.logs);
  }
  setscriptName(value) {
    this.scriptName = value;
  }
  setClientId(value) {
    this.clientId = value;
  }
  setScriptInput(scriptInput) {
    this.scriptInput = scriptInput;
    scriptInput.value = this.initialScript;
    this.initialScript = null;
  }
  toggleHelp() {
    this.showHelp = !this.showHelp;
  }
  toggleSavedOptions() {
    this.expandSavedOptions = !this.expandSavedOptions;
  }
  //TODO switch describeurl to analyse logs/ download log
  showDescribeUrl() {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", this.autocompleteResults.sobjectName);
    return "inspect.html?" + args;
  }
  selectHistoryEntry() {
    if (this.selectedHistoryEntry != null) {
      this.scriptInput.value = this.selectedHistoryEntry.script;
      this.scriptAutocompleteHandler();
      this.selectedHistoryEntry = null;
    }
  }
  selectScriptTemplate() {
    this.scriptInput.value = this.selectedScriptTemplate.trimStart();
    this.scriptInput.focus();
    let indexPos = this.scriptInput.value.toLowerCase().indexOf("from ");
    if (indexPos !== -1) {
      this.scriptInput.setRangeText("", indexPos + 5, indexPos + 5, "end");
    }
  }
  clearHistory() {
    this.scriptHistory.clear();
  }
  selectSavedEntry() {
    let delimiter = ":";
    if (this.selectedSavedEntry != null) {
      let scriptStr = "";
      if (this.selectedSavedEntry.script.includes(delimiter)) {
        let script = this.selectedSavedEntry.script.split(delimiter);
        this.scriptName = script[0];
        scriptStr = this.selectedSavedEntry.script.substring(this.selectedSavedEntry.script.indexOf(delimiter) + 1);
      } else {
        scriptStr = this.selectedSavedEntry.script;
      }
      this.scriptInput.value = scriptStr;
      this.scriptAutocompleteHandler();
      this.selectedSavedEntry = null;
    }
  }
  clearSavedHistory() {
    this.savedHistory.clear();
  }
  addToHistory() {
    this.savedHistory.add({script: this.getScriptToSave()});
  }
  saveClientId() {
    localStorage.setItem(this.sfHost + "_clientId", this.clientId);
  }
  removeFromHistory() {
    this.savedHistory.remove({script: this.getScriptToSave()});
  }
  getScriptToSave() {
    return this.scriptName != "" ? this.scriptName + ":" + this.scriptInput.value : this.scriptInput.value;
  }
  autocompleteReload() {
    this.describeInfo.reloadAll();
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

  resultsSort(searchTerm) {
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
    return function(a, b) {
      return sortRank(a) - sortRank(b) || a.rank - b.rank || a.value.localeCompare(b.value);
    };
  }

  autocompleteClass(vm, ctrlSpace) {
    let script = vm.scriptInput.value;
    let selStart = vm.scriptInput.selectionStart;
    let selEnd = vm.scriptInput.selectionEnd;
    let searchTerm = selStart != selEnd
      ? script.substring(selStart, selEnd)
      : script.substring(0, selStart).match(/[a-zA-Z0-9_]*$/)[0];
    selStart = selEnd - searchTerm.length;

    if (ctrlSpace) {
      //TODO if item selected => write it
      //return;
    }
    vm.autocompleteResults = {
      sobjectName: "ApexClass",
      title: "Class suggestions:",
      results: new Enumerable(vm.apexClasses.records)
        .filter(c => (c.Name.toLowerCase().includes(searchTerm.toLowerCase())))
        .map((c) => ({"value": (c.NamespacePrefix ? c.NamespacePrefix + "." : "") + c.Name, "title": (c.NamespacePrefix ? c.NamespacePrefix + "." : "") + c.Name, "suffix": " ", "rank": 1, "autocompleteType": "fieldName"}))
        .toArray()
        .sort(vm.resultsSort(searchTerm))
    };
  }

  /**
   * APEX script autocomplete handling.
   * TODO
   */
  scriptAutocompleteHandler(e = {}) {
    let vm = this; // eslint-disable-line consistent-this
    let script = vm.scriptInput.value;
    let selStart = vm.scriptInput.selectionStart;
    let selEnd = vm.scriptInput.selectionEnd;
    let ctrlSpace = e.ctrlSpace;
    let numberOfLines = script.split("\n").length;
    if (vm.numberOfLines != numberOfLines) {
      vm.numberOfLines = numberOfLines;
      vm.didUpdate();
    }
    //TODO https://phuoc.ng/collection/mirror-a-text-area/add-autocomplete-to-your-text-area/
    // Skip the calculation when no change is made. This improves performance and prevents async operations (Ctrl+Space) from being canceled when they should not be.
    let newAutocompleteState = [script, selStart, selEnd].join("$");
    if (newAutocompleteState == vm.autocompleteState && !ctrlSpace && !e.newDescribe) {
      return;
    }
    vm.autocompleteState = newAutocompleteState;

    // Cancel any async operation since its results will no longer be relevant.
    if (vm.autocompleteProgress.abort) {
      vm.autocompleteProgress.abort();
    }

    vm.autocompleteClick = ({value, suffix}) => {
      vm.scriptInput.focus();
      vm.scriptInput.setRangeText(value + suffix, selStart, selEnd, "end");
      vm.scriptAutocompleteHandler();
    };

    // Find the token we want to autocomplete. This is the selected text, or the last word before the cursor.
    let searchTerm = selStart != selEnd
      ? script.substring(selStart, selEnd)
      : script.substring(0, selStart).match(/[a-zA-Z0-9_]*$/)[0];
    selStart = selEnd - searchTerm.length;

    this.autocompleteClass(vm, false);
  }

  batchHandler(batch, vm, logs, onData) {
    return batch.catch(err => {
      if (err.name == "AbortError") {
        return {records: [], done: true, totalSize: -1};
      }
      throw err;
    }).then(data => {
      logs.addToTable(data.records);
      if (data.totalSize != -1) {
        logs.totalSize = data.totalSize;
      }
      if (!data.done) {
        let pr = vm.batchHandler(sfConn.rest(data.nextRecordsUrl, {}), vm, logs, onData);
        vm.executeError = null;
        vm.logs = logs;
        onData(false);
        vm.didUpdate();
        return pr;
      }
      if (logs.records.length == 0) {
        vm.executeError = null;
        vm.logs = logs;
        onData(true);
        return null;
      }
      vm.executeError = null;
      vm.logs = logs;
      onData(true);
      return null;
    }, err => {
      if (err.name != "SalesforceRestError") {
        throw err; // not a SalesforceRestError
      }
      if (logs.totalSize != -1) {
        // We already got some data. Show it, and indicate that not all data was executed
        vm.executeError = null;
        vm.logs = logs;
        onData(true);
        return null;
      }
      vm.executeStatus = "Error";
      vm.executeError = err.message;
      vm.logs = null;
      onData(true);
      return null;
    });
  }

  doExecute() {
    let vm = this; // eslint-disable-line consistent-this
    let script = vm.scriptInput.value;
    vm.spinFor(sfConn.rest("/services/data/v" + apiVersion + "/tooling/executeAnonymous/?anonymousBody=" + encodeURIComponent(script), {})
      .catch(error => {
        console.error(error);
        vm.executeStatus = "Error";
        vm.executeError = "UNEXPECTED EXCEPTION:" + error;
        vm.logs = null;
        vm.updatedLogs();
      })
      .then(result => {
        vm.autocompleteProgress = {};
        if (!result) {
          return;
        }
        if (result.success != true) {
          let error = "";
          if (!result.compiled) {
            error += result.line != -1 ? " (line :" + result.line + ", column :" + result.column + ") " : "";
            if (result.compileProblem != null) {
              error += result.compileProblem + "\n";
            }
          } else {
            vm.scriptHistory.add({script});
            if (result.exceptionMessage != null) {
              error += "UNEXPECTED EXCEPTION:" + result.exceptionMessage;
            }
            if (result.exceptionStackTrace != null) {
              error += result.exceptionStackTrace;
            }
          }
          console.error(error);
          vm.executeStatus = "Error";
          vm.executeError = error;
          vm.logs = null;
          vm.updatedLogs();
          return;
        }

      }));
  }
  stopExecut() {
    this.isWorking = false;
  }
  disableLogs() {
    //DO NOTHING because trace flag have is timed
  }
  getTraceFlags(DTnow, debugTimeInMs){
    try {
      const expirationDate = new Date(DTnow.getTime() + debugTimeInMs);
      let query = "query/?q=+SELECT+Id,ExpirationDate+FROM+TraceFlag+"
                  + "WHERE+TracedEntityid='" + this.userId + "'+"
                  + "AND+DebugLevel.DeveloperName='SFDC_DevConsole'+"
                  + "AND+StartDate<" + DTnow.toISOString() + "+"
                  + "AND+ExpirationDate<" + expirationDate.toISOString();
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/" + query, {method: "GET"});
    } catch (e){
      console.error(e);
      return null;
    }
  }
  insertTraceFlag(debugLogId, DTnow, debugTimeInMs){
    try {
      let newTraceFlag
          = {
            TracedEntityId: this.userId,
            DebugLevelId: debugLogId,
            LogType: "DEVELOPER_LOG",
            StartDate: DTnow,
            ExpirationDate: (DTnow.getTime() + debugTimeInMs),

          };
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/sobjects/traceflag", {method: "POST", body: newTraceFlag});
    } catch (e){
      console.error(e);
      return null;
    }
  }

  extendTraceFlag(traceFlagId, DTnow, debugTimeInMs){
    try {
      let traceFlagToUpdate = {StartDate: DTnow, ExpirationDate: (DTnow.getTime() + debugTimeInMs)};
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/sobjects/traceflag/" + traceFlagId, {method: "PATCH", body: traceFlagToUpdate});
    } catch (e){
      console.error(e);
      return null;
    }
  }
  getDebugLog(){
    try {
      let query = "query/?q=+SELECT+Id+FROM+DebugLevel+"
                    + "WHERE+DeveloperName='SFDC_DevConsole'";
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/" + query, {method: "GET"});
    } catch (e){
      console.error(e);
      return null;
    }
  }
  async enableLogs() {
    const DTnow = new Date(Date.now());
    const debugTimeInMs = 15 * 60 * 1000;

    let traceFlags = await this.getTraceFlags(DTnow, debugTimeInMs);
    /*If an old trace flag is found on the user and with this debug level
     *Update the trace flag extending the experiation date.
     */
    if (traceFlags.size > 0){
      this.extendTraceFlag(traceFlags.records[0].Id, DTnow, debugTimeInMs);
    //Else create new trace flag
    } else {
      let debugLog = await this.getDebugLog();

      if (debugLog && debugLog.size > 0){
        this.insertTraceFlag(debugLog.records[0].Id, DTnow, debugTimeInMs);
      } else {
        throw new Error('Debug Level with developerName = "SFDC_DevConsole" not found');
      }
    }
  }

  async pollLogs(vm) {
    let logs = new RecordTable();
    logs.describeInfo = vm.describeInfo;
    logs.sfHost = vm.sfHost;
    let pollId = 1;
    vm.isWorking = true;
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
    //TODO get clientId from handshake
    let subResponse = await sfConn.rest("/cometd/" + apiVersion, {
      method: "POST",
      body: [
        {
          "channel": "/meta/subscribe",
          "subscription": "/systemTopic/Logging",
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
    // other topic of dev console : /systemTopic/ApexExecutionOverlayResult /systemTopic/TestResult /systemTopic/ContainerDeployStateChange
    let advice = null;
    while (vm.isWorking) {
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
        console.log("polling failed");
        return;
      }
      if (response.find(rsp => rsp == null || (rsp.data == null && !rsp.successful))) {
        console.log("polling failed");
      }
      let arsp = response.find(rsp => rsp != null && rsp.successful);
      if (arsp) {
        advice = arsp.advice;
      }
      if (response.find(rsp => rsp != null && rsp.data != null && rsp.channel == "/systemTopic/Logging")) {
        console.log("fill logs");
        let queryLogs = "SELECT Id, Application, Status, Operation, StartTime, LogLength, LogUserId, LogUser.Name FROM ApexLog ORDER BY StartTime DESC";
        await vm.batchHandler(sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(queryLogs), {}), vm, logs, () => {
          vm.updatedLogs();
        })
          .catch(error => {
            console.error(error);
            vm.isWorking = false;
            vm.executeStatus = "Error";
            vm.executeError = "UNEXPECTED EXCEPTION:" + error;
            vm.logs = null;
          });
      }

      //TODO table to query job in run
      // SELECT Id, ApexClass.Name, JobType, CreatedDate, CompletedDate, Status, ExtendedStatus,JobItemsProcessed,LastProcessed,LastProcessedOffset,MethodName,NumberOfErrors,TotalJobItems FROM AsyncApexJob

    }
  }
}

/*
TODO
detail log view:
https://domain/servlet/debug/apex/ApexCSIJsonServlet?log=07LAY000003tnkp2AA&extent=steps&_=
Id, Application, Status, Operation, StartTime, LogLength, LogUserId, LogUser.Name
*/
function RecordTable() {
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
      for (let record of expRecords) {
        let row = new Array(header.length);
        row[0] = record;
        rt.table.push(row);
        rt.rowVisibilities.push(true);
        discoverColumns(record, "", row);
      }
    }
  };
  return rt;
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onSelectHistoryEntry = this.onSelectHistoryEntry.bind(this);
    this.onSelectScriptTemplate = this.onSelectScriptTemplate.bind(this);
    this.onClearHistory = this.onClearHistory.bind(this);
    this.onSelectSavedEntry = this.onSelectSavedEntry.bind(this);
    this.onAddToHistory = this.onAddToHistory.bind(this);
    this.onSaveClientId = this.onSaveClientId.bind(this);
    this.onRemoveFromHistory = this.onRemoveFromHistory.bind(this);
    this.onClearSavedHistory = this.onClearSavedHistory.bind(this);
    this.onToggleHelp = this.onToggleHelp.bind(this);
    this.onToggleSavedOptions = this.onToggleSavedOptions.bind(this);
    this.onExecute = this.onExecute.bind(this);
    this.onCopyScript = this.onCopyScript.bind(this);
    this.onSetscriptName = this.onSetscriptName.bind(this);
    this.onSetClientId = this.onSetClientId.bind(this);
    this.onStopExecute = this.onStopExecute.bind(this);
  }
  onSelectHistoryEntry(e) {
    let {model} = this.props;
    model.selectedHistoryEntry = JSON.parse(e.target.value);
    model.selectHistoryEntry();
    model.didUpdate();
  }
  onSelectScriptTemplate(e) {
    let {model} = this.props;
    model.selectedScriptTemplate = e.target.value;
    model.selectScriptTemplate();
    model.didUpdate();
  }
  onClearHistory(e) {
    e.preventDefault();
    let r = confirm("Are you sure you want to clear the script history?");
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
    let r = confirm("Are you sure you want to remove this saved script?");
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
  onToggleSavedOptions(e) {
    e.preventDefault();
    let {model} = this.props;
    model.toggleSavedOptions();
    model.didUpdate();
  }
  onExecute() {
    let {model} = this.props;
    model.doExecute();
    model.didUpdate();
  }
  onCopyScript() {
    let {model} = this.props;
    let url = new URL(window.location.href);
    let searchParams = url.searchParams;
    searchParams.set("script", model.scriptInput.value);
    url.search = searchParams.toString();
    navigator.clipboard.writeText(url.toString());
    navigator.clipboard.writeText(url.toString());
    model.didUpdate();
  }
  onSetscriptName(e) {
    let {model} = this.props;
    model.setscriptName(e.target.value);
    model.didUpdate();
  }
  onSetClientId(e) {
    let {model} = this.props;
    model.setClientId(e.target.value);
    model.didUpdate();
  }
  onStopExecute() {
    let {model} = this.props;
    model.stopExecute();
    model.didUpdate();
  }
  componentDidMount() {
    let {model} = this.props;
    let scriptInput = this.refs.script;
    //TODO SELECT NamespacePrefix FROM ApexClass GROUP BY NamespacePrefix
    let queryApexClass = "SELECT Id, Name, NamespacePrefix FROM ApexClass";
    model.batchHandler(sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(queryApexClass), {}), model, model.apexClasses, (isFinished) => {
      if (!isFinished){
        return;
      }
    })
      .catch(error => {
        console.error(error);
      });

    model.pollLogs(model);
    model.setScriptInput(scriptInput);
    //Set the cursor focus on script text area
    if (localStorage.getItem("disableScriptInputAutoFocus") !== "true"){
      scriptInput.focus();
    }

    function scriptAutocompleteEvent() {
      model.scriptAutocompleteHandler();
      model.didUpdate();
    }
    scriptInput.addEventListener("input", scriptAutocompleteEvent);
    scriptInput.addEventListener("select", scriptAutocompleteEvent);
    // There is no event for when caret is moved without any selection or value change, so use keyup and mouseup for that.
    scriptInput.addEventListener("keyup", scriptAutocompleteEvent);
    scriptInput.addEventListener("mouseup", scriptAutocompleteEvent);

    // We do not want to perform Salesforce API calls for autocomplete on every keystroke, so we only perform these when the user pressed Ctrl+Space
    // Chrome on Linux does not fire keypress when the Ctrl key is down, so we listen for keydown. Might be https://code.google.com/p/chromium/issues/detail?id=13891#c50
    scriptInput.addEventListener("keydown", e => {
      if (e.ctrlKey && e.key == " ") {
        e.preventDefault();
        model.scriptAutocompleteHandler({ctrlSpace: true});
        model.didUpdate();
      }
    });
    addEventListener("keydown", e => {
      if ((e.ctrlKey && e.key == "Enter") || e.key == "F5") {
        e.preventDefault();
        model.doExecute();
        model.didUpdate();
      }
    });
    //TODO create a component dedicated without dom but react for table of result
    // move data to state
    this.scrollTable = initScrollTable(this.refs.scroller);
    model.resultTableCallback = this.scrollTable.dataChange;

    let recalculateHeight = this.recalculateSize.bind(this);
    if (!window.webkitURL) {
      // Firefox
      // Firefox does not fire a resize event. The next best thing is to listen to when the browser changes the style.height attribute.
      new MutationObserver(recalculateHeight).observe(scriptInput, {attributes: true});
    } else {
      // Chrome
      // Chrome does not fire a resize event and does not allow us to get notified when the browser changes the style.height attribute.
      // Instead we listen to a few events which are often fired at the same time.
      // This is not required in Firefox, and Mozilla reviewers don't like it for performance reasons, so we only do this in Chrome via browser detection.
      scriptInput.addEventListener("mousemove", recalculateHeight);
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
  componentWillUnmount() {
    let {model} = this.props;
    model.disableLogs();
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
        h("h1", {}, "Script Execute"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},
          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          ),
          h("a", {href: "#", id: "help-btn", title: "Execute Help", onClick: this.onToggleHelp},
            h("div", {className: "icon"})
          ),
        ),
      ),
      h("div", {className: "area"},
        h("div", {className: "area-header"},
        ),
        h("div", {className: "script-controls"},
          h("h1", {}, "Execute Script"),
          h("div", {className: "script-history-controls"},
            h("select", {value: "", onChange: this.onSelectScriptTemplate, className: "script-history", title: "Check documentation to customize templates"},
              h("option", {value: null, disabled: true, defaultValue: true, hidden: true}, "Templates"),
              model.scriptTemplates.map(q => h("option", {key: q, value: q}, q))
            ),
            h("div", {className: "button-group"},
              h("select", {value: JSON.stringify(model.selectedHistoryEntry), onChange: this.onSelectHistoryEntry, className: "script-history"},
                h("option", {value: JSON.stringify(null), disabled: true}, "Script History"),
                model.scriptHistory.list.map(q => h("option", {key: JSON.stringify(q), value: JSON.stringify(q)}, q.script.substring(0, 300)))
              ),
              h("button", {onClick: this.onClearHistory, title: "Clear Script History"}, "Clear")
            ),
            h("div", {className: "pop-menu saveOptions", hidden: !model.expandSavedOptions},
              h("a", {href: "#", onClick: this.onRemoveFromHistory, title: "Remove script from saved history"}, "Remove Saved Script"),
              h("a", {href: "#", onClick: this.onClearSavedHistory, title: "Clear saved history"}, "Clear Saved Queries")
            ),
            h("div", {className: "button-group"},
              h("select", {value: JSON.stringify(model.selectedSavedEntry), onChange: this.onSelectSavedEntry, className: "script-history"},
                h("option", {value: JSON.stringify(null), disabled: true}, "Saved Queries"),
                model.savedHistory.list.map(q => h("option", {key: JSON.stringify(q), value: JSON.stringify(q)}, q.script.substring(0, 300)))
              ),
              h("input", {placeholder: "Script Label", type: "save", value: model.scriptName, onInput: this.onSetscriptName}),
              h("button", {onClick: this.onAddToHistory, title: "Add script to saved history"}, "Save Script"),
              h("button", {className: model.expandSavedOptions ? "toggle contract" : "toggle expand", title: "Show More Options", onClick: this.onToggleSavedOptions}, h("div", {className: "button-toggle-icon"})),
              h("input", {placeholder: "Consumer Key", type: "default", value: model.clientId, onInput: this.onSetClientId}),
              h("button", {onClick: this.onSaveClientId, title: "Save Consumer Key"}, "Save"),
            ),
          ),
        ),
        h("div", {className: "editor"},
          h("div", {className: "line-numbers"},
            Array(model.numberOfLines).fill(null).map((e, i) => h("span", {key: "LineNumber" + i}))
          ),
          h("textarea", {id: "script", ref: "script", style: {maxHeight: (model.winInnerHeight - 200) + "px"}}),
        ),
        h("div", {className: "autocomplete-box" + (model.expandAutocomplete ? " expanded" : "")},
          h("div", {className: "autocomplete-header"},
            h("span", {}, model.autocompleteResults.title),
            h("div", {className: "flex-right"},
              h("button", {tabIndex: 1, onClick: this.onExecute, title: "Ctrl+Enter / F5", className: "highlighted"}, "Run Execute"),
              h("button", {tabIndex: 2, onClick: this.onCopyScript, title: "Copy script url", className: "copy-id"}, "Execute Script"),
              h("a", {tabIndex: 3, className: "button", hidden: !model.autocompleteResults.sobjectName, href: model.showDescribeUrl(), target: "_blank", title: "Show field info for the " + model.autocompleteResults.sobjectName + " object"}, model.autocompleteResults.sobjectName + " Field Info")
            ),
          ),
          h("div", {className: "autocomplete-results"},
            model.autocompleteResults.results.map(r =>
              h("div", {className: "autocomplete-result", key: r.value}, h("a", {tabIndex: 0, title: r.title, onClick: e => { e.preventDefault(); model.autocompleteClick(r); model.didUpdate(); }, href: "#", className: r.autocompleteType + " " + r.dataType}, h("div", {className: "autocomplete-icon"}), r.value), " ")
            )
          ),
        ),
        h("div", {hidden: !model.showHelp, className: "help-text"},
          h("h3", {}, "Execute Help"),
          h("p", {}, "Use for running apex script. Enter a ", h("a", {href: "https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm", target: "_blank"}, "APEX script"), " in the box above and press Execute."),
          h("p", {}, "Press Ctrl+Space to insert autosuggestions."),
          h("p", {}, "Press Ctrl+Enter or F5 to execute the execute.")
        )
      ),
      h("div", {className: "area", id: "result-area"},
        h("div", {className: "result-bar"},
          h("h1", {}, "Execute Result"),
          h("span", {className: "result-status flex-right"},
            h("span", {}, model.executeStatus),
            h("button", {className: "cancel-btn", disabled: !model.isWorking, onClick: this.onStopExecute}, "Stop"),
          )
        ),
        h("textarea", {id: "result-text", readOnly: true, value: model.executeError || "", hidden: model.executeError == null}),
        h("div", {id: "result-table", ref: "scroller", hidden: model.executeError != null}
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
