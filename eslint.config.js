import js from "@eslint/js";

const nodeGlobals = {
  require: "readonly",
  module: "readonly",
  exports: "readonly",
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  console: "readonly",
};

const jestGlobals = {
  expect: "readonly",
  test: "readonly",
  it: "readonly",
  describe: "readonly",
  jest: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
};

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules: {
      "no-console": "warn",
      complexity: ["error", 5],
      "max-lines-per-function": ["error", 40],
      "max-lines": ["error", 100],
      "max-statements": ["error", 12],
      "max-params": ["error", 5],
      "no-duplicate-case": "error",
      "no-lone-blocks": "error",
      "no-empty-function": "error",
    },
  },
  {
    files: ["benchmarks/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: nodeGlobals },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...nodeGlobals, ...jestGlobals },
    },
  },
];
