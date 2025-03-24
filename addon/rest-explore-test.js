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

  // Test sending a simple GET request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Account/describe`;
  model.request.method = "get";
  model.doSend();
  await waitForSpinner();
  assert(model.apiResponse.value.includes("Account"));


  // Test a POST request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Account/`;
  model.request.method = "post";
  model.request.body = '{ "Name" : "SFIR" }';
  model.doSend();
  await waitForSpinner();
  assert(model.apiResponse.value.includes("id"));
  assertEquals("post", model.request.method.toLowerCase());

  // Test a PATCH request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`; // Replace with a valid Account ID if you have one for testing
  model.request.method = "patch";
  model.request.body = '{ "Name" : "SFIR Updated" }';
  model.doSend();
  await waitForSpinner();
  // Add assertions to check for successful PATCH (e.g., status code 204) if needed

  // Test a DELETE request
  model.request.endpoint = `/services/data/v${apiVersion}/sobjects/Account/001XXXXXXX`; // Replace with a valid Account ID if you have one for testing
  model.request.method = "delete";
  model.request.body = "";
  model.doSend();
  await waitForSpinner();
  // Add assertions to check for successful DELETE (e.g., status code 204) if needed
}
