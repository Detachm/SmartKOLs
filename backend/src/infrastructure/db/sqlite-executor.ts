export interface SqliteRunResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

export interface SqliteStatementExecutor {
  run(sql: string, params?: unknown[]): SqliteRunResult;
  get<T>(sql: string, params?: unknown[]): T | null;
  all<T>(sql: string, params?: unknown[]): T[];
}

export interface SqliteExecutor extends SqliteStatementExecutor {
  transaction<T>(callback: (tx: SqliteStatementExecutor) => T): T;
}
