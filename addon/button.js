// sfdcBody: normal Salesforce page
// ApexCSIPage: Developer Console
// auraLoadingBox: Lightning / Salesforce1
// studioBody: Exoperience Builder
// flowContainer: Flow Debugger
const visualForceDomains = ["visualforce.com", "vf.force.com"];
if (document.querySelector("body.sfdcBody, body.ApexCSIPage, #auraLoadingBox, #studioBody, #flowContainer") || visualForceDomains.filter(host => location.host.endsWith(host)).length > 0) {
  // We are in a Salesforce org
  chrome.runtime.sendMessage({message: "getSfHost", url: location.href}, sfHost => {
    if (sfHost) {
      initButton(sfHost, false);
      let script = document.createElement("script");
      script.src = chrome.runtime.getURL("inject.js");
      document.body.appendChild(script);
    }
  });
}

function initButton(sfHost, inInspector) {
  let rootEl = document.createElement("div");
  rootEl.id = "insext";
  let btn = document.createElement("button");
  let iFrameLocalStorage = {};
  btn.type = "button";
  btn.className = "insext-btn";
  btn.accessKey = "i";
  btn.title = "Show Salesforce details (Alt+I / Shift+Alt+I)";
  rootEl.appendChild(btn);
  loadPopup(sfHost);
  document.body.appendChild(rootEl);


  // Calulates default position, left to right for horizontal, and adds boundaries to keep it on screen
  function calcPopup({popupArrowOrientation: o, popupArrowPosition: pos, popupHeighDynamictMode: dynamicHeight}) {
    o = o || "vertical"; // Default to vertical
    const isVertical = o === "vertical";
    pos = pos ? Math.min(95, pos) + "%" : "122px";
    const [posStyle, oStyle] = isVertical ? ["top", "right"] : ["left", "bottom"];
    const imgSrc = isVertical
      ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M14 7l-5 5 5 5' stroke='%230176d3' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"
      : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M7 10l5 5 5-5' stroke='%230176d3' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
    let btnClasses = [];
    btnClasses.push(`insext-btn-${o}`);
    if (dynamicHeight === "true") {
      btnClasses.push("insext-btn-dynamic-height");
    }
    return {pos, posStyle, oStyle, imgSrc, btnClasses};
  }

  function setRootCSSProperties(rootElement, buttonElement) {
    const p = calcPopup(iFrameLocalStorage);
    let img = document.createElement("img");
    img.role = "presentation";
    img.src = p.imgSrc;
    rootElement.style[p.posStyle] = p.pos;
    rootElement.style[p.oStyle] = 0;
    p.btnClasses.forEach(item => buttonElement.classList.add(item));
    buttonElement.appendChild(img);
  }

  function observeElement(selector, callback) {
    const targetNode = document.querySelector(selector);

    if (targetNode) {
      callback(targetNode);
    } else {
      const observer = new MutationObserver((mutations, obs) => {
        const targetNode = document.querySelector(selector);
        if (targetNode) {
          callback(targetNode);
          obs.disconnect();
        }
      });

      observer.observe(document, {
        childList: true,
        subtree: true
      });
    }
  }

  // Salesforce pages: Salesforce cloud icon, color filled in the SVG
  function salesforceCloudSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="${color}" d="M13.339 7.219a5.62 5.62 0 0 1 4.063-1.74c2.078 0 3.938 1.203 4.917 2.943c.844-.401 1.802-.604 2.802-.604c3.802 0 6.88 3.12 6.88 6.964c0 3.839-3.083 6.958-6.901 6.958a7.3 7.3 0 0 1-1.359-.141a5 5 0 0 1-4.401 2.604a5.3 5.3 0 0 1-2.198-.5a5.76 5.76 0 0 1-5.302 3.495a5.74 5.74 0 0 1-5.401-3.755a5 5 0 0 1-1.099.099c-2.938 0-5.339-2.401-5.339-5.401c0-2 1.078-3.74 2.677-4.677A6.1 6.1 0 0 1 2.157 11c0-3.438 2.802-6.198 6.203-6.198c2.042 0 3.797.938 4.958 2.401z"/></svg>`;
  }

  // Extension pages: the extension's own icon, color filled in the SVG
  function extensionIconSvg(color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="295" height="295"><path fill="${color}" d="m200 52 4 3 1.504-1.207c8.488-6.62 16.633-9.741 27.496-8.793 11.188 2.2 19.367 7.729 26 17a80 80 0 0 1 1.75 4.688c2.092 5.411 6.222 6.614 11.277 8.874C280.483 79.653 284.85 87.398 288 96c1.339 6.158 1.275 11.317-.375 17.375-1.459 6.467 1.552 11.128 4.676 16.559 4.202 7.584 3.813 17.885 2.015 26.246-3.922 11.49-11.504 21.465-21.992 27.687C267.478 186.23 261.46 189 256 189l-.262 2.055C254.062 202.157 250.056 211.036 241 218c-11.72 7.185-22.91 9.83-36.312 6.625-3.468-.898-6.542-1.906-9.688-3.625l-.773 2.656c-4.339 11.827-13.724 19.11-24.739 24.309-11.381 4.735-23.918 4.301-35.453.293C125.477 244.71 119.207 239.83 113 233l-3.07 1.059-4.055 1.379-2.016.697c-14.44 4.884-29.057 3.62-42.921-2.635-4.71-2.502-8.624-5.51-12.563-9.062l-1.543-1.391C43.913 220.27 42.185 217.856 41 214l-3.812.25c-8.733-.041-16.18-3.324-22.465-9.312-6.335-7.125-8.02-13.197-7.946-22.637.42-6.227 2.81-11.099 6.223-16.301l-1.355-.996C5.29 160.004 1.257 154.075 0 146c-.901-7.962 1.033-14.603 5.508-21.234 4.81-5.951 10.853-10.427 18.555-11.579L27 113l-.687-3.687c-1.301-12.365 4.029-22.12 11.43-31.528 8.016-8.963 20.207-14.101 32.05-14.996C79.051 62.478 87.482 64.444 96 68l1.215-1.54c7.197-8.713 15.643-14.678 27.078-15.776 11.541-.39 20.326 2.758 29.707 9.316l.77-1.777C158.184 52.055 164.496 48.209 171 46c10.288-2.902 20.605-.396 29 6"/><path fill="${color}" d="M186.965 107.172c5.732 4.862 9.76 10.072 13.035 16.828l1.027 2.035c3.846 9.198 3.462 21.341-.152 30.528-3.153 6.492-7.043 11.783-12.312 16.687L186 176c.31 2.98 1.487 5.015 3.188 7.434l1.356 1.949 1.456 2.054 1.482 2.122q1.51 2.161 3.028 4.32c2.244 3.194 4.46 6.408 6.678 9.621q1.905 2.75 3.812 5.5l-1 2c-3.771-1.257-4.401-2.631-6.617-5.883l-2.09-3.039-2.168-3.203-4.242-6.195-2.019-2.962A488 488 0 0 0 182 180c-5.331 1.724-10.493 3.774-15.684 5.879-14.815 5.008-32.21 3.072-46.199-3.164-12.523-6.262-22.288-16.159-27.055-29.465-2.676-10.523-2.15-21.604 2.938-31.25 8.584-14.38 21.202-22.567 37.25-26.875 19.638-3.99 37.62.257 53.715 12.047"/><path fill="#e7f4fb" d="M186.965 107.172c5.732 4.862 9.76 10.072 13.035 16.828l1.027 2.035c3.846 9.198 3.462 21.341-.152 30.528-3.153 6.492-7.043 11.783-12.312 16.687L186 176c.31 2.98 1.487 5.015 3.188 7.434l1.356 1.949 1.456 2.054 1.482 2.122q1.51 2.161 3.028 4.32c2.244 3.194 4.46 6.408 6.678 9.621q1.905 2.75 3.812 5.5l-1 2c-3.771-1.257-4.401-2.631-6.617-5.883l-2.09-3.039-2.168-3.203-4.242-6.195-2.019-2.962A488 488 0 0 0 182 180c-5.331 1.724-10.493 3.774-15.684 5.879-14.815 5.008-32.21 3.072-46.199-3.164-12.523-6.262-22.288-16.159-27.055-29.465-2.676-10.523-2.15-21.604 2.938-31.25 8.584-14.38 21.202-22.567 37.25-26.875 19.638-3.99 37.62.257 53.715 12.047m-82.871 8.098C96.248 125.5 94.112 135.41 95 148c2.393 10.913 8.75 20.712 18 27 16.28 9.57 32.388 12.975 51 8.313 13.244-4.072 24.753-10.848 32-23.133 2.983-6.503 4.533-11.913 4.438-19.118l-.02-2.395c-.159-5.953-1.125-10.614-4.418-15.667l-2-3.25c-8.602-11.828-20.442-19.235-34.812-22-20.69-2.937-40.59 1.927-55.094 17.52"/><path fill="#f5fafd" d="m162 115-1 6-7 2-1 4h5c.043 1.666.04 3.334 0 5-1 1-1 1-4.062 1.063L151 133l-.113 1.914c-.732 9.955-1.888 20.296-6.887 29.086-4.172 3.576-7.758 3.267-13 3v-6l7-2c2.227-8.625 4.181-17.28 6-26h-4v-6l2.313-.062c.886-.31 1.773-.62 2.687-.938a196 196 0 0 0 3-7c4.131-4.739 8.132-4.46 14-4"/><path fill="#f4fafd" d="m130.5 125.875 2.406-.008C135 126 135 126 137 127v5c-3.473 1.158-6.36 1.069-10 1l-1 3 2.813.813c4.732 1.763 4.732 1.763 6.187 4.187.732 5.043.732 5.043 0 8-2.179 2.725-4.882 4.441-8 6-8.206.265-8.206.265-12-1v-5c2.75-.917 4.36-1.109 7.188-1.062L126 148l1-4-2.875-1.375C121 141 121 141 119 139c-.577-5.113-.577-5.113 0-8 3.622-3.718 6.403-5.142 11.5-5.125M163.504 126.902l3.059.035 3.066.028L172 127q-.962 6.188-1.937 12.375l-.553 3.563-.537 3.398-.492 3.142C168 152 168 152 167 154h-7q.465-3.844.938-7.687l.263-2.186c.462-3.747.99-7.435 1.799-11.127h-3a100 100 0 0 1 0-5c1-1 1-1 3.504-1.098"/><path fill="#e2f2fb" d="M166 115h8c.125 5.75.125 5.75-1 8h-8c-.125-5.75-.125-5.75 1-8"/><path fill="#fcfdfe" d="M201 136h2v12l-3 1z"/><path fill="#fbfdfe" d="M95 129c1.467 3.815.433 6.29-1 10h-1c-.195-6.055-.195-6.055 0-8z"/><path fill="#eff8fc" d="M135 95c2.625-.187 2.625-.187 5 0v3h-7z"/></svg>`;
  }

  function setFavicon(sfHost) {
    // Only update favicon if enabled, otherwise keep default
    let {[sfHost + "_customFavicon"]: fav, "colorizeProdBanner": colorizeProd, [sfHost + "_isSandbox"]: isSandbox, [sfHost + "_trialExpirationDate"]: trialExpDate, [sfHost + "_prodBannerText"]: prodBannerText} = iFrameLocalStorage;
    fav = typeof fav === "string" ? fav.trim() : "";
    if (!fav) {
      return;
    }
    let current = document.querySelector('link[rel="shortcut icon"]');
    let link = current ? current : document.createElement("link");
    link.setAttribute("rel", "icon");
    link.orgType = "image/x-icon";
    if (fav.indexOf("http") == -1){
      const color = fav;
      const extensionPage = window.location.href.startsWith(chrome.runtime.getURL(""));
      if (iFrameLocalStorage.colorizeSandboxBanner === "true" && !extensionPage && (isSandbox === "true" || (trialExpDate && trialExpDate !== "null"))){
        colorizeBanner(color, isSandbox, prodBannerText);
      }
      if (colorizeProd === "true" && isSandbox === "false" && trialExpDate === "null"){
        colorizeBanner(color, isSandbox, prodBannerText);
        if (extensionPage){
          addBorder(color);
        }
      }
      fav = "data:image/svg+xml;base64," + btoa(extensionPage ? extensionIconSvg(color) : salesforceCloudSvg(color));
      link.setAttribute("type", "image/svg+xml");
    }
    link.href = fav;
    document.head.appendChild(link);
  }

  function colorizeBanner(faviconColor, isSandbox, bannerText){
    const sandboxBannerSelector = "div.slds-color__background_gray-1.slds-text-align_center.slds-size_full.slds-text-body_regular.oneSystemMessage";
    if (isSandbox === "false"){
      let envNameBanner = addBannerText(isSandbox, faviconColor, bannerText, sandboxBannerSelector);
      const bannerContainer = document.querySelector(sandboxBannerSelector);
      addBannerText(isSandbox, faviconColor, bannerText, bannerContainer);
      if (bannerContainer) {
        //most of the time
        bannerContainer.appendChild(envNameBanner);
      } else {
        //when login as is displayed the banner is not reachable without mutation obersver
        observeElement(sandboxBannerSelector, (banner) => {
          banner.appendChild(envNameBanner);
        });
      }
    } else {
      // add a new observer for the new devops_center sandbox banner
      observeElement("devops_center-base-component", (banner) => {
        const navBar = banner.getElementsByClassName("navBar-container")[0];
        if (bannerText){
          addBannerText(true, faviconColor, bannerText, navBar.firstChild);
        }
        if (navBar) navBar.style.backgroundColor = faviconColor;
      });

    }
  }

  function addBannerText(isSandbox, faviconColor, bannerText, bannerContainer) {
    const envNameBanner = document.createElement("div");
    envNameBanner.style.backgroundColor = faviconColor;
    envNameBanner.style.color = "white";
    const envNameSpan = document.createElement("span");
    envNameSpan.textContent = bannerText ? bannerText : "WARNING: THIS IS PRODUCTION";
    envNameBanner.appendChild(envNameSpan);
    if (isSandbox === "false"){
      envNameBanner.className = "slds-notify_alert";
    } else {
      bannerContainer.firstChild.after(envNameBanner);
    }
    return envNameBanner;
  }

  function addBorder(fav){
    const style = document.createElement("style");
    style.textContent = `
      body::before {
        content: '';
        display: block;
        position: fixed;
        width: 100%;
        height: 2px;
        background-color: ${fav};
        z-index: 9999;
      }
    `;
    document.head.appendChild(style);
  }

  function loadPopup(sfHost) {
    btn.addEventListener("click", () => {
      const isInactive = !rootEl.classList.contains("insext-active");
      togglePopup(isInactive);
    });

    let popupSrc = chrome.runtime.getURL("popup.html?host=" + sfHost);
    let popupEl = document.createElement("iframe");
    popupEl.title = "Salesforce Inspector Reloaded";

    function getOrientation(source) {
      return getKeyFromStorage(source, "popupArrowOrientation", "vertical");
    }

    function getKeyFromStorage(source, key, defaultValue) {
      const o = (source === "localStorage") ? localStorage.getItem(key) : iFrameLocalStorage?.[key];
      return o || defaultValue;
    }

    // return a value for direction popup will expand, based on position and orientation
    function calcDirection(pos, o) {
      if (o === "horizontal") {
        return pos < 90 ? "left" : "right";
      }
      return pos >= 55 ? "up" : null;
    }

    function resetPopupClass(source, dynamicHeight, orientation, position = "20", direction = null) {
      popupEl.className = "insext-popup";
      popupEl.classList.add(`insext-popup-${orientation}`);

      //manage dynamic height of popup
      const intPosition = Number(position);

      if (dynamicHeight) {
        const height = direction === "up" ? intPosition : (98 - (orientation === "horizontal" ? 0 : intPosition)); //the height is the total height minus the position and the popup margin at the bottom
        popupEl.style.height = `calc(${height}vh)`;

        //in up direction, we need to adjust the top position to keep the popup on screen
        if (direction === "up") {
          popupEl.style.top = `calc(-${intPosition - 5}vh)`;
        }
      } else {
        popupEl.style.height = "";
      }
    }

    resetPopupClass("localStorage", getKeyFromStorage("localStorage", "popupHeighDynamictMode"), getOrientation("localStorage"));
    popupEl.src = popupSrc;
    addEventListener("message", e => {
      if (e.source != popupEl.contentWindow) {
        return;
      }
      if (e.data.insextInitRequest) {
        // Set CSS classes for arrow button position
        iFrameLocalStorage = e.data.iFrameLocalStorage;
        const {popupArrowPosition: pos} = iFrameLocalStorage;
        const o = getOrientation("iframe");
        const dynamicHeight = getKeyFromStorage("iframe", "popupHeighDynamictMode", "true") === "true";
        const dir = calcDirection(pos, o);
        resetPopupClass("iframe", dynamicHeight, o, pos, dir);
        if (dir) {
          popupEl.classList.add(`insext-popup-${o}-${dir}`);
        }
        setRootCSSProperties(rootEl, btn);
        setFavicon(sfHost);
        popupEl.contentWindow.postMessage({
          insextInitResponse: true,
          sfHost,
          inDevConsole: !!document.querySelector("body.ApexCSIPage"),
          inLightning: !!document.querySelector("#auraLoadingBox"),
          inInspector,
        }, "*");
      }

      togglePopup(e.data.insextOpenPopup, e.data.insextClosePopup);
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
      if (e.data.lightningNavigate) {
        document.dispatchEvent(new CustomEvent("lightningNavigate", {detail: e.data.lightningNavigate}));
      }
    });
    rootEl.appendChild(popupEl);
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
      popupEl.focus();
    }
    function closePopup() {
      rootEl.classList.remove("insext-active");
      removeEventListener("click", outsidePopupClick);
      popupEl.blur();
    }
    function togglePopup(openCondition, closeCondition = !openCondition) {
      if (openCondition) {
        openPopup();
      } else if (closeCondition) {
        closePopup();
      }
    }
    function outsidePopupClick(e) {
      // Close the popup when clicking outside it
      if (!rootEl.contains(e.target)) {
        closePopup();
      }
    }
  }
}
