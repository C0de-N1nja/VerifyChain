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
const { sendWithRetry, startEmailQueueProcessor, EmailQueueItem } = require('./mailer.js');

// MONGOOSE SCHEMA
const credentialSchema = new mongoose.Schema({
	rollNumber: { type: String, default: 'N/A' },
    studentName: { type: String, required: true },
	degreeTitle: { type: String, required: true },
	department: { type: String, required: true, default: 'General' },
	email: { type: String, required: false },
	issuerAddress: { type: String, required: true, lowercase: true, index: true },
	merkleRoot: { type: String, required: true, lowercase: true, index: true },
	leafHash: { type: String, required: true, unique: true, lowercase: true },
	proof: { type: Array, default: [] },
	revoked: { type: Boolean, default: false },
	revokedAt: { type: Date, default: null },
	issuedAt: { type: Date, default: Date.now },
	institutionName: { type: String, default: '' },
}, { timestamps: true });

credentialSchema.index({ issuerAddress: 1, issuedAt: -1 });

const Credential = mongoose.model('Credential', credentialSchema);

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

// Increased limit for 1000+ record bulk uploads
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database Connection & Queue Processor Startup
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

// 46-STUDENT CSV TEMPLATE ROUTE
app.get('/api/issuer/csv-template', (req, res) => {
	const header = 'rollNumber,studentName,degreeTitle,department,institutionName,issuerAddress,email,expiryTimestamp\n';
	const issuer = '0x19992c2DE1Da16b33bE1Aef78C0f99674A839E70';

	const students = [
		`G1F22UBSCS091,MUHAMMAD HAMZA AFZAL,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs091@example.com,0`,
		`G1F22UBSCS093,AZKA TARIQ,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs093@example.com,0`,
		`G1F22UBSCS094,MUSSA SHAHID,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs094@example.com,0`,
		`G1F22UBSCS095,MUHAMMAD REHAN RASHID,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs095@example.com,0`,
		`G1F22UBSCS097,ANAM BUKHARI,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs097@example.com,0`,
		`G1F22UBSCS099,ABU BAKAR,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs099@example.com,0`,
		`G1F22UBSCS101,FITTER FATIMA,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs101@example.com,0`,
		`G1F22UBSCS102,ALEESHAH HAFEEZ,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs102@example.com,0`,
		`G1F22UBSCS103,HOORIA SHAKEEL,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs103@example.com,0`,
		`G1F22UBSCS104,ROVAIBA,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs104@example.com,0`,
		`G1F22UBSCS105,FAJAR IRFAN,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs105@example.com,0`,
		`G1F22UBSCS109,LAIBA IRFAN,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs109@example.com,0`,
		`G1F22UBSCS110,TANZILA SHERAZ,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs110@example.com,0`,
		`G1F22UBSCS113,UM E KALSOOM,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs113@example.com,0`,
		`G1F22UBSCS115,ZAIN KHALID,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs115@example.com,0`,
		`G1F22UBSCS116,MUHAMMAD AHMAD NAVEED,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs116@example.com,0`,
		`G1F22UBSCS117,MUHAMMAD RIAZ ARHAM,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs117@example.com,0`,
		`G1F22UBSCS118,HAFSA MUSTAFA,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs118@example.com,0`,
		`G1F22UBSCS119,HAMZA ASGHAR,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs119@example.com,0`,
		`G1F22UBSCS120,MUHAMMAD HUZAIFA IDREES,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs120@example.com,0`,
		`G1F22UBSCS121,MUHAMMAD SARMAD SHAFIQ,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs121@example.com,0`,
		`G1F22UBSCS122,MUHAMMAD AZAN,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs122@example.com,0`,
		`G1F22UBSCS125,AYESHA IMRAN,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs125@example.com,0`,
		`G1F22UBSCS126,KINZA ZAFAR,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs126@example.com,0`,
		`G1F22UBSCS127,HARAM YOUNAS,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs127@example.com,0`,
		`G1F22UBSCS129,AROOBA AMJAD,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs129@example.com,0`,
		`G1F22UBSCS130,MUHAMMAD QASIM,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs130@example.com,0`,
		`G1F22UBSCS131,MUHAMMAD SAAD,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs131@example.com,0`,
		`G1F22UBSCS132,MADIA SOHAIL,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs132@example.com,0`,
		`G1F22UBSCS134,MUHAMMAD ALI,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs134@example.com,0`,
		`G1F22UBSCS135,RANA MUHAMMAD ZAIN UL ABIDEEN,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs135@example.com,0`,
		`G1F22UBSCS212,USWA WASEEM,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs212@example.com,0`,
		`G1F22UBSCS213,SUBHAN TAHIR,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs213@example.com,0`,
		`G1F22UBSCS215,IMAN FATIMA,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs215@example.com,0`,
		`G1F22UBSCS216,AYESHA IJAZ,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs216@example.com,0`,
		`G1F22UBSCS217,FARHAT ULLAH,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs217@example.com,0`,
		`G1F22UBSCS218,LAIBA ARSHAD,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs218@example.com,0`,
		`G1F22UBSCS219,MUHAMMAD ALI ARIF,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs219@example.com,0`,
		`G1F22UBSCS220,USMAN ALI,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs220@example.com,0`,
		`G1F22UBSCS221,AYESHA SADIQA,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs221@example.com,0`,
		`G1F22UBSCS247,SYED AWAB HAIDER,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs247@example.com,0`,
		`G1F22UBSCS248,MUHAMMAD SAMI,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs248@example.com,0`,
		`G1F22UBSCS249,MOMINA SHAHID,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs249@example.com,0`,
		`G1F22UBSCS250,MUHAMMAD BILAL,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs250@example.com,0`,
		`G1F22UBSCS251,MUHAMMAD SHOAIB SALEEM,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs251@example.com,0`,
		`G1F22UBSCS257,ABDUL MOIZ,BS Computer Science,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs257@example.com,0`
	];

	const csvContent = header + students.join('\n') + '\n';

	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', 'attachment; filename="verifychain-class-template.csv"');
	res.send(csvContent);
});

app.post('/api/issuer/prepare-batch', (req, res) => {
	try {
		const { credentials } = req.body;

		if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
			return res.status(400).json({ error: 'credentials array is required' });
		}

		const formattedCredentials = credentials.map(c => ({
			rollNumber: c.rollNumber ? c.rollNumber.trim() : 'N/A',
			studentName: c.studentName.trim(),
			degreeTitle: c.degreeTitle.trim(),
			department: c.department ? c.department.trim() : 'General',
			issuerAddress: ethers.getAddress(c.issuerAddress.trim()),
			email: c.email ? c.email.trim() : undefined,
			expiryTimestamp: c.expiryTimestamp ? Number(c.expiryTimestamp) : 0,
			institutionName: c.institutionName ? c.institutionName.trim() : ''
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
			rollNumber: row.rollNumber ? row.rollNumber.trim() : 'N/A',
			studentName: row.studentName.trim(),
			degreeTitle: row.degreeTitle.trim(),
			department: row.department ? row.department.trim() : 'General',
			issuerAddress: ethers.getAddress(row.issuerAddress.trim()),
			email: row.email ? row.email.trim() : undefined,
			expiryTimestamp: row.expiryTimestamp ? Number(row.expiryTimestamp) : 0,
			institutionName: row.institutionName ? row.institutionName.trim() : ''
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

		const rawCredentials = credentials.map(item => item.credential);
		const { tree, leaves, root } = buildMerkleTree(rawCredentials);

		if (root !== merkleRoot) {
			return res.status(400).json({ error: 'Merkle root mismatch. The credentials do not match the issued batch.' });
		}

		const results = [];

		for (let i = 0; i < rawCredentials.length; i++) {
			const credential = rawCredentials[i];
			const leaf = '0x' + leaves[i].toString('hex');
			const proof = tree.getHexProof(leaves[i]);

			let alreadyExists = false;
			try {
				await Credential.create({
                    rollNumber: credential.rollNumber || 'N/A',
					studentName: credential.studentName,
					degreeTitle: credential.degreeTitle,
					department: credential.department || 'General',
					email: credential.email || undefined,
					issuerAddress: batch.issuer,
					merkleRoot: merkleRoot,
					leafHash: leaf,
					proof: proof,
					institutionName: credential.institutionName || ''
				});
			} catch (dbErr) {
				if (dbErr.code === 11000) {
					alreadyExists = true;
				} else {
					console.error(`Mongo write failed for ${leaf}:`, dbErr.message);
				}
			}

			if (!alreadyExists) {
				let emailed = false;

				if (credential.email) {
					try {
						// Queue email in background (NO PDF GENERATION HERE)
						await EmailQueueItem.create({
							toEmail: credential.email,
							studentName: credential.studentName,
							credential: credential,
							merkleRoot: merkleRoot,
							leaf: leaf,
							proof: proof,
							attempts: 0,
							status: 'pending',
							nextAttemptAt: new Date()
						});
						emailed = 'queued';
					} catch (queueErr) {
						console.error(`Failed to queue email for ${leaf}:`, queueErr.message);
					}
				}

				results.push({ credential, leaf, proof, emailed });
			} else {
				results.push({ credential, leaf, proof, emailed: false, skipped: true });
			}
		}

		// Respond instantly. The background worker handles the PDFs and SMTP.
		res.json({ merkleRoot, issuer: batch.issuer, issued: results, zipDownloadUrl: null });
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
			await Credential.updateOne(
				{ leafHash: leafHash },
				{ $set: { revoked: true, revokedAt: new Date() } }
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
			.select('studentName degreeTitle department institutionName leafHash merkleRoot proof revoked revokedAt issuedAt -_id')
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

		const credentialDoc = await Credential.findOne({ leafHash: leaf });

		res.json({
			credentialId: req.params.credentialId,
			status: 'Valid',
			issuer: batch.issuer,
			studentName: credentialDoc?.studentName || null,
			degreeTitle: credentialDoc?.degreeTitle || null,
			department: credentialDoc?.department || null,
			institutionName: credentialDoc?.institutionName || null,
			issuedAt: credentialDoc?.issuedAt || null
		});
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