import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import {
  PlusCircle, Search, Loader2, Send, RefreshCcw,
  MessageSquare, CheckCircle2, Clock3, XCircle,
} from "lucide-react";

/* ============ UI PRIMITIVES ============ */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-300 bg-white shadow-[0_1px_0_#e5e7eb,0_8px_24px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>
);

const Badge = ({ status }) => {
  const map = {
    open:    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    closed:  "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    failed:  "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  const label = { open: "Mở", pending: "Đang xử lý", closed: "Đã đóng", failed: "Lỗi" }[status] || status;
  const Icon  = { open: CheckCircle2, pending: Clock3, closed: XCircle, failed: XCircle }[status] || CheckCircle2;
  const Ico   = Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200"}`}>
      <Ico className="h-3.5 w-3.5" /> {label}
    </span>
  );
};

const TextInput = (props) => (
  <input
    {...props}
    className={[
      "w-full rounded-xl border px-4 py-2.5 text-slate-900 placeholder-slate-400",
      "focus:outline-none focus:ring-2 focus:ring-emerald-300",
      props.className || "",
    ].join(" ")}
  />
);

/* ============ PAGE ============ */
export default function SupportChat() {
  const [tickets, setTickets] = useState(null);
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [active, setActive] = useState(null);
  const [comments, setComments] = useState(null);
  const [loadingCmt, setLoadingCmt] = useState(false);

  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  const msgEndRef = useRef(null);

  /* ------- load tickets ------- */
  async function loadTickets() {
    const r = await apiGet("/api/donor/support/tickets");
    setTickets(r || []);
  }
  useEffect(() => { loadTickets(); }, []);

  /* ------- open ticket ------- */
  async function openTicket(t) {
    setActive(t);
    setLoadingCmt(true);
    try {
      const c = await apiGet(`/api/donor/support/tickets/${t.id}/comments`);
      setComments(c || []);
    } finally {
      setLoadingCmt(false);
      // scroll to bottom once comments loaded
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "auto" }), 0);
    }
  }

  /* ------- create ticket ------- */
  async function newTicket(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const r = await apiPost("/api/donor/support/tickets", { title, description: desc });
      setTitle(""); setDesc("");
      await loadTickets();
      await openTicket(r);
    } finally {
      setCreating(false);
    }
  }

  /* ------- send comment ------- */
  async function send() {
    const body = msg.trim();
    if (!active || !body) return;

    // optimistic add
    const optimistic = {
      id: "tmp-" + Date.now(),
      body,
      created_at: new Date().toISOString(),
      mine: true,
    };
    setComments((cs) => [...(cs || []), optimistic]);
    setMsg("");
    setSending(true);
    try {
      const c = await apiPost(`/api/donor/support/tickets/${active.id}/comments`, { body });
      // replace optimistic with real
      setComments((cs) => (cs || []).map(x => x.id === optimistic.id ? c : x));
    } finally {
      setSending(false);
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    }
  }

  /* ------- helpers ------- */
  const filtered = useMemo(() => {
    if (!Array.isArray(tickets)) return [];
    const kw = q.trim().toLowerCase();
    if (!kw) return tickets;
    return tickets.filter(t =>
      (t.title || "").toLowerCase().includes(kw) ||
      (t.status || "").toLowerCase().includes(kw)
    );
  }, [tickets, q]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 grid lg:grid-cols-[minmax(320px,1fr)_minmax(420px,1.2fr)] gap-6">
      {/* Left: New ticket + list */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-slate-800" />
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Hỗ trợ</h1>
          <button
            onClick={loadTickets}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50"
            title="Làm mới"
          >
            <RefreshCcw className="h-4 w-4" /> Làm mới
          </button>
        </div>

        {/* Create ticket */}
        <Card>
          <form onSubmit={newTicket} className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-emerald-700" />
              <div className="font-semibold text-slate-900">Tạo ticket mới</div>
            </div>
            <TextInput
              placeholder="Tiêu đề (ví dụ: Không nạp được tiền MoMo)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              rows={3}
              placeholder="Mô tả chi tiết vấn đề…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <div className="text-right">
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-4 py-2.5 font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-60"
                disabled={creating}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Tạo ticket
              </button>
            </div>
          </form>
        </Card>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tiêu đề / trạng thái…"
            className="flex-1 outline-none"
          />
        </div>

        {/* Ticket list */}
        <div className="grid gap-2">
          {!tickets ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-1/4" />
              </Card>
            ))
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-slate-900 font-semibold">Chưa có ticket</div>
              <div className="text-sm text-slate-600">Hãy tạo một ticket ở phía trên.</div>
            </Card>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => openTicket(t)}
                className={[
                  "text-left p-4 rounded-2xl border bg-white hover:shadow-[0_1px_0_#e5e7eb,0_12px_28px_rgba(0,0,0,0.08)] transition-all",
                  active?.id === t.id ? "border-emerald-300 bg-emerald-50" : ""
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                  <Badge status={t.status} />
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {new Date(t.created_at).toLocaleString("vi-VN")}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Conversation */}
      <div className="space-y-2">
        <div className="text-lg font-semibold">Trao đổi</div>

        {!active ? (
          <Card className="p-10 text-center text-slate-600">
            Chọn một ticket ở danh sách bên trái để xem hội thoại.
          </Card>
        ) : (
          <Card className="p-0 h-[560px] flex flex-col">
            {/* Header ticket */}
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <div className="font-semibold text-slate-900 truncate">{active.title}</div>
              <Badge status={active.status} />
              <div className="ml-auto text-xs text-slate-500">
                Mở lúc {new Date(active.created_at).toLocaleString("vi-VN")}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {loadingCmt ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-2 rounded-lg border bg-white animate-pulse w-5/6">
                    <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-2/3" />
                  </div>
                ))
              ) : !comments || comments.length === 0 ? (
                <div className="text-center text-slate-500 text-sm mt-8">Chưa có tin nhắn.</div>
              ) : (
                comments.map((c) => {
                  const mine = c.mine || c.author === "me" || c.is_mine;
                  return (
                    <div key={c.id} className={`max-w-[80%] ${mine ? "ml-auto" : ""}`}>
                      <div className={`px-3 py-2 rounded-2xl border shadow-sm ${mine ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}>
                        <div className="whitespace-pre-wrap break-words">{c.body}</div>
                      </div>
                      <div className={`mt-0.5 text-[11px] ${mine ? "text-right text-emerald-800/80" : "text-slate-500"}`}>
                        {new Date(c.created_at).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>

            {/* Composer */}
            <div className="p-3 border-t">
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập tin nhắn… (Enter để gửi, Shift+Enter để xuống dòng)"
                  className="flex-1 rounded-2xl border px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <button
                  onClick={send}
                  disabled={sending || !msg.trim()}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 text-white px-4 py-2.5 font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Gửi
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
