FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
ENV NODE_ENV=production DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /app
USER node
CMD ["node", "src/index.js"]
