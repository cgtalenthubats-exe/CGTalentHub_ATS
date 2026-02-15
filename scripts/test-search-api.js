// Node 18+ has built-in fetch
try {
    async function testSearch(query) {
        console.log(`Testing search for: "${query}"`);
        try {
            // Use [::1] or 127.0.0.1 to avoid localhost resolution issues sometimes
            const response = await fetch('http://127.0.0.1:3000/api/candidates/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    search: query,
                    filters: {
                        country: [],
                        position: [],
                        industry: [],
                        company: [],
                        status: [],
                        gender: [],
                        jobFunction: [],
                    },
                    pageSize: 20
                })
            });

            if (!response.ok) {
                console.error(`Status: ${response.status} ${response.statusText}`);
                const text = await response.text();
                console.error("Body:", text);
                return;
            }

            const data = await response.json();
            console.log(`Results found: ${data.data ? data.data.length : 0}`);
            if (data.data && data.data.length > 0) {
                console.log("First result:", data.data[0].name);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        }
    }

    (async () => {
        await testSearch("Sumeth"); // Known good
        await testSearch("aldi");   // User case
    })();

} catch (e) {
    console.error("Script error:", e);
}
