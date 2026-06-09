import Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";

function resolveDbPath(): string {
  if (process.env.RECON_DB_PATH?.trim()) {
    return process.env.RECON_DB_PATH.trim();
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "recon.db");
  }
  return path.join(process.cwd(), "recon.db");
}

const db = new Database(resolveDbPath());

db.exec(`
  create table if not exists reports (
    id text primary key default (lower(hex(randomblob(16)))),
    created_at text default (datetime('now')),
    query text not null,
    query_type text not null,
    summary text,
    modules text not null,
    risk_score text,
    tags text
  );
  create index if not exists idx_created on reports(created_at desc);
`);

export default db;
