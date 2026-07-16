const STOPWORDS = new Set(`a about above after again against all am an and any are aren arent as at
be because been before being below between both but by can cant cannot could couldnt did didnt do
does doesnt doing dont down during each few for from further had hadnt has hasnt have havent having
he hed hell hes her here heres hers herself him himself his how hows i id ill im ive if in into is
isnt it its itself lets me more most mustnt my myself no nor not of off on once only or other ought
our ours ourselves out over own same shant she shed shell shes should shouldnt so some such than
that thats the their theirs them themselves then there theres these they theyd theyll theyre theyve
this those through to too under until up very was wasnt we wed well were weve werent what whats
when whens where wheres which while who whos whom why whys will with wont would wouldnt you youd
youll youre youve your yours yourself yourselves
yeah yea ya uh huh na nah ah ahh uhh mmm oh ooh woah whoa wow hey ey yo ay ayy
ima imma finna gonna gotta wanna gotta lemme gimme kinda sorta outta
cause coz cuz like just know knows knew get gets getting got gotten
go goes going gone went come comes coming came
make makes made making take takes taking took taken
want wants wanted wanting need needs needed
let lets letting say says said saying tell tells telling told
think thinks thinking thought look looks looking looked see sees seeing saw seen
put puts putting keep keeps keeping kept give gives giving gave given
one two three four five six seven eight nine ten
man men woman women boy boys girl girls baby babe
now still yet way ways time times day days night nights back around
right left really much many little bit lot lots
thing things something anything everything nothing someone anyone everyone nobody
new old first last next never always sometimes maybe
good bad okay ok alright fine great
gon aint ain nem finnaa
nigga niggas bitch bitches nigg niggah niggaz
que la el los las una uno para por con sin pero como más mas donde cuando porque
soy eres esta estas estan tengo tiene mi tu su tus tus tan todo toda`.split(/\s+/).filter(Boolean));

function tokenize(text) {
  if (!text) return [];
  const words = String(text).toLowerCase().match(/[a-z']+/g) || [];
  const out = [];
  for (const w of words) {
    // Strip ALL apostrophes (not just leading/trailing) so contractions normalize
    // to the same form as the stopword list, e.g. "i'm" -> "im", "don't" -> "dont"
    const trimmed = w.replace(/'/g, '');
    if (trimmed.length > 2 && !STOPWORDS.has(trimmed)) out.push(trimmed);
  }
  return out;
}

const MAX_TOKENS_PER_TRACK = 1500;

function wordFrequency(lyricsList, limit = 100) {
  const counts = new Map();
  for (const lyrics of lyricsList) {
    const tokens = tokenize(lyrics).slice(0, MAX_TOKENS_PER_TRACK);
    for (const w of tokens) {
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function pearsonCorrelation(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null && !Number.isNaN(xs[i]) && !Number.isNaN(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }
  const n = pairs.length;
  if (n < 2) return null;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, denomX = 0, denomY = 0;
  for (const [x, y] of pairs) {
    num += (x - meanX) * (y - meanY);
    denomX += (x - meanX) ** 2;
    denomY += (y - meanY) ** 2;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? null : num / denom;
}

function mean(arr) {
  const valid = arr.filter(v => v != null && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

const SUBGENRE_BUCKETS = [
  ['Trap', ['trap', 'dark trap', 'trap latino', 'trap queen', 'atl trap', 'detroit trap', 'plugg', 'pluggnb', 'rage rap', 'electronic trap']],
  ['Drill', ['drill', 'brooklyn drill', 'chicago drill', 'florida drill', 'philly drill', 'new york drill']],
  ['Conscious / Political', ['conscious hip hop', 'political hip hop', 'jazz rap']],
  ['Old School / Golden Age', ['golden age hip hop', 'old school hip hop', 'old school atlanta hip hop']],
  ['Gangsta / Hardcore', ['gangster rap', 'hardcore hip hop', 'dirty south rap']],
  ['Pop Rap', ['pop rap', 'hip pop', 'melodic rap']],
  ['Regional (City-Tagged)', [
    'atl hip hop', 'chicago rap', 'detroit hip hop', 'miami hip hop', 'new orleans rap',
    'queens hip hop', 'memphis hip hop', 'pittsburgh rap', 'north carolina hip hop', 'dfw rap', 'philly rap',
    'south carolina hip hop', 'ohio hip hop', 'cali rap', 'bronx hip hop', 'harlem hip hop', 'baton rouge rap',
    'st louis rap', 'oakland hip hop', 'virginia hip hop', 'nashville hip hop', 'mississippi hip hop', 'seattle hip hop',
    'houston rap', 'kansas city hip hop', 'san diego rap', 'portland hip hop', 'nyc rap',
    'east coast hip hop', 'west coast rap', 'southern hip hop',
  ]],
  ['Latin / Reggaeton', [
    'reggaeton', 'urbano latino', 'latin hip hop', 'reggaeton colombiano', 'chicano rap',
    'texas latin rap', 'electro latino', 'rap latina', 'rap boricua', 'trap boricua', 'trap argentino',
    'trap catala', 'rap catala', 'urbano espanol',
  ]],
  ['Alternative / Experimental', ['alternative hip hop', 'experimental hip hop', 'abstract hip hop', 'psychedelic hip hop', 'cloud rap', 'emo rap', 'sad rap']],
  ['Rap-Rock / Rap-Metal', ['rap rock', 'rap metal']],
];

function assignSubgenreBucket(genresStr) {
  if (!genresStr) return 'Other / Unclassified';
  const tags = new Set(String(genresStr).split(';').map(t => t.trim().toLowerCase()).filter(Boolean));
  for (const [bucketName, keywords] of SUBGENRE_BUCKETS) {
    if (keywords.some(k => tags.has(k))) return bucketName;
  }
  if (tags.has('rap') || tags.has('hip hop')) return 'General Rap / Hip-Hop';
  return 'Other / Unclassified';
}

function normalizeRow(row) {
  const explicitRaw = row.explicit;
  let explicit = false;
  if (typeof explicitRaw === 'boolean') explicit = explicitRaw;
  else if (typeof explicitRaw === 'string') explicit = explicitRaw.trim().toLowerCase() === 'true';

  return {
    track_name: String(row.track_name ?? '').trim(),
    principal_artist_name: String(row.principal_artist_name ?? '').trim(),
    artist_genres: String(row.artist_genres ?? ''),
    year: Number(row.year),
    popularity: Number(row.popularity),
    danceability: row.danceability === '' || row.danceability == null ? null : Number(row.danceability),
    energy: row.energy === '' || row.energy == null ? null : Number(row.energy),
    valence: row.valence === '' || row.valence == null ? null : Number(row.valence),
    speechiness: row.speechiness === '' || row.speechiness == null ? null : Number(row.speechiness),
    acousticness: row.acousticness === '' || row.acousticness == null ? null : Number(row.acousticness),
    loudness: row.loudness === '' || row.loudness == null ? null : Number(row.loudness),
    tempo: row.tempo === '' || row.tempo == null ? null : Number(row.tempo),
    explicit,
    word_count: row.word_count === '' || row.word_count == null ? null : Number(row.word_count),
    unique_word_count: row.unique_word_count === '' || row.unique_word_count == null ? null : Number(row.unique_word_count),
    lexical_diversity: row.lexical_diversity === '' || row.lexical_diversity == null ? null : Number(row.lexical_diversity),
    flesch_reading_ease: row.flesch_reading_ease === '' || row.flesch_reading_ease == null ? null : Number(row.flesch_reading_ease),
    genius_views: row.genius_views === '' || row.genius_views == null ? null : Number(row.genius_views),
    lyrics_clean: String(row.lyrics_clean ?? ''),
  };
}

function buildDataset(rawRows) {
  const rows = rawRows
    .map(normalizeRow)
    .filter(r => r.track_name && r.principal_artist_name && !Number.isNaN(r.popularity));

  // Scatter data
  const scatter = rows
    .filter(r => r.genius_views != null && r.genius_views > 0)
    .map(r => ({
      track_name: r.track_name,
      principal_artist_name: r.principal_artist_name,
      popularity: r.popularity,
      genius_views: r.genius_views,
      year: r.year,
    }));

  // Correlations (genre-wide)
  const featureKeys = [
    ['danceability', 'Danceability'],
    ['energy', 'Energy'],
    ['valence', 'Valence (positivity)'],
    ['speechiness', 'Speechiness'],
    ['acousticness', 'Acousticness'],
    ['word_count', 'Lyric word count'],
    ['lexical_diversity', 'Lexical diversity'],
    ['flesch_reading_ease', 'Reading ease (simpler lyrics)'],
    ['genius_views', 'Genius pageviews'],
  ];
  const popularityArr = rows.map(r => r.popularity);
  const correlations = featureKeys
    .map(([key, label]) => {
      const featureArr = rows.map(r => r[key]);
      const corr = pearsonCorrelation(featureArr, popularityArr);
      return corr == null ? null : { feature: key, label, corr: Math.round(corr * 10000) / 10000 };
    })
    .filter(Boolean)
    .sort((a, b) => a.corr - b.corr);

  // timeline
  const decadeGroups = new Map();
  for (const r of rows) {
    if (Number.isNaN(r.year)) continue;
    const decade = Math.floor(r.year / 10) * 10;
    if (!decadeGroups.has(decade)) decadeGroups.set(decade, []);
    decadeGroups.get(decade).push(r);
  }
  const timeline = Array.from(decadeGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([decade, group]) => ({
      decade,
      popularity: mean(group.map(r => r.popularity)),
      flesch_reading_ease: mean(group.map(r => r.flesch_reading_ease)),
      lexical_diversity: mean(group.map(r => r.lexical_diversity)),
      n: group.length,
    }));

  // Summary
  const explicitRows = rows.filter(r => r.explicit === true);
  const cleanRows = rows.filter(r => r.explicit === false);
  const artistCounts = new Map();
  for (const r of rows) {
    artistCounts.set(r.principal_artist_name, (artistCounts.get(r.principal_artist_name) || 0) + 1);
  }
  let topArtist = null, topCount = -1;
  for (const [artist, count] of artistCounts.entries()) {
    if (count > topCount) { topArtist = artist; topCount = count; }
  }

  const overallSummary = {
    n_songs: rows.length,
    avg_popularity: mean(rows.map(r => r.popularity)),
    avg_genius_views: mean(rows.map(r => r.genius_views)),
    avg_danceability: mean(rows.map(r => r.danceability)),
    explicit_rate: rows.length ? explicitRows.length / rows.length : null,
    explicit_pop: mean(explicitRows.map(r => r.popularity)),
    clean_pop: mean(cleanRows.map(r => r.popularity)),
    top_artist: topArtist,
  };

  // per-artist card
  const artistGroups = new Map();
  for (const r of rows) {
    if (!artistGroups.has(r.principal_artist_name)) artistGroups.set(r.principal_artist_name, []);
    artistGroups.get(r.principal_artist_name).push(r);
  }
  const artistCards = {};
  for (const [artist, group] of artistGroups.entries()) {
    artistCards[artist] = {
      n_songs: group.length,
      avg_popularity: Math.round(mean(group.map(r => r.popularity)) * 10) / 10,
      avg_genius_views: Math.round(mean(group.map(r => r.genius_views)) || 0),
      avg_danceability: Math.round((mean(group.map(r => r.danceability)) || 0) * 1000) / 1000,
      explicit_rate: Math.round((group.filter(r => r.explicit).length / group.length) * 100) / 100,
    };
  }
  const artistList = Array.from(artistGroups.keys()).sort((a, b) => a.localeCompare(b));

  //word cloud
  const overallWordcloud = wordFrequency(rows.map(r => r.lyrics_clean));

  const artistWordcloud = {};
  for (const [artist, group] of artistGroups.entries()) {
    const wc = wordFrequency(group.map(r => r.lyrics_clean));
    if (wc.length) artistWordcloud[artist] = wc;
  }

  const songWordcloud = {};
  const songListByArtist = {};
  for (const r of rows) {
    const key = `${r.track_name}|||${r.principal_artist_name}`;
    const wc = wordFrequency([r.lyrics_clean]);
    if (wc.length) songWordcloud[key] = wc;
    if (!songListByArtist[r.principal_artist_name]) songListByArtist[r.principal_artist_name] = [];
    songListByArtist[r.principal_artist_name].push(r.track_name);
  }
  for (const artist in songListByArtist) {
    songListByArtist[artist].sort((a, b) => a.localeCompare(b));
  }

  //subgenre breakdown
  const subgenreGroups = new Map();
  for (const r of rows) {
    const bucket = assignSubgenreBucket(r.artist_genres);
    if (!subgenreGroups.has(bucket)) subgenreGroups.set(bucket, []);
    subgenreGroups.get(bucket).push(r);
  }
  const subgenreBreakdown = Array.from(subgenreGroups.entries())
    .map(([bucket, group]) => ({
      bucket,
      n: group.length,
      avg_popularity: mean(group.map(r => r.popularity)),
    }))
    .filter(d => d.avg_popularity != null)
    .sort((a, b) => b.avg_popularity - a.avg_popularity);

  return {
    scatter,
    correlations,
    timeline,
    overall_summary: overallSummary,
    artist_cards: artistCards,
    artist_list: artistList,
    overall_wordcloud: overallWordcloud,
    artist_wordcloud: artistWordcloud,
    song_wordcloud: songWordcloud,
    song_list_by_artist: songListByArtist,
    subgenre_breakdown: subgenreBreakdown,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { buildDataset, tokenize, wordFrequency, pearsonCorrelation, normalizeRow, assignSubgenreBucket };
}

