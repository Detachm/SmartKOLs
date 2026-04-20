import type { PersonasRepository } from "../application/ports/personas-repository";
import type { Persona } from "../domain/persona";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";

export class SqlitePersonasRepository implements PersonasRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  private mapRow(row: {
    id: string;
    workspace_id: string;
    account_id: string;
    version: number;
    gender: string;
    nationality: string;
    age: number;
    interests: string;
    personality_traits: string;
    writing_style: string;
    bio: string;
    distillation_sample_tweets: string;
    source: Persona["source"];
    created_by_type: Persona["created_by_type"];
    created_by_id: string | null;
    created_at: string;
    updated_at: string;
  }): Persona {
    return {
      ...row,
      interests: JSON.parse(row.interests) as string[],
      personality_traits: JSON.parse(row.personality_traits) as string[],
      created_by_id: row.created_by_id ?? undefined,
    };
  }

  async findByAccountId(accountId: string): Promise<Persona | null> {
    const row = this.db.get<{
      id: string;
      workspace_id: string;
      account_id: string;
      version: number;
      gender: string;
      nationality: string;
      age: number;
      interests: string;
      personality_traits: string;
      writing_style: string;
      bio: string;
      distillation_sample_tweets: string;
      source: Persona["source"];
      created_by_type: Persona["created_by_type"];
      created_by_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        id, workspace_id, account_id, version, gender, nationality, age, interests,
        personality_traits, writing_style, bio, distillation_sample_tweets, source,
        created_by_type, created_by_id, created_at, updated_at
      FROM personas
      WHERE account_id = ?`,
      [accountId],
    );

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  async listByAccountIds(accountIds: string[]): Promise<Persona[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const placeholders = accountIds.map(() => "?").join(", ");
    return this.db.all<{
      id: string;
      workspace_id: string;
      account_id: string;
      version: number;
      gender: string;
      nationality: string;
      age: number;
      interests: string;
      personality_traits: string;
      writing_style: string;
      bio: string;
      distillation_sample_tweets: string;
      source: Persona["source"];
      created_by_type: Persona["created_by_type"];
      created_by_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
        id, workspace_id, account_id, version, gender, nationality, age, interests,
        personality_traits, writing_style, bio, distillation_sample_tweets, source,
        created_by_type, created_by_id, created_at, updated_at
      FROM personas
      WHERE account_id IN (${placeholders})`,
      accountIds,
    ).map((row) => this.mapRow(row));
  }

  async save(persona: Persona): Promise<void> {
    this.db.run(
      `INSERT INTO personas (
        id, workspace_id, account_id, version, gender, nationality, age, interests,
        personality_traits, writing_style, bio, distillation_sample_tweets, source,
        created_by_type, created_by_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        version = excluded.version,
        gender = excluded.gender,
        nationality = excluded.nationality,
        age = excluded.age,
        interests = excluded.interests,
        personality_traits = excluded.personality_traits,
        writing_style = excluded.writing_style,
        bio = excluded.bio,
        distillation_sample_tweets = excluded.distillation_sample_tweets,
        source = excluded.source,
        created_by_type = excluded.created_by_type,
        created_by_id = excluded.created_by_id,
        updated_at = excluded.updated_at`,
      [
        persona.id,
        persona.workspace_id,
        persona.account_id,
        persona.version,
        persona.gender,
        persona.nationality,
        persona.age,
        JSON.stringify(persona.interests),
        JSON.stringify(persona.personality_traits),
        persona.writing_style,
        persona.bio,
        persona.distillation_sample_tweets,
        persona.source,
        persona.created_by_type,
        persona.created_by_id ?? null,
        persona.created_at,
        persona.updated_at,
      ],
    );
  }
}
