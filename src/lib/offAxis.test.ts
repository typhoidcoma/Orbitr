import { describe, expect, it } from "vitest";
import { computeOffAxisFrustum } from "./offAxis";

describe("computeOffAxisFrustum", () => {
  it("returns symmetric frustum when the viewer is centered on the screen", () => {
    const frustum = computeOffAxisFrustum({
      screenWidth: 1.2,
      screenHeight: 0.6,
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenOffsetX: 0,
      screenOffsetY: 0,
      screenOffsetZ: 0,
    });

    expect(frustum.left).toBeCloseTo(-frustum.right, 8);
    expect(frustum.bottom).toBeCloseTo(-frustum.top, 8);
  });

  it("shifts the frustum left when the viewer moves right", () => {
    const baseline = computeOffAxisFrustum({
      screenWidth: 1.2,
      screenHeight: 0.6,
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenOffsetX: 0,
      screenOffsetY: 0,
      screenOffsetZ: 0,
    });

    const shifted = computeOffAxisFrustum({
      screenWidth: 1.2,
      screenHeight: 0.6,
      near: 0.1,
      far: 100,
      eyeX: 0.2,
      eyeY: 0,
      eyeZ: 1,
      screenOffsetX: 0,
      screenOffsetY: 0,
      screenOffsetZ: 0,
    });

    expect(shifted.left).toBeLessThan(baseline.left);
    expect(shifted.right).toBeLessThan(baseline.right);
  });

  it("increases perspective strength as the viewer gets closer", () => {
    const farther = computeOffAxisFrustum({
      screenWidth: 1.2,
      screenHeight: 0.6,
      near: 0.1,
      far: 100,
      eyeX: 0.15,
      eyeY: 0,
      eyeZ: 1.4,
      screenOffsetX: 0,
      screenOffsetY: 0,
      screenOffsetZ: 0,
    });

    const closer = computeOffAxisFrustum({
      screenWidth: 1.2,
      screenHeight: 0.6,
      near: 0.1,
      far: 100,
      eyeX: 0.15,
      eyeY: 0,
      eyeZ: 0.8,
      screenOffsetX: 0,
      screenOffsetY: 0,
      screenOffsetZ: 0,
    });

    expect(Math.abs(closer.left)).toBeGreaterThan(Math.abs(farther.left));
    expect(Math.abs(closer.right)).toBeGreaterThan(Math.abs(farther.right));
  });
});
