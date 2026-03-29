"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface N8nConfig {
    id: number;
    name: string;
    url: string;
    method: 'GET' | 'POST';
    description: string;
    value?: string;
    updated_at: string;
}

export async function updateAiConfig(name: string, value: string) {
    const { error } = await supabase
        .from('n8n_configs')
        .update({
            value,
            updated_at: new Date().toISOString()
        })
        .eq('name', name);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/admin/n8n');
    revalidatePath('/settings');
    return { success: true };
}

export async function getN8nConfigs() {
    const { data, error } = await supabase
        .from('n8n_configs')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error("Fetch Configs Error:", error);
        return [];
    }

    const configs = data as N8nConfig[];
    
    const requiredConfigs = [
        { name: 'CSV Upload', description: 'Triggered after batch CSV upload success' },
        { name: 'JR Report', description: 'Triggered when a JR report is requested' },
        { name: 'Candidate Refresh', description: 'Triggered when candidate data needs to be updated' },
        { name: 'Job Description Upload', description: 'Triggered when a Job Requisition is created or updated' },
        { name: 'Interview Feedback', description: 'Triggered when interview feedback with file is submitted' }
    ];

    // Check if any required config is missing and try to insert it for real
    for (const req of requiredConfigs) {
        if (!configs.find(c => c.name === req.name)) {
            console.log(`Missing required config: ${req.name}. Attempting auto-insert...`);
            const { data: newEntry, error: insertError } = await supabase
                .from('n8n_configs')
                .insert({
                    name: req.name,
                    description: req.description,
                    method: req.name === 'JR Report' ? 'GET' : 'POST',
                    url: ''
                })
                .select()
                .single();
            
            if (!insertError && newEntry) {
                configs.push(newEntry as N8nConfig);
            } else {
                // If insert fails (e.g. no permission), add a virtual entry for UI
                configs.push({
                    id: -Math.floor(Math.random() * 1000000),
                    name: req.name,
                    url: '',
                    method: req.name === 'JR Report' ? 'GET' : 'POST',
                    description: req.description,
                    updated_at: new Date().toISOString()
                });
            }
        }
    }

    return configs;
}

export async function updateN8nConfig(id: number, url: string, method: 'GET' | 'POST') {
    // If ID is negative, it means it's a virtual entry and needs insertion
    // But since ID is randomized, we'll try to find by name if we can pass name here.
    // For now, let's keep it simple and just let the existing logic handle DB IDs.
    // We'll add a check in the component to call a DIFFERENT update function if ID < 0.
    
    const { error } = await supabase
        .from('n8n_configs')
        .update({
            url,
            method,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/admin/n8n');
    revalidatePath('/settings');
    return { success: true };
}

export async function upsertN8nConfig(name: string, url: string, method: 'GET' | 'POST', description: string) {
    const { error } = await supabase
        .from('n8n_configs')
        .upsert({
            name,
            url,
            method,
            description,
            updated_at: new Date().toISOString()
        }, { onConflict: 'name' });

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/admin/n8n');
    revalidatePath('/settings');
    return { success: true };
}

// Helper to get a specific URL by name (for use in other actions)
export async function getN8nUrl(name: string): Promise<{ url: string, method: string } | null> {
    const { data, error } = await supabase
        .from('n8n_configs')
        .select('url, method')
        .eq('name', name)
        .single();

    if (error || !data) return null;
    return data;
}
