import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE, apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail, Lock, User, Phone, Image, MapPin, LocateFixed, LogOut, ShieldCheck,
  History, Download, Trash2, ArrowRight, Globe, Loader2, Eye, EyeOff
} from "lucide-react";

export default function Settings() {
  const { user, setUser, signOut } = useAuth();
  const t = useToast();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    avatar_url: "",
    lat: null,
    lng: null,
  });

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ===== PASSWORD CHANGE (new twice) =====
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [changing, setChanging] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  // 🔹 Tải profile trực tiếp từ DB
  async function loadProfile() {
    setProfileLoading(true);
    try {
      const me = await apiGet("/api/users/me");
      setForm({
        name: me?.name ?? "",
        email: me?.email ?? "",
        phone: me?.phone ?? "",
        address: me?.address ?? "",
        avatar_url: me?.avatar_url ?? "",
        lat: me?.lat ?? null,
        lng: me?.lng ?? null,
      });
      setUser(me);
    } catch (e) {
      console.error(e);
      t.error("Không tải được hồ sơ. Bạn có thể cần đăng nhập lại.");
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avatar = useMemo(
    () => (form.avatar_url && form.avatar_url.trim().length > 0
      ? form.avatar_url
      : "https://i.pravatar.cc/160?img=12"),
    [form.avatar_url]
  );

  function setField(k, v) { setForm((s) => ({ ...s, [k]: v })); }

  // ✅ Lưu hồ sơ: PATCH /api/users/me
  async function onSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const res = await fetch(`${API_BASE}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name?.trim(),
          phone: form.phone?.trim(),
          address: form.address?.trim(),
          avatar_url: form.avatar_url?.trim(),
          lat: form.lat,
          lng: form.lng,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      await loadProfile();
      t.success("Đã cập nhật thông tin cá nhân");
    } catch (err) {
      console.error(err);
      t.error("Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  }

  // ✅ Upload avatar: POST ${API_BASE}/api/upload + token
  async function onPickAvatar(file) {
    if (!file) return;
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      if (!data?.url) throw new Error("No url");
      setField("avatar_url", data.url);
      t.success("Tải ảnh thành công. Nhớ bấm 'Lưu thay đổi' để lưu vào hồ sơ.");
    } catch (e) {
      console.error(e);
      t.error("Upload ảnh thất bại (kiểm tra API /api/upload)");
    }
  }

  // Lấy GPS
  const [locating, setLocating] = useState(false);
  async function detectLocation() {
    if (!navigator.geolocation) {
      t.error("Trình duyệt không hỗ trợ định vị");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setField("lat", Number(latitude.toFixed(6)));
        setField("lng", Number(longitude.toFixed(6)));
        t.success("Đã lấy vị trí hiện tại");
      },
      (err) => {
        setLocating(false);
        console.error(err);
        t.error("Không lấy được vị trí");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // ===== Sessions =====
  const [sessions, setSessions] = useState([]);
  const [sessLoading, setSessLoading] = useState(false);

  async function loadSessions() {
    setSessLoading(true);
    try {
      const list = await apiGet("/api/users/sessions");
      setSessions(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn("sessions api missing");
    } finally {
      setSessLoading(false);
    }
  }
  useEffect(() => { loadSessions(); }, []);

  async function logoutOthers() {
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const res = await fetch(`${API_BASE}/api/users/logout-others`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("logout-others failed");
      t.success("Đã đăng xuất các phiên khác");
      loadSessions();
    } catch (e) {
      console.error(e);
      t.error("Không thể đăng xuất các phiên khác");
    }
  }

  // ===== History =====
  const [history, setHistory] = useState({ given: [], received: [], payments: [] });
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setHistLoading(true);
      try {
        const data = await apiGet("/api/users/history?limit=8");
        setHistory({
          given: data?.given ?? [],
          received: data?.received ?? [],
          payments: data?.payments ?? [],
        });
      } catch (e) {
        console.warn("history api missing");
      } finally {
        setHistLoading(false);
      }
    })();
  }, []);

  // ===== Privacy / Danger zone =====
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function exportData() {
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const r = await fetch(`${API_BASE}/api/users/export`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bua-com-xanh-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      t.error("Không tải được dữ liệu (kiểm tra API /api/users/export)");
    }
  }

  async function deleteAccount() {
    if (confirmText !== "XOA TAI KHOAN") {
      t.error('Vui lòng gõ chính xác: "XOA TAI KHOAN"');
      return;
    }
    setDeleting(true);
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const r = await fetch(`${API_BASE}/api/users/delete`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) throw new Error("Delete failed");
      t.info("Tài khoản đã được xóa");
      signOut();
    } catch (e) {
      console.error(e);
      t.error("Không xóa được (kiểm tra API /api/users/delete)");
    } finally {
      setDeleting(false);
    }
  }

  // ===== Change Password Logic =====
  function validatePassword(p) {
    // Tùy dự án, bạn có thể siết chặt hơn (min length, số, chữ hoa...)
    return typeof p === "string" && p.length >= 8;
  }

  async function changePassword() {
    if (!pw1 || !pw2) {
      t.error("Vui lòng nhập đầy đủ 2 lần mật khẩu mới");
      return;
    }
    if (pw1 !== pw2) {
      t.error("Hai mật khẩu không khớp");
      return;
    }
    if (!validatePassword(pw1)) {
      t.error("Mật khẩu tối thiểu 8 ký tự");
      return;
    }

    setChanging(true);
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");

    try {
      // Ưu tiên chuẩn REST dưới đây
      let res = await fetch(`${API_BASE}/api/users/me/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ new_password: pw1 }),
      });

      // Fallback nếu backend bạn đang dùng route khác
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ new_password: pw1 }),
        });
      }

      if (!res.ok) throw new Error(`Change password failed: ${res.status}`);
      setPw1(""); setPw2("");

      // Giả định backend đã gửi email thông báo
      t.success("Đã đổi mật khẩu. Vui lòng kiểm tra email xác nhận.");
    } catch (e) {
      console.error(e);
      t.error("Đổi mật khẩu thất bại");
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* === PROFILE === */}
      <Card className="p-6 border rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="text-xl font-semibold">Hồ sơ cá nhân</div>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <ShieldCheck size={16} /> Thông tin được bảo vệ
          </div>
        </div>

        {profileLoading ? (
          <div className="text-sm text-gray-500">Đang tải hồ sơ...</div>
        ) : (
          <form onSubmit={onSaveProfile} className="space-y-5">
            <div className="flex items-center gap-5">
              <img src={avatar} alt="avatar" className="h-16 w-16 rounded-full object-cover border" />
              <div className="flex items-center gap-3">
                <input
                  className="input w-[320px]"
                  placeholder="https://..."
                  value={form.avatar_url}
                  onChange={(e) => setField("avatar_url", e.target.value)}
                />
                <label className="inline-flex">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickAvatar(e.target.files?.[0])} />
                  <span className="btn border px-3 py-2 rounded-lg cursor-pointer">Tải ảnh</span>
                </label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <User size={16} /> Họ và tên
                </label>
                <input className="input w-full" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Mail size={16} /> Email
                </label>
                <input className="input w-full bg-gray-100 cursor-not-allowed" value={form.email} disabled />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Phone size={16} /> Số điện thoại
                </label>
                <input className="input w-full" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Image size={16} /> Ảnh đại diện (URL)
                </label>
                <input className="input w-full" placeholder="https://..." value={form.avatar_url} onChange={(e) => setField("avatar_url", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Địa chỉ</label>
              <textarea className="input w-full" value={form.address} onChange={(e) => setField("address", e.target.value)} />
            </div>

            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <MapPin size={16} /> Vĩ độ (lat)
                </label>
                <input className="input w-full" value={form.lat ?? ""} onChange={(e) => setField("lat", e.target.value === "" ? null : Number(e.target.value))} placeholder="16.047079" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Globe size={16} /> Kinh độ (lng)
                </label>
                <input className="input w-full" value={form.lng ?? ""} onChange={(e) => setField("lng", e.target.value === "" ? null : Number(e.target.value))} placeholder="108.206230" />
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" onClick={detectLocation} disabled={locating}>
                  {locating ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16}/> Đang lấy vị trí</span>
                            : <span className="inline-flex items-center gap-2"><LocateFixed size={16}/> Lấy vị trí hiện tại</span>}
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Button>
            </div>
          </form>
        )}
      </Card>

      {/* SECURITY (Password change with double entry) */}
      <Card className="p-6 border rounded-2xl shadow-sm">
        <div className="text-xl font-semibold mb-1">Bảo mật & Đăng nhập</div>
        <p className="text-sm text-gray-600 mb-4">Đổi mật khẩu bằng cách nhập mật khẩu mới 2 lần. Sau khi đổi thành công, hệ thống sẽ gửi email thông báo.</p>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-600"><Lock size={16}/> Đổi mật khẩu</label>

            <div className="space-y-2">
              <div className="relative">
                <input
                  className="input w-full pr-10"
                  type={showPw ? "text" : "password"}
                  placeholder="Mật khẩu mới (tối thiểu 8 ký tự)"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  onClick={() => setShowPw(s => !s)}
                  aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>

              <div className="relative">
                <input
                  className="input w-full pr-10"
                  type={showPw2 ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu mới"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  onClick={() => setShowPw2(s => !s)}
                  aria-label={showPw2 ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPw2 ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>

              {/* Hint / trạng thái */}
              {!!pw1 && (
                <p className={`text-xs ${validatePassword(pw1) ? "text-emerald-600" : "text-red-600"}`}>
                  {validatePassword(pw1) ? "Mật khẩu hợp lệ" : "Mật khẩu tối thiểu 8 ký tự"}
                </p>
              )}
              {!!pw2 && pw1 !== pw2 && (
                <p className="text-xs text-red-600">Hai mật khẩu chưa khớp</p>
              )}
            </div>

            <Button onClick={changePassword} disabled={changing} className="inline-flex items-center gap-2">
              {changing ? <Loader2 className="animate-spin" size={16}/> : <ShieldCheck size={16}/>}
              {changing ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
            </Button>

            <p className="text-xs text-gray-500">
              Vì lý do bảo mật, bạn có thể sẽ buộc đăng nhập lại sau khi đổi mật khẩu.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-600"><LogOut size={16}/> Phiên đăng nhập</label>
            <div className="rounded-lg border p-3 bg-gray-50">
              <div className="text-sm mb-2 flex items-center gap-2">
                {sessLoading ? "Đang tải phiên..." : "Phiên hiện tại và các thiết bị đã đăng nhập:"}
              </div>
              <ul className="space-y-1 max-h-36 overflow-auto pr-1">
                {(sessions ?? []).map((s) => (
                  <li key={s.id} className="text-sm text-gray-700">
                    <span className={s.current ? "font-medium" : ""}>
                      {s.device || "Thiết bị"} – {s.ip || "?"} – {s.last_seen || ""}{s.current ? " (hiện tại)" : ""}
                    </span>
                  </li>
                ))}
                {!sessions?.length && !sessLoading && (
                  <li className="text-sm text-gray-500">Không có dữ liệu phiên (API tùy chọn).</li>
                )}
              </ul>
              <div className="pt-2">
                <Button variant="secondary" onClick={logoutOthers}>Đăng xuất tất cả phiên khác</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* HISTORY */}
      <Card className="p-6 border rounded-2xl shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold">Lịch sử hoạt động</div>
          <History size={18}/>
        </div>
        <div className="grid lg:grid-cols-3 gap-6 mt-4">
          <SectionList title="Món đã cho" rows={(history.given || []).slice(0, 6)} empty="Chưa có món đã cho" link={{ to: "/donors", label: "Xem tất cả" }} />
          <SectionList title="Món đã nhận" rows={(history.received || []).slice(0, 6)} empty="Chưa có món đã nhận" link={{ to: "/recipients", label: "Xem tất cả" }} />
          <SectionList title="Giao dịch (đã thu phí 2k)" rows={(history.payments || []).slice(0, 6).map((p) => ({
              id: p.id, name: `#${p.id?.slice?.(0,6)} • ${fmtVND(p.amount)} (${p.status || "success"})`, at: p.created_at,
          }))} empty="Chưa có giao dịch" link={{ to: "/reports", label: "Xem báo cáo" }} />
        </div>
      </Card>

      {/* PRIVACY */}
      <Card className="p-6 border rounded-2xl shadow-sm">
        <div className="text-xl font-semibold mb-1">Quyền riêng tư & Tài khoản</div>
        <p className="text-sm text-gray-600 mb-4">Bạn có thể tải dữ liệu hoặc xóa tài khoản của mình.</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={exportData} className="inline-flex items-center gap-2">
            <Download size={16}/> Tải dữ liệu của tôi
          </Button>
          <DangerButton onClick={() => document.getElementById("delete-dlg").showModal()}>
            <Trash2 size={16}/> Xóa tài khoản
          </DangerButton>
        </div>

        <dialog id="delete-dlg" className="rounded-2xl p-0">
          <div className="p-6 w-[min(92vw,480px)]">
            <div className="text-lg font-semibold mb-1">Xóa tài khoản</div>
            <p className="text-sm text-red-600 mb-3">Hành động này không thể hoàn tác. Dữ liệu của bạn sẽ bị xóa vĩnh viễn.</p>
            <p className="text-sm text-gray-600 mb-3">Gõ <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">XOA TAI KHOAN</span> để xác nhận.</p>
            <input className="input w-full mb-4" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="XOA TAI KHOAN" />
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => document.getElementById("delete-dlg").close()}>Hủy</Button>
              <DangerButton onClick={deleteAccount} disabled={deleting}>{deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}</DangerButton>
            </div>
          </div>
        </dialog>
      </Card>
    </div>
  );
}

/* Helpers */
function fmtVND(n) {
  try { return Number(n||0).toLocaleString("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}); }
  catch { return `${n} VND`; }
}

function SectionList({ title, rows, empty, link }) {
  return (
    <div className="rounded-xl border bg-white/70">
      <div className="px-4 py-3 border-b font-medium">{title}</div>
      <ul className="divide-y">
        {(rows && rows.length) ? rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <div className="font-medium">{r.name || r.title || r.item_title || "—"}</div>
            <div className="text-xs text-gray-500">{r.at || r.created_at || r.time || ""}</div>
          </li>
        )) : (
          <li className="px-4 py-6 text-sm text-gray-500">{empty}</li>
        )}
      </ul>
      {link && (
        <div className="px-4 py-2 text-sm">
          <Link className="inline-flex items-center gap-1 text-emerald-700 hover:underline" to={link.to}>
            {link.label} <ArrowRight size={14}/>
          </Link>
        </div>
      )}
    </div>
  );
}

function DangerButton({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-white
        ${disabled ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}
      type="button"
    >
      {children}
    </button>
  );
}
