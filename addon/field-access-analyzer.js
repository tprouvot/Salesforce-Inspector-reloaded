/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";

import Tooltip from "./components/Tooltip.js";
import {DescribeInfo} from "./data-load.js";

class Model {

  constructor(sfHost, sessionId, args) {
    this.sfHost = sfHost;
    this.sessionId = sessionId;
    this.args = args;
    this.sfLink = "https://" + this.sfHost;
    this.spinnerCount = 0;
    this.showHelp = false;
    this.userInfo = "...";
    this.analyzeEnabled = true;
    this.isRunning = true;
    this.importType = "Account";
    this.inputField = "AccountNumber";
    this.inputUser = {};
    this.profileResult = {};
    this.psResult = [];
    this.layoutResult = [];
    this.flexipageResult = [];
    this.describeInfo = new DescribeInfo(this.spinFor.bind(this), () => { this.didUpdate(); });

    this.spinFor(sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
      this.inputUser = {userId: res.userId, userName: res.userName, profileId: res.profileId};
    }));

    /*let trialExpDate = localStorage.getItem(sfHost + "_trialExpirationDate");
    if (localStorage.getItem(sfHost + "_isSandbox") != "true" && (!trialExpDate || trialExpDate === "null")) {
      //change background color for production
      document.body.classList.add("prod");
      this.isProd = true;
    }*/
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

  toggleHelp() {
    this.showHelp = !this.showHelp;
  }

  sobjectList() {
    let {globalDescribe} = this.describeInfo.describeGlobal(false);
    if (!globalDescribe) {
      return [];
    }

    if (this.apiType == "Metadata") {
      return globalDescribe.sobjects
        .filter(sobjectDescribe => sobjectDescribe.name.endsWith("__mdt"))
        .map(sobjectDescribe => sobjectDescribe.name);
    } else {
      return globalDescribe.sobjects
        .filter(sobjectDescribe => sobjectDescribe.createable || sobjectDescribe.deletable || sobjectDescribe.updateable)
        .map(sobjectDescribe => sobjectDescribe.name);
    }
  }

  importTypeError() {
    let importType = this.importType;
    if (!this.sobjectList().some(s => s.toLowerCase() == importType.toLowerCase())) {
      return "Error: Unknown object";
    }
    return "";
  }

  fieldList() {
    let sobjectName = this.importType;
    let sobjectDescribe = this.describeInfo.describeSobject(false, sobjectName).sobjectDescribe;
    if (sobjectDescribe) {
      return sobjectDescribe.fields;
    } else {
      return [];
    }
  }

  userList() {
    console.log("User List");
  }
}

/**
   * Parse a permission metadata file (profile || permission) and, 
   * return the access level of specific field
   * The return a structured object that contains the name, type. 
   * @param cb A function to be called once React has processed the update.
   */
function parsePermission(permission, qualifiedAPIName) {
  if (!permission) return null;

  // Handle possible 'records' wrapper
  if (permission.records) {
    permission = permission.records;
  }

  let fieldPermissions = permission.fieldPermissions || [];

  // Ensure array
  if (!Array.isArray(fieldPermissions)) {
    fieldPermissions = [fieldPermissions];
  }

  const fieldPermission = fieldPermissions.find(fp => fp.field === qualifiedAPIName);
  if (!fieldPermission) return null;

  let accessValue = "No Access";
  let accessTheme = "default";
  if (fieldPermission.editable == "true") {
    accessValue = "Read / Write";
    accessTheme = "success";
  } else if (fieldPermission.readable == "true") {
    accessValue = "Read Only";
    accessTheme = "success";
  }

  return {
    type: permission["$xsi:type"],
    icon: permission["$xsi:type"] === "Profile" ? "user" : "user_role",
    name: permission.fullName,
    access: {
      label: "Access",
      value: accessValue,
      theme: accessTheme,
    }
  };
}

function findLayoutBehaviorByField(layout, field) {
  if (layout === null || typeof layout !== "object") return null;

  for (let key in layout) {
    if (layout[key] === field) {
      if (layout.hasOwnProperty("behavior")) {
        return layout["behavior"]; // Return the first found behavior
      }
    }

    if (typeof layout[key] === "object") {
      const result = findLayoutBehaviorByField(layout[key], field);
      if (result !== null) return result; // Stop searching after first match
    }
  }
  return null; // Return null if no match found
}

function getFlexiComp(object, value, regionName){
  if (!object || typeof object !== "object") return null;

  if (Object.prototype.hasOwnProperty.call(object, "itemInstances")){
    regionName = object["name"];
  }

  for (let key in object) {
    if (object[key] === value /*&& object.hasOwnProperty("fieldInstanceProperties")*/) {
      //flexipageResult.fieldSection = {behavior: flexipage.fieldInstanceProperties?.value};
      let myObject = object;
      myObject.regionName = regionName;
      return myObject;
    }
    // Recursively check nested objects
    if (typeof object[key] === "object") {
      const found = getFlexiComp(object[key], value, regionName);
      if (found) return found;
    }
  }
  return null;
}


function parseFlexipage(flexipage, field) {
  let components = [];

  //Search DetailsPanel component
  let detailcomp = getFlexiComp(flexipage, "force:detailPanel");
  if (detailcomp) {
    components.push({
      name: "Details Panel",
      access: {
        label: "Behavior",
        value: "According Layout"
      },
      filter: detailcomp.visibilityRule ? detailcomp.visibilityRule : null
    });
  }

  //Search FieldItem component including my field
  let comp = getFlexiComp(flexipage, field);
  console.log(comp);
  if (comp?.fieldInstanceProperties?.name == "uiBehavior") {
    components.push({
      name: "fieldItem",
      regionName: comp.regionName,
      access: {
        label: "Behavior",
        value: comp.fieldInstanceProperties?.value?.[0]?.toUpperCase() + comp.fieldInstanceProperties?.value?.slice(1),
        theme: comp.fieldInstanceProperties?.value ? "success" : "error"
      },
      filter: comp.visibilityRule ? comp.visibilityRule : null
    });
  }
  return components;
}

let h = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.onImportTypeChange = this.onImportTypeChange.bind(this);
    this.onFieldChange = this.onFieldChange.bind(this);
    this.analyze = this.analyze.bind(this);
  }

  onImportTypeChange(e) {
    let { model } = this.props;
    model.importType = e.target.value;
    model.didUpdate();
  }

  onFieldChange(e) {
    let { model } = this.props;
    model.inputField = e.target.value;
    model.analyzeEnabled = true;
    model.didUpdate();
  }

  analyze(){
    let { model } = this.props;
    model.spinnerCount++;
    console.log("launch analyze");
    model.analyzeEnabled = false;
    model.didUpdate();
    this.getProfile();
    this.getPermissionSets();
    this.getFlexipages();
  }

  async getProfile(){
    let { model } = this.props;

    let profileName;
    let profile;
    // Get profile name
    await sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(("SELECT FullName FROM Profile WHERE Id = '" + model.inputUser.profileId + "' LIMIT 1")))
      .then(result => {
        profileName = result.records[0].FullName;
      })
      .catch(err => {
        console.error("An error occured fetching the profile fullname " + ": ", err.message);
      });

    // Get Profile content
    await sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "readMetadata", {type: "Profile", fullNames: profileName})
      .then(res => {
        profile = res;
      })
      .catch(err => {
        console.log("An error occured fetching the profile content" + ": ", err.message);
      });
    const qualifiedAPIName = `${model.importType}.${model.inputField}`;
    model.profileResult = parsePermission(profile, qualifiedAPIName);

    // Get Layouts content assigned to the profile
    const layouts = new Map(
      profile.records.layoutAssignments
        ?.filter(fp => fp.layout.startsWith(model.importType + "-"))
        .map(fp => [fp.layout, fp.recordType?.split(".")[1]])
    );

    const apps = [...new Set(profile.records.applicationVisibilities
      .map(fp => fp.application) // Extracts only layout names
    )];

    let layoutResult = [];
    await sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "readMetadata", {type: "Layout", fullNames: Array.from(layouts.keys())})
      .then(res => {
        res.records = Array.isArray(res.records) ? res.records : [res.records];
        res.records?.forEach(record => {
          layoutResult.push({
            type: "Page Layout",
            icon: "layout",
            name: decodeURIComponent(record.fullName),
            recordType: layouts.get(record.fullName) ? layouts.get(record.fullName) : "Default",
            access: {
              label: "Behavior",
              value: findLayoutBehaviorByField(record, model.inputField) ? findLayoutBehaviorByField(record, model.inputField) : "Not displayed",
              theme: findLayoutBehaviorByField(record, model.inputField) ? "success" : "error"
            }
          });
        });
      })
      .catch(err => {
        console.log("An error occured fetching the layout content" + ": ", err.message);
      });
    model.layoutResult = layoutResult;
    model.didUpdate();
  }

  async getPermissionSets(){
    let { model } = this.props;

    let permissionSetNames = [];
    let permissionSetResult = [];
    await sfConn.rest("/services/data/v35.0/query/?q=" + encodeURIComponent("SELECT PermissionSet.Name FROM PermissionSetAssignment WHERE AssigneeId = '" + model.inputUser.userId + "'"))
      .then(result => {
        result.records.forEach(record => {
          permissionSetNames.push(record.PermissionSet.Name);
        });
      })
      .catch(err => {
        console.error("An error occured fetching the permission sets names : ", err.message);
      });

    await sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "readMetadata", {type: "PermissionSet", fullNames: permissionSetNames})
      .then(res => {
        const qualifiedAPIName = `${model.importType}.${model.inputField}`;
        res.records.forEach(record => {
          const result = parsePermission(record, qualifiedAPIName);
          result && permissionSetResult.push(result);
        });
        model.psResult = permissionSetResult;
      })
      .catch(err => {
        console.log("An error occured fetching the permission sets content" + ": ", err.message);
      });

    model.didUpdate();
  }

  async getFlexipages(){
    let { model } = this.props;
    model.isRunning = true;
    let flexipageNames = [];
    await sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent("SELECT Id, DeveloperName, Description, Type, EntityDefinitionId FROM FlexiPage WHERE EntityDefinition.DeveloperName = '" + model.importType + "'"))
      .then(result => {
        result.records.forEach(record => {
          flexipageNames.push(record.DeveloperName);
        });
      })
      .catch(err => {
        console.error("An error occured fetching the flexipage names of the object " + ": ", err.message);
      });


    const fieldKey = `Record.${model.inputField}`;
    // Get Flexipage Content
    await sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "readMetadata", {type: "FlexiPage", fullNames: flexipageNames})
      .then(result => {
        result.records = Array.isArray(result.records) ? result.records : [result.records];
        result.records.forEach(record => {
          let components = parseFlexipage(record, fieldKey);
          model.flexipageResult.push(
            {
              type: "Lightning Page",
              icon: "lightning_extension",
              name: record.fullName,
              components: components
            }
          );
        });
      })
      .catch(err => {
        console.log("An error occured fetching the flexipages content" + ": ", err.message);
      });

    // Get Flexipage assignments
    // Get Object Metadata to obtain the Org Default Assignment
    await sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "readMetadata", {type: "CustomObject", fullNames: [model.importType]})
      .then(res => {
        res.records?.actionOverrides?.forEach(action => {
          if (action.type == "Flexipage"){
            model.flexipageResult?.forEach(flexipage => {
              if (flexipage.name == action.content){
                flexipage.assignment = flexipage.assignment || {};
                flexipage.assignment[action.formFactor] = flexipage.assignment[action.formFactor] || [];
                flexipage.assignment[action.formFactor] = [
                  ...(flexipage.assignment[action.formFactor] || []),
                  {"name": "Org Default"}];

              }
            });
          }
        });
      });

    // Get Application Metadata to obtain custom assignement
    await sfConn.soap(sfConn.wsdl(apiVersion, "Metadata"), "readMetadata", {type: "CustomApplication", fullNames: ["standard__LightningSales", "standard__LightningSalesConsole", "My_Modal_App"]})
      .then(res => {
        console.log(res);
        for (let i = 0; i < res.records.length; i++){
          res.records[i].actionOverrides?.forEach(action => {
            if (action.type == "Flexipage"){
              model.flexipageResult?.forEach(f => {
                if (f.name === action.content) {
                  f.assignment ??= {};
                  f.assignment[action.formFactor] ??= [];
                  const a = f.assignment[action.formFactor];
                  if (!a.some(e => e.name === res.records[i].fullName && e.recordType === action.recordType)) {
                    a.push({name: res.records[i].fullName});
                  }
                }
              });
            }
          });
          res.records[i].profileActionOverrides?.forEach(action => {
            if (action.type === "Flexipage") {
              model.flexipageResult?.forEach(f => {
                if (f.name === action.content) {
                  f.assignment ??= {};
                  f.assignment[action.formFactor] ??= [];
                  const a = f.assignment[action.formFactor];
                  if (!a.some(e => e.name === res.records[i].fullName && e.recordType === action.recordType)) {
                    a.push({name: res.records[i].fullName, recordType: action.recordType});
                  }
                }
              });
            }
          });
        }
      });
    model.isRunning = false;
    model.spinnerCount--;
    model.didUpdate();
  }

  onToggleHelp(e) {
    let {model} = this.props;
    model.toggleHelp();
    model.didUpdate();
  }

  buildAccessResultCard(result){
    return h("div", {className: "slds-card slds-m-around_xsmall"},
      h("div", {className: "slds-card__header slds-grid"},
        h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
          result.icon && h("div", {className: "slds-media__figure"},
            h("span", {className: "slds-icon_container", title: result.type},
              h("svg", {className: "slds-icon slds-icon_small"},
                h("use", {xlinkHref: `symbols.svg#${result.icon}`, fill: "#9c9c9c"})
              )
            )
          ),
          h("div", {className: "slds-media__body"},
            h("h1", {className: "slds-card__header-title"},
              h("a", {href: "#", className: "slds-card__header-link slds-truncate", title: result.type},
                h("span", {}, result.name)
              )
            )
          )
        )
      ),
      h("div", {className: "slds-card__body slds-card__body_inner"},
        //Display Assignment in case of Lightning Page
        result.assignment && h("div", {className: "slds-tile__detail slds-m-bottom_medium"},
          h("dl", {className: "slds-list_horizontal slds-wrap"},
            result.assignment.Large.length > 0 && h("ul", {}, "App:"),
            h("ul", {className: "slds-list--dotted"},
              result.assignment.Large.map(app =>
                h("li", {key: app.name}, app.name,
                  app.recordType && h("ul", {className: "slds-list--dotted"},
                    h("li", {}, "Record Type : " + app.recordType)
                  )
                )
              )
            )
          )
        ),
        //Display components of flexipage in case of Lightning Page.
        result.components?.length > 0 && result.components.map(cmp =>
          h("div", {key: cmp.name, className: "slds-box slds-m-vertical_small"},
            this.buildAccessResultCard(cmp)
          )
        ),
        //Display Record Type in case of Layout
        result.recordType && h("div", {className: "slds-tile__detail slds-m-bottom_medium"},
          h("dl", {className: "slds-list_horizontal slds-wrap"},
            h("dt", {className: "slds-item_label slds-truncate slds"}, "Record Type:"),
            h("dd", {className: "slds-item_detail slds-truncate slds-m-left_small"}, result.recordType),
          )
        ),
        //Display access and behavior
        result.access && h("div", {className: "slds-tile__detail"},
          h("dl", {className: "slds-list_horizontal slds-wrap"},
            h("dt", {className: "slds-item_label slds-truncate"}, result.access?.label + ":"),
            h("dd", {className: `slds-item_detail slds-truncate slds-m-left_small  
              ${result.access?.theme === "success" ? "slds-text-title_bold slds-text-color_success" : result.access?.theme === "error" ? "slds-text-color_error" : "slds-text-color_default"}`}, result.access?.value)
          )
        )
      )
    );
  }

  render() {
    let {model} = this.props;
    ///let result = {type: "Profile", icon: "user", name: "System Admin", access: {label: "Access", value: "Read Write", theme: "success"}};
    let component = {type: "Tab", Name: "Details", content: {}, filter: "this is my filter"};

    return h("div", {},
      h("div", {id: "user-info"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
        h("h1", {}, "Field Access Analyser"),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},

          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          ),
          h("a", {href: "#", id: "help-btn", title: "", onClick: this.onToggleHelp},
            h("div", {className: "icon"})
          ),
        ),
      ),
      h("div", {className: "area"},
        h("div", {className: "area-header"},
          h("h1", {}, "Select Field and Profile")
        ),
        h("div", {className: "conf-line"},
          h("label", {title: "Channel Selection"},
            h("label", {className: "conf-input"},
              h("span", {className: "conf-label"}, "Object"),
              h("span", {className: "conf-value"},
                h("input", {type: "search", value: model.importType, onChange: this.onImportTypeChange, className: model.importTypeError() ? "object-list confError" : "object-list", list: "sobjectlist"}),
                h("div", {className: "conf-error", hidden: !model.importTypeError()}, model.importTypeError())
              ),
              h("span", {className: "conf-label"}, "Field"),
              h("span", {className: "conf-value"},
                h("input", {type: "search", value: model.inputField, onChange: this.onFieldChange, className: model.importTypeError() ? "object-list confError" : "object-list", list: "fieldlist"}),
                h("div", {className: "conf-error", hidden: !model.importTypeError()}, model.importTypeError())
              ),
              h("span", {className: "conf-label"}, "User"),
              h("span", {className: "conf-value"},
                h("input", {type: "search", value: model.inputUser.userName, onChange: this.onFieldChange, className: model.importTypeError() ? "object-list confError" : "object-list", list: "userlist"}),
                h("div", {className: "conf-error", hidden: !model.importTypeError()}, model.importTypeError())
              ),
              h("button", {onClick: this.analyze, title: "Launch", disabled: !model.analyzeEnabled}, "Analyze"),
            )
          )
        ),
        h("datalist", {id: "sobjectlist"}, model.sobjectList().map(data => h("option", {key: data, value: data}))),
        h("datalist", {id: "fieldlist"}, model.fieldList().map(data => h("option", {key: data.name, value: data.name}))),
        //h("datalist", {id: "userlist"}, model.userList().map(data => h("option", {key: data.name, value: data.name}))),
        h("div", {hidden: !model.showHelp, className: "help-text"},
          h("h3", {}, "Field Access Analyser"),
          //h("p", {}, "Use for monitor Platform Event queue."),
          //h("p", {}, "Subscribe to a channel to see events in the result area. Use 'Replay From' to define the scope."),
          //h("p", {}, "Supports Standard and Custom Platform Events")
        )
      ),
      h("div", {className: "area", id: "result-area"},
        h("div", {className: "result-bar"}
          //h("h1", {}, "Result : "),
        ),
        h("div", {className: "slds-m-horizontal_xx-large", id: "RESULT"},
          //LINE 1 - PERMISSIONS
          h("div", {className: "slds-grid slds-gutters"},

            //COL 1 - PROFILE
            model.profileResult.name && h("div", {className: "slds-col slds-size_4-of-12 slds-box slds-m-right_medium slds-theme_default"},
              //
              h("article", {className: "slds-tile slds-m-around_xsmall"},
                h("h1", {className: "slds-tile__title slds-truncate", title: "Profile"}, "Profile"),
                //Build Profile Result Card
                this.buildAccessResultCard(model.profileResult)
              )
            ),
            //COL 2 - PERMISSION SETS
            model.profileResult.name && h("div", {className: "slds-col slds-size_8-of-12 slds-box slds-theme_shade"},
              h("article", {className: "slds-tile"},
                h("h1", {className: "slds-tile__title slds-truncate", title: "Permission Sets"}, "Permission Sets",
                  h("div", {className: "slds-grid slds-gutters"},
                    //model.psResult.length < 1 && h("p", {className: "slds-m-around_medium slds-text-body_small"}, "No permission set containing this field was found."),
                    model.psResult.length > 0 && model.psResult.map(ps =>
                      h("div", {key: ps.name, className: "slds-col"},
                        this.buildAccessResultCard(ps)
                      )
                    )
                  )
                )
              )
            )
          ),

          //LINE 2 - LAYOUT ASSIGNMENT
          h("div", {className: "slds-grid slds-gutters slds-wrap"},
            model.layoutResult.length > 0 && h("div", {className: "slds-col slds-box slds-theme_default"},
              h("article", {className: "slds-tile"},
                h("h1", {className: "slds-tile__title slds-truncate", title: "Layout"}, "Layout Assignment"),
                h("div", {className: "slds-grid slds-gutters"},
                  model.layoutResult.length > 0 && model.layoutResult.map(layout =>
                    h("div", {key: layout.name, className: "slds-col"},
                      this.buildAccessResultCard(layout)
                    )
                  )
                )
              )
            )
          ),

          //LINE 3 - LIGTHNING PAGE
          !model.isRunning && h("div", {className: "slds-grid slds-gutters slds-wrap"},
            h("div", {className: "slds-col slds-box slds-theme_default"},
              h("article", {className: "slds-tile"},
                h("h1", {className: "slds-tile__title slds-truncate", title: "Lightning Page"}, "Lightning page"),
                h("div", {className: "slds-grid slds-gutters"},
                  model.flexipageResult.length < 1 && h("p", {className: "slds-m-around_medium slds-text-body_small"}, "No custom lightning page found, see page layout access"),
                  model.flexipageResult.length > 0 && model.flexipageResult.map(page =>

                    h("div", {key: page.name, className: "slds-col"},
                      this.buildAccessResultCard(page)
                    )

                    /*

                    h("div", {key: page.name, className: "slds-card slds-m-around_medium"},
                      h("div", {className: "slds-card__header slds-grid"},
                        h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
                          h("div", {className: "slds-media__figure"},
                            h("span", {className: "slds-icon_container", title: page.type},
                              h("svg", {className: "slds-icon slds-icon_small"},
                                h("use", {xlinkHref: `symbols.svg#${page.icon}`, fill: "#9c9c9c"})
                              )
                            )
                          ),
                          h("div", {className: "slds-media__body"},
                            h("h1", {className: "slds-card__header-title"},
                              h("a", {href: "#", className: "slds-card__header-link slds-truncate", title: page.type},
                                h("span", {}, page.name)
                              )
                            )
                          )
                        )
                      ),
                      h("div", {className: "slds-card__body slds-card__body_inner"},
                        page.components?.length > 0 && page.components.map(comp =>
                          h("article", {key: comp.name, className: "slds-tile slds-box"},
                            h("h3", {className: "slds-truncate slds-text-heading_small"}, comp.name),
                            h("div", {className: "slds-tile__detail"},
                              h("dl", {className: "slds-list_horizontal slds-wrap"},
                                h("dt", {className: "slds-item_label slds-truncate"}, "Behavior: "),
                                h("dd", {className: "slds-item_detail slds-truncate slds-m-left_small"}, comp.behavior)
                              ),
                              h("dl", {className: "slds-list_horizontal slds-wrap"},
                                h("dt", {className: "slds-item_label slds-truncate"}, "Filter : "),
                                h("dd", {className: "slds-item_detail slds-truncate slds-m-left_small"}, JSON.stringify(comp.filter))
                              )
                            )
                          )
                        )
                      )
                    ) */
                  )
                )
              )
            )
          )
        )
      )
    );
  }
}

{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then((res) => {

    let root = document.getElementById("root");
    let model = new Model(sfHost, res, args);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({model});
    }
  });
}
