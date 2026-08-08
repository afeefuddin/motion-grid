CREATE TABLE "campaign_conversation_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"run_id" uuid,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_conversation_message_role_valid" CHECK ("campaign_conversation_message"."role" in ('operator', 'motiongrid')),
	CONSTRAINT "campaign_conversation_message_status_valid" CHECK ("campaign_conversation_message"."status" in ('sent', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "campaign_conversation_message" ADD CONSTRAINT "campaign_conversation_message_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;