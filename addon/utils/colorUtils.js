/**
 * Color Utilities
 * Provides color conversion, validation, and environment-based color selection
 * Based on W3Schools HTML Color Names Reference
 * https://www.w3schools.com/tags/ref_colornames.asp
 */

const COLOR_NAME_TO_HEX = {
  "aliceblue": "#F0F8FF",
  "antiquewhite": "#FAEBD7",
  "aqua": "#00FFFF",
  "aquamarine": "#7FFFD4",
  "azure": "#F0FFFF",
  "beige": "#F5F5DC",
  "bisque": "#FFE4C4",
  "black": "#000000",
  "blanchedalmond": "#FFEBCD",
  "blue": "#0000FF",
  "blueviolet": "#8A2BE2",
  "brown": "#A52A2A",
  "burlywood": "#DEB887",
  "cadetblue": "#5F9EA0",
  "chartreuse": "#7FFF00",
  "chocolate": "#D2691E",
  "coral": "#FF7F50",
  "cornflowerblue": "#6495ED",
  "cornsilk": "#FFF8DC",
  "crimson": "#DC143C",
  "cyan": "#00FFFF",
  "darkblue": "#00008B",
  "darkcyan": "#008B8B",
  "darkgoldenrod": "#B8860B",
  "darkgray": "#A9A9A9",
  "darkgrey": "#A9A9A9",
  "darkgreen": "#006400",
  "darkkhaki": "#BDB76B",
  "darkmagenta": "#8B008B",
  "darkolivegreen": "#556B2F",
  "darkorange": "#FF8C00",
  "darkorchid": "#9932CC",
  "darkred": "#8B0000",
  "darksalmon": "#E9967A",
  "darkseagreen": "#8FBC8F",
  "darkslateblue": "#483D8B",
  "darkslategray": "#2F4F4F",
  "darkslategrey": "#2F4F4F",
  "darkturquoise": "#00CED1",
  "darkviolet": "#9400D3",
  "deeppink": "#FF1493",
  "deepskyblue": "#00BFFF",
  "dimgray": "#696969",
  "dimgrey": "#696969",
  "dodgerblue": "#1E90FF",
  "firebrick": "#B22222",
  "floralwhite": "#FFFAF0",
  "forestgreen": "#228B22",
  "fuchsia": "#FF00FF",
  "gainsboro": "#DCDCDC",
  "ghostwhite": "#F8F8FF",
  "gold": "#FFD700",
  "goldenrod": "#DAA520",
  "gray": "#808080",
  "grey": "#808080",
  "green": "#008000",
  "greenyellow": "#ADFF2F",
  "honeydew": "#F0FFF0",
  "hotpink": "#FF69B4",
  "indianred": "#CD5C5C",
  "indigo": "#4B0082",
  "ivory": "#FFFFF0",
  "khaki": "#F0E68C",
  "lavender": "#E6E6FA",
  "lavenderblush": "#FFF0F5",
  "lawngreen": "#7CFC00",
  "lemonchiffon": "#FFFACD",
  "lightblue": "#ADD8E6",
  "lightcoral": "#F08080",
  "lightcyan": "#E0FFFF",
  "lightgoldenrodyellow": "#FAFAD2",
  "lightgray": "#D3D3D3",
  "lightgrey": "#D3D3D3",
  "lightgreen": "#90EE90",
  "lightpink": "#FFB6C1",
  "lightsalmon": "#FFA07A",
  "lightseagreen": "#20B2AA",
  "lightskyblue": "#87CEFA",
  "lightslategray": "#778899",
  "lightslategrey": "#778899",
  "lightsteelblue": "#B0C4DE",
  "lightyellow": "#FFFFE0",
  "lime": "#00FF00",
  "limegreen": "#32CD32",
  "linen": "#FAF0E6",
  "magenta": "#FF00FF",
  "maroon": "#800000",
  "mediumaquamarine": "#66CDAA",
  "mediumblue": "#0000CD",
  "mediumorchid": "#BA55D3",
  "mediumpurple": "#9370DB",
  "mediumseagreen": "#3CB371",
  "mediumslateblue": "#7B68EE",
  "mediumspringgreen": "#00FA9A",
  "mediumturquoise": "#48D1CC",
  "mediumvioletred": "#C71585",
  "midnightblue": "#191970",
  "mintcream": "#F5FFFA",
  "mistyrose": "#FFE4E1",
  "moccasin": "#FFE4B5",
  "navajowhite": "#FFDEAD",
  "navy": "#000080",
  "oldlace": "#FDF5E6",
  "olive": "#808000",
  "olivedrab": "#6B8E23",
  "orange": "#FFA500",
  "orangered": "#FF4500",
  "orchid": "#DA70D6",
  "palegoldenrod": "#EEE8AA",
  "palegreen": "#98FB98",
  "paleturquoise": "#AFEEEE",
  "palevioletred": "#DB7093",
  "papayawhip": "#FFEFD5",
  "peachpuff": "#FFDAB9",
  "peru": "#CD853F",
  "pink": "#FFC0CB",
  "plum": "#DDA0DD",
  "powderblue": "#B0E0E6",
  "purple": "#800080",
  "rebeccapurple": "#663399",
  "red": "#FF0000",
  "rosybrown": "#BC8F8F",
  "royalblue": "#4169E1",
  "saddlebrown": "#8B4513",
  "salmon": "#FA8072",
  "sandybrown": "#F4A460",
  "seagreen": "#2E8B57",
  "seashell": "#FFF5EE",
  "sienna": "#A0522D",
  "silver": "#C0C0C0",
  "skyblue": "#87CEEB",
  "slateblue": "#6A5ACD",
  "slategray": "#708090",
  "slategrey": "#708090",
  "snow": "#FFFAFA",
  "springgreen": "#00FF7F",
  "steelblue": "#4682B4",
  "tan": "#D2B48C",
  "teal": "#008080",
  "thistle": "#D8BFD8",
  "tomato": "#FF6347",
  "turquoise": "#40E0D0",
  "violet": "#EE82EE",
  "wheat": "#F5DEB3",
  "white": "#FFFFFF",
  "whitesmoke": "#F5F5F5",
  "yellow": "#FFFF00",
  "yellowgreen": "#9ACD32"
};

// Color shades organized by environment type for favicon auto-population
export const COLOR_SHADES = {
  dev: [ //blue shades
    "DeepSkyBlue", "DodgerBlue", "RoyalBlue", "MediumBlue", "CornflowerBlue",
    "#CCCCFF", "SteelBlue", "SkyBlue", "#0F52BA", "Navy",
    "Indigo", "PowderBlue", "LightBlue", "CadetBlue", "Aqua",
    "Turquoise", "DarkTurquoise", "#6082B6", "LightSlateGray", "MidnightBlue"
  ],
  uat: [ //purple shades
    "MediumOrchid", "Orchid", "DarkOrchid", "DarkViolet", "DarkMagenta",
    "Purple", "BlueViolet", "Indigo", "DarkSlateBlue", "RebeccaPurple",
    "MediumPurple", "MediumSlateBlue", "SlateBlue", "Plum", "Violet",
    "Thistle", "Magenta", "DarkOrchid", "Fuchsia", "#301934"
  ],
  int: [ //green shades
    "LimeGreen", "SeaGreen", "MediumSeaGreen", "ForestGreen", "Green",
    "DarkGreen", "YellowGreen", "OliveDrab", "DarkOliveGreen",
    "SpringGreen", "LawnGreen", "DarkKhaki",
    "GreenYellow", "DarkSeaGreen", "MediumAquamarine", "DarkCyan",
    "Teal", "#00A36C", "#347235", "#355E3B"
  ],
  full: [ //orange shades
    "Orange", "DarkOrange", "Coral", "Tomato", "OrangeRed",
    "Salmon", "IndianRed", "Sienna", "Chocolate", "SaddleBrown",
    "Peru", "DarkSalmon", "RosyBrown", "Brown", "Maroon",
    "#b9770e", "#FFE5B4", "#CC5500", "#FF7518", "#FFBF00"
  ]
};

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
 * @param {string} sfHost - Salesforce hostname
 * @param {boolean} smartMode - Whether to use environment-based color selection
 * @param {Object} availableShades - Object with arrays of available colors per environment
 * @returns {string|null} - Selected color or null if none available
 */
export function getColorForHost(sfHost, smartMode, availableShades) {
  const envType = getEnvironmentType(sfHost);

  // Smart mode: use environment-specific colors
  if (smartMode && envType && availableShades[envType] && availableShades[envType].length > 0) {
    const randomIndex = Math.floor(Math.random() * availableShades[envType].length);
    const chosenColor = availableShades[envType][randomIndex];
    availableShades[envType].splice(randomIndex, 1); // Remove the used color
    return chosenColor;
  }

  // Random mode: use any available color
  const allColors = Object.values(availableShades).flat();
  if (allColors.length > 0) {
    const randomIndex = Math.floor(Math.random() * allColors.length);
    return allColors[randomIndex];
  }

  return null;
}
