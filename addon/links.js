
export let setupLinks = [
  //Setup
  {label: "Setup Home", link: "/lightning/setup/SetupOneHome/home", section: "Setup", prod: false},
  {label: "Service Setup Assistant", link: "/lightning/setup/ServiceHome/home", section: "Setup", prod: false},
  {label: "Service Setup", link: "/lightning/setup/SetupOneHome/home", section: "Setup", prod: false},
  {label: "Multi-Factor Authentication Assistant", link: "/lightning/setup/MfaAssistant/home", section: "Setup", prod: false},
  {label: "Release Updates", link: "/lightning/setup/ReleaseUpdates/home", section: "Setup", prod: false},
  {label: "Salesforce Mobile App", link: "/lightning/setup/SalesforceMobileAppQuickStart/home", section: "Setup", prod: false},
  {label: "Optimizer", link: "/lightning/setup/SalesforceOptimizer/home", section: "Setup", prod: false},

  //Administration > Users
  {label: "Permission Sets Groups", link: "/lightning/setup/PermSetGroups/home", section: "Administration > Users", prod: false},
  {label: "Permission Sets", link: "/lightning/setup/PermSets/home", section: "Administration > Users", prod: false},
  {label: "Profiles", link: "/lightning/setup/Profiles/home", section: "Administration > Users", prod: false},
  {label: "Profiles (Enhanced)", link: "/lightning/setup/EnhancedProfiles/home", section: "Administration > Users", prod: false},
  {label: "Public Groups", link: "/lightning/setup/PublicGroups/home", section: "Administration > Users", prod: false},
  {label: "Queues", link: "/lightning/setup/Queues/home", section: "Administration > Users", prod: false},
  {label: "Roles", link: "/lightning/setup/Roles/home", section: "Administration > Users", prod: false},
  {label: "User Management Settings", link: "/lightning/setup/UserManagementSettings/home", section: "Administration > Users", prod: false},
  {label: "Users", link: "/lightning/setup/ManageUsers/home", section: "Administration > Users", prod: false},
  //Administration > Data
  {label: "Big Objects", link: "/lightning/setup/BigObjects/home", section: "Administration > Data", prod: false},
  {label: "Data Export", link: "/lightning/setup/DataManagementExport/home", section: "Administration > Data", prod: false},
  {label: "Data Integration Metrics", link: "/lightning/setup/XCleanVitalsUi/home", section: "Administration > Data", prod: false},
  {label: "Data Integration Rules", link: "/lightning/setup/CleanRules/home", section: "Administration > Data", prod: false},
  //Administration > Data > Duplicate Management
  {label: "Duplicate Error Logs", link: "/lightning/setup/DuplicateErrorLog/home", section: "Administration > Data > Duplicate Management", prod: false},
  {label: "Duplicate Rules", link: "/lightning/setup/DuplicateRules/home", section: "Administration > Data > Duplicate Management", prod: false},
  {label: "Matching Rules", link: "/lightning/setup/MatchingRules/home", section: "Administration > Data > Duplicate Management", prod: false},
  //Administration > Data
  {label: "Mass Delete Records", link: "/lightning/setup/DataManagementDelete/home", section: "Administration > Data", prod: false},
  {label: "Mass Transfer Approval Requests", link: "/lightning/setup/DataManagementManageApprovals/home", section: "Administration > Data", prod: false},
  {label: "Mass Transfer Records", link: "/lightning/setup/DataManagementTransfer/home", section: "Administration > Data", prod: false},
  {label: "Mass Update Addresses", link: "/lightning/setup/DataManagementMassUpdateAddresses/home", section: "Administration > Data", prod: false},
  {label: "Picklist Settings", link: "/lightning/setup/PicklistSettings/home", section: "Administration > Data", prod: false},
  {label: "Schema Settings", link: "/lightning/setup/SchemaSettings/home", section: "Administration > Data", prod: false},
  {label: "State and Country/Territory Picklists", link: "/lightning/setup/AddressCleanerOverview/home", section: "Administration > Data", prod: false},
  {label: "Storage Usage", link: "/lightning/setup/CompanyResourceDisk/home", section: "Administration > Data", prod: false},
  //Administration > Email
  {label: "Apex Exception Email", link: "/lightning/setup/ApexExceptionEmail/home", section: "Administration > Email", prod: false},
  {label: "Classic Email Templates", link: "/lightning/setup/CommunicationTemplatesEmail/home", section: "Administration > Email", prod: false},
  {label: "Compliance BCC Email", link: "/lightning/setup/SecurityComplianceBcc/home", section: "Administration > Email", prod: false},
  {label: "DKIM Keys", link: "/lightning/setup/EmailDKIMList/home", section: "Administration > Email", prod: false},
  {label: "Deliverability", link: "/lightning/setup/OrgEmailSettings/home", section: "Administration > Email", prod: false},
  {label: "Email Attachments", link: "/lightning/setup/EmailAttachmentSettings/home", section: "Administration > Email", prod: false},
  //Administration > Email > Delivery Settings
  {label: "Email Domain Filters", link: "/lightning/setup/EmailDomainFilter/home", section: "Administration > Email > Delivery Settings", prod: false},
  {label: "Email Relays", link: "/lightning/setup/EmailRelay/home", section: "Administration > Email > Delivery Settings", prod: false},
  //Administration >Email
  {label: "Email Footers", link: "/lightning/setup/EmailDisclaimers/home", section: "Administration > Email", prod: false},
  {label: "Email to Salesforce", link: "/lightning/setup/EmailToSalesforce/home", section: "Administration > Email", prod: false},
  {label: "Enhanced Email", link: "/lightning/setup/EnhancedEmail/home", section: "Administration > Email", prod: false},
  {label: "Gmail Integration and Sync", link: "/lightning/setup/LightningForGmailAndSyncSettings/home", section: "Administration > Email", prod: false},
  {label: "Letterheads", link: "/lightning/setup/CommunicationTemplatesLetterheads/home", section: "Administration > Email", prod: false},
  {label: "Lightning Email Templates", link: "/lightning/setup/LightningEmailTemplateSetup/home", section: "Administration > Email", prod: false},
  {label: "Mail Merge Templates", link: "/lightning/setup/CommunicationTemplatesWord/home", section: "Administration > Email", prod: false},
  {label: "Organization-Wide Addresses", link: "/lightning/setup/OrgWideEmailAddresses/home", section: "Administration > Email", prod: false},
  {label: "Outlook Configurations", link: "/lightning/setup/EmailConfigurations/home", section: "Administration > Email", prod: false},
  {label: "Outlook Integration and Sync", link: "/lightning/setup/LightningForOutlookAndSyncSettings/home", section: "Administration > Email", prod: false},
  {label: "Send through External Email Services", link: "/lightning/setup/EmailTransportServiceSetupPage/home", section: "Administration > Email", prod: false},
  {label: "Test Deliverability", link: "/lightning/setup/TestEmailDeliverability/home", section: "Administration > Email", prod: false},

  //Platform Tools > Apps
  {label: "App Manager", link: "/lightning/setup/NavigationMenus/home", section: "Platform Tools > Apps", prod: false},
  {label: "AppExchange Marketplace", link: "/lightning/setup/AppExchangeMarketplace/home", section: "Platform Tools > Apps", prod: false},
  //Platform Tools > Apps > Connected Apps
  {label: "Connected Apps OAuth Usage", link: "/lightning/setup/ConnectedAppsUsage/home", section: "Platform Tools > Apps > Connected Apps", prod: false},
  {label: "Manage Connected Apps", link: "/lightning/setup/ConnectedApplication/home", section: "Platform Tools > Apps > Connected Apps", prod: false},
  //Platform Tools > Apps > Lightning Bolt
  {label: "Flow Category", link: "/lightning/setup/FlowCategory/home", section: "Platform Tools > Apps > Lightning Bolt", prod: false},
  {label: "Lightning Bolt Solutions", link: "/lightning/setup/LightningBolt/home", section: "Platform Tools > Apps > Lightning Bolt", prod: false},
  //Platform Tools > Apps > Mobile Apps > Salesforce
  {label: "Salesforce Branding", link: "/lightning/setup/Salesforce1Branding/home", section: "Platform Tools > Apps > Mobile Apps > Salesforce", prod: false},
  {label: "Salesforce Mobile Quick Start", link: "/lightning/setup/Salesforce1SetupSection/home", section: "Platform Tools > Apps > Mobile Apps > Salesforce", prod: false},
  {label: "Salesforce Navigation", link: "/lightning/setup/ProjectOneAppMenu/home", section: "Platform Tools > Apps > Mobile Apps > Salesforce", prod: false},
  {label: "Salesforce Notifications", link: "/lightning/setup/NotificationsSettings/home", section: "Platform Tools > Apps > Mobile Apps > Salesforce", prod: false},
  {label: "Salesforce Offline", link: "/lightning/setup/MobileOfflineStorageAdmin/home", section: "Platform Tools > Apps > Mobile Apps > Salesforce", prod: false},
  {label: "Salesforce Settings", link: "/lightning/setup/Salesforce1Settings/home", section: "Platform Tools > Apps > Mobile Apps > Salesforce", prod: false},
  //Platform Tools > Apps > Packaging
  {label: "Installed Packages", link: "/lightning/setup/ImportedPackage/home", section: "Platform Tools > Apps > Packaging", prod: false},
  {label: "Package Manager", link: "/lightning/setup/Package/home", section: "Platform Tools > Apps > Packaging", prod: false},
  {label: "Package Usage", link: "/lightning/setup/PackageUsageSummary/home", section: "Platform Tools > Apps > Packaging", prod: false},

  //Platform Tools > Feature Settings > Digital Experiences
  {label: "All Sites", link: "/lightning/setup/SetupNetworks/home", section: "Platform Tools > Feature Settings > Digital Experiences", prod: false},
  {label: "Pages", link: "/lightning/setup/CommunityFlexiPageList/home", section: "Platform Tools > Feature Settings > Digital Experiences", prod: false},
  {label: "Settings", link: "/lightning/setup/NetworkSettings/home", section: "Platform Tools > Feature Settings > Digital Experiences", prod: false},
  {label: "Templates", link: "/lightning/setup/CommunityTemplateDefinitionList/home", section: "Platform Tools > Feature Settings > Digital Experiences", prod: false},
  {label: "Themes", link: "/lightning/setup/CommunityThemeDefinitionList/home", section: "Platform Tools > Feature Settings > Digital Experiences", prod: false},

  //Platform Tools > Feature Settings
  {label: "Functions", link: "/lightning/setup/Functions/home", section: "Platform Tools > Feature Settings", prod: false},
  {label: "Home", link: "/lightning/setup/Home/home", section: "Platform Tools > Feature Settings", prod: false},
  {label: "Quip (Salesforce Anywhere)", link: "/lightning/setup/SalesforceAnywhereSetupPage/home", section: "Platform Tools > Feature Settings", prod: false},

  //Platform Tools > Einstein > Einstein Assessors
  {label: "Einstein Bots Assessor", link: "/lightning/setup/EinsteinBotsReadinessCheck/home", section: "Platform Tools > Einstein > Einstein Assessors", prod: false},
  {label: "Einstein Conversation Insights Assessor", link: "/lightning/setup/EinsteinCIReadinessCheck/home", section: "Platform Tools > Einstein > Einstein Assessors", prod: false},
  {label: "Revenue Intelligence Assessor", link: "/lightning/setup/EinsteinRevIntlReadinessCheck/home", section: "Platform Tools > Einstein > Einstein Assessors", prod: false},
  {label: "Sales Cloud Einstein Assessor", link: "/lightning/setup/SalesCloudEinsteinReadinessCheck/home", section: "Platform Tools > Einstein > Einstein Assessors", prod: false},
  {label: "Service Cloud Einstein Assessor", link: "lightning/setup/ServiceCloudEinsteinReadinessCheck/home", section: "Platform Tools > Einstein > Einstein Assessors", prod: false},
  //Platform Tools > Einstein > Einstein Platform
  {label: "Einstein Prediction Builder", link: "/lightning/setup/EinsteinBuilder/home", section: "Platform Tools > Einstein > Einstein Platform", prod: false},
  {label: "Einstein Recommendation Builder", link: "/lightning/setup/EinsteinRecommendation/home", section: "Platform Tools > Einstein > Einstein Platform", prod: false},
  {label: "Einstein.ai", link: "/lightning/setup/EinsteinKeyManagement/home", section: "Platform Tools > Einstein > Einstein Platform", prod: false},
  //Platform Tools > Einstein > Einstein Search
  {label: "Objects to Always Search", link: "/lightning/setup/SearchScope/home", section: "Platform Tools > Einstein > Einstein Search", prod: false},
  {label: "Search Layouts", link: "/lightning/setup/EinsteinSearchLayouts/home", section: "Platform Tools > Einstein > Einstein Search", prod: false},
  {label: "Search Manager", link: "/lightning/setup/SearchConfiguration/home", section: "Platform Tools > Einstein > Einstein Search", prod: false},
  {label: "Settings", link: "/lightning/setup/EinsteinSearchSettings/home", section: "Platform Tools > Einstein > Einstein Search", prod: false},
  {label: "Synonyms", link: "/lightning/setup/ManageSynonyms/home", section: "Platform Tools > Einstein > Einstein Search", prod: false},

  //Platform Tools > Feature Settings > Salesforce Files
  {label: "Asset Files", link: "/lightning/setup/ContentAssets/home", section: "Platform Tools > Feature Settings > Salesforce Files", prod: false},
  {label: "Content Deliveries and Public Links", link: "/lightning/setup/ContentDistribution/home", section: "Platform Tools > Feature Settings > Salesforce Files", prod: false},
  {label: "Files Connect", link: "/lightning/setup/ContentHub/home", section: "Platform Tools > Feature Settings > Salesforce Files", prod: false},
  {label: "General Settings", link: "/lightning/setup/FilesGeneralSettings/home", section: "Platform Tools > Feature Settings > Salesforce Files", prod: false},
  {label: "Regenerate Previews", link: "/lightning/setup/RegeneratePreviews/home", section: "Platform Tools > Feature Settings > Salesforce Files", prod: false},
  {label: "Salesforce CRM Content", link: "/lightning/setup/SalesforceCRMContent/home", section: "Platform Tools > Feature Settings > Salesforce Files", prod: false},

  //Platform Tools > Feature Settings > Sales
  {label: "Activity Settings", link: "/lightning/setup/HomeActivitiesSetupPage/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Contact Roles on Contracts", link: "/lightning/setup/ContractContactRoles/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Contact Roles on Opportunities", link: "/lightning/setup/OpportunityRoles/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Contract Settings", link: "/lightning/setup/ContractSettings/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Individual Settings", link: "/lightning/setup/IndividualSettings/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "LinkedIn Sales Navigator", link: "/lightning/setup/LinkedInSalesNavigatorPage/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Notes Settings", link: "/lightning/setup/NotesSetupPage/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Order Settings", link: "/lightning/setup/OrderSettings/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Sales Processes", link: "/lightning/setup/OpportunityProcess/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Social Accounts and Contacts Settings", link: "/lightning/setup/SocialProfileOrgSettings/home", section: "Platform Tools > Feature Settings > Sales", prod: false},
  {label: "Update Reminders", link: "/lightning/setup/OpportunityUpdateReminders/home", section: "Platform Tools > Feature Settings > Sales", prod: false},

  //Platform Tools > Feature Settings > Sales > Account
  {label: "Account Settings", link: "/lightning/setup/AccountSettings/home", section: "Platform Tools > Feature Settings > Sales > Account", prod: false},
  {label: "Account Teams", link: "/lightning/setup/AccountTeamSelling/home", section: "Platform Tools > Feature Settings > Sales > Account", prod: false},
  {label: "Person Account", link: "/lightning/setup/PersonAccountSettings/home", section: "Platform Tools > Feature Settings > Sales > Account", prod: false},

  //Platform Tools > Feature Settings > Service
  {label: "Case Assignment Rules", link: "/lightning/setup/CaseRules/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Case Auto-Response Rules", link: "/lightning/setup/CaseResponses/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Case Comment Triggers", link: "/lightning/setup/CaseCommentTriggers/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Case Team Roles", link: "/lightning/setup/CaseTeamRoles/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Predefined Case Teams", link: "/lightning/setup/CaseTeamTemplates/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Contact Roles on Cases", link: "/lightning/setup/CaseContactRoles/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Customer Contact Requests", link: "/lightning/setup/ContactRequestFlows/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Email-to-Case", link: "/lightning/setup/EmailToCase/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Escalation Rules", link: "/lightning/setup/CaseEscRules/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Feed Filters", link: "/lightning/setup/FeedFilterDefinitions/home", section: "Platform Tools > Feature Settings > Service", prod: false},

  //Platform Tools > Feature Settings > Service > Field Service
  {label: "Field Service Settings", link: "/lightning/setup/FieldServiceSettings/home", section: "Platform Tools > Feature Settings > Service > Field Service", prod: false},
  {label: "Field Service Mobile App Builder", link: "/lightning/setup/FieldServiceAppBuilder/home", section: "Platform Tools > Feature Settings > Service > Field Service", prod: false},
  {label: "Inbound Social Post Errors", link: "/lightning/setup/InboundSocialPostErrors/homee", section: "Platform Tools > Feature Settings > Service > Field Service", prod: false},

  //Platform Tools > Feature Settings > Service > Knowledge
  {label: "Data Category Assignments", link: "/lightning/setup/KnowledgeDataCategorySetup/home", section: "Platform Tools > Feature Settings > Service > Knowledge", prod: false},
  {label: "Data Category Mapping", link: "/lightning/setup/ArticleFilterRules/home", section: "Platform Tools > Feature Settings > Service > Knowledge", prod: false},
  {label: "Knowledge Settings", link: "/lightning/setup/KnowledgeSettings/home", section: "Platform Tools > Feature Settings > Service > Knowledge", prod: false},
  {label: "Validation Statuses", link: "/lightning/setup/ValidationStatuses/home", section: "Platform Tools > Feature Settings > Service > Knowledge", prod: false},

  {label: "Macro Settings", link: "/lightning/setup/MacroSettings/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Omni-Channel Settings", link: "/lightning/setup/OmniChannelSettings/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Snap-ins", link: "/lightning/setup/Snap-ins/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Social Business Rules", link: "/lightning/setup/SocialCustomerServiceBusinessRules/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Social Customer Service", link: "/lightning/setup/SocialCustomerManagementAccountSettings/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Support Processes", link: "/lightning/setup/CaseProcess/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Support Settings", link: "/lightning/setup/CaseSettings/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Web-to-Case", link: "/lightning/setup/CaseWebtocase/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  {label: "Web-to-Case HTML Generator", link: "/lightning/setup/CaseWebToCaseHtmlGenerator/home", section: "Platform Tools > Feature Settings > Service", prod: false},
  //Platform Tools > Feature Settings > Survey
  {label: "Survey Settings", link: "/lightning/setup/SurveySettings/home", section: "Platform Tools > Feature Settings > Survey", prod: false},
  //Platform Tools > Objects and Fields
  {label: "Object Manager", link: "/lightning/setup/ObjectManager/home", section: "Platform Tools > Objects and Fields", prod: false},
  {label: "Picklist Value Sets", link: "/lightning/setup/Picklists/home", section: "Platform Tools > Objects and Fields", prod: false},
  {label: "Schema Builder", link: "/lightning/setup/SchemaBuilder/home", section: "Platform Tools > Objects and Fields", prod: false},
  //Platform Tools > Events
  {label: "Event Manager", link: "/lightning/setup/EventManager/home", section: "Platform Tools > Events", prod: false},
  //Platform Tools > Process Automation
  {label: "Approval Processes", link: "/lightning/setup/ApprovalProcesses/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Automation Home", link: "/lightning/setup/ProcessHome/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Flows", link: "/lightning/setup/Flows/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Migrate to Flow", link: "/lightning/setup/MigrateToFlowTool/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Next Best Action", link: "/lightning/setup/NextBestAction/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Paused And Failed Flow Interviews", link: "/lightning/setup/Pausedflows/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Post Templates", link: "/lightning/setup/FeedTemplates/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Process Automation Settings", link: "/lightning/setup/WorkflowSettings/home", section: "Platform Tools > Process Automation", prod: false},
  {label: "Process Builder", link: "/lightning/setup/ProcessAutomation/home", section: "Platform Tools > Process Automation", prod: false},

  {label: "Email Alerts", link: "/lightning/setup/WorkflowEmails/home", section: "Platform Tools > Process Automation > Workflow Actions", prod: false},
  {label: "Field Updates", link: "/lightning/setup/WorkflowFieldUpdates/home", section: "Platform Tools > Process Automation > Workflow Actions", prod: false},
  {label: "Outbound Messages", link: "/lightning/setup/WorkflowOutboundMessaging/home", section: "Platform Tools > Process Automation > Workflow Actions", prod: false},
  {label: "Send Actions", link: "/lightning/setup/SendAction/home", section: "Platform Tools > Process Automation > Workflow Actions", prod: false},
  {label: "Tasks", link: "/lightning/setup/WorkflowTasks/home", section: "Platform Tools > Process Automation > Workflow Actions", prod: false},
  {label: "Workflow Rules", link: "/lightning/setup/WorkflowRules/home", section: "Platform Tools > Process Automation", prod: false},
  //User Interface
  {label: "Action Link Templates", link: "/lightning/setup/ActionLinkGroupTemplates/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Guided Actions", link: "/lightning/setup/GuidedActions/home", section: "Platform Tools > User Interface", prod: false},
  {label: "App Menu", link: "/lightning/setup/AppMenu/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Custom Labels", link: "/lightning/setup/ExternalStrings/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Density Settings", link: "/lightning/setup/DensitySetup/home", section: "Platform Tools > User Interface", prod: false},

  {label: "Global Actions", link: "/lightning/setup/GlobalActions/home", section: "Platform Tools > User Interface > Global Actions", prod: false},
  {label: "Publisher Layouts", link: "/lightning/setup/GlobalPublisherLayouts/home", section: "Platform Tools > User Interface > Global Actions", prod: false},

  {label: "Lightning App Builder", link: "/lightning/setup/FlexiPageList/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Lightning Extension", link: "/lightning/setup/LightningExtension/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Loaded Console Tab Limit", link: "/lightning/setup/ConsoleMaxTabCacheSetup/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Path Settings", link: "/lightning/setup/PathAssistantSetupHome/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Quick Text Settings", link: "/lightning/setup/LightningQuickTextSettings/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Record Page Settings", link: "/lightning/setup/SimpleRecordHome/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Rename Tabs and Labels", link: "/lightning/setup/RenameTab/home", section: "Platform Tools > User Interface", prod: false},
  //Sites and Domains
  {label: "Custom URLs", link: "/lightning/setup/DomainSites/home", section: "Platform Tools > User Interface > Sites and Domains", prod: false},
  {label: "Domains", link: "/lightning/setup/DomainNames/home", section: "Platform Tools > User Interface > Sites and Domains", prod: false},
  {label: "Sites", link: "/lightning/setup/CustomDomain/home", section: "Platform Tools > User Interface > Sites and Domains", prod: false},

  {label: "Tabs", link: "/lightning/setup/CustomTabs/home", section: "Platform Tools > User Interface", prod: false},
  {label: "Themes and Branding", link: "/lightning/setup/ThemingAndBranding/home", section: "Platform Tools > User Interface", prod: false},
  //Translation Workbench
  {label: "Data Translation Settings", link: "/lightning/setup/LabelWorkbenchDataTranslationSetup/home", section: "Platform Tools > User Interface > Translation Workbench", prod: false},
  {label: "Export", link: "/lightning/setup/LabelWorkbenchExport/home", section: "Platform Tools > User Interface > Translation Workbench", prod: false},
  {label: "Import", link: "/lightning/setup/LabelWorkbenchImport/home", section: "Platform Tools > User Interface > Translation Workbench", prod: false},
  {label: "Override", link: "/lightning/setup/LabelWorkbenchOverride/home", section: "Platform Tools > User Interface > Translation Workbench", prod: false},
  {label: "Translate", link: "/lightning/setup/LabelWorkbenchTranslate/home", section: "Platform Tools > User Interface > Translation Workbench", prod: false},
  {label: "Translation Settings", link: "/lightning/setup/LabelWorkbenchSetup/home", section: "Platform Tools > User Interface > Translation Workbench", prod: false},

  {label: "User Interface", link: "/lightning/setup/UserInterfaceUI/home", section: "Platform Tools > User Interface", prod: false},
  //Custom Code
  {label: "Apex Classes", link: "/lightning/setup/ApexClasses/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Apex Hammer Test Results", link: "/lightning/setup/ApexHammerResultStatus/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Apex Settings", link: "/lightning/setup/ApexSettings/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Apex Test Execution", link: "/lightning/setup/ApexTestQueue/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Apex Test History", link: "/lightning/setup/ApexTestHistory/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Apex Triggers", link: "/lightning/setup/ApexTriggers/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Canvas App Previewer", link: "/lightning/setup/CanvasPreviewerUi/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Custom Metadata Types", link: "/lightning/setup/CustomMetadata/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Custom Permissions", link: "/lightning/setup/CustomPermissions/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Custom Settings", link: "/lightning/setup/CustomSettings/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Email Services", link: "/lightning/setup/EmailToApexFunction/home", section: "Platform Tools > Custom Code", prod: false},
  //Lightning Components
  {label: "Debug Mode", link: "/lightning/setup/UserDebugModeSetup/home", section: "Platform Tools > Custom Code > Lightning Components", prod: false},
  {label: "Lightning Components", link: "/lightning/setup/LightningComponentBundles/home", section: "Platform Tools > Custom Code > Lightning Components", prod: false},

  {label: "Platform Cache", link: "/lightning/setup/PlatformCache/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Remote Access", link: "/lightning/setup/RemoteAccess/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Static Resources", link: "/lightning/setup/StaticResources/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Tools", link: "/lightning/setup/ClientDevTools/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Visualforce Components", link: "/lightning/setup/ApexComponents/home", section: "Platform Tools > Custom Code", prod: false},
  {label: "Visualforce Pages", link: "/lightning/setup/ApexPages/home", section: "Platform Tools > Custom Code", prod: false},
  //Development
  {label: "Dev Hub", link: "/lightning/setup/DevHub/home", section: "Platform Tools > Dev Hub", prod: true},
  {label: "DevOps Center", link: "/lightning/setup/DevOpsCenterSetup/home", section: "Platform Tools > Dev Hub", prod: true},
  {label: "Org Shape", link: "/lightning/setup/ShapeGrantAccess/home", section: "Platform Tools > Dev Hub", prod: true},
  //Performance
  {label: "Performance Assistant", link: "/lightning/setup/PerformanceAssistant/home", section: "Platform Tools > Performance > Performance Testing", prod: false},
  //Platform Tools > Environments
  {label: "Inbound Change Sets", link: "/lightning/setup/InboundChangeSet/home", section: "Platform Tools > Environments > Change Sets", prod: false},
  {label: "Outbound Change Sets", link: "/lightning/setup/OutboundChangeSet/home", section: "Platform Tools > Environments > Change Sets", prod: false},
  //Platform Tools > Environments > Deploy
  {label: "Deployment Settings", link: "/lightning/setup/DeploymentSettings/home", section: "Platform Tools > Environments > Deploy", prod: false},
  {label: "Deployment Status", link: "/lightning/setup/DeployStatus/home", section: "Platform Tools > Environments > Deploy", prod: false},
  //Platform Tools > Environments > Jobs
  {label: "Apex Flex Queue", link: "/lightning/setup/ApexFlexQueue/home", section: "Platform Tools > Environments > Jobs", prod: false},
  {label: "Apex Jobs", link: "/lightning/setup/AsyncApexJobs/home", section: "Platform Tools > Environments > Jobs", prod: false},
  {label: "Background Jobs", link: "/lightning/setup/ParallelJobsStatus/home", section: "Platform Tools > Environments > Jobs", prod: false},
  {label: "Bulk Data Load Jobs", link: "/lightning/setup/AsyncApiJobStatus/home", section: "Platform Tools > Environments > Jobs", prod: false},
  {label: "Scheduled Jobs", link: "/lightning/setup/ScheduledJobs/home", section: "Platform Tools > Environments > Jobs", prod: false},
  //Platform Tools > Environments > Logs
  {label: "Debug Logs", link: "/lightning/setup/ApexDebugLogs/home", section: "Platform Tools > Environments > Logs", prod: false},
  {label: "Email Log Files", link: "/lightning/setup/EmailLogFiles/home", section: "Platform Tools > Environments > Logs", prod: false},
  //Platform Tools > Environments > Monitoring
  {label: "API Usage Notifications", link: "/lightning/setup/MonitoringRateLimitingNotification/home", section: "Platform Tools > Environments > Monitoring", prod: false},
  {label: "Case Escalations", link: "/lightning/setup/DataManagementManageCaseEscalation/home", section: "Platform Tools > Environments > Monitoring", prod: false},
  {label: "Email Snapshots", link: "/lightning/setup/EmailCapture/home", section: "Platform Tools > Environments > Monitoring", prod: false},
  {label: "Outbound Messages", link: "/lightning/setup/WorkflowOmStatus/home", section: "Platform Tools > Environments > Monitoring", prod: false},
  {label: "Time-Based Workflow", link: "/lightning/setup/DataManagementManageWorkflowQueue/home", section: "Platform Tools > Environments > Monitoring", prod: false},

  {label: "Sandboxes", link: "/lightning/setup/DataManagementCreateTestInstance/home", section: "Platform Tools > Environments", prod: true},
  {label: "System Overview", link: "/lightning/setup/SystemOverview/home", section: "Platform Tools > Environments", prod: false},
  //Platform Tools > User Engagement
  {label: "Adoption Assistance", link: "/lightning/setup/AdoptionAssistance/home", section: "Platform Tools > User Engagement", prod: false},
  {label: "Guidance Center", link: "/lightning/setup/LearningSetup/home", section: "Platform Tools > User Engagement", prod: false},
  {label: "Help Menu", link: "/lightning/setup/HelpMenu/home", section: "Platform Tools > User Engagement", prod: false},
  {label: "In-App Guidance", link: "/lightning/setup/Prompts/home", section: "Platform Tools > User Engagement", prod: false},
  //Platform Tools > Integrations
  {label: "API", link: "/lightning/setup/WebServices/home", section: "Platform Tools > Integrations", prod: false},
  {label: "Basic Data Import", link: "/lightning/setup/BasicDataImport/home", section: "Platform Tools > Integrations", prod: false},
  {label: "Change Data Capture", link: "/lightning/setup/CdcObjectEnablement/home", section: "Platform Tools > Integrations", prod: false},
  {label: "Data Import Wizard", link: "/lightning/setup/DataManagementDataImporter/home", section: "Platform Tools > Integrations", prod: false},
  {label: "Data Loader", link: "/lightning/setup/DataLoader/home", section: "Platform Tools > Integrations", prod: false},
  {label: "Dataloader.io", link: "/lightning/setup/DataLoaderIo/home", section: "Platform Tools > Integrations", prod: false},
  {label: "External Data Sources", link: "/lightning/setup/ExternalDataSource/home", section: "Platform Tools > Integrations", prod: false},
  {label: "External Objects", link: "/lightning/setup/ExternalObjects/home", section: "Platform Tools > Integrations", prod: false},
  {label: "External Services", link: "/lightning/setup/ExternalServices/home", section: "Platform Tools > Integrations", prod: false},
  {label: "Platform Events", link: "/lightning/setup/EventObjects/home", section: "Platform Tools > Integrations", prod: false},
  {label: "Teams Integration", link: "/lightning/setup/MicrosoftTeamsIntegration/home", section: "Platform Tools > Integrations", prod: false},
  //Platform Tools > Notification Builder
  {label: "Custom Notifications", link: "/lightning/setup/CustomNotifications/home", section: "Platform Tools > Notification Builder", prod: false},
  {label: "Notification Delivery Settings", link: "/lightning/setup/NotificationTypesManager/home", section: "Platform Tools > Notification Builder", prod: false},
  //Settings > Company Settings
  {label: "Business Hours", link: "/lightning/setup/BusinessHours/home", section: "Settings > Company Settings", prod: false},
  {label: "Public Calendars and Resources", link: "/lightning/setup/Calendars/home", section: "Settings > Company Settings > Calendar Settings", prod: false},
  {label: "Company Information", link: "/lightning/setup/CompanyProfileInfo/home", section: "Settings > Company Settings", prod: false},
  {label: "Data Protection and Privacy", link: "/lightning/setup/ConsentManagement/home", section: "Settings > Company Settings", prod: false},
  {label: "Fiscal Year", link: "/lightning/setup/ForecastFiscalYear/home", section: "Settings > Company Settings", prod: false},
  {label: "Holidays", link: "/lightning/setup/Holiday/home", section: "Settings > Company Settings", prod: false},
  {label: "Language Settings", link: "/lightning/setup/LanguageSettings/home", section: "Settings > Company Settings", prod: false},
  {label: "Manage Currencies", link: "/lightning/setup/CompanyCurrency/home", section: "Settings > Company Settings", prod: false},
  {label: "Maps and Location Settings", link: "/lightning/setup/MapsAndLocationServicesSettings/home", section: "Settings > Company Settings", prod: false},
  {label: "My Domain", link: "/lightning/setup/OrgDomain/home", section: "Settings > Company Settings", prod: false},
  //Settings > Data Classification
  {label: "Data Classification", link: "/lightning/setup/DataClassificationSettings/home", section: "Settings > Data Classification", prod: false},
  {label: "Data Classification Download", link: "/lightning/setup/DataClassificationDownload/home", section: "Settings > Data Classification", prod: false},
  {label: "Data Classification Upload", link: "/lightning/setup/DataClassificationUpload/home", section: "Settings > Data Classification", prod: false},
  //Settings > Privacy Center
  {label: "Consent Event Stream", link: "/lightning/setup/ConsentEventStream/home", section: "Settings > Privacy Center", prod: false},
  //Settings > Identity
  {label: "Auth. Providers", link: "/lightning/setup/AuthProviders/home", section: "Settings > Identity", prod: false},
  {label: "Identity Provider", link: "/lightning/setup/IdpPage/home", section: "Settings > Identity", prod: false},
  {label: "Identity Provider Event Log", link: "/lightning/setup/IdpErrorLog/home", section: "Settings > Identity", prod: false},
  {label: "Identity Verification", link: "/lightning/setup/IdentityVerification/home", section: "Settings > Identity", prod: false},
  {label: "Identity Verification History", link: "/lightning/setup/VerificationHistory/home", section: "Settings > Identity", prod: false},
  {label: "Login Flows", link: "/lightning/setup/LoginFlow/home", section: "Settings > Identity", prod: false},
  {label: "Login History", link: "/lightning/setup/OrgLoginHistory/home", section: "Settings > Identity", prod: false},
  {label: "OAuth Custom Scopes", link: "/lightning/setup/OauthCustomScope/home", section: "Settings > Identity", prod: false},
  {label: "OAuth and OpenID Connect Settings", link: "/lightning/setup/OauthOidcSettings/home", section: "Settings > Identity", prod: false},
  {label: "Single Sign-On Settings", link: "/lightning/setup/SingleSignOn/home", section: "Settings > Identity", prod: false},
  //Settings > Security
  {label: "Account Owner Report", link: "/lightning/setup/SecurityAccountOwner/home", section: "Settings > Security", prod: false},
  {label: "Activations", link: "/lightning/setup/ActivatedIpAddressAndClientBrowsersPage/home", section: "Settings > Security", prod: false},
  {label: "CORS", link: "/lightning/setup/CorsWhitelistEntries/home", section: "Settings > Security", prod: false},
  {label: "CSP Trusted Sites", link: "/lightning/setup/SecurityCspTrustedSite/home", section: "Settings > Security", prod: false},
  {label: "Certificate and Key Management", link: "/lightning/setup/CertificatesAndKeysManagement/home", section: "Settings > Security", prod: false},
  {label: "Delegated Administration", link: "/lightning/setup/DelegateGroups/home", section: "Settings > Security", prod: false},
  //Settings > Security > Event Monitoring
  {label: "Event Monitoring Settings", link: "/lightning/setup/EventMonitoringSetup/home", section: "Settings > Security > Event Monitoring", prod: false},
  {label: "Transaction Security Policies", link: "/lightning/setup/TransactionSecurityNew/home", section: "Settings > Security > Event Monitoring", prod: false},
  //Settings > Security
  {label: "Expire All Passwords", link: "/lightning/setup/SecurityExpirePasswords/home", section: "Settings > Security", prod: false},
  {label: "Field Accessibility", link: "/lightning/setup/FieldAccessibility/home", section: "Settings > Security", prod: false},
  {label: "File Upload and Download Security", link: "/lightning/setup/FileTypeSetting/home", section: "Settings > Security", prod: false},
  {label: "Health Check", link: "/lightning/setup/HealthCheck/home", section: "Settings > Security", prod: false},
  {label: "Login Access Policies", link: "/lightning/setup/LoginAccessPolicies/home", section: "Settings > Security", prod: false},
  {label: "Named Credentials", link: "/lightning/setup/NamedCredential/home", section: "Settings > Security", prod: false},
  {label: "Network Access", link: "/lightning/setup/NetworkAccess/home", section: "Settings > Security", prod: false},
  {label: "Password Policies", link: "/lightning/setup/SecurityPolicies/home", section: "Settings > Security", prod: false},
  //Settings > Security > Platform Encryption
  {label: "Advanced Settings", link: "/lightning/setup/SecurityRemoteProxy/home", section: "Settings > Security > Platform Encryption", prod: false},
  {label: "Encryption Policy", link: "/lightning/setup/EncryptionPolicy/home", section: "Settings > Security > Platform Encryption", prod: false},
  {label: "Encryption Statistics", link: "/lightning/setup/EncryptionStatistics/home", section: "Settings > Security > Platform Encryption", prod: false},
  {label: "Key Management", link: "/lightning/setup/PlatformEncryptionKeyManagement/home", section: "Settings > Security > Platform Encryption", prod: false},
  //Settings > Security
  {label: "Portal Health Check", link: "/lightning/setup/PortalSecurityReport/home", section: "Settings > Security", prod: false},
  {label: "Private Connect", link: "/lightning/setup/PrivateConnect/home", section: "Settings > Security", prod: false},
  {label: "Remote Site Settings", link: "/lightning/setup/SecurityRemoteProxy/home", section: "Settings > Security", prod: false},
  {label: "Session Management", link: "/lightning/setup/SessionManagementPage/home", section: "Settings > Security", prod: false},
  {label: "Session Settings", link: "/lightning/setup/SecuritySession/home", section: "Settings > Security", prod: false},
  {label: "Sharing Settings", link: "/lightning/setup/SecuritySharing/home", section: "Settings > Security", prod: false},
  {label: "Trusted URLs for Redirects", link: "/lightning/setup/SecurityRedirectWhitelistUrl/home", section: "Settings > Security", prod: false},
  {label: "View Setup Audit Trail", link: "/lightning/setup/SecurityEvents/home", section: "Settings > Security", prod: false},

  //Custom Link:
  {label: "Create New Flow", link: "/builder_platform_interaction/flowBuilder.app", section: "Platform Tools > Objects and Fields > New", prod: false},
  {label: "Create New Custom Object", link: "/lightning/setup/ObjectManager/new", section: "Platform Tools > Process Automation", prod: false},
  {label: "Create New Permission Set", link: "/lightning/setup/PermSets/page?address=/udd/PermissionSet/newPermissionSet.apexp", section: "Administration > Users > Permission Set", prod: false},
  {label: "Create New Custom Permission", link: "/lightning/setup/CustomPermissions/page?address=/0CP/e", section: "Platform Tools > Custom Code > Custom Permission", prod: false},
  {label: "Recycle Bin", link: "/lightning/o/DeleteEvent/home", section: "App Launcher > Custom Link", prod: false}
];
