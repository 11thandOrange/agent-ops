// Renders drafted resume/cover-letter text to a PDF buffer for the
// "generated_pdf" document-source mode (types.ts's DocumentSource). Plain
// paragraph rendering only — the drafting model is responsible for content
// and structure, this just gets it onto a page.
import PDFDocument from "pdfkit";

export function renderTextToPdf(title: string, body: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(16).text(title, { align: "left" });
    doc.moveDown();
    doc.font("Helvetica").fontSize(11);
    for (const paragraph of body.split(/\n{2,}/)) {
      doc.text(paragraph.trim(), { align: "left" });
      doc.moveDown();
    }
    doc.end();
  });
}
