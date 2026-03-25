import {
  createDefaultViewerState,
  applyMonitorPreset,
  type MonitorPreset,
  type ParallaxCalibration,
  type ModelTransform,
  type PersistedViewerState,
} from "./parallaxConfig";

export interface ViewerUrlParams {
  modelUrl: string | null;
  near: number;
  far: number;
  calibration: ParallaxCalibration;
  modelTransform: ModelTransform;
}

function parseFiniteNumber(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function parseMonitorPreset(raw: string | null, fallback: MonitorPreset): MonitorPreset {
  if (raw === "24_desktop" || raw === "27_desktop" || raw === "14_laptop" || raw === "custom") {
    return raw;
  }

  return fallback;
}

export function parseViewerUrlParams(
  search: string,
  baseState: PersistedViewerState = createDefaultViewerState()
): ViewerUrlParams {
  const params = new URLSearchParams(search);
  const preset = parseMonitorPreset(params.get("monitorPreset"), baseState.calibration.monitorPreset);
  const presetBase = applyMonitorPreset(baseState.calibration, preset);

  const calibration: ParallaxCalibration = {
    ...presetBase,
    screenWidth: parseFiniteNumber(params.get("screenWidth"), presetBase.screenWidth, 0.18, 1.4),
    screenHeight: parseFiniteNumber(params.get("screenHeight"), presetBase.screenHeight, 0.1, 0.9),
    neutralDistance: parseFiniteNumber(
      params.get("neutralDistance"),
      presetBase.neutralDistance,
      0.25,
      1.8
    ),
    gainX: parseFiniteNumber(params.get("gainX"), presetBase.gainX, -3, 3),
    gainY: parseFiniteNumber(params.get("gainY"), presetBase.gainY, -3, 3),
    gainZ: parseFiniteNumber(params.get("gainZ"), presetBase.gainZ, -3, 3),
    eyeRefinementGain: parseFiniteNumber(
      params.get("eyeRefinementGain"),
      presetBase.eyeRefinementGain,
      -0.2,
      0.2
    ),
    screenOffsetX: parseFiniteNumber(params.get("screenOffsetX"), presetBase.screenOffsetX, -1, 1),
    screenOffsetY: parseFiniteNumber(params.get("screenOffsetY"), presetBase.screenOffsetY, -1, 1),
    screenOffsetZ: parseFiniteNumber(params.get("screenOffsetZ"), presetBase.screenOffsetZ, -1, 1),
    cameraOffsetX: parseFiniteNumber(params.get("cameraOffsetX"), presetBase.cameraOffsetX, -0.5, 0.5),
    cameraOffsetY: parseFiniteNumber(params.get("cameraOffsetY"), presetBase.cameraOffsetY, -0.5, 0.5),
    cameraOffsetZ: parseFiniteNumber(params.get("cameraOffsetZ"), presetBase.cameraOffsetZ, -0.5, 0.5),
    smoothing: parseFiniteNumber(params.get("smoothing"), presetBase.smoothing, 0, 1),
    movementScale: parseFiniteNumber(params.get("movementScale"), presetBase.movementScale, 0.5, 2),
    showDebug: params.get("debug") === null ? presetBase.showDebug : params.get("debug") === "1",
    showPresentationRoom:
      params.get("presentationRoom") === null
        ? presetBase.showPresentationRoom
        : params.get("presentationRoom") === "1",
    showWireframeRoom:
      params.get("wireframeRoom") === null
        ? presetBase.showWireframeRoom
        : params.get("wireframeRoom") === "1",
    showScreenFrame:
      params.get("screenFrame") === null
        ? presetBase.showScreenFrame
        : params.get("screenFrame") === "1",
    showFacePreview:
      params.get("facePreview") === null
        ? presetBase.showFacePreview
        : params.get("facePreview") === "1",
    calibrationComplete:
      params.get("calibrated") === null
        ? presetBase.calibrationComplete
        : params.get("calibrated") === "1",
    monitorPreset: preset,
  };

  const transformBase = baseState.modelTransform;
  const modelTransform: ModelTransform = {
    positionX: parseFiniteNumber(params.get("modelX"), transformBase.positionX, -5, 5),
    positionY: parseFiniteNumber(params.get("modelY"), transformBase.positionY, -5, 5),
    positionZ: parseFiniteNumber(params.get("modelZ"), transformBase.positionZ, -5, 5),
    rotationX: parseFiniteNumber(params.get("modelRotX"), transformBase.rotationX, -180, 180),
    rotationY: parseFiniteNumber(params.get("modelRotY"), transformBase.rotationY, -180, 180),
    rotationZ: parseFiniteNumber(params.get("modelRotZ"), transformBase.rotationZ, -180, 180),
    scale: parseFiniteNumber(params.get("modelScale"), transformBase.scale, 0.1, 10),
  };

  return {
    modelUrl: params.get("model"),
    near: parseFiniteNumber(params.get("near"), 0.1, 0.01, 10),
    far: parseFiniteNumber(params.get("far"), 100, 10, 1000),
    calibration,
    modelTransform,
  };
}
