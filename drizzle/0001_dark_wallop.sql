CREATE TABLE "loans_given" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"borrower_name" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"date_lent" date NOT NULL,
	"is_repaid" boolean DEFAULT false NOT NULL,
	"repaid_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_finances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"finances_enabled" boolean DEFAULT false NOT NULL,
	"wallet_balance" integer DEFAULT 0 NOT NULL,
	"bank_balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_finances_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "loans_given" ADD CONSTRAINT "loans_given_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_finances" ADD CONSTRAINT "user_finances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loans_user_repaid_idx" ON "loans_given" USING btree ("user_id","is_repaid");