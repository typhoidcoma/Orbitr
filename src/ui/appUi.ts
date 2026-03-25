import {
  DEFAULT_MODEL_TRANSFORM,
  applyMonitorPreset,
  type ModelTransform,
  type MonitorPreset,
  type ParallaxCalibration,
} from "../lib/parallaxConfig";
import { screenDimensionsFromDiagonal } from "../lib/autoCalibrate";
import type { ViewerPose } from "../tracking/normalizeTracking";
import type { EffectiveScreenRect } from "../viewer/viewer";

export type UiTone = "normal" | "warning" | "error";
type NumericTransformField = keyof ModelTransform;

export interface CalibrationHandlers {
  onCalibrationChange: (next: ParallaxCalibration) => void;
  onModelTransformChange: (next: ModelTransform) => void;
  onResetState: () => void;
}

export interface AppUi {
  canvasHost: HTMLDivElement;
  startButton: HTMLButtonElement;
  fullscreenButton: HTMLButtonElement;
  setTrackingActive: (active: boolean) => void;
  setFullscreenEnabled: (enabled: boolean) => void;
  setStatus: (message: string, tone?: UiTone) => void;
  bindHandlers: (handlers: CalibrationHandlers) => void;
  setCalibration: (calibration: ParallaxCalibration) => void;
  setModelTransform: (modelTransform: ModelTransform) => void;
  setPreviewStream: (stream: MediaStream | null) => void;
  updateDebugPose: (pose: ViewerPose | null, screenRect?: EffectiveScreenRect | null) => void;
  updateNeutralProgress: (stableFrameCount: number, requiredFrames: number) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

const MODEL_FIELDS: NumericTransformField[] = [
  "positionX",
  "positionY",
  "positionZ",
  "rotationX",
  "rotationY",
  "rotationZ",
  "scale",
];

export function createAppUi(
  root: HTMLElement,
  initialCalibration: ParallaxCalibration,
  initialModelTransform: ModelTransform
): AppUi {
  root.innerHTML = `
    <div id="viewer-host" class="viewer-host"></div>

    <header class="topbar">
      <img src="/orbitr_logo.svg" alt="Orbitr" class="topbar-logo" />
      <div class="topbar-actions">
        <button id="settings-toggle" class="icon-button" title="Settings">&#9881;</button>
        <button id="fullscreen-toggle" class="icon-button" title="Fullscreen">&#9974;</button>
      </div>
    </header>

    <div id="status-toast" class="toast" hidden>
      <span id="status-text">Ready</span>
    </div>

    <div id="calibration-pip" class="calibration-pip" hidden>
      <video id="face-preview" autoplay muted playsinline></video>
      <div id="face-preview-marker" class="face-preview-marker"></div>
    </div>

    <button id="start-button" class="fab">Start</button>

    <div id="drawer-backdrop" class="drawer-backdrop"></div>
    <aside id="settings-drawer" class="drawer">
      <div class="drawer-header">
        <img src="/orbitr_logo.svg" alt="Orbitr" class="drawer-logo" />
        <button id="close-drawer" class="drawer-close" title="Close">&times;</button>
      </div>

      <section class="drawer-section">
        <h3>Screen Size</h3>
        <div class="preset-group">
          <button data-preset="14_laptop" class="preset-button">14" Laptop</button>
          <button data-preset="24_desktop" class="preset-button">24" Desktop</button>
          <button data-preset="27_desktop" class="preset-button">27" Desktop</button>
        </div>
        <div class="custom-diagonal">
          <input id="screen-diagonal" type="number" placeholder="e.g. 32" min="10" max="65" step="0.5" />
          <span>inches (custom)</span>
        </div>
      </section>

      <section class="drawer-section">
        <h3>Parallax</h3>
        <div class="range-field">
          <label>
            <span>Intensity</span>
            <span id="movement-scale-value">1.0</span>
          </label>
          <input id="movement-scale" type="range" min="0.5" max="2" step="0.05" value="1" />
        </div>
      </section>

      <section class="drawer-section">
        <h3>Scene</h3>
        <label class="toggle">
          <input id="show-presentation-room" type="checkbox" />
          <span>Presentation room</span>
        </label>
        <label class="toggle">
          <input id="show-wireframe-room" type="checkbox" />
          <span>Wireframe room</span>
        </label>
        <label class="toggle">
          <input id="show-screen-frame" type="checkbox" />
          <span>Screen frame</span>
        </label>
      </section>

      <details class="details-panel">
        <summary>Model Placement</summary>
        <div class="controls">
          ${renderModelField("positionX", "Model X", "-5", "5", "0.01")}
          ${renderModelField("positionY", "Model Y", "-5", "5", "0.01")}
          ${renderModelField("positionZ", "Model Z", "-5", "5", "0.01")}
          ${renderModelField("rotationX", "Rotate X", "-180", "180", "1")}
          ${renderModelField("rotationY", "Rotate Y", "-180", "180", "1")}
          ${renderModelField("rotationZ", "Rotate Z", "-180", "180", "1")}
          ${renderModelField("scale", "Scale", "0.1", "10", "0.01")}
          <button id="reset-model-button" class="secondary wide">Reset Model</button>
        </div>
      </details>

      <details class="details-panel">
        <summary>Debug</summary>
        <div class="controls">
          <label class="toggle">
            <input id="show-debug" type="checkbox" />
            <span>Debug overlay</span>
          </label>
          <label class="toggle">
            <input id="show-face-preview" type="checkbox" />
            <span>Face preview</span>
          </label>
          <pre id="debug-readout" class="debug-readout" hidden>No tracking data yet.</pre>
        </div>
      </details>

      <button id="reset-button" class="secondary wide">Reset All Settings</button>
    </aside>
  `;

  const canvasHost = root.querySelector<HTMLDivElement>("#viewer-host")!;
  const startButton = root.querySelector<HTMLButtonElement>("#start-button")!;
  const fullscreenButton = root.querySelector<HTMLButtonElement>("#fullscreen-toggle")!;
  const settingsToggle = root.querySelector<HTMLButtonElement>("#settings-toggle")!;
  const closeDrawer = root.querySelector<HTMLButtonElement>("#close-drawer")!;
  const drawer = root.querySelector<HTMLElement>("#settings-drawer")!;
  const backdrop = root.querySelector<HTMLElement>("#drawer-backdrop")!;
  const statusToast = root.querySelector<HTMLDivElement>("#status-toast")!;
  const statusText = root.querySelector<HTMLSpanElement>("#status-text")!;
  const pip = root.querySelector<HTMLDivElement>("#calibration-pip")!;
  const previewVideo = root.querySelector<HTMLVideoElement>("#face-preview")!;
  const previewMarker = root.querySelector<HTMLDivElement>("#face-preview-marker")!;
  const resetButton = root.querySelector<HTMLButtonElement>("#reset-button")!;
  const resetModelButton = root.querySelector<HTMLButtonElement>("#reset-model-button")!;
  const movementScaleInput = root.querySelector<HTMLInputElement>("#movement-scale")!;
  const movementScaleValue = root.querySelector<HTMLSpanElement>("#movement-scale-value")!;
  const screenDiagonalInput = root.querySelector<HTMLInputElement>("#screen-diagonal")!;
  const presentationRoomToggle = root.querySelector<HTMLInputElement>("#show-presentation-room")!;
  const wireframeRoomToggle = root.querySelector<HTMLInputElement>("#show-wireframe-room")!;
  const screenFrameToggle = root.querySelector<HTMLInputElement>("#show-screen-frame")!;
  const debugToggle = root.querySelector<HTMLInputElement>("#show-debug")!;
  const facePreviewToggle = root.querySelector<HTMLInputElement>("#show-face-preview")!;
  const debugReadout = root.querySelector<HTMLPreElement>("#debug-readout")!;
  const presetButtons = root.querySelectorAll<HTMLButtonElement>("[data-preset]");

  const modelInputs = Object.fromEntries(
    MODEL_FIELDS.map((field) => [
      field,
      root.querySelector<HTMLInputElement>(`[data-model-field="${field}"]`),
    ])
  ) as Record<NumericTransformField, HTMLInputElement | null>;

  let calibration = { ...initialCalibration };
  let modelTransform = { ...initialModelTransform };
  let toastTimer = 0;

  const openSettings = (): void => {
    drawer.classList.add("open");
    backdrop.classList.add("open");
  };

  const closeSettings = (): void => {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
  };

  const syncPresetButtons = (): void => {
    presetButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === calibration.monitorPreset);
    });
  };

  const setCalibrationFields = (next: ParallaxCalibration): void => {
    calibration = { ...next };
    movementScaleInput.value = `${next.movementScale}`;
    movementScaleValue.textContent = next.movementScale.toFixed(2);
    presentationRoomToggle.checked = next.showPresentationRoom;
    wireframeRoomToggle.checked = next.showWireframeRoom;
    screenFrameToggle.checked = next.showScreenFrame;
    debugToggle.checked = next.showDebug;
    facePreviewToggle.checked = next.showFacePreview;
    debugReadout.hidden = !next.showDebug;
    syncPresetButtons();
  };

  const setModelTransformFields = (next: ModelTransform): void => {
    modelTransform = { ...next };
    for (const field of MODEL_FIELDS) {
      const input = modelInputs[field];
      if (input) input.value = `${next[field]}`;
    }
  };

  const readModelTransform = (): ModelTransform => {
    const next = { ...modelTransform };
    for (const field of MODEL_FIELDS) {
      const input = modelInputs[field];
      if (!input) continue;
      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) next[field] = parsed;
    }
    return next;
  };

  setCalibrationFields(initialCalibration);
  setModelTransformFields(initialModelTransform);

  return {
    canvasHost,
    startButton,
    fullscreenButton,

    setTrackingActive(active) {
      startButton.textContent = active ? "Stop" : "Start";
      startButton.classList.toggle("active", active);
    },

    setFullscreenEnabled(enabled) {
      fullscreenButton.textContent = enabled ? "\u2716" : "\u26F6";
      fullscreenButton.title = enabled ? "Exit Fullscreen" : "Fullscreen";
    },

    setStatus(message, tone = "normal") {
      statusText.textContent = message;
      statusToast.hidden = false;
      statusToast.dataset.tone = tone;
      clearTimeout(toastTimer);
      if (tone === "normal") {
        toastTimer = window.setTimeout(() => {
          statusToast.hidden = true;
        }, 5000);
      }
    },

    bindHandlers(handlers) {
      const emitCalibrationChange = (): void => {
        calibration = {
          ...calibration,
          movementScale: Number(movementScaleInput.value) || 1,
          showPresentationRoom: presentationRoomToggle.checked,
          showWireframeRoom: wireframeRoomToggle.checked,
          showScreenFrame: screenFrameToggle.checked,
          showDebug: debugToggle.checked,
          showFacePreview: facePreviewToggle.checked,
        };
        handlers.onCalibrationChange(calibration);
        setCalibrationFields(calibration);
      };

      const emitModelTransformChange = (): void => {
        modelTransform = readModelTransform();
        handlers.onModelTransformChange(modelTransform);
        setModelTransformFields(modelTransform);
      };

      settingsToggle.addEventListener("click", openSettings);
      closeDrawer.addEventListener("click", closeSettings);
      backdrop.addEventListener("click", closeSettings);

      presetButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const preset = btn.dataset.preset as MonitorPreset;
          calibration = applyMonitorPreset(calibration, preset);
          handlers.onCalibrationChange(calibration);
          setCalibrationFields(calibration);
        });
      });

      screenDiagonalInput.addEventListener("change", () => {
        const inches = Number(screenDiagonalInput.value);
        if (!Number.isFinite(inches) || inches < 10 || inches > 65) return;
        const dims = screenDimensionsFromDiagonal(inches);
        calibration = {
          ...calibration,
          monitorPreset: "custom" as MonitorPreset,
          screenWidth: dims.width,
          screenHeight: dims.height,
        };
        handlers.onCalibrationChange(calibration);
        setCalibrationFields(calibration);
      });

      movementScaleInput.addEventListener("input", () => {
        movementScaleValue.textContent = Number(movementScaleInput.value).toFixed(2);
        emitCalibrationChange();
      });

      presentationRoomToggle.addEventListener("change", emitCalibrationChange);
      wireframeRoomToggle.addEventListener("change", emitCalibrationChange);
      screenFrameToggle.addEventListener("change", emitCalibrationChange);
      debugToggle.addEventListener("change", emitCalibrationChange);
      facePreviewToggle.addEventListener("change", emitCalibrationChange);

      for (const field of MODEL_FIELDS) {
        modelInputs[field]?.addEventListener("input", emitModelTransformChange);
      }

      resetModelButton.addEventListener("click", () => {
        modelTransform = { ...DEFAULT_MODEL_TRANSFORM };
        handlers.onModelTransformChange(modelTransform);
        setModelTransformFields(modelTransform);
      });

      resetButton.addEventListener("click", () => {
        closeSettings();
        handlers.onResetState();
      });
    },

    setCalibration(next) {
      setCalibrationFields(next);
    },

    setModelTransform(next) {
      setModelTransformFields(next);
    },

    setPreviewStream(stream) {
      previewVideo.srcObject = stream;
      pip.hidden = stream === null;
    },

    updateDebugPose(pose, screenRect) {
      if (pose) {
        previewMarker.style.left = `${(1 - pose.debug.headCenterX) * 100}%`;
        previewMarker.style.top = `${pose.debug.headCenterY * 100}%`;
      }

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
            `faceHeight: ${pose.debug.faceHeight.toFixed(4)}`,
            `faceScale: ${pose.debug.faceScale.toFixed(4)}`,
            `gazeX: ${pose.debug.gazeX.toFixed(3)}`,
            `gazeY: ${pose.debug.gazeY.toFixed(3)}`,
            `detectConf: ${pose.debug.detectionConfidence.toFixed(3)}`,
            `presenceConf: ${pose.debug.presenceConfidence.toFixed(3)}`,
            `trackingConf: ${pose.debug.trackingConfidence.toFixed(3)}`,
            `windowWidth: ${screenRect?.width.toFixed(3) ?? "0.000"}`,
            `windowHeight: ${screenRect?.height.toFixed(3) ?? "0.000"}`,
          ].join("\n")
        : "No tracking data yet.";
    },

    updateNeutralProgress() {
      // Progress is now shown via toast messages from the auto-calibrator
    },

    openSettings,
    closeSettings,
  };
}

function renderModelField(
  field: NumericTransformField,
  label: string,
  min: string,
  max: string,
  step: string
): string {
  return `
    <label class="field">
      <span>${label}</span>
      <input data-model-field="${field}" type="number" min="${min}" max="${max}" step="${step}" />
    </label>
  `;
}
