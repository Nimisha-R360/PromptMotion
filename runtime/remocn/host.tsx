// remocn host: React + Remotion + @remotion/player, shared by every remocn component bundle.
// Bundled into runtime-dist/remocn/host.js and inlined into a page only when a slide uses a remocn component.
// Component bundles (runtime-dist/remocn/c/<id>.js) don't bundle React/Remotion themselves — they read them from
// `window.__PMR__.modules`, so all of them share one React and one Remotion instance (Remotion's contexts must match).
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import * as remotion from "remotion";
import { Player, type PlayerRef } from "@remotion/player";
import type { RemocnEntry, RemocnHost, RemocnMount, RemocnMountOptions } from "./types";

const entries = new Map<string, RemocnEntry>();

class Boundary extends React.Component<{ id: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("[prompt-motion] remocn component failed:", this.props.id, e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function mount(container: HTMLElement, id: string, props: Record<string, unknown>, opts: RemocnMountOptions): RemocnMount | null {
  const entry = entries.get(id);
  if (!entry) return null;
  const width = Math.max(2, Math.round(opts.width));
  const height = Math.max(2, Math.round(opts.height));
  const root: Root = createRoot(container);
  const ref = React.createRef<PlayerRef>();
  const Comp = entry.component as React.ComponentType<Record<string, unknown>>;
  const Scene = (p: Record<string, unknown>) => (
    <Boundary id={id}>
      <Comp {...p} />
    </Boundary>
  );
  flushSync(() =>
    root.render(
      <Player
        ref={ref}
        component={Scene}
        inputProps={props}
        durationInFrames={Math.max(1, Math.round(opts.durationInFrames))}
        fps={opts.fps}
        compositionWidth={width}
        compositionHeight={height}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        moveToBeginningWhenEnded={false}
        initiallyShowControls={false}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      />,
    ),
  );
  let last = -1;
  return {
    seek(frame: number) {
      const f = Math.min(Math.max(0, Math.round(frame)), Math.max(0, Math.round(opts.durationInFrames) - 1));
      if (f === last || !ref.current) return;
      last = f;
      ref.current.seekTo(f);
    },
    unmount() {
      root.unmount();
    },
  };
}

const host: RemocnHost = {
  modules: { react: React, "react/jsx-runtime": jsxRuntime, "react-dom": ReactDOM, remotion },
  register(id, entry) {
    entries.set(id, entry);
  },
  has: (id) => entries.has(id),
  entry: (id) => entries.get(id),
  mount,
};

window.__PMR__ = host;
