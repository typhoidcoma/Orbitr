import { applyDeadzone } from "../lib/smoothing";
import type { ParallaxCalibration } from "../lib/parallaxConfig";

export interface RawTrackingObservation {
  headCenterX: number;
  headCenterY: number;
  eyeSeparation: number;
  faceWidth: number;
  faceHeight: number;
  faceScale: number;
  gazeX: number;
  gazeY: number;
  yaw: number;
  pitch: number;
  confidence: number;
  detectionConfidence: number;
  presenceConfidence: number;
  trackingConfidence: number;
}

export interface TrackingNeutralPose {
  headCenterX: number;
  headCenterY: number;
  faceScale: number;
}

export interface ViewerPose {
  eyeX: number;
  eyeY: number;
  eyeZ: number;
  yaw: number;
  pitch: number;
  confidence: number;
  debug: {
    headCenterX: number;
    headCenterY: number;
    eyeSeparation: number;
    faceWidth: number;
    faceHeight: number;
    faceScale: number;
    estimatedDistance: number;
    headOffsetX: number;
    headOffsetY: number;
    gazeX: number;
    gazeY: number;
    detectionConfidence: number;
    presenceConfidence: number;
    trackingConfidence: number;
  };
}

export interface StabilityAssessment {
  isValid: boolean;
  isStableForNeutralCapture: boolean;
}

export function createNeutralPose(
  observation: RawTrackingObservation,
  current: TrackingNeutralPose | null
): TrackingNeutralPose {
  return {
    headCenterX: observation.headCenterX,
    headCenterY: observation.headCenterY,
    faceScale: current?.faceScale ?? observation.faceScale,
  };
}

export function normalizeTrackingObservation(
  observation: RawTrackingObservation,
  neutral: TrackingNeutralPose,
  calibration: ParallaxCalibration
): ViewerPose {
  const estimatedDistance = computeEstimatedDistance(observation.faceScale, neutral, calibration);
  const headOffsetX = (neutral.headCenterX - observation.headCenterX) * calibration.gainX;
  const headOffsetY = (neutral.headCenterY - observation.headCenterY) * calibration.gainY;
  const gazeOffsetX = -observation.gazeX * calibration.eyeRefinementGain;
  const gazeOffsetY = -observation.gazeY * calibration.eyeRefinementGain;

  const eyeX = applyDeadzone(
    calibration.screenOffsetX + calibration.cameraOffsetX + headOffsetX + gazeOffsetX,
    0.0005
  );
  const eyeY = applyDeadzone(
    calibration.screenOffsetY + calibration.cameraOffsetY + headOffsetY + gazeOffsetY,
    0.0005
  );
  const eyeZ = Math.max(
    calibration.screenOffsetZ + 0.05,
    estimatedDistance + calibration.cameraOffsetZ
  );

  return {
    eyeX,
    eyeY,
    eyeZ,
    yaw: observation.yaw,
    pitch: observation.pitch,
    confidence: observation.confidence,
    debug: {
      headCenterX: observation.headCenterX,
      headCenterY: observation.headCenterY,
      eyeSeparation: observation.eyeSeparation,
      faceWidth: observation.faceWidth,
      faceHeight: observation.faceHeight,
      faceScale: observation.faceScale,
      estimatedDistance,
      headOffsetX,
      headOffsetY,
      gazeX: observation.gazeX,
      gazeY: observation.gazeY,
      detectionConfidence: observation.detectionConfidence,
      presenceConfidence: observation.presenceConfidence,
      trackingConfidence: observation.trackingConfidence,
    },
  };
}

export function assessTrackingObservation(
  observation: RawTrackingObservation,
  neutral: TrackingNeutralPose | null,
  calibration: ParallaxCalibration
): StabilityAssessment {
  const isValid =
    observation.detectionConfidence >= calibration.minFaceDetectionConfidence &&
    observation.presenceConfidence >= calibration.minFacePresenceConfidence &&
    observation.trackingConfidence >= calibration.minTrackingConfidence;

  if (!isValid || !neutral) {
    return {
      isValid,
      isStableForNeutralCapture: false,
    };
  }

  const headOffsetX = Math.abs(observation.headCenterX - neutral.headCenterX);
  const headOffsetY = Math.abs(observation.headCenterY - neutral.headCenterY);
  const scaleDelta = Math.abs(observation.faceScale - neutral.faceScale);

  return {
    isValid,
    isStableForNeutralCapture:
      headOffsetX <= calibration.neutralCaptureMaxOffset &&
      headOffsetY <= calibration.neutralCaptureMaxOffset &&
      scaleDelta <= calibration.neutralCaptureMaxScaleDelta,
  };
}

function computeEstimatedDistance(
  faceScale: number,
  neutral: TrackingNeutralPose,
  calibration: ParallaxCalibration
): number {
  const safeScale = Math.max(faceScale, 0.0001);
  const safeNeutralScale = Math.max(neutral.faceScale, 0.0001);
  return calibration.neutralDistance * (safeNeutralScale / safeScale);
}
