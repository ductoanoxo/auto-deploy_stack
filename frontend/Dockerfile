#Stage 1 : Build
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json packet-lock.json* ./

RUN npm install

COPY .. /app/ 

RUN npm run build

#Stage 2 : Production Stage use Ngnix
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:80 || exit 1
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 


 


