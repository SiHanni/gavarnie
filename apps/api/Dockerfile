# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS proddeps
WORKDIR /app
RUN apk add --no-cache ca-certificates && corepack enable && corepack prepare yarn@4.9.3 --activate
COPY .yarnrc.yml ./
COPY package.json yarn.lock ./
COPY apps/api/package.json apps/api/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
RUN yarn workspaces focus --production @catarie/api @catarie/entities @catarie/logging @catarie/migrations \
  && yarn cache clean

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ca-certificates

COPY --from=proddeps /app/node_modules ./node_modules

COPY apps/api/dist ./apps/api/dist
COPY libs/entities/dist ./libs/entities/dist
COPY libs/logging/dist ./libs/logging/dist

# ✅ 런타임에서 패키지 해석될 수 있도록 node_modules 아래에 워크스페이스 패키지 형태로도 복사
RUN mkdir -p node_modules/@catarie/entities node_modules/@catarie/logging
COPY libs/entities/package.json node_modules/@catarie/entities/package.json
COPY libs/entities/dist         node_modules/@catarie/entities/dist
COPY libs/logging/package.json  node_modules/@catarie/logging/package.json
COPY libs/logging/dist          node_modules/@catarie/logging/dist

# (필요 시) migrations 소스 유지
COPY libs/migrations/package.json ./libs/migrations/package.json
COPY libs/migrations/src ./libs/migrations/src

EXPOSE 3000
CMD ["node","apps/api/dist/main.js"]
