/* global React */
let h = React.createElement;

export class SldsCombobox extends React.Component {
  constructor(props) {
    super(props);
    this._mouseX = 0;
    this._mouseY = 0;
    this._rafId = null;
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._applyHoverFromMouse = this._applyHoverFromMouse.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleDropdownMouseLeave = this.handleDropdownMouseLeave.bind(this);
    this.containerRef = null;
    this.inputRef = null;
  }

  componentDidMount() {
    document.addEventListener("mousemove", this._handleMouseMove);
    if (this.props.isOpen) {
      this._startHoverLoop();
      setTimeout(() => document.addEventListener("click", this.handleDocumentClick), 0);
      this.scrollToActiveItem();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("mousemove", this._handleMouseMove);
    document.removeEventListener("click", this.handleDocumentClick);
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }
  }

  // Synchronize scroll position when visibility or selection changes.
  componentDidUpdate(prevProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      this._startHoverLoop();
      setTimeout(() => document.addEventListener("click", this.handleDocumentClick), 0);
      this.scrollToActiveItem();
    } else if (!this.props.isOpen && prevProps.isOpen) {
      this._stopHoverLoop();
      document.removeEventListener("click", this.handleDocumentClick);
    }

    if (this.props.isOpen && this.props.activeIndex !== prevProps.activeIndex) {
      this.scrollToActiveItem();
    }
  }

  // Ensures the active item is visible within the dropdown container.
  scrollToActiveItem() {
    const {activeIndex, isOpen, id} = this.props;
    if (activeIndex < 0 || !isOpen) return;

    const box = document.getElementById(id + "-listbox");
    const item = document.getElementById(id + "-listbox-option-" + activeIndex);

    if (!box || !item) return;

    const bRect = box.getBoundingClientRect();
    const iRect = item.getBoundingClientRect();

    if (iRect.top < bRect.top) {
      box.scrollTop = (item.offsetTop + iRect.height < bRect.height) ? 0 : item.offsetTop;
    } else if (iRect.bottom > bRect.bottom) {
      box.scrollTop += iRect.bottom - bRect.bottom;
    }
  }

  // Handles click events outside the component to close the dropdown.
  handleDocumentClick(e) {
    if (this.props.isOpen && this.containerRef && !this.containerRef.contains(e.target)) {
      if (this.props.onClose) {
        this.props.onClose();
      }
    }
  }

  _handleMouseMove(e) {
    this._mouseX = e.clientX;
    this._mouseY = e.clientY;
  }

  _startHoverLoop() {
    if (!this._rafId) {
      this._applyHoverFromMouse();
    }
  }

  _stopHoverLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // Manages visual hover state to ensure consistent highlighting.
  _applyHoverFromMouse() {
    const container = document.getElementById(this.props.id + "-listbox");

    if (container) {
      const el = document.elementFromPoint(this._mouseX, this._mouseY);

      const hoveredItems = container.querySelectorAll(".slds-listbox__item.sfir-hovered");
      for (let i = 0; i < hoveredItems.length; i++) {
        const item = hoveredItems[i];
        item.classList.remove("sfir-hovered");
      }

      if (el) {
        const li = el.closest(".slds-listbox__item");
        if (li && container.contains(li)) {
          li.classList.add("sfir-hovered");
        }
      }
    }

    if (this.props.isOpen) {
      this._rafId = requestAnimationFrame(this._applyHoverFromMouse);
    } else {
      this._rafId = null;
    }
  }

  // Handles mouse leaving dropdown area for better UX.
  handleDropdownMouseLeave() {
    // Clear any visual hover states when mouse exits dropdown
    const container = document.getElementById(this.props.id + "-listbox");
    if (container) {
      const hoveredItems = container.querySelectorAll(".slds-listbox__item.sfir-hovered");
      for (let i = 0; i < hoveredItems.length; i++) {
        hoveredItems[i].classList.remove("sfir-hovered");
      }
    }

    // If the input field doesn't have focus and user moved mouse away,
    // close the dropdown to avoid it staying open unintentionally
    if (this.inputRef && document.activeElement !== this.inputRef && this.props.onClose) {
      this.props.onClose();
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
      onClose,
      onDelete,
      className = "",
      renderItem,
      "aria-label": ariaLabel
    } = this.props;

    const listboxId = id + "-listbox";
    const activeDescendantId = activeIndex >= 0 ? listboxId + "-option-" + activeIndex : null;

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
            type: "text",
            className: "slds-input slds-combobox__input",
            "aria-autocomplete": "list",
            "aria-controls": listboxId,
            "aria-expanded": isOpen ? "true" : "false",
            "aria-haspopup": "listbox",
            "aria-activedescendant": activeDescendantId,
            "aria-label": ariaLabel,
            "aria-owns": listboxId,
            autoComplete: "off",
            role: "combobox",
            placeholder,
            value,
            onInput,
            onFocus,
            onClick,
            onKeyDown,
            ref: (el) => { this.inputRef = el; }
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
          },
          onMouseLeave: this.handleDropdownMouseLeave
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
                  // Only trigger onSelect if we didn't click on the delete button
                  if (!e.target.closest(".sfir-combobox-delete-btn")) {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(entry);
                  }
                }
              },
              h("span", {className: "slds-media__body"},
                renderItem ? renderItem(entry) : h("span", {className: "slds-truncate", title: entry.query}, entry.query.substring(0, 300))
              ),
              onDelete && h("button", {
                className: "sfir-combobox-delete-btn",
                title: "Delete this item",
                onMouseDown: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(entry, index);
                }
              },
              h("svg", {className: "sfir-combobox-delete-icon", "aria-hidden": "true"},
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
    )
    );
  }
}
