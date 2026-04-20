const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.resolve(__dirname, '..', 'src'));
let count = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('from "sonner"') || content.includes("from 'sonner'")) {
        // Skip the wrapper itself
        if (file.includes('lib/notifications.ts')) return;
        
        const newContent = content
            .replace(/from "sonner"/g, 'from "@/lib/notifications"')
            .replace(/from 'sonner'/g, "from '@/lib/notifications'");
        
        if (content !== newContent) {
            fs.writeFileSync(file, newContent, 'utf8');
            console.log(`Updated: ${file}`);
            count++;
        }
    }
});

console.log(`Total files updated: ${count}`);
