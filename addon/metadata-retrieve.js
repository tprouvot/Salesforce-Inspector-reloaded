import {sfConn, apiVersion} from "./inspector.js";
import Toast from "./components/Toast.js";
import {copyToClipboard} from "./data-load.js";

class Model {
  constructor(sfHost) {
    this.reactCallback = null;

    this.spinnerCount = 0;
    this.globalDescribe = null;
    this.sobjectDescribePromise = null;
    this.objectData = null;
    this.recordData = null;
    this.layoutInfo = null;

    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.userInfo = "...";
    this.logMessages = [];
    this.progress = "ready";
    this.downloadLink = null;
    this.statusLink = null;
    this.metadataObjects = [];
    this.includeManagedPackage = localStorage.getItem("includeManagedMetadata") === "true";
    this.sortMetadataBy = JSON.parse(localStorage.getItem("sortMetadataBy")) || "fullName";
    this.packageXml;
    this.metadataFilter = "";
    this.deployRequestId;
    this.allSelected = false;
    let deployOptions = localStorage.getItem("deployOptions");
    this.deployOptions = deployOptions ? JSON.parse(deployOptions) : {
      allowMissingFiles: false,
      checkOnly: false,
      ignoreWarnings: false,
      purgeOnDelete: false,
      singlePackage: true,
      performRetrieve: true,
      rollbackOnError: true,
      testLevel: "NoTestRun"
    };
    this.spinFor(
      "getting user info",
      sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
        this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
      })
    );
  }

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
      return "(Loading) Metadata";
    }
    return "Metadata (beta)";
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
        let availableMetadataObjects = res.metadataObjects;

        this.metadataObjects = availableMetadataObjects;
        // Add a CustomField metadata to the metadata objects (not returned by describeMetadata)
        this.metadataObjects.push({
          xmlName: "CustomField",
          childXmlNames: [],
          isFolder: false,
          selected: false,
          expanded: false
        });
        this.metadataObjects.sort((a, b) => a.xmlName < b.xmlName ? -1 : a.xmlName > b.xmlName ? 1 : 0);
        this.metadataObjects = availableMetadataObjects.map(obj => ({...obj, isFolder: false}));

        this.progress = "ready";
        this.generatePackageXml([]);
        this.didUpdate();
      } catch (e) {
        this.logError(e);
      }
    })();
  }

  getDeploymentComponentsAndPackageXml(deployRequestId) {
    sfConn.rest(`/services/data/v${apiVersion}/metadata/deployRequest/${deployRequestId}?includeDetails=true`, {method: "GET"}).then(res => {
      const groupedComponents = {};
      const metadataObjectsMap = {};

      let components = ("allComponentMessages" in res.deployResult.details) ? res.deployResult.details.allComponentMessages : res.deployResult.details.componentSuccesses;

      components.sort((a, b) => a.componentType < b.componentType ? -1 : a.componentType > b.componentType ? 1 : a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : 0);
      components.forEach(({componentType, fullName, fileName, problemType}) => {
        if (componentType && fullName && problemType != "Warning") {
          componentType = fileName.startsWith("settings") ? "Settings" : componentType;

          if (!groupedComponents[componentType]) {
            groupedComponents[componentType] = new Set();
          }
          groupedComponents[componentType].add(fullName);

          if (!metadataObjectsMap[componentType]) {
            metadataObjectsMap[componentType] = {
              xmlName: componentType,
              selected: true,
              expanded: true,
              childXmlNames: []
            };
          }
          metadataObjectsMap[componentType].childXmlNames.push({
            parent: metadataObjectsMap[componentType],
            fullName,
            selected: true
          });
        }
      });
      this.metadataObjects = Object.values(metadataObjectsMap).map(metadataObject => {
        metadataObject.childXmlNames.sort((a, b) => a.fullName < b.fullName ? -1 : a.fullName > b.fullName ? 1 : 0);
        return {
          ...metadataObject
        };
      });
      this.generatePackageXml(this.metadataObjects);
      this.didUpdate();
    });
  }

  retrieveMetaFromPackageXml(packageXml){
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(packageXml, "text/xml");

    const retrieveRequest = {apiVersion, unpackaged: {types: []}};

    const types = xmlDoc.getElementsByTagName("types");
    for (let typeNode of types) {
      const name = typeNode.getElementsByTagName("name")[0].textContent;
      const members = [...typeNode.getElementsByTagName("members")].map(m => m.textContent).sort();
      retrieveRequest.unpackaged.types.push({name, members});
    }
    retrieveRequest.unpackaged.types.sort((a, b) => a.name.localeCompare(b.name));
    this.retrieveMetadata(retrieveRequest);
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
      this.spinnerCount--;

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
    this.retrieveMetaFromPackageXml(this.packageXml);
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

    components.forEach((parent) => {
      parent.childXmlNames = parent.childXmlNames.length > 0 && parent.childXmlNames.filter(child => child.selected).length > 0 ? parent.childXmlNames : [{fullName: "*", selected: true}];
      if (parent.xmlName) {
        if (!groupedComponents[parent.xmlName]) {
          groupedComponents[parent.xmlName] = new Set();
        }
        parent.childXmlNames.forEach((child) => {
          if (child.childXmlNames && child.childXmlNames.length > 0){
            child.childXmlNames?.forEach((grandchild) => {
              if (grandchild.selected) {
                groupedComponents[parent.xmlName].add(grandchild.fullName);
              }
            });
          } else if (child.selected || child.fullName === "*") {
            groupedComponents[parent.xmlName].add(child.fullName);
          }
        });
      }
    });
    this.packageXml = "<Package xmlns=\"http://soap.sforce.com/2006/04/metadata\">\n";

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
    this.onPastePackage = this.onPastePackage.bind(this);
    this.downloadXml = this.downloadXml.bind(this);
    this.onSelectAllChange = this.onSelectAllChange.bind(this);
    this.onUpdateManagedPackageSelection = this.onUpdateManagedPackageSelection.bind(this);
    this.onUpdateDeployOptions = this.onUpdateDeployOptions.bind(this);
    this.onMetadataFilterInput = this.onMetadataFilterInput.bind(this);
    this.onClearAndFocusFilter = this.onClearAndFocusFilter.bind(this);
    this.hideToast = this.hideToast.bind(this);
    this.state = {};
  }
  componentDidMount() {
    this.refs.metadataFilter.focus();
    const packageXml = document.getElementById("packageXml");
    if (packageXml) {
      packageXml.addEventListener("paste", this.onPastePackage);
    }
  }
  componentWillUnmount() {
    const packageXml = document.getElementById("packageXml");
    if (packageXml) {
      packageXml.removeEventListener("paste", this.onPastePackage);
    }
  }
  componentDidUpdate(){
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }
  onSelectAllChange(e) {
    let {model} = this.props;
    let checked = e.target.checked;
    model.allSelected = checked;
    model.metadataObjects.forEach(metadataObject => {
      metadataObject.selected = checked;
      metadataObject.childXmlNames.forEach(child => {
        child.selected = checked;
      });
    });
    if (checked){
      model.generatePackageXml(model.metadataObjects);
    } else {
      model.resetPackage();
    }
    model.didUpdate();
  }
  onStartClick() {
    let {model} = this.props;
    model.spinnerCount++;
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
  copyXml(){
    let {model} = this.props;
    copyToClipboard(model.packageXml);
  }
  showOptions(){
    let {model} = this.props;
    model.showOptions = !model.showOptions;
    model.didUpdate();
  }
  onImportPackage(){
    let {model} = this.props;
    const fileInput = this.refs.fileInput;

    if (!fileInput.files.length) {
      this.setState({
        showToast: true,
        toastMessage: "Import Failed",
        toastVariant: "error",
        toastTitle: "Error"
      });
      console.error("No file selected.");
      return;
    }

    const file = fileInput.files[0];
    const fileName = fileInput.files[0].name;
    const fileExtension = fileName.split(".").pop().toLowerCase();

    if (fileExtension === "xml") {
      // Handle XML file import (existing behavior)
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedPackage = event.target.result;
          model.packageXml = importedPackage;
          this.setState({
            showToast: true,
            toastMessage: fileName + " imported successfully!",
            toastVariant: "success",
            toastTitle: "Success"
          });
          setTimeout(this.hideToast, 3000);
          model.didUpdate();
        } catch (error) {
          console.error(error);
          this.setState({
            showToast: true,
            toastMessage: "Failed to import XML file: " + error.message,
            toastVariant: "error",
            toastTitle: "Error"
          });
        }
      };
      reader.readAsText(file);
    } else if (fileExtension === "zip") {
      // Handle ZIP file deployment
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const zipBytes = new Uint8Array(event.target.result);
          model.progress = "deploying";
          model.didUpdate();

          // Start deployment
          const metadataApi = sfConn.wsdl(apiVersion, "Metadata");
          const result = await sfConn.soap(metadataApi, "deploy", {
            zipFile: btoa(String.fromCharCode.apply(null, zipBytes)),
            deployOptions: model.deployOptions
          });

          // Poll for deployment status
          let deployResult;
          let pollCount = 0;
          const maxPolls = 50;
          const pollInterval = 2000;

          while (pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            deployResult = await sfConn.soap(metadataApi, "checkDeployStatus", {
              id: result.id,
              includeDetails: true
            });

            if (deployResult.done) {
              // Check for component failures
              if (deployResult.details && deployResult.details.componentFailures) {
                const failures = deployResult.details.componentFailures;
                if (Array.isArray(failures) && failures.length > 0) {
                  const formattedFailures = failures.map((f, index) => {
                    const componentInfo = f.componentType ? `${f.componentType} "${f.fullName}"` : f.fullName;
                    return `[${index + 1}] ${componentInfo} : ${f.problem}`;
                  }).join("\n");
                  const error = new Error(formattedFailures);
                  error.id = deployResult.id;
                  throw error;
                }
              }
              break;
            }
            pollCount++;
          }

          if (!deployResult.done) {
            throw new Error("Deployment timed out");
          }

          if (!deployResult.success) {
            throw new Error("Deployment failed: " + JSON.stringify(deployResult.details));
          }

          this.setState({
            showToast: true,
            toastMessage: "Metadata deployed successfully!",
            toastVariant: "success",
            toastTitle: "Success"
          });
          model.progress = "done";
          setTimeout(this.hideToast, 3000);
        } catch (error) {
          console.error(error);
          this.setState({
            showToast: true,
            toastMessage: {
              pre: "",
              linkText: `${error.id}: `,
              linkTitle: "View deployment error in Salesforce",
              link: `https://${this.props.model.sfHost}/lightning/setup/DeployStatus/page?address=%2Fchangemgmt%2FmonitorDeploymentsDetails.apexp%3FasyncId%3D${error.id}%26retURL%3D%252Fchangemgmt%252FmonitorDeployment.apexpa`,
              post: error.message,
            },
            toastVariant: "error",
            toastTitle: "Error"
          });
          model.progress = "error";
        }
        model.didUpdate();
      };
      reader.readAsArrayBuffer(file);
    } else {
      this.setState({
        showToast: true,
        toastMessage: "Unsupported file type. Please use .xml or .zip files.",
        toastVariant: "error",
        toastTitle: "Error"
      });
    }
  }
  onPastePackage(e){
    let {model} = this.props;
    let clipText = e.clipboardData.getData("text/plain");
    model.packageXml = clipText;
    model.retrieveMetaFromPackageXml(clipText);
    model.didUpdate();
  }
  onUpdateManagedPackageSelection(e){
    let {model} = this.props;
    model.includeManagedPackage = e.target.checked;
    localStorage.setItem("includeManagedMetadata", model.includeManagedPackage);
    model.didUpdate();
  }
  onUpdateDeployOptions(e) {
    let {model} = this.props;
    const key = e.target.name || e.target.id;
    if (key && model.deployOptions.hasOwnProperty(key)) {
      model.deployOptions[key] = e.target.checked;
      model.didUpdate();
      localStorage.setItem("deployOptions", JSON.stringify(model.deployOptions));
    }
  }
  onMetadataFilterInput(e) {
    let {model} = this.props;
    if (model.metadataObjects) {
      model.metadataFilter = e.target.value.toLowerCase();

      model.metadataObjects.forEach(metadataObject => {
        metadataObject.hidden = !metadataObject.xmlName.toLowerCase().includes(model.metadataFilter);

        if (metadataObject.childXmlNames) {
          // Check if any child matches the filter
          const anyChildMatches = metadataObject.childXmlNames.some(child =>
            child.fullName.toLowerCase().includes(model.metadataFilter)
          );

          // If any child matches, the parent should be visible
          if (anyChildMatches) {
            metadataObject.hidden = false;
          }

          // Update child visibility while maintaining references
          metadataObject.childXmlNames.forEach(child => {
            child.hidden = !child.fullName.toLowerCase().includes(model.metadataFilter);

            if (child.childXmlNames) {
              child.childXmlNames.forEach(grandchild => {
                grandchild.hidden = !grandchild.fullName.toLowerCase().includes(model.metadataFilter);
              });
            }
          });
        }
      });
      model.didUpdate();
    }
  }

  onClearAndFocusFilter(e) {
    e.preventDefault();
    let {model} = this.props;
    model.metadataFilter = "";
    model.metadataObjects = model.metadataObjects.map(metadataObject => ({
      ...metadataObject,
      hidden: false
    }));
    this.refs.metadataFilter.focus();
    model.didUpdate();
  }
  hideToast() {
    let {model} = this.props;
    this.state = {showToast: false, toastMessage: ""};
    model.didUpdate();
  }
  render() {
    let {model} = this.props;
    document.title = model.title();
    return (
      h("div", {},
        this.state.showToast
        && h(Toast, {
          variant: this.state.toastVariant,
          title: this.state.toastTitle,
          message: this.state.toastMessage,
          onClose: this.hideToast
        }),
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
            h("div", {role: "status", className: "slds-spinner slds-spinner_large", hidden: model.spinnerCount == 0},
              h("span", {className: "slds-assistive-text"}),
              h("div", {className: "slds-spinner__dot-a"}),
              h("div", {className: "slds-spinner__dot-b"}),
            )
          ),
          h("span", {className: "progress progress-" + model.progress},
            model.progress == "ready" ? "Ready"
            : model.progress == "working" ? "Retrieving metadata..."
            : model.progress == "deploying" ? "Deploying metadata..."
            : model.progress == "done" ? "Finished"
            : "Error!"
          ),
        ),
        h("div", {className: "area", id: "result-area"},
          h("div", {className: "result-bar"},
            h("h1", {className: "slds-text-title_bold"}, "Metadata"),
            h("div", {className: "filter-box"},
              h("svg", {className: "filter-icon"},
                h("use", {xlinkHref: "symbols.svg#search"})
              ),
              h("input", {className: "filter-input", disabled: model.metadataObjects?.length == 0, placeholder: "Filter", value: model.metadataFilter, onChange: this.onMetadataFilterInput, ref: "metadataFilter"}),
              h("a", {href: "about:blank", className: "filter-clear", title: "Clear filter", onClick: this.onClearAndFocusFilter},
                h("svg", {className: "filter-clear-icon"},
                  h("use", {xlinkHref: "symbols.svg#clear"})
                )
              )
            ),
            h("label", {className: "slds-checkbox_toggle max-width-small"},
              h("input", {type: "checkbox", checked: model.allSelected, onChange: this.onSelectAllChange}),
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
              h("button", {
                onClick: this.onStartClick,
                disabled: !model.deployRequestId && (!model.metadataObjects || !model.metadataObjects.some(obj => obj.selected))
              }, "Retrieve Metadata"),
              model.downloadLink ? h("a", {href: model.downloadLink, download: "metadata.zip", className: "button"}, "Download Metadata") : null,
              model.statusLink ? h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.refs.fileInput.click(), title: "Save status info"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#info"})
                )
              ) : null,
              h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.downloadXml(), title: "Download package.xml"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#download"})
                )
              ),
              h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.refs.fileInput.click(), title: "Import package.xml or package zip file"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#upload"})
                )
              ),
              h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.copyXml(), title: "Copy package.xml"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#copy"})
                )
              ),
              h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.showOptions(), title: "Display Deployment Settings"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#settings"})
                )
              ),
              h("input", {
                type: "file",
                style: {display: "none"},
                ref: "fileInput",
                onChange: this.onImportPackage,
                accept: "text/xml,.xml,application/zip,.zip"
              })
            )
          ),
          model.showOptions && h("div", {className: "options-text slds-grid slds-grid_align-spread slds-wrap"},
            h("h2", {className: "slds-text-title_bold"}, "Deployment Settings"),
            Object.entries(model.deployOptions)
              .filter(([_, value]) => typeof value === "boolean")
              .map(([key, value]) =>
                h("div", {className: "slds-col slds-size_1-of-5 slds-p-around_x-small", key},
                  h("label", {className: "slds-checkbox_toggle max-width-small"},
                    h("span", {className: "slds-form-element__label slds-m-bottom_none"}, key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())),
                    h("input", {type: "checkbox", name: key, checked: value, onChange: this.onUpdateDeployOptions}),
                    h("span", {className: "slds-checkbox_faux_container center-label"},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-checkbox_on"}, "Enabled"),
                      h("span", {className: "slds-checkbox_off"}, "Disabled"),
                    )
                  )
                )
              ),
            h("div", {className: "slds-col slds-size_1-of-5 slds-p-around_x-small"},
              h("label", {className: "slds-form-element__label"}, "Test Level"),
              h("div", {className: "slds-form-element__control"},
                h("select", {
                  className: "slds-select",
                  value: model.deployOptions.testLevel,
                  onChange: (e) => {
                    model.deployOptions.testLevel = e.target.value;
                    model.didUpdate();
                  }
                },
                h("option", {value: "NoTestRun"}, "No Test Run"),
                h("option", {value: "RunSpecifiedTests"}, "Run Specified Tests"),
                h("option", {value: "RunLocalTests"}, "Run Local Tests"),
                h("option", {value: "RunAllTestsInOrg"}, "Run All Tests in Org")
                )
              )
            )
          ),
          h("div", {id: "result-table", ref: "scroller"},
            model.metadataObjects
              ? h("div", {className: "result slds-grid"},
                h("div", {className: "slds-col"},
                  h("br", {}),
                  h("ul", {className: "slds-accordion"},
                    model.metadataObjects.map(metadataObject => h(ObjectSelector, {metadataObject, model, key: metadataObject.xmlName}))),
                  !model.deployRequestId ? h("p", {}, "Select what to download above, and then click the button below. If downloading fails, try unchecking some of the boxes.") : null
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
    metadataObject.wildcard = !metadataObject.expanded;
    if (metadataObject.expanded){
      metadataObject.childXmlNames.forEach(child => child.selected = metadataObject.selected);
    }
    model.generatePackageXml(model.metadataObjects.filter(metadataObject => metadataObject.selected));
    model.didUpdate();
  }
  onSelectChild(child, e){
    let {model} = this.props;
    if (child.isFolder){
      this.onSelectMeta(null, child);
    } else {
      child.selected = !child.selected;
      child.parent.selected = true;
      if (child.parent.isFolder){
        child.parent.parent.selected = true;
      }
      model.generatePackageXml(model.metadataObjects.filter(metadataObject => metadataObject.selected));
      model.didUpdate();
    }

    if (e.target.nodeName != "INPUT"){
      e.preventDefault();
    }
  }
  getMetaFolderProof(metadataObject){
    if (metadataObject.xmlName == "Report" && !metadataObject.isFolder){
      return {xmlName: "ReportFolder", directoryName: "*"};
    } else if ((metadataObject.xmlName == "Dashboard" || metadataObject.xmlName == "Document") && !metadataObject.isFolder){
      return {xmlName: metadataObject.xmlName + "Folder"};
    } else if (metadataObject.xmlName == "EmailTemplate" && !metadataObject.isFolder){
      return {xmlName: "EmailFolder"};
    } else {
      return metadataObject;
    }
  }
  onSelectMeta(e, child){
    if (!e || e.target.nodeName !== "INPUT"){
      let {model, metadataObject} = this.props;
      this.selectMeta(model, child ? child : metadataObject);
    }
  }

  selectMeta(model, meta){
    meta.expanded = !meta.expanded;
    meta.icon = meta.expanded ? "switch" : "chevronright";
    if (meta.childXmlNames.length == 0 || model.deployRequestId || meta.childXmlNames[0].fullName == "*"){

      let metaFolderProof = this.getMetaFolderProof(meta);
      model.spinFor(
        "getting child metadata " + meta.xmlName,
        sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "listMetadata", {queries: {type: metaFolderProof.xmlName, folder: metaFolderProof.directoryName}}).then(res => {

          if (res){
            meta.childXmlNames = []; //reset tab if wildcard is the only child
            let resArray = Array.isArray(res) ? res : res ? [res] : []; // only one element can be returned
            resArray.forEach(elt => {
              elt.isFolder = elt.type.endsWith("Folder");
              if (elt.isFolder){
                elt.xmlName = meta.xmlName;
                elt.directoryName = elt.fullName;
                elt.childXmlNames = [];
              }
              if (model.includeManagedPackage || (!model.includeManagedPackage && !elt.namespacePrefix)){
                elt.parent = meta;
                if (!meta.childXmlNames.some(existingElt => existingElt.fullName === elt.fullName)) {
                  meta.childXmlNames.push(elt);
                }
              }
            });
            meta.childXmlNames.sort((a, b) => a[model.sortMetadataBy] > b[model.sortMetadataBy] ? 1 : a[model.sortMetadataBy] < b[model.sortMetadataBy] ? -1 : 0);
          }
        })
      );
    } else {
      //call refresh filter
    }
    model.didUpdate();
  }

  render() {
    let {metadataObject} = this.props;

    const renderChildren = (children, parentXmlName) => {
      if (!children || children.length === 0) {
        return null;
      }

      return h("ul", {className: "slds-accordion", key: parentXmlName + "_children"},
        children.map(child =>
          h("li", {key: parentXmlName + "_li_" + child.fullName, className: "slds-accordion__list-item", hidden: child.hidden},
            h("section", {className: child.expanded ? "slds-accordion__section slds-is-open" : "slds-accordion__section"},
              h("div", {className: "slds-accordion__summary", title: child.fullName, onClick: (e) => this.onSelectChild(child, e)},
                h("h4", {className: "slds-accordion__summary-heading"},
                  h("button", {"aria-controls": "accordion-details-" + child.fullName, "aria-expanded": child.expanded, className: "slds-button slds-button_reset slds-accordion__summary-action"},
                    child.isFolder ? h("svg", {className: "reset-transform slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
                      h("use", {xlinkHref: "symbols.svg#" + (child.icon ? child.icon : "chevronright")})
                    ) : null,
                    h("input", {type: "checkbox", className: !child.isFolder ? "margin-grandchild metadata" : "metadata", checked: !!child.selected}),
                    h("span", {className: "slds-text-body_small slds-accordion__summary-content", title: child.fullName}, child.fullName + (child.expanded ? " (" + child.childXmlNames.length + ")" : ""))
                  )
                )
              ),
              child.expanded && h("div", {className: "slds-accordion__content", id: "accordion-details-" + child.fullName},
                renderChildren(child.childXmlNames, child.fullName)
              )
            )
          )
        )
      );
    };

    return h("li", {className: "slds-accordion__list-item", hidden: metadataObject.hidden, key: metadataObject.xmlName},
      h("section", {className: metadataObject.expanded ? "slds-accordion__section slds-is-open" : "slds-accordion__section"},
        h("div", {className: "slds-accordion__summary", title: metadataObject.xmlName, onClick: (event) => { this.onSelectMeta(event); }},
          h("h3", {className: "slds-accordion__summary-heading"},
            h("button", {"aria-controls": "accordion-details-" + metadataObject.xmlName, "aria-expanded": metadataObject.expanded, className: "slds-button slds-button_reset slds-accordion__summary-action"},
              h("svg", {className: "reset-transform slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
                h("use", {xlinkHref: "symbols.svg#" + (metadataObject.icon ? metadataObject.icon : "chevronright")})
              ),
              h("input", {type: "checkbox", className: "metadata", checked: !!metadataObject.selected, onChange: this.onChange, key: metadataObject.xmlName}),
              h("span", {className: "slds-accordion__summary-content", title: metadataObject.xmlName}, metadataObject.xmlName + (metadataObject.expanded ? " (" + metadataObject.childXmlNames.length + ")" : ""))
            )
          )
        ),
        metadataObject.expanded && h("div", {className: "slds-accordion__content", id: "accordion-details-" + metadataObject.xmlName},
          renderChildren(metadataObject.childXmlNames, metadataObject.xmlName)
        )
      )
    );
  }
}

{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  let deployRequestId = args.get("deployRequestId");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model(sfHost);
    model.startLoading();
    if (deployRequestId?.startsWith("0Af")) {
      model.deployRequestId = deployRequestId;
      model.getDeploymentComponentsAndPackageXml(deployRequestId);
    }
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);
  });
}
