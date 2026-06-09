import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "recon.db"));

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
