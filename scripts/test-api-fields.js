
// Node 18+ has built-in fetch
try {
    async function testSearch(query) {
        console.log(`Testing search for: "${query}"`);
        try {
            const response = await fetch('http://127.0.0.1:3000/api/candidates/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    search: query, // Search for "Sumeth" who is blacklisted in user screenshot
                    filters: {
                        country: null,
                        position: null,
                        industry: null,
                        company: null,
                        status: null, // Don't filter out blacklist
                        gender: null,
                        jobFunction: null,
                    },
                    pageSize: 5
                })
            });

            if (!response.ok) {
                console.error(`Status: ${response.status} ${response.statusText}`);
                const text = await response.text();
                console.error("Body:", text);
                return;
            }

            const data = await response.json();
            if (data.data && data.data.length > 0) {
                console.log("First result keys:", Object.keys(data.data[0]));
                console.log("First result candidate_status:", data.data[0].candidate_status);
                console.log("First result status:", data.data[0].status);
                console.log("First result Name:", data.data[0].name);
            } else {
                console.log("No results found.");
            }
        } catch (error) {
            console.error("Fetch error:", error);
        }
    }

    (async () => {
        await testSearch("Sumeth");
    })();

} catch (e) {
    console.error("Script error:", e);
}
