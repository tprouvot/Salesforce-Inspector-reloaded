
export const SF_DOMAIN_REGEX = /^[a-zA-Z0-9.\-]+(?:\.salesforce\.com|\.force\.com|\.visualforce\.com|\.cloudforce\.com|\.salesforce\.mil|\.force\.mil|\.cloudforce\.mil|\.visualforce\.mil|\.crmforce\.mil|\.sfcrmproducts\.cn|\.sfcrmapps\.cn|\.salesforce-setup\.com)$/i;
export const hostByTab = new Map();

if (typeof chrome !== "undefined" && chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener(tabId => {
    hostByTab.delete(tabId);
  });
}

function getActiveTabHost(callback) {
  chrome.tabs.query({active: true, currentWindow: true}, tabs => {
    if (!tabs || tabs.length === 0) {
      return;
    }
    const tab = tabs[0];
    let host = hostByTab.get(tab.id);
    if (!host && tab.url) {
      try {
        const url = new URL(tab.url);
        if (SF_DOMAIN_REGEX.test(url.hostname)) {
          host = url.hostname;
        }
      } catch {}
    }
    callback(tab, host);
  });
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Perform cookie operations in the background page, because not all foreground pages have access to the cookie API.
    // Firefox does not support incognito split mode, so we use sender.tab.cookieStoreId to select the right cookie store.
    // Chrome does not support sender.tab.cookieStoreId, which means it is undefined, and we end up using the default cookie store according to incognito split mode.
    if (request.message == "getSfHost") {
      let currentDomain;
      try {
        currentDomain = new URL(request.url).hostname;
      } catch {
        sendResponse(null);
        return false;
      }

      if (sender.tab?.url) {
        try {
          const senderUrl = new URL(sender.tab.url);
          if (senderUrl.protocol === "https:" && !SF_DOMAIN_REGEX.test(senderUrl.hostname)) {
            sendResponse(null);
            return false;
          }
        } catch {
          sendResponse(null);
          return false;
        }
      }

      // When on a *.visual.force.com page, the session in the cookie does not have API access,
      // so we read the corresponding session from *.salesforce.com page.
      // The first part of the session cookie is the OrgID,
      // which we use as key to support being logged in to multiple orgs at once.
      // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
      // There is no straight forward way to unambiguously understand if the user authenticated against salesforce.com or cloudforce.com
      // (and thereby the domain of the relevant cookie) cookie domains are therefore tried in sequence.
      chrome.cookies.get({url: request.url, name: "sid", storeId: sender.tab?.cookieStoreId}, cookie => {
        if (!cookie || currentDomain.endsWith(".mcas.ms")) { //Domain used by Microsoft Defender for Cloud Apps, where sid exists but cannot be read
          if (sender.tab?.id) {
            hostByTab.set(sender.tab.id, currentDomain);
          }
          sendResponse(currentDomain);
          return;
        }
        const [orgId] = cookie.value.split("!");
        const orderedDomains = ["salesforce.com", "cloudforce.com", "salesforce.mil", "cloudforce.mil", "sfcrmproducts.cn", "force.com"];

        let responded = false;
        let pending = orderedDomains.length;
        orderedDomains.forEach(cookieDomain => {
          chrome.cookies.getAll({name: "sid", domain: cookieDomain, secure: true, storeId: sender.tab?.cookieStoreId}, cookies => {
            pending--;
            if (!responded) {
              let sessionCookie = cookies?.find(c => c.value.startsWith(orgId + "!") && c.domain != "help.salesforce.com");
              if (sessionCookie) {
                responded = true;
                if (sender.tab?.id) {
                  hostByTab.set(sender.tab.id, sessionCookie.domain);
                }
                sendResponse(sessionCookie.domain);
                return;
              }
              if (pending === 0) {
                if (sender.tab?.id) {
                  hostByTab.set(sender.tab.id, currentDomain);
                }
                sendResponse(currentDomain);
              }
            }
          });
        });
      });
      return true; // Tell Chrome that we want to call sendResponse asynchronously.
    }
    if (request.message == "getSession") {
      if (!request.sfHost || typeof request.sfHost !== "string") {
        sendResponse(null);
        return false;
      }

      if (sender.tab?.url) {
        try {
          const senderUrl = new URL(sender.tab.url);
          if (senderUrl.protocol === "https:") {
            if (!SF_DOMAIN_REGEX.test(senderUrl.hostname)) {
              sendResponse(null);
              return false;
            }
            const senderBase = senderUrl.hostname.split(".")[0];
            const requestBase = request.sfHost.split(".")[0];
            const isSameOrg = senderBase && senderBase === requestBase;
            if (request.sfHost !== senderUrl.hostname && hostByTab.get(sender.tab.id) !== request.sfHost && !isSameOrg) {
              sendResponse(null);
              return false;
            }
          } else if (senderUrl.protocol === "chrome-extension:" || senderUrl.protocol === "moz-extension:") {
            if (!SF_DOMAIN_REGEX.test(request.sfHost)) {
              sendResponse(null);
              return false;
            }
          } else {
            sendResponse(null);
            return false;
          }
        } catch {
          sendResponse(null);
          return false;
        }
      } else {
        if (!SF_DOMAIN_REGEX.test(request.sfHost)) {
          sendResponse(null);
          return false;
        }
      }

      if (sender.tab?.id) {
        hostByTab.set(sender.tab.id, request.sfHost);
      }

      chrome.cookies.get({url: "https://" + request.sfHost, name: "sid", storeId: sender.tab?.cookieStoreId}, sessionCookie => {
        if (!sessionCookie) {
          sendResponse(null);
          return;
        }
        let session = {key: sessionCookie.value, hostname: sessionCookie.domain};
        sendResponse(session);
      });
      return true; // Tell Chrome that we want to call sendResponse asynchronously.
    } else if (request.message == "createWindow") {
      const brow = typeof browser === "undefined" ? chrome : browser;
      brow.windows.create({
        url: request.url,
        incognito: request.incognito ?? false
      });
    } else if (request.message == "reloadPage") {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.reload(tabs[0].id);
      });
    }
    return false;
  });
  chrome.action?.onClicked?.addListener(() => {
    getActiveTabHost((tab, targetHost) => {
      if (targetHost) {
        chrome.tabs.sendMessage(tab.id, {
          msg: "shortcut_pressed", sfHost: targetHost, command: "open-popup"
        }).catch(() => {
          chrome.runtime.sendMessage({
            msg: "shortcut_pressed", sfHost: targetHost, command: "open-popup"
          });
        });
      }
    });
  });
  chrome.commands?.onCommand?.addListener((command) => {
    getActiveTabHost((tab, targetHost) => {
      if (!targetHost) {
        return;
      }
      if (command.startsWith("link-")){
        let link;
        switch (command){
          case "link-setup":
            link = "/lightning/setup/SetupOneHome/home";
            break;
          case "link-home":
            link = "/";
            break;
          case "link-dev":
            link = "/_ui/common/apex/debug/ApexCSIPage";
            break;
        }
        chrome.tabs.create({
          url: `https://${targetHost}${link}`
        });

      } else if (command.startsWith("open-")){
        chrome.tabs.sendMessage(tab.id, {
          msg: "shortcut_pressed", command, sfHost: targetHost
        }).catch(() => {
          chrome.runtime.sendMessage({
            msg: "shortcut_pressed", command, sfHost: targetHost
          });
        });
      } else {
        chrome.tabs.create({
          url: `chrome-extension://${chrome.i18n.getMessage("@@extension_id")}/${command}.html?host=${targetHost}`
        });
      }
    });
  });

  chrome.runtime.onInstalled?.addListener(async (details) => {
    if (details.reason === "install") {
      chrome.tabs.create({
        url: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/welcome/"
      });
    } else if (details.reason === "update" && details.previousVersion?.startsWith("2.0")) {
      //TODO delete clearSobjectsListCache after 2.0.1 release, only for upgrade from 2.0.0 to 2.0.1
      await clearSobjectsListCache();
    }
  });

  chrome.runtime.setUninstallURL?.("https://forms.gle/y7LbTNsFqEqSrtyc6");
}
