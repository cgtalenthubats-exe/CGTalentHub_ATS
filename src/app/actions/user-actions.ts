"use server";

import { adminAuthClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getCurrentUserEmail } from "./status-updates";

export interface UserProfile {
    email: string;
    real_name: string;
    role: string;
    created_at?: string;
}

export async function getUserProfiles() {
    const supabase = adminAuthClient;
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('real_name', { ascending: true });

    if (error) {
        console.error("Error fetching user profiles:", error);
        return { success: false, error: error.message };
    }

    return { success: true, data: data as UserProfile[] };
}

export async function upsertUserProfile(profile: UserProfile) {
    const supabase = adminAuthClient;

    const { error } = await (supabase as any)
        .from('user_profiles')
        .upsert({
            email: profile.email,
            real_name: profile.real_name,
            role: profile.role || 'user',
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error("Error upserting user profile:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    return { success: true };
}

export async function deleteUserProfile(email: string) {
    const supabase = adminAuthClient;

    const { error } = await (supabase as any)
        .from('user_profiles')
        .delete()
        .eq('email', email);

    if (error) {
        console.error("Error deleting user profile:", error);
        return { success: false, error: error.message };
    }

    revalidatePath('/settings');
    return { success: true };
}

// Helper to get a Map of email -> real_name for quick lookups
export async function getUserMap() {
    const result = await getUserProfiles();
    const map = new Map<string, string>();

    if (result.success && result.data) {
        result.data.forEach(user => {
            if (user.email) {
                map.set(user.email.toLowerCase(), user.real_name);
            }
        });
    }

    return map;
}

export async function getCurrentUserRealName(): Promise<string> {
    const email = await getCurrentUserEmail();
    if (email === 'System') return 'System';

    try {
        const supabase = adminAuthClient;
        const { data, error } = await (supabase as any)
            .from('user_profiles')
            .select('real_name')
            .eq('email', email)
            .single();

        if (error || !data) {
            return email; // Fallback to email
        }

        return (data as any).real_name || email;
    } catch {
        return email;
    }
}
