FROM node:18-slim

WORKDIR /app

# Install dependencies first (caching)
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

# Environment variables should be passed at runtime, but we expose port
EXPOSE 3000

CMD ["npm", "start"]
