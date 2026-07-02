import { Injectable } from '@nestjs/common';
import { PgClientService } from 'src/common';
import { User, UserRole, UserStatus } from './users.interface';

@Injectable()
export class UsersRepository {
  constructor(private readonly pgClient: PgClientService) {}

  async findById(id: string): Promise<User | null> {
    const query = `
      SELECT * FROM users
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.pgClient.replica.query(query, [id]);
    return result.rows[0] ? this.mapToUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT * FROM users
      WHERE email = $1 AND deleted_at IS NULL
    `;

    const result = await this.pgClient.replica.query(query, [email]);
    return result.rows[0] ? this.mapToUser(result.rows[0]) : null;
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    const query = `
      SELECT * FROM users
      WHERE google_sub = $1 AND deleted_at IS NULL
    `;

    const result = await this.pgClient.replica.query(query, [googleSub]);
    return result.rows[0] ? this.mapToUser(result.rows[0]) : null;
  }

  async create(data: {
    googleSub: string;
    email: string;
    name: string;
    role: UserRole;
  }): Promise<User> {
    const query = `
      INSERT INTO users (google_sub, email, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.googleSub,
      data.email,
      data.name,
      data.role,
    ]);

    return this.mapToUser(result.rows[0]);
  }

  async linkGoogleAccount(userId: string, googleSub: string): Promise<User> {
    const query = `
      UPDATE users
      SET google_sub = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [googleSub, userId]);
    return this.mapToUser(result.rows[0]);
  }

  async updateProfile(
    userId: string,
    data: {
      phone?: string;
      bankAccountNumber?: string;
      bankCode?: string;
      bankName?: string;
    },
  ): Promise<User> {
    const query = `
      UPDATE users
      SET
        phone = COALESCE($1, phone),
        bank_account_number = COALESCE($2, bank_account_number),
        bank_code = COALESCE($3, bank_code),
        bank_name = COALESCE($4, bank_name),
        updated_at = NOW()
      WHERE id = $5 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pgClient.master.query(query, [
      data.phone,
      data.bankAccountNumber,
      data.bankCode,
      data.bankName,
      userId,
    ]);

    return this.mapToUser(result.rows[0]);
  }

  private mapToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      googleSub: row.google_sub as string | undefined,
      email: row.email as string,
      name: row.name as string,
      phone: row.phone as string | undefined,
      role: row.role as UserRole,
      status: (row.status as UserStatus) || UserStatus.ACTIVE,
      bankAccountNumber: row.bank_account_number as string | undefined,
      bankCode: row.bank_code as string | undefined,
      bankName: row.bank_name as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : null,
    };
  }
}
