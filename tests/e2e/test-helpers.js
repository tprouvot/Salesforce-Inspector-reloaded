/**
 * Shared test utilities for E2E tests
 * Contains common mocks, helpers, and setup functions
 */

// Test constants are loaded from test-constants.local.js (gitignored).
// If the file does not exist, the template (mock mode) is copied automatically.
// To configure for a real org, run: npm run set-test-constants
// Or copy test-constants.template.js to test-constants.local.js and fill in real values.
const _fs = require("fs");
const _path = require("path");
const _localPath = _path.join(__dirname, "test-constants.local.js");
if (!_fs.existsSync(_localPath)) {

  console.warn("test-constants.local.js not found, copying template (mock mode).");

  console.warn("Run 'npm run set-test-constants' to configure for a real org.\n");
  _fs.copyFileSync(_path.join(__dirname, "test-constants.template.js"), _localPath);
}

export {TEST_CONSTANTS} from "./test-constants.local.js";

/**
 * Generates a unique GUID that can be reused across all tests
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (RFC 4122 version 4)
 * @returns {string} A unique GUID string
 */
export function generateTestGuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

/**
 * A pre-generated GUID that can be reused across all tests in a test run
 * This ensures consistency when the same GUID is needed across multiple test files
 */
export const TEST_GUID = generateTestGuid();

/**
 * Injects fake session data into localStorage
 * @param {Object} context - Playwright browser context
 * @param {Object} options - Options object
 * @param {string} options.host - Salesforce host
 * @param {string} options.token - Access token
 * @param {string} options.version - API version
 * @param {Object} options.additionalSetup - Additional setup function to run
 */
export async function injectSessionData(context, {host, token, version, additionalSetup = null}) {
  // Define the init script function once to avoid duplication
  const initScriptFunction = ({host, token, version, additionalSetup}) => {
    try {
      // Check if localStorage is available (may not be in some contexts)
      if (typeof Storage !== "undefined" && window.localStorage) {
        const keyPrefix = host;
        window.localStorage.setItem(keyPrefix + "_access_token", token);
        window.localStorage.setItem(keyPrefix + "_isSandbox", "true");
        window.localStorage.setItem(keyPrefix + "_orgInstance", "FRA12S");
        window.localStorage.setItem(keyPrefix + "_trialExpirationDate", "2026-01-01");
        window.localStorage.setItem("apiVersion", version);
      }
    } catch (e) {
      // localStorage might not be accessible in this context, continue anyway
      console.warn("localStorage access failed:", e.message);
    }

    // Run additional setup if provided
    if (additionalSetup && typeof additionalSetup === "function") {
      additionalSetup();
    }
  };

  try {
    // In headless mode with persistent contexts, ensure context is ready before adding init script
    // Wait a bit for the context to be fully initialized
    await new Promise(resolve => setTimeout(resolve, 50));

    // Add init script for future pages
    await context.addInitScript(initScriptFunction, {host, token, version, additionalSetup});
  } catch (error) {
    // If addInitScript fails (can happen in headless mode), we'll apply directly to pages
    console.warn(`addInitScript failed, will apply directly to pages: ${error.message}`);
  }

  // Apply init script to existing pages (important for persistent contexts in headless mode)
  // This ensures the script runs even if addInitScript had issues
  const pages = context.pages();
  if (pages.length > 0) {
    for (const page of pages) {
      try {
        // Check if page is still attached and ready
        if (!page.isClosed()) {
          await page.evaluate(initScriptFunction, {host, token, version, additionalSetup});
        }
      } catch {
        // Page might not be ready yet or might be closed, ignore errors
        // This is expected for some pages in headless mode
      }
    }
  }
}

/**
 * Creates a success response helper for route mocking
 */
export function createSuccessResponse(body = {}, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}

/**
 * Creates a SOAP success response helper for route mocking
 */
export function createSoapSuccessResponse(soapBody) {
  return {
    status: 200,
    contentType: "text/xml",
    body: soapBody
  };
}

/**
 * Helper function to fulfill a route with success response
 * This ensures proper async handling and avoids lint errors
 */
export async function fulfillSuccess(route, body = {}, status = 200) {
  await route.fulfill(createSuccessResponse(body, status));
}

/**
 * Helper function to fulfill a route with SOAP success response
 * This ensures proper async handling and avoids lint errors
 */
export async function fulfillSoapSuccess(route, soapBody) {
  await route.fulfill(createSoapSuccessResponse(soapBody));
}

/**
 * Sets up model exposure for pages that use insextTestLoaded
 * This function is meant to be passed as additionalSetup to injectSessionData
 * @returns {Function} A function that sets up model exposure in the browser context
 */
export function createModelExposureSetup() {
  return function() {
    // Prevent flow-scanner.js from initializing when imported by options.js
    // The flow-scanner.js module has a top-level initialization block that runs on import
    // We temporarily hide/rename the root element so flow-scanner.js can't find it
    if (window.location.pathname.includes("options.html")) {
      // Store original root element
      const originalRoot = document.getElementById("root");
      if (originalRoot) {
        // Temporarily rename the id so flow-scanner.js can't find it
        originalRoot.id = "root-hidden";

        // Restore it after a short delay (after flow-scanner.js initialization block runs)
        setTimeout(() => {
          const hiddenRoot = document.getElementById("root-hidden");
          if (hiddenRoot) {
            hiddenRoot.id = "root";
          }
        }, 100);
      }

      // Also patch ReactDOM.render as a backup
      const checkAndPatch = () => {
        if (window.ReactDOM && window.ReactDOM.render) {
          const originalRender = window.ReactDOM.render;
          window.ReactDOM.render = function(...args) {
            const component = args[0];
            const root = args[1];

            // Check if component has model prop (options.js) or not (flow-scanner.js)
            const hasModelProp = component && component.props && component.props.model;

            // Prevent flow-scanner.js render (no model prop)
            if (!hasModelProp && root && root.id === "root") {
              console.log("[Test] Prevented flow-scanner.js initialization render");
              return null;
            }

            return originalRender.apply(this, args);
          };
        } else {
          // ReactDOM not loaded yet, check again
          setTimeout(checkAndPatch, 10);
        }
      };
      checkAndPatch();
    }
  };
}

/**
 * Waits for the spinner to finish
 * @param {Object} page - Playwright page object
 */
export async function waitForSpinner(page, _timeout = 10000) {
  await page.waitForFunction(() => {
    const spinner = document.querySelector(".slds-spinner");
    return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
  }, {timeout: 10000});
}

/**
 * Pastes data into a textarea element
 * @param {Object} page - Playwright page object
 * @param {string} itemSelector - Selector for the textarea element
 * @param {string} rawData - Raw data to paste
 */
export async function pasteData(page, itemSelector, rawData) {
  // Focus the textarea first
  const item = page.locator(itemSelector);
  await item.focus();

  // Trigger paste event with clipboardData to call onDataPaste handler
  await page.evaluate(({itemSelector, data}) => {
    const textarea = document.querySelector(itemSelector);
    if (!textarea) return;

    // Create a paste event with mock clipboardData
    const event = new Event("paste", {bubbles: true, cancelable: true});

    // Create clipboardData object that matches the ClipboardEvent interface
    const clipboardDataObj = {
      getData(type) {
        return type === "text/plain" ? data : "";
      },
      items: [],
      types: ["text/plain"]
    };

    // Attach clipboardData to the event
    Object.defineProperty(event, "clipboardData", {
      value: clipboardDataObj,
      enumerable: true
    });

    // Also set target to textarea
    Object.defineProperty(event, "target", {
      value: textarea,
      enumerable: true
    });

    // Dispatch the event
    textarea.dispatchEvent(event);
  }, {itemSelector, data: rawData});
}

/**
 * Global response tracker that maintains response queues per page
 * This allows tracking responses that complete before waitSuccessfulHttpResponse is called
 */
const responseTracker = new Map();

/**
 * Helper function to check if a URL matches the urlPart
 * Handles encoding differences and partial matches
 * @param {string} responseUrl - The response URL to check
 * @param {string} searchPart - The URL part to search for
 * @returns {boolean} True if the URL matches
 */
function urlMatches(responseUrl, searchPart) {
  try {
    // Try exact match first
    if (responseUrl.includes(searchPart)) {
      return true;
    }

    // Try normalized comparison (decode both)
    const normalizedResponse = decodeURIComponent(responseUrl);
    const normalizedSearch = decodeURIComponent(searchPart);
    if (normalizedResponse.includes(normalizedSearch)) {
      return true;
    }

    // Try matching just the path part (ignore protocol/host)
    const responsePath = responseUrl.split("?")[0]; // Get path without query
    const searchPath = searchPart.split("?")[0];
    if (responsePath.includes(searchPath) || searchPath.includes(responsePath)) {
      // If paths match, check if query params are similar
      const responseQuery = responseUrl.includes("?") ? responseUrl.split("?")[1] : "";
      const searchQuery = searchPart.includes("?") ? searchPart.split("?")[1] : "";
      if (!searchQuery || responseQuery.includes(searchQuery) || searchQuery.includes(responseQuery)) {
        return true;
      }
    }

    return false;
  } catch {
    // Fallback to simple includes
    return responseUrl.includes(searchPart);
  }
}

/**
 * Initializes response tracking for a page
 * This should be called early (e.g., in beforeEach) to start tracking responses
 * @param {Object} page - Playwright page object
 */
export function initializeResponseTracking(page) {
  // Skip if already tracking this page
  if (responseTracker.has(page)) {
    return;
  }

  const tracker = {
    responses: [],
    resolvers: new Map(), // Map of urlPart -> resolver functions
    unauthorizedResponses: [], // Track 401 responses
    handler: null
  };

  // Set up a global response handler for this page
  tracker.handler = async (response) => {
    try {
      const url = response.url();
      const status = response.status();

      // Check for 401 Unauthorized responses
      if (status === 401) {
        tracker.unauthorizedResponses.push(response);

        // Try to get response body for detailed error info
        let responseBody = "";
        let errorDetails = {};
        try {
          responseBody = await response.text();
          try {
            errorDetails = JSON.parse(responseBody);
          } catch {
            // Response body is not JSON, use as-is
            errorDetails = {rawBody: responseBody};
          }
        } catch {
          // Could not read response body
          errorDetails = {error: "Could not read response body"};
        }

        // Log detailed 401 information to console
        console.error("❌ HTTP 401 Unauthorized detected!", "URL:", url, "Status:", status);

        // Store error details for test failure message
        response._unauthorizedDetails = {
          url,
          status,
          statusText: response.statusText(),
          headers: response.headers(),
          body: errorDetails
        };
      }

      // Store all successful responses
      if (status >= 200 && status < 400) {
        tracker.responses.push(response);

        // Check if any waiting resolvers match this response
        for (const [urlPart, resolver] of tracker.resolvers.entries()) {
          try {
            // Use the same matching logic as checkTracker
            if (urlMatches(url, urlPart)) {
              resolver(response);
              tracker.resolvers.delete(urlPart);
            }
          } catch {
            // Fallback to simple includes if matching fails
            if (url.includes(urlPart)) {
              resolver(response);
              tracker.resolvers.delete(urlPart);
            }
          }
        }
      }
    } catch {
      // Ignore errors (response might be disposed)
    }
  };

  // Start tracking responses immediately
  page.on("response", tracker.handler);

  // Clean up when page closes
  page.once("close", () => {
    responseTracker.delete(page);
  });

  responseTracker.set(page, tracker);
}

/**
 * Cleans up response tracking for a page
 * @param {Object} page - Playwright page object
 */
export function cleanupResponseTracking(page) {
  const tracker = responseTracker.get(page);
  if (tracker && tracker.handler) {
    page.off("response", tracker.handler);
    responseTracker.delete(page);
  }
}

/**
 * @description Waits for a successful HTTP response from the given Salesforce host
 * This function handles both responses that have already completed and responses that are in-flight
 * by checking a global response tracker that starts tracking as soon as the page is available
 * @param {*} page - Playwright page object
 * @param {*} urlPart - Salesforce host or part of the url to wait for
 * @param {*} timeout - Optional timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>} A promise that resolves to the response
 * @throws {Error} Throws an error if a 401 Unauthorized response is detected
 */
export async function waitSuccessfulHttpResponse(page, urlPart, timeout = 30000) {
  // Ensure tracking is initialized for this page
  if (!responseTracker.has(page)) {
    initializeResponseTracking(page);
  }

  const tracker = responseTracker.get(page);

  // Helper function to check for 401 responses matching the urlPart
  const checkForUnauthorized = () => {
    if (tracker.unauthorizedResponses.length > 0) {
      const matchingUnauthorized = tracker.unauthorizedResponses.find(r => {
        try {
          const responseUrl = r.url();
          return urlMatches(responseUrl, urlPart);
        } catch {
          return false;
        }
      });
      return matchingUnauthorized;
    }
    return null;
  };

  const checkTracker = () => {
    if (tracker.responses.length > 0) {
      const matchingResponse = tracker.responses.find(r => {
        try {
          const responseUrl = r.url();
          const matches = urlMatches(responseUrl, urlPart) && r.status() >= 200 && r.status() < 400;
          return matches;
        } catch {
          return false;
        }
      });
      return matchingResponse;
    }
    return null;
  };

  // Check for existing 401 responses before waiting
  const existingUnauthorized = checkForUnauthorized();
  if (existingUnauthorized) {
    const details = existingUnauthorized._unauthorizedDetails || {
      url: existingUnauthorized.url(),
      status: 401,
      statusText: existingUnauthorized.statusText(),
      headers: existingUnauthorized.headers(),
      body: {}
    };

    const errorMessage = `HTTP 401 Unauthorized detected for URL matching "${urlPart}"\n`
      + `URL: ${details.url}\n`
      + `Status: ${details.status} ${details.statusText}\n`
      + `Response Body: ${JSON.stringify(details.body, null, 2)}`;

    throw new Error(errorMessage);
  }

  // Declare variables outside try block so they're accessible in catch
  let trackerResolver = null;
  let timeoutId = null;
  let unauthorizedCheckInterval = null;
  let unauthorizedHandler = null;

  try {
    // First, check if we already have a matching response in the tracker
    // This handles responses that completed before this function was called
    const existingResponse = checkTracker();
    if (existingResponse) {
      return existingResponse;
    }

    // Create promise that resolves when tracker gets a matching response
    // Add timeout to prevent hanging indefinitely

    const trackerPromise = new Promise((resolve, reject) => {
      // Check again in case response arrived between checkTracker and this promise
      const existing = checkTracker();
      if (existing) {
        resolve(existing);
        return;
      }

      // Store resolver so handler can resolve when matching response arrives
      trackerResolver = resolve;
      tracker.resolvers.set(urlPart, resolve);

      // Set up periodic check for 401 responses
      unauthorizedCheckInterval = setInterval(() => {
        const unauthorized = checkForUnauthorized();
        if (unauthorized) {
          const details = unauthorized._unauthorizedDetails || {
            url: unauthorized.url(),
            status: 401,
            statusText: unauthorized.statusText(),
            headers: unauthorized.headers(),
            body: {}
          };

          const errorMessage = `HTTP 401 Unauthorized detected for URL matching "${urlPart}"\n`
            + `URL: ${details.url}\n`
            + `Status: ${details.status} ${details.statusText}\n`
            + `Response Body: ${JSON.stringify(details.body, null, 2)}`;

          clearInterval(unauthorizedCheckInterval);
          if (tracker.resolvers.has(urlPart) && tracker.resolvers.get(urlPart) === resolve) {
            tracker.resolvers.delete(urlPart);
          }
          reject(new Error(errorMessage));
        }
      }, 100); // Check every 100ms for 401 responses

      // Set timeout to prevent hanging - reject if no response comes
      // This ensures Promise.race doesn't hang if waitForResponse also fails
      timeoutId = setTimeout(() => {
        if (unauthorizedCheckInterval) {
          clearInterval(unauthorizedCheckInterval);
        }
        if (tracker.resolvers.has(urlPart) && tracker.resolvers.get(urlPart) === resolve) {
          tracker.resolvers.delete(urlPart);
          // Reject with timeout error - waitForResponse will handle the actual timeout
          reject(new Error(`Timeout waiting for response matching: ${urlPart}`));
        }
      }, timeout + 100); // Slightly longer than waitForResponse timeout to let it handle timeout first
    });

    // Create promise that rejects on 401 responses
    const unauthorizedPromise = new Promise((resolve, reject) => {
      // Set up a one-time response listener for 401s
      unauthorizedHandler = async (response) => {
        try {
          const url = response.url();
          const status = response.status();
          if (status === 401 && urlMatches(url, urlPart)) {
            let responseBody = "";
            let errorDetails = {};
            try {
              responseBody = await response.text();
              try {
                errorDetails = JSON.parse(responseBody);
              } catch {
                errorDetails = {rawBody: responseBody};
              }
            } catch {
              errorDetails = {error: "Could not read response body"};
            }

            const errorMessage = `HTTP 401 Unauthorized detected for URL matching "${urlPart}"\n`
              + `URL: ${url}\n`
              + `Status: ${status} ${response.statusText()}\n`
              + `Response Body: ${JSON.stringify(errorDetails, null, 2)}`;

            page.off("response", unauthorizedHandler);
            reject(new Error(errorMessage));
          }
        } catch {
          // Ignore errors
        }
      };

      page.on("response", unauthorizedHandler);
      // Note: Handler cleanup is done in the main cleanup section
    });

    // Race between tracker check, waitForResponse, and unauthorized detection
    // waitForResponse catches in-flight and future requests
    // trackerPromise catches responses that complete during setup or before this call
    // unauthorizedPromise fails immediately if a 401 is detected
    const response = await Promise.race([
      trackerPromise,
      unauthorizedPromise.catch(error => {
        // Clean up interval and handler if unauthorized was detected
        if (unauthorizedCheckInterval) {
          clearInterval(unauthorizedCheckInterval);
        }
        if (unauthorizedHandler) {
          page.off("response", unauthorizedHandler);
        }
        throw error;
      }),
      page.waitForResponse(
        async response => {
          try {
            const url = response.url();
            const status = response.status();

            // Fail immediately if we see a 401 matching our urlPart
            if (status === 401 && urlMatches(url, urlPart)) {
              let responseBody = "";
              let errorDetails = {};
              try {
                responseBody = await response.text();
                try {
                  errorDetails = JSON.parse(responseBody);
                } catch {
                  errorDetails = {rawBody: responseBody};
                }
              } catch {
                errorDetails = {error: "Could not read response body"};
              }

              const errorMessage = `HTTP 401 Unauthorized detected for URL matching "${urlPart}"\n`
                + `URL: ${url}\n`
                + `Status: ${status} ${response.statusText()}\n`
                + `Response Body: ${JSON.stringify(errorDetails, null, 2)}`;

              throw new Error(errorMessage);
            }

            return urlMatches(url, urlPart) && status >= 200 && status < 400;
          } catch (e) {
            // If it's our 401 error, rethrow it
            if (e.message && e.message.includes("401 Unauthorized")) {
              throw e;
            }
            return false;
          }
        },
        {timeout}
      )
    ]);

    // Cleanup resolver, interval, timeout, and handler
    if (unauthorizedCheckInterval) {
      clearInterval(unauthorizedCheckInterval);
    }
    if (unauthorizedHandler) {
      page.off("response", unauthorizedHandler);
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (trackerResolver && tracker.resolvers.get(urlPart) === trackerResolver) {
      tracker.resolvers.delete(urlPart);
    }
    return response;
  } catch (error) {
    // Cleanup resolver, interval, timeout, and handler
    if (unauthorizedCheckInterval) {
      clearInterval(unauthorizedCheckInterval);
    }
    if (unauthorizedHandler) {
      page.off("response", unauthorizedHandler);
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (tracker.resolvers.has(urlPart)) {
      tracker.resolvers.delete(urlPart);
    }

    // Final check of tracker in case response arrived during error handling
    const matchingResponse = checkTracker();
    if (matchingResponse) {
      return matchingResponse;
    }

    throw error;
  }
}
