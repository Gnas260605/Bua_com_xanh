import { useForm } from "react-hook-form";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useApi } from "../../lib/api";

export default function CreateCampaignModal({ open, onClose, onCreated }) {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { title: "", location: "", goal: 0 } });
  const { apiFetch } = useApi();

  const onSubmit = async (v) => {
    const r = await apiFetch("/api/campaigns", { method: "POST", body: JSON.stringify({ ...v, goal: Number(v.goal) }) });
    if (!r.ok) return alert("Tạo thất bại");
    const data = await r.json();
    onCreated?.(data);
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo chiến dịch" footer={<>
      <Button variant="ghost" onClick={onClose}>Huỷ</Button>
      <Button onClick={handleSubmit(onSubmit)}>Tạo</Button>
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
      </div>
    </Modal>
  );
}
