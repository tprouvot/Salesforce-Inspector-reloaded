
let sfHost;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Perform cookie operations in the background page, because not all foreground pages have access to the cookie API.
  // Firefox does not support incognito split mode, so we use sender.tab.cookieStoreId to select the right cookie store.
  // Chrome does not support sender.tab.cookieStoreId, which means it is undefined, and we end up using the default cookie store according to incognito split mode.
  if (request.message == "getSfHost") {
    const currentDomain = new URL(request.url).hostname;
    // When on a *.visual.force.com page, the session in the cookie does not have API access,
    // so we read the corresponding session from *.salesforce.com page.
    // The first part of the session cookie is the OrgID,
    // which we use as key to support being logged in to multiple orgs at once.
    // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
    // There is no straight forward way to unambiguously understand if the user authenticated against salesforce.com or cloudforce.com
    // (and thereby the domain of the relevant cookie) cookie domains are therefore tried in sequence.
    chrome.cookies.get({url: request.url, name: "sid", storeId: sender.tab.cookieStoreId}, cookie => {
      if (!cookie || currentDomain.endsWith(".mcas.ms")) { //Domain used by Microsoft Defender for Cloud Apps, where sid exists but cannot be read
        sendResponse(currentDomain);
        return;
      }
      const [orgId] = cookie.value.split("!");
      const orderedDomains = ["salesforce.com", "cloudforce.com", "salesforce.mil", "cloudforce.mil", "sfcrmproducts.cn", "force.com"];

      orderedDomains.forEach(currentDomain => {
        chrome.cookies.getAll({name: "sid", domain: currentDomain, secure: true, storeId: sender.tab.cookieStoreId}, cookies => {

          let sessionCookie = cookies.find(c => c.value.startsWith(orgId + "!") && c.domain != "help.salesforce.com");
          if (sessionCookie) {
            sendResponse(sessionCookie.domain);
          }
        });
      });
    });
    return true; // Tell Chrome that we want to call sendResponse asynchronously.
  }
  if (request.message == "getSession") {
    sfHost = request.sfHost;
    chrome.cookies.get({url: "https://" + request.sfHost, name: "sid", storeId: sender.tab.cookieStoreId}, sessionCookie => {
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
chrome.action.onClicked.addListener(() => {
  chrome.runtime.sendMessage({
    msg: "shortcut_pressed", sfHost, command: "open-popup"
  });
});
chrome.commands?.onCommand.addListener((command) => {
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
      url: `https:///${sfHost}${link}`
    });

  } else if (command === "open-show-all-data") {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      let tab = tabs[0];
      if (!tab?.url) return;
      let tabUrl = tab.url;
      let currentDomain;
      try { currentDomain = new URL(tabUrl).hostname; } catch { return; }
      chrome.cookies.get({url: tabUrl, name: "sid", storeId: tab.cookieStoreId}, cookie => {
        if (!cookie || currentDomain.endsWith(".mcas.ms")) {
          openShowAllData(currentDomain, tabUrl);
          return;
        }
        const [orgId] = cookie.value.split("!");
        const orderedDomains = ["salesforce.com", "cloudforce.com", "salesforce.mil", "cloudforce.mil", "sfcrmproducts.cn", "force.com"];
        let resolved = false;
        orderedDomains.forEach(domain => {
          chrome.cookies.getAll({name: "sid", domain, secure: true, storeId: tab.cookieStoreId}, cookies => {
            if (resolved) return;
            let sessionCookie = cookies.find(c => c.value.startsWith(orgId + "!") && c.domain != "help.salesforce.com");
            if (sessionCookie) {
              resolved = true;
              openShowAllData(sessionCookie.domain, tabUrl);
            }
          });
        });
      });
    });
  } else if (command.startsWith("open-")){
    chrome.runtime.sendMessage({
      msg: "shortcut_pressed", command, sfHost
    });
  } else {
    chrome.tabs.create({
      url: `chrome-extension://${chrome.i18n.getMessage("@@extension_id")}/${command}.html?host=${sfHost}`
    });
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/welcome/"
    });
  } else if (details.reason === "update" && details.previousVersion?.startsWith("2.0")) {
    //TODO delete clearSobjectsListCache after 2.0.1 release, only for upgrade from 2.0.0 to 2.0.1
    await clearSobjectsListCache();
  }
});

async function clearSobjectsListCache() {
  try {
    const storage = (typeof chrome !== "undefined" && chrome.storage) ? chrome.storage : browser.storage;
    if (!storage?.local) return;
    const allData = await storage.local.get(null);
    const keysToRemove = Object.keys(allData || {}).filter(key =>
      key === "cache_sobjectsList"
    );
    if (keysToRemove.length > 0) {
      await storage.local.remove(keysToRemove);
    }
  } catch (e) {
    console.error("Error clearing sobjectsList cache on update:", e);
  }
}
function openShowAllData(host, tabUrl) {
  let url;
  try { url = new URL(tabUrl); } catch { return; }
  let sobject = null;
  let sobjectMatch = url.pathname.match(/\/lightning\/[ro]\/([a-zA-Z0-9_]+)\/[a-zA-Z0-9]+/);
  if (sobjectMatch) sobject = sobjectMatch[1];
  let recordId = null;
  if (url.pathname.includes("/builder_platform_interaction/flowBuilder.app")) {
    let flowId = url.searchParams.get("flowId");
    if (flowId?.startsWith("301")) recordId = flowId;
  } else {
    for (let p of url.pathname.split("/")) {
      if (p.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/) && p.includes("0000")) {
        recordId = p;
        break;
      }
    }
  }
  let args = new URLSearchParams();
  args.set("host", host);
  if (sobject) args.set("objectType", sobject);
  if (recordId) args.set("recordId", recordId);
  chrome.tabs.create({url: chrome.runtime.getURL("inspect.html?" + args)});
}
chrome.runtime.setUninstallURL("https://forms.gle/y7LbTNsFqEqSrtyc6");
