const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'extensions.js');
let content = fs.readFileSync(filePath, 'utf8');

// 修复空生产依赖导致的 glob 错误
const oldCode = `    else {
        // also include shared production node modules
        const productionDependencies = (0, dependencies_1.getProductionDependencies)('extensions/');
        const dependenciesSrc = productionDependencies.map(d => path_1.default.relative(root, d)).map(d => [\`\${d}/**\`, \`!\${d}/**/{test,tests}/**\`]).flat();
        result = event_stream_1.default.merge(localExtensionsStream, gulp_1.default.src(dependenciesSrc, { base: '.' })
            .pipe(util2.cleanNodeModules(path_1.default.join(root, 'build', '.moduleignore')))
            .pipe(util2.cleanNodeModules(path_1.default.join(root, 'build', \`.moduleignore.\${process.platform}\`))));
    }`;

const newCode = `    } else {
        // also include shared production node modules
        const productionDependencies = (0, dependencies_1.getProductionDependencies)('extensions/');
        if (productionDependencies.length > 0) {
            const dependenciesSrc = productionDependencies.map(d => path_1.default.relative(root, d)).map(d => [\`\${d}/**\`, \`!\${d}/**/{test,tests}/**\`]).flat();
            result = event_stream_1.default.merge(localExtensionsStream, gulp_1.default.src(dependenciesSrc, { base: '.' })
                .pipe(util2.cleanNodeModules(path_1.default.join(root, 'build', '.moduleignore')))
                .pipe(util2.cleanNodeModules(path_1.default.join(root, 'build', \`.moduleignore.\${process.platform}\`))));
        } else {
            result = localExtensionsStream;
        }
    }`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched extensions.js');
} else {
    console.log('Could not find the exact code to replace');
    console.log('Searching for alternative pattern...');
    
    // 尝试更宽松的匹配
    if (content.includes("productionDependencies.length > 0")) {
        console.log('File already patched!');
    } else {
        console.log('Pattern not found. Manual inspection needed.');
    }
}
