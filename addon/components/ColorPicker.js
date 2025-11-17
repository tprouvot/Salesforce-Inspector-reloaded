/* global React */

/**
 * ColorPicker Component
 * A gradient-based color picker following SLDS design patterns
 */

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
    this.isDragging = null; // null, 'hue', or 'gradient'
  }

  componentDidMount() {
    setTimeout(() => {
      document.addEventListener("mousedown", this.handleClickOutside);
      document.addEventListener("mousemove", this.handleMouseMove);
      document.addEventListener("mouseup", this.handleMouseUp);

      // Adjust position after render to place picker above the icon
      this.adjustPosition();
    }, 0);
  }

  adjustPosition() {
    if (this.popoverRef && this.props.triggerRef) {
      const pickerRect = this.popoverRef.getBoundingClientRect();
      const iconRect = this.props.triggerRef.getBoundingClientRect();

      // Position above the icon
      const top = iconRect.top - pickerRect.height - 8 + "px";
      const left = iconRect.left + "px";

      this.setState({adjustedPosition: {top, left}});
    }
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutside);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
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
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / diff + 2) / 6;
      } else {
        h = ((r - g) / diff + 4) / 6;
      }
    }

    return {h, s, v};
  }

  hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
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
      className: "slds-popover slds-popover_medium slds-nubbin_bottom",
      role: "dialog",
      style: {
        position: "fixed",
        ...adjustedPosition,
        zIndex: 7000,
        width: "280px"
      }
    },

    // Body
    h("div", {className: "slds-popover__body slds-p-around_small"},

      // Hue bar (rainbow on top)
      h("div", {
        ref: (el) => { this.hueBarRef = el; },
        onMouseDown: this.handleHueMouseDown,
        style: {
          position: "relative",
          width: "100%",
          height: "20px",
          borderRadius: "0.25rem",
          background: "linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)",
          cursor: "pointer",
          marginBottom: "12px",
          border: "1px solid #e5e5e5"
        }
      },
      // Hue cursor
      h("div", {
        style: {
          position: "absolute",
          left: `${hueCursorLeft}%`,
          top: "50%",
          width: "4px",
          height: "100%",
          background: "white",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 2px rgba(0,0,0,0.5)",
          pointerEvents: "none",
          borderRadius: "2px"
        }
      })
      ),

      // Gradient area (saturation/brightness shades below)
      h("div", {
        ref: (el) => { this.gradientRef = el; },
        onMouseDown: this.handleGradientMouseDown,
        style: {
          position: "relative",
          width: "100%",
          height: "200px",
          borderRadius: "0.25rem",
          background: `linear-gradient(to bottom, transparent, black), linear-gradient(to right, white, ${hueColor})`,
          cursor: "crosshair",
          marginBottom: "12px",
          border: "1px solid #e5e5e5"
        }
      },
      // Gradient cursor
      h("div", {
        style: {
          position: "absolute",
          left: `${gradientCursorLeft}%`,
          top: `${gradientCursorTop}%`,
          width: "16px",
          height: "16px",
          border: "2px solid white",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.3)",
          pointerEvents: "none"
        }
      })
      ),

      // Hex input and preview
      h("div", {className: "slds-grid slds-gutters_x-small slds-grid_align-spread"},
        h("div", {className: "slds-col slds-form-element"},
          h("label", {className: "slds-form-element__label slds-text-body_small"}, "Hex"),
          h("input", {
            type: "text",
            className: "slds-input",
            value: hexInput,
            onChange: this.handleHexInput,
            placeholder: "#000000",
            maxLength: 7,
            style: {fontSize: "0.875rem", padding: "0.25rem 0.5rem"}
          })
        ),
        h("div", {className: "slds-col slds-shrink-none", style: {paddingTop: "1.5rem"}},
          h("div", {
            style: {
              width: "50px",
              height: "32px",
              backgroundColor: hexInput,
              border: "1px solid #e5e5e5",
              borderRadius: "0.25rem"
            }
          })
        )
      )
    ),

    // Footer
    h("div", {className: "slds-popover__footer slds-p-around_small"},
      h("div", {className: "slds-grid slds-grid_align-end slds-gutters_x-small"},
        h("button", {
          className: "slds-button slds-button_neutral",
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
