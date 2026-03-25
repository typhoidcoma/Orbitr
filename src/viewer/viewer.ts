import {
  AmbientLight,
  AxesHelper,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  RepeatWrapping,
  WebGLRenderer,
} from "three";
import { computeOffAxisFrustum } from "../lib/offAxis";
import type { ParallaxCalibration } from "../lib/parallaxConfig";
import { smoothValue } from "../lib/smoothing";
import type { ViewerPose } from "../tracking/normalizeTracking";

export interface ViewerConfig {
  near: number;
  far: number;
  calibration: ParallaxCalibration;
}

export class Viewer {
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly rootGroup = new Group();
  private readonly frustumMatrix = new Matrix4();
  private readonly config: ViewerConfig;
  private readonly screenGroup = new Group();
  private readonly windowBox = new Group();
  private readonly screenPlane: Mesh;
  private readonly roomGroup = new Group();
  private readonly roomShell: Mesh;
  private calibration: ParallaxCalibration;
  private targetPose: ViewerPose = createNeutralViewerPose();
  private smoothedPose: ViewerPose = createNeutralViewerPose();
  private trackingEnabled = false;

  constructor(container: HTMLElement, config: ViewerConfig) {
    this.container = container;
    this.config = config;
    this.calibration = config.calibration;

    this.camera = new PerspectiveCamera(50, 1, config.near, config.far);
    this.camera.position.set(0, 0, this.calibration.neutralDistance);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(new Color("#07161f"));
    container.append(this.renderer.domElement);

    this.scene.background = new Color("#0b1e2b");
    this.scene.add(this.rootGroup);
    this.scene.add(this.screenGroup);
    this.scene.add(this.roomGroup);
    this.screenPlane = new Mesh(
      new BoxGeometry(1, 1, 0.002),
      new MeshBasicMaterial({
        color: "#65d7ff",
        opacity: 0.05,
        transparent: true,
      })
    );
    this.roomShell = new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({
        map: createCheckerTexture(),
        color: "#d9edf7",
        roughness: 0.92,
        metalness: 0.02,
        side: BackSide,
      })
    );
    this.roomGroup.add(this.roomShell);
    this.screenGroup.add(this.screenPlane);
    this.buildWindowBox();
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
    key.position.set(1.2, 1.6, 2.8);
    const axes = new AxesHelper(0.4);
    axes.position.set(
      this.calibration.screenOffsetX,
      this.calibration.screenOffsetY,
      this.calibration.screenOffsetZ
    );

    this.scene.add(ambient, key, axes);
  }

  private buildWindowBox(): void {
    this.windowBox.clear();

    const frame = new LineSegments(
      new EdgesGeometry(new BoxGeometry(1, 1, 1)),
      new LineBasicMaterial({ color: "#79d9ff" })
    );
    frame.position.set(0, 0, -0.6);
    this.windowBox.add(frame);
    this.screenGroup.add(this.windowBox);
  }

  private applyOffAxisProjection(): void {
    const frustum = computeOffAxisFrustum({
      screenWidth: this.calibration.screenWidth,
      screenHeight: this.calibration.screenHeight,
      near: this.config.near,
      far: this.config.far,
      eyeX: this.camera.position.x,
      eyeY: this.camera.position.y,
      eyeZ: this.camera.position.z,
      screenOffsetX: this.calibration.screenOffsetX,
      screenOffsetY: this.calibration.screenOffsetY,
      screenOffsetZ: this.calibration.screenOffsetZ,
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
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.applyOffAxisProjection();
    this.renderer.setSize(width, height, false);
  };

  public resize(): void {
    this.handleResize();
  }

  public setModel(modelRoot: Group): void {
    this.rootGroup.clear();
    this.rootGroup.add(modelRoot);
    this.layoutScene();
  }

  public setCalibration(calibration: ParallaxCalibration): void {
    this.calibration = calibration;
    this.layoutScene();
  }

  public setViewerPose(input: ViewerPose): void {
    this.targetPose = input;
  }

  public setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled = enabled;
  }

  public frame(): void {
    const target = this.trackingEnabled ? this.targetPose : createNeutralViewerPose(this.calibration);
    const alpha = this.calibration.smoothing;

    this.smoothedPose = {
      ...target,
      eyeX: smoothValue(this.smoothedPose.eyeX, target.eyeX, alpha),
      eyeY: smoothValue(this.smoothedPose.eyeY, target.eyeY, alpha),
      eyeZ: smoothValue(this.smoothedPose.eyeZ, target.eyeZ, alpha),
    };

    this.camera.position.set(
      this.smoothedPose.eyeX,
      this.smoothedPose.eyeY,
      this.smoothedPose.eyeZ
    );
    this.camera.rotation.set(0, 0, 0);
    this.applyOffAxisProjection();
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }

  private layoutScene(): void {
    const roomDepth = Math.max(1.4, this.calibration.screenWidth * 2.6);
    const roomHeight = this.calibration.screenHeight * 2.2;
    const roomWidth = this.calibration.screenWidth * 2.4;

    this.rootGroup.position.set(
      this.calibration.screenOffsetX,
      this.calibration.screenOffsetY - this.calibration.screenHeight * 0.28,
      this.calibration.screenOffsetZ - roomDepth * 0.42
    );

    this.screenGroup.position.set(
      this.calibration.screenOffsetX,
      this.calibration.screenOffsetY,
      this.calibration.screenOffsetZ
    );
    this.screenPlane.scale.set(
      this.calibration.screenWidth,
      this.calibration.screenHeight,
      1
    );
    this.windowBox.visible = this.calibration.showWindowBox;
    this.windowBox.scale.set(
      this.calibration.screenWidth,
      this.calibration.screenHeight,
      Math.max(0.4, this.calibration.screenWidth)
    );

    this.roomGroup.position.set(
      this.calibration.screenOffsetX,
      this.calibration.screenOffsetY + roomHeight * 0.08,
      this.calibration.screenOffsetZ - roomDepth * 0.5
    );
    this.roomShell.scale.set(roomWidth, roomHeight, roomDepth);
  }
}

function createNeutralViewerPose(calibration?: ParallaxCalibration): ViewerPose {
  const neutralDistance = calibration?.neutralDistance ?? 0.68;
  const cameraOffsetX = calibration?.cameraOffsetX ?? 0;
  const cameraOffsetY = calibration?.cameraOffsetY ?? 0.08;
  const cameraOffsetZ = calibration?.cameraOffsetZ ?? 0.035;

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
      faceScale: 0,
      estimatedDistance: neutralDistance,
      headOffsetX: 0,
      headOffsetY: 0,
      gazeX: 0,
      gazeY: 0,
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
      ctx.fillStyle = light ? "#f3f6f8" : "#293640";
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
