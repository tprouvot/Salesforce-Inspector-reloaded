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
// The core library describes what a rule accepts through its `configurableOptions`, this map
// only lists the rules for which the Options page presents a different input than the core type.
export const flowScannerKnownConfigurableRules = {
  // The core rule takes a comparison expression (">= 50"), the Options page asks for a minimum
  // API version and turns it into an expression when the scan configuration is built.
  APIVersion: {configType: "threshold", defaultValue: 50},
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
 * Reads the configuration a rule accepts from its core definition.
 * @param {Object} rule - The raw rule from flowScannerCore.
 * @returns {Object|null} The config type and default value, or null when the rule takes no option.
 */
function getRuleConfigDefinition(rule) {
  const [option] = Array.isArray(rule.configurableOptions) ? rule.configurableOptions : [];
  if (option) {
    return {
      configType: option.type === "number" ? "threshold" : "expression",
      defaultValue: option.defaultValue
    };
  }
  // Older core versions only exposed the threshold on the rule instance.
  if (rule.defaultThreshold != null) {
    return {configType: "threshold", defaultValue: rule.defaultThreshold};
  }
  return null;
}

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
    checked: !rule.isBeta,
    configType: rule.configType,
    defaultValue: rule.defaultValue,
    isConfigurable: rule.isConfigurable,
    severity: rule.defaultSeverity || rule.severity || "error"
  };

  // Rules describe the option they accept (a threshold or an expression) themselves
  const configDefinition = getRuleConfigDefinition(rule);
  if (configDefinition) {
    def.configType = configDefinition.configType;
    def.defaultValue = configDefinition.defaultValue;
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
  // The Options page can ask for a different input than the one the core rule declares
  const configType = known ? known.configType : def.configType;
  const defaultValue = known ? known.defaultValue : def.defaultValue;
  const configurable = known ? true : def.isConfigurable;

  let config = {};
  if (stored && hasValidConfig(stored.config)) {
    config = stored.config;
  } else if (defaultValue != null) {
    config = {[configType]: defaultValue};
  }

  return {
    ...def,
    checked: stored?.checked ?? def.checked,
    config,
    configType,
    defaultValue,
    isConfigurable: configurable,
    configValue: stored?.configValue ?? config[configType],
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

/**
 * Retrieves the core and beta rule definitions from the scanner library.
 * @param {Object} flowScannerCore - The core scanner library.
 * @returns {Array} The rule definitions, beta rules flagged with `isBeta`.
 */
function getRuleDefinitions(flowScannerCore) {
  if (typeof flowScannerCore.getRules !== "function") {
    return [];
  }

  const coreRules = flowScannerCore.getRules();
  // Beta rules no longer have a dedicated accessor, they are returned by getRules when beta
  // mode is enabled, so everything the beta run adds on top of the core run is a beta rule
  const coreRuleNames = new Set(coreRules.map(rule => rule.name));
  const betaRules = typeof flowScannerCore.getBetaRules === "function"
    ? flowScannerCore.getBetaRules()
    : flowScannerCore.getRules(undefined, {betaMode: true}).filter(rule => !coreRuleNames.has(rule.name));

  return [...coreRules, ...betaRules.map(rule => ({...rule, isBeta: true}))];
}

export function getFlowScannerRules(flowScannerCore) {
  // Build the default rule list
  const defaultRules = getRuleDefinitions(flowScannerCore).map(transformRule);

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
