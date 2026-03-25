import "./style.css";
import {
  loadViewerState,
  resetViewerState,
  saveViewerState,
} from "./lib/calibrationStorage";
import { AutoCalibrator, guessScreenDiagonalCm, screenDimensionsFromDiagonal } from "./lib/autoCalibrate";
import { DEFAULT_MODEL_TRANSFORM } from "./lib/parallaxConfig";
import { parseViewerUrlParams } from "./lib/urlParams";
import { loadViewerModel } from "./model/loadModel";
import { FaceTracker, type TrackingDiagnostics } from "./tracking/faceTracker";
import type { ViewerPose } from "./tracking/normalizeTracking";
import { createAppUi } from "./ui/appUi";
import { FaceMeshOverlay } from "./ui/faceMeshOverlay";
import { Viewer } from "./viewer/viewer";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(): Element | null {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

async function enterFullscreen(element: HTMLElement): Promise<void> {
  const fullscreenElement = element as FullscreenElement;
  if (fullscreenElement.requestFullscreen) {
    await fullscreenElement.requestFullscreen();
    return;
  }
  if (fullscreenElement.webkitRequestFullscreen) {
    await fullscreenElement.webkitRequestFullscreen();
    return;
  }
  throw new Error("This browser does not support fullscreen mode for this element.");
}

async function exitFullscreen(): Promise<void> {
  const fullscreenDocument = document as FullscreenDocument;
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (fullscreenDocument.webkitExitFullscreen) {
    await fullscreenDocument.webkitExitFullscreen();
    return;
  }
  throw new Error("This browser does not support exiting fullscreen mode.");
}

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) {
    throw new Error("#app was not found in index.html");
  }

  let persistedState = loadViewerState();

  // Auto-detect screen size if not already calibrated
  if (!persistedState.calibration.calibrationComplete) {
    const diagonal = guessScreenDiagonalCm();
    const dims = screenDimensionsFromDiagonal(diagonal);
    persistedState = {
      ...persistedState,
      calibration: {
        ...persistedState.calibration,
        screenWidth: dims.width,
        screenHeight: dims.height,
      },
    };
  }

  const params = parseViewerUrlParams(window.location.search, persistedState);
  let calibration = params.calibration;
  let modelTransform = params.modelTransform;

  const ui = createAppUi(app, calibration, modelTransform);
  const viewer = new Viewer(ui.canvasHost, {
    near: params.near,
    far: params.far,
    calibration,
    modelTransform,
  });

  const loadedModel = await loadViewerModel(params.modelUrl);
  modelTransform = { ...DEFAULT_MODEL_TRANSFORM };
  viewer.setModelTransform(modelTransform);
  ui.setModelTransform(modelTransform);
  viewer.setModel(loadedModel.model);
  let latestDebugPose: ViewerPose | null = null;

  const pipElement = app.querySelector<HTMLElement>("#calibration-pip");
  const faceMeshOverlay = pipElement ? new FaceMeshOverlay(pipElement) : null;

  if (loadedModel.warning) {
    ui.setStatus(loadedModel.warning, "warning");
  }

  const persist = (): void => {
    saveViewerState(calibration, modelTransform);
  };

  persist();

  const applyCalibration = (next: typeof calibration): void => {
    calibration = next;
    viewer.setCalibration(next);
    tracker.updateCalibration(next);
    ui.setCalibration(next);
    persist();
  };

  const applyModelTransform = (next: typeof modelTransform): void => {
    modelTransform = next;
    viewer.setModelTransform(next);
    ui.setModelTransform(next);
    persist();
  };

  const tracker = new FaceTracker(
    {
      onFrame(frame) {
        latestDebugPose = frame;
        viewer.setViewerPose(frame);
      },
      onError(message) {
        ui.setStatus(message, "error");
      },
      onPreviewStream(stream) {
        ui.setPreviewStream(stream);
        if (!stream) {
          faceMeshOverlay?.clear();
        }
      },
      onLandmarks(landmarks) {
        if (calibration.showFacePreview) {
          faceMeshOverlay?.draw(landmarks);
        }
      },
      onDiagnostics(diagnostics: TrackingDiagnostics) {
        if (!tracker.isRunning()) return;

        // Let the auto-calibrator handle diagnostics during calibration
        autoCalibrator.handleDiagnostics(diagnostics);

        // After calibration is done, show live status
        if (!autoCalibrator.isCalibrating()) {
          if (diagnostics.mode === "invalid") {
            ui.setStatus(diagnostics.message, "warning");
          } else if (diagnostics.mode === "searching") {
            ui.setStatus("Looking for your face...", "warning");
          }
        }
      },
    },
    calibration
  );

  const autoCalibrator = new AutoCalibrator(tracker, calibration, {
    onPhaseChange(phase, message) {
      if (phase === "failed") {
        ui.setStatus(message, "error");
        ui.setTrackingActive(false);
        viewer.setTrackingEnabled(false);
      } else {
        ui.setStatus(message);
      }
    },
    onCalibrationUpdate(next) {
      applyCalibration(next);
    },
    onReady() {
      viewer.setTrackingEnabled(true);
      ui.setTrackingActive(true);
      ui.setStatus("Ready! Move around to see the effect.");
    },
    onFailed(reason) {
      ui.setStatus(reason, "error");
      ui.setTrackingActive(false);
    },
  });

  ui.bindHandlers({
    onCalibrationChange(next) {
      applyCalibration(next);
      autoCalibrator.updateCalibration(next);
    },
    onModelTransformChange(next) {
      applyModelTransform(next);
    },
    onResetState() {
      persistedState = resetViewerState();
      calibration = persistedState.calibration;
      modelTransform = persistedState.modelTransform;
      viewer.setCalibration(calibration);
      viewer.setModelTransform(modelTransform);
      tracker.updateCalibration(calibration);
      autoCalibrator.updateCalibration(calibration);
      ui.setCalibration(calibration);
      ui.setModelTransform(modelTransform);
      ui.setStatus("All settings reset to defaults.");
    },
  });

  // Fullscreen
  const syncFullscreenButton = (): void => {
    ui.setFullscreenEnabled(getFullscreenElement() != null);
    // The container is position:fixed;inset:0 so it always matches the viewport.
    // After fullscreen change, the container resizes and ResizeObserver fires.
    // But as a safety net, also trigger manual resizes with delays.
    requestAnimationFrame(() => viewer.resize());
    setTimeout(() => viewer.resize(), 150);
    setTimeout(() => viewer.resize(), 500);
  };

  ui.fullscreenButton.addEventListener("click", async () => {
    try {
      if (getFullscreenElement()) {
        await exitFullscreen();
      } else {
        await enterFullscreen(document.documentElement);
      }
    } catch (error) {
      ui.setStatus(
        `Fullscreen unavailable: ${error instanceof Error ? error.message : "Unknown browser error"}`,
        "warning"
      );
    }
  });

  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton as EventListener);
  syncFullscreenButton();

  // Drag & scroll model positioning
  let dragPointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  ui.canvasHost.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragPointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    ui.canvasHost.setPointerCapture(event.pointerId);
    ui.canvasHost.dataset.dragging = "1";
  });

  ui.canvasHost.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId) return;
    const rect = ui.canvasHost.getBoundingClientRect();
    const effectiveScreen = viewer.getEffectiveScreenRect();
    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    const moveX = (deltaX / Math.max(1, rect.width)) * effectiveScreen.width;
    const moveY = (-deltaY / Math.max(1, rect.height)) * effectiveScreen.height;
    applyModelTransform({
      ...modelTransform,
      positionX: modelTransform.positionX + moveX,
      positionY: modelTransform.positionY + moveY,
    });
  });

  const endDrag = (event: PointerEvent): void => {
    if (dragPointerId !== event.pointerId) return;
    ui.canvasHost.releasePointerCapture(event.pointerId);
    dragPointerId = null;
    delete ui.canvasHost.dataset.dragging;
  };

  ui.canvasHost.addEventListener("pointerup", endDrag);
  ui.canvasHost.addEventListener("pointercancel", endDrag);

  ui.canvasHost.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const depthStep = 0.08 * event.deltaY;
      applyModelTransform({
        ...modelTransform,
        positionZ: modelTransform.positionZ + depthStep,
      });
    },
    { passive: false }
  );

  // Start / Stop FAB
  ui.startButton.addEventListener("click", async () => {
    if (tracker.isRunning()) {
      tracker.stop();
      autoCalibrator.stop();
      ui.setTrackingActive(false);
      viewer.setTrackingEnabled(false);
      latestDebugPose = null;
      ui.updateDebugPose(null, viewer.getEffectiveScreenRect());
      ui.setStatus("Tracking stopped.");
      return;
    }

    ui.startButton.disabled = true;
    await autoCalibrator.run(calibration.calibrationComplete);
    ui.startButton.disabled = false;
  });

  // Render loop
  const animate = (): void => {
    viewer.frame();
    ui.updateDebugPose(latestDebugPose, viewer.getEffectiveScreenRect());
    requestAnimationFrame(animate);
  };

  animate();

  window.addEventListener("beforeunload", () => {
    document.removeEventListener("fullscreenchange", syncFullscreenButton);
    document.removeEventListener("webkitfullscreenchange", syncFullscreenButton as EventListener);
    tracker.stop();
    viewer.dispose();
  });
}

bootstrap().catch((error) => {
  console.error(error);
  const app = document.querySelector<HTMLElement>("#app");
  if (app) {
    app.innerHTML = `<pre class="fatal">Failed to start Orbitr: ${(error as Error).message}</pre>`;
  }
});
