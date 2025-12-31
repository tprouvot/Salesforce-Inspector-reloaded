import {sfConn, apiVersion} from "./inspector.js";

export class Constants {
  static PromptTemplateSOQL = "GenerateSOQL";
  static PromptTemplateFlow = "DescribeFlow";
  static PromptTemplateDebugLog = "AnalyzeDebugLog";
  // Consumer Key of default connected app
  static DEFAULT_CLIENT_ID = "3MVG9HB6vm3GZZR9qrol39RJW_sZZjYV5CZXSWbkdi6dd74gTIUaEcanh7arx9BHhl35WhHW4AlNUY8HtG2hs";
  static ACCESS_TOKEN = "_access_token";
  static CODE_VERIFIER = "_code_verifier";
  static CLIENT_ID = "_clientId";
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

export function displayButton(buttonName, hideButtonsOption){
  const button = hideButtonsOption?.find((element) => element.name == buttonName);
  if (button){
    return button.checked;
  }
  //if no option was found, display the button
  return true;
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
   * Get the cache period in days from localStorage
   * @returns {number} Cache period in days (default: 7)
   */
  static getCachePeriodDays() {
    const cachePeriod = localStorage.getItem("cachePeriodDays");
    if (cachePeriod === null || cachePeriod === undefined) {
      return 7; // Default to 7 days
    }
    const days = parseInt(cachePeriod, 10);
    return isNaN(days) || days < 1 ? 7 : days;
  }

  /**
   * Check if a cache entry is still valid
   * @param {Object} cacheEntry - Cache entry with data and timestamp
   * @param {number} cacheDays - Number of days the cache should be valid
   * @returns {boolean} True if cache is valid, false if expired
   */
  static isCacheValid(cacheEntry, cacheDays) {
    if (!cacheEntry || !cacheEntry.timestamp) {
      return false;
    }
    const now = Date.now();
    const cacheAge = now - cacheEntry.timestamp;
    const maxAge = cacheDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    return cacheAge < maxAge;
  }

  /**
   * Get cached data if valid, null if expired or missing
   * @param {string} cacheKey - Unique key for the cached data
   * @param {string} sfHost - Salesforce host (for scoping cache per org)
   * @returns {Object|null} Cached data if valid, null otherwise
   */
  static getCachedData(cacheKey, sfHost) {
    const storageKey = `${sfHost}_cache_${cacheKey}`;
    const cached = localStorage.getItem(storageKey);

    if (!cached) {
      return null;
    }

    try {
      const cacheEntry = JSON.parse(cached);
      const cacheDays = this.getCachePeriodDays();

      if (this.isCacheValid(cacheEntry, cacheDays)) {
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
   * Store data in cache with current timestamp
   * @param {string} cacheKey - Unique key for the cached data
   * @param {string} sfHost - Salesforce host (for scoping cache per org)
   * @param {*} data - Any JSON-serializable data to cache
   */
  static setCachedData(cacheKey, sfHost, data) {
    const storageKey = `${sfHost}_cache_${cacheKey}`;
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(cacheEntry));
    } catch (e) {
      console.error(`Error storing cache entry for ${cacheKey}:`, e);
    }
  }

  /**
   * Clear a specific cache entry
   * @param {string} cacheKey - Unique key for the cached data
   * @param {string} sfHost - Salesforce host (for scoping cache per org)
   */
  static clearCache(cacheKey, sfHost) {
    const storageKey = `${sfHost}_cache_${cacheKey}`;
    localStorage.removeItem(storageKey);
  }

  /**
   * Clear all cache entries for a specific host
   * @param {string} sfHost - Salesforce host
   */
  static clearAllCache(sfHost) {
    const prefix = `${sfHost}_cache_`;
    const keysToRemove = [];

    // Collect all keys that match the pattern
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    // Remove all matching keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}
