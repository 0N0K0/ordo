-- Counters of the rate limits (failed logins, password reset requests, current-password checks): kept in the database
-- so that a restart does not reset them and every process of the app shares them.
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "expire" TIMESTAMP(3),

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
