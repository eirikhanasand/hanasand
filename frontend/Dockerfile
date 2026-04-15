# Latest bun alpine image
FROM oven/bun:alpine

# Sets the working directory
WORKDIR /app

# Production env vars
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Installs services
RUN ["apk", "add", "varnish"]

# Starts varnish
COPY ./default.vcl /etc/varnish/default.vcl

# Copies entrypoint
COPY ./entrypoint.sh /app/entrypoint.sh

# Copies package.json and package-lock.json
COPY ./package.json ./bun.lock ./

# Installs dependencies
RUN bun install --frozen-lockfile

# Copies the rest of the UI source code
COPY . .

RUN bun run build

# Exposes port 3000
EXPOSE 3000

# Starts the application
CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
