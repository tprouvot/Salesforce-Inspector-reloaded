import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import {fixupConfigRules} from "@eslint/compat";


export default [
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
    settings: {
      react: {
        version: "detect"
      },
    },
    ignores: [
      "addon/react-dom.js",
      "addon/react-dom.min.js",
      "addon/react.js",
      "addon/react.min.js",
      "venv/*",
      "docs/venv/*",
      "target/"
    ],
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
      "camelcase": "error",
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
      "no-underscore-dangle": ["error", {"allowAfterThis": true, "allowAfterSuper": true}],
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
  pluginJs.configs.recommended,
  ...fixupConfigRules(pluginReactConfig),
];
