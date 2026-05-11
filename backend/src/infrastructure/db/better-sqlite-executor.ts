import BetterSqlite3 from "better-sqlite3";
import type { SqliteExecutor, SqliteRunResult, SqliteStatementExecutor } from "./sqlite-executor";

function normalizeParams(params?: unknown[]): unknown[] {
  return params ?? [];
}

class BetterSqliteTransactionExecutor implements SqliteStatementExecutor {
  constructor(private readonly db: BetterSqlite3.Database) {}

  run(sql: string, params?: unknown[]): SqliteRunResult {
    const result = this.db.prepare(sql).run(...normalizeParams(params));
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  get<T>(sql: string, params?: unknown[]): T | null {
    const row = this.db.prepare(sql).get(...normalizeParams(params));
    return (row as T | undefined) ?? null;
  }

  all<T>(sql: string, params?: unknown[]): T[] {
    return this.db.prepare(sql).all(...normalizeParams(params)) as T[];
  }
}

export class BetterSqliteExecutor implements SqliteExecutor {
  private readonly db: BetterSqlite3.Database;

  constructor(filename: string) {
    this.db = new BetterSqlite3(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  run(sql: string, params?: unknown[]): SqliteRunResult {
    const result = this.db.prepare(sql).run(...normalizeParams(params));
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  get<T>(sql: string, params?: unknown[]): T | null {
    const row = this.db.prepare(sql).get(...normalizeParams(params));
    return (row as T | undefined) ?? null;
  }

  all<T>(sql: string, params?: unknown[]): T[] {
    return this.db.prepare(sql).all(...normalizeParams(params)) as T[];
  }

  transaction<T>(callback: (tx: SqliteStatementExecutor) => T): T {
    const executor = new BetterSqliteTransactionExecutor(this.db);
    const transaction = this.db.transaction(() => callback(executor));
    return transaction();
  }

  close(): void {
    this.db.close();
  }
}
