# Latest node alpine image
FROM node:alpine

# Sets the working directory
WORKDIR /app

ENV NODE_ENV=production

# Installs apk dependencies
RUN apk add varnish

# Starts varnish
COPY ./default.vcl /etc/varnish/default.vcl

# Copy package.json first for caching
COPY ./package*.json ./

# Installs node dependencies
RUN npm ci --omit=dev

# Copies the rest of the API source code
COPY . .

# Adds script execution permissions
RUN chmod +x /app/entrypoint.sh

# Exposes API port
EXPOSE 8080

# Starts the application by executing the entrypoint script
CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
