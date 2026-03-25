import { describe, expect, it } from "vitest";
import { parseViewerUrlParams } from "./urlParams";

describe("parseViewerUrlParams", () => {
  it("applies defaults", () => {
    const parsed = parseViewerUrlParams("");

    expect(parsed.modelUrl).toBeNull();
    expect(parsed.near).toBe(1);
    expect(parsed.far).toBe(10000);
    expect(parsed.calibration.monitorPreset).toBe("24_desktop");
    expect(parsed.calibration.screenWidth).toBe(53.1);
    expect(parsed.calibration.screenHeight).toBe(29.9);
    expect(parsed.calibration.neutralDistance).toBe(68);
    expect(parsed.calibration.cameraOffsetY).toBe(8);
    expect(parsed.calibration.showPresentationRoom).toBe(true);
    expect(parsed.calibration.showWireframeRoom).toBe(false);
    expect(parsed.calibration.showScreenFrame).toBe(false);
    expect(parsed.calibration.showFacePreview).toBe(false);
    expect(parsed.calibration.calibrationComplete).toBe(false);
    expect(parsed.calibration.showDebug).toBe(false);
    expect(parsed.modelTransform.scale).toBe(1);
  });

  it("parses and clamps values", () => {
    const parsed = parseViewerUrlParams(
      "?monitorPreset=custom&screenWidth=500&screenHeight=5&neutralDistance=900&gainX=99&gainY=-99&gainZ=99&eyeRefinementGain=500&screenOffsetX=500&screenOffsetY=-500&screenOffsetZ=500&cameraOffsetX=200&cameraOffsetY=-200&cameraOffsetZ=200&smoothing=4&near=0.01&far=500000&debug=1&presentationRoom=0&wireframeRoom=0&screenFrame=0&facePreview=1&calibrated=1&modelX=800&modelScale=20"
    );

    expect(parsed.calibration.monitorPreset).toBe("custom");
    expect(parsed.calibration.screenWidth).toBe(140);
    expect(parsed.calibration.screenHeight).toBe(10);
    expect(parsed.calibration.neutralDistance).toBe(180);
    expect(parsed.calibration.gainX).toBe(5);
    expect(parsed.calibration.gainY).toBe(-5);
    expect(parsed.calibration.gainZ).toBe(5);
    expect(parsed.calibration.eyeRefinementGain).toBe(20);
    expect(parsed.calibration.screenOffsetX).toBe(100);
    expect(parsed.calibration.screenOffsetY).toBe(-100);
    expect(parsed.calibration.screenOffsetZ).toBe(100);
    expect(parsed.calibration.cameraOffsetX).toBe(50);
    expect(parsed.calibration.cameraOffsetY).toBe(-50);
    expect(parsed.calibration.cameraOffsetZ).toBe(50);
    expect(parsed.calibration.smoothing).toBe(1);
    expect(parsed.calibration.showDebug).toBe(true);
    expect(parsed.calibration.showPresentationRoom).toBe(false);
    expect(parsed.calibration.showWireframeRoom).toBe(false);
    expect(parsed.calibration.showScreenFrame).toBe(false);
    expect(parsed.calibration.showFacePreview).toBe(true);
    expect(parsed.calibration.calibrationComplete).toBe(true);
    expect(parsed.modelTransform.positionX).toBe(500);
    expect(parsed.modelTransform.scale).toBe(10);
    expect(parsed.near).toBe(0.1);
    expect(parsed.far).toBe(100000);
  });

  it("falls back on invalid numeric values", () => {
    const parsed = parseViewerUrlParams("?screenWidth=hello&gainZ=oops&cameraOffsetY=bad&near=oops");

    expect(parsed.calibration.screenWidth).toBe(53.1);
    expect(parsed.calibration.gainZ).toBe(1);
    expect(parsed.calibration.cameraOffsetY).toBe(8);
    expect(parsed.near).toBe(1);
  });
});
