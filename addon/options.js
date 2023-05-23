/* global React ReactDOM */
import { sfConn, apiVersion } from "./inspector.js";
/* global initButton */
import { DescribeInfo } from "./data-load.js";

class Model {

  constructor(sfHost) {
    this.sfHost = sfHost;

    this.sfLink = "https://" + this.sfHost;
    this.userInfo = "...";
    if (localStorage.getItem(sfHost + "_isSandbox") != "true") {
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

}

class SldsOptionsTabSelector extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTabId: 1
    };
    this.tabs = [
      {
        id: 1,
        tabTitle: "Tab1",
        title: "Theme",
        content: h(ThemeOptions)
      }, 
      // Add here additional options tabs (e.g. API Version?)
    ];
    this.onTabSelect = this.onTabSelect.bind(this);
  }

  onTabSelect(e) {
    e.preventDefault();
    this.setState({ selectedTabId: e.target.tabIndex});
  }

  render() {
    return h("div", {className: "slds-tabs_default"},
      h("ul", { className: "slds-tabs_default__nav", role: "tablist"} ,
        this.tabs.map((tab) => h(SldsOptionsTab, { key: tab.id, title: tab.title, id: tab.id, selectedTabId: this.state.selectedTabId, onTabSelect: this.onTabSelect }))
      ),
      this.tabs.map((tab) => h(SldsTabContent, { key: tab.id, id: tab.id, content: tab.content, selectedTabId: this.state.selectedTabId }))
    );
  }
}

class SldsOptionsTab extends React.Component {

  getClass() {
    return "slds-tabs_default__item" + (this.props.selectedTabId === this.props.id ? " slds-is-active" : "");
  }

  render() {
    return h("li", { key: this.props.id, className: this.getClass(), title: this.props.title, tabIndex: this.props.id, role: "presentation", onClick: this.props.onTabSelect },
      h("a", { className: "slds-tabs_default__link", href: "#", role: "tab", tabIndex: this.props.id, id: "tab-default-" + this.props.id + "__item" },
        this.props.title)
    );
  }
}

class SldsTabContent extends React.Component {

  getClass() {
    return (this.props.selectedTabId === this.props.id ? "slds-show" : " slds-hide");
  }

  render() {
    return h("div", { id: this.props.id, className: this.getClass(), role: "tabpanel" }, this.props.content);
  }

}

class ThemeOptions extends React.Component {

  constructor(props) {
    super(props);
    this.onChangeTheme = this.onChangeTheme.bind(this);
    // Theme is supposed to be light by default if not already set
    this.state = {
      theme: localStorage.getItem("theme") ? localStorage.getItem("theme") : "light"
    };
  }

  onChangeTheme(e) {
    if (this.state.theme === "dark") {
      localStorage.setItem("theme", "light");
      this.setState({theme: "light"});
    } else {
      localStorage.setItem("theme", "dark");
      this.setState({theme: "dark"});
    }
  }

  render() {
    return h("div", { className: "slds-grid slds-border_bottom slds-p-around_small" },
      h("div", { className: "text-align-middle"},
        h("span", {}, "Dark Theme")
      ),
      h("div", { className: "flex-right slds-form-element" },
        h("label", { className: "slds-checkbox_toggle slds-grid" },
          h("span", { className: "slds-form-element__label slds-m-bottom_none" }),
          h("input", { type: "checkbox", name: "checkbox-toggle-1", value: "checkbox-toggle-1", checked: (this.state.theme === "dark"), onChange: this.onChangeTheme }),
          h("span", { id: "checkbox-toggle-1", className: "slds-checkbox_faux_container" },
            h("span", { className: "slds-checkbox_faux" }),
            h("span", { className: "slds-checkbox_on" }, "Enabled"),
            h("span", { className: "slds-checkbox_off" }, "Disabled"),
          )
        ),
      )
    );
  }
}

let h = React.createElement;

class App extends React.Component {

  constructor(props) {
    super(props);
    this.foo = undefined;
  }

  render() {
    let { model } = this.props;
    return ( h("div", {},
      h("div", { id: "user-info", className: "slds-border_bottom" },
        h("a", { href: model.sfLink, className: "sf-link" },
          h("svg", { viewBox: "0 0 24 24" },
            h("path", { d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z" })
          ),
          " Salesforce Home"
        ),
        h("h1", { className: "slds-text-title_bold" }, "Salesforce Inspector Options"),
        h("div", { className: "flex-right" })),
      h("div", { className: "slds-card slds-m-around_x-small" },
        h(SldsOptionsTabSelector)))
    );
  }
}


{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model(sfHost);
    model.reactCallback = cb => {
      ReactDOM.render(h(App, { model }), root, cb);
    };
    ReactDOM.render(h(App, { model }), root);

    if (parent && parent.isUnitTest) { // for unit tests
      parent.insextTestLoaded({ model });
    }

  });

}
