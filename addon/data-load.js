/* global React */
import {sfConn, apiVersion} from "./inspector.js";

// Inspired by C# System.Linq.Enumerable
export function Enumerable(iterable) {
  this[Symbol.iterator] = iterable[Symbol.iterator].bind(iterable);
}
Enumerable.prototype = {
  __proto__: function*(){}.prototype,
  *map(f) {
    for (let e of this) {
      yield f(e);
    }
  },
  *filter(f) {
    for (let e of this) {
      if (f(e)) {
        yield e;
      }
    }
  },
  *flatMap(f) {
    for (let e of this) {
      yield* f(e);
    }
  },
  *concat(other) {
    yield* this;
    yield* other;
  },
  some() {
    for (let e of this) { // eslint-disable-line no-unused-vars
      return true;
    }
    return false;
  },
  groupBy(f) {
    const mapEnum = new Map();
    for (let e of this) {
      mapEnum.set(f(e), e);
    }
    return new Enumerable(mapEnum.values());
  },
  toArray() {
    return Array.from(this);
  }
};
Enumerable.prototype.map.prototype = Enumerable.prototype;
Enumerable.prototype.filter.prototype = Enumerable.prototype;
Enumerable.prototype.flatMap.prototype = Enumerable.prototype;
Enumerable.prototype.concat.prototype = Enumerable.prototype;

// @param didUpdate: A callback function to listen for updates to describe data
export function DescribeInfo(spinFor, didUpdate) {
  function initialState() {
    return {
      data: {global: {globalStatus: "pending", globalDescribe: null}, sobjects: null},
      tool: {global: {globalStatus: "pending", globalDescribe: null}, sobjects: null}
    };
  }
  let sobjectAllDescribes = initialState();
  function getGlobal(useToolingApi) {
    let apiDescribes = sobjectAllDescribes[useToolingApi ? "tool" : "data"];
    if (apiDescribes.global.globalStatus == "pending") {
      apiDescribes.global.globalStatus = "loading";
      console.log(useToolingApi ? "getting tooling objects" : "getting objects");
      spinFor(sfConn.rest(useToolingApi ? "/services/data/v" + apiVersion + "/tooling/sobjects/" : "/services/data/v" + apiVersion + "/sobjects/").then(res => {
        apiDescribes.global.globalStatus = "ready";
        apiDescribes.global.globalDescribe = res;
        apiDescribes.sobjects = new Map();
        for (let sobjectDescribe of res.sobjects) {
          apiDescribes.sobjects.set(sobjectDescribe.name.toLowerCase(), {global: sobjectDescribe, sobject: {sobjectStatus: "pending", sobjectDescribe: null}});
        }
        didUpdate();
      }, () => {
        apiDescribes.global.globalStatus = "loadfailed";
        didUpdate();
      }));
    }
    return apiDescribes;
  }
  // Makes global and sobject describe API calls, and caches the results.
  // If the result of an API call is not already cashed, empty data is returned immediately, and the API call is made asynchronously.
  // The caller is notified using the didUpdate callback or the spinFor promise when the API call completes, so it can make the call again to get the cached results.
  return {
    // Returns an object with two properties:
    // - globalStatus: a string with one of the following values:
    //    "pending": (has not started loading, never returned by this function)
    //    "loading": Describe info for the api is being downloaded
    //    "loadfailed": Downloading of describe info for the api failed
    //    "ready": Describe info is available
    // - globalDescribe: contains a DescribeGlobalResult if it has been loaded
    describeGlobal(useToolingApi) {
      return getGlobal(useToolingApi).global;
    },
    // Returns an object with two properties:
    // - sobjectStatus: a string with one of the following values:
    //    "pending": (has not started loading, never returned by this function)
    //    "notfound": The object does not exist
    //    "loading": Describe info for the object is being downloaded
    //    "loadfailed": Downloading of describe info for the object failed
    //    "ready": Describe info is available
    // - sobjectDescribe: contains a DescribeSObjectResult if the object exists and has been loaded
    describeSobject(useToolingApi, sobjectName) {
      let apiDescribes = getGlobal(useToolingApi);
      if (!apiDescribes.sobjects) {
        return {sobjectStatus: apiDescribes.global.globalStatus, sobjectDescribe: null};
      }
      let sobjectInfo = apiDescribes.sobjects.get(sobjectName.toLowerCase());
      if (!sobjectInfo) {
        return {sobjectStatus: "notfound", sobjectDescribe: null};
      }
      if (sobjectInfo.sobject.sobjectStatus == "pending") {
        sobjectInfo.sobject.sobjectStatus = "loading";
        console.log("getting fields for " + sobjectInfo.global.name);
        spinFor(sfConn.rest(sobjectInfo.global.urls.describe).then(res => {
          sobjectInfo.sobject.sobjectStatus = "ready";
          sobjectInfo.sobject.sobjectDescribe = res;
          didUpdate();
        }, () => {
          sobjectInfo.sobject.sobjectStatus = "loadfailed";
          didUpdate();
        }));
      }
      return sobjectInfo.sobject;
    },
    reloadAll() {
      sobjectAllDescribes = initialState();
      didUpdate();
    }
  };
}

// Pluralize a numeric value by adding an s (or optional suffix) if it is not 1
export function s(num, suffix = "s") {
  return num == 1 ? "" : suffix;
}

// Copy text to the clipboard, without rendering it, since rendering is slow.
export function copyToClipboard(value) {
  if (parent && parent.isUnitTest) { // for unit tests
    parent.testClipboardValue = value;
    return;
  }
  // Use execCommand to trigger an oncopy event and use an event handler to copy the text to the clipboard.
  // The oncopy event only works on editable elements, e.g. an input field.
  let temp = document.createElement("input");
  // The oncopy event only works if there is something selected in the editable element.
  temp.value = "temp";
  temp.addEventListener("copy", e => {
    e.clipboardData.setData("text/plain", value);
    e.preventDefault();
  });
  document.body.appendChild(temp);
  try {
    // The oncopy event only works if there is something selected in the editable element.
    temp.select();
    // Trigger the oncopy event
    let success = document.execCommand("copy");
    if (!success) {
      alert("Copy failed");
    }
  } finally {
    document.body.removeChild(temp);
  }
}

/*
A table that contains millions of records will freeze the browser if we try to render the entire table at once.
Therefore we implement a table within a scrollable area, where the cells are only rendered, when they are scrolled into view.

Limitations:
* It is not possible to select or search the contents of the table outside the rendered area. The user will need to copy to Excel or CSV to do that.
* Since we initially estimate the size of each cell and then update as we render them, the table will sometimes "jump" as the user scrolls.
* There is no line wrapping within the cells. A cell with a lot of text will be very wide.

Implementation:
Since we don't know the height of each row before we render it, we assume to begin with that it is fairly small, and we then grow it to fit the rendered content, as the user scrolls.
We never schrink the height of a row, to ensure that it stabilzes as the user scrolls. The heights are stored in the `rowHeights` array.
To avoid re-rendering the visible part on every scroll, we render an area that is slightly larger than the viewport, and we then only re-render, when the viewport moves outside the rendered area.
Since we don't know the height of each row before we render it, we don't know exactly how many rows to render.
However since we never schrink the height of a row, we never render too few rows, and since we update the height estimates after each render, we won't repeatedly render too many rows.
The initial estimate of the height of each row should be large enough to ensure we don't render too many rows in our initial render.
We only measure the current size at the end of each render, to minimize the number of synchronous layouts the browser needs to make.
We support adding new rows to the end of the table, and new cells to the end of a row, but not deleting existing rows, and we do not reduce the height of a row if the existing content changes.
Each row may be visible or hidden.
In addition to keeping track of the height of each cell, we keep track of the total height in order to adjust the height of the scrollable area, and we keep track of the position of the scrolled area.
After a scroll we search for the position of the new rendered area using the position of the old scrolled area, which should be the least amount of work when the user scrolls in one direction.
The table must have at least one row, since the code keeps track of the first rendered row.
We assume that the height of the cells we measure sum up to the height of the table.
We do the exact same logic for columns, as we do for rows.
We assume that the size of a cell is not influenced by the size of other cells. Therefore we style cells with `white-space: pre`.

interface Table {
  Cell[][] table; // a two-dimensional array of table rows and cells
  boolean[] rowVisibilities; // For each row, true if it is visible, or false if it is hidden
  boolean[] colVisibilities; // For each column, true if it is visible, or false if it is hidden
  // Refactor: The following three attributes are only used by renderCell, they should be moved to a different interface
  boolean isTooling;
  DescribeInfo describeInfo;
  String sfHost;
}
*/

let h = React.createElement;

export class TableModel {
  constructor(sfHost, reactCallback) {
    this.reactCallback = reactCallback;
    this.headerCallout = localStorage.getItem("createUpdateRestCalloutHeaders") ? JSON.parse(localStorage.getItem("createUpdateRestCalloutHeaders")) : "{}";
    this.sfHost = sfHost;
    this.data = null;
    this.initialRowHeight = 15; // constant: The initial estimated height of a row before it is rendered
    this.initialColWidth = 50; // constant: The initial estimated width of a column before it is rendered
    this.bufferHeight = 500; // constant: The number of pixels to render above and below the current viewport
    this.bufferWidth = 500; // constant: The number of pixels to render to the left and right of the current viewport
    this.headerRows = 1; // constant: The number of header rows
    this.headerCols = 0; // constant: The number of header columns
    this.rowHeights = []; // The height in pixels of each row
    this.rowVisible = []; // The visibility of each row. 0 = hidden, 1 = visible
    this.rowCount = 0;
    this.totalHeight = 0; // The sum of heights of visible cells
    this.firstRowIdx = 0; // The index of the first rendered row
    this.firstRowTop = 0; // The distance from the top of the table to the top of the first rendered row
    this.lastRowIdx = 0; // The index of the row below the last rendered row
    this.lastRowTop = 0; // The distance from the top of the table to the bottom of the last rendered row (the top of the row below the last rendered row)
    this.colWidths = []; // The width in pixels of each column
    this.colVisible = []; // The visibility of each column. 0 = hidden, 1 = visible
    this.colCount = 0;
    this.totalWidth = 0; // The sum of widths of visible cells
    this.firstColIdx = 0; // The index of the first rendered column
    this.firstColLeft = 0; // The distance from the left of the table to the left of the first rendered column
    this.lastColIdx = 0; // The index of the column to the right of the last rendered column
    this.lastColLeft = 0; // The distance from the left of the table to the right of the last rendered column (the left of the column after the last rendered column)
    this.cellMenuOpened = null;
    this.cellMenuToClose = null;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.offsetHeight = 0;
    this.offsetWidth = 0;
    this.scrolled = null;
    this.scroller = null;
    this.header = [];
    this.rows = [];
    this.scrolledHeight = 0;
    this.scrolledWidth = 0;
  }
  setScrollerElement(scroller, scrolled) {
    this.scrolled = scrolled;
    this.scroller = scroller;
    this.dataChange(null);
  }
  //called after render
  viewportChange() {
    if (this.scrollTop == this.scroller.scrollTop
      && this.scrollLeft == this.scroller.scrollLeft
      && this.offsetHeight == this.scroller.offsetHeight
      && this.offsetWidth == this.scroller.offsetWidth
    ) {
      return;
    }
    this.renderData({force: false});
    // Before this point we invalidate style and layout. After this point we recalculate style and layout, and we do not invalidate them again.
    if (this.rows.length > 0) {
      //thead
      let thead = this.scrolled.firstElementChild.firstElementChild;
      if (thead){
        let tr = thead.firstElementChild;
        let rowRect = tr.firstElementChild.getBoundingClientRect();
        let oldHeight = this.rowHeights[0];
        let newHeight = Math.max(oldHeight, rowRect.height);
        this.rowHeights[0] = newHeight;
        this.totalHeight += newHeight - oldHeight;
        this.lastRowTop += newHeight - oldHeight;
      }
      let tbody = this.scrolled.firstElementChild.lastElementChild;
      let tr = tbody.firstElementChild;
      for (let r = (this.firstRowIdx > 0 ? this.firstRowIdx : 1); r < this.lastRowIdx; r++) {
        //display happend after model refresh so tr can be null
        if (this.rowVisible[r] == 0 || tr == null) {
          continue;
        }
        let rowRect = tr.firstElementChild.getBoundingClientRect();
        let oldHeight = this.rowHeights[r];
        let newHeight = Math.max(oldHeight, rowRect.height);
        this.rowHeights[r] = newHeight;
        this.totalHeight += newHeight - oldHeight;
        this.lastRowTop += newHeight - oldHeight;
        tr = tr.nextElementSibling;
      }
      let td = tbody.firstElementChild.firstElementChild;
      for (let c = this.firstColIdx; c < this.lastColIdx; c++) {
        //display happend after model refresh so td can be null
        if (this.colVisible[c] == 0 || td == null) {
          continue;
        }
        let colRect = td.getBoundingClientRect();
        let oldWidth = this.colWidths[c];
        let newWidth = Math.max(oldWidth, colRect.width);
        this.colWidths[c] = newWidth;
        this.totalWidth += newWidth - oldWidth;
        this.lastColLeft += newWidth - oldWidth;
        td = td.nextElementSibling;
      }
    }
  }

  doSave(rowId) {
    let row = this.rows[rowId];
    let record = {};
    row.cells.filter(c => c.dataEditValue).forEach(c => {
      record[this.header[c.id]] = c.dataEditValue;
    });
    let recordId = "";
    let objectType = "";
    row.cells.filter(c => this.header[c.id] == "Id").forEach(h => {
      recordId = h.label;
      objectType = h.objectTypes[0];
    });
    let recordUrl = `/services/data/v${apiVersion}/sobjects/${objectType}/${recordId}`;
    //TODO spinfor
    sfConn.rest(recordUrl, {method: "PATCH", body: record, headers: this.headerCallout}).then(() => {
      //do not refresh trigger data update because too complicated.
      this.endEdit(rowId);
    }).catch(error => {
      row.error = error.message;
      console.log(error);
      this.didUpdate();
    });
  }
  endEdit(rowId) {
    this.rows[rowId].cells.filter(c => c.dataEditValue).forEach(c => {
      c.label = c.dataEditValue;
      c.dataEditValue = null;
      c.isEditing = false;
    });
    this.didUpdate();
  }
  cancelEditCell(rowId, cellId) {
    let cell = this.rows[rowId].cells[cellId];
    cell.dataEditValue = cell.label;
    cell.isEditing = false;
    this.didUpdate();
  }
  editCell(rowId, cellId) {
    let cell = this.rows[rowId].cells[cellId];
    //do not allow edit of id
    if (this.header[cellId] && this.header[cellId].toLowerCase() == "Id") {
      return;
    }
    //do not allow edit of object column
    if (cell.linkable && !this.isRecordId(cell.label)){
      return;
    }
    // not sub record for moment
    if (this.header[cell.id].includes(".")){
      return;
    }
    cell.dataEditValue = cell.label;
    cell.isEditing = true;
    this.didUpdate();
  }
  renderData({force}) {
    this.scrollTop = this.scroller.scrollTop;
    this.scrollLeft = this.scroller.scrollLeft;
    this.offsetHeight = this.scroller.offsetHeight;
    this.offsetWidth = this.scroller.offsetWidth;

    if (this.rowCount == 0 || this.colCount == 0) {
      this.header = [];
      this.rows = [];
      this.scrolledHeight = 0;
      this.scrolledWidth = 0;
      return;
    }

    if (!force && this.firstRowTop <= this.scrollTop && (this.lastRowTop >= this.scrollTop + this.offsetHeight || this.lastRowIdx == this.rowCount)
     && this.firstColLeft <= this.scrollLeft && (this.lastColLeft >= this.scrollLeft + this.offsetWidth || this.lastColIdx == this.colCount)) {
      return;
    }
    console.log("render");

    while (this.firstRowTop < this.scrollTop - this.bufferHeight && this.firstRowIdx < this.rowCount - 1) {
      this.firstRowTop += this.rowVisible[this.firstRowIdx] * this.rowHeights[this.firstRowIdx];
      this.firstRowIdx++;
    }
    while (this.firstRowTop > this.scrollTop - this.bufferHeight && this.firstRowIdx > 0) {
      this.firstRowIdx--;
      this.firstRowTop -= this.rowVisible[this.firstRowIdx] * this.rowHeights[this.firstRowIdx];
    }
    while (this.firstColLeft < this.scrollLeft - this.bufferWidth && this.firstColIdx < this.colCount - 1) {
      this.firstColLeft += this.colVisible[this.firstColIdx] * this.colWidths[this.firstColIdx];
      this.firstColIdx++;
    }
    while (this.firstColLeft > this.scrollLeft - this.bufferWidth && this.firstColIdx > 0) {
      this.firstColIdx--;
      this.firstColLeft -= this.colVisible[this.firstColIdx] * this.colWidths[this.firstColIdx];
    }

    this.lastRowIdx = this.firstRowIdx;
    this.lastRowTop = this.firstRowTop;
    while (this.lastRowTop < this.scrollTop + this.offsetHeight + this.bufferHeight && this.lastRowIdx < this.rowCount) {
      this.lastRowTop += this.rowVisible[this.lastRowIdx] * this.rowHeights[this.lastRowIdx];
      this.lastRowIdx++;
    }
    this.lastColIdx = this.firstColIdx;
    this.lastColLeft = this.firstColLeft;
    while (this.lastColLeft < this.scrollLeft + this.offsetWidth + this.bufferWidth && this.lastColIdx < this.colCount) {
      this.lastColLeft += this.colVisible[this.lastColIdx] * this.colWidths[this.lastColIdx];
      this.lastColIdx++;
    }
    //first calculate header
    this.header = [];
    let head = this.data.table[0];
    for (let c = this.firstColIdx; c < this.lastColIdx; c++) {
      if (this.colVisible[c] == 0) {
        continue;
      }
      this.header.push(head[c]);
    }
    this.rows = [];
    this.scrolledHeight = this.totalHeight;
    this.scrolledWidth = this.totalWidth;

    for (let r = (this.firstRowIdx > 0 ? this.firstRowIdx : 1); r < this.lastRowIdx; r++) {
      if (this.rowVisible[r] == 0) {
        continue;
      }

      let row = this.data.table[r];
      let dataRow = {cells: [], height: 0};
      for (let c = this.firstColIdx; c < this.lastColIdx; c++) {
        if (this.colVisible[c] == 0) {
          continue;
        }
        let cell = row[c];
        let dataCell = {linkable: false, label: "", showMenu: false, links: []};

        //row.height
        if (typeof cell == "object" && cell != null && cell.attributes && cell.attributes.type) {
          if (cell.attributes.url) {
            dataCell.recordId = cell.attributes.url.replace(/.*\//, "");
          }
          dataCell.objectTypes = [cell.attributes.type];
          dataCell.label = cell.attributes.type;
          dataCell.linkable = true;
        } else if (typeof cell == "string" && this.isRecordId(cell)) {
          dataCell.recordId = cell;
          dataCell.label = cell;
          dataCell.linkable = true;
          let {globalDescribe} = this.data.describeInfo.describeGlobal(this.data.isTooling);
          if (globalDescribe) {
            let keyPrefix = dataCell.recordId.substring(0, 3);
            dataCell.objectTypes = globalDescribe.sobjects.filter(sobject => sobject.keyPrefix == keyPrefix).map(sobject => sobject.name);
          } else {
            dataCell.objectTypes = [];
          }
        } else if (typeof cell == "string" && this.isEventLogFile(cell)) {
          dataCell.recordId = cell;
          dataCell.objectTypes = [];
          dataCell.label = cell;
          dataCell.linkable = true;
        } else if (cell == null) {
          dataCell.label = "";
        } else {
          dataCell.label = cell;
        }
        dataCell.id = dataRow.cells.length;
        dataRow.cells.push(dataCell);
      }
      dataRow.id = this.rows.length;
      this.rows.push(dataRow);
    }
    this.didUpdate();
  }

  dataChange(newData) {
    this.data = newData;
    if (this.data == null || this.data.rowVisibilities.length == 0 || this.data.colVisibilities.length == 0) {
      // First render, or table was cleared
      this.rowHeights = [];
      this.rowVisible = [];
      this.rowCount = 0;
      this.totalHeight = 0;
      this.firstRowIdx = 0;
      this.firstRowTop = 0;
      this.lastRowIdx = 0;
      this.lastRowTop = 0;
      this.colWidths = [];
      this.colVisible = [];
      this.colCount = 0;
      this.totalWidth = 0;
      this.firstColIdx = 0;
      this.firstColLeft = 0;
      this.lastColIdx = 0;
      this.lastColLeft = 0;
      this.renderData({force: true});
    } else {
      // Data or visibility was changed
      let newRowCount = this.data.rowVisibilities.length;
      for (let r = this.rowCount; r < newRowCount; r++) {
        this.rowHeights[r] = this.initialRowHeight;
        this.rowVisible[r] = 0;
      }
      this.rowCount = newRowCount;
      for (let r = 0; r < this.rowCount; r++) {
        let newVisible = Number(this.data.rowVisibilities[r]);
        let visibilityChange = newVisible - this.rowVisible[r];
        this.totalHeight += visibilityChange * this.rowHeights[r];
        if (r < this.firstRowIdx) {
          this.firstRowTop += visibilityChange * this.rowHeights[r];
        }
        this.rowVisible[r] = newVisible;
      }
      let newColCount = this.data.colVisibilities.length;
      for (let c = this.colCount; c < newColCount; c++) {
        this.colWidths[c] = this.initialColWidth;
        this.colVisible[c] = 0;
      }
      this.colCount = newColCount;
      for (let c = 0; c < this.colCount; c++) {
        let newVisible = Number(this.data.colVisibilities[c]);
        let visibilityChange = newVisible - this.colVisible[c];
        this.totalWidth += visibilityChange * this.colWidths[c];
        if (c < this.firstColIdx) {
          this.firstColLeft += visibilityChange * this.colWidths[c];
        }
        this.colVisible[c] = newVisible;
      }
      this.renderData({force: true});
    }
  }
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }
  isRecordId(recordId) {
    // We assume a string is a Salesforce ID if it is 18 characters,
    // contains only alphanumeric characters,
    // the record part (after the 3 character object key prefix and 2 character instance id) starts with at least four zeroes,
    // and the 3 character object key prefix is not all zeroes.
    return /^[a-z0-9]{5}0000[a-z0-9]{9}$/i.exec(recordId) && !recordId.startsWith("000");
  }
  isEventLogFile(text) {
    // test the text to identify if this is a path to an eventLogFile
    return /^\/services\/data\/v[0-9]{2,3}.[0-9]{1}\/sobjects\/EventLogFile\/[a-z0-9]{5}0000[a-z0-9]{9}\/LogFile$/i.exec(text);
  }
  toggleMenu(rowId, cellId) {
    let cell = this.rows[rowId].cells[cellId];
    cell.showMenu = !cell.showMenu;
    let self = this;
    function setLinks(){
      cell.links = [];
      let args = new URLSearchParams();
      args.set("host", self.sfHost);
      args.set("objectType", cell.objectType);
      if (self.data.isTooling) {
        args.set("useToolingApi", "1");
      }
      if (cell.recordId) {
        args.set("recordId", cell.recordId);
      }
      cell.links.push({withIcon: true, href: "inspect.html?" + args, label: "Show all data", className: "view-inspector", action: ""});

      let query = "SELECT Id FROM " + cell.objectType + " WHERE Id = '" + cell.recordId + "'";
      let queryArgs = new URLSearchParams();
      queryArgs.set("host", self.sfHost);
      queryArgs.set("query", query);
      cell.links.push({withIcon: true, href: "data-export.html?" + queryArgs, label: "Query Record", className: "query-record", action: ""});

      if (cell.objectType == "ApexLog") {
        let queryLogArgs = new URLSearchParams();
        queryLogArgs.set("host", self.sfHost);
        queryLogArgs.set("recordId", cell.recordId);
        cell.links.push({withIcon: true, href: "log.html?" + queryLogArgs, label: "View Log", className: "view-inspector", action: ""});
      }

      // If the recordId ends with 0000000000AAA it is a dummy ID such as the ID for the master record type 012000000000000AAA
      if (cell.recordId && self.isRecordId(cell.recordId) && !cell.recordId.endsWith("0000000000AAA")) {
        cell.links.push({withIcon: true, href: "https://" + self.sfHost + "/" + cell.recordId, label: "View in Salesforce", className: "view-salesforce", action: ""});
      }

      //Download event logFile
      if (self.isEventLogFile(cell.recordId)) {
        cell.links.push({withIcon: true, href: cell.recordId, label: "Download File", className: "download-salesforce", action: "download"});
      } else {
        cell.links.push({withIcon: true, href: cell.recordId, label: "Copy Id", className: "copy-id", action: "copy"});
      }
      self.didUpdate();
    }
    if (cell.showMenu) {
      this.cellMenuOpened = {cellId, rowId};
      if (!cell.links || cell.links.length === 0) {
        if (cell.objectTypes.length === 1){
          cell.objectType = cell.objectTypes[0];
          setLinks();
        } else {
          sfConn.rest(`/services/data/v${apiVersion}/ui-api/records/${cell.recordId}?layoutTypes=Compact`).then(res => {
            cell.objectType = res.apiName;
            setLinks();
          });
        }
      }
    }
    // refresh to hide menu
    this.didUpdate();
  }

  onClick(){
    //bubble event so handle it after
    if (this.cellMenuToClose){
      //close menu
      this.toggleMenu(this.cellMenuToClose.rowId, this.cellMenuToClose.cellId);
    }
    this.cellMenuToClose = this.cellMenuOpened;
    this.cellMenuOpened = null;
  }
}
class ScrollTableCell extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.cell = props.cell;
    this.width = props.width;
    this.row = props.row;
    this.onTryEdit = this.onTryEdit.bind(this);
    this.onClick = this.onClick.bind(this);
    this.downloadFile = this.downloadFile.bind(this);
    this.copyToClipboard = this.copyToClipboard.bind(this);
    this.onCancelEdit = this.onCancelEdit.bind(this);
    this.onDataEditValueInput = this.onDataEditValueInput.bind(this);
  }
  onTryEdit() {
    let {model} = this.props;
    model.editCell(this.row.id, this.cell.id);
  }
  componentDidMount() {

  }

  downloadFile(e){
    sfConn.rest(e.target.href, {responseType: "text/csv"}).then(data => {
      let downloadLink = document.createElement("a");
      downloadLink.download = e.target.href.split("/")[6];
      let BOM = "\uFEFF";
      downloadLink.href = "data:text/csv;charset=utf-8," + BOM + encodeURI(data);
      downloadLink.click();
    });
  }
  copyToClipboard(e){
    e.preventDefault();
    navigator.clipboard.writeText(e.target.href);
    this.model.toggleMenu(this.row.id, this.cell.id);
  }
  onClick(e) {
    e.preventDefault();
    this.model.toggleMenu(this.row.id, this.cell.id);
  }
  onDataEditValueInput(e) {
    let {model, cell} = this.props;
    const userInput = e.target.value;
    //TODO state
    cell.dataEditValue = userInput;
    model.didUpdate();
  }
  onCancelEdit(e) {
    e.preventDefault();
    let {model} = this.props;
    model.cancelEditCell(this.row.id, this.cell.id);
  }
  render() {
    let {cell, row, width} = this.props;
    if (cell.isEditing){
      return h("td", {className: "scrolltable-cell", style: {minWidth: width + "px", height: row.height + "px"}},
        h("textarea", {value: cell.dataEditValue, onChange: this.onDataEditValueInput}),
        h("a", {href: "about:blank", onClick: this.onCancelEdit, className: "undo-button"}, "\u21B6"));
    } else {
      return h("td", {className: "scrolltable-cell", style: {minWidth: width + "px", height: row.height + "px"}},
        cell.linkable ? h("a", {href: "about:blank", title: "Show all data", onClick: this.onClick, onDoubleClick: this.onTryEdit}, cell.label) : h("div", {onDoubleClick: this.onTryEdit}, cell.label),
        cell.showMenu ? h("div", {className: "pop-menu"},
          cell.links.map((l, idx) => {
            let arr = [];
            if (l.withIcon) {
              arr.push(h("div", {className: "icon"}));
            }
            arr.push(l.label);
            let attributes = {href: l.href, target: "_blank", className: l.className, key: "link" + idx};
            if (l.action == "copy") {
              attributes.onClick = this.copyToClipboard;
            } else if (l.action == "download") {
              attributes.onClick = this.downloadFile;
            }
            return h("a", attributes, arr);
          })) : ""
      );
    }
  }
}
export class ScrollTableRow extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.row = props.row;
    this.onDoSave = this.onDoSave.bind(this);
  }
  onDoSave(){
    let {model} = this.props;
    model.doSave(this.row.id);
  }
  render() {
    let {model, row} = this.props;
    return h("tr", {},
      row.cells.map((cell, c) => h(ScrollTableCell, {key: "cell" + c, model, cell, row, width: model.colWidths[c]})),
      row.cells.some(c => c.isEditing) ? h("td", {}, h("button", {
        name: "saveBtn",
        key: "saveBtn" + row.id,
        title: "Save the values of this record",
        className: "button button-brand",
        onClick: this.onDoSave
      }, "Save"), row.error ? row.error : "") : ""
    );
  }
}
export class ScrollTable extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.onScroll = this.onScroll.bind(this);
  }

  onScroll(){
    let {model} = this.props;
    model.viewportChange();
  }
  componentDidMount() {
    let {model} = this.props;
    let scroller = this.refs.scroller;
    let scrolled = this.refs.scrolled;
    model.setScrollerElement(scroller, scrolled);
  }
  componentDidUpdate() {
    //let {model} = this.props;
    //model.viewportChange();
  }
  render() {
    let {model} = this.props;
    return h("div", {className: "result-table", onScroll: this.onScroll, ref: "scroller"},
      h("div", {className: "scrolltable-scrolled", ref: "scrolled", style: {height: model.scrolledHeight + "px", width: model.scrolledWidth + "px"}},
        h("table", {style: {top: model.firstRowTop + "px", left: model.firstColLeft + "px"}},
          h("thead", {},
            h("tr", {},
              model.header.map((cell, c) => h("td", {key: "head" + c, className: "scrolltable-cell header", style: {minWidth: model.colWidths[c] + "px", height: model.headerHeight + "px"}}, cell))
            )
          ),
          h("tbody", {},
            model.rows.map((row, r) =>
              h(ScrollTableRow, {key: "row" + r, model, row, rowId: r})
            )
          )
        )
      )
    );
  }
}
