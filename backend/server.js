require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');
const { ethers } = require('ethers');

const { credentialRegistry } = require('./blockchain.js');
const { buildMerkleTree } = require('./merkle.js');
const { generateCertificate } = require('./certificate.js');
const { sendCertificateEmail } = require('./mailer.js');
const { generateCertificate } = require('./certificate.js');
const { sendWithRetry, startEmailQueueProcessor } = require('./mailer.js');

// MONGOOSE SCHEMA
const credentialSchema = new mongoose.Schema({
	studentName: { type: String, required: true },
	degreeTitle: { type: String, required: true },
	email: { type: String, required: false },
	issuerAddress: { type: String, required: true, lowercase: true, index: true },
	merkleRoot: { type: String, required: true, lowercase: true, index: true },
	leafHash: { type: String, required: true, unique: true, lowercase: true },
	proof: { type: Array, default: [] },
	revoked: { type: Boolean, default: false },
	revokedAt: { type: Date, default: null },
	issuedAt: { type: Date, default: Date.now }
}, { timestamps: true });

credentialSchema.index({ issuerAddress: 1, issuedAt: -1 });

const Credential = mongoose.model('Credential', credentialSchema);

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Database Connection
async function connectDB() {
	try {
		await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/verifychain');
		console.log('MongoDB connected');

		startEmailQueueProcessor();
		console.log('Email retry queue processor started');
	} catch (err) {
		console.error('MongoDB connection failed:', err.message);
		process.exit(1);
	}
}
connectDB();

// 25-STUDENT CSV TEMPLATE ROUTE
app.get('/api/issuer/csv-template', (req, res) => {
	const header = 'studentName,degreeTitle,issuerAddress,email,expiryTimestamp\n';
	const issuer = '0x19992c2DE1Da16b33bE1Aef78C0f99674A839E70';

	const students = [
		`Ali Raza,BS Computer Science,${issuer},ali.raza@example.com,0`,
		`Sara Khan,MS Data Science,${issuer},sara.khan@example.com,0`,
		`Usman Ahmed,BS Software Engineering,${issuer},usman.ahmed@example.com,0`,
		`Fatima Zahra,BS Information Technology,${issuer},fatima.zahra@example.com,0`,
		`Hamza Malik,MS Cybersecurity,${issuer},hamza.malik@example.com,0`,
		`Ayesha Bibi,BS Artificial Intelligence,${issuer},ayesha.bibi@example.com,0`,
		`Bilal Hassan,BS Computer Science,${issuer},bilal.hassan@example.com,0`,
		`Zainab Omer,BS Software Engineering,${issuer},zainab.omer@example.com,0`,
		`Mustafa Ali,MS Data Science,${issuer},mustafa.ali@example.com,0`,
		`Maryam Nawaz,BS Information Technology,${issuer},maryam.nawaz@example.com,0`,
		`Tariq Jameel,BS Electrical Engineering,${issuer},tariq.jameel@example.com,0`,
		`Sana Sheikh,MS Software Engineering,${issuer},sana.sheikh@example.com,0`,
		`Omer Farooq,BS Computer Science,${issuer},omer.farooq@example.com,0`,
		`Hassan Raza,BS Artificial Intelligence,${issuer},hassan.raza@example.com,0`,
		`Khadija Bibi,MS Cybersecurity,${issuer},khadija.bibi@example.com,0`,
		`Asadullah Khan,BS Software Engineering,${issuer},asad.khan@example.com,0`,
		`Noreen Fatima,BS Information Technology,${issuer},noreen.fatima@example.com,0`,
		`Waqas Saeed,MS Computer Science,${issuer},waqas.saeed@example.com,0`,
		`Zubaida Khatoon,BS Data Analytics,${issuer},zubaida.k@example.com,0`,
		`Imran Abbasi,BS Computer Science,${issuer},imran.abbasi@example.com,0`,
		`Shahid Iqbal,MS Artificial Intelligence,${issuer},shahid.iqbal@example.com,0`,
		`Rabia Basri,BS Software Engineering,${issuer},rabia.basri@example.com,0`,
		`Daniyal Muneer,BS Information Technology,${issuer},daniyal.m@example.com,0`,
		`Areeba Tariq,MS Data Science,${issuer},areeba.tariq@example.com,0`,
		`Zohaib Shah,BS Computer Science,${issuer},zohaib.shah@example.com,0`
	];

	const csvContent = header + students.join('\n') + '\n';

	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', 'attachment; filename="verifychain-25-students-template.csv"');
	res.send(csvContent);
});

app.post('/api/issuer/prepare-batch', (req, res) => {
	try {
		const { credentials } = req.body;

		if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
			return res.status(400).json({ error: 'credentials array is required' });
		}

		const formattedCredentials = credentials.map(c => ({
			studentName: c.studentName.trim(),
			degreeTitle: c.degreeTitle.trim(),
			issuerAddress: ethers.getAddress(c.issuerAddress.trim()),
			email: c.email ? c.email.trim() : undefined,
			expiryTimestamp: c.expiryTimestamp ? Number(c.expiryTimestamp) : 0
		}));

		const { tree, leaves, root } = buildMerkleTree(formattedCredentials);

		const prepared = formattedCredentials.map((credential, i) => ({
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
			studentName: row.studentName.trim(),
			degreeTitle: row.degreeTitle.trim(),
			issuerAddress: ethers.getAddress(row.issuerAddress.trim()),
			email: row.email ? row.email.trim() : undefined,
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
				console.warn(`Proof verification returned false for leaf: ${leaf}`);
				continue;
			}

			try {
				await Credential.create({
					studentName: credential.studentName,
					degreeTitle: credential.degreeTitle,
					email: credential.email || undefined,
					issuerAddress: batch.issuer,
					merkleRoot: merkleRoot,
					leafHash: leaf,
					proof: proof || []
				});
			} catch (dbErr) {
				if (dbErr.code === 11000) {
					console.warn(`Credential ${leaf} already indexed, skipping duplicate write.`);
				} else {
					console.error(`Mongo write failed for ${leaf}:`, dbErr.message);
				}
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

			if (!fs.existsSync(path.join(__dirname, 'temp-zips'))) {
				fs.mkdirSync(path.join(__dirname, 'temp-zips'));
			}

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

app.post('/api/issuer/confirm-revocation', async (req, res) => {
	try {
		const { leafHash, merkleRoot } = req.body;

		if (!leafHash || !merkleRoot) {
			return res.status(400).json({ error: 'leafHash and merkleRoot are required' });
		}

		const isRevoked = await credentialRegistry.isLeafRevoked(leafHash);

		if (!isRevoked) {
			return res.status(400).json({ error: 'Leaf is not revoked on-chain. Has the transaction confirmed yet?' });
		}

		try {
			await Credential.findOneAndUpdate(
				{ leafHash: leafHash.toLowerCase() },
				{ revoked: true, revokedAt: new Date() }
			);
		} catch (dbErr) {
			console.error(`Mongo update failed for revoked leaf ${leafHash}:`, dbErr.message);
		}

		res.json({ leafHash, merkleRoot, revoked: true });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.get('/api/issuer/download-zip/:filename', (req, res) => {
	const filePath = path.join(__dirname, 'temp-zips', req.params.filename);
	res.download(filePath);
});

app.get('/api/issuer/credentials', async (req, res) => {
	try {
		const { issuerAddress, merkleRoot } = req.query;

		if (!issuerAddress && !merkleRoot) {
			return res.status(400).json({ error: 'issuerAddress or merkleRoot query parameter is required' });
		}

		const filter = {};
		if (issuerAddress) filter.issuerAddress = issuerAddress.toLowerCase();
		if (merkleRoot) filter.merkleRoot = merkleRoot.toLowerCase();

		const records = await Credential.find(filter)
			.select('studentName degreeTitle leafHash merkleRoot proof revoked revokedAt issuedAt -_id')
			.sort({ issuedAt: -1 });

		res.json({ credentials: records });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
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
		const proofArray = proof && proof.trim().length > 0 ? proof.split(',') : [];

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