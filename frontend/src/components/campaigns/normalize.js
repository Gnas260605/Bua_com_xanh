// Chuẩn hóa dữ liệu chiến dịch từ mọi endpoint về 1 shape thống nhất
export function normalizeCampaign(c) {
  // field dự phòng
  const type = (c.type || c.kind || "meal").toLowerCase(); // meal|money
  const cover = c.cover_url || c.banner || c.image || "";
  const goalMoney = Number(c.goal_amount || c.target_amount || c.goal || 0);
  const raisedMoney = Number(c.raised_amount || c.collected || 0);

  const goalMeals = Number(c.goal_meals || c.target_meals || c.total_quota || c.total_meal || 0);
  const gotMeals = Number(c.received_meals || c.claimed_meals || c.received || c.progress_meal || 0);

  const supporters = Number(c.supporters || c.backers || 0);
  const deadline = c.deadline || c.end_date || null;

  // percent
  const pct = type === "money"
    ? (goalMoney ? (raisedMoney / goalMoney) * 100 : 0)
    : (goalMeals ? (gotMeals / goalMeals) * 100 : 0);

  return {
    id: c.id,
    title: c.title || c.name || "Chiến dịch",
    summary: c.summary || c.subtitle || c.description || "",
    cover,
    type,                // 'meal' | 'money'
    goalMoney, raisedMoney,
    goalMeals, gotMeals,
    supporters,
    deadline,            // ISO string | null
    percent: Math.max(0, Math.min(100, pct)),
  };
}

export const money = (v) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    .format(Math.round(Number(v || 0)));

export function daysLeft(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
  return isFinite(d) ? Math.max(0, d) : null;
}
