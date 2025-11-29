/**
 * ColorPicker Component
 * A gradient-based color picker following SLDS design patterns
 */

/* global React */
let h = React.createElement;

class ColorPicker extends React.Component {
  constructor(props) {
    super(props);

    // Convert initial color to HSV
    const initialHsv = this.hexToHsv(props.value || "#FF0000");

    this.state = {
      hue: initialHsv.h,
      saturation: initialHsv.s,
      brightness: initialHsv.v,
      hexInput: props.value || "#FF0000",
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

  // Color conversion utilities
  hexToHsv(hex) {
    hex = hex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;

    if (diff !== 0) {
      if (max === r) {
        h = (((g - b) / diff) + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = (((b - r) / diff) + 2) / 6;
      } else {
        h = (((r - g) / diff) + 4) / 6;
      }
    }

    return {h, s, v};
  }

  hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = v - c;

    let r = 0,
      g = 0,
      b = 0;

    if (h < 1 / 6) {
      r = c; g = x; b = 0;
    } else if (h < 2 / 6) {
      r = x; g = c; b = 0;
    } else if (h < 3 / 6) {
      r = 0; g = c; b = x;
    } else if (h < 4 / 6) {
      r = 0; g = x; b = c;
    } else if (h < 5 / 6) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    const toHex = (n) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return "#" + toHex(r) + toHex(g) + toHex(b);
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

    const hex = this.hsvToHex(hue, this.state.saturation, this.state.brightness);
    this.setState({hue, hexInput: hex.toUpperCase()});
  }

  updateGradient(e) {
    if (!this.gradientRef) return;

    const rect = this.gradientRef.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const saturation = x / rect.width;
    const brightness = 1 - (y / rect.height);

    const hex = this.hsvToHex(this.state.hue, saturation, brightness);
    this.setState({saturation, brightness, hexInput: hex.toUpperCase()});
  }

  handleHexInput(e) {
    const hex = e.target.value.toUpperCase();
    this.setState({hexInput: hex});

    const hexRegex = /^#?([0-9A-Fa-f]{6})$/;
    if (hexRegex.test(hex)) {
      const formattedHex = hex.startsWith("#") ? hex : `#${hex}`;
      const hsv = this.hexToHsv(formattedHex);
      this.setState({
        hue: hsv.h,
        saturation: hsv.s,
        brightness: hsv.v
      });
    }
  }

  handleApplyColor() {
    if (this.props.onChange) {
      this.props.onChange(this.state.hexInput);
    }
    if (this.props.onClose) {
      this.props.onClose();
    }
  }

  render() {
    const {hue, saturation, brightness, hexInput, adjustedPosition} = this.state;

    // Calculate the background color for the selected hue
    const hueColor = this.hsvToHex(hue, 1, 1);

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
            placeholder: "#000000",
            maxLength: 7
          })
        ),
        h("div", {className: "slds-col slds-shrink-none color-picker-preview-container"},
          h("div", {
            className: "color-picker-preview",
            style: {backgroundColor: hexInput}
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
