export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="h-full min-h-0 overflow-auto p-2 sm:p-4">
      <div className="file-grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="rounded-lg border border-neutral-800 p-1.5 sm:p-2">
            <div className="mb-2 aspect-square rounded skeleton" />
            <div className="h-3 w-3/4 rounded skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
