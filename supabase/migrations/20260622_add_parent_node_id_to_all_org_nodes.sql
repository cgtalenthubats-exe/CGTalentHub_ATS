-- Add parent_node_id column to all_org_nodes so drag-move stores FK by id
-- instead of relying solely on parent_name text matching (which breaks when
-- multiple nodes share the same name, e.g. "(Vacant)").
--
-- parent_name is kept for backward-compat and human readability.
-- New drag-move writes both columns; legacy rows have parent_node_id = NULL
-- and continue to work via the name-lookup fallback in fetchOrgChartFlatData.

ALTER TABLE all_org_nodes
ADD COLUMN IF NOT EXISTS parent_node_id text;
