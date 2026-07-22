/* eslint-disable react/prop-types */
/* global React */
const h = React.createElement;

/**
 * Renders the custom fields section for a subtab.
 * Fields that are missing from the record data (access denied or non-existent) are shown grayed-out.
 */
export default class CustomSubtabFields extends React.PureComponent {
  render() {
    const {fields, record} = this.props;
    if (!fields || fields.length === 0) return null;
    return h("div", {className: "custom-subtab-fields slds-m-top_x-small"},
      fields.map(field => {
        // Support dot-notation for relationship fields like Manager.Name
        const value = field.split(".").reduce((obj, key) => obj && obj[key] !== undefined ? obj[key] : undefined, record);
        const isInaccessible = value === undefined || value === null;
        return h("div", {
          key: field,
          className: "slds-grid slds-wrap custom-subtab-field-row" + (isInaccessible ? " custom-subtab-field-inaccessible" : ""),
          title: isInaccessible ? "This field is unavailable or inaccessible" : String(value)
        },
        h("span", {className: "slds-size_4-of-12 slds-text-body_small slds-text-color_weak custom-subtab-field-label"}, field),
        h("span", {className: "slds-size_8-of-12 slds-text-body_small custom-subtab-field-value"}, isInaccessible ? "—" : String(value))
        );
      })
    );
  }
}
