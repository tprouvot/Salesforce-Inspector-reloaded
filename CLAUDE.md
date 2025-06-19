# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run chrome-dev-build` - Build development version for Chrome
- `npm run firefox-dev-build` - Build development version for Firefox
- `npm run chrome-release-build` - Build production version for Chrome
- `npm run firefox-release-build` - Build production version for Firefox

### Testing
- Unit tests: Navigate to extension page and replace filename with `test-framework.html?host=example.my.salesforce.com`
- Requires test org setup with metadata from `test/` directory: `sf deploy metadata -d test/ -o [test-org-alias]`
- Test org must have English language, multiple account contacts enabled, no namespace prefix, and SfInspector permission set assigned

### Linting
- `npm run eslint` - Run ESLint for code quality checks

## Architecture Overview

### Browser Extension Structure
This is a **Manifest V3 Chrome extension** (with Manifest V2 Firefox support) that provides Salesforce productivity tools. The extension uses a multi-layered architecture:

- **Content Scripts** (`button.js`, `inspect-inline.js`) - Inject UI elements into Salesforce pages
- **Background Script** (`background.js`) - Service worker handling extension lifecycle and messaging
- **Web Accessible Resources** - Standalone tools accessible via popup interface
- **Message Passing** - Communication between different extension contexts

### Key Directories
- `addon/` - Main extension code and assets
- `scripts/` - Build scripts for Chrome/Firefox packaging
- `test/` - Salesforce metadata for unit test org setup
- `docs/` - User documentation (deployed to GitHub Pages)

### Core Modules

#### inspector.js - API Connection Core
- Exports `sfConn` object for Salesforce API interactions
- Handles multi-tier authentication (OAuth, localStorage, cookies)
- Supports REST, SOAP, Tooling, and Bulk APIs
- Manages sessions across multiple Salesforce domains (commercial, government, Chinese)

#### utils.js - Shared Utilities
- `getLinkTarget()` - Link behavior management
- `getLatestApiVersionFromOrg()` - API version detection with caching
- `PromptTemplate` class - Einstein AI prompt integration
- Common UI helpers and data transformations

#### popup.js - Main UI Application
- React-based popup interface
- Coordinates between different tools and features
- Handles user preferences and session state

### Authentication System
The extension uses a sophisticated multi-fallback authentication approach:

1. **OAuth Flow Detection** - Captures access tokens from URL fragments
2. **Local Storage Caching** - Persists tokens per domain
3. **Cookie-Based Fallback** - Extracts session IDs via background script
4. **Connected App Support** - OAuth2 flow for API Access Control compliance

### Salesforce Integration
- **Domain Support**: Handles all Salesforce domains (.salesforce.com, .force.com, .salesforce.mil, .sfcrmproducts.cn, etc.)
- **API Integration**: Unified interface for REST/SOAP APIs with automatic session management
- **Lightning Navigation**: Custom events for seamless navigation integration
- **Metadata Access**: Deep linking to Setup pages using DurableIds from Tooling API

### Tool Architecture
Each major feature is implemented as a standalone HTML/JS application:
- `data-export.html/js` - SOQL query and data export
- `data-import.html/js` - Bulk data import with CSV support
- `explore-api.html/js` - Interactive REST API explorer  
- `metadata-retrieve.html/js` - Metadata deployment package creation
- `field-creator.html/js` - Custom field creation interface
- `event-monitor.html/js` - Event monitoring and log analysis

### Development Notes

#### File Structure Patterns
- Each tool has corresponding `.html`, `.js`, and `.css` files
- React components are in `components/` directory
- Third-party libraries in `lib/` directory
- Shared styles and assets in root of `addon/`

#### Build Process
- `dev-build.js` - Copies files, processes manifests for dev environment
- `release-build.js` - Creates production builds with version updates
- Separate manifests for Chrome (`manifest.json`) and Firefox (`manifest-firefox.json`)

#### Browser Compatibility
- Chrome: Uses Manifest V3 with service worker
- Firefox: Uses Manifest V2 with background scripts
- Different permission models require separate manifest files

### Security Considerations
- Extension only communicates directly with Salesforce servers
- No third-party data transmission
- Uses existing user permissions and session tokens
- localStorage used only for non-sensitive preference storage
- Required cookie permissions are for Salesforce domains only

### Contributing Guidelines
- Create feature branch from `releaseCandidate` branch
- Update `CHANGES.md` with improvements/bugfixes
- Consider updating documentation in `docs/` directory
- Follow existing code style and patterns
- ESLint extension recommended for consistency