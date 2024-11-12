let h = React.createElement;

class Toast extends React.Component {
  render() {
    const {variant, title, message, onClose} = this.props;

    // Construct the theme and icon class based on the variant
    const themeClass = `slds-theme_${variant}`;
    const iconClass = `slds-icon-utility-${variant === "success" ? "success" : variant === "error" ? "error" : "info"}`;

    return h("div", {className: "slds-notify_container"},
      h("div", {
        className: `slds-notify slds-notify_toast ${themeClass}`,
        role: "status"
      },
      h("span", {className: "slds-assistive-text"}, title),
      h("span", {
        className: `slds-icon_container ${iconClass} slds-m-right_small slds-no-flex slds-align-top`,
        title: "Description of icon when needed"
      },
      h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
        h("use", {xlinkHref: `symbols.svg#${variant === "success" ? "success" : variant === "error" ? "error" : "info"}`})
      )
      ),
      h("div", {className: "slds-notify__content"},
        h("h2", {className: "slds-text-heading_small"}, title),
        h("p", {}, message)
      ),
      h("div", {className: "slds-notify__close"},
        h("button", {
          className: "slds-button slds-button_icon slds-button_icon-inverse",
          title: "Close",
          onClick: onClose
        },
        h("svg", {className: "slds-button__icon slds-button__icon_large", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#close"})
        ),
        h("span", {className: "slds-assistive-text"}, "Close")
        )
      )
      )
    );
  }
}
export default Toast;
class LookupCombobox extends React.Component{

  render(){
    const {onToggleQueryMenu, onHandleLookupSelection, onSetAsDefault, onToggleSuggestedQuery, onSearchQuery, onQuerySelectionBlur,
      lookupOption, lookupOptions} = this.props;

    return h("div", {className: "slds-combobox-group"},
      h("div", {className: "slds-combobox_object-switcher slds-combobox-addon_start"},
        h("div", {className: "slds-form-element"},
          h("label", {className: "slds-form-element__label slds-assistive-text", htmlFor: "combobox-id-1", id: "combobox-label-id-34"}, "Filter Search by:"),
          h("div", {className: "slds-form-element__control"},
            h("div", {className: "slds-combobox_container"},
              h("div", {ref: "queryMenu", className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click", onClick: () => onToggleQueryMenu, "aria-controls": "primary-combobox-id-1"},
                h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
                  h("div", {
                    role: "combobox",
                    tabIndex: "0",
                    onBlur: () => onToggleQueryMenu,
                    className: "slds-input_faux slds-combobox__input slds-combobox__input-value",
                    "aria-labelledby": "combobox-label-id-34",
                    id: "combobox-id-1-selected-value",
                    "aria-controls": "objectswitcher-listbox-id-1",
                    "aria-expanded": "false",
                    "aria-haspopup": "listbox"
                  },
                  h("span", {className: "option-selected", id: "combobox-value-id-25"}, lookupOption.label)
                  ),
                  h("span", {className: "slds-icon_container slds-icon-utility-down slds-input__icon slds-input__icon_right"},
                    h("svg", {className: "slds-icon slds-icon slds-icon_xx-small slds-icon-text-default", "aria-hidden": "true"},
                      h("use", {xlinkHref: "symbols.svg#down"})
                    )
                  )
                ),
                h("div", {
                  className: "slds-dropdown slds-dropdown_length-5 slds-dropdown_x-small slds-dropdown_left",
                  role: "listbox",
                  "aria-label": "{{Placeholder for Dropdown Items}}",
                  tabIndex: "0",
                  "aria-busy": "false"
                },
                h("ul", {className: "slds-listbox slds-listbox_vertical", role: "group", "aria-label": "{{Placeholder for Dropdown Options}}"},
                  h("li", {role: "presentation", className: "slds-listbox__item"},
                    h("div", {id: "option232", className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small", role: "presentation"},
                      h("h3", {className: "slds-listbox__option-header", role: "presentation"}, "Select Query Type")
                    )
                  ),
                  h("div", {id: "lookup-listbox", role: "listbox", "aria-orientation": "vertical"}, [
                    h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"}, [
                      ...lookupOptions.map((option) =>
                        h("li", {
                          className: "slds-listbox__item",
                          role: "presentation",
                          key: option.key,
                          "data-id": option.key,
                          onMouseDown: (event) => onHandleLookupSelection(option, event)
                        }, [
                          h("div", {
                            id: `option${option.key}`,
                            className: "icon-hover-container slds-media slds-listbox__option slds-listbox__option_plain slds-media_small slds-is-selected",
                            role: "option"
                          }, [
                            h("span", {className: "slds-media__figure slds-listbox__option-icon"}, [
                              h("span", {className: "slds-icon_container slds-icon-utility-check slds-current-color"}, [
                                h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"}, [
                                  h("use", {xlinkHref: `symbols.svg#${option.icon}`})
                                ])
                              ])
                            ]),
                            h("span", {className: "slds-media__body"}, [
                              h("span", {className: "slds-truncate", title: option.label}, option.label)
                            ]),
                            h("button", {className: `slds-icon_container slds-button slds-button_icon slds-input__icon slds-input__icon_right ${option.class}`,
                              title: "Set as default",
                              onClick: (event) => {
                                event.stopPropagation(); //prevent triggering handleQuerySelection
                                onSetAsDefault(option);
                              }},
                            h("svg", {className: "slds-button__icon slds-icon_x-small", "aria-hidden": "true"},
                              h("use", {xlinkHref: "symbols.svg#heart"})
                            )
                            )
                          ])
                        ])
                      )
                    ])
                  ])
                )
                )
              )
            )
          )
        )
      ),
      h("div", {className: "slds-combobox_container slds-combobox-addon_end"},
        h("div", {ref: "querySuggestions", className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click", id: "primary-combobox-id-1"},
          h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
            h("input", {
              type: "text",
              className: "slds-input slds-combobox__input",
              ref: "lookupSearch",
              id: "combobox-id-1",
              "aria-autocomplete": "list",
              "aria-controls": "listbox-id-1",
              "aria-expanded": "false",
              "aria-haspopup": "listbox",
              autoComplete: "off",
              role: "combobox",
              placeholder: "Search query...",
              onClick: () => onToggleSuggestedQuery,
              onKeyUp: () => onSearchQuery(),
              onBlur: () => onQuerySelectionBlur()
            }),
            h("span", {className: "slds-icon_container slds-icon-utility-search slds-input__icon slds-input__icon_right", title: "Search icon"},
              h("svg", {className: "slds-icon slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
                h("use", {xlinkHref: "symbols.svg#search"})
              )
            )
          ),
          h("div", {
            id: "listbox-id-1",
            className: "slds-dropdown slds-dropdown_length-with-icon-7 slds-dropdown_fluid",
            role: "listbox",
            tabIndex: "0",
            "aria-busy": "false"
          },
          h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"},
            model.suggestedQueries.map((query, index) =>
              h("li", {
                role: "presentation",
                className: "slds-listbox__item",
                key: index,
                onMouseDown: () => this.handleQuerySelection(query)
              },
              h("div", {
                id: `option${index}`,
                className: "slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta",
                role: "option"
              },
              h("span", {className: "slds-media__figure slds-listbox__option-icon"},
                h("span", {className: "slds-icon_container slds-icon-standard-account"},
                  h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
                    h("use", {xlinkHref: `symbols.svg#${query.list.icon}`})
                  )
                )
              ),
              h("span", {className: "slds-media__body", title: query.endpoint},
                h("span", {className: "slds-listbox__option-text slds-listbox__option-text_entity"}, query.endpoint),
                h("span", {className: "slds-listbox__option-meta slds-listbox__option-meta_entity"}, query.list.label + " • " + query.method + (query.label ? " • " + query.label : ""))
              ),
              h("button", {className: "slds-button slds-button_icon slds-input__icon slds-input__icon_right",
                title: "Delete Query",
                onClick: (event) => {
                  event.stopPropagation(); //prevent triggering handleQuerySelection
                  this.onDeleteQuery(query);
                }},
              h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
                h("use", {xlinkHref: "symbols.svg#delete"})
              )
              )
              )
              )
            )
          )
          )
        )
      ),
      h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_left-right"},
        h("svg", {className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default"},
          h("use", {xlinkHref: "symbols.svg#save"})
        ),
        h("input", {type: "text", ref: "queryName", id: "queryLabel", className: "slds-input slds-m-left_xx-small", placeholder: "Query Label"}),
        h("button", {onClick: this.onSaveQuery, title: "Save Query", className: "slds-m-left_xx-small"}, "Save")
      )
    );
  }
}
export LookupCombobox;