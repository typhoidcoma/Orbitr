declare module "three/examples/jsm/controls/OrbitControls.js" {
  import { Camera, EventDispatcher, MOUSE, TOUCH, Vector3 } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    object: Camera;
    enabled: boolean;
    target: Vector3;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    enableDamping: boolean;
    dampingFactor: number;
    update(): void;
    dispose(): void;
    mouseButtons: { LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE };
    touches: { ONE: TOUCH; TWO: TOUCH };
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import { Loader, LoadingManager, Group } from "three";

  export interface GLTF {
    scene: Group;
  }

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    loadAsync(url: string): Promise<GLTF>;
  }
}