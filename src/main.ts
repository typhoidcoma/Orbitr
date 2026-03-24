import "./style.css";
import { parseViewerUrlParams } from "./lib/urlParams";
import { loadViewerModel } from "./model/loadModel";
import { FaceTracker } from "./tracking/faceTracker";
import { createAppUi } from "./ui/appUi";
import { Viewer } from "./viewer/viewer";

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLElement>("#app");
  if (!app) {
    throw new Error("#app was not found in index.html");
  }

  const params = parseViewerUrlParams(window.location.search);
  const ui = createAppUi(app, params.calibration);
  const viewer = new Viewer(ui.canvasHost, {
    near: params.near,
    far: params.far,
    calibration: params.calibration,
  });

  const loadedModel = await loadViewerModel(params.modelUrl);
  viewer.setModel(loadedModel.model);

  if (loadedModel.warning) {
    ui.setStatus(loadedModel.warning, "warning");
  } else {
    ui.setStatus(
      `Loaded model: ${loadedModel.resolvedUrl}. Pick a monitor preset, then capture a neutral pose.`
    );
  }

  const tracker = new FaceTracker(
    {
      onFrame(frame) {
        viewer.setViewerPose(frame);
        ui.updateDebugPose(frame);
      },
      onError(message) {
        ui.setStatus(message, "error");
      },
    },
    params.calibration
  );

  ui.bindCalibrationHandlers({
    onCalibrationChange(next) {
      viewer.setCalibration(next);
      tracker.updateCalibration(next);
      ui.setCalibration(next);
    },
    onCaptureNeutral() {
      const captured = tracker.captureNeutralPose();
      ui.setStatus(
        captured
          ? "Neutral pose captured. Close one eye and move around the screen to judge the window illusion."
          : "Tracking must be active before neutral pose can be captured.",
        captured ? "normal" : "warning"
      );
    },
  });

  const syncFullscreenButton = (): void => {
    ui.setFullscreenEnabled(document.fullscreenElement === ui.canvasHost);
    requestAnimationFrame(() => {
      viewer.resize();
    });
  };

  ui.fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === ui.canvasHost) {
        await document.exitFullscreen();
      } else {
        await ui.canvasHost.requestFullscreen();
      }
    } catch (error) {
      ui.setStatus(
        `Fullscreen unavailable: ${error instanceof Error ? error.message : "Unknown browser error"}`,
        "warning"
      );
    }
  });

  document.addEventListener("fullscreenchange", syncFullscreenButton);
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
        document.fullscreenElement === ui.canvasHost
          ? "Tracking active. Hold your usual viewing position, then click Capture Neutral Pose."
          : "Tracking active. Fullscreen is recommended for the best window illusion, then click Capture Neutral Pose."
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
