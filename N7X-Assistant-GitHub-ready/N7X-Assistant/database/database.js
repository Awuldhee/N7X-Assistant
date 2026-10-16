const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");
const directory = __dirname;
if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
const db = new Database(path.join(directory, "incentiv.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS balances (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_balances_leaderboard ON balances(guild_id, balance DESC, user_id ASC);
`);
const getBalanceStmt = db.prepare("SELECT balance FROM balances WHERE guild_id = ? AND user_id = ?");
const upsertStmt = db.prepare(`INSERT INTO balances (guild_id, user_id, balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(guild_id, user_id) DO UPDATE SET balance = excluded.balance, updated_at = CURRENT_TIMESTAMP`);
const getBalance = (guildId, userId) => getBalanceStmt.get(guildId, userId)?.balance ?? 0;
const setBalance = (guildId, userId, amount) => {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Balance must be a non-negative safe integer.");
  upsertStmt.run(guildId, userId, amount);
  return amount;
};
const changeBalance = db.transaction((guildId, userId, delta) => {
  const current = getBalance(guildId, userId);
  const next = current + delta;
  if (!Number.isSafeInteger(delta) || !Number.isSafeInteger(next)) throw new Error("Amount is too large.");
  if (next < 0) throw new Error("Insufficient balance.");
  setBalance(guildId, userId, next);
  return { previous: current, balance: next };
});
const leaderboard = (guildId, limit = 10) => db.prepare(`SELECT user_id, balance FROM balances WHERE guild_id = ? AND balance > 0 ORDER BY balance DESC, user_id ASC LIMIT ?`).all(guildId, limit);
const getRank = (guildId, userId) => {
  const balance = getBalance(guildId, userId);
  return db.prepare(`SELECT COUNT(*) + 1 AS rank FROM balances WHERE guild_id = ? AND (balance > ? OR (balance = ? AND user_id < ?))`).get(guildId, balance, balance, userId).rank;
};
const nearbyRanks = (guildId, userId, radius = 2) => {
  const rank = getRank(guildId, userId);
  const rows = db.prepare(`SELECT user_id, balance FROM balances WHERE guild_id = ? ORDER BY balance DESC, user_id ASC LIMIT ? OFFSET ?`).all(guildId, radius * 2 + 1, Math.max(0, rank - radius - 1));
  return { rank, rows };
};
module.exports = { db, getBalance, setBalance, changeBalance, leaderboard, getRank, nearbyRanks };
