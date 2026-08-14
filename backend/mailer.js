require('dotenv').config();

const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { generateCertificate } = require('./certificate.js');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60 * 1000;

const emailQueueSchema = new mongoose.Schema({
    toEmail: { type: String, required: true },
    studentName: { type: String, required: true },
    credential: { type: Object, required: true },
    merkleRoot: { type: String, required: true },
    leaf: { type: String, required: true },
    proof: { type: Array, required: true },
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: null }
}, { timestamps: true });

const EmailQueueItem = mongoose.model('EmailQueueItem', emailQueueSchema);

async function sendCertificateEmail(item) {
    // Generate PDF right before sending
    const pdfBytes = await generateCertificate(item.credential, item.merkleRoot, item.leaf, item.proof);
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: item.toEmail,
        subject: 'Your VerifyChain Credential',
        text: `Hi ${item.studentName}, your verified credential is attached.`,
        attachments: [
            {
                filename: `${item.studentName}-certificate.pdf`,
                content: Buffer.from(pdfBytes)
            }
        ]
    };

    return await transporter.sendMail(mailOptions);
}

function nextBackoffDelay(attempts) {
    return BASE_BACKOFF_MS * Math.pow(2, attempts);
}

async function processEmailQueue() {
    const dueItems = await EmailQueueItem.find({
        status: 'pending',
        nextAttemptAt: { $lte: new Date() }
    }).limit(100);

    for (const item of dueItems) {
        try {
            await sendCertificateEmail(item);
            item.status = 'sent';
            await item.save();
            console.log(`Queued email delivered: ${item.toEmail}`);
        } catch (err) {
            item.attempts += 1;
            item.lastError = err.message;

            if (item.attempts >= MAX_ATTEMPTS) {
                item.status = 'failed';
                console.error(`Queued email permanently failed after ${item.attempts} attempts: ${item.toEmail}`);
            } else {
                item.nextAttemptAt = new Date(Date.now() + nextBackoffDelay(item.attempts));
            }
            await item.save();
        }
    }
}

let queueIntervalHandle = null;

function startEmailQueueProcessor(intervalMs = 60 * 1000) {
    if (queueIntervalHandle) return;
    console.log('Starting background email processor...');
    processEmailQueue().catch(err => console.error('Email queue processing error:', err.message));
    queueIntervalHandle = setInterval(() => {
        processEmailQueue().catch(err => console.error('Email queue processing error:', err.message));
    }, intervalMs);
}

module.exports = { sendCertificateEmail, processEmailQueue, startEmailQueueProcessor, EmailQueueItem };