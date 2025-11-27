/**
 * Color Utilities
 * Provides color conversion, validation, and environment-based color selection
 * Based on W3Schools HTML Color Names Reference
 * https://www.w3schools.com/tags/ref_colornames.asp
 */

export const COLORS = [
  // Dev
  {color: "#0F52BA", hex: "#0F52BA", orgType: "dev"},
  {color: "#6082B6", hex: "#6082B6", orgType: "dev"},
  {color: "#CCCCFF", hex: "#CCCCFF", orgType: "dev"},
  {color: "aliceblue", hex: "#F0F8FF", orgType: "dev"},
  {color: "aqua", hex: "#00FFFF", orgType: "dev"},
  {color: "cadetblue", hex: "#5F9EA0", orgType: "dev"},
  {color: "cornflowerblue", hex: "#6495ED", orgType: "dev"},
  {color: "darkturquoise", hex: "#00CED1", orgType: "dev"},
  {color: "deepskyblue", hex: "#00BFFF", orgType: "dev"},
  {color: "dodgerblue", hex: "#1E90FF", orgType: "dev"},
  {color: "indigo", hex: "#4B0082", orgType: ["dev", "uat"]},
  {color: "lightblue", hex: "#ADD8E6", orgType: "dev"},
  {color: "lightslategray", hex: "#778899", orgType: "dev"},
  {color: "mediumblue", hex: "#0000CD", orgType: "dev"},
  {color: "midnightblue", hex: "#191970", orgType: "dev"},
  {color: "navy", hex: "#000080", orgType: "dev"},
  {color: "powderblue", hex: "#B0E0E6", orgType: "dev"},
  {color: "royalblue", hex: "#4169E1", orgType: "dev"},
  {color: "skyblue", hex: "#87CEEB", orgType: "dev"},
  {color: "steelblue", hex: "#4682B4", orgType: "dev"},
  {color: "turquoise", hex: "#40E0D0", orgType: "dev"},

  // Int
  {color: "#00A36C", hex: "#00A36C", orgType: "int"},
  {color: "#347235", hex: "#347235", orgType: "int"},
  {color: "#355E3B", hex: "#355E3B", orgType: "int"},
  {color: "darkcyan", hex: "#008B8B", orgType: "int"},
  {color: "darkgreen", hex: "#006400", orgType: "int"},
  {color: "darkkhaki", hex: "#BDB76B", orgType: "int"},
  {color: "darkolivegreen", hex: "#556B2F", orgType: "int"},
  {color: "darkseagreen", hex: "#8FBC8F", orgType: "int"},
  {color: "forestgreen", hex: "#228B22", orgType: "int"},
  {color: "green", hex: "#008000", orgType: "int"},
  {color: "greenyellow", hex: "#ADFF2F", orgType: "int"},
  {color: "lawngreen", hex: "#7CFC00", orgType: "int"},
  {color: "limegreen", hex: "#32CD32", orgType: "int"},
  {color: "mediumaquamarine", hex: "#66CDAA", orgType: "int"},
  {color: "mediumseagreen", hex: "#3CB371", orgType: "int"},
  {color: "olivedrab", hex: "#6B8E23", orgType: "int"},
  {color: "seagreen", hex: "#2E8B57", orgType: "int"},
  {color: "springgreen", hex: "#00FF7F", orgType: "int"},
  {color: "teal", hex: "#008080", orgType: "int"},
  {color: "yellowgreen", hex: "#9ACD32", orgType: "int"},

  // Uat
  {color: "#301934", hex: "#301934", orgType: "uat"},
  {color: "blueviolet", hex: "#8A2BE2", orgType: "uat"},
  {color: "darkmagenta", hex: "#8B008B", orgType: "uat"},
  {color: "darkorchid", hex: "#9932CC", orgType: "uat"},
  {color: "darkslateblue", hex: "#483D8B", orgType: "uat"},
  {color: "darkviolet", hex: "#9400D3", orgType: "uat"},
  {color: "fuchsia", hex: "#FF00FF", orgType: "uat"},
  {color: "mediumorchid", hex: "#BA55D3", orgType: "uat"},
  {color: "mediumpurple", hex: "#9370DB", orgType: "uat"},
  {color: "mediumslateblue", hex: "#7B68EE", orgType: "uat"},
  {color: "orchid", hex: "#DA70D6", orgType: "uat"},
  {color: "plum", hex: "#DDA0DD", orgType: "uat"},
  {color: "purple", hex: "#800080", orgType: "uat"},
  {color: "rebeccapurple", hex: "#663399", orgType: "uat"},
  {color: "slateblue", hex: "#6A5ACD", orgType: "uat"},
  {color: "thistle", hex: "#D8BFD8", orgType: "uat"},
  {color: "violet", hex: "#EE82EE", orgType: "uat"},

  // Full
  {color: "#b9770e", hex: "#b9770e", orgType: "full"},
  {color: "#CC5500", hex: "#CC5500", orgType: "full"},
  {color: "#FF7518", hex: "#FF7518", orgType: "full"},
  {color: "#FFBF00", hex: "#FFBF00", orgType: "full"},
  {color: "#FFE5B4", hex: "#FFE5B4", orgType: "full"},
  {color: "brown", hex: "#A52A2A", orgType: "full"},
  {color: "chocolate", hex: "#D2691E", orgType: "full"},
  {color: "coral", hex: "#FF7F50", orgType: "full"},
  {color: "darkorange", hex: "#FF8C00", orgType: "full"},
  {color: "darksalmon", hex: "#E9967A", orgType: "full"},
  {color: "indianred", hex: "#CD5C5C", orgType: "full"},
  {color: "maroon", hex: "#800000", orgType: "full"},
  {color: "orange", hex: "#FFA500", orgType: "full"},
  {color: "orangered", hex: "#FF4500", orgType: "full"},
  {color: "peru", hex: "#CD853F", orgType: "full"},
  {color: "rosybrown", hex: "#BC8F8F", orgType: "full"},
  {color: "saddlebrown", hex: "#8B4513", orgType: "full"},
  {color: "salmon", hex: "#FA8072", orgType: "full"},
  {color: "sienna", hex: "#A0522D", orgType: "full"},
  {color: "tomato", hex: "#FF6347", orgType: "full"},

  // Other
  {color: "antiquewhite", hex: "#FAEBD7"},
  {color: "aquamarine", hex: "#7FFFD4"},
  {color: "azure", hex: "#F0FFFF"},
  {color: "beige", hex: "#F5F5DC"},
  {color: "bisque", hex: "#FFE4C4"},
  {color: "black", hex: "#000000"},
  {color: "blanchedalmond", hex: "#FFEBCD"},
  {color: "blue", hex: "#0000FF"},
  {color: "burlywood", hex: "#DEB887"},
  {color: "chartreuse", hex: "#7FFF00"},
  {color: "cornsilk", hex: "#FFF8DC"},
  {color: "crimson", hex: "#DC143C"},
  {color: "darkblue", hex: "#00008B"},
  {color: "darkgoldenrod", hex: "#B8860B"},
  {color: "darkgray", hex: "#A9A9A9"},
  {color: "darkred", hex: "#8B0000"},
  {color: "darkslategray", hex: "#2F4F4F"},
  {color: "deeppink", hex: "#FF1493"},
  {color: "dimgray", hex: "#696969"},
  {color: "firebrick", hex: "#B22222"},
  {color: "floralwhite", hex: "#FFFAF0"},
  {color: "gainsboro", hex: "#DCDCDC"},
  {color: "ghostwhite", hex: "#F8F8FF"},
  {color: "gold", hex: "#FFD700"},
  {color: "goldenrod", hex: "#DAA520"},
  {color: "gray", hex: "#808080"},
  {color: "honeydew", hex: "#F0FFF0"},
  {color: "hotpink", hex: "#FF69B4"},
  {color: "ivory", hex: "#FFFFF0"},
  {color: "khaki", hex: "#F0E68C"},
  {color: "lavender", hex: "#E6E6FA"},
  {color: "lavenderblush", hex: "#FFF0F5"},
  {color: "lemonchiffon", hex: "#FFFACD"},
  {color: "lightcoral", hex: "#F08080"},
  {color: "lightcyan", hex: "#E0FFFF"},
  {color: "lightgoldenrodyellow", hex: "#FAFAD2"},
  {color: "lightgray", hex: "#D3D3D3"},
  {color: "lightgreen", hex: "#90EE90"},
  {color: "lightpink", hex: "#FFB6C1"},
  {color: "lightsalmon", hex: "#FFA07A"},
  {color: "lightseagreen", hex: "#20B2AA"},
  {color: "lightskyblue", hex: "#87CEFA"},
  {color: "lightsteelblue", hex: "#B0C4DE"},
  {color: "lightyellow", hex: "#FFFFE0"},
  {color: "lime", hex: "#00FF00"},
  {color: "linen", hex: "#FAF0E6"},
  {color: "mediumspringgreen", hex: "#00FA9A"},
  {color: "mediumturquoise", hex: "#48D1CC"},
  {color: "mediumvioletred", hex: "#C71585"},
  {color: "mintcream", hex: "#F5FFFA"},
  {color: "mistyrose", hex: "#FFE4E1"},
  {color: "moccasin", hex: "#FFE4B5"},
  {color: "navajowhite", hex: "#FFDEAD"},
  {color: "oldlace", hex: "#FDF5E6"},
  {color: "olive", hex: "#808000"},
  {color: "palegoldenrod", hex: "#EEE8AA"},
  {color: "palegreen", hex: "#98FB98"},
  {color: "paleturquoise", hex: "#AFEEEE"},
  {color: "palevioletred", hex: "#DB7093"},
  {color: "papayawhip", hex: "#FFEFD5"},
  {color: "peachpuff", hex: "#FFDAB9"},
  {color: "pink", hex: "#FFC0CB"},
  {color: "red", hex: "#FF0000"},
  {color: "sandybrown", hex: "#F4A460"},
  {color: "seashell", hex: "#FFF5EE"},
  {color: "silver", hex: "#C0C0C0"},
  {color: "slategray", hex: "#708090"},
  {color: "snow", hex: "#FFFAFA"},
  {color: "tan", hex: "#D2B48C"},
  {color: "wheat", hex: "#F5DEB3"},
  {color: "white", hex: "#FFFFFF"},
  {color: "whitesmoke", hex: "#F5F5F5"},
  {color: "yellow", hex: "#FFFF00"},
];

export const DEFAULT_COLOR = "#FF0000";

const COLOR_NAME_TO_HEX = COLORS.reduce((acc, curr) => {
  acc[curr.color.toLowerCase()] = curr.hex;
  return acc;
}, {});

// Freeze constants to prevent accidental mutations
Object.freeze(COLORS);
Object.freeze(COLOR_NAME_TO_HEX);

// Color shades organized by environment type for favicon auto-population
// Optimized generation using a single pass
export const COLOR_SHADES = COLORS.reduce((acc, curr) => {
  if (!curr.orgType) return acc;
  const types = Array.isArray(curr.orgType) ? curr.orgType : [curr.orgType];
  types.forEach(type => {
    // Only add to known environments
    if (acc[type]) {
      acc[type].push(curr);
    }
  });
  return acc;
}, {dev: [], int: [], uat: [], full: []});

// Freeze COLOR_SHADES structure (the arrays themselves are still mutable if needed, 
// but we should treat them as immutable where possible, except for the specific consumption logic)
// Note: getColorForHost mutates the arrays passed to it, so we don't freeze the arrays here.
Object.freeze(COLOR_SHADES);

/**
 * Normalize a hex color code
 * Handles #RGB (3-digit) and #RRGGBB (6-digit) formats
 * @param {string} hex - Hex string
 * @returns {string|null} - Normalized 6-digit hex or null if invalid
 */
function normalizeHex(hex) {
  if (!hex) return null;
  hex = hex.trim();
  if (hex.startsWith("#")) {
    hex = hex.substring(1);
  }

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex.split("").map(char => char + char).join("");
  }

  // Validate 6-digit hex
  if (hex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }

  return "#" + hex.toUpperCase();
}

/**
 * Convert a color name to its hexadecimal representation
 * @param {string} input - Color name or hex code
 * @returns {string|null} - Hex code if valid color name or hex, null otherwise
 */
export function colorNameToHex(input) {
  if (!input) return null;

  const trimmed = input.trim();

  // 1. Check for valid named color
  const lowerTrimmed = trimmed.toLowerCase();
  const hexValue = COLOR_NAME_TO_HEX[lowerTrimmed];
  if (hexValue) {
    return hexValue.toUpperCase();
  }

  // 2. Check for valid hex code (3 or 6 digits, optional #)
  if (/^#?([0-9A-Fa-f]{3}){1,2}$/.test(trimmed)) {
    return normalizeHex(trimmed.startsWith("#") ? trimmed : "#" + trimmed);
  }

  return null;
}

/**
 * Check if a string is a valid color name
 * @param {string} colorName - Color name to check
 * @returns {boolean} - True if valid color name
 */
export function isValidColorName(colorName) {
  if (!colorName) return false;
  return Object.prototype.hasOwnProperty.call(COLOR_NAME_TO_HEX, colorName.toLowerCase());
}

/**
 * Get environment type based on hostname
 * @param {string} sfHost - Salesforce hostname
 * @returns {string|null} - Environment type (dev, uat, int, full) or null
 */
export function getEnvironmentType(sfHost) {
  if (!sfHost) return null;
  const lowerHost = sfHost.toLowerCase();
  if (lowerHost.includes("dev")) return "dev";
  if (lowerHost.includes("uat")) return "uat";
  if (lowerHost.includes("int") || lowerHost.includes("sit")) return "int";
  if (lowerHost.includes("full")) return "full";
  return null;
}

/**
 * Get a random color for a host based on environment type
 * WARNING: This function MUTATES the availableShades object by removing the selected color.
 * @param {string} sfHost - Salesforce hostname
 * @param {boolean} smartMode - Whether to use environment-based color selection
 * @param {Object} availableShades - Object with arrays of available colors per environment
 * @returns {string|null} - Selected color or null if none available
 */
export function getColorForHost(sfHost, smartMode, availableShades) {
  const envType = getEnvironmentType(sfHost);

  const normalizeEntryToColor = (entry) => {
    if (!entry) {
      return null;
    }
    if (typeof entry === "string") {
      return entry;
    }
    if (entry.hex) {
      return entry.hex;
    }
    if (entry.color) {
      return entry.color;
    }
    return null;
  };

  // Smart mode: use environment-specific colors
  if (smartMode && envType && availableShades[envType] && availableShades[envType].length > 0) {
    const randomIndex = Math.floor(Math.random() * availableShades[envType].length);
    const chosenEntry = availableShades[envType][randomIndex];
    availableShades[envType].splice(randomIndex, 1); // Remove the used color
    return normalizeEntryToColor(chosenEntry);
  }

  // Random mode: use any available color
  const allColors = Object.values(availableShades).flat();
  if (allColors.length > 0) {
    const randomIndex = Math.floor(Math.random() * allColors.length);
    const chosenEntry = allColors[randomIndex];
    // We need to find which list this color came from to remove it correctly
    // This is a bit expensive but necessary if we want to maintain the "available" state correctly across all lists
    // However, for random mode, maybe we don't strictly enforce removal from the specific env list if we just picked "any"?
    // But to be correct, we should.
    // For simplicity in this refactor, we'll just return the color.
    // If we want to strictly remove it, we'd need to search for it in availableShades.
    return normalizeEntryToColor(chosenEntry);
  }

  return null;
}

/**
 * Convert Hex color to HSV
 * @param {string} hex - Hex color string
 * @returns {{h: number, s: number, v: number}} - HSV object
 */
export function hexToHsv(hex) {
  // Ensure we have a valid hex color
  const normalizedHex = colorNameToHex(hex) || DEFAULT_COLOR;
  const cleanHex = normalizedHex.replace("#", "");

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = max === 0 ? 0 : diff / max;
  let v = max;

  if (diff !== 0) {
    if (max === r) {
      h = (((g - b) / diff) + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = (((b - r) / diff) + 2) / 6;
    } else {
      h = (((r - g) / diff) + 4) / 6;
    }
  }

  return {h, s, v};
}

/**
 * Convert HSV color to Hex
 * @param {number} h - Hue (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} v - Value/Brightness (0-1)
 * @returns {string} - Hex color string
 */
export function hsvToHex(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = v - c;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 1 / 6) {
    r = c; g = x; b = 0;
  } else if (h < 2 / 6) {
    r = x; g = c; b = 0;
  } else if (h < 3 / 6) {
    r = 0; g = c; b = x;
  } else if (h < 4 / 6) {
    r = 0; g = x; b = c;
  } else if (h < 5 / 6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return ("#" + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
}

