const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

async function generateCertificate(credential, merkleRoot, leaf, proof) {

	const proofParam = proof.join(',');
	// Points to the React Frontend Verifier Portal on port 5173
	const verifyUrl = `http://localhost:5173/verify?merkleRoot=${merkleRoot}&leaf=${leaf}&proof=${proofParam}`;

	const qrImageBytes = await QRCode.toBuffer(verifyUrl);

	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([595, 842]);

	const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const qrImage = await pdfDoc.embedPng(qrImageBytes);

	page.drawText('VerifyChain Certificate', { x: 150, y: 750, size: 24, font, color: rgb(0, 0, 0) });
	page.drawText(`Name: ${credential.studentName}`, { x: 50, y: 650, size: 16, font });
	page.drawText(`Degree: ${credential.degreeTitle}`, { x: 50, y: 620, size: 16, font });
	page.drawImage(qrImage, { x: 400, y: 500, width: 120, height: 120 });

	const pdfBytes = await pdfDoc.save();
	return pdfBytes;
}

module.exports = { generateCertificate };