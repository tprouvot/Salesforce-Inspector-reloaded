/* global React */
// Reusable SLDS2 Combobox/Listbox component. Read-only, non-typeahead.
//
// Uses the standard ".slds-combobox_container" markup, which gets the
// "escape the <td>" positioning for free from slds.css: the container is
// position:relative and ".slds-dropdown" is position:absolute with a high
// z-index, so no extra CSS is needed from callers.
//
// mode: "single" (picklist/boolean) or "multi" (multipicklist, checkboxes;
// commits a semicolon-separated string). showCheckmark: false omits the
// selected-checkmark slot in single mode, for non-picklist reuse.
//
// No Salesforce Inspector-specific concepts here (FieldRow, describe,
// etc.) - dependent-picklist filtering/validation is the caller's job
// (see the two exported helpers below); this just renders `options`.

let h = React.createElement;

// Tests bit `controllerIndex` of a describe result's base64-encoded
// `picklistValues[i].validFor` token (dependent-picklist support). Bits are
// read left to right, MSB-first per byte, one bit per entry in the
// controlling field's own picklistValues array.
export function isValueValidForControllerIndex(validFor, controllerIndex) {
  if (controllerIndex == null || controllerIndex < 0) {
    return false;
  }
  if (!validFor) {
    // Not a dependent value (or metadata missing) - never filter it out.
    return true;
  }
  let bytes;
  try {
    bytes = atob(validFor);
  } catch (e) {
    return true;
  }
  let byteIndex = Math.floor(controllerIndex / 8);
  if (byteIndex >= bytes.length) {
    return false;
  }
  let bitIndex = 7 - (controllerIndex % 8);
  return ((bytes.charCodeAt(byteIndex) >> bitIndex) & 1) === 1;
}

// Index of `controllerValue` in the controller's own picklistValues array
// (unfiltered - validFor bit positions are assigned at creation and stay
// stable). Boolean controllers: 0 = false, 1 = true.
export function getControllerValueIndex(controllerFieldDescribe, controllerValue) {
  if (!controllerFieldDescribe) {
    return -1;
  }
  if (controllerFieldDescribe.type === "boolean") {
    if (controllerValue === true || controllerValue === "true") {
      return 1;
    }
    if (controllerValue === false || controllerValue === "false") {
      return 0;
    }
    return -1;
  }
  if (!controllerFieldDescribe.picklistValues || controllerValue == null || controllerValue === "") {
    return -1;
  }
  return controllerFieldDescribe.picklistValues.findIndex(pv => pv.value === controllerValue);
}

let nextComboboxId = 0;

export class Combobox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {isOpen: false, highlightedIndex: -1};
    this.instanceId = "sfir-combobox-" + (nextComboboxId++);
    this.optionNodes = {};
    this.onTriggerClick = this.onTriggerClick.bind(this);
    this.onTriggerKeyDown = this.onTriggerKeyDown.bind(this);
    this.onDocumentMouseDown = this.onDocumentMouseDown.bind(this);
  }
  componentDidMount() {
    document.addEventListener("mousedown", this.onDocumentMouseDown, true);
    if (this.props.autoFocus && this.refs.triggerInput) {
      this.refs.triggerInput.focus();
    }
  }
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
  }
  componentDidUpdate(prevProps, prevState) {
    if (!this.state.isOpen) {
      return;
    }
    // Options can shrink while open (e.g. a dependent picklist's controller
    // changes), so clamp before scrolling to the highlighted one.
    if (this.state.highlightedIndex >= this.props.options.length) {
      this.setState({highlightedIndex: Math.max(0, this.props.options.length - 1)});
      return;
    }
    if (this.state.highlightedIndex !== prevState.highlightedIndex || !prevState.isOpen) {
      this.scrollHighlightedIntoView();
    }
  }
  scrollHighlightedIntoView() {
    let node = this.optionNodes[this.state.highlightedIndex];
    if (node && node.scrollIntoView) {
      node.scrollIntoView({block: "nearest", inline: "nearest"});
    }
  }
  onDocumentMouseDown(e) {
    if (this.state.isOpen && this.refs.container && !this.refs.container.contains(e.target)) {
      this.setState({isOpen: false, highlightedIndex: -1});
    }
  }
  isMulti() {
    return this.props.mode === "multi";
  }
  selectedValues() {
    let {value} = this.props;
    if (this.isMulti()) {
      return value ? value.split(";").filter(v => v !== "") : [];
    }
    return value == null || value === "" ? [] : [value];
  }
  isSelected(option) {
    return this.selectedValues().includes(option.value);
  }
  openDropdown() {
    let {options} = this.props;
    let selected = this.selectedValues();
    let initialIndex = options.findIndex(o => selected.includes(o.value));
    this.setState({isOpen: true, highlightedIndex: initialIndex >= 0 ? initialIndex : 0});
  }
  closeDropdown() {
    this.setState({isOpen: false, highlightedIndex: -1});
  }
  onTriggerClick() {
    if (this.state.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }
  selectOption(option) {
    if (!option) {
      return;
    }
    if (this.isMulti()) {
      let selected = this.selectedValues();
      let newSelected = selected.includes(option.value)
        ? selected.filter(v => v !== option.value)
        : [...selected, option.value];
      this.props.onChange(newSelected.join(";"));
      // Keep the dropdown open so the user can keep checking more boxes.
    } else {
      this.props.onChange(option.value);
      this.closeDropdown();
      if (this.refs.triggerInput) {
        this.refs.triggerInput.focus();
      }
    }
  }
  moveHighlight(delta) {
    let {options} = this.props;
    if (options.length === 0) {
      return;
    }
    let next = this.state.highlightedIndex + delta;
    if (next < 0) {
      next = 0;
    }
    if (next > options.length - 1) {
      next = options.length - 1;
    }
    this.setState({highlightedIndex: next});
  }
  onTriggerKeyDown(e) {
    let {options, onCancel} = this.props;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!this.state.isOpen) {
          this.openDropdown();
        } else {
          this.moveHighlight(1);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!this.state.isOpen) {
          this.openDropdown();
        } else {
          this.moveHighlight(-1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!this.state.isOpen) {
          this.openDropdown();
        } else {
          this.selectOption(options[this.state.highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        if (this.state.isOpen) {
          this.closeDropdown();
        }
        if (onCancel) {
          onCancel();
        }
        break;
      case "Tab":
        this.closeDropdown();
        break;
      default:
        break;
    }
  }
  displayText() {
    let {value, placeholder} = this.props;
    if (this.isMulti()) {
      let selected = this.selectedValues();
      return selected.length === 0 ? (placeholder || "") : selected.join(";");
    }
    return (value == null || value === "") ? (placeholder || "") : value;
  }
  // Label(s) of the currently selected option(s), for the hover tooltip.
  selectedOptionLabel() {
    let {options} = this.props;
    let selected = this.selectedValues();
    if (selected.length === 0) {
      return null;
    }
    return selected
      .map(v => (options.find(o => o.value === v) || {label: v}).label)
      .join(", ");
  }
  render() {
    let {options, hasError, errorMessage, ariaLabel} = this.props;
    let {isOpen, highlightedIndex} = this.state;
    let listboxId = this.instanceId + "-listbox";
    let helpId = this.instanceId + "-help";
    let optionId = i => this.instanceId + "-option-" + i;
    let inputTitle = this.selectedOptionLabel() || undefined;

    return h("div", {
      className: "slds-combobox_container" + (hasError ? " slds-has-error" : ""),
      ref: "container"
    },
    h("div", {
      className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click" + (isOpen ? " slds-is-open" : ""),
      "aria-expanded": isOpen,
      "aria-haspopup": "listbox",
      role: "combobox"
    },
    h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
      h("input", {
        type: "text",
        className: "slds-input slds-combobox__input",
        readOnly: true,
        role: "textbox",
        "aria-label": ariaLabel,
        title: inputTitle,
        "aria-controls": listboxId,
        "aria-activedescendant": isOpen && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined,
        "aria-describedby": hasError ? helpId : undefined,
        autoComplete: "off",
        value: this.displayText(),
        onClick: this.onTriggerClick,
        onKeyDown: this.onTriggerKeyDown,
        ref: "triggerInput"
      }),
      h("span", {className: "slds-icon_container slds-icon-utility-chevrondown slds-current-color slds-input__icon slds-input__icon_right"},
        h("svg", {className: "slds-icon slds-icon_xx-small", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#chevrondown"})
        )
      )
    ),
    isOpen ? h("div", {id: listboxId, className: "slds-dropdown slds-dropdown_fluid slds-dropdown_length-5 sfir-combobox-dropdown", role: "listbox", "aria-multiselectable": this.isMulti()},
      h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"},
        options.length === 0
          ? h("li", {className: "slds-listbox__item", role: "presentation"},
            h("div", {className: "slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-empty"}, "No available options")
          )
          : options.map((option, i) => {
            let primaryText = option.value === "" ? option.label : option.value;
            let showLabel = option.value !== "" && option.label && option.label !== option.value;
            return h("li", {className: "slds-listbox__item", role: "presentation", key: option.value},
              h("div", {
                id: optionId(i),
                className: "slds-media slds-media_center slds-listbox__option slds-listbox__option_plain slds-media_small"
                  + (this.isSelected(option) ? " slds-is-selected" : "")
                  + (i === highlightedIndex ? " slds-has-focus" : ""),
                role: "option",
                "aria-selected": this.isSelected(option),
                title: option.label,
                ref: el => { this.optionNodes[i] = el; },
                onMouseEnter: () => this.setState({highlightedIndex: i}),
                onMouseDown: e => {
                  e.preventDefault();
                  this.selectOption(option);
                }
              },
              this.isMulti()
                ? h("span", {className: "slds-media__figure"},
                  h("div", {className: "slds-checkbox"},
                    h("input", {type: "checkbox", checked: this.isSelected(option), readOnly: true, tabIndex: -1}),
                    h("label", {className: "slds-checkbox__label"},
                      h("span", {className: "slds-checkbox_faux"})
                    )
                  )
                )
                : this.props.showCheckmark !== false
                  ? h("span", {className: "slds-media__figure slds-listbox__option-icon"},
                    this.isSelected(option) ? h("svg", {className: "slds-icon slds-icon_x-small sfir-combobox-check-icon", "aria-hidden": "true"},
                      h("use", {xlinkHref: "symbols.svg#check"})
                    ) : null
                  )
                  : null,
              h("span", {className: "slds-media__body"},
                h("span", {className: "slds-truncate"},
                  primaryText,
                  showLabel ? h("span", {className: "sfir-combobox-option-label-hint"}, " \u2014 " + option.label) : null
                )
              )
              )
            );
          }
          )
      )
    ) : null
    ),
    hasError ? h("div", {className: "slds-form-element__help", id: helpId}, errorMessage) : null
    );
  }
}
