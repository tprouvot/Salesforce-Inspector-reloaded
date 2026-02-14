/* global React */
let h = React.createElement;

/**
 * Simple ButtonMenu component inspired by lightning-button-menu
 * @param {Object} props
 * @param {string} props.label - Button label text
 * @param {string} [props.iconName] - Icon name (e.g., "utility:down")
 * @param {string} [props.variant] - Button variant (border, bare, etc.)
 * @param {string} [props.iconSize] - Icon size (xx-small, x-small, small, medium, large)
 * @param {string} [props.menuAlignment] - Menu alignment (left, right, center)
 * @param {string} [props.alternativeText] - Assistive text
 * @param {Function} props.onSelect - Callback when menu item is selected (value) => void
 * @param {Array} props.menuItems - Array of {value, label, checked, disabled}
 */
export class ButtonMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false
    };
    this.buttonRef = null;
    this.dropdownRef = null;
    this.handleButtonClick = this.handleButtonClick.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleMenuItemClick = this.handleMenuItemClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    document.addEventListener('click', this.handleDocumentClick);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.isOpen && !prevState.isOpen) {
      document.addEventListener('keydown', this.handleKeyDown);
    } else if (!this.state.isOpen && prevState.isOpen) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleButtonClick(e) {
    e.stopPropagation();
    this.setState(prevState => ({isOpen: !prevState.isOpen}));
  }

  handleDocumentClick(e) {
    if (this.buttonRef && !this.buttonRef.contains(e.target) &&
        this.dropdownRef && !this.dropdownRef.contains(e.target)) {
      this.setState({isOpen: false});
    }
  }

  handleMenuItemClick(e, item) {
    e.preventDefault();
    if (!item.disabled && this.props.onSelect) {
      this.props.onSelect(item.value);
    }
    this.setState({isOpen: false});
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.setState({isOpen: false});
      if (this.buttonRef) {
        this.buttonRef.focus();
      }
    }
  }

  render() {
    const {
      label,
      iconName = 'utility:down',
      variant = 'border',
      iconSize = 'medium',
      menuAlignment = 'left',
      alternativeText = 'Show menu',
      menuItems = []
    } = this.props;

    const { isOpen } = this.state;

    const buttonClass = `slds-button ${label ? 'slds-button_neutral' : 'slds-button_icon slds-button_icon-border'}`;
    const dropdownClass = `slds-dropdown slds-dropdown_${menuAlignment}`;

    return h('div', {
      className: `slds-dropdown-trigger slds-dropdown-trigger_click${isOpen ? ' slds-is-open' : ''}`
    },
      h('button', {
        ref: (ref) => this.buttonRef = ref,
        className: buttonClass,
        'aria-haspopup': 'true',
        'aria-expanded': isOpen ? 'true' : 'false',
        onClick: this.handleButtonClick,
        type: 'button',
        title: alternativeText
      },
        label && h('span', {}, label),
        h('svg', {
          className: `slds-button__icon${label ? ' slds-button__icon_right' : ''}`,
          'aria-hidden': 'true'
        },
          h('use', { xlinkHref: 'symbols.svg#chevrondown' })
        ),
        h('span', { className: 'slds-assistive-text' }, alternativeText)
      ),
      isOpen && h('div', {
        ref: (ref) => this.dropdownRef = ref,
        className: dropdownClass
      },
        h('ul', {
          className: 'slds-dropdown__list',
          role: 'menu'
        },
          menuItems.map((item, index) =>
            h('li', {
              key: item.value || index,
              className: 'slds-dropdown__item',
              role: 'presentation'
            },
              h('a', {
                href: '#',
                role: 'menuitemcheckbox',
                tabIndex: index === 0 ? '0' : '-1',
                'aria-checked': item.checked ? 'true' : 'false',
                'aria-disabled': item.disabled ? 'true' : undefined,
                className: item.disabled ? 'slds-is-disabled' : undefined,
                onClick: (e) => this.handleMenuItemClick(e, item)
              },
                h('span', { className: 'slds-truncate' },
                  item.checked && h('svg', {
                    className: 'slds-icon slds-icon_x-small slds-icon-text-default slds-m-right_x-small',
                    'aria-hidden': 'true'
                  },
                    h('use', { xlinkHref: 'symbols.svg#check' })
                  ),
                  item.label
                )
              )
            )
          )
        )
      )
    );
  }
}
