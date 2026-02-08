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
    updated_at: string;
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
    return data as N8nConfig[];
}

export async function updateN8nConfig(id: number, url: string, method: 'GET' | 'POST') {
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
