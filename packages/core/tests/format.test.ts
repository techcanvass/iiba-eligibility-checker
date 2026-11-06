import { describe, expect, it } from "vitest";
import { formatNumber } from "../src";

describe("formatNumber (Intl-free, identical on every runtime)", () => {
  it.each([0, 7, 999, 1000, 3750, 12345, 100000, 1234567, 99999999, -2500, 2499.6])(
    "%s matches en-IN grouping",
    (n) => {
      expect(formatNumber(n)).toBe(Math.round(n).toLocaleString("en-IN"));
    },
  );
});
