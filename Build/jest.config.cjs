module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@platform/(.*)$": "<rootDir>/src/platform/$1",
  },
  setupFiles: ["<rootDir>/tests/__mocks__/browser.ts"],
  collectCoverageFrom: [
    "src/core/engine/**/*.ts",
    "src/platform/audio/**/*.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "json", "html"],
  verbose: true,
};
