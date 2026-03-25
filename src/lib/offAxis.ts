export interface ScreenWindowProjectionInput {
  near: number;
  far: number;
  eyeX: number;
  eyeY: number;
  eyeZ: number;
  screenLeft: number;
  screenRight: number;
  screenTop: number;
  screenBottom: number;
  screenZ: number;
}

export interface OffAxisFrustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function computeOffAxisFrustum(input: ScreenWindowProjectionInput): OffAxisFrustum {
  const distanceToScreen = Math.max(0.1, input.eyeZ - input.screenZ);

  return {
    left: (input.near * (input.screenLeft - input.eyeX)) / distanceToScreen,
    right: (input.near * (input.screenRight - input.eyeX)) / distanceToScreen,
    bottom: (input.near * (input.screenBottom - input.eyeY)) / distanceToScreen,
    top: (input.near * (input.screenTop - input.eyeY)) / distanceToScreen,
  };
}

export function clampSigned(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
