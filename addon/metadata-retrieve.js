/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */


class Model {
  constructor(sfHost) {
    this.reactCallback = null;

    // Raw fetched data
    this.globalDescribe = null;
    this.sobjectDescribePromise = null;
    this.objectData = null;
    this.recordData = null;
    this.layoutInfo = null;

    // Processed data and UI state
    this.sfLink = "https://" + sfHost;
    this.logMessages = [];
    this.progress = "ready";
    this.downloadLink = null;
    this.statusLink = null;
    this.metadataObjects = null;
    this.searchValue = "";
    this.filteredMetadataObjects = null;
    this.selectAll = null;
    this.downloadAuto = false;
  }
  /**
   * Notify React that we changed something, so it will rerender the view.
   * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
   * All event listeners (functions starting with "on") should call this function if they update the model.
   * Asynchronous operations should use the spinFor function, which will call this function after calling its callback.
   * Other functions should not call this function, since they are called by a function that does.
   * @param cb A function to be called once React has processed the update.
   */
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }

  setSelectAll(selec) {
    this.selectAll = selec;
  }

  title() {
    if (this.progress == "working") {
      return "(Loading) Download Metadata";
    }
    return "Download Metadata";
  }

  async batchHandler(batch, options) {
    let self = this;
    return batch.catch(err => {
      if (err.name == "AbortError") {
        return {records: [], done: true, totalSize: -1};
      }
      throw err;
    }).then(data => {
      options.rows = options.rows.concat(data.records);
      if (!data.done) {
        let pr = this.batchHandler(sfConn.rest(data.nextRecordsUrl, {}), options);
        return pr;
      }
      return null;
    }, err => {
      if (err.name != "SalesforceRestError") {
        throw err; // not a SalesforceRestError
      }
      self.logError(err);
      return null;
    });
  }

  csvSerialize(table, separator) {
    return table.map(row => row.map(text => "\"" + ("" + (text == null ? "" : text)).split("\"").join("\"\"") + "\"").join(separator)).join("\r\n");
  }
  async downloadDataModel() {
    this.progress = "working";
    let query = "SELECT QualifiedApiName FROM EntityDefinition ORDER BY QualifiedApiName";
    let result = {rows: []};
    this.didUpdate();
    await this.batchHandler(sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(query), {}), result)
      .catch(error => {
        self.logError(error);
      });
    let fieldsFesult = {rows: []};
    query = "SELECT Id, DeveloperName, QualifiedApiName, EntityDefinition.QualifiedApiName, DataType, Length, Precision, NamespacePrefix, IsCalculated, IsHighScaleNumber, IsHtmlFormatted, IsNameField, IsNillable, IsWorkflowFilterable, IsCompactLayoutable, IsFieldHistoryTracked, IsIndexed, IsApiFilterable, IsApiSortable, IsListFilterable, IsListSortable, IsApiGroupable, IsListVisible, PublisherId, IsCompound, IsSearchPrefilterable, IsPolymorphicForeignKey, IsAiPredictionField, Description, ExtraTypeInfo, Label FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName in ([RANGE])";
    for (let index = 0; index < result.rows.length; index += 50) {
      let entityNames = result.rows.slice(index, index + 50).map(e => "'" + e.QualifiedApiName + "'");
      await this.batchHandler(sfConn.rest("/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(query.replace("[RANGE]", entityNames.join(", "))), {}), fieldsFesult)
        .catch(error => {
          self.logError(error);
        });
    }
    let separator = ",";
    if (localStorage.getItem("csvSeparator")) {
      separator = localStorage.getItem("csvSeparator");
    }
    let downloadLink = document.createElement("a");
    downloadLink.download = "datamodel.csv";
    let BOM = "\uFEFF";
    let rt = new RecordTable();
    rt.addToTable(fieldsFesult.rows);
    let bb = new Blob([BOM, this.csvSerialize(rt.table, separator)], {type: "text/csv;charset=utf-8"});
    downloadLink.href = window.URL.createObjectURL(bb);
    downloadLink.click();
    this.progress = "done";
    this.didUpdate();
  }

  filterMetadata(searchKeyword) {
    this.searchValue = searchKeyword;
    this.filteredMetadataObjects = this.metadataObjects
      .filter(metadataObject => metadataObject.xmlName.toLowerCase().includes(searchKeyword)
      || metadataObject.directoryName.toLowerCase().includes(searchKeyword));
  }

  startLoading() {
    let logWait = this.logWait.bind(this);
    (async () => {
      try {
        this.progress = "working";
        this.didUpdate();

        // Code below is originally from forcecmd
        let metadataApi = sfConn.wsdl(apiVersion, "Metadata");
        let res = await logWait(
          "DescribeMetadata",
          sfConn.soap(metadataApi, "describeMetadata", {apiVersion})
        );
        let availableMetadataObjects = res.metadataObjects
          .filter(metadataObject => metadataObject.xmlName != "InstalledPackage");
        // End of forcecmd code
        this.metadataObjects = availableMetadataObjects;
        this.filteredMetadataObjects = availableMetadataObjects;
        for (let metadataObject of this.metadataObjects) {
          metadataObject.selected = true;
        }
        this.progress = "ready";
        this.didUpdate();
      } catch (e) {
        this.logError(e);
      }
    })();
  }

  startDownloading() {
    let logMsg = msg => {
      this.logMessages.push({level: "info", text: msg});
      this.didUpdate();
    };
    let logWait = this.logWait.bind(this);
    (async () => {
      function flattenArray(x) {
        return [].concat(...x);
      }

      function groupByThree(list) {
        let groups = [];
        for (let element of list) {
          if (groups.length == 0 || groups[groups.length - 1].length == 3) {
            groups.push([]);
          }
          groups[groups.length - 1].push(element);
        }
        return groups;
      }

      try {
        let metadataObjects = this.metadataObjects;
        //this.metadataObjects = null;
        //this.filteredMetadataObjects = null;
        this.progress = "working";
        this.downloadLink = null;
        this.statusLink = null;
        this.didUpdate();

        let metadataApi = sfConn.wsdl(apiVersion, "Metadata");
        let res;
        let selectedMetadataObjects = metadataObjects
          .filter(metadataObject => metadataObject.selected);
        // Code below is originally from forcecmd
        let folderMap = {};
        let x = selectedMetadataObjects
          .map(metadataObject => {
            let xmlNames = sfConn.asArray(metadataObject.childXmlNames).concat(metadataObject.xmlName);
            return xmlNames.map(xmlName => {
              if (metadataObject.inFolder == "true") {
                if (xmlName == "EmailTemplate") {
                  folderMap["EmailFolder"] = "EmailTemplate";
                  xmlName = "EmailFolder";
                } else {
                  folderMap[xmlName + "Folder"] = xmlName;
                  xmlName = xmlName + "Folder";
                }
              }
              return xmlName;
            });
          });
        res = await Promise.all(groupByThree(flattenArray(x)).map(async xmlNames => {
          let someItems = sfConn.asArray(await logWait(
            "ListMetadata " + xmlNames.join(", "),
            sfConn.soap(metadataApi, "listMetadata", {queries: xmlNames.map(xmlName => ({type: xmlName}))})
          ));
          let folders = someItems.filter(folder => folderMap[folder.type]);
          let nonFolders = someItems.filter(folder => !folderMap[folder.type]);
          let p = await Promise
            .all(groupByThree(folders).map(async folderGroup =>
              sfConn.asArray(await logWait(
                "ListMetadata " + folderGroup.map(folder => folderMap[folder.type] + "/" + folder.fullName).join(", "),
                sfConn.soap(metadataApi, "listMetadata", {queries: folderGroup.map(folder => ({type: folderMap[folder.type], folder: folder.fullName}))})
              ))
            ));
          return flattenArray(p).concat(
            folders.map(folder => ({type: folderMap[folder.type], fullName: folder.fullName})),
            nonFolders,
            xmlNames.map(xmlName => ({type: xmlName, fullName: "*"}))
          );
        }));
        let types = flattenArray(res);
        if (types.filter(x => x.type == "StandardValueSet").map(x => x.fullName).join(",") == "*") {
          // We are using an API version that supports the StandardValueSet type, but it didn't list its contents.
          // https://success.salesforce.com/ideaView?id=0873A000000cMdrQAE
          // Here we hardcode the supported values as of Winter 17 / API version 38.
          types = types.concat([
            "AccountContactMultiRoles", "AccountContactRole", "AccountOwnership", "AccountRating", "AccountType", "AddressCountryCode", "AddressStateCode", "AssetStatus", "CampaignMemberStatus", "CampaignStatus", "CampaignType", "CaseContactRole", "CaseOrigin", "CasePriority", "CaseReason", "CaseStatus", "CaseType", "ContactRole", "ContractContactRole", "ContractStatus", "EntitlementType", "EventSubject", "EventType", "FiscalYearPeriodName", "FiscalYearPeriodPrefix", "FiscalYearQuarterName", "FiscalYearQuarterPrefix", "IdeaCategory1", "IdeaMultiCategory", "IdeaStatus", "IdeaThemeStatus", "Industry", "InvoiceStatus", "LeadSource", "LeadStatus", "OpportunityCompetitor", "OpportunityStage", "OpportunityType", "OrderStatus1", "OrderType", "PartnerRole", "Product2Family", "QuestionOrigin1", "QuickTextCategory", "QuickTextChannel", "QuoteStatus", "SalesTeamRole", "Salutation", "ServiceContractApprovalStatus", "SocialPostClassification", "SocialPostEngagementLevel", "SocialPostReviewedStatus", "SolutionStatus", "TaskPriority", "TaskStatus", "TaskSubject", "TaskType", "WorkOrderLineItemStatus", "WorkOrderPriority", "WorkOrderStatus"
          ].map(x => ({type: "StandardValueSet", fullName: x})));
        }
        types.sort((a, b) => {
          let ka = a.type + "~" + a.fullName;
          let kb = b.type + "~" + b.fullName;
          if (ka < kb) {
            return -1;
          }
          if (ka > kb) {
            return 1;
          }
          return 0;
        });
        types = types.map(x => ({name: x.type, members: decodeURIComponent(x.fullName)}));
        //console.log(types);
        let result = await logWait(
          "Retrieve",
          sfConn.soap(metadataApi, "retrieve", {retrieveRequest: {apiVersion, unpackaged: {types, version: apiVersion}}})
        );
        logMsg("(Id: " + result.id + ")");
        for (let interval = 2000; ;) {
          await logWait(
            "(Waiting)",
            timeout(interval)
          );
          res = await logWait(
            "CheckRetrieveStatus",
            sfConn.soap(metadataApi, "checkRetrieveStatus", {id: result.id})
          );
          if (res.done !== "false") {
            break;
          }
        }
        if (res.success != "true") {
          let err = new Error("Retrieve failed");
          err.result = res;
          throw err;
        }
        let statusJson = JSON.stringify({
          fileProperties: sfConn.asArray(res.fileProperties)
            .filter(fp => fp.id != "000000000000000AAA" || fp.fullName != "")
            .sort((fp1, fp2) => fp1.fileName < fp2.fileName ? -1 : fp1.fileName > fp2.fileName ? 1 : 0),
          messages: res.messages
        }, null, "    ");
        //console.log("(Reading response and writing files)");
        // End of forcecmd code
        logMsg("(Finished)");
        let zipBin = Uint8Array.from(atob(res.zipFile), c => c.charCodeAt(0));
        this.downloadLink = URL.createObjectURL(new Blob([zipBin], {type: "application/zip"}));
        this.statusLink = URL.createObjectURL(new Blob([statusJson], {type: "application/json"}));
        if (this.downloadAuto) {
          let downloadATag = document.createElement("a");
          downloadATag.download = "metadata.csv";
          downloadATag.href = this.downloadLink;
          downloadATag.click();
        }
        this.progress = "done";
        this.didUpdate();
      } catch (e) {
        this.logError(e);
      }
    })();
  }

  logWait(msg, promise) {
    let message = {level: "working", text: msg};
    this.logMessages.push(message);
    this.didUpdate();
    promise.then(res => {
      message.level = "info";
      this.didUpdate();
      return res;
    }, err => {
      message.level = "error";
      this.didUpdate();
      throw err;
    });
    return promise;
  }

  logError(err) {
    this.progress = "error";
    console.error(err);
    let msg;
    if (err.message == "Retrieve failed") {
      msg = "(Error: Retrieve failed: " + JSON.stringify(err.result) + ")";
    } else {
      msg = "(Error: " + err.message + ")";
    }
    this.logMessages.push({level: "error", text: msg});
    this.didUpdate();
  }

}

let timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onStartClick = this.onStartClick.bind(this);
    this.onSelectAllChange = this.onSelectAllChange.bind(this);
    this.onSearchInput = this.onSearchInput.bind(this);
    this.onDownloadAutoChange = this.onDownloadAutoChange.bind(this);
    this.onClickDataModel = this.onClickDataModel.bind(this);
  }
  onSelectAllChange(e) {
    let {model} = this.props;
    let checked = e.target.checked;
    for (let metadataObject of model.filteredMetadataObjects) {
      metadataObject.selected = checked;
    }
    if (model.selectAll && model.filteredMetadataObjects) {
      model.selectAll.indeterminate = (model.filteredMetadataObjects.some(metadataObject => metadataObject.selected) && model.filteredMetadataObjects.some(metadataObject => !metadataObject.selected));
    }
    model.didUpdate();
  }
  onStartClick() {
    let {model} = this.props;
    model.startDownloading();
  }
  onSearchInput(e) {
    let {model} = this.props;
    model.filterMetadata(e.target.value);
    model.didUpdate();
  }
  onDownloadAutoChange(e) {
    let {model} = this.props;
    model.downloadAuto = e.target.checked;
    model.didUpdate();
  }
  onClickDataModel() {
    let {model} = this.props;
    model.downloadDataModel();
    model.didUpdate();
  }
  componentDidMount() {
    let {model} = this.props;
    let selectAll = this.refs.selectref;
    model.setSelectAll(selectAll);
  }
  render() {
    let {model} = this.props;
    document.title = model.title();
    let selectAllChecked = model.filteredMetadataObjects && model.filteredMetadataObjects.every(metadataObject => metadataObject.selected);
    return (
      h("div", {},
        h("div", {className: "object-bar"},
          h("a", {href: model.sfLink, className: "sf-link"},
            h("svg", {viewBox: "0 0 24 24"},
              h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          h("span", {className: "progress progress-" + model.progress},
            model.progress == "ready" ? "Ready"
            : model.progress == "working" ? "Downloading..."
            : model.progress == "done" ? "Finished"
            : "Error!"
          )
        ),
        h("div", {className: "body"},
          h("h1", {}, "Data Model"),
          h("button", {onClick: this.onClickDataModel, disabled: (model.progress == "working")}, "Download Data Model"),
          h("h1", {}, "Metadata"),
          h("div", {hidden: !model.metadataObjects},
            model.downloadLink ? h("a", {href: model.downloadLink, download: "metadata.zip", className: "button"}, "Save downloaded metadata") : null,
            model.statusLink ? h("a", {href: model.statusLink, download: "status.json", className: "button"}, "Save status info") : null,
            h("div", {className: "flex"}),
            h("label", {htmlFor: "search-text"}, "Search"),
            h("input", {id: "searchText", name: "searchText", ref: "searchText", placeholder: "Filter metadata", type: "search", value: model.searchValue, onInput: this.onSearchInput}),
            h("label", {},
              h("input", {type: "checkbox", ref: "selectref", checked: selectAllChecked, onChange: this.onSelectAllChange}),
              "Select all"
            ),
            h("p", {}, "Select what to download above, and then click the button below. If downloading fails, try unchecking some of the boxes."),
            h("button", {onClick: this.onStartClick, disabled: (model.progress == "working")}, "Create metadata package"),
            h("label", {},
              h("input", {type: "checkbox", checked: model.downloadAuto, onChange: this.onDownloadAutoChange}),
              "Download package when ready"
            ),
            h("br", {}),
            model.metadataObjects
              ? h("div", {},
                h("div", {className: "slds-grid slds-wrap"},
                  model.filteredMetadataObjects.map(metadataObject => h(ObjectSelector, {key: metadataObject.xmlName, metadataObject, model}))
                )
              )
              : h("div", {}, model.logMessages.map(({level, text}, index) => h("div", {key: index, className: "log-" + level}, text)))
          )
        )
      )
    );
  }
}

class ObjectSelector extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(e) {
    let {metadataObject, model} = this.props;
    metadataObject.selected = e.target.checked;
    if (model.selectAll && model.filteredMetadataObjects) {
      model.selectAll.indeterminate = (model.filteredMetadataObjects.some(metadataObject => metadataObject.selected) && model.filteredMetadataObjects.some(metadataObject => !metadataObject.selected));
    }
    model.didUpdate();
  }
  render() {
    let {metadataObject} = this.props;
    return h("div", {className: "slds-col slds-size_3-of-12"}, h("label", {title: metadataObject.xmlName},
      h("input", {type: "checkbox", checked: metadataObject.selected, onChange: this.onChange}),
      metadataObject.directoryName
    ));
  }
}

class RecordTable {
  /*
  We don't want to build our own SOQL parser, so we discover the columns based on the data returned.
  This means that we cannot find the columns of cross-object relationships, when the relationship field is null for all returned records.
  We don't care, because we don't need a stable set of columns for our use case.
  */
  constructor() {
    this.columnIdx = new Map();
    this.header = ["_"];
    this.records = [];
    this.table = [];
    this.rowVisibilities = [];
    this.colVisibilities = [true];
    this.countOfVisibleRecords = null;
    this.isTooling = false;
    this.totalSize = -1;
  }
  discoverColumns(record, prefix, row) {
    for (let field in record) {
      if (field == "attributes") {
        continue;
      }
      let column = prefix + field;
      let c;
      if (this.columnIdx.has(column)) {
        c = this.columnIdx.get(column);
      } else {
        c = this.header.length;
        this.columnIdx.set(column, c);
        for (let row of this.table) {
          row.push(undefined);
        }
        this.header[c] = column;
        this.colVisibilities.push(true);
      }
      row[c] = record[field];
      if (typeof record[field] == "object" && record[field] != null) {
        this.discoverColumns(record[field], column + ".", row);
      }
    }
  }
  addToTable(expRecords) {
    this.records = this.records.concat(expRecords);
    if (this.table.length == 0 && expRecords.length > 0) {
      this.table.push(this.header);
      this.rowVisibilities.push(true);
    }
    for (let record of expRecords) {
      let row = new Array(this.header.length);
      row[0] = record;
      this.table.push(row);
      this.rowVisibilities.push(true);
      this.discoverColumns(record, "", row);
    }
  }
}

{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model(sfHost);
    model.startLoading();
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

  });

}
