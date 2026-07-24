const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const os = require('os');

function getLocalIp() {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name]) {
			if (iface.family === 'IPv4' && !iface.internal) {
				return iface.address;
			}
		}
	}
	return 'localhost';
}

async function generateCertificate(credential, merkleRoot, leaf, proof) {
	const proofParam = proof.join(',');
	const frontendBaseUrl = process.env.FRONTEND_URL || `http://${getLocalIp()}:5173`;
	const verifyUrl = `${frontendBaseUrl}/verify?merkleRoot=${merkleRoot}&leaf=${leaf}&proof=${proofParam}`;

	const qrImageBytes = await QRCode.toBuffer(verifyUrl);

	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage([595, 842]); // A4 size

	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const qrImage = await pdfDoc.embedPng(qrImageBytes);

	// 1. Outer Border
	page.drawRectangle({
		x: 30, y: 30, width: 535, height: 782,
		borderColor: rgb(0.1, 0.2, 0.5), borderWidth: 3
	});

	// 2. Header
	page.drawText('VerifyChain', { x: 235, y: 760, size: 30, font: fontBold, color: rgb(0.1, 0.2, 0.5) });
	page.drawText('Certificate of Academic Achievement', { x: 145, y: 730, size: 16, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

	// Divider line
	page.drawLine({
		start: { x: 100, y: 710 }, end: { x: 495, y: 710 },
		thickness: 1, color: rgb(0.8, 0.8, 0.8)
	});

	// 3. Institution & Date
	const institutionName = credential.institutionName || 'VerifyChain Accredited Institution';
	page.drawText(`Issued By: ${institutionName}`, { x: 60, y: 660, size: 14, font: fontBold, color: rgb(0, 0, 0) });

	const issueDateRaw = credential.issueDate || credential.issuedAt || Date.now();
	const formattedDate = new Date(issueDateRaw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	page.drawText(`Date of Issue: ${formattedDate}`, { x: 60, y: 635, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

	// 4. Credential Details
	page.drawText('This certifies that', { x: 60, y: 580, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
	page.drawText(credential.studentName, { x: 60, y: 550, size: 24, font: fontBold, color: rgb(0.1, 0.2, 0.5) });

	page.drawText('has successfully completed the requirements for', { x: 60, y: 520, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
	page.drawText(credential.degreeTitle, { x: 60, y: 490, size: 20, font: fontBold, color: rgb(0, 0, 0) });

	// 5. Credential ID & Verification instructions
	const shortLeaf = `${leaf.substring(0, 6)}...${leaf.substring(leaf.length - 4)}`;
	page.drawText(`Credential ID: ${shortLeaf}`, { x: 60, y: 430, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

	page.drawText('To verify the authenticity of this credential,', { x: 60, y: 400, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
	page.drawText('scan the QR code or visit the VerifyChain Portal.', { x: 60, y: 385, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

	// 6. QR Code (Bottom Right)
	const qrSize = 130;
	const qrX = 410;
	const qrY = 340;
	page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

	// QR Code border
	page.drawRectangle({
		x: qrX - 5, y: qrY - 5, width: qrSize + 10, height: qrSize + 10,
		borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1
	});

	// 7. Footer
	page.drawLine({
		start: { x: 100, y: 100 }, end: { x: 495, y: 100 },
		thickness: 1, color: rgb(0.8, 0.8, 0.8)
	});
	page.drawText('Powered by zkSync Sepolia Blockchain Technology', { x: 165, y: 80, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

	const pdfBytes = await pdfDoc.save();
	return pdfBytes;
}

module.exports = { generateCertificate };