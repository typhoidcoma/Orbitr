import { describe, expect, it } from "vitest";
import { DEFAULT_PARALLAX_CALIBRATION } from "../lib/parallaxConfig";
import {
  assessTrackingObservation,
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
    faceHeight: 0.29,
    faceScale: 0.247,
    gazeX: 0,
    gazeY: 0,
    yaw: 0,
    pitch: 0,
    confidence: 1,
    detectionConfidence: 0.9,
    presenceConfidence: 0.9,
    trackingConfidence: 0.9,
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
    const neutral = createNeutralPose(observation({ faceScale: 0.247 }), null);

    const closer = normalizeTrackingObservation(
      observation({
        eyeSeparation: 0.14,
        faceWidth: 0.38,
        faceHeight: 0.32,
        faceScale: 0.286,
      }),
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

  it("marks low-confidence observations invalid", () => {
    const neutral = createNeutralPose(observation(), null);
    const assessment = assessTrackingObservation(
      observation({
        detectionConfidence: 0.4,
        presenceConfidence: 0.4,
        trackingConfidence: 0.4,
      }),
      neutral,
      DEFAULT_PARALLAX_CALIBRATION
    );

    expect(assessment.isValid).toBe(false);
    expect(assessment.isStableForNeutralCapture).toBe(false);
  });

  it("allows neutral capture only for stable observations", () => {
    const neutral = createNeutralPose(observation(), null);
    const stable = assessTrackingObservation(observation(), neutral, DEFAULT_PARALLAX_CALIBRATION);
    const unstable = assessTrackingObservation(
      observation({
        headCenterX: 0.6,
      }),
      neutral,
      DEFAULT_PARALLAX_CALIBRATION
    );

    expect(stable.isStableForNeutralCapture).toBe(true);
    expect(unstable.isStableForNeutralCapture).toBe(false);
  });
});
