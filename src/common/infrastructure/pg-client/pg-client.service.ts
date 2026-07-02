import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, types } from 'pg';
import { LoggerService } from '../logger';

// Always return numeric data type as number (default is string)
types.setTypeParser(1700, function (val) {
  return parseFloat(val);
});
types.setTypeParser(20, function (val) {
  return parseInt(val);
});

@Injectable()
export class PgClientService implements OnModuleInit, OnApplicationShutdown {
  readonly masterPool: Pool;
  readonly replicaPool: Pool;

  constructor(private readonly logger: LoggerService) {
    const masterConnectionString = `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'auth_service'}`;

    // For now, replica points to the same database. In production, use separate read replica
    const replicaConnectionString = masterConnectionString;

    this.masterPool = new Pool({
      connectionString: masterConnectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.replicaPool = new Pool({
      connectionString: replicaConnectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.masterPool.on('error', (err) => {
      this.logger.error(`Postgres Master Pool Error: ${err.message}`);
    });

    this.replicaPool.on('error', (err) => {
      this.logger.error(`Postgres Replica Pool Error: ${err.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.masterPool.query('SELECT 1');
      await this.replicaPool.query('SELECT 1');
      this.logger.info('PostgreSQL connection pools initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL pools', error.stack);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.masterPool.end();
      await this.replicaPool.end();
      this.logger.info('PostgreSQL connection pools closed successfully');
    } catch (err) {
      this.logger.error(`Could not shutdown PG Client gracefully: ${err.message}`);
      throw err;
    }
  }

  get master(): { query: (text: string, params?: unknown[]) => Promise<QueryResult> } {
    return {
      query: async (text: string, params?: unknown[]): Promise<QueryResult> => {
        return this.masterPool.query(text, params);
      },
    };
  }

  get replica(): { query: (text: string, params?: unknown[]) => Promise<QueryResult> } {
    return {
      query: async (text: string, params?: unknown[]): Promise<QueryResult> => {
        return this.replicaPool.query(text, params);
      },
    };
  }

  // Use for transactions - remember to release the client after!
  async getClient(): Promise<PoolClient> {
    return this.masterPool.connect();
  }
}
