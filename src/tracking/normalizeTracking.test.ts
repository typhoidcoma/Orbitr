import { describe, expect, it } from "vitest";
import { DEFAULT_PARALLAX_CALIBRATION } from "../lib/parallaxConfig";
import {
  createNeutralPose,
  normalizeTrackingObservation,
  type RawTrackingObservation,
} from "./normalizeTracking";

function observation(overrides: Partial<RawTrackingObservation> = {}): RawTrackingObservation {
  return {
    headCenterX: 0.5,
    headCenterY: 0.45,
    eyeSeparation: 0.12,
    faceWidth: 0.34,
    faceScale: 0.197,
    gazeX: 0,
    gazeY: 0,
    yaw: 0,
    pitch: 0,
    confidence: 1,
    ...overrides,
  };
}

describe("normalizeTrackingObservation", () => {
  it("maps the neutral observation close to zero offsets", () => {
    const baseline = observation();
    const neutral = createNeutralPose(baseline, null);

    const pose = normalizeTrackingObservation(
      baseline,
      neutral,
      DEFAULT_PARALLAX_CALIBRATION
    );

    expect(pose.eyeX).toBeCloseTo(DEFAULT_PARALLAX_CALIBRATION.cameraOffsetX, 6);
    expect(pose.eyeY).toBeCloseTo(DEFAULT_PARALLAX_CALIBRATION.cameraOffsetY, 6);
    expect(pose.eyeZ).toBeCloseTo(
      DEFAULT_PARALLAX_CALIBRATION.neutralDistance + DEFAULT_PARALLAX_CALIBRATION.cameraOffsetZ,
      6
    );
  });

  it("treats a larger face scale as moving closer to the screen", () => {
    const neutral = createNeutralPose(observation({ faceScale: 0.197 }), null);

    const closer = normalizeTrackingObservation(
      observation({ eyeSeparation: 0.14, faceWidth: 0.38, faceScale: 0.224 }),
      neutral,
      DEFAULT_PARALLAX_CALIBRATION
    );

    expect(closer.eyeZ).toBeLessThan(
      DEFAULT_PARALLAX_CALIBRATION.neutralDistance + DEFAULT_PARALLAX_CALIBRATION.cameraOffsetZ
    );
    expect(closer.debug.estimatedDistance).toBeLessThan(DEFAULT_PARALLAX_CALIBRATION.neutralDistance);
  });

  it("keeps eye refinement bounded compared with the main head translation", () => {
    const calibration = {
      ...DEFAULT_PARALLAX_CALIBRATION,
      eyeRefinementGain: 0.035,
      gainX: 2.2,
    };
    const neutral = createNeutralPose(observation(), null);

    const pose = normalizeTrackingObservation(
      observation({ headCenterX: 0.55, gazeX: 1 }),
      neutral,
      calibration
    );

    expect(pose.eyeX).toBeCloseTo(-0.145, 3);
    expect(Math.abs(pose.eyeX)).toBeLessThan(0.2);
  });

  it("maps a face moving left in camera space to a viewer moving right", () => {
    const neutral = createNeutralPose(observation({ headCenterX: 0.5 }), null);

    const pose = normalizeTrackingObservation(
      observation({ headCenterX: 0.45 }),
      neutral,
      DEFAULT_PARALLAX_CALIBRATION
    );

    expect(pose.eyeX).toBeGreaterThan(DEFAULT_PARALLAX_CALIBRATION.cameraOffsetX);
  });
});
