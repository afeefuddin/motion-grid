CREATE TABLE "market_business" (
	"external_ref" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"geography" text NOT NULL,
	"locality" text NOT NULL,
	"category" text NOT NULL,
	"provenance" text NOT NULL,
	"artifact" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "market_business_geography_idx" ON "market_business" USING btree ("geography");
--> statement-breakpoint
CREATE INDEX "market_business_category_idx" ON "market_business" USING btree ("category");
