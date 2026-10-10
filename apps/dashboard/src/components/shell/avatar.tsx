import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0] ?? "?"];
  return letters
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

/**
 * The staff member's picture (Discord's CDN, allowed in the CSP's img-src) with
 * their initials as the fallback. Decorative: the name is always next to it.
 */
export function Avatar({ name, image, className }: { name: string; image: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-sm font-bold text-brand-text ring-1 ring-primary/30",
        className,
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a remote avatar of unknown size; next/image would need an allow-list
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
