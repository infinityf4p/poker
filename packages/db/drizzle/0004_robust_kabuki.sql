ALTER TABLE "user_accounts" ALTER COLUMN "must_change_password" SET DEFAULT false;
UPDATE "user_accounts" SET "must_change_password" = false WHERE "must_change_password" = true;
