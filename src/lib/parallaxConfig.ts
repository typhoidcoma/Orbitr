export type MonitorPreset = "24_desktop" | "27_desktop" | "14_laptop" | "custom";

export interface ModelTransform {
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
}

export interface ParallaxCalibration {
  monitorPreset: MonitorPreset;
  screenWidth: number;
  screenHeight: number;
  neutralDistance: number;
  gainX: number;
  gainY: number;
  gainZ: number;
  eyeRefinementGain: number;
  screenOffsetX: number;
  screenOffsetY: number;
  screenOffsetZ: number;
  cameraOffsetX: number;
  cameraOffsetY: number;
  cameraOffsetZ: number;
  smoothing: number;
  headSmoothing: number;
  depthSmoothing: number;
  gazeSmoothing: number;
  minFaceDetectionConfidence: number;
  minFacePresenceConfidence: number;
  minTrackingConfidence: number;
  maxEyeDeltaX: number;
  maxEyeDeltaY: number;
  maxEyeDeltaZ: number;
  neutralCaptureStableFrames: number;
  neutralCaptureMaxOffset: number;
  neutralCaptureMaxScaleDelta: number;
  showDebug: boolean;
  showPresentationRoom: boolean;
  showWireframeRoom: boolean;
  showScreenFrame: boolean;
  showFacePreview: boolean;
  calibrationComplete: boolean;
}

export interface PersistedViewerState {
  calibration: ParallaxCalibration;
  modelTransform: ModelTransform;
}

export const MONITOR_PRESETS: Record<
  Exclude<MonitorPreset, "custom">,
  Pick<ParallaxCalibration, "screenWidth" | "screenHeight" | "neutralDistance">
> = {
  "24_desktop": {
    screenWidth: 0.531,
    screenHeight: 0.299,
    neutralDistance: 0.68,
  },
  "27_desktop": {
    screenWidth: 0.598,
    screenHeight: 0.336,
    neutralDistance: 0.74,
  },
  "14_laptop": {
    screenWidth: 0.31,
    screenHeight: 0.174,
    neutralDistance: 0.52,
  },
};

export const DEFAULT_MODEL_TRANSFORM: ModelTransform = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
};

export const DEFAULT_PARALLAX_CALIBRATION: ParallaxCalibration = {
  monitorPreset: "24_desktop",
  ...MONITOR_PRESETS["24_desktop"],
  gainX: 0.82,
  gainY: 0.62,
  gainZ: 1,
  eyeRefinementGain: 0.008,
  screenOffsetX: 0,
  screenOffsetY: 0,
  screenOffsetZ: 0,
  cameraOffsetX: 0,
  cameraOffsetY: 0.08,
  cameraOffsetZ: 0.035,
  smoothing: 0.2,
  headSmoothing: 0.18,
  depthSmoothing: 0.24,
  gazeSmoothing: 0.34,
  minFaceDetectionConfidence: 0.72,
  minFacePresenceConfidence: 0.72,
  minTrackingConfidence: 0.72,
  maxEyeDeltaX: 0.05,
  maxEyeDeltaY: 0.05,
  maxEyeDeltaZ: 0.07,
  neutralCaptureStableFrames: 12,
  neutralCaptureMaxOffset: 0.012,
  neutralCaptureMaxScaleDelta: 0.01,
  showDebug: false,
  showPresentationRoom: true,
  showWireframeRoom: true,
  showScreenFrame: true,
  showFacePreview: false,
  calibrationComplete: false,
};

export function applyMonitorPreset(
  calibration: ParallaxCalibration,
  preset: MonitorPreset
): ParallaxCalibration {
  if (preset === "custom") {
    return {
      ...calibration,
      monitorPreset: preset,
    };
  }

  return {
    ...calibration,
    monitorPreset: preset,
    ...MONITOR_PRESETS[preset],
  };
}

export function createDefaultViewerState(): PersistedViewerState {
  return {
    calibration: { ...DEFAULT_PARALLAX_CALIBRATION },
    modelTransform: { ...DEFAULT_MODEL_TRANSFORM },
  };
}
