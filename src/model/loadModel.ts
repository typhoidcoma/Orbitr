import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const FALLBACK_MODEL_URL = "/models/Box.glb";

function normalizeRoot(root: Object3D): Group {
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

  const scale = 1.2;
  group.scale.setScalar(scale);
  return group;
}

function buildProceduralFallback(): Group {
  const group = new Group();
  const base = new Mesh(
    new BoxGeometry(1.2, 1.2, 1.2),
    new MeshStandardMaterial({ color: "#57c4ff", roughness: 0.4, metalness: 0.1 })
  );
  const orb = new Mesh(
    new SphereGeometry(0.25, 24, 16),
    new MeshStandardMaterial({ color: "#ffe37b", roughness: 0.3, metalness: 0.2 })
  );

  orb.position.set(0.9, 0.9, 0);
  group.add(base, orb);
  return group;
}

async function loadGlb(url: string): Promise<Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return normalizeRoot(gltf.scene);
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
      try {
        const fallback = await loadGlb(FALLBACK_MODEL_URL);
        return {
          model: fallback,
          resolvedUrl: FALLBACK_MODEL_URL,
          warning: `Could not load model from '${modelUrl}'. Loaded fallback model instead.`,
        };
      } catch {
        return {
          model: buildProceduralFallback(),
          resolvedUrl: "procedural",
          warning: `Could not load model from '${modelUrl}' or bundled fallback. Showing procedural placeholder.`,
        };
      }
    }
  }

  try {
    const fallback = await loadGlb(FALLBACK_MODEL_URL);
    return { model: fallback, resolvedUrl: FALLBACK_MODEL_URL, warning: null };
  } catch {
    return {
      model: buildProceduralFallback(),
      resolvedUrl: "procedural",
      warning: "Bundled fallback model missing. Showing procedural placeholder.",
    };
  }
}
