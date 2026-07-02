import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/common';
import { UsersRepository } from './users.repository';
import { User, UserRole } from './users.interface';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly logger: LoggerService,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.usersRepository.findByGoogleSub(googleSub);
  }

  async createFromGoogle(data: { googleSub: string; email: string; name: string }): Promise<User> {
    const user = await this.usersRepository.create({
      googleSub: data.googleSub,
      email: data.email,
      name: data.name,
      role: UserRole.USER,
    });

    this.logger.info('Created new user from Google login', {
      userId: user.id,
      email: user.email,
    });

    return user;
  }

  async linkGoogleAccount(userId: string, googleSub: string): Promise<User> {
    const user = await this.usersRepository.linkGoogleAccount(userId, googleSub);

    this.logger.info('Linked existing user with Google account', {
      userId: user.id,
      email: user.email,
    });

    return user;
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
    const user = await this.usersRepository.updateProfile(userId, data);

    this.logger.info('Updated user profile', {
      userId: user.id,
      fields: Object.keys(data).filter((key) => data[key as keyof typeof data] !== undefined),
    });

    return user;
  }
}
