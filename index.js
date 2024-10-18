const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const ngrok = require('ngrok');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const User = require('./models/user');

const app = express();
const port = process.env.PORT || 8000;

const BOT_TOKEN = process.env.BOT_TOKEN
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID
const TELEGRAM_BOT_SECRET = crypto.createHash('sha256').update(BOT_TOKEN).digest();  // Generate secret

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Database connected"))
  .catch((err) => console.error('MongoDB connection error:', err));

// Function to verify Telegram login data
function verifyTelegramLogin(data) {
    const { hash, ...userData } = data;
    const checkString = Object.keys(userData)
        .sort()
        .map(k => `${k}=${userData[k]}`)
        .join('\n');

    const hmac = crypto.createHmac('sha256', TELEGRAM_BOT_SECRET).update(checkString).digest('hex');
    console.log(hmac === hash, "Boolean");
    return hmac === hash;
}

app.get('/register', async (req, res) => {
    const { id: userId, first_name: firstName, last_name: lastName, auth_date, hash } = req.query;

    // Log incoming request data
    console.log(req.query,"Received request for registration");

    // Check for required parameters
    console.log(userId,"id");
    
    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // if (!hash || !userId || !firstName || !lastName || !auth_date) {
    //     return res.status(400).json({ success: false, message: 'Missing required fields' });
    // }

    // Verify the Telegram login data using the function
    if (!verifyTelegramLogin(req.query)) {
        return res.status(403).json({ success: false, message: 'Invalid Telegram login data' });
    }

    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ userId: userId });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already registered' }); // Conflict status
        }
        
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
            params: {
                chat_id: GROUP_CHAT_ID,
                user_id: userId,
            },
        });

        console.log(response.data, "Response from Telegram");

        // Check membership status
        const memberStatus = response.data.result.status;

        // if (memberStatus === 'member' || memberStatus === 'creator' || memberStatus === 'administrator') {

        if (['member', 'creator', 'administrator'].includes(memberStatus)) {
            // User is a member of the group, proceed with registration
            // Add your registration logic here
                    // Save user information in the database
            const newUser = new User({ userId, firstName, lastName });
            await newUser.save();
            return res.status(200).json({ status: true, message: `Welcome, ${firstName}! registration successful` });
        } else {
            return res.status(403).json({ status: false, message: 'Joining the Telegram group is mandatory for registration!' });
        }
    } catch (error) {
        // Handle specific error responses
        if (error.response && error.response.data && error.response.data.ok === false) {
            if (error.response.data.error_code === 400) {
                return res.status(404).json({ status: false, message: 'User not found in the group. Please check the user ID.' });
            }
        }
        console.error("Error while processing registration:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
});

// Start ngrok
async function startNgrok() {
    try {
        const url = await ngrok.connect(port);
        console.log(`ngrok tunnel opened at: ${url}`);
    } catch (error) {
        console.error('Failed to connect to ngrok:', error);
    }
}

app.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}`);
    await startNgrok();
});
