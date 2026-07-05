const { credentialRegistry } = require('./blockchain.js');
const { buildMerkleTree } = require('./merkle.js');
const { generateCertificate } = require('./certificate.js');
const { sendCertificateEmail } = require('./mailer.js');

const express = require('express');
const cors = require('cors');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---- Issuer Portal routes ----
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

app.get('/api/issuer/history', (req, res) => {
  // TODO: fetch past batches for this issuer from chain events
  res.json({ message: 'issuer history placeholder' });
});

// ---- Verifier Portal routes ----
app.get('/api/verify/:credentialId', async (req, res) => {
	try {
		const { merkleRoot, leaf, proof } = req.query;
		const proofArray = proof.split(',');

		const isValid = await credentialRegistry.verify(merkleRoot, leaf, proofArray);

		res.json({ credentialId: req.params.credentialId, valid: isValid });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// ---- Health check ----
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`VerifyChain backend running on port ${PORT}`);
});
