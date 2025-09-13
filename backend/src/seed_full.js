import { db, migrate } from "./lib/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

migrate();

function j(x){ return JSON.stringify(x); }

const now = new Date().toISOString();

// tags cơ bản
const baseTags = [
  ["chay","Đồ chay"],
  ["khong-lactose","Không lactose"],
  ["khong-gluten","Không gluten"],
  ["an-toan","An toàn kiểm định"]
];
for (const [slug,name] of baseTags) {
  db.prepare("INSERT OR IGNORE INTO tags(slug,name) VALUES (?,?)").run(slug,name);
}

// users mẫu
const adminId = crypto.randomUUID();
const donorId = crypto.randomUUID();
const recvId  = crypto.randomUUID();

const adminPass = await bcrypt.hash("admin123", 10);
const donorPass = await bcrypt.hash("donor123", 10);
const recvPass  = await bcrypt.hash("recv123", 10);

db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
  .run(adminId,"admin@bua.com",adminPass,"Admin","admin");
db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
  .run(donorId,"donor@bua.com",donorPass,"Chị Lan","donor");
db.prepare("INSERT OR IGNORE INTO users(id,email,password_hash,name,role) VALUES (?,?,?,?,?)")
  .run(recvId,"receiver@bua.com",recvPass,"Anh Minh","receiver");

// pickup point
const ppId = crypto.randomUUID();
db.prepare(`INSERT OR IGNORE INTO pickup_points(id,name,address,lat,lng,opening,status)
VALUES (?,?,?,?,?,?,?)`).run(
  ppId,"Nhà văn hoá phường 5","Q.5, TP.HCM",10.754,106.667,j({mon_fri:"08:00-18:00"}),"active"
);

// món mẫu (2 món)
const item1 = crypto.randomUUID();
const item2 = crypto.randomUUID();
db.prepare(`INSERT OR IGNORE INTO food_items
(id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
  item1, donorId, "Cơm chay thập cẩm", "Suất cơm chay, bảo quản mát", 20,"suất",
  new Date(Date.now()+36e5*12).toISOString(), "P.5, Q.5, TP.HCM",10.755,106.665,
  j(["chay","an-toan"]), j([]), "available","public"
);
db.prepare(`INSERT OR IGNORE INTO food_items
(id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
  item2, donorId, "Bánh mì không lactose", "Phù hợp người dị ứng sữa", 15,"ổ",
  new Date(Date.now()+36e5*24).toISOString(), "P.4, Q.10, TP.HCM",10.766,106.664,
  j(["khong-lactose"]), j([]), "available","public"
);

// metric ngày
db.prepare("INSERT OR IGNORE INTO metrics_daily(day,items,bookings,deliveries,rescued_meals,fee_revenue) VALUES (date('now'),0,0,0,0,0)").run();

console.log("Seeded: admin@bua.com/admin123 | donor@bua.com/donor123 | receiver@bua.com/recv123");
