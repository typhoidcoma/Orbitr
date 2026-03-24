import {
  DEFAULT_PARALLAX_CALIBRATION,
  applyMonitorPreset,
  type MonitorPreset,
  type ParallaxCalibration,
} from "./parallaxConfig";

export interface ViewerUrlParams {
  modelUrl: string | null;
  near: number;
  far: number;
  calibration: ParallaxCalibration;
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

function parseMonitorPreset(raw: string | null): MonitorPreset {
  if (raw === "24_desktop" || raw === "27_desktop" || raw === "14_laptop" || raw === "custom") {
    return raw;
  }

  return DEFAULT_PARALLAX_CALIBRATION.monitorPreset;
}

export function parseViewerUrlParams(search: string): ViewerUrlParams {
  const params = new URLSearchParams(search);
  const preset = parseMonitorPreset(params.get("monitorPreset"));
  const presetBase = applyMonitorPreset(DEFAULT_PARALLAX_CALIBRATION, preset);

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
    showDebug: params.get("debug") === "1" || presetBase.showDebug,
    showWindowBox: params.get("windowBox") === "0" ? false : presetBase.showWindowBox,
    monitorPreset: preset,
  };

  return {
    modelUrl: params.get("model"),
    near: parseFiniteNumber(params.get("near"), 0.1, 0.01, 10),
    far: parseFiniteNumber(params.get("far"), 100, 10, 1000),
    calibration,
  };
}
