import { useEffect } from "react";
import { useForm } from "react-hook-form";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useApi } from "../../lib/api";

export default function EditCampaignModal({ open, onClose, campaign, onUpdated }) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { title: "", location: "", goal: 0, status: "active" } });
  const { apiFetch } = useApi();

  useEffect(() => {
    if (campaign) reset({ title: campaign.title, location: campaign.location, goal: campaign.goal, status: campaign.status });
  }, [campaign]);

  const onSubmit = async (v) => {
    const r = await apiFetch(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify({ ...v, goal: Number(v.goal) }) });
    if (!r.ok) return alert("Cập nhật thất bại");
    const data = await r.json();
    onUpdated?.(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Chỉnh sửa chiến dịch" footer={<>
      <Button variant="ghost" onClick={onClose}>Huỷ</Button>
      <Button onClick={handleSubmit(onSubmit)}>Lưu</Button>
    </>}>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-600">Tiêu đề</label>
          <input className="input w-full" {...register("title", { required: true })} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Địa điểm</label>
          <input className="input w-full" {...register("location")} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Mục tiêu (VND)</label>
          <input className="input w-full" type="number" min={0} {...register("goal")} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Trạng thái</label>
          <select className="input w-full" {...register("status")}>
            <option value="active">Đang mở</option>
            <option value="closed">Đã đóng</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
