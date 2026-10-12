"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from "@/lib/color-math";
import { cn } from "@/lib/utils";

// A colour picker that looks like the rest of the dashboard instead of the browser's: a swatch button that opens
// a popover with a saturation/brightness square, a hue slider, a hex field and ready-made colours (the brand
// green, Twitch purple, Discord's own role colours...). Works controlled (value + onChange) or uncontrolled
// (defaultValue + name, which renders a hidden field so a plain <form> still submits it). Values are "#RRGGBB".

const PRESETS = ["#00FFA8", "#9146FF", "#5865F2", "#3498DB", "#1ABC9C", "#2ECC71", "#F1C40F", "#E67E22", "#E74C3C", "#EB459E", "#99AAB5", "#FFFFFF"] as const;

export function ColorPicker({ id, value, defaultValue, onChange, name, className }: { id?: string; value?: string; defaultValue?: string; onChange?: (hex: string) => void; name?: string; className?: string }) {
  const t = useTranslations("ColorPicker");
  const [inner, setInner] = useState(normalizeHex(defaultValue ?? "") ?? "#00FFA8");
  const current = normalizeHex(value ?? "") ?? (value === undefined ? inner : "#000000");
  // The hue is kept apart: at zero saturation or brightness the colour alone can't say which hue the slider is on.
  const [hue, setHue] = useState(() => hexToHsv(current).h);
  const [draft, setDraft] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);

  const hsv: Hsv = { ...hexToHsv(current), h: hue };

  function commit(hex: string) {
    setInner(hex);
    onChange?.(hex);
  }

  function fromPointer(e: PointerEvent<HTMLDivElement>) {
    const rect = area.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const s = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    commit(hsvToHex({ h: hue, s, v }));
  }

  function onAreaKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.1 : 0.02;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const delta = move[e.key];
    if (!delta) return;
    e.preventDefault();
    commit(hsvToHex({ h: hue, s: Math.min(1, Math.max(0, hsv.s + delta[0])), v: Math.min(1, Math.max(0, hsv.v + delta[1])) }));
  }

  function setHex(text: string) {
    setDraft(text);
    const hex = normalizeHex(text);
    if (hex) {
      setHue(hexToHsv(hex).h);
      commit(hex);
    }
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover onOpenChange={() => setDraft(null)}>
        <PopoverTrigger render={<Button id={id} type="button" variant="outline" className={cn("justify-start gap-2 font-normal", className)} aria-label={`${t("label")}: ${current}`} />}>
          <span aria-hidden className="size-5 shrink-0 rounded-md border border-foreground/20" style={{ backgroundColor: current }} />
          <span className="tabular-nums">{current}</span>
        </PopoverTrigger>
        <PopoverContent className="flex w-[17rem] flex-col gap-3 p-3" align="start">
          <div
            ref={area}
            role="application"
            tabIndex={0}
            aria-label={t("area")}
            aria-roledescription={t("areaRole")}
            onKeyDown={onAreaKey}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              fromPointer(e);
            }}
            onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
            className="relative h-40 w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: `hsl(${hue} 100% 50%)`, backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)" }}
          >
            <span aria-hidden className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: current }} />
          </div>

          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(hue)}
            aria-label={t("hue")}
            onChange={(e) => {
              const h = Number(e.target.value);
              setHue(h);
              commit(hsvToHex({ h, s: hsv.s, v: hsv.v }));
            }}
            className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
            style={{ backgroundImage: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
          />

          <div className="flex items-center gap-2">
            <span aria-hidden className="size-8 shrink-0 rounded-md border border-foreground/20" style={{ backgroundColor: current }} />
            <Input aria-label={t("hex")} value={draft ?? current} maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={draft !== null && normalizeHex(draft) === null ? true : undefined} className="tabular-nums" onChange={(e) => setHex(e.target.value)} onBlur={() => setDraft(null)} />
          </div>

          <div role="group" aria-label={t("presets")} className="grid grid-cols-6 gap-1.5">
            {PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                aria-label={hex}
                aria-pressed={hex === current}
                onClick={() => {
                  setHue(hexToHsv(hex).h);
                  setDraft(null);
                  commit(hex);
                }}
                className={cn("size-8 rounded-md border border-foreground/20 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", hex === current && "ring-2 ring-foreground")}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
