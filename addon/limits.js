/* global React ReactDOM */
import {sfConn, apiVersion, setupColorListeners} from "./inspector.js";
import {copyToClipboard} from "./data-load.js";
/* global initButton */

class Model {
  constructor(sfHost) {
    this.reactCallback = null;
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.title = "Org Limits";
    this.userInfo = "...";
    this.allLimitData = [];
    this.errorMessages = [];
    this.sortOptions = [{label: "Consumption", value: "consumption"}, {label: "A-Z %", value: "asc"}];
    this.sortBy = this.sortOptions[1];

    let userInfoPromise = sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {});
    this.spinFor("userInfo", userInfoPromise, (res) => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
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
}


let h = React.createElement;

class LimitData extends React.Component {
  render() {
    return (
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
            h("br", {}), "(" + (this.props.remaining).toLocaleString() + " left)"
          ),
        )
      )
    );
  }
  divide(a, b) {
    return (a / b) ? (a / b) : 0;
  }
  componentDidMount() {
    // Animate gauge to relevant value
    let targetDegree = (this.props.max == 0) ? "180deg" : ((1 - this.divide(this.props.remaining, this.props.max)) * 180) + "deg"; //180deg = 100%, 0deg = 0%
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
    setupColorListeners();
    this.model = this.props.vm;
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onSortBy = this.onSortBy.bind(this);
  }

  sortLimits(data, sortBy) {
    const sortFunctions = {
      consumption: (a, b) => b.consumption - a.consumption,
      asc: (a, b) => a.label.localeCompare(b.label)
    };
    return data.sort(sortFunctions[sortBy] || (() => 0));
  }

  onCopyAsJson() {
    this.model.copyAsJson();
    this.model.didUpdate();
  }
  onSortBy(e){
    this.model.sortBy = e.target.value;
    this.model.allLimitData = this.sortLimits(this.model.allLimitData, this.model.sortBy);
    this.model.didUpdate();
  }

  render() {
    let model = this.props.vm;
    document.title = model.title;
    return h("div", {},
      h("div", {id: "user-info"},
        h("a", {href: `https://${sfConn.instanceHostname}`, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
        h("h1", {}, model.title),
        h("span", {}, " / " + model.userInfo),
        h("div", {className: "flex-right"},
          h("a", {href: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_limits.htm", target: "_blank", id: "help-btn", title: "Org Limits Help", onClick: null},
            h("div", {className: "icon"})
          ),
          h("div", {id: "spinner", role: "status", className: "slds-spinner slds-spinner_small slds-spinner_inline", hidden: model.spinnerCount == 0},
            h("span", {className: "slds-assistive-text"}),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"}),
          ),
        ),
      ),
      h("div", {className: "area", id: "result-area"},
        h("div", {className: "result-bar"},
          h("h1", {}, "Limits"),
          h("div", {className: "button-group"},
            h("button", {disabled: model.allLimitData.length == 0, onClick: this.onCopyAsJson, title: "Copy raw JSON to clipboard"}, "Copy")
          ),
          h("div", {className: "flex-right"},
            h("select", {value: model.sortBy, onChange: this.onSortBy, className: ""},
              h("option", {value: "none", disabled: true, defaultValue: true, hidden: true}, "Sort By"),
              model.sortOptions.map(opt => h("option", {key: opt.value, value: opt.value}, opt.label))
            ),
          ),
        ),
        h("div", {id: "result-table", ref: "scroller"},
          h("div", {},
            h("div", {
              className: "body"
            },
            model.allLimitData.map(limitData =>
              h(LimitData, limitData)
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
