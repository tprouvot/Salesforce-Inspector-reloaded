/* global React */
import ConfirmModal from "./ConfirmModal.js";

let h = React.createElement;

const PAGE_SIZE = 30;
const RESIZE_CORNER_PX = 12;
const ALL_SOURCE_ORDER = ["saved", "history", "templates"];

function isInResizeCorner(listbox, clientX, clientY, target) {
  if (!listbox || target?.closest?.(".sfir-combobox-delete")) {
    return false;
  }
  const rect = listbox.getBoundingClientRect();
  return clientX >= rect.right - RESIZE_CORNER_PX && clientY >= rect.bottom - RESIZE_CORNER_PX;
}

function orderSourcesForAll(sources) {
  const ordered = ALL_SOURCE_ORDER
    .map(id => sources.find(source => source.id === id))
    .filter(Boolean);
  sources.forEach(source => {
    if (!ordered.includes(source)) {
      ordered.push(source);
    }
  });
  return ordered;
}

export class SldsCombobox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      visibleCount: PAGE_SIZE
    };
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleWindowMouseUp = this.handleWindowMouseUp.bind(this);
    this.containerRef = null;
    this.isResizing = false;
    this.resizeStartHeight = 0;
  }

  componentDidMount() {
    if (this.props.isOpen) {
      this.listenForOutsideClick();
      this.alignDropdown();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleDocumentClick);
    window.removeEventListener("mouseup", this.handleWindowMouseUp);
  }

  componentDidUpdate(prevProps) {
    if (this.props.isOpen && !prevProps.isOpen) {
      this.listenForOutsideClick();
    } else if (!this.props.isOpen && prevProps.isOpen) {
      document.removeEventListener("mousedown", this.handleDocumentClick);
    }
    const shouldResetBatch = (this.props.isOpen && !prevProps.isOpen)
      || this.props.value !== prevProps.value
      || this.props.sourceKey !== prevProps.sourceKey;
    if (shouldResetBatch && this.state.visibleCount !== PAGE_SIZE) {
      this.setState({visibleCount: PAGE_SIZE});
    } else if (this.props.isOpen && this.props.activeIndex >= this.state.visibleCount) {
      this.setState({visibleCount: this.props.activeIndex + 1});
    }
    if (this.props.isOpen) {
      // Entries change the width and content height, so re-check bounds on every open render.
      this.alignDropdown();
    }
    if (this.props.isOpen && this.props.activeIndex !== prevProps.activeIndex) {
      this.scrollToActiveItem();
    }
  }

  // Listens on mousedown rather than click: deleting an entry resizes the dropdown,
  // so by the time the click fires the pointer can sit outside it even though the
  // interaction started inside. Deferred so the press that opened it is not counted.
  listenForOutsideClick() {
    setTimeout(() => document.addEventListener("mousedown", this.handleDocumentClick), 0);
  }

  // Where the input sits in the toolbar depends on the org name, so a fixed side
  // would hang off one edge or the other. Open towards whichever side has more
  // room; the max-width in CSS keeps the dropdown inside the window either way.
  alignDropdown() {
    const box = document.getElementById(this.props.id + "-listbox");
    if (!box || !this.containerRef) {
      return;
    }
    const anchor = this.containerRef.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const openLeft = viewportWidth - anchor.left >= anchor.right;
    box.classList.toggle("slds-dropdown_left", openLeft);
    box.classList.toggle("slds-dropdown_right", !openLeft);
    box.style.setProperty("--sfir-query-dropdown-available-width", (openLeft ? viewportWidth - anchor.left : anchor.right) + "px");
    if (!this.isResizing) {
      box.style.height = "";
      box.style.maxHeight = "";
      const boxTop = box.getBoundingClientRect().top;
      const availableHeight = Math.max(0, document.documentElement.clientHeight - boxTop);
      const storedHeight = Number.parseFloat(localStorage.getItem("sfirComboboxHeight_" + this.props.id));
      if (Number.isFinite(storedHeight) && storedHeight > 0) {
        box.style.maxHeight = Math.min(storedHeight, availableHeight) + "px";
      } else if (box.getBoundingClientRect().bottom > document.documentElement.clientHeight) {
        box.style.maxHeight = availableHeight + "px";
      }
    }
  }

  handleWindowMouseUp() {
    window.removeEventListener("mouseup", this.handleWindowMouseUp);
    if (!this.isResizing) {
      return;
    }
    const box = document.getElementById(this.props.id + "-listbox");
    if (box) {
      const currentHeight = box.getBoundingClientRect().height;
      const heightChanged = Math.abs(currentHeight - this.resizeStartHeight) >= 1;
      if (heightChanged) {
        localStorage.setItem("sfirComboboxHeight_" + this.props.id, currentHeight + "px");
      }
    }
    this.isResizing = false;
    this.resizeStartHeight = 0;
    this.alignDropdown();
  }

  handleDocumentClick(e) {
    const clickedInside = this.containerRef && (this.containerRef.contains(e.target) || e.composedPath?.().includes(this.containerRef));
    if (this.props.isOpen && !clickedInside && this.props.onClose) {
      this.props.onClose();
    }
  }

  scrollToActiveItem() {
    const item = document.getElementById(this.props.id + "-listbox-option-" + this.props.activeIndex);
    if (item) {
      item.scrollIntoView({block: "nearest"});
    }
  }

  render() {
    const {
      id,
      placeholder,
      value,
      entries,
      isOpen,
      activeIndex,
      onInput,
      onFocus,
      onClick,
      onKeyDown,
      onSelect,
      onDelete,
      canDelete,
      getGroup,
      renderItem,
      className = "",
      "aria-label": ariaLabel
    } = this.props;

    const listboxId = id + "-listbox";
    const hintId = id + "-delete-hint";
    const limit = Math.max(this.state.visibleCount, activeIndex + 1);
    const visibleEntries = entries.length > limit ? entries.slice(0, limit) : entries;

    // SLDS Markup Structure and Accessibility Attributes
    return h("div", {
      className: "slds-form-element " + className,
      ref: (el) => { this.containerRef = el; }
    },
    h("div", {className: "slds-form-element__control"},
      h("div", {className: "slds-combobox_container"},
        h("div", {
          className: "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click" + (isOpen ? " slds-is-open" : "")
        },
        // role="none" removes the wrapper from the accessibility tree as per SLDS guidelines.
        h("div", {className: "slds-combobox__form-element slds-input-has-icon slds-input-has-icon_right", role: "none"},
          h("input", {
            id: id + "-input",
            type: "text",
            className: "slds-input slds-combobox__input",
            "aria-autocomplete": "list",
            "aria-controls": listboxId,
            "aria-expanded": isOpen ? "true" : "false",
            "aria-haspopup": "listbox",
            "aria-activedescendant": activeIndex >= 0 ? listboxId + "-option-" + activeIndex : null,
            "aria-label": ariaLabel,
            "aria-describedby": onDelete ? hintId : null,
            autoComplete: "off",
            role: "combobox",
            placeholder,
            value,
            onInput,
            onFocus,
            onClick,
            onKeyDown
          }),
          h("span", {className: "slds-icon_container slds-icon-utility-search slds-input__icon slds-input__icon_right sfir-combobox-search-icon"},
            h("svg", {className: "slds-icon slds-icon_x-small slds-icon-text-default", "aria-hidden": "true"},
              h("use", {xlinkHref: "symbols.svg#search"})
            )
          )
        ),
        isOpen && h("div", {
          id: listboxId,
          // Horizontal alignment is set by alignDropdown, not an SLDS modifier.
          className: "slds-dropdown slds-dropdown_length-7 sfir-query-combobox-dropdown",
          role: "listbox",
          onScroll: (e) => {
            const box = e.currentTarget;
            if (this.state.visibleCount < entries.length && box.scrollTop + box.clientHeight >= box.scrollHeight - 80) {
              this.setState(state => ({visibleCount: Math.min(entries.length, state.visibleCount + PAGE_SIZE)}));
            }
          },
          onMouseDown: (e) => {
            // Keep input focus for rows and padding, but leave native controls interactive.
            const box = e.currentTarget;
            const isContainer = e.target === box;
            const isScrollbar = isContainer && e.nativeEvent.offsetX >= box.clientWidth;
            const isResizeHandle = isInResizeCorner(box, e.clientX, e.clientY, e.target);
            this.isResizing = isResizeHandle;
            if (isResizeHandle) {
              const rect = box.getBoundingClientRect();
              this.resizeStartHeight = rect.height;
              box.style.height = this.resizeStartHeight + "px";
              box.style.maxHeight = Math.max(0, document.documentElement.clientHeight - rect.top) + "px";
              window.addEventListener("mouseup", this.handleWindowMouseUp);
            }
            if (!isScrollbar && !isResizeHandle) {
              e.preventDefault();
            }
          }
        },
        h("ul", {className: "slds-listbox slds-listbox_vertical", role: "presentation"},
          visibleEntries.length === 0 ? h("li", {role: "presentation", className: "slds-listbox__item"},
            h("div", {className: "slds-media slds-media_center slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-option"},
              h("span", {className: "slds-media__body"},
                h("span", {className: "slds-truncate"}, "No results found")
              )
            )
          ) : visibleEntries.reduce((items, entry, index) => {
            const group = getGroup ? getGroup(entry) : null;
            const prevGroup = getGroup && index > 0 ? getGroup(visibleEntries[index - 1]) : null;
            if (group && group !== prevGroup) {
              items.push(
                h("li", {key: "group-" + group, role: "presentation", className: "slds-listbox__item"},
                  h("div", {className: "slds-media slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-group-header", role: "presentation"},
                    h("h3", {className: "slds-listbox__option-header", role: "presentation"}, group)
                  )
                )
              );
            }
            const showDelete = Boolean(onDelete && (!canDelete || canDelete(entry)));
            items.push(
              h("li", {key: "opt-" + index, role: "presentation", className: "slds-listbox__item"},
                h("div", {
                  id: listboxId + "-option-" + index,
                  className: "slds-media slds-media_center slds-listbox__option slds-listbox__option_plain slds-media_small sfir-combobox-option" + (index === activeIndex ? " slds-has-focus" : ""),
                  role: "option",
                  "aria-selected": index === activeIndex ? "true" : "false",
                  onMouseDown: (e) => {
                    const box = e.currentTarget.closest("[role='listbox']");
                    if (isInResizeCorner(box, e.clientX, e.clientY, e.target)) {
                      return;
                    }
                    // The delete affordance is nested in the option, so ignore its clicks here.
                    if (e.target.closest(".sfir-combobox-delete")) {
                      return;
                    }
                    e.preventDefault();
                    onSelect(entry);
                  }
                },
                h("span", {className: "slds-media__body sfir-combobox-body"}, renderItem(entry)),
                // Pointer shortcut only: options stay atomic for assistive technology,
                // which deletes with the Delete key announced by the hint below.
                showDelete && h("span", {
                  className: "slds-button slds-button_icon slds-button_icon-x-small slds-m-left_x-small sfir-combobox-delete",
                  title: "Delete this item",
                  "aria-hidden": "true",
                  onMouseDown: (e) => {
                    e.preventDefault();
                    onDelete(entry, index);
                  }
                },
                h("svg", {className: "slds-button__icon"},
                  h("use", {xlinkHref: "symbols.svg#delete"})
                )
                )
                )
              )
            );
            return items;
          }, [])
        )
        )
        )
      )
    ),
    onDelete && h("span", {id: hintId, className: "slds-assistive-text"}, "Press Delete to remove the highlighted entry.")
    );
  }
}

export class QueryToolbar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sourceId: "all",
      searchValue: "",
      isOpen: false,
      activeIndex: -1
    };
    this.onSearchInput = this.onSearchInput.bind(this);
    this.onClear = this.onClear.bind(this);
  }

  buildAllSource() {
    const orderedSources = orderSourcesForAll(this.props.sources);
    const hasRemovableSource = orderedSources.some(source => Boolean(source.remove));
    return {
      id: "all",
      label: "All",
      entries: [],
      getResults: (_, searchValue) => {
        const results = orderedSources.map(source => ({
          source,
          result: source.getResults(source.entries, searchValue)
        }));
        if (results.some(({result}) => result.isObjectSuggest)) {
          const vocab = new Set();
          results.forEach(({result}) => result.entries.forEach(name => vocab.add(name)));
          return {entries: Array.from(vocab).sort(), isObjectSuggest: true};
        }
        const combined = [];
        results.forEach(({source, result}) => {
          result.entries.forEach(entry => combined.push({entry, source}));
        });
        return {entries: combined, isObjectSuggest: false};
      },
      renderEntry: (item, searchValue, isObjectSuggest) => (isObjectSuggest
        ? orderedSources[0].renderEntry(item, searchValue, true)
        : item.source.renderEntry(item.entry, searchValue, false)),
      select: (item) => item.source.select(item.entry),
      remove: hasRemovableSource ? (item) => item.source.remove?.(item.entry) : null,
      canDelete: (item) => Boolean(item?.source?.remove),
      getGroup: (item) => item?.source?.label || null,
      clear: null,
      clearLabel: "Select History or Saved to clear",
      clearAriaLabel: "Clear list"
    };
  }

  allSources() {
    return [this.buildAllSource(), ...this.props.sources];
  }

  activeSource() {
    if (this.state.sourceId === "all") {
      return this.buildAllSource();
    }
    return this.props.sources.find(source => source.id === this.state.sourceId) || this.buildAllSource();
  }

  openDropdown() {
    this.setState({isOpen: true, activeIndex: -1});
  }

  closeDropdown() {
    this.setState({isOpen: false, activeIndex: -1});
  }

  onSourceChange(sourceId) {
    this.setState({sourceId, searchValue: "", isOpen: false, activeIndex: -1});
  }

  onSearchInput(e) {
    this.setState({searchValue: e.target.value, activeIndex: -1, isOpen: true});
  }

  onClear(e) {
    const source = this.activeSource();
    if (source.clear && source.clear(e)) {
      const {sourceId} = this.state;
      this.setState({searchValue: "", isOpen: false, activeIndex: -1}, () => {
        // Clearing disables the button that held focus. Move focus to the selected source
        // after React has rendered the empty state instead of dropping it on <body>.
        setTimeout(() => document.getElementById("sfir-query-source-" + sourceId)?.focus(), 0);
      });
    }
  }

  onDeleteEntry(entry, source) {
    if (source.remove && (!source.canDelete || source.canDelete(entry))) {
      source.remove(entry);
      this.setState({activeIndex: -1});
    }
  }

  applyEntry(entry, isObjectSuggest, source) {
    if (isObjectSuggest) {
      this.setState({searchValue: `?${entry} `, activeIndex: 0});
    } else {
      source.select(entry);
      this.closeDropdown();
    }
  }

  onKeyDown(e, entries, isObjectSuggest, source) {
    const {activeIndex, isOpen} = this.state;
    if (e.key === "Escape") {
      e.preventDefault();
      this.closeDropdown();
      return;
    }
    // A closed list must never act on an entry the user cannot see.
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        this.openDropdown();
      }
      return;
    }
    const count = entries.length;
    if (e.key === "Tab") {
      // Tab keeps moving focus, so it accepts the highlighted entry and closes the list.
      if (activeIndex >= 0 && count) {
        this.applyEntry(entries[Math.min(activeIndex, count - 1)], isObjectSuggest, source);
      }
      this.closeDropdown();
      return;
    }
    if (!count) {
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        this.applyEntry(entries[Math.min(activeIndex, count - 1)], isObjectSuggest, source);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.setState({activeIndex: (activeIndex + 1) % count});
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.setState({activeIndex: activeIndex < 0 ? count - 1 : (activeIndex - 1 + count) % count});
    } else if (e.key === "Delete" && !isObjectSuggest && activeIndex >= 0 && source.remove) {
      const target = entries[activeIndex];
      if (!source.canDelete || source.canDelete(target)) {
        e.preventDefault();
        this.onDeleteEntry(target, source);
      }
    }
  }

  render() {
    const {isOpen, activeIndex, searchValue} = this.state;
    const radioOptions = this.allSources();
    const source = radioOptions.find(option => option.id === this.state.sourceId) || radioOptions[0];
    const {entries, isObjectSuggest} = isOpen
      ? source.getResults(source.entries, searchValue)
      : {entries: [], isObjectSuggest: false};

    return h("div", {className: "sfir-query-toolbar", role: "group", "aria-label": "Queries"},
      h("div", {className: "sfir-query-section__browse"},
        h("div", {className: "slds-radio_button-group", role: "radiogroup", "aria-label": "Query source"},
          radioOptions.map(({id, label}) =>
            h("span", {key: id, className: "slds-button slds-radio_button"},
              h("input", {
                type: "radio",
                name: "sfir-query-source",
                id: "sfir-query-source-" + id,
                checked: source.id === id,
                onChange: () => this.onSourceChange(id)
              }),
              h("label", {className: "slds-radio_button__label", htmlFor: "sfir-query-source-" + id},
                h("span", {className: "slds-radio_faux"}, label)
              )
            )
          )
        ),
        h(SldsCombobox, {
          id: "query-search",
          className: "sfir-query-search",
          sourceKey: source.id,
          // Naming the source keeps it visible once the placeholder is replaced by typing.
          placeholder: "Search " + source.label.toLowerCase(),
          "aria-label": "Search " + source.label.toLowerCase(),
          value: searchValue,
          entries,
          isOpen,
          activeIndex,
          onInput: this.onSearchInput,
          onFocus: () => this.openDropdown(),
          onClick: () => this.openDropdown(),
          onKeyDown: (e) => this.onKeyDown(e, entries, isObjectSuggest, source),
          onSelect: (entry) => this.applyEntry(entry, isObjectSuggest, source),
          onClose: () => this.closeDropdown(),
          onDelete: !isObjectSuggest && source.remove ? (entry) => this.onDeleteEntry(entry, source) : null,
          canDelete: !isObjectSuggest ? source.canDelete : null,
          getGroup: !isObjectSuggest ? source.getGroup : null,
          renderItem: (entry) => source.renderEntry(entry, searchValue, isObjectSuggest)
        }),
        h("button", {
          type: "button",
          className: "slds-button slds-button_neutral sfir-query-clear",
          title: source.clearLabel,
          "aria-label": source.clearAriaLabel,
          disabled: !source.clear || source.entries.length === 0,
          onClick: this.onClear
        }, "Clear")
      )
    );
  }
}

export class SaveQueryModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      label: props.defaultLabel || ""
    };
    this.inputRef = null;
    this.handleConfirm = this.handleConfirm.bind(this);
  }

  componentDidMount() {
    if (this.props.isOpen) {
      this.syncAndFocus();
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isOpen && this.props.isOpen) {
      this.syncAndFocus();
    }
  }

  syncAndFocus() {
    this.setState({label: this.props.defaultLabel || ""}, () => {
      if (this.inputRef) {
        this.inputRef.focus();
        this.inputRef.select();
      }
    });
  }

  handleConfirm() {
    this.props.onSave(this.state.label.trim());
  }

  render() {
    const {isOpen, onCancel} = this.props;
    return h(ConfirmModal, {
      isOpen,
      title: "Save Query",
      confirmLabel: "Save",
      cancelLabel: "Cancel",
      onConfirm: this.handleConfirm,
      onCancel
    },
    h("div", {className: "slds-form-element"},
      h("label", {className: "slds-form-element__label", htmlFor: "sfir-query-label"}, "Label (optional)"),
      h("div", {className: "slds-form-element__control"},
        h("input", {
          id: "sfir-query-label",
          ref: (el) => { this.inputRef = el; },
          className: "slds-input",
          type: "text",
          placeholder: "Optional label",
          value: this.state.label,
          onChange: (e) => this.setState({label: e.target.value}),
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              this.handleConfirm();
            }
          }
        })
      )
    )
    );
  }
}
