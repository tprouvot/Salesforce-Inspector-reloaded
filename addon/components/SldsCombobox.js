/* global React */
let h = React.createElement;

export class SldsCombobox extends React.Component {
  constructor(props) {
    super(props);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.containerRef = null;
  }

  componentDidMount() {
    if (this.props.isOpen) {
      this.listenForOutsideClick();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("click", this.handleDocumentClick);
  }

  componentDidUpdate(prevProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      this.listenForOutsideClick();
    } else if (!this.props.isOpen && prevProps.isOpen) {
      document.removeEventListener("click", this.handleDocumentClick);
    }
    if (this.props.isOpen && this.props.activeIndex !== prevProps.activeIndex) {
      this.scrollToActiveItem();
    }
  }

  // Deferred so the click that opened the dropdown does not immediately close it.
  listenForOutsideClick() {
    setTimeout(() => document.addEventListener("click", this.handleDocumentClick), 0);
  }

  handleDocumentClick(e) {
    if (this.props.isOpen && this.containerRef && !this.containerRef.contains(e.target) && this.props.onClose) {
      this.props.onClose();
    }
  }

  scrollToActiveItem() {
    const item = document.getElementById(this.props.id + "-listbox-option-" + this.props.activeIndex);
    if (item) {
      item.scrollIntoView({block: "nearest"});
    }
  }

  render() {
    const {
      id,
      placeholder,
      value,
      entries,
      isOpen,
      activeIndex,
      onInput,
      onFocus,
      onClick,
      onKeyDown,
      onSelect,
      onDelete,
      renderItem,
      "aria-label": ariaLabel
    } = this.props;

    const listboxId = id + "-listbox";
    const hintId = id + "-delete-hint";

    // SLDS Markup Structure and Accessibility Attributes
    return h("div", {
      className: "slds-form-element",
      ref: (el) => { this.containerRef = el; }
    },
    h("div", {className: "slds-form-element__control"},
      h("div", {className: "slds-combobox_container"},
        h("div", {
          className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click" + (isOpen ? " slds-is-open" : "")
        },
        // role="none" removes the wrapper from the accessibility tree as per SLDS guidelines.
        h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
          h("input", {
            type: "text",
            className: "slds-input slds-combobox__input",
            "aria-autocomplete": "list",
            "aria-controls": listboxId,
            "aria-expanded": isOpen ? "true" : "false",
            "aria-haspopup": "listbox",
            "aria-activedescendant": activeIndex >= 0 ? listboxId + "-option-" + activeIndex : null,
            "aria-label": ariaLabel,
            "aria-describedby": onDelete ? hintId : null,
            autoComplete: "off",
            role: "combobox",
            placeholder,
            value,
            onInput,
            onFocus,
            onClick,
            onKeyDown
          }),
          h("span", {className: "slds-icon_container slds-icon-utility-search slds-input__icon slds-input__icon_right"},
            h("svg", {className: "slds-icon slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#search"})
            )
          )
        ),
        isOpen && h("div", {
          id: listboxId,
          className: "slds-dropdown slds-dropdown_left slds-dropdown_length-with-icon-10 sfir-query-combobox-dropdown",
          role: "listbox",
          onMouseDown: (e) => {
            // Prevents input blur when interacting with the dropdown container.
            e.preventDefault();
          }
        },
        h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"},
          entries.length === 0 ? h("li", {role: "presentation", className: "slds-listbox__item"},
            h("div", {className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small"},
              h("span", {className: "slds-media__body"},
                h("span", {className: "slds-truncate"}, "No results found")
              )
            )
          ) : entries.map((entry, index) =>
            h("li", {role: "presentation", className: "slds-listbox__item", key: index},
              h("div", {
                id: listboxId + "-option-" + index,
                className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-item" + (index === activeIndex ? " slds-has-focus" : ""),
                role: "option",
                "aria-selected": index === activeIndex ? "true" : "false",
                onMouseDown: (e) => {
                  e.preventDefault();
                  onSelect(entry);
                }
              },
              h("span", {className: "slds-media__body"}, renderItem(entry)),
              // Pointer shortcut only: options stay atomic for assistive technology,
              // which deletes with the Delete key announced by the hint below.
              onDelete && h("span", {
                className: "sfir-combobox-delete",
                title: "Delete this item",
                "aria-hidden": "true",
                onMouseDown: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(entry, index);
                }
              },
              h("svg", {className: "sfir-combobox-delete-icon"},
                h("use", {xlinkHref: "symbols.svg#delete"})
              )
              )
              )
            )
          )
        )
        )
        )
      )
    ),
    onDelete && h("span", {id: hintId, className: "slds-assistive-text"}, "Press Delete to remove the highlighted entry.")
    );
  }
}
