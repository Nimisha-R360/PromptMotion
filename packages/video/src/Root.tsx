import { samplePlan, VideoPlanSchema } from "@promptmotion/shared";
import type React from "react";
import { Composition } from "remotion";
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "./constants";
import { getDurationInFrames } from "./duration";
import { Video } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Video"
      component={Video}
      schema={VideoPlanSchema}
      defaultProps={samplePlan}
      calculateMetadata={({ props }) => ({ durationInFrames: getDurationInFrames(props) })}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      fps={VIDEO_FPS}
    />
  );
};
