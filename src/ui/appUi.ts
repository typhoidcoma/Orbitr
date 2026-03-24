import {
  applyMonitorPreset,
  type MonitorPreset,
  type ParallaxCalibration,
} from "../lib/parallaxConfig";
import type { ViewerPose } from "../tracking/normalizeTracking";

export type UiTone = "normal" | "warning" | "error";
type NumericCalibrationField = Exclude<keyof ParallaxCalibration, "showDebug" | "showWindowBox" | "monitorPreset">;

interface CalibrationHandlers {
  onCalibrationChange: (next: ParallaxCalibration) => void;
  onCaptureNeutral: () => void;
}

export interface AppUi {
  canvasHost: HTMLDivElement;
  toggleTrackingButton: HTMLButtonElement;
  fullscreenButton: HTMLButtonElement;
  setTrackingEnabled: (enabled: boolean) => void;
  setFullscreenEnabled: (enabled: boolean) => void;
  setStatus: (message: string, tone?: UiTone) => void;
  bindCalibrationHandlers: (handlers: CalibrationHandlers) => void;
  setCalibration: (calibration: ParallaxCalibration) => void;
  updateDebugPose: (pose: ViewerPose | null) => void;
}

const NUMBER_FIELDS: NumericCalibrationField[] = [
  "screenWidth",
  "screenHeight",
  "neutralDistance",
  "gainX",
  "gainY",
  "gainZ",
  "eyeRefinementGain",
  "screenOffsetX",
  "screenOffsetY",
  "screenOffsetZ",
  "cameraOffsetX",
  "cameraOffsetY",
  "cameraOffsetZ",
  "smoothing",
];

export function createAppUi(root: HTMLElement, initialCalibration: ParallaxCalibration): AppUi {
  root.innerHTML = `
    <div class="layout">
      <header class="toolbar">
        <div class="brand">
          <h1>Orbitr</h1>
          <p>Strict head-coupled screen-window viewer</p>
        </div>
        <div class="toolbar-actions">
          <button id="fullscreen-toggle" class="secondary">Enter Fullscreen</button>
          <button id="tracking-toggle" class="primary">Start Tracking</button>
        </div>
      </header>
      <div id="status" class="status">Viewer ready. Choose a monitor profile, then start tracking.</div>
      <section class="workspace">
        <aside class="panel">
          <div class="panel-header">
            <h2>Calibration</h2>
            <button id="capture-neutral" class="secondary">Capture Neutral Pose</button>
          </div>

          <div class="setup-card">
            <label class="field">
              <span>Monitor Preset</span>
              <select id="monitor-preset">
                <option value="24_desktop">24" Desktop</option>
                <option value="27_desktop">27" Desktop</option>
                <option value="14_laptop">14" Laptop</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <p class="hint">Use custom only if you know the physical screen width and height in meters.</p>
          </div>

          <div class="controls">
            ${renderNumberField("screenWidth", "Screen Width (m)", "0.18", "1.4", "0.001")}
            ${renderNumberField("screenHeight", "Screen Height (m)", "0.1", "0.9", "0.001")}
            ${renderNumberField("neutralDistance", "Neutral Distance (m)", "0.25", "1.8", "0.001")}
            ${renderNumberField("cameraOffsetX", "Webcam Offset X (m)", "-0.5", "0.5", "0.001")}
            ${renderNumberField("cameraOffsetY", "Webcam Offset Y (m)", "-0.5", "0.5", "0.001")}
            ${renderNumberField("cameraOffsetZ", "Webcam Offset Z (m)", "-0.5", "0.5", "0.001")}
            ${renderNumberField("gainX", "Head Gain X", "-3", "3", "0.01")}
            ${renderNumberField("gainY", "Head Gain Y", "-3", "3", "0.01")}
            ${renderNumberField("gainZ", "Depth Gain", "-3", "3", "0.01")}
            ${renderNumberField("eyeRefinementGain", "Eye Refinement", "-0.2", "0.2", "0.001")}
            ${renderNumberField("screenOffsetX", "Screen Offset X", "-1", "1", "0.001")}
            ${renderNumberField("screenOffsetY", "Screen Offset Y", "-1", "1", "0.001")}
            ${renderNumberField("screenOffsetZ", "Screen Offset Z", "-1", "1", "0.001")}
            ${renderNumberField("smoothing", "Smoothing", "0", "1", "0.01")}
          </div>

          <label class="toggle">
            <input id="show-window-box" type="checkbox" />
            <span>Show window box</span>
          </label>
          <label class="toggle">
            <input id="show-debug" type="checkbox" />
            <span>Show tracking debug</span>
          </label>
          <pre id="debug-readout" class="debug-readout" hidden>No tracking data yet.</pre>
        </aside>
        <main id="viewer-host" class="viewer-host"></main>
      </section>
    </div>
  `;

  const canvasHost = root.querySelector<HTMLDivElement>("#viewer-host");
  const toggleTrackingButton = root.querySelector<HTMLButtonElement>("#tracking-toggle");
  const fullscreenButton = root.querySelector<HTMLButtonElement>("#fullscreen-toggle");
  const captureNeutralButton = root.querySelector<HTMLButtonElement>("#capture-neutral");
  const status = root.querySelector<HTMLDivElement>("#status");
  const debugToggle = root.querySelector<HTMLInputElement>("#show-debug");
  const windowBoxToggle = root.querySelector<HTMLInputElement>("#show-window-box");
  const debugReadout = root.querySelector<HTMLPreElement>("#debug-readout");
  const monitorPreset = root.querySelector<HTMLSelectElement>("#monitor-preset");

  if (
    !canvasHost ||
    !toggleTrackingButton ||
    !fullscreenButton ||
    !captureNeutralButton ||
    !status ||
    !debugToggle ||
    !windowBoxToggle ||
    !debugReadout ||
    !monitorPreset
  ) {
    throw new Error("UI mount failed: required elements not found.");
  }

  const inputs = Object.fromEntries(
    NUMBER_FIELDS.map((field) => [
      field,
      root.querySelector<HTMLInputElement>(`[data-field="${field}"]`),
    ])
  ) as Record<NumericCalibrationField, HTMLInputElement | null>;

  for (const field of NUMBER_FIELDS) {
    if (!inputs[field]) {
      throw new Error(`Calibration input '${field}' was not found.`);
    }
  }

  let calibration = { ...initialCalibration };

  const readCalibration = (): ParallaxCalibration => {
    let next = { ...calibration };

    const selectedPreset = monitorPreset.value as MonitorPreset;
    if (selectedPreset !== "custom") {
      next = applyMonitorPreset(next, selectedPreset);
    } else {
      next.monitorPreset = "custom";
    }

    for (const field of NUMBER_FIELDS) {
      const input = inputs[field];
      if (!input) {
        continue;
      }

      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) {
        next[field] = parsed;
      }
    }

    next.showDebug = debugToggle.checked;
    next.showWindowBox = windowBoxToggle.checked;
    return next;
  };

  const setCalibrationFields = (next: ParallaxCalibration): void => {
    calibration = { ...next };
    monitorPreset.value = next.monitorPreset;

    for (const field of NUMBER_FIELDS) {
      const input = inputs[field];
      if (input) {
        input.value = `${next[field]}`;
        input.disabled =
          next.monitorPreset !== "custom" && (field === "screenWidth" || field === "screenHeight");
      }
    }

    debugToggle.checked = next.showDebug;
    windowBoxToggle.checked = next.showWindowBox;
    debugReadout.hidden = !next.showDebug;
  };

  setCalibrationFields(initialCalibration);

  return {
    canvasHost,
    toggleTrackingButton,
    fullscreenButton,
    setTrackingEnabled(enabled) {
      toggleTrackingButton.textContent = enabled ? "Stop Tracking" : "Start Tracking";
      toggleTrackingButton.classList.toggle("active", enabled);
    },
    setFullscreenEnabled(enabled) {
      fullscreenButton.textContent = enabled ? "Exit Fullscreen" : "Enter Fullscreen";
      fullscreenButton.classList.toggle("active", enabled);
    },
    setStatus(message, tone = "normal") {
      status.textContent = message;
      status.dataset.tone = tone;
    },
    bindCalibrationHandlers(handlers) {
      const emitCalibrationChange = (): void => {
        calibration = readCalibration();
        handlers.onCalibrationChange(calibration);
        setCalibrationFields(calibration);
      };

      monitorPreset.addEventListener("change", emitCalibrationChange);

      for (const field of NUMBER_FIELDS) {
        const input = inputs[field];
        input?.addEventListener("input", emitCalibrationChange);
      }

      debugToggle.addEventListener("change", emitCalibrationChange);
      windowBoxToggle.addEventListener("change", emitCalibrationChange);
      captureNeutralButton.addEventListener("click", handlers.onCaptureNeutral);
    },
    setCalibration(next) {
      setCalibrationFields(next);
    },
    updateDebugPose(pose) {
      if (!calibration.showDebug) {
        debugReadout.hidden = true;
        return;
      }

      debugReadout.hidden = false;
      debugReadout.textContent = pose
        ? [
            `eyeX: ${pose.eyeX.toFixed(3)}`,
            `eyeY: ${pose.eyeY.toFixed(3)}`,
            `eyeZ: ${pose.eyeZ.toFixed(3)}`,
            `estimatedDistance: ${pose.debug.estimatedDistance.toFixed(3)}`,
            `headOffsetX: ${pose.debug.headOffsetX.toFixed(3)}`,
            `headOffsetY: ${pose.debug.headOffsetY.toFixed(3)}`,
            `yaw: ${pose.yaw.toFixed(3)}`,
            `pitch: ${pose.pitch.toFixed(3)}`,
            `headCenterX: ${pose.debug.headCenterX.toFixed(3)}`,
            `headCenterY: ${pose.debug.headCenterY.toFixed(3)}`,
            `eyeSeparation: ${pose.debug.eyeSeparation.toFixed(4)}`,
            `faceWidth: ${pose.debug.faceWidth.toFixed(4)}`,
            `faceScale: ${pose.debug.faceScale.toFixed(4)}`,
            `gazeX: ${pose.debug.gazeX.toFixed(3)}`,
            `gazeY: ${pose.debug.gazeY.toFixed(3)}`,
          ].join("\n")
        : "No tracking data yet.";
    },
  };
}

function renderNumberField(
  field: NumericCalibrationField,
  label: string,
  min: string,
  max: string,
  step: string
): string {
  return `
    <label class="field">
      <span>${label}</span>
      <input data-field="${field}" type="number" min="${min}" max="${max}" step="${step}" />
    </label>
  `;
}
