# Pinned by digest, not tag: a tag can be repointed by its publisher at any time.
# Dependabot keeps the digest and the comment in step.
FROM node:26.13.1@sha256:e18c3ccdf7d71619990b0e85639f506e2028a95410999cab24cc373cbd10e0ac

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
