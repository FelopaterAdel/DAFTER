export default function AppLoading() {
  return (
    <div className="animate-pulse" aria-label="جارٍ التحميل">
      <div className="h-4 w-24 rounded-full bg-surface-muted" />
      <div className="mt-3 h-8 w-64 max-w-full rounded-xl bg-surface-muted" />
      <div className="mt-2 h-4 w-80 max-w-full rounded-full bg-surface-muted/70" />

      <div className="mt-7 h-48 rounded-3xl bg-surface-muted" />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-surface-muted" />
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="h-56 rounded-2xl bg-surface-muted" />
        <div className="h-56 rounded-2xl bg-surface-muted" />
      </div>
    </div>
  );
}
