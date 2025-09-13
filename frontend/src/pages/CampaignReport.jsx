import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { Skeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";

export default function CampaignReport() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [donations, setDonations] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const rep = await apiGet(`/api/campaigns/${id}/reports`);
        const dons = await apiGet(`/api/campaigns/${id}/donations`);
        setReport(rep);
        setDonations(dons?.donations || []);
      } catch (err) {
        setReport({ ok: false });
        setDonations([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!report?.ok) {
    return <EmptyState title="Không tìm thấy dữ liệu chiến dịch" />;
  }

  const { campaign, donationsByMonth } = report;
  const max = Math.max(...(donationsByMonth?.map(d => d.total) || [1]), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{campaign.title}</h1>
        <Link
          to="/campaigns"
          className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
        >
          ← Quay lại
        </Link>
      </div>
      <p className="text-slate-600">{campaign.description}</p>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Đã quyên góp</div>
          <div className="text-lg font-bold text-emerald-600">
            {campaign.raised_amount?.toLocaleString()} đ
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Mục tiêu</div>
          <div className="text-lg font-bold">
            {campaign.goal?.toLocaleString()} đ
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Người ủng hộ</div>
          <div className="text-lg font-bold">{campaign.supporters || 0}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Trạng thái</div>
          <div className="text-lg font-bold capitalize">{campaign.status}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
        <h3 className="font-semibold mb-3">Thống kê theo tháng</h3>
        {(!donationsByMonth || donationsByMonth.length === 0) ? (
          <EmptyState title="Chưa có dữ liệu quyên góp" />
        ) : (
          <div className="flex items-end gap-4 h-48">
            {donationsByMonth.map(d => (
              <div key={d.month} className="flex-1 text-center">
                <div
                  className="mx-auto w-8 bg-emerald-400 rounded-t-xl transition-all duration-500"
                  style={{ height: `${(d.total / max) * 100}%` }}
                />
                <div className="mt-2 text-xs text-slate-500">{d.month}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Donations Table */}
      <div className="card p-6 overflow-x-auto">
        <h3 className="font-semibold mb-4">Sao kê quyên góp</h3>
        {donations.length === 0 ? (
          <EmptyState title="Chưa có giao dịch nào" />
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b bg-slate-50">
                <th className="p-2">Ngày</th>
                <th className="p-2">Người ủng hộ</th>
                <th className="p-2 text-right">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {donations.map(d => (
                <tr
                  key={d.id}
                  className="border-b hover:bg-slate-50 transition"
                >
                  <td className="p-2">
                    {new Date(d.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="p-2">{d.donor_name || "Ẩn danh"}</td>
                  <td className="p-2 text-right font-semibold text-emerald-600">
                    {d.amount.toLocaleString()} đ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
