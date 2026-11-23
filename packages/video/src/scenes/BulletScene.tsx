import type { BulletsScene } from "@promptmotion/shared";
import type React from "react";
import { Interactive } from "remotion";
import { Entrance } from "../Entrance";

export const BulletScene: React.FC<{ scene: BulletsScene }> = ({ scene }) => {
  return (
    <Interactive.Div
      name="Bullets background"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        backgroundColor: "#065f46",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        padding: 160,
      }}
    >
      <Entrance
        animation={scene.animation}
        style={{ display: "flex", flexDirection: "column", gap: 48 }}
      >
        <Interactive.H2 name="Heading" style={{ margin: 0, fontSize: 96, fontWeight: 800 }}>
          {scene.heading}
        </Interactive.H2>
        <Interactive.Ul
          name="Bullet list"
          style={{ margin: 0, paddingLeft: 64, display: "flex", flexDirection: "column", gap: 24 }}
        >
          {scene.bullets.map((bullet, index) => (
            <Interactive.Li key={index} name={`Bullet ${index + 1}`} style={{ fontSize: 60 }}>
              {bullet}
            </Interactive.Li>
          ))}
        </Interactive.Ul>
      </Entrance>
    </Interactive.Div>
  );
};
