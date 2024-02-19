/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */

class Model {
  constructor(sfHost) {
    this.reactCallback = null;

    // Raw fetched data
    this.spinnerCount = 0;
    this.globalDescribe = null;
    this.sobjectDescribePromise = null;
    this.objectData = null;
    this.recordData = null;
    this.layoutInfo = null;

    // Processed data and UI state
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.userInfo = "...";
    this.logMessages = [];
    this.progress = "ready";
    this.downloadLink = null;
    this.statusLink = null;
    this.metadataObjects = null;
    this.includeManagedPackage = false;
    this.packageXml = "Package.xml goes here";

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));
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
        this.metadataObjects.sort((a, b) => a.xmlName < b.xmlName ? -1 : a.xmlName > b.xmlName ? 1 : 0);
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
    this.onUpdateManagedPackageSelection = this.onUpdateManagedPackageSelection.bind(this);
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
  onUpdateManagedPackageSelection(e){
    let {model} = this.props;
    model.includeManagedPackage = e.target.checked;
    model.didUpdate();
  }
  getXml(){
    //let package = JSON.parse(localStorage.getItem("package.xml"));
    let packageXml = JSON.parse({"": [], "CustomLabel": ["AccountMap", "adobesign__Admin_Msg", "adobesign__Back"], "ApexPage": ["AnswersHome"]});
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              + '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    if (packageXml != null){
      for (let metadataType in packageXml) {
        let itemList = packageXml[metadataType];
        if (itemList.length > 0) {
          xml += "    <types>\n";
          for (let i = 0; i < itemList.length; i++){
            xml += "        <members>" + itemList[i] + "</members>\n";
          }
          xml += "        <name>" + metadataType + "</name>\n"
                       + "    </types>\n";
        }
      }
    }
    xml += "    <version>" + apiVersion + "</version>\n" + "</Package>";
    return xml;
  }

  render() {
    let {model} = this.props;
    document.title = model.title();
    return (
      h("div", {},
        h("div", {id: "user-info", className: "slds-border_bottom"},
          h("a", {href: model.sfLink, className: "sf-link"},
            h("svg", {viewBox: "0 0 24 24"},
              h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          h("h1", {className: "slds-text-title_bold"}, model.title()),
          h("span", {}, " / " + model.userInfo),
          h("div", {className: "flex-right"},
            h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_large", hidden: model.spinnerCount == 0},
              h("span", {className: "slds-assistive-text"}),
              h("div", {className: "slds-spinner__dot-a"}),
              h("div", {className: "slds-spinner__dot-b"}),
            )
          ),
        ),
        h("div", {className: "area", id: "result-area"},
          h("div", {className: "result-bar"},
            h("h1", {className: "slds-text-title_bold"}, "Metadata Result"),
            h("button", {onClick: this.onStartClick}, "Download metadata"),
            model.downloadLink ? h("a", {href: model.downloadLink, download: "metadata.zip", className: "button"}, "Save downloaded metadata") : null,
            model.statusLink ? h("a", {href: model.statusLink, download: "status.json", className: "button"}, "Save status info") : null,
            h("span", {className: "flex"}),
            h("label", {className: "slds-checkbox_toggle max-width-small"},
              h("input", {type: "checkbox", required: true, "aria-describedby": "toggle-namespace", className: "slds-input", checked: model.includeManagedPackage, onChange: this.onUpdateManagedPackageSelection}),
              h("span", {className: "slds-checkbox_faux_container center-label"},
                h("span", {className: "slds-checkbox_faux"}),
                h("span", {className: "slds-checkbox_on"}, "Exclude managed packages metadata"),
                h("span", {className: "slds-checkbox_off"}, "Include managed package metadata"),
              )
            ),
            h("a", {href: "https://github.com/jesperkristensen/forcecmd"}, "Automate this with forcecmd")
          ),
          h("div", {id: "result-table", ref: "scroller"},
            model.metadataObjects
              ? h("div", {className: "result slds-grid"},
                h("div", {className: "slds-col"},
                  h("label", {className: "slds-checkbox_toggle max-width-small"},
                    h("input", {type: "checkbox", checked: model.metadataObjects.every(metadataObject => metadataObject.selected), onChange: this.onSelectAllChange}),
                    h("span", {className: "slds-checkbox_faux_container center-label"},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-checkbox_on"}, "Unselect all"),
                      h("span", {className: "slds-checkbox_off"}, "Select all"),
                    )
                  ),
                  h("br", {}),
                  h("ul", {className: "slds-accordion"},
                    model.metadataObjects.map(metadataObject => h(ObjectSelector, {key: metadataObject.xmlName, metadataObject, model}))),
                  h("p", {}, "Select what to download above, and then click the button below. If downloading fails, try unchecking some of the boxes."),
                  h("button", {onClick: this.onStartClick}, "Download metadata")
                ),
                h("div", {className: "slds-col"},
                  h("textarea", {readOnly: true, value: model.packageXml})
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
    this.onSelectMeta = this.onSelectMeta.bind(this);
  }
  onChange(e) {
    let {metadataObject, model} = this.props;
    metadataObject.selected = e.target.checked;
    model.didUpdate();
  }
  onSelectMeta(e){
    let {model} = this.props;
    //TODO check input target instead of label
    //if (e.target.checked){
    console.log(e.target.title);
    const element = e.target;
    //model.spinFor( //TODO fix spinner
    //"Getting child meta for " + e.target.title,
    sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "listMetadata", {queries: {type: this.props.metadataObject.xmlName, folder: this.props.metadataObject.directoryName}}).then(res => {
      res.sort((a, b) => a.manageableState > b.manageableState ? -1 : a.manageableState > b.manageableState ? 1
        : a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : 0);
      if (res){
        let div = document.createElement("div");
        div.className = "slds-accordion__content";
        let ul = document.createElement("ul");
        ul.className = "slds-accordion";
        res.forEach(elt => {
          if (model.includeManagedPackage || (!model.includeManagedPackage && !elt.namespacePrefix)){
            let clone = element.closest("li").cloneNode(true);
            let label = clone.getElementsByTagName("label")[0];
            let input = label.getElementsByTagName("input")[0];
            label.title = elt.fullName;
            label.textContent = "";
            label.appendChild(input);
            label.innerHTML += elt.fullName;
            ul.appendChild(clone);
          }
        });
        div.appendChild(ul);
        element.closest("section").appendChild(div);
      }
    });
    //);
    //}
  }
  render() {
    let {metadataObject} = this.props;
    return h("li", {className: "slds-accordion__list-item"},
      h("section", {className: "slds-accordion__section slds-is-open"},
        h("div", {className: "slds-accordion__summary"},
          h("h2", {className: "slds-accordion__summary-heading"},
            h("span", {className: "slds-accordion__summary-content"},
              h("label", {title: metadataObject.xmlName, onClick: this.onSelectMeta},
                h("input", {type: "checkbox", className: "metadata", checked: metadataObject.selected, onChange: this.onChange}),
                metadataObject.xmlName
              )
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
    model.startLoading();
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

  });

}
