const jwt = require('jsonwebtoken');

const JWT_SECRET = 'sindhi_shadi_premium_secret';
const phone = '6375339896';
const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });

async function run() {
    try {
        const res = await fetch('https://humsafar.piyushassudani.in/api/v1/user/profiles?limit=10&offset=0&recommendations=true', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        console.log("Total Profiles:", data.data.length);
        if (data.data.length > 0) {
            console.log("First Profile Name:", data.data[0].name);
            console.log("First Profile Photos:", data.data[0].photos);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
run();
