# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm install

# Copier le reste du code source
COPY . .

# Générer le client Prisma et builder le projet NestJS
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copier les fichiers nécessaires du stage précédent
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/secrets ./secrets

# Exposer le port configuré (3000 par défaut dans main.ts)
EXPOSE 3000

# Commande pour lancer l'application (NestJS compile dans dist/src/main.js)
CMD ["node", "dist/src/main.js"]
