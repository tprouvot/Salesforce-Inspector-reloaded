# PageHeader Component Usage Examples

## Basic Usage (Current Implementation in data-export.js)

```javascript
import {PageHeader} from "./components/PageHeader.js";

// In your render method:
const utilityItems = [
  // Custom utility items for this page
  h("div", {className: "slds-builder-header__utilities-item"},
    h("a", {href: "#", onClick: this.onToggleHelp},
      h("span", {}, "Help")
    )
  )
].filter(Boolean);

return h("div", {},
  h(PageHeader, {
    pageTitle: "Data Export",
    orgName: model.orgName,
    sfLink: model.sfLink,
    spinnerCount: model.spinnerCount,
    userInitials: model.userInitials,
    userFullName: model.userFullName,
    userName: model.userName,
    utilityItems: utilityItems
  }),
  // ... rest of your page content
);
```

## Example with Navigation Items

```javascript
// Define navigation items for this page
const navItems = [
  h("li", {className: "slds-builder-header__nav-item"},
    h("button", {
      className: "slds-button slds-builder-header__item-action",
      onClick: this.onNavItemClick
    }, "Export")
  ),
  h("li", {className: "slds-builder-header__nav-item"},
    h("button", {
      className: "slds-button slds-builder-header__item-action",
      onClick: this.onNavItem2Click
    }, "Import")
  )
];

// Define utility items for this page
const utilityItems = [
  h("div", {className: "slds-builder-header__utilities-item"},
    h("a", {href: "#", onClick: this.onSettings},
      h("span", {}, "Settings")
    )
  )
];

return h("div", {},
  h(PageHeader, {
    pageTitle: "My Page",
    orgName: model.orgName,
    sfLink: model.sfLink,
    spinnerCount: model.spinnerCount,
    userInitials: model.userInitials,
    userFullName: model.userFullName,
    userName: model.userName,
    navItems: navItems,      // Optional navigation
    utilityItems: utilityItems // Optional utilities
  }),
  // ... rest of your page content
);
```

## Example with Dropdown Navigation

```javascript
const navItems = [
  h("li", {
    className: "slds-builder-header__nav-item slds-dropdown-trigger slds-dropdown-trigger_click",
    ref: this.navDropdownRef
  },
    h("button", {
      className: "slds-button slds-builder-header__item-action slds-media slds-media_center",
      "aria-haspopup": "true",
      onClick: this.toggleNavDropdown
    },
      h("span", {className: "slds-media__figure"},
        h("span", {className: "slds-icon_container slds-icon-utility-page slds-current-color"},
          h("svg", {className: "slds-icon slds-icon_x-small", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#page"})
          )
        )
      ),
      h("span", {className: "slds-media__body"},
        h("span", {className: "slds-truncate"}, "Views"),
        h("span", {className: "slds-icon_container slds-icon-utility-chevrondown"},
          h("svg", {className: "slds-icon slds-icon_x-small"},
            h("use", {xlinkHref: "symbols.svg#chevrondown"})
          )
        )
      )
    ),
    // Dropdown menu
    h("div", {className: "slds-dropdown slds-dropdown_right"},
      h("ul", {className: "slds-dropdown__list"},
        h("li", {className: "slds-dropdown__item"},
          h("a", {href: "#", onClick: this.onView1}, "View 1")
        ),
        h("li", {className: "slds-dropdown__item"},
          h("a", {href: "#", onClick: this.onView2}, "View 2")
        )
      )
    )
  )
];
```

## Example with Multiple Utility Buttons

```javascript
const utilityItems = [
  // Settings button
  h("div", {className: "slds-builder-header__utilities-item"},
    h("a", {
      href: "#",
      className: "slds-builder-header__item-action slds-media slds-media_center",
      onClick: this.onSettings
    },
      h("span", {className: "slds-media__figure"},
        h("span", {className: "slds-icon_container slds-current-color"},
          h("svg", {className: "slds-icon slds-icon_x-small"},
            h("use", {xlinkHref: "symbols.svg#settings"})
          )
        )
      ),
      h("span", {className: "slds-media__body"}, "Settings")
    )
  ),
  // Conditional Agentforce button
  model.showAgentforce ?
    h("div", {className: "slds-builder-header__utilities-item"},
      h("a", {
        href: "#",
        className: "slds-builder-header__item-action slds-media slds-media_center",
        onClick: this.onToggleAI
      },
        h("span", {className: "slds-media__figure"},
          h("span", {className: "slds-icon_container slds-current-color"},
            h("svg", {className: "slds-icon slds-icon_x-small"},
              h("use", {xlinkHref: "symbols.svg#einstein"})
            )
          )
        ),
        h("span", {className: "slds-media__body"}, "Agentforce")
      )
    ) : null,
  // Help button
  h("div", {className: "slds-builder-header__utilities-item"},
    h("a", {
      href: "#",
      className: "slds-builder-header__item-action slds-media slds-media_center",
      onClick: this.onHelp
    },
      h("span", {className: "slds-media__figure"},
        h("span", {className: "slds-icon_container slds-current-color"},
          h("svg", {className: "slds-icon slds-icon_x-small"},
            h("use", {xlinkHref: "symbols.svg#help"})
          )
        )
      ),
      h("span", {className: "slds-media__body"}, "Help")
    )
  )
].filter(Boolean); // Remove any null items
```

## Minimal Example (No Custom Items)

```javascript
// Just the basic header with no custom nav or utilities
return h("div", {},
  h(PageHeader, {
    pageTitle: "Simple Page",
    orgName: model.orgName,
    sfLink: model.sfLink,
    spinnerCount: model.spinnerCount,
    userInitials: model.userInitials,
    userFullName: model.userFullName,
    userName: model.userName
  }),
  // ... rest of your page content
);
```

## Key Benefits

1. **Consistent UI**: All pages use the same header structure
2. **Slot-like Pattern**: Inject custom items via `navItems` and `utilityItems` props
3. **Flexibility**: Each page controls its own navigation and utilities
4. **Maintainability**: Update header in one place, affects all pages
5. **Clean Code**: Page logic stays in the page file, not in the header component

## Available Icons

Common icons you can use in navigation and utility items:
- `#home` - Home icon
- `#settings` - Settings icon
- `#help` - Help icon
- `#einstein` - Einstein/Agentforce icon
- `#page` - Page icon
- `#search` - Search icon
- `#chevrondown` - Chevron down
- `#chevronup` - Chevron up

Reference: `symbols.svg#[icon-name]`

