// Salary / benefit utility functions — safe to import from both client and server

// Parse salary string → number (handles "510,000" and "510000")
export function parseSalary(val: string | null): number | null {
    if (!val || val.trim() === '') return null;
    const cleaned = val.replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

// Check if a benefit field "has value"
export function hasBenefit(val: string | null): boolean {
    if (!val) return false;
    const v = val.trim();
    return v !== '' && v !== '-' && v !== '0' && v !== '0%' && v !== 'N/A';
}
