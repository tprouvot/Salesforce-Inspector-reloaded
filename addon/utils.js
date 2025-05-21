import {sfConn, apiVersion} from "./inspector.js";

export class Constants {
  static PromptTemplateSOQL = "GenerateSOQL";
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
