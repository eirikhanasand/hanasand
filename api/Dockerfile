# Node image with Alpine Linux
FROM node:20-alpine

# Installs Python
RUN apk add --no-cache python3 make g++

# Sets working directory
WORKDIR /api

# Copies package.json and package-lock.json
COPY package*.json ./

# Installs dependencies
RUN npm install

# Copies the rest of the API source code
COPY . .

# Exposes port 8080
EXPOSE 8080
