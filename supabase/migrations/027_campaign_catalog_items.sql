-- Junction table linking catalog items to specific campaigns.
-- If a campaign has zero rows here, the order form falls back to all active catalog items.
CREATE TABLE campaign_catalog_items (
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES shirt_catalog(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, catalog_item_id)
);
