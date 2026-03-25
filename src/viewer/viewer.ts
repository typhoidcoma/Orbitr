import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Euler,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { computeOffAxisFrustum } from "../lib/offAxis";
import type { ModelTransform, ParallaxCalibration } from "../lib/parallaxConfig";

import type { ViewerPose } from "../tracking/normalizeTracking";

export interface ViewerConfig {
  near: number;
  far: number;
  calibration: ParallaxCalibration;
  modelTransform: ModelTransform;
}

export interface EffectiveScreenRect {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  z: number;
}

export interface ModelBaseAnchor {
  x: number;
  y: number;
  z: number;
}

export class Viewer {
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly sceneContentGroup = new Group();
  private readonly modelAnchorGroup = new Group();
  private readonly frustumMatrix = new Matrix4();
  private readonly config: ViewerConfig;
  private readonly screenGroup = new Group();
  private readonly presentationRoomGroup = new Group();
  private readonly wireframeRoomGroup = new Group();
  private readonly screenPlane: Mesh;
  private readonly screenFrame: LineSegments;
  private readonly presentationRoomShell: Mesh;
  private readonly wireframeRoomShell: LineSegments;
  private calibration: ParallaxCalibration;
  private modelTransform: ModelTransform;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private targetPose: ViewerPose;
  private trackingEnabled = false;
  private effectiveScreenRect: EffectiveScreenRect;

  constructor(container: HTMLElement, config: ViewerConfig) {
    this.container = container;
    this.config = config;
    this.calibration = config.calibration;
    this.modelTransform = config.modelTransform;
    this.targetPose = createNeutralViewerPose(this.calibration);
    this.effectiveScreenRect = createFallbackScreenRect(this.calibration);

    this.camera = new PerspectiveCamera(50, 1, config.near, config.far);
    this.camera.position.set(0, 0, this.calibration.neutralDistance);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight, false);
    this.renderer.setClearColor(new Color("#000000"));
    container.append(this.renderer.domElement);

    this.scene.background = new Color("#000000");
    this.scene.add(this.sceneContentGroup);
    this.scene.add(this.screenGroup);
    this.scene.add(this.presentationRoomGroup);
    this.scene.add(this.wireframeRoomGroup);
    this.sceneContentGroup.add(this.modelAnchorGroup);

    this.screenPlane = new Mesh(
      new BoxGeometry(1, 1, 0.2),
      new MeshBasicMaterial({
        color: "#ff5656",
        opacity: 0.035,
        transparent: true,
      })
    );
    this.screenFrame = new LineSegments(
      new EdgesGeometry(new BoxGeometry(1, 1, 0.2)),
      new LineBasicMaterial({ color: "#ff4d4d" })
    );
    this.presentationRoomShell = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({
        map: createCheckerTexture(),
        color: "#ffffff",
        roughness: 0.92,
        metalness: 0.02,
        side: BackSide,
      })
    );
    this.wireframeRoomShell = new LineSegments(
      new EdgesGeometry(new BoxGeometry(1, 1, 1)),
      new LineBasicMaterial({ color: "#79d9ff" })
    );

    this.screenGroup.add(this.screenPlane, this.screenFrame);
    this.presentationRoomGroup.add(this.presentationRoomShell);
    this.wireframeRoomGroup.add(this.wireframeRoomShell);
    this.addDefaultHelpers();
    this.layoutScene();

    this.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            this.handleResize();
          });

    window.addEventListener("resize", this.handleResize);
    this.resizeObserver?.observe(this.container);
    this.handleResize();
  }

  private addDefaultHelpers(): void {
    const ambient = new AmbientLight("#d5e9ff", 0.8);
    const key = new DirectionalLight("#ffffff", 1.2);
    key.position.set(120, 160, 280);

    this.scene.add(ambient, key);
  }

  private applyOffAxisProjection(): void {
    const screen = this.syncEffectiveScreenRect();
    const frustum = computeOffAxisFrustum({
      near: this.config.near,
      far: this.config.far,
      eyeX: this.camera.position.x,
      eyeY: this.camera.position.y,
      eyeZ: this.camera.position.z,
      screenLeft: screen.left,
      screenRight: screen.right,
      screenBottom: screen.bottom,
      screenTop: screen.top,
      screenZ: screen.z,
    });

    this.frustumMatrix.makePerspective(
      frustum.left,
      frustum.right,
      frustum.top,
      frustum.bottom,
      this.config.near,
      this.config.far
    );

    this.camera.projectionMatrix.copy(this.frustumMatrix);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  private handleResize = (): void => {
    this.viewportWidth = Math.max(1, this.container.clientWidth);
    this.viewportHeight = Math.max(1, this.container.clientHeight);
    this.camera.aspect = this.viewportWidth / this.viewportHeight;
    this.renderer.setSize(this.viewportWidth, this.viewportHeight, false);
    this.layoutScene();
    this.applyOffAxisProjection();
  };

  public resize(): void {
    this.handleResize();
  }

  public getEffectiveScreenRect(): EffectiveScreenRect {
    return this.effectiveScreenRect;
  }

  public setModel(modelRoot: Group): void {
    this.modelAnchorGroup.clear();
    this.modelAnchorGroup.add(modelRoot);
    this.layoutScene();
  }

  public setCalibration(calibration: ParallaxCalibration): void {
    this.calibration = calibration;
    this.layoutScene();
  }

  public setModelTransform(modelTransform: ModelTransform): void {
    this.modelTransform = modelTransform;
    this.layoutScene();
  }

  public setViewerPose(input: ViewerPose): void {
    this.targetPose = input;
  }

  public setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled = enabled;
  }

  public frame(): void {
    const pose = this.trackingEnabled ? this.targetPose : createNeutralViewerPose(this.calibration);
    this.camera.position.set(pose.eyeX, pose.eyeY, pose.eyeZ);
    this.camera.rotation.set(0, 0, 0);
    this.syncEffectiveScreenRect();
    this.applyOffAxisProjection();
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();

    this.scene.traverse((obj) => {
      if (obj instanceof Mesh || obj instanceof LineSegments) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }
    });

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private layoutScene(): void {
    const screen = this.syncEffectiveScreenRect();
    const roomDepth = clamp(screen.width * 0.66, 22, 42);
    const roomHeight = screen.height;
    const roomWidth = screen.width;
    const modelBaseAnchor = getModelBaseAnchor(screen);

    this.sceneContentGroup.position.set(0, 0, 0);
    this.modelAnchorGroup.position.set(
      modelBaseAnchor.x + this.modelTransform.positionX,
      modelBaseAnchor.y + this.modelTransform.positionY,
      modelBaseAnchor.z + this.modelTransform.positionZ
    );
    this.modelAnchorGroup.rotation.copy(
      new Euler(
        degToRad(this.modelTransform.rotationX),
        degToRad(this.modelTransform.rotationY),
        degToRad(this.modelTransform.rotationZ)
      )
    );
    this.modelAnchorGroup.scale.setScalar(this.modelTransform.scale);

    this.screenGroup.position.set(
      screen.centerX,
      screen.centerY,
      screen.z
    );
    this.screenPlane.visible = this.calibration.showScreenFrame;
    this.screenFrame.visible = this.calibration.showScreenFrame;
    this.screenPlane.scale.set(screen.width, screen.height, 1);
    this.screenFrame.scale.set(screen.width, screen.height, 1);

    this.presentationRoomGroup.visible = this.calibration.showPresentationRoom;
    this.presentationRoomGroup.position.set(
      screen.centerX,
      screen.centerY,
      screen.z - roomDepth * 0.5
    );
    this.presentationRoomShell.scale.set(roomWidth, roomHeight, roomDepth);

    this.wireframeRoomGroup.visible = this.calibration.showWireframeRoom;
    this.wireframeRoomGroup.position.copy(this.presentationRoomGroup.position);
    this.wireframeRoomShell.scale.set(roomWidth, roomHeight, roomDepth);
  }

  private syncEffectiveScreenRect(): EffectiveScreenRect {
    const next = this.computeEffectiveScreenRect();
    const changed =
      Math.abs(next.width - this.effectiveScreenRect.width) > 0.01 ||
      Math.abs(next.height - this.effectiveScreenRect.height) > 0.01 ||
      Math.abs(next.centerX - this.effectiveScreenRect.centerX) > 0.01 ||
      Math.abs(next.centerY - this.effectiveScreenRect.centerY) > 0.01 ||
      Math.abs(next.z - this.effectiveScreenRect.z) > 0.01;

    this.effectiveScreenRect = next;
    if (changed) {
      this.screenGroup.position.set(next.centerX, next.centerY, next.z);
    }

    return next;
  }

  private computeEffectiveScreenRect(): EffectiveScreenRect {
    // The frustum aspect MUST match the canvas aspect to avoid distortion.
    // Use the physical screen width as anchor; derive height from viewport aspect.
    const viewportAspect = this.viewportWidth / Math.max(1, this.viewportHeight);
    const width = Math.max(1, this.calibration.screenWidth);
    const height = Math.max(1, width / viewportAspect);
    const centerX = this.calibration.screenOffsetX;
    const centerY = this.calibration.screenOffsetY;
    const z = this.calibration.screenOffsetZ;

    return {
      width,
      height,
      centerX,
      centerY,
      left: centerX - width * 0.5,
      right: centerX + width * 0.5,
      bottom: centerY - height * 0.5,
      top: centerY + height * 0.5,
      z,
    };
  }
}

function createNeutralViewerPose(calibration?: ParallaxCalibration): ViewerPose {
  const neutralDistance = calibration?.neutralDistance ?? 68;
  const cameraOffsetX = calibration?.cameraOffsetX ?? 0;
  const cameraOffsetY = calibration?.cameraOffsetY ?? 8;
  const cameraOffsetZ = calibration?.cameraOffsetZ ?? 3.5;

  return {
    eyeX: cameraOffsetX,
    eyeY: cameraOffsetY,
    eyeZ: neutralDistance + cameraOffsetZ,
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

function createCheckerTexture(): CanvasTexture {
  const size = 256;
  const cells = 8;
  const cellSize = size / cells;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create checker texture.");
  }

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const light = (x + y) % 2 === 0;
      ctx.fillStyle = light ? "#1c2e3e" : "#0a1018";
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 3);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function createFallbackScreenRect(calibration: ParallaxCalibration): EffectiveScreenRect {
  const viewportAspect = window.innerWidth / Math.max(1, window.innerHeight);
  const width = calibration.screenWidth;
  const height = width / viewportAspect;
  const centerX = calibration.screenOffsetX;
  const centerY = calibration.screenOffsetY;
  const z = calibration.screenOffsetZ;

  return {
    width,
    height,
    centerX,
    centerY,
    left: centerX - width * 0.5,
    right: centerX + width * 0.5,
    bottom: centerY - height * 0.5,
    top: centerY + height * 0.5,
    z,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getModelBaseAnchor(screen: EffectiveScreenRect): ModelBaseAnchor {
  return {
    x: screen.centerX,
    y: screen.centerY,
    z: screen.z,
  };
}
