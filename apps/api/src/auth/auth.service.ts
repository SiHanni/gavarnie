import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async signUp(email: string, password: string, displayName: string) {
    const user = await this.users.create(email, password, displayName);
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
}
