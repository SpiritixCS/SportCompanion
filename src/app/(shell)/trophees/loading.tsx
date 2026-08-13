export default function TropheesLoading() {
  return (
    <div className="pb-10 animate-pulse">
      <div className="p-5">
        <div className="h-[11px] w-20 bg-hairline rounded" />
        <div className="h-11 w-40 bg-hairline rounded mt-3" />
        <div className="h-[15px] w-48 bg-hairline rounded mt-3" />
      </div>
      <div className="px-5 py-3 flex gap-2 border-b border-hairline">
        <div className="h-9 w-24 bg-hairline rounded-pill" />
        <div className="h-9 w-20 bg-hairline rounded-pill" />
        <div className="h-9 w-16 bg-hairline rounded-pill" />
      </div>
      <div className="grid grid-cols-2 min-[720px]:grid-cols-3 gap-3 px-5 pt-5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-square rounded-card bg-hairline" />
        ))}
      </div>
    </div>
  );
}
