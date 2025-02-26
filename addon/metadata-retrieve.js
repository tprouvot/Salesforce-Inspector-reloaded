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
    this.userInfo = "...";
    this.logMessages = [];
    this.progress = "ready";
    this.downloadLink = null;
    this.statusLink = null;
    this.metadataObjects = [];
    this.includeManagedPackage = localStorage.getItem("includeManagedMetadata") === "true";
    this.packageXml;
    this.metadataFilter = "";

    this.spinFor(
      "getting user info",
      sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
        this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
      })
    );
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

        let metadataApi = sfConn.wsdl(apiVersion, "Metadata");
        let res = await logWait(
          "DescribeMetadata",
          sfConn.soap(metadataApi, "describeMetadata", {apiVersion})
        );
        let availableMetadataObjects = res.metadataObjects
          .filter(metadataObject => metadataObject.xmlName != "InstalledPackage");

        this.metadataObjects = availableMetadataObjects;
        this.metadataObjects.sort((a, b) => a.xmlName < b.xmlName ? -1 : a.xmlName > b.xmlName ? 1 : 0);
        this.progress = "ready";
        this.generatePackageXml([]);
        this.didUpdate();
      } catch (e) {
        this.logError(e);
      }
    })();
  }

  async retrieveMetadata(retrieveRequest) {
    try {
      let logWait = this.logWait.bind(this);
      let logMsg = msg => {
        this.logMessages.push({level: "info", text: msg});
        this.didUpdate();
      };

      this.progress = "working";
      this.didUpdate();

      let metadataApi = sfConn.wsdl(apiVersion, "Metadata");

      // Start Retrieve operation
      let result = await logWait(
        "Retrieve",
        sfConn.soap(metadataApi, "retrieve", {retrieveRequest})
      );

      logMsg("(Id: " + result.id + ")");

      // Poll for Retrieve completion
      let res;
      for (let interval = 2000; ;) {
        await logWait("(Waiting)", timeout(interval));

        res = await logWait(
          "CheckRetrieveStatus",
          sfConn.soap(metadataApi, "checkRetrieveStatus", {id: result.id})
        );

        if (res.done !== "false") {
          break;
        }
      }

      if (res.success !== "true") {
        let err = new Error("Retrieve failed");
        err.result = res;
        throw err;
      }

      let statusJson = JSON.stringify(
        {
          fileProperties: sfConn
            .asArray(res.fileProperties)
            .filter(fp => fp.id !== "000000000000000AAA" || fp.fullName !== "")
            .sort((fp1, fp2) => (fp1.fileName < fp2.fileName ? -1 : 1)),
          messages: res.messages
        },
        null,
        "    "
      );

      logMsg("(Finished)");

      // Process the ZIP response
      let zipBin = Uint8Array.from(atob(res.zipFile), c => c.charCodeAt(0));
      this.downloadLink = URL.createObjectURL(new Blob([zipBin], {type: "application/zip"}));
      this.statusLink = URL.createObjectURL(new Blob([statusJson], {type: "application/json"}));

      this.progress = "done";
      this.didUpdate();
    } catch (e) {
      this.logError(e);
    }
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
          // Here we hardcode the supported values as of Spring 25 / API version 63.
          types = types.concat([
            "AccountContactMultiRoles", "AccountContactRole", "AccountOwnership", "AccountRating", "AccountType", "AQuestionQuestionCategory", "AReasonAppointmentReason1", "AssessmentRating", "AssessmentStatus", "AssetActionCategory", "AssetRelationshipType", "AssetStatus", "AssociatedLocationType", "CampaignMemberStatus", "CampaignStatus", "CampaignType", "CardType", "CaseContactRole", "CaseOrigin", "CasePriority", "CaseReason", "CaseStatus", "CaseType", "ChangeRequestRelatedItemImpactLevel", "ChangeRequestBusinessReason", "ChangeRequestCategory", "ChangeRequestImpact", "ChangeRequestPriority", "ChangeRequestRiskLevel", "ChangeRequestStatus", "ConsequenceOfFailure", "ContactPointAddressType", "ContactPointUsageType", "ContactRequestReason", "ContactRequestStatus", "ContactRole", "ContractContactRole", "ContractStatus", "DigitalAssetStatus", "EntitlementType", "EventSubject", "EventType", "FinanceEventAction", "FinanceEventType", "FiscalYearPeriodName", "FiscalYearPeriodPrefix", "FiscalYearQuarterName", "FiscalYearQuarterPrefix", "FulfillmentStatus", "FulfillmentType", "IncidentCategory", "IncidentImpact", "IncidentPriority", "IncidentRelatedItemImpactLevel", "IncidentRelatedItemImpactType", "IncidentReportedMethod", "IncidentStatus", "IncidentSubCategory", "IncidentType", "IncidentUrgency", "Industry", "LeadSource", "LeadStatus", "LocationType", "MilitaryService", "OpportunityCompetitor", "OpportunityStage", "OpportunityType", "OrderItemSummaryChgRsn", "OrderStatus", "OrderSummaryRoutingSchdRsn", "OrderSummaryStatus", "OrderType", "PartnerRole", "PartyProfileCountryofBirth", "PartyProfileEmploymentType", "PartyProfileFundSource", "PartyProfileGender", "PartyProfileResidentType", "PartyProfileReviewDecision", "PartyProfileRiskType", "PartyProfileStage", "PartyScreeningStepType", "PartyScreeningSummaryStatus", "PIdentityVerificationResult", "PIdentityVerificationStatus", "PIVerificationStepStatus", "PIVerificationStepType", "PIVerificationVerifiedBy", "PIVOverriddenResult", "PIVResultOverrideReason", "PIVSVerificationDecision", "ProblemCategory", "ProblemImpact", "ProblemPriority", "ProblemRelatedItemImpactLevel", "ProblemRelatedItemImpactType", "ProblemStatus", "ProblemSubCategory", "ProblemUrgency", "ProcessExceptionCategory", "ProcessExceptionPriority", "ProcessExceptionSeverity", "ProcessExceptionStatus", "Product2Family", "ProductRequestStatus", "QuantityUnitOfMeasure", "QuickTextCategory", "QuickTextChannel", "QuoteStatus", "RegulatoryBodyType1", "RequestedCareCodeType1", "RequestedDrugCodeType1", "RequestedLevelOfCare1", "RequesterType1", "RequestingPractitionerLicense1", "RequestingPractitionerSpecialty1", "ResidenceStatusType1", "RoleInTerritory2"
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
        await this.retrieveMetadata({apiVersion, unpackaged: {types, version: apiVersion}});
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

  resetPackage(){
    this.generatePackageXml([]);
    this.didUpdate();
  }

  generatePackageXml(components) {
    const groupedComponents = {};

    components.forEach(({xmlName, childXmlNames}) => {
      childXmlNames = childXmlNames.length > 0 && childXmlNames.filter(child => child.selected).length > 0 ? childXmlNames : [{fullName: "*", selected: true}];
      if (xmlName) {
        if (!groupedComponents[xmlName]) {
          groupedComponents[xmlName] = new Set();
        }
        childXmlNames.forEach(({fullName, selected}) => {
          if (selected || fullName === "*") {
            groupedComponents[xmlName].add(fullName);
          }
        });
      }
    });

    this.packageXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    this.packageXml += "<Package xmlns=\"http://soap.sforce.com/2006/04/metadata\">\n";

    Object.entries(groupedComponents).forEach(([type, members]) => {
      this.packageXml += "    <types>\n";
      [...members].sort().forEach(member => {
        this.packageXml += `        <members>${member}</members>\n`;
      });
      this.packageXml += `        <name>${type}</name>\n`;
      this.packageXml += "    </types>\n";
    });
    this.packageXml += `    <version>${apiVersion}</version>\n`;
    this.packageXml += "</Package>";
  }
}

let timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onStartClick = this.onStartClick.bind(this);
    this.onImportPackage = this.onImportPackage.bind(this);
    this.downloadXml = this.downloadXml.bind(this);
    this.onSelectAllChange = this.onSelectAllChange.bind(this);
    this.onUpdateManagedPackageSelection = this.onUpdateManagedPackageSelection.bind(this);
    this.onMetadataFilterInput = this.onMetadataFilterInput.bind(this);
  }
  componentDidMount() {
    this.refs.metadataFilter.focus();
  }
  componentDidUpdate(){
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }
  onSelectAllChange(e) {
    let {model} = this.props;
    let checked = e.target.checked;
    for (let metadataObject of model.metadataObjects) {
      metadataObject.selected = checked;
    }
    if (checked){
      model.generatePackageXml(model.metadataObjects);
    } else {
      model.resetPackage();
    }
    model.didUpdate();
  }
  onStartClick() {
    let {model} = this.props;
    model.startDownloading();
  }
  downloadXml(){
    let {model} = this.props;
    const blob = new Blob([model.packageXml], {type: "text/xml"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "package.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  onImportPackage(){
    let {model} = this.props;
    const fileInput = this.refs.fileInput;

    if (!fileInput.files.length) {
      console.error("No file selected.");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const importedPackage = event.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(importedPackage, "text/xml");

        const retrieveRequest = {apiVersion, unpackaged: {types: []}};

        const types = xmlDoc.getElementsByTagName("types");
        for (let typeNode of types) {
          const name = typeNode.getElementsByTagName("name")[0].textContent;
          const members = [...typeNode.getElementsByTagName("members")].map(m => m.textContent).sort(); // Sort members
          retrieveRequest.unpackaged.types.push({name, members});
        }
        retrieveRequest.unpackaged.types.sort((a, b) => a.name.localeCompare(b.name));
        model.retrieveMetadata(retrieveRequest);
      } catch (error) {
        console.error(error);
      }
    };
    reader.readAsText(file);
  }
  onUpdateManagedPackageSelection(e){
    let {model} = this.props;
    model.includeManagedPackage = e.target.checked;
    localStorage.setItem("includeManagedMetadata", model.includeManagedPackage);
    model.didUpdate();
  }
  onMetadataFilterInput(e) {
    let {model} = this.props;
    if (model.metadataObjects){
      model.metadataFilter = e.target.value.toLowerCase();
      model.metadataObjects = model.metadataObjects.map(metadataObject => ({
        ...metadataObject,
        hidden: !metadataObject.xmlName.toLowerCase().includes(model.metadataFilter)
      }));
      model.didUpdate();
    }
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
          h("span", {className: "progress progress-" + model.progress},
            model.progress == "ready" ? "Ready"
            : model.progress == "working" ? "Downloading metadata..."
            : model.progress == "done" ? "Finished"
            : "Error!"
          ),
        ),
        h("div", {className: "area", id: "result-area"},
          h("div", {className: "result-bar"},
            h("h1", {className: "slds-text-title_bold"}, "Metadata"),
            h("input", {className: "filter-input", disabled: !model.metadataObjects, placeholder: "Filter", value: model.metadataFilter, onChange: this.onMetadataFilterInput, ref: "metadataFilter"}),
            h("label", {className: "slds-checkbox_toggle max-width-small"},
              h("input", {type: "checkbox", checked: model.metadataObjects.every(metadataObject => metadataObject.selected), onChange: this.onSelectAllChange}),
              h("span", {className: "slds-checkbox_faux_container center-label"},
                h("span", {className: "slds-checkbox_faux"}),
                h("span", {className: "slds-checkbox_on"}, "Unselect all"),
                h("span", {className: "slds-checkbox_off"}, "Select all"),
              )
            ),
            h("label", {className: "slds-checkbox_toggle max-width-small"},
              h("input", {type: "checkbox", required: true, "aria-describedby": "toggle-namespace", className: "slds-input", checked: model.includeManagedPackage, onChange: this.onUpdateManagedPackageSelection}),
              h("span", {className: "slds-checkbox_faux_container center-label"},
                h("span", {className: "slds-checkbox_faux"}),
                h("span", {className: "slds-checkbox_on"}, "Managed packages included"),
                h("span", {className: "slds-checkbox_off"}, "Managed packages excluded"),
              )
            ),
            h("div", {className: "flex-right"},
              h("button", {onClick: this.onStartClick}, "Download metadata"),
              h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.downloadXml(), title: "Download package.xml"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#download"})
                )
              ),
              h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.refs.fileInput.click(), title: "Import package.xml"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#upload"})
                )
              ),
              h("input", {
                type: "file",
                style: {display: "none"},
                ref: "fileInput",
                onChange: this.onImportPackage,
                accept: "text/xml"
              }),
              model.downloadLink ? h("a", {href: model.downloadLink, download: "metadata.zip", className: "button"}, "Save downloaded metadata") : null,
              model.statusLink ? h("a", {href: model.statusLink, download: "status.json", className: "button"}, "Save status info") : null
            ),
          ),
          h("div", {id: "result-table", ref: "scroller"},
            model.metadataObjects
              ? h("div", {className: "result slds-grid"},
                h("div", {className: "slds-col"},
                  h("br", {}),
                  h("ul", {className: "slds-accordion"},
                    model.metadataObjects.map(metadataObject => h(ObjectSelector, {metadataObject, model}))),
                  h("p", {}, "Select what to download above, and then click the button below. If downloading fails, try unchecking some of the boxes."),
                  h("button", {onClick: this.onStartClick}, "Download metadata")
                ),
                h("div", {className: "slds-col"},
                  h("pre", {className: "reset-margin"},
                    h("code", {id: "packageXml", className: "language-markup"}, model.packageXml)
                  )
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
    this.onSelectChild = this.onSelectChild.bind(this);
    props.metadataObject.childXmlNames = [];
  }
  onChange(e) {
    let {metadataObject, model} = this.props;
    metadataObject.selected = e.target.checked;
    model.generatePackageXml(model.metadataObjects.filter(metadataObject => metadataObject.selected));
    model.didUpdate();
  }
  onSelectChild(child){
    let {model} = this.props;

    child.selected = !child.selected;
    model.generatePackageXml(model.metadataObjects.filter(metadataObject => metadataObject.selected));
    model.didUpdate();
  }
  onSelectMeta(e){
    let {model, metadataObject} = this.props;

    console.log(e.target.title);
    const element = e.target;

    //TODO fix spinner
    model.spinFor(
      "getting child metadata " + e.target.title,
      sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "listMetadata", {queries: {type: metadataObject.xmlName, folder: metadataObject.directoryName}}).then(res => {
        res.sort((a, b) => a.fullName > b.fullName ? 1 : a.fullName < b.fullName ? -1
          : 0);
        if (res){
          res.forEach(elt => {
            if (model.includeManagedPackage || (!model.includeManagedPackage && !elt.namespacePrefix)){
              metadataObject.childXmlNames.push(elt);
            }
          });
        }
      })
    );
  }

  render() {
    let {metadataObject} = this.props;
    return h("li", {className: "slds-accordion__list-item", hidden: metadataObject.hidden},
      h("section", {className: "slds-accordion__section slds-is-open"},
        h("div", {className: "slds-accordion__summary"},
          h("h2", {className: "slds-accordion__summary-heading"},
            h("span", {className: "slds-accordion__summary-content"},
              h("label", {title: metadataObject.xmlName,
                onClick: (event) => {
                  if (event.target.tagName !== "INPUT") {
                    this.onSelectMeta(event);
                  }
                }},
              h("input", {
                type: "checkbox",
                className: "metadata",
                checked: metadataObject.selected,
                onChange: this.onChange,
                key: metadataObject.xmlName
              }),
              metadataObject.xmlName
              )
            )
          )
        ),
        metadataObject.childXmlNames?.length > 0
        && h("div", {className: "slds-accordion__content"},
          h("ul", {className: "slds-accordion", key: metadataObject.fullName},
            metadataObject.childXmlNames.map(child =>
              h("li", {key: metadataObject.xmlName + "_li_" + child.fullName, className: "slds-accordion__list-item"},
                h("label", {title: child.namespacePrefix ? `${child.namespacePrefix}.${child.fullName}` : child.fullName, onClick: () => this.onSelectChild(child)},
                  h("input", {type: "checkbox", className: "metadata", checked: child.selected}),
                  child.fullName
                )
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
