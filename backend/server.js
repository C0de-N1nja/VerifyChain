require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const { credentialRegistry } = require('./blockchain.js');
const { buildMerkleTree } = require('./merkle.js');
const { generateCertificate } = require('./certificate.js');
const { sendCertificateEmail } = require('./mailer.js');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

async function sendWithRetry(email, studentName, pdfBytes) {
	try {
		await sendCertificateEmail(email, studentName, pdfBytes);
		return true;
	} catch (firstError) {
		try {
			await sendCertificateEmail(email, studentName, pdfBytes);
			return true;
		} catch (secondError) {
			return false;
		}
	}
}

// Issuer Portal: Prepration Routes
app.get('/api/issuer/csv-template', (req, res) => {
	const csvContent = 'studentName,degreeTitle,issuerAddress,email,expiryTimestamp\nAli Raza,BSCS,0x19992c2DE1Da16b33bE1Aef78C0f99674A839E70,ali@example.com,0\n';
	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', 'attachment; filename="verifychain-template.csv"');
	res.send(csvContent);
});

app.post('/api/issuer/prepare-batch', (req, res) => {
	try {
		const { credentials } = req.body;

		if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
			return res.status(400).json({ error: 'credentials array is required' });
		}

		const { tree, leaves, root } = buildMerkleTree(credentials);

		const prepared = credentials.map((credential, i) => ({
			credential,
			leaf: '0x' + leaves[i].toString('hex'),
			proof: tree.getHexProof(leaves[i])
		}));

		res.json({ merkleRoot: root, credentials: prepared });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.post('/api/issuer/prepare-batch-csv', upload.single('file'), (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: 'CSV file is required (field name: file)' });
		}

		const records = parse(req.file.buffer, {
			columns: true,
			skip_empty_lines: true,
			trim: true
		});

		const errors = [];
		records.forEach((row, i) => {
			if (!row.studentName || !row.degreeTitle || !row.issuerAddress) {
				errors.push(`Row ${i + 2}: missing studentName, degreeTitle, or issuerAddress`);
			}
		});

		if (errors.length > 0) {
			return res.status(400).json({ error: 'CSV validation failed', details: errors });
		}

		const credentials = records.map(row => ({
			studentName: row.studentName,
			degreeTitle: row.degreeTitle,
			issuerAddress: row.issuerAddress,
			email: row.email || undefined,
			expiryTimestamp: row.expiryTimestamp ? Number(row.expiryTimestamp) : 0
		}));

		const { tree, leaves, root } = buildMerkleTree(credentials);

		const prepared = credentials.map((credential, i) => ({
			credential,
			leaf: '0x' + leaves[i].toString('hex'),
			proof: tree.getHexProof(leaves[i])
		}));

		res.json({ merkleRoot: root, credentials: prepared });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Issuer Portal: Confirmation & Delivery Routes
app.post('/api/issuer/confirm-batch', async (req, res) => {
	try {
		const { merkleRoot, credentials } = req.body;

		if (!merkleRoot || !credentials || !Array.isArray(credentials)) {
			return res.status(400).json({ error: 'merkleRoot and credentials are required' });
		}

		const batch = await credentialRegistry.getBatch(merkleRoot);

		if (batch.issuer === '0x0000000000000000000000000000000000000000') {
			return res.status(400).json({ error: 'Batch not found on-chain. Has the transaction confirmed yet?' });
		}

		const results = [];
		const failedEmails = [];

		for (const item of credentials) {
			const { credential, leaf, proof } = item;

			const isValid = await credentialRegistry.verify(merkleRoot, leaf, proof);
			if (!isValid) {
				continue;
			}

			const pdfBytes = await generateCertificate(credential, merkleRoot, leaf, proof);
			let emailed = false;

			if (credential.email) {
				emailed = await sendWithRetry(credential.email, credential.studentName, pdfBytes);
				if (!emailed) {
					failedEmails.push({ studentName: credential.studentName, pdfBytes });
				}
			}

			results.push({ credential, leaf, proof, emailed });
		}

		let zipDownloadUrl = null;

		if (failedEmails.length > 0) {
			const zipFileName = `failed-certs-${Date.now()}.zip`;
			const zipPath = path.join(__dirname, 'temp-zips', zipFileName);

			await new Promise((resolve, reject) => {
				const output = fs.createWriteStream(zipPath);
				const archive = new ZipArchive({ zlib: { level: 9 } });

				output.on('close', resolve);
				archive.on('error', reject);
				archive.pipe(output);

				failedEmails.forEach(item => {
					archive.append(Buffer.from(item.pdfBytes), { name: `${item.studentName}-certificate.pdf` });
				});

				archive.finalize();
			});

			zipDownloadUrl = `/api/issuer/download-zip/${zipFileName}`;
		}

		res.json({ merkleRoot, issuer: batch.issuer, issued: results, zipDownloadUrl });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get('/api/issuer/download-zip/:filename', (req, res) => {
	const filePath = path.join(__dirname, 'temp-zips', req.params.filename);
	res.download(filePath);
});


// Issuer Portal: History Routes
app.get('/api/issuer/history', async (req, res) => {
	try {
		const { issuerAddress } = req.query;

		if (!issuerAddress) {
			return res.status(400).json({ error: 'issuerAddress query parameter is required' });
		}

		const filter = credentialRegistry.filters.BatchRegistered(null, issuerAddress);
		const events = await credentialRegistry.queryFilter(filter);

		const history = events.map(event => ({
			merkleRoot: event.args.merkleRoot,
			issuer: event.args.issuer,
			expiryTimestamp: event.args.expiryTimestamp.toString(),
			transactionHash: event.transactionHash,
			blockNumber: event.blockNumber
		}));

		res.json({ issuerAddress, batches: history });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get('/api/issuer/revocation-history', async (req, res) => {
	try {
		const { issuerAddress } = req.query;

		if (!issuerAddress) {
			return res.status(400).json({ error: 'issuerAddress query parameter is required' });
		}

		const filter = credentialRegistry.filters.CredentialRevoked(null, issuerAddress);
		const events = await credentialRegistry.queryFilter(filter);

		const history = events.map(event => ({
			leafHash: event.args.leafHash,
			revokedBy: event.args.revokedBy,
			transactionHash: event.transactionHash,
			blockNumber: event.blockNumber
		}));

		res.json({ issuerAddress, revoked: history });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Verifier Portal Route
app.get('/api/verify/:credentialId', async (req, res) => {
	try {
		const { merkleRoot, leaf, proof } = req.query;
		const proofArray = proof.split(',');

		const batch = await credentialRegistry.getBatch(merkleRoot);

		if (batch.issuer === '0x0000000000000000000000000000000000000000') {
			return res.json({ credentialId: req.params.credentialId, status: 'Not Found' });
		}

		const isRevoked = await credentialRegistry.isLeafRevoked(leaf);
		if (isRevoked) {
			return res.json({ credentialId: req.params.credentialId, status: 'Revoked' });
		}

		const isExpired = batch.expiryTimestamp !== 0n && Math.floor(Date.now() / 1000) > Number(batch.expiryTimestamp);
		if (isExpired) {
			return res.json({ credentialId: req.params.credentialId, status: 'Expired', expiredOn: batch.expiryTimestamp.toString() });
		}

		const isValid = await credentialRegistry.verify(merkleRoot, leaf, proofArray);
		if (!isValid) {
			return res.json({ credentialId: req.params.credentialId, status: 'Not Found' });
		}

		res.json({ credentialId: req.params.credentialId, status: 'Valid', issuer: batch.issuer });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// Health check
app.get('/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.listen(PORT, () => {
	console.log(`VerifyChain backend running on port ${PORT}`);
});
