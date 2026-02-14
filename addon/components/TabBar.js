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
 * @param {Array} props.tabs - [{ name }] from model
 * @param {number} props.activeIndex
 * @param {Function} props.onTabChange - (index) => void
 * @param {Function} props.onTabAdd - () => void
 * @param {Function} props.onTabRemove - (e, index) => void
 * @param {number} props.editingTabIndex
 * @param {string} props.editingTabName
 * @param {Function} props.onTabNameEdit - (e, index) => void
 * @param {Function} props.onTabNameSubmit - (e, index) => void
 * @param {Function} props.onEditingChange - ({ editingTabIndex, editingTabName }) => void
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
function sanitizeText(text) {
  return String(text).replace(/[<>"'&]/g, c => ({"<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;"}[c]));
}

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
          key: index,
          role: "tab",
          tabIndex: index === activeIndex ? 0 : -1,
          "aria-selected": index === activeIndex ? "true" : "false",
          "aria-label": `${sanitizeText(tab.name)}, tab ${index + 1} of ${tabs.length}`,
          "aria-controls": `tabpanel-${index}`,
          id: `tab-${index}`,
          title: tabs.length > 1 ? "Middle-click to close tab" : undefined,
          className: `sfir-tabbar__item ${index === activeIndex ? "slds-is-active" : ""} ${draggedTabIndex === index ? "sfir-tabbar__item_dragging" : ""} ${dropTargetIndex === index ? "sfir-tabbar__item_drop-target" : ""}`,
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
          ? h("input", {
              type: "text",
              className: "sfir-tabbar__name-input",
              value: editingTabName,
              onChange: (e) => onEditingChange({ editingTabName: e.target.value }),
              onBlur: (e) => onTabNameSubmit(e, index),
              onKeyDown: (e) => {
                if (e.key === "Enter") {
                  onTabNameSubmit(e, index);
                } else if (e.key === "Escape") {
                  onEditingChange({ editingTabIndex: -1, editingTabName: "" });
                }
                e.stopPropagation();
              },
              autoFocus: true,
              onClick: (e) => e.stopPropagation(),
              "aria-label": `Rename tab ${sanitizeText(tab.name)}`,
              placeholder: "Tab name"
            })
          : h("span", {
            className: "sfir-tabbar__name",
            onClick: (e) => {
              if (index === activeIndex) onTabNameEdit(e, index);
            },
            title: index === activeIndex ? "Click to rename tab" : sanitizeText(tab.name),
            "aria-hidden": "true"
          }, tab.name),
        h("button", {
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
          title: `Close ${sanitizeText(tab.name)} (or middle-click on tab)`,
          "aria-label": `Close ${sanitizeText(tab.name)} tab`,
          tabIndex: -1
        }, "×")
      )
    ),
    h("button", {
      type: "button",
      className: "sfir-tabbar__add",
      onClick: onTabAdd,
      title: "Add new tab",
      "aria-label": "Add new tab",
      role: "button"
    }, "+")
  );
}
