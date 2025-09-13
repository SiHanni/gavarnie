import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly table = process.env.OTP_TABLE || 'otp_signups';
  private readonly verifyWindowSec = parseInt(
    process.env.OTP_VERIFY_WINDOW_SEC || '3600',
    10,
  );
  private readonly maxAttempts = parseInt(
    process.env.OTP_MAX_ATTEMPTS || '5',
    10,
  );
  private readonly doc: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  private sha256(s: string) {
    return crypto.createHash('sha256').update(s).digest('hex');
  }

  /**
   * 사용자가 입력한 코드 검증:
   * - 테이블에서 email 항목을 읽어 code_hash/ttl/attempts 확인
   * - 만료/시도초과/불일치 처리
   * - 일치 시 'verified' 상태로 전환(verified=true, verified_at, ttl=now+verifyWindowSec)
   * - 해시식은 Lambda와 완전히 동일(sha256(email:purpose:code)) 해야함
   */
  async verifyEmailCode(
    email: string,
    code: string,
    purpose = 'signup',
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const current = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { email },
      }),
    );

    const item: any = current.Item;
    if (!item) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (item.ttl && item.ttl < now && !item.verified) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (item.verified === true) {
      // 이미 검증됨: 바로 통과시켜도 무방
      return;
    }

    const attempts = Number(item.attempts || 0);
    if (attempts >= this.maxAttempts) {
      throw new ForbiddenException('Too many attempts');
    }

    const expected = item.code_hash;
    const given = this.sha256(
      `${email.toLowerCase()}:${(purpose || 'signup').trim()}:${code}`,
    );
    if (expected !== given) {
      // 실패 카운트 +1
      await this.doc.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { email },
          UpdateExpression: 'SET attempts = if_not_exists(attempts, :z) + :one',
          ExpressionAttributeValues: { ':z': 0, ':one': 1 },
        }),
      );
      throw new BadRequestException('Invalid or expired code');
    }

    // 성공 → verified 상태로 확정 (ttl을 '검증 유효 창구'로 재설정)
    await this.doc.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          email,
          verified: true,
          verified_at: now,
          purpose: purpose || 'signup',
          ttl: now + this.verifyWindowSec, // 이 기간 안에 signUp 허용
        },
      }),
    );
  }

  /**
   * 가입 직전에 '검증됨' 상태인지 확인
   */
  async requireVerified(email: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const cur = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { email },
      }),
    );
    const item: any = cur.Item;
    if (!item || !item.verified || (item.ttl && item.ttl < now)) {
      throw new BadRequestException('Email is not verified');
    }
  }

  /**
   * 가입 완료 후 검증표식을 소비(삭제) — 재사용 방지
   */
  async consumeVerification(email: string): Promise<void> {
    await this.doc.send(
      new DeleteCommand({
        TableName: this.table,
        Key: { email },
      }),
    );
  }
}
