/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
import {getUserInfo} from "./utils.js";
import {PageHeader} from "./components/PageHeader.js";
/* global initButton */

let h = React.createElement;

// ─── Utility helpers ─────────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function generateAlias(firstName, lastName) {
  let alias = firstName.length > 0 ? firstName[0].toLowerCase() : "";
  return alias + lastName.substring(0, 4).toLowerCase();
}

function generateUsername(emailPrefix) {
  const rand = Math.random().toString(36).substring(2, 7);
  return (emailPrefix ? emailPrefix + "." + rand : rand) + "@sftest.com";
}

function generateNickname() {
  let n = "User";
  for (let i = 0; i < 10; i++) n += Math.floor(Math.random() * 10);
  return n;
}

// ─── REST helpers ─────────────────────────────────────────────────────────────

async function sfQuery(soql) {
  const result = await sfConn.rest(
    "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(soql),
    {useCache: false}
  );
  return result.records;
}

async function sfCreate(object, record) {
  const body = Object.assign({}, record);
  delete body.Id;
  delete body.attributes;
  const result = await sfConn.rest(
    "/services/data/v" + apiVersion + "/sobjects/" + object,
    {method: "POST", body, useCache: false}
  );
  return result.id;
}

async function sfDescribe(object) {
  return sfConn.rest(
    "/services/data/v" + apiVersion + "/sobjects/" + object + "/describe",
    {useCache: false}
  );
}

async function executeAnonymous(code) {
  return sfConn.rest(
    "/services/data/v" + apiVersion + "/tooling/executeAnonymous/?anonymousBody=" + encodeURIComponent(code),
    {useCache: false}
  );
}

// ─── Clone / user search modal ────────────────────────────────────────────────

class UserSearchModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {query: "", results: [], searching: false, error: null};
    this.onQueryChange = this.onQueryChange.bind(this);
    this.searchTimeout = null;
  }

  onQueryChange(e) {
    const query = e.target.value;
    this.setState({query, results: []});
    clearTimeout(this.searchTimeout);
    if (query.trim().length >= 2) {
      this.searchTimeout = setTimeout(() => this.doSearch(query), 380);
    }
  }

  async doSearch(query) {
    this.setState({searching: true, error: null});
    try {
      const soql = "SELECT Id, Username, FirstName, LastName, Email, IsActive FROM User"
        + " WHERE (Username LIKE '%" + query + "%' OR Email LIKE '%" + query + "%' OR LastName LIKE '%" + query + "%')"
        + " ORDER BY LastName LIMIT 20";
      const records = await sfQuery(soql);
      this.setState({results: records, searching: false});
    } catch (err) {
      this.setState({error: err.message, searching: false});
    }
  }

  render() {
    const {onSelect, onCancel} = this.props;
    const {query, results, searching, error} = this.state;
    const noResults = query.trim().length >= 2 && !searching && !error && results.length === 0;

    return h("div", {className: "um-overlay"},
      h("div", {className: "um-overlay-card"},
        h("div", {className: "um-overlay-title"}, "Select User to Clone"),

        h("div", {className: "um-form-element"},
          h("label", {className: "um-label"}, "Search by username, email or last name"),
          h("div", {className: "um-search-container"},
            h("input", {
              type: "text",
              className: "um-input",
              placeholder: "Type at least 2 characters\u2026",
              value: query,
              onChange: this.onQueryChange,
              autoFocus: true,
            }),
            results.length > 0 && h("div", {className: "um-search-results"},
              results.map(user =>
                h("div", {
                  key: user.Id,
                  className: "um-search-result-item",
                  onClick: () => onSelect(user),
                },
                  h("strong", {}, user.Username),
                  " \u2014 " + (user.FirstName || "") + " " + user.LastName,
                  !user.IsActive ? h("span", {style: {color: "#c23934", marginLeft: 6}}, "(Inactive)") : null
                )
              )
            )
          )
        ),

        searching && h("div", {style: {fontSize: "0.8rem", color: "#706e6b", marginBottom: 8}}, "Searching\u2026"),
        noResults  && h("div", {style: {fontSize: "0.8rem", color: "#706e6b", marginBottom: 8}}, "No users found."),
        error      && h("div", {className: "um-error-banner"}, error),

        h("div", {style: {marginTop: 16}},
          h("button", {onClick: onCancel}, "Cancel")
        )
      )
    );
  }
}

// ─── Results overlay ──────────────────────────────────────────────────────────

function ResultsOverlay({type, results, createdUserId, sfHost, onClose}) {
  const titleClass = "um-overlay-title " + type;
  const titleText = type === "success" ? "User Created Successfully" : "Completed with Warnings";

  function openUser() {
    window.open(
      "https://" + sfHost + "/lightning/setup/ManageUsers/page?address=/" + createdUserId + "?noredirect=1&isUserEntityOverride=1",
      "_blank"
    );
  }

  return h("div", {className: "um-overlay"},
    h("div", {className: "um-overlay-card"},
      h("div", {className: titleClass}, titleText),

      results.length > 0 && h("table", {className: "um-result-table"},
        h("thead", {}, h("tr", {}, h("th", {}, "Action"), h("th", {}, "Outcome"))),
        h("tbody", {},
          results.map((r, i) =>
            h("tr", {key: i},
              h("td", {}, r.item),
              h("td", {className: r.outcome === "Success" ? "um-result-outcome-ok" : "um-result-outcome-fail"}, r.outcome)
            )
          )
        )
      ),

      h("div", {className: "um-area-actions", style: {marginTop: 16}},
        createdUserId && h("button", {className: "highlighted", onClick: openUser}, "Open User"),
        h("button", {onClick: onClose}, "Close")
      )
    )
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

class UserManagementApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      spinnerCount: 0,
      userFullName: "", userInitials: "\u2026", userName: "", userError: null, userErrorDescription: null,

      loading: true,
      working: false,
      loadError: null,

      mode: "create",
      cloneTargetUser: null,

      email: "",
      firstName: "",
      lastName: "",
      alias: "",
      username: "",
      nickname: "",
      profileId: "",
      roleId: "",
      resetPassword: false,
      activateUser: true,
      clonePermissionSetAssignments: false,
      clonePublicGroupMemberships: false,
      cloneQueueMemberships: false,

      profiles: [],
      profilesLoading: true,
      roles: [],
      rolesLoading: true,
      org: null,

      primaryError: null,
      showCloneSearch: false,

      overlayVisible: false,
      overlayType: "success",
      overlayResults: [],
      createdUserId: null,
    };

    this.onEmailChange = this.onEmailChange.bind(this);
    this.onPrimaryClick = this.onPrimaryClick.bind(this);
    this.onCloneClick = this.onCloneClick.bind(this);
    this.onCloneUserSelected = this.onCloneUserSelected.bind(this);
    this.onCancelCloneSearch = this.onCancelCloneSearch.bind(this);
    this.onOverlayClose = this.onOverlayClose.bind(this);
    this.onResetPasswordChange = this.onResetPasswordChange.bind(this);
    this.onActivateUserChange = this.onActivateUserChange.bind(this);
    this.onClonePermSetChange = this.onClonePermSetChange.bind(this);
  }

  spinFor(promise) {
    this.setState(s => ({spinnerCount: s.spinnerCount + 1}));
    promise
      .then(() => this.setState(s => ({spinnerCount: s.spinnerCount - 1})))
      .catch(() => this.setState(s => ({spinnerCount: s.spinnerCount - 1})));
    return promise;
  }

  async componentDidMount() {
    this.spinFor(
      getUserInfo().then(res => this.setState({
        userFullName: res.userFullName, userInitials: res.userInitials,
        userName: res.userName, userError: res.userError, userErrorDescription: res.userErrorDescription,
      }))
    );

    // Load org + profiles + roles
    this.setState(s => ({spinnerCount: s.spinnerCount + 1}));
    try {
      const [orgRecords, profileRecords, roleRecords] = await Promise.all([
        sfQuery("SELECT Id, DefaultLocaleSidKey, TimeZoneSidKey, LanguageLocaleKey FROM Organization"),
        sfQuery("SELECT Id, Name, UserLicenseId, UserLicense.Name FROM Profile ORDER BY Name"),
        sfQuery("SELECT Id, Name, DeveloperName FROM UserRole ORDER BY Name"),
      ]);

      const org = orgRecords[0];
      const profiles = profileRecords;
      const roles = roleRecords;
      const sysAdmin = profiles.find(p => p.Name === "System Administrator");
      const profileId = sysAdmin ? sysAdmin.Id : (profiles[0] ? profiles[0].Id : "");

      this.setState(s => ({
        spinnerCount: s.spinnerCount - 1,
        loading: false, org, profiles, profilesLoading: false,
        profileId, roles, rolesLoading: false, roleId: "",
      }));
    } catch (err) {
      this.setState(s => ({spinnerCount: s.spinnerCount - 1, loading: false, loadError: err.message || String(err)}));
    }
  }

  onEmailChange(e) {
    const email = e.target.value;
    this.setState({email}, () => {
      if (!isValidEmail(email)) return;
      const emailUsername = email.substring(0, email.indexOf("@"));
      const match = /^(\w+)\.(\w+)/.exec(emailUsername);
      const updates = {};
      if (match) {
        const fn = match[1][0].toUpperCase() + match[1].slice(1);
        const ln = match[2][0].toUpperCase() + match[2].slice(1);
        if (!this.state.firstName) updates.firstName = fn;
        if (!this.state.lastName)  updates.lastName = ln;
        const firstName = updates.firstName || this.state.firstName;
        const lastName  = updates.lastName  || this.state.lastName;
        if (!this.state.alias) updates.alias = generateAlias(firstName, lastName);
      } else {
        if (!this.state.lastName) updates.lastName = emailUsername;
        const lastName = updates.lastName || this.state.lastName;
        if (!this.state.alias) updates.alias = generateAlias("", lastName);
      }
      if (!this.state.username) updates.username = generateUsername(emailUsername);
      if (!this.state.nickname) updates.nickname = generateNickname();
      if (Object.keys(updates).length > 0) this.setState(updates);
    });
  }

  isFormValid() {
    const {email, lastName, alias, username, nickname, profileId} = this.state;
    return isValidEmail(email)
      && lastName.trim().length > 0
      && alias.trim().length > 0
      && isValidEmail(username)
      && nickname.trim().length > 0
      && profileId.length > 0;
  }

  onResetPasswordChange(e) {
    const checked = e.target.checked;
    this.setState({resetPassword: checked, ...(checked ? {activateUser: true} : {})});
  }

  onActivateUserChange(e) {
    const checked = e.target.checked;
    this.setState({activateUser: checked, ...(!checked ? {resetPassword: false, clonePermissionSetAssignments: false} : {})});
  }

  onClonePermSetChange(e) {
    const checked = e.target.checked;
    this.setState({clonePermissionSetAssignments: checked, ...(checked ? {activateUser: true} : {})});
  }

  onCloneClick() { this.setState({showCloneSearch: true}); }
  onCancelCloneSearch() { this.setState({showCloneSearch: false}); }

  async onCloneUserSelected(user) {
    this.setState({showCloneSearch: false});
    this.setState(s => ({spinnerCount: s.spinnerCount + 1}));
    try {
      const records = await sfQuery("SELECT Id, Username, ProfileId, UserRoleId FROM User WHERE Id = '" + user.Id + "'");
      const t = records[0];
      this.setState(s => ({
        spinnerCount: s.spinnerCount - 1,
        mode: "clone",
        cloneTargetUser: t,
        profileId: t.ProfileId || s.profileId,
        roleId: t.UserRoleId || "",
      }));
      document.title = "Clone " + t.Username + " \u2014 User Management";
    } catch (err) {
      this.setState(s => ({spinnerCount: s.spinnerCount - 1, primaryError: "Failed to load user: " + err.message}));
    }
  }

  async onPrimaryClick() {
    if (this.state.mode === "create") {
      await this.createUser();
    } else {
      await this.cloneUser();
    }
  }

  async createUser() {
    const {email, firstName, lastName, alias, username, nickname, profileId, roleId, resetPassword, org} = this.state;
    this.setState({working: true, primaryError: null});
    this.setState(s => ({spinnerCount: s.spinnerCount + 1}));
    const results = [];
    let createdId = null;

    try {
      const userRecord = {
        FirstName: firstName, LastName: lastName, Email: email,
        Alias: alias, Username: username, CommunityNickname: nickname,
        LocaleSidKey: org.DefaultLocaleSidKey, TimeZoneSidKey: org.TimeZoneSidKey,
        ProfileId: profileId, LanguageLocaleKey: org.LanguageLocaleKey,
        EmailEncodingKey: "UTF-8",
      };
      if (roleId) userRecord.UserRoleId = roleId;

      createdId = await sfCreate("User", userRecord);
      results.push({item: "Create User", outcome: "Success"});

      if (resetPassword) {
        try {
          const apexResult = await executeAnonymous("System.resetPassword('" + createdId + "', true);");
          if (apexResult.success === false || apexResult.compiled === false) {
            results.push({item: "Reset Password", outcome: "Failed: " + (apexResult.compileProblem || apexResult.exceptionMessage || "Unknown")});
          } else {
            results.push({item: "Reset Password", outcome: "Success"});
          }
        } catch (err) {
          results.push({item: "Reset Password", outcome: "Failed: " + err.message});
        }
      }

      const hasWarning = results.some(r => r.outcome !== "Success");
      this.setState(s => ({
        spinnerCount: s.spinnerCount - 1, working: false,
        overlayVisible: true, overlayType: hasWarning ? "warning" : "success",
        overlayResults: results, createdUserId: createdId,
      }));
    } catch (err) {
      this.setState(s => ({spinnerCount: s.spinnerCount - 1, working: false, primaryError: "Failed to create user: " + err.message}));
    }
  }

  async cloneUser() {
    const {
      cloneTargetUser, email, firstName, lastName, alias, username, nickname,
      profileId, roleId, activateUser, resetPassword,
      clonePermissionSetAssignments, clonePublicGroupMemberships, cloneQueueMemberships,
    } = this.state;

    this.setState({working: true, primaryError: null});
    this.setState(s => ({spinnerCount: s.spinnerCount + 1}));
    const results = [];
    let createdId = null;

    try {
      const describe = await sfDescribe("User");
      const override = new Set(["FirstName","LastName","Email","Alias","Username","CommunityNickname","ProfileId","UserRoleId","IsActive"]);
      const copyFields = describe.fields.filter(f => f.createable && !override.has(f.name)).map(f => f.name);

      const origRecords = await sfQuery("SELECT " + copyFields.join(",") + " FROM User WHERE Id = '" + cloneTargetUser.Id + "'");
      const origUser = origRecords[0];

      origUser.FirstName = firstName;
      origUser.LastName  = lastName;
      origUser.Email     = email;
      origUser.Alias     = alias;
      origUser.Username  = username;
      origUser.CommunityNickname = nickname;
      origUser.ProfileId  = profileId;
      origUser.UserRoleId = roleId || null;
      origUser.IsActive   = activateUser;

      createdId = await sfCreate("User", origUser);
      results.push({item: "Clone User", outcome: "Success"});

      if (resetPassword) {
        try {
          const apexResult = await executeAnonymous("System.resetPassword('" + createdId + "', true);");
          if (apexResult.success === false || apexResult.compiled === false) {
            results.push({item: "Reset Password", outcome: "Failed: " + (apexResult.compileProblem || apexResult.exceptionMessage || "Unknown")});
          } else {
            results.push({item: "Reset Password", outcome: "Success"});
          }
        } catch (err) {
          results.push({item: "Reset Password", outcome: "Failed: " + err.message});
        }
      }

      if (clonePermissionSetAssignments) {
        const permSets = await sfQuery(
          "SELECT AssigneeId, PermissionSet.Label, PermissionSetId FROM PermissionSetAssignment"
          + " WHERE AssigneeId = '" + cloneTargetUser.Id + "' AND PermissionSet.IsOwnedByProfile = false"
        );
        for (const ps of permSets) {
          const label = ps.PermissionSet ? ps.PermissionSet.Label : ps.PermissionSetId;
          try {
            await sfCreate("PermissionSetAssignment", {AssigneeId: createdId, PermissionSetId: ps.PermissionSetId});
            results.push({item: "Clone Permission Set '" + label + "'", outcome: "Success"});
          } catch (err) {
            results.push({item: "Clone Permission Set '" + label + "'", outcome: "Failed: " + err.message});
          }
        }
      }

      if (clonePublicGroupMemberships) await this.cloneGroupMemberships(cloneTargetUser.Id, createdId, "Regular", "Public Group", results);
      if (cloneQueueMemberships)        await this.cloneGroupMemberships(cloneTargetUser.Id, createdId, "Queue",   "Queue",        results);

      const hasWarning = results.some(r => r.outcome !== "Success");
      this.setState(s => ({
        spinnerCount: s.spinnerCount - 1, working: false,
        overlayVisible: true, overlayType: hasWarning ? "warning" : "success",
        overlayResults: results, createdUserId: createdId,
      }));
    } catch (err) {
      this.setState(s => ({spinnerCount: s.spinnerCount - 1, working: false, primaryError: "Failed to clone user: " + err.message}));
    }
  }

  async cloneGroupMemberships(fromUserId, toUserId, groupType, typeLabel, results) {
    const memberships = await sfQuery(
      "SELECT Group.Name, GroupId, UserOrGroupId FROM GroupMember"
      + " WHERE UserOrGroupId = '" + fromUserId + "' AND Group.Type = '" + groupType + "'"
    );
    for (const m of memberships) {
      const name = m.Group ? m.Group.Name : m.GroupId;
      try {
        await sfCreate("GroupMember", {GroupId: m.GroupId, UserOrGroupId: toUserId});
        results.push({item: "Clone " + typeLabel + " '" + name + "'", outcome: "Success"});
      } catch (err) {
        results.push({item: "Clone " + typeLabel + " '" + name + "'", outcome: "Failed: " + err.message});
      }
    }
  }

  onOverlayClose() {
    this.setState({
      overlayVisible: false, overlayResults: [], createdUserId: null,
      mode: "create", cloneTargetUser: null,
      email: "", firstName: "", lastName: "", alias: "", username: "", nickname: "",
      resetPassword: false, activateUser: true,
      clonePermissionSetAssignments: false, clonePublicGroupMemberships: false, cloneQueueMemberships: false,
    });
    document.title = "User Management";
  }

  render() {
    const {sfHost} = this.props;
    const {
      spinnerCount, userFullName, userInitials, userName, userError, userErrorDescription,
      loading, working, loadError,
      mode, cloneTargetUser,
      email, firstName, lastName, alias, username, nickname,
      profileId, roleId, resetPassword, activateUser,
      clonePermissionSetAssignments, clonePublicGroupMemberships, cloneQueueMemberships,
      profiles, profilesLoading, roles, rolesLoading,
      primaryError, showCloneSearch,
      overlayVisible, overlayType, overlayResults, createdUserId,
    } = this.state;

    const sfLink = "https://" + sfHost;
    const isClone = mode === "clone";
    const primaryLabel = isClone ? "Clone & Close" : "Create & Close";
    const emailValid = email.length === 0 || isValidEmail(email);

    return h("div", {},

      // ── Modals ──────────────────────────────────────────────────────────
      showCloneSearch && h(UserSearchModal, {onSelect: this.onCloneUserSelected, onCancel: this.onCancelCloneSearch}),
      overlayVisible  && h(ResultsOverlay,  {type: overlayType, results: overlayResults, createdUserId, sfHost, onClose: this.onOverlayClose}),

      h(PageHeader, {
        pageTitle: isClone ? "Clone User" : "User Management",
        subTitle: isClone ? (cloneTargetUser ? cloneTargetUser.Username : "\u2026") : undefined,
        orgName: sfHost.split(".")[0]?.toUpperCase() || "",
        sfLink,
        sfHost,
        spinnerCount,
        userFullName, userInitials, userName, userError, userErrorDescription,
      }),

      // ── Load error ──────────────────────────────────────────────────────
      loadError && h("div", {className: "area", style: {color: "#c23934", fontWeight: 600}},
        "Failed to load: " + loadError
      ),

      // ── Form area ───────────────────────────────────────────────────────
      !loadError && h("div", {className: "area", style: {position: "relative"}},

        // Working overlay (spinner over the form while saving)
        working && h("div", {className: "um-working-overlay"},
          h("div", {
            role: "status",
            className: "slds-spinner slds-spinner_medium slds-spinner_inline",
          },
            h("span", {className: "slds-assistive-text"}, "Saving\u2026"),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"})
          )
        ),

        // Header row: title + action buttons
        h("div", {className: "um-area-header"},
          h("h1", {},
            isClone ? h("span", {}, "Clone User ", h("span", {className: "um-mode-badge"}, "CLONE")) : "Quick Create User"
          ),
          h("div", {className: "um-area-actions"},
            h("button", {onClick: this.onCloneClick, disabled: loading || working}, "Clone a User\u2026"),
            h("button", {
              className: "highlighted",
              onClick: this.onPrimaryClick,
              disabled: loading || working || !this.isFormValid(),
            }, primaryLabel)
          )
        ),

        loading && h("div", {style: {color: "#706e6b", padding: "16px 0"}}, "Loading\u2026"),

        !loading && h("div", {},
          h("p", {style: {marginTop: 0, marginBottom: 10}},
            "Enter an email address and the rest of the form will auto-populate."
          ),

          // Email
          h("div", {className: "um-form-element"},
            h("label", {className: "um-label"},
              h("span", {className: "required"}, "* "), "Email"
            ),
            h("input", {
              type: "text",
              className: "um-input" + (!emailValid ? " error" : ""),
              value: email,
              onChange: this.onEmailChange,
              autoFocus: true,
              placeholder: "user@example.com",
            }),
            !emailValid && h("div", {className: "um-field-error"}, "Enter a valid email address.")
          ),

          // First / Last name
          h("div", {className: "um-form-row"},
            h("div", {className: "um-form-element"},
              h("label", {className: "um-label"}, "First Name"),
              h("input", {type: "text", className: "um-input", value: firstName, onChange: e => this.setState({firstName: e.target.value})})
            ),
            h("div", {className: "um-form-element"},
              h("label", {className: "um-label"}, h("span", {className: "required"}, "* "), "Last Name"),
              h("input", {type: "text", className: "um-input", value: lastName, onChange: e => this.setState({lastName: e.target.value})})
            )
          ),

          // Profile / Role
          h("div", {className: "um-form-row"},
            h("div", {className: "um-form-element"},
              h("label", {className: "um-label"}, h("span", {className: "required"}, "* "), "Profile"),
              h("select", {
                className: "um-select",
                value: profileId,
                onChange: e => this.setState({profileId: e.target.value}),
                disabled: profilesLoading,
              },
                profilesLoading && h("option", {value: ""}, "Loading\u2026"),
                !profilesLoading && profiles.map(p =>
                  h("option", {key: p.Id, value: p.Id},
                    p.Name + " (" + (p.UserLicense ? p.UserLicense.Name : "") + ")"
                  )
                )
              )
            ),
            h("div", {className: "um-form-element"},
              h("label", {className: "um-label"}, "Role"),
              h("select", {
                className: "um-select",
                value: roleId,
                onChange: e => this.setState({roleId: e.target.value}),
                disabled: rolesLoading,
              },
                rolesLoading && h("option", {value: ""}, "Loading\u2026"),
                !rolesLoading && h("option", {value: ""}, "None"),
                !rolesLoading && roles.map(r =>
                  h("option", {key: r.Id, value: r.Id}, r.Name + " (" + r.DeveloperName + ")")
                )
              )
            )
          ),

          // Alias
          h("div", {className: "um-form-element"},
            h("label", {className: "um-label"}, h("span", {className: "required"}, "* "), "Alias"),
            h("input", {type: "text", className: "um-input", value: alias, onChange: e => this.setState({alias: e.target.value}), maxLength: 8})
          ),

          // Username
          h("div", {className: "um-form-element"},
            h("label", {className: "um-label"}, h("span", {className: "required"}, "* "), "Username"),
            h("input", {type: "text", className: "um-input", value: username, onChange: e => this.setState({username: e.target.value})}),
            h("div", {className: "um-hint"}, "Must be email format and unique across all Salesforce orgs.")
          ),

          // Nickname
          h("div", {className: "um-form-element"},
            h("label", {className: "um-label"}, h("span", {className: "required"}, "* "), "Nickname"),
            h("input", {type: "text", className: "um-input", value: nickname, onChange: e => this.setState({nickname: e.target.value})})
          ),

          // Clone options (clone mode only)
          isClone && h("fieldset", {className: "um-fieldset"},
            h("legend", {className: "um-legend"}, "Cloning Options"),
            h("div", {className: "um-checkbox-group"},
              h("label", {className: "um-checkbox-item"},
                h("input", {type: "checkbox", checked: clonePermissionSetAssignments, onChange: this.onClonePermSetChange}),
                "Permission Set Assignments"
              ),
              h("label", {className: "um-checkbox-item"},
                h("input", {type: "checkbox", checked: clonePublicGroupMemberships, onChange: e => this.setState({clonePublicGroupMemberships: e.target.checked})}),
                "Public Group Memberships"
              ),
              h("label", {className: "um-checkbox-item"},
                h("input", {type: "checkbox", checked: cloneQueueMemberships, onChange: e => this.setState({cloneQueueMemberships: e.target.checked})}),
                "Queue Memberships"
              ),
              h("label", {className: "um-checkbox-item"},
                h("input", {type: "checkbox", checked: activateUser, onChange: this.onActivateUserChange}),
                "Activate User"
              )
            )
          ),

          // Reset password
          h("div", {className: "um-form-element"},
            h("label", {className: "um-checkbox-item"},
              h("input", {type: "checkbox", checked: resetPassword, onChange: this.onResetPasswordChange}),
              "Reset password and notify user immediately"
            )
          ),

          // Inline error
          primaryError && h("div", {className: "um-error-banner"}, primaryError)
        )
      )
    );
  }
}

let args = new URLSearchParams(location.search.slice(1));
let sfHost = args.get("host");
initButton(sfHost, true);
sfConn.getSession(sfHost).then(() => {
  document.title = "User Management";
  ReactDOM.render(h(UserManagementApp, {sfHost}), document.getElementById("root"));
});
