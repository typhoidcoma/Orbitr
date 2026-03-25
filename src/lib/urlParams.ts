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
    screenWidth: parseFiniteNumber(params.get("screenWidth"), presetBase.screenWidth, 18, 140),
    screenHeight: parseFiniteNumber(params.get("screenHeight"), presetBase.screenHeight, 10, 90),
    neutralDistance: parseFiniteNumber(
      params.get("neutralDistance"),
      presetBase.neutralDistance,
      25,
      180
    ),
    gainX: parseFiniteNumber(params.get("gainX"), presetBase.gainX, -5, 5),
    gainY: parseFiniteNumber(params.get("gainY"), presetBase.gainY, -5, 5),
    gainZ: parseFiniteNumber(params.get("gainZ"), presetBase.gainZ, -5, 5),
    eyeRefinementGain: parseFiniteNumber(
      params.get("eyeRefinementGain"),
      presetBase.eyeRefinementGain,
      -20,
      20
    ),
    screenOffsetX: parseFiniteNumber(params.get("screenOffsetX"), presetBase.screenOffsetX, -100, 100),
    screenOffsetY: parseFiniteNumber(params.get("screenOffsetY"), presetBase.screenOffsetY, -100, 100),
    screenOffsetZ: parseFiniteNumber(params.get("screenOffsetZ"), presetBase.screenOffsetZ, -100, 100),
    cameraOffsetX: parseFiniteNumber(params.get("cameraOffsetX"), presetBase.cameraOffsetX, -50, 50),
    cameraOffsetY: parseFiniteNumber(params.get("cameraOffsetY"), presetBase.cameraOffsetY, -50, 50),
    cameraOffsetZ: parseFiniteNumber(params.get("cameraOffsetZ"), presetBase.cameraOffsetZ, -50, 50),
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
    positionX: parseFiniteNumber(params.get("modelX"), transformBase.positionX, -500, 500),
    positionY: parseFiniteNumber(params.get("modelY"), transformBase.positionY, -500, 500),
    positionZ: parseFiniteNumber(params.get("modelZ"), transformBase.positionZ, -500, 500),
    rotationX: parseFiniteNumber(params.get("modelRotX"), transformBase.rotationX, -180, 180),
    rotationY: parseFiniteNumber(params.get("modelRotY"), transformBase.rotationY, -180, 180),
    rotationZ: parseFiniteNumber(params.get("modelRotZ"), transformBase.rotationZ, -180, 180),
    scale: parseFiniteNumber(params.get("modelScale"), transformBase.scale, 0.1, 10),
  };

  return {
    modelUrl: params.get("model"),
    near: parseFiniteNumber(params.get("near"), 1, 0.1, 100),
    far: parseFiniteNumber(params.get("far"), 10000, 1000, 100000),
    calibration,
    modelTransform,
  };
}
