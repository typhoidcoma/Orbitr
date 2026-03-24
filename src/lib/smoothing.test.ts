import { describe, expect, it } from "vitest";
import { applyDeadzone, smoothValue, smoothVec2 } from "./smoothing";

describe("smoothing helpers", () => {
  it("smoothValue interpolates between values", () => {
    expect(smoothValue(0, 10, 0.25)).toBe(2.5);
  });

  it("applyDeadzone zeroes small values", () => {
    expect(applyDeadzone(0.02, 0.03)).toBe(0);
    expect(applyDeadzone(0.1, 0.03)).toBe(0.1);
  });

  it("smoothVec2 smooths each component", () => {
    expect(smoothVec2({ x: 0, y: 1 }, { x: 1, y: 0 }, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
});