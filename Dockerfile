# Latest node base image
FROM node:20-alpine

# Installs Python
RUN apk add --no-cache python3 make g++

# Container working directory
WORKDIR /app

# Copies package versions
COPY package*.json ./

# Installs dependencies
RUN npm install
RUN npm install express @types/express dotenv firebase-admin cors @types/cors redis

# Copies source code
COPY . .

# Builds the application
RUN npm run build

# Exposes port 3000
EXPOSE 3000
