/* global React */
import ConfirmModal from "./ConfirmModal.js";
import {copyToClipboard} from "../utils.js";

const h = React.createElement;

/**
 * Reusable Agentforce analysis modal component
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {string} props.title - Modal title
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onAnalyze - Analyze handler
 * @param {boolean} props.isAnalyzing - Whether analysis is in progress
 * @param {string} props.analysis - Analysis results
 * @param {string} props.error - Error message
 * @param {string} props.instructions - Current instructions
 * @param {string} props.defaultInstructions - Default instructions
 * @param {boolean} props.editMode - Whether in edit mode
 * @param {Function} props.onToggleEditMode - Toggle edit mode handler
 * @param {Function} props.onUpdateInstructions - Update instructions handler
 * @param {Function} props.onResetInstructions - Reset instructions handler
 * @param {React.ReactNode} props.headerContent - Optional header content (field info, etc.)
 * @param {React.ReactNode} props.footerContent - Optional footer content
 * @param {string} props.analyzingMessage - Message to show while analyzing
 * @param {string} props.analyzingSubMessage - Sub-message to show while analyzing
 * @param {string} props.resultTitle - Title for results section
 * @param {string} props.resultTagName - Tag name to extract from results (e.g., "formulaHelper", "logAnalysis")
 * @param {Function} props.onCopy - Optional custom copy handler (receives text to copy)
 */
export default class AgentforceModal extends React.Component {
  render() {
    const {
      isOpen,
      title,
      onClose,
      onAnalyze,
      isAnalyzing,
      analysis,
      error,
      instructions,
      defaultInstructions,
      editMode,
      onToggleEditMode,
      onUpdateInstructions,
      onResetInstructions,
      headerContent,
      footerContent,
      analyzingMessage = "Agentforce is analyzing...",
      analyzingSubMessage = "This may take a moment",
      resultTitle = "Agentforce Analysis Results",
      resultTagName,
      onCopy
    } = this.props;

    if (!isOpen) return null;

    const isCustomized = instructions !== defaultInstructions;
    const hasResults = analysis || error;

    // Extract analysis from tag if specified
    let displayAnalysis = analysis;
    if (analysis && resultTagName) {
      const regex = new RegExp(`<${resultTagName}>([\\s\\S]*?)</${resultTagName}>`, "i");
      const match = analysis.match(regex);
      if (match) {
        displayAnalysis = match[1].trim();
      }
    }

    // Copy handler - use custom if provided, otherwise use default
    const handleCopy = () => {
      if (onCopy) {
        onCopy(displayAnalysis);
      } else {
        copyToClipboard(displayAnalysis);
      }
    };

    return h(ConfirmModal, {
      isOpen: true,
      title: h("div", {className: "slds-grid slds-grid_vertical-align-center"},
        h("span", {className: "slds-icon_container slds-icon-utility-einstein slds-m-right_small"},
          h("svg", {className: "slds-icon slds-icon_small", "aria-hidden": "true"},
            h("use", {xlinkHref: "symbols.svg#einstein"})
          )
        ),
        h("span", {}, title)
      ),
      onConfirm: isAnalyzing ? null : onAnalyze,
      onCancel: onClose,
      confirmLabel: isAnalyzing ? "Analyzing..." : (hasResults ? "Analyze Again" : "Analyze"),
      cancelLabel: "Close",
      confirmVariant: "brand",
      cancelVariant: "neutral",
      confirmDisabled: isAnalyzing,
      containerClassName: "modalContainer"
    },
    // Header content (optional - field info, etc.)
    headerContent,

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
            className: `slds-button slds-button_${editMode ? "brand" : "neutral"}`,
            title: "Edit instructions",
            onClick: onToggleEditMode,
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
            onClick: onResetInstructions,
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
      editMode ? h("div", {},
        h("textarea", {
          className: "slds-textarea sfir-agentforce-textarea",
          value: instructions,
          onInput: (e) => onUpdateInstructions(e.target.value),
          placeholder: "Enter your custom analysis instructions...",
          disabled: isAnalyzing
        }),
        h("div", {className: "slds-form-element__help slds-m-top_small"},
          h("div", {className: "slds-text-body_small slds-text-color_weak"},
            "💡 Tip: Customize these instructions to focus on specific aspects. Changes are automatically saved."
          )
        )
      ) : h("div", {},
        // View Mode - Read-only display
        h("div", {
          className: "slds-box slds-theme_shade slds-m-top_x-small sfir-agentforce-instructions-container"
        },
        h("div", {
          className: "slds-text-body_small sfir-agentforce-instructions-content",
          style: {whiteSpace: "pre-wrap"}
        }, instructions)
        )
      )
    ),

    // Analyzing State
    isAnalyzing && h("div", {className: "slds-align_absolute-center slds-m-vertical_large sfir-agentforce-analyzing-container"},
      h("div", {className: "slds-spinner_container"},
        h("div", {role: "status", className: "slds-spinner slds-spinner_medium slds-spinner_brand"},
          h("span", {className: "slds-assistive-text"}, "Analyzing..."),
          h("div", {className: "slds-spinner__dot-a"}),
          h("div", {className: "slds-spinner__dot-b"})
        )
      ),
      h("div", {className: "slds-text-heading_small slds-m-top_medium slds-text-align_center"},
        h("div", {}, analyzingMessage),
        h("div", {className: "slds-text-body_small slds-text-color_weak slds-m-top_x-small"},
          analyzingSubMessage
        )
      )
    ),

    // Error State
    error && h("div", {className: "slds-m-top_medium"},
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
          error
        )
      )
    ),

    // Success State with Results
    displayAnalysis && h("div", {className: "slds-m-top_medium"},
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
                h("span", {}, resultTitle)
              )
            ),
            h("div", {className: "slds-no-flex"},
              h("button", {
                className: "slds-button slds-button_icon slds-button_icon-border-filled",
                title: "Copy to clipboard",
                onClick: handleCopy
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
            className: "slds-text-body_regular sfir-agentforce-results",
            style: {whiteSpace: "pre-wrap"}
          }, displayAnalysis)
        )
      )
    ),

    // Footer content (optional)
    footerContent
    );
  }
}
