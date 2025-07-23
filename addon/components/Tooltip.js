let h = React.createElement;
class Tooltip extends React.Component {
  constructor(props) {
    super(props);
    this.tooltip = props.tooltip;
    this.tipKey = props.idKey + "_tooltip";
    this.iconKey = props.idKey + "_icon";
    this.onClick = this.onClick.bind(this);
    this.onHover = this.onHover.bind(this);
    this.onHide = this.onHide.bind(this);
    this.showTimer = null;
    // Default to 0 opacity and completely hidden (isTooltipVisible evaluates to display: none)
    this.state = {
      isTooltipVisible: false,
      position: {x: "0", y: "0"},
      opacity: 0
    };
  }

  setTooltipPosition() {
    // At this point, display was visible but fully transparent in the top left corner of the screen
    // If isVisible is false, getBoundingClientRect will return 0 for all values
    const tabHeader = document.querySelectorAll('[id="main-container_header"]')[0];
    const marginTop = parseInt(window.getComputedStyle(tabHeader).getPropertyValue("margin-top"));
    const yOffset = tabHeader.getBoundingClientRect().top + marginTop + 2; // Add 2 extra pixels below nubbin
    const toolTip = document.querySelectorAll(`[id='${this.tipKey}']`)[0];
    const elRect = document.querySelectorAll(`[id='${this.iconKey}']`)[0].getBoundingClientRect();
    const toolTipRect = toolTip.getBoundingClientRect();
    const x = `${elRect.left - 27}px`; // fixed x offset (distance from left edge of tooltip to nubbin point)
    const y = `${elRect.top - toolTipRect.height - yOffset}px`;
    // Finally, set opacity to 100% so the user can see it
    this.setState({position: {x, y}, opacity: 1});
  }

  onClick(e) {
    e.preventDefault();
    this.show();
  }

  onHover() {
    this.show(350);
  }

  show(delay = 0) {
    clearTimeout(this.showTimer);
    this.showTimer = setTimeout(() => {
      this.setState({isTooltipVisible: true});
      this.setTooltipPosition();
    }, delay);
  }

  onHide() {
    clearTimeout(this.showTimer);
    this.setState({isTooltipVisible: false});
  }

  render() {
    if (!this.tooltip) {
      return null;
    }

    return h("span", {style: {marginLeft: "2px"}, id: this.iconKey},
      h("a", {href: "#", onClick: this.onClick, onMouseEnter: this.onHover, onMouseLeave: this.onHide},
        h("span", {className: "slds-icon_container slds-icon-utility-info"},
          h("svg", {className: "slds-icon_xx-small slds-icon-text-default", viewBox: "0 0 40 40", style: {verticalAlign: "unset", margin: "3px"}},
            h("use", {xlinkHref: "symbols.svg#info", fill: "#9c9c9c"}),
          )),
        h("span", {className: "slds-assistive-text"}, "Learn more")
      ),
      h("div", {className: "slds-popover slds-popover_tooltip slds-nubbin_bottom-left", role: "tooltip", id: this.tipKey, style: {position: "absolute", left: this.state.position.x, top: this.state.position.y, opacity: this.state.opacity, display: this.state.isTooltipVisible ? "block" : "none"}},
        h("div", {className: "slds-popover__body"}, this.props.tooltip)
      ));
  }
}
export default Tooltip;
