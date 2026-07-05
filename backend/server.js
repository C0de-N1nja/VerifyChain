require('dotenv').config();

const { credentialRegistry } = require('./blockchain.js');
const { buildMerkleTree } = require('./merkle.js');
const { generateCertificate } = require('./certificate.js');
const { sendCertificateEmail } = require('./mailer.js');

const express = require('express');
const cors = require('cors');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Issuer Portal routes
app.post('/api/issuer/issue', async (req, res) => {
	try {
		const { credentials, expiryTimestamp } = req.body;

		if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
			return res.status(400).json({ error: 'credentials array is required' });
		}

		const { tree, leaves, root } = buildMerkleTree(credentials);

		const tx = await credentialRegistry.registerBatch(root, expiryTimestamp || 0);
		const receipt = await tx.wait();

		const results = [];

		for (let i = 0; i < credentials.length; i++) {
			const credential = credentials[i];
			const leaf = '0x' + leaves[i].toString('hex');
			const proof = tree.getHexProof(leaves[i]);

			const pdfBytes = await generateCertificate(credential, root, leaf, proof);

			if (credential.email) {
				await sendCertificateEmail(credential.email, credential.studentName, pdfBytes);
			}

			results.push({ credential, leaf, proof, emailed: !!credential.email });
		}

		res.json({
			merkleRoot: root,
			transactionHash: receipt.hash,
			issued: results
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

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

// Verifier Portal routes
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
