export default function TropheesLoading() {
  return (
    <div className="px-[18px] pt-5 pb-10 animate-pulse">
      <div className="h-[11px] w-20 bg-hairline rounded" />
      <div className="h-[92px] w-48 bg-hairline rounded mt-2.5" />
      <div className="h-[14px] w-48 bg-hairline rounded mt-2.5" />
      <div className="h-[84px] bg-hairline rounded-[22px] mt-[18px]" />
      <div className="flex gap-2 mt-[18px]">
        <div className="h-[34px] w-28 bg-hairline rounded-pill" />
        <div className="h-[34px] w-14 bg-hairline rounded-pill" />
        <div className="h-[34px] w-24 bg-hairline rounded-pill" />
      </div>
      <div className="grid grid-cols-2 min-[720px]:grid-cols-3 gap-2 mt-3.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[168px] rounded-[22px] bg-hairline" />
        ))}
      </div>
    </div>
  );
}
