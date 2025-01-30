/* global React ReactDOM */
import {sfConn, apiVersion, defaultApiVersion, nullToEmptyString} from "./inspector.js";
/* global initButton */
import {DescribeInfo} from "./data-load.js";
import Toast from "./components/Toast.js";

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

class OptionsTabSelector extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.sfHost = this.model.sfHost;

    // Get the tab from the URL or default to 1
    const urlParams = new URLSearchParams(window.location.search);
    const initialTabId = parseInt(urlParams.get("selectedTab")) || 1;

    this.state = {
      selectedTabId: initialTabId
    };

    this.tabs = [
      {
        id: 1,
        tabTitle: "Tab1",
        title: "User Experience",
        content: [
          {option: ArrowButtonOption, props: {key: 1}},
          {option: Option, props: {type: "toggle", title: "Flow Scrollability", key: "scrollOnFlowBuilder"}},
          {option: Option, props: {type: "toggle", title: "Inspect page - Show table borders", key: "displayInspectTableBorders"}},
          {option: Option, props: {type: "toggle", title: "Always open links in a new tab", key: "openLinksInNewTab"}},
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
                {label: "Explore API", name: "explore-api", checked: true},
                {label: "Org Limits", name: "org-limits", checked: true},
                {label: "Options", name: "options", checked: true},
                {label: "Generate Access Token", name: "generate-token", checked: true}
              ]}
          },
          {option: Option, props: {type: "toggle", title: "Show 'Generate Access Token' button", key: "popupGenerateTokenButton", default: true}},
          {option: FaviconOption, props: {key: this.sfHost + "_customFavicon", tooltip: "You may need to add this domain to CSP trusted domains to see the favicon in Salesforce."}},
          {option: Option, props: {type: "toggle", title: "Use favicon color on sandbox banner", key: "colorizeSandboxBanner"}},
          {option: Option, props: {type: "toggle", title: "Highlight PROD (color from favicon)", key: "colorizeProdBanner", tooltip: "Top border in extension pages and banner on Salesforce"}},
          {option: Option, props: {type: "text", title: "PROD Banner text", key: this.sfHost + "_prodBannerText", tooltip: "Text that will be displayed in the PROD banner (if enabled)", placeholder: "WARNING: THIS IS PRODUCTION"}}
        ]
      },
      {
        id: 2,
        tabTitle: "Tab2",
        title: "API",
        content: [
          {option: APIVersionOption, props: {key: 1}},
          {option: APIKeyOption, props: {key: 2}},
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
                {label: "Export Query", name: "export-query", checked: false}
              ]}
          },
          {option: Option, props: {type: "toggle", title: "Hide additional Object columns by default on Data Export", key: "hideObjectNameColumnsDataExport", default: false}},
          {option: Option, props: {type: "toggle", title: "Include formula fields from suggestion", key: "includeFormulaFieldsFromExportAutocomplete", default: true}},
          {option: Option, props: {type: "toggle", title: "Disable query input autofocus", key: "disableQueryInputAutoFocus"}},
          {option: Option, props: {type: "number", title: "Number of queries stored in the history", key: "numberOfQueriesInHistory", default: 100}},
          {option: Option, props: {type: "number", title: "Number of saved queries", key: "numberOfQueriesSaved", default: 50}},
          {option: Option, props: {type: "text", title: "Query Templates", key: "queryTemplates", placeholder: "SELECT Id FROM// SELECT Id FROM WHERE//SELECT Id FROM WHERE IN//SELECT Id FROM WHERE LIKE//SELECT Id FROM ORDER BY//SELECT ID FROM MYTEST__c//SELECT ID WHERE"}}
        ]
      },
      {
        id: 4,
        tabTitle: "Tab4",
        title: "Data Import",
        content: [
          {option: Option, props: {type: "text", title: "Default batch size", key: "defaultBatchSize", placeholder: "200"}},
          {option: Option, props: {type: "text", title: "Default thread size", key: "defaultThreadSize", placeholder: "6"}}
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
    return h("div", {id: this.props.id, className: this.getClass(), role: "tabpanel"}, this.props.content.map((c) => h(c.option, {storageKey: c.props?.key, ...c.props, model: this.model})));
  }

}

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

  onChangeApiVersion(e) {
    let apiVersion = e.target.value;
    this.setState({apiVersion});
    localStorage.setItem("apiVersion", apiVersion + ".0");
  }

  onRestoreDefaultApiVersion(){
    localStorage.removeItem("apiVersion");
    this.setState({apiVersion: defaultApiVersion});
  }

  render() {
    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, "API Version")
      ),
      h("div", {className: "slds-col slds-size_5-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"}),
      h("div", {className: "slds-col slds-size_3-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        this.state.apiVersion != defaultApiVersion ? h("div", {className: "slds-form-element__control"},
          h("button", {className: "button button-brand", onClick: this.onRestoreDefaultApiVersion, title: "Restore Extension's default version"}, "Restore Default")
        ) : null,
        h("div", {className: "slds-form-element__control slds-col slds-size_2-of-12"},
          h("input", {type: "number", required: true, className: "slds-input", value: nullToEmptyString(this.state.apiVersion.split(".0")[0]), onChange: this.onChangeApiVersion}),
        )
      )
    );
  }
}

class Tooltip extends React.Component {
  constructor(props) {
    super(props);
    this.tooltip = props.tooltip;
    this.tipKey = props.idKey + "_tooltip";
    this.iconKey = props.idKey + "_icon";
    this.onClick = this.onClick.bind(this);
    this.onHover = this.onHover.bind(this);
    this.onHide = this.onHide.bind(this);
    this.showTimer = null;
    // Default to 0 opacity and completely hidden (isTooltipVisible evaluates to display: none)
    this.state = {
      isTooltipVisible: false,
      position: {x: "0", y: "0"},
      opacity: 0
    };
  }

  setTooltipPosition() {
    // At this point, display was visible but fully transparent in the top left corner of the screen
    // If isVisible is false, getBoundingClientRect will return 0 for all values
    const tabHeader = document.querySelectorAll('[id="main-container_header"]')[0];
    const marginTop = parseInt(window.getComputedStyle(tabHeader).getPropertyValue("margin-top"));
    const yOffset = tabHeader.getBoundingClientRect().top + marginTop + 2; // Add 2 extra pixels below nubbin
    const toolTip = document.querySelectorAll(`[id='${this.tipKey}']`)[0];
    const elRect = document.querySelectorAll(`[id='${this.iconKey}']`)[0].getBoundingClientRect();
    const toolTipRect = toolTip.getBoundingClientRect();
    const x = `${elRect.left - 27}px`; // fixed x offset (distance from left edge of tooltip to nubbin point)
    const y = `${elRect.top - toolTipRect.height - yOffset}px`;
    // Finally, set opacity to 100% so the user can see it
    this.setState({position: {x, y}, opacity: 1});
  }

  onClick(e) {
    e.preventDefault();
    this.show();
  }

  onHover() {
    this.show(350);
  }

  show(delay = 0) {
    clearTimeout(this.showTimer);
    this.showTimer = setTimeout(() => {
      this.setState({isTooltipVisible: true});
      this.setTooltipPosition();
    }, delay);
  }

  onHide() {
    clearTimeout(this.showTimer);
    this.setState({isTooltipVisible: false});
  }

  render() {
    if (!this.tooltip) {
      return null;
    }

    return h("span", {style: {marginLeft: "2px"}, id: this.iconKey},
      h("a", {href: "#", onClick: this.onClick, onMouseEnter: this.onHover, onMouseLeave: this.onHide},
        h("span", {className: "slds-icon_container slds-icon-utility-info"},
          h("svg", {className: "slds-icon_xx-small slds-icon-text-default", viewBox: "0 0 40 40", style: {verticalAlign: "unset", margin: "3px"}},
            h("use", {xlinkHref: "symbols.svg#info", fill: "#9c9c9c"}),
          )),
        h("span", {className: "slds-assistive-text"}, "Learn more")
      ),
      h("div", {className: "slds-popover slds-popover_tooltip slds-nubbin_bottom-left", role: "tooltip", id: this.tipKey, style: {position: "absolute", left: this.state.position.x, top: this.state.position.y, opacity: this.state.opacity, display: this.state.isTooltipVisible ? "block" : "none"}},
        h("div", {className: "slds-popover__body"}, this.props.tooltip)
      ));
  }
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
    let value = localStorage.getItem(this.key);
    if (props.default !== undefined && value === null) {
      value = JSON.stringify(props.default);
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
    const isSelect = this.type == "select";

    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, this.title,
          h(Tooltip, {tooltip: this.tooltip, idKey: this.key})
        )
      ),
      isTextOrNumber ? (h("div", {className: "slds-col slds-size_2-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control slds-col slds-size_5-of-12"},
          h("input", {type: this.type, id, className: "slds-input", placeholder: this.placeholder, value: nullToEmptyString(this.state[this.key]), onChange: this.onChange})
        )
      ))
      : isSelect ? (h("div", {className: "slds-col slds-size_2-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
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
        "SlateBlue", "SteelBlue", "SkyBlue", "PowderBlue", "MediumSlateBlue",
        "Indigo", "BlueViolet", "MediumPurple", "CadetBlue", "Aqua",
        "Turquoise", "DarkTurquoise", "Teal", "LightSlateGray", "MidnightBlue"
      ],
      uat: [
        "MediumOrchid", "Orchid", "DarkOrchid", "DarkViolet", "DarkMagenta",
        "Purple", "BlueViolet", "Indigo", "DarkSlateBlue", "RebeccaPurple",
        "MediumPurple", "MediumSlateBlue", "SlateBlue", "Plum", "Violet",
        "Thistle", "Magenta", "DarkOrchid", "Fuchsia", "DarkPurple"
      ],
      int: [
        "LimeGreen", "SeaGreen", "MediumSeaGreen", "ForestGreen", "Green",
        "DarkGreen", "YellowGreen", "OliveDrab", "DarkOliveGreen",
        "SpringGreen", "LawnGreen", "DarkKhaki",
        "GreenYellow", "DarkSeaGreen", "MediumAquamarine", "DarkCyan",
        "Teal", "Jade", "MediumForestGreen", "HunterGreen"
      ],
      full: [
        "Orange", "DarkOrange", "Coral", "Tomato", "OrangeRed",
        "Salmon", "IndianRed", "Sienna", "Chocolate", "SaddleBrown",
        "Peru", "DarkSalmon", "RosyBrown", "Brown", "Maroon",
        "Tangerine", "Peach", "BurntOrange", "Pumpkin", "Amber"
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
          h("button", {className: "button button-brand", onClick: this.populateFaviconColors, title: "Use favicon for all orgs I've visited"}, "Populate All")
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
    const updatedCheckboxes = this.state.checkboxes.map((checkbox) =>
      checkbox.name === name ? {...checkbox, checked} : checkbox
    );
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

class APIKeyOption extends React.Component {

  constructor(props) {
    super(props);
    this.sfHost = props.model.sfHost;
    this.onChangeApiKey = this.onChangeApiKey.bind(this);
    this.state = {apiKey: localStorage.getItem(this.sfHost + "_clientId") ? localStorage.getItem(this.sfHost + "_clientId") : ""};
  }

  onChangeApiKey(e) {
    let apiKey = e.target.value;
    this.setState({apiKey});
    localStorage.setItem(this.sfHost + "_clientId", apiKey);
  }

  render() {
    return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
      h("div", {className: "slds-col slds-size_4-of-12 text-align-middle"},
        h("span", {}, "API Consumer Key")
      ),
      h("div", {className: "slds-col slds-size_2-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control slds-col slds-size_6-of-12"},
          h("input", {type: "text", id: "apiKeyInput", className: "slds-input", placeholder: "Consumer Key", value: nullToEmptyString(this.state.apiKey), onChange: this.onChangeApiKey}),
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

let h = React.createElement;

class App extends React.Component {

  constructor(props) {
    super(props);
    this.foo = undefined;

    this.exportOptions = this.exportOptions.bind(this);
    this.importOptions = this.importOptions.bind(this);
    this.hideToast = this.hideToast.bind(this);
    this.state = {};
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
    let {model} = this.props;
    this.state = {showToast: false, toastMessage: ""};
    model.didUpdate();
  }

  render() {
    const {showToast, toastMessage, toastVariant, toastTitle} = this.state;
    let {model} = this.props;
    return h("div", {},
      h("div", {id: "user-info", className: "slds-border_bottom"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
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
        h(OptionsTabSelector, {model})
      )
    );
  }
}

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
