/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */

//documentation to implement profiler
//https://www.developerforce.com/guides/fr/apex_fr/Content/code_setting_debug_log_levels.htm


class Model {

  constructor(sfHost) {
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.userInfo = "...";
    // URL parameters
    this.recordId = null;
    this.numberOfLines = 1;

    //full log text data
    this.logData = "";
    this.logSearch = "";
    this.logInput = null;
    this.searchInput = null;
    this.spinnerCount = 0;
    this.searchIndex = -1;
    this.winInnerHeight = 0;
    this.forceScroll = false;

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

  downloadFile() {
    let downloadLink = document.createElement("a");
    downloadLink.download = this.recordId + ".txt";
    downloadLink.href = "data:text/plain;charset=utf-8," + this.logData;
    downloadLink.click();
  }
  setLogSearch(value) {
    this.logSearch = value;
    if (this.logData == null) {
      return;
    }
    if (this.logSearch == null || this.logSearch.length == 0) {
      this.searchIndex = -1;
      return;
    }
    this.scrollLog(0);
  }
  setLogInput(logInput) {
    this.logInput = logInput;
  }
  setSearchInput(searchInput) {
    this.searchInput = searchInput;
  }
  onKeypress(key, shiftKey){
    switch (key) {
      case "ArrowRight":
      case "ArrowDown":
        this.scrollLog(this.searchIndex);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        this.scrollLogBackward();
        break;
      case "Enter":
        if (shiftKey) {
          this.scrollLogBackward();
        } else {
          this.scrollLog(this.searchIndex);
        }
        break;
    }
  }
  scrollLogBackward() {
    let vm = this; // eslint-disable-line consistent-this
    let rawLog = vm.logData;
    let selStart = vm.searchIndex != -1 ? vm.searchIndex : 0;
    let searchIndex = rawLog.substring(0, selStart).lastIndexOf(vm.logSearch);
    if (searchIndex != -1){
      vm.searchIndex = searchIndex;
      vm.forceScroll = true;
    } else {
      //restart from beginning
      searchIndex = rawLog.lastIndexOf(vm.logSearch);
      if (searchIndex != -1){
        vm.searchIndex = searchIndex;
        vm.forceScroll = true;
      }
    }
    this.didUpdate();
  }
  scrollLog(searchIdx) {
    let vm = this; // eslint-disable-line consistent-this
    let rawLog = vm.logData;
    //let selStart = vm.logInput.selectionStart;
    let selEnd = searchIdx != 1 ? searchIdx + 1 : 0;
    let searchIndex = rawLog.indexOf(vm.logSearch, selEnd);
    if (searchIndex != -1){
      vm.searchIndex = searchIndex;
      vm.forceScroll = true;
    } else {
      //restart from beginning
      searchIndex = rawLog.indexOf(vm.logSearch);
      if (searchIndex != -1){
        vm.searchIndex = searchIndex;
        vm.forceScroll = true;
      }
    }
    this.didUpdate();
  }
  startLoading() {
    if (this.recordId == null){
      return;
    }
    this.spinFor(
      sfConn.rest("/services/data/v" + apiVersion + "/tooling/sobjects/ApexLog/" + this.recordId + "/Body?_dc=1705483656182", {responseType: "text"}).then(data => {
        this.logData = data + Array(5000).fill(null).map(() => {
          let v = Math.floor(Math.random() * 30);
          if (v == 4) {
            return "\n";
          }
          return v.toString();
        }).join("");
        this.numberOfLines = this.logData.split("\n").length;
        //this.refs.editor.dataChange();
        this.didUpdate();
      }
      )
    );
  }
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onLogSearchInput = this.onLogSearchInput.bind(this);
    this.onKeypress = this.onKeypress.bind(this);
  }
  componentDidMount() {
    let {model} = this.props;
    let search = this.refs.search;

    model.setSearchInput(search);
  }

  componentDidUpdate() {
  }

  componentWillUnmount() {
  }

  onLogSearchInput(e) {
    let {model} = this.props;
    model.setLogSearch(e.target.value);
    model.didUpdate();
  }

  onKeypress(e) {
    let {model} = this.props;
    model.onKeypress(e.key, e.shiftKey);
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
        h("h1", {}, "Script Execute"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},
          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          ),
        ),
      ),
      h("div", {className: "area"},
        h("div", {className: "area-header"},
        ),
        h("div", {className: "script-controls"},
          h("h1", {}, "Execute Script"),
          h("div", {className: "script-history-controls"},
            h("input", {id: "search-text", ref: "search", placeholder: "Search a word", onKeyPress: this.onKeypress, type: "search", value: model.logSearch, onInput: this.onLogSearchInput})
          )
        ),
        h(Editor, {model, ref: "editor"})
      )
    );
  }
}

class Editor extends React.Component {
  constructor(props) {
    super(props);
    //this.scrollTo = this.onShowStatusChange.bind(this);
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.offsetHeight = 0;
    this.offsetWidth = 0;
    this.scroller = null;
  }
  componentDidMount() {
    let {model} = this.props;
    let log = this.refs.log;
    this.scroller = this.refs.scroller;

    model.setLogInput(log);
    function resize() {
      model.winInnerHeight = window.innerHeight;
      model.didUpdate(); // Will call recalculateSize
    }
    model.winInnerHeight = window.innerHeight;
    window.addEventListener("resize", resize);
  }
  dataChange() {

  }
  componentDidUpdate() {
    let {model} = this.props;
    let logView = model.logData;
    let currentSearchIdx = model.searchIndex;
    let rowHeight = 14;
    let scrollerOffsetHeight = 0;
    let logLines = logView.split("\n");
    let totalHeight = logLines.length * rowHeight;

    if (this.scroller != null) {
      scrollerOffsetHeight = this.scroller.offsetHeight;
    }

    if (currentSearchIdx != -1 && currentSearchIdx < logView.length && model.forceScroll) {
      let lineNum = logView.substring(0, currentSearchIdx).split("\n").length;
      let scrollLog = (lineNum * rowHeight) - (scrollerOffsetHeight / 2);
      if (scrollLog > 0 && scrollLog < totalHeight - scrollerOffsetHeight) {
        model.forceScroll = false;
        this.scroller.scrollTo(0, scrollLog);
      }
    }
  }

  render() {
    let {model} = this.props;
    let logData = model.logData;
    let logView = logData;
    let searchTerm = model.logSearch;
    let EnrichLog = [];
    let searchIdx = 0;
    let lastSearchIdx = 0;
    let logLines = logData.split("\n");

    let rowHeight = 14; // constant: The initial estimated height of a row before it is rendered
    let bufferHeight = 14; // constant: The number of pixels to render above and below the current viewport
    let totalHeight = 0;
    let firstRowIdx = 0;
    let firstRowTop = 0;
    let lastRowIdx = 0;
    let lastRowTop = 0;
    let colCount = 0;
    let scrollerOffsetHeight = 0;
    let scrollerScrollTop = 0;
    /*
    for (let l = 0; l < logLines.length; l++) {
      if (colCount < logLines[l].length) {
        colCount = logLines[l].length;
      }
    }*/

    if (this.scroller != null) {
      scrollerScrollTop = this.scroller.scrollTop;
      scrollerOffsetHeight = this.scroller.offsetHeight;
    /*
      firstRowTop = Math.min(scrollerScrollTop - bufferHeight, logLines.length * rowHeight);
      firstRowTop = Math.max(firstRowTop, 0);
      firstRowIdx = Math.floor(firstRowTop / rowHeight);
      firstRowTop -= firstRowIdx * rowHeight;

      //lastRowIdx = firstRowIdx;
      //lastRowTop = firstRowTop;

      lastRowTop = Math.min(scrollerScrollTop + scrollerOffsetHeight + bufferHeight, logLines.length * rowHeight);
      lastRowTop = Math.max(lastRowTop, firstRowTop);
      lastRowIdx = Math.floor(lastRowTop / rowHeight);
      //lastRowTop = lastRowIdx * rowHeight;
      */
    }
    totalHeight = logLines.length * rowHeight;
    /*

    let scrolledHeight = totalHeight + "px";
    let scrolledTop = firstRowTop + "px";

    for (let r = firstRowIdx; r < lastRowIdx; r++) {
      logView += logLines[r] + "\n";
    }*/

    if (searchTerm) {
      searchIdx = logView.indexOf(searchTerm);
      while (searchIdx >= 0) {
        if (lastSearchIdx < logView.length && lastSearchIdx != searchIdx) {
          EnrichLog.push({value: logView.substring(lastSearchIdx, searchIdx)});
        }
        //handle case sensitive or not later but use substring instead searchTerm to be sure to respect the case.
        EnrichLog.push({value: logView.substring(searchIdx, searchIdx + searchTerm.length), cls: "highlight"});
        lastSearchIdx = searchIdx + searchTerm.length;
        searchIdx = logView.indexOf(searchTerm, searchIdx + searchTerm.length);
      }
      if (lastSearchIdx < logView.length && lastSearchIdx != searchIdx) {
        EnrichLog.push({value: logView.substring(lastSearchIdx)});
      }
    } else {
      EnrichLog.push({value: logView});
    }
    /*function onScrollerScroll() {
      model.didUpdate();
    }*/

    // TODO component scrollable text  in order to have good row number
    //return h("div", {className: "editor", ref: "scroller", onScroll: onScrollerScroll, style: {offsetHeight: scrollerOffsetHeight, scrollTop: scrollerScrollTop, maxHeight: (model.winInnerHeight - 160) + "px"}},
    return h("div", {className: "editor", ref: "scroller", style: {offsetHeight: scrollerOffsetHeight, scrollTop: scrollerScrollTop, maxHeight: (model.winInnerHeight - 160) + "px"}},
      //h("div", {className: "scrolled"}, style: {height: scrolledHeight, top: scrolledTop}},
      h("div", {className: "line-numbers", style: {lineHeight: rowHeight + "px"}},
        //Array(lastRowIdx - firstRowIdx).fill(null).map((e, i) => h("span", {key: "LineNumber" + i}, i + firstRowIdx))
        Array(logLines.length).fill(null).map((e, i) => h("span", {key: "LineNumber" + i}, i))
      ),
      h("div", {id: "log-text", ref: "log", style: {lineHeight: rowHeight + "px"}},
        EnrichLog.map((txtNode, i) => {
          if (txtNode.cls) {
            return h("span", {key: "TxtNode" + i, className: txtNode.cls}, txtNode.value);
          } else {
            return txtNode.value;
          }
        })
      )//, readOnly: true
      //)
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
    model.recordId = args.get("recordId");
    model.startLoading();
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model, sfConn});
    }

  });
}
