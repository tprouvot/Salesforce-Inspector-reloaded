/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
/* global initButton */

// Configuration constants
/**
 * Application configuration and constants
 * @type {Object}
 */
const CONFIG = {
  /** @type {Array<{value: string, label: string}>} Available metadata types */
  METADATA_TYPES: [
    { value: 'ApexClass', label: 'Apex Classes' },
    { value: 'ApexTrigger', label: 'Apex Triggers' },
    { value: 'CustomObject', label: 'Custom Objects, Settings and Metadata Types' },
    { value: 'CustomField', label: 'Custom Fields' },
    { value: 'ApexPage', label: 'Visualforce Pages' },
    { value: 'ApexComponent', label: 'Visualforce Components' },
    { value: 'StaticResource', label: 'Static Resources' },
    { value: 'LightningComponent', label: 'Lightning Components' },
    { value: 'ValidationRule', label: 'Validation Rules' },
    { value: 'CustomLabel', label: 'Custom Labels' },
    { value: 'Flow', label: 'Flows / Process Builders / Workflows' },
    { value: 'LightningWebComponent', label: 'Lightning Web Components' },
    { value: 'EmailTemplate', label: 'Email Templates' },
    { value: 'WorkflowAlert', label: 'Email Alerts' },
    { value: 'WebLink', label: 'Custom Buttons (WebLink)' },
    { value: 'Layout', label: 'Page Layouts' },
    { value: 'FlexiPage', label: 'Lightning Pages' },
    { value: 'GlobalPicklist', label: 'Global Picklists' }
  ],
  
  /** @type {Object.<string, string>} Type colors mapping */
  TYPE_COLORS: {
    // Code-related types - Blue tones
    'ApexClass': '#2563eb',           // Royal blue
    'ApexTrigger': '#3b82f6',         // Sky blue
    'ApexPage': '#1d4ed8',            // Navy blue
    'ApexComponent': '#60a5fa',       // Light blue
    
    // Data/Object types - Green tones
    'CustomObject': '#059669',         // Emerald green
    'CustomField': '#10b981',         // Green
    'GlobalValueSet': '#34d399',      // Light green
    
    // Lightning/UI types - Purple tones
    'LightningComponent': '#7c3aed',  // Purple
    'FlexiPage': '#8b5cf6',           // Violet
    
    // Resource types - Orange tones
    'StaticResource': '#ea580c',      // Orange
    'Installed Package': '#f97316',   // Light orange
    
    // Automation types - Teal tones
    'Flow': '#0d9488',                // Teal
    'WorkflowRule': '#14b8a6',        // Light teal
    'ValidationRule': '#0f766e',      // Dark teal
    
    // Content types - Yellow tones
    'CustomLabel': '#ca8a04',         // Yellow
    'EmailTemplate': '#eab308',       // Light yellow
    
    // Layout types - Gray tones
    'Layout': '#6b7280',              // Gray
    'WebLink': '#9ca3af',             // Light gray
    
    // Security types - Red tones
    'PermissionSet': '#dc2626',       // Red
    'Profile': '#ef4444',             // Light red
    'User': '#f87171',                // Very light red
    'Role': '#b91c1c'                 // Dark red
  },
  
  /** @type {Array<string>} List of standard Salesforce objects */
  STANDARD_OBJECTS: [
    'Account', 'Contact', 'Case', 'Opportunity', 'Lead', 'User', 'Profile', 'Role', 'Task', 'Event', 'Note', 'Attachment', 
    'ContentVersion', 'ContentDocument', 'FeedItem', 'FeedComment', 'CollaborationGroup', 'CollaborationGroupMember', 
    'Group', 'GroupMember', 'Queue', 'QueueSobject', 'PermissionSet', 'PermissionSetAssignment', 'CustomPermission', 
    'CustomPermissionDependency', 'SetupEntityAccess', 'FieldPermissions', 'ObjectPermissions', 'TabDefinition', 'TabSet', 
    'TabSetMember', 'FlexiPage', 'LightningPage', 'LightningComponent', 'LightningComponentBundle', 'AuraDefinitionBundle', 
    'StaticResource', 'CustomObject', 'CustomField', 'CustomTab', 'CustomApplication', 'ContactPointTypeConsent',
    'ContactPointType', 'ContactPointEmail', 'ContactPointPhone', 'ContactPointAddress', 'ContactPointConsent',
    'ContactPointTypeConsentHistory', 'ContactPointTypeConsentShare', 'ContactPointTypeConsentFeed'
  ],
  
  DEFAULT_METADATA_TYPE: 'ApexClass',
  DEFAULT_FILTER: 'dependedOnBy',
  DEFAULT_EXCLUDE_EXTERNAL_PACKAGES: true,
  DEFAULT_SHOW_FLAT_VIEW: true
};

let h = React.createElement;

// Helper functions
/**
 * Utility functions for common operations
 * @type {Object}
 */
const Helpers = {
  /**
   * Gets the SVG icon for a metadata type
   * @param {string} type - The metadata type
   * @returns {Object} The SVG React element
   */
  getTypeIcon(type) {
    const iconMap = {
      // Code-related icons - SLDS patterns
      'ApexClass': 'm163 122-23-19c-7-5-15-4-21 2L3 251c-4 5-4 13 0 19l117 145c5 6 14 8 21 2l23-19c7-5 8-15 2-21L72 260l95-117c4-6 3-15-4-21zm354 129L400 106c-5-6-14-8-21-2l-23 19c-7 5-8 15-2 21l95 117-95 117c-5 6-4 16 2 21l23 19c7 5 15 4 21-2l117-146c4-7 4-14 0-19zM316 108l-30-7c-8-2-17 3-19 11l-74 284c-2 8 3 16 11 18l30 7c8 2 17-3 19-11l74-284c2-9-3-16-11-18z',
      'ApexTrigger': 'm229 120 78 79c33 2 58 29 58 62s-27 61-61 62l-73 74a155 155 0 0 0 20 9l7 42a29 29 0 0 0 29 24h29a30 30 0 0 0 29-25l7-42a151 151 0 0 0 55-33l38 15 11 2c11 0 21-5 26-14l13-23c8-10 5-26-6-35l-33-28a172 172 0 0 0 0-60l33-28a30 30 0 0 0 7-37l-14-25a30 30 0 0 0-36-12l-41 15a149 149 0 0 0-52-31l-7-41c-3-15-15-23-30-23h-28c-14 0-27 8-29 23l-7 41a148 148 0 0 0-24 9h1zM32 287h151c8 0 12 9 6 15l-51 51a13 13 0 0 0 0 19l20 19a13 13 0 0 0 19 0l121-122a13 13 0 0 0 0-19L177 129a13 13 0 0 0-19 0l-19 19a13 13 0 0 0 0 18l51 51c6 6 2 16-6 16H33c-7 0-13 6-13 13v26c0 8 5 15 12 15z',
      
      // Data/Object icons - SLDS patterns
      'CustomObject': 'M462 389 274 496c-10 6-23 6-33 0L54 389c-8-4-8-14 0-18l44-25a10 10 0 0 1 10 0l114 65c11 6 23 9 36 9s25-3 36-9l114-65a10 10 0 0 1 10 0l44 25c8 4 8 14 0 18zm0-120L274 376c-10 6-23 6-33 0L54 269c-8-4-8-14 0-18l44-25a10 10 0 0 1 10 0l114 65c11 6 23 9 36 9s25-3 36-9l114-65a10 10 0 0 1 10 0l44 25c8 4 8 14 0 18zm-219-13L55 149c-8-4-8-14 0-18L243 24c10-6 23-6 33 0l188 107c8 4 8 14 0 18L276 256c-10 5-23 5-33 0z',
      'CustomField': 'M494 479a1570 1570 0 0 1-3-97l1-49c0-15 2-30-4-44-13-32-55-38-85-38-15 0-31 2-47 6-11 3-22 7-31 12l10 25 4 15c20-10 40-15 61-15 32 0 48 13 48 38v12h-22c-41 0-72 6-93 18-23 11-33 32-33 63 0 23 7 41 21 53a80 80 0 0 0 54 19c19 0 34-3 46-8a72 72 0 0 0 30-25h1l4 26h39zm-46-79c0 6-1 11-3 16-1 4-3 8-6 11a60 60 0 0 1-42 23c-10 2-20 1-30-1-8-1-15-5-20-12-7-11-5-28 2-38a50 50 0 0 1 19-13c19-6 42-6 62-6h17v20zm-149-90L187 34c-2-5-6-9-12-9h-35c-5 0-11 4-13 9L26 310c-3 5 2 12 7 12h39c5 0 11-4 13-10l25-72h100l29 72c2 5 7 10 13 10h39c6 0 10-7 8-12zM131 185l29-75 32 75z',
      
      // UI/Page icons - SLDS patterns
      'ApexPage': 'M444.4 190H332a38.9 38.9 0 0 1-42-35.5 35.3 35.3 0 0 1 0-6.5V36a15.8 15.8 0 0 0-15.6-16H108a48.7 48.7 0 0 0-48 48v384a48.7 48.7 0 0 0 48 48h304a48.7 48.7 0 0 0 48-48V206a15.8 15.8 0 0 0-15.6-16zM335.9 393.5a39.2 39.2 0 0 1-10.8-1 41.9 41.9 0 0 1-36.8 21.6A52.4 52.4 0 0 1 270 410a48.8 48.8 0 0 1-44.3 29.1 47.2 47.2 0 0 1-45.7-31.3c-2.2 0-6.5 1.1-10 1.1a44.9 44.9 0 0 1-45.4-44.2 43.9 43.9 0 0 1 22.7-38.9 63.3 63.3 0 0 1-4.4-20.6 52.6 52.6 0 0 1 51.9-51.8 59.2 59.2 0 0 1 40.6 21.4 47.9 47.9 0 0 1 34.6-14.2 49.1 49.1 0 0 1 42.1 23.8 74.9 74.9 0 0 1 23.8-5.4 59.3 59.3 0 0 1 58.3 57.3 58.5 58.5 0 0 1-58.3 57.2z M364 150h85a12 12 0 0 0 11-12 14 14 0 0 0-3-9L351 23a14 14 0 0 0-9-3 12 12 0 0 0-12 11v85a34.9 34.9 0 0 0 34 34z',
      'FlexiPage': 'M314 153h82c6 0 11-5 11-11 0-3-1-5-3-8L302 33c-3-2-5-3-8-3-6 0-11 5-11 11v81c0 17 14 31 31 31zm181 104-9-9c-6-6-15-6-22 0L345 367v28c0 2 0 4 2 4h26l3-1 119-118c7-8 7-17 0-23zm-96 187h-71a29 29 0 0 1-29-29v-54c0-8 2-16 9-21l95-95c3-3 5-7 5-11v-20c0-8-7-15-15-15H283a46 46 0 0 1-46-46V45c0-8-7-15-16-15H66a47 47 0 0 0-46 46v368c0 25 21 46 46 46h294c22 0 42-16 46-37 1-4-3-9-7-9zM82 168c0-8 7-15 15-15h62c9 0 15 7 15 15v15c0 8-7 15-15 15H97c-9 0-15-7-15-15v-15zm155 199c0 8-7 15-15 15H97c-9 0-15-7-15-15v-15c0-8 7-15 15-15h124c9 0 15 7 15 15v15zm31-92c0 8-7 15-15 15H97c-9 0-15-7-15-15v-15c0-8 7-15 15-15h155c9 0 15 7 15 15v15z',
      'ApexComponent': 'M500 54c0-34-28-34-28-34H49c-5 1-29 3-29 30v142c1 6 6 28 30 28h422c31 0 28-27 28-27zm-9 299-18-2a2 2 0 0 1-2-2l-8-19v-3l11-15c2-3 2-7-1-10l-20-20a8 8 0 0 0-5-2l-5 2-15 11-1 1h-1l-19-8a2 2 0 0 1-2-2l-2-17c0-3-1-6-5-8l-2-1h-29l-5 1c-2 2-5 5-5 8l-2 17-2 2-19 8h-1l-2-1c-5-3-9-8-15-11-1-1-2-2-5-2l-6 2-20 20c-3 3-3 7-1 10 3 5 8 9 11 15v3l-8 19-2 2-17 2c-3 0-7 2-8 6v34c2 3 5 5 8 6l17 2 2 2 8 19v3l-11 15c-2 3-2 7 1 10l20 20c2 2 3 2 6 2l5-2c5-3 9-8 15-11l2-1h1l19 8 2 2 2 18c0 5 3 7 8 7h29c5 0 7-2 8-7l2-18 2-2 19-8h1l1 1 15 11 5 2 6-2 20-20c3-3 3-7 1-10-3-5-8-9-11-15v-3l8-19 2-2 18-2c5 0 7-3 7-8v-28c0-7-2-9-7-10zm-111 68c-26 0-45-20-45-45s20-45 45-45 45 20 45 45c-1 24-21 45-45 45zM234 278c-1-16-15-18-19-18H38c-5 0-18 2-18 20v206c1 5 4 14 20 14h175c20 0 20-23 20-23v-24c0-10 2-21-4-31l-3-5-3-5c-6-9-5-20-5-31 0-10 0-21 5-30l7-12c4-6 4-14 4-21z',
      
      // Resource icons - SLDS patterns
      'StaticResource': 'M450 384c-2 27-5 56-10 84-1 8-10 17-18 18a1450 1450 0 0 1-321 0c-8-1-17-9-18-18a855 855 0 0 1 0-268c1-8 10-16 18-18 33-4 65-6 97-8 0 0 26-1 24-26-2-22-40-37-40-74 0-30 30-54 79-54 48 0 78 24 78 54 0 38-37 52-39 74-2 24 24 26 24 26 33 1 66 4 98 8 8 1 17 9 18 18 5 31 8 60 10 91 0 9-7 18-16 18h-9c-9 0-23-7-29-14 0 0-21-22-44-23-37-1-65 31-65 66s28 68 64 67c22-1 44-23 44-23 7-6 20-12 29-12h9c11 0 18 6 17 14z',
      
      // Lightning icons - SLDS patterns
      'LightningComponent': 'm476 376-16-2a2 2 0 0 1-2-2l-7-17v-3l10-13c2-3 2-6-1-9l-18-18-4-2-4 2-13 10-1 1h-1l-17-7a2 2 0 0 1-2-2l-2-15c0-3-1-5-4-7l-2-1h-26l-4 1c-2 2-4 4-4 7l-2 15-2 2-17 7h-1l-2-1-13-10-4-2-5 2-18 18c-3 3-3 6-1 9l10 13v3l-7 17-2 2-15 2c-3 0-6 2-7 5v30c2 3 4 4 7 5l15 2 2 2 7 17v3l-10 13c-2 3-2 6 1 9l18 18c2 2 3 2 5 2l4-2 13-10 2-1h1l17 7 2 2 2 16c0 4 3 6 7 6h25c4 0 6-2 7-6l2-16 2-2 17-7h1l1 1 13 10 4 2 5-2 18-18c3-3 3-6 1-9l-10-13v-3l7-17 2-2 16-2c4 0 6-3 6-7v-25c0-5-2-7-6-8zm-98 60s-1 0 0 0c-23 0-40-18-40-40s18-40 40-40a40 40 0 0 1 40 40c-1 22-19 40-40 40zm9-229c-2-8-8-13-16-13h-96c-12 0-6-10-6-10l5-11 65-129c8-12 0-24-14-24H146c-9 0-13 3-17 11L40 258l-1 5c-1 10 6 17 17 17h97c7 1 21 4 14 22l-36 92-34 84c-4 10 0 19 10 22 7 2 12-1 17-6l120-127 14-15c6-6 5-16 5-16 0-10 3-19 11-27l18-18c7-7 16-11 26-11 7 0 11-3 13-4l1-1 52-55c3-3 5-8 3-13z',
      
      // Picklist/Value icons - SLDS patterns
      'GlobalValueSet': 'M69 337H37c-9 0-16 7-16 16v32c0 9 7 16 16 16h33c9-1 15-8 14-16v-32c1-9-6-16-15-16zm96-219h316c9 0 16-7 16-16V70c0-9-7-16-16-16H165c-9 0-16 7-16 16v32c0 9 7 16 16 16zm0 142h316c9 0 16-7 16-16v-32c0-9-7-16-16-16H165c-9 0-16 7-16 16v32c0 8 7 16 16 16zM69 54H37c-9 0-16 7-16 16v32c0 9 7 16 16 16h33c9-1 15-8 14-16V69c1-8-6-15-15-15zm0 141H37c-9 0-16 7-16 16v32c0 9 7 16 16 16h33c9-1 15-8 14-16v-32c1-8-6-16-15-16zm140 202c0-18 6-36 17-50v-11h-61c-9 0-16 7-16 16v32c0 9 7 16 16 16h44v-3zm143-83c8-8 19-13 32-13 17 0 31 9 39 22 6-2 14-5 22-5 29 0 54 25 54 53 0 29-25 53-54 53l-10-1c-6 12-20 20-34 20-6 0-12-2-17-4a45 45 0 0 1-41 27c-20 0-36-12-42-29l-9 1a41 41 0 0 1-42-41 40 40 0 0 1 21-36c-2-6-4-12-4-19 0-26 22-48 48-48a50 50 0 0 1 37 20z',
      
      // Package icons - SLDS patterns
      'Installed Package': 'M444 230H319l-40 40h161v60H80v-60h81l-40-40H76c-20 0-36 16-36 36v194a30 30 0 0 0 30 30h380a30 30 0 0 0 30-30V266c0-20-16-36-36-36zm-238 28c8 8 20 8 28 0L424 68c4-4 4-10 0-14l-28-28a10 10 0 0 0-14 0L220 188l-67-67a10 10 0 0 0-14 0l-28 28a10 10 0 0 0 0 14l95 95z',
      
      // Security & Permission icons - SLDS patterns
      'PermissionSet': 'M477 91c-9-22-20-42-33-61-6-8-17-9-23-2a108 108 0 0 1-74 28c-30 0-57-12-77-32-6-6-16-6-22 0a110 110 0 0 1-151 4c-7-6-18-5-23 2a297 297 0 0 0-33 61s-24 49-20 130v8l1 12v1a285 285 0 0 0 238 258 286 286 0 0 0 238-259v-3l1-8c7-86-22-139-22-139zm-68 103L243 363c-4 4-9 4-13 0l-97-98c-4-4-4-9 0-13l13-13c4-4 9-4 13 0l73 74c2 2 6 2 9 0l143-144c4-4 9-4 13 0l13 13c3 3 3 9-1 12z',
      'Profile': 'M420 223c-28-11-32-22-32-33s8-22 18-30a74 74 0 0 0 26-58c0-44-29-82-80-82a76 76 0 0 0-79 71c0 4 2 7 5 9 38 24 61 66 61 117 0 38-15 72-42 96-2 2-2 6 0 8 7 5 23 12 33 17l8 2h121c23 0 41-19 41-40v-6c0-35-38-54-80-71zM286 362c-34-14-39-26-39-39s10-26 21-36c20-17 31-41 31-69 0-52-34-97-96-97-61 0-96 45-96 97 0 28 11 52 31 69 11 10 21 23 21 36s-5 26-40 39c-50 20-99 43-99 85v13a40 40 0 0 0 41 40h277c23 0 42-18 42-40v-14c0-41-44-64-94-84z',
      'User': 'M500 430v22c0 26-22 48-48 48H68a49 49 0 0 1-48-48v-22c0-58 68-94 132-122l6-3c5-2 10-2 15 1a155 155 0 0 0 172 0c5-3 10-3 15-1l6 3c66 28 134 63 134 122zM260 20c66 0 119 59 119 132s-53 132-119 132-119-59-119-132S194 20 260 20z',
      'Role': 'M383 272a114 114 0 1 0 114 114 115 115 0 0 0-114-114Zm20 124a24 24 0 0 1-9-2l-43 43a14 14 0 0 1-9 4 10 10 0 0 1-9-4 14 14 0 0 1 0-19l43-43a29 29 0 0 1-2-9 35 35 0 0 1 34-38 24 24 0 0 1 9 2c2 0 2 2 1 3l-20 19a3 3 0 0 0 0 5l13 13a4 4 0 0 0 6 0l19-19c1-1 4-1 4 1a37 37 0 0 1 2 9 36 36 0 0 1-39 35ZM252 498c22 0 10-15 10-15a154 154 0 0 1-34-97 150 150 0 0 1 14-64 8 8 0 0 1 2-3c7-14-7-15-7-15a121 121 0 0 0-19-1A197 197 0 0 0 24 471c0 10 3 28 34 28h191l3-1Z M217,20C283.29,20 346,82.71 346,149 C346,215.29 283.29,278 217,278 C150.71,278 88,215.29 88,149 C88,82.71 150.71,20 217,20 Z',
      
      // Automation icons - SLDS patterns
      'ValidationRule': 'm501 254-81-81a10 10 0 0 0-15 0l-15 15a10 10 0 0 0 0 15l25 25c4 4 1 12-5 12H189l132-131c4-4 12-1 12 5v36c0 6 4 10 10 10h21c6 0 10-4 10-10V34c0-6-4-10-10-10H250c-5 0-10 5-10 11v20c0 6 4 10 10 10h36c6 0 9 7 5 12L129 239H30c-6 0-10 5-10 11v21c0 6 6 11 11 11h100l161 161c4 4 1 12-5 12h-36c-6 0-10 4-10 10v20c0 5 4 10 10 11h114c6 0 10-4 10-10V371c0-6-4-10-10-10h-21c-6 0-10 4-10 10v36c0 6-7 9-12 5L190 282h221c6 0 9 8 5 12l-26 25a10 10 0 0 0 0 15l15 15a10 10 0 0 0 15 0l81-80c4-5 4-11 0-15z',
      'WorkflowRule': 'm468 324-37-31a195 195 0 0 0 0-68l37-31c12-10 16-28 8-42l-16-29a34 34 0 0 0-40-14l-45 17a173 173 0 0 0-58-34l-8-47c-3-16-17-25-33-25h-32c-16 0-30 9-33 25l-8 46c-22 7-41 19-59 34l-44-17-11-2c-12 0-23 6-29 16l-16 28c-8 14-5 32 8 42l37 31a195 195 0 0 0 0 68l-37 31a34 34 0 0 0-8 42l16 30a34 34 0 0 0 40 14l45-17c18 16 38 27 58 34l8 48a33 33 0 0 0 33 27h32c16 0 30-12 33-28l8-48c23-8 43-20 61-37l42 17 12 2c12 0 23-6 29-16l15-26c8-12 4-30-8-40zm-207 47a110 110 0 0 1-109-110 109 109 0 1 1 218 0 110 110 0 0 1-109 110zm29-191h-46c-7 0-13 4-15 10l-28 72c-2 5 2 11 8 11h47l-17 60c-2 6 5 9 9 5l71-83c5-5 1-13-6-13h-35l31-49c3-5-1-12-7-12h-12z',
      'Flow': 'M499 106c-21-41-74-117-172-72l-95 44-88 38c-25 12-79-5-110-16-9-3-17 6-13 15 21 41 74 117 172 72l183-81c25-12 79 5 110 16 9 2 17-7 13-16zM288 234l-55 26-44 19c-22 12-69-4-97-15-8-4-15 6-11 14 18 40 65 112 151 68 54-27 99-45 99-45 22-12 69 4 97 15 8 3 15-6 11-15-18-39-65-111-151-67zm-32 177-24 14c-17 11-52-3-73-13-6-3-11 6-8 14 13 36 48 101 113 61l24-14c18-9 52 3 73 13 6 3 11-6 8-14-13-36-46-98-113-61z',
      
      // Content & Label icons - SLDS patterns
      'CustomLabel': 'm420 264-95-94a34 34 0 0 0-25-11l-240-2a40 40 0 0 0-40 38l-1 190a39 39 0 0 0 38 37l239 2a30 30 0 0 0 24-10l97-96a40 40 0 0 0 1-55zm40 24a40 40 0 0 0 0-55l-93-95a33 33 0 0 0-24-11l-243-2-8 1a40 40 0 0 1 37-30l243 2c9 0 18 4 24 11l94 95a40 40 0 0 1 0 55',
      
      // Layout & Design icons - SLDS patterns
      'Layout': 'M500 60a40 40 0 0 0-40-40H60a40 40 0 0 0-40 40v277a40 40 0 0 0 40 40h400a40 40 0 0 0 40-40V60zm-60 242c0 8-7 15-15 15H95c-8 0-15-7-15-15V95c0-8 7-15 15-15h330c8 0 15 7 15 15v207zM190 440a40 40 0 0 0-40 40v5c0 8 7 15 15 15h190c8 0 15-7 15-15v-5a40 40 0 0 0-40-40H190zm-10-173h-41a10 10 0 0 1-10-10V140c0-6 4-10 10-10h41c5 0 10 4 10 10v117c0 6-5 10-10 10zm201 0H248c-6 0-10-4-10-10V140c0-6 4-10 10-10h133c5 0 10 4 10 10v117c0 6-5 10-10 10z',
      
      // Link & External icons - SLDS patterns
      'WebLink': 'm272 417-21-3-21-6c-4-1-9 0-12 3l-5 5a79 79 0 0 1-106 6 77 77 0 0 1-4-112l76-76c10-10 22-16 34-20a79 79 0 0 1 74 20l10 13c4 7 13 8 18 2l28-28c4-4 4-10 1-15l-14-16a128 128 0 0 0-71-37 143 143 0 0 0-124 37l-73 73a139 139 0 0 0-6 193 137 137 0 0 0 198 4l25-25c7-5 2-17-7-18zM456 58a139 139 0 0 0-193 6l-23 22c-7 7-2 19 7 20 14 1 28 4 42 8 4 1 9 0 12-3l5-5a79 79 0 0 1 106-6 77 77 0 0 1 4 112l-76 76a85 85 0 0 1-34 20 79 79 0 0 1-74-20l-10-13c-4-7-13-8-18-2l-28 28c-4 4-4 10-1 15l14 16a130 130 0 0 0 70 37 143 143 0 0 0 124-37l76-76a137 137 0 0 0-3-198z',
      
      // Additional metadata types with SLDS patterns
      'CustomTab': 'M316 20H204c-7 0-12 6-12 13v25c0 7 6 13 12 13h112c7 0 12-6 12-13V33c1-7-5-13-12-13zm171 0H375c-7 0-13 6-13 13v25c0 7 6 13 13 13h112c7-1 13-6 13-13V33c0-7-6-13-13-13zm0 84H170c-7 0-13-6-13-13V33c0-7-6-13-13-13H33c-7 0-13 6-13 13v455c0 6 6 12 13 12h454c7 0 13-6 13-13V117c0-7-6-13-13-13z',
      'CustomApplication': 'M494 122c-2-6-9-7-14-3l-81 81c-6 6-16 6-22 0l-57-57c-6-6-6-16 0-22l82-81c4-4 2-11-3-14a160 160 0 0 0-43-6 143 143 0 0 0-133 198L36 404a55 55 0 0 0 0 79c11 11 26 17 40 17s29-6 40-17l186-186a143 143 0 0 0 198-133c0-15-2-29-6-42z',
      'CustomPermission': 'M65 120a8 8 0 0 1 14 5v4a160 160 0 0 0 158 163h7a15 15 0 0 1 15 10l45 128a21 21 0 0 1-1 12l-24 55a8 8 0 0 1-10 4l-53-25a8 8 0 0 1-5-10l6-26a8 8 0 0 0-4-10l-18-8a9 9 0 0 1-4-10l7-25a8 8 0 0 0-4-11l-12-6a8 8 0 0 1-4-10l8-23a8 8 0 0 0-4-10l-24-12a8 8 0 0 1-4-4l-6-15a111 111 0 0 1-54-22 117 117 0 0 1-42-125 102 102 0 0 1 13-29zm56 25A113 113 0 0 1 238 20a114 114 0 0 1 100 76 106 106 0 0 1 2 65l127 133a14 14 0 0 1 5 12v58a8 8 0 0 1-8 8h-60a8 8 0 0 1-8-6l-4-26a8 8 0 0 0-8-8h-20a8 8 0 0 1-8-6l-4-26a8 8 0 0 0-8-8h-13a8 8 0 0 1-8-7l-3-25a8 8 0 0 0-8-8h-27a7 7 0 0 1-5-2l-11-12a112 112 0 0 1-149-93zm95-69a40 40 0 1 0 40 40 40 40 0 0 0-40-40z',
      'CustomSite': 'M115 170H35c-8 0-15 7-15 15v255a40 40 0 0 0 40 40h55c8 0 15-7 15-15V185c0-8-7-15-15-15zm370 0H185c-8 0-15 7-15 15v280c0 8 7 15 15 15h275a40 40 0 0 0 40-40V185c0-8-7-15-15-15zM460 40H60a40 40 0 0 0-40 40v35c0 8 7 15 15 15h450c8 0 15-7 15-15V80a40 40 0 0 0-40-40z',
      'FieldPermissions': 'M110 190h40c6 0 10-3 10-9v-1A100 100 0 0 1 267 80c53 4 93 50 93 104v-3c0 6 4 9 10 9h40c6 0 10-3 10-9v-1A160 160 0 0 0 252 20c-85 4-150 76-152 161 1 5 5 9 10 9zm-10-9v4zm360 89a40 40 0 0 0-40-40H100a40 40 0 0 0-40 40v190a40 40 0 0 0 40 40h320a40 40 0 0 0 40-40zM306 427c2 6-3 13-10 13h-73c-7 0-11-6-10-13l18-60a48 48 0 0 1-21-48 50 50 0 0 1 39-38c32-6 60 17 60 47 0 16-8 31-21 39z',
      'ObjectPermissions': 'M103 203.3h42c6.3 0 10.5-3 10.5-9.7v-1c0-61.4 51.3-112 112-107.7 55.5 4.3 97.4 54 97.4 112v-3c0 6.5 4 9.7 10.5 9.7h42c6.3 0 10.5-3 10.5-9.7v-1c0-98-79.6-176.7-176-172.4-89 4.3-157 82-159 173.5 1 5.4 5 9.7 10.5 9.7Zm-10.5-9.7Zm377 79.7c0-21.7-19-39.4-42-39.4h-335c-23 0-42 17.7-42 39.4v187.3c0 21.7 19 39.4 42 39.4h335c23 0 42-17.7 42-39.4V273.3ZM352 386h-74c-2.7 0-4.5 1.7-4.5 4v69.7c0 3.4-3 6.3-6.7 6.3h-13.5c-3.6 0-6.7-3-6.7-6.3V390c0-2.5-2-4-4.5-4h-74c-3.6 0-6.7-3-6.7-6.3V367c0-3.4 3-6.3 6.7-6.3h74c2.7 0 4.5-1.7 4.5-4V287c0-3.4 3-6.3 6.7-6.3h13.5c3.6 0 6.7 3 6.7 6.3v69.7c0 2.5 2 4 4.5 4h74c3.6 0 6.7 3 6.7 6.3v12.7c0 3.4-3 6.3-6.7 6.3Z',
      'TabDefinition': 'M485 40H215c-8 0-15 7-15 15v410c0 8 7 15 15 15h270c8 0 15-7 15-15V55c0-8-7-15-15-15zm-340 0H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15V55c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15z',
      'TabSet': 'M485 40H215c-8 0-15 7-15 15v410c0 8 7 15 15 15h270c8 0 15-7 15-15V55c0-8-7-15-15-15zm-340 0H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15V55c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15z',
      'TabSetMember': 'M485 40H215c-8 0-15 7-15 15v410c0 8 7 15 15 15h270c8 0 15-7 15-15V55c0-8-7-15-15-15zm-340 0H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15V55c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15zm0 120H35c-8 0-15 7-15 15v50c0 8 7 15 15 15h110c8 0 15-7 15-15v-50c0-8-7-15-15-15z',
      'LightningPage': 'm280 35-30 146c0 6 4 9 9 9h156c11 0 18 13 13 23L258 492c-7 14-28 9-28-7l30-172c0-6-5-4-11-4H85c-11 0-19-16-13-26L252 28c7-13 28-9 28 7z',
      'LightningComponentBundle': 'm476 376-16-2a2 2 0 0 1-2-2l-7-17v-3l10-13c2-3 2-6-1-9l-18-18-4-2-4 2-13 10-1 1h-1l-17-7a2 2 0 0 1-2-2l-2-15c0-3-1-5-4-7l-2-1h-26l-4 1c-2 2-4 4-4 7l-2 15-2 2-17 7h-1l-2-1-13-10-4-2-5 2-18 18c-3 3-3 6-1 9l10 13v3l-7 17-2 2-15 2c-3 0-6 2-7 5v30c2 3 4 4 7 5l15 2 2 2 7 17v3l-10 13c-2 3-2 6 1 9l18 18c2 2 3 2 5 2l4-2 13-10 2-1h1l17 7 2 2 2 16c0 4 3 6 7 6h25c4 0 6-2 7-6l2-16 2-2 17-7h1l1 1 13 10 4 2 5-2 18-18c3-3 3-6 1-9l-10-13v-3l7-17 2-2 16-2c4 0 6-3 6-7v-25c0-5-2-7-6-8zm-98 60s-1 0 0 0c-23 0-40-18-40-40s18-40 40-40a40 40 0 0 1 40 40c-1 22-19 40-40 40zm9-229c-2-8-8-13-16-13h-96c-12 0-6-10-6-10l5-11 65-129c8-12 0-24-14-24H146c-9 0-13 3-17 11L40 258l-1 5c-1 10 6 17 17 17h97c7 1 21 4 14 22l-36 92-34 84c-4 10 0 19 10 22 7 2 12-1 17-6l120-127 14-15c6-6 5-16 5-16 0-10 3-19 11-27l18-18c7-7 16-11 26-11 7 0 11-3 13-4l1-1 52-55c3-3 5-8 3-13z',
      'AuraDefinitionBundle': 'm476 376-16-2a2 2 0 0 1-2-2l-7-17v-3l10-13c2-3 2-6-1-9l-18-18-4-2-4 2-13 10-1 1h-1l-17-7a2 2 0 0 1-2-2l-2-15c0-3-1-5-4-7l-2-1h-26l-4 1c-2 2-4 4-4 7l-2 15-2 2-17 7h-1l-2-1-13-10-4-2-5 2-18 18c-3 3-3 6-1 9l10 13v3l-7 17-2 2-15 2c-3 0-6 2-7 5v30c2 3 4 4 7 5l15 2 2 2 7 17v3l-10 13c-2 3-2 6 1 9l18 18c2 2 3 2 5 2l4-2 13-10 2-1h1l17 7 2 2 2 16c0 4 3 6 7 6h25c4 0 6-2 7-6l2-16 2-2 17-7h1l1 1 13 10 4 2 5-2 18-18c3-3 3-6 1-9l-10-13v-3l7-17 2-2 16-2c4 0 6-3 6-7v-25c0-5-2-7-6-8zm-98 60s-1 0 0 0c-23 0-40-18-40-40s18-40 40-40a40 40 0 0 1 40 40c-1 22-19 40-40 40zm9-229c-2-8-8-13-16-13h-96c-12 0-6-10-6-10l5-11 65-129c8-12 0-24-14-24H146c-9 0-13 3-17 11L40 258l-1 5c-1 10 6 17 17 17h97c7 1 21 4 14 22l-36 92-34 84c-4 10 0 19 10 22 7 2 12-1 17-6l120-127 14-15c6-6 5-16 5-16 0-10 3-19 11-27l18-18c7-7 16-11 26-11 7 0 11-3 13-4l1-1 52-55c3-3 5-8 3-13z',
      'ContactPointTypeConsent': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointType': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointEmail': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointPhone': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointAddress': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointConsent': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointTypeConsentHistory': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointTypeConsentShare': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z',
      'ContactPointTypeConsentFeed': 'M452 91H68a48 48 0 0 0-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48ZM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 0 1-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33Zm187-56c0 9-7 16-16 16h-72a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24Zm0-88c0 9-7 16-16 16H300a16 16 0 0 1-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24Z'
    };
    
    // Default SLDS document icon for unknown metadata types
    const defaultPath = 'm349 272-69 34a105 105 0 0 0-47 47l-33 67c-5 10-19 10-24 0l-34-68a105 105 0 0 0-47-47l-68-34a13 13 0 0 1 0-24l68-34a105 105 0 0 0 47-47l34-68a13 13 0 0 1 24 0l34 68a105 105 0 0 0 47 47l68 34c10 5 10 19 0 24Zm148 150-30-14a45 45 0 0 1-20-20l-14-30a6 6 0 0 0-10 0l-15 30a45 45 0 0 1-20 20l-30 15c-3 2-3 8 0 10l30 15a45 45 0 0 1 20 20l15 29c2 4 8 4 10 0l14-30a45 45 0 0 1 20-20l30-14c4-2 4-8 0-10Zm0-335-30-15a45 45 0 0 1-20-20l-14-29a6 6 0 0 0-10 0l-15 30a45 45 0 0 1-20 20l-30 14c-3 2-3 8 0 10l30 15a45 45 0 0 1 20 20l15 29c2 4 8 4 10 0l15-30a45 45 0 0 1 20-20l29-14c4-2 4-8 0-10Z';
    
    const path = iconMap[type] || defaultPath;
    
    return h("svg", {
      viewBox: "0 0 520 520",
      width: "52",
      height: "52",
      fill: "currentColor",
      className: "dep-icon-inline"
    }, h("path", { d: path }));
  },
  
  /**
   * Gets the color for a metadata type
   * @param {string} type - The metadata type
   * @returns {string} The color hex code
   */
  getTypeColor(type) {
    return CONFIG.TYPE_COLORS[type] || '#666';
  },
  
  /**
   * Validates if a string is a valid Salesforce ID
   * @param {string} id - The ID to validate
   * @returns {boolean} True if valid Salesforce ID
   */
  isValidSalesforceId(id) {
    return id && /^[a-zA-Z0-9]{15,18}$/.test(id);
  },
  
  /**
   * Checks if a type is a custom field
   * @param {string} type - The metadata type
   * @returns {boolean} True if custom field
   */
  isCustomField(type) {
    return type && type.toUpperCase() === 'CUSTOMFIELD';
  },
  
  /**
   * Checks if a type is a custom object
   * @param {string} type - The metadata type
   * @returns {boolean} True if custom object
   */
  isCustomObject(type) {
    return type && type.toUpperCase() === 'CUSTOMOBJECT';
  },
  
  /**
   * Checks if an ID represents a standard Salesforce object
   * @param {string} id - The object ID or name
   * @returns {boolean} True if standard object
   */
  isStandardObject(id) {
    return CONFIG.STANDARD_OBJECTS.includes(id) || 
           (id && id.length <= 10) || 
           (id && !id.match(/^[A-Z][a-z]+$/));
  },

  /**
   * Creates a standardized error object
   * @param {string} message - Error message
   * @param {Error} [originalError] - Original error if wrapping
   * @returns {Error} The created error
   */
  createError(message, originalError = null) {
    const error = new Error(message);
    if (originalError) {
      error.originalError = originalError;
      error.stack = originalError.stack;
    }
    return error;
  },

  /**
   * Handles API errors with consistent formatting
   * @param {Error} error - The original error
   * @param {string} [context] - Context for the error
   * @returns {Error} Formatted error
   */
  handleApiError(error, context = '') {
    console.error(`API Error${context ? ` in ${context}` : ''}:`, error);
    const message = error.message || 'Unknown error occurred';
    return Helpers.createError(`Failed to fetch data${context ? ` for ${context}` : ''}: ${message}`, error);
  }
};



class Model {
  constructor(sfHost) {
    this.sfHost = sfHost;
    this.sfLink = "https://" + sfHost;
    this.spinnerCount = 0;
    this.title = "Dependencies Explorer";
    this.userInfo = "...";
    this.dependencyTree = null; // Store the fetched dependency tree
    this.dependencyError = null;
    this.selectedMetadataType = CONFIG.DEFAULT_METADATA_TYPE; // Default metadata type
    this.availableMetadataItems = []; // Available items for selected type
    this.selectedMetadataItem = null; // Selected item
    this.isLoadingMetadataItems = false; // Loading state for metadata items
    this.showJsonDebug = false; // Toggle for JSON debug view
    this.dependencyResults = { dependsOn: [], dependedOnBy: [] }; // Store both directions
    this.currentFilter = CONFIG.DEFAULT_FILTER; // 'dependsOn', 'dependedOnBy'
    this.expandedGroups = new Set(); // Track which groups are expanded
    this.lastAnalyzedItem = null;
    this._excludeExternalPackages = CONFIG.DEFAULT_EXCLUDE_EXTERNAL_PACKAGES; // Track whether to exclude external package items
    this._showFlatView = CONFIG.DEFAULT_SHOW_FLAT_VIEW; // Track whether to show flat or nested view
    this.includeManagedInPackageXml = false; // Track whether to include managed package items in package.xml
    sfConn.soap(sfConn.wsdl(apiVersion, "Partner"), "getUserInfo", {}).then(res => {
      this.userInfo = res.userFullName + " / " + res.userName + " / " + res.organizationName;
      // Load initial metadata items for ApexClass
      this._loadAvailableMetadataItems();
    }).catch(err => {
      console.error("Error getting user info:", err);
      this.userInfo = "Error loading user info";
      this._loadAvailableMetadataItems();
    });
  }

  /**
   * Notify React that we changed something, so it will rerender the view.
   * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
   * All event listeners (functions starting with "on") should call this function if they update the model.
   * Asynchronous operations should use the spinFor function, which will call this function after the asynchronous operation completes.
   * Other functions should not call this function, since they are called by a function that does.
   * @param cb A function to be called once React has processed the update.
   */
  didUpdate(cb) {
    if (this.reactCallback) {
      this.reactCallback(cb);
    }
  }

  /**
   * Show the spinner while waiting for a promise.
   * didUpdate() must be called after calling spinFor.
   * didUpdate() is called when the promise is resolved or rejected, so the caller doesn't have to call it, when it updates the model just before resolving the promise, for better performance.
   * @param promise The promise to wait for.
   */
  spinFor(promise) {
    this.spinnerCount++;
    promise
      .catch(err => {
        console.error("spinFor", err);
      })
      .then(() => {
        this.spinnerCount--;
        this.didUpdate();
      });
  }

  setMetadataType(type) {
    this.selectedMetadataType = type;
    this.selectedMetadataItem = null;
    this.availableMetadataItems = [];
    this._loadAvailableMetadataItems();
  }

  setMetadataItem(item) {
    this.selectedMetadataItem = item;
    this.didUpdate();
  }

  toggleJsonDebug() {
    this.showJsonDebug = !this.showJsonDebug;
    this.didUpdate();
  }

  setFilter(filter) {
    this.currentFilter = filter;
    // Auto-switch to flat view when "Referenced By" is selected
    if (filter === 'dependedOnBy' && !this._showFlatView) {
      this._showFlatView = true;
    }
    this.didUpdate();
  }

  getFilteredDependencies() {
    switch (this.currentFilter) {
      case 'dependsOn':
        return this.dependencyResults.dependsOn || [];
      case 'dependedOnBy':
        return this.dependencyResults.dependedOnBy || [];
      default:
        return this.dependencyTree || [];
    }
  }

  async _loadAvailableMetadataItems() {
    this.isLoadingMetadataItems = true;
    this.selectedMetadataItem = null; // Reset selection when loading
    this.didUpdate();
    
    try {
      let items = await this._fetchMetadataItems(this.selectedMetadataType);
      this.availableMetadataItems = items;
    } catch (error) {
      const handledError = Helpers.handleApiError(error, this.selectedMetadataType);
      this.dependencyError = handledError.message;
      this.availableMetadataItems = [];
    } finally {
      this.isLoadingMetadataItems = false;
      this.didUpdate();
    }
  }

  _buildMetadataQuery(metadataType) {
    const queries = {
      'ApexClass': `SELECT Id, Name, NamespacePrefix FROM ApexClass ORDER BY Name`,
      'ApexTrigger': `SELECT Id, Name, NamespacePrefix FROM ApexTrigger ORDER BY Name`,
      'CustomObject': `SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject ORDER BY DeveloperName`,
      'CustomField': `SELECT Id, DeveloperName, TableEnumOrId, NamespacePrefix FROM CustomField ORDER BY DeveloperName`,
      'ApexPage': `SELECT Id, Name, NamespacePrefix FROM ApexPage ORDER BY Name`,
      'ApexComponent': `SELECT Id, Name, NamespacePrefix FROM ApexComponent ORDER BY Name`,
      'StaticResource': `SELECT Id, Name, NamespacePrefix FROM StaticResource ORDER BY Name`,
      'LightningComponent': `SELECT Id, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle ORDER BY DeveloperName`,
      'ValidationRule': `SELECT Id, ValidationName, NamespacePrefix FROM ValidationRule ORDER BY ValidationName`,
      'CustomLabel': `SELECT Id, Name, NamespacePrefix FROM externalString ORDER BY Name`,
      'Flow': `SELECT Id, Definition.DeveloperName, VersionNumber, Status, ProcessType FROM Flow ORDER BY Definition.DeveloperName`,
      'LightningWebComponent': `SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName`,
      'EmailTemplate': `SELECT Id, Name, NamespacePrefix FROM EmailTemplate ORDER BY Name`,
      'WorkflowAlert': `SELECT Id, DeveloperName, EntityDefinition.DeveloperName, NamespacePrefix FROM WorkflowAlert ORDER BY DeveloperName`,
      'WebLink': `SELECT Id, Name, EntityDefinition.DeveloperName, NamespacePrefix FROM WebLink ORDER BY Name`,
      'Layout': `SELECT Id, Name, EntityDefinition.DeveloperName, NamespacePrefix FROM Layout ORDER BY Name`,
      'FlexiPage': `SELECT Id, DeveloperName, NamespacePrefix FROM FlexiPage ORDER BY DeveloperName`,
      'GlobalPicklist': `SELECT Id, DeveloperName, NamespacePrefix FROM GlobalValueSet ORDER BY DeveloperName`
    };
    
    return queries[metadataType] || '';
  }

  async _fetchMetadataItems(metadataType) {
    try {
      const soql = this._buildMetadataQuery(metadataType);
      if (!soql) return [];
      
      let res = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql));
      let records = res.records || [];
      
      // Apply special handling based on metadata type
    switch (metadataType) {
      case 'CustomField':
          return this._processCustomFieldRecords(records);
      case 'ValidationRule':
          return this._processValidationRuleRecords(records);
      case 'CustomLabel':
          return this._processCustomLabelRecords(records);
      case 'Flow':
          return this._processFlowRecords(records);
      case 'WorkflowAlert':
          return this._processWorkflowAlertRecords(records);
      case 'WebLink':
          return this._processWebLinkRecords(records);
      case 'Layout':
          return this._processLayoutRecords(records);
      default:
          return this._processStandardRecords(records, metadataType);
      }
    } catch (error) {
      throw Helpers.handleApiError(error, `metadata items for ${metadataType}`);
    }
  }

  _processStandardRecords(records, metadataType) {
    return records.map(rec => ({
      id: rec.Id,
      name: rec.Name || rec.DeveloperName || rec.FullName,
      namespace: rec.NamespacePrefix,
      fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.Name || rec.DeveloperName || rec.FullName}` : (rec.Name || rec.DeveloperName || rec.FullName),
      type: metadataType
    }));
  }

  async _processCustomFieldRecords(records) {
      // Only include values that are valid Salesforce IDs (15 or 18 chars, alphanumeric, not all letters)
      const idRegex = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;
      const objectIds = Array.from(new Set(records.map(r => r.TableEnumOrId)
        .filter(id => id && idRegex.test(id) && /[0-9]/.test(id))));
    
      let objectNamesById = {};
      if (objectIds.length) {
        // Fetch object names for these IDs
        let soqlObj = `SELECT Id, DeveloperName FROM CustomObject WHERE Id IN ('${objectIds.join("','")}')`;
        let objRes = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soqlObj));
        (objRes.records || []).forEach(obj => {
          objectNamesById[obj.Id] = obj.DeveloperName;
        });
      }
    
      return records.map(rec => {
        let objectName = rec.TableEnumOrId;
        // If TableEnumOrId is a valid ID and we have a name, use it
        if (objectName && idRegex.test(objectName) && /[0-9]/.test(objectName) && objectNamesById[objectName]) {
          objectName = objectNamesById[objectName];
        }
        return {
          id: rec.Id,
          name: rec.DeveloperName,
          namespace: rec.NamespacePrefix,
          fullName: objectName ? `${objectName}.${rec.DeveloperName}` : rec.DeveloperName,
        type: 'CustomField'
        };
      });
    }

  _processValidationRuleRecords(records) {
      return records.map(rec => ({
        id: rec.Id,
        name: rec.ValidationName,
        namespace: rec.NamespacePrefix,
        fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.ValidationName}` : rec.ValidationName,
      type: 'ValidationRule'
      }));
    }

  _processCustomLabelRecords(records) {
      return records.map(rec => ({
        id: rec.Id,
        name: rec.Name,
        namespace: rec.NamespacePrefix,
        fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.Name}` : rec.Name,
      type: 'CustomLabel'
      }));
    }

  _processFlowRecords(records) {
      return records.map(rec => {
        const flowName = rec.Definition?.DeveloperName || rec.Id;
        const flowType = rec.ProcessType === 'Workflow' ? 'Process Builder' : rec.ProcessType || 'Flow';
        const status = rec.Status || 'Unknown';
        const version = rec.VersionNumber || '';
        
        // Create display name with version, status, and type
        const displayName = `${flowName} (${flowType}, v${version}, ${status})`;
        
        return {
          id: rec.Id,
          name: displayName,
          namespace: null,
          fullName: displayName,
        type: 'Flow'
        };
      });
    }

  _processWorkflowAlertRecords(records) {
      return records.map(rec => {
        const objectName = rec.EntityDefinition?.DeveloperName || 'Unknown';
        const alertName = rec.DeveloperName || rec.Id; // Use DeveloperName if available, otherwise ID
        
        return {
          id: rec.Id,
          name: `${objectName}.${alertName}`,
          namespace: rec.NamespacePrefix,
          fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${objectName}.${alertName}` : `${objectName}.${alertName}`,
        type: 'WorkflowAlert'
        };
      });
    }

  _processWebLinkRecords(records) {
      return records.map(rec => {
        const objectName = rec.EntityDefinition?.DeveloperName || 'Unknown';
        const buttonName = rec.Name || rec.DeveloperName || rec.Id;
        
        return {
          id: rec.Id,
          name: `${objectName}.${buttonName}`,
          namespace: rec.NamespacePrefix,
          fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${objectName}.${buttonName}` : `${objectName}.${buttonName}`,
        type: 'WebLink'
        };
      });
    }

  _processLayoutRecords(records) {
      return records.map(rec => {
        const objectName = rec.EntityDefinition?.DeveloperName || 'Unknown';
        const layoutName = rec.Name || rec.DeveloperName || rec.Id;
        
        return {
          id: rec.Id,
          name: `${objectName}.${layoutName}`,
          namespace: rec.NamespacePrefix,
          fullName: rec.NamespacePrefix ? `${rec.NamespacePrefix}__${objectName}.${layoutName}` : `${objectName}.${layoutName}`,
        type: 'Layout'
        };
      });
  }

  /**
   * Fetch dependencies for a given metadata component (entryPoint).
   * For now, entryPoint is hardcoded for demo; later, make it user-selectable.
   */
  fetchDependencies() {
    if (!this.selectedMetadataItem) {
      this.dependencyError = 'Please select a metadata item first';
      this.didUpdate();
      return;
    }
    
    this.spinnerCount++;
    this.didUpdate();
    this.dependencyError = null;
    this.dependencyResults = { dependsOn: [], dependedOnBy: [] };
    this.currentFilter = 'dependedOnBy';
    this._showFlatView = CONFIG.DEFAULT_SHOW_FLAT_VIEW; // Reset view state
    this.expandedGroups.clear(); // Reset expanded groups
    this._dropdownOpen = false; // Reset dropdown state
    this._dropdownSearch = ''; // Reset dropdown search
    this.lastAnalyzedItem = this.selectedMetadataItem;
    
    const entryPoint = {
      id: this.selectedMetadataItem.id,
      name: this.selectedMetadataItem.fullName,
      type: this.selectedMetadataItem.type
    };
    
    // Fetch both directions in parallel
    Promise.all([
      this._getDependencies(entryPoint, 'dependsOn').then(async deps => {
        let enhanced = await this._enhanceCustomFieldData(deps);
        let unsupported = await this._createUnsupportedDependencies(enhanced);
        return [...enhanced, ...unsupported];
      }).catch(err => {
        console.warn('Error fetching "depends on" dependencies:', err);
        return [];
      }),
      this._getDependencies(entryPoint, 'dependedOnBy').then(async deps => {
        let enhanced = await this._enhanceCustomFieldData(deps);
        let unsupported = await this._createUnsupportedDependencies(enhanced);
        return [...enhanced, ...unsupported];
      }).catch(err => {
        console.warn('Error fetching "depended on by" dependencies:', err);
        return [];
      })
    ]).then(([dependsOn, dependedOnBy]) => {
      this.dependencyResults = { dependsOn, dependedOnBy };
      // Combine all results for display
      this.dependencyTree = [...dependsOn, ...dependedOnBy];
      // Auto-switch filter if Referenced By is empty and Depends On has results
      if (dependedOnBy.length === 0 && dependsOn.length > 0) {
        this.currentFilter = 'dependsOn';
      }
    }).catch(err => {
      this.dependencyError = err && err.message ? err.message : String(err);
    }).finally(() => {
      this.spinnerCount--;
      this.didUpdate();
    });
  }

  /**
   * Core logic: recursively fetch dependencies and build a tree.
   * This is a simplified port of sfdc-soup-master logic, using sfConn.rest for SOQL queries.
   */
  async _getDependencies(entryPoint, direction) {
    // Helper to run SOQL via Tooling API
    const runToolingQuery = async (soql) => {
      return sfConn.rest(
        `/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql)
      );
    };
    // Recursive query logic
    const result = [];
    const idsAlreadyQueried = new Set();
    const sfLink = this.sfLink; // capture for closure
    const self = this; // capture 'this' for the closure
    async function exec(ids) {
      const idsArr = Array.isArray(ids) ? ids : [ids];
      idsArr.forEach(id => idsAlreadyQueried.add(id));
      // Direction logic
      let idField = direction === 'dependsOn' ? 'MetadataComponentId' : 'RefMetadataComponentId';
      const soql = `SELECT MetadataComponentId, MetadataComponentName, MetadataComponentType, RefMetadataComponentName, RefMetadataComponentType, RefMetadataComponentId, RefMetadataComponentNamespace FROM MetadataComponentDependency WHERE ${idField} IN ('${idsArr.join("','")}') AND MetadataComponentType != 'FlexiPage' ORDER BY MetadataComponentName, RefMetadataComponentType`;
      const rawResults = await runToolingQuery(soql);
      const dependencies = rawResults.records.map(dep => {
        const dependency = {
          name: dep.RefMetadataComponentName,
          type: dep.RefMetadataComponentType,
          id: dep.RefMetadataComponentId,
          repeated: false,
          notes: null,
          namespace: dep.RefMetadataComponentNamespace,
          referencedBy: {
            name: dep.MetadataComponentName,
            id: dep.MetadataComponentId,
            type: dep.MetadataComponentType
          }
        };
        
        return dependency;
      });
      let nextLevelIds = [];
      dependencies.forEach(dep => {
        const alreadyQueried = idsAlreadyQueried.has(dep.id);
        result.push(dep);
        if (alreadyQueried) {
          dep.repeated = true;
        } else {
          nextLevelIds.push(dep.id);
        }
      });
      if (nextLevelIds.length) {
        await exec(nextLevelIds);
      }
    }
    await exec([entryPoint.id]);
    // Build a simple tree (for now, just return the flat list)
    return result;
  }

  // --- Enhancement logic ported from sfdc-soup-master ---

  async _enhanceCustomFieldData(dependencies) {
    // 1. Collect all CustomField IDs
    let customFieldIds = [];
    dependencies.forEach(dep => {
      if (this._isCustomField(dep.type)) customFieldIds.push(dep.id);
      if (this._isCustomField(dep.referencedBy.type)) customFieldIds.push(dep.referencedBy.id);
    });
    
    if (!customFieldIds.length) return dependencies;
    
    // 2. Get objectId for each fieldId
    let objectIdsByCustomFieldId = await this._getFieldToEntityMap(customFieldIds);
    
    // 3. Get objectName for each objectId
    let objectNamesById = await this._getObjectNamesById(Object.values(objectIdsByCustomFieldId));
    
    // 4. Update dependency names
    dependencies.forEach(dep => {
      if (this._isCustomField(dep.type)) {
        dep.name = this._getCorrectFieldName(dep.name, dep.id, objectIdsByCustomFieldId, objectNamesById);
      }
      if (this._isCustomObject(dep.type)) {
        let objectName = objectNamesById[dep.id];
        if (objectName) {
          dep.name = objectName;
        }
      }
      if (this._isCustomField(dep.referencedBy.type)) {
        dep.referencedBy.name = this._getCorrectFieldName(dep.referencedBy.name, dep.referencedBy.id, objectIdsByCustomFieldId, objectNamesById);
      }
      if (this._isCustomObject(dep.referencedBy.type)) {
        let objectName = objectNamesById[dep.referencedBy.id];
        if (objectName) {
          dep.referencedBy.name = objectName;
        }
      }
    });
    
    return dependencies;
  }

  async _createUnsupportedDependencies(dependencies) {
    // 1. Collect all custom field names and ids
    let customFieldsByName = {};
    dependencies.forEach(dep => {
      if (this._isCustomField(dep.type)) customFieldsByName[dep.name] = dep;
    });
    let customFieldNames = Object.keys(customFieldsByName);
    if (!customFieldNames.length) return [];
    // 2. Fetch field metadata for all custom fields
    let fieldRecords = await this._fetchCustomFieldMetadata(customFieldNames);
    // 3. Identify lookups, value sets, dependent picklists
    let lookupFields = fieldRecords.filter(rec => rec.referenceTo);
    let picklistsWithValueSet = fieldRecords.filter(rec => rec.valueSet && rec.valueSet.valueSetName);
    let dependentPicklists = fieldRecords.filter(rec => rec.valueSet && rec.valueSet.controllingField);
    let newDependencies = [];
    // 4. Add lookup field dependencies
    if (lookupFields.length) {
      let objectIdsByName = await this._getObjectIdsByName(lookupFields.map(lf => lf.referenceTo).filter(Boolean));
      for (let lf of lookupFields) {
        let fieldDep = customFieldsByName[lf.fullName];
        let relatedObjectName = lf.referenceTo;
        let relatedObjectId = objectIdsByName[relatedObjectName];
        if (relatedObjectName && relatedObjectId) {
          newDependencies.push({
            name: relatedObjectName,
            type: 'CustomObject',
            id: relatedObjectId,
            repeated: false,
            notes: null,
            namespace: null,
            referencedBy: {
              name: lf.fullName,
              type: 'CustomField',
              id: fieldDep ? fieldDep.id : null
            },
            pills: [{ label: 'Object in Lookup Field', type: 'standard', description: 'Dependency Type' }]
          });
        }
      }
    }
    // 5. Add value set dependencies
    for (let vs of picklistsWithValueSet) {
      let fieldDep = customFieldsByName[vs.fullName];
      newDependencies.push({
        name: vs.valueSet.valueSetName,
        type: 'GlobalValueSet',
        id: null,
        repeated: false,
        notes: null,
        namespace: null,
        referencedBy: {
          name: vs.fullName,
          type: 'CustomField',
          id: fieldDep ? fieldDep.id : null
        },
        pills: [{ label: 'Controlling Global Value Set', type: 'standard', description: 'Dependency Type' }]
      });
    }
    // 6. Add controlling picklist dependencies
    for (let dp of dependentPicklists) {
      let fieldDep = customFieldsByName[dp.fullName];
      let objectName = dp.fullName.split('.')[0];
      let controllingFieldName = `${objectName}.${dp.valueSet.controllingField}`;
      newDependencies.push({
        name: controllingFieldName,
        type: 'CustomField',
        id: null,
        repeated: false,
        notes: null,
        namespace: null,
        referencedBy: {
          name: dp.fullName,
          type: 'CustomField',
          id: fieldDep ? fieldDep.id : null
        },
        pills: [{ label: 'Controlling picklist', type: 'standard', description: 'Dependency Type' }]
      });
    }
    return newDependencies;
  }

  // --- Helper functions for metadata lookups ---

  _isCustomField(type) {
    return Helpers.isCustomField(type);
  }
  _isCustomObject(type) {
    return Helpers.isCustomObject(type);
  }
  async _getFieldToEntityMap(customFieldIds) {
    if (!customFieldIds.length) return {};
    // SOQL: SELECT Id, TableEnumOrId FROM CustomField WHERE Id IN (...)
    let soql = `SELECT Id, TableEnumOrId FROM CustomField WHERE Id IN ('${customFieldIds.join("','")}')`;
    let res = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql));
    let map = {};
    for (let rec of res.records) map[rec.Id] = rec.TableEnumOrId;
    return map;
  }
  async _getObjectNamesById(objectIds) {
    if (!objectIds.length) return {};
    
    // Filter out invalid IDs and get unique ones
    let validObjectIds = [...new Set(objectIds.filter(id => 
      id && 
      id.length >= 15 && 
      Helpers.isValidSalesforceId(id)
    ))];
    
    if (!validObjectIds.length) return {};
    
    // Use Tooling API to get object names by ID
    let soql = `SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject WHERE Id IN ('${validObjectIds.join("','")}')`;
    try {
      let res = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql));
      let map = {};
      for (let rec of res.records) {
        let name = rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.DeveloperName}` : rec.DeveloperName;
        map[rec.Id] = name;
      }
      return map;
    } catch (error) {
      console.warn('Error querying CustomObject metadata:', error);
      return {};
    }
  }
  async _getObjectIdsByName(objectNames) {
    if (!objectNames.length) return {};
    // SOQL: SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject WHERE (DeveloperName, NamespacePrefix) IN (...)
    // We'll need to split names with namespace and without
    let namesWithNs = objectNames.filter(n => n.includes("__"));
    let namesNoNs = objectNames.filter(n => !n.includes("__"));
    let clauses = [];
    if (namesNoNs.length) {
      clauses.push(`(NamespacePrefix = null AND DeveloperName IN ('${namesNoNs.join("','")}'))`);
    }
    if (namesWithNs.length) {
      // For names with namespace, split and match
      let nsClauses = namesWithNs.map(n => {
        let [ns, dev] = n.split("__");
        return `(NamespacePrefix = '${ns}' AND DeveloperName = '${dev}')`;
      });
      clauses.push(nsClauses.join(' OR '));
    }
    let where = clauses.length ? `WHERE ${clauses.join(' OR ')}` : '';
    let soql = `SELECT Id, DeveloperName, NamespacePrefix FROM CustomObject ${where}`;
    let res = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql));
    let map = {};
    for (let rec of res.records) {
      let name = rec.NamespacePrefix ? `${rec.NamespacePrefix}__${rec.DeveloperName}` : rec.DeveloperName;
      map[name] = rec.Id;
    }
    return map;
  }
  async _fetchCustomFieldMetadata(fieldNames) {
    if (!fieldNames.length) return [];
    // Filter to only include custom fields (those with __c suffix)
    let customFieldNames = fieldNames.filter(name => {
      let fieldName = name.includes('.') ? name.split('.')[1] : name;
      return fieldName.endsWith('__c');
    });
    if (!customFieldNames.length) return [];
    // SOQL: SELECT DeveloperName, ReferenceTo, ValueSet, TableEnumOrId FROM CustomField WHERE DeveloperName IN (...)
    // Note: We need to handle field names that might include the object prefix
    let fieldNamesOnly = customFieldNames.map(name => {
      // If name is "Object.Field", extract just the field part
      return name.includes('.') ? name.split('.')[1] : name;
    });
    let soql = `SELECT DeveloperName, ReferenceTo, ValueSet, TableEnumOrId FROM CustomField WHERE DeveloperName IN ('${fieldNamesOnly.join("','")}')`;
    try {
      let res = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=` + encodeURIComponent(soql));
      // Map back to include full name for processing
      let records = res.records || [];
      records.forEach(rec => {
        rec.fullName = rec.DeveloperName; // For compatibility with existing logic
      });
      return records;
    } catch (error) {
      console.warn('Error fetching CustomField metadata:', error);
      return [];
    }
  }
  _getCorrectFieldName(name, id, objectIdsByCustomFieldId, objectNamesById) {
    let entityId = objectIdsByCustomFieldId[id];
    let objectName = objectNamesById[entityId];
    
    // If we have a proper object name, use it
    if (objectName) {
      return `${objectName}.${name}`;
    }
    
    // If entityId exists but no object name, it might be a standard object
    // Standard objects have entityId as the actual object name (e.g., "Account")
    if (entityId && !objectName) {
      // Check if this looks like a standard object name
      if (entityId.length < 15 && !entityId.includes('__')) {
        return `${entityId}.${name}`;
      }
    }
    
    // Fallback to original name
    return name;
  }

  toggleGroup(groupKey) {
    if (this.expandedGroups.has(groupKey)) {
      this.expandedGroups.delete(groupKey);
    } else {
      this.expandedGroups.add(groupKey);
    }
    this.didUpdate();
  }

  toggleNested(key) {
    if (!this.expandedGroups) this.expandedGroups = new Set();
    if (this.expandedGroups.has(key)) {
      this.expandedGroups.delete(key);
    } else {
      this.expandedGroups.add(key);
    }
    this.didUpdate();
  }

  /**
   * Gets dependencies grouped for Dependency Tree view
   * Shows complete dependency tree with parent-child relationships
   * @returns {Array} Array of grouped dependencies with full relationship tree
   */
  getGroupedDependencies() {
    const dependencies = this.getFilteredDependencies();
    const groups = {};

    if (this.currentFilter === 'dependsOn') {
      // Build a map of dependencies by unique key (type+name)
      const depMap = new Map();
      dependencies.forEach(dep => {
        const key = `${dep.type}::${dep.name}`;
        dep.children = [];
        depMap.set(key, dep);
      });
      
      // Assign children to their parent if parent is in the result set
      dependencies.forEach(dep => {
        if (dep.referencedBy) {
          const parentKey = `${dep.referencedBy.type}::${dep.referencedBy.name}`;
          if (depMap.has(parentKey)) {
            depMap.get(parentKey).children.push(dep);
            dep._isNested = true;
          }
        }
      });
      
      // Note: We keep the simple parent-child relationships as they are
      // The UI handles deeper nesting through rendering logic, not data structure
      
      // Show dependencies tree, but mark nested ones for proper display
      dependencies.forEach(dep => {
        let groupKey = dep.type;
        let groupName = dep.type;
        // Special grouping for CustomField by object
        if (dep.type === 'CustomField' && dep.name.includes('.')) {
          const [objectName, fieldName] = dep.name.split('.');
          groupKey = `CustomField_${objectName}`;
          groupName = `Custom Fields on ${objectName}`;
        }
        // Special grouping for ApexClass by namespace
        if (dep.type === 'ApexClass' && dep.namespace) {
          groupKey = `ApexClass_${dep.namespace}`;
          groupName = `Apex Classes (${dep.namespace})`;
        }
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: dep.type,
            dependencies: [],
            count: 0,
            groupKey: groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });
    } else {
      dependencies.forEach(dep => {
        let groupKey, groupName, groupType;
        groupType = dep.referencedBy.type;
        groupKey = `referencedBy_${groupType}`;
        groupName = `${groupType}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: groupType,
            dependencies: [],
            count: 0,
            groupKey: groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });
    }

    return Object.values(groups).sort((a, b) => {
      // Sort by count (descending), then by name
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  getTreeGroupedDependencies() {
    const dependencies = this.getFilteredDependencies();
    
    if (this.currentFilter === 'dependsOn') {
      // Build a map of dependencies by unique key (type+name)
      const depMap = new Map();
      dependencies.forEach(dep => {
        const key = `${dep.type}::${dep.name}`;
        dep.children = [];
        depMap.set(key, dep);
      });
      
      // Assign children to their parent if parent is in the result set
      dependencies.forEach(dep => {
        if (dep.referencedBy) {
          const parentKey = `${dep.referencedBy.type}::${dep.referencedBy.name}`;
          if (depMap.has(parentKey)) {
            depMap.get(parentKey).children.push(dep);
            dep._isNested = true;
          }
        }
      });
      
      // Group dependencies by type, but maintain parent-child relationships
      const groups = {};
      dependencies.forEach(dep => {
        let groupKey = dep.type;
        let groupName = dep.type;
        // Special grouping for CustomField by object
        if (dep.type === 'CustomField' && dep.name.includes('.')) {
          const [objectName, fieldName] = dep.name.split('.');
          groupKey = `CustomField_${objectName}`;
          groupName = `Custom Fields on ${objectName}`;
        }
        // Special grouping for ApexClass by namespace
        if (dep.type === 'ApexClass' && dep.namespace) {
          groupKey = `ApexClass_${dep.namespace}`;
          groupName = `Apex Classes (${dep.namespace})`;
        }
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: dep.type,
            dependencies: [],
            count: 0,
            groupKey: groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });
      
      return Object.values(groups).sort((a, b) => {
        // Sort by count (descending), then by name
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    } else {
      // For "Referenced By" view, group by type
      const groups = {};
      dependencies.forEach(dep => {
        let groupKey, groupName, groupType;
        groupType = dep.referencedBy.type;
        groupKey = `referencedBy_${groupType}`;
        groupName = `${groupType}`;
        if (!groups[groupKey]) {
          groups[groupKey] = {
            name: groupName,
            type: groupType,
            dependencies: [],
            count: 0,
            groupKey: groupKey
          };
        }
        groups[groupKey].dependencies.push(dep);
        groups[groupKey].count++;
      });
      
      return Object.values(groups).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    }
  }

  getGroupedChildren(deps, parentKeyPrefix = '') {
    const groups = {};
    deps.forEach(dep => {
      let groupKey = dep.type;
      let groupName = dep.type;
      if (dep.type === 'CustomField' && dep.name.includes('.')) {
        const [objectName] = dep.name.split('.');
        groupKey = `CustomField_${objectName}`;
        groupName = `Custom Fields on ${objectName}`;
      }
      if (dep.type === 'ApexClass' && dep.namespace) {
        groupKey = `ApexClass_${dep.namespace}`;
        groupName = `Apex Classes (${dep.namespace})`;
      }
      const fullKey = parentKeyPrefix + groupKey;
      if (!groups[fullKey]) {
        groups[fullKey] = {
          name: groupName,
          type: dep.type,
          dependencies: [],
          count: 0,
          groupKey: fullKey
        };
      }
      groups[fullKey].dependencies.push(dep);
      groups[fullKey].count++;
    });
    return Object.values(groups).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  filterDropdownItems(searchTerm) {
    return PerformanceUtils.memoize('filterDropdownItems', () => {
    let items = this.availableMetadataItems;
    
    // Filter out external package items if the option is enabled
    if (this._excludeExternalPackages) {
      items = items.filter(item => {
        const fullName = item.fullName || item.name || '';
        return !fullName.includes('__');
      });
    }
    
    if (!searchTerm) return items;
    
    const lower = searchTerm.toLowerCase();
    return items.filter(item =>
      (item.fullName || item.name).toLowerCase().includes(lower)
    );
    }, [searchTerm, this._excludeExternalPackages, this.availableMetadataItems.length]);
  }

  // For custom dropdown state
  _dropdownOpen = false;
  _dropdownSearch = '';
  _dropdownAnchor = null;
  _excludeExternalPackages = CONFIG.DEFAULT_EXCLUDE_EXTERNAL_PACKAGES; // Track whether to exclude external package items
  _showFlatView = CONFIG.DEFAULT_SHOW_FLAT_VIEW; // Track whether to show flat or nested view
  openDropdown() {
    this._dropdownOpen = true;
    this._dropdownSearch = '';
    this.didUpdate();
  }
  closeDropdown() {
    this._dropdownOpen = false;
    this.didUpdate();
  }
  toggleDropdown() {
    if (this._dropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }
  setDropdownSearch(val) {
    this._dropdownSearch = val;
    this.didUpdate();
  }
  setDropdownAnchor(ref) {
    this._dropdownAnchor = ref;
  }
 
  toggleExcludeExternalPackages() {
    this._excludeExternalPackages = !this._excludeExternalPackages;
    this.didUpdate();
  }

  /**
    * Switches between Quick Summary view and Dependency Tree view
    * - Quick Summary: Shows deduplicated list of distinct metadata items
    * - Dependency Tree: Shows complete dependency tree with parent-child relationships
   */
  toggleFlatView() {
    this._showFlatView = !this._showFlatView;
    this.didUpdate();
  }

  exportDependencies() {
    // Check if we're currently loading
    if (this.spinnerCount > 0) {
      alert('Please wait for the dependency analysis to complete before exporting.');
      return;
    }
    
    // Check if we have any dependencies to export
    if (!this.dependencyResults || (!this.dependencyResults.dependsOn.length && !this.dependencyResults.dependedOnBy.length)) {
      alert('No dependencies to export. Please analyze dependencies first.');
      return;
    }
    
    // Check if we have a selected item
    if (!this.selectedMetadataItem) {
      alert('Please select a metadata item to analyze before exporting dependencies.');
      return;
    }
    
    // Get the dependencies that are actually displayed in the UI
    let exportDependencies = [];
    const directionLabel = this.currentFilter === 'dependsOn' ? 'Depends On' : 'Referenced By';
    const viewMode = 'Quick Summary'; // Always export Quick Summary format
    
    // Always export Quick Summary (flat view) regardless of current view mode
    if (this.currentFilter === 'dependsOn') {
      // For Depends On, use flat view logic - unique dependencies only
      const flatGroups = this.getFlatGroupedDependencies();
      flatGroups.forEach(group => {
        group.dependencies.forEach(dep => {
          exportDependencies.push({
            name: dep.name,
            type: dep.type,
            id: dep.id,
            repeated: dep.repeated,
            notes: dep.notes,
            namespace: dep.namespace,
            pills: dep.pills,
            referencedBy: dep.referencedBy,
            level: 0,
            parent: null,
            isUnique: true
          });
        });
      });
    } else {
      // For Referenced By, use the filtered dependencies directly
      const filteredDeps = this.getFilteredDependencies();
      exportDependencies = filteredDeps.map(dep => ({
        name: dep.name,
        type: dep.type,
        id: dep.id,
        repeated: dep.repeated,
        notes: dep.notes,
        namespace: dep.namespace,
        pills: dep.pills,
        referencedBy: dep.referencedBy,
        level: 0,
        parent: null,
        isUnique: !dep.repeated
      }));
    }
    
    // Sort by type, then by name
    exportDependencies.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.name.localeCompare(b.name);
    });
    
    // Calculate summary statistics
    const totalItems = exportDependencies.length;
    const uniqueItems = exportDependencies.filter(dep => dep.isUnique).length;
    const repeatedItems = totalItems - uniqueItems;
    const typeBreakdown = {};
    exportDependencies.forEach(dep => {
      typeBreakdown[dep.type] = (typeBreakdown[dep.type] || 0) + 1;
    });
    
    // Generate the export text with improved formatting
    const exportText = `Salesforce Dependencies Export
================================================================================
Generated: ${new Date().toISOString()}
Salesforce Instance: ${this.sfHost}
Root Item: ${this.selectedMetadataItem.fullName}
Root Item Type: ${this.selectedMetadataType}
Analysis Direction: ${directionLabel}
View Mode: ${viewMode}

EXECUTIVE SUMMARY:
================================================================================
- Total Dependencies Found: ${totalItems}
- Unique Dependencies: ${uniqueItems}
- Repeated Dependencies: ${repeatedItems}
- Dependency Types: ${Object.keys(typeBreakdown).length}

Type Breakdown:
${Object.entries(typeBreakdown)
  .sort(([,a], [,b]) => b - a)
  .map(([type, count]) => `  • ${type}: ${count} items`)
  .join('\n')}

DETAILED DEPENDENCIES:
================================================================================
${(() => {
  // Group dependencies by type first, then by unique items
  const groupedByType = {};
  
  exportDependencies.forEach(dep => {
    const type = dep.type || 'Unknown';
    const key = `${dep.type}::${dep.name}`;
    
    if (!groupedByType[type]) {
      groupedByType[type] = {};
    }
    
    if (!groupedByType[type][key]) {
      groupedByType[type][key] = {
        item: dep,
        references: [],
        instances: []
      };
    }
    
    // Add this instance
    groupedByType[type][key].instances.push(dep);
    
    // Add referenced by information if it exists
    if (dep.referencedBy) {
      const refKey = `${dep.referencedBy.type}::${dep.referencedBy.name}`;
      const existingRef = groupedByType[type][key].references.find(r => 
        `${r.type}::${r.name}` === refKey
      );
      if (!existingRef) {
        groupedByType[type][key].references.push(dep.referencedBy);
      }
    }
  });
  
  // Convert to array and sort by type, then by name
  const typeEntries = Object.entries(groupedByType).sort(([typeA], [typeB]) => {
    return typeA.localeCompare(typeB);
  });
  
  return typeEntries.map(([type, items]) => {
    // Get type icon - using enhanced mapping based on helper function
    const getTypeIcon = (type) => {
      const icons = {
        // Code-related icons
        'ApexClass': '⚡',
        'ApexTrigger': '🔔',
        'ApexPage': '📄',
        'ApexComponent': '🧩',
        'LightningComponent': '⚡',
        'LightningWebComponent': '⚡',
        'AuraDefinitionBundle': '⚡',
        'LightningComponentBundle': '⚡',
        
        // Data/Object icons
        'CustomObject': '📋',
        'CustomField': '📝',
        
        // UI/Page icons
        'FlexiPage': '📱',
        'Layout': '📐',
        
        // Resource icons
        'StaticResource': '📦',
        'Installed Package': '📦',
        
        // Picklist/Value icons
        'GlobalValueSet': '🎯',
        'GlobalPicklist': '🎯',
        
        // Security & Permission icons
        'PermissionSet': '🔒',
        'Profile': '👤',
        'User': '👤',
        'Role': '👥',
        
        // Automation icons
        'ValidationRule': '✅',
        'WorkflowRule': '⚙️',
        'WorkflowAlert': '📢',
        'Flow': '🔄',
        
        // Content & Label icons
        'CustomLabel': '🏷️',
        
        // Link & External icons
        'WebLink': '🔗',
        
        // Additional metadata types
        'CustomTab': '📑',
        'CustomApplication': '📱',
        'CustomPermission': '🔐',
        'CustomSite': '🌐',
        'FieldPermissions': '🔒',
        'ObjectPermissions': '🔒',
        'TabDefinition': '📑',
        'TabSet': '📑',
        'TabSetMember': '📑',
        'LightningPage': '📄',
        'ContactPointTypeConsent': '📞',
        'ContactPointType': '📞',
        'ContactPointEmail': '📧',
        'ContactPointPhone': '📞',
        'ContactPointAddress': '📍',
        'ContactPointConsent': '📞',
        'ContactPointTypeConsentHistory': '📞',
        'ContactPointTypeConsentShare': '📞',
        'ContactPointTypeConsentFeed': '📞'
      };
      return icons[type] || '📄';
    };
    
    const icon = getTypeIcon(type);
    const itemCount = Object.keys(items).length;
    let result = `${icon} ${type} (${itemCount} unique items):`;
    
    // Sort items within this type by name
    const sortedItems = Object.values(items).sort((a, b) => {
      return a.item.name.localeCompare(b.item.name);
    });
    
    // Add each item under this type
    sortedItems.forEach((group, index) => {
      const dep = group.item;
      const name = (dep.name || '').trim();
      const id = dep.id ? ` (ID: ${dep.id})` : ' (No ID)';
      const namespace = dep.namespace ? ` (Namespace: ${dep.namespace})` : '';
      const notes = dep.notes ? ` (Notes: ${dep.notes})` : '';
      const pills = dep.pills && dep.pills.length > 0 ? ` (${dep.pills.map(p => p.label || p.text).join(', ')})` : '';
      
      const isLast = index === sortedItems.length - 1;
      const level = dep.level || 0;
      
      // Simple list structure for Quick Summary export
      const treePrefix = isLast ? '└─ ' : '├─ ';
      
      // Add instance count if there are multiple instances
      const instanceCount = group.instances.length > 1 ? ` [${group.instances.length} instances]` : '';
      
      result += `\n${treePrefix}${name}${id}${namespace}${notes}${pills}${instanceCount}`;
      
      // Add referenced by information (simplified for Quick Summary)
      if (this.currentFilter === 'dependedOnBy') {
        if (group.references.length > 0) {
          if (group.references.length === 1) {
            const ref = group.references[0];
            const refIcon = getTypeIcon(ref.type);
            const refId = ref.id ? ` (ID: ${ref.id})` : ' (No ID)';
            result += `\n   └─ 🔗 Referenced by: ${refIcon} ${ref.type} "${ref.name}"${refId}`;
          } else {
            result += `\n   └─ 🔗 Referenced by:`;
            group.references.forEach((ref, refIndex) => {
              const isRefLast = refIndex === group.references.length - 1;
              const refPrefix = isRefLast ? '      └─ ' : '      ├─ ';
              const refIcon = getTypeIcon(ref.type);
              const refId = ref.id ? ` (ID: ${ref.id})` : ' (No ID)';
              result += `\n   ${refPrefix}${refIcon} ${ref.type} "${ref.name}"${refId}`;
            });
          }
        } else {
          result += `\n   └─ 📋 No references`;
        }
      }
    });
    
    return result;
  }).join('\n\n');
})()}

`;
    
    // Create and download the file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dependencies_${this.selectedMetadataItem.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_${directionLabel.replace(/\s+/g, '_')}_${viewMode.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getDependsOnCount() {
    if (!this.dependencyResults || !this.dependencyResults.dependsOn) {
      return 0;
    }
    
    if (this._showFlatView) {
      // For flat view, count unique dependencies
      const dependencies = this.dependencyResults.dependsOn || [];
      const uniqueDeps = new Set();
      dependencies.forEach(dep => {
        const depKey = `${dep.type}::${dep.name}`;
        uniqueDeps.add(depKey);
      });
      return uniqueDeps.size;
    } else {
      // For nested view, count all dependencies including repeated ones
      return this.dependencyResults.dependsOn.length;
    }
  }

  getReferencedByCount() {
    if (!this.dependencyResults || !this.dependencyResults.dependedOnBy) {
      return 0;
    }
    // Referenced By always shows tree count since it doesn't have flat view
    return this.dependencyResults.dependedOnBy.length;
  }

  /**
   * Gets the total count of unique dependencies across both directions
   * @returns {number} Total unique dependencies
   */
  getTotalUniqueCount() {
    if (!this.dependencyResults) {
      return 0;
    }
    
    const allDeps = [...(this.dependencyResults.dependsOn || []), ...(this.dependencyResults.dependedOnBy || [])];
    const uniqueDeps = new Set();
    
    allDeps.forEach(dep => {
      const depKey = `${dep.type}::${dep.name}`;
      uniqueDeps.add(depKey);
    });
    
    return uniqueDeps.size;
  }

  /**
   * Gets the total count of all dependencies (including repeated ones)
   * @returns {number} Total dependencies including repeated
   */
  getTotalCount() {
    if (!this.dependencyResults) {
      return 0;
    }
    
    const dependsOnCount = this.dependencyResults.dependsOn ? this.dependencyResults.dependsOn.length : 0;
    const referencedByCount = this.dependencyResults.dependedOnBy ? this.dependencyResults.dependedOnBy.length : 0;
    
    return dependsOnCount + referencedByCount;
  }

  /**
   * Generates a valid package.xml file from the current dependencies
   * @returns {string} The package.xml content
   */
  generatePackageXml() {
    if (!this.dependencyResults || !this.selectedMetadataItem) {
      return '';
    }

    // Get the filtered dependencies
    const dependencies = this.getFilteredDependencies();
    
    // Filter out installed packages and dynamic references
    let filteredDeps = dependencies.filter(dep => {
      // Remove installed packages (cannot be retrieved via metadata API)
      if (dep.type === 'Installed Package') return false;
      
      // For "dependsOn" filter, remove dynamic references
      if (this.currentFilter === 'dependsOn' && this._isDynamicReference(dep)) return false;
      
      return true;
    });

    // Fix lookup filter type for metadata retrieval
    filteredDeps.forEach(dep => {
      if (dep.type.toUpperCase() === 'LOOKUPFILTER') {
        dep.type = 'CustomField';
      }
    });

    // Add the root item
    filteredDeps.push(this.selectedMetadataItem);

    // Filter out managed package items if not included
    if (!this.includeManagedInPackageXml) {
      filteredDeps = filteredDeps.filter(dep => !dep.namespace);
    }

    // Group by metadata type
    const metadataByType = new Map();
    
    filteredDeps.forEach(dep => {
      if (metadataByType.has(dep.type)) {
        metadataByType.get(dep.type).add(dep.name);
      } else {
        metadataByType.set(dep.type, new Set());
        metadataByType.get(dep.type).add(dep.name);
      }
    });

    // Generate the package.xml
    let packageXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    packageXml += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';

    // Sort types alphabetically
    const sortedTypes = Array.from(metadataByType.entries()).sort(([typeA], [typeB]) => {
      return typeA.localeCompare(typeB);
    });

    sortedTypes.forEach(([type, members]) => {
      if (members.size > 0) {
        packageXml += '    <types>\n';
        
        // Sort members alphabetically
        const sortedMembers = Array.from(members).sort();
        sortedMembers.forEach(member => {
          packageXml += `        <members>${member}</members>\n`;
        });
        
        packageXml += `        <name>${type}</name>\n`;
        packageXml += '    </types>\n';
      }
    });

    packageXml += `    <version>${apiVersion}</version>\n`;
    packageXml += '</Package>';

    return packageXml;
  }

  /**
   * Downloads the generated package.xml file
   */
  downloadPackageXml() {
    const packageXml = this.generatePackageXml();
    if (!packageXml) {
      console.error('No package.xml content to download');
      return;
    }

    const blob = new Blob([packageXml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `package_${this.selectedMetadataItem.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_${this.currentFilter}_${new Date().toISOString().split('T')[0]}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper method to check if a dependency is a dynamic reference
   * @param {Object} dep - The dependency object
   * @returns {boolean} True if it's a dynamic reference
   */
  _isDynamicReference(dep) {
    // Dynamic references are typically those that don't have a specific ID
    // or are references to external systems
    return !dep.id || dep.type === 'ExternalReference' || dep.type === 'DynamicReference';
  }

  _buildSalesforceUrl(targetType, targetId, dep) {
    const baseUrl = `https://${this.sfHost}`;
    
    const urlTemplates = {
      'ApexClass': `${baseUrl}/lightning/setup/ApexClasses/page?address=%2F${targetId}`,
      'ApexTrigger': `${baseUrl}/lightning/setup/ApexTriggers/page?address=%2F${targetId}`,
      'CustomObject': `${baseUrl}/lightning/setup/ObjectManager/${targetId}/Details/view`,
      'CustomField': this._buildCustomFieldUrl(baseUrl, targetId, dep),
      'ApexPage': `${baseUrl}/lightning/setup/VisualforcePages/page?address=%2F${targetId}`,
      'ApexComponent': `${baseUrl}/lightning/setup/VisualforceComponents/page?address=%2F${targetId}`,
      'StaticResource': `${baseUrl}/lightning/setup/StaticResources/page?address=%2F${targetId}`,
      'LightningComponent': `${baseUrl}/lightning/setup/LightningComponents/page?address=%2F${targetId}`,
      'ValidationRule': `${baseUrl}/lightning/setup/ObjectManager/${targetId}/ValidationRules/view`,
      'CustomLabel': `${baseUrl}/lightning/setup/CustomLabels/page?address=%2F${targetId}`,
      'Flow': `${baseUrl}/lightning/setup/Flows/page?address=%2F${targetId}`,
      'LightningWebComponent': `${baseUrl}/lightning/setup/LightningWebComponents/page?address=%2F${targetId}`,
      'EmailTemplate': `${baseUrl}/lightning/setup/EmailTemplates/page?address=%2F${targetId}`,
      'WorkflowAlert': `${baseUrl}/lightning/setup/WorkflowAlerts/page?address=%2F${targetId}`,
      'WebLink': `${baseUrl}/lightning/setup/ObjectManager/${targetId}/ButtonsLinksAndActions/view`,
      'Layout': `${baseUrl}/lightning/setup/ObjectManager/${targetId}/PageLayouts/view`,
      'FlexiPage': `${baseUrl}/lightning/setup/FlexiPages/page?address=%2F${targetId}`,
      'GlobalPicklist': `${baseUrl}/lightning/setup/GlobalPicklists/page?address=%2F${targetId}`
    };
    
    return urlTemplates[targetType] || null;
  }
  
  _buildCustomFieldUrl(baseUrl, targetId, dep) {
    // For custom fields, we need to get the object ID first
    if (dep.name && dep.name.includes('.')) {
      const [objectName, fieldName] = dep.name.split('.');
      return `${baseUrl}/lightning/setup/ObjectManager/${objectName}/FieldsAndRelationships/${targetId}/view`;
    }
    return `${baseUrl}/lightning/setup/ObjectManager/${targetId}/FieldsAndRelationships/view`;
  }

  generateSalesforceUrl(dep) {
    // For Depends On: use dep.id (the dependency item)
    // For Referenced By: use dep.referencedBy.id (the item that references this)
    let targetId, targetType;
    
    if (this.currentFilter === 'dependedOnBy') {
      // Referenced By: link to the item that references this
      targetId = dep.referencedBy ? dep.referencedBy.id : dep.id;
      targetType = dep.referencedBy ? dep.referencedBy.type : dep.type;
    } else {
      // Depends On: link to the dependency item itself
      targetId = dep.id;
      targetType = dep.type;
    }
    
    return this._buildSalesforceUrl(targetType, targetId, dep);
  }

  /**
   * Gets dependencies grouped for Quick Summary view
   * Shows deduplicated list of distinct metadata items, grouped by type
   * @returns {Array} Array of grouped dependencies with unique items only
   */
  getFlatGroupedDependencies() {
    const dependencies = this.getFilteredDependencies();
    const groups = {};
    
    // Create a Set to track unique dependencies (type + name)
    const uniqueDeps = new Set();
    
    dependencies.forEach(dep => {
      const depKey = `${dep.type}::${dep.name}`;
      if (uniqueDeps.has(depKey)) return; // Skip duplicates
      uniqueDeps.add(depKey);
      
      let groupKey = dep.type;
      let groupName = dep.type;
      
      // Special grouping for CustomField by object
      if (dep.type === 'CustomField' && dep.name.includes('.')) {
        const [objectName, fieldName] = dep.name.split('.');
        groupKey = `CustomField_${objectName}`;
        groupName = `Custom Fields on ${objectName}`;
      }
      
      // Special grouping for ApexClass by namespace
      if (dep.type === 'ApexClass' && dep.namespace) {
        groupKey = `ApexClass_${dep.namespace}`;
        groupName = `Apex Classes (${dep.namespace})`;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          name: groupName,
          type: dep.type,
          dependencies: [],
          count: 0,
          groupKey: groupKey
        };
      }
      
      groups[groupKey].dependencies.push(dep);
      groups[groupKey].count++;
    });
    
    return Object.values(groups).sort((a, b) => {
      // Sort by count (descending), then by name
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  getJsonDebugData() {
    try {
      // Get the raw filtered dependencies
      const dependencies = this.getFilteredDependencies();
      
      // Create a completely safe, flat structure for JSON debug
      const safeData = {
        currentFilter: this.currentFilter,
        showFlatView: this._showFlatView,
        totalDependencies: dependencies.length,
        dependencies: dependencies.map(dep => ({
          name: dep.name,
          type: dep.type,
          id: dep.id,
          repeated: dep.repeated,
          notes: dep.notes,
          namespace: dep.namespace,
          pills: dep.pills,
          referencedBy: dep.referencedBy ? {
            name: dep.referencedBy.name,
            type: dep.referencedBy.type,
            id: dep.referencedBy.id
          } : null
        }))
      };
      
      return safeData;
    } catch (error) {
      // Fallback to a safe structure if there's any error
      console.warn('Error in getJsonDebugData:', error);
      return {
        error: 'Failed to generate debug data',
        message: error.message,
        currentFilter: this.currentFilter,
        showFlatView: this._showFlatView
      };
    }
  }
}

class App extends React.Component {

  render() {
    let {model} = this.props;
    document.title = model.title;
    
    const metadataTypes = CONFIG.METADATA_TYPES;

    // Search state for dropdown
    const filteredItems = model.filterDropdownItems(model._dropdownSearch);
    const selectedItem = model.selectedMetadataItem;

    // Custom dropdown for item picker
    const dropdownRef = el => {
      if (el) model.setDropdownAnchor(el);
    };
    const handleDropdownBlur = e => {
      // Close dropdown if focus leaves the dropdown panel
      if (!e.currentTarget.contains(e.relatedTarget)) {
        model.closeDropdown();
      }
    };

    // Local function to create Salesforce link
    const createSalesforceLink = (dep, model) => {
      return h("div", {
        className: "dep-card-link"
      },
        h("a", {
          href: model.generateSalesforceUrl(dep),
          target: "_blank"
        }, 
          h("svg", {
            viewBox: "0 0 520 520",
            width: "14",
            height: "14",
            fill: "currentColor",
            className: "dep-icon-blue-margin"
          }, 
            h("path", { 
              d: "m272 417-21-3-21-6c-4-1-9 0-12 3l-5 5a79 79 0 0 1-106 6 77 77 0 0 1-4-112l76-76c10-10 22-16 34-20a79 79 0 0 1 74 20l10 13c4 7 13 8 18 2l28-28c4-4 4-10 1-15l-14-16a128 128 0 0 0-71-37 143 143 0 0 0-124 37l-73 73a139 139 0 0 0-6 193 137 137 0 0 0 198 4l25-25c7-5 2-17-7-18zM456 58a139 139 0 0 0-193 6l-23 22c-7 7-2 19 7 20 14 1 28 4 42 8 4 1 9 0 12-3l5-5a79 79 0 0 1 106-6 77 77 0 0 1 4 112l-76 76a85 85 0 0 1-34 20 79 79 0 0 1-74-20l-10-13c-4-7-13-8-18-2l-28 28c-4 4-4 10-1 15l14 16a130 130 0 0 0 70 37 143 143 0 0 0 124-37l76-76a137 137 0 0 0-3-198z" 
            })
          ),
          "Open in Salesforce"
        )
      );
    };

    const renderDependencyItem = (dep, index) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;

      // For 'Referenced By', focus on referencing metadata
      if (model.currentFilter === 'dependedOnBy') {
        return h("div", {
          key: index,
          className: "dep-card"
        },
          h("div", {
              className: "dep-card-content"
          },
            h("span", {
              className: "dep-icon"
            }, getTypeIcon(dep.referencedBy.type)),
            h("span", {
              className: "dep-card-title"
            }, dep.referencedBy.name),
            dep.namespace && h("span", {
              className: "dep-namespace-badge"
            }, dep.namespace)
          ),
          h("div", {
              className: "dep-card-details"
          },
            h("span", { className: "dep-card-referenced-label" }, "Type: "),
            h("span", { className: "dep-card-type" }, dep.referencedBy.type)
          ),
          dep.pills && dep.pills.length > 0 && h("div", {
            className: "dep-card-pills"
          },
            ...dep.pills.map((pill, pillIndex) => h("span", {
              key: pillIndex,
              className: CSSUtils.classNames({
                'dep-pill': true,
                'warning': pill.type === 'warning',
                'standard': pill.type !== 'warning'
              })
            }, pill.label))
          ),
          dep.notes && h("div", {
            className: "dep-card-notes"
          }, dep.notes),
          createSalesforceLink(dep, model)
        );
      }
      // Default: show dependency as before
      function renderWithChildren(dep, index, level = 0, parentKeyPrefix = '') {
        const nestedKey = `${dep.type}::${dep.name}::${level}`;
        const isExpanded = model.expandedGroups.has(nestedKey);
        const groupedChildren = dep.children && dep.children.length > 0 ? model.getGroupedChildren(dep.children, nestedKey + '::') : [];
        return         h("div", {
          key: dep.type + dep.name + index,
          className: "dep-card"
        },
          h("div", {
            className: "dep-card-header"
          },
            h("div", {
              className: "dep-card-content"
            },
              h("span", { className: "dep-icon" }, getTypeIcon(dep.type)),
              h("span", {
                className: "dep-card-title"
              }, dep.name),
              dep.namespace && h("span", {
                className: "dep-namespace-badge"
              }, dep.namespace)
            ),
            groupedChildren.length > 0 && h("span", {
              onClick: (e) => { e.stopPropagation(); model.toggleNested(nestedKey); },
              className: "dep-expand-button",
              title: isExpanded ? 'Collapse nested items' : 'Expand nested items'
            },
              h("span", {}, isExpanded ? `Hide ${groupedChildren.length} Item${groupedChildren.length !== 1 ? 's' : ''}` : `Show ${groupedChildren.length} Item${groupedChildren.length !== 1 ? 's' : ''}`),
              h("span", {
                className: `dep-expand-arrow ${isExpanded ? 'dep-dropdown-arrow-rotated' : 'dep-dropdown-arrow-default'}`
              }, '▶')
            )
          ),
          h("div", {
            className: "dep-card-details"
          },
            h("span", { className: "dep-card-referenced-label" }, "Type: "),
            h("span", { className: "dep-card-type" }, dep.type)
          ),
          h("div", {
            className: "dep-card-details"
          },
            h("span", { className: "dep-card-referenced-label" }, "Referenced by: "),
            h("span", { className: "dep-card-referenced-type" }, dep.referencedBy.type),
            h("span", { className: "dep-card-referenced-name" }, `"${dep.referencedBy.name}"`)
          ),
          dep.pills && dep.pills.length > 0 && h("div", {
            className: "dep-card-pills"
          },
            ...dep.pills.map((pill, pillIndex) => h("span", {
              key: pillIndex,
              className: CSSUtils.classNames({
                'dep-pill': true,
                'warning': pill.type === 'warning',
                'standard': pill.type !== 'warning'
              })
            }, pill.label))
          ),
          dep.notes && h("div", {
            className: "dep-card-notes"
          }, dep.notes),
          createSalesforceLink(dep, model),
          groupedChildren.length > 0 && isExpanded && groupedChildren.map((group, groupIdx) =>
            h("div", {
              key: group.groupKey,
              className: "dep-nested-group"
            },
              h("div", {
                className: "dep-nested-group-header",
                onClick: () => model.toggleNested(group.groupKey)
              },
                h("div", {
                  className: "dep-nested-group-content"
                },
                  h("span", {
                    className: "dep-icon-large"
                  }, getTypeIcon(group.type)),
                  h("span", {
                    className: "dep-nested-group-title",
                    style: {
                      color: getTypeColor(group.type)
                    }
                  }, group.name),
                  h("span", {
                    className: "dep-nested-group-count"
                  }, group.count)
                ),
                h("span", {
                  className: `dep-nested-group-arrow ${model.expandedGroups.has(group.groupKey) ? 'dep-dropdown-arrow-rotated' : 'dep-dropdown-arrow-default'}`
                }, '▶')
              ),
              model.expandedGroups.has(group.groupKey) && h("div", {
                className: "dep-nested-group-body"
              },
                group.dependencies.map((child, childIdx) => renderWithChildren(child, childIdx, level + 2, group.groupKey + '::'))
              )
            )
          )
        );
      }
      return renderWithChildren(dep, index);
    };

    const renderTreeItem = (group, index, level = 0, visitedKeys = new Set()) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;
      
      // Use the groupKey from the group
      const groupKey = group.groupKey || `${group.type}_${index}`;
      const hasChildren = group.dependencies && group.dependencies.length > 0;
      const isExpanded = model.expandedGroups.has(groupKey);
      
      // Prevent circular references
      if (visitedKeys.has(groupKey)) {
        console.warn('Circular reference detected for:', groupKey);
        return h("div", {
          key: `circular-${groupKey}`,
          className: "dep-tree-item"
        }, "⚠️ Circular reference detected");
      }
      
      // Add current key to visited set
      visitedKeys.add(groupKey);
      
      return h("div", {
        key: `tree-item-${groupKey}-${level}-${index}`,
        className: "dep-tree-item"
      },
        h("div", {
          className: `dep-tree-content dep-tree-indent-level-${Math.min(level, 5)}`,
          onClick: hasChildren ? () => model.toggleGroup(groupKey) : null,
          title: undefined
        },
          hasChildren && h("span", {
            className: CSSUtils.classNames({
              'dep-tree-expand': true,
              'expanded': isExpanded
            })
          }, "▶"),
          h("span", {
            className: "dep-tree-count"
          }, `${group.count || 1}`),
          h("span", {
            className: "dep-tree-icon"
          }, getTypeIcon(group.type)),
          h("span", {
            className: "dep-tree-name dep-type-color",
            style: { color: getTypeColor(group.type) }
          }, group.name)
        ),
        isExpanded && hasChildren && h("div", {
          className: "dep-tree-children"
        }, group.dependencies.map((dep, depIndex) => {
          // Render individual dependencies with their nested children
          const hasNestedChildren = dep.children && dep.children.length > 0;
          const depKey = `${dep.type}::${dep.name}`;
          const isDepExpanded = model.expandedGroups.has(depKey);
          
          return h("div", {
            key: `dep-${depIndex}`,
            className: "dep-tree-item"
          },
            h("div", {
              className: "dep-tree-content",
              onClick: hasNestedChildren ? () => model.toggleGroup(depKey) : null,
              title: dep.referencedBy ? 
                `Referenced by: ${dep.referencedBy.type} "${dep.referencedBy.name}"` : 
                undefined
            },
              hasNestedChildren && h("span", {
                className: CSSUtils.classNames({
                  'dep-tree-expand': true,
                  'expanded': isDepExpanded
                })
              }, "▶"),
              hasNestedChildren && h("span", {
                className: "dep-tree-count"
              }, `${dep.children.length}`),
              h("span", {
                className: "dep-tree-icon"
              }, getTypeIcon(dep.type)),
              h("div", {
                className: "dep-tree-item-content"
              },
                h("div", {
                  className: "dep-tree-main-line"
                },
                  h("span", {
                    className: "dep-tree-name dep-type-color",
                    style: { color: getTypeColor(dep.type) }
                  }, dep.name),
                  // Add link for individual items with IDs
                  dep.id && h("a", {
                    href: model.generateSalesforceUrl(dep),
                    target: "_blank",
                    className: "dep-tree-link",
                    title: "Open in Salesforce",
                    onClick: (e) => e.stopPropagation()
                  }, 
                    h("svg", {
                      viewBox: "0 0 520 520",
                      width: "14",
                      height: "14",
                      fill: "currentColor",
                      className: "dep-icon-blue"
                    }, 
                      h("path", { 
                        d: "m272 417-21-3-21-6c-4-1-9 0-12 3l-5 5a79 79 0 0 1-106 6 77 77 0 0 1-4-112l76-76c10-10 22-16 34-20a79 79 0 0 1 74 20l10 13c4 7 13 8 18 2l28-28c4-4 4-10 1-15l-14-16a128 128 0 0 0-71-37 143 143 0 0 0-124 37l-73 73a139 139 0 0 0-6 193 137 137 0 0 0 198 4l25-25c7-5 2-17-7-18zM456 58a139 139 0 0 0-193 6l-23 22c-7 7-2 19 7 20 14 1 28 4 42 8 4 1 9 0 12-3l5-5a79 79 0 0 1 106-6 77 77 0 0 1 4 112l-76 76a85 85 0 0 1-34 20 79 79 0 0 1-74-20l-10-13c-4-7-13-8-18-2l-28 28c-4 4-4 10-1 15l14 16a130 130 0 0 0 70 37 143 143 0 0 0 124-37l76-76a137 137 0 0 0-3-198z" 
                      })
                    )
                  ),
                  dep.namespace && h("span", {
                    className: "dep-tree-namespace"
                  }, dep.namespace),
                  dep.pills && h("div", {
                    className: "dep-tree-pills"
                  }, dep.pills.map((pill, pillIndex) => 
                    h("span", {
                      key: pillIndex,
                      className: CSSUtils.classNames({
                        'dep-tree-pill': true,
                        'standard': pill.type !== 'warning',
                        'warning': pill.type === 'warning'
                      })
                    }, pill.text)
                  ))
                ),
                dep.referencedBy && h("div", {
                  className: "dep-tree-referenced-by"
                },
                  h("span", {
                    className: "dep-tree-referenced-label"
                  }, "Referenced by: "),
                  h("span", {
                    className: "dep-tree-referenced-type"
                  }, dep.referencedBy.type),
                  h("span", {
                    className: "dep-tree-referenced-name"
                  }, `"${dep.referencedBy.name}"`)
                )
              )
            ),
            isDepExpanded && hasNestedChildren && h("div", {
              className: "dep-tree-children"
            }, (() => {
              // Group children by type to show proper topics
              const childGroups = {};
              dep.children.forEach((child, childIndex) => {
                let groupKey = child.type;
                let groupName = child.type;
                // Special grouping for CustomField by object
                if (child.type === 'CustomField' && child.name.includes('.')) {
                  const [objectName, fieldName] = child.name.split('.');
                  groupKey = `CustomField_${objectName}`;
                  groupName = `Custom Fields on ${objectName}`;
                }
                // Special grouping for ApexClass by namespace
                if (child.type === 'ApexClass' && child.namespace) {
                  groupKey = `ApexClass_${child.namespace}`;
                  groupName = `Apex Classes (${child.namespace})`;
                }
                if (!childGroups[groupKey]) {
                  childGroups[groupKey] = {
                    name: groupName,
                    type: child.type,
                    dependencies: [],
                    count: 0,
                    groupKey: `${groupKey}-${depIndex}-${childIndex}`,
                    referencedBy: dep.referencedBy // Pass through the referencing information
                  };
                }
                childGroups[groupKey].dependencies.push(child);
                childGroups[groupKey].count++;
              });
              
              return Object.values(childGroups).map((childGroup, groupIndex) => 
                renderTreeItem(childGroup, groupIndex, level + 2, new Set(visitedKeys))
              );
            })())
          );
        }))
      );
    };

    const renderGroup = (group, groupIndex) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;

      const groupKey = `${group.type}_${groupIndex}`;
      const isExpanded = model.expandedGroups.has(groupKey);

      // Use retro tree styling for Dependency Tree view
      if (!model._showFlatView) {
        return renderTreeItem(group, groupIndex);
      }

      return h("div", {
        key: groupKey,
        className: "dep-flat-group"
      },
        h("div", {
          className: CSSUtils.classNames({
            'dep-flat-group-header': true,
            'collapsed': !isExpanded
          }),
          onClick: () => model.toggleGroup(groupKey)
        },
          h("div", {
            className: "dep-group-content"
          },
            h("span", { className: "dep-icon-large" }, getTypeIcon(group.type)),
            h("span", {
              className: "dep-group-title",
              style: {
                color: getTypeColor(group.type)
              }
            }, group.name),
            h("span", {
              className: "dep-group-count"
            }, group.count)
          ),
          h("span", {
            className: CSSUtils.classNames({
              'dep-group-expand': true,
              'expanded': isExpanded
            })
          }, '▶')
        ),
        isExpanded && h("div", {
          className: "dep-group-body"
        },
          group.dependencies.map((dep, index) => renderDependencyItem(dep, index))
        )
      );
    };
    
    const renderFlatGroup = (group, groupIndex) => {
      const getTypeIcon = Helpers.getTypeIcon;
      const getTypeColor = Helpers.getTypeColor;

      const groupKey = `${group.type}_${groupIndex}`;
      const isExpanded = model.expandedGroups.has(groupKey);

      return h("div", {
        key: groupKey,
        className: "dep-flat-group"
      },
        h("div", {
          className: CSSUtils.classNames({
            'dep-flat-group-header': true,
            'collapsed': !isExpanded
          }),
          onClick: () => model.toggleGroup(groupKey)
        },
          h("div", {
            className: "dep-flat-group-header-content"
          },
            h("span", {
              className: "dep-icon-large"
            }, getTypeIcon(group.type)),
            h("span", {
              className: "dep-group-title",
              style: {
                color: getTypeColor(group.type)
              }
            }, group.name),
            h("span", {
              className: "dep-group-count"
            }, group.count)
          ),
          h("span", {
            className: `dep-group-expand ${model.expandedGroups.has(groupKey) ? 'dep-dropdown-arrow-rotated' : 'dep-dropdown-arrow-default'}`
          }, '▶')
        ),
        model.expandedGroups.has(groupKey) && h("div", {
          className: "dep-group-body"
        },
          group.dependencies.map((dep, depIdx) =>             h("div", {
            key: `${dep.type}_${dep.name}_${depIdx}`,
              className: "dep-card"
          },
            h("div", {
                className: "dep-card-header"
            },
              h("div", {
                  className: "dep-card-content"
                },
                h("span", { className: "dep-icon" }, getTypeIcon(dep.type)),
                h("span", {
              className: "dep-card-title"
                }, dep.name),
                dep.namespace && h("span", {
                  className: "dep-namespace-badge"
                }, dep.namespace)
              )
            ),
            h("div", {
              className: "dep-card-details"
            },
              h("span", { className: "dep-card-referenced-label" }, "Type: "),
              h("span", { className: "dep-card-type" }, dep.type)
            ),
            dep.referencedBy && h("div", {
              className: "dep-card-details"
            },
              h("span", { className: "dep-card-referenced-label" }, "Referenced by: "),
              h("span", { className: "dep-card-referenced-type" }, dep.referencedBy.type),
              h("span", { className: "dep-card-referenced-name" }, `"${dep.referencedBy.name}"`)
            ),
            dep.pills && dep.pills.length > 0 && h("div", {
              className: "dep-card-pills"
            },
              ...dep.pills.map((pill, pillIndex) => h("span", {
                key: pillIndex,
                style: {
                  backgroundColor: pill.type === 'warning' ? '#fff3cd' : '#d1ecf1',
                  color: pill.type === 'warning' ? '#856404' : '#0c5460',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }
              }, pill.text))
            ),
            createSalesforceLink(dep, model)
          ))
        )
      );
    };

    return h("div", {},
      h("div", {id: "user-info"},
        h("a", {href: model.sfLink, className: "sf-link"},
          h("svg", {viewBox: "0 0 24 24"},
            h("path", {d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"})
          ),
          " Salesforce Home"
        ),
          h("h1", {className: "dep-title"}, "Dependencies Explorer"),
          h("span", {className: "dep-subtitle"}, " / " + model.userInfo),
      ),
              h("div", {className: "area dep-area", id: "dependencies-area"},
        h("div", {className: "result-bar dep-result-bar"},
          h("div", {className: "dep-buttons-left"},
            h("button", {
              onClick: () => model.downloadPackageXml(),
              disabled: !model.dependencyResults || !model.dependencyResults.dependsOn.length || model.currentFilter !== 'dependsOn',
              className: "dep-btn dep-btn-success"
            }, 
              h("span", {className: ""},
                h("svg", {
                  viewBox: "0 0 520 520",
                  width: "18",
                  height: "18",
                  fill: "currentColor",
                  className: "dep-icon-inline-margin"
                },
                  h("path", {
                    d: "M462 389 274 496c-10 6-23 6-33 0L54 389c-8-4-8-14 0-18l44-25a10 10 0 0 1 10 0l114 65c11 6 23 9 36 9s25-3 36-9l114-65a10 10 0 0 1 10 0l44 25c8 4 8 14 0 18zm0-120L274 376c-10 6-23 6-33 0L54 269c-8-4-8-14 0-18l44-25a10 10 0 0 1 10 0l114 65c11 6 23 9 36 9s25-3 36-9l114-65a10 10 0 0 1 10 0l44 25c8 4 8 14 0 18zm-219-13L55 149c-8-4-8-14 0-18L243 24c10-6 23-6 33 0l188 107c8 4 8 14 0 18L276 256c-10 5-23 5-33 0z"
                  })
                )
              ),
              "Generate Package.xml"
            ),
            h("button", {
              onClick: () => model.exportDependencies(),
              disabled: !model.dependencyResults || (!model.dependencyResults.dependsOn.length && !model.dependencyResults.dependedOnBy.length),
              className: "dep-btn dep-btn-success"
            }, 
              h("span", {className: ""},
                h("svg", {
                  viewBox: "0 0 520 520",
                  width: "18",
                  height: "18",
                  fill: "currentColor",
                  className: "dep-icon-inline-margin"
                },
                  h("path", {
                    d: "M23 379v2c0 8 6 14 14 14 4 0 7-1 10-4 0 0 101-109 225-76v110c0 8 6 14 14 14l7-2 201-171c3-3 5-7 5-11s-2-8-4-10L294 82l-8-2c-8 0-14 6-14 14v103c-1 0-199-30-249 182z"
                  })
                )
              ),
              "Export Summary"
            )
          ),
          h("div", {className: "dep-controls"},
            h("select", {
              value: model.selectedMetadataType,
              onChange: e => model.setMetadataType(e.target.value),
              className: "dep-select"
            },
              ...metadataTypes.map(type => h("option", {value: type.value}, type.label))
            ),
            h("div", {
              tabIndex: 0,
              ref: dropdownRef,
              className: "dep-dropdown-container",
              onBlur: handleDropdownBlur
            },
              h("div", {
                className: `dep-dropdown-trigger ${model._dropdownOpen ? 'dep-dropdown-open' : ''} ${selectedItem ? 'dep-dropdown-default' : 'dep-dropdown-placeholder'}`,
                onClick: () => model.toggleDropdown()
              },
                h("span", {
                  className: "dep-dropdown-text",
                  title: selectedItem ? selectedItem.fullName : ''
                }, selectedItem ? selectedItem.fullName : (model.isLoadingMetadataItems ? "Loading..." : "Select an item...")),
                h("span", {
                  className: `dep-dropdown-arrow ${model._dropdownOpen ? 'dep-dropdown-arrow-rotated' : 'dep-dropdown-arrow-default'}`
                }, '▶')
              ),
              model._dropdownOpen && h("div", {
                className: "dep-dropdown-panel"
              },
                model.isLoadingMetadataItems ? 
                  h("div", {
                    className: "dep-dropdown-loading"
                  }, "Loading items...") :
                h("div", {},
                  h("div", {
                    className: "dep-dropdown-search"
                  },
                    h("input", {
                      type: "text",
                      placeholder: "Search...",
                      value: model._dropdownSearch,
                      onChange: e => model.setDropdownSearch(e.target.value),
                      className: "dep-dropdown-search-input",
                      autoFocus: true
                    }),
                    h("div", {
                      className: "dep-dropdown-filter"
                    },
                      h("input", {
                        type: "checkbox",
                        id: "exclude-external-packages",
                        checked: model._excludeExternalPackages,
                        onChange: () => model.toggleExcludeExternalPackages(),
                        className: "dep-dropdown-checkbox"
                      }),
                      h("label", {
                        htmlFor: "exclude-external-packages",
                        className: "dep-dropdown-label"
                      }, "Exclude external packages")
                    ),
                  ),
                  h("div", {
                    className: "dep-dropdown-items"
                  },
                    filteredItems.length === 0 && h("div", {
                      className: "dep-dropdown-empty"
                    }, "No items found"),
                    filteredItems.map(item =>
                      h("div", {
                        key: item.id,
                        className: "dep-dropdown-item",
                        style: {
                          color: selectedItem && selectedItem.id === item.id ? '#0070d2' : '#333',
                          background: selectedItem && selectedItem.id === item.id ? '#e3f0fa' : 'transparent',
                          fontWeight: selectedItem && selectedItem.id === item.id ? 600 : 400
                        },
                        title: item.fullName,
                        onClick: () => { model.setMetadataItem(item); model.closeDropdown(); }
                      }, item.fullName)
                    )
                  )
                )
              )
            ),
            h("button", {
              onClick: () => model.fetchDependencies(),
              disabled: model.spinnerCount > 0 || !model.selectedMetadataItem,
              className: "dep-btn dep-btn-primary"
            }, "Analyze Dependencies")
          )
        ),
        h("div", {id: "dependencies-content", className: "dep-container"},
          model.spinnerCount > 0 && h("div", {
            className: "dep-loading"
          },
            h("div", {
              className: "dep-loading-spinner"
            },
              h("span", { className: "dep-loading-dot" }),
              h("span", { className: "dep-loading-dot" }),
              h("span", { className: "dep-loading-dot" })
            )
          ),
          model.dependencyError && h("div", {
            className: "dep-error"
          }, "❌ Error: ", model.dependencyError),
          
          model.dependencyTree && h("div", {},
            h("div", {
              className: "dep-header"
            },
              h("div", {},
                h("h3", {
                  className: "dep-section-title"
                }, `${model.lastAnalyzedItem ? model.lastAnalyzedItem.fullName : ''} — ${model.selectedMetadataType} Dependencies`),
                h("div", {
                  className: "dep-section-subtitle"
                },
                  model.dependencyResults.dependedOnBy.length > 0 && h("span", {
                    className: CSSUtils.classNames({
                      'dep-filter-toggle': true,
                      'active': model.currentFilter === 'dependedOnBy',
                      'inactive': model.currentFilter !== 'dependedOnBy'
                    }),
                    onClick: () => model.setFilter('dependedOnBy'),
                    title: 'Show components that use or rely on this metadata'
                  }, `Referenced By (${model.getReferencedByCount()})`),
                  model.dependencyResults.dependsOn.length > 0 && h("span", {
                    className: CSSUtils.classNames({
                      'dep-filter-toggle': true,
                      'active': model.currentFilter === 'dependsOn',
                      'inactive': model.currentFilter !== 'dependsOn'
                    }),
                    onClick: () => model.setFilter('dependsOn'),
                    title: 'Show components this metadata requires to function'
                  }, `Depends On (${model.getDependsOnCount()})`),
                  model.dependencyTree.length === 0 && model.spinnerCount === 0 && h("span", {}, "No dependencies found")
                )
              )
            ),
            
                                // View buttons - separate buttons for Quick Summary and Dependency Tree views
            // Quick Summary: Shows deduplicated list of distinct metadata items
        // Dependency Tree: Shows complete dependency tree with parent-child relationships
            model.currentFilter === 'dependsOn' && !model.showJsonDebug && h("div", {
              className: "dep-view-toggle-container"
            },
              h("button", {
                className: CSSUtils.classNames({
                  'dep-view-toggle': true,
                  'active': model._showFlatView,
                  'inactive': !model._showFlatView
                }),
                onClick: () => { if (!model._showFlatView) model.toggleFlatView(); },
                title: 'Show deduplicated list of distinct metadata items'
              },
                h("svg", {
                  viewBox: "0 0 520 520",
                  width: "20",
                  height: "20",
                  fill: "currentColor",
                  className: "dep-icon-inline-margin-large"
                },
                  h("path", {
                    d: "M282 210a10 10 0 0 0-14 0L29 449a29 29 0 0 0 0 42c12 12 30 12 42 0l239-239c4-4 4-10 0-14l-28-28zm70 0 32-32c6-6 6-15 0-21l-21-21c-6-6-15-6-21 0l-32 32a10 10 0 0 0 0 14l28 28c4 4 10 4 14 0zm-248-94a120 120 0 0 1 80 80c2 6 10 6 12 0a120 120 0 0 1 80-80c6-2 6-10 0-12a120 120 0 0 1-80-80 6 6 0 0 0-12 0 120 120 0 0 1-80 80c-5 2-5 10 0 12zm392 189a110 110 0 0 1-71-71 6 6 0 0 0-11 0 110 110 0 0 1-71 71c-5 2-5 9 0 11a110 110 0 0 1 71 71c2 5 9 5 11 0a110 110 0 0 1 71-71c5-2 5-10 0-11zM383 84c26 8 45 27 53 53 1 4 7 4 8 0a78 78 0 0 1 53-53c4-1 4-7 0-8a78 78 0 0 1-53-53c-1-4-7-4-8 0a78 78 0 0 1-53 53c-4 1-4 7 0 8z"
                  })
                ),
                "Quick Summary"
              ),
              h("button", {
                className: CSSUtils.classNames({
                  'dep-view-toggle': true,
                  'active': !model._showFlatView,
                  'inactive': model._showFlatView
                }),
                onClick: () => { if (model._showFlatView) model.toggleFlatView(); },
                title: 'Show complete dependency tree with parent-child relationships'
              },
                h("svg", {
                  viewBox: "0 0 520 520",
                  width: "20",
                  height: "20",
                  fill: "currentColor",
                  className: "dep-icon-inline-margin-large"
                },
                  h("path", {
                    d: "M231 230H108c-7 0-14 6-14 13v105H53c-7 0-14 7-14 14v100c0 7 7 14 14 14h137c7 0 14-7 14-14V362c0-7-7-14-14-14h-41v-64h219v64h-41c-7 0-14 7-14 14v100c0 7 7 14 14 14h137c7 0 13-7 13-14V362c0-7-6-14-13-14h-42V243c0-7-7-13-14-13H286v-64h41c7 0 13-7 13-14V52c0-7-6-14-13-14H190c-7 0-14 7-14 14v100c0 7 7 14 14 14h42v64z"
                  })
                ),
                "Dependency Tree"
              )
            ),
            
            model.showJsonDebug && model.getFilteredDependencies().length > 0 ? h("pre", {
              className: "dep-json-debug"
            }, JSON.stringify(model.getJsonDebugData(), null, 2)) :
            
            h("div", {
              className: model._showFlatView ? "dep-content" : "dep-tree-container"
            },
              (() => {
                const filteredDeps = model.getFilteredDependencies();
                if (filteredDeps.length > 0) {
                  if (model.currentFilter === 'dependsOn' && model._showFlatView) {
                    return model.getFlatGroupedDependencies().map((group, index) => renderFlatGroup(group, index));
                  } else if (model.currentFilter === 'dependsOn' && !model._showFlatView) {
                    const treeItems = model.getTreeGroupedDependencies();
                    return treeItems.map((item, index) => renderTreeItem(item, index, 0, new Set()));
                  } else {
                    // For "Referenced By" or flat view, use grouped dependencies
                    return model.getGroupedDependencies().map((group, index) => renderGroup(group, index));
                  }
                } else if (model.spinnerCount === 0) {
                  return h("div", {
                    className: "dep-empty"
                  }, "No dependencies found");
                } else {
                  return null;
                }
              })()
            )
          ),
          
          !model.dependencyTree && !model.dependencyError && h("div", {
            className: "dep-empty"
          },
            h("h3", {}, "Welcome to the Dependencies Explorer!"),
            h("p", {}, "Select a metadata type and item to analyze its dependencies."),
            h("p", { className: "small" }, "This tool automatically shows what your metadata references and what references it.")
          ),
          
          h("div", {
            className: "dep-footer"
          },
            h("div", {
              className: "dep-footer-content"
            },
              h("span", {
                className: "dep-footer-session"
              }, model.dependencyTree ? 
                h("span", {},
                  h("svg", {
                    viewBox: "0 0 520 520",
                    width: "15",
                    height: "15",
                    fill: "currentColor",
                    className: "dep-icon-inline-no-margin"
                  },
                    h("path", {
                      d: "M496 453 362 320a189 189 0 1 0-340-92 190 190 0 0 0 298 135l133 133a14 14 0 0 0 21 0l21-21a17 17 0 0 0 1-22ZM210 338a129 129 0 1 1 130-130 129 129 0 0 1-130 130Z"
                    })
                  ),
                  ` • ${model.currentFilter === 'dependedOnBy' ? model.getReferencedByCount() : model.getDependsOnCount()} ${(model.currentFilter === 'dependedOnBy' ? model.getReferencedByCount() : model.getDependsOnCount()) === 1 ? 'item' : 'items'} found`
                ) :
                h("span", {},
                  h("svg", {
                    viewBox: "0 0 520 520",
                    width: "15",
                    height: "15",
                    fill: "currentColor",
                    className: "dep-icon-inline-no-margin"
                  },
                    h("path", {
                      d: "M496 453 362 320a189 189 0 1 0-340-92 190 190 0 0 0 298 135l133 133a14 14 0 0 0 21 0l21-21a17 17 0 0 0 1-22ZM210 338a129 129 0 1 1 130-130 129 129 0 0 1-130 130Z"
                    })
                  ),
                  " • Please select a metadata type and item to analyze"
                )
              ),
              h("button", {
                onClick: () => model.toggleJsonDebug(),
                className: "dep-footer-debug-btn",
                title: model.showJsonDebug ? "Hide JSON debug data" : "Show JSON debug data"
              }, model.showJsonDebug ? "Hide JSON" : "JSON")
            )
          )
        )
      )
    );
  }
}

{
  // Add CSS animations
  if (typeof window !== 'undefined' && !window.__dep_spinner_css) {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes dep-bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-20px); }
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    window.__dep_spinner_css = true;
  }

  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {

    let root = document.getElementById("root");
    let model = new Model(sfHost, args);
    window.sfConn = sfConn;
    model.reactCallback = cb => {
      ReactDOM.render(h(App, {model}), root, cb);
    };
    ReactDOM.render(h(App, {model}), root);

  });
} 

// Performance utilities
/**
 * Performance optimization utilities
 * @type {Object}
 */
const PerformanceUtils = {
  /**
   * Simple memoization cache
   * @type {Map}
   */
  cache: new Map(),

  /**
   * Memoizes a function with a cache key
   * @param {string} key - Cache key
   * @param {Function} fn - Function to memoize
   * @param {Array} args - Function arguments
   * @returns {*} Cached or computed result
   */
  memoize(key, fn, args = []) {
    const cacheKey = `${key}_${JSON.stringify(args)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const result = fn.apply(null, args);
    this.cache.set(cacheKey, result);
    return result;
  }
}; 

// CSS Class Utilities
/**
 * Utilities for managing CSS classes and style migration
 * @type {Object}
 */
const CSSUtils = {
  /**
   * Creates conditional CSS classes
   * @param {Object} classMap - Map of class names to boolean conditions
   * @param {string} [baseClass] - Base class name
   * @returns {string} Combined class string
   */
  classNames(classMap, baseClass = '') {
    const classes = [baseClass];
    Object.entries(classMap).forEach(([className, condition]) => {
      if (condition) classes.push(className);
    });
    return classes.filter(Boolean).join(' ');
  }
}; 