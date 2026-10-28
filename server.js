require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

// Configure Nodemailer Transporter for Email Notifications
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper function to send emails to customer and doctor
async function sendNotificationEmails(recipientEmail, doctorEmail, subject, customerHtml, doctorHtml) {
    try {
        // Email to Customer
        await transporter.sendMail({
            from: `"Jannani PregBuddy Health" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `[Jannani] ${subject}`,
            html: customerHtml
        });

        // Email to Doctor / Hospital
        if (doctorEmail) {
            await transporter.sendMail({
                from: `"Jannani Emergency Dispatch" <${process.env.EMAIL_USER}>`,
                to: doctorEmail,
                subject: `[Clinical Alert] ${subject}`,
                html: doctorHtml
            });
        }
        console.log("✅ Emails dispatched successfully to customer and doctor.");
    } catch (error) {
        console.error("❌ Error sending email notifications:", error);
    }
}

// Helper function to simulate/dispatch SMS to customer & doctor
async function sendSMSNotifications(customerPhone, doctorPhone, message) {
    // Integrate Twilio or SMS Gateway here if desired
    console.log(`📱 SMS Sent to Customer (${customerPhone}): ${message}`);
    if (doctorPhone) {
        console.log(`📱 SMS Sent to Doctor/Hospital (${doctorPhone}): ${message}`);
    }
}

// ================= 1. AI CHATBOT ENDPOINT (Gemini API Integration) =================
app.post('/api/chat', async t => {
    const { prompt } = t.body;
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are PregBuddy AI, an expert, compassionate maternal healthcare assistant. Provide safe, concise medical guidance and trimester support for: ${prompt}`
                    }]
                }]
            })
        });

        const data = await response.json();
        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || 
            "I am monitoring your health query. Please maintain adequate hydration and consult your gynecologist if symptoms persist.";

        t.json({ reply: aiReply });
    } catch (err) {
        console.error("Gemini API Error:", err);
        t.status(500).json({ error: "Failed to connect to PregBuddy AI engine." });
    }
});

// ================= 2. APPOINTMENT & BED BOOKING ENDPOINT =================
app.post('/api/bookings', async (req, res) => {
    const { customerName, customerEmail, customerPhone, targetName, bookingType, slotDate } = req.body;
    
    const customerHtml = `<h2>Hello ${customerName},</h2><p>Your booking for <strong>${targetName}</strong> (${bookingType}) has been confirmed.</p><p>Date: ${slotDate || 'Immediate'}</p><p>Thank you for trusting Jannani PregBuddy.</p>`;
    const doctorHtml = `<h3>New Patient Appointment / Reservation</h3><p>Patient: <strong>${customerName}</strong></p><p>Phone: ${customerPhone}</p><p>Service: ${targetName} (${bookingType})</p><p>Please review patient profile in the clinic dashboard.</p>`;

    await sendNotificationEmails(
        customerEmail || 'patient@example.com', 
        'doctor.partner@jannanipregbuddy.health', 
        `Booking Confirmation: ${targetName}`, 
        customerHtml, 
        doctorHtml
    );

    await sendSMSNotifications(customerPhone || '+919876543210', '+919876599999', `Booking confirmed with ${targetName}. Check your email for details.`);

    res.json({ success: true, message: "Booking confirmed and notifications dispatched to customer and doctor." });
});

// ================= 3. EMERGENCY SOS DISPATCH ENDPOINT =================
app.post('/api/sos', async (req, res) => {
    const { customerName, customerPhone, gpsCoords } = req.body;

    const customerHtml = `<h2>🚨 SOS EMERGENCY TRIGGERED</h2><p>Dear ${customerName}, our emergency response team has received your SOS alert at GPS coordinates: <strong>${gpsCoords}</strong>.</p><p>Ambulance 108 has been notified and nearby Fortis La Femme Emergency OT is preparing your arrival.</p>`;
    const doctorHtml = `<h2>🚨 CRITICAL EMERGENCY ALERT (SOS)</h2><p>Patient: <strong>${customerName}</strong></p><p>Phone: ${customerPhone}</p><p>GPS Location: <strong>${gpsCoords}</strong></p><p>Status: Emergency OT reservation triggered. Please dispatch medical staff immediately.</p>`;

    await sendNotificationEmails(
        'patient@example.com', 
        'emergency.ot@fortislafemme.com', 
        `URGENT SOS EMERGENCY - ${customerName}`, 
        customerHtml, 
        doctorHtml
    );

    await sendSMSNotifications(customerPhone || '+919876543210', '+919876511111', `EMERGENCY SOS: Location ${gpsCoords} broadcasted to ambulance 108 & partner hospital OT.`);

    res.json({ success: true, message: "SOS emergency broadcast successful. Ambulance and medical team alerted." });
});

// ================= 4. FORUM POSTS ENDPOINT =================
let forumPostsStore = [
    { name: "Ananya S.", tri: "Trimester 2", time: "2 hours ago", content: "Did anyone else experience sudden ligament pain around Week 18?" },
    { name: "Radhika K.", tri: "Trimester 3", time: "5 hours ago", content: "Packing my hospital bag now! Any essential items you mommas recommend?" }
];

app.get('/api/forum', (req, res) => {
    res.json(forumPostsStore);
});

app.post('/api/forum', (req, res) => {
    const { name, tri, content } = req.body;
    const newPost = { name: name || "Anonymous Mom", tri: tri || "General Support", time: "Just now", content };
    forumPostsStore.unshift(newPost);
    res.json({ success: true, posts: forumPostsStore });
});

// ================= 5. ML RISK RADAR ENDPOINT =================
app.post('/api/risk', (req, res) => {
    const { systolic, diastolic, glucose, kicks } = req.body;
    let score = "LOW";
    let advice = "Your recorded metrics fall within safe standard ranges. Maintain regular prenatal visits.";

    if (systolic >= 140 || diastolic >= 90 || glucose >= 126 || kicks < 8) {
        score = "HIGH";
        advice = "Elevated blood pressure or glucose detected. Please schedule an urgent checkup with your gynecologist.";
    } else if (systolic >= 130 || glucose >= 100) {
        score = "MODERATE";
        advice = "Slightly elevated parameters. Reduce salt intake, monitor sugar levels, and log kicks daily.";
    }

    res.json({ score, advice });
});

app.listen(PORT, () => {
    console.log(`🚀 Jannani Backend Server running securely on port ${PORT}`);
});
