/**
 * @file Core functionality for the Flow Scanner tool.
 *
 * This script handles fetching flow metadata from Salesforce, running the
 * analysis using the core scanner library, and rendering the results in the UI.
 * It uses React to build the user interface and interacts with the Salesforce
 * API via the `sfConn` utility.
 */

/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
import {getLinkTarget} from "./utils.js";

// Flow Scanner Rules Configuration
export const flowScannerKnownConfigurableRules = {
  APIVersion: {configType: "threshold", defaultValue: 50},
  FlowName: {configType: "expression", defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+"},
  CyclomaticComplexity: {configType: "threshold", defaultValue: 25},
};

export function getFlowScannerRules(flowScannerCore) {
  // Retrieve core and beta rules from the scanner library
  const coreRules = typeof flowScannerCore.getRules === "function"
    ? flowScannerCore.getRules()
    : [];
  const betaRules = typeof flowScannerCore.getBetaRules === "function"
    ? flowScannerCore.getBetaRules().map(r => ({...r, isBeta: true}))
    : [];

  // Build the default rule list for merging
  const defaultRules = [...coreRules, ...betaRules].map(rule => {
    const def = {
      name: rule.name,
      label: rule.label || rule.name,
      description: rule.description,
      isBeta: rule.isBeta || false,
      // Default checked state can be customized here if needed
      checked: true,
      // Extract config details from the rule definition
      configType: rule.configType,
      defaultValue: rule.defaultValue,
      isConfigurable: rule.isConfigurable,
      // Default severity
      severity: rule.defaultSeverity || rule.severity || "error"
    };
    // For some rules, config is on the instance not the definition.
    if (rule.defaultThreshold) {
      def.configType = "threshold";
      def.defaultValue = rule.defaultThreshold;
      def.isConfigurable = true;
    }
    return def;
  });

  // Stored overrides from Options page
  const storedRules = JSON.parse(localStorage.getItem("flowScannerRules") || "[]");

  // Merge defaults with stored overrides
  const merged = [];

  for (const def of defaultRules) {
    const stored = storedRules.find(r => r.name === def.name);
    const known = flowScannerKnownConfigurableRules[def.name];
    let config = {};
    let configType = def.configType;
    let configurable = def.configurable;

    // Apply stored override config
    const hasValidStoredConfig = stored && stored.config && Object.values(stored.config).some(v => v !== "" && v !== null && v !== undefined && v !== false);
    if (hasValidStoredConfig) {
      config = stored.config;
    } else if (known) {
      config = {[known.configType]: known.defaultValue};
      configType = known.configType;
      configurable = true;
    } else if (def.defaultValue != null) {
      config = {[def.configType]: def.defaultValue};
    }

    if (known) {
      configurable = true;
      configType = configType || known.configType;
    }

    merged.push({
      ...def,
      checked: stored ? stored.checked : def.checked,
      config,
      configType,
      configurable,
      configValue: stored ? stored.configValue : undefined,
      severity: stored ? stored.severity || def.severity : def.severity
    });
  }

  return merged;
}

/**
 * Normalizes severity levels between the UI display format ("info") and
 * the storage format ("note") used by the core scanner library.
 *
 * @param {string} sev - The severity level to normalize.
 * @param {string} [direction="ui"] - The direction of normalization ('ui' or 'storage').
 * @returns {string} The normalized severity level.
 */
const normalizeSeverity = (sev, direction = "ui") => {
  if (direction === "ui") return sev === "note" ? "info" : sev;
  if (direction === "storage") return sev === "info" ? "note" : sev;
  return sev;
};

/**
 * Manages the analysis of Salesforce Flows, including data fetching,
 * scanning, and results processing.
 */
class FlowScanner {
  /**
   * @param {string} sfHost - The Salesforce host URL.
   * @param {string} flowDefId - The ID of the flow definition.
   * @param {string} flowId - The ID of the specific flow version.
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
   * Initializes the scanner by loading flow data and running the analysis.
   */
  async init() {
    this.initFlowScannerCore();
    await this.loadFlowInfo();
    await this.scanFlow();
  }

  /**
   * Loads the core flow scanner library and sets it up for use.
   * @throws {Error} If the core scanner library is not found.
   */
  initFlowScannerCore() {
    try {
      const libraryName = window.flowScannerLibraryName;
      if (libraryName && typeof window[libraryName] !== "undefined") {
        this.flowScannerCore = window[libraryName];
      } else {
        this.flowScannerCore = null;
        throw new Error("Flow Scanner Core library not loaded or library name not defined. Please ensure lib/flow-scanner-core.js is properly included and built.");
      }
    } catch (error) {
      this.flowScannerCore = null;
      throw error;
    }
  }



  /**
   * Generates and downloads a CSV file of the scan results.
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
      const affected = (result.affectedElements && result.affectedElements.length > 0) ? result.affectedElements[0] : {};
      const rowData = {
        ruleDescription: result.description,
        ruleLabel: result.rule,
        flowName: result.flowName,
        name: affected.elementName,
        apiName: affected.apiName,
        label: affected.elementLabel,
        type: affected.elementType,
        metaType: affected.metaType,
        dataType: affected.dataType,
        locationX: affected.locationX,
        locationY: affected.locationY,
        connectsTo: affected.connectsTo,
        expression: affected.expression
      };
      const row = csvHeaders.map(header => {
        const value = rowData[header] || "";
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
   * Fetches the flow's metadata from the Salesforce API.
   */
  async loadFlowInfo() {
    try {
      const flowInfo = await this.getFlowMetadata();
      this.currentFlow = flowInfo;
    } catch (error) {
      this.setNoRulesEnabledMessage("Failed to load flow information: " + error.message);
    }
  }

  /**
   * Retrieves metadata for the current flow from the Salesforce API.
   * @returns {Object} An object containing the flow's metadata.
   * @throws {Error} If the API call fails or the flow is not found.
   */
  async getFlowMetadata() {
    try {

      // Query both Flow and FlowDefinitionView objects to get complete metadata
      const [flowRes, fdvRes] = await Promise.all([
        sfConn.rest(`/services/data/v${apiVersion}/tooling/query?q=SELECT+Id,Metadata+FROM+Flow+WHERE+Id='${this.flowId}'`),
        sfConn.rest(`/services/data/v${apiVersion}/query/?q=SELECT+Label,ApiName,ProcessType,TriggerType,TriggerObjectOrEventLabel+FROM+FlowDefinitionView+WHERE+DurableId='${this.flowDefId}'`)
      ]);

      const flowRecord = flowRes.records?.[0];
      const flowDefView = fdvRes.records?.[0];

      if (!flowRecord || !flowDefView) {
        throw new Error("Flow or FlowDefinitionView not found");
      }

      // Extract and normalize flow metadata from API responses
      const xmlData = flowRecord?.Metadata || {};
      this._removeNullAttributes(xmlData);
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
      const showProcessType = type !== processType;

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
   * Gets all flow element types from the core scanner library.
   * @private
   * @returns {Array} Array of all flow element types
   */
  _getFlowElementTypes() {
    if (!this.flowScannerCore) {
      return [];
    }

    // Create a temporary flow instance to access the element type definitions
    const tempFlow = new this.flowScannerCore.Flow("temp", {});
    return [
      ...tempFlow.flowNodes,
      ...tempFlow.flowResources,
      ...tempFlow.flowVariables
    ];
  }

  /**
   * Builds a map of flow element API names to their labels for easy lookup.
   * @private
   */
  _buildElementMap() {
    this._elementMap = new Map();
    if (!this.currentFlow?.xmlData) {
      return;
    }

    const xmlData = this.currentFlow.xmlData;

    // Use element types from core library
    this._getFlowElementTypes().forEach(elementType => {
      const elements = xmlData[elementType];
      if (!elements) return;

      // Handle both single elements and arrays efficiently
      const elementArray = Array.isArray(elements) ? elements : [elements];
      elementArray.forEach(element => {
        if (element?.name) {
          this._elementMap.set(element.name, element.label);
        }
      });
    });
  }

  /**
   * Recursively removes keys with `null` values from an object.
   * @param {object} obj The object to clean.
   */
  _removeNullAttributes(obj) {
    if (!obj || typeof obj !== "object") {
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach(item => this._removeNullAttributes(item));
      return;
    }
    Object.keys(obj).forEach(key => {
      if (obj[key] === null) {
        delete obj[key];
      } else {
        this._removeNullAttributes(obj[key]);
      }
    });
  }

  /**
   * Initiates the flow scan, running all enabled rules and processing the results.
   */
  async scanFlow() {
    if (!this.currentFlow) {
      this.setNoRulesEnabledMessage("No flow loaded");
      return;
    }

    this.isScanning = true;

    try {
      // Ensure the core scanner library is available.
      if (!this.flowScannerCore) {
        throw new Error("Flow Scanner Core library not available");
      }

      // Check if flow type is supported before proceeding with scan
      // Use the FlowType class from the core scanner library for authoritative type definitions
      let supportedFlowTypes = [];
      let supportedFlowTypesSet = new Set();
      let unsupportedFlowTypesSet = new Set();

      if (this.flowScannerCore?.FlowType) {
        // Use the core library's FlowType definitions
        const FlowType = this.flowScannerCore.FlowType;
        // Deduplicate the array to fix the duplicate "ContactRequestFlow" issue in core library
        supportedFlowTypes = [...new Set(FlowType.allTypes())];
        supportedFlowTypesSet = new Set(supportedFlowTypes);
        const unsupportedFlowTypes = FlowType.unsupportedTypes || [];
        unsupportedFlowTypesSet = new Set(unsupportedFlowTypes);
      } else {
        // If FlowType is not available, we cannot determine supported types
        // Return an error state instead of proceeding with empty arrays
        this.scanResults = [{
          rule: "Scanner Configuration Error",
          description: "Flow type validation is unavailable. The FlowType class is not exposed by the core scanner library.",
          severity: "error",
          flowName: this.currentFlow.name,
          affectedElements: [{
            elementName: this.currentFlow.apiName,
            elementLabel: "Flow Scanner Core",
            elementType: "Configuration",
            expression: "FlowType class not available"
          }]
        }];
        return;
      }

      // Get flow type using flow properties
      const originalFlowType = this.currentFlow.xmlData?.processType || this.currentFlow.processType;
      const currentFlowType = originalFlowType || this.currentFlow.type;

      // Special case for screen flows - they might just show as "Flow" type but have screens
      const hasScreens = Array.isArray(this.currentFlow.xmlData?.screens) && this.currentFlow.xmlData.screens.length > 0;
      const isScreenFlow = currentFlowType === "Flow" && hasScreens;

      // Check if the flow type is explicitly unsupported (O(1) lookup)
      if (unsupportedFlowTypesSet.has(currentFlowType)) {
        this.scanResults = [{
          isUnsupportedFlow: true,
          displayType: currentFlowType,
          supportedFlowTypes,
          reason: "explicitly_unsupported"
        }];
        return;
      }

      // Check if the flow type is in the supported list or if it's a screen flow (O(1) lookup)
      const isFlowTypeSupported = supportedFlowTypesSet.has(currentFlowType) || isScreenFlow;

      // If the flow type is not supported, return a special marker object.
      if (!isFlowTypeSupported) {
        const displayType = isScreenFlow ? "Screen Flow" : currentFlowType;
        this.scanResults = [{
          isUnsupportedFlow: true,
          displayType,
          supportedFlowTypes,
          reason: "not_in_supported_list"
        }];
        return;
      }

      const flow = new this.flowScannerCore.Flow(this.currentFlow.name, this.currentFlow.xmlData);
      const parsedFlow = {flow, name: this.currentFlow.name};

      // Build a reference map of element names to labels.
      this._buildElementMap();

      // Retrieve core and beta rules from the scanner library.
      const allRules = getFlowScannerRules(this.flowScannerCore);

      // Select only enabled, built-in rules.
      const rulesToRun = allRules.filter(r => r.checked && !r.path && !r.code);
      if (rulesToRun.length === 0) {
        this.setNoRulesEnabledMessage("No Flow Scanner rules are enabled. Please enable rules on the Options page.");
        return;
      }

      let results = [];
      const ruleConfig = {rules: {}};

      // Optimize rule configuration building
      for (const rule of rulesToRun) {
        const {name, configType, config = {}, severity: uiSeverity} = rule;
        const scannerSeverity = normalizeSeverity(uiSeverity || "error", "storage");
        const entry = {severity: scannerSeverity};

        if (configType === "expression" && config.expression != null) {
          entry.expression = config.expression;
        } else if (configType === "threshold" && config.threshold != null) {
          if (name === "APIVersion") {
            // Convert numeric threshold into an expression string for the core rule.
            entry.expression = `>=${config.threshold}`;
          } else {
            entry.threshold = config.threshold;
          }
        }
        ruleConfig.rules[name] = entry;
      }

      // --- Handle APIVersion rule separately to avoid unsafe-eval in the core library ---
      const apiVersionConfig = ruleConfig.rules.APIVersion;
      if (apiVersionConfig) {
        delete ruleConfig.rules.APIVersion;
      }

      // Run all other built-in rules (if any remain).
      if (Object.keys(ruleConfig.rules).length > 0) {
        const scanResults = this.flowScannerCore.scan([parsedFlow], ruleConfig);
        results.push(...this.processScanResults(scanResults));
      }

      // Manually evaluate the APIVersion rule, if it was configured.
      if (apiVersionConfig) {
        const flowApiVer = this.currentFlow.apiVersion || this.currentFlow.xmlData?.apiVersion;
        const apiVersionRuleDef = allRules.find(r => r.name === "APIVersion");

        // Determine the required expression (e.g. ">=58").
        let requiredExpr;
        if (apiVersionConfig.expression) {
          requiredExpr = apiVersionConfig.expression;
        } else if (apiVersionConfig.threshold != null) {
          requiredExpr = `>=${apiVersionConfig.threshold}`;
        }

        if (requiredExpr) {
          const minVer = parseInt(requiredExpr.replace(/[^0-9]/g, ""), 10);
          const operator = requiredExpr.replace(/[0-9]/g, "").trim();
          const operators = {
            ">=": (a, b) => a < b,
            "<": (a, b) => a >= b,
            ">": (a, b) => a <= b,
            "<=": (a, b) => a > b,
            "==": (a, b) => a !== b,
            "=": (a, b) => a !== b
          };
          const violation = operators[operator] ? operators[operator](flowApiVer, minVer) : flowApiVer < minVer;

          if (violation) {
            // Craft a result object that mimics the core scanner output so downstream logic remains unchanged.
            const manualScanResult = [{
              flow: parsedFlow,
              ruleResults: [{
                ruleName: "APIVersion",
                ruleDefinition: {
                  description: apiVersionRuleDef?.description || "API Version check",
                  label: apiVersionRuleDef?.label || "APIVersion"
                },
                occurs: true,
                severity: apiVersionConfig.severity,
                details: [{
                  name: String(flowApiVer),
                  type: "apiVersion",
                  expression: requiredExpr
                }]
              }]
            }];
            results.push(...this.processScanResults(manualScanResult));
          }
        }
      }

      // Store final results.
      this.scanResults = results;
    } catch (error) {
      this.scanResults = [{
        rule: "Scan Error",
        description: "Failed to scan flow: " + error.message,
        severity: "error",
        flowName: this.currentFlow?.name || "Unknown",
        affectedElements: [{
          elementName: this.currentFlow?.apiName || "Unknown",
          elementLabel: "Flow",
          expression: error.message
        }]
      }];
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Processes raw results from the core scanner into a display-friendly format.
   * @param {Array} scanResults - The raw results from the core scanner.
   * @returns {Array} A list of formatted violation objects.
   */
  processScanResults(scanResults) {
    const results = [];

    // Helper function to create result objects
    const createResult = (rule, description, severity, affectedElements) => ({
      rule,
      description,
      severity: this.mapSeverity(severity),
      flowName: this.currentFlow.name,
      affectedElements
    });

    // Helper function to create element objects with defaults
    const createAffectedElement = (elementData) => ({
      elementName: elementData.elementName || "",
      elementType: elementData.elementType || "Unknown",
      metaType: elementData.metaType || "",
      dataType: elementData.dataType || "",
      locationX: elementData.locationX || "",
      locationY: elementData.locationY || "",
      connectsTo: elementData.connectsTo || "",
      expression: elementData.expression || "",
      elementLabel: elementData.elementLabel || "",
      apiName: elementData.apiName || ""
    });

    for (const flowResult of scanResults) {
      if (flowResult.errorMessage) {
        results.push(createResult(
          "Scan Error",
          "Failed to scan flow: " + flowResult.errorMessage,
          "error",
          [createAffectedElement({
            elementName: this.currentFlow.apiName,
            elementLabel: "Flow",
            expression: flowResult.errorMessage
          })]
        ));
        continue;
      }

      const ruleResults = flowResult.ruleResults || flowResult.results || flowResult.issues || [];

      for (const ruleResult of ruleResults) {
        if (!ruleResult.occurs) continue;

        const ruleDescription = ruleResult.ruleDefinition?.description || "No description available";
        const ruleLabel = ruleResult.ruleDefinition?.label || ruleResult.ruleName;

        if (ruleResult.details?.length > 0) {
          for (const detail of ruleResult.details) {
            const potentialElementName = detail.name || detail.violation?.name;

            let elementData;
            // Check if the violation is for a specific element or the flow itself.
            if (potentialElementName && this._elementMap.has(potentialElementName)) {
              // Element-level violation
              const violation = detail.violation || {};
              const detailsObj = detail.details || {};
              elementData = {
                elementName: potentialElementName,
                elementLabel: detail.label || violation.label || this._elementMap.get(potentialElementName) || "",
                elementType: detail.type || violation.subtype || "Unknown",
                metaType: detail.metaType || violation.metaType || "",
                dataType: detail.dataType || "",
                locationX: detailsObj.locationX || violation.locationX || "",
                locationY: detailsObj.locationY || violation.locationY || "",
                connectsTo: detailsObj.connectsTo || "",
                expression: detailsObj.expression || violation.expression || "",
                apiName: detail.apiName || violation.apiName || detail.name || violation.name || ""
              };
            } else {
              // Flow-level violation
              const rawCondition = detail.expression || detail.details?.expression || detail.violation?.expression || "";
              const condition = rawCondition.replace(/([<>=!]+)/g, "$1 ");
              elementData = {
                elementName: this.currentFlow.apiName,
                elementLabel: this.currentFlow.label,
                elementType: "Flow",
                apiName: this.currentFlow.apiName,
                expression: `${detail.name || ""} ${condition}`.trim()
              };
            }

            results.push(createResult(ruleLabel, ruleDescription, ruleResult.severity, [createAffectedElement(elementData)]));
          }
        } else {
          // Fallback for violations without specific details.
          const elementData = {
            elementName: this.currentFlow.apiName,
            elementLabel: this.currentFlow.label,
            elementType: "Flow",
            apiName: this.currentFlow.apiName,
            expression: ruleDescription
          };
          results.push(createResult(ruleLabel, ruleDescription, ruleResult.severity, [createAffectedElement(elementData)]));
        }
      }
    }
    return results;
  }

  /**
   * Maps severity levels from the core scanner to the UI's format.
   * @param {string} coreSeverity - The severity from the core scanner.
   * @returns {string} The corresponding UI severity level.
   */
  mapSeverity(coreSeverity) {
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
   * Extracts all elements from the current flow's metadata.
   * @returns {Array} A list of all flow element objects.
   */
  extractFlowElements() {
    if (!this.currentFlow?.xmlData) {
      return [];
    }

    const elements = [];
    const xmlData = this.currentFlow.xmlData;

    // Use element types from core library
    this._getFlowElementTypes().forEach(elementType => {
      const elementData = xmlData[elementType];
      if (!elementData) return;

      // Handle both single elements and arrays efficiently
      const elementArray = Array.isArray(elementData) ? elementData : [elementData];
      elementArray.forEach(element => {
        elements.push({
          name: element?.name || element?.label || element?.apiName || "Unknown",
          type: elementType,
          element
        });
      });
    });

    return elements;
  }

  /**
   * Sets a message to be displayed when no rules are enabled.
   * @param {string} message - The message to display.
   */
  setNoRulesEnabledMessage(message) {
    this.noRulesEnabledMessage = message;
  }
}

let h = React.createElement;

/**
 * The main React component for the Flow Scanner application.
 */
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      loadingMessage: "Loading Flow Data...",
      loadingDescription: "Please wait while we retrieve the flow metadata from Salesforce.",
      userInfo: "...",
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
    this.onStatItemClick = this.onStatItemClick.bind(this);
  }

  componentDidMount() {
    this.initializeFlowScanner();
  }

  /**
   * Groups scan results by severity and rule type.
   * @returns {Object} An object containing the grouped results.
   */
  getGroupedResults() {
    const {scanResults} = this.flowScanner || {};
    if (!scanResults || scanResults.length === 0) {
      return {error: {results: [], rules: {}}, warning: {results: [], rules: {}}, info: {results: [], rules: {}}};
    }
    const severityOrder = ["error", "warning", "info"];
    const grouped = {};
    severityOrder.forEach(severity => {
      grouped[severity] = {results: [], rules: {}};
    });
    scanResults.forEach(result => {
      const {severity} = result;
      if (grouped[severity]) {
        grouped[severity].results.push(result);
      }
    });
    severityOrder.forEach(severity => {
      const rules = {};
      grouped[severity].results.forEach(result => {
        const ruleType = result.rule || "Unknown Rule";
        if (!rules[ruleType]) {
          rules[ruleType] = [];
        }
        rules[ruleType].push(result);
      });
      grouped[severity].rules = rules;
    });
    return grouped;
  }

  componentDidUpdate() {
    // When scan results are loaded, initialize accordion state for any new rules.
    const {scanResults} = this.flowScanner || {};
    if (scanResults && scanResults.length > 0) {
      const groupedResults = this.getGroupedResults();
      let needsUpdate = false;
      const accordion = {...this.state.accordion};
      Object.keys(groupedResults).forEach(severity => {
        if (!accordion[severity]) accordion[severity] = {expanded: true, rules: {}};
        if (!accordion[severity].rules) accordion[severity].rules = {};
        const {rules} = groupedResults[severity];
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

      window.initButton(sfHost, true);

      if (typeof sfConn === "undefined") {
        throw new Error("sfConn not found. Make sure inspector.js is loaded.");
      }

      await sfConn.getSession(sfHost);

      // Fetch user info
      sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
        this.setState({
          userInfo: res.userFullName + " / " + res.userName + " / " + res.organizationName
        });
      }).catch(() => {
        // Keep default "..." if getUserInfo fails
      });

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
    const target = getLinkTarget(e);
    const url = chrome.runtime.getURL(`options.html?selectedTab=flow-scanner&host=${this.flowScanner?.sfHost}`);
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
      const anyRuleExpanded = ["error", "warning", "info"].some(sev =>
        Object.values(accordion[sev].rules).some(isExpanded => isExpanded)
      );
      if (anyRuleExpanded) {
        // If any rules are expanded, collapse all rules but keep severity groups open.
        ["error", "warning", "info"].forEach(sev => {
          const rules = accordion[sev].rules;
          Object.keys(rules).forEach(rule => { rules[rule] = false; });
        });
      } else {
        // If all rules are collapsed, collapse the severity groups themselves.
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
      const allRulesExpanded = expandedRules.length === ruleKeys.length;
      const isGroupCollapsed = !sevAcc.expanded;

      // This logic cycles through three states:
      // 1. Collapsed group -> Expand group, keeping rule states.
      // 2. Expanded group with some/all rules collapsed -> Expand all rules.
      // 3. Expanded group with all rules expanded -> Collapse group.
      if (isGroupCollapsed) {
        sevAcc.expanded = true;
      } else if (allRulesExpanded) {
        sevAcc.expanded = false;
      } else {
        ruleKeys.forEach(r => { sevAcc.rules[r] = true; });
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

  isStatItemClickable(severity, count) {
    return count > 0 && severity !== "total";
  }

  onStatItemClick(severity, count) {
    if (!this.isStatItemClickable(severity, count)) {
      return;
    }

    // Ensure the severity section is expanded
    this.setState(state => {
      const accordion = {...state.accordion};
      if (!accordion[severity].expanded) {
        accordion[severity].expanded = true;
      }
      return {accordion};
    }, () => {
      // After state update, scroll to the section
      setTimeout(() => {
        const targetId = `${severity}-rules-container`;
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }, 100);
    });
  }

  // Helper to record mousedown coordinates.
  handleMouseDown(e) {
    const el = e.currentTarget;
    el.dataset.startX = e.clientX;
    el.dataset.startY = e.clientY;
  }

  // Helper to ignore click if user dragged to select text.
  shouldIgnoreClick(e) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const el = e.currentTarget;
      const dx = Math.abs(e.clientX - Number(el.dataset.startX));
      const dy = Math.abs(e.clientY - Number(el.dataset.startY));
      return dx > 3 || dy > 3;
    }
    return false;
  }

  renderFlowInfo() {
    if (!this.flowScanner?.currentFlow) {
      return h("div", {className: "area"},
        h("div", {className: "flow-info-section"},
          h("h2", {className: "flow-info-title"},
            h("span", {className: "flow-icon", "aria-hidden": "true"}, "⚡"),
            h("span", {className: "flow-info-title-text"}, "Flow Information")
          ),
          h("div", {className: "flow-info-card compact"},
            h("div", {}, "Loading flow information...")
          )
        )
      );
    }

    const flow = this.flowScanner.currentFlow;
    const elements = this.flowScanner.extractFlowElements();

    return h("div", {className: "area"},
      h("div", {className: "flow-info-section", role: "region", "aria-labelledby": "flow-info-title-text"},
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
              h("div", {className: "flow-detail-item flow-status-item"},
                h("span", {className: "detail-label"}, "Status"),
                h("span", {
                  className: `flow-status-badge ${flow.status?.toLowerCase()}`,
                  role: "status",
                  "aria-live": "polite",
                  id: "flow-status-badge"
                }, flow.status)
              ),
              h("div", {className: "flow-detail-item flow-type-item"},
                h("span", {className: "detail-label"}, "Type"),
                h("span", {className: "detail-value", id: "flow-type"}, flow.type)
              ),
              h("div", {className: "flow-detail-item flow-apiversion-item"},
                h("span", {className: "detail-label"}, "API Version"),
                h("span", {className: "detail-value", id: "flow-api-version"}, flow.xmlData?.apiVersion || "Unknown")
              ),
              h("div", {className: "flow-detail-item flow-elements-item"},
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
                  onMouseDown: e => this.handleMouseDown(e),
                  onClick: e => { if (this.shouldIgnoreClick(e)) return; this.onToggleDescription(e); }
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
      )
    );
  }

  renderScanResults() {
    if (!this.flowScanner?.scanResults) {
      return h("div", {className: "area scan-results-area", style: {display: "none"}});
    }
    const results = this.flowScanner.scanResults;

    // Handle unsupported flow type
    const isUnsupported = results.length === 1 && results[0].isUnsupportedFlow;
    if (isUnsupported) {
      const {displayType, supportedFlowTypes, reason} = results[0];

      // Determine the message based on the reason
      let headerMessage, introMessage;
      if (reason === "explicitly_unsupported") {
        headerMessage = `The "${displayType}" flow type is not supported by Flow Scanner.`;
        introMessage = "This flow type is known to be incompatible with the scanner's analysis capabilities.";
      } else {
        headerMessage = `The "${displayType}" flow type is not currently supported.`;
        introMessage = "Flow Scanner works with specific flow types to ensure accurate analysis.";
      }

      return h("div", {className: "area scan-results-area"},
        h("div", {className: "unsupported-flow-state"},
          // Header section using empty-state pattern
          h("div", {className: "unsupported-flow-header"},
            h("div", {className: "unsupported-icon-large"}, "⚠️"),
            h("h2", {className: "unsupported-title"}, "Unsupported Flow Type"),
            h("p", {className: "unsupported-subtitle"}, headerMessage),
            h("p", {className: "unsupported-description"}, introMessage)
          ),

          // Supported types section using existing card and list styles
          reason !== "explicitly_unsupported" && h("div", {className: "supported-types-section"},
            h("div", {className: "flow-info-card"},
              h("div", {className: "supported-types-header"},
                h("h3", {},
                  h("span", {style: {marginRight: "8px"}}, "✅"),
                  `${supportedFlowTypes.length} Supported Flow Types`
                ),
                h("p", {}, "Flow Scanner can analyze flows of the following types:")
              ),
              h("ul", {className: "supported-types-list"},
                supportedFlowTypes.map(type =>
                  h("li", {key: type}, type)
                )
              )
            )
          )
        )
      );
    }

    const totalIssues = results.length;
    const severityOrder = ["error", "warning", "info"];
    const severityLabels = {error: "Errors", warning: "Warnings", info: "Info"};
    const severityIcons = {
      error: h("span", {className: "sev-ico error", "aria-label": "Error"}, "❗"),
      warning: h("span", {className: "sev-ico warning", "aria-label": "Warning"}, "⚠️"),
      info: h("span", {className: "sev-ico info", "aria-label": "Info"}, "ℹ️")
    };
    const accordion = this.state.accordion;
    const groupedResults = this.getGroupedResults();
    const errorCount = groupedResults.error.results.length;
    const warningCount = groupedResults.warning.results.length;
    const infoCount = groupedResults.info.results.length;
    if (totalIssues === 0) {
      // If no rules are enabled, show a warning and prompt to configure them.
      if (this.flowScanner.noRulesEnabledMessage) {
        return h("div", {className: "area scan-results-area"},
          h("div", {className: "empty-state"},
            h("div", {className: "empty-icon"}, "⚠️"),
            h("h3", {}, "No Rules Enabled"),
            h("p", {}, this.flowScanner.noRulesEnabledMessage),
            h("button", {className: "slds-button slds-button_brand", onClick: this.onToggleHelp}, "Configure Rules")
          )
        );
      }
      // Default "no issues found" state.
      return h("div", {className: "area scan-results-area"},
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
          )
        )
      );
    }
    // Summary panel for when issues are found.
    return h("div", {className: "area scan-results-area", "aria-labelledby": "results-title", "aria-live": "polite"},
      h("div", {className: "summary-body", role: "status", "aria-live": "polite"},
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
            h("div", {
              className: `stat-item error${this.isStatItemClickable("error", errorCount) ? " clickable" : ""}`,
              role: "group",
              "aria-label": "Error issues",
              onClick: this.isStatItemClickable("error", errorCount) ? () => this.onStatItemClick("error", errorCount) : undefined
            },
            h("span", {className: "stat-number", id: "error-issues-count"}, errorCount),
            h("span", {className: "stat-label"}, "Errors")
            ),
            h("div", {
              className: `stat-item warning${this.isStatItemClickable("warning", warningCount) ? " clickable" : ""}`,
              role: "group",
              "aria-label": "Warning issues",
              onClick: this.isStatItemClickable("warning", warningCount) ? () => this.onStatItemClick("warning", warningCount) : undefined
            },
            h("span", {className: "stat-number", id: "warning-issues-count"}, warningCount),
            h("span", {className: "stat-label"}, "Warnings")
            ),
            h("div", {
              className: `stat-item info${this.isStatItemClickable("info", infoCount) ? " clickable" : ""}`,
              role: "group",
              "aria-label": "Information issues",
              onClick: this.isStatItemClickable("info", infoCount) ? () => this.onStatItemClick("info", infoCount) : undefined
            },
            h("span", {className: "stat-number", id: "info-issues-count"}, infoCount),
            h("span", {className: "stat-label"}, "Info")
            )
          ),
          h("div", {className: "summary-actions"},
            h("button", {
              className: "highlighted button-margin",
              title: "Export Results",
              onClick: this.onExportResults,
              disabled: totalIssues === 0
            }, "Export",
            ),
            h("button", {className: "button-margin", id: "expand-all-btn", onClick: this.onExpandAll}, "Expand All"),
            h("button", {className: "button-margin", id: "collapse-all-btn", onClick: this.onCollapseAll}, "Collapse All")
          )
        )
      ),
      h("div", {className: "results-container", role: "region", "aria-labelledby": "results-title"},
        severityOrder.map(severity => {
          const group = groupedResults[severity].results;
          if (!group.length) return null;
          const rules = groupedResults[severity].rules;
          const sevAccordion = accordion[severity] || {expanded: true, rules: {}};
          const isSevExpanded = sevAccordion.expanded !== false;
          const ruleKeys = Object.keys(rules);
          const expandedRules = ruleKeys.filter(r => sevAccordion.rules && sevAccordion.rules[r]);
          // 1=expanded, 2=mixed, 3=collapsed
          let accordionStateAttr = isSevExpanded ? "1" : "3";
          if (isSevExpanded && expandedRules.length > 0 && expandedRules.length < ruleKeys.length) {
            accordionStateAttr = "2";
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
            onMouseDown: e => this.handleMouseDown(e),
            onClick: e => { if (this.shouldIgnoreClick(e)) return; this.onSeverityToggle(severity); },
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
                onMouseDown: e => this.handleMouseDown(e),
                onClick: e => { if (this.shouldIgnoreClick(e)) return; this.onRuleToggle(severity, ruleType); e.currentTarget.blur(); },
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
              h("div", {className: "rule-content", id: `${severity}-${ruleIdx}-content`},
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
              const isMono = MONO_HEADERS.has(header);
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

    return h("div", {className: "area scan-results-area"},
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

    return h("div", {},
      h("div", {id: "user-info", className: "slds-border_bottom"},
        // Salesforce home link
        h("a", {
          href: sfLink,
          className: "sf-link",
          target: getLinkTarget()
        },
        h("svg", {viewBox: "0 0 24 24"},
          h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
        ),
        " Salesforce Home"
        ),
        // Title
        h("h1", {}, "Flow Scanner"),
        h("span", {}, " / " + this.state.userInfo),
        // Right-side header elements
        h("div", {className: "flex-right"},
          // Note about core library version
          h("div", {className: "flow-scanner-note-header"},
            h("small", {},
              "💡 Based on ",
              h("a", {
                href: "https://github.com/corekraft/flow-linter-core",
                target: getLinkTarget(),
              }, "Flow Linter Core"),
              `\u00A0 (core v${scannerVersion})`
            )
          ),
          h("a", {href: "#", id: "help-btn", title: "Open Flow Scanner Options", onClick: this.onToggleHelp, target: getLinkTarget()},
            h("svg", {className: "icon"},
              h("use", {xlinkHref: "symbols.svg#question"})
            )
          )
        )
      ),
      h("div", {className: "main-content-wrapper"},
        this.renderFlowInfo(),
        this.state.error ? this.renderError() : this.renderScanResults()
      ),
      this.renderLoadingOverlay(),
      h("div", {className: "sr-only", "aria-live": "polite", "aria-atomic": "true", id: "sr-announcements"})
    );
  }
}

const MONO_HEADERS = new Set(["Name", "Connects to", "Expression", "Location"]);

// Initialize the application
{
  let root = document.getElementById("root");

  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(h(App), root);

  if (parent && parent.isUnitTest) {
    parent.insextTestLoaded({sfConn});
  }
}
