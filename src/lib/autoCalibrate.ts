import type { FaceTracker } from "../tracking/faceTracker";
import type { TrackingDiagnostics } from "../tracking/faceTracker";
import type { ParallaxCalibration } from "./parallaxConfig";

export type AutoCalibrationPhase =
  | "idle"
  | "requesting-camera"
  | "loading-mediapipe"
  | "detecting-face"
  | "detecting-distance"
  | "capturing-neutral"
  | "ready"
  | "failed";

export interface AutoCalibrateCallbacks {
  onPhaseChange: (phase: AutoCalibrationPhase, message: string) => void;
  onCalibrationUpdate: (calibration: ParallaxCalibration) => void;
  onReady: () => void;
  onFailed: (reason: string) => void;
}

const FACE_DETECT_TIMEOUT_MS = 10_000;
const NEUTRAL_CAPTURE_TIMEOUT_MS = 8_000;
const FACE_WIDTH_CM = 15;
const ASSUMED_HFOV_RAD = (60 * Math.PI) / 180;

/** Estimate viewing distance in cm from normalized face width. */
export function estimateViewingDistance(faceWidth: number): number {
  if (faceWidth < 0.01) return 68;
  return Math.max(25, Math.min(180, FACE_WIDTH_CM / (2 * faceWidth * Math.tan(ASSUMED_HFOV_RAD / 2))));
}

export class AutoCalibrator {
  private phase: AutoCalibrationPhase = "idle";
  private faceTimeout = 0;
  private neutralTimeout = 0;
  private readonly tracker: FaceTracker;
  private calibration: ParallaxCalibration;
  private readonly callbacks: AutoCalibrateCallbacks;

  constructor(tracker: FaceTracker, calibration: ParallaxCalibration, callbacks: AutoCalibrateCallbacks) {
    this.tracker = tracker;
    this.calibration = calibration;
    this.callbacks = callbacks;
  }

  public updateCalibration(calibration: ParallaxCalibration): void {
    this.calibration = calibration;
  }

  public async run(skipCalibration: boolean): Promise<void> {
    if (this.phase !== "idle" && this.phase !== "failed") return;

    this.setPhase("requesting-camera", "Starting camera...");

    try {
      await this.tracker.start();
    } catch {
      this.setPhase("failed", "Camera access denied or unavailable.");
      this.callbacks.onFailed("Camera access denied or unavailable.");
      return;
    }

    if (skipCalibration) {
      this.setPhase("ready", "Tracking active. Move around to see the effect.");
      this.callbacks.onReady();
      return;
    }

    this.setPhase("detecting-face", "Looking for your face...");
    this.faceTimeout = window.setTimeout(() => {
      if (this.phase === "detecting-face") {
        this.setPhase("ready", "No face detected — using defaults. Move around to test.");
        this.callbacks.onReady();
      }
    }, FACE_DETECT_TIMEOUT_MS);
  }

  public handleDiagnostics(diagnostics: TrackingDiagnostics): void {
    if (this.phase === "detecting-face" && diagnostics.mode === "tracking") {
      clearTimeout(this.faceTimeout);
      this.detectDistance();
      return;
    }

    if (this.phase === "capturing-neutral") {
      const required = this.calibration.neutralCaptureStableFrames;
      const count = diagnostics.stableFrameCount;
      this.callbacks.onPhaseChange("capturing-neutral", `Hold still... ${Math.min(count, required)}/${required}`);

      if (count >= required) {
        clearTimeout(this.neutralTimeout);
        this.captureNeutral();
      }
    }
  }

  public stop(): void {
    clearTimeout(this.faceTimeout);
    clearTimeout(this.neutralTimeout);
    this.phase = "idle";
  }

  public getPhase(): AutoCalibrationPhase {
    return this.phase;
  }

  public isCalibrating(): boolean {
    return this.phase !== "idle" && this.phase !== "ready" && this.phase !== "failed";
  }

  private detectDistance(): void {
    const faceWidth = this.tracker.getLatestFaceWidth();
    if (faceWidth && faceWidth >= 0.01) {
      const distance = estimateViewingDistance(faceWidth);
      this.calibration = { ...this.calibration, neutralDistance: distance };
      this.callbacks.onCalibrationUpdate(this.calibration);
      this.setPhase("detecting-distance", `Distance: ~${Math.round(distance)}cm`);
    }

    this.setPhase("capturing-neutral", "Hold still...");
    this.neutralTimeout = window.setTimeout(() => {
      if (this.phase === "capturing-neutral") {
        this.captureNeutral();
      }
    }, NEUTRAL_CAPTURE_TIMEOUT_MS);
  }

  private captureNeutral(): void {
    this.tracker.captureNeutralPose();
    this.calibration = { ...this.calibration, calibrationComplete: true };
    this.callbacks.onCalibrationUpdate(this.calibration);
    this.setPhase("ready", "Ready! Move around to see the effect.");
    this.callbacks.onReady();
  }

  private setPhase(phase: AutoCalibrationPhase, message: string): void {
    this.phase = phase;
    this.callbacks.onPhaseChange(phase, message);
  }
}

/** Estimate screen diagonal in cm from resolution and pixel ratio heuristics. */
export function guessScreenDiagonalCm(): number {
  const w = window.screen.width;
  const dpr = window.devicePixelRatio;
  const physicalW = w * dpr;

  // High-DPI small screens (laptops, tablets)
  if (dpr > 1.5 && w < 2000) return 35.6;  // ~14"
  if (dpr > 1.5 && w < 2600) return 40.6;  // ~16"

  // Desktop heuristics based on resolution
  if (physicalW >= 3840) return 68.6;       // ~27" (4K)
  if (physicalW >= 2560) return 68.6;       // ~27"
  if (physicalW >= 1920) return 61;         // ~24"

  return 61; // safe default (~24")
}

/** Convert screen diagonal (cm) to physical width/height in cm. */
export function screenDimensionsFromDiagonal(diagonalCm: number): { width: number; height: number } {
  const aspect = window.screen.width / window.screen.height;
  const height = diagonalCm / Math.sqrt(1 + aspect * aspect);
  const width = height * aspect;
  return { width, height };
}
