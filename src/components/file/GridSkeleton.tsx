export function GridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="h-full min-h-0 bg-black">
      <div className="file-grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="file-grid-item skeleton" />
        ))}
      </div>
    </div>
  );
}
