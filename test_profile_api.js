const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ phone: '9413507419' }, process.env.JWT_SECRET || 'sindhi_shadi_premium_secret', { expiresIn: '30d' });

const payload = {
  phone: '9413507419',
  profileFor: 'Self',
  gender: 'Male',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  dob: '1995-01-01',
  height: '5.10',
  city: 'Jaipur',
  state: 'Rajasthan',
  maritalStatus: 'Never Married',
  education: 'B.Tech',
  profession: 'Corporate Job',
  incomeBracket: '5-10 Lakhs',
  nukh: 'Ahuja',
  bio: 'Hello world',
  uploadedPhotos: ['https://example.com/photo.jpg'],
  surname: 'Ahuja',
  monthlyIncome: '50000',
  yearlyIncome: '600000',
  district: 'Jaipur',
  properAddress: 'Malviya Nagar',
  ownHouse: 'Yes',
  complexion: 'Fair',
  weight: '70',
  fatherStatus: 'Alive',
  motherStatus: 'Alive',
  siblingsCount: '1',
  sindhiType: 'Sindhi Hindu',
  whatsappNumber: '9413507419',
  company: 'TCS',
  jobPost: 'Engineer',
  fathersOccupation: 'Business',
  mothersOccupation: 'Housewife',
  siblingsDetails: '1 brother'
};

async function test() {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch('http://localhost:3005/user/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', data);
}
test();
