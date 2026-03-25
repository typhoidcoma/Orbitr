import "./style.css";
import {
  loadViewerState,
  resetViewerState,
  saveViewerState,
} from "./lib/calibrationStorage";
import { parseViewerUrlParams } from "./lib/urlParams";
import { loadViewerModel } from "./model/loadModel";
import { FaceTracker } from "./tracking/faceTracker";
import { createAppUi } from "./ui/appUi";
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
  viewer.setModel(loadedModel.model);

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

  const tracker = new FaceTracker(
    {
      onFrame(frame) {
        viewer.setViewerPose(frame);
        ui.updateDebugPose(frame);
      },
      onError(message) {
        ui.setStatus(message, "error");
      },
      onPreviewStream(stream) {
        ui.setPreviewStream(stream);
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
      modelTransform = next;
      viewer.setModelTransform(next);
      ui.setModelTransform(next);
      persist();
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

  ui.toggleTrackingButton.addEventListener("click", async () => {
    if (tracker.isRunning()) {
      tracker.stop();
      ui.setTrackingEnabled(false);
      viewer.setTrackingEnabled(false);
      ui.updateDebugPose(null);
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
