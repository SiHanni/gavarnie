# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare yarn@1.22.19 --activate

FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock ./
COPY apps/worker/package.json apps/worker/
COPY apps/api/package.json apps/api/
COPY libs/entities/package.json libs/entities/
COPY libs/logging/package.json libs/logging/
COPY libs/migrations/package.json libs/migrations/
RUN yarn install --frozen-lockfile

FROM deps AS build
COPY . .
RUN yarn workspaces run build || true
# RUN yarn --cwd libs/entities build && yarn --cwd libs/logging build && yarn --cwd apps/worker build

FROM node:20-alpine AS runtime
# ffmpeg 필요 (Alpine)
RUN apk add --no-cache ffmpeg
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/libs/entities/dist ./libs/entities/dist
COPY --from=build /app/libs/logging/dist ./libs/logging/dist
EXPOSE 3001
CMD ["node","apps/worker/dist/main.js"]
