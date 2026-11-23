import type { TitleScene as TitleSceneData } from "@promptmotion/shared";
import type React from "react";
import { Interactive } from "remotion";
import { Entrance } from "../Entrance";

export const TitleScene: React.FC<{ scene: TitleSceneData }> = ({ scene }) => {
  return (
    <Interactive.Div
      name="Title background"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1e3a8a",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: 120,
      }}
    >
      <Entrance
        animation={scene.animation}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}
      >
        <Interactive.H1 name="Heading" style={{ margin: 0, fontSize: 120, fontWeight: 800 }}>
          {scene.heading}
        </Interactive.H1>
        {scene.subheading ? (
          <Interactive.P name="Subheading" style={{ margin: 0, fontSize: 56, opacity: 0.85 }}>
            {scene.subheading}
          </Interactive.P>
        ) : null}
      </Entrance>
    </Interactive.Div>
  );
};
