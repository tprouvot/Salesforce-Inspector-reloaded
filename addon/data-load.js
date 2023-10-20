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

function renderCell(rt, cell, td) {
  function popLink(recordInfo, label) {
    let a = document.createElement("a");
    a.href = "about:blank";
    a.title = "Show all data";
    a.addEventListener("click", e => {
      e.preventDefault();
      let pop = document.createElement("div");
      pop.className = "pop-menu";
      td.appendChild(pop);
      let {objectTypes, recordId} = recordInfo();
      for (let objectType of objectTypes) {
        let aShow = document.createElement("a");
        let args = new URLSearchParams();
        args.set("host", rt.sfHost);
        args.set("objectType", objectType);
        if (rt.isTooling) {
          args.set("useToolingApi", "1");
        }
        if (recordId) {
          args.set("recordId", recordId);
        }
        aShow.href = "inspect.html?" + args;
        aShow.target = "_blank";
        aShow.textContent = "Show all data";
        aShow.className = "view-inspector";
        let aShowIcon = document.createElement("div");
        aShowIcon.className = "icon";
        pop.appendChild(aShow);
        aShow.prepend(aShowIcon);

        //Query Record
        let aQuery = document.createElement("a");
        let query = "SELECT Id FROM " + objectTypes + " WHERE Id = '" + recordId + "'";
        let queryArgs = new URLSearchParams();
        queryArgs.set("host", rt.sfHost);
        queryArgs.set("query", query);
        aQuery.href = "data-export.html?" + queryArgs;
        aQuery.target = "_blank";
        aQuery.textContent = "Query Record";
        aQuery.className = "query-record";
        let aqueryIcon = document.createElement("div");
        aqueryIcon.className = "icon";
        pop.appendChild(aQuery);
        aQuery.prepend(aqueryIcon);
      }
      // If the recordId ends with 0000000000AAA it is a dummy ID such as the ID for the master record type 012000000000000AAA
      if (recordId && isRecordId(recordId) && !recordId.endsWith("0000000000AAA")) {
        let aView = document.createElement("a");
        aView.href = "https://" + rt.sfHost + "/" + recordId;
        aView.target = "_blank";
        aView.textContent = "View in Salesforce";
        aView.className = "view-salesforce";
        let aviewIcon = document.createElement("div");
        aviewIcon.className = "icon";
        pop.appendChild(aView);
        aView.prepend(aviewIcon);
      }

      //copy to clipboard
      let aCopy = document.createElement("a");
      aCopy.className = "copy-id";
      aCopy.textContent = "Copy Id";
      aCopy.id = recordId;
      let acopyIcon = document.createElement("div");
      acopyIcon.className = "icon";
      pop.appendChild(aCopy);
      aCopy.prepend(acopyIcon);
      aCopy.addEventListener("click", e => {
        navigator.clipboard.writeText(e.target.id);
        td.removeChild(pop);
      });
      function closer(ev) {
        if (ev != e && ev.target.closest(".pop-menu") != pop) {
          removeEventListener("click", closer);
          pop.remove();
        }
      }
      addEventListener("click", closer);
    });
    a.textContent = label;
    td.appendChild(a);
  }
  function isRecordId(recordId) {
    // We assume a string is a Salesforce ID if it is 18 characters,
    // contains only alphanumeric characters,
    // the record part (after the 3 character object key prefix and 2 character instance id) starts with at least four zeroes,
    // and the 3 character object key prefix is not all zeroes.
    return /^[a-z0-9]{5}0000[a-z0-9]{9}$/i.exec(recordId) && !recordId.startsWith("000");
  }
  if (typeof cell == "object" && cell != null && cell.attributes && cell.attributes.type) {
    popLink(
      () => {
        let recordId = null;
        if (cell.attributes.url) {
          recordId = cell.attributes.url.replace(/.*\//, "");
        }
        let objectTypes = [cell.attributes.type];
        return {objectTypes, recordId};
      },
      cell.attributes.type
    );
  } else if (typeof cell == "string" && isRecordId(cell)) {
    popLink(
      () => {
        let recordId = cell;
        let {globalDescribe} = rt.describeInfo.describeGlobal(rt.isTooling);
        let objectTypes;
        if (globalDescribe) {
          let keyPrefix = recordId.substring(0, 3);
          objectTypes = globalDescribe.sobjects.filter(sobject => sobject.keyPrefix == keyPrefix).map(sobject => sobject.name);
        } else {
          objectTypes = [];
        }
        return {objectTypes, recordId};
      },
      cell
    );
  } else if (cell == null) {
    td.textContent = "";
  } else {
    td.textContent = cell;
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

@param element A scrollable DOM element to render the table within.
ScrollTable initScrollTable(DOMElement element);
interface Table {
  Cell[][] table; // a two-dimensional array of table rows and cells
  boolean[] rowVisibilities; // For each row, true if it is visible, or false if it is hidden
  boolean[] colVisibilities; // For each column, true if it is visible, or false if it is hidden
  // Refactor: The following three attributes are only used by renderCell, they should be moved to a different interface
  boolean isTooling;
  DescribeInfo describeInfo;
  String sfHost;
}
void renderCell(Table table, Cell cell, DOMElement element); // Render cell within element
interface Cell {
  // Anything, passed to the renderCell function
}
interface ScrollTable {
  void viewportChange(); // Must be called whenever the size of viewport changes.
  void dataChange(Table newData); // Must be called whenever the data changes. (even if it is the same object)
}
*/
export function initScrollTable(scroller) {
  let data = null;
  let scrolled = document.createElement("div");
  scrolled.className = "scrolltable-scrolled";
  scroller.appendChild(scrolled);

  let initialRowHeight = 15; // constant: The initial estimated height of a row before it is rendered
  let initialColWidth = 50; // constant: The initial estimated width of a column before it is rendered
  let bufferHeight = 500; // constant: The number of pixels to render above and below the current viewport
  let bufferWidth = 500; // constant: The number of pixels to render to the left and right of the current viewport
  let headerRows = 1; // constant: The number of header rows
  let headerCols = 0; // constant: The number of header columns

  let rowHeights = []; // The height in pixels of each row
  let rowVisible = []; // The visibility of each row. 0 = hidden, 1 = visible
  let rowCount = 0;
  let totalHeight = 0; // The sum of heights of visible cells
  let firstRowIdx = 0; // The index of the first rendered row
  let firstRowTop = 0; // The distance from the top of the table to the top of the first rendered row
  let lastRowIdx = 0; // The index of the row below the last rendered row
  let lastRowTop = 0; // The distance from the top of the table to the bottom of the last rendered row (the top of the row below the last rendered row)
  let colWidths = []; // The width in pixels of each column
  let colVisible = []; // The visibility of each column. 0 = hidden, 1 = visible
  let colCount = 0;
  let totalWidth = 0; // The sum of widths of visible cells
  let firstColIdx = 0; // The index of the first rendered column
  let firstColLeft = 0; // The distance from the left of the table to the left of the first rendered column
  let lastColIdx = 0; // The index of the column to the right of the last rendered column
  let lastColLeft = 0; // The distance from the left of the table to the right of the last rendered column (the left of the column after the last rendered column)

  function dataChange(newData) {
    data = newData;
    if (data == null || data.rowVisibilities.length == 0 || data.colVisibilities.length == 0) {
      // First render, or table was cleared
      rowHeights = [];
      rowVisible = [];
      rowCount = 0;
      totalHeight = 0;
      firstRowIdx = 0;
      firstRowTop = 0;
      lastRowIdx = 0;
      lastRowTop = 0;

      colWidths = [];
      colVisible = [];
      colCount = 0;
      totalWidth = 0;
      firstColIdx = 0;
      firstColLeft = 0;
      lastColIdx = 0;
      lastColLeft = 0;
      renderData({force: true});
    } else {
      // Data or visibility was changed
      let newRowCount = data.rowVisibilities.length;
      for (let r = rowCount; r < newRowCount; r++) {
        rowHeights[r] = initialRowHeight;
        rowVisible[r] = 0;
      }
      rowCount = newRowCount;
      for (let r = 0; r < rowCount; r++) {
        let newVisible = Number(data.rowVisibilities[r]);
        let visibilityChange = newVisible - rowVisible[r];
        totalHeight += visibilityChange * rowHeights[r];
        if (r < firstRowIdx) {
          firstRowTop += visibilityChange * rowHeights[r];
        }
        rowVisible[r] = newVisible;
      }
      let newColCount = data.colVisibilities.length;
      for (let c = colCount; c < newColCount; c++) {
        colWidths[c] = initialColWidth;
        colVisible[c] = 0;
      }
      colCount = newColCount;
      for (let c = 0; c < colCount; c++) {
        let newVisible = Number(data.colVisibilities[c]);
        let visibilityChange = newVisible - colVisible[c];
        totalWidth += visibilityChange * colWidths[c];
        if (c < firstColIdx) {
          firstColLeft += visibilityChange * colWidths[c];
        }
        colVisible[c] = newVisible;
      }
      renderData({force: true});
    }
  }

  let scrollTop = 0;
  let scrollLeft = 0;
  let offsetHeight = 0;
  let offsetWidth = 0;
  function viewportChange() {
    if (scrollTop == scroller.scrollTop
      && scrollLeft == scroller.scrollLeft
      && offsetHeight == scroller.offsetHeight
      && offsetWidth == scroller.offsetWidth
    ) {
      return;
    }
    renderData({force: false});
  }

  function renderData({force}) {
    scrollTop = scroller.scrollTop;
    scrollLeft = scroller.scrollLeft;
    offsetHeight = scroller.offsetHeight;
    offsetWidth = scroller.offsetWidth;

    if (rowCount == 0 || colCount == 0) {
      scrolled.textContent = ""; // Delete previously rendered content
      scrolled.style.height = "0px";
      scrolled.style.width = "0px";
      return;
    }

    if (!force && firstRowTop <= scrollTop && (lastRowTop >= scrollTop + offsetHeight || lastRowIdx == rowCount) && firstColLeft <= scrollLeft && (lastColLeft >= scrollLeft + offsetWidth || lastColIdx == colCount)) {
      return;
    }
    console.log("render");

    while (firstRowTop < scrollTop - bufferHeight && firstRowIdx < rowCount - 1) {
      firstRowTop += rowVisible[firstRowIdx] * rowHeights[firstRowIdx];
      firstRowIdx++;
    }
    while (firstRowTop > scrollTop - bufferHeight && firstRowIdx > 0) {
      firstRowIdx--;
      firstRowTop -= rowVisible[firstRowIdx] * rowHeights[firstRowIdx];
    }
    while (firstColLeft < scrollLeft - bufferWidth && firstColIdx < colCount - 1) {
      firstColLeft += colVisible[firstColIdx] * colWidths[firstColIdx];
      firstColIdx++;
    }
    while (firstColLeft > scrollLeft - bufferWidth && firstColIdx > 0) {
      firstColIdx--;
      firstColLeft -= colVisible[firstColIdx] * colWidths[firstColIdx];
    }

    lastRowIdx = firstRowIdx;
    lastRowTop = firstRowTop;
    while (lastRowTop < scrollTop + offsetHeight + bufferHeight && lastRowIdx < rowCount) {
      lastRowTop += rowVisible[lastRowIdx] * rowHeights[lastRowIdx];
      lastRowIdx++;
    }
    lastColIdx = firstColIdx;
    lastColLeft = firstColLeft;
    while (lastColLeft < scrollLeft + offsetWidth + bufferWidth && lastColIdx < colCount) {
      lastColLeft += colVisible[lastColIdx] * colWidths[lastColIdx];
      lastColIdx++;
    }

    scrolled.textContent = ""; // Delete previously rendered content
    scrolled.style.height = totalHeight + "px";
    scrolled.style.width = totalWidth + "px";

    let table = document.createElement("table");
    let cellsVisible = false;
    for (let r = firstRowIdx; r < lastRowIdx; r++) {
      if (rowVisible[r] == 0) {
        continue;
      }
      let row = data.table[r];
      let tr = document.createElement("tr");
      for (let c = firstColIdx; c < lastColIdx; c++) {
        if (colVisible[c] == 0) {
          continue;
        }
        let cell = row[c];
        let td = document.createElement("td");
        td.className = "scrolltable-cell";
        if (r < headerRows || c < headerCols) {
          td.className += " header";
        }
        td.style.minWidth = colWidths[c] + "px";
        td.style.height = rowHeights[r] + "px"; // min-height does not work on table cells, but height acts as min-height
        renderCell(data, cell, td);
        tr.appendChild(td);
        cellsVisible = true;
      }
      table.appendChild(tr);
    }
    table.style.top = firstRowTop + "px";
    table.style.left = firstColLeft + "px";
    scrolled.appendChild(table);
    // Before this point we invalidate style and layout. After this point we recalculate style and layout, and we do not invalidate them again.
    if (cellsVisible) {
      let tr = table.firstElementChild;
      for (let r = firstRowIdx; r < lastRowIdx; r++) {
        if (rowVisible[r] == 0) {
          continue;
        }
        let rowRect = tr.firstElementChild.getBoundingClientRect();
        let oldHeight = rowHeights[r];
        let newHeight = Math.max(oldHeight, rowRect.height);
        rowHeights[r] = newHeight;
        totalHeight += newHeight - oldHeight;
        lastRowTop += newHeight - oldHeight;
        tr = tr.nextElementSibling;
      }
      let td = table.firstElementChild.firstElementChild;
      for (let c = firstColIdx; c < lastColIdx; c++) {
        if (colVisible[c] == 0) {
          continue;
        }
        let colRect = td.getBoundingClientRect();
        let oldWidth = colWidths[c];
        let newWidth = Math.max(oldWidth, colRect.width);
        colWidths[c] = newWidth;
        totalWidth += newWidth - oldWidth;
        lastColLeft += newWidth - oldWidth;
        td = td.nextElementSibling;
      }
    }
  }

  dataChange(null);
  scroller.addEventListener("scroll", viewportChange);
  return {
    viewportChange,
    dataChange
  };
}
