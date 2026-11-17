/**
 * API Debug Statistics Module
 * Tracks API calls made to Salesforce server when debug mode is enabled.
 * Statistics are stored per org in localStorage, so each org has its own counters.
 */
import {Constants} from "./utils.js";

const MAX_ERROR_MESSAGES = 10;

/**
 * localStorage key of an org's statistics
 * @param {string} sfHost - Org host the statistics belong to
 * @returns {string}
 */
function storageKey(sfHost) {
  return sfHost + "_" + Constants.API_DEBUG_STATISTICS;
}

// Statistics used to be stored under one global key, shared by all orgs. That data is
// no longer read, so it is removed the first time statistics are read. TODO: remove in a future release.
let legacyStatsRemoved = false;

/**
 * Get default stats structure
 * @returns {Object} Default stats object
 */
function getDefaultStats() {
  return {
    rest: {
      total: 0,
      byMethod: {},
      byEndpoint: {},
      errors: 0,
      totalDuration: 0
    },
    soap: {
      total: 0,
      byMethod: {},
      errors: 0,
      totalDuration: 0
    },
    startTime: Date.now(),
    errorMessages: []
  };
}

/**
 * Add a call to a count/totalDuration/errors bucket, creating the bucket if needed
 * @param {Object} buckets - byMethod or byEndpoint object
 * @param {string} key - Method or endpoint
 * @param {number} duration - Duration in milliseconds
 * @param {boolean} isError - Whether the call resulted in an error
 */
function recordInBucket(buckets, key, duration, isError) {
  const bucket = buckets[key] ??= {count: 0, totalDuration: 0, errors: 0};
  bucket.count++;
  bucket.totalDuration += duration;
  if (isError) {
    bucket.errors++;
  }
}

function averageDuration({total, totalDuration}) {
  return total > 0 ? Math.round(totalDuration / total) : 0;
}

export class ApiStatistics {
  /**
   * Check if debug mode is enabled
   * @returns {boolean}
   */
  static isDebugModeEnabled() {
    return localStorage.getItem(Constants.API_DEBUG_STATISTICS_MODE) === "true";
  }

  /**
   * Track an API call in the statistics of the org
   * @param {string} sfHost - Org host the call was made to
   * @param {string} mode - 'rest' or 'soap'
   * @param {string} url - URL of the call
   * @param {string} method - Method name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} isError - Whether the call resulted in an error
   * @param {string} errorMessage - Error message if isError is true
   */
  trackApiCall(sfHost, mode, url, method, duration, isError = false, errorMessage = null) {
    if (!ApiStatistics.isDebugModeEnabled()) {
      return;
    }

    // Read-modify-write on localStorage keeps all pages of the same org in sync
    const stats = this._readStats(sfHost);
    const modeStats = stats[mode];

    modeStats.total++;
    modeStats.totalDuration += duration;
    if (url && modeStats.byEndpoint) {
      recordInBucket(modeStats.byEndpoint, this.simplifyUrl(url), duration, isError);
    }
    recordInBucket(modeStats.byMethod, method, duration, isError);

    if (isError) {
      modeStats.errors++;
      if (errorMessage) {
        stats.errorMessages.push({timestamp: Date.now(), mode, url, method, message: errorMessage});
        stats.errorMessages = stats.errorMessages.slice(-MAX_ERROR_MESSAGES);
      }
    }
    this._writeStats(sfHost, stats);
  }

  /**
   * Simplify URL for grouping (remove query params, IDs, etc.)
   * @param {string} url - Full URL
   * @returns {string} Simplified URL pattern
   */
  simplifyUrl(url) {
    try {
      // Remove query parameters
      let simplified = url.split("?")[0];

      // For query URLs with IDs after the last slash, remove everything after the last /
      // Example: /services/data/v{version}/query/{id}-2000 -> /services/data/v{version}/query/
      if (simplified.includes("/query/")) {
        const queryIndex = simplified.indexOf("/query/");
        simplified = simplified.substring(0, queryIndex + "/query/".length);
      }

      // Replace IDs with placeholders (18-char Salesforce IDs) for other cases
      return simplified.replace(/[a-zA-Z0-9]{18}/g, "{id}");
    } catch {
      return url;
    }
  }

  /**
   * Get current statistics of the org
   * @param {string} sfHost - Org host the statistics belong to
   * @returns {Object} Statistics object
   */
  getStats(sfHost) {
    const stats = this._readStats(sfHost);
    const sessionDuration = Date.now() - stats.startTime;

    return {
      ...stats,
      sessionDuration,
      sessionDurationMinutes: Math.floor(sessionDuration / 60000),
      rest: {...stats.rest, averageDuration: averageDuration(stats.rest)},
      soap: {...stats.soap, averageDuration: averageDuration(stats.soap)},
      total: {
        calls: stats.rest.total + stats.soap.total,
        errors: stats.rest.errors + stats.soap.errors,
        duration: stats.rest.totalDuration + stats.soap.totalDuration
      }
    };
  }

  /**
   * Get the last error messages of the org
   * @param {string} sfHost - Org host the statistics belong to
   * @returns {Array} Array of error objects with timestamp, mode, url, method, and message
   */
  getLastErrors(sfHost) {
    return this._readStats(sfHost).errorMessages;
  }

  /**
   * Reset statistics of the org
   * @param {string} sfHost - Org host the statistics belong to
   */
  reset(sfHost) {
    this._writeStats(sfHost, getDefaultStats());
  }

  /**
   * Read the org's statistics from localStorage, filling in anything missing with defaults
   * @private
   */
  _readStats(sfHost) {
    if (!legacyStatsRemoved) {
      legacyStatsRemoved = true;
      localStorage.removeItem(Constants.API_DEBUG_STATISTICS);
    }
    const defaults = getDefaultStats();
    const stored = localStorage.getItem(storageKey(sfHost));
    if (!stored) {
      return defaults;
    }
    try {
      const parsed = JSON.parse(stored);
      return {
        ...defaults,
        ...parsed,
        rest: {...defaults.rest, ...parsed.rest},
        soap: {...defaults.soap, ...parsed.soap}
      };
    } catch (e) {
      console.error("Error loading API debug statistics:", e);
      return defaults;
    }
  }

  /**
   * Save the org's statistics to localStorage
   * @private
   */
  _writeStats(sfHost, stats) {
    try {
      localStorage.setItem(storageKey(sfHost), JSON.stringify(stats));
    } catch (e) {
      console.error("Error saving API debug statistics:", e);
    }
  }
}

// The class holds no state (everything lives in localStorage), so a plain instance is safe to share
export const apiStatistics = new ApiStatistics();
