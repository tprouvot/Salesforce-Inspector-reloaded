/**
 * Shared test utilities for E2E tests
 * Contains common mocks, helpers, and setup functions
 */

// Common test constants
export const TEST_CONSTANTS = {
  mockHost: "mock-host.salesforce.com",
  mockToken: "mock-access-token",
  apiVersion: "65.0"
};

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
  await context.addInitScript(({host, token, version, additionalSetup}) => {
    const keyPrefix = host;
    window.localStorage.setItem(keyPrefix + "_access_token", token);
    window.localStorage.setItem(keyPrefix + "_isSandbox", "true");
    window.localStorage.setItem(keyPrefix + "_orgInstance", "NA1");
    window.localStorage.setItem("apiVersion", version);

    // Enable unit test mode for clipboard interception
    window.isUnitTest = true;
    window.testClipboardValue = null;

    // Run additional setup if provided
    if (additionalSetup && typeof additionalSetup === "function") {
      additionalSetup();
    }
  }, {host, token, version, additionalSetup});
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

    // Set up handler to capture model when page calls parent.insextTestLoaded({model})
    // For pages that check parent.isUnitTest (like options.js), we need to set up parent as well
    if (window.parent === window) {
      // Not in an iframe, so parent is the same as window
      window.parent.isUnitTest = true;
      window.parent.insextTestLoaded = function(result) {
        // Handle both {model} and {sfConn} cases
        if (result.model) {
          window.insextTestModel = result.model;
        }
        if (result.sfConn) {
          window.insextTestSfConn = result.sfConn;
        }
      };
    } else {
      // In an iframe, parent is different
      window.parent.isUnitTest = true;
      window.parent.insextTestLoaded = function(result) {
        // Handle both {model} and {sfConn} cases
        if (result.model) {
          window.insextTestModel = result.model;
        }
        if (result.sfConn) {
          window.insextTestSfConn = result.sfConn;
        }
      };
    }
    // Also set up window.insextTestLoaded for compatibility
    window.insextTestLoaded = function(result) {
      if (result.model) {
        window.insextTestModel = result.model;
      }
      if (result.sfConn) {
        window.insextTestSfConn = result.sfConn;
      }
    };
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

