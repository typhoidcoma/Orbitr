import { describe, expect, it } from "vitest";
import { parseViewerUrlParams } from "./urlParams";

describe("parseViewerUrlParams", () => {
  it("applies defaults", () => {
    const parsed = parseViewerUrlParams("");

    expect(parsed.modelUrl).toBeNull();
    expect(parsed.near).toBe(0.1);
    expect(parsed.far).toBe(100);
    expect(parsed.calibration.monitorPreset).toBe("24_desktop");
    expect(parsed.calibration.screenWidth).toBe(0.531);
    expect(parsed.calibration.screenHeight).toBe(0.299);
    expect(parsed.calibration.neutralDistance).toBe(0.68);
    expect(parsed.calibration.cameraOffsetY).toBe(0.08);
    expect(parsed.calibration.showPresentationRoom).toBe(true);
    expect(parsed.calibration.showWireframeRoom).toBe(true);
    expect(parsed.calibration.showScreenFrame).toBe(true);
    expect(parsed.calibration.showFacePreview).toBe(false);
    expect(parsed.calibration.calibrationComplete).toBe(false);
    expect(parsed.calibration.showDebug).toBe(false);
    expect(parsed.modelTransform.scale).toBe(1);
  });

  it("parses and clamps values", () => {
    const parsed = parseViewerUrlParams(
      "?monitorPreset=custom&screenWidth=5&screenHeight=0.05&neutralDistance=9&gainX=99&gainY=-99&gainZ=99&eyeRefinementGain=5&screenOffsetX=5&screenOffsetY=-5&screenOffsetZ=5&cameraOffsetX=2&cameraOffsetY=-2&cameraOffsetZ=2&smoothing=4&near=0.0001&far=5000&debug=1&presentationRoom=0&wireframeRoom=0&screenFrame=0&facePreview=1&calibrated=1&modelX=8&modelScale=20"
    );

    expect(parsed.calibration.monitorPreset).toBe("custom");
    expect(parsed.calibration.screenWidth).toBe(1.4);
    expect(parsed.calibration.screenHeight).toBe(0.1);
    expect(parsed.calibration.neutralDistance).toBe(1.8);
    expect(parsed.calibration.gainX).toBe(3);
    expect(parsed.calibration.gainY).toBe(-3);
    expect(parsed.calibration.gainZ).toBe(3);
    expect(parsed.calibration.eyeRefinementGain).toBe(0.2);
    expect(parsed.calibration.screenOffsetX).toBe(1);
    expect(parsed.calibration.screenOffsetY).toBe(-1);
    expect(parsed.calibration.screenOffsetZ).toBe(1);
    expect(parsed.calibration.cameraOffsetX).toBe(0.5);
    expect(parsed.calibration.cameraOffsetY).toBe(-0.5);
    expect(parsed.calibration.cameraOffsetZ).toBe(0.5);
    expect(parsed.calibration.smoothing).toBe(1);
    expect(parsed.calibration.showDebug).toBe(true);
    expect(parsed.calibration.showPresentationRoom).toBe(false);
    expect(parsed.calibration.showWireframeRoom).toBe(false);
    expect(parsed.calibration.showScreenFrame).toBe(false);
    expect(parsed.calibration.showFacePreview).toBe(true);
    expect(parsed.calibration.calibrationComplete).toBe(true);
    expect(parsed.modelTransform.positionX).toBe(5);
    expect(parsed.modelTransform.scale).toBe(10);
    expect(parsed.near).toBe(0.01);
    expect(parsed.far).toBe(1000);
  });

  it("falls back on invalid numeric values", () => {
    const parsed = parseViewerUrlParams("?screenWidth=hello&gainZ=oops&cameraOffsetY=bad&near=oops");

    expect(parsed.calibration.screenWidth).toBe(0.531);
    expect(parsed.calibration.gainZ).toBe(1);
    expect(parsed.calibration.cameraOffsetY).toBe(0.08);
    expect(parsed.near).toBe(0.1);
  });
});
