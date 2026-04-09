/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */

let h = React.createElement;

const ALL_COLUMNS = [
  {id: "CreatedDate",        label: "Date",          defaultVisible: true},
  {id: "CreatedBy.Username", label: "User",          defaultVisible: true},
  {id: "Section",            label: "Section",       defaultVisible: true},
  {id: "Display",            label: "Action",        defaultVisible: true},
  {id: "DelegateUser",       label: "Delegate User", defaultVisible: false},
];

const LIMIT_OPTIONS = [
  {value: 100,   label: "Last 100"},
  {value: 500,   label: "Last 500"},
  {value: 1000,  label: "Last 1,000"},
  {value: 2000,  label: "Last 2,000"},
  {value: 5000,  label: "Last 5,000"},
  {value: 10000, label: "Last 10,000"},
  {value: 50000, label: "All (up to 50,000)"},
];

function buildSoql(limit) {
  return "SELECT Id, CreatedDate, CreatedBy.Username, CreatedBy.Name, Section, Display, DelegateUser"
    + " FROM SetupAuditTrail"
    + " ORDER BY CreatedDate DESC"
    + " LIMIT " + limit;
}

function formatDate(iso) {
  if (!iso) return "";
  return iso.replace("T", " ").replace(/\.\d{3}Z?$/, "");
}

function getCellValue(entry, colId) {
  if (colId === "CreatedDate") return formatDate(entry.CreatedDate);
  if (colId === "CreatedBy.Username") return (entry.CreatedBy && entry.CreatedBy.Username) || "";
  return entry[colId] || "";
}

class AuditTrailApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      spinnerCount: 0,
      userInfo: "\u2026",
      loading: true,
      error: null,
      entries: [],
      limit: 2000,
      visibleColumns: ALL_COLUMNS.reduce((acc, col) => { acc[col.id] = col.defaultVisible; return acc; }, {}),
      filters:        ALL_COLUMNS.reduce((acc, col) => { acc[col.id] = ""; return acc; }, {}),
    };
    this.onToggleColumn = this.onToggleColumn.bind(this);
    this.onFilterChange = this.onFilterChange.bind(this);
    this.onClearFilters = this.onClearFilters.bind(this);
    this.onLimitChange  = this.onLimitChange.bind(this);
  }

  spinFor(promise) {
    this.setState(s => ({spinnerCount: s.spinnerCount + 1}));
    promise
      .then(() => this.setState(s => ({spinnerCount: s.spinnerCount - 1})))
      .catch(() => this.setState(s => ({spinnerCount: s.spinnerCount - 1})));
    return promise;
  }

  async componentDidMount() {
    // Load user info for the top bar (non-fatal)
    this.spinFor(
      sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {})
        .then(res => this.setState({userInfo: res.userFullName + " / " + res.userName + " / " + res.organizationName}))
        .catch(() => {})
    );

    await this.loadData(this.state.limit);
  }

  async loadData(limit) {
    this.setState(s => ({spinnerCount: s.spinnerCount + 1, loading: true, error: null, entries: []}));
    try {
      const soql = buildSoql(limit);
      const result = await sfConn.rest(
        "/services/data/v" + apiVersion + "/query/?q=" + encodeURIComponent(soql),
        {useCache: false}
      );
      const entries = result.records || [];

      // Paginate through additional pages when limit > 2000
      let nextUrl = result.nextRecordsUrl;
      while (nextUrl) {
        const next = await sfConn.rest(nextUrl, {useCache: false});
        entries.push(...(next.records || []));
        nextUrl = next.nextRecordsUrl;
      }

      this.setState(s => ({spinnerCount: s.spinnerCount - 1, loading: false, entries}));
    } catch (err) {
      this.setState(s => ({spinnerCount: s.spinnerCount - 1, loading: false, error: err.message || String(err)}));
    }
  }

  onLimitChange(e) {
    const limit = Number(e.target.value);
    this.setState({limit});
    this.loadData(limit);
  }

  onToggleColumn(colId) {
    this.setState(prev => ({
      visibleColumns: {...prev.visibleColumns, [colId]: !prev.visibleColumns[colId]}
    }));
  }

  onFilterChange(colId, value) {
    this.setState(prev => ({filters: {...prev.filters, [colId]: value}}));
  }

  onClearFilters() {
    this.setState({filters: ALL_COLUMNS.reduce((acc, col) => { acc[col.id] = ""; return acc; }, {})});
  }

  getFilteredEntries() {
    const {entries, filters} = this.state;
    const active = ALL_COLUMNS.filter(col => filters[col.id].length > 0);
    if (active.length === 0) return entries;
    return entries.filter(entry =>
      active.every(col =>
        getCellValue(entry, col.id).toLowerCase().includes(filters[col.id].toLowerCase())
      )
    );
  }

  hasActiveFilters() {
    return ALL_COLUMNS.some(col => this.state.filters[col.id].length > 0);
  }

  render() {
    const {sfHost} = this.props;
    const {userInfo, loading, error, visibleColumns, filters, limit} = this.state;
    const sfLink = "https://" + sfHost;
    const visibleCols = ALL_COLUMNS.filter(col => visibleColumns[col.id]);
    const filteredEntries = this.getFilteredEntries();
    const totalEntries = this.state.entries.length;

    return h("div", {},

      // ── Top banner ──────────────────────────────────────────────────────
      h("div", {id: "user-info"},
        h("a", {href: sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
        h("h1", {}, "Audit Trail"),
        h("span", {}, " / " + userInfo),
        h("div", {className: "flex-right"})
      ),

      // ── Controls area ───────────────────────────────────────────────────
      h("div", {className: "area"},
        h("div", {className: "col-toggle-row"},
          // Record limit selector
          h("label", {}, "Load:"),
          h("select", {
            value: limit,
            onChange: this.onLimitChange,
            disabled: loading,
            title: "Number of most-recent records to load",
          },
            LIMIT_OPTIONS.map(opt =>
              h("option", {key: opt.value, value: opt.value}, opt.label)
            )
          ),
          h("span", {style: {margin: "0 10px", color: "#dddbda"}}, "|"),
          // Column visibility toggles
          h("label", {}, "Columns:"),
          ALL_COLUMNS.map(col =>
            h("button", {
              key: col.id,
              className: "col-toggle-btn" + (visibleColumns[col.id] ? " highlighted" : ""),
              onClick: () => this.onToggleColumn(col.id),
              title: (visibleColumns[col.id] ? "Hide" : "Show") + " " + col.label,
            }, col.label)
          ),
          this.hasActiveFilters()
            ? h("button", {
                style: {marginLeft: "auto"},
                className: "cancel-btn",
                onClick: this.onClearFilters,
                title: "Remove all column filters",
              }, "Clear Filters")
            : null
        )
      ),

      // ── Error banner ────────────────────────────────────────────────────
      error
        ? h("div", {className: "area", style: {color: "#c23934", fontWeight: 600}}, error)
        : null,

      // ── Result area ─────────────────────────────────────────────────────
      !error && h("div", {id: "audit-result-area"},
        h("div", {className: "result-bar"},
          h("h1", {}, "Results"),
          !loading && h("span", {className: "result-info"},
            filteredEntries.length !== totalEntries
              ? filteredEntries.length + " of " + totalEntries + " records"
              : totalEntries + " record" + (totalEntries !== 1 ? "s" : "")
          )
        ),
        h("div", {id: "audit-table-wrap"},
          loading
            ? h("div", {style: {position: "relative", height: "120px"}},
                h("div", {
                  role: "status",
                  className: "slds-spinner slds-spinner_medium slds-spinner_brand",
                  style: {position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)"},
                },
                  h("span", {className: "slds-assistive-text"}, "Loading\u2026"),
                  h("div", {className: "slds-spinner__dot-a"}),
                  h("div", {className: "slds-spinner__dot-b"})
                )
              )
            : h("table", {id: "audit-table"},
                h("thead", {},
                  // Column headers
                  h("tr", {},
                    visibleCols.map(col => h("th", {key: col.id}, col.label))
                  ),
                  // Filter row
                  h("tr", {className: "filter-row"},
                    visibleCols.map(col =>
                      h("th", {key: col.id},
                        h("input", {
                          type: "text",
                          placeholder: "Filter\u2026",
                          value: filters[col.id],
                          onChange: e => this.onFilterChange(col.id, e.target.value),
                        })
                      )
                    )
                  )
                ),
                h("tbody", {},
                  filteredEntries.length === 0
                    ? h("tr", {},
                        h("td", {colSpan: visibleCols.length, className: "audit-no-results"},
                          "No records found."
                        )
                      )
                    : filteredEntries.map((entry, i) =>
                        h("tr", {key: entry.Id || i},
                          visibleCols.map(col => {
                            const val = getCellValue(entry, col.id);
                            return h("td", {key: col.id, title: val}, val);
                          })
                        )
                      )
                )
              )
        )
      ),

      // ── Footer note ─────────────────────────────────────────────────────
      h("p", {className: "audit-footer-note"},
        "The Audit Trail only tracks changes made in the last 6 months."
      )
    );
  }
}

let args = new URLSearchParams(location.search.slice(1));
let sfHost = args.get("host");
initButton(sfHost, true);
sfConn.getSession(sfHost).then(() => {
  ReactDOM.render(h(AuditTrailApp, {sfHost}), document.getElementById("root"));
});
