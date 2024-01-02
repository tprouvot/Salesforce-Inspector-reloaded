"use strict";
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Perform cookie operations in the background page, because not all foreground pages have access to the cookie API.
  // Firefox does not support incognito split mode, so we use sender.tab.cookieStoreId to select the right cookie store.
  // Chrome does not support sender.tab.cookieStoreId, which means it is undefined, and we end up using the default cookie store according to incognito split mode.
  if (request.message == "getSfHost") {
    // When on a *.visual.force.com page, the session in the cookie does not have API access,
    // so we read the corresponding session from *.salesforce.com page.
    // The first part of the session cookie is the OrgID,
    // which we use as key to support being logged in to multiple orgs at once.
    // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
    // There is no straight forward way to unambiguously understand if the user authenticated against salesforce.com or cloudforce.com
    // (and thereby the domain of the relevant cookie) cookie domains are therefore tried in sequence.
    chrome.cookies.get({url: request.url, name: "sid", storeId: sender.tab.cookieStoreId}, cookie => {
      if (!cookie) {
        sendResponse(null);
        return;
      }
      let [orgId] = cookie.value.split("!");
      let orderedDomains = ["salesforce.com", "cloudforce.com", "salesforce.mil", "cloudforce.mil", "sfcrmproducts.cn"];

      orderedDomains.forEach(currentDomain => {
        chrome.cookies.getAll({name: "sid", domain: currentDomain, secure: true, storeId: sender.tab.cookieStoreId}, cookies => {
          let sessionCookie = cookies.find(c => c.value.startsWith(orgId + "!"));
          if (sessionCookie) {
            sendResponse(sessionCookie.domain);
          } else if (orderedDomains[orderedDomains.length] === currentDomain){
            sendResponse(null);
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
  return false;
});

chrome.commands.onCommand.addListener((command) => {
  console.log(`Command ${command} pressed`);
  let extensionPage;
  switch (command) {
    case "open-popup":
      extensionPage = "./data-import.html";
      break;
    case "data-import":
      extensionPage = "./data-import.html";
      break;
    case "data-export":
      extensionPage = "./data-export.html";
      break;
    case "open-options":
      extensionPage = "./options.html";
      break;
    default:
      console.log(`Command ${command} not found`);
  }
  if (extensionPage){
    chrome.tabs.create({
      url: extensionPage
    });
  } else {
    //post message to enable popup
    console.log("Open popup pressed");
  }
});
chrome.runtime.onInstalled.addListener(({reason}) => {
  if (reason === "install") {
    chrome.tabs.create({
      url: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/how-to/"
    });
  } else if (reason === "update"){
    //TODO Add the option to disable the tab opening with user preferences & handle beta version release note description
    chrome.tabs.create({
      url: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/release-note/"
    });
  }
});
