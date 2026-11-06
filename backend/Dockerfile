FROM node:20-alpine

WORKDIR /app

# Install openssl required by Prisma engine on alpine
RUN apk add --no-cache openssl

# Copy dependency definitions and schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma Client
RUN npm install
RUN npx prisma generate

# Copy application source
COPY src ./src
COPY server.js ./

# Prepare upload and database storage directories
RUN mkdir -p uploads/assignments uploads/reports ../db

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "server.js"]
