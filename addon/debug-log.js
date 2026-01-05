/* global React ReactDOM initButton */
import {sfConn, apiVersion} from "./inspector.js";
import {UserInfoModel, createSpinForMethod, PromptTemplate, Constants, isOptionEnabled} from "./utils.js";
import {PageHeader} from "./components/PageHeader.js";
import ConfirmModal from "./components/ConfirmModal.js";
import Toast from "./components/Toast.js";

const h = React.createElement;

class Model {
  constructor(sfHost) {
    this.sfHost = sfHost;
    this.orgName = sfHost.split(".")[0]?.toUpperCase() || "";
    this.spinnerCount = 0;

    this.userInfoModel = new UserInfoModel(createSpinForMethod(this));

    this.logs = [];
    this.selectedIds = new Set();
    this.filters = {userId: "", start: "", end: ""};
    this.previewLog = null; // {id, body, fileName}
    this.previewSearch = {term: "", liveTerm: "", index: 0, count: 0, _timer: 0};
    this.previewFilter = ""; // grep-like filter for log lines
    this.filterTemplates = [
      {label: "No filter", value: ""},
      {label: "USER_DEBUG", value: "USER_DEBUG"},
      {label: "Exceptions", value: "EXCEPTION_THROWN|FATAL_ERROR"},
      {label: "DML Operations", value: "DML_BEGIN|DML_END"},
      {label: "Limits", value: "LIMIT_USAGE|CUMULATIVE_LIMIT_USAGE"},
      {label: "Callouts", value: "CALLOUT_REQUEST|CALLOUT_RESPONSE"},
      {label: "Flow", value: "FLOW_CREATE_INTERVIEW|FLOW_START_INTERVIEW|FLOW_ELEMENT"},
      {label: "Validation Rules", value: "VALIDATION_RULE|VALIDATION_FORMULA"},
      {label: "USER_DEBUG + Exceptions", value: "USER_DEBUG|EXCEPTION_THROWN|FATAL_ERROR"},
    ];
    this._onPreviewKeyDown = (e) => {
      const key = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "f") {
        e.preventDefault();
        const inp = document.querySelector(".sfir-preview-search-input");
        if (inp) inp.focus();
      }
    };

    // Users cache for picklist and table rendering
    this.userMap = new Map(); // id -> name
    this.userOptions = []; // [{id, name}]
    this.resolvingUsers = new Set(); // avoid duplicate fetches for names

    // Action summary cache (logId -> {label})
    this.actionSummary = new Map();
    this.resolvingActions = new Set();

    // Log bodies cache (logId -> body text) for searching
    this.logBodies = new Map();

    // Column widths as percentages for better distribution
    this.columnWidths = {
      checkbox: "3%",
      user: "15%",
      operation: "15%",
      request: "6%",
      start: "11%",
      status: "6%",
      action: "14%",
      size: "7%",
      actions: "15%"
    };

    // Pagination for lazy loading
    const savedPageSize = parseInt(localStorage.getItem("debugLogPageSize"), 10);
    this.allowedPageSizes = [10, 15, 25, 50, 100];
    this.pageSize = this.allowedPageSizes.includes(savedPageSize) ? savedPageSize : 15;
    this.pageIndex = 0;
    this.offset = 0; // deprecated, kept for fallback
    this.hasMore = true;
    this.loadingMore = false;
    this.nextUrl = null;

    // Total count of logs for current filters
    this.totalCount = null; // null = unknown/not loaded, number otherwise
    this.countLoading = false; // true while COUNT() is in-flight

    // Toast notifications
    this.toast = null; // {variant: "success"|"error"|"info", title: string, message: string}

    // AI/Agentforce integration
    this.showAgentforceModal = false;
    this.agentforcePrompt = "";
    this.agentforceAnalysis = "";
    this.agentforceError = null;
    this.agentforceAnalyzing = false;
    this.agentforceCustomInstructions = ""; // Store custom instructions
    this.agentforceEditMode = false; // Toggle between read-only and edit mode

    // Preview loading state
    this.previewLoading = false;
    this.previewFilterProcessing = false; // Track when filter is being applied

    // Sorting state
    this.sortColumn = "StartTime"; // Default sort column
    this.sortDirection = "DESC"; // ASC or DESC

    // Toggle for fetching log bodies (for action details)
    const savedFetchBodies = localStorage.getItem("debugLogFetchBodies");
    this.fetchLogBodies = savedFetchBodies === null ? true : JSON.parse(savedFetchBodies);
    this.fetchBodiesSearchTerm = ""; // Search term for filtering logs when fetching bodies
  }

  didUpdate() {
    this.render();
  }

  showToast(variant, title, message, duration = 5000) {
    this.toast = {variant, title, message};
    this.didUpdate();
    if (duration > 0) {
      setTimeout(() => {
        this.toast = null;
        this.didUpdate();
      }, duration);
    }
  }

  closeToast() {
    this.toast = null;
    this.didUpdate();
  }

  // AI/Agentforce methods
  openAgentforce() {
    this.showAgentforceModal = true;
    this.agentforcePrompt = "";
    this.agentforceAnalysis = "";
    this.agentforceError = null;
    this.agentforceAnalyzing = false;
    this.agentforceEditMode = false;
    // Load custom instructions from localStorage or use default
    const savedInstructions = localStorage.getItem(this.sfHost + "_debugLogCustomInstructions");
    this.agentforceCustomInstructions = savedInstructions || this.getDefaultInstructions();
    this.didUpdate();
  }

  closeAgentforce() {
    this.showAgentforceModal = false;
    this.agentforcePrompt = "";
    this.agentforceAnalysis = "";
    this.agentforceError = null;
    this.agentforceAnalyzing = false;
    this.agentforceEditMode = false;

    // Set restoring flag to show spinner briefly when returning to preview
    // This prevents UI freeze when re-rendering large logs
    if (this.previewLog) {
      this.isRestoringPreview = true;
      setTimeout(() => {
        this.isRestoringPreview = false;
        this.didUpdate();
      }, 100);
    }

    this.didUpdate();
  }

  toggleAgentforceEditMode() {
    this.agentforceEditMode = !this.agentforceEditMode;
    this.didUpdate();
  }

  updateAgentforceInstructions(newInstructions) {
    this.agentforceCustomInstructions = newInstructions;
    // Save to localStorage
    localStorage.setItem(this.sfHost + "_debugLogCustomInstructions", newInstructions);
    this.didUpdate();
  }

  resetAgentforceInstructions() {
    const defaultInstructions = this.getDefaultInstructions();
    this.agentforceCustomInstructions = defaultInstructions;
    localStorage.removeItem(this.sfHost + "_debugLogCustomInstructions");
    this.didUpdate();
  }

  getDefaultInstructions() {
    return `Analyze this Salesforce debug log in detail and provide a comprehensive report with the following sections:

1. EXECUTIVE SUMMARY
   - What is the main action or transaction being executed?
   - What triggered this execution? (User action, trigger, scheduled job, API call, etc.)
   - Was the execution successful or did it fail?
   - Overall execution time and performance assessment

2. EXECUTION FLOW
   - List the main steps of execution in chronological order
   - Identify all classes, methods, and triggers that were invoked
   - Show the call stack and execution path
   - Highlight any significant decision points or branches

3. DATA OPERATIONS
   - SOQL Queries: List all queries, number of rows returned, and execution time
   - DML Operations: Identify all inserts, updates, deletes, and undeletes
   - Records affected: How many records were queried or modified?
   - Any bulk operations or batch processing?

4. ERRORS & EXCEPTIONS
   - Identify all errors, exceptions, and failures
   - For each error: provide the error message, line number, and context
   - Explain the root cause of each error
   - Stack trace analysis if available

5. PERFORMANCE ANALYSIS
   - Total execution time
   - Identify slow queries or operations (>100ms)
   - CPU time consumption
   - Database time vs CPU time ratio
   - Any governor limit warnings or usage concerns

6. GOVERNOR LIMITS USAGE
   - SOQL queries used vs limit
   - DML statements used vs limit
   - Heap size used vs limit
   - CPU time used vs limit
   - Any limits that are close to being exceeded (>70%)

7. BEST PRACTICES & RECOMMENDATIONS
   - Code optimization suggestions
   - Performance improvement opportunities
   - Potential bulkification issues
   - Security or design pattern concerns
   - Suggested fixes for any identified problems

8. DEBUG STATEMENTS
   - List all USER_DEBUG statements with their values
   - Highlight any important debug information
   - Trace variable values and state changes

Please structure your response in a clear, organized manner using these sections. Be specific, cite line numbers when relevant, and provide actionable insights.`;
  }

  async sendAgentforceAnalysis() {
    const instructions = this.agentforceCustomInstructions || this.getDefaultInstructions();

    this.agentforceAnalyzing = true;
    this.agentforceError = null;
    this.agentforceAnalysis = "";
    this.didUpdate();

    try {
      const promptTemplateName = localStorage.getItem(this.sfHost + "_debugLogAgentForcePrompt");
      const templateName = promptTemplateName || Constants.PromptTemplateDebugLog;
      const promptTemplate = new PromptTemplate(templateName);

      // Use filtered log content if filter is active, otherwise full log
      const logContent = this.previewFilter
        ? this.getFilteredLogBody()
        : (this.previewLog?.body || "");

      const result = await promptTemplate.generate({
        Instructions: instructions,
        LogContent: logContent.substring(0, 50000) // Limit to 50K chars to avoid API limits
      });

      if (result.success) {
        // Extract analysis from the result
        const analysisMatch = result.result.match(/<logAnalysis>([\s\S]*?)<\/logAnalysis>/);
        const extractedAnalysis = analysisMatch ? analysisMatch[1].trim() : result.result;

        this.agentforceAnalysis = extractedAnalysis;
        this.agentforceError = null;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.agentforceError = "Agentforce analysis failed: " + error.message;
      this.agentforceAnalysis = "";
    } finally {
      this.agentforceAnalyzing = false;
      this.didUpdate();
    }
  }

  async init() {
    await sfConn.getSession(this.sfHost);
    await this.populatePicklistFromAllLogs();
    await this.fetchLogs(true);
  }

  async populatePicklistFromAllLogs() {
    this.spinnerCount++;
    try {
      // Gather all distinct LogUserId and LogUser.Name from all logs (no filters)
      // Using relationship query to get both ID and Name in a single query
      const map = new Map();
      let url = `/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent("SELECT LogUserId, LogUser.Name FROM ApexLog WHERE LogUserId != null");
      while (url) {
        const res = await sfConn.rest(url);
        (res.records || []).forEach(r => {
          if (r.LogUserId && r.LogUser) {
            // LogUser.Name might be null if user doesn't exist, but LogUserId is still valid
            const userName = r.LogUser.Name || r.LogUserId;
            map.set(r.LogUserId, userName);
          } else if (r.LogUserId) {
            // Fallback: if LogUser relationship is null but LogUserId exists, use ID as name
            map.set(r.LogUserId, r.LogUserId);
          }
        });
        url = res.nextRecordsUrl || null;
      }
      this.userMap = map;
      this.userOptions = Array.from(map, ([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name));
      this.didUpdate();
    } catch (e) {
      console.error("populatePicklistFromAllLogs.root", e);
    } finally {
      this.spinnerCount--;
    }
  }

  refreshAll() {
    // Rebuild picklist from all logs, then reload current page with fresh count
    (async () => {
      await this.populatePicklistFromAllLogs();
      await this.fetchLogs(true);
    })();
  }

  buildWhereClause() {
    const where = [];
    if (this.filters.userId) where.push(`LogUserId='${this.filters.userId}'`);
    if (this.filters.start) where.push(`StartTime>=${new Date(this.filters.start).toISOString()}`);
    if (this.filters.end) where.push(`StartTime<=${new Date(this.filters.end).toISOString()}`);
    return where.length ? ` WHERE ${where.join(" AND ")}` : "";
  }

  handleSort(column) {
    // Map display column names to field names
    const columnMap = {
      "User": "LogUserId",
      "Action": "Operation",
      "Operation": "Operation",
      "Request": "Request",
      "Start Time": "StartTime",
      "Status": "Status",
      "Size (MB)": "LogLength"
    };

    const sortField = columnMap[column];
    if (!sortField) return;

    // Toggle direction if clicking the same column, otherwise default to ASC
    if (this.sortColumn === sortField) {
      this.sortDirection = this.sortDirection === "ASC" ? "DESC" : "ASC";
    } else {
      this.sortColumn = sortField;
      this.sortDirection = "ASC";
    }

    // Sort the logs array in memory
    this.sortLogs();
    this.didUpdate();
  }

  sortLogs() {
    if (!this.logs || this.logs.length === 0) return;

    const sortField = this.sortColumn;
    const direction = this.sortDirection === "ASC" ? 1 : -1;

    this.logs.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle derived fields
      if (sortField === "LogUserId") {
        aVal = this.userMap.get(aVal) || aVal || "";
        bVal = this.userMap.get(bVal) || bVal || "";
      } else if (sortField === "Operation") {
        aVal = (this.actionSummary.get(a.Id)?.label) || aVal || "";
        bVal = (this.actionSummary.get(b.Id)?.label) || bVal || "";
      }

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Auto-detect type and convert
      const aDate = new Date(aVal).getTime();
      const bDate = new Date(bVal).getTime();
      if (!isNaN(aDate) && !isNaN(bDate) && aDate !== bDate) {
        return (aDate < bDate ? -1 : 1) * direction;
      }

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) {
        return (aNum < bNum ? -1 : 1) * direction;
      }

      // String comparison
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * direction;
    });
  }

  async fetchLogs(rebuildUsers = false, reset = true) {
    this.spinnerCount++;
    try {
      if (reset) {
        this.pageIndex = 0;
        this.logs = [];
        this.hasMore = true;
        this.nextUrl = null;
        this.totalCount = null;
        this.countLoading = true;
      }
      const whereClause = this.buildWhereClause();
      const soql = `SELECT Id, Operation, Request, Status, StartTime, LogUserId, Application, Location, LogLength FROM ApexLog${whereClause} ORDER BY StartTime DESC LIMIT ${this.pageSize} OFFSET ${this.pageIndex * this.pageSize}`;
      const query = `/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql);
      const res = await sfConn.rest(query);
      const batch = res.records || [];
      this.logs = batch;

      // Apply current sort to the loaded logs
      this.sortLogs();

      // Seed/refresh action summary for new items
      for (const l of batch) {
        const base = parseAction(l.Operation);
        this.actionSummary.set(l.Id, base);
      }

      // Rebuild users list (names + picklist) only when resetting or filters changed
      if (rebuildUsers) {
        await this.buildUsersFromLogs(this.logs);
      }

      // If we reset (filters changed), also fetch the total count with identical filters
      if (reset) {
        try {
          const countSoql = `SELECT COUNT() FROM ApexLog${whereClause}`;
          const countQuery = `/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(countSoql);
          const countRes = await sfConn.rest(countQuery);
          // For COUNT() queries, totalSize holds the count
          this.totalCount = typeof countRes.totalSize === "number" ? countRes.totalSize : 0;
        } catch (e) {
          console.error("fetchLogs.count", e);
          this.totalCount = null; // unknown; UI will omit total and pagination falls back to page size heuristic
        } finally {
          this.countLoading = false;
        }
      }

      // Pagination info: prefer precise computation from totalCount if available
      if (this.totalCount != null) {
        this.hasMore = ((this.pageIndex + 1) * this.pageSize) < this.totalCount;
      } else {
        // Fallback: infer from page size
        this.hasMore = batch.length === this.pageSize;
      }

      // Only fetch log bodies if toggle is enabled
      if (this.fetchLogBodies) {
        this.resolveActionsFromBodiesLimited(Math.min(this.pageSize, batch.length));
      }
    } catch (e) {
      console.error("fetchLogs", e);
      if (reset) this.logs = [];
      this.hasMore = false;
      this.nextUrl = null;
      if (reset) this.countLoading = false;
    } finally {
      this.spinnerCount--;
      this.didUpdate();
    }
  }

  async buildUsersFromLogs(logs) {
    // Collect unique user ids from logs
    const ids = Array.from(new Set((logs || []).map(l => l.LogUserId).filter(Boolean)));
    if (ids.length === 0) {
      // Keep existing options; just clear map for missing logs is not helpful, so do not wipe picklist
      return;
    }

    const idChunks = [];
    for (let i = 0; i < ids.length; i += 200) idChunks.push(ids.slice(i, i + 200));
    const map = new Map();
    for (const chunk of idChunks) {
      const soql = `SELECT Id, Name FROM User WHERE Id IN (${chunk.map(id => `'${id}'`).join(",")})`;
      try {
        const res = await sfConn.rest(`/services/data/v${apiVersion}/query/?q=` + encodeURIComponent(soql));
        (res.records || []).forEach(u => map.set(u.Id, u.Name));
      } catch (e) {
        console.error("buildUsersFromLogs", e);
      }
    }
    // Merge into existing userMap to avoid losing known users
    const merged = new Map(this.userMap);
    for (const [id, name] of map) merged.set(id, name);
    this.userMap = merged;

    // Only initialize or extend picklist; never shrink it based on current logs
    if (!Array.isArray(this.userOptions) || this.userOptions.length === 0) {
      this.userOptions = Array.from(merged, ([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const existingIds = new Set(this.userOptions.map(o => o.id));
      const additions = Array.from(map, ([id, name]) => ({id, name})).filter(o => !existingIds.has(o.id));
      if (additions.length) {
        this.userOptions = this.userOptions.concat(additions).sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  }

  async resolveActionsFromBodiesLimited(limit = 50) {
    const slice = this.logs.slice(0, limit);
    for (const log of slice) {
      try {
        const xhr = await sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/ApexLog/${log.Id}/Body`, {responseType: "blob"}, true);
        const text = await xhr.response.text();
        // Store log body for searching
        this.logBodies.set(log.Id, text);
        const detail = deriveActionFromBody(text) || parseAction(log.Operation);
        this.actionSummary.set(log.Id, detail);
        this.didUpdate();
      } catch (e) {
        // leave the seeded value
      }
    }
  }

  ensureActionDerived(log) {

    const current = this.actionSummary.get(log.Id);
    if (current && current.label && current.label !== "CODE_UNIT_STARTED" && current.label !== "-") {
      return;
    }
    if (this.resolvingActions.has(log.Id)) return;
    this.resolvingActions.add(log.Id);
    sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/ApexLog/${log.Id}/Body`, {responseType: "blob"}, true)
      .then(xhr => xhr.response.text())
      .then(text => {
        // Store log body for searching
        this.logBodies.set(log.Id, text);
        const detail = deriveActionFromBody(text) || parseAction(log.Operation);
        this.actionSummary.set(log.Id, detail);
        this.didUpdate(); // Trigger re-render to update filtered results
      })
      .catch(() => { /* ignore */ })
      .finally(() => {
        this.resolvingActions.delete(log.Id);
        this.didUpdate();
      });
  }

  ensureUserName(id) {
    if (!id) return;
    if (this.userMap.has(id) || this.resolvingUsers.has(id)) return;
    this.resolvingUsers.add(id);
    (async () => {
      try {
        const soql = `SELECT Id, Name FROM User WHERE Id='${id}'`;
        const res = await sfConn.rest(`/services/data/v${apiVersion}/query/?q=` + encodeURIComponent(soql));
        const rec = (res.records || [])[0];
        if (rec && rec.Id) {
          // update map
          this.userMap.set(rec.Id, rec.Name);
          // extend picklist options without shrinking
          if (!this.userOptions.find(o => o.id === rec.Id)) {
            this.userOptions = this.userOptions.concat([{id: rec.Id, name: rec.Name}]).sort((a, b) => a.name.localeCompare(b.name));
          }
          this.didUpdate();
        }
      } catch (e) {
        // ignore; keep showing ID
      } finally {
        this.resolvingUsers.delete(id);
      }
    })();
  }

  toggleSelect(id, checked) {
    if (checked) this.selectedIds.add(id); else this.selectedIds.delete(id);
    this.didUpdate();
  }

  toggleSelectAll(checked) {
    if (checked) {
      this.selectedIds = new Set(this.logs.map(l => l.Id));
    } else {
      this.selectedIds.clear();
    }
    this.didUpdate();
  }

  async deleteSelected() {
    if (this.selectedIds.size === 0) return;
    const count = this.selectedIds.size;
    this.spinnerCount++;
    try {
      const ids = Array.from(this.selectedIds);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        await sfConn.rest(`/services/data/v${apiVersion}/composite/sobjects?ids=${chunk.join(",")}&allOrNone=false`, {method: "DELETE"});
      }
      this.selectedIds.clear();
      await this.fetchLogs(true);
      this.showToast("success", "Logs Deleted", `Successfully deleted ${count} log${count > 1 ? "s" : ""}.`);
    } catch (e) {
      console.error("deleteSelected", e);
      this.showToast("error", "Delete Failed", `Failed to delete selected logs: ${e.message || "Unknown error"}`);
    } finally {
      this.spinnerCount--;
      this.didUpdate();
    }
  }

  async deleteOne(id) {
    this.spinnerCount++;
    try {
      await sfConn.rest(`/services/data/v${apiVersion}/sobjects/ApexLog/${id}`, {method: "DELETE"});
      this.selectedIds.delete(id);
      await this.fetchLogs(true);
      this.showToast("success", "Log Deleted", "Successfully deleted the log.");
    } catch (e) {
      console.error("deleteOne", e);
      this.showToast("error", "Delete Failed", `Failed to delete log: ${e.message || "Unknown error"}`);
    } finally {
      this.spinnerCount--;
      this.didUpdate();
    }
  }

  async getLogBodyText(id) {
    // Check if body is already cached
    const cachedBody = this.logBodies.get(id);
    if (cachedBody) {
      return cachedBody;
    }

    // Fetch from API
    const xhr = await sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/ApexLog/${id}/Body`, {responseType: "blob"}, true);
    const blob = xhr.response;
    const text = await blob.text();
    // Cache the body for future use
    this.logBodies.set(id, text);
    return text;
  }

  async preview(id) {
    this.previewLoading = true;
    this.previewLog = {id, body: "", fileName: `${id}.log`}; // Show modal immediately with loading state
    this.didUpdate();

    // Check if body is already cached for instant display
    const cachedBody = this.logBodies.get(id);
    if (cachedBody) {
      this.previewLog = {id, body: cachedBody, fileName: `${id}.log`};
      this.previewSearch = {term: "", liveTerm: "", index: 0, count: 0, _timer: 0};
      this.previewFilter = ""; // Reset filter when opening new log
      this.previewLoading = false;
      window.addEventListener("keydown", this._onPreviewKeyDown, true);
      setTimeout(() => {
        const inp = document.querySelector(".sfir-preview-search-input");
        if (inp) inp.focus();
      }, 0);
      this.didUpdate();
      return;
    }

    this.spinnerCount++;
    try {
      const text = await this.getLogBodyText(id);
      this.previewLog = {id, body: text, fileName: `${id}.log`};
      this.previewSearch = {term: "", liveTerm: "", index: 0, count: 0, _timer: 0};
      this.previewFilter = ""; // Reset filter when opening new log
      window.addEventListener("keydown", this._onPreviewKeyDown, true);
      setTimeout(() => {
        const inp = document.querySelector(".sfir-preview-search-input");
        if (inp) inp.focus();
      }, 0);
    } catch (e) {
      console.error("preview", e);
      this.previewLog = {id, body: "Error loading log", fileName: `${id}.log`};
    } finally {
      this.previewLoading = false;
      this.spinnerCount--;
      this.didUpdate();
    }
  }

  closePreview() {
    this.previewLog = null;
    // Reset search state completely when closing preview
    this.previewSearch = {term: "", liveTerm: "", index: 0, count: 0, _timer: 0};
    this.previewFilter = "";
    // Clear cached processed body
    this._cachedProcessedBody = null;
    this._cachedFilteredBody = null;
    if (this.previewSearch && this.previewSearch._timer) {
      clearTimeout(this.previewSearch._timer);
    }
    window.removeEventListener("keydown", this._onPreviewKeyDown, true);
    this.didUpdate();
  }

  applyPreviewFilter(filterText) {
    // Show loading state immediately
    this.previewFilterProcessing = true;
    this.previewFilter = filterText;
    // Clear cache when filter changes
    this._cachedProcessedBody = null;
    this._cachedFilteredBody = null;
    this.didUpdate();

    // Process filter change asynchronously to avoid blocking UI
    setTimeout(() => {
      try {
        // Reset search when filter changes
        this.previewSearch = {term: "", liveTerm: "", index: 0, count: 0, _timer: 0};
        this.previewFilterProcessing = false;
        this.didUpdate();
      } catch (e) {
        console.error("applyPreviewFilter", e);
        this.previewFilterProcessing = false;
        this.didUpdate();
      }
    }, 50); // Small delay to let UI update with spinner first
  }

  getFilteredLogBody() {
    if (!this.previewLog || !this.previewLog.body) return "";
    if (!this.previewFilter) return this.previewLog.body;

    const lines = this.previewLog.body.split("\n");
    const patterns = this.previewFilter.split("|").map(p => p.trim()).filter(Boolean);

    if (patterns.length === 0) return this.previewLog.body;

    const filteredLines = lines.filter(line => patterns.some(pattern => line.includes(pattern)));

    return filteredLines.join("\n");
  }

  // Debounced search update to keep typing smooth in preview
  updatePreviewSearchTermLive(term){
    if (!this.previewSearch) this.previewSearch = {term: "", liveTerm: "", index: 0, count: 0, _timer: 0};
    this.previewSearch.liveTerm = term || "";
    if (this.previewSearch._timer) clearTimeout(this.previewSearch._timer);
    this.previewSearch._timer = setTimeout(() => {
      // Commit the term and reset selection, then re-render to rebuild highlights
      this.previewSearch.term = this.previewSearch.liveTerm;
      this.previewSearch.index = 0;
      this.didUpdate();
    }, 200);
  }

  nextPreviewMatch(){
    const cnt = this.previewSearch.count;
    if (!cnt) return;
    this.previewSearch.index = (this.previewSearch.index + 1) % cnt;
    // Just scroll to the element without re-rendering
    this._scrollToCurrentMatch();
  }
  prevPreviewMatch(){
    const cnt = this.previewSearch.count;
    if (!cnt) return;
    this.previewSearch.index = (this.previewSearch.index - 1 + cnt) % cnt;
    // Just scroll to the element without re-rendering
    this._scrollToCurrentMatch();
  }

  _scrollToCurrentMatch() {
    // Update the current highlight class without re-rendering the whole component
    const allMarks = document.querySelectorAll(".sfir-highlight");
    allMarks.forEach((mark, idx) => {
      if (idx === this.previewSearch.index) {
        mark.classList.add("current");
        mark.id = "sfir-current-match";
        mark.scrollIntoView({block: "center", behavior: "smooth"});
      } else {
        mark.classList.remove("current");
        if (mark.id === "sfir-current-match") {
          mark.removeAttribute("id");
        }
      }
    });
    // Force update just the counter display
    const counterEl = document.querySelector(".sfir-search-counter");
    if (counterEl) {
      counterEl.textContent = `${this.previewSearch.index + 1} / ${this.previewSearch.count}`;
    }
  }

  download(id) {
    // Fetch blob via authenticated REST, then save
    (async () => {
      try {
        const text = await this.getLogBodyText(id);
        const blob = new Blob([text], {type: "text/plain"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${id}.log`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("download", e);
      }
    })();
  }

  share(id) {
    const log = this.logs.find(l => l.Id === id);
    if (!log) return;
    (async () => {
      try {
        const text = await this.getLogBodyText(id);
        const blob = new Blob([text], {type: "text/plain"});

        const action = (this.actionSummary.get(id) || parseAction(log.Operation) || {label: id}).label || id;
        const start = new Date(log.StartTime).toLocaleString();
        let subject = `[SF Debug Log] ${action} - ${start}`;
        if (subject.length > 150) subject = subject.slice(0, 147) + "...";
        const fileName = `${id}.log`;

        // Prefer Web Share API with file attachment when available (no compression)
        try {
          const file = new File([blob], fileName, {type: "text/plain"});
          if (navigator && navigator.canShare && navigator.canShare({files: [file]})) {
            await navigator.share({title: subject, text: "", files: [file]});
            return;
          }
        } catch (_) {
          // Ignore and try text-only share below
        }

        // Secondary attempt: Web Share without files (opens native share sheet on some desktops)
        try {
          if (navigator && typeof navigator.share === "function") {
            await navigator.share({title: subject, text: `Salesforce debug log: ${fileName}`});
            return;
          }
        } catch (_) {
          // User canceled or unsupported; continue to fallback
        }

        // Fallback: generate a .eml draft with the original log attached (no compression)
        try {
          const toBase64 = async (b) => {
            const buf = await b.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const chunk = 0x8000;
            let binary = "";
            for (let i = 0; i < bytes.length; i += chunk) {
              binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
            }
            return btoa(binary);
          };
          const encodeHeader = (s) => `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
          const boundary = `----sfir_${Math.random().toString(36).slice(2)}`;
          const base64 = await toBase64(blob);
          const CRLF = "\r\n";
          const emlParts = [
            "MIME-Version: 1.0",
            `Subject: ${encodeHeader(subject)}`,
            `Content-Type: multipart/mixed; boundary=\"${boundary}\"`,
            "",
            `--${boundary}`,
            "Content-Type: text/plain; charset=UTF-8",
            "Content-Transfer-Encoding: 7bit",
            "",
            `Attached Salesforce debug log: ${fileName}.`,
            "",
            `--${boundary}`,
            `Content-Type: text/plain; name=\"${fileName}\"`,
            "Content-Transfer-Encoding: base64",
            `Content-Disposition: attachment; filename=\"${fileName}\"`,
            "",
            base64,
            `--${boundary}--`,
            ""
          ].join(CRLF);

          const emlBlob = new Blob([emlParts], {type: "message/rfc822"});
          const url = URL.createObjectURL(emlBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${id}.eml`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          return;
        } catch (_) {
          // If EML generation fails, fall back to simple download + mailto subject only
        }

        // Legacy fallback: download the original file and open a mail draft with subject only
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}`;
      } catch (e) {
        console.error("share", e);
      }
    })();
  }

  nextPage() {
    if (!this.hasMore) return;
    this.pageIndex++;
    this.fetchLogs(true, false); // rebuild users for the new page
  }
  prevPage() {
    if (this.pageIndex === 0) return;
    this.pageIndex--;
    this.fetchLogs(true, false); // rebuild users for the new page
  }

  setPageSize(size) {
    const n = parseInt(size, 10);
    if (!this.allowedPageSizes.includes(n) || n === this.pageSize) return;
    this.pageSize = n;
    localStorage.setItem("debugLogPageSize", String(n));
    this.pageIndex = 0;
    this.fetchLogs(true, true);
  }

  toggleFetchLogBodies() {
    this.fetchLogBodies = !this.fetchLogBodies;
    localStorage.setItem("debugLogFetchBodies", JSON.stringify(this.fetchLogBodies));
    // Clear search term when disabling
    if (!this.fetchLogBodies) {
      this.fetchBodiesSearchTerm = "";
    }
    this.didUpdate();
  }

  getFilteredLogs() {
    // If search is disabled or no search term, return all logs
    if (!this.fetchLogBodies || !this.fetchBodiesSearchTerm || this.fetchBodiesSearchTerm.trim() === "") {
      return this.logs;
    }

    const searchTerm = this.fetchBodiesSearchTerm.toLowerCase().trim();
    return this.logs.filter(log => {
      const body = this.logBodies.get(log.Id);
      if (!body) {
        // If body not loaded yet, include it (will be filtered once body is loaded)
        return true;
      }
      return body.toLowerCase().includes(searchTerm);
    });
  }
}

function parseAction(operation) {
  if (!operation) return {label: "-"};
  const op = operation.trim();
  if (op === "CODE_UNIT_STARTED") return {label: "-"};
  let type = op,
    name = "";
  if (op.includes("/")) {
    [type, name] = op.split("/", 2);
  } else if (op.includes(":")) {
    [type, name] = op.split(":", 2);
  }
  type = (type || "").trim();
  name = (name || "").trim();
  return {label: name ? `${type} · ${name}` : type || "-"};
}

// Try to extract a clearer action (CODE_UNIT_STARTED preferred; fallback to METHOD_ENTRY or Flow markers)
function deriveActionFromBody(text) {
  if (!text) return null;

  // 1. PRIORITY: Look for apex:// actions (LWC/Aura) in CODE_UNIT_STARTED
  // Match: CODE_UNIT_STARTED|[EXTERNAL]|apex://ClassName/ACTION$methodName
  const apexAction = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|[^\|]*\|apex:\/\/([A-Za-z0-9_]+)\/ACTION\$([A-Za-z0-9_]+)/m);
  if (apexAction) {
    return {label: `${apexAction[1]}.${apexAction[2]}`};
  }

  // 2a. VFRemote and similar patterns with ID in 3rd field and description in 4th
  // Match: CODE_UNIT_STARTED|[EXTERNAL]|<ID>|VFRemote: ClassName invoke(methodName)
  // Match: CODE_UNIT_STARTED|[EXTERNAL]|<ID>|ClassName.methodName(params)
  const codeUnitWithIdAndDesc = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|[^\|]*\|[0-9a-zA-Z]{15,18}\|(.+?)$/m);
  if (codeUnitWithIdAndDesc) {
    const description = codeUnitWithIdAndDesc[1].trim();

    // Handle VFRemote pattern: "VFRemote: ClassName invoke(methodName)"
    const vfRemoteMatch = description.match(/^VFRemote:\s*([A-Za-z0-9_]+)\s+invoke\(([A-Za-z0-9_]+)\)/);
    if (vfRemoteMatch) {
      return {label: `VFRemote · ${vfRemoteMatch[1]}.${vfRemoteMatch[2]}`};
    }

    // Handle standard signature: "ClassName.methodName(params)"
    const standardSig = description.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\(/);
    if (standardSig) {
      const cls = standardSig[1];
      const method = standardSig[2];
      if (method === cls) {
        return {label: `${cls} (constructor)`};
      }
      return {label: `${cls}.${method}`};
    }

    // If none of the above matched, return the full description
    if (description && description !== "TRIGGERS" && !description.startsWith("[")) {
      return {label: description};
    }
  }

  // 2b. Look for CODE_UNIT_STARTED with full signature: Class.Method(params)
  // Use ^ and \d to match at line start with timestamp to avoid matching other event types
  // Handles both 3-field and 4-field variants (with/without ID)
  const codeUnitWithSignature = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|[^\|]*\|(?:[^\|]*\|)?([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\([^\)]*\)/m);
  if (codeUnitWithSignature) {
    const cls = codeUnitWithSignature[1];
    const method = codeUnitWithSignature[2];
    // If method name equals class name, it's a constructor
    if (method === cls) {
      return {label: `${cls} (constructor)`};
    }
    return {label: `${cls}.${method}`};
  }

  // 3. Trigger entries (multi-field variant) - CHECK BEFORE generic class name pattern
  // Example:
  //   ...|CODE_UNIT_STARTED|[EXTERNAL]|01q...|MyTrigger on Object__c trigger event BeforeUpdate|__sfdc_trigger/MyTrigger
  //   ...|CODE_UNIT_STARTED|[EXTERNAL]|TRIGGERS
  // Try to capture descriptive text and the trigger name from the __sfdc_trigger path in one go
  let triggerDetail = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|[^\|]*\|[^\|]*\|([^|\n]+?)\|__sfdc_trigger\/([A-Za-z0-9_]+)/im);
  if (triggerDetail) {
    const desc = triggerDetail[1].trim();
    const trigFromPath = triggerDetail[2];
    // Pattern: <TriggerName> on <Object> trigger event <Event>
    const m = desc.match(/^([A-Za-z0-9_]+)\s+on\s+([A-Za-z0-9_]+)\s+trigger\s+event\s+([A-Za-z]+)$/i);
    if (m) {
      const trigName = m[1] || trigFromPath;
      const ev = m[3];
      return {label: `Trigger · ${trigName} (${ev})`};
    }
    // Fallback: try to extract just the event and use path name as trigger name
    const m2 = desc.match(/trigger\s+event\s+([A-Za-z]+)/i);
    if (m2) {
      const ev = m2[1];
      const namePart = (desc.replace(/\s*trigger\s+event\s+[A-Za-z]+/i, "").trim()) || trigFromPath;
      return {label: `Trigger · ${namePart} (${ev})`};
    }
    // Final fallback: at least show the trigger name from the path
    return {label: `Trigger · ${trigFromPath}`};
  }
  // If the combined pattern didn't match, still try to get the name from the path anywhere in the text
  const triggerNameOnly = text.match(/__sfdc_trigger\/([A-Za-z0-9_]+)/i);
  if (triggerNameOnly) {
    return {label: `Trigger · ${triggerNameOnly[1]}`};
  }

  // 4. Look for CODE_UNIT_STARTED with just a class name (no method signature)
  // This catches trigger handlers and other classes where only the class name appears
  const codeUnitClassName = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|[^\|]*\|(?:[^\|]*\|)?([A-Za-z0-9_]+)(?:\||$)/m);
  if (codeUnitClassName) {
    const className = codeUnitClassName[1];
    // Make sure it's not a special keyword or path (those are handled by other patterns)
    if (className && !["TRIGGERS", "EXTERNAL"].includes(className) && !className.includes(".")) {
      return {label: className};
    }
  }

  // 5. Fallback to METHOD_ENTRY lines: "...|METHOD_ENTRY|[line]|classId|Class.Method(params)"
  const methodEntry = text.match(/\bMETHOD_ENTRY\|[^\|]*\|[^\|]*\|([A-Za-z0-9_\.]+)\(.*?\)/);
  if (methodEntry && methodEntry[1]) {
    const full = methodEntry[1];
    const parts = full.split(".");

    if (parts.length >= 2) {
      const method = parts.pop();
      const cls = parts.pop();
      // If method name equals class name, it's a constructor
      if (method === cls) {
        return {label: `${cls} (constructor)`};
      }
      return {label: `${cls}.${method}`};
    }
    return {label: full};
  }

  // 6. Look for Execute Anonymous: CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex (no ID field)
  const executeAnon = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|\[EXTERNAL\]\|execute_anonymous_apex/m);
  if (executeAnon) {
    return {label: "execute_anonymous_apex"};
  }

  // 7. Look for other CODE_UNIT_STARTED entries
  // Try to capture the more descriptive fourth field first, then fallback to the third
  // Use ^ and \d to match at line start with timestamp to avoid matching other event types
  const codeUnitFourth = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|[^\|]*\|[^\|]*\|([^\|\n]+)/m);
  const codeUnitThird = text.match(/^\d+[^\|]*\|CODE_UNIT_STARTED\|[^\|]*\|([^\|\n]+)/m);
  const unit = (codeUnitFourth && codeUnitFourth[1].trim()) || (codeUnitThird && codeUnitThird[1].trim());
  if (unit) {
    // Trigger-like description (when not captured by the specific pattern above)
    if (/\btrigger\s+event\b/i.test(unit)) {
      const m = unit.match(/^([A-Za-z0-9_]+)\s+on\s+([A-Za-z0-9_]+)\s+trigger\s+event\s+([A-Za-z]+)$/i);
      if (m) {
        return {label: `Trigger · ${m[1]} (${m[3]})`};
      }
      const evOnly = unit.match(/trigger\s+event\s+([A-Za-z]+)/i);
      if (evOnly) {
        const ev = evOnly[1];
        const namePart = unit.replace(/\s*trigger\s+event\s+[A-Za-z]+/i, "").trim();
        return {label: `Trigger · ${namePart || "-"} (${ev})`};
      }
      return {label: `Trigger · ${unit}`};
    }

    // Class with dot notation ("Class.ClassName.Method")
    if (/^Class[\.:]/i.test(unit)) {
      const withoutPrefix = unit.replace(/^Class[\.:]/i, "");
      const parts = withoutPrefix.split(".");
      const method = parts[parts.length - 1];
      const className = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      return {label: method && method !== className ? `${className}.${method}` : className};
    }

    // Flow
    if (/^Flow[:\.]?/i.test(unit)) {
      const name = unit.split(/[:\.]/)[1] || unit.replace(/^Flow[:\.]?/i, "");
      return {label: `Flow · ${name}`};
    }

    return {label: unit};
  }

  // 8. Look for FLOW start lines
  const flowMatch = text.match(/FLOW_(?:START|CREATE)_INTERVIEW[^\|]*\|([^\n\|]+)/);
  if (flowMatch) {
    return {label: `Flow · ${flowMatch[1].trim()}`};
  }

  return null;
}

// Generic SLDS Picklist (combobox) component
class SldsPicklist extends React.Component {
  constructor(props){
    super(props);
    this.state = {open: false};
    this.toggle = this.toggle.bind(this);
    this.onSelect = this.onSelect.bind(this);
  }
  toggle(e){
    e && e.preventDefault();
    this.setState({open: !this.state.open});
  }
  onSelect(value){
    const {onChange} = this.props;
    this.setState({open: false}, () => onChange && onChange(value));
  }
  render(){
    const {label, value, options = [], placeholder = "Select"} = this.props;
    const selected = options.find(o => o.value === value);
    const display = selected ? selected.label : placeholder;
    const comboClass = `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-combobox-picklist ${this.state.open ? "slds-is-open" : ""}`;
    return h("div", {className: "slds-form-element"},
      label ? h("label", {className: "slds-form-element__label"}, label) : null,
      h("div", {className: "slds-form-element__control"},
        h("div", {className: "slds-combobox_container"},
          h("div", {className: comboClass, role: "combobox", "aria-expanded": this.state.open, "aria-haspopup": "listbox"},
            h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_left slds-input-has-icon_right", role: "none"},
              // Left user icon
              h("span", {className: "slds-icon_container slds-input__icon slds-input__icon_left"},
                h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
                  h("use", {xlinkHref: "symbols.svg#user"})
                )
              ),
              h("input", {className: "slds-input slds-combobox__input", value: display, readOnly: true, role: "textbox", "aria-controls": "user-picklist", onClick: this.toggle}),
              h("span", {className: "slds-icon_container slds-input__icon slds-input__icon_right"},
                h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
                  h("use", {xlinkHref: "symbols.svg#down"})
                )
              )
            ),
            h("div", {className: "slds-dropdown slds-dropdown_length-5 slds-dropdown_fluid", role: "listbox", id: "user-picklist"},
              h("ul", {className: "slds-listbox slds-listbox_vertical slds-dropdown__list", role: "presentation"},
                ...options.map(opt => h("li", {key: opt.value, role: "presentation", className: "slds-listbox__item"},
                  h("div", {className: "slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta", role: "option", onClick: () => this.onSelect(opt.value)},
                    h("span", {className: "slds-media__figure slds-listbox__option-icon"},
                      h("span", {className: "slds-icon_container"},
                        h("svg", {className: "slds-icon slds-icon_small slds-icon-text-default", "aria-hidden": "true"},
                          h("use", {xlinkHref: "symbols.svg#user"})
                        )
                      )
                    ),
                    h("span", {className: "slds-media__body"},
                      h("span", {className: "slds-listbox__option-text slds-truncate", title: opt.label}, opt.label)
                    )
                  )
                ))
              )
            )
          )
        )
      )
    );
  }
}

function Filters({model}) {
  const onUserPick = (val) => {
    model.filters.userId = val;
    model.fetchLogs(true); // rebuild users to resolve names; picklist stays intact (we don't shrink it)
  };
  const onStartChange = (e) => { model.filters.start = e.target.value; };
  const onEndChange = (e) => { model.filters.end = e.target.value; };
  const apply = (e) => { e.preventDefault(); model.fetchLogs(true); };
  const reset = (e) => { e.preventDefault(); model.filters = {userId: "", start: "", end: ""}; model.fetchLogs(true); };

  const userOptions = [{value: "", label: "All users"}, ...model.userOptions.map(u => ({value: u.id, label: u.name}))];

  return h("form", {className: "slds-grid slds-gutters slds-m-bottom_small slds-m-top_xx-large slds-size_xx-large", onSubmit: apply},
    h("div", {className: "slds-col slds-size_1-of-3"},
      h(SldsPicklist, {label: "Filter by User", value: model.filters.userId, options: userOptions, onChange: onUserPick})
    ),
    h("div", {className: "slds-col slds-size_1-of-3"},
      h("label", {className: "slds-form-element__label"}, "From"),
      h("input", {type: "datetime-local", className: "slds-input", value: model.filters.start, onChange: onStartChange})
    ),
    h("div", {className: "slds-col slds-size_1-of-3"},
      h("label", {className: "slds-form-element__label"}, "To"),
      h("input", {type: "datetime-local", className: "slds-input", value: model.filters.end, onChange: onEndChange})
    ),
    h("div", {className: "slds-grid slds-col slds-align-bottom"},
      h("button", {className: "slds-button slds-button_brand", type: "submit"}, "Apply"),
      h("button", {className: "slds-button slds-button_neutral slds-m-left_x-small", onClick: reset, type: "button"}, "Reset")
    )
  );
}

function LogsTable({model, hideButtonsOption}) {
  const filteredLogs = model.getFilteredLogs();
  const allChecked = filteredLogs.length > 0 && filteredLogs.every(l => model.selectedIds.has(l.Id));
  const cw = model.columnWidths;

  // Helper to render sortable column header
  const renderSortableHeader = (label, soqlColumn) => {
    const isSorted = model.sortColumn === soqlColumn;
    const isAsc = isSorted && model.sortDirection === "ASC";
    const sortClass = isSorted ? (isAsc ? "slds-is-sorted slds-is-sorted_asc" : "slds-is-sorted") : "";

    return h("th", {
      className: `slds-is-sortable ${sortClass}`,
      scope: "col",
      onClick: () => model.handleSort(label)
    },
    h("div", {className: "slds-grid slds-grid_align-spread"},
      h("span", {className: "slds-truncate"}, label),
      h("span", {className: `slds-icon_container slds-is-sortable__icon ${isSorted ? "" : "slds-is-sortable__icon-always"}`, title: isSorted ? (isAsc ? "Sorted ascending" : "Sorted descending") : "Sort"},
        h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#arrowdown"})
        )
      )
    )
    );
  };

  // Compute smarter display counts and offset
  const offset = model.pageIndex * model.pageSize;
  const total = model.totalCount;
  const filteredCount = filteredLogs.length;
  const displayedCountBase = (model.pageIndex + 1) * model.pageSize;
  const displayedCount = model.fetchBodiesSearchTerm && model.fetchBodiesSearchTerm.trim() !== ""
    ? filteredCount
    : (total != null
      ? Math.min(total, displayedCountBase)
      : displayedCountBase);

  return h("div", {className: "slds-card"},
    h("div", {className: "slds-card__header slds-grid"},
      h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
        h("div", {className: "slds-media__figure"},
          h("span", {className: "slds-icon_container"},
            h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#log_a_call"})
            )
          )
        ),
        // Place title and page size picker side-by-side
        h("div", {className: "slds-media__body"},
          h("div", {className: "slds-grid slds-grid_vertical-align-center slds-gutters_small"},
            h("span", {className: ""},
              h("h2", {className: "slds-card__header-title"},
                h("span", {className: "slds-truncate"},
                  model.fetchBodiesSearchTerm && model.fetchBodiesSearchTerm.trim() !== ""
                    ? `Logs (${filteredCount}${total != null ? ` of ${total}` : ""}${model.fetchLogBodies && filteredCount < model.logs.length ? " - filtered" : ""})`
                    : (total != null
                      ? `Logs (${displayedCount} of ${total})`
                      : (model.countLoading
                        ? `Logs (${displayedCount} of ...)`
                        : `Logs (${displayedCount})`))
                )
              )
            ),
            h("div", {className: "slds-col slds-grow-none"},
              h("div", {className: "slds-form-element"},
                h("label", {className: "slds-form-element__label", htmlFor: "sfir-page-size"}, "Page size"),
                h("div", {className: "slds-form-element__control"},
                  h("div", {className: "slds-select_container"},
                    h("select", {
                      id: "sfir-page-size",
                      className: "slds-select",
                      value: String(model.pageSize),
                      onChange: (e) => model.setPageSize(e.target.value)
                    },
                    ...model.allowedPageSizes.map(v => h("option", {key: v, value: String(v)}, String(v)))
                    )
                  )
                )
              )
            )
          )
        ),
        // Search form between Page Size and Refresh button
        h("div", {className: "slds-col slds-grow-none slds-m-right_xx-large"},
          h("div", {className: "slds-form-element"},
            h("div", {className: "slds-form-element__control", style: {display: "flex", alignItems: "center", gap: "0.5rem"}},
              model.fetchLogBodies && h("div", {className: "slds-input-has-icon slds-input-has-icon_left", style: {flex: "1", minWidth: "200px"}},
                h("svg", {className: "slds-input__icon slds-input__icon_left slds-icon-text-default", "aria-hidden": "true"},
                  h("use", {xlinkHref: "symbols.svg#search"})
                ),
                h("input", {
                  type: "search",
                  className: "slds-input",
                  placeholder: "Search in logs...",
                  value: model.fetchBodiesSearchTerm || "",
                  onChange: (e) => {
                    model.fetchBodiesSearchTerm = e.target.value;
                    model.didUpdate();
                  }
                })
              ),
              h("label", {className: "slds-checkbox_toggle slds-grid", title: model.fetchLogBodies ? "Disable fetching log bodies for action details" : "Enable fetching log bodies for action details"},
                h("input", {
                  type: "checkbox",
                  checked: model.fetchLogBodies,
                  onChange: () => model.toggleFetchLogBodies(),
                  "aria-describedby": "fetch-bodies-toggle"
                }),
                h("span", {id: "fetch-bodies-toggle", className: "slds-checkbox_faux_container center-label"},
                  h("span", {className: "slds-checkbox_faux"}),
                  h("span", {className: "slds-checkbox_on"}, "Fetch Bodies"),
                  h("span", {className: "slds-checkbox_off"}, "Disabled")
                )
              )
            )
          )
        ),
        // Keep actions on the right
        h("div", {className: "slds-no-flex"},
          h("div", {className: "slds-button_group", role: "group"},
            h("button", {className: "slds-button slds-button_neutral slds-m-right_x-small", onClick: () => model.refreshAll()},
              h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
                h("use", {xlinkHref: "symbols.svg#refresh"})
              ),
              "Refresh"
            ),
            h("button", {
              className: "slds-button slds-button_destructive",
              disabled: model.selectedIds.size === 0,
              onClick: () => (model.confirmBulkDelete = true, model.didUpdate())
            },
            h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#delete"})
            ),
            "Delete Selected"
            )
          )
        )
      )
    ),
    h("div", {className: "slds-card__body"},
      h("div", {className: "slds-scrollable_x sfir-logs-table-container"},
        h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped slds-table_fixed-layout sfir-logs-table"},
          h("colgroup", {},
            h("col", {style: {width: cw.checkbox}}),
            h("col", {style: {width: cw.user}}),
            h("col", {style: {width: cw.operation}}),
            h("col", {style: {width: cw.request}}),
            h("col", {style: {width: cw.start}}),
            h("col", {style: {width: cw.status}}),
            h("col", {style: {width: cw.action}}),
            h("col", {style: {width: cw.size}}),
            h("col", {style: {width: cw.actions}})
          ),
          h("thead", {},
            h("tr", {},
              h("th", {},
                h("input", {type: "checkbox", checked: allChecked, onChange: (e) => model.toggleSelectAll(e.target.checked)})
              ),
              renderSortableHeader("User", "LogUserId"),
              renderSortableHeader("Operation", "Operation"),
              renderSortableHeader("Request", "Request"),
              renderSortableHeader("Start Time", "StartTime"),
              renderSortableHeader("Status", "Status"),
              renderSortableHeader("Action", "Operation"),
              renderSortableHeader("Size (MB)", "LogLength"),
              h("th", {"aria-label": "Row actions"})
            )
          ),
          h("tbody", {},
            ...model.getFilteredLogs().map(log => {
              model.ensureActionDerived(log);
              model.ensureUserName(log.LogUserId);
              return h("tr", {key: log.Id},
                h("td", {}, h("input", {type: "checkbox", checked: model.selectedIds.has(log.Id), onChange: (e) => model.toggleSelect(log.Id, e.target.checked)})),
                h("td", {},
                  h("span", {className: "slds-truncate", title: model.userMap.get(log.LogUserId) || log.LogUserId || "-"},
                    model.userMap.get(log.LogUserId) || log.LogUserId || "-"
                  )
                ),
                h("td", {},
                  h("span", {className: "slds-truncate", title: log.Operation || "-"}, log.Operation || "-")
                ),
                h("td", {},
                  h("span", {className: "slds-truncate", title: log.Request || "-"}, log.Request || "-")
                ),
                h("td", {},
                  h("span", {className: "slds-truncate", title: new Date(log.StartTime).toLocaleString()},
                    new Date(log.StartTime).toLocaleString()
                  )
                ),
                h("td", {},
                  h("div", {className: "slds-scrollable_y slds-text-body_small sfir-log-status-cell"},
                    log.Status || "-"
                  )
                ),
                h("td", {},
                  (() => {
                    const label = (model.actionSummary.get(log.Id) || parseAction(log.Operation)).label;
                    return h("span", {className: "slds-truncate", title: label}, label);
                  })()
                ),
                h("td", {},
                  (() => {
                    const sizeMB = log.LogLength / (1024 * 1024);
                    const formatted = sizeMB < 1 ? sizeMB.toFixed(2) : sizeMB.toFixed(1);
                    return h("span", {className: "slds-truncate", title: `${formatted} MB`}, `${formatted} MB`);
                  })()
                ),
                h("td", {},
                  h("div", {className: "slds-button_group sfir-actions sfir-log-actions-group", role: "group"},
                    h("button", {type: "button", className: "slds-button slds-button_neutral", onClick: () => model.preview(log.Id)},
                      h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#search"})),
                      "Preview"
                    ),
                    // Download: icon-only button, same size as Share/Delete
                    h("button", {type: "button", className: "slds-button slds-button_neutral", title: "Download", onClick: () => model.download(log.Id)},
                      h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#download"}))
                    ),
                    // Share: icon-only button, sends the file (no truncated body) (conditional)
                    isOptionEnabled("share-logs", hideButtonsOption) && h("button", {type: "button", className: "slds-button slds-button_neutral", title: "Share", onClick: () => model.share(log.Id)},
                      h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#share"}))
                    ),
                    // Delete: icon-only button, same size as Share
                    h("button", {type: "button", className: "slds-button slds-button_destructive", title: "Delete", onClick: () => (model.confirmDeleteId = log.Id, model.didUpdate())},
                      h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#delete"}))
                    )
                  )
                )
              );
            })
          )
        )
      ),
      h("div", {className: "slds-grid slds-m-top_small slds-align_absolute-center slds-gutters"},
        h("button", {className: "slds-button slds-button_neutral", disabled: model.pageIndex === 0, onClick: () => model.prevPage()},
          h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#left"})),
          "Previous"
        ),
        h("span", {className: "slds-m-horizontal_small slds-text-body_small"}, `Page ${model.pageIndex + 1}`),
        h("button", {className: "slds-button slds-button_neutral", disabled: !model.hasMore, onClick: () => model.nextPage()},
          "Next",
          h("svg", {className: "slds-button__icon slds-button__icon_right", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#right"}))
        )
      )
    )
  );
}

function PreviewModal({model, hideButtonsOption}) {
  const log = model.previewLog;
  if (!log) return null;

  const isLoading = model.previewLoading || model.isRestoringPreview;
  const isFilterProcessing = model.previewFilterProcessing;

  // Get filtered log body (with caching)
  const currentFilter = model.previewFilter || "";
  const cacheKey = `${log.id}_${currentFilter}`;

  let displayBody;
  if (model._cachedFilteredBody && model._cachedFilterKey === cacheKey) {
    displayBody = model._cachedFilteredBody;
  } else {
    displayBody = model.getFilteredLogBody();
    model._cachedFilteredBody = displayBody;
    model._cachedFilterKey = cacheKey;
  }

  // For very large files (>1.5MB), skip Prism highlighting to avoid freezing
  const bodySize = displayBody.length;
  const isLargeFile = bodySize > 1500000; // 1.5MB threshold

  // build highlighted HTML with current selection
  const escapeHtml = (s) => (s || "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const buildHighlighted = (text, term, currentIdx) => {
    const src = text || "";
    const q = term || "";
    if (!q) return {html: escapeHtml(src), count: 0};
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(pattern, "gi");
    let out = "",
      last = 0,
      m,
      i = 0,
      count = 0;
    while ((m = re.exec(src))){
      const start = m.index,
        end = start + m[0].length;
      out += escapeHtml(src.slice(last, start));
      const isCurrent = i === currentIdx;
      out += `<mark class="sfir-highlight${isCurrent ? " current" : ""}" ${isCurrent ? 'id="sfir-current-match"' : ""}>${escapeHtml(src.slice(start, end))}</mark>`;
      last = end; i++; count++;
      // Hard cap to avoid excessive DOM for insanely frequent matches
      if (count > 2000) { out += escapeHtml(src.slice(last)); return {html: out, count}; }
    }
    out += escapeHtml(src.slice(last));
    return {html: out, count};
  };
  // First, let Prism do its syntax highlighting (if available) - with caching
  // Skip Prism for large files (>1.5MB) or when filter is being processed to avoid browser crash
  let processedBody;
  const prismCacheKey = `prism_${cacheKey}_${isLargeFile}_${isFilterProcessing}`;

  if (model._cachedProcessedBody && model._cachedProcessedKey === prismCacheKey) {
    // Use cached Prism result
    processedBody = model._cachedProcessedBody;
  } else {
    // Process with Prism and cache the result
    if (!isLargeFile && !isFilterProcessing && window.Prism && window.Prism.highlight) {
      try {
        // Let Prism highlight the syntax first
        processedBody = window.Prism.highlight(displayBody, window.Prism.languages.log || window.Prism.languages.markup, "log");
      } catch (e) {
        // If Prism fails, use raw body
        processedBody = escapeHtml(displayBody);
      }
    } else {
      processedBody = escapeHtml(displayBody);
    }
    // Cache the processed result
    model._cachedProcessedBody = processedBody;
    model._cachedProcessedKey = prismCacheKey;
  }

  // Now apply search highlighting on top of Prism's output
  const applySearchHighlight = (htmlText, term, currentIdx) => {
    if (!term) return {html: htmlText, count: 0};

    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlText;

    const pattern = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let globalMatchIndex = 0;
    let totalMatches = 0;

    // Function to recursively highlight text nodes while preserving Prism's structure
    const highlightInNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const regex = new RegExp(pattern, "gi");
        const matches = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
          matches.push({start: match.index, end: match.index + match[0].length, text: match[0]});
          if (matches.length > 500) break; // Safety limit per text node
        }

        if (matches.length > 0) {
          const fragment = document.createDocumentFragment();
          let lastIndex = 0;

          matches.forEach(m => {
            // Text before match
            if (m.start > lastIndex) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex, m.start)));
            }

            // Create highlighted mark
            const mark = document.createElement("mark");
            mark.className = "sfir-highlight";
            if (globalMatchIndex === currentIdx) {
              mark.classList.add("current");
              mark.id = "sfir-current-match";
            }
            mark.textContent = m.text;
            fragment.appendChild(mark);

            lastIndex = m.end;
            globalMatchIndex++;
            totalMatches++;
          });

          // Remaining text after last match
          if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
          }

          node.parentNode.replaceChild(fragment, node);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "MARK") {
        // Recurse through child nodes (make a copy of childNodes array to avoid live collection issues)
        const children = Array.from(node.childNodes);
        children.forEach(child => highlightInNode(child));
      }
    };

    highlightInNode(tempDiv);

    return {
      html: tempDiv.innerHTML,
      count: totalMatches
    };
  };

  const {html, count} = applySearchHighlight(processedBody, model.previewSearch.term, model.previewSearch.index);

  // Update count in model state and adjust index if needed
  if (model.previewSearch.count !== count) {
    model.previewSearch.count = count;
    if (model.previewSearch.index >= count) {
      model.previewSearch.index = count > 0 ? count - 1 : 0;
    }
  }

  setTimeout(() => {
    const el = document.getElementById("sfir-current-match");
    if (el) el.scrollIntoView({block: "center"});
  }, 0);

  return h(ConfirmModal, {
    isOpen: true,
    title: `Preview ${log.fileName}`,
    message: null,
    onCancel: () => model.closePreview(),
    cancelLabel: "Close",
    cancelVariant: "neutral",
    confirmLabel: "Download",
    confirmVariant: "brand",
    confirmIconName: "symbols.svg#download",
    onConfirm: () => { model.download(log.id); model.closePreview(); },
    containerClassName: "modalContainer",
    rootStyle: model.showAgentforceModal ? {display: "none"} : undefined,
    ignoreEsc: model.showAgentforceModal,
    // Enable buttons even during loading
    confirmDisabled: false,
    cancelDisabled: false
  },
  // Large file warning
  isLargeFile && !isLoading && !isFilterProcessing && h("div", {className: "slds-notify slds-notify_alert slds-alert_warning slds-m-bottom_x-small", role: "alert"},
    h("span", {className: "slds-icon_container slds-icon-utility-warning slds-m-right_x-small"},
      h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"},
        h("use", {xlinkHref: "symbols.svg#warning"})
      )
    ),
    h("h2", {},
      h("span", {className: "slds-text-body_small"},
        `⚠️ Large file (${(bodySize / 1024 / 1024).toFixed(2)} MB). Syntax highlighting is disabled to prevent browser crashes. Search and filtering still work.`
      )
    )
  ),
  // Filter template row
  h("div", {className: "slds-grid slds-gutters slds-m-bottom_x-small"},
    h("div", {className: "slds-col"},
      h("div", {className: "slds-form-element"},
        h("label", {className: "slds-form-element__label", htmlFor: "sfir-log-filter-template"}, "Filter Template"),
        h("div", {className: "slds-form-element__control"},
          h("div", {className: "slds-select_container"},
            h("select", {
              id: "sfir-log-filter-template",
              className: "slds-select",
              value: model.previewFilter,
              onChange: (e) => model.applyPreviewFilter(e.target.value),
              disabled: isLoading || isFilterProcessing
            },
            ...model.filterTemplates.map(t => h("option", {key: t.value, value: t.value}, t.label))
            )
          )
        )
      )
    ),
    h("div", {className: "slds-col"},
      h("div", {className: "slds-form-element"},
        h("label", {className: "slds-form-element__label", htmlFor: "sfir-log-filter-custom"}, "Custom Filter (use | for OR)"),
        h("div", {className: "slds-form-element__control"},
          h("input", {
            id: "sfir-log-filter-custom",
            type: "text",
            className: "slds-input",
            placeholder: "e.g., USER_DEBUG|EXCEPTION_THROWN",
            value: model.previewFilter,
            onChange: (e) => model.applyPreviewFilter(e.target.value),
            disabled: isLoading || isFilterProcessing
          })
        )
      )
    )
  ),
  // search toolbar
  h("div", {className: "slds-grid slds-gutters slds-m-bottom_x-small"},
    h("div", {className: "slds-col"},
      h("div", {className: "slds-form-element"},
        h("div", {className: "slds-form-element__control"},
          h("div", {className: "slds-input-has-icon slds-input-has-icon_left"},
            h("span", {className: "slds-icon_container slds-input__icon slds-input__icon_left"},
              h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#search"}))
            ),
            h("input", {
              type: "text",
              placeholder: "Find in log (Ctrl/⌘+F)",
              className: "slds-input sfir-preview-search-input",
              defaultValue: model.previewSearch.term,
              autoComplete: "off",
              onInput: (e) => model.updatePreviewSearchTermLive(e.target.value),
              onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); model.nextPreviewMatch(); } },
              disabled: isLoading || isFilterProcessing
            })
          )
        )
      )
    ),
    h("div", {className: "slds-col slds-grow-none"},
      h("div", {className: "slds-button_group", role: "group"},
        h("button", {className: "slds-button slds-button_neutral", onClick: () => model.prevPreviewMatch(), title: "Previous match", disabled: isLoading || isFilterProcessing},
          h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#left"}))
        ),
        h("button", {className: "slds-button slds-button_neutral", onClick: () => model.nextPreviewMatch(), title: "Next match", disabled: isLoading || isFilterProcessing},
          h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#right"}))
        )
      ),
      h("div", {className: "slds-align_absolute-center slds-text-body_small slds-m-top_xx-small sfir-search-counter"}, `${count ? (model.previewSearch.index + 1) : 0} / ${count}`)
    ),
    // AI button (conditional)
    isOptionEnabled("logs-agentforce", hideButtonsOption) && h("div", {className: "slds-col slds-grow-none"},
      h("button", {
        className: "slds-button slds-button_brand",
        onClick: () => model.openAgentforce(),
        title: "Analyze with Agentforce",
        disabled: isLoading || isFilterProcessing
      },
      h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
        h("use", {xlinkHref: "symbols.svg#einstein"})
      ),
      "Analyze"
      )
    )
  ),
  // Loading state, filter processing state, or log body
  isLoading
    ? h("div", {className: "slds-align_absolute-center slds-m-vertical_xx-large sfir-preview-loading-container"},
      h("div", {className: "slds-spinner_container sfir-preview-spinner-container"},
        h("div", {role: "status", className: "slds-spinner slds-spinner_large slds-spinner_brand"},
          h("span", {className: "slds-assistive-text"}, "Loading log..."),
          h("div", {className: "slds-spinner__dot-a"}),
          h("div", {className: "slds-spinner__dot-b"})
        )
      ),
      h("div", {className: "slds-text-heading_small slds-m-top_medium slds-text-align_center"},
        h("div", {}, "Loading debug log..."),
        h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-top_x-small"},
          "Please wait while we fetch the log file"
        )
      )
    )
    : isFilterProcessing
      ? h("div", {className: "slds-align_absolute-center slds-m-vertical_xx-large sfir-preview-loading-container"},
        h("div", {className: "slds-spinner_container sfir-preview-spinner-container"},
          h("div", {role: "status", className: "slds-spinner slds-spinner_large slds-spinner_brand"},
            h("span", {className: "slds-assistive-text"}, "Processing filter..."),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"})
          )
        ),
        h("div", {className: "slds-text-heading_small slds-m-top_medium slds-text-align_center"},
          h("div", {}, "Applying filter..."),
          h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-top_x-small"},
            isLargeFile
              ? "Processing large file, this may take a moment"
              : "Please wait"
          )
        )
      )
      : h("pre", {
        className: "language-log sfir-preview-code-block"
      },
      h("code", {
        className: "language-log",
        dangerouslySetInnerHTML: {__html: html}
      })
      )
  );
}

function AgentforceModal({model}) {
  if (!model.showAgentforceModal) return null;

  const defaultPrompt = model.getDefaultInstructions();
  const currentInstructions = model.agentforceCustomInstructions || defaultPrompt;
  const isCustomized = currentInstructions !== defaultPrompt;
  const isEditMode = model.agentforceEditMode;

  const isAnalyzing = model.agentforceAnalyzing || false;
  const hasResults = model.agentforceAnalysis || model.agentforceError;

  return h(ConfirmModal, {
    isOpen: true,
    title: h("div", {className: "slds-grid slds-grid_vertical-align-center"},
      h("span", {className: "slds-icon_container slds-icon-utility-einstein slds-m-right_small"},
        h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#einstein"})
        )
      ),
      h("span", {}, "Agentforce Debug Log Analysis")
    ),
    onConfirm: isAnalyzing ? null : () => model.sendAgentforceAnalysis(),
    onCancel: () => model.closeAgentforce(),
    confirmLabel: isAnalyzing ? "Analyzing..." : (hasResults ? "Analyze Again" : "Analyze"),
    cancelLabel: hasResults ? "Close" : (model.previewLog ? "Back" : "Cancel"),
    confirmVariant: "brand",
    cancelVariant: "neutral",
    confirmDisabled: isAnalyzing,
    containerClassName: "modalContainer"
  },
  // Instructions Section with Edit/View toggle
  !hasResults && h("div", {className: "slds-form-element slds-m-bottom_medium"},
    h("div", {className: "slds-grid slds-grid_align-spread slds-m-bottom_x-small"},
      h("label", {className: "slds-form-element__label slds-text-heading_small"},
        h("span", {}, "Analysis Instructions"),
        isCustomized && h("span", {
          className: "slds-theme_info slds-badge slds-m-left_x-small",
          style: {fontSize: "0.75rem"}
        }, "Customized")
      ),
      h("div", {className: "slds-button-group", role: "group"},
        h("button", {
          className: `slds-button slds-button_${isEditMode ? "brand" : "neutral"}`,
          title: "Edit instructions",
          onClick: () => model.toggleAgentforceEditMode(),
          disabled: isAnalyzing
        },
        h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#edit"})
        ),
        "Edit"
        ),
        isCustomized && h("button", {
          className: "slds-button slds-button_neutral",
          title: "Reset to default instructions",
          onClick: () => {
            model.resetAgentforceInstructions();
          },
          disabled: isAnalyzing
        },
        h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#refresh"})
        ),
        "Reset"
        )
      )
    ),

    // Edit Mode - Editable textarea
    isEditMode ? h("div", {},
      h("textarea", {
        className: "slds-textarea sfir-agentforce-textarea",
        value: currentInstructions,
        onInput: (e) => model.updateAgentforceInstructions(e.target.value),
        placeholder: "Enter your custom analysis instructions...",
        disabled: isAnalyzing
      }),
      h("div", {className: "slds-form-element__help slds-m-top_small"},
        h("div", {className: "slds-text-body_small slds-text-color_weak"},
          "💡 Tip: Customize these instructions to focus on specific aspects of your debug logs. Changes are automatically saved."
        )
      )
    ) : h("div", {},
      // View Mode - Read-only display
      h("div", {
        className: "slds-box slds-theme_shade slds-m-top_x-small sfir-agentforce-instructions-container"
      },
      h("div", {
        className: "slds-text-body_small sfir-agentforce-instructions-content"
      }, currentInstructions)
      ),
      h("div", {className: "slds-form-element__help slds-m-top_small"},
        h("div", {className: "slds-text-body_small"},
          "Agentforce will provide a detailed analysis covering:",
          h("ul", {className: "slds-list_dotted slds-m-top_xx-small slds-m-left_medium"},
            h("li", {}, "Executive Summary & Execution Flow"),
            h("li", {}, "Data Operations (SOQL/DML)"),
            h("li", {}, "Errors & Performance Issues"),
            h("li", {}, "Governor Limits Usage"),
            h("li", {}, "Best Practices & Recommendations")
          )
        )
      )
    )
  ),

  // Analyzing State
  isAnalyzing && h("div", {className: "slds-align_absolute-center slds-m-vertical_large sfir-agentforce-analyzing-container"},
    h("div", {className: "slds-spinner_container"},
      h("div", {role: "status", className: "slds-spinner slds-spinner_medium slds-spinner_brand"},
        h("span", {className: "slds-assistive-text"}, "Analyzing log..."),
        h("div", {className: "slds-spinner__dot-a"}),
        h("div", {className: "slds-spinner__dot-b"})
      )
    ),
    h("div", {className: "slds-text-heading_small slds-m-top_medium slds-text-align_center"},
      h("div", {}, "Agentforce is performing a comprehensive analysis..."),
      h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-top_x-small"},
        "Analyzing execution flow, data operations, performance, and governor limits"
      ),
      h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-top_xx-small"},
        "This may take 30-60 seconds for detailed insights"
      )
    )
  ),

  // Error State
  model.agentforceError && h("div", {className: "slds-m-top_medium"},
    h("div", {className: "slds-notify slds-notify_alert slds-alert_error", role: "alert"},
      h("span", {className: "slds-icon_container slds-icon-utility-error slds-m-right_small"},
        h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#error"})
        )
      ),
      h("h2", {},
        h("span", {className: "slds-text-heading_small"}, "Analysis Failed")
      )
    ),
    h("div", {className: "slds-box slds-box_small slds-theme_error slds-m-top_small"},
      h("div", {className: "slds-text-body_regular sfir-agentforce-error-content"},
        model.agentforceError
      )
    )
  ),

  // Success State with Results
  model.agentforceAnalysis && h("div", {className: "slds-m-top_medium"},
    h("div", {className: "slds-notify slds-notify_alert slds-alert_success slds-m-bottom_small", role: "alert"},
      h("span", {className: "slds-icon_container slds-icon-utility-success slds-m-right_small"},
        h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"},
          h("use", {xlinkHref: "symbols.svg#success"})
        )
      ),
      h("h2", {},
        h("span", {className: "slds-text-heading_small"}, "Analysis Complete")
      )
    ),
    h("div", {className: "slds-card"},
      h("div", {className: "slds-card__header slds-grid"},
        h("header", {className: "slds-media slds-media_center slds-has-flexi-truncate"},
          h("div", {className: "slds-media__body"},
            h("h2", {className: "slds-card__header-title"},
              h("span", {}, "Agentforce Analysis Results")
            )
          ),
          h("div", {className: "slds-no-flex"},
            h("button", {
              className: "slds-button slds-button_icon slds-button_icon-border-filled",
              title: "Copy to clipboard",
              onClick: () => {
                navigator.clipboard.writeText(model.agentforceAnalysis);
                model.showToast("success", "Copied", "Analysis copied to clipboard");
              }
            },
            h("svg", {className: "slds-button__icon", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#copy"})
            )
            )
          )
        )
      ),
      h("div", {className: "slds-card__body slds-card__body_inner"},
        h("div", {
          className: "slds-text-body_regular sfir-agentforce-results"
        }, model.agentforceAnalysis)
      )
    )
  )
  );
}

class App extends React.Component {
  constructor(props){
    super(props);
    this.model = new Model(props.sfHost);
    this.state = {tick: 0};
    this.model.render = () => this.setState({tick: this.state.tick + 1});
  }

  componentDidMount() {
    this.model.init();
  }

  render() {
    const {model} = this;
    const hideButtonsOption = JSON.parse(localStorage.getItem("hideDebugLogButtonsOption"));

    return h("div", {},
      h(PageHeader, {
        pageTitle: "Logs Viewer (beta)",
        orgName: model.orgName,
        sfLink: `https://${this.model.sfHost}`,
        sfHost: this.model.sfHost,
        spinnerCount: this.model.spinnerCount,
        ...this.model.userInfoModel.getProps()
      }),

      h("div", {className: "slds-m-around_medium"},
        h(Filters, {model}),
        h(LogsTable, {model, hideButtonsOption})
      ),

      model.previewLog ? h(PreviewModal, {model, hideButtonsOption}) : null,
      model.confirmDeleteId ? h(ConfirmModal, {
        isOpen: true,
        title: "Delete Log",
        message: "Are you sure you want to delete this log?",
        onCancel: () => { model.confirmDeleteId = null; model.didUpdate(); },
        onConfirm: () => { const id = model.confirmDeleteId; model.confirmDeleteId = null; model.deleteOne(id); },
      }) : null,
      model.confirmBulkDelete ? h(ConfirmModal, {
        isOpen: true,
        title: "Delete Selected Logs",
        message: `Are you sure you want to delete ${model.selectedIds.size} selected log(s)?`,
        onCancel: () => { model.confirmBulkDelete = false; model.didUpdate(); },
        onConfirm: () => { model.confirmBulkDelete = false; model.deleteSelected(); },
      }) : null,
      model.toast ? h(Toast, {
        variant: model.toast.variant,
        title: model.toast.title,
        message: model.toast.message,
        onClose: () => model.closeToast()
      }) : null,
      h(AgentforceModal, {model})
    );
  }
}

{
  let args = new URLSearchParams(location.search);
  let sfHost = args.get("host");
  let hash = new URLSearchParams(location.hash); //User-agent OAuth flow
  if (!sfHost && hash) {
    sfHost = decodeURIComponent(hash.get("instance_url")).replace(/^https?:\/\//i, "");
  }
  // Reuse same init as other pages
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {
    let root = document.getElementById("root");
    ReactDOM.render(h(App, {sfHost}), root);
  });
}
