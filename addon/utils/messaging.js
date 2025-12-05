const runtime = typeof browser !== "undefined" ? browser.runtime : chrome.runtime;

const EXTENSION_ORIGIN = (() => {
  try {
    return runtime?.getURL ? new URL(runtime.getURL("/")).origin : location?.origin || "*";
  } catch {
    return location?.origin || "*";
  }
})();

const HTTP_REGEX = /^https?:\/\//i;
const ensureUrl = (v) => !v ? null : HTTP_REGEX.test(v) ? v : `https://${v}`;

export const getExtensionOrigin = () => EXTENSION_ORIGIN;

export function deriveHostOrigin(host) {
  try {
    return new URL(ensureUrl(host) || location.origin).origin;
  } catch {
    return "*";
  }
}

export function broadcastSettings(sfHost, settings, options = {}) {
  if (!sfHost || !settings) {
    return;
  }

  const {
    targetWindow = null,
    targetOrigin = deriveHostOrigin(sfHost),
    includeRuntime = true
  } = options;

  if (includeRuntime && runtime?.sendMessage) {
    runtime.sendMessage({
      message: "settingsUpdated",
      sfHost,
      settings
    });
  }

  if (targetWindow && targetWindow.postMessage) {
    targetWindow.postMessage({
      insextSettingsUpdate: true,
      sfHost,
      settings
    }, targetOrigin || "*");
  }
}

export function isTrustedSettingsMessage(event, options = {}) {
  if (!event?.data?.insextSettingsUpdate) return false;
  const {allowedOrigins = [EXTENSION_ORIGIN]} = options;
  return !allowedOrigins.length || allowedOrigins.includes(event.origin);
}

export function addSettingsMessageListener(handler, targetWindow = window, options = {}) {
  if (!targetWindow || !handler) return () => {};
  const wrapped = (e) => isTrustedSettingsMessage(e, options) && handler(e.data);
  targetWindow.addEventListener("message", wrapped);
  return () => targetWindow.removeEventListener("message", wrapped);
}
