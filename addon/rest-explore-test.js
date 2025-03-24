import {apiVersion} from "./inspector.js";

export async function restExploreTest(test) {
  console.log("TEST rest-explore");
  let {assertEquals, assert, loadPage} = test;

  let {model} = await loadPage("rest-explore.html");

  function waitForSpinner() {
    return new Promise(resolve => {
      assertEquals(undefined, model.testCallback);
      model.testCallback = () => {
        if (model.spinnerCount == 0) {
          model.testCallback = undefined;
          resolve();
        }
      };
    });
  }

  // Initial state checks
  let query = model.queryHistory.list.length > 0 ? model.queryHistory.list[0] : model.requestTemplates[0];
  assertEquals(model.request.endpoint, query.endpoint);
  assertEquals(model.request.method, query.method);
  assertEquals(model.request.body, query.body);
  assert(Array.isArray(model.queryHistory.list));
  assert(Array.isArray(model.savedHistory.list));

  // Test a POST request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/`;
  model.request.method = "post";
  model.request.body = '{ "Name" : "SFIR" }';
  model.doSend();
  await waitForSpinner();
  assert(model.apiResponse.value.includes("id"));
  let objId = JSON.parse(model.apiResponse.value).id;

  // Test a PATCH request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/${objId}`;
  model.request.method = "patch";
  model.request.body = '{ "Name" : "SFIR Updated" }';
  model.doSend();
  await waitForSpinner();
  assertEquals(204, model.apiResponse.code);

  // Test sending a simple GET request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/${objId}`;
  model.request.method = "get";
  model.doSend();
  await waitForSpinner();
  assertEquals("SFIR Updated", JSON.parse(model.apiResponse.value).Name);

  // Test a DELETE request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/${objId}`;
  model.request.method = "delete";
  model.request.body = "";
  model.doSend();
  await waitForSpinner();
  assertEquals(204, model.apiResponse.code);
}
