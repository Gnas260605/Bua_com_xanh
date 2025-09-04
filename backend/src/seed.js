import { db, migrate } from "./lib/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function j(x){ return JSON.stringify(x); }

async function upsertUser(email, name, role, plainPassword) {
  // nếu đã có user theo email -> trả về id cũ
  const row = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (row?.id) return row.id;

  // chưa có -> tạo mới
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(plainPassword, 10);
  db.prepare(
    "INSERT INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)"
  ).run(id, email, hash, name, role);
  return id;
}

async function main() {
  migrate();

  // tags
  const baseTags = [
    ["chay","Đồ chay"],
    ["khong-lactose","Không lactose"],
    ["khong-gluten","Không gluten"],
    ["an-toan","An toàn kiểm định"],
  ];
  for (const [slug,name] of baseTags) {
    db.prepare("INSERT OR IGNORE INTO tags(slug,name) VALUES (?,?)").run(slug,name);
  }

  // users mẫu (lấy đúng id dù chạy nhiều lần)
  const adminId = await upsertUser("admin@bua.com", "Admin", "admin", "admin123");
  const donorId = await upsertUser("donor@bua.com", "Chị Lan", "donor", "donor123");
  const recvId  = await upsertUser("receiver@bua.com", "Anh Minh", "receiver", "recv123");

  // pickup point (id cố định để không trùng)
  const ppId = "pp-demo-001";
  db.prepare(
    `INSERT OR IGNORE INTO pickup_points(id,name,address,lat,lng,opening,status)
     VALUES (?,?,?,?,?,?,?)`
  ).run(ppId, "Nhà văn hoá phường 5", "Q.5, TP.HCM", 10.754, 106.667, j({mon_fri:"08:00-18:00"}), "active");

  // món mẫu (nếu đã có thì bỏ qua)
  const item1 = "item-demo-001";
  const item2 = "item-demo-002";

  db.prepare(
    `INSERT OR IGNORE INTO food_items
     (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    item1, donorId, "Cơm chay thập cẩm", "Suất cơm chay, bảo quản mát", 20, "suất",
    new Date(Date.now()+36e5*12).toISOString(), "P.5, Q.5, TP.HCM", 10.755, 106.665,
    j(["chay","an-toan"]), j([]), "available", "public"
  );

  db.prepare(
    `INSERT OR IGNORE INTO food_items
     (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    item2, donorId, "Bánh mì không lactose", "Phù hợp người dị ứng sữa", 15, "ổ",
    new Date(Date.now()+36e5*24).toISOString(), "P.4, Q.10, TP.HCM", 10.766, 106.664,
    j(["khong-lactose"]), j([]), "available", "public"
  );

  db.prepare(
    "INSERT OR IGNORE INTO metrics_daily(day,items,bookings,deliveries,rescued_meals,fee_revenue) VALUES (date('now'),0,0,0,0,0)"
  ).run();

  console.log("Seeded/Upserted OK: admin@bua.com/admin123 | donor@bua.com/donor123 | receiver@bua.com/recv123");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
