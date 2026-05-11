import fs from "fs";
import path from "path";
import { BetterSqliteExecutor } from "./better-sqlite-executor";
import { applySchema } from "./migrate";

export interface SqliteRuntime {
  db: BetterSqliteExecutor;
  dbPath: string;
}

export function createSqliteRuntime(dbPath: string): SqliteRuntime {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new BetterSqliteExecutor(dbPath);
  applySchema(db);
  return { db, dbPath };
}
