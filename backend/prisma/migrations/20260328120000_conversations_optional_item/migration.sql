-- Direct-message threads: conversation not tied to a listing
ALTER TABLE "conversations" ALTER COLUMN "item_id" DROP NOT NULL;
