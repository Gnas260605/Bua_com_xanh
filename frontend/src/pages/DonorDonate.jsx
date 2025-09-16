import { useEffect, useState, useMemo } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import { Save, Edit3, Trash2, PackagePlus, Plus, Minus, Image as ImgIcon } from "lucide-react";

/* Primitive */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-300 bg-white shadow-[0_1px_0_#e5e7eb,0_8px_24px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>
);

function Row({ m, checked, onCheck, onEdit, onDel }) {
  return (
    <div className="p-4 rounded-2xl border bg-white flex items-center gap-4 hover:shadow-[0_1px_0_#e5e7eb,0_12px_28px_rgba(0,0,0,0.08)] transition-all">
      <button onClick={() => onCheck(m, !checked)} className="p-1.5 rounded-lg border hover:bg-slate-50" aria-label="Chọn món để gom bữa cơm">
        <input type="checkbox" checked={checked} readOnly />
      </button>

      <img src={m.photo_url || "/images/campaigns/placeholder.jpg"} alt="" className="h-16 w-16 rounded-xl object-cover border" />

      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-slate-900 truncate">{m.name}</div>
        <div className="text-sm text-slate-600">
          Suất: <b>{m.portions}</b> • Trạng thái: <span className="uppercase">{m.status}</span>
        </div>
      </div>

      <select
        className="rounded-xl border px-3 py-2 text-sm"
        value={m.status}
        onChange={(e) => onEdit(m, { status: e.target.value })}
        aria-label="Cập nhật trạng thái"
      >
        <option value="available">Mới</option>
        <option value="reserved">Đã đặt</option>
        <option value="given">Đã tặng</option>
        <option value="expired">Quá hạn</option>
        <option value="hidden">Ẩn</option>
      </select>

      <button onClick={() => onEdit(m)} className="px-3 py-2 rounded-xl border text-sm"><Edit3 className="h-4 w-4" /></button>
      <button onClick={() => onDel(m)} className="px-3 py-2 rounded-xl border text-sm hover:bg-rose-50"><Trash2 className="h-4 w-4 text-rose-600" /></button>
    </div>
  );
}

export default function DonorDonate() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ name: "", portions: 1, photo_url: "", is_veg: false, pickup_address: "" });
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState({}); // id -> true

  async function load() {
    const r = await apiGet("/api/donor/food-items");
    setList(r || []);
  }
  useEffect(() => { load(); }, []);

  const selectedItems = useMemo(() => (list || []).filter((m) => selected[m.id]), [list, selected]);
  function toggleSelect(m, v) { setSelected((s) => ({ ...s, [m.id]: v || undefined })); }

  async function saveNew(e) {
    e?.preventDefault?.();
    const payload = { ...form, portions: Number(form.portions || 0) };
    if (editing) { await apiPatch(`/api/donor/food-items/${editing.id}`, payload); setEditing(null); }
    else { await apiPost("/api/donor/food-items", payload); }
    setForm({ name: "", portions: 1, photo_url: "", is_veg: false, pickup_address: "" });
    await load();
  }
  async function quickEdit(m, patch) { await apiPatch(`/api/donor/food-items/${m.id}`, patch); await load(); }
  async function del(m) { if (!confirm(`Xóa món "${m.name}"?`)) return; await apiDelete(`/api/donor/food-items/${m.id}`); await load(); }
  async function createBundle() {
    if (selectedItems.length === 0) return;
    const name = prompt("Tên bữa cơm:"); if (!name) return;
    await apiPost("/api/donor/bundles", { name, food_item_ids: selectedItems.map((x) => x.id) });
    setSelected({}); await load(); alert("Đã tạo bữa cơm!");
  }

  useEffect(() => {
    if (editing) setForm({
      name: editing.name, portions: editing.portions, photo_url: editing.photo_url || "",
      is_veg: !!editing.is_veg, pickup_address: editing.pickup_address || ""
    });
  }, [editing]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Quyên góp ngay</h1>
        <button
          onClick={createBundle}
          disabled={selectedItems.length === 0}
          className={`px-4 py-2 rounded-2xl border text-slate-700 hover:bg-slate-50 ${selectedItems.length === 0 ? "opacity-50" : ""}`}
        >
          <PackagePlus className="inline h-4 w-4 mr-1" /> Gom “Bữa cơm”
        </button>
      </div>

      {/* Form */}
      <Card className="mb-6">
        <form onSubmit={saveNew} className="grid md:grid-cols-2 gap-4 p-5">
          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-800">Tên món</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="rounded-xl border px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Ví dụ: Cơm chay rau nấm"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-800">Số suất</span>
            <div className="flex items-stretch rounded-xl border overflow-hidden">
              <button type="button" className="px-3 hover:bg-slate-50" onClick={() => setForm(f => ({ ...f, portions: Math.max(0, Number(f.portions) - 1) }))}><Minus className="h-4 w-4" /></button>
              <input
                type="number" min={0} value={form.portions}
                onChange={(e) => setForm({ ...form, portions: e.target.value })}
                className="w-full px-4 py-2.5 text-slate-900 focus:outline-none"
              />
              <button type="button" className="px-3 hover:bg-slate-50" onClick={() => setForm(f => ({ ...f, portions: Number(f.portions) + 1 }))}><Plus className="h-4 w-4" /></button>
            </div>
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-800">Ảnh (URL)</span>
            <div className="flex gap-3">
              <input
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                className="flex-1 rounded-xl border px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                placeholder="https://…"
              />
              <div className="grid place-items-center w-24 h-16 rounded-xl border bg-slate-50 overflow-hidden">
                {form.photo_url ? <img src={form.photo_url} alt="" className="object-cover w-full h-full" /> : <ImgIcon className="h-6 w-6 text-slate-400" />}
              </div>
            </div>
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-800">Địa chỉ lấy</span>
            <input
              value={form.pickup_address}
              onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
              className="rounded-xl border px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Số nhà, đường…"
            />
          </label>

          <label className="inline-flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={form.is_veg} onChange={(e) => setForm({ ...form, is_veg: e.target.checked })} />
            <span className="text-slate-900">Món chay</span>
          </label>

          <div className="md:col-span-2 text-right">
            <button className="inline-flex items-center px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300">
              <Save className="h-4 w-4 mr-1" /> {editing ? "Cập nhật" : "Tạo món"}
            </button>
            {editing && (
              <button
                type="button"
                className="ml-3 px-4 py-2.5 rounded-2xl border"
                onClick={() => { setEditing(null); setForm({ name: "", portions: 1, photo_url: "", is_veg: false, pickup_address: "" }); }}
              >
                Hủy
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* List */}
      {!list ? (
        <Card className="p-8 text-center text-slate-600">Đang tải…</Card>
      ) : list.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-slate-900 font-semibold">Chưa có món nào</div>
          <div className="text-sm text-slate-600">Hãy thêm món đầu tiên bằng form phía trên.</div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.map((m) => (
            <Row key={m.id} m={m} checked={!!selected[m.id]}
              onCheck={toggleSelect}
              onEdit={(mm, patch) => (patch ? quickEdit(mm, patch) : setEditing(mm))}
              onDel={del}
            />
          ))}
        </div>
      )}
    </div>
  );
}
