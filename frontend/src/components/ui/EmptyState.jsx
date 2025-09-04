export default function EmptyState({ title="Chưa có dữ liệu", desc="Hãy thử đổi bộ lọc hoặc thêm dữ liệu." }) {
  return (
    <div className="text-center p-10 text-slate-500">
      <div className="text-6xl mb-4"></div>
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-slate-400 mt-1">{desc}</div>
    </div>
  );
}
