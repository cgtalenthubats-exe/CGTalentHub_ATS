-- Per-chart logo override. NULL = fall back to company_master.company_logo.
ALTER TABLE org_chart_uploads ADD COLUMN IF NOT EXISTS chart_logo text;
COMMENT ON COLUMN org_chart_uploads.chart_logo IS 'Per-chart logo override. NULL = fall back to company_master.company_logo';
