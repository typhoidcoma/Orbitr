export type UiTone = "normal" | "warning" | "error";

export interface AppUi {
  canvasHost: HTMLDivElement;
  toggleTrackingButton: HTMLButtonElement;
  setTrackingEnabled: (enabled: boolean) => void;
  setStatus: (message: string, tone?: UiTone) => void;
  updateReticle: (x: number, y: number, confidence: number) => void;
}

export function createAppUi(root: HTMLElement): AppUi {
  root.innerHTML = `
    <div class="layout">
      <header class="toolbar">
        <div class="brand">
          <h1>Orbitr</h1>
          <p>Off-axis viewer with head and eye tracking</p>
        </div>
        <button id="tracking-toggle" class="primary">Start Tracking</button>
      </header>
      <div id="status" class="status">Viewer ready.</div>
      <main id="viewer-host" class="viewer-host">
        <div id="reticle" class="reticle"></div>
      </main>
    </div>
  `;

  const canvasHost = root.querySelector<HTMLDivElement>("#viewer-host");
  const toggleTrackingButton = root.querySelector<HTMLButtonElement>("#tracking-toggle");
  const status = root.querySelector<HTMLDivElement>("#status");
  const reticle = root.querySelector<HTMLDivElement>("#reticle");

  if (!canvasHost || !toggleTrackingButton || !status || !reticle) {
    throw new Error("UI mount failed: required elements not found.");
  }

  return {
    canvasHost,
    toggleTrackingButton,
    setTrackingEnabled(enabled) {
      toggleTrackingButton.textContent = enabled ? "Stop Tracking" : "Start Tracking";
      toggleTrackingButton.classList.toggle("active", enabled);
    },
    setStatus(message, tone = "normal") {
      status.textContent = message;
      status.dataset.tone = tone;
    },
    updateReticle(x, y, confidence) {
      const boundedX = Math.max(0, Math.min(1, x));
      const boundedY = Math.max(0, Math.min(1, y));
      const opacity = confidence > 0.35 ? 1 : 0.35;

      reticle.style.left = `${boundedX * 100}%`;
      reticle.style.top = `${boundedY * 100}%`;
      reticle.style.opacity = `${opacity}`;
    },
  };
}