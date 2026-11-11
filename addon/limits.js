/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, copyToClipboard} from "./utils.js";
/* global initButton */

class Model {
  constructor(sfHost) {
    this.reactCallback = null;
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";
    this.spinnerCount = 0;
    this.title = "Org Limits";
    this.allLimitData = [];
    this.searchQuery = "";
    this.errorMessages = [];
    this.sortOptions = [{label: "Consumption", value: "consumption"}, {label: "A-Z %", value: "asc"}];

    const urlParams = new URLSearchParams(window.location.search);
    const sortFromUrl = urlParams.get("sort");
    this.sortBy = this.sortOptions.find(opt => opt.value === sortFromUrl) || this.sortOptions[1];

    // Initialize user info model - handles all user-related properties
    // Wrap spinFor to match the expected signature (spinFor in limits.js takes actionName and callback)
    this.userInfoModel = new UserInfoModel((promise) => {
      this.spinnerCount++;
      promise
        .then(() => {
          this.spinnerCount--;
          this.didUpdate();
        })
        .catch(err => {
          console.error(err);
          this.errorMessages.push("Error retrieving user info: " + err.message);
          this.spinnerCount--;
          this.didUpdate();
        })
        .catch(err => console.log("error handling failed", err));
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
        "consumption": res[key].Max === 0 ? 0 : (res[key].Max - res[key].Remaining) / res[key].Max
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
    // "0 of 0 consumed" means the limit does not apply to this org, not that it is fully consumed
    let isNotApplicable = this.props.max === 0 && this.props.remaining === 0;
    let rawPercentage = isNotApplicable ? 0 : this.props.consumption * 100;
    let percentage = Math.round(rawPercentage);
    let gaugeState = rawPercentage <= 0 ? "neutral" : rawPercentage < 100 ? "healthy" : rawPercentage === 100 ? "full" : "over";
    return (
      h("article", {className: "limits-grid__item"},
        h("figure", {className: "limits-gauge-card"},
          h("div", {
            className: "limits-gauge gauge"
          },
          h("div", {
            className: "limits-gauge__meter meter limits-gauge__meter_state_" + gaugeState + (isNotApplicable ? " limits-gauge__meter_not-applicable meter-not-applicable" : ""),
            ref: "meter"
          },
          ""
          ),
          h("div", {
            className: "limits-gauge__value-container meter-value-container"
          },
          h("div", {
            className: "limits-gauge__value meter-value limits-gauge__value_state_" + gaugeState
          }, percentage + "%")
          )
          ),
          h("figcaption", {className: "limits-gauge-card__caption"},
            h("span", {className: "limits-gauge-card__name"}, this.props.label),
            h("div", {className: "limits-gauge-card__details"}, (this.props.max - this.props.remaining).toLocaleString() + " of " + (this.props.max).toLocaleString() + " consumed",
              h("br", {}), this.props.remaining >= 0 ? "(" + (this.props.remaining).toLocaleString() + " left)" : "(" + (0 - this.props.remaining).toLocaleString() + " overconsumed)"
            ),
          )
        )
      )
    );
  }
  componentDidMount() {
    // Animate gauge to relevant value
    let isNotApplicable = this.props.max === 0 && this.props.remaining === 0;
    let gaugePercentage = isNotApplicable ? 0 : Math.min(Math.max(this.props.consumption, 0), 1);
    let targetDegree = (gaugePercentage * 180) + "deg";
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
    this.onSearch = this.onSearch.bind(this);
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

  onSearch(e) {
    this.model.searchQuery = e.target.value;
    this.model.didUpdate();
  }

  onRefreshLimits(){
    this.model.startLoading();
  }

  render() {
    let model = this.props.vm;
    document.title = model.title;
    const searchQuery = model.searchQuery.trim().toLowerCase();
    const visibleLimits = model.allLimitData.filter(limit =>
      !searchQuery || limit.label.toLowerCase().includes(searchQuery) || limit.key.toLowerCase().includes(searchQuery)
    );
    return h("div", {},
      h(PageHeader, {
        pageTitle: "Org Limits",
        orgName: model.orgName,
        sfLink: model.sfLink,
        sfHost: model.sfHost,
        spinnerCount: model.spinnerCount,
        ...model.userInfoModel.getProps()
      }),
      h("main", {className: "limits-page sfir-page-container"},
        h("section", {className: "limits-panel", "aria-labelledby": "limits-heading"},
          h("header", {className: "limits-panel__header"},
            h("div", {className: "limits-panel__title"},
              h("h2", {id: "limits-heading"}, "Limits snapshot"),
              h("p", {}, "Current consumption across your org-wide limits.")
            ),
            h("div", {className: "limits-toolbar"},
              h("button", {className: "slds-button slds-button_neutral limits-copy-button", disabled: model.allLimitData.length == 0, onClick: this.onCopyAsJson, title: "Copy raw JSON to clipboard"}, "Copy JSON"),
              h("label", {className: "limits-search", htmlFor: "limits-search"},
                h("span", {className: "limits-sort__label"}, "Search limits"),
                h("input", {className: "slds-input limits-search__input", id: "limits-search", type: "search", placeholder: "Search by label or API name...", value: model.searchQuery, onChange: this.onSearch})
              ),
              h("label", {className: "limits-sort", htmlFor: "limits-sort"},
                h("span", {className: "limits-sort__label"}, "Sort by"),
                h("span", {className: "slds-select_container"},
                  h("select", {className: "slds-select limits-sort__select", id: "limits-sort", value: model.sortBy.value, onChange: this.onSortBy},
                    model.sortOptions.map(opt => h("option", {key: opt.value, value: opt.value}, opt.label))
                  )
                )
              )
            )
          ),
          h("div", {className: "limits-panel__body"},
            visibleLimits.length
              ? h("div", {className: "limits-grid"},
                visibleLimits.map(limitData =>
                  h(LimitData, {...limitData, key: limitData.key})
                )
              )
              : model.searchQuery
                ? h("p", {className: "limits-empty"}, "No limits match your search.")
                : null
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
