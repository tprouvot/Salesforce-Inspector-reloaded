/* global React ReactDOM */
import {sfConn, apiVersion, defaultApiVersion} from "./inspector.js";
import {nullToEmptyString, getLatestApiVersionFromOrg, Constants} from "./utils.js";
import {getFlowScannerRules} from "./flow-scanner.js";
/* global initButton, lightningflowscanner */
import {DescribeInfo} from "./data-load.js";
import Toast from "./components/Toast.js";
import Tooltip from "./components/Tooltip.js";

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
    this.appRef = props.appRef;
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
        tabTitle: "User Experience",
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
        tabTitle: "API",
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
        tabTitle: "Data Export",
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
        tabTitle: "Data Import",
        content: [
          {option: Option, props: {type: "text", title: "Default batch size", key: "defaultBatchSize", placeholder: "200"}},
          {option: Option, props: {type: "text", title: "Default thread size", key: "defaultThreadSize", placeholder: "6"}},
          {option: Option, props: {type: "toggle", title: "Grey Out Skipped Columns in Data Import", key: "greyOutSkippedColumns", tooltip: "Control if skipped columns are greyed out or not in data import"}}
        ]
      },
      {
        id: 5,
        tabTitle: "Field Creator",
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
        tabTitle: "Enable Logs",
        content: [
          {option: enableLogsOption, props: {key: 1}}
        ]
      },
      {
        id: 7,
        tabTitle: "Metadata",
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
          {option: Option, props: {type: "toggle", title: "Use legacy version", key: "useLegacyDlMetadata", default: false}},
        ]
      },
      {
        id: 8,
        tabTitle: "Flow Scanner",
        title: "Enabled Rules (v4.49.0)",
        description: "Configure which Flow Scanner rules are enabled and their settings. Only enabled rules will be used when scanning flows.",
        descriptionTooltip: "Flow Scanner rules help identify potential issues, best practices violations, and improvements opportunities in your Salesforce Flows. Each rule can be individually enabled or disabled, and some rules have configurable parameters like thresholds or expressions.",
        actionButtons: [
          {
            type: "brand",
            label: "Check All",
            title: "Enable all Flow Scanner rules",
            method: this.handleCheckAll.bind(this)
          },
          {
            type: "neutral",
            label: "Uncheck All",
            title: "Disable all Flow Scanner rules",
            method: this.handleUncheckAll.bind(this)
          },
          {
            type: "neutral",
            label: "Reset to Defaults",
            title: "Reset all rules to their default settings",
            method: this.handleResetToDefaults.bind(this)
          },
          {
            type: "icon",
            icon: "download",
            title: "Export Flow Scanner rules configuration to file",
            method: this.handleExportRules.bind(this)
          },
          {
            type: "icon",
            icon: "upload",
            title: "Import Flow Scanner rules configuration from file",
            method: this.handleImportRules.bind(this)
          }
        ],
        content: [
          {option: FlowScannerRules, props: {model: this.model}}
        ]
      },
      {
        id: 9,
        tabTitle: "Custom Shortcuts",
        content: [
          {option: CustomShortcuts, props: {}}
        ]
      }
    ];
    this.onTabSelect = this.onTabSelect.bind(this);
  }

  handleCheckAll() {
    // Implementation to check all Flow Scanner rules
    if (this.model.flowScannerRulesRef) {
      this.model.flowScannerRulesRef.checkAllRules();
    }
  }

  handleUncheckAll() {
    // Implementation to uncheck all Flow Scanner rules
    if (this.model.flowScannerRulesRef) {
      this.model.flowScannerRulesRef.uncheckAllRules();
    }
  }

  handleResetToDefaults() {
    // Implementation to reset Flow Scanner rules to defaults
    if (this.model.flowScannerRulesRef) {
      this.model.flowScannerRulesRef.resetToDefaults();
    }
  }

  handleExportRules() {
    // Export only Flow Scanner related localStorage keys
    const flowScannerFilters = ["flowScannerRules"];
    // Get reference to App component to call its exportOptions method
    if (this.appRef) {
      this.appRef.exportOptions(flowScannerFilters);
    }
  }

  handleImportRules() {
    if (this.appRef) {
      this.appRef.pendingImportFilters = ["flowScannerRules"];
      this.appRef.refs.fileInput.click();
    }
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
        this.tabs.map((tab) => h(OptionsTab, {key: tab.id, title: tab.tabTitle || tab.title, id: tab.id, selectedTabId: this.state.selectedTabId, onTabSelect: this.onTabSelect}))
      ),
      this.tabs.map((tab) => h(OptionsContainer, {
        key: tab.id,
        id: tab.id,
        title: tab.title,
        description: tab.description,
        descriptionTooltip: tab.descriptionTooltip,
        actionButtons: tab.actionButtons,
        content: tab.content,
        selectedTabId: this.state.selectedTabId,
        model: this.model
      }))
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

  renderTabHeader() {
    const {title, description, descriptionTooltip, actionButtons} = this.props;

    if (!title && !description && !actionButtons) {
      return null;
    }

    return h("div", {className: "slds-p-around_medium slds-border_bottom"},
      title && h("h2", {className: "slds-text-heading_large slds-text-title_bold slds-m-bottom_x-small"}, title),
      description && h("div", {className: "slds-grid slds-grid_align-spread slds-m-bottom_medium"},
        h("div", {className: "slds-col slds-size_10-of-12"},
          h("p", {className: "slds-text-body_regular slds-text-color_weak"}, description,
            descriptionTooltip && h(Tooltip, {tooltip: descriptionTooltip, idKey: `${this.props.id}_description`})
          )
        )
      ),
      actionButtons && actionButtons.length > 0 && h("div", {className: "slds-button-group", role: "group"},
        actionButtons.map((button, index) => {
          if (button.type === "icon") {
            // Icon button
            return h("button", {
              key: index,
              className: `slds-button slds-button_icon slds-button_icon-border-filled${index > 0 ? " slds-m-left_x-small" : ""}`,
              onClick: button.method,
              title: button.title
            }, h("svg", {className: "slds-button__icon"},
              h("use", {xlinkHref: `symbols.svg#${button.icon}`})
            ));
          } else {
            // Text button
            return h("button", {
              key: index,
              className: `slds-button ${button.type === "brand" ? "slds-button_brand" : "slds-button_neutral"}`,
              onClick: button.method,
              title: button.title || button.label
            }, button.label);
          }
        })
      )
    );
  }

  render() {
    return h("div", {id: this.props.id, key: this.props.id, className: this.getClass(), role: "tabpanel"},
      this.renderTabHeader(),
      h("div", {},
        this.props.content.map((c, index) =>
          h(c.option, {
            key: c.props?.key || `option-${index}`,
            storageKey: c.props?.key,
            ...c.props,
            model: this.model
          })
        )
      )
    );
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

class Option extends React.Component {

  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.onChangeToggle = this.onChangeToggle.bind(this);
    this.onChangeConfig = this.onChangeConfig.bind(this);
    this.toggleDescriptionExpanded = this.toggleDescriptionExpanded.bind(this);
    this.checkForTruncation = this.checkForTruncation.bind(this);
    this.descriptionRef = {current: null};
    this.key = props.storageKey;
    this.type = props.type;
    this.label = props.label;
    this.tooltip = props.tooltip;
    this.placeholder = props.placeholder;
    this.actionButton = props.actionButton;
    this.inputSize = props.inputSize || "3";

    // Enhanced properties
    this.enhancedTitle = props.enhancedTitle;
    this.badge = props.badge; // {label: "Beta", type: "beta|custom"}
    this.severity = props.severity; // "info|warning|error"
    this.description = props.description; // Enhanced description display

    // Configurable rule properties
    this.isConfigurable = props.isConfigurable;
    this.configType = props.configType;
    this.configStorageKey = props.configStorageKey;
    this.onConfigChange = props.onConfigChange;
    this.onToggleChange = props.onToggleChange;

    // Handle Flow Scanner rules (no storageKey, managed by parent)
    const isFlowScannerRule = !this.key && this.onToggleChange;

    let value;
    if (isFlowScannerRule) {
      // Use checked prop from parent for Flow Scanner rules
      value = props.checked;
    } else {
      // Use localStorage for regular options
      value = localStorage.getItem(this.key);
      if (props.default !== undefined && value === null) {
        value = props.type != "text" ? JSON.stringify(props.default) : props.default;
        localStorage.setItem(this.key, value);
      }
    }

    // Initialize config value if configurable (value comes from props)
    let configValue = props.configValue || null;

    this.state = {
      [this.key || "checked"]: isFlowScannerRule ? value
      : this.type == "toggle" ? !!JSON.parse(value)
      : this.type == "select" ? (value || props.default || props.options?.[0]?.value)
      : value,
      configValue,
      descriptionExpanded: false,
      showExpandButton: false
    };
    this.title = props.title;
  }

  onChangeToggle(e) {
    const enabled = e.target.checked;
    const stateKey = this.key || "checked";
    this.setState({[stateKey]: enabled});

    // Handle Flow Scanner rules vs regular options
    if (this.onToggleChange) {
      // Flow Scanner rule - call parent callback
      this.onToggleChange(enabled);
    } else {
      // Regular option - use localStorage
      localStorage.setItem(this.key, JSON.stringify(enabled));
    }
  }

  onChangeConfig(e) {
    const configValue = e.target.value;
    this.setState({configValue});
    if (this.onConfigChange) {
      this.onConfigChange(this.key, configValue);
    }
  }

  onChange(e) {
    let inputValue = e.target.value;
    this.setState({[this.key]: inputValue});
    localStorage.setItem(this.key, inputValue);
  }

  toggleDescriptionExpanded() {
    this.setState(prevState => ({
      descriptionExpanded: !prevState.descriptionExpanded
    }));
  }

  isDescriptionTruncated() {
    if (!this.descriptionRef.current || !this.description) {
      return false;
    }
    const element = this.descriptionRef.current;
    return element.scrollWidth > element.clientWidth;
  }

  checkForTruncation() {
    const isTruncated = this.isDescriptionTruncated();
    if (this.state.showExpandButton !== isTruncated) {
      this.setState({showExpandButton: isTruncated});
    }
  }

  renderInputControl(id, isEnhanced = false) {
    const isTextOrNumber = this.type == "text" || this.type == "number";
    const isTextArea = this.type == "textarea";
    const isSelect = this.type == "select";
    const isToggle = this.type == "toggle";

    if (isToggle) {
      return isEnhanced ? null : (
        h("div", {dir: "rtl", className: "slds-form-element__control slds-col slds-size_1-of-12 slds-p-right_medium"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("input", {type: "checkbox", required: true, id, "aria-describedby": id, className: "slds-input", checked: this.state[this.key || "checked"], onChange: this.onChangeToggle}),
            h("span", {id, className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on"}, "Enabled"),
              h("span", {className: "slds-checkbox_off"}, "Disabled"),
            )
          )
        )
      );
    }

    const inputElement = isTextOrNumber ? h("input", {
      type: this.type,
      id,
      className: isEnhanced ? "slds-input enhanced-option-input" : "slds-input",
      placeholder: this.placeholder,
      value: nullToEmptyString(this.state[this.key]),
      onChange: this.onChange
    })
      : isTextArea ? h("textarea", {
        id,
        className: isEnhanced ? "slds-input enhanced-option-input" : "slds-input",
        placeholder: this.placeholder,
        value: nullToEmptyString(this.state[this.key]),
        onChange: this.onChange
      })
      : isSelect ? h("select", {
        className: isEnhanced ? "slds-input enhanced-option-input" : "slds-input slds-m-right_small",
        value: this.state[this.key],
        onChange: this.onChange
      },
      this.props.options.map(opt =>
        h("option", {key: opt.value, value: opt.value}, opt.label)
      ))
      : null;

    if (isEnhanced) {
      return inputElement;
    } else {
      // Standard layout wrapping
      return h("div", {className: "slds-col slds-size_" + this.inputSize + "-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control slds-col slds-size_5-of-12"},
          inputElement
        )
      );
    }
  }

  renderConfigInput() {
    if (!this.isConfigurable || !this.configType) {
      return null;
    }

    const configId = this.configStorageKey || `${this.key}_config`;
    const inputType = this.configType === "threshold" ? "number" : "text";
    const placeholder = this.configType === "threshold" ? "Enter threshold value"
      : this.configType === "expression" ? "Enter regex pattern"
      : "Enter configuration value";

    return h("input", {
      type: inputType,
      id: configId,
      className: "slds-input enhanced-option-input",
      placeholder,
      value: this.state.configValue || "",
      onChange: this.onChangeConfig,
      title: `Configure ${this.enhancedTitle || this.title} (${this.configType})`
    });
  }

  render() {
    const id = this.key;
    const isToggle = this.type == "toggle";
    const isEnhanced = this.enhancedTitle || this.badge || this.severity || this.description;

    if (isEnhanced) {
      // Enhanced layout
      return h("div", {className: "enhanced-option-row"},
        // Main content area
        h("div", {className: "enhanced-option-content"},
          // Enhanced title with badge
          h("div", {className: "enhanced-option-title"},
            h("h4", {className: "enhanced-option-title-text"}, this.enhancedTitle || this.title),
            this.badge && h("span", {
              className: `${this.badge.type || "beta"}-badge`
            }, this.badge.label)
          ),

          // Description on the same line with expand functionality
          this.description && h("div", {className: "enhanced-option-description-container"},
            h("span", {
              className: `enhanced-option-description ${this.state.descriptionExpanded ? "expanded" : ""}`,
              ref: (el) => {
                this.descriptionRef.current = el;
                if (el) {
                  setTimeout(() => this.checkForTruncation(), 0);
                }
              }
            }, this.description),
            // Expand icon (only show when text is truncated)
            this.state.showExpandButton && h("button", {
              className: "enhanced-option-expand-btn",
              onClick: this.toggleDescriptionExpanded,
              title: this.state.descriptionExpanded ? "Collapse description" : "Expand description"
            },
            h("svg", {className: `expand-icon ${this.state.descriptionExpanded ? "expanded" : ""}`, viewBox: "0 0 24 24", width: "16", height: "16"},
              h("path", {d: "M7 10l5 5 5-5z"})
            )
            )
          )
        ),

        // Controls on the right
        h("div", {className: "enhanced-option-controls"},
          // Configuration input (for configurable rules)
          this.renderConfigInput(),

          // Severity selector
          this.severity && h("select", {
            className: `severity-select severity-${this.severity}`,
            value: this.severity,
            onChange: (e) => {
              const newSeverity = e.target.value;
              this.severity = newSeverity;
              this.setState({}); // Force re-render
              if (this.props.onSeverityChange) {
                this.props.onSeverityChange(this.key, newSeverity);
              }
            }
          },
          h("option", {value: "info"}, "Info"),
          h("option", {value: "warning"}, "Warning"),
          h("option", {value: "error"}, "Error")
          ),

          // Toggle control for all enhanced options (positioned at the end)
          isToggle && h("div", {className: "slds-form-element__control"},
            h("label", {className: "slds-checkbox_toggle slds-grid"},
              h("input", {type: "checkbox", required: true, id, "aria-describedby": id, className: "slds-input", checked: this.state[this.key || "checked"], onChange: this.onChangeToggle}),
              h("span", {id, className: "slds-checkbox_faux_container center-label"},
                h("span", {className: "slds-checkbox_faux"}),
                h("span", {className: "slds-checkbox_on"}, "Enabled"),
                h("span", {className: "slds-checkbox_off"}, "Disabled"),
              )
            )
          ),

          // Input controls for non-toggle types
          !isToggle && this.renderInputControl(id, true)
        )
      );
    } else {
      // Standard layout
      return h("div", {className: "slds-grid slds-border_bottom slds-p-horizontal_small slds-p-vertical_xx-small"},
        h("div", {className: "slds-col slds-size_3-of-12 text-align-middle"},
          h("span", {}, this.title,
            h(Tooltip, {tooltip: this.tooltip, idKey: this.key || `option_${this.title || "unnamed"}`})
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
        !isToggle ? this.renderInputControl(id, false)
        : (h("div", {className: "slds-col slds-size_7-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"}),
        this.renderInputControl(id, false))
      );
    }
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
          h(Tooltip, {tooltip: this.tooltip, idKey: this.key || "favicon_option"})
        )
      ),
      h("div", {className: "slds-col slds-size_4-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {className: "slds-form-element__control slds-col slds-size_10-of-12"},
          h("input", {type: "text", className: "slds-input", placeholder: "All HTML Color Names, Hex code or external URL", value: nullToEmptyString(this.state.favicon), onChange: this.onChangeFavicon}),
        ),
        h("div", {className: "slds-form-element__control slds-col slds-size_2-of-12"},
          this.state.isInternal ? h("svg", {className: "icon"},
            h("circle", {r: "12", cx: "12", cy: "12", fill: this.state.favicon})
          ) : null
        )
      ),
      h("div", {className: "slds-col slds-size_2-of-12 slds-form-element slds-grid slds-grid_align-end slds-grid_vertical-align-center slds-gutters_small"},
        h("div", {dir: "rtl", className: "slds-form-element__control slds-col slds-size_6-of-12"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("input", {type: "checkbox", required: true, className: "slds-input", checked: this.state.smartMode, onChange: this.onToogleSmartMode}),
            h("span", {className: "slds-checkbox_faux_container center-label"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on", title: "Use favicon based on org name (DEV : blue, UAT :green ..)"}, "Smart"),
              h("span", {className: "slds-checkbox_off", title: "Use random favicon"}, "Random"),
            )
          )
        ),
        h("div", {className: "slds-form-element__control slds-col slds-size_6-of-12"},
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

class FlowScannerRules extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      rules: [],
      loading: true,
      resetCounter: 0
    };
    this.loadRules = this.loadRules.bind(this);
    this.onRuleChange = this.onRuleChange.bind(this);
  }

  componentDidMount() {
    this.loadRules();
    // Set up reference for parent component interaction
    if (this.props.model) {
      this.props.model.flowScannerRulesRef = this;
    }
  }

  // Methods for external control by action buttons
  setAllRulesChecked(checked) {
    const updatedRules = this.state.rules.map(rule => ({...rule, checked}));
    this.setState({
      rules: updatedRules,
      resetCounter: this.state.resetCounter + 1
    });
    localStorage.setItem("flowScannerRules", JSON.stringify(updatedRules));
  }

  checkAllRules() {
    this.setAllRulesChecked(true);
  }

  uncheckAllRules() {
    this.setAllRulesChecked(false);
  }

  resetToDefaults() {
    // Remove stored rules to force reload with defaults
    localStorage.removeItem("flowScannerRules");

    // Increment reset counter to force component recreation
    this.setState(prevState => ({
      resetCounter: prevState.resetCounter + 1
    }));

    this.loadRules();
  }

  async loadRules() {
    try {
      // Try to load the actual flow-scanner-core if available
      let flowScannerCore = null;

      if (typeof lightningflowscanner !== "undefined") {
        flowScannerCore = lightningflowscanner;
        const rules = getFlowScannerRules(flowScannerCore);
        this.setState({rules, loading: false});
      } else {
        // No flow scanner core available
        this.setState({rules: [], loading: false});
      }
    } catch (error) {
      console.error("Error loading Flow Scanner rules:", error);
      this.setState({rules: [], loading: false});
    }
  }

  onRuleChange(ruleName, field, value) {
    const updatedRules = this.state.rules.map(rule => {
      if (rule.name === ruleName) {
        if (field === "checked") {
          return {...rule, checked: value};
        } else if (field === "severity") {
          return {...rule, severity: value};
        } else if (field === "config") {
          // Update the main config object for the scanner, and configValue for the UI
          const newConfig = rule.configType ? {[rule.configType]: value} : {};
          return {...rule, config: newConfig, configValue: value};
        }
      }
      return rule;
    });

    this.setState({rules: updatedRules});

    // Save to localStorage
    localStorage.setItem("flowScannerRules", JSON.stringify(updatedRules));
  }

  render() {
    const {rules, loading} = this.state;

    if (loading) {
      return h("div", {className: "slds-text-align_center slds-p-vertical_large"},
        h("div", {className: "slds-spinner slds-spinner_medium"},
          h("div", {className: "slds-spinner__dot-a"}),
          h("div", {className: "slds-spinner__dot-b"})
        ),
        h("p", {className: "slds-m-top_small"}, "Loading Flow Scanner rules...")
      );
    }

    if (rules.length === 0) {
      return h("div", {className: "slds-text-align_center slds-p-vertical_large"},
        h("p", {}, "No Flow Scanner rules available. Please ensure the Flow Scanner core library is loaded.")
      );
    }

    return h("div", {className: "flow-scanner-rules-container"},
      rules
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(rule => {
        // Determine badge
          let badge = null;
          if (rule.isBeta) {
            badge = {label: "Beta", type: "beta"};
          }

          // Resolve config value from rule object
          let resolvedConfigValue = null;
          if (rule.isConfigurable) {
            if (rule.configValue !== undefined && rule.configValue !== null) {
              resolvedConfigValue = rule.configValue;
            } else if (rule.defaultValue !== undefined && rule.defaultValue !== null) {
              resolvedConfigValue = rule.defaultValue;
            } else if (rule.config !== undefined && rule.config !== null) {
              // Extract the specific config value based on configType
              if (rule.configType === "expression" && rule.config.expression !== undefined) {
                resolvedConfigValue = rule.config.expression;
              } else if (rule.configType === "threshold" && rule.config.threshold !== undefined) {
                resolvedConfigValue = rule.config.threshold;
              } else {
                // Fallback to the entire config object (shouldn't happen with well-formed rules)
                resolvedConfigValue = rule.config;
              }
            }
          }

          // Create enhanced option props
          const optionProps = {
            type: "toggle",
            enhancedTitle: rule.label,
            badge,
            severity: rule.severity || "info",
            description: rule.description,
            // No storageKey - managed by FlowScannerRules component
            key: `flowScannerRule_${rule.name}_${this.state.resetCounter}`,
            checked: rule.checked !== undefined ? rule.checked : true,
            // Rule configuration properties
            isConfigurable: rule.isConfigurable,
            configType: rule.configType,
            configValue: resolvedConfigValue,
            onToggleChange: (checked) => {
              this.onRuleChange(rule.name, "checked", checked);
            },
            onSeverityChange: (key, newSeverity) => {
              this.onRuleChange(rule.name, "severity", newSeverity);
            },
            onConfigChange: (key, newConfig) => {
              this.onRuleChange(rule.name, "config", newConfig);
            }
          };

          return h(Option, optionProps);
        })
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

  exportOptions(filterKeys = null) {
    let localStorageData;
    let filename = "reloadedConfiguration.json";

    if (filterKeys) {
      // Filter only the specified keys
      localStorageData = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && filterKeys.some(filter => key.startsWith(filter))) {
          localStorageData[key] = localStorage.getItem(key);
        }
      }
      filename = "flowScannerRules.json";
    } else {
      // Export all localStorage
      localStorageData = {...localStorage};
    }

    const jsonData = JSON.stringify(localStorageData, null, 2);
    const blob = new Blob([jsonData], {type: "application/json"});
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  importOptions(filterKeys = null) {
    const fileInput = this.refs.fileInput;

    if (!fileInput.files.length) {
      console.error("No file selected.");
      return;
    }

    // Check if we have pending import filters (from Import Rules button)
    if (this.pendingImportFilters) {
      filterKeys = this.pendingImportFilters;
      this.pendingImportFilters = null; // Clear the flag
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);

        for (const [key, value] of Object.entries(importedData)) {
          if (filterKeys) {
            // Only import keys that match the filter
            if (filterKeys.some(filter => key.startsWith(filter))) {
              localStorage.setItem(key, value);
            }
          } else {
            // Import all keys
            localStorage.setItem(key, value);
          }
        }

        // Force refresh of Flow Scanner rules if they exist
        const {model} = this.props;
        if (filterKeys && model && model.flowScannerRulesRef) {
          // Force component re-creation by incrementing reset counter
          model.flowScannerRulesRef.setState(prevState => ({
            resetCounter: prevState.resetCounter + 1
          }));
          // Reload rules from localStorage (which now has the imported data)
          model.flowScannerRulesRef.loadRules();
          // Force a re-render of the parent model
          model.didUpdate();
        }

        this.setState({
          showToast: true,
          toastMessage: filterKeys ? "Flow Scanner rules imported successfully!" : "Options Imported Successfully!",
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
        h(OptionsTabSelector, {model, appRef: this})
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
