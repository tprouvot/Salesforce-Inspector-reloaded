import {sfConn, apiVersion, XML} from "./inspector.js";
import Toast from "./components/Toast.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, createSpinForMethod, copyToClipboard} from "./utils.js";
import ConfirmModal from "./components/ConfirmModal.js";
import {Spinner} from "./components/Spinner.js";

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
    this.logMessages = [];
    this.progress = "ready";
    this.statusLink = null;
    this.metadataObjects = [];
    this.metadataTypeMap = {}; // Map of xmlName to metadata object with suffix
    this.includeManagedPackage = localStorage.getItem("includeManagedMetadata") === "true";
    this.sortMetadataBy = JSON.parse(localStorage.getItem("sortMevetadataBy")) || "fullName";
    this.packageXml;
    this.metadataFilter = "";
    this.deployRequestId;
    this.allSelected = false;
    this.orgName = "";
    let deployOptions = localStorage.getItem("deployOptions");
    this.deployOptions = deployOptions ? JSON.parse(deployOptions) : {
      allowMissingFiles: false,
      checkOnly: false,
      ignoreWarnings: false,
      purgeOnDelete: false,
      singlePackage: false,
      performRetrieve: true,
      rollbackOnError: true,
      testLevel: "NoTestRun",
      runTests: null
    };

    // Initialize spinFor method
    this.spinFor = createSpinForMethod(this);

    // Initialize user info model - handles all user-related properties
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    // Set orgName from sfHost
    this.orgName = this.sfHost.split(".")[0]?.toUpperCase() || "";
  }

  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
    if (this.testCallback) {
      this.testCallback();
    }
  }

  title() {
    if (this.progress == "working") {
      return "(Loading) Metadata";
    }
    return "Metadata";
  }

  /**
   * Adds a custom metadata type that is not returned by describeMetadata
   * @param {string} xmlName - The XML name of the metadata type (e.g., "CustomField", "ValidationRule")
   * @param {string} suffix - The file suffix for this metadata type (e.g., "field", "validationRule")
   */
  addCustomMetadataType(xmlName, suffix) {
    // Add to metadataTypeMap for suffix lookup
    this.metadataTypeMap[xmlName] = {xmlName, suffix};

    // Add to metadataObjects array
    this.metadataObjects.push({
      xmlName,
      childXmlNames: [],
      isFolder: false,
      selected: false,
      expanded: false
    });
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

        // Store metadata type map for suffix lookup
        availableMetadataObjects.forEach(obj => {
          this.metadataTypeMap[obj.xmlName] = obj;
        });

        this.metadataObjects = availableMetadataObjects.map(obj => ({...obj, isFolder: false}));

        // Add custom metadata types that are not returned by describeMetadata
        this.addCustomMetadataType("CustomField", "field");
        this.addCustomMetadataType("ValidationRule", "validationRule");
        this.addCustomMetadataType("WorkflowRule", "workflow");
        this.addCustomMetadataType("BusinessProcess", "businessProcess");

        // Sort metadata objects alphabetically
        this.metadataObjects.sort((a, b) => a.xmlName < b.xmlName ? -1 : a.xmlName > b.xmlName ? 1 : 0);

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
            // Store in metadataTypeMap if not already present (for suffix lookup)
            if (!this.metadataTypeMap[componentType]) {
              this.metadataTypeMap[componentType] = {xmlName: componentType, suffix: "xml"};
            }
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
      const blob = new Blob([zipBin], {type: "application/zip"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "metadata.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

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

  formatXml(xmlString) {
    // Parse the XML string
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Use XSLT to format the XML with indentation
    const xsltDoc = parser.parseFromString([
      '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
      '  <xsl:strip-space elements="*"/>',
      '  <xsl:template match="node()|@*">',
      '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
      "  </xsl:template>",
      '  <xsl:output indent="yes"/>',
      "</xsl:stylesheet>"
    ].join("\n"), "application/xml");

    const xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    const resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    const formattedXml = new XMLSerializer().serializeToString(resultDoc);
    return formattedXml;
  }

  getMetadataFormat(metadataType) {
    // Code-based metadata types that have a 'body' field with source code
    const codeBasedTypes = ["ApexClass", "ApexTrigger"];
    // HTML/Markup-based metadata types that have 'content' or 'markup' field
    const markupBasedTypes = ["ApexPage", "ApexComponent"];

    if (codeBasedTypes.includes(metadataType)) {
      return "code";
    } else if (markupBasedTypes.includes(metadataType)) {
      return "markup";
    }
    // Default to XML format
    return "xml";
  }

  shouldUseToolingApi(metadataType) {
    // Metadata types that should use Tooling API directly instead of readMetadata
    return ["ApexClass", "ApexTrigger", "ApexPage"].includes(metadataType);
  }

  async retrieveSingleMetadata(metadataType, metadataName) {
    try {
      // For metadata types that should use Tooling API directly (ApexClass, ApexTrigger, ApexPage)
      // use Tooling API as readMetadata may not be supported for these types
      if (this.shouldUseToolingApi(metadataType)) {
        return await this.retrieveMetadataViaTooling(metadataType, metadataName);
      }

      // For other metadata types, use readMetadata
      return await this.retrieveViaReadMetadata(metadataType, metadataName);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async retrieveViaReadMetadata(metadataType, metadataName) {
    let metadataApi = sfConn.wsdl(apiVersion, "Metadata");

    // Use readMetadata which returns metadata directly without ZIP
    // See: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
    let result = await sfConn.soap(metadataApi, "readMetadata", {
      type: metadataType,
      fullNames: metadataName === "*" ? [] : [metadataName]
    });

    // Handle case where result might be a JSON string
    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch {
        // If parsing fails, result is already an object
      }
    }

    // readMetadata returns an object with a 'records' property
    // records can be either an array or a single object
    if (!result || !result.records) {
      throw new Error("No metadata found");
    }

    // Convert records to array if it's a single object
    let recordsArray = Array.isArray(result.records) ? result.records : [result.records];

    if (recordsArray.length === 0) {
      throw new Error("No metadata found");
    }

    // Get the first metadata record
    const metadataRecord = recordsArray[0];
    const format = this.getMetadataFormat(metadataType);

    // Handle different metadata formats
    if (format === "code") {
      // For ApexClass and ApexTrigger, extract the body field
      const body = metadataRecord.body || metadataRecord.content || "";
      return {
        content: body,
        format: "code",
        language: "markup" // Prism doesn't have Java/Apex, use markup for basic display
      };
    } else if (format === "markup") {
      // For ApexPage and ApexComponent, extract content or markup field
      const content = metadataRecord.content || metadataRecord.markup || "";
      return {
        content,
        format: "markup",
        language: "markup"
      };
    } else {
      // XML format - convert metadata object to XML
      const xmlContent = XML.stringify({
        name: metadataType,
        attributes: ' xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        value: metadataRecord
      });

      // Format the XML with proper indentation
      const formattedXml = this.formatXml(xmlContent);
      return {
        content: formattedXml,
        format: "xml",
        language: "markup"
      };
    }
  }

  async retrieveMetadataViaTooling(metadataType, metadataName) {
    // Use Tooling API to retrieve metadata source code/markup
    // Tooling API REST endpoint: /services/data/v{version}/tooling/query/
    const format = this.getMetadataFormat(metadataType);

    let toolingObject;
    let fields;

    if (metadataType === "ApexClass" || metadataType === "ApexTrigger") {
      toolingObject = metadataType;
      fields = "Id, Name, Body";
    } else if (metadataType === "ApexPage") {
      toolingObject = "ApexPage";
      fields = "Id, Name, Markup";
    } else {
      throw new Error(`Tooling API not supported for metadata type: ${metadataType}`);
    }

    const query = `SELECT ${fields} FROM ${toolingObject} WHERE Name = '${metadataName.replace(/'/g, "''")}'`;
    const result = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(query)}`);

    if (!result || !result.records || result.records.length === 0) {
      throw new Error("No metadata found");
    }

    const record = result.records[0];

    // Extract content based on metadata type
    let content;
    if (metadataType === "ApexPage") {
      content = record.Markup || "";
    } else {
      content = record.Body || "";
    }

    // Determine language for Prism syntax highlighting
    let language;
    if (metadataType === "ApexPage") {
      language = "markup";
    } else {
      language = "apex"; // Prism doesn't have Java/Apex, use markup for basic display
    }

    return {
      content,
      format,
      language
    };
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
    this.onViewMetadata = this.onViewMetadata.bind(this);
    this.onCloseMetadataModal = this.onCloseMetadataModal.bind(this);
    this.onCopyMetadataXml = this.onCopyMetadataXml.bind(this);
    this.onDownloadMetadataXml = this.onDownloadMetadataXml.bind(this);
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
    // Highlight XML in modal if it's open
    if (this.state.showMetadataModal) {
      setTimeout(() => {
        if (window.Prism) {
          const modalCode = document.getElementById("metadata-xml-content");
          if (modalCode) {
            window.Prism.highlightElement(modalCode);
          }
        }
      }, 0);
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

            if (deployResult.done == "true" && deployResult.details) {
              // Check for component failures
              if (deployResult.details.componentFailures) {
                const failures = Array.isArray(deployResult.details.componentFailures)
                  ? deployResult.details.componentFailures
                  : [deployResult.details.componentFailures];

                if (failures.length > 0) {
                  const formattedFailures = failures.map((f, index) => {
                    const componentInfo = f.componentType ? `${f.componentType} "${f.fullName}"` : f.fullName;
                    return `[${index + 1}] ${componentInfo} : ${f.problem}`;
                  }).join("\n");
                  const error = new Error(formattedFailures);
                  error.id = deployResult.id;
                  throw error;
                }
              }
              if (deployResult.details.runTestResult
                && deployResult.details.runTestResult.failures
                && (
                  Array.isArray(deployResult.details.runTestResult.failures)
                    ? deployResult.details.runTestResult.failures.length > 0
                    : true
                )
              ) {
                const failures = Array.isArray(deployResult.details.runTestResult.failures)
                  ? deployResult.details.runTestResult.failures
                  : [deployResult.details.runTestResult.failures];

                const formattedFailures = failures.map((f, index) => `[${index + 1}] ${f.name}.${f.methodName} : ${f.message}\n${f.stackTrace || ""}`).join("\n");
                const error = new Error(formattedFailures);
                error.id = deployResult.id;
                throw error;
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
    this.setState({showToast: false, toastMessage: ""});
    model.didUpdate();
  }
  getLanguageForMetadata(metadataType) {
    if (!metadataType) return "markup";
    if (metadataType === "ApexPage") return "markup";
    if (metadataType === "ApexClass" || metadataType === "ApexTrigger") return "apex";
    return "markup"; // default
  }
  async onViewMetadata(metadataType, metadataName) {
    let {model} = this.props;
    this.setState({
      showMetadataModal: true,
      metadataXmlContent: "Loading...",
      metadataFileName: metadataName,
      metadataType
    });
    model.didUpdate();

    model.spinFor(
      model.retrieveSingleMetadata(metadataType, metadataName).then(result => {
        if (result && result.content) {
          this.setState({
            metadataXmlContent: result.content,
            metadataFileName: metadataName,
            metadataType
          });
        } else {
          this.setState({
            metadataXmlContent: "No content found",
            metadataFileName: metadataName,
            metadataType
          });
        }
        model.didUpdate();
      }).catch(error => {
        console.error(error);
        this.setState({
          metadataXmlContent: "Error retrieving metadata: " + error.message,
          metadataFileName: metadataName,
          metadataType
        });
        model.didUpdate();
      })
    );
  }
  onCloseMetadataModal() {
    this.setState({
      showMetadataModal: false,
      metadataXmlContent: null,
      metadataFileName: null,
      metadataType: null
    });
    this.props.model.didUpdate();
  }
  onCopyMetadataXml() {
    const {metadataXmlContent} = this.state;
    if (!metadataXmlContent || metadataXmlContent === "Loading..." || metadataXmlContent.startsWith("Error")) {
      return;
    }
    copyToClipboard(metadataXmlContent);
    let {model} = this.props;
    this.setState({
      showToast: true,
      toastMessage: "Metadata copied to clipboard",
      toastVariant: "success",
      toastTitle: "Success"
    });
    setTimeout(this.hideToast, 3000);
    model.didUpdate();
  }
  onDownloadMetadataXml() {
    const {metadataXmlContent, metadataFileName, metadataType} = this.state;
    if (!metadataXmlContent || metadataXmlContent === "Loading..." || metadataXmlContent.startsWith("Error")) {
      return;
    }
    let {model} = this.props;

    // Get file extension from metadata type suffix
    let fileExtension = "xml"; // default fallback
    if (metadataType && model.metadataTypeMap[metadataType] && model.metadataTypeMap[metadataType].suffix) {
      fileExtension = model.metadataTypeMap[metadataType].suffix;
    }

    // Derive format from metadata type to determine MIME type
    const metadataFormat = model.getMetadataFormat(metadataType);
    let mimeType = "text/xml";
    if (metadataFormat === "code") {
      mimeType = "text/plain";
    } else if (metadataFormat === "markup") {
      mimeType = "text/html";
    }

    const blob = new Blob([metadataXmlContent], {type: mimeType});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (metadataFileName || "metadata") + "." + fileExtension;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
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
        this.state.showMetadataModal && h(ConfirmModal, {
          isOpen: this.state.showMetadataModal,
          title: "Metadata: " + (this.state.metadataFileName || ""),
          onCancel: this.onCloseMetadataModal,
          onCopy: this.onCopyMetadataXml,
          copyLabel: "Copy",
          copyIconName: "symbols.svg#copy",
          onConfirm: this.onDownloadMetadataXml,
          confirmLabel: "Download",
          confirmIconName: "symbols.svg#download",
          cancelLabel: "Close",
          children: h("div", {style: {maxHeight: "60vh", overflow: "auto"}},
            h("pre", {className: "reset-margin"},
              h("code", {
                id: "metadata-xml-content",
                className: "language-" + (this.getLanguageForMetadata(this.state.metadataType))
              }, this.state.metadataXmlContent || "")
            )
          )
        }),
        h(PageHeader, {
          pageTitle: model.title(),
          subTitle: model.progress == "ready" ? "Ready"
          : model.progress == "working" ? "Retrieving metadata..."
          : model.progress == "deploying" ? "Deploying metadata..."
          : model.progress == "done" ? "Finished"
          : "Error!",
          orgName: model.orgName,
          sfLink: model.sfLink,
          sfHost: model.sfHost,
          spinnerCount: model.spinnerCount,
          ...model.userInfoModel.getProps()
        }),
        ((model.progress == "working" || model.progress == "deploying") || model.spinnerCount > 0)
        && h("div", {
          className: "sfir-spinner-overlay"
        },
        h(Spinner, {
          size: "large",
          type: "brand",
          text: model.progress == "working" ? "Retrieving metadata..." : (model.progress == "deploying" ? "Deploying metadata..." : "Loading..."),
          centered: false
        })
        ),
        h("div", {
          className: "slds-m-top_xx-large",
          style: {
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 4rem)"
          }
        },
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
          model.showOptions && h("div", {className: "options-text"},
            h("h2", {className: "slds-text-title_bold slds-col slds-size_1-of-1"}, "Deployment Settings"),
            h("div", {className: "slds-grid slds-grid_align-spread slds-wrap"},
              Object.entries(model.deployOptions)
                .filter(([_, value]) => typeof value === "boolean")
                .map(([key, value]) =>
                  h("div", {className: "slds-col slds-size_1-of-9 slds-p-around_x-small", key},
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
                )
            ),
            h("div", {className: "slds-grid slds-grid_align-spread"},
              h("div", {className: "slds-col slds-size_1-of-4 slds-p-around_x-small"},
                h("label", {className: "slds-form-element__label"}, "Test Level"),
                h("div", {className: "slds-form-element__control"},
                  h("select", {
                    className: "slds-select",
                    value: model.deployOptions.testLevel,
                    onChange: (e) => {
                      model.deployOptions.testLevel = e.target.value;
                      if (e.target.value === "RunSpecifiedTests") {
                        setTimeout(() => {
                          const specifiedTestsInput = document.querySelector('input[placeholder="Comma-separated test class names"]');
                          if (specifiedTestsInput) {
                            specifiedTestsInput.focus();
                          }
                        }, 0);
                      }
                      model.didUpdate();
                    }
                  },
                  h("option", {value: "NoTestRun"}, "No Test Run"),
                  h("option", {value: "RunSpecifiedTests"}, "Run Specified Tests"),
                  h("option", {value: "RunLocalTests"}, "Run Local Tests"),
                  h("option", {value: "RunAllTestsInOrg"}, "Run All Tests in Org")
                  )
                )
              ),
              model.deployOptions.testLevel === "RunSpecifiedTests" && h("div", {className: "slds-col slds-size_3-of-4 slds-p-around_x-small"},
                h("label", {className: "slds-form-element__label"}, "Specified Tests"),
                h("div", {className: "slds-form-element__control"},
                  h("input", {
                    type: "text",
                    className: "slds-input",
                    placeholder: "Comma-separated test class names",
                    value: model.deployOptions.runTests || "",
                    onChange: (e) => {
                      model.deployOptions.runTests = e.target.value;
                      model.didUpdate();
                    }
                  })
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
                    model.metadataObjects.map(metadataObject => h(ObjectSelector, {metadataObject, model, onViewMetadata: this.onViewMetadata, key: metadataObject.xmlName}))),
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
    this.onViewMetadataClick = this.onViewMetadataClick.bind(this);
    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    props.metadataObject.childXmlNames = [];
    this.state = {
      hoveredItem: null
    };
  }
  onMouseEnter(item) {
    this.setState({hoveredItem: item});
  }
  onMouseLeave() {
    this.setState({hoveredItem: null});
  }
  onViewMetadataClick(e, metadataType, metadataName) {
    e.stopPropagation();
    if (this.props.onViewMetadata) {
      this.props.onViewMetadata(metadataType, metadataName);
    }
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
    } else if ((metadataObject.xmlName == "Dashboard" || metadataObject.xmlName == "Document") && !metadataObject.isFolder){
      return {xmlName: metadataObject.xmlName + "Folder"};
    } else if (metadataObject.xmlName == "EmailTemplate" && !metadataObject.isFolder){
      return {xmlName: "EmailFolder"};
    } else {
      return metadataObject;
    }
  }

  /**
   * Checks if a metadata type should use REST API query instead of listMetadata
   * @param {string} metaType - The metadata type XML name
   * @returns {boolean} - True if this metadata type should use REST API query
   */
  shouldUseRestApiForList(metaType){
    // List of metadata types that require REST API query for listing
    const restApiTypes = ["ApprovalProcess"];
    return restApiTypes.includes(metaType);
  }

  /**
   * Generic method to query REST API for metadata items
   * @param {Object} params - Query parameters
   * @param {string} params.metaName - Field name to select for metadata name (e.g., "DeveloperName")
   * @param {string} params.folderName - Field name to select for folder/object name (e.g., "TableEnumOrId")
   * @param {string} params.objectName - Object name to query (e.g., "ProcessDefinition")
   * @returns {Promise<Array>} - Array of metadata items
   */
  async queryMetadataViaRest({metaName, folderName, objectName}){
    const query = `SELECT ${metaName}, ${folderName} FROM ${objectName}`;
    const allRecords = [];
    let queryUrl = `/services/data/v${apiVersion}/query/?q=` + encodeURIComponent(query);

    while (queryUrl) {
      const res = await sfConn.rest(queryUrl);
      if (res.records) {
        allRecords.push(...res.records);
      }
      queryUrl = res.nextRecordsUrl || null;
    }

    return allRecords;
  }

  /**
   * Builds child metadata objects from REST API records
   * @param {Object} model - The model instance
   * @param {Object} meta - The parent metadata object
   * @param {Array} records - Array of REST API records
   * @param {string} metaNameField - Field name that contains the metadata name (e.g., "DeveloperName")
   * @param {string} folderNameField - Field name that contains the folder/object name (e.g., "TableEnumOrId")
   */
  buildChildMetadataFromRest(model, meta, records, metaNameField, folderNameField){
    meta.childXmlNames = []; // Reset children

    records.forEach(record => {
      // Build fullName: ObjectName.MetadataName or just MetadataName if no folderNameField
      const metaNameValue = record[metaNameField];
      const folderNameValue = folderNameField ? record[folderNameField] : null;

      const fullName = folderNameValue && metaNameValue
        ? `${folderNameValue}.${metaNameValue}`
        : metaNameValue;

      const childMeta = {
        fullName,
        type: meta.xmlName,
        parent: meta,
        selected: false,
        isFolder: false
      };

      // Apply managed package filter if needed
      if (model.includeManagedPackage || (!model.includeManagedPackage && !record.NamespacePrefix)) {
        if (!meta.childXmlNames.some(existingElt => existingElt.fullName === childMeta.fullName)) {
          meta.childXmlNames.push(childMeta);
        }
      }
    });

    meta.childXmlNames.sort((a, b) => a[model.sortMetadataBy] > b[model.sortMetadataBy] ? 1 : a[model.sortMetadataBy] < b[model.sortMetadataBy] ? -1 : 0);
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

      // Check if this metadata type should use REST API query
      if (this.shouldUseRestApiForList(meta.xmlName)) {
        model.spinFor(
          this.queryMetadataViaRest({
            metaName: "DeveloperName",
            folderName: "TableEnumOrId",
            objectName: "ProcessDefinition"
          }).then(records => {
            this.buildChildMetadataFromRest(model, meta, records, "DeveloperName", "TableEnumOrId");
          })
        );
      } else {
        // Use standard listMetadata API
        let metaFolderProof = this.getMetaFolderProof(meta);
        model.spinFor(
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
      }
    } else {
      //call refresh filter
    }
    model.didUpdate();
  }

  render() {
    let {metadataObject} = this.props;

    const renderChildren = (children, parentXmlName, parentType) => {
      if (!children || children.length === 0) {
        return null;
      }

      return h("ul", {className: "slds-accordion", key: parentXmlName + "_children"},
        children.map(child => {
          const metadataType = child.type || parentType || metadataObject.xmlName;
          const metadataName = child.fullName;
          const isHovered = this.state.hoveredItem === child.fullName;
          const itemKey = parentXmlName + "_li_" + child.fullName;

          return h("li", {key: itemKey, className: "slds-accordion__list-item", hidden: child.hidden},
            h("section", {className: child.expanded ? "slds-accordion__section slds-is-open" : "slds-accordion__section"},
              h("div", {
                className: "slds-accordion__summary",
                title: child.fullName,
                onClick: (e) => this.onSelectChild(child, e),
                onMouseEnter: () => !child.isFolder && this.onMouseEnter(child.fullName),
                onMouseLeave: () => this.onMouseLeave(),
                style: {position: "relative"}
              },
              h("h4", {className: "slds-accordion__summary-heading"},
                h("button", {"aria-controls": "accordion-details-" + child.fullName, "aria-expanded": child.expanded, className: "slds-button slds-button_reset slds-accordion__summary-action"},
                  child.isFolder ? h("svg", {className: "reset-transform slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
                    h("use", {xlinkHref: "symbols.svg#" + (child.icon ? child.icon : "chevronright")})
                  ) : null,
                  h("input", {type: "checkbox", className: !child.isFolder ? "margin-grandchild metadata" : "metadata", checked: !!child.selected}),
                  h("span", {
                    className: "slds-text-body_small slds-accordion__summary-content",
                    title: child.fullName,
                    style: {display: "inline-flex", alignItems: "center", gap: "0.5rem"}
                  },
                  child.fullName + (child.expanded ? " (" + child.childXmlNames.length + ")" : ""),
                  !child.isFolder && isHovered && !metadataType.toLowerCase().includes("bundle") && h("svg", {
                    className: "slds-icon slds-icon_x-small slds-icon-text-default",
                    style: {cursor: "pointer", flexShrink: 0},
                    viewBox: "0 0 52 52",
                    onClick: (e) => this.onViewMetadataClick(e, metadataType, metadataName),
                    title: "View metadata"
                  },
                  h("use", {xlinkHref: "symbols.svg#preview"})
                  )
                  )
                )
              )
              ),
              child.expanded && h("div", {className: "slds-accordion__content", id: "accordion-details-" + child.fullName},
                renderChildren(child.childXmlNames, child.fullName, metadataType)
              )
            )
          );
        })
      );
    };

    const isHovered = this.state.hoveredItem === metadataObject.xmlName;
    return h("li", {className: "slds-accordion__list-item", hidden: metadataObject.hidden, key: metadataObject.xmlName},
      h("section", {className: metadataObject.expanded ? "slds-accordion__section slds-is-open" : "slds-accordion__section"},
        h("div", {
          className: "slds-accordion__summary",
          title: metadataObject.xmlName,
          onClick: (event) => { this.onSelectMeta(event); }
        },
        h("h3", {className: "slds-accordion__summary-heading"},
          h("button", {"aria-controls": "accordion-details-" + metadataObject.xmlName, "aria-expanded": metadataObject.expanded, className: "slds-button slds-button_reset slds-accordion__summary-action"},
            h("svg", {className: "reset-transform slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#" + (metadataObject.icon ? metadataObject.icon : "chevronright")})
            ),
            h("input", {type: "checkbox", className: "metadata", checked: !!metadataObject.selected, onChange: this.onChange, key: metadataObject.xmlName}),
            h("span", {
              className: "slds-accordion__summary-content",
              title: metadataObject.xmlName
            },
            metadataObject.xmlName + (metadataObject.expanded ? " (" + metadataObject.childXmlNames.length + ")" : "")
            )
          )
        )
        ),
        metadataObject.expanded && h("div", {className: "slds-accordion__content", id: "accordion-details-" + metadataObject.xmlName},
          renderChildren(metadataObject.childXmlNames, metadataObject.xmlName, metadataObject.xmlName)
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
