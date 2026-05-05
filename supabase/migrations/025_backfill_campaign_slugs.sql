-- Generate slugs for all campaigns that don't have one yet.
-- Uses the campaign name, lowercased with non-alphanumeric runs replaced by hyphens.
UPDATE campaigns
SET slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';
