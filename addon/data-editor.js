/* global React ReactDOM */
import {sfConn} from "./inspector.js";
/* global initButton */
import {csvParse} from "./csv-parse.js";
import {DescribeInfo} from "./data-load.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, createSpinForMethod, copyToClipboard, downloadCsvFile, applyProductionStyling, isRecordId} from "./utils.js";
import {openWithHandoff, loadHandoff} from "./data-editor-handoff.js";

const ROW_HEIGHT = 26;
const ROW_NUMBER_WIDTH = 56;
const OVERSCAN = 10;
const COLUMN_OVERSCAN = 2;
const MAX_UNDO = 200;
const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: "base"});

function isKeyColumn(name) {
  return name == "_" || name.toLowerCase() == "id";
}

function isValidDate(value) {
  return /^\d{4}-\d\d-\d\d$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
}

const TIME = "([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d(\\.\\d+)?)?";

// Validates edited value against the field describe
function fieldWarning(field, value) {
  let v = value.trim();
  if (v == "") return field.nillable ? "" : "Required field";
  let picklist = () => (field.picklistValues || []).filter(p => p.active).map(p => p.value);
  switch (field.type) {
    case "boolean":
      return /^(true|false|1|0)$/i.test(v) ? "" : "Expected true or false";
    case "int":
      return /^[-+]?\d+$/.test(v) ? "" : "Expected a whole number";
    case "double":
    case "currency":
    case "percent":
      return /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(v) ? "" : "Expected a number, with . as decimal separator and no thousands separator";
    case "date":
      return isValidDate(v) ? "" : "Expected a date as YYYY-MM-DD";
    case "datetime":
      return new RegExp("^\\d{4}-\\d\\d-\\d\\dT" + TIME + "(Z|[+-]\\d\\d:?\\d\\d)?$").test(v) && isValidDate(v.slice(0, 10)) ? "" : "Expected a date and time as YYYY-MM-DDThh:mm:ssZ";
    case "time":
      return new RegExp("^" + TIME + "Z?$").test(v) ? "" : "Expected a time as hh:mm:ss";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Expected an email address";
    case "id":
    case "reference":
      return isRecordId(v) ? "" : "Expected a record Id (15 or 18 characters)";
    case "picklist":
    case "multipicklist": {
      let items = field.type == "picklist" ? [v] : v.split(";").map(item => item.trim()).filter(item => item);
      let unknown = items.filter(item => !picklist().includes(item));
      return unknown.length == 0 ? ""
        : "Not an active value of this picklist: " + unknown.join(", ") + (field.restrictedPicklist ? "" : " (accepted, the picklist is not restricted)");
    }
  }
  return field.length && value.length > field.length ? "Too long: " + value.length + " characters, max " + field.length : "";
}

function estimateWidth(name, rows, c) {
  let len = name.length;
  for (let r = 0; r < rows.length && r < 200; r++) {
    len = Math.max(len, (rows[r][c] || "").length);
  }
  return Math.max(60, Math.min(320, (len * 7) + 20));
}

function quoteCell(value) {
  return "\"" + value.split("\"").join("\"\"") + "\"";
}

function serialize(header, rows, separator) {
  return [header, ...rows].map(cells => cells.map(quoteCell).join(separator)).join("\r\n");
}

class Model {
  constructor(sfHost) {
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";
    this.spinnerCount = 0;
    this.reactCallback = null;
    this.spinFor = createSpinForMethod(this);
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));
    applyProductionStyling(sfHost);

    this.columns = [];
    this.describeInfo = new DescribeInfo(this.spinFor, () => this.applyDescribe());
    this.fields = null;
    this.readOnlyReason = "";
    this.displayColumns = new Set();
    this.rows = [];
    this.view = [];
    this.filter = "";
    this.sort = null;
    this.sel = null;
    this.editing = null;
    this.undoStack = [];
    this.redoStack = [];
    this.version = 0;
    this.sentVersion = 0;
    this.statsCache = null;
    this.sobject = "";
    this.apiType = "Enterprise";
    this.changesOnly = true;
    this.errorMessage = "";
  }

  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }

  get hasData() {
    return this.columns.length > 0;
  }

  setTable(header, rows, {apiType, changesOnly, query}) {
    let typeColumn = header.indexOf("_");
    let typeCell = typeColumn >= 0 && rows[0] ? rows[0][typeColumn] : "";
    this.sobject = /^\[\w+\]$/.test(typeCell) ? typeCell.slice(1, -1) : "";
    this.apiType = apiType || "Enterprise";
    // toLabel(), FORMAT() and convertCurrency() in the SELECT clause return display values (column named after the alias or the field)
    let selectClause = (query || "").split(/\bfrom\b/i)[0];
    let displayFunctions = /\b(?:toLabel|format|convertCurrency)\s*\(\s*([\w.]+)\s*\)(?:\s+(\w+))?/gi;
    this.displayColumns = new Set(Array.from(selectClause.matchAll(displayFunctions), m => (m[2] || m[1]).toLowerCase()));
    this.columns = header.map((name, c) => ({name, width: estimateWidth(name, rows, c)}));
    this.rows = rows.map(cells => {
      let padded = header.map((_, c) => cells[c] ?? "");
      return {cells: padded, orig: padded.slice()};
    });
    this.changesOnly = changesOnly;
    this.undoStack = [];
    this.redoStack = [];
    this.sort = null;
    this.filter = "";
    this.version++;
    this.sentVersion = this.version;
    this.refreshView();
    document.title = "Data Editor" + (this.sobject ? " - " + this.sobject : "");
    this.applyDescribe();
  }

  applyDescribe() {
    let describable = this.sobject && this.sobject != "AggregateResult";
    let {sobjectDescribe} = describable ? this.describeInfo.describeSobject(this.apiType == "Tooling", this.sobject) : {};
    this.fields = sobjectDescribe ? new Map(sobjectDescribe.fields.map(field => [field.name.toLowerCase(), field])) : null;
    this.readOnlyReason = this.sobject == "AggregateResult" ? "Aggregate query results cannot be imported"
      : sobjectDescribe && !sobjectDescribe.createable && !sobjectDescribe.updateable ? this.sobject + " records cannot be created or updated"
      : "";
    for (let col of this.columns) Object.assign(col, this.columnAccess(col.name));
    this.version++;
  }

  columnAccess(name) {
    let access = (locked, reason, field = null, createOnly = false) => ({locked, reason, field, createOnly});
    if (name == "_") return access(true, "Record type, used by Data Import to find the object");
    if (name.toLowerCase() == "id") return access(true, "Record Id, used by Data Import to find the record");
    if (this.readOnlyReason) return access(true, this.readOnlyReason);
    if (this.displayColumns.has(name.toLowerCase())) {
      return access(true, "Display value (toLabel, FORMAT or convertCurrency in the query): writing it back would store the wrong value");
    }
    if (!this.fields || name.includes(":")) return access(false, ""); // No describe (pasted data), or Data Import's Relationship:Object:ExternalIdField syntax
    let field = this.fields.get(name.toLowerCase());
    if (!field) {
      return access(true, name.includes(".")
        ? "Field of a related record. To change the parent, edit its lookup field (such as AccountId). To edit child records, query their object."
        : "Not a field of " + this.sobject + " (related record, subquery or alias)");
    }
    if (field.type == "encryptedstring") return access(true, "Encrypted field: the value may be masked, writing it back would overwrite the real value", field);
    if (field.updateable) return access(false, "", field);
    if (field.createable) return access(false, "Can only be set on new rows", field, true);
    return access(true, "Read-only field (formula, system or compound field, or no edit access)", field);
  }

  isCellLocked(row, c) {
    let col = this.columns[c];
    return col.locked || (col.createOnly && !!row.orig);
  }

  cellWarning(row, c) {
    let field = this.columns[c].field;
    return field && !this.isCellLocked(row, c) && this.isCellDirty(row, c) ? fieldWarning(field, row.cells[c]) : "";
  }

  refreshView() {
    let filter = this.filter.trim().toLowerCase();
    let view = filter ? this.rows.filter(row => row.cells.some(v => v.toLowerCase().includes(filter))) : this.rows.slice();
    if (this.sort) {
      let {col, dir} = this.sort;
      view.sort((a, b) => {
        let x = a.cells[col];
        let y = b.cells[col];
        if (x === y) return 0;
        if (x === "") return 1;
        if (y === "") return -1;
        return dir * collator.compare(x, y);
      });
    }
    this.view = view;
    this.editing = null;
    this.sel = view.length > 0 && this.columns.length > 0 ? {ar: 0, ac: 0, fr: 0, fc: 0} : null;
  }

  setFilter(value) {
    this.filter = value;
    this.refreshView();
  }

  toggleSort(col) {
    if (!this.sort || this.sort.col != col) {
      this.sort = {col, dir: 1};
    } else if (this.sort.dir == 1) {
      this.sort = {col, dir: -1};
    } else {
      this.sort = null;
    }
    this.refreshView();
  }

  isCellDirty(row, c) {
    return row.orig ? row.cells[c] !== row.orig[c] : row.cells[c] !== "";
  }

  isRowChanged(row) {
    return !row.orig || row.cells.some((v, c) => v !== row.orig[c]);
  }

  stats() {
    if (this.statsCache?.version !== this.version) {
      let changedRows = 0;
      let newRows = 0;
      let warnings = 0;
      for (let row of this.rows) {
        if (!row.orig) newRows++;
        else if (this.isRowChanged(row)) changedRows++;
        else continue;
        for (let c = 0; c < this.columns.length; c++) {
          if (this.cellWarning(row, c)) warnings++;
        }
      }
      this.statsCache = {version: this.version, changedRows, newRows, warnings};
    }
    return this.statsCache;
  }

  hasUnsentChanges() {
    let {changedRows, newRows} = this.stats();
    return this.version != this.sentVersion && changedRows + newRows > 0;
  }

  // Undoable actions
  applyAction(action, isUndo) {
    switch (action.type) {
      case "cells":
        for (let change of action.changes) {
          change.row.cells[change.c] = isUndo ? change.before : change.after;
        }
        break;
      case "insert":
      case "delete":
        if ((action.type == "insert") != isUndo) {
          for (let item of action.items) this.rows.splice(item.index, 0, item.row);
          for (let item of action.items.slice().sort((a, b) => a.viewIndex - b.viewIndex)) {
            this.view.splice(Math.min(item.viewIndex, this.view.length), 0, item.row);
          }
        } else {
          for (let i = action.items.length - 1; i >= 0; i--) this.rows.splice(action.items[i].index, 1);
          let removed = new Set(action.items.map(item => item.row));
          this.view = this.view.filter(row => !removed.has(row));
        }
        break;
      case "column": {
        let {index} = action;
        if (action.remove == isUndo) {
          this.columns.splice(index, 0, Object.assign(action.col, this.columnAccess(action.col.name)));
          for (let row of this.rows) {
            let [cell, orig] = action.values?.get(row) || ["", ""];
            row.cells.splice(index, 0, cell);
            if (row.orig) row.orig.splice(index, 0, orig);
          }
          if (this.sort && this.sort.col >= index) this.sort.col++;
          if (action.sortDir) this.sort = {col: index, dir: action.sortDir};
        } else {
          this.columns.splice(index, 1);
          action.values = new Map(this.rows.map(row => [row, [row.cells.splice(index, 1)[0], row.orig?.splice(index, 1)[0]]]));
          action.sortDir = this.sort?.col == index ? this.sort.dir : 0;
          if (this.sort?.col == index) this.sort = null;
          else if (this.sort?.col > index) this.sort.col--;
        }
        break;
      }
      case "batch":
        for (let child of isUndo ? action.actions.slice().reverse() : action.actions) {
          this.applyAction(child, isUndo);
        }
        break;
    }
    this.editing = null;
    this.version++;
  }

  execute(action) {
    this.applyAction(action, false);
    this.undoStack.push(action);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    let action = this.undoStack.pop();
    if (!action) return;
    this.applyAction(action, true);
    this.redoStack.push(action);
    this.clampSelection();
  }

  redo() {
    let action = this.redoStack.pop();
    if (!action) return;
    this.applyAction(action, false);
    this.undoStack.push(action);
    this.clampSelection();
  }

  cellChanges(edits) {
    return edits
      .filter(({row, c, value}) => !this.isCellLocked(row, c) && row.cells[c] !== value)
      .map(({row, c, value}) => ({row, c, before: row.cells[c], after: value}));
  }

  setCells(edits) {
    let changes = this.cellChanges(edits);
    if (changes.length > 0) this.execute({type: "cells", changes});
    return changes.length;
  }

  newRow() {
    let typeColumn = this.columns.findIndex(col => col.name == "_");
    let cells = this.columns.map(() => "");
    if (typeColumn >= 0 && this.sobject) cells[typeColumn] = "[" + this.sobject + "]";
    return {cells, orig: null};
  }

  addRow() {
    let viewIndex = this.sel ? this.selRange().r2 + 1 : this.view.length;
    let after = this.view[viewIndex - 1];
    let index = after ? this.rows.indexOf(after) + 1 : this.rows.length;
    this.execute({type: "insert", items: [{row: this.newRow(), index, viewIndex}]});
    this.sel = {ar: viewIndex, ac: 0, fr: viewIndex, fc: 0};
  }

  deleteSelectedRows() {
    if (!this.sel) return;
    let {r1, r2} = this.selRange();
    let viewIndexes = new Map(this.view.slice(r1, r2 + 1).map((row, i) => [row, r1 + i]));
    let items = [];
    this.rows.forEach((row, index) => {
      if (viewIndexes.has(row)) items.push({row, index, viewIndex: viewIndexes.get(row)});
    });
    this.execute({type: "delete", items});
    let r = Math.min(r1, this.view.length - 1);
    this.sel = r >= 0 ? {ar: r, ac: this.sel.fc, fr: r, fc: this.sel.fc} : null;
  }

  addColumn(name) {
    name = (name || "").trim();
    if (!name) return;
    let access = this.columnAccess(name);
    name = access.field?.name || name; // The API name, as Data Import expects it
    let error = this.columns.some(col => col.name.toLowerCase() == name.toLowerCase()) ? "It is already in the table."
      : access.locked ? access.reason + "."
      : "";
    if (error) {
      this.errorMessage = "The column " + name + " cannot be added. " + error;
      return;
    }
    this.errorMessage = "";
    let c = this.columns.length;
    this.execute({type: "column", index: c, col: {name, width: estimateWidth(name, [], 0), ...access}, remove: false});
    this.sel = this.view.length > 0 ? {ar: 0, ac: c, fr: 0, fc: c} : null;
  }

  deleteSelectedColumns() {
    // Removes the columns from this table only; "_" and Id are kept for Data Import
    if (!this.sel) return;
    let {c1, c2} = this.selRange();
    let actions = [];
    for (let c = c2; c >= c1; c--) {
      if (!isKeyColumn(this.columns[c].name)) actions.push({type: "column", index: c, col: this.columns[c], remove: true});
    }
    if (actions.length == 0 || actions.length == this.columns.length) {
      this.errorMessage = actions.length == 0 ? "The _ and Id columns cannot be deleted: Data Import needs them." : "At least one column must remain.";
      return;
    }
    this.errorMessage = "";
    this.execute({type: "batch", actions});
    this.sel = null;
    this.select(0, c1, false);
  }

  replaceAll(find, replacement) {
    if (!find || this.view.length == 0) return 0;
    let pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let range = this.sel ? this.selRange() : null;
    if (!range || (range.r1 == range.r2 && range.c1 == range.c2)) {
      range = {r1: 0, r2: this.view.length - 1, c1: 0, c2: this.columns.length - 1};
    }
    let edits = [];
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        let row = this.view[r];
        edits.push({row, c, value: row.cells[c].replace(pattern, () => replacement)});
      }
    }
    return this.setCells(edits);
  }

  selRange() {
    let {ar, ac, fr, fc} = this.sel;
    return {r1: Math.min(ar, fr), r2: Math.max(ar, fr), c1: Math.min(ac, fc), c2: Math.max(ac, fc)};
  }

  isSelected(r, c) {
    if (!this.sel) return false;
    let {r1, r2, c1, c2} = this.selRange();
    return r >= r1 && r <= r2 && c >= c1 && c <= c2;
  }

  select(r, c, extend) {
    if (this.view.length == 0) return;
    r = Math.max(0, Math.min(this.view.length - 1, r));
    c = Math.max(0, Math.min(this.columns.length - 1, c));
    this.sel = extend && this.sel ? {...this.sel, fr: r, fc: c} : {ar: r, ac: c, fr: r, fc: c};
  }

  clampSelection() {
    if (this.sort && this.sort.col >= this.columns.length) this.sort = null;
    let sel = this.sel;
    if (sel && Math.max(sel.ar, sel.fr) < this.view.length && Math.max(sel.ac, sel.fc) < this.columns.length) return;
    let {fr, fc} = sel || {fr: 0, fc: 0};
    this.sel = null;
    this.select(fr, fc, false);
  }

  selectRows(r1, r2) {
    this.sel = {ar: r1, ac: 0, fr: r2, fc: this.columns.length - 1};
  }

  selectAll() {
    if (this.view.length > 0) this.sel = {ar: 0, ac: 0, fr: this.view.length - 1, fc: this.columns.length - 1};
  }

  activeValue() {
    if (!this.sel) return "";
    return this.view[this.sel.fr].cells[this.sel.fc];
  }

  activeLocked() {
    return !this.sel || this.isCellLocked(this.view[this.sel.fr], this.sel.fc);
  }

  beginEdit(value, source = "cell") {
    if (this.activeLocked()) return;
    this.editing = {value: value ?? this.activeValue(), source};
  }

  commitEdit(fillSelection) {
    if (!this.editing) return;
    let value = this.editing.value;
    this.editing = null;
    if (fillSelection) {
      let {r1, r2, c1, c2} = this.selRange();
      let edits = [];
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) edits.push({row: this.view[r], c, value});
      }
      this.setCells(edits);
    } else {
      this.setCells([{row: this.view[this.sel.fr], c: this.sel.fc, value}]);
    }
  }

  cancelEdit() {
    this.editing = null;
  }

  clearSelection() {
    if (!this.sel) return;
    let {r1, r2, c1, c2} = this.selRange();
    let edits = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) edits.push({row: this.view[r], c, value: ""});
    }
    this.setCells(edits);
  }

  selectionAsTsv() {
    let {r1, r2, c1, c2} = this.selRange();
    let lines = [];
    for (let r = r1; r <= r2; r++) {
      lines.push(this.view[r].cells.slice(c1, c2 + 1).map(v => (/[\t\n\r"]/.test(v) ? quoteCell(v) : v)).join("\t"));
    }
    return lines.join("\r\n");
  }

  paste(text) {
    let grid;
    try {
      grid = csvParse(text.replace(/(\r?\n)+$/, ""), "\t");
    } catch (e) {
      this.errorMessage = "Could not read the pasted data: " + e.message;
      return;
    }
    if (grid.length == 0) return;
    this.errorMessage = "";
    if (!this.hasData) {
      if (grid.length < 2 && grid[0].length < 2) return;
      this.setTable(grid[0], grid.slice(1), {changesOnly: false});
      return;
    }
    if (!this.sel) {
      if (this.view.length > 0) return;
      this.sel = {ar: 0, ac: 0, fr: 0, fc: 0};
    }
    let {r1, r2, c1, c2} = this.selRange();
    let edits = [];
    if (grid.length == 1 && grid[0].length == 1 && this.view.length > 0) {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) edits.push({row: this.view[r], c, value: grid[0][0]});
      }
      this.setCells(edits);
      return;
    }
    let inserted = [];
    for (let i = 0; i < grid.length; i++) {
      let row = this.view[r1 + i];
      if (!row) {
        row = this.newRow();
        inserted.push({row, index: this.rows.length + inserted.length, viewIndex: r1 + i});
      }
      grid[i].forEach((value, j) => {
        if (c1 + j < this.columns.length) edits.push({row, c: c1 + j, value});
      });
    }
    let actions = [];
    if (inserted.length > 0) actions.push({type: "insert", items: inserted});
    let changes = this.cellChanges(edits);
    if (changes.length > 0) actions.push({type: "cells", changes});
    if (actions.length == 0) return;
    this.execute({type: "batch", actions});
    this.sel = {ar: r1, ac: c1, fr: r1 + grid.length - 1, fc: Math.min(this.columns.length - 1, c1 + grid[0].length - 1)};
  }

  header() {
    return this.columns.map(col => col.name);
  }

  copyAll() {
    copyToClipboard(serialize(this.header(), this.view.map(row => row.cells), "\t"));
  }

  downloadCsv() {
    let separator = localStorage.getItem("csvSeparator") || ",";
    let filename = (this.sobject || "data") + "-" + new Date().toLocaleDateString() + ".csv";
    downloadCsvFile(serialize(this.header(), this.view.map(row => row.cells), separator), filename);
  }

  rowsToSend() {
    // Changes are sent even when the filter hides them; otherwise the rows currently shown are sent
    return this.changesOnly ? this.rows.filter(row => this.isRowChanged(row)) : this.view;
  }

  importPayload() {
    let rows = this.rowsToSend();
    let cols = this.columns.map((_, c) => c);
    if (this.changesOnly) {
      // Keep the record type, the Id and the columns that were actually changed, so unchanged fields are not overwritten
      cols = cols.filter(c => isKeyColumn(this.columns[c].name) || rows.some(row => this.isCellDirty(row, c)));
    }
    // Without any Id value (only new rows), drop the column so Data Import proposes Insert instead of Update
    cols = cols.filter(c => this.columns[c].name.toLowerCase() != "id" || rows.some(row => row.cells[c] != ""));
    // Read-only columns are sent with a "_" prefix, which Data Import shows as skipped
    let header = cols.map(c => this.columns[c]).map(col => (col.locked && !isKeyColumn(col.name) ? "_" : "") + col.name);
    let text = serialize(header, rows.map(row => cols.map(c => row.cells[c])), "\t");
    return {text, apiType: this.apiType};
  }

  sendToImport() {
    let version = this.version;
    this.spinFor(openWithHandoff("data-import.html", new URLSearchParams({host: this.sfHost}), this.importPayload()).then(() => {
      this.sentVersion = version;
    }));
  }
}

let h = React.createElement;

class Grid extends React.Component {
  constructor(props) {
    super(props);
    this.scroller = null;
    this.state = {scrollTop: 0, scrollLeft: 0, viewportHeight: 600, viewportWidth: 1200};
    this.dragging = false;
    this.onScroll = this.onScroll.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  componentDidMount() {
    document.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("resize", this.onResize);
    this.onResize();
    this.scroller.focus({preventScroll: true});
  }

  componentWillUnmount() {
    document.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("resize", this.onResize);
  }

  componentDidUpdate() {
    let {model} = this.props;
    if (!model.editing && this.wasEditing && document.activeElement?.tagName != "INPUT") {
      this.scroller.focus({preventScroll: true});
    }
    this.wasEditing = !!model.editing;
    if (this.pendingScroll) {
      this.pendingScroll = false;
      this.ensureVisible();
    }
  }

  onResize() {
    this.setState({viewportHeight: this.scroller.clientHeight, viewportWidth: this.scroller.clientWidth});
  }

  onScroll() {
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.setState({scrollTop: this.scroller.scrollTop, scrollLeft: this.scroller.scrollLeft});
    });
  }

  ensureVisible() {
    let {model} = this.props;
    if (!model.sel) return;
    let el = this.scroller;
    let {fr, fc} = model.sel;
    let top = fr * ROW_HEIGHT;
    let visibleRowsHeight = el.clientHeight - ROW_HEIGHT; // minus the sticky header
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + visibleRowsHeight) el.scrollTop = top + ROW_HEIGHT - visibleRowsHeight;
    let left = model.columns.slice(0, fc).reduce((sum, col) => sum + col.width, 0);
    let right = left + model.columns[fc].width;
    let visibleWidth = el.clientWidth - ROW_NUMBER_WIDTH; // minus the sticky row numbers
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (right > el.scrollLeft + visibleWidth) el.scrollLeft = right - visibleWidth;
  }

  update() {
    this.pendingScroll = true;
    this.props.model.didUpdate();
  }

  cellFromEvent(e) {
    let td = e.target.closest("td[data-r]");
    return td ? {r: Number(td.dataset.r), c: Number(td.dataset.c)} : null;
  }

  onMouseDown(e) {
    let {model} = this.props;
    let cell = this.cellFromEvent(e);
    if (!cell || e.button != 0 || e.target.tagName == "INPUT") return;
    e.preventDefault();
    this.scroller.focus({preventScroll: true});
    if (model.editing) model.commitEdit();
    if (cell.c < 0) {
      this.dragRows = true;
      this.rowAnchor = e.shiftKey && model.sel ? model.sel.ar : cell.r;
      model.selectRows(this.rowAnchor, cell.r);
    } else {
      this.dragRows = false;
      model.select(cell.r, cell.c, e.shiftKey);
    }
    this.dragging = true;
    model.didUpdate();
  }

  onMouseOver(e) {
    if (!this.dragging) return;
    let {model} = this.props;
    let cell = this.cellFromEvent(e);
    if (!cell) return;
    if (this.dragRows) model.selectRows(this.rowAnchor, cell.r);
    else if (cell.c >= 0) model.select(cell.r, cell.c, true);
    model.didUpdate();
  }

  onMouseUp() {
    this.dragging = false;
  }

  onDoubleClick(e) {
    let {model} = this.props;
    let cell = this.cellFromEvent(e);
    if (!cell || cell.c < 0) return;
    model.select(cell.r, cell.c, false);
    model.beginEdit();
    model.didUpdate();
  }

  onKeyDown(e) {
    let {model} = this.props;
    if (e.target != this.scroller) return;
    let ctrl = e.ctrlKey || e.metaKey;
    let key = e.key;
    if (ctrl && (key.toLowerCase() == "z" || key.toLowerCase() == "y")) {
      e.preventDefault();
      if (key.toLowerCase() == "y" || e.shiftKey) model.redo(); else model.undo();
      this.update();
      return;
    }
    if (!model.sel) return;
    let {fr, fc} = model.sel;
    let pageRows = Math.max(1, Math.floor(this.scroller.clientHeight / ROW_HEIGHT) - 1);
    let lastRow = model.view.length - 1;
    let lastCol = model.columns.length - 1;
    let move = (r, c) => {
      e.preventDefault();
      model.select(r, c, e.shiftKey);
      this.update();
    };
    if (ctrl && key.toLowerCase() == "a") {
      e.preventDefault();
      model.selectAll();
      model.didUpdate();
    } else if (key == "ArrowUp") {
      move(ctrl ? 0 : fr - 1, fc);
    } else if (key == "ArrowDown") {
      move(ctrl ? lastRow : fr + 1, fc);
    } else if (key == "ArrowLeft") {
      move(fr, ctrl ? 0 : fc - 1);
    } else if (key == "ArrowRight") {
      move(fr, ctrl ? lastCol : fc + 1);
    } else if (key == "PageUp") {
      move(fr - pageRows, fc);
    } else if (key == "PageDown") {
      move(fr + pageRows, fc);
    } else if (key == "Home") {
      move(ctrl ? 0 : fr, 0);
    } else if (key == "End") {
      move(ctrl ? lastRow : fr, lastCol);
    } else if (key == "Tab") {
      e.preventDefault();
      model.select(fr, fc + (e.shiftKey ? -1 : 1), false);
      this.update();
    } else if (key == " " && e.shiftKey) {
      e.preventDefault();
      model.selectRows(fr, fr);
      model.didUpdate();
    } else if (key == " " && ctrl) {
      e.preventDefault();
      model.sel = {ar: 0, ac: fc, fr: lastRow, fc};
      model.didUpdate();
    } else if (key == "Enter" || key == "F2") {
      e.preventDefault();
      model.beginEdit();
      this.update(); // The cell must be rendered (scrolled into view) to show its editor
    } else if (key == "Delete" || key == "Backspace") {
      e.preventDefault();
      model.clearSelection();
      model.didUpdate();
    } else if (key == "Escape") {
      model.select(fr, fc, false);
      model.didUpdate();
    } else if (key.length == 1 && !ctrl && !e.altKey) {
      e.preventDefault();
      model.beginEdit(key);
      this.update();
    }
  }

  onEditorKeyDown(e) {
    let {model} = this.props;
    let {fr, fc} = model.sel;
    e.stopPropagation();
    if (e.key == "Enter") {
      e.preventDefault();
      let fill = e.ctrlKey || e.metaKey;
      model.commitEdit(fill);
      if (!fill) model.select(fr + (e.shiftKey ? -1 : 1), fc, false);
      this.update();
    } else if (e.key == "Tab") {
      e.preventDefault();
      model.commitEdit();
      model.select(fr, fc + (e.shiftKey ? -1 : 1), false);
      this.update();
    } else if (e.key == "Escape") {
      e.preventDefault();
      model.cancelEdit();
      model.didUpdate();
    }
  }

  onResizeStart(e, col) {
    e.preventDefault();
    e.stopPropagation();
    let {model} = this.props;
    let startX = e.clientX;
    let startWidth = col.width;
    let onMove = ev => {
      col.width = Math.max(40, startWidth + ev.clientX - startX);
      model.didUpdate();
    };
    let onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  renderCell(row, r, c) {
    let {model} = this.props;
    let col = model.columns[c];
    let active = model.sel && model.sel.fr == r && model.sel.fc == c;
    let editingHere = active && model.editing;
    let locked = model.isCellLocked(row, c);
    let warning = editingHere ? "" : model.cellWarning(row, c);
    let className = (locked ? "de-locked " : "")
      + (warning ? "de-warning " : "")
      + (model.isCellDirty(row, c) ? "de-dirty " : "")
      + (model.isSelected(r, c) ? "de-selected " : "")
      + (active ? "de-active " : "")
      + (editingHere && model.editing.source == "cell" ? "de-editing" : "");
    if (editingHere && model.editing.source == "cell") {
      return h("td", {key: c, "data-r": r, "data-c": c, className},
        h("input", {
          ref: el => {
            if (el && document.activeElement != el) {
              el.focus();
              el.setSelectionRange(el.value.length, el.value.length);
            }
          },
          value: model.editing.value,
          onChange: e => { model.editing.value = e.target.value; model.didUpdate(); },
          onKeyDown: e => this.onEditorKeyDown(e),
          onBlur: () => { if (model.editing) { model.commitEdit(); model.didUpdate(); } }
        })
      );
    }
    let value = editingHere ? model.editing.value : row.cells[c];
    let title = warning || (locked && col.reason) || (value.length > 30 ? value : null);
    return h("td", {key: c, "data-r": r, "data-c": c, className, title},
      warning ? h("svg", {className: "de-warning-icon", "aria-label": warning}, h("use", {xlinkHref: "symbols.svg#warning"})) : null,
      value
    );
  }

  renderHeader(c) {
    let {model} = this.props;
    let col = model.columns[c];
    return h("th", {
      key: c,
      className: col.locked ? "de-locked" : null,
      title: col.name + (col.field ? " (" + col.field.type + ")" : "") + (col.reason ? "\n" + col.reason : "") + "\nClick to sort",
      onClick: () => { model.toggleSort(c); model.didUpdate(); }
    },
    h("div", {className: "de-th-inner"},
      col.name,
      model.sort?.col == c ? h("span", {className: "de-sort"}, model.sort.dir == 1 ? "▲" : "▼") : null
    ),
    h("div", {className: "de-resizer", onMouseDown: e => this.onResizeStart(e, col), onClick: e => e.stopPropagation()})
    );
  }

  visibleColumns() {
    let {model} = this.props;
    let {scrollLeft, viewportWidth} = this.state;
    let lefts = [0];
    for (let col of model.columns) lefts.push(lefts[lefts.length - 1] + col.width);
    let first = 0;
    while (first < model.columns.length - 1 && lefts[first + 1] < scrollLeft) first++;
    let last = first;
    while (last < model.columns.length && lefts[last] < scrollLeft + viewportWidth) last++;
    first = Math.max(0, first - COLUMN_OVERSCAN);
    last = Math.min(model.columns.length, last + COLUMN_OVERSCAN);
    let indexes = [];
    for (let c = first; c < last; c++) indexes.push(c);
    return {indexes, before: lefts[first], after: lefts[model.columns.length] - lefts[last], total: lefts[model.columns.length]};
  }

  render() {
    let {model} = this.props;
    let {scrollTop, viewportHeight} = this.state;
    let first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    let last = Math.min(model.view.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
    let cols = this.visibleColumns();
    let totalWidth = ROW_NUMBER_WIDTH + cols.total;
    let gap = (tag, width) => (width > 0 ? h(tag, {className: "de-gap", "aria-hidden": "true"}) : null);
    let spacer = height => h("tr", {"aria-hidden": "true"}, h("td", {colSpan: 1 + (cols.before > 0) + cols.indexes.length + (cols.after > 0), style: {height, padding: 0, border: 0}}));
    let rows = [];
    for (let r = first; r < last; r++) {
      let row = model.view[r];
      rows.push(h("tr", {key: r, className: row.orig ? null : "de-new"},
        h("td", {className: "de-rownum", "data-r": r, "data-c": -1}, r + 1),
        gap("td", cols.before),
        cols.indexes.map(c => this.renderCell(row, r, c)),
        gap("td", cols.after)
      ));
    }
    return h("div", {
      className: "de-grid",
      ref: el => { this.scroller = el; },
      tabIndex: 0,
      role: "grid",
      "aria-rowcount": model.view.length,
      "aria-colcount": model.columns.length,
      onScroll: this.onScroll,
      onKeyDown: this.onKeyDown
    },
    h("table", {style: {width: totalWidth}},
      h("colgroup", null,
        h("col", {style: {width: ROW_NUMBER_WIDTH}}),
        cols.before > 0 ? h("col", {style: {width: cols.before}}) : null,
        cols.indexes.map(c => h("col", {key: c, style: {width: model.columns[c].width}})),
        cols.after > 0 ? h("col", {style: {width: cols.after}}) : null
      ),
      h("thead", null,
        h("tr", null,
          h("th", {className: "de-rownum"}, "#"),
          gap("th", cols.before),
          cols.indexes.map(c => this.renderHeader(c)),
          gap("th", cols.after)
        )
      ),
      h("tbody", {onMouseDown: this.onMouseDown, onMouseOver: this.onMouseOver, onDoubleClick: this.onDoubleClick},
        first > 0 ? spacer(first * ROW_HEIGHT) : null,
        rows,
        last < model.view.length ? spacer((model.view.length - last) * ROW_HEIGHT) : null
      )
    )
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.grid = null;
    this.state = {replace: null}; // {find, replacement, message} while the Find & Replace bar is open
    this.onCopy = this.onCopy.bind(this);
    this.onPaste = this.onPaste.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onBeforeUnload = this.onBeforeUnload.bind(this);
  }

  componentDidMount() {
    document.addEventListener("copy", this.onCopy);
    document.addEventListener("cut", this.onCopy);
    document.addEventListener("paste", this.onPaste);
    document.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("beforeunload", this.onBeforeUnload);
  }

  componentWillUnmount() {
    document.removeEventListener("copy", this.onCopy);
    document.removeEventListener("cut", this.onCopy);
    document.removeEventListener("paste", this.onPaste);
    document.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
  }

  onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == "h" && this.props.model.hasData) {
      e.preventDefault();
      this.toggleReplace(true);
    }
  }

  toggleReplace(open) {
    this.setState({replace: open ? (this.state.replace || {find: "", replacement: "", message: ""}) : null}, () => {
      if (open) this.findInput?.focus(); else this.grid?.scroller.focus();
    });
  }

  updateReplace(changes) {
    this.setState({replace: {...this.state.replace, message: "", ...changes}});
  }

  replaceAll() {
    let {model} = this.props;
    let {find, replacement} = this.state.replace;
    let count = model.replaceAll(find, replacement);
    this.updateReplace({message: count == 0 ? "No match" : "Replaced in " + count.toLocaleString() + (count == 1 ? " cell" : " cells")});
    model.didUpdate();
  }

  addColumn() {
    let name = window.prompt("Name of the column to add (the field API name, so Data Import can map it):");
    if (name != null) this.act(() => this.props.model.addColumn(name));
  }

  gridFocused() {
    return this.grid && document.activeElement == this.grid.scroller;
  }

  onCopy(e) {
    let {model} = this.props;
    if (!this.gridFocused() || !model.sel || model.editing) return;
    e.clipboardData.setData("text/plain", model.selectionAsTsv());
    e.preventDefault();
    if (e.type == "cut") {
      model.clearSelection();
      model.didUpdate();
    }
  }

  onPaste(e) {
    let {model} = this.props;
    let inInput = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (inInput || (model.hasData && !this.gridFocused())) return;
    e.preventDefault();
    model.paste(e.clipboardData.getData("text/plain"));
    model.didUpdate();
  }

  onBeforeUnload(e) {
    if (this.props.model.hasUnsentChanges()) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  iconButton(icon, title, onClick, disabled) {
    return h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled", title, "aria-label": title, onClick, disabled},
      h("svg", {className: "slds-button__icon"}, h("use", {xlinkHref: "symbols.svg#" + icon}))
    );
  }

  textButton(icon, label, title, onClick, disabled, className = "slds-button_neutral") {
    return h("button", {className: "slds-button " + className, title, onClick, disabled},
      h("svg", {className: "slds-button__icon slds-button__icon_left"}, h("use", {xlinkHref: "symbols.svg#" + icon})),
      label
    );
  }

  act(fn) {
    let {model} = this.props;
    fn();
    if (this.grid) {
      this.grid.scroller.focus({preventScroll: true});
      this.grid.update();
    } else {
      model.didUpdate();
    }
  }

  renderToolbar() {
    let {model} = this.props;
    let {changedRows, newRows, warnings} = model.stats();
    let sendCount = model.rowsToSend().length;
    let filtered = model.view.length != model.rows.length;
    return h("div", {className: "de-toolbar"},
      h("div", {className: "slds-button-group", role: "group"},
        this.iconButton("undo", "Undo (Ctrl+Z)", () => this.act(() => model.undo()), model.undoStack.length == 0),
        this.iconButton("redo", "Redo (Ctrl+Y)", () => this.act(() => model.redo()), model.redoStack.length == 0)
      ),
      h("div", {className: "slds-button-group", role: "group"},
        this.textButton("add", "Row", "Add an empty row below the selection", () => this.act(() => model.addRow()), false),
        this.textButton("add", "Column", "Add a column at the end, to set a field that was not queried", () => this.addColumn(), false),
        this.textButton("delete", "Delete rows", "Remove the selected rows from this table (nothing is deleted in Salesforce)", () => this.act(() => model.deleteSelectedRows()), !model.sel),
        this.textButton("delete", "Delete columns", "Remove the selected columns from this table (nothing is deleted in Salesforce). The _ and Id columns are kept.", () => this.act(() => model.deleteSelectedColumns()), !model.sel)
      ),
      this.textButton("replace", "Replace", "Find and replace (Ctrl+H), in the selected cells or in all the rows shown", () => this.toggleReplace(!this.state.replace), false),
      h("div", {className: "slds-form-element de-filter"},
        h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left"},
          h("svg", {className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default"}, h("use", {xlinkHref: "symbols.svg#search"})),
          h("input", {
            type: "search",
            className: "slds-input",
            placeholder: "Filter rows",
            "aria-label": "Filter rows",
            value: model.filter,
            onChange: e => { model.setFilter(e.target.value); model.didUpdate(); }
          })
        )
      ),
      h("span", {className: "de-stats"},
        model.view.length.toLocaleString() + (filtered ? " of " + model.rows.length.toLocaleString() : "") + " rows",
        changedRows + newRows > 0 ? h("strong", null, " · " + (changedRows ? changedRows + " edited" : "") + (changedRows && newRows ? ", " : "") + (newRows ? newRows + " new" : "")) : null,
        warnings > 0 ? h("strong", {className: "de-stats-warning", title: "Edited values that do not match the field type. Point at the warning icons for details."}, " · " + warnings + (warnings == 1 ? " warning" : " warnings")) : null
      ),
      h("div", {className: "de-spacer"}),
      h("div", {className: "slds-button-group", role: "group"},
        this.textButton("copy", "Copy", "Copy the table to the clipboard (paste into Excel)", () => model.copyAll(), false),
        this.iconButton("download", "Download as CSV", () => model.downloadCsv(), false)
      ),
      h("div", {className: "slds-checkbox"},
        h("input", {type: "checkbox", id: "changes-only", checked: model.changesOnly, onChange: e => { model.changesOnly = e.target.checked; model.didUpdate(); }}),
        h("label", {className: "slds-checkbox__label", htmlFor: "changes-only", title: "Send only the edited and new rows, with the Id and the edited columns"},
          h("span", {className: "slds-checkbox_faux"}),
          h("span", {className: "slds-form-element__label"}, "Changes only")
        )
      ),
      this.textButton("upload", "Send " + sendCount.toLocaleString() + (sendCount == 1 ? " row" : " rows") + " to Data Import", model.readOnlyReason || "Open Data Import preloaded with these rows. You review and run the import there.", () => model.sendToImport(), sendCount == 0 || !!model.readOnlyReason, "slds-button_brand")
    );
  }

  renderReplaceBar() {
    let {replace} = this.state;
    if (!replace) return null;
    let onKeyDown = e => {
      if (e.key == "Enter") this.replaceAll();
      if (e.key == "Escape") this.toggleReplace(false);
    };
    return h("div", {className: "de-valuebar de-replacebar"},
      h("input", {
        className: "slds-input",
        ref: el => { this.findInput = el; },
        placeholder: "Find",
        "aria-label": "Find",
        value: replace.find,
        onChange: e => this.updateReplace({find: e.target.value}),
        onKeyDown
      }),
      h("input", {
        className: "slds-input",
        placeholder: "Replace with",
        "aria-label": "Replace with",
        value: replace.replacement,
        onChange: e => this.updateReplace({replacement: e.target.value}),
        onKeyDown
      }),
      h("button", {className: "slds-button slds-button_neutral", disabled: !replace.find, onClick: () => this.replaceAll()}, "Replace all"),
      h("span", {className: "de-stats", role: "status"}, replace.message),
      h("div", {className: "de-spacer"}),
      this.iconButton("close", "Close (Escape)", () => this.toggleReplace(false), false)
    );
  }

  renderValueBar() {
    let {model} = this.props;
    if (!model.sel) return null;
    let col = model.columns[model.sel.fc];
    let fromBar = model.editing?.source == "bar";
    let row = model.view[model.sel.fr];
    let locked = model.isCellLocked(row, model.sel.fc);
    let warning = model.editing ? "" : model.cellWarning(row, model.sel.fc);
    let note = warning || (locked ? col.reason : "") || (col.field ? col.field.type : "");
    return h("div", {className: "de-valuebar"},
      h("span", {className: "de-cellref", title: col.name}, col.name + " · row " + (model.sel.fr + 1)),
      h("input", {
        className: "slds-input",
        "aria-label": "Cell value",
        readOnly: locked,
        value: model.editing ? model.editing.value : model.activeValue(),
        onFocus: () => { model.beginEdit(null, "bar"); model.didUpdate(); },
        onChange: e => {
          if (!model.editing) model.beginEdit(null, "bar");
          if (model.editing) model.editing.value = e.target.value;
          model.didUpdate();
        },
        onKeyDown: e => {
          if (e.key == "Enter") { model.commitEdit(e.ctrlKey || e.metaKey); this.grid?.scroller.focus(); this.act(() => {}); }
          if (e.key == "Escape") { model.cancelEdit(); this.grid?.scroller.focus(); model.didUpdate(); }
        },
        onBlur: () => { if (fromBar && model.editing) { model.commitEdit(); model.didUpdate(); } }
      }),
      note ? h("span", {className: "de-cellnote" + (warning ? " de-cellnote-warning" : ""), title: note}, note) : null
    );
  }

  render() {
    let {model} = this.props;
    return h("div", {},
      h(PageHeader, {
        pageTitle: "Data Editor",
        subTitle: model.sobject || null,
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        ...model.userInfoModel.getProps()
      }),
      h("div", {className: "slds-m-top_xx-large sfir-page-container"},
        h("div", {className: "slds-card slds-m-around_medium", style: {flex: "1 1 0", display: "flex", flexDirection: "column", minHeight: 0}},
          model.errorMessage ? h("div", {className: "slds-notify slds-notify_alert slds-alert_error", role: "alert"}, model.errorMessage) : null,
          model.hasData ? this.renderToolbar() : null,
          model.hasData ? this.renderReplaceBar() : null,
          model.hasData ? this.renderValueBar() : null,
          model.hasData
            ? h(Grid, {model, ref: grid => { this.grid = grid; }})
            : h("div", {className: "de-empty", tabIndex: 0},
              h("svg", {className: "slds-icon slds-icon_large slds-icon-text-default"}, h("use", {xlinkHref: "symbols.svg#table"})),
              h("p", {className: "slds-text-heading_small"}, model.spinnerCount > 0 ? "Loading…" : "Paste data here (Ctrl+V)"),
              h("p", null, "Copy cells from Excel or Google Sheets, or open a query result from Data Export with the Edit button. The first line is used as the header.")
            ),
          model.hasData
            ? h("div", {className: "de-footer"},
              h("kbd", null, "Double-click"), " or type to edit · ",
              h("kbd", null, "Enter"), " save & move down · ",
              h("kbd", null, "Ctrl+Enter"), " fill selection · ",
              h("kbd", null, "Ctrl+C"), "/", h("kbd", null, "Ctrl+V"), " copy & paste · ",
              h("kbd", null, "Ctrl+Z"), " undo · ",
              h("kbd", null, "Ctrl+H"), " replace · click a header to sort, drag its edge to resize"
            )
            : null
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
    let model = new Model(sfHost);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);
    if (args.has("handoff")) {
      model.spinFor(loadHandoff(args.get("handoff")).then(payload => {
        if (!payload) {
          model.errorMessage = "The data is no longer available. Open it again from Data Export.";
          return;
        }
        model.setTable(payload.header, payload.rows, {apiType: payload.apiType, changesOnly: true, query: payload.query});
      }).catch(err => {
        model.errorMessage = "Could not load the data: " + err.message;
      }));
    }
  });
}
