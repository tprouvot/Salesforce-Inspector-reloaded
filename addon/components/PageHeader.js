/* global React */
let h = React.createElement;

/**
 * Reusable SLDS Page Header Component
 *
 * This component provides a consistent header across all pages with support for
 * customizable navigation items and utility actions (slot-like functionality).
 *
 * @param {Object} props - Component properties
 * @param {string} props.pageTitle - The main title to display in the header (left side)
 * @param {string} [props.subTitle] - Optional subtitle displayed in the center (flexi-truncate)
 * @param {string} props.orgName - The Salesforce org name
 * @param {string} props.sfLink - Link to the Salesforce org home
 * @param {string} props.sfHost - The Salesforce host (used for localStorage keys)
 * @param {number} props.spinnerCount - Number of active loading operations
 * @param {string} props.userInitials - User's initials for avatar
 * @param {string} props.userFullName - User's full name
 * @param {string} props.userName - User's username
 * @param {Array} [props.navItems] - Optional array of navigation items (slot)
 * @param {Array} [props.utilityItems] - Optional array of utility items (slot)
 *
 * Example usage:
 *
 * h(PageHeader, {
 *   pageTitle: "Data Export",
 *   orgName: model.orgName,
 *   sfLink: model.sfLink,
 *   sfHost: model.sfHost,
 *   spinnerCount: model.spinnerCount,
 *   userInitials: model.userInitials,
 *   userFullName: model.userFullName,
 *   userName: model.userName,
 *   navItems: [
 *     h("li", {className: "slds-builder-header__nav-item"},
 *       h("button", {onClick: this.onNavClick}, "My Nav Item")
 *     )
 *   ],
 *   utilityItems: [
 *     h("div", {className: "slds-builder-header__utilities-item"},
 *       h("a", {href: "#", onClick: this.onAgentforce},
 *         h("span", {}, "Agentforce")
 *       )
 *     )
 *   ]
 * })
 */
export function PageHeader(props) {
  const {
    pageTitle,
    orgName,
    sfLink,
    sfHost,
    spinnerCount = 0,
    userInitials,
    userFullName,
    userName,
    navItems = [],
    utilityItems = [],
    subTitle
  } = props;

  // Check if header color override is enabled and get custom color
  let customHeaderStyle = {};
  try {
    const overrideColorsOption = JSON.parse(localStorage.getItem("overrideColorsOption") || "[]");
    const shouldOverride = overrideColorsOption.find(item => item.name === "header")?.checked;
    if (shouldOverride && sfHost) {
      const customColor = localStorage.getItem(sfHost + "_customFavicon");
      if (customColor) {
        customHeaderStyle = {
          backgroundColor: customColor
        };
      }
    }
  } catch (e) {
    // If parsing fails, just use default styles
    console.error("Error reading color override settings:", e);
  }

  return h("div", {className: "slds-builder-header_container"},
    h("header", {className: "slds-builder-header sfir-header-override", style: customHeaderStyle},
      // Left side: Org Badge
      h("div", {className: "slds-builder-header__item"},
        h("div", {className: "slds-builder-header__item-label"},
          h("div", {className: "slds-media__body"},
            h("a", {href: sfLink},
              h("span", {className: "slds-badge slds-badge_lightest"},
                h("span", {className: "slds-badge__icon slds-badge__icon_left"},
                  h("span", {className: "slds-icon_container slds-current-color", title: "Home"},
                    h("svg", {className: "slds-icon slds-icon_xx-small", "aria-hidden": "true"},
                      h("use", {xlinkHref: "symbols.svg#home"})
                    )
                  )
                ),
                orgName
              )
            )
          )
        )
      ),

      // Left: Page Title
      h("div", {className: "slds-builder-header__item"},
        h("div", {className: "slds-builder-header__item-label slds-media slds-media_center"},
          h("div", {className: "slds-text-heading_small slds-media__body"}, pageTitle)
        )
      ),

      // Navigation slot (optional)
      navItems.length > 0
        ? h("nav", {className: "slds-builder-header__item slds-builder-header__nav"},
          h("ul", {className: "slds-builder-header__nav-list"},
            ...navItems
          )
        ) : null,

      // Center: Page SubTitle (optional)
      subTitle ? h("div", {className: "slds-builder-header__item slds-has-flexi-truncate"},
        h("h1", {className: "slds-builder-header__item-label"},
          h("span", {className: "slds-truncate", title: subTitle}, subTitle)
        )
      ) : null,

      // Right side: Utilities
      h("div", {className: "slds-builder-header__item slds-builder-header__utilities"},
        // Spinner (always present)
        spinnerCount == 0 ? null
        : h("div", {className: "slds-builder-header__utilities-item slds-m-horizontal_small  slds-p-horizontal_x-small"},
          h("div", {className: "slds-is-relative"},
            h("div", {
              role: "status",
              className: "slds-spinner slds-spinner_small slds-spinner_inverse"
            },
            h("span", {className: "slds-assistive-text"}, "Loading"),
            h("div", {className: "slds-spinner__dot-a"}),
            h("div", {className: "slds-spinner__dot-b"})
            )
          )
        ),

        // Custom utility items slot
        ...utilityItems,

        // User avatar (always present at the end)
        h("div", {className: "slds-builder-header__utilities-item slds-p-top_x-small slds-p-horizontal_small"},
          h("div", {className: "slds-media__body sfir-display-popover-trigger"},
            h("span", {className: "slds-avatar slds-avatar_circle"},
              h("abbr", {className: "slds-avatar__initials slds-avatar__initials_inverse"}, userInitials)
            ),
            h("section", {
              className: "sfir-display-popover-target slds-popover slds-nubbin_top-right",
              style: {position: "absolute", right: "4px", top: "54px"}
            },
            h("div", {id: "popover-body-id", className: "slds-popover__body"},
              h("p", {},
                h("strong", {className: "slds-truncate"}, userFullName),
              ),
              h("p", {className: "slds-truncate"}, userName)
            )
            )
          )
        )
      )
    )
  );
}

