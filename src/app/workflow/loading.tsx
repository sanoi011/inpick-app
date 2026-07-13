export default function WorkflowLoading() {
  return (
    <main className="min-h-screen bg-[#FDF7F4] px-5 py-8 text-primary-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="h-8 w-24 animate-pulse rounded-full bg-primary-100" />
          <div className="h-9 w-28 animate-pulse rounded-full bg-white shadow-sm" />
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-3 rounded-[24px] bg-[#EFE8DC] p-4">
            <div className="h-20 animate-pulse rounded-2xl bg-white/80" />
            <div className="h-52 animate-pulse rounded-2xl bg-white/70" />
            <div className="h-36 rounded-2xl bg-gradient-to-br from-primary-600 to-amber-500 p-5 text-white shadow-cta">
              <div className="relative mx-auto h-12 w-12">
                <div className="absolute inset-0 rounded-full border-4 border-white/25" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-white border-r-white" />
              </div>
              <p className="mt-3 text-center text-sm font-extrabold">화면을 준비하고 있어요</p>
            </div>
          </div>
          <div className="rounded-[28px] border border-primary-100 bg-white p-5 shadow-sm">
            <div className="h-7 w-44 animate-pulse rounded-lg bg-primary-100" />
            <div className="mt-5 h-[52vh] animate-pulse rounded-2xl bg-gradient-to-br from-primary-50 via-[#F8F9F6] to-amber-50" />
            <div className="mt-4 h-12 animate-pulse rounded-full bg-primary-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
