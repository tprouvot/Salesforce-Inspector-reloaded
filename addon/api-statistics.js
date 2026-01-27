/**
 * API Debug Statistics Module
 * Tracks API calls made to Salesforce server when debug mode is enabled
 */
import {Constants} from "./utils.js";

export class ApiStatistics {
  constructor() {
    this.stats = {
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
      startTime: Date.now()
    };
    this.loadStats();
  }

  /**
   * Check if debug mode is enabled
   * @returns {boolean}
   */
  static isDebugModeEnabled() {
    return localStorage.getItem(Constants.API_DEBUG_STATISTICS_MODE) === "true";
  }

  /**
   * Load statistics from localStorage
   */
  loadStats() {
    const stored = localStorage.getItem(Constants.API_DEBUG_STATISTICS);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Ensure backward compatibility - initialize calls arrays if missing
        if (parsed.rest && parsed.rest.byEndpoint) {
          Object.keys(parsed.rest.byEndpoint).forEach(endpoint => {
            if (!parsed.rest.byEndpoint[endpoint].calls) {
              parsed.rest.byEndpoint[endpoint].calls = [];
            }
          });
        }
        if (parsed.soap && parsed.soap.byMethod) {
          Object.keys(parsed.soap.byMethod).forEach(method => {
            if (!parsed.soap.byMethod[method].calls) {
              parsed.soap.byMethod[method].calls = [];
            }
          });
        }
        this.stats = {
          ...this.stats,
          ...parsed,
          startTime: parsed.startTime || Date.now()
        };
      } catch (e) {
        console.error("Error loading API debug statistics:", e);
      }
    }
  }

  /**
   * Save statistics to localStorage
   * @param {Object} stats - Optional stats object to save. If not provided, uses this.stats
   */
  saveStats(stats = null) {
    try {
      const statsToSave = stats || this.stats;
      localStorage.setItem(Constants.API_DEBUG_STATISTICS, JSON.stringify(statsToSave));
      // Update instance stats for consistency
      if (stats) {
        this.stats = stats;
      }
    } catch (e) {
      console.error("Error saving API debug statistics:", e);
    }
  }

  /** @description Initialize the stats object from the localStorage
   * @param {string} mode - 'rest' or 'soap'
   * @param {string} url - URL of the call
   * @param {string} method - Method name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} isError - Whether the call resulted in an error
  */
  trackApiCall(mode, url, method, duration, isError = false){
    if (!ApiStatistics.isDebugModeEnabled()) {
      return;
    }

    // Load current stats from localStorage to ensure synchronization across instances
    const stored = localStorage.getItem(Constants.API_DEBUG_STATISTICS);
    let stats;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        stats = {
          rest: {
            total: parsed.rest?.total || 0,
            byMethod: parsed.rest?.byMethod || {},
            byEndpoint: parsed.rest?.byEndpoint || {},
            errors: parsed.rest?.errors || 0,
            totalDuration: parsed.rest?.totalDuration || 0
          },
          soap: {
            total: parsed.soap?.total || 0,
            byMethod: parsed.soap?.byMethod || {},
            errors: parsed.soap?.errors || 0,
            totalDuration: parsed.soap?.totalDuration || 0
          },
          startTime: parsed.startTime || Date.now()
        };
      } catch (e) {
        console.error("Error loading API debug statistics:", e);
        stats = this._getDefaultStats();
      }
    } else {
      stats = this._getDefaultStats();
    }

    this.handleStatsUpdates(mode, stats[mode], url, method, duration, isError);
    this.saveStats(stats);
  }

  handleStatsUpdates(mode, statsType, url, method, duration, isError){
    const timestamp = Date.now();
    statsType.total++;
    statsType.totalDuration += duration;

    // Track by endpoint (simplified URL)
    if (url && statsType.byEndpoint) {
      const endpoint = this.simplifyUrl(url);
      //initialize the endpoint if it doesn't exist
      if (!statsType.byEndpoint[endpoint]) {
        statsType.byEndpoint[endpoint] = {
          count: 0,
          totalDuration: 0,
          errors: 0
        };
      }
      statsType.byEndpoint[endpoint].count++;
      statsType.byEndpoint[endpoint].totalDuration += duration;

      if (isError) {
        statsType.byEndpoint[endpoint].errors++;
      }
    }

    // Track by method
    if (statsType.byMethod){
      //initialize the method if it doesn't exist
      if (!statsType.byMethod[method]) {
        // Track by method (object with count, totalDuration, errors)
        statsType.byMethod[method] = {
          count: 0,
          totalDuration: 0,
          errors: 0
        };
      }
      statsType.byMethod[method].count++;
      statsType.byMethod[method].totalDuration += duration;

      if (isError) {
        statsType.byMethod[method].errors++;
      }
    }

    // Track total errors
    if (isError) {
      statsType.errors++;
    }
  }

  /**
   * Get default stats structure
   * @private
   * @returns {Object} Default stats object
   */
  _getDefaultStats() {
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
      startTime: Date.now()
    };
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

      // Replace version numbers
      //simplified = simplified.replace(/\/v\d+\.\d+\//g, "/v{version}/");

      // For query URLs with IDs after the last slash, remove everything after the last /
      // Example: /services/data/v{version}/query/{id}-2000 -> /services/data/v{version}/query/
      if (simplified.includes("/query/")) {
        const queryIndex = simplified.indexOf("/query/");
        simplified = simplified.substring(0, queryIndex + "/query/".length);
      }

      // Replace IDs with placeholders (18-char Salesforce IDs) for other cases
      simplified = simplified.replace(/[a-zA-Z0-9]{18}/g, "{id}");

      return simplified;
    } catch (e) {
      return url;
    }
  }

  /**
   * Get current statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    //retrieve stats in the localStorage
    this.getStatsFromLocalStorage();

    const sessionDuration = Date.now() - this.stats.startTime;
    const sessionDurationMinutes = Math.floor(sessionDuration / 60000);

    return {
      ...this.stats,
      sessionDuration,
      sessionDurationMinutes,
      rest: {
        ...this.stats.rest,
        averageDuration: this.stats.rest.total > 0
          ? Math.round(this.stats.rest.totalDuration / this.stats.rest.total)
          : 0
      },
      soap: {
        ...this.stats.soap,
        averageDuration: this.stats.soap.total > 0
          ? Math.round(this.stats.soap.totalDuration / this.stats.soap.total)
          : 0
      },
      total: {
        calls: this.stats.rest.total + this.stats.soap.total,
        errors: this.stats.rest.errors + this.stats.soap.errors,
        duration: this.stats.rest.totalDuration + this.stats.soap.totalDuration
      }
    };
  }

  /** @description Get stats from localStorage */
  getStatsFromLocalStorage() {
    const stored = localStorage.getItem(Constants.API_DEBUG_STATISTICS);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.stats = parsed;
      } catch (e) {
        console.error("Error loading API debug statistics:", e);
        this.stats = this._getDefaultStats();
      }
    } else {
      this.stats = this._getDefaultStats();
    }
  }

  setStatsToLocalStorage(stats) {
    localStorage.setItem(Constants.API_DEBUG_STATISTICS, JSON.stringify(stats));
  }

  /**
   * Reset statistics
   */
  reset() {
    this.stats = {
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
      startTime: Date.now()
    };
    this.saveStats();
  }
}

// Singleton instance
export const apiStatistics = new ApiStatistics();
