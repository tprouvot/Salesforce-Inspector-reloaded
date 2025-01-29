/* global React ReactDOM */
import {sfConn, apiVersion, sessionError, getLinkTarget} from "./inspector.js";
import {getAllFieldSetupLinks} from "./setup-links.js";
import {setupLinks} from "./links.js";

let h = React.createElement;
if (typeof browser === "undefined") {
  var browser = chrome;
}

{
  parent.postMessage({
    insextInitRequest: true,
    iFrameLocalStorage: getFilteredLocalStorage()
  }, "*");
  addEventListener("message", function initResponseHandler(e) {
    if (e.source == parent) {
      if (e.data.insextInitResponse) {
        init(e.data);
        initLinks(e.data);
      } else if (e.data.updateLocalStorage) {
        localStorage.setItem(e.data.key, e.data.value);
      }
    }
  });
  chrome.runtime.onMessage.addListener((request) => {
    if (request.msg === "shortcut_pressed") {
      if (request.command === "open-popup"){
        parent.postMessage({insextOpenPopup: true}, "*");
      } else {
        parent.postMessage({command: request.command}, "*");
      }
    }
  }
  );
}

function getFilteredLocalStorage(){
  //for Salesforce pages
  let host = parent[0].document.referrer;
  if (host.length == 0){
    //for extension pages
    host = new URLSearchParams(parent.location.search).get("host");
  } else {
    host = host.split("https://")[1];
  }
  let domainStart = host?.split(".")[0];
  const storedData = {...localStorage};
  const keysToSend = ["scrollOnFlowBuilder", "colorizeProdBanner", "colorizeSandboxBanner", "popupArrowOrientation", "popupArrowPosition", "prodBannerText"];
  const filteredStorage = Object.fromEntries(
    Object.entries(storedData).filter(([key]) => (key.startsWith(domainStart) || keysToSend.includes(key)) && !key.endsWith("access_token"))
  );
  sessionStorage.setItem("filteredStorage", JSON.stringify(filteredStorage));
  return filteredStorage;
}
function closePopup() {
  parent.postMessage({insextClosePopup: true}, "*");
}

function showApiName(e) {
  parent.postMessage({insextShowApiName: true, btnLabel: e.target.innerText}, "*");
  if (e.target.innerText.startsWith("Show")){
    e.target.innerText = e.target.innerText.replace("Show", "Hide");
  } else {
    e.target.innerText = e.target.innerText.replace("Hide", "Show");
  }
}

function init({sfHost, inDevConsole, inLightning, inInspector}) {
  let addonVersion = chrome.runtime.getManifest().version_name;

  sfConn.getSession(sfHost).then(() => {
    ReactDOM.render(h(App, {
      sfHost,
      inDevConsole,
      inLightning,
      inInspector,
      addonVersion
    }), document.getElementById("root"));
  });
}

function initLinks({sfHost}){
  //add custom links to setupLink
  if (localStorage.getItem(sfHost + "_orgLinks")){
    let links = JSON.parse(localStorage.getItem(sfHost + "_orgLinks"));
    links.forEach(link => {
      setupLinks.push(link);
    });
  }
}

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    let {sfHost} = this.props;
    let hostArg = new URLSearchParams();
    hostArg.set("host", sfHost);
    this.state = {
      isInSetup: false,
      contextUrl: null,
      apiVersionInput: apiVersion,
      isFieldsPresent: false,
      exportHref: "data-export.html?" + hostArg,
      importHref: "data-import.html?" + hostArg,
      eventMonitorHref: "event-monitor.html?" + hostArg,
      fieldCreatorHref: "field-creator.html?" + hostArg,
      limitsHref: "limits.html?" + hostArg,
      latestNotesViewed: localStorage.getItem("latestReleaseNotesVersionViewed") === this.props.addonVersion || browser.extension.inIncognitoContext,
      hideButtonsOption: JSON.parse(localStorage.getItem("hideButtonsOption"))
    };
    this.onContextUrlMessage = this.onContextUrlMessage.bind(this);
    this.onShortcutKey = this.onShortcutKey.bind(this);
    this.onChangeApi = this.onChangeApi.bind(this);
    this.onContextRecordChange = this.onContextRecordChange.bind(this);
    this.updateReleaseNotesViewed = this.updateReleaseNotesViewed.bind(this);
  }
  onContextRecordChange(e) {
    let {sfHost} = this.props;
    let limitsArg = new URLSearchParams();
    let exportArg = new URLSearchParams();
    let importArg = new URLSearchParams();
    exportArg.set("host", sfHost);
    importArg.set("host", sfHost);
    limitsArg.set("host", sfHost);
    if (e.contextSobject && localStorage.getItem("useSObjectContextOnDataImportLink") !== "false") {
      let query = "SELECT Id FROM " + e.contextSobject;
      if (e.contextRecordId && (e.contextRecordId.length == 15 || e.contextRecordId.length == 18)) {
        query += " WHERE Id = '" + e.contextRecordId + "'";
      }
      exportArg.set("query", query);
      importArg.set("sobject", e.contextSobject);
    }
    this.setState({
      exportHref: "data-export.html?" + exportArg,
      importHref: "data-import.html?" + importArg,
      eventMonitorHref: "event-monitor.html?" + importArg,
      limitsHref: "limits.html?" + limitsArg
    });
  }
  onContextUrlMessage(e) {
    if (e.source == parent && e.data.insextUpdateRecordId) {
      let {locationHref} = e.data;
      this.setState({
        isInSetup: locationHref.includes("/lightning/setup/"),
        contextUrl: locationHref
      });
    }
    this.setState({
      isFieldsPresent: e.data.isFieldsPresent
    });
  }
  updateReleaseNotesViewed(version) {
    localStorage.setItem("latestReleaseNotesVersionViewed", version);
    this.setState({
      latestNotesViewed: true
    });
  }
  onShortcutKey(e) {
    const refs = this.refs;
    const actionMap = {
      "a": ["all", "clickAllDataBtn"],
      "f": ["all", "clickShowFieldAPINameBtn"],
      "n": ["all", "clickNewBtn"],
      "e": ["click", "dataExportBtn"],
      "i": ["click", "dataImportBtn"],
      "l": ["click", "limitsBtn"],
      "t": ["click", "fieldCreatorBtn"],
      "d": ["click", "metaRetrieveBtn"],
      "x": ["click", "apiExploreBtn"],
      "h": ["click", "homeBtn"],
      "p": ["click", "optionsBtn"],
      "m": ["click", "eventMonitorBtn"],
      "o": ["tab", "objectTab"],
      "u": ["tab", "userTab"],
      "s": ["tab", "shortcutTab"],
      "r": ["tab", "orgTab"],
      "Escape": ["", "quit"]
    };
    if (!actionMap[e.key]) {
      return;
    }
    e.preventDefault();
    const [action, target] = actionMap[e.key];
    if (target === "quit") {
      closePopup();
      return;
    }
    if (action === "all") {
      refs.showAllDataBox.refs?.showAllDataBoxSObject?.[target]();
    } else if (action === "click" && refs[target]) {
      refs[target].target = getLinkTarget(e);
      refs[target].click();
    } else if (action === "tab") {
      refs.showAllDataBox.refs[target].click();
    }
  }
  onChangeApi(e) {
    localStorage.setItem("apiVersion", e.target.value + ".0");
    this.setState({apiVersionInput: e.target.value});
  }
  componentDidMount() {
    let {sfHost} = this.props;
    addEventListener("message", this.onContextUrlMessage);
    addEventListener("keydown", this.onShortcutKey);
    parent.postMessage({insextLoaded: true}, "*");
    this.setOrgInfo(sfHost);
  }
  componentWillUnmount() {
    removeEventListener("message", this.onContextUrlMessage);
    removeEventListener("keydown", this.onShortcutKey);
  }
  setOrgInfo(sfHost) {
    let orgInfo = JSON.parse(sessionStorage.getItem(sfHost + "_orgInfo"));
    if (orgInfo == null) {
      sfConn.rest("/services/data/v" + apiVersion + "/query/?q=SELECT+Id,InstanceName,OrganizationType,TimeZoneSidKey+FROM+Organization").then(res => {
        orgInfo = res.records[0];
        sessionStorage.setItem(sfHost + "_orgInfo", JSON.stringify(orgInfo));
      });
    }
  }
  isMac() {
    return navigator.userAgentData?.platform.toLowerCase().indexOf("mac") > -1 || navigator.userAgent.toLowerCase().indexOf("mac") > -1;
  }
  getBannerUrlAction(sessionError = {}, sfHost, clientId, browser) {
    const url = `https://${sfHost}/services/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${browser}-extension://${chrome.i18n.getMessage("@@extension_id")}/data-export.html`;
    return {...sessionError, url};
  }
  displayButton(name){
    const button = this.state.hideButtonsOption?.find((element) => element.name == name);
    if (button){
      return button.checked;
    }
    //if no option was found, display the button
    return true;
  }
  render() {
    let {
      sfHost,
      inDevConsole,
      inLightning,
      inInspector,
      addonVersion
    } = this.props;
    let {isInSetup, contextUrl, apiVersionInput, exportHref, importHref, eventMonitorHref, fieldCreatorHref, limitsHref, isFieldsPresent, latestNotesViewed} = this.state;
    let hostArg = new URLSearchParams();
    hostArg.set("host", sfHost);
    let linkInNewTab = JSON.parse(localStorage.getItem("openLinksInNewTab"));
    let linkTarget = inDevConsole || linkInNewTab ? "_blank" : "_top";
    const browser = navigator.userAgent?.includes("Chrome") ? "chrome" : "moz";
    const DEFAULT_CLIENT_ID = "3MVG9HB6vm3GZZR9qrol39RJW_sZZjYV5CZXSWbkdi6dd74gTIUaEcanh7arx9BHhl35WhHW4AlNUY8HtG2hs"; //Consumer Key of  default connected app
    const clientId = localStorage.getItem(sfHost + "_clientId") ? localStorage.getItem(sfHost + "_clientId") : DEFAULT_CLIENT_ID;
    const bannerUrlAction = this.getBannerUrlAction(sessionError, sfHost, clientId, browser);
    const popupTheme = localStorage.getItem("popupDarkTheme") == "true" ? " header-dark" : " header-light";
    return (
      h("div", {},
        h("div", {className: "slds-page-header slds-theme_shade popup-header" + popupTheme},
          h("div", {className: "slds-page-header__row"},
            h("div", {className: "slds-page-header__col-title"},
              h("div", {className: "slds-media"},
                h("div", {className: "slds-media__figure popup-media__figure"},
                  h("span", {className: "popup-icon_container", title: "Salesforce Inspector Reloaded"},
                    h("svg", {className: "popup-header__icon", viewBox: "0 0 24 24"},
                      h("path", {
                        d: `
                        M11 9c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1z
                        m1 5.8c0 .2-.1.3-.3.3h-1.4c-.2 0-.3-.1-.3-.3v-4.6c0-.2.1-.3.3-.3h1.4c.2.0.3.1.3.3z
                        M11 3.8c-4 0-7.2 3.2-7.2 7.2s3.2 7.2 7.2 7.2s7.2-3.2 7.2-7.2s-3.2-7.2-7.2-7.2z
                        m0 12.5c-2.9 0-5.3-2.4-5.3-5.3s2.4-5.3 5.3-5.3s5.3 2.4 5.3 5.3-2.4 5.3-5.3 5.3z
                        M 17.6 15.9c-.2-.2-.3-.2-.5 0l-1.4 1.4c-.2.2-.2.3 0 .5l4 4c.2.2.3.2.5 0l1.4-1.4c.2-.2.2-.3 0-.5z
                        `
                      })
                    )
                  )
                ),
                h("div", {className: "slds-media__body"},
                  h("div", {className: "popup-header__name-title"},
                    h("h1", {},
                      h("span", {className: "popup-header__title popup-title slds-truncate", title: "Salesforce Inspector Reloaded"}, "Salesforce Inspector Reloaded")
                    )
                  )
                )
              )
            )
          )
        ),

        !latestNotesViewed && h(AlertBanner, {type: "base",
          bannerText: `Current Version: ${addonVersion}`,
          iconName: "notification",
          iconTitle: "Notification",
          assistiveTest: "Version Update Notification",
          onClose: () => this.updateReleaseNotesViewed(addonVersion),
          link: {
            text: "See What's New",
            props: {
              href: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/release-note/#version-" + addonVersion.replace(".", ""),
              target: "_blank",
              onClick: () => this.updateReleaseNotesViewed(addonVersion)
            }
          }
        }),
        h("div", {id: "toastBanner", className: "hide"},
          h(AlertBanner, {type: bannerUrlAction.type,
            bannerText: bannerUrlAction.text,
            iconName: bannerUrlAction.icon,
            assistiveTest: bannerUrlAction.text,
            onClose: null,
            link: {
              text: bannerUrlAction.title,
              props: {
                href: bannerUrlAction.url,
                target: linkTarget
              }
            }
          })
        ),
        h("div", {className: "main", id: "mainTabs"},
          h(AllDataBox, {ref: "showAllDataBox", sfHost, showDetailsSupported: !inLightning && !inInspector, linkTarget, contextUrl, onContextRecordChange: this.onContextRecordChange, isFieldsPresent, eventMonitorHref}),
          h("div", {className: "slds-p-vertical_x-small slds-p-horizontal_x-small slds-border_bottom"},
            h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "dataExportBtn", href: exportHref, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, "Data ", h("u", {}, "E"), "xport"))
            ),
            h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "dataImportBtn", href: importHref, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, "Data ", h("u", {}, "I"), "mport"))
            ),
            this.displayButton("org-limits") ? h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "limitsBtn", href: limitsHref, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, "Org ", h("u", {}, "L"), "imits"))
            ) : null,
            h("div", {},
              h("a", {ref: "fieldCreatorBtn", href: fieldCreatorHref, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, "Field Crea", h("u", {}, "t"), "or (beta)"))
            ),
          ),
          h("div", {className: "slds-p-vertical_x-small slds-p-horizontal_x-small slds-border_bottom"},
            // Advanded features should be put below this line, and the layout adjusted so they are below the fold
            h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "metaRetrieveBtn", href: "metadata-retrieve.html?" + hostArg, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, h("u", {}, "D"), "ownload Metadata"))
            ),
            this.displayButton("explore-api") ? h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "apiExploreBtn", href: "explore-api.html?" + hostArg, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, "E", h("u", {}, "x"), "plore API"))
            ) : null,
            h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "restExploreBtn", href: "rest-explore.html?" + hostArg, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, h("u", {}, "R"), "EST Explore"))
            ),
            h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "eventMonitorBtn", href: eventMonitorHref, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, "Event ", h("u", {}, "M"), "onitor"))
            ),
            this.displayButton("generate-token") ? h("div", {className: "slds-m-bottom_xx-small"},
              h("a",
                {
                  ref: "generateToken",
                  href: bannerUrlAction.url,
                  target: linkTarget,
                  className: !clientId ? "button hide" : "page-button slds-button slds-button_neutral"
                },
                h("span", {}, h("u", {}, "G"), "enerate Access Token"))
            ) : null,

            // Workaround for in Lightning the link to Setup always opens a new tab, and the link back cannot open a new tab.
            inLightning && isInSetup && h("div", {className: "slds-m-bottom_xx-small"},
              h("a",
                {
                  ref: "homeBtn",
                  href: `https://${sfHost}/lightning/page/home`,
                  title: "You can choose if you want to open in a new tab or not",
                  target: linkTarget,
                  className: "page-button slds-button slds-button_neutral"
                },
                h("span", {}, "Salesforce ", h("u", {}, "H"), "ome"))
            ),
            inLightning && !isInSetup && h("div", {className: "slds-m-bottom_xx-small"},
              h("a",
                {
                  ref: "homeBtn",
                  href: `https://${sfHost}/lightning/setup/SetupOneHome/home?setupApp=all`,
                  title: "You can choose if you want to open in a new tab or not",
                  target: linkTarget,
                  className: "page-button slds-button slds-button_neutral"
                },
                h("span", {}, "Setup ", h("u", {}, "H"), "ome")),
            ),
          ),
          this.displayButton("options") ? h("div", {className: "slds-p-vertical_x-small slds-p-horizontal_x-small"},
            h("div", {className: "slds-m-bottom_xx-small"},
              h("a", {ref: "optionsBtn", href: "options.html?" + hostArg, target: linkTarget, className: "page-button slds-button slds-button_neutral"}, h("span", {}, "O", h("u", {}, "p"), "tions"))
            ),
          ) : null
        ),
        h("div", {className: "slds-grid slds-theme_shade slds-p-around_x-small slds-border_top"},
          h("div", {className: "slds-col slds-size_4-of-12 footer-small-text slds-m-top_xx-small"},
            h("a", {href: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/release-note/#version-" + addonVersion.replace(".", ""), title: "Release note", target: linkTarget}, "v" + addonVersion),
            h("span", {}, " / "),
            h("input", {
              className: "api-input",
              type: "number",
              title: "Update api version",
              onChange: this.onChangeApi,
              value: apiVersionInput.split(".0")[0]
            })
          ),
          h("div", {className: "slds-col slds-size_1-of-12 slds-text-align_right slds-icon_container", title: `Shortcut :${this.isMac() ? "[ctrl+option+i]" : "[ctrl+alt+i]"}`},
            h("svg", {className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small", viewBox: "0 0 52 52"},
              h("use", {xlinkHref: "symbols.svg#type", style: {fill: "#9c9c9c"}})
            )
          ),
          h("div", {className: "slds-col slds-size_1-of-12 slds-text-align_right slds-icon_container", title: "Donate"},
            h("a", {href: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/donate/", target: linkTarget},
              h("svg", {className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small", viewBox: "0 0 52 52"},
                h("use", {xlinkHref: "symbols.svg#heart", style: {fill: "#9c9c9c"}})
              )
            )
          ),
          h("div", {className: "slds-col slds-size_1-of-12 slds-text-align_right slds-icon_container", title: "Documentation"},
            h("a", {href: "https://tprouvot.github.io/Salesforce-Inspector-reloaded/", target: linkTarget},
              h("svg", {className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small", viewBox: "0 0 52 52"},
                h("use", {xlinkHref: "symbols.svg#info_alt", style: {fill: "#9c9c9c"}})
              )
            )
          ),
          h("div", {id: "optionsBtn", className: "slds-col slds-size_1-of-12 slds-text-align_right slds-icon_container slds-m-right_small", title: "Options"},
            h("a", {ref: "optionsBtn", href: "options.html?" + hostArg, target: linkTarget},
              h("svg", {className: "slds-button slds-icon_x-small slds-icon-text-default slds-m-top_xxx-small", viewBox: "0 0 52 52"},
                h("use", {xlinkHref: "symbols.svg#settings", style: {fill: "#9c9c9c"}})
              )
            )
          )
        )
      )
    );
  }
}

class AllDataBox extends React.PureComponent {

  constructor(props) {
    super(props);
    this.SearchAspectTypes = Object.freeze({sobject: "sobject", users: "users", shortcuts: "shortcuts", org: "org"}); //Enum. Supported aspects

    this.state = {
      activeSearchAspect: this.SearchAspectTypes.sobject,
      sobjectsList: null,
      sobjectsLoading: true,
      usersBoxLoading: false,
      contextRecordId: null,
      contextUserId: null,
      contextOrgId: null,
      contextPath: null,
      contextSobject: null
    };
    this.onAspectClick = this.onAspectClick.bind(this);
    this.parseContextUrl = this.ensureKnownBrowserContext.bind(this);
  }

  componentDidMount() {
    this.ensureKnownBrowserContext();
    this.loadSobjects();
  }

  componentDidUpdate(prevProps, prevState) {
    let {activeSearchAspect} = this.state;
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
        case this.SearchAspectTypes.shortcuts:
          this.ensureKnownBrowserContext();
          break;
        case this.SearchAspectTypes.org:
          this.ensureKnownBrowserContext();
          break;
      }
    }
  }

  ensureKnownBrowserContext() {
    let {contextUrl, onContextRecordChange} = this.props;
    if (contextUrl) {
      let recordId = getRecordId(contextUrl);
      let path = getSfPathFromUrl(contextUrl);
      let sobject = getSobject(contextUrl);
      let context = {
        contextRecordId: recordId,
        contextPath: path,
        contextSobject: sobject
      };
      this.setState(context);
      onContextRecordChange(context);
    }
  }

  setIsLoading(aspect, value) {
    switch (aspect) {
      case "usersBox": this.setState({usersBoxLoading: value});
        break;
    }
  }

  isLoading() {
    let {usersBoxLoading, sobjectsLoading} = this.state;
    return sobjectsLoading || usersBoxLoading;
  }

  async ensureKnownUserContext() {
    let {contextUserId, contextOrgId} = this.state;

    if (!contextUserId || !contextOrgId) {
      try {
        const userInfo = await sfConn.rest("/services/oauth2/userinfo");
        let contextUserId = userInfo.user_id;
        let contextOrgId = userInfo.organization_id;
        this.setState({contextUserId, contextOrgId});
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

    function addEntity({name, label, keyPrefix, durableId, isCustomSetting, recordTypesSupported, isEverCreatable, newUrl}, api) {
      label = label.match("__MISSING") ? "" : label; //Error is added to the label if no label exists
      let entity = entityMap.get(name);
      // Each API call enhances the data, only the Name fields are present for each call.
      if (entity) {
        if (!entity.keyPrefix) {
          entity.keyPrefix = keyPrefix;
        }
        if (!entity.durableId) {
          entity.durableId = durableId;
        }
        if (!entity.isCustomSetting) {
          entity.isCustomSetting = isCustomSetting;
        }
        if (!entity.newUrl) {
          entity.newUrl = newUrl;
        }
        if (!entity.recordTypesSupported) {
          entity.recordTypesSupported = recordTypesSupported;
        }
        if (!entity.isEverCreatable) {
          entity.isEverCreatable = isEverCreatable;
        }
      } else {
        entity = {
          availableApis: [],
          name,
          label,
          keyPrefix,
          durableId,
          isCustomSetting,
          availableKeyPrefix: null,
          recordTypesSupported,
          isEverCreatable,
          newUrl
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

    function getEntityDefinitions(){
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent("SELECT COUNT() FROM EntityDefinition"))
        .then(res => {
          let entityNb = res.totalSize;
          for (let bucket = 0; bucket < Math.ceil(entityNb / 2000); bucket++) {
            let offset = bucket > 0 ? " OFFSET " + (bucket * 2000) : "";
            let query = "SELECT QualifiedApiName, Label, KeyPrefix, DurableId, IsCustomSetting, RecordTypesSupported, NewUrl, IsEverCreatable FROM EntityDefinition ORDER BY QualifiedApiName ASC LIMIT 2000" + offset;
            sfConn.rest("/services/data/v" + apiVersion + "/tooling/query?q=" + encodeURIComponent(query))
              .then(respEntity => {
                for (let record of respEntity.records) {
                  addEntity({
                    name: record.QualifiedApiName,
                    label: record.Label,
                    keyPrefix: record.KeyPrefix,
                    durableId: record.DurableId,
                    isCustomSetting: record.IsCustomSetting,
                    recordTypesSupported: record.RecordTypesSupported,
                    newUrl: record.NewUrl,
                    isEverCreatable: record.IsEverCreatable
                  }, null);
                }
              }).catch(err => {
                console.error("list entity definitions: ", err);
              });
          }
        }).catch(err => {
          console.error("count entity definitions: ", err);
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
      // Even if documentation mention that LIMIT and OFFSET are not supported, we use it to split the EntityDefinition queries into 2000 buckets
      getEntityDefinitions(),
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
        this.setState({sobjectsLoading: false});
      });
  }

  render() {
    let {activeSearchAspect, sobjectsLoading, contextRecordId, contextSobject, contextUserId, contextOrgId, contextPath, sobjectsList} = this.state;
    let {sfHost, showDetailsSupported, linkTarget, onContextRecordChange, isFieldsPresent, eventMonitorHref} = this.props;

    return (
      h("div", {className: "slds-p-top_small slds-p-horizontal_x-small slds-p-bottom_x-small slds-border_bottom" + (this.isLoading() ? " loading " : "")},
        h("ul", {className: "small-tabs"},
          h("li", {ref: "objectTab", onClick: this.onAspectClick, "data-aspect": this.SearchAspectTypes.sobject, className: (activeSearchAspect == this.SearchAspectTypes.sobject) ? "active" : ""}, h("span", {}, h("u", {}, "O"), "bjects")),
          h("li", {ref: "userTab", onClick: this.onAspectClick, "data-aspect": this.SearchAspectTypes.users, className: (activeSearchAspect == this.SearchAspectTypes.users) ? "active" : ""}, h("span", {}, h("u", {}, "U"), "sers")),
          h("li", {ref: "shortcutTab", onClick: this.onAspectClick, "data-aspect": this.SearchAspectTypes.shortcuts, className: (activeSearchAspect == this.SearchAspectTypes.shortcuts) ? "active" : ""}, h("span", {}, h("u", {}, "S"), "hortcuts")),
          h("li", {ref: "orgTab", onClick: this.onAspectClick, "data-aspect": this.SearchAspectTypes.org, className: (activeSearchAspect == this.SearchAspectTypes.org) ? "active" : ""}, h("span", {}, "O", h("u", {}, "r"), "g"))
        ),
        (activeSearchAspect == this.SearchAspectTypes.sobject)
          ? h(AllDataBoxSObject, {ref: "showAllDataBoxSObject", sfHost, showDetailsSupported, sobjectsList, sobjectsLoading, contextRecordId, contextSobject, linkTarget, onContextRecordChange, isFieldsPresent, eventMonitorHref})
          : (activeSearchAspect == this.SearchAspectTypes.users)
            ? h(AllDataBoxUsers, {ref: "showAllDataBoxUsers", sfHost, linkTarget, contextUserId, contextOrgId, contextPath, setIsLoading: (value) => { this.setIsLoading("usersBox", value); }}, "Users")
            : (activeSearchAspect == this.SearchAspectTypes.shortcuts)
              ? h(AllDataBoxShortcut, {ref: "showAllDataBoxShortcuts", sfHost, linkTarget, contextUserId, contextOrgId, contextPath, setIsLoading: (value) => { this.setIsLoading("shortcutsBox", value); }}, "Users")
              : (activeSearchAspect == this.SearchAspectTypes.org)
                ? h(AllDataBoxOrg, {ref: "showAllDataBoxOrg", sfHost, linkTarget, contextUserId, contextOrgId, contextPath, setIsLoading: (value) => { this.setIsLoading("orgBox", value); }}, "Users")
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
    let {contextUserId} = this.props;
    this.onDataSelect({Id: contextUserId});
    this.refs.allDataSearch.refs.showAllDataInp.focus();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.contextUserId !== this.props.contextUserId) {
      this.onDataSelect({Id: this.props.contextUserId});
    }
  }

  async getMatches(userQuery) {
    let {setIsLoading} = this.props;
    userQuery = userQuery.trim();
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
          "url": "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(fullQuerySelect + " " + queryFrom),
          "referenceId": "fullData"
        }, {
          "method": "GET",
          "url": "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(minimalQuerySelect + " " + queryFrom),
          "referenceId": "minimalData"
        }
      ]
    };

    try {
      setIsLoading(true);
      const userSearchResult = await sfConn.rest("/services/data/v" + apiVersion + "/composite", {method: "POST", body: compositeQuery});
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
      await this.setState({selectedUserId: userRecord.Id, selectedUser: null});
      await this.querySelectedUserDetails();
    }
  }

  async querySelectedUserDetails() {
    let {selectedUserId} = this.state;
    let {setIsLoading} = this.props;

    if (!selectedUserId) {
      return;
    }
    //Optimistically attempt broad query (fullQuery) and fall back to minimalQuery to ensure some data is returned in most cases (e.g. profile cannot be queried by community users)
    const fullQuerySelect = "SELECT Id, Name, Email, Username, UserRole.Name, Alias, LocaleSidKey, LanguageLocaleKey, IsActive, FederationIdentifier, ProfileId, Profile.Name, ContactId, IsPortalEnabled, UserPreferencesUserDebugModePref";
    //TODO implement a try catch to remove non existing fields ProfileId or IsPortalEnabled (experience is not enabled)
    const mediumQuerySelect = "SELECT Id, Name, Email, Username, UserRole.Name, Alias, LocaleSidKey, LanguageLocaleKey, IsActive, FederationIdentifier, ProfileId, Profile.Name, ContactId, UserPreferencesUserDebugModePref";
    const minimalQuerySelect = "SELECT Id, Name, Email, Username, UserRole.Name, Alias, LocaleSidKey, LanguageLocaleKey, IsActive, FederationIdentifier, ContactId, UserPreferencesUserDebugModePref";
    const queryFrom = "FROM User WHERE Id='" + selectedUserId + "' LIMIT 1";
    const compositeQuery = {
      "compositeRequest": [
        {
          "method": "GET",
          "url": "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(fullQuerySelect + " " + queryFrom),
          "referenceId": "fullData"
        }, {
          "method": "GET",
          "url": "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(mediumQuerySelect + " " + queryFrom),
          "referenceId": "mediumData"
        }, {
          "method": "GET",
          "url": "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(minimalQuerySelect + " " + queryFrom),
          "referenceId": "minimalData"
        }
      ]
    };

    try {
      setIsLoading(true);
      //const userResult = await sfConn.rest("/services/data/v" + apiVersion + "/sobjects/User/" + selectedUserId); //Does not return profile details. Query call is therefore prefered
      const userResult = await sfConn.rest("/services/data/v" + apiVersion + "/composite", {method: "POST", body: compositeQuery});
      let userDetail = userResult.compositeResponse.find((elm) => elm.httpStatusCode == 200).body.records[0];
      userDetail.debugModeActionLabel = userDetail.UserPreferencesUserDebugModePref ? "Disable" : "Enable";
      //query NetworkMember only if it is a portal user (display "Login to Experience" button)
      if (userDetail.IsPortalEnabled){
        await sfConn.rest("/services/data/v" + apiVersion + "/query/?q=SELECT+NetworkId+FROM+NetworkMember+WHERE+MemberId='" + userDetail.Id + "'").then(res => {
          if (res.records && res.records.length > 0){
            userDetail.NetworkId = res.records[0].NetworkId;
          }
        });
      }
      await this.setState({selectedUser: userDetail});
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
        h("div", {className: "autocomplete-item-main", key: "main"},
          h(MarkSubstring, {
            text: value.Name + " (" + value.Alias + ")",
            start: value.Name.toLowerCase().indexOf(userQuery.toLowerCase()),
            length: userQuery.length
          })),
        h("div", {className: "autocomplete-item-sub small", key: "sub"},
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
    let {selectedUser} = this.state;
    let {sfHost, linkTarget, contextOrgId, contextUserId, contextPath} = this.props;

    return (
      h("div", {ref: "usersBox", className: "users-box"},
        h(AllDataSearch, {ref: "allDataSearch", getMatches: this.getMatches, onDataSelect: this.onDataSelect, inputSearchDelay: 400, placeholderText: "Username, email, alias or name of user", resultRender: this.resultRender}),
        h("div", {className: "all-data-box-inner" + (!selectedUser ? " empty" : "")},
          selectedUser
            ? h(UserDetails, {user: selectedUser, sfHost, contextOrgId, currentUserId: contextUserId, linkTarget, contextPath})
            : h("div", {className: "center"}, "No user details available")
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
    let {contextRecordId, contextSobject} = this.props;
    this.updateSelection(contextRecordId, contextSobject);
  }

  componentDidUpdate(prevProps) {
    let {contextRecordId, sobjectsLoading, contextSobject} = this.props;
    if (prevProps.contextRecordId !== contextRecordId) {
      this.updateSelection(contextRecordId, contextSobject);
    }
    if (prevProps.sobjectsLoading !== sobjectsLoading && !sobjectsLoading) {
      this.updateSelection(contextRecordId, contextSobject);
    }
  }

  async updateSelection(query, contextSobject) {
    let match;
    if (query === "list"){
      match = this.getBestMatch(contextSobject);
    } else {
      match = this.getBestMatch(query);
    }

    await this.setState({selectedValue: match});
    this.loadRecordIdDetails();
  }

  loadRecordIdDetails() {
    let {selectedValue} = this.state;
    //If a recordId is selected and the object supports regularApi
    if (selectedValue && selectedValue.recordId && selectedValue.sobject && selectedValue.sobject.availableApis && selectedValue.sobject.availableApis.includes("regularApi")) {
      let fields = ["Id", "LastModifiedBy.Alias", "CreatedBy.Alias", "CreatedDate", "LastModifiedDate", "Name"];
      if (selectedValue.sobject.recordTypesSupported){
        fields.push("RecordType.DeveloperName", "RecordType.Id");
      }
      this.restCallForRecordDetails(fields, selectedValue);
    } else {
      this.setState({recordIdDetails: null});
    }
  }

  restCallForRecordDetails(fields, selectedValue){
    let query = "SELECT " + fields.join() + " FROM " + selectedValue.sobject.name + " where id='" + selectedValue.recordId + "'";
    sfConn.rest("/services/data/v" + apiVersion + "/query?q=" + encodeURIComponent(query), {logErrors: false}).then(res => {
      for (let record of res.records) {
        let lastModifiedDate = new Date(record.LastModifiedDate);
        let createdDate = new Date(record.CreatedDate);
        this.setState({
          recordIdDetails: {
            "recordTypeId": (record.RecordType) ? record.RecordType.Id : "",
            "recordName": (record.Name) ? record.Name : "",
            "recordTypeName": (record.RecordType) ? record.RecordType.DeveloperName : "",
            "createdBy": record.CreatedBy.Alias,
            "lastModifiedBy": record.LastModifiedBy.Alias,
            "created": createdDate.toLocaleDateString() + " " + createdDate.toLocaleTimeString(),
            "lastModified": lastModifiedDate.toLocaleDateString() + " " + lastModifiedDate.toLocaleTimeString(),
          }
        });
      }
    }).catch(e => {
      //some fields (Name, RecordTypeId) are not available for particular objects, in this case remove it from the fields list
      if (e.message.includes("No such column ")){
        this.restCallForRecordDetails(fields.filter(field => field !== "Name"), selectedValue);
      } else if (e.message.includes("Didn't understand relationship 'RecordType'")){
        this.restCallForRecordDetails(fields.filter(field => !field.startsWith("RecordType.")), selectedValue);
      }
    });
  }

  getBestMatch(query) {
    let {sobjectsList} = this.props;
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
    return {recordId, sobject};
  }

  getMatches(query) {
    let {sobjectsList, contextRecordId} = this.props;

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
        res.unshift({recordId: query, sobject, relevance: 1});
      }
    }
    res.sort((a, b) => a.relevance - b.relevance || a.sobject.name.localeCompare(b.sobject.name));
    return res;
  }

  onDataSelect(value) {
    let {onContextRecordChange} = this.props;
    this.setState({selectedValue: value}, () => {
      this.loadRecordIdDetails();
      if (value) {
        onContextRecordChange({contextSobject: value.sobject.name, contextRecordId: value.recordId});
      }
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

  clickShowFieldAPINameBtn() {
    if (this.refs.allDataSelection) {
      this.refs.allDataSelection.clickShowFieldAPINameBtn();
    }
  }
  clickNewBtn() {
    if (this.refs.allDataSelection) {
      this.refs.allDataSelection.clickNewBtn();
    }
  }

  resultRender(matches, userQuery) {
    return matches.map(value => ({
      key: value.recordId + "#" + value.sobject.name,
      value,
      element: [
        h("div", {className: "autocomplete-item-main", key: "main"},
          value.recordId || h(MarkSubstring, {
            text: value.sobject.name,
            start: value.sobject.name.toLowerCase().indexOf(userQuery.toLowerCase()),
            length: userQuery.length
          }),
          value.sobject.availableApis.length == 0 ? " (Not readable)" : ""
        ),
        h("div", {className: "autocomplete-item-sub", key: "sub"},
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
    let {sfHost, showDetailsSupported, sobjectsList, linkTarget, contextRecordId, isFieldsPresent, eventMonitorHref} = this.props;
    let {selectedValue, recordIdDetails} = this.state;
    return (
      h("div", {},
        h(AllDataSearch, {ref: "allDataSearch", sfHost, onDataSelect: this.onDataSelect, sobjectsList, getMatches: this.getMatches, inputSearchDelay: 0, placeholderText: "Record id, id prefix or object name", title: "Click to show recent items", resultRender: this.resultRender}),
        selectedValue
          ? h(AllDataSelection, {ref: "allDataSelection", sfHost, showDetailsSupported, selectedValue, linkTarget, recordIdDetails, contextRecordId, isFieldsPresent, eventMonitorHref})
          : h("div", {className: "all-data-box-inner empty"}, "No record to display")
      )
    );
  }
}

class AllDataBoxShortcut extends React.PureComponent {
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
    this.refs.allDataSearch.refs.showAllDataInp.focus();
  }

  async getMatches(shortcutSearch) {
    let {setIsLoading} = this.props;
    if (!shortcutSearch) {
      return [];
    }
    try {
      setIsLoading(true);
      shortcutSearch = shortcutSearch.trim();

      //search for shortcuts
      let result = setupLinks.filter(item => item.label.toLowerCase().includes(shortcutSearch.toLowerCase()));
      result.forEach(element => {
        element.detail = element.section;
        element.name = element.link;
        element.Id = element.name;
      });

      let metadataShortcutSearchOptions = localStorage.getItem("metadataShortcutSearchOptions");
      //handle previous option which was not detailled by metadata type
      let metadataShortcutSearch = localStorage.getItem("metadataShortcutSearch") != "false";
      if (metadataShortcutSearchOptions) {
        metadataShortcutSearchOptions = JSON.parse(metadataShortcutSearchOptions);
        metadataShortcutSearch = metadataShortcutSearchOptions.find(elm => elm.checked == true) != undefined;
      }

      //search for metadata if user did not disabled it
      if (metadataShortcutSearch){
        const queries = {
          flows: "SELECT DurableId, LatestVersionId, ApiName, Label, ProcessType FROM FlowDefinitionView WHERE Label LIKE '%" + shortcutSearch + "%' LIMIT 30",
          profiles: "SELECT Id, Name, UserLicense.Name FROM Profile WHERE Name LIKE '%" + shortcutSearch + "%' LIMIT 30",
          permissionSets: "SELECT Id, Name, Label, Type, LicenseId, License.Name, PermissionSetGroupId FROM PermissionSet WHERE Label LIKE '%" + shortcutSearch + "%' LIMIT 30",
          networks: "SELECT NetworkId, Network.Name, Network.Status, Network.UrlPathPrefix, SiteId FROM WebStoreNetwork WHERE Network.Name LIKE '%" + shortcutSearch + "%' LIMIT 50",
          classes: "SELECT Id, Name, NamespacePrefix, ApiVersion, Status, LengthWithoutComments FROM ApexClass WHERE Name LIKE '%" + shortcutSearch + "%' LIMIT 50"
        };
        // If metadataShortcutSearchOptions is null, assume all options are checked
        const defaultOptions = ["flows", "profiles", "permissionSets", "networks", "classes"].map(name => ({name, checked: true}));
        const effectiveOptions = metadataShortcutSearchOptions || defaultOptions;

        const compositeRequest = effectiveOptions.filter(setting => setting.checked).map(setting => ({
          method: "GET",
          url: "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(queries[setting.name]),
          referenceId: setting.name + "Select"
        }));

        const searchResult = await sfConn.rest("/services/data/v" + apiVersion + "/composite", {method: "POST", body: {compositeRequest}});
        let results = searchResult.compositeResponse.filter((elm) => elm.httpStatusCode == 200 && elm.body.records.length > 0);

        let enablePermSetSummary = localStorage.getItem("enablePermSetSummary") === "true";

        results.forEach(element => {
          element.body.records.forEach(rec => {
            if (rec.attributes.type === "FlowDefinitionView"){
              rec.link = "/builder_platform_interaction/flowBuilder.app?flowDefId=" + rec.DurableId + "&flowId=" + rec.LatestVersionId;
              rec.label = rec.Label;
              rec.name = rec.ApiName;
              rec.detail = rec.attributes.type + " • " + rec.ProcessType;
            } else if (rec.attributes.type === "Profile"){
              rec.link = "/lightning/setup/EnhancedProfiles/page?address=%2F" + rec.Id;
              rec.label = rec.Name;
              rec.name = rec.Id;
              rec.detail = rec.attributes.type + " • " + rec.UserLicense.Name;
            } else if (rec.attributes.type === "PermissionSet"){
              rec.label = rec.Label;
              rec.name = rec.Name;
              rec.detail = rec.attributes.type + " • " + rec.Type;
              rec.detail += rec.License?.Name != null ? " • " + rec.License?.Name : "";

              const isGroup = rec.Type === "Group";
              let psetOrGroupId = isGroup ? rec.PermissionSetGroupId : rec.Id;
              let type = isGroup ? "PermSetGroups" : "PermSets";
              let endLink = enablePermSetSummary ? psetOrGroupId + "/summary" : "page?address=%2F" + psetOrGroupId;
              rec.link = "/lightning/setup/" + type + "/" + endLink;
            } else if (rec.attributes.type === "ApexClass"){
              rec.link = "/lightning/setup/ApexClasses/page?address=%2F" + rec.Id;
              rec.label = rec.Name;
              rec.name = rec.NamespacePrefix ? rec.NamespacePrefix + "__" + rec.Name : rec.Name;
              rec.detail = rec.attributes.type + " • " + rec.ApiVersion + ".0 • " + rec.Status + (rec.NamespacePrefix ? "" : " • Length: " + rec.LengthWithoutComments);
            } else if (rec.attributes.type === "WebStoreNetwork"){
              rec.link = `/sfsites/picasso/core/config/commeditor.jsp?servlet%2Fnetworks%2Fswitch%3FnetworkId%3D${rec.NetworkId}%26startURL%3D%252FcommunitySetup%252FcwApp.app%2523%252Fc%252Fhome&siteId=${rec.SiteId}&`;
              rec.label = rec.Network.Name;
              let url = rec.Network.UrlPathPrefix ? " • /" + rec.Network.UrlPathPrefix : "";
              rec.name = rec.NetworkId + url;
              rec.detail = "Network (" + rec.Network.Status + ") • Builder";
            }
            rec.title = rec.name;
            result.push(rec);
          });
        });
      }
      //if no result found, add the global search link
      result.length > 0 ? result : result.push({link: "/one/one.app#" + this.getEncodedGlobalSearch(shortcutSearch), label: '"' + shortcutSearch + '"', detail: "No results found", name: "Use Global Search"});
      return result;
    } catch (err) {
      console.error("Unable to find shortcut", err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  getEncodedGlobalSearch(term){
    let searchPayload = JSON.parse('{ "componentDef": "forceSearch:searchPageDesktop", "attributes": { "term": null, "scopeMap": { "type": "TOP_RESULTS" }, "context": { "FILTERS": {}, "searchSource": "ASSISTANT_DIALOG", "disableIntentQuery": false, "disableSpellCorrection": false, "permsAndPrefs": { "SearchUi.feedbackComponentEnabled": false, "OrgPreferences.ChatterEnabled": true, "Search.crossObjectsAutoSuggestEnabled": true, "OrgPreferences.EinsteinSearchNaturalLanguageEnabled": true, "SearchUi.searchUIInteractionLoggingEnabled": false, "MySearch.userCanHaveMySearchBestResult": true, "SearchResultsLVM.lvmEnabledForTopResults": false }, "searchDialogSessionId": "00000000-0000-0000-0000-000000000000", "debugInfo": { "appType": "Standard", "appNamespace": "standard", "location": "one:auraContainer" } }, "groupId": "DEFAULT" }, "state": {} }');
    searchPayload.attributes.term = term;
    return btoa(JSON.stringify(searchPayload));
  }

  async onDataSelect(shortcut) {
    let {sfHost} = this.props;
    let link = shortcut.isExternal ? shortcut.link : "https://" + sfHost + shortcut.link;
    window.open(link);
  }

  resultRender(matches, shortcutQuery) {
    return matches.map(value => ({
      key: value.Id,
      value,
      element: [
        h("div", {className: "autocomplete-item-main", title: value.title, key: "main" + value.Id},
          h(MarkSubstring, {
            text: value.label,
            start: value.label.toLowerCase().indexOf(shortcutQuery.toLowerCase()),
            length: shortcutQuery.length
          })),
        h("div", {className: "autocomplete-item-sub small", title: value.title, key: "sub" + value.Id},
          h("div", {}, value.detail),
          h(MarkSubstring, {
            text: value.name,
            start: value.name.toLowerCase().indexOf(shortcutQuery.toLowerCase()),
            length: shortcutQuery.length
          }))
      ]
    }));
  }

  render() {
    let {selectedUser} = this.state;
    let {sfHost, linkTarget, contextOrgId, contextUserId, contextPath} = this.props;

    return (
      h("div", {ref: "shortcutsBox", className: "users-box"},
        h(AllDataSearch, {ref: "allDataSearch", getMatches: this.getMatches, onDataSelect: this.onDataSelect, inputSearchDelay: 200, placeholderText: "Quick find links, shortcuts", resultRender: this.resultRender}),
        h("div", {className: "all-data-box-inner" + (!selectedUser ? " empty" : "")},
          selectedUser
            ? h(UserDetails, {user: selectedUser, sfHost, contextOrgId, currentUserId: contextUserId, linkTarget, contextPath})
            : h("div", {className: "center"}, "No shortcut found")
        ))
    );
  }
}

/** ORG Tab Component */
class AllDataBoxOrg extends React.PureComponent {

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    let {sfHost} = this.props;
    let orgInfo = JSON.parse(sessionStorage.getItem(sfHost + "_orgInfo"));
    this.setInstanceStatus(orgInfo.InstanceName, sfHost);
  }

  contextOrgId(){
    return this.props.contextOrgId;
  }

  getNextMajorRelease(maintenances){
    if (maintenances){
      let event = maintenances.find(event => event.name.endsWith("Major Release"));
      return event.name.replace(" Major Release", "") + " on " + new Date(event.plannedStartTime).toDateString();
    }
    return null;
  }

  getApiVersion(instanceStatus){
    if (instanceStatus){
      let apiVersion = (instanceStatus.releaseNumber.substring(0, 3) / 2) - 64;
      return apiVersion;
    }
    return null;
  }

  setInstanceStatus(instanceName, sfHost){
    let instanceStatusLocal = JSON.parse(sessionStorage.getItem(sfHost + "_instanceStatus"));
    if (instanceStatusLocal == null){
      fetch(`https://api.status.salesforce.com/v1/instances/${instanceName}/status`).then(response => {
        response.json().then(result => {
          //manually filter to get only the future releases (based on today's date) and sort maintenance since list in not ordered by default
          result.Maintenances = result.Maintenances.filter(dt => dt.plannedEndTime >= new Date().toISOString()).sort((a, b) => (a.plannedStartTime > b.plannedStartTime) ? 1 : ((b.plannedStartTime > a.plannedStartTime) ? -1 : 0));
          this.setState({instanceStatus: result});
          sessionStorage.setItem(sfHost + "_instanceStatus", JSON.stringify(result));
        });
      }).catch((e) => {
        console.error(e);
      });
    } else {
      this.setState({instanceStatus: instanceStatusLocal});
    }
  }

  render() {
    let {linkTarget, sfHost} = this.props;
    let orgInfo = JSON.parse(sessionStorage.getItem(sfHost + "_orgInfo"));
    return (
      h("div", {ref: "orgBox", className: "users-box"},
        h("div", {className: "all-data-box-inner"},
          h("div", {className: "all-data-box-data"},
            h("table", {},
              h("tbody", {},
                h("tr", {},
                  h("th", {}, h("a", {href: "https://" + sfHost + "/lightning/setup/CompanyProfileInfo/home", title: "Company Information", target: linkTarget}, "Org Id:")),
                  h("td", {}, orgInfo.Id.substring(0, 15))
                ),
                h("tr", {},
                  h("th", {}, h("a", {href: "https://status.salesforce.com/instances/" + orgInfo.InstanceName, title: "Instance status", target: linkTarget}, "Instance:")),
                  h("td", {}, orgInfo.InstanceName)
                ),
                h("tr", {},
                  h("th", {}, "Type:"),
                  h("td", {}, orgInfo.OrganizationType)
                ),
                h("tr", {},
                  h("th", {}, "Status:"),
                  h("td", {}, this.state.instanceStatus?.status)
                ),
                h("tr", {},
                  h("th", {}, "Release:"),
                  h("td", {}, this.state.instanceStatus?.releaseVersion ? (this.state.instanceStatus.releaseVersion + " / " + this.state.instanceStatus?.releaseNumber) : "")
                ),
                h("tr", {},
                  h("th", {}, "Location:"),
                  h("td", {}, this.state.instanceStatus?.location)
                ),
                h("tr", {},
                  h("th", {}, "API version:"),
                  h("td", {}, this.getApiVersion(this.state.instanceStatus))
                ),
                h("tr", {},
                  h("th", {}, h("a", {href: "https://status.salesforce.com/instances/" + orgInfo.InstanceName + "/maintenances", title: "Maintenance List", target: linkTarget}, "Maintenance:")),
                  h("td", {}, this.getNextMajorRelease(this.state.instanceStatus?.Maintenances))
                ),
              )))))
    );
  }
}

class UserDetails extends React.PureComponent {
  constructor(props) {
    super(props);
    this.sfHost = props.sfHost;
    this.enableDebugLog = this.enableDebugLog.bind(this);
    this.toggleDisplay = this.toggleDisplay.bind(this);
    this.onSelectLanguage = this.onSelectLanguage.bind(this);
    this.state = {};
  }

  openUrlInIncognito(targetUrl) {
    browser.runtime.sendMessage({
      message: "createWindow",
      url: targetUrl,
      incognito: true,
    });
  }

  async enableDebugLog() {

    let {user} = this.props;
    const DTnow = new Date(Date.now());

    //Enable debug level and expiration time (minutes) as default parameters.
    let debugLogDebugLevel = localStorage.getItem(this.sfHost + "_debugLogDebugLevel");
    if (debugLogDebugLevel == null) {
      localStorage.setItem(this.sfHost + "_debugLogDebugLevel", "SFDC_DevConsole");
    }

    let debugLogTimeMinutes = localStorage.getItem("debugLogTimeMinutes");
    if (debugLogTimeMinutes == null) {
      localStorage.setItem("debugLogTimeMinutes", 15);
    }
    let debugTimeInMs = this.getDebugTimeInMs(debugLogTimeMinutes);

    let traceFlags = await this.getTraceFlags(user.Id, DTnow, debugLogDebugLevel, debugTimeInMs);
    /*If an old trace flag is found on the user and with this debug level
     *Update the trace flag extending the experiation date.
     */
    if (traceFlags.size > 0){
      this.extendTraceFlag(traceFlags.records[0].Id, DTnow, debugTimeInMs);
    //Else create new trace flag
    } else {
      let debugLog = await this.getDebugLog(debugLogDebugLevel);

      if (debugLog && debugLog.size > 0){
        this.insertTraceFlag(user.Id, debugLog.records[0].Id, DTnow, debugTimeInMs);
      } else {
        throw new Error('Debug Level with developerName = "' + debugLogDebugLevel + '" not found');
      }
    }
    //Disable button after executing.
    const element = document.querySelector("#enableDebugLog");
    element.setAttribute("disabled", true);
    element.text = "Logs Enabled";
  }

  toggleDisplay(event, refKey) {
    event.target.style.display = "none";
    this.fectchLocalesAndLanguages(refKey);
  }

  fectchLocalesAndLanguages(refKey){
    if (!this.state.userLocales){
      sfConn.rest(`/services/data/v${apiVersion}/sobjects/User/describe`, {method: "GET"}).then(res => {
        let userLanguages = res.fields.find(field => field.name === "LanguageLocaleKey");
        let userLocales = res.fields.find(field => field.name === "LocaleSidKey");
        this.setState({userLocales: userLocales.picklistValues, userLanguages: userLanguages.picklistValues.filter(item => item.active)});
        this.refs[refKey].classList.toggle("hide");
      });
    } else {
      this.refs[refKey].classList.toggle("hide");
    }
  }

  onSelectLanguage(e, userId){
    sfConn.rest(`/services/data/v${apiVersion}/sobjects/User/${userId}`, {method: "PATCH",
      body: {
        [e.target.name]: e.target.value
      }}).then(
      browser.runtime.sendMessage({message: "reloadPage"})
    ).catch(err => console.log("Error during user language update", err));
  }

  getTraceFlags(userId, DTnow, debugLogDebugLevel, debugTimeInMs){
    try {
      const expirationDate = new Date(DTnow.getTime() + debugTimeInMs);
      let query = "query/?q=+SELECT+Id,ExpirationDate+FROM+TraceFlag+"
                  + "WHERE+TracedEntityid='" + userId + "'+"
                  + "AND+DebugLevel.DeveloperName='" + debugLogDebugLevel + "'+"
                  + "AND+StartDate<" + DTnow.toISOString() + "+"
                  + "AND+ExpirationDate<" + expirationDate.toISOString();
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/" + query, {method: "GET"});
    } catch (e){
      console.error(e);
      return null;
    }
  }

  getDebugLog(debugLogDebugLevel){
    try {
      let query = "query/?q=+SELECT+Id+FROM+DebugLevel+"
                    + "WHERE+DeveloperName='" + debugLogDebugLevel + "'";
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/" + query, {method: "GET"});
    } catch (e){
      console.error(e);
      return null;
    }
  }

  insertTraceFlag(userId, debugLogId, DTnow, debugTimeInMs){
    try {
      let newTraceFlag
          = {
            TracedEntityId: userId,
            DebugLevelId: debugLogId,
            LogType: "USER_DEBUG",
            StartDate: DTnow,
            ExpirationDate: (DTnow.getTime() + debugTimeInMs),

          };
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/sobjects/traceflag", {method: "POST", body: newTraceFlag});
    } catch (e){
      console.error(e);
      return null;
    }
  }

  extendTraceFlag(traceFlagId, DTnow, debugTimeInMs){
    try {
      let traceFlagToUpdate = {StartDate: DTnow, ExpirationDate: (DTnow.getTime() + debugTimeInMs)};
      return sfConn.rest("/services/data/v" + apiVersion + "/tooling/sobjects/traceflag/" + traceFlagId, {method: "PATCH", body: traceFlagToUpdate});
    } catch (e){
      console.error(e);
      return null;
    }
  }

  getDebugTimeInMs(debugLogTimeMinutes){
    return debugLogTimeMinutes * 60 * 1000;
  }

  doSupportLoginAs(user) {
    let {currentUserId} = this.props;
    //Optimistically show login unless it's logged in user's userid or user is inactive.
    //No API to determine if user is allowed to login as given user. See https://salesforce.stackexchange.com/questions/224342/query-can-i-login-as-for-users
    if (!user || user.Id == currentUserId || !user.IsActive) {
      return false;
    }
    return true;
  }

  canLoginAsPortal(user){
    return user.IsActive && user.NetworkId;
  }

  getLoginAsLink(userId) {
    let {sfHost, contextOrgId, contextPath} = this.props;
    const retUrl = contextPath || "/";
    const targetUrl = contextPath || "/";
    return "https://" + sfHost + "/servlet/servlet.su" + "?oid=" + encodeURIComponent(contextOrgId) + "&suorgadminid=" + encodeURIComponent(userId) + "&retURL=" + encodeURIComponent(retUrl) + "&targetURL=" + encodeURIComponent(targetUrl);
  }

  loginAsInIncognito(userId) {
    const targetUrl = "https://" + this.sfHost + "/secur/frontdoor.jsp?sid=" + sfConn.sessionId + "&retURL=" + encodeURIComponent(this.getLoginAsLink(userId));
    this.openUrlInIncognito(targetUrl);
  }

  getLoginAsPortalLink(user){
    let {sfHost, contextOrgId, contextPath} = this.props;
    const retUrl = contextPath || "/";
    return "https://" + sfHost + "/servlet/servlet.su" + "?oid=" + encodeURIComponent(contextOrgId) + "&retURL=" + encodeURIComponent(retUrl) + "&sunetworkid=" + encodeURIComponent(user.NetworkId) + "&sunetworkuserid=" + encodeURIComponent(user.Id);
  }

  getUserDetailLink(userId) {
    let {sfHost} = this.props;
    return "https://" + sfHost + "/lightning/setup/ManageUsers/page?address=%2F" + userId + "%3Fnoredirect%3D1%26isUserEntityOverride%3D1";
  }

  getUserPsetLink(userId) {
    let {sfHost} = this.props;
    return "https://" + sfHost + "/lightning/setup/PermSets/page?address=%2Fudd%2FPermissionSet%2FassignPermissionSet.apexp%3FuserId%3D" + userId;
  }

  getUserPsetGroupLink(userId) {
    let {sfHost} = this.props;
    return "https://" + sfHost + "/lightning/setup/PermSetGroups/page?address=%2Fudd%2FPermissionSetGroup%2FassignPermissionSet.apexp%3FuserId%3D" + userId + "%26isPermsetGroup%3D1";
  }

  getProfileLink(profileId) {
    let {sfHost} = this.props;
    return "https://" + sfHost + "/lightning/setup/EnhancedProfiles/page?address=%2F" + profileId;
  }

  getShowAllDataLink(userId) {
    let {sfHost} = this.props;
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("objectType", "User");
    args.set("recordId", userId);
    return "inspect.html?" + args;
  }

  getUserSummaryLink(userId){
    let {sfHost} = this.props;
    return "https://" + sfHost + "/lightning/setup/ManageUsers/" + userId + "/summary";
  }

  enableDebugMode(user){
    sfConn.rest("/services/data/v" + apiVersion + "/sobjects/User/" + user.Id, {method: "PATCH",
      body: {UserPreferencesUserDebugModePref: !user.UserPreferencesUserDebugModePref
      }}).then(() => browser.runtime.sendMessage({message: "reloadPage"})
    ).catch(err => console.log("Error during user debug mode activation", err));
  }

  toggleMenu(){
    this.refs.buttonMenu.classList.toggle("slds-is-open");
  }

  toggleLogMenu(){
    this.refs.logButtonMenu.classList.toggle("slds-is-open");
  }

  render() {
    let {user, linkTarget} = this.props;
    return (
      h("div", {className: "all-data-box-inner"},
        h("div", {className: "all-data-box-data slds-m-bottom_xx-small"},
          h("table", {className: (user.IsActive) ? "" : "inactive"},
            h("tbody", {},
              h("tr", {},
                h("th", {}, "Name:"),
                h("td", {className: "oneliner"},
                  (user.IsActive) ? "" : h("span", {title: "User is inactive"}, "⚠ "),
                  //user.Name + " (" + user.Alias + ")"
                  h("a", {href: this.getUserSummaryLink(user.Id), target: linkTarget, title: "View summary"}, user.Name)
                  ,
                  " (" + user.Alias + ")"
                )
              ),
              h("tr", {},
                h("th", {}, "Username:"),
                h("td", {className: "oneliner"}, user.Username)
              ),
              h("tr", {},
                h("th", {}, "Id:"),
                h("td", {className: "oneliner"},
                  h("a", {href: this.getShowAllDataLink(user.Id), target: linkTarget, title: "Show all data"}, user.Id))
              ),
              h("tr", {},
                h("th", {}, "E-mail:"),
                h("td", {className: "oneliner"}, user.Email)
              ),
              h("tr", {},
                h("th", {}, "Profile:"),
                h("td", {className: "oneliner"},
                  (user.Profile)
                    ? h("a", {href: this.getProfileLink(user.ProfileId), target: linkTarget}, user.Profile.Name)
                    : h("em", {className: "inactive"}, "unknown")
                )
              ),
              user.UserRole ? h("tr", {},
                h("th", {}, "Role:"),
                h("td", {className: "oneliner"}, user.UserRole.Name)
              ) : null,
              h("tr", {},
                h("th", {}, "Language:"),
                h("td", {},
                  h("div", {className: "pointer flag flag-" + sfLocaleKeyToCountryCode(user.LanguageLocaleKey), title: "Update Language " + user.LanguageLocaleKey, onClick: (e) => { this.toggleDisplay(e, "LanguageLocaleKey"); }}),
                  h("select", {ref: "LanguageLocaleKey", name: "LanguageLocaleKey", className: "hide", defaultValue: user.LanguageLocaleKey, onChange: (e) => { this.onSelectLanguage(e, user.Id); }},
                    this.state.userLanguages?.map(q => h("option", {key: q.value, value: q.value}, q.label))
                  ),
                  " | ",
                  h("div", {className: "pointer flag flag-" + sfLocaleKeyToCountryCode(user.LocaleSidKey), title: "Update Locale: " + user.LocaleSidKey, onClick: (e) => { this.toggleDisplay(e, "LocaleSidKey"); }}),
                  h("select", {ref: "LocaleSidKey", name: "LocaleSidKey", className: "hide", defaultValue: user.LanguageLocaleKey, onChange: (e) => { this.onSelectLanguage(e, user.Id); }},
                    this.state.userLanguages?.map(q => h("option", {key: q.value, value: q.value}, q.label))
                  ),
                )
              )
            )
          )),
        h("div", {ref: "userButtons", className: "user-buttons center small-font"},
          h("a", {href: this.getUserDetailLink(user.Id), target: linkTarget, className: "slds-button slds-button_neutral"}, "Details"),
          h("a", {href: this.getUserPsetLink(user.Id), target: linkTarget, className: "slds-button slds-button_neutral", title: "Show / assign user's permission sets"}, "PSet"),
          h("a", {href: this.getUserPsetGroupLink(user.Id), target: linkTarget, className: "slds-button slds-button_neutral", title: "Show / assign user's permission set groups"}, "PSetG"),
          //TODO check for using icons instead of text https://www.lightningdesignsystem.com/components/button-groups/#Button-Icon-Group
          h("div", {className: "user-buttons justify-center slds-button-group top-space", role: "group"},
            h("a", {href: "#", id: "enableDebugLog", disabled: false, onClick: this.enableDebugLog, className: "slds-button slds-button_neutral", title: "Enable user debug log"}, "Enable Logs"),
            h("div", {ref: "logButtonMenu", className: "slds-dropdown-trigger slds-dropdown-trigger_click slds-button_last"},
              h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled", onMouseEnter: () => this.toggleLogMenu(), title: "Show options"},
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#down"})
                ),
                h("span", {className: "slds-assistive-text"}, "Show options")
              ),
              h("div", {className: "slds-dropdown slds-dropdown_right", onMouseLeave: () => this.toggleLogMenu()},
                h("ul", {className: "slds-dropdown__list", role: "menu"},
                  h("li", {className: "slds-dropdown__item", role: "presentation"},
                    h("a", {id: "enableDebugMode", onClick: () => this.enableDebugMode(user), tabIndex: "1"},
                      h("span", {className: "slds-truncate", title: user.debugModeActionLabel + " Debug Mode for Lightning Components"}, user.debugModeActionLabel + " Debug Mode")
                    )
                  )
                )
              )
            ),
          )
        ),
        this.doSupportLoginAs(user) ? h("div", {className: "user-buttons justify-center small-font slds-button-group top-space", role: "group"},
          h("a", {href: this.getLoginAsLink(user.Id), target: linkTarget, className: "slds-button slds-button_neutral"}, "LoginAs"),
          h("div", {ref: "buttonMenu", className: "slds-dropdown-trigger slds-dropdown-trigger_click slds-button_last"},
            h("button", {className: "slds-button slds-button_icon slds-button_icon-border-filled", onMouseEnter: () => this.toggleMenu(), title: "Show other LoginAs options"},
              h("svg", {className: "slds-button__icon"},
                h("use", {xlinkHref: "symbols.svg#down"})
              ),
              h("span", {className: "slds-assistive-text"}, "Show other LoginAs options")
            ),
            h("div", {className: "slds-dropdown slds-dropdown_left", onMouseLeave: () => this.toggleMenu()},
              h("ul", {className: "slds-dropdown__list", role: "menu"},
                h("li", {className: "slds-dropdown__item", role: "presentation"},
                  h("a", {onClick: () => this.loginAsInIncognito(user.Id), target: linkTarget, tabIndex: "0"},
                    h("span", {className: "slds-truncate", title: "Incognito"},
                      h("span", {className: "slds-truncate", title: "Incognito"}, "Incognito")
                    )
                  ),
                  this.canLoginAsPortal(user) ? h("a", {href: this.getLoginAsPortalLink(user), target: linkTarget, tabIndex: "1"},
                    h("span", {className: "slds-truncate", title: "Portal"}, "Portal")
                  ) : null
                )
              )
            )
          ),
        ) : null
      )
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
    let {showDetailsSupported, selectedValue, contextRecordId} = this.props;
    return showDetailsSupported && contextRecordId && selectedValue.sobject.keyPrefix == contextRecordId.substring(0, 3) && selectedValue.sobject.availableApis.length > 0;
  }
  onDetailsClick() {
    let {sfHost, selectedValue} = this.props;
    let {detailsShown} = this.state;
    if (detailsShown || !this.canShowDetails()) {
      return;
    }
    let tooling = !selectedValue.sobject.availableApis.includes("regularApi");
    let url = "/services/data/v" + apiVersion + "/" + (tooling ? "tooling/" : "") + "sobjects/" + selectedValue.sobject.name + "/describe/";
    this.setState({detailsShown: true, detailsLoading: true});
    Promise.all([
      sfConn.rest(url),
      getAllFieldSetupLinks(sfHost, selectedValue.sobject.name)
    ]).then(([res, insextAllFieldSetupLinks]) => {
      this.setState({detailsShown: true, detailsLoading: false});
      parent.postMessage({insextShowStdPageDetails: true, insextData: res, insextAllFieldSetupLinks}, "*");
      closePopup();
    }).catch(error => {
      this.setState({detailsShown: false, detailsLoading: false});
      console.error(error);
      alert(error);
    });
  }
  render() {
    let {detailsLoading, detailsShown} = this.state;
    return (
      h("div", {},
        h("a",
          {
            id: "showStdPageDetailsBtn",
            className: "button" + (detailsLoading ? " loading" : "" + " page-button slds-button slds-button_neutral slds-m-bottom_xx-small"),
            disabled: detailsShown,
            onClick: this.onDetailsClick,
            style: {display: !this.canShowDetails() ? "none" : ""}
          },
          h("span", {}, "Show field ", h("u", {}, "m"), "etadata")
        )
      )
    );
  }
}


class AllDataSelection extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      flowDefinitionId: null
    };
  }

  clickShowDetailsBtn() {
    this.refs.showDetailsBtn.onDetailsClick();
  }
  clickAllDataBtn() {
    this.refs.showAllDataBtn.click();
  }
  clickShowFieldAPINameBtn(){
    if (this.refs.showFieldApiNameBtn){
      this.refs.showFieldApiNameBtn.click();
    }
  }
  clickNewBtn(){
    if (this.refs.showNewBtn){
      this.refs.showNewBtn.click();
    }
  }
  getAllDataUrl(toolingApi) {
    let {sfHost, selectedValue} = this.props;
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
    let {sfHost, selectedValue} = this.props;
    let args = new URLSearchParams();
    args.set("host", sfHost);
    args.set("checkDeployStatus", selectedValue.recordId);
    return "explore-api.html?" + args;
  }
  redirectToFlowVersions(){
    return "https://" + this.props.sfHost + "/lightning/setup/Flows/page?address=%2F" + this.state.flowDefinitionId;
  }
  /**
   * Optimistically generate lightning setup uri for the provided object api name.
   */
  getObjectSetupLink(sobjectName, durableId, isCustomSetting) {
    if (sobjectName.endsWith("__mdt")) {
      return this.getMetadataLink(durableId, "CustomMetadata");
    } else if (sobjectName.endsWith("__e")) {
      return this.getMetadataLink(durableId, "EventObjects");
    } else if (isCustomSetting) {
      return this.getMetadataLink(durableId, "CustomSettings");
    } else if (sobjectName.endsWith("__c")) {
      return "https://" + this.props.sfHost + "/lightning/setup/ObjectManager/" + durableId + "/Details/view";
    } else {
      return "https://" + this.props.sfHost + "/lightning/setup/ObjectManager/" + sobjectName + "/Details/view";
    }
  }
  getMetadataLink(durableId, type){
    return `https://${this.props.sfHost}/lightning/setup/${type}/page?address=%2F${durableId}%3Fsetupid%3D${type}`;
  }
  getObjectFieldsSetupLink(sobjectName, durableId, isCustomSetting) {
    if (sobjectName.endsWith("__mdt")) {
      return this.getMetadataLink(durableId, "CustomMetadata");
    } else if (isCustomSetting) {
      return this.getMetadataLink(durableId, "CustomSettings");
    } else if (sobjectName.endsWith("__c") || sobjectName.endsWith("__kav")) {
      return "https://" + this.props.sfHost + "/lightning/setup/ObjectManager/" + durableId + "/FieldsAndRelationships/view";
    } else {
      return "https://" + this.props.sfHost + "/lightning/setup/ObjectManager/" + sobjectName + "/FieldsAndRelationships/view";
    }
  }
  getObjectListLink(sobjectName, keyPrefix, isCustomSetting) {
    if (sobjectName.endsWith("__mdt")) {
      return "https://" + this.props.sfHost + "/lightning/setup/CustomMetadata/page?address=%2F" + keyPrefix;
    } else if (isCustomSetting) {
      return "https://" + this.props.sfHost + "/lightning/setup/CustomSettings/page?address=%2Fsetup%2Fui%2FlistCustomSettingsData.apexp?id=" + keyPrefix;

    } else {
      return "https://" + this.props.sfHost + "/lightning/o/" + sobjectName + "/list";
    }
  }
  getObjectListAccess(sobjectName) {
    return "https://" + this.props.sfHost + "/lightning/setup/ObjectManager/" + sobjectName + "/ObjectAccess/view";
  }
  getRecordTypesLink(sfHost, sobjectName, durableId) {
    if (sobjectName.endsWith("__c") || sobjectName.endsWith("__kav")) {
      return "https://" + sfHost + "/lightning/setup/ObjectManager/" + durableId + "/RecordTypes/view";
    } else {
      return "https://" + sfHost + "/lightning/setup/ObjectManager/" + sobjectName + "/RecordTypes/view";
    }
  }
  getObjectDocLink(sobject, api){
    if (api === "toolingApi"){
      return "https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_" + sobject.name.toLowerCase() + ".htm";
    }
    return "https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_" + sobject.name.toLowerCase() + ".htm";
  }
  getNewObjectUrl(sfHost, newUrl){
    return "https://" + sfHost + newUrl;
  }
  getSubscribeUrl(name){
    return this.props.eventMonitorHref + "&channel=" + name;
  }
  setFlowDefinitionId(recordId){
    if (recordId && !this.state.flowDefinitionId){
      if (recordId.startsWith("301")){
        sfConn.rest("/services/data/v" + apiVersion + "/tooling/query/?q=SELECT+DefinitionId+FROM+Flow+WHERE+Id='" + recordId + "'", {method: "GET"}).then(res => {
          res.records.forEach(recentItem => {
            this.setState({flowDefinitionId: recentItem.DefinitionId});
          });
        });
      } else if (recordId.startsWith("300")){
        this.setState({flowDefinitionId: recordId});
      }
    }
  }
  render() {
    let {sfHost, showDetailsSupported, contextRecordId, selectedValue, linkTarget, recordIdDetails, isFieldsPresent, eventMonitorHref} = this.props;
    let {flowDefinitionId} = this.state;
    // Show buttons for the available APIs.
    let buttons = selectedValue.sobject.availableApis ? Array.from(selectedValue.sobject.availableApis) : [];
    buttons.sort();
    this.setFlowDefinitionId(selectedValue ? selectedValue.recordId : contextRecordId);
    if (buttons.length == 0 && !selectedValue.isRecent) {
      // If none of the APIs are available, show a button for the regular API, which will partly fail, but still show some useful metadata from the tooling API.
      buttons.push("noApi");
    }
    return (
      h("div", {className: "all-data-box-inner"},
        h("div", {className: "all-data-box-data slds-m-bottom_xx-small"},
          h("table", {},
            h("tbody", {},
              h("tr", {},
                h("th", {}, "Name:"),
                h("td", {},
                  h("a", {href: this.getObjectSetupLink(selectedValue.sobject.name, selectedValue.sobject.durableId, selectedValue.sobject.isCustomSetting), target: linkTarget}, selectedValue.sobject.name)
                )
              ),
              h("tr", {},
                h("th", {}, "Links:"),
                h("td", {},
                  h("a", {href: this.getObjectFieldsSetupLink(selectedValue.sobject.name, selectedValue.sobject.durableId, selectedValue.sobject.isCustomSetting), target: linkTarget}, "Fields"),
                  selectedValue.sobject.recordTypesSupported?.recordTypeInfos?.length > 0 ? h("span", {},
                    h("span", {}, " / "),
                    h("a", {href: this.getRecordTypesLink(sfHost, selectedValue.sobject.name, selectedValue.sobject.durableId), target: linkTarget}, "Record Types"),
                  ) : null,
                  selectedValue.sobject.name.endsWith("__e") ? null : h("span", {}, h("span", {}, " / "),
                    h("a", {href: this.getObjectListLink(selectedValue.sobject.name, selectedValue.sobject.keyPrefix, selectedValue.sobject.isCustomSetting), target: linkTarget}, "List")
                  ),
                  selectedValue.sobject.name.endsWith("__e") || selectedValue.sobject.name.endsWith("__mdt") ? null : h("span", {}, h("span", {}, " / "),
                    h("a", {href: this.getObjectListAccess(selectedValue.sobject.name, selectedValue.sobject.keyPrefix, selectedValue.sobject.isCustomSetting), target: linkTarget}, "Access")
                  )
                ),
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
              ),
              selectedValue.sobject.name.indexOf("__") == -1 && selectedValue.sobject.availableApis
                ? h("tr", {},
                  h("th", {}, "Doc:"),
                  h("td", {},
                    h("a", {href: this.getObjectDocLink(selectedValue.sobject, selectedValue.sobject.availableApis[1]), target: linkTarget}, "Standard"),
                    selectedValue.sobject.availableApis.length > 1
                      ? h("a", {href: this.getObjectDocLink(selectedValue.sobject, selectedValue.sobject.availableApis[0]), target: linkTarget, className: "left-space"}, "Tooling")
                      : null
                  ),
                ) : null
            )),

          h(AllDataRecordDetails, {sfHost, selectedValue, recordIdDetails, className: "top-space", linkTarget}),
        ),
        h(ShowDetailsButton, {ref: "showDetailsBtn", sfHost, showDetailsSupported, selectedValue, contextRecordId}),
        selectedValue.recordId && selectedValue.recordId.startsWith("0Af")
          ? h("a", {href: this.getDeployStatusUrl(), target: linkTarget, className: "button page-button slds-button slds-button_neutral slds-m-top_xx-small slds-m-bottom_xx-small"}, "Check Deploy Status") : null,
        flowDefinitionId
          ? h("a", {href: this.redirectToFlowVersions(), target: linkTarget, className: "button page-button slds-button slds-button_neutral slds-m-top_xx-small slds-m-bottom_xx-small"}, "Flow Versions") : null,
        buttons.map((button, index) => h("div", {key: button + "Div"}, h("a",
          {
            key: button,
            // If buttons for both APIs are shown, the keyboard shortcut should open the first button.
            ref: index == 0 ? "showAllDataBtn" : null,
            href: this.getAllDataUrl(button == "toolingApi"),
            target: linkTarget,
            className: "slds-m-top_xx-small page-button slds-button slds-button_neutral slds-m-top_xx-small"
          },
          index == 0 ? h("span", {}, "Show ", h("u", {}, "a"), "ll data") : "Show all data",
          button == "regularApi" ? ""
          : button == "toolingApi" ? " (Tooling API)"
          : " (Not readable)"
        ))),
        isFieldsPresent ? h("a", {ref: "showFieldApiNameBtn", onClick: showApiName, target: linkTarget, className: "slds-m-top_xx-small page-button slds-button slds-button_neutral"}, h("span", {}, "Show ", h("u", {}, "f"), "ields API names")) : null,
        selectedValue.sobject.isEverCreatable && !selectedValue.sobject.name.endsWith("__e") ? h("a", {ref: "showNewBtn", href: this.getNewObjectUrl(sfHost, selectedValue.sobject.newUrl), target: linkTarget, className: "slds-m-top_xx-small page-button slds-button slds-button_neutral"}, h("span", {}, h("u", {}, "N"), "ew " + selectedValue.sobject.label)) : null,
        selectedValue.sobject.name.endsWith("__e") ? h("a", {href: this.getSubscribeUrl(selectedValue.sobject.name), target: linkTarget, className: "slds-m-top_xx-small page-button slds-button slds-button_neutral"}, h("span", {}, h("u", {}), "Subscribe to Event")) : null,
      )
    );
  }
}

class AllDataRecordDetails extends React.PureComponent {

  getRecordLink(sfHost, recordId) {
    return "https://" + sfHost + "/" + recordId;
  }
  getRecordTypeLink(sfHost, sobjectName, recordtypeId) {
    return "https://" + sfHost + "/lightning/setup/ObjectManager/" + sobjectName + "/RecordTypes/" + recordtypeId + "/view";
  }

  render() {
    let {sfHost, recordIdDetails, className, selectedValue, linkTarget} = this.props;
    if (recordIdDetails) {
      return (
        h("table", {className},
          h("tbody", {},
            recordIdDetails.recordName ? h("tr", {},
              h("th", {}, "Name:"),
              h("td", {},
                h("a", {href: this.getRecordLink(sfHost, selectedValue.recordId), target: linkTarget}, recordIdDetails.recordName)
              )
            ) : null,
            recordIdDetails.recordTypeName ? h("tr", {},
              h("th", {}, "RecType:"),
              h("td", {},
                h("a", {href: this.getRecordTypeLink(sfHost, selectedValue.sobject.name, recordIdDetails.recordTypeId), target: linkTarget}, recordIdDetails.recordTypeName)
              )
            ) : null,
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


class AlertBanner extends React.PureComponent {
  // From SLDS Alert Banner spec https://www.lightningdesignsystem.com/components/alert/

  render() {
    let {type, iconName, iconTitle, bannerText, link, assistiveText, onClose} = this.props;
    return (
      h("div", {className: `slds-notify slds-notify_alert slds-theme_${type}`, role: "alert"},
        h("span", {className: "slds-assistive-text"}, assistiveText | "Notification"),
        h("span", {className: `slds-icon_container slds-icon-utility-${iconName} slds-m-right_small slds-no-flex slds-align-top`, title: iconTitle},
          h("svg", {className: "slds-icon slds-icon_small", viewBox: "0 0 52 52"},
            h("use", {xlinkHref: `symbols.svg#${iconName}`})
          ),
        ),
        h("h2", {}, bannerText,
          h("p", {}, ""),
          link.text && h("a", link.props, link.text)
        ),
        onClose && h("div", {className: "slds-notify__close"},
          h("button", {className: "slds-button slds-button_icon slds-button_icon-small slds-button_icon-inverse", title: "Close", onClick: onClose},
            h("svg", {className: "slds-button__icon", viewBox: "0 0 52 52"},
              h("use", {xlinkHref: "symbols.svg#close"})
            ),
            h("span", {className: "slds-assistive-text"}, "Close"),
          )
        )
      )
    );
  }
}
class AllDataSearch extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      queryString: "",
      matchingResults: [],
      recentItems: [],
      queryDelayTimer: null
    };
    this.onAllDataInput = this.onAllDataInput.bind(this);
    this.onAllDataFocus = this.onAllDataFocus.bind(this);
    this.onAllDataBlur = this.onAllDataBlur.bind(this);
    this.onAllDataKeyDown = this.onAllDataKeyDown.bind(this);
    this.onAllDataArrowClick = this.onAllDataArrowClick.bind(this);
    this.updateAllDataInput = this.updateAllDataInput.bind(this);
  }
  componentDidMount() {
    let {queryString} = this.state;
    this.getMatchesDelayed(queryString);
  }
  onAllDataInput(e) {
    let val = e.target.value;
    this.refs.autoComplete.handleInput();
    this.getMatchesDelayed(val);
    this.setState({queryString: val});
  }
  onAllDataFocus() {
    //show recently viewed records only on Object tab
    if (this.props.sobjectsList){
      this.refs.autoComplete.handleFocus();
    }
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
    this.setState({queryString: ""});
    this.getMatchesDelayed("");
  }
  onAllDataArrowClick() {
    this.refs.showAllDataInp.focus();
  }
  getMatchesDelayed(userQuery) {
    let {queryDelayTimer} = this.state;
    let {inputSearchDelay} = this.props;

    if (queryDelayTimer) {
      clearTimeout(queryDelayTimer);
    }
    queryDelayTimer = setTimeout(async () => {
      let {getMatches} = this.props;
      const matchingResults = await getMatches(userQuery);
      await this.setState({matchingResults});
    }, inputSearchDelay);

    this.setState({queryDelayTimer});
  }
  render() {
    let {queryString, matchingResults, recentItems} = this.state;
    let {placeholderText, resultRender, sfHost} = this.props;
    return (
      h("div", {className: "input-with-dropdown"},
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
          matchingResults: resultRender(matchingResults, queryString),
          recentItems: resultRender(recentItems, queryString),
          queryString,
          sfHost
        }),
        h("svg", {viewBox: "0 0 24 24", onClick: this.onAllDataArrowClick},
          h("path", {d: "M3.8 6.5h16.4c.4 0 .8.6.4 1l-8 9.8c-.3.3-.9.3-1.2 0l-8-9.8c-.4-.4-.1-1 .4-1z"})
        )
      )
    );
  }
}

function MarkSubstring({text, start, length}) {
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
    this.setState({showResults: true, selectedIndex: 0, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
  }
  handleFocus() {
    let {recentItems} = this.props;
    sfConn.rest("/services/data/v" + apiVersion + "/query/?q=SELECT+Id,Name,Type+FROM+RecentlyViewed+LIMIT+100").then(res => {
      let itemsIds = new Set();
      res.records.forEach(recentItem => {
        if (!itemsIds.has(recentItem.Id)){
          recentItems.push({key: recentItem.Id,
            value: {recordId: recentItem.Id, isRecent: true, sobject: {keyPrefix: recentItem.Id.slice(0, 3), label: recentItem.Type, name: recentItem.Name}},
            element: [
              h("div", {className: "autocomplete-item-main", key: "main"},
                recentItem.Name,
              ),
              h("div", {className: "autocomplete-item-sub", key: "sub"},
                h(MarkSubstring, {
                  text: recentItem.Type,
                  start: -1,
                  length: 0
                }),
                " • ",
                h(MarkSubstring, {
                  text: recentItem.Id,
                  start: -1,
                  length: 0
                })
              )
            ]});
          itemsIds.add(recentItem.Id);
        }
      });
      this.setState({recentItems, showResults: true, selectedIndex: 0, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
    });
  }
  handleBlur() {
    this.setState({showResults: false});
  }
  handleKeyDown(e) {
    let {matchingResults} = this.props;
    let {selectedIndex, showResults, scrollToSelectedIndex} = this.state;
    if (e.key == "Enter") {
      if (!showResults) {
        this.setState({showResults: true, selectedIndex: 0, scrollToSelectedIndex: scrollToSelectedIndex + 1});
        return;
      }
      if (selectedIndex < matchingResults.length) {
        e.preventDefault();
        let {value} = matchingResults[selectedIndex];
        this.props.updateInput(value);
        this.setState({showResults: false, selectedIndex: 0});
      }
      return;
    }
    if (e.key == "Escape") {
      e.preventDefault();
      this.setState({showResults: false, selectedIndex: 0});
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
        this.setState({showResults: true, selectedIndex: 0, scrollToSelectedIndex: scrollToSelectedIndex + 1});
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
      this.setState({selectedIndex: index, scrollToSelectedIndex: scrollToSelectedIndex + 1});
    }
  }
  onResultsMouseDown() {
    this.setState({resultsMouseIsDown: true});
  }
  onResultsMouseUp() {
    this.setState({resultsMouseIsDown: false});
  }
  onResultClick(e, value) {
    let {sfHost} = this.props;
    if (value.isRecent){
      window.open("https://" + sfHost + "/" + value.recordId, getLinkTarget(e, true));
    } else {
      this.props.updateInput(value);
      this.setState({showResults: false, selectedIndex: 0});
    }
  }
  onResultMouseEnter(index) {
    this.setState({selectedIndex: index, scrollToSelectedIndex: this.state.scrollToSelectedIndex + 1});
  }
  onScroll() {
    let scrollTopIndex = Math.floor(this.refs.scrollBox.scrollTop / this.state.itemHeight);
    if (scrollTopIndex != this.state.scrollTopIndex) {
      this.setState({scrollTopIndex});
    }
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.itemHeight == 1) {
      let anItem = this.refs.scrollBox.querySelector(".autocomplete-item");
      if (anItem) {
        let itemHeight = anItem.offsetHeight;
        if (itemHeight > 0) {
          this.setState({itemHeight});
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
    let {matchingResults, recentItems} = this.props;
    let {
      showResults,
      selectedIndex,
      scrollTopIndex,
      itemHeight,
      resultsMouseIsDown
    } = this.state;
    // For better performance only render the visible autocomplete items + at least one invisible item above and below (if they exist)
    const RENDERED_ITEMS_COUNT = 11;
    let firstIndex = 0;
    let autocompleteResults = recentItems.length > 0 ? recentItems : matchingResults;
    let lastIndex = autocompleteResults.length - 1;
    let firstRenderedIndex = Math.max(0, scrollTopIndex - 2);
    let lastRenderedIndex = Math.min(lastIndex, firstRenderedIndex + RENDERED_ITEMS_COUNT);
    let topSpace = (firstRenderedIndex - firstIndex) * itemHeight;
    let bottomSpace = (lastIndex - lastRenderedIndex) * itemHeight;
    let topSelected = (selectedIndex - firstIndex) * itemHeight;

    return (
      h("div", {className: "autocomplete-container", style: {display: (showResults && (autocompleteResults.length > 0)) || resultsMouseIsDown ? "" : "none"}, onMouseDown: this.onResultsMouseDown, onMouseUp: this.onResultsMouseUp},
        h("div", {className: "autocomplete", onScroll: this.onScroll, ref: "scrollBox"},
          h("div", {ref: "selectedItem", style: {position: "absolute", top: topSelected + "px", height: itemHeight + "px"}}),
          h("div", {style: {height: topSpace + "px"}}),
          autocompleteResults.slice(firstRenderedIndex, lastRenderedIndex + 1)
            .map(({key, value, element}, index) =>
              h("a", {
                key,
                className: "autocomplete-item " + (selectedIndex == index + firstRenderedIndex ? "selected" : ""),
                onClick: (e) => this.onResultClick(e, value),
                onMouseEnter: () => this.onResultMouseEnter(index + firstRenderedIndex)
              }, element)
            ),
          h("div", {style: {height: bottomSpace + "px"}})
        )
      )
    );
  }
}

function getRecordId(href) {
  let url = new URL(href);
  // Find record ID from URL
  // Salesforce and Console (+ Hyperforce China Lightning & Classic)
  if (url.hostname.endsWith(".salesforce.com") || url.hostname.endsWith(".salesforce.mil") || url.hostname.endsWith(".sfcrmapps.cn") || url.hostname.endsWith(".sfcrmproducts.cn")) {
    let match = url.pathname.match(/\/([a-zA-Z0-9]{3}|[a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
    if (match) {
      let res = match[1];
      if (res.includes("0000") || res.length == 3) {
        return match[1];
      }
    }
  }

  // Lightning Experience
  const lightningHostnames = [
    ".lightning.force.com",
    ".lightning.force.mil",
    ".lightning.crmforce.mil",
    ".lightning.force.com.mcas.ms"
  ];
  if (lightningHostnames.some(hostname => url.hostname.endsWith(hostname))) {
    let match;
    if (url.pathname == "/one/one.app") {
      match = url.hash.match(/\/sObject\/([a-zA-Z0-9]+)(?:\/|$)/);
    } else {
      match = url.pathname.match(/\/lightning\/[r|o]\/[a-zA-Z0-9_]+\/([a-zA-Z0-9]+)/);
    }
    if (match) {
      return match[1];
    }
  }
  // Visualforce
  let searchParams = new URLSearchParams(url.search.substring(1));
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

function getSobject(href) {
  let url = new URL(href);
  if (url.pathname) {
    let match = url.pathname.match(/\/lightning\/[r|o]\/([a-zA-Z0-9_]+)\/[a-zA-Z0-9]+/);
    if (match) {
      return match[1];
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
  const splitted = localeKey.split("_");
  return splitted[(splitted.length > 1 && !localeKey.includes("_LATN_")) ? 1 : 0].toLowerCase();
}

window.getRecordId = getRecordId; // for unit tests
