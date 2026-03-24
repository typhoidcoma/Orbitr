export interface OffAxisProjectionInput {
  fov: number;
  aspect: number;
  near: number;
  far: number;
  shiftX: number;
  shiftY: number;
}

export interface OffAxisFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function computeOffAxisFrustum(input: OffAxisProjectionInput): OffAxisFrustum {
  const halfVertical = Math.tan((input.fov * Math.PI) / 360) * input.near;
  const halfHorizontal = halfVertical * input.aspect;

  // shiftX/shiftY are normalized offsets where +/-1 means one half-frustum shift.
  const horizontalOffset = halfHorizontal * input.shiftX;
  const verticalOffset = halfVertical * input.shiftY;

  return {
    left: -halfHorizontal + horizontalOffset,
    right: halfHorizontal + horizontalOffset,
    bottom: -halfVertical + verticalOffset,
    top: halfVertical + verticalOffset,
  };
}

export function clamp01(value: number): number {
  return Math.max(-1, Math.min(1, value));
}