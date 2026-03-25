import { describe, expect, it } from "vitest";
import { getModelBaseAnchor, type EffectiveScreenRect } from "./viewer";

describe("getModelBaseAnchor", () => {
  it("anchors loaded models at the exact screen-plane center", () => {
    const screen: EffectiveScreenRect = {
      width: 0.42,
      height: 0.24,
      centerX: 0.08,
      centerY: -0.03,
      left: -0.13,
      right: 0.29,
      top: 0.09,
      bottom: -0.15,
      z: 0.02,
    };

    expect(getModelBaseAnchor(screen)).toEqual({
      x: screen.centerX,
      y: screen.centerY,
      z: screen.z,
    });
  });
});
