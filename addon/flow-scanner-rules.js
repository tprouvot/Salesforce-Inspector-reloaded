/**
 * @file Shared logic for Flow Scanner rules configuration and management.
 * Used by both the Flow Scanner tool and the Options page.
 */

// Constants
export const FLOW_SCANNER_RULES_STORAGE_KEY = "flowScannerRules";

// Severity level mappings
const SEVERITY_MAPPING = {
  ui: {
    note: "info"
  },
  storage: {
    info: "note"
  }
};

export const CORE_SEVERITY_TO_UI = {
  error: "error",
  critical: "error",
  warning: "warning",
  info: "info",
  information: "info"
};

// Flow Scanner Rules Configuration
export const flowScannerKnownConfigurableRules = {
  APIVersion: {configType: "threshold", defaultValue: 50},
  FlowName: {configType: "expression", defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+"},
  CyclomaticComplexity: {configType: "threshold", defaultValue: 25},
};

/**
 * Checks if a configuration object has any valid (non-empty, non-null) values.
 * @param {Object} config - The configuration object to validate.
 * @returns {boolean} True if at least one valid value exists.
 */
function hasValidConfig(config) {
  return config && Object.values(config).some(value =>
    value !== "" && value != null && value !== false
  );
}

/**
 * Normalizes severity levels between the UI display format ("info") and
 * the storage format ("note") used by the core scanner library.
 *
 * @param {string} sev - The severity level to normalize.
 * @param {string} [direction="ui"] - The direction of normalization ('ui' or 'storage').
 * @returns {string} The normalized severity level.
 */
export const normalizeSeverity = (sev, direction = "ui") => {
  const mapping = SEVERITY_MAPPING[direction];
  return mapping?.[sev] || sev;
};

/**
 * Transforms a raw rule from the scanner library into a default rule object.
 * @param {Object} rule - The raw rule from flowScannerCore.
 * @returns {Object} The transformed default rule.
 */
function transformRule(rule) {
  const def = {
    name: rule.name,
    label: rule.label || rule.name,
    description: rule.description,
    isBeta: rule.isBeta || false,
    checked: true,
    configType: rule.configType,
    defaultValue: rule.defaultValue,
    isConfigurable: rule.isConfigurable,
    severity: rule.defaultSeverity || rule.severity || "error"
  };

  // For some rules, config is on the instance not the definition
  if (rule.defaultThreshold) {
    def.configType = "threshold";
    def.defaultValue = rule.defaultThreshold;
    def.isConfigurable = true;
  }

  return def;
}

/**
 * Merges a default rule with stored overrides and known configurations.
 * @param {Object} def - The default rule object.
 * @param {Object} stored - The stored rule override (if any).
 * @param {Object} known - The known configurable rule definition (if any).
 * @returns {Object} The merged rule object.
 */
function mergeRuleWithOverrides(def, stored, known) {
  let config = {};
  let configType = def.configType;
  let configurable = def.isConfigurable;

  if (stored && hasValidConfig(stored.config)) {
    config = stored.config;
  } else if (known) {
    config = {[known.configType]: known.defaultValue};
    configType = known.configType;
    configurable = true;
  } else if (def.defaultValue != null) {
    config = {[def.configType]: def.defaultValue};
  }

  // Override configurable and configType if known
  if (known) {
    configurable = true;
    configType = configType || known.configType;
  }

  return {
    ...def,
    checked: stored?.checked ?? def.checked,
    config,
    configType,
    configurable,
    configValue: stored?.configValue,
    severity: stored?.severity || def.severity
  };
}

/**
 * Safely retrieves stored rules from localStorage with error handling.
 * @returns {Array} Array of stored rules, or empty array if retrieval fails.
 */
function getStoredRules() {
  try {
    const stored = localStorage.getItem(FLOW_SCANNER_RULES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn("Failed to retrieve Flow Scanner rules from localStorage:", error);
    return [];
  }
}

export function getFlowScannerRules(flowScannerCore) {
  // Retrieve core and beta rules from the scanner library
  const coreRules = typeof flowScannerCore.getRules === "function"
    ? flowScannerCore.getRules()
    : [];
  const betaRules = typeof flowScannerCore.getBetaRules === "function"
    ? flowScannerCore.getBetaRules().map(r => ({...r, isBeta: true}))
    : [];

  // Build the default rule list
  const defaultRules = [...coreRules, ...betaRules].map(transformRule);

  // Convert stored overrides to Map for O(1) lookups
  const storedRulesArray = getStoredRules();
  const storedRulesMap = new Map(storedRulesArray.map(r => [r.name, r]));

  // Merge defaults with stored overrides
  return defaultRules.map(def => {
    const stored = storedRulesMap.get(def.name);
    const known = flowScannerKnownConfigurableRules[def.name];
    return mergeRuleWithOverrides(def, stored, known);
  });
}
