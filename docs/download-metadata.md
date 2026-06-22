# Metadata Retrieve

This page allows users to retrieve metadata from a Salesforce organization. It provides a user-friendly interface to select and download specific metadata components.

## Features

### 1. Metadata Retrieval

* Retrieve metadata using the Salesforce Metadata API.
* View available metadata components, excluding `InstalledPackage`.
* Sort metadata components for easier selection (by Name or LastModifiedDate option).
* Download retrieved metadata as a ZIP file.
* View metadata content directly in the browser with syntax highlighting.

### 2. Package.xml Generation

* Generate a `package.xml` file from selected metadata components.
* Import an existing `package.xml` file.
* Paste `package.xml` content for metadata retrieval.
* Copy or download the generated `package.xml` file.

### 2.1 Import Button Functionality

The import button provides multiple ways to load existing metadata configurations:

#### Importing Package.xml Files

* **File Selection:** Click the import button to open a file picker dialog.
* **Supported Formats:** Accepts `.xml` files containing valid package.xml content.
* **Validation:** The system validates the XML structure and metadata types before processing.
* **Auto-population:** Once imported, the metadata components specified in the package.xml are automatically selected in the interface.
* **Error Handling:** Invalid or malformed package.xml files will display appropriate error messages.

#### Importing ZIP Files for Deployment

* **Package ZIP Import:** Import ZIP files containing metadata packages for deployment.
* **Direct Deployment:** ZIP files with metadata can be directly deployed to the Salesforce organization.
* **Content Validation:** The system validates the ZIP structure and metadata contents.
* **Deployment Options:** Configure deployment settings before processing the imported ZIP file.

### 3. Deployment Request Processing

* Retrieve metadata components from a specific `deployRequestId`.
* Automatically group and sort metadata components.
* Generate a `package.xml` file based on the deployment request.

### 4. Metadata Deployment

* Deploy metadata components directly from a ZIP file.
* Import and deploy package ZIP files containing metadata.
* View deployment status and results in real-time.
* Access deployment error details with direct links to Salesforce deployment status page.

### 5. Filtering and Selection Options

* Search metadata components using a filter input.
* Select all or deselect all metadata components.
* Expand/collapse metadata categories.
* Choose whether to include managed package metadata.

### 6. User Experience Enhancements

* Displays user and organization information.
* Provides real-time status updates for metadata retrieval.
* Shows logs for debugging errors.
* Uses checkboxes for easy selection of metadata components.

### 7. Metadata Preview

The metadata preview feature allows you to view the content of individual metadata files directly in your browser without downloading them first. This is particularly useful when you need to quickly inspect metadata content.

<img width="309" height="67" alt="View Metadata Button" src="https://github.com/user-attachments/assets/7ba1350d-842d-49ba-b235-ec345a2451b2" />

#### How to View Metadata

1. After selecting metadata components, click the "View" button next to any metadata file.
2. The metadata content will open in a modal window with syntax highlighting for better readability.
3. Use the "Copy" button to copy the entire metadata content to your clipboard.
4. The preview supports various metadata types including Apex classes, triggers, custom objects, and more.

<img width="678" height="714" alt="Metadata File Preview" src="https://github.com/user-attachments/assets/175f3c92-e450-4118-ade1-2af21320210c" />

#### Key Benefits

* **Quick Inspection:** View metadata without downloading and extracting ZIP files.
* **Syntax Highlighting:** Code and XML content are displayed with proper syntax highlighting for easier reading.
* **Copy to Clipboard:** Instantly copy metadata content for use in other tools or documentation.
* **No File Management:** Avoid cluttering your downloads folder with temporary metadata files.

## Options Available

* **Include Managed Packages:** Choose whether to include metadata from managed packages.
* **Metadata Filtering:** Use a search filter to find specific metadata components.
* **Legacy Version Support:** Users can opt to use a legacy version of metadata retrieval if needed.

## Deployment Options Configuration

When deploying metadata, you can configure the following options:

### Boolean Options

* **Allow Missing Files:** When enabled, allows deployment to succeed even if files specified in the package.xml are missing.
* **Check Only:** When enabled, validates the deployment without making any changes to the organization.
* **Ignore Warnings:** When enabled, allows deployment to succeed even if there are warnings.
* **Purge On Delete:** When enabled, removes deleted components from the organization.
* **Single Package:** When enabled, treats the deployment as a single package.
* **Perform Retrieve:** When enabled, performs a retrieve operation before deployment.
* **Rollback On Error:** When enabled, rolls back the deployment if an error occurs.

### Test Level Options

* **No Test Run:** No tests are run. This is the default for development environments.
* **Run Specified Tests:** Only runs the tests specified in the runTests option. Requires 75% code coverage for each class and trigger.
* **Run Local Tests:** Runs all tests in your org except those from installed managed and unlocked packages. This is the default for production deployments.
* **Run All Tests In Org:** Runs all tests in your org, including tests from managed packages.

## Generating Package.xml from Deployment Request

To generate a `package.xml` from a `deployRequestId`, the system:

1. Fetches deployment components using the Salesforce REST API.
2. Groups components by metadata type.
3. Constructs a `package.xml` file.
4. Allows users to download or use the generated file for retrieval.

## Deploying Metadata

To deploy metadata to a Salesforce organization:

1. Click the upload button to select a ZIP file containing metadata components.
2. The system will automatically process the ZIP file and initiate deployment.
3. Monitor the deployment status through the interface.
4. View detailed deployment results, including any errors or warnings.
5. Access the Salesforce deployment status page directly for more detailed information.

## Conclusion

The Metadata Retrieval page provides a streamlined way to extract metadata from Salesforce, whether through manual selection or deployment requests. Users can customize their retrieval process with filtering and managed package options while ensuring they have the necessary metadata for their deployments.
