/* eslint-disable react/prop-types */
/* global React */
const h = React.createElement;

/**
 * Renders the custom buttons section for a subtab.
 * Substitutes {recordId} and {userId} placeholders in URLs.
 */
export default class CustomSubtabButtons extends React.PureComponent {
  render() {
    const {buttons, sfHost, linkTarget, recordId, userId} = this.props;
    if (!buttons || buttons.length === 0) return null;
    return h("div", {className: "custom-subtab-buttons slds-m-top_x-small slds-grid slds-wrap slds-gutters_x-small"},
      buttons.map((btn, i) => {
        if (!btn.label || !btn.link) return null;
        let url = btn.link
          .replace(/\{recordId\}/gi, recordId || "")
          .replace(/\{userId\}/gi, userId || "");
        const isExternal = url.startsWith("http") || url.startsWith("www");
        if (!isExternal) {
          url = "https://" + sfHost + url;
        }
        return h("a", {
          key: `custom-btn-${i}`,
          href: url,
          target: linkTarget || "_blank",
          rel: "noopener noreferrer",
          className: "slds-button slds-button_neutral custom-subtab-button slds-m-right_x-small slds-m-bottom_xx-small",
          title: url
        }, btn.label);
      })
    );
  }
}
