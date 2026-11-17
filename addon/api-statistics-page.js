/* global React ReactDOM */
import {sfConn} from "./inspector.js";
import {PageHeader} from "./components/PageHeader.js";
import {UserInfoModel, copyToClipboard, formatDuration} from "./utils.js";
import {apiStatistics, ApiStatistics} from "./api-statistics.js";
import ConfirmModal from "./components/ConfirmModal.js";
/* global initButton */

class Model {
  constructor(sfHost) {
    this.reactCallback = null;
    this.sfHost = sfHost;
    this.apiHost = sfConn.instanceHostname; // resolved host the statistics are stored under
    this.sfLink = "https://" + sfHost;
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";
    this.spinnerCount = 0;
    this.title = "API Debug Stats";
    this.stats = null;
    this.debugModeEnabled = ApiStatistics.isDebugModeEnabled();
    this.showErrorModal = false;
    this.showResetModal = false;
    this.errorMessages = [];
    this.errorFilter = null;

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
    this.stats = apiStatistics.getStats(this.apiHost);
    if (this.showErrorModal) {
      this.loadErrors();
    }
    this.didUpdate();
  }

  showResetConfirm() {
    this.showResetModal = true;
    this.didUpdate();
  }

  hideResetConfirm() {
    this.showResetModal = false;
    this.didUpdate();
  }

  resetStats() {
    apiStatistics.reset(this.apiHost);
    this.showResetModal = false;
    this.loadStats();
  }

  copyAsJson() {
    copyToClipboard(JSON.stringify({host: this.apiHost, ...this.stats}, null, 2));
  }

  copyError(error) {
    copyToClipboard(formatErrorForCopy(error));
  }

  showErrors(label, matches) {
    this.errorFilter = label ? {label, matches} : null;
    this.loadErrors();
    this.showErrorModal = true;
    this.didUpdate();
  }

  loadErrors() {
    const errors = apiStatistics.getLastErrors(this.apiHost);
    this.errorMessages = this.errorFilter ? errors.filter(this.errorFilter.matches) : errors;
  }

  hideErrors() {
    this.showErrorModal = false;
    this.didUpdate();
  }
}

let h = React.createElement;

function formatErrorForCopy(error) {
  return [
    `Mode: ${error.mode.toUpperCase()}`,
    `Time: ${new Date(error.timestamp).toISOString()}`,
    error.url && `URL: ${error.url}`,
    error.method && `Method: ${error.method}`,
    `Error: ${error.message}`
  ].filter(Boolean).join("\n");
}

class StatsCard extends React.Component {
  render() {
    const {title, value, valueNote, subtitle, className = "slds-theme_shade", titleAttr, onClick} = this.props;
    const clickProps = onClick ? {
      role: "button",
      tabIndex: 0,
      onClick,
      onKeyDown: event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }
    } : {};
    return h("div", {className: `slds-card ${className}${onClick ? " sfir-clickable" : ""}`, title: titleAttr, ...clickProps},
      h("div", {className: "slds-card__body slds-card__body_inner"},
        h("h3", {className: "slds-text-heading_small slds-m-bottom_x-small"}, title),
        h("div", {className: "slds-text-heading_large slds-text-color_success"},
          value,
          valueNote && h("span", {className: "slds-text-body_regular slds-text-color_weak slds-m-left_x-small sfir-stats-card-note"}, valueNote)
        ),
        subtitle && h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-top_x-small"}, subtitle)
      )
    );
  }
}

function renderErrorCount(count, onClick) {
  if (count === 0) {
    return "0";
  }
  return h("button", {
    type: "button",
    className: "slds-button slds-text-color_error sfir-error-link",
    onClick,
    title: "Click to view error details"
  }, count.toLocaleString());
}

function compareValues(a, b) {
  return typeof a === "number" ? a - b : String(a).localeCompare(String(b));
}

class StatsTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {sortColumn: 1, descending: true};
  }

  onSort(column) {
    this.setState(state => state.sortColumn === column
      ? {descending: !state.descending}
      : {sortColumn: column, descending: column > 0});
  }

  render() {
    const {title, headers, rows, limit} = this.props;
    if (!rows || rows.length === 0) {
      return null;
    }
    const {sortColumn, descending} = this.state;
    const direction = descending ? -1 : 1;
    const sortedRows = [...rows].sort((a, b) => direction * compareValues(a.values[sortColumn], b.values[sortColumn]));
    const visibleRows = limit ? sortedRows.slice(0, limit) : sortedRows;
    const alignClass = index => index > 0 ? "slds-text-align_right" : undefined;
    const sortable = rows.length > 1;

    return h("div", {className: "slds-card"},
      h("div", {className: "slds-card__header"},
        h("h2", {className: "slds-card__header-title"}, title)
      ),
      h("div", {className: "slds-card__body slds-card__body_inner"},
        h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_col-bordered slds-table_striped sfir-table-outline"},
          h("thead", {},
            h("tr", {},
              headers.map((header, index) => {
                const isSorted = index === sortColumn;
                return h("th", {
                  key: header,
                  scope: "col",
                  className: alignClass(index),
                  "aria-sort": sortable ? (isSorted ? (descending ? "descending" : "ascending") : "none") : undefined
                },
                sortable ? h("button", {type: "button", className: "sfir-sort-button", onClick: () => this.onSort(index), title: `Sort by ${header}`},
                  header,
                  h("span", {className: "sfir-sort-indicator", "aria-hidden": "true"}, isSorted ? (descending ? "\u25BC" : "\u25B2") : "")
                ) : header
                );
              })
            )
          ),
          h("tbody", {},
            visibleRows.map(row =>
              h("tr", {key: row.values[0]},
                row.cells.map((cell, index) => h("td", {key: index, className: alignClass(index)}, cell))
              )
            )
          )
        )
      )
    );
  }
}

// byMethod / byEndpoint buckets -> items with their average duration
function toItems(buckets) {
  return Object.entries(buckets).map(([name, data]) => ({
    name,
    ...data,
    averageDuration: data.averageDuration || (data.count > 0 ? Math.round(data.totalDuration / data.count) : 0)
  }));
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.model = this.props.vm;
    this.onResetStats = this.onResetStats.bind(this);
    this.onConfirmReset = this.onConfirmReset.bind(this);
    this.onCancelReset = this.onCancelReset.bind(this);
    this.onRefresh = this.onRefresh.bind(this);
    this.onCopyAsJson = this.onCopyAsJson.bind(this);
    this.onErrorClick = this.onErrorClick.bind(this);
    this.onShowAllErrors = this.onShowAllErrors.bind(this);
    this.onCloseErrorModal = this.onCloseErrorModal.bind(this);
  }

  onResetStats() {
    this.model.showResetConfirm();
  }

  onConfirmReset() {
    this.model.resetStats();
  }

  onCancelReset() {
    this.model.hideResetConfirm();
  }

  onRefresh() {
    this.model.loadStats();
  }

  onCopyAsJson() {
    this.model.copyAsJson();
  }

  onErrorClick(label, matches) {
    this.model.showErrors(label, matches);
  }

  onShowAllErrors() {
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
        h("div", {className: "slds-m-top_xx-large slds-p-around_medium sfir-stats-page"},
          h("div", {className: "slds-card"},
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

    // Clicking the errors of a row shows only the errors of that endpoint / method
    const toDetailRows = (items, matchesItem) => items.map(item => ({
      cells: [
        item.name,
        item.count.toLocaleString(),
        renderErrorCount(item.errors, () => this.onErrorClick(item.name, error => matchesItem(error, item.name))),
        item.averageDuration.toLocaleString()
      ],
      values: [item.name, item.count, item.errors, item.averageDuration]
    }));
    const detailHeaders = ["Calls", "Errors", "Avg Duration (ms)"];
    const restMethodRows = toItems(stats.rest.byMethod).map(item => ({
      cells: [item.name, item.count.toLocaleString()],
      values: [item.name, item.count]
    }));
    const endpointRows = toDetailRows(toItems(stats.rest.byEndpoint),
      (error, endpoint) => error.mode === "rest" && apiStatistics.simplifyUrl(error.url) === endpoint);
    const soapMethodRows = toDetailRows(toItems(stats.soap.byMethod),
      (error, method) => error.mode === "soap" && error.method === method);

    const errorRate = stats.total.calls > 0 ? stats.total.errors / stats.total.calls * 100 : 0;
    const errorRateText = stats.total.errors > 0 && errorRate < 0.1 ? "<0.1%" : `${errorRate.toFixed(1)}%`;

    const errorCount = this.model.errorMessages.length;
    const errorModalTitle = errorCount === 0 ? "API Errors" : `Last ${errorCount} API ${errorCount === 1 ? "Error" : "Errors"}`;
    const errorFilter = this.model.errorFilter;

    const sessionDurationFull = formatDuration(stats.sessionDurationMinutes);
    // Truncate to first 2 units (each unit is 2 words: number + unit name)
    const sessionDurationParts = sessionDurationFull.split(" ");
    const sessionDurationText = sessionDurationParts.slice(0, 4).join(" ");

    return h("div", {},
      h(PageHeader, {
        pageTitle: "API Debug Stats",
        orgName: this.model.orgName,
        sfLink: this.model.sfLink,
        sfHost: this.model.sfHost,
        spinnerCount: this.model.spinnerCount,
        ...this.model.userInfoModel.getProps()
      }),
      h("div", {className: "slds-m-top_xx-large slds-p-around_medium sfir-stats-page"},
        h("div", {className: "slds-card"},
          h("div", {className: "slds-card__header slds-grid slds-grid_vertical-align-center"},
            h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
              h("div", {className: "slds-media__body"},
                h("h2", {className: "slds-card__header-title"}, "Statistics Summary")
              ),
              h("div", {className: "slds-col_bump-left slds-grid slds-grid_vertical-align-center"},
                h("button", {
                  className: "slds-button slds-button_neutral slds-m-right_x-small",
                  onClick: this.onRefresh,
                  title: "Reload the statistics"
                }, "Refresh"),
                h("button", {
                  className: "slds-button slds-button_neutral slds-m-right_x-small",
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
            h("div", {className: "sfir-stats-grid"},
              h(StatsCard, {
                title: "Total API Calls",
                value: stats.total.calls.toLocaleString(),
                subtitle: `REST: ${stats.rest.total.toLocaleString()} | SOAP: ${stats.soap.total.toLocaleString()}`
              }),
              h(StatsCard, {
                title: "Total Errors",
                value: stats.total.errors.toLocaleString(),
                valueNote: `(${errorRateText})`,
                subtitle: `REST: ${stats.rest.errors.toLocaleString()} | SOAP: ${stats.soap.errors.toLocaleString()}`,
                className: stats.total.errors > 0 ? "slds-theme_error" : undefined,
                onClick: stats.total.errors > 0 ? this.onShowAllErrors : undefined,
                titleAttr: stats.total.errors > 0 ? "Click to view the last errors" : undefined
              }),
              h(StatsCard, {
                title: "Session Duration",
                value: sessionDurationText,
                subtitle: `Started: ${new Date(stats.startTime).toLocaleString()}`,
                titleAttr: sessionDurationFull
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
        h(StatsTable, {title: "REST Calls by HTTP Method", headers: ["Method", "Count"], rows: restMethodRows}),
        h(StatsTable, {title: "Top REST Endpoints", headers: ["Endpoint", ...detailHeaders], rows: endpointRows, limit: 10}),
        h(StatsTable, {title: "Top SOAP Methods", headers: ["Method", ...detailHeaders], rows: soapMethodRows, limit: 10}),
        h(ConfirmModal, {
          isOpen: this.model.showResetModal,
          title: "Reset Statistics",
          message: "Are you sure you want to reset all API Debug statistics? This action cannot be undone.",
          confirmLabel: "Reset Statistics",
          confirmVariant: "destructive",
          onConfirm: this.onConfirmReset,
          onCancel: this.onCancelReset
        }),
        h(ConfirmModal, {
          isOpen: this.model.showErrorModal,
          title: errorModalTitle,
          // No onCancel: ConfirmModal would render an empty Cancel button. The X button and Esc fall back to onConfirm.
          confirmLabel: "Close",
          confirmVariant: "brand",
          onConfirm: this.onCloseErrorModal,
          // Only when filtered: back to all errors (the copy button slot of ConfirmModal is used for it)
          onCopy: errorFilter ? this.onShowAllErrors : undefined,
          copyLabel: "Show all errors",
          modalSize: "small"
        },
        h("div", {},
          errorFilter && h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-bottom_small slds-hyphenate"},
            `Filtered by: ${errorFilter.label}`
          ),
          this.model.errorMessages.length > 0 ? this.model.errorMessages.map((error, index) =>
              h("div", {
                key: index,
                className: "slds-box" + (index > 0 ? " slds-m-top_small" : "")
              },
              h("div", {className: "slds-grid slds-grid_vertical-align-center slds-m-bottom_x-small"},
                h("div", {className: "slds-col slds-grow-none slds-m-right_small slds-text-heading_small"},
                  h("span", {className: "slds-badge slds-badge_inverse"}, error.mode.toUpperCase())
                ),
                h("div", {className: "slds-col slds-text-body_small slds-text-color_weak"},
                  new Date(error.timestamp).toLocaleString()
                ),
                h("div", {className: "slds-col slds-grow-none"},
                  h("button", {
                    type: "button",
                    className: "slds-button slds-button_neutral slds-button_small",
                    onClick: () => this.model.copyError(error),
                    title: "Copy this error"
                  }, "Copy")
                )
              ),
              error.url && h("div", {className: "slds-text-body_small slds-m-bottom_x-small slds-hyphenate"},
                h("strong", {}, "URL: "),
                error.url
              ),
              error.method && h("div", {className: "slds-text-body_small slds-m-bottom_x-small"},
                h("strong", {}, "Method: "),
                error.method
              ),
              h("div", {className: "slds-hyphenate"},
                h("strong", {}, "Error: "),
                h("span", {className: "slds-text-color_error"}, error.message)
              )
              )
            ) : h("div", {className: "slds-text-align_center slds-p-vertical_large"},
            h("p", {}, errorFilter
              ? "No recent errors recorded for this item. Only the most recent errors across all calls are kept."
              : "No errors recorded.")
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
    vm.reactCallback = cb => {
      ReactDOM.render(h(App, {vm}), root, cb);
    };
    ReactDOM.render(h(App, {vm}), root);
  });
}
