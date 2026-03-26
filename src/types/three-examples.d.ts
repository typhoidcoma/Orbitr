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

declare module "three/examples/jsm/loaders/RGBELoader.js" {
  import { DataTextureLoader, LoadingManager, DataTexture } from "three";

  export class RGBELoader extends DataTextureLoader {
    constructor(manager?: LoadingManager);
    loadAsync(url: string): Promise<DataTexture>;
  }
}

declare module "three/examples/jsm/loaders/DRACOLoader.js" {
  import { Loader, LoadingManager } from "three";

  export class DRACOLoader extends Loader {
    constructor(manager?: LoadingManager);
    setDecoderPath(path: string): this;
    dispose(): void;
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import { Loader, LoadingManager, Group } from "three";
  import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

  export interface GLTF {
    scene: Group;
  }

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    setDRACOLoader(dracoLoader: DRACOLoader): this;
    loadAsync(url: string): Promise<GLTF>;
  }
}