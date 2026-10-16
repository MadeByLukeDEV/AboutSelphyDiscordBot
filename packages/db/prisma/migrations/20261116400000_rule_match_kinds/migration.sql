-- A rule may match by kind alone (the Posting section makes such rules); the old check only counted words and tags.
ALTER TABLE "EventRule" DROP CONSTRAINT "EventRule_has_match";
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_has_match" CHECK (cardinality("words") + cardinality("categories") + cardinality("kinds") > 0 AND cardinality("words") <= 10 AND cardinality("categories") <= 10);
