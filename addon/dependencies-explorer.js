/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
import {UserInfoModel, createSpinForMethod, isRecordId, generatePackageXml} from "./utils.js";
import {PageHeader} from "./components/PageHeader.js";
/* global initButton */

// Configuration constants
/**
 * Application configuration and constants
 * @type {Object}
 */
const CONFIG = {
  /** @type {Array<{value: string, label: string}>} Available metadata types */
  METADATA_TYPES: [
    // Code
    {value: "ApexClass", label: "Apex Classes"},
    {value: "ApexTrigger", label: "Apex Triggers"},
    // UI Components (Classic)
    {value: "ApexPage", label: "Visualforce Pages"},
    {value: "ApexComponent", label: "Visualforce Components"},
    // UI Components (Lightning)
    {value: "LightningComponent", label: "Lightning Components"},
    {value: "LightningWebComponent", label: "Lightning Web Components"},
    // Pages & Layouts
    {value: "Layout", label: "Page Layouts"},
    {value: "FlexiPage", label: "Lightning Pages"},
    // Data Model
    {value: "CustomObject", label: "Custom Objects, Settings and Metadata Types"},
    {value: "CustomField", label: "Custom Fields"},
    {value: "GlobalPicklist", label: "Global Picklists"},
    {value: "ValidationRule", label: "Validation Rules"},
    // Automation
    {value: "Flow", label: "Flows / Process Builders / Workflows"},
    {value: "WorkflowAlert", label: "Email Alerts"},
    // Resources & Templates
    {value: "StaticResource", label: "Static Resources"},
    {value: "EmailTemplate", label: "Email Templates"},
    {value: "CustomLabel", label: "Custom Labels"},
    {value: "WebLink", label: "Custom Buttons (WebLink)"}
  ],

  /** @type {Object.<string, string>} Type colors mapping */
  TYPE_COLORS: {
    // Code-related types - Blue tones
    "ApexClass": "#2563eb",
    "ApexTrigger": "#2563eb",
    "ApexPage": "#2563eb",
    "ApexComponent": "#2563eb",

    // Data/Object types - Green tones
    "CustomObject": "#059669",
    "CustomField": "#059669",
    "GlobalValueSet": "#059669",

    // Lightning/UI types - Purple tones
    "LightningComponent": "#7c3aed",
    "FlexiPage": "#7c3aed",

    // Resource types - Orange tones
    "StaticResource": "#ea580c",
    "Installed Package": "#ea580c",

    // Automation types - Teal tones
    "Flow": "#0d9488",
    "WorkflowRule": "#0d9488",
    "ValidationRule": "#0d9488",

    // Content types - Yellow tones
    "CustomLabel": "#ca8a04",
    "EmailTemplate": "#ca8a04",

    // Layout types - Gray tones
    "Layout": "#6b7280",
    "WebLink": "#6b7280",

    // Security types - Red tones
    "PermissionSet": "#dc2626",
    "Profile": "#dc2626",
    "User": "#dc2626",
    "Role": "#dc2626"
  },

  DEFAULT_METADATA_TYPE: "ApexClass",
  DEFAULT_FILTER: "dependedOnBy",
  DEFAULT_EXCLUDE_EXTERNAL_PACKAGES: true,
  DEFAULT_SHOW_FLAT_VIEW: true
};

let h = React.createElement;

// Helper functions
/**
 * Utility functions for common operations
 * @type {Object}
 */
const Helpers = {
  /**
   * Gets the SVG icon for a metadata type
   * @param {string} type - The metadata type
   * @returns {Object} The SVG React element
   */
  getTypeIcon(type) {
    const iconMap = {
      // Code-related icons - SLDS patterns
      "ApexClass": "insert_tag_field",
      "ApexTrigger": "target_mode",

      // Data/Object icons - SLDS patterns
      "CustomObject": "standard_objects",
      "CustomField": "text",

      // UI/Page icons - SLDS patterns
      "ApexPage": "salesforce_page",
      "FlexiPage": "edit_form",
      "ApexComponent": "component_customization",

      // Resource icons - SLDS patterns
      "StaticResource": "puzzle",

      // Lightning icons - SLDS patterns
      "LightningComponent": "connected_apps",

      // Picklist/Value icons - SLDS patterns
      "GlobalValueSet": "picklist_choice",

      // Package icons - SLDS patterns
      "Installed Package": "package_org",

      // Security & Permission icons - SLDS patterns
      "PermissionSet": "locker_service_console",
      "Profile": "profile",
      "User": "user",
      "Role": "user_role",

      // Automation icons - SLDS patterns
      "ValidationRule": "rules",
      "WorkflowRule": "setup",
      "Flow": "flow",

      // Content & Label icons - SLDS patterns
      "CustomLabel": "price_book_entries",

      // Layout & Design icons - SLDS patterns
      "Layout": "layout",

      // Link & External icons - SLDS patterns
      "WebLink": "link",

      // Additional metadata types with SLDS patterns
      "CustomTab": "tabset",
      "CustomApplication": "custom_apps",
      "CustomPermission": "key",
      "CustomSite": "builder",
      "FieldPermissions": "lock",
      "ObjectPermissions": "locked_with_additions",
      "TabDefinition": "side_list",
      "TabSet": "side_list",
      "TabSetMember": "side_list",
      "LightningPage": "lightning_extension",
      "LightningComponentBundle": "connected_apps",
      "AuraDefinitionBundle": "connected_apps",
      "ContactPointTypeConsent": "identity",
      "ContactPointType": "identity",
      "ContactPointEmail": "identity",
      "ContactPointPhone": "identity",
      "ContactPointAddress": "identity",
      "ContactPointConsent": "identity",
      "ContactPointTypeConsentHistory": "identity",
      "ContactPointTypeConsentShare": "identity",
      "ContactPointTypeConsentFeed": "identity"
    };

    // Default SLDS document icon for unknown metadata types
    const defaultIcon = "salesforce1";

    const metadataIcon = iconMap[type] || defaultIcon;

    return h("svg", {
      viewBox: "0 0 520 520",
      width: "52",
      height: "52",
      fill: "currentColor",
      className: "dep-icon-inline"
    }, h("use", {xlinkHref: `symbols.svg#${metadataIcon}`}));
  },

  /**
   * Gets the color for a metadata type
   * @param {string} type - The metadata type
   * @returns {string} The color hex code
   */
  getTypeColor(type) {
    return CONFIG.TYPE_COLORS[type] || "#666";
  },


  /**
   * Checks if a type is a custom field
   * @param {string} type - The metadata type
   * @returns {boolean} True if custom field
   */
  isCustomField(type) {
    return type && type.toUpperCase() === "CUSTOMFIELD";
  },

  /**
   * Checks if a type is a custom object
   * @param {string} type - The metadata type
   * @returns {boolean} True if custom object
   */
  isCustomObject(type) {
    return type && type.toUpperCase() === "CUSTOMOBJECT";
  },

  /**
   * Creates a standardized error object
   * @param {string} message - Error message
   * @param {Error} [originalError] - Original error if wrapping
   * @returns {Error} The created error
   */
  createError(message, originalError = null) {
    const error = new Error(message);
    if (originalError) {
      error.originalError = originalError;
      error.stack = originalError.stack;
    }
    return error;
  },

  /**
   * Handles API errors with consistent formatting
   * @param {Error} error - The original error
   * @param {string} [context] - Context for the error
   * @returns {Error} Formatted error
   */
  handleApiError(error, context = "") {
    console.error(`API Error${context ? ` in ${context}` : ""}:`, error);
    const message = error.message || "Unknown error occurred";
    return Helpers.createError(`Failed to fetch data${context ? ` for ${context}` : ""}: ${message}`, error);
  }
};



class Model {
  constructor(sfHost, args) {
    this.sfHost = sfHost;
    this.args = args || new URLSearchParams();
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.title = "Dependencies Explorer";
    this.orgName = this.sfHost.split(".")[0]?.toUpperCase() || "";
    this.dependencyTree = null; // Store the fetched dependency tree
    this.dependencyError = null;
    // Read metadata type from URL or use default
    this.selectedMetadataType = args?.get("metadataType") || CONFIG.DEFAULT_METADATA_TYPE;
    this.availableMetadataItems = []; // Available items for selected type
    this.selectedMetadataItem = null; // Selected item
    this.isLoadingMetadataItems = false; // Loading state for metadata items
    this.showJsonDebug = false; // Toggle for JSON debug view
    this.dependencyResults = {dependsOn: [], dependedOnBy: []}; // Store both directions
    this.currentFilter = CONFIG.DEFAULT_FILTER; // 'dependsOn', 'dependedOnBy'
    this.expandedGroups = new Set(); // Track which groups are expanded
    this.lastAnalyzedItem = null;
    this._excludeExternalPackages = CONFIG.DEFAULT_EXCLUDE_EXTERNAL_PACKAGES; // Track whether to exclude external package items
    this._showFlatView = CONFIG.DEFAULT_SHOW_FLAT_VIEW; // Track whether to show flat or nested view
    this.includeManagedInPackageXml = false; // Track whether to include managed package items in package.xml

    // Initialize spinFor method
    this.spinFor = createSpinForMethod(this);

    // Initialize user info model - handles all user-related properties
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    // Load initial metadata items
    this._loadAvailableMetadataItems();
  }

  /**
   * Notify React that we changed something, so it will rerender the view.
   * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
   * All event listeners (functions starting with "on") should call this function if they update the model.
   * Asynchronous operations should use the spinFor function, which will call this function after the asynchronous operation completes.
   * Other functions should not call this function, since they are called by a function that does.
   * @param cb A function to be called once React has processed the update.
   */
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }

  persistParamInUrl(name, value) {
    const urlParams = new URLSearchParams(window.location.search);
    if (value) {
      urlParams.set(name, value);
    } else {
      urlParams.delete(name);
    }
    window.history.replaceState(null, "", "?" + urlParams.toString());
  }

  setMetadataType(type) {
    this.selectedMetadataType = type;
    this.selectedMetadataItem = null;
    this.availableMetadataItems = [];
    this.persistParamInUrl("metadataType", type);
    this.persistParamInUrl("metadataItemId", null); // Clear item when type changes
    this._loadAvailableMetadataItems();
  }

  setMetadataItem(item) {
    this.selectedMetadataItem = item;
    if (item && item.id) {
      this.persistParamInUrl("metadataItemId", item.id);
    } else {
      this.persistParamInUrl("metadataItemId", null);
    }
    this.didUpdate();
  }

  toggleJsonDebug() {
    this.showJsonDebug = !this.showJsonDebug;
    this.didUpdate();
  }

  setFilter(filter) {
    this.currentFilter = filter;
    // Auto-switch to flat view when "Referenced By" is selected
    if (filter === "dependedOnBy" && !this._showFlatView) {
      this._showFlatView = true;
    }
    this.didUpdate();
  }

  getFilteredDependencies() {
    switch (this.currentFilter) {
      case "dependsOn":
        return this.dependencyResults.dependsOn || [];
      case "dependedOnBy":
        return this.dependencyResults.dependedOnBy || [];
      default:
        return this.dependencyTree || [];
    }
  }

  async _loadAvailableMetadataItems() {
    this.isLoadingMetadataItems = true;
    this.selectedMetadataItem = null; // Reset selection when loading
    this.didUpdate();

    try {
      let items = await this._fetchMetadataItems(this.selectedMetadataType);
      this.availableMetadataItems = items;

      // Restore selected item from URL parameter if present
      const metadataItemId = this.args?.get("metadataItemId");
      if (metadataItemId && items.length > 0) {
        const item = items.find(i => i.id === metadataItemId);
        if (item) {
          this.selectedMetadataItem = item;
        }
      }
    } catch (error) {
      const handledError = Helpers.handleApiError(error, this.selectedMetadataType);
      this.dependencyError = handledError.message;
      this.availableMetadataItems = [];
    } finally {
      this.isLoadingMetadataItems = false;
      this.didUpdate();
    }
  }

  _buildMetadataQuery(metadataType) {
    const queries = {
      "ApexClass": "SELECT Id, Name, NamespacePrefix FROM ApexClass ORDER BY Name",
      "ApexTrigger": "SELECT Id, Name, NamespacePrefix FROM ApexTrigger ORDER BY Name",
      "CustomObject": "SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject ORDER BY DeveloperName",
      "CustomField": "SELECT Id, DeveloperName, TableEnumOrId, NamespacePrefix FROM CustomField ORDER BY DeveloperName",
      "ApexPage": "SELECT Id, Name, NamespacePrefix FROM ApexPage ORDER BY Name",
      "ApexComponent": "SELECT Id, Name, NamespacePrefix FROM ApexComponent ORDER BY Name",
      "StaticResource": "SELECT Id, Name, NamespacePrefix FROM StaticResource ORDER BY Name",
      "LightningComponent": "SELECT Id, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle ORDER BY DeveloperName",
      "ValidationRule": "SELECT Id, ValidationName, NamespacePrefix FROM ValidationRule ORDER BY ValidationName",
      "CustomLabel": "SELECT Id, Name, NamespacePrefix FROM externalString ORDER BY Name",
      "Flow": "SELECT Id, Definition.DeveloperName, VersionNumber, Status, ProcessType FROM Flow ORDER BY Definition.DeveloperName",
      "LightningWebComponent": "SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName",
      "EmailTemplate": "SELECT Id, Name, NamespacePrefix FROM EmailTemplate ORDER BY Name",
      "WorkflowAlert": "SELECT Id, DeveloperName, EntityDefinition.DeveloperName, NamespacePrefix FROM WorkflowAlert ORDER BY DeveloperName",
      "WebLink": "SELECT Id, Name, EntityDefinition.DeveloperName, NamespacePrefix FROM WebLink ORDER BY Name",
      "Layout": "SELECT Id, Name, EntityDefinition.DeveloperName, NamespacePrefix FROM Layout ORDER BY Name",
      "FlexiPage": "SELECT Id, DeveloperName, NamespacePrefix FROM FlexiPage ORDER BY DeveloperName",
      "GlobalPicklist": "SELECT Id, DeveloperName, NamespacePrefix FROM GlobalValueSet ORDER BY DeveloperName"
    };

    return queries[metadataType] || "";
  }

  /** Max items per IN clause to avoid HTTP 414 URI Too Long (servers often limit ~2k–4k chars). */
  static get TOOLING_QUERY_BATCH_SIZE() {
    return 100;
  }

  /**
   * Fetches all records from a Salesforce Tooling API query, handling pagination via nextRecordsUrl.
   * @param {string} soql - The SOQL query string
   * @returns {Promise<Array>} Array of all records across all pages
   */
  async _fetchAllToolingQueryRecords(soql) {
    const allRecords = [];
    let queryUrl = `/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql);

    while (queryUrl) {
      const res = await sfConn.rest(queryUrl);
      if (res.records) {
        allRecords.push(...res.records);
      }
      // Check if there are more records to fetch
      queryUrl = res.nextRecordsUrl || null;
    }

    return allRecords;
  }

  /**
   * Runs a Tooling API query in batches when the IN (...) list would be too long (avoids HTTP 414).
   * @param {Array<string>} values - Values for the IN clause (e.g. IDs or names)
   * @param {function(Array<string>): string} buildSoql - Given a chunk of values, returns the full SOQL
   * @returns {Promise<Array>} Combined records from all batches
   */
  async _fetchToolingQueryBatched(values, buildSoql) {
    if (!values.length) return [];
    const batchSize = this.constructor.TOOLING_QUERY_BATCH_SIZE;
    const allRecords = [];
    for (let i = 0; i < values.length; i += batchSize) {
      const chunk = values.slice(i, i + batchSize);
      const soql = buildSoql(chunk);
      const records = await this._fetchAllToolingQueryRecords(soql);
      allRecords.push(...records);
    }
    return allRecords;
  }

  async _fetchMetadataItems(metadataType) {
    try {
      const soql = this._buildMetadataQuery(metadataType);
      if (!soql) return [];

      let records = await this._fetchAllToolingQueryRecords(soql);

      // Apply special handling based on metadata type
      switch (metadataType) {
        case "CustomField":
          return this._processCustomFieldRecords(records);
        case "ValidationRule":
          return this._processValidationRuleRecords(records);
        case "CustomLabel":
          return this._processCustomLabelRecords(records);
        case "Flow":
          return this._processFlowRecords(records);
        case "WorkflowAlert":
          return this._processWorkflowAlertRecords(records);
        case "WebLink":
          return this._processWebLinkRecords(records);
        case "Layout":
          return this._processLayoutRecords(records);
        default:
          return this._processStandardRecords(records, metadataType);
      }
    } catch (error) {
      throw Helpers.handleApiError(error, `metadata items for ${metadataType}`);
    }
  }

  _processStandardRecords(records, metadataType) {
    return records.map(rec => ({
      id: rec.Id,
      name: rec.Name || rec.DeveloperName || rec.FullName,
      namespace: rec.NamespacePrefix,
      fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.Name || rec.DeveloperName || rec.FullName}` : (rec.Name || rec.DeveloperName || rec.FullName),
      type: metadataType
    }));
  }

  async _processCustomFieldRecords(records) {
    // Only include values that are valid Salesforce IDs (15 or 18 chars, alphanumeric, not all letters)
    const idRegex = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;
    const objectIds = Array.from(new Set(records.map(r => r.TableEnumOrId)
      .filter(id => id && idRegex.test(id) && /[0-9]/.test(id))));

    let objectNamesById = {};
    if (objectIds.length) {
      // Fetch object names in batches to avoid HTTP 414 URI Too Long
      const objRecords = await this._fetchToolingQueryBatched(objectIds, chunk =>
        `SELECT Id, DeveloperName FROM CustomObject WHERE Id IN ('${chunk.join("','")}')`
      );
      objRecords.forEach(obj => {
        objectNamesById[obj.Id] = obj.DeveloperName;
      });
    }

    return records.map(rec => {
      let objectName = rec.TableEnumOrId;
      // If TableEnumOrId is a valid ID and we have a name, use it
      if (objectName && idRegex.test(objectName) && /[0-9]/.test(objectName) && objectNamesById[objectName]) {
        objectName = objectNamesById[objectName];
      }
      return {
        id: rec.Id,
        name: rec.DeveloperName,
        namespace: rec.NamespacePrefix,
        fullName: objectName ? `${objectName}.${rec.DeveloperName}` : rec.DeveloperName,
        type: "CustomField"
      };
    });
  }

  _processValidationRuleRecords(records) {
    return records.map(rec => ({
      id: rec.Id,
      name: rec.ValidationName,
      namespace: rec.NamespacePrefix,
      fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.ValidationName}` : rec.ValidationName,
      type: "ValidationRule"
    }));
  }

  _processCustomLabelRecords(records) {
    return records.map(rec => ({
      id: rec.Id,
      name: rec.Name,
      namespace: rec.NamespacePrefix,
      fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.Name}` : rec.Name,
      type: "CustomLabel"
    }));
  }

  _processFlowRecords(records) {
    return records.map(rec => {
      const flowName = rec.Definition?.DeveloperName || rec.Id;
      const flowType = rec.ProcessType === "Workflow" ? "Process Builder" : rec.ProcessType || "Flow";
      const status = rec.Status || "Unknown";
      const version = rec.VersionNumber || "";

      // Create display name with version, status, and type
      const displayName = `${flowName} (${flowType}, v${version}, ${status})`;

      return {
        id: rec.Id,
        name: displayName,
        namespace: null,
        fullName: displayName,
        type: "Flow"
      };
    });
  }

  _processWorkflowAlertRecords(records) {
    return records.map(rec => {
      const objectName = rec.EntityDefinition?.DeveloperName || "Unknown";
      const alertName = rec.DeveloperName || rec.Id; // Use DeveloperName if available, otherwise ID

      return {
        id: rec.Id,
        name: `${objectName}.${alertName}`,
        namespace: rec.NamespacePrefix,
        fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${objectName}.${alertName}` : `${objectName}.${alertName}`,
        type: "WorkflowAlert"
      };
    });
  }

  _processWebLinkRecords(records) {
    return records.map(rec => {
      const objectName = rec.EntityDefinition?.DeveloperName || "Unknown";
      const buttonName = rec.Name || rec.DeveloperName || rec.Id;

      return {
        id: rec.Id,
        name: `${objectName}.${buttonName}`,
        namespace: rec.NamespacePrefix,
        fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${objectName}.${buttonName}` : `${objectName}.${buttonName}`,
        type: "WebLink"
      };
    });
  }

  _processLayoutRecords(records) {
    return records.map(rec => {
      const objectName = rec.EntityDefinition?.DeveloperName || "Unknown";
      const layoutName = rec.Name || rec.DeveloperName || rec.Id;

      return {
        id: rec.Id,
        name: `${objectName}.${layoutName}`,
        namespace: rec.NamespacePrefix,
        fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${objectName}.${layoutName}` : `${objectName}.${layoutName}`,
        type: "Layout"
      };
    });
  }

  /**
   * Fetch dependencies for a given metadata component (entryPoint).
   */
  fetchDependencies() {
    if (!this.selectedMetadataItem) {
      this.dependencyError = "Please select a metadata item first";
      this.didUpdate();
      return;
    }

    this.spinnerCount++;
    this.didUpdate();
    this.dependencyError = null;
    this.dependencyResults = {dependsOn: [], dependedOnBy: []};
    this.currentFilter = "dependedOnBy";
    this._showFlatView = CONFIG.DEFAULT_SHOW_FLAT_VIEW; // Reset view state
    this.expandedGroups.clear(); // Reset expanded groups
    this._dropdownOpen = false; // Reset dropdown state
    this._dropdownSearch = ""; // Reset dropdown search
    this.lastAnalyzedItem = this.selectedMetadataItem;

    const entryPoint = {
      id: this.selectedMetadataItem.id,
      name: this.selectedMetadataItem.fullName,
      type: this.selectedMetadataItem.type
    };

    // Fetch both directions in parallel
    Promise.all([
      this._getDependencies(entryPoint, "dependsOn").then(async deps => {
        let enhanced = await this._enhanceCustomFieldData(deps);
        let unsupported = await this._createUnsupportedDependencies(enhanced);
        return [...enhanced, ...unsupported];
      }).catch(err => {
        console.warn('Error fetching "depends on" dependencies:', err);
        return [];
      }),
      this._getDependencies(entryPoint, "dependedOnBy").then(async deps => {
        let enhanced = await this._enhanceCustomFieldData(deps);
        let unsupported = await this._createUnsupportedDependencies(enhanced);
        return [...enhanced, ...unsupported];
      }).catch(err => {
        console.warn('Error fetching "depended on by" dependencies:', err);
        return [];
      })
    ]).then(([dependsOn, dependedOnBy]) => {
      this.dependencyResults = {dependsOn, dependedOnBy};
      // Combine all results for display
      this.dependencyTree = [...dependsOn, ...dependedOnBy];
      // Auto-switch filter if Referenced By is empty and Depends On has results
      if (dependedOnBy.length === 0 && dependsOn.length > 0) {
        this.currentFilter = "dependsOn";
      }
    }).catch(err => {
      this.dependencyError = err && err.message ? err.message : String(err);
    }).finally(() => {
      this.spinnerCount--;
      this.didUpdate();
    });
  }

  /**
   * Core logic: recursively fetch dependencies and build a tree.
   * Inspired by sfdc-soup-master project (https://github.com/pgonzaleznetwork/sfdc-soup),
   * using sfConn.rest for SOQL queries.
   */
  async _getDependencies(entryPoint, direction) {
    const result = [];
    const idsAlreadyQueried = new Set();
    const idField = direction === "dependsOn" ? "MetadataComponentId" : "RefMetadataComponentId";
    const self = this;

    async function exec(ids) {
      const idsArr = Array.isArray(ids) ? ids : [ids];
      idsArr.forEach(id => idsAlreadyQueried.add(id));
      // Batch queries to avoid HTTP 414 URI Too Long when many IDs
      const allRecords = await self._fetchToolingQueryBatched(idsArr, chunk =>
        `SELECT MetadataComponentId, MetadataComponentName, MetadataComponentType, RefMetadataComponentName, RefMetadataComponentType, RefMetadataComponentId, RefMetadataComponentNamespace FROM MetadataComponentDependency WHERE ${idField} IN ('${chunk.join("','")}') AND MetadataComponentType != 'FlexiPage' ORDER BY MetadataComponentName, RefMetadataComponentType`
      );
      const dependencies = allRecords.map(dep => {
        const dependency = {
          name: dep.RefMetadataComponentName,
          type: dep.RefMetadataComponentType,
          id: dep.RefMetadataComponentId,
          repeated: false,
          notes: null,
          namespace: dep.RefMetadataComponentNamespace,
          referencedBy: {
            name: dep.MetadataComponentName,
            id: dep.MetadataComponentId,
            type: dep.MetadataComponentType
          }
        };

        return dependency;
      });
      let nextLevelIds = [];
      dependencies.forEach(dep => {
        const alreadyQueried = idsAlreadyQueried.has(dep.id);
        result.push(dep);
        if (alreadyQueried) {
          dep.repeated = true;
        } else {
          nextLevelIds.push(dep.id);
        }
      });
      if (nextLevelIds.length) {
        await exec(nextLevelIds);
      }
    }
    await exec([entryPoint.id]);
    // Build a simple tree (for now, just return the flat list)
    return result;
  }

  /**
   * Enhance custom field data with object names and field names.
   * Inspired by sfdc-soup-master project (https://github.com/pgonzaleznetwork/sfdc-soup)
   */

  async _enhanceCustomFieldData(dependencies) {
    // 1. Collect all CustomField IDs
    let customFieldIds = [];
    dependencies.forEach(dep => {
      if (this._isCustomField(dep.type)) customFieldIds.push(dep.id);
      if (this._isCustomField(dep.referencedBy.type)) customFieldIds.push(dep.referencedBy.id);
    });

    if (!customFieldIds.length) return dependencies;

    // 2. Get objectId for each fieldId
    let objectIdsByCustomFieldId = await this._getFieldToEntityMap(customFieldIds);

    // 3. Get objectName for each objectId
    let objectNamesById = await this._getObjectNamesById(Object.values(objectIdsByCustomFieldId));

    // 4. Update dependency names
    dependencies.forEach(dep => {
      if (this._isCustomField(dep.type)) {
        dep.name = this._getCorrectFieldName(dep.name, dep.id, objectIdsByCustomFieldId, objectNamesById);
      }
      if (this._isCustomObject(dep.type)) {
        let objectName = objectNamesById[dep.id];
        if (objectName) {
          dep.name = objectName;
        }
      }
      if (this._isCustomField(dep.referencedBy.type)) {
        dep.referencedBy.name = this._getCorrectFieldName(dep.referencedBy.name, dep.referencedBy.id, objectIdsByCustomFieldId, objectNamesById);
      }
      if (this._isCustomObject(dep.referencedBy.type)) {
        let objectName = objectNamesById[dep.referencedBy.id];
        if (objectName) {
          dep.referencedBy.name = objectName;
        }
      }
    });

    return dependencies;
  }

  async _createUnsupportedDependencies(dependencies) {
    // 1. Collect all custom field names and ids
    let customFieldsByName = {};
    dependencies.forEach(dep => {
      if (this._isCustomField(dep.type)) customFieldsByName[dep.name] = dep;
    });
    let customFieldNames = Object.keys(customFieldsByName);
    if (!customFieldNames.length) return [];
    // 2. Fetch field metadata for all custom fields
    let fieldRecords = await this._fetchCustomFieldMetadata(customFieldNames);
    // 3. Identify lookups, value sets, dependent picklists
    let lookupFields = fieldRecords.filter(rec => rec.referenceTo);
    let picklistsWithValueSet = fieldRecords.filter(rec => rec.valueSet && rec.valueSet.valueSetName);
    let dependentPicklists = fieldRecords.filter(rec => rec.valueSet && rec.valueSet.controllingField);
    let newDependencies = [];
    // 4. Add lookup field dependencies
    if (lookupFields.length) {
      let objectIdsByName = await this._getObjectIdsByName(lookupFields.map(lf => lf.referenceTo).filter(Boolean));
      for (let lf of lookupFields) {
        let fieldDep = customFieldsByName[lf.fullName];
        let relatedObjectName = lf.referenceTo;
        let relatedObjectId = objectIdsByName[relatedObjectName];
        if (relatedObjectName && relatedObjectId) {
          newDependencies.push({
            name: relatedObjectName,
            type: "CustomObject",
            id: relatedObjectId,
            repeated: false,
            notes: null,
            namespace: null,
            referencedBy: {
              name: lf.fullName,
              type: "CustomField",
              id: fieldDep ? fieldDep.id : null
            },
            pills: [{label: "Object in Lookup Field", type: "standard", description: "Dependency Type"}]
          });
        }
      }
    }
    // 5. Add value set dependencies
    for (let vs of picklistsWithValueSet) {
      let fieldDep = customFieldsByName[vs.fullName];
      newDependencies.push({
        name: vs.valueSet.valueSetName,
        type: "GlobalValueSet",
        id: null,
        repeated: false,
        notes: null,
        namespace: null,
        referencedBy: {
          name: vs.fullName,
          type: "CustomField",
          id: fieldDep ? fieldDep.id : null
        },
        pills: [{label: "Controlling Global Value Set", type: "standard", description: "Dependency Type"}]
      });
    }
    // 6. Add controlling picklist dependencies
    for (let dp of dependentPicklists) {
      let fieldDep = customFieldsByName[dp.fullName];
      let objectName = dp.fullName.split(".")[0];
      let controllingFieldName = `${objectName}.${dp.valueSet.controllingField}`;
      newDependencies.push({
        name: controllingFieldName,
        type: "CustomField",
        id: null,
        repeated: false,
        notes: null,
        namespace: null,
        referencedBy: {
          name: dp.fullName,
          type: "CustomField",
          id: fieldDep ? fieldDep.id : null
        },
        pills: [{label: "Controlling picklist", type: "standard", description: "Dependency Type"}]
      });
    }
    return newDependencies;
  }

  // --- Helper functions for metadata lookups ---

  _isCustomField(type) {
    return Helpers.isCustomField(type);
  }
  _isCustomObject(type) {
    return Helpers.isCustomObject(type);
  }
  async _getFieldToEntityMap(customFieldIds) {
    if (!customFieldIds.length) return {};
    const records = await this._fetchToolingQueryBatched(customFieldIds, chunk =>
      `SELECT Id, TableEnumOrId FROM CustomField WHERE Id IN ('${chunk.join("','")}')`
    );
    const map = {};
    for (const rec of records) map[rec.Id] = rec.TableEnumOrId;
    return map;
  }
  async _getObjectNamesById(objectIds) {
    if (!objectIds.length) return {};

    // Filter out invalid IDs and get unique ones
    let validObjectIds = [...new Set(objectIds.filter(id =>
      id
      && id.length >= 15
      && isRecordId(id)
    ))];

    if (!validObjectIds.length) return {};

    try {
      const records = await this._fetchToolingQueryBatched(validObjectIds, chunk =>
        `SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject WHERE Id IN ('${chunk.join("','")}')`
      );
      const map = {};
      for (const rec of records) {
        const name = rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.DeveloperName}` : rec.DeveloperName;
        map[rec.Id] = name;
      }
      return map;
    } catch (error) {
      console.warn("Error querying CustomObject metadata:", error);
      return {};
    }
  }
  async _getObjectIdsByName(objectNames) {
    if (!objectNames.length) return {};
    const namesWithNs = objectNames.filter(n => n.includes("__"));
    const namesNoNs = objectNames.filter(n => !n.includes("__"));
    const map = {};
    // Batch namespace-less names to avoid URI length limit
    if (namesNoNs.length) {
      const records = await this._fetchToolingQueryBatched(namesNoNs, chunk =>
        `SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject WHERE NamespacePrefix = null AND DeveloperName IN ('${chunk.join("','")}')`
      );
      for (const rec of records) {
        const name = rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.DeveloperName}` : rec.DeveloperName;
        map[name] = rec.Id;
      }
    }
    // Batch namespace names (each clause is longer; use smaller effective batch via chunked OR clauses)
    if (namesWithNs.length) {
      const batchSize = this.constructor.TOOLING_QUERY_BATCH_SIZE;
      for (let i = 0; i < namesWithNs.length; i += batchSize) {
        const chunk = namesWithNs.slice(i, i + batchSize);
        const nsClauses = chunk.map(n => {
          const [ns, dev] = n.split("__");
          return `(NamespacePrefix = '${ns}' AND DeveloperName = '${dev}')`;
        });
        const soql = `SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject WHERE ${nsClauses.join(" OR ")}`;
        const records = await this._fetchAllToolingQueryRecords(soql);
        for (const rec of records) {
          const name = rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.DeveloperName}` : rec.DeveloperName;
          map[name] = rec.Id;
        }
      }
    }
    return map;
  }
  async _fetchCustomFieldMetadata(fieldNames) {
    if (!fieldNames.length) return [];
    // Filter to only include custom fields (those with __c suffix)
    let customFieldNames = fieldNames.filter(name => {
      let fieldName = name.includes(".") ? name.split(".")[1] : name;
      return fieldName.endsWith("__c");
    });
    if (!customFieldNames.length) return [];
    // SOQL: SELECT DeveloperName, ReferenceTo, ValueSet, TableEnumOrId FROM CustomField WHERE DeveloperName IN (...)
    // Note: We need to handle field names that might include the object prefix
    let fieldNamesOnly = customFieldNames.map(name =>
      // If name is "Object.Field", extract just the field part
      name.includes(".") ? name.split(".")[1] : name
    );
    try {
      const records = await this._fetchToolingQueryBatched(fieldNamesOnly, chunk =>
        `SELECT DeveloperName, ReferenceTo, ValueSet, TableEnumOrId FROM CustomField WHERE DeveloperName IN ('${chunk.join("','")}')`
      );
      // Map back to include full name for processing
      records.forEach(rec => {
        rec.fullName = rec.DeveloperName; // For compatibility with existing logic
      });
      return records;
    } catch (error) {
      console.warn("Error fetching CustomField metadata:", error);
      return [];
    }
  }
  _getCorrectFieldName(name, id, objectIdsByCustomFieldId, objectNamesById) {
    let entityId = objectIdsByCustomFieldId[id];
    let objectName = objectNamesById[entityId];

    // If we have a proper object name, use it
    if (objectName) {
      return `${objectName}.${name}`;
    }

    // If entityId exists but no object name, it might be a standard object
    // Standard objects have entityId as the actual object name (e.g., "Account")
    if (entityId && !objectName) {
      // Check if this looks like a standard object name
      if (entityId.length < 15 && !entityId.includes("__")) {
        return `${entityId}.${name}`;
      }
    }

    // Fallback to original name
    return name;
  }

  toggleGroup(groupKey) {
    if (this.expandedGroups.has(groupKey)) {
      this.expandedGroups.delete(groupKey);
    } else {
      this.expandedGroups.add(groupKey);
    }
    this.didUpdate();
  }

  toggleNested(key) {
    if (!this.expandedGroups) this.expandedGroups = new Set();
    if (this.expandedGroups.has(key)) {
      this.expandedGroups.delete(key);
    } else {
      this.expandedGroups.add(key);
    }
    this.didUpdate();
  }

  /**
   * Gets dependencies grouped for Dependency Tree view
   * Shows complete dependency tree with parent-child relationships
   * @returns {Array} Array of grouped dependencies with full relationship tree
   */
  getGroupedDependencies() {
    const dependencies = this.getFilteredDependencies();
    const groups = {};

    if (this.currentFilter === "dependsOn") {
      // Build a map of dependencies by unique key (type+name)
      const depMap = new Map();
      dependencies.forEach(dep => {
        const key = `${dep.type}::${dep.name}`;
        dep.children = [];
        depMap.set(key, dep);
      });

      // Assign children to their parent if parent is in the result set
      dependencies.forEach(dep => {
        if (dep.referencedBy) {
          const parentKey = `${dep.referencedBy.type}::${dep.referencedBy.name}`;
          if (depMap.has(parentKey)) {
            depMap.get(parentKey).children.push(dep);
            dep._isNested = true;
          }
        }
      });

      // Note: We keep the simple parent-child relationships as they are
      // The UI handles deeper nesting through rendering logic, not data structure

      // Show dependencies tree, but mark nested ones for proper display
      dependencies.forEach(dep => {
        let groupKey = dep.type;
        let groupName = dep.type;
        // Special grouping for CustomField by object
        if (dep.type === "CustomField" && dep.name.includes(".")) {
          const [objectName, fieldName] = dep.name.split(".");
          groupKey = `CustomField_${objectName}`;
          groupName = `Custom Fields on ${objectName}`;
        }
        // Special grouping for ApexClass by namespace
        if (dep.type === "ApexClass" && dep.namespace) {
          groupKey = `ApexClass_${dep.namespace}`;
          groupName = `Apex Classes (${dep.namespace})`;
        }
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: dep.type,
            dependencies: [],
            count: 0,
            groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });
    } else {
      dependencies.forEach(dep => {
        let groupKey, groupName, groupType;
        groupType = dep.referencedBy.type;
        groupKey = `referencedBy_${groupType}`;
        groupName = `${groupType}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: groupType,
            dependencies: [],
            count: 0,
            groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });
    }

    return Object.values(groups).sort((a, b) => {
      // Sort by count (descending), then by name
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  getTreeGroupedDependencies() {
    const dependencies = this.getFilteredDependencies();

    if (this.currentFilter === "dependsOn") {
      // Build a map of dependencies by unique key (type+name)
      const depMap = new Map();
      dependencies.forEach(dep => {
        const key = `${dep.type}::${dep.name}`;
        dep.children = [];
        depMap.set(key, dep);
      });

      // Assign children to their parent if parent is in the result set
      dependencies.forEach(dep => {
        if (dep.referencedBy) {
          const parentKey = `${dep.referencedBy.type}::${dep.referencedBy.name}`;
          if (depMap.has(parentKey)) {
            depMap.get(parentKey).children.push(dep);
            dep._isNested = true;
          }
        }
      });

      // Group dependencies by type, but maintain parent-child relationships
      const groups = {};
      dependencies.forEach(dep => {
        let groupKey = dep.type;
        let groupName = dep.type;
        // Special grouping for CustomField by object
        if (dep.type === "CustomField" && dep.name.includes(".")) {
          const [objectName, fieldName] = dep.name.split(".");
          groupKey = `CustomField_${objectName}`;
          groupName = `Custom Fields on ${objectName}`;
        }
        // Special grouping for ApexClass by namespace
        if (dep.type === "ApexClass" && dep.namespace) {
          groupKey = `ApexClass_${dep.namespace}`;
          groupName = `Apex Classes (${dep.namespace})`;
        }
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: dep.type,
            dependencies: [],
            count: 0,
            groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });

      return Object.values(groups).sort((a, b) => {
        // Sort by count (descending), then by name
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    } else {
      // For "Referenced By" view, group by type
      const groups = {};
      dependencies.forEach(dep => {
        let groupKey, groupName, groupType;
        groupType = dep.referencedBy.type;
        groupKey = `referencedBy_${groupType}`;
        groupName = `${groupType}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: groupType,
            dependencies: [],
            count: 0,
            groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });

      return Object.values(groups).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    }
  }

  getGroupedChildren(deps, parentKeyPrefix = "") {
    const groups = {};
    deps.forEach(dep => {
      let groupKey = dep.type;
      let groupName = dep.type;
      if (dep.type === "CustomField" && dep.name.includes(".")) {
        const [objectName] = dep.name.split(".");
        groupKey = `CustomField_${objectName}`;
        groupName = `Custom Fields on ${objectName}`;
      }
      if (dep.type === "ApexClass" && dep.namespace) {
        groupKey = `ApexClass_${dep.namespace}`;
        groupName = `Apex Classes (${dep.namespace})`;
      }
      const fullKey = parentKeyPrefix + groupKey;
      if (!groups[fullKey]) {
        groups[fullKey] = {
          name: groupName,
          type: dep.type,
          dependencies: [],
          count: 0,
          groupKey: fullKey
        };
      }
      groups[fullKey].dependencies.push(dep);
      groups[fullKey].count++;
    });
    return Object.values(groups).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  filterDropdownItems(searchTerm) {
    return PerformanceUtils.memoize("filterDropdownItems", () => {
      let items = this.availableMetadataItems;

      // Filter out external package items if the option is enabled
      if (this._excludeExternalPackages) {
        items = items.filter(item => {
          const fullName = item.fullName || item.name || "";
          return !fullName.includes("__");
        });
      }

      if (!searchTerm) return items;

      const lower = searchTerm.toLowerCase();
      return items.filter(item =>
        (item.fullName || item.name).toLowerCase().includes(lower)
      );
    }, [searchTerm, this._excludeExternalPackages, this.selectedMetadataType, this.availableMetadataItems.length]);
  }

  // For custom dropdown state
  _dropdownOpen = false;
  _dropdownSearch = "";
  _dropdownAnchor = null;
  _excludeExternalPackages = CONFIG.DEFAULT_EXCLUDE_EXTERNAL_PACKAGES; // Track whether to exclude external package items
  _showFlatView = CONFIG.DEFAULT_SHOW_FLAT_VIEW; // Track whether to show flat or nested view
  openDropdown() {
    this._dropdownOpen = true;
    this._dropdownSearch = "";
    this.didUpdate();
  }
  closeDropdown() {
    this._dropdownOpen = false;
    this.didUpdate();
  }
  toggleDropdown() {
    if (this._dropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }
  setDropdownSearch(val) {
    this._dropdownSearch = val;
    this.didUpdate();
  }
  setDropdownAnchor(ref) {
    this._dropdownAnchor = ref;
  }

  toggleExcludeExternalPackages() {
    this._excludeExternalPackages = !this._excludeExternalPackages;
    this.didUpdate();
  }

  /**
    * Switches between Quick Summary view and Dependency Tree view
    * - Quick Summary: Shows deduplicated list of distinct metadata items
    * - Dependency Tree: Shows complete dependency tree with parent-child relationships
   */
  toggleFlatView() {
    this._showFlatView = !this._showFlatView;
    this.didUpdate();
  }

  exportDependencies() {
    // Check if we're currently loading
    if (this.spinnerCount > 0) {
      alert("Please wait for the dependency analysis to complete before exporting.");
      return;
    }

    // Check if we have any dependencies to export
    if (!this.dependencyResults || (!this.dependencyResults.dependsOn.length && !this.dependencyResults.dependedOnBy.length)) {
      alert("No dependencies to export. Please analyze dependencies first.");
      return;
    }

    // Check if we have a selected item
    if (!this.selectedMetadataItem) {
      alert("Please select a metadata item to analyze before exporting dependencies.");
      return;
    }

    // Get the dependencies that are actually displayed in the UI
    let exportDependencies = [];
    const directionLabel = this.currentFilter === "dependsOn" ? "Depends On" : "Referenced By";
    const viewMode = "Quick Summary"; // Always export Quick Summary format

    // Always export Quick Summary (flat view) regardless of current view mode
    if (this.currentFilter === "dependsOn") {
      // For Depends On, use flat view logic - unique dependencies only
      const flatGroups = this.getFlatGroupedDependencies();
      flatGroups.forEach(group => {
        group.dependencies.forEach(dep => {
          exportDependencies.push({
            name: dep.name,
            type: dep.type,
            id: dep.id,
            repeated: dep.repeated,
            notes: dep.notes,
            namespace: dep.namespace,
            pills: dep.pills,
            referencedBy: dep.referencedBy,
            level: 0,
            parent: null,
            isUnique: true
          });
        });
      });
    } else {
      // For Referenced By, use the filtered dependencies directly
      const filteredDeps = this.getFilteredDependencies();
      exportDependencies = filteredDeps.map(dep => ({
        name: dep.name,
        type: dep.type,
        id: dep.id,
        repeated: dep.repeated,
        notes: dep.notes,
        namespace: dep.namespace,
        pills: dep.pills,
        referencedBy: dep.referencedBy,
        level: 0,
        parent: null,
        isUnique: !dep.repeated
      }));
    }

    // Sort by type, then by name
    exportDependencies.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });

    // Calculate summary statistics
    const totalItems = exportDependencies.length;
    const uniqueItems = exportDependencies.filter(dep => dep.isUnique).length;
    const repeatedItems = totalItems - uniqueItems;
    const typeBreakdown = {};
    exportDependencies.forEach(dep => {
      typeBreakdown[dep.type] = (typeBreakdown[dep.type] || 0) + 1;
    });

    // Generate the export text with improved formatting
    const exportText = `Salesforce Dependencies Export
================================================================================
Generated: ${new Date().toISOString()}
Salesforce Instance: ${this.sfHost}
Root Item: ${this.selectedMetadataItem.fullName}
Root Item Type: ${this.selectedMetadataType}
Analysis Direction: ${directionLabel}
View Mode: ${viewMode}

EXECUTIVE SUMMARY:
================================================================================
- Total Dependencies Found: ${totalItems}
- Unique Dependencies: ${uniqueItems}
- Repeated Dependencies: ${repeatedItems}
- Dependency Types: ${Object.keys(typeBreakdown).length}

Type Breakdown:
${Object.entries(typeBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `  • ${type}: ${count} items`)
    .join("\n")}

DETAILED DEPENDENCIES:
================================================================================
${(() => {
  // Group dependencies by type first, then by unique items
    const groupedByType = {};

    exportDependencies.forEach(dep => {
      const type = dep.type || "Unknown";
      const key = `${dep.type}::${dep.name}`;

      if (!groupedByType[type]) {
        groupedByType[type] = {};
      }

      if (!groupedByType[type][key]) {
        groupedByType[type][key] = {
          item: dep,
          references: [],
          instances: []
        };
      }

      // Add this instance
      groupedByType[type][key].instances.push(dep);

      // Add referenced by information if it exists
      if (dep.referencedBy) {
        const refKey = `${dep.referencedBy.type}::${dep.referencedBy.name}`;
        const existingRef = groupedByType[type][key].references.find(r =>
          `${r.type}::${r.name}` === refKey
        );
        if (!existingRef) {
          groupedByType[type][key].references.push(dep.referencedBy);
        }
      }
    });

    // Convert to array and sort by type, then by name
    const typeEntries = Object.entries(groupedByType).sort(([typeA], [typeB]) => typeA.localeCompare(typeB));

    return typeEntries.map(([type, items]) => {
    // Get type icon - using enhanced mapping based on helper function
      const getTypeIcon = (type) => {
        const icons = {
        // Code-related icons
          "ApexClass": "⚡",
          "ApexTrigger": "🔔",
          "ApexPage": "📄",
          "ApexComponent": "🧩",
          "LightningComponent": "⚡",
          "LightningWebComponent": "⚡",
          "AuraDefinitionBundle": "⚡",
          "LightningComponentBundle": "⚡",

          // Data/Object icons
          "CustomObject": "📋",
          "CustomField": "📝",

          // UI/Page icons
          "FlexiPage": "📱",
          "Layout": "📐",

          // Resource icons
          "StaticResource": "📦",
          "Installed Package": "📦",

          // Picklist/Value icons
          "GlobalValueSet": "🎯",
          "GlobalPicklist": "🎯",

          // Security & Permission icons
          "PermissionSet": "🔒",
          "Profile": "👤",
          "User": "👤",
          "Role": "👥",

          // Automation icons
          "ValidationRule": "✅",
          "WorkflowRule": "⚙️",
          "WorkflowAlert": "📢",
          "Flow": "🔄",

          // Content & Label icons
          "CustomLabel": "🏷️",

          // Link & External icons
          "WebLink": "🔗",

          // Additional metadata types
          "CustomTab": "📑",
          "CustomApplication": "📱",
          "CustomPermission": "🔐",
          "CustomSite": "🌐",
          "FieldPermissions": "🔒",
          "ObjectPermissions": "🔒",
          "TabDefinition": "📑",
          "TabSet": "📑",
          "TabSetMember": "📑",
          "LightningPage": "📄",
          "ContactPointTypeConsent": "📞",
          "ContactPointType": "📞",
          "ContactPointEmail": "📧",
          "ContactPointPhone": "📞",
          "ContactPointAddress": "📍",
          "ContactPointConsent": "📞",
          "ContactPointTypeConsentHistory": "📞",
          "ContactPointTypeConsentShare": "📞",
          "ContactPointTypeConsentFeed": "📞"
        };
        return icons[type] || "📄";
      };

      const icon = getTypeIcon(type);
      const itemCount = Object.keys(items).length;
      let result = `${icon} ${type} (${itemCount} unique items):`;

      // Sort items within this type by name
      const sortedItems = Object.values(items).sort((a, b) => a.item.name.localeCompare(b.item.name));

      // Add each item under this type
      sortedItems.forEach((group, index) => {
        const dep = group.item;
        const name = (dep.name || "").trim();
        const id = dep.id ? ` (ID: ${dep.id})` : " (No ID)";
        const namespace = dep.namespace ? ` (Namespace: ${dep.namespace})` : "";
        const notes = dep.notes ? ` (Notes: ${dep.notes})` : "";
        const pills = dep.pills && dep.pills.length > 0 ? ` (${dep.pills.map(p => p.label || p.text).join(", ")})` : "";

        const isLast = index === sortedItems.length - 1;
        const level = dep.level || 0;

        // Simple list structure for Quick Summary export
        const treePrefix = isLast ? "└─ " : "├─ ";

        // Add instance count if there are multiple instances
        const instanceCount = group.instances.length > 1 ? ` [${group.instances.length} instances]` : "";

        result += `\n${treePrefix}${name}${id}${namespace}${notes}${pills}${instanceCount}`;

        // Add referenced by information (simplified for Quick Summary)
        if (this.currentFilter === "dependedOnBy") {
          if (group.references.length > 0) {
            if (group.references.length === 1) {
              const ref = group.references[0];
              const refIcon = getTypeIcon(ref.type);
              const refId = ref.id ? ` (ID: ${ref.id})` : " (No ID)";
              result += `\n   └─ 🔗 Referenced by: ${refIcon} ${ref.type} "${ref.name}"${refId}`;
            } else {
              result += "\n   └─ 🔗 Referenced by:";
              group.references.forEach((ref, refIndex) => {
                const isRefLast = refIndex === group.references.length - 1;
                const refPrefix = isRefLast ? "      └─ " : "      ├─ ";
                const refIcon = getTypeIcon(ref.type);
                const refId = ref.id ? ` (ID: ${ref.id})` : " (No ID)";
                result += `\n   ${refPrefix}${refIcon} ${ref.type} "${ref.name}"${refId}`;
              });
            }
          } else {
            result += "\n   └─ 📋 No references";
          }
        }
      });

      return result;
    }).join("\n\n");
  })()}

`;

    // Create and download the file
    const blob = new Blob([exportText], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dependencies_${this.selectedMetadataItem.fullName.replace(/[^a-zA-Z0-9]/g, "_")}_${directionLabel.replace(/\s+/g, "_")}_${viewMode.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getDependsOnCount() {
    if (!this.dependencyResults || !this.dependencyResults.dependsOn) {
      return 0;
    }

    if (this._showFlatView) {
      // For flat view, count unique dependencies
      const dependencies = this.dependencyResults.dependsOn || [];
      const uniqueDeps = new Set();
      dependencies.forEach(dep => {
        const depKey = `${dep.type}::${dep.name}`;
        uniqueDeps.add(depKey);
      });
      return uniqueDeps.size;
    } else {
      // For nested view, count all dependencies including repeated ones
      return this.dependencyResults.dependsOn.length;
    }
  }

  getReferencedByCount() {
    if (!this.dependencyResults || !this.dependencyResults.dependedOnBy) {
      return 0;
    }
    // Referenced By always shows tree count since it doesn't have flat view
    return this.dependencyResults.dependedOnBy.length;
  }

  /**
   * Gets the total count of unique dependencies across both directions
   * @returns {number} Total unique dependencies
   */
  getTotalUniqueCount() {
    if (!this.dependencyResults) {
      return 0;
    }

    const allDeps = [...(this.dependencyResults.dependsOn || []), ...(this.dependencyResults.dependedOnBy || [])];
    const uniqueDeps = new Set();

    allDeps.forEach(dep => {
      const depKey = `${dep.type}::${dep.name}`;
      uniqueDeps.add(depKey);
    });

    return uniqueDeps.size;
  }

  /**
   * Gets the total count of all dependencies (including repeated ones)
   * @returns {number} Total dependencies including repeated
   */
  getTotalCount() {
    if (!this.dependencyResults) {
      return 0;
    }

    const dependsOnCount = this.dependencyResults.dependsOn ? this.dependencyResults.dependsOn.length : 0;
    const referencedByCount = this.dependencyResults.dependedOnBy ? this.dependencyResults.dependedOnBy.length : 0;

    return dependsOnCount + referencedByCount;
  }

  /**
   * Generates a valid package.xml file from the current dependencies
   * @returns {string} The package.xml content
   */
  generatePackageXml() {
    if (!this.dependencyResults || !this.selectedMetadataItem) {
      return "";
    }

    // Get the filtered dependencies
    const dependencies = this.getFilteredDependencies();

    // Filter out installed packages and dynamic references
    let filteredDeps = dependencies.filter(dep => {
      // Remove installed packages (cannot be retrieved via metadata API)
      if (dep.type === "Installed Package") return false;

      // For "dependsOn" filter, remove dynamic references
      if (this.currentFilter === "dependsOn" && this._isDynamicReference(dep)) return false;

      return true;
    });

    // Fix lookup filter type for metadata retrieval
    filteredDeps.forEach(dep => {
      if (dep.type.toUpperCase() === "LOOKUPFILTER") {
        dep.type = "CustomField";
      }
    });

    // Add the root item
    filteredDeps.push(this.selectedMetadataItem);

    // Filter out managed package items if not included
    if (!this.includeManagedInPackageXml) {
      filteredDeps = filteredDeps.filter(dep => !dep.namespace);
    }

    // Group by metadata type
    const metadataByType = new Map();

    filteredDeps.forEach(dep => {
      if (metadataByType.has(dep.type)) {
        metadataByType.get(dep.type).add(dep.name);
      } else {
        metadataByType.set(dep.type, new Set());
        metadataByType.get(dep.type).add(dep.name);
      }
    });

    // Generate the package.xml using shared utility
    return generatePackageXml(metadataByType, {
      includeXmlDeclaration: true,
      sortTypes: true,
      skipEmptyTypes: true
    });
  }

  /**
   * Downloads the generated package.xml file
   */
  downloadPackageXml() {
    const packageXml = this.generatePackageXml();
    if (!packageXml) {
      console.error("No package.xml content to download");
      return;
    }

    const blob = new Blob([packageXml], {type: "text/xml"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `package_${this.selectedMetadataItem.fullName.replace(/[^a-zA-Z0-9]/g, "_")}_${this.currentFilter}_${new Date().toISOString().split("T")[0]}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper method to check if a dependency is a dynamic reference
   * @param {Object} dep - The dependency object
   * @returns {boolean} True if it's a dynamic reference
   */
  _isDynamicReference(dep) {
    // Dynamic references are typically those that don't have a specific ID
    // or are references to external systems
    return !dep.id || dep.type === "ExternalReference" || dep.type === "DynamicReference";
  }

  _buildSalesforceUrl(targetType, targetId, dep) {
    const baseUrl = `https://${this.sfHost}`;

    const urlTemplates = {
      "ApexClass": `${baseUrl}/lightning/setup/ApexClasses/page?address=%2F${targetId}`,
      "ApexTrigger": `${baseUrl}/lightning/setup/ApexTriggers/page?address=%2F${targetId}`,
      "CustomObject": `${baseUrl}/lightning/setup/ObjectManager/${targetId}/Details/view`,
      "CustomField": this._buildCustomFieldUrl(baseUrl, targetId, dep),
      "ApexPage": `${baseUrl}/lightning/setup/VisualforcePages/page?address=%2F${targetId}`,
      "ApexComponent": `${baseUrl}/lightning/setup/VisualforceComponents/page?address=%2F${targetId}`,
      "StaticResource": `${baseUrl}/lightning/setup/StaticResources/page?address=%2F${targetId}`,
      "LightningComponent": `${baseUrl}/lightning/setup/LightningComponents/page?address=%2F${targetId}`,
      "ValidationRule": `${baseUrl}/lightning/setup/ObjectManager/${targetId}/ValidationRules/view`,
      "CustomLabel": `${baseUrl}/lightning/setup/CustomLabels/page?address=%2F${targetId}`,
      "Flow": `${baseUrl}/lightning/setup/Flows/page?address=%2F${targetId}`,
      "LightningWebComponent": `${baseUrl}/lightning/setup/LightningWebComponents/page?address=%2F${targetId}`,
      "EmailTemplate": `${baseUrl}/lightning/setup/EmailTemplates/page?address=%2F${targetId}`,
      "WorkflowAlert": `${baseUrl}/lightning/setup/WorkflowAlerts/page?address=%2F${targetId}`,
      "WebLink": `${baseUrl}/lightning/setup/ObjectManager/${targetId}/ButtonsLinksAndActions/view`,
      "Layout": `${baseUrl}/lightning/setup/ObjectManager/${targetId}/PageLayouts/view`,
      "FlexiPage": `${baseUrl}/lightning/setup/FlexiPages/page?address=%2F${targetId}`,
      "GlobalPicklist": `${baseUrl}/lightning/setup/GlobalPicklists/page?address=%2F${targetId}`
    };

    return urlTemplates[targetType] || null;
  }

  _buildCustomFieldUrl(baseUrl, targetId, dep) {
    // For custom fields, we need to get the object ID first
    if (dep.name && dep.name.includes(".")) {
      const [objectName, fieldName] = dep.name.split(".");
      return `${baseUrl}/lightning/setup/ObjectManager/${objectName}/FieldsAndRelationships/${targetId}/view`;
    }
    return `${baseUrl}/lightning/setup/ObjectManager/${targetId}/FieldsAndRelationships/view`;
  }

  generateSalesforceUrl(dep) {
    // For Depends On: use dep.id (the dependency item)
    // For Referenced By: use dep.referencedBy.id (the item that references this)
    let targetId, targetType;

    if (this.currentFilter === "dependedOnBy") {
      // Referenced By: link to the item that references this
      targetId = dep.referencedBy ? dep.referencedBy.id : dep.id;
      targetType = dep.referencedBy ? dep.referencedBy.type : dep.type;
    } else {
      // Depends On: link to the dependency item itself
      targetId = dep.id;
      targetType = dep.type;
    }

    return this._buildSalesforceUrl(targetType, targetId, dep);
  }

  /**
   * Gets dependencies grouped for Quick Summary view
   * Shows deduplicated list of distinct metadata items, grouped by type
   * @returns {Array} Array of grouped dependencies with unique items only
   */
  getFlatGroupedDependencies() {
    const dependencies = this.getFilteredDependencies();
    const groups = {};

    // Create a Set to track unique dependencies (type + name)
    const uniqueDeps = new Set();

    dependencies.forEach(dep => {
      const depKey = `${dep.type}::${dep.name}`;
      if (uniqueDeps.has(depKey)) return; // Skip duplicates
      uniqueDeps.add(depKey);

      let groupKey = dep.type;
      let groupName = dep.type;

      // Special grouping for CustomField by object
      if (dep.type === "CustomField" && dep.name.includes(".")) {
        const [objectName, fieldName] = dep.name.split(".");
        groupKey = `CustomField_${objectName}`;
        groupName = `Custom Fields on ${objectName}`;
      }

      // Special grouping for ApexClass by namespace
      if (dep.type === "ApexClass" && dep.namespace) {
        groupKey = `ApexClass_${dep.namespace}`;
        groupName = `Apex Classes (${dep.namespace})`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          name: groupName,
          type: dep.type,
          dependencies: [],
          count: 0,
          groupKey
        };
      }

      groups[groupKey].dependencies.push(dep);
      groups[groupKey].count++;
    });

    return Object.values(groups).sort((a, b) => {
      // Sort by count (descending), then by name
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  getJsonDebugData() {
    try {
      // Get the raw filtered dependencies
      const dependencies = this.getFilteredDependencies();

      // Create a completely safe, flat structure for JSON debug
      const safeData = {
        currentFilter: this.currentFilter,
        showFlatView: this._showFlatView,
        totalDependencies: dependencies.length,
        dependencies: dependencies.map(dep => ({
          name: dep.name,
          type: dep.type,
          id: dep.id,
          repeated: dep.repeated,
          notes: dep.notes,
          namespace: dep.namespace,
          pills: dep.pills,
          referencedBy: dep.referencedBy ? {
            name: dep.referencedBy.name,
            type: dep.referencedBy.type,
            id: dep.referencedBy.id
          } : null
        }))
      };

      return safeData;
    } catch (error) {
      // Fallback to a safe structure if there's any error
      console.warn("Error in getJsonDebugData:", error);
      return {
        error: "Failed to generate debug data",
        message: error.message,
        currentFilter: this.currentFilter,
        showFlatView: this._showFlatView
      };
    }
  }
}

class App extends React.Component {

  render() {
    let {model} = this.props;
    document.title = model.title;

    const metadataTypes = CONFIG.METADATA_TYPES;

    // Search state for dropdown
    const filteredItems = model.filterDropdownItems(model._dropdownSearch);
    const selectedItem = model.selectedMetadataItem;

    // Custom dropdown for item picker
    const dropdownRef = el => {
      if (el) model.setDropdownAnchor(el);
    };
    const handleDropdownBlur = e => {
      // Close dropdown if focus leaves the dropdown panel
      if (!e.currentTarget.contains(e.relatedTarget)) {
        model.closeDropdown();
      }
    };

    // Local function to create Salesforce link (or unclickable label when no URL)
    const createSalesforceLink = (dep, model) => {
      const url = model.generateSalesforceUrl(dep);
      const linkContent = [
        h("svg", {
          key: "link-icon",
          viewBox: "0 0 520 520",
          width: "14",
          height: "14",
          fill: "currentColor",
          className: "dep-icon-blue-margin"
        },
        h("use", {xlinkHref: "symbols.svg#link"})
        ),
        h("span", {key: "link-label"}, "Open in Salesforce")
      ];
      return h("div", {
        className: CSSUtils.classNames({
          "dep-card-link": true,
          "dep-card-link-unavailable": !url
        })
      },
      url
        ? h("a", {href: url, target: "_blank"}, linkContent)
        : h("span", {className: "dep-card-link-text", title: "Open in Salesforce is not available for this metadata type"}, linkContent)
      );
    };

    const renderDependencyItem = (dep, index) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;

      // For 'Referenced By', focus on referencing metadata
      if (model.currentFilter === "dependedOnBy") {
        return h("div", {
          key: index,
          className: "dep-card"
        },
        h("div", {
          className: "dep-card-content"
        },
        h("span", {
          className: "dep-icon"
        }, getTypeIcon(dep.referencedBy.type)),
        h("span", {
          className: "dep-card-title"
        }, dep.referencedBy.name),
        dep.namespace && h("span", {
          className: "dep-namespace-badge",
          title: `Namespace: ${dep.namespace}`
        }, dep.namespace)
        ),
        h("div", {
          className: "dep-card-details"
        },
        h("span", {className: "dep-card-referenced-label"}, "Type: "),
        h("span", {className: "dep-card-type"}, dep.referencedBy.type)
        ),
        dep.pills && dep.pills.length > 0 && h("div", {
          className: "dep-card-pills"
        },
        ...dep.pills.map((pill, pillIndex) => h("span", {
          key: pillIndex,
          className: CSSUtils.classNames({
            "dep-pill": true,
            "warning": pill.type === "warning",
            "standard": pill.type !== "warning"
          })
        }, pill.label))
        ),
        dep.notes && h("div", {
          className: "dep-card-notes"
        }, dep.notes),
        createSalesforceLink(dep, model)
        );
      }
      // Default: show dependency as before
      function renderWithChildren(dep, index, level = 0, parentKeyPrefix = "") {
        const nestedKey = `${dep.type}::${dep.name}::${level}`;
        const isExpanded = model.expandedGroups.has(nestedKey);
        const groupedChildren = dep.children && dep.children.length > 0 ? model.getGroupedChildren(dep.children, nestedKey + "::") : [];
        return h("div", {
          key: dep.type + dep.name + index,
          className: "dep-card"
        },
        h("div", {
          className: "dep-card-header"
        },
        h("div", {
          className: "dep-card-content"
        },
        h("span", {className: "dep-icon"}, getTypeIcon(dep.type)),
        h("span", {
          className: "dep-card-title"
        }, dep.name),
        dep.namespace && h("span", {
          className: "dep-namespace-badge",
          title: `Namespace: ${dep.namespace}`
        }, dep.namespace)
        ),
        groupedChildren.length > 0 && h("span", {
          onClick: (e) => { e.stopPropagation(); model.toggleNested(nestedKey); },
          className: "dep-expand-button",
          title: isExpanded ? "Collapse nested items" : "Expand nested items"
        },
        h("span", {}, isExpanded ? `Hide ${groupedChildren.length} Item${groupedChildren.length !== 1 ? "s" : ""}` : `Show ${groupedChildren.length} Item${groupedChildren.length !== 1 ? "s" : ""}`),
        h("span", {
          className: `dep-expand-arrow ${isExpanded ? "dep-dropdown-arrow-rotated" : "dep-dropdown-arrow-default"}`
        }, "▶")
        )
        ),
        h("div", {
          className: "dep-card-details"
        },
        h("span", {className: "dep-card-referenced-label"}, "Type: "),
        h("span", {className: "dep-card-type"}, dep.type)
        ),
        h("div", {
          className: "dep-card-details"
        },
        h("span", {className: "dep-card-referenced-label"}, "Referenced by: "),
        h("span", {className: "dep-card-referenced-type"}, dep.referencedBy.type),
        h("span", {className: "dep-card-referenced-name"}, `"${dep.referencedBy.name}"`)
        ),
        dep.pills && dep.pills.length > 0 && h("div", {
          className: "dep-card-pills"
        },
        ...dep.pills.map((pill, pillIndex) => h("span", {
          key: pillIndex,
          className: CSSUtils.classNames({
            "dep-pill": true,
            "warning": pill.type === "warning",
            "standard": pill.type !== "warning"
          })
        }, pill.label))
        ),
        dep.notes && h("div", {
          className: "dep-card-notes"
        }, dep.notes),
        createSalesforceLink(dep, model),
        groupedChildren.length > 0 && isExpanded && groupedChildren.map((group, groupIdx) =>
          h("div", {
            key: group.groupKey,
            className: "dep-nested-group"
          },
          h("div", {
            className: "dep-nested-group-header",
            onClick: () => model.toggleNested(group.groupKey)
          },
          h("div", {
            className: "dep-nested-group-content"
          },
          h("span", {
            className: "dep-icon-large"
          }, getTypeIcon(group.type)),
          h("span", {
            className: "dep-nested-group-title",
            style: {
              color: getTypeColor(group.type)
            }
          }, group.name),
          h("span", {
            className: "dep-nested-group-count"
          }, group.count)
          ),
          h("span", {
            className: `dep-nested-group-arrow ${model.expandedGroups.has(group.groupKey) ? "dep-dropdown-arrow-rotated" : "dep-dropdown-arrow-default"}`
          }, "▶")
          ),
          model.expandedGroups.has(group.groupKey) && h("div", {
            className: "dep-nested-group-body"
          },
          group.dependencies.map((child, childIdx) => renderWithChildren(child, childIdx, level + 2, group.groupKey + "::"))
          )
          )
        )
        );
      }
      return renderWithChildren(dep, index);
    };

    const renderTreeItem = (group, index, level = 0, visitedKeys = new Set()) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;

      // Use the groupKey from the group
      const groupKey = group.groupKey || `${group.type}_${index}`;
      const hasChildren = group.dependencies && group.dependencies.length > 0;
      const isExpanded = model.expandedGroups.has(groupKey);

      // Prevent circular references
      if (visitedKeys.has(groupKey)) {
        console.warn("Circular reference detected for:", groupKey);
        return h("div", {
          key: `circular-${groupKey}`,
          className: "dep-tree-item"
        }, "⚠️ Circular reference detected");
      }

      // Add current key to visited set
      visitedKeys.add(groupKey);

      return h("div", {
        key: `tree-item-${groupKey}-${level}-${index}`,
        className: "dep-tree-item"
      },
      h("div", {
        className: `dep-tree-content dep-tree-indent-level-${Math.min(level, 5)}`,
        onClick: hasChildren ? () => model.toggleGroup(groupKey) : null,
        title: undefined
      },
      hasChildren && h("span", {
        className: CSSUtils.classNames({
          "dep-tree-expand": true,
          "expanded": isExpanded
        })
      }, "▶"),
      h("span", {
        className: "dep-tree-count"
      }, `${group.count || 1}`),
      h("span", {
        className: "dep-tree-icon"
      }, getTypeIcon(group.type)),
      h("span", {
        className: "dep-tree-name dep-type-color",
        style: {color: getTypeColor(group.type)}
      }, group.name)
      ),
      isExpanded && hasChildren && h("div", {
        className: "dep-tree-children"
      }, group.dependencies.map((dep, depIndex) => {
        // Render individual dependencies with their nested children
        const hasNestedChildren = dep.children && dep.children.length > 0;
        const depKey = `${dep.type}::${dep.name}`;
        const isDepExpanded = model.expandedGroups.has(depKey);

        return h("div", {
          key: `dep-${depIndex}`,
          className: "dep-tree-item"
        },
        h("div", {
          className: "dep-tree-content",
          onClick: hasNestedChildren ? () => model.toggleGroup(depKey) : null,
          title: dep.referencedBy
            ? `Referenced by: ${dep.referencedBy.type} "${dep.referencedBy.name}"`
            : undefined
        },
        hasNestedChildren && h("span", {
          className: CSSUtils.classNames({
            "dep-tree-expand": true,
            "expanded": isDepExpanded
          })
        }, "▶"),
        hasNestedChildren && h("span", {
          className: "dep-tree-count"
        }, `${dep.children.length}`),
        h("span", {
          className: "dep-tree-icon"
        }, getTypeIcon(dep.type)),
        h("div", {
          className: "dep-tree-item-content"
        },
        h("div", {
          className: "dep-tree-main-line"
        },
        h("span", {
          className: "dep-tree-name dep-type-color",
          style: {color: getTypeColor(dep.type)}
        }, dep.name),
        dep.namespace && h("span", {
          className: "dep-tree-namespace",
          title: `Namespace: ${dep.namespace}`
        }, dep.namespace),
        // Add link for individual items with IDs (or unclickable icon when no URL)
        dep.id && (() => {
          const url = model.generateSalesforceUrl(dep);
          const icon = h("svg", {
            viewBox: "0 0 520 520",
            width: "14",
            height: "14",
            fill: "currentColor",
            className: "dep-icon-blue"
          },
          h("use", {xlinkHref: "symbols.svg#link"})
          );
          return url
            ? h("a", {
              href: url,
              target: "_blank",
              className: "dep-tree-link",
              title: "Open in Salesforce",
              onClick: (e) => e.stopPropagation()
            }, icon)
            : h("span", {
              className: "dep-tree-link dep-tree-link-unavailable",
              title: "Open in Salesforce is not available for this metadata type",
              onClick: (e) => e.stopPropagation()
            }, icon);
        })(),
        dep.pills && h("div", {
          className: "dep-tree-pills"
        }, dep.pills.map((pill, pillIndex) =>
          h("span", {
            key: pillIndex,
            className: CSSUtils.classNames({
              "dep-tree-pill": true,
              "standard": pill.type !== "warning",
              "warning": pill.type === "warning"
            })
          }, pill.text)
        ))
        ),
        dep.referencedBy && h("div", {
          className: "dep-tree-referenced-by"
        },
        h("span", {
          className: "dep-tree-referenced-label"
        }, "Referenced by: "),
        h("span", {
          className: "dep-tree-referenced-type"
        }, dep.referencedBy.type),
        h("span", {
          className: "dep-tree-referenced-name"
        }, `"${dep.referencedBy.name}"`)
        )
        )
        ),
        isDepExpanded && hasNestedChildren && h("div", {
          className: "dep-tree-children"
        }, (() => {
          // Group children by type to show proper topics
          const childGroups = {};
          dep.children.forEach((child, childIndex) => {
            let groupKey = child.type;
            let groupName = child.type;
            // Special grouping for CustomField by object
            if (child.type === "CustomField" && child.name.includes(".")) {
              const [objectName, fieldName] = child.name.split(".");
              groupKey = `CustomField_${objectName}`;
              groupName = `Custom Fields on ${objectName}`;
            }
            // Special grouping for ApexClass by namespace
            if (child.type === "ApexClass" && child.namespace) {
              groupKey = `ApexClass_${child.namespace}`;
              groupName = `Apex Classes (${child.namespace})`;
            }
            if (!childGroups[groupKey]) {
              childGroups[groupKey] = {
                name: groupName,
                type: child.type,
                dependencies: [],
                count: 0,
                groupKey: `${groupKey}-${depIndex}-${childIndex}`,
                referencedBy: dep.referencedBy // Pass through the referencing information
              };
            }
            childGroups[groupKey].dependencies.push(child);
            childGroups[groupKey].count++;
          });

          return Object.values(childGroups).map((childGroup, groupIndex) =>
            renderTreeItem(childGroup, groupIndex, level + 2, new Set(visitedKeys))
          );
        })())
        );
      }))
      );
    };

    const renderGroup = (group, groupIndex) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;

      const groupKey = `${group.type}_${groupIndex}`;
      const isExpanded = model.expandedGroups.has(groupKey);

      // Use retro tree styling for Dependency Tree view
      if (!model._showFlatView) {
        return renderTreeItem(group, groupIndex);
      }

      return h("div", {
        key: groupKey,
        className: "dep-flat-group"
      },
      h("div", {
        className: CSSUtils.classNames({
          "dep-flat-group-header": true,
          "collapsed": !isExpanded
        }),
        onClick: () => model.toggleGroup(groupKey)
      },
      h("div", {
        className: "dep-group-content"
      },
      h("span", {className: "dep-icon-large"}, getTypeIcon(group.type)),
      h("span", {
        className: "dep-group-title",
        style: {
          color: getTypeColor(group.type)
        }
      }, group.name),
      h("span", {
        className: "dep-group-count"
      }, group.count)
      ),
      h("span", {
        className: CSSUtils.classNames({
          "dep-group-expand": true,
          "expanded": isExpanded
        })
      }, "▶")
      ),
      isExpanded && h("div", {
        className: "dep-group-body"
      },
      group.dependencies.map((dep, index) => renderDependencyItem(dep, index))
      )
      );
    };

    const renderFlatGroup = (group, groupIndex) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;

      const groupKey = `${group.type}_${groupIndex}`;
      const isExpanded = model.expandedGroups.has(groupKey);

      return h("div", {
        key: groupKey,
        className: "dep-flat-group"
      },
      h("div", {
        className: CSSUtils.classNames({
          "dep-flat-group-header": true,
          "collapsed": !isExpanded
        }),
        onClick: () => model.toggleGroup(groupKey)
      },
      h("div", {
        className: "dep-flat-group-header-content"
      },
      h("span", {
        className: "dep-icon-large"
      }, getTypeIcon(group.type)),
      h("span", {
        className: "dep-group-title",
        style: {
          color: getTypeColor(group.type)
        }
      }, group.name),
      h("span", {
        className: "dep-group-count"
      }, group.count)
      ),
      h("span", {
        className: `dep-group-expand ${model.expandedGroups.has(groupKey) ? "dep-dropdown-arrow-rotated" : "dep-dropdown-arrow-default"}`
      }, "▶")
      ),
      model.expandedGroups.has(groupKey) && h("div", {
        className: "dep-group-body"
      },
      group.dependencies.map((dep, depIdx) => h("div", {
        key: `${dep.type}_${dep.name}_${depIdx}`,
        className: "dep-card"
      },
      h("div", {
        className: "dep-card-header"
      },
      h("div", {
        className: "dep-card-content"
      },
      h("span", {className: "dep-icon"}, getTypeIcon(dep.type)),
      h("span", {
        className: "dep-card-title"
      }, dep.name),
      dep.namespace && h("span", {
        className: "dep-namespace-badge",
        title: `Namespace: ${dep.namespace}`
      }, dep.namespace)
      )
      ),
      h("div", {
        className: "dep-card-details"
      },
      h("span", {className: "dep-card-referenced-label"}, "Type: "),
      h("span", {className: "dep-card-type"}, dep.type)
      ),
      dep.referencedBy && h("div", {
        className: "dep-card-details"
      },
      h("span", {className: "dep-card-referenced-label"}, "Referenced by: "),
      h("span", {className: "dep-card-referenced-type"}, dep.referencedBy.type),
      h("span", {className: "dep-card-referenced-name"}, `"${dep.referencedBy.name}"`)
      ),
      dep.pills && dep.pills.length > 0 && h("div", {
        className: "dep-card-pills"
      },
      ...dep.pills.map((pill, pillIndex) => h("span", {
        key: pillIndex,
        style: {
          backgroundColor: pill.type === "warning" ? "#fff3cd" : "#d1ecf1",
          color: pill.type === "warning" ? "#856404" : "#0c5460",
          padding: "1px 4px",
          borderRadius: "2px",
          fontSize: "10px",
          fontWeight: "bold"
        }
      }, pill.text))
      ),
      createSalesforceLink(dep, model)
      ))
      )
      );
    };

    return h("div", {},
      h(PageHeader, {
        pageTitle: "Dependencies Explorer",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        ...model.userInfoModel.getProps()
      }),
      h("div", {
        className: "slds-m-top_xx-large",
        style: {
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 4rem)"
        }
      },
      h("div", {className: "area", id: "dependencies-area"},
        h("div", {className: "result-bar dep-result-bar"},
          h("div", {className: "dep-controls"},
            h("select", {
              value: model.selectedMetadataType,
              onChange: e => model.setMetadataType(e.target.value),
              className: "dep-select"
            },
            ...metadataTypes.map(type => h("option", {value: type.value}, type.label))
            ),
            h("div", {
              tabIndex: 0,
              ref: dropdownRef,
              className: "dep-dropdown-container",
              onBlur: handleDropdownBlur
            },
            h("div", {
              className: `dep-dropdown-trigger ${model._dropdownOpen ? "dep-dropdown-open" : ""} ${selectedItem ? "dep-dropdown-default" : "dep-dropdown-placeholder"}`,
              onClick: () => model.toggleDropdown()
            },
            h("span", {
              className: "dep-dropdown-text",
              title: selectedItem ? selectedItem.fullName : ""
            }, selectedItem ? selectedItem.fullName : (model.isLoadingMetadataItems ? "Loading..." : "Select an item...")),
            h("span", {
              className: `dep-dropdown-arrow ${model._dropdownOpen ? "dep-dropdown-arrow-rotated" : "dep-dropdown-arrow-default"}`
            }, "▶")
            ),
            model._dropdownOpen && h("div", {
              className: "dep-dropdown-panel"
            },
            model.isLoadingMetadataItems
              ? h("div", {
                className: "dep-dropdown-loading"
              }, "Loading items...")
              : h("div", {},
                h("div", {
                  className: "dep-dropdown-search"
                },
                h("input", {
                  type: "text",
                  placeholder: "Search...",
                  value: model._dropdownSearch,
                  onChange: e => model.setDropdownSearch(e.target.value),
                  className: "dep-dropdown-search-input",
                  autoFocus: true
                }),
                h("div", {
                  className: "dep-dropdown-filter"
                },
                h("input", {
                  type: "checkbox",
                  id: "exclude-external-packages",
                  checked: model._excludeExternalPackages,
                  onChange: () => model.toggleExcludeExternalPackages(),
                  className: "dep-dropdown-checkbox"
                }),
                h("label", {
                  htmlFor: "exclude-external-packages",
                  className: "dep-dropdown-label"
                }, "Exclude external packages")
                ),
                ),
                h("div", {
                  className: "dep-dropdown-items"
                },
                filteredItems.length === 0 && h("div", {
                  className: "dep-dropdown-empty"
                }, "No items found"),
                filteredItems.map(item =>
                  h("div", {
                    key: item.id,
                    className: "dep-dropdown-item",
                    style: {
                      color: selectedItem && selectedItem.id === item.id ? "#0070d2" : "#333",
                      background: selectedItem && selectedItem.id === item.id ? "#e3f0fa" : "transparent",
                      fontWeight: selectedItem && selectedItem.id === item.id ? 600 : 400
                    },
                    title: item.fullName,
                    onClick: () => { model.setMetadataItem(item); model.closeDropdown(); }
                  }, item.fullName)
                )
                )
              )
            )
            ),
            h("button", {
              onClick: () => model.fetchDependencies(),
              disabled: model.spinnerCount > 0 || !model.selectedMetadataItem,
              className: "slds-button slds-button_brand"
            }, "Analyze Dependencies")
          ),
          h("div", {className: "dep-buttons-left"},
            h("button", {
              onClick: () => model.downloadPackageXml(),
              disabled: !model.dependencyResults || !model.dependencyResults.dependsOn.length || model.currentFilter !== "dependsOn",
              className: "slds-button slds-button_neutral",
              title: "Generate Package.xml file"
            },
            h("span", {className: ""},
              h("svg", {
                viewBox: "0 0 520 520",
                width: "18",
                height: "18",
                fill: "currentColor",
                className: "dep-icon-inline-margin"
              },
              h("use", {"xlinkHref": "symbols.svg#overflow"})
              )
            ),
            "Generate Package.xml"
            ),
            h("button", {
              onClick: () => model.exportDependencies(),
              disabled: !model.dependencyResults || (!model.dependencyResults.dependsOn.length && !model.dependencyResults.dependedOnBy.length),
              className: "slds-button slds-button_neutral",
              title: "Export summary as text file"
            },
            h("span", {className: ""},
              h("svg", {
                viewBox: "0 0 520 520",
                width: "18",
                height: "18",
                fill: "currentColor",
                className: "dep-icon-inline-margin"
              },
              h("use", {"xlinkHref": "symbols.svg#internal_share"})
              )
            ),
            "Export Summary"
            ),
            h("button", {
              onClick: () => model.toggleJsonDebug(),
              disabled:
                !model.dependencyResults
                || (!model.dependencyResults.dependsOn.length
                 && !model.dependencyResults.dependedOnBy.length),
              className: "slds-button slds-button_neutral",
              title: model.showJsonDebug
                ? "Click to Hide JSON result"
                : "Click to Show result as JSON"
            },
            h("span", {className: ""},
              h("svg", {
                viewBox: "0 0 520 520",
                width: "18",
                height: "18",
                fill: "currentColor",
                className: "dep-icon-inline-margin"
              },
              h("use", {"xlinkHref": "symbols.svg#preview"})
              )
            ),
            model.showJsonDebug ? "Hide JSON" : "Show JSON"
            )
          )
        ),
        h("div", {id: "dependencies-content", className: "dep-container"},
          model.spinnerCount > 0 && h("div", {
            className: "dep-loading"
          },
          h("div", {
            className: "dep-loading-spinner"
          },
          h("span", {className: "dep-loading-dot"}),
          h("span", {className: "dep-loading-dot"}),
          h("span", {className: "dep-loading-dot"})
          )
          ),
          model.dependencyError && h("div", {
            className: "dep-error"
          }, "❌ Error: ", model.dependencyError),

          model.dependencyTree && h("div", {},
            h("div", {
              className: "slds-card dep-header"
            },
            h("div", {},
              h("h3", {
                className: "dep-section-title"
              },
              h("span", {
                className: "dep-section-title-content"
              },
              (() => {
                const item = model.lastAnalyzedItem;
                if (!item || !item.id) {
                  return `${item ? item.fullName : ""} — ${model.selectedMetadataType} Dependencies`;
                }
                const url = model.generateSalesforceUrl({
                  id: item.id,
                  type: item.type,
                  name: item.fullName
                });
                if (url) {
                  return [
                    h("a", {
                      key: "dep-section-title-link",
                      href: url,
                      target: "_blank",
                      className: "dep-section-title-link",
                      title: "Open in Salesforce"
                    }, item.fullName),
                    h("span", {key: "dep-section-title-suffix"}, ` — ${model.selectedMetadataType} Dependencies`)
                  ];
                }
                return `${item.fullName} — ${model.selectedMetadataType} Dependencies`;
              })()
              ),
              (model.dependencyResults.dependedOnBy.length > 0 || model.dependencyResults.dependsOn.length > 0) && h("div", {
                className: "dep-filter-badges"
              },
              model.dependencyResults.dependedOnBy.length > 0 && (model.currentFilter === "dependedOnBy" ? h("div", {
                key: "dependedOnBy-wrapper",
                className: "slds-theme_info"
              },
              h("span", {
                key: "dependedOnBy",
                className: "slds-badge",
                onClick: () => model.setFilter("dependedOnBy"),
                title: "Show components that use or rely on this metadata",
                role: "button",
                tabIndex: 0,
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    model.setFilter("dependedOnBy");
                  }
                }
              }, `Referenced By (${model.getReferencedByCount()})`)
              ) : h("span", {
                key: "dependedOnBy",
                className: "slds-badge slds-badge_lightest",
                onClick: () => model.setFilter("dependedOnBy"),
                title: "Show components that use or rely on this metadata",
                role: "button",
                tabIndex: 0,
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    model.setFilter("dependedOnBy");
                  }
                }
              }, `Referenced By (${model.getReferencedByCount()})`)
              ),
              model.dependencyResults.dependsOn.length > 0 && (model.currentFilter === "dependsOn" ? h("div", {
                key: "dependsOn-wrapper",
                className: "slds-theme_info"
              },
              h("span", {
                key: "dependsOn",
                className: "slds-badge",
                onClick: () => model.setFilter("dependsOn"),
                title: "Show components this metadata requires to function",
                role: "button",
                tabIndex: 0,
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    model.setFilter("dependsOn");
                  }
                }
              }, `Depends On (${model.getDependsOnCount()})`)
              ) : h("span", {
                key: "dependsOn",
                className: "slds-badge slds-badge_lightest",
                onClick: () => model.setFilter("dependsOn"),
                title: "Show components this metadata requires to function",
                role: "button",
                tabIndex: 0,
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    model.setFilter("dependsOn");
                  }
                }
              }, `Depends On (${model.getDependsOnCount()})`)
              )
              ),
              model.dependencyTree.length === 0 && model.spinnerCount === 0 && h("span", {
                className: "dep-section-subtitle"
              }, "No dependencies found")
              )
            )
            ),

            // View buttons - separate buttons for Quick Summary and Dependency Tree views
            // Quick Summary: Shows deduplicated list of distinct metadata items
            // Dependency Tree: Shows complete dependency tree with parent-child relationships
            model.currentFilter === "dependsOn" && !model.showJsonDebug && h("div", {
              className: "dep-view-toggle-container"
            },
            h("button", {
              className: CSSUtils.classNames({
                "dep-view-toggle": true,
                "active": model._showFlatView,
                "inactive": !model._showFlatView
              }),
              onClick: () => { if (!model._showFlatView) model.toggleFlatView(); },
              title: "Show deduplicated list of distinct metadata items"
            },
            h("svg", {
              viewBox: "0 0 520 520",
              width: "20",
              height: "20",
              fill: "currentColor",
              className: "dep-icon-inline-margin-large"
            },
            h("use", {"xlinkHref": "symbols.svg#magicwand"})
            ),
            "Quick Summary"
            ),
            h("button", {
              className: CSSUtils.classNames({
                "dep-view-toggle": true,
                "active": !model._showFlatView,
                "inactive": model._showFlatView
              }),
              onClick: () => { if (model._showFlatView) model.toggleFlatView(); },
              title: "Show complete dependency tree with parent-child relationships"
            },
            h("svg", {
              viewBox: "0 0 520 520",
              width: "20",
              height: "20",
              fill: "currentColor",
              className: "dep-icon-inline-margin-large"
            },
            h("use", {"xlinkHref": "symbols.svg#hierarchy"})
            ),
            "Dependency Tree"
            )
            ),

            model.showJsonDebug && model.getFilteredDependencies().length > 0 ? h("pre", {
              className: "dep-json-debug reset-margin"
            },
            h("code", {
              className: "language-json"
            }, JSON.stringify(model.getJsonDebugData(), null, 2))
            )

            : h("div", {
              className: model._showFlatView ? "slds-card dep-content" : "slds-card dep-tree-container"
            },
            (() => {
              const filteredDeps = model.getFilteredDependencies();
              if (filteredDeps.length > 0) {
                if (model.currentFilter === "dependsOn" && model._showFlatView) {
                  return model.getFlatGroupedDependencies().map((group, index) => renderFlatGroup(group, index));
                } else if (model.currentFilter === "dependsOn" && !model._showFlatView) {
                  const treeItems = model.getTreeGroupedDependencies();
                  return treeItems.map((item, index) => renderTreeItem(item, index, 0, new Set()));
                } else {
                  // For "Referenced By" or flat view, use grouped dependencies
                  return model.getGroupedDependencies().map((group, index) => renderGroup(group, index));
                }
              } else if (model.spinnerCount === 0) {
                return h("div", {
                  className: "dep-empty"
                }, "No dependencies found");
              } else {
                return null;
              }
            })()
            )
          ),

          !model.dependencyTree && !model.dependencyError && h("div", {
            className: "dep-empty"
          },
          h("h3", {}, "Welcome to the Dependencies Explorer!"),
          h("p", {}, "Select a metadata type and item to analyze its dependencies."),
          h("p", {className: "small"}, "This tool automatically shows what your metadata references and what references it.")
          ),

          h("div", {},
            h("div", {
              className: "dep-footer-content"
            },
            h("span", {
              className: "slds-badge slds-badge slds-m-right_small slds-m-top_xx-small",
              style: {cursor: "default"}
            },
            model.dependencyTree
              ? `${model.currentFilter === "dependedOnBy"
                ? model.getReferencedByCount()
                : model.getDependsOnCount()
              } ${
                (model.currentFilter === "dependedOnBy"
                  ? model.getReferencedByCount()
                  : model.getDependsOnCount()
                ) === 1 ? "Item" : "Items"
              } found`
              : ""
            ),
            )
          )
        )
      )
      )
    );
  }
}

{
  // Add CSS animations
  if (typeof window !== "undefined" && !window.__dep_spinner_css) {
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes dep-bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-20px); }
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    window.__dep_spinner_css = true;
  }

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model(sfHost, args);
    window.sfConn = sfConn;
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, () => {
        if (window.Prism && model.showJsonDebug) {
          window.Prism.highlightAll();
        }
        if (cb) cb();
      });
    };
    ReactDOM.render(h(App, {model}), root);

  });
}

// Performance utilities
/**
 * Performance optimization utilities
 * @type {Object}
 */
const PerformanceUtils = {
  /**
   * Simple memoization cache
   * @type {Map}
   */
  cache: new Map(),

  /**
   * Memoizes a function with a cache key
   * @param {string} key - Cache key
   * @param {Function} fn - Function to memoize
   * @param {Array} args - Function arguments
   * @returns {*} Cached or computed result
   */
  memoize(key, fn, args = []) {
    const cacheKey = `${key}_${JSON.stringify(args)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const result = fn.apply(null, args);
    this.cache.set(cacheKey, result);
    return result;
  }
};

// CSS Class Utilities
/**
 * Utilities for managing CSS classes and style migration
 * @type {Object}
 */
const CSSUtils = {
  /**
   * Creates conditional CSS classes
   * @param {Object} classMap - Map of class names to boolean conditions
   * @param {string} [baseClass] - Base class name
   * @returns {string} Combined class string
   */
  classNames(classMap, baseClass = "") {
    const classes = [baseClass];
    Object.entries(classMap).forEach(([className, condition]) => {
      if (condition) classes.push(className);
    });
    return classes.filter(Boolean).join(" ");
  }
};
