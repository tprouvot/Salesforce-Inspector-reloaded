/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton lightningflowscanner */

/**
 * Normalizes severity levels between UI display and storage formats
 * @param {string} sev - The severity level to normalize
 * @param {string} direction - Direction of normalization ('ui' or 'storage')
 * @returns {string} Normalized severity level
 */
const normalizeSeverity = (sev, direction = "ui") => {
  if (direction === "ui") return sev === "note" ? "info" : sev;
  if (direction === "storage") return sev === "info" ? "note" : sev;
  return sev;
};

/**
 * FlowScanner class - Core functionality for analyzing Salesforce Flows.
 * This class handles fetching flow metadata from Salesforce, running the
 * analysis using the core scanner library, and displaying the results in the UI.
 */
class FlowScanner {
  /**
   * Creates a new FlowScanner instance.
   * @param {string} sfHost - Salesforce host URL.
   * @param {string} flowDefId - Flow definition ID.
   * @param {string} flowId - Flow ID for a specific version.
   */
  constructor(sfHost, flowDefId, flowId) {
    this.sfHost = sfHost;
    this.flowDefId = flowDefId;
    this.flowId = flowId;
    this.currentFlow = null;
    this.scanResults = [];
    this.flowScannerCore = null;
    this.isScanning = false;
    this._elementMap = new Map();
  }

  /**
   * Initializes the FlowScanner, loads flow data, and starts the scan.
   */
  async init() {
    this.initFlowScannerCore();
    await this.loadFlowInfo();
    await this.scanFlow();
  }

  /**
   * Initializes the Flow Scanner Core library.
   * @throws {Error} If the core library is not found.
   */
  initFlowScannerCore() {
    try {
      if (typeof lightningflowscanner !== "undefined") {
        this.flowScannerCore = lightningflowscanner;
      } else {
        this.flowScannerCore = null;
        throw new Error("Flow Scanner Core library not loaded. Please ensure flow-scanner-core.js is properly included.");
      }
    } catch (error) {
      this.flowScannerCore = null;
      throw error;
    }
  }

  /**
   * Determines the link target based on user settings and keyboard modifiers.
   * @param {Event} e - The click event (may be undefined for programmatic use)
   * @returns {string} '_blank' or '_self'
   */
  getLinkTarget(e) {
    return localStorage.getItem("openLinksInNewTab") == "true" || (e && (e.ctrlKey || e.metaKey)) ? "_blank" : "_self";
  }

  /**
   * Handles the export button click to generate and download CSV results
   */
  handleExportClick() {
    if (this.scanResults.length === 0) {
      return;
    }

      // Define the headers for the CSV file.
      const csvHeaders = [
        "ruleDescription",
        "ruleLabel",
        "flowName",
        "name",
        "apiName",
        "label",
        "type",
        "metaType",
        "dataType",
        "locationX",
        "locationY",
        "connectsTo",
        "expression"
      ];

      const csvRows = [csvHeaders.join(",")];

      // Convert each scan result into a CSV row.
      this.scanResults.forEach(result => {
        const row = csvHeaders.map(header => {
          const value = result[header] || "";
          // Escape quotes and wrap value in quotes for CSV format.
          const escapedValue = value.toString().replace(/"/g, '""');
          return `"${escapedValue}"`;
        });
        csvRows.push(row.join(","));
      });

      // Create a Blob and trigger a download.
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], {type: "text/csv"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flow-scan-" + this.currentFlow.name + "-" + new Date().toISOString().split("T")[0] + ".csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }

  /**
   * Fetches flow metadata from the Salesforce API and updates the UI.
   */
  async loadFlowInfo() {
    try {
      if (!this.flowDefId || !this.flowId) {
        this.showError("No flow information found in URL");
        return;
      }
      const flowInfo = await this.getFlowMetadata();
      this.currentFlow = flowInfo;
    } catch (error) {
      this.showError("Failed to load flow information: " + error.message);
    }
  }

  /**
   * Retrieves flow metadata from Salesforce API
   * @returns {Object} Flow metadata information
   * @throws {Error} If API calls fail
   */
  async getFlowMetadata() {
    try {
      // Add cache-busting parameter to force fresh queries
      const cacheBuster = Math.random();

      // Query both Flow and FlowDefinitionView objects to get complete metadata
      const [flowRes, fdvRes] = await Promise.all([
        sfConn.rest(`/services/data/v${apiVersion}/tooling/query?q=SELECT+Id,Metadata+FROM+Flow+WHERE+Id='${this.flowId}'&cache=${cacheBuster}`),
        sfConn.rest(`/services/data/v${apiVersion}/query/?q=SELECT+Label,ApiName,ProcessType,TriggerType,TriggerObjectOrEventLabel+FROM+FlowDefinitionView+WHERE+DurableId='${this.flowDefId}'&cache=${cacheBuster}`)
      ]);

      const flowRecord = flowRes.records?.[0];
      const flowDefView = fdvRes.records?.[0];

      if (!flowRecord || !flowDefView) {
        throw new Error("Flow or FlowDefinitionView not found");
      }

      // Extract and normalize flow metadata from API responses
      const xmlData = flowRecord?.Metadata || {};
      const triggerObjectLabel = flowDefView?.TriggerObjectOrEventLabel || "—";
      const triggerType = flowDefView?.TriggerType || xmlData?.triggerType || null;
      const processType = flowDefView?.ProcessType || xmlData?.processType || null;
      const status = flowRecord?.Metadata?.status || "Unknown";
      const label = flowDefView?.Label || xmlData.label || xmlData.interviewLabel || flowDefView?.ApiName || "Unknown Label";
      const apiName = flowDefView?.ApiName || "Unknown API Name";

      // Determine flow type based on metadata
      let type = xmlData?.processType || flowDefView?.ProcessType || "Flow";
      if (Array.isArray(xmlData?.screens) && xmlData.screens.length > 0) {
        type = "ScreenFlow";
      }
      const showProcessType = !(type && processType && type === processType);

      // Construct complete flow information object
      const result = {
        id: this.flowId,
        definitionId: this.flowDefId,
        name: apiName,
        label,
        apiName,
        type,
        status,
        xmlData,
        triggerObjectLabel,
        triggerType,
        processType,
        showProcessType
      };

      return result;
    } catch (error) {
      throw new Error("Failed to fetch flow metadata: " + error.message);
    }
  }

  /**
   * Builds a map of flow element API names to their labels for easy lookup.
   * This is used to display human-readable labels in the scan results.
   * @private
   */
  _buildElementMap() {
    this._elementMap = new Map();
    if (!this.currentFlow || !this.currentFlow.xmlData) {
      return;
    }

    // Define all categories of elements that can exist in flow metadata XML.
    const xmlData = this.currentFlow.xmlData;
    const elementTypes = [
      "actionCalls",
      "assignments",
      "collectionProcessors",
      "decisions",
      "faultPaths",
      "formulas",
      "loops",
      "recordCreates",
      "recordDeletes",
      "recordLookups",
      "recordUpdates",
      "screens",
      "start",
      "subflows",
      "switches",
      "waits",
      "transforms",
      "customErrors",
      "apexPluginCalls",
      "steps",
      "orchestratedStages",
      "recordRollbacks",
      "constants",
      "variables",
      "textTemplates",
      "choices",
      "dynamicChoiceSets"
    ];

    // Iterate through each category and map element names to labels.
    elementTypes.forEach(elementType => {
      if (xmlData[elementType]) {
        const elements = Array.isArray(xmlData[elementType]) ? xmlData[elementType] : [xmlData[elementType]];
        elements.forEach(element => {
          if (element.name) {
            this._elementMap.set(element.name, element.label);
          }
        });
      }
    });
  }

  /**
   * Initiates the flow scanning process. It checks for enabled rules,
   * performs the scan, and displays the results.
   */
  async scanFlow() {
    if (!this.currentFlow) {
      this.showError("No flow loaded");
      return;
    }

    this.isScanning = true;

    try {
      // Ensure the core scanner library is available.
      if (!this.flowScannerCore) {
        throw new Error("Flow Scanner Core library not available");
      }

      const flow = new this.flowScannerCore.Flow(this.currentFlow.name, this.currentFlow.xmlData);
      const parsedFlow = {flow, name: this.currentFlow.name};

      // Build a reference map of element names to labels.
      this._buildElementMap();

      // Retrieve enabled rules from user settings in localStorage.
      const storedRaw = localStorage.getItem("flowScannerRules");
      let stored = [];
      try {
        stored = JSON.parse(storedRaw || "[]");
      } catch {
        stored = [];
      }
      const customRules = JSON.parse(localStorage.getItem("flowScannerCustomRules") || "[]");
      customRules.forEach(cr => {
        if (!stored.find(r => r.name === cr.name)) {
          stored.push({
            name: cr.name,
            label: cr.label,
            description: cr.description,
            checked: true,
            severity: cr.severity,
            path: cr.path,
            config: {path: cr.path}
          });
        }
      });

      // Normalize the format of stored rules.
      if (!Array.isArray(stored)) {
        if (stored && typeof stored === "object") {
          stored = Object.entries(stored).map(([name, checked]) => ({name, checked: !!checked}));
        } else {
          stored = [];
        }
      }

      // Get the list of enabled rule names.
      const selected = stored.filter(c => c.checked).map(c => c.name);

      // If no rules are enabled, show an error and stop.
      if (selected.length === 0) {
        this.showError("No Flow Scanner rules are enabled. Please go to the Options page and enable at least one rule in the Flow Scanner tab.");
        return;
      }

      // Separate built-in and custom rules
      const builtInRuleNames = selected.filter(name => !stored.find(r => r.name === name && (r.path || r.code)));
      const customRuleDefs = stored.filter(r => r.checked && (r.path || r.code));

      let results = [];
      let customAPIVersionResult = null;

      // Run built-in rules
      if (builtInRuleNames.length > 0) {
        const ruleConfig = {rules: {}};
        builtInRuleNames.forEach(name => {
          const storedRule = stored.find(r => r.name === name);
          const ruleConfigEntry = storedRule?.config || {};
          const severity = storedRule?.severity || "error";
          const scannerSeverity = normalizeSeverity(severity, "storage");

          if (name === "FlowName") {
            const namingRegex = ruleConfigEntry.expression || "[A-Za-z0-9]+_[A-Za-z0-9]+";
            if (namingRegex) {
              ruleConfig.rules.FlowName = {expression: namingRegex, severity: scannerSeverity};
            }
          } else if (name === "APIVersion") {
            let minVersion = 50; // default

            if (ruleConfigEntry.threshold !== undefined) {
              minVersion = parseInt(ruleConfigEntry.threshold, 10);
            } else if (ruleConfigEntry.expression !== undefined) {
              const expressionValue = ruleConfigEntry.expression;
              if (typeof expressionValue === "string" && expressionValue.includes("<")) {
                minVersion = parseInt(expressionValue.replace(/[<>]/g, ""), 10);
              } else {
                minVersion = parseInt(expressionValue, 10);
              }
            }

            if (isNaN(minVersion)) {
              minVersion = 50; // fallback to default
            }

            ruleConfig.rules.APIVersion = {expression: `>=${minVersion}`, severity: scannerSeverity};
          } else if (name === "AutoLayout") {
            const enabled = ruleConfigEntry.enabled !== false;
            if (enabled) {
              ruleConfig.rules.AutoLayout = {severity: scannerSeverity};
            }
          } else if (name === "CyclomaticComplexity") {
            const threshold = ruleConfigEntry.threshold || 25;
            ruleConfig.rules.CyclomaticComplexity = {threshold, severity: scannerSeverity};
          } else if (name === "ProcessBuilder") {
            const enabled = ruleConfigEntry.enabled !== false;
            if (enabled) {
              ruleConfig.rules.ProcessBuilder = {severity: scannerSeverity};
            }
          } else {
            ruleConfig.rules[name] = {severity: scannerSeverity};
          }
        });

        if (ruleConfig.rules.APIVersion && this.currentFlow) {
          const flowApiVersion = this.currentFlow.apiVersion || this.currentFlow.xmlData?.apiVersion;
          const minVersion = parseInt(ruleConfig.rules.APIVersion.expression.replace(/[>=<]/g, ""));
          const operator = ruleConfig.rules.APIVersion.expression.replace(/[0-9]/g, "");
          let isViolation = false;
          switch (operator) {
            case ">=": isViolation = flowApiVersion < minVersion; break;
            case "<=": isViolation = flowApiVersion > minVersion; break;
            case ">": isViolation = flowApiVersion <= minVersion; break;
            case "<": isViolation = flowApiVersion >= minVersion; break;
            case "==": case "=": isViolation = flowApiVersion !== minVersion; break;
            default: isViolation = flowApiVersion < minVersion;
          }
          if (isViolation) {
            const severity = this.mapSeverity(ruleConfig.rules.APIVersion.severity);
            const expression = `Current: ${flowApiVersion}, Required: ${ruleConfig.rules.APIVersion.expression}`;
            customAPIVersionResult = {
              rule: "Outdated API Version",
              description: "The API version of the flow is outdated.",
              severity,
              details: `Flow API Version: ${flowApiVersion} | Required: ${ruleConfig.rules.APIVersion.expression}`,
              affectedElements: [{elementName: "Flow API Version", elementType: "apiVersion", expression}],
              ruleDescription: "The API version of the flow is outdated.",
              ruleLabel: "Outdated API Version",
              flowName: this.currentFlow.name,
              name: "Flow API Version",
              type: "apiVersion",
              expression
            };
          }
          delete ruleConfig.rules.APIVersion;
        }

        const scanResults = this.flowScannerCore.scan([parsedFlow], ruleConfig);
        results.push(...this.processScanResults(scanResults));
      }

      for (const customRuleDef of customRuleDefs) {
        try {
          let getCode;
          if (customRuleDef.code) {
            getCode = Promise.resolve(customRuleDef.code);
          } else if (customRuleDef.path) {
            getCode = fetch(customRuleDef.path).then(res => {
              if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
              return res.text();
            });
          } else {
            continue; // Should not happen due to filter
          }

          const code = await getCode;
          const blob = new Blob([code], {type: "application/javascript"});
          const url = URL.createObjectURL(blob);
          const module = await import(url);
          URL.revokeObjectURL(url);

          const CustomRuleClass = module[customRuleDef.name] || module.default;
          if (typeof CustomRuleClass !== "function") {
            const errorLocation = customRuleDef.path ? `in ${customRuleDef.path}` : "in the provided code";
            throw new Error(`Could not find class '${customRuleDef.name}' ${errorLocation}. Make sure the class is exported correctly.`);
          }

          const ruleInstance = new CustomRuleClass();
          const ruleResult = ruleInstance.execute(parsedFlow.flow, customRuleDef.config);

          const processedCustomResult = this.processScanResults([{
            flow: parsedFlow,
            ruleResults: [ruleResult]
          }]);
          results.push(...processedCustomResult);

        } catch (error) {
          results.push({
            rule: `Custom Rule Error: ${customRuleDef.name}`,
            description: `Failed to load or execute custom rule: ${error.message}`,
            severity: "error",
            details: `Path: ${customRuleDef.path || "Pasted Code"}\n${error.stack}`,
            affectedElements: []
          });
        }
      }

      if (customAPIVersionResult) {
        results.push(customAPIVersionResult);
      }

      this.scanResults = results;
    } catch (error) {
      this.showError("Failed to scan flow: " + error.message);
      this.scanResults = [{
        rule: "Scan Error",
        description: "Failed to scan flow: " + error.message,
        severity: "error",
        details: "Flow: " + (this.currentFlow ? this.currentFlow.name : "Unknown")
      }];
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Processes results from the core scanner into a display-friendly format.
   * @param {Array} scanResults - The raw results from the core scanner.
   * @returns {Array} An array of formatted violation objects.
   */
  processScanResults(scanResults) {
    const results = [];

    for (const flowResult of scanResults) {
      if (flowResult.errorMessage) {
        results.push({
          rule: "Scan Error",
          description: "Failed to scan flow: " + flowResult.errorMessage,
          severity: "error",
          details: "Flow: " + this.currentFlow.name
        });
        continue;
      }

      const ruleResults = flowResult.ruleResults || flowResult.results || flowResult.issues || [];

      for (const ruleResult of ruleResults) {
        if (!ruleResult.occurs) {
          continue;
        }

        if (ruleResult.ruleName === "APIVersion" && ruleResult.errorMessage && ruleResult.errorMessage.includes("unsafe-eval")) {
          continue;
        }

        const ruleDescription = ruleResult.ruleDefinition?.description || "No description available";
        const ruleLabel = ruleResult.ruleDefinition?.label || ruleResult.ruleName;

        if (ruleResult.details && ruleResult.details.length > 0) {
          for (const detail of ruleResult.details) {
            const elementName = detail.name || detail.violation?.name || "Unknown";
            const elementLabelFromCore = detail.label || detail.violation?.label;
            const elementLabel = elementLabelFromCore || this._elementMap.get(elementName) || "";
            const elementType = detail.type || detail.violation?.subtype || "Unknown";
            const metaType = detail.metaType || detail.violation?.metaType || "";
            const dataType = detail.dataType || "";
            const locationX = detail.details?.locationX || detail.violation?.locationX || "";
            const locationY = detail.details?.locationY || detail.violation?.locationY || "";
            const connectsTo = detail.details?.connectsTo || "";
            const expression = detail.details?.expression || detail.violation?.expression || "";
            const apiName = detail.apiName || detail.violation?.apiName || detail.name || detail.violation?.name || "";

            const result = {
              rule: ruleLabel,
              description: ruleDescription,
              severity: this.mapSeverity(ruleResult.severity),
              details: this.formatRuleDetails({
                elementName,
                elementType,
                metaType,
                dataType,
                locationX,
                locationY,
                connectsTo,
                expression
              }),
              affectedElements: [{
                elementName,
                elementType,
                metaType,
                dataType,
                locationX,
                locationY,
                connectsTo,
                expression,
                elementLabel,
                apiName
              }],
              ruleDescription,
              ruleLabel,
              flowName: this.currentFlow.name,
              name: elementName,
              type: elementType,
              label: elementLabel,
              apiName,
              metaType,
              dataType,
              locationX,
              locationY,
              connectsTo,
              expression
            };

            results.push(result);
          }
        } else {
          const result = {
            rule: ruleLabel,
            description: ruleDescription,
            severity: this.mapSeverity(ruleResult.severity),
            details: "Rule violation detected",
            affectedElements: [],
            ruleDescription,
            ruleLabel,
            flowName: this.currentFlow.name
          };
          results.push(result);
        }
      }
    }
    return results;
  }

  /**
   * Maps severity levels from the core scanner to the UI's format.
   * @param {string} coreSeverity - The severity level from the core scanner (e.g., 'critical', 'warning').
   * @returns {string} The corresponding severity level for the UI (e.g., 'error', 'warning').
   */
  mapSeverity(coreSeverity) {
    // Map Flow Scanner Core severity to our format
    switch (coreSeverity?.toLowerCase()) {
      case "error":
      case "critical":
        return "error";
      case "warning":
        return "warning";
      case "info":
      case "information":
        return "info";
      default:
        return "info";
    }
  }

  /**
   * Formats the details of a rule violation into a human-readable string.
   * @param {Object} ruleResult - An object containing details about the violation.
   * @returns {string} A formatted string summarizing the violation details.
   */
  formatRuleDetails(ruleResult) {
    const details = [];

    if (ruleResult.elementName) {
      details.push(`Element: ${ruleResult.elementName}`);
    }

    if (ruleResult.elementType) {
      details.push(`Type: ${ruleResult.elementType}`);
    }

    if (ruleResult.metaType) {
      details.push(`Meta Type: ${ruleResult.metaType}`);
    }

    if (ruleResult.dataType) {
      details.push(`Data Type: ${ruleResult.dataType}`);
    }

    if (ruleResult.locationX && ruleResult.locationY) {
      details.push(`Location: (${ruleResult.locationX}, ${ruleResult.locationY})`);
    }

    if (ruleResult.connectsTo) {
      details.push(`Connects to: ${ruleResult.connectsTo}`);
    }

    if (ruleResult.expression) {
      const truncatedExpression = ruleResult.expression.length > 100
        ? ruleResult.expression.substring(0, 100) + "..."
        : ruleResult.expression;
      details.push(`Expression: ${truncatedExpression}`);
    }

    return details.join(" | ");
  }

  /**
   * Extracts all elements from the current flow's metadata.
   * This is used to get a count of total elements and to build the element map.
   * @returns {Array} An array of flow element objects.
   */
  extractFlowElements() {
    if (!this.currentFlow || !this.currentFlow.xmlData) {
      return [];
    }

    const elements = [];
    const xmlData = this.currentFlow.xmlData;

    // A list of all possible element types in flow metadata XML.
    const elementTypes = [
      "actionCalls",
      "assignments",
      "collectionProcessors",
      "decisions",
      "faultPaths",
      "formulas",
      "loops",
      "recordCreates",
      "recordDeletes",
      "recordLookups",
      "recordUpdates",
      "screens",
      "start",
      "subflows",
      "switches",
      "waits",
      "transforms",
      "customErrors",
      "apexPluginCalls",
      "steps",
      "orchestratedStages",
      "recordRollbacks"
    ];

    // Iterate over each element type and add them to the elements array.
    elementTypes.forEach(elementType => {
      if (xmlData[elementType]) {
        if (Array.isArray(xmlData[elementType])) {
          xmlData[elementType].forEach(element => {
            elements.push({
              name: element.name || element.label || element.apiName || "Unknown",
              type: elementType,
              element
            });
          });
        } else if (typeof xmlData[elementType] === "object") {
          // Handle cases where there is only one element of a type.
          const element = xmlData[elementType];
          elements.push({
            name: element.name || element.label || element.apiName || elementType,
            type: elementType,
            element
          });
        }
      }
    });

    // Separately handle the start element.
    if (xmlData.start && typeof xmlData.start === "object") {
      elements.push({
        name: xmlData.start.name || "Start",
        type: "start",
        element: xmlData.start
      });
    }

    return elements;
  }

  /**
   * Shows an error message in the UI.
   * If the error is about disabled rules, it provides a button to open the options page.
   * @param {string} message - The error message to display.
   */
  showError(message) {
    this.exportError = message;
  }

  /**
   * Closes the scanner overlay by sending a message to the parent window.
   */
  closeOverlay() {
    // This is used when the scanner is opened in an iframe/overlay.
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        command: "closeFlowScannerOverlay"
      }, "*");
    }
  }
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      loadingMessage: "Loading Flow Data...",
      loadingDescription: "Please wait while we retrieve the flow metadata from Salesforce.",
      // Accordion state: { [severity]: { expanded: bool, rules: { [ruleType]: bool } } }
      accordion: {
        error: {expanded: true, rules: {}},
        warning: {expanded: true, rules: {}},
        info: {expanded: true, rules: {}}
      }
    };
    this.onToggleHelp = this.onToggleHelp.bind(this);
    this.onToggleDescription = this.onToggleDescription.bind(this);
    this.onExportResults = this.onExportResults.bind(this);
    this.onExpandAll = this.onExpandAll.bind(this);
    this.onCollapseAll = this.onCollapseAll.bind(this);
    this.onSeverityToggle = this.onSeverityToggle.bind(this);
    this.onRuleToggle = this.onRuleToggle.bind(this);
    this.onScanFlow = this.onScanFlow.bind(this);
  }

  componentDidMount() {
    this.initializeFlowScanner();
  }

  componentDidUpdate(prevProps, prevState) {
    // When scan results are loaded and accordion state is missing rule keys, initialize them to expanded
    if (this.flowScanner?.scanResults && this.flowScanner.scanResults.length > 0) {
    const severityOrder = ["error", "warning", "info"];
    const severityGroups = {error: [], warning: [], info: []};
      this.flowScanner.scanResults.forEach(r => { if (severityGroups[r.severity]) severityGroups[r.severity].push(r); });
      let needsUpdate = false;
      const accordion = {...this.state.accordion};
      severityOrder.forEach(severity => {
        const group = severityGroups[severity];
        if (!accordion[severity]) accordion[severity] = {expanded: true, rules: {}};
        if (!accordion[severity].rules) accordion[severity].rules = {};
        // Group by rule
      const rules = {};
      group.forEach(result => {
        const ruleType = result.rule || result.ruleLabel || "Unknown Rule";
        if (!rules[ruleType]) rules[ruleType] = [];
        rules[ruleType].push(result);
      });
        Object.keys(rules).forEach(ruleType => {
          if (!(ruleType in accordion[severity].rules)) {
            accordion[severity].rules[ruleType] = true;
            needsUpdate = true;
          }
        });
      });
      if (needsUpdate) {
        this.setState({accordion});
      }
    }
  }

  async initializeFlowScanner() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sfHost = params.get("host");
      const flowDefId = params.get("flowDefId");
      const flowId = params.get("flowId");

      if (!sfHost || !flowDefId || !flowId) {
        throw new Error(`Missing required parameters: host=${sfHost}, flowDefId=${flowDefId}, flowId=${flowId}`);
      }

      if (typeof initButton === "undefined") {
        throw new Error("initButton function not found. Make sure button.js is loaded.");
      }

      initButton(sfHost, true);

      if (typeof sfConn === "undefined") {
        throw new Error("sfConn not found. Make sure inspector.js is loaded.");
      }

      await sfConn.getSession(sfHost);

      this.flowScanner = new FlowScanner(sfHost, flowDefId, flowId);
      await this.flowScanner.init();

      this.setState({isLoading: false});
    } catch (error) {
      this.setState({
        isLoading: false,
        error: error.message
      });
    }
  }

  onToggleHelp(e) {
    e.preventDefault();
    const target = "_blank";
    const url = chrome.runtime.getURL(`options.html?selectedTab=8&host=${this.flowScanner?.sfHost}`);
    window.open(url, target);
  }

  onToggleDescription(e) {
    e.preventDefault();
    const container = e.target.closest(".flow-description-container");
    const toggleBtn = container?.querySelector(".description-toggle-btn");
    if (container && toggleBtn) {
      const isCollapsed = container.classList.toggle("collapsed");
      toggleBtn.setAttribute("aria-expanded", !isCollapsed);
      const toggleLabel = toggleBtn.querySelector("#toggle-label");
      if (toggleLabel) {
        toggleLabel.textContent = isCollapsed ? "Show description" : "Hide description";
      }
    }
  }

  onExportResults() {
    if (this.flowScanner) {
      this.flowScanner.handleExportClick();
    }
  }

  onScanFlow() {
    if (this.flowScanner) {
      this.flowScanner.scanFlow();
    }
  }

  // Accordion logic matching static version
  onExpandAll() {
    this.setState(state => {
      const accordion = {...state.accordion};
      ["error", "warning", "info"].forEach(sev => {
        accordion[sev].expanded = true;
        const rules = accordion[sev].rules;
        Object.keys(rules).forEach(rule => { rules[rule] = true; });
      });
      return {accordion};
    });
  }

  onCollapseAll() {
    this.setState(state => {
      const accordion = {...state.accordion};
      let anyRuleExpanded = false;
      ["error", "warning", "info"].forEach(sev => {
        const rules = accordion[sev].rules;
        Object.keys(rules).forEach(rule => {
          if (rules[rule]) anyRuleExpanded = true;
        });
      });
      if (anyRuleExpanded) {
        // Collapse all rules, keep severity expanded
        ["error", "warning", "info"].forEach(sev => {
          const rules = accordion[sev].rules;
          Object.keys(rules).forEach(rule => { rules[rule] = false; });
        });
        } else {
        // Collapse all severity groups
        ["error", "warning", "info"].forEach(sev => {
          accordion[sev].expanded = false;
        });
      }
      return {accordion};
    });
  }

  onSeverityToggle(severity) {
    this.setState(state => {
      const accordion = {...state.accordion};
      const sevAcc = accordion[severity];

      const ruleKeys = Object.keys(sevAcc.rules || {});
      const expandedRules = ruleKeys.filter(r => sevAcc.rules[r]);

      // Cycle logic:
      // 1) collapsed  -> expand group (keep per-rule state)
      // 2) expanded & mixed -> expand all
      // 3) expanded & all rules expanded -> collapse group

      if (!sevAcc.expanded) {
        // collapsed -> expand group (state 0->1)
        sevAcc.expanded = true;
      } else if (expandedRules.length !== ruleKeys.length) {
        // mixed -> expand all
        ruleKeys.forEach(r => { sevAcc.rules[r] = true; });
    } else {
        // fully expanded -> collapse group
        sevAcc.expanded = false;
      }

      return {accordion};
    });
  }

  onRuleToggle(severity, ruleType) {
    this.setState(state => {
      const accordion = {...state.accordion};
      if (!accordion[severity].rules) accordion[severity].rules = {};
      accordion[severity].rules[ruleType] = !accordion[severity].rules[ruleType];
      return {accordion};
    });
  }

  renderFlowInfo() {
    if (!this.flowScanner?.currentFlow) {
      return h("div", {className: "flow-info-section"},
        h("h2", {className: "flow-info-title"},
          h("span", {className: "flow-icon", "aria-hidden": "true"}, "⚡"),
          h("span", {className: "flow-info-title-text"}, "Flow Information")
        ),
        h("div", {className: "flow-info-card compact"},
          h("div", {}, "Loading flow information...")
        )
      );
    }

    const flow = this.flowScanner.currentFlow;
    const elements = this.flowScanner.extractFlowElements();

    return h("div", {className: "flow-info-section", role: "region", "aria-labelledby": "flow-info-title-text"},
      h("h2", {className: "flow-info-title"},
        h("span", {className: "flow-icon", "aria-hidden": "true"}, "⚡"),
        h("span", {className: "flow-info-title-text", id: "flow-info-title-text"}, "Flow Information")
      ),
      h("div", {className: "flow-info-card compact"},
        h("div", {className: "flow-header-row"},
          h("div", {className: "flow-details-grid"},
            h("div", {className: "flow-detail-item flow-label-item"},
              h("span", {className: "detail-label"}, "Flow Label"),
              h("span", {className: "detail-value"}, flow.label || "Unknown Label")
            ),
            h("div", {className: "flow-detail-item flow-apiname-item"},
              h("span", {className: "detail-label"}, "Flow API Name"),
              h("span", {className: "detail-value"}, flow.apiName || "Unknown API Name")
            ),
            h("div", {className: "flow-detail-item"},
              h("span", {className: "detail-label"}, "Status"),
              h("span", {
                className: `flow-status-badge ${flow.status?.toLowerCase()}`,
                role: "status",
                "aria-live": "polite",
                id: "flow-status-badge"
              }, flow.status)
            ),
            h("div", {className: "flow-detail-item"},
              h("span", {className: "detail-label"}, "Type"),
              h("span", {className: "detail-value", id: "flow-type"}, flow.type)
            ),
            h("div", {className: "flow-detail-item"},
              h("span", {className: "detail-label"}, "API Version"),
              h("span", {className: "detail-value", id: "flow-api-version"}, flow.xmlData?.apiVersion || "Unknown")
            ),
            h("div", {className: "flow-detail-item"},
              h("span", {className: "detail-label"}, "Elements"),
              h("span", {className: "detail-value", id: "flow-elements-count"}, elements.length)
            ),
            h("div", {className: "flow-detail-item"},
              h("span", {className: "detail-label"}, "Triggering Object/Event"),
              h("span", {className: "detail-value", id: "flow-trigger-object"}, flow.triggerObjectLabel || "—")
            ),
            h("div", {className: "flow-detail-item"},
              h("span", {className: "detail-label"}, "Trigger"),
              h("span", {className: "detail-value", id: "flow-trigger-type"}, flow.triggerType || "—")
            )
          )
        ),
        h("div", {className: "flow-desc-row"},
          h("div", {className: "flow-description-container collapsed"},
            h("div", {className: "flow-desc-header"},
              h("button", {
                className: "description-toggle-btn",
                type: "button",
                "aria-expanded": "false",
                onClick: this.onToggleDescription
              },
              h("span", {className: "toggle-icon"}, "▼"),
              h("span", {id: "toggle-label"}, "Show description")
              )
            ),
            h("div", {
              className: "flow-description clickable",
              role: "button",
              tabIndex: "0",
              "aria-label": "Click to toggle description visibility",
              dangerouslySetInnerHTML: {
                __html: (flow.xmlData?.description || "No description provided").replace(/\n/g, "<br>")
              }
            })
          )
        )
      )
    );
  }

  renderScanResults() {
    if (!this.flowScanner?.scanResults) {
      return h("div", {className: "scan-results-section", style: {display: "none"}});
    }
    const results = this.flowScanner.scanResults;
    const totalIssues = results.length;
    const severityOrder = ["error", "warning", "info"];
    const severityLabels = {error: "Errors", warning: "Warnings", info: "Info"};
    const severityIcons = {
      error: h("span", {className: "sev-ico error", "aria-label": "Error"}, "❗"),
      warning: h("span", {className: "sev-ico warning", "aria-label": "Warning"}, "⚠️"),
      info: h("span", {className: "sev-ico info", "aria-label": "Info"}, "ℹ️")
    };
    const accordion = this.state.accordion;
    // Group results by severity and rule
    const severityGroups = {error: [], warning: [], info: []};
    results.forEach(r => { if (severityGroups[r.severity]) severityGroups[r.severity].push(r); });
    // Stats
    const errorCount = severityGroups.error.length;
    const warningCount = severityGroups.warning.length;
    const infoCount = severityGroups.info.length;
    if (totalIssues === 0) {
      return h("div", {className: "scan-results-section"},
        h("div", {className: "success-state"},
          h("div", {className: "success-icon"}, "✅"),
          h("h3", {}, "No Issues Found"),
          h("p", {}, "Great job! Your flow passed all checks with no issues detected."),
          h("div", {className: "success-metrics"},
            h("div", {className: "metric-item"},
              h("div", {className: "metric-value", id: "total-issues-count"}, "0"),
              h("div", {className: "metric-label"}, "Issues")
            ),
            h("div", {className: "metric-item"},
              h("div", {className: "metric-value", id: "clean-percentage"}, "100%"),
              h("div", {className: "metric-label"}, "Clean")
            )
          ),
          h("button", {
            className: "summary-action-btn",
            title: "Scan Flow",
            onClick: this.onScanFlow,
            disabled: this.flowScanner.isScanning
          },
            h("span", {className: "export-icon", "aria-hidden": "true"}, "⚙️"),
            " Scan Flow"
          )
        )
      );
    }
    // Summary panel
    return h("div", {className: "scan-results-section", "aria-labelledby": "results-title", "aria-live": "polite"},
      h("div", {className: "results-summary", role: "status", "aria-live": "polite"},
        h("div", {className: "summary-body"},
          h("h3", {className: "summary-title"},
            h("span", {className: "results-icon"}, "📊"),
            "Scan Results"
          ),
          h("div", {className: "summary-right-panel"},
            h("div", {className: "summary-stats", role: "group", "aria-label": "Scan results summary"},
              h("div", {className: "stat-item total", role: "group", "aria-label": "Total issues"},
                h("span", {className: "stat-number", id: "total-issues-count"}, totalIssues),
                h("span", {className: "stat-label"}, "Total")
              ),
              h("div", {className: "stat-item error", role: "group", "aria-label": "Error issues"},
                h("span", {className: "stat-number", id: "error-issues-count"}, errorCount),
                h("span", {className: "stat-label"}, "Errors")
              ),
              h("div", {className: "stat-item warning", role: "group", "aria-label": "Warning issues"},
                h("span", {className: "stat-number", id: "warning-issues-count"}, warningCount),
                h("span", {className: "stat-label"}, "Warnings")
              ),
              h("div", {className: "stat-item info", role: "group", "aria-label": "Information issues"},
                h("span", {className: "stat-number", id: "info-issues-count"}, infoCount),
                h("span", {className: "stat-label"}, "Info")
              )
            ),
            h("div", {className: "summary-actions"},
              h("button", {
                className: "summary-action-btn slds-button slds-button_neutral",
                title: "Export Results",
                onClick: this.onExportResults,
                disabled: totalIssues === 0
              },
                h("span", {className: "export-icon", "aria-hidden": "true"}, "📁"),
                " Export"
              ),
              h("button", {className: "summary-action-btn slds-button slds-button_neutral", id: "expand-all-btn", onClick: this.onExpandAll}, "Expand All"),
              h("button", {className: "summary-action-btn slds-button slds-button_neutral", id: "collapse-all-btn", onClick: this.onCollapseAll}, "Collapse All")
            )
          )
        )
      ),
      h("div", {className: "results-container", role: "region", "aria-labelledby": "results-title"},
        severityOrder.map(severity => {
          const group = severityGroups[severity];
          if (!group.length) return null;
          // Group by rule
          const rules = {};
          group.forEach(result => {
            const ruleType = result.rule || result.ruleLabel || "Unknown Rule";
            if (!rules[ruleType]) rules[ruleType] = [];
            rules[ruleType].push(result);
          });
          const sevAccordion = accordion[severity] || {expanded: true, rules: {}};
          const isSevExpanded = sevAccordion.expanded !== false;
          const ruleKeys = Object.keys(rules);
          const expandedRules = ruleKeys.filter(r=> sevAccordion.rules && sevAccordion.rules[r]);
          let accordionStateAttr = isSevExpanded ? "1" : "3"; // 1=expanded,3=collapsed
          if (isSevExpanded && expandedRules.length>0 && expandedRules.length<ruleKeys.length) {
            accordionStateAttr = "2"; // mixed
          }
          return h("div", {
            key: severity,
            className: `severity-group-layout ${severity}${!isSevExpanded ? " collapsed" : ""}`,
            "data-accordion-state": accordionStateAttr
          },
            h("div", {
              className: "severity-title-left",
              role: "button",
              tabIndex: 0,
              "aria-expanded": isSevExpanded,
              "aria-controls": `${severity}-rules-container`,
              onClick: () => this.onSeverityToggle(severity),
              onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.onSeverityToggle(severity); } }
            },
              h("h3", {className: "severity-heading"},
                h("div", {className: "severity-heading-content"},
                  h("svg", {
                    className: "accordion-chevron",
                    width: "24",
                    height: "24",
                    "aria-hidden": "true",
                    style: {transform: isSevExpanded ? "rotate(0deg)" : "rotate(-90deg)"}
                  },
                    h("use", {xlinkHref: "symbols.svg#accordion-chevron"})
                  ),
                  h("span", {className: "severity-label-group"},
                    severityIcons[severity],
                    h("span", {}, severityLabels[severity])
                  )
                )
              ),
              h("span", {className: "severity-total-count"}, `${group.length} Issue${group.length === 1 ? "" : "s"}`)
            ),
            isSevExpanded && h("div", {className: "rules-container-right", id: `${severity}-rules-container`},
              Object.entries(rules).map(([ruleType, ruleResults], ruleIdx) => {
                const description = ruleResults[0].description || "Rule violation detected";
                const ruleAccordion = sevAccordion.rules || {};
                const ruleExpanded = ruleAccordion[ruleType] !== false;
                return h("div", {
                  key: `${severity}-${ruleIdx}`,
                  className: `rule-section compact${ruleExpanded ? " expanded" : " collapsed"} card-bg`,
                  "data-rule-type": ruleType
                },
                  h("div", {
                    className: "rule-header",
                    tabIndex: 0,
                    role: "button",
                    "aria-expanded": ruleExpanded,
                    "aria-controls": `${severity}-${ruleIdx}-content`,
                    onClick: () => this.onRuleToggle(severity, ruleType),
                    onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.onRuleToggle(severity, ruleType); } }
                  },
                    h("div", {className: "rule-title-section"},
                      h("span", {className: "rule-name-compact"}, ruleType),
                      h("div", {className: "tooltip-container"},
                        h("svg", {className: "info-icon", "aria-hidden": "true"},
                          h("use", {xlinkHref: "symbols.svg#info"})
                        ),
                        h("div", {className: "tooltip-content"}, description)
                      ),
                      h("span", {className: "badge-total circle-badge"}, ruleResults.length)
                    ),
                    h("svg", {
                      className: "accordion-chevron",
                      width: "24",
                      height: "24",
                      "aria-hidden": "true",
                      style: {transform: ruleExpanded ? "rotate(0deg)" : "rotate(-90deg)"}
                    },
                      h("use", {xlinkHref: "symbols.svg#accordion-chevron"})
                    )
                  ),
                  ruleExpanded && h("div", {className: "rule-content", id: `${severity}-${ruleIdx}-content`},
                    this.renderRuleTable(ruleResults)
                  )
                );
              })
            )
          );
        })
      )
    );
  }

  renderResultsDetails(results) {
    // Group results by severity
    const severityGroups = {error: [], warning: [], info: []};
    results.forEach(r => {
      if (severityGroups[r.severity]) {
        severityGroups[r.severity].push(r);
      }
    });

    const severityOrder = ["error", "warning", "info"];
    const severityLabels = {error: "Errors", warning: "Warnings", info: "Info"};
    const severityIcons = {
      error: h("span", {className: "sev-ico error", "aria-label": "Error"}, "❗"),
      warning: h("span", {className: "sev-ico warning", "aria-label": "Warning"}, "⚠️"),
      info: h("span", {className: "sev-ico info", "aria-label": "Info"}, "ℹ️")
    };

    const {expandedSeverities, expandedRules} = this.state;
    return severityOrder.map(severity => {
      const group = severityGroups[severity];
      if (!group.length) return null;

      // Group by rule within severity
      const rules = {};
      group.forEach(result => {
        const ruleType = result.rule || result.ruleLabel || "Unknown Rule";
        if (!rules[ruleType]) rules[ruleType] = [];
        rules[ruleType].push(result);
      });

      const isExpanded = expandedSeverities[severity];

      return h("div", {
        key: severity,
        className: `severity-group-layout ${severity}${!isExpanded ? " collapsed" : ""}`,
      },
        h("div", {
          className: "severity-title-left",
          role: "button",
          tabIndex: 0,
          "aria-expanded": isExpanded,
          onClick: () => this.onSeverityToggle(severity),
          onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.onSeverityToggle(severity); } }
        },
          h("h3", {className: "severity-heading"},
            h("div", {className: "severity-heading-content"},
              h("svg", {
                className: "accordion-chevron",
                width: "24",
                height: "24",
                "aria-hidden": "true",
                style: { transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }
              },
                h("use", {xlinkHref: "symbols.svg#accordion-chevron"})
              ),
              h("span", {className: "severity-label-group"},
                severityIcons[severity],
                h("span", {}, severityLabels[severity])
              )
            )
          ),
          h("span", {className: "severity-total-count"}, `${group.length} Issue${group.length === 1 ? "" : "s"}`)
        ),
        isExpanded && h("div", {className: "rules-container-right"},
          Object.entries(rules).map(([ruleType, ruleResults], ruleIdx) => {
            const description = ruleResults[0].description || "Rule violation detected";
            const ruleKey = `${severity}__${ruleType}`;
            const ruleExpanded = expandedRules[ruleKey] !== false; // default to expanded
            return h("div", {
              key: `${severity}-${ruleIdx}`,
              className: `rule-section compact${ruleExpanded ? " expanded" : " collapsed"} card-bg`,
              "data-rule-type": ruleType
            },
              h("div", {
                className: "rule-header",
                tabIndex: 0,
                role: "button",
                "aria-expanded": ruleExpanded,
                onClick: () => this.onRuleToggle(severity, ruleType),
                onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.onRuleToggle(severity, ruleType); } }
              },
                h("div", {className: "rule-title-section"},
                  h("span", {className: "rule-name-compact"}, ruleType),
                  h("div", {className: "tooltip-container"},
                    h("svg", {className: "info-icon", "aria-hidden": "true"},
                      h("use", {xlinkHref: "symbols.svg#info"})
                    ),
                    h("div", {className: "tooltip-content"}, description)
                  ),
                  h("span", {className: "badge-total circle-badge"}, ruleResults.length)
                ),
                h("svg", {
                  className: "accordion-chevron",
                  width: "24",
                  height: "24",
                  "aria-hidden": "true",
                  style: {transform: ruleExpanded ? "rotate(0deg)" : "rotate(-90deg)"}
                },
                  h("use", {xlinkHref: "symbols.svg#accordion-chevron"})
                )
              ),
              ruleExpanded && h("div", {className: "rule-content"},
                this.renderRuleTable(ruleResults)
              )
            );
          })
        )
      );
    }).filter(Boolean);
  }

  renderRuleTable(ruleResults) {
    const headers = ["Name", "Element Label", "Type", "Meta", "Connects to", "Location", "Expression"];
    const rows = ruleResults.map(result => {
      const affected = (result.affectedElements && result.affectedElements.length > 0) ? result.affectedElements[0] : {};
      return {
        "Name": affected.apiName || affected.elementName || "",
        "Element Label": affected.elementLabel || "",
        "Type": affected.elementType || "",
        "Meta": affected.metaType || "",
        "Connects to": affected.connectsTo || "",
        "Location": (affected.locationX !== undefined && affected.locationY !== undefined && (affected.locationX !== "" || affected.locationY !== "")) ? `(${affected.locationX}, ${affected.locationY})` : "",
        "Expression": affected.expression || ""
      };
    });

    // Determine which columns to show based on whether they contain any data.
    const activeHeaders = headers.filter(header => rows.some(row => row[header]));

    if (activeHeaders.length === 0) {
      return h("div", {}, "No additional details available");
    }

    return h("table", {className: "details-table"},
      h("thead", {},
        h("tr", {},
          activeHeaders.map(header => h("th", {key: header}, header))
        )
      ),
      h("tbody", {},
        rows.map((row, idx) =>
          h("tr", {key: idx},
            activeHeaders.map(header => {
              const cellValue = row[header] || "—";
              const isMono = ["Name", "Connects to", "Expression", "Location"].includes(header);
              const cellClass = isMono ? "mono" : "";
              return h("td", {key: header},
                h("div", {className: `cell-content ${cellClass}`, title: cellValue}, cellValue)
              );
            })
          )
        )
      )
    );
  }

  renderLoadingOverlay() {
    if (!this.state.isLoading) {
      return null;
    }

    return h("div", {
      className: "loading-overlay",
      style: {display: "flex"},
      role: "dialog",
      "aria-labelledby": "loading-title",
      "aria-describedby": "loading-description",
      "aria-modal": "true"
    },
    h("div", {className: "loading-card"},
      h("div", {className: "loading-spinner", "aria-hidden": "true"}),
      h("h3", {id: "loading-title"}, this.state.loadingMessage),
      h("p", {id: "loading-description"}, this.state.loadingDescription)
    )
    );
  }

  renderError() {
    if (!this.state.error) {
      return null;
    }

    return h("div", {className: "scan-results-section"},
      h("div", {className: "empty-state"},
        h("div", {className: "empty-icon"}, "❌"),
        h("h3", {}, "Error Occurred"),
        h("p", {}, this.state.error)
      )
    );
  }

  render() {
    const sfHost = this.flowScanner?.sfHost || "";
    const sfLink = "https://" + sfHost;
    const scannerVersion = this.flowScanner?.flowScannerCore?.version || "";

    return h("div", {className: "flow-scanner-app"},
      (() => {
        const showSpinner = this.state.isLoading || (this.flowScanner && this.flowScanner.isScanning);
        return h("div", {id: "user-info", className: "slds-border_bottom"},
          // Salesforce home link
          h("a", {href: sfLink, className: "sf-link"},
            h("svg", {viewBox: "0 0 24 24"},
              h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          // Title
          h("h1", {}, "Flow Scanner"),
          // Optional user info (reuse flow label)
          this.flowScanner?.currentFlow?.label ?
            h("span", {}, " / " + this.flowScanner.currentFlow.label) : null,
          // Right side icons & spinner
          h("div", {className: "flex-right"},
            // Note about core version
            h("div", {className: "flow-scanner-note-header"},
              h("small", {},
                "💡 Based on ",
                h("a", {
                  href: "https://github.com/Lightning-Flow-Scanner",
                  target: "_blank",
                  rel: "noopener noreferrer"
                }, "Lightning Flow Scanner"),
                scannerVersion ? ` (core v${scannerVersion})` : ""
              )
            ),
            // Help button
            h("a", {
              href: "#",
              id: "help-btn",
              title: "Open Flow Scanner Options",
              onClick: this.onToggleHelp
            },
              h("div", {className: "icon"})
            )
          )
        );
      })(),
      h("div", {className: "main-container slds-card slds-m-around_small"},
        this.renderFlowInfo(),
        this.state.error ? this.renderError() : this.renderScanResults()
      ),
      this.renderLoadingOverlay(),
      h("div", {className: "sr-only", "aria-live": "polite", "aria-atomic": "true", id: "sr-announcements"})
    );
  }
}

// Initialize the application
{
  let args = new URLSearchParams(location.search);
  let sfHost = args.get("host");
  let hash = new URLSearchParams(location.hash);
  if (!sfHost && hash) {
    sfHost = decodeURIComponent(hash.get("instance_url")).replace(/^https?:\/\//i, "");
  }

  let root = document.getElementById("root");
  let model = {}; // Placeholder model for compatibility

  ReactDOM.render(h(App, {model}), root);

  if (parent && parent.isUnitTest) {
    parent.insextTestLoaded({model, sfConn});
  }
}
