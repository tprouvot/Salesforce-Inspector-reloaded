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
  // Options
  static PRELOAD_SOBJECTS_BEFORE_POPUP = "preloadSobjectsBeforePopup";
  static ENABLE_SOBJECTS_LIST_CACHE = "enableSobjectsListCache";
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

export function isSettingEnabled(settingName){
  return localStorage.getItem(settingName) === "true";
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
      // eslint-disable-next-line camelcase
      code_verifier: data.code_verifier,
      // eslint-disable-next-line camelcase
      code_challenge: data.code_challenge
    };
  } catch (error) {
    console.error("Error fetching PKCE parameters:", error);
    throw error;
  }
}

// Copy text to the clipboard, without rendering it, since rendering is slow.
export function copyToClipboard(value) {
  // Check for unit tests - wrap in try-catch to handle SecurityError in popup mode
  try {
    if (parent && parent.isUnitTest) {
      parent.testClipboardValue = value;
      return;
    }
  } catch (error) {
    // SecurityError occurs in popup mode when accessing parent frame
    console.error("Error copying to clipboard:", error);
  }
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
  static getCachedData(cacheKey, sfHost, isLarge = false, useSfHostPrefix = true) {
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
  static _getCachedDataSmall(storageKey, cacheKey, expectedSfHost) {
    const cached = localStorage.getItem(storageKey);

    if (!cached) {
      return null;
    }

    try {
      const cacheEntry = JSON.parse(cached);

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
  static async _getCachedDataLarge(storageKey, cacheKey, expectedSfHost) {
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

      // Check if sfHost matches (for sobjectsList cache)
      if (cached.sfHost && cached.sfHost !== expectedSfHost) {
        // Different org cached, return null to trigger fresh fetch
        // Clear old cache asynchronously (don't block)
        browser.storage.local.remove(storageKey).catch(err => {
          console.error(`Error clearing old cache for ${cacheKey}:`, err);
        });
        return null;
      }

      if (this.isCacheValid(cached, cacheKey)) {
        return cached.data;
      } else {
        // Cache expired, remove it
        await browser.storage.local.remove(storageKey);
        return null;
      }
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
   * @returns {Promise<boolean>|void} Promise with success boolean if isLarge=true, void otherwise
   */
  static setCachedData(cacheKey, sfHost, data, isLarge = false, useSfHostPrefix = true) {
    // Get current duration setting
    const durationHours = this.getCacheDurationHours(cacheKey);

    const storageKey = useSfHostPrefix
      ? `${sfHost}_cache_${cacheKey}`
      : `cache_${cacheKey}`;
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      sfHost, // Store sfHost in cache entry for validation
      durationHours // Store duration in cache entry
    };

    if (isLarge) {
      // Use browser.storage.local for large data
      // Clear old cache for different org asynchronously (don't block)
      this._clearOldOrgCache(cacheKey, sfHost, useSfHostPrefix);
      return this._setCachedDataLarge(storageKey, cacheKey, cacheEntry);
    } else {
      // Use localStorage for small data (synchronous)
      this._setCachedDataSmall(storageKey, cacheKey, cacheEntry);
      return undefined;
    }
  }

  /**
   * Clear cache entries for different orgs (asynchronous, non-blocking)
   * @private
   */
  static async _clearOldOrgCache(cacheKey, currentSfHost, useSfHostPrefix = true) {
    if (typeof browser === "undefined" || !browser.storage || !browser.storage.local) {
      return;
    }

    try {
      // Get all storage keys
      const allData = await browser.storage.local.get(null);
      const keysToRemove = [];

      // Find cache entries for this cacheKey but different sfHost
      for (const [key, value] of Object.entries(allData)) {
        const keyMatches = useSfHostPrefix
          ? key.includes(`_cache_${cacheKey}`)
          : key === `cache_${cacheKey}`;
        if (keyMatches && value && value.sfHost && value.sfHost !== currentSfHost) {
          keysToRemove.push(key);
        }
      }

      // Remove old cache entries asynchronously
      if (keysToRemove.length > 0) {
        browser.storage.local.remove(keysToRemove).catch(err => {
          console.error(`Error clearing old cache entries for ${cacheKey}:`, err);
        });
      }
    } catch (e) {
      console.error(`Error checking for old cache entries for ${cacheKey}:`, e);
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
   * Internal method to store cached data in browser.storage.local (asynchronous)
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
 * Get sobjects list - returns cached data if available, otherwise fetches from API
 * @param {string} sfHost - Salesforce host (for cache validation)
 * @returns {Promise<Array>} Sobjects list (from cache or fetched from API)
 */
export async function getSobjectsList(sfHost) {
  // Check if caching is enabled
  const cacheEnabled = isSettingEnabled(Constants.ENABLE_SOBJECTS_LIST_CACHE);

  // Check cache first (only if caching is enabled)
  if (cacheEnabled) {
    const cachedSobjects = await DataCache.getCachedData(Constants.CACHE_SOBJECTS_LIST, sfHost, true, false);

    if (cachedSobjects && Array.isArray(cachedSobjects)) {
      // Return cached optimized list (callers handle this format)
      return cachedSobjects;
    }
  }

  // Cache miss - fetch from API
  const entityMap = new Map();

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
    },
    api
  ) {
    label = label && label.match("__MISSING") ? "" : label; // Error is added to the label if no label exists
    let entity = entityMap.get(name);
    // Each API call enhances the data, only the Name fields are present for each call.
    if (entity) {
      if (!entity.keyPrefix) {
        entity.keyPrefix = keyPrefix;
      }
      if (!entity.durableId) {
        entity.durableId = durableId;
      }
      if (!entity.isCustomSetting) {
        entity.isCustomSetting = isCustomSetting;
      }
      if (!entity.newUrl) {
        entity.newUrl = newUrl;
      }
      if (!entity.recordTypesSupported) {
        entity.recordTypesSupported = recordTypesSupported;
      }
      if (!entity.isEverCreatable) {
        entity.isEverCreatable = isEverCreatable;
      }
      // Keep layoutable true if it was true in either call
      if (layoutable) {
        entity.layoutable = true;
      }
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

  async function getObjects(url, api) {
    try {
      const describe = await sfConn.rest(url);
      for (const sobject of describe.sobjects) {
        // Bugfix for when the describe call returns before the tooling query call, and isCustomSetting is undefined
        addEntity(
          {...sobject, isCustomSetting: sobject.customSetting || sobject.isCustomSetting, layoutable: sobject.layoutable || false},
          api
        );
      }
    } catch (err) {
      console.error("list " + api + " sobjects", err);
    }
  }

  // Fetch objects from different APIs
  await Promise.all([
    getObjects("/services/data/v" + apiVersion + "/sobjects/", "regularApi"),
    getObjects("/services/data/v" + apiVersion + "/tooling/sobjects/", "toolingApi"),
    fetchEntityDefinitions(addEntity, null),
  ]);

  const sobjectsList = Array.from(entityMap.values());

  // Store in cache for future use (using browser.storage.local for large data)
  // Create optimized version with only essential fields to reduce cache size
  // Include layoutable for field-creator.js to avoid unnecessary describe API calls
  const optimizedList = sobjectsList.map(obj => ({
    name: obj.name,
    label: obj.label,
    keyPrefix: obj.keyPrefix,
    availableApis: obj.availableApis,
    availableKeyPrefix: obj.availableKeyPrefix,
    durableId: obj.durableId,
    isCustomSetting: obj.isCustomSetting,
    recordTypesSupported: obj.recordTypesSupported,
    newUrl: obj.newUrl,
    isEverCreatable: obj.isEverCreatable,
    layoutable: obj.layoutable || false
  }));

  // Store in cache using browser.storage.local (async - don't await, let it happen in background)
  // DataCache will handle clearing old org cache asynchronously
  // useSfHostPrefix=false since sobjectsList doesn't use sfHost in storage key
  // Only store if caching is enabled
  if (cacheEnabled) {
    DataCache.setCachedData(Constants.CACHE_SOBJECTS_LIST, sfHost, optimizedList, true, false)
      .catch(err => console.error("Cache storage error:", err));
  }

  // Return full list (not optimized) for consistency with what callers expect
  return sobjectsList;
}

/**
 * Fetch EntityDefinition records from Salesforce Tooling API
 * Uses recursive batching to fetch all records (2000 per batch)
 * @param {Function} addEntityCallback - Callback function called for each entity record
 *                                        Receives: (entityObject, apiIdentifier)
 * @param {string} apiIdentifier - Identifier to pass to addEntityCallback (e.g., "EntityDef" or null)
 * @returns {Promise<void>} Resolves when all batches are fetched
 */
export async function fetchEntityDefinitions(addEntityCallback, apiIdentifier = null) {
  const batchSize = 2000;
  let bucket = 0;

  async function fetchNextBatch() {
    const offset = bucket > 0 ? ` OFFSET ${bucket * batchSize}` : "";
    const query = `SELECT QualifiedApiName, Label, KeyPrefix, DurableId, IsCustomSetting, RecordTypesSupported, NewUrl, IsEverCreatable, NamespacePrefix FROM EntityDefinition ORDER BY QualifiedApiName ASC LIMIT ${batchSize}${offset}`;

    try {
      const respEntity = await sfConn.rest(
        `/services/data/v${apiVersion}/tooling/query?q=${encodeURIComponent(query)}`
      );

      for (const record of respEntity.records) {
        addEntityCallback(
          {
            name: record.QualifiedApiName,
            label: record.Label,
            keyPrefix: record.KeyPrefix,
            durableId: record.DurableId,
            isCustomSetting: record.IsCustomSetting,
            recordTypesSupported: record.RecordTypesSupported,
            newUrl: record.NewUrl,
            isEverCreatable: record.IsEverCreatable,
            namespacePrefix: record.NamespacePrefix
          },
          apiIdentifier
        );
      }

      // If the batch has batchSize records, there are more to fetch
      const hasMore = respEntity.records?.length >= batchSize;
      if (hasMore) {
        bucket++;
        return fetchNextBatch();
      }
      // All batches fetched
      return Promise.resolve();
    } catch (err) {
      console.error("list entity definitions: ", err);
      throw err;
    }
  }

  return fetchNextBatch().catch((err) => {
    console.error("fetch entity definitions: ", err);
  });
}

/**
 * Validates if a string is a valid Salesforce record ID
 * @param {string} recordId - The string to validate
 * @returns {boolean} True if the string is a valid record ID
 */
export function isRecordId(recordId) {
  return typeof recordId === "string"
       && /^[a-zA-Z0-9]{15,18}$/.test(recordId)
       && /^[0-9a-zA-Z]{3}/.test(recordId)
       && !recordId.startsWith("000")
       && !/[^a-zA-Z0-9]/.test(recordId)
       && /[0-9]/.test(recordId.slice(0, 5));
}
