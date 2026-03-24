import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
const TMP_CENTER = new Vector3();
const TMP_SIZE = new Vector3();

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

  const bounds = new Box3().setFromObject(root);
  if (!bounds.isEmpty()) {
    bounds.getCenter(TMP_CENTER);
    bounds.getSize(TMP_SIZE);

    root.position.x -= TMP_CENTER.x;
    root.position.y -= bounds.min.y;
    root.position.z -= TMP_CENTER.z;
  }

  const scale = 1.2;
  group.scale.setScalar(scale);
  return group;
}

function buildProceduralFallback(): Group {
  const group = new Group();
  const pedestal = new Mesh(
    new CylinderGeometry(0.18, 0.22, 0.12, 24),
    new MeshStandardMaterial({ color: "#55748a", roughness: 0.8, metalness: 0.08 })
  );
  const orb = new Mesh(
    new SphereGeometry(0.16, 28, 20),
    new MeshStandardMaterial({ color: "#ffe37b", roughness: 0.26, metalness: 0.18 })
  );
  const marker = new Mesh(
    new BoxGeometry(0.12, 0.12, 0.12),
    new MeshStandardMaterial({ color: "#57c4ff", roughness: 0.42, metalness: 0.05 })
  );

  orb.position.set(-0.16, 0.26, -0.12);
  marker.position.set(0.2, 0.22, 0.12);
  group.add(pedestal, orb, marker);
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
      return {
        model: buildProceduralFallback(),
        resolvedUrl: "procedural",
        warning: `Could not load model from '${modelUrl}'. Showing procedural reference object instead.`,
      };
    }
  }

  return { model: buildProceduralFallback(), resolvedUrl: "procedural", warning: null };
}
