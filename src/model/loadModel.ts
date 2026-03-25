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
const THREE_DUCK_SCALE = 0.01;
const TMP_CENTER = new Vector3();
const TMP_SIZE = new Vector3();

function normalizeRoot(root: Object3D, scale = 1.2): Group {
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

  const bounds = new Box3().setFromObject(root);
  if (!bounds.isEmpty()) {
    bounds.getCenter(TMP_CENTER);
    bounds.getSize(TMP_SIZE);

    root.position.x -= TMP_CENTER.x;
    root.position.y -= TMP_CENTER.y;
    root.position.z -= TMP_CENTER.z;
  }

  group.scale.setScalar(scale);
  return group;
}

function buildProceduralFallback(): Group {
  const group = new Group();
  const geometry = new BoxGeometry(0.08, 0.08, 0.08);
  const material = new MeshStandardMaterial({ color: 0x4ac2ff, roughness: 0.4, metalness: 0.3 });
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.scale.setScalar(1.2);
  return group;
}

async function loadGlb(url: string, scale = 1.2): Promise<Group> {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  const gltf = await loader.loadAsync(url);
  dracoLoader.dispose();
  return normalizeRoot(gltf.scene, scale);
}

export interface ModelLoadResult {
  model: Group;
  resolvedUrl: string;
  warning: string | null;
}

export async function loadViewerModel(modelUrl: string | null): Promise<ModelLoadResult> {
  if (modelUrl) {
    try {
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
    const duck = await loadGlb(THREE_DUCK_GLB_URL, THREE_DUCK_SCALE);
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
