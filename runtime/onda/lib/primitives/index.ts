// Shared visual primitives — the documented exception to the component
// contract's "self-contained" rule (CLAUDE.md §4): catalog components MAY
// import these building blocks. Keep this set small and material-level
// (surfaces, glows, fields) — not feature components.

export { Surface, type SurfaceProps } from './Surface';
export { Glow, type GlowProps } from './Glow';
export { GridField, type GridFieldProps } from './GridField';
export { Camera, type CameraProps } from './Camera';
// Prompt Motion: MotionBlur is not installed by `ondajs add` for our four cards (it needs @remotion/motion-blur),
// so its re-export is removed here to keep the barrel importable.
