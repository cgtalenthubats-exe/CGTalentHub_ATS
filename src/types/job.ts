export interface JobRequisition {
    jr_id: string; // "JR000014"
    jr_number: string; // "14"
    position_jr: string;
    bu: string;
    sub_bu: string | null;
    jr_type: string; // "Replacement", "New"
    request_date: string;
    closed_date: string | null;
    is_active: string; // "Inactive", "active", "Active"
    job_description: string | null;
    // Add other fields as discovered in check-db.js
}
