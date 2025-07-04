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
    this.bindEvents();
    await this.loadFlowInfo();

    // Set loading text while the scan is in progress.
    const loadingTitle = document.getElementById("loading-title");
    const loadingDescription = document.getElementById("loading-description");
    if (loadingTitle) loadingTitle.textContent = "Analyzing Flow...";
    if (loadingDescription) loadingDescription.textContent = "Please wait while we scan your flow for potential issues.";

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
        if (this.flowScannerCore.version) {
          const versionDisplay = document.getElementById("scanner-version-display");
          if (versionDisplay) {
            versionDisplay.textContent = `(core v${this.flowScannerCore.version})`;
          }
        }
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
   * Binds all UI event handlers for the application.
   */
  bindEvents() {
    const toggleBtn = document.getElementById("description-toggle-btn");
    const flowDescriptionContainer = document.querySelector(".flow-description-container");
    const flowDescription = document.getElementById("flow-description");

    // Toggle description visibility when the button is clicked.
    if (toggleBtn && flowDescriptionContainer) {
      toggleBtn.addEventListener("click", () => {
        this.toggleDescription(flowDescriptionContainer, toggleBtn);
      });
    }

    // Also toggle description when the description text itself is clicked.
    if (flowDescription && flowDescriptionContainer) {
      flowDescription.addEventListener("click", (event) => {
        // Prevent toggling if user is selecting text.
        const selection = window.getSelection();
        if (selection.toString().length > 0) {
          return;
        }

        // Prevent toggling if a link or button within the description is clicked.
        if (event.target.tagName === "A" || event.target.tagName === "BUTTON") {
          return;
        }

        this.toggleDescription(flowDescriptionContainer, toggleBtn);
      });

      // Add keyboard support for toggling description for accessibility.
      flowDescription.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.toggleDescription(flowDescriptionContainer, toggleBtn);
        }
      });
    }

    // Add global keyboard shortcuts.
    document.addEventListener("keydown", (event) => {
      // Ctrl/Cmd + E to export results.
      if ((event.ctrlKey || event.metaKey) && event.key === "e") {
        event.preventDefault();
        this.handleExportClick();
      }
      // Escape key to close the scanner overlay.
      if (event.key === "Escape") {
        this.closeOverlay();
      }
    });

    // Add event handler for help button to open options page
    const helpBtn = document.getElementById("help-btn");
    if (helpBtn) {
      helpBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = this.getLinkTarget(e);
        const url = chrome.runtime.getURL(`options.html?selectedTab=8&host=${this.sfHost}`);
        window.open(url, target);
      });
    }
  }

  /**
   * Toggles the visibility of the flow description and updates ARIA attributes.
   * @param {HTMLElement} container - The description's container element.
   * @param {HTMLElement} toggleBtn - The button that controls the toggle.
   */
  toggleDescription(container, toggleBtn) {
    const isCollapsed = container.classList.toggle("collapsed");
    toggleBtn.setAttribute("aria-expanded", !isCollapsed);
    const toggleLabel = document.getElementById("toggle-label");
    if (toggleLabel) toggleLabel.textContent = isCollapsed ? "Show description" : "Hide description";
  }

  /**
   * Handles the export button click to generate and download CSV results
   */
  handleExportClick() {
    if (this.scanResults.length === 0) {
      return;
    }
    const exportButton = document.getElementById("export-button-summary");
    if (!exportButton) { return; }

    // Update button state to show exporting status
    const originalContent = exportButton.innerHTML;
    exportButton.innerHTML = "<span class=\"export-icon\" aria-hidden=\"true\">📁</span> Exporting...";
    exportButton.disabled = true;
    exportButton.classList.add("exporting");

    setTimeout(() => {
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

      // Restore the export button to its original state.
      exportButton.innerHTML = originalContent;
      exportButton.disabled = false;
      exportButton.classList.remove("exporting");
    }, 50);
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
      this.displayFlowInfo(flowInfo);
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
   * Updates the UI with flow information
   * @param {Object} flowInfo - The flow metadata to display
   */
  displayFlowInfo(flowInfo) {
    const labelElement = document.getElementById("flow-label");
    const nameElement = document.getElementById("flow-name");
    const typeElement = document.getElementById("flow-type");
    const statusElement = document.getElementById("flow-status-text");
    const statusBadge = document.getElementById("flow-status-badge");
    const apiVersionElement = document.getElementById("flow-api-version");
    const descriptionElement = document.getElementById("flow-description");
    const elementsCountElement = document.getElementById("flow-elements-count");
    const triggerObjectElement = document.getElementById("flow-trigger-object");
    const triggerTypeElement = document.getElementById("flow-trigger-type");

    // Populate the UI elements with the fetched flow information.
    if (labelElement) labelElement.textContent = flowInfo.label || "Unknown Label";
    if (nameElement) nameElement.textContent = flowInfo.apiName || "Unknown API Name";
    if (typeElement) typeElement.textContent = flowInfo.type;

    // Display trigger object or event.
    if (triggerObjectElement) {
      let triggerDisplay = "—";
      if (flowInfo.triggerObjectLabel && flowInfo.triggerObjectLabel !== "—") {
        triggerDisplay = flowInfo.triggerObjectLabel;
      }
      triggerObjectElement.textContent = triggerDisplay;
    }
    if (triggerTypeElement) triggerTypeElement.textContent = flowInfo.triggerType || "—";

    // Set the status badge text and style based on the flow's status.
    if (statusElement && statusBadge) {
      statusElement.textContent = flowInfo.status;
      statusBadge.className = "flow-status-badge";
      const statusLower = flowInfo.status.toLowerCase();
      if (statusLower === "active") {
        statusBadge.classList.add("active");
      } else if (statusLower === "draft") {
        statusBadge.classList.add("draft");
      } else if (statusLower === "inactive") {
        statusBadge.classList.add("inactive");
      } else if (statusLower === "obsolete") {
        statusBadge.classList.add("obsolete");
      } else if (statusLower === "archived") {
        statusBadge.classList.add("archived");
      } else if (statusLower === "deprecated") {
        statusBadge.classList.add("deprecated");
      }
    }

    // Set the API version from the flow's metadata.
    if (apiVersionElement) {
      const apiVersion = flowInfo.xmlData?.apiVersion || "Unknown";
      apiVersionElement.textContent = apiVersion;
    }

    // Format and display the flow description.
    if (descriptionElement) {
      const description = flowInfo.xmlData?.description || "No description provided";
      // Render newlines as <br> tags in HTML.
      const htmlDescription = description.replace(/\n/g, "<br>");
      descriptionElement.innerHTML = htmlDescription;
      // Ensure the full description is visible.
      descriptionElement.style.whiteSpace = "";
      descriptionElement.style.overflow = "";
      descriptionElement.style.textOverflow = "";
      if (!flowInfo.xmlData?.description) {
        descriptionElement.style.fontStyle = "italic";
        descriptionElement.style.color = "#6c757d";
      } else {
        descriptionElement.style.fontStyle = "normal";
        descriptionElement.style.color = "#495057";
      }
    }

    // Display the total count of elements in the flow.
    if (elementsCountElement) {
      const elements = this.extractFlowElements();
      elementsCountElement.textContent = elements.length;
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
            config: { path: cr.path }
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
      this.displayResults(results);
    } catch (error) {
      this.showError("Failed to scan flow: " + error.message);
      this.scanResults = [{
        rule: "Scan Error",
        description: "Failed to scan flow: " + error.message,
        severity: "error",
        details: "Flow: " + (this.currentFlow ? this.currentFlow.name : "Unknown")
      }];
      this.displayResults(this.scanResults);
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
   * Displays scan results in the UI
   * @param {Array} results - The scan results to display
   */
  displayResults(results) {
    this.scanResults = results;

    const resultsSection = document.getElementById("results-section");
    const resultsContainer = document.getElementById("results-container");

    if (!resultsSection || !resultsContainer) {
      console.error("Results section or container not found");
      return;
    }

    // Make the results section visible.
    resultsSection.style.display = "block";

    // Handle unsupported flow type message
    const isUnsupported = results.length === 1 && results[0].isUnsupportedFlow;
    if (isUnsupported) {
      const {displayType, supportedFlowTypes} = results[0];

      const summary = document.getElementById("results-summary");
      if (summary) {
        summary.style.display = "none";
      }

      const supportedTypesFormatted = supportedFlowTypes
        .map(type => `<li>${type}</li>`)
        .join("");

      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="unsupported-flow-state">
            <div class="unsupported-flow-header">
              <div class="unsupported-icon">⚠️</div>
              <div class="unsupported-flow-header-text">
                <h3>Unsupported Flow Type</h3>
                <p>Flow Scanner does not currently support the "${displayType}" flow type.</p>
              </div>
            </div>
            <p class="unsupported-flow-intro">The scanner is designed to work with specific flow types. There are ${supportedFlowTypes.length} supported types, which include:</p>
            <div class="unsupported-flow-details">
              <ul class="supported-types-list">
                ${supportedTypesFormatted}
              </ul>
            </div>
          </div>
        `;
      }
      return;
    }

    // If no issues are found, display a success message.
    if (results.length === 0) {
      // Hide the summary panel as it's not needed.
      const summary = document.getElementById("results-summary");
      if (summary) {
        summary.style.display = "none";
      }
      resultsContainer.innerHTML = `
        <div class="success-state">
          <div class="success-icon">✅</div>
          <h3>No Issues Found</h3>
          <p>Great job! Your flow passed all checks with no issues detected.</p>
          <div class="success-metrics">
            <div class="metric-item">
              <div class="metric-value">0</div>
              <div class="metric-label">Issues</div>
            </div>
            <div class="metric-item">
              <div class="metric-value">100%</div>
              <div class="metric-label">Clean</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Group results by severity level (error, warning, info), then by rule name.
    const severityOrder = ["error", "warning", "info"];
    const severityLabels = {error: "Errors", warning: "Warnings", info: "Info"};
    const severityIcons = {
      error: "<span class='sev-ico error' aria-label='Error'>❗</span>",
      warning: "<span class='sev-ico warning' aria-label='Warning'>⚠️</span>",
      info: "<span class='sev-ico info' aria-label='Info'>ℹ️</span>"
    };
    const severityGroups = {error: [], warning: [], info: []};

    // Distribute results into severity groups.
    results.forEach(r => {
      if (severityGroups[r.severity]) severityGroups[r.severity].push(r);
    });

    // Calculate statistics for the summary panel.
    const totalIssues = results.length;
    const errorCount = severityGroups.error.length;
    const warningCount = severityGroups.warning.length;
    const infoCount = severityGroups.info.length;
    this.updateSummaryStats(totalIssues, errorCount, warningCount, infoCount);

    // Populate the summary section with stats and action buttons.
    const resultsSummary = document.getElementById("results-summary");
    if (resultsSummary) {
      resultsSummary.innerHTML = `
        <div class="summary-body">
            <h3 class="summary-title">
                <span class="results-icon">📊</span>
                Scan Results
            </h3>
            <div class="summary-right-panel">
              <div class="summary-stats" role="group" aria-label="Scan results summary">
                  <div class="stat-item total" role="group" aria-label="Total issues">
                      <span class="stat-number" id="total-issues">${totalIssues}</span>
                      <span class="stat-label">Total</span>
                  </div>
                  <div class="stat-item error" role="group" aria-label="Error issues">
                      <span class="stat-number" id="error-count">${errorCount}</span>
                      <span class="stat-label">Errors</span>
                  </div>
                  <div class="stat-item warning" role="group" aria-label="Warning issues">
                      <span class="stat-number" id="warning-count">${warningCount}</span>
                      <span class="stat-label">Warnings</span>
                  </div>
                  <div class="stat-item info" role="group" aria-label="Information issues">
                      <span class="stat-number" id="info-count">${infoCount}</span>
                      <span class="stat-label">Info</span>
                  </div>
              </div>
              <div class="summary-actions">
                  <button id="export-button-summary" class="summary-action-btn" title="Export Results">
                      <span class="export-icon" aria-hidden="true">📁</span> Export
                  </button>
                  <button id="expand-all-btn" class="summary-action-btn">Expand All</button>
                  <button id="collapse-all-btn" class="summary-action-btn">Collapse All</button>
              </div>
            </div>
        </div>
      `;
      
      // Bind the export button in the summary panel.
      const exportSummaryBtn = document.getElementById("export-button-summary");
      if (exportSummaryBtn) {
        exportSummaryBtn.disabled = this.scanResults.length === 0;
        exportSummaryBtn.onclick = () => this.handleExportClick();
      }
    }

    // Build the HTML for the detailed results, starting with severity sections.
    let resultsHTML = "";
    severityOrder.forEach((sev, sevIdx) => {
      const group = severityGroups[sev];
      if (!group.length) return;

      const severityGroupId = `severity-group-${sevIdx}`;

      // Create the main container for the severity group.
      resultsHTML += `
        <div class="severity-group-layout ${sev}" data-accordion-state="1">
          <div class="severity-title-left" data-accordion-toggle="true" role="button" tabindex="0" aria-expanded="true" aria-controls="${severityGroupId}">
            <h3 class="severity-heading">
              <div class="severity-heading-content">
                <svg class="accordion-chevron" width="24" height="24" aria-hidden="true">
                  <use xlink:href="symbols.svg#accordion-chevron"></use>
                </svg>
                <span class="severity-label-group">
                  ${severityIcons[sev] || ""}
                  <span>${severityLabels[sev]}</span>
                </span>
              </div>
            </h3>
            <span class="severity-total-count">${group.length} Issue${group.length === 1 ? "" : "s"}</span>
          </div>
          <div class="rules-container-right" id="${severityGroupId}">
      `;

      // Group the issues within this severity by their rule name.
      const rules = {};
      group.forEach(result => {
        const ruleType = result.rule || result.ruleLabel || "Unknown Rule";
        if (!rules[ruleType]) rules[ruleType] = [];
        rules[ruleType].push(result);
      });
      
      // Create a collapsible section for each rule.
      Object.entries(rules).forEach(([ruleType, ruleResults], ruleIdx) => {
        const ruleId = `rule-${sev}-${ruleIdx}`;
        const description = ruleResults[0].description || "Rule violation detected";
        const infoIconSVG = "<svg class=\"info-icon\" aria-hidden=\"true\"><use xlink:href=\"symbols.svg#info\"></use></svg>";

        // Create the header for the rule section, including a tooltip with the rule's description.
        resultsHTML += `
          <div class="rule-section compact expanded card-bg" data-rule-type="${ruleType}">
            <div class="rule-header" data-accordion-toggle="true" tabindex="0" role="button" aria-expanded="true" aria-controls="${ruleId}">
              <div class="rule-title-section">
                <span class="rule-name-compact">${ruleType}</span>
                <div class="tooltip-container">
                    ${infoIconSVG}
                    <div class="tooltip-content">${description}</div>
                </div>
                <span class="badge-total circle-badge">${ruleResults.length}</span>
              </div>
              <svg class="accordion-chevron" width="24" height="24" aria-hidden="true">
                <use xlink:href="symbols.svg#accordion-chevron"></use>
              </svg>
            </div>
            <div class="rule-content" id="${ruleId}">
        `;
        
        // Create a table to display the details of each issue for this rule.
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

        if (activeHeaders.length > 0) {
          resultsHTML += "<table class=\"details-table\">";
          resultsHTML += "<thead><tr>";
          activeHeaders.forEach(header => {
            resultsHTML += `<th>${header}</th>`;
          });
          resultsHTML += "</tr></thead>";
          resultsHTML += "<tbody>";
          rows.forEach(row => {
            resultsHTML += "<tr>";
            activeHeaders.forEach(header => {
              const cellValue = row[header] || "—";
              const isMono = ["Name", "Connects to", "Expression", "Location"].includes(header);
              const cellClass = isMono ? "mono" : "";
              resultsHTML += `<td><div class="cell-content ${cellClass}" title="${cellValue}">${cellValue}</div></td>`;
            });
            resultsHTML += "</tr>";
          });
          resultsHTML += "</tbody></table>";
        }
        resultsHTML += `
            </div>
          </div>
        `;
      });
      resultsHTML += `
          </div>
        </div>
      `;
    });

    // Render the generated HTML and bind necessary events.
    resultsContainer.innerHTML = resultsHTML;
    this.bindAccordionEvents();
    this.bindExpandCollapseAll();
    this.announceResults(totalIssues, errorCount, warningCount, infoCount);
  }

  /**
   * Binds click and keyboard events to all accordion toggles for interactive sections.
   */
  bindAccordionEvents() {
    const accordionToggles = document.querySelectorAll('[data-accordion-toggle="true"]');
    accordionToggles.forEach(toggle => {
      toggle.addEventListener("click", () => {
        this.handleAccordionToggle(toggle);
      });
      toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.handleAccordionToggle(toggle);
        }
      });
    });
  }

  /**
   * Handles clicks on accordion toggles, delegating to the correct handler.
   * @param {HTMLElement} toggle - The accordion toggle element that was clicked.
   */
  handleAccordionToggle(toggle) {
    // Handle toggles for severity-level sections.
    if (toggle.classList.contains("severity-title-left")) {
      const section = toggle.closest(".severity-group-layout");
      if (section) this.cycleSeverityAccordion(section);
    } else if (toggle.classList.contains("rule-header")) {
      // Handle toggles for rule-level sections.
      const section = toggle.closest(".rule-section");
      if (section) this.toggleAccordion(section);
    }
  }

  /**
   * Cycles a severity group's accordion through its three states:
   * 1. Fully expanded (all rules visible).
   * 2. Partially collapsed (rules are collapsed).
   * 3. Fully collapsed (severity group is collapsed).
   * @param {HTMLElement} section - The severity group element.
   */
  cycleSeverityAccordion(section) {
    let state = parseInt(section.dataset.accordionState || "1", 10);
    state = (state % 3) + 1; // Cycle through states 1, 2, 3.
    section.dataset.accordionState = state;

    const rules = section.querySelectorAll(".rule-section");
    if (state === 1) { // Expand all rules within the group.
      rules.forEach(rule => this.toggleAccordion(rule, true, true));
    } else if (state === 2) { // Collapse all rules within the group.
      rules.forEach(rule => this.toggleAccordion(rule, false, true));
    }
    // State 3 (fully collapsed) is handled by CSS on the parent element.

    this.updateButtonStates();
  }

  /**
   * Toggles an individual accordion section (like a rule section) between expanded and collapsed.
   * @param {HTMLElement} section - The section element to toggle.
   * @param {boolean} forceState - Optional. `true` to force expansion, `false` to force collapse.
   * @param {boolean} suppressRecalculation - Optional. If true, parent state is not recalculated.
   */
  toggleAccordion(section, forceState, suppressRecalculation = false) {
    const isCurrentlyExpanded = section.classList.contains("expanded");
    let shouldBeExpanded;
    if (typeof forceState === "boolean") {
      shouldBeExpanded = forceState;
    } else {
      shouldBeExpanded = !isCurrentlyExpanded;
    }

    if (isCurrentlyExpanded === shouldBeExpanded) return; // No change needed

    section.classList.toggle("expanded", shouldBeExpanded);
    section.classList.toggle("collapsed", !shouldBeExpanded);
    const header = section.querySelector('[data-accordion-toggle="true"]');
    if (header) {
      header.setAttribute("aria-expanded", shouldBeExpanded);
    }
    // After toggling a rule, its parent severity group's state may need to be updated.
    const parentSeverityGroup = section.closest(".severity-group-layout");
    if (parentSeverityGroup && !suppressRecalculation) {
      this.recalculateSeverityState(parentSeverityGroup);
    }
  }

  /**
   * Recalculates the state of a severity group based on the state of its child rule sections.
   * This is used to correctly display the parent accordion's state (expanded, collapsed, or mixed).
   * @param {HTMLElement} severityGroup - The severity group element.
   */
  recalculateSeverityState(severityGroup) {
    const rules = severityGroup.querySelectorAll(".rule-section");
    if (rules.length === 0) {
      severityGroup.dataset.accordionState = "1"; // Default to expanded if no rules
      this.updateButtonStates();
      return;
    }
    const areAllExpanded = Array.from(rules).every(r => r.classList.contains("expanded"));
    const areAllCollapsed = Array.from(rules).every(r => r.classList.contains("collapsed"));

    if (areAllExpanded) {
      severityGroup.dataset.accordionState = "1";
    } else if (areAllCollapsed) {
      severityGroup.dataset.accordionState = "2";
    } else {
      severityGroup.dataset.accordionState = "0"; // Mixed state
    }
    this.updateButtonStates();
  }

  /**
   * Binds click events to the "Expand All" and "Collapse All" buttons.
   */
  bindExpandCollapseAll() {
    const expandBtn = document.getElementById("expand-all-btn");
    const collapseBtn = document.getElementById("collapse-all-btn");

    if (expandBtn) {
      expandBtn.onclick = () => {
        document.querySelectorAll(".severity-group-layout").forEach(sec => {
          sec.dataset.accordionState = "1";
          sec.querySelectorAll(".rule-section").forEach(rule => this.toggleAccordion(rule, true));
        });
        this.updateButtonStates();
      };
    }

    if (collapseBtn) {
      collapseBtn.onclick = () => {
        const anyRulesExpanded = !!document.querySelector(".rule-section.expanded");
        if (anyRulesExpanded) {
          // If any rules are open, the first click collapses them.
          document.querySelectorAll(".rule-section").forEach(rule => this.toggleAccordion(rule, false));
        } else {
          // If all rules are already collapsed, the next click collapses the severity groups.
          document.querySelectorAll(".severity-group-layout").forEach(sec => {
            sec.dataset.accordionState = "3";
          });
        }
        this.updateButtonStates();
      };
    }
    this.updateButtonStates();
  }

  /**
   * Updates the text and disabled state of the "Expand All" and "Collapse All" buttons
   * based on the current state of the accordions.
   */
  updateButtonStates() {
    const expandBtn = document.getElementById("expand-all-btn");
    const collapseBtn = document.getElementById("collapse-all-btn");
    if (!expandBtn || !collapseBtn) return;

    const ruleSections = document.querySelectorAll(".rule-section");
    if (ruleSections.length === 0) {
      expandBtn.disabled = true;
      collapseBtn.disabled = true;
      return;
    }

    const severityGroups = document.querySelectorAll(".severity-group-layout");
    const anyRulesExpanded = !!document.querySelector(".rule-section.expanded");
    const allRulesCollapsed = !anyRulesExpanded;
    const allRulesExpanded = Array.from(ruleSections).every(rs => rs.classList.contains("expanded"));

    const allSeveritiesCompletelyCollapsed = Array.from(severityGroups).every(sg => sg.dataset.accordionState === "3");
    const allSeveritiesExpanded = Array.from(severityGroups).every(sg => sg.dataset.accordionState !== "3");

    // Logic for the "Collapse" button.
    collapseBtn.textContent = anyRulesExpanded ? "Collapse Rules" : "Collapse All";
    collapseBtn.disabled = allRulesCollapsed && allSeveritiesCompletelyCollapsed;

    // Logic for the "Expand" button.
    if (allSeveritiesExpanded && allRulesCollapsed) {
      expandBtn.textContent = "Expand Rules";
    } else {
      expandBtn.textContent = "Expand All";
    }
    expandBtn.disabled = allSeveritiesExpanded && allRulesExpanded;
  }

  /**
   * Updates the summary statistics in the UI with animated counters.
   * @param {number} totalIssues - Total number of issues found.
   * @param {number} errorCount - Number of 'error' severity issues.
   * @param {number} warningCount - Number of 'warning' severity issues.
   * @param {number} infoCount - Number of 'info' severity issues.
   */
  updateSummaryStats(totalIssues, errorCount, warningCount, infoCount) {
    const totalElement = document.getElementById("total-issues");
    const errorElement = document.getElementById("error-count");
    const warningElement = document.getElementById("warning-count");
    const infoElement = document.getElementById("info-count");

    if (totalElement) this.animateCounter(totalElement, totalIssues);
    if (errorElement) this.animateCounter(errorElement, errorCount);
    if (warningElement) this.animateCounter(warningElement, warningCount);
    if (infoElement) this.animateCounter(infoElement, infoCount);
  }

  /**
   * Shows an error message in the UI.
   * If the error is about disabled rules, it provides a button to open the options page.
   * @param {string} message - The error message to display.
   */
  showError(message) {
    // Clear the summary panel to avoid showing stale data.
    const summary = document.getElementById("results-summary");
    if (summary) {
      summary.innerHTML = "";
      summary.style.display = "none";
    }
    const container = document.getElementById("results-container");
    const resultsSection = document.getElementById("results-section");

    // Make the results section visible to show the error.
    if (resultsSection) {
      resultsSection.style.display = "block";
    }

    if (message.includes("No Flow Scanner rules are enabled")) {
      // Provide a helpful message and a link to the options page.
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚙️</div>
          <h3>No Rules Enabled</h3>
          <p>${message}</p>
          <div class="action-buttons">
            <button id="open-options-btn" class="button button-brand">
              Open Flow Scanner Options
            </button>
          </div>
        </div>
      `;
      // Bind a click event to the button to open the extension's options page.
      const openBtn = document.getElementById("open-options-btn");
      if (openBtn) {
        openBtn.addEventListener("click", (e) => {
          const target = this.getLinkTarget(e);
          window.open(chrome.runtime.getURL(`options.html?selectedTab=8&host=${this.sfHost}`), target);
        });
      }
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Error Occurred</h3>
          <p>${message}</p>
        </div>
      `;
    }
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

  /**
   * Announces the scan results to screen readers for accessibility.
   * @param {number} totalIssues - Total number of issues found.
   * @param {number} errorCount - Number of 'error' severity issues.
   * @param {number} warningCount - Number of 'warning' severity issues.
   * @param {number} infoCount - Number of 'info' severity issues.
   */
  announceResults(totalIssues, errorCount, warningCount, infoCount) {
    const srAnnouncements = document.getElementById("sr-announcements");
    if (srAnnouncements) {
      let announcement = "Scan completed. Found " + totalIssues + " total issues";

      if (errorCount > 0) {
        announcement += ", " + errorCount + " critical issues";
      }
      if (warningCount > 0) {
        announcement += ", " + warningCount + " warnings";
      }
      if (infoCount > 0) {
        announcement += ", " + infoCount + " recommendations";
      }

      if (totalIssues === 0) {
        announcement = "Scan completed. No issues found. Your flow follows best practices.";
      }

      srAnnouncements.textContent = announcement;

      // Clear the announcement after a few seconds to avoid cluttering the screen reader output.
      setTimeout(() => {
        srAnnouncements.textContent = "";
      }, 3000);
    }
  }

  /**
   * Animates a number counter from its current value to a new value.
   * @param {HTMLElement} element - The HTML element containing the number to animate.
   * @param {number} newValue - The target value to animate to.
   */
  animateCounter(element, newValue) {
    if (!element) return;
    let currentValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = Date.now();

    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      currentValue = Math.ceil((newValue * progress) + (currentValue * (1 - progress)));
      element.textContent = currentValue;
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    animate();
  }
}

/**
 * Initializes the Flow Scanner application
 */
async function init() {
  const loadingOverlay = document.getElementById("loading-overlay");
  const loadingTitle = document.getElementById("loading-title");
  const loadingDescription = document.getElementById("loading-description");

  // Show a loading message while initializing.
  if (loadingOverlay) {
    if (loadingTitle) loadingTitle.textContent = "Loading Flow Data...";
    if (loadingDescription) loadingDescription.textContent = "Please wait while we retrieve the flow metadata from Salesforce.";
    loadingOverlay.style.display = "flex";
  }

  try {
    // Extract required parameters from the URL.
    const params = new URLSearchParams(window.location.search);
    const sfHost = params.get("host");
    const flowDefId = params.get("flowDefId");
    const flowId = params.get("flowId");

    // Validate required parameters
    if (!sfHost || !flowDefId || !flowId) {
      throw new Error(`Missing required parameters: host=${sfHost}, flowDefId=${flowDefId}, flowId=${flowId}`);
    }

    // Check that all required script dependencies are loaded.
    if (typeof initButton === "undefined") {
      throw new Error("initButton function not found. Make sure button.js is loaded.");
    }

    // Initialize the main inspector button.
    initButton(sfHost, true);

    // Ensure the Salesforce connection object is available.
    if (typeof sfConn === "undefined") {
      throw new Error("sfConn not found. Make sure inspector.js is loaded.");
    }

    // Get the Salesforce session and then initialize the scanner.
    await sfConn.getSession(sfHost);

    window.flowScanner = new FlowScanner(sfHost, flowDefId, flowId);
    await window.flowScanner.init();

  } catch (error) {
    // Display a detailed error message if initialization fails.
    const resultsContainer = document.getElementById("results-container");

    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="empty-state" style="color: #c62828;">
          <div class="empty-icon">❌</div>
          <h3>Initialization Error</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <pre><strong>Stack:</strong> ${error.stack}</pre>
          <p>Please check the browser console for more details.</p>
        </div>
      `;
    }

    // Also update the main info display to indicate an error.
    const flowName = document.getElementById("flow-name");
    const flowType = document.getElementById("flow-type");
    const flowElementsCount = document.getElementById("flow-elements-count");
    const flowDescription = document.getElementById("flow-description");

    if (flowName) flowName.textContent = "Error: " + error.message;
    if (flowType) flowType.textContent = "Error";
    if (flowElementsCount) flowElementsCount.textContent = "Error";
    if (flowDescription) flowDescription.textContent = "Failed to load flow information. Check console for details.";
  } finally {
    // Hide the loading overlay regardless of success or failure.
    if (loadingOverlay) {
      loadingOverlay.style.display = "none";
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
