/**
 * ColorPicker Component
 * A gradient-based color picker following SLDS design patterns
 */

import {colorNameToHex, hexToHsv, hsvToHex, DEFAULT_COLOR} from "../utils/colorUtils.js";

let h = React.createElement;

class ColorPicker extends React.Component {
  constructor(props) {
    super(props);

    // Validate and normalize the initial value
    const hexValue = colorNameToHex(props.value) || DEFAULT_COLOR;

    // Convert initial color to HSV
    const initialHsv = hexToHsv(hexValue);

    this.state = {
      hue: initialHsv.h,
      saturation: initialHsv.s,
      brightness: initialHsv.v,
      hexInput: props.value || DEFAULT_COLOR,
      adjustedPosition: props.position // Will be updated after mount
    };

    this.popoverRef = null;
    this.hueBarRef = null;
    this.gradientRef = null;
    
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.handleHueMouseDown = this.handleHueMouseDown.bind(this);
    this.handleGradientMouseDown = this.handleGradientMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleHexInput = this.handleHexInput.bind(this);
    this.handleApplyColor = this.handleApplyColor.bind(this);
    this.adjustPosition = this.adjustPosition.bind(this);
    this.isDragging = null; // null, 'hue', or 'gradient'
  }

  componentDidMount() {
    setTimeout(() => {
      document.addEventListener("mousedown", this.handleClickOutside);
      document.addEventListener("mousemove", this.handleMouseMove);
      document.addEventListener("mouseup", this.handleMouseUp);
      document.addEventListener("scroll", this.adjustPosition, true); // true = capture phase to catch all scrolls

      // Adjust position after render to place picker above the icon
      this.adjustPosition();
    }, 0);
  }

  componentDidUpdate(prevProps) {
    // Update state if prop value changes externally
    if (prevProps.value !== this.props.value) {
      const hexValue = colorNameToHex(this.props.value) || DEFAULT_COLOR;
      const hsv = hexToHsv(hexValue);
      this.setState({
        hue: hsv.h,
        saturation: hsv.s,
        brightness: hsv.v,
        hexInput: this.props.value
      });
    }
  }

  adjustPosition() {
    if (this.popoverRef && this.props.triggerRef) {
      const pickerRect = this.popoverRef.getBoundingClientRect();
      const iconRect = this.props.triggerRef.getBoundingClientRect();

      // Position above the icon with nubbin aligned to icon center
      // The nubbin_bottom-left positions the arrow ~1rem from the left edge
      // Offset by ~14px to align nubbin with icon center
      const top = iconRect.top - pickerRect.height - 12 + "px";
      const left = iconRect.left - 14 + "px";

      this.setState({adjustedPosition: {top, left}});
    }
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutside);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
    document.removeEventListener("scroll", this.adjustPosition, true);
  }

  handleClickOutside(event) {
    if (this.popoverRef && !this.popoverRef.contains(event.target)) {
      if (this.props.triggerRef && this.props.triggerRef.contains(event.target)) {
        return;
      }
      if (this.props.onClose) {
        this.props.onClose();
      }
    }
  }

  handleHueMouseDown(e) {
    e.preventDefault();
    this.isDragging = "hue";
    this.updateHue(e);
  }

  handleGradientMouseDown(e) {
    e.preventDefault();
    this.isDragging = "gradient";
    this.updateGradient(e);
  }

  handleMouseMove(e) {
    if (this.isDragging === "hue") {
      this.updateHue(e);
    } else if (this.isDragging === "gradient") {
      this.updateGradient(e);
    }
  }

  handleMouseUp() {
    this.isDragging = null;
  }

  updateHue(e) {
    if (!this.hueBarRef) return;

    const rect = this.hueBarRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const hue = x / rect.width;

    const hex = hsvToHex(hue, this.state.saturation, this.state.brightness);
    this.setState({hue, hexInput: hex.toUpperCase()});
  }

  updateGradient(e) {
    if (!this.gradientRef) return;

    const rect = this.gradientRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const saturation = x / rect.width;
    const brightness = 1 - (y / rect.height);

    const hex = hsvToHex(this.state.hue, saturation, brightness);
    this.setState({saturation, brightness, hexInput: hex.toUpperCase()});
  }

  handleHexInput(e) {
    const input = e.target.value;
    this.setState({hexInput: input});

    // Try to convert color name to hex (also handles hex codes)
    const convertedHex = colorNameToHex(input);

    if (convertedHex) {
      // Valid color name or hex - update the color picker visual state
      const hsv = hexToHsv(convertedHex);
      this.setState({
        hue: hsv.h,
        saturation: hsv.s,
        brightness: hsv.v
      });
    }
  }

  handleApplyColor() {
    if (this.props.onChange) {
      // Return the original input (color name or hex) as entered by user
      this.props.onChange(this.state.hexInput);
    }
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  render() {
    const {hue, saturation, brightness, hexInput, adjustedPosition} = this.state;

    // Calculate the background color for the selected hue
    const hueColor = hsvToHex(hue, 1, 1);

    // Calculate the actual hex color for preview (convert color name if needed)
    const displayColor = colorNameToHex(hexInput) || hexInput;

    // Calculate cursor positions
    const hueCursorLeft = hue * 100;
    const gradientCursorLeft = saturation * 100;
    const gradientCursorTop = (1 - brightness) * 100;

    return h("div", {
      ref: (el) => { this.popoverRef = el; },
      className: "slds-popover slds-popover_medium slds-nubbin_bottom-left color-picker-popover",
      role: "dialog",
      style: adjustedPosition
    },

    // Body
    h("div", {className: "slds-popover__body slds-p-around_small"},

      // Hue bar (rainbow on top)
      h("div", {
        ref: (el) => { this.hueBarRef = el; },
        className: "color-picker-hue-bar",
        onMouseDown: this.handleHueMouseDown
      },
      // Hue cursor
      h("div", {
        className: "color-picker-hue-cursor",
        style: {left: `${hueCursorLeft}%`}
      })
      ),

      // Gradient area (saturation/brightness shades below)
      h("div", {
        ref: (el) => { this.gradientRef = el; },
        className: "color-picker-gradient",
        style: {
          background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hueColor})`
        },
        onMouseDown: this.handleGradientMouseDown
      },
      // Gradient cursor
      h("div", {
        className: "color-picker-gradient-cursor",
        style: {
          left: `${gradientCursorLeft}%`,
          top: `${gradientCursorTop}%`
        }
      })
      ),

      // Hex input and preview
      h("div", {className: "slds-grid slds-gutters_x-small slds-grid_align-spread"},
        h("div", {className: "slds-col slds-form-element"},
          h("label", {className: "slds-form-element__label slds-text-body_small"}, "Hex"),
          h("input", {
            type: "text",
            className: "slds-input color-picker-hex-input",
            value: hexInput,
            onChange: this.handleHexInput,
            placeholder: DEFAULT_COLOR,
            maxLength: 20 // Increased to allow for color names
          })
        ),
        h("div", {className: "slds-col slds-shrink-none color-picker-preview-container"},
          h("div", {
            className: "color-picker-preview",
            style: {backgroundColor: displayColor}
          })
        )
      )
    ),

    // Footer
    h("div", {className: "slds-popover__footer slds-p-around_small"},
      h("div", {className: "slds-grid slds-grid_align-end slds-gutters_x-small"},
        h("button", {
          className: "slds-button slds-button_neutral slds-m-right_small",
          onClick: this.props.onClose
        }, "Cancel"),
        h("button", {
          className: "slds-button slds-button_brand",
          onClick: this.handleApplyColor
        }, "Apply")
      )
    )
    );
  }
}

export default ColorPicker;
