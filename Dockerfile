FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# targets.toml is mounted at runtime via volume (see docker-compose.example.yml)
# so it stays out of the image and out of version control

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "src/index.js"]
