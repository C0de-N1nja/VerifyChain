const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

async function generateCertificate(credential, merkleRoot, leaf, proof) {
  // Step A: build the verification URL that the QR code will point to
  const proofParam = proof.join(',');
  const verifyUrl = `http://localhost:3000/api/verify/${encodeURIComponent(credential.studentName)}?merkleRoot=${merkleRoot}&leaf=${leaf}&proof=${proofParam}`;

  // Step B: generate the QR code as a PNG image (in memory, not saved to disk)
  const qrImageBytes = await QRCode.toBuffer(verifyUrl);

  // Step C: create a new blank PDF, one A4 page
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size in points

  // Step D: embed fonts and the QR image
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdfDoc.embedPng(qrImageBytes);

  // Step E: draw text and QR code onto the page
  page.drawText('VerifyChain Certificate', { x: 150, y: 750, size: 24, font, color: rgb(0, 0, 0) });
  page.drawText(`Name: ${credential.studentName}`, { x: 50, y: 650, size: 16, font });
  page.drawText(`Degree: ${credential.degreeTitle}`, { x: 50, y: 620, size: 16, font });
  page.drawImage(qrImage, { x: 400, y: 500, width: 120, height: 120 });

  // Step F: return the finished PDF as bytes
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

module.exports = { generateCertificate };
