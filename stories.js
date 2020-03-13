const MAX_AGE = 1000 * 60 * 10;
const CORS_PROXY = "https://cors-anywhere.herokuapp.com/"
const getFeed = function(name) {
  return `${CORS_PROXY}https://www.economist.com/${name}/rss.xml`
}
const feeds = [
  'britain',
  'europe',
  'united-states',
  'the-americas',
  'middle-east-and-africa',
  'asia',
  'china',
]

const synonyms = {
  'russian federation': 'russia',
}

const storiesByCountry = {};

function loadStories() {
  countryList.forEach(c => {
    c.lowerName = c.name.toLowerCase();
    let comma = c.lowerName.indexOf(',')
    if (comma !== -1) {
      c.lowerName = c.lowerName.substring(0, comma);
    }
    c.lowerName = synonyms[c.lowerName] || c.lowerName;
  });
  let parser = new RSSParser();
  let prom = Promise.resolve();
  let total = feeds.length;
  let done = 0;
  feeds.forEach(name => {
    let cached = localStorage.getItem(name);
    if (cached) {
      cached = JSON.parse(cached);
      if (new Date(cached.retrieved).getTime() + MAX_AGE >= new Date().getTime()) {
        console.log('using cached feed for', name);
        addStories(name, cached);
        return
      } else {
        console.log('cache is stale for', name);
      }
    }
    prom = prom.then(_ => parser.parseURL(getFeed(name)).then(feed => {
      feed.retrieved = new Date();
      localStorage.setItem(name, JSON.stringify(feed));
      addStories(name, feed);
    }));
  })
  prom = prom.then(_ => {
    for (let country in storiesByCountry) {
      let stories = storiesByCountry[country];
      stories.sort((s1, s2) => {
        return new Date(s2.pubDate).getTime() - new Date(s1.pubDate).getTime();
      })
    }
  });
  return prom;
}

function addStories(name, feed) {
  feed.items.forEach(item => {
    const lowerTitle = item.title.toLowerCase();
    let country = null;
    if (name === 'britain') {
      country = countryList.find(c => c.lowerName === 'united kingdom');
    } else if (name === 'united-states') {
      country = countryList.find(c => c.lowerName === 'united states');
    } else if (name === 'china') {
      country = countryList.find(c => c.lowerName === 'china');
    } else {
      country = countryList.find(c => lowerTitle.indexOf(c.lowerName) !== -1);
    }
    if (country) {
      storiesByCountry[country.id] = storiesByCountry[country.id] || [];
      storiesByCountry[country.id].push(item);
    }
  })
}

