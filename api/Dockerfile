# Latest node alpine image
FROM node:alpine

# Sets the working directory
WORKDIR /app

# Installs apk dependencies
RUN apk add varnish

# Starts varnish
COPY ./api/default.vcl /etc/varnish/default.vcl

# Copy package.json first for caching
COPY ./api/package*.json ./

# Installs node dependencies
RUN npm install

# Copies the rest of the API source code
COPY ./api .

# Copies the env variables
COPY ../.env ../.env

# Adds script execution permissions
RUN chmod +x /app/entrypoint.sh

# Exposes API port
EXPOSE 8080

# Starts the application by executing the entrypoint script
CMD ["stdbuf", "-oL", "-eL", "/bin/bash", "-c", "[/app/entrypoint.sh"]
