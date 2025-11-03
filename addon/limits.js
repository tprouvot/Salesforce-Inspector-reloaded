/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
import {copyToClipboard} from "./data-load.js";
import {PageHeader} from "./components/PageHeader.js";
/* global initButton */

class Model {
  constructor(sfHost) {
    this.reactCallback = null;
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";
    this.spinnerCount = 0;
    this.title = "Org Limits";
    this.userFullName = "";
    this.userInitials = "";
    this.userName = "";
    this.allLimitData = [];
    this.errorMessages = [];
    this.sortOptions = [{label: "Consumption", value: "consumption"}, {label: "A-Z %", value: "asc"}];

    const urlParams = new URLSearchParams(window.location.search);
    const sortFromUrl = urlParams.get("sort");
    this.sortBy = this.sortOptions.find(opt => opt.value === sortFromUrl) || this.sortOptions[1];

    let userInfoPromise = sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {});
    this.spinFor("userInfo", userInfoPromise, (res) => {
      this.userFullName = res.userFullName;
      this.userInitials = this.userFullName.split(' ').map(n => n[0]).join('');
      this.userName = res.userName;
    });
  }

  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }

  spinFor(actionName, promise, cb) {
    this.spinnerCount++;
    promise
      .then(res => {
        this.spinnerCount--;
        cb(res);
        this.didUpdate();
      })
      .catch(err => {
        console.error(err);
        this.errorMessages.push("Error " + actionName + ": " + err.message);
        this.spinnerCount--;
        this.didUpdate();
      })
      .catch(err => console.log("error handling failed", err));
  }

  setLimitsData(res) {
    let self = this;
    this.allLimitData = [];

    Object.keys(res).forEach((key) => {
      self.allLimitData.push({
        key,
        "label": self.humanizeName(key),
        "description": "...",
        "max": res[key].Max,
        "remaining": res[key].Remaining,
        "consumption": (res[key].Max - res[key].Remaining) / res[key].Max
      });
    });
    self.allLimitData = self.sortLimits(self.allLimitData, self.sortBy.value);
  }

  humanizeName(name) {
    return name.replace(/([A-Z])/g, " $1"); //TODO: Improve
  }

  startLoading() {
    let limitsPromise = sfConn.rest("/services/data/v" + apiVersion + "/" + "limits");

    this.spinFor("describing global", limitsPromise, (res) => {
      this.setLimitsData(res);
    });
  }

  copyAsJson() {
    copyToClipboard(JSON.stringify(this.allLimitData ? this.allLimitData : this.allLimitData, null, "    "), null, "  ");
  }

  sortLimits(data, sortBy) {
    const sortFunctions = {
      consumption: (a, b) => b.consumption - a.consumption,
      asc: (a, b) => a.label.localeCompare(b.label)
    };
    return data.sort(sortFunctions[sortBy] || (() => 0));
  }
}


let h = React.createElement;

class LimitData extends React.Component {
  render() {
    return (
      h("div", {className: "slds-col slds-size_1-of-5 slds-p-top_xx-large"},
      h("figure", {},
        h("div", {
          className: "gauge"
        },
        h("div", {
          className: "meter",
          ref: "meter"
        },
        ""
        ),
        h("div", {
          className: "meter-value-container"
        },
        h("div", {
          className: "meter-value"
        }, Math.round((1 - this.divide(this.props.remaining, this.props.max)) * 100) + "%")
        )
        ),
        h("figcaption", {}, this.props.label,
          h("div", {}, (this.props.max - this.props.remaining).toLocaleString() + " of " + (this.props.max).toLocaleString() + " consumed",
            h("br", {}), this.props.remaining >= 0 ? "(" + (this.props.remaining).toLocaleString() + " left)" : "(" + (0 - this.props.remaining).toLocaleString() + " overconsumed)"
            ),
          )
        )
      )
    );
  }
  divide(a, b) {
    return (a / b) ? (a / b) : 0;
  }
  componentDidMount() {
    // Animate gauge to relevant value
    let targetDegree = (this.props.max == 0 || this.props.remaining < 0) ? "180deg" : ((1 - this.divide(this.props.remaining, this.props.max)) * 180) + "deg"; //180deg = 100%, 0deg = 0%
    this.refs.meter.animate([{
      transform: "rotate(0deg)"
    }, {
      transform: "rotate(" + targetDegree + ")"
    }], {
      duration: 1000,
      fill: "both"
    });
  }
}

class App extends React.Component {

  constructor(props) {
    super(props);
    this.model = this.props.vm;
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onSortBy = this.onSortBy.bind(this);
    this.onRefreshLimits = this.onRefreshLimits.bind(this);
  }

  onCopyAsJson() {
    this.model.copyAsJson();
    this.model.didUpdate();
  }
  onSortBy(e){
    this.model.sortBy = e.target.value;
    const url = new URL(window.location);
    url.searchParams.set("sort", this.model.sortBy);
    window.history.pushState({}, "", url);
    this.model.allLimitData = this.model.sortLimits(this.model.allLimitData, this.model.sortBy);
    this.model.didUpdate();
  }

  onRefreshLimits(){
    this.model.startLoading();
  }

  render() {
    let model = this.props.vm;
    document.title = model.title;
    return h("div", {},
      h(PageHeader, {
        pageTitle: "Org Limits",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        userInitials: model.userInitials,
        userFullName: model.userFullName,
        userName: model.userName
      }),
      h("div", { className: "slds-m-top_xx-large", style: {height: "calc(100vh - 50px)", display: "flex", flexDirection: "column"} },
        h("div", { className: "slds-card slds-m-around_medium", style: {flex: "1", display: "flex", flexDirection: "column", minHeight: 0} },
          h("div", { className: "slds-card__header slds-grid slds-grid_vertical-align-center" },
            h("header", { className: "slds-media slds-media_center slds-has-flexi-truncate" },
              h("div", { className: "slds-media__body slds-grid slds-grid_vertical-align-center" },
                h("div", { className: "slds-col slds-size_2-of-12" },
                  h("h3", { className: "slds-card__header-title" },
                    h("span", {}, "Limits snapshot")
                  ),
                ),
                h("div", { className: "slds-col slds-size_8-of-12" },
                  h("button", { className: "slds-button slds-button_neutral", disabled: model.allLimitData.length == 0, onClick: this.onCopyAsJson, title: "Copy raw JSON to clipboard" }, "Copy")
                ),
                h("div", { className: "slds-col slds-size_2-of-12 slds-text-align_right" },
                  h("div", {className: "slds-form-element"},
                    h("div", {className: "slds-form-element__control"},
                      h("div", {className: "slds-select_container"},
                        h("select", {className: "slds-select", id: "select-01", value: model.sortBy.value, onChange: this.onSortBy},
                          h("option", { value: "none", disabled: true, defaultValue: true, hidden: true }, "Sort By"),
                    model.sortOptions.map(opt => h("option", { key: opt.value, value: opt.value }, opt.label))
                        )
                      )
                    )
                  )
                )
              )
            ),
          ),
          h("div", {className: "slds-card__body slds-card__body_inner", style: {flex: "1", overflowY: "auto", minHeight: 0}},
            h("div", {className: "slds-grid slds-gutters slds-wrap"},
              model.allLimitData.map(limitData =>
                h(LimitData, limitData)
              )
            )
          ),
        )
      )
    );
  }
}


{

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let vm = new Model(sfHost);
    vm.startLoading(args);
    vm.reactCallback = cb => {
      ReactDOM.render(h(App, {
        vm
      }), root, cb);
    };
    ReactDOM.render(h(App, {
      vm
    }), root);

  });

  {
    let isDragging = false;
    document.body.onmousedown = () => {
      isDragging = false;
    };
    document.body.onmousemove = e => {
      if (e.movementX || e.movementY) {
        isDragging = true;
      }
    };
    document.body.onclick = e => {
      if (!e.target.closest("a") && !isDragging) {
        let el = e.target.closest(".quick-select");
        if (el) {
          getSelection().selectAllChildren(el);
        }
      }
    };
  }

}
