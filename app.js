// ===== SGRSW Viewer App Logic =====
const DATA = window.SGRSW_CONTENT;
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

// ---------- User Agreement gate ----------
(function initAgreementGate(){
  const overlay = $('#agreement-overlay');
  const dontShowKey = 'sgrsw_agreement_dontshow';

  // Testing aid: visiting the page with ?resetAgreement=1 always forces the gate to show,
  // regardless of the saved "don't show again" preference. Useful when testing locally.
  const forceShow = new URLSearchParams(window.location.search).get('resetAgreement') === '1';
  if(forceShow){
    try { localStorage.removeItem(dontShowKey); } catch(e){ /* ignore */ }
  }

  let alreadyAgreed = false;
  try { alreadyAgreed = !forceShow && localStorage.getItem(dontShowKey) === '1'; } catch(e){ /* storage unavailable, always show gate */ }

  if(alreadyAgreed){
    overlay.classList.add('hidden');
    return;
  }

  const agreeCheck = $('#agreement-agree-check');
  const dontShowCheck = $('#agreement-dontshow-check');
  const acceptBtn = $('#agreement-accept-btn');

  agreeCheck.addEventListener('change', () => {
    acceptBtn.disabled = !agreeCheck.checked;
  });

  acceptBtn.addEventListener('click', () => {
    if(dontShowCheck.checked){
      try { localStorage.setItem(dontShowKey, '1'); } catch(e){ /* ignore storage errors */ }
    }
    overlay.classList.add('hidden');
  });

  [['disclaimer-toggle','disclaimer-text'], ['copyright-toggle','copyright-text']].forEach(([btnId, textId]) => {
    const btn = $('#'+btnId);
    const text = $('#'+textId);
    btn.addEventListener('click', () => {
      const isOpen = text.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen ? 'true':'false');
    });
  });
})();

const sidebar = $('#sidebar');
const contentInner = $('#content-inner');
const searchbox = $('#searchbox');
const searchClear = $('#search-clear');

// ---------- Routing state ----------
let state = { tab: 'home', chapter: null, section: null, drawing: null, map: null, query: '' };

function setState(partial){
  state = Object.assign({}, state, partial);
  render();
  window.scrollTo(0,0);
  contentInner.parentElement.scrollTop = 0;
  closeSidebarMobile();
}

// ---------- Sidebar ----------
let openDrawingGroups = new Set(); // tracks which drawing category groups are expanded in the sidebar

function renderSidebar(){
  let html = '';
  html += `<div class="sidebar-sticky-header">
    <div class="tab-row tab-row-wrap">
      <button class="tab-btn ${state.tab==='home'?'active':''}" data-tab="home">Home</button>
      <button class="tab-btn ${state.tab==='standards'?'active':''}" data-tab="standards">Standards</button>
      <button class="tab-btn ${state.tab==='drawings'?'active':''}" data-tab="drawings">Drawings</button>
      <button class="tab-btn ${state.tab==='maps'?'active':''}" data-tab="maps">Maps</button>
      <button class="tab-btn ${state.tab==='annexures'?'active':''}" data-tab="annexures">Annexures</button>
    </div>
    <button class="sidebar-info-link ${state.tab==='info'?'active':''}" data-tab="info">&#8505;&nbsp; Information</button>
  </div>`;

  if(state.tab === 'standards'){
    html += '<div class="sidebar-section-label">Chapters</div>';
    DATA.chapters.forEach(c => {
      const isActiveChapter = state.chapter === c.num;
      html += `<button class="chapter-item ${isActiveChapter && !state.section ? 'active':''}" data-chapter="${c.num}">
        <span class="chapter-num">${c.num}.</span>${escapeHtml(c.title)}
      </button>`;
      html += `<div class="section-list ${isActiveChapter ? 'open':''}" data-section-list="${c.num}">`;
      c.sections.forEach(s => {
        const isActiveSection = isActiveChapter && state.section === s.num;
        html += `<button class="section-item ${isActiveSection?'active':''}" data-chapter="${c.num}" data-section="${s.num}">${s.num} ${escapeHtml(s.title)}</button>`;
      });
      html += `</div>`;
    });
  } else if(state.tab === 'drawings'){
    const cats = ['Roads','Road Marking & Road Signs','Stormwater','General'];
    cats.forEach(cat => {
      const items = DATA.drawings.filter(d => d.category === cat);
      if(!items.length) return;
      const isOpen = openDrawingGroups.has(cat);
      html += `<button class="drawing-cat-toggle ${isOpen?'open':''}" data-toggle-cat="${escapeHtml(cat)}">
        <span class="cat-chevron">&#9656;</span>
        <span class="cat-label">${escapeHtml(cat)}</span>
        <span class="cat-count">${items.length}</span>
      </button>`;
      html += `<div class="drawing-cat-list ${isOpen?'open':''}">`;
      items.forEach(d => {
        const isActive = state.drawing === d.num;
        html += `<button class="drawing-item ${isActive?'active':''}" data-drawing="${d.num}">
          <span class="num">${d.num}</span><span class="desc">${escapeHtml(d.description)}</span>
        </button>`;
      });
      html += `</div>`;
    });
  } else if(state.tab === 'maps'){
    html += '<div class="sidebar-section-label">Maps (Part C)</div>';
    DATA.maps.forEach(m => {
      const isActive = state.map === m.id;
      html += `<button class="map-item ${isActive?'active':''}" data-map="${m.id}">
        <span class="desc"><strong style="color:var(--ink);">${escapeHtml(m.title)}</strong></span>
      </button>`;
    });
  } else if(state.tab === 'home'){
    html += `<div class="sidebar-empty-hint">
      <p>Use the tabs above to browse the Standards, Drawings, Maps, or Annexures.</p>
    </div>`;
  } else if(state.tab === 'annexures'){
    html += `<div class="sidebar-empty-hint">
      <p>All annexures are listed in the main panel and available as a single download.</p>
    </div>`;
  }

  sidebar.innerHTML = html;
  attachSidebarHandlers();
}

function attachSidebarHandlers(){
  $$('[data-toggle-cat]').forEach(b => b.addEventListener('click', () => {
    const cat = b.dataset.toggleCat;
    if(openDrawingGroups.has(cat)) openDrawingGroups.delete(cat);
    else openDrawingGroups.add(cat);
    renderSidebar();
  }));
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => {
    setState({tab:b.dataset.tab, chapter:null, section:null, drawing:null, map:null, query:''});
    searchbox.value='';
    toggleClear();
  }));
  $$('.chapter-item').forEach(b => b.addEventListener('click', () => {
    const chNum = parseInt(b.dataset.chapter);
    if(state.chapter === chNum && !state.section){
      // collapse
      setState({chapter:null, section:null});
    } else {
      setState({chapter:chNum, section:null, query:''});
      searchbox.value='';
      toggleClear();
      // scroll the clicked chapter to the top of the sidebar's visible area so its sections are reachable
      requestAnimationFrame(() => {
        const el = sidebar.querySelector(`.chapter-item[data-chapter="${chNum}"]`);
        if(el) el.scrollIntoView({block:'start', behavior:'smooth'});
      });
    }
  }));
  $$('.section-item').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    setState({chapter:parseInt(b.dataset.chapter), section:b.dataset.section, query:''});
    searchbox.value='';
    toggleClear();
  }));
  $$('.drawing-item').forEach(b => b.addEventListener('click', () => {
    setState({drawing:b.dataset.drawing, query:''});
    searchbox.value='';
    toggleClear();
  }));
  $$('.map-item').forEach(b => b.addEventListener('click', () => {
    setState({map:parseInt(b.dataset.map), query:''});
    searchbox.value='';
    toggleClear();
  }));
  $$('.sidebar-info-link').forEach(b => b.addEventListener('click', () => {
    setState({tab:'info', chapter:null, section:null, drawing:null, map:null, query:''});
    searchbox.value='';
    toggleClear();
  }));
}

// ---------- Content rendering ----------
function render(){
  renderSidebar();
  if(state.query){
    renderSearchResults();
  } else if(state.tab === 'home'){
    renderHome();
  } else if(state.tab === 'info'){
    renderInfo();
  } else if(state.tab === 'annexures'){
    renderAnnexures();
  } else if(state.tab === 'standards'){
    if(state.chapter && state.section){
      renderSectionDetail();
    } else if(state.chapter){
      renderChapterOverview();
    } else {
      renderStandardsLanding();
    }
  } else if(state.tab === 'drawings'){
    if(state.drawing){
      renderDrawingDetail();
    } else {
      renderDrawingsOverview();
    }
  } else if(state.tab === 'maps'){
    if(state.map){
      renderMapDetail();
    } else {
      renderMapsOverview();
    }
  }
}

function crumbs(parts){
  let html = '<div class="crumbs">';
  parts.forEach((p,i) => {
    if(i>0) html += '<span class="sep">/</span>';
    if(p.action){
      html += `<button data-crumb="${i}">${escapeHtml(p.label)}</button>`;
    } else {
      html += `<span>${escapeHtml(p.label)}</span>`;
    }
  });
  html += '</div>';
  return html;
}

function attachCrumbHandlers(actions){
  $$('[data-crumb]').forEach(b => {
    b.addEventListener('click', () => actions[parseInt(b.dataset.crumb)]());
  });
}

function renderHome(){
  contentInner.innerHTML = `
    <div class="welcome">
      <div class="doc-eyebrow">City of Cape Town</div>
      <h1>Standards and Guidelines for Roads &amp; Stormwater</h1>
      <p>A reference viewer for the City of Cape Town's Standards and Guidelines for Roads &amp; Stormwater (SGRSW).</p>
      <p>Browse all chapters of the SGRSW document, search across the full text, view the related drawings and maps, and download the latest annexures.</p>
      <p>Navigate to the Standards, Drawings or Maps on the left to begin, or use the search bar above to jump straight to a topic.</p>
      <p>For more information regarding queries, subscribing to the SGRSW, accessing the SGRSW SharePoint site and the Change Logs, visit the <button class="inline-link-btn" data-goto-info="1">Information Page</button>.</p>
    </div>
  `;
  const infoBtn = $('[data-goto-info]');
  if(infoBtn) infoBtn.addEventListener('click', () => setState({tab:'info'}));
}

function renderInfo(){
  contentInner.innerHTML = `
    <div class="welcome">
      <div class="doc-eyebrow">Information</div>
      <h1>Information</h1>

      <div class="info-block">
        <h3>Contact</h3>
        <p>For any comments, enquiries, requests or feedback relating to this document, please contact:</p>
        <p><a href="mailto:StandardsGuidelines.RSW@capetown.gov.za">StandardsGuidelines.RSW@capetown.gov.za</a></p>
      </div>

      <div class="info-block">
        <h3>SGRSW Document Download</h3>
        <p>The SGRSW document can be downloaded from the City's <a href="https://www.capetown.gov.za/Family%20and%20home/City-publications/publications-and-reports/transport" target="_blank" rel="noopener">Transport Resources</a> website, under the Guidelines section.</p>
        <p>Alternatively, download the document directly using the link below:</p>
        <a class="info-action-btn" href="https://resource.capetown.gov.za/documentcentre/Documents/Procedures%2c%20guidelines%20and%20regulations/Standards_Guidelines_RSW.pdf" target="_blank" rel="noopener">Download SGRSW &rarr;</a>
      </div>

      <div class="info-block">
        <h3>Subscribe for updates</h3>
        <p>Subscribe to the SGRSW to receive notifications and updates regarding the document.</p>
        <a class="info-action-btn" href="https://cityofcapetown.everlytic.net/public/forms/h/IfZQ692lhyAycBCc/Mjc2MzlkNzU1MDkyZTBlOTk1MDU4ODIxOTkwNDZhZWZkNDAxNjkyMA" target="_blank" rel="noopener">Subscribe to SGRSW updates &rarr;</a>
      </div>

      <div class="info-block">
        <h3>SGRSW SharePoint site</h3>
        <p>Access the SGRSW team SharePoint site.</p>
        <a class="info-action-btn" href="https://cityofcapetowngov.sharepoint.com/sites/team-SGRSD" target="_blank" rel="noopener">Open SharePoint site &rarr;</a>
        <p style="margin-top:14px;">New users will be required to <a href="https://web1.capetown.gov.za/web1/registration" target="_blank" rel="noopener">register an Extranet account</a> before access can be granted. Once the registration and account verification is complete, send an email to <a href="mailto:StandardsGuidelines.RSW@capetown.gov.za">StandardsGuidelines.RSW@capetown.gov.za</a> and request access to the SGRSW site.</p>
      </div>

      <div class="info-block">
        <h3>Change logs</h3>
        <p>Download a record of changes made between document versions.</p>
        <a class="info-action-btn" href="https://resource.capetown.gov.za/cityassets/Media%20Centre%20Assets/SGRSW_ChangeLogs.zip" target="_blank" rel="noopener">Download change logs &rarr;</a>
      </div>
    </div>
  `;
}

function renderAnnexures(){
  let html = `
    <div class="welcome">
      <div class="doc-eyebrow">Annexures</div>
      <h1>Annexures</h1>
      <p>All Annexures are provided in Microsoft Excel format. Completed Annexures shall be submitted in Microsoft Excel format.</p>
      <p>Annexures can be accessed/downloaded using the following link:</p>
      <a class="info-action-btn" href="https://resource.capetown.gov.za/cityassets/Media%20Centre%20Assets/SGRSW_Annexures.zip" target="_blank" rel="noopener">Download all Annexures &rarr;</a>
      <ul class="annexure-summary-list">
  `;
  const annexures = [
    {letter:'A', title:'Asset Register'},
    {letter:'B', title:'Design Checklist'},
    {letter:'C', title:'As-Built Checklist'},
  ];
  annexures.forEach(a => {
    html += `<li><strong>ANNEXURE ${a.letter}:</strong> ${escapeHtml(a.title)}</li>`;
  });
  html += `</ul>
    </div>`;
  contentInner.innerHTML = html;
}

function renderStandardsLanding(){
  contentInner.innerHTML = `
    <div class="welcome">
      <div class="doc-eyebrow">Part A</div>
      <h1>Standards</h1>
      <p>Browse all chapters of the SGRSW document. The full text is included. Figures and tables are embedded in-line — click on figures and tables to expand for more detail.</p>
      <p>Select a chapter from the left to begin or use the search bar above to jump straight to a topic.</p>
    </div>
  `;
}

function renderChapterOverview(){
  const c = DATA.chapters.find(x => x.num === state.chapter);
  if(!c) return renderStandardsLanding();
  const nextChapter = DATA.chapters.find(x => x.num === state.chapter + 1);

  let html = crumbs([{label:'Standards', action:true}, {label:`Chapter ${c.num}`}]);
  html += `<div class="doc-eyebrow">Chapter ${c.num}</div>`;
  html += `<h1 class="doc-h1">${escapeHtml(c.title)}</h1>`;
  html += `<div class="doc-meta">${c.sections.length} section${c.sections.length!==1?'s':''}</div>`;

  if(c.num === 20 && DATA.references && DATA.references.length){
    html += renderReferencesTable();
    contentInner.innerHTML = html;
    attachCrumbHandlers([() => setState({chapter:null, section:null})]);
    attachReferenceChapterLinks();
    return;
  }

  if(c.intro){
    html += `<div class="section-body">${formatBody(c.intro, c.num, null)}</div>`;
  }
  if(c.sections.length){
    html += `<div style="margin-top:30px;"><div class="doc-eyebrow">Sections in this chapter</div>`;
    c.sections.forEach(s => {
      html += `<button class="result-card" data-goto-section="${s.num}" style="margin-bottom:8px;">
        <div class="result-title" style="font-size:14.5px;">${s.num} &middot; ${escapeHtml(s.title)}</div>
      </button>`;
    });
    html += `</div>`;
  }

  // Next chapter button
  if(nextChapter){
    html += `<div style="display:flex;justify-content:flex-end;margin-top:40px;padding-top:20px;border-top:1px solid var(--line);">
      <button class="result-card" style="max-width:46%;text-align:right;" data-goto-chapter="${nextChapter.num}">
        <div style="font-size:11px;color:var(--ink-soft);margin-bottom:3px;">NEXT CHAPTER &rarr;</div>
        <div class="result-title" style="font-size:13.5px;">Chapter ${nextChapter.num}: ${escapeHtml(nextChapter.title)}</div>
      </button>
    </div>`;
  }

  contentInner.innerHTML = html;
  attachCrumbHandlers([() => setState({chapter:null, section:null})]);
  $$('[data-goto-section]').forEach(b => b.addEventListener('click', () => {
    setState({section: b.dataset.gotoSection});
  }));
  const nextBtn = $('[data-goto-chapter]');
  if(nextBtn) nextBtn.addEventListener('click', () => {
    setState({chapter: parseInt(nextBtn.dataset.gotoChapter), section: null});
  });
  attachFigureHandlers();
}

function renderReferencesTable(){
  let html = `<table class="refs-table"><thead><tr>
    <th>#</th><th>Document description</th><th>Relevant chapters</th>
  </tr></thead><tbody>`;
  DATA.references.forEach(r => {
    const chapterLinks = r.relevance.split(',').map(n => n.trim()).filter(Boolean).map(n =>
      `<a href="#" data-ref-chapter="${n}" style="margin-right:6px;">${n}</a>`
    ).join('');
    html += `<tr>
      <td class="refs-num">${r.num}</td>
      <td>${escapeHtml(r.description)}</td>
      <td class="refs-relevance">${chapterLinks}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function attachReferenceChapterLinks(){
  $$('[data-ref-chapter]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const chNum = parseInt(a.dataset.refChapter);
      if(DATA.chapters.find(c => c.num === chNum)){
        setState({chapter:chNum, section:null});
      }
    });
  });
}

function renderSectionDetail(){
  const c = DATA.chapters.find(x => x.num === state.chapter);
  if(!c) return renderStandardsLanding();
  const s = c.sections.find(x => x.num === state.section);
  if(!s) return renderChapterOverview();

  const idx = c.sections.indexOf(s);
  const prev = c.sections[idx-1];
  const next = c.sections[idx+1];

  const isLastSection = !next;
  const nextChapter = isLastSection ? DATA.chapters.find(x => x.num === state.chapter + 1) : null;

  let html = crumbs([
    {label:'Standards', action:true},
    {label:`Ch ${c.num}`, action:true},
    {label:s.num}
  ]);
  html += `<div class="doc-eyebrow">Chapter ${c.num} &middot; ${escapeHtml(c.title)}</div>`;
  html += `<h1 class="doc-h1 section-title"><span style="color:var(--ochre);">${s.num}</span> ${escapeHtml(s.title)}</h1>`;
  html += `<div class="doc-meta"></div>`;
  html += `<div class="section-body">${formatBody(s.text, c.num, s.num)}</div>`;

  html += `<div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:20px;border-top:1px solid var(--line);">`;
  html += prev ? `<button class="result-card" style="max-width:46%;" data-nav="prev"><div style="font-size:11px;color:var(--ink-soft);margin-bottom:3px;">&larr; PREVIOUS</div><div class="result-title" style="font-size:13.5px;">${prev.num} ${escapeHtml(prev.title)}</div></button>` : '<div></div>';
  if(next){
    html += `<button class="result-card" style="max-width:46%;text-align:right;" data-nav="next"><div style="font-size:11px;color:var(--ink-soft);margin-bottom:3px;">NEXT &rarr;</div><div class="result-title" style="font-size:13.5px;">${next.num} ${escapeHtml(next.title)}</div></button>`;
  } else if(nextChapter){
    html += `<button class="result-card" style="max-width:46%;text-align:right;" data-goto-chapter="${nextChapter.num}"><div style="font-size:11px;color:var(--ink-soft);margin-bottom:3px;">NEXT CHAPTER &rarr;</div><div class="result-title" style="font-size:13.5px;">Chapter ${nextChapter.num}: ${escapeHtml(nextChapter.title)}</div></button>`;
  } else {
    html += '<div></div>';
  }
  html += `</div>`;

  contentInner.innerHTML = html;
  attachCrumbHandlers([
    () => setState({chapter:null, section:null}),
    () => setState({section:null}),
  ]);
  const navPrev = $('[data-nav="prev"]'); if(navPrev) navPrev.addEventListener('click', () => setState({section:prev.num}));
  const navNext = $('[data-nav="next"]'); if(navNext) navNext.addEventListener('click', () => setState({section:next.num}));
  const nextChBtn = $('[data-goto-chapter]');
  if(nextChBtn) nextChBtn.addEventListener('click', () => setState({chapter:parseInt(nextChBtn.dataset.gotoChapter), section:null}));
  attachFigureHandlers();
}

function formatBody(text, chapterNum, sectionNum){
  const figRe = /Figure (\d+-\d+):\s*([^\n]+)/g;
  const figsInText = [];
  let m;
  while((m = figRe.exec(text)) !== null){
    figsInText.push({num:m[1], caption:m[2].trim()});
  }

  const tableRe = /Table (\d+-\d+):\s*([^\n]+)/g;
  const tablesInText = [];
  while((m = tableRe.exec(text)) !== null){
    tablesInText.push({num:m[1], caption:m[2].trim()});
  }

  let html = buildStructuredHtml(text);
  html = injectFigures(html, figsInText);
  html = injectTables(html, tablesInText);
  return html;
}

// Classify each raw line and group into blocks: paragraphs, lists, sub-headings
function buildStructuredHtml(text){
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length);
  const romanRe = /^(x{0,1}(ix|iv|v?i{0,3}))\)\s*(.*)$/i;
  const letterRe = /^([a-h])\)\s*(.*)$/;
  const subnumRe = /^(\d{1,2}\.\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\s+(.*)$/; // e.g. 3.4.1 Design Parameters
  const subnumAloneRe = /^(\d{1,2}\.\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)$/;   // number alone on its line
  const bulletGlyphRe = /^[•\uf0a8\u25aa\u2022\-]\s*(.*)$/;
  const isShortLabel = (s) => s.length < 70 && /[a-zA-Z]/.test(s) && !/[.:;]$/.test(s.trim().replace(/%\)?$/,''));

  let html = '';
  let i = 0;
  let openList = null; // 'roman' | 'letter' | 'bullet'

  function closeList(){
    if(openList){ html += `</${openList==='bullet'?'ul':'ol'}>`; openList = null; }
  }

  while(i < rawLines.length){
    let line = rawLines[i];

    // sub-heading number alone on a line, followed by a short title line -> combine as h3
    if(subnumAloneRe.test(line) && i+1 < rawLines.length && isShortLabel(rawLines[i+1])){
      closeList();
      const num = line;
      const title = rawLines[i+1];
      html += `<h3 class="body-subhead"><span class="subnum">${escapeHtml(num)}</span> ${escapeHtml(title)}</h3>`;
      i += 2;
      continue;
    }
    // sub-heading number + title on same line
    const snm = line.match(subnumRe);
    if(snm && isShortLabel(snm[2])){
      closeList();
      html += `<h3 class="body-subhead"><span class="subnum">${escapeHtml(snm[1])}</span> ${escapeHtml(snm[2])}</h3>`;
      i++;
      continue;
    }

    // roman numeral list item: "i) text" — text may continue on next line(s) until next marker or blank line
    const rm = line.match(romanRe);
    if(rm){
      if(openList !== 'roman'){ closeList(); html += '<ol class="body-list roman">'; openList = 'roman'; }
      let itemText = rm[3];
      i++;
      while(i < rawLines.length && rawLines[i] !== '' && !romanRe.test(rawLines[i]) && !letterRe.test(rawLines[i]) && !subnumAloneRe.test(rawLines[i]) && !subnumRe.test(rawLines[i]) && !/^(Figure|Table) \d+-\d+:/.test(rawLines[i])){
        itemText += ' ' + rawLines[i];
        i++;
      }
      html += `<li>${escapeHtml(itemText.trim())}</li>`;
      continue;
    }

    // letter list item: "a) text"
    const lm = line.match(letterRe);
    if(lm){
      if(openList !== 'letter'){ closeList(); html += '<ol class="body-list letter">'; openList = 'letter'; }
      let itemText = lm[2];
      i++;
      while(i < rawLines.length && rawLines[i] !== '' && !romanRe.test(rawLines[i]) && !letterRe.test(rawLines[i]) && !subnumAloneRe.test(rawLines[i]) && !subnumRe.test(rawLines[i]) && !/^(Figure|Table) \d+-\d+:/.test(rawLines[i])){
        itemText += ' ' + rawLines[i];
        i++;
      }
      html += `<li>${escapeHtml(itemText.trim())}</li>`;
      continue;
    }

    // bullet glyph alone on its own line, with item text following on next line(s)
    if(/^[•\uf0a8\u25aa\u2022]$/.test(line)){
      if(openList !== 'bullet'){ closeList(); html += '<ul class="body-list bullet">'; openList = 'bullet'; }
      i++;
      let itemText = '';
      while(i < rawLines.length && !/^[•\uf0a8\u25aa\u2022]$/.test(rawLines[i]) && !romanRe.test(rawLines[i]) && !letterRe.test(rawLines[i]) && !subnumAloneRe.test(rawLines[i]) && !/^Figure \d+-\d+:/.test(rawLines[i])){
        itemText += (itemText? ' ':'') + rawLines[i];
        i++;
      }
      html += `<li>${escapeHtml(itemText.trim())}</li>`;
      continue;
    }

    // bullet glyph item
    const bm = line.match(bulletGlyphRe);
    if(bm && bm[1]){
      if(openList !== 'bullet'){ closeList(); html += '<ul class="body-list bullet">'; openList = 'bullet'; }
      let itemText = bm[1];
      i++;
      while(i < rawLines.length && !bulletGlyphRe.test(rawLines[i]) && !romanRe.test(rawLines[i]) && !letterRe.test(rawLines[i]) && !subnumAloneRe.test(rawLines[i]) && !/^Figure \d+-\d+:/.test(rawLines[i]) && rawLines[i].length < 200){
        // only continue if next line doesn't look like a new standalone sentence start (heuristic: lowercase start or no terminal punctuation before)
        if(/^[A-Z]/.test(rawLines[i]) && /[.:]$/.test(itemText)) break;
        itemText += ' ' + rawLines[i];
        i++;
      }
      html += `<li>${escapeHtml(itemText.trim())}</li>`;
      continue;
    }

    // figure caption line -> leave as its own marker paragraph (figure injected later)
    if(/^Figure \d+-\d+:/.test(line)){
      closeList();
      html += `<p class="fig-caption-line">${escapeHtml(line)}</p>`;
      i++;
      continue;
    }

    // plain paragraph: accumulate until next classified line or blank gap
    closeList();
    let para = line;
    i++;
    while(i < rawLines.length &&
          !romanRe.test(rawLines[i]) && !letterRe.test(rawLines[i]) &&
          !subnumAloneRe.test(rawLines[i]) && !subnumRe.test(rawLines[i]) &&
          !bulletGlyphRe.test(rawLines[i]) && !/^Figure \d+-\d+:/.test(rawLines[i]) &&
          rawLines[i].length > 0 && para.length < 600){
      // heuristic: stop paragraph if current para already ends with sentence punctuation
      // and the new line looks like the start of a new sentence/topic (capitalised, reasonably short prior line)
      if(/[.:]$/.test(para) && para.length > 90){
        break;
      }
      para += ' ' + rawLines[i];
      i++;
    }
    html += `<p>${escapeHtml(para.trim())}</p>`;
  }
  closeList();
  return html;
}

function injectFigures(html, figsInText){
  figsInText.forEach(f => {
    const fig = DATA.figures.find(x => x.fig_num === f.num);
    if(!fig) return;
    const figHtml = `<div class="fig-block" data-figure="${fig.fig_num}">
      <div class="fig-thumb-wrap" data-figure-zoom="${fig.fig_num}">
        <img src="assets/figure_thumbs/${fig.thumb_filename}" alt="Figure ${fig.fig_num}: ${escapeHtml(fig.caption)}" loading="lazy">
        <div class="fig-zoom-hint">&#128270; Click to enlarge</div>
      </div>
      <div class="fig-caption"><strong>Figure ${fig.fig_num}.</strong> ${escapeHtml(fig.caption)}</div>
    </div>`;
    const marker = `Figure ${f.num}:`;
    const idx = html.indexOf(escapeHtml(marker));
    if(idx !== -1){
      const closeTag = html.indexOf('</p>', idx);
      if(closeTag !== -1){
        html = html.slice(0, closeTag+4) + figHtml + html.slice(closeTag+4);
      } else {
        html += figHtml;
      }
    } else {
      html += figHtml;
    }
  });
  return html;
}

function injectTables(html, tablesInText){
  if(!DATA.tables || !DATA.tables.length) return html;
  tablesInText.forEach(t => {
    const tbl = DATA.tables.find(x => x.table_num === t.num);
    if(!tbl || !tbl.filename) return;  // no image available — leave caption as prose (safe fallback)

    const tblHtml = `<div class="fig-block" data-table="${tbl.table_num}">
      <div class="fig-thumb-wrap" data-table-zoom="${tbl.table_num}">
        <img src="assets/table_thumbs/${tbl.thumb}" alt="Table ${tbl.table_num}: ${escapeHtml(tbl.caption)}" loading="lazy">
        <div class="fig-zoom-hint">&#128270; Click to enlarge</div>
      </div>
    </div>`;

    // Replace the <p> containing the table caption with the image block
    const marker = escapeHtml(`Table ${t.num}:`);
    const pStart = html.lastIndexOf('<p>', html.indexOf(marker));
    const pEnd = html.indexOf('</p>', html.indexOf(marker));
    if(pStart !== -1 && pEnd !== -1){
      // keep the caption as a separate fig-caption line above the image
      const captionHtml = `<div class="fig-caption"><strong>Table ${tbl.table_num}.</strong> ${escapeHtml(tbl.caption)}</div>`;
      html = html.slice(0, pStart) + captionHtml + tblHtml + html.slice(pEnd + 4);
    }
  });
  return html;
}

function attachFigureHandlers(){
  $$('[data-figure-zoom]').forEach(el => {
    el.addEventListener('click', () => {
      const fig = DATA.figures.find(x => x.fig_num === el.dataset.figureZoom);
      if(fig) openLightbox(`assets/figures/${fig.filename}`, `Figure ${fig.fig_num}: ${fig.caption}`);
    });
  });
  $$('[data-table-zoom]').forEach(el => {
    el.addEventListener('click', () => {
      const tbl = DATA.tables.find(x => x.table_num === el.dataset.tableZoom);
      if(tbl) openLightbox(`assets/table_images/${tbl.filename}`, `Table ${tbl.table_num}: ${tbl.caption}`);
    });
  });
}

// ---------- Drawings ----------
let openMainDrawingGroups = new Set(); // separate from sidebar's open-state tracking

function renderDrawingsOverview(){
  let html = `<div class="doc-eyebrow">Part B</div><h1 class="doc-h1">Book of Drawings</h1>`;
  html += `<div class="doc-meta">The typical detail drawings can be accessed across the 4 categories.<br>Expand the relevant category below and click on the drawing, or navigate to the drawing in the sidebar.</div>`;
  const cats = ['Roads','Road Marking & Road Signs','Stormwater','General'];
  cats.forEach(cat => {
    const items = DATA.drawings.filter(d => d.category === cat);
    if(!items.length) return;
    const isOpen = openMainDrawingGroups.has(cat);
    html += `<div class="main-drawing-group">`;
    html += `<button class="main-cat-toggle ${isOpen?'open':''}" data-main-toggle-cat="${escapeHtml(cat)}">
      <span class="cat-chevron">&#9656;</span>
      <span class="doc-eyebrow" style="margin:0;">${escapeHtml(cat)} (${items.length})</span>
    </button>`;
    html += `<div class="grid-cards main-cat-grid ${isOpen?'open':''}">`;
    items.forEach(d => {
      html += `<button class="grid-card" data-goto-drawing="${d.num}">
        <img src="assets/drawing_thumbs/${d.thumb_filename}" alt="${escapeHtml(d.description)}" loading="lazy">
        <div class="grid-card-body">
          <div class="grid-card-num">${d.num}</div>
          <div class="grid-card-desc">${escapeHtml(d.description)}</div>
        </div>
      </button>`;
    });
    html += `</div></div>`;
  });
  contentInner.innerHTML = html;
  $$('[data-goto-drawing]').forEach(b => b.addEventListener('click', () => setState({drawing:b.dataset.gotoDrawing})));
  $$('[data-main-toggle-cat]').forEach(b => b.addEventListener('click', () => {
    const cat = b.dataset.mainToggleCat;
    if(openMainDrawingGroups.has(cat)) openMainDrawingGroups.delete(cat);
    else openMainDrawingGroups.add(cat);
    renderDrawingsOverview();
  }));
}

function renderDrawingDetail(){
  const d = DATA.drawings.find(x => x.num === state.drawing);
  if(!d) return renderDrawingsOverview();
  let html = crumbs([{label:'Drawings', action:true}, {label:d.category, action:true}, {label:d.num}]);
  html += `<div class="doc-eyebrow">${escapeHtml(d.category)} &middot; Part B</div>`;
  html += `<h1 class="doc-h1">${d.num}</h1>`;
  html += `<div class="doc-meta">${escapeHtml(d.description)}</div>`;
  html += `<div class="drawing-detail-img-wrap" data-zoom-full="assets/drawings/${d.filename}" data-zoom-caption="${escapeHtml(d.num+': '+d.description)}">
    <img src="assets/drawing_thumbs/${d.thumb_filename}" alt="${escapeHtml(d.description)}">
  </div>`;
  html += `<div class="drawing-detail-meta">
    <span>Drawing No. <b>${d.num}</b></span>
    <span>Revision <b>${d.rev || '—'}</b></span>
    <span>Category <b>${escapeHtml(d.category)}</b></span>
  </div>`;
  contentInner.innerHTML = html;
  attachCrumbHandlers([
    () => setState({drawing:null}),
    () => setState({drawing:null}),
  ]);
  const zoomEl = $('[data-zoom-full]');
  zoomEl.addEventListener('click', () => openLightbox(zoomEl.dataset.zoomFull, zoomEl.dataset.zoomCaption));
}

// ---------- Maps ----------
function renderMapsOverview(){
  let html = `<div class="doc-eyebrow">Part C</div><h1 class="doc-h1">Maps</h1>`;
  html += `<div class="doc-meta">Various City-wide reference maps shown below.<br>Click on the map to expand it.</div>`;
  html += `<div class="map-summary-list">`;
  DATA.maps.forEach(m => {
    html += `<p><strong>${escapeHtml(m.title)}</strong> &mdash; ${escapeHtml(m.description)}</p>`;
  });
  html += `</div>`;
  html += `<a class="info-action-btn" style="margin:18px 0 24px;display:inline-block;" href="https://resource.capetown.gov.za/cityassets/Media%20Centre%20Assets/SGRSW_Maps.zip" target="_blank" rel="noopener">Download all maps (high-definition PDF) &rarr;</a>`;
  html += `<div class="grid-cards">`;
  DATA.maps.forEach(m => {
    html += `<button class="grid-card" data-goto-map="${m.id}">
      <img src="assets/map_thumbs/${m.thumb_filename}" alt="${escapeHtml(m.title)}" loading="lazy">
      <div class="grid-card-body">
        <div class="grid-card-num">${escapeHtml(m.title)}</div>
      </div>
    </button>`;
  });
  html += `</div>`;
  contentInner.innerHTML = html;
  $$('[data-goto-map]').forEach(b => b.addEventListener('click', () => setState({map:parseInt(b.dataset.gotoMap)})));
}

function renderMapDetail(){
  const m = DATA.maps.find(x => x.id === state.map);
  if(!m) return renderMapsOverview();
  let html = crumbs([{label:'Maps', action:true}, {label:m.title}]);
  html += `<div class="doc-eyebrow">${escapeHtml(m.custodian || m.source)} &middot; Part C</div>`;
  html += `<h1 class="doc-h1">${escapeHtml(m.title)}</h1>`;
  html += `<div class="doc-meta">${escapeHtml(m.description)}</div>`;
  html += `<div class="map-detail-img-wrap" data-zoom-full="assets/maps/${m.filename}" data-zoom-caption="${escapeHtml(m.title)}">
    <img src="assets/map_thumbs/${m.thumb_filename}" alt="${escapeHtml(m.title)}">
  </div>`;
  html += `<div class="drawing-detail-meta">
    <span>Map Custodian <b>${escapeHtml(m.custodian || '—')}</b></span>
    <span>Revision <b>${escapeHtml(m.revision || '—')}</b></span>
  </div>`;
  contentInner.innerHTML = html;
  attachCrumbHandlers([() => setState({map:null})]);
  const zoomEl = $('[data-zoom-full]');
  zoomEl.addEventListener('click', () => openLightbox(zoomEl.dataset.zoomFull, zoomEl.dataset.zoomCaption));
}

// ---------- Search ----------
function renderSearchResults(){
  const q = state.query.toLowerCase().trim();
  if(!q){ renderStandardsLanding(); return; }
  let results = [];

  DATA.chapters.forEach(c => {
    c.sections.forEach(s => {
      const hay = (s.num+' '+s.title+' '+s.text).toLowerCase();
      if(hay.includes(q)){
        const snippet = makeSnippet(s.text, q);
        results.push({
          type:'section', score: s.title.toLowerCase().includes(q) ? 2 : 1,
          loc:`Chapter ${c.num} &middot; ${escapeHtml(c.title)}`,
          title:`${s.num} ${escapeHtml(s.title)}`,
          snippet, chapter:c.num, section:s.num
        });
      }
    });
    if(c.title.toLowerCase().includes(q) && !state.chapter){
      results.push({type:'chapter', score:3, loc:'Chapter', title:`Chapter ${c.num}: ${escapeHtml(c.title)}`, snippet:'', chapter:c.num, section:null});
    }
  });

  DATA.drawings.forEach(d => {
    const hay = (d.num+' '+d.description).toLowerCase();
    if(hay.includes(q)){
      results.push({type:'drawing', score: d.num.toLowerCase()===q ? 4:1, loc:`${escapeHtml(d.category)} &middot; Part B Drawing`, title:`${d.num} — ${escapeHtml(d.description)}`, snippet:'', drawing:d.num});
    }
  });

  DATA.maps.forEach(mp => {
    const hay = (mp.title+' '+mp.description).toLowerCase();
    if(hay.includes(q)){
      results.push({type:'map', score:1, loc:'Part C Map', title:escapeHtml(mp.title), snippet:escapeHtml(mp.description), map:mp.id});
    }
  });

  if(DATA.references){
    DATA.references.forEach(r => {
      if(r.description.toLowerCase().includes(q)){
        results.push({type:'reference', score:1, loc:'Chapter 20 &middot; Document Reference', title:escapeHtml(r.description), snippet:`Relevant to chapter${r.relevance.includes(',')?'s':''} ${r.relevance}`, chapter:20, section:null});
      }
    });
  }

  results.sort((a,b) => b.score - a.score);
  results = results.slice(0, 60);

  let html = `<div class="search-results-header">${results.length} result${results.length!==1?'s':''} for "<strong>${escapeHtml(state.query)}</strong>"</div>`;
  if(!results.length){
    html += `<div class="empty-state">No matches found. Try a different term, or browse chapters from the sidebar.</div>`;
  }
  results.forEach((r,i) => {
    html += `<button class="result-card" data-result="${i}">
      <div class="result-loc">${r.loc}</div>
      <div class="result-title">${r.title}</div>
      ${r.snippet ? `<div class="result-snippet">${r.snippet}</div>` : ''}
    </button>`;
  });
  contentInner.innerHTML = html;
  $$('[data-result]').forEach(b => {
    const r = results[parseInt(b.dataset.result)];
    b.addEventListener('click', () => {
      searchbox.value=''; toggleClear();
      if(r.type==='drawing') setState({tab:'drawings', drawing:r.drawing, query:''});
      else if(r.type==='map') setState({tab:'maps', map:r.map, query:''});
      else setState({tab:'standards', chapter:r.chapter, section:r.section, query:''});
    });
  });
}

function makeSnippet(text, q){
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if(idx === -1) return escapeHtml(text.slice(0,140))+'…';
  const start = Math.max(0, idx-60);
  const end = Math.min(text.length, idx+q.length+100);
  let snip = (start>0?'…':'') + text.slice(start,end) + (end<text.length?'…':'');
  snip = escapeHtml(snip);
  const re = new RegExp(escapeRegex(escapeHtml(q)), 'ig');
  snip = snip.replace(re, m => `<mark>${m}</mark>`);
  return snip;
}

function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtml(s){
  if(s===null||s===undefined) return '';
  let str = String(s).replace(/[\uE000-\uF8FF]/g, ''); // strip private-use-area glyphs (legacy symbol fonts)
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Lightbox ----------
const lightbox = $('#lightbox');
const lightboxImg = $('#lightbox-img');
const lightboxCaption = $('#lightbox-caption');
let lightboxZoom = 1;
function openLightbox(src, caption){
  lightboxImg.src = src;
  lightboxCaption.textContent = caption || '';
  lightboxZoom = 1;
  lightboxImg.style.transform = '';
  lightbox.classList.add('open');
}
function closeLightbox(){
  lightbox.classList.remove('open');
  lightboxImg.src = '';
  lightboxZoom = 1;
  lightboxImg.style.transform = '';
}
$('#lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if(e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeLightbox(); });

// Mouse scroll-to-zoom in lightbox (desktop)
lightbox.addEventListener('wheel', (e) => {
  if(!lightbox.classList.contains('open')) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.15 : 0.15;
  lightboxZoom = Math.min(5, Math.max(0.5, lightboxZoom + delta));
  lightboxImg.style.transform = `scale(${lightboxZoom})`;
  lightboxImg.style.transformOrigin = 'center center';
}, { passive: false });

// ---------- Search box wiring ----------
let searchDebounce;
searchbox.addEventListener('input', () => {
  toggleClear();
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    setState({query: searchbox.value});
  }, 150);
});
searchClear.addEventListener('click', () => {
  searchbox.value=''; toggleClear(); setState({query:''});
});
function toggleClear(){
  searchClear.style.display = searchbox.value ? 'flex' : 'none';
}

// ---------- Mobile sidebar ----------
const menuToggle = $('#menu-toggle');
const sidebarBackdrop = $('#sidebar-backdrop');
$('#brand-home-link').addEventListener('click', () => {
  searchbox.value=''; toggleClear();
  setState({tab:'home', chapter:null, section:null, drawing:null, map:null, query:''});
});
menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarBackdrop.classList.toggle('show');
});
sidebarBackdrop.addEventListener('click', closeSidebarMobile);
function closeSidebarMobile(){
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('show');
}

// ---------- Init ----------
render();
