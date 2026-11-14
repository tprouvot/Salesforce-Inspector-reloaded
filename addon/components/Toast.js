let h = React.createElement;

let toastSequence = 0;

export function showToast(component, variant, title, message, duration) {
  component.setState({
    toast: {
      id: ++toastSequence,
      variant,
      title,
      message,
      duration: duration ?? (variant === "success" ? 2000 : 0),
    },
  });
}

export function hideToast(component) {
  component.setState({toast: null});
}

export function copyWithToast(component, copyAction) {
  const copied = copyAction();
  if (copied) {
    showToast(component, "success", "Copied to clipboard");
  }
  return copied;
}

export function downloadWithToast(component, downloadAction) {
  let result;
  try {
    result = downloadAction();
  } catch (error) {
    showToast(component, "error", "Download failed", error.message);
    throw error;
  }
  showToast(component, "success", "Download started");
  return result;
}

class Toast extends React.Component {
  componentDidMount() {
    this.scheduleDismiss();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.duration !== this.props.duration
      || prevProps.variant !== this.props.variant
      || prevProps.title !== this.props.title
      || prevProps.message !== this.props.message
      || prevProps.onClose !== this.props.onClose
    ) {
      this.scheduleDismiss();
    }
  }

  componentWillUnmount() {
    clearTimeout(this.dismissTimeout);
  }

  scheduleDismiss() {
    clearTimeout(this.dismissTimeout);
    if (this.props.duration > 0 && this.props.onClose) {
      this.dismissTimeout = setTimeout(this.props.onClose, this.props.duration);
    }
  }

  render() {
    const {variant, title, message, onClose, containerClassName} = this.props;

    // Construct the theme and icon class based on the variant
    const themeClass = `slds-theme_${variant}`;
    const iconClass = `slds-icon-utility-${variant === "success" ? "success" : variant === "error" ? "error" : "info"}`;
    // A toast with no message is a single line of text: keep icon, title and close button
    // on that one centred line instead of top-aligning them as SLDS does for multi-line toasts.
    const titleOnlyClass = message ? "" : " sfir-toast-title-only";

    // Helper function to render message content
    const renderMessage = () => {
      if (!message) {
        return null;
      }

      if (typeof message === "string") {
        return h("p", {}, message);
      }

      // Handle message object with link
      const {pre, linkText, linkTitle, link, onLinkClick, post} = message;
      return h("p", {},
        pre && h("span", {}, pre),
        linkText && h("a", {
          href: link || "#",
          title: linkTitle,
          className: "slds-text-link",
          onClick: onLinkClick ? (e) => { e.preventDefault(); onLinkClick(e); } : undefined
        }, linkText),
        post && h("span", {}, post)
      );
    };

    return h("div", {className: `slds-notify_container${containerClassName ? " " + containerClassName : ""}`},
      h("div", {
        className: `slds-notify slds-notify_toast ${themeClass}${titleOnlyClass}`,
        role: "status"
      },
      h("span", {className: "slds-assistive-text"}, title),
      h("span", {
        className: `slds-icon_container ${iconClass} slds-m-right_small slds-no-flex${message ? " slds-align-top" : ""}`,
        title: "Description of icon when needed"
      },
      h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
        h("use", {xlinkHref: `symbols.svg#${variant === "success" ? "success" : variant === "error" ? "error" : "info"}`})
      )
      ),
      h("div", {className: "slds-notify__content"},
        h("h2", {className: "slds-text-heading_small"}, title),
        renderMessage()
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
