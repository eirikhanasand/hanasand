# Node image with Alpine Linux
FROM node:20-alpine

# Sets the working directory
WORKDIR /app

# Installs apk dependencies
RUN apk add --no-cache python3 make g++ varnish postgresql-client jq py3-pip bash python3-dev gcc musl-dev coreutils

# Virtual environment for Python packages
RUN python3 -m venv /opt/venv

# Installs gsutil and crcmod
RUN /opt/venv/bin/pip install gsutil crcmod

# Sets environment variables to use gsutil globally
ENV PATH="/opt/venv/bin:$PATH"

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

# Compiles the API
RUN npm run build

# Adds script execution permissions
RUN chmod +x /app/entrypoint.sh

# Exposes API port
EXPOSE 8080

# Starts the application by executing the entrypoint script
CMD ["stdbuf", "-oL", "-eL", "/bin/bash", "-c", "[/app/entrypoint.sh"]
