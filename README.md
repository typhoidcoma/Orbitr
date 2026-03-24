<p align="center">
  <img src="./Assets/orbitr_logo.svg" alt="Orbitr logo" width="220" />
</p>

# Orbitr

Simple off-axis Three.js viewer with MediaPipe head + eye tracking.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## URL Params

- `model` - GLB URL override
- `shiftX`, `shiftY` - off-axis frustum shift (`-1` to `1`)
- `fov`, `near`, `far` - camera tuning

## Tracking

- Click `Start Tracking` to enable webcam tracking.
- Head movement steers view target.
- Eye tracking controls the reticle overlay.
