# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /repo
# Yarn v4 고정 (레포에 .yarn 없어도 동작)
RUN corepack enable && corepack prepare yarn@4.9.3 --activate

FROM base AS deps
WORKDIR /repo
COPY .yarnrc.yml ./
COPY package.json yarn.lock ./
COPY apps/worker/package.json apps/worker/
COPY apps/api/package.json apps/api/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
COPY web/package.json web/
RUN yarn install --immutable --inline-builds && yarn cache clean

# ---------- build ----------
FROM deps AS build
WORKDIR /repo
COPY . .

RUN yarn workspace @catarie/entities build \
 && yarn workspace @catarie/logging build \
 && (yarn workspace @catarie/migrations build || true) \
 && yarn workspace @catarie/worker build
    

FROM base AS proddeps
WORKDIR /repo
COPY .yarnrc.yml ./
COPY package.json yarn.lock ./
COPY apps/worker/package.json apps/worker/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
RUN yarn workspaces focus --all --production && yarn cache clean

FROM node:20-alpine AS runtime
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production
COPY --from=proddeps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
COPY --from=build /repo/libs/entities/dist ./libs/entities/dist
COPY --from=build /repo/libs/logging/dist ./libs/logging/dist
EXPOSE 3001
CMD ["node","apps/worker/dist/main.js"]
