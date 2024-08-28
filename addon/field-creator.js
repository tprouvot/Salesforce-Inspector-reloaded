/* global React ReactDOM field-creator.js */
import {sfConn, apiVersion} from "./inspector.js";

class ProfilesModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      allEditProfiles: false,
      allReadProfiles: false,
      allEditPermissionSets: false,
      allReadPermissionSets: false,
      searchTerm: "",
      permissions: this.initializePermissions(props.field, props.permissionSets)
    };
  }

  handleSearchChange = (event) => {
    this.setState({searchTerm: event.target.value});
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
          ...(type === "edit" ? {read: true} : {})
        }
      }
    }), this.updateAllCheckboxes);
  };

  handleSelectAll = (type, tableType) => {
    const stateKey = `all${type.charAt(0).toUpperCase() + type.slice(1)}${tableType}`;
    const allSelected = !this.state[stateKey];

    this.setState(prevState => {
      const updatedPermissions = {...prevState.permissions};
      Object.keys(this.props.permissionSets).forEach(name => {
        if ((tableType === "Profiles" && this.props.permissionSets[name] !== null)
          || (tableType === "PermissionSets" && this.props.permissionSets[name] === null)) {
          updatedPermissions[name] = {
            ...updatedPermissions[name],
            [type]: allSelected,
            ...(type === "edit" ? {read: true} : {})
          };
        }
      });

      return {
        [stateKey]: allSelected,
        permissions: updatedPermissions
      };
    }, this.updateAllCheckboxes);
  };

  updateAllCheckboxes = () => {
    const {permissions} = this.state;
    const {permissionSets} = this.props;

    const profilesEntries = Object.entries(permissions).filter(([name]) => permissionSets[name] !== null);
    const permissionSetsEntries = Object.entries(permissions).filter(([name]) => permissionSets[name] === null);

    const allEditProfiles = profilesEntries.every(([_, p]) => p.edit);
    const allReadProfiles = profilesEntries.every(([_, p]) => p.read);
    const allEditPermissionSets = permissionSetsEntries.every(([_, p]) => p.edit);
    const allReadPermissionSets = permissionSetsEntries.every(([_, p]) => p.read);

    this.setState({
      allEditProfiles,
      allReadProfiles,
      allEditPermissionSets,
      allReadPermissionSets
    });
  };

  applyToAllFields = () => {
    const {permissions} = this.state;
    this.props.onApplyToAllFields(permissions);
  };

  render() {
    const {field, permissionSets, onSave, onClose} = this.props;
    const {
      permissions,
      allEditProfiles,
      allReadProfiles,
      allEditPermissionSets,
      allReadPermissionSets,
      searchTerm
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

    const renderTable = (items, title) =>
      React.createElement("div", {key: title},
        React.createElement("h5", null, title),
        React.createElement("table", {style: {width: "100%", borderCollapse: "collapse", marginBottom: "20px"}},
          React.createElement("thead", null,
            React.createElement("tr", null,
              React.createElement("th", {style: {padding: "8px", textAlign: "left", borderBottom: "1px solid #ddd"}}, "Name"),
              React.createElement("th", {style: {padding: "8px", textAlign: "center", borderBottom: "1px solid #ddd"}},
                React.createElement("div", {style: {display: "flex", alignItems: "center", justifyContent: "center"}},
                  React.createElement("span", {style: {marginRight: "5px"}}, "Edit"),
                  React.createElement("input", {
                    type: "checkbox",
                    checked: title === "Profiles" ? allEditProfiles : allEditPermissionSets,
                    onChange: () => this.handleSelectAll("edit", title.replace(" ", ""))
                  })
                )
              ),
              React.createElement("th", {style: {padding: "8px", textAlign: "center", borderBottom: "1px solid #ddd"}},
                React.createElement("div", {style: {display: "flex", alignItems: "center", justifyContent: "center"}},
                  React.createElement("span", {style: {marginRight: "5px"}}, "Read"),
                  React.createElement("input", {
                    type: "checkbox",
                    checked: title === "Profiles" ? allReadProfiles : allReadPermissionSets,
                    onChange: () => this.handleSelectAll("read", title.replace(" ", ""))
                  })
                )
              )
            )
          ),
          React.createElement("tbody", null,
            items.map(([name, profile]) =>
              React.createElement("tr", {key: name},
                React.createElement("td", {style: {padding: "8px", borderBottom: "1px solid #ddd"}}, profile || name),
                React.createElement("td", {style: {padding: "8px", textAlign: "center", borderBottom: "1px solid #ddd"}},
                  React.createElement("input", {
                    type: "checkbox",
                    checked: permissions[name].edit,
                    onChange: () => this.handlePermissionChange(name, "edit")
                  })
                ),
                React.createElement("td", {style: {padding: "8px", textAlign: "center", borderBottom: "1px solid #ddd"}},
                  React.createElement("input", {
                    type: "checkbox",
                    checked: permissions[name].read,
                    onChange: () => this.handlePermissionChange(name, "read")
                  })
                )
              )
            )
          )
        )
      );

    return React.createElement("div", {
      style: {
        display: "block",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1050,
        overflowY: "auto"
      }
    },
    React.createElement("div", {
      className: "modal-dialog",
      style: {
        overflowY: "overlay",
        position: "absolute",
        top: "50%",
        left: "50%",
        maxHeight: "80%",
        transform: "translate(-50%, -50%)",
        maxWidth: "600px",
        width: "90%",
        backgroundColor: "#fff",
        padding: "20px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px"
      }
    },
    React.createElement("div", {
      className: "modal-content",
      style: {
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }
    },
    React.createElement("div", {
      className: "modal-header",
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "15px"
      }
    },
    React.createElement("h1", {className: "modal-title"}, "Set Field Permissions"),
    React.createElement("button", {
      type: "button",
      "aria-label": "Close permission modal button",
      className: "close",
      onClick: onClose,
      style: {
        cursor: "pointer",
        background: "none",
        border: "none",
        fontSize: "1.5rem",
        fontWeight: "bold"
      }
    }, "×")
    ),
    React.createElement("div", {
      className: "modal-body",
      style: {
        overflowY: "auto",
        flexGrow: 1,
        marginRight: "-10px", // To compensate for the scrollbar width
        paddingRight: "10px",
        scrollbarWidth: "thin",
        scrollbarColor: "#B0C4DF transparent"
      }
    },
    React.createElement("input", {
      type: "text",
      placeholder: "Search profiles and permission sets...",
      value: this.state.searchTerm,
      onChange: this.handleSearchChange,
      style: {
        width: "100%",
        padding: "8px",
        border: "1px solid #ccc",
        borderRadius: "4px"
      }
      
    }),React.createElement("p", {},"Profile permissions are set to the converted permission set."),
    renderTable(profiles, "Profiles"),
    renderTable(permissionSetsOnly, "Permission Sets")
    ),
    React.createElement("div", {
      className: "modal-footer",
      style: {
        marginTop: "15px",
        display: "flex",
        justifyContent: "flex-end"
      }
    },
    React.createElement("button", {
      type: "button",
      "aria-label": "Close button",
      className: "btn btn-default",
      onClick: onClose,
      style: {marginRight: "10px"}
    }, "Close"),
    React.createElement("button", {
      type: "button",
      "aria-label": "Save permission for this field",
      className: "btn btn-primary highlighted",
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
      },
      style: {marginRight: "10px"}
    }, "Save"),
    React.createElement("button", {
      "aria-label": "Apply the permission to all fields in the table",
      type: "button",
      className: "btn btn-secondary",
      onClick: this.applyToAllFields
    }, "Apply to All Fields")
    )
    )
    )
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
    switch (field.type) {
      case "Checkbox":
        return React.createElement("div", {className: "field_options Checkbox_options"},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", null, "Default Value"),
            React.createElement("div", {className: "radio"},
              React.createElement("label", null,
                React.createElement("input", {
                  type: "radio",
                  name: "checkboxDefault",
                  value: "checked",
                  checked: field.checkboxDefault === "checked",
                  onChange: this.handleInputChange
                }),
                " Checked"
              )
            ),
            React.createElement("div", {className: "radio"},
              React.createElement("label", null,
                React.createElement("input", {
                  type: "radio",
                  name: "checkboxDefault",
                  value: "unchecked",
                  checked: field.checkboxDefault === "unchecked",
                  onChange: this.handleInputChange
                }),
                " Unchecked"
              )
            )
          ),
          this.renderDescriptionAndHelpText()
        );

      case "Currency":
        return React.createElement("div", {className: "field_options Currency_options"},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: "currencyLength"}, "Length"),
            React.createElement("input", {
              type: "text",
              id: "currencyLength",
              name: "precision",
              className: "form-control input-textBox",
              placeholder: "Max is 18 - Decimal Places",
              value: field.precision,
              onChange: this.handleInputChange
            })
          ),
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: "currencyDecimalPlaces"}, "Decimal Places"),
            React.createElement("input", {
              type: "text",
              id: "currencyDecimalPlaces",
              name: "decimal",
              className: "form-control input-textBox",
              placeholder: "Max is 18 - Length",
              value: field.decimal,
              onChange: this.handleInputChange
            })
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "Date":
      case "DateTime":
      case "Email":
      case "Phone":
      case "Url":
        return React.createElement("div", {className: `field_options ${field.type}_options`},
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox(),
          field.type === "Email" && this.renderUniqueCheckbox(),
          field.type === "Email" && this.renderExternalIdCheckbox()
        );

      case "Location":
        return React.createElement("div", {className: "field_options Location_options"},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", null, "Latitude and Longitude Display Notation"),
            React.createElement("div", {className: "radio"},
              React.createElement("label", null,
                React.createElement("input", {
                  type: "radio",
                  name: "geodisplay",
                  value: "degrees",
                  checked: field.geodisplay === "degrees",
                  onChange: this.handleInputChange
                }),
                " Degrees, Minutes, Seconds"
              )
            ),
            React.createElement("div", {className: "radio"},
              React.createElement("label", null,
                React.createElement("input", {
                  type: "radio",
                  name: "geodisplay",
                  value: "decimal",
                  checked: field.geodisplay === "decimal",
                  onChange: this.handleInputChange
                }),
                " Decimal"
              )
            )
          ),
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: "geolocationDecimalPlaces"}, "Decimal Places"),
            React.createElement("input", {
              type: "text",
              id: "geolocationDecimalPlaces",
              name: "decimal",
              className: "form-control input-textBox",
              value: field.decimal,
              onChange: this.handleInputChange
            })
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "Number":
      case "Percent":
        return React.createElement("div", {className: `field_options ${field.type}_options`},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: `${field.type.toLowerCase()}Length`}, "Length"),
            React.createElement("input", {
              type: "text",
              id: `${field.type.toLowerCase()}Length`,
              name: "precision",
              className: "form-control input-textBox",
              placeholder: "Max is 18 less Decimal Places",
              value: field.precision,
              onChange: this.handleInputChange
            })
          ),
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: `${field.type.toLowerCase()}DecimalPlaces`}, "Decimal Places"),
            React.createElement("input", {
              type: "text",
              id: `${field.type.toLowerCase()}DecimalPlaces`,
              name: "decimal",
              className: "form-control input-textBox",
              placeholder: "Max is 18 less Length",
              value: field.decimal,
              onChange: this.handleInputChange
            })
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox(),
          field.type === "Number" && this.renderUniqueCheckbox(),
          field.type === "Number" && this.renderExternalIdCheckbox()
        );

      case "Picklist":
      case "MultiselectPicklist":
        return React.createElement("div", {className: `field_options ${field.type}_options`},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: `${field.type.toLowerCase()}Options`}, "Picklist Values"),
            React.createElement("textarea", {
              id: `${field.type.toLowerCase()}Options`,
              name: "picklistvalues",
              className: "form-control",
              rows: "5",
              placeholder: "Enter picklist values separated by line breaks.",
              value: field.picklistvalues,
              onChange: this.handleInputChange
            })
          ),
          React.createElement("div", {className: "checkbox"},
            React.createElement("label", null,
              React.createElement("input", {
                type: "checkbox",
                id: `${field.type.toLowerCase()}SortAlpha`,
                name: "sortalpha",
                checked: field.sortalpha,
                onChange: this.handleInputChange
              }),
              " Sort values alphabetically"
            )
          ),
          React.createElement("div", {className: "checkbox"},
            React.createElement("label", null,
              React.createElement("input", {
                type: "checkbox",
                id: `${field.type.toLowerCase()}FirstValueDefault`,
                name: "firstvaluedefault",
                checked: field.firstvaluedefault,
                onChange: this.handleInputChange
              }),
              " Use first value as default"
            )
          ),
          //this.renderRestrictToDefinedValues(),
          field.type === "MultiselectPicklist" && React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: "picklist-multiVisibleLines"}, "# Visible Lines"),
            React.createElement("input", {
              type: "text",
              id: "picklist-multiVisibleLines",
              name: "vislines",
              className: "form-control input-textBox",
              placeholder: "This field is required.",
              value: field.vislines,
              onChange: this.handleInputChange
            })
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "Text":
        return React.createElement("div", {className: "field_options Text_options"},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: "textLength"}, "Length"),
            React.createElement("input", {
              type: "text",
              id: "textLength",
              name: "length",
              className: "form-control input-textBox",
              placeholder: "Max is 255 characters.",
              value: field.length || 255,
              onChange: this.handleInputChange
            })
          ),
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox(),
          this.renderUniqueCheckbox(),
          this.renderExternalIdCheckbox()
        );

      case "TextArea":
        return React.createElement("div", {className: "field_options TextArea_options"},
          this.renderDescriptionAndHelpText(),
          this.renderRequiredCheckbox()
        );

      case "LongTextArea":
      case "Html":
        return React.createElement("div", {className: `field_options ${field.type}_options`},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: `${field.type.toLowerCase()}Length`}, "Length"),
            React.createElement("input", {
              type: "text",
              id: `${field.type.toLowerCase()}Length`,
              name: "length",
              className: "form-control",
              placeholder: "Max is 131,072 characters.",
              value: field.length,
              onChange: this.handleInputChange
            })
          ),
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: `${field.type.toLowerCase()}VisibleLines`}, "# Visible Lines"),
            React.createElement("input", {
              type: "text",
              id: `${field.type.toLowerCase()}VisibleLines`,
              name: "vislines",
              className: "form-control",
              placeholder: "This field is required.",
              value: field.vislines,
              onChange: this.handleInputChange
            })
          ),
          this.renderDescriptionAndHelpText()
        );

      default:
        return null;
    }
  };

  renderDescriptionAndHelpText = () => {
    const {field} = this.state;
    return React.createElement("div", null,
      React.createElement("div", {className: "form-group"},
        React.createElement("label", {htmlFor: "description"}, "Description"),
        React.createElement("textarea", {
          id: "description",
          name: "description",
          className: "form-control",
          rows: "3",
          value: field.description || "",
          onChange: this.handleInputChange
        })
      ),
      React.createElement("div", {className: "form-group"},
        React.createElement("label", {htmlFor: "helpText"}, "Help Text"),
        React.createElement("textarea", {
          id: "helpText",
          name: "helptext",
          className: "form-control",
          rows: "3",
          value: field.helptext || "",
          onChange: this.handleInputChange
        })
      )
    );
  };

  renderRestrictToDefinedValues = () => {
    const {field} = this.state;
    return React.createElement("div", {className: "checkbox"},
      React.createElement("label", null,
        React.createElement("input", {
          type: "checkbox",
          id: "restrictToDefinedValues",
          name: "restrictToDefinedValues",
          checked: field.restrictToDefinedValues || false,
          onChange: this.handleInputChange
        }),
        " Restrict picklist to the values defined in the value set"
      )
    );
  };

  renderRequiredCheckbox = () => {
    const {field} = this.state;
    return React.createElement("div", {className: "checkbox"},
      React.createElement("label", null,
        React.createElement("input", {
          type: "checkbox",
          id: "required",
          name: "required",
          checked: field.required,
          onChange: this.handleInputChange
        }),
        " Required"
      )
    );
  };

  renderUniqueCheckbox = () => {
    const {field} = this.state;
    return React.createElement("div", {className: "checkbox"},
      React.createElement("label", null,
        React.createElement("input", {
          type: "checkbox",
          id: "unique",
          name: "uniqueSetting",
          checked: field.uniqueSetting,
          onChange: this.handleInputChange
        }),
        " Unique"
      )
    );
  };

  renderExternalIdCheckbox = () => {
    const {field} = this.state;
    return React.createElement("div", {className: "checkbox"},
      React.createElement("label", null,
        React.createElement("input", {
          type: "checkbox",
          id: "externalId",
          name: "external",
          checked: field.external,
          onChange: this.handleInputChange
        }),
        " External ID"
      )
    );
  };

  render() {
    return React.createElement("div", {
      className: "modal fade show",
      id: "fieldOptionModal",
      role: "dialog",
      "aria-labelledby": "fieldOptionModalLabel",
      "aria-hidden": "true",
      style: {
        display: "block",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1050,
        overflowY: "auto"
      }
    },
    React.createElement("div", {
      className: "modal-dialog",
      style: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "500px",
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto",
        backgroundColor: "#fff",
        padding: "20px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px"
      }
    },
    React.createElement("div", {className: "modal-content", style: {border: "none", backgroundColor: "transparent"}},
      React.createElement("div", {className: "modal-header", style: {borderBottom: "none", padding: "0 0 10px 0", position: "relative"}},
        React.createElement("h4", {className: "modal-title", style: {textAlign: "center", width: "100%", margin: "0"}}, "Set Field Options"),
        React.createElement("button", {
          "aria-label": "Close Button",
          type: "button",
          className: "close",
          onClick: this.props.onClose,
          style: {
            position: "absolute",
            right: "0",
            top: "0",
            background: "transparent",
            border: "none",
            fontSize: "24px",
            cursor: "pointer"
          }
        },
        React.createElement("span", {"aria-hidden": "true"}, "×")
        )
      ),
      React.createElement("div", {
        className: "modal-body",
        style: {
          padding: "10px 0 20px 0",
          maxHeight: "calc(90vh - 150px)", // Adjust based on header and footer height
          overflowY: "auto"
        }
      },
      this.renderFieldOptions()
      ),
      React.createElement("div", {
        className: "modal-footer",
        style: {
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 0 0 0",
          borderTop: "1px solid #e5e5e5"
        }
      },
      React.createElement("button", {
        "aria-label": "Close Button",
        className: "btn btn-secondary",
        onClick: this.props.onClose,

      }, "Cancel"),
      React.createElement("button", {
        "aria-label": "Save options button",
        className: "btn btn-primary highlighted",
        onClick: this.handleSave,

      }, "Save")
      )
    )
    )
    );
  }
}


// Define the React components
class FieldRow extends React.Component {
  render() {
    document.title = "Field Creator";

    let deploymentStatus;
    switch (this.props.field.deploymentStatus) {
      case "pending":
        deploymentStatus = React.createElement("svg", {
          className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small",
          viewBox: "0 0 52 52",
          style: {width: "20px"}
        },
        React.createElement("use", {xlinkHref: "symbols.svg#clock", style: {fill: "#005fb2"}})
        );
        break;
      case "success":
        deploymentStatus = React.createElement("svg", {
          className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small",
          viewBox: "0 0 52 52",
          style: {width: "20px"}
        },
        React.createElement("use", {xlinkHref: "symbols.svg#success", style: {fill: "#2e844a"}})
        );
        break;
      case "error":
        deploymentStatus = React.createElement("svg", {
          className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small",
          viewBox: "0 0 52 52",
          style: {width: "20px"}
        },
        React.createElement("use", {xlinkHref: "symbols.svg#error", style: {fill: "#ba0517"}})
        );
        break;
      default:
        deploymentStatus = "";
    }

    return (
      React.createElement("tr", null,
        React.createElement("td", {className: "text-center", style: {verticalAlign: "middle"}},
          React.createElement("div", {className: "text-center", style: {verticalAlign: "middle"}},
            React.createElement("svg", {
              className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small",
              viewBox: "0 0 52 52",
              onClick: () => this.props.onClone(this.props.index),
              style: {cursor: "pointer", width: "20px"}
            },
            React.createElement("use", {xlinkHref: "symbols.svg#clone", style: {fill: "#005fb2"}})
            )
          )
        ),
        React.createElement("td", {className: "text-center", style: {verticalAlign: "middle"}},
          React.createElement("div", {className: "text-center", style: {verticalAlign: "middle"}},
            React.createElement("svg", {
              className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small",
              viewBox: "0 0 52 52",
              onClick: () => this.props.onDelete(this.props.index),
              style: {cursor: "pointer", width: "20px"}
            },
            React.createElement("use", {xlinkHref: "symbols.svg#delete", style: {fill: "#9c9c9c"}})
            )
          )
        ),
        React.createElement("td", {className: "form-control-cell", style: {verticalAlign: "middle"}},
          React.createElement("div", {style: {display: "flex", justifyContent: "center"}},
            React.createElement("input", {
              type: "text",
              className: "input-textBox",
              placeholder: "Field label...",
              value: this.props.field.label,
              onChange: (e) => this.props.onLabelChange(this.props.index, e.target.value)
            })
          )
        ),
        React.createElement("td", {className: "form-control-cell", style: {verticalAlign: "middle"}},
          React.createElement("div", {style: {display: "flex", justifyContent: "center"}},
            React.createElement("input", {
              type: "text",
              className: "input-textBox",
              placeholder: "Field name...",
              value: this.props.field.name,
              onChange: (e) => this.props.onNameChange(this.props.index, e.target.value)
            })
          )
        ),
        React.createElement("td", {className: "form-control-cell", style: {verticalAlign: "middle"}},
          React.createElement("div", {style: {display: "flex", justifyContent: "center"}},
            React.createElement("select", {
              className: "form-control",
              value: this.props.field.type,
              onChange: (e) => this.props.onTypeChange(this.props.index, e.target.value)
            },
            React.createElement("option", {value: "Checkbox"}, "Checkbox"),
            React.createElement("option", {value: "Currency"}, "Currency"),
            React.createElement("option", {value: "Date"}, "Date"),
            React.createElement("option", {value: "DateTime"}, "Date / Time"),
            React.createElement("option", {value: "Email"}, "Email"),
            React.createElement("option", {value: "Location"}, "Geolocation"),
            React.createElement("option", {value: "Number"}, "Number"),
            React.createElement("option", {value: "Percent"}, "Percent"),
            React.createElement("option", {value: "Phone"}, "Phone"),
            React.createElement("option", {value: "Picklist"}, "Picklist"),
            React.createElement("option", {value: "MultiselectPicklist"}, "Picklist (Multi-Select)"),
            React.createElement("option", {value: "Text"}, "Text"),
            React.createElement("option", {value: "TextArea"}, "Text Area"),
            React.createElement("option", {value: "LongTextArea"}, "Text Area (Long)"),
            React.createElement("option", {value: "Html"}, "Text Area (Rich)"),
            React.createElement("option", {value: "Url"}, "URL")
            )
          )
        ),
        React.createElement("td", null,
          React.createElement("button", {
            "aria-label": "Open options modal for this field button",
            className: "btn btn-sm btn100",
            onClick: () => this.props.onEditOptions(this.props.index)
          }, "Options")
        ),
        React.createElement("td", null,
          React.createElement("button", {
            "aria-label": "Open permission modal for this field button",
            className: "btn btn-sm btn100",
            onClick: () => this.props.onEditProfiles(this.props.index)
          }, "Permissions")
        ),
        React.createElement("td", {className: "text-center", style: {verticalAlign: "middle"}},
          React.createElement("div", {
            className: "text-center",
            style: {verticalAlign: "middle", fontSize: "20px", cursor: "pointer"},
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
  render() {
    return (
      React.createElement("div", {className: "table-responsive", style: {overflowX: "auto", maxWidth: "100%"}},
        React.createElement("table", {
          className: "table table-hover",
          id: "fields_table",
          style: {
            width: "100%",
            maxWidth: "1000px", // Adjust this value as needed
            margin: "0 auto", // This centers the table
          }
        },
        React.createElement("thead", null,
          React.createElement("tr", null,
            React.createElement("th", {style: {width: "5%"}}),
            React.createElement("th", {style: {width: "5%"}}),
            React.createElement("th", {style: {width: "20%"}}, "Label"),
            React.createElement("th", {style: {width: "20%"}}, "API Name (__c)"), // make the lables/th clearly part of the table.
            React.createElement("th", {style: {width: "20%"}}, "Type"),
            React.createElement("th", {style: {width: "10%"}}, "Options"),
            React.createElement("th", {style: {width: "10%"}}, "Permissions"),
            React.createElement("th", {style: {width: "10%"}})
          )
        ),
        React.createElement("tbody", null,
          this.props.fields.map((field, index) =>
            React.createElement(FieldRow, {
              key: index,
              index,
              field,
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
    this.state = {
      objects: [],
      profiles: [],
      permissionSets: {},
      fields: [{label: "", name: "", type: "Text"}],
      showProfilesModal: false,
      currentFieldIndex: null,
      showModal: false,
      showImportModal: false,
      importCsvContent: "",
      importError: "",
      userInfo: "..."
    };
  }

  componentDidMount() {
    this.fetchObjects();
    this.fetchPermissionSets();
    this.fetchUserInfo();
  }


  fetchUserInfo() {
    const wsdl = sfConn.wsdl(apiVersion, "Partner");
    sfConn.soap(wsdl, "getUserInfo", {})
      .then(res => {
        const userInfo = `${res.userFullName} / ${res.userName} / ${res.organizationName}`;
        this.setState({ userInfo });
      })
      .catch(err => {
        console.error("Error fetching user info:", err);
      });
  }


  setFieldPermissions(field, fieldId, objectName) {
    const accessToken = sfConn.sessionId;
    const instanceUrl = `https://${sfConn.instanceHostname}`;
    const fieldPermissionUrl = `${instanceUrl}/services/data/v${apiVersion}/sobjects/FieldPermissions/`;

    const permissionPromises = field.profiles.map(profile => {
      const permissionSetId = this.state.permissionSetMap[profile.name] || profile.name;
      const fieldPermissionBody = {
        ParentId: permissionSetId,
        SobjectType: objectName,
        Field: `${objectName}.${field.name}__c`,
        PermissionsEdit: profile.access === "edit",
        PermissionsRead: profile.access === "edit" || profile.access === "read"
      };

      return fetch(fieldPermissionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(fieldPermissionBody)
      })
        .then(response => response.json());
    });

    return Promise.all(permissionPromises);
  }


  createField(field, objectName) {
    const accessToken = sfConn.sessionId;
    const instanceUrl = `https://${sfConn.instanceHostname}`;
    const metadataUrl = `${instanceUrl}/services/data/v${apiVersion}/tooling/sobjects/CustomField`;

    const newField = {
      FullName: `${objectName}.${field.name}__c`,
      Metadata: {
        label: field.label,
        type: this.mapFieldType(field.type),
        description: field.description,
        inlineHelpText: field.helptext,
        required: field.required || false,
        unique: field.uniqueSetting || false,
        externalId: field.external || false,
        trackFeedHistory: false,
        trackHistory: false,
        trackTrending: false
      }
    };

    // Add specific options based on field type
    switch (field.type) {
      case "Checkbox":
        newField.Metadata.defaultValue = field.checkboxDefault === "checked";
        break;

      case "Currency":
      case "Number":
      case "Percent":
        newField.Metadata.precision = parseInt(field.precision) || 18;
        newField.Metadata.scale = parseInt(field.decimal) || 0;
        break;

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
            value: field.picklistvalues.split("\n").map((value, index) => ({
              fullName: value.trim(),
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

    return fetch(metadataUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newField)
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(JSON.stringify(errorData));
          });
        }
        return response.json();
      })
      .then(data => this.setFieldPermissions(field, data.id, objectName))
      .catch(error => {
        console.error("Error creating field:", error);
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

  fetchObjects = () => { //Check objects if globaldescribe is cached / implement this? EntitiDefinition
    const accessToken = sfConn.sessionId;
    const instanceUrl = `https://${sfConn.instanceHostname}`;
    const objectsUrl = `${instanceUrl}/services/data/v${apiVersion}/sobjects`;

    fetch(objectsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    })
      .then(response => response.json())
      .then(data => {
        this.setState({objects: data.sobjects});
      })
      .catch(error => {
        console.error("Error fetching objects:", error);
      });
  };



  fetchPermissionSets = () => {
    const accessToken = sfConn.sessionId;
    const instanceUrl = `https://${sfConn.instanceHostname}`;
    const permissionSetsUrl = `${instanceUrl}/services/data/v${apiVersion}/query/?q=SELECT+Id,Name,Profile.Name+FROM+PermissionSet`;

    fetch(permissionSetsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    })
      .then(response => response.json())
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

  addRow = () => {
    this.setState((prevState) => ({
      fields: [...prevState.fields, {label: "", name: "", type: "Text"}],
    }));
  };

  removeRow = (index) => {
    this.setState((prevState) => ({
      fields: prevState.fields.filter((_, i) => i !== index),
    }));
  };

  cloneRow = (index) => {
    this.setState((prevState) => ({
      fields: [...prevState.fields, prevState.fields[index]],
    }));
  };

  onLabelChange = (index, label) => {
    this.setState((prevState) => ({
      fields: prevState.fields.map((field, i) =>
        i === index
          ? {
            ...field,
            label,
            name: label.replace(/\s+/g, "_")
          }
          : field
      ),
    }));
  };

  onNameChange = (index, name) => {
    this.setState((prevState) => ({
      fields: prevState.fields.map((field, i) =>
        i === index ? {...field, name} : field
      ),
    }));
  };

  onTypeChange = (index, type) => {
    this.setState((prevState) => ({
      fields: prevState.fields.map((field, i) =>
        i === index ? {...field, type} : field
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
    const {importCsvContent} = this.state;
    const separator = localStorage.getItem("csvSeparator") ? localStorage.getItem("csvSeparator") : ",";
    const lines = importCsvContent.split("\n");
    const newFields = [];
    let hasError = false;

    const validTypes = [
      "Checkbox", "Currency", "Date", "DateTime", "Email", "Location", "Number",
      "Percent", "Phone", "Picklist", "MultiselectPicklist", "Text", "TextArea",
      "LongTextArea", "Html", "Url"
    ];
    lines.forEach((line, index) => {
      const [label, name, type] = line.split(separator).map(item => item.trim());
      if (label && name && type) {
        if (validTypes.includes(type)) {
          newFields.push({label, name, type});
        } else {
          this.setState({importError: `Invalid type "${type}" on line ${index + 1}`});
          hasError = true;
        }
      }
    });

    if (!hasError) {
      this.setState(prevState => ({
        fields: [...prevState.fields, ...newFields],
        showImportModal: false,
        importCsvContent: "",
        importError: ""
      }));
    }
  };


  onShowDeploymentStatus = (index) => {
    const field = this.state.fields[index];
    if (field.deploymentStatus === "error") {
      let errorMessage = "Deployment Error";
      try {
        const errorData = JSON.parse(field.deploymentError);
        errorMessage = errorData[0]?.message || errorMessage;
      } catch (e) {
        console.err("Catch error" + e);
        errorMessage = field.deploymentError || errorMessage;
      }
      alert(`Deployment Error: ${errorMessage}`);
    } else if (field.deploymentStatus === "success") {
      alert("Field deployed successfully");
    } else if (field.deploymentStatus === "pending") {
      alert("Field deployment is in progress");
    } else {
      alert("Field has not been deployed yet");
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
      currentFieldIndex: null});
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

  deploy = () => {
    const {fields, selectedObject} = this.state;
    if (!selectedObject) {
      alert("Please select an object first");
      return;
    }

    const fieldsToProcess = fields.filter(field => field.deploymentStatus !== "success");

    if (fieldsToProcess.length === 0) {
      alert("All fields have already been successfully deployed.");
      return;
    }

    const updatedFields = fields.map(field =>
      field.deploymentStatus !== "success"
        ? {...field, deploymentStatus: "pending"}
        : field
    );
    this.setState({fields: updatedFields});

    fieldsToProcess.forEach((field) => {
      const index = fields.findIndex(f => f === field);
      this.createField(field, selectedObject)
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

  render() {
    const {fields, showModal, showProfilesModal, currentFieldIndex,userInfo } = this.state;

    return (
      React.createElement("div", null,
        React.createElement("div", {id: "user-info"},
          React.createElement("a", {href: `https://${sfConn.instanceHostname}`, className: "sf-link"},
            React.createElement("svg", {viewBox: "0 0 24 24"},
              React.createElement("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
            ),
            " Salesforce Home"
          ),
          React.createElement("h1", {}, "Field Creator"),
          React.createElement("span", {}, " / " + userInfo),
          React.createElement("div", {className: "flex-right"},
            React.createElement("span", {className: "slds-assistive-text"}),
            React.createElement("div", {className: "slds-spinner__dot-a"}),
            React.createElement("div", {className: "slds-spinner__dot-b"}),
          ),
          React.createElement("a", {href: "#", id: "help-btn", title: "Export Help", onClick: null},
            React.createElement("div", {className: "icon"})
          ),
        ),
        React.createElement("div", {className: "area firstHeader"},
          React.createElement("div", {className: "form-group"},
            React.createElement("label", {htmlFor: "object_select"}, "Select Object"),
            React.createElement("br", null),
            React.createElement("select", {
              className: "form-control",
              id: "object_select",
              style: {width: "400px"},
              value: this.state.selectedObject,
              onChange: (e) => this.setState({selectedObject: e.target.value})
            },
            React.createElement("option", {value: ""}, "Select object to create fields for...."),
            this.state.objects.map((obj) =>
              React.createElement("option", {key: obj.name, value: obj.name},
                obj.name, " (", obj.label, ")"
              )
            )
            )
          )
          ,
          React.createElement("br", null),
          React.createElement("div", {className: "col-xs-12 text-center", id: "deploy"},
            React.createElement("button", {"aria-label": "Clear Button",className: "btn btn-large", onClick: this.clearAll}, "Clear All"),
            React.createElement("button", {"aria-label": "Open Import CSV modal button",className: "btn btn-large", onClick: this.openImportModal}, "Import CSV"),
            React.createElement("button", {"aria-label": "Deploy Button", className: "btn btn-large highlighted", onClick: this.deploy}, "Deploy Fields"),
            React.createElement("br", null)
          )),
        React.createElement("div", {className: "area"},
          React.createElement(FieldsTable, {
            fields,
            onDelete: this.removeRow,
            onClone: this.cloneRow,
            onLabelChange: this.onLabelChange,
            onNameChange: this.onNameChange,
            onTypeChange: this.onTypeChange,
            onEditOptions: this.onEditOptions,
            onEditProfiles: this.onEditProfiles,
            onShowDeploymentStatus: this.onShowDeploymentStatus
          }),
          React.createElement("button", {"aria-label": "Add Row/New field to table",className: "btn btn-sm highlighted", id: "add_row", onClick: this.addRow, style: {maxWidth: "18%"}}, "Add Row")
        ),

        showProfilesModal && React.createElement(ProfilesModal, {
          field: fields[currentFieldIndex],
          permissionSets: this.state.permissionSets,
          onSave: this.onSaveFieldProfiles,
          onClose: this.onCloseProfilesModal,
          onApplyToAllFields: this.applyToAllFields
        }),
        showModal && React.createElement(FieldOptionModal, {
          field: fields[currentFieldIndex],
          onSave: this.onSaveFieldOptions,
          onClose: this.onCloseModal
        }),
        this.state.showImportModal && React.createElement("div", {
          style: {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000
          }
        },
        React.createElement("div", {
          style: {
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            width: "500px",
            maxWidth: "90%"
          }
        },
        React.createElement("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px"
          }
        },
        React.createElement("h2", null, "CSV Import (beta)"),
        React.createElement("button", {
          onClick: this.closeImportModal,
          "aria-label": "Close Import Modal",
          style: {
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer"
          }
        }, "×")
        ),
        React.createElement("p", null, "Enter comma separated values of Label, ApiName, Type (Set the separator in Data Export options). "),
        React.createElement("textarea", {
          value: this.state.importCsvContent,
          onChange: this.handleImportCsvChange,
          style: {
            width: "100%",
            height: "200px",
            marginBottom: "15px"
          }
        }),
        this.state.importError && React.createElement("p", {style: {color: "red"}}, this.state.importError),
        React.createElement("div", {
          style: {
            display: "flex",
            justifyContent: "flex-end"
          }
        },
        React.createElement("button", {
          "aria-label": "Cancel button",
          onClick: this.closeImportModal,
          style: {marginRight: "10px"}
        }, "Cancel"),
        React.createElement("button", {
          "aria-label": "Import button",
          onClick: this.importCsv,
          className: "btn btn-primary"
        }, "Import")
        )
        )
        )
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
    React.createElement(App, {
      sfHost
    }),
    root
  );
});

