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
  'republic of the congo': ['congo'],
  'china': ['hong kong'],
  'united states': ['america', 'trump', 'hollywood'],
  'india': ['bollywood'],
  'côte d\'ivoire': ['ivory coast'],
  'viet nam': ['vietnam'],
  'bolivia': ['evo morales'],
}

const storiesByCountry = {};

function initializeCountryData() {
  countryList.forEach(c => {
    c.data = countryData.find(d => parseInt(d.ccn3) === parseInt(c.id));
    if (!c.data) {
      console.log("no data for ", c.id, c.name);
      return
    }
  });
  countryList = countryList.filter(c => c.data);
  countryList.forEach(c => {
    c.name = c.data.name.common;
    let lowerName = c.name.toLowerCase();
    let comma = lowerName.indexOf(',')
    if (comma !== -1) {
      lowerName = lowerName.substring(0, comma);
    }
    c.terms = [lowerName].concat(synonyms[lowerName] || []);
    if (window.capitals[c.name]) {
      c.terms.push(window.capitals[c.name].toLowerCase());
    }
    let leader = window.leaders.find(l => l.country.toLowerCase() === lowerName)
    if (leader) {
      ["government", "state"].forEach(type => {
        if (!leader[type]) return
        let lastName = leader[type].split(" ").pop();
        c.terms.push(lastName.toLowerCase());
      })
    }
    c.data = countryData.find(d => parseInt(d.ccn3) === parseInt(c.id));
    c.terms = c.terms.concat(c.data.capital.map(cap => cap.toLowerCase()));
    const demonym = c.data.demonym.toLowerCase();
    c.terms.push(demonym);
    c.terms.push(demonym + "s");
    c.terms.push(c.data.name.common.toLowerCase());
    c.terms = c.terms.map(t => getTokens([t]));
  });
}

function loadStories() {
  initializeCountryData();
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
  let noCountry = 0;
  feed.items.forEach(item => {
    let country = null;
    if (name === 'britain') {
      country = countryList.find(c => c.name === 'United Kingdom');
    } else if (name === 'united-states') {
      country = countryList.find(c => c.name === 'United States');
    } else if (name === 'china') {
      country = countryList.find(c => c.name === 'China');
    } else {
      const tokens = getTokens([item.title, item.contentSnippet]);
      country = countryList.find(c => matchTermList(tokens, c.terms));
    }
    if (country) {
      storiesByCountry[country.id] = storiesByCountry[country.id] || [];
      storiesByCountry[country.id].push(item);
    } else {
      console.log("no country match:", item.title);
      noCountry++;
    }
  })
  console.log(name, noCountry, "items with no country out of", feed.items.length);
}

function getTokens(strs) {
  let tokens = [];
  strs.forEach(str => {
    tokens = tokens.concat(str.toLowerCase().split(' '));
  });
  tokens = tokens.map(t => {
    t = t.replace(/'s$/, '');
    t = t.replace(/’s$/, '');
    t = t.replace(/\W+$/, '');
    return t
  })
  return tokens
}

function matchTermList(tokens, termList) {
  for (let term of termList) {
    if (matchTokens(tokens, term)) return true
  }
  return false
}

function matchTokens(tokensToSearch, tokens) {
  for (let i = 0; i <= tokensToSearch.length - tokens.length; ++i) {
    let match = true;
    for (let j = 0; j < tokens.length; ++j) {
      if (tokens[j] !== tokensToSearch[i + j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}
