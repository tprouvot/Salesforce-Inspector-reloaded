let h = React.createElement;

class Toast extends React.Component {
  render() {
    const {variant, title, message, onClose} = this.props;

    // Construct the theme and icon class based on the variant
    const themeClass = `slds-theme_${variant}`;
    const iconClass = `slds-icon-utility-${variant === "success" ? "success" : variant === "error" ? "error" : "info"}`;

    return h("div", {className: "slds-notify_container"},
      h("div", {
        className: `slds-notify slds-notify_toast ${themeClass}`,
        role: "status"
      },
      h("span", {className: "slds-assistive-text"}, title),
      h("span", {
        className: `slds-icon_container ${iconClass} slds-m-right_small slds-no-flex slds-align-top`,
        title: "Description of icon when needed"
      },
      h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
        h("use", {xlinkHref: `symbols.svg#${variant === "success" ? "success" : variant === "error" ? "error" : "info"}`})
      )
      ),
      h("div", {className: "slds-notify__content"},
        h("h2", {className: "slds-text-heading_small"}, title),
        h("p", {}, message)
      ),
      h("div", {className: "slds-notify__close"},
        h("button", {
          className: "slds-button slds-button_icon slds-button_icon-inverse",
          title: "Close",
          onClick: onClose
        },
        h("svg", {className: "slds-button__icon slds-button__icon_large", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#close"})
        ),
        h("span", {className: "slds-assistive-text"}, "Close")
        )
      )
      )
    );
  }
}
export default Toast;
