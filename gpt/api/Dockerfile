# Uses latest bun alpine image for apk package manager
FROM oven/bun:alpine

# Sets the working directory
WORKDIR /usr/src/app

# Copies package.json and bun.lock to the Docker environment
COPY package.json bun.lock ./

# Installs required dependencies
RUN bun install

# Copies contents
COPY . .
RUN bun run test
RUN bun run lint

# Stars the application
CMD bun start
