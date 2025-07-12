
/* global React, ReactDOM */
let h = React.createElement;

class Tooltip extends React.Component {
  constructor(props) {
    super(props);
    this.state = {isTooltipVisible: false, isPinned: false};
    this.showTimer = null;
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.portalElement = null;
    this.setIconRef = (el) => {
      this.iconRef = el;
    };
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.isTooltipVisible && !prevState.isTooltipVisible) {
      this.portalElement = document.createElement("div");
      document.body.appendChild(this.portalElement);
      this.renderPortal();
    } else if (!this.state.isTooltipVisible && prevState.isTooltipVisible) {
      this.unmountPortal();
    } else if (this.state.isTooltipVisible) {
      this.renderPortal();
    }

    if (this.state.isPinned && !prevState.isPinned) {
      document.addEventListener("mousedown", this.handleDocumentClick);
    } else if (!this.state.isPinned && prevState.isPinned) {
      document.removeEventListener("mousedown", this.handleDocumentClick);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.showTimer);
    this.unmountPortal();
    document.removeEventListener("mousedown", this.handleDocumentClick);
  }

  unmountPortal() {
    if (this.portalElement) {
      // eslint-disable-next-line react/no-deprecated
      ReactDOM.unmountComponentAtNode(this.portalElement);
      if (this.portalElement.parentNode) {
        this.portalElement.parentNode.removeChild(this.portalElement);
      }
      this.portalElement = null;
    }
  }

  renderPortal() {
    if (!this.iconRef || !this.props.tooltip) {
      return;
    }

    const {tooltip, idKey} = this.props;
    const iconRect = this.iconRef.getBoundingClientRect();

    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.visibility = "hidden";
    tempDiv.style.top = "-9999px";
    tempDiv.style.left = "-9999px";
    document.body.appendChild(tempDiv);
    const tempTooltip = h("div", {
      className: "slds-popover slds-popover_tooltip",
      style: {width: "max-content", maxWidth: "320px"}
    },
    h("div", {className: "slds-popover__body"}, tooltip)
    );
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.render(tempTooltip, tempDiv);
    const tooltipRect = tempDiv.querySelector(".slds-popover").getBoundingClientRect();
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.unmountComponentAtNode(tempDiv);
    document.body.removeChild(tempDiv);

    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    const margin = 5;

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const nubbinHeight = 0.5 * rem;
    const nubbinHorizontalOffset = 1.5 * rem;
    const top = iconRect.top - tooltipHeight - nubbinHeight;
    let left = (iconRect.left + (iconRect.width / 2)) - nubbinHorizontalOffset;
    let nubbinClass = "slds-nubbin_bottom-left";

    if (left < margin) {
      left = margin;
    }
    if (left + tooltipWidth > window.innerWidth - margin) {
      left = window.innerWidth - tooltipWidth - margin;
      nubbinClass = "slds-nubbin_bottom-right";
    }

    const finalTooltipStyle = {
      position: "absolute",
      left: `${left + window.scrollX}px`,
      top: `${top + window.scrollY}px`,
      zIndex: 9999,
      maxWidth: "320px",
    };

    const tooltipElement = h("div", {
      className: `slds-popover slds-popover_tooltip ${nubbinClass}`,
      role: "tooltip",
      id: `${idKey}_tooltip`,
      style: finalTooltipStyle
    },
    h("div", {className: "slds-popover__body"}, tooltip)
    );
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.render(tooltipElement, this.portalElement);
  }

  show(delay = 0) {
    clearTimeout(this.showTimer);
    this.showTimer = setTimeout(() => {
      // Don't show if it's already pinned by a click.
      if (this.state.isPinned) {
        return;
      }
      this.setState({isTooltipVisible: true});
    }, delay);
  }

  hide() {
    // Don't hide if it's pinned by a click.
    if (this.state.isPinned) {
      return;
    }
    clearTimeout(this.showTimer);
    this.setState({isTooltipVisible: false});
  }

  handleClick(e) {
    e.preventDefault();
    // If it's already pinned, a click should unpin and hide it.
    if (this.state.isPinned) {
      this.setState({isTooltipVisible: false, isPinned: false});
    } else {
      // If it's not pinned, a click should show and pin it.
      // Clear any pending timers to prevent race conditions from hover.
      clearTimeout(this.showTimer);
      this.setState({isTooltipVisible: true, isPinned: true});
    }
  }

  handleDocumentClick(e) {
    if (this.iconRef && this.iconRef.contains(e.target)) {
      return;
    }
    if (this.portalElement && this.portalElement.contains(e.target)) {
      return;
    }
    this.setState({isTooltipVisible: false, isPinned: false});
  }

  render() {
    const {idKey} = this.props;
    if (!this.props.tooltip) {
      return null;
    }

    return h("span", {
      style: {marginLeft: "2px", display: "inline-flex", alignItems: "center", verticalAlign: "middle"},
      id: `${idKey}_icon`,
      ref: this.setIconRef,
      onMouseEnter: () => this.show(350),
      onMouseLeave: this.hide,
      onFocus: () => this.show(100),
      onBlur: this.hide
    },
    h("a", {href: "#", onClick: this.handleClick, role: "button", "aria-describedby": `${idKey}_tooltip`},
      h("span", {className: "slds-icon_container slds-icon-utility-info"},
        h("svg", {className: "slds-icon slds-icon_xx-small slds-icon-text-default", "aria-hidden": "true", style: {verticalAlign: "middle"}},
          h("use", {xlinkHref: "symbols.svg#info", fill: "#9c9c9c"})
        )
      ),
      h("span", {className: "slds-assistive-text"}, "Learn more")
    )
    );
  }
}

Tooltip.propTypes = {
  tooltip: React.PropTypes.node,
  idKey: React.PropTypes.string.isRequired,
};

export default Tooltip;
