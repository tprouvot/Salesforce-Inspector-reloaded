/* exported initButton */
/* global showStdPageDetails */
"use strict";



// sfdcBody = normal Salesforce page
// ApexCSIPage = Developer Console
// auraLoadingBox = Lightning / Salesforce1
if (document.querySelector("body.sfdcBody, body.ApexCSIPage, #auraLoadingBox") || location.host.endsWith("visualforce.com")) {
  // We are in a Salesforce org
  chrome.runtime.sendMessage({message: "getSfHost", url: location.href}, sfHost => {
    if (sfHost) {
      initButton(sfHost, false);
    }
  });
}

function updateFavIcon(iFrameLocalStorage) {

  let fav = iFrameLocalStorage.customFavicon;
  if (fav) {
    let favicon = null;
    if (!location.protocol.startsWith("http")) {
      //extension icons
      if (fav.substring(0, 4).toLowerCase() == "http"){
        favicon = fav;
      } else {
        favicon = "data:image/svg+xml;base64," + btoa(`<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="295" height="295"><path fill="${fav}" d="M 34.333589,166.26501 C -8.096967,167.82209 -9.2647804,78.289729 45.233181,89.967864 42.469356,68.402242 53.913928,55.47844 75.012424,62.874592 73.143923,13.398228 116.66444,6.041003 143.52415,27.100572 c 33.94444,-38.927115 69.67954,-9.614997 67.34391,21.838112 55.43221,-37.25325 84.82218,14.519814 52.43482,57.612136 47.41323,5.6055 32.27058,60.68737 -9.07002,60.33703" id="path2" style="stroke-width:3.89271" /> <text xml:space="preserve" style="font-style:normal;font-weight:normal;font-size:44.4313px;line-height:0.75;font-family:sans-serif;text-align:end;text-anchor:end;fill:#ffffff;fill-opacity:1;stroke:none;stroke-width:1.12462" x="247.08156" y="107.29181" id="text12"><tspan style="font-style:italic;font-variant:normal;font-weight:bold;font-stretch:normal;font-size:72.7057px;font-family:Arial;-inkscape-font-specification:'Arial Bold Italic';text-align:end;text-anchor:end;fill:#ffffff;fill-opacity:1;stroke-width:1.12462" x="247.08156" y="107.29181" id="tspan4">SFI</tspan><tspan style="font-style:italic;font-variant:normal;font-weight:bold;font-stretch:normal;font-family:Arial;-inkscape-font-specification:'Arial Bold Italic';text-align:end;text-anchor:end;fill:#ffffff;fill-opacity:1;stroke-width:1.12462" x="247.08156" y="159.8015" id="tspan10"><tspan style="font-size:68.6665px;fill:#ffffff;stroke-width:1.12462" id="tspan6">A</tspan><tspan style="font-size:28.2745px;fill:#ffffff;fill-opacity:1;stroke-width:1.12462" id="tspan8">dvanced</tspan></tspan></text></svg>`);
      }
    } else if (iFrameLocalStorage.customFaviconSF == "true"){
      if (fav.substring(0, 4).toLowerCase() == "http"){
        favicon = fav;
      } else {
        //default fill "#00A1E0"
        favicon = "data:image/svg+xml;base64," + btoa(`<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="295" height="295"><path d="m113 21.3c8.78-9.14 21-14.8 34.5-14.8 18 0 33.6 10 42 24.9a58 58 0 0 1 23.7-5.05c32.4 0 58.7 26.5 58.7 59.2s-26.3 59.2-58.7 59.2c-3.96 0-7.82-0.398-11.6-1.15-7.35 13.1-21.4 22-37.4 22a42.7 42.7 0 0 1-18.8-4.32c-7.45 17.5-24.8 29.8-45 29.8-21.1 0-39-13.3-45.9-32a45.1 45.1 0 0 1-9.34 0.972c-25.1 0-45.4-20.6-45.4-45.9 0-17 9.14-31.8 22.7-39.8a52.6 52.6 0 0 1-4.35-21c0-29.2 23.7-52.8 52.9-52.8 17.1 0 32.4 8.15 42 20.8" fill="${fav}"/></svg>`);
      }
    }
    if (favicon != null) {
      document.querySelectorAll("link[rel='icon']").forEach(l => l.remove());
      document.querySelectorAll("link[rel='shortcut icon']").forEach(l => l.remove());
      //TODO if url is chrome-extension used the extension fav icon
      let link = document.createElement("link");
      link.setAttribute("rel", "icon");
      link.orgType = "image/x-icon";
      link.href = favicon;
      document.head.appendChild(link);
    }
  }
}
function initButton(sfHost, inInspector) {
  let rootEl = document.createElement("div");
  rootEl.id = "insext";
  let btn = document.createElement("div");
  let iFrameLocalStorage = {};
  btn.className = "insext-btn";
  btn.tabIndex = 0;
  btn.accessKey = "i";
  btn.title = "Show Salesforce details (Alt+I / Shift+Alt+I)";
  loadPopup();
  rootEl.appendChild(btn);
  document.body.appendChild(rootEl);

  addFlowScrollability();


  function addFlowScrollability(popupEl) {
    const currentUrl = window.location.href;
    // Check the current URL for the string "builder_platform_interaction"
    if (currentUrl.includes("builder_platform_interaction")) {
      // Create a new checkbox element
      const headerFlow = document.querySelector("builder_platform_interaction-container-common");
      const overflowCheckbox = document.createElement("input");
      overflowCheckbox.type = "checkbox";
      overflowCheckbox.id = "overflow-checkbox";
      const checkboxState = iFrameLocalStorage.scrollOnFlowBuilder;
      // Check local storage for the checkbox state
      (checkboxState != null) ? (overflowCheckbox.checked = checkboxState) : (overflowCheckbox.checked = true);

      // Create a new anchor to go to flow details
      const versionDetailsButton = document.createElement("a");
      versionDetailsButton.textContent = "Version Details";
      versionDetailsButton.classList.add("headerFixed");
      versionDetailsButton.classList.add("versionDetailsButton");
      if (currentUrl.includes("sandbox")){
        versionDetailsButton.classList.add("versionDetailsButtonSandbox");
      } else {
        versionDetailsButton.classList.add("versionDetailsButtonProd");
      }

      // Create a new button element to clear old flow
      const clearFlowButton = document.createElement("a");
      clearFlowButton.textContent = "Clear old flow versions";
      clearFlowButton.classList.add("headerFixed");
      clearFlowButton.classList.add("clearFlowButton");
      if (currentUrl.includes("sandbox")){
        clearFlowButton.classList.add("clearFlowButtonSandbox");
      } else {
        clearFlowButton.classList.add("clearFlowButtonProd");
      }

      // Create a new label element for the checkbox
      const overflowLabel = document.createElement("label");
      overflowLabel.textContent = "Enable flow scrollability";
      overflowLabel.htmlFor = "overflow-checkbox";
      overflowCheckbox.classList.add("headerFixed");
      overflowLabel.classList.add("headerFixed");
      overflowCheckbox.classList.add("checkboxScroll");
      overflowLabel.classList.add("labeCheckboxScroll");
      if (currentUrl.includes("sandbox")){
        overflowCheckbox.classList.add("checkboxScrollSandbox");
        overflowLabel.classList.add("labelCheckboxScrollSandbox");
      } else {
        overflowCheckbox.classList.add("checkboxScrollProd");
        overflowLabel.classList.add("labeCheckboxScrollProd");
      }
      // Get a reference to the <head> element
      const head = document.head;
      // Create a new <style> element
      const style = document.createElement("style");
      // Set the initial text content of the <style> element
      style.textContent = ".canvas {overflow : auto!important ; }";
      // Append the <style> element to the <head> element
      head.appendChild(style);
      // Append the checkbox and label elements to the body of the document
      headerFlow.appendChild(versionDetailsButton);
      headerFlow.appendChild(clearFlowButton);
      headerFlow.appendChild(overflowCheckbox);
      headerFlow.appendChild(overflowLabel);
      // Set the overflow property to "auto"
      overflowCheckbox.checked ? style.textContent = ".canvas {overflow : auto!important ; }" : style.textContent = ".canvas {overflow : hidden!important ; }";

      versionDetailsButton.addEventListener("click", () => {
        popupEl.contentWindow.postMessage({
          showFlowVersionDetails: JSON.stringify({contextUrl: window.location.href})
        }, "*");
      });

      clearFlowButton.addEventListener("click", () => {
        let clearArgs = {
          contextUrl: window.location.href
        };
        popupEl.contentWindow.postMessage({
          clearOlderFlows: JSON.stringify(clearArgs)
        }, "*");
      });

      // Listen for changes to the checkbox state
      overflowCheckbox.addEventListener("change", function() {
        // Check if the checkbox is currently checked
        // Save the checkbox state to local storage
        popupEl.contentWindow.postMessage({
          updateLocalStorage: true,
          key: "scrollOnFlowBuilder",
          value: JSON.stringify(this.checked)
        }, "*");
        // Set the overflow property to "auto"
        this.checked ? style.textContent = ".canvas {overflow : auto!important ; }" : style.textContent = ".canvas {overflow : hidden!important ; }";
      });
    }
  }

  function updateButtonCSSPropertiesFromStorage(rootElement, buttonElement, popupEl) {
    let popupArrowOrientation = iFrameLocalStorage.popupArrowOrientation ? iFrameLocalStorage.popupArrowOrientation : "vertical";
    let popupArrowPosition = iFrameLocalStorage.popupArrowPosition ? (iFrameLocalStorage.popupArrowPosition) : "15";
    updateButtonCSSPropertiesIfNeeded(rootElement, buttonElement, popupEl, popupArrowOrientation, popupArrowPosition);
  }

  function updateButtonCSSPropertiesIfNeeded(rootElement, buttonElement, popupEl, popupArrowOrientation, popupArrowPosition) {

    if (popupArrowOrientation == "vertical") {
      rootElement.style.top = popupArrowPosition + "%";

      popupEl.classList.remove("insext-popup-horizontal");
      popupEl.classList.remove("insext-popup-horizontal-left");
      popupEl.classList.remove("insext-popup-horizontal-right");
      popupEl.classList.remove("insext-popup-horizontal-centered");

      popupEl.classList.add("insext-popup-vertical");
      if (popupArrowPosition >= 55) {
        popupEl.classList.add("insext-popup-vertical-up");
      } else {
        popupEl.classList.remove("insext-popup-vertical-up");
      }

      if (!(buttonElement.classList.contains("insext-btn-vertical"))) {
        rootElement.style.right = "0px";
        buttonElement.classList.add("insext-btn-vertical");
        buttonElement.classList.remove("insext-btn-horizontal");
        buttonElement.innerText = "";
        let img = document.createElement("img");
        img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAA40lEQVQoz2P4//8/AzpWzGj6L59U/V8urgxMg/g4FUn6J/+X9E38LxWc8V8htR67IpCkuGfMfxCQjSpENRFFkXvk/1+/foGxQloDSD0DVkVfvnyBY7hCdEVv3rxBwXCFIIdKh2WDFT1+/BgDo1qd2fL/1q1bWDFcoW5xz3/Xppn/oycu/X/x4kUMDFeoWdD136R8wn+f9rlgxSdOnEDBKFajK96/fz8coyjEpnj79u1gjKEQXXFE/+L/Gzdu/G9WMfG/am4HZlzDFAf3LPwfOWEJWBPIwwzYUg9MsXXNFDAN4gMAmASShdkS4AcAAAAASUVORK5CYII=";
        buttonElement.appendChild(img);
      }
    } else {
      // horizontal
      rootElement.style.right = popupArrowPosition + "%";

      if (popupArrowPosition < 8) {
        popupEl.classList.add("insext-popup-horizontal-left");
        popupEl.classList.remove("insext-popup-horizontal-right");
        popupEl.classList.remove("insext-popup-horizontal-centered");
      } else if (popupArrowPosition >= 90) {
        popupEl.classList.remove("insext-popup-horizontal-left");
        popupEl.classList.add("insext-popup-horizontal-right");
        popupEl.classList.remove("insext-popup-horizontal-centered");
      } else {
        popupEl.classList.remove("insext-popup-horizontal-left");
        popupEl.classList.remove("insext-popup-horizontal-right");
        popupEl.classList.add("insext-popup-horizontal-centered");
      }

      popupEl.classList.add("insext-popup-horizontal");
      popupEl.classList.remove("insext-popup-vertical");
      popupEl.classList.remove("insext-popup-vertical-up");

      if (!(buttonElement.classList.contains("insext-btn-horizontal"))) {
        rootElement.style.bottom = "0px";
        rootElement.style.top = "";
        buttonElement.classList.add("insext-btn-horizontal");
        buttonElement.classList.remove("insext-btn-vertical");
        buttonElement.innerText = "";
        let img = document.createElement("img");
        img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAKCAYAAABrGwT5AAAAAXNSR0IArs4c6QAAAFBlWElmTU0AKgAAAAgAAgESAAMAAAABAAEAAIdpAAQAAAABAAAAJgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAD6ADAAQAAAABAAAACgAAAADdC3pnAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAABKElEQVQoFWNgwAI0C7r+6xb3/AdJKaTW/1fMaAKz0ZUyoguANHKzszEIcnMy3Hn+muHX2+cMLDwCDExs7Az3Z9ShqGdC1gzTKCHAyyDGz8OwszCM4c/Hdwy/P75l+PfrJwO6C+CakTXyc3EwlDnogM09M6eL4e+Xj1gNAGtG15hrrozsIIarSydjNYARXWOKnhQDJycnBubg4GBQDk5lYObhZ2DlFwaHARMocORFBRl4ONgYYtSEUGxE5zzevJDh77cvwEB8AQ4DJnZWFgY2FmaGSCU+dLVY+S+2LWZg+PeP4f+f3wwsP3//Yfj8/SdD6/G3DK/evceqAVkQFHiMwGhjZGFlYPn68xfDwzfvGX78+sPwYFYDSjwia4KxQdHF/JePgZGZmQEASqV1t0W3n+oAAAAASUVORK5CYII=";
        buttonElement.appendChild(img);
      }
    }
  }

  function loadPopup() {
    btn.addEventListener("click", () => {
      if (!rootEl.classList.contains("insext-active")) {
        openPopup();
      } else {
        closePopup();
      }
    });
    let popupWrapper = document.createElement("div");
    let popupEl = document.createElement("iframe");
    popupEl.classList.add("insext-popup-iframe");
    function onbuttonmove(event) {
      let popupArrowOrientation;
      let popupArrowPosition;
      // if above the diagonal
      if (event.clientY > (event.clientX / document.documentElement.clientWidth) * document.documentElement.clientHeight) {
        popupArrowOrientation = "horizontal";
        popupArrowPosition = 100 - Math.floor(event.clientX * 100 / document.documentElement.clientWidth);
      } else {
        popupArrowOrientation = "vertical";
        popupArrowPosition = Math.floor(event.clientY * 100 / document.documentElement.clientHeight);
      }
      localStorage.setItem("popupArrowOrientation", popupArrowOrientation);
      localStorage.setItem("popupArrowPosition", popupArrowPosition);
      updateButtonCSSPropertiesIfNeeded(rootEl, btn, popupWrapper, popupArrowOrientation, popupArrowPosition);

    }
    function endmove() {
      window.removeEventListener("mousemove", onbuttonmove);
      window.removeEventListener("mouseup", endmove);
    }
    btn.addEventListener("mousedown", () => {
      window.addEventListener("mousemove", onbuttonmove);
      window.addEventListener("mouseup", endmove);
    });

    let popupSrc = chrome.runtime.getURL("popup.html");
    popupWrapper.className = "insext-popup";
    popupWrapper.classList.add(localStorage.getItem("popupArrowOrientation") == "horizontal" ? "insext-popup-horizontal" : "insext-popup-vertical");

    popupEl.src = popupSrc;
    addEventListener("message", e => {
      if (e.source != popupEl.contentWindow) {
        return;
      }
      if (e.data.insextInitRequest) {
        // Set CSS classes for arrow button position
        iFrameLocalStorage = e.data.iFrameLocalStorage;

        updateButtonCSSPropertiesFromStorage(rootEl, btn, popupWrapper);
        addFlowScrollability(popupEl);
        popupEl.contentWindow.postMessage({
          insextInitResponse: true,
          sfHost,
          inDevConsole: !!document.querySelector("body.ApexCSIPage"),
          inLightning: !!document.querySelector("#auraLoadingBox"),
          inInspector,
        }, "*");
      }
      if (e.data.insextClosePopup) {
        closePopup();
      }"field-api-name";
      if (e.data.insextShowStdPageDetails) {
        showStdPageDetails(e.data.insextData, e.data.insextAllFieldSetupLinks);
      }
      if (e.data.insextShowApiName) {
        let apiNamesClass = "field-api-name";
        if (e.data.btnLabel.startsWith("Show")){
          document.querySelectorAll("record_flexipage-record-field > div, records-record-layout-item > div, div .forcePageBlockItemView").forEach(field => {
            let label = field.querySelector("span");
            if (field.dataset.targetSelectionName && label.querySelector("mark") == null){
              label.innerText = label.innerText + " ";
              const fieldApiName = document.createElement("mark");
              fieldApiName.className = apiNamesClass;
              fieldApiName.style.cursor = "copy";
              fieldApiName.innerText = field.dataset.targetSelectionName.split(".")[2];
              label.appendChild(fieldApiName);
              label.addEventListener("click", copy);
            }
          });
        } else {
          document.querySelectorAll("." + apiNamesClass).forEach(e => e.remove());
        }
      }
      if (e.data.updateIcon){
        updateFavIcon(e.data.iFrameLocalStorage);
      }
    });
    popupWrapper.appendChild(popupEl);
    let resizeHandler = document.createElement("div");
    resizeHandler.classList.add("resizable");
    popupWrapper.style.width = (localStorage.getItem("popupWidth") || "280") + "px";
    popupWrapper.style.height = (localStorage.getItem("popupHeight") || "600") + "px";
    let resizeX = 0;
    let resizeY = 0;
    let resizeHeight = 0;
    let resizeWidth = 0;
    function onResizeMove(event) {
      if (resizeX == 0 && resizeY == 0) {
        resizeX = event.clientX;
        resizeY = event.clientY;
        resizeHeight = popupWrapper.clientHeight;
        resizeWidth = popupWrapper.clientWidth;
      } else {
        let popupHeight;
        if (popupWrapper.classList.contains("insext-popup-horizontal")) {
          popupHeight = resizeHeight + (resizeY - event.clientY);
        } else {
          popupHeight = resizeHeight - (resizeY - event.clientY);
        }
        let popupWidth = resizeWidth - (event.clientX - resizeX);
        localStorage.setItem("popupWidth", popupWidth);
        localStorage.setItem("popupHeight", popupHeight);
        popupWrapper.style.width = popupWidth + "px";
        popupWrapper.style.height = popupHeight + "px";
      }
    }
    function endResizeMove() {
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", endResizeMove);
      resizeX = 0;
      resizeY = 0;
    }
    popupWrapper.addEventListener("mousedown", () => {
      window.addEventListener("mousemove", onResizeMove);
      window.addEventListener("mouseup", endResizeMove);
    });


    popupWrapper.appendChild(resizeHandler);
    rootEl.appendChild(popupWrapper);
    // Function to handle copy action
    function copy(e) {
      // Retrieve the text content of the target element triggered by the event
      const originalText = e.target.innerText; // Save the original text
      // Attempt to copy the text to the clipboard
      navigator.clipboard.writeText(originalText).then(() => {
        // Create a new span element to show the copy success indicator
        const copiedIndicator = document.createElement("span");
        copiedIndicator.textContent = "Copied ✓"; // Set the text content to indicate success
        copiedIndicator.className = "copiedText"; // Assign a class for styling purposes

        // Add the newly created span right after the clicked element in the DOM
        if (e.target.nextSibling) {
          // If the target has a sibling, insert the indicator before the sibling
          e.target.parentNode.insertBefore(copiedIndicator, e.target.nextSibling);
        } else {
          // If no sibling, append the indicator as the last child of the parent
          e.target.parentNode.appendChild(copiedIndicator);
        }

        // Remove the indicator span after 2 seconds
        setTimeout(() => {
          if (copiedIndicator.parentNode) {
            // Ensure the element still has a parent before removing
            copiedIndicator.parentNode.removeChild(copiedIndicator);
          }
        }, 2000); // Set timeout for 2 seconds
      }).catch(err => {
        // Log an error message if the copy action fails
        console.error("Copy failed: ", err);
      });
    }
    function openPopup() {
      let activeContentElem = document.querySelector("div.windowViewMode-normal.active, section.oneConsoleTab div.windowViewMode-maximized.active.lafPageHost");
      let isFieldsPresent = activeContentElem ? !!activeContentElem.querySelector("record_flexipage-record-field > div, records-record-layout-item > div, div .forcePageBlockItemView") : false;
      popupEl.contentWindow.postMessage({insextUpdateRecordId: true,
        locationHref: location.href,
        isFieldsPresent
      }, "*");
      rootEl.classList.add("insext-active");
      // These event listeners are only enabled when the popup is active to avoid interfering with Salesforce when not using the inspector
      addEventListener("click", outsidePopupClick);
      popupWrapper.focus();
    }
    function closePopup() {
      rootEl.classList.remove("insext-active");
      removeEventListener("click", outsidePopupClick);
      popupWrapper.blur();
    }
    function outsidePopupClick(e) {
      // Close the popup when clicking outside it
      if (!rootEl.contains(e.target)) {
        closePopup();
      }
    }
  }

}
