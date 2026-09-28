module.exports = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@platform/(.*)$": "<rootDir>/src/platform/$1",
    "^.*/platform/visualizers$": "<rootDir>/tests/mocks/platformVisualizers.ts",
    "^@audiflo/libflo$": "<rootDir>/tests/mocks/audifloLibflo.ts",
    "StreamingDecoderBackend$": "<rootDir>/tests/mocks/streamingDecoderBackend.ts",
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
