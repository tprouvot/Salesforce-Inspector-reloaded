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

// Return inline style for the user-info span based on localStorage settings
export function getUserInfoSpanStyle(sfHost) {
  try {
    const fav = localStorage.getItem(sfHost + "_customFavicon");
    const colorize = localStorage.getItem("colorizeOptionsBanner") === "true";
    if (colorize && fav && !fav.startsWith("http")) {
      return {
        backgroundColor: fav,
        color: bestTextColorForBackground(fav),
        padding: "2px 6px",
        borderRadius: "4px",
      };
    }
    return {};
  } catch (e) {
    return {};
  }
}

// Decide whether black or white text is more readable on a given background color
function bestTextColorForBackground(colorString) {
  const rgb = toRGB(colorString);
  if (!rgb) {
    return "white";
  }
  const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b);
  // Bright backgrounds -> dark text; dark backgrounds -> white text
  return luminance > 0.5 ? "#000" : "#fff";
}

let __colorScratchEl;
function toRGB(colorString) {
  try {
    if (!__colorScratchEl) {
      __colorScratchEl = document.createElement("span");
      __colorScratchEl.style.display = "none";
      document.body.appendChild(__colorScratchEl);
    }
    __colorScratchEl.style.color = colorString;
    const cs = getComputedStyle(__colorScratchEl).color; // e.g., "rgb(255, 0, 0)" or "rgba(255, 0, 0, 1)"
    const match = cs.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) {
      return null;
    }
    return {r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10)};
  } catch (e) {
    return null;
  }
}

function relativeLuminance(r, g, b) {
  const sr = r / 255;
  const sg = g / 255;
  const sb = b / 255;
  const lin = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const R = lin(sr);
  const G = lin(sg);
  const B = lin(sb);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B; // 0 (black) .. 1 (white)
}
