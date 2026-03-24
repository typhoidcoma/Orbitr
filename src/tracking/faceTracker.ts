import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Euler, Matrix4 } from "three";
import type { ParallaxCalibration } from "../lib/parallaxConfig";
import { smoothValue } from "../lib/smoothing";
import {
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
}

export type TrackingFrame = ViewerPose;

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
  private smoothed: TrackingFrame = createEmptyTrackingFrame();

  constructor(callbacks: TrackerCallbacks, calibration: ParallaxCalibration) {
    this.callbacks = callbacks;
    this.calibration = calibration;
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
    if (!this.latestObservation) {
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
  }

  public isRunning(): boolean {
    return this.running;
  }

  private async createLandmarker(): Promise<FaceLandmarker> {
    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);

    try {
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_TASK_MODEL_URL,
          delegate: "GPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
    } catch {
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_TASK_MODEL_URL,
          delegate: "CPU",
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
    }
  }

  private tick = (): void => {
    if (!this.running || !this.landmarker || !this.video) {
      return;
    }

    const result = this.landmarker.detectForVideo(this.video, performance.now());
    const observation = this.extractFrame(result);

    if (observation) {
      this.latestObservation = observation;
      this.neutralPose ??= createNeutralPose(observation, null);

      const normalized = normalizeTrackingObservation(
        observation,
        this.neutralPose,
        this.calibration
      );
      const alpha = this.calibration.smoothing;

      this.smoothed = {
        ...normalized,
        eyeX: smoothValue(this.smoothed.eyeX, normalized.eyeX, alpha),
        eyeY: smoothValue(this.smoothed.eyeY, normalized.eyeY, alpha),
        eyeZ: smoothValue(this.smoothed.eyeZ, normalized.eyeZ, alpha),
        yaw: smoothValue(this.smoothed.yaw, normalized.yaw, alpha),
        pitch: smoothValue(this.smoothed.pitch, normalized.pitch, alpha),
      };

      this.callbacks.onFrame(this.smoothed);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private extractFrame(result: FaceLandmarkerResult): RawTrackingObservation | null {
    const matrixData = result.facialTransformationMatrixes?.[0]?.data;
    const landmarks = result.faceLandmarks?.[0];

    if (!matrixData || !landmarks) {
      return null;
    }

    const matrix = new Matrix4().fromArray(Array.from(matrixData));
    const euler = new Euler().setFromRotationMatrix(matrix, "YXZ");
    const yaw = clampSigned(euler.y / 0.8, -1, 1);
    const pitch = clampSigned(euler.x / 0.65, -1, 1);

    const leftEye = averagePoints(landmarks, [33, 133, 159, 145]);
    const rightEye = averagePoints(landmarks, [362, 263, 386, 374]);
    const irisLeft = landmarks[468] ?? leftEye;
    const irisRight = landmarks[473] ?? rightEye;
    const eyeMidpoint = {
      x: (leftEye.x + rightEye.x) * 0.5,
      y: (leftEye.y + rightEye.y) * 0.5,
    };
    const noseTip = landmarks[1] ?? eyeMidpoint;
    const headCenter = {
      x: (eyeMidpoint.x + noseTip.x) * 0.5,
      y: (eyeMidpoint.y + noseTip.y) * 0.5,
    };
    const eyeSeparation = Math.max(0.001, distance2d(leftEye, rightEye));
    const faceLeft = landmarks[234] ?? leftEye;
    const faceRight = landmarks[454] ?? rightEye;
    const faceWidth = Math.max(0.001, distance2d(faceLeft, faceRight));
    const faceScale = eyeSeparation * 0.65 + faceWidth * 0.35;
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

    return {
      headCenterX: headCenter.x,
      headCenterY: headCenter.y,
      eyeSeparation,
      faceWidth,
      faceScale,
      gazeX,
      gazeY,
      yaw,
      pitch,
      confidence: 1,
    };
  }
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

function clampSigned(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createEmptyTrackingFrame(): TrackingFrame {
  return {
    eyeX: 0,
    eyeY: 0,
    eyeZ: 0.68,
    yaw: 0,
    pitch: 0,
    confidence: 0,
    debug: {
      headCenterX: 0.5,
      headCenterY: 0.5,
      eyeSeparation: 0,
      faceWidth: 0,
      faceScale: 0,
      estimatedDistance: 0.68,
      headOffsetX: 0,
      headOffsetY: 0,
      gazeX: 0,
      gazeY: 0,
    },
  };
}
