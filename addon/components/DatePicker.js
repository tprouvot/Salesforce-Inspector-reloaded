/* global React */
import {Combobox} from "./Combobox.js";

/**
 * Reusable SLDS2 Date / Date-time picker components
 *
 * DatePicker: text input (ISO "YYYY-MM-DD") with a calendar popup.
 * DateTimePicker: DatePicker + a searchable time Combobox, producing the
 * "YYYY-MM-DDTHH:mm:ss.SSS+0000" format the Salesforce API returns. Date-times
 * are edited in UTC so they match the raw value shown in the table.
 * Dates are typed as YYYY-MM-DD or YYYY/MM/DD (month and day may be one digit) and rewritten as YYYY-MM-DD when the
 * field is left; any other format shows a validation error.
 * Times can be typed or searched in 12h ("7:20 pm") or 24h ("19:20"; a time without
 * am/pm is 24h); the tooltip over the date and time boxes shows the same moment in the browser's time zone. Pasting a full ISO date-time into the date input fills both parts.
 *
 * @param {Object} props
 * @param {string} [props.value] - ISO date (DatePicker) or ISO date-time (DateTimePicker); "" when empty
 * @param {Function} [props.onChange] - Called with the new string (typed text is passed through as-is, so invalid input is rejected by Salesforce on save)
 * @param {Function} [props.onCancel] - Called when Escape is pressed
 * @param {Function} [props.onPasteText] - DatePicker only: called with pasted text; return true to handle the paste yourself
 * @param {boolean} [props.hasError] - Applies the SLDS error state
 * @param {string} [props.ariaLabel] - Accessible label
 * @param {string} [props.placeholder] - Placeholder of the date input
 * @param {boolean} [props.autoFocus] - Focuses the date input on mount (opens the calendar)
 * @param {string} [props.className] - Additional CSS class for the root element
 * @param {Object} [props.style] - Inline style for the root element
 *
 * Example usage:
 *
 * h(row.fieldDescribe.type == "datetime" ? DateTimePicker : DatePicker, {
 *   value: row.dataEditValue,
 *   ariaLabel: row.fieldName,
 *   onChange: value => { row.dataEditValue = value; }
 * })
 */

let h = React.createElement;

const DATE_REGEX = /^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/;
// Hour, optional minutes/seconds/millis, optional am/pm, optional UTC suffix (other offsets are not converted).
const TIME_REGEX = /^(\d{1,2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?\s*(am|pm)?(?:Z|[+-]00:?00)?$/i;
const PASTED_DATETIME_REGEX = /^(\d{4}([-/])\d{1,2}\2\d{1,2})[T ](.+)$/;
const DATE_ERROR = "Enter a valid date in YYYY-MM-DD or YYYY/MM/DD format.";
const YEAR_RANGE = 100; // Years offered either side of the current year
const POPUP_HEIGHT = 340; // Approximate popup height, only used to decide whether to flip it upward
let nextDatePickerId = 0;
// Time display format, remembered for the page session: switches to 12h once an am/pm time is entered.
let prefer12h = false;
// 15-minute slots; each list shows its own format as the main text and the other one as a hint.
const TIME_OPTIONS = {12: [], 24: []};
for (let i = 0; i < 96; i++) {
  let hour = Math.floor(i / 4);
  let minute = pad((i % 4) * 15);
  let t24 = pad(hour) + ":" + minute;
  let t12 = (hour % 12 || 12) + ":" + minute + (hour < 12 ? " am" : " pm");
  TIME_OPTIONS[24].push({value: t24, label: t24, secondaryText: t12});
  TIME_OPTIONS[12].push({value: t12, label: t12, secondaryText: t24});
}

function pad(n, length = 2) { return String(n).padStart(length, "0"); }

function toIsoDate(d) { return pad(d.getFullYear(), 4) + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

// Returns a local Date, or null for anything that isn't a real calendar date.
function parseDate(text) {
  let m = DATE_REGEX.exec(text || "");
  let d = m && new Date(+m[1], +m[3] - 1, +m[4]);
  return d && d.getFullYear() === +m[1] && d.getMonth() === +m[3] - 1 && d.getDate() === +m[4] ? d : null;
}

function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

function addMonths(d, n) {
  let lastDay = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), lastDay));
}

function moveFocus(d, key) {
  let days = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7}[key];
  return days ? addDays(d, days) : addMonths(d, key === "PageUp" ? -1 : 1);
}

// Accepts 24h ("19:20", "19:20:15.250+0000") and 12h ("7:20 pm", "7pm"); null for anything else.
function parseTime(text) {
  let m = TIME_REGEX.exec(text.trim());
  if (!m || (m[2] === undefined && !m[5])) return null;
  let hour = +m[1];
  if (m[5]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (m[5].toLowerCase() === "pm" ? 12 : 0);
  }
  return {hour, minute: m[2] || "00", second: m[3] || "00", ms: (m[4] || "").padEnd(3, "0")};
}

// "10:30:00.000+0000" -> "10:30" or "10:30 am" (seconds / milliseconds only when non-zero).
// Anything that isn't a time is returned untouched so typed text isn't lost.
function toTimeText(text, is12h) {
  let t = parseTime(text);
  if (!t) return text;
  let rest = t.second === "00" && t.ms === "000" ? "" : ":" + t.second + (t.ms === "000" ? "" : "." + t.ms);
  return is12h ? (t.hour % 12 || 12) + ":" + t.minute + rest + (t.hour < 12 ? " am" : " pm") : pad(t.hour) + ":" + t.minute + rest;
}

// UTC date + time -> the same moment in the browser's time zone ("Sat, Nov 7, 2026, 2:15 PM EST"); "" until both are valid.
function toLocalText(date, time) {
  let d = parseDate(date);
  let t = parseTime(time);
  let options = {weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short"};
  return d && t ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), t.hour, +t.minute, +t.second)).toLocaleString(undefined, options) : "";
}

// "10:30" / "10:30 am" -> "10:30:00.000+0000"; non-times are returned untouched.
function toIsoTime(text) {
  let t = parseTime(text);
  return t ? pad(t.hour) + ":" + t.minute + ":" + t.second + "." + t.ms + "+0000" : text;
}

export class DatePicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {isOpen: false, focusDate: null, dropdownStyle: null, keyboardNav: false, isTouched: false};
    this.helpId = "sfir-datepicker-" + (nextDatePickerId++) + "-help";
    ["onDocumentMouseDown", "updatePosition", "onInputChange", "onInputFocus", "onPaste", "onInputBlur", "onKeyDown", "open"].forEach(name => {
      this[name] = this[name].bind(this);
    });
  }

  componentDidMount() {
    document.addEventListener("mousedown", this.onDocumentMouseDown, true);
    if (this.props.autoFocus && this.refs.input) this.refs.input.focus();
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
    this.setPositionListeners(false);
  }

  componentDidUpdate(prevProps, prevState) {
    let {isOpen} = this.state;
    if (isOpen !== prevState.isOpen) this.setPositionListeners(isOpen);
    if (isOpen) this.updatePosition();
  }

  setPositionListeners(on) {
    let method = on ? "addEventListener" : "removeEventListener";
    window[method]("scroll", this.updatePosition, true);
    window[method]("resize", this.updatePosition);
  }

  // Fixed positioning so the popup escapes the table's overflow clipping; flips upward when there is no room below.
  updatePosition() {
    let {container, popup} = this.refs;
    if (!this.state.isOpen || !container) return;
    let rect = container.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return this.close();
    let spaceBelow = window.innerHeight - rect.bottom;
    let openUp = spaceBelow < POPUP_HEIGHT && rect.top > spaceBelow;
    let style = {
      position: "fixed",
      left: Math.max(0, Math.min(rect.left, window.innerWidth - (popup ? popup.offsetWidth : 0))) + "px",
      top: openUp ? "auto" : rect.bottom + 2 + "px",
      bottom: openUp ? window.innerHeight - rect.top + 2 + "px" : "auto",
      transform: "none",
      margin: 0
    };
    if (JSON.stringify(style) !== JSON.stringify(this.state.dropdownStyle)) this.setState({dropdownStyle: style});
  }

  onDocumentMouseDown(e) {
    if (this.state.isOpen && !this.isInside(e.target)) this.close();
  }

  isInside(node) {
    let {container, popup} = this.refs;
    return !!node && ((container && container.contains(node)) || (popup && popup.contains(node)));
  }

  open() {
    if (!this.state.isOpen) this.setState({isOpen: true, focusDate: parseDate(this.props.value) || new Date(), keyboardNav: false});
  }

  close() { this.setState({isOpen: false, dropdownStyle: null}); }

  pick(d) {
    this.props.onChange(toIsoDate(d));
    this.close();
    this.refs.input.focus();
  }

  onInputChange(e) {
    let value = e.target.value;
    let d = parseDate(value);
    this.open();
    this.props.onChange(value);
    this.setState({keyboardNav: false, ...(d && {focusDate: d})});
  }

  // Accepted spellings (2026/11/06, 2026-1-7) are rewritten to the ISO form the API needs once the field is left.
  onInputBlur() {
    let {value, onChange} = this.props;
    let d = parseDate(value);
    if (d && toIsoDate(d) !== value) onChange(toIsoDate(d));
    this.setState({isTouched: true});
  }

  // Partial typing isn't flagged until the field is left or long enough to be a full date.
  dateError() {
    let value = this.props.value || "";
    return value !== "" && (this.state.isTouched || value.length >= 10) && !parseDate(value) ? DATE_ERROR : null;
  }

  onPaste(e) {
    if (this.props.onPasteText && this.props.onPasteText(e.clipboardData.getData("text"))) e.preventDefault();
  }

  // Focus coming back from the year select inside the popup must not reopen it.
  onInputFocus(e) {
    if (!this.isInside(e.relatedTarget)) this.open();
  }

  onKeyDown(e) {
    let {isOpen, focusDate, keyboardNav} = this.state;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.close();
        if (this.props.onCancel) this.props.onCancel();
        break;
      case "Tab":
        this.close();
        break;
      case "Enter":
        e.preventDefault();
        isOpen ? this.pick(focusDate) : this.open();
        break;
      case "ArrowLeft":
      case "ArrowRight":
        // Left/Right keep moving the text caret until navigation starts with Up/Down/Page keys (typing or clicking the input ends it).
        if (!isOpen || !keyboardNav) break;
      // falls through
      case "ArrowDown":
      case "ArrowUp":
      case "PageDown":
      case "PageUp":
        e.preventDefault();
        isOpen ? this.setState({keyboardNav: true, focusDate: moveFocus(focusDate, e.key)}) : this.open();
        break;
    }
  }

  renderNavButton(delta, icon, title) {
    return h("div", {className: "slds-align-middle"},
      h("button", {
        type: "button",
        className: "slds-button slds-button_icon slds-button_icon-container",
        title,
        tabIndex: -1,
        onMouseDown: e => {
          e.preventDefault();
          this.setState({focusDate: addMonths(this.state.focusDate, delta)});
        }
      },
      h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#" + icon})),
      h("span", {className: "slds-assistive-text"}, title)
      )
    );
  }

  renderPopup() {
    let {focusDate, dropdownStyle, keyboardNav} = this.state;
    let selectedDate = parseDate(this.props.value);
    let selectedIso = selectedDate ? toIsoDate(selectedDate) : null;
    let todayIso = toIsoDate(new Date());
    let focusIso = toIsoDate(focusDate);
    let year = focusDate.getFullYear();
    let month = focusDate.getMonth();
    let firstOfMonth = new Date(year, month, 1);
    let gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
    let weekdays = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(2023, 0, 1 + i)); // 2023-01-01 is a Sunday
    let years = [];
    let thisYear = new Date().getFullYear();
    for (let y = Math.min(thisYear - YEAR_RANGE, year); y <= Math.max(thisYear + YEAR_RANGE, year); y++) years.push(h("option", {key: y, value: y}, y));
    let renderDay = d => {
      let iso = toIsoDate(d);
      return h("td", {
        key: iso,
        role: "gridcell",
        "aria-selected": iso === selectedIso,
        className: "sfir-border-none"
          + (d.getMonth() !== month ? " slds-day_adjacent-month" : "")
          + (iso === todayIso ? " slds-is-today" : "")
          + (iso === selectedIso ? " slds-is-selected" : "")
          + (keyboardNav && iso === focusIso ? " sfir-day-focus" : ""),
        onMouseDown: e => {
          e.preventDefault();
          this.pick(d);
        }
      }, h("span", {className: "slds-day"}, d.getDate()));
    };
    return h("div", {
      ref: "popup",
      className: "slds-datepicker slds-dropdown slds-dropdown_left sfir-combobox-dropdown",
      role: "dialog",
      "aria-label": "Date picker",
      title: "", // the table row's field tooltip would otherwise show over the popup
      style: dropdownStyle || {position: "fixed", visibility: "hidden"}
    },
    h("div", {className: "slds-datepicker__filter slds-grid"},
      h("div", {className: "slds-datepicker__filter_month slds-grid slds-grid_align-spread slds-grow"},
        this.renderNavButton(-1, "left", "Previous Month"),
        h("h2", {className: "slds-align-middle", "aria-live": "polite"}, focusDate.toLocaleDateString(undefined, {month: "long"})),
        this.renderNavButton(1, "right", "Next Month")
      ),
      h("div", {className: "slds-shrink-none"},
        h("div", {className: "slds-select_container"},
          h("select", {
            className: "slds-select",
            "aria-label": "Pick a Year",
            value: year,
            onChange: e => this.setState({focusDate: addMonths(focusDate, (+e.target.value - year) * 12)})
          }, years)
        )
      )
    ),
    h("table", {className: "slds-datepicker__month", role: "grid"},
      h("thead", null,
        h("tr", {className: "sfir-border-none"}, weekdays.map(d =>
          h("th", {key: d.getDay(), scope: "col", className: "sfir-border-none"},
            h("abbr", {title: d.toLocaleDateString(undefined, {weekday: "long"})}, d.toLocaleDateString(undefined, {weekday: "short"}))
          )
        ))
      ),
      h("tbody", null, [0, 1, 2, 3, 4, 5].map(week =>
        h("tr", {key: week, className: "sfir-border-none"}, [0, 1, 2, 3, 4, 5, 6].map(i => renderDay(addDays(gridStart, week * 7 + i))))
      ))
    ),
    h("button", {
      type: "button",
      className: "slds-button slds-align_absolute-center slds-text-link",
      onMouseDown: e => {
        e.preventDefault();
        this.pick(new Date());
      }
    }, "Today")
    );
  }

  render() {
    let {value, hasError, ariaLabel, placeholder = "YYYY-MM-DD", className, style} = this.props;
    let {isOpen} = this.state;
    let error = this.dateError();
    // The container wraps the error text too, so the popup opens below it rather than covering it.
    return h("div", {ref: "container", className: (className || "") + (hasError || error ? " slds-has-error" : ""), style},
      h("div", {className: "slds-form-element__control slds-input-has-icon slds-input-has-icon_right"},
        h("input", {
          ref: "input",
          type: "text",
          className: "slds-input sfir-date-input",
          value: value || "",
          placeholder,
          "aria-label": ariaLabel,
          "aria-haspopup": "dialog",
          "aria-expanded": isOpen,
          "aria-invalid": !!error,
          "aria-describedby": error ? this.helpId : undefined,
          autoComplete: "off",
          spellCheck: false,
          onChange: this.onInputChange,
          onFocus: this.onInputFocus,
          onBlur: this.onInputBlur,
          onClick: () => {
            this.setState({keyboardNav: false});
            this.open();
          },
          onPaste: this.onPaste,
          onKeyDown: this.onKeyDown
        }),
        h("button", {
          type: "button",
          className: "slds-button slds-button_icon slds-input__icon slds-input__icon_right",
          title: "Select a Date",
          tabIndex: -1,
          onMouseDown: e => {
            e.preventDefault();
            if (isOpen) return this.close();
            this.refs.input.focus();
            this.open();
          }
        },
        h("svg", {className: "slds-button__icon", "aria-hidden": "true"}, h("use", {xlinkHref: "symbols.svg#event"})),
        h("span", {className: "slds-assistive-text"}, "Select a Date")
        ),
        isOpen ? this.renderPopup() : null
      ),
      error ? h("div", {className: "slds-form-element__help", id: this.helpId}, error) : null
    );
  }
}

export class DateTimePicker extends React.Component {
  constructor(props) {
    super(props);
    // What the user typed in the time box. Kept while it still means the stored time, so the text isn't reformatted while typing.
    this.state = {typedTime: null};
    ["onDateChange", "onPasteText", "onTimeChange", "onTimeBlur"].forEach(name => {
      this[name] = this[name].bind(this);
    });
  }

  parts() {
    let text = this.props.value || "";
    let tIndex = text.indexOf("T");
    let storedTime = tIndex < 0 ? "" : toTimeText(text.slice(tIndex + 1), prefer12h);
    let {typedTime} = this.state;
    return {
      date: tIndex < 0 ? text : text.slice(0, tIndex),
      time: typedTime !== null && toIsoTime(typedTime) === toIsoTime(storedTime) ? typedTime : storedTime
    };
  }

  // Clearing the date clears the whole value; a new date keeps the time (midnight when none).
  onDateChange(d) {
    let {time} = this.parts();
    this.props.onChange(d === "" ? "" : d + "T" + (time ? toIsoTime(time) : "00:00:00.000+0000"));
  }

  // Pasting a full ISO date-time ("2026-11-06T19:15:00.000+0000") fills both the date and the time.
  onPasteText(pasted) {
    let m = PASTED_DATETIME_REGEX.exec(pasted.trim());
    let d = m && parseDate(m[1]);
    if (!d || !parseTime(m[3])) return false;
    this.setState({typedTime: null});
    this.props.onChange(toIsoDate(d) + "T" + toIsoTime(m[3]));
    return true;
  }

  // A time without a date uses today; an empty time stays empty so Salesforce flags it rather than silently picking midnight.
  onTimeChange(t) {
    let {date} = this.parts();
    this.setState({typedTime: t});
    this.props.onChange(date === "" && t.trim() === "" ? "" : (date || toIsoDate(new Date())) + "T" + toIsoTime(t));
  }

  // Once the time box is left, show the normalized text and remember 12h / 24h from what was entered.
  onTimeBlur() {
    let t = this.state.typedTime;
    if (t === null) return;
    if (/(am|pm)$/i.test(t.trim())) prefer12h = true;
    else if (parseTime(t)) prefer12h = false;
    this.setState({typedTime: null});
  }

  render() {
    let {onCancel, hasError, ariaLabel, autoFocus, className, style} = this.props;
    let {date, time} = this.parts();
    // Always set (also over the date box), so hovering never falls through to the table row's field tooltip.
    let localText = toLocalText(date, time);
    let tooltip = "Time is in UTC." + (localText ? " Local time: " + localText : "");
    // Wraps the time under the date when the cell is too narrow for both.
    return h("div", {className: "slds-grid slds-wrap " + (className || ""), style: Object.assign({gap: "0.25rem"}, style), title: tooltip},
      h(DatePicker, {
        style: {flex: "1 1 9rem"},
        value: date,
        hasError,
        ariaLabel: ariaLabel + " (date)",
        autoFocus,
        onChange: this.onDateChange,
        onPasteText: this.onPasteText,
        onCancel
      }),
      h(Combobox, {
        style: {flex: "1 1 7rem"},
        isSearchable: true,
        hideEmpty: true,
        showSecondaryText: true,
        icon: "clock",
        dropdownWidth: "11rem",
        options: TIME_OPTIONS[prefer12h ? 12 : 24],
        value: time,
        hasError,
        placeholder: prefer12h ? "h:mm am UTC" : "HH:mm UTC",
        title: tooltip,
        ariaLabel: ariaLabel + " (time, UTC)",
        onChange: this.onTimeChange,
        onBlur: this.onTimeBlur,
        onCancel
      })
    );
  }
}
