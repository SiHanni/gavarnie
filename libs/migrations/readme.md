### Migration

- 런타임: yarn v4 (PnP) + tsx + TypeORM 0.3.x
- 스크립트 파일명 규칙: YYYYMMDDHHmmss-kebab-case.ts
- 클래스 export: export default class ... implements MigrationInterface
- 최초 실행 시 yarn install 필요
- 마이그레이션 명령어

```
yarn workspace @catarie/migrations migrate:run
```
