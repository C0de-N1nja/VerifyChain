require('dotenv').config();

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

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

module.exports = { sendCertificateEmail };
