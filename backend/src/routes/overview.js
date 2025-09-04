import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) { ({ db } = await import("../lib/db.mysql.js")); }
else          { ({ db } = await import("../lib/db.js")); }

const router = Router();

router.get("/", async (_req, res) => {
  const qUsers = "SELECT COUNT(*) AS c FROM users";
  const qDonors = "SELECT COUNT(*) AS c FROM users WHERE role='donor'";
  const qRecipients = "SELECT COUNT(*) AS c FROM users WHERE role='receiver'";
  const qShippers = "SELECT COUNT(*) AS c FROM users WHERE role='shipper'";
  const qCampaigns = "SELECT COUNT(*) AS c FROM campaigns";

  const dbGet = useMySQL ? (sql, p=[]) => db.get(sql, p) : (sql, ...p) => db.prepare(sql).get(...p);

  const [a,b,c,d,e] = await Promise.all([
    dbGet(qUsers), dbGet(qDonors), dbGet(qRecipients), dbGet(qShippers), dbGet(qCampaigns)
  ]);
  res.json({
    users: a?.c||0, donors: b?.c||0, recipients: c?.c||0, shippers: d?.c||0, campaigns: e?.c||0
  });
});

export default router;
