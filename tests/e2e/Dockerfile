FROM node:22-slim

RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

WORKDIR /plugin

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

ENV CLAUDE_CODE_FAKE=1
ENV HOME=/tmp/fakehome

CMD ["npx", "vitest", "run", "tests/e2e/"]
