import {sfConn, apiVersion} from "./inspector.js";
import {popupTest} from "./popup-test.js";
import {csvParseTest} from "./csv-parse-test.js";
import {dataImportTest} from "./data-import-test.js";
import {dataExportTest} from "./data-export-test.js";
import {restExploreTest} from "./rest-explore-test.js";

let seenError = false;
class Test {

  constructor(sfHost) {
    this.sfHost = sfHost;
    this.assertEquals = this.assertEquals.bind(this);
    this.assertThrows = this.assertThrows.bind(this);
    this.assertNotEquals = this.assertNotEquals.bind(this);
    this.assert = this.assert.bind(this);
    this.loadPage = this.loadPage.bind(this);
    this.anonApex = this.anonApex.bind(this);
  }

  assertEquals(expected, actual) {
    let strExpected = JSON.stringify(expected);
    let strActual = JSON.stringify(actual);
    if (strExpected !== strActual) {
      seenError = true;
      let msg = new Error("assertEquals failed: Expected " + strExpected + " but found " + strActual + ".");
      console.error(msg);
      throw msg;
    }
  }

  assertThrows(expected, fn) {
    let strExpected = JSON.stringify(expected);
    let res;
    try {
      res = fn();
    } catch (actual) {
      let strActual = JSON.stringify(actual);
      if (strExpected !== strActual) {
        seenError = true;
        let msg = new Error("assertThrows failed: Expected " + strExpected + " but found " + strActual + ".");
        console.error(msg);
        throw msg;
      }
      return;
    }
    seenError = true;
    let strRes = JSON.stringify(res);
    let msg = new Error("assertThrows failed: Expected thrown " + strExpected + " but found returned " + strRes + ".");
    console.error(msg);
    throw msg;
  }

  assertNotEquals(expected, actual) {
    let strExpected = JSON.stringify(expected);
    let strActual = JSON.stringify(actual);
    if (strExpected === strActual) {
      seenError = true;
      let msg = new Error("assertNotEquals failed: Found " + strActual + ".");
      console.error(msg);
      throw msg;
    }
  }

  assert(truth, msg) {
    if (!truth) {
      seenError = true;
      console.error("assert failed", msg);
      let err = new Error("assert failed: " + msg);
      throw err;
    }
  }

  loadPage(url, args = new URLSearchParams()) {
    return new Promise(resolve => {
      window.insextTestLoaded = testData => {
        window.insextTestLoaded = null;
        resolve(testData);
      };
      args.set("host", this.sfHost);
      window.page.src = url + "?" + args;
    });
  }

  async anonApex(apex) {
    window.anonApex.style.color = "black";
    window.anonApexCode.textContent = apex;
    let res = await sfConn.rest("/services/data/v" + apiVersion + "/tooling/executeAnonymous/?anonymousBody=" + encodeURIComponent(apex));
    window.anonApex.style.color = "lightblue";
    this.assert(res.success, res);
  }

}

window.isUnitTest = true;

function updateProgress(nextTestId, previousTestId) {
  const prevEl = document.getElementById(previousTestId);
  const nextEl = document.getElementById(nextTestId);
  const prevStyle = prevEl?.style;
  const nextStyle = nextEl?.style;
  if (prevStyle) {
    prevStyle.background = "green";
    prevStyle.borderBottom = "0";
    prevEl.textContent = prevEl.textContent.replace("⏳", "✔️");
  }
  if (nextEl) {
    nextStyle.background = "yellow";
    nextStyle.borderBottom = "3px solid black";
    nextEl.textContent += " ⏳";
  }
}

addEventListener("load", () => {
  (async () => {
    try {
      let args = new URLSearchParams(location.search.slice(1));
      let sfHost = args.get("host");
      await sfConn.getSession(sfHost);
      let test = new Test(sfHost);

      updateProgress("popupTest");
      await popupTest(test);
      updateProgress("csvParseTest", "popupTest");
      await csvParseTest(test);
      updateProgress("dataImportTest", "csvParseTest");
      await dataImportTest(test);
      updateProgress("dataExportTest", "dataImportTest");
      await dataExportTest(test);
      updateProgress(null, "dataExportTest");
      await restExploreTest(test);
      updateProgress(null, "restExploreTest");

      window.anonApex.hidden = true;
      test.assert(!seenError, "Expected no error");
      console.log("Salesforce Inspector unit tests finished successfully");
      window.result.textContent = "Salesforce Inspector unit tests finished successfully";
      window.result.style.background = "green";
      window.page.src = "data:text/plain,Salesforce Inspector unit test finished successfully";
    } catch (e) {
      console.error("error", e);
      window.anonApex.hidden = false;
      window.result.textContent = "Salesforce unit tests failed - Detail:";
      window.result.style.background = "red";
      window.result.style.color = "white";
      window.result.style.padding = "5px";
      window.result.style.fontWeight = "bold";
      window.resultErrorDetail.textContent = `Error Message: ${JSON.stringify(e.message)}`;
      window.resultErrorDetail.style.padding = "5px";
    }
  })();
});
