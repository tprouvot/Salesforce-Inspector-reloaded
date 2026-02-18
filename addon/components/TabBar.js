/* global React */
let h = React.createElement;

/**
 * Shared TabBar component - SLDS Scoped Tabs structure.
 * Supports "simple" mode (static tabs, popup) and "advanced" mode (dynamic, editable, closable, reorderable).
 *
 * Simple mode props:
 * @param {Array} props.tabs - [{ id, content }] - content is string or React nodes for link
 * @param {string} props.activeId - id of active tab
 * @param {Function} props.onTabChange - (id) => void
 * @param {string} [props.ariaLabel] - "Tabs" or similar
 *
 * Advanced mode props:
 * @param {Array} props.tabs - [{ id?, name }] from model; id is optional, used as stable React key for reorderable tabs
 * @param {number} props.activeIndex
 * @param {Function} props.onTabChange - (index) => void
 * @param {Function} props.onTabAdd - () => void
 * @param {Function} props.onTabRemove - (e, index) => void
 * @param {number} props.editingTabIndex
 * @param {string} props.editingTabName
 * @param {Function} props.onTabNameEdit - (e, index) => void
 * @param {Function} props.onTabNameSubmit - (e, index) => void
 * @param {Function} props.onEditingChange - ({ editingTabIndex, editingTabName, editingTabError }) => void
 * @param {string} [props.editingTabError] - Validation error message when tab name is invalid
 * @param {number} [props.maxTabNameLength=50] - Max length for tab name input
 * @param {number} props.draggedTabIndex
 * @param {number} props.dropTargetIndex
 * @param {Function} props.onTabDragStart - (e, index) => void
 * @param {Function} props.onTabDragOver - (e, index) => void
 * @param {Function} props.onTabDragLeave - (e) => void
 * @param {Function} props.onTabDrop - (e, index) => void
 * @param {Function} props.onTabDragEnd - (e) => void
 * @param {Function} props.onTabKeyDown - (e, index) => void
 * @param {Function} props.onTabContextMenu - (e, index) => void
 * @param {Function} props.onTabMouseUp - (e, index) => void
 * @param {Function} props.onTabClick - (e, index) => void
 */
let pendingCursorOffset = null;
let pendingNameWidth = null;

export function TabBar(props) {
  const { mode = "simple", tabs = [], ariaLabel = "Tabs" } = props;

  if (mode === "simple") {
    return h(
      "div",
      { className: "slds-tabs_scoped slds-p-bottom_xx-small" },
      h(
        "ul",
        { className: "slds-tabs_scoped__nav", role: "tablist", "aria-label": ariaLabel },
        tabs.map((tab) => {
          const isActive = props.activeId === tab.id;
          return h(
            "li",
            {
              key: tab.id,
              role: "tab",
              tabIndex: isActive ? 0 : -1,
              "aria-selected": isActive,
              "data-aspect": tab.id,
              onClick: (e) => props.onTabChange(e, tab.id),
              className: isActive ? "slds-tabs_scoped__item slds-is-active" : "slds-tabs_scoped__item"
            },
            h("span", { className: "slds-tabs_scoped__link" }, ...(Array.isArray(tab.content) ? tab.content : [tab.content]))
          );
        })
      )
    );
  }

  // Advanced mode - Lightning-inspired with dynamic/editable tabs
  const {
    activeIndex,
    onTabAdd,
    onTabRemove,
    editingTabIndex,
    editingTabName,
    editingTabError,
    maxTabNameLength = 50,
    onTabNameEdit,
    onTabNameSubmit,
    onEditingChange,
    draggedTabIndex = -1,
    dropTargetIndex = -1,
    onTabDragStart,
    onTabDragOver,
    onTabDragLeave,
    onTabDrop,
    onTabDragEnd,
    onTabKeyDown,
    onTabContextMenu,
    onTabMouseUp,
    onTabClick
  } = props;

  return h(
    "div",
    {
      className: "sfir-tabbar sfir-tabbar_advanced",
      role: "tablist",
      "aria-label": ariaLabel,
      "aria-orientation": "horizontal",
      onDragLeave: onTabDragLeave
    },
    tabs.map((tab, index) =>
      h(
        "div",
        {
          key: tab.id || `tab-${tab.name}`,
          role: "tab",
          tabIndex: index === activeIndex ? 0 : -1,
          "aria-selected": index === activeIndex ? "true" : "false",
          "aria-label": `${tab.name}, tab ${index + 1} of ${tabs.length}`,
          "aria-controls": `tabpanel-${index}`,
          id: `tab-${index}`,
          title: tabs.length > 1 ? "Middle-click to close tab" : undefined,
          className: ["sfir-tabbar__item", index === activeIndex && "slds-is-active", draggedTabIndex === index && "sfir-tabbar__item_dragging", dropTargetIndex === index && "sfir-tabbar__item_drop-target"].filter(Boolean).join(" "),
          ref: editingTabIndex !== index ? (el) => { if (el) el.style.minWidth = ""; } : undefined,
          onClick: (e) => onTabClick(e, index),
          onKeyDown: (e) => onTabKeyDown(e, index),
          onMouseUp: (e) => onTabMouseUp(e, index),
          draggable: editingTabIndex !== index,
          onDragStart: (e) => onTabDragStart(e, index),
          onDragOver: (e) => onTabDragOver(e, index),
          onDragLeave: onTabDragLeave,
          onDrop: (e) => onTabDrop(e, index),
          onDragEnd: onTabDragEnd,
          onContextMenu: (e) => onTabContextMenu(e, index)
        },
        editingTabIndex === index
          ? h("span", {
              className: "sfir-tabbar__edit-wrapper",
              ref: (el) => {
                if (el && pendingNameWidth !== null) {
                  el.style.width = pendingNameWidth + "px";
                  pendingNameWidth = null;
                }
              }
            },
              h("input", {
                type: "text",
                className: `sfir-tabbar__name-input ${editingTabError ? "sfir-tabbar__name-input_invalid" : ""}`,
                value: editingTabName,
                maxLength: maxTabNameLength,
                onChange: (e) => onEditingChange({ editingTabName: e.target.value, editingTabError: "" }),
                onBlur: (e) => onTabNameSubmit(e, index),
                onKeyDown: (e) => {
                  if (e.key === "Enter") {
                    onTabNameSubmit(e, index);
                  } else if (e.key === "Escape") {
                    onEditingChange({ editingTabIndex: -1, editingTabName: "", editingTabError: "" });
                  }
                  e.stopPropagation();
                },
                autoFocus: true,
                ref: (el) => {
                  if (el && pendingCursorOffset !== null) {
                    const pos = Math.min(pendingCursorOffset, el.value.length);
                    pendingCursorOffset = null;
                    setTimeout(() => el.setSelectionRange(pos, pos), 0);
                  }
                },
                onClick: (e) => e.stopPropagation(),
                "aria-label": `Rename tab ${tab.name}`,
                "aria-invalid": editingTabError ? "true" : undefined,
                "aria-describedby": editingTabError ? `sfir-tabbar__error-${index}` : undefined,
                placeholder: "Tab name"
              }),
              editingTabError && h("span", {
                id: `sfir-tabbar__error-${index}`,
                className: "sfir-tabbar__name-error",
                role: "alert"
              }, editingTabError)
            )
          : h("span", {
            className: "sfir-tabbar__name",
            onClick: (e) => {
              if (index === activeIndex) {
                const tabEl = e.currentTarget.closest(".sfir-tabbar__item");
                if (tabEl) tabEl.style.minWidth = tabEl.offsetWidth + "px";
                pendingNameWidth = e.currentTarget.offsetWidth;
                if (document.caretPositionFromPoint) {
                  const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                  pendingCursorOffset = pos ? pos.offset : null;
                } else if (document.caretRangeFromPoint) {
                  const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                  pendingCursorOffset = range ? range.startOffset : null;
                }
                onTabNameEdit(e, index);
              }
            },
            title: index === activeIndex ? "Click to rename tab" : tab.name,
            "aria-hidden": "true"
          }, tab.name),
        tabs.length > 1 ? h("button", {
          type: "button",
          className: "sfir-tabbar__close",
          onClick: (e) => {
            e.stopPropagation();
            onTabRemove(e, index);
          },
          onMouseDown: (e) => {
            // Prevent mousedown on close button from triggering tab activation
            e.stopPropagation();
          },
          onMouseUp: (e) => {
            // Prevent middle-click from bubbling to tab's onMouseUp
            // The tab's onMouseUp will handle the close, so stop propagation here
            if (e.button === 1) {
              e.stopPropagation();
            }
          },
          title: `Close ${tab.name} (or middle-click on tab)`,
          "aria-label": `Close ${tab.name} tab`,
          tabIndex: -1
        }, "×") : null
      )
    ),
    h("button", {
      type: "button",
      className: "sfir-tabbar__add",
      onClick: onTabAdd,
      title: "Add new tab",
      "aria-label": "Add new tab"
    }, "+")
  );
}
