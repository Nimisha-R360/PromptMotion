import { NextResponse } from "next/server";
import { llmStatus, warmUp } from "@/lib/llm";
import { DESIGNER_SYSTEM } from "@/lib/designer/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Model status + what it is doing right now (thinking / planning / designing …). Also pre-reads the design guide in the background. */
export async function GET() {
  const status = await llmStatus(DESIGNER_SYSTEM);
  // pre-read the design guide so the first design request only pays for its own tokens
  if (status.online && !status.warm && !status.activity) void warmUp(DESIGNER_SYSTEM);
  return NextResponse.json(status);
}
