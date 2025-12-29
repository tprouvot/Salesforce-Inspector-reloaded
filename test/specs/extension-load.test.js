/* eslint-disable strict */
const {execSync} = require("child_process");

let sessionId;
let instanceUrl;

before(async () => {
  try {
    const output = execSync(
      "sf org display --json",
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        env: {
          ...process.env,
          SF_USE_PROGRESS_BAR: "false",
          SFDX_DISABLE_SPINNER: "true",
          FORCE_COLOR: "0",
        },
      }
    );

    const jsonStart = output.search(/\{\s*"status"\s*:/);
    const jsonEnd = output.lastIndexOf("}");
    const jsonString = output.slice(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonString);

    sessionId = result.result.accessToken;
    instanceUrl = result.result.instanceUrl;

    console.log("Session ID:", sessionId.slice(0, 15) + "...");
    console.log("Instance URL:", instanceUrl);
  } catch (err) {
    console.error("Failed to get org details:", err);
    throw err;
  }
});

it("should inject content scripts on a Salesforce scratch org", async () => {
  // 1️⃣ Navigate to the scratch org domain
  await browser.url(instanceUrl);
  console.log("Step 1: Navigated to org");
  await browser.pause(2000);

  // 2️⃣ Get the ACTUAL current URL after any redirects
  const currentUrl = await browser.getUrl();
  console.log("Current URL after redirect:", currentUrl);

  // Extract the actual hostname we're on
  const {hostname: actualHostname} = new URL(currentUrl);
  console.log("Actual hostname:", actualHostname);

  // 3️⃣ Set cookie for the ACTUAL domain (without leading dot)
  await browser.setCookies([
    {
      name: "sid",
      value: sessionId,
      domain: actualHostname,
      path: "/",
      secure: true,
      httpOnly: true,
    },
  ]);
  console.log("Step 2: Cookie set for", actualHostname);

  // 4️⃣ Navigate to Lightning home
  await browser.url(`${instanceUrl}/lightning/page/home`);
  await browser.pause(3000);

  // 5️⃣ Verify authentication
  const title = await browser.getTitle();
  console.log("Page title:", title);

  await browser.waitUntil(
    async () => {
      const currentTitle = await browser.getTitle();
      return !currentTitle.includes("Login");
    },
    {
      timeout: 30000,
      timeoutMsg: "Failed to authenticate into scratch org",
    }
  );
  console.log("Step 3: Authentication confirmed");
  await browser.refresh();
  await browser.pause(2000);

  // 6️⃣ Wait for Inspector button
  let attempts = 0;
  await browser.waitUntil(
    async () => {
      attempts++;
      const found = await browser.execute(() => !!document.querySelector('div.insext-btn[title*="Salesforce details"]'));

      if (!found && attempts % 5 === 0) {
        console.log(`Attempt ${attempts}: Still waiting for Inspector button...`);
      }

      return found;
    },
    {
      timeout: 20000,
      interval: 1000,
      timeoutMsg: "Salesforce Inspector Reloaded did not inject after 20 seconds",
    }
  );

  console.log("✅ Inspector button found!");
});
