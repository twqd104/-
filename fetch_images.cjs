const https = require('https');

const characters = [
  "Qui-Gon_Jinn", "Obi-Wan_Kenobi", "Darth_Maul",
  "Anakin_Skywalker", "Padmé_Amidala", "Dooku",
  "Darth_Vader", "Palpatine", "Yoda",
  "Luke_Skywalker", "Leia_Organa", "Han_Solo",
  "Lando_Calrissian", "Jabba_Desilijic_Tiure",
  "Rey_Skywalker", "Ben_Solo", "Finn"
];

const fetchImage = (title) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'starwars.fandom.com',
      path: `/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=500`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail) {
            // Fandom wikia returns URLs like "https://vignette.wikia.nocookie.net/.../scale-to-width-down/500?cb=..."
            // We can clean it to get the original or use it as is.
            resolve({ title, url: pages[pageId].thumbnail.source });
          } else {
            resolve({ title, url: null });
          }
        } catch (e) {
          resolve({ title, url: null });
        }
      });
    }).on('error', () => resolve({ title, url: null }));
  });
};

async function run() {
  const results = {};
  for (const char of characters) {
    const res = await fetchImage(char);
    results[char] = res.url;
  }
  console.log(JSON.stringify(results, null, 2));
}

run();
