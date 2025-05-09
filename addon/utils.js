export function getLinkTarget(e = {}) {
  if (localStorage.getItem("openLinksInNewTab") == "true" || (e.ctrlKey || e.metaKey)) {
    return "_blank";
  } else {
    return "_top";
  }
}

export function nullToEmptyString(value) {
  // For react input fields, the value may not be null or undefined, so this will clean the value
  return (value == null) ? "" : value;
}

export function displayButton(buttonName, hideButtonsOption){
  const button = hideButtonsOption?.find((element) => element.name == buttonName);
  if (button){
    return button.checked;
  }
  //if no option was found, display the button
  return true;
}
