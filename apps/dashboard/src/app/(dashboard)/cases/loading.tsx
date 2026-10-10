import { Skeleton } from "@/components/ui/skeleton";

// Same shapes as the real page, so nothing jumps when the data arrives.
export default function CasesLoading() {
  return (
    <div className="flex flex-col gap-fluid" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[4.25rem] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
