/* global React */

/**
 * Reusable SLDS2 Combobox/Listbox component.
 * 
 * Supports single-select, multi-select, and searchable/typeahead modes.
 * 
 * PROPS:
 * -----------------------------------------------------------------
 * 1. Core Data: options, value, mode ("single" | "multi")
 * 2. Event Handlers: onChange, onCancel, onToggle 
 * 3. Search Mode: isSearchable (allows free-text typing & filtering), clearOnSelect (clears input after picking)
 * 4. Dimensions & Layout: width, height, dropdownWidth, dropdownHeight, textAlign, className, style
 * 5. Labels & Text: label, placeholder, ariaLabel, showLabel, showSecondaryText
 * 6. State & Validation: disabled, hasError, errorMessage, showCheckmark, autoFocus
 * 7. HTML Attributes: autoComplete, spellCheck, autoCorrect
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

let nextComboboxId = 0;

export class Combobox extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      isOpen: false, 
      highlightedIndex: -1,
      inputValue: props.value || ""
    };
    this.debounceTimeout = null;
    this.instanceId = "sfir-combobox-" + (nextComboboxId++);
    this.optionNodes = {};
    
    this.onTriggerClick = this.onTriggerClick.bind(this);
    this.onTriggerKeyDown = this.onTriggerKeyDown.bind(this);
    this.onDocumentMouseDown = this.onDocumentMouseDown.bind(this);
  }
  
  componentDidMount() {
    document.addEventListener("mousedown", this.onDocumentMouseDown, true);
    if (this.props.autoFocus && this.refs.triggerInput) this.refs.triggerInput.focus();
  }
  
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
  }
  
  componentDidUpdate(prevProps, prevState) {
    if (prevProps.value !== this.props.value && this.props.isSearchable) {
      this.setState({ inputValue: this.props.value || "" });
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
    this.setState({ isOpen: false, highlightedIndex: -1 }, () => {
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
      width, height, dropdownHeight, dropdownWidth, className, style, textAlign,
      label, placeholder, ariaLabel, showLabel = true, showSecondaryText = false,
      disabled, hasError, errorMessage, showCheckmark = true,
      autoComplete = "nope", spellCheck = false, autoCorrect = "off"
    } = this.props;
    
    let { isOpen, highlightedIndex } = this.state;
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
          dropdownHeight ? { maxHeight: dropdownHeight, overflowY: "auto" } : {}
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
