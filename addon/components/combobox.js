/* global React */

/**
 * Reusable SLDS2 Combobox Component
 *
 * This component provides a consistent picklist/listbox across all pages with support for
 * single-select, multi-select and searchable (typeahead) modes, replacing native select dropdowns.
 *
 * @param {Object} props - Component properties
 * @param {Array} props.options - Array of options: {value, label, title, secondaryText}
 * @param {string} [props.value] - Selected value (semicolon-separated in multi mode)
 * @param {string} [props.mode="single"] - Selection mode: "single" or "multi"
 * @param {Function} [props.onChange] - Called with the new value (semicolon-joined in multi mode; typed text in searchable mode, debounced 300ms)
 * @param {Function} [props.onCancel] - Called when Escape is pressed
 * @param {Function} [props.onToggle] - Called with true/false when the dropdown opens/closes
 * @param {boolean} [props.isSearchable] - Allows free-text typing and filters options by value, label, title and secondaryText
 * @param {boolean} [props.clearOnSelect] - Clears the input after an option is picked (searchable mode)
 * @param {string} [props.width] - Width of the root element
 * @param {string} [props.height] - Height of the root element and input
 * @param {string} [props.dropdownWidth] - Width of the dropdown (defaults to the input width)
 * @param {string} [props.dropdownHeight] - Max height of the dropdown
 * @param {string} [props.textAlign] - Text alignment of the input
 * @param {string} [props.className] - Additional CSS class for the root element
 * @param {Object} [props.style] - Inline style for the root element
 * @param {boolean} [props.fixedDropdown] - Renders the dropdown with position: fixed so it can float above overflow-clipping containers (flips upward when there is no room below)
 * @param {string} [props.id] - id of the input (lets <label htmlFor> and tests target the combobox); must be unique, so omit or make row-unique in tables
 * @param {string} [props.name] - name attribute of the input
 * @param {string} [props.label] - Form element label (wraps the combobox in slds-form-element)
 * @param {boolean} [props.showLabel=true] - Shows the label visibly (false keeps it as assistive text)
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.ariaLabel] - Accessible label (defaults to label)
 * @param {boolean} [props.showSecondaryText=false] - Displays option.secondaryText next to each option
 * @param {boolean} [props.showCheckmark=true] - Shows a checkmark next to selected options
 * @param {boolean} [props.disabled] - Disables the combobox
 * @param {boolean} [props.hasError] - Applies the SLDS error state
 * @param {string} [props.errorMessage] - Error text shown below the combobox (requires label)
 * @param {boolean} [props.autoFocus] - Focuses the input on mount
 * @param {string} [props.autoComplete="nope"] - Input autocomplete attribute
 * @param {boolean} [props.spellCheck=false] - Input spellcheck attribute
 * @param {string} [props.autoCorrect="off"] - Input autocorrect attribute
 *
 * Example usage:
 *
 * h(Combobox, {
 *   id: "sfir-field-select",
 *   isSearchable: true,
 *   showSecondaryText: true,
 *   fixedDropdown: true,
 *   options: fields.map(f => ({
 *     value: f.name,
 *     label: f.name,
 *     title: f.label,
 *     secondaryText: f.label
 *   })),
 *   value: this.state.fieldName,
 *   hasError: !!this.state.error,
 *   onChange: val => this.setState({fieldName: val})
 * })
 */

let h = React.createElement;

export function isValueValidForControllerIndex(validFor, controllerIndex) {
  if (controllerIndex == null || controllerIndex < 0) return false;
  if (!validFor) return true;
  let bytes;
  try { bytes = atob(validFor); } catch (e) { return true; }
  let byteIndex = Math.floor(controllerIndex / 8);
  if (byteIndex >= bytes.length) return false;
  let bitIndex = 7 - (controllerIndex % 8);
  return ((bytes.charCodeAt(byteIndex) >> bitIndex) & 1) === 1;
}

export function getControllerValueIndex(controllerFieldDescribe, controllerValue) {
  if (!controllerFieldDescribe) return -1;
  if (controllerFieldDescribe.type === "boolean") {
    if (controllerValue === true || String(controllerValue).toLowerCase() === "true") return 1;
    if (controllerValue === false || String(controllerValue).toLowerCase() === "false") return 0;
    return -1;
  }
  if (!controllerFieldDescribe.picklistValues || controllerValue == null || controllerValue === "") return -1;
  return controllerFieldDescribe.picklistValues.findIndex(pv => pv.value === controllerValue);
}

export function isPicklistValueValidForController(fieldDescribe, value, controllerIndex) {
  if (!fieldDescribe || !fieldDescribe.picklistValues) return false;
  return fieldDescribe.picklistValues.some(pv => pv.value === value && isValueValidForControllerIndex(pv.validFor, controllerIndex));
}

let nextComboboxId = 0;

export class Combobox extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      isOpen: false, 
      highlightedIndex: -1,
      inputValue: props.value || "",
      dropdownStyle: null
    };
    this.debounceTimeout = null;
    this.instanceId = "sfir-combobox-" + (nextComboboxId++);
    this.optionNodes = {};
    this.scrollParent = null;
    this.positionListenersAttached = false;
    
    this.onTriggerClick = this.onTriggerClick.bind(this);
    this.onTriggerKeyDown = this.onTriggerKeyDown.bind(this);
    this.onDocumentMouseDown = this.onDocumentMouseDown.bind(this);
    this.updateDropdownPosition = this.updateDropdownPosition.bind(this);
  }
  
  componentDidMount() {
    document.addEventListener("mousedown", this.onDocumentMouseDown, true);
    if (this.props.autoFocus && this.refs.triggerInput) this.refs.triggerInput.focus();
  }
  
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
    this.detachPositionListeners();
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
  }
  
  componentDidUpdate(prevProps, prevState) {
    if (prevProps.value !== this.props.value && this.props.isSearchable) {
      this.setState({ inputValue: this.props.value || "" });
    }

    if (this.props.fixedDropdown) {
      if (this.state.isOpen && !prevState.isOpen) {
        this.attachPositionListeners();
      } else if (!this.state.isOpen && prevState.isOpen) {
        this.detachPositionListeners();
      }
      if (this.state.isOpen) this.updateDropdownPosition();
    }

    if (!this.state.isOpen) return;
    
    let visibleOptions = this.getVisibleOptions();
    let maxIndex = visibleOptions.length - 1;
    
    if (this.state.highlightedIndex > maxIndex) {
      this.setState({ highlightedIndex: maxIndex });
      return;
    }
    
    let isOpening = !prevState.isOpen;
    if (this.state.highlightedIndex !== prevState.highlightedIndex || isOpening) {
      this.scrollHighlightedIntoView(isOpening);
    }
  }
  
  scrollHighlightedIntoView(isInstant) {
    let node = this.optionNodes[this.state.highlightedIndex];
    let listbox = this.refs.listbox;
    
    if (node && listbox) {
      let listboxRect = listbox.getBoundingClientRect();
      let nodeRect = node.getBoundingClientRect();
      let scrollBehavior = isInstant ? "auto" : "smooth";
      
      if (nodeRect.top < listboxRect.top) {
        listbox.scrollTo({ top: listbox.scrollTop - (listboxRect.top - nodeRect.top), behavior: scrollBehavior });
      } else if (nodeRect.bottom > listboxRect.bottom) {
        listbox.scrollTo({ top: listbox.scrollTop + (nodeRect.bottom - listboxRect.bottom), behavior: scrollBehavior });
      }
    }
  }
  
  getScrollParent(el) {
    for (let p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
      let oy = getComputedStyle(p).overflowY;
      if (oy === "auto" || oy === "scroll") return p;
    }
    return null;
  }
  
  attachPositionListeners() {
    if (this.positionListenersAttached) return;
    this.scrollParent = this.getScrollParent(this.refs.container);
    window.addEventListener("scroll", this.updateDropdownPosition, true);
    window.addEventListener("resize", this.updateDropdownPosition);
    this.positionListenersAttached = true;
  }
  
  detachPositionListeners() {
    if (!this.positionListenersAttached) return;
    window.removeEventListener("scroll", this.updateDropdownPosition, true);
    window.removeEventListener("resize", this.updateDropdownPosition);
    this.positionListenersAttached = false;
    this.scrollParent = null;
  }
  
  updateDropdownPosition(e) {
    if (!this.props.fixedDropdown || !this.state.isOpen) return;
    if (e && e.type === "scroll" && this.refs.listbox && e.target === this.refs.listbox) return;
    let container = this.refs.container;
    if (!container) return;
    let rect = container.getBoundingClientRect();
    
    let sp = this.scrollParent;
    if (sp) {
      let spRect = sp.getBoundingClientRect();
      if (rect.bottom < spRect.top || rect.top > spRect.bottom) {
        this.closeDropdown();
        return;
      }
    }
    
    let gap = 2;
    let spaceBelow = window.innerHeight - rect.bottom;
    let openUp = spaceBelow < 260 && rect.top > spaceBelow;
    let style = {
      position: "fixed",
      left: rect.left + "px",
      width: this.props.dropdownWidth || rect.width + "px",
      transform: "none",
      margin: 0
    };
    if (openUp) {
      style.top = "auto";
      style.bottom = (window.innerHeight - rect.top + gap) + "px";
    } else {
      style.top = (rect.bottom + gap) + "px";
      style.bottom = "auto";
    }
    
    let prev = this.state.dropdownStyle;
    if (prev && JSON.stringify(prev) === JSON.stringify(style)) return;
    this.setState({ dropdownStyle: style });
  }
  
  onDocumentMouseDown(e) {
    if (this.state.isOpen && this.refs.container && !this.refs.container.contains(e.target)) {
      this.closeDropdown();
    }
  }
  
  isMulti() { return this.props.mode === "multi"; }
  
  selectedValues() {
    let { value } = this.props;
    if (this.isMulti()) return value ? value.split(";").filter(v => v !== "") : [];
    return value == null ? [] : [value];
  }
  
  isSelected(option) { return this.selectedValues().includes(option.value); }
  
  getVisibleOptions() {
    let { options = [], isSearchable } = this.props;
    let val = isSearchable ? this.state.inputValue : this.props.value;
    if (!isSearchable || !val) return options;
    
    let lowerVal = val.toLowerCase();
    return options.filter(o => 
      (o.label && o.label.toLowerCase().includes(lowerVal)) || 
      (o.value && o.value.toLowerCase().includes(lowerVal)) ||
      (o.title && o.title.toLowerCase().includes(lowerVal)) ||
      (o.secondaryText && o.secondaryText.toLowerCase().includes(lowerVal))
    );
  }
  
  openDropdown() {
    if (this.props.disabled) return;
    let { onToggle } = this.props;
    let visibleOptions = this.getVisibleOptions();
    let selected = this.selectedValues();
    
    let initialIndex = visibleOptions.findIndex(o => selected.includes(o.value));
    this.setState({ isOpen: true, highlightedIndex: initialIndex >= 0 ? initialIndex : 0 }, () => {
      if (onToggle) onToggle(true);
    });
  }
  
  closeDropdown() {
    let { onToggle } = this.props;
    this.setState({ isOpen: false, highlightedIndex: -1, dropdownStyle: null }, () => {
      if (onToggle) onToggle(false);
    });
  }
  
  onTriggerClick() {
    if (this.props.disabled) return;
    this.state.isOpen ? this.closeDropdown() : this.openDropdown();
  }
  
  selectOption(option) {
    if (!option || this.props.disabled) return;
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    
    if (this.isMulti()) {
      let selected = this.selectedValues();
      let newSelected = selected.includes(option.value)
        ? selected.filter(v => v !== option.value)
        : [...selected, option.value];
      if (this.props.onChange) this.props.onChange(newSelected.join(";"));
    } else {
      if (this.props.isSearchable) {
        this.setState({ inputValue: this.props.clearOnSelect ? "" : (option.label !== undefined ? option.label : option.value) });
      }
      if (this.props.onChange) this.props.onChange(option.value);
      this.closeDropdown();
      if (this.refs.triggerInput && !this.props.clearOnSelect) this.refs.triggerInput.focus();
    }
  }
  
  moveHighlight(delta, maxLen) {
    if (maxLen === 0) return;
    let next = Math.max(0, Math.min(this.state.highlightedIndex + delta, maxLen - 1));
    this.setState({ highlightedIndex: next });
  }
  
  onTriggerKeyDown(e) {
    if (this.props.disabled) return;
    let { onCancel, isSearchable } = this.props;
    let visibleOptions = this.getVisibleOptions();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.state.isOpen ? this.moveHighlight(1, visibleOptions.length) : this.openDropdown();
        break;
      case "ArrowUp":
        e.preventDefault();
        this.state.isOpen ? this.moveHighlight(-1, visibleOptions.length) : this.openDropdown();
        break;
      case "Enter":
        e.preventDefault();
        if (!this.state.isOpen) {
          this.openDropdown();
        } else if (this.state.highlightedIndex >= 0 && visibleOptions[this.state.highlightedIndex]) {
          this.selectOption(visibleOptions[this.state.highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        if (this.state.isOpen) this.closeDropdown();
        if (onCancel) onCancel();
        break;
      case "Tab":
        this.closeDropdown();
        break;
      default:
        if (isSearchable) return;
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          let char = e.key.toLowerCase();
          let startIndex = this.state.highlightedIndex + 1;
          
          const findMatch = (start, end) => {
            for (let i = start; i < end; i++) {
              let labelText = (visibleOptions[i].label || "").toString().toLowerCase();
              let valueText = (visibleOptions[i].value || "").toString().toLowerCase();
              if (labelText.startsWith(char) || valueText.startsWith(char)) return i;
            }
            return -1;
          };
          
          let matchIndex = findMatch(startIndex, visibleOptions.length);
          if (matchIndex === -1) matchIndex = findMatch(0, startIndex);
          if (matchIndex !== -1) this.setState({ highlightedIndex: matchIndex, isOpen: true });
        }
        break;
    }
  }
  
  displayText() {
    let { value, placeholder, options = [], isSearchable } = this.props;
    if (isSearchable) return this.state.inputValue;
    if (this.isMulti()) {
      let selected = this.selectedValues();
      return selected.length === 0 ? (placeholder || "") : selected.map(v => (options.find(o => o.value === v) || { label: v }).label).join(";");
    }
    if (value == null) return placeholder || "";
    let selectedOption = options.find(o => o.value === value);
    if (selectedOption) return selectedOption.label !== undefined ? selectedOption.label : value;
    return value === "" ? (placeholder || "") : value;
  }
  
  selectedOptionLabel() {
    let { options = [] } = this.props;
    let selected = this.selectedValues();
    if (selected.length === 0) return null;
    return selected.map(v => {
      let o = options.find(opt => opt.value === v);
      return o ? (o.title || o.label || v) : v;
    }).join(", ");
  }
  
  render() {
    let {
      options = [], value, onChange, mode, isSearchable,
      width, height, dropdownHeight, dropdownWidth, className, style, textAlign, fixedDropdown,
      id, name, label, placeholder, ariaLabel, showLabel = true, showSecondaryText = false,
      disabled, hasError, errorMessage, showCheckmark = true,
      autoComplete = "nope", spellCheck = false, autoCorrect = "off"
    } = this.props;
    
    let { isOpen, highlightedIndex, dropdownStyle } = this.state;
    let listboxId = this.instanceId + "-listbox";
    let helpId = this.instanceId + "-help";
    let optionId = i => this.instanceId + "-option-" + i;
    
    let visibleOptions = this.getVisibleOptions();
    let inputTitle = this.selectedOptionLabel() || undefined;

    let rootStyle = Object.assign({}, style || {});
    if (width) rootStyle.width = width;
    if (height) rootStyle.height = height;

    if (isOpen) {
      rootStyle.opacity = 1;
      rootStyle.position = "relative";
      rootStyle.zIndex = 9000;
    }

    let chevronIcon = isOpen ? "chevronup" : "chevrondown";

    let comboboxInner = h("div", {
        className: "slds-combobox_container" + (!label && hasError ? " slds-has-error" : ""),
        ref: "container",
        style: { position: "relative" }
      },
      h("div", {
        className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click" + (isOpen ? " slds-is-open" : ""),
        "aria-expanded": isOpen,
        "aria-haspopup": "listbox",
        role: "combobox"
      },
      h("div", {
        className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", 
        role: "none",
        style: height ? { height } : {}
      },
        h("input", {
          type: "text",
          id: id,
          name: name,
          "data-value": this.isMulti() ? this.selectedValues().join(";") : (value == null ? "" : value),
          className: "slds-input slds-combobox__input",
          placeholder: placeholder,
          readOnly: !isSearchable,
          onChange: isSearchable ? (e) => {
            let val = e.target.value;
            this.setState({ inputValue: val });
            if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
            this.debounceTimeout = setTimeout(() => {
              if (onChange) onChange(val);
            }, 300);
            if (!this.state.isOpen) this.openDropdown();
          } : undefined,
          disabled: disabled,
          role: "textbox",
          "aria-label": ariaLabel || label,
          title: inputTitle,
          "aria-controls": listboxId,
          "aria-activedescendant": isOpen && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined,
          "aria-describedby": hasError ? helpId : undefined,
          autoComplete: autoComplete,
          spellCheck: spellCheck,
          autoCorrect: autoCorrect,
          value: this.displayText(),
          onClick: this.onTriggerClick,
          onKeyDown: this.onTriggerKeyDown,
          style: { 
            cursor: disabled ? "not-allowed" : (isSearchable ? "text" : "pointer"),
            ...(height ? { height: height, minHeight: height } : {}),
            ...(textAlign ? { textAlign } : {})
          },
          ref: "triggerInput"
        }),
        h("span", { className: "slds-icon_container slds-icon-utility-" + chevronIcon + " slds-current-color slds-input__icon slds-input__icon_right" },
          h("svg", { className: "slds-icon slds-icon_xx-small" + (disabled ? " slds-icon-text-light" : ""), "aria-hidden": "true" },
            h("use", { xlinkHref: "symbols.svg#" + chevronIcon })
          )
        )
      ),
      isOpen ? h("div", {
        id: listboxId, 
        ref: "listbox",
        className: "slds-dropdown slds-dropdown_fluid slds-dropdown_length-5 slds-dropdown_left sfir-combobox-dropdown", 
        role: "listbox", 
        "aria-multiselectable": this.isMulti(),
        style: Object.assign(
          { width: dropdownWidth || "100%", minWidth: "0", maxWidth: dropdownWidth ? "none" : undefined, left: "0", transform: "none" }, 
          dropdownHeight ? { maxHeight: dropdownHeight, overflowY: "auto" } : {},
          fixedDropdown
            ? (dropdownStyle || { position: "fixed", visibility: "hidden" })
            : {}
        )
      },
        h("ul", { className: "slds-listbox slds-listbox_vertical", role: "presentation" },
          visibleOptions.length === 0
            ? h("li", { className: "slds-listbox__item", role: "presentation" },
                h("div", { className: "slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-empty" }, "No available options")
              )
            : visibleOptions.map((option, i) => {
                let primaryText = (option.label !== undefined && option.label !== "") ? option.label : option.value;
                let displayHint = showSecondaryText && option.secondaryText;
                
                return h("li", { className: "slds-listbox__item", role: "presentation", key: option.value },
                  h("div", {
                    id: optionId(i),
                    "data-value": option.value,
                    className: "slds-media slds-media_center slds-listbox__option slds-listbox__option_plain slds-media_small"
                      + (this.isSelected(option) ? " slds-is-selected" : "")
                      + (i === highlightedIndex ? " slds-has-focus" : ""),
                    role: "option",
                    "aria-selected": this.isSelected(option),
                    title: option.title || option.label || option.value,
                    ref: el => { this.optionNodes[i] = el; },
                    onMouseEnter: () => this.setState({ highlightedIndex: i }),
                    onMouseDown: e => {
                      e.preventDefault();
                      this.selectOption(option);
                    }
                  },
                  this.isMulti()
                    ? h("span", { className: "slds-media__figure" },
                        h("div", { className: "slds-checkbox" },
                          h("input", { type: "checkbox", checked: this.isSelected(option), readOnly: true, tabIndex: -1 }),
                          h("label", { className: "slds-checkbox__label" },
                            h("span", { className: "slds-checkbox_faux" })
                          )
                        )
                      )
                    : showCheckmark !== false
                      ? h("span", { className: "slds-media__figure slds-listbox__option-icon" },
                          this.isSelected(option) ? h("svg", { className: "slds-icon slds-icon_x-small sfir-combobox-check-icon", "aria-hidden": "true" },
                            h("use", { xlinkHref: "symbols.svg#check" })
                          ) : null
                        )
                      : null,
                  h("span", { className: "slds-media__body" },
                    h("span", { className: "slds-truncate" },
                      primaryText,
                      displayHint ? h("span", { className: "sfir-combobox-option-label-hint" }, " \u2014 " + option.secondaryText) : null
                    )
                  )
                  )
                );
              })
        )
      ) : null
      ),
      (!label && hasError && errorMessage) ? h("div", { className: "slds-form-element__help", id: helpId }, errorMessage) : null
    );

    if (label) {
      return h("div", { className: `slds-form-element ${hasError ? "slds-has-error" : ""} ${className || ""}`.trim(), style: rootStyle },
        h("label", { className: `slds-form-element__label ${showLabel === false ? "slds-assistive-text" : ""}` }, label),
        h("div", { className: "slds-form-element__control" }, comboboxInner),
        hasError && errorMessage ? h("div", { className: "slds-form-element__help", id: helpId }, errorMessage) : null
      );
    }

    return h("div", { className: className, style: rootStyle }, comboboxInner);
  }
}
