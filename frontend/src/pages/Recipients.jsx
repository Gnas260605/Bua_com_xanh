import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import EmptyState from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

export default function Recipients() {
  const [list, setList] = useState(null);

  useEffect(() => {
    apiGet("/api/users?role=receiver")
      .then(setList)
      .catch(() => setList([]));
  }, []);

  if (!list)
    return (
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );

  if (list.length === 0)
    return <EmptyState title="Chưa có người nhận" />;

  return (
    <div className="grid gap-3">
      {list.map((u) => (
        <div
          key={u.id}
          className="card p-4 flex justify-between items-center"
        >
          <div>
            <div className="font-medium">{u.name || u.email}</div>
            <div className="text-sm text-slate-500">{u.email}</div>
          </div>
          <div className="text-xs text-slate-500">{u.status}</div>
        </div>
      ))}
    </div>
  );
}
