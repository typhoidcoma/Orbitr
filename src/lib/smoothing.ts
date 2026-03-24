export function smoothValue(previous: number, next: number, alpha: number): number {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return previous + (next - previous) * clampedAlpha;
}

export function applyDeadzone(value: number, deadzone: number): number {
  const zone = Math.max(0, deadzone);
  return Math.abs(value) < zone ? 0 : value;
}

export interface Vec2 {
  x: number;
  y: number;
}

export function smoothVec2(previous: Vec2, next: Vec2, alpha: number): Vec2 {
  return {
    x: smoothValue(previous.x, next.x, alpha),
    y: smoothValue(previous.y, next.y, alpha),
  };
}