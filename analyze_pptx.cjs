const fs = require('fs');
const JSZip = require('jszip');

const EMU_PER_INCH = 914400;

async function analyze() {
    const data = fs.readFileSync('public/template.pptx');
    const zip = await JSZip.loadAsync(data);

    const slideFiles = Object.keys(zip.files).filter(n => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'));

    for (const fileName of slideFiles) {
        const content = await zip.file(fileName).async('string');
        const picRegex = /<p:pic>[\s\S]*?<\/p:pic>/g;
        let match;

        while ((match = picRegex.exec(content)) !== null) {
            const picBlock = match[0];
            const nameMatch = /name="([^"]+)"/.exec(picBlock);
            const name = nameMatch ? nameMatch[1] : 'Unknown';
            const extMatch = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(picBlock);
            if (extMatch) {
                const cx = parseInt(extMatch[1]);
                const cy = parseInt(extMatch[2]);

                // Log ALL for Slide 3 to debug
                if (fileName.includes('slide3.xml')) {
                    fs.appendFileSync('slide3_log.txt', `Slide 3 Image: Name: ${name}, Size: ${cx}x${cy}\n`);
                }

                if (cx > EMU_PER_INCH && cy > EMU_PER_INCH) {
                    fs.appendFileSync('large_images_log.txt', `Found Large Image: Slide: ${fileName}, Name: ${name}, Width: ${cx}, Height: ${cy}\n`);
                }
            }
        }
    }
}

analyze().catch(console.error);
