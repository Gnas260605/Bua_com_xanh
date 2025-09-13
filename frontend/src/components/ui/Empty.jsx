import Card from "./Card";
export default function Empty({ title="Chưa có dữ liệu", hint="" }) {
  return (
    <Card className="p-10 text-center text-slate-600 flex flex-col items-center gap-3">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-3xl">🍃</div>
      <div className="text-xl font-semibold">{title}</div>
      {hint && <div className="text-sm text-slate-500 max-w-[520px]">{hint}</div>}
    </Card>
  );
}
