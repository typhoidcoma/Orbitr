import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const THREE_DUCK_GLB_URL = "/models/Duck.glb";
const TMP_CENTER = new Vector3();
const TMP_SIZE = new Vector3();

/**
 * All scene units are in centimeters (1 unit = 1 cm).
 * glTF spec: 1 unit = 1 meter, so we scale loaded models by 100.
 * If a model's bounding box (after conversion to cm) is wildly
 * outside a plausible range, we rescale to a 20cm target height.
 */
const GLTF_TO_CM = 100;
const TARGET_HEIGHT_CM = 20;
const MIN_PLAUSIBLE_CM = 1;
const MAX_PLAUSIBLE_CM = 500;

function normalizeRoot(root: Object3D, targetHeightCm?: number): Group {
  const group = new Group();
  group.add(root);

  group.traverse((obj) => {
    if ("castShadow" in obj) {
      obj.castShadow = true;
    }
    if ("receiveShadow" in obj) {
      obj.receiveShadow = true;
    }
  });

  // Convert from glTF meters to scene cm first
  root.scale.multiplyScalar(GLTF_TO_CM);

  const bounds = new Box3().setFromObject(root);
  if (!bounds.isEmpty()) {
    bounds.getCenter(TMP_CENTER);
    bounds.getSize(TMP_SIZE);

    // Center the model at origin
    root.position.x -= TMP_CENTER.x;
    root.position.y -= TMP_CENTER.y;
    root.position.z -= TMP_CENTER.z;

    const maxDim = Math.max(TMP_SIZE.x, TMP_SIZE.y, TMP_SIZE.z);
    if (targetHeightCm != null) {
      // Explicit target: scale so largest dimension equals targetHeightCm
      group.scale.setScalar(targetHeightCm / maxDim);
    } else if (maxDim < MIN_PLAUSIBLE_CM || maxDim > MAX_PLAUSIBLE_CM) {
      // After meter→cm conversion, if dimensions are implausible, auto-rescale
      group.scale.setScalar(TARGET_HEIGHT_CM / maxDim);
    }
  }

  return group;
}

function buildProceduralFallback(): Group {
  const group = new Group();
  const geometry = new BoxGeometry(8, 8, 8); // 8cm cube
  const material = new MeshStandardMaterial({ color: 0x4ac2ff, roughness: 0.4, metalness: 0.3 });
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

async function loadGlb(url: string, targetHeightCm?: number): Promise<Group> {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  const gltf = await loader.loadAsync(url);
  dracoLoader.dispose();
  return normalizeRoot(gltf.scene, targetHeightCm);
}

export interface ModelLoadResult {
  model: Group;
  resolvedUrl: string;
  warning: string | null;
}

export async function loadViewerModel(modelUrl: string | null): Promise<ModelLoadResult> {
  if (modelUrl) {
    try {
      // User-provided model: trust glTF 1-unit=1-meter convention,
      // auto-rescale only if dimensions are implausible.
      const loaded = await loadGlb(modelUrl);
      return { model: loaded, resolvedUrl: modelUrl, warning: null };
    } catch (error) {
      console.warn("Remote model load failed, using bundled fallback", error);
      return {
        model: buildProceduralFallback(),
        resolvedUrl: "procedural",
        warning: `Could not load model from '${modelUrl}'. Showing procedural reference object instead.`,
      };
    }
  }

  try {
    // Bundled Duck.glb — scale to 5cm tall as a small desktop toy
    const duck = await loadGlb(THREE_DUCK_GLB_URL, 5);
    return { model: duck, resolvedUrl: THREE_DUCK_GLB_URL, warning: null };
  } catch (error) {
    console.warn("Default Three.js duck load failed, using procedural fallback", error);
    return {
      model: buildProceduralFallback(),
      resolvedUrl: "procedural",
      warning:
        "Could not load the bundled Duck.glb. Showing the room without a fallback model.",
    };
  }
}
