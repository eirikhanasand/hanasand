FROM node:24-alpine AS dependencies
WORKDIR /app
COPY bot/package.json bot/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY bot/tsconfig.json ./
COPY bot/src ./src
RUN npm run build

FROM node:24-alpine AS production-dependencies
WORKDIR /app
COPY bot/package.json bot/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000 SUPPORT_STATE_FILE=/data/support-state.json
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
