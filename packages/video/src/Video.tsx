import type { Scene, SceneType, VideoPlan } from "@promptmotion/shared";
import type React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { getSceneDurationInFrames } from "./duration";
import { BulletScene } from "./scenes/BulletScene";
import { DialogueScene } from "./scenes/DialogueScene";
import { TitleScene } from "./scenes/TitleScene";

type SceneComponentMap = {
  [T in SceneType]: React.FC<{ scene: Extract<Scene, { type: T }> }>;
};

/** scene.type → component. A new scene type in the schema won't compile until it's added here. */
const sceneComponents: SceneComponentMap = {
  title: TitleScene,
  bullets: BulletScene,
  dialogue: DialogueScene,
};

const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  // Safe: the map is keyed by `type`, so the component always matches the scene.
  const Component = sceneComponents[scene.type] as React.FC<{ scene: Scene }>;
  return <Component scene={scene} />;
};

/** Plays every scene of the plan back to back, one <Sequence> per scene. */
export const Video: React.FC<VideoPlan> = ({ scenes }) => {
  const { fps } = useVideoConfig();

  const timeline = scenes.reduce<{ scene: Scene; from: number; durationInFrames: number }[]>(
    (acc, scene) => {
      const previous = acc.at(-1);
      const from = previous ? previous.from + previous.durationInFrames : 0;
      acc.push({ scene, from, durationInFrames: getSceneDurationInFrames(scene, fps) });
      return acc;
    },
    [],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {timeline.map(({ scene, from, durationInFrames }, index) => (
        <Sequence
          key={scene.id}
          from={from}
          durationInFrames={durationInFrames}
          name={`${index + 1}. ${scene.type}`}
        >
          <SceneView scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
