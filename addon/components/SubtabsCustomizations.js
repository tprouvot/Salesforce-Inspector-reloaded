/* eslint-disable react/prop-types */
/* global React */
const h = React.createElement;

export default class SubtabsCustomizations extends React.Component {
  constructor(props) {
    super(props);
    this.sfHost = props.model.sfHost;
    this.onAdd = this.onAdd.bind(this);
    this.onEdit = this.onEdit.bind(this);
    this.onDelete = this.onDelete.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onCancel = this.onCancel.bind(this);

    // Load both global and org-local customizations
    const globalConfs = JSON.parse(localStorage.getItem("_subtabCustomizations") || "[]").map(c => ({...c, isGlobal: true}));
    const orgConfs = JSON.parse(localStorage.getItem(this.sfHost + "_subtabCustomizations") || "[]").map(c => ({...c, isGlobal: false}));

    this.state = {
      confs: [...globalConfs, ...orgConfs],
      editingIndex: -1, // -1 means no edit
      newConf: {context: "User", targetObject: "", fields: "", buttons: [], isGlobal: false}
    };
  }

  persist(confs) {
    const globalOnes = confs.filter(c => c.isGlobal);
    const orgOnes = confs.filter(c => !c.isGlobal);
    localStorage.setItem("_subtabCustomizations", JSON.stringify(globalOnes));
    localStorage.setItem(this.sfHost + "_subtabCustomizations", JSON.stringify(orgOnes));
  }

  onAdd() {
    this.setState({
      editingIndex: this.state.confs.length,
      newConf: {context: "User", targetObject: "", fields: "", buttons: [], isGlobal: false}
    });
  }

  onEdit(index) {
    this.setState({
      editingIndex: index,
      newConf: JSON.parse(JSON.stringify(this.state.confs[index]))
    });
  }

  onDelete(index) {
    const newConfs = [...this.state.confs];
    newConfs.splice(index, 1);
    this.setState({confs: newConfs});
    this.persist(newConfs);
  }

  onSave() {
    const {confs, editingIndex, newConf} = this.state;
    const newConfs = [...confs];
    if (editingIndex === confs.length) {
      newConfs.push(newConf);
    } else {
      newConfs[editingIndex] = newConf;
    }
    this.setState({confs: newConfs, editingIndex: -1});
    this.persist(newConfs);
  }

  onCancel() {
    this.setState({editingIndex: -1});
  }

  handleInputChange(field, value) {
    this.setState({
      newConf: {...this.state.newConf, [field]: value}
    });
  }

  handleAddButton() {
    const buttons = [...this.state.newConf.buttons, {label: "", link: ""}];
    this.handleInputChange("buttons", buttons);
  }

  handleButtonChange(index, field, value) {
    const buttons = [...this.state.newConf.buttons];
    buttons[index][field] = value;
    this.handleInputChange("buttons", buttons);
  }

  handleRemoveButton(index) {
    const buttons = [...this.state.newConf.buttons];
    buttons.splice(index, 1);
    this.handleInputChange("buttons", buttons);
  }

  render() {
    const {confs, editingIndex} = this.state;

    return h("div", {className: "slds-grid slds-grid_vertical"},
      h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered"},
        h("thead", {},
          h("tr", {className: "slds-line-height_reset"},
            h("th", {scope: "col"}, h("div", {className: "slds-truncate", title: "Context"}, "Context")),
            h("th", {scope: "col"}, h("div", {className: "slds-truncate", title: "Fields"}, "Fields")),
            h("th", {scope: "col"}, h("div", {className: "slds-truncate", title: "Global"}, "Global")),
            h("th", {scope: "col"}, h("div", {className: "slds-truncate", title: "Actions"}, "Actions"))
          )
        ),
        h("tbody", {},
          confs.map((conf, index) =>
            editingIndex === index ? this.renderEditRow(index) : h("tr", {key: index},
              h("td", {}, h("div", {className: "slds-truncate"}, conf.context + (conf.context === "Object" ? ` (${conf.targetObject})` : ""))),
              h("td", {}, h("div", {className: "slds-truncate", title: conf.fields, style: {maxWidth: "300px"}}, conf.fields)),
              h("td", {}, conf.isGlobal ? h("span", {className: "slds-badge slds-badge_lightest"}, "Global") : "Org"),
              h("td", {},
                h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled slds-m-right_x-small", onClick: () => this.onEdit(index), title: "Edit"},
                  h("svg", {className: "slds-button__icon"}, h("use", {xlinkHref: "symbols.svg#edit"}))
                ),
                h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled", onClick: () => this.onDelete(index), title: "Delete"},
                  h("svg", {className: "slds-button__icon"}, h("use", {xlinkHref: "symbols.svg#delete"}))
                )
              )
            )
          )
        )
      ),
      editingIndex === confs.length ? this.renderEditForm() : h("div", {className: "slds-p-around_small"},
        h("button", {className: "slds-button slds-button_neutral", onClick: this.onAdd}, "Add Customization")
      )
    );
  }

  renderEditRow(index) {
    return h("tr", {key: index, className: "slds-hint-parent"},
      h("td", {colSpan: 4}, this.renderEditForm())
    );
  }

  renderEditForm() {
    const {newConf} = this.state;
    return h("div", {className: "slds-box slds-m-vertical_small slds-theme_shade"},
      h("div", {className: "slds-grid slds-gutters slds-wrap"},
        h("div", {className: "slds-col slds-size_1-of-3 slds-m-bottom_small"},
          h("div", {className: "slds-form-element"},
            h("label", {className: "slds-form-element__label"}, "Context"),
            h("div", {className: "slds-form-element__control"},
              h("select", {className: "slds-select", value: newConf.context, onChange: (e) => this.handleInputChange("context", e.target.value)},
                h("option", {value: "User"}, "User"),
                h("option", {value: "Org"}, "Org"),
                h("option", {value: "Object"}, "Object")
              )
            )
          )
        ),
        newConf.context === "Object" && h("div", {className: "slds-col slds-size_1-of-3 slds-m-bottom_small"},
          h("div", {className: "slds-form-element"},
            h("label", {className: "slds-form-element__label"}, "Object API Name"),
            h("div", {className: "slds-form-element__control"},
              h("input", {className: "slds-input", type: "text", value: newConf.targetObject, placeholder: "e.g. Account", onChange: (e) => this.handleInputChange("targetObject", e.target.value)})
            )
          )
        ),
        h("div", {className: "slds-col slds-size_1-of-3 slds-m-bottom_small slds-p-top_large"},
          h("label", {className: "slds-checkbox_toggle slds-grid"},
            h("input", {type: "checkbox", checked: newConf.isGlobal, onChange: (e) => this.handleInputChange("isGlobal", e.target.checked)}),
            h("span", {className: "slds-checkbox_faux_container"},
              h("span", {className: "slds-checkbox_faux"}),
              h("span", {className: "slds-checkbox_on"}, "Global"),
              h("span", {className: "slds-checkbox_off"}, "Org")
            )
          )
        ),
        h("div", {className: "slds-col slds-size_1-of-1 slds-m-bottom_small"},
          h("div", {className: "slds-form-element"},
            h("label", {className: "slds-form-element__label"}, "Fields (comma separated API names)"),
            h("div", {className: "slds-form-element__control"},
              h("input", {className: "slds-input", type: "text", value: newConf.fields, placeholder: "Field1, Field2, ProxyField.Name", onChange: (e) => this.handleInputChange("fields", e.target.value)})
            )
          )
        ),
        h("div", {className: "slds-col slds-size_1-of-1 slds-m-bottom_small"},
          h("label", {className: "slds-form-element__label"}, "Buttons"),
          newConf.buttons.map((btn, i) =>
            h("div", {key: i, className: "slds-grid slds-gutters slds-m-bottom_xx-small"},
              h("div", {className: "slds-col slds-size_4-of-12"},
                h("input", {className: "slds-input", type: "text", placeholder: "Label", value: btn.label, onChange: (e) => this.handleButtonChange(i, "label", e.target.value)})
              ),
              h("div", {className: "slds-col slds-size_7-of-12"},
                h("input", {className: "slds-input", type: "text", placeholder: "/path or https://... {recordId} {userId}", value: btn.link, onChange: (e) => this.handleButtonChange(i, "link", e.target.value)})
              ),
              h("div", {className: "slds-col slds-size_1-of-12"},
                h("button", {className: "slds-button slds-button_icon slds-button_icon-border", onClick: () => this.handleRemoveButton(i)},
                  h("svg", {className: "slds-button__icon"}, h("use", {xlinkHref: "symbols.svg#delete"}))
                )
              )
            )
          ),
          h("button", {className: "slds-button slds-button_neutral slds-m-top_x-small", onClick: () => this.handleAddButton()}, "Add Button")
        ),
        h("div", {className: "slds-col slds-size_1-of-1 slds-m-top_small slds-text-align_right"},
          h("button", {className: "slds-button slds-button_neutral", onClick: this.onCancel}, "Cancel"),
          h("button", {className: "slds-button slds-button_brand slds-m-left_small", onClick: this.onSave}, "Save")
        )
      )
    );
  }
}
