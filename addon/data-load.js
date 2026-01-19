import {sfConn, apiVersion} from "./inspector.js";

const greyOutSkippedColumns = localStorage.getItem("greyOutSkippedColumns") === "true" && !window.location.href.includes("data-export");
// Inspired by C# System.Linq.Enumerable
export function Enumerable(iterable) {
  this[Symbol.iterator] = iterable[Symbol.iterator].bind(iterable);
}
Enumerable.prototype = {
  __proto__: function*(){}.prototype,
  *map(f) {
    for (let e of this) {
      yield f(e);
    }
  },
  *filter(f) {
    for (let e of this) {
      if (f(e)) {
        yield e;
      }
    }
  },
  *flatMap(f) {
    for (let e of this) {
      yield* f(e);
    }
  },
  *concat(other) {
    yield* this;
    yield* other;
  },
  some() {
    for (let e of this) {
      return true;
    }
    return false;
  },
  toArray() {
    return Array.from(this);
  }
};
Enumerable.prototype.map.prototype = Enumerable.prototype;
Enumerable.prototype.filter.prototype = Enumerable.prototype;
Enumerable.prototype.flatMap.prototype = Enumerable.prototype;
Enumerable.prototype.concat.prototype = Enumerable.prototype;

// @param didUpdate: A callback function to listen for updates to describe data
export function DescribeInfo(spinFor, didUpdate) {
  function initialState() {
    return {
      data: {global: {globalStatus: "pending", globalDescribe: null}, sobjects: null},
      tool: {global: {globalStatus: "pending", globalDescribe: null}, sobjects: null}
    };
  }
  let sobjectAllDescribes = initialState();
  function getGlobal(useToolingApi) {
    let apiDescribes = sobjectAllDescribes[useToolingApi ? "tool" : "data"];
    if (apiDescribes.global.globalStatus == "pending") {
      apiDescribes.global.globalStatus = "loading";
      console.log(useToolingApi ? "getting tooling objects" : "getting objects");
      spinFor(sfConn.rest(useToolingApi ? "/services/data/v" + apiVersion + "/tooling/sobjects/" : "/services/data/v" + apiVersion + "/sobjects/").then(res => {
        apiDescribes.global.globalStatus = "ready";
        apiDescribes.global.globalDescribe = res;
        apiDescribes.sobjects = new Map();
        for (let sobjectDescribe of res.sobjects) {
          apiDescribes.sobjects.set(sobjectDescribe.name.toLowerCase(), {global: sobjectDescribe, sobject: {sobjectStatus: "pending", sobjectDescribe: null}});
        }
        didUpdate();
      }, () => {
        apiDescribes.global.globalStatus = "loadfailed";
        didUpdate();
      }));
    }
    return apiDescribes;
  }
  // Makes global and sobject describe API calls, and caches the results.
  // If the result of an API call is not already cashed, empty data is returned immediately, and the API call is made asynchronously.
  // The caller is notified using the didUpdate callback or the spinFor promise when the API call completes, so it can make the call again to get the cached results.
  return {
    // Returns an object with two properties:
    // - globalStatus: a string with one of the following values:
    //    "pending": (has not started loading, never returned by this function)
    //    "loading": Describe info for the api is being downloaded
    //    "loadfailed": Downloading of describe info for the api failed
    //    "ready": Describe info is available
    // - globalDescribe: contains a DescribeGlobalResult if it has been loaded
    describeGlobal(useToolingApi) {
      return getGlobal(useToolingApi).global;
    },
    // Returns an object with two properties:
    // - sobjectStatus: a string with one of the following values:
    //    "pending": (has not started loading, never returned by this function)
    //    "notfound": The object does not exist
    //    "loading": Describe info for the object is being downloaded
    //    "loadfailed": Downloading of describe info for the object failed
    //    "ready": Describe info is available
    // - sobjectDescribe: contains a DescribeSObjectResult if the object exists and has been loaded
    describeSobject(useToolingApi, sobjectName) {
      let apiDescribes = getGlobal(useToolingApi);
      if (!apiDescribes.sobjects) {
        return {sobjectStatus: apiDescribes.global.globalStatus, sobjectDescribe: null};
      }
      let sobjectInfo = apiDescribes.sobjects.get(sobjectName.toLowerCase());
      if (!sobjectInfo) {
        return {sobjectStatus: "notfound", sobjectDescribe: null};
      }
      if (sobjectInfo.sobject.sobjectStatus == "pending") {
        sobjectInfo.sobject.sobjectStatus = "loading";
        console.log("getting fields for " + sobjectInfo.global.name);
        spinFor(sfConn.rest(sobjectInfo.global.urls.describe).then(res => {
          sobjectInfo.sobject.sobjectStatus = "ready";
          sobjectInfo.sobject.sobjectDescribe = res;
          didUpdate();
        }, () => {
          sobjectInfo.sobject.sobjectStatus = "loadfailed";
          didUpdate();
        }));
      }
      return sobjectInfo.sobject;
    },
    reloadAll() {
      sobjectAllDescribes = initialState();
      didUpdate();
    }
  };
}

// Pluralize a numeric value by adding an s (or optional suffix) if it is not 1
export function s(num, suffix = "s") {
  return num == 1 ? "" : suffix;
}

function isRecordId(recordId) {
  return typeof recordId === "string"
       && /^[a-zA-Z0-9]{15,18}$/.test(recordId)
       && /^[0-9a-zA-Z]{3}/.test(recordId)
       && !recordId.startsWith("000")
       && !/[^a-zA-Z0-9]/.test(recordId)
       && /[0-9]/.test(recordId.slice(0, 5));
}

function startInlineEdit(td, currentValue, fieldName, recordId, objectType, fieldDescribe, rt, rowIndex, colIndex, fieldParts, skipButtonCheck = false) {
  // Don't start edit if already editing this specific cell
  if (td.querySelector(".inline-edit-input")) {
    return;
  }
  
  // Get the row element - always needed
  const tr = td.closest("tr");
  
  // Allow editing multiple cells in the same row
  // If skipButtonCheck is true, we're in row edit mode (all cells editable at once)
  // If skipButtonCheck is false, we're editing individual cells (can edit multiple cells)
  // We no longer prevent editing multiple cells - each cell can be edited independently
  
  // Store original content BEFORE modifying the cell
  // Get the original content from the table data, not from the DOM which might have been modified
  const originalContent = currentValue == null ? "" : String(currentValue);
  const originalHTML = td.innerHTML;
  
  // Also store the original cell content for proper restoration
  const originalCellContent = td.cloneNode(true);
  
  // Find the first cell of the row to add save/cancel buttons
  let firstCell = null;
  let firstCellOriginalHTML = null;
  if (tr && tr.cells && tr.cells.length > 0) {
    firstCell = tr.cells[0];
    firstCellOriginalHTML = firstCell.innerHTML;
  }
  
  // Create input element based on field type
  let input;
  
  if (fieldDescribe.type === "picklist" && fieldDescribe.picklistValues && fieldDescribe.picklistValues.length > 0) {
    // Picklist - use select dropdown
    input = document.createElement("select");
    input.className = "inline-edit-input";
    
    // Add empty option if field is nillable
    if (fieldDescribe.nillable) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "--None--";
      input.appendChild(emptyOption);
    }
    
    // Add picklist values
    fieldDescribe.picklistValues.forEach((pickVal) => {
      const option = document.createElement("option");
      option.value = pickVal.value;
      option.textContent = pickVal.label || pickVal.value;
      input.appendChild(option);
      if (pickVal.value === currentValue || String(pickVal.value) === String(currentValue)) {
        input.selectedIndex = fieldDescribe.nillable ? input.options.length - 1 : input.options.length;
      }
    });
  } else if (fieldDescribe.type === "multipicklist" && fieldDescribe.picklistValues && fieldDescribe.picklistValues.length > 0) {
    // Multipicklist - use multiple select
    input = document.createElement("select");
    input.multiple = true;
    input.className = "inline-edit-input";
    input.size = Math.min(fieldDescribe.picklistValues.length + 1, 6);
    
    // Parse current value (semicolon-separated)
    const currentValues = currentValue ? String(currentValue).split(";").map(v => v.trim()) : [];
    
    // Add picklist values
    fieldDescribe.picklistValues.forEach((pickVal) => {
      const option = document.createElement("option");
      option.value = pickVal.value;
      option.textContent = pickVal.label || pickVal.value;
      if (currentValues.includes(pickVal.value)) {
        option.selected = true;
      }
      input.appendChild(option);
    });
  } else if (fieldDescribe.type === "reference") {
    // Reference field - allow editing the ID as text
    input = document.createElement("input");
    input.type = "text";
    input.className = "inline-edit-input";
    input.placeholder = "Enter record ID";
    input.value = currentValue == null ? "" : String(currentValue);
  } else if (fieldDescribe.type === "textarea" || fieldDescribe.type === "longtextarea") {
    // Textarea - use textarea element
    input = document.createElement("textarea");
    input.className = "inline-edit-input";
    input.value = currentValue == null ? "" : String(currentValue);
    input.rows = fieldDescribe.type === "longtextarea" ? 6 : 3;
    if (fieldDescribe.length) {
      input.maxLength = fieldDescribe.length;
    }
  } else {
    // Standard input
    input = document.createElement("input");
    input.type = fieldDescribe.type === "boolean" ? "checkbox" : 
                 fieldDescribe.type === "date" ? "date" :
                 fieldDescribe.type === "datetime" ? "datetime-local" :
                 fieldDescribe.type === "email" ? "email" :
                 fieldDescribe.type === "url" ? "url" :
                 fieldDescribe.type === "phone" ? "tel" :
                 fieldDescribe.type === "int" || fieldDescribe.type === "double" || fieldDescribe.type === "long" || fieldDescribe.type === "currency" || fieldDescribe.type === "percent" ? "number" :
                 "text";
    input.className = "inline-edit-input";
    
    // Set max length for text fields
    if (fieldDescribe.type === "string" && fieldDescribe.length) {
      input.maxLength = fieldDescribe.length;
    }
    
    // Set step for numeric fields
    if (fieldDescribe.type === "double" || fieldDescribe.type === "currency" || fieldDescribe.type === "percent") {
      const scale = fieldDescribe.scale || 0;
      input.step = scale > 0 ? Math.pow(10, -scale) : 1;
    }
    
    // Set min/max for numeric fields if applicable
    if (fieldDescribe.type === "int" || fieldDescribe.type === "double" || fieldDescribe.type === "long") {
      input.step = fieldDescribe.scale > 0 ? Math.pow(10, -fieldDescribe.scale) : 1;
    }
  }
  
  // Format value based on field type
  if (input.tagName === "INPUT") {
    if (input.type === "checkbox") {
      // Check the checkbox if value is true
      input.checked = currentValue === true || currentValue === "true" || currentValue === 1 || currentValue === "1";
    } else if (fieldDescribe.type === "date" && currentValue) {
      // Salesforce date format is YYYY-MM-DD
      input.value = String(currentValue).substring(0, 10);
    } else if (fieldDescribe.type === "datetime" && currentValue) {
      // Convert Salesforce datetime (YYYY-MM-DDTHH:mm:ss.SSS+HHMM) to datetime-local format (YYYY-MM-DDTHH:mm)
      const dateStr = String(currentValue);
      const dateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
      if (dateMatch) {
        input.value = dateMatch[1];
      } else {
        input.value = "";
      }
    } else if (input.type === "number" && currentValue != null) {
      input.value = String(currentValue);
    } else if (input.type === "text" && currentValue != null) {
      input.value = String(currentValue);
    }
  }
  
  // Style the input
  input.style.width = "100%";
  input.style.minWidth = td.offsetWidth + "px";
  input.style.fontSize = "inherit";
  input.style.fontFamily = "inherit";
  
  // Don't add border/padding for checkboxes
  if (input.type !== "checkbox") {
    input.style.padding = "2px 4px";
    input.style.border = "2px solid #1589ee";
    input.style.borderRadius = "2px";
  }
  
  // Replace cell content with input
  td.innerHTML = "";
  td.appendChild(input);
  
  // Add validation message element
  const validationMsg = document.createElement("div");
  validationMsg.className = "inline-edit-validation";
  validationMsg.style.fontSize = "0.75rem";
  validationMsg.style.color = "#c23934";
  validationMsg.style.marginTop = "2px";
  validationMsg.style.display = "none";
  
  // Add field info (length, required, etc.)
  const fieldInfo = document.createElement("div");
  fieldInfo.className = "inline-edit-info";
  fieldInfo.style.fontSize = "0.7rem";
  fieldInfo.style.color = "#706e6b";
  fieldInfo.style.marginTop = "2px";
  let infoText = "";
  if (fieldDescribe.length && (fieldDescribe.type === "string" || fieldDescribe.type === "textarea")) {
    infoText += `Max length: ${fieldDescribe.length}`;
  }
  if (!fieldDescribe.nillable) {
    infoText += (infoText ? " • " : "") + "Required";
  }
  if (fieldDescribe.restrictedPicklist) {
    infoText += (infoText ? " • " : "") + "Restricted picklist";
  }
  if (fieldDescribe.precision && fieldDescribe.scale !== undefined) {
    infoText += (infoText ? " • " : "") + `Precision: ${fieldDescribe.precision - fieldDescribe.scale},${fieldDescribe.scale}`;
  }
  if (infoText) {
    fieldInfo.textContent = infoText;
    td.appendChild(fieldInfo);
  }
  td.appendChild(validationMsg);
  
  // Add save/cancel buttons to the first cell of the row (only if not in row edit mode)
  if (firstCell && colIndex > 0 && !skipButtonCheck) {
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "inline-edit-buttons";
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "4px";
    buttonContainer.style.marginBottom = "4px";
    
    // Save button with check icon
    const saveButton = document.createElement("button");
    saveButton.className = "slds-button slds-button_icon slds-button_icon-container slds-button_icon-small";
    saveButton.type = "button";
    saveButton.title = "Save";
    saveButton.style.padding = "4px";
    saveButton.style.borderRadius = "3px";
    saveButton.style.border = "1px solid #1589ee";
    saveButton.style.backgroundColor = "#1589ee";
    saveButton.style.cursor = "pointer";
    saveButton.style.display = "flex";
    saveButton.style.alignItems = "center";
    saveButton.style.justifyContent = "center";
    saveButton.innerHTML = `<svg class="slds-button__icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
      <path fill="white" d="M10 3L4.5 8.5 2 6l.707-.707L4.5 7.086 9.293 2.293z"/>
    </svg>`;
    
    // Cancel button with X icon
    const cancelButton = document.createElement("button");
    cancelButton.className = "slds-button slds-button_icon slds-button_icon-container slds-button_icon-small";
    cancelButton.type = "button";
    cancelButton.title = "Cancel";
    cancelButton.style.padding = "4px";
    cancelButton.style.borderRadius = "3px";
    cancelButton.style.border = "1px solid #c23934";
    cancelButton.style.backgroundColor = "#c23934";
    cancelButton.style.cursor = "pointer";
    cancelButton.style.display = "flex";
    cancelButton.style.alignItems = "center";
    cancelButton.style.justifyContent = "center";
    cancelButton.innerHTML = `<svg class="slds-button__icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
      <path fill="white" d="M6 5.293L2.646 1.94a.5.5 0 00-.708.708L5.293 6 1.94 9.354a.5.5 0 00.708.708L6 6.707l3.354 3.355a.5.5 0 00.708-.708L6.707 6l3.355-3.354a.5.5 0 00-.708-.708L6 5.293z"/>
    </svg>`;
    
    // Hover effects
    saveButton.addEventListener("mouseenter", function() {
      saveButton.style.backgroundColor = "#0d7ddc";
    });
    saveButton.addEventListener("mouseleave", function() {
      saveButton.style.backgroundColor = "#1589ee";
    });
    
    cancelButton.addEventListener("mouseenter", function() {
      cancelButton.style.backgroundColor = "#a23729";
    });
    cancelButton.addEventListener("mouseleave", function() {
      cancelButton.style.backgroundColor = "#c23934";
    });
    
    // Clear first cell but preserve recordlink, then add buttons
    // Remove only buttons, not the recordlink
    const existingEditBtn = firstCell.querySelector('button[title="Edit all fields"]');
    if (existingEditBtn) {
      existingEditBtn.remove();
    }
    
    // Check if buttons already exist (from another cell being edited)
    const existingButtonContainer = firstCell.querySelector('.inline-edit-buttons');
    if (existingButtonContainer) {
      // Buttons already exist - attach this cell's handlers to existing buttons
      const existingSaveButton = existingButtonContainer.querySelector('button[title="Save"]');
      const existingCancelButton = existingButtonContainer.querySelector('button[title="Cancel"]');
      
      // Add handlers to existing buttons - they will save/cancel this cell
      if (existingSaveButton) {
        existingSaveButton.addEventListener("click", function(e) {
          e.stopPropagation();
          // Only save if this cell is still in edit mode
          if (td.querySelector(".inline-edit-input")) {
            saveEdit();
          }
        });
      }
      
      if (existingCancelButton) {
        existingCancelButton.addEventListener("click", function(e) {
          e.stopPropagation();
          // Only cancel if this cell is still in edit mode
          if (td.querySelector(".inline-edit-input")) {
            cancelEdit();
          }
        });
      }
      
      // Don't add new buttons, use existing ones
      return;
    }
    
    // Store reference to recordlink before adding buttons
    const recordLinkEl = firstCell.querySelector('a[title="Show all data"]');
    
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    // Insert buttons before recordlink to keep recordlink visible below
    if (recordLinkEl) {
      firstCell.insertBefore(buttonContainer, recordLinkEl);
    } else {
      firstCell.appendChild(buttonContainer);
    }
    firstCell.style.position = "relative";
    firstCell.style.zIndex = "10";
    
    // Save button handler
    saveButton.addEventListener("click", function(e) {
      e.stopPropagation();
      saveEdit();
    });
    
    // Cancel button handler
    cancelButton.addEventListener("click", function(e) {
      e.stopPropagation();
      cancelEdit();
    });
  }
  
  input.focus();
  if (input.tagName === "INPUT" && input.type === "text") {
    input.select();
  }
  
  // Validation function
  const validateInput = function() {
    let isValid = true;
    let errorMsg = "";
    
    // Check required fields
    if (!fieldDescribe.nillable) {
      if (input.tagName === "SELECT" && input.multiple) {
        if (input.selectedOptions.length === 0) {
          isValid = false;
          errorMsg = "This field is required";
        }
      } else if (input.type === "checkbox") {
        // Checkbox is always valid (can be false)
      } else if (input.value === "" || input.value === null) {
        isValid = false;
        errorMsg = "This field is required";
      }
    }
    
    // Check max length for text/textarea
    if (fieldDescribe.length && (fieldDescribe.type === "string" || fieldDescribe.type === "textarea" || fieldDescribe.type === "longtextarea")) {
      const textValue = input.tagName === "TEXTAREA" ? input.value : input.value;
      if (textValue && textValue.length > fieldDescribe.length) {
        isValid = false;
        errorMsg = `Maximum length is ${fieldDescribe.length} characters`;
      }
    }
    
    // Check restricted picklist
    if (fieldDescribe.type === "picklist" && fieldDescribe.restrictedPicklist && input.value) {
      const validValues = fieldDescribe.picklistValues.map(pv => pv.value);
      if (!validValues.includes(input.value)) {
        isValid = false;
        errorMsg = "Value must be one of the allowed picklist values";
      }
    }
    
    // Check numeric precision/scale
    if ((fieldDescribe.type === "double" || fieldDescribe.type === "currency" || fieldDescribe.type === "percent") && input.value) {
      const numValue = parseFloat(input.value);
      if (!isNaN(numValue)) {
        const parts = String(input.value).split(".");
        if (parts.length > 1 && parts[1].length > fieldDescribe.scale) {
          isValid = false;
          errorMsg = `Maximum ${fieldDescribe.scale} decimal places allowed`;
        }
      }
    }
    
    validationMsg.textContent = errorMsg;
    validationMsg.style.display = isValid ? "none" : "block";
    input.style.borderColor = isValid ? "#1589ee" : "#c23934";
    
    return isValid;
  };
  
  // Save function
  const saveEdit = function() {
    // Validate before saving
    if (!validateInput()) {
      return;
    }
    
    let newValue;
    
    if (input.tagName === "SELECT" && input.multiple) {
      // Multipicklist - join selected values with semicolon
      const selectedValues = Array.from(input.selectedOptions).map(opt => opt.value);
      newValue = selectedValues.length > 0 ? selectedValues.join(";") : null;
    } else if (input.tagName === "SELECT") {
      // Picklist dropdown
      newValue = input.value === "" ? null : input.value;
    } else if (input.type === "checkbox") {
      newValue = input.checked;
    } else if (fieldDescribe.type === "datetime" && input.value) {
      // Convert datetime-local format back to Salesforce format
      const date = new Date(input.value);
      if (!isNaN(date.getTime())) {
        const pad = (n, d) => ("000" + n).slice(-d);
        const offset = date.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offset) / 60);
        const offsetMinutes = Math.abs(offset) % 60;
        newValue = pad(date.getFullYear(), 4) + "-" + pad(date.getMonth() + 1, 2) + "-" + pad(date.getDate(), 2) + "T"
          + pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2) + ":00.000"
          + (offset <= 0 ? "+" : "-") + pad(offsetHours, 2) + ":" + pad(offsetMinutes, 2);
      } else {
        newValue = input.value;
      }
    } else if (input.type === "number" && input.value !== "") {
      // Convert to number for numeric fields
      newValue = fieldDescribe.scale > 0 ? parseFloat(input.value) : parseInt(input.value, 10);
      if (isNaN(newValue)) {
        newValue = input.value;
      }
    } else {
      newValue = input.value;
    }
    
    // Convert empty string to null for nillable fields
    if ((newValue === "" || newValue === null) && fieldDescribe.nillable) {
      newValue = null;
    }
    
    // Check required fields again
    if (!fieldDescribe.nillable && (newValue === "" || newValue === null)) {
      validationMsg.textContent = "This field is required";
      validationMsg.style.display = "block";
      input.style.borderColor = "#c23934";
      return;
    }
    
    // Don't save if value hasn't changed
    let hasChanged = false;
    if (fieldDescribe.type === "boolean") {
      const currentBool = currentValue === true || currentValue === "true";
      hasChanged = newValue !== currentBool;
    } else {
      const currentValueStr = currentValue == null ? null : String(currentValue);
      const newValueStr = newValue == null ? null : String(newValue);
      hasChanged = newValueStr !== currentValueStr && !(newValueStr === "" && currentValue == null);
    }
    
    if (!hasChanged) {
      td.innerHTML = originalHTML;
      // Check if there are other cells still being edited
      if (firstCell && tr && colIndex > 0) {
        const otherEditingCells = tr.querySelectorAll(".inline-edit-input");
        if (otherEditingCells.length === 0) {
          // No other cells being edited - restore edit button
          restoreEditButton(firstCell, tr, rt, rowIndex);
        }
        // If other cells are still being edited, keep the buttons
      }
      return;
    }
    
    // Show saving indicator with SLDS spinner centered in the cell
    const spinnerContainer = document.createElement("div");
    spinnerContainer.className = "slds-is-relative";
    spinnerContainer.style.display = "flex";
    spinnerContainer.style.alignItems = "center";
    spinnerContainer.style.justifyContent = "center";
    spinnerContainer.style.width = "100%";
    spinnerContainer.style.height = "100%";
    spinnerContainer.style.minHeight = "24px";
    spinnerContainer.innerHTML = `
      <div role="status" class="slds-spinner slds-spinner_x-small slds-spinner_inline slds-spinner_brand">
        <span class="slds-assistive-text">Saving</span>
        <div class="slds-spinner__dot-a"></div>
        <div class="slds-spinner__dot-b"></div>
      </div>
    `;
    
    td.innerHTML = "";
    td.appendChild(spinnerContainer);
    
    // Prepare update payload
    const updateData = {};
    updateData[fieldName] = newValue;
    
    // Determine API endpoint
    const apiPath = rt.isTooling ? "/tooling" : "";
    const recordUrl = `/services/data/v${apiVersion}${apiPath}/sobjects/${objectType}/${recordId}`;
    
    // Save via REST API
    sfConn.rest(recordUrl, {
      method: "PATCH",
      body: updateData
    }).then(() => {
      // Update successful - clear the cell and show the new value
      td.innerHTML = "";
      td.textContent = newValue == null ? "" : String(newValue);
      td.style.color = "";
      td.style.backgroundColor = "";
      td.style.border = "";
      td.style.padding = "";
      
      // Update the data in the table
      if (rt.table[rowIndex] && rt.table[rowIndex][colIndex] !== undefined) {
        rt.table[rowIndex][colIndex] = newValue;
      }
      
      // Update the record object if it exists
      if (rt.table[rowIndex] && rt.table[rowIndex][0] && typeof rt.table[rowIndex][0] === "object") {
        const record = rt.table[rowIndex][0];
        if (fieldParts.length === 1) {
          record[fieldName] = newValue;
        }
      }
      
      // Check if there are other cells still being edited
      if (firstCell && tr && colIndex > 0) {
        const otherEditingCells = tr.querySelectorAll(".inline-edit-input");
        if (otherEditingCells.length === 0) {
          // No other cells being edited - restore edit button
          restoreEditButton(firstCell, tr, rt, rowIndex);
        }
        // If other cells are still being edited, keep the buttons
      }
    }).catch(error => {
      // Extract error message from Salesforce response
      let errorMessage = "Failed to save";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.detail && Array.isArray(error.detail) && error.detail.length > 0) {
        // Salesforce REST API error format
        const errors = error.detail.map(err => {
          let msg = err.message || "";
          if (err.errorCode) {
            msg = `${err.errorCode}: ${msg}`;
          }
          if (err.fields && err.fields.length > 0) {
            msg += ` [${err.fields.join(", ")}]`;
          }
          return msg;
        });
        errorMessage = errors.join("; ");
      }
      
      // Show error message in the cell with visible styling
      td.innerHTML = "";
      td.style.backgroundColor = "#fef7f7";
      td.style.border = "2px solid #c23934";
      td.style.padding = "4px";
      td.style.color = "#c23934";
      
      const errorDiv = document.createElement("div");
      errorDiv.style.display = "flex";
      errorDiv.style.alignItems = "center";
      errorDiv.style.gap = "4px";
      errorDiv.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0;">
          <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" fill="#c23934"/>
          <path d="M8 4v4M8 10h.01" stroke="#c23934" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span style="font-size: 0.875rem;">${errorMessage}</span>
      `;
      td.appendChild(errorDiv);
      td.title = errorMessage;
      
      // Restore after 5 seconds or allow user to cancel
      setTimeout(() => {
        td.innerHTML = originalHTML;
        td.style.backgroundColor = "";
        td.style.border = "";
        td.style.padding = "";
        td.style.color = "";
        td.title = "Double-click to edit";
      }, 5000);
      
      // Keep buttons visible on error so user can retry or cancel
    });
  };
  
  // Cancel function
  const cancelEdit = function() {
    // Remove all edit-related elements
    const input = td.querySelector(".inline-edit-input");
    if (input) {
      input.remove();
    }
    const validationMsg = td.querySelector(".inline-edit-validation");
    if (validationMsg) {
      validationMsg.remove();
    }
    const fieldInfo = td.querySelector(".inline-edit-info");
    if (fieldInfo) {
      fieldInfo.remove();
    }
    
    // Restore the cell content to its original state
    td.innerHTML = "";
    td.textContent = originalContent;
    td.style.color = "";
    td.style.backgroundColor = "";
    td.style.border = "";
    td.style.padding = "";
    td.style.cursor = "";
    td.classList.remove("editable-cell");
    td.title = "";
    
    // Check if there are other cells still being edited
    if (firstCell && tr && colIndex > 0) {
      const otherEditingCells = tr.querySelectorAll(".inline-edit-input");
      if (otherEditingCells.length === 0) {
        // No other cells being edited - restore edit button
        restoreEditButton(firstCell, tr, rt, rowIndex);
      }
      // If other cells are still being edited, keep the buttons
    }
  };
  
  // Handle keydown events
  input.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Enter" && (e.ctrlKey || input.tagName === "SELECT" || input.type === "checkbox")) {
      e.preventDefault();
      saveEdit();
    }
  });
  
  // Handle input validation on change
  input.addEventListener("input", validateInput);
  input.addEventListener("change", validateInput);
  
  // Prevent event propagation
  input.addEventListener("click", function(e) {
    e.stopPropagation();
  });
}

// Helper function to restore edit button in first cell
function restoreEditButton(firstCell, tr, rt, rowIndex) {
  if (!firstCell || !tr) return;
  
  // Remove any existing edit button or save/cancel buttons
  const existingEditButton = firstCell.querySelector('button[title="Edit all fields"]');
  const existingButtons = firstCell.querySelector('.inline-edit-buttons');
  if (existingEditButton) {
    existingEditButton.remove();
  }
  if (existingButtons) {
    existingButtons.remove();
  }
  
  firstCell.style.position = "";
  firstCell.style.zIndex = "";
  
  const record = rt.table[rowIndex] && rt.table[rowIndex][0];
  if (record && typeof record === "object" && record.attributes && record.attributes.type) {
    const objectType = record.attributes.type;
    const recordId = record.Id || (record.attributes && record.attributes.url && record.attributes.url.replace(/.*\//, ""));
    
    if (recordId && isRecordId(recordId)) {
      const editButton = document.createElement("button");
      editButton.className = "slds-button slds-button_icon slds-button_icon-container slds-button_icon-small";
      editButton.type = "button";
      editButton.title = "Edit all fields";
      editButton.style.padding = "4px";
      editButton.style.borderRadius = "3px";
      editButton.style.border = "1px solid #706e6b";
      editButton.style.backgroundColor = "#ffffff";
      editButton.style.cursor = "pointer";
      editButton.style.display = "flex";
      editButton.style.alignItems = "center";
      editButton.style.justifyContent = "center";
      editButton.innerHTML = `<svg class="slds-button__icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
        <path fill="#706e6b" d="M8.5 1L11 3.5 4.5 10 2 10 2 7.5 8.5 1zM9.5 2L8 3.5 8.5 4 10 2.5 9.5 2z"/>
      </svg>`;
      
      editButton.addEventListener("mouseenter", function() {
        editButton.style.backgroundColor = "#f3f2f2";
      });
      editButton.addEventListener("mouseleave", function() {
        editButton.style.backgroundColor = "#ffffff";
      });
      
      editButton.addEventListener("click", function(e) {
        e.stopPropagation();
        startRowEdit(tr, rt, rowIndex);
      });
      
      // Add button at the beginning, preserving existing content (like recordlink)
      // Find recordlink to insert button before it
      const recordLinkEl = firstCell.querySelector('a[title="Show all data"]');
      if (recordLinkEl) {
        firstCell.insertBefore(editButton, recordLinkEl);
      } else if (firstCell.hasChildNodes() && firstCell.children.length > 0) {
        firstCell.insertBefore(editButton, firstCell.firstChild);
      } else {
        firstCell.appendChild(editButton);
      }
    }
  }
}

function startRowEdit(tr, rt, rowIndex) {
  // Don't start if already editing - check if any cell in this row is being edited
  const existingInputs = tr.querySelectorAll(".inline-edit-input");
  if (existingInputs.length > 0) {
    // Already editing - cancel current edit first
    // Find all cells with inputs and restore them
    existingInputs.forEach(input => {
      const cellTd = input.closest("td");
      if (cellTd) {
        const colIndex = Array.from(tr.cells).indexOf(cellTd);
        if (colIndex > 0 && rt.header && rt.header[colIndex]) {
          const fieldName = rt.header[colIndex];
          const currentValue = rt.table[rowIndex] && rt.table[rowIndex][colIndex];
          const originalContent = currentValue == null ? "" : String(currentValue);
          
          // Restore the cell
          cellTd.innerHTML = "";
          cellTd.textContent = originalContent;
          cellTd.style.color = "";
          cellTd.style.backgroundColor = "";
          cellTd.style.border = "";
          cellTd.style.padding = "";
          cellTd.style.cursor = "";
          cellTd.classList.remove("editable-cell");
          cellTd.title = "Double-click to edit";
        }
      }
    });
    
    // Restore first cell if it has buttons
    const firstCell = tr.cells[0];
    if (firstCell && firstCell.querySelector(".inline-edit-buttons")) {
      // Restore first cell to show edit button
      const record = rt.table[rowIndex] && rt.table[rowIndex][0];
      if (record && typeof record === "object" && record.attributes && record.attributes.type) {
        const objectType = record.attributes.type;
        const recordId = record.Id || (record.attributes && record.attributes.url && record.attributes.url.replace(/.*\//, ""));
        if (recordId && isRecordId(recordId)) {
          // Re-render the edit button, preserving recordlink
          // Remove only buttons, not the recordlink
          const existingBtn = firstCell.querySelector('button[title="Edit all fields"]');
          const existingButtons = firstCell.querySelector('.inline-edit-buttons');
          if (existingBtn) {
            existingBtn.remove();
          }
          if (existingButtons) {
            existingButtons.remove();
          }
          
          const editButton = document.createElement("button");
          editButton.className = "slds-button slds-button_icon slds-button_icon-container slds-button_icon-small";
          editButton.type = "button";
          editButton.title = "Edit all fields";
          editButton.style.padding = "4px";
          editButton.style.borderRadius = "3px";
          editButton.style.border = "1px solid #706e6b";
          editButton.style.backgroundColor = "#ffffff";
          editButton.style.cursor = "pointer";
          editButton.style.display = "flex";
          editButton.style.alignItems = "center";
          editButton.style.justifyContent = "center";
          editButton.innerHTML = `<svg class="slds-button__icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            <path fill="#706e6b" d="M8.5 1L11 3.5 4.5 10 2 10 2 7.5 8.5 1zM9.5 2L8 3.5 8.5 4 10 2.5 9.5 2z"/>
          </svg>`;
          editButton.addEventListener("mouseenter", function() {
            editButton.style.backgroundColor = "#f3f2f2";
          });
          editButton.addEventListener("mouseleave", function() {
            editButton.style.backgroundColor = "#ffffff";
          });
          editButton.addEventListener("click", function(e) {
            e.stopPropagation();
            startRowEdit(tr, rt, rowIndex);
          });
          
          // Add edit button before recordlink if it exists
          const recordLinkEl = firstCell.querySelector('a[title="Show all data"]');
          if (recordLinkEl) {
            firstCell.insertBefore(editButton, recordLinkEl);
          } else {
            firstCell.appendChild(editButton);
          }
        }
      }
    }
  }
  
  const record = rt.table[rowIndex] && rt.table[rowIndex][0];
  if (!record || typeof record !== "object" || !record.attributes || !record.attributes.type) {
    return;
  }
  
  const objectType = record.attributes.type;
  const recordId = record.Id || (record.attributes && record.attributes.url && record.attributes.url.replace(/.*\//, ""));
  
  if (!recordId || !isRecordId(recordId)) {
    return;
  }
  
  const {sobjectDescribe} = rt.describeInfo.describeSobject(rt.isTooling, objectType);
  if (!sobjectDescribe) {
    return;
  }
  
  // Store original HTML of first cell BEFORE editing
  const firstCell = tr.cells[0];
  // Store the original content including recordlink - clone the node to preserve event listeners
  const firstCellOriginalHTML = firstCell.innerHTML;
  
  // Find all editable fields in this row
  // Get the header row to map column indices
  const headerRow = tr.parentElement.querySelector("tr");
  if (!headerRow) return;
  
  const editableCells = [];
  // Iterate through all columns starting from index 1 (skip first column which is the record)
  for (let colIndex = 1; colIndex < rt.header.length; colIndex++) {
    const fieldName = rt.header[colIndex];
    if (!fieldName || fieldName === "_") continue;
    
    // Find the corresponding td element in this row
    let td = null;
    for (let c = 0; c < tr.cells.length; c++) {
      const headerCell = headerRow.cells[c];
      if (headerCell && headerCell.textContent === fieldName) {
        td = tr.cells[c];
        break;
      }
    }
    // Fallback: try to match by column index if cells are in order
    if (!td && colIndex < tr.cells.length) {
      td = tr.cells[colIndex];
    }
    
    if (!td) continue;
    
    const fieldParts = fieldName.split(".");
    if (fieldParts.length !== 1) continue; // Skip relationship fields
    
    const fieldDescribe = sobjectDescribe.fields.find(f => f.name === fieldName);
    if (fieldDescribe && !fieldDescribe.calculated && !fieldDescribe.autoNumber && fieldDescribe.updateable) {
      const currentValue = rt.table[rowIndex][colIndex];
      editableCells.push({td, fieldName, currentValue, fieldDescribe, colIndex, fieldParts});
    }
  }
  
  if (editableCells.length === 0) {
    return;
  }
  
  // Start editing all editable cells
  editableCells.forEach(({td, fieldName, currentValue, fieldDescribe, colIndex, fieldParts}) => {
    startInlineEdit(td, currentValue, fieldName, recordId, objectType, fieldDescribe, rt, rowIndex, colIndex, fieldParts, true);
  });
  
  // Add save/cancel buttons to first cell
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "inline-edit-buttons";
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "4px";
  buttonContainer.style.marginBottom = "4px";
  buttonContainer.style.position = "relative";
  buttonContainer.style.zIndex = "20"; // Higher than recordlink
  
  // Save button with check icon
  const saveButton = document.createElement("button");
  saveButton.className = "slds-button slds-button_icon slds-button_icon-container slds-button_icon-small";
  saveButton.type = "button";
  saveButton.title = "Save all changes";
  saveButton.style.padding = "4px";
  saveButton.style.borderRadius = "3px";
  saveButton.style.border = "1px solid #1589ee";
  saveButton.style.backgroundColor = "#1589ee";
  saveButton.style.cursor = "pointer";
  saveButton.style.display = "flex";
  saveButton.style.alignItems = "center";
  saveButton.style.justifyContent = "center";
  saveButton.innerHTML = `<svg class="slds-button__icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
    <path fill="white" d="M10 3L4.5 8.5 2 6l.707-.707L4.5 7.086 9.293 2.293z"/>
  </svg>`;
  
  // Cancel button with X icon
  const cancelButton = document.createElement("button");
  cancelButton.className = "slds-button slds-button_icon slds-button_icon-container slds-button_icon-small";
  cancelButton.type = "button";
  cancelButton.title = "Cancel all changes";
  cancelButton.style.padding = "4px";
  cancelButton.style.borderRadius = "3px";
  cancelButton.style.border = "1px solid #c23934";
  cancelButton.style.backgroundColor = "#c23934";
  cancelButton.style.cursor = "pointer";
  cancelButton.style.display = "flex";
  cancelButton.style.alignItems = "center";
  cancelButton.style.justifyContent = "center";
  cancelButton.innerHTML = `<svg class="slds-button__icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
    <path fill="white" d="M6 5.293L2.646 1.94a.5.5 0 00-.708.708L5.293 6 1.94 9.354a.5.5 0 00.708.708L6 6.707l3.354 3.355a.5.5 0 00.708-.708L6.707 6l3.355-3.354a.5.5 0 00-.708-.708L6 5.293z"/>
  </svg>`;
  
  // Hover effects
  saveButton.addEventListener("mouseenter", function() {
    saveButton.style.backgroundColor = "#0d7ddc";
  });
  saveButton.addEventListener("mouseleave", function() {
    saveButton.style.backgroundColor = "#1589ee";
  });
  
  cancelButton.addEventListener("mouseenter", function() {
    cancelButton.style.backgroundColor = "#a23729";
  });
  cancelButton.addEventListener("mouseleave", function() {
    cancelButton.style.backgroundColor = "#c23934";
  });
  
  // Store original HTML and content for each cell BEFORE editing starts
  // Also store field metadata needed for re-enabling double-click after cancel
  const originalHTMLs = editableCells.map(({td, currentValue, fieldName, recordId, objectType, fieldDescribe, colIndex, fieldParts}) => {
    const originalContent = currentValue == null ? "" : String(currentValue);
    return {td, html: td.innerHTML, content: originalContent, fieldName, recordId, objectType, fieldDescribe, colIndex, fieldParts};
  });
  
  // Save all changes
  saveButton.addEventListener("click", function(e) {
    e.stopPropagation();
    
    // Collect all changes and track which cells have changed
    const updateData = {};
    let hasChanges = false;
    const changedCells = []; // Track cells that have actually changed
    
    editableCells.forEach(({td, fieldName, currentValue, fieldDescribe, colIndex}) => {
      const input = td.querySelector(".inline-edit-input");
      if (!input) return;
      
      let newValue;
      
      if (input.tagName === "SELECT" && input.multiple) {
        const selectedValues = Array.from(input.selectedOptions).map(opt => opt.value);
        newValue = selectedValues.length > 0 ? selectedValues.join(";") : null;
      } else if (input.tagName === "SELECT") {
        newValue = input.value === "" ? null : input.value;
      } else if (input.type === "checkbox") {
        newValue = input.checked;
      } else if (fieldDescribe.type === "datetime" && input.value) {
        const date = new Date(input.value);
        if (!isNaN(date.getTime())) {
          const pad = (n, d) => ("000" + n).slice(-d);
          const offset = date.getTimezoneOffset();
          const offsetHours = Math.floor(Math.abs(offset) / 60);
          const offsetMinutes = Math.abs(offset) % 60;
          newValue = pad(date.getFullYear(), 4) + "-" + pad(date.getMonth() + 1, 2) + "-" + pad(date.getDate(), 2) + "T"
            + pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2) + ":00.000"
            + (offset <= 0 ? "+" : "-") + pad(offsetHours, 2) + ":" + pad(offsetMinutes, 2);
        } else {
          newValue = input.value;
        }
      } else if (input.type === "number" && input.value !== "") {
        newValue = fieldDescribe.scale > 0 ? parseFloat(input.value) : parseInt(input.value, 10);
        if (isNaN(newValue)) {
          newValue = input.value;
        }
      } else {
        newValue = input.value;
      }
      
      if ((newValue === "" || newValue === null) && fieldDescribe.nillable) {
        newValue = null;
      }
      
      // Check if value changed
      let changed = false;
      if (fieldDescribe.type === "boolean") {
        const currentBool = currentValue === true || currentValue === "true";
        changed = newValue !== currentBool;
      } else {
        const currentValueStr = currentValue == null ? null : String(currentValue);
        const newValueStr = newValue == null ? null : String(newValue);
        changed = newValueStr !== currentValueStr && !(newValueStr === "" && currentValue == null);
      }
      
      if (changed) {
        updateData[fieldName] = newValue;
        hasChanges = true;
        // Store the cell and new value for later update
        changedCells.push({td, fieldName, newValue, fieldDescribe, colIndex});
      }
    });
    
    if (!hasChanges) {
      // No changes, just restore
      originalHTMLs.forEach(({td, html}) => {
        td.innerHTML = html;
      });
      restoreEditButton(firstCell, tr, rt, rowIndex);
      return;
    }
    
    // Show saving indicator with SLDS spinner centered ONLY in cells that have changed
    changedCells.forEach(({td}) => {
      const spinnerContainer = document.createElement("div");
      spinnerContainer.className = "slds-is-relative";
      spinnerContainer.style.display = "flex";
      spinnerContainer.style.alignItems = "center";
      spinnerContainer.style.justifyContent = "center";
      spinnerContainer.style.width = "100%";
      spinnerContainer.style.height = "100%";
      spinnerContainer.style.minHeight = "24px";
      spinnerContainer.innerHTML = `
        <div role="status" class="slds-spinner slds-spinner_x-small slds-spinner_inline slds-spinner_brand">
          <span class="slds-assistive-text">Saving</span>
          <div class="slds-spinner__dot-a"></div>
          <div class="slds-spinner__dot-b"></div>
        </div>
      `;
      
      td.innerHTML = "";
      td.appendChild(spinnerContainer);
    });
    
    // Save via REST API
    const apiPath = rt.isTooling ? "/tooling" : "";
    const recordUrl = `/services/data/v${apiVersion}${apiPath}/sobjects/${objectType}/${recordId}`;
    
    sfConn.rest(recordUrl, {
      method: "PATCH",
      body: updateData
    }).then(() => {
      // Update successful - refresh only cells that changed
      changedCells.forEach(({td, fieldName, newValue, colIndex}) => {
        // Clear the cell completely and show the new value
        td.innerHTML = "";
        td.textContent = newValue == null ? "" : String(newValue);
        td.style.color = "";
        td.style.backgroundColor = "";
        td.style.border = "";
        td.style.padding = "";
        
        // Update the data in the table
        if (rt.table[rowIndex] && rt.table[rowIndex][colIndex] !== undefined) {
          rt.table[rowIndex][colIndex] = newValue;
        }
        
        // Update the record object
        if (rt.table[rowIndex] && rt.table[rowIndex][0] && typeof rt.table[rowIndex][0] === "object") {
          const record = rt.table[rowIndex][0];
          record[fieldName] = newValue;
        }
      });
      
      // Restore cells that didn't change - remove them from edit mode completely
      editableCells.forEach(({td, fieldName, colIndex, currentValue}) => {
        // Check if this cell was in the changedCells array
        const wasChanged = changedCells.some(changed => changed.td === td);
        if (!wasChanged) {
          // This cell didn't change, remove all edit elements and restore to original state
          const originalHTML = originalHTMLs.find(orig => orig.td === td);
          if (originalHTML) {
            // Remove all edit-related elements
            const input = td.querySelector(".inline-edit-input");
            if (input) {
              input.remove();
            }
            const validationMsg = td.querySelector(".inline-edit-validation");
            if (validationMsg) {
              validationMsg.remove();
            }
            const fieldInfo = td.querySelector(".inline-edit-info");
            if (fieldInfo) {
              fieldInfo.remove();
            }
            
            // Restore the cell content to its original state
            td.innerHTML = "";
            td.textContent = originalHTML.content;
            td.style.color = "";
            td.style.backgroundColor = "";
            td.style.border = "";
            td.style.padding = "";
            td.style.cursor = "";
            td.classList.remove("editable-cell");
            td.title = "";
          }
        }
      });
      
      // Restore first cell
      restoreEditButton(firstCell, tr, rt, rowIndex);
    }).catch(error => {
      // Extract error message from Salesforce response
      let errorMessage = "Failed to save";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.detail && Array.isArray(error.detail) && error.detail.length > 0) {
        // Salesforce REST API error format
        const errors = error.detail.map(err => {
          let msg = err.message || "";
          if (err.errorCode) {
            msg = `${err.errorCode}: ${msg}`;
          }
          if (err.fields && err.fields.length > 0) {
            msg += ` [${err.fields.join(", ")}]`;
          }
          return msg;
        });
        errorMessage = errors.join("; ");
      }
      
      // Show error message in each cell with visible styling
      editableCells.forEach(({td}) => {
        td.innerHTML = "";
        td.style.backgroundColor = "#fef7f7";
        td.style.border = "2px solid #c23934";
        td.style.padding = "4px";
        td.style.color = "#c23934";
        
        const errorDiv = document.createElement("div");
        errorDiv.style.display = "flex";
        errorDiv.style.alignItems = "center";
        errorDiv.style.gap = "4px";
        errorDiv.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0;">
            <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" fill="#c23934"/>
            <path d="M8 4v4M8 10h.01" stroke="#c23934" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span style="font-size: 0.875rem;">${errorMessage}</span>
        `;
        td.appendChild(errorDiv);
        td.title = errorMessage;
      });
      
      // Restore after 5 seconds or allow user to cancel
      setTimeout(() => {
        originalHTMLs.forEach(({td, html, content}) => {
          td.innerHTML = "";
          td.textContent = content;
          td.style.backgroundColor = "";
          td.style.border = "";
          td.style.padding = "";
          td.style.color = "";
          td.style.cursor = "";
          td.classList.remove("editable-cell");
          td.title = "Double-click to edit";
        });
        restoreEditButton(firstCell, tr, rt, rowIndex);
      }, 5000);
    });
  });
  
  // Cancel all changes
  cancelButton.addEventListener("click", function(e) {
    e.stopPropagation();
    originalHTMLs.forEach(({td, html, content, fieldName, recordId, objectType, fieldDescribe, colIndex, fieldParts}) => {
      // Remove all edit-related elements
      const input = td.querySelector(".inline-edit-input");
      if (input) {
        input.remove();
      }
      const validationMsg = td.querySelector(".inline-edit-validation");
      if (validationMsg) {
        validationMsg.remove();
      }
      const fieldInfo = td.querySelector(".inline-edit-info");
      if (fieldInfo) {
        fieldInfo.remove();
      }
      
      // Restore the cell content to its original state
      td.innerHTML = "";
      td.textContent = content;
      td.style.color = "";
      td.style.backgroundColor = "";
      td.style.border = "";
      td.style.padding = "";
      td.style.cursor = "";
      td.classList.remove("editable-cell");
      td.title = "";
    });
    
    // Restore first cell and re-add edit button with event listener
    // Use restoreEditButton which preserves recordlink
    restoreEditButton(firstCell, tr, rt, rowIndex);
  });
  
  // Clear first cell but preserve recordlink, then add buttons
  // Remove only buttons, not the recordlink
  const existingEditButton = firstCell.querySelector('button[title="Edit all fields"]');
  if (existingEditButton) {
    existingEditButton.remove();
  }
  
  // Store reference to recordlink before adding buttons
  const recordLinkEl = firstCell.querySelector('a[title="Show all data"]');
  
  // Add save/cancel buttons
  buttonContainer.appendChild(saveButton);
  buttonContainer.appendChild(cancelButton);
  // Insert buttons before recordlink to keep recordlink visible below
  if (recordLinkEl) {
    firstCell.insertBefore(buttonContainer, recordLinkEl);
  } else {
    firstCell.appendChild(buttonContainer);
  }
  firstCell.style.position = "relative";
  firstCell.style.zIndex = "10";
}

function renderCell(rt, cell, td, rowIndex, colIndex) {
  // Add edit button to first cell of data rows
  if (rowIndex !== undefined && colIndex !== undefined && rowIndex > 0 && colIndex === 0 && rt.header && rt.describeInfo) {
    const record = rt.table[rowIndex] && rt.table[rowIndex][0];
    if (record && typeof record === "object" && record.attributes && record.attributes.type) {
      const objectType = record.attributes.type;
      const recordId = record.Id || (record.attributes && record.attributes.url && record.attributes.url.replace(/.*\//, ""));
      
      if (recordId && isRecordId(recordId)) {
        // Add edit button
        const editButton = document.createElement("button");
        editButton.className = "slds-button slds-button_icon slds-button_icon-container slds-button_icon-small";
        editButton.type = "button";
        editButton.title = "Edit all fields";
        editButton.style.padding = "4px";
        editButton.style.borderRadius = "3px";
        editButton.style.border = "1px solid #706e6b";
        editButton.style.backgroundColor = "#ffffff";
        editButton.style.cursor = "pointer";
        editButton.style.display = "flex";
        editButton.style.alignItems = "center";
        editButton.style.justifyContent = "center";
        editButton.innerHTML = `<svg class="slds-button__icon" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
          <path fill="#706e6b" d="M8.5 1L11 3.5 4.5 10 2 10 2 7.5 8.5 1zM9.5 2L8 3.5 8.5 4 10 2.5 9.5 2z"/>
        </svg>`;
        
        editButton.addEventListener("mouseenter", function() {
          editButton.style.backgroundColor = "#f3f2f2";
        });
        editButton.addEventListener("mouseleave", function() {
          editButton.style.backgroundColor = "#ffffff";
        });
        
        editButton.addEventListener("click", function(e) {
          e.stopPropagation();
          const tr = td.closest("tr");
          if (tr) {
            startRowEdit(tr, rt, rowIndex);
          }
        });
        
        // Always add button, prepend if there's already content
        if (td.hasChildNodes() && td.children.length > 0) {
          // Check if edit button already exists
          const existingButton = td.querySelector('button[title="Edit all fields"]');
          if (existingButton) {
            existingButton.replaceWith(editButton);
          } else {
            td.insertBefore(editButton, td.firstChild);
          }
        } else {
          td.appendChild(editButton);
        }
      }
    }
  }
  
  // Inline editing is now only available via the "Edit all fields" button
  // Double-click editing has been disabled - users must use the edit button
  
  function popLink(recordInfo, label) {
    let a = document.createElement("a");
    a.href = "about:blank";
    a.title = "Show all data";
    a.addEventListener("click", e => {
      e.preventDefault();
      let pop = document.createElement("div");
      pop.className = "slds-dropdown slds-dropdown_left slds-dropdown_actions";
      let ul = document.createElement("ul");
      ul.className = "slds-dropdown__list";
      pop.appendChild(ul);
      td.appendChild(pop);
      let {objectTypes, recordId} = recordInfo();
      let objectType = undefined;
      function setLinks(linkOptions = {isCopy: true, isQueryRecord: true, isShowAllData: true, isViewInSalesforce: true}) {
        // Show All Data link
        if (linkOptions.isShowAllData) {
          let liShow = document.createElement("li");
          liShow.className = "slds-dropdown__item sfir-justify-left";
          ul.appendChild(liShow);
          let aShow = document.createElement("a");
          let args = new URLSearchParams();
          args.set("host", rt.sfHost);
          args.set("objectType", objectType);
          if (rt.isTooling) {
            args.set("useToolingApi", "1");
          }
          if (recordId) {
            args.set("recordId", recordId);
          }
          aShow.href = "inspect.html?" + args;
          aShow.target = "_blank";
          aShow.textContent = "Show all data";
          aShow.className = "view-inspector";
          let aShowIcon = document.createElement("div");
          aShowIcon.className = "icon";
          liShow.appendChild(aShow);
          aShow.prepend(aShowIcon);
          ul.appendChild(liShow);
        }

        // Query Record link
        if (linkOptions.isQueryRecord) {
          let liQuery = document.createElement("li");
          liQuery.className = "slds-dropdown__item sfir-justify-left";
          ul.appendChild(liQuery);
          let aQuery = document.createElement("a");
          let query = "SELECT Id FROM " + objectType + " WHERE Id = '" + recordId + "'";
          let queryArgs = new URLSearchParams();
          if (rt.isTooling) {
            queryArgs.set("useToolingApi", "1");
          }
          queryArgs.set("host", rt.sfHost);
          queryArgs.set("query", query);
          aQuery.href = "data-export.html?" + queryArgs;
          aQuery.target = "_blank";
          aQuery.textContent = "Query Record";
          aQuery.className = "query-record";
          let aQueryIcon = document.createElement("div");
          aQueryIcon.className = "icon";
          liQuery.appendChild(aQuery);
          aQuery.prepend(aQueryIcon);
          ul.appendChild(liQuery);
        }

        // View in Salesforce link
        if (linkOptions.isViewInSalesforce && recordId && isRecordId(recordId) && !recordId.endsWith("0000000000AAA")) {
          let liView = document.createElement("li");
          liView.className = "slds-dropdown__item sfir-justify-left";
          ul.appendChild(liView);
          let aView = document.createElement("a");
          aView.href = "https://" + rt.sfHost + "/" + recordId;
          //debug log specific link
          if (recordId.startsWith("07L")) {
            aView.href = "https://" + rt.sfHost + "/one/one.app#/alohaRedirect/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=" + recordId;
          }
          aView.target = "_blank";
          aView.textContent = "View in Salesforce";
          aView.className = "view-salesforce";
          let aViewIcon = document.createElement("div");
          aViewIcon.className = "icon";
          liView.appendChild(aView);
          aView.prepend(aViewIcon);
          ul.appendChild(liView);
        }

        // Download Event Log or Copy Id
        if (linkOptions.isCopy) {
          if (isEventLogFile(recordId)) {
            let liDownload = document.createElement("li");
            liDownload.className = "slds-dropdown__item sfir-justify-left";
            ul.appendChild(liDownload);
            let aDownload = document.createElement("a");
            aDownload.id = recordId;
            aDownload.target = "_blank";
            aDownload.textContent = "Download File";
            aDownload.className = "download-salesforce";
            let aDownloadIcon = document.createElement("div");
            aDownloadIcon.className = "icon";
            liDownload.appendChild(aDownload);
            aDownload.prepend(aDownloadIcon);
            aDownload.addEventListener("click", e => {
              sfConn.rest(e.target.id, {responseType: "text/csv"}).then(data => {
                let downloadLink = document.createElement("a");
                downloadLink.download = recordId.split("/")[6];
                downloadLink.href = "data:text/csv;charset=utf-8," + data;
                downloadLink.click();
              });
              ul.appendChild(liDownload);
              td.removeChild(pop);
            });
          } else {
            let liCopy = document.createElement("li");
            liCopy.className = "slds-dropdown__item sfir-justify-left";
            ul.appendChild(liCopy);
            let aCopy = document.createElement("a");
            aCopy.className = "copy-id";
            aCopy.textContent = "Copy Id";
            aCopy.id = recordId;
            let aCopyIcon = document.createElement("div");
            aCopyIcon.className = "icon";
            liCopy.appendChild(aCopy);
            aCopy.prepend(aCopyIcon);
            aCopy.addEventListener("click", e => {
              navigator.clipboard.writeText(e.target.id);
              td.removeChild(pop);
            });
            ul.appendChild(liCopy);
          }
        }
      }
      const defaultOptions = {
        isCopy: true,
        isQueryRecord: true,
        isShowAllData: true,
        isViewInSalesforce: true
      };

      if (objectTypes.length === 1 && objectTypes[0] !== "Unknown") {
        objectType = objectTypes[0];
        setLinks(defaultOptions);
      } else if (recordId && isRecordId(recordId)) {
        sfConn.rest(`/services/data/v${apiVersion}/ui-api/records/${recordId}?layoutTypes=Compact`).then(res => {
          objectType = res.apiName;
          setLinks(defaultOptions);
        }).catch(() => {
          objectType = null;
          defaultOptions.isQueryRecord = false;
          defaultOptions.isShowAllData = false;
          setLinks(defaultOptions);
        });
      } else {
        defaultOptions.isQueryRecord = false;
        defaultOptions.isShowAllData = false;
        objectType = null;
        setLinks(defaultOptions);
      }


      function closer(ev) {
        if (ev != e && ev.target.closest(".pop-menu") != pop) {
          removeEventListener("click", closer);
          pop.remove();
        }
      }
      addEventListener("click", closer);
    });
    a.textContent = label;
    td.appendChild(a);
  }
  function isEventLogFile(text) {
    // test the text to identify if this is a path to an eventLogFile
    return /^\/services\/data\/v[0-9]{2,3}.[0-9]{1}\/sobjects\/EventLogFile\/[a-z0-9]{5}0000[a-z0-9]{9}\/LogFile$/i.exec(text);
  }
  function isDateTimeFormat(text) {
    // test the text to identify if this is in Salesforce's dateTime format
    // YYYY-MM-DDTHH:mm:ss[.SSSSSS][+hhmm]
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{4})$/.test(text);
  }
  if (typeof cell == "object" && cell != null && cell.attributes && cell.attributes.type) {
    if (cell.attributes.type == "AggregateResult") {
      td.textContent = cell.attributes.type;
      return;
    }
    popLink(
      () => {
        let recordId = null;
        if (cell.attributes.url) {
          recordId = cell.attributes.url.replace(/.*\//, "");
        }
        let objectTypes = [cell.attributes.type];
        return {objectTypes, recordId};
      },
      cell.attributes.type
    );
  } else if (typeof cell == "string" && isRecordId(cell)) {
    popLink(
      () => {
        let recordId = cell;
        let {globalDescribe} = rt.describeInfo.describeGlobal(rt.isTooling);
        let objectTypes;
        if (globalDescribe) {
          let keyPrefix = recordId.substring(0, 3);
          objectTypes = globalDescribe.sobjects.filter(sobject => sobject.keyPrefix == keyPrefix).map(sobject => sobject.name);
        } else {
          objectTypes = [];
        }
        return {objectTypes, recordId};
      },
      cell
    );
  } else if (typeof cell == "string" && isEventLogFile(cell)) {
    popLink(
      () => {
        let recordId = cell;
        let objectTypes = [];
        return {objectTypes, recordId};
      },
      cell
    );
  } else if (cell == null) {
    td.textContent = "";
  } else if (localStorage.getItem("showLocalTime") == "true" && isDateTimeFormat(cell) && typeof cell == "string") {
    let textDate = new Date(cell);

    // Get the local timezone offset in minutes and convert to hours and minutes
    let offsetMinutes = textDate.getTimezoneOffset();
    let offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    let offsetMinutesRemainder = Math.abs(offsetMinutes) % 60;

    // Adjust the date to the local time based on the offset
    textDate.setMinutes(textDate.getMinutes() - offsetMinutes);

    // Format the date in the required format (YYYY-MM-DDTHH:mm:ss.sss+hhmm)
    let localTime = textDate.toISOString().replace("Z", "") // Remove 'Z' from ISO string (UTC)
      + (offsetMinutes > 0 ? "-" : "+") // Use the appropriate sign based on offset
      + String(offsetHours).padStart(2, "0") // Format hours with leading zero
      + String(offsetMinutesRemainder).padStart(2, "0"); // Format minutes with leading zero

    td.textContent = localTime;
  } else {
    td.textContent = cell;
  }
}

/*
A table that contains millions of records will freeze the browser if we try to render the entire table at once.
Therefore we implement a table within a scrollable area, where the cells are only rendered, when they are scrolled into view.

Limitations:
* It is not possible to select or search the contents of the table outside the rendered area. The user will need to copy to Excel or CSV to do that.
* Since we initially estimate the size of each cell and then update as we render them, the table will sometimes "jump" as the user scrolls.
* There is no line wrapping within the cells. A cell with a lot of text will be very wide.

Implementation:
Since we don't know the height of each row before we render it, we assume to begin with that it is fairly small, and we then grow it to fit the rendered content, as the user scrolls.
We never schrink the height of a row, to ensure that it stabilzes as the user scrolls. The heights are stored in the `rowHeights` array.
To avoid re-rendering the visible part on every scroll, we render an area that is slightly larger than the viewport, and we then only re-render, when the viewport moves outside the rendered area.
Since we don't know the height of each row before we render it, we don't know exactly how many rows to render.
However since we never schrink the height of a row, we never render too few rows, and since we update the height estimates after each render, we won't repeatedly render too many rows.
The initial estimate of the height of each row should be large enough to ensure we don't render too many rows in our initial render.
We only measure the current size at the end of each render, to minimize the number of synchronous layouts the browser needs to make.
We support adding new rows to the end of the table, and new cells to the end of a row, but not deleting existing rows, and we do not reduce the height of a row if the existing content changes.
Each row may be visible or hidden.
In addition to keeping track of the height of each cell, we keep track of the total height in order to adjust the height of the scrollable area, and we keep track of the position of the scrolled area.
After a scroll we search for the position of the new rendered area using the position of the old scrolled area, which should be the least amount of work when the user scrolls in one direction.
The table must have at least one row, since the code keeps track of the first rendered row.
We assume that the height of the cells we measure sum up to the height of the table.
We do the exact same logic for columns, as we do for rows.
We assume that the size of a cell is not influenced by the size of other cells. Therefore we style cells with `white-space: pre`.

@param element A scrollable DOM element to render the table within.
ScrollTable initScrollTable(DOMElement element);
interface Table {
  Cell[][] table; // a two-dimensional array of table rows and cells
  boolean[] rowVisibilities; // For each row, true if it is visible, or false if it is hidden
  boolean[] colVisibilities; // For each column, true if it is visible, or false if it is hidden
  // Refactor: The following three attributes are only used by renderCell, they should be moved to a different interface
  boolean isTooling;
  DescribeInfo describeInfo;
  String sfHost;
}
void renderCell(Table table, Cell cell, DOMElement element); // Render cell within element
interface Cell {
  // Anything, passed to the renderCell function
}
interface ScrollTable {
  void viewportChange(); // Must be called whenever the size of viewport changes.
  void dataChange(Table newData); // Must be called whenever the data changes. (even if it is the same object)
}
*/
export function initScrollTable(scroller) {
  let data = null;
  let scrolled = document.createElement("div");
  scrolled.className = "scrolltable-scrolled";
  scroller.appendChild(scrolled);

  let initialRowHeight = 15;
  let initialColWidth = 50;
  // Dynamic buffer calculation based on viewport size
  let bufferHeight = Math.min(500, scroller.offsetHeight);
  let bufferWidth = Math.min(500, scroller.offsetWidth);
  let headerRows = 1;
  let headerCols = 0;

  let rowHeights = [];
  let rowVisible = [];
  let rowCount = 0;
  let totalHeight = 0;
  let firstRowIdx = 0;
  let firstRowTop = 0;
  let lastRowIdx = 0;
  let lastRowTop = 0;
  let colWidths = [];
  let colVisible = [];
  let colCount = 0;
  let totalWidth = 0;
  let firstColIdx = 0;
  let firstColLeft = 0;
  let lastColIdx = 0;
  let lastColLeft = 0;

  function updateBuffers() {
    // Recalculate buffers when viewport changes
    bufferHeight = Math.min(500, scroller.offsetHeight);
    bufferWidth = Math.min(500, scroller.offsetWidth);
    console.log("Buffers updated:", {bufferHeight, bufferWidth});
  }

  function dataChange(newData) {
    console.log("Data changed");
    data = newData;
    if (data == null || data.rowVisibilities.length == 0 || data.colVisibilities.length == 0) {
      rowHeights = [];
      rowVisible = [];
      rowCount = 0;
      totalHeight = 0;
      firstRowIdx = 0;
      firstRowTop = 0;
      lastRowIdx = 0;
      lastRowTop = 0;

      colWidths = [];
      colVisible = [];
      colCount = 0;
      totalWidth = 0;
      firstColIdx = 0;
      firstColLeft = 0;
      lastColIdx = 0;
      lastColLeft = 0;
      renderData({force: true});
    } else {
      let newRowCount = data.rowVisibilities.length;
      for (let r = rowCount; r < newRowCount; r++) {
        rowHeights[r] = initialRowHeight;
        rowVisible[r] = 0;
      }
      rowCount = newRowCount;
      for (let r = 0; r < rowCount; r++) {
        let newVisible = Number(data.rowVisibilities[r]);
        let visibilityChange = newVisible - rowVisible[r];
        totalHeight += visibilityChange * rowHeights[r];
        if (r < firstRowIdx) {
          firstRowTop += visibilityChange * rowHeights[r];
        }
        rowVisible[r] = newVisible;
      }
      let newColCount = data.colVisibilities.length;
      for (let c = colCount; c < newColCount; c++) {
        colWidths[c] = initialColWidth;
        colVisible[c] = 0;
      }
      colCount = newColCount;
      for (let c = 0; c < colCount; c++) {
        let newVisible = Number(data.colVisibilities[c]);
        let visibilityChange = newVisible - colVisible[c];
        totalWidth += visibilityChange * colWidths[c];
        if (c < firstColIdx) {
          firstColLeft += visibilityChange * colWidths[c];
        }
        colVisible[c] = newVisible;
      }
      renderData({force: true});
    }
    updateBuffers(); // Ensure buffers are updated when data changes
  }

  let scrollTop = 0;
  let scrollLeft = 0;
  let offsetHeight = 0;
  let offsetWidth = 0;
  function viewportChange() {
    // Enhanced viewport change detection
    let newScrollTop = scroller.scrollTop;
    let newScrollLeft = scroller.scrollLeft;
    let newOffsetHeight = scroller.offsetHeight;
    let newOffsetWidth = scroller.offsetWidth;

    if (scrollTop !== newScrollTop || scrollLeft !== newScrollLeft
        || offsetHeight !== newOffsetHeight || offsetWidth !== newOffsetWidth) {
      console.log("Viewport changed:", {
        scrollTop: newScrollTop,
        scrollLeft: newScrollLeft,
        offsetHeight: newOffsetHeight,
        offsetWidth: newOffsetWidth
      });
      scrollTop = newScrollTop;
      scrollLeft = newScrollLeft;
      offsetHeight = newOffsetHeight;
      offsetWidth = newOffsetWidth;
      updateBuffers();
      renderData({force: false});
    }
  }

  function renderData({force}) {
    try {
      console.log("Rendering data. Force:", force);
      scrollTop = scroller.scrollTop;
      scrollLeft = scroller.scrollLeft;
      offsetHeight = scroller.offsetHeight;
      offsetWidth = scroller.offsetWidth;

      if (rowCount == 0 || colCount == 0) {
        scrolled.textContent = "";
        scrolled.style.height = "0px";
        scrolled.style.width = "0px";
        return;
      }

      if (!force && firstRowTop <= scrollTop && (lastRowTop >= scrollTop + offsetHeight || lastRowIdx == rowCount) && firstColLeft <= scrollLeft && (lastColLeft >= scrollLeft + offsetWidth || lastColIdx == colCount)) {
        return;
      }
      console.log("Rendering table");

      while (firstRowTop < scrollTop - bufferHeight && firstRowIdx < rowCount - 1) {
        firstRowTop += rowVisible[firstRowIdx] * rowHeights[firstRowIdx];
        firstRowIdx++;
      }
      while (firstRowTop > scrollTop - bufferHeight && firstRowIdx > 0) {
        firstRowIdx--;
        firstRowTop -= rowVisible[firstRowIdx] * rowHeights[firstRowIdx];
      }
      while (firstColLeft < scrollLeft - bufferWidth && firstColIdx < colCount - 1) {
        firstColLeft += colVisible[firstColIdx] * colWidths[firstColIdx];
        firstColIdx++;
      }
      while (firstColLeft > scrollLeft - bufferWidth && firstColIdx > 0) {
        firstColIdx--;
        firstColLeft -= colVisible[firstColIdx] * colWidths[firstColIdx];
      }

      lastRowIdx = firstRowIdx;
      lastRowTop = firstRowTop;
      while (lastRowTop < scrollTop + offsetHeight + bufferHeight && lastRowIdx < rowCount) {
        lastRowTop += rowVisible[lastRowIdx] * rowHeights[lastRowIdx];
        lastRowIdx++;
      }
      lastColIdx = firstColIdx;
      lastColLeft = firstColLeft;
      while (lastColLeft < scrollLeft + offsetWidth + bufferWidth && lastColIdx < colCount) {
        lastColLeft += colVisible[lastColIdx] * colWidths[lastColIdx];
        lastColIdx++;
      }

      scrolled.textContent = "";

      let table = document.createElement("table");
      table.className = "slds-table slds-table_cell-buffer slds-table_bordered slds-table_col-bordered slds-is-relative";
      let cellsVisible = false;

      // Ensure firstRowIdx never goes below headerRows
      firstRowIdx = Math.max(headerRows, firstRowIdx);

      // Render header rows separately to ensure they're always visible
      for (let r = 0; r < headerRows; r++) {
        if (rowVisible[r] == 0) continue;
        let row = data.table[r];
        let tr = document.createElement("tr");
        tr.className = "slds-line-height_reset";
        tr.style.position = "sticky";
        tr.style.top = "0";
        tr.style.zIndex = "9";
        for (let c = firstColIdx; c < lastColIdx; c++) {
          if (colVisible[c] == 0) continue;
          let cell = row[c];
          let td = document.createElement("td");
          let cellClasses = `scrolltable-cell header ${(cell.startsWith("_") && greyOutSkippedColumns) ? "skipped" : ""}`;
          if (data.preventLineWrap !== false) {
            cellClasses += " prevent-line-wrap";
          }
          td.className = cellClasses;
          td.style.minWidth = colWidths[c] + "px";
          td.style.height = rowHeights[r] + "px";
          renderCell(data, cell, td, r, c);
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }

      // Render data rows
      for (let r = Math.max(headerRows, firstRowIdx); r < lastRowIdx; r++) {
        if (rowVisible[r] == 0) {
          continue;
        }
        let row = data.table[r];
        let tr = document.createElement("tr");
        tr.className = "slds-line-height_reset";
        for (let c = firstColIdx; c < lastColIdx; c++) {
          if (colVisible[c] == 0) {
            continue;
          }
          let cell = row[c];
          let td = document.createElement("td");
          let cellClasses = "scrolltable-cell";
          if (c < headerCols) {
            cellClasses += " header";
          }
          if (data.preventLineWrap !== false) {
            cellClasses += " prevent-line-wrap";
          }
          td.className = cellClasses;
          td.style.minWidth = colWidths[c] + "px";
          td.style.height = rowHeights[r] + "px";
          renderCell(data, cell, td, r, c);
          tr.appendChild(td);
          cellsVisible = true;
        }
        table.appendChild(tr);
      }

      // Adjust table position to prevent header overlap at the top
      let tableTop = Math.max(0, firstRowTop);
      table.style.top = tableTop + "px";
      table.style.left = firstColLeft + "px";
      scrolled.appendChild(table);

      if (cellsVisible) {
        // Start adjusting heights from the first data row, not header
        let tr = table.children[headerRows];
        for (let r = Math.max(headerRows, firstRowIdx); r < lastRowIdx; r++) {
          if (rowVisible[r] == 0) {
            continue;
          }
          let rowRect = tr.firstElementChild.getBoundingClientRect();
          let oldHeight = rowHeights[r];
          let newHeight = Math.max(oldHeight, rowRect.height);
          rowHeights[r] = newHeight;
          totalHeight += newHeight - oldHeight;
          lastRowTop += newHeight - oldHeight;
          tr = tr.nextElementSibling;
        }
        let td = table.firstElementChild.firstElementChild;
        for (let c = firstColIdx; c < lastColIdx; c++) {
          if (colVisible[c] == 0) {
            continue;
          }
          let colRect = td.getBoundingClientRect();
          let oldWidth = colWidths[c];
          let newWidth = Math.max(oldWidth, colRect.width);
          colWidths[c] = newWidth;
          totalWidth += newWidth - oldWidth;
          lastColLeft += newWidth - oldWidth;
          td = td.nextElementSibling;
        }
      }
      console.log("Render complete");
    } catch (error) {
      console.error("Error in renderData:", error);
      // Enhanced error logging
      console.log("Current state:", {
        rowCount,
        colCount,
        firstRowIdx,
        lastRowIdx,
        firstColIdx,
        lastColIdx,
        scrollTop,
        scrollLeft,
        offsetHeight,
        offsetWidth
      });
    }
  }

  dataChange(null);
  scroller.addEventListener("scroll", viewportChange);
  // Added resize event listener to handle viewport changes
  window.addEventListener("resize", viewportChange);

  return {
    viewportChange,
    dataChange
  };
}
