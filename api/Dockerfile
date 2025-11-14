# Stage 1: Build stage
FROM grafana/k6:latest AS k6builder

# Stage 2: Final image
FROM node:alpine

# Install dependencies
RUN apk add --no-cache varnish git openssh-client

# Copy k6 binary from the build stage
COPY --from=k6builder /usr/bin/k6 /usr/bin/k6

# Set the working directory
WORKDIR /app

# Set the node environment to production
ENV NODE_ENV=production

# Copies varnish
COPY ./default.vcl /etc/varnish/default.vcl

# Copy package.json first for caching
COPY ./package*.json ./

# Installs node dependencies
RUN npm ci --omit=dev

# Copy the rest of the API source code
COPY . .

# Adds script execution permissions
RUN chmod +x /app/entrypoint.sh

# Expose API port
EXPOSE 8080

# Start the application
CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
