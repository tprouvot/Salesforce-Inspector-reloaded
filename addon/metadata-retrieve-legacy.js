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

  title() {
    if (this.progress == "working") {
      return "(Loading) Download Metadata";
    }
    return "Download Metadata";
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
        this.metadataObjects = null;
        this.progress = "working";
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
  }
  onSelectAllChange(e) {
    let {model} = this.props;
    let checked = e.target.checked;
    for (let metadataObject of model.metadataObjects) {
      metadataObject.selected = checked;
    }
    model.didUpdate();
  }
  onStartClick() {
    let {model} = this.props;
    model.startDownloading();
  }
  render() {
    let {model} = this.props;
    document.title = model.title();
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
            : model.progress == "working" ? "Downloading metadata..."
            : model.progress == "done" ? "Finished"
            : "Error!"
          ),
          model.downloadLink ? h("a", {href: model.downloadLink, download: "metadata.zip", className: "button"}, "Save downloaded metadata") : null,
          model.statusLink ? h("a", {href: model.statusLink, download: "status.json", className: "button"}, "Save status info") : null,
          h("span", {className: "flex"}),
          h("a", {href: "https://github.com/jesperkristensen/forcecmd"}, "Automate this with forcecmd")
        ),
        h("div", {className: "body"},
          model.metadataObjects
            ? h("div", {},
              h("label", {},
                h("input", {type: "checkbox", checked: model.metadataObjects.every(metadataObject => metadataObject.selected), onChange: this.onSelectAllChange}),
                "Select all"
              ),
              h("br", {}),
              model.metadataObjects.map(metadataObject => h(ObjectSelector, {key: metadataObject.xmlName, metadataObject, model})),
              h("p", {}, "Select what to download above, and then click the button below. If downloading fails, try unchecking some of the boxes."),
              h("button", {onClick: this.onStartClick}, "Download metadata")
            )
            : h("div", {}, model.logMessages.map(({level, text}, index) => h("div", {key: index, className: "log-" + level}, text)))
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
    model.didUpdate();
  }
  render() {
    let {metadataObject} = this.props;
    return h("label", {title: metadataObject.xmlName},
      h("input", {type: "checkbox", checked: metadataObject.selected, onChange: this.onChange}),
      metadataObject.directoryName
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
    model.startLoading();
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

  });

}
