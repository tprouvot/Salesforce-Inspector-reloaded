/* global React */
let h = React.createElement;

/**
 * Simple ButtonMenu component inspired by lightning-button-menu
 * @param {Object} props
 * @param {string} props.label - Button label text
 * @param {string} [props.menuAlignment] - Menu alignment (left, right, center)
 * @param {string} [props.alternativeText] - Assistive text
 * @param {Function} props.onSelect - Callback when menu item is selected (value) => void
 * @param {Array} props.menuItems - Array of {value, label, checked, disabled}
 */
const MENU_ID_PREFIX = "sfir-buttonmenu-menu-";
let menuIdCounter = 0;

export class ButtonMenu extends React.Component {
  constructor(props) {
    super(props);
    this.menuId = MENU_ID_PREFIX + (menuIdCounter++);
    this.state = {
      isOpen: false,
      focusedIndex: 0
    };
    this.buttonRef = null;
    this.dropdownRef = null;
    this.menuItemRefs = [];
    this.handleButtonClick = this.handleButtonClick.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleMenuItemClick = this.handleMenuItemClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleButtonKeyDown = this.handleButtonKeyDown.bind(this);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.isOpen && !prevState.isOpen) {
      document.addEventListener("click", this.handleDocumentClick);
      document.addEventListener("keydown", this.handleKeyDown);
      const focusable = this.getFocusableIndices();
      const firstFocusable = focusable.length > 0 ? focusable[0] : 0;
      this.setState({ focusedIndex: firstFocusable }, () => {
        if (this.menuItemRefs[firstFocusable]) {
          this.menuItemRefs[firstFocusable].focus();
        }
      });
    } else if (!this.state.isOpen && prevState.isOpen) {
      document.removeEventListener("click", this.handleDocumentClick);
      document.removeEventListener("keydown", this.handleKeyDown);
    } else if (
      this.state.isOpen &&
      prevState.focusedIndex !== this.state.focusedIndex &&
      this.menuItemRefs[this.state.focusedIndex]
    ) {
      this.menuItemRefs[this.state.focusedIndex].focus();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("click", this.handleDocumentClick);
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  getFocusableIndices() {
    const { menuItems = [] } = this.props;
    return menuItems
      .map((item, i) => (item.disabled ? -1 : i))
      .filter((i) => i >= 0);
  }

  handleButtonClick(e) {
    e.stopPropagation();
    this.setState((prevState) => ({ isOpen: !prevState.isOpen }));
  }

  handleDocumentClick(e) {
    if (
      this.buttonRef &&
      !this.buttonRef.contains(e.target) &&
      this.dropdownRef &&
      !this.dropdownRef.contains(e.target)
    ) {
      this.setState({ isOpen: false });
    }
  }

  handleMenuItemClick(e, item) {
    e.preventDefault();
    if (!item.disabled && this.props.onSelect) {
      this.props.onSelect(item.value);
    }
    this.setState({ isOpen: false }, () => {
      if (this.buttonRef) this.buttonRef.focus();
    });
  }

  handleButtonKeyDown(e) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      this.setState({ isOpen: true });
    }
  }

  handleKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.setState({ isOpen: false });
      if (this.buttonRef) {
        this.buttonRef.focus();
      }
      return;
    }
    if (
      !this.dropdownRef ||
      !this.dropdownRef.contains(e.target)
    ) {
      return;
    }
    const { menuItems = [] } = this.props;
    const focusable = this.getFocusableIndices();
    if (focusable.length === 0) return;
    let nextIndex = this.state.focusedIndex;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = focusable.indexOf(this.state.focusedIndex);
      nextIndex = focusable[idx < focusable.length - 1 ? idx + 1 : 0];
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = focusable.indexOf(this.state.focusedIndex);
      nextIndex = focusable[idx > 0 ? idx - 1 : focusable.length - 1];
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = focusable[0];
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = focusable[focusable.length - 1];
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const item = menuItems[this.state.focusedIndex];
      if (item && !item.disabled && this.props.onSelect) {
        this.props.onSelect(item.value);
        this.setState({ isOpen: false });
        if (this.buttonRef) {
          this.buttonRef.focus();
        }
      }
      return;
    }
    this.setState({ focusedIndex: nextIndex });
  }

  render() {
    const {
      label,
      menuAlignment = "left",
      alternativeText = "Show menu",
      menuItems = []
    } = this.props;

    const { isOpen } = this.state;

    const buttonClass = `slds-button ${label ? 'slds-button_neutral' : 'slds-button_icon slds-button_icon-border'}`;
    const dropdownClass = `slds-dropdown slds-dropdown_${menuAlignment}`;

    return h("div", {
      className: `slds-dropdown-trigger slds-dropdown-trigger_click${isOpen ? " slds-is-open" : ""}`
    },
      h("button", {
        ref: (ref) => (this.buttonRef = ref),
        className: buttonClass,
        "aria-haspopup": "menu",
        "aria-expanded": isOpen ? "true" : "false",
        "aria-controls": isOpen ? this.menuId : undefined,
        onClick: this.handleButtonClick,
        onKeyDown: this.handleButtonKeyDown,
        type: "button",
        title: alternativeText
      },
        label && h('span', {}, label),
        h('svg', {
          className: `slds-button__icon${label ? ' slds-button__icon_right' : ''}`,
          'aria-hidden': 'true'
        },
          h('use', { xlinkHref: 'symbols.svg#chevrondown' })
        ),
        h('span', { className: 'slds-assistive-text' }, alternativeText)
      ),
      isOpen &&
      h(
        "div",
        {
          ref: (ref) => (this.dropdownRef = ref),
          className: dropdownClass
        },
        h(
          "ul",
          {
            className: "slds-dropdown__list",
            role: "menu",
            id: this.menuId
          },
          menuItems.map((item, index) => {
            const isFocused = !item.disabled && this.state.focusedIndex === index;
            return h(
              "li",
              {
                key: item.value || index,
                className: "slds-dropdown__item",
                role: "presentation"
              },
              h(
                "button",
                {
                  ref: (ref) => (this.menuItemRefs[index] = ref),
                  type: "button",
                  role: "menuitemcheckbox",
                  tabIndex: isFocused ? 0 : -1,
                  "aria-checked": item.checked ? "true" : "false",
                  "aria-disabled": item.disabled ? "true" : undefined,
                  className: item.disabled ? "slds-is-disabled" : undefined,
                  onClick: (e) => this.handleMenuItemClick(e, item)
                },
                h("span", { className: "slds-truncate" },
                  item.checked &&
                    h("svg", {
                      className:
                        "slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small",
                      "aria-hidden": "true"
                    }, h("use", { xlinkHref: "symbols.svg#check" })),
                  item.label
                )
              )
            );
          })
        )
      )
    );
  }
}
