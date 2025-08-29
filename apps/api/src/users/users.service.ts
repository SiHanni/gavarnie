import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@gavarnie/entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async create(email: string, password: string, displayName: string) {
    const exists = await this.userRepository.findOne({ where: { email } });
    if (exists) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.userRepository.create({
      email,
      passwordHash,
      displayName: displayName?.trim(),
    });
    return this.userRepository.save(user);
  }

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async validate(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }
}
