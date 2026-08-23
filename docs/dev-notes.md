# Dev Notes For Contributors
This file may be used by contributors to track technical notes for updates to inner workings, but probably won't be interesting to end users.
Please add notes that will help future contributors.

## Version 1.24

- Notes from [Nathan Shulman](https://github.com/nshulman)
  - Cleaned up all ESlint Errors
  - Test Framework enhancements: more progress status based on the 4 main stages, added commands during anonymous execution, added more error detail
  - Updated instructions for Firefox and Chrome build prior to testing and to reflect new Firefox UI
  - Added additional fixes for Firefox compatibility.  In order to test Firefox, use the manifest from the firefoxAddon branch (be sure to discard the change!)
  - Due to an error from React mentioning that input value may not be null, nullToEmptyString() helper function was added to prevent nulls as value
  - To add a tooltip to an option (in options.js) add the property `tooltip` with text to any option in the array
  - Updated SVG file to latest SLDS version, so you'll be able to use the [newest icons](https://www.lightningdesignsystem.com/icons/).  Initial use case was need for `toggle_panel_right` and `toggle_panel_bottom` in a future release, but they were not in the current SVG
