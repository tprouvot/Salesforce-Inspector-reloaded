# Metadata Retrieve

This page allows users to retrieve metadata from a Salesforce organization. It provides a user-friendly interface to select and download specific metadata components.

## Context

//TODO Explain legacy usage vs new

## Functionalities

### Displaying Metadata Components

* The page fetches and displays a list of available metadata components from the Salesforce org.
* Metadata components are organized in a tree-like structure, allowing users to expand and collapse categories.
* A filter is available to search for specific metadata types or components.

### Selecting Metadata for Retrieval

* Users can select individual metadata components or entire categories for retrieval using checkboxes.
* A "Select All" / "Unselect All" checkbox is available for convenience.
* The page allows users to include or exclude metadata from managed packages.

### Generating `package.xml`

* The page dynamically generates a `package.xml` file based on the user's selections.
* The `package.xml` content is displayed in a code editor within the page.
* Users can download the generated `package.xml` file.

### Retrieving Metadata

* Users can initiate the metadata retrieval process with a button click.
* The page displays the status of the retrieval operation, including progress messages and error notifications.
* Upon successful retrieval, the page provides download links for the retrieved metadata (in a ZIP file) and a status JSON file.

### Importing `package.xml`

* Users can import an existing `package.xml` file to define the metadata to be retrieved.
* The page provides a file input to select the `package.xml` file.
* Users can also paste the content of a `package.xml` file from their clipboard.

##  UI Elements

### Buttons

* "Retrieve Metadata": Initiates the metadata retrieval process.
* "Download package.xml": Downloads the generated `package.xml` file.
* Import button: Opens file selection dialog for `package.xml` import.
* "Save downloaded metadata": Downloads the retrieved metadata ZIP file.
* "Save status info": Downloads the status JSON file.
