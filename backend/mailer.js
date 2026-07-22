require('dotenv').config();

const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

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
	pdfBytes: { type: Buffer, required: true },
	attempts: { type: Number, default: 0 },
	status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
	nextAttemptAt: { type: Date, default: Date.now, index: true },
	lastError: { type: String, default: null }
}, { timestamps: true });

const EmailQueueItem = mongoose.model('EmailQueueItem', emailQueueSchema);

async function sendCertificateEmail(toEmail, studentName, pdfBytes) {
	const mailOptions = {
		from: process.env.EMAIL_USER,
		to: toEmail,
		subject: 'Your VerifyChain Credential',
		text: `Hi ${studentName}, your verified credential is attached.`,
		attachments: [
			{
				filename: `${studentName}-certificate.pdf`,
				content: Buffer.from(pdfBytes)
			}
		]
	};

	const info = await transporter.sendMail(mailOptions);
	return info;
}

function nextBackoffDelay(attempts) {
	return BASE_BACKOFF_MS * Math.pow(2, attempts);
}

async function sendWithRetry(toEmail, studentName, pdfBytes) {
	try {
		await sendCertificateEmail(toEmail, studentName, pdfBytes);
		return true;
	} catch (err) {
		try {
			await EmailQueueItem.create({
				toEmail,
				studentName,
				pdfBytes: Buffer.from(pdfBytes),
				attempts: 1,
				status: 'pending',
				nextAttemptAt: new Date(Date.now() + nextBackoffDelay(1)),
				lastError: err.message
			});
		} catch (dbErr) {
			console.error(`Failed to persist queued email for ${toEmail}:`, dbErr.message);
		}
		return false;
	}
}

async function processEmailQueue() {
	const dueItems = await EmailQueueItem.find({
		status: 'pending',
		nextAttemptAt: { $lte: new Date() }
	}).limit(20);

	for (const item of dueItems) {
		try {
			await sendCertificateEmail(item.toEmail, item.studentName, item.pdfBytes);
			item.status = 'sent';
			await item.save();
			console.log(`Queued email delivered on retry: ${item.toEmail} (attempt ${item.attempts + 1})`);
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
	if (queueIntervalHandle) return; // already running
	processEmailQueue().catch(err => console.error('Email queue processing error:', err.message));
	queueIntervalHandle = setInterval(() => {
		processEmailQueue().catch(err => console.error('Email queue processing error:', err.message));
	}, intervalMs);
}

module.exports = { sendCertificateEmail, sendWithRetry, processEmailQueue, startEmailQueueProcessor, EmailQueueItem };