let h = React.createElement;

class AlertBanner extends React.PureComponent {
  // From SLDS Alert Banner spec https://www.lightningdesignsystem.com/components/alert/

  render() {
    let {type, iconName, iconTitle, bannerText, link, assistiveText, onClose} = this.props;
    return (
      h("div", {className: `slds-notify slds-notify_alert slds-theme_${type}`, role: "alert"},
        h("span", {className: "slds-assistive-text"}, assistiveText | "Notification"),
        h("span", {className: `slds-icon_container slds-icon-utility-${iconName} slds-m-right_small slds-no-flex slds-align-top`, title: iconTitle},
          h("svg", {className: "slds-icon slds-icon_small", viewBox: "0 0 52 52"},
            h("use", {xlinkHref: `symbols.svg#${iconName}`})
          ),
        ),
        h("h2", {}, bannerText,
          h("p", {}, ""),
          link.props ? h("a", link.props, link.text) : link.text
        ),
        onClose && h("div", {className: "slds-notify__close"},
          h("button", {className: "slds-button slds-button_icon slds-button_icon-small slds-button_icon-inverse", title: "Close", onClick: onClose},
            h("svg", {className: "slds-button__icon", viewBox: "0 0 52 52"},
              h("use", {xlinkHref: "symbols.svg#close"})
            ),
            h("span", {className: "slds-assistive-text"}, "Close"),
          )
        )
      )
    );
  }
}
export default AlertBanner;
