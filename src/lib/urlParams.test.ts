import { describe, expect, it } from "vitest";
import { parseViewerUrlParams } from "./urlParams";

describe("parseViewerUrlParams", () => {
  it("applies defaults", () => {
    const parsed = parseViewerUrlParams("");

    expect(parsed).toEqual({
      modelUrl: null,
      shiftX: 0,
      shiftY: 0,
      fov: 50,
      near: 0.1,
      far: 100,
    });
  });

  it("parses and clamps values", () => {
    const parsed = parseViewerUrlParams("?shiftX=2&shiftY=-2&fov=200&near=0.0001&far=5000");

    expect(parsed.shiftX).toBe(1);
    expect(parsed.shiftY).toBe(-1);
    expect(parsed.fov).toBe(120);
    expect(parsed.near).toBe(0.01);
    expect(parsed.far).toBe(1000);
  });

  it("falls back on invalid numeric values", () => {
    const parsed = parseViewerUrlParams("?shiftX=hello&near=oops");

    expect(parsed.shiftX).toBe(0);
    expect(parsed.near).toBe(0.1);
  });
});