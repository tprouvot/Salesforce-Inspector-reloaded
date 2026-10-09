/**
 * @file Shared logic for Object Scanner rules configuration and evaluation.
 * Used by both the Object Scanner page and the Options page.
 */

export const OBJECT_SCANNER_RULES_STORAGE_KEY = "objectScannerRules";

export const DEFAULT_REPLICATION_TOKENS = [
  "Account",
  "Contact",
  "Lead",
  "Opportunity",
  "Campaign",
  "Product",
  "Product2",
  "Order",
  "Contract",
  "Asset",
  "Quote",
  "Case",
  "Entitlement",
  "WorkOrder",
  "Knowledge",
  "Pricebook"
];

export const FIELD_DEFINITION_RULE_NAMES = [
  "MissingDescription",
  "EncryptedUnclassified",
  "PiiClassified",
  "PiiUnclassified"
];

export const DEFAULT_NEAR_DUPLICATE_REGEX = "(_2|_old|_backup|_copy|_v2)$";

export const DEFAULT_THRESHOLDS = {
  customFieldsWarning: 100,
  customFieldsError: 300,
  relationshipsWarning: 25,
  relationshipsError: 40,
  recordTypesWarning: 20,
  recordTypesError: 50,
  customObjectsWarning: 100,
  customObjectsError: 200,
  inactivePicklistPercent: 50
};

export const OVER_CUSTOMIZATION_THRESHOLD_FIELDS = [
  {key: "customFieldsWarning", label: "Custom fields warning"},
  {key: "customFieldsError", label: "Custom fields error"},
  {key: "relationshipsWarning", label: "Relationships warning"},
  {key: "relationshipsError", label: "Relationships error"},
  {key: "recordTypesWarning", label: "Record types warning"},
  {key: "recordTypesError", label: "Record types error"},
  {key: "customObjectsWarning", label: "Custom objects warning"},
  {key: "customObjectsError", label: "Custom objects error"}
].map(field => ({...field, defaultValue: DEFAULT_THRESHOLDS[field.key]}));

export const OBJECT_SCANNER_RULE_DEFINITIONS = [
  {
    name: "NamingConvention",
    label: "Naming Convention",
    description: "Flags custom object and subscriber custom field API names that do not match the org's dominant style (PascalCase, underscore, prefix), plus redundant, oversized, or malformed names.",
    checked: true,
    severity: "warning",
    isConfigurable: true,
    configType: "expression",
    defaultValue: ""
  },
  {
    name: "StandardObjectReplication",
    label: "Standard Object Replication",
    description: "Flags custom objects whose API name or label contains a standard object token (for example Account__c or Account_Detail__c).",
    checked: true,
    severity: "warning",
    isConfigurable: true,
    configType: "expression",
    defaultValue: DEFAULT_REPLICATION_TOKENS.join(",")
  },
  {
    name: "OverCustomization",
    label: "Over-customization",
    description: "Flags objects with too many subscriber custom fields, custom relationships, or record types, and orgs with too many subscriber custom objects in the scan set. Packaged metadata is excluded.",
    checked: true,
    severity: "warning",
    isConfigurable: true,
    configType: "thresholds",
    configFields: OVER_CUSTOMIZATION_THRESHOLD_FIELDS,
    defaultValue: OVER_CUSTOMIZATION_THRESHOLD_FIELDS.reduce((config, field) => {
      config[field.key] = field.defaultValue;
      return config;
    }, {})
  },
  {
    name: "PiiClassified",
    label: "PII Classified",
    description: "Lists fields that have Salesforce Data Classification metadata (ComplianceGroup, SecurityClassification, or BusinessStatus).",
    checked: true,
    severity: "info",
    isConfigurable: false
  },
  {
    name: "PiiUnclassified",
    label: "PII Unclassified",
    description: "Flags subscriber custom fields with no Data Classification metadata. Noisy if the org does not use classification; default off.",
    checked: false,
    severity: "warning",
    isConfigurable: false
  },
  {
    name: "DuplicateLabels",
    label: "Duplicate Labels",
    description: "Flags two or more subscriber custom fields on the same object that share the same label.",
    checked: true,
    severity: "warning",
    isConfigurable: false
  },
  {
    name: "TypeHygiene",
    label: "Type Hygiene",
    description: "Flags custom fields whose API name or label implies Email, Phone, URL, Percent, or Checkbox but the field type is a generic string or number.",
    checked: true,
    severity: "warning",
    isConfigurable: false
  },
  {
    name: "UnrestrictedPicklist",
    label: "Unrestricted Picklist",
    description: "Flags custom picklists that allow values outside the defined set (restrictedPicklist is false).",
    checked: true,
    severity: "info",
    isConfigurable: false
  },
  {
    name: "InactivePicklistBloat",
    label: "Inactive Picklist Bloat",
    description: "Flags custom picklists where inactive values are a majority of the value set.",
    checked: true,
    severity: "warning",
    isConfigurable: true,
    configType: "threshold",
    defaultValue: DEFAULT_THRESHOLDS.inactivePicklistPercent
  },
  {
    name: "NearDuplicateObjects",
    label: "Near-duplicate Objects",
    description: "Flags custom objects that differ only by pluralization or a name suffix matching the configured regex (default _2, _Old, _Backup, _Copy, _V2).",
    checked: true,
    severity: "info",
    isConfigurable: true,
    configType: "expression",
    defaultValue: DEFAULT_NEAR_DUPLICATE_REGEX
  },
  {
    name: "MissingDescription",
    label: "Missing Description",
    description: "Flags subscriber custom fields with an empty FieldDefinition description.",
    checked: true,
    severity: "warning",
    isConfigurable: false
  },
  {
    name: "EncryptedUnclassified",
    label: "Encrypted Unclassified",
    description: "Flags encrypted fields that have no SecurityClassification or ComplianceGroup.",
    checked: true,
    severity: "warning",
    isConfigurable: false
  }
];

function hasValidConfig(config) {
  return config && Object.values(config).some(value =>
    value !== "" && value != null && value !== false
  );
}

function getStoredRules() {
  try {
    const stored = localStorage.getItem(OBJECT_SCANNER_RULES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn("Failed to retrieve Object Scanner rules from localStorage:", error);
    return [];
  }
}

function defaultConfigFor(def) {
  if (def.configFields && def.configFields.length) {
    const config = {};
    def.configFields.forEach(field => {
      config[field.key] = field.defaultValue;
    });
    return config;
  }
  if (def.defaultValue != null && def.configType) {
    return {[def.configType]: def.defaultValue};
  }
  return {};
}

function mergeRuleWithOverrides(def, stored) {
  let config = defaultConfigFor(def);
  if (stored && hasValidConfig(stored.config)) {
    config = {...config, ...stored.config};
    if (def.name === "OverCustomization" && stored.config.threshold != null && stored.config.customFieldsWarning == null) {
      config.customFieldsWarning = stored.config.threshold;
    }
  }

  return {
    ...def,
    checked: stored?.checked ?? def.checked,
    config,
    configValue: stored?.configValue,
    severity: stored?.severity || def.severity
  };
}

export function getObjectScannerRules() {
  const storedRulesMap = new Map(getStoredRules().map(r => [r.name, r]));
  return OBJECT_SCANNER_RULE_DEFINITIONS.map(def => mergeRuleWithOverrides(def, storedRulesMap.get(def.name)));
}

export function isRuleEnabled(rules, name) {
  const rule = rules.find(r => r.name === name);
  return !!(rule && rule.checked);
}

export function needsFieldDefinitionQuery(rules) {
  return FIELD_DEFINITION_RULE_NAMES.some(name => isRuleEnabled(rules, name));
}

function getEnabledRule(rules, name) {
  const rule = rules.find(r => r.name === name);
  if (!rule || !rule.checked) {
    return null;
  }
  return rule;
}

function configValue(rule, key, fallback) {
  if (!rule) {
    return fallback;
  }
  if (rule.config && rule.config[key] != null && rule.config[key] !== "") {
    return rule.config[key];
  }
  if (rule.configValue != null && rule.configValue !== "") {
    return rule.configValue;
  }
  if (rule.defaultValue != null && rule.defaultValue !== "") {
    return rule.defaultValue;
  }
  return fallback;
}

export function stripApiSuffix(apiName) {
  if (!apiName) {
    return "";
  }
  return apiName.replace(/__(c|mdt|e|x|b|k|pc|pr|pd|r|chn)$/i, "");
}

export function fieldNamespaceFromName(fieldName) {
  if (!fieldName) {
    return "";
  }
  const parts = fieldName.split("__");
  if (parts.length >= 3) {
    return parts[0];
  }
  return "";
}

export function isCustomEntityName(name) {
  return /__(c|mdt|e|x|b|k)$/i.test(name || "");
}

export function isSubscriberCustomField(field, orgNamespace) {
  if (!field || !field.custom) {
    return false;
  }
  const ns = field.namespacePrefix || fieldNamespaceFromName(field.name);
  if (!ns) {
    return true;
  }
  if (orgNamespace && ns.toLowerCase() === orgNamespace.toLowerCase()) {
    return true;
  }
  return false;
}

export function isSubscriberCustomObject(objectModel, orgNamespace) {
  if (!objectModel || !objectModel.custom) {
    return false;
  }
  const ns = objectModel.namespacePrefix || "";
  if (!ns) {
    return true;
  }
  if (orgNamespace && ns.toLowerCase() === orgNamespace.toLowerCase()) {
    return true;
  }
  return false;
}

function customRecordTypeCount(objectModel) {
  return (objectModel.recordTypeInfos || []).filter(rt => !rt.master && rt.name !== "Master").length;
}

export function classifyNamingStyle(apiName) {
  const base = stripApiSuffix(apiName);
  if (!base) {
    return "other";
  }
  if (/_{2,}/.test(base) || /^_|_$/.test(base)) {
    return "mixed";
  }
  const prefixMatch = base.match(/^([A-Za-z][A-Za-z0-9]{1,4})_([A-Z0-9].*)$/);
  if (prefixMatch && prefixMatch[1].length <= 5) {
    return "prefixed";
  }
  if (base.includes("_")) {
    return "underscore";
  }
  if (/^[A-Z][a-zA-Z0-9]*$/.test(base) && /[a-z]/.test(base)) {
    return "pascal";
  }
  if (/^[a-z][a-zA-Z0-9]*$/.test(base) && /[A-Z]/.test(base)) {
    return "camel";
  }
  return "other";
}

function extractPrefix(apiName) {
  const base = stripApiSuffix(apiName);
  const match = base.match(/^([A-Za-z][A-Za-z0-9]{1,4})_/);
  return match ? match[1] : "";
}

function dominantKey(counts, minShare, minTotal) {
  let best = null;
  let bestCount = 0;
  let total = 0;
  Object.keys(counts).forEach(key => {
    total += counts[key];
    if (counts[key] > bestCount) {
      bestCount = counts[key];
      best = key;
    }
  });
  if (total < minTotal || !best) {
    return null;
  }
  if (bestCount / total < minShare) {
    return null;
  }
  return best;
}

function normalizeLabel(label) {
  return (label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function objectTokens(apiName) {
  return stripApiSuffix(apiName).split("_").filter(Boolean);
}

function parseTokenList(expression) {
  const raw = expression || DEFAULT_REPLICATION_TOKENS.join(",");
  return raw.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
}

function compileNearDuplicateRegex(expression) {
  const raw = String(expression || DEFAULT_NEAR_DUPLICATE_REGEX).trim() || DEFAULT_NEAR_DUPLICATE_REGEX;
  try {
    return new RegExp(raw, "i");
  } catch {
    try {
      return new RegExp(DEFAULT_NEAR_DUPLICATE_REGEX, "i");
    } catch {
      return null;
    }
  }
}

function applyNearDuplicateRegex(base, regex) {
  if (!regex || !base) {
    return base;
  }
  const match = base.match(regex);
  if (!match) {
    return base;
  }
  if (match[1] != null && match[1] !== "" && match[1] !== match[0]) {
    return match[1];
  }
  return base.replace(regex, "");
}

function stemCustomObjectName(apiName, suffixRegex) {
  let base = applyNearDuplicateRegex(stripApiSuffix(apiName).toLowerCase(), suffixRegex);
  if (base.endsWith("ies") && base.length > 4) {
    base = base.slice(0, -3) + "y";
  } else if (base.endsWith("ses") && base.length > 4) {
    base = base.slice(0, -2);
  } else if (base.endsWith("s") && !base.endsWith("ss") && base.length > 3) {
    base = base.slice(0, -1);
  }
  return base.replace(/_/g, "");
}

function finding(rule, severity, objectModel, field, message, extra) {
  return {
    id: [rule.name, objectModel.name, field && field.name, message].filter(Boolean).join("|"),
    rule: rule.name,
    ruleLabel: rule.label,
    severity: severity || rule.severity || "warning",
    objectName: objectModel.name,
    objectLabel: objectModel.label,
    fieldName: field ? field.name : "",
    fieldLabel: field ? field.label : "",
    message,
    extra: extra || {}
  };
}

function subscriberFields(objectModel, orgNamespace) {
  return (objectModel.fields || []).filter(field => isSubscriberCustomField(field, orgNamespace));
}

function evaluateNaming(rule, objects, orgNamespace) {
  const findings = [];
  const expression = String(configValue(rule, "expression", "") || "").trim();
  let regex = null;
  if (expression) {
    try {
      regex = new RegExp(expression);
    } catch {
      regex = null;
    }
  }

  const objectStyleCounts = {};
  const fieldStyleCounts = {};
  const fieldPrefixCounts = {};

  objects.forEach(objectModel => {
    if (objectModel.custom) {
      const style = classifyNamingStyle(objectModel.name);
      objectStyleCounts[style] = (objectStyleCounts[style] || 0) + 1;
    }
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      const style = classifyNamingStyle(field.name);
      fieldStyleCounts[style] = (fieldStyleCounts[style] || 0) + 1;
      const prefix = extractPrefix(field.name);
      if (prefix) {
        fieldPrefixCounts[prefix] = (fieldPrefixCounts[prefix] || 0) + 1;
      }
    });
  });

  const dominantObjectStyle = dominantKey(objectStyleCounts, 0.6, 3);
  const dominantFieldStyle = dominantKey(fieldStyleCounts, 0.6, 3);
  const dominantPrefix = dominantKey(fieldPrefixCounts, 0.5, 3);

  objects.forEach(objectModel => {
    if (objectModel.custom) {
      const base = stripApiSuffix(objectModel.name);
      if (regex && !regex.test(objectModel.name)) {
        findings.push(finding(rule, rule.severity, objectModel, null, "Custom object API name does not match the configured pattern."));
      }
      if (!regex && dominantObjectStyle && classifyNamingStyle(objectModel.name) !== dominantObjectStyle && classifyNamingStyle(objectModel.name) !== "prefixed") {
        findings.push(finding(rule, rule.severity, objectModel, null, `Custom object API name style "${classifyNamingStyle(objectModel.name)}" differs from dominant style "${dominantObjectStyle}".`));
      }
      if (/__/.test(base) || /^_|_$/.test(base)) {
        findings.push(finding(rule, rule.severity, objectModel, null, "Custom object API name has extra or misplaced underscores."));
      }
      if (base.length > 40) {
        findings.push(finding(rule, "info", objectModel, null, "Custom object API name is longer than 40 characters before the suffix."));
      }
    }

    const objectToken = stripApiSuffix(objectModel.name).toLowerCase();
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      const style = classifyNamingStyle(field.name);
      const base = stripApiSuffix(field.name);
      if (regex && !regex.test(field.name)) {
        findings.push(finding(rule, rule.severity, objectModel, field, "Field API name does not match the configured pattern."));
      }
      if (!regex && dominantFieldStyle && style !== dominantFieldStyle && style !== "prefixed") {
        findings.push(finding(rule, rule.severity, objectModel, field, `Field API name style "${style}" differs from dominant style "${dominantFieldStyle}".`));
      }
      if (/_{2,}/.test(base) || /^_|_$/.test(base)) {
        findings.push(finding(rule, rule.severity, objectModel, field, "Field API name has extra or misplaced underscores."));
      }
      if (base.length > 40) {
        findings.push(finding(rule, "info", objectModel, field, "Field API name is longer than 40 characters before the suffix."));
      }
      const fieldTokens = objectTokens(field.name).map(t => t.toLowerCase());
      if (objectToken && fieldTokens.includes(objectToken)) {
        findings.push(finding(rule, "info", objectModel, field, `Field API name repeats the parent object token "${objectToken}".`));
      }
      if (dominantPrefix && !extractPrefix(field.name)) {
        findings.push(finding(rule, "info", objectModel, field, `Most custom fields use prefix "${dominantPrefix}"; this field is unprefixed.`));
      }
    });
  });

  return findings;
}

function evaluateReplication(rule, objects) {
  const tokens = parseTokenList(configValue(rule, "expression", DEFAULT_REPLICATION_TOKENS.join(",")));
  const findings = [];
  objects.filter(objectModel => objectModel.custom).forEach(objectModel => {
    const haystack = `${stripApiSuffix(objectModel.name)}_${objectModel.label || ""}`.toLowerCase();
    const nameTokens = objectTokens(objectModel.name).map(t => t.toLowerCase());
    tokens.forEach(token => {
      const lower = token.toLowerCase();
      const exactClone = stripApiSuffix(objectModel.name).toLowerCase() === lower;
      const tokenHit = nameTokens.includes(lower) || haystack.split(/[\s_]+/).includes(lower);
      if (exactClone || tokenHit) {
        findings.push(finding(rule, rule.severity, objectModel, null, `Custom object name or label contains standard object token "${token}".`));
      }
    });
  });
  return findings;
}

function thresholdNumber(rule, key, fallback) {
  let raw = fallback;
  if (rule && rule.config && rule.config[key] != null && rule.config[key] !== "") {
    raw = rule.config[key];
  } else if (key === "customFieldsWarning") {
    raw = configValue(rule, "threshold", fallback);
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function evaluateOverCustomization(rule, objects, orgNamespace) {
  const findings = [];
  const fieldsWarning = thresholdNumber(rule, "customFieldsWarning", DEFAULT_THRESHOLDS.customFieldsWarning);
  const fieldsError = thresholdNumber(rule, "customFieldsError", DEFAULT_THRESHOLDS.customFieldsError);
  const relWarning = thresholdNumber(rule, "relationshipsWarning", DEFAULT_THRESHOLDS.relationshipsWarning);
  const relError = thresholdNumber(rule, "relationshipsError", DEFAULT_THRESHOLDS.relationshipsError);
  const rtWarning = thresholdNumber(rule, "recordTypesWarning", DEFAULT_THRESHOLDS.recordTypesWarning);
  const rtError = thresholdNumber(rule, "recordTypesError", DEFAULT_THRESHOLDS.recordTypesError);
  const objWarning = thresholdNumber(rule, "customObjectsWarning", DEFAULT_THRESHOLDS.customObjectsWarning);
  const objError = thresholdNumber(rule, "customObjectsError", DEFAULT_THRESHOLDS.customObjectsError);

  objects.forEach(objectModel => {
    const customFields = subscriberFields(objectModel, orgNamespace);
    const customFieldCount = customFields.length;
    const relationshipCount = customFields.filter(f => f.type === "reference").length;
    const recordTypeCount = customRecordTypeCount(objectModel);

    if (customFieldCount >= fieldsError) {
      findings.push(finding(rule, "error", objectModel, null, `Object has ${customFieldCount} subscriber custom fields (error threshold ${fieldsError}).`));
    } else if (customFieldCount >= fieldsWarning) {
      findings.push(finding(rule, "warning", objectModel, null, `Object has ${customFieldCount} subscriber custom fields (warning threshold ${fieldsWarning}).`));
    }
    if (relationshipCount >= relError) {
      findings.push(finding(rule, "error", objectModel, null, `Object has ${relationshipCount} custom relationship fields (error threshold ${relError}).`));
    } else if (relationshipCount >= relWarning) {
      findings.push(finding(rule, "warning", objectModel, null, `Object has ${relationshipCount} custom relationship fields (warning threshold ${relWarning}).`));
    }
    if (recordTypeCount >= rtError) {
      findings.push(finding(rule, "error", objectModel, null, `Object has ${recordTypeCount} record types (error threshold ${rtError}).`));
    } else if (recordTypeCount >= rtWarning) {
      findings.push(finding(rule, "warning", objectModel, null, `Object has ${recordTypeCount} record types (warning threshold ${rtWarning}).`));
    }
  });

  const customObjectCount = objects.filter(o => isSubscriberCustomObject(o, orgNamespace)).length;
  if (customObjectCount >= objError || customObjectCount >= objWarning) {
    const severity = customObjectCount >= objError ? "error" : "warning";
    const threshold = customObjectCount >= objError ? objError : objWarning;
    if (objects[0]) {
      findings.push(finding(rule, severity, {name: "(org)", label: "Scanned org"}, null, `Scan set contains ${customObjectCount} subscriber custom objects (threshold ${threshold}).`));
    }
  }
  return findings;
}

function evaluateDuplicateLabels(rule, objects, orgNamespace) {
  const findings = [];
  objects.forEach(objectModel => {
    const groups = new Map();
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      const key = normalizeLabel(field.label);
      if (!key) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(field);
    });
    groups.forEach(fields => {
      if (fields.length > 1) {
        const names = fields.map(f => f.name).join(", ");
        fields.forEach(field => {
          findings.push(finding(rule, rule.severity, objectModel, field, `Duplicate field label "${field.label}" shared by ${names}.`));
        });
      }
    });
  });
  return findings;
}

function impliedType(field) {
  const name = stripApiSuffix(field.name || "");
  const label = field.label || "";
  const combined = `${name} ${label}`;
  if (/(^|_)email$/i.test(name) || (/email/i.test(label) && /email/i.test(name))) {
    return "email";
  }
  if (/(^|_)phone$/i.test(name) || /phone/i.test(name)) {
    return "phone";
  }
  if (/(^|_)(url|uri)$/i.test(name) || (/\burl\b/i.test(combined) && /(url|uri)/i.test(name))) {
    return "url";
  }
  if (/(^|_)percent(age)?$/i.test(name) || /percent/i.test(name)) {
    return "percent";
  }
  if (/^(is|has)[A-Z_]/.test(name) || /^(Is|Has)_/.test(name)) {
    return "boolean";
  }
  return null;
}

function evaluateTypeHygiene(rule, objects, orgNamespace) {
  const findings = [];
  const genericTypes = new Set(["string", "textarea", "double", "int", "long"]);
  objects.forEach(objectModel => {
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      const expected = impliedType(field);
      if (!expected) {
        return;
      }
      if (field.type === expected) {
        return;
      }
      if (!genericTypes.has(field.type)) {
        return;
      }
      findings.push(finding(rule, rule.severity, objectModel, field, `Field name implies type "${expected}" but describe type is "${field.type}".`));
    });
  });
  return findings;
}

function evaluateUnrestrictedPicklist(rule, objects, orgNamespace) {
  const findings = [];
  objects.forEach(objectModel => {
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      if ((field.type === "picklist" || field.type === "multipicklist") && field.restrictedPicklist === false) {
        findings.push(finding(rule, rule.severity, objectModel, field, "Custom picklist is unrestricted (restrictedPicklist is false)."));
      }
    });
  });
  return findings;
}

function evaluateInactivePicklistBloat(rule, objects, orgNamespace) {
  const findings = [];
  const percent = Number(configValue(rule, "threshold", DEFAULT_THRESHOLDS.inactivePicklistPercent)) || DEFAULT_THRESHOLDS.inactivePicklistPercent;
  objects.forEach(objectModel => {
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      if (field.type !== "picklist" && field.type !== "multipicklist") {
        return;
      }
      const values = field.picklistValues || [];
      if (values.length < 4) {
        return;
      }
      const inactive = values.filter(v => v.active === false).length;
      const ratio = (inactive / values.length) * 100;
      if (ratio >= percent) {
        findings.push(finding(rule, rule.severity, objectModel, field, `${inactive} of ${values.length} picklist values are inactive (${Math.round(ratio)}%, threshold ${percent}%).`));
      }
    });
  });
  return findings;
}

function evaluateNearDuplicates(rule, objects) {
  const findings = [];
  const groups = new Map();
  const suffixRegex = compileNearDuplicateRegex(configValue(rule, "expression", DEFAULT_NEAR_DUPLICATE_REGEX));
  objects.filter(o => o.custom).forEach(objectModel => {
    const stem = stemCustomObjectName(objectModel.name, suffixRegex);
    if (!stem) {
      return;
    }
    if (!groups.has(stem)) {
      groups.set(stem, []);
    }
    groups.get(stem).push(objectModel);
  });
  groups.forEach(group => {
    if (group.length > 1) {
      const names = group.map(o => o.name).join(", ");
      group.forEach(objectModel => {
        findings.push(finding(rule, rule.severity, objectModel, null, `Near-duplicate custom objects: ${names}.`));
      });
    }
  });
  return findings;
}

function fieldDefFor(objectModel, field, fieldDefinitions) {
  const byObject = fieldDefinitions && fieldDefinitions[objectModel.name];
  if (!byObject) {
    return null;
  }
  return byObject[field.name] || null;
}

function hasClassification(def) {
  if (!def) {
    return false;
  }
  return !!(def.ComplianceGroup || def.SecurityClassification || def.BusinessStatus);
}

function evaluateMissingDescription(rule, objects, orgNamespace, fieldDefinitions) {
  const findings = [];
  objects.forEach(objectModel => {
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      const def = fieldDefFor(objectModel, field, fieldDefinitions);
      if (!def) {
        return;
      }
      if (!def.Description || !String(def.Description).trim()) {
        findings.push(finding(rule, rule.severity, objectModel, field, "Subscriber custom field has no description."));
      }
    });
  });
  return findings;
}

function evaluateEncryptedUnclassified(rule, objects, orgNamespace, fieldDefinitions) {
  const findings = [];
  objects.forEach(objectModel => {
    (objectModel.fields || []).forEach(field => {
      if (!field.encrypted) {
        return;
      }
      const def = fieldDefFor(objectModel, field, fieldDefinitions);
      if (def && (def.SecurityClassification || def.ComplianceGroup)) {
        return;
      }
      findings.push(finding(rule, rule.severity, objectModel, field, "Encrypted field has no SecurityClassification or ComplianceGroup."));
    });
  });
  return findings;
}

function evaluatePiiClassified(rule, objects, fieldDefinitions) {
  const findings = [];
  objects.forEach(objectModel => {
    (objectModel.fields || []).forEach(field => {
      const def = fieldDefFor(objectModel, field, fieldDefinitions);
      if (!hasClassification(def)) {
        return;
      }
      const bits = [def.SecurityClassification, def.ComplianceGroup, def.BusinessStatus].filter(Boolean).join(", ");
      findings.push(finding(rule, rule.severity, objectModel, field, `Field has data classification metadata: ${bits}.`, {
        securityClassification: def.SecurityClassification,
        complianceGroup: def.ComplianceGroup,
        businessStatus: def.BusinessStatus
      }));
    });
  });
  return findings;
}

function evaluatePiiUnclassified(rule, objects, orgNamespace, fieldDefinitions) {
  const findings = [];
  objects.forEach(objectModel => {
    subscriberFields(objectModel, orgNamespace).forEach(field => {
      const def = fieldDefFor(objectModel, field, fieldDefinitions);
      if (!def) {
        return;
      }
      if (hasClassification(def)) {
        return;
      }
      findings.push(finding(rule, rule.severity, objectModel, field, "Subscriber custom field has no data classification metadata."));
    });
  });
  return findings;
}

/**
 * Run describe-only rules against objects that already have a slim describe.
 */
export function evaluateDescribeRules(objects, rules, orgNamespace) {
  const findings = [];
  const naming = getEnabledRule(rules, "NamingConvention");
  const replication = getEnabledRule(rules, "StandardObjectReplication");
  const over = getEnabledRule(rules, "OverCustomization");
  const dup = getEnabledRule(rules, "DuplicateLabels");
  const type = getEnabledRule(rules, "TypeHygiene");
  const unrestricted = getEnabledRule(rules, "UnrestrictedPicklist");
  const bloat = getEnabledRule(rules, "InactivePicklistBloat");
  const near = getEnabledRule(rules, "NearDuplicateObjects");

  if (naming) {
    findings.push(...evaluateNaming(naming, objects, orgNamespace));
  }
  if (replication) {
    findings.push(...evaluateReplication(replication, objects));
  }
  if (over) {
    findings.push(...evaluateOverCustomization(over, objects, orgNamespace));
  }
  if (dup) {
    findings.push(...evaluateDuplicateLabels(dup, objects, orgNamespace));
  }
  if (type) {
    findings.push(...evaluateTypeHygiene(type, objects, orgNamespace));
  }
  if (unrestricted) {
    findings.push(...evaluateUnrestrictedPicklist(unrestricted, objects, orgNamespace));
  }
  if (bloat) {
    findings.push(...evaluateInactivePicklistBloat(bloat, objects, orgNamespace));
  }
  if (near) {
    findings.push(...evaluateNearDuplicates(near, objects));
  }
  return findings;
}

/**
 * Run FieldDefinition-backed rules.
 */
export function evaluateFieldDefinitionRules(objects, rules, orgNamespace, fieldDefinitions) {
  const findings = [];
  const missing = getEnabledRule(rules, "MissingDescription");
  const encrypted = getEnabledRule(rules, "EncryptedUnclassified");
  const classified = getEnabledRule(rules, "PiiClassified");
  const unclassified = getEnabledRule(rules, "PiiUnclassified");

  if (missing) {
    findings.push(...evaluateMissingDescription(missing, objects, orgNamespace, fieldDefinitions));
  }
  if (encrypted) {
    findings.push(...evaluateEncryptedUnclassified(encrypted, objects, orgNamespace, fieldDefinitions));
  }
  if (classified) {
    findings.push(...evaluatePiiClassified(classified, objects, fieldDefinitions));
  }
  if (unclassified) {
    findings.push(...evaluatePiiUnclassified(unclassified, objects, orgNamespace, fieldDefinitions));
  }
  return findings;
}

export function slimDescribe(describe, orgNamespace) {
  return {
    name: describe.name,
    label: describe.label,
    custom: !!describe.custom,
    namespacePrefix: describe.namespacePrefix || "",
    recordTypeInfos: (describe.recordTypeInfos || []).map(rt => ({name: rt.name, available: rt.available, master: !!rt.master})),
    fields: (describe.fields || []).map(field => ({
      name: field.name,
      label: field.label,
      type: field.type,
      custom: !!field.custom,
      nillable: field.nillable,
      encrypted: !!field.encrypted,
      externalId: !!field.externalId,
      unique: !!field.unique,
      length: field.length || 0,
      precision: field.precision || 0,
      scale: field.scale || 0,
      inlineHelpText: field.inlineHelpText || "",
      referenceTo: Array.isArray(field.referenceTo) ? field.referenceTo.slice() : [],
      restrictedPicklist: field.restrictedPicklist !== false,
      picklistValues: (field.picklistValues || []).map(v => ({value: v.value, active: v.active !== false})),
      calculated: !!field.calculated,
      autoNumber: !!field.autoNumber,
      namespacePrefix: field.namespacePrefix || fieldNamespaceFromName(field.name)
    })),
    orgNamespace
  };
}
