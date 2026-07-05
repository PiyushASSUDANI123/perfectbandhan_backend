const https = require('https');

async function testGroq() {
    const postData = JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: 'Say hi' }],
      temperature: 0.7
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer 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`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const dataRaw = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    console.log(dataRaw);
}
testGroq();
