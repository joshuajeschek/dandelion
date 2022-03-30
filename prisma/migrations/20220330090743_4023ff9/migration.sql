-- CreateTable
CREATE TABLE "Guild" (
    "id" VARCHAR(64) NOT NULL,
    "prefix" VARCHAR(255) NOT NULL DEFAULT '!',
    "skiplimit" INTEGER NOT NULL DEFAULT 1,
    "stoplimit" INTEGER NOT NULL DEFAULT -1,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" VARCHAR(64) NOT NULL,
    "wantsNewsletter" BOOLEAN NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guild_id_key" ON "Guild"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");
