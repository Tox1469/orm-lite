export interface DB {
  exec(sql: string): void;
  prepare(sql: string): { run(...p: any[]): { lastInsertRowid?: number }; all(...p: any[]): any[]; get(...p: any[]): any };
}

export interface ModelSchema {
  table: string;
  columns: Record<string, "TEXT" | "INTEGER" | "REAL" | "BLOB">;
  primaryKey?: string;
}

export class Model<T extends Record<string, any>> {
  constructor(private db: DB, private schema: ModelSchema) {}

  migrate(): void {
    const pk = this.schema.primaryKey ?? "id";
    const cols = Object.entries(this.schema.columns)
      .map(([k, t]) => (k === pk ? `${k} ${t} PRIMARY KEY` : `${k} ${t}`))
      .join(", ");
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${this.schema.table} (${cols})`);
  }

  create(data: Partial<T>): T {
    const keys = Object.keys(data);
    const ph = keys.map(() => "?").join(", ");
    const stmt = this.db.prepare(
      `INSERT INTO ${this.schema.table} (${keys.join(", ")}) VALUES (${ph})`
    );
    const info = stmt.run(...keys.map((k) => (data as any)[k]));
    const pk = this.schema.primaryKey ?? "id";
    if (info.lastInsertRowid != null && (data as any)[pk] == null) {
      (data as any)[pk] = info.lastInsertRowid;
    }
    return data as T;
  }

  findAll(): T[] {
    return this.db.prepare(`SELECT * FROM ${this.schema.table}`).all() as T[];
  }

  findBy(col: keyof T, val: any): T | undefined {
    return this.db
      .prepare(`SELECT * FROM ${this.schema.table} WHERE ${String(col)} = ? LIMIT 1`)
      .get(val) as T | undefined;
  }

  where(col: keyof T, val: any): T[] {
    return this.db
      .prepare(`SELECT * FROM ${this.schema.table} WHERE ${String(col)} = ?`)
      .all(val) as T[];
  }

  update(id: any, data: Partial<T>): number {
    const pk = this.schema.primaryKey ?? "id";
    const keys = Object.keys(data);
    const set = keys.map((k) => `${k} = ?`).join(", ");
    const stmt = this.db.prepare(`UPDATE ${this.schema.table} SET ${set} WHERE ${pk} = ?`);
    const res = stmt.run(...keys.map((k) => (data as any)[k]), id) as any;
    return res.changes ?? 0;
  }

  delete(id: any): number {
    const pk = this.schema.primaryKey ?? "id";
    const res = this.db.prepare(`DELETE FROM ${this.schema.table} WHERE ${pk} = ?`).run(id) as any;
    return res.changes ?? 0;
  }
}

export function defineModel<T extends Record<string, any>>(db: DB, schema: ModelSchema): Model<T> {
  return new Model<T>(db, schema);
}
