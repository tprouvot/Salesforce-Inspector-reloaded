/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {Enumerable, DescribeInfo, ScrollTable, TableModel, Editor} from "./data-load.js";

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
    this.tableModel = new TableModel(sfHost, this.didUpdate.bind(this));
    this.resultTableCallback = (d) => this.tableModel.dataChange(d);
    this.editor = null;
    this.initialScript = "";
    this.describeInfo = new DescribeInfo(this.spinFor.bind(this), () => {
      this.editorAutocompleteHandler({newDescribe: true});
      //TODO refresh list of field
      this.didUpdate();
    });

    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.userInfo = "...";
    this.userId = null;
    this.timeout = null;
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
    this.suggestionTop = 0;
    this.suggestionLeft = 0;
    this.disableSuggestionOverText = localStorage.getItem("disableSuggestionOverText") === "true";
    this.activeSuggestion = -1;
    if (history.disableSuggestionOverText) {
      this.displaySuggestion = true;
    } else {
      this.displaySuggestion = false;
    }
    this.clientId = localStorage.getItem(sfHost + "_clientId") ? localStorage.getItem(sfHost + "_clientId") : "";
    let scriptTemplatesRawValue = localStorage.getItem("scriptTemplates");
    if (scriptTemplatesRawValue && scriptTemplatesRawValue != "[]") {
      try {
        this.scriptTemplates = JSON.parse(scriptTemplatesRawValue);
      } catch (err) {
        //try old format which do not support comments
        this.scriptTemplates = scriptTemplatesRawValue.split("//");
      }
    } else {
      this.scriptTemplates = [
        "Id batchId= Database.executeBatch(new BatchExample(), 200);",
        "ID jobID = System.enqueueJob(new AsyncExecutionExample());"
      ];
    }

    this.propertyTypes = new Map();
    this.typeProperties = new Map();
    this.typeProperties.set("List", ["add(", "addAll(", "clear(", "clone(", "contains(", "deepClone(", "equals(", "get(", "getSObjectType(", "hashCode(", "indexOf(", "isEmpty(", "iterator(", "remove(", "set(", "size(", "sort(", "toString("]);
    this.typeProperties.set("Map", ["clear(", "clone(", "containsKey(", "deepClone(", "equals(", "get(", "getSObjectType(", "hashCode(", "isEmpty(", "keySet(", "put(", "putAll(", "putAll(", "remove(", "size(", "toString(", "values("]);
    this.typeProperties.set("Set", ["add(", "addAll(", "addAll(", "clear(", "clone(", "contains(", "containsAll(", "containsAll(", "equals(", "hashCode(", "isEmpty(", "remove(", "removeAll(", "removeAll(", "retainAll(", "retainAll(", "size("]);
    this.typeProperties.set("Database", ["convertLead(", "countQuery(", "countQueryWithBinds(", "delete(", "deleteAsync(", "deleteImmediate(", "emptyRecycleBin(", "executeBatch(", "getAsyncDeleteResult(", "getAsyncLocator(", "getAsyncSaveResult(", "getDeleted(", "getQueryLocator(", "getQueryLocatorWithBinds(", "getUpdated(", "insert(", "insertAsync(", "insertImmediate(", "merge(", "query(", "queryWithBinds(", "releaseSavepoint(", "rollback(", "setSavepoint(", "undelete(", "update(", "upsert(", "updateAsync(", "updateImmediate("]);

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
  setEditor(editor) {
    this.editor = editor;
    editor.value = this.initialScript;
    this.initialScript = null;
  }
  toggleHelp() {
    this.showHelp = !this.showHelp;
  }
  toggleSavedOptions() {
    this.expandSavedOptions = !this.expandSavedOptions;
  }
  selectHistoryEntry() {
    if (this.selectedHistoryEntry != null) {
      this.editor.value = this.selectedHistoryEntry.script;
      this.editorAutocompleteHandler();
      this.selectedHistoryEntry = null;
    }
  }
  selectScriptTemplate() {
    this.editor.value = this.selectedScriptTemplate.trimStart();
    this.editor.focus();
    let indexPos = this.editor.value.toLowerCase().indexOf("from ");
    if (indexPos !== -1) {
      this.editor.setRangeText("", indexPos + 5, indexPos + 5, "end");
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
      this.editor.value = scriptStr;
      this.editorAutocompleteHandler();
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
    return this.scriptName != "" ? this.scriptName + ":" + this.editor.value : this.editor.value;
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
    let script = vm.editor.value;
    let selStart = vm.editor.selectionStart;
    let selEnd = vm.editor.selectionEnd;
    let searchTerm = selStart != selEnd
      ? script.substring(selStart, selEnd)
      : script.substring(0, selStart).match(/[a-zA-Z0-9_.]*$/)[0];
    selStart = selEnd - searchTerm.length;

    if (ctrlSpace) {
      this.selectSuggestion();
      return;
    }
    let contextPath;
    if (searchTerm && searchTerm.includes(".")) {
      [contextPath, searchTerm] = searchTerm.split(".", 2);

    }
    let keywords = [
      {value: "Blob", title: "Blob", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "double"},
      {value: "Boolean", title: "Boolean", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "boolean"},
      {value: "Date", title: "Date", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "date"},
      {value: "Datetime", title: "Datetime", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "datetime"},
      {value: "Decimal", title: "Decimal", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "double"},
      {value: "Double", title: "Double", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "double"},
      {value: "ID", title: "ID", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "id"},
      {value: "Integer", title: "Integer", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "int"},
      {value: "Long", title: "Long", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "long"},
      {value: "Object", title: "Object", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "reference"},
      {value: "String", title: "String", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "string"},
      {value: "Time", title: "Time", suffix: " ", rank: 3, autocompleteType: "fieldName", dataType: "time"},

      {value: "List", title: "List", suffix: " ", rank: 1, autocompleteType: "class", dataType: ""},
      {value: "Map", title: "Map", suffix: " ", rank: 1, autocompleteType: "class", dataType: ""},
      {value: "Set", title: "Set", suffix: " ", rank: 1, autocompleteType: "class", dataType: ""},
      {value: "Enum", title: "Enum", suffix: " ", rank: 1, autocompleteType: "class", dataType: ""},

      {value: "while", title: "while", suffix: " {}", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "for", key: "foreach", title: "foreach", suffix: "(Object item:lists) {}", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "for", key: "fori", title: "fori", suffix: "(Integer i = 0; i<length; i++) {}", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "try", title: "try", suffix: " {} catch (Exception e) {}", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "if", title: "if", suffix: " {}", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "else", title: "else", suffix: " {}", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "Database.executeBatch(", title: "Database.executeBatch();", suffix: "new batchable(), 200);", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "System.enqueueJob(", title: "System.enqueueJob();", suffix: "new job());", rank: 2, autocompleteType: "snippet", dataType: ""},
      {value: "System.debug(", title: "System.debug();", suffix: ");", rank: 2, autocompleteType: "snippet", dataType: ""}
    ];
    let {globalDescribe, globalStatus} = vm.describeInfo.describeGlobal(false);
    //isue duplicate namespace because need group by
    vm.autocompleteResults = {
      sobjectName: "ApexClass",
      title: "Class suggestions:",
      results: new Enumerable(vm.apexClasses.records) // custom class
        .flatMap(function* (c) {
          if (contextPath) {
            if (c.NamespacePrefix && c.NamespacePrefix.toLowerCase() == contextPath.toLowerCase()
            && c.Name.toLowerCase().includes(searchTerm.toLowerCase())) {
              yield {"value": c.NamespacePrefix + "." + c.Name, "title": c.NamespacePrefix + "." + c.Name, "suffix": " ", "rank": 4, "autocompleteType": "class"};
            }
          } else if (!c.NamespacePrefix && c.Name.toLowerCase().includes(searchTerm.toLowerCase())) {
            yield {"value": c.Name, "title": c.Name, "suffix": " ", "rank": 4, "autocompleteType": "class"};
          }
        })
        .concat(//customm class namespaces
          new Enumerable(vm.apexClasses.records)
            .map(c => c.NamespacePrefix)
            .filter(n => (n && n.toLowerCase().includes(searchTerm.toLowerCase())))
            .groupBy(n => n)
            .map(n => ({"value": n, "title": n, "suffix": " ", "rank": 5, "autocompleteType": "namespace"}))
        )
        .concat(//SOBJECT
          new Enumerable(globalStatus == "ready" ? globalDescribe.sobjects : [])
            .filter(sobjectDescribe => (sobjectDescribe.name.toLowerCase().includes(searchTerm.toLowerCase())))
            .map(sobjectDescribe => sobjectDescribe.name)
            .map(n => ({"value": n, "title": n, "suffix": " ", "rank": 6, "autocompleteType": "object"}))
        )
        .concat(
          new Enumerable(keywords) //keywords
            .filter(keyword => keyword.title.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .concat(
          new Enumerable(this.propertyTypes.keys())
            .filter(prop => contextPath && prop.toLowerCase().includes(contextPath.toLowerCase()))
            .map(k => this.propertyTypes.get(k))
            .filter(k => k)
            .flatMap(typ => this.typeProperties.get(typ))
            .filter(f => f && f.toLowerCase().startsWith(searchTerm.toLowerCase()))
            .map(n => ({"value": n, "title": n, "suffix": " ", "rank": 0, "autocompleteType": "variable"}))
        )
        .toArray()
        .sort(vm.resultsSort(searchTerm))
        .slice(0, 20) //only 20 first result
    };
  }

  //basic parser
  parseAnonApex(source) {
    if (!source) {
      return;
    }
    this.propertyTypes.clear();
    //TODO ugly hack for static class
    this.propertyTypes.set("Database", "Database");
    source.replaceAll(/\/\/.*\n/g, "\n").replaceAll(/\/\*(.|\r|\n)*\*\//g, "\n").split(";").forEach(statement => {
      let line = statement.trim() + ";";
      let forMatch = line.match(/^for\s*\(/);
      if (forMatch) {
        line = line.substring(forMatch[0].length);
      }
      let whileMatch = line.match(/^while\s*\(/);
      if (whileMatch) {
        line = line.substring(whileMatch[0].length);
      }
      line = line.trim();
      //[public | private | protected | global]
      if (line.startsWith("public ")){
        line = line.substring(7);
        line = line.trim();
      } else if (line.startsWith("private ")){
        line = line.substring(8);
        line = line.trim();
      } else if (line.startsWith("protected ")){
        line = line.substring(10);
        line = line.trim();
      } else if (line.startsWith("global ")){
        line = line.substring(7);
        line = line.trim();
      }
      //[final | override]
      if (line.startsWith("final ")){
        line = line.substring(6);
        line = line.trim();
      } else if (line.startsWith("override ")){
        line = line.substring(9);
        line = line.trim();
      }

      if (line.startsWith("static ")){
        line = line.substring(7);
        line = line.trim();
      }

      // type name
      let fieldRE = /^([a-zA-Z][a-zA-Z0-9_]+)\s+([a-zA-Z][a-zA-Z0-9_]+)(\s*[=(;{]?)/;
      let fieldMatch = fieldRE.exec(line);
      if (fieldMatch) {
        this.propertyTypes.set(fieldMatch[2], fieldMatch[1]);
      }
    });
    //TODO Set and remove primitive
    let {globalDescribe, globalStatus} = this.describeInfo.describeGlobal(false);
    let classes = new Set();
    for (let dataType of this.propertyTypes.values()) {
      //SObject field
      //TODO describeInfo.DidUpdate must do the same when ready so move it to external method
      if (globalStatus == "ready") {
        let sobj = globalDescribe.sobjects.find(sobjectDescribe => (sobjectDescribe.name == dataType));
        if (sobj) {
          let {sobjectStatus, sobjectDescribe} = this.describeInfo.describeSobject(false, dataType);
          if (sobjectStatus == "ready") {
            let fields = sobjectDescribe.fields.map(field => field.Name);
            fields.push("addError(");
            fields.push("clear(");
            fields.push("clone(");
            fields.push("get(");
            fields.push("getCloneSourceId(");
            fields.push("getErrors(");
            fields.push("getOptions(");
            fields.push("getPopulatedFieldsAsMap(");
            fields.push("getSObject(");
            fields.push("getSObjects(");
            fields.push("getSObjectType(");
            fields.push("getQuickActionName(");
            fields.push("hasErrors(");
            fields.push("isClone(");
            fields.push("isSet(");
            fields.push("put(");
            fields.push("putSObject(");
            fields.push("setOptions(");
            this.typeProperties.set(dataType, fields);
          }
          continue;
        }
      }
      //potential class
      if (this.apexClasses.records.some(cls => cls.Name == dataType)){
        classes.add(dataType);
      }
    }
    if (!classes || classes.size == 0) {
      return;
    }
    let queryApexClass = "SELECT Id, Name, NamespacePrefix, Body FROM ApexClass WHERE Name in (" + Array.from(classes).map(c => "'" + c + "'").join(",") + ")";
    let apexClassesSource = new RecordTable();
    this.batchHandler(sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(queryApexClass), {}), this, apexClassesSource, (isFinished) => {
      if (!isFinished){
        return;
      }
      apexClassesSource.records.forEach(cls => {
        this.parseClass(cls.Body, cls.Name);
      });
    })
      .catch(error => {
        console.error(error);
      });
  }
  showSuggestion() {
    this.displaySuggestion = true;
    this.didUpdate();
  }
  hideSuggestion() {
    this.displaySuggestion = false;
    this.didUpdate();
  }
  nextSuggestion() {
    if (this.activeSuggestion < this.autocompleteResults.results.length - 1) {
      this.activeSuggestion++;
    } else {
      this.activeSuggestion = 0;
    }
    this.didUpdate();
  }
  previousSuggestion() {
    if (this.activeSuggestion > 0) {
      this.activeSuggestion--;
    } else {
      this.activeSuggestion = this.autocompleteResults.results.length - 1;
    }
    this.didUpdate();
  }
  selectSuggestion() {
    if (!this.autocompleteResults || !this.autocompleteResults.results || this.autocompleteResults.results.length == 0) {
      return;
    }
    //by default auto complete the first item
    let idx = this.activeSuggestion > -1 ? this.activeSuggestion : 0;
    let ar = this.autocompleteResults.results;
    let selStart = this.editor.selectionStart;
    let selEnd = this.editor.selectionEnd;
    let searchTerm = selStart != selEnd
      ? this.editor.value.substring(selStart, selEnd)
      : this.editor.value.substring(0, selStart).match(/[a-zA-Z0-9_.]*$/)[0];
    selStart = selEnd - searchTerm.length;

    this.editor.focus();
    this.editor.setRangeText(ar[idx].value + ar[idx].suffix, selStart, selEnd, "end");
    this.activeSuggestion = -1;
    this.editorAutocompleteHandler();
  }
  parseClass(source, clsName){
    //todo build hierarchy of block List<Block> with startPosition, endPosition and context
    //for moment simple list
    if (!source) {
      return;
    }
    let cleanedSource = source.replaceAll(/\/\/.*\n/g, "\n").replaceAll(/\/\*(.|\r|\n)*?\*\//g, "");
    // type name
    //let fieldRE = /(public|global)\s+(static\s*)?([a-zA-Z][a-zA-Z0-9_<>]+)\s+([a-zA-Z][a-zA-Z0-9_]+)\s*(;|=|\(|\{)/g;
    let fieldRE = /(public|global)\s+(static\s*)?([a-zA-Z0-9_<>.]+)\s+([a-zA-Z][a-zA-Z0-9_]+)/g;
    //let methodRE = /(public|public static|global|global static)\s*([a-zA-Z][a-zA-Z0-9_<>]+)\s+([a-zA-Z][a-zA-Z0-9_]+)\s*(\([^\{]*\))\{/g;
    let fieldMatch = null;
    let fields = [];
    while ((fieldMatch = fieldRE.exec(cleanedSource)) !== null) {
      if (fieldMatch[3] == "class") {
        continue;
      }
      //if (fieldMatch[5] == "(") {
      //  fields.push(fieldMatch[4] + "(");
      //} else {
      fields.push(fieldMatch[4]);
      //}
    }
    //TODO inner class
    this.typeProperties.set(clsName, fields);
  }

  setSuggestionPosition(top, left){
    if (this.suggestionTop == top && this.suggestionLeft == left) {
      return;
    }
    this.suggestionTop = top;
    this.suggestionLeft = left;
    this.didUpdate();
  }
  /**
   * APEX script autocomplete handling.
   */
  editorAutocompleteHandler(e = {}) {
    let vm = this; // eslint-disable-line consistent-this
    let script = vm.editor.value;
    let selStart = vm.editor.selectionStart;
    let selEnd = vm.editor.selectionEnd;
    let ctrlSpace = e.ctrlSpace;
    this.parseAnonApex(script);
    //TODO place suggestion over the text area with miroring text with span
    //advantage is that we can provide color highlight thanks to that.
    /*
    const rect = caretEle.getBoundingClientRect();
    suggestionsEle.style.top = `${rect.top + rect.height}px`;
    suggestionsEle.style.left = `${rect.left}px`;
    */
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
      vm.editor.focus();
      vm.editor.setRangeText(value + suffix, selStart, selEnd, "end");
      vm.editorAutocompleteHandler();
    };

    // Find the token we want to autocomplete. This is the selected text, or the last word before the cursor.
    let searchTerm = selStart != selEnd
      ? script.substring(selStart, selEnd)
      : script.substring(0, selStart).match(/[a-zA-Z0-9_.]*$/)[0];
    selStart = selEnd - searchTerm.length;
    if (e.inputType == "insertLineBreak") {
      let lastLine = script.substring(0, selStart - 1);
      lastLine = lastLine.substring(lastLine.lastIndexOf("\n") + 1);
      let m = lastLine.match(/^\s+/);
      if (m) {
        vm.editor.setRangeText(m[0], selStart, selEnd, "end");
      }
    }
    this.autocompleteClass(vm, ctrlSpace);
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
    //if polling have been stoped resume it.
    if (!vm.isWorking) {
      this.enableLogs();
    }
    let script = vm.editor.value;
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
        } else {
          vm.scriptHistory.add({script});
        }
      }));
  }
  stopExecute() {
    this.disableLogs();
  }
  disableLogs() {
    clearTimeout(this.timeout);
    this.executeStatus = "Stop polling";
    this.isWorking = false;
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
  resumePolling() {
    let vm = this; // eslint-disable-line consistent-this
    this.executeStatus = "Polling finished";
    this.isWorking = false;

    if (confirm("Resume Polling of logs?")) {
      vm.enableLogs();
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
    let vm = this; // eslint-disable-line consistent-this
    vm.isWorking = true;
    vm.executeStatus = "Polling logs";
    //after 15 min auto disable logs
    this.timeout = setTimeout(() => {
      vm.resumePolling();
    }, debugTimeInMs);

    //start to poll logs
    vm.pollLogs(vm);
  }

  async pollLogs(vm) {
    let logs = new RecordTable();
    logs.describeInfo = vm.describeInfo;
    logs.sfHost = vm.sfHost;
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
        vm.executeStatus = "Error";
        vm.executeError = "Polling failed with empty response.";
        vm.isWorking = false;
        console.log("polling failed");
        return;
      }
      let rspFailed = response.find(rsp => rsp == null || (rsp.data == null && !rsp.successful));
      if (rspFailed) {
        vm.executeStatus = "Error";
        vm.executeError = rspFailed.error;
        vm.isWorking = false;
        console.log("polling failed:" + rspFailed.error);
        return;
      }
      let arsp = response.find(rsp => rsp != null && rsp.successful);
      if (arsp) {
        advice = arsp.advice;
      }
      if (response.find(rsp => rsp != null && rsp.data != null && rsp.channel == "/systemTopic/Logging")) {
        let queryLogs = "SELECT Id, Application, Status, Operation, StartTime, LogLength, LogUser.Name FROM ApexLog ORDER BY StartTime DESC";
        //logs.resetTable();
        logs = new RecordTable();
        logs.describeInfo = vm.describeInfo;
        logs.sfHost = vm.sfHost;
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
  recalculateSize() {
    // Investigate if we can use the IntersectionObserver API here instead, once it is available.
    this.tableModel.viewportChange();
  }
}

function RecordTable() {
  /*
  We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
  This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
  We don't care, because we don't need a stable set of columns for our use case.
  */
  let columnIdx = new Map();
  let header = ["_"];
  function makeReadableSize(size) {
    let isize = parseInt(size);
    if (isNaN(isize)){
      return size + " kb";
    } else if (isize > 1048576) {
      return (isize / 1048576).toFixed(2) + " Mb";
    } else if (isize > 1024) {
      return (isize / 1024).toFixed(2) + " kb";
    }
    return isize + " b";
  }
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
        //TODO move it elswhere is complicated but dirty to put it here so find better solution !
        if (column == "StartTime") {
          header[c] = "Start time";
        } else if (column == "LogLength") {
          header[c] = "Length";
        } else if (column == "LogUser.Name") {
          header[c] = "User";
        } else {
          header[c] = column;
        }

        //skip LogUser collumn for logs
        rt.colVisibilities.push(column != "LogUser");
      }
      if (column == "LogLength") {
        row[c] = makeReadableSize(record[field]);
      } else {
        row[c] = record[field];
      }
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
    },
    resetTable() {
      rt.records = [];
      rt.table = [];
      columnIdx = new Map();
      header = ["_"];
      rt.rowVisibilities = [];
      rt.totalSize = -1;
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
    this.onClick = this.onClick.bind(this);
  }
  onClick(){
    let {model} = this.props;
    if (model && model.tableModel) {
      model.tableModel.onClick();
    }
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
    let r = confirm("Are you sure you want to remove all saved scripts?");
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
    searchParams.set("script", model.editor.value);
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
    let queryApexClass = "SELECT Id, Name, NamespacePrefix FROM ApexClass";
    model.batchHandler(sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(queryApexClass), {}), model, model.apexClasses, (isFinished) => {
      if (!isFinished){
        return;
      }
    })
      .catch(error => {
        console.error(error);
      });
    //call to get all Sobject during load
    model.describeInfo.describeGlobal(false);

    addEventListener("keydown", e => {
      if ((e.ctrlKey && e.key == "Enter") || e.key == "F5") {
        e.preventDefault();
        model.doExecute();
        model.didUpdate();
      }
    });


    function resize() {
      model.winInnerHeight = innerHeight;
      model.didUpdate(); // Will call recalculateSize
    }
    addEventListener("resize", resize);
    resize();
  }
  componentDidUpdate() {
    let {model} = this.props;
    model.recalculateSize();
  }
  componentWillUnmount() {
    let {model} = this.props;
    model.disableLogs();
  }

  render() {
    let {model} = this.props;
    let suggestionHelper = "";
    if (!model.disableSuggestionOverText) {
      if (model.displaySuggestion) {
        suggestionHelper = " Press Esc to hide suggestions";
      } else {
        suggestionHelper = " Press Ctrl+Space to display suggestions";
      }
    }
    let keywordColor = new Map([["do", "violet"], ["public", "blue"], ["private", "blue"], ["global", "blue"], ["class", "blue"], ["static", "blue"],
      ["interface", "blue"], ["extends", "blue"], ["while", "violet"], ["for", "violet"], ["try", "violet"], ["catch", "violet"],
      ["finally", "violet"], ["extends", "violet"], ["throw", "violet"], ["new", "violet"], ["if", "violet"], ["else", "violet"]]);
    return h("div", {onClick: this.onClick},
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
        h("div", {className: "query-controls"},
          h("h1", {}, "Execute Script"),
          h("div", {className: "query-history-controls"},
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
              h("a", {href: "#", onClick: this.onClearSavedHistory, title: "Clear saved history"}, "Clear Saved Scripts")
            ),
            h("div", {className: "button-group"},
              h("select", {value: JSON.stringify(model.selectedSavedEntry), onChange: this.onSelectSavedEntry, className: "script-history"},
                h("option", {value: JSON.stringify(null), disabled: true}, "Saved Scripts"),
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
        h(Editor, {model, keywordColor, keywordCaseSensitive: true}),
        h("div", {className: "autocomplete-box" + (model.expandAutocomplete ? " expanded" : "")},
          h("div", {className: "autocomplete-header"},
            h("span", {}, model.autocompleteResults.title + suggestionHelper),
            h("div", {className: "flex-right"},
              h("button", {tabIndex: 1, onClick: this.onExecute, title: "Ctrl+Enter / F5", className: "highlighted"}, "Run Execute"),
              h("button", {tabIndex: 2, onClick: this.onCopyScript, title: "Copy script url", className: "copy-id"}, "Export Script")
            ),
          ),
          h("div", {className: "autocomplete-results" + (model.disableSuggestionOverText ? " autocomplete-results-under" : " autocomplete-results-over"), hidden: !model.displaySuggestion, style: model.disableSuggestionOverText ? {} : {top: model.suggestionTop + "px", left: model.suggestionLeft + "px"}},
            model.autocompleteResults.results.map((r, ri) =>
              h("div", {className: "autocomplete-result" + (ri == model.activeSuggestion ? " active" : ""), key: r.key ? r.key : r.value}, h("a", {tabIndex: 0, title: r.title, onClick: e => { e.preventDefault(); model.autocompleteClick(r); model.didUpdate(); }, href: "#", className: r.autocompleteType + " " + r.dataType}, h("div", {className: "autocomplete-icon"}), r.title), " ")
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
            h("button", {className: "cancel-btn", disabled: !model.isWorking, onClick: this.onStopExecute}, "Stop polling logs"),
          )
        ),
        h("textarea", {id: "result-text", readOnly: true, value: model.executeError || "", hidden: model.executeError == null}),
        h(ScrollTable, {model: model.tableModel, hidden: model.executeError != null})
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
