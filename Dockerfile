# Node image with Alpine Linux
FROM node:20-alpine

# Sets the working directory
WORKDIR /app

# Installs services
RUN apk add --no-cache python3 make g++ varnish

# Starts varnish
COPY ./default.vcl /etc/varnish/default.vcl

# Copies entrypoint
COPY ./entrypoint.sh /app/entrypoint.sh

# Copies package.json and package-lock.json
COPY ./package*.json ./

# Installs dependencies
RUN npm install

# Copies the rest of the UI source code
COPY ./ .

RUN npm run build

# Exposes port 3000
EXPOSE 3000

# Starts the application
CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
