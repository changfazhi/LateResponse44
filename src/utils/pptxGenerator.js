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

const SLIDE_1 = 'ppt/slides/slide1.xml';
const SLIDE_2 = 'ppt/slides/slide2.xml';
const SLIDE_3 = 'ppt/slides/slide3.xml';

// Which upload lands in which picture frame, keyed by the slide that owns the
// frames. Mapping is positional *within a slide*, so a report type that drops a
// slide cannot shift the remaining uploads into the wrong frames — which is what
// a single flat list across all slides used to do.
export const SLIDE_UPLOAD_SLOTS = {
  [SLIDE_1]: [
    { key: 'googleMapPic', label: 'Google Map Picture' },
  ],
  [SLIDE_2]: [
    { key: 'acesPic', label: 'ACES Picture' },
  ],
  [SLIDE_3]: [
    { key: 'moveOffPic', label: 'Move Off Picture' },
    { key: 'sftl1RedPic', label: 'SFTL1 Red' },
    { key: 'sftl1GreenPic', label: 'SFTL1 Green' },
    { key: 'sftl2RedPic', label: 'SFTL2 Red' },
    { key: 'sftl2GreenPic', label: 'SFTL2 Green' },
    { key: 'sftl3RedPic', label: 'SFTL3 Red' },
    { key: 'sftl3GreenPic', label: 'SFTL3 Green' },
    { key: 'arrivalPic', label: 'Arrival Picture' },
  ],
};

// The two documents this tool produces. A late activation report is slide 2 on its
// own: the ACES-versus-actual activation table, the ACES screenshot and the
// remark. Slides 1 and 3 are about the response and would print blank on it.
export const REPORT_MODES = {
  late_response: {
    label: 'Late Response',
    slides: [SLIDE_1, SLIDE_2, SLIDE_3],
    filePrefix: 'Incident_Report',
  },
  late_activation: {
    label: 'Late Activation',
    slides: [SLIDE_2],
    filePrefix: 'Late_Activation',
  },
};

export const uploadSlotsFor = (mode) =>
  (REPORT_MODES[mode]?.slides || []).flatMap(slide => SLIDE_UPLOAD_SLOTS[slide] || []);

// Every slot any report type can use, for state that has to outlive a mode switch.
export const ALL_UPLOAD_SLOTS = Object.values(SLIDE_UPLOAD_SLOTS).flat();

const EMU_PER_INCH = 914400;

const escapeForRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ppt/slides/slide2.xml -> ppt/slides/_rels/slide2.xml.rels
const relsPathFor = (partPath) => partPath.replace(/([^/]+)$/, '_rels/$1.rels');

// The slide's picture frames, in document order, keeping only those wider than an
// inch. That threshold separates the real photo targets (smallest 1.57 in) from
// the template's decoy icons (largest 0.36 in).
const findPictureFrames = (slideXml) => {
  const frames = [];
  const picRegex = /<p:pic>[\s\S]*?<\/p:pic>/g;
  let match;
  while ((match = picRegex.exec(slideXml)) !== null) {
    const picBlock = match[0];
    const extMatch = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(picBlock);
    if (!extMatch) continue;
    if (parseInt(extMatch[1], 10) <= EMU_PER_INCH) continue;
    const blipMatch = /<a:blip[^>]*r:embed="([^"]+)"/.exec(picBlock);
    if (blipMatch) frames.push(blipMatch[1]);
  }
  return frames;
};

// Remove the slides a report type does not use. A part left behind in the package
// is harmless, but a <p:sldId> or an <Override> pointing at a part that is gone
// makes PowerPoint declare the file corrupt, so every reference goes with it.
// Media parts are deliberately left alone: slide layouts and the master share
// them, so pruning by slide would break the slides we keep.
const pruneSlides = async (zip, keepSlides) => {
  const present = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const drop = present.filter(name => !keepSlides.includes(name));
  if (drop.length === 0) return;

  const removedParts = [];
  const removedRelIds = [];

  for (const slidePart of drop) {
    const relsPath = relsPathFor(slidePart);
    const relsXml = await zip.file(relsPath)?.async('string');
    if (relsXml) {
      // A notes page belongs to exactly one slide, so it leaves with it.
      const notesMatch = /Target="\.\.\/(notesSlides\/notesSlide\d+\.xml)"/.exec(relsXml);
      if (notesMatch) {
        const notesPart = `ppt/${notesMatch[1]}`;
        zip.remove(notesPart);
        zip.remove(relsPathFor(notesPart));
        removedParts.push(notesPart);
      }
      zip.remove(relsPath);
    }
    zip.remove(slidePart);
    removedParts.push(slidePart);
  }

  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  let presRels = await zip.file(presRelsPath).async('string');
  for (const slidePart of drop) {
    const target = escapeForRegExp(slidePart.replace('ppt/', ''));
    const rel = new RegExp(`<Relationship\\b[^>]*\\bTarget="${target}"[^>]*/>`).exec(presRels);
    if (!rel) continue;
    const id = /\bId="([^"]+)"/.exec(rel[0]);
    if (id) removedRelIds.push(id[1]);
    presRels = presRels.replace(rel[0], '');
  }
  zip.file(presRelsPath, presRels);

  const presPath = 'ppt/presentation.xml';
  let presXml = await zip.file(presPath).async('string');
  for (const relId of removedRelIds) {
    presXml = presXml.replace(new RegExp(`<p:sldId\\b[^>]*\\br:id="${escapeForRegExp(relId)}"[^>]*/>`), '');
  }
  zip.file(presPath, presXml);

  const typesPath = '[Content_Types].xml';
  let typesXml = await zip.file(typesPath).async('string');
  for (const part of removedParts) {
    typesXml = typesXml.replace(new RegExp(`<Override\\b[^>]*\\bPartName="/${escapeForRegExp(part)}"[^>]*/>`), '');
  }
  zip.file(typesPath, typesXml);
};

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

export const generatePPTX = async (formData, images = {}, mode = 'late_response') => {
  try {
    const reportMode = REPORT_MODES[mode];
    if (!reportMode) {
      throw new Error(`Unknown report type "${mode}".`);
    }

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

    // 3. Keep only the slides this report type is built from. Do it first, so
    //    neither the text replacement nor the image mapping below can see a slide
    //    that will not be in the download.
    for (const slidePart of reportMode.slides) {
      if (!zip.file(slidePart)) {
        throw new Error(`The template is missing ${slidePart}, which the ${reportMode.label} report is built from.`);
      }
    }
    await pruneSlides(zip, reportMode.slides);

    // 4. Iterate and Replace Text
    for (const fileName of reportMode.slides) {
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
    // Frames are matched to slots one slide at a time, in document order, so the
    // Nth frame on a slide always takes that slide's Nth upload no matter which
    // other slides this report type kept.
    const usedExtensions = new Set();

    for (const slidePart of reportMode.slides) {
      const slots = SLIDE_UPLOAD_SLOTS[slidePart] || [];
      if (slots.length === 0) continue;

      const content = await zip.file(slidePart).async('string');
      const frames = findPictureFrames(content);

      // Resolve rIds to media parts via _rels
      // slideFile: ppt/slides/slide1.xml -> rels: ppt/slides/_rels/slide1.xml.rels
      const relsFile = relsPathFor(slidePart);

      for (let i = 0; i < slots.length && i < frames.length; i++) {
        const slot = slots[i];
        const uploadFile = images[slot.key];
        // Skipping the ACES picture must not slide Move Off into its frame, so a
        // missing upload leaves that frame on the template's own graphic.
        if (!uploadFile) continue;

        const relsContent = await zip.file(relsFile)?.async('string');
        if (!relsContent) continue;

        // Grab the whole <Relationship .../> element for this rId so we can repoint
        // it regardless of the order its attributes happen to be written in.
        const relElement = new RegExp(`<Relationship\\b[^>]*\\bId="${frames[i]}"[^>]*/>`).exec(relsContent);
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
        const mediaName = `lr_upload_${slot.key}.${ext}`;
        zip.file(`ppt/media/${mediaName}`, uploadBuffer);
        usedExtensions.add(ext);

        const updatedElement = relElement[0].replace(/\bTarget="[^"]+"/, `Target="../media/${mediaName}"`);
        zip.file(relsFile, relsContent.replace(relElement[0], updatedElement));
      }
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
    saveAs(content, `${reportMode.filePrefix}_${formData.incident_no || 'Draft'}.pptx`);

  } catch (error) {
    console.error('PPTX Generation Error:', error);
    throw error;
  }
};
