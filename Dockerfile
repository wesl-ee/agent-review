FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3421
ENV AGENT_REVIEW_ROOT=/data/reviews

RUN npm run build

EXPOSE 3421

CMD ["npm", "run", "start"]
