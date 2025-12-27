const { execSync } = require('child_process');

let sessionId;
let instanceUrl;

before(async () => {
  try {
    const output = execSync(
      'sf org display --target-org TestOrg --json',
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          ...process.env,
          SF_USE_PROGRESS_BAR: 'false',
          SFDX_DISABLE_SPINNER: 'true',
          FORCE_COLOR: '0',
        },
      }
    );

    const jsonStart = output.search(/\{\s*"status"\s*:/);
    const jsonEnd = output.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error('RAW OUTPUT:\n', output);
      throw new Error('Could not locate valid JSON block');
    }

    const jsonString = output.slice(jsonStart, jsonEnd + 1);
    const result = JSON.parse(jsonString);

    sessionId = result.result.accessToken;
    instanceUrl = result.result.instanceUrl;

    console.log('Session ID:', sessionId.slice(0, 15) + '...');
    console.log('Instance URL:', instanceUrl);
  } catch (err) {
    console.error('Failed to get org details:', err);
    throw err;
  }
});

it('should inject content scripts on a Salesforce scratch org', async () => {
  const { hostname } = new URL(instanceUrl);

  // 1️⃣ Navigate to the scratch org domain
  await browser.url(`https://${hostname}`);

  // 2️⃣ Set Salesforce session cookie
  await browser.setCookies([
    {
      name: 'sid',
      value: sessionId,
      domain: `.${hostname}`,
      path: '/',
      secure: true,
      httpOnly: true,
    },
  ]);

  // 3️⃣ Go to a Lightning page (content scripts inject here)
  await browser.url(`${instanceUrl}/lightning/page/home`);

  // 4️⃣ Make sure we're not redirected to login
  await browser.waitUntil(
    async () => !(await browser.getTitle()).includes('Login'),
    {
      timeout: 30000,
      timeoutMsg: 'Failed to authenticate into scratch org',
    }
  );

  // 5️⃣ ASSERT: Inspector Reloaded injected
  await browser.waitUntil(
    async () =>
      await browser.execute(() =>
        !!document.querySelector('button[data-inspector-button]')
      ),
    {
      timeout: 20000,
      timeoutMsg: 'Salesforce Inspector Reloaded did not inject',
    }
  );
  
});

