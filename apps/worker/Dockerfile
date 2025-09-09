# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS proddeps
WORKDIR /app
RUN apk add --no-cache ca-certificates && corepack enable && corepack prepare yarn@4.9.3 --activate
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
COPY --from=proddeps /app/node_modules ./node_modules
COPY apps/worker/dist ./apps/worker/dist
COPY libs/entities/dist ./libs/entities/dist
COPY libs/logging/dist ./libs/logging/dist
EXPOSE 3001
CMD ["node","apps/worker/dist/main.js"]
