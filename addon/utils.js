import {sfConn, apiVersion} from "./inspector.js";

export class Constants {
  static PromptTemplateSOQL = "GenerateSOQL";
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

// OAuth utilities
export function getBrowserType() {
  return navigator.userAgent?.includes("Chrome") ? "chrome" : "moz";
}

export function getExtensionId() {
  const extensionId = (typeof browser !== "undefined" ? browser : chrome).runtime.id;
  return extensionId;
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
