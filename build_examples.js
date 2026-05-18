const fs = require('fs');
const path = require('path');

const examplesDir = path.join(__dirname, 'examples');
const outputFile = path.join(__dirname, 'examples_data.js');

const examples = {};

if (fs.existsSync(examplesDir)) {
  const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.xml') || f.endsWith('.pnml'));
  files.forEach(file => {
    const content = fs.readFileSync(path.join(examplesDir, file), 'utf8');
    // Format the name: remove extension, replace underscores with spaces, capitalize words
    const rawName = file.replace(/\.(xml|pnml)$/i, '');
    const name = rawName.replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase())
                        .replace('Example', '')
                        .trim();
    
    examples[name || rawName] = content;
  });
}

const jsContent = `// Automatically generated file. Do not edit directly. Run "node build_examples.js" to update.\n\nconst EXAMPLES = ${JSON.stringify(examples, null, 2)};`;
fs.writeFileSync(outputFile, jsContent);
console.log(`Generated examples_data.js with ${Object.keys(examples).length} examples.`);
