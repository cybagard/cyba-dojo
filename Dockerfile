FROM node:22-slim

WORKDIR /work

COPY package*.json ./
# NOTE: intentionally no `npm audit fix` - this dojo pins specific
# component versions on purpose (see docs/VULN_MAP.md).
RUN npm install

COPY . .

ENV WAIT_VERSION=2.12.1
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/$WAIT_VERSION/wait /wait
RUN chmod +x /wait

EXPOSE 3000
CMD ["npm", "start"]
