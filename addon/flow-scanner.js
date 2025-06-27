import {sfConn, apiVersion} from "./inspector.js";
/* global initButton lightningflowscanner */

// Debug script loading
console.log("Flow Scanner Core script loaded");
console.log("Available global variables after loading:", Object.keys(window).filter(key => key.toLowerCase().includes("flow")));
if (typeof lightningflowscanner !== "undefined") {
  console.log("lightningflowscanner found:", lightningflowscanner);
}

const normalizeSeverity = (sev, direction = "ui") => {
  if (direction === "ui") return sev === "note" ? "info" : sev;
  if (direction === "storage") return sev === "info" ? "note" : sev;
  return sev;
};

class FlowScanner {
  constructor(sfHost, flowDefId, flowId) {
    console.log("FlowScanner constructor called with:", {sfHost, flowDefId, flowId});
    this.sfHost = sfHost;
    this.flowDefId = flowDefId;
    this.flowId = flowId;
    this.currentFlow = null;
    this.scanResults = [];
    this.flowScannerCore = null;
    this.isScanning = false;

    console.log("FlowScanner instance created, calling init()");
    this.init();
  }

  init() {
    console.log("FlowScanner init() called");
    this.initFlowScannerCore();
    // Wait for DOM to be ready before binding events
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.bindEvents();
      });
    } else {
      // DOM is already loaded
      this.bindEvents();
    }
    this.loadFlowInfo();
  }

  initFlowScannerCore() {
    try {
      console.log("Initializing Flow Scanner Core...");

      // Only use lightningflowscanner - no fallbacks
      if (typeof lightningflowscanner !== "undefined") {
        console.log("Flow Scanner Core found as lightningflowscanner, creating instance");
        this.flowScannerCore = lightningflowscanner;
        console.log("Flow Scanner Core loaded successfully");
      } else {
        console.error("Flow Scanner Core (lightningflowscanner) not available");
        this.flowScannerCore = null;
        throw new Error("Flow Scanner Core library not loaded. Please ensure flow-scanner-core.js is properly included.");
      }
    } catch (error) {
      console.error("Error initializing Flow Scanner Core:", error);
      this.flowScannerCore = null;
      throw error;
    }
  }

  bindEvents() {
    const scanButton = document.getElementById("scan-button");
    const exportButton = document.getElementById("export-button");
    const toggleBtn = document.getElementById("description-toggle-btn");
    const flowDescriptionContainer = document.querySelector(".flow-description-container");

    if (!scanButton) {
      console.error("Scan button not found in DOM");
      return;
    }

    scanButton.addEventListener("click", () => {
      this.handleScanClick();
    });

    if (exportButton) {
      exportButton.addEventListener("click", () => {
        this.handleExportClick();
      });
    }

    // Only use the new button-based toggle logic
    if (toggleBtn && flowDescriptionContainer) {
      toggleBtn.addEventListener("click", () => {
        const isCollapsed = flowDescriptionContainer.classList.toggle("collapsed");
        toggleBtn.setAttribute("aria-expanded", !isCollapsed);
        const toggleLabel = document.getElementById("toggle-label");
        if (toggleLabel) toggleLabel.textContent = isCollapsed ? "Show description" : "Hide description";
      });
    }

    // Add keyboard shortcuts
    document.addEventListener("keydown", (event) => {
      // Ctrl/Cmd + Enter to scan
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        this.handleScanClick();
      }
      // Ctrl/Cmd + E to export
      if ((event.ctrlKey || event.metaKey) && event.key === "e") {
        event.preventDefault();
        this.handleExportClick();
      }
      // Escape to close
      if (event.key === "Escape") {
        this.closeOverlay();
      }
    });
  }

  handleScanClick() {
    if (this.isScanning) {
      return; // Prevent multiple scans
    }

    const scanButton = document.getElementById("scan-button");
    const originalText = scanButton.innerHTML;

    // Update button state
    scanButton.disabled = true;
    scanButton.innerHTML = `
      <svg class="slds-button__icon slds-button__icon_left" aria-hidden="true">
        <use xlinkHref="symbols.svg#spinner"></use>
      </svg>
      Scanning...
    `;
    scanButton.classList.add("scanning");

    // Perform scan
    this.scanFlow().finally(() => {
      // Restore button state
      scanButton.disabled = false;
      scanButton.innerHTML = originalText;
      scanButton.classList.remove("scanning");
    });
  }

  handleExportClick() {
    if (this.scanResults.length === 0) {
      return;
    }

    // Create CSV export with detailed fields including node information
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

    this.scanResults.forEach(result => {
      const row = csvHeaders.map(header => {
        const value = result[header] || "";
        // Escape quotes and wrap in quotes if contains comma or quote
        const escapedValue = value.toString().replace(/"/g, '""');
        return `"${escapedValue}"`;
      });
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], {type: "text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flow-scan-${this.currentFlow.name}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async loadFlowInfo() {
    console.log("Loading flow info...");
    try {
      if (!this.flowDefId || !this.flowId) {
        this.showError("No flow information found in URL");
        return;
      }
      const flowInfo = await this.getFlowMetadata();
      console.log("Flow info loaded:", flowInfo);
      this.currentFlow = flowInfo;
      this.displayFlowInfo(flowInfo);
    } catch (error) {
      console.error("Error loading flow info:", error);
      this.showError("Failed to load flow information: " + error.message);
    }
  }

  async getFlowMetadata() {
    try {
      console.log("Fetching flow metadata for:", {flowId: this.flowId, flowDefId: this.flowDefId});

      // Add cache-busting parameter to force fresh queries
      const cacheBuster = Math.random();

      // Use the correct Tooling API format with only valid fields
      const [flowRes, flowDefRes] = await Promise.all([
        sfConn.rest(`/services/data/v${apiVersion}/tooling/query?q=SELECT+Id,Metadata+FROM+Flow+WHERE+Id='${this.flowId}'&cache=${cacheBuster}`),
        sfConn.rest(`/services/data/v${apiVersion}/tooling/query?q=SELECT+Id,DeveloperName,MasterLabel+FROM+FlowDefinition+WHERE+Id='${this.flowDefId}'&cache=${cacheBuster}`)
      ]);

      console.log("Flow API response:", flowRes);
      console.log("FlowDefinition API response:", flowDefRes);

      // Add detailed logging for Flow API response
      console.log("Flow API response details:", {
        done: flowRes.done,
        totalSize: flowRes.totalSize,
        records: flowRes.records,
        recordsLength: flowRes.records?.length,
        firstRecord: flowRes.records?.[0]
      });

      const flowRecord = flowRes.records?.[0];
      const flowDefRecord = flowDefRes.records?.[0];

      console.log("Flow record:", flowRecord);
      console.log("FlowDefinition record:", flowDefRecord);

      // Check if Flow query returned no results
      if (!flowRes.records || flowRes.records.length === 0) {
        console.error("Flow query returned no records. This might be a permissions issue or the flow ID is incorrect.");
        console.error("Flow ID being queried:", this.flowId);
        console.error("Full Flow API response:", JSON.stringify(flowRes, null, 2));
      }

      if (!flowDefRes.records || flowDefRes.records.length === 0) {
        console.error("FlowDefinition query returned no records.");
        console.error("FlowDefinition ID being queried:", this.flowDefId);
        console.error("Full FlowDefinition API response:", JSON.stringify(flowDefRes, null, 2));
      }

      if (!flowRecord || !flowDefRecord) {
        // If Flow query failed but FlowDefinition succeeded, try alternative approach
        if (!flowRecord && flowDefRecord) {
          console.log("Flow query failed but FlowDefinition succeeded. Trying alternative approach...");

          // First, try to get flows without Metadata to find the matching one
          const flowsListRes = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query?q=SELECT+Id,FullName,Label,ProcessType+FROM+Flow+WHERE+FullName='${flowDefRecord.DeveloperName}'&cache=${cacheBuster}`);

          console.log("Flows List API response:", flowsListRes);

          if (flowsListRes.records && flowsListRes.records.length > 0) {
            console.log("Found matching flow in list:", flowsListRes.records[0]);
            const matchingFlowId = flowsListRes.records[0].Id;

            // Now get the specific flow with Metadata using the correct ID
            const specificFlowRes = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query?q=SELECT+Id,Metadata+FROM+Flow+WHERE+Id='${matchingFlowId}'&cache=${cacheBuster}`);

            console.log("Specific Flow API response:", specificFlowRes);

            if (specificFlowRes.records && specificFlowRes.records.length > 0) {
              const matchingFlow = specificFlowRes.records[0];
              console.log("Found matching flow with metadata:", matchingFlow);

              // Use the matching flow record
              const flowType = matchingFlow.Metadata?.processType || "Unknown";
              const flowStatus = matchingFlow.Metadata?.status || "Unknown";

              const result = {
                id: matchingFlow.Id,
                definitionId: this.flowDefId,
                name: flowDefRecord.DeveloperName || flowDefRecord.MasterLabel || "Unknown Flow",
                label: flowDefRecord.MasterLabel || "Unknown Label",
                apiName: flowDefRecord.DeveloperName || "Unknown API Name",
                type: flowType,
                status: flowStatus,
                xmlData: matchingFlow.Metadata
              };

              console.log("Using matching flow record:", result);
              return result;
            }
          } else {
            console.log("No matching flow found with FullName:", flowDefRecord.DeveloperName);
            console.log("FlowDefinition DeveloperName:", flowDefRecord.DeveloperName);
            console.log("FlowDefinition MasterLabel:", flowDefRecord.MasterLabel);
          }
        }

        throw new Error("Flow or FlowDefinition not found");
      }

      // Query FlowDefinitionView for richer metadata
      let flowDefView = null;
      if (flowDefRecord && flowDefRecord.DeveloperName) {
        const fdvRes = await sfConn.rest(`/services/data/v${apiVersion}/query/?q=SELECT+Label,ApiName,ProcessType,TriggerType,TriggerObjectOrEventLabel+FROM+FlowDefinitionView+WHERE+ApiName='${flowDefRecord.DeveloperName}'&cache=${cacheBuster}`);
        if (fdvRes.records && fdvRes.records.length > 0) {
          flowDefView = fdvRes.records[0];
        }
      }

      // Improved type detection: detect ScreenFlow if screens exist
      const xmlData = flowRecord?.Metadata || {};
      // Debug log: print all top-level keys and values in xmlData
      Object.entries(xmlData).forEach(([key, value]) => {
        console.log("xmlData key:", key, "value:", value);
      });
      const triggerObjectLabel = flowDefView?.TriggerObjectOrEventLabel || "—";
      const triggerType = flowDefView?.TriggerType || xmlData?.triggerType || null;
      const processType = flowDefView?.ProcessType || xmlData?.processType || null;
      const status = flowRecord?.Metadata?.status || "Unknown";
      const label = flowDefView?.Label || flowDefRecord?.MasterLabel || xmlData.label || xmlData.interviewLabel || flowDefRecord?.DeveloperName || "Unknown Label";
      const apiName = flowDefView?.ApiName || flowDefRecord?.DeveloperName || "Unknown API Name";

      // Only declare and assign type here
      let type = xmlData?.processType || flowDefView?.ProcessType || "Flow";
      if (Array.isArray(xmlData?.screens) && xmlData.screens.length > 0) {
        type = "ScreenFlow";
      }
      const showProcessType = !(type && processType && type === processType);

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

      console.log("Final flow metadata result:", result);
      console.log("Result values:", {
        id: result.id,
        definitionId: result.definitionId,
        name: result.name,
        label: result.label,
        apiName: result.apiName,
        type: result.type,
        status: result.status
      });
      console.log("FLOW NAME:", result.name);
      console.log("FLOW TYPE:", result.type);
      console.log("FLOW STATUS:", result.status);
      console.log("flowInfo.xmlData:", result.xmlData);
      return result;
    } catch (error) {
      console.error("Error getting flow metadata:", error);
      throw new Error("Failed to fetch flow metadata: " + error.message);
    }
  }

  displayFlowInfo(flowInfo) {
    console.log("Displaying detailed flow info:", flowInfo);

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
    const processTypeElement = document.getElementById("flow-process-type");

    // Set label and API name
    if (labelElement) labelElement.textContent = flowInfo.label || "Unknown Label";
    if (nameElement) nameElement.textContent = flowInfo.apiName || "Unknown API Name";
    if (typeElement) typeElement.textContent = flowInfo.type;

    // Set new detail fields
    if (triggerObjectElement) {
      let triggerDisplay = "—";
      if (flowInfo.triggerObjectLabel && flowInfo.triggerObjectLabel !== "—") {
        triggerDisplay = flowInfo.triggerObjectLabel;
      }
      triggerObjectElement.textContent = triggerDisplay;
    }
    if (triggerTypeElement) triggerTypeElement.textContent = flowInfo.triggerType || "—";
    if (processTypeElement) processTypeElement.style.display = "none";

    // Update status with badge styling
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

    if (apiVersionElement) {
      const apiVersion = flowInfo.xmlData?.apiVersion || "Unknown";
      apiVersionElement.textContent = apiVersion;
    }

    if (descriptionElement) {
      const description = flowInfo.xmlData?.description || "No description provided";
      // Replace newlines with <br> for HTML rendering
      const htmlDescription = description.replace(/\n/g, "<br>");
      descriptionElement.innerHTML = htmlDescription;
      // Remove any truncation or single-line styles
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

    if (elementsCountElement) {
      const elements = this.extractFlowElements();
      elementsCountElement.textContent = elements.length;
    }

    // Check if the DOM was actually updated
    setTimeout(() => {
      console.log("DOM after update:", {
        labelText: labelElement?.textContent,
        nameText: nameElement?.textContent,
        typeText: typeElement?.textContent,
        statusText: statusElement?.textContent,
        apiVersionText: apiVersionElement?.textContent,
        descriptionText: descriptionElement?.textContent,
        elementsCountText: elementsCountElement?.textContent
      });
    }, 100);

    console.log("Values being set:", {
      label: flowInfo.label,
      name: flowInfo.name,
      type: flowInfo.type,
      status: flowInfo.status,
      apiVersion: flowInfo.xmlData?.apiVersion,
      description: flowInfo.xmlData?.description,
      elementsCount: this.extractFlowElements().length
    });

    console.log("Detailed flow info displayed on UI:", {
      label: flowInfo.label,
      name: flowInfo.name,
      type: flowInfo.type,
      status: flowInfo.status,
      apiVersion: flowInfo.xmlData?.apiVersion,
      description: flowInfo.xmlData?.description,
      elementsCount: this.extractFlowElements().length
    });
  }

  async scanFlow() {
    console.log("scanFlow() called with currentFlow:", this.currentFlow);

    if (!this.currentFlow) {
      this.showError("No flow loaded");
      return;
    }

    this.isScanning = true;
    this.showLoading(true);
    try {
      // Force re-initialization of Flow Scanner Core
      console.log("Re-initializing Flow Scanner Core...");
      this.initFlowScannerCore();

      // Use Flow Scanner Core for detailed analysis - no fallbacks
      if (!this.flowScannerCore) {
        throw new Error("Flow Scanner Core library not available");
      }

      console.log("Flow Scanner Core is available, using it for analysis");
      console.log("Flow Scanner Core object:", this.flowScannerCore);
      console.log("Flow Scanner Core methods:", Object.getOwnPropertyNames(this.flowScannerCore));

      const results = await this.scanWithCore();

      console.log("Scan completed with results:", results);
      this.scanResults = results;
      this.displayResults(results);
      this.updateExportButton();
    } catch (error) {
      console.error("Error scanning flow:", error);
      this.showError("Failed to scan flow: " + error.message);
    } finally {
      this.isScanning = false;
      this.showLoading(false);
    }
  }

  async scanWithCore() {
    try {
      console.log("Starting scanWithCore with flow data:", this.currentFlow);
      console.log("Flow status:", this.currentFlow.status);
      console.log("Flow type:", this.currentFlow.type);

      if (!this.currentFlow || !this.currentFlow.xmlData) {
        console.error("No flow data available for scanning");
        return [{
          rule: "Scan Error",
          description: "No flow data available for scanning",
          severity: "error",
          details: "Flow data is missing or incomplete"
        }];
      }

      // Check if flow type is supported by Flow Scanner rules
      const supportedFlowTypes = [
        "AutoLaunchedFlow",
        "CustomEvent",
        "InvocableProcess",
        "Orchestrator",
        "EvaluationFlow",
        "ActionCadenceAutolaunchedFlow",
        "Flow",
        "IndividualObjectLinkingFlow",
        "LoginFlow",
        "RoutingFlow",
        "Appointments",
        "ActionCadenceStepFlow",
        "ContactRequestFlow",
        "CustomerLifecycle",
        "FieldServiceMobile",
        "FieldServiceWeb",
        "SurveyEnrich",
        "Survey"
      ];

      const currentFlowType = this.currentFlow.type;
      const isFlowTypeSupported = supportedFlowTypes.includes(currentFlowType);

      if (!isFlowTypeSupported) {
        console.warn(`Flow type "${currentFlowType}" is not supported by Flow Scanner rules`);
        return [{
          rule: "Flow Type Not Supported",
          description: `Flow Scanner rules do not currently support "${currentFlowType}" flow type`,
          severity: "warning",
          details: `This flow type (${currentFlowType}) is not included in the supported flow types for Flow Scanner rules. The scanner may not detect all potential issues. Supported types include: ${supportedFlowTypes.join(", ")}.`
        }];
      }

      // Create a Flow object from the metadata
      const flowData = {
        Flow: this.currentFlow.xmlData
      };

      // Debug: Show what flow data is being passed to the scanner core
      console.log("🔍 Flow data being passed to scanner core:", {
        flowName: this.currentFlow.name,
        flowApiVersion: this.currentFlow.xmlData?.apiVersion,
        flowType: this.currentFlow.type,
        flowStatus: this.currentFlow.status,
        xmlDataKeys: Object.keys(this.currentFlow.xmlData || {}),
        apiVersionInXmlData: this.currentFlow.xmlData?.apiVersion
      });

      // Create a Flow object using the Flow Scanner Core's Flow class
      // Use the actual flow API name instead of 'virtual-flow' for proper rule validation
      const flow = new this.flowScannerCore.Flow(this.currentFlow.apiName || this.currentFlow.name, flowData);

      // Create a ParsedFlow object
      const parsedFlow = new this.flowScannerCore.ParsedFlow(this.currentFlow.apiName || this.currentFlow.name, flow);

      // Debug: Log the flow data being passed to core
      console.log("Flow data being passed to core:", {
        flowName: flow.name,
        flowApiName: flow.apiName,
        flowLabel: flow.label,
        flowType: flow.type,
        flowStatus: flow.status
      });

      // Read rule selection from localStorage
      let storedRaw = localStorage.getItem("flowScannerRules");
      let stored;
      try {
        stored = JSON.parse(storedRaw || "[]");
        console.log("Raw localStorage flowScannerRules:", storedRaw);
        console.log("Parsed flowScannerRules:", stored);
      } catch (e) {
        console.warn("Failed to parse flowScannerRules, resetting", e);
        stored = [];
      }

      if (!Array.isArray(stored)) {
        if (stored && typeof stored === "object") {
          stored = Object.entries(stored).map(([name, checked]) => ({name, checked: !!checked}));
        } else {
          stored = [];
        }
      }

      // Only include enabled rules in the config
      const selected = stored.filter(c => c.checked).map(c => c.name);
      console.log("Selected rules from localStorage:", selected);
      console.log("Total stored rules:", stored.length);
      console.log("Checked rules count:", selected.length);

      // If no rules are selected, inform user and do not scan
      if (selected.length === 0) {
        console.log("No rules selected - all rules are disabled");
        this.showError("No Flow Scanner rules are enabled. Please go to the Options page and enable at least one rule in the Flow Scanner tab.");
        return [];
      }

      // Build ruleConfig with only enabled rules and their configurations
      let ruleConfig = {rules: {}};
      selected.forEach(name => {
        // Get the stored rule configuration
        const storedRule = stored.find(r => r.name === name);
        const ruleConfigEntry = storedRule?.config || {};
        const severity = storedRule?.severity || "error";
        const scannerSeverity = normalizeSeverity(severity, "storage");

        // Apply specific configurations based on rule type
        if (name === "FlowName") {
          const namingRegex = ruleConfigEntry.expression || "[A-Za-z0-9]+_[A-Za-z0-9]+";
          if (namingRegex) {
            ruleConfig.rules.FlowName = {expression: namingRegex, severity: scannerSeverity};
          }
        } else if (name === "APIVersion") {
          // APIVersion should be a minimum version threshold (integer)
          // Handle both old and new configuration formats
          let minVersion = 50; // default

          if (ruleConfigEntry.threshold !== undefined) {
            minVersion = parseInt(ruleConfigEntry.threshold);
          } else if (ruleConfigEntry.expression !== undefined) {
            // Handle old format where expression contained the value
            const expressionValue = ruleConfigEntry.expression;
            if (typeof expressionValue === "string" && expressionValue.includes("<")) {
              // Old format: "<50" -> extract 50
              minVersion = parseInt(expressionValue.replace(/[<>]/g, ""));
            } else {
              // New format: "65" -> use 65
              minVersion = parseInt(expressionValue);
            }
          }

          // Ensure we have a valid number
          if (isNaN(minVersion)) {
            minVersion = 50; // fallback to default
          }

          // The APIVersion rule expects an expression like ">=560" or "<560"
          // We want to trigger an error if the flow API version is less than the minimum
          ruleConfig.rules.APIVersion = {expression: `>=${minVersion}`, severity: scannerSeverity};

          // Debug: Log APIVersion configuration specifically
          console.log("APIVersion rule configuration:", {
            name: "APIVersion",
            minVersion,
            expression: `>=${minVersion}`,
            severity: scannerSeverity,
            storedConfig: ruleConfigEntry,
            finalConfig: ruleConfig.rules.APIVersion,
            configSource: ruleConfigEntry.threshold !== undefined ? "threshold"
              : ruleConfigEntry.expression !== undefined ? "expression" : "default"
          });
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
          // Otherwise, just enable the rule (empty config + severity)
          ruleConfig.rules[name] = {severity: scannerSeverity};
        }
      });
      // Debug log to verify config
      console.log("Final ruleConfig for scan:", ruleConfig);

      // Debug: Show exact APIVersion configuration being passed to core
      if (ruleConfig.rules.APIVersion) {
        // Get flow API version from the correct location
        const flowApiVersion = this.currentFlow?.apiVersion || this.currentFlow?.xmlData?.apiVersion || 64;

        console.log("🚀 APIVersion config being sent to scanner core:", {
          ruleName: "APIVersion",
          config: ruleConfig.rules.APIVersion,
          flowApiVersion,
          expectedBehavior: `Should trigger error if flow API version (${flowApiVersion}) < configured min version (${ruleConfig.rules.APIVersion.expression.replace(">=", "")})`
        });

        // Debug: Show raw localStorage data for APIVersion rule
        const storedAPIVersionRule = stored.find(r => r.name === "APIVersion");
        if (storedAPIVersionRule) {
          console.log("📦 Raw localStorage APIVersion rule data:", {
            name: storedAPIVersionRule.name,
            configType: storedAPIVersionRule.configType,
            config: storedAPIVersionRule.config,
            severity: storedAPIVersionRule.severity
          });
        }
      }

      // Test APIVersion configuration specifically
      if (ruleConfig.rules.APIVersion) {
        console.log("✅ APIVersion configuration verification:", {
          expression: ruleConfig.rules.APIVersion.expression,
          severity: ruleConfig.rules.APIVersion.severity,
          isConfigured: !!ruleConfig.rules.APIVersion.expression,
          expectedValue: ">=560",
          actualValue: ruleConfig.rules.APIVersion.expression,
          isCorrect: ruleConfig.rules.APIVersion.expression === ">=560",
          configSource: ruleConfig.rules.APIVersion.configSource || "unknown"
        });
      }

      // Debug: Show exact configuration being passed to core
      console.log("DEBUG: Rule configuration details:", {
        enabledRules: Object.keys(ruleConfig.rules),
        flowNameRuleConfig: ruleConfig.rules.FlowName,
        totalRulesInConfig: Object.keys(ruleConfig.rules).length
      });

      // Custom APIVersion rule handler to avoid CSP issues
      let customAPIVersionResult = null;
      if (ruleConfig.rules.APIVersion && this.currentFlow) {
        const flowApiVersion = this.currentFlow.apiVersion || this.currentFlow.xmlData?.apiVersion;
        const minVersion = parseInt(ruleConfig.rules.APIVersion.expression.replace(/[>=<]/g, ""));
        const operator = ruleConfig.rules.APIVersion.expression.replace(/[0-9]/g, "");
        
        console.log("🔍 Custom APIVersion evaluation:", {
          flowApiVersion,
          minVersion,
          operator,
          expression: ruleConfig.rules.APIVersion.expression,
          severity: ruleConfig.rules.APIVersion.severity
        });

        let isViolation = false;
        switch (operator) {
          case ">=":
            isViolation = flowApiVersion < minVersion;
            break;
          case "<=":
            isViolation = flowApiVersion > minVersion;
            break;
          case ">":
            isViolation = flowApiVersion <= minVersion;
            break;
          case "<":
            isViolation = flowApiVersion >= minVersion;
            break;
          case "==":
          case "=":
            isViolation = flowApiVersion !== minVersion;
            break;
          default:
            isViolation = flowApiVersion < minVersion; // Default to >= behavior
        }

        if (isViolation) {
          customAPIVersionResult = {
            rule: "Outdated API Version",
            description: "Introducing newer API components may lead to unexpected issues with older versions of Flows, as they might not align with the underlying mechanics. Starting from API version 50.0, the 'Api Version' attribute has been readily available on the Flow Object. To ensure smooth operation and reduce discrepancies between API versions, it is strongly advised to regularly update and maintain them.",
            severity: this.mapSeverity(ruleConfig.rules.APIVersion.severity),
            details: `Flow API Version: ${flowApiVersion} | Required: ${ruleConfig.rules.APIVersion.expression} | Current version is below the minimum required version.`,
            affectedElements: [{
              elementName: "Flow API Version",
              elementType: "apiVersion",
              metaType: "attribute",
              dataType: "number",
              locationX: "",
              locationY: "",
              connectsTo: "",
              expression: `Current: ${flowApiVersion}, Required: ${ruleConfig.rules.APIVersion.expression}`
            }],
            ruleDescription: "Introducing newer API components may lead to unexpected issues with older versions of Flows, as they might not align with the underlying mechanics. Starting from API version 50.0, the 'Api Version' attribute has been readily available on the Flow Object. To ensure smooth operation and reduce discrepancies between API versions, it is strongly advised to regularly update and maintain them.",
            ruleLabel: "Outdated API Version",
            flowName: this.currentFlow.name,
            name: "Flow API Version",
            type: "apiVersion",
            metaType: "attribute",
            dataType: "number",
            locationX: "",
            locationY: "",
            connectsTo: "",
            expression: `Current: ${flowApiVersion}, Required: ${ruleConfig.rules.APIVersion.expression}`
          };
          console.log("🚨 Custom APIVersion violation detected:", customAPIVersionResult);
        } else {
          console.log("✅ Custom APIVersion check passed - no violation");
        }

        // Remove APIVersion from core config to avoid CSP error
        delete ruleConfig.rules.APIVersion;
      }

      // Pass only enabled rules to the core scan function
      const scanResults = this.flowScannerCore.scan([parsedFlow], ruleConfig);
      console.log("[DEBUG] Scan completed. Results:", JSON.stringify(scanResults, null, 2));

      const results = [];

      // Process each flow result
      for (const flowResult of scanResults) {
        console.log("Processing flow result:", flowResult);
        console.log("Flow result structure:", JSON.stringify(flowResult, null, 2));

        if (flowResult.errorMessage) {
          console.error("Flow scan error:", flowResult.errorMessage);
          results.push({
            rule: "Scan Error",
            description: "Failed to scan flow: " + flowResult.errorMessage,
            severity: "error",
            details: "Flow: " + this.currentFlow.name
          });
          continue;
        }

        // Check different possible result structures
        const ruleResults = flowResult.ruleResults || flowResult.results || flowResult.issues || [];
        console.log("Rule results found:", ruleResults);
        console.log("Rule results length:", ruleResults.length);

        // Process each rule result
        for (const ruleResult of ruleResults) {
          console.log("Processing rule result:", ruleResult);
          console.log("Rule result structure:", JSON.stringify(ruleResult, null, 2));

          // Skip rules that don't have any violations (occurs: false)
          if (!ruleResult.occurs) {
            console.log("Skipping rule with no violations:", ruleResult.ruleName);
            continue;
          }

          // Handle CSP-related errors for APIVersion rule
          if (ruleResult.ruleName === "APIVersion" && ruleResult.errorMessage && ruleResult.errorMessage.includes("unsafe-eval")) {
            console.warn("APIVersion rule failed due to CSP restrictions, but configuration was applied correctly");
            // Continue processing other rules
            continue;
          }

          // Get rule description from rule definition
          const ruleDescription = ruleResult.ruleDefinition?.description || "No description available";
          const ruleLabel = ruleResult.ruleDefinition?.label || ruleResult.ruleName;

          // Process each violation detail
          if (ruleResult.details && ruleResult.details.length > 0) {
            for (const detail of ruleResult.details) {
              console.log("Processing violation detail:", detail);

              // Extract element information from the violation
              const elementName = detail.name || detail.violation?.name || "Unknown";
              const elementType = detail.type || detail.violation?.subtype || "Unknown";
              const metaType = detail.metaType || detail.violation?.metaType || "";
              const dataType = detail.dataType || "";
              const locationX = detail.details?.locationX || detail.violation?.locationX || "";
              const locationY = detail.details?.locationY || detail.violation?.locationY || "";
              const connectsTo = detail.details?.connectsTo || "";
              const expression = detail.details?.expression || detail.violation?.expression || "";

              // Convert rule result to our format
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
                // Add affectedElements array for the UI
                affectedElements: [{
                  elementName,
                  elementType,
                  metaType,
                  dataType,
                  locationX,
                  locationY,
                  connectsTo,
                  expression
                }],
                // Add additional fields for export
                ruleDescription,
                ruleLabel,
                flowName: this.currentFlow.name,
                name: elementName,
                type: elementType,
                metaType,
                dataType,
                locationX,
                locationY,
                connectsTo,
                expression
              };

              console.log("Converted result:", result);
              results.push(result);
            }
          } else {
            // Handle rules with no specific details but still have violations
            const result = {
              rule: ruleLabel,
              description: ruleDescription,
              severity: this.mapSeverity(ruleResult.severity),
              details: "Rule violation detected",
              // Add affectedElements array for the UI
              affectedElements: [],
              // Add additional fields for export
              ruleDescription,
              ruleLabel,
              flowName: this.currentFlow.name
            };
            console.log("Converted result:", result);
            results.push(result);
          }
        }
      }

      // Add custom APIVersion result if it exists
      if (customAPIVersionResult) {
        console.log("➕ Adding custom APIVersion result to results:", customAPIVersionResult);
        results.push(customAPIVersionResult);
      }

      return results;
    } catch (error) {
      console.error("Error in scanWithCore:", error);
      this.showError("Failed to scan flow: " + error.message);
      return [{
        rule: "Scan Error",
        description: "Failed to scan flow: " + error.message,
        severity: "error",
        details: "Flow: " + (this.currentFlow ? this.currentFlow.name : "Unknown")
      }];
    }
  }

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

  extractFlowElements() {
    if (!this.currentFlow || !this.currentFlow.xmlData) {
      console.log("No flow data available for element extraction");
      return [];
    }

    const elements = [];
    const xmlData = this.currentFlow.xmlData;

    // Extract all possible flow elements from the metadata
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
          // Handle single elements that are objects
          const element = xmlData[elementType];
          elements.push({
            name: element.name || element.label || element.apiName || elementType,
            type: elementType,
            element
          });
        }
      }
    });

    // Also check for individual elements that might not be in arrays
    if (xmlData.start && typeof xmlData.start === "object") {
      elements.push({
        name: xmlData.start.name || "Start",
        type: "start",
        element: xmlData.start
      });
    }

    console.log(`Extracted ${elements.length} flow elements:`, elements.map(e => `${e.type}: ${e.name}`));
    return elements;
  }

  displayResults(results) {
    this.scanResults = results;
    this.updateExportButton();

    const resultsSection = document.getElementById("results-section");
    const resultsContainer = document.getElementById("results-container");

    if (!resultsSection || !resultsContainer) {
      console.error("Results section or container not found");
      return;
    }

    // Show results section
    resultsSection.style.display = "block";

    if (results.length === 0) {
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

    // Group results by severity, then by rule name
    const severityOrder = ["error", "warning", "info"];
    const severityLabels = {error: "Errors", warning: "Warnings", info: "Info"};
    const severityIcons = {
      error: "<span class='sev-ico error' aria-label='Error'>❗</span>",
      warning: "<span class='sev-ico warning' aria-label='Warning'>⚠️</span>",
      info: "<span class='sev-ico info' aria-label='Info'>ℹ️</span>"
    };
    const severityGroups = {error: [], warning: [], info: []};
    results.forEach(r => {
      if (severityGroups[r.severity]) severityGroups[r.severity].push(r);
    });

    // Calculate summary statistics
    const totalIssues = results.length;
    const errorCount = severityGroups.error.length;
    const warningCount = severityGroups.warning.length;
    const infoCount = severityGroups.info.length;
    this.updateSummaryStats(totalIssues, errorCount, warningCount, infoCount);

    // Update the summary section to include action buttons
    const resultsSummary = document.getElementById("results-summary");
    if (resultsSummary) {
      resultsSummary.innerHTML = `
        <div class="summary-stats" role="group" aria-label="Scan results summary">
          <div class="summary-title">
            <span class="results-icon">📊</span>
            <span>Scan Results</span>
          </div>
          <div class="stat-item total" role="group" aria-label="Total issues">
            <span class="stat-number" id="total-issues" aria-label="Total issues count">${totalIssues}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-item error" role="group" aria-label="Error issues">
            <span class="stat-number" id="error-count" aria-label="Error count">${errorCount}</span>
            <span class="stat-label">Errors</span>
          </div>
          <div class="stat-item warning" role="group" aria-label="Warning issues">
            <span class="stat-number" id="warning-count" aria-label="Warning count">${warningCount}</span>
            <span class="stat-label">Warnings</span>
          </div>
          <div class="stat-item info" role="group" aria-label="Information issues">
            <span class="stat-number" id="info-count" aria-label="Info count">${infoCount}</span>
            <span class="stat-label">Info</span>
          </div>
          <div class="summary-actions">
            <button id="export-button" class="summary-action-btn" title="Export Results">
              <span class="export-icon" aria-hidden="true">📁</span> Export
            </button>
            <button id="expand-all-btn" class="summary-action-btn">Expand All</button>
            <button id="collapse-all-btn" class="summary-action-btn">Collapse All</button>
          </div>
        </div>
      `;
    }

    // Build results HTML
    let resultsHTML = "";
    severityOrder.forEach(sev => {
      const group = severityGroups[sev];
      if (!group.length) return;
      resultsHTML += `
        <div class="severity-block ${sev} sev-spacing">
          <div class="severity-header">
            ${severityIcons[sev] || ""}
            <span class="severity-label">${severityLabels[sev]}</span>
            <span class="severity-count">${group.length}</span>
          </div>
        `;
      // Group by rule name within this severity
      const rules = {};
      group.forEach(result => {
        const ruleType = result.rule || result.ruleLabel || "Unknown Rule";
        if (!rules[ruleType]) rules[ruleType] = [];
        rules[ruleType].push(result);
      });
      Object.entries(rules).forEach(([ruleType, ruleResults], ruleIdx) => {
        // Pick the right icon for this rule group
        const ruleIcon = severityIcons[sev] || "";
        const ruleId = `rule-${sev}-${ruleIdx}`;
        resultsHTML += `
          <div class="rule-section compact expanded card-bg" data-rule-type="${ruleType}">
            <div class="rule-header ${sev}" data-accordion-toggle="true" tabindex="0" role="button" aria-expanded="true" aria-controls="${ruleId}">
              <div class="rule-title-section">
                ${ruleIcon}
                <span class="rule-name-compact">${ruleType}</span>
                <span class="badge-total circle-badge">${ruleResults.length}</span>
              </div>
              <div class="rule-desc-compact">${ruleResults[0].description || "Rule violation detected"}</div>
              <svg class="accordion-chevron" width="20" height="20" aria-hidden="true">
                <use xlink:href="symbols.svg#accordion-chevron"></use>
              </svg>
            </div>
            <div class="rule-content" id="${ruleId}">
        `;
        ruleResults.forEach((result, idx) => {
          resultsHTML += this.createIssueCompactHTML(result, idx !== ruleResults.length - 1);
        });
        resultsHTML += `
            </div>
          </div>
        `;
      });
      resultsHTML += "</div>";
    });

    resultsContainer.innerHTML = resultsHTML;
    this.bindAccordionEvents();
    this.bindExpandCollapseAll();
    this.bindExportButton();
    this.announceResults(totalIssues, errorCount, warningCount, infoCount);
  }

  bindAccordionEvents() {
    const accordionToggles = document.querySelectorAll('.rule-header[data-accordion-toggle="true"]');
    accordionToggles.forEach(toggle => {
      toggle.addEventListener("click", () => {
        const section = toggle.closest(".rule-section");
        if (section) {
          this.toggleAccordion(section);
        }
      });
      toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const section = toggle.closest(".rule-section");
          if (section) {
            this.toggleAccordion(section);
          }
        }
      });
    });
  }

  toggleAccordion(section) {
    const expanded = section.classList.contains("expanded");
    const header = section.querySelector(".rule-header");
    const chevron = header && header.querySelector(".accordion-chevron");

    if (expanded) {
      section.classList.remove("expanded");
      section.classList.add("collapsed");
      if (header) header.setAttribute("aria-expanded", "false");
      if (chevron) chevron.classList.add("collapsed");
    } else {
      section.classList.remove("collapsed");
      section.classList.add("expanded");
      if (header) header.setAttribute("aria-expanded", "true");
      if (chevron) chevron.classList.remove("collapsed");
    }
  }

  bindExpandCollapseAll() {
    const expandBtn = document.getElementById("expand-all-btn");
    const collapseBtn = document.getElementById("collapse-all-btn");
    if (expandBtn) {
      expandBtn.onclick = () => {
        document.querySelectorAll(".rule-section").forEach(sec => {
          sec.classList.add("expanded");
          sec.classList.remove("collapsed");
          const header = sec.querySelector(".rule-header");
          if (header) header.setAttribute("aria-expanded", "true");
        });
      };
    }
    if (collapseBtn) {
      collapseBtn.onclick = () => {
        document.querySelectorAll(".rule-section").forEach(sec => {
          sec.classList.remove("expanded");
          sec.classList.add("collapsed");
          const header = sec.querySelector(".rule-header");
          if (header) header.setAttribute("aria-expanded", "false");
        });
      };
    }
  }

  createIssueCompactHTML(result, showDivider) {
    // Only show unique details, no duplicate rule description
    const affected = (result.affectedElements && result.affectedElements.length > 0) ? result.affectedElements[0] : null;
    let affectedInfo = "";
    if (affected) {
      let parts = [];
      if (affected.elementName) parts.push(`<span class='mono'><strong>${affected.elementName}</strong></span>`);
      if (affected.elementType) parts.push(`<span class='mono'>(${affected.elementType})</span>`);
      if (affected.metaType) parts.push(`<span class='mono'>${affected.metaType}</span>`);
      if (affected.expression) parts.push(`Expression: <span class='mono'>${affected.expression}</span>`);
      if (affected.connectsTo) parts.push(`Connects to: <span class='mono'>${affected.connectsTo}</span>`);
      if (affected.locationX !== undefined && affected.locationY !== undefined && (affected.locationX !== "" || affected.locationY !== "")) {
        parts.push(`Location: <span class='mono'>(${affected.locationX}, ${affected.locationY})</span>`);
      }
      affectedInfo = parts.join(" | ");
    }
    return `
      <div class="issue-item-compact ${result.severity}">
        <span class="issue-severity-compact ${result.severity}">${result.severity.toUpperCase()}</span>
        <span class="issue-details-compact">${affectedInfo}</span>
      </div>
      ${showDivider ? '<div class="issue-divider"></div>' : ""}
    `;
  }

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

  updateExportButton() {
    const exportBtn = document.getElementById("export-button");
    if (exportBtn) {
      exportBtn.disabled = this.scanResults.length === 0;
    }
  }

  showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    overlay.style.display = show ? "flex" : "none";
  }

  showError(message) {
    const container = document.getElementById("results-container");
    const resultsSection = document.getElementById("results-section");

    // Show results section
    if (resultsSection) {
      resultsSection.style.display = "block";
    }

    if (message.includes("No Flow Scanner rules are enabled")) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚙️</div>
          <h3>No Rules Enabled</h3>
          <p>${message}</p>
          <div class="action-buttons">
            <button onclick="window.open('options.html?selectedTab=8', '_blank')" class="button button-brand">
              Open Flow Scanner Options
            </button>
          </div>
        </div>
      `;
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

  closeOverlay() {
    // Send message to parent to close the overlay
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        command: "closeFlowScannerOverlay"
      }, "*");
    }
  }

  announceResults(totalIssues, errorCount, warningCount, infoCount) {
    const srAnnouncements = document.getElementById("sr-announcements");
    if (srAnnouncements) {
      let announcement = `Scan completed. Found ${totalIssues} total issues`;

      if (errorCount > 0) {
        announcement += `, ${errorCount} critical issues`;
      }
      if (warningCount > 0) {
        announcement += `, ${warningCount} warnings`;
      }
      if (infoCount > 0) {
        announcement += `, ${infoCount} recommendations`;
      }

      if (totalIssues === 0) {
        announcement = "Scan completed. No issues found. Your flow follows best practices.";
      }

      srAnnouncements.textContent = announcement;

      // Clear the announcement after a delay
      setTimeout(() => {
        srAnnouncements.textContent = "";
      }, 3000);
    }
  }

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

  bindExportButton() {
    const exportBtn = document.getElementById("export-button");
    if (exportBtn) {
      exportBtn.onclick = () => this.handleExportClick();
    }
  }
}

async function init() {
  console.log("=== Flow Scanner Init Started ===");

  try {
    const params = new URLSearchParams(window.location.search);
    const sfHost = params.get("host");
    const flowDefId = params.get("flowDefId");
    const flowId = params.get("flowId");

    console.log("Flow Scanner init with params:", {sfHost, flowDefId, flowId});

    // Check if required parameters are present
    if (!sfHost || !flowDefId || !flowId) {
      throw new Error(`Missing required parameters: host=${sfHost}, flowDefId=${flowDefId}, flowId=${flowId}`);
    }

    // Check if initButton is available
    if (typeof initButton === "undefined") {
      throw new Error("initButton function not found. Make sure button.js is loaded.");
    }

    // Initialize the button (for consistent UI)
    console.log("Calling initButton...");
    initButton(sfHost, true);
    console.log("initButton completed successfully");

    // Check if sfConn is available
    if (typeof sfConn === "undefined") {
      throw new Error("sfConn not found. Make sure inspector.js is loaded.");
    }

    // Get session and initialize flow scanner
    console.log("Getting session for:", sfHost);
    await sfConn.getSession(sfHost);
    console.log("Session established successfully");

    console.log("Creating FlowScanner instance");
    window.flowScanner = new FlowScanner(sfHost, flowDefId, flowId);
    console.log("FlowScanner instance created:", window.flowScanner);

    console.log("=== Flow Scanner Init Completed Successfully ===");
  } catch (error) {
    console.error("=== Flow Scanner Init Failed ===", error);

    // Show detailed error message
    const resultsContainer = document.getElementById("results-container");
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="empty-state" style="color: #c62828;">
          <div class="empty-icon">❌</div>
          <h3>Initialization Error</h3>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Stack:</strong> ${error.stack}</p>
          <p>Please check the browser console for more details.</p>
        </div>
      `;
    }

    // Also show error in the flow info sections
    const flowName = document.getElementById("flow-name");
    const flowType = document.getElementById("flow-type");
    const flowElementsCount = document.getElementById("flow-elements-count");
    const flowDescription = document.getElementById("flow-description");

    if (flowName) flowName.textContent = "Error: " + error.message;
    if (flowType) flowType.textContent = "Error";
    if (flowElementsCount) flowElementsCount.textContent = "Error";
    if (flowDescription) flowDescription.textContent = "Failed to load flow information. Check console for details.";
  }
}

document.addEventListener("DOMContentLoaded", init);
