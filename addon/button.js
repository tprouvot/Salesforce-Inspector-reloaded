/* exported initButton */
/* global showStdPageDetails */


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

  // Calulates default position, left to right for horizontal, and adds boundaries to keep it on screen
  function calcPopup({popupArrowOrientation: o, popupArrowPosition: pos}) {
    o = o || "vertical"; // Default to vertical
    const isVertical = o === "vertical";
    pos = pos ? Math.min(95, pos) + "%" : "122px";
    const [posStyle, oStyle] = isVertical ? ["top", "right"] : ["left", "bottom"];
    const imgSrc = isVertical
      ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAPCAYAAADd/14OAAAA40lEQVQoz2P4//8/AzpWzGj6L59U/V8urgxMg/g4FUn6J/+X9E38LxWc8V8htR67IpCkuGfMfxCQjSpENRFFkXvk/1+/foGxQloDSD0DVkVfvnyBY7hCdEVv3rxBwXCFIIdKh2WDFT1+/BgDo1qd2fL/1q1bWDFcoW5xz3/Xppn/oycu/X/x4kUMDFeoWdD136R8wn+f9rlgxSdOnEDBKFajK96/fz8coyjEpnj79u1gjKEQXXFE/+L/Gzdu/G9WMfG/am4HZlzDFAf3LPwfOWEJWBPIwwzYUg9MsXXNFDAN4gMAmASShdkS4AcAAAAASUVORK5CYII="
      : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAKCAYAAABrGwT5AAAAAXNSR0IArs4c6QAAAFBlWElmTU0AKgAAAAgAAgESAAMAAAABAAEAAIdpAAQAAAABAAAAJgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAD6ADAAQAAAABAAAACgAAAADdC3pnAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoZXuEHAAABKElEQVQoFWNgwAI0C7r+6xb3/AdJKaTW/1fMaAKz0ZUyoguANHKzszEIcnMy3Hn+muHX2+cMLDwCDExs7Az3Z9ShqGdC1gzTKCHAyyDGz8OwszCM4c/Hdwy/P75l+PfrJwO6C+CakTXyc3EwlDnogM09M6eL4e+Xj1gNAGtG15hrrozsIIarSydjNYARXWOKnhQDJycnBubg4GBQDk5lYObhZ2DlFwaHARMocORFBRl4ONgYYtSEUGxE5zzevJDh77cvwEB8AQ4DJnZWFgY2FmaGSCU+dLVY+S+2LWZg+PeP4f+f3wwsP3//Yfj8/SdD6/G3DK/evceqAVkQFHiMwGhjZGFlYPn68xfDwzfvGX78+sPwYFYDSjwia4KxQdHF/JePgZGZmQEASqV1t0W3n+oAAAAASUVORK5CYII=";
    const btnClass = `insext-btn-${o}`;
    return {pos, posStyle, oStyle, imgSrc, btnClass};
  }

  function setRootCSSProperties(rootElement, buttonElement) {
    const p = calcPopup(iFrameLocalStorage);
    let img = document.createElement("img");
    img.role = "presentation";
    img.src = p.imgSrc;
    rootElement.style[p.posStyle] = p.pos;
    rootElement.style[p.oStyle] = 0;
    buttonElement.classList.add(p.btnClass);
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

  function setFavicon(sfHost) {
    // Only update favicon if enabled, otherwise keep default
    let {[sfHost + "_customFavicon"]: fav, "colorizeProdBanner": colorizeProd, [sfHost + "_isSandbox"]: isSandbox, [sfHost + "_trialExpirationDate"]: trialExpDate, [sfHost + "_prodBannerText"]: prodBannerText} = iFrameLocalStorage;
    if (fav) {
      let current = document.querySelector('link[rel="shortcut icon"]');
      let link = current ? current : document.createElement("link");
      link.setAttribute("rel", "icon");
      link.orgType = "image/x-icon";
      if (fav.indexOf("http") == -1){
        let extensionPage = window.location.href.indexOf(chrome.i18n.getMessage("@@extension_id")) != -1;
        if (iFrameLocalStorage.colorizeSandboxBanner === "true" && !extensionPage && (isSandbox === "true" || (trialExpDate && trialExpDate !== "null"))){
          colorizeBanner(fav, isSandbox, prodBannerText);
        }
        if (colorizeProd === "true" && isSandbox === "false" && trialExpDate === "null"){
          colorizeBanner(fav, isSandbox, prodBannerText);
          if (extensionPage){
            addBorder(fav);
          }
        }
        fav = "data:image/svg+xml;base64," + btoa(`<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="295" height="295"><path d="M0 0 C1.33275574 1.00076966 2.66598578 2.0009085 4 3 C4.49628906 2.60167969 4.99257812 2.20335937 5.50390625 1.79296875 C13.99207684 -4.82683791 22.13668334 -7.94838479 33 -7 C44.18782187 -4.80053657 52.36700108 0.72887651 59 10 C59.63080494 11.54394597 60.21698997 13.10712526 60.75 14.6875 C62.84150783 20.09915927 66.97196162 21.30201322 72.02734375 23.5625 C80.48342319 27.65164223 84.85049172 35.39698075 88 44 C89.33861618 50.15763442 89.27473275 55.31711039 87.625 61.375 C86.16601102 67.84161565 89.17715723 72.50343719 92.30078125 77.93359375 C96.50335881 85.51755556 96.11393935 95.8185907 94.31640625 104.1796875 C90.39414386 115.66980057 82.81194518 125.64460718 72.32421875 131.8671875 C67.47803887 134.22919114 61.4600967 137 56 137 C55.87044922 138.01707031 55.87044922 138.01707031 55.73828125 139.0546875 C54.0621206 150.15732964 50.05587544 159.03624099 41 166 C29.28003537 173.18526442 18.09065172 175.82939428 4.6875 172.625 C1.21979473 171.72747628 -1.85357973 170.71894694 -5 169 C-5.25523437 169.8765625 -5.51046875 170.753125 -5.7734375 171.65625 C-10.11159421 183.48256257 -19.49735681 190.76686718 -30.51171875 195.96484375 C-41.89300972 200.69960373 -54.43039568 200.26613832 -65.96484375 196.2578125 C-74.52269055 192.71131743 -80.79274929 187.83144352 -87 181 C-88.01320313 181.34933594 -89.02640625 181.69867188 -90.0703125 182.05859375 C-91.42179229 182.51847229 -92.77335947 182.97809409 -94.125 183.4375 C-95.12273437 183.78264648 -95.12273437 183.78264648 -96.140625 184.13476562 C-110.58062066 189.0188818 -125.1979569 187.75440927 -139.0625 181.5 C-143.77231061 178.99771713 -147.68573172 175.99040209 -151.625 172.4375 C-152.13426025 171.97859375 -152.64352051 171.5196875 -153.16821289 171.046875 C-156.08695501 168.27081369 -157.81469337 165.85573275 -159 162 C-160.258125 162.0825 -161.51625 162.165 -162.8125 162.25 C-171.54545015 162.20880684 -178.99238103 158.92563697 -185.27734375 152.9375 C-191.61192838 145.81288781 -193.29616219 139.74104444 -193.22265625 130.30078125 C-192.80264731 124.07433293 -190.41382796 119.20202356 -187 114 C-187.44730469 113.67128906 -187.89460937 113.34257812 -188.35546875 113.00390625 C-194.71030575 108.00404515 -198.7429707 102.07546096 -200 94 C-200.90111104 86.03772378 -198.96732374 79.39717403 -194.4921875 72.765625 C-189.68235937 66.81486089 -183.63943689 62.33890067 -175.9375 61.1875 C-174.968125 61.125625 -173.99875 61.06375 -173 61 C-173.3403125 59.1746875 -173.3403125 59.1746875 -173.6875 57.3125 C-174.98796049 44.94842043 -169.65836778 35.1934855 -162.2578125 25.78515625 C-154.24090669 16.82204911 -142.05024352 11.68351489 -130.20703125 10.7890625 C-120.94932682 10.47767787 -112.51844779 12.4442051 -104 16 C-103.59910156 15.49210937 -103.19820313 14.98421875 -102.78515625 14.4609375 C-95.5884733 5.74658671 -87.14184702 -0.2176873 -75.70703125 -1.31640625 C-64.16553984 -1.70657662 -55.38069741 1.44157545 -46 8 C-45.74605469 7.41347656 -45.49210938 6.82695313 -45.23046875 6.22265625 C-41.81623708 0.05536158 -35.50404461 -3.79107919 -29 -6 C-18.7116493 -8.9018425 -8.39537845 -6.39647882 0 0 Z " fill="${fav}" transform="translate(200,52)"/><path d="M0 0 C5.73255998 4.86190049 9.76006974 10.07258352 13.03515625 16.828125 C13.54369141 17.83552734 13.54369141 17.83552734 14.0625 18.86328125 C17.90824806 28.06117639 17.52397406 40.20453327 13.91015625 49.390625 C10.75721564 55.88301819 6.86713509 61.17458219 1.59765625 66.078125 C0.75203125 66.985625 -0.09359375 67.893125 -0.96484375 68.828125 C-0.65565734 71.80738881 0.52242939 73.84309101 2.22265625 76.26171875 C2.67020264 76.90496094 3.11774902 77.54820312 3.57885742 78.2109375 C4.05943604 78.88898438 4.54001465 79.56703125 5.03515625 80.265625 C5.52411377 80.96558594 6.01307129 81.66554688 6.5168457 82.38671875 C7.52406963 83.82826821 8.53360654 85.26820423 9.54541016 86.70654297 C11.7888759 89.90151467 14.00460943 93.115485 16.22265625 96.328125 C17.4932163 98.16164774 18.76393747 99.99505891 20.03515625 101.828125 C19.70515625 102.488125 19.37515625 103.148125 19.03515625 103.828125 C15.26415012 102.57112296 14.63411258 101.19699469 12.41796875 97.9453125 C11.72832031 96.94242187 11.03867188 95.93953125 10.328125 94.90625 C9.61269531 93.84921875 8.89726562 92.7921875 8.16015625 91.703125 C6.74637896 89.63782557 5.33232292 87.57271692 3.91796875 85.5078125 C3.2518457 84.53038086 2.58572266 83.55294922 1.89941406 82.54589844 C-0.34509269 79.27378618 -2.64139249 76.04451047 -4.96484375 72.828125 C-10.29634207 74.5518425 -15.45799572 76.60212285 -20.6484375 78.70703125 C-35.46357103 83.71520949 -52.85830721 81.77941297 -66.84765625 75.54296875 C-79.37120994 69.28119191 -89.13597714 59.3842318 -93.90234375 46.078125 C-96.57912838 35.55501543 -96.0537396 24.47402646 -90.96484375 14.828125 C-82.38057249 0.44848167 -69.76333123 -7.73922855 -53.71484375 -12.046875 C-34.07664783 -16.03625458 -16.09413747 -11.78964484 0 0 Z " fill="${fav}" transform="translate(186.96484375,107.171875)"/><path d="M0 0 C5.73255998 4.86190049 9.76006974 10.07258352 13.03515625 16.828125 C13.54369141 17.83552734 13.54369141 17.83552734 14.0625 18.86328125 C17.90824806 28.06117639 17.52397406 40.20453327 13.91015625 49.390625 C10.75721564 55.88301819 6.86713509 61.17458219 1.59765625 66.078125 C0.75203125 66.985625 -0.09359375 67.893125 -0.96484375 68.828125 C-0.65565734 71.80738881 0.52242939 73.84309101 2.22265625 76.26171875 C2.67020264 76.90496094 3.11774902 77.54820312 3.57885742 78.2109375 C4.05943604 78.88898438 4.54001465 79.56703125 5.03515625 80.265625 C5.52411377 80.96558594 6.01307129 81.66554688 6.5168457 82.38671875 C7.52406963 83.82826821 8.53360654 85.26820423 9.54541016 86.70654297 C11.7888759 89.90151467 14.00460943 93.115485 16.22265625 96.328125 C17.4932163 98.16164774 18.76393747 99.99505891 20.03515625 101.828125 C19.70515625 102.488125 19.37515625 103.148125 19.03515625 103.828125 C15.26415012 102.57112296 14.63411258 101.19699469 12.41796875 97.9453125 C11.72832031 96.94242187 11.03867188 95.93953125 10.328125 94.90625 C9.61269531 93.84921875 8.89726562 92.7921875 8.16015625 91.703125 C6.74637896 89.63782557 5.33232292 87.57271692 3.91796875 85.5078125 C3.2518457 84.53038086 2.58572266 83.55294922 1.89941406 82.54589844 C-0.34509269 79.27378618 -2.64139249 76.04451047 -4.96484375 72.828125 C-10.29634207 74.5518425 -15.45799572 76.60212285 -20.6484375 78.70703125 C-35.46357103 83.71520949 -52.85830721 81.77941297 -66.84765625 75.54296875 C-79.37120994 69.28119191 -89.13597714 59.3842318 -93.90234375 46.078125 C-96.57912838 35.55501543 -96.0537396 24.47402646 -90.96484375 14.828125 C-82.38057249 0.44848167 -69.76333123 -7.73922855 -53.71484375 -12.046875 C-34.07664783 -16.03625458 -16.09413747 -11.78964484 0 0 Z M-82.87109375 8.09765625 C-90.71693098 18.32944771 -92.85331848 28.2393141 -91.96484375 40.828125 C-89.57163612 51.7411518 -83.21533354 61.54057404 -73.96484375 67.828125 C-57.68400361 77.39719885 -41.57711591 80.80313131 -22.96484375 76.140625 C-9.7207226 72.06876222 1.78852108 65.29312368 9.03515625 53.0078125 C12.01848976 46.50507775 13.56789449 41.09493736 13.47265625 33.890625 C13.4665332 33.10010742 13.46041016 32.30958984 13.45410156 31.49511719 C13.29440353 25.542066 12.32850251 20.88093021 9.03515625 15.828125 C8.37515625 14.755625 7.71515625 13.683125 7.03515625 12.578125 C-1.56667025 0.75061357 -13.40638867 -6.65678286 -27.77734375 -9.421875 C-48.46692833 -12.35863189 -68.36662614 -7.49464643 -82.87109375 8.09765625 Z " fill="#E7F4FB" transform="translate(186.96484375,107.171875)"/><path d="M0 0 C-0.33 1.98 -0.66 3.96 -1 6 C-3.31 6.66 -5.62 7.32 -8 8 C-8.33 9.32 -8.66 10.64 -9 12 C-7.35 12 -5.7 12 -4 12 C-3.957279 13.66611905 -3.95936168 15.33382885 -4 17 C-5 18 -5 18 -8.0625 18.0625 C-9.031875 18.041875 -10.00125 18.02125 -11 18 C-11.03738281 18.63164062 -11.07476562 19.26328125 -11.11328125 19.9140625 C-11.8448251 29.86879642 -13.00082702 40.21010552 -18 49 C-22.17157071 52.57563204 -25.75815116 52.26653469 -31 52 C-31 50.02 -31 48.04 -31 46 C-28.69 45.34 -26.38 44.68 -24 44 C-21.77261613 35.3748114 -19.81876674 26.71976109 -18 18 C-19.32 18 -20.64 18 -22 18 C-22 16.02 -22 14.04 -22 12 C-21.236875 11.979375 -20.47375 11.95875 -19.6875 11.9375 C-18.800625 11.628125 -17.91375 11.31875 -17 11 C-15.95281202 8.68745988 -14.95653635 6.3514852 -14 4 C-9.86882644 -0.73869908 -5.86775862 -0.46021636 0 0 Z " fill="#F5FAFD" transform="translate(162,115)"/><path d="M0 0 C1.19109375 -0.00386719 1.19109375 -0.00386719 2.40625 -0.0078125 C4.5 0.125 4.5 0.125 6.5 1.125 C6.5 2.775 6.5 4.425 6.5 6.125 C3.02674819 7.2827506 0.13932552 7.19366652 -3.5 7.125 C-3.83 8.115 -4.16 9.105 -4.5 10.125 C-3.571875 10.393125 -2.64375 10.66125 -1.6875 10.9375 C3.04545455 12.70075758 3.04545455 12.70075758 4.5 15.125 C5.23204707 20.16799095 5.23204707 20.16799095 4.5 23.125 C2.32132151 25.85001377 -0.38246025 27.56623013 -3.5 29.125 C-11.70588235 29.38970588 -11.70588235 29.38970588 -15.5 28.125 C-15.5 26.475 -15.5 24.825 -15.5 23.125 C-12.74921116 22.20807039 -11.14051087 22.01613917 -8.3125 22.0625 C-6.4253125 22.0934375 -6.4253125 22.0934375 -4.5 22.125 C-4.17 20.805 -3.84 19.485 -3.5 18.125 C-4.44875 17.67125 -5.3975 17.2175 -6.375 16.75 C-9.5 15.125 -9.5 15.125 -11.5 13.125 C-12.07731959 8.01159794 -12.07731959 8.01159794 -11.5 5.125 C-7.87778098 1.40745943 -5.09728239 -0.01654962 0 0 Z " fill="#F4FAFD" transform="translate(130.5,125.875)"/><path d="M0 0 C1.51400391 0.01740234 1.51400391 0.01740234 3.05859375 0.03515625 C4.07050781 0.04417969 5.08242187 0.05320312 6.125 0.0625 C7.29869141 0.07990234 7.29869141 0.07990234 8.49609375 0.09765625 C7.8556297 4.22350874 7.20781783 8.34817387 6.55859375 12.47265625 C6.37619141 13.64828125 6.19378906 14.82390625 6.00585938 16.03515625 C5.82861328 17.15664062 5.65136719 18.278125 5.46875 19.43359375 C5.30640869 20.4704834 5.14406738 21.50737305 4.97680664 22.57568359 C4.49609375 25.09765625 4.49609375 25.09765625 3.49609375 27.09765625 C1.18609375 27.09765625 -1.12390625 27.09765625 -3.50390625 27.09765625 C-3.19372021 24.53485705 -2.88083734 21.97243515 -2.56640625 19.41015625 C-2.47939453 18.68892578 -2.39238281 17.96769531 -2.30273438 17.22460938 C-1.8407682 13.47755041 -1.31222946 9.78972714 -0.50390625 6.09765625 C-1.49390625 6.09765625 -2.48390625 6.09765625 -3.50390625 6.09765625 C-3.54662725 4.4315372 -3.54454457 2.7638274 -3.50390625 1.09765625 C-2.50390625 0.09765625 -2.50390625 0.09765625 0 0 Z " fill="#F4FAFD" transform="translate(163.50390625,126.90234375)"/><path d="M0 0 C2.64 0 5.28 0 8 0 C8.125 5.75 8.125 5.75 7 8 C4.36 8 1.72 8 -1 8 C-1.125 2.25 -1.125 2.25 0 0 Z " fill="#E2F2FB" transform="translate(166,115)"/><path d="M0 0 C0.66 0 1.32 0 2 0 C2 3.96 2 7.92 2 12 C1.01 12.33 0.02 12.66 -1 13 C-0.67 8.71 -0.34 4.42 0 0 Z " fill="#FCFDFE" transform="translate(201,136)"/><path d="M0 0 C1.46726798 3.81489674 0.43336419 6.29011622 -1 10 C-1.33 10 -1.66 10 -2 10 C-2.1953125 3.9453125 -2.1953125 3.9453125 -2 2 C-1.34 1.34 -0.68 0.68 0 0 Z " fill="#FBFDFE" transform="translate(95,129)"/><path d="M0 0 C2.625 -0.1875 2.625 -0.1875 5 0 C5 0.99 5 1.98 5 3 C2.69 3 0.38 3 -2 3 C-1.34 2.01 -0.68 1.02 0 0 Z " fill="#EFF8FC" transform="translate(135,95)"/></svg>`);
      }
      link.href = fav;
      document.head.appendChild(link);
    }
  }

  function colorizeBanner(faviconColor, isSandbox, bannerText){
    if (isSandbox === "false"){
      const bannerContainer = document.querySelector("div.slds-color__background_gray-1.slds-text-align_center.slds-size_full.slds-text-body_regular.oneSystemMessage");
      const envNameBanner = document.createElement("div");
      envNameBanner.className = "slds-notify_alert";
      envNameBanner.style.backgroundColor = faviconColor;
      const envNameSpan = document.createElement("span");
      envNameSpan.textContent = bannerText ? bannerText : "WARNING: THIS IS PRODUCTION";
      envNameBanner.appendChild(envNameSpan);

      if (bannerContainer) {
        //most of the time
        bannerContainer.appendChild(envNameBanner);
      } else {
        //when login as is displayed the banner is not reachable without mutation obersver
        const bannerSelector = "div.slds-color__background_gray-1.slds-text-align_center.slds-size_full.slds-text-body_regular.oneSystemMessage";
        observeElement(bannerSelector, (banner) => {
          banner.appendChild(envNameBanner);
        });
      }
    } else {
      //header selector depends on the env type (sandbox or trial)
      const bannerSelector = isSandbox === "true" ? "div.slds-color__background_gray-1.slds-text-align_center.slds-size_full.slds-text-body_regular.oneSystemMessage > div.slds-notify_alert.system-message.level-info.slds-theme_info" : "div.slds-trial-header.slds-grid.oneTrialHeader.oneTrialExperience";

      observeElement(bannerSelector, (banner) => {
        banner.style.backgroundColor = faviconColor;
        //update sandbox name and Logout action color for new UI
        [...banner.children].forEach(child => child.style.color = "white");
      });
    }
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

  function loadPopup() {
    btn.addEventListener("click", () => {
      const isInactive = !rootEl.classList.contains("insext-active");
      togglePopup(isInactive);
    });

    let popupSrc = chrome.runtime.getURL("popup.html");
    let popupEl = document.createElement("iframe");
    function getOrientation(source) {
      const o = (source === "localStorage")
        ? localStorage.getItem("popupArrowOrientation")
        : iFrameLocalStorage.popupArrowOrientation;
      return o || "vertical";
    }
    // return a value for direction popup will expand, based on position and orientation
    function calcDirection(pos, o) {
      if (o === "horizontal") {
        return pos < 8 ? "right" : pos >= 90 ? "left" : "centered";
      }
      return pos >= 55 ? "up" : null;
    }
    function resetPopupClass(o) {
      popupEl.className = "insext-popup";
      popupEl.classList.add(`insext-popup-${o}`);
    }
    resetPopupClass(getOrientation("localStorage"));
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
        const dir = calcDirection(pos, o);
        resetPopupClass(o);
        if (dir) {
          popupEl.classList.add(`insext-popup-${o}-${dir}`);
        }
        setRootCSSProperties(rootEl, btn);
        addFlowScrollability(popupEl);
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
