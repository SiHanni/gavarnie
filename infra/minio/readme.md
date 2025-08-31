\*\* 로컬 테스트시 MinIO Client(mc)로 확인

#### 1) 서버/인증 확인

```
mc admin info local
```

#### 2) 버킷 확인 (있으면 0, 없으면 오류 코드)

```
mc ls local
```

#### 3) 버킷 상세 상태 확인

```
mc stat local/media
```
