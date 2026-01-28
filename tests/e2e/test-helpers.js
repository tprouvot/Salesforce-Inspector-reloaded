/**
 * Shared test utilities for E2E tests
 * Contains common mocks, helpers, and setup functions
 */

// Common test constants
export const TEST_CONSTANTS = {
  mockHost: "mock-host.salesforce.com",
  mockToken: "mock-access-token",
  apiVersion: "65.0",
  accountRecordId: "001000000000001AAA",
  mockEnabled: false
};

/**
 * Generates a unique GUID that can be reused across all tests
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (RFC 4122 version 4)
 * @returns {string} A unique GUID string
 */
export function generateTestGuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
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
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
      } catch (error) {
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
 * Creates a mock getUserInfo SOAP response
 * Note: getUserInfo is imported from utils.js, so we only need to mock it once
 */
export function createGetUserInfoSoapResponse() {
  return `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body>
        <getUserInfoResponse>
          <result>
            <userFullName>Test User</userFullName>
            <userName>test@example.com</userName>
            <organizationName>Test Org</organizationName>
          </result>
        </getUserInfoResponse>
      </soapenv:Body>
    </soapenv:Envelope>
  `;
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
 * Common route handler for getUserInfo SOAP calls
 * This should be used in all test files to avoid duplication
 * @returns {Promise<boolean>} - True if request was handled, false otherwise
 */
export async function handleGetUserInfoSoap(route, request) {
  const url = request.url();
  const method = request.method();

  if (url.includes("/services/Soap/") && method === "POST") {
    const requestBody = await request.postData();
    if (requestBody && requestBody.includes("getUserInfo")) {
      await route.fulfill(createSoapSuccessResponse(createGetUserInfoSoapResponse()));
      return true;
    }
  }
  return false; // Not handled, continue to next handler
}

/**
 * Sets up common route handlers that are used across multiple test files
 * @param {Object} route - Playwright route object
 * @param {Object} request - Playwright request object
 * @param {string} mockHost - Mock Salesforce host
 * @param {string} apiVersion - API version
 * @returns {boolean} - True if request was handled, false otherwise
 */
export async function setupCommonRouteHandlers(route, request, mockHost) {
  const url = request.url();

  if (!url.includes(mockHost)) {
    return false;
  }

  // Handle getUserInfo SOAP call (common across all tests)
  const getUserInfoHandled = await handleGetUserInfoSoap(route, request);
  if (getUserInfoHandled !== null) {
    return true;
  }

  return false; // Not handled by common handlers
}

/**
 * Waits for the spinner to finish
 * @param {Object} page - Playwright page object
 */
export async function waitForSpinner(page, timeout = 10000) {
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
    const event = new Event("paste", { bubbles: true, cancelable: true });
    
    // Create clipboardData object that matches the ClipboardEvent interface
    const clipboardDataObj = {
      getData: function(type) {
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
 * @description Waits for a successful HTTP response from the given Salesforce host
 * @param {*} page - Playwright page object 
 * @param {*} urlPart - Salesforce host or part of the url to wait for
 * @returns {Promise<Response>} A promise that resolves to the response
 */
export async function waitSuccessfulHttpResponse(page, urlPart) {
  return page.waitForResponse(response =>
    response.url().includes(urlPart) && (response.status() >= 200 || response.status() < 400)
  );
}