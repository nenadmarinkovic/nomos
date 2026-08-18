-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" BIGSERIAL NOT NULL,
    "bucket" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitHit_bucket_at_idx" ON "RateLimitHit"("bucket", "at");

-- CreateIndex
CREATE INDEX "RateLimitHit_at_idx" ON "RateLimitHit"("at");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");
