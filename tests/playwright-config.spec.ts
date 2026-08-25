import { expect, test } from "@playwright/test";
import { parsePlaywrightPort } from "../playwright-port";

test.describe("Playwright preview configuration", () => {
  test("rejects non-numeric port text before it can reach the preview command", () => {
    expect(() => parsePlaywrightPort("4173; touch /tmp/pwned")).toThrow(
      "PLAYWRIGHT_PORT must be an integer between 1 and 65535",
    );
  });

  test("accepts a bounded numeric port and falls back when unset", () => {
    expect(parsePlaywrightPort(undefined)).toBe(4173);
    expect(parsePlaywrightPort("49152")).toBe(49152);
    expect(() => parsePlaywrightPort("65536")).toThrow(
      "PLAYWRIGHT_PORT must be an integer between 1 and 65535",
    );
  });
});
