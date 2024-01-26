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

function initButton(sfHost, inInspector) {
  let rootEl = document.createElement("div");
  rootEl.id = "insext";
  let btn = document.createElement("div");
  let iFrameLocalStorage = {};
  btn.className = "insext-btn";
  btn.tabIndex = 0;
  btn.accessKey = "i";
  btn.title = "Show Salesforce details (Alt+I / Shift+Alt+I)";
  rootEl.appendChild(btn);
  loadPopup();
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
      // Create a new label element for the checkbox
      const overflowLabel = document.createElement("label");
      overflowLabel.textContent = "Enable flow scrollability";
      overflowLabel.htmlFor = "overflow-checkbox";
      if (currentUrl.includes("sandbox")){
        overflowCheckbox.className = "checkboxScrollSandbox";
        overflowLabel.className = "labelCheckboxScrollSandbox";
      } else {
        overflowCheckbox.className = "checkboxScrollProd";
        overflowLabel.className = "labeCheckboxScrollProd";
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
      headerFlow.appendChild(overflowCheckbox);
      headerFlow.appendChild(overflowLabel);
      // Set the overflow property to "auto"
      overflowCheckbox.checked ? style.textContent = ".canvas {overflow : auto!important ; }" : style.textContent = ".canvas {overflow : hidden!important ; }";
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

  function setRootCSSProperties(rootElement, buttonElement) {
    let popupArrowOrientation = iFrameLocalStorage.popupArrowOrientation ? iFrameLocalStorage.popupArrowOrientation : "vertical";
    let popupArrowPosition = iFrameLocalStorage.popupArrowPosition ? (iFrameLocalStorage.popupArrowPosition + "%") : "122px";
    let img = document.createElement("img");
    if (popupArrowOrientation == "vertical") {
      rootElement.style.right = 0;
      rootElement.style.top = popupArrowPosition;
      img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAA40lEQVQoz2P4//8/AzpWzGj6L59U/V8urgxMg/g4FUn6J/+X9E38LxWc8V8htR67IpCkuGfMfxCQjSpENRFFkXvk/1+/foGxQloDSD0DVkVfvnyBY7hCdEVv3rxBwXCFIIdKh2WDFT1+/BgDo1qd2fL/1q1bWDFcoW5xz3/Xppn/oycu/X/x4kUMDFeoWdD136R8wn+f9rlgxSdOnEDBKFajK96/fz8coyjEpnj79u1gjKEQXXFE/+L/Gzdu/G9WMfG/am4HZlzDFAf3LPwfOWEJWBPIwwzYUg9MsXXNFDAN4gMAmASShdkS4AcAAAAASUVORK5CYII=";
      buttonElement.classList.add("insext-btn-vertical");
    } else {
      rootElement.style.bottom = "0px";
      rootElement.style.right = popupArrowPosition;
      img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAKCAYAAABrGwT5AAAAAXNSR0IArs4c6QAAAFBlWElmTU0AKgAAAAgAAgESAAMAAAABAAEAAIdpAAQAAAABAAAAJgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAD6ADAAQAAAABAAAACgAAAADdC3pnAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAABKElEQVQoFWNgwAI0C7r+6xb3/AdJKaTW/1fMaAKz0ZUyoguANHKzszEIcnMy3Hn+muHX2+cMLDwCDExs7Az3Z9ShqGdC1gzTKCHAyyDGz8OwszCM4c/Hdwy/P75l+PfrJwO6C+CakTXyc3EwlDnogM09M6eL4e+Xj1gNAGtG15hrrozsIIarSydjNYARXWOKnhQDJycnBubg4GBQDk5lYObhZ2DlFwaHARMocORFBRl4ONgYYtSEUGxE5zzevJDh77cvwEB8AQ4DJnZWFgY2FmaGSCU+dLVY+S+2LWZg+PeP4f+f3wwsP3//Yfj8/SdD6/G3DK/evceqAVkQFHiMwGhjZGFlYPn68xfDwzfvGX78+sPwYFYDSjwia4KxQdHF/JePgZGZmQEASqV1t0W3n+oAAAAASUVORK5CYII=";
      buttonElement.classList.add("insext-btn-horizontal");
    }
    buttonElement.appendChild(img);
  }

  function loadPopup() {
    btn.addEventListener("click", () => {
      if (!rootEl.classList.contains("insext-active")) {
        openPopup();
      } else {
        closePopup();
      }
    });

    let popupSrc = chrome.runtime.getURL("popup.html");
    let popupEl = document.createElement("iframe");
    popupEl.className = "insext-popup";
    popupEl.classList.add(localStorage.getItem("popupArrowOrientation") == "horizontal" ? "insext-popup-horizontal" : "insext-popup-vertical");
    popupEl.src = popupSrc;
    addEventListener("message", e => {
      if (e.source != popupEl.contentWindow) {
        return;
      }
      if (e.data.insextInitRequest) {
        // Set CSS classes for arrow button position
        iFrameLocalStorage = e.data.iFrameLocalStorage;
        popupEl.classList.add(iFrameLocalStorage.popupArrowOrientation == "horizontal" ? "insext-popup-horizontal" : "insext-popup-vertical");
        if (iFrameLocalStorage.popupArrowOrientation == "horizontal") {
          if (iFrameLocalStorage.popupArrowPosition < 8) {
            popupEl.classList.add("insext-popup-horizontal-left");
          } else if (iFrameLocalStorage.popupArrowPosition >= 90) {
            popupEl.classList.add("insext-popup-horizontal-right");
          } else {
            popupEl.classList.add("insext-popup-horizontal-centered");
          }
        } else if (iFrameLocalStorage.popupArrowOrientation == "vertical") {
          if (iFrameLocalStorage.popupArrowPosition >= 55) {
            popupEl.classList.add("insext-popup-vertical-up");
          }
        }
        setRootCSSProperties(rootEl, btn);
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
              document.addEventListener("click", copy);
            }
          });
        } else {
          document.querySelectorAll("." + apiNamesClass).forEach(e => e.remove());
        }
      }
    });
    rootEl.appendChild(popupEl);
    function copy(e){
      navigator.clipboard.writeText(e.target.innerText);
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
      popupEl.focus();
    }
    function closePopup() {
      rootEl.classList.remove("insext-active");
      removeEventListener("click", outsidePopupClick);
      popupEl.blur();
    }
    function outsidePopupClick(e) {
      // Close the popup when clicking outside it
      if (!rootEl.contains(e.target)) {
        closePopup();
      }
    }
  }

}
