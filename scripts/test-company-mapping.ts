import { searchCompanies } from './src/app/actions/candidate-filters';
import { importOrgChart } from './src/app/actions/org-chart-actions';

async function test() {
    console.log('--- Testing searchCompanies ---');
    const results = await searchCompanies('tree', 5);
    console.log('Search results for "tree":', results);

    console.log('\n--- Testing importOrgChart Lookup ---');
    // Note: This will actually insert if not found, use a unique name for testing if desired
    // For now, let's just test with an existing variation
    const existing = await importOrgChart('test_id', 'treepay', 'test.pdf', 'http://example.com/test.pdf', 'Test note');
    console.log('Import result for existing company (treepay):', existing);
}

test().catch(console.error);
