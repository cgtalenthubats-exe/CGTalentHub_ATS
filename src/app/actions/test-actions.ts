'use server'

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function saveTestEncodingNames(names: string[], encoding: string, uploaderName: string) {
    const logs = names.map(name => ({
        raw_name: name,
        encoding_used: encoding,
        created_at: new Date().toISOString()
    }))

    const { error } = await supabase.from('test_encoding_logs').insert(logs)
    if (error) {
        console.error('Error saving test encoding logs:', error)
        throw error
    }

    revalidatePath('/settings/encoding-test')
    return { success: true }
}

export async function getTestEncodingLogs() {
    const { data, error } = await supabase
        .from('test_encoding_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

    if (error) {
        console.error('Error fetching test encoding logs:', error)
        return []
    }
    
    // Map to the format expected by the UI if needed
    return data.map(item => ({
        id: item.id,
        name: item.raw_name,
        note: `Encoding used: ${item.encoding_used}`,
        created_at: item.created_at
    }))
}

export async function clearTestEncodingLogs() {
    const { error } = await supabase
        .from('test_encoding_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (error) throw error
    revalidatePath('/settings/encoding-test')
    return { success: true }
}
