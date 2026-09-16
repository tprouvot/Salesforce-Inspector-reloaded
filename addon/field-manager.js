/* global React ReactDOM field-manager.js */
import {sfConn, apiVersion} from "./inspector.js";
import {PageHeader} from "./components/PageHeader.js";
import Toast from "./components/Toast.js";
import ConfirmModal from "./components/ConfirmModal.js";
import {UserInfoModel, createSpinForMethod, getSobjectsList, Constants, applyProductionStyling, copyToClipboard} from "./utils.js";

let h = React.createElement;

const FIELD_TYPES = [
  "Checkbox", "Currency", "Date", "DateTime", "Email", "Location", "Number",
  "Percent", "Phone", "Picklist", "MultiselectPicklist", "Text", "TextArea",
  "LongTextArea", "Html", "Url"
];

// Types that can only be retrieved from an existing object, not created from scratch here —
// creating them requires info this tool doesn't collect (relationship target, summarized field,
// formula, etc). Editing only ever touches Label/Description/Help Text (see updateField), so
// that's safe to support for any type.
const RETRIEVE_ONLY_FIELD_TYPES = {
  AutoNumber: "Auto Number",
  Lookup: "Lookup",
  MasterDetail: "Master-Detail",
  Summary: "Roll-Up Summary",
  EncryptedText: "Text (Encrypted)",
  MetadataRelationship: "Metadata Relationship",
  ExternalLookup: "External Lookup",
  IndirectLookup: "Indirect Lookup",
  Hierarchy: "Hierarchy",
  Time: "Time"
};

function csvEscape(value, separator = ",") {
  const str = value === undefined || value === null ? "" : String(value);
  const needsQuoting = str.includes(separator) || str.includes("\"") || str.includes("\n");
  return needsQuoting ? `"${str.replace(/"/g, "\"\"")}"` : str;
}

// The Tooling API rejects writes where a Metadata sub-field is explicitly null
// ("Cannot deserialize instance of complexvalue from VALUE_NULL") for several
// compound/complex properties (e.g. formula, defaultValue, valueSet) — those
// properties must be entirely omitted from the payload rather than set to null.
function stripNulls(obj) {
  const result = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== null) {
      result[key] = obj[key];
    }
  });
  return result;
}

// Runs `fn` over `items` with at most `limit` requests in flight at once.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(new Array(Math.min(limit, items.length)).fill().map(worker));
  return results;
}

class ProfilesModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      allEditProfiles: false,
      allReadProfiles: false,
      allEditPermissionSets: false,
      allReadPermissionSets: false,
      isProfilesExpanded: false,
      isPermissionSetsExpanded: true,
      searchTerm: "",
      permissions: this.initializePermissions(props.field, props.permissionSets)
    };
  }

  handleSearchChange = (event) => {
    this.setState({searchTerm: event.target.value}, this.updateAllCheckboxes);
  };

  componentDidUpdate(prevProps) {
    if (prevProps.field !== this.props.field) {
      this.setState({
        permissions: this.initializePermissions(this.props.field, this.props.permissionSets)
      }, this.updateAllCheckboxes);
    }
  }

  initializePermissions(field, permissionSets) {
    const permissions = Object.keys(permissionSets).reduce((acc, name) => {
      acc[name] = {edit: false, read: false};
      return acc;
    }, {});

    if (field && field.profiles && Array.isArray(field.profiles)) {
      field.profiles.forEach(profile => {
        if (permissions[profile.name]) {
          permissions[profile.name] = {
            edit: profile.access === "edit",
            read: profile.access === "edit" || profile.access === "read"
          };
        }
      });
    }
    return permissions;
  }

  handlePermissionChange = (name, type) => {
    this.setState(prevState => ({
      permissions: {
        ...prevState.permissions,
        [name]: {
          ...prevState.permissions[name],
          [type]: !prevState.permissions[name][type],
          ...(type === "edit" && !prevState.permissions[name][type] === true ? {read: true} : {}),
          ...(type === "read" && !prevState.permissions[name][type] === false ? {edit: false} : {})
        }
      }
    }), this.updateAllCheckboxes);
  };

  handleSelectAll = (type, tableType) => {
    const stateKey = `all${type.charAt(0).toUpperCase() + type.slice(1)}${tableType}`;
    const allSelected = !this.state[stateKey];

    const filteredItems = this.getFilteredItems(tableType);

    this.setState(prevState => {
      const updatedPermissions = {...prevState.permissions};
      filteredItems.forEach(([name]) => {
        updatedPermissions[name] = {
          ...updatedPermissions[name],
          [type]: allSelected,
          ...(type === "edit" && allSelected === true ? {read: true} : {}),
          ...(type === "read" && allSelected === false ? {edit: false} : {})
        };
      });

      return {
        [stateKey]: allSelected,
        permissions: updatedPermissions
      };
    }, this.updateAllCheckboxes);
  };

  updateAllCheckboxes = () => {
    const {permissions} = this.state;

    const filteredProfiles = this.getFilteredItems("Profiles");
    const filteredPermissionSets = this.getFilteredItems("PermissionSets");

    const allEditProfiles = filteredProfiles.every(([name]) => permissions[name].edit);
    const allReadProfiles = filteredProfiles.every(([name]) => permissions[name].read);
    const allEditPermissionSets = filteredPermissionSets.every(([name]) => permissions[name].edit);
    const allReadPermissionSets = filteredPermissionSets.every(([name]) => permissions[name].read);

    this.setState({
      allEditProfiles,
      allReadProfiles,
      allEditPermissionSets,
      allReadPermissionSets
    });
  };

  getFilteredItems = (tableType) => {
    const {permissionSets} = this.props;
    const {searchTerm} = this.state;

    const items = Object.entries(permissionSets)
      .filter(([_, profile]) =>
        tableType === "Profiles" ? profile !== null : profile === null
      )
      .sort((a, b) =>
        tableType === "Profiles"
          ? a[1].localeCompare(b[1])
          : a[0].localeCompare(b[0])
      );

    return items.filter(([name, profile]) =>
      (profile || name).toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  applyToAllFields = () => {
    const {permissions} = this.state;
    this.props.onApplyToAllFields(permissions);
  };

  toggleSection = (section) => {
    const stateKey = `is${section.replace(" ", "")}Expanded`;
    this.setState(prevState => ({
      [stateKey]: !prevState[stateKey]
    }));
  };

  render() {
    const {field, permissionSets, onSave, onClose} = this.props;
    const {
      permissions,
      allEditProfiles,
      allReadProfiles,
      allEditPermissionSets,
      allReadPermissionSets,
      searchTerm,
    } = this.state;

    const filterItems = (items) => items.filter(([name, profile]) =>
      (profile || name).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const profiles = filterItems(Object.entries(permissionSets)
      .filter(([_, profile]) => profile !== null)
      .sort((a, b) => a[1].localeCompare(b[1])));

    const permissionSetsOnly = filterItems(Object.entries(permissionSets)
      .filter(([_, profile]) => profile === null)
      .sort((a, b) => a[0].localeCompare(b[0])));

    const renderTable = (items, title) => {
      const sectionKey = title.replace(" ", "");
      const isExpanded = this.state[`is${sectionKey}Expanded`];
      const allEditChecked = title === "Profiles" ? allEditProfiles : allEditPermissionSets;
      const allReadChecked = title === "Profiles" ? allReadProfiles : allReadPermissionSets;

      return h("div", {key: title, className: "slds-m-bottom_medium"},
        h("h3", {
          onClick: () => this.toggleSection(title),
          className: "slds-text-heading_small slds-grid slds-grid_vertical-align-center cursorPointer userSelectNone slds-m-bottom_x-small"
        },
        h("svg", {className: "slds-icon slds-icon_xx-small slds-m-right_x-small slds-icon-text-default", "aria-hidden": "true"},
          h("use", {xlinkHref: `symbols.svg#${isExpanded ? "chevrondown" : "chevronright"}`})
        ),
        `${title} (${items.length})`
        ),
        isExpanded && h("table", {className: "slds-table slds-table_bordered slds-table_striped slds-table_cell-buffer"},
          h("thead", null,
            h("tr", {className: "slds-line-height_reset"},
              h("th", {className: "slds-text-align_left", scope: "col"}, "Name"),
              h("th", {className: "slds-text-align_center", scope: "col"},
                h("div", {className: "slds-grid slds-grid_vertical-align-center slds-grid_align-center"},
                  h("span", {className: "slds-m-right_x-small"}, "Edit"),
                  h("div", {className: "slds-checkbox"},
                    h("input", {
                      type: "checkbox",
                      id: `selectAll-edit-${sectionKey}`,
                      checked: allEditChecked,
                      onChange: () => this.handleSelectAll("edit", sectionKey)
                    }),
                    h("label", {className: "slds-checkbox__label", htmlFor: `selectAll-edit-${sectionKey}`},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-assistive-text"}, `Select all Edit for ${title}`)
                    )
                  )
                )
              ),
              h("th", {className: "slds-text-align_center", scope: "col"},
                h("div", {className: "slds-grid slds-grid_vertical-align-center slds-grid_align-center"},
                  h("span", {className: "slds-m-right_x-small"}, "Read"),
                  h("div", {className: "slds-checkbox"},
                    h("input", {
                      type: "checkbox",
                      id: `selectAll-read-${sectionKey}`,
                      checked: allReadChecked,
                      onChange: () => this.handleSelectAll("read", sectionKey)
                    }),
                    h("label", {className: "slds-checkbox__label", htmlFor: `selectAll-read-${sectionKey}`},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-assistive-text"}, `Select all Read for ${title}`)
                    )
                  )
                )
              )
            )
          ),
          h("tbody", null,
            items.map(([name, profile]) =>
              h("tr", {key: name},
                h("td", null, profile || name),
                h("td", {className: "slds-text-align_center"},
                  h("div", {className: "slds-checkbox slds-checkbox_standalone"},
                    h("input", {
                      type: "checkbox",
                      id: `perm-edit-${sectionKey}-${name}`,
                      checked: permissions[name].edit,
                      onChange: () => this.handlePermissionChange(name, "edit")
                    }),
                    h("label", {className: "slds-checkbox__label", htmlFor: `perm-edit-${sectionKey}-${name}`},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-assistive-text"}, `Edit for ${profile || name}`)
                    )
                  )
                ),
                h("td", {className: "slds-text-align_center"},
                  h("div", {className: "slds-checkbox slds-checkbox_standalone"},
                    h("input", {
                      type: "checkbox",
                      id: `perm-read-${sectionKey}-${name}`,
                      checked: permissions[name].read,
                      onChange: () => this.handlePermissionChange(name, "read")
                    }),
                    h("label", {className: "slds-checkbox__label", htmlFor: `perm-read-${sectionKey}-${name}`},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-assistive-text"}, `Read for ${profile || name}`)
                    )
                  )
                )
              )
            )
          )
        )
      );
    };

    return h("div", {},
      h("section", {
        role: "dialog",
        tabIndex: -1,
        "aria-modal": "true",
        "aria-labelledby": "profiles-modal-heading",
        className: "slds-modal slds-fade-in-open slds-modal_large"
      },
      h("div", {className: "slds-modal__container"},
        h("div", {className: "slds-modal__header"},
          h("button", {
            className: "slds-button slds-button_icon slds-modal__close",
            "aria-label": "Close permission modal button",
            onClick: onClose
          },
          h("svg", {className: "slds-button__icon slds-button__icon_large", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#close"})
          ),
          h("span", {className: "slds-assistive-text"}, "Cancel and close")
          ),
          h("h1", {id: "profiles-modal-heading", className: "slds-modal__title slds-hyphenate"}, "Set Field Permissions")
        ),
        h("div", {className: "slds-modal__content slds-p-around_medium"},
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left"},
              h("svg", {className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default", "aria-hidden": "true"},
                h("use", {xlinkHref: "symbols.svg#search"})
              ),
              h("input", {
                type: "text",
                placeholder: "Search profiles and permission sets...",
                value: this.state.searchTerm,
                onChange: this.handleSearchChange,
                className: "slds-input"
              })
            )
          ),
          h("p", {className: "slds-text-body_small slds-m-bottom_medium"}, "Please consider granting field access to Permission Sets instead of Profiles ",
            h("a", {href: "https://admin.salesforce.com/blog/2023/permissions-updates-learn-moar-spring-23", target: "_blank", className: "slds-text-link"}, "?")
          ),

          renderTable(permissionSetsOnly, "Permission Sets"),
          renderTable(profiles, "Profiles")
        ),
        h("div", {className: "slds-modal__footer"},
          h("button", {
            type: "button",
            "aria-label": "Close button",
            className: "slds-button slds-button_neutral",
            onClick: onClose
          }, "Cancel"),
          h("button", {
            "aria-label": "Apply the permission to all fields in the table",
            type: "button",
            className: "slds-button slds-button_neutral",
            onClick: this.applyToAllFields
          }, "Apply to All Fields"),
          h("button", {
            type: "button",
            "aria-label": "Save permission for this field",
            className: "slds-button slds-button_brand",
            onClick: () => {
              const updatedProfiles = Object.entries(permissions).reduce((acc, [name, perm]) => {
                if (perm.edit || perm.read) {
                  acc.push({
                    name,
                    access: perm.edit ? "edit" : "read"
                  });
                }
                return acc;
              }, []);

              const updatedField = {
                ...field,
                profiles: updatedProfiles
              };
              onSave(updatedField);
            }
          }, "Save")
        )
      )
      ),
      h("div", {className: "slds-backdrop slds-backdrop_open"})
    );
  }
}

class FieldOptionModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      field: {...props.field},
    };
  }

  handleInputChange = (event) => {
    const {name, value, type, checked} = event.target;
    const newValue = type === "checkbox" ? checked : value;

    this.setState((prevState) => ({
      field: {
        ...prevState.field,
        [name]: newValue,
      },
    }));
  };

  handleSave = () => {
    this.props.onSave(this.state.field);
  };

  renderFieldOptions = () => {
    const {field} = this.state;
    const {selectedObject, isPlatformEvent} = this.props;
    const isForPlatformEvent = isPlatformEvent(selectedObject);
    const disabled = !!field.isExisting;

    switch (field.type) {
      case "Checkbox":
        return h("div", {className: "field_options Checkbox_options"},
          h("fieldset", {className: "slds-form-element slds-m-bottom_medium"},
            h("legend", {className: "slds-form-element__legend slds-form-element__label"}, "Default Value"),
            h("div", {className: "slds-form-element__control"},
              h("div", {className: "slds-radio slds-m-right_x-small"},
                h("input", {
                  type: "radio",
                  id: "checkboxDefault-checked",
                  name: "checkboxDefault",
                  value: "checked",
                  checked: field.checkboxDefault === "checked",
                  onChange: this.handleInputChange,
                  disabled
                }),
                h("label", {className: "slds-radio__label", htmlFor: "checkboxDefault-checked"},
                  h("span", {className: "slds-radio_faux"}),
                  h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Checked")
                )
              ),
              h("div", {className: "slds-radio"},
                h("input", {
                  type: "radio",
                  id: "checkboxDefault-unchecked",
                  name: "checkboxDefault",
                  value: "unchecked",
                  checked: field.checkboxDefault === "unchecked",
                  onChange: this.handleInputChange,
                  disabled
                }),
                h("label", {className: "slds-radio__label", htmlFor: "checkboxDefault-unchecked"},
                  h("span", {className: "slds-radio_faux"}),
                  h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Unchecked")
                )
              )
            )
          ),
          this.renderDescriptionAndHelpText()
        );

      case "Currency":
        return h("div", {className: "field_options Currency_options"},
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: "currencyLength"}, "Length"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: "currencyLength",
                name: "precision",
                className: "slds-input",
                placeholder: "Max is 18 - Decimal Places",
                value: field.precision,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: "currencyDecimalPlaces"}, "Decimal Places"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: "currencyDecimalPlaces",
                name: "decimal",
                className: "slds-input",
                placeholder: "Max is 18 - Length",
                value: field.decimal,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "Date":
      case "DateTime":
      case "Email":
      case "Phone":
      case "Url":
        return h("div", {className: `field_options ${field.type}_options`},
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox(),
          field.type === "Email" && !isForPlatformEvent && this.renderUniqueCheckbox(),
          field.type === "Email" && !isForPlatformEvent && this.renderExternalIdCheckbox()
        );

      case "Location":
        return h("div", {className: "field_options Location_options"},
          h("fieldset", {className: "slds-form-element slds-m-bottom_medium"},
            h("legend", {className: "slds-form-element__legend slds-form-element__label"}, "Latitude and Longitude Display Notation"),
            h("div", {className: "slds-form-element__control"},
              h("div", {className: "slds-radio slds-m-right_x-small"},
                h("input", {
                  type: "radio",
                  id: "geodisplay-degrees",
                  name: "geodisplay",
                  value: "degrees",
                  checked: field.geodisplay === "degrees",
                  onChange: this.handleInputChange,
                  disabled
                }),
                h("label", {className: "slds-radio__label", htmlFor: "geodisplay-degrees"},
                  h("span", {className: "slds-radio_faux"}),
                  h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Degrees, Minutes, Seconds")
                )
              ),
              h("div", {className: "slds-radio"},
                h("input", {
                  type: "radio",
                  id: "geodisplay-decimal",
                  name: "geodisplay",
                  value: "decimal",
                  checked: field.geodisplay === "decimal",
                  onChange: this.handleInputChange,
                  disabled
                }),
                h("label", {className: "slds-radio__label", htmlFor: "geodisplay-decimal"},
                  h("span", {className: "slds-radio_faux"}),
                  h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Decimal")
                )
              )
            )
          ),
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: "geolocationDecimalPlaces"}, "Decimal Places"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: "geolocationDecimalPlaces",
                name: "decimal",
                className: "slds-input",
                value: field.decimal,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "Number":
      case "Percent":
        return h("div", {className: `field_options ${field.type}_options`},
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: `${field.type.toLowerCase()}Length`}, "Length"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: `${field.type.toLowerCase()}Length`,
                name: "precision",
                className: "slds-input",
                placeholder: "Max is 18 less Decimal Places",
                value: field.precision,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: `${field.type.toLowerCase()}DecimalPlaces`}, "Decimal Places"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: `${field.type.toLowerCase()}DecimalPlaces`,
                name: "decimal",
                className: "slds-input",
                placeholder: "Max is 18 less Length",
                value: field.decimal,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox(),
          field.type === "Number" && !isForPlatformEvent && this.renderUniqueCheckbox(),
          field.type === "Number" && !isForPlatformEvent && this.renderExternalIdCheckbox()
        );

      case "Picklist":
      case "MultiselectPicklist":
        return h("div", {className: `field_options ${field.type}_options`},
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: `${field.type.toLowerCase()}Options`}, "Picklist Values"),
            h("div", {className: "slds-form-element__control"},
              h("textarea", {
                id: `${field.type.toLowerCase()}Options`,
                name: "picklistvalues",
                className: "slds-textarea",
                rows: "5",
                placeholder: "Enter picklist values separated by line breaks.",
                value: field.picklistvalues,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          h("div", {className: "slds-checkbox slds-m-bottom_x-small"},
            h("input", {
              type: "checkbox",
              id: `${field.type.toLowerCase()}SortAlpha`,
              name: "sortalpha",
              checked: field.sortalpha,
              onChange: this.handleInputChange,
              disabled
            }),
            h("label", {className: "slds-checkbox__label", htmlFor: `${field.type.toLowerCase()}SortAlpha`},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Sort values alphabetically")
            )
          ),
          h("div", {className: "slds-checkbox slds-m-bottom_small"},
            h("input", {
              type: "checkbox",
              id: `${field.type.toLowerCase()}FirstValueDefault`,
              name: "firstvaluedefault",
              checked: field.firstvaluedefault,
              onChange: this.handleInputChange,
              disabled
            }),
            h("label", {className: "slds-checkbox__label", htmlFor: `${field.type.toLowerCase()}FirstValueDefault`},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Use first value as default")
            )
          ),
          field.type === "MultiselectPicklist" && h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: "picklist-multiVisibleLines"}, "# Visible Lines"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: "picklist-multiVisibleLines",
                name: "vislines",
                className: "slds-input",
                placeholder: "This field is required.",
                value: field.vislines,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "Text":
        return h("div", {className: "field_options Text_options"},
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: "textLength"}, "Length"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: "textLength",
                name: "length",
                className: "slds-input",
                placeholder: "Max is 255 characters.",
                value: field.length ?? 255,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox(),
          !isForPlatformEvent && this.renderUniqueCheckbox(),
          !isForPlatformEvent && this.renderExternalIdCheckbox()
        );

      case "TextArea":
        return h("div", {className: "field_options TextArea_options"},
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "LongTextArea":
      case "Html":
        return h("div", {className: `field_options ${field.type}_options`},
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: `${field.type.toLowerCase()}Length`}, "Length"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: `${field.type.toLowerCase()}Length`,
                name: "length",
                className: "slds-input",
                placeholder: "Max is 131,072 characters.",
                value: field.length,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          h("div", {className: "slds-form-element slds-m-bottom_small"},
            h("label", {className: "slds-form-element__label", htmlFor: `${field.type.toLowerCase()}VisibleLines`}, "# Visible Lines"),
            h("div", {className: "slds-form-element__control"},
              h("input", {
                type: "text",
                id: `${field.type.toLowerCase()}VisibleLines`,
                name: "vislines",
                className: "slds-input",
                placeholder: "This field is required.",
                value: field.vislines,
                onChange: this.handleInputChange,
                disabled
              })
            )
          ),
          this.renderDescriptionAndHelpText()
        );

      default:
        // Retrieve-only types (Lookup, Master-Detail, Roll-Up Summary, Auto Number,
        // Encrypted Text, ...) have no type-specific inputs here — only Label,
        // Description, and Help Text are ever saved for existing fields anyway.
        return h("div", {className: `field_options ${field.type}_options`},
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );
    }
  };

  renderDescriptionAndHelpText = () => {
    const {field} = this.state;
    const {selectedObject, isPlatformEvent} = this.props;
    const isForPlatformEvent = isPlatformEvent(selectedObject);

    return h("div", null,
      h("div", {className: "slds-form-element slds-m-bottom_small"},
        h("label", {className: "slds-form-element__label", htmlFor: "description"}, "Description"),
        h("div", {className: "slds-form-element__control"},
          h("textarea", {
            id: "description",
            name: "description",
            className: "slds-textarea",
            rows: "3",
            value: field.description || "",
            onChange: this.handleInputChange
          })
        )
      ),
      !isForPlatformEvent && h("div", {className: "slds-form-element slds-m-bottom_small"},
        h("label", {className: "slds-form-element__label", htmlFor: "helpText"}, "Help Text"),
        h("div", {className: "slds-form-element__control"},
          h("textarea", {
            id: "helpText",
            name: "helptext",
            className: "slds-textarea",
            rows: "3",
            value: field.helptext || "",
            onChange: this.handleInputChange
          })
        )
      )
    );
  };

  renderRequiredCheckbox = () => {
    const {field} = this.state;
    return h("div", {className: "slds-checkbox slds-m-right_x-small slds-m-bottom_x-small"},
      h("input", {
        type: "checkbox",
        id: "required",
        name: "required",
        checked: field.required,
        onChange: this.handleInputChange,
        disabled: !!field.isExisting
      }),
      h("label", {className: "slds-checkbox__label", htmlFor: "required"},
        h("span", {className: "slds-checkbox_faux"}),
        h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Required")
      )
    );
  };

  renderUniqueCheckbox = () => {
    const {field} = this.state;
    return h("div", {className: "slds-checkbox slds-m-right_x-small slds-m-bottom_x-small"},
      h("input", {
        type: "checkbox",
        id: "unique",
        name: "uniqueSetting",
        checked: field.uniqueSetting,
        onChange: this.handleInputChange,
        disabled: !!field.isExisting
      }),
      h("label", {className: "slds-checkbox__label", htmlFor: "unique"},
        h("span", {className: "slds-checkbox_faux"}),
        h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "Unique")
      )
    );
  };

  renderExternalIdCheckbox = () => {
    const {field} = this.state;
    return h("div", {className: "slds-checkbox slds-m-right_x-small slds-m-bottom_x-small"},
      h("input", {
        type: "checkbox",
        id: "externalId",
        name: "external",
        checked: field.external,
        onChange: this.handleInputChange,
        disabled: !!field.isExisting
      }),
      h("label", {className: "slds-checkbox__label", htmlFor: "externalId"},
        h("span", {className: "slds-checkbox_faux"}),
        h("span", {className: "slds-form-element__label slds-p-left_x-small"}, "External ID")
      )
    );
  };

  render() {
    return h("div", {},
      h("section", {
        role: "dialog",
        tabIndex: -1,
        "aria-modal": "true",
        "aria-labelledby": "field-option-modal-heading",
        className: "slds-modal slds-fade-in-open slds-modal_medium"
      },
      h("div", {className: "slds-modal__container"},
        h("div", {className: "slds-modal__header"},
          h("button", {
            type: "button",
            "aria-label": "Close Set Field Options",
            className: "slds-button slds-button_icon slds-modal__close",
            onClick: this.props.onClose
          },
          h("svg", {className: "slds-button__icon slds-button__icon_large", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#close"})
          ),
          h("span", {className: "slds-assistive-text"}, "Cancel and close")
          ),
          h("h1", {id: "field-option-modal-heading", className: "slds-modal__title slds-hyphenate"}, "Set Field Options")
        ),
        h("div", {
          className: "slds-modal__content slds-p-around_medium"
        },
        this.state.field.isExisting && h("div", {className: "slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_info slds-m-bottom_medium"},
          h("span", {className: "slds-assistive-text"}, "info"),
          "This field already exists on the object. Only Label, Description, and Help Text can be edited here — other attributes are shown for reference only."
        ),
        this.renderFieldOptions()
        ),
        h("div", {
          className: "slds-modal__footer"
        },
        h("button", {
          "aria-label": "Close Button",
          className: "slds-button slds-button_neutral",
          onClick: this.props.onClose
        }, "Cancel"),
        h("button", {
          "aria-label": "Save options button",
          className: "slds-button slds-button_brand",
          onClick: this.handleSave
        }, "Save")
        )
      )
      ),
      h("div", {className: "slds-backdrop slds-backdrop_open"})
    );
  }
}

// Define the React components
class FieldRow extends React.Component {

  getAvailableFieldTypes() {
    const {selectedObject, field} = this.props;

    // All available field types
    const allFieldTypes = [
      {value: "Checkbox", label: "Checkbox"},
      {value: "Currency", label: "Currency"},
      {value: "Date", label: "Date"},
      {value: "DateTime", label: "Date / Time"},
      {value: "Email", label: "Email"},
      {value: "Location", label: "Geolocation"},
      {value: "Number", label: "Number"},
      {value: "Percent", label: "Percent"},
      {value: "Phone", label: "Phone"},
      {value: "Picklist", label: "Picklist"},
      {value: "MultiselectPicklist", label: "Picklist (Multi-Select)"},
      {value: "Text", label: "Text"},
      {value: "TextArea", label: "Text Area"},
      {value: "LongTextArea", label: "Text Area (Long)"},
      {value: "Html", label: "Text Area (Rich)"},
      {value: "Url", label: "URL"}
    ];

    // Platform events have limited field types
    if (this.props.isPlatformEvent(selectedObject)) {
      const allowedForPlatformEvents = this.props.getAllowedPlatformEventFieldTypes();
      return allFieldTypes.filter(fieldType => allowedForPlatformEvents.includes(fieldType.value));
    }

    // A retrieved existing field can have a type that can't be created from scratch here
    // (Lookup, Master-Detail, ...) — add it so the (disabled) select still shows it correctly.
    if (field.isExisting && RETRIEVE_ONLY_FIELD_TYPES[field.type]) {
      return [...allFieldTypes, {value: field.type, label: RETRIEVE_ONLY_FIELD_TYPES[field.type]}];
    }

    // Standard objects and custom objects have all field types
    return allFieldTypes;
  }

  render() {
    document.title = "Field Manager";

    let deploymentStatus;
    switch (this.props.field.deploymentStatus) {
      case "pending":
        deploymentStatus = h("svg", {
          className: "slds-icon slds-icon_x-small fillAccent",
          viewBox: "0 0 52 52"
        },
        h("use", {xlinkHref: "symbols.svg#clock"})
        );
        break;
      case "success":
        deploymentStatus = h("svg", {
          className: "slds-icon slds-icon_x-small slds-icon-text-success",
          viewBox: "0 0 52 52"
        },
        h("use", {xlinkHref: "symbols.svg#success"})
        );
        break;
      case "error":
        deploymentStatus = h("svg", {
          className: "slds-icon slds-icon_x-small slds-icon-text-error",
          viewBox: "0 0 52 52"
        },
        h("use", {xlinkHref: "symbols.svg#error"})
        );
        break;
      default:
        deploymentStatus = "";
    }

    return (
      h("tr", null,
        h("td", {className: "slds-text-align_center slds-align-middle"},
          // Cloning an existing field would create a new field with the same API name,
          // which the org would reject as a duplicate — so cloning only applies to new fields.
          !this.props.field.isExisting && h("button", {
            type: "button",
            "aria-label": "Clone this field",
            title: "Clone",
            className: "slds-button slds-button_icon",
            onClick: () => this.props.onClone(this.props.index)
          },
          h("svg", {
            className: "slds-button__icon fillAccent",
            "aria-hidden": "true"
          },
            h("use", {xlinkHref: "symbols.svg#clone"})
          )
          )
        ),
        h("td", {className: "slds-text-align_center slds-align-middle"},
          h("button", {
            type: "button",
            "aria-label": "Delete this field",
            title: "Delete",
            className: "slds-button slds-button_icon",
            onClick: () => this.props.onDelete(this.props.index)
          },
          h("svg", {className: "slds-button__icon slds-icon-text-light", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#delete"})
          )
          )
        ),
        h("td", {className: "slds-align-middle"},
          h("div", {className: "slds-grid slds-grid_vertical-align-center"},
            this.props.field.isExisting && h("span", {
              className: "slds-badge slds-m-right_x-small",
              title: "Retrieved from the object metadata"
            }, "Existing"),
            h("input", {
              type: "text",
              className: "slds-input slds-grow",
              placeholder: "Field label...",
              value: this.props.field.label,
              onChange: (e) => this.props.onLabelChange(this.props.index, e.target.value)
            })
          )
        ),
        h("td", {className: "slds-align-middle"},
          h("input", {
            type: "text",
            className: "slds-input",
            placeholder: "Field name...",
            value: this.props.field.isExisting ? `${this.props.field.name}__c` : this.props.field.name,
            disabled: this.props.field.isExisting,
            onChange: (e) => this.props.onNameChange(this.props.index, e.target.value)
          })
        ),
        h("td", {className: "slds-align-middle"},
          h("div", {className: "slds-select_container"},
            h("select", {
              className: "slds-select",
              value: this.props.field.type,
              disabled: this.props.field.isExisting,
              onChange: (e) => this.props.onTypeChange(this.props.index, e.target.value)
            },
            this.getAvailableFieldTypes().map(fieldType =>
              h("option", {key: fieldType.value, value: fieldType.value}, fieldType.label)
            )
            )
          )
        ),
        h("td", {className: "slds-align-middle"},
          h("button", {
            type: "button",
            "aria-label": "Open options modal for this field button",
            className: "slds-button slds-button_neutral slds-button_stretch",
            onClick: () => this.props.onEditOptions(this.props.index)
          }, "Options")
        ),
        h("td", {className: "slds-align-middle"},
          h("button", {
            type: "button",
            "aria-label": "Open permission modal for this field button",
            className: "slds-button slds-button_neutral slds-button_stretch",
            onClick: () => this.props.onEditProfiles(this.props.index)
          }, "Permissions")
        ),
        h("td", {className: "slds-text-align_center slds-align-middle"},
          h("div", {
            className: "slds-text-align_center slds-align-middle cursorPointer",
            onClick: () => this.props.onShowDeploymentStatus(this.props.index)
          },
          deploymentStatus
          )
        )
      )
    );
  }
}

class FieldsTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortColumn: null,
      sortDirection: "asc"
    };
  }

  onSortClick = (column) => {
    this.setState(prevState => ({
      sortColumn: column,
      sortDirection: prevState.sortColumn === column && prevState.sortDirection === "asc" ? "desc" : "asc"
    }));
  };

  getSortedIndexedFields() {
    const {sortColumn, sortDirection} = this.state;
    const indexedFields = this.props.fields.map((field, index) => ({field, index}));
    if (!sortColumn) {
      return indexedFields;
    }
    const direction = sortDirection === "asc" ? 1 : -1;
    return indexedFields.sort((a, b) => {
      const valueA = (a.field[sortColumn] || "").toLowerCase();
      const valueB = (b.field[sortColumn] || "").toLowerCase();
      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    });
  }

  renderSortableHeader(label, column) {
    const {sortColumn, sortDirection} = this.state;
    const isActive = sortColumn === column;
    return h("th", {scope: "col"},
      h("a", {
        href: "#",
        role: "button",
        className: "slds-th__action slds-text-link_reset cursorPointer userSelectNone",
        onClick: (e) => { e.preventDefault(); this.onSortClick(column); },
        title: `Sort by ${label}`
      },
      h("span", {className: "slds-truncate"}, label),
      isActive && h("svg", {className: "slds-icon slds-icon_xx-small slds-m-left_xx-small slds-icon-text-default", "aria-hidden": "true"},
        h("use", {xlinkHref: `symbols.svg#${sortDirection === "asc" ? "arrowup" : "arrowdown"}`})
      )
      )
    );
  }

  render() {
    return (
      h("div", {className: "slds-scrollable_x"},
        h("table", {
          className: "slds-table slds-table_bordered slds-table_striped slds-table_cell-buffer",
          id: "fields_table"
        },
        h("thead", null,
          h("tr", {className: "slds-line-height_reset"},
            h("th", {scope: "col"}),
            h("th", {scope: "col"}),
            this.renderSortableHeader("Label", "label"),
            this.renderSortableHeader("API Name (__c)", "name"),
            this.renderSortableHeader("Type", "type"),
            h("th", {scope: "col"}, "Options"),
            h("th", {scope: "col"}, "Permissions"),
            h("th", {scope: "col"})
          )
        ),
        h("tbody", null,
          this.getSortedIndexedFields().map(({field, index}) =>
            h(FieldRow, {
              key: index,
              index,
              field,
              selectedObject: this.props.selectedObject,
              isPlatformEvent: this.props.isPlatformEvent,
              getAllowedPlatformEventFieldTypes: this.props.getAllowedPlatformEventFieldTypes,
              onDelete: this.props.onDelete,
              onClone: this.props.onClone,
              onLabelChange: this.props.onLabelChange,
              onNameChange: this.props.onNameChange,
              onTypeChange: this.props.onTypeChange,
              onEditOptions: this.props.onEditOptions,
              onEditProfiles: this.props.onEditProfiles,
              onShowDeploymentStatus: this.props.onShowDeploymentStatus
            })
          )
        )
        )
      )
    );
  }
}

class App extends React.Component {

  constructor(props) {
    super(props);
    const {sfHost} = props;
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.state = {
      objects: [], // Store all objects fetched from API
      profiles: [],
      permissionSets: {},
      fields: [{label: "", name: "", type: "Text"}],
      showProfilesModal: false,
      currentFieldIndex: null,
      showModal: false,
      showImportModal: false,
      allFieldsHavePermissions: true,
      importCsvContent: "",
      importError: "",
      objectSearch: "",
      fieldErrorMessage: "",
      errorMessageClickable: false,
      filteredObjects: [],
      includeManagedPackage: localStorage.getItem("fieldCreatorIncludeManaged") === "true",
      allowFieldUpdates: localStorage.getItem("fieldCreatorAllowUpdates") === "true",
      showUpdateConfirmModal: false,
      pendingDeployFields: null,
      infoModal: null,
      isRetrievingFields: false
    };

    // Initialize spinFor method
    this.spinFor = createSpinForMethod(this);

    // Initialize user info model - handles all user-related properties
    this.userInfoModel = new UserInfoModel(this.spinFor.bind(this));

    // Set orgName from sfHost
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";

    applyProductionStyling(sfHost);
  }

  didUpdate() {
    this.forceUpdate();
  }

  // Utility method to check if an object is a platform event
  isPlatformEvent = (obj) => obj && obj.keyPrefix && obj.keyPrefix.startsWith("e");

  // Utility method to get allowed field types for platform events
  getAllowedPlatformEventFieldTypes = () => ["Checkbox", "Date", "DateTime", "Number", "Text", "LongTextArea"];

  // Generate the appropriate Fields setup link for different object types
  getObjectFieldsLink = (selectedObject) => {
    if (selectedObject.name.endsWith("__mdt")) {
      return `https://${sfConn.instanceHostname}/lightning/setup/CustomMetadata/page?address=%2F${selectedObject.durableId}%3Fsetupid%3DCustomMetadata`;
    } else if (selectedObject.name.endsWith("__e")) {
      return `https://${sfConn.instanceHostname}/lightning/setup/PlatformEvents/page?address=%2F${selectedObject.durableId}%3Fsetupid%3DPlatformEvents`;
    } else {
      return `https://${sfConn.instanceHostname}/lightning/setup/ObjectManager/${selectedObject.name}/FieldsAndRelationships/view`;
    }
  };

  componentDidMount() {
    this.fetchObjects();
    this.fetchPermissionSets();
    this.onSobjectsListRefreshed = (e) => {
      if (e.detail?.sfHost === this.sfHost) {
        const layoutableObjects = e.detail.sobjectsList.filter(obj =>
          obj.layoutable === true || (obj.keyPrefix && obj.keyPrefix.startsWith("e")) || obj.name.endsWith("__mdt")
        );
        this.setState({objects: layoutableObjects});
      }
    };
    window.addEventListener(Constants.SOBJECTS_LIST_REFRESHED_EVENT, this.onSobjectsListRefreshed);
  }

  componentWillUnmount() {
    window.removeEventListener(Constants.SOBJECTS_LIST_REFRESHED_EVENT, this.onSobjectsListRefreshed);
  }

  handleObjectSearch = (e) => {
    const searchTerm = e.target.value.toLowerCase();

    // Sort the filtered objects based on relevance
    const sortedFilteredObjects = this.state.objects
      .filter(obj => {
        // First filter by managed package setting
        if (!this.state.includeManagedPackage) {
          // Hide managed package objects (those with NamespacePrefix)
          if (obj.namespacePrefix && obj.namespacePrefix !== "") {
            return false;
          }
        }

        // Then filter by search term
        return obj.name.toLowerCase().includes(searchTerm)
          || obj.label.toLowerCase().includes(searchTerm);
      })
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();

        // Helper function to calculate match score
        const getMatchScore = (str) => {
          if (str === searchTerm) return 4; // Exact match
          if (str.startsWith(searchTerm)) return 3; // Starts with
          if (str.includes(searchTerm)) return 2; // Contains
          return 0; // No match
        };

        const aScore = Math.max(getMatchScore(aName), getMatchScore(aLabel));
        const bScore = Math.max(getMatchScore(bName), getMatchScore(bLabel));

        if (aScore !== bScore) return bScore - aScore; // Higher score first

        // If scores are equal, prioritize shorter strings
        const aLength = Math.min(aName.length, aLabel.length);
        const bLength = Math.min(bName.length, bLabel.length);
        if (aLength !== bLength) return aLength - bLength;

        // If lengths are equal, sort alphabetically
        return aName.localeCompare(bName);
      });

    this.setState({
      objectSearch: e.target.value,
      filteredObjects: sortedFilteredObjects,
    });
  };

  handleObjectSelect = (obj) => {
    let objectName = obj.name;

    // Fields retrieved from a previously selected object no longer apply
    let updatedFields = this.state.fields.filter(field => !field.isExisting);
    if (updatedFields.length === 0) {
      updatedFields = [{label: "", name: "", type: "Text"}];
    }

    // If switching to a platform event, validate and reset field types that aren't allowed
    if (this.isPlatformEvent(obj)) {
      const allowedTypesForPE = this.getAllowedPlatformEventFieldTypes();
      updatedFields = updatedFields.map(field => {
        if (!allowedTypesForPE.includes(field.type)) {
          return {...field, type: "Text"}; // Default to Text for invalid types
        }
        return field;
      });
    }

    this.setState({
      selectedObject: obj,
      objectSearch: objectName,
      filteredObjects: [],
      fields: updatedFields
    });
  };

  onUpdateManagedPackageSelection = (e) => {
    const includeManagedPackage = e.target.checked;
    localStorage.setItem("fieldCreatorIncludeManaged", includeManagedPackage);
    this.setState({includeManagedPackage});
  };

  onUpdateAllowFieldUpdates = (e) => {
    const allowFieldUpdates = e.target.checked;
    localStorage.setItem("fieldCreatorAllowUpdates", allowFieldUpdates);
    this.setState({allowFieldUpdates});
  };



  setFieldPermissions(field, fieldId, objectName) {
    if (!field.profiles || !Array.isArray(field.profiles)) {
      return Promise.resolve([]);
    }
    const permissionPromises = field.profiles.map(profile => {
      const permissionSetId = this.state.permissionSetMap[profile.name] || profile.name;
      const fieldPermissionBody = {
        ParentId: permissionSetId,
        SobjectType: objectName,
        Field: `${objectName}.${field.name}__c`,
        PermissionsEdit: profile.access === "edit",
        PermissionsRead: profile.access === "edit" || profile.access === "read"
      };

      return sfConn.rest(`/services/data/v${apiVersion}/sobjects/FieldPermissions/`, {
        method: "POST",
        body: fieldPermissionBody
      });
    });

    return Promise.all(permissionPromises);
  }

  createField(field, objectName) {
    const {selectedObject} = this.state;
    const isForPlatformEvent = this.isPlatformEvent(selectedObject);

    const newField = {
      FullName: `${objectName}.${field.name}__c`,
      Metadata: {
        label: field.label,
        type: this.mapFieldType(field.type),
        required: field.required || false,
        trackFeedHistory: false,
        trackHistory: false,
        trackTrending: false
      }
    };

    // Description is always supported
    newField.Metadata.description = field.description;

    // Only add these properties for non-platform events
    if (!isForPlatformEvent) {
      newField.Metadata.inlineHelpText = field.helptext;
      newField.Metadata.unique = field.uniqueSetting || false;
      newField.Metadata.externalId = field.external || false;
    }

    // Add specific options based on field type
    switch (field.type) {
      case "Checkbox":
        newField.Metadata.defaultValue = field.checkboxDefault === "checked";
        break;

      case "Currency":
      case "Number":
      case "Percent": {
        const scale = parseInt(field.decimal) || 0;
        const length = parseInt(field.precision) || 18;
        newField.Metadata.precision = length + scale;
        newField.Metadata.scale = scale;
        break;
      }

      case "Date":
      case "DateTime":
      case "Email":
      case "Phone":
      case "Url":
        // No additional options for these types
        break;

      case "Location":
        newField.Metadata.displayLocationInDecimal = field.geodisplay === "decimal";
        newField.Metadata.scale = parseInt(field.decimal) || 0;
        break;

      case "Picklist":
      case "MultiselectPicklist":
        newField.Metadata.valueSet = {
          valueSetDefinition: {
            sorted: field.sortalpha || false,
            value: field.picklistvalues
              .split("\n")
              .map(value => value.trim())
              .filter(value => value.length > 0)
              .map((value, index) => ({
                fullName: value,
                default: field.firstvaluedefault && index === 0
              }))
          }
        };
        if (field.type === "MultiselectPicklist") {
          newField.Metadata.visibleLines = parseInt(field.vislines) || 4;
        }
        break;

      case "Text":
        newField.Metadata.length = parseInt(field.length) || 255;
        break;

      case "TextArea":
        // No additional options for TextArea
        break;

      case "LongTextArea":
      case "Html":
        newField.Metadata.length = parseInt(field.length) || 32768;
        newField.Metadata.visibleLines = parseInt(field.vislines) || 6;
        break;

      default:
        console.warn(`Unsupported field type: ${field.type}`);
    }

    return sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/CustomField`, {
      method: "POST",
      body: newField
    })
      .then(data => this.setFieldPermissions(field, data.id, objectName))
      .catch(error => {
        console.error("Error creating field:", error);
        throw error;
      });
  }

  // Updates only Label / Description / Help Text on a field retrieved via Retrieve Fields.
  // Starts from the untouched Metadata blob captured at retrieval time (field.rawMetadata) and
  // overrides just those 3 properties, so every other attribute (type, length, picklist values,
  // required, unique, external id, ...) is resubmitted exactly as it already exists on the org.
  updateField(field, objectName) {
    const isForPlatformEvent = this.isPlatformEvent(this.state.selectedObject);

    const updatedMetadata = {
      ...stripNulls(field.rawMetadata || {}),
      label: field.label,
      description: field.description
    };
    if (!isForPlatformEvent) {
      updatedMetadata.inlineHelpText = field.helptext;
    }

    return sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/CustomField/${field.fieldId}`, {
      method: "PATCH",
      body: {Metadata: updatedMetadata}
    })
      .then(() => this.setFieldPermissions(field, field.fieldId, objectName))
      .catch(error => {
        console.error("Error updating field:", error);
        throw error;
      });
  }

  mapFieldType(uiType) {
    const typeMap = {
      "Checkbox": "Checkbox",
      "Currency": "Currency",
      "Date": "Date",
      "DateTime": "DateTime",
      "Email": "Email",
      "Location": "Location",
      "Number": "Number",
      "Percent": "Percent",
      "Phone": "Phone",
      "Picklist": "Picklist",
      "MultiselectPicklist": "MultiselectPicklist",
      "Text": "Text",
      "TextArea": "TextArea",
      "LongTextArea": "LongTextArea",
      "Html": "Html",
      "Url": "Url"
    };
    return typeMap[uiType] || uiType;
  }

  fetchObjects = async () => {
    try {
      // Get sobjects list (from cache or fetched from API)
      const sobjectsList = await getSobjectsList(this.sfHost);

      // Filter for layoutable objects (objects that can have layouts), platform events, and custom metadata types
      const layoutableObjects = sobjectsList.filter(obj =>
        obj.layoutable === true || (obj.keyPrefix && obj.keyPrefix.startsWith("e")) || obj.name.endsWith("__mdt")
      );

      this.setState({objects: layoutableObjects});
    } catch (error) {
      console.error("Error fetching objects:", error);
      this.setState({fieldErrorMessage: "Error fetching object data."});
    }
  };

  fetchPermissionSets = () => {
    sfConn.rest(`/services/data/v${apiVersion}/query/?q=SELECT+Id,Name,Profile.Name+FROM+PermissionSet`)
      .then(data => {
        let permissionSets = {};
        let permissionSetMap = {};
        data.records.forEach(record => {
          permissionSets[record.Name] = record.Profile ? record.Profile.Name : null;
          permissionSetMap[record.Name] = record.Id;
        });

        this.setState({permissionSets, permissionSetMap});
      })
      .catch(error => {
        console.error("Error fetching permission sets:", error);
      });
  };

  // Reverse of createField()'s Metadata construction: turns a retrieved CustomField
  // Tooling API record back into the row shape used by the fields table.
  // Only label/description/helptext are ever read back out of this at deploy time for
  // existing fields (see updateField) — rawMetadata is kept as the untouched source of
  // truth for everything else, so an imperfect reverse-mapping here can't corrupt data.
  mapMetadataToUiField(record, objectName) {
    const metadata = record.Metadata || {};
    const type = metadata.type;
    const field = {
      label: metadata.label || record.DeveloperName,
      name: record.DeveloperName,
      type,
      description: metadata.description || "",
      helptext: metadata.inlineHelpText || "",
      required: metadata.required || false,
      isExisting: true,
      fieldId: record.Id,
      fullName: `${objectName}.${record.DeveloperName}__c`,
      rawMetadata: metadata
    };

    switch (type) {
      case "Checkbox":
        field.checkboxDefault = metadata.defaultValue ? "checked" : "unchecked";
        break;

      case "Currency":
      case "Number":
      case "Percent": {
        const scale = metadata.scale || 0;
        field.decimal = scale;
        field.precision = Math.max((metadata.precision || 0) - scale, 0);
        if (type === "Number") {
          field.uniqueSetting = metadata.unique || false;
          field.external = metadata.externalId || false;
        }
        break;
      }

      case "Location":
        field.geodisplay = metadata.displayLocationInDecimal ? "decimal" : "degrees";
        field.decimal = metadata.scale || 0;
        break;

      case "Picklist":
      case "MultiselectPicklist": {
        const valueSetDefinition = metadata.valueSet && metadata.valueSet.valueSetDefinition;
        const values = valueSetDefinition ? sfConn.asArray(valueSetDefinition.value) : [];
        field.picklistvalues = values.map(v => v.fullName).join("\n");
        field.sortalpha = !!(valueSetDefinition && valueSetDefinition.sorted);
        field.firstvaluedefault = values.length > 0 && values[0].default === true;
        if (type === "MultiselectPicklist") {
          field.vislines = metadata.visibleLines || 4;
        }
        break;
      }

      case "Email":
        field.uniqueSetting = metadata.unique || false;
        field.external = metadata.externalId || false;
        break;

      case "Text":
        field.length = metadata.length || 255;
        field.uniqueSetting = metadata.unique || false;
        field.external = metadata.externalId || false;
        break;

      case "LongTextArea":
      case "Html":
        field.length = metadata.length || 32768;
        field.vislines = metadata.visibleLines || 6;
        break;

      default:
        break;
    }

    return field;
  }

  retrieveFields = () => {
    const {selectedObject, isRetrievingFields} = this.state;
    if (!selectedObject || this.isPlatformEvent(selectedObject) || isRetrievingFields) {
      return;
    }
    this.setState({isRetrievingFields: true});
    this.spinFor(this.performRetrieveFields());
  };

  performRetrieveFields = async () => {
    const {selectedObject, fields} = this.state;

    try {
      // The Tooling API rejects queries selecting the Metadata compound field
      // once more than one row matches, so first list the field Ids, then fetch
      // each field's full Metadata individually.
      const listQuery = `SELECT Id FROM CustomField WHERE TableEnumOrId = '${selectedObject.name}'`;
      const listData = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query?q=${encodeURIComponent(listQuery)}`);
      const ids = (listData.records || []).map(r => r.Id);

      if (ids.length === 0) {
        this.showInfoModal("Retrieve Fields", "No custom fields found on this object.");
        return;
      }

      const records = await mapWithConcurrency(ids, 5, id =>
        sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/CustomField/${id}`)
      );

      const existingNames = new Set(fields.filter(f => f.isExisting).map(f => f.name));
      const retrieved = [];
      let skipped = 0;

      records.forEach(record => {
        const type = record.Metadata && record.Metadata.type;
        if (!type || !(FIELD_TYPES.includes(type) || RETRIEVE_ONLY_FIELD_TYPES[type])) {
          skipped++;
          return;
        }
        if (existingNames.has(record.DeveloperName)) {
          return;
        }
        retrieved.push(this.mapMetadataToUiField(record, selectedObject.name));
      });

      if (retrieved.length === 0) {
        this.showInfoModal("Retrieve Fields", skipped > 0
          ? `No editable fields retrieved. ${skipped} field(s) were skipped (unsupported type for this tool).`
          : "No new fields to retrieve.");
        return;
      }

      this.setState(prevState => {
        const isBlankPlaceholder = f => !f.isExisting && !f.label && !f.name;
        const remainingFields = prevState.fields.filter(f => !isBlankPlaceholder(f));
        return {fields: [...remainingFields, ...retrieved]};
      });

      if (skipped > 0) {
        this.showInfoModal("Retrieve Fields", `${retrieved.length} field(s) retrieved. ${skipped} field(s) were skipped (unsupported type for this tool).`);
      }
    } catch (error) {
      console.error("Error retrieving fields:", error);
      this.setState({fieldErrorMessage: "Error retrieving fields for this object."});
    } finally {
      this.setState({isRetrievingFields: false});
    }
  };

  addRow = () => {
    this.setState((prevState) => ({
      fields: [...prevState.fields, {label: "", name: "", type: "Text"}],
    }));
    this.checkAllFieldsHavePermissions();
  };

  removeRow = (index) => {
    this.setState((prevState) => ({
      fields: prevState.fields.filter((_, i) => i !== index),
    }));
  };

  cloneRow = (index) => {
    this.setState((prevState) => {
      const clonedField = {...prevState.fields[index]};
      delete clonedField.deploymentStatus;
      delete clonedField.deploymentError;
      // A clone is always a brand new field, independent from any retrieved field it came from
      delete clonedField.isExisting;
      delete clonedField.fieldId;
      delete clonedField.fullName;
      delete clonedField.rawMetadata;

      return {
        fields: [...prevState.fields, clonedField],
      };
    });
  };

  formatApiName(label) {
    const namingConvention = localStorage.getItem("fieldNamingConvention") || "pascal";

    // First, replace any special characters with underscores and convert to proper case
    let apiName = label.trim().replace(/[^a-zA-Z0-9\s]/g, "_");
    if (namingConvention === "underscore") {
      // Convert spaces to underscores: "My Field Name" -> "My_Field_Name"
      apiName = apiName.replace(/\s+/g, "_");
    } else {
      // Remove underscores and convert to PascalCase: "My_Field_Name" -> "MyFieldName"
      apiName = apiName.replace(/[\s_]+(\w)/g, (_, letter) => letter.toUpperCase());
    }
    // Remove leading/trailing underscores
    apiName = apiName.replace(/^_+|_+$/g, "");
    // Replace multiple underscores with single underscore
    return apiName.replace(/_+/g, "_");
  }

  onLabelChange = (index, label) => {
    this.setState((prevState) => ({
      fields: prevState.fields.map((field, i) => {
        if (i === index) {
          field.label = label;
          if (!field.isExisting) {
            field.name = this.formatApiName(label);
          }
          delete field.deploymentStatus;
          delete field.deploymentError;
        }
        return field;
      }),
    }));
  };

  onNameChange = (index, name) => {
    this.setState((prevState) => ({
      fields: prevState.fields.map((field, i) => {
        if (i === index) {
          field.name = name;
          delete field.deploymentStatus;
          delete field.deploymentError;
        }
        return field;
      }),
    }));
  };

  onTypeChange = (index, type) => {
    // Validate field type for platform events
    const {selectedObject} = this.state;

    // If it's a platform event and the type isn't allowed, default to "Text"
    let validatedType = type;
    if (this.isPlatformEvent(selectedObject)) {
      const allowedTypesForPE = this.getAllowedPlatformEventFieldTypes();
      validatedType = allowedTypesForPE.includes(type) ? type : "Text";
    }

    this.setState((prevState) => ({
      fields: prevState.fields.map((field, i) =>
        i === index ? {...field, type: validatedType} : field
      ),
    }));
  };

  onEditOptions = (index) => {
    this.setState({
      showModal: true,
      currentFieldIndex: index,
    });
  };

  openImportModal = () => {
    this.setState({showImportModal: true, importCsvContent: "", importError: ""});
  };

  closeImportModal = () => {
    this.setState({showImportModal: false, importCsvContent: "", importError: ""});
  };

  handleImportCsvChange = (event) => {
    this.setState({importCsvContent: event.target.value});
  };

  importCsv = () => {
    const {importCsvContent, fields} = this.state;
    // Helper function to detect the separator
    const detectSeparator = (content) => {
      const potentialSeparators = [",", ";", "\t", "|"];
      const lines = content.split("\n").filter(line => line.trim() !== ""); // Remove empty lines
      if (lines.length === 0) {
        return ","; // Default to comma if no content
      }
      // Check the first line for the most frequent separator
      const firstLine = lines[0];
      let maxSeparator = ",";
      let maxCount = 0;
      potentialSeparators.forEach(separator => {
        const count = firstLine.split(separator).length;
        if (count > maxCount) {
          maxCount = count;
          maxSeparator = separator;
        }
      });
      return maxSeparator;
    };
    // Detect separator dynamically
    const separator = detectSeparator(importCsvContent);
    const lines = importCsvContent.split("\n");
    const newFields = [];
    // {index in current fields array} -> {label, description, helptext}
    const updatesByIndex = [];
    let hasError = false;

    // Skip a leading header row (e.g. pasted back from "Copy CSV" / "Copy Excel")
    const isHeaderRow = (line) => {
      const [label, name, type] = line.split(separator).map(item => (item || "").trim().toLowerCase());
      return label === "label" && name === "name" && type === "type";
    };

    lines.forEach((line, index) => {
      if (index === 0 && isHeaderRow(line)) {
        return;
      }
      const [label, name, type, description, helptext] = line.split(separator).map(item => (item || "").trim());
      if (label && name && type) {
        // Only Label/Description/Help Text are ever written back for an existing field (see
        // updateField), so its type doesn't need to be a creatable one for the update to apply.
        const existingIndex = fields.findIndex(f => f.isExisting && f.name === name);
        if (existingIndex !== -1) {
          updatesByIndex.push({index: existingIndex, label, description, helptext});
        } else if (FIELD_TYPES.includes(type)) {
          newFields.push({label, name, type, description: description || "", helptext: helptext || ""});
        } else {
          this.setState({importError: `Invalid type "${type}" on line ${index + 1}`});
          hasError = true;
        }
      }
    });

    if (!hasError) {
      this.setState(prevState => {
        const updatedFields = [...prevState.fields];
        updatesByIndex.forEach(({index, label, description, helptext}) => {
          const target = updatedFields[index];
          updatedFields[index] = {
            ...target,
            label,
            description: description || "",
            helptext: helptext || ""
          };
          delete updatedFields[index].deploymentStatus;
          delete updatedFields[index].deploymentError;
        });
        // Drop the initial blank placeholder row so imported fields don't leave it dangling
        const isBlankPlaceholder = f => !f.isExisting && !f.label && !f.name;
        const remainingFields = updatedFields.filter(f => !isBlankPlaceholder(f));
        return {
          fields: [...remainingFields, ...newFields],
          showImportModal: false,
          importCsvContent: "",
          importError: ""
        };
      });
    }
  };

  exportFieldsCsv = (separator = ",") => {
    const header = ["Label", "Name", "Type", "Description", "HelpText"];
    const rows = this.state.fields
      .filter(field => field.label || field.name)
      .map(field => [field.label, field.name, field.type, field.description, field.helptext]);
    return [header, ...rows].map(row => row.map(value => csvEscape(value, separator)).join(separator)).join("\n");
  };

  downloadFieldsCsv = () => {
    const csv = this.exportFieldsCsv();
    const objectName = this.state.selectedObject ? this.state.selectedObject.name : "fields";
    const blob = new Blob([csv], {type: "text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${objectName}-fields.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  copyFieldsCsv = () => {
    copyToClipboard(this.exportFieldsCsv());
  };

  copyFieldsExcel = () => {
    copyToClipboard(this.exportFieldsCsv("\t"));
  };

  onShowDeploymentStatus = (index) => {
    const field = this.state.fields[index];
    if (field.deploymentStatus === "error") {
      let errorMessage = "Deployment Error";
      try {
        const errorData = JSON.parse(field.deploymentError);
        errorMessage = errorData[0]?.message || errorMessage;
      } catch {
        // deploymentError isn't a JSON array of error objects (e.g. a plain-text
        // Salesforce error message) — fall back to showing it as-is.
        errorMessage = field.deploymentError || errorMessage;
      }
      this.setState({fieldErrorMessage: errorMessage});
    } else if (field.deploymentStatus === "pending") {
      this.setState({fieldErrorMessage: "Field deployment is in progress"});
    }
  };

  onEditProfiles = (index) => {
    this.setState({
      showProfilesModal: true,
      currentFieldIndex: index,
    });
  };

  onCloseModal = () => {
    this.setState({
      showModal: false,
      currentFieldIndex: null,
    });
  };

  onCloseProfilesModal = () => {
    this.setState({
      showProfilesModal: false,
      currentFieldIndex: null,
    });
  };

  onSaveFieldProfiles = (updatedField) => {
    const {fields, currentFieldIndex} = this.state;
    fields[currentFieldIndex] = updatedField;
    this.setState({
      fields,
      showProfilesModal: false,
      currentFieldIndex: null,
    });
    this.checkAllFieldsHavePermissions();
  };

  applyToAllFields = (permissions) => {
    const {fields} = this.state;
    const updatedFields = fields.map(field => {
      const updatedProfiles = Object.entries(permissions).reduce((acc, [name, perm]) => {
        if (perm.edit || perm.read) {
          acc.push({
            name,
            access: perm.edit ? "edit" : "read"
          });
        }
        return acc;
      }, []);
      return {...field, profiles: updatedProfiles};
    });

    this.setState({
      fields: updatedFields,
      showProfilesModal: false,
      currentFieldIndex: null
    }, () => {
      // This callback will be executed after the state has been updated
      this.checkAllFieldsHavePermissions();
    });
  };

  onSaveFieldOptions = (updatedField) => {
    const {fields, currentFieldIndex} = this.state;
    fields[currentFieldIndex] = updatedField;
    this.setState({
      fields,
      showModal: false,
      currentFieldIndex: null,
    });
  };

  clearAll = () => {
    location.reload();
  };

  checkAllFieldsHavePermissions = () => {
    if (this.state.fields.filter(field => !field.isExisting).every(field => field.profiles && field.profiles.length > 0)) {
      this.setState({allFieldsHavePermissions: true});
      return true;
    } else {
      this.setState({allFieldsHavePermissions: false});
      return false;
    }
  };

  deploy = () => {
    const {fields, allowFieldUpdates} = this.state;
    this.checkAllFieldsHavePermissions();
    let fieldsToProcess = fields.filter(field => field.deploymentStatus !== "success");

    if (fieldsToProcess.length === 0) {
      this.showInfoModal("Deploy Fields", "All fields have already been successfully deployed.");
      return;
    }

    const updatesPending = fieldsToProcess.filter(field => field.isExisting);

    if (updatesPending.length > 0 && !allowFieldUpdates) {
      fieldsToProcess = fieldsToProcess.filter(field => !field.isExisting);
      if (fieldsToProcess.length === 0) {
        this.showInfoModal("Deploy Fields", `${updatesPending.length} existing field(s) have pending changes, but "Allow updating existing fields" is off. Enable it to save those changes.`);
        return;
      }
      this.showInfoModal(
        "Deploy Fields",
        `${updatesPending.length} existing field(s) will be skipped ("Allow updating existing fields" is off). Only new fields will be deployed.`,
        () => this.runDeploy(fieldsToProcess)
      );
      return;
    }

    if (updatesPending.length > 0) {
      this.setState({showUpdateConfirmModal: true, pendingDeployFields: fieldsToProcess});
      return;
    }

    this.runDeploy(fieldsToProcess);
  };

  confirmDeployUpdates = () => {
    const {pendingDeployFields} = this.state;
    this.setState({showUpdateConfirmModal: false, pendingDeployFields: null});
    this.runDeploy(pendingDeployFields);
  };

  cancelDeployUpdates = () => {
    this.setState({showUpdateConfirmModal: false, pendingDeployFields: null});
  };

  runDeploy = (fieldsToProcess) => {
    const {fields} = this.state;

    const updatedFields = fields.map(field =>
      fieldsToProcess.includes(field)
        ? {...field, deploymentStatus: "pending"}
        : field
    );
    this.setState({fields: updatedFields});

    fieldsToProcess.forEach((field) => {
      const index = fields.findIndex(f => f === field);
      const deployPromise = field.isExisting
        ? this.updateField(field, this.state.selectedObject.name)
        : this.createField(field, this.state.selectedObject.name);

      deployPromise
        .then(() => {
          const newFields = [...this.state.fields];
          newFields[index].deploymentStatus = "success";
          this.setState({fields: newFields});
        })
        .catch(error => {
          const newFields = [...this.state.fields];
          newFields[index].deploymentStatus = "error";
          newFields[index].deploymentError = error.message;
          this.setState({fields: newFields});
        });
    });
  };

  onCloseErrorToast = () => {
    this.setState({fieldErrorMessage: null, errorMessageClickable: false});
  };

  onEnableEntityDefinitionCaching = () => {
    localStorage.setItem("enableEntityDefinitionCaching", true);
    this.setState({fieldErrorMessage: null, errorMessageClickable: false});
    this.fetchObjects();
  };

  showInfoModal = (title, message, onAfterClose) => {
    this.setState({infoModal: {title, message, onAfterClose}});
  };

  closeInfoModal = () => {
    const {onAfterClose} = this.state.infoModal || {};
    this.setState({infoModal: null});
    if (onAfterClose) {
      onAfterClose();
    }
  };

  render() {
    const {fields, showModal, showProfilesModal, currentFieldIndex, selectedObject, filteredObjects} = this.state;
    const isComboboxOpen = filteredObjects.length > 0;
    const hasRetrievedFields = fields.some(field => field.isExisting);

    return (
      h("div", {onClick: () => this.setState({
        filteredObjects: []
      })},
      h(PageHeader, {
        pageTitle: "Field Manager",
        orgName: this.orgName,
        sfLink: this.sfLink,
        sfHost: this.sfHost,
        spinnerCount: this.spinnerCount,
        ...this.userInfoModel.getProps(),
        utilityItems: [
          h("div", {
            key: "help-btn",
            className: "slds-builder-header__utilities-item slds-p-top_x-small slds-p-horizontal_x-small sfir-border-none"
          },
          h("a", {
            href: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/field-manager/",
            target: "_blank",
            title: "Field Manager Help",
            className: "slds-button slds-button_icon slds-button_icon-border-filled"
          },
          h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#question"})
          )
          )
          )
        ]
      }),
      h("div", {
        className: "slds-m-top_xx-large",
        style: {
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 4rem)"
        }
      },
      // Select Object Card
      h("div", {className: "slds-card slds-m-around_medium"},
        h("div", {className: "slds-card__body slds-card__body_inner"},
          h("div", {className: "slds-card__header"},
            h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
              h("div", {className: "slds-media__body"},
                h("h2", {className: "slds-card__header-title"}, "Select Object")
              ),
              selectedObject && h("div", {className: "slds-no-flex"},
                h("a", {
                  href: this.getObjectFieldsLink(selectedObject),
                  target: "_blank",
                  className: "slds-text-link",
                  rel: "noopener noreferrer"
                }, "(Fields)")
              )
            )
          ),
          h("div", {className: "slds-card__body slds-card__body_inner slds-m-top_small"},
            h("div", {className: "slds-form"},
              h("div", {className: "slds-form-element"},
                h("label", {className: "slds-form-element__label", htmlFor: "object_select"}, "Object"),
                h("div", {className: "slds-form-element__control"},
                  h("div", {className: "slds-combobox_container"},
                    h("div", {
                      className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click" + (isComboboxOpen ? " slds-is-open" : ""),
                      "aria-expanded": isComboboxOpen,
                      "aria-haspopup": "listbox",
                      role: "combobox"
                    },
                    h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
                      h("input", {
                        type: "text",
                        id: "object_select",
                        className: "slds-input slds-combobox__input",
                        placeholder: "Search and select object...",
                        value: this.state.objectSearch,
                        onChange: this.handleObjectSearch,
                        role: "textbox",
                        "aria-autocomplete": "list",
                        "aria-controls": "object-select-listbox",
                        autoComplete: "off"
                      }),
                      h("span", {className: "slds-icon_container slds-input__icon slds-input__icon_right"},
                        h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
                          h("use", {xlinkHref: "symbols.svg#search"})
                        )
                      )
                    ),
                    isComboboxOpen && h("div", {
                      id: "object-select-listbox",
                      className: "slds-dropdown slds-dropdown_fluid slds-dropdown_length-10",
                      role: "listbox",
                      onClick: (e) => e.stopPropagation()
                    },
                    h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"},
                      filteredObjects.map(obj =>
                        h("li", {key: obj.name, role: "presentation", className: "slds-listbox__item"},
                          h("div", {
                            className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small",
                            role: "option",
                            onClick: () => this.handleObjectSelect(obj)
                          },
                          h("span", {className: "slds-media__body"},
                            h("span", {className: "slds-truncate"}, `${obj.name} (${obj.label})`)
                          )
                          )
                        )
                      )
                    )
                    )
                    )
                  )
                )
              ),
              h("div", {className: "slds-grid slds-wrap slds-m-top_small"},
                h("div", {className: "slds-form-element slds-m-right_large"},
                  h("label", {className: "slds-checkbox_toggle max-width-small"},
                    h("input", {type: "checkbox", checked: this.state.includeManagedPackage, onChange: this.onUpdateManagedPackageSelection}),
                    h("span", {className: "slds-checkbox_faux_container center-label"},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-checkbox_on"}, "Managed packages included"),
                      h("span", {className: "slds-checkbox_off"}, "Managed packages excluded"),
                    )
                  )
                ),
                h("div", {className: "slds-form-element"},
                  h("label", {className: "slds-checkbox_toggle max-width-small", title: "When off, edits to fields retrieved via 'Retrieve Fields' are skipped on deploy instead of being saved"},
                    h("input", {type: "checkbox", checked: this.state.allowFieldUpdates, onChange: this.onUpdateAllowFieldUpdates}),
                    h("span", {className: "slds-checkbox_faux_container center-label"},
                      h("span", {className: "slds-checkbox_faux"}),
                      h("span", {className: "slds-checkbox_on"}, "Allow updating existing fields"),
                      h("span", {className: "slds-checkbox_off"}, "Existing field updates disabled"),
                    )
                  )
                )
              )
            )
          ),
          h("div", {className: "slds-card__footer slds-grid slds-grid_align-spread slds-wrap slds-grid_vertical-align-center"},
            h("div", {className: "slds-button-group", role: "group"},
              h("button", {type: "button", "aria-label": "Clear Button", className: "slds-button slds-button_neutral", onClick: this.clearAll}, "Clear All"),
              h("button", {type: "button", "aria-label": "Open Import modal button", className: "slds-button slds-button_neutral", onClick: this.openImportModal}, "Import"),
              h("button", {
                type: "button",
                disabled: !this.state.selectedObject || this.isPlatformEvent(selectedObject) || this.state.isRetrievingFields,
                title: this.isPlatformEvent(selectedObject) ? "Retrieving fields isn't supported for Platform Events" : "Retrieve this object's custom fields to edit their label, description, and help text",
                "aria-label": "Retrieve object fields button",
                className: "slds-button slds-button_neutral",
                onClick: this.retrieveFields
              }, this.state.isRetrievingFields ? "Retrieving..." : "Retrieve Fields"),
              h("button", {type: "button", disabled: !this.state.selectedObject || this.state.isRetrievingFields, "aria-label": "Deploy Button", className: "slds-button slds-button_brand", onClick: this.deploy}, "Deploy Fields")
            ),
            !this.state.allFieldsHavePermissions && !this.isPlatformEvent(selectedObject) && h("p", {className: "slds-text-color_error slds-m-top_x-small"}, "Some fields are missing permissions.")
          )
        )
      ),
      // Fields Card
      h("div", {
        className: "slds-card slds-m-around_medium",
        style: {
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column"
        }
      },
      h("div", {className: "slds-card__header slds-grid slds-grid_align-spread"},
        h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
          h("div", {className: "slds-media__body"},
            h("h2", {className: "slds-card__header-title"}, "Fields (" + fields.length + ")")
          )
        ),
        h("div", {className: "slds-button-group", role: "group"},
          h("button", {
            type: "button",
            disabled: !hasRetrievedFields,
            "aria-label": "Download fields as CSV button",
            title: hasRetrievedFields ? "Download the fields table as a CSV file" : "Retrieve fields before exporting the table",
            className: "slds-button slds-button_neutral",
            onClick: this.downloadFieldsCsv
          },
          h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#download"})
          ),
          "Download CSV"
          ),
          h("button", {
            type: "button",
            disabled: !hasRetrievedFields,
            "aria-label": "Copy fields as CSV button",
            title: hasRetrievedFields ? "Copy the fields table as CSV to the clipboard" : "Retrieve fields before exporting the table",
            className: "slds-button slds-button_neutral",
            onClick: this.copyFieldsCsv
          },
          h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#copy"})
          ),
          "Copy CSV"
          ),
          h("button", {
            type: "button",
            disabled: !hasRetrievedFields,
            "aria-label": "Copy fields as Excel button",
            title: hasRetrievedFields ? "Copy the fields table as tab-separated values, for pasting directly into Excel" : "Retrieve fields before exporting the table",
            className: "slds-button slds-button_neutral",
            onClick: this.copyFieldsExcel
          },
          h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#copy"})
          ),
          "Copy Excel"
          )
        )
      ),
      h("div", {
        className: "slds-card__body slds-card__body_inner",
        style: {
          flex: "1 1 0",
          minHeight: 0,
          maxHeight: "100%",
          overflowY: "auto"
        }
      },
      h(FieldsTable, {
        fields,
        selectedObject,
        isPlatformEvent: this.isPlatformEvent,
        getAllowedPlatformEventFieldTypes: this.getAllowedPlatformEventFieldTypes,
        onDelete: this.removeRow,
        onClone: this.cloneRow,
        onLabelChange: this.onLabelChange,
        onNameChange: this.onNameChange,
        onTypeChange: this.onTypeChange,
        onEditOptions: this.onEditOptions,
        onEditProfiles: this.onEditProfiles,
        onShowDeploymentStatus: this.onShowDeploymentStatus
      }),
      h("div", {className: "slds-text-align_right slds-m-top_medium"},
        h("button", {type: "button", "aria-label": "Add Row/New field to table", className: "slds-button slds-button_brand", id: "add_row", onClick: this.addRow}, "Add Row")
      )
      )
      )
      ),
      showProfilesModal && h(ProfilesModal, {
        field: fields[currentFieldIndex],
        permissionSets: this.state.permissionSets,
        onSave: this.onSaveFieldProfiles,
        onClose: this.onCloseProfilesModal,
        onApplyToAllFields: this.applyToAllFields
      }),
      showModal && h(FieldOptionModal, {
        field: fields[currentFieldIndex],
        selectedObject,
        isPlatformEvent: this.isPlatformEvent,
        onSave: this.onSaveFieldOptions,
        onClose: this.onCloseModal
      }),
      h(ConfirmModal, {
        isOpen: this.state.showImportModal,
        title: "CSV Import (beta)",
        onCancel: this.closeImportModal,
        onConfirm: this.importCsv,
        confirmLabel: "Import",
        cancelLabel: "Cancel",
        modalSize: "medium"
      },
      h("p", {className: "slds-m-bottom_small"}, "Enter " + (localStorage.getItem("csvSeparator") || ",") + "  separated values of Label, Name, Type, Description, HelpText (the last two are optional), or paste data copied from Excel. Rows whose Name matches a field retrieved via \"Retrieve Fields\" update that field's Label, Description, and Help Text instead of creating a new row."),
      h("textarea", {
        "aria-label": "CSV import content",
        className: "slds-textarea",
        rows: 8,
        value: this.state.importCsvContent,
        onChange: this.handleImportCsvChange
      }),
      this.state.importError && h("p", {className: "slds-text-color_error slds-m-top_small"}, this.state.importError)
      ),

      h(ConfirmModal, {
        isOpen: this.state.showUpdateConfirmModal,
        title: "Update Existing Fields",
        onCancel: this.cancelDeployUpdates,
        onConfirm: this.confirmDeployUpdates,
        confirmLabel: "Update",
        cancelLabel: "Cancel",
        confirmVariant: "destructive",
        modalSize: "medium"
      },
      h("div", {className: "slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_warning slds-m-bottom_small"},
        h("span", {className: "slds-assistive-text"}, "warning"),
        h("h2", {}, "This will overwrite the Label, Description, and Help Text of existing field(s) on " + (selectedObject ? selectedObject.name : "") + ". This cannot be undone from this tool.")
      ),
      h("ul", {className: "slds-list_dotted"},
        (this.state.pendingDeployFields || []).filter(f => f.isExisting).map(f =>
          h("li", {key: f.fullName || f.name}, `${f.label} (${f.name})`)
        )
      )
      ),

      h(ConfirmModal, {
        isOpen: !!this.state.infoModal,
        title: this.state.infoModal ? this.state.infoModal.title : "",
        onConfirm: this.closeInfoModal,
        confirmLabel: "OK",
        modalSize: "small"
      },
      this.state.infoModal && h("p", {}, this.state.infoModal.message)
      ),

      this.state.fieldErrorMessage && h(Toast, {
        variant: "error",
        title: this.state.fieldErrorMessage,
        message: this.state.errorMessageClickable
          ? {pre: "", linkText: "Click here to enable", onLinkClick: this.onEnableEntityDefinitionCaching, post: ""}
          : "",
        onClose: this.onCloseErrorToast
      })
      )
    );
  }
}

let args = new URLSearchParams(location.search.slice(1));
let sfHost = args.get("host");
initButton(sfHost, true);
sfConn.getSession(sfHost).then(() => {
  let root = document.getElementById("root");
  ReactDOM.render(
    h(App, {
      sfHost
    }),
    root
  );
});
