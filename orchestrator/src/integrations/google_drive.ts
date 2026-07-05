// Reads resume text from a publicly-shared Google Drive link — "Anyone
// with the link can view", not a private file granted to some service
// account. That's a deliberate simplification: no OAuth/service-account
// credential is needed at all for a link shared this way, since Google's
// own export/download endpoints serve public content over a plain
// unauthenticated request. This is read-only background material fed to
// the drafting model — entirely separate from resume_source/
// cover_letter_source, which control what document the *output* actually
// contains (see types.ts's DocumentSource).
import { extractText, getDocumentProxy } from "unpdf";

const FILE_ID_PATTERN = /\/d\/([a-zA-Z0-9_-]+)/;

function extractFileId(link: string): string {
  const match = link.match(FILE_ID_PATTERN);
  if (!match) throw new Error(`google drive: could not extract a file ID from link: ${link}`);
  return match[1];
}

export async function fetchResumeText(gdriveLink: string): Promise<string> {
  const fileId = extractFileId(gdriveLink);

  // Try native Google Doc export first — works directly for a publicly
  // link-shared Doc, plain text back, no auth needed.
  const docExportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  const docRes = await fetch(docExportUrl);
  if (docRes.ok) {
    const text = (await docRes.text()).trim();
    // A link that isn't actually a native Doc (e.g. an uploaded PDF)
    // returns an HTML error/redirect page here instead of real content —
    // that's not confidently "real text", so fall through to the PDF path.
    if (text.length > 0 && !text.startsWith("<!DOCTYPE") && !text.startsWith("<html")) {
      return text;
    }
  }

  // Fall back to downloading the raw file and parsing it as a PDF — the
  // other common case for "a resume in Drive" that isn't a native Doc.
  // confirm=t skips Drive's virus-scan interstitial that larger files can
  // trigger even when publicly shared.
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    throw new Error(`google drive: failed to fetch resume at ${gdriveLink}: ${fileRes.status}`);
  }
  const buffer = new Uint8Array(await fileRes.arrayBuffer());
  try {
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    return text.trim();
  } catch (err) {
    throw new Error(
      `google drive: resume at ${gdriveLink} is neither a native Google Doc nor a parseable PDF (.docx and other formats aren't supported): ${String(err)}`,
    );
  }
}
