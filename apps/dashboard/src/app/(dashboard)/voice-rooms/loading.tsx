import { Skeleton } from "@/components/ui/skeleton";

// Same shapes as the real page, so nothing jumps when the data arrives.
export default function VoiceRoomsLoading() {
  return (
    <div className="flex flex-col gap-fluid" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-[6.5rem] rounded-xl" />
        <Skeleton className="h-[6.5rem] rounded-xl" />
      </div>
      <div className="flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-7 w-28" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
