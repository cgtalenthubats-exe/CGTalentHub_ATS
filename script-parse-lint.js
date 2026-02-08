
const fs = require('fs');
const content = fs.readFileSync('lint-results.json', 'utf16le');
const results = JSON.parse(content.replace(/^\uFEFF/, ''));
results.forEach(result => {
    const errors = result.messages.filter(msg => msg.severity === 2);
    if (errors.length > 0) {
        console.log(`File: ${result.filePath}`);
        errors.forEach(err => {
            console.log(`  Line ${err.line}:${err.column} - ${err.message} (${err.ruleId})`);
        });
    }
});
