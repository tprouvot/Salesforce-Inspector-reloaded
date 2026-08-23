import {
  TEST_CONSTANTS,
  TEST_GUID,
  createSuccessResponse,
  createSoapSuccessResponse,
  fulfillSuccess,
  fulfillSoapSuccess
} from "./test-helpers";

const accountRecords = [
  {
    attributes: {type: "Account", url: `/services/data/v${TEST_CONSTANTS.apiVersion}/sobjects/Account/001000000000001AAA`},
    Id: TEST_CONSTANTS.accountRecordId,
    Name: "Test Account 1",
    Type: "Customer - Direct",
    CreatedBy: {Alias: "testuser"},
    LastModifiedBy: {Alias: "testuser"},
    CreatedDate: "2021-01-01T00:00:00Z",
    LastModifiedDate: "2021-01-01T00:00:00Z",
  },
  {
    attributes: {type: "Account", url: `/services/data/v${TEST_CONSTANTS.apiVersion}/sobjects/Account/001000000000002AAA`},
    Id: "001000000000000002",
    Name: "Test Account 2",
    Type: "Customer - Channel",
    CreatedBy: {Alias: "testuser"},
    LastModifiedBy: {Alias: "testuser"},
    CreatedDate: "2021-01-01T00:00:00Z",
    LastModifiedDate: "2021-01-01T00:00:00Z",
  }
];

export async function routeMock(route, host) {
  //Extract request data
  const request = route.request();
  const url = request.url();
  const path = url.split("?")[0];
  const method = request.method();

  //it's not our request, continue
  if (!path.includes(host)) {
    return false;
  }

  const apiVersion = TEST_CONSTANTS.apiVersion;

  /* SOAP API */
  if (path.includes("/services/Soap/")){
    // Handle SOAP call (common handler)
    if (await handleSoapRequest(route)) {
      return true;
    }

    //fallback
    const soapSuccess = (soapBody) => route.fulfill(createSoapSuccessResponse(soapBody));
    await soapSuccess({});
    return true;
  }

  /* REST API */
  const success = (body = {}, status = 200) => route.fulfill(createSuccessResponse(body, status));
  //extract path from url without the parameters

  if (path.includes("/services/data/")){
    // Regular API - Global Describe (SObjects)
    if (path.endsWith("/sobjects/") && !path.includes("/tooling/") && method === "GET") {
      await success({
        sobjects: [
          {name: "Account", label: "Account", keyPrefix: "001", queryable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Account/describe`}, layoutable: true, custom: false},
          {name: "Contact", label: "Contact", keyPrefix: "003", queryable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Contact/describe`}, layoutable: true, custom: false},
          {name: "Inspector_Test__c", label: "Inspector Test", keyPrefix: "a00", queryable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/describe`}, layoutable: true, custom: true}
        ]
      });
      return true;
    }

    // Tooling API - Global Describe (tooling sobjects)
    if (path.endsWith("/tooling/sobjects/") && method === "GET" && !path.includes("CustomField") && !path.includes("query")) {
      await fulfillSuccess(route, {
        encoding: "UTF-8",
        maxBatchSize: 200,
        sobjects: [
          {
            name: "CustomField",
            label: "Custom Field",
            keyPrefix: "00D",
            layoutable: false
          },
          {
            name: "ApexClass",
            label: "Apex Class",
            keyPrefix: "01p",
            layoutable: false
          }]
      });
      return true;
    }

    // Mock Account Layout Describe (order is important to ensure the most restrictive mock is used)
    if (path.includes("/sobjects/Account/describe/layouts/")) {
      await fulfillSuccess(route, {
        id: "00h000000000000AAA",
        detailLayoutSections: [
          {
            layoutRows: [
              {
                layoutItems: [
                  {
                    layoutComponents: [
                      {
                        type: "Field",
                        value: "Name"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        editLayoutSections: [
          {
            layoutRows: [
              {
                layoutItems: [
                  {
                    layoutComponents: [
                      {
                        type: "Field",
                        value: "Name"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        relatedLists: [
          {
            name: "Contacts",
            sobject: "Contact",
            field: "AccountId",
            label: "Contacts",
            columns: [
              {name: "Id"},
              {name: "Name"}
            ]
          }
        ]
      });
      return true;
    }

    // Account Describe (Fields)
    if (path.includes("/sobjects/Account/describe") && !path.includes("layouts")) {
      await success({
        name: "Account",
        label: "Account",
        keyPrefix: "001",
        createable: true,
        updateable: true,
        deletable: true,
        fields: [
          {name: "Id", label: "Account ID", type: "id", createable: false, updateable: false, nillable: false, referenceTo: []},
          {name: "Name", label: "Account Name", type: "string", length: 255, createable: true, updateable: true, nillable: false, nameField: true, referenceTo: []},
          {name: "Type",
            label: "Account Type",
            type: "picklist",
            createable: true,
            updateable: true,
            nillable: true,
            picklistValues: [
              {value: "Customer - Channel", label: "Customer - Channel", active: true},
              {value: "Customer - Direct", label: "Customer - Direct", active: true},
              {value: "Customer", label: "Customer", active: true},
              {value: "Partner", label: "Partner", active: true}
            ],
            referenceTo: []},
          {name: "Description", label: "Description", type: "textarea", createable: true, updateable: true, nillable: true, referenceTo: []}
        ],
        childRelationships: [
          {relationshipName: "Contacts", childSObject: "Contact", field: "AccountId"}
        ],
        urls: {
          sobject: `/services/data/v${apiVersion}/sobjects/Account`,
          rowTemplate: `/services/data/v${apiVersion}/sobjects/Account/{ID}`,
          layouts: `/services/data/v${apiVersion}/sobjects/Account/describe/layouts`
        }
      });
      return true;
    }

    // Platform Event Describe (TestEvent__e) - for event-monitor Generate flow
    if (path.includes("/sobjects/TestEvent__e/describe")) {
      await fulfillSuccess(route, {
        name: "TestEvent__e",
        label: "Test Event",
        keyPrefix: "e00",
        createable: true,
        fields: [
          {name: "Id", label: "Record ID", type: "id", createable: false, updateable: false, referenceTo: []},
          {name: "Message__c", label: "Message", type: "string", length: 255, createable: true, updateable: true, referenceTo: []},
          {name: "Count__c", label: "Count", type: "double", createable: true, updateable: true, referenceTo: []}
        ]
      });
      return true;
    }

    // Inspector_Test__c Describe (Fields)
    if (path.includes("/sobjects/Inspector_Test__c/describe")) {
      await fulfillSuccess(route, {
        name: "Inspector_Test__c",
        fields: [
          {name: "Id", label: "Record ID", type: "id", idLookup: true, createable: false, updateable: false, referenceTo: []},
          {name: "Name", label: "Name", type: "string", idLookup: true, createable: true, updateable: true, referenceTo: []},
          {name: "Checkbox__c", label: "Checkbox", type: "boolean", createable: true, updateable: true, referenceTo: []},
          {name: "Number__c", label: "Number", type: "double", createable: true, updateable: true, referenceTo: []},
          {name: "Lookup__c", label: "Lookup", type: "reference", referenceTo: ["Inspector_Test__c"], createable: true, updateable: true, relationshipName: "Lookup__r"},
          {name: "OwnerId", label: "Owner ID", type: "reference", referenceTo: ["User", "Group"], createable: true, updateable: true}
        ]
      });
      return true;
    }

    // REST API - User Describe
    if (url.includes("/sobjects/User/describe")) {
      await fulfillSuccess(route, {
        fields: [
          {
            name: "LanguageLocaleKey",
            picklistValues: [
              {value: "en_US", label: "English (United States)", active: true},
              {value: "fr", label: "French", active: true}
            ]
          },
          {
            name: "LocaleSidKey",
            picklistValues: [
              {value: "en_US", label: "English (United States)", active: true},
              {value: "fr_FR", label: "French (France)", active: true}
            ]
          }
        ]
      });
      return true;
    }

    // REST API - SOQL Query
    if (method === "GET" && path.includes("/query") && url.includes("q=")) {
      const qPart = url.split("q=")[1] || "";
      const qValue = qPart.includes("&") ? qPart.split("&")[0] : qPart;
      const query = decodeURIComponent(qValue).toLowerCase();

      // EntityDefinition for Custom Platform Events (KeyPrefix LIKE 'e%')
      if ((query.includes("from entitydefinition") || query.includes("from+entitydefinition"))
        && query.includes("keyprefix") && query.includes("e%")) {
        await fulfillSuccess(route, {
          size: 1,
          totalSize: 1,
          done: true,
          records: [
            {
              QualifiedApiName: "TestEvent__e",
              Label: "Test Event",
              KeyPrefix: "e00",
              DurableId: "TestEvent__e",
              IsCustomSetting: false,
              RecordTypesSupported: false,
              NewUrl: null,
              IsEverCreatable: true,
              NamespacePrefix: null
            }
          ]
        });
        return true;
      }

      if (query.includes("from entitydefinition") || query.includes("from+entitydefinition")) {
        await fulfillSuccess(route, {
          size: 2,
          totalSize: 2,
          done: true,
          records: [
            {
              QualifiedApiName: "Account",
              Label: "Account",
              KeyPrefix: "001",
              DurableId: "Account",
              IsCustomSetting: false,
              RecordTypesSupported: false,
              NewUrl: null,
              IsEverCreatable: true,
              NamespacePrefix: null
            },
            {
              QualifiedApiName: "Inspector_Test__c",
              Label: "Inspector Test",
              KeyPrefix: "a00",
              DurableId: "Inspector_Test__c",
              IsCustomSetting: false,
              RecordTypesSupported: false,
              NewUrl: null,
              IsEverCreatable: true,
              NamespacePrefix: null
            }
          ]
        });
        return true;
      }

      if (query.includes("from organization") || query.includes("from+organization")) {
        await fulfillSuccess(route, {totalSize: 1,
          done: true,
          records: [{
            Id: "00D000000000000000",
            IsSandbox: true,
            InstanceName: "NA1",
            TrialExpirationDate: null,
            OrganizationType: "Enterprise Edition",
            type: "Organization",
            url: `/services/data/v${apiVersion}/sobjects/Organization/00D000000000000000`
          }]
        });
        return true;
      }

      if (query.includes("from account") || query.includes("from+account")) {
        const isById = query.includes("id=") || query.includes("id =") || query.includes("id+=");
        await success({
          totalSize: isById ? 1 : 2,
          done: true,
          records: isById ? new Array(accountRecords[0]) : accountRecords,
        });
        return true;
      }

      // FlowDefinitionView query
      if (query.includes("from flowdefinitionview") || query.includes("from+flowdefinitionview")) {
        await fulfillSuccess(route, {
          records: [{
            Label: "Test Flow",
            ApiName: "Test_Flow",
            ProcessType: "Flow",
            TriggerType: "Autopilot",
            TriggerObjectOrEventLabel: "Account",
            DurableId: TEST_CONSTANTS.flowDefId
          }]
        });
        return true;
      }

      // Mock Flow versions query (flow-scanner: SELECT Id, VersionNumber, Status FROM Flow)
      if (path.includes("/tooling/") && query.includes("from flow") && query.includes("versionnumber") && !query.includes("definition")) {
        await fulfillSuccess(route, {
          records: [
            {
              Id: TEST_CONSTANTS.flowId,
              VersionNumber: 1,
              Status: "Active"
            },
            {
              Id: "301000000000002AAA",
              VersionNumber: 2,
              Status: "Obsolete"
            }
          ]
        });
        return true;
      }

      // Dependencies Explorer - ApexClass (test/main: SalesforceInspectorTest)
      if (path.includes("/tooling/") && query.includes("apexclass")) {
        await fulfillSuccess(route, {
          records: [
            {
              Id: "01p000000000001AAA",
              Name: "SalesforceInspectorTest",
              NamespacePrefix: null
            }
          ]
        });
        return true;
      }

      // Dependencies Explorer - Flow (test/main: RecordTrigger_InspectorTest)
      if (path.includes("/tooling/query") && query.includes("from flow") && query.includes("definition")) {
        await fulfillSuccess(route, {
          records: [
            {
              Id: TEST_CONSTANTS.flowId,
              Definition: {DeveloperName: "RecordTrigger_InspectorTest"},
              VersionNumber: 1,
              Status: "Active",
              ProcessType: "AutoLaunchedFlow"
            }
          ]
        });
        return true;
      }

      // Dependencies Explorer - CustomObject (test/main: Inspector_Test__c)
      // Match tooling query for CustomObject (FROM CustomObject) - avoid EntityParticle which has FROM EntityParticle
      const isCustomObjectQuery = path.includes("/tooling/")
        && (query.includes("from customobject") || query.includes("from+customobject"))
        && !query.includes("from entityparticle");
      if (isCustomObjectQuery) {
        await fulfillSuccess(route, {
          records: [
            {
              Id: "01I000000000001AAA",
              DeveloperName: "Inspector_Test__c",
              NamespacePrefix: null
            }
          ]
        });
        return true;
      }

      // Dependencies Explorer - MetadataComponentDependency
      // dependsOn: MetadataComponentId IN (...) - ApexClass/Flow depends on Inspector_Test__c
      // dependedOnBy: RefMetadataComponentId IN (...) - return empty (nothing references our test metadata)
      if (path.includes("/tooling/") && query.includes("metadatacomponentdependency")) {
        const isDependedOnBy = query.includes("refmetadatacomponentid in");
        let records = [];
        if (!isDependedOnBy) {
          const apexClassId = "01p000000000001";
          const flowIdLower = TEST_CONSTANTS.flowId.toLowerCase();
          // ApexClass SalesforceInspectorTest (01p000000000001AAA) references Inspector_Test__c
          if (query.includes(apexClassId)) {
            records = [{
              MetadataComponentId: "01p000000000001AAA",
              MetadataComponentName: "SalesforceInspectorTest",
              MetadataComponentType: "ApexClass",
              RefMetadataComponentId: "01I000000000001AAA",
              RefMetadataComponentName: "Inspector_Test__c",
              RefMetadataComponentType: "CustomObject",
              RefMetadataComponentNamespace: null
            }];
          } else if (query.includes(flowIdLower)) {
            // Flow RecordTrigger_InspectorTest references Inspector_Test__c
            records = [{
              MetadataComponentId: TEST_CONSTANTS.flowId,
              MetadataComponentName: "RecordTrigger_InspectorTest",
              MetadataComponentType: "Flow",
              RefMetadataComponentId: "01I000000000001AAA",
              RefMetadataComponentName: "Inspector_Test__c",
              RefMetadataComponentType: "CustomObject",
              RefMetadataComponentNamespace: null
            }];
          }
        }
        await fulfillSuccess(route, {
          records,
          totalSize: records.length,
          done: true
        });
        return true;
      }

      if (query.includes("from inspector_test__c") || query.includes("from+inspector_test__c")) {
        await fulfillSuccess(route, {
          totalSize: 0,
          done: true,
          records: []
        });
        return true;
      }

      if (query.includes(" from permissionset") || query.includes("from+permissionset")) {
        await fulfillSuccess(route, {
          totalSize: 3,
          done: true,
          records: [
            {
              Id: "0PS000000000001AAA",
              Name: "TestPermissionSet",
              Profile: null
            },
            {
              Id: "0PS000000000002AAA",
              Name: "AdminPermissionSet",
              Profile: {
                Name: "System Administrator"
              }
            },
            {
              Id: "0PS000000000003AAA",
              Name: "StandardPermissionSet",
              Profile: {
                Name: "Standard User"
              }
            }
          ]
        });
        return true;
      }

      // REST API - RecentlyViewed Query
      if (query.includes(" from recentlyviewed") || query.includes("from+recentlyviewed")) {
        await fulfillSuccess(route, {
          totalSize: 2,
          done: true,
          records: [
            {Id: "001000000000001AAA", Name: "Test Account", Type: "Account"},
            {Id: "003000000000001AAA", Name: "Test Contact", Type: "Contact"}
          ]
        });
        return true;
      }

      // REST API - User Query (for Users tab)
      if (query.includes(" from user") || query.includes("from+users")) {
        await fulfillSuccess(route, {
          totalSize: 2,
          done: true,
          records: [
            {
              Id: "005000000000001AAA",
              Name: TEST_CONSTANTS.testUserSearchTerm,
              Email: "integration@example.com",
              Username: "integration@example.com",
              Alias: "intuser",
              IsActive: true,
              Profile: {Name: "System Administrator"},
              UserRole: {Name: "CEO"}
            }
          ]
        });
        return true;
      }

      //default response (including FlowInterview)
      await success({totalSize: 0, done: true, records: []});
      return true;
    }

    //REST API - DML Operations
    // POST (Create) - Platform Event publish
    if (method === "POST" && path.includes("sobjects/TestEvent__e")) {
      await success({id: "e00000000000001AAA", success: true, errors: []}, 201);
      return true;
    }

    // POST (Create)
    if (method === "POST" && path.includes("sobjects/Inspector_Test__c")) {
      await success({id: "a00000000000001AAA", success: true, errors: []}, 201);
      return true;
    }

    // PATCH (Update)
    if (method === "PATCH" && path.includes("sobjects/")) {
      await success(undefined, 204);
      return true;
    }

    // DELETE (Delete)
    if (method === "DELETE" && path.includes("sobjects/")) {
      await success(undefined, 204);
      return true;
    }

    // Mock EntityParticle Query (Tooling API)
    if (path.includes("/tooling/query") && path.includes("EntityParticle")) {
      await fulfillSuccess(route, {
        records: [
          {
            QualifiedApiName: "Id",
            Label: "Account ID",
            DataType: "Id",
            EntityDefinition: {DurableId: "Account"}
          },
          {
            QualifiedApiName: "Name",
            Label: "Account Name",
            DataType: "String",
            Length: 255,
            IsNillable: false,
            EntityDefinition: {DurableId: "Account"}
          },
          {
            QualifiedApiName: "Description",
            Label: "Description",
            DataType: "TextArea",
            IsNillable: true,
            EntityDefinition: {DurableId: "Account"}
          }
        ]
      });
      return true;
    }

    // GET (Retrieve specific record)
    // in account object
    if (method === "GET" && path.includes("/sobjects/Account/" + TEST_CONSTANTS.accountRecordId)) {
      await fulfillSuccess(route, {
        Id: TEST_CONSTANTS.accountRecordId,
        Name: TEST_CONSTANTS.accountRecordName,
        Description: "Test Description",
        Type: "Customer",
        attributes: {
          type: "Account",
          url: `/services/data/v${apiVersion}/sobjects/Account/${TEST_CONSTANTS.accountRecordId}`
        }
      });
      return true;
    }

    //  in Inspector_Test__c
    if (method === "GET" && path.includes("sobjects/Inspector_Test__c/a00000000000001AAA")) {
      await success({
        attributes: {type: "Inspector_Test__c", url: `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/a00000000000001AAA`},
        Id: "a00000000000001AAA",
        Name: "SFIR Updated-" + TEST_GUID
      });
      return true;
    }

    // REST API - Deploy Request Details
    if (path.includes("/metadata/deployRequest/") && method === "GET") {
      await fulfillSuccess(route, {
        deployResult: {
          id: "0Af000000000001AAA",
          success: true,
          details: {
            componentSuccesses: [
              {
                componentType: "ApexClass",
                fullName: "TestClass",
                fileName: "classes/TestClass.cls"
              }
            ]
          }
        }
      });
      return true;
    }

    // REST API - limits
    if (path.includes("/limits") && method === "GET") {
      await success({
        "HourlyPublishedPlatformEvents": {
          "Max": 10000,
          "Remaining": 1000
        },
        "DailyDeliveredPlatformEvents": {
          "Max": 10000,
          "Remaining": 1000
        },
        "HourlyPublishedStandardVolumePlatform​Events": {
          "Max": 10000,
          "Remaining": 1000
        },
        "DailyStandardVolumePlatformEvents": {
          "Max": 10000,
          "Remaining": 1000
        }
      });
      return true;
    }

    // REST API - Versions / Discovery
    if (path.endsWith(`/v${apiVersion}/`) && method === "GET") {
      await success({
        tooling: `/services/data/v${apiVersion}/tooling`,
        query: `/services/data/v${apiVersion}/query`
      });
      return true;
    }

    // REST API - Get latest API version (used by getLatestApiVersionFromOrg)
    if (path.endsWith("/services/data/")) {
      await fulfillSuccess(route, [
        {version: "60.0", label: "Spring '24"},
        {version: "61.0", label: "Summer '24"},
        {version: "62.0", label: "Winter '25"},
        {version: "63.0", label: "Spring '25"},
        {version: "64.0", label: "Summer '25"},
        {version: "65.0", label: "Winter '26"},
        {version: "66.0", label: "Spring '26"}
      ]);
      return true;
    }

    // REST API - Composite API
    if (path.includes("/composite")){
      const body = await request.postDataJSON();

      // Mock Tooling API Composite query for Flow metadata and versions
      if (path.includes("/tooling/composite") && method === "POST") {
        if (body.compositeRequest && Array.isArray(body.compositeRequest)) {
          const responses = body.compositeRequest.map(req => {
            if (req.referenceId === "flow") {
              return {
                referenceId: "flow",
                httpStatusCode: 200,
                body: {
                  records: [{
                    Id: TEST_CONSTANTS.flowId,
                    Metadata: {
                      apiVersion: 58,
                      label: "Test Flow",
                      processType: "Flow",
                      status: "Active"
                    }
                  }]
                }
              };
            } else if (req.referenceId === "versions") {
              return {
                referenceId: "versions",
                httpStatusCode: 200,
                body: {
                  records: [
                    {
                      Id: TEST_CONSTANTS.flowId,
                      VersionNumber: 1,
                      Status: "Active"
                    },
                    {
                      Id: "301000000000002AAA",
                      VersionNumber: 2,
                      Status: "Obsolete"
                    }
                  ]
                }
              };
            }
            return {
              referenceId: req.referenceId,
              httpStatusCode: 200,
              body: {}
            };
          });

          await fulfillSuccess(route, {
            compositeResponse: responses
          });
          return true;
        }
      }

      // Mock Composite API for field usage
      if (body.compositeRequest) {
        await fulfillSuccess(route, {
          compositeResponse: body.compositeRequest.map(req => ({
            referenceId: req.referenceId,
            httpStatusCode: 200,
            body: {
              totalSize: 100,
              records: []
            }
          }))
        });
        return true;
      }
    }

    // REST API - OAuth UserInfo
    if (url.includes("/oauth2/userinfo")) {
      await fulfillSuccess(route, {

        user_id: "005000000000001AAA",

        organization_id: "00D000000000001AAA"
      });
      return true;
    }
  }

  // Fallback
  await success({});
  return true;
}

/**
 * Common route handler for getUserInfo SOAP calls
 * This should be used in all test files to avoid duplication
 * @returns {Promise<boolean>} - True if request was handled, false otherwise
 */
export async function handleGetUserInfoSoap(route) {
  const request = route.request();
  const method = request.method();

  if (method === "POST") {
    await request.postData();

  }
  return false; // Not handled, continue to next handler
}

async function handleSoapRequest(route) {
  const request = route.request();
  const url = request.url();
  const method = request.method();

  // SOAP DML Operations (create, update, delete, upsert)
  if (method === "POST") {
    const requestBody = await request.postData();

    //Metadata API
    if (requestBody && url.includes("/services/Soap/m/")){
      if (requestBody.includes("describeMetadata")) {
        await fulfillSoapSuccess(route, `
                  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                    <soapenv:Body>
                      <met:describeMetadataResponse>
                        <met:result>
                          <met:metadataObjects>
                            <met:xmlName>ApexClass</met:xmlName>
                          </met:metadataObjects>
                          <met:metadataObjects>
                            <met:xmlName>ApexPage</met:xmlName>
                          </met:metadataObjects>
                          <met:metadataObjects>
                            <met:xmlName>CustomObject</met:xmlName>
                          </met:metadataObjects>
                        </met:result>
                      </met:describeMetadataResponse>
                    </soapenv:Body>
                  </soapenv:Envelope>
                `);
        return true;
      }
      // SOAP Metadata API - listMetadata
      if (requestBody.includes("listMetadata")) {
        await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                    <soapenv:Body>
                    <met:listMetadataResponse>
                        <met:result>
                        <met:fullName>TestClass</met:fullName>
                        <met:type>ApexClass</met:type>
                        </met:result>
                        <met:result>
                        <met:fullName>TestPage</met:fullName>
                        <met:type>ApexPage</met:type>
                        </met:result>
                    </met:listMetadataResponse>
                    </soapenv:Body>
                </soapenv:Envelope>
                `);
        return true;
      }
      // SOAP Metadata API - retrieve
      if (requestBody && requestBody.includes("retrieve") && !requestBody.includes("checkRetrieveStatus")) {
        await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                    <soapenv:Body>
                    <met:retrieveResponse>
                        <met:result>
                        <met:id>09S000000000001AAA</met:id>
                        <met:done>false</met:done>
                        </met:result>
                    </met:retrieveResponse>
                    </soapenv:Body>
                </soapenv:Envelope>
                `);
        return true;
      }
      // SOAP Metadata API - checkRetrieveStatus
      if (requestBody && requestBody.includes("checkRetrieveStatus")) {
        await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                    <soapenv:Body>
                    <met:checkRetrieveStatusResponse>
                        <met:result>
                        <met:id>09S000000000001AAA</met:id>
                        <met:done>true</met:done>
                        <met:success>true</met:success>
                        <met:zipFile>UEsDBBQAAAAIAF</met:zipFile>
                        <met:fileProperties>
                            <met:fullName>TestClass</met:fullName>
                            <met:type>ApexClass</met:type>
                            <met:fileName>classes/TestClass.cls</met:fileName>
                        </met:fileProperties>
                        </met:result>
                    </met:checkRetrieveStatusResponse>
                    </soapenv:Body>
                </soapenv:Envelope>
                `);
        return true;
      }
      // SOAP Metadata API - deploy
      if (requestBody.includes("deploy") && !requestBody.includes("checkDeployStatus")) {
        await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                    <soapenv:Body>
                    <met:deployResponse>
                        <met:result>
                        <met:id>0Af000000000001AAA</met:id>
                        <met:done>false</met:done>
                        </met:result>
                    </met:deployResponse>
                    </soapenv:Body>
                </soapenv:Envelope>
                `);
        return true;
      }
      // SOAP Metadata API - checkDeployStatus
      if (requestBody && requestBody.includes("checkDeployStatus")) {
        await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
                    <soapenv:Body>
                    <met:checkDeployStatusResponse>
                        <met:result>
                        <met:id>0Af000000000001AAA</met:id>
                        <met:done>true</met:done>
                        <met:success>true</met:success>
                        <met:details>
                            <met:componentSuccesses>
                            <met:fullName>TestClass</met:fullName>
                            <met:componentType>ApexClass</met:componentType>
                            </met:componentSuccesses>
                        </met:details>
                        </met:result>
                    </met:checkDeployStatusResponse>
                    </soapenv:Body>
                </soapenv:Envelope>
                `);
        return true;
      }
    }

    if (requestBody) {
      //getUserInfo SOAP call
      if (requestBody && requestBody.includes("getUserInfo")) {
        await route.fulfill(createSoapSuccessResponse(createGetUserInfoSoapResponse()));
        return true;
      }
      /* SOAP DML Operations */
      // Create operation
      if (requestBody.includes("<create>") || requestBody.includes(":create")) {
        // Extract number of records from request
        const sObjectsMatch = requestBody.match(/<sObjects[^>]*>/);
        let recordCount = 1;
        if (sObjectsMatch) {
          const sObjectMatches = requestBody.match(/<sObjects[^>]*>/g);
          recordCount = sObjectMatches ? sObjectMatches.length : 1;
        }

        const results = [];
        for (let i = 0; i < recordCount; i++) {
          results.push(`
                    <result>
                        <id>a0000000000000${i + 1}AAA</id>
                        <success>true</success>
                        <created>true</created>
                        <errors/>
                    </result>
                    `);
        }

        await fulfillSoapSuccess(route, `
                    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                    <soapenv:Body>
                        <createResponse>
                        ${results.join("")}
                        </createResponse>
                    </soapenv:Body>
                    </soapenv:Envelope>
                `);
        return true;
      }

      // Update operation
      if (requestBody.includes("<update>") || requestBody.includes(":update")) {
        const results = [];
        // Extract number of records (simplified - assume batch size)
        const sObjectMatches = requestBody.match(/<sObjects[^>]*>/g);
        const recordCount = sObjectMatches ? sObjectMatches.length : 1;

        for (let i = 0; i < recordCount; i++) {
          results.push(`
                    <result>
                        <id>a0000000000000${i + 1}AAA</id>
                        <success>true</success>
                        <created>false</created>
                        <errors/>
                    </result>
                    `);
        }

        await fulfillSoapSuccess(route, `
                    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                    <soapenv:Body>
                        <updateResponse>
                        ${results.join("")}
                        </updateResponse>
                    </soapenv:Body>
                    </soapenv:Envelope>
                `);
        return true;
      }

      // Delete operation
      if (requestBody.includes("<delete>") || requestBody.includes(":delete")) {
        const results = [];
        // Extract IDs from request
        const idMatches = requestBody.match(/<ID>([^<]+)<\/ID>/g);
        const recordCount = idMatches ? idMatches.length : 1;

        for (let i = 0; i < recordCount; i++) {
          results.push(`
                    <result>
                        <id>a0000000000000${i + 1}AAA</id>
                        <success>true</success>
                        <errors/>
                    </result>
                    `);
        }

        await fulfillSoapSuccess(route, `
                    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                    <soapenv:Body>
                        <deleteResponse>
                        ${results.join("")}
                        </deleteResponse>
                    </soapenv:Body>
                    </soapenv:Envelope>
                `);
        return true;
      }

      // Upsert operation
      if (requestBody.includes("<upsert>") || requestBody.includes(":upsert")) {
        const results = [];
        // Extract number of records
        const sObjectMatches = requestBody.match(/<sObjects[^>]*>/g);
        const recordCount = sObjectMatches ? sObjectMatches.length : 1;

        // First record updates existing, second creates new
        for (let i = 0; i < recordCount; i++) {
          const isUpdate = i === 0; // First record updates
          results.push(`
                    <result>
                        <id>a0000000000000${i + 1}AAA</id>
                        <success>true</success>
                        <created>${isUpdate ? "false" : "true"}</created>
                        <errors/>
                    </result>
                    `);
        }

        await fulfillSoapSuccess(route, `
                    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                    <soapenv:Body>
                        <upsertResponse>
                        ${results.join("")}
                        </upsertResponse>
                    </soapenv:Body>
                    </soapenv:Envelope>
                `);
        return true;
      }
    }
  }
  return false;
}

/**
 * Creates a mock getUserInfo SOAP response
 * Note: getUserInfo is imported from utils.js, so we only need to mock it once
 */
function createGetUserInfoSoapResponse() {
  return `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <getUserInfoResponse>
            <result>
              <userFullName>Test User</userFullName>
              <userName>test@example.com</userName>
              <organizationName>Test Org</organizationName>
            </result>
          </getUserInfoResponse>
        </soapenv:Body>
      </soapenv:Envelope>
    `;
}
