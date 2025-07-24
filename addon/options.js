/* eslint-disable */
/* global React ReactDOM */
import {sfConn, apiVersion, defaultApiVersion} from "./inspector.js";
import {nullToEmptyString, getLatestApiVersionFromOrg, Constants} from "./utils.js";
/* global initButton */
import {DescribeInfo} from "./data-load.js";
import Toast from "./components/Toast.js";

const normalizeSeverity = (sev, direction = "ui") => {
  if (direction === "ui") return sev === "note" ? "info" : sev;
  if (direction === "storage") return sev === "info" ? "note" : sev;
  return sev;
};

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

  /**
   * Notify other parts of the extension that options have changed.
   */
  notifyChange() {
    chrome.runtime.sendMessage({action: "optionsChanged", sfHost: this.sfHost});
  }

}

// New SLDS-based components

function SectionHeader({title}) {
  return h("h3", {className: "slds-text-title_caps"}, title);
}

function SectionDivider() {
  return h("div", {className: "slds-section__divider slds-m-vertical_medium"});
}

class ToggleSwitch extends React.Component {
  render() {
    const {id, checked, onChange} = this.props;
    return h("div", {className: "slds-checkbox_toggle slds-grid"},
      h("input", {
        type: "checkbox",
        id,
        "aria-describedby": id,
        checked,
        onChange
      }),
      h("label", {className: "slds-checkbox_faux_container", htmlFor: id},
        h("span", {className: "slds-checkbox_faux"}),
        h("span", {className: "slds-checkbox_on"}, "Enabled"),
        h("span", {className: "slds-checkbox_off"}, "Disabled")
      )
    );
  }
}

class OptionRow extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.onChangeToggle = this.onChangeToggle.bind(this);
    this.storageKey = props.storageKey;
    this.type = props.type;
    let value = localStorage.getItem(this.storageKey);
    if (props.default !== undefined && value === null) {
      value = props.type !== "text" ? JSON.stringify(props.default) : props.default;
      localStorage.setItem(this.storageKey, value);
    }
    this.state = {
      value: this.type === "toggle" ? !!JSON.parse(value) : (value || props.default || (props.type === "select" ? props.options?.[0]?.value : ""))
    };
  }

  onChangeToggle(e) {
    const enabled = e.target.checked;
    this.setState({value: enabled});
    localStorage.setItem(this.storageKey, JSON.stringify(enabled));
    this.props.model.notifyChange();
  }

  onChange(e) {
    let inputValue = e.target.value;
    this.setState({value: inputValue});
    localStorage.setItem(this.storageKey, inputValue);
    this.props.model.notifyChange();
  }

  render() {
    const {storageKey, label, tooltip, type, placeholder, options, model, actionButton} = this.props;
    const {value} = this.state;
    const id = `option-${storageKey}`;

    let control;
    switch (type) {
      case "toggle":
        control = h(ToggleSwitch, {id, checked: value, onChange: this.onChangeToggle});
        break;
      case "text":
      case "number":
        control = h("input", {
          type,
          id,
          className: "slds-input",
          placeholder,
          value: nullToEmptyString(value),
          onChange: this.onChange
        });
        break;
      case "textarea":
        control = h("textarea", {
          id,
          className: "slds-textarea",
          placeholder,
          value: nullToEmptyString(value),
          onChange: this.onChange
        });
        break;
      case "select":
        control = h("div", {className: "slds-select_container"},
          h("select", {
            className: "slds-select",
            value,
            onChange: this.onChange
          },
          options.map(opt =>
            h("option", {key: opt.value, value: opt.value}, opt.label)
          ))
        );
        break;
      default:
        control = null;
    }

    let controlWithButton;
    if (actionButton) {
      controlWithButton = h("div", {className: "slds-grid slds-gutters_small"},
        h("div", {className: "slds-col"}, control),
        h("div", {className: "slds-col slds-shrink-none"},
          h("button", {
            type: "button",
            className: "slds-button slds-button_neutral",
            onClick: (e) => actionButton.onClick(e, model),
            title: actionButton.title
          }, actionButton.label)
        )
      );
    }

    return h("div", {className: "slds-form-element slds-form-element_horizontal slds-border_bottom slds-p-vertical_xx-small"},
      h(type === "toggle" ? "span" : "label",
        type === "toggle"
          ? {className: "slds-form-element__label slds-grid slds-grid_vertical-align-center"}
          : {className: "slds-form-element__label slds-grid slds-grid_vertical-align-center", htmlFor: id},
        label,
        tooltip && InfoIcon({tooltipId: `tooltip-${storageKey}`, tooltip})
      ),
      h("div", {className: "slds-form-element__control"},
        controlWithButton || control
      )
    );
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

    // Initialize rule checkboxes with fallback for when lightningflowscanner is not available
    let ruleCheckboxes = [];
    // Use scanner core defaults if available
    if (window.lightningflowscanner && typeof window.lightningflowscanner.getRules === "function") {
      try {
        ruleCheckboxes = window.lightningflowscanner.getRules().map(rule => ({
          label: rule.label || rule.name,
          name: rule.name,
          checked: true,
          configurable: rule.isConfigurable || false,
          configType: rule.configType || null,
          defaultValue: rule.defaultValue || null,
          severity: rule.defaultSeverity || rule.severity || "error",
          description: rule.description || "",
          config: rule.defaultValue ? {[rule.configType]: rule.defaultValue} : {}
        }));
      } catch (error) {
        console.warn("Error getting rules from lightningflowscanner:", error);
        // fallback to hardcoded below
      }
    }
    if (!ruleCheckboxes || ruleCheckboxes.length === 0) {
      // fallback to hardcoded
      ruleCheckboxes = [
        {label: "API Version", name: "APIVersion", checked: true, configurable: true, configType: "threshold", defaultValue: 50, severity: "error", description: "Checks if the flow API version meets the minimum required version"},
        {label: "Auto Layout", name: "AutoLayout", checked: true, configurable: false, severity: "error", description: "Recommends using Auto-Layout mode"},
        {label: "Copy API Name", name: "CopyAPIName", checked: true, configurable: false, severity: "error", description: "Detects copied elements with default API names"},
        {label: "Cyclomatic Complexity", name: "CyclomaticComplexity", checked: true, configurable: true, configType: "threshold", defaultValue: 25, severity: "error", description: "Warns when flow complexity is too high"},
        {label: "DML Statement in Loop", name: "DMLStatementInLoop", checked: true, configurable: false, severity: "error", description: "Identifies DML operations inside loops"},
        {label: "Duplicate DML Operation", name: "DuplicateDMLOperation", checked: true, configurable: false, severity: "error", description: "Detects potential duplicate DML operations"},
        {label: "Flow Description", name: "FlowDescription", checked: true, configurable: false, severity: "error", description: "Ensures flows have descriptions"},
        {label: "Flow Name", name: "FlowName", checked: true, configurable: true, configType: "expression", defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+", severity: "error", description: "Validates flow naming conventions"},
        {label: "Get Record All Fields", name: "GetRecordAllFields", checked: true, configurable: false, severity: "error", description: "Warns against using 'Get All Fields'"},
        {label: "Hardcoded ID", name: "HardcodedId", checked: true, configurable: false, severity: "error", description: "Detects hardcoded Salesforce IDs"},
        {label: "Hardcoded URL", name: "HardcodedUrl", checked: true, configurable: false, severity: "error", description: "Finds hardcoded URLs"},
        {label: "Inactive Flow", name: "InactiveFlow", checked: true, configurable: false, severity: "error", description: "Identifies inactive flows"},
        {label: "Missing Fault Path", name: "MissingFaultPath", checked: true, configurable: false, severity: "error", description: "Checks for missing error handling paths"},
        {label: "Missing Null Handler", name: "MissingNullHandler", checked: true, configurable: false, severity: "error", description: "Ensures Get Records have null handling"},
        {label: "Process Builder", name: "ProcessBuilder", checked: true, configurable: false, severity: "error", description: "Recommends migrating from Process Builder"},
        {label: "Recursive After Update", name: "RecursiveAfterUpdate", checked: true, configurable: false, severity: "error", description: "Warns about potential recursion"},
        {label: "Same Record Field Updates", name: "SameRecordFieldUpdates", checked: true, configurable: false, severity: "error", description: "Suggests before-save flows for updates"},
        {label: "SOQL Query in Loop", name: "SOQLQueryInLoop", checked: true, configurable: false, severity: "error", description: "Identifies SOQL queries inside loops"},
        {label: "Trigger Order", name: "TriggerOrder", checked: true, configurable: false, severity: "error", description: "Recommends setting trigger order"},
        {label: "Unconnected Element", name: "UnconnectedElement", checked: true, configurable: false, severity: "error", description: "Finds unused flow elements"},
        {label: "Unsafe Running Context", name: "UnsafeRunningContext", checked: true, configurable: false, severity: "error", description: "Warns about system mode flows"},
        {label: "Unused Variable", name: "UnusedVariable", checked: true, configurable: false, severity: "error", description: "Identifies unused variables"},
        {label: "Action Calls in Loop", name: "ActionCallsInLoop", checked: false, configurable: false, severity: "error", description: "Identifies action calls inside loops (Beta)"}
      ];
    }
    console.log("Flow Scanner ruleCheckboxes:", ruleCheckboxes);

    this.tabs = [
      {
        id: 1,
        tabTitle: "Tab1",
        title: "User Experience",
        sections: [
          {
            title: "General",
            options: [
              {component: ArrowButtonOption, props: {key: 1}},
              {component: OptionRow, props: {type: "toggle", label: "Flow Scrollability", storageKey: "scrollOnFlowBuilder"}},
              {component: OptionRow, props: {type: "toggle", label: "Inspect page - Show table borders", storageKey: "displayInspectTableBorders"}},
            ]
          },
          {
            title: "Navigation",
            options: [
              {component: OptionRow, props: {type: "toggle", label: "Always open links in a new tab", storageKey: "openLinksInNewTab", tooltip: "Enabling this option will prevent Lightning Navigation (faster loading) to be used"}},
              {component: OptionRow, props: {type: "toggle", label: "Open Permission Set / Permission Set Group summary from shortcuts", storageKey: "enablePermSetSummary"}},
              {component: OptionRow, props: {type: "toggle", label: "Enable Lightning Navigation", storageKey: "lightningNavigation", default: true, tooltip: "Enable faster navigation by using standard e.force:navigateToURL method"}},
            ]
          },
          {
            title: "Shortcuts",
            options: [
              {component: MultiCheckboxButtonGroup, props: {title: "Searchable metadata from Shortcut tab", storageKey: "metadataShortcutSearchOptions", checkboxes: [
                {label: "Flows", name: "flows", checked: true},
                {label: "Profiles", name: "profiles", checked: true},
                {label: "PermissionSets", name: "permissionSets", checked: true},
                {label: "Communities", name: "networks", checked: true},
                {label: "Apex Classes", name: "classes", checked: false}
              ]}},
              {component: MultiCheckboxButtonGroup, props: {title: "Default Popup Tab", storageKey: "defaultPopupTab", unique: true, checkboxes: [
                {label: "Object", name: "sobject", checked: true},
                {label: "Users", name: "users"},
                {label: "Shortcuts", name: "shortcuts"},
                {label: "Org", name: "org"}
              ]}},
            ]
          },
          {
            title: "Theme",
            options: [
              {component: OptionRow, props: {type: "toggle", label: "Popup Dark theme", storageKey: "popupDarkTheme"}},
              {component: FaviconOption, props: {key: this.sfHost + "_customFavicon", tooltip: "You may need to add this domain to CSP trusted domains to see the favicon in Salesforce."}},
              {component: OptionRow, props: {type: "toggle", label: "Use favicon color on sandbox banner", storageKey: "colorizeSandboxBanner"}},
              {component: OptionRow, props: {type: "toggle", label: "Highlight PROD (color from favicon)", storageKey: "colorizeProdBanner", tooltip: "Top border in extension pages and banner on Salesforce"}},
              {component: OptionRow, props: {type: "text", label: "PROD Banner text", storageKey: this.sfHost + "_prodBannerText", tooltip: "Text that will be displayed in the PROD banner (if enabled)", placeholder: "WARNING: THIS IS PRODUCTION"}},
            ]
          },
          {
            title: "Buttons",
            options: [
              {component: MultiCheckboxButtonGroup, props: {title: "Show buttons", storageKey: "hideButtonsOption", checkboxes: [
                {label: "New", name: "new", checked: true},
                {label: "Explore API", name: "explore-api", checked: true},
                {label: "Org Limits", name: "org-limits", checked: true},
                {label: "Options", name: "options", checked: true},
                {label: "Generate Access Token", name: "generate-token", checked: true}
              ]}},
            ]
          },
        ]
      },
      {
        id: 2,
        tabTitle: "Tab2",
        title: "API",
        sections: [
          {
            title: "API Configuration",
            options: [
              {component: APIVersionOption, props: {key: 1}},
              {component: OptionRow, props: {type: "text", label: "API Consumer Key", placeholder: "Consumer Key", storageKey: this.sfHost + "_clientId", actionButton: {label: "Delete Token", title: "Delete the connected app generated token", onClick: (e, model) => {localStorage.removeItem(model.sfHost + "_clientId"); e.target.disabled = true;}}}},
              {component: OptionRow, props: {type: "text", label: "Rest Header", placeholder: "Rest Header", storageKey: "createUpdateRestCalloutHeaders"}},
            ]
          }
        ]
      },
      {
        id: 3,
        tabTitle: "Tab3",
        title: "Data Export",
        sections: [
          {
            title: "Querying",
            options: [
              {component: OptionRow, props: {type: "text", label: "CSV Separator", storageKey: "csvSeparator", default: ",", maxLength: "1"}},
              {component: OptionRow, props: {type: "toggle", label: "Display Query Execution Time", storageKey: "displayQueryPerformance", default: true}},
              {component: OptionRow, props: {type: "toggle", label: "Show Local Time", storageKey: "showLocalTime", default: false}},
              {component: OptionRow, props: {type: "toggle", label: "Use SObject context on Data Export ", storageKey: "useSObjectContextOnDataImportLink", default: true}},
              {component: OptionRow, props: {type: "toggle", label: "Include formula fields from suggestion", storageKey: "includeFormulaFieldsFromExportAutocomplete", default: true}},
              {component: OptionRow, props: {type: "toggle", label: "Disable query input autofocus", storageKey: "disableQueryInputAutoFocus"}},
              {component: OptionRow, props: {type: "number", label: "Number of queries stored in the history", storageKey: "numberOfQueriesInHistory", default: 100}},
              {component: OptionRow, props: {type: "number", label: "Number of saved queries", storageKey: "numberOfQueriesSaved", default: 50}},
              {component: OptionRow, props: {type: "textarea", label: "Query Templates", storageKey: "queryTemplates", placeholder: "SELECT Id FROM// SELECT Id FROM WHERE//SELECT Id FROM WHERE IN//SELECT Id FROM WHERE LIKE//SELECT Id FROM ORDER BY//SELECT ID FROM MYTEST__c//SELECT ID WHERE"}},
              {component: OptionRow, props: {type: "toggle", label: "Enable Query Typo Fix", storageKey: "enableQueryTypoFix", default: false, tooltip: "Enable automation that removes typos from query input"}},
            ]
          },
          {
            title: "Agent",
            options: [
              {component: OptionRow, props: {type: "text", label: "Prompt Template Name", storageKey: this.sfHost + "_exportAgentForcePrompt", default: Constants.PromptTemplateSOQL, tooltip: "Developer name of the prompt template to use for SOQL query builder"}},
            ]
          },
          {
            title: "UI",
            options: [
              {component: MultiCheckboxButtonGroup, props: {title: "Show buttons", storageKey: "hideExportButtonsOption", checkboxes: [
                {label: "Delete Records", name: "delete", checked: true},
                {label: "Export Query", name: "export-query", checked: false},
                {label: "Agentforce", name: "export-agentforce", checked: false}
              ]}},
              {component: OptionRow, props: {type: "toggle", label: "Hide additional Object columns by default on Data Export", storageKey: "hideObjectNameColumnsDataExport", default: false}},
            ]
          }
        ]
      },
      {
        id: 4,
        tabTitle: "Tab4",
        title: "Data Import",
        sections: [
          {
            title: "Import Settings",
            options: [
              {component: OptionRow, props: {type: "text", label: "Default batch size", storageKey: "defaultBatchSize", placeholder: "200"}},
              {component: OptionRow, props: {type: "text", label: "Default thread size", storageKey: "defaultThreadSize", placeholder: "6"}},
              {component: OptionRow, props: {type: "toggle", label: "Grey Out Skipped Columns in Data Import", storageKey: "greyOutSkippedColumns", tooltip: "Control if skipped columns are greyed out or not in data import"}}
            ]
          }
        ]
      },
      {
        id: 5,
        tabTitle: "Tab5",
        title: "Field Creator",
        sections: [
          {
            title: "Naming Convention",
            options: [
              {component: OptionRow, props: {type: "select", label: "Field Naming Convention", storageKey: "fieldNamingConvention", default: "pascal", tooltip: "Controls how API names are auto-generated from field labels. PascalCase: 'My Field' -> 'MyField'. Underscores: 'My Field' -> 'My_Field'", options: [{label: "PascalCase", value: "pascal"}, {label: "Underscores", value: "underscore"}]}}
            ]
          }
        ]
      },
      {
        id: 6,
        tabTitle: "Tab6",
        title: "Enable Logs",
        sections: [
          {
            title: "Logging Configuration",
            options: [
              {component: enableLogsOption, props: {key: 1}}
            ]
          }
        ]
      },
      {
        id: 7,
        tabTitle: "Tab7",
        title: "Metadata",
        sections: [
          {
            title: "Metadata Retrieval",
            options: [
              {component: OptionRow, props: {type: "toggle", label: "Include managed packages metadata", storageKey: "includeManagedMetadata"}},
              {component: OptionRow, props: {type: "select", label: "Sort metadata components", storageKey: "sortMetadataBy", default: "fullName", options: [{label: "A-Z", value: "fullName"}, {label: "Last Modified Date DESC", value: "lastModifiedDate"}]}},
              {component: OptionRow, props: {type: "toggle", label: "Use legacy version", storageKey: "useLegacyDlMetadata", default: false}},
            ]
          }
        ]
      },
      {
        id: 8,
        tabTitle: "Tab8",
        title: "Flow Scanner",
        sections: [
          {
            title: "Enabled Rules" + (window.lightningflowscanner && window.lightningflowscanner.version ? ` (v${window.lightningflowscanner.version})` : ""),
            options: [
              {component: FlowScannerRulesOption, props: {checkboxes: ruleCheckboxes}}
            ]
          }
        ]
      },
      {
        id: 9,
        tabTitle: "Tab9",
        title: "Custom Shortcuts",
        content: [
          {component: CustomShortcuts, props: {}}
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
      this.tabs.map((tab) => h(OptionsContainer, {key: tab.id, id: tab.id, content: tab.content, sections: tab.sections, selectedTabId: this.state.selectedTabId, model: this.model}))
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

  render() {
    const {id, selectedTabId, content, sections, model} = this.props;
    const isVisible = selectedTabId === id;

    // Support both old (content) and new (sections) structure to avoid breaking Flow Scanner/Custom Shortcuts
    const itemsToRender = sections
      ? sections.map((section, sectionIndex) =>
        h("div", {className: "section-group", key: `section-${sectionIndex}`},
          h("div", {className: "slds-grid slds-grid_vertical-align-start"},
            h("div", {className: "slds-col slds-size_1-of-12 slds-p-right_medium slds-p-top_xx-small"},
              section.title && h(SectionHeader, {title: section.title})
            ),
            h("div", {className: "slds-col slds-size_11-of-12"},
              section.options.map((c, optionIndex) =>
                h(c.component, {
                  key: c.props?.storageKey || c.props?.key || `component-${optionIndex}`,
                  ...c.props,
                  model
                })
              )
            )
          )
        )
      )
      : content.map((c, index) =>
        h(c.component, {
          key: c.props?.storageKey || c.props?.key || `component-${index}`,
          ...c.props,
          model
        })
      );

    return h("div", {
      id,
      key: id,
      className: "slds-tabs_default__content " + (isVisible ? "slds-show" : " slds-hide"),
      role: "tabpanel"
    },
    h("form", {className: (content ? "" : "slds-form_horizontal") + " slds-p-around_medium"},
      itemsToRender
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
    this.props.model.notifyChange();
  }

  onChangeArrowPosition(e) {
    let position = e.target.value;
    this.setState({arrowButtonPosition: position});
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      localStorage.setItem("popupArrowPosition", position);
      this.props.model.notifyChange();
    }, 1000);
  }

  render() {
    return h("div", {className: "slds-form-element slds-form-element_horizontal slds-border_bottom slds-p-vertical_xx-small"},
      h("label", {className: "slds-form-element__label"}, "Popup arrow button orientation and position"),
      h("div", {className: "slds-form-element__control"},
        h("div", {className: "slds-grid slds-gutters_small"},
          h("div", {className: "slds-col"},
            h("div", {className: "slds-select_container"},
              h("select", {className: "slds-select", value: this.state.arrowButtonOrientation, onChange: this.onChangeArrowOrientation},
                h("option", {value: "horizontal"}, "Horizontal"),
                h("option", {value: "vertical"}, "Vertical")
              )
            )
          ),
          h("div", {className: "slds-col"},
            h("div", {className: "slds-slider"},
              h("input", {type: "range", id: "arrowPositionSlider", className: "slds-slider__range", value: nullToEmptyString(this.state.arrowButtonPosition), min: "0", max: "100", step: "1", onChange: this.onChangeArrowPosition}),
              h("span", {className: "slds-slider__value", "aria-hidden": true}, this.state.arrowButtonPosition)
            )
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
    return h("div", {className: "slds-form-element slds-form-element_horizontal slds-border_bottom slds-p-vertical_xx-small"},
      h("label", {className: "slds-form-element__label", htmlFor: "api-version-input"},
        "API Version",
        InfoIcon({tooltipId: "tooltip-APIVersion", tooltip: "Update api version"})
      ),
      h("div", {className: "slds-form-element__control"},
        h("div", {className: "slds-grid slds-gutters_small"},
          h("div", {className: "slds-col"},
            h("input", {type: "number", id: "api-version-input", required: true, className: "slds-input", value: nullToEmptyString(this.state.apiVersion.split(".0")[0]), onChange: this.onChangeApiVersion})
          ),
          this.state.apiVersion !== defaultApiVersion && h("div", {className: "slds-col slds-shrink-none"},
            h("button", {type: "button", className: "slds-button slds-button_neutral", onClick: this.onRestoreDefaultApiVersion, title: "Restore Extension's default version"}, "Restore Default")
          )
        )
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
    // Load smartMode from localStorage or default to true
    let smartMode = localStorage.getItem("smartMode") !== null 
      ? JSON.parse(localStorage.getItem("smartMode")) 
      : true;
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
    let isInternal = favicon.length > 0 && !favicon.startsWith("http");
    this.setState({favicon, isInternal});
    localStorage.setItem(this.sfHost + "_customFavicon", favicon);
    this.props.model.notifyChange();
  }

  onToogleSmartMode(e) {
    let smartMode = e.target.checked;
    this.setState({smartMode});
    localStorage.setItem("smartMode", JSON.stringify(smartMode));
    this.props.model.notifyChange();
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
    this.props.model.notifyChange();
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
    return h("div", {className: "slds-form-element slds-form-element_horizontal slds-border_bottom slds-p-vertical_xx-small"},
      h("label", {className: "slds-form-element__label", htmlFor: "favicon-input"},
        "Custom favicon (org specific)",
        InfoIcon({tooltipId: `tooltip-${this.key}`, tooltip: this.tooltip})
      ),
      h("div", {className: "slds-form-element__control"},
        h("div", {className: "slds-grid slds-gutters_small"},
          h("div", {className: "slds-col slds-grow"},
            h("input", {type: "text", id: "favicon-input", className: "slds-input", placeholder: "All HTML Color Names, Hex code or external URL", value: nullToEmptyString(this.state.favicon), onChange: this.onChangeFavicon}),
          ),
          this.state.isInternal && h("div", {className: "slds-col"},
            h("svg", {className: "icon"},
              h("circle", {r: "12", cx: "12", cy: "12", fill: this.state.favicon})
            )
          ),
          h("div", {className: "slds-col slds-shrink-none"},
            h("label", {className: "slds-checkbox_toggle slds-grid"},
              h("input", {type: "checkbox", className: "slds-input", checked: this.state.smartMode, onChange: this.onToogleSmartMode}),
              h("span", {className: "slds-checkbox_faux_container center-label"},
                h("span", {className: "slds-checkbox_faux"}),
                h("span", {className: "slds-checkbox_on", title: "Use favicon based on org name (DEV : blue, UAT :green ..)"}, "Smart"),
                h("span", {className: "slds-checkbox_off", title: "Use random favicon"}, "Random"),
              )
            )
          ),
          h("div", {className: "slds-col slds-shrink-none"},
            h("button", {type: "button", className: "slds-button slds-button_neutral", onClick: this.populateFaviconColors, title: "Use favicon for all orgs I've visited"}, "Populate All")
          )
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
    this.storageKey = props.storageKey;
    this.unique = props.unique || false;

    // Load checkboxes from localStorage or default to props.checkboxes
    const storedCheckboxes = localStorage.getItem(this.storageKey) ? JSON.parse(localStorage.getItem(this.storageKey)) : [];

    // Merge checkboxes only if the size is different
    const mergedCheckboxes = storedCheckboxes.length === props.checkboxes.length
      ? storedCheckboxes
      : this.mergeCheckboxes(storedCheckboxes, props.checkboxes);

    this.state = {checkboxes: mergedCheckboxes};
    if (storedCheckboxes.length !== props.checkboxes.length) {
      localStorage.setItem(this.storageKey, JSON.stringify(mergedCheckboxes)); // Save the merged state to localStorage
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

    localStorage.setItem(this.storageKey, JSON.stringify(updatedCheckboxes));
    this.setState({checkboxes: updatedCheckboxes});
  };

  render() {
    return h("div", {className: "slds-form-element slds-form-element_horizontal slds-border_bottom slds-p-vertical_xx-small"},
      h("label", {className: "slds-form-element__label"}, this.title),
      h("div", {className: "slds-form-element__control"},
        h("div", {className: "slds-checkbox_button-group"},
          this.state.checkboxes.map((checkbox, index) =>
            h("span", {className: "slds-button slds-checkbox_button", key: this.storageKey + index},
              h("input", {type: "checkbox", id: `${this.storageKey}-${checkbox.name}-${index}`, name: checkbox.name, checked: checkbox.checked, onChange: this.handleCheckboxChange, title: checkbox.title, value: checkbox.name}),
              h("label", {className: "slds-checkbox_button__label", htmlFor: `${this.storageKey}-${checkbox.name}-${index}`},
                h("span", {className: "slds-checkbox_faux"}, checkbox.label)
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
  }
  render() {
    return h("div", null,
      h(OptionRow, {
        type: "text",
        label: "Debug Level (DeveloperName)",
        storageKey: this.sfHost + "_debugLogDebugLevel",
        default: "SFDC_DevConsole",
        model: this.props.model
      }),
      h(OptionRow, {
        type: "number",
        label: "Debug Log Time (Minutes)",
        storageKey: "debugLogTimeMinutes",
        default: "15",
        model: this.props.model
      })
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
                    type: "button",
                    className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-right_x-small",
                    onClick: this.onSaveShortcut,
                    title: "Save"
                  }, h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#check"})
                  )),
                  h("button", {
                    type: "button",
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
                    type: "button",
                    className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-right_x-small",
                    onClick: () => this.onEditShortcut(index),
                    title: "Edit"
                  }, h("svg", {className: "slds-button__icon"},
                    h("use", {xlinkHref: "symbols.svg#edit"})
                  )),
                  h("button", {
                    type: "button",
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
            type: "button",
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

    this.title = props.title;
    this.key = props.key || "flowScannerRules";

    // Migrate old configuration format to new format
    this.migrateConfiguration();

    const storedRaw = localStorage.getItem(this.key);
    let stored;
    try {
      stored = JSON.parse(storedRaw || "[]");
    } catch (e) {
      console.warn("Failed to parse flowScannerRules, resetting", e);
      stored = [];
    }

    if (!Array.isArray(stored)) {
      if (stored && typeof stored === "object") {
        stored = Object.entries(stored).map(([name, checked]) => ({name, checked: !!checked}));
      } else {
        stored = [];
      }
    }

    const updatedRules = this.mergeRules(stored, props.checkboxes);
    this.state = {rules: updatedRules};
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
          // Migrate APIVersion from old format to new format
          const expressionValue = rule.config.expression;
          let thresholdValue = 50; // default

          if (typeof expressionValue === "string") {
            if (expressionValue.includes("<")) {
              // Old format: "<50" -> extract 50
              thresholdValue = parseInt(expressionValue.replace(/[<>]/g, "")) || 50;
            } else {
              // New format: "65" -> use 65
              thresholdValue = parseInt(expressionValue) || 50;
            }
          }

          needsUpdate = true;
          return {
            ...rule,
            configType: "threshold",
            config: {threshold: thresholdValue}
          };
        }
        return rule;
      });

      if (needsUpdate) {
        console.log("Migrating APIVersion configuration from old format to new format");
        localStorage.setItem(this.key, JSON.stringify(migrated));
      }
    } catch (e) {
      console.warn("Failed to migrate configuration:", e);
    }
  }

  mergeRules(storedRules, defaultRules) {
    // Define known configurable rules that should always have config fields
    const knownConfigurableRules = {
      "APIVersion": {configType: "threshold", defaultValue: 50},
      "FlowName": {configType: "expression", defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+"},
      "CyclomaticComplexity": {configType: "threshold", defaultValue: 25},
      "AutoLayout": {configType: "enabled", defaultValue: true},
      "ProcessBuilder": {configType: "enabled", defaultValue: true}
    };

    const merged = [];
    for (const defaultRule of defaultRules) {
      const storedRule = storedRules.find(r => r.name === defaultRule.name);
      const knownConfig = knownConfigurableRules[defaultRule.name];

      // Handle configuration migration for APIVersion rule
      let config = {};
      let configType = defaultRule.configType;
      let configurable = defaultRule.configurable;

      if (storedRule && storedRule.config) {
        if (defaultRule.name === "APIVersion") {
          // Migrate APIVersion from old format to new format
          if (storedRule.configType === "expression" && storedRule.config.expression) {
            // Old format: convert expression to threshold
            const expressionValue = storedRule.config.expression;
            let thresholdValue = 50; // default

            if (typeof expressionValue === "string") {
              if (expressionValue.includes("<")) {
                // Old format: "<50" -> extract 50
                thresholdValue = parseInt(expressionValue.replace(/[<>]/g, "")) || 50;
              } else {
                // New format: "65" -> use 65
                thresholdValue = parseInt(expressionValue) || 50;
              }
            }

            config = {threshold: thresholdValue};
            configType = "threshold";
          } else {
            // New format: use threshold directly
            config = storedRule.config;
          }
        } else {
          // Other rules: use stored config as is
          config = storedRule.config;
        }
      } else if (knownConfig) {
        // Known configurable rule without stored config: use default
        config = {[knownConfig.configType]: knownConfig.defaultValue};
        configType = knownConfig.configType;
        configurable = true;
      } else if (defaultRule.defaultValue) {
        // Use default configuration
        config = {[defaultRule.configType]: defaultRule.defaultValue};
      }

      // Ensure known configurable rules are always marked as configurable
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
        severity: storedRule ? storedRule.severity || defaultRule.severity : defaultRule.severity
      });
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
    const updatedRules = this.state.rules.map(rule => {
      if (rule.name === ruleName) {
        return {...rule, checked: !rule.checked};
      }
      return rule;
    });

    this.setState({rules: updatedRules});
    localStorage.setItem(this.key, JSON.stringify(updatedRules));
  }

  handleConfigChange(ruleName, configKey, value) {
    const updatedRules = this.state.rules.map(rule => {
      if (rule.name === ruleName) {
        const updatedConfig = {...rule.config, [configKey]: value};
        return {...rule, config: updatedConfig};
      }
      return rule;
    });

    this.setState({rules: updatedRules});
    localStorage.setItem(this.key, JSON.stringify(updatedRules));
  }

  handleCheckAll() {
    const updatedRules = this.state.rules.map(rule => ({...rule, checked: true}));
    this.setState({rules: updatedRules});
    localStorage.setItem(this.key, JSON.stringify(updatedRules));
  }

  handleUncheckAll() {
    const updatedRules = this.state.rules.map(rule => ({...rule, checked: false}));
    this.setState({rules: updatedRules});
    localStorage.setItem(this.key, JSON.stringify(updatedRules));
  }

  handleResetToDefaults() {
    // Re-fetch ruleCheckboxes from scanner core if available
    let defaultRules = [];
    if (window.lightningflowscanner && typeof window.lightningflowscanner.getRules === "function") {
      try {
        defaultRules = window.lightningflowscanner.getRules().map(rule => ({
          label: rule.label || rule.name,
          name: rule.name,
          checked: true,
          configurable: rule.isConfigurable || false,
          configType: rule.configType || null,
          defaultValue: rule.defaultValue || null,
          severity: rule.defaultSeverity || rule.severity || "error",
          description: rule.description || "",
          config: rule.defaultValue ? {[rule.configType]: rule.defaultValue} : {}
        }));
      } catch (error) {
        console.warn("Failed to get rules from scanner core, using fallback:", error);
        defaultRules = ruleCheckboxes;
      }
    } else {
      defaultRules = ruleCheckboxes;
    }

    // Ensure known configurable rules always have their config fields
    const knownConfigurableRules = {
      "APIVersion": {configType: "threshold", defaultValue: 50},
      "FlowName": {configType: "expression", defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+"},
      "CyclomaticComplexity": {configType: "threshold", defaultValue: 25},
      "AutoLayout": {configType: "enabled", defaultValue: true},
      "ProcessBuilder": {configType: "enabled", defaultValue: true}
    };

    // Merge with known configurable rules to ensure config fields are always present
    defaultRules = defaultRules.map(rule => {
      const knownConfig = knownConfigurableRules[rule.name];
      if (knownConfig) {
        return {
          ...rule,
          configurable: true,
          configType: rule.configType || knownConfig.configType,
          defaultValue: rule.defaultValue || knownConfig.defaultValue,
          config: rule.config || (knownConfig.defaultValue ? {[knownConfig.configType]: knownConfig.defaultValue} : {})
        };
      }
      return rule;
    });

    const updatedRules = this.mergeRules([], defaultRules); // no stored, just defaults
    this.setState({rules: updatedRules});
    localStorage.setItem(this.key, JSON.stringify(updatedRules));
  }

  handleSeverityChange(ruleName, value) {
    const updatedRules = this.state.rules.map(rule => {
      if (rule.name === ruleName) {
        return {...rule, severity: value};
      }
      return rule;
    });
    this.setState({rules: updatedRules});
    localStorage.setItem(this.key, JSON.stringify(updatedRules));
  }

  renderConfigInput(rule) {
    if (!rule.configurable) return null;

    const configValue = rule.config[rule.configType] || rule.defaultValue || "";

    if (rule.configType === "expression") {
      return h("div", {className: "rule-config-right"},
        h("input", {
          type: "text",
          className: "slds-input slds-input_small",
          value: configValue,
          onChange: (e) => this.handleConfigChange(rule.name, rule.configType, e.target.value),
          placeholder: rule.defaultValue || "",
          title: `Configuration for ${rule.label}`,
          "aria-label": `${rule.label} configuration`
        }),
        InfoIcon({
          tooltipId: `config-help-${rule.name}`,
          tooltip: h("span", {},
            `Configuration for ${rule.label}. `,
            rule.configType === "expression" ? h("a", {href: "https://regex101.com/", target: "_blank", rel: "noopener noreferrer"}, "Regex help") : ""
          ),
          className: "config-help slds-m-left_xx-small",
          placement: "right"
        })
      );
    }

    if (rule.configType === "threshold") {
      return h("div", {className: "rule-config-right"},
        h("input", {
          type: "number",
          className: "slds-input slds-input_small",
          value: configValue,
          onChange: (e) => this.handleConfigChange(rule.name, rule.configType, parseInt(e.target.value) || rule.defaultValue),
          min: rule.name === "APIVersion" ? "1" : "1",
          max: rule.name === "APIVersion" ? "100" : "100",
          title: `Threshold for ${rule.label}`,
          "aria-label": `${rule.label} threshold`
        }),
        InfoIcon({
          tooltipId: `config-help-${rule.name}`,
          tooltip: rule.name === "APIVersion"
            ? `Minimum API version required for flows. Flows with lower API versions will trigger this rule.`
            : `Threshold value for ${rule.label}. Higher values are more permissive.`,
          className: "config-help slds-m-left_xx-small",
          placement: "right"
        })
      );
    }

    return null;
  }

  render() {
    const {title} = this.props;
    const {rules} = this.state;

    // Debug: Log rules to see which ones are configurable
    console.log("🔍 Flow Scanner Rules Debug:", {
      totalRules: rules.length,
      configurableRules: rules.filter(r => r.configurable).map(r => ({
        name: r.name,
        configurable: r.configurable,
        configType: r.configType,
        config: r.config,
        defaultValue: r.defaultValue
      })),
      apiversionRule: rules.find(r => r.name === "APIVersion")
    });

    return h("div", {className: "flow-scanner-rules"},
      h("div", {className: "flow-scanner-desc slds-grid slds-align_absolute-center"},
        "Configure which Flow Scanner rules are enabled and their settings. Only enabled rules will be used when scanning flows. ",
        InfoIcon({
          tooltipId: "section-help-tip",
          tooltip: "Flow Scanner analyzes Salesforce Flows for best practices, anti-patterns, and common mistakes. Toggle rules on or off and configure their settings as needed. For more information, see the documentation.",
          className: "section-help-icon slds-m-left_x-small",
          placement: "below"
        })
      ),
      h("div", {className: "rules-actions-toolbar", role: "toolbar", "aria-label": "Bulk actions"},
        h("button", {
          className: "button button-brand button-small rules-action-btn",
          type: "button",
          onClick: this.handleCheckAll,
          tabIndex: 0,
          "aria-label": "Enable all rules"
        }, "Check All"),
        h("button", {
          className: "button button-neutral button-small rules-action-btn",
          type: "button",
          onClick: this.handleUncheckAll,
          tabIndex: 0,
          "aria-label": "Disable all rules"
        }, "Uncheck All"),
        h("button", {
          className: "button button-neutral button-small rules-action-btn",
          type: "button",
          onClick: () => {
            if (window.confirm("Reset all Flow Scanner rules to defaults?")) this.handleResetToDefaults();
          },
          tabIndex: 0,
          "aria-label": "Reset rules to defaults"
        }, "Reset to Defaults")
      ),
      h("div", {className: "rules-container"},
        rules.map((rule, ruleIndex) =>
          h("div", {
            key: `rule-${rule.name || ruleIndex}`,
            className: "rule-row-horizontal" + (rule.configurable ? " rule-row-highlight" : ""),
            tabIndex: 0,
            "aria-label": `${rule.label}: ${rule.description}`
          },
          // Toggle
          h("div", {className: "rule-toggle-container"},
            h("label", {className: "slds-checkbox_toggle slds-grid"},
              h("input", {
                type: "checkbox",
                "aria-describedby": `desc-${rule.name}`,
                checked: rule.checked,
                onChange: () => this.handleRuleToggle(rule.name),
                tabIndex: 0
              }),
              h("span", {className: "slds-checkbox_faux_container", "aria-live": "assertive"},
                h("span", {className: "slds-checkbox_faux"}),
                h("span", {className: "slds-checkbox_on"}, "Enabled"),
                h("span", {className: "slds-checkbox_off"}, "Disabled")
              )
            )
          ),
          // Name and Description (left)
          h("div", {className: "rule-main-info"},
            h("div", {className: "rule-name-horizontal"},
              rule.label,
              rule.name === "ActionCallsInLoop" && h("span", {className: "beta-badge"}, "BETA")
            ),
            h("div", {
              className: "rule-description-horizontal",
              id: `desc-${rule.name}`,
              title: rule.description
            }, rule.description)
          ),
          // Config (right-aligned)
          h("div", {className: "rule-config-group"},
            this.renderConfigInput(rule),
            h("label", {htmlFor: `severity-${rule.name}`, className: "slds-form-element__label", style: {marginRight: 4}}, "Severity:"),
            h("select", {
              id: `severity-${rule.name}`,
              value: normalizeSeverity(rule.severity || "error", "ui"),
              onChange: (e) => this.handleSeverityChange(rule.name, normalizeSeverity(e.target.value, "storage")),
              className: `severity-select severity-${normalizeSeverity(rule.severity || "error", "ui")}`,
              style: {marginLeft: 2, minWidth: 80}
            },
            h("option", {value: "error"}, "Error"),
            h("option", {value: "warning"}, "Warning"),
            h("option", {value: "info"}, "Info")
            )
          )
          )
        )
      )
    );
  }
}

// Helper for SLDS info icon
function InfoIcon({tooltipId, tooltip, className = "", style = {}, tabIndex = 0, placement = ""}) {
  let tooltipClass = "info-tooltip slds-popover slds-popover_tooltip slds-nubbin_bottom";
  if (placement === "right") tooltipClass += " info-tooltip-right";
  if (placement === "below") tooltipClass = "info-tooltip slds-popover slds-popover_tooltip slds-nubbin_top info-tooltip-below";
  return h("span", {
    className: `info-icon-container section-help-icon slds-m-left_x-small ${className}`,
    tabIndex,
    role: "button",
    "aria-describedby": tooltipId,
    style,
    onMouseEnter: () => {
      const tip = document.getElementById(tooltipId);
      if (tip) tip.style.display = "block";
    },
    onMouseLeave: () => {
      const tip = document.getElementById(tooltipId);
      if (tip) tip.style.display = "none";
    },
    onFocus: () => {
      const tip = document.getElementById(tooltipId);
      if (tip) tip.style.display = "block";
    },
    onBlur: () => {
      const tip = document.getElementById(tooltipId);
      if (tip) tip.style.display = "none";
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

let h = React.createElement;

class OptionsPane extends React.Component {

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
    return h("div", {className: "slds-scope"},
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
        h(OptionsTabSelector, {model})
      )
    );
  }
}

// Initialize the application
{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {
    let root = document.getElementById("root");
    let model = new Model(sfHost);
    model.reactCallback = cb => {
      ReactDOM.render(h(OptionsPane, {model}), root, cb);
    };
    ReactDOM.render(h(OptionsPane, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model});
    }
  });
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
