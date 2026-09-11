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
      this.alignDropdown();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleDocumentClick);
  }

  componentDidUpdate(prevProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      this.listenForOutsideClick();
    } else if (!this.props.isOpen && prevProps.isOpen) {
      document.removeEventListener("mousedown", this.handleDocumentClick);
    }
    if (this.props.isOpen) {
      // Entries change the width, so re-check the side on every open render.
      this.alignDropdown();
    }
    if (this.props.isOpen && this.props.activeIndex !== prevProps.activeIndex) {
      this.scrollToActiveItem();
    }
  }

  // Listens on mousedown rather than click: deleting an entry resizes the dropdown,
  // so by the time the click fires the pointer can sit outside it even though the
  // interaction started inside. Deferred so the press that opened it is not counted.
  listenForOutsideClick() {
    setTimeout(() => document.addEventListener("mousedown", this.handleDocumentClick), 0);
  }

  // Where the input sits in the toolbar depends on the org name, so a fixed side
  // would hang off one edge or the other. Open towards whichever side has more
  // room; the max-width in CSS keeps the dropdown inside the window either way.
  alignDropdown() {
    const box = document.getElementById(this.props.id + "-listbox");
    if (!box || !this.containerRef) {
      return;
    }
    const anchor = this.containerRef.getBoundingClientRect();
    const openLeft = document.documentElement.clientWidth - anchor.left >= anchor.right;
    box.classList.toggle("slds-dropdown_left", openLeft);
    box.classList.toggle("slds-dropdown_right", !openLeft);
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
      className = "",
      "aria-label": ariaLabel
    } = this.props;

    const listboxId = id + "-listbox";
    const hintId = id + "-delete-hint";

    // SLDS Markup Structure and Accessibility Attributes
    return h("div", {
      className: "slds-form-element " + className,
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
            id: id + "-input",
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
          h("span", {className: "slds-icon_container slds-icon-utility-search slds-input__icon slds-input__icon_right sfir-combobox-search-icon"},
            h("svg", {className: "slds-icon slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#search"})
            )
          )
        ),
        isOpen && h("div", {
          id: listboxId,
          // Horizontal alignment is set by alignDropdown, not an SLDS modifier.
          className: "slds-dropdown slds-dropdown_length-7 sfir-query-combobox-dropdown",
          role: "listbox"
        },
        // Keep keyboard focus in the combobox when clicking rows or the empty state,
        // without blocking the scrolling div's native scrollbar.
        h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation", onMouseDown: (e) => e.preventDefault()},
          entries.length === 0 ? h("li", {role: "presentation", className: "slds-listbox__item"},
            h("div", {className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-option"},
              h("span", {className: "slds-media__body"},
                h("span", {className: "slds-truncate"}, "No results found")
              )
            )
          ) : entries.map((entry, index) =>
            h("li", {role: "presentation", className: "slds-listbox__item", key: index},
              h("div", {
                id: listboxId + "-option-" + index,
                className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-option" + (index === activeIndex ? " slds-has-focus" : ""),
                role: "option",
                "aria-selected": index === activeIndex ? "true" : "false",
                onMouseDown: (e) => {
                  // The delete affordance is nested in the option, so ignore its clicks here.
                  if (e.target.closest(".sfir-combobox-delete")) {
                    return;
                  }
                  e.preventDefault();
                  onSelect(entry);
                }
              },
              h("span", {className: "slds-media__body sfir-combobox-body"}, renderItem(entry)),
              // Pointer shortcut only: options stay atomic for assistive technology,
              // which deletes with the Delete key announced by the hint below.
              onDelete && h("span", {
                className: "slds-button slds-button_icon slds-button_icon-x-small slds-m-left_x-small sfir-combobox-delete",
                title: "Delete this item",
                "aria-hidden": "true",
                onMouseDown: (e) => {
                  e.preventDefault();
                  onDelete(entry, index);
                }
              },
              h("svg", {className: "slds-button__icon"},
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
