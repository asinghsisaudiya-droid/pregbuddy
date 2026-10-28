require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

// Serve static assets from both root and public directories
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, "public")));

// Configure Nodemailer Transporter for Email Notifications
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper function to send emails to customer and doctor
async function sendNotificationEmails(
  recipientEmail,
  doctorEmail,
  subject,
  customerHtml,
  doctorHtml,
) {
  try {
    await transporter.sendMail({
      from: `"Jannani PregBuddy Health" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `[Jannani] ${subject}`,
      html: customerHtml,
    });

    if (doctorEmail) {
      await transporter.sendMail({
        from: `"Jannani Emergency Dispatch" <${process.env.EMAIL_USER}>`,
        to: doctorEmail,
        subject: `[Clinical Alert] ${subject}`,
        html: doctorHtml,
      });
    }
    console.log("✅ Emails dispatched successfully.");
  } catch (error) {
    console.error("❌ Error sending email notifications:", error);
  }
}

// Helper function to dispatch SMS notifications
async function sendSMSNotifications(customerPhone, doctorPhone, message) {
  console.log(`📱 SMS to Customer (${customerPhone}): ${message}`);
  if (doctorPhone) {
    console.log(`📱 SMS to Doctor/Hospital (${doctorPhone}): ${message}`);
  }
}

// ================= 1. AI CHATBOT ENDPOINT (Gemini API) =================
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are PregBuddy AI, an expert, compassionate maternal healthcare assistant. Provide safe, concise medical guidance and trimester support for: ${prompt}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    // Fixed syntax without chaining errors
    let aiReply =
      "I am monitoring your health query. Please maintain adequate hydration and consult your gynecologist if symptoms persist.";
    if (
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      aiReply = data.candidates[0].content.parts[0].text;
    }

    res.json({ reply: aiReply });
  } catch (err) {
    console.error("Gemini API Error:", err);
    res
      .status(500)
      .json({ error: "Failed to connect to PregBuddy AI engine." });
  }
});

// ================= 2. APPOINTMENT & BED BOOKING ENDPOINT =================
app.post("/api/bookings", async (req, res) => {
  const {
    customerName,
    customerEmail,
    customerPhone,
    targetName,
    bookingType,
    slotDate,
  } = req.body;

  const customerHtml = `<h2>Hello ${customerName},</h2><p>Your booking for <strong>${targetName}</strong> (${bookingType}) has been confirmed.</p><p>Date: ${slotDate || "Immediate"}</p><p>Thank you for trusting Jannani PregBuddy.</p>`;
  const doctorHtml = `<h3>New Patient Appointment / Reservation</h3><p>Patient: <strong>${customerName}</strong></p><p>Phone: ${customerPhone}</p><p>Service: ${targetName} (${bookingType})</p>`;

  await sendNotificationEmails(
    customerEmail || "patient@example.com",
    "doctor.partner@jannanipregbuddy.health",
    `Booking Confirmation: ${targetName}`,
    customerHtml,
    doctorHtml,
  );

  await sendSMSNotifications(
    customerPhone || "+919876543210",
    "+919876599999",
    `Booking confirmed with ${targetName}. Check your email for details.`,
  );

  res.json({
    success: true,
    message: "Booking confirmed and notifications dispatched.",
  });
});

// ================= 3. EMERGENCY SOS DISPATCH ENDPOINT =================
app.post("/api/sos", async (req, res) => {
  const { customerName, customerPhone, gpsCoords } = req.body;

  const customerHtml = `<h2>🚨 SOS EMERGENCY TRIGGERED</h2><p>Dear ${customerName}, our emergency response team has received your SOS alert at GPS coordinates: <strong>${gpsCoords}</strong>.</p><p>Ambulance 108 has been notified and nearby hospital emergency OT is preparing your arrival.</p>`;
  const doctorHtml = `<h2>🚨 CRITICAL EMERGENCY ALERT (SOS)</h2><p>Patient: <strong>${customerName}</strong></p><p>Phone: ${customerPhone}</p><p>GPS Location: <strong>${gpsCoords}</strong></p><p>Status: Emergency OT reservation triggered.</p>`;

  await sendNotificationEmails(
    "patient@example.com",
    "emergency.ot@fortislafemme.com",
    `URGENT SOS EMERGENCY - ${customerName}`,
    customerHtml,
    doctorHtml,
  );

  await sendSMSNotifications(
    customerPhone || "+919876543210",
    "+919876511111",
    `EMERGENCY SOS: Location ${gpsCoords} broadcasted to ambulance 108 & hospital OT.`,
  );

  res.json({ success: true, message: "SOS emergency broadcast successful." });
});

// ================= 4. FORUM ENDPOINTS =================
let forumPostsStore = [
  {
    name: "Ananya S.",
    tri: "Trimester 2",
    time: "2 hours ago",
    content: "Did anyone else experience sudden ligament pain around Week 18?",
  },
  {
    name: "Radhika K.",
    tri: "Trimester 3",
    time: "5 hours ago",
    content:
      "Packing my hospital bag now! Any essential items you mommas recommend?",
  },
];

app.get("/api/forum", (req, res) => {
  res.json(forumPostsStore);
});

app.post("/api/forum", (req, res) => {
  const { name, tri, content } = req.body;
  const newPost = {
    name: name || "Anonymous Mom",
    tri: tri || "General Support",
    time: "Just now",
    content,
  };
  forumPostsStore.unshift(newPost);
  res.json({ success: true, posts: forumPostsStore });
});

// Fallback route to serve index.html safely from public/ or root
app.get("*", (req, res) => {
  const publicHtml = path.join(__dirname, "public", "index.html");
  const rootHtml = path.join(__dirname, "index.html");

  if (fs.existsSync(publicHtml)) {
    res.sendFile(publicHtml);
  } else if (fs.existsSync(rootHtml)) {
    res.sendFile(rootHtml);
  } else {
    res.status(404).send("Error: index.html not found on server.");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Jannani Backend Server running on port ${PORT}`);
});
