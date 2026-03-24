export interface ViewerUrlParams {
  modelUrl: string | null;
  shiftX: number;
  shiftY: number;
  fov: number;
  near: number;
  far: number;
}

function parseFiniteNumber(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function parseViewerUrlParams(search: string): ViewerUrlParams {
  const params = new URLSearchParams(search);

  return {
    modelUrl: params.get("model"),
    shiftX: parseFiniteNumber(params.get("shiftX"), 0, -1, 1),
    shiftY: parseFiniteNumber(params.get("shiftY"), 0, -1, 1),
    fov: parseFiniteNumber(params.get("fov"), 50, 15, 120),
    near: parseFiniteNumber(params.get("near"), 0.1, 0.01, 10),
    far: parseFiniteNumber(params.get("far"), 100, 10, 1000),
  };
}