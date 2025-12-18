/* global React ReactDOM initButton */
import {sfConn, apiVersion} from "./inspector.js";
import {getLinkTarget, UserInfoModel, createSpinForMethod} from "./utils.js";
import {PageHeader} from "./components/PageHeader.js";
import ConfirmModal from "./components/ConfirmModal.js";

const h = React.createElement;

class Model {
  constructor(sfHost) {
    this.sfHost = sfHost;
    this.spinnerCount = 0;

    this.userInfoModel = new UserInfoModel(createSpinForMethod(this));

    this.logs = [];
    this.selectedIds = new Set();
    this.filters = { userId: "", start: "", end: "" };
    this.previewLog = null; // {id, body, fileName}
    this.previewSearch = { term: "", liveTerm: "", index: 0, _timer: 0 };
    this._onPreviewKeyDown = (e) => {
      const key = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "f") {
        e.preventDefault();
        const inp = document.querySelector('.sfir-preview-search-input');
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

    // Column widths for dynamic resizing
    this.columnWidths = {
      user: 150,
      action: 280,
      start: 140,
      status: 250,
      size: 90,
      actions: 260
    };
    this.startResize = null;

    // Pagination for lazy loading
    const savedPageSize = parseInt(localStorage.getItem('sfir.debugLog.pageSize'), 10);
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
  }

  setColumnWidth(col, width) {
    const min = 80; // prevent collapsing too far
    const max = 800;
    this.columnWidths[col] = Math.max(min, Math.min(max, Math.round(width)));
    this.didUpdate();
  }

  didUpdate() {
    this.render();
  }

  async init() {
    await sfConn.getSession(this.sfHost);
    await this.populatePicklistFromAllLogs();
    await this.fetchLogs(true);
  }

  async populatePicklistFromAllLogs() {
    this.spinnerCount++;
    try {
      // Gather all distinct LogUserId from all logs (no filters)
      const ids = new Set();
      let url = `/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent("SELECT LogUserId FROM ApexLog WHERE LogUserId != null");
      while (url) {
        const res = await sfConn.rest(url);
        (res.records || []).forEach(r => { if (r.LogUserId) ids.add(r.LogUserId); });
        url = res.nextRecordsUrl || null;
      }

      const allIds = Array.from(ids);
      // Resolve names in chunks, rebuild userMap and userOptions from the full list
      const map = new Map();
      for (let i = 0; i < allIds.length; i += 200) {
        const chunk = allIds.slice(i, i + 200);
        const soql = `SELECT Id, Name FROM User WHERE Id IN (${chunk.map(id => `'${id}'`).join(",")})`;
        try {
          const res = await sfConn.rest(`/services/data/v${apiVersion}/query/?q=` + encodeURIComponent(soql));
          (res.records || []).forEach(u => map.set(u.Id, u.Name));
        } catch (e) {
          console.error("populatePicklistFromAllLogs", e);
        }
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
          this.totalCount = typeof countRes.totalSize === 'number' ? countRes.totalSize : 0;
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

      this.resolveActionsFromBodiesLimited(Math.min(this.pageSize, batch.length));
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

  async fetchTotalCount() {
    try {
      const whereClause = this.buildWhereClause();
      const soql = `SELECT COUNT() FROM ApexLog${whereClause}`;
      const query = `/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql);
      const res = await sfConn.rest(query);
      this.totalCount = (res && typeof res.totalSize === 'number') ? res.totalSize : 0;
    } catch (e) {
      console.error("fetchTotalCount", e);
      // Fallback to current page length if count fails
      if (typeof this.totalCount !== 'number') this.totalCount = this.logs.length || 0;
    }
  }

  async loadMore() {
    if (this.loadingMore || !this.hasMore || !this.nextUrl) return;
    this.loadingMore = true;
    try {
      const res = await sfConn.rest(this.nextUrl);
      const batch = res.records || [];
      this.logs = this.logs.concat(batch);

      // Seed action summary for appended items
      for (const l of batch) {
        const base = parseAction(l.Operation);
        this.actionSummary.set(l.Id, base);
      }

      // Update nextUrl and hasMore (use exact URL returned by Salesforce)
      this.nextUrl = res.nextRecordsUrl || null;
      this.hasMore = !!this.nextUrl;

      // Resolve actions for the appended batch
      this.resolveActionsFromBodiesLimited(Math.min(20, batch.length));
      this.didUpdate();
    } catch (e) {
      console.error("loadMore", e);
      this.hasMore = false;
      this.nextUrl = null;
    } finally {
      this.loadingMore = false;
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
        const detail = deriveActionFromBody(text) || parseAction(log.Operation);
        this.actionSummary.set(log.Id, detail);
      })
      .catch(() => {/* ignore */})
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
    this.spinnerCount++;
    try {
      const ids = Array.from(this.selectedIds);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        await sfConn.rest(`/services/data/v${apiVersion}/composite/sobjects?ids=${chunk.join(",")}&allOrNone=false`, {method: "DELETE"});
      }
      await this.fetchLogs(true);
      this.selectedIds.clear();
    } catch (e) {
      console.error("deleteSelected", e);
    } finally {
      this.spinnerCount--;
      this.didUpdate();
    }
  }

  async deleteOne(id) {
    this.spinnerCount++;
    try {
      await sfConn.rest(`/services/data/v${apiVersion}/sobjects/ApexLog/${id}`, {method: "DELETE"});
      await this.fetchLogs(true);
      this.selectedIds.delete(id);
    } catch (e) {
      console.error("deleteOne", e);
    } finally {
      this.spinnerCount--;
      this.didUpdate();
    }
  }

  async preview(id) {
    this.spinnerCount++;
    try {
      const xhr = await sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/ApexLog/${id}/Body`, {responseType: "blob"}, true);
      const blob = xhr.response;
      const text = await blob.text();
      this.previewLog = {id, body: text, fileName: `${id}.log`};
      this.previewSearch = { term: "", liveTerm: "", index: 0, _timer: 0 };
      window.addEventListener('keydown', this._onPreviewKeyDown, true);
      setTimeout(() => {
        const inp = document.querySelector('.sfir-preview-search-input');
        if (inp) inp.focus();
      }, 0);
    } catch (e) {
      console.error("preview", e);
      this.previewLog = {id, body: "Error loading log", fileName: `${id}.log`};
    } finally {
      this.spinnerCount--;
      this.didUpdate();
    }
  }

  closePreview() {
    this.previewLog = null;
    if (this.previewSearch && this.previewSearch._timer) {
      clearTimeout(this.previewSearch._timer);
      this.previewSearch._timer = 0;
    }
    window.removeEventListener('keydown', this._onPreviewKeyDown, true);
    this.didUpdate();
  }

  // Debounced search update to keep typing smooth in preview
  updatePreviewSearchTermLive(term){
    if (!this.previewSearch) this.previewSearch = { term: "", liveTerm: "", index: 0, _timer: 0 };
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
    const cnt = document.querySelectorAll('.sfir-highlight').length;
    if (!cnt) return;
    this.previewSearch.index = (this.previewSearch.index + 1) % cnt;
    this.didUpdate();
  }
  prevPreviewMatch(){
    const cnt = document.querySelectorAll('.sfir-highlight').length;
    if (!cnt) return;
    this.previewSearch.index = (this.previewSearch.index - 1 + cnt) % cnt;
    this.didUpdate();
  }

  download(id) {
    // Fetch blob via authenticated REST, then save
    (async () => {
      try {
        const xhr = await sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/ApexLog/${id}/Body`, {responseType: "blob"}, true);
        const blob = xhr.response;
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
        const xhr = await sfConn.rest(`/services/data/v${apiVersion}/tooling/sobjects/ApexLog/${id}/Body`, {responseType: "blob"}, true);
        const blob = xhr.response;

        const action = (this.actionSummary.get(id) || parseAction(log.Operation) || {label: id}).label || id;
        const start = new Date(log.StartTime).toLocaleString();
        let subject = `[SF Debug Log] ${action} - ${start}`;
        if (subject.length > 150) subject = subject.slice(0, 147) + "...";
        const fileName = `${id}.log`;

        // Prefer Web Share API with file attachment when available (no compression)
        try {
          const file = new File([blob], fileName, { type: "text/plain" });
          if (navigator && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: subject, text: "", files: [file] });
            return;
          }
        } catch (_) {
          // Ignore and try text-only share below
        }

        // Secondary attempt: Web Share without files (opens native share sheet on some desktops)
        try {
          if (navigator && typeof navigator.share === "function") {
            await navigator.share({ title: subject, text: `Salesforce debug log: ${fileName}` });
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
            `MIME-Version: 1.0`,
            `Subject: ${encodeHeader(subject)}`,
            `Content-Type: multipart/mixed; boundary=\"${boundary}\"`,
            "",
            `--${boundary}`,
            `Content-Type: text/plain; charset=UTF-8`,
            `Content-Transfer-Encoding: 7bit`,
            "",
            `Attached Salesforce debug log: ${fileName}.`,
            "",
            `--${boundary}`,
            `Content-Type: text/plain; name=\"${fileName}\"`,
            `Content-Transfer-Encoding: base64`,
            `Content-Disposition: attachment; filename=\"${fileName}\"`,
            "",
            base64,
            `--${boundary}--`,
            ""
          ].join(CRLF);

          const emlBlob = new Blob([emlParts], { type: "message/rfc822" });
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
    try { localStorage.setItem('sfir.debugLog.pageSize', String(n)); } catch (_) {}
    this.pageIndex = 0;
    this.fetchLogs(true, true);
  }
}

function parseAction(operation) {
  if (!operation) return {label: "-"};
  const op = operation.trim();
  if (op === "CODE_UNIT_STARTED") return {label: "-"};
  let type = op, name = "";
  if (op.includes("/")) {
    [type, name] = op.split("/", 2);
  } else if (op.includes(":")) {
    [type, name] = op.split(":", 2);
  }
  type = (type || "").trim();
  name = (name || "").trim();
  return {label: name ? `${type} · ${name}` : type || "-"};
}

// Try to extract a clearer action (Class.Method from METHOD_ENTRY preferred; fallback to Code Unit or Flow markers)
function deriveActionFromBody(text) {
  if (!text) return null;

  // 1. Prefer METHOD_ENTRY lines: "...|METHOD_ENTRY|[line]|classId|Class.Method(params)"
  const methodEntry = text.match(/\bMETHOD_ENTRY\|[^\|]*\|[^\|]*\|([A-Za-z0-9_\.]+)\(.*?\)/);
  if (methodEntry && methodEntry[1]) {
    const full = methodEntry[1];
    const parts = full.split(".");
    
    if (parts.length >= 2) {
      const method = parts.pop();
      const cls = parts.pop();
      return {label: `${cls}.${method}`};
    }
    return {label: full};
  }

  // 2. Look for CODE_UNIT_STARTED with full signature: Class.Method(params)
  const codeUnitWithSignature = text.match(/CODE_UNIT_STARTED\|[^\|]*\|[^\|]*\|([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\([^\)]*\)/);
  if (codeUnitWithSignature) {
    const cls = codeUnitWithSignature[1];
    const method = codeUnitWithSignature[2];
    return {label: `${cls}.${method}`};
  }

  // 3. Look for apex:// actions (LWC/Aura)
  const apexAction = text.match(/apex:\/\/([A-Za-z0-9_]+)\/ACTION\$([A-Za-z0-9_]+)/);
  if (apexAction) {
    return {label: `${apexAction[1]}.${apexAction[2]}`};
  }

  // 3b. Trigger entries (multi-field variant)
  // Example:
  //   ...|CODE_UNIT_STARTED|[EXTERNAL]|01q...|MyTrigger on Object__c trigger event BeforeUpdate|__sfdc_trigger/MyTrigger
  //   ...|CODE_UNIT_STARTED|[EXTERNAL]|TRIGGERS
  // Try to capture descriptive text and the trigger name from the __sfdc_trigger path in one go
  let triggerDetail = text.match(/CODE_UNIT_STARTED\|[^\|]*\|[^\|]*\|([^|\n]+?)\|__sfdc_trigger\/([A-Za-z0-9_]+)/i);
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

  // 4. Look for other CODE_UNIT_STARTED entries
  // Try to capture the more descriptive fourth field first, then fallback to the third
  const codeUnitFourth = text.match(/CODE_UNIT_STARTED\|[^\|]*\|[^\|]*\|([^\|\n]+)/);
  const codeUnitThird = text.match(/CODE_UNIT_STARTED\|[^\|]*\|([^\|\n]+)/);
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

  // 5. Look for FLOW start lines
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

function LogsTable({model}) {
  const allChecked = model.logs.length > 0 && model.logs.every(l => model.selectedIds.has(l.Id));
  const cw = model.columnWidths;
  const Resizer = ({col}) => h("span", {
    className: "sfir-col-resizer",
    onMouseDown: (e) => model.onResizeStart(col, e.clientX)
  });
  const onMouseMove = (e) => model.onResizeMove(e.clientX);
  const onMouseUp = () => model.onResizeEnd();

  // Compute smarter display counts and offset
  const offset = model.pageIndex * model.pageSize;
  const total = model.totalCount;
  const displayedCountBase = (model.pageIndex + 1) * model.pageSize;
  const displayedCount = total != null
    ? Math.min(total, displayedCountBase)
    : displayedCountBase;

  return h("div", {className: "slds-card", onMouseMove, onMouseUp},
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
                  total != null
                    ? `Logs (${displayedCount} of ${total})`
                    : (model.countLoading
                        ? `Logs (${displayedCount} of ...)`
                        : `Logs (${displayedCount})`)
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
      h("div", {className: "slds-scrollable_x", style: {maxWidth: "100%"}},
        h("table", {className: "slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped", style: {tableLayout: "fixed", minWidth: "900px"}},
          h("colgroup", {},
            h("col", {style: {width: 44}}),
            h("col", {style: {width: cw.user}}),
            h("col", {style: {width: cw.action}}),
            h("col", {style: {width: cw.start}}),
            h("col", {style: {width: cw.status}}),
            h("col", {style: {width: cw.size}}),
            h("col", {style: {width: cw.actions}})
          ),
          h("thead", {},
            h("tr", {},
              h("th", {},
                h("input", {type: "checkbox", checked: allChecked, onChange: (e) => model.toggleSelectAll(e.target.checked)})
              ),
              h("th", {},
                "User",
                h(Resizer, {col: "user"})
              ),
              h("th", {},
                "Action",
                h(Resizer, {col: "action"})
              ),
              h("th", {},
                "Start Time",
                h(Resizer, {col: "start"})
              ),
              h("th", {},
                "Status",
                h(Resizer, {col: "status"})
              ),
              h("th", {},
                "Size (KB)",
                h(Resizer, {col: "size"})
              ),
              h("th", {"aria-label": "Row actions"},
                // Header intentionally left blank per request
                h(Resizer, {col: "actions"})
              )
            )
          ),
          h("tbody", {},
            ...model.logs.map(log => {
              model.ensureActionDerived(log);
              model.ensureUserName(log.LogUserId);
              return h("tr", {key: log.Id},
                h("td", {}, h("input", {type: "checkbox", checked: model.selectedIds.has(log.Id), onChange: (e) => model.toggleSelect(log.Id, e.target.checked)})),
                h("td", {style: {width: cw.user}}, model.userMap.get(log.LogUserId) || log.LogUserId || "-"),
                h("td", {style: {width: cw.action}, className: "slds-scrollable_x"},
                  (() => {
                    const label = (model.actionSummary.get(log.Id) || parseAction(log.Operation)).label;
                    return h("span", {className: "slds-truncate", title: label}, label);
                  })()
                ),
                h("td", {style: {width: cw.start}}, new Date(log.StartTime).toLocaleString()),
                h("td", {style: {width: cw.status}},
                  h("div", {className: "slds-scrollable_y slds-text-body_small", style: {maxHeight: "2.5rem", overflow: "auto"}},
                    log.Status || "-"
                  )
                ),
                h("td", {style: {width: cw.size}}, (log.LogLength/1024|0)),
                h("td", {style: {width: cw.actions}},
                  h("div", {className: "slds-button_group sfir-actions", role: "group", style: {whiteSpace: "nowrap"}},
                    h("button", {type: "button", className: "slds-button slds-button_neutral", onClick: () => model.preview(log.Id)},
                      h("svg", {className: "slds-button__icon slds-button__icon_left", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#search"})),
                      "Preview"
                    ),
                    // Download: icon-only button, same size as Share/Delete
                    h("button", {type: "button", className: "slds-button slds-button_neutral", title: "Download", onClick: () => model.download(log.Id)},
                      h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#download"}))
                    ),
                    // Share: icon-only button, sends the file (no truncated body)
                    h("button", {type: "button", className: "slds-button slds-button_neutral", title: "Share", onClick: () => model.share(log.Id)},
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

// Small CSS helper for resizer (inlined for now)
const style = document.createElement("style");
style.textContent = `.sfir-col-resizer{display:inline-block; width:6px; cursor:col-resize; margin-left:4px}`;
document.head.appendChild(style);

// Add small CSS to ensure scroll container works (full height with viewport)
const style2 = document.createElement("style");
style2.textContent = `.sfir-table-scroll{position:relative; height: calc(100vh - 260px); overflow:auto}`;
document.head.appendChild(style2);

function PreviewModal({model}) {
  const log = model.previewLog;
  if (!log) return null;

  // build highlighted HTML with current selection
  const escapeHtml = (s) => (s || "").replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const buildHighlighted = (text, term, currentIdx) => {
    const src = text || "";
    const q = term || "";
    if (!q) return {html: escapeHtml(src), count: 0};
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(pattern, "gi");
    let out = "", last = 0, m, i = 0, count = 0;
    while ((m = re.exec(src))){
      const start = m.index, end = start + m[0].length;
      out += escapeHtml(src.slice(last, start));
      const isCurrent = i === currentIdx;
      out += `<mark class="sfir-highlight${isCurrent ? ' current' : ''}" ${isCurrent ? 'id="sfir-current-match"' : ''}>${escapeHtml(src.slice(start, end))}</mark>`;
      last = end; i++; count++;
      // Hard cap to avoid excessive DOM for insanely frequent matches
      if (count > 2000) { out += escapeHtml(src.slice(last)); return {html: out, count}; }
    }
    out += escapeHtml(src.slice(last));
    return {html: out, count};
  };
  const {html, count} = buildHighlighted(log.body, model.previewSearch.term, model.previewSearch.index);
  setTimeout(() => {
    const el = document.getElementById('sfir-current-match');
    if (el) el.scrollIntoView({block: 'center'});
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
    containerClassName: "modalContainer"
  },
    // search toolbar
    h("div", {className: "slds-grid slds-gutters slds-m-bottom_x-small"},
      h("div", {className: "slds-col"},
        h("div", {className: "slds-form-element"},
          h("div", {className: "slds-form-element__control"},
            h("div", {className: "slds-input-has-icon slds-input-has-icon_left"},
              h("span", {className: "slds-icon_container slds-input__icon slds-input__icon_left"},
                h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#search"}))
              ),
              h("input", {type: "text", placeholder: "Find in log (Ctrl/⌘+F)", className: "slds-input sfir-preview-search-input", defaultValue: model.previewSearch.term, autoComplete: "off", onInput: (e) => model.updatePreviewSearchTermLive(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); model.nextPreviewMatch(); } }})
            )
          )
        )
      ),
      h("div", {className: "slds-col slds-grow-none slds-align_absolute-center slds-text-body_small"}, `${count ? (model.previewSearch.index + 1) : 0} / ${count}`),
      h("div", {className: "slds-col slds-grow-none"},
        h("div", {className: "slds-button_group", role: "group"},
          h("button", {className: "slds-button slds-button_neutral", onClick: () => model.prevPreviewMatch(), title: "Previous match"},
            h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#left"}))
          ),
          h("button", {className: "slds-button slds-button_neutral", onClick: () => model.nextPreviewMatch(), title: "Next match"},
            h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#right"}))
          )
        )
      )
    ),
    // log body
    h("pre", {style: {maxHeight: "60vh", overflow: "auto", background: "#f4f6f9", padding: "8px", borderRadius: "4px"}, dangerouslySetInnerHTML: {__html: html}})
  );
}

// Add CSS for preview search highlights
const style3 = document.createElement("style");
style3.textContent = `mark.sfir-highlight{background:#ffe58a;padding:0 .0rem;border-radius:2px} mark.sfir-highlight.current{background:#f8d24e;outline:1px solid #e1b600}`;
document.head.appendChild(style3);

class App extends React.Component {
  constructor(props){
    super(props);
    this.model = new Model(props.sfHost);
    this.state = { tick: 0 };
    this.model.render = () => this.setState({tick: this.state.tick + 1});
  }

  componentDidMount() {
    this.model.init();
  }

  render() {
    const {model} = this;

    return h("div", {},
      h(PageHeader, {
        pageTitle: "Logs",
        subTitle: "View and manage Salesforce logs",
        orgName: this.model.userInfoModel.userInfo,
        sfLink: `https://${this.model.sfHost}`,
        sfHost: this.model.sfHost,
        spinnerCount: this.model.spinnerCount,
        ...this.model.userInfoModel.getProps()
      }),

      h("div", {className: "slds-m-around_medium"},
        h(Filters, {model}),
        h(LogsTable, {model})
      ),

      model.previewLog ? h(PreviewModal, {model}) : null,
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
      }) : null
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
