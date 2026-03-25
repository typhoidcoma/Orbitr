import {
  DEFAULT_MODEL_TRANSFORM,
  applyMonitorPreset,
  type ModelTransform,
  type MonitorPreset,
  type ParallaxCalibration,
} from "../lib/parallaxConfig";
import type { ViewerPose } from "../tracking/normalizeTracking";

export type UiTone = "normal" | "warning" | "error";
type NumericCalibrationField = Exclude<
  keyof ParallaxCalibration,
  | "showDebug"
  | "showPresentationRoom"
  | "showWireframeRoom"
  | "showScreenFrame"
  | "showFacePreview"
  | "monitorPreset"
  | "calibrationComplete"
>;
type NumericTransformField = keyof ModelTransform;

interface CalibrationHandlers {
  onCalibrationChange: (next: ParallaxCalibration) => void;
  onCaptureNeutral: () => void;
  onModelTransformChange: (next: ModelTransform) => void;
  onResetState: () => void;
}

export interface AppUi {
  canvasHost: HTMLDivElement;
  toggleTrackingButton: HTMLButtonElement;
  fullscreenButton: HTMLButtonElement;
  setTrackingEnabled: (enabled: boolean) => void;
  setFullscreenEnabled: (enabled: boolean) => void;
  setStatus: (message: string, tone?: UiTone) => void;
  bindHandlers: (handlers: CalibrationHandlers) => void;
  setCalibration: (calibration: ParallaxCalibration) => void;
  setModelTransform: (modelTransform: ModelTransform) => void;
  setPreviewStream: (stream: MediaStream | null) => void;
  updateDebugPose: (pose: ViewerPose | null) => void;
}

const CALIBRATION_FIELDS: NumericCalibrationField[] = [
  "screenWidth",
  "screenHeight",
  "neutralDistance",
  "cameraOffsetX",
  "cameraOffsetY",
  "cameraOffsetZ",
  "gainX",
  "gainY",
  "gainZ",
  "eyeRefinementGain",
  "screenOffsetX",
  "screenOffsetY",
  "screenOffsetZ",
  "smoothing",
];

const MODEL_FIELDS: NumericTransformField[] = [
  "positionX",
  "positionY",
  "positionZ",
  "rotationX",
  "rotationY",
  "rotationZ",
  "scale",
];

const WIZARD_STEPS = [
  "screen",
  "webcam",
  "distance",
  "tracking",
  "test",
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number];

export function createAppUi(
  root: HTMLElement,
  initialCalibration: ParallaxCalibration,
  initialModelTransform: ModelTransform
): AppUi {
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
      <div id="status" class="status">Viewer ready. Run the calibration flow, then test the illusion.</div>
      <section class="workspace">
        <aside class="panel">
          <div class="panel-header">
            <div>
              <h2>Calibration Wizard</h2>
              <p class="panel-subtitle">Borrow the good UX, keep the strict geometry.</p>
            </div>
            <div class="panel-actions">
              <button id="recalibrate-button" class="secondary">Recalibrate</button>
              <button id="reset-button" class="secondary">Reset</button>
            </div>
          </div>

          <div class="wizard-nav">
            ${WIZARD_STEPS.map((step, index) => `<button data-step="${step}" class="wizard-pill">${index + 1}</button>`).join("")}
          </div>

          <section data-step-panel="screen" class="wizard-step">
            <h3>1. Screen</h3>
            <p>Pick a monitor preset or enter custom physical dimensions in meters.</p>
            <label class="field">
              <span>Monitor Preset</span>
              <select id="monitor-preset">
                <option value="24_desktop">24" Desktop</option>
                <option value="27_desktop">27" Desktop</option>
                <option value="14_laptop">14" Laptop</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <div class="two-up">
              ${renderCalibrationField("screenWidth", "Screen Width (m)", "0.18", "1.4", "0.001")}
              ${renderCalibrationField("screenHeight", "Screen Height (m)", "0.1", "0.9", "0.001")}
            </div>
            ${renderWizardActions("screen")}
          </section>

          <section data-step-panel="webcam" class="wizard-step" hidden>
            <h3>2. Webcam Placement</h3>
            <p>Set the webcam offset relative to the center of the display.</p>
            <div class="two-up">
              ${renderCalibrationField("cameraOffsetX", "Camera Offset X (m)", "-0.5", "0.5", "0.001")}
              ${renderCalibrationField("cameraOffsetY", "Camera Offset Y (m)", "-0.5", "0.5", "0.001")}
            </div>
            ${renderCalibrationField("cameraOffsetZ", "Camera Offset Z (m)", "-0.5", "0.5", "0.001")}
            ${renderWizardActions("webcam")}
          </section>

          <section data-step-panel="distance" class="wizard-step" hidden>
            <h3>3. Distance</h3>
            <p>Set your typical eye-to-screen distance and smoothing. This becomes the neutral reference.</p>
            ${renderCalibrationField("neutralDistance", "Neutral Distance (m)", "0.25", "1.8", "0.001")}
            ${renderCalibrationField("smoothing", "Smoothing", "0", "1", "0.01")}
            ${renderWizardActions("distance")}
          </section>

          <section data-step-panel="tracking" class="wizard-step" hidden>
            <h3>4. Tracking</h3>
            <p>Start tracking, optionally show the face preview, and capture a neutral pose while seated normally.</p>
            <label class="toggle">
              <input id="show-face-preview" type="checkbox" />
              <span>Show face preview</span>
            </label>
            <div id="face-preview-shell" class="face-preview-shell" hidden>
              <video id="face-preview" class="face-preview" autoplay muted playsinline></video>
              <div id="face-preview-marker" class="face-preview-marker"></div>
            </div>
            <button id="capture-neutral" class="secondary wide">Capture Neutral Pose</button>
            ${renderWizardActions("tracking")}
          </section>

          <section data-step-panel="test" class="wizard-step" hidden>
            <h3>5. Test</h3>
            <p>What to expect:</p>
            <ul class="test-list">
              <li>Move left to reveal more of the right side of objects.</li>
              <li>Move right to reveal more of the left side.</li>
              <li>Lean in to strengthen perspective.</li>
              <li>Use fullscreen viewer mode for the cleanest effect.</li>
            </ul>
            <div class="toggle-grid">
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
                <span>Red screen frame</span>
              </label>
              <label class="toggle">
                <input id="show-debug" type="checkbox" />
                <span>Tracking debug</span>
              </label>
            </div>
            <button id="wizard-complete" class="primary wide">Finish Calibration</button>
          </section>

          <details class="details-panel">
            <summary>Advanced Calibration</summary>
            <div class="controls">
              ${renderCalibrationField("gainX", "Head Gain X", "-3", "3", "0.01")}
              ${renderCalibrationField("gainY", "Head Gain Y", "-3", "3", "0.01")}
              ${renderCalibrationField("gainZ", "Depth Gain", "-3", "3", "0.01")}
              ${renderCalibrationField("eyeRefinementGain", "Eye Refinement", "-0.2", "0.2", "0.001")}
              ${renderCalibrationField("screenOffsetX", "Screen Offset X", "-1", "1", "0.001")}
              ${renderCalibrationField("screenOffsetY", "Screen Offset Y", "-1", "1", "0.001")}
              ${renderCalibrationField("screenOffsetZ", "Screen Offset Z", "-1", "1", "0.001")}
            </div>
          </details>

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
              <button id="reset-model-button" class="secondary wide">Reset Model Controls</button>
            </div>
          </details>

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
  const resetButton = root.querySelector<HTMLButtonElement>("#reset-button");
  const recalibrateButton = root.querySelector<HTMLButtonElement>("#recalibrate-button");
  const resetModelButton = root.querySelector<HTMLButtonElement>("#reset-model-button");
  const wizardCompleteButton = root.querySelector<HTMLButtonElement>("#wizard-complete");
  const status = root.querySelector<HTMLDivElement>("#status");
  const debugToggle = root.querySelector<HTMLInputElement>("#show-debug");
  const presentationRoomToggle = root.querySelector<HTMLInputElement>("#show-presentation-room");
  const wireframeRoomToggle = root.querySelector<HTMLInputElement>("#show-wireframe-room");
  const screenFrameToggle = root.querySelector<HTMLInputElement>("#show-screen-frame");
  const facePreviewToggle = root.querySelector<HTMLInputElement>("#show-face-preview");
  const debugReadout = root.querySelector<HTMLPreElement>("#debug-readout");
  const monitorPreset = root.querySelector<HTMLSelectElement>("#monitor-preset");
  const previewShell = root.querySelector<HTMLDivElement>("#face-preview-shell");
  const previewVideo = root.querySelector<HTMLVideoElement>("#face-preview");
  const previewMarker = root.querySelector<HTMLDivElement>("#face-preview-marker");

  if (
    !canvasHost ||
    !toggleTrackingButton ||
    !fullscreenButton ||
    !captureNeutralButton ||
    !resetButton ||
    !recalibrateButton ||
    !resetModelButton ||
    !wizardCompleteButton ||
    !status ||
    !debugToggle ||
    !presentationRoomToggle ||
    !wireframeRoomToggle ||
    !screenFrameToggle ||
    !facePreviewToggle ||
    !debugReadout ||
    !monitorPreset ||
    !previewShell ||
    !previewVideo ||
    !previewMarker
  ) {
    throw new Error("UI mount failed: required elements not found.");
  }

  const calibrationInputs = Object.fromEntries(
    CALIBRATION_FIELDS.map((field) => [
      field,
      root.querySelector<HTMLInputElement>(`[data-calibration-field="${field}"]`),
    ])
  ) as Record<NumericCalibrationField, HTMLInputElement | null>;

  const modelInputs = Object.fromEntries(
    MODEL_FIELDS.map((field) => [
      field,
      root.querySelector<HTMLInputElement>(`[data-model-field="${field}"]`),
    ])
  ) as Record<NumericTransformField, HTMLInputElement | null>;

  let calibration = { ...initialCalibration };
  let modelTransform = { ...initialModelTransform };
  let currentStep: WizardStep = calibration.calibrationComplete ? "test" : "screen";

  const stepButtons = WIZARD_STEPS.map((step) =>
    root.querySelector<HTMLButtonElement>(`[data-step="${step}"]`)
  );
  const stepPanels = WIZARD_STEPS.map((step) =>
    root.querySelector<HTMLElement>(`[data-step-panel="${step}"]`)
  );

  const updateWizardStep = (nextStep: WizardStep): void => {
    currentStep = nextStep;
    WIZARD_STEPS.forEach((step, index) => {
      stepButtons[index]?.classList.toggle("active", step === currentStep);
      stepPanels[index]!.hidden = step !== currentStep;
    });
  };

  const readCalibration = (): ParallaxCalibration => {
    let next = { ...calibration };
    const selectedPreset = monitorPreset.value as MonitorPreset;
    next = selectedPreset === "custom" ? { ...next, monitorPreset: "custom" } : applyMonitorPreset(next, selectedPreset);

    for (const field of CALIBRATION_FIELDS) {
      const input = calibrationInputs[field];
      if (!input) {
        continue;
      }

      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) {
        next[field] = parsed;
      }
    }

    next.showDebug = debugToggle.checked;
    next.showPresentationRoom = presentationRoomToggle.checked;
    next.showWireframeRoom = wireframeRoomToggle.checked;
    next.showScreenFrame = screenFrameToggle.checked;
    next.showFacePreview = facePreviewToggle.checked;
    return next;
  };

  const readModelTransform = (): ModelTransform => {
    const next = { ...modelTransform };
    for (const field of MODEL_FIELDS) {
      const input = modelInputs[field];
      if (!input) {
        continue;
      }

      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) {
        next[field] = parsed;
      }
    }

    return next;
  };

  const setCalibrationFields = (next: ParallaxCalibration): void => {
    calibration = { ...next };
    monitorPreset.value = next.monitorPreset;

    for (const field of CALIBRATION_FIELDS) {
      const input = calibrationInputs[field];
      if (!input) {
        continue;
      }

      input.value = `${next[field]}`;
      input.disabled =
        next.monitorPreset !== "custom" && (field === "screenWidth" || field === "screenHeight");
    }

    debugToggle.checked = next.showDebug;
    presentationRoomToggle.checked = next.showPresentationRoom;
    wireframeRoomToggle.checked = next.showWireframeRoom;
    screenFrameToggle.checked = next.showScreenFrame;
    facePreviewToggle.checked = next.showFacePreview;
    previewShell.hidden = !next.showFacePreview;
    debugReadout.hidden = !next.showDebug;
  };

  const setModelTransformFields = (next: ModelTransform): void => {
    modelTransform = { ...next };
    for (const field of MODEL_FIELDS) {
      const input = modelInputs[field];
      if (input) {
        input.value = `${next[field]}`;
      }
    }
  };

  setCalibrationFields(initialCalibration);
  setModelTransformFields(initialModelTransform);
  updateWizardStep(currentStep);

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
    bindHandlers(handlers) {
      const emitCalibrationChange = (): void => {
        calibration = readCalibration();
        handlers.onCalibrationChange(calibration);
        setCalibrationFields(calibration);
      };

      const emitModelTransformChange = (): void => {
        modelTransform = readModelTransform();
        handlers.onModelTransformChange(modelTransform);
        setModelTransformFields(modelTransform);
      };

      monitorPreset.addEventListener("change", emitCalibrationChange);
      for (const field of CALIBRATION_FIELDS) {
        calibrationInputs[field]?.addEventListener("input", emitCalibrationChange);
      }
      for (const field of MODEL_FIELDS) {
        modelInputs[field]?.addEventListener("input", emitModelTransformChange);
      }

      debugToggle.addEventListener("change", emitCalibrationChange);
      presentationRoomToggle.addEventListener("change", emitCalibrationChange);
      wireframeRoomToggle.addEventListener("change", emitCalibrationChange);
      screenFrameToggle.addEventListener("change", emitCalibrationChange);
      facePreviewToggle.addEventListener("change", emitCalibrationChange);

      captureNeutralButton.addEventListener("click", handlers.onCaptureNeutral);
      resetButton.addEventListener("click", handlers.onResetState);
      recalibrateButton.addEventListener("click", () => {
        calibration = { ...calibration, calibrationComplete: false };
        handlers.onCalibrationChange(calibration);
        updateWizardStep("screen");
      });
      resetModelButton.addEventListener("click", () => {
        modelTransform = { ...DEFAULT_MODEL_TRANSFORM };
        handlers.onModelTransformChange(modelTransform);
        setModelTransformFields(modelTransform);
      });
      wizardCompleteButton.addEventListener("click", () => {
        calibration = { ...calibration, calibrationComplete: true };
        handlers.onCalibrationChange(calibration);
      });

      root.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
        button.addEventListener("click", () => {
          updateWizardStep(button.dataset.step as WizardStep);
        });
      });

      root.querySelectorAll<HTMLButtonElement>("[data-nav-next]").forEach((button) => {
        button.addEventListener("click", () => {
          const currentIndex = WIZARD_STEPS.indexOf(button.dataset.navNext as WizardStep);
          updateWizardStep(WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, currentIndex + 1)]);
        });
      });

      root.querySelectorAll<HTMLButtonElement>("[data-nav-back]").forEach((button) => {
        button.addEventListener("click", () => {
          const currentIndex = WIZARD_STEPS.indexOf(button.dataset.navBack as WizardStep);
          updateWizardStep(WIZARD_STEPS[Math.max(0, currentIndex - 1)]);
        });
      });
    },
    setCalibration(next) {
      setCalibrationFields(next);
      if (next.calibrationComplete && currentStep !== "test") {
        updateWizardStep("test");
      }
    },
    setModelTransform(next) {
      setModelTransformFields(next);
    },
    setPreviewStream(stream) {
      previewVideo.srcObject = stream;
      previewShell.hidden = !calibration.showFacePreview || stream === null;
    },
    updateDebugPose(pose) {
      if (pose) {
        previewMarker.style.left = `${pose.debug.headCenterX * 100}%`;
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
            `faceScale: ${pose.debug.faceScale.toFixed(4)}`,
            `gazeX: ${pose.debug.gazeX.toFixed(3)}`,
            `gazeY: ${pose.debug.gazeY.toFixed(3)}`,
          ].join("\n")
        : "No tracking data yet.";
    },
  };
}

function renderCalibrationField(
  field: NumericCalibrationField,
  label: string,
  min: string,
  max: string,
  step: string
): string {
  return `
    <label class="field">
      <span>${label}</span>
      <input data-calibration-field="${field}" type="number" min="${min}" max="${max}" step="${step}" />
    </label>
  `;
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

function renderWizardActions(step: WizardStep): string {
  const isFirst = step === "screen";
  const isLast = step === "tracking";
  return `
    <div class="wizard-actions">
      ${
        isFirst
          ? ""
          : `<button data-nav-back="${step}" class="secondary">Back</button>`
      }
      ${
        isLast
          ? `<button data-nav-next="${step}" class="primary">Continue to Test</button>`
          : `<button data-nav-next="${step}" class="primary">Next</button>`
      }
    </div>
  `;
}
