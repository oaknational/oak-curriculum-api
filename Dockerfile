# Pinned by digest, not tag: a tag can be repointed by its publisher at any time.
# Dependabot keeps the digest and the comment in step.
FROM node:25@sha256:78839ac448c23517f8eab2e8f7943d9b4f73979eb7f8bed2c73dbf72ff869e7b

# enable Corepack & activate pnpm
RUN corepack enable \
 && corepack prepare pnpm@10 --activate

WORKDIR /app

# copy manifest & install deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml schema.prisma ./
RUN pnpm install --frozen-lockfile

# copy the rest of your code
COPY . .

# run bulk and then list the out/ directory
CMD ["sh", "-c", "pnpm bulk && ls -la out"]
