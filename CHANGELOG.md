# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-02-11

### Added
- **Job Requisition (JR) Table:**
    - Added "Created By" filter with name mapping (User Email -> Real Name).
    - Added "Copy JR" feature to duplicate a requisition along with its candidates (resetting their status).
    - Added sorting functionality to the JR Table (default sort by JR ID descending).
    - Added Checkbox selection for multi-JR analysis in the dashboard.
- **Candidate Management:**
    - Implemented logic to handle >1000 candidates in charts using client-side aggregation and pagination.

### Changed
- **Job Requisition (JR) Table:**
    - Renamed "Status" column to "JR Type" (New/Replacement).
    - Updated "Pipeline Management" menu item to "Job Requisition Manage".
    - Improved dashboard charts to dynamically reflect selected/filtered JRs.
- **Data Fetching:**
    - Refactored `getAllCandidatesSummary` to fetch all candidates in chunks (1000 items/step) to bypass Supabase response limits and ensure accurate status reporting from `status_log`.

### Fixed
- **Candidate Status:** Fixed issue where candidate status was stuck at "Pool Candidate" by deriving the latest status from `status_log`.
- **Build Errors:** Resolved TypeScript errors in `requisitions.ts` and `page.tsx` that were blocking deployment.
