const https = require('https');
https.get('https://raw.githubusercontent.com/akabab/starwars-api/master/api/all.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const chars = JSON.parse(data);
    const map = {};
    chars.forEach(c => map[c.name] = c.image);
    console.log(JSON.stringify(map, null, 2));
  });
});
