/* global React ReactDOM */
import {sfConn} from "./inspector.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, copyToClipboard} from "./utils.js";
import {apiStatistics, ApiStatistics} from "./api-statistics.js";
import ConfirmModal from "./components/ConfirmModal.js";
/* global initButton */

class Model {
  constructor(sfHost) {
    this.reactCallback = null;
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";
    this.spinnerCount = 0;
    this.title = "API Debug Stats";
    this.stats = null;
    this.debugModeEnabled = ApiStatistics.isDebugModeEnabled();
    this.showErrorModal = false;
    this.errorMessages = [];

    // Initialize user info model
    this.userInfoModel = new UserInfoModel((promise) => {
      this.spinnerCount++;
      promise
        .then(() => {
          this.spinnerCount--;
          this.didUpdate();
        })
        .catch(err => {
          console.error(err);
          this.spinnerCount--;
          this.didUpdate();
        });
    });

    this.loadStats();
  }

  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }

  loadStats() {
    // Load stats filtered by selected day
    this.stats = apiStatistics.getStats();
    this.didUpdate();
  }

  resetStats() {
    apiStatistics.reset();
    this.loadStats();
  }

  copyAsJson() {
    copyToClipboard(JSON.stringify(this.stats, null, 2));
  }

  showErrors() {
    this.errorMessages = apiStatistics.getLastErrors();
    this.showErrorModal = true;
    this.didUpdate();
  }

  hideErrors() {
    this.showErrorModal = false;
    this.didUpdate();
  }
}

let h = React.createElement;

class StatsCard extends React.Component {
  render() {
    const {title, value, subtitle, className = ""} = this.props;
    return h("div", {className: `slds-card slds-m-around_small ${className}`},
      h("div", {className: "slds-card__body slds-card__body_inner"},
        h("h3", {className: "slds-text-heading_small slds-m-bottom_x-small"}, title),
        h("div", {className: "slds-text-heading_large slds-text-color_success"}, value),
        subtitle && h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-top_x-small"}, subtitle)
      )
    );
  }
}

class EndpointTable extends React.Component {
  render() {
    const {endpoints, title, onErrorClick} = this.props;
    if (!endpoints || endpoints.length === 0) {
      return null;
    }

    return h("div", {className: "slds-card slds-m-around_medium"},
      h("div", {className: "slds-card__header"},
        h("h2", {className: "slds-card__header-title"}, title)
      ),
      h("div", {className: "slds-card__body slds-card__body_inner"},
        h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped"},
          h("thead", {},
            h("tr", {},
              h("th", {scope: "col"}, "Endpoint"),
              h("th", {scope: "col", className: "slds-text-align_right"}, "Calls"),
              h("th", {scope: "col", className: "slds-text-align_right"}, "Errors"),
              h("th", {scope: "col", className: "slds-text-align_right"}, "Avg Duration (ms)")
            )
          ),
          h("tbody", {},
            endpoints.map((endpoint, index) =>
              h("tr", {key: index},
                h("td", {}, endpoint.endpoint),
                h("td", {className: "slds-text-align_right"}, endpoint.count.toLocaleString()),
                h("td", {className: "slds-text-align_right"}, endpoint.errors > 0 ? h("span", {
                  className: "slds-text-color_error sfir-error-link",
                  onClick: onErrorClick,
                  title: "Click to view error details"
                }, endpoint.errors) : "0"),
                h("td", {className: "slds-text-align_right"}, endpoint.averageDuration.toLocaleString())
              )
            )
          )
        )
      )
    );
  }
}

class MethodTable extends React.Component {
  render() {
    const {methods, title, onErrorClick} = this.props;
    if (!methods || methods.length === 0) {
      return null;
    }

    return h("div", {className: "slds-card slds-m-around_medium"},
      h("div", {className: "slds-card__header"},
        h("h2", {className: "slds-card__header-title"}, title)
      ),
      h("div", {className: "slds-card__body slds-card__body_inner"},
        h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped"},
          h("thead", {},
            h("tr", {},
              h("th", {scope: "col"}, "Method"),
              h("th", {scope: "col", className: "slds-text-align_right"}, "Calls"),
              h("th", {scope: "col", className: "slds-text-align_right"}, "Errors"),
              h("th", {scope: "col", className: "slds-text-align_right"}, "Avg Duration (ms)")
            )
          ),
          h("tbody", {},
            methods.map((method, index) =>
              h("tr", {key: index},
                h("td", {}, method.method),
                h("td", {className: "slds-text-align_right"}, method.count.toLocaleString()),
                h("td", {className: "slds-text-align_right"}, method.errors > 0 ? h("span", {
                  className: "slds-text-color_error sfir-error-link",
                  onClick: onErrorClick,
                  title: "Click to view error details"
                }, method.errors) : "0"),
                h("td", {className: "slds-text-align_right"}, method.averageDuration.toLocaleString())
              )
            )
          )
        )
      )
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.model = this.props.vm;
    this.onResetStats = this.onResetStats.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onErrorClick = this.onErrorClick.bind(this);
    this.onCloseErrorModal = this.onCloseErrorModal.bind(this);
  }

  onResetStats() {
    if (confirm("Are you sure you want to reset all API Debug statistics? This action cannot be undone.")) {
      this.model.resetStats();
    }
  }

  onCopyAsJson() {
    this.model.copyAsJson();
  }

  onErrorClick() {
    this.model.showErrors();
  }

  onCloseErrorModal() {
    this.model.hideErrors();
  }

  render() {
    const {stats, debugModeEnabled} = this.model;

    if (!debugModeEnabled) {
      return h("div", {},
        h(PageHeader, {
          pageTitle: "API Debug Stats",
          orgName: this.model.orgName,
          sfLink: this.model.sfLink,
          sfHost: this.model.sfHost,
          spinnerCount: this.model.spinnerCount,
          ...this.model.userInfoModel.getProps()
        }),
        h("div", {className: "slds-m-top_xx-large sfir-page-container"},
          h("div", {className: "slds-card slds-m-around_medium"},
            h("div", {className: "slds-card__body slds-card__body_inner"},
              h("div", {className: "slds-text-align_center slds-p-vertical_xx-large"},
                h("svg", {className: "slds-icon slds-icon_large slds-icon-text-warning", "aria-hidden": true, style: {width: "4rem", height: "4rem"}},
                  h("use", {xlinkHref: "symbols.svg#warning"})
                ),
                h("h2", {className: "slds-text-heading_large slds-m-top_medium"}, "Debug Mode is Disabled"),
                h("p", {className: "slds-text-body_regular slds-m-top_small"},
                  "API debug statistics tracking is only available when Debug Mode is enabled.",
                  h("br", {}),
                  "Please enable Debug Mode in the Options page to start tracking API calls."
                ),
                h("a", {
                  href: `options.html?host=${encodeURIComponent(this.model.sfHost)}&selectedTab=api`,
                  className: "slds-button slds-button_brand slds-m-top_medium"
                }, "Go to Options")
              )
            )
          )
        )
      );
    }

    if (!stats) {
      return h("div", {},
        h(PageHeader, {
          pageTitle: "API Debug Stats",
          orgName: this.model.orgName,
          sfLink: this.model.sfLink,
          sfHost: this.model.sfHost,
          spinnerCount: this.model.spinnerCount,
          ...this.model.userInfoModel.getProps()
        }),
        h("div", {className: "slds-m-top_xx-large sfir-page-container"},
          h("div", {className: "slds-text-align_center"},
            h("div", {className: "slds-spinner slds-spinner_medium"},
              h("div", {className: "slds-spinner__dot-a"}),
              h("div", {className: "slds-spinner__dot-b"})
            )
          )
        )
      );
    }

    // Get filtered endpoints and methods based on granularity
    const filteredEndpoints = Object.entries(stats.rest.byEndpoint)
      .map(([endpoint, data]) => ({
        endpoint,
        ...data,
        averageDuration: data.averageDuration || (data.count > 0 ? Math.round(data.totalDuration / data.count) : 0)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const filteredSoapMethods = Object.entries(stats.soap.byMethod)
      .map(([method, data]) => ({
        method,
        ...data,
        averageDuration: data.averageDuration || (data.count > 0 ? Math.round(data.totalDuration / data.count) : 0)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const restMethods = Object.entries(stats.rest.byMethod)
      .map(([method, data]) => ({method, count: data.count}))
      .sort((a, b) => b.count - a.count);

    const sessionDurationText = stats.sessionDurationMinutes > 0
      ? `${stats.sessionDurationMinutes} minute${stats.sessionDurationMinutes > 1 ? "s" : ""}`
      : "Less than a minute";

    return h("div", {},
      h(PageHeader, {
        pageTitle: "API Debug Stats",
        orgName: this.model.orgName,
        sfLink: this.model.sfLink,
        sfHost: this.model.sfHost,
        spinnerCount: this.model.spinnerCount,
        ...this.model.userInfoModel.getProps()
      }),
      h("div", {className: "slds-m-top_xx-large sfir-page-container"},
        h("div", {className: "slds-card slds-m-around_medium"},
          h("div", {className: "slds-card__header slds-grid slds-grid_vertical-align-center"},
            h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
              h("div", {className: "slds-media__body"},
                h("h2", {className: "slds-card__header-title"}, "Statistics Summary")
              ),
              h("div", {className: "slds-col_bump-left slds-grid slds-grid_vertical-align-center"},
                h("button", {
                  className: "slds-button slds-button_neutral slds-m-right_small",
                  onClick: this.onCopyAsJson,
                  title: "Copy statistics as JSON"
                }, "Copy JSON"),
                h("button", {
                  className: "slds-button slds-button_destructive",
                  onClick: this.onResetStats,
                  title: "Reset all statistics"
                }, "Reset Statistics")
              )
            )
          ),
          h("div", {className: "slds-card__body slds-card__body_inner"},
            h("div", {className: "slds-grid slds-wrap"},
              h(StatsCard, {
                title: "Total API Calls",
                value: stats.total.calls.toLocaleString(),
                subtitle: `REST: ${stats.rest.total.toLocaleString()} | SOAP: ${stats.soap.total.toLocaleString()}`
              }),
              h(StatsCard, {
                title: "Total Errors",
                value: stats.total.errors.toLocaleString(),
                subtitle: `REST: ${stats.rest.errors.toLocaleString()} | SOAP: ${stats.soap.errors.toLocaleString()}`,
                className: stats.total.errors > 0 ? "slds-theme_error" : ""
              }),
              h(StatsCard, {
                title: "Session Duration",
                value: sessionDurationText,
                subtitle: `Started: ${new Date(stats.startTime).toLocaleString()}`
              }),
              h(StatsCard, {
                title: "Average Response Time",
                value: stats.rest.averageDuration > 0 || stats.soap.averageDuration > 0
                  ? `${Math.round((stats.rest.totalDuration + stats.soap.totalDuration) / stats.total.calls)} ms`
                  : "N/A",
                subtitle: `REST: ${stats.rest.averageDuration} ms | SOAP: ${stats.soap.averageDuration} ms`
              })
            )
          )
        ),
        restMethods.length > 0 && h("div", {className: "slds-card slds-m-around_medium"},
          h("div", {className: "slds-card__header"},
            h("h2", {className: "slds-card__header-title"}, "REST Calls by HTTP Method")
          ),
          h("div", {className: "slds-card__body slds-card__body_inner"},
            h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped"},
              h("thead", {},
                h("tr", {},
                  h("th", {scope: "col"}, "Method"),
                  h("th", {scope: "col", className: "slds-text-align_right"}, "Count")
                )
              ),
              h("tbody", {},
                restMethods.map((item, index) =>
                  h("tr", {key: index},
                    h("td", {}, item.method),
                    h("td", {className: "slds-text-align_right"}, item.count.toLocaleString())
                  )
                )
              )
            )
          )
        ),
        h(EndpointTable, {
          endpoints: filteredEndpoints,
          title: "Top REST Endpoints",
          onErrorClick: this.onErrorClick
        }),
        h(MethodTable, {
          methods: filteredSoapMethods,
          title: "Top SOAP Methods",
          onErrorClick: this.onErrorClick
        }),
        h(ConfirmModal, {
          isOpen: this.model.showErrorModal,
          title: "Last 10 API Errors",
          onCancel: this.onCloseErrorModal,
          confirmLabel: "Close",
          confirmVariant: "brand",
          cancelLabel: null,
          onConfirm: this.onCloseErrorModal,
          containerClassName: "slds-modal_large"
        },
        this.model.errorMessages.length > 0 ? h("div", {},
          h("div", {className: "slds-scrollable_y sfir-error-modal-content"},
            this.model.errorMessages.map((error, index) =>
              h("div", {
                key: index,
                className: "slds-box slds-m-bottom_small"
              },
              h("div", {className: "slds-grid slds-grid_vertical-align-center slds-m-bottom_x-small"},
                h("div", {className: "slds-col slds-text-heading_small"},
                  h("span", {className: "slds-badge slds-badge_inverse"}, error.mode.toUpperCase())
                ),
                h("div", {className: "slds-col slds-text-body_small slds-text-color_weak"},
                  new Date(error.timestamp).toLocaleString()
                )
              ),
              error.url && h("div", {className: "slds-text-body_small slds-m-bottom_x-small"},
                h("strong", {}, "URL: "),
                error.url
              ),
              error.method && h("div", {className: "slds-text-body_small slds-m-bottom_x-small"},
                h("strong", {}, "Method: "),
                error.method
              ),
              h("div", {className: "slds-text-body_regular"},
                h("strong", {}, "Error: "),
                h("span", {className: "slds-text-color_error"}, error.message)
              )
              )
            )
          )
        ) : h("div", {className: "slds-text-align_center slds-p-vertical_large"},
          h("p", {}, "No errors recorded.")
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
    vm.reactCallback = cb => {
      ReactDOM.render(h(App, {vm}), root, cb);
    };
    ReactDOM.render(h(App, {vm}), root);
  });
}
