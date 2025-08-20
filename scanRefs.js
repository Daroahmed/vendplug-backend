// scanRefs.js
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, 'backend'); // change if your models are elsewhere
const modelsDir = path.join(projectRoot, 'models');

const modelNames = new Set();
const refs = [];

function walkDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);

        // skip node_modules and scanRefs.js
        if (filePath.includes('node_modules') || filePath.includes('scanRefs.js')) {
            return;
        }

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath);
        } else if (filePath.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf8');

            // find mongoose.model definitions
            const modelMatch = content.match(/mongoose\.model\s*\(\s*['"`](.+?)['"`]/g);
            if (modelMatch) {
                modelMatch.forEach(match => {
                    const name = match.match(/['"`](.+?)['"`]/)[1];
                    modelNames.add(name);
                });
            }

            // find refs in schema
            const refMatch = content.match(/ref\s*:\s*['"`](.+?)['"`]/g);
            if (refMatch) {
                refMatch.forEach(match => {
                    const refName = match.match(/['"`](.+?)['"`]/)[1];
                    refs.push({ refName, filePath });
                });
            }
        }
    });
}

walkDir(projectRoot);

console.log(`📌 Found Models: ${Array.from(modelNames).join(', ')}\n`);
console.log(`🔍 Checking Refs...`);
refs.forEach(({ refName, filePath }) => {
    if (modelNames.has(refName)) {
        console.log(`✅ Found matching model for ref '${refName}' in file: ${filePath}`);
    } else {
        console.log(`❌ Missing model for ref '${refName}' in file: ${filePath}`);
    }
});
