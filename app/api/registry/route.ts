import { NextResponse } from "next/server";
import { COMPONENTS, FRAMEWORKS, PRIMITIVES } from "@/runtime/registry";
import { THEMES } from "@/runtime/themes";
import { LAYOUTS, LAYOUT_INFO } from "@/runtime/types";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    { frameworks: FRAMEWORKS, components: COMPONENTS, primitives: PRIMITIVES, themes: THEMES, layouts: LAYOUTS.map((id) => ({ id, description: LAYOUT_INFO[id] })) },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
