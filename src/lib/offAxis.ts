export interface ScreenWindowProjectionInput {
  screenWidth: number;
  screenHeight: number;
  near: number;
  far: number;
  eyeX: number;
  eyeY: number;
  eyeZ: number;
  screenOffsetX: number;
  screenOffsetY: number;
  screenOffsetZ: number;
}

export interface OffAxisFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function computeOffAxisFrustum(input: ScreenWindowProjectionInput): OffAxisFrustum {
  const halfWidth = input.screenWidth * 0.5;
  const halfHeight = input.screenHeight * 0.5;
  const distanceToScreen = Math.max(0.001, input.eyeZ - input.screenOffsetZ);
  const leftWorld = input.screenOffsetX - halfWidth;
  const rightWorld = input.screenOffsetX + halfWidth;
  const bottomWorld = input.screenOffsetY - halfHeight;
  const topWorld = input.screenOffsetY + halfHeight;

  return {
    left: (input.near * (leftWorld - input.eyeX)) / distanceToScreen,
    right: (input.near * (rightWorld - input.eyeX)) / distanceToScreen,
    bottom: (input.near * (bottomWorld - input.eyeY)) / distanceToScreen,
    top: (input.near * (topWorld - input.eyeY)) / distanceToScreen,
  };
}

export function clampSigned(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
