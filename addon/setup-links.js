import {sfConn, apiVersion} from "./inspector.js";

export async function getObjectSetupLinks(sfHost, sobjectName) {
  let {records: entityDefinitions} = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(`select DurableId from EntityDefinition where QualifiedApiName = '${sobjectName}'`)}`);
  let durableId = entityDefinitions[0].DurableId.split(".");
  let entityDurableId = durableId[0];
  return {
    lightningSetupLink: `https://${sfHost}/lightning/setup/ObjectManager/${entityDurableId}/FieldsAndRelationships/view`,
    classicSetupLink: sobjectName.includes("__")
      ? `https://${sfHost}/${entityDurableId}`
      : `https://${sfHost}/p/setup/layout/LayoutFieldList?type=${entityDurableId}&setupid=${entityDurableId}Fields`
  };
}

function getFieldDefinitionSetupLinks(sfHost, fieldName, fieldDefinition, isCustomSetting, isCustomMetadata) {
  let durableId = fieldDefinition.DurableId.split(".");
  let entityDurableId = durableId[0];
  let fieldDurableId = durableId[durableId.length - 1];
  let customType = isCustomMetadata ? "CustomMetadata" : isCustomSetting ? "CustomSettings" : "";
  let lightSetupLink = isCustomMetadata ? `https://${sfHost}/lightning/setup/${customType}/page?address=%2F${fieldDurableId}%3Fsetupid%3D${customType}` : `https://${sfHost}/lightning/setup/ObjectManager/${entityDurableId}/FieldsAndRelationships/${fieldDurableId}/view`;
  return {
    lightningSetupLink: lightSetupLink,
    classicSetupLink: fieldName.includes("__")
      ? `https://${sfHost}/${fieldDurableId}`
      : `https://${sfHost}/p/setup/field/StandardFieldAttributes/d?id=${fieldDurableId}&type=${entityDurableId}`
  };
}

export async function getFieldSetupLinks(sfHost, sobjectName, fieldName, isCustomSetting) {
  let qualifiedApiName = fieldName;
  const replaceQualifierNameBySuffixOfAddressField = {
    "City": "Address",
    "CountryCode": "Address",
    "GeocodeAccuracy": "Address",
    "Latitude": "Address",
    "Longitude": "Address",
    "PostalCode": "Address",
    "StateCode": "Address",
    "Street": "Address",
    "__City__s": "__c",
    "__CountryCode__s": "__c",
    "__GeocodeAccuracy__s": "__c",
    "__Latitude__s": "__c",
    "__Longitude__s": "__c",
    "__PostalCode__s": "__c",
    "__StateCode__s": "__c",
    "__Street__s": "__c",
  };
  for (const suffixOfAddressField in replaceQualifierNameBySuffixOfAddressField) {
    const replaceQualifiedName = replaceQualifierNameBySuffixOfAddressField[suffixOfAddressField];
    if (fieldName.endsWith(suffixOfAddressField)) {
      qualifiedApiName = qualifiedApiName.replace(suffixOfAddressField, replaceQualifiedName);
      break;
    }
  }
  let {records: fieldDefinitions} = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(`select DurableId from FieldDefinition where EntityDefinition.QualifiedApiName = '${sobjectName}' and QualifiedApiName = '${qualifiedApiName}'`)}`);
  let isCmdt = sobjectName.endsWith("__mdt");
  return getFieldDefinitionSetupLinks(sfHost, fieldName, fieldDefinitions[0], isCustomSetting, isCmdt);
}

export async function getAllFieldSetupLinks(sfHost, sobjectName) {
  let {records: fieldDefinitions} = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(`select DurableId, QualifiedApiName from FieldDefinition where EntityDefinition.QualifiedApiName = '${sobjectName}'`)}`);
  let fields = new Map();
  for (let fieldDefinition of fieldDefinitions) {
    let fieldName = fieldDefinition.QualifiedApiName;
    fields.set(fieldName, getFieldDefinitionSetupLinks(sfHost, fieldName, fieldDefinition, false, false));
  }
  return fields;
}
