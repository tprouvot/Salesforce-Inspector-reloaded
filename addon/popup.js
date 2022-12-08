/* global React ReactDOM */
import { sfConn, apiVersion } from "./inspector.js";
import { getAllFieldSetupLinks } from "./setup-links.js";

let h = React.createElement;

{
  parent.postMessage({ insextInitRequest: true }, "*");
  addEventListener("message", function initResponseHandler(e) {
    if (e.source == parent && e.data.insextInitResponse) {
      removeEventListener("message", initResponseHandler);
      init(e.data);
    }
  });
}

function closePopup() {
  parent.postMessage({ insextClosePopup: true }, "*");
}

function init({ sfHost, inDevConsole, inLightning, inInspector }) {
  let addonVersion = chrome.runtime.getManifest().version;

  sfConn.getSession(sfHost).then(() => {

    ReactDOM.render(h(App, {
      sfHost,
      inDevConsole,
      inLightning,
      inInspector,
      addonVersion,
    }), document.getElementById("root"));

  });
}

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isInSetup: false,
      contextUrl: null
    };
    this.onContextUrlMessage = this.onContextUrlMessage.bind(this);
    this.onShortcutKey = this.onShortcutKey.bind(this);
  }
  onContextUrlMessage(e) {
    if (e.source == parent && e.data.insextUpdateRecordId) {
      let { locationHref } = e.data;
      this.setState({
        isInSetup: locationHref.includes("/lightning/setup/"),
        contextUrl: locationHref
      });
    }
  }

  onShortcutKey(e) {
    if (e.key == "m") {
      e.preventDefault();
      this.refs.showAllDataBox.clickShowDetailsBtn();
    }
    if (e.key == "a") {
      e.preventDefault();
      this.refs.showAllDataBox.clickAllDataBtn();
    }
    if (e.key == "e") {
      e.preventDefault();
      this.refs.dataExportBtn.click();
    }
    if (e.key == "i") {
      e.preventDefault();
      this.refs.dataImportBtn.click();
    }
    if (e.key == "l") {
      e.preventDefault();
      this.refs.limitsBtn.click();
    }
    if (e.key == "d") {
      e.preventDefault();
      this.refs.metaRetrieveBtn.click();
    }
    if (e.key == "x") {
      e.preventDefault();
      this.refs.apiExploreBtn.click();
    }
    if (e.key == "h" && this.refs.homeBtn) {
      this.refs.homeBtn.click();
    }
    //TODO: Add shortcut for "u to go to user aspect"
  }
  componentDidMount() {
    addEventListener("message", this.onContextUrlMessage);
    addEventListener("keydown", this.onShortcutKey);
    parent.postMessage({ insextLoaded: true }, "*");
  }
  componentWillUnmount() {
    removeEventListener("message", this.onContextUrlMessage);
    removeEventListener("keydown", this.onShortcutKey);
  }
  render() {
    let {
      sfHost,
      inDevConsole,
      inLightning,
      inInspector,
      addonVersion,
    } = this.props;
    let { isInSetup, contextUrl } = this.state;
    let hostArg = new URLSearchParams();
    hostArg.set("host", sfHost);
    let linkTarget = inDevConsole ? "_blank" : "_top";
    return (
      h("div", {},
        h("div", { className: "header" },
          h("div", { className: "header-icon" },
            h("svg", { viewBox: "0 0 24 24" },
              h("path", {
                d: `
                M11 9c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1z
                m1 5.8c0 .2-.1.3-.3.3h-1.4c-.2 0-.3-.1-.3-.3v-4.6c0-.2.1-.3.3-.3h1.4c.2.0.3.1.3.3z
                M11 3.8c-4 0-7.2 3.2-7.2 7.2s3.2 7.2 7.2 7.2s7.2-3.2 7.2-7.2s-3.2-7.2-7.2-7.2z
                m0 12.5c-2.9 0-5.3-2.4-5.3-5.3s2.4-5.3 5.3-5.3s5.3 2.4 5.3 5.3-2.4 5.3-5.3 5.3z
                M 17.6 15.9c-.2-.2-.3-.2-.5 0l-1.4 1.4c-.2.2-.2.3 0 .5l4 4c.2.2.3.2.5 0l1.4-1.4c.2-.2.2-.3 0-.5z
                `})
            )
          ),
          "Salesforce inspector"
        ),
        h("div", { className: "main" },
          h(AllDataBox, { ref: "showAllDataBox", sfHost, showDetailsSupported: !inLightning && !inInspector, linkTarget, contextUrl }),
          h("div", { className: "global-box" },
            h("a", { ref: "dataExportBtn", href: "data-export.html?" + hostArg, target: linkTarget, className: "button" }, "Data ", h("u", {}, "E"), "xport"),
            h("a", { ref: "dataImportBtn", href: "data-import.html?" + hostArg, target: linkTarget, className: "button" }, "Data ", h("u", {}, "I"), "mport"),
            h("a", { ref: "limitsBtn", href: "limits.html?" + hostArg, target: linkTarget, className: "button" }, "Org ", h("u", {}, "L"), "imits"),
            // Advanded features should be put below this line, and the layout adjusted so they are below the fold
            h("a", { ref: "metaRetrieveBtn", href: "metadata-retrieve.html?" + hostArg, target: linkTarget, className: "button" }, h("u", {}, "D"), "ownload Metadata"),
            h("a", { ref: "apiExploreBtn", href: "explore-api.html?" + hostArg, target: linkTarget, className: "button" }, "E", h("u", {}, "x"), "plore API"),
            h("a", { ref: "generateToken", href: `https://${sfHost}/services/oauth2/authorize?response_type=token&client_id=` + localStorage.getItem(sfHost + "_clientId") + "&redirect_uri=chrome-extension://" + chrome.runtime.id + "/data-export.html?host=" + sfHost + "%26", target: linkTarget, className: "button" }, h("u", {}, "G"), "enerate Connected App Token"),
            // Workaround for in Lightning the link to Setup always opens a new tab, and the link back cannot open a new tab.
            inLightning && isInSetup && h("a", { ref: "homeBtn", href: `https://${sfHost}/lightning/page/home`, title: "You can choose if you want to open in a new tab or not", target: linkTarget, className: "button" }, "Salesforce ", h("u", {}, "H"), "ome"),
            inLightning && !isInSetup && h("a", { ref: "homeBtn", href: `https://${sfHost}/lightning/setup/SetupOneHome/home?setupApp=all`, title: "You can choose if you want to open in a new tab or not", target: linkTarget, className: "button" }, "Setup ", h("u", {}, "H"), "ome"),
          )
        ),
        h("div", { className: "footer" },
          h("div", { className: "meta" },
            h("div", { className: "version" },
              "(",
              h("a", { href: "https://github.com/tprouvot/Chrome-Salesforce-inspector/blob/master/CHANGES.md" }, "v" + addonVersion),
              " / " + apiVersion + ")",
            ),
            h("div", { className: "tip" }, "[ctrl+alt+i] to open"),
            h("a", { className: "about", href: "https://github.com/tprouvot/Chrome-Salesforce-inspector", target: linkTarget }, "About")
          ),
        )
      )
    );
  }
}

class AllDataBox extends React.PureComponent {

  constructor(props) {
    super(props);
    this.SearchAspectTypes = Object.freeze({ sobject: "sobject", users: "users" }); //Enum. Supported aspects

    this.state = {
      activeSearchAspect: this.SearchAspectTypes.sobject,
      sobjectsList: null,
      sobjectsLoading: true,
      usersBoxLoading: false,
      contextRecordId: null,
      contextUserId: null,
      contextOrgId: null,
      contextPath: null,
    };
    this.onAspectClick = this.onAspectClick.bind(this);
    this.parseContextUrl = this.ensureKnownBrowserContext.bind(this);
  }

  componentDidMount() {
    this.ensureKnownBrowserContext();
    this.loadSobjects();
  }

  componentDidUpdate(prevProps, prevState) {
    let { activeSearchAspect } = this.state;
    if (prevProps.contextUrl !== this.props.contextUrl) {
      this.ensureKnownBrowserContext();
    }
    if (prevState.activeSearchAspect !== activeSearchAspect) {
      switch (activeSearchAspect) {
        case this.SearchAspectTypes.sobject:
          this.ensureKnownBrowserContext();
          break;
        case this.SearchAspectTypes.users:
          this.ensureKnownUserContext();
          break;
      }
    }
  }

  ensureKnownBrowserContext() {
    let { contextUrl } = this.props;
    if (contextUrl) {
      let recordId = getRecordId(contextUrl);
      let path = getSfPathFromUrl(contextUrl);
      this.setState({
        contextRecordId: recordId,
        contextPath: path
      });
    }
  }

  setIsLoading(aspect, value) {
    switch (aspect) {
      case "usersBox": this.setState({ usersBoxLoading: value });
        break;
    }
  }

  isLoading() {
    let { usersBoxLoading, sobjectsLoading } = this.state;
    return sobjectsLoading || usersBoxLoading;
  }

  async ensureKnownUserContext() {
    let { contextUserId, contextOrgId } = this.state;

    if (!contextUserId || !contextOrgId) {
      try {
        const userInfo = await sfConn.rest("/services/oauth2/userinfo");
        let contextUserId = userInfo.user_id;
        let contextOrgId = userInfo.organization_id;
        this.setState({ contextUserId, contextOrgId });
      } catch (err) {
        console.error("Unable to query user context", err);
      }
    }
  }

  onAspectClick(e) {
    this.setState({
      activeSearchAspect: e.currentTarget.dataset.aspect
    });
  }

  loadSobjects() {
    let entityMap = new Map();

    function addEntity({ name, label, keyPrefix }, api) {
      label = label || ""; // Avoid null exceptions if the object does not have a label (some don't). All objects have a name. Not needed for keyPrefix since we only do equality comparisons on those.
      let entity = entityMap.get(name);
      if (entity) {
        if (!entity.label) { // Doesn't seem to be needed, but if we have to do it for keyPrefix, we can just as well do it for label.
          entity.label = label;
        }
        if (!entity.keyPrefix) { // For some objects the keyPrefix is only available in some of the APIs.
          entity.keyPrefix = keyPrefix;
        }
      } else {
        entity = {
          availableApis: [],
          name,
          label,
          keyPrefix,
          availableKeyPrefix: null,
        };
        entityMap.set(name, entity);
      }
      if (api) {
        entity.availableApis.push(api);
        if (keyPrefix) {
          entity.availableKeyPrefix = keyPrefix;
        }
      }
    }

    function getObjects(url, api) {
      return sfConn.rest(url).then(describe => {
        for (let sobject of describe.sobjects) {
          addEntity(sobject, api);
        }
      }).catch(err => {
        console.error("list " + api + " sobjects", err);
      });
    }

    function getEntityDefinitions(bucket) {
      let query = "select QualifiedApiName, Label, KeyPrefix from EntityDefinition" + bucket;
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(query)).then(res => {
        for (let record of res.records) {
          addEntity({
            name: record.QualifiedApiName,
            label: record.Label,
            keyPrefix: record.KeyPrefix
          }, null);
        }
      }).catch(err => {
        console.error("list entity definitions: " + bucket, err);
      });
    }

    Promise.all([
      // Get objects the user can access from the regular API
      getObjects("/services/data/v" + apiVersion + "/sobjects/", "regularApi"),
      // Get objects the user can access from the tooling API
      getObjects("/services/data/v" + apiVersion + "/tooling/sobjects/", "toolingApi"),
      // Get all objects, even the ones the user cannot access from any API
      // These records are less interesting than the ones the user has access to, but still interesting since we can get information about them using the tooling API
      // If there are too many records, we get "EXCEEDED_ID_LIMIT: EntityDefinition does not support queryMore(), use LIMIT to restrict the results to a single batch"
      // We cannot use limit and offset to work around it, since EntityDefinition does not support those according to the documentation, and they seem to work in a querky way in practice.
      // Tried to use http://salesforce.stackexchange.com/a/22643, but "order by x" uses AaBbCc as sort order, while "where x > ..." uses sort order ABCabc, so it does not work on text fields, and there is no unique numerical field we can sort by.
      // Here we split the query into a somewhat arbitrary set of fixed buckets, and hope none of the buckets exceed 2000 records.
      getEntityDefinitions(" where QualifiedApiName < 'M' limit 2000"),
      getEntityDefinitions(" where QualifiedApiName >= 'M' limit 2000"),
    ])
      .then(() => {
        // TODO progressively display data as each of the three responses becomes available
        this.setState({
          sobjectsLoading: false,
          sobjectsList: Array.from(entityMap.values())
        });
        this.refs.showAllDataBoxSObject.refs.allDataSearch.getMatchesDelayed("");
      })
      .catch(e => {
        console.error(e);
        this.setState({ sobjectsLoading: false });
      });
  }

  render() {
    let { activeSearchAspect, sobjectsLoading, contextRecordId, contextUserId, contextOrgId, contextPath, sobjectsList } = this.state;
    let { sfHost, showDetailsSupported, linkTarget } = this.props;

    return (
      h("div", { className: "all-data-box " + (this.isLoading() ? "loading " : "") },
        h("ul", { className: "small-tabs" },
          h("li", { onClick: this.onAspectClick, "data-aspect": this.SearchAspectTypes.sobject, className: (activeSearchAspect == this.SearchAspectTypes.sobject) ? "active" : "" }, "Objects"),
          h("li", { onClick: this.onAspectClick, "data-aspect": this.SearchAspectTypes.users, className: (activeSearchAspect == this.SearchAspectTypes.users) ? "active" : "" }, "Users")
        ),

        (activeSearchAspect == this.SearchAspectTypes.sobject)
          ? h(AllDataBoxSObject, { ref: "showAllDataBoxSObject", sfHost, showDetailsSupported, sobjectsList, sobjectsLoading, contextRecordId, linkTarget })
          : (activeSearchAspect == this.SearchAspectTypes.users)
            ? h(AllDataBoxUsers, { ref: "showAllDataBoxUsers", sfHost, linkTarget, contextUserId, contextOrgId, contextPath, setIsLoading: (value) => { this.setIsLoading("usersBox", value); } }, "Users")
            : "AllData aspect " + activeSearchAspect + " not implemented"
      )
    );
  }
}

class AllDataBoxUsers extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectedUser: null,
      selectedUserId: null,
    };
    this.getMatches = this.getMatches.bind(this);
    this.onDataSelect = this.onDataSelect.bind(this);
  }

  componentDidMount() {
    let { contextUserId } = this.props;
    this.onDataSelect({ Id: contextUserId });
    this.refs.allDataSearch.refs.showAllDataInp.focus();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.contextUserId !== this.props.contextUserId) {
      this.onDataSelect({ Id: this.props.contextUserId });
    }
  }

  async getMatches(userQuery) {
    let { setIsLoading } = this.props;
    if (!userQuery) {
      return [];
    }

    //TODO: Better search query. SOSL?
    const fullQuerySelect = "select Id, Name, Email, Username, UserRole.Name, Alias, LocaleSidKey, LanguageLocaleKey, IsActive, ProfileId, Profile.Name";
    const minimalQuerySelect = "select Id, Name, Email, Username, UserRole.Name, Alias, LocaleSidKey, LanguageLocaleKey, IsActive";
    const queryFrom = "from User where (username like '%" + userQuery + "%' or name like '%" + userQuery + "%') order by IsActive DESC, LastLoginDate limit 100";
    const compositeQuery = {
      "compositeRequest": [
        {
          "method": "GET",
          "url": "/services/data/v47.0/query/?q=" + encodeURIComponent(fullQuerySelect + " " + queryFrom),
          "referenceId": "fullData"
        }, {
          "method": "GET",
          "url": "/services/data/v47.0/query/?q=" + encodeURIComponent(minimalQuerySelect + " " + queryFrom),
          "referenceId": "minimalData"
        }
      ]
    };

    try {
      setIsLoading(true);
      const userSearchResult = await sfConn.rest("/services/data/v" + apiVersion + "/composite", { method: "POST", body: compositeQuery });
      let users = userSearchResult.compositeResponse.find((elm) => elm.httpStatusCode == 200).body.records;
      return users;
    } catch (err) {
      console.error("Unable to query user details with: " + JSON.stringify(compositeQuery) + ".", err);
      return [];
    } finally {
      setIsLoading(false);
    }

  }

  async onDataSelect(userRecord) {
    if (userRecord && userRecord.Id) {
      await this.setState({ selectedUserId: userRecord.Id, selectedUser: null });
      await this.querySelectedUserDetails();
    }
  }

  async querySelectedUserDetails() {
    let { selectedUserId } = this.state;
    let { setIsLoading } = this.props;

    if (!selectedUserId) {
      return;
    }
    //Optimistically attempt broad query (fullQuery) and fall back to minimalQuery to ensure some data is returned in most cases (e.g. profile cannot be queried by community users)
    const fullQuerySelect = "select Id, Name, Email, Username, UserRole.Name, Alias, LocaleSidKey, LanguageLocaleKey, IsActive, FederationIdentifier, ProfileId, Profile.Name";
    const minimalQuerySelect = "select Id, Name, Email, Username, UserRole.Name, Alias, LocaleSidKey, LanguageLocaleKey, IsActive, FederationIdentifier";
    const queryFrom = "from User where Id='" + selectedUserId + "' limit 1";
    const compositeQuery = {
      "compositeRequest": [
        {
          "method": "GET",
          "url": "/services/data/v47.0/query/?q=" + encodeURIComponent(fullQuerySelect + " " + queryFrom),
          "referenceId": "fullData"
        }, {
          "method": "GET",
          "url": "/services/data/v47.0/query/?q=" + encodeURIComponent(minimalQuerySelect + " " + queryFrom),
          "referenceId": "minimalData"
        }
      ]
    };

    try {
      setIsLoading(true);
      //const userResult = await sfConn.rest("/services/data/v" + apiVersion + "/sobjects/User/" + selectedUserId); //Does not return profile details. Query call is therefore prefered
      const userResult = await sfConn.rest("/services/data/v" + apiVersion + "/composite", { method: "POST", body: compositeQuery });
      let userDetail = userResult.compositeResponse.find((elm) => elm.httpStatusCode == 200).body.records[0];
      await this.setState({ selectedUser: userDetail });
    } catch (err) {
      console.error("Unable to query user details with: " + JSON.stringify(compositeQuery) + ".", err);
    } finally {
      setIsLoading(false);
    }
  }

  resultRender(matches, userQuery) {
    return matches.map(value => ({
      key: value.Id,
      value,
      element: [
        h("div", { className: "autocomplete-item-main", key: "main" },
          h(MarkSubstring, {
            text: value.Name + " (" + value.Alias + ")",
            start: value.Name.toLowerCase().indexOf(userQuery.toLowerCase()),
            length: userQuery.length
          })),
        h("div", { className: "autocomplete-item-sub small", key: "sub" },
          h("div", {}, (value.Profile) ? value.Profile.Name : ""),
          h(MarkSubstring, {
            text: (!value.IsActive) ? "⚠ " + value.Username : value.Username,
            start: value.Username.toLowerCase().indexOf(userQuery.toLowerCase()),
            length: userQuery.length
          }))
      ]
    }));
  }

  render() {
    let { selectedUser } = this.state;
    let { sfHost, linkTarget, contextOrgId, contextUserId, contextPath } = this.props;

    return (
      h("div", { ref: "usersBox", className: "users-box" },
        h(AllDataSearch, { ref: "allDataSearch", getMatches: this.getMatches, onDataSelect: this.onDataSelect, inputSearchDelay: 400, placeholderText: "Username, email, alias or name of user", resultRender: this.resultRender }),
        h("div", { className: "all-data-box-inner" + (!selectedUser ? " empty" : "") },
          selectedUser
            ? h(UserDetails, { user: selectedUser, sfHost, contextOrgId, currentUserId: contextUserId, linkTarget, contextPath })
            : h("div", { className: "center" }, "No user details available")
        ))
    );
  }
}

class AllDataBoxSObject extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectedValue: null,
      recordIdDetails: null
    };
    this.onDataSelect = this.onDataSelect.bind(this);
    this.getMatches = this.getMatches.bind(this);
  }

  componentDidMount() {
    let { contextRecordId } = this.props;
    this.updateSelection(contextRecordId);
  }

  componentDidUpdate(prevProps) {
    let { contextRecordId, sobjectsLoading } = this.props;
    if (prevProps.contextRecordId !== contextRecordId) {
      this.updateSelection(contextRecordId);
    }
    if (prevProps.sobjectsLoading !== sobjectsLoading && !sobjectsLoading) {
      this.updateSelection(contextRecordId);
    }
  }

  async updateSelection(query) {
    let match = this.getBestMatch(query);
    await this.setState({ selectedValue: match });
    this.loadRecordIdDetails();
  }

  loadRecordIdDetails() {
    let { selectedValue } = this.state;
    //If a recordId is selected and the object supports regularApi
    if (selectedValue && selectedValue.recordId && selectedValue.sobject && selectedValue.sobject.availableApis && selectedValue.sobject.availableApis.includes("regularApi")) {
      //optimistically assume the object has certain attribues. If some are not present, no recordIdDetails are displayed
      //TODO: Better handle objects with no recordtypes. Currently the optimistic approach results in no record details being displayed for ids for objects without record types.
      let query = "select Id, LastModifiedBy.Alias, CreatedBy.Alias, RecordType.DeveloperName, CreatedDate, LastModifiedDate from " + selectedValue.sobject.name + " where id='" + selectedValue.recordId + "'";
      sfConn.rest("/services/data/v" + apiVersion + "/query?q=" + encodeURIComponent(query), { logErrors: false }).then(res => {
        for (let record of res.records) {
          let lastModifiedDate = new Date(record.LastModifiedDate);
          let createdDate = new Date(record.CreatedDate);
          this.setState({
            recordIdDetails: {
              "recordTypeName": (record.RecordType) ? record.RecordType.DeveloperName : "-",
              "createdBy": record.CreatedBy.Alias,
              "lastModifiedBy": record.LastModifiedBy.Alias,
              "created": createdDate.toLocaleDateString() + " " + createdDate.toLocaleTimeString(),
              "lastModified": lastModifiedDate.toLocaleDateString() + " " + lastModifiedDate.toLocaleTimeString(),
            }
          });
        }
      }).catch(() => {
        //Swallow this exception since it is likely due to missing standard attributes on the record - i.e. an invalid query.
        this.setState({ recordIdDetails: null });
      });

    } else {
      this.setState({ recordIdDetails: null });
    }
  }

  getBestMatch(query) {
    let { sobjectsList } = this.props;
    // Find the best match based on the record id or object name from the page URL.
    if (!query) {
      return null;
    }
    if (!sobjectsList) {
      return null;
    }
    let sobject = sobjectsList.find(sobject => sobject.name.toLowerCase() == query.toLowerCase());
    let queryKeyPrefix = query.substring(0, 3);
    if (!sobject) {
      sobject = sobjectsList.find(sobject => sobject.availableKeyPrefix == queryKeyPrefix);
    }
    if (!sobject) {
      sobject = sobjectsList.find(sobject => sobject.keyPrefix == queryKeyPrefix);
    }
    if (!sobject) {
      return null;
    }
    let recordId = null;
    if (sobject.keyPrefix == queryKeyPrefix && query.match(/^([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/)) {
      recordId = query;
    }
    return { recordId, sobject };
  }

  getMatches(query) {
    let { sobjectsList, contextRecordId } = this.props;

    if (!sobjectsList) {
      return [];
    }
    let queryKeyPrefix = query.substring(0, 3);
    let res = sobjectsList
      .filter(sobject => sobject.name.toLowerCase().includes(query.toLowerCase()) || sobject.label.toLowerCase().includes(query.toLowerCase()) || sobject.keyPrefix == queryKeyPrefix)
      .map(sobject => ({
        recordId: null,
        sobject,
        // TO-DO: merge with the sortRank function in data-export
        relevance:
          (sobject.keyPrefix == queryKeyPrefix ? 2
            : sobject.name.toLowerCase() == query.toLowerCase() ? 3
              : sobject.label.toLowerCase() == query.toLowerCase() ? 4
                : sobject.name.toLowerCase().startsWith(query.toLowerCase()) ? 5
                  : sobject.label.toLowerCase().startsWith(query.toLowerCase()) ? 6
                    : sobject.name.toLowerCase().includes("__" + query.toLowerCase()) ? 7
                      : sobject.name.toLowerCase().includes("_" + query.toLowerCase()) ? 8
                        : sobject.label.toLowerCase().includes(" " + query.toLowerCase()) ? 9
                          : 10) + (sobject.availableApis.length == 0 ? 20 : 0)
      }));
    query = query || contextRecordId || "";
    queryKeyPrefix = query.substring(0, 3);
    if (query.match(/^([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/)) {
      let objectsForId = sobjectsList.filter(sobject => sobject.keyPrefix == queryKeyPrefix);
      for (let sobject of objectsForId) {
        res.unshift({ recordId: query, sobject, relevance: 1 });
      }
    }
    res.sort((a, b) => a.relevance - b.relevance || a.sobject.name.localeCompare(b.sobject.name));
    return res;
  }

  onDataSelect(value) {
    this.setState({ selectedValue: value }, () => {
      this.loadRecordIdDetails();
    });
  }

  clickShowDetailsBtn() {
    if (this.refs.allDataSelection) {
      this.refs.allDataSelection.clickShowDetailsBtn();
    }
  }

  clickAllDataBtn() {
    if (this.refs.allDataSelection) {
      this.refs.allDataSelection.clickAllDataBtn();
    }
  }

  resultRender(matches, userQuery) {
    return matches.map(value => ({
      key: value.recordId + "#" + value.sobject.name,
      value,
      element: [
        h("div", { className: "autocomplete-item-main", key: "main" },
          value.recordId || h(MarkSubstring, {
            text: value.sobject.name,
            start: value.sobject.name.toLowerCase().indexOf(userQuery.toLowerCase()),
            length: userQuery.length
          }),
          value.sobject.availableApis.length == 0 ? " (Not readable)" : ""
        ),
        h("div", { className: "autocomplete-item-sub", key: "sub" },
          h(MarkSubstring, {
            text: value.sobject.keyPrefix || "---",
            start: value.sobject.keyPrefix == userQuery.substring(0, 3) ? 0 : -1,
            length: 3
          }),
          " • ",
          h(MarkSubstring, {
            text: value.sobject.label,
            start: value.sobject.label.toLowerCase().indexOf(userQuery.toLowerCase()),
            length: userQuery.length
          })
        )
      ]
    }));
  }

  render() {
    let { sfHost, showDetailsSupported, sobjectsList, linkTarget, contextRecordId } = this.props;
    let { selectedValue, recordIdDetails } = this.state;
    return (
      h("div", {},
        h(AllDataSearch, { ref: "allDataSearch", onDataSelect: this.onDataSelect, sobjectsList, getMatches: this.getMatches, inputSearchDelay: 0, placeholderText: "Record id, id prefix or object name", resultRender: this.resultRender }),
        selectedValue
          ? h(AllDataSelection, { ref: "allDataSelection", sfHost, showDetailsSupported, selectedValue, linkTarget, recordIdDetails, contextRecordId })
          : h("div", { className: "all-data-box-inner empty" }, "No record to display")
      )
    );
  }
}

class UserDetails extends React.PureComponent {
  doSupportLoginAs(user) {
    let { currentUserId } = this.props;
    //Optimistically show login unless it's logged in user's userid or user is inactive.
    //No API to determine if user is allowed to login as given user. See https://salesforce.stackexchange.com/questions/224342/query-can-i-login-as-for-users
    if (!user || user.Id == currentUserId || !user.IsActive) {
      return false;
    }
    return true;
  }

  getLoginAsLink(userId) {
    let { sfHost, contextOrgId, contextPath } = this.props;
    const retUrl = contextPath || "/";
    const targetUrl = contextPath || "/";
    return "https://" + sfHost + "/servlet/servlet.su" + "?oid=" + encodeURIComponent(contextOrgId) + "&suorgadminid=" + encodeURIComponent(userId) + "&retURL=" + encodeURIComponent(retUrl) + "&targetURL=" + encodeURIComponent(targetUrl);
  }

  getUserDetailLink(userId) {
    let { sfHost } = this.props;
    return "https://" + sfHost + "/lightning/setup/ManageUsers/page?address=%2F" + userId + "%3Fnoredirect%3D1";
  }

  getProfileLink(profileId) {
    let { sfHost } = this.props;
    return "https://" + sfHost + "/lightning/setup/EnhancedProfiles/page?address=%2F" + profileId;
  }

  render() {
    let { user, linkTarget } = this.props;

    return (
      h("div", { className: "all-data-box-inner" },
        h("div", { className: "all-data-box-data" },
          h("table", { className: (user.IsActive) ? "" : "inactive" },
            h("tbody", {},
              h("tr", {},
                h("th", {}, "Name:"),
                h("td", {},
                  (user.IsActive) ? "" : h("span", { title: "User is inactive" }, "⚠ "),
                  user.Name + " (" + user.Alias + ")"
                )
              ),
              h("tr", {},
                h("th", {}, "Username:"),
                h("td", { className: "oneliner" }, user.Username)
              ),
              h("tr", {},
                h("th", {}, "Id:"),
                h("td", { className: "oneliner" }, user.Id)
              ),
              h("tr", {},
                h("th", {}, "E-mail:"),
                h("td", { className: "oneliner" }, user.Email)
              ),
              h("tr", {},
                h("th", {}, "Profile:"),
                h("td", { className: "oneliner" },
                  (user.Profile)
                    ? h("a", { href: this.getProfileLink(user.ProfileId), target: linkTarget }, user.Profile.Name)
                    : h("em", { className: "inactive" }, "unknown")
                )
              ),
              h("tr", {},
                h("th", {}, "Role:"),
                h("td", { className: "oneliner" }, (user.UserRole) ? user.UserRole.Name : "")
              ),
              h("tr", {},
                h("th", {}, "Language:"),
                h("td", {},
                  h("div", { className: "flag flag-" + sfLocaleKeyToCountryCode(user.LanguageLocaleKey), title: "Language: " + user.LanguageLocaleKey }),
                  " | ",
                  h("div", { className: "flag flag-" + sfLocaleKeyToCountryCode(user.LocaleSidKey), title: "Locale: " + user.LocaleSidKey })
                )
              )
            )
          )),
        h("div", { ref: "userButtons", className: "center" },
          this.doSupportLoginAs(user) ? h("a", { href: this.getLoginAsLink(user.Id), target: linkTarget, className: "button button-secondary" }, "Try login as") : null,
          h("a", { href: this.getUserDetailLink(user.Id), target: linkTarget, className: "button button-secondary" }, "Details")
        ))
    );
  }
}


class ShowDetailsButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      detailsLoading: false,
      detailsShown: false,
    };
    this.onDetailsClick = this.onDetailsClick.bind(this);
  }
  canShowDetails() {
    let { showDetailsSupported, selectedValue, contextRecordId } = this.props;
    return showDetailsSupported && contextRecordId && selectedValue.sobject.keyPrefix == contextRecordId.substring(0, 3) && selectedValue.sobject.availableApis.length > 0;
  }
  onDetailsClick() {
    let { sfHost, selectedValue } = this.props;
    let { detailsShown } = this.state;
    if (detailsShown || !this.canShowDetails()) {
      return;
    }
    let tooling = !selectedValue.sobject.availableApis.includes("regularApi");
    let url = "/services/data/v" + apiVersion + "/" + (tooling ? "tooling/" : "") + "sobjects/" + selectedValue.sobject.name + "/describe/";
    this.setState({ detailsShown: true, detailsLoading: true });
    Promise.all([
      sfConn.rest(url),
      getAllFieldSetupLinks(sfHost, selectedValue.sobject.name)
    ]).then(([res, insextAllFieldSetupLinks]) => {
      this.setState({ detailsShown: true, detailsLoading: false });
      parent.postMessage({ insextShowStdPageDetails: true, insextData: res, insextAllFieldSetupLinks }, "*");
      closePopup();
    }).catch(error => {
      this.setState({ detailsShown: false, detailsLoading: false });
      console.error(error);
      alert(error);
    });
  }
  render() {
    let { detailsLoading, detailsShown } = this.state;
    return (
      h("button",
        {
          id: "showStdPageDetailsBtn",
          className: "button" + (detailsLoading ? " loading" : ""),
          disabled: detailsShown,
          onClick: this.onDetailsClick,
          style: { display: !this.canShowDetails() ? "none" : "" }
        },
        "Show field ", h("u", {}, "m"), "etadata"
      )
    );
  }
}


class AllDataSelection extends React.PureComponent {
  clickShowDetailsBtn() {
    this.refs.showDetailsBtn.onDetailsClick();
  }
  clickAllDataBtn() {
    this.refs.showAllDataBtn.click();
  }
  getAllDataUrl(toolingApi) {
    let { sfHost, selectedValue } = this.props;
    if (selectedValue) {
      let args = new URLSearchParams();
      args.set("host", sfHost);
      args.set("objectType", selectedValue.sobject.name);
      if (toolingApi) {
        args.set("useToolingApi", "1");
      }
      if (selectedValue.recordId) {
        args.set("recordId", selectedValue.recordId);
      }
      return "inspect.html?" + args;
    } else {
      return undefined;
    }
  }
  getDeployStatusUrl() {
    let { sfHost, selectedValue } = this.props;
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("checkDeployStatus", selectedValue.recordId);
    return "explore-api.html?" + args;
  }
  /**
   * Optimistically generate lightning setup uri for the provided object api name.
   */
  getObjectSetupLink(sobjectName) {
    return "https://" + this.props.sfHost + "/lightning/setup/ObjectManager/" + sobjectName + "/FieldsAndRelationships/view";
  }
  render() {
    let { sfHost, showDetailsSupported, contextRecordId, selectedValue, linkTarget, recordIdDetails } = this.props;
    // Show buttons for the available APIs.
    let buttons = Array.from(selectedValue.sobject.availableApis);
    buttons.sort();
    if (buttons.length == 0) {
      // If none of the APIs are available, show a button for the regular API, which will partly fail, but still show some useful metadata from the tooling API.
      buttons.push("noApi");
    }
    return (
      h("div", { className: "all-data-box-inner" },
        h("div", { className: "all-data-box-data" },
          h("table", {},
            h("tbody", {},
              h("tr", {},
                h("th", {}, "Name:"),
                h("td", {},
                  h("a", { href: this.getObjectSetupLink(selectedValue.sobject.name), target: linkTarget }, selectedValue.sobject.name)
                )
              ),
              h("tr", {},
                h("th", {}, "Label:"),
                h("td", {}, selectedValue.sobject.label)
              ),
              h("tr", {},
                h("th", {}, "Id:"),
                h("td", {},
                  h("span", {}, selectedValue.sobject.keyPrefix),
                  h("span", {}, (selectedValue.recordId) ? " / " + selectedValue.recordId : ""),
                )
              ))),


          h(AllDataRecordDetails, { recordIdDetails, className: "top-space" }),
        ),
        h(ShowDetailsButton, { ref: "showDetailsBtn", sfHost, showDetailsSupported, selectedValue, contextRecordId }),
        selectedValue.recordId && selectedValue.recordId.startsWith("0Af")
          ? h("a", { href: this.getDeployStatusUrl(), target: linkTarget, className: "button" }, "Check Deploy Status") : null,
        buttons.map((button, index) => h("a",
          {
            key: button,
            // If buttons for both APIs are shown, the keyboard shortcut should open the first button.
            ref: index == 0 ? "showAllDataBtn" : null,
            href: this.getAllDataUrl(button == "toolingApi"),
            target: linkTarget,
            className: "button"
          },
          index == 0 ? h("span", {}, "Show ", h("u", {}, "a"), "ll data") : "Show all data",
          button == "regularApi" ? ""
            : button == "toolingApi" ? " (Tooling API)"
              : " (Not readable)"
        ))
      )
    );
  }
}

class AllDataRecordDetails extends React.PureComponent {
  render() {
    let { recordIdDetails, className } = this.props;
    if (recordIdDetails) {
      return (
        h("table", { className },
          h("tbody", {},
            h("tr", {},
              h("th", {}, "RecType:"),
              h("td", {}, recordIdDetails.recordTypeName)
            ),
            h("tr", {},
              h("th", {}, "Created:"),
              h("td", {}, recordIdDetails.created + " (" + recordIdDetails.createdBy + ")")
            ),
            h("tr", {},
              h("th", {}, "Edited:"),
              h("td", {}, recordIdDetails.lastModified + " (" + recordIdDetails.lastModifiedBy + ")")
            )
          )));
    } else {
      return null;
    }
  }
}

class AllDataSearch extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      queryString: "",
      matchingResults: [],
      queryDelayTimer: null
    };
    this.onAllDataInput = this.onAllDataInput.bind(this);
    this.onAllDataFocus = this.onAllDataFocus.bind(this);
    this.onAllDataBlur = this.onAllDataBlur.bind(this);
    this.onAllDataKeyDown = this.onAllDataKeyDown.bind(this);
    this.updateAllDataInput = this.updateAllDataInput.bind(this);
    this.onAllDataArrowClick = this.onAllDataArrowClick.bind(this);
  }
  componentDidMount() {
    let { queryString } = this.state;
    this.getMatchesDelayed(queryString);
  }
  onAllDataInput(e) {
    let val = e.target.value;
    this.refs.autoComplete.handleInput();
    this.getMatchesDelayed(val);
    this.setState({ queryString: val });
  }
  onAllDataFocus() {
    this.refs.autoComplete.handleFocus();
  }
  onAllDataBlur() {
    this.refs.autoComplete.handleBlur();
  }
  onAllDataKeyDown(e) {
    this.refs.autoComplete.handleKeyDown(e);
    e.stopPropagation(); // Stop our keyboard shortcut handler
  }
  updateAllDataInput(value) {
    this.props.onDataSelect(value);
    this.setState({ queryString: "" });
    this.getMatchesDelayed("");
  }
  onAllDataArrowClick() {
    this.refs.showAllDataInp.focus();
  }
  getMatchesDelayed(userQuery) {
    let { queryDelayTimer } = this.state;
    let { inputSearchDelay } = this.props;

    if (queryDelayTimer) {
      clearTimeout(queryDelayTimer);
    }
    queryDelayTimer = setTimeout(async () => {
      let { getMatches } = this.props;
      const matchingResults = await getMatches(userQuery);
      await this.setState({ matchingResults });
    }, inputSearchDelay);

    this.setState({ queryDelayTimer });
  }
  render() {
    let { queryString, matchingResults } = this.state;
    let { placeholderText, resultRender } = this.props;
    return (
      h("div", { className: "input-with-dropdown" },
        h("input", {
          className: "all-data-input",
          ref: "showAllDataInp",
          placeholder: placeholderText,
          onInput: this.onAllDataInput,
          onFocus: this.onAllDataFocus,
          onBlur: this.onAllDataBlur,
          onKeyDown: this.onAllDataKeyDown,
          value: queryString
        }),
        h(Autocomplete, {
          ref: "autoComplete",
          updateInput: this.updateAllDataInput,
          matchingResults: resultRender(matchingResults, queryString)
        }),
        h("svg", { viewBox: "0 0 24 24", onClick: this.onAllDataArrowClick },
          h("path", { d: "M3.8 6.5h16.4c.4 0 .8.6.4 1l-8 9.8c-.3.3-.9.3-1.2 0l-8-9.8c-.4-.4-.1-1 .4-1z" })
        )
      )
    );
  }
}

function MarkSubstring({ text, start, length }) {
  if (start == -1) {
    return h("span", {}, text);
  }
  return h("span", {},
    text.substr(0, start),
    h("mark", {}, text.substr(start, length)),
    text.substr(start + length)
  );
}

class Autocomplete extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showResults: false,
      selectedIndex: 0, // Index of the selected autocomplete item.
      scrollToSelectedIndex: 0, // Changed whenever selectedIndex is updated (even if updated to a value it already had). Used to scroll to the selected item.
      scrollTopIndex: 0, // Index of the first autocomplete item that is visible according to the current scroll position.
      itemHeight: 1, // The height of each autocomplete item. All items should have the same height. Measured on first render. 1 means not measured.
      resultsMouseIsDown: false // Hide the autocomplete popup when the input field looses focus, except when clicking one of the autocomplete items.
    };
    this.onResultsMouseDown = this.onResultsMouseDown.bind(this);
    this.onResultsMouseUp = this.onResultsMouseUp.bind(this);
    this.onResultClick = this.onResultClick.bind(this);
    this.onResultMouseEnter = this.onResultMouseEnter.bind(this);
    this.onScroll = this.onScroll.bind(this);
  }
  handleInput() {
    this.setState({ showResults: true, selectedIndex: 0, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1 });
  }
  handleFocus() {
    this.setState({ showResults: true, selectedIndex: 0, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1 });
  }
  handleBlur() {
    this.setState({ showResults: false });
  }
  handleKeyDown(e) {
    let { matchingResults } = this.props;
    let { selectedIndex, showResults, scrollToSelectedIndex } = this.state;
    if (e.key == "Enter") {
      if (!showResults) {
        this.setState({ showResults: true, selectedIndex: 0, scrollToSelectedIndex: scrollToSelectedIndex + 1 });
        return;
      }
      if (selectedIndex < matchingResults.length) {
        e.preventDefault();
        let { value } = matchingResults[selectedIndex];
        this.props.updateInput(value);
        this.setState({ showResults: false, selectedIndex: 0 });
      }
      return;
    }
    if (e.key == "Escape") {
      e.preventDefault();
      this.setState({ showResults: false, selectedIndex: 0 });
      return;
    }
    let selectionMove = 0;
    if (e.key == "ArrowDown") {
      selectionMove = 1;
    }
    if (e.key == "ArrowUp") {
      selectionMove = -1;
    }
    if (selectionMove != 0) {
      e.preventDefault();
      if (!showResults) {
        this.setState({ showResults: true, selectedIndex: 0, scrollToSelectedIndex: scrollToSelectedIndex + 1 });
        return;
      }
      let index = selectedIndex + selectionMove;
      let length = matchingResults.length;
      if (index < 0) {
        index = length - 1;
      }
      if (index > length - 1) {
        index = 0;
      }
      this.setState({ selectedIndex: index, scrollToSelectedIndex: scrollToSelectedIndex + 1 });
    }
  }
  onResultsMouseDown() {
    this.setState({ resultsMouseIsDown: true });
  }
  onResultsMouseUp() {
    this.setState({ resultsMouseIsDown: false });
  }
  onResultClick(value) {
    this.props.updateInput(value);
    this.setState({ showResults: false, selectedIndex: 0 });
  }
  onResultMouseEnter(index) {
    this.setState({ selectedIndex: index, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1 });
  }
  onScroll() {
    let scrollTopIndex = Math.floor(this.refs.scrollBox.scrollTop / this.state.itemHeight);
    if (scrollTopIndex != this.state.scrollTopIndex) {
      this.setState({ scrollTopIndex });
    }
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.itemHeight == 1) {
      let anItem = this.refs.scrollBox.querySelector(".autocomplete-item");
      if (anItem) {
        let itemHeight = anItem.offsetHeight;
        if (itemHeight > 0) {
          this.setState({ itemHeight });
        }
      }
      return;
    }
    let sel = this.refs.selectedItem;
    let marginTop = 5;
    if (this.state.scrollToSelectedIndex != prevState.scrollToSelectedIndex && sel && sel.offsetParent) {
      if (sel.offsetTop + marginTop < sel.offsetParent.scrollTop) {
        sel.offsetParent.scrollTop = sel.offsetTop + marginTop;
      } else if (sel.offsetTop + marginTop + sel.offsetHeight > sel.offsetParent.scrollTop + sel.offsetParent.offsetHeight) {
        sel.offsetParent.scrollTop = sel.offsetTop + marginTop + sel.offsetHeight - sel.offsetParent.offsetHeight;
      }
    }
  }
  render() {
    let { matchingResults } = this.props;
    let {
      showResults,
      selectedIndex,
      scrollTopIndex,
      itemHeight,
      resultsMouseIsDown,
    } = this.state;
    // For better performance only render the visible autocomplete items + at least one invisible item above and below (if they exist)
    const RENDERED_ITEMS_COUNT = 11;
    let firstIndex = 0;
    let lastIndex = matchingResults.length - 1;
    let firstRenderedIndex = Math.max(0, scrollTopIndex - 2);
    let lastRenderedIndex = Math.min(lastIndex, firstRenderedIndex + RENDERED_ITEMS_COUNT);
    let topSpace = (firstRenderedIndex - firstIndex) * itemHeight;
    let bottomSpace = (lastIndex - lastRenderedIndex) * itemHeight;
    let topSelected = (selectedIndex - firstIndex) * itemHeight;
    return (
      h("div", { className: "autocomplete-container", style: { display: (showResults && matchingResults.length > 0) || resultsMouseIsDown ? "" : "none" }, onMouseDown: this.onResultsMouseDown, onMouseUp: this.onResultsMouseUp },
        h("div", { className: "autocomplete", onScroll: this.onScroll, ref: "scrollBox" },
          h("div", { ref: "selectedItem", style: { position: "absolute", top: topSelected + "px", height: itemHeight + "px" } }),
          h("div", { style: { height: topSpace + "px" } }),
          matchingResults.slice(firstRenderedIndex, lastRenderedIndex + 1)
            .map(({ key, value, element }, index) =>
              h("a", {
                key,
                className: "autocomplete-item " + (selectedIndex == index + firstRenderedIndex ? "selected" : ""),
                onClick: () => this.onResultClick(value),
                onMouseEnter: () => this.onResultMouseEnter(index + firstRenderedIndex)
              }, element)
            ),
          h("div", { style: { height: bottomSpace + "px" } })
        )
      )
    );
  }
}

function getRecordId(href) {
  let url = new URL(href);
  // Find record ID from URL
  let searchParams = new URLSearchParams(url.search.substring(1));
  // Salesforce Classic and Console
  if (url.hostname.endsWith(".salesforce.com")) {
    let match = url.pathname.match(/\/([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
    if (match) {
      let res = match[1];
      if (res.includes("0000") || res.length == 3) {
        return match[1];
      }
    }
  }

  // Lightning Experience and Salesforce1
  if (url.hostname.endsWith(".lightning.force.com")) {
    let match;

    if (url.pathname == "/one/one.app") {
      // Pre URL change: https://docs.releasenotes.salesforce.com/en-us/spring18/release-notes/rn_general_enhanced_urls_cruc.htm
      match = url.hash.match(/\/sObject\/([a-zA-Z0-9]+)(?:\/|$)/);
    } else {
      match = url.pathname.match(/\/lightning\/[r|o]\/[a-zA-Z0-9_]+\/([a-zA-Z0-9]+)/);
    }
    if (match) {
      return match[1];
    }
  }
  // Visualforce
  {
    let idParam = searchParams.get("id");
    if (idParam) {
      return idParam;
    }
  }
  // Visualforce page that does not follow standard Visualforce naming
  for (let [, p] of searchParams) {
    if (p.match(/^([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/) && p.includes("0000")) {
      return p;
    }
  }
  return null;
}

function getSfPathFromUrl(href) {
  let url = new URL(href);
  if (url.protocol.endsWith("-extension:")) {
    return "/";
  }
  return url.pathname;
}

function sfLocaleKeyToCountryCode(localeKey) {
  //Converts a Salesforce locale key to a lower case country code (https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) or "".
  if (!localeKey) { return ""; }
  return localeKey.split("_").pop().toLowerCase();
}

window.getRecordId = getRecordId; // for unit tests
