/** Landmark index groups for color-coded visualization. */
const LANDMARK_GROUPS: Array<{ indices: number[]; color: string }> = [
  // Left eye contour
  { indices: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], color: "#22dd88" },
  // Right eye contour
  { indices: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398], color: "#22dd88" },
  // Left iris
  { indices: [468, 469, 470, 471, 472], color: "#44aaff" },
  // Right iris
  { indices: [473, 474, 475, 476, 477], color: "#44aaff" },
  // Nose ridge and tip
  { indices: [1, 2, 98, 327, 168, 6, 197, 195, 5, 4], color: "#ffaa44" },
  // Outer lips
  { indices: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185], color: "#ff6688" },
];

export class FaceMeshOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "face-mesh-overlay";
    this.canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform:scaleX(-1)";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
  }

  public draw(landmarks: Array<{ x: number; y: number }>): void {
    const { canvas, ctx } = this;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const group of LANDMARK_GROUPS) {
      ctx.fillStyle = group.color;
      for (const idx of group.indices) {
        const lm = landmarks[idx];
        if (!lm) continue;
        const x = lm.x * canvas.width;
        const y = lm.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
