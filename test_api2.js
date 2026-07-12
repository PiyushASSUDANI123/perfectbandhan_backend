const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sindhi_shadi_premium_secret';
const phone = '6375339896';
const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });

async function run() {
    try {
        const res = await fetch('http://localhost:5000/api/v1/user/profiles?limit=10&offset=0&recommendations=true', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response text:", text);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
