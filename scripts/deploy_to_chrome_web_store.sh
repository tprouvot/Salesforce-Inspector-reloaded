#!/bin/bash

# Two command line params expected: "CHROME_APP_ID ENVIRONMENT_TYPE (PROD|BETA)"
#
# The script is designed to run in CI context in the directory of the Salesforce Inspector project.
# Will - if version number of source is newer than version number in Chrome Web Store - package and upload BUT NOT RELEASE the addon to Chrome Web Store.

CHROME_APP_ID=$1         # first URL parameter
ENVIRONMENT_TYPE=$2      # second URL parameter - PROD|BETA
#CHROME_CLIENT_ID=""     # Securely defined in environment
#CHROME_CLIENT_SECRET="" # Securely defined in environment
#CHROME_REFRESH_TOKEN="" # Securely defined in environment
#CI_COMMIT_ID=""         # Populated by environment
CHROME_ACCESS_TOKEN=""
export ZIP_FILE_NAME="target/chrome/salesforceInspectorForChrome-$CI_COMMIT_ID-$ENVIRONMENT_TYPE.zip"

log_message() {
     printf "** $1\n";
}
log_error() {
     printf "!! $1\n";
}
log_detail() {
     printf "   -------- \n$1\n   --------\n";
}

log_message "0) Auth"; # could also be "should release?" but currently there's no good mechanism to determine that. Currently released version cannot be queried from google store

log_message "0.1) Auth with google (renew access token)"
CHROME_ACCESS_TOKEN=$( \
     curl "https://www.googleapis.com/oauth2/v3/token" \
          -s -d "client_id=$CHROME_CLIENT_ID&client_secret=$CHROME_CLIENT_SECRET&refresh_token=$CHROME_REFRESH_TOKEN&grant_type=refresh_token" \
     | jq '.access_token')
if [[ $CHROME_ACCESS_TOKEN == null ]]
then
     log_error "0.1.1) Login to google failed!";
     exit 1;
fi

SOURCE_VERSION_NUMBER=$(jq '.version' addon/manifest.json | tr -d '"');

log_message "1) Prepare application app package";

npm install
# Uses ENVIRONMENT_TYPE and ZIP_FILE_NAME
npm run chrome-release-build

log_message "2) Push to chrome web store"

log_message "2.2) Upload application to chrome web store"
UPLOAD_RESULT=$(curl \
     -H "Authorization: Bearer $CHROME_ACCESS_TOKEN" \
     -H "x-goog-api-version: 2" \
     -X PUT -s \
     -T $ZIP_FILE_NAME https://www.googleapis.com/upload/chromewebstore/v1.1/items/$CHROME_APP_ID \
     | jq '.')

if [[ $(echo $UPLOAD_RESULT | jq '.uploadState') == '"SUCCESS"' ]]
     then
     log_message "2.2.1) Upload succesful! - v$SOURCE_VERSION_NUMBER";
else
     log_message "2.2.1) Upload failed";
     if [[ $(echo $UPLOAD_RESULT | jq '.itemError[0].error_code') == '"PKG_INVALID_VERSION_NUMBER"' ]]
          then
          log_message "2.2.2) But that's ok, upload should only suceed on version increments."
          log_message "$(echo $UPLOAD_RESULT | jq '.itemError[0].error_detail')"
     else
          log_error "2.2.2) With an unexpected reason:"
          log_error "$UPLOAD_RESULT"
          exit 1;
     fi
fi

if [[ $ENVIRONMENT_TYPE == "BETA" ]]
then
     log_message "2.3) Publish new version to trusted testers"

     PUBLISH_RESULT=$(curl \
          -H "Authorization: Bearer $CHROME_ACCESS_TOKEN"  \
          -H "x-goog-api-version: 2" \
          -H "Content-Type: application/json" -d '{"target":"trustedTesters"}' \
          -X POST -v \
          https://www.googleapis.com/chromewebstore/v1.1/items/$CHROME_APP_ID/publish \
          | jq '.')

     if [[ $(echo $PUBLISH_RESULT | jq '.status[0]') == '"OK"' ]]
          then
          log_message "2.3.1) Publish succesful!";
     else
          log_error "2.3.1) Publish failed";
          log_detail "$PUBLISH_RESULT";
          exit 1;
     fi
fi

log_message "3) Release logic completed.";

exit 0;
