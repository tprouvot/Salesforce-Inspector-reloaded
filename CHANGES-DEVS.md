# Release Notes For Contributors
This file may be used by contributors to track technical notes for updates to inner workings, but probably won't be interesting to end users.

## Version 1.24

- Contributions by ([Nathan Shulman](https://github.com/nshulman))
    - Cleaned up all ES Lint Errors
    - Added more progress status and error details to Test Framework page
    - Updated instructions for Firefox and Chrome build prior to testing and to reflect new Firefox UI - manifest in the addon folder is sufficient
    - Due to an error from React mentioning that input value may not be null, cleanInputValue() function was added to prevent nulls as value