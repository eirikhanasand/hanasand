FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src
COPY .actor ./.actor

CMD ["bun", "run", "src/main.ts"]
