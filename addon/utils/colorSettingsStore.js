import {COLOR_SHADES, getEnvironmentType, normalizeColorEntry} from "./colorUtils.js";

const GLOBAL_BOOLEAN_DEFAULTS = {
  colorizeFavicon: true,
  colorizeOrgBanner: false,
  colorizeExtHeader: false,
};

const ORG_VALUE_KEYS = {
  customFavicon: (sfHost) => `${sfHost}_customFavicon`,
  orgBannerText: (sfHost) => `${sfHost}_orgBannerText`,
};

const SPECIAL_KEY_MAP = {
  smartMode: "faviconSmartMode",
};

const ORG_SUFFIX = "_isSandbox";

const colorSubscribers = new Set();

const COLOR_CACHE = Object.fromEntries(
  Object.entries(COLOR_SHADES).map(([k, v]) => [k, normalizeColorList(v)])
);
COLOR_CACHE.all = flattenColorShades();

function flattenColorShades() {
  return Object.values(COLOR_SHADES).flat().map(normalizeColorEntry).filter(Boolean);
}

function normalizeColorList(list = []) {
  return list.map(normalizeColorEntry).filter(Boolean);
}

function getColorPool(sfHost, smartMode = true) {
  if (smartMode) {
    const pool = COLOR_CACHE[getEnvironmentType(sfHost)];
    if (pool?.length) return pool;
  }
  return COLOR_CACHE.all;
}

// structuredClone supported in Chrome 98+, Firefox 94+, Safari 15.4+

function hashHost(host = "") {
  let hash = 0;
  for (let i = 0; i < host.length; i++) {
    hash = ((hash << 5) - hash) + host.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickColor(list, host) {
  if (!list?.length) return null;
  return list[hashHost(host) % list.length];
}

function notifyColorSubscribers(sfHost, snapshot) {
  colorSubscribers.forEach(({hostFilter, callback}) => {
    if (typeof callback === "function" && (!hostFilter || hostFilter === sfHost)) {
      callback(structuredClone(snapshot), sfHost);
    }
  });
}

function readBoolean(key, defaultValue = false) {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  try { return JSON.parse(raw); } catch { return defaultValue; }
}

function writeBoolean(key, value) {
  localStorage.setItem(key, JSON.stringify(!!value));
}

function readString(key) {
  return localStorage.getItem(key) || "";
}

function writeString(key, value) {
  if (value == null || value === "") localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

function getGlobalColorSettings() {
  return {
    ...Object.fromEntries(Object.entries(GLOBAL_BOOLEAN_DEFAULTS).map(([k, v]) => [k, readBoolean(k, v)])),
    smartMode: readBoolean(SPECIAL_KEY_MAP.smartMode, true)
  };
}

function getOrgColorSettings(sfHost) {
  return {
    customFavicon: readString(ORG_VALUE_KEYS.customFavicon(sfHost)),
    orgBannerText: readString(ORG_VALUE_KEYS.orgBannerText(sfHost)),
  };
}

export function getColorSettingsSnapshot(sfHost) {
  return {
    ...getGlobalColorSettings(),
    ...getOrgColorSettings(sfHost),
  };
}

export function updateColorSettings(sfHost, updates = {}) {
  for (const [key, value] of Object.entries(updates)) {
    if (key in GLOBAL_BOOLEAN_DEFAULTS) writeBoolean(key, value);
    else if (SPECIAL_KEY_MAP[key]) writeBoolean(SPECIAL_KEY_MAP[key], value);
    else if (ORG_VALUE_KEYS[key]) writeString(ORG_VALUE_KEYS[key](sfHost), value ?? "");
  }

  const snapshot = getColorSettingsSnapshot(sfHost);
  notifyColorSubscribers(sfHost, snapshot);
  return snapshot;
}

export function subscribeToColorSettings(hostFilterOrCallback, maybeCallback) {
  const callback = typeof hostFilterOrCallback === "function" ? hostFilterOrCallback : maybeCallback;
  const hostFilter = typeof hostFilterOrCallback === "function" ? null : hostFilterOrCallback;
  if (typeof callback !== "function") return () => {};

  const subscription = {hostFilter, callback};
  colorSubscribers.add(subscription);
  return () => colorSubscribers.delete(subscription);
}

export function getKnownOrgHosts() {
  return [...new Set(
    Object.keys(localStorage)
      .filter(k => k.endsWith(ORG_SUFFIX))
      .map(k => k.slice(0, -ORG_SUFFIX.length))
  )];
}

export function getSuggestedFaviconColor(sfHost, smartMode = true) {
  const pool = getColorPool(sfHost, smartMode);
  return pickColor(pool, sfHost);
}

export function ensureFaviconColor(sfHost, smartMode) {
  const snapshot = getColorSettingsSnapshot(sfHost);
  if (snapshot.customFavicon) return snapshot;

  const effectiveSmartMode = typeof smartMode === "boolean" ? smartMode : snapshot.smartMode;
  const suggested = getSuggestedFaviconColor(sfHost, effectiveSmartMode);
  return suggested ? updateColorSettings(sfHost, {customFavicon: suggested}) : snapshot;
}
