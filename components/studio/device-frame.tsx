"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Device = "desktop" | "tablet" | "mobile";

/** CSS viewport sizes (portrait) of the previewed devices — the iframe gets exactly this viewport. */
export const DEVICE_SIZE: Record<Exclude<Device, "desktop">, { w: number; h: number; label: string }> = {
  tablet: { w: 820, h: 1180, label: "Tablet" },
  mobile: { w: 390, h: 844, label: "Mobile" },
};

/**
 * Renders children (the player iframe) at a real device viewport inside a bezel, scaled down to fit the
 * available space. Because the iframe really is 390×844 / 820×1180, the player picks its portrait
 * (app) layout exactly as it would on the device.
 */
export function DeviceFrame({ device, landscape, children }: { device: Exclude<Device, "desktop">; landscape: boolean; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const size = DEVICE_SIZE[device];
  const [w, h] = landscape ? [size.h, size.w] : [size.w, size.h];
  const bezel = device === "mobile" ? 14 : 18;
  const outerW = w + bezel * 2;
  const outerH = h + bezel * 2;
  const scale = avail.w && avail.h ? Math.min(1, avail.w / outerW, avail.h / outerH) : 0;

  return (
    <div ref={box} className="flex size-full min-h-0 flex-col items-center justify-center">
      <div style={{ width: outerW * scale, height: outerH * scale }} className={cn("relative", !scale && "invisible")}>
        <div
          className={cn(
            "absolute top-0 left-0 origin-top-left border border-white/10 bg-neutral-950 shadow-2xl shadow-black/60",
            device === "mobile" ? "rounded-[52px]" : "rounded-[36px]",
          )}
          style={{ width: outerW, height: outerH, padding: bezel, transform: `scale(${scale})` }}
        >
          {device === "mobile" && (
            <span
              aria-hidden
              className={cn("absolute z-10 rounded-full bg-black", landscape ? "top-1/2 left-[22px] h-[110px] w-[26px] -translate-y-1/2" : "top-[22px] left-1/2 h-[26px] w-[110px] -translate-x-1/2")}
            />
          )}
          <div className={cn("relative size-full overflow-hidden bg-black", device === "mobile" ? "rounded-[40px]" : "rounded-[20px]")} style={{ width: w, height: h }}>
            {children}
          </div>
        </div>
      </div>
      <span className="mt-2 text-[11px] text-muted-foreground tabular-nums">
        {size.label} · {w}×{h}
      </span>
    </div>
  );
}
