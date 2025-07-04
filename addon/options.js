/* global React ReactDOM */
import {sfConn, apiVersion, defaultApiVersion} from "./inspector.js";
import {nullToEmptyString, getLatestApiVersionFromOrg, Constants} from "./utils.js";
/* global initButton */
import {DescribeInfo} from "./data-load.js";
import Toast from "./components/Toast.js";
import Tooltip from "./components/Tooltip.js";

// --- Generic Helpers ---
const h = React.createElement;

// Move normalizeSeverity here so it is available everywhere
const normalizeSeverity = (sev, direction = "ui") => {
  if (direction === "ui") return sev === "note" ? "info" : sev;
  if (direction === "storage") return sev === "info" ? "note" : sev;
  return sev;
};

function InfoIcon({tooltipId, tooltip, className = "", style = {}, tabIndex = 0, placement = ""}) {
  const tooltipClass = "slds-popover slds-popover_tooltip slds-nubbin_" + (placement || "bottom-left");
  return h("span", {
    className: `info-icon-container ${className}`,
    style,
    tabIndex,
    onMouseOver: e => {
      const popover = e.currentTarget.querySelector(".slds-popover");
      if (popover) {
        popover.style.display = "block";
      }
    },
    onMouseOut: e => {
      const popover = e.currentTarget.querySelector(".slds-popover");
      if (popover) {
        popover.style.display = "none";
      }
    },
    onFocus: e => {
      const popover = e.currentTarget.querySelector(".slds-popover");
      if (popover) {
        popover.style.display = "block";
      }
    },
    onBlur: e => {
      const popover = e.currentTarget.querySelector(".slds-popover");
      if (popover) {
        popover.style.display = "none";
      }
    }
  },
  h("svg", {
    className: "slds-icon slds-icon-text-default slds-icon_xx-small info-icon-svg",
    "aria-hidden": "true",
    viewBox: "0 0 52 52",
    style: {width: "16px", height: "16px", verticalAlign: "middle"}
  },
  h("use", {xlinkHref: "symbols.svg#info"})
  ),
  h("span", {
    className: tooltipClass,
    id: tooltipId,
    role: "tooltip",
    style: {display: "none", position: "absolute", zIndex: 1000, minWidth: "180px", maxWidth: "320px"}
  }, tooltip)
  );
}

class Option extends React.Component {

  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.onChangeToggle = this.onChangeToggle.bind(this);
    this.key = props.storageKey;
    this.type = props.type;
    this.label = props.label;
    this.tooltip = props.tooltip;
    this.placeholder = props.placeholder;
    this.actionButton = props.actionButton;
    this.inputSize = props.inputSize || "3";
    let value = localStorage.getItem(this.key);
    if (props.default !== undefined && value === null) {
      value = props.type != "text" ? JSON.stringify(props.default) : props.default;
      localStorage.setItem(this.key, value);
    }
    this.state = {[this.key]: this.type == "toggle" ? !!JSON.parse(value)
      : this.type == "select" ? (value || props.default || props.options?.[0]?.value)
        : value};
    this.title = props.title;
  }

  onChangeToggle(e) {
    const enabled = e.target.checked;
    this.setState({[this.key]: enabled});
    localStorage.setItem(this.key, JSON.stringify(enabled));
  }

  onChange(e) {
    let inputValue = e.target.value;
    this.setState({[this.key]: inputValue});
    localStorage.setItem(this.key, inputValue);
  }

  render() {
    const id = this.key;
    const isTextOrNumber = this.type == "text" || this.type == "number";
    const isTextArea = this.type == "textarea";
    const isSelect = this.type == "select";

    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_3-of-12 text-align-middle"},
        h("span", {}, this.title,
          h(Tooltip, {tooltip: this.tooltip, idKey: this.key})
        )
      ),
      this.actionButton && h("div", {className: "slds-col slds-size_1-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control"},
          h("button", {
            className: "slds-button slds-button_brand",
            onClick: (e) => this.actionButton.onClick(e, this.props.model),
            title: this.actionButton.title || "Action"
          }, this.actionButton.label || "Action")
        )
      ),
      isTextOrNumber ? (h("div", {className: "slds-col slds-size_" + this.inputSize + "-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control slds-col slds-size_5-of-12"},
          h("input", {type: this.type, id, className: "slds-input", placeholder: this.placeholder, value: nullToEmptyString(this.state[this.key]), onChange: this.onChange})
        )
      ))
        : isTextArea ? (h("div", {className: "slds-col slds-size_" + this.inputSize + "-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
          h("div", {className: "slds-form-element__control slds-col slds-size_5-of-12"},
            h("textarea", {type: this.type, id, className: "slds-input", placeholder: this.placeholder, value: nullToEmptyString(this.state[this.key]), onChange: this.onChange})
          )
        ))
          : isSelect ? (h("div", {className: "slds-col slds-size_" + this.inputSize + "-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
            h("div", {className: "slds-form-element__control slds-col slds-size_5-of-12"},
              h("select", {
                className: "slds-input slds-m-right_small",
                value: this.state[this.key],
                onChange: this.onChange
              },
              this.props.options.map(opt =>
                h("option", {key: opt.value, value: opt.value}, opt.label)
              ))
            )
          ))
            : (h("div", {className: "slds-col slds-size_7-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"}),
            h("div", {dir: "rtl", className: "slds-form-element__control slds-col slds-size_1-of-12 slds-p-right_medium"},
              h("label", {className: "slds-checkbox_toggle slds-grid"},
                h("input", {type: "checkbox", required: true, id, "aria-describedby": id, className: "slds-input", checked: this.state[this.key], onChange: this.onChangeToggle}),
                h("span", {id, className: "slds-checkbox_faux_container center-label"},
                  h("span", {className: "slds-checkbox_faux"}),
                  h("span", {className: "slds-checkbox_on"}, "Enabled"),
                  h("span", {className: "slds-checkbox_off"}, "Disabled"),
                )
              )
            ))
    );
  }
}

Option.propTypes = {
  storageKey: React.PropTypes.string.isRequired,
  type: React.PropTypes.string.isRequired,
  label: React.PropTypes.string,
  tooltip: React.PropTypes.string,
  placeholder: React.PropTypes.string,
  actionButton: React.PropTypes.object,
  inputSize: React.PropTypes.string,
  default: React.PropTypes.any,
  title: React.PropTypes.string,
  options: React.PropTypes.array,
  model: React.PropTypes.object
};

// --- Tab-Specific Components (in tab order) ---

class ArrowButtonOption extends React.Component {

  constructor(props) {
    super(props);
    this.onChangeArrowOrientation = this.onChangeArrowOrientation.bind(this);
    this.onChangeArrowPosition = this.onChangeArrowPosition.bind(this);
    this.state = {
      arrowButtonOrientation: localStorage.getItem("popupArrowOrientation") ? localStorage.getItem("popupArrowOrientation") : "vertical",
      arrowButtonPosition: localStorage.getItem("popupArrowPosition") ? localStorage.getItem("popupArrowPosition") : "20"
    };
    this.timeout;
  }

  onChangeArrowOrientation(e) {
    let orientation = e.target.value;
    this.setState({arrowButtonOrientation: orientation});
    localStorage.setItem("popupArrowOrientation", orientation);
    window.location.reload();
  }

  onChangeArrowPosition(e) {
    let position = e.target.value;
    this.setState({arrowButtonPosition: position});
    console.log("[SFInspector] New Arrow Position Value: ", position);
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      console.log("[SFInspector] Setting Arrow Position: ", position);
      localStorage.setItem("popupArrowPosition", position);
      window.location.reload();
    }, 1000);
  }

  render() {
    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_x-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, "Popup arrow button orientation and position")
      ),
      h("div", {className: "slds-col slds-size_8-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("label", {className: "slds-col slds-size_2-of-12 slds-text-align_right"}, "Orientation:"),
        h("select", {className: "slds-col slds-size_2-of-12 slds-combobox__form-element slds-input combobox-container", defaultValue: this.state.arrowButtonOrientation, name: "arrowPosition", id: "arrowPosition", onChange: this.onChangeArrowOrientation},
          h("option", {value: "horizontal"}, "Horizontal"),
          h("option", {value: "vertical"}, "Vertical")
        ),
        h("label", {className: "slds-m-left_medium slds-col slds-size_2-of-12 slds-text-align_right", htmlFor: "arrowPositionSlider"}, "Position (%):"),
        h("div", {className: "slds-form-element__control slider-container slds-col slds-size_4-of-12"},
          h("div", {className: "slds-slider"},
            h("input", {type: "range", id: "arrowPositionSlider", className: "slds-slider__range", value: nullToEmptyString(this.state.arrowButtonPosition), min: "0", max: "100", step: "1", onChange: this.onChangeArrowPosition}),
            h("span", {className: "slds-slider__value", "aria-hidden": true}, this.state.arrowButtonPosition)
          )
        )
      )
    );
  }
}

class APIVersionOption extends React.Component {

  constructor(props) {
    super(props);
    this.onChangeApiVersion = this.onChangeApiVersion.bind(this);
    this.onRestoreDefaultApiVersion = this.onRestoreDefaultApiVersion.bind(this);
    this.state = {apiVersion: localStorage.getItem("apiVersion") ? localStorage.getItem("apiVersion") : apiVersion};
  }

  async onChangeApiVersion(e) {
    let {sfHost} = this.props.model;
    const inputElt = e.target;
    const newApiVersion = e.target.value;
    if (this.state.apiVersion < newApiVersion) {
      const latestApiVersion = await getLatestApiVersionFromOrg(sfHost);
      if (latestApiVersion >= newApiVersion) {
        localStorage.setItem("apiVersion", newApiVersion + ".0");
        this.setState({apiVersion: newApiVersion + ".0"});
      } else {
        inputElt.setAttribute("max", latestApiVersion);
        inputElt.setCustomValidity("Maximum version available: " + latestApiVersion);
        inputElt.reportValidity();
      }
    } else {
      localStorage.setItem("apiVersion", newApiVersion + ".0");
      this.setState({apiVersion: newApiVersion + ".0"});
    }
  }

  onRestoreDefaultApiVersion(){
    localStorage.removeItem("apiVersion");
    this.setState({apiVersion: defaultApiVersion});
  }
  render() {
    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, "API Version",
          h(Tooltip, {tooltip: "Update api version", idKey: "APIVersion"})
        ),
      ),
      h("div", {className: "slds-col slds-size_5-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"}),
      h("div", {className: "slds-col slds-size_3-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        this.state.apiVersion != defaultApiVersion ? h("div", {className: "slds-form-element__control"},
          h("button", {className: "slds-button slds-button_brand", onClick: this.onRestoreDefaultApiVersion, title: "Restore Extension's default version"}, "Restore Default")
        ) : null,
        h("div", {className: "slds-form-element__control slds-col slds-size_2-of-12"},
          h("input", {type: "number", required: true, className: "slds-input", value: nullToEmptyString(this.state.apiVersion.split(".0")[0]), onChange: this.onChangeApiVersion}),
        )
      )
    );
  }
}

class CSVSeparatorOption extends React.Component {

  constructor(props) {
    super(props);
    this.onChangeCSVSeparator = this.onChangeCSVSeparator.bind(this);
    this.state = {csvSeparator: localStorage.getItem("csvSeparator") ? localStorage.getItem("csvSeparator") : ","};
  }

  onChangeCSVSeparator(e) {
    let csvSeparator = e.target.value;
    this.setState({csvSeparator});
    localStorage.setItem("csvSeparator", csvSeparator);
  }

  render() {
    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, "CSV Separator")
      ),
      h("div", {className: "slds-col slds-size_7-of-12 slds-form-element slds-grid slds-grid_align_center slds-gutters_small"}),
      h("div", {className: "slds-col slds-size_1-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align_center slds-gutters_small"},
        h("input", {type: "text", id: "csvSeparatorInput", className: "slds-input slds-text-align_right slds-m-right_small", placeholder: "CSV Separator", value: nullToEmptyString(this.state.csvSeparator), onChange: this.onChangeCSVSeparator})
      )
    );
  }
}

class FaviconOption extends React.Component {

  constructor(props) {
    super(props);
    this.sfHost = props.model.sfHost;
    this.onChangeFavicon = this.onChangeFavicon.bind(this);
    this.populateFaviconColors = this.populateFaviconColors.bind(this);
    this.onToogleSmartMode = this.onToogleSmartMode.bind(this);

    let favicon = localStorage.getItem(this.sfHost + "_customFavicon") ? localStorage.getItem(this.sfHost + "_customFavicon") : "";
    let isInternal = favicon.length > 0 && !favicon.startsWith("http");
    let smartMode = true;
    this.tooltip = props.tooltip;
    this.state = {favicon, isInternal, smartMode};
    this.colorShades = {
      dev: [
        "DeepSkyBlue", "DodgerBlue", "RoyalBlue", "MediumBlue", "CornflowerBlue",
        "#CCCCFF", "SteelBlue", "SkyBlue", "#0F52BA", "Navy",
        "Indigo", "PowderBlue", "LightBlue", "CadetBlue", "Aqua",
        "Turquoise", "DarkTurquoise", "#6082B6", "LightSlateGray", "MidnightBlue"
      ],
      uat: [
        "MediumOrchid", "Orchid", "DarkOrchid", "DarkViolet", "DarkMagenta",
        "Purple", "BlueViolet", "Indigo", "DarkSlateBlue", "RebeccaPurple",
        "MediumPurple", "MediumSlateBlue", "SlateBlue", "Plum", "Violet",
        "Thistle", "Magenta", "DarkOrchid", "Fuchsia", "#301934"
      ],
      int: [
        "LimeGreen", "SeaGreen", "MediumSeaGreen", "ForestGreen", "Green",
        "DarkGreen", "YellowGreen", "OliveDrab", "DarkOliveGreen",
        "SpringGreen", "LawnGreen", "DarkKhaki",
        "GreenYellow", "DarkSeaGreen", "MediumAquamarine", "DarkCyan",
        "Teal", "#00A36C", "#347235", "#355E3B"
      ],
      full: [
        "Orange", "DarkOrange", "Coral", "Tomato", "OrangeRed",
        "Salmon", "IndianRed", "Sienna", "Chocolate", "SaddleBrown",
        "Peru", "DarkSalmon", "RosyBrown", "Brown", "Maroon",
        "#b9770e", "#FFE5B4", "#CC5500", "#FF7518", "#FFBF00"
      ]
    };
  }

  onChangeFavicon(e) {
    let favicon = e.target.value;
    this.setState({favicon});
    localStorage.setItem(this.sfHost + "_customFavicon", favicon);
  }

  onToogleSmartMode(e) {
    let smartMode = e.target.checked;
    this.setState({smartMode});
  }

  populateFaviconColors(){
    let orgs = Object.keys(localStorage).filter((localKey) =>
      localKey.endsWith("_isSandbox")
    );

    orgs.forEach((org) => {
      let sfHost = org.substring(0, org.indexOf("_isSandbox"));
      let existingColor = localStorage.getItem(sfHost + "_customFavicon");

      if (!existingColor) { // Only assign a color if none is set
        const chosenColor = this.getColorForHost(sfHost, this.state.smartMode);
        if (chosenColor) {
          console.info(sfHost + "_customFavicon", chosenColor);
          localStorage.setItem(sfHost + "_customFavicon", chosenColor);
          if (sfHost === this.sfHost) {
            this.setState({favicon: chosenColor});
          }
        }
      } else {
        console.info(sfHost + " already has a customFavicon: " + existingColor);
      }
    });
  }

  getEnvironmentType(sfHost) {
    // Function to get environment type based on sfHost
    if (sfHost.includes("dev")) return "dev";
    if (sfHost.includes("uat")) return "uat";
    if (sfHost.includes("int") || sfHost.includes("sit")) return "int";
    if (sfHost.includes("full")) return "full";
    return null;
  }

  getColorForHost(sfHost, smartMode) {
    // Attempt to get the environment type
    const envType = this.getEnvironmentType(sfHost);

    // Check if smartMode is true and environment type is valid
    if (smartMode && envType && this.colorShades[envType].length > 0) {
      // Select a random color from the corresponding environment shades
      const randomIndex = Math.floor(Math.random() * this.colorShades[envType].length);
      const chosenColor = this.colorShades[envType][randomIndex];
      this.colorShades[envType].splice(randomIndex, 1); // Remove the used color from the list
      return chosenColor;
    } else {
      // If no environment type matches or smartMode is false, use a random color from all available shades
      const allColors = Object.values(this.colorShades).flat();
      if (allColors.length > 0) {
        const randomIndex = Math.floor(Math.random() * allColors.length);
        const chosenColor = allColors[randomIndex];
        allColors.splice(randomIndex, 1); // Remove the used color from the list
        return chosenColor;
      } else {
        console.warn("No more colors available.");
        return null;
      }
    }
  }


  render() {
    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, "Custom favicon (org specific)",
          h(Tooltip, {tooltip: this.tooltip, idKey: this.key})
        )
      ),
      h("div", {className: "slds-col slds-size_2-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control"},
          h("input", {type: "text", className: "slds-input", placeholder: "All HTML Color Names, Hex code or external URL", value: nullToEmptyString(this.state.favicon), onChange: this.onChangeFavicon}),
        ),
        h("div", {className: "slds-form-element__control slds-col"},
          this.state.isInternal ? h("svg", {className: "icon"},
            h("circle", {r: "12", cx: "12", cy: "12", fill: this.state.favicon})
          ) : null
        )
      ),
      h("div", {className: "slds-col slds-size_2-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {dir: "rtl", className: "slds-form-element__control slds-col "},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("input", {type: "checkbox", required: true, className: "slds-input", checked: this.state.smartMode, onChange: this.onToogleSmartMode}),
            h("span", {className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on", title: "Use favicon based on org name (DEV : blue, UAT :green ..)"}, "Smart"),
              h("span", {className: "slds-checkbox_off", title: "Use random favicon"}, "Random"),
            )
          )
        ),
        h("div", {className: "slds-form-element__control"},
          h("button", {className: "slds-button slds-button_brand", onClick: this.populateFaviconColors, title: "Use favicon for all orgs I've visited"}, "Populate All")
        )
      )
    );
  }
}

class MultiCheckboxButtonGroup extends React.Component {

  constructor(props) {
    super(props);
    this.handleCheckboxChange = this.handleCheckboxChange.bind(this);

    this.title = props.title;
    this.key = props.storageKey;
    this.unique = props.unique || false;

    // Load checkboxes from localStorage or default to props.checkboxes
    const storedCheckboxes = localStorage.getItem(this.key) ? JSON.parse(localStorage.getItem(this.key)) : [];

    // Merge checkboxes only if the size is different
    const mergedCheckboxes = storedCheckboxes.length === props.checkboxes.length
      ? storedCheckboxes
      : this.mergeCheckboxes(storedCheckboxes, props.checkboxes);

    this.state = {checkboxes: mergedCheckboxes};
    if (storedCheckboxes.length !== props.checkboxes.length) {
      localStorage.setItem(this.key, JSON.stringify(mergedCheckboxes)); // Save the merged state to localStorage
    }
  }

  mergeCheckboxes = (storedCheckboxes, propCheckboxes) => propCheckboxes.map((checkbox) => {
    const storedCheckbox = storedCheckboxes.find((item) => item.name === checkbox.name);
    return storedCheckbox || checkbox;
  });

  handleCheckboxChange = (event) => {
    const {name, checked} = event.target;
    const updatedCheckboxes = this.state.checkboxes.map((checkbox) => ({
      ...checkbox,
      checked: this.unique && checked ? checkbox.name === name : checkbox.name === name ? checked : checkbox.checked
    }));

    localStorage.setItem(this.key, JSON.stringify(updatedCheckboxes));
    this.setState({checkboxes: updatedCheckboxes});
  };

  render() {
    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, this.title)
      ),
      h("div", {className: "slds-col slds-size_2-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"}),
      h("div", {className: "slds-col slds-size_6-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control"},
          h("div", {className: "slds-checkbox_button-group"},
            this.state.checkboxes.map((checkbox, index) =>
              h("span", {className: "slds-button slds-checkbox_button", key: this.key + index},
                h("input", {type: "checkbox", id: `${this.key}-${checkbox.value}-${index}`, name: checkbox.name, checked: checkbox.checked, onChange: this.handleCheckboxChange, title: checkbox.title}),
                h("label", {className: "slds-checkbox_button__label", htmlFor: `${this.key}-${checkbox.value}-${index}`},
                  h("span", {className: "slds-checkbox_faux"}, checkbox.label)
                )
              )
            )
          )
        )
      )
    );
  }
}

class enableLogsOption extends React.Component {

  constructor(props) {
    super(props);
    this.sfHost = props.model.sfHost;
    this.onChangeDebugLogTime = this.onChangeDebugLogTime.bind(this);
    this.onChangeDebugLevel = this.onChangeDebugLevel.bind(this);
    this.state = {
      debugLogDebugLevel: localStorage.getItem(this.sfHost + "_debugLogDebugLevel") ? localStorage.getItem(this.sfHost + "_debugLogDebugLevel") : "SFDC_DevConsole",
      debugLogTimeMinutes: localStorage.getItem("debugLogTimeMinutes") ? localStorage.getItem("debugLogTimeMinutes") : "15",
    };
  }

  onChangeDebugLevel(e) {
    let debugLogDebugLevel = e.target.value;
    this.setState({debugLogDebugLevel});
    localStorage.setItem(this.sfHost + "_debugLogDebugLevel", debugLogDebugLevel);
  }

  onChangeDebugLogTime(e) {
    let debugLogTimeMinutes = e.target.value;
    this.setState({debugLogTimeMinutes});
    localStorage.setItem("debugLogTimeMinutes", debugLogTimeMinutes);
  }

  render() {
    return h("div", {className: "slds-grid slds-grid_vertical"},
      h("div", {className: "slds-col slds-grid slds-wrap slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
        h("div", {className: "slds-col slds-size_3-of-12 text-align-middle"},
          h("span", {}, "Debug Level (DeveloperName)")
        ),
        h("div", {className: "slds-col slds-size_6-of-12 slds-form-element"}),
        h("div", {className: "slds-col slds-size_3-of-12 slds-form-element"},
          h("input", {type: "text", id: "debugLogDebugLevel", className: "slds-input slds-text-align_right slds-m-right_small", placeholder: "SFDC_DevConsole", value: nullToEmptyString(this.state.debugLogDebugLevel), onChange: this.onChangeDebugLevel})
        ),
      ),
      h("div", {className: "slds-col slds-grid slds-wrap slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
        h("div", {className: "slds-col slds-size_3-of-12 text-align-middle"},
          h("span", {}, "Debug Log Time (Minutes)")
        ),
        h("div", {className: "slds-col slds-size_6-of-12 slds-form-element"}),
        h("div", {className: "slds-col slds-size_3-of-12 slds-form-element"},
          h("input", {type: "number", id: "debugLogTimeMinutes", className: "slds-input slds-text-align_right slds-m-right_small", value: nullToEmptyString(this.state.debugLogTimeMinutes), onChange: this.onChangeDebugLogTime})
        ),
      )
    );
  }
}

class CustomShortcuts extends React.Component {

  constructor(props) {
    super(props);
    this.sfHost = props.model.sfHost;
    this.onAddShortcut = this.onAddShortcut.bind(this);
    this.onEditShortcut = this.onEditShortcut.bind(this);
    this.onDeleteShortcut = this.onDeleteShortcut.bind(this);
    this.onSaveShortcut = this.onSaveShortcut.bind(this);
    this.onCancelEdit = this.onCancelEdit.bind(this);
    this.onSort = this.onSort.bind(this);
    this.onSearch = this.onSearch.bind(this);
    this.state = {
      shortcuts: JSON.parse(localStorage.getItem(this.sfHost + "_orgLinks") || "[]"),
      editingIndex: -1,
      newShortcut: {label: "", link: "", section: "", isExternal: false},
      sortConfig: {
        key: null,
        direction: "asc"
      },
      searchTerm: ""
    };
  }

  onSearch(e) {
    this.setState({searchTerm: e.target.value.toLowerCase()});
  }

  getFilteredShortcuts() {
    const {shortcuts, searchTerm} = this.state;
    if (!searchTerm) return shortcuts;

    return shortcuts.filter(shortcut =>
      shortcut.label.toLowerCase().includes(searchTerm)
      || shortcut.link.toLowerCase().includes(searchTerm)
      || shortcut.section.toLowerCase().includes(searchTerm)
    );
  }

  onSort(key) {
    let direction = "asc";
    if (this.state.sortConfig.key === key && this.state.sortConfig.direction === "asc") {
      direction = "desc";
    }

    const sortedShortcuts = [...this.state.shortcuts].sort((a, b) => {
      if (a[key] === null) return 1;
      if (b[key] === null) return -1;
      if (a[key] === undefined) return 1;
      if (b[key] === undefined) return -1;

      const aValue = a[key].toString().toLowerCase();
      const bValue = b[key].toString().toLowerCase();

      if (aValue < bValue) {
        return direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === "asc" ? 1 : -1;
      }
      return 0;
    });

    this.setState({
      shortcuts: sortedShortcuts,
      sortConfig: {key, direction}
    });
  }

  getSortIcon(key) {
    if (this.state.sortConfig.key !== key) {
      return null;
    }
    return this.state.sortConfig.direction === "asc" ? "up" : "down";
  }

  handleInputChange(field, value) {
    if (field === "link") {
      // Get the base domain without protocol
      const baseDomain = this.sfHost.split(".")[0];

      // Check if the link contains the base domain
      if (value.includes(baseDomain)) {
        // Extract the path part after the domain
        const urlParts = value.split(".com");
        if (urlParts.length > 1) {
          // Keep everything after the domain
          value = urlParts[1];
        }
      }
    }

    this.setState({
      newShortcut: {
        ...this.state.newShortcut,
        [field]: value,
        isExternal: field === "link" ? (value.startsWith("http") || value.startsWith("www")) : this.state.newShortcut.isExternal
      }
    });
  }

  onAddShortcut() {
    this.setState({
      editingIndex: this.state.shortcuts.length,
      newShortcut: {label: "", link: "", section: "", isExternal: false}
    });
  }

  onEditShortcut(index) {
    this.setState({
      editingIndex: index,
      newShortcut: {...this.state.shortcuts[index]}
    });
  }

  onDeleteShortcut(index) {
    const newShortcuts = [...this.state.shortcuts];
    newShortcuts.splice(index, 1);
    this.setState({shortcuts: newShortcuts});
    localStorage.setItem(this.sfHost + "_orgLinks", JSON.stringify(newShortcuts));
  }

  onSaveShortcut() {
    const {shortcuts, editingIndex, newShortcut} = this.state;
    const newShortcuts = [...shortcuts];

    // Ensure isExternal is set correctly before saving
    newShortcut.isExternal = newShortcut.link.startsWith("http") || newShortcut.link.startsWith("www");

    if (editingIndex === shortcuts.length) {
      newShortcuts.push(newShortcut);
    } else {
      newShortcuts[editingIndex] = newShortcut;
    }

    this.setState({
      shortcuts: newShortcuts,
      editingIndex: -1,
      newShortcut: {label: "", link: "", section: "", isExternal: false}
    });

    localStorage.setItem(this.sfHost + "_orgLinks", JSON.stringify(newShortcuts));
  }

  onCancelEdit() {
    this.setState({
      editingIndex: -1,
      newShortcut: {label: "", link: "", section: ""}
    });
  }

  render() {
    const {editingIndex, newShortcut} = this.state;
    const filteredShortcuts = this.getFilteredShortcuts();

    return h("div", {className: "slds-grid slds-grid_vertical"},
      h("div", {className: "slds-grid slds-p-horizontal_small slds-p-vertical_xx-small"},
        h("div", {className: "slds-col slds-size_12-of-12"},
          h("div", {className: "slds-form-element"},
            h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left"},
              h("svg", {className: "slds-input__icon slds-input__icon_left slds-icon-text-default", "aria-hidden": true},
                h("use", {xlinkHref: "symbols.svg#search"})
              ),
              h("input", {
                type: "search",
                placeholder: "Search shortcuts...",
                className: "slds-input",
                value: this.state.searchTerm,
                onChange: this.onSearch
              })
            )
          )
        )
      ),
      h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered"},
        h("thead", {},
          h("tr", {className: "slds-line-height_reset"},
            h("th", {
              scope: "col",
              className: "slds-is-sortable",
              onClick: () => this.onSort("label")
            },
            h("div", {className: "slds-grid slds-grid_align-spread slds-truncate", title: "Label"},
              h("span", {}, "Label"),
              this.getSortIcon("label") && h("span", {className: "slds-icon_container slds-icon-utility-" + this.getSortIcon("label")},
                h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": true},
                  h("use", {xlinkHref: "symbols.svg#" + this.getSortIcon("label")})
                )
              )
            )
            ),
            h("th", {
              scope: "col",
              className: "slds-is-sortable",
              onClick: () => this.onSort("link")
            },
            h("div", {className: "slds-grid slds-grid_align-spread slds-truncate", title: "Link"},
              h("span", {}, "Link"),
              this.getSortIcon("link") && h("span", {className: "slds-icon_container slds-icon-utility-" + this.getSortIcon("link")},
                h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": true},
                  h("use", {xlinkHref: "symbols.svg#" + this.getSortIcon("link")})
                )
              )
            )
            ),
            h("th", {
              scope: "col",
              className: "slds-is-sortable",
              onClick: () => this.onSort("section")
            },
            h("div", {className: "slds-grid slds-grid_align-spread slds-truncate", title: "Section"},
              h("span", {}, "Section"),
              this.getSortIcon("section") && h("span", {className: "slds-icon_container slds-icon-utility-" + this.getSortIcon("section")},
                h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": true},
                  h("use", {xlinkHref: "symbols.svg#" + this.getSortIcon("section")})
                )
              )
            )
            ),
            h("th", {scope: "col"},
              h("div", {className: "slds-truncate", title: "External"}, "External")
            ),
            h("th", {scope: "col"},
              h("div", {className: "slds-truncate", title: "Actions"}, "Actions")
            )
          )
        ),
        h("tbody", {},
          [...filteredShortcuts, editingIndex === filteredShortcuts.length ? newShortcut : null].map((shortcut, index) =>
            shortcut && h("tr", {
              key: editingIndex === index ? `new-${index}` : `${shortcut.label}-${shortcut.link}-${index}`,
              className: "slds-hint-parent"
            },
            editingIndex === index ? [
              h("td", {key: "label", "data-label": "Label"},
                h("div", {className: "slds-truncate"},
                  h("input", {
                    type: "text",
                    className: "slds-input slds-m-right_small",
                    value: newShortcut.label,
                    onChange: (e) => this.handleInputChange("label", e.target.value)
                  })
                )
              ),
              h("td", {key: "link", "data-label": "Link"},
                h("div", {className: "slds-truncate"},
                  h("input", {
                    type: "text",
                    className: "slds-input slds-m-right_small",
                    value: newShortcut.link,
                    onChange: (e) => this.handleInputChange("link", e.target.value)
                  })
                )
              ),
              h("td", {key: "section", "data-label": "Section"},
                h("div", {className: "slds-truncate"},
                  h("input", {
                    type: "text",
                    className: "slds-input slds-m-right_small",
                    value: newShortcut.section,
                    onChange: (e) => this.handleInputChange("section", e.target.value)
                  })
                )
              ),
              h("td", {key: "external", "data-label": "External"},
                h("div", {className: "slds-truncate"},
                  newShortcut.isExternal && h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#check"})
                  )
                )
              ),
              h("td", {key: "actions", "data-label": "Actions"},
                h("div", {className: "slds-truncate"},
                  h("button", {
                    className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-right_x-small",
                    onClick: this.onSaveShortcut,
                    title: "Save"
                  }, h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#check"})
                  )),
                  h("button", {
                    className: "slds-button slds-button_icon slds-button_icon-border-filled",
                    onClick: this.onCancelEdit,
                    title: "Cancel"
                  }, h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#close"})
                  ))
                )
              )
            ] : [
              h("td", {key: "label", "data-label": "Label"},
                h("div", {className: "slds-truncate", title: shortcut.label}, shortcut.label)
              ),
              h("td", {key: "link", "data-label": "Link"},
                h("div", {className: "slds-truncate", title: shortcut.link}, shortcut.link)
              ),
              h("td", {key: "section", "data-label": "Section"},
                h("div", {className: "slds-truncate", title: shortcut.section}, shortcut.section)
              ),
              h("td", {key: "external", "data-label": "External"},
                h("div", {className: "slds-truncate"},
                  shortcut.isExternal && h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#check"})
                  )
                )
              ),
              h("td", {key: "actions", "data-label": "Actions"},
                h("div", {className: "slds-truncate"},
                  h("button", {
                    className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-right_x-small",
                    onClick: () => this.onEditShortcut(index),
                    title: "Edit"
                  }, h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#edit"})
                  )),
                  h("button", {
                    className: "slds-button slds-button_icon slds-button_icon-border-filled",
                    onClick: () => this.onDeleteShortcut(index),
                    title: "Delete"
                  }, h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#delete"})
                  ))
                )
              )
            ]
            )
          )
        )
      ),
      h("div", {className: "slds-grid slds-p-horizontal_small slds-p-vertical_xx-small"},
        h("div", {className: "slds-col slds-size_12-of-12"},
          h("button", {
            className: "slds-button slds-button_icon slds-button_icon-border-filled",
            onClick: this.onAddShortcut,
            title: "Add Shortcut"
          }, h("svg", {className: "slds-button__icon"},
            h("use", {xlinkHref: "symbols.svg#add"})
          ))
        )
      )
    );
  }
}

class FlowScannerRulesOption extends React.Component {

  constructor(props) {
    super(props);
    this.handleRuleToggle = this.handleRuleToggle.bind(this);
    this.handleConfigChange = this.handleConfigChange.bind(this);
    this.handleCheckAll = this.handleCheckAll.bind(this);
    this.handleUncheckAll = this.handleUncheckAll.bind(this);
    this.handleResetToDefaults = this.handleResetToDefaults.bind(this);
    this.handleSeverityChange = this.handleSeverityChange.bind(this);
    this.handleDeleteRule = this.handleDeleteRule.bind(this);
    this.loadAndMergeRules = this.loadAndMergeRules.bind(this);
    this.saveRules = this.saveRules.bind(this);

    this.title = props.title;
    this.key = props.key || "flowScannerRules";
    this.customKey = "flowScannerCustomRules";

    this.state = {
      rules: [],
    };
  }

  componentDidMount() {
    this.migrateConfiguration();
    this.loadAndMergeRules();
  }

  loadAndMergeRules() {
    const stored = JSON.parse(localStorage.getItem(this.key) || "[]");
    const customStored = JSON.parse(localStorage.getItem(this.customKey) || "[]");
    const mergedRules = this.mergeRules(stored, this.props.checkboxes, customStored);
    this.setState({rules: mergedRules});
  }

  saveRules(rules) {
    const defaultRules = rules.filter(r => !r.isCustom);
    const customRules = rules.filter(r => r.isCustom);
    localStorage.setItem(this.key, JSON.stringify(defaultRules));
    localStorage.setItem(this.customKey, JSON.stringify(customRules));
  }

  migrateConfiguration() {
    const storedRaw = localStorage.getItem(this.key);
    if (!storedRaw) return;
    try {
      const stored = JSON.parse(storedRaw);
      if (!Array.isArray(stored)) return;
      let needsUpdate = false;
      const migrated = stored.map(rule => {
        if (rule.name === "APIVersion" && rule.configType === "expression" && rule.config && rule.config.expression) {
          const expressionValue = rule.config.expression;
          let thresholdValue = 50;
          if (typeof expressionValue === "string") {
            if (expressionValue.includes("<")) {
              thresholdValue = parseInt(expressionValue.replace(/[<>]/g, "")) || 50;
            } else {
              thresholdValue = parseInt(expressionValue) || 50;
            }
          }
          needsUpdate = true;
          return {...rule, configType: "threshold", config: {threshold: thresholdValue}};
        }
        return rule;
      });
      if (needsUpdate) {
        localStorage.setItem(this.key, JSON.stringify(migrated));
      }
    } catch (e) {
      console.warn("Failed to migrate configuration:", e);
    }
  }

  mergeRules(storedRules, defaultRules, customRules = []) {
    const knownConfigurableRules = {
      "APIVersion": {configType: "threshold", defaultValue: 50},
      "FlowName": {configType: "expression", defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+"},
      "CyclomaticComplexity": {configType: "threshold", defaultValue: 25},
      "AutoLayout": {configType: "enabled", defaultValue: true},
      "ProcessBuilder": {configType: "enabled", defaultValue: true}
    };
    const merged = [];
    const defaultRuleNames = new Set(defaultRules.map(r => r.name));
    for (const defaultRule of defaultRules) {
      const storedRule = storedRules.find(r => r.name === defaultRule.name);
      const knownConfig = knownConfigurableRules[defaultRule.name];
      let config = {};
      let configType = defaultRule.configType;
      let configurable = defaultRule.configurable;
      if (storedRule && storedRule.config) {
        config = storedRule.config;
      } else if (knownConfig) {
        config = {[knownConfig.configType]: knownConfig.defaultValue};
        configType = knownConfig.configType;
        configurable = true;
      } else if (defaultRule.defaultValue) {
        config = {[defaultRule.configType]: defaultRule.defaultValue};
      }
      if (knownConfig) {
        configurable = true;
        configType = configType || knownConfig.configType;
      }
      merged.push({
        ...defaultRule,
        checked: storedRule ? storedRule.checked : defaultRule.checked,
        config,
        configType,
        configurable,
        severity: storedRule ? storedRule.severity || defaultRule.severity : defaultRule.severity,
        isBeta: defaultRule.isBeta || false
      });
    }
    for (const customRule of customRules) {
      if (!defaultRuleNames.has(customRule.name)) {
        merged.push({...customRule, isCustom: true});
      }
    }
    return merged;
  }

  getRuleDescription(ruleName) {
    const descriptions = {
      "APIVersion": "Checks if the flow uses an outdated API version.",
      "AutoLayout": "Recommends using Auto-Layout mode.",
      "CopyAPIName": "Detects copied elements with default API names.",
      "CyclomaticComplexity": "Warns when flow complexity is too high.",
      "DMLStatementInLoop": "Identifies DML operations inside loops.",
      "DuplicateDMLOperation": "Detects potential duplicate DML operations.",
      "FlowDescription": "Ensures flows have descriptions.",
      "FlowName": "Validates flow naming conventions.",
      "GetRecordAllFields": "Warns against using 'Get All Fields'.",
      "HardcodedId": "Detects hardcoded Salesforce IDs.",
      "HardcodedUrl": "Finds hardcoded URLs.",
      "InactiveFlow": "Identifies inactive flows.",
      "MissingFaultPath": "Checks for missing error handling paths.",
      "MissingNullHandler": "Ensures Get Records have null handling.",
      "ProcessBuilder": "Recommends migrating from Process Builder.",
      "RecursiveAfterUpdate": "Warns about potential recursion.",
      "SameRecordFieldUpdates": "Suggests before-save flows for updates.",
      "SOQLQueryInLoop": "Identifies SOQL queries inside loops.",
      "TriggerOrder": "Recommends setting trigger order.",
      "UnconnectedElement": "Finds unused flow elements.",
      "UnsafeRunningContext": "Warns about system mode flows.",
      "UnusedVariable": "Identifies unused variables.",
      "ActionCallsInLoop": "Identifies action calls inside loops (Beta)."
    };
    return descriptions[ruleName] || "Checks for potential issues and best practices.";
  }

  handleRuleToggle(ruleName) {
    const updatedRules = this.state.rules.map(rule => (rule.name === ruleName) ? {...rule, checked: !rule.checked} : rule);
    this.setState({rules: updatedRules});
    this.saveRules(updatedRules);
  }

  handleConfigChange(ruleName, configKey, value) {
    const updatedRules = this.state.rules.map(rule => {
      if (rule.name === ruleName) {
        return {...rule, config: {...rule.config, [configKey]: value}};
      }
      return rule;
    });
    this.setState({rules: updatedRules});
    this.saveRules(updatedRules);
  }

  handleCheckAll() {
    const updatedRules = this.state.rules.map(rule => ({...rule, checked: true}));
    this.setState({rules: updatedRules});
    this.saveRules(updatedRules);
  }

  handleUncheckAll() {
    const updatedRules = this.state.rules.map(rule => ({...rule, checked: false}));
    this.setState({rules: updatedRules});
    this.saveRules(updatedRules);
  }

  handleResetToDefaults() {
    if (window.confirm("This will reset all default rules to their original settings and remove all custom rules. Are you sure?")) {
      localStorage.removeItem(this.key);
      localStorage.removeItem(this.customKey);
      this.loadAndMergeRules();
    }
  }

  handleSeverityChange(ruleName, value) {
    const updatedRules = this.state.rules.map(rule => (rule.name === ruleName) ? {...rule, severity: value} : rule);
    this.setState({rules: updatedRules});
    this.saveRules(updatedRules);
  }

  handleDeleteRule(ruleName) {
    if (window.confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
      const customRules = JSON.parse(localStorage.getItem(this.customKey) || "[]");
      const updatedCustomRules = customRules.filter(rule => rule.name !== ruleName);
      localStorage.setItem(this.customKey, JSON.stringify(updatedCustomRules));
      this.loadAndMergeRules();
    }
  }

  renderConfigInput(rule) {
    if (!rule.configurable) return null;
    const configValue = rule.config && rule.config[rule.configType] ? rule.config[rule.configType] : rule.defaultValue;
    if (rule.configType === "expression") {
      return h("div", {className: "rule-config-right"},
        h("input", {
          type: "text", className: "slds-input slds-input_small", value: configValue,
          onChange: e => this.handleConfigChange(rule.name, rule.configType, e.target.value),
          placeholder: rule.defaultValue || "", title: `Configuration for ${rule.label}`, "aria-label": `${rule.label} configuration`
        }),
        h(InfoIcon, {
          tooltipId: `config-help-${rule.name}`,
          tooltip: h("span", {}, `Configuration for ${rule.label}. `, rule.configType === "expression" ? h("a", {href: "https://regex101.com/", target: "_blank", rel: "noopener noreferrer"}, "Regex help") : ""),
          className: "config-help slds-m-left_xx-small", placement: "right"
        })
      );
    }
    if (rule.configType === "threshold") {
      return h("div", {className: "rule-config-right"},
        h("input", {
          type: "number", className: "slds-input slds-input_small", value: configValue,
          onChange: e => this.handleConfigChange(rule.name, rule.configType, parseInt(e.target.value) || rule.defaultValue),
          min: "1", max: "100", title: `Threshold for ${rule.label}`, "aria-label": `${rule.label} threshold`
        }),
        h(InfoIcon, {
          tooltipId: `config-help-${rule.name}`,
          tooltip: rule.name === "APIVersion" ? "Minimum API version required for flows. Flows with lower API versions will trigger this rule." : `Threshold value for ${rule.label}. Higher values are more permissive.`,
          className: "config-help slds-m-left_xx-small", placement: "right"
        })
      );
    }
    return null;
  }

  render() {
    const {title, error, scannerVersion} = this.props;
    const {rules} = this.state;
    if (error) {
      return h("div", {className: "option-group flow-scanner-section"},
        h("h3", {}, title),
        h("div", {className: "slds-box slds-box_small slds-theme_error slds-m-around_medium"}, h("p", {}, error))
      );
    }
    const versionDisplay = scannerVersion ? ` (v${scannerVersion})` : "";
    return h("div", {className: "option-group flow-scanner-section"},
      h("h3", {}, `${title}${versionDisplay}`),
      h("div", {className: "flow-scanner-desc slds-grid slds-align_absolute-center"},
        "Configure which Flow Scanner rules are enabled and their settings. Only enabled rules will be used when scanning flows. ",
        h(InfoIcon, {tooltipId: "section-help-tip", tooltip: "Flow Scanner analyzes Salesforce Flows for best practices, anti-patterns, and common mistakes. Toggle rules on or off and configure their settings as needed. For more information, see the documentation.", className: "section-help-icon slds-m-left_x-small", placement: "below"})
      ),
      h("div", {className: "rules-actions-toolbar", role: "toolbar", "aria-label": "Bulk actions"},
        h("button", {className: "slds-button slds-button_brand slds-button_small", onClick: this.handleCheckAll, tabIndex: 0, "aria-label": "Enable all rules"}, "Check All"),
        h("button", {className: "slds-button slds-button_neutral slds-button_small", onClick: this.handleUncheckAll, tabIndex: 0, "aria-label": "Disable all rules"}, "Uncheck All"),
        h("button", {className: "slds-button slds-button_neutral slds-button_small", onClick: this.handleResetToDefaults, tabIndex: 0, "aria-label": "Reset rules to defaults"}, "Reset to Defaults"),
        h("button", {className: "slds-button slds-button_success slds-button_small", onClick: this.props.onShowAddRuleModal, tabIndex: 0, "aria-label": "Add custom rule"}, "Add Custom Rule")
      ),
      h("div", {className: "rules-container"},
        rules.map((rule) =>
          h("div", {key: rule.name, className: `rule-row-horizontal${rule.configurable ? " rule-row-highlight" : ""}${rule.isCustom ? " custom-rule" : ""}`, tabIndex: 0, "aria-label": `${rule.label}: ${rule.description}`},
            h("div", {className: "rule-toggle-container"},
              h("label", {className: "slds-checkbox_toggle slds-grid"},
                h("input", {type: "checkbox", "aria-describedby": `desc-${rule.name}`, checked: rule.checked, onChange: () => this.handleRuleToggle(rule.name), tabIndex: 0}),
                h("span", {className: "slds-checkbox_faux_container", "aria-live": "assertive"},
                  h("span", {className: "slds-checkbox_faux"}),
                  h("span", {className: "slds-checkbox_on"}, "Enabled"),
                  h("span", {className: "slds-checkbox_off"}, "Disabled")
                )
              )
            ),
            h("div", {className: "rule-main-info"},
              h("div", {className: "rule-name-horizontal"},
                rule.label,
                rule.isBeta && h("span", {className: "beta-badge"}, "BETA"),
                rule.isCustom && h("span", {className: "custom-badge"}, "CUSTOM")
              ),
              h("div", {className: "rule-description-horizontal", id: `desc-${rule.name}`, title: rule.description}, rule.description)
            ),
            h("div", {className: "rule-config-group"},
              this.renderConfigInput(rule),
              h("label", {htmlFor: `severity-${rule.name}`, className: "slds-form-element__label", style: {marginRight: 4}}, "Severity:"),
              h("select", {id: `severity-${rule.name}`, value: normalizeSeverity(rule.severity || "error", "ui"), onChange: e => this.handleSeverityChange(rule.name, normalizeSeverity(e.target.value, "storage")), className: `severity-select severity-${normalizeSeverity(rule.severity || "error", "ui")}`, style: {marginLeft: 2, minWidth: 80}},
                h("option", {value: "error"}, "Error"),
                h("option", {value: "warning"}, "Warning"),
                h("option", {value: "info"}, "Info")
              ),
              rule.isCustom && h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.handleDeleteRule(rule.name), title: "Delete Rule"},
                h("svg", {className: "slds-button__icon", viewBox: "0 0 52 52"}, h("use", {xlinkHref: "symbols.svg#delete"}))
              )
            )
          )
        )
      )
    );
  }
}

// --- Tab Container and Selector ---

class OptionsTab extends React.Component {

  getClass() {
    return "options-tab slds-text-align_center slds-tabs_default__item" + (this.props.selectedTabId === this.props.id ? " slds-is-active" : "");
  }

  render() {
    return h("li", {key: this.props.id, className: this.getClass(), title: this.props.title, tabIndex: this.props.id, role: "presentation", onClick: this.props.onTabSelect},
      h("a", {className: "slds-tabs_default__link", href: "#", role: "tab", tabIndex: this.props.id, id: "tab-default-" + this.props.id + "__item"},
        this.props.title)
    );
  }
}

class OptionsContainer extends React.Component {

  constructor(props) {
    super(props);
    this.model = props.model;
  }

  getClass() {
    return (this.props.selectedTabId === this.props.id ? "slds-show" : " slds-hide");
  }

  render() {
    return h("div", {id: this.props.id, key: this.props.id, className: this.getClass(), role: "tabpanel"},
      this.props.content.map((c, index) =>
        h(c.option, {
          key: c.props?.key || `option-${index}`,
          storageKey: c.props?.key,
          ...c.props,
          model: this.model
        })
      )
    );
  }

}

class OptionsTabSelector extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.sfHost = this.model.sfHost;

    // Bind methods first
    this.onTabSelect = this.onTabSelect.bind(this);

    // Get the tab from the URL or default to 1
    const urlParams = new URLSearchParams(window.location.search);
    const initialTabId = parseInt(urlParams.get("selectedTab")) || 1;

    this.state = {
      selectedTabId: initialTabId,
      flowScannerError: null,
    };

    // Initialize rule checkboxes
    let ruleCheckboxes = [];
    let scannerVersion = null;
    if (window.lightningflowscanner) {
      if (window.lightningflowscanner.version) {
        scannerVersion = window.lightningflowscanner.version;
      }
      if (typeof window.lightningflowscanner.getRules === "function") {
        try {
          const rules = window.lightningflowscanner.getRules();
          const betaRules = (typeof window.lightningflowscanner.getBetaRules === "function")
            ? window.lightningflowscanner.getBetaRules().map(r => ({...r, isBeta: true}))
            : [];

          const allRules = [...rules, ...betaRules];

          ruleCheckboxes = allRules.map(rule => ({
            label: rule.label || rule.name,
            name: rule.name,
            checked: true,
            configurable: rule.isConfigurable || false,
            configType: rule.configType || null,
            defaultValue: rule.defaultValue || null,
            severity: rule.defaultSeverity || rule.severity || "error",
            description: rule.description || "",
            isBeta: rule.isBeta || false,
            config: rule.defaultValue ? {[rule.configType]: rule.defaultValue} : {}
          }));
        } catch (error) {
          console.error("Error getting rules from lightningflowscanner:", error);
          this.state.flowScannerError = "Failed to load Flow Scanner rules from the core library. Please check the console for details.";
        }
      } else {
        console.error("lightningflowscanner.getRules is not a function.");
        this.state.flowScannerError = "Flow Scanner core library is not available or outdated. The scanner functionality will be disabled.";
      }
    } else {
      console.error("lightningflowscanner core library not available.");
      this.state.flowScannerError = "Flow Scanner core library is not available. The scanner functionality will be disabled.";
    }
    console.log("Flow Scanner ruleCheckboxes:", ruleCheckboxes);

    this.tabs = [
      {
        id: 1,
        tabTitle: "Tab1",
        title: "User Experience",
        content: [
          {option: ArrowButtonOption, props: {key: 1}},
          {option: Option, props: {type: "toggle", title: "Flow Scrollability", key: "scrollOnFlowBuilder"}},
          {option: Option, props: {type: "toggle", title: "Inspect page - Show table borders", key: "displayInspectTableBorders"}},
          {option: Option, props: {type: "toggle", title: "Always open links in a new tab", key: "openLinksInNewTab", tooltip: "Enabling this option will prevent Lightning Navigation (faster loading) to be used"}},
          {option: Option, props: {type: "toggle", title: "Open Permission Set / Permission Set Group summary from shortcuts", key: "enablePermSetSummary"}},
          {option: MultiCheckboxButtonGroup,
            props: {title: "Searchable metadata from Shortcut tab",
              key: "metadataShortcutSearchOptions",
              checkboxes: [
                {label: "Flows", name: "flows", checked: true},
                {label: "Profiles", name: "profiles", checked: true},
                {label: "PermissionSets", name: "permissionSets", checked: true},
                {label: "Communities", name: "networks", checked: true},
                {label: "Apex Classes", name: "classes", checked: false}
              ]}
          },
          {option: Option, props: {type: "toggle", title: "Popup Dark theme", key: "popupDarkTheme"}},
          {option: MultiCheckboxButtonGroup,
            props: {title: "Show buttons",
              key: "hideButtonsOption",
              checkboxes: [
                {label: "New", name: "new", checked: true},
                {label: "Explore API", name: "explore-api", checked: true},
                {label: "Org Limits", name: "org-limits", checked: true},
                {label: "Options", name: "options", checked: true},
                {label: "Generate Access Token", name: "generate-token", checked: true}
              ]}
          },
          {option: FaviconOption, props: {key: this.sfHost + "_customFavicon", tooltip: "You may need to add this domain to CSP trusted domains to see the favicon in Salesforce."}},
          {option: Option, props: {type: "toggle", title: "Use favicon color on sandbox banner", key: "colorizeSandboxBanner"}},
          {option: Option, props: {type: "toggle", title: "Highlight PROD (color from favicon)", key: "colorizeProdBanner", tooltip: "Top border in extension pages and banner on Salesforce"}},
          {option: Option, props: {type: "text", title: "PROD Banner text", key: this.sfHost + "_prodBannerText", tooltip: "Text that will be displayed in the PROD banner (if enabled)", placeholder: "WARNING: THIS IS PRODUCTION"}},
          {option: Option, props: {type: "toggle", title: "Enable Lightning Navigation", key: "lightningNavigation", default: true, tooltip: "Enable faster navigation by using standard e.force:navigateToURL method"}},
          {option: MultiCheckboxButtonGroup,
            props: {title: "Default Popup Tab",
              key: "defaultPopupTab",
              unique: true,
              checkboxes: [
                {label: "Object", name: "sobject", checked: true},
                {label: "Users", name: "users"},
                {label: "Shortcuts", name: "shortcuts"},
                {label: "Org", name: "org"}
              ]}
          },
        ]
      },
      {
        id: 2,
        tabTitle: "Tab2",
        title: "API",
        content: [
          {option: APIVersionOption, props: {key: 1}},
          {option: Option,
            props: {type: "text",
              title: "API Consumer Key",
              placeholder: "Consumer Key",
              key: this.sfHost + "_clientId",
              inputSize: "5",
              actionButton: {
                label: "Delete Token",
                title: "Delete the connected app generated token",
                onClick: (e, model) => {
                  localStorage.removeItem(model.sfHost + "_clientId");
                  e.target.disabled = true;
                }
              }}},
          {option: Option, props: {type: "text", title: "Rest Header", placeholder: "Rest Header", key: "createUpdateRestCalloutHeaders"}}
        ]
      },
      {
        id: 3,
        tabTitle: "Tab3",
        title: "Data Export",
        content: [
          {option: CSVSeparatorOption, props: {key: 1}},
          {option: Option, props: {type: "toggle", title: "Display Query Execution Time", key: "displayQueryPerformance", default: true}},
          {option: Option, props: {type: "toggle", title: "Show Local Time", key: "showLocalTime", default: false}},
          {option: Option, props: {type: "toggle", title: "Use SObject context on Data Export ", key: "useSObjectContextOnDataImportLink", default: true}},
          {option: MultiCheckboxButtonGroup,
            props: {title: "Show buttons",
              key: "hideExportButtonsOption",
              checkboxes: [
                {label: "Delete Records", name: "delete", checked: true},
                {label: "Export Query", name: "export-query", checked: false},
                {label: "Agentforce", name: "export-agentforce", checked: false}
              ]}
          },
          {option: Option, props: {type: "toggle", title: "Hide additional Object columns by default on Data Export", key: "hideObjectNameColumnsDataExport", default: false}},
          {option: Option, props: {type: "toggle", title: "Include formula fields from suggestion", key: "includeFormulaFieldsFromExportAutocomplete", default: true}},
          {option: Option, props: {type: "toggle", title: "Disable query input autofocus", key: "disableQueryInputAutoFocus"}},
          {option: Option, props: {type: "number", title: "Number of queries stored in the history", key: "numberOfQueriesInHistory", default: 100}},
          {option: Option, props: {type: "number", title: "Number of saved queries", key: "numberOfQueriesSaved", default: 50}},
          {option: Option, props: {type: "textarea", title: "Query Templates", key: "queryTemplates", placeholder: "SELECT Id FROM// SELECT Id FROM WHERE//SELECT Id FROM WHERE IN//SELECT Id FROM WHERE LIKE//SELECT Id FROM ORDER BY//SELECT ID FROM MYTEST__c//SELECT ID WHERE"}},
          {option: Option, props: {type: "toggle", title: "Enable Query Typo Fix", key: "enableQueryTypoFix", default: false, tooltip: "Enable automation that removes typos from query input"}},
          {option: Option, props: {type: "text", title: "Prompt Template Name", key: this.sfHost + "_exportAgentForcePrompt", default: Constants.PromptTemplateSOQL, tooltip: "Developer name of the prompt template to use for SOQL query builder"}}
        ]
      },
      {
        id: 4,
        tabTitle: "Tab4",
        title: "Data Import",
        content: [
          {option: Option, props: {type: "text", title: "Default batch size", key: "defaultBatchSize", placeholder: "200"}},
          {option: Option, props: {type: "text", title: "Default thread size", key: "defaultThreadSize", placeholder: "6"}},
          {option: Option, props: {type: "toggle", title: "Grey Out Skipped Columns in Data Import", key: "greyOutSkippedColumns", tooltip: "Control if skipped columns are greyed out or not in data import"}}
        ]
      },
      {
        id: 5,
        tabTitle: "Tab5",
        title: "Field Creator",
        content: [
          {option: Option,
            props: {
              type: "select",
              title: "Field Naming Convention",
              key: "fieldNamingConvention",
              default: "pascal",
              tooltip: "Controls how API names are auto-generated from field labels. PascalCase: 'My Field' -> 'MyField'. Underscores: 'My Field' -> 'My_Field'",
              options: [
                {label: "PascalCase", value: "pascal"},
                {label: "Underscores", value: "underscore"}
              ]
            }}
        ]
      },
      {
        id: 6,
        tabTitle: "Tab6",
        title: "Enable Logs",
        content: [
          {option: enableLogsOption, props: {key: 1}}
        ]
      },
      {
        id: 7,
        tabTitle: "Tab7",
        title: "Metadata",
        content: [
          {option: Option, props: {type: "toggle", title: "Include managed packages metadata", key: "includeManagedMetadata"}},
          {option: Option,
            props: {type: "select",
              title: "Sort metadata components",
              key: "sortMetadataBy",
              default: "fullName",
              options: [
                {label: "A-Z", value: "fullName"},
                {label: "Last Modified Date DESC", value: "lastModifiedDate"}
              ]
            }
          },
          {option: Option, props: {type: "toggle", title: "Use legacy version", key: "useLegacyDlMetadata", default: false}}
        ]
      },
      {
        id: 8,
        tabTitle: "Tab8",
        title: "Flow Scanner",
        content: [
          {option: FlowScannerRulesOption, props: {title: "Enabled Rules", key: "flowScannerRules", checkboxes: ruleCheckboxes, error: this.state.flowScannerError, scannerVersion, onShowAddRuleModal: this.props.onShowAddRuleModal}}
        ]
      },
      {
        id: 9,
        tabTitle: "Tab9",
        title: "Custom Shortcuts",
        content: [
          {option: CustomShortcuts, props: {}}
        ]
      }
    ];
    this.onTabSelect = this.onTabSelect.bind(this);
  }

  onTabSelect(e) {
    e.preventDefault();
    const selectedTabId = e.target.tabIndex;

    // Update the URL with the selected tab
    const url = new URL(window.location);
    url.searchParams.set("selectedTab", selectedTabId);
    window.history.pushState({}, "", url);

    this.setState({selectedTabId});
  }

  render() {
    return h("div", {className: "slds-tabs_default"},
      h("ul", {className: "options-tab-container slds-tabs_default__nav", role: "tablist"},
        this.tabs.map((tab) => h(OptionsTab, {key: tab.id, title: tab.title, id: tab.id, selectedTabId: this.state.selectedTabId, onTabSelect: this.onTabSelect}))
      ),
      this.tabs.map((tab) => h(OptionsContainer, {key: tab.id, id: tab.id, content: tab.content, selectedTabId: this.state.selectedTabId, model: this.model}))
    );
  }
}

// --- Main Model and App ---

class Model {

  constructor(sfHost) {
    this.sfHost = sfHost;
    this.sfLink = "https://" + this.sfHost;
    this.userInfo = "...";
    let trialExpDate = localStorage.getItem(sfHost + "_trialExpirationDate");
    if (localStorage.getItem(sfHost + "_isSandbox") != "true" && (!trialExpDate || trialExpDate === "null")) {
      //change background color for production
      document.body.classList.add("prod");
    }

    this.describeInfo = new DescribeInfo(this.spinFor.bind(this), () => { });
    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
    }));
  }

  /**
   * Notify React that we changed something, so it will rerender the view.
   * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
   * All event listeners (functions starting with "on") should call this function if they update the model.
   * Asynchronous operations should use the spinFor function, which will call this function after the asynchronous operation completes.
   * Other functions should not call this function, since they are called by a function that does.
   * @param cb A function to be called once React has processed the update.
   */
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
    if (this.testCallback) {
      this.testCallback();
    }
  }

  /**
   * Show the spinner while waiting for a promise.
   * didUpdate() must be called after calling spinFor.
   * didUpdate() is called when the promise is resolved or rejected, so the caller doesn't have to call it, when it updates the model just before resolving the promise, for better performance.
   * @param promise The promise to wait for.
   */
  spinFor(promise) {
    this.spinnerCount++;
    promise
      .catch(err => {
        console.error("spinFor", err);
      })
      .then(() => {
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }

}

class App extends React.Component {

  constructor(props) {
    super(props);
    this.foo = undefined;

    this.exportOptions = this.exportOptions.bind(this);
    this.importOptions = this.importOptions.bind(this);
    this.hideToast = this.hideToast.bind(this);
    // Add modal logic
    this.showAddRuleModal = this.showAddRuleModal.bind(this);
    this.hideAddRuleModal = this.hideAddRuleModal.bind(this);
    this.handleSaveCustomRule = this.handleSaveCustomRule.bind(this);
    this._renderModal = this._renderModal.bind(this);
    this.renderAddRuleForm = this.renderAddRuleForm.bind(this);
    this.customKey = "flowScannerCustomRules";
    this.state = {
      // toast state
      showToast: false,
      toastMessage: "",
      toastVariant: "",
      toastTitle: "",
      // modal state
      isAddRuleModalOpen: false,
      newRuleName: "",
      newRuleLabel: "",
      newRuleDescription: "",
      newRuleCode: "",
      newRuleSeverity: "error"
    };
    this.modalContainer = null;
  }

  componentDidUpdate(prevProps, prevState) {
    console.log("[Modal Debug] componentDidUpdate, prev open:", prevState.isAddRuleModalOpen, "current open:", this.state.isAddRuleModalOpen);
    if (this.state.isAddRuleModalOpen && !prevState.isAddRuleModalOpen) {
      this.modalContainer = document.createElement("div");
      document.body.appendChild(this.modalContainer);
      console.log("[Modal Debug] Modal container created:", this.modalContainer);
      this._renderModal();
    } else if (!this.state.isAddRuleModalOpen && prevState.isAddRuleModalOpen) {
      if (this.modalContainer) {
        console.log("[Modal Debug] Unmounting and removing modal container");
        ReactDOM.unmountComponentAtNode(this.modalContainer);
        document.body.removeChild(this.modalContainer);
        this.modalContainer = null;
      }
    } else if (this.state.isAddRuleModalOpen) {
      console.log("[Modal Debug] Modal already open, re-rendering");
      this._renderModal();
    }
  }

  componentWillUnmount() {
    if (this.modalContainer) {
      ReactDOM.unmountComponentAtNode(this.modalContainer);
      document.body.removeChild(this.modalContainer);
      this.modalContainer = null;
    }
  }

  exportOptions() {
    const localStorageData = {...localStorage};
    const jsonData = JSON.stringify(localStorageData, null, 2);
    const blob = new Blob([jsonData], {type: "application/json"});
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "reloadedConfiguration.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  importOptions() {
    const fileInput = this.refs.fileInput;

    if (!fileInput.files.length) {
      console.error("No file selected.");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        for (const [key, value] of Object.entries(importedData)) {
          localStorage.setItem(key, value);
        }
        this.setState({
          showToast: true,
          toastMessage: "Options Imported Successfully!",
          toastVariant: "success",
          toastTitle: "Success"
        });
        setTimeout(this.hideToast, 3000);
      } catch (error) {
        this.setState({
          showToast: true,
          toastMessage: "Import Failed",
          toastVariant: "error",
          toastTitle: "Error"
        });
        console.error("Error parsing JSON file:", error);
      }
    };
    reader.readAsText(file);
  }

  hideToast() {
    this.setState({showToast: false, toastMessage: ""});
  }

  showAddRuleModal() {
    console.log("[Modal Debug] showAddRuleModal called");
    document.body.classList.add("slds-scrollable_none");
    document.body.classList.add("slds-modal_open");
    this.setState({isAddRuleModalOpen: true});
  }

  hideAddRuleModal() {
    document.body.classList.remove("slds-scrollable_none");
    document.body.classList.remove("slds-modal_open");
    this.setState({
      isAddRuleModalOpen: false,
      newRuleName: "",
      newRuleLabel: "",
      newRuleDescription: "",
      newRuleCode: "",
      newRuleSeverity: "error"
    });
  }

  handleSaveCustomRule() {
    const {newRuleName, newRuleLabel, newRuleDescription, newRuleCode, newRuleSeverity} = this.state;
    const newRule = {
      name: newRuleName,
      label: newRuleLabel,
      description: newRuleDescription,
      code: newRuleCode,
      severity: newRuleSeverity,
      isCustom: true,
      checked: true
    };
    const customRules = JSON.parse(localStorage.getItem(this.customKey) || "[]");
    customRules.push(newRule);
    localStorage.setItem(this.customKey, JSON.stringify(customRules));
    this.hideAddRuleModal();
    window.location.reload();
  }

  _renderModal() {
    console.log("[Modal Debug] _renderModal invoked");
    const {newRuleName, newRuleLabel, newRuleDescription, newRuleSeverity, newRuleCode} = this.state;
    const isFormValid = newRuleName && newRuleLabel && newRuleDescription && newRuleSeverity && newRuleCode;
    const modalWithBackdrop = h("div", {},
      h("section", {
        role: "dialog", 
        tabIndex: "-1", 
        "aria-modal": "true", 
        "aria-labelledby": "modal-heading", 
        className: "slds-modal slds-modal_medium slds-fade-in-open"
      },
        h("div", {className: "slds-modal__container"},
          h("div", {className: "slds-modal__header"},
            h("button", {
              className: "slds-button slds-button_icon slds-modal__close slds-button_icon-inverse",
              title: "Close",
              onClick: this.hideAddRuleModal
            },
            h("svg", {className: "slds-button__icon slds-button__icon_large", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#close"})
            ),
            h("span", {className: "slds-assistive-text"}, "Close")
            ),
            h("h2", {id: "modal-heading", className: "slds-modal__title slds-text-heading_medium"}, "Add Custom Flow Scanner Rule")
          ),
          h("div", {className: "slds-modal__content slds-p-around_medium"},
            this.renderAddRuleForm()
          ),
          h("div", {className: "slds-modal__footer"},
            h("button", {className: "slds-button slds-button_neutral", onClick: this.hideAddRuleModal}, "Cancel"),
            h("button", {className: "slds-button slds-button_brand", onClick: this.handleSaveCustomRule, disabled: !isFormValid}, "Save")
          )
        )
      ),
      h("div", {className: "slds-backdrop slds-backdrop_open", role: "presentation"})
    );
    console.log("[Modal Debug] Rendering modalWithBackdrop into container", this.modalContainer);
    if (this.modalContainer) {
      ReactDOM.render(modalWithBackdrop, this.modalContainer);
    }
  }

  renderAddRuleForm() {
    const {newRuleName, newRuleLabel, newRuleDescription, newRuleSeverity, newRuleCode} = this.state;
    return h("div", {className: "slds-form slds-form_stacked"},
      h("div", {className: "slds-form-element"},
        h("label", {className: "slds-form-element__label", htmlFor: "new-rule-name"}, "Rule Name (must match the exported class name)"),
        h("div", {className: "slds-form-element__control"},
          h("input", {type: "text", id: "new-rule-name", className: "slds-input", placeholder: "e.g., MyCustomRule", value: newRuleName, onChange: e => this.setState({newRuleName: e.target.value.trim()})})
        )
      ),
      h("div", {className: "slds-form-element"},
        h("label", {className: "slds-form-element__label", htmlFor: "new-rule-label"}, "Label"),
        h("div", {className: "slds-form-element__control"},
          h("input", {type: "text", id: "new-rule-label", className: "slds-input", placeholder: "e.g., My Custom Rule", value: newRuleLabel, onChange: e => this.setState({newRuleLabel: e.target.value})})
        )
      ),
      h("div", {className: "slds-form-element"},
        h("label", {className: "slds-form-element__label", htmlFor: "new-rule-description"}, "Description"),
        h("div", {className: "slds-form-element__control"},
          h("textarea", {id: "new-rule-description", className: "slds-textarea", placeholder: "A short description of what this rule does.", value: newRuleDescription, onChange: e => this.setState({newRuleDescription: e.target.value})})
        )
      ),
      h("div", {className: "slds-form-element"},
        h("label", {className: "slds-form-element__label", htmlFor: "new-rule-severity"}, "Severity"),
        h("div", {className: "slds-form-element__control"},
          h("select", {id: "new-rule-severity", className: "slds-select", value: newRuleSeverity, onChange: e => this.setState({newRuleSeverity: e.target.value})},
            h("option", {value: "error"}, "Error"),
            h("option", {value: "warning"}, "Warning"),
            h("option", {value: "info"}, "Info")
          )
        )
      ),
      h("div", {className: "slds-form-element"},
        h("label", {className: "slds-form-element__label", htmlFor: "new-rule-code"}, "Rule Code"),
        h("div", {className: "slds-form-element__control"},
          h("textarea", {id: "new-rule-code", className: "slds-textarea", placeholder: "Paste your JavaScript rule code here. e.g., export default class MyCustomRule { ... }", value: newRuleCode, onChange: e => this.setState({newRuleCode: e.target.value}), rows: 10, style: {fontFamily: "monospace"}})
        )
      )
    );
  }

  render() {
    let {model} = this.props;
    return h("div", {},
      // Manual portal-based modal rendering will handle overlay when isAddRuleModalOpen is true
      h("div", {id: "user-info", className: "slds-border_bottom"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("use", {xlinkHref: "symbols.svg#salesforce-home"})
          ),
          " Salesforce Home"
        ),
        h("h1", {className: "slds-text-title_bold"}, "Options"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},
          h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled", onClick: this.exportOptions, title: "Export Options"},
            h("svg", {className: "slds-button__icon"},
              h("use", {xlinkHref: "symbols.svg#download"})
            )
          ),
          h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small", onClick: () => this.refs.fileInput.click(), title: "Import Options"},
            h("svg", {className: "slds-button__icon"},
              h("use", {xlinkHref: "symbols.svg#upload"})
            )
          ),
          // Hidden file input for importing options
          h("input", {
            type: "file",
            style: {display: "none"},
            ref: "fileInput",
            onChange: this.importOptions,
            accept: "application/json"
          })
        )
      ),
      this.state.showToast
        && h(Toast, {
          variant: this.state.toastVariant,
          title: this.state.toastTitle,
          message: this.state.toastMessage,
          onClose: this.hideToast
        }),
      h("div", {className: "main-container slds-card slds-m-around_small", id: "main-container_header"},
        h(OptionsTabSelector, {model, onShowAddRuleModal: this.showAddRuleModal})
      )
    );
  }
}

// --- App Initialization ---

{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {
    let root = document.getElementById("root");
    let model = new Model(sfHost);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model});
    }
  });
}