import {
  AmbientLight,
  AxesHelper,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  Matrix4,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { computeOffAxisFrustum } from "../lib/offAxis";

export interface ViewerConfig {
  fov: number;
  near: number;
  far: number;
  shiftX: number;
  shiftY: number;
}

export interface HeadInput {
  yaw: number;
  pitch: number;
}

export class Viewer {
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly container: HTMLElement;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly rootGroup = new Group();
  private readonly frustumMatrix = new Matrix4();
  private readonly headTarget = new Vector3(0, 0.75, 0);
  private readonly neutralTarget = new Vector3(0, 0.75, 0);
  private readonly config: ViewerConfig;

  constructor(container: HTMLElement, config: ViewerConfig) {
    this.container = container;
    this.config = config;

    this.camera = new PerspectiveCamera(config.fov, 1, config.near, config.far);
    this.camera.position.set(0, 1.5, 4);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(new Color("#07161f"));

    container.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.copy(this.neutralTarget);

    this.scene.background = new Color("#0b1e2b");
    this.scene.add(this.rootGroup);
    this.addDefaultHelpers();

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
    const key = new DirectionalLight("#ffffff", 1.3);
    key.position.set(2, 3, 4);

    const grid = new GridHelper(12, 12, "#3f6a86", "#173446");
    const axes = new AxesHelper(1.4);
    axes.position.set(0, 0.01, 0);

    this.scene.add(ambient, key, grid, axes);
  }

  private applyOffAxisProjection(): void {
    const frustum = computeOffAxisFrustum({
      fov: this.config.fov,
      aspect: this.camera.aspect,
      near: this.config.near,
      far: this.config.far,
      shiftX: this.config.shiftX,
      shiftY: this.config.shiftY,
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

  public setModel(modelRoot: Group): void {
    this.rootGroup.clear();
    this.rootGroup.add(modelRoot);
  }

  public setHeadInput(input: HeadInput): void {
    const maxHorizontal = 1.25;
    const maxVertical = 0.6;

    this.headTarget.set(
      this.neutralTarget.x + input.yaw * maxHorizontal,
      this.neutralTarget.y + input.pitch * maxVertical,
      this.neutralTarget.z
    );
  }

  public frame(): void {
    this.controls.target.lerp(this.headTarget, 0.18);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.controls.dispose();
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}
