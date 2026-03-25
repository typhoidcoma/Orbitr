import { beforeEach, describe, expect, it } from "vitest";
import {
  loadViewerState,
  resetViewerState,
  saveViewerState,
} from "./calibrationStorage";
import {
  DEFAULT_MODEL_TRANSFORM,
  DEFAULT_PARALLAX_CALIBRATION,
} from "./parallaxConfig";

describe("calibrationStorage", () => {
  beforeEach(() => {
    resetViewerState();
  });

  it("loads defaults when storage is empty", () => {
    const state = loadViewerState();

    expect(state.calibration.monitorPreset).toBe(DEFAULT_PARALLAX_CALIBRATION.monitorPreset);
    expect(state.modelTransform.scale).toBe(DEFAULT_MODEL_TRANSFORM.scale);
  });

  it("restores saved calibration and model transform", () => {
    saveViewerState(
      {
        ...DEFAULT_PARALLAX_CALIBRATION,
        monitorPreset: "custom",
        screenWidth: 0.44,
        calibrationComplete: true,
      },
      {
        ...DEFAULT_MODEL_TRANSFORM,
        positionX: 1.2,
        scale: 2,
      }
    );

    const restored = loadViewerState();

    expect(restored.calibration.monitorPreset).toBe("custom");
    expect(restored.calibration.screenWidth).toBe(0.44);
    expect(restored.calibration.calibrationComplete).toBe(true);
    expect(restored.modelTransform.positionX).toBe(1.2);
    expect(restored.modelTransform.scale).toBe(2);
  });

  it("reset clears storage and returns defaults", () => {
    saveViewerState(
      {
        ...DEFAULT_PARALLAX_CALIBRATION,
        screenWidth: 0.9,
      },
      {
        ...DEFAULT_MODEL_TRANSFORM,
        scale: 3,
      }
    );

    const reset = resetViewerState();

    expect(reset.calibration.screenWidth).toBe(DEFAULT_PARALLAX_CALIBRATION.screenWidth);
    expect(reset.modelTransform.scale).toBe(DEFAULT_MODEL_TRANSFORM.scale);
    expect(loadViewerState().calibration.screenWidth).toBe(DEFAULT_PARALLAX_CALIBRATION.screenWidth);
  });
});
