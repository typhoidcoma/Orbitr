import { describe, expect, it } from "vitest";
import { computeOffAxisFrustum } from "./offAxis";

describe("computeOffAxisFrustum", () => {
  it("returns symmetric frustum when shifts are zero", () => {
    const frustum = computeOffAxisFrustum({
      fov: 50,
      aspect: 2,
      near: 0.1,
      far: 100,
      shiftX: 0,
      shiftY: 0,
    });

    expect(frustum.left).toBeCloseTo(-frustum.right, 8);
    expect(frustum.bottom).toBeCloseTo(-frustum.top, 8);
  });

  it("shifts both horizontal planes with shiftX", () => {
    const baseline = computeOffAxisFrustum({
      fov: 50,
      aspect: 1,
      near: 0.1,
      far: 100,
      shiftX: 0,
      shiftY: 0,
    });

    const shifted = computeOffAxisFrustum({
      fov: 50,
      aspect: 1,
      near: 0.1,
      far: 100,
      shiftX: 0.4,
      shiftY: 0,
    });

    expect(shifted.left).toBeGreaterThan(baseline.left);
    expect(shifted.right).toBeGreaterThan(baseline.right);
  });
});