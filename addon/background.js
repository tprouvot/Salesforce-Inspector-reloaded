"use strict";
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
      const orderedDomains = ["salesforce.com", "cloudforce.com", "salesforce.mil", "cloudforce.mil", "sfcrmproducts.cn"];

      orderedDomains.forEach(currentDomain => {
        chrome.cookies.getAll({name: "sid", domain: currentDomain, secure: true, storeId: sender.tab.cookieStoreId}, cookies => {
          let sessionCookie = cookies.find(c => c.value.startsWith(orgId + "!"));
          if (sessionCookie) {
            sendResponse(sessionCookie.domain);
          }
        });
      });
    });
    return true; // Tell Chrome that we want to call sendResponse asynchronously.
  }
  if (request.message == "getSession") {
    chrome.cookies.get({url: "https://" + request.sfHost, name: "sid", storeId: sender.tab.cookieStoreId}, sessionCookie => {
      if (!sessionCookie) {
        sendResponse(null);
        return;
      }
      let session = {key: sessionCookie.value, hostname: sessionCookie.domain};
      sendResponse(session);
    });
    return true; // Tell Chrome that we want to call sendResponse asynchronously.
  }
  if (request.message == "lightningNavigate") {
    const requestDetails = JSON.parse(JSON.stringify(request.details));
    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ success: false, message: "No active tab found" });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: handleLightningNavigation,
        args: [requestDetails],
        world: 'MAIN',
        injectImmediately: true
      })
        .then(res => {sendResponse(res[0].result)})
        .catch(err => {sendResponse({ success: false, message: err.message })});
    });
    return true;
  }
  return false;
});
chrome.runtime.onInstalled.addListener(({reason}) => {
  if (reason === "install") {
    chrome.tabs.create({
      url: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/welcome/"
    });
  }
});
chrome.runtime.setUninstallURL("https://forms.gle/y7LbTNsFqEqSrtyc6");

function handleLightningNavigation(details) {
  console.log("background.js: handling lightning-navigation", details);
  try {
    switch (details.navigationType) {
      case "recordId":
        navigateToSObject(details.recordId);
        break;
      default:
        throw new Error("Invalid navigation type");
    }
    return { success: true, message: "Success" };
  } catch (error) {
    return { success: false, message: error.message };
  }

  function navigateToSObject(recordId) {
    const e = $A.get("e.force:navigateToSObject");
    e.setParams({ "recordId": recordId });
    e.fire();
  }
}