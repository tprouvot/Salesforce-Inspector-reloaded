/* global React */
let h = React.createElement;

/**
 * Reusable SLDS Spinner Component
 *
 * This component provides a spinner following Salesforce Design System patterns.
 * It can be configured with different sizes and types (brand, inverse).
 *
 * @param {Object} props - Component properties
 * @param {string} [props.size="small"] - Size of the spinner: "small", "medium", or "large"
 * @param {string} [props.type="inverse"] - Type of spinner: "brand" (blue) or "inverse" (white)
 * @param {string} [props.text="Loading"] - Accessible text for screen readers
 * @param {boolean} [props.centered=false] - Whether to center the spinner on the screen
 * @param {string} [props.className] - Additional CSS classes
 *
 * Example usage:
 *
 * // Small inverse spinner (default)
 * h(Spinner)
 *
 * // Medium brand spinner
 * h(Spinner, {size: "medium", type: "brand"})
 *
 * // Large centered brand spinner
 * h(Spinner, {size: "large", type: "brand", centered: true})
 */
export function Spinner(props) {
  const {
    size = "small",
    type = "inverse",
    text = "Loading",
    centered = false,
    className = ""
  } = props;

  // Build spinner classes
  const spinnerClasses = [
    "slds-spinner",
    `slds-spinner_${size}`,
    type === "brand" ? "slds-spinner_brand" : "slds-spinner_inverse",
    className
  ].filter(Boolean).join(" ");

  const spinnerElement = h("div", {
    role: "status",
    className: spinnerClasses
  },
    h("span", {className: "slds-assistive-text"}, text),
    h("div", {className: "slds-spinner__dot-a"}),
    h("div", {className: "slds-spinner__dot-b"})
  );

  if (centered) {
    return h("div", {
      className: "slds-is-relative sfir-spinner-centered"
    }, spinnerElement);
  }

  return h("div", {className: "slds-is-relative"}, spinnerElement);
}

