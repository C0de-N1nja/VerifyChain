require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');
const { ethers } = require('ethers');

const { credentialRegistry } = require('./blockchain.js');
const { buildMerkleTree } = require('./merkle.js');
const { startEmailQueueProcessor, EmailQueueItem } = require('./mailer.js');

// Fail fast if critical env vars are missing (prevents cryptic ethers errors at startup)
const REQUIRED_ENV = [
    'ZKSYNC_SEPOLIA_RPC',
    'GOVERNANCE_BOARD_ADDRESS',
    'CREDENTIAL_REGISTRY_ADDRESS'
];

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
    console.error('Fix: copy backend/.env.example to backend/.env and fill in real values.');
    process.exit(1);
}

// MONGOOSE SCHEMA
const credentialSchema = new mongoose.Schema({
    rollNumber: { type: String, required: true },
    studentName: { type: String, required: true },
    degreeTitle: { type: String, required: true },
    major: { type: String, default: 'N/A' },
    minor: { type: String, default: 'N/A' },
    honors: { type: String, default: 'N/A' },
    nationalId: { type: String, default: 'N/A' },
    campus: { type: String, default: 'Main Campus' },
    placeOfIssue: { type: String, default: 'N/A' },
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

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

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

// Health check (used by Render/uptime monitors; also shows DB state)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// 46-STUDENT CSV TEMPLATE ROUTE
app.get('/api/issuer/csv-template', (req, res) => {
    const header = 'rollNumber,studentName,degreeTitle,major,minor,honors,nationalId,campus,placeOfIssue,department,institutionName,issuerAddress,email,expiryTimestamp\n';
    const issuer = '0x19992c2DE1Da16b33bE1Aef78C0f99674A839E70';

    const students = [
        `G1F22UBSCS091,MUHAMMAD HAMZA AFZAL,BS Computer Science,Computer Science,N/A,3.45,35202-0000001-1,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs091@example.com,0`,
        `G1F22UBSCS093,AZKA TARIQ,BS Computer Science,Computer Science,N/A,3.52,35202-0000002-2,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs093@example.com,0`,
        `G1F22UBSCS094,MUSSA SHAHID,BS Computer Science,Computer Science,N/A,3.61,35202-0000003-3,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs094@example.com,0`,
        `G1F22UBSCS095,MUHAMMAD REHAN RASHID,BS Computer Science,Computer Science,N/A,3.02,35202-0000004-4,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs095@example.com,0`,
        `G1F22UBSCS097,ANAM BUKHARI,BS Computer Science,Computer Science,N/A,3.33,35202-0000005-5,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs097@example.com,0`,
        `G1F22UBSCS099,ABU BAKAR,BS Computer Science,Computer Science,N/A,3.88,35202-0000006-6,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs099@example.com,0`,
        `G1F22UBSCS101,FITTER FATIMA,BS Computer Science,Computer Science,N/A,3.15,35202-0000007-7,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs101@example.com,0`,
        `G1F22UBSCS102,ALEESHAH HAFEEZ,BS Computer Science,Computer Science,N/A,3.71,35202-0000008-8,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs102@example.com,0`,
        `G1F22UBSCS103,HOORIA SHAKEEL,BS Computer Science,Computer Science,N/A,3.29,35202-0000009-9,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs103@example.com,0`,
        `G1F22UBSCS104,ROVAIBA,BS Computer Science,Computer Science,N/A,3.44,35202-0000010-0,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs104@example.com,0`,
        `G1F22UBSCS105,FAJAR IRFAN,BS Computer Science,Computer Science,N/A,3.60,35202-0000011-1,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs105@example.com,0`,
        `G1F22UBSCS109,LAIBA IRFAN,BS Computer Science,Computer Science,N/A,3.50,35202-0000012-2,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs109@example.com,0`,
        `G1F22UBSCS110,TANZILA SHERAZ,BS Computer Science,Computer Science,N/A,3.22,35202-0000013-3,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs110@example.com,0`,
        `G1F22UBSCS113,UM E KALSOOM,BS Computer Science,Computer Science,N/A,3.77,35202-0000014-4,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs113@example.com,0`,
        `G1F22UBSCS115,ZAIN KHALID,BS Computer Science,Computer Science,N/A,3.41,35202-0000015-5,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs115@example.com,0`,
        `G1F22UBSCS116,MUHAMMAD AHMAD NAVEED,BS Computer Science,Computer Science,N/A,3.85,35202-0000016-6,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs116@example.com,0`,
        `G1F22UBSCS117,MUHAMMAD RIAZ ARHAM,BS Computer Science,Computer Science,N/A,3.55,35202-0000017-7,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs117@example.com,0`,
        `G1F22UBSCS118,HAFSA MUSTAFA,BS Computer Science,Computer Science,N/A,3.68,35202-0000018-8,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs118@example.com,0`,
        `G1F22UBSCS119,HAMZA ASGHAR,BS Computer Science,Computer Science,N/A,3.14,35202-0000019-9,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs119@example.com,0`,
        `G1F22UBSCS120,MUHAMMAD HUZAIFA IDREES,BS Computer Science,Computer Science,N/A,3.90,35202-0000020-0,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs120@example.com,0`,
        `G1F22UBSCS121,MUHAMMAD SARMAD SHAFIQ,BS Computer Science,Computer Science,N/A,3.47,35202-0000021-1,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs121@example.com,0`,
        `G1F22UBSCS122,MUHAMMAD AZAN,BS Computer Science,Computer Science,N/A,3.31,35202-0000022-2,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs122@example.com,0`,
        `G1F22UBSCS125,AYESHA IMRAN,BS Computer Science,Computer Science,N/A,3.59,35202-0000023-3,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs125@example.com,0`,
        `G1F22UBSCS126,KINZA ZAFAR,BS Computer Science,Computer Science,N/A,3.73,35202-0000024-4,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs126@example.com,0`,
        `G1F22UBSCS127,HARAM YOUNAS,BS Computer Science,Computer Science,N/A,3.21,35202-0000025-5,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs127@example.com,0`,
        `G1F22UBSCS129,AROOBA AMJAD,BS Computer Science,Computer Science,N/A,3.49,35202-0000026-6,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs129@example.com,0`,
        `G1F22UBSCS130,MUHAMMAD QASIM,BS Computer Science,Computer Science,N/A,3.82,35202-0000027-7,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs130@example.com,0`,
        `G1F22UBSCS131,MUHAMMAD SAAD,BS Computer Science,Computer Science,N/A,3.38,35202-0000028-8,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs131@example.com,0`,
        `G1F22UBSCS132,MADIA SOHAIL,BS Computer Science,Computer Science,N/A,3.65,35202-0000029-9,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs132@example.com,0`,
        `G1F22UBSCS134,MUHAMMAD ALI,BS Computer Science,Computer Science,N/A,3.27,35202-0000030-0,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs134@example.com,0`,
        `G1F22UBSCS135,RANA MUHAMMAD ZAIN UL ABIDEEN,BS Computer Science,Computer Science,N/A,3.56,35202-0000031-1,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs135@example.com,0`,
        `G1F22UBSCS212,USWA WASEEM,BS Computer Science,Computer Science,N/A,3.43,35202-0000032-2,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs212@example.com,0`,
        `G1F22UBSCS213,SUBHAN TAHIR,BS Computer Science,Computer Science,N/A,3.78,35202-0000033-3,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs213@example.com,0`,
        `G1F22UBSCS215,IMAN FATIMA,BS Computer Science,Computer Science,N/A,3.36,35202-0000034-4,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs215@example.com,0`,
        `G1F22UBSCS216,AYESHA IJAZ,BS Computer Science,Computer Science,N/A,3.92,35202-0000035-5,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs216@example.com,0`,
        `G1F22UBSCS217,FARHAT ULLAH,BS Computer Science,Computer Science,N/A,3.58,35202-0000036-6,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs217@example.com,0`,
        `G1F22UBSCS218,LAIBA ARSHAD,BS Computer Science,Computer Science,N/A,3.24,35202-0000037-7,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs218@example.com,0`,
        `G1F22UBSCS219,MUHAMMAD ALI ARIF,BS Computer Science,Computer Science,N/A,3.66,35202-0000038-8,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs219@example.com,0`,
        `G1F22UBSCS220,USMAN ALI,BS Computer Science,Computer Science,N/A,3.39,35202-0000039-9,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs220@example.com,0`,
        `G1F22UBSCS221,AYESHA SADIQA,BS Computer Science,Computer Science,N/A,3.95,35202-0000040-0,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs221@example.com,0`,
        `G1F22UBSCS247,SYED AWAB HAIDER,BS Computer Science,Computer Science,N/A,3.72,35202-0000041-1,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs247@example.com,0`,
        `G1F22UBSCS248,MUHAMMAD SAMI,BS Computer Science,Computer Science,N/A,3.48,35202-0000042-2,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs248@example.com,0`,
        `G1F22UBSCS249,MOMINA SHAHID,BS Computer Science,Computer Science,N/A,3.89,35202-0000043-3,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs249@example.com,0`,
        `G1F22UBSCS250,MUHAMMAD BILAL,BS Computer Science,Computer Science,N/A,3.16,35202-0000044-4,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs250@example.com,0`,
        `G1F22UBSCS251,MUHAMMAD SHOAIB SALEEM,BS Computer Science,Computer Science,N/A,3.63,35202-0000045-5,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs251@example.com,0`,
        `G1F22UBSCS257,ABDUL MOIZ,BS Computer Science,Computer Science,N/A,3.40,35202-0000046-6,Main Campus,Lahore,Faculty of Computing,University of Central Punjab,${issuer},g1f22ubscs257@example.com,0`
    ];

    const csvContent = header + students.join('\n') + '\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="verifychain-class-template.csv"');
    res.send(csvContent);
});

// BACKEND VALIDATION FUNCTION
function validateCredentialData(credential) {
    const errors = [];

    if (!/^[a-zA-Z\s]+$/.test(credential.studentName || '')) {
        errors.push("Student Name must contain only letters and spaces.");
    }

    if (!/^[a-zA-Z\s.&\/-]+$/.test(credential.degreeTitle || '')) {
        errors.push("Degree Title contains invalid characters.");
    }

    if (credential.major && credential.major !== 'N/A' && !/^[a-zA-Z\s.&\/-]+$/.test(credential.major)) {
        errors.push("Major contains invalid characters.");
    }

    if (credential.minor && credential.minor !== 'N/A' && !/^[a-zA-Z\s.&\/-]+$/.test(credential.minor)) {
        errors.push("Minor contains invalid characters.");
    }

    if (credential.honors && credential.honors !== 'N/A' && !/^([0-3]\.[0-9]{1,2}|4\.0{1,2}|[a-zA-Z\s\/]+)$/.test(credential.honors)) {
        errors.push("Honors/CGPA format is invalid (e.g., 3.50 or First Division).");
    }

    if (credential.campus && credential.campus !== 'N/A' && !/^[a-zA-Z\s]+$/.test(credential.campus)) {
        errors.push("Campus must contain only letters and spaces.");
    }

    if (credential.placeOfIssue && credential.placeOfIssue !== 'N/A' && !/^[a-zA-Z\s,]+$/.test(credential.placeOfIssue)) {
        errors.push("Place of Issue contains invalid characters.");
    }

    return errors;
}

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
            major: c.major ? c.major.trim() : 'N/A',
            minor: c.minor ? c.minor.trim() : 'N/A',
            honors: c.honors ? c.honors.trim() : 'N/A',
            nationalId: c.nationalId ? c.nationalId.trim() : 'N/A',
            campus: c.campus ? c.campus.trim() : 'Main Campus',
            placeOfIssue: c.placeOfIssue ? c.placeOfIssue.trim() : 'N/A',
            department: c.department ? c.department.trim() : 'General',
            issuerAddress: ethers.getAddress(c.issuerAddress.trim()),
            email: c.email ? c.email.trim() : undefined,
            expiryTimestamp: c.expiryTimestamp ? Number(c.expiryTimestamp) : 0,
            institutionName: c.institutionName ? c.institutionName.trim() : ''
        }));

        for (let i = 0; i < formattedCredentials.length; i++) {
            const errs = validateCredentialData(formattedCredentials[i]);
            if (errs.length > 0) {
                return res.status(400).json({ error: `Validation failed for record ${i + 1}: ${errs.join(' ')}` });
            }
        }

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

app.post('/api/issuer/prepare-batch-csv', upload.any(), async (req, res) => {
    try {
        let rawRecords = null;
        const file = req.files && req.files.length > 0 ? req.files[0] : null;

        if (file) {
            // Multipart upload: parse the CSV text (strip Excel BOM if present)
            const csvText = file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
            rawRecords = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
        } else if (Array.isArray(req.body?.credentials) && req.body.credentials.length > 0) {
            // Fallback: frontend already parsed the CSV and sent JSON
            rawRecords = req.body.credentials;
        } else {
            return res.status(400).json({ error: 'CSV file is required' });
        }

        if (rawRecords.length === 0) {
            return res.status(400).json({ error: 'CSV file contains no records' });
        }

        const formattedCredentials = rawRecords.map(c => ({
            rollNumber: c.rollNumber ? String(c.rollNumber).trim() : 'N/A',
            studentName: c.studentName ? c.studentName.trim() : '',
            degreeTitle: c.degreeTitle ? c.degreeTitle.trim() : '',
            major: c.major ? c.major.trim() : 'N/A',
            minor: c.minor ? c.minor.trim() : 'N/A',
            honors: c.honors ? c.honors.trim() : 'N/A',
            nationalId: c.nationalId ? c.nationalId.trim() : 'N/A',
            campus: c.campus ? c.campus.trim() : 'Main Campus',
            placeOfIssue: c.placeOfIssue ? c.placeOfIssue.trim() : 'N/A',
            department: c.department ? c.department.trim() : 'General',
            issuerAddress: c.issuerAddress ? ethers.getAddress(c.issuerAddress.trim()) : '',
            email: c.email ? c.email.trim() : undefined,
            expiryTimestamp: c.expiryTimestamp ? Number(c.expiryTimestamp) : 0,
            institutionName: c.institutionName ? c.institutionName.trim() : ''
        }));

        for (let i = 0; i < formattedCredentials.length; i++) {
            const c = formattedCredentials[i];
            if (!c.studentName || !c.degreeTitle || !c.issuerAddress) {
                return res.status(400).json({ error: `Record ${i + 1}: studentName, degreeTitle and issuerAddress are required` });
            }
            const errs = validateCredentialData(c);
            if (errs.length > 0) {
                return res.status(400).json({ error: `Validation failed for record ${i + 1}: ${errs.join(' ')}` });
            }
        }

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

        const existingRecord = await Credential.findOne({ issuerAddress: batch.issuer.toLowerCase() }).sort({ issuedAt: -1 });

        if (existingRecord && existingRecord.institutionName) {
            const expectedName = existingRecord.institutionName;
            const mismatch = rawCredentials.find(c => (c.institutionName || '').trim() !== expectedName);
            if (mismatch) {
                return res.status(403).json({
                    error: `Unauthorized: This wallet is permanently bound to '${expectedName}' and cannot issue for other institutions.`
                });
            }
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
                    major: credential.major || 'N/A',
                    minor: credential.minor || 'N/A',
                    honors: credential.honors || 'N/A',
                    nationalId: credential.nationalId || 'N/A',
                    campus: credential.campus || 'Main Campus',
                    placeOfIssue: credential.placeOfIssue || 'N/A',
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
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(__dirname, 'temp-zips', safeName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
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

// Dynamic Institution Lookup
app.get('/api/issuer/details', async (req, res) => {
    try {
        const { address } = req.query;
        if (!address) return res.status(400).json({ error: 'Address is required' });

        const latestCredential = await Credential.findOne({ issuerAddress: address.toLowerCase() }).sort({ issuedAt: -1 });

        if (latestCredential) {
            res.json({ institutionName: latestCredential.institutionName });
        } else {
            res.json({ institutionName: null });
        }
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
            major: credentialDoc?.major || null,
            minor: credentialDoc?.minor || null,
            honors: credentialDoc?.honors || null,
            nationalId: (() => {
                const rawId = credentialDoc?.nationalId || '';
                const digitsOnly = rawId.replace(/\D/g, '');
                return digitsOnly ? `****-****-${digitsOnly.slice(-4)}` : null;
            })(),
            campus: credentialDoc?.campus || null,
            placeOfIssue: credentialDoc?.placeOfIssue || null,
            institutionName: credentialDoc?.institutionName || null,
            issuedAt: credentialDoc?.issuedAt || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`VerifyChain backend running on port ${PORT}`);
});