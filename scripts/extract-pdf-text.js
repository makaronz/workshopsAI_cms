
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
console.log('pdf export type:', typeof pdf);
console.log('pdf export keys:', Object.keys(pdf));


const files = [
    'Building AI-Powered Co-Living Workshop Apps for Polish Municipalities_ Technical Architecture and Market Analysis.pdf',
    'sharedliving AI samorządy.pdf'
];

const dir = path.join(__dirname, '../usrdcs');

async function readPdf(filename) {
    const dataBuffer = fs.readFileSync(path.join(dir, filename));
    try {
        let parser;
        if (pdf.PDFParse) {
            parser = new pdf.PDFParse({ data: dataBuffer });
        } else {
            throw new Error('Could not find PDFParse class');
        }

        const data = await parser.getText();
        console.log(`\n--- START OF ${filename} ---\n`);
        console.log(data.text.slice(0, 2000));
        console.log(`\n--- END OF ${filename} (Truncated) ---\n`);
    } catch (e) {
        console.error(`Error reading ${filename}:`, e.message);
    }
}

async function main() {
    for (const file of files) {
        await readPdf(file);
    }
}

main();
