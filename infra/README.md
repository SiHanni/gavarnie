# Dev Infra (Docker Compose)

이 프로젝트는 로컬 개발을 위한 데이터/스토리지/프록시 인프라를 Docker Compose로 구성합니다.  
아래의 서비스를 한 번에 띄워 **동영상/음원 스트리밍 토이 프로젝트(gavarnie)** 를 빠르게 개발·테스트할 수 있습니다.

## 구성 요약

| Service   | Image                | Purpose                               | Port (Host→Container)          | Default Credential |
| --------- | -------------------- | ------------------------------------- | ------------------------------ | ------------------ |
| **mysql** | `mysql:8.0`          | 관계형 DB (코어 메타데이터)           | `13306 → 3306`                 | `root / root`      |
| **mongo** | `mongo:6`            | 도큐먼트 DB (이벤트/로그/메타 등)     | `27018 → 27017`                | (없음)             |
| **redis** | `redis:7`            | 캐시 · 큐 · 세션/락 관리              | `16379 → 6379`                 | (없음)             |
| **minio** | `minio/minio:latest` | S3 호환 오브젝트 스토리지             | `19000 → 9000`, `19001 → 9001` | `minio / minio123` |
| **mc**    | `minio/mc:latest`    | MinIO 초기화 스크립트 실행(버킷/정책) | -                              | -                  |
| **nginx** | `nginx:1.25`         | (개발용) HLS/정적 파일 프록시         | `18080 → 80`                   | -                  |

> 로컬 네트워크에서 각 포트로 접속하면 컨테이너 내부의 기본 포트로 라우팅됩니다.

---

## 서비스별 상세

### 1) MySQL (`mysql:8.0`)

- **역할**: 관계형 데이터 저장소. 사용자/게시물/권한 등 **코어 도메인** 메타데이터를 정규화하여 보관.
- **환경변수**
  - `MYSQL_ROOT_PASSWORD=root` : root 계정 비밀번호
  - `MYSQL_DATABASE=gavarnie_core` : 최초 생성 DB 이름
- **포트 매핑**: `13306:3306` → 로컬에서 `127.0.0.1:13306` 으로 접속
- **초기 스크립트**: `./mysql/init.sql` 이 컨테이너 시작 시 자동 실행  
  (`/docker-entrypoint-initdb.d/init.sql` 로 마운트, read-only)
- **헬스체크**: `mysqladmin ping` 기반으로 기동 여부 확인
- **접속 예시**
  ```bash
  mysql -h 127.0.0.1 -P 13306 -u root -proot
  # DB 확인
  SHOW DATABASES;
  USE gavarnie_core;
  ```
- **유즈케이스**
  - 계정/권한/팔로우/좋아요 등 정합성 필요한 데이터
  - 트랜잭션 보장이 필요한 핵심 테이블

---

### 2) MongoDB (`mongo:6`)

- **역할**: 스키마가 유연한 도큐먼트 저장소. **이벤트 로그**, **메타정보**, **스키마가 빈번히 변하는 데이터**에 적합.
- **포트 매핑**: `27018:27017`
- **접속 예시**
  ```bash
  mongosh "mongodb://127.0.0.1:27018"
  show dbs
  ```

---

### 3) Redis (`redis:7`)

- **역할**: **캐시**, **세션**, **큐(대기열)**, **분산락/토큰 버킷** 등 고속 인메모리 처리.
- **포트 매핑**: `16379:6379`
- **접속 예시**
  ```bash
  redis-cli -h 127.0.0.1 -p 16379
  ping
  ```

---

### 4) MinIO (`minio/minio:latest`)

- **역할**: AWS S3 호환 **오브젝트 스토리지**. 동영상/썸네일/오디오 등의 **미디어 파일 업로드·배포**.
- **포트 매핑**
  - S3 API: `19000 → 9000`
  - 콘솔 UI: `19001 → 9001`
- **자격증명**
  - `MINIO_ROOT_USER=minio`
  - `MINIO_ROOT_PASSWORD=minio123`
- **실행 커맨드**: `server /data --console-address ":9001"`
- **데이터 볼륨**: `minio-data:/data` (Docker volume)
- **콘솔 접속**: http://127.0.0.1:19001 (로그인 후 버킷/정책 관리 가능)

---

### 5) MinIO Client – mc (`minio/mc:latest`)

- **역할**: MinIO 초기 세팅 자동화. **버킷 생성**, **정책 부여**, **폴더 프리셋** 등을 `setup.sh` 로 실행.
- **작동 방식**
  - `depends_on: [minio]` 로 MinIO 기동 이후 실행
  - `entrypoint: ["/bin/sh", "/config/setup.sh"]`
  - 로컬 `./minio/setup.sh` 를 컨테이너 `/config/setup.sh` 로 마운트
- **주의**: `setup.sh` 에서 **버킷 이름**, **정책(public/private)**, **프리사인 URL 설정** 등을 자유롭게 커스터마이즈하세요.
  - 예) `mc alias set`, `mc mb`, `mc policy set` 등

---

### 6) Nginx (`nginx:1.25`)

- **역할**: (개발용) **프록시/캐시 레이어**. HLS(M3U8/TS) 또는 정적 파일을 MinIO/S3에서 받아 **로컬 18080 포트**로 제공.
- **포트 매핑**: `18080:80`
- **설정 파일**: `./nginx/nginx.conf` 를 `/etc/nginx/nginx.conf` 로 마운트
- **유즈케이스**
  - 로컬 환경에서 **동영상 스트리밍(HTTP/HLS)** 응답 확인
  - CORS·헤더·캐시 규칙 등 프록시 레벨 실험

---

## 빠른 시작 (Quick Start)

```bash
# 1) 백그라운드 실행
docker compose up -d

# 2) 상태 확인
docker compose ps
docker compose logs -f mysql  # 초기화 진행 확인 시 유용

# 3) 접속 체크
mysql  -h 127.0.0.1 -P 13306 -u root -proot  -e "SHOW DATABASES;"
mongosh "mongodb://127.0.0.1:27018" --eval "db.runCommand({ping:1})"
redis-cli -h 127.0.0.1 -p 16379 ping
# MinIO 콘솔: http://127.0.0.1:19001  (minio / minio123)
# HLS 프록시: http://127.0.0.1:18080/...
```

종료/정리:

```bash
docker compose down              # 컨테이너만 종료
docker compose down -v           # 볼륨까지 삭제(데이터 초기화)
```

---

## 마운트/볼륨 구조

- `./mysql/init.sql` → `/docker-entrypoint-initdb.d/init.sql` (read-only)
- `./minio/setup.sh` → `/config/setup.sh` (mc 초기화 스크립트)
- `./nginx/nginx.conf` → `/etc/nginx/nginx.conf` (Nginx 프록시 설정)
- **Named Volume**
  - `minio-data:/data` (MinIO 오브젝트 저장소)

---

## 동작 흐름(부팅 시퀀스)

1. **mysql**: 컨테이너 시작 → **init.sql** 자동 실행 → DB/테이블/시드 생성(필요 시)
2. **minio**: 오브젝트 스토리지 기동 → **mc** 컨테이너가 `setup.sh` 실행
   - 버킷 생성, 정책(public/private) 적용, 폴더/프리픽스 구성
3. **mongo**, **redis**: 즉시 가용
4. **nginx**: `nginx.conf` 설정대로 **MinIO/S3를 백엔드로 프록시**하여 미디어 테스트

---

## 트러블슈팅

- **MySQL 접속 오류 (소켓/포트)**  
  로컬 클라이언트는 **TCP로** 접속하세요:

  ```bash
  mysql -h 127.0.0.1 -P 13306 -u root -proot
  ```

  `ERROR 2002 (HY000): Can't connect to local MySQL server through socket ...` 같은 소켓 오류는 `-h 127.0.0.1 -P 13306` 으로 우회됩니다.

- **MinIO 콘솔 접속 불가**

  1. 컨테이너 상태 확인: `docker compose ps`
  2. 로그 확인: `docker compose logs -f minio`
  3. 포트 충돌 확인: `lsof -iTCP:19000 -sTCP:LISTEN`

- **mc 초기화 실패**  
  `./minio/setup.sh` 스크립트 권한/내용을 점검하세요.  
  스크립트에서 사용하는 **엔드포인트/크리덴셜**이 `minio`와 일치해야 합니다.

---

## 보안/운영 주의사항

- 이 구성은 **개발용** 기본 크리덴셜과 공개 포트를 사용합니다. 운영 전환 시:
  - 비밀번호, access/secret 키, 정책을 **필수 변경**
  - 포트/네트워크 정책, 방화벽, TLS 종단 고려
  - Nginx 캐시·CORS·헤더·레이트 리밋 등 보강

---

## 확장 아이디어

- **Nginx** 에서 **HLS 변환 파이프라인**(FFmpeg/미디어 워커)과 연동
- **Presigned URL** 발급 API → MinIO에 안전하게 업로드/다운로드
- **Redis** 로 대기열/락/토큰버킷 → 미디어 업로드/처리 작업량 제어
- **Mongo** 로 조회 로그/이벤트 스트림 저장 → 추천/통계에 활용
