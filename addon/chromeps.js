var chromeps = (function() {
  
  var privateTabId = null;
  var callbacks = {};

  function privateGetActiveTab(callback) {
    if (chrome.tabs) {
      var tabQuery = {
        active: true,
        currentWindow: true
      };

      chrome.tabs.query(tabQuery, function(tabs) {
        callback(tabs[0]);
      });
    }
  }

  function privateSendToTabs(message) {
    // Send message to all tabs
    if (message.to === 'all') {
      chrome.tabs.query({}, function(tabs) {
        for (var i=0; i<tabs.length; i++) {
          chrome.tabs.sendMessage(tabs[i].id, message);
        }
      });
    }
    // Only send to active tab
    else if (message.to === 'active') {
      privateGetActiveTab(function(tab) {
        chrome.tabs.sendMessage(tab.id, message);
      });
    }
    // Send to same tab that original message came from
    else if (message.to === 'same') {
      chrome.tabs.sendMessage(message.content.tabId, message);
    }
  }

  // Handy little function to retrieve the ID of the calling tab. Currently
  // the only way to get the tab id is by asking the background page. In this
  // implementation the tab will request the tab id from the background page
  // only the first time. Subsequent calls return the original value.
  function publicGetTabId(callback) {
    if (!chrome.tabs) {
      if (privateTabId) {
        callback(privateTabId);
      }
      else {
        chrome.runtime.sendMessage('get_tab_id', function(tabId) {
          privateTabId = tabId;
          callback(privateTabId);
        });
      }
    }
  }

  function privateRegisterListener() {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      //console.log("receiving", message);
      // Special case where tab is requesting it's tab ID. Simply return it
      if (message === 'get_tab_id') {
        sendResponse(sender.tab.id);
        return;
      }

      // If the message is from a content script and this instance of pubsub is
      // the background script, rebroadcast the message.
      if (chrome.tabs && message.from === 'content_script') {
        // attach the tab id in case the subscriber needs it
        message.content.tabId = sender.tab.id;
        privateSendToTabs(message);
      }

      if (callbacks[message.filter]) {
        for (var i=0; i<callbacks[message.filter].length; i+=1) {
          callbacks[message.filter][i](message.content);
        }
      }

    });
  }

  function privateSendMessage(filter, message, to) {
    chromeMsg = {
      'filter': filter,
      'content': message,
      'to': to
    };

    // If sending from the background page, send directly to the tabs. If
    // sending from a content script, we need to send it to the background
    // script, which will re-broadcast it out to the tabs.
    if (chrome.tabs) {
      chromeMsg.from = 'background_page';
      privateSendToTabs(chromeMsg);
    }
    else {
      chromeMsg.from = 'content_script';
    }

    chrome.runtime.sendMessage(chromeMsg);
  }

  function publicPublish(filter, message) {
    privateSendMessage(filter, message, 'all');
  }

  function publicPublishActive(filter, message) {
    privateSendMessage(filter, message, 'active');
  }

  function publicPublishSame(filter, message) {
    privateSendMessage(filter, message, 'same');
  }

  function publicSubscribe(filter, callback) {
    if (callbacks[filter] === undefined) {
      callbacks[filter] = [];
    }
    callbacks[filter].push(callback);
  }

  privateRegisterListener();

  return {
    publish: publicPublish,
    publishActive: publicPublishActive,
    publishSame: publicPublishSame,
    subscribe: publicSubscribe,
    getTabId: publicGetTabId
  }

}());