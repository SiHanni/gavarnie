import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AddUserGradeToUsers20250905010100
  implements MigrationInterface
{
  name = 'AddUserGradeToUsers20250905014555';

  public async up(q: QueryRunner): Promise<void> {
    // 1) 테이블 존재 확인 (안전)
    const hasUsers = await q.hasTable('users');
    if (!hasUsers) {
      throw new Error("Table 'users' does not exist.");
    }

    // 2) 이미 컬럼이 있으면 스킵
    const hasUserGrade = await q.hasColumn('users', 'user_grade');
    if (hasUserGrade) return;

    // 3) display_name 유무에 따라 AFTER 절 조건부 적용
    const hasDisplayName = await q.hasColumn('users', 'display_name');

    if (hasDisplayName) {
      await q.query(`
        ALTER TABLE \`users\`
          ADD COLUMN \`user_grade\`
          ENUM('basic','plus','premium')
          NOT NULL DEFAULT 'basic'
          AFTER \`display_name\`;
      `);
    } else {
      // display_name이 없다면 AFTER 없이 안전하게 추가
      await q.query(`
        ALTER TABLE \`users\`
          ADD COLUMN \`user_grade\`
          ENUM('basic','plus','premium')
          NOT NULL DEFAULT 'basic';
      `);
    }
    // 참고: 기존 행들은 DEFAULT 'basic'으로 채워집니다.
  }

  public async down(q: QueryRunner): Promise<void> {
    // 테이블이 없으면 조용히 종료
    const hasUsers = await q.hasTable('users');
    if (!hasUsers) return;

    // 컬럼이 있을 때만 드롭
    const hasUserGrade = await q.hasColumn('users', 'user_grade');
    if (hasUserGrade) {
      await q.query(`ALTER TABLE \`users\` DROP COLUMN \`user_grade\`;`);
    }
  }
}
