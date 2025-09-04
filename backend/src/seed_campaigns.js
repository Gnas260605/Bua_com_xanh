import { db, migrate } from "./lib/db.js";
import crypto from "crypto";
migrate();

function j(x){return JSON.stringify(x);}
const now = new Date();

const id1 = crypto.randomUUID();
const id2 = crypto.randomUUID();

const isMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
const insertSql = isMySQL
  ? `INSERT IGNORE INTO campaigns
(id,title,location,goal,raised,supporters,tags,cover,status,created_at)
VALUES (?,?,?,?,?,?,?,?,?,?)`
  : `INSERT OR IGNORE INTO campaigns
(id,title,location,goal,raised,supporters,tags,cover,status,created_at)
VALUES (?,?,?,?,?,?,?,?,?,?)`;

db.prepare(insertSql).run(
  id1,"Bữa cơm trưa cho bệnh nhân nghèo","Q.5, TP.HCM",50000000,31800000,412,
  j(["#bệnh_viện","#cơm_trưa"]),
  "/images/campaigns/cover-1.jpg","active", now.toISOString()
);

db.prepare(insertSql).run(
  id2,"Giải cứu rau củ Đà Lạt – tuần 35","Đà Lạt → TP.HCM",30000000,19450000,276,
  j(["#rau_củ","#logistics"]),
  "/images/campaigns/cover-2.jpg","active", now.toISOString()
);

console.log("Seeded campaigns.");
