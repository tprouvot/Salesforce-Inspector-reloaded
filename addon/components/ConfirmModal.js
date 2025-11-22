/* global React */
const h = React.createElement;

function getSldsButtonClass(variant) {
  switch (variant) {
    case "base":
      return "slds-button";
    case "neutral":
      return "slds-button slds-button_neutral";
    case "brand":
      return "slds-button slds-button_brand";
    case "brand-outline":
    case "outline-brand":
      return "slds-button slds-button_outline-brand";
    case "destructive":
      return "slds-button slds-button_destructive";
    case "destructive-text":
      return "slds-button slds-button_destructive-text";
    case "success":
      return "slds-button slds-button_success";
    case "inverse":
      return "slds-button slds-button_inverse";
    default:
      return "slds-button slds-button_brand";
  }
}

function buildButtonContent(label, iconName, iconPosition) {
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
    if (e.key === "Escape" || e.key === "Esc") {
      // Prevent the escape from bubbling to parent handlers when the modal is open.
      e.stopPropagation();
      if (!this.props.isOpen) {
        return;
      }
      if (typeof this.props.onCancel === "function") {
        this.props.onCancel(e);
      } else if (typeof this.props.onConfirm === "function") {
        this.props.onConfirm(e);
      }
    }
  };

  render() {
    if (!this.props.isOpen) return null;

    const confirmVariant = this.props.confirmVariant || "brand";
    const cancelVariant = this.props.cancelVariant || "neutral";

    const confirmLabel = this.props.confirmLabel == null ? "Confirm" : this.props.confirmLabel;
    const cancelLabel = this.props.cancelLabel == null ? "Cancel" : this.props.cancelLabel;

    let confirmClassName = this.props.confirmButtonClass || getSldsButtonClass(confirmVariant);
    let cancelClassName = this.props.cancelButtonClass || getSldsButtonClass(cancelVariant);

    if (this.props.confirmStretch) {
      confirmClassName += " slds-button_stretch";
    }
    if (this.props.cancelStretch) {
      cancelClassName += " slds-button_stretch";
    }

    const confirmChildren = buildButtonContent(
      confirmLabel,
      this.props.confirmIconName,
      this.props.confirmIconPosition
    );

    const cancelChildren = buildButtonContent(
      cancelLabel,
      this.props.cancelIconName,
      this.props.cancelIconPosition
    );

    const confirmType = this.props.confirmType || "button";
    const cancelType = this.props.cancelType || "button";

    return h("div", {},
      h("div", {className: "slds-modal slds-fade-in-open", role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-heading-01"},
        h("div", {className: "slds-modal__container"},
          h("div", {className: "slds-modal__header"},
            h("h2", {id: "modal-heading-01", className: "slds-modal__title slds-text-heading_medium slds-hyphenate"}, this.props.title || "Important")
          ),
          h("div", {className: "slds-modal__content slds-p-around_medium"},
            this.props.message && h("p", {}, this.props.message),
            this.props.children
          ),
          h("div", {className: "slds-modal__footer"},
            this.props.onCancel && h("button", {
              onClick: this.props.onCancel,
              className: cancelClassName,
              disabled: this.props.cancelDisabled,
              type: cancelType,
              title: this.props.cancelTitle,
              name: this.props.cancelName,
              value: this.props.cancelValue,
              tabIndex: this.props.cancelTabIndex
            }, ...cancelChildren),
            this.props.onConfirm && h("button", {
              onClick: this.props.onConfirm,
              disabled: this.props.confirmDisabled,
              className: confirmClassName,
              type: confirmType,
              title: this.props.confirmTitle,
              name: this.props.confirmName,
              value: this.props.confirmValue,
              tabIndex: this.props.confirmTabIndex
            }, ...confirmChildren)
          )
        )
      ),
      h("div", {className: "slds-backdrop slds-backdrop_open"})
    );
  }
}
