ALTER TABLE "agents" DROP CONSTRAINT "agents_owner_id_name_key";
ALTER TABLE "agents" ADD CONSTRAINT "agents_name_unique" UNIQUE("name");