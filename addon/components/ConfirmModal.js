/* global React */
const h = React.createElement;

const BUTTON_VARIANT_CLASSES = {
  base: "slds-button",
  neutral: "slds-button slds-button_neutral",
  brand: "slds-button slds-button_brand",
  "brand-outline": "slds-button slds-button_outline-brand",
  "outline-brand": "slds-button slds-button_outline-brand",
  destructive: "slds-button slds-button_destructive",
  "destructive-text": "slds-button slds-button_destructive-text",
  success: "slds-button slds-button_success",
  inverse: "slds-button slds-button_inverse"
};

function getSldsButtonClass(variant) {
  return BUTTON_VARIANT_CLASSES[variant] || "slds-button slds-button_brand";
}

function getButtonClassName(customClassName, variant, stretch) {
  let className = customClassName || getSldsButtonClass(variant);
  if (stretch) {
    className += " slds-button_stretch";
  }
  return className;
}

function buildButtonChildren(label, iconName, iconPosition) {
  const children = [];
  const hasLabel = label !== undefined && label !== null;
  const hasIcon = !!iconName;

  if (hasIcon && iconPosition !== "right") {
    const leftIconProps = {
      key: "icon-left",
      className: "slds-button__icon slds-button__icon_left",
      "aria-hidden": "true"
    };
    if (hasLabel) {
      leftIconProps.style = {paddingRight: "0.25rem"};
    }
    children.push(
      h("svg", leftIconProps,
        h("use", {xlinkHref: iconName})
      )
    );
  }

  if (hasLabel) {
    children.push(label);
  }

  if (hasIcon && iconPosition === "right") {
    const rightIconProps = {
      key: "icon-right",
      className: "slds-button__icon slds-button__icon_right",
      "aria-hidden": "true"
    };
    if (hasLabel) {
      rightIconProps.style = {paddingLeft: "0.25rem"};
    }
    children.push(
      h("svg", rightIconProps,
        h("use", {xlinkHref: iconName})
      )
    );
  }

  return children;
}

export default class ConfirmModal extends React.Component {
  componentDidMount() {
    if (this.props.isOpen) {
      window.addEventListener("keydown", this.handleKeyDown, true);
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isOpen && this.props.isOpen) {
      window.addEventListener("keydown", this.handleKeyDown, true);
    } else if (prevProps.isOpen && !this.props.isOpen) {
      window.removeEventListener("keydown", this.handleKeyDown, true);
    }
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown, true);
  }

  handleKeyDown = (e) => {
    const isEscapeKey = e.key === "Escape" || e.key === "Esc";
    if (!isEscapeKey) {
      return;
    }

    // Prevent the escape from bubbling to parent handlers when the modal is open.
    e.stopPropagation();

    if (!this.props.isOpen) {
      return;
    }

    // Call onCancel first, fall back to onConfirm if onCancel is not available
    if (typeof this.props.onCancel === "function") {
      this.props.onCancel(e);
    } else if (typeof this.props.onConfirm === "function") {
      this.props.onConfirm(e);
    }
  };

  render() {
    const {
      isOpen,
      title,
      message,
      children,
      onCancel,
      onConfirm,
      confirmVariant = "brand",
      cancelVariant = "neutral",
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      confirmButtonClass,
      cancelButtonClass,
      confirmStretch,
      cancelStretch,
      confirmIconName,
      confirmIconPosition,
      cancelIconName,
      cancelIconPosition,
      confirmType = "button",
      cancelType = "button",
      confirmDisabled,
      cancelDisabled,
      confirmTitle,
      cancelTitle,
      confirmName,
      cancelName,
      confirmValue,
      cancelValue,
      confirmTabIndex,
      cancelTabIndex
    } = this.props;

    if (!isOpen) {
      return null;
    }

    const confirmClassName = getButtonClassName(confirmButtonClass, confirmVariant, confirmStretch);
    const cancelClassName = getButtonClassName(cancelButtonClass, cancelVariant, cancelStretch);

    const confirmChildren = buildButtonChildren(confirmLabel, confirmIconName, confirmIconPosition);
    const cancelChildren = buildButtonChildren(cancelLabel, cancelIconName, cancelIconPosition);

    return h("div", {},
      h("div", {className: "slds-modal slds-fade-in-open", role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-heading-01"},
        h("div", {className: "slds-modal__container"},
          h("div", {className: "slds-modal__header"},
            h("h2", {id: "modal-heading-01", className: "slds-modal__title slds-text-heading_medium slds-hyphenate"}, title || "Important")
          ),
          h("div", {className: "slds-modal__content slds-p-around_medium"},
            message && h("p", {}, message),
            children
          ),
          h("div", {className: "slds-modal__footer"},
            onCancel && h("button", {
              onClick: onCancel,
              className: cancelClassName,
              disabled: cancelDisabled,
              type: cancelType,
              title: cancelTitle,
              name: cancelName,
              value: cancelValue,
              tabIndex: cancelTabIndex
            }, ...cancelChildren),
            onConfirm && h("button", {
              onClick: onConfirm,
              disabled: confirmDisabled,
              className: confirmClassName,
              type: confirmType,
              title: confirmTitle,
              name: confirmName,
              value: confirmValue,
              tabIndex: confirmTabIndex
            }, ...confirmChildren)
          )
        )
      ),
      h("div", {className: "slds-backdrop slds-backdrop_open"})
    );
  }
}
