import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// PowerPoint decides how to decode a media part from its file extension, via the
// <Default> entries in [Content_Types].xml. The template's parts are all .png, so
// writing JPEG bytes into image12.png yields a deck whose declared content type
// contradicts its bytes: PowerPoint often sniffs past that, but Google Slides,
// LibreOffice and Keynote render a broken image. We therefore detect the real
// format from its magic bytes and store each upload under a matching extension.
const IMAGE_CONTENT_TYPES = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
};

// The 10 image slots, in the order they map onto the template's picture frames.
export const UPLOAD_SLOTS = [
  { key: 'googleMapPic', label: 'Google Map Picture' },
  { key: 'acesPic', label: 'ACES Picture' },
  { key: 'moveOffPic', label: 'Move Off Picture' },
  { key: 'sftl1RedPic', label: 'SFTL1 Red' },
  { key: 'sftl1GreenPic', label: 'SFTL1 Green' },
  { key: 'sftl2RedPic', label: 'SFTL2 Red' },
  { key: 'sftl2GreenPic', label: 'SFTL2 Green' },
  { key: 'sftl3RedPic', label: 'SFTL3 Red' },
  { key: 'sftl3GreenPic', label: 'SFTL3 Green' },
  { key: 'arrivalPic', label: 'Arrival Picture' },
];

const detectImageExtension = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const startsWith = (...sig) => sig.every((byte, i) => bytes[i] === byte);

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (startsWith(0xff, 0xd8, 0xff)) return 'jpeg';
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'gif';
  if (startsWith(0x42, 0x4d)) return 'bmp';
  if (startsWith(0x49, 0x49, 0x2a, 0x00) || startsWith(0x4d, 0x4d, 0x00, 0x2a)) return 'tiff';
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';

  // ISO base media container ('ftyp' at offset 4). HEIC/HEIF photos land here —
  // the iPhone default, and something no version of PowerPoint can render.
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }

  return null;
};

const describeUnusableImage = (label, ext, fileName) => {
  const named = fileName ? ` ("${fileName}")` : '';
  if (ext === 'heic') {
    return `${label}${named} is a HEIC/HEIF photo, which PowerPoint cannot display. On iPhone set Camera > Formats to "Most Compatible", or export the photo as JPEG, then upload it again.`;
  }
  if (ext === 'webp') {
    return `${label}${named} is a WebP image, which PowerPoint does not reliably display. Please save it as PNG or JPEG and upload it again.`;
  }
  return `${label}${named} is not a recognised image file. Please upload a PNG, JPEG, GIF, BMP or TIFF.`;
};

export const generatePPTX = async (formData, images = {}) => {
  try {
    // 1. Load the template
    // BASE_URL keeps this correct when the app is served from a sub-path
    // (GitHub Pages, /reports/, ...), where an absolute '/template.pptx' 404s.
    const templateUrl = `${import.meta.env.BASE_URL}template.pptx`;
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Could not load the report template (HTTP ${response.status} from ${templateUrl}).`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // Hosts with SPA-style rewrites answer an unknown path with index.html and a
    // 200, so confirm we actually got a ZIP rather than trusting response.ok.
    const header = new Uint8Array(arrayBuffer.slice(0, 2));
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      throw new Error(`The file served at ${templateUrl} is not a .pptx. Check that template.pptx is deployed alongside the app.`);
    }

    // 2. Unzip the PPTX
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 3. Identify slide files
    const slideFiles = Object.keys(zip.files).filter(fileName =>
      fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
    );

    // 4. Iterate and Replace Text
    for (const fileName of slideFiles) {
      let content = await zip.file(fileName).async('string');

      // Simple string replacement for all keys in formData
      Object.entries(formData).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        const escapedValue = String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

        content = content.replaceAll(placeholder, escapedValue);
      });

      // Update the file in the zip
      zip.file(fileName, content);
    }

    // 5. Image Replacement Logic
    // We expect matches in this order:
    // 1. Google Map (Slide 1, Large)
    // 2. ACES (Slide 2, Large)
    // 3. Move Off (Slide 3, 1st Large)
    // 4..10. Sequence (Slide 3, subsequent Large)

    const imageTargets = [];
    const EMU_PER_INCH = 914400;

    // Sort slide files to ensure 1 -> 2 -> 3 order
    slideFiles.sort();

    for (const fileName of slideFiles) {
      const content = await zip.file(fileName).async('string');
      // Regex to process strictly in order
      const picRegex = /<p:pic>[\s\S]*?<\/p:pic>/g;
      let match;
      while ((match = picRegex.exec(content)) !== null) {
        const picBlock = match[0];
        const extMatch = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(picBlock);
        if (extMatch) {
          const cx = parseInt(extMatch[1]);

          // Filter: Width MUST be > 1 inch.
          // This captures the 2 main images (Sl 1 & 2) and the 8 sequence images (Sl 3)
          // while filtering out small icons (0.29 inch)
          if (cx > EMU_PER_INCH) {
            const blipMatch = /<a:blip[^>]*r:embed="([^"]+)"/.exec(picBlock);
            if (blipMatch) {
              imageTargets.push({
                slideFile: fileName,
                rId: blipMatch[1]
              });
            }
          }
        }
      }
    }

    // Map uploaded images onto the targets found above, by position. Nulls are
    // preserved: skipping the ACES picture must not slide Move Off into its slot.
    const usedExtensions = new Set();

    for (let i = 0; i < imageTargets.length && i < UPLOAD_SLOTS.length; i++) {
      const slot = UPLOAD_SLOTS[i];
      const uploadFile = images[slot.key];
      if (!uploadFile) continue; // Skip if user didn't upload this specific image

      const target = imageTargets[i];

      // Resolve rId to actual file path using _rels
      // slideFile: ppt/slides/slide1.xml -> rels: ppt/slides/_rels/slide1.xml.rels
      const relsFile = target.slideFile.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';

      const relsContent = await zip.file(relsFile)?.async('string');
      if (!relsContent) continue;

      // Grab the whole <Relationship .../> element for this rId so we can repoint
      // it regardless of the order its attributes happen to be written in.
      const relElement = new RegExp(`<Relationship\\b[^>]*\\bId="${target.rId}"[^>]*/>`).exec(relsContent);
      if (!relElement) continue;
      const currentTarget = /\bTarget="([^"]+)"/.exec(relElement[0]);
      if (!currentTarget || !currentTarget[1].includes('media/')) continue;

      const uploadBuffer = await uploadFile.arrayBuffer();
      const ext = detectImageExtension(uploadBuffer);
      if (!IMAGE_CONTENT_TYPES[ext]) {
        throw new Error(describeUnusableImage(slot.label, ext, uploadFile.name));
      }

      // Write the upload as a NEW media part instead of overwriting the template's
      // file. Several <p:pic> elements can share one media part (slide 3's icons
      // all point at image19.png), so overwriting in place would swap every one of
      // them. Adding a part and repointing only this relationship cannot alias.
      const mediaName = `lr_upload_${i + 1}.${ext}`;
      zip.file(`ppt/media/${mediaName}`, uploadBuffer);
      usedExtensions.add(ext);

      const updatedElement = relElement[0].replace(/\bTarget="[^"]+"/, `Target="../media/${mediaName}"`);
      zip.file(relsFile, relsContent.replace(relElement[0], updatedElement));
    }

    // Every extension we introduced must be declared in [Content_Types].xml, or
    // PowerPoint opens the deck with a "needs repair" prompt.
    if (usedExtensions.size > 0) {
      const typesPath = '[Content_Types].xml';
      let typesXml = await zip.file(typesPath).async('string');
      for (const ext of usedExtensions) {
        if (!new RegExp(`<Default[^>]*Extension="${ext}"`, 'i').test(typesXml)) {
          typesXml = typesXml.replace('</Types>', `<Default ContentType="${IMAGE_CONTENT_TYPES[ext]}" Extension="${ext}"/></Types>`);
        }
      }
      zip.file(typesPath, typesXml);
    }


    // 6. Generate Blob
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `Incident_Report_${formData.incident_no || 'Draft'}.pptx`);

  } catch (error) {
    console.error('PPTX Generation Error:', error);
    throw error;
  }
};
