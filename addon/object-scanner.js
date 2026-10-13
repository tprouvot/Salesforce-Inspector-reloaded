/* global React ReactDOM */
/* eslint-disable react/prop-types, react/no-deprecated */
import {sfConn, apiVersion} from "./inspector.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, createSpinForMethod, applyProductionStyling, copyToClipboard} from "./utils.js";
import AlertBanner from "./components/AlertBanner.js";
import Toast from "./components/Toast.js";
import ConfirmModal from "./components/ConfirmModal.js";
import Tooltip from "./components/Tooltip.js";
import {
  getObjectScannerRules,
  needsFieldDefinitionQuery,
  evaluateDescribeRules,
  evaluateFieldDefinitionRules,
  slimDescribe,
  isCustomEntityName,
  stripApiSuffix
} from "./object-scanner-rules.js";
/* global initButton */

const h = React.createElement;
const DESCRIBE_BATCH_SIZE = 5;
const FIELD_DEF_BATCH_SIZE = 5;
const FIELD_DEF_TOGGLE_KEY = "objectScannerIncludeFieldDefinitions";
const DATA_MODEL_COLUMNS_KEY = "objectScannerFieldsToDisplay";
const DATA_MODEL_COLUMNS = [
  {id: "object", label: "Object", required: true},
  {id: "field", label: "Field", required: true},
  {id: "label", label: "Label"},
  {id: "type", label: "Type"},
  {id: "required", label: "Required"},
  {id: "length", label: "Length"},
  {id: "formula", label: "Formula"},
  {id: "autoNumber", label: "Auto Number"},
  {id: "unique", label: "Unique"},
  {id: "externalId", label: "External ID"},
  {id: "encrypted", label: "Encrypted"},
  {id: "helpText", label: "Help Text"},
  {id: "lookupTo", label: "Lookup To"},
  {id: "description", label: "Description", fieldDefinition: true},
  {id: "classification", label: "Classification", fieldDefinition: true},
  {id: "compliance", label: "Compliance", fieldDefinition: true},
  {id: "businessStatus", label: "Business Status", fieldDefinition: true}
];
const DEFAULT_DATA_MODEL_COLUMNS = DATA_MODEL_COLUMNS.filter(col => !col.fieldDefinition).map(col => col.id);
const LOOKUP_PREVIEW_COUNT = 3;
const SESSION_MAX_BYTES = 4 * 1024 * 1024;
const FILTERS = [
  {id: "all", label: "All"},
  {id: "custom", label: "Custom"},
  {id: "standard", label: "Standard"}
];

function trySetSession(key, value) {
  try {
    const json = JSON.stringify(value);
    if (json.length > SESSION_MAX_BYTES) {
      return false;
    }
    sessionStorage.setItem(key, json);
    return true;
  } catch {
    return false;
  }
}

function tryGetSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function csvEscape(value, separator) {
  const text = value == null ? "" : String(value);
  if (text.includes("\"") || text.includes(separator) || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function textMatches(value, term) {
  if (!term) {
    return true;
  }
  return String(value || "").toLowerCase().includes(term);
}

function parseModelSearch(raw) {
  const query = String(raw || "").trim();
  if (!query) {
    return {objectTerm: "", fieldTerm: "", dotted: false};
  }
  const dot = query.indexOf(".");
  if (dot === -1) {
    const term = query.toLowerCase();
    return {objectTerm: term, fieldTerm: term, dotted: false};
  }
  return {
    objectTerm: query.slice(0, dot).trim().toLowerCase(),
    fieldTerm: query.slice(dot + 1).trim().toLowerCase(),
    dotted: true
  };
}

function objectNameMatches(objectModel, term) {
  if (!term) {
    return true;
  }
  const name = (objectModel.name || "").toLowerCase();
  const label = (objectModel.label || "").toLowerCase();
  return name.includes(term) || label.includes(term);
}

function objectPathMatches(objectModel, term) {
  if (!term) {
    return true;
  }
  const values = [
    objectModel.name,
    objectModel.label,
    stripApiSuffix(objectModel.name)
  ].map(value => String(value || "").toLowerCase());
  return values.some(value => {
    if (value === term) {
      return true;
    }
    if (!value.startsWith(term)) {
      return false;
    }
    const rest = value.slice(term.length);
    return rest === "" || rest.startsWith("__");
  });
}

function fieldLookupTargets(field) {
  return field && Array.isArray(field.referenceTo) ? field.referenceTo : [];
}

function renderLookupToCell(model, row) {
  const refs = fieldLookupTargets(row.field);
  if (!refs.length) {
    return "";
  }
  const full = refs.join(", ");
  if (refs.length <= LOOKUP_PREVIEW_COUNT) {
    return full;
  }
  const expanded = model.expandedLookupRows.has(row.id);
  const text = (expanded ? refs : refs.slice(0, LOOKUP_PREVIEW_COUNT)).join(", ");
  return h("span", {title: full},
    text,
    " ",
    h("button", {
      type: "button",
      className: "slds-button slds-button_reset slds-text-link",
      title: expanded ? "Show fewer lookup targets" : "Show all " + refs.length + " lookup targets",
      "aria-expanded": expanded,
      onClick: e => {
        e.preventDefault();
        model.toggleLookupExpand(row.id);
      }
    }, "...")
  );
}

function isQuietObjectError(message) {
  return /NOT_FOUND|INVALID_TYPE|\b404\b/.test(String(message || ""));
}

function compositeBodyError(body) {
  if (!body) {
    return "";
  }
  if (Array.isArray(body) && body[0]) {
    return `${body[0].errorCode || ""}: ${body[0].message || ""}`;
  }
  return `${body.errorCode || ""}: ${body.message || ""}`;
}

function isQuietCompositeResponse(response) {
  if (!response) {
    return false;
  }
  if (response.httpStatusCode === 404) {
    return true;
  }
  return isQuietObjectError(compositeBodyError(response.body));
}

function fieldMatches(field, term, def) {
  if (!term) {
    return true;
  }
  if (!field) {
    return false;
  }
  if (textMatches(field.name, term) || textMatches(field.label, term) || textMatches(field.inlineHelpText, term)) {
    return true;
  }
  if ((field.referenceTo || []).some(name => textMatches(name, term))) {
    return true;
  }
  if (!def) {
    return false;
  }
  return textMatches(def.Description, term)
    || textMatches(def.SecurityClassification, term)
    || textMatches(def.ComplianceGroup, term)
    || textMatches(def.BusinessStatus, term);
}

function fieldLengthDisplay(field) {
  if (!field) {
    return "";
  }
  if (field.precision || field.scale) {
    return `${(field.precision || 0) - (field.scale || 0)}, ${field.scale || 0}`;
  }
  if (field.length) {
    return String(field.length);
  }
  return "";
}

function yesFlag(value) {
  return value ? "Yes" : "";
}

function loadVisibleColumnIds() {
  try {
    const saved = localStorage.getItem(DATA_MODEL_COLUMNS_KEY);
    if (!saved) {
      return {ids: DEFAULT_DATA_MODEL_COLUMNS.slice(), saved: false};
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return {ids: DEFAULT_DATA_MODEL_COLUMNS.slice(), saved: false};
    }
    const known = new Set(DATA_MODEL_COLUMNS.map(col => col.id));
    const requiredIds = DATA_MODEL_COLUMNS.filter(col => col.required).map(col => col.id);
    const rest = parsed.filter(id => known.has(id) && !requiredIds.includes(id));
    return {ids: requiredIds.concat(rest), saved: true};
  } catch {
    return {ids: DEFAULT_DATA_MODEL_COLUMNS.slice(), saved: false};
  }
}

class Model {
  constructor(sfHost) {
    this.reactCallback = null;
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";
    this.spinnerCount = 0;
    this.toasts = [];
    this.toastSeq = 0;
    this.cacheToastShown = false;
    this.showHelp = false;
    this.confirmClear = false;
    this.isProd = applyProductionStyling(sfHost);
    this.spinFor = createSpinForMethod(this);
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    this.rules = getObjectScannerRules();
    this.candidates = [];
    this.selectedNames = new Set();
    this.objectFilter = "all";
    this.objectSearch = "";
    this.pickerCollapsed = false;
    this.orgNamespace = tryGetSession(`${sfHost}_objectScanner_orgNamespace`, "");
    this.scanGeneration = 0;
    this.scanning = false;
    this.scanProgress = {done: 0, total: 0, phase: ""};
    this.objectModels = [];
    this.fieldDefinitions = {};
    this.fieldDefinitionQueried = false;
    this.includeFieldDefinitions = localStorage.getItem(FIELD_DEF_TOGGLE_KEY) === "true";
    const columnPrefs = loadVisibleColumnIds();
    this.visibleColumns = columnPrefs.ids;
    this.columnPrefsSaved = columnPrefs.saved;
    this.columnPickerOpen = false;
    this.findings = tryGetSession(`${sfHost}_objectScanner_findings`, []) || [];
    this.analyzed = !!(this.findings && this.findings.length);
    this.severityFilter = "all";
    this.modelSearch = "";
    this.resultsTab = this.analyzed ? "findings" : "data-model";
    this.expandedLookupRows = new Set();
    this.apiCallCount = 0;
    this.apiCallByCategory = {};
    this.scanApiCallStart = 0;
    this.scanStartedAt = 0;
    this.scanDurationMs = 0;

    const savedSelection = tryGetSession(`${sfHost}_objectScanner_selection`, null);
    this.savedSelection = Array.isArray(savedSelection) ? savedSelection : null;
  }

  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
    if (this.testCallback) {
      this.testCallback();
    }
  }

  showToast(variant, title, message) {
    this.toastSeq += 1;
    const id = this.toastSeq;
    this.toasts = this.toasts.concat({id, variant, title, message});
    this.didUpdate();
    if (variant === "success") {
      setTimeout(() => this.dismissToast(id), 3000);
    }
  }

  dismissToast(id) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.didUpdate();
  }

  persistSelection() {
    const stored = trySetSession(`${this.sfHost}_objectScanner_selection`, Array.from(this.selectedNames));
    if (!stored && !this.cacheToastShown) {
      this.cacheToastShown = true;
      this.showToast("warning", "Cache", "Session cache is full; object selection was not saved.");
    }
  }

  persistFindings() {
    const stored = trySetSession(`${this.sfHost}_objectScanner_findings`, this.findings);
    if (!stored && this.findings.length && !this.cacheToastShown) {
      this.cacheToastShown = true;
      this.showToast("warning", "Cache", "Session cache is full; findings were kept in memory only.");
    }
  }

  filteredCandidates() {
    const search = this.objectSearch.trim().toLowerCase();
    return this.candidates.filter(entity => {
      if (this.objectFilter === "custom" && !entity.custom) {
        return false;
      }
      if (this.objectFilter === "standard" && entity.custom) {
        return false;
      }
      if (!search) {
        return true;
      }
      return entity.name.toLowerCase().includes(search) || (entity.label || "").toLowerCase().includes(search);
    });
  }

  async rest(url, options, category) {
    this.apiCallCount += 1;
    if (category) {
      this.apiCallByCategory[category] = (this.apiCallByCategory[category] || 0) + 1;
    }
    return sfConn.rest(url, options || {});
  }

  formatDuration(ms) {
    if (ms < 10000) {
      return ms.toFixed(1) + "ms";
    }
    return (ms / 1000).toFixed(1) + "s";
  }

  apiCallTitle() {
    const labels = {
      namespace: "org namespace",
      list: "object list",
      describe: "describe",
      fieldDefinition: "field definition"
    };
    const parts = Object.keys(labels)
      .filter(key => this.apiCallByCategory[key])
      .map(key => `${this.apiCallByCategory[key]} ${labels[key]}`);
    const breakdown = parts.length ? " " + parts.join(", ") + "." : "";
    const lastScan = this.scanStartedAt ? this.apiCallCount - this.scanApiCallStart : 0;
    const lastScanText = lastScan ? ` Last scan: ${lastScan}.` : "";
    return `Salesforce REST calls toward org API limits.${breakdown}${lastScanText} Composite batches count as one call.`;
  }

  tickScanDuration() {
    if (this.scanStartedAt) {
      this.scanDurationMs = performance.now() - this.scanStartedAt;
    }
  }

  inspectHref(objectName) {
    const args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("objectType", objectName);
    return "inspect.html?" + args;
  }

  optionsHref() {
    return `options.html?host=${encodeURIComponent(this.sfHost)}&selectedTab=object-scanner`;
  }

  summary() {
    const counts = {error: 0, warning: 0, info: 0};
    this.findings.forEach(item => {
      counts[item.severity] = (counts[item.severity] || 0) + 1;
    });
    return {
      objects: this.objectModels.length,
      fields: this.objectModels.reduce((sum, objectModel) => sum + (objectModel.fields || []).length, 0),
      selected: this.selectedNames.size,
      total: this.findings.length,
      ...counts
    };
  }

  setModelSearch(value) {
    this.modelSearch = value;
    this.didUpdate();
  }

  toggleLookupExpand(rowId) {
    if (this.expandedLookupRows.has(rowId)) {
      this.expandedLookupRows.delete(rowId);
    } else {
      this.expandedLookupRows.add(rowId);
    }
    this.didUpdate();
  }

  setResultsTab(tab) {
    this.resultsTab = tab;
    if (tab !== "data-model") {
      this.columnPickerOpen = false;
    }
    this.didUpdate();
  }

  toggleColumnPicker() {
    this.columnPickerOpen = !this.columnPickerOpen;
    this.didUpdate();
  }

  saveVisibleColumns() {
    localStorage.setItem(DATA_MODEL_COLUMNS_KEY, JSON.stringify(this.visibleColumns));
    this.columnPrefsSaved = true;
  }

  visibleDataModelColumns() {
    const selected = new Set(this.visibleColumns);
    return DATA_MODEL_COLUMNS.filter(col => {
      if (col.required) {
        return true;
      }
      if (col.fieldDefinition && !this.columnPrefsSaved) {
        return this.fieldDefinitionQueried;
      }
      return selected.has(col.id);
    });
  }

  isColumnChecked(columnId) {
    const column = DATA_MODEL_COLUMNS.find(col => col.id === columnId);
    if (!column) {
      return false;
    }
    if (column.required) {
      return true;
    }
    if (column.fieldDefinition && !this.columnPrefsSaved) {
      return this.fieldDefinitionQueried;
    }
    return this.visibleColumns.includes(columnId);
  }

  setColumnVisible(columnId, show) {
    const column = DATA_MODEL_COLUMNS.find(col => col.id === columnId);
    if (!column || column.required) {
      return;
    }
    const selected = new Set(this.visibleColumns);
    if (!this.columnPrefsSaved) {
      this.visibleDataModelColumns().forEach(col => selected.add(col.id));
    }
    if (show) {
      selected.add(columnId);
    } else {
      selected.delete(columnId);
    }
    this.visibleColumns = DATA_MODEL_COLUMNS.map(col => col.id).filter(id => selected.has(id));
    this.saveVisibleColumns();
    this.didUpdate();
  }

  dataModelColumnValue(columnId, row) {
    const field = row.field;
    const def = this.fieldDefinitionFor(row.objectModel.name, field && field.name);
    switch (columnId) {
      case "object":
        return row.objectModel.name;
      case "field":
        return field ? field.name : "";
      case "label":
        return field ? field.label : row.objectModel.label;
      case "type":
        return field ? field.type : "";
      case "required":
        return yesFlag(field && field.nillable === false);
      case "length":
        return fieldLengthDisplay(field);
      case "formula":
        return yesFlag(field && field.calculated);
      case "autoNumber":
        return yesFlag(field && field.autoNumber);
      case "unique":
        return yesFlag(field && field.unique);
      case "externalId":
        return yesFlag(field && field.externalId);
      case "encrypted":
        return yesFlag(field && field.encrypted);
      case "helpText":
        return (field && field.inlineHelpText) || "";
      case "lookupTo":
        return fieldLookupTargets(field).join(", ");
      case "description":
        return (def && def.Description) || "";
      case "classification":
        return (def && def.SecurityClassification) || "";
      case "compliance":
        return (def && def.ComplianceGroup) || "";
      case "businessStatus":
        return (def && def.BusinessStatus) || "";
      default:
        return "";
    }
  }

  filteredObjectModels() {
    const {objectTerm, fieldTerm, dotted} = parseModelSearch(this.modelSearch);
    return this.objectModels.map(objectModel => {
      const fields = objectModel.fields || [];
      if (!objectTerm && !fieldTerm) {
        return objectModel;
      }
      if (dotted) {
        if (!objectPathMatches(objectModel, objectTerm)) {
          return null;
        }
        const matchedFields = fieldTerm ? fields.filter(field => fieldMatches(field, fieldTerm, this.fieldDefinitionFor(objectModel.name, field.name))) : fields;
        if (fieldTerm && !matchedFields.length) {
          return null;
        }
        return {...objectModel, fields: matchedFields};
      }
      if (objectNameMatches(objectModel, objectTerm)) {
        return objectModel;
      }
      const matchedFields = fields.filter(field => fieldMatches(field, fieldTerm, this.fieldDefinitionFor(objectModel.name, field.name)));
      if (!matchedFields.length) {
        return null;
      }
      return {...objectModel, fields: matchedFields};
    }).filter(Boolean);
  }

  filteredModelRows() {
    const rows = [];
    this.filteredObjectModels().forEach(objectModel => {
      const fields = objectModel.fields || [];
      if (!fields.length) {
        rows.push({id: objectModel.name, objectModel, field: null});
        return;
      }
      fields.forEach(field => {
        rows.push({
          id: objectModel.name + "." + field.name,
          objectModel,
          field
        });
      });
    });
    return rows;
  }

  fieldDefinitionFor(objectName, fieldName) {
    if (!objectName || !fieldName || !this.fieldDefinitions[objectName]) {
      return null;
    }
    return this.fieldDefinitions[objectName][fieldName] || null;
  }

  visibleFindings() {
    let items = this.severityFilter === "all"
      ? this.findings
      : this.findings.filter(item => item.severity === this.severityFilter);
    const {objectTerm, fieldTerm, dotted} = parseModelSearch(this.modelSearch);
    if (!objectTerm && !fieldTerm) {
      return items;
    }
    return items.filter(item => {
      const objectLike = {name: item.objectName, label: item.objectLabel};
      const fieldLike = {name: item.fieldName, label: item.fieldLabel};
      if (dotted) {
        if (!objectPathMatches(objectLike, objectTerm)) {
          return false;
        }
        if (!fieldTerm) {
          return true;
        }
        return fieldMatches(fieldLike, fieldTerm, this.fieldDefinitionFor(item.objectName, item.fieldName));
      }
      return objectNameMatches(objectLike, objectTerm) || fieldMatches(fieldLike, fieldTerm, this.fieldDefinitionFor(item.objectName, item.fieldName));
    });
  }

  async loadCandidates() {
    const promise = Promise.all([
      this.fetchCustomizableEntities(),
      this.fetchOrgNamespace()
    ]).then(([entities]) => {
      this.candidates = entities;
      if (this.savedSelection && this.savedSelection.length) {
        const allowed = new Set(entities.map(e => e.name));
        this.selectedNames = new Set(this.savedSelection.filter(name => allowed.has(name)));
      } else {
        this.selectedNames = new Set(entities.map(e => e.name));
      }
      this.persistSelection();
    }).catch(err => {
      this.showToast("error", "Load failed", "Failed to load customizable objects: " + err.message);
    });
    this.spinFor(promise);
    await promise;
    this.didUpdate();
  }

  async fetchOrgNamespace() {
    if (this.orgNamespace) {
      return this.orgNamespace;
    }
    try {
      const res = await this.rest(`/services/data/v${apiVersion}/query/?q=${encodeURIComponent("SELECT NamespacePrefix FROM Organization")}`, undefined, "namespace");
      this.orgNamespace = res.records && res.records[0] ? (res.records[0].NamespacePrefix || "") : "";
      trySetSession(`${this.sfHost}_objectScanner_orgNamespace`, this.orgNamespace);
    } catch {
      this.orgNamespace = "";
    }
    return this.orgNamespace;
  }

  async fetchCustomizableEntities() {
    const records = [];
    let nextUrl = `/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent("SELECT QualifiedApiName, Label, DurableId, IsCustomizable, IsCustomSetting, KeyPrefix, NamespacePrefix FROM EntityDefinition WHERE IsCustomizable = true ORDER BY QualifiedApiName")}`;
    while (nextUrl) {
      const res = await this.rest(nextUrl, undefined, "list");
      (res.records || []).forEach(record => {
        if (record.IsCustomizable === false) {
          return;
        }
        records.push({
          name: record.QualifiedApiName,
          label: record.Label,
          durableId: record.DurableId,
          isCustomSetting: !!record.IsCustomSetting,
          keyPrefix: record.KeyPrefix,
          namespacePrefix: record.NamespacePrefix || "",
          custom: isCustomEntityName(record.QualifiedApiName)
        });
      });
      nextUrl = res.nextRecordsUrl || null;
    }
    return records;
  }

  setIncludeFieldDefinitions(checked) {
    this.includeFieldDefinitions = !!checked;
    localStorage.setItem(FIELD_DEF_TOGGLE_KEY, String(this.includeFieldDefinitions));
    this.didUpdate();
  }

  setFilter(filterId) {
    this.objectFilter = filterId;
    this.didUpdate();
  }

  setSearch(value) {
    this.objectSearch = value;
    this.didUpdate();
  }

  toggleObject(name) {
    if (this.selectedNames.has(name)) {
      this.selectedNames.delete(name);
    } else {
      this.selectedNames.add(name);
    }
    this.persistSelection();
    this.didUpdate();
  }

  selectFiltered(selected) {
    const names = this.filteredCandidates().map(e => e.name);
    names.forEach(name => {
      if (selected) {
        this.selectedNames.add(name);
      } else {
        this.selectedNames.delete(name);
      }
    });
    this.persistSelection();
    this.didUpdate();
  }

  stopScan() {
    this.scanGeneration += 1;
    this.scanning = false;
    this.spinnerCount = Math.max(0, this.spinnerCount - 1);
    this.scanProgress.phase = "Stopped";
    this.tickScanDuration();
    this.didUpdate();
  }

  beginWork(phase, total) {
    this.scanning = true;
    this.spinnerCount++;
    this.scanProgress = {done: 0, total, phase};
    this.scanApiCallStart = this.apiCallCount;
    this.scanStartedAt = performance.now();
    this.scanDurationMs = 0;
    return ++this.scanGeneration;
  }

  finishWork(phase) {
    this.spinnerCount = Math.max(0, this.spinnerCount - 1);
    this.scanning = false;
    this.scanProgress.phase = phase;
    this.tickScanDuration();
  }

  async startScan() {
    if (this.scanning) {
      return;
    }
    const selected = this.candidates.filter(entity => this.selectedNames.has(entity.name));
    if (selected.length === 0) {
      this.showToast("error", "Scan Data Model", "Select at least one object to scan.");
      return;
    }
    this.rules = getObjectScannerRules();
    this.findings = [];
    this.analyzed = false;
    this.objectModels = [];
    this.fieldDefinitions = {};
    this.fieldDefinitionQueried = false;
    this.expandedLookupRows = new Set();
    this.resultsTab = "data-model";
    const generation = this.beginWork("Describing objects", selected.length);
    this.didUpdate();

    const standard = selected.filter(e => !e.custom);
    const custom = selected.filter(e => e.custom);
    await this.describeGroups(standard, generation);
    if (generation !== this.scanGeneration) {
      return;
    }
    await this.describeGroups(custom, generation);
    if (generation !== this.scanGeneration) {
      return;
    }

    if (this.includeFieldDefinitions) {
      this.scanProgress.phase = "Loading field definitions";
      this.didUpdate();
      await this.loadFieldDefinitions(this.objectModels.map(o => o.name), generation);
      if (generation !== this.scanGeneration) {
        return;
      }
      this.fieldDefinitionQueried = true;
    }

    this.finishWork("Data model loaded");
    this.persistFindings();
    this.showToast("success", "Data model loaded", `${this.objectModels.length} object(s) ready. Export the model or click Analyze.`);
    this.didUpdate();
  }

  async startAnalyze() {
    if (this.scanning) {
      return;
    }
    if (!this.objectModels.length) {
      this.showToast("error", "Analyze", "Scan the data model first.");
      return;
    }
    this.rules = getObjectScannerRules();
    this.findings = [];
    this.analyzed = false;
    const generation = this.beginWork("Analyzing", this.objectModels.length);
    this.scanProgress.done = this.objectModels.length;
    this.didUpdate();

    if (needsFieldDefinitionQuery(this.rules) && !this.fieldDefinitionQueried) {
      this.scanProgress.phase = "Loading field definitions";
      this.didUpdate();
      await this.loadFieldDefinitions(this.objectModels.map(o => o.name), generation);
      if (generation !== this.scanGeneration) {
        return;
      }
      this.fieldDefinitionQueried = true;
    }

    this.recomputeAllFindings();
    this.analyzed = true;
    this.resultsTab = "findings";
    this.finishWork("Analysis complete");
    this.persistFindings();
    this.showToast("success", "Analysis complete", `${this.findings.length} finding(s) across ${this.objectModels.length} object(s).`);
    this.didUpdate();
  }

  recomputeDescribeFindings() {
    this.findings = evaluateDescribeRules(this.objectModels, this.rules, this.orgNamespace);
  }

  recomputeAllFindings() {
    this.findings = [
      ...evaluateDescribeRules(this.objectModels, this.rules, this.orgNamespace),
      ...evaluateFieldDefinitionRules(this.objectModels, this.rules, this.orgNamespace, this.fieldDefinitions)
    ];
  }

  async describeGroups(entities, generation) {
    for (let i = 0; i < entities.length; i += DESCRIBE_BATCH_SIZE) {
      if (generation !== this.scanGeneration) {
        return;
      }
      const batch = entities.slice(i, i + DESCRIBE_BATCH_SIZE);
      await this.describeBatch(batch);
      this.scanProgress.done = this.objectModels.length;
      this.tickScanDuration();
      this.didUpdate();
    }
  }

  async describeBatch(entities) {
    const compositeRequest = entities.map((entity, index) => ({
      method: "GET",
      url: `/services/data/v${apiVersion}/sobjects/${encodeURIComponent(entity.name)}/describe/`,
      referenceId: `obj${index}`
    }));
    try {
      const result = await this.rest(`/services/data/v${apiVersion}/composite`, {
        method: "POST",
        body: {allOrNone: false, compositeRequest}
      }, "describe");
      const responses = result.compositeResponse || [];
      for (let index = 0; index < entities.length; index++) {
        const entity = entities[index];
        const response = responses.find(item => item.referenceId === `obj${index}`);
        if (response && response.httpStatusCode === 200 && response.body) {
          this.objectModels.push(slimDescribe({...response.body, custom: entity.custom, namespacePrefix: entity.namespacePrefix}, this.orgNamespace));
        } else if (isQuietCompositeResponse(response)) {
          console.warn(`Object Scanner: skipped describe for ${entity.name}: ${compositeBodyError(response.body) || response.httpStatusCode}`);
        } else {
          await this.describeSingle(entity);
        }
      }
    } catch {
      for (const entity of entities) {
        await this.describeSingle(entity);
      }
    }
  }

  async describeSingle(entity) {
    try {
      const describe = await this.rest(`/services/data/v${apiVersion}/sobjects/${encodeURIComponent(entity.name)}/describe/`, undefined, "describe");
      this.objectModels.push(slimDescribe({...describe, custom: entity.custom, namespacePrefix: entity.namespacePrefix}, this.orgNamespace));
    } catch (err) {
      if (isQuietObjectError(err.message)) {
        console.warn(`Object Scanner: could not describe ${entity.name}: ${err.message}`);
        return;
      }
      this.showToast("error", "Describe failed", `Could not describe ${entity.name}: ${err.message}`);
    }
  }

  async loadFieldDefinitions(objectNames, generation) {
    for (let i = 0; i < objectNames.length; i += FIELD_DEF_BATCH_SIZE) {
      if (generation !== this.scanGeneration) {
        return;
      }
      const batch = objectNames.slice(i, i + FIELD_DEF_BATCH_SIZE);
      await this.fieldDefinitionBatch(batch);
      this.tickScanDuration();
      this.didUpdate();
    }
  }

  fieldDefinitionSoql(objectName) {
    const fields = "QualifiedApiName, EntityDefinition.QualifiedApiName, Description, ComplianceGroup, SecurityClassification, BusinessStatus, NamespacePrefix";
    const escapedObjectName = objectName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `SELECT ${fields} FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${escapedObjectName}'`;
  }

  async fieldDefinitionBatch(objectNames) {
    const compositeRequest = objectNames.map((name, index) => ({
      method: "GET",
      url: `/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(this.fieldDefinitionSoql(name))}`,
      referenceId: `fd${index}`
    }));
    try {
      const result = await this.rest(`/services/data/v${apiVersion}/tooling/composite`, {
        method: "POST",
        body: {allOrNone: false, compositeRequest}
      }, "fieldDefinition");
      const responses = result.compositeResponse || [];
      for (let index = 0; index < objectNames.length; index++) {
        const objectName = objectNames[index];
        const response = responses.find(item => item.referenceId === `fd${index}`);
        if (response && response.httpStatusCode === 200 && response.body) {
          this.ingestFieldDefinitions(objectName, response.body.records || []);
        } else if (isQuietCompositeResponse(response)) {
          console.warn(`Object Scanner: skipped field definitions for ${objectName}: ${compositeBodyError(response.body) || response.httpStatusCode}`);
        } else {
          await this.fieldDefinitionSingle(objectName);
        }
      }
    } catch {
      for (const objectName of objectNames) {
        await this.fieldDefinitionSingle(objectName);
      }
    }
  }

  async fieldDefinitionSingle(objectName) {
    try {
      const res = await this.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(this.fieldDefinitionSoql(objectName))}`, undefined, "fieldDefinition");
      this.ingestFieldDefinitions(objectName, res.records || []);
    } catch (err) {
      if (isQuietObjectError(err.message)) {
        console.warn(`Object Scanner: could not load field definitions for ${objectName}: ${err.message}`);
        return;
      }
      this.showToast("error", "Field definitions", `Could not load field definitions for ${objectName}: ${err.message}`);
    }
  }

  ingestFieldDefinitions(objectName, records) {
    if (!this.fieldDefinitions[objectName]) {
      this.fieldDefinitions[objectName] = {};
    }
    records.forEach(record => {
      const name = record.QualifiedApiName;
      this.fieldDefinitions[objectName][name] = {
        Description: record.Description,
        ComplianceGroup: record.ComplianceGroup,
        SecurityClassification: record.SecurityClassification,
        BusinessStatus: record.BusinessStatus,
        NamespacePrefix: record.NamespacePrefix
      };
    });
  }

  downloadCsv(filename, rows) {
    const blob = new Blob([rows.join("\n")], {type: "text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportFileStamp() {
    return `${this.orgName}-${new Date().toISOString().split("T")[0]}`;
  }

  dataModelRows(separator) {
    const includeClassification = this.fieldDefinitionQueried;
    const headers = ["object", "objectLabel", "custom", "field", "fieldLabel", "type", "customField", "nillable", "required", "length", "precision", "scale", "encrypted", "externalId", "unique", "restrictedPicklist", "calculated", "autoNumber", "helpText", "lookupTo"];
    if (includeClassification) {
      headers.push("description", "securityClassification", "complianceGroup", "businessStatus");
    }
    const rows = [headers.join(separator)];
    this.objectModels.forEach(objectModel => {
      (objectModel.fields || []).forEach(field => {
        const values = [
          objectModel.name,
          objectModel.label,
          objectModel.custom,
          field.name,
          field.label,
          field.type,
          field.custom,
          field.nillable,
          field.nillable === false,
          field.length || "",
          field.precision || "",
          field.scale || "",
          field.encrypted,
          field.externalId,
          field.unique,
          field.restrictedPicklist,
          field.calculated,
          field.autoNumber,
          field.inlineHelpText || "",
          fieldLookupTargets(field).join("; ")
        ];
        if (includeClassification) {
          const def = this.fieldDefinitions[objectModel.name] && this.fieldDefinitions[objectModel.name][field.name];
          values.push(
            (def && def.Description) || "",
            (def && def.SecurityClassification) || "",
            (def && def.ComplianceGroup) || "",
            (def && def.BusinessStatus) || ""
          );
        }
        rows.push(values.map(value => csvEscape(value, separator)).join(separator));
      });
    });
    return rows;
  }

  exportDataModel() {
    if (!this.objectModels.length) {
      return;
    }
    const separator = localStorage.getItem("csvSeparator") || ",";
    this.downloadCsv(`object-scanner-datamodel-${this.exportFileStamp()}.csv`, this.dataModelRows(separator));
    this.showToast("success", "Export complete", "Data model CSV downloaded.");
  }

  copyDataModelExcel() {
    if (!this.objectModels.length) {
      return;
    }
    copyToClipboard(this.dataModelRows("\t").join("\n"));
    this.showToast("success", "Copied", "Data model copied for Excel.");
  }

  exportFindings() {
    if (!this.findings.length) {
      return;
    }
    const separator = localStorage.getItem("csvSeparator") || ",";
    const includeClassification = this.fieldDefinitionQueried;
    const headers = ["severity", "rule", "object", "field", "message"];
    if (includeClassification) {
      headers.push("securityClassification", "complianceGroup", "businessStatus");
    }
    const rows = [headers.join(separator)];
    this.findings.forEach(item => {
      const values = [item.severity, item.ruleLabel || item.rule, item.objectName, item.fieldName, item.message];
      if (includeClassification) {
        values.push(
          (item.extra && item.extra.securityClassification) || "",
          (item.extra && item.extra.complianceGroup) || "",
          (item.extra && item.extra.businessStatus) || ""
        );
      }
      rows.push(values.map(value => csvEscape(value, separator)).join(separator));
    });
    this.downloadCsv(`object-scanner-findings-${this.exportFileStamp()}.csv`, rows);
    this.showToast("success", "Export complete", "Findings CSV downloaded.");
  }
}

class DataModelColumnsBox extends React.Component {
  constructor(props) {
    super(props);
    this.onToggle = this.onToggle.bind(this);
    this.onPopoverClick = this.onPopoverClick.bind(this);
  }
  onToggle(e) {
    e.preventDefault();
    e.stopPropagation();
    this.props.model.toggleColumnPicker();
  }
  onPopoverClick(e) {
    e.stopPropagation();
  }
  render() {
    const {model} = this.props;
    return h("span", {className: "slds-is-relative sfir-object-scanner-columns"},
      h("button", {
        className: "slds-button slds-button_neutral",
        type: "button",
        title: "Choose which field attributes to show",
        "aria-haspopup": "true",
        "aria-expanded": model.columnPickerOpen,
        onClick: this.onToggle
      },
      "Columns",
      h("svg", {className: "slds-button__icon slds-button__icon_right", "aria-hidden": "true"},
        h("use", {xlinkHref: "symbols.svg#chevrondown"})
      )
      ),
      model.columnPickerOpen
        ? h("section", {
          className: "slds-popover slds-nubbin_top-right slds-is-absolute slds-scrollable sfir-object-scanner-columns-popover",
          role: "dialog",
          onClick: this.onPopoverClick
        },
        h("div", {className: "slds-popover__body"},
          h("fieldset", {className: "slds-form-element"},
            h("legend", {className: "slds-form-element__legend slds-form-element__label"}, "Field columns"),
            h("div", {className: "slds-form-element__control"},
              DATA_MODEL_COLUMNS.filter(column => !column.fieldDefinition).map(column =>
                h(DataModelColumnToggle, {key: column.id, model, column})
              ),
              h("hr", {className: "slds-m-vertical_x-small"}),
              DATA_MODEL_COLUMNS.filter(column => column.fieldDefinition).map(column =>
                h(DataModelColumnToggle, {key: column.id, model, column})
              )
            )
          )
        )
        )
        : null
    );
  }
}

class DataModelColumnToggle extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(e) {
    const {model, column} = this.props;
    model.setColumnVisible(column.id, e.target.checked);
  }
  render() {
    const {model, column} = this.props;
    const checkboxId = "object-scanner-col-" + column.id;
    const title = column.fieldDefinition && !model.fieldDefinitionQueried
      ? "Enable Description & classification, then scan, to load this data."
      : undefined;
    return h("div", {className: "slds-checkbox", title},
      h("input", {
        type: "checkbox",
        id: checkboxId,
        checked: model.isColumnChecked(column.id),
        onChange: this.onChange,
        disabled: !!column.required
      }),
      h("label", {className: "slds-checkbox__label", htmlFor: checkboxId},
        h("span", {className: "slds-checkbox_faux"}),
        h("span", {className: "slds-form-element__label"}, column.label)
      )
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onToggleHelp = this.onToggleHelp.bind(this);
    this.onScan = this.onScan.bind(this);
    this.onAnalyze = this.onAnalyze.bind(this);
    this.onToggleFieldDefinitions = this.onToggleFieldDefinitions.bind(this);
    this.onStop = this.onStop.bind(this);
    this.onSearch = this.onSearch.bind(this);
    this.onModelSearch = this.onModelSearch.bind(this);
    this.onExportModel = this.onExportModel.bind(this);
    this.onCopyModelExcel = this.onCopyModelExcel.bind(this);
    this.onExportFindings = this.onExportFindings.bind(this);
    this.onClear = this.onClear.bind(this);
    this.onConfirmClear = this.onConfirmClear.bind(this);
    this.onCancelClear = this.onCancelClear.bind(this);
    this.onCloseToast = this.onCloseToast.bind(this);
    this.onTogglePicker = this.onTogglePicker.bind(this);
  }

  onToggleHelp(e) {
    e.preventDefault();
    this.props.model.showHelp = !this.props.model.showHelp;
    this.props.model.didUpdate();
  }

  onScan(e) {
    e.preventDefault();
    this.props.model.startScan();
  }

  onAnalyze(e) {
    e.preventDefault();
    this.props.model.startAnalyze();
  }

  onToggleFieldDefinitions(e) {
    this.props.model.setIncludeFieldDefinitions(e.target.checked);
  }

  onStop(e) {
    e.preventDefault();
    this.props.model.stopScan();
  }

  onSearch(e) {
    this.props.model.setSearch(e.target.value);
  }

  onModelSearch(e) {
    this.props.model.setModelSearch(e.target.value);
  }

  onExportModel(e) {
    e.preventDefault();
    this.props.model.exportDataModel();
  }

  onCopyModelExcel(e) {
    e.preventDefault();
    this.props.model.copyDataModelExcel();
  }

  onExportFindings(e) {
    e.preventDefault();
    this.props.model.exportFindings();
  }

  onClear(e) {
    e.preventDefault();
    this.props.model.confirmClear = true;
    this.props.model.didUpdate();
  }

  onConfirmClear() {
    const {model} = this.props;
    model.findings = [];
    model.objectModels = [];
    model.fieldDefinitions = {};
    model.fieldDefinitionQueried = false;
    model.analyzed = false;
    model.modelSearch = "";
    model.resultsTab = "data-model";
    model.expandedLookupRows = new Set();
    model.confirmClear = false;
    model.persistFindings();
    model.didUpdate();
  }

  onCancelClear() {
    this.props.model.confirmClear = false;
    this.props.model.didUpdate();
  }

  onCloseToast(id) {
    this.props.model.dismissToast(id);
  }

  onTogglePicker(e) {
    e.preventDefault();
    this.props.model.pickerCollapsed = !this.props.model.pickerCollapsed;
    this.props.model.didUpdate();
  }

  render() {
    const {model} = this.props;
    const summary = model.summary();
    const filtered = model.filteredCandidates();
    const modelRows = model.filteredModelRows();
    const findings = model.visibleFindings();
    const visibleCols = model.visibleDataModelColumns();
    const pageClass = "slds-m-top_xx-large slds-grid slds-grid_vertical sfir-object-scanner-page"
      + (model.pickerCollapsed ? " sfir-object-scanner-picker-collapsed" : "")
      + (model.columnPickerOpen ? " sfir-object-scanner-columns-open" : "");

    return h("div", {},
      h(PageHeader, {
        pageTitle: "Object Scanner",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        ...model.userInfoModel.getProps(),
        utilityItems: [
          h("div", {key: "settings", className: "slds-builder-header__utilities-item slds-p-top_x-small slds-p-horizontal_x-small sfir-border-none"},
            h("a", {href: model.optionsHref(), title: "Object Scanner settings", className: "slds-button slds-button_icon slds-button_icon-border-filled"},
              h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
                h("use", {xlinkHref: "symbols.svg#settings"})
              )
            )
          ),
          h("div", {key: "help", className: "slds-builder-header__utilities-item slds-p-top_x-small slds-p-horizontal_x-small sfir-border-none"},
            h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled", title: "Object Scanner Help", onClick: this.onToggleHelp},
              h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
                h("use", {xlinkHref: "symbols.svg#question"})
              )
            )
          )
        ]
      }),
      model.toasts.length
        ? h("div", {className: "sfir-object-scanner-toasts"},
          model.toasts.map(toast => h(Toast, {
            key: toast.id,
            variant: toast.variant,
            title: toast.title,
            message: toast.message,
            onClose: () => this.onCloseToast(toast.id)
          }))
        )
        : null,
      h("div", {className: pageClass},
        model.showHelp ? h("div", {className: "slds-p-around_small"},
          h(AlertBanner, {
            type: "info",
            iconName: "info",
            bannerText: "Scan Data Model loads object and field describes so you can search and export the schema. Use Columns to choose which field attributes appear in the Data Model tab; your selection is saved in this browser. Turn on Description & classification to also query FieldDefinition (extra API calls). Analyze is optional and runs hygiene rules on the loaded model. Search accepts Object.Field, for example Account.Name."
          })
        ) : null,
        h("div", {className: "slds-p-around_small sfir-object-scanner-toolbar"},
          h("div", {className: "slds-grid slds-grid_vertical-align-center slds-gutters_x-small slds-wrap"},
            h("div", {className: "slds-col slds-grow-none"},
              h("button", {className: "slds-button slds-button_brand", onClick: this.onScan, disabled: model.scanning || model.selectedNames.size === 0}, "Scan Data Model")
            ),
            h("div", {className: "slds-col slds-grow-none"},
              h("label", {
                className: "slds-checkbox_toggle slds-grid",
                style: {whiteSpace: "nowrap"},
                title: "Query FieldDefinition for description and PII classification. Extra Tooling API calls (5 objects per composite)."
              },
              h("span", {className: "slds-form-element__label slds-m-bottom_none"}, "Description & classification"),
              h("input", {
                type: "checkbox",
                id: "object-scanner-include-field-defs",
                name: "object-scanner-include-field-defs",
                role: "switch",
                checked: model.includeFieldDefinitions,
                onChange: this.onToggleFieldDefinitions,
                disabled: model.scanning
              }),
              h("span", {id: "object-scanner-include-field-defs-faux", className: "slds-checkbox_faux_container"},
                h("span", {className: "slds-checkbox_faux"}),
                h("span", {className: "slds-checkbox_on"}, "Enabled"),
                h("span", {className: "slds-checkbox_off"}, "Off")
              )
              )
            ),
            h("div", {className: "slds-col slds-grow-none"},
              h("button", {className: "slds-button slds-button_brand", onClick: this.onAnalyze, disabled: model.scanning || !model.objectModels.length}, "Analyze")
            ),
            h("div", {className: "slds-col slds-grow-none"},
              h("button", {className: "slds-button slds-button_neutral", onClick: this.onStop, disabled: !model.scanning}, "Stop")
            ),
            h("div", {className: "slds-col slds-grow-none"},
              h("div", {className: "slds-button-group", role: "group"},
                h("button", {
                  className: "slds-button slds-button_neutral",
                  onClick: this.onCopyModelExcel,
                  disabled: !model.objectModels.length,
                  title: "Copy data model to the clipboard for Excel"
                },
                h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
                  h("use", {xlinkHref: "symbols.svg#copy"})
                ),
                "XLS"
                ),
                h("button", {
                  className: "slds-button slds-button_neutral",
                  onClick: this.onExportModel,
                  disabled: !model.objectModels.length,
                  title: "Download data model as CSV"
                },
                h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
                  h("use", {xlinkHref: "symbols.svg#download"})
                ),
                "CSV"
                )
              )
            ),
            h("div", {className: "slds-col slds-grow-none"},
              h("button", {className: "slds-button slds-button_neutral", onClick: this.onExportFindings, disabled: !model.findings.length}, "Export Findings")
            ),
            h("div", {className: "slds-col slds-grow-none"},
              h("button", {className: "slds-button slds-button_neutral", onClick: this.onClear, disabled: !model.findings.length && !model.objectModels.length}, "Clear")
            ),
            h("div", {className: "slds-col slds-text-body_small sfir-object-scanner-progress"},
              model.scanning || model.scanProgress.phase
                ? `${model.scanProgress.phase || ""} ${model.scanProgress.done}/${model.scanProgress.total || model.selectedNames.size}`
                : `${model.selectedNames.size} object(s) selected`
            ),
            h("div", {className: "slds-col slds-col_bump-left slds-text-align_right sfir-object-scanner-api-stats", style: {whiteSpace: "nowrap"}},
              model.apiCallCount
                ? h("span", {className: "slds-badge slds-m-right_small", title: model.apiCallTitle()}, "API calls: " + model.apiCallCount)
                : null,
              model.scanDurationMs
                ? h("span", {className: "slds-m-right_small", title: "Scan duration"}, model.formatDuration(model.scanDurationMs))
                : null
            )
          )
        ),
        h("div", {className: "slds-grid slds-gutters_x-small slds-p-horizontal_small slds-grow slds-scrollable_none sfir-object-scanner-main"},
          h("div", {className: "slds-col slds-grid slds-grid_vertical sfir-object-scanner-picker"},
            h("article", {className: "slds-card slds-grid slds-grid_vertical slds-grow slds-scrollable_none"},
              h("div", {className: "slds-card__header slds-grid"},
                h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate" + (model.pickerCollapsed ? " slds-hide" : "")},
                  h("div", {className: "slds-media__body"},
                    h("h2", {className: "slds-card__header-title"}, "Objects")
                  )
                ),
                h("div", {className: "slds-no-flex"},
                  h("button", {
                    className: "slds-button slds-button_icon slds-button_icon-border-filled",
                    title: model.pickerCollapsed ? "Show objects" : "Hide objects",
                    "aria-expanded": !model.pickerCollapsed,
                    onClick: this.onTogglePicker
                  },
                  h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
                    h("use", {xlinkHref: model.pickerCollapsed ? "symbols.svg#chevronright" : "symbols.svg#chevronleft"})
                  )
                  )
                )
              ),
              h("div", {className: "slds-card__body slds-card__body_inner slds-grid slds-grid_vertical slds-grow slds-scrollable_none sfir-object-scanner-picker-body" + (model.pickerCollapsed ? " slds-hide" : "")},
                h("div", {className: "slds-form-element slds-m-bottom_x-small"},
                  h("div", {className: "slds-form-element__control"},
                    h("input", {className: "slds-input", type: "search", placeholder: "Search objects", value: model.objectSearch, onChange: this.onSearch})
                  )
                ),
                h("div", {className: "slds-button-group slds-m-bottom_x-small", role: "group"},
                  FILTERS.map(filter => h("button", {
                    key: filter.id,
                    className: "slds-button " + (model.objectFilter === filter.id ? "slds-button_brand" : "slds-button_neutral"),
                    onClick: () => model.setFilter(filter.id)
                  }, filter.label))
                ),
                h("div", {className: "slds-m-bottom_x-small"},
                  h("button", {className: "slds-button slds-button_neutral slds-button_small", onClick: () => model.selectFiltered(true)}, "Select all"),
                  h("button", {className: "slds-button slds-button_neutral slds-button_small", onClick: () => model.selectFiltered(false)}, "Select none")
                ),
                h("div", {className: "slds-grow slds-scrollable sfir-object-scanner-picker-list"},
                  filtered.map(entity => h("div", {key: entity.name, className: "slds-form-element"},
                    h("div", {className: "slds-form-element__control"},
                      h("div", {className: "slds-checkbox"},
                        h("input", {
                          type: "checkbox",
                          id: "obj-" + entity.name,
                          checked: model.selectedNames.has(entity.name),
                          onChange: () => model.toggleObject(entity.name)
                        }),
                        h("label", {className: "slds-checkbox__label", htmlFor: "obj-" + entity.name},
                          h("span", {className: "slds-checkbox_faux"}),
                          h("span", {className: "slds-form-element__label", title: entity.name}, entity.label || entity.name)
                        )
                      )
                    )
                  ))
                )
              )
            )
          ),
          h("div", {className: "slds-col slds-grid slds-grid_vertical slds-grow slds-no-space slds-scrollable_none sfir-object-scanner-results"},
            h("div", {className: "slds-grid slds-gutters_x-small slds-m-bottom_small"},
              [
                {key: "objects", label: "Scanned", value: summary.objects},
                {key: "fields", label: "Fields", value: summary.fields},
                {key: "total", label: "Findings", value: summary.total, filter: "all"},
                {key: "error", label: "Errors", value: summary.error, filter: "error", className: "slds-text-color_error"},
                {key: "warning", label: "Warnings", value: summary.warning, filter: "warning", className: "sfir-object-scanner-severity-warning"},
                {key: "info", label: "Info", value: summary.info, filter: "info", className: "sfir-object-scanner-severity-info"}
              ].map(card => h("div", {key: card.key, className: "slds-col sfir-object-scanner-summary-card"},
                h("button", {
                  className: "slds-button slds-button_neutral slds-button_stretch" + (card.filter && model.severityFilter === card.filter && model.severityFilter !== "all" ? " sfir-object-scanner-summary-selected" : ""),
                  onClick: card.filter ? () => { model.severityFilter = card.filter; model.setResultsTab("findings"); } : undefined,
                  disabled: !card.filter
                },
                h("div", {},
                  h("div", {className: "slds-text-title"}, card.label),
                  h("div", {className: "slds-text-heading_medium " + (card.className || "")}, String(card.value || 0))
                )
                )
              ))
            ),
            h("div", {className: "slds-form-element slds-m-bottom_small"},
              h("div", {className: "slds-grid slds-grid_vertical-align-center"},
                h("div", {className: "slds-col slds-grow"},
                  h("div", {className: "slds-form-element__control"},
                    h("input", {
                      id: "object-scanner-model-search",
                      className: "slds-input",
                      type: "search",
                      placeholder: "Search objects and fields (Account.Name)",
                      value: model.modelSearch,
                      onChange: this.onModelSearch,
                      disabled: !model.objectModels.length
                    })
                  )
                ),
                h("div", {className: "slds-col slds-grow-none slds-m-left_x-small"},
                  h(DataModelColumnsBox, {model})
                )
              )
            ),
            h("div", {className: "slds-tabs_default slds-grid slds-grid_vertical slds-grow sfir-object-scanner-results-tabs"},
              h("ul", {className: "slds-tabs_default__nav slds-grow-none slds-shrink-none", role: "tablist"},
                h("li", {className: "slds-tabs_default__item" + (model.resultsTab === "data-model" ? " slds-is-active" : ""), title: "Data Model"},
                  h("a", {
                    className: "slds-tabs_default__link",
                    href: "#",
                    role: "tab",
                    tabIndex: "0",
                    onClick: e => { e.preventDefault(); model.setResultsTab("data-model"); }
                  }, "Data Model")
                ),
                h("li", {className: "slds-tabs_default__item" + (model.resultsTab === "findings" ? " slds-is-active" : ""), title: "Findings"},
                  h("a", {
                    className: "slds-tabs_default__link",
                    href: "#",
                    role: "tab",
                    tabIndex: "0",
                    onClick: e => { e.preventDefault(); model.setResultsTab("findings"); }
                  }, "Findings")
                )
              ),
              h("div", {
                id: "object-scanner-tab-data-model",
                className: "slds-tabs_default__content " + (model.resultsTab === "data-model" ? "slds-show" : "slds-hide"),
                role: "tabpanel"
              },
              h("div", {className: "slds-grow slds-scrollable sfir-object-scanner-table-wrap"},
                h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped", id: "object-scanner-model"},
                  h("thead", {},
                    h("tr", {className: "slds-line-height_reset"},
                      visibleCols.map(col => h("th", {key: col.id, scope: "col"}, col.label))
                    )
                  ),
                  h("tbody", {},
                    modelRows.length
                      ? modelRows.map(row => h("tr", {key: row.id},
                        visibleCols.map(col => {
                          if (col.id === "object") {
                            return h("td", {key: col.id},
                              h("a", {href: model.inspectHref(row.objectModel.name), title: "Open Show All Data for field usage"}, row.objectModel.name)
                            );
                          }
                          if (col.id === "lookupTo") {
                            return h("td", {key: col.id, className: "slds-cell-wrap"}, renderLookupToCell(model, row));
                          }
                          return h("td", {
                            key: col.id,
                            className: col.id === "helpText" ? "sfir-object-scanner-help-text" : undefined
                          }, model.dataModelColumnValue(col.id, row));
                        })
                      ))
                      : h("tr", {},
                        h("td", {colSpan: Math.max(visibleCols.length, 1), className: "slds-text-align_center slds-p-around_medium"},
                          model.scanning && !model.objectModels.length
                            ? "Loading data model…"
                            : model.objectModels.length
                              ? "No objects or fields match this search."
                              : "Select objects and click Scan Data Model."
                        )
                      )
                  )
                )
              )
              ),
              h("div", {
                id: "object-scanner-tab-findings",
                className: "slds-tabs_default__content " + (model.resultsTab === "findings" ? "slds-show" : "slds-hide"),
                role: "tabpanel"
              },
              h("div", {className: "slds-grow slds-scrollable sfir-object-scanner-table-wrap"},
                h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped", id: "object-scanner-findings"},
                  h("thead", {},
                    h("tr", {className: "slds-line-height_reset"},
                      h("th", {scope: "col"}, "Severity"),
                      h("th", {scope: "col"}, "Rule"),
                      h("th", {scope: "col"}, "Object"),
                      h("th", {scope: "col"}, "Field"),
                      h("th", {scope: "col"}, "Message")
                    )
                  ),
                  h("tbody", {},
                    findings.length
                      ? findings.map(item => h("tr", {key: item.id},
                        h("td", {
                          className: item.severity === "error" ? "slds-text-color_error" : "sfir-object-scanner-severity-" + item.severity,
                          "data-severity": item.severity
                        }, item.severity),
                        h("td", {},
                          h("span", {}, item.ruleLabel || item.rule),
                          h(Tooltip, {idKey: item.id, tooltip: item.rule})
                        ),
                        h("td", {},
                          h("a", {href: model.inspectHref(item.objectName), title: "Open Show All Data for field usage"}, item.objectName)
                        ),
                        h("td", {}, item.fieldName),
                        h("td", {}, item.message)
                      ))
                      : h("tr", {},
                        h("td", {colSpan: 5, className: "slds-text-align_center slds-p-around_medium"},
                          model.scanning
                            ? "Analyzing…"
                            : model.analyzed
                              ? (model.modelSearch ? "No findings match this search." : "No findings for the current data model.")
                              : "Scan the data model, then click Analyze to run hygiene rules."
                        )
                      )
                  )
                )
              )
              )
            )
          )
        )
      ),
      model.confirmClear ? h("div", {className: "sfir-confirm-modal-overlay"}, h(ConfirmModal, {
        isOpen: true,
        title: "Clear session",
        message: "Clear the loaded data model and findings from this session?",
        onConfirm: this.onConfirmClear,
        onCancel: this.onCancelClear,
        confirmLabel: "Clear",
        cancelLabel: "Cancel",
        confirmVariant: "destructive"
      })) : null
    );
  }
}

{
  const args = new URLSearchParams(location.search.slice(1));
  const sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {
    const root = document.getElementById("root");
    const model = new Model(sfHost);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    window.objectScannerModel = model;
    ReactDOM.render(h(App, {model}), root);
    model.loadCandidates();
  });
}
