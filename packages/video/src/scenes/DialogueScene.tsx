import type { DialogueScene as DialogueSceneData } from "@promptmotion/shared";
import type React from "react";
import { Interactive } from "remotion";
import { Entrance } from "../Entrance";

export const DialogueScene: React.FC<{ scene: DialogueSceneData }> = ({ scene }) => {
  return (
    <Interactive.Div
      name="Dialogue background"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        backgroundColor: "#7c2d12",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        padding: 160,
      }}
    >
      <Entrance
        animation={scene.animation}
        style={{ display: "flex", flexDirection: "column", gap: 40 }}
      >
        {scene.lines.map((line, index) => (
          <Interactive.P key={index} name={`Line ${index + 1}`} style={{ margin: 0, fontSize: 60 }}>
            <Interactive.Strong name={`Speaker ${index + 1}`} style={{ color: "#fdba74" }}>
              {line.speaker}:
            </Interactive.Strong>{" "}
            {line.text}
          </Interactive.P>
        ))}
      </Entrance>
    </Interactive.Div>
  );
};
