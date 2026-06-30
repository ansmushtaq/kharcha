ALTER TABLE "user_budget_config" ADD COLUMN "salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "exp_user_category_idx" ON "expenses" USING btree ("user_id","category_id");