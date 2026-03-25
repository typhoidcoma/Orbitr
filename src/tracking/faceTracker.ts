import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Euler, Matrix4 } from "three";
import type { ParallaxCalibration } from "../lib/parallaxConfig";
import { smoothValue } from "../lib/smoothing";
import {
  assessTrackingObservation,
  createNeutralPose,
  normalizeTrackingObservation,
  type RawTrackingObservation,
  type TrackingNeutralPose,
  type ViewerPose,
} from "./normalizeTracking";

const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const FACE_TASK_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

interface TrackerCallbacks {
  onFrame: (frame: TrackingFrame) => void;
  onError: (message: string) => void;
  onPreviewStream?: (stream: MediaStream | null) => void;
  onDiagnostics?: (diagnostics: TrackingDiagnostics) => void;
}

export type TrackingFrame = ViewerPose;

export interface TrackingDiagnostics {
  mode: "idle" | "searching" | "invalid" | "tracking";
  message: string;
  stableFrameCount: number;
  confidence: number;
}

export class FaceTracker {
  private readonly callbacks: TrackerCallbacks;
  private landmarker: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private running = false;
  private rafId = 0;
  private calibration: ParallaxCalibration;
  private neutralPose: TrackingNeutralPose | null = null;
  private latestObservation: RawTrackingObservation | null = null;
  private stableFrameCount = 0;
  private smoothed: TrackingFrame;

  constructor(callbacks: TrackerCallbacks, calibration: ParallaxCalibration) {
    this.callbacks = callbacks;
    this.calibration = calibration;
    this.smoothed = createEmptyTrackingFrame(calibration);
  }

  public async start(): Promise<void> {
    if (this.running) {
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      this.video = document.createElement("video");
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      this.callbacks.onPreviewStream?.(this.stream);

      this.landmarker = await this.createLandmarker();
      this.running = true;
      this.tick();
    } catch (error) {
      this.stop();
      const details = error instanceof Error ? error.message : "Unknown webcam/tracker error";
      this.callbacks.onError(`Tracking unavailable: ${details}`);
      throw error;
    }
  }

  public updateCalibration(calibration: ParallaxCalibration): void {
    this.calibration = calibration;
  }

  public captureNeutralPose(): boolean {
    if (
      !this.latestObservation ||
      this.stableFrameCount < this.calibration.neutralCaptureStableFrames
    ) {
      return false;
    }

    this.neutralPose = createNeutralPose(this.latestObservation, null);
    return true;
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);

    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }

    this.stableFrameCount = 0;
    this.callbacks.onDiagnostics?.({
      mode: "idle",
      message: "Tracking stopped.",
      stableFrameCount: 0,
      confidence: 0,
    });
    this.callbacks.onPreviewStream?.(null);
  }

  public isRunning(): boolean {
    return this.running;
  }

  private async createLandmarker(): Promise<FaceLandmarker> {
    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
    const options = {
      baseOptions: {
        modelAssetPath: FACE_TASK_MODEL_URL,
        delegate: "GPU" as const,
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO" as const,
      numFaces: 1,
      minFaceDetectionConfidence: this.calibration.minFaceDetectionConfidence,
      minFacePresenceConfidence: this.calibration.minFacePresenceConfidence,
      minTrackingConfidence: this.calibration.minTrackingConfidence,
    };

    try {
      return await FaceLandmarker.createFromOptions(vision, options);
    } catch {
      return FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: {
          ...options.baseOptions,
          delegate: "CPU",
        },
      });
    }
  }

  private tick = (): void => {
    if (!this.running || !this.landmarker || !this.video) {
      return;
    }

    const result = this.landmarker.detectForVideo(this.video, performance.now());
    const observation = this.extractFrame(result);

    if (!observation) {
      this.stableFrameCount = 0;
      this.callbacks.onDiagnostics?.({
        mode: "searching",
        message: "Camera is running, but no face landmarks are being produced.",
        stableFrameCount: 0,
        confidence: 0,
      });
      this.callbacks.onFrame(this.smoothed);
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    this.latestObservation = observation;
    this.neutralPose ??= createNeutralPose(observation, null);

    const assessment = assessTrackingObservation(
      observation,
      this.neutralPose,
      this.calibration
    );

    if (assessment.isValid) {
      const normalized = normalizeTrackingObservation(
        observation,
        this.neutralPose,
        this.calibration
      );
      this.smoothed = stabilizeFrame(this.smoothed, normalized, this.calibration);
      this.stableFrameCount = assessment.isStableForNeutralCapture
        ? this.stableFrameCount + 1
        : 0;
      this.callbacks.onDiagnostics?.({
        mode: "tracking",
        message: `Tracking live. confidence=${observation.confidence.toFixed(2)} stableFrames=${this.stableFrameCount}`,
        stableFrameCount: this.stableFrameCount,
        confidence: observation.confidence,
      });
    } else {
      this.stableFrameCount = 0;
      this.callbacks.onDiagnostics?.({
        mode: "invalid",
        message:
          "Face detected, but frames are failing validation. Lower the confidence thresholds in Advanced Calibration.",
        stableFrameCount: 0,
        confidence: observation.confidence,
      });
    }

    this.callbacks.onFrame(this.smoothed);

    this.rafId = requestAnimationFrame(this.tick);
  };

  private extractFrame(result: FaceLandmarkerResult): RawTrackingObservation | null {
    const matrixData = result.facialTransformationMatrixes?.[0]?.data;
    const landmarks = result.faceLandmarks?.[0];

    if (!landmarks) {
      return null;
    }

    let yaw = 0;
    let pitch = 0;
    if (matrixData) {
      const matrix = new Matrix4().fromArray(Array.from(matrixData));
      const euler = new Euler().setFromRotationMatrix(matrix, "YXZ");
      yaw = clampSigned(euler.y / 0.8, -1, 1);
      pitch = clampSigned(euler.x / 0.65, -1, 1);
    }

    const leftEye = averagePoints(landmarks, [33, 133, 159, 145, 160, 144, 158, 153]);
    const rightEye = averagePoints(landmarks, [362, 263, 386, 374, 387, 373, 385, 380]);
    const irisLeft = landmarks[468] ?? leftEye;
    const irisRight = landmarks[473] ?? rightEye;
    const eyeMidpoint = midpoint(leftEye, rightEye);
    const noseTip = landmarks[1] ?? eyeMidpoint;
    const mouthCenter = averagePoints(landmarks, [13, 14, 78, 308]);
    const headCenter = weightedCenter([
      { point: eyeMidpoint, weight: 0.45 },
      { point: noseTip, weight: 0.35 },
      { point: mouthCenter, weight: 0.2 },
    ]);
    const eyeSeparation = Math.max(0.001, distance2d(leftEye, rightEye));
    const faceLeft = landmarks[234] ?? leftEye;
    const faceRight = landmarks[454] ?? rightEye;
    const browCenter = averagePoints(landmarks, [9, 107, 336]);
    const chinCenter = landmarks[152] ?? mouthCenter;
    const faceWidth = Math.max(0.001, distance2d(faceLeft, faceRight));
    const faceHeight = Math.max(0.001, distance2d(browCenter, chinCenter));
    const faceScale = eyeSeparation * 0.4 + faceWidth * 0.35 + faceHeight * 0.25;
    const gazeX = clampSigned(
      ((irisLeft.x - leftEye.x) + (irisRight.x - rightEye.x)) * 0.5 / eyeSeparation,
      -1,
      1
    );
    const gazeY = clampSigned(
      ((irisLeft.y - leftEye.y) + (irisRight.y - rightEye.y)) * 0.5 / eyeSeparation,
      -1,
      1
    );
    const { detectionConfidence, presenceConfidence, trackingConfidence, confidence } =
      estimateObservationConfidence({
        hasMatrix: Boolean(matrixData),
        landmarks,
        faceWidth,
        faceHeight,
        faceScale,
        eyeSeparation,
      });

    return {
      headCenterX: headCenter.x,
      headCenterY: headCenter.y,
      eyeSeparation,
      faceWidth,
      faceHeight,
      faceScale,
      gazeX,
      gazeY,
      yaw,
      pitch,
      confidence,
      detectionConfidence,
      presenceConfidence,
      trackingConfidence,
    };
  }
}

function estimateObservationConfidence(input: {
  hasMatrix: boolean;
  landmarks: Array<{ x: number; y: number }>;
  faceWidth: number;
  faceHeight: number;
  faceScale: number;
  eyeSeparation: number;
}): {
  detectionConfidence: number;
  presenceConfidence: number;
  trackingConfidence: number;
  confidence: number;
} {
  const requiredLandmarks = [
    1, 9, 13, 14, 33, 78, 107, 133, 145, 152, 153, 158, 159, 160, 234, 263, 308, 336, 362,
    373, 374, 380, 385, 386, 387, 454, 468, 473,
  ];
  const visibleRequired = requiredLandmarks.reduce((count, index) => {
    const point = input.landmarks[index];
    if (!point) {
      return count;
    }

    const inBounds =
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= -0.1 &&
      point.x <= 1.1 &&
      point.y >= -0.1 &&
      point.y <= 1.1;

    return count + (inBounds ? 1 : 0);
  }, 0);

  const landmarkCoverage = visibleRequired / requiredLandmarks.length;
  const geometryScore =
    input.faceWidth > 0.01 &&
    input.faceHeight > 0.01 &&
    input.faceScale > 0.01 &&
    input.eyeSeparation > 0.005
      ? 1
      : 0;
  const matrixScore = input.hasMatrix ? 1 : 0;

  const confidence = clamp01(landmarkCoverage * 0.7 + geometryScore * 0.2 + matrixScore * 0.1);

  return {
    detectionConfidence: confidence,
    presenceConfidence: confidence,
    trackingConfidence: confidence,
    confidence,
  };
}

function averagePoints(
  points: Array<{ x: number; y: number }>,
  indices: number[]
): { x: number; y: number } {
  const sum = indices.reduce(
    (acc, index) => {
      const point = points[index];
      if (!point) {
        return acc;
      }

      return {
        x: acc.x + point.x,
        y: acc.y + point.y,
        count: acc.count + 1,
      };
    },
    { x: 0, y: 0, count: 0 }
  );

  if (sum.count === 0) {
    return { x: 0.5, y: 0.5 };
  }

  return {
    x: sum.x / sum.count,
    y: sum.y / sum.count,
  };
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
}

function weightedCenter(
  items: Array<{ point: { x: number; y: number }; weight: number }>
): { x: number; y: number } {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    return { x: 0.5, y: 0.5 };
  }

  const weighted = items.reduce(
    (acc, item) => ({
      x: acc.x + item.point.x * item.weight,
      y: acc.y + item.point.y * item.weight,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: weighted.x / totalWeight,
    y: weighted.y / totalWeight,
  };
}

function clampSigned(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function stabilizeFrame(
  previous: TrackingFrame,
  next: TrackingFrame,
  calibration: ParallaxCalibration
): TrackingFrame {
  const confidenceAlpha = 0.35 + next.confidence * 0.5;
  const headAlpha = clamp01(calibration.headSmoothing + confidenceAlpha * 0.15);
  const depthAlpha = clamp01(calibration.depthSmoothing + confidenceAlpha * 0.15);
  const gazeAlpha = clamp01(calibration.gazeSmoothing + confidenceAlpha * 0.1);

  const clampedEyeX = clampDelta(previous.eyeX, next.eyeX, calibration.maxEyeDeltaX);
  const clampedEyeY = clampDelta(previous.eyeY, next.eyeY, calibration.maxEyeDeltaY);
  const clampedEyeZ = clampDelta(previous.eyeZ, next.eyeZ, calibration.maxEyeDeltaZ);

  return {
    ...next,
    eyeX: smoothValue(previous.eyeX, clampedEyeX, headAlpha),
    eyeY: smoothValue(previous.eyeY, clampedEyeY, headAlpha),
    eyeZ: smoothValue(previous.eyeZ, clampedEyeZ, depthAlpha),
    yaw: smoothValue(previous.yaw, next.yaw, headAlpha),
    pitch: smoothValue(previous.pitch, next.pitch, headAlpha),
    debug: {
      ...next.debug,
      gazeX: smoothValue(previous.debug.gazeX, next.debug.gazeX, gazeAlpha),
      gazeY: smoothValue(previous.debug.gazeY, next.debug.gazeY, gazeAlpha),
    },
  };
}

function clampDelta(previous: number, next: number, maxDelta: number): number {
  const delta = next - previous;
  if (Math.abs(delta) <= maxDelta) {
    return next;
  }

  return previous + Math.sign(delta) * maxDelta;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createEmptyTrackingFrame(calibration: ParallaxCalibration): TrackingFrame {
  const neutralDistance = calibration.neutralDistance + calibration.cameraOffsetZ;
  return {
    eyeX: calibration.cameraOffsetX,
    eyeY: calibration.cameraOffsetY,
    eyeZ: neutralDistance,
    yaw: 0,
    pitch: 0,
    confidence: 0,
    debug: {
      headCenterX: 0.5,
      headCenterY: 0.5,
      eyeSeparation: 0,
      faceWidth: 0,
      faceHeight: 0,
      faceScale: 0,
      estimatedDistance: neutralDistance,
      headOffsetX: 0,
      headOffsetY: 0,
      gazeX: 0,
      gazeY: 0,
      detectionConfidence: 0,
      presenceConfidence: 0,
      trackingConfidence: 0,
    },
  };
}
