import "server-only";
import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

type Send = (event: string, data: unknown) => void;

/** Server-sent events response; `run` streams progress and must send a final `done`. */
export function sse(run: (send: Send) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send: Send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await run(send);
      } catch (e) {
        console.error("[sse]", e);
        send("error", { message: (e as Error).message || "Generation failed" });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}

/** One generation per project at a time (the local model is single-tenant anyway). */
declare global {
  var __pmBusy: Set<string> | undefined;
}
const busy = (globalThis.__pmBusy ??= new Set<string>());
export function tryLock(id: string) {
  if (busy.has(id)) return false;
  busy.add(id);
  return true;
}
export function unlock(id: string) {
  busy.delete(id);
}
export const isBusy = (id: string) => busy.has(id);
