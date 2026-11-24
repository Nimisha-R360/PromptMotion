// Shared types between the remocn host bundle (React side) and the vanilla player runtime.

/** Registry ids of remocn components are "remocn.<registry name>". */
export const REMOCN_PREFIX = "remocn.";
export const isRemocnId = (id: string | undefined): id is string => !!id && id.startsWith(REMOCN_PREFIX);

/**
 * Props through which a component shows a picture: the user's uploaded images are passed here
 * (single image props get the first image, list props get all of them).
 */
export const MEDIA_PROPS = ["src", "image", "imageSrc", "heroSrc", "screenshot", "photo", "mediaSrc", "fromSrc", "toSrc", "coverUrl"];
export const MEDIA_LIST_PROPS = ["images", "photos", "screenshots", "screenImages"];

/** Simplified type of one component prop, as extracted by scripts/remocn-manifest.ts. */
export type RemocnPropKind = "string" | "number" | "boolean" | "string[]" | "captions" | "node" | { enum: string[] } | "other";

export interface RemocnEntry {
  component: unknown;
  /** the component's own props (React/HTML attributes excluded) */
  props: Record<string, RemocnPropKind>;
  required: string[];
}

export interface RemocnMountOptions {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface RemocnMount {
  seek(frame: number): void;
  unmount(): void;
}

export interface RemocnHost {
  modules: Record<string, unknown>;
  register(id: string, entry: RemocnEntry): void;
  has(id: string): boolean;
  entry(id: string): RemocnEntry | undefined;
  mount(container: HTMLElement, id: string, props: Record<string, unknown>, opts: RemocnMountOptions): RemocnMount | null;
}

declare global {
  interface Window {
    __PMR__?: RemocnHost;
  }
}
