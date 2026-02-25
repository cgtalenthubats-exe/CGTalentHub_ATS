"use server";

import { adminAuthClient } from "@/lib/supabase/admin";

export type AppSetting = {
    key: string;
    value: string;
    label: string;
    description: string;
    updated_at: string;
};

export async function getAppSettings(): Promise<AppSetting[]> {
    const { data, error } = await adminAuthClient
        .from('app_settings')
        .select('*')
        .order('key');

    if (error) {
        console.error('getAppSettings error:', error);
        return [];
    }
    return (data as AppSetting[]) || [];
}

export async function getSettingValue(key: string): Promise<string> {
    const { data } = await adminAuthClient
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

    return (data as any)?.value || '';
}

export async function updateSetting(key: string, value: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await adminAuthClient
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
