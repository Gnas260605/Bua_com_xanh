export default function Toolbar({
  filters, onToggle, sortBy, onChangeSort, onCreate, onRefresh
}) {
  const btn = "inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition active:scale-[0.98]";
  const primary = "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700";
  const ghost = "bg-white hover:bg-gray-50 border-gray-200 text-gray-700";

  return (
    <div className="max-w-6xl mx-auto px-4 -mt-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 sm:p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button className={`${btn} ${primary}`} onClick={onCreate}>+ Tạo chiến dịch</button>
          <button className={`${btn} ${ghost}`} onClick={onRefresh}>Làm mới</button>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        <div className="inline-flex items-center text-sm border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button
            aria-pressed={filters.nearMe}
            onClick={() => onToggle("nearMe")}
            className={`px-3.5 py-2.5 hover:bg-gray-50 ${filters.nearMe ? "bg-emerald-50 text-emerald-700" : ""}`}
          >Gần tôi</button>
          <button
            aria-pressed={filters.expiring}
            onClick={() => onToggle("expiring")}
            className={`px-3.5 py-2.5 hover:bg-gray-50 ${filters.expiring ? "bg-emerald-50 text-emerald-700" : ""}`}
          >Gần hết hạn</button>
          <button
            aria-pressed={filters.diet}
            onClick={() => onToggle("diet")}
            className={`px-3.5 py-2.5 hover:bg-gray-50 ${filters.diet ? "bg-emerald-50 text-emerald-700" : ""}`}
          >Phù hợp chế độ ăn</button>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        <label className="text-sm text-gray-600">Sắp xếp:</label>
        <select
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white outline-none focus:ring-4 focus:ring-emerald-100 w-auto"
          value={sortBy}
          onChange={(e) => onChangeSort(e.target.value)}
        >
          <option value="newest">Mới nhất</option>
          <option value="progress">Gần hoàn thành</option>
          <option value="supporters">Ủng hộ nhiều</option>
        </select>
      </div>
    </div>
  );
}
