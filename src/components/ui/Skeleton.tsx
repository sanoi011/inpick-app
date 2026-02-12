"use client";

interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className || "h-4 w-full"}`}
    />
  );
}

export function SkeletonProjectCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <SkeletonLine className="h-4 w-40" />
        <SkeletonLine className="h-5 w-16 rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-56" />
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-1 pt-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
            {i < 6 && <div className="w-4 h-0.5 bg-gray-100" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonContractCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <SkeletonLine className="h-4 w-4 rounded" />
          <SkeletonLine className="h-4 w-36" />
        </div>
        <SkeletonLine className="h-5 w-14 rounded-full" />
      </div>
      <SkeletonLine className="h-3 w-48" />
      <div className="flex items-center justify-between">
        <SkeletonLine className="h-3 w-32" />
        <SkeletonLine className="h-4 w-24" />
      </div>
    </div>
  );
}

export function SkeletonSummaryCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="px-4 py-3 rounded-xl border border-gray-200 bg-white"
        >
          <SkeletonLine className="h-3 w-12 mb-2" />
          <SkeletonLine className="h-7 w-8" />
        </div>
      ))}
    </div>
  );
}
