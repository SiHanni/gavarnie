import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@catarie/entities';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private users: UsersService,
    private jwt: JwtService,
    private otp: OtpService,
  ) {}

  async verifyCode(email: string, code: string, purpose = 'signup') {
    await this.otp.verifyEmailCode(email, code, purpose);
    return { ok: true };
  }

  async signUp(
    email: string,
    password: string,
    passwordConfirm: string,
    displayName: string,
  ) {
    if (password !== passwordConfirm) {
      throw new BadRequestException('Passwords do not match');
    }

    // 1) 최근 검증 여부 필수
    await this.otp.requireVerified(email);

    // 2) 실제 유저 생성
    const user = await this.users.create(email, password, displayName);

    // 3) 검증표식 소비(삭제) — 재사용 방지
    await this.otp.consumeVerification(email);

    // 4) 토큰 발급
    return this.issue(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.users.validate(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.issue(user.id, user.email);
  }

  private issue(sub: string, email: string) {
    const payload = { sub, email };
    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES || '1h',
    });
    return { accessToken };
  }

  async emailAvailable(email: string) {
    const u = await this.users.findByEmail?.(email);
    return { available: !u };
  }

  async updateUserPasswordForAdmin(
    email: string,
    password: string,
  ): Promise<void> {
    const user = await this.users.findByEmail?.(email);
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(password, 12);
    await this.userRepository.update({ email }, { passwordHash });
  }
}
