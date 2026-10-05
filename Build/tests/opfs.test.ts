import { describe, it, expect, afterEach } from "@jest/globals";
import { opfsAvailability } from "../src/platform/storage/opfs";

const originalNavigator = globalThis.navigator;

const withNavigator = (
  userAgent: string,
  secureContext: boolean,
  hasGetDirectory: boolean,
) => {
  Object.defineProperty(globalThis, "isSecureContext", {
    value: secureContext,
    configurable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: {
      userAgent,
      storage: hasGetDirectory ? { getDirectory: () => {} } : {},
    },
    configurable: true,
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
  });
});

describe("opfsAvailability", () => {
  it("reports available on a secure context with the API present", () => {
    withNavigator("Mozilla/5.0 Version/27.0 Safari/605.1.15", true, true);
    expect(opfsAvailability()).toEqual({ available: true });
  });

  it("blames the insecure context rather than the browser", () => {
    withNavigator("Mozilla/5.0 Version/27.0 Safari/605.1.15", false, false);
    const availability = opfsAvailability();
    expect(availability.available).toBe(false);
    if (availability.available) return;
    expect(availability.reason).toBe("insecure-context");
    expect(availability.message).toMatch(/localhost|HTTPS/i);
  });

  it("blames the browser on a secure context without the API", () => {
    withNavigator("Mozilla/5.0 Chrome/154.0.0.0", true, false);
    const availability = opfsAvailability();
    expect(availability.available).toBe(false);
    if (availability.available) return;
    expect(availability.reason).toBe("unsupported");
  });
});