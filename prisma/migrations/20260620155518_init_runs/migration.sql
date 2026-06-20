-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seed" INTEGER NOT NULL,
    "turn" INTEGER NOT NULL,
    "alive" INTEGER NOT NULL,
    "gini" REAL NOT NULL,
    "totalWealth" REAL NOT NULL,
    "config" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "chronicle" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Run_createdAt_idx" ON "Run"("createdAt");
