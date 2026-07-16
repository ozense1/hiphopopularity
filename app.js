let DATA = null; 
const tooltip = document.getElementById('tooltip');

function showTooltip(html, x, y) {
  tooltip.innerHTML = html;
  tooltip.style.left = Math.min(x + 16, window.innerWidth - 240) + 'px';
  tooltip.style.top = (y + 16) + 'px';
  tooltip.style.opacity = 1;
}
function hideTooltip() { tooltip.style.opacity = 0; }

const fmtNum = d3.format(',');
const fmtCompact = d3.format('.2s');

const state = {
  artist: 'ALL',
  song: 'ALL',
};

function loadFromRawRows(rawRows, sourceLabel) {
  DATA = buildDataset(rawRows);
  document.getElementById('upload-status').textContent = sourceLabel;
  state.artist = 'ALL';
  document.getElementById('artist-search-input').value = '';
  renderAll();
}


function loadDefaultDataset() {
  document.getElementById('upload-status').textContent = 'Loading dataset...';
  Papa.parse('data.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.errors && results.errors.length) {
        console.warn('CSV parse warnings:', results.errors.slice(0, 5));
      }
      loadFromRawRows(results.data, `Using built-in dataset (${results.data.length.toLocaleString()} tracks)`);
    },
    error: (err) => {
      document.getElementById('upload-status').textContent = 'Failed to load built-in dataset';
      console.error('Failed to load data.csv:', err);
    },
  });
}

// csv upload
document.getElementById('csv-upload-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('upload-status').textContent = `Loading ${file.name}...`;
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.errors && results.errors.length) {
        console.warn('CSV parse warnings:', results.errors.slice(0, 5));
      }
      loadFromRawRows(results.data, `Loaded ${file.name} (${results.data.length.toLocaleString()} rows)`);
    },
    error: (err) => {
      document.getElementById('upload-status').textContent = `Failed to load ${file.name}`;
      console.error(err);
    },
  });
});

// tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.page).classList.add('active');

    const filterbar = document.getElementById('filterbar');
    filterbar.classList.toggle('hidden', btn.dataset.page === 'page-2');

    renderAll();
  });
});

// searchable dropdown
const searchWrap = document.getElementById('artist-search');
const searchInput = document.getElementById('artist-search-input');
const optionsList = document.getElementById('artist-options-list');
let activeOptionIndex = -1;

function renderOptionsList(filterText) {
  optionsList.innerHTML = '';
  const q = (filterText || '').trim().toLowerCase();

  const allOption = document.createElement('div');
  allOption.className = 'option-item' + (state.artist === 'ALL' ? ' selected' : '');
  allOption.textContent = 'All Hip-Hop Artists';
  allOption.addEventListener('mousedown', (e) => { e.preventDefault(); selectArtist('ALL'); });
  if (!q || 'all hip-hop artists'.includes(q)) optionsList.appendChild(allOption);

  const matches = (DATA ? DATA.artist_list : [])
    .filter(a => !q || a.toLowerCase().includes(q))
    .slice(0, 200);

  if (matches.length === 0 && q) {
    const empty = document.createElement('div');
    empty.className = 'option-empty';
    empty.textContent = `No artists matching "${filterText}"`;
    optionsList.appendChild(empty);
  }

  matches.forEach(artist => {
    const el = document.createElement('div');
    el.className = 'option-item' + (state.artist === artist ? ' selected' : '');
    el.textContent = artist;
    el.addEventListener('mousedown', (e) => { e.preventDefault(); selectArtist(artist); });
    optionsList.appendChild(el);
  });

  activeOptionIndex = -1;
}

function selectArtist(artist) {
  state.artist = artist;
  state.song = 'ALL';
  searchInput.value = artist === 'ALL' ? '' : artist;
  searchWrap.classList.remove('open');
  renderOptionsList('');
  renderFilterTag();
  renderBignums();
  renderScatter();
  populateSongFilter();
  renderWordCloud();
}

searchInput.addEventListener('focus', () => {
  searchWrap.classList.add('open');
  renderOptionsList(searchInput.value);
});
searchInput.addEventListener('input', () => {
  searchWrap.classList.add('open');
  renderOptionsList(searchInput.value);
});
searchInput.addEventListener('keydown', (e) => {
  const items = Array.from(optionsList.querySelectorAll('.option-item'));
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeOptionIndex = Math.min(activeOptionIndex + 1, items.length - 1);
    items.forEach((it, i) => it.classList.toggle('active', i === activeOptionIndex));
    if (items[activeOptionIndex]) items[activeOptionIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeOptionIndex = Math.max(activeOptionIndex - 1, 0);
    items.forEach((it, i) => it.classList.toggle('active', i === activeOptionIndex));
    if (items[activeOptionIndex]) items[activeOptionIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (items[activeOptionIndex]) items[activeOptionIndex].dispatchEvent(new MouseEvent('mousedown'));
    else if (items.length === 1) items[0].dispatchEvent(new MouseEvent('mousedown'));
  } else if (e.key === 'Escape') {
    searchWrap.classList.remove('open');
    searchInput.blur();
  }
});
document.addEventListener('click', (e) => {
  if (!searchWrap.contains(e.target)) searchWrap.classList.remove('open');
});

function renderFilterTag() {
  const tag = document.getElementById('filter-tag');
  if (!DATA) { tag.innerHTML = ''; return; }
  if (state.artist === 'ALL') {
    tag.innerHTML = `Viewing <strong>all hip-hop artists</strong>`;
  } else {
    const info = DATA.artist_cards[state.artist];
    const n = info ? info.n_songs : 0;
    tag.innerHTML = `Viewing <strong>${state.artist}</strong> (n = ${n} songs)`;
  }
}

// big ass numbers
function renderBignums() {
  const container = document.getElementById('bignum-strip');
  container.innerHTML = '';
  if (!DATA) return;

  const isFiltered = state.artist !== 'ALL';
  const src = isFiltered ? DATA.artist_cards[state.artist] : DATA.overall_summary;

  const cards = isFiltered ? [
    { value: src.n_songs, label: 'Tracks by ' + state.artist },
    { value: src.avg_popularity.toFixed(1), label: 'Avg. Spotify popularity' },
    { value: fmtCompact(src.avg_genius_views || 0).replace('G', 'B'), label: 'Avg. Genius pageviews' },
    { value: (src.explicit_rate * 100).toFixed(0) + '%', label: 'Tracks marked explicit' },
  ] : [
    { value: fmtNum(src.n_songs), label: 'Tracks analyzed' },
    { value: (src.avg_popularity || 0).toFixed(1), label: 'Avg. Spotify popularity' },
    { value: fmtCompact(src.avg_genius_views || 0).replace('G', 'B'), label: 'Avg. Genius pageviews' },
    { value: src.top_artist || '–', label: 'Most-represented artist', small: true },
  ];

  cards.forEach(c => {
    const el = document.createElement('div');
    el.className = 'bignum-card';
    el.innerHTML = `
      <div class="bignum-value" style="${c.small ? 'font-size:18px; font-family:var(--font-body);' : ''}">${c.value}</div>
      <div class="bignum-label">${c.label}</div>
    `;
    container.appendChild(el);
  });
}

// scatter plot
function renderScatter() {
  const container = document.getElementById('scatter-chart');
  const existingSvg = container.querySelector('svg');
  if (existingSvg) existingSvg.remove();
  if (!DATA || !container.clientWidth || !container.clientHeight) return;

  const totalWidth = container.clientWidth;
  const totalHeight = container.clientHeight;
  const margin = { top: 8, right: 14, bottom: 40, left: 56 };
  const width = Math.max(50, totalWidth - margin.left - margin.right);
  const height = Math.max(50, totalHeight - margin.top - margin.bottom);

  const data = DATA.scatter.filter(d => d.genius_views > 0);
  if (data.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'wc-empty';
    emptyMsg.textContent = 'No genius-views data available.';
    container.appendChild(emptyMsg);
    return;
  }

  const svgRoot = d3.select(container).insert('svg', '.zoom-controls')
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

  svgRoot.append('defs').append('clipPath')
    .attr('id', 'scatter-clip')
    .append('rect')
    .attr('width', width)
    .attr('height', height);

  const rootG = svgRoot.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLog().domain(d3.extent(data, d => d.genius_views)).range([0, width]).nice();
  const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

  const xAxisG = rootG.append('g').attr('class', 'axis').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(4, '~s').tickSizeOuter(0));
  const yAxisG = rootG.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0));

  const gridG = rootG.insert('g', ':first-child').attr('class', 'gridline')
    .selectAll('line').data(y.ticks(4)).join('line')
    .attr('x1', 0).attr('x2', width).attr('y1', d => y(d)).attr('y2', d => y(d));

  rootG.append('text').attr('x', width / 2).attr('y', height + 34).attr('text-anchor', 'middle')
    .style('font-size', '12.5px').style('font-weight', '600').style('fill', 'var(--ink-dim)').text('Genius pageviews (log scale)');

  rootG.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -42).attr('text-anchor', 'middle')
    .style('font-size', '12.5px').style('font-weight', '600').style('fill', 'var(--ink-dim)').text('Spotify popularity');

  const isFiltered = state.artist !== 'ALL';

  const plotArea = rootG.append('g').attr('clip-path', 'url(#scatter-clip)');

  const circles = plotArea.append('g').selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => x(d.genius_views))
    .attr('cy', d => y(d.popularity))
    .attr('r', d => (isFiltered && d.principal_artist_name === state.artist) ? 6 : 3.2)
    .attr('fill', d => (isFiltered && d.principal_artist_name === state.artist) ? '#F2B705' : '#E8432F')
    .attr('fill-opacity', d => {
      if (!isFiltered) return 0.45;
      return d.principal_artist_name === state.artist ? 0.95 : 0.12;
    })
    .style('cursor', d => {
      if (!isFiltered) return 'pointer';
      return d.principal_artist_name === state.artist ? 'pointer' : 'default';
    })
    .style('pointer-events', d => {
      if (!isFiltered) return 'auto';
      return d.principal_artist_name === state.artist ? 'auto' : 'none';
    })
    .on('mousemove', (event, d) => {
      showTooltip(
        `<strong>${d.track_name}</strong><br>${d.principal_artist_name} · ${d.year}<br>Popularity: ${d.popularity}<br>Genius views: ${fmtNum(d.genius_views)}`,
        event.clientX, event.clientY
      );
    })
    .on('mouseleave', hideTooltip);

  // regression line
  const logX = data.map(d => Math.log10(d.genius_views));
  const yVals = data.map(d => d.popularity);
  const meanX = d3.mean(logX), meanY = d3.mean(yVals);
  const slope = d3.sum(logX.map((xv, i) => (xv - meanX) * (yVals[i] - meanY))) /
                d3.sum(logX.map(xv => (xv - meanX) ** 2));
  const intercept = meanY - slope * meanX;
  const lineData = d3.extent(data, d => d.genius_views).map(v => ({
    genius_views: v,
    popularity: intercept + slope * Math.log10(v)
  }));

  const regressionPath = plotArea.append('path').datum(lineData)
    .attr('fill', 'none').attr('stroke', 'var(--ink-dim)').attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,4')
    .attr('d', d3.line().x(d => x(d.genius_views)).y(d => y(d.popularity)));

  // zoom viz 1
  const zoomRect = rootG.insert('rect', () => plotArea.node())
    .attr('width', width).attr('height', height)
    .attr('fill', 'none').attr('pointer-events', 'all');

  const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .translateExtent([[0, 0], [width, height]])
    .extent([[0, 0], [width, height]])
    .on('zoom', (event) => {
      const zx = event.transform.rescaleX(x);
      const zy = event.transform.rescaleY(y);
      xAxisG.call(d3.axisBottom(zx).ticks(4, '~s').tickSizeOuter(0));
      yAxisG.call(d3.axisLeft(zy).ticks(4).tickSizeOuter(0));
      gridG.attr('y1', d => zy(d)).attr('y2', d => zy(d));
      circles.attr('cx', d => zx(d.genius_views)).attr('cy', d => zy(d.popularity));
      regressionPath.attr('d', d3.line().x(d => zx(d.genius_views)).y(d => zy(d.popularity)));
    });

  zoomRect.call(zoom);

  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomResetBtn = document.getElementById('zoom-reset-btn');

  zoomInBtn.onclick = () => zoomRect.transition().duration(200).call(zoom.scaleBy, 1.5);
  zoomOutBtn.onclick = () => zoomRect.transition().duration(200).call(zoom.scaleBy, 1 / 1.5);
  zoomResetBtn.onclick = () => zoomRect.transition().duration(300).call(zoom.transform, d3.zoomIdentity);

  const corrGeniusViews = DATA.correlations.find(c => c.feature === 'genius_views');
  const corrText = corrGeniusViews ? corrGeniusViews.corr.toFixed(2) : '?';
  document.getElementById('scatter-insight').innerHTML =
    `Genius pageviews have a moderate positive correlation (r≈${corrText}) with Spotify popularity, suggesting audience engagement extends across platforms.`;
}

// word cloud song dropdown
const wcSongFilter = document.getElementById('wc-song-filter');

function populateSongFilter() {
  wcSongFilter.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = 'ALL';
  allOpt.textContent = state.artist === 'ALL' ? 'All Songs' : `All ${state.artist} Songs`;
  wcSongFilter.appendChild(allOpt);

  if (state.artist !== 'ALL' && DATA && DATA.song_list_by_artist[state.artist]) {
    DATA.song_list_by_artist[state.artist].forEach(song => {
      const opt = document.createElement('option');
      opt.value = song;
      opt.textContent = song;
      wcSongFilter.appendChild(opt);
    });
  }
  wcSongFilter.value = 'ALL';
}

wcSongFilter.addEventListener('change', (e) => {
  state.song = e.target.value;
  renderWordCloud();
});

// word cloud
function renderWordCloud() {
  const container = document.getElementById('wordcloud-canvas');
  container.innerHTML = '';
  if (!DATA) return;

  const sub = document.getElementById('wordcloud-sub');
  if (state.artist === 'ALL') {
    sub.textContent = 'All Hip-Hop Artists · All Songs';
  } else if (state.song === 'ALL') {
    sub.textContent = `${state.artist} · All Songs`;
  } else {
    sub.textContent = `${state.artist} · ${state.song}`;
  }

  let words;
  if (state.artist === 'ALL') {
    words = DATA.overall_wordcloud;
  } else if (state.song !== 'ALL') {
    const key = `${state.song}|||${state.artist}`;
    words = DATA.song_wordcloud[key];
  } else {
    words = DATA.artist_wordcloud[state.artist];
  }

  if (!words || words.length === 0) {
    container.innerHTML = '<div class="wc-empty">No lyric data available for this selection.</div>';
    return;
  }

  words = words.slice(0, 90);
  const maxCount = words[0][1];
  const minCount = words[words.length - 1][1];

  const totalWidth = container.clientWidth || 800;
  const totalHeight = container.clientHeight || 200;
  if (!totalWidth || !totalHeight) return;

  const colors = ['#E8432F', '#F2B705', '#F2EDE4', '#8A8590', '#c9603f'];
  const fontScale = d3.scaleSqrt().domain([minCount, maxCount]).range([9, Math.min(totalHeight * 0.24, 52)]);

  const cloudWords = words.map(([text, count], i) => ({
    text, count, size: fontScale(count), color: colors[i % colors.length],
  }));

  const seedString = words.map(w => w[0] + w[1]).join('|');
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
  }
  function seededRandom() {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed % 233280) / 233280;
  }

  const layout = d3.layout.cloud()
    .size([totalWidth, totalHeight])
    .words(cloudWords)
    .padding(1.5)
    .rotate(() => (seededRandom() < 0.25 ? (seededRandom() < 0.5 ? -90 : 90) : 0))
    .random(seededRandom)
    .font('sans-serif')
    .fontWeight(800)
    .fontSize(d => d.size)
    .on('end', draw);

  layout.start();

  function draw(placedWords) {
    const svg = d3.select(container).append('svg').attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

    const halfWidths = placedWords.map(d => (d.text.length * d.size * 0.3) + 4); 
    const xs = placedWords.map(d => d.x);
    const ys = placedWords.map(d => d.y);
    const minX = Math.min(...xs) - 20, maxX = Math.max(...xs) + 20;
    const minY = Math.min(...ys) - 20, maxY = Math.max(...ys) + 20;
    const boxWidth = maxX - minX || 1;
    const boxHeight = maxY - minY || 1;

    const paddingFraction = 0.92; // 
    const scale = Math.min(
      (totalWidth * paddingFraction) / boxWidth,
      (totalHeight * paddingFraction) / boxHeight
    );

    const g = svg.append('g')
      .attr('transform', `translate(${totalWidth / 2},${totalHeight / 2}) scale(${scale})`);

    g.selectAll('text').data(placedWords).join('text')
      .style('font-family', 'var(--font-display)')
      .style('font-weight', 800)
      .style('fill', d => d.color)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.size + 'px')
      .attr('transform', d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
      .text(d => d.text)
      .append('title')
      .text(d => `"${d.text}" · ${d.count} occurrence${d.count === 1 ? '' : 's'}`);
  }
}

// correlation diverging bar
function renderCorrChart() {
  const container = document.getElementById('corr-chart');
  container.innerHTML = '';
  if (!DATA || !container.clientWidth || !container.clientHeight) return;

  document.getElementById('corr-n').textContent = fmtNum(DATA.overall_summary.n_songs);

  const data = DATA.correlations;
  const totalWidth = container.clientWidth;
  const totalHeight = container.clientHeight;
  const margin = { top: 4, right: 54, bottom: 4, left: 210 };
  const labelBuffer = 45; // empty gap between where row labels end and the zero-line/bars begin
  const width = Math.max(50, totalWidth - margin.left - margin.right);
  const height = Math.max(50, totalHeight - margin.top - margin.bottom);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
    .append('g')
    .attr('transform', `translate(${margin.left + labelBuffer},${margin.top})`);

  const extent = d3.extent(data, d => d.corr);
  const x = d3.scaleLinear().domain([Math.min(-0.05, extent[0] * 1.15), Math.max(0.05, extent[1] * 1.15)]).range([0, width - labelBuffer]);
  const y = d3.scaleBand().domain(data.map(d => d.label)).range([0, height]).padding(0.32);

  svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', height).attr('stroke', 'var(--line)');

  svg.append('g').selectAll('rect').data(data).join('rect')
    .attr('y', d => y(d.label)).attr('height', y.bandwidth())
    .attr('x', d => x(Math.min(0, d.corr))).attr('width', d => Math.abs(x(d.corr) - x(0)))
    .attr('fill', d => d.corr >= 0 ? '#F2B705' : '#E8432F')
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => {
      showTooltip(`<strong>${d.label}</strong><br>r = ${d.corr.toFixed(3)} with popularity`, event.clientX, event.clientY);
    })
    .on('mouseleave', hideTooltip);

  svg.append('g').selectAll('text.value').data(data).join('text')
    .attr('y', d => y(d.label) + y.bandwidth() / 2 + 5)
    .attr('x', d => {
      const barFarEdge = x(d.corr);
      const zeroLine = x(0);
      const barLength = Math.abs(barFarEdge - zeroLine);
      const minOffset = 14;
      if (d.corr >= 0) {

        return barLength < minOffset ? zeroLine + minOffset : barFarEdge + 8;
      } else {
        return barLength < minOffset ? zeroLine - minOffset : barFarEdge - 8;
      }
    })
    .attr('text-anchor', d => d.corr >= 0 ? 'start' : 'end')
    .style('font-family', 'var(--font-mono)').style('font-size', '14px').style('font-weight', '700').style('fill', 'var(--ink)')
    .text(d => (d.corr >= 0 ? '+' : '') + d.corr.toFixed(2));

  svg.append('g').selectAll('text.label').data(data).join('text')
    .attr('y', d => y(d.label) + y.bandwidth() / 2 + 5)
    .attr('x', -labelBuffer - 10).attr('text-anchor', 'end')
    .style('font-size', '14px').style('font-weight', '600').style('fill', 'var(--ink)')
    .text(d => d.label);

  const strongest = data[data.length - 1];
  document.getElementById('corr-insight').innerHTML =
    `Audio and lyrical features show weak correlations with popularity, while Genius pageviews exhibit the strongest relationship (<strong>r=0.31</strong>).`;
}

// timeline
function renderTimeline() {
  const container = document.getElementById('timeline-chart');
  container.innerHTML = '';
  if (!DATA || !container.clientWidth || !container.clientHeight) return;

  const data = DATA.timeline;
  if (!data.length) { container.innerHTML = '<div class="wc-empty">No timeline data.</div>'; return; }

  const totalWidth = container.clientWidth;
  const totalHeight = container.clientHeight;
  const margin = { top: 10, right: 40, bottom: 22, left: 32 };
  const width = Math.max(50, totalWidth - margin.left - margin.right);
  const height = Math.max(50, totalHeight - margin.top - margin.bottom);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scalePoint().domain(data.map(d => d.decade)).range([0, width]).padding(0.5);
  const yPop = d3.scaleLinear().domain([0, 100]).range([height, 0]);
  const lexExtent = d3.extent(data, d => d.lexical_diversity);
  const yLex = d3.scaleLinear().domain(lexExtent[0] === lexExtent[1] ? [0, lexExtent[1] * 2] : lexExtent).nice().range([height, 0]);

  svg.append('g').attr('class', 'gridline').selectAll('line').data(yPop.ticks(4)).join('line')
    .attr('x1', 0).attr('x2', width).attr('y1', d => yPop(d)).attr('y2', d => yPop(d));

  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).tickFormat(d => "'" + String(d).slice(2) + 's'));
  svg.append('g').attr('class', 'axis').call(d3.axisLeft(yPop).ticks(4));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${width},0)`)
    .call(d3.axisRight(yLex).ticks(4).tickFormat(d3.format('.2f')));

  svg.append('path').datum(data).attr('fill', 'var(--gold)').attr('fill-opacity', 0.12)
    .attr('d', d3.area().x(d => x(d.decade)).y0(height).y1(d => yPop(d.popularity)).curve(d3.curveMonotoneX));
  svg.append('path').datum(data).attr('fill', 'none').attr('stroke', 'var(--gold)').attr('stroke-width', 2.5)
    .attr('d', d3.line().x(d => x(d.decade)).y(d => yPop(d.popularity)).curve(d3.curveMonotoneX));
  svg.append('path').datum(data).attr('fill', 'none').attr('stroke', 'var(--red)').attr('stroke-width', 2.5)
    .attr('stroke-dasharray', '6,4')
    .attr('d', d3.line().x(d => x(d.decade)).y(d => yLex(d.lexical_diversity)).curve(d3.curveMonotoneX));

  ['popularity', 'lexical_diversity'].forEach((key, i) => {
    const scale = i === 0 ? yPop : yLex;
    const color = i === 0 ? 'var(--gold)' : 'var(--red)';
    svg.append('g').selectAll(`circle.${key}`).data(data).join('circle')
      .attr('cx', d => x(d.decade)).attr('cy', d => scale(d[key])).attr('r', 5).attr('fill', color)
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        showTooltip(
          `<strong>${d.decade}s</strong> (n=${d.n})<br>Popularity: ${d.popularity.toFixed(1)}<br>Lexical diversity: ${d.lexical_diversity.toFixed(3)}`,
          event.clientX, event.clientY
        );
      })
      .on('mouseleave', hideTooltip);
  });

  const first = data[0], last = data[data.length - 1];
  document.getElementById('timeline-insight').innerHTML =
    'Popularity has increased over time while lexical diversity has declined, suggesting simpler lyrics are more common in recent hits.';
}

// big ass unmbers
function renderExplicitChart() {
  const container = document.getElementById('explicit-chart');
  container.innerHTML = '';
  if (!DATA || !container.clientWidth || !container.clientHeight) return;

  const data = [
    { label: 'Clean', value: DATA.overall_summary.clean_pop || 0 },
    { label: 'Explicit', value: DATA.overall_summary.explicit_pop || 0 },
  ];

  const totalWidth = container.clientWidth;
  const totalHeight = container.clientHeight;
  const margin = { top: 4, right: 40, bottom: 4, left: 85 };
  const width = Math.max(50, totalWidth - margin.left - margin.right);
  const height = Math.max(30, totalHeight - margin.top - margin.bottom);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, 100]).range([0, width]);
  const y = d3.scaleBand().domain(data.map(d => d.label)).range([0, height]).padding(0.35);

  svg.append('g').selectAll('rect').data(data).join('rect')
    .attr('y', d => y(d.label)).attr('x', 0).attr('height', y.bandwidth())
    .attr('width', d => x(d.value))
    .attr('fill', (d, i) => i === 0 ? 'var(--ink-faint)' : 'var(--red)')
    .attr('rx', 2);

  svg.append('g').selectAll('text.val').data(data).join('text')
    .attr('y', d => y(d.label) + y.bandwidth() / 2 + 4).attr('x', d => x(d.value) + 6)
    .style('font-family', 'var(--font-mono)').style('font-size', '12px').style('fill', 'var(--ink)')
    .text(d => d.value.toFixed(1));

  svg.append('g').selectAll('text.label').data(data).join('text')
    .attr('y', d => y(d.label) + y.bandwidth() / 2 + 4).attr('x', -8).attr('text-anchor', 'end')
    .style('font-size', '12.5px').style('font-weight', '600').style('fill', 'var(--ink-dim)')
    .text(d => d.label);

  document.getElementById('cards-insight').innerHTML =
    `Explicit tracks average slightly higher popularity than clean tracks (<strong>${data[1].value.toFixed(1)}</strong> vs. <strong>${data[0].value.toFixed(1)}</strong>).`;
}

//  subgenre breakdown
function renderSubgenreChart() {
  const container = document.getElementById('subgenre-chart');
  container.innerHTML = '';
  if (!DATA || !container.clientWidth || !container.clientHeight) return;

  const data = DATA.subgenre_breakdown;
  if (!data || !data.length) {
    container.innerHTML = '<div class="wc-empty">No subgenre data available.</div>';
    return;
  }

  const totalWidth = container.clientWidth;
  const totalHeight = container.clientHeight;
  const margin = { top: 4, right: 60, bottom: 4, left: 180 };
  const width = Math.max(50, totalWidth - margin.left - margin.right);
  const height = Math.max(50, totalHeight - margin.top - margin.bottom);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, d3.max(data, d => d.avg_popularity) * 1.1]).range([0, width]);
  const y = d3.scaleBand().domain(data.map(d => d.bucket)).range([0, height]).padding(0.28);

  // colorscale
  const colorScale = d3.scaleLinear()
    .domain([data.length - 1, 0])
    .range(['#8a5a3a', '#F2B705']);

  svg.append('g').selectAll('rect').data(data).join('rect')
    .attr('y', d => y(d.bucket)).attr('height', y.bandwidth())
    .attr('x', 0).attr('width', d => x(d.avg_popularity))
    .attr('fill', (d, i) => colorScale(i))
    .attr('rx', 2)
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => {
      showTooltip(`<strong>${d.bucket}</strong><br>Avg. popularity: ${d.avg_popularity.toFixed(1)}<br>${fmtNum(d.n)} tracks`, event.clientX, event.clientY);
    })
    .on('mouseleave', hideTooltip);

  svg.append('g').selectAll('text.value').data(data).join('text')
    .attr('y', d => y(d.bucket) + y.bandwidth() / 2 + 4)
    .attr('x', d => x(d.avg_popularity) + 8)
    .style('font-family', 'var(--font-mono)').style('font-size', '12.5px').style('font-weight', '700').style('fill', 'var(--ink)')
    .text(d => d.avg_popularity.toFixed(1));

  svg.append('g').selectAll('text.label').data(data).join('text')
    .attr('y', d => y(d.bucket) + y.bandwidth() / 2 + 4)
    .attr('x', -8).attr('text-anchor', 'end')
    .style('font-size', '12px').style('font-weight', '600').style('fill', 'var(--ink)')
    .text(d => d.bucket);

  const top = data[0], bottom = data[data.length - 1];
  document.getElementById('subgenre-insight').innerHTML =
    `<strong>${top.bucket}</strong> leads at ${top.avg_popularity.toFixed(1)} avg. popularity; <strong>${bottom.bucket}</strong> trails at ${bottom.avg_popularity.toFixed(1)}.`;
}

// render
function renderAll() {
  renderFilterTag();
  renderBignums();
  populateSongFilter();
  renderScatter();
  renderWordCloud();
  renderCorrChart();
  renderTimeline();
  renderExplicitChart();
  renderSubgenreChart();
}

window.addEventListener('resize', renderAll);

// init
loadDefaultDataset();

