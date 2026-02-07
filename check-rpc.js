require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log('--- Testing reserve_candidate_ids RPC ---');

    // Try to reserve 0 IDs just to see if it exists/errors without consuming IDs
    // Or reserve 1 and log it (might consume an ID, strictly speaking, but better than guessing)
    // Let's try to call it with batch_size 1 but NOT insert. 
    // NOTE: This WILL consume an ID sequence if it's based on a sequence. 
    // If it's max(id) + 1, it might reserve it temporarily or return the current potential next.

    try {
        // Just check if we can call it. 
        // We warn the user this might "burn" one ID in the sequence if standard sequence is used, 
        // but for testing logic existence it is necessary.
        console.log("Calling rpc('reserve_candidate_ids', { batch_size: 1 })...");
        const { data, error } = await supabase.rpc('reserve_candidate_ids', { batch_size: 1 });

        if (error) {
            console.error('RPC Error:', error);
        } else {
            console.log('RPC Success:', data);
            console.log('This confirms the existing system uses a DB function for safe ID generation.');
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

testRpc();
