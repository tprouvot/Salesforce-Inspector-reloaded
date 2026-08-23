import {sfConn, apiVersion} from "./inspector.js";

// Browser polyfill for cross-browser compatibility
if (typeof browser === "undefined") {
  // eslint-disable-next-line no-var
  var browser = chrome;
}

export class Constants {
  static PromptTemplateSOQL = "GenerateSOQL";
  static PromptTemplateFlow = "DescribeFlow";
  static PromptTemplateDebugLog = "AnalyzeDebugLog";
  static PromptTemplateFormula = "FormulaHelper";
  // Consumer Key of default connected app
  static DEFAULT_CLIENT_ID = "3MVG9HB6vm3GZZR9qrol39RJW_sZZjYV5CZXSWbkdi6dd74gTIUaEcanh7arx9BHhl35WhHW4AlNUY8HtG2hs";
  static ACCESS_TOKEN = "_access_token";
  static CODE_VERIFIER = "_code_verifier";
  static CLIENT_ID = "_clientId";
  // API Statistics
  static API_DEBUG_STATISTICS_MODE = "apiDebugStatisticsMode";
  static API_DEBUG_STATISTICS = "apiDebugStatistics";
  // Cache Keys
  static CACHE_SOBJECTS_LIST = "sobjectsList";
  // CustomEvent: dispatched when sobjects list is refreshed in background
  static SOBJECTS_LIST_REFRESHED_EVENT = "sobjectsListRefreshed";
  // Options
  static PRELOAD_SOBJECTS_BEFORE_POPUP = "preloadSobjectsBeforePopup";
  static ENABLE_SOBJECTS_LIST_CACHE = "enableSobjectsListCache";
  static ENABLE_RECENTLY_VIEWED_RECORDS = "enableRecentlyViewedRecords";
  static QA_INTERNAL_MODE = "qaInternalMode";
  static USER_SEARCH_EXCLUSIONS_KEY = "_userSearchExclusions";
  // Custom Shortcuts shared across every org (not prefixed by sfHost)
  static GLOBAL_LINKS_KEY = "globalLinks";
  /** Shared definition for "Exclude users from search (org specific)" */
  static USER_SEARCH_EXCLUSIONS_CHECKBOXES = [
    {label: " Exclude Portal users", name: "portal", stateKey: "excludePortalUsersFromSearch"},
    {label: " Exclude Inactive users", name: "inactive", stateKey: "excludeInactiveUsersFromSearch"},
  ];
}

/**
 * Unified storage-backed history/saved list used by data-export, rest-explore, and event-monitor.
 * @param {string} storageKey - localStorage key
 * @param {number} max - max entries to keep
 * @param {Object} options - configuration
 * @param {function(Object): boolean} [options.isValidEntry] - filter valid entries (default: objects only)
 * @param {function(Object, Object): boolean} [options.matchAdd] - find existing for dedupe on add
 * @param {function(Object, Object): boolean} [options.matchRemove] - find entry for remove (default: matchAdd or by key)
 * @param {function(Object, Object): number} [options.sortComparator] - sort comparator (for saved lists)
 * @param {boolean} [options.addToFront=true] - add new entries to front (history) or end (saved)
 */
export class StorageHistory {
  constructor(storageKey, max, options = {}) {
    this.storageKey = storageKey;
    this.max = max;
    this.options = {
      isValidEntry: (e) => typeof e === "object",
      matchAdd: null,
      matchRemove: null,
      sortComparator: null,
      addToFront: true,
      ...options
    };
    this.list = this._get();
  }

  _get() {
    let list;
    try {
      const stored = localStorage.getItem(this.storageKey);
      list = stored ? JSON.parse(stored) : [];
    } catch {
      list = [];
    }
    if (!Array.isArray(list)) {
      list = [];
    }
    list = list.filter(this.options.isValidEntry);
    if (this.options.sortComparator) {
      list.sort(this.options.sortComparator);
    }
    this.list = list;
    return list;
  }

  add(entry) {
    let list = this._get();
    const match = this.options.matchAdd || ((e, ent) => e.key === ent.key);
    const idx = list.findIndex((e) => match(e, entry));
    if (idx > -1) {
      list.splice(idx, 1);
    }
    if (this.options.addToFront) {
      list.splice(0, 0, entry);
    } else {
      list.push(entry);
    }
    if (this.options.sortComparator) {
      list.sort(this.options.sortComparator);
    }
    if (list.length > this.max) {
      list.pop();
    }
    localStorage.setItem(this.storageKey, JSON.stringify(list));
    this.list = list;
  }

  remove(entry) {
    let list = this._get();
    const match = this.options.matchRemove || this.options.matchAdd || ((e, ent) => e.key === ent.key);
    const idx = list.findIndex((e) => match(e, entry));
    if (idx > -1) {
      list.splice(idx, 1);
    }
    if (this.options.sortComparator) {
      list.sort(this.options.sortComparator);
    }
    localStorage.setItem(this.storageKey, JSON.stringify(list));
    this.list = list;
  }

  clear() {
    localStorage.removeItem(this.storageKey);
    this.list = [];
  }
}

/**
 * Mapping of standard Salesforce objects to their name fields.
 * Objects with "Name" field are not included (assumed default).
 * Objects with null have no nameField property (e.g., Event, Task use Subject).
 * Objects with a string value have a different nameField than "Name".
 *
 * This list helps optimize queries by avoiding unnecessary describe API calls.
 */
export const STANDARD_OBJECT_NAME_FIELDS = {
  // Objects with non-standard name fields or no name field
  "AccountContactRelation": null,
  "AccountContactRole": null,
  "AccountPartner": null,
  "CampaignMember": null,
  "CampaignMemberStatus": null,
  "Case": "CaseNumber",
  "CaseContactRole": null,
  "CaseMilestone": null,
  "CaseSolution": null,
  "CaseStatus": "ApiName",
  "ChangeRequest": "ChangeRequestNumber",
  "ContentAsset": "DeveloperName",
  "ContentBody": null,
  "ContentDistributionView": null,
  "ContentDocument": "Title",
  "ContentDocumentLink": null,
  "ContentDocumentSubscription": null,
  "ContentFolderItem": null,
  "ContentFolderLink": null,
  "ContentFolderMember": null,
  "ContentNote": "Title",
  "ContentNotification": null,
  "ContentTagSubscription": null,
  "ContentTaxonomyRelatedTerm": null,
  "ContentTaxonomyTermRelatedTerm": null,
  "ContentUserSubscription": null,
  "ContentVersion": "Title",
  "ContentVersionComment": null,
  "ContentVersionRating": null,
  "ContentWorkspaceDoc": null,
  "ContentWorkspaceMember": null,
  "ContentWorkspaceSubscription": null,
  "Contract": "ContractNumber",
  "ContractContactRole": null,
  "ContractGroupPlanAttribute": "AttributeName",
  "ContractGrpPlanGrpClsAttr": "AttributeName",
  "ContractLineItem": "LineItemNumber",
  "ContractStatus": "ApiName",
  "ContractType": "DeveloperName",
  "ContractTypeConfig": null,
  "Event": "Subject",
  "Expense": "ExpenseNumber",
  "ExpenseReport": "ExpenseReportNumber",
  "ExpenseReportEntry": "ExpenseReportEntryNumber",
  "GroupMember": null,
  "LeadStatus": "ApiName",
  "Note": "Title",
  "OpportunityCompetitor": null,
  "OpportunityContactRole": null,
  "OpportunityHistory": null,
  "OpportunityLineItemSchedule": null,
  "OpportunityPartner": null,
  "OpportunityRelatedDeleteLog": "DeleteLog",
  "OpportunityStage": "ApiName",
  "Order": "OrderNumber",
  "OrderItem": "OrderItemNumber",
  "OrderStatus": "ApiName",
  "Partner": null,
  "PartnerRole": "ApiName",
  "ProductEntitlementTemplate": null,
  "ProductItem": "ProductItemNumber",
  "ProductItemTransaction": "ProductItemTransactionNumber",
  "ProductRequest": "ProductRequestNumber",
  "ProductRequestLineItem": "ProductRequestLineItemNumber",
  "ProductRequired": "ProductRequiredNumber",
  "ProductServiceCampaign": "ProductServiceCampaignName",
  "ProductServiceCampaignItem": "ProductServiceCampaignItemNumber",
  "ProductServiceCampaignItemStatus": "ApiName",
  "ProductServiceCampaignStatus": "ApiName",
  "ProductTransfer": "ProductTransferNumber",
  "ProductWarrantyTerm": "ProductWarrantyTermNumber",
  "QuoteLineItem": "LineNumber",
  "ReturnOrder": "ReturnOrderNumber",
  "ReturnOrderLineItem": "ReturnOrderLineItemNumber",
  "ServiceAppointment": "AppointmentNumber",
  "ServiceAppointmentCapacityUsage": "ServiceAppointmentCapacityUsageAutonumber",
  "ServiceAppointmentStatus": "ApiName",
  "ServiceCrewMember": "ServiceCrewMemberNumber",
  "ServiceReport": "ServiceReportNumber",
  "ServiceReportLayout": "MasterLabel",
  "ServiceResourceCapacity": "CapacityNumber",
  "ServiceResourceSkill": "SkillNumber",
  "ServiceTerritoryLocation": "ServiceTerritoryLocationNumber",
  "ServiceTerritoryMember": "MemberNumber",
  "Shift": "ShiftNumber",
  "ShiftStatus": "ApiName",
  "Shipment": "ShipmentNumber",
  "ShipmentItem": "ShipmentItemNumber",
  "Skill": "MasterLabel",
  "SkillRequirement": "SkillNumber",
  "SkillType": "MasterLabel",
  "Solution": "SolutionName",
  "SolutionStatus": "ApiName",
  "Task": "Subject",
  "TaskPriority": "ApiName",
  "TaskRelation": null,
  "TaskStatus": "ApiName",
  "TaskWhoRelation": null,
  "TimeSheet": "TimeSheetNumber",
  "TimeSheetEntry": "TimeSheetEntryNumber",
  "TimeSlot": "TimeSlotNumber",
  "TimelineObjectDefinition": "DeveloperName",
  "Vote": null,
  "WarrantyTerm": "WarrantyTermName",
  "WorkAccess": null,
  "WorkBadge": null,
  "WorkCapacityAvailability": "WorkCapacityAvailNumber",
  "WorkCapacityLimit": "WorkCapacityLimitNumber",
  "WorkCapacityUsage": "WorkCapacityUsageNumber",
  "WorkOrder": "WorkOrderNumber",
  "WorkOrderLineItem": "LineItemNumber",
  "WorkOrderLineItemStatus": "ApiName",
  "WorkOrderStatus": "ApiName",
  "WorkPlanSelectionRule": "WorkPlanSelectionRuleNumber",
  "WorkPlanTemplateEntry": "WorkPlanTemplateEntryNumber",
  "WorkStepStatus": "ApiName",
  "WorkThanks": null,
  // Custom metadata types ending with __mdt use "DeveloperName"
  "CustomMetadataType": "DeveloperName", // For __mdt objects
};

/**
 * Determines if the org should be treated as production (for styling/warnings).
 * Returns false for sandbox, trial orgs, and Developer Edition orgs.
 * @param {string} sfHost - Salesforce host (e.g. "myorg.lightning.force.com")
 * @returns {boolean} True if production org, false otherwise
 */
export function isProductionOrg(sfHost) {
  const isSandbox = localStorage.getItem(sfHost + "_isSandbox") === "true";
  const trialExpDate = localStorage.getItem(sfHost + "_trialExpirationDate");
  if (isSandbox || (trialExpDate && trialExpDate !== "null")) {
    return false;
  }
  const orgInfo = JSON.parse(sessionStorage.getItem(sfHost + "_orgInfo") || "null");
  if (orgInfo?.OrganizationType === "Developer Edition") {
    return false;
  }
  return true;
}

/**
 * Applies production styling (sfir-prod class) to document.body when the org is production.
 * Developer Edition orgs are not considered production.
 * @param {string} sfHost - Salesforce host (e.g. "myorg.lightning.force.com")
 * @returns {boolean} True if production styling was applied, false otherwise
 */
export function applyProductionStyling(sfHost) {
  if (isProductionOrg(sfHost)) {
    document.body.classList.add("sfir-prod");
    return true;
  }
  return false;
}

export function getLinkTarget(e = {}) {
  if (localStorage.getItem("openLinksInNewTab") == "true" || (e.ctrlKey || e.metaKey)) {
    return "_blank";
  } else {
    return "_top";
  }
}

export function nullToEmptyString(value) {
  // For react input fields, the value may not be null or undefined, so this will clean the value
  return (value == null) ? "" : value;
}

export function isOptionEnabled(optionName, optionsArray){
  const option = optionsArray?.find((element) => element.name == optionName);
  if (option){
    return option.checked;
  }
  //if no option was found, enable by default
  return true;
}

export function isSettingEnabled(settingName, defaultValue = false){
  const value = localStorage.getItem(settingName);
  if (value === null) {
    return defaultValue;
  }
  return value === "true";
}

export async function getLatestApiVersionFromOrg(sfHost) {
  let latestApiVersionFromOrg = sessionStorage.getItem(sfHost + "_latestApiVersionFromOrg");
  if (latestApiVersionFromOrg != null) {
    return latestApiVersionFromOrg;
  } else {
    const res = await sfConn.rest("services/data/");
    latestApiVersionFromOrg = res[res.length - 1].version; //Extract the value of the last version
    sessionStorage.setItem(sfHost + "_latestApiVersionFromOrg", latestApiVersionFromOrg);
    return latestApiVersionFromOrg;
  }
}

export async function setOrgInfo(sfHost) {
  let orgInfo = JSON.parse(sessionStorage.getItem(sfHost + "_orgInfo"));
  if (orgInfo == null) {
    const res = await sfConn.rest("/services/data/v" + apiVersion + "/query/?q=SELECT+Id,InstanceName,OrganizationType+FROM+Organization");
    orgInfo = res.records[0];
    sessionStorage.setItem(sfHost + "_orgInfo", JSON.stringify(orgInfo));
  }
  return orgInfo;
}

export async function getUserInfo() {
  try {
    const res = await sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {});
    return {
      success: true,
      userInfo: res.userFullName + " / " + res.userName + " / " + res.organizationName,
      userFullName: res.userFullName,
      userInitials: res.userFullName.split(" ").map(n => n[0]).join(""),
      userName: res.userName,
      userError: null,
      userErrorDescription: null
    };
  } catch (error) {
    console.error("Error fetching user info:", error);
    return {
      success: false,
      userInfo: "Error loading user info",
      userFullName: "Unknown User",
      userInitials: "?",
      userName: "Unknown",
      userError: "Error fetching user info",
      userErrorDescription: "Session is probably expired or invalid"
    };
  }
}

/**
 * UserInfoModel - Centralized user information management
 * This class handles fetching and storing user information for any page.
 *
 * Usage:
 * ```
 * class Model {
 *   constructor(sfHost) {
 *     this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));
 *   }
 * }
 *
 * // In render:
 * h(PageHeader, {
 *   ...this.userInfoModel.getProps(),
 *   // other props
 * })
 * ```
 */
export class UserInfoModel {
  constructor(spinForCallback) {
    // Initialize with loading state
    this.userInfo = "...";
    this.userFullName = "";
    this.userInitials = "";
    this.userName = "";
    this.userError = null;
    this.userErrorDescription = null;

    // Fetch user info
    if (spinForCallback) {
      spinForCallback(this.fetchUserInfo());
    } else {
      this.fetchUserInfo();
    }
  }

  async fetchUserInfo() {
    const result = await getUserInfo();

    // Update all properties from result
    this.userInfo = result.userInfo;
    this.userFullName = result.userFullName;
    this.userInitials = result.userInitials;
    this.userName = result.userName;
    this.userError = result.userError;
    this.userErrorDescription = result.userErrorDescription;
  }

  /**
   * Get props object for PageHeader component
   * @returns {Object} Props containing userInitials, userFullName, userName, userError, userErrorDescription
   */
  getProps() {
    return {
      userInitials: this.userInitials,
      userFullName: this.userFullName,
      userName: this.userName,
      userError: this.userError,
      userErrorDescription: this.userErrorDescription
    };
  }
}

export class PromptTemplate {
  constructor(promptName) {
    this.promptName = promptName;
  }

  async generate(params = {}) {
    const jsonBody = {
      isPreview: false,
      inputParams: {
        valueMap: Object.entries(params).reduce((acc, [key, value]) => {
          acc[`Input:${key}`] = {value};
          return acc;
        }, {})
      },
      additionalConfig: {
        applicationName: "PromptTemplateGenerationsInvocable"
      }
    };

    try {
      const response = await sfConn.rest(
        `/services/data/v${apiVersion}/einstein/prompt-templates/${this.promptName}/generations`,
        {
          method: "POST",
          body: jsonBody
        }
      );

      if (response && response.generations && response.generations.length > 0) {
        return {
          success: true,
          result: response.generations[0].text,
          requestId: response.requestId,
          metadata: {
            promptTemplateDevName: response.promptTemplateDevName,
            parameters: response.parameters,
            isSummarized: response.isSummarized
          }
        };
      }

      return {
        success: false,
        error: "No result generated"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to generate result"
      };
    }
  }
}

/**
 * Creates a spinFor method for a model context
 * This method shows a spinner while waiting for a promise.
 * @param {Object} context - The model context (must have spinnerCount and didUpdate properties)
 * @returns {Function} A bound spinFor method
 */
export function createSpinForMethod(context) {
  return function(promise) {
    context.spinnerCount++;
    promise
      .catch(err => {
        console.error("spinFor", err);
      })
      .then(() => {
        context.spinnerCount--;
        context.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  };
}

// OAuth utilities
export function getBrowserType() {
  return navigator.userAgent?.includes("Chrome") ? "chrome" : "moz";
}

export function getExtensionId() {
  return chrome.i18n.getMessage("@@extension_id");
}

export function getClientId(sfHost) {
  const storedClientId = localStorage.getItem(sfHost + Constants.CLIENT_ID);
  return storedClientId || Constants.DEFAULT_CLIENT_ID;
}

export function getRedirectUri(page = "data-export.html") {
  const browser = getBrowserType();
  const extensionId = getExtensionId();
  return `${browser}-extension://${extensionId}/${page}`;
}

// PKCE (Proof Key for Code Exchange) utilities
export async function getPKCEParameters(sfHost) {
  try {
    const response = await fetch(`https://${sfHost}/services/oauth2/pkce/generator`);
    if (!response.ok) {
      throw new Error(`Failed to fetch PKCE parameters: ${response.status}`);
    }
    const data = await response.json();
    return {

      code_verifier: data.code_verifier,

      code_challenge: data.code_challenge
    };
  } catch (error) {
    console.error("Error fetching PKCE parameters:", error);
    throw error;
  }
}

// Copy text to the clipboard, without rendering it, since rendering is slow.
export function copyToClipboard(value) {
  // Use execCommand to trigger an oncopy event and use an event handler to copy the text to the clipboard.
  // The oncopy event only works on editable elements, e.g. an input field.
  let temp = document.createElement("input");
  // The oncopy event only works if there is something selected in the editable element.
  temp.value = "temp";
  temp.addEventListener("copy", e => {
    e.clipboardData.setData("text/plain", value);
    e.preventDefault();
  });
  document.body.appendChild(temp);
  try {
    // The oncopy event only works if there is something selected in the editable element.
    temp.select();
    // Trigger the oncopy event
    let success = document.execCommand("copy");
    if (!success) {
      alert("Copy failed");
    }
  } finally {
    document.body.removeChild(temp);
  }
}

/**
 * Generates a URL for the Flow Compare page in Salesforce Flow Builder.
 * @param {string} sfHost - The Salesforce host URL (e.g., "myorg.lightning.force.com").
 * @param {string} recordId - The flow version record ID (18-character Salesforce ID).
 * @returns {string} The complete URL for the Flow Compare page.
 */
export function getFlowCompareUrl(sfHost, recordId) {
  return `https://${sfHost}/builder_platform_interaction/flowBuilder.app?flowId=${recordId}&compareTargetFlowId=${recordId}`;
}

/**
 * Downloads a CSV file with optional UTF-8 BOM for Excel compatibility
 * @param {string} csvContent - The CSV content to download
 * @param {string} filename - The filename for the downloaded file
 */

export function downloadCsvFile(csvContent, filename) {
  // Add UTF-8 BOM for Excel compatibility with Hebrew and other non-Latin characters
  const BOM = localStorage.getItem("useBomForCsvExport") === "true" ? "\uFEFF" : "";
  const blob = new Blob([BOM + csvContent], {type: "text/csv;charset=utf-8;"});

  const downloadAnchor = document.createElement("a");
  downloadAnchor.download = filename;
  downloadAnchor.href = window.URL.createObjectURL(blob);
  downloadAnchor.click();
}

/**
 * Get the name field for a Salesforce object.
 * Checks the standard objects mapping first, then returns null to indicate
 * that the describe API should be used to determine the name field.
 *
 * @param {string} sobjectName - The API name of the Salesforce object
 * @returns {string|null|undefined} The name field API name, null if no name field exists, or undefined if not in the mapping
 */
export function getStandardObjectNameField(sobjectName) {
  // Check direct mapping first
  if (sobjectName in STANDARD_OBJECT_NAME_FIELDS) {
    return STANDARD_OBJECT_NAME_FIELDS[sobjectName];
  }

  // Check for custom metadata types (end with __mdt)
  if (sobjectName.endsWith("__mdt")) {
    return "DeveloperName";
  }

  // Not in the mapping - return N/A to indicate describe API should be used
  return "N/A";
}

/**
 * DataCache - Generic caching utility for any JSON-serializable data
 * Stores data with timestamps and provides expiration checking based on user-configured days.
 */
export class DataCache {
  /**
   * Get cache duration for a specific cache key (in hours) from localStorage setting
   * Falls back to default (168 hours = 7 days) if cache-specific duration not set
   * This is used when creating new cache entries and for UI display.
   * Note: Cache validation uses the durationHours stored in the cache entry itself.
   * @param {string} cacheKey - Cache key to get duration for
   * @returns {number} Cache duration in hours
   */
  static getCacheDurationHours(cacheKey) {
    const cacheDurationHours = localStorage.getItem(`cacheDuration_${cacheKey}`);
    if (cacheDurationHours !== null && cacheDurationHours !== undefined) {
      const hours = parseInt(cacheDurationHours, 10);
      if (!isNaN(hours) && hours >= 0) {
        return hours;
      }
    }
    // Fallback to default: 168 hours (7 days)
    return 168;
  }

  /**
   * Check if a cache entry is still valid
   * @param {Object} cacheEntry - Cache entry with data, timestamp, and optionally durationHours
   * @param {string} cacheKey - Cache key for per-cache expiration checking (used for fallback)
   * @returns {boolean} True if cache is valid, false if expired
   */
  static isCacheValid(cacheEntry, cacheKey) {
    if (!cacheEntry || !cacheEntry.timestamp) {
      return false;
    }
    // Use durationHours from cache entry if available, otherwise fallback to current setting
    const cacheDurationHours = cacheEntry.durationHours !== undefined
      ? cacheEntry.durationHours
      : this.getCacheDurationHours(cacheKey);
    const now = Date.now();
    const cacheAge = now - cacheEntry.timestamp;
    const maxAge = cacheDurationHours * 60 * 60 * 1000; // Convert hours to milliseconds
    return cacheAge < maxAge;
  }

  /**
   * Get cached data if valid, null if expired or missing
   * @param {string} cacheKey - Unique key for the cached data
   * @param {string} sfHost - Salesforce host (for scoping cache per org)
   * @param {boolean} isLarge - If true, use browser.storage.local (async), otherwise localStorage (sync)
   * @param {boolean} useSfHostPrefix - If true, prefix storage key with sfHost (default: true)
   * @returns {Promise<Object|null>|Object|null} Cached data if valid, null otherwise. Promise if isLarge=true
   */
  static async getCachedData(cacheKey, sfHost, isLarge = false, useSfHostPrefix = true) {
    const storageKey = useSfHostPrefix
      ? `${sfHost}_cache_${cacheKey}`
      : `cache_${cacheKey}`;

    if (isLarge) {
      // Use browser.storage.local for large data
      return this._getCachedDataLarge(storageKey, cacheKey, sfHost);
    } else {
      // Use localStorage for small data (synchronous)
      return this._getCachedDataSmall(storageKey, cacheKey, sfHost);
    }
  }

  /**
   * Internal method to get cached data from localStorage (synchronous)
   * @private
   */
  static async _getCachedDataSmall(storageKey, cacheKey, expectedSfHost) {
    const cached = localStorage.getItem(storageKey);

    if (!cached) {
      return null;
    }

    try {
      const cacheEntry = JSON.parse(cached);
      if (cacheEntry.compressed) {
        cacheEntry.data = await this._decompressGzip(cacheEntry.data);
      }

      // Check if sfHost matches (for sobjectsList cache)
      if (cacheEntry.sfHost && cacheEntry.sfHost !== expectedSfHost) {
        // Different org cached, return null to trigger fresh fetch
        // Clear old cache asynchronously (don't block)
        setTimeout(() => {
          localStorage.removeItem(storageKey);
        }, 0);
        return null;
      }

      if (this.isCacheValid(cacheEntry, cacheKey)) {
        return cacheEntry.data;
      } else {
        // Cache expired, remove it
        localStorage.removeItem(storageKey);
        return null;
      }
    } catch (e) {
      console.error(`Error parsing cache entry for ${cacheKey}:`, e);
      localStorage.removeItem(storageKey);
      return null;
    }
  }

  /**
   * Internal method to get cached data from browser.storage.local (asynchronous)
   * @private
   */
  static async _getCachedDataLarge(storageKey, cacheKey) {
    if (typeof browser === "undefined" || !browser.storage || !browser.storage.local) {
      console.warn("browser.storage.local not available");
      return null;
    }

    try {
      const result = await browser.storage.local.get(storageKey);
      const cached = result[storageKey];

      if (!cached) {
        return null;
      }

      //check it the cache is valid
      if (!this.isCacheValid(cached, cacheKey)) {
        await browser.storage.local.remove(storageKey);
        return null;
      }

      //uncompress the data if compressed
      let data = cached.data;
      if (cached.compressed) {
        data = await this._decompressGzip(cached.data);
      }
      return {data, lastFetch: cached.lastFetch};
    } catch (e) {
      console.error(`Error reading large data cache for ${cacheKey}:`, e);
      return null;
    }
  }

  /**
   * Store data in cache with current timestamp
   * @param {string} cacheKey - Unique key for the cached data
   * @param {string} sfHost - Salesforce host (for scoping cache per org)
   * @param {*} data - Any JSON-serializable data to cache
   * @param {boolean} isLarge - If true, use browser.storage.local (async), otherwise localStorage (sync)
   * @param {boolean} useSfHostPrefix - If true, prefix storage key with sfHost (default: true)
   * @param {number} lastFetch - Timestamp of the last fetch
   * @returns {Promise<boolean>|void} Promise with success boolean if isLarge=true, void otherwise
   */
  static async setCachedData(cacheKey, sfHost, data, isLarge = false, useSfHostPrefix = true, lastFetch = null, compression = false) {
    // Get current duration setting
    const durationHours = this.getCacheDurationHours(cacheKey);

    const storageKey = useSfHostPrefix
      ? `${sfHost}_cache_${cacheKey}`
      : `cache_${cacheKey}`;

    //set the cache entry and compress the data if needed
    const cacheEntry = {
      data: compression ? await this._compressGzip(data) : data,
      timestamp: Date.now(),
      sfHost, // Store sfHost in cache entry for validation
      durationHours, // Store duration in cache entry
      lastFetch,
      compressed: compression
    };

    if (isLarge) {
      // Use browser.storage.local for large data
      // Await cleanup before storing (avoids race where set runs before clear completes)
      return this._clearOldOrgCache(storageKey, sfHost, cacheEntry)
        .then(() => this._setCachedDataLarge(storageKey, cacheKey, cacheEntry));
    } else {
      // Use localStorage for small data (synchronous)
      this._setCachedDataSmall(storageKey, cacheKey, cacheEntry);
      return undefined;
    }
  }

  /**
   * Clear cache entries to stay under storage quota before storing new data.
   * Chrome storage.local ~5MB (10MB in Chrome 114+), Firefox ~10MB.
   * Removes other-org caches first, then oldest entries if still over quota.
   * @private
   */
  static async _clearOldOrgCache(storageKey, currentSfHost, cacheEntry = undefined) {
    if (typeof browser === "undefined" || !browser.storage || !browser.storage.local) {
      return;
    }

    const maxStorageUsage = 10 * 1024 * 1024;
    try {
      const getBytesInUse = browser.storage.local.getBytesInUse?.bind(browser.storage.local);
      if (!getBytesInUse) {
        return;
      }

      //retrieve the current storage usage and estimate the expected storage usage after the update
      const currentStorageUsage = await getBytesInUse(null);
      const cacheEntrySize = (cacheEntry?.data?.length || 0) + 100;
      const keyStorageUsage = await getBytesInUse(storageKey);
      let expectedStorageUsage = currentStorageUsage + cacheEntrySize - keyStorageUsage;

      //we have enough space, so we don't need to remove any entries
      if (expectedStorageUsage <= maxStorageUsage) {
        return;
      }

      const allData = await browser.storage.local.get(null);
      //get all the entries that are not expired and sort them by last fetch timestamp (older first)
      const entries = Object.entries(allData || {})
        .filter(([, v]) => v && (v.timestamp != null || v.lastFetch != null))
        .sort((a, b) => (a[1].lastFetch ?? a[1].timestamp ?? 0) - (b[1].lastFetch ?? b[1].timestamp ?? 0));

      const keysToRemove = [];

      // Calculate which entry we will remove based on last fetch timestamp
      for (const [key, value] of entries) {
        if (value?.sfHost && value.sfHost !== currentSfHost) {
          //if the entry is from another org, we add it to the list of keys to remove
          keysToRemove.push(key);
          //then we calculate if we we have enough space to store the new entry
          const size = await getBytesInUse(key);
          expectedStorageUsage -= size;
          if (expectedStorageUsage < maxStorageUsage) {
            break;
          }
        }
      }

      if (keysToRemove.length > 0) {
        await browser.storage.local.remove(keysToRemove);
      }
    } catch (e) {
      console.error(`Error clearing cache for ${storageKey}:`, e);
    }
  }

  /**
   * Internal method to store cached data in localStorage (synchronous)
   * @private
   */
  static _setCachedDataSmall(storageKey, cacheKey, cacheEntry) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cacheEntry));
    } catch (e) {
      console.error(`Error storing cache entry for ${cacheKey}:`, e);
    }
  }

  /**
   * Compress data with gzip and return as base64 string.
   * @param {*} data - JSON-serializable data to compress
   * @returns {Promise<string>} Base64-encoded gzip compressed string
   * @private
   */
  static async _compressGzip(data) {
    const json = JSON.stringify(data);
    const blob = new Blob([json], {type: "application/json"});
    const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
    const compressedBlob = await new Response(stream).blob();
    const buffer = await compressedBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  /**
   * Decompress base64 gzip string back to original data.
   * @param {string} base64Compressed - Base64-encoded gzip compressed string
   * @returns {Promise<*>} Original decompressed data
   * @private
   */
  static async _decompressGzip(base64Compressed) {
    const binary = atob(base64Compressed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const decompressedBlob = await new Response(stream).blob();
    const text = await decompressedBlob.text();
    return JSON.parse(text);
  }

  /**
   * Internal method to store cached data in browser.storage.local (asynchronous)
   * On quota error, clears the target key (we're overwriting) and retries once.
   * Compresses cacheEntry.data with gzip before storing to reduce storage usage.
   * @private
   */
  static async _setCachedDataLarge(storageKey, cacheKey, cacheEntry) {
    if (typeof browser === "undefined" || !browser.storage || !browser.storage.local) {
      console.warn("browser.storage.local not available");
      return false;
    }

    try {
      await browser.storage.local.set({[storageKey]: cacheEntry});
      return true;
    } catch (e) {
      console.error(`Error storing large data cache for ${cacheKey}:`, e);
      console.error(`Error name: ${e.name}, Error message: ${e.message}`);
      return false;
    }
  }

  /**
   * Clear a specific cache entry
   * @param {string} cacheKey - Unique key for the cached data
   * @param {string} sfHost - Salesforce host (for scoping cache per org, not used if useSfHostPrefix is false)
   * @param {boolean} isLarge - If true, clear from browser.storage.local (async), otherwise localStorage (sync)
   * @param {boolean} useSfHostPrefix - If true, prefix storage key with sfHost (default: true)
   * @returns {Promise<void>|void} Promise if isLarge=true, void otherwise
   */
  static clearCache(cacheKey, sfHost, isLarge = false, useSfHostPrefix = true) {
    const storageKey = useSfHostPrefix
      ? `${sfHost}_cache_${cacheKey}`
      : `cache_${cacheKey}`;

    if (isLarge) {
      // Clear from browser.storage.local
      return this._clearCacheLarge(storageKey);
    } else {
      // Clear from localStorage
      if (useSfHostPrefix) {
        // Direct removal for sfHost-prefixed keys
        localStorage.removeItem(storageKey);
      } else {
        // Iterate through all localStorage keys to find and remove matching cache entries
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.endsWith(`_cache_${cacheKey}`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
      return undefined;
    }
  }

  /**
   * Internal method to clear cached data from browser.storage.local (asynchronous)
   * @private
   * @param {string} storageKey - The exact storage key to remove
   */
  static async _clearCacheLarge(storageKey) {
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      // Direct removal using exact storage key (works for both prefixed and non-prefixed keys)
      await browser.storage.local.remove(storageKey);
    }
  }

  /**
   * Clear ALL extension cache entries from both localStorage and browser.storage.local
   * Clears all cache entries regardless of host or cache key
   * @returns {Promise<void>}
   */
  static async clearAllExtensionCache() {
    const keysToRemove = [];

    // Collect all cache-related keys from localStorage
    // Patterns: *_cache_* or cache_* or cacheDuration_*
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("_cache_") || key.startsWith("cache_") || key.startsWith("cacheDuration_"))) {
        keysToRemove.push(key);
      }
    }

    // Remove all matching keys from localStorage
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keysToRemove.length} cache entries from localStorage`);

    // Also clear from browser.storage.local if available
    if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
      try {
        const allData = await browser.storage.local.get(null);
        const largeKeysToRemove = Object.keys(allData).filter(key =>
          key.includes("_cache_") || key.startsWith("cache_")
        );
        if (largeKeysToRemove.length > 0) {
          await browser.storage.local.remove(largeKeysToRemove);
          console.log(`Cleared ${largeKeysToRemove.length} cache entries from browser.storage.local`);
        }
      } catch (e) {
        console.error("Error clearing browser.storage.local cache:", e);
      }
    }
  }

}

/**
 * Get sobjects list - returns cached data if available, otherwise fetches from API.
 * When cache is used, returns immediately and continues refresh in background; dispatches
 * CustomEvent (Constants.SOBJECTS_LIST_REFRESHED_EVENT) when refresh completes.
 * @param {string} sfHost - Salesforce host (for cache validation)
 * @returns {Promise<Array>} Sobjects list (from cache or fetched from API)
 */
export async function getSobjectsList(sfHost) {
  // Check if caching is enabled
  const cacheEnabled = isSettingEnabled(Constants.ENABLE_SOBJECTS_LIST_CACHE, true);
  const currentFetch = Date.now();

  // Check cache first (only if caching is enabled)
  if (cacheEnabled) {
    const cached = await DataCache.getCachedData(Constants.CACHE_SOBJECTS_LIST, sfHost, true, true);
    if (cached) {
      const sobjectsList = cached.data ?? [];

      //if we don't do the Preload SObjects before popup opens, we will refresh the cache in background
      if (!isSettingEnabled(Constants.PRELOAD_SOBJECTS_BEFORE_POPUP)){
        const lastFetch = cached.lastFetch ?? null;

        // Return cached data immediately, refresh in background
        fetchSobjectsList(sfHost, currentFetch, cacheEnabled, sobjectsList, lastFetch);
      }
      return sobjectsList;
    }
  }

  // No cache - fetch and return
  return await fetchSobjectsList(sfHost, currentFetch, cacheEnabled, null, null);
}

/**
 * Fetches sobjects list in background and dispatches CustomEvent when done.
 * @private
 */
async function fetchSobjectsList(sfHost, currentFetch, cacheEnabled, cachedSobjectsList, lastFetch) {
  try {
    const entityMap = new Map();

    //if we have cached data, we need to add it to the entity map
    if (cachedSobjectsList && cachedSobjectsList.length > 0) {
      for (const entity of cachedSobjectsList) {
        entityMap.set(entity.name, entity);
      }
    }

    function addEntity(
      {
        name,
        label,
        keyPrefix,
        durableId,
        isCustomSetting,
        recordTypesSupported,
        isEverCreatable,
        newUrl,
        layoutable,
        createable,
        deletable,
        updateable,
      },
      api
    ) {
      label = label && label.match("__MISSING") ? "" : label; // Error is added to the label if no label exists
      let entity = entityMap.get(name);
      // Each API call enhances the data, only the Name fields are present for each call.
      if (entity) {
        entity.label = label || entity.label;
        entity.keyPrefix = keyPrefix || entity.keyPrefix;
        entity.durableId = durableId || entity.durableId;
        entity.isCustomSetting = isCustomSetting || entity.isCustomSetting;
        entity.newUrl = newUrl || entity.newUrl;
        entity.recordTypesSupported = recordTypesSupported || entity.recordTypesSupported;
        entity.isEverCreatable = isEverCreatable || entity.isEverCreatable;
        // Keep layoutable true if it was true in either call
        entity.layoutable = layoutable || entity.layoutable;
        // Keep createable/deletable/updateable true if true in either call (for data-import filtering)
        if (createable) entity.createable = true;
        if (deletable) entity.deletable = true;
        if (updateable) entity.updateable = true;
      } else {
        entity = {
          availableApis: [],
          name,
          label,
          keyPrefix,
          durableId,
          isCustomSetting,
          availableKeyPrefix: null,
          recordTypesSupported,
          isEverCreatable,
          newUrl,
          layoutable: layoutable || false,
          createable: createable || false,
          deletable: deletable || false,
          updateable: updateable || false,
        };
        entityMap.set(name, entity);
      }
      if (api) {
        if (!entity.availableApis.includes(api)) {
          entity.availableApis.push(api);
        }
        if (keyPrefix) {
          entity.availableKeyPrefix = keyPrefix;
        }
      }
    }

    async function getObjects(url, api, lastFetch) {
      try {
        //https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_describeGlobal.htm
        //https://developer.salesforce.com/docs/atlas.en-us.222.0.api_rest.meta/api_rest/describe_global_with_ifmodified_header.htm
        //If-Modified-Since: <date> format EEE, dd MMM yyyy HH:mm:ss z
        const headers = lastFetch ? {"If-Modified-Since": new Date(lastFetch).toGMTString()} : {};
        const describe = await sfConn.rest(url, {headers});
        //if no modification, we receive a 304 status code and an empty response, so process only if describe is not empty
        if (describe) {
          for (const sobject of describe.sobjects) {
            // Bugfix for when the describe call returns before the tooling query call, and isCustomSetting is undefined
            addEntity(
              {
                ...sobject,
                isCustomSetting: sobject.customSetting || sobject.isCustomSetting,
                layoutable: sobject.layoutable || false,
                createable: sobject.createable,
                deletable: sobject.deletable,
                updateable: sobject.updateable,
              },
              api
            );
          }
        }
      } catch (err) {
        console.error("list " + api + " sobjects", err);
      }
    }

    /**
     * Fetch EntityDefinition records from Salesforce Tooling API
     * Uses parallel batching to fetch all records (2000 per batch)
     * @returns {Promise<void>} Resolves when all batches are fetched
     */
    function fetchEntityDefinitions() {
      const batchSize = 2000;
      // entity definition queries can take a lot of time, so spent a first call to get the total number of records to do all others in parallel
      return sfConn
        .rest(`/services/data/v${apiVersion}/tooling/query?q=${encodeURIComponent("SELECT COUNT() FROM EntityDefinition")}`)
        .then((res) => {
          const entityNb = res.totalSize;
          for (let bucket = 0; bucket < Math.ceil(entityNb / batchSize); bucket++) {
            const query = `SELECT QualifiedApiName, Label, KeyPrefix, DurableId, IsCustomSetting, RecordTypesSupported, NewUrl, IsEverCreatable FROM EntityDefinition ORDER BY QualifiedApiName LIMIT ${batchSize} OFFSET ${bucket * batchSize}`;
            sfConn
              .rest(`/services/data/v${apiVersion}/tooling/query?q=${encodeURIComponent(query)}`)
              .then((respEntity) => {
                for (let record of respEntity.records) {
                  addEntity(
                    {
                      name: record.QualifiedApiName,
                      label: record.Label,
                      keyPrefix: record.KeyPrefix,
                      durableId: record.DurableId,
                      isCustomSetting: record.IsCustomSetting,
                      recordTypesSupported: record.RecordTypesSupported,
                      newUrl: record.NewUrl,
                      isEverCreatable: record.IsEverCreatable,
                      // EntityDefinition does not expose createable/deletable/updateable; use isEverCreatable as createable hint
                      createable: record.IsEverCreatable,
                      deletable: false,
                      updateable: false,
                    },
                    null
                  );
                }
              })
              .catch((err) => {
                console.error("list entity definitions: ", err);
              });
          }
        })
        .catch((err) => {
          console.error("count entity definitions: ", err);
        });
    }

    if (entityMap.size > 0) {
      //it means that we already have fetched the data, so we just need to check if we have updates on regular and tooling api
      await Promise.all([
        getObjects("/services/data/v" + apiVersion + "/sobjects/", "regularApi", lastFetch),
        getObjects("/services/data/v" + apiVersion + "/tooling/sobjects/", "toolingApi", lastFetch),
      ]);
    } else {
      // Fetch objects from different APIs
      await Promise.all([
        getObjects("/services/data/v" + apiVersion + "/sobjects/", "regularApi", null),
        getObjects("/services/data/v" + apiVersion + "/tooling/sobjects/", "toolingApi", null),
        fetchEntityDefinitions(),
      ]);
    }

    const sobjectsList = Array.from(entityMap.values());

    if (cacheEnabled && sobjectsList?.length > 0) {
      await DataCache.setCachedData(Constants.CACHE_SOBJECTS_LIST, sfHost, sobjectsList, true, true, currentFetch, true);
      //dispatch event when delta cache is set
      window.dispatchEvent(new CustomEvent(Constants.SOBJECTS_LIST_REFRESHED_EVENT, {
        detail: {sfHost, sobjectsList}
      }));
    }

    return sobjectsList;
  } catch (err) {
    console.error("Background sobjects refresh error:", err);
    return null;
  }
}

/**
 * Validates if a string is a valid Salesforce record ID
 * @param {string} recordId - The string to validate
 * @returns {boolean} True if the string is a valid record ID
 */
export function isRecordId(recordId) {
  return typeof recordId === "string"
       && /^[a-zA-Z0-9]{15,18}$/.test(recordId)
       && !recordId.startsWith("000")
       && /[0-9]/.test(recordId);
}

/**
 * Generates a package.xml string from grouped metadata components
 * @param {Map|Object} groupedComponents - Map or Object where keys are metadata types and values are Set or Array of member names
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.includeXmlDeclaration=true] - Whether to include XML declaration
 * @param {boolean} [options.sortTypes=true] - Whether to sort types alphabetically
 * @param {boolean} [options.skipEmptyTypes=true] - Whether to skip types with no members
 * @returns {string} The generated package.xml string
 */
export function generatePackageXml(groupedComponents, options = {}) {
  const {
    includeXmlDeclaration = true,
    sortTypes = true,
    skipEmptyTypes = true
  } = options;

  let packageXml = "";

  if (includeXmlDeclaration) {
    packageXml += '<?xml version="1.0" encoding="UTF-8"?>\n';
  }

  packageXml += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';

  // Convert Map to entries if needed, and handle both Set and Array members
  let entries;
  if (groupedComponents instanceof Map) {
    entries = Array.from(groupedComponents.entries());
  } else {
    entries = Object.entries(groupedComponents);
  }

  // Sort types alphabetically if requested
  if (sortTypes) {
    entries.sort(([typeA], [typeB]) => typeA.localeCompare(typeB));
  }

  entries.forEach(([type, members]) => {
    // Convert Set to Array if needed
    const membersArray = members instanceof Set ? Array.from(members) : members;

    // Skip empty types if requested
    if (skipEmptyTypes && membersArray.length === 0) {
      return;
    }

    packageXml += "    <types>\n";

    // Sort members alphabetically
    const sortedMembers = [...membersArray].sort();
    sortedMembers.forEach(member => {
      packageXml += `        <members>${member}</members>\n`;
    });

    packageXml += `        <name>${type}</name>\n`;
    packageXml += "    </types>\n";
  });

  packageXml += `    <version>${apiVersion}</version>\n`;
  packageXml += "</Package>";

  return packageXml;
}

/**
 * Formats a duration in minutes into a human-readable string showing all units.
 * @param {number} minutes - The duration in minutes
 * @returns {string} A formatted duration string (e.g., "4 days 3 hours 34 minutes")
 */
export function formatDuration(minutes) {
  if (minutes < 1) {
    return "Less than a minute";
  }

  const parts = [];
  let remaining = Math.round(minutes);

  // Calculate months (30 days = 43200 minutes)
  if (remaining >= 43200) {
    const months = Math.floor(remaining / 43200);
    parts.push(`${months} month${months !== 1 ? "s" : ""}`);
    remaining = remaining % 43200;
  }

  // Calculate weeks (7 days = 10080 minutes)
  if (remaining >= 10080) {
    const weeks = Math.floor(remaining / 10080);
    parts.push(`${weeks} week${weeks !== 1 ? "s" : ""}`);
    remaining = remaining % 10080;
  }

  // Calculate days (1440 minutes per day)
  if (remaining >= 1440) {
    const days = Math.floor(remaining / 1440);
    parts.push(`${days} day${days !== 1 ? "s" : ""}`);
    remaining = remaining % 1440;
  }

  // Calculate hours (60 minutes per hour)
  if (remaining >= 60) {
    const hours = Math.floor(remaining / 60);
    parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
    remaining = remaining % 60;
  }

  // Add remaining minutes
  if (remaining > 0) {
    parts.push(`${remaining} minute${remaining !== 1 ? "s" : ""}`);
  }

  return parts.length > 0 ? parts.join(" ") : "Less than a minute";
}
