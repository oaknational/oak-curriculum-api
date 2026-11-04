# Pinned by digest, not tag: a tag can be repointed by its publisher at any time.
# Dependabot keeps the digest and the comment in step.
FROM node:24.22.2@sha256:e7add2a490bb17d97b485b8641bd88455fff7839ade0f5eba493c3508124d413

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
