import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User, MediaCore } from '@catarie/entities';
import { UPLOAD_POLICY, kstDayRange, UserGrade } from './upload-policy';

@Injectable()
export class UploadPolicyGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MediaCore)
    private readonly mediaCoreRepo: Repository<MediaCore>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<any>();
    const meId = req?.user?.userId as string | undefined;
    if (!meId) throw new UnauthorizedException('Authentication required.');

    // 1) 내 등급 조회
    const me = await this.userRepo.findOne({
      where: { id: meId },
      select: ['id', 'userGrade'],
    });
    if (!me) throw new UnauthorizedException('User not found');
    const grade = (me.userGrade ?? 'basic') as UserGrade;
    const policy = UPLOAD_POLICY[grade];

    // 2) 하루 업로드 횟수 제한
    const { start, end } = kstDayRange(new Date());
    const todayCount = await this.mediaCoreRepo.count({
      where: { owner: { id: meId } as any, createdAt: Between(start, end) },
    });
    if (todayCount >= policy.maxPerDay) {
      throw new ForbiddenException(
        `일일 업로드 한도를 초과했습니다 (등급: ${grade}, 한도: ${policy.maxPerDay}개/일).`,
      );
    }

    // 3) 파일 용량 제한 — presign 요청 시 프론트가 x-file-size 헤더를 보냄
    //    (브라우저는 Content-Length를 임의 설정하기 어려우므로 x-file-size를 우선 사용)
    const rawSizeHeader =
      (req.headers['x-file-size'] as string | string[] | undefined) ??
      (req.headers['content-length'] as string | string[] | undefined);

    if (rawSizeHeader !== undefined) {
      const raw = Array.isArray(rawSizeHeader)
        ? rawSizeHeader[0]
        : rawSizeHeader;
      const intendedBytes = Number(raw);
      if (Number.isFinite(intendedBytes)) {
        const maxBytes = policy.maxFileMB * 1024 * 1024;
        if (intendedBytes > maxBytes) {
          throw new PayloadTooLargeException(
            `파일이 등급 한도(${policy.maxFileMB}MB)를 초과했습니다.`,
          );
        }
      }
      // 숫자 파싱 실패 시에는 complete 단계에서 실제 S3 HEAD로 최종 강제
    }

    // 통과 — 이후 컨트롤러/서비스에서 참조 가능하도록 주입
    req.uploadPolicy = { ...policy, grade };
    return true;
  }
}
