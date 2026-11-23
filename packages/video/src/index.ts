// What other packages (the web app's Player) import.
// Don't import ./entry here: registerRoot() must only run inside Remotion.
export { Video } from "./Video";
export { getDurationInFrames, getSceneDurationInFrames } from "./duration";
export { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "./constants";
