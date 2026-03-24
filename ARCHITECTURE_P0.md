# ARCHITECTURE P0 - Orbitr

Orbitr v1 is a browser-based Three.js viewer with off-axis projection and optional MediaPipe tracking.

## Runtime Flow

1. `main.ts` parses URL params and creates UI.
2. `Viewer` initializes scene/camera/renderer and applies off-center frustum projection.
3. `loadViewerModel` loads `?model=` if provided, otherwise bundled fallback (`/models/Box.glb`).
4. User starts tracking via button.
5. `FaceTracker` streams webcam frames into MediaPipe and emits smoothed head + eye signals.
6. Head signals steer orbit target; eye signals update reticle overlay.

## Core Modules

- `src/viewer/viewer.ts` - render surface, controls, projection math application
- `src/model/loadModel.ts` - GLB loading + fallback strategy
- `src/tracking/faceTracker.ts` - MediaPipe lifecycle and frame extraction
- `src/ui/appUi.ts` - app shell and interaction primitives
- `src/lib/*.ts` - helpers for query parsing, off-axis math, smoothing

## Reliability Rules

- Viewer must keep rendering if tracking initialization fails.
- Model loading failure should fall back before showing procedural placeholder.
- `Stop Tracking` always releases camera tracks and inference resources.