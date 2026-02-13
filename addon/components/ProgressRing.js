/* global React */
let h = React.createElement;

/**
 * Reusable SLDS Progress Ring Component - based on the SLDS blueprint
 * Will automatically update, show completion or failure based on queued/processing/success/failed
 * But can be overridden with isSuccess and isFailed for cases where counts aren't available, or results were 0 but still successful
 *
 * @param {Object} props - Component properties
 * @param {number} [props.queued=0] - Number of items queued for processing
 * @param {number} [props.processing=0] - Number of items currently being processed
 * @param {number} [props.success=0] - Number of successfully processed items
 * @param {number} [props.failed=0] - Number of failed items
 * @param {boolean} [props.isSuccess=false] - Overrides completion state to support completion no items, or unknown number of items
 * @param {boolean} [props.isFailed=false] - Overrides failed state to support failure with no items, or unknown number of items
 * @param {string} [props.direction="fill"] - Direction of progress: "fill" for clockwise or "drain" for counter-clockwise
 *
 * Example usage:
 *
 * // Basic progress ring
 * h(ProgressRing, {queued: 10, processing: 2, success: 5, failed: 1})
 *
 * // Counter-clockwise drain direction
 * h(ProgressRing, {direction: "drain", processing: 3, success: 7})
 *
 * // Force success icon
 * h(ProgressRing, {isSuccess: true})
 *
 */
export class ProgressRing extends React.Component {

  constructor(props) {
    super(props);
    this.resetProgressRing();

    // Bind ref callbacks once
    this.setHeadRef = this.setHeadRef.bind(this);
    this.setArcRef = this.setArcRef.bind(this);
    this.setContentRef = this.setContentRef.bind(this);
  }

  resetProgressRing() {
    this.state = {
      centerX: 0,
      centerY: 0
    }

    this.progressContainerHeight = {
      head: 0,
      arc: 0,
      content: 0
    };

    this.progressContainerRef = {
      head: null,
      arc: null,
      content: null
    };

    this.hasCalculated = false;
    this.pendingCalculation = false;
    this.isSuccess = false;
    this.isFailed = false;
  }

  // Helper to set refs and trigger calculation when all refs are available
  setRef(ref, propName) {
    if (ref && ref !== this.progressContainerRef[propName]) {
      this.progressContainerRef[propName] = ref;
      this.tryCalculateProgressHead();
    }
  }

  setHeadRef(ref) {
    this.setRef(ref, 'head');
  }

  setArcRef(ref) {
    this.setRef(ref, 'arc');
  }

  setContentRef(ref) {
    this.setRef(ref, 'content');
  }

  tryCalculateProgressHead() {
    // Only calculate once when all refs are available and not already calculated
    if (this.hasCalculated || this.pendingCalculation) {
      return;
    }
    const {head, arc, content} = this.progressContainerRef;
    if (head && arc && content) {
      this.pendingCalculation = true;
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        this.calculateProgressHeadRadius();
        this.pendingCalculation = false;
        this.hasCalculated = true;
      });
    }
  }

  componentDidUpdate(prevProps) {
    // Check for changes in any props that affect progress calculations
    const propNames = ['queued', 'processing', 'success', 'failed', 'isSuccess', 'isFailed'];
    const changesFound = propNames.some(name => this.props[name] !== prevProps[name]);
    if (!changesFound) {
      return;
    }
    this.hasCalculated = false;
    this.tryCalculateProgressHead();
  }

  setHeightFromContainer(propName) {
    try {
      const ref = this.progressContainerRef?.[propName];
      if (!ref) {
        return false;
      }
      const height = parseFloat(getComputedStyle(ref).height) || 0;
      this.progressContainerHeight[propName] = height;
    } catch (error) {
      console.error(`Error getting height for ${propName}:`, error);
      return false;
    }
    // Successfully found height and set it
    return true;
  }

  calculateProgressHeadRadius() {
    try {
      const propNames = ['head', 'arc', 'content'];
      if (!propNames.every(name => this.setHeightFromContainer(name))) {
        return;
      }

      const {arcX, arcY} = this.getProgressCalculations();
      const scale = 2 / this.progressContainerHeight.head; // 2 is SVG viewbox height
      const radiusArcPixels = this.progressContainerHeight.arc / 2;
      const radiusOfArc = radiusArcPixels * scale;
      const radiusContentPixels = this.progressContainerHeight.content / 2;
      const widthArcPixels = radiusArcPixels - radiusContentPixels;
      const widthOfArc = widthArcPixels * scale;
      const radiusOfProgressHead = radiusOfArc + (widthOfArc / 2);
      const centerX = arcX === 0 ? 0 :radiusOfProgressHead * arcX;
      const centerY = arcY === 0 ? 0 :radiusOfProgressHead * arcY;
      if (isNaN(centerX) || isNaN(centerY) || !isFinite(centerX) || !isFinite(centerY)) {
        return;
      }
      // Only update state if values actually changed to prevent re-renders
      if ((this.state.centerX !== centerX || this.state.centerY !== centerY)) {
        this.setState({centerX, centerY});
      }
    } catch (error) {
      console.error('ProgressRing calculation error:', error);
      // Reset to safe defaults on error
      this.setState({centerX: 0, centerY: 0});
    }
  }

  getProgressCalculations() {
    try {
      const {queued = 0, processing = 0, success = 0, failed = 0, direction = "fill"} = this.props;
      const total = queued + processing + success + failed;
      const fillPercent = total === 0 ? 0 : (success + failed) / total;
      const invert = direction === "drain" ? 1 : -1;
      const arcX = Math.cos(2 * Math.PI * fillPercent);
      const arcY = Math.sin(2 * Math.PI * fillPercent) * invert;
      return {total, fillPercent, invert, arcX, arcY};
    } catch (error) {
      console.error('ProgressRing calculations error:', error);
      // Return safe defaults on error
      return {total: 0, fillPercent: 0, invert: -1, arcX: 1, arcY: 0};
    }
  }

  getIconFromValues(symbol, title) {
    return h("span", {className: `slds-icon_container slds-icon-utility-${symbol}`, title},
      h("svg", {className: "slds-icon", "aria-hidden": "true"},
        h("use", {xlinkHref: `symbols.svg#${symbol}`})
      ),
      h("span", {className: "slds-assistive-text"}, title)
    );
  }

  render() {
    try {
      const {
        text = "Progress",
        success = 0,
        failed = 0,
        direction = "fill",
        isSuccess = false,
        isFailed = false
      } = this.props;
      const {centerX, centerY} = this.state;
      const {total, fillPercent, arcX, arcY} = this.getProgressCalculations();
      const isComplete = total > 0 && (success + failed) === total;
      const showSuccess = isSuccess || (total > 0 && success === total);
      const hasFailures = isFailed || failed > 0;
      const fillPercentValue = Math.round(fillPercent * 100);

      // Calculate arc path parameters
      const isLong = fillPercent > 0.5 ? 1 : 0;
      const drain = direction === "drain" ? 1 : 0;

      // Calculate progresshead visibility, radius and center (x and y)
      const showProgressHead = fillPercent > 0 && fillPercent < 1 && !isSuccess && !isFailed;

      // Build the d attribute for the path
      const pathD = `M 1 0 A 1 1 0 ${isLong} ${drain} ${arcX} ${arcY} L 0 0`;

      let statusClassArray = ["slds-progress-ring"];
      if (showSuccess) {
        statusClassArray.push("slds-progress-ring_complete");
      } else if (hasFailures) {
        statusClassArray.push("slds-progress-ring_warning");
      }
      const progressRingClasses = statusClassArray.join(" ");

    // Determine icon and tooltip based on status
    let tooltipText = "Progress";
    const getIcon = () => {
      if (showSuccess) {
        tooltipText = "Complete - Success";
        return this.getIconFromValues("check", tooltipText);
      } else if (hasFailures) {
        tooltipText = isComplete ? "Complete - Failed Items" : "Processing - Failed Items";
        if (success > 0) {
          tooltipText += ", Partial Success";
        }
        return this.getIconFromValues("warning", tooltipText);
      } else {
        return null;
      }
    };

    const progressRingElement = h("div", {className: progressRingClasses, title: tooltipText},
      h("div", {
        className: "slds-progress-ring__progress",
        role: "progressbar",
        "aria-valuemin": "0",
        "aria-valuemax": "100",
        ref: this.setArcRef,
        "aria-valuenow": fillPercentValue.toString(),
        "aria-label": text
      },
        h("svg", {viewBox: "-1 -1 2 2", style: {overflow: "visible"}},
          showSuccess
            ? h("circle", {className: "slds-progress-ring__path", id: "slds-progress-ring-path-57", cx: "0", cy: "0", r: "1"})
            : h("path", {className: "slds-progress-ring__path", id: "slds-progress-ring-path-65", d: pathD})
        )
      ),
      h("div", {className: "slds-progress-ring__content", ref: this.setContentRef},
        getIcon()
      ),
      !showSuccess && showProgressHead ? h("div", {className: "slds-progress-ring__progress-head", ref: this.setHeadRef},
        h("svg", {viewBox: "-1 -1 2 2", style: {overflow: "visible"}},
          h("circle", {className: "slds-progress-ring__path", id: "slds-progress-ring-path-66", cx: centerX, cy: centerY, r: "0.2"})
        )
      ) : null
    );
    return h("div", {className: "slds-is-relative"}, progressRingElement);
    } catch (error) {
      // Do NOT render if there is any error in calculations - we don't want to break the entire UI
      console.error('ProgressRing render error:', error);
      return null;
    }
  }
}
