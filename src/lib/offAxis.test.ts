import { describe, expect, it } from "vitest";
import { computeOffAxisFrustum } from "./offAxis";

describe("computeOffAxisFrustum", () => {
  it("returns symmetric frustum when the viewer is centered on the screen", () => {
    const frustum = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenLeft: -0.6,
      screenRight: 0.6,
      screenBottom: -0.3,
      screenTop: 0.3,
      screenZ: 0,
    });

    expect(frustum.left).toBeCloseTo(-frustum.right, 8);
    expect(frustum.bottom).toBeCloseTo(-frustum.top, 8);
  });

  it("shifts the frustum left when the viewer moves right", () => {
    const baseline = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenLeft: -0.6,
      screenRight: 0.6,
      screenBottom: -0.3,
      screenTop: 0.3,
      screenZ: 0,
    });

    const shifted = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0.2,
      eyeY: 0,
      eyeZ: 1,
      screenLeft: -0.6,
      screenRight: 0.6,
      screenBottom: -0.3,
      screenTop: 0.3,
      screenZ: 0,
    });

    expect(shifted.left).toBeLessThan(baseline.left);
    expect(shifted.right).toBeLessThan(baseline.right);
  });

  it("increases perspective strength as the viewer gets closer", () => {
    const farther = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0.15,
      eyeY: 0,
      eyeZ: 1.4,
      screenLeft: -0.6,
      screenRight: 0.6,
      screenBottom: -0.3,
      screenTop: 0.3,
      screenZ: 0,
    });

    const closer = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0.15,
      eyeY: 0,
      eyeZ: 0.8,
      screenLeft: -0.6,
      screenRight: 0.6,
      screenBottom: -0.3,
      screenTop: 0.3,
      screenZ: 0,
    });

    expect(Math.abs(closer.left)).toBeGreaterThan(Math.abs(farther.left));
    expect(Math.abs(closer.right)).toBeGreaterThan(Math.abs(farther.right));
  });

  it("treats a narrower centered sub-window as a smaller physical opening", () => {
    const full = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenLeft: -0.6,
      screenRight: 0.6,
      screenBottom: -0.3,
      screenTop: 0.3,
      screenZ: 0,
    });

    const subWindow = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenLeft: -0.3,
      screenRight: 0.3,
      screenBottom: -0.15,
      screenTop: 0.15,
      screenZ: 0,
    });

    expect(Math.abs(subWindow.left)).toBeLessThan(Math.abs(full.left));
    expect(Math.abs(subWindow.right)).toBeLessThan(Math.abs(full.right));
    expect(Math.abs(subWindow.top)).toBeLessThan(Math.abs(full.top));
  });

  it("treats an off-center sub-window as a shifted physical opening", () => {
    const centered = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenLeft: -0.3,
      screenRight: 0.3,
      screenBottom: -0.15,
      screenTop: 0.15,
      screenZ: 0,
    });

    const shifted = computeOffAxisFrustum({
      near: 0.1,
      far: 100,
      eyeX: 0,
      eyeY: 0,
      eyeZ: 1,
      screenLeft: 0.1,
      screenRight: 0.7,
      screenBottom: -0.15,
      screenTop: 0.15,
      screenZ: 0,
    });

    expect(shifted.left).toBeGreaterThan(centered.left);
    expect(shifted.right).toBeGreaterThan(centered.right);
  });
});
