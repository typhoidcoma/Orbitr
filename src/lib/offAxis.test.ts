import { describe, expect, it } from "vitest";
import { computeOffAxisFrustum } from "./offAxis";

describe("computeOffAxisFrustum", () => {
  it("returns symmetric frustum when the viewer is centered on the screen", () => {
    const frustum = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 68,
      screenLeft: -26.5,
      screenRight: 26.5,
      screenBottom: -15,
      screenTop: 15,
      screenZ: 0,
    });

    expect(frustum.left).toBeCloseTo(-frustum.right, 8);
    expect(frustum.bottom).toBeCloseTo(-frustum.top, 8);
  });

  it("shifts the frustum left when the viewer moves right", () => {
    const baseline = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 68,
      screenLeft: -26.5,
      screenRight: 26.5,
      screenBottom: -15,
      screenTop: 15,
      screenZ: 0,
    });

    const shifted = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 10,
      eyeY: 0,
      eyeZ: 68,
      screenLeft: -26.5,
      screenRight: 26.5,
      screenBottom: -15,
      screenTop: 15,
      screenZ: 0,
    });

    expect(shifted.left).toBeLessThan(baseline.left);
    expect(shifted.right).toBeLessThan(baseline.right);
  });

  it("increases perspective strength as the viewer gets closer", () => {
    const farther = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 10,
      eyeY: 0,
      eyeZ: 100,
      screenLeft: -26.5,
      screenRight: 26.5,
      screenBottom: -15,
      screenTop: 15,
      screenZ: 0,
    });

    const closer = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 10,
      eyeY: 0,
      eyeZ: 50,
      screenLeft: -26.5,
      screenRight: 26.5,
      screenBottom: -15,
      screenTop: 15,
      screenZ: 0,
    });

    expect(Math.abs(closer.left)).toBeGreaterThan(Math.abs(farther.left));
    expect(Math.abs(closer.right)).toBeGreaterThan(Math.abs(farther.right));
  });

  it("treats a narrower centered sub-window as a smaller physical opening", () => {
    const full = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 68,
      screenLeft: -26.5,
      screenRight: 26.5,
      screenBottom: -15,
      screenTop: 15,
      screenZ: 0,
    });

    const subWindow = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 68,
      screenLeft: -13,
      screenRight: 13,
      screenBottom: -7.5,
      screenTop: 7.5,
      screenZ: 0,
    });

    expect(Math.abs(subWindow.left)).toBeLessThan(Math.abs(full.left));
    expect(Math.abs(subWindow.right)).toBeLessThan(Math.abs(full.right));
    expect(Math.abs(subWindow.top)).toBeLessThan(Math.abs(full.top));
  });

  it("treats an off-center sub-window as a shifted physical opening", () => {
    const centered = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 68,
      screenLeft: -13,
      screenRight: 13,
      screenBottom: -7.5,
      screenTop: 7.5,
      screenZ: 0,
    });

    const shifted = computeOffAxisFrustum({
      near: 1,
      far: 10000,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 68,
      screenLeft: 5,
      screenRight: 31,
      screenBottom: -7.5,
      screenTop: 7.5,
      screenZ: 0,
    });

    expect(shifted.left).toBeGreaterThan(centered.left);
    expect(shifted.right).toBeGreaterThan(centered.right);
  });
});
