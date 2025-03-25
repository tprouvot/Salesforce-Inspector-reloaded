# Metadata Retrieve

This page allows users to retrieve metadata from a Salesforce organization. It provides a user-friendly interface to select and download specific metadata components.

## Features

### 1. Metadata Retrieval

* Retrieve metadata using the Salesforce Metadata API.
* View available metadata components, excluding `InstalledPackage`.
* Sort metadata components for easier selection (by Name or LastModifiedDate option).
* Download retrieved metadata as a ZIP file.

### 2. Package.xml Generation

* Generate a `package.xml` file from selected metadata components.
* Import an existing `package.xml` file.
* Paste `package.xml` content for metadata retrieval.
* Copy or download the generated `package.xml` file.

### 3. Deployment Request Processing

* Retrieve metadata components from a specific `deployRequestId`.
* Automatically group and sort metadata components.
* Generate a `package.xml` file based on the deployment request.

### 4. Filtering and Selection Options

* Search metadata components using a filter input.
* Select all or deselect all metadata components.
* Expand/collapse metadata categories.
* Choose whether to include managed package metadata.

### 5. User Experience Enhancements

* Displays user and organization information.
* Provides real-time status updates for metadata retrieval.
* Shows logs for debugging errors.
* Uses checkboxes for easy selection of metadata components.

## Options Available

* **Include Managed Packages:** Choose whether to include metadata from managed packages.
* **Metadata Filtering:** Use a search filter to find specific metadata components.
* **Legacy Version Support:** Users can opt to use a legacy version of metadata retrieval if needed.

## Generating Package.xml from Deployment Request

To generate a `package.xml` from a `deployRequestId`, the system:

1. Fetches deployment components using the Salesforce REST API.
2. Groups components by metadata type.
3. Constructs a `package.xml` file.
4. Allows users to download or use the generated file for retrieval.

## Conclusion

The Metadata Retrieval page provides a streamlined way to extract metadata from Salesforce, whether through manual selection or deployment requests. Users can customize their retrieval process with filtering and managed package options while ensuring they have the necessary metadata for their deployments.
