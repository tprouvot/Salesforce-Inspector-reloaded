/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */
import {getObjectSetupLinks, getFieldSetupLinks} from "./setup-links.js";

class Model {
  constructor(sfHost) {
    this.reactCallback = null;

    // Raw fetched data
    this.globalDescribe = null;
    this.sobjectDescribePromise = null;
    this.objectData = null;
    this.recordData = null;
    this.layoutInfo = null;
    this.entityDefinitionDurableId = null;

    // URL parameters
    this.sobjectName = null;
    this.useToolingApi = null;
    this.recordId = null;

    // Processed data and UI state
    this.sfHost = sfHost;
    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.errorMessages = [];
    this.rowsFilter = "";
    this.useTab = "all";
    this.showTableBorder = localStorage.getItem("displayInspectTableBorders") === "true";
    this.fieldRows = new FieldRowList(this);
    this.childRows = new ChildRowList(this);
    this.detailsFilter = "";
    this.detailsBox = null;
    this.editMode = null; // null (when not editing), "update", "delete" (for confirming) or "create"
    this.headerCallout = localStorage.getItem("createUpdateRestCalloutHeaders") ? JSON.parse(localStorage.getItem("createUpdateRestCalloutHeaders")) : "{}";
    this.hasEntityParticles = false;
    this.objectActionsOpen = false;
    this.objectSetupLinks = null;
    this.objectSetupLinksRequested = false;
    if (localStorage.getItem(sfHost + "_isSandbox") != "true") {
      //change background color for production
      document.body.classList.add("prod");
    }
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
  }
  /**
   * Show the spinner while waiting for a promise, and show an error if it fails.
   * didUpdate() must be called after calling spinFor.
   * didUpdate() is called when the promise is resolved or rejected, so the caller doesn't have to call it, when it updates the model just before resolving the promise, for better performance.
   * @param actionName Name to show in the errors list if the operation fails.
   * @param promise The promise to wait for.
   */
  spinFor(actionName, promise) {
    this.spinnerCount++;
    promise
      .catch(err => {
        console.error(err);
        this.errorMessages.push("Error " + actionName + ": " + err.message);
      })
      .then(() => {
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }
  recordHeading() {
    let parts;
    if (this.recordData) {
      parts = [this.recordData.Name, this.recordData.Id];
    } else if (this.objectData) {
      parts = [this.objectData.label, this.objectData.keyPrefix];
    } else {
      parts = [];
    }
    if (this.useToolingApi) {
      parts.push("Tooling API");
    }
    return "(" + parts.join(" / ") + ")";
  }
  objectName() {
    // Get with correct case if available, otherwise just return the input.
    return this.objectData ? this.objectData.name : this.sobjectName;
  }
  title() {
    return "ALL DATA: " + this.objectName() + " " + this.recordHeading();
  }
  showDetailsBox(name, allFieldMetadata, detailsFilterList) {
    let self = this;
    let fieldDetails = [];
    for (let key in allFieldMetadata) {
      let value = allFieldMetadata[key];
      let row = key + "," + value;
      fieldDetails.push({
        key,
        value,
        visible() {
          let value = self.detailsFilter.trim().toLowerCase();
          return !value || row.toLowerCase().includes(value);
        }
      });
    }
    this.detailsBox = {rows: fieldDetails, name, detailsFilterList};
  }
  showObjectMetadata() {
    let objectDescribe = this.objectData;
    let props = {};
    addProperties(props, objectDescribe, "desc.", {fields: true, childRelationships: true});
    addProperties(props, this.layoutInfo, "layout.", {detailLayoutSections: true, editLayoutSections: true, relatedLists: true});
    this.showDetailsBox(this.objectName(), props, null);
  }
  canUpdate() {
    return this.objectData && this.objectData.updateable && this.recordData && this.recordData.Id;
  }
  doUpdate() {
    this.editMode = "update";
    this.fieldRows.makeAllEditable();
  }
  canDelete() {
    return this.objectData && this.objectData.deletable && this.recordData && this.recordData.Id;
  }
  doDelete() {
    this.editMode = "delete";
  }
  canCreate() {
    return this.objectData && this.objectData.createable;
  }
  doCreate() {
    this.editMode = "create";
    this.fieldRows.makeAllEditable();
  }
  doSave() {
    this.clearSaveError();
    if (this.editMode == "update") {
      let record = {};
      this.fieldRows.rows.forEach(fieldRow => fieldRow.saveDataValue(record));
      let recordUrl = this.objectData.urls.rowTemplate.replace("{ID}", this.recordData.Id);
      this.spinFor(
        "saving record",
        sfConn.rest(recordUrl, {method: "PATCH", body: record, headers: this.headerCallout}).then(() => {
          this.endEdit();
          this.clearRecordData();
          this.setRecordData(sfConn.rest(recordUrl));
        })
      );
    } else if (this.editMode == "delete") {
      let recordUrl = this.objectData.urls.rowTemplate.replace("{ID}", this.recordData.Id);
      this.spinFor(
        "deleting record",
        sfConn.rest(recordUrl, {method: "DELETE"}).then(() => {
          this.endEdit();
          let args = new URLSearchParams();
          args.set("host", this.sfHost);
          args.set("objectType", this.objectName());
          if (this.useToolingApi) {
            args.set("useToolingApi", "1");
          }
          location.href = "inspect.html?" + args;
        })
      );
    } else if (this.editMode == "create") {
      let record = {};
      this.fieldRows.rows.forEach(fieldRow => fieldRow.saveDataValue(record));
      let recordUrl = this.objectData.urls.sobject;
      this.spinFor(
        "creating record",
        sfConn.rest(recordUrl, {method: "POST", body: record, headers: this.headerCallout}).then(result => {
          this.endEdit();
          let args = new URLSearchParams();
          args.set("host", this.sfHost);
          args.set("objectType", this.objectName());
          if (this.useToolingApi) {
            args.set("useToolingApi", "1");
          }
          args.set("recordId", result.id);
          location.href = "inspect.html?" + args;
        })
      );
    } else {
      console.error("unknown edit mode", this.editMode);
    }
  }
  clearSaveError() {
    let i = this.errorMessages.findIndex(e => ["saving record", "deleting record", "creating record"].some(actionName => e.startsWith(`Error ${actionName}:`)));
    if (i != -1) {
      this.errorMessages.splice(i, 1);
    }
  }
  cancelEdit() {
    this.clearSaveError();
    this.endEdit();
  }
  endEdit() {
    if (!this.canView()) {
      this.fieldRows.showHideColumn(false, "value");
    }
    for (let fieldRow of this.fieldRows.rows) {
      fieldRow.dataEditValue = null;
    }
    this.editMode = null;
  }
  canView() {
    return this.recordData && this.recordData.Id;
  }
  viewLink() {
    if (this.recordData && this.recordData.Id) {
      return "https://" + this.sfHost + "/" + this.recordData.Id;
    }
    if (this.objectData && this.objectData.keyPrefix) {
      return "https://" + this.sfHost + "/" + this.objectData.keyPrefix + "/o";
    }
    return undefined;
  }
  editLayoutLink() {
    if (this.layoutInfo && this.layoutInfo.id) {
      return "https://" + this.sfHost + "/lightning/setup/ObjectManager/" + this.entityDefinitionDurableId + "/PageLayouts/" + this.layoutInfo.id + "/view";
    }
    return undefined;
  }
  exportLink() {
    let objectName = this.sobjectName;
    if (this.objectData && this.objectData.name) {
      objectName = this.objectData.name;
    }
    if (!objectName) {
      return undefined;
    }
    let query = "SELECT Id FROM " + objectName;
    if (this.recordData && this.recordData.Id) {
      query += " WHERE Id = '" + this.recordData.Id + "'";
    }
    return this.dataExportUrl(query);
  }
  dataExportUrl(query) {
    let args = new URLSearchParams();
    args.set("host", this.sfHost);
    args.set("query", query);
    if (this.useToolingApi) {
      args.set("useToolingApi", "1");
    }
    return "data-export.html?" + args;
  }
  toggleObjectActions() {
    this.objectActionsOpen = !this.objectActionsOpen;
    if (this.objectActionsOpen && !this.objectSetupLinksRequested) {
      this.objectSetupLinksRequested = true;
      this.spinFor(
        "getting object setup links",
        getObjectSetupLinks(this.sfHost, this.objectName())
          .then(setupLinks => this.objectSetupLinks = setupLinks)
      );
    }
  }
  setRecordData(recordDataPromise) {
    this.spinFor("retrieving record", recordDataPromise.then(res => {
      for (let name in res) {
        if (name != "attributes") {
          this.fieldRows.getRow(name).dataTypedValue = res[name];
        }
      }
      this.fieldRows.resortRows();
      this.recordData = res;
      this.fieldRows.showHideColumn(true, "value");
      this.spinFor(
        "describing layout",
        this.sobjectDescribePromise.then(sobjectDescribe => {
          if (sobjectDescribe.urls.layouts) {
            return sfConn.rest(sobjectDescribe.urls.layouts + "/" + (res.RecordTypeId || "012000000000000AAA"));
          }
          return undefined;
        }).then(layoutDescribe => {
          if (layoutDescribe) {
            for (let layoutType of [{sections: "detailLayoutSections", property: "detailLayoutInfo"}, {sections: "editLayoutSections", property: "editLayoutInfo"}]) {
              layoutDescribe[layoutType.sections].forEach((section, sectionIndex) => {
                section.layoutRows.forEach((row, rowIndex) => {
                  row.layoutItems.forEach((item, itemIndex) => {
                    item.layoutComponents.forEach((component, componentIndex) => {
                      if (component.type == "Field") {
                        this.fieldRows.getRow(component.value)[layoutType.property] = {
                          indexes: {
                            shownOnLayout: true,
                            sectionIndex,
                            rowIndex,
                            itemIndex,
                            componentIndex
                          },
                          section,
                          row,
                          item,
                          component
                        };
                      }
                    });
                  });
                });
              });
            }
            this.fieldRows.resortRows();
            layoutDescribe.relatedLists.forEach((child, childIndex) => {
              this.childRows.getRow(child.name).relatedListInfo = {
                shownOnLayout: true,
                relatedListIndex: childIndex,
                relatedList: child
              };
            });
            this.childRows.resortRows();
            this.layoutInfo = layoutDescribe;
          }
        })
      );
    }));
  }
  clearRecordData() {
    for (let fieldRow of this.fieldRows.rows) {
      fieldRow.dataTypedValue = undefined;
      fieldRow.detailLayoutInfo = undefined;
      fieldRow.editLayoutInfo = undefined;
    }
    for (let childRow of this.childRows.rows) {
      childRow.relatedListInfo = undefined;
    }
    this.recordData = null;
    this.layoutInfo = null;
  }
  startLoading() {

    // Fetch id prefix to object name mapping
    this.spinFor("describing global", sfConn.rest("/services/data/v" + apiVersion + "/" + (this.useToolingApi ? "tooling/" : "") + "sobjects/").then(globalDescribe => {
      this.globalDescribe = globalDescribe;
    }));

    // Fetch object data using object describe call
    this.sobjectDescribePromise = sfConn.rest("/services/data/v" + apiVersion + "/" + (this.useToolingApi ? "tooling/" : "") + "sobjects/" + this.sobjectName + "/describe/");
    this.spinFor("describing object", this.sobjectDescribePromise.then(sobjectDescribe => {
      // Display the retrieved object data
      this.objectData = sobjectDescribe;
      for (let fieldDescribe of sobjectDescribe.fields) {
        this.fieldRows.getRow(fieldDescribe.name).fieldDescribe = fieldDescribe;
      }
      this.fieldRows.resortRows();
      for (let childDescribe of sobjectDescribe.childRelationships) {
        this.childRows.getRow(childDescribe.relationshipName).childDescribe = childDescribe;
      }
      this.childRows.resortRows();
    }));

    // Fetch record data using record retrieve call
    if (this.recordId) {
      this.setRecordData(sfConn.rest("/services/data/v" + apiVersion + "/" + (this.useToolingApi ? "tooling/" : "") + "sobjects/" + this.sobjectName + "/" + this.recordId));
    }

    // Fetch fields using a Tooling API call, which returns fields not readable by the current user, but fails if the user does not have access to the Tooling API.
    // The Tooling API is not very stable. It often gives "An unexpected error occurred. Please include this ErrorId if you contact support".
    // We would like to query all meta-fields, to show them when the user clicks a field for more details.
    // But, the more meta-fields we query, the more likely the query is to fail, and the meta-fields that cause failure vary depending on the entity we query, the org we are in, and the current Salesforce release.
    // Therefore qe query the minimum set of meta-fields needed by our main UI.
    this.spinFor(
      "querying tooling particles",
      sfConn.rest("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("SELECT QualifiedApiName, Label, DataType, ReferenceTo, Length, Precision, Scale, IsAutonumber, IsCaseSensitive, IsDependentPicklist, IsEncrypted, IsIdLookup, IsHtmlFormatted, IsNillable, IsUnique, IsCalculated, InlineHelpText, FieldDefinition.DurableId, EntityDefinition.DurableId FROM EntityParticle WHERE EntityDefinition.QualifiedApiName = '" + this.sobjectName + "'")).then(res => {
        for (let entityParticle of res.records) {
          this.fieldRows.getRow(entityParticle.QualifiedApiName).entityParticle = entityParticle;
          if (!this.entityDefinitionDurableId){
            this.entityDefinitionDurableId = entityParticle.EntityDefinition.DurableId;
          }
        }
        this.hasEntityParticles = true;
        this.fieldRows.resortRows();
      })
    );

  }
  updateShowTableBorder() {
    this.showTableBorder = !this.showTableBorder;
    localStorage.setItem("displayInspectTableBorders", this.showTableBorder); // Save to local storage

  }
  reloadTables() {
    this.fieldRows = new FieldRowList(this);
    this.childRows = new ChildRowList(this);
    this.startLoading();
  }
}

class RowList {
  constructor(rowConstructor, model) {
    this._rowConstructor = rowConstructor;
    this.model = model;
    this._map = new Map();
    this._sortCol = "name";
    this._sortDir = 1;
    this._nextReactKey = 0;
    this.rows = [];
    this.availableColumns = null;
    this.selectedColumnMap = null;
  }
  getRow(name) {
    if (!name) { // related lists may not have a name
      let row = new this._rowConstructor(name, this._nextReactKey++, this);
      this.rows.push(row);
      return row;
    }
    let row = this._map.get(name);
    if (!row) {
      row = new this._rowConstructor(name, this._nextReactKey++, this);
      this.rows.push(row);
      this._map.set(name, row);
    }
    return row;
  }
  sortRowsBy(col) {
    this._sortDir = col == this._sortCol ? -this._sortDir : 1;
    this._sortCol = col;
    this.resortRows();
  }
  resortRows() {
    let s = v =>
      v === undefined ? "\uFFFD"
      : v == null ? ""
      : String(v).trim();
    this.rows.sort((a, b) => this._sortDir * s(a.sortKey(this._sortCol)).localeCompare(s(b.sortKey(this._sortCol))));
  }
  initColumns(cols) {
    this.selectedColumnMap = new Map();
    for (let col of cols) {
      this.selectedColumnMap.set(col, this.createColumn(col));
    }
  }
  showHideColumn(show, col) {
    if (show == this.selectedColumnMap.has(col)) {
      return;
    }
    if (show) {
      this.selectedColumnMap.set(col, this.createColumn(col));
    } else {
      this.selectedColumnMap.delete(col);
    }
  }
  toggleAvailableColumns() {
    if (this.availableColumns) {
      this.availableColumns = null;
      return;
    }
    let cols = new Set();
    for (let row of this.rows) {
      for (let prop in row.rowProperties()) {
        cols.add(prop);
      }
    }
    this.availableColumns = Array.from(cols);
  }
  showColumn(col, filterValue) {
    let value = filterValue == null ? "" : "" + filterValue;
    this.showHideColumn(true, col);
    if (value) {
      this.model.useTab = this.listName;
      this.selectedColumnMap.get(col).columnFilter = value;
    }
  }
}

class FieldRowList extends RowList {
  constructor(model) {
    super(FieldRow, model);
    this.listName = "fields";
    this.initColumns(["name", "label", "type"]);
    this.fetchFieldDescriptions = true;
  }
  getColumnClassName(col) {
    let className = this.model.showTableBorder ? "border-cell " : "";
    if (col == "name") {
      className += "field-name";
    } else if (col == "label") {
      className += "field-label";
    } else {
      className += "field-column";
    }
    return className;
  }
  createColumn(col) {
    return {
      name: col,
      label:
        col == "name" ? "Field API Name"
        : col == "label" ? "Label"
        : col == "type" ? "Type"
        : col == "value" ? "Value"
        : col == "helptext" ? "Help text"
        : col == "desc" ? "Description"
        : col,
      className: this.getColumnClassName(col),
      reactElement:
        col == "value" ? FieldValueCell
        : col == "type" ? FieldTypeCell
        : DefaultCell,
      columnFilter: ""
    };
  }
  showHideColumn(show, col) {
    if (col == "desc" && this.fetchFieldDescriptions) {
      this.fetchFieldDescriptions = false;
      this.rows.forEach(fieldRow => fieldRow.showFieldDescription());
    }
    super.showHideColumn(show, col);
  }
  makeAllEditable() {
    this.showHideColumn(true, "value");
    for (let fieldRow of this.rows) {
      if (fieldRow.canEdit()) {
        fieldRow.dataEditValue = fieldRow.dataStringValue();
      }
    }
  }
}

class ChildRowList extends RowList {
  constructor(model) {
    super(ChildRow, model);
    this.listName = "childs";
    this.initColumns(["name", "object", "field", "label"]);
  }
  createColumn(col) {
    return {
      name: col,
      label:
        col == "name" ? "Relationship Name"
        : col == "object" ? "Child Object"
        : col == "field" ? "Field"
        : col == "label" ? "Label"
        : col,
      className: "child-column" + (this.model.showTableBorder ? " border-cell" : ""),
      reactElement: col == "object" ? ChildObjectCell : DefaultCell,
      columnFilter: ""
    };
  }
}

class TableRow {
  visible() {
    let selectedColumns = Array.from(this.rowList.selectedColumnMap.values());
    let split = terms => terms.trim().toLowerCase().split(/[ \t]+/);
    let search = (term, col) => {
      let s = this.sortKey(col.name);
      return s != null && ("" + s).toLowerCase().includes(term);
    };
    if (this.rowList.model.useTab != "all") {
      return selectedColumns.every(col =>
        !col.columnFilter || split(col.columnFilter).every(term => search(term, col))
      );
    } else {
      return split(this.rowList.model.rowsFilter).every(term =>
        !term || selectedColumns.some(col => search(term, col))
      );
    }
  }
}

class FieldRow extends TableRow {
  constructor(fieldName, reactKey, rowList) {
    super();
    this.rowList = rowList;
    this.fieldName = fieldName;
    this.reactKey = reactKey;
    this.fieldDescribe = undefined;
    this.dataTypedValue = undefined;
    this.dataEditValue = null;
    this.detailLayoutInfo = undefined;
    this.editLayoutInfo = undefined;
    this.entityParticle = undefined;
    this.fieldParticleMetadata = undefined;
    this.recordIdPop = null;
    this.fieldActionsOpen = false;
    this.fieldSetupLinks = null;
    this.fieldSetupLinksRequested = false;
  }
  rowProperties() {
    let props = {};
    if (typeof this.dataTypedValue != "undefined") {
      addProperties(props, {dataValue: this.dataTypedValue}, "", {});
    }
    if (this.fieldDescribe) {
      addProperties(props, this.fieldDescribe, "desc.", {});
    }
    if (this.entityParticle) {
      addProperties(props, this.entityParticle, "part.", {});
    }
    if (this.fieldParticleMetadata) {
      addProperties(props, this.fieldParticleMetadata, "meta.", {});
    }
    if (this.detailLayoutInfo) {
      addProperties(props, this.detailLayoutInfo.indexes, "layout.", {});
      addProperties(props, this.detailLayoutInfo.section, "layoutSection.", {layoutRows: true});
      addProperties(props, this.detailLayoutInfo.row, "layoutRow.", {layoutItems: true});
      addProperties(props, this.detailLayoutInfo.item, "layoutItem.", {layoutComponents: true});
      addProperties(props, this.detailLayoutInfo.component, "layoutComponent.", {details: true, components: true});
    } else if (this.rowList.model.layoutInfo) {
      addProperties(props, {shownOnLayout: false}, "layout.", {});
    }
    if (this.editLayoutInfo) {
      addProperties(props, this.editLayoutInfo.indexes, "editLayout.", {});
      addProperties(props, this.editLayoutInfo.section, "editLayoutSection.", {layoutRows: true});
      addProperties(props, this.editLayoutInfo.row, "editLayoutRow.", {layoutItems: true});
      addProperties(props, this.editLayoutInfo.item, "editLayoutItem.", {layoutComponents: true});
      addProperties(props, this.editLayoutInfo.component, "editLayoutComponent.", {details: true, components: true});
    } else if (this.rowList.model.layoutInfo) {
      addProperties(props, {shownOnLayout: false}, "editLayout.", {});
    }
    return props;
  }
  dataStringValue() {
    return this.dataTypedValue == null ? "" : "" + this.dataTypedValue;
  }
  fieldLabel() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.label;
    }
    if (this.entityParticle) {
      return this.entityParticle.Label;
    }
    return undefined;
  }
  fieldHelptext() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.inlineHelpText;
    }
    if (this.entityParticle) {
      return this.entityParticle.InlineHelpText;
    }
    return undefined;
  }
  fieldDesc() {
    return this.fieldParticleMetadata && this.fieldParticleMetadata.Metadata.description;
  }
  fieldTypeDesc() {
    let fieldDescribe = this.fieldDescribe;
    if (fieldDescribe) {
      return fieldDescribe.type == "reference"
        ? "[" + fieldDescribe.referenceTo.join(", ") + "]"
        : (fieldDescribe.type || "")
        + (fieldDescribe.length ? " (" + fieldDescribe.length + ")" : "")
        + (fieldDescribe.precision || fieldDescribe.scale ? " (" + fieldDescribe.precision + ", " + fieldDescribe.scale + ")" : "")
        + (fieldDescribe.autoNumber ? ", auto number" : "")
        + (fieldDescribe.caseSensitive ? ", case sensitive" : "")
        + (fieldDescribe.dependentPicklist ? ", dependent" : "")
        + (fieldDescribe.encrypted ? ", encrypted" : "")
        + (fieldDescribe.externalId ? ", external id" : "")
        + (fieldDescribe.htmlFormatted ? ", html" : "")
        + (!fieldDescribe.nillable ? ", required" : "")
        + (fieldDescribe.restrictedPicklist ? ", restricted" : "")
        + (fieldDescribe.unique ? ", unique" : "")
        + (fieldDescribe.calculated ? "*" : "");
    }
    let particle = this.entityParticle;
    if (particle) {
      return particle.DataType == "reference" && particle.ReferenceTo.referenceTo
        ? "[" + particle.ReferenceTo.referenceTo.join(", ") + "]"
        : (particle.DataType || "")
        + (particle.Length ? " (" + particle.Length + ")" : "")
        + (particle.Precision || particle.Scale ? " (" + particle.Precision + ", " + particle.Scale + ")" : "")
        + (particle.IsAutonumber ? ", auto number" : "")
        + (particle.IsCaseSensitive ? ", case sensitive" : "")
        + (particle.IsDependentPicklist ? ", dependent" : "")
        + (particle.IsEncrypted ? ", encrypted" : "")
        + (particle.IsIdLookup ? ", external id" : "")
        + (particle.IsHtmlFormatted ? ", html" : "")
        + (!particle.IsNillable ? ", required" : "")
        + (particle.IsUnique ? ", unique" : "")
        + (particle.IsCalculated ? "*" : "");
    }
    return undefined;
  }
  referenceTypes() {
    let fieldDescribe = this.fieldDescribe;
    if (fieldDescribe) {
      return fieldDescribe.type == "reference" ? fieldDescribe.referenceTo : null;
    }
    let particle = this.entityParticle;
    if (particle) {
      return particle.DataType == "reference" ? particle.ReferenceTo.referenceTo : null;
    }
    return [];
  }
  fieldIsCalculated() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.calculated;
    }
    if (this.entityParticle) {
      return this.entityParticle.IsCalculated;
    }
    return false;
  }
  fieldIsHidden() {
    return !this.fieldDescribe;
  }
  toggleFieldActions() {
    this.fieldActionsOpen = !this.fieldActionsOpen;
    if (this.fieldActionsOpen && !this.fieldSetupLinksRequested) {
      this.fieldSetupLinksRequested = true;
      let isCustomSetting = this.rowList.model.objectData?.customSetting;
      this.rowList.model.spinFor(
        "getting field setup links for" + this.fieldName,
        getFieldSetupLinks(this.rowList.model.sfHost, this.rowList.model.objectName(), this.fieldName, isCustomSetting)
          .then(setupLinks => this.fieldSetupLinks = setupLinks)
      );
    }
  }
  showFieldMetadata() {
    this.rowList.model.showDetailsBox(this.fieldName, this.rowProperties(), this.rowList);
  }
  summary() {
    let fieldDescribe = this.fieldDescribe;
    if (fieldDescribe) {
      return this.fieldName + "\n"
        + (fieldDescribe.calculatedFormula ? "Formula: " + fieldDescribe.calculatedFormula + "\n" : "")
        + (fieldDescribe.inlineHelpText ? "Help text: " + fieldDescribe.inlineHelpText + "\n" : "")
        + (fieldDescribe.picklistValues && fieldDescribe.picklistValues.length > 0 ? "Picklist values: " + fieldDescribe.picklistValues.map(pickval => pickval.value).join(", ") + "\n" : "")
      ;
    }
    // Entity particle does not contain any of this information
    return this.fieldName + "\n(Details not available)";
  }
  isEditing() {
    return typeof this.dataEditValue == "string";
  }
  canEdit() {
    switch (this.rowList.model.editMode) {
      case "update":
      case null:
        return this.rowList.model.canUpdate() && this.fieldDescribe && this.fieldDescribe.updateable;
      case "create":
        return this.rowList.model.canCreate() && this.fieldDescribe && this.fieldDescribe.createable;
      default:
        return false;
    }
  }
  tryEdit() {
    if (!this.isEditing() && this.canEdit()) {
      this.dataEditValue = this.dataStringValue();
      if (this.rowList.model.editMode == null) {
        this.rowList.model.editMode = "update";
      }
      return true;
    }
    return false;
  }
  saveDataValue(recordData) {
    if (this.isEditing()) {
      if (this.dataEditValue == "") {
        if (this.rowList.model.editMode != "create") {
          recordData[this.fieldDescribe.name] = null;
        }
      } else {
        recordData[this.fieldDescribe.name] = this.dataEditValue;
      }
    }
  }
  isId() {
    if (this.fieldDescribe) {
      return this.fieldDescribe.type == "reference" && !!this.dataTypedValue;
    }
    if (this.entityParticle) {
      return this.entityParticle.DataType == "reference" && !!this.dataTypedValue;
    }
    return false;
  }
  idLink() {
    return "https://" + this.rowList.model.sfHost + "/" + this.dataTypedValue;
  }
  toggleRecordIdPop() {
    if (this.recordIdPop) {
      this.recordIdPop = null;
      return;
    }
    let recordId = this.dataTypedValue;
    let keyPrefix = recordId.substring(0, 3);
    let links;
    if (this.rowList.model.globalDescribe) {
      links = this.rowList.model.globalDescribe.sobjects
        .filter(sobject => sobject.keyPrefix == keyPrefix)
        .map(sobject => {
          let args = new URLSearchParams();
          args.set("host", this.rowList.model.sfHost);
          args.set("objectType", sobject.name);
          if (this.rowList.model.useToolingApi) {
            args.set("useToolingApi", "1");
          }
          args.set("recordId", recordId);
          return {href: "inspect.html?" + args, text: "Show all data (" + sobject.name + ")"};
        });
    } else {
      links = [];
    }
    links.push({href: this.idLink(), text: "View in Salesforce"});
    links.push({href: "#", text: "Copy Id", className: "copy-id", id: this.dataTypedValue});
    this.recordIdPop = links;
  }
  showReferenceUrl(type) {
    let args = new URLSearchParams();
    args.set("host", this.rowList.model.sfHost);
    args.set("objectType", type);
    if (this.rowList.model.useToolingApi) {
      args.set("useToolingApi", "1");
    }
    return "inspect.html?" + args;
  }
  sortKey(col) {
    switch (col) {
      case "name": return this.fieldName;
      case "label": return this.fieldLabel();
      case "helptext": return this.fieldHelptext();
      case "desc": return this.fieldDesc();
      case "value": return this.dataTypedValue;
      case "type": return this.fieldTypeDesc();
      default: return this.rowProperties()[col];
    }
  }
  showFieldDescription() {
    if (!this.entityParticle || !this.entityParticle.FieldDefinition) {
      return;
    }
    this.rowList.model.spinFor(
      "getting field definition metadata for " + this.fieldName,
      sfConn.rest("/services/data/v" + apiVersion + "/tooling/query/?q=" + encodeURIComponent("select Metadata from FieldDefinition where DurableId = '" + this.entityParticle.FieldDefinition.DurableId + "'")).then(fieldDefs => {
        this.fieldParticleMetadata = fieldDefs.records[0];
      })
    );
  }
}

class ChildRow extends TableRow {
  constructor(childName, reactKey, rowList) {
    super();
    this.rowList = rowList;
    this.childName = childName;
    this.reactKey = reactKey;
    this.childDescribe = undefined;
    this.relatedListInfo = undefined;
    this.childActionsOpen = false;
    this.childSetupLinks = null;
    this.childSetupLinksRequested = false;
  }
  rowProperties() {
    let props = {};
    if (this.childDescribe) {
      addProperties(props, this.childDescribe, "child.", {});
    }
    if (this.relatedListInfo) {
      addProperties(props, this.relatedListInfo, "layout.", {});
    } else if (this.rowList.model.layoutInfo) {
      addProperties(props, {shownOnLayout: false}, "layout.", {});
    }
    return props;
  }
  childObject() {
    if (this.childDescribe) {
      return this.childDescribe.childSObject;
    }
    if (this.relatedListInfo) {
      return this.relatedListInfo.relatedList.sobject;
    }
    return undefined;
  }
  childField() {
    if (this.childDescribe) {
      return this.childDescribe.field;
    }
    if (this.relatedListInfo) {
      return this.relatedListInfo.relatedList.field;
    }
    return undefined;
  }
  childLabel() {
    if (this.relatedListInfo) {
      return this.relatedListInfo.relatedList.label;
    }
    return undefined;
  }
  sortKey(col) {
    switch (col) {
      case "name": return this.childName;
      case "object": return this.childObject();
      case "field": return this.childField();
      case "label": return this.childLabel();
      default: return this.rowProperties()[col];
    }
  }
  showChildObjectUrl() {
    let childDescribe = this.childDescribe;
    if (childDescribe) {
      let args = new URLSearchParams();
      args.set("host", this.rowList.model.sfHost);
      args.set("objectType", childDescribe.childSObject);
      if (this.rowList.model.useToolingApi) {
        args.set("useToolingApi", "1");
      }
      return "inspect.html?" + args;
    }
    return "";
  }
  toggleChildActions() {
    this.childActionsOpen = !this.childActionsOpen;
    if (this.childActionsOpen && !this.childSetupLinksRequested) {
      this.childSetupLinksRequested = true;
      let sobjectName = (this.childDescribe && this.childDescribe.childSObject) || (this.relatedListInfo && this.relatedListInfo.relatedList.sobject);
      let fieldName = (this.childDescribe && this.childDescribe.field) || (this.relatedListInfo && this.relatedListInfo.relatedList.field);
      let isCustomSetting = this.rowList.model.objectData?.customSetting;
      this.rowList.model.spinFor(
        "getting relationship setup links for " + this.childName,
        getFieldSetupLinks(this.rowList.model.sfHost, sobjectName, fieldName, isCustomSetting)
          .then(setupLinks => this.childSetupLinks = setupLinks)
      );
    }
  }
  showChildMetadata() {
    this.rowList.model.showDetailsBox(this.childName, this.rowProperties(), this.rowList);
  }
  summary() {
    return undefined;
  }
  queryListUrl() {
    let record = this.rowList.model.recordData;
    if (!record || !record.Id) {
      return "";
    }
    let relatedListInfo = this.relatedListInfo;
    if (relatedListInfo) {
      return this.rowList.model.dataExportUrl("select Id, " + relatedListInfo.relatedList.columns.map(c => c.name).join(", ") + " from " + relatedListInfo.relatedList.sobject + " where " + relatedListInfo.relatedList.field + " = '" + record.Id + "'");
    }
    let childDescribe = this.childDescribe;
    if (childDescribe) {
      return this.rowList.model.dataExportUrl("select Id from " + childDescribe.childSObject + " where " + childDescribe.field + " = '" + record.Id + "'");
    }
    return "";
  }
}

function addProperties(map, object, prefix, ignore) {
  for (let key in object) {
    let value = object[key];
    if (ignore[key]) {
      // empty
    } else if (value && typeof value == "object") {
      addProperties(map, value, prefix + key + ".", {});
    } else {
      map[prefix + key] = value;
    }
  }
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onUseAllTab = this.onUseAllTab.bind(this);
    this.onUseFieldsTab = this.onUseFieldsTab.bind(this);
    this.onUseChildsTab = this.onUseChildsTab.bind(this);
    this.onRowsFilterInput = this.onRowsFilterInput.bind(this);
    this.onClearAndFocusFilter = this.onClearAndFocusFilter.bind(this);
    this.onShowObjectMetadata = this.onShowObjectMetadata.bind(this);
    this.onToggleObjectActions = this.onToggleObjectActions.bind(this);
    this.onDoUpdate = this.onDoUpdate.bind(this);
    this.onDoDelete = this.onDoDelete.bind(this);
    this.onDoCreate = this.onDoCreate.bind(this);
    this.onDoSave = this.onDoSave.bind(this);
    this.onCancelEdit = this.onCancelEdit.bind(this);
    this.onUpdateTableBorderSettings = this.onUpdateTableBorderSettings.bind(this);
  }
  componentDidMount() {
    this.refs.rowsFilter.focus();
  }
  onUseAllTab(e) {
    let {model} = this.props;
    e.preventDefault();
    model.useTab = "all";
    model.didUpdate();
  }
  onUseFieldsTab(e) {
    let {model} = this.props;
    e.preventDefault();
    model.useTab = "fields";
    model.didUpdate();
  }
  onUseChildsTab(e) {
    let {model} = this.props;
    e.preventDefault();
    model.useTab = "childs";
    model.didUpdate();
  }
  onRowsFilterInput(e) {
    let {model} = this.props;
    model.rowsFilter = e.target.value;
    model.didUpdate();
  }
  onClearAndFocusFilter(e) {
    e.preventDefault();
    let {model} = this.props;
    model.rowsFilter = "";
    this.refs.rowsFilter.focus();
    model.didUpdate();
  }
  onShowObjectMetadata(e) {
    e.preventDefault();
    let {model} = this.props;
    model.showObjectMetadata();
    model.didUpdate();
  }
  onToggleObjectActions() {
    let {model} = this.props;
    model.toggleObjectActions();
    model.didUpdate();
  }
  onDoUpdate(e) {
    e.currentTarget.disabled = true;
    let {model} = this.props;
    model.doUpdate();
    model.didUpdate();
    e.currentTarget.disabled = false;
  }
  onDoDelete(e) {
    e.currentTarget.disabled = true;
    let {model} = this.props;
    model.doDelete();
    model.didUpdate();
    e.currentTarget.disabled = false;
  }
  onDoCreate(e) {
    e.currentTarget.disabled = true;
    let {model} = this.props;
    model.doCreate();
    model.didUpdate();
    e.currentTarget.disabled = false;
  }
  onDoSave(e) {
    e.currentTarget.disabled = true;
    let {model} = this.props;
    model.doSave();
    model.didUpdate();
    e.currentTarget.disabled = false;
  }
  onCancelEdit() {
    let {model} = this.props;
    model.cancelEdit();
    model.didUpdate();
  }
  onUpdateTableBorderSettings() {
    let {model} = this.props;
    model.updateShowTableBorder();
    model.reloadTables();
    model.didUpdate();
    // Save to local storage
  }
  render() {
    let {model} = this.props;
    document.title = model.title();
    let linkInNewTab = localStorage.getItem("openLinksInNewTab");
    let linkTarget = linkInNewTab ? "_blank" : "_top";
    return (
      h("div", {},
        h("div", {className: "object-bar"},
          h("div", {className: "flex-right"},
            h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_large", hidden: model.spinnerCount == 0},
              h("span", {className: "slds-assistive-text"}),
              h("div", {className: "slds-spinner__dot-a"}),
              h("div", {className: "slds-spinner__dot-b"}),
            )
          ),
          h("a", {href: model.sfLink, target: linkTarget, className: "sf-link"},
            h("svg", {viewBox: "0 0 24 24"},
              h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          h("span", {className: "object-tab" + (model.useTab == "all" ? " active-tab" : "")},
            h("a", {href: "about:blank", onClick: this.onUseAllTab}, "All")
          ),
          h("span", {className: "object-tab" + (model.useTab == "fields" ? " active-tab" : "")},
            h("a", {href: "about:blank", className: "tab-with-icon", onClick: this.onUseFieldsTab}, "Fields"),
            h(ColumnsVisibiltyBox, {
              rowList: model.fieldRows,
              label: "Field columns",
              content: () => [
                h(ColumnVisibiltyToggle, {rowList: model.fieldRows, key: "name", name: "name", disabled: true}),
                h(ColumnVisibiltyToggle, {rowList: model.fieldRows, key: "label", name: "label"}),
                h(ColumnVisibiltyToggle, {rowList: model.fieldRows, key: "type", name: "type"}),
                h(ColumnVisibiltyToggle, {rowList: model.fieldRows, key: "value", name: "value", disabled: !model.canView()}),
                h(ColumnVisibiltyToggle, {rowList: model.fieldRows, key: "helptext", name: "helptext"}),
                h(ColumnVisibiltyToggle, {rowList: model.fieldRows, key: "desc", name: "desc", disabled: !model.hasEntityParticles}),
                h("hr", {key: "---"}),
                model.fieldRows.availableColumns.map(col => h(ColumnVisibiltyToggle, {key: col, name: col, label: col, rowList: model.fieldRows}))
              ]
            })
          ),
          h("span", {className: "object-tab" + (model.useTab == "childs" ? " active-tab" : "")},
            h("a", {href: "about:blank", className: "tab-with-icon", onClick: this.onUseChildsTab}, "Relations"),
            h(ColumnsVisibiltyBox, {
              rowList: model.childRows,
              label: "Relationship columns",
              content: () => [
                ["name", "object", "field", "label"].map(col => h(ColumnVisibiltyToggle, {key: col, rowList: model.childRows, name: col})),
                h("hr", {key: "---"}),
                model.childRows.availableColumns.map(col => h(ColumnVisibiltyToggle, {key: col, rowList: model.childRows, name: col}))
              ]
            })
          ),
          h("div", {className: "object-name"},
            h("span", {className: "quick-select"}, model.objectName()),
            " ",
            model.recordHeading()
          ),
          model.useTab != "all" ? null : h("div", {className: "filter-box"},
            h("svg", {className: "filter-icon"},
              h("use", {xlinkHref: "symbols.svg#search"})
            ),
            h("input", {className: "filter-input", placeholder: "Filter", value: model.rowsFilter, onChange: this.onRowsFilterInput, ref: "rowsFilter"}),
            h("a", {href: "about:blank", className: "filter-clear", onClick: this.onClearAndFocusFilter},
              h("svg", {className: "filter-clear-icon"},
                h("use", {xlinkHref: "symbols.svg#clear"})
              )
            )
          ),
          h("span", {className: "object-actions"},
            model.editMode == null && model.recordData && (model.useTab == "all" || model.useTab == "fields") ? h("button", {
              title: "Inline edit the values of this record",
              className: "button",
              disabled: !model.canUpdate(),
              onClick: this.onDoUpdate
            }, "Edit") : null,
            model.editMode == null && model.recordData && (model.useTab == "all" || model.useTab == "fields") ? h("button", {
              title: "Delete this record",
              className: "button",
              disabled: !model.canDelete(),
              onClick: this.onDoDelete
            }, "Delete") : null,
            model.editMode == null && (model.useTab == "all" || model.useTab == "fields") ? h("button", {
              title: model.recordData ? "Inline edit the values of this record to be saved as a new cloned record" : "Inline create a new record",
              className: "button",
              disabled: !model.canCreate(),
              onClick: this.onDoCreate
            }, model.recordData ? "Clone" : "New") : null,
            model.exportLink() ? h("a", {href: model.exportLink(), target: linkTarget, title: "Export data from this object", className: "button"}, "Export") : null,
            model.objectName() ? h("a", {href: "about:blank", onClick: this.onShowObjectMetadata, className: "button"}, "More") : null,
            h("button", {className: "button", onClick: this.onToggleObjectActions},
              h("svg", {className: "button-icon"},
                h("use", {xlinkHref: "symbols.svg#down"})
              )
            ),
            model.objectActionsOpen && h("div", {className: "pop-menu"},
              model.viewLink() ? h("a", {href: model.viewLink()}, "View record in Salesforce") : null,
              model.editLayoutLink() ? h("a", {href: model.editLayoutLink(), target: linkTarget}, "Edit page layout") : null,
              model.objectSetupLinks && h("a", {href: model.objectSetupLinks.lightningSetupLink, target: linkTarget}, "Object setup (Lightning)"),
              model.objectSetupLinks && h("a", {href: model.objectSetupLinks.classicSetupLink, target: linkTarget}, "Object setup (Classic)")
            )
          )
        ),
        h("div", {className: "table-container " + (model.fieldRows.selectedColumnMap.size < 2 && model.childRows.selectedColumnMap.size < 2 ? "empty " : "")},
          h("div", {hidden: model.errorMessages.length == 0, className: "error-message"}, model.errorMessages.map((data, index) => h("div", {key: index}, data))),
          model.useTab == "all" || model.useTab == "fields" ? h(RowTable, {
            model,
            rowList: model.fieldRows,
            actionsColumn: {className: "field-actions" + (model.showTableBorder ? " border-cell" : ""), reactElement: FieldActionsCell},
            classNameForRow: row => (row.fieldIsCalculated() ? "fieldCalculated " : "") + (row.fieldIsHidden() ? "fieldHidden " : ""),
            onUpdateTableBorderSettings: this.onUpdateTableBorderSettings
          }) : null,
          model.useTab == "all" || model.useTab == "childs" ? h(RowTable, {
            model,
            rowList: model.childRows,
            actionsColumn: {className: "child-actions" + (model.showTableBorder ? " border-cell" : ""), reactElement: ChildActionsCell},
            classNameForRow: () => "",
            onUpdateTableBorderSettings: this.onUpdateTableBorderSettings
          }) : null
        ),
        model.editMode != null && (model.useTab == "all" || model.useTab == "fields") ? h("div", {className: "footer-edit-bar"}, h("span", {className: "edit-bar"},
          h("button", {
            title:
              model.editMode == "update" ? "Cancel editing this record"
              : model.editMode == "delete" ? "Cancel deleting this record"
              : model.editMode == "create" ? "Cancel creating this record"
              : null,
            className: "button",
            onClick: this.onCancelEdit
          }, "Cancel"),
          h("button", {
            name: "saveBtn",
            title:
              model.editMode == "update" ? "Save the values of this record"
              : model.editMode == "delete" ? "Delete this record"
              : model.editMode == "create" ? "Save the values as a new record"
              : null,
            className: "button " + (model.editMode == "delete" ? "button-destructive" : "button-brand"),
            disabled: model.spinnerCount != 0 ? true : false,
            onClick: this.onDoSave
          }, model.editMode == "update" ? "Save"
          : model.editMode == "delete" ? "Confirm delete"
          : model.editMode == "create" ? "Save new"
          : "???")
        )) : null,
        model.detailsBox ? h(DetailsBox, {model}) : null
      )
    );
  }
}

class ColumnsVisibiltyBox extends React.Component {
  constructor(props) {
    super(props);
    this.onAvailableColumnsClick = this.onAvailableColumnsClick.bind(this);
  }
  onAvailableColumnsClick(e) {
    e.preventDefault();
    let {rowList} = this.props;
    rowList.toggleAvailableColumns();
    rowList.model.didUpdate();
  }
  render() {
    let {rowList, label, content} = this.props;
    return h("span", {className: "column-button-outer"},
      h("a", {href: "about:blank", onClick: this.onAvailableColumnsClick, className: "button-icon-link"},
        h("svg", {className: "button-icon"},
          h("use", {xlinkHref: "symbols.svg#chevrondown"})
        )
      ),
      rowList.availableColumns ? h("div", {className: "column-popup"},
        h("div", {className: "column-popup-inner"},
          h("span", {className: "menu-item"}, label),
          content()
        )
      ) : null
    );
  }
}

class ColumnVisibiltyToggle extends React.Component {
  constructor(props) {
    super(props);
    this.onShowColumnChange = this.onShowColumnChange.bind(this);
  }
  onShowColumnChange(e) {
    let {rowList, name} = this.props;
    rowList.showHideColumn(e.target.checked, name);
    rowList.model.didUpdate();
  }
  render() {
    let {rowList, name, disabled} = this.props;
    return h("label", {className: "menu-item"},
      h("input", {
        type: "checkbox",
        checked: rowList.selectedColumnMap.has(name),
        onChange: this.onShowColumnChange,
        disabled
      }),
      rowList.createColumn(name).label
    );
  }
}

class RowTable extends React.Component {
  constructor(props) {
    super(props);
    this.onToggleTableSettings = this.onToggleTableSettings.bind(this);
    this.onClickTableBorderSettings = this.onClickTableBorderSettings.bind(this);
    this.showTableBorder = this.props.model.showTableBorder;
    this.tableSettingsOpen = false;
  }
  onToggleTableSettings() {
    this.state = {
      showOrHideBorders: localStorage.getItem("displayInspectTableBorders") === "true" ? "Hide table borders" : "Show table borders"
    };
    this.tableSettingsOpen = !this.tableSettingsOpen;
    this.props.model.didUpdate();
  }
  onClickTableBorderSettings() {
    this.setState({
      showOrHideBorders: localStorage.getItem("displayInspectTableBorders") === "false" ? "Show table borders" : "Hide table borders"
    });
    this.props.onUpdateTableBorderSettings();
    this.tableSettingsOpen = false;
  }
  render() {
    let {rowList, actionsColumn, classNameForRow} = this.props;
    let selectedColumns = Array.from(rowList.selectedColumnMap.values());
    return h("table", {},
      h("thead", {},
        h("tr", {},
          selectedColumns.map(col =>
            h(HeaderCell, {key: col.name, col, rowList})
          ),
          h("th", {className: actionsColumn.className, tabIndex: 0},
            h("button", {className: "table-settings-button", onClick: this.onToggleTableSettings},
              h("div", {className: "table-settings-icon"})
            ),
            this.tableSettingsOpen && h("div", {className: "pop-menu-container"},
              h("div", {className: "pop-menu"},
                h("a", {className: "table-settings-link", onClick: this.onClickTableBorderSettings}, this.state.showOrHideBorders),
              )
            ),
          ),
        ),
        rowList.model.useTab != "all" ? h("tr", {},
          selectedColumns.map(col =>
            h(FilterCell, {key: col.name, col, rowList})
          ),
          h("th", {className: actionsColumn.className + " " + "th-filter-row"})
        ) : null
      ),
      h("tbody", {}, rowList.rows.map(row =>
        h("tr", {className: classNameForRow(row), hidden: !row.visible(), title: row.summary(), key: row.reactKey},
          selectedColumns.map(col =>
            h(col.reactElement, {key: col.name, row, col})
          ),
          h(actionsColumn.reactElement, {className: actionsColumn.className, row})
        )
      ))
    );
  }
}

class HeaderCell extends React.Component {
  constructor(props) {
    super(props);
    this.onSortRowsBy = this.onSortRowsBy.bind(this);
  }
  onSortRowsBy() {
    let {rowList, col} = this.props;
    rowList.sortRowsBy(col.name);
    rowList.model.didUpdate();
  }
  render() {
    let {col} = this.props;
    return h("th",
      {
        className: col.className,
        tabIndex: 0,
        onClick: this.onSortRowsBy
      },
      col.label
    );
  }
}

class FilterCell extends React.Component {
  constructor(props) {
    super(props);
    this.onColumnFilterInput = this.onColumnFilterInput.bind(this);
  }
  onColumnFilterInput(e) {
    let {rowList, col} = this.props;
    col.columnFilter = e.target.value;
    rowList.model.didUpdate();
  }
  render() {
    let {col} = this.props;
    return h("th", {className: col.className + " " + "th-filter-row"},
      h("input", {
        placeholder: "Filter",
        className: "column-filter-box",
        value: col.columnFilter,
        onChange: this.onColumnFilterInput
      })
    );
  }
}

class DefaultCell extends React.Component {
  render() {
    let {row, col} = this.props;
    return h("td", {className: col.className},
      h(TypedValue, {value: row.sortKey(col.name)})
    );
  }
}

class FieldValueCell extends React.Component {
  constructor(props) {
    super(props);
    this.onTryEdit = this.onTryEdit.bind(this);
    this.onDataEditValueInput = this.onDataEditValueInput.bind(this);
    this.onCancelEdit = this.onCancelEdit.bind(this);
    this.onRecordIdClick = this.onRecordIdClick.bind(this);
    this.onLinkClick = this.onLinkClick.bind(this);
  }
  onTryEdit(e) {
    let {row} = this.props;
    if (row.tryEdit()) {
      let td = e.currentTarget;
      row.rowList.model.didUpdate(() => td.querySelector("textarea").focus());
    }
  }
  onDataEditValueInput(e) {
    let {row} = this.props;
    row.dataEditValue = e.target.value;
    row.rowList.model.didUpdate();
  }
  onCancelEdit(e) {
    e.preventDefault();
    let {row} = this.props;
    row.dataEditValue = null;
    row.rowList.model.didUpdate();
  }
  onRecordIdClick(e) {
    e.preventDefault();
    let {row} = this.props;
    row.toggleRecordIdPop();
    row.rowList.model.didUpdate();
  }
  onLinkClick(e) {
    if (e.target.className?.includes("copy-id")) {
      navigator.clipboard.writeText(e.target.id);
      this.onRecordIdClick(e);
    }
  }
  render() {
    let {row, col} = this.props;
    if (row.isEditing()) {
      return h("td", {className: col.className},
        h("textarea", {value: row.dataEditValue, onChange: this.onDataEditValueInput}),
        h("a", {href: "about:blank", onClick: this.onCancelEdit, className: "undo-button"}, "\u21B6")
      );
    } else if (row.isId()) {
      return h("td", {className: col.className, onDoubleClick: this.onTryEdit},
        h("div", {className: "pop-menu-container"},
          h("div", {className: "value-text quick-select"}, h("a", {href: row.idLink() /*used to show visited color*/, onClick: this.onRecordIdClick}, row.dataStringValue())),
          row.recordIdPop == null ? null : h("div", {className: "pop-menu"}, row.recordIdPop.map(link => h("a", {key: link.href, href: link.href, className: link.className, id: link.id, onClick: this.onLinkClick}, link.text)))
        )
      );
    } else {
      return h("td", {className: col.className, onDoubleClick: this.onTryEdit},
        h(TypedValue, {value: row.sortKey(col.name)})
      );
    }
  }
}

class FieldTypeCell extends React.Component {
  render() {
    let {row, col} = this.props;
    return h("td", {className: col.className + " quick-select"},
      row.referenceTypes() ? row.referenceTypes().map(data =>
        h("span", {key: data}, h("a", {href: row.showReferenceUrl(data)}, data), " ")
      ) : null,
      !row.referenceTypes() ? h(TypedValue, {value: row.sortKey(col.name)}) : null
    );
  }
}

class ChildObjectCell extends React.Component {
  render() {
    let {row, col} = this.props;
    return h("td", {className: col.className + " quick-select", key: col.name},
      h("a", {href: row.showChildObjectUrl()}, row.childObject())
    );
  }
}

let TypedValue = props =>
  h("div", {
    className:
      "value-text "
      + (typeof props.value == "string" ? "value-is-string " : "")
      + (typeof props.value == "number" ? "value-is-number " : "")
      + (typeof props.value == "boolean" ? "value-is-boolean " : "")
      + (typeof props.value == "object" ? "value-is-object " : "")
      + (props.value === undefined ? "value-is-unknown " : "")
      + (props.value === null ? "value-is-blank " : "")
      + (props.value === true ? "value-is-boolean-true " : "")
      + (props.value === undefined || props.value === null ? "" : "quick-select ")
  },
  props.value === undefined ? "(Unknown)"
  : props.value === null ? "(Blank)"
  : typeof props.value == "object" ? JSON.stringify(props.value, null, "  ")
  : "" + props.value
  );

class FieldActionsCell extends React.Component {
  constructor(props) {
    super(props);
    this.onOpenDetails = this.onOpenDetails.bind(this);
    this.onToggleFieldActions = this.onToggleFieldActions.bind(this);
  }
  onOpenDetails(e) {
    e.preventDefault();
    let {row} = this.props;
    row.showFieldMetadata();
    row.rowList.model.didUpdate();
  }
  onToggleFieldActions() {
    let {row} = this.props;
    row.toggleFieldActions();
    row.rowList.model.didUpdate();
  }
  render() {
    let {row, className} = this.props;
    return h("td", {className},
      h("div", {className: "pop-menu-container"},
        h("button", {className: "actions-button", onClick: this.onToggleFieldActions},
          h("svg", {className: "actions-icon"},
            h("use", {xlinkHref: "symbols.svg#down"})
          ),
        ),
        row.fieldActionsOpen && h("div", {className: "pop-menu"},
          h("a", {href: "about:blank", onClick: this.onOpenDetails}, "All field metadata"),
          row.fieldSetupLinks && h("a", {href: row.fieldSetupLinks.lightningSetupLink}, "Field setup (Lightning)"),
          row.fieldSetupLinks && h("a", {href: row.fieldSetupLinks.classicSetupLink}, "Field setup (Classic)")
        )
      )
    );
  }
}

class ChildActionsCell extends React.Component {
  constructor(props) {
    super(props);
    this.onOpenDetails = this.onOpenDetails.bind(this);
    this.onToggleChildActions = this.onToggleChildActions.bind(this);
  }
  onOpenDetails(e) {
    e.preventDefault();
    let {row} = this.props;
    row.showChildMetadata();
    row.rowList.model.didUpdate();
  }
  onToggleChildActions() {
    let {row} = this.props;
    row.toggleChildActions();
    row.rowList.model.didUpdate();
  }
  render() {
    let {row, className} = this.props;
    return h("td", {className},
      h("div", {className: "pop-menu-container"},
        h("button", {className: "actions-button", onClick: this.onToggleChildActions},
          h("svg", {className: "actions-icon"},
            h("use", {xlinkHref: "symbols.svg#down"})
          ),
        ),
        row.childActionsOpen && h("div", {className: "pop-menu"},
          h("a", {href: "about:blank", onClick: this.onOpenDetails}, "All relationship metadata"),
          row.queryListUrl() ? h("a", {href: row.queryListUrl(), title: "Export records in this related list"}, "Export related records") : null,
          row.childSetupLinks && h("a", {href: row.childSetupLinks.lightningSetupLink}, "Setup (Lightning)"),
          row.childSetupLinks && h("a", {href: row.childSetupLinks.classicSetupLink}, "Setup (Classic)")
        )
      )
    );
  }
}

class DetailsBox extends React.Component {
  constructor(props) {
    super(props);
    this.onCloseDetailsBox = this.onCloseDetailsBox.bind(this);
    this.onDetailsFilterInput = this.onDetailsFilterInput.bind(this);
    this.onDetailsFilterClick = this.onDetailsFilterClick.bind(this);
  }
  componentDidMount() {
    this.refs.detailsFilter.focus();
  }
  onCloseDetailsBox(e) {
    e.preventDefault();
    let {model} = this.props;
    model.detailsBox = null;
    model.didUpdate();
  }
  onDetailsFilterInput(e) {
    let {model} = this.props;
    model.detailsFilter = e.target.value;
    model.didUpdate();
  }
  onDetailsFilterClick(e, row, detailsFilterList) {
    e.preventDefault();
    let {model} = this.props;
    model.detailsBox = null;
    detailsFilterList.showColumn(row.key, row.value);
    model.didUpdate();
  }
  render() {
    let {model} = this.props;
    return h("div", {},
      h("div", {id: "fieldDetailsView"},
        h("div", {className: "container"},
          h("a", {href: "about:blank", className: "closeLnk", onClick: this.onCloseDetailsBox}, "X"),
          h("div", {className: "mainContent"},
            h("h3", {}, "All available metadata for \"" + model.detailsBox.name + "\""),
            h("input", {placeholder: "Filter", value: model.detailsFilter, onChange: this.onDetailsFilterInput, ref: "detailsFilter"}),
            h("table", {},
              h("thead", {}, h("tr", {}, h("th", {}, "Key"), h("th", {}, "Value"))),
              h("tbody", {}, model.detailsBox.rows.map(row =>
                h("tr", {hidden: !row.visible(), key: row.key},
                  h("td", {},
                    h("a", {href: "about:blank", onClick: e => this.onDetailsFilterClick(e, row, model.detailsBox.detailsFilterList), hidden: !model.detailsBox.detailsFilterList, title: "Show fields with this property"}, "🔍"),
                    " ",
                    h("span", {className: "quick-select"}, row.key)
                  ),
                  h("td", {}, h(TypedValue, {value: row.value}))
                )
              ))
            )
          )
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
    model.sobjectName = args.get("objectType");
    model.useToolingApi = args.has("useToolingApi");
    model.recordId = args.get("recordId");
    model.startLoading();
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

  });

}

{
  let isDragging = false;
  document.body.onmousedown = () => {
    isDragging = false;
  };
  document.body.onmousemove = e => {
    if (e.movementX || e.movementY) {
      isDragging = true;
    }
  };
  document.body.onclick = e => {
    if (!e.target.closest("a") && !isDragging) {
      let el = e.target.closest(".quick-select");
      if (el) {
        getSelection().selectAllChildren(el);
      }
    }
  };
}
