let h = React.createElement;

class Combobox extends React.Component {
  constructor(props) {
    super(props);
    this.model = props.model;
    this.savedQueryHistoryKey = props.savedQueryHistoryKey;
    this.templateKey = props.templateKey;
    this.queryHistoryKey = props.queryHistoryKey;
    this.defaultTypeKey = props.defaultTypeKey;
    this.queryHistory = props.queryHistory;
    this.savedHistory = props.savedHistory;
    this.templates = props.templates;
    this.searchProperties = props.searchProperties;
    this.displayProperties = props.displayProperties;
    this.onItemSelection = props.onItemSelection; // External handler function
    this.lookupOptions = [{key: "all", label: "All Types", class: "icon-hover", icon: "filter"}, {key: "history", label: "History", icon: "recent", class: "icon-hover"}, {key: "saved", label: "Saved", icon: "individual", class: "icon-hover"}, {key: "template", label: "Template", icon: "query_editor", class: "icon-hover"}];
    this.lookupOption = null;
    this.item = null;
    let defaultType = localStorage.getItem(this.defaultTypeKey);
    if (defaultType){
      this.lookupOption = JSON.parse(defaultType);
      const indexToReplace = this.lookupOptions.findIndex(option => option.key === this.lookupOption.key);
      this.lookupOptions[indexToReplace] = this.lookupOption;
    } else {
      this.lookupOption = this.lookupOptions[0];
    }
    this.suggestedQueries = this.getSearchedList();
    this.handleLookupSelection = this.handleLookupSelection.bind(this);
    this.handleItemSelection = this.handleItemSelection.bind(this);
    this.onSaveItem = this.onSaveItem.bind(this);
    this.state = {
      isQueryMenuOpen: false,
      isSuggestionsOpen: false,
      currentSearchTerm: ""
    };
  }

  toggleQueryMenu = (forceState) => {
    this.setState(prevState => ({
      isQueryMenuOpen: forceState !== undefined ? forceState : !prevState.isQueryMenuOpen,
      isSuggestionsOpen: false // Close suggestions when toggling query menu
    }));
  };
  //TODO refactor toggleSuggestions & toggleQueryMenu into one function
  toggleSuggestions = (forceState) => {
    this.setState(prevState => ({
      isSuggestionsOpen: forceState !== undefined ? forceState : !prevState.isSuggestionsOpen,
      isQueryMenuOpen: false // Close query menu when toggling suggestions
    }));
  };

  closeAllMenus = () => {
    this.setState({
      isQueryMenuOpen: false,
      isSuggestionsOpen: false,
      currentSearchTerm: "" // Clear search term when closing menus
    });
  };

  clearSelection = () => {
    this.item = null;
    if (this.refs.lookupSearch) {
      this.refs.lookupSearch.value = "";
    }
  };

  handleLookupSelection(target) {
    this.lookupOption = target;
    this.suggestedQueries = this.getSearchedList();
    this.closeAllMenus();
    this.model.didUpdate();
  }

  handleItemSelectionBlur() {
    // Don't close immediately on blur to allow for clicks
    setTimeout(() => {
      this.closeAllMenus();
      // Clear inputs if no item is selected
      if (!this.item) {
        this.clearSelection();
      }
    }, 100);
  }

  handleItemSelection(target) {
    this.onItemSelection(target, this.lookupOption);
    this.item = target;

    target.label = target.label ? target.label : "";
    this.refs.itemName.value = target.label;

    this.closeAllMenus();
    this.model.didUpdate();
  }

  onSetAsDefault(option){
    const selectedFavClass = "icon-favorite blue";
    let oldFavorite = this.lookupOptions.find(option => option.class === selectedFavClass);
    if (oldFavorite){
      oldFavorite.class = option.class.replace(selectedFavClass, "");
    }
    option.class = selectedFavClass;
    localStorage.setItem(this.defaultTypeKey, JSON.stringify(option));
    this.model.didUpdate();
  }

  onSaveItem() {
    //TODO finish methdo
    //TODO check if add function can be used
    let label = this.refs.itemName.value;

    let key = this.item.list.key;
    if (key === "history"){
      //if the request comes from the history, set the key to saved to save it as new Saved query
      key = "saved";
    }
    let keyList = this.getStorageKeyList(key);

    // Find the index of the existing request with the same key
    let existingRequestIndex = keyList.list.findIndex(q => q.key === this.item.key);

    // Replace the existing request if found, otherwise add a new one
    if (existingRequestIndex !== -1) {
      keyList.list[existingRequestIndex] = {...this.item};
    } else {
      keyList.list.push({...this.item});
    }
    localStorage[keyList.key] = JSON.stringify(keyList.list);
    // Update state to display the toast notification
    this.setState({
      showToast: true,
      toastMessage: `Query '${this.item.label}' saved successfully!`,
      toastVariant: "success",
      toastTitle: "Success"
    });
    setTimeout(this.hideToast, 3000);
    this.model.didUpdate();
  }

  onDeleteItem(item){
    // Determine the correct list and storage key based on model.request.list.key
    let keyList = this.getStorageKeyList(item.list.key);

    // Find the index of the existing item with the same key
    let suggestedQueriesIndex = this.suggestedQueries.findIndex(q => q.key === item.key);
    if (suggestedQueriesIndex > -1) {
      this.suggestedQueries.splice(suggestedQueriesIndex, 1);
    }

    let existingItemIndex = keyList.list.findIndex(q => q.key === item.key);
    if (existingItemIndex > -1) {
      keyList.list.splice(existingItemIndex, 1);
    }
    localStorage[keyList.key] = JSON.stringify(keyList.list);
    this.model.didUpdate();
  }

  getSearchedList() {
    const addListProperty = (arr, option) => arr.map(item => ({...item, list: option}));
    const getOption = (key) => this.lookupOptions.find(option => option.key === key);

    switch (this.lookupOption.key) {
      case "all":
        return addListProperty(this.queryHistory.list, getOption("history"))
          .concat(addListProperty(this.savedHistory.list, getOption("saved")), addListProperty(this.templates, getOption("template")));
      case "history":
        return addListProperty(this.queryHistory.list, this.lookupOption);
      case "saved":
        return addListProperty(this.savedHistory.list, this.lookupOption);
      case "template":
        return addListProperty(this.templates, this.lookupOption);
    }
    return null;
  }

  getStorageKeyList(key){
    switch (key) {
      case "history":
        return {key: this.queryHistoryKey, list: this.queryHistory.list};
      case "saved":
        return {key: this.savedQueryHistoryKey, list: this.savedHistory.list};
      case "template":
        return {key: this.templateKey, list: this.requestTemplates};
      default:
        return "";
    }
  }

  searchItem() {
    const searchTerm = this.refs.lookupSearch.value.toLowerCase();
    const searchedList = this.getSearchedList();

    this.suggestedQueries = searchedList.filter(item =>
      // Search through all configured properties
      this.searchProperties.some(prop => {
        const value = item[prop];
        if (value && typeof value === "string") {
          return value.toLowerCase().includes(searchTerm);
        }
        return false;
      })
    );

    // Store the current search term
    this.setState({currentSearchTerm: searchTerm});

    this.toggleSuggestions(true); // Keep suggestions open while searching
    this.model.didUpdate();
  }

  highlightText(text, searchTerm) {
    // Convert to string and handle null/undefined
    const textStr = text != null ? String(text) : "";

    if (!textStr || !searchTerm || searchTerm.trim() === "") {
      return textStr;
    }

    // Create a case-insensitive regex for the search term
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = textStr.split(regex);

    // Return an array of React elements with highlighted matches
    return parts.map((part, index) => {
      if (part.toLowerCase() === searchTerm.toLowerCase()) {
        return h("mark", {
          key: index,
          style: {
            verticalAlign: "baseline",
            lineHeight: "inherit",
            padding: "0",
            margin: "0"
          }
        }, part);
      }
      return part;
    });
  }

  render() {
    return h("div", {className: "slds-form-element float-left"},
      h("div", {className: "slds-form-element__control"},
        h("div", {className: "slds-combobox-group"},
          h("div", {className: "slds-combobox_object-switcher slds-combobox-addon_start"},
            h("div", {className: "slds-form-element"},
              h("label", {className: "slds-form-element__label slds-assistive-text", htmlFor: "combobox-id-1", id: "combobox-label-id-34"}, "Filter Search by:"),
              h("div", {className: "slds-form-element__control"},
                h("div", {className: "slds-combobox_container"},
                  h("div", {ref: "queryMenu",
                    className: `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.state.isQueryMenuOpen ? "slds-is-open" : ""}`,
                    onClick: (e) => {
                      e.stopPropagation();
                      this.toggleQueryMenu();
                    },
                    "aria-controls": "primary-combobox-id-1"},
                  h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
                    h("div", {
                      role: "combobox",
                      tabIndex: "0",
                      onBlur: () => this.toggleQueryMenu(),
                      className: "slds-input_faux slds-combobox__input slds-combobox__input-value",
                      "aria-labelledby": "combobox-label-id-34",
                      id: "combobox-id-1-selected-value",
                      "aria-controls": "objectswitcher-listbox-id-1",
                      "aria-expanded": "false",
                      "aria-haspopup": "listbox"
                    },
                    h("span", {className: "option-selected", id: "combobox-value-id-25"}, this.lookupOption.label)
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
                  h("ul", {className: "slds-listbox slds-listbox_vertical", role: "group"},
                    h("div", {id: "lookup-listbox", role: "listbox", "aria-orientation": "vertical"}, [
                      h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"}, [
                        ...this.lookupOptions.map((option) =>
                          h("li", {
                            className: "slds-listbox__item",
                            role: "presentation",
                            key: option.key,
                            "data-id": option.key,
                            onMouseDown: (event) => this.handleLookupSelection(option, event)
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
                                  event.stopPropagation(); //prevent triggering handleItemSelection
                                  this.onSetAsDefault(option);
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
            h("div", {ref: "querySuggestions",
              className: `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.state.isSuggestionsOpen ? "slds-is-open" : ""}`,
              onClick: (e) => {
                e.stopPropagation();
                this.toggleSuggestions();
              },
              id: "primary-combobox-id-1"},
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
                onClick: () => this.toggleSuggestions(),
                onFocus: () => this.toggleSuggestions(true),
                onKeyUp: () => this.searchItem(),
                onBlur: () => this.handleItemSelectionBlur()
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
              this.suggestedQueries.map((item, index) =>
                h("li", {
                  role: "presentation",
                  className: "slds-listbox__item",
                  key: index,
                  onMouseDown: () => this.handleItemSelection(item)
                },
                h("div", {
                  id: `option${index}`,
                  className: "slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta",
                  role: "option"
                },
                h("span", {className: "slds-media__figure slds-listbox__option-icon"},
                  h("span", {className: "slds-icon_container slds-icon-standard-account"},
                    h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
                      h("use", {xlinkHref: `symbols.svg#${item.list.icon}`})
                    )
                  )
                ),
                h("span", {className: "slds-media__body", title: item[this.displayProperties.primary]},
                  h("span", {className: "slds-listbox__option-text slds-listbox__option-text_entity"},
                    this.highlightText(item[this.displayProperties.primary], this.state.currentSearchTerm)
                  ),
                  h("span", {className: "slds-listbox__option-meta slds-listbox__option-meta_entity"},
                    [
                      this.highlightText(item.list.label, this.state.currentSearchTerm),
                      " • ",
                      this.highlightText(item[this.displayProperties.tertiary], this.state.currentSearchTerm),
                      item[this.displayProperties.secondary] ? [
                        " • ",
                        this.highlightText(item[this.displayProperties.secondary], this.state.currentSearchTerm)
                      ] : null
                    ]
                  )
                ),
                h("button", {className: "slds-button slds-button_icon slds-input__icon slds-input__icon_right",
                  title: "Delete Query",
                  onMouseDown: (event) => {
                    event.stopPropagation(); //prevent triggering handleItemSelection
                    this.onDeleteItem(item);
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
            h("div", {className: "slds-grid slds-grid_vertical-align-center"},
              h("svg", {className: "slds-icon slds-input__icon slds-input__icon_left slds-icon-text-default"},
                h("use", {xlinkHref: "symbols.svg#save"})
              ),
              h("input", {type: "text", ref: "itemName", id: "itemLabel", className: "slds-input slds-m-left_xx-small", placeholder: "Label"}),
              h("button", {onClick: this.onSaveItem, title: "Save", className: "slds-m-left_xx-small"}, "Save")
            )
          )
        )
      ));
  }
}
export default Combobox;
