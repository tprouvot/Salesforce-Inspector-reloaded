/* exported showStdPageDetails */

function showStdPageDetails(metadataResponse, allFieldSetupLinks) {
  let fieldDetailsByLabel = new Map();
  // Loop through all label elements, add event listeners
  for (let fieldDetails of metadataResponse.fields) {
    if (!fieldDetailsByLabel.has(fieldDetails.label)) {
      fieldDetailsByLabel.set(fieldDetails.label, []);
    }
    fieldDetailsByLabel.get(fieldDetails.label).push(fieldDetails);
  }
  for (let labelEventElement of Array.from(document.querySelectorAll("td.labelCol, th.labelCol"))) {
    if (labelEventElement.textContent.trim() != "") {
      labelEventElement.addEventListener("mouseenter", softShowFieldDetails);
      labelEventElement.addEventListener("click", makeFieldDetailsSticky);
      labelEventElement.addEventListener("mouseleave", softHideFieldDetails);
    }
  }


  function softShowFieldDetails(e) {
    let labelElement = e.currentTarget;
    if (labelElement.querySelector(".salesforce-inspector-details") != null) {
      return;
    }
    let output = document.createElement("div");
    output.classList.add("salesforce-inspector-details");

    // if there is a Help Text or not
    let labelText = labelElement.firstElementChild ? labelElement.firstElementChild.firstChild.textContent : labelElement.textContent;
    let fieldDetails = fieldDetailsByLabel.get(labelText);

    //Attempt to guess "true" field label. In some cases the UI and API label names don't match? Odd! However, by prepending the object type name to the UI label a match can sometimes be found (for example for Account.phone the UI label is "Phone" but the API defined label is "Account Phone"/"Kontotelefon")
    if (labelText != null && labelText.length > 2) {
      if (fieldDetails == null) { //e.g. API "Account Type" vs UI "Type" (Account.type in EN)
        fieldDetails = fieldDetailsByLabel.get(metadataResponse.label + " " + labelText);
      }
      if (fieldDetails == null) { //e.g. API "Kontotype" vs UI "Type" (Account.type in DA)
        fieldDetails = fieldDetailsByLabel.get(metadataResponse.label + "" + labelText);
      }
      if (fieldDetails == null) { //e.g. API "Owner ID" vs UI "Account Owner" (Account.Owner)
        let cleanedLabelName = labelText.replace(metadataResponse.label, "").trim();
        if (cleanedLabelName.length > 2) { //Only try to append ID if the label still has content after stripping the object name
          fieldDetails = fieldDetailsByLabel.get(cleanedLabelName + " ID");
        }
      }
      if (fieldDetails == null) { //e.g. API "Parent Account ID" vs UI "Parent Account" (Account.Parent)
        fieldDetails = fieldDetailsByLabel.get(labelText + " ID");
      }
    }

    /* eslint new-cap: ["error", {"capIsNewExceptions": ["Ea", "E", "T"]}] */
    function Ea(name, attrs, children) {
      let e = document.createElement(name);
      for (let attrName in attrs) {
        e.setAttribute(attrName, attrs[attrName]);
      }
      for (let child of children) {
        e.appendChild(child);
      }
      return e;
    }
    function E(name, children) {
      return Ea(name, {}, children);
    }
    function T(text) {
      return document.createTextNode(text);
    }

    if (fieldDetails == null || fieldDetails.length == 0) {
      output.classList.add("salesforce-inspector-error");
      output.appendChild(E("p", [T("No fields with matching label?!")]));
    } else {
      if (fieldDetails.length > 1) {
        output.classList.add("inaccurate");
        output.appendChild(E("p", [T("Multiple fields with same label")]));
      }
      for (let fieldDetail of fieldDetails) {
        output.appendChild(E("div", [T(fieldDetail.name)]));
        output.appendChild(
          E("div", [
            T(
              fieldDetail.type == "reference" ? "[" + fieldDetail.referenceTo.join(", ") + "]"
              : fieldDetail.type
                + (fieldDetail.length != 0 ? " (" + fieldDetail.length + ")" : "")
                + (fieldDetail.precision != 0 || fieldDetail.scale != 0 ? " (" + fieldDetail.precision + ", " + fieldDetail.scale + ")" : "")
            ),
            T(" "),
            Ea("span", {"class": fieldDetail.externalId ? "insext-checked" : "insext-unchecked"}, [T("ExtId")]),
            T(" "),
            Ea("span", {"class": fieldDetail.autoNumber ? "insext-checked" : "insext-unchecked"}, [T("Auto")]),
            T(" "),
            Ea("span", {"class": fieldDetail.unique ? "insext-checked" : "insext-unchecked"}, [T("Unique")])
          ])
        );
        if (fieldDetail.calculatedFormula) {
          output.appendChild(Ea("div", {"class": "insext-formula"}, [T(fieldDetail.calculatedFormula)]));
        }
        let setupLinks = allFieldSetupLinks.get(fieldDetail.name);
        let lightningFieldSetupLink = Ea("a", {"href": setupLinks.lightningSetupLink}, [T("Lignting setup")]);
        output.appendChild(lightningFieldSetupLink);
        output.appendChild(T(" "));
        let classicFieldSetupLink = Ea("a", {"href": setupLinks.classicSetupLink}, [T("Classic setup")]);
        output.appendChild(classicFieldSetupLink);
      }
    }

    output.addEventListener("mouseleave", () => {
      output.remove();
    });

    labelElement.appendChild(output);
  }

  function softHideFieldDetails(e) {
    let detailsElement = e.currentTarget.querySelector(".salesforce-inspector-details");
    if (detailsElement != null && !detailsElement.classList.contains("sticky")) {
      detailsElement.remove();
    }
  }

  function makeFieldDetailsSticky(e) {
    let detailsElement = e.currentTarget.querySelector(".salesforce-inspector-details");
    if (detailsElement != null) {
      detailsElement.classList.add("sticky");
    }
  }

}
