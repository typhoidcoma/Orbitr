import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Euler, Matrix4 } from "three";
import { applyDeadzone, smoothValue, smoothVec2, type Vec2 } from "../lib/smoothing";

const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const FACE_TASK_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

interface TrackerCallbacks {
  onFrame: (frame: TrackingFrame) => void;
  onError: (message: string) => void;
}

export interface TrackingFrame {
  headYaw: number;
  headPitch: number;
  eyeX: number;
  eyeY: number;
  confidence: number;
}

interface SmoothedTrackingState {
  headYaw: number;
  headPitch: number;
  eye: Vec2;
}

export class FaceTracker {
  private readonly callbacks: TrackerCallbacks;
  private landmarker: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private running = false;
  private rafId = 0;
  private smoothed: SmoothedTrackingState = {
    headYaw: 0,
    headPitch: 0,
    eye: { x: 0.5, y: 0.5 },
  };

  constructor(callbacks: TrackerCallbacks) {
    this.callbacks = callbacks;
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
    const extracted = this.extractFrame(result);

    if (extracted) {
      this.smoothed.headYaw = smoothValue(this.smoothed.headYaw, extracted.headYaw, 0.24);
      this.smoothed.headPitch = smoothValue(this.smoothed.headPitch, extracted.headPitch, 0.24);
      this.smoothed.eye = smoothVec2(this.smoothed.eye, { x: extracted.eyeX, y: extracted.eyeY }, 0.22);

      this.callbacks.onFrame({
        headYaw: applyDeadzone(this.smoothed.headYaw, 0.03),
        headPitch: applyDeadzone(this.smoothed.headPitch, 0.03),
        eyeX: this.smoothed.eye.x,
        eyeY: this.smoothed.eye.y,
        confidence: extracted.confidence,
      });
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private extractFrame(result: FaceLandmarkerResult): TrackingFrame | null {
    const matrixData = result.facialTransformationMatrixes?.[0]?.data;
    const landmarks = result.faceLandmarks?.[0];

    if (!matrixData || !landmarks) {
      return null;
    }

    const matrix = new Matrix4().fromArray(Array.from(matrixData));
    const euler = new Euler().setFromRotationMatrix(matrix, "YXZ");
    const yaw = Math.max(-1, Math.min(1, euler.y / 0.8));
    const pitch = Math.max(-1, Math.min(1, euler.x / 0.65));

    const leftEye = averagePoints(landmarks, [33, 133, 159, 145]);
    const rightEye = averagePoints(landmarks, [362, 263, 386, 374]);
    const irisLeft = landmarks[468] ?? leftEye;
    const irisRight = landmarks[473] ?? rightEye;

    const eyeX = clamp01((irisLeft.x + irisRight.x) * 0.5 + yaw * 0.08);
    const eyeY = clamp01((irisLeft.y + irisRight.y) * 0.5 + pitch * 0.08);

    return {
      headYaw: yaw,
      headPitch: pitch,
      eyeX,
      eyeY,
      confidence: 1,
    };
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}