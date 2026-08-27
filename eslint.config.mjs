import globals from "globals";
import pluginJs from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";

export default [
  // Global ignores. This MUST stay a standalone object: an `ignores` key placed
  // alongside `rules` or `languageOptions` only scopes that single config block,
  // so the files would still be linted by every other block.
  {
    ignores: [
      "addon/lib/**",
      "addon/styles/**",
      "addon/react.js",
      "addon/react.min.js",
      "addon/react-dom.js",
      "addon/react-dom.min.js",
      "venv/**",
      "docs/venv/**",
      "target/**",
      "megalinter-reports/**"
    ]
  },
  pluginJs.configs.recommended,
  eslintReact.configs.recommended,
  {
    rules: {
      // A leading underscore marks a deliberately unused positional argument,
      // e.g. (_, index) => ... where the position still matters.
      "no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      // addon/react.js bundles React 15.4.0, which has no createRoot API:
      // ReactDOM.render is the only way to mount here.
      "@eslint-react/dom-no-render": "off"
    }
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        chrome: "readonly",
        browser: "readonly",
        ...globals.browser
      }
    },
    rules: {
      "indent": ["error", 2, {"SwitchCase": 1, "flatTernaryExpressions": true}],
      "quotes": ["error", "double", {"avoidEscape": true}],
      "semi": ["error", "always"],
      "strict": ["error", "global"],
      "consistent-return": "error",
      "curly": ["error", "multi-line"],
      "dot-location": ["error", "property"],
      "no-multi-spaces": "error",
      "array-bracket-spacing": "error",
      "block-spacing": "error",
      "brace-style": ["error", "1tbs", {"allowSingleLine": true}],
      // Properties are excluded: OAuth token params (grant_type, client_id...) are an
      // external API contract and must keep their snake_case names.
      "camelcase": ["error", {"properties": "never"}],
      "comma-dangle": ["error", "only-multiline"],
      "comma-spacing": "error",
      "comma-style": "error",
      "computed-property-spacing": "error",
      "consistent-this": ["error", "self"],
      "eol-last": "error",
      "func-call-spacing": "error",
      "key-spacing": "error",
      "keyword-spacing": "error",
      "new-cap": "error",
      "no-array-constructor": "error",
      "no-lonely-if": "error",
      "no-mixed-operators": "error",
      "no-new-object": "error",
      "no-tabs": "error",
      "no-trailing-spaces": "error",
      "no-whitespace-before-property": "error",
      "object-curly-spacing": "error",
      "object-property-newline": ["error", {"allowMultiplePropertiesPerLine": true}],
      "one-var-declaration-per-line": "error",
      "operator-linebreak": ["error", "before"],
      "semi-spacing": "error",
      "space-before-function-paren": ["error", {
        "anonymous": "never",
        "named": "never",
        "asyncArrow": "always"
      }],
      "space-in-parens": "error",
      "space-infix-ops": "error",
      "space-unary-ops": "error",
      "unicode-bom": "error",
      "arrow-body-style": "error",
      "arrow-spacing": "error",
      "no-useless-computed-key": "error",
      "no-useless-constructor": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": ["error", {"allowNamedFunctions": true}],
      "prefer-numeric-literals": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "rest-spread-spacing": "error",
      "symbol-description": "error",
      "template-curly-spacing": "error",
      "yield-star-spacing": "error"
    }
  },
  // Node.js configuration for build scripts and the Playwright test harness
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "strict": ["error", "safe"]
    }
  },
  {
    files: ["tests/**/*.js", "playwright.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        // Injected into the page by the event-monitor e2e fixtures
        addTestEvent: "readonly"
      }
    },
    rules: {
      "strict": "off",
      // Playwright fixtures take a parameter named `use`, which the plugin
      // mistakes for the React `use` hook. There is no React in tests/.
      "@eslint-react/rules-of-hooks": "off"
    }
  },
  {
    files: ["docs/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        mermaid: "readonly"
      }
    }
  }
];
