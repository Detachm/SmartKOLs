import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { UsersRepository } from "../application/ports/users-repository";
import type { User } from "../domain/user";

export class SqliteUsersRepository implements UsersRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findById(userId: string): Promise<User | null> {
    return this.db.get<User>(
      `SELECT id, email, name, status, created_at
      FROM users
      WHERE id = ?`,
      [userId],
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.get<User>(
      `SELECT id, email, name, status, created_at
      FROM users
      WHERE lower(email) = lower(?)`,
      [email],
    );
  }

  async create(user: User): Promise<void> {
    this.db.run(
      `INSERT INTO users (
        id, email, name, status, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [user.id, user.email, user.name, user.status, user.created_at],
    );
  }
}
