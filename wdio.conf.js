require("dotenv").config();
const path = require("path");

const extensionPath = path.resolve(__dirname, "addon"); // Absolute path to your extension folder

/* eslint-disable strict */
exports.config = {
  runner: "local",

  specs: [
    "./test/**/*.test.js"
  ],

  exclude: [],

  maxInstances: 1,

  capabilities: [{
    browserName: "chrome",
    "goog:chromeOptions": {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-sandbox",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-dev-shm-usage"
      ]
    }
  }],

  framework: "mocha",

  mochaOpts: {
    ui: "bdd",
    timeout: 120000
  },

  reporters: ["spec"],

  logLevel: "info",

  bail: 0,

  baseUrl: "http://localhost",

  waitforTimeout: 10000,

  connectionRetryTimeout: 120000,

  connectionRetryCount: 3,

};
