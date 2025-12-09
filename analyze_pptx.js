const fs = require('fs');
const JSZip = require('jszip');

const EMU_PER_INCH = 914400;

async function analyze() {
    const data = fs.readFileSync('public/template.pptx');
    const zip = await JSZip.loadAsync(data);

    const slideFiles = Object.keys(zip.files).filter(n => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'));

    for (const fileName of slideFiles) {
        const content = await zip.file(fileName).async('string');
        // Simple regex to find pics and dimensions. 
        // XML structure: <p:pic> ... <p:spPr> ... <a:xfrm> ... <a:ext cx="WIDTH" cy="HEIGHT"/>
        // We'll iterate matches

        // Regex to capture the whole Pic structure roughly or just find extents nearby
        // Let's use a regex that matches the extent tag specifically, but we need context of it being a pic.
        // It's XML, so regex is fragile, but sufficient for analysis.

        // Find all <p:pic> ... </p:pic> blocks
        const picRegex = /<p:pic>[\s\S]*?<\/p:pic>/g;
        let match;
        let count = 0;

        while ((match = picRegex.exec(content)) !== null) {
            const picBlock = match[0];

            // Extract Name
            const nameMatch = /name="([^"]+)"/.exec(picBlock);
            const name = nameMatch ? nameMatch[1] : 'Unknown';

            // Extract Extents
            const extMatch = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(picBlock);
            if (extMatch) {
                const cx = parseInt(extMatch[1]);
                const cy = parseInt(extMatch[2]);

                if (cx > EMU_PER_INCH && cy > EMU_PER_INCH) {
                    console.log(`Found Large Image: Slide: ${fileName}, Name: ${name}, Width: ${cx}, Height: ${cy}`);
                    count++;
                }
            }
        }
    }
}

analyze().catch(console.error);
