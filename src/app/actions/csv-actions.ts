"use server";

import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';
import { getN8nUrl } from "./admin-actions";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Service role for writing
const supabase = createClient(supabaseUrl, supabaseKey);

interface CsvRow {
    Name?: string;
    LinkedIn?: string;
    Email?: string;
    [key: string]: any;
}

interface UploadLog {
    id?: number;
    batch_id: string;
    candidate_id: string;
    name: string;
    linkedin: string;
    status: string;
    note: string;
    uploader_email: string;
    created_at?: string;
}

// Helper to normalize strings (trim, lower case for comparison)
function normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, ' '); // Standardize spaces
}

function normalizeLinkedIn(url: string): string {
    if (!url) return "";
    try {
        const urlObj = new URL(url.trim());
        urlObj.search = "";
        return urlObj.toString();
    } catch (e) {
        return url.trim();
    }
}

function normalizeEmail(email: string): string {
    return email ? email.trim().toLowerCase() : "";
}

export async function processCsvUpload(rows: CsvRow[], uploaderEmail: string) {
    const batchId = uuidv4();
    const logs: UploadLog[] = [];

    // 1. Validation & Pre-processing (Identify who needs an ID)
    const validRowsToProcess: { name: string, linkedin: string, email: string, rowIdx: number }[] = [];

    // Extract Names, LinkedIns, and Emails for targeted DB Query
    const allNames = rows.map(r => {
        const val = r['Name'] || r['name'] || Object.keys(r).find(k => k.trim().toLowerCase() === 'name') ? r[Object.keys(r).find(k => k.trim().toLowerCase() === 'name')!] : '';
        return normalizeName(val || "");
    }).filter(n => n.length > 0);

    const allLinkedIns = rows.map(r => {
        const val = r['LinkedIn'] || r['linkedin'] || Object.keys(r).find(k => k.trim().toLowerCase().includes('linkedin')) ? r[Object.keys(r).find(k => k.trim().toLowerCase().includes('linkedin'))!] : '';
        return normalizeLinkedIn(val || "");
    }).filter(l => l.length > 0 && l.toLowerCase().includes("linkedin"));

    const allEmails = rows.map(r => {
        const val = r['Email'] || r['email'] || Object.keys(r).find(k => k.trim().toLowerCase() === 'email') ? r[Object.keys(r).find(k => k.trim().toLowerCase() === 'email')!] : '';
        return normalizeEmail(val || "");
    }).filter(e => e.length > 0);

    // Fetch ONLY relevant existing candidates
    let existingCandidates: any[] = [];
    if (allNames.length > 0 || allLinkedIns.length > 0 || allEmails.length > 0) {
        // Query by Name
        if (allNames.length > 0) {
            const { data: nameMatches } = await supabase
                .from('Candidate Profile' as any)
                .select('candidate_id, name, linkedin, email')
                .in('name', allNames);
            if (nameMatches) existingCandidates.push(...nameMatches);
        }

        // Query by LinkedIn
        if (allLinkedIns.length > 0) {
            const { data: linkedinMatches } = await supabase
                .from('Candidate Profile' as any)
                .select('candidate_id, name, linkedin, email')
                .in('linkedin', allLinkedIns);
            if (linkedinMatches) existingCandidates.push(...linkedinMatches);
        }

        // Query by Email
        if (allEmails.length > 0) {
            const { data: emailMatches } = await supabase
                .from('Candidate Profile' as any)
                .select('candidate_id, name, linkedin, email')
                .in('email', allEmails);
            if (emailMatches) existingCandidates.push(...emailMatches);
        }

        // Dedup results based on ID and Sort by ID ASC to prioritize oldest candidate
        existingCandidates = Array.from(new Map(existingCandidates.map(c => [c.candidate_id, c])).values());
        existingCandidates.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
    }

    // Process each row to determine status
    for (const [index, row] of rows.entries()) {
        const rawName = row['Name'] || row['name'] || Object.keys(row).find(k => k.trim().toLowerCase() === 'name') ? row[Object.keys(row).find(k => k.trim().toLowerCase() === 'name')!] : '';
        const rawLinkedIn = row['LinkedIn'] || row['linkedin'] || row['LinkedIn '] || Object.keys(row).find(k => k.trim().toLowerCase().includes('linkedin')) ? row[Object.keys(row).find(k => k.trim().toLowerCase().includes('linkedin'))!] : '';
        const rawEmail = row['Email'] || row['email'] || Object.keys(row).find(k => k.trim().toLowerCase() === 'email') ? row[Object.keys(row).find(k => k.trim().toLowerCase() === 'email')!] : '';

        if (!rawName) continue; // Skip empty rows

        const name = normalizeName(rawName);
        const linkedin = normalizeLinkedIn(rawLinkedIn);
        const email = normalizeEmail(rawEmail);

        let status = "Processing";
        let note = "";
        let candidateId = "";

        if (!linkedin.toLowerCase().includes("linkedin")) {
            status = "Found Non LinkedIn URLs";
            note = "Invalid LinkedIn URL";
            logs.push({ batch_id: batchId, candidate_id: "", name, linkedin, status, note, uploader_email: uploaderEmail });
            continue;
        }

        // Duplicate Check (DB)
        const duplicate = existingCandidates?.find((c: any) => {
            const nameMatch = normalizeName(c.name || "").toLowerCase() === name.toLowerCase();
            const linkedinMatch = c.linkedin && normalizeLinkedIn(c.linkedin).toLowerCase() === linkedin.toLowerCase();
            const emailMatch = c.email && normalizeEmail(c.email) === email && email !== "";

            return nameMatch || linkedinMatch || emailMatch;
        });

        if (duplicate) {
            status = "Duplicate found";
            note = `Found duplicate with ${duplicate.candidate_id}`;
            candidateId = duplicate.candidate_id;
            logs.push({ batch_id: batchId, candidate_id: candidateId, name, linkedin, status, note, uploader_email: uploaderEmail });
            continue;
        }

        // Duplicate Check (In-Batch)
        const inBatchDuplicate = validRowsToProcess.find(r =>
            r.name.toLowerCase() === name.toLowerCase() ||
            (r.linkedin && r.linkedin.toLowerCase() === linkedin.toLowerCase()) ||
            (r.email && r.email === email && email !== "")
        );

        if (inBatchDuplicate) {
            status = "Duplicate found";
            note = "Found duplicate in batch";
            logs.push({ batch_id: batchId, candidate_id: "", name, linkedin, status, note, uploader_email: uploaderEmail });
            continue;
        }

        // Duplicate Check (Active Uploads)
        const { data: activeLogs } = await supabase
            .from('csv_upload_logs')
            .select('name, linkedin') // Note: logs might not have email, using Name/LinkedIn primarily
            .in('status', ['Scraping', 'Processing', 'PENDING']);

        const isProcessing = activeLogs?.some((log: any) =>
            (log.name && normalizeName(log.name).toLowerCase() === name.toLowerCase()) ||
            (log.linkedin && normalizeLinkedIn(log.linkedin).toLowerCase() === linkedin.toLowerCase())
        );

        if (isProcessing) {
            status = "Duplicate found";
            note = "Already in processing queue (Scraping)";
            logs.push({ batch_id: batchId, candidate_id: "", name, linkedin, status, note, uploader_email: uploaderEmail });
            continue;
        }

        // If valid and new, add to processing list
        validRowsToProcess.push({ name, linkedin, email, rowIdx: index });
    }

    // 2. Reserve IDs Atomically (Concurrency Safe)
    const newCandidatesForInsert: any[] = [];

    if (validRowsToProcess.length > 0) {
        // Call RPC to reserve a block of IDs
        const { data: idRange, error: rpcError } = await supabase
            .rpc('reserve_candidate_ids', { batch_size: validRowsToProcess.length });

        if (rpcError || !idRange || idRange.length === 0) {
            console.error("ID Reservation Failed:", rpcError);
            return { success: false, error: "Failed to generate candidate IDs. Please ensuring SQL sequence setup is correct." };
        }

        const startId = idRange[0].start_id; // e.g. 6701

        // 3. Assign IDs and Prepare Insert Payload
        validRowsToProcess.forEach((item, idx) => {
            const numericId = startId + idx;
            const candidateId = `C${numericId.toString().padStart(5, '0')}`;

            // Add to DB Insert payload
            newCandidatesForInsert.push({
                candidate_id: candidateId,
                name: item.name,
                linkedin: item.linkedin,
                email: item.email || null, // Insert email if available
                created_date: new Date().toISOString(),
                modify_date: new Date().toISOString()
            });

            // Add to Logs (Success)
            logs.push({
                batch_id: batchId,
                candidate_id: candidateId,
                name: item.name,
                linkedin: item.linkedin,
                status: "Scraping",
                note: "Queued for n8n",
                uploader_email: uploaderEmail
            });
        });
    }

    // 4. Batch Insert Candidates
    if (newCandidatesForInsert.length > 0) {
        const { error: insertError } = await (supabase
            .from('Candidate Profile' as any)
            .insert(newCandidatesForInsert) as any);

        if (insertError) {
            return { success: false, error: "Failed to insert candidates: " + insertError.message };
        }

        // 5. Create n8n Job (Queue/Log)
        const n8nPayload = {
            batch_id: batchId,
            requester: uploaderEmail,
            candidate_count: newCandidatesForInsert.length,
            candidates: newCandidatesForInsert.map(c => ({
                id: c.candidate_id,
                name: c.name,
                linkedin: c.linkedin,
                email: c.email
            }))
        };

        const { error: n8nLogError } = await supabase
            .from('n8n_logs')
            .insert({
                workflow_name: 'CSV Upload - Candidate Scraping',
                payload: n8nPayload,
                status: 'PENDING'
            });

        if (n8nLogError) console.error("Failed to log n8n job:", n8nLogError);

        // 6. Trigger n8n with Dynamic URL and Method
        try {
            const config = await getN8nUrl('CSV Upload');

            if (!config) {
                console.error("n8n Configuration 'CSV Upload' not found in DB.");
            } else {
                const url = new URL(config.url);

                // Add requester param regardless of method, just in case
                if (config.method === 'GET') {
                    url.searchParams.append("requester", uploaderEmail);
                }

                console.log(`Triggering CSV n8n Webhook (${config.method}):`, url.toString());

                const fetchOptions: RequestInit = {
                    method: config.method,
                    cache: 'no-store'
                };

                const payloadToSend: any = { ...n8nPayload };
                if (config.method === 'POST') {
                    fetchOptions.headers = { 'Content-Type': 'application/json' };
                    // Ensure requester is in body too
                    payloadToSend.requester = uploaderEmail;
                    fetchOptions.body = JSON.stringify(payloadToSend);
                }

                fetch(url.toString(), fetchOptions).catch(e => console.error("n8n Trigger Failed:", e));
            }

        } catch (e) {
            console.error("n8n Trigger Setup Error:", e);
        }
    }

    // 7. Insert Upload Logs
    if (logs.length > 0) {
        await supabase.from('csv_upload_logs').insert(logs);
    }

    return {
        success: true,
        batchId,
        totalProcessed: logs.length,
        newCandidates: newCandidatesForInsert.length,
        duplicates: logs.length - newCandidatesForInsert.length
    };
}
