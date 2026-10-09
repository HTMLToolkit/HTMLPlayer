const base = require("./jest.config.cjs");

module.exports = {
  ...base,
  roots: ["<rootDir>/tests/integration"],
  extensionsToTreatAsEsm: [".ts"],
  testPathIgnorePatterns: ["/node_modules/"],
  moduleNameMapper: Object.fromEntries(
    Object.entries(base.moduleNameMapper).filter(
      ([pattern]) => pattern !== "StreamingDecoderBackend$",
    ),
  ),
};
