import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt/jwt.strategy';
import { OtpService } from './otp.service';
@Module({
  imports: [UsersModule, JwtModule.register({})],
  providers: [AuthService, JwtStrategy, OtpService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
