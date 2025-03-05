/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:@typescript-eslint/stylistic",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/jsx-runtime",
    "plugin:import-x/recommended",
    "plugin:import-x/electron",
    "plugin:import-x/typescript",
    "plugin:eslint-comments/recommended",
  ],
  settings: {
    "import-x/resolver": {
      typescript: true,
      node: true,
    },
    react: {
      version: "detect",
    },
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.base.json", "./tsconfig.forge.json"],
    tsconfigRootDir: __dirname,
  },
  plugins: ["eslint-comments", "@typescript-eslint"],
  rules: {
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/ban-ts-comment": [
      "error",
      { "ts-expect-error": "allow-with-description" },
    ],
    "@typescript-eslint/consistent-type-definitions": "off",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
      },
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        checksVoidReturn: {
          attributes: false,
        },
      },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      {
        allowExpressions: true,
      },
    ],
    "react/jsx-sort-props": [
      "error",
      {
        reservedFirst: ["key", "dangerouslySetInnerHTML", "ref"],
      },
    ],
    "react/prop-types": "off",
    "import-x/no-unresolved": "error",
    "import-x/no-default-export": "error",
    "import-x/order": "error",
    "import-x/no-named-as-default": "off",
    "eslint-comments/require-description": "error",
    "object-shorthand": "warn",
    "no-console": ["error", { allow: ["info", "error", "warn"] }],
  },
  overrides: [
    {
      files: ["*.config.ts"],
      rules: {
        "import-x/no-default-export": "off",
      },
    },
  ],
  ignorePatterns: [".eslintrc.cjs"],
};
