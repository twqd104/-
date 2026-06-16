const fs = require('fs');
const https = require('https');

https.get('https://raw.githubusercontent.com/akabab/starwars-api/master/api/all.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const chars = JSON.parse(data);
    const map = {};
    chars.forEach(c => map[c.name] = c.image);

    // Fallbacks
    map["Count Dooku"] = map["Dooku"] || map["Count Dooku"];
    map["Emperor Palpatine"] = map["Palpatine"] || map["Emperor Palpatine"];
    map["Princess Leia"] = map["Leia Organa"] || map["Princess Leia"];
    map["Rey Skywalker"] = map["Rey"] || map["Rey Skywalker"];
    map["Kylo Ren / Ben Solo"] = map["Kylo Ren"] || map["Ben Solo"];

    let mainTs = fs.readFileSync('src/main.ts', 'utf8');

    // Regex to match: { name: '...', role: '...', imgUrl: '...' }
    mainTs = mainTs.replace(/{ name: '([^']+)', role: '([^']+)', imgUrl: '([^']+)' }/g, (match, name, role, oldUrl) => {
      let newUrl = map[name] || map[name.split(' ')[0]];
      // Manual overrides for sequels since API might lack them
      if (name === 'Rey' || name === 'Rey Skywalker') newUrl = 'https://lumiere-a.akamaihd.net/v1/images/rey_b1a3fb1b.jpeg?region=0%2C0%2C1200%2C675';
      if (name === 'Kylo Ren' || name === 'Kylo Ren / Ben Solo') newUrl = 'https://lumiere-a.akamaihd.net/v1/images/kylo-ren-main-tros_4d4ac619.jpeg?region=183%2C0%2C899%2C506';
      if (name === 'Finn') newUrl = 'https://lumiere-a.akamaihd.net/v1/images/finn-main-tros_b497b7b2.jpeg?region=137%2C0%2C1014%2C570';
      if (name === 'Supreme Leader Snoke') newUrl = 'https://lumiere-a.akamaihd.net/v1/images/snoke-main_71acefb4.jpeg?region=0%2C0%2C1200%2C675';
      
      if (!newUrl) newUrl = oldUrl; // fallback
      return `{ name: '${name}', role: '${role}', imgUrl: '${newUrl}' }`;
    });

    // Write back
    fs.writeFileSync('src/main.ts', mainTs);
    console.log("Updated main.ts with real image URLs!");
  });
});
