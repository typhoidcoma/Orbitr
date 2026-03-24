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

  const ui = createAppUi(app);
  const params = parseViewerUrlParams(window.location.search);
  const viewer = new Viewer(ui.canvasHost, {
    fov: params.fov,
    near: params.near,
    far: params.far,
    shiftX: params.shiftX,
    shiftY: params.shiftY,
  });

  const loadedModel = await loadViewerModel(params.modelUrl);
  viewer.setModel(loadedModel.model);

  if (loadedModel.warning) {
    ui.setStatus(loadedModel.warning, "warning");
  } else {
    ui.setStatus(`Loaded model: ${loadedModel.resolvedUrl}`);
  }

  const tracker = new FaceTracker({
    onFrame(frame) {
      viewer.setHeadInput({
        yaw: frame.headYaw,
        pitch: frame.headPitch,
      });
      ui.updateReticle(frame.eyeX, frame.eyeY, frame.confidence);
    },
    onError(message) {
      ui.setStatus(message, "error");
    },
  });

  ui.toggleTrackingButton.addEventListener("click", async () => {
    if (tracker.isRunning()) {
      tracker.stop();
      ui.setTrackingEnabled(false);
      ui.setStatus("Tracking stopped.");
      return;
    }

    try {
      await tracker.start();
      ui.setTrackingEnabled(true);
      ui.setStatus("Tracking active. Move your head to steer and eyes to move reticle.");
    } catch {
      ui.setTrackingEnabled(false);
    }
  });

  const animate = (): void => {
    viewer.frame();
    requestAnimationFrame(animate);
  };

  animate();

  window.addEventListener("beforeunload", () => {
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