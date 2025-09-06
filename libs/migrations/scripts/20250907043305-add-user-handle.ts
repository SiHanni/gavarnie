import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AddUsersHandleAndNullableStatusMessage20250907043305
  implements MigrationInterface
{
  name = 'AddUsersHandleAndNullableStatusMessage20250907043305';

  public async up(q: QueryRunner): Promise<void> {
    // 1) status_message 를 NULL 허용으로 변경 (엔티티 타입과 정합성)
    await q.query(`
      ALTER TABLE users
      MODIFY COLUMN status_message VARCHAR(100) NULL
    `);

    // 2) handle 컬럼 추가(초기 NULL) — 대소문자/악센트 비구분 고유성 위해 utf8mb4_0900_ai_ci 권장
    await q.query(`
      ALTER TABLE users
      ADD COLUMN handle VARCHAR(30)
      COLLATE utf8mb4_0900_ai_ci
      NULL
      AFTER email
    `);

    // 3) 기존 사용자에 대한 handle 백필
    type Row = {
      id: string;
      email: string;
      display_name?: string | null;
      handle?: string | null;
    };
    const rows: Row[] = await q.query(`
      SELECT id, email, display_name, handle
      FROM users
      ORDER BY CAST(id AS UNSIGNED) ASC
    `);

    const taken = new Set<string>();
    for (const r of rows) {
      if (r.handle) taken.add(r.handle.toLowerCase());
    }

    const reserved = new Set([
      'home',
      'about',
      'login',
      'logout',
      'signup',
      'signin',
      'me',
      'api',
      'admin',
      'catarie',
      'cdn',
      'static',
      'assets',
      'terms',
      'privacy',
      'help',
    ]);

    const normalize = (s: string) => {
      let v = (s || '').toLowerCase();
      v = v.replace(/[^a-z0-9._]/g, '');
      v = v.replace(/[._]{2,}/g, m => m[0]);
      v = v.replace(/^[._]+/, '').replace(/[._]+$/, '');
      if (v.length < 3) v = v.padEnd(3, 'x');
      if (v.length > 30) v = v.slice(0, 30);
      if (/^[0-9]+$/.test(v)) v = `u${v}`;
      return v;
    };

    const baseFrom = (r: Row) => {
      const dn = (r.display_name ?? '').trim();
      if (dn) return normalize(dn);
      const local = (r.email || '').split('@')[0] || `user${r.id}`;
      return normalize(local);
    };

    for (const r of rows) {
      if (r.handle) continue; // 이미 값이 있으면 패스
      let base = baseFrom(r);
      if (!base || reserved.has(base)) base = `user${r.id}`;

      let candidate = base;
      let suffix = 0;
      while (taken.has(candidate.toLowerCase()) || reserved.has(candidate)) {
        suffix += 1;
        const suf = String(suffix);
        const maxBase = Math.max(1, 30 - suf.length);
        candidate = `${base.slice(0, maxBase)}${suf}`;
      }
      taken.add(candidate.toLowerCase());

      await q.query(`UPDATE users SET handle = ? WHERE id = ?`, [
        candidate,
        r.id,
      ]);
    }

    // 4) NOT NULL + UNIQUE 제약 추가
    await q.query(`
      ALTER TABLE users
      MODIFY COLUMN handle VARCHAR(30)
      COLLATE utf8mb4_0900_ai_ci
      NOT NULL
    `);

    await q.query(`
      ALTER TABLE users
      ADD CONSTRAINT uq_users_handle UNIQUE (handle)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // UNIQUE 제거 → 컬럼 삭제
    await q.query(`
      ALTER TABLE users
      DROP INDEX uq_users_handle
    `);

    await q.query(`
      ALTER TABLE users
      DROP COLUMN handle
    `);

    // NULL 값은 빈 문자열로 채운 후 NOT NULL 원복
    await q.query(`
      UPDATE users SET status_message = '' WHERE status_message IS NULL
    `);

    await q.query(`
      ALTER TABLE users
      MODIFY COLUMN status_message VARCHAR(100) NOT NULL
    `);
  }
}
