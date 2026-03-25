import "./style.css";
import {
  loadViewerState,
  resetViewerState,
  saveViewerState,
} from "./lib/calibrationStorage";
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
  const faceMeshOverlay = new FaceMeshOverlay(
    app.querySelector<HTMLElement>("#face-preview-shell")!
  );

  if (loadedModel.warning) {
    ui.setStatus(loadedModel.warning, "warning");
  } else {
    ui.setStatus(
      calibration.calibrationComplete
        ? `Loaded model: ${loadedModel.resolvedUrl}. Re-open the wizard any time to refine calibration.`
        : `Loaded model: ${loadedModel.resolvedUrl}. Run the wizard, then capture a neutral pose.`
    );
  }

  const persist = (): void => {
    saveViewerState(calibration, modelTransform);
  };

  persist();

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
        ui.updateDebugPose(frame, viewer.getEffectiveScreenRect());
      },
      onError(message) {
        ui.setStatus(message, "error");
      },
      onPreviewStream(stream) {
        ui.setPreviewStream(stream);
        if (!stream) {
          faceMeshOverlay.clear();
        }
      },
      onLandmarks(landmarks) {
        if (calibration.showFacePreview) {
          faceMeshOverlay.draw(landmarks);
        }
      },
      onDiagnostics(diagnostics: TrackingDiagnostics) {
        if (!tracker.isRunning()) {
          return;
        }

        ui.updateNeutralProgress(
          diagnostics.stableFrameCount,
          calibration.neutralCaptureStableFrames
        );

        if (diagnostics.mode === "tracking") {
          ui.setStatus(
            calibration.calibrationComplete
              ? `${diagnostics.message} Close one eye and test left/right motion.`
              : `${diagnostics.message} Capture a neutral pose when you are seated normally.`
          );
          return;
        }

        if (diagnostics.mode === "invalid") {
          ui.setStatus(diagnostics.message, "warning");
          return;
        }

        if (diagnostics.mode === "searching") {
          ui.setStatus(diagnostics.message, "warning");
        }
      },
    },
    calibration
  );

  ui.bindHandlers({
    onCalibrationChange(next) {
      calibration = next;
      viewer.setCalibration(next);
      tracker.updateCalibration(next);
      ui.setCalibration(next);
      persist();
    },
    onAutoDetectDistance() {
      const faceWidth = tracker.getLatestFaceWidth();
      if (!faceWidth || faceWidth < 0.01) {
        ui.setStatus("Start tracking first so a face can be measured.", "warning");
        return;
      }
      // Average adult face is ~0.15m wide; estimate distance from normalized face width.
      // Assumes a typical webcam horizontal FOV of ~60 degrees.
      const FACE_WIDTH_METERS = 0.15;
      const ASSUMED_HFOV_RAD = (60 * Math.PI) / 180;
      const estimatedDistance =
        (FACE_WIDTH_METERS / (2 * faceWidth * Math.tan(ASSUMED_HFOV_RAD / 2)));
      const clamped = Math.max(0.25, Math.min(1.8, estimatedDistance));
      calibration = { ...calibration, neutralDistance: clamped };
      viewer.setCalibration(calibration);
      tracker.updateCalibration(calibration);
      ui.setCalibration(calibration);
      persist();
      ui.setStatus(`Auto-detected viewing distance: ${clamped.toFixed(2)} m`);
    },
    onCaptureNeutral() {
      const captured = tracker.captureNeutralPose();
      if (captured) {
        calibration = { ...calibration, calibrationComplete: true };
        viewer.setCalibration(calibration);
        tracker.updateCalibration(calibration);
        ui.setCalibration(calibration);
        persist();
      }

      ui.setStatus(
        captured
          ? "Neutral pose captured. Close one eye and test left/right and near/far motion."
          : "Tracking must be active before neutral pose can be captured.",
        captured ? "normal" : "warning"
      );
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
      ui.setCalibration(calibration);
      ui.setModelTransform(modelTransform);
      ui.setStatus("Calibration and model controls were reset to defaults.");
    },
  });

  const syncFullscreenButton = (): void => {
    ui.setFullscreenEnabled(getFullscreenElement() === ui.canvasHost);
    requestAnimationFrame(() => {
      viewer.resize();
    });
  };

  ui.fullscreenButton.addEventListener("click", async () => {
    try {
      if (getFullscreenElement() === ui.canvasHost) {
        await exitFullscreen();
      } else {
        await enterFullscreen(ui.canvasHost);
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

  let dragPointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  ui.canvasHost.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    dragPointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    ui.canvasHost.setPointerCapture(event.pointerId);
    ui.canvasHost.dataset.dragging = "1";
  });

  ui.canvasHost.addEventListener("pointermove", (event) => {
    if (dragPointerId !== event.pointerId) {
      return;
    }

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
    if (dragPointerId !== event.pointerId) {
      return;
    }

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
      const depthStep = 0.0008 * event.deltaY;
      applyModelTransform({
        ...modelTransform,
        positionZ: modelTransform.positionZ + depthStep,
      });
    },
    { passive: false }
  );

  ui.toggleTrackingButton.addEventListener("click", async () => {
    if (tracker.isRunning()) {
      tracker.stop();
      ui.setTrackingEnabled(false);
      viewer.setTrackingEnabled(false);
      latestDebugPose = null;
      ui.updateDebugPose(null, viewer.getEffectiveScreenRect());
      ui.setStatus("Tracking stopped. Viewer returned to the calibrated neutral eye position.");
      return;
    }

    try {
      await tracker.start();
      ui.setTrackingEnabled(true);
      viewer.setTrackingEnabled(true);
      ui.setStatus(
        getFullscreenElement() === ui.canvasHost
          ? "Tracking active. Capture neutral pose, then test the window illusion."
          : "Tracking active. Fullscreen is recommended before judging the illusion."
      );
    } catch {
      ui.setTrackingEnabled(false);
      viewer.setTrackingEnabled(false);
    }
  });

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
