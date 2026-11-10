/* 令制国マップ */
(function(){
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var mapData = null;
  var provData = null;
  var provById = {};
  var daoMeta = {};
  var gradeMeta = {};
  var distMeta = {};
  var regionEls = {};
  var activeDao = 'all';
  var searchQuery = '';
  var selectedPref = null;
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  var STR = {
    ja: { lede:'地図をタップすると、今の都道府県が千年前の国名に戻ります。<br>陸奥から薩摩まで、六十八国。それぞれに由来があります。',
          all:'すべて', hint:'地域をタップして旧国名を見る', fail:'地図データの読み込みに失敗しました。再読み込みしてください',
          close:'閉じる', filter:'道で絞り込む', mapLabel:'日本の令制国地図', drawer:'令制国の詳細', origin:'由来', ref:'歴史・文学',
          outside:'令制国の外', share:'この国をシェア', copied:'リンクをコピーしました', toggle:'中文', toggleLabel:'中文に切り替え',
          themeToDark:'ダーク', themeToDarkLabel:'ダークモードに切り替え',
          themeToLight:'ライト', themeToLightLabel:'ライトモードに切り替え',
          title:'令制国 · あなたの地元、昔は何国？',
          pending:'（日本語訳は準備中です。中国語の原文を表示しています）',
          hokkaido:'明治以前の北海道は<b>蝦夷地</b>と呼ばれ、律令の「五畿七道」の外にあったため、令制国は置かれていません。1869年（明治2年）に北海道と改称され、五畿七道は「五畿八道」となりました。',
          okinawa:'明治以前の沖縄は独立した<b>琉球王国</b>で、令制国の体系には含まれません。1872年に琉球藩が置かれ、1879年の「琉球処分」で沖縄県となりました。',
          search:'国名・読み・県名・一宮で探す', searchClear:'検索を消す', searchEmpty:'見つかりませんでした',
          grade:'等級', distance:'距離', kokufu:'国府', ichinomiya:'一宮', disputed:'諸説', none:'記載なし',
          footNote:'地図は現行の都道府県境です。等級と距離は延喜式、国府の郡名は和名類聚抄・拾芥抄、一宮は複数の名簿を照合した社名です（諸説のある国は併記）。',
          footFont:'見出し書体：京華老宋体（特里王）',
          wamyo:'和名抄', jikaisho:'拾芥抄', iroha:'伊呂波字類抄',
          shareText:function(p,prefs){ return p.ja+'（'+p.kana+'）は、今の'+prefs+'。\nあなたの地元は昔、何国？'; } },
    zh: { lede:'点亮一方水土，唤回它千年前的旧名。<br>从陆奥到萨摩，六十八国，皆有来处。',
          all:'全部', hint:'轻触任一区域 · 查看旧国名', fail:'地图数据加载失败，请刷新重试',
          close:'关闭', filter:'按道筛选', mapLabel:'日本令制国地图', drawer:'令制国详情', origin:'由来', ref:'史 · 文',
          outside:'令制国外', share:'分享这个国', copied:'链接已复制', toggle:'日本語', toggleLabel:'切换到日语',
          themeToDark:'深色', themeToDarkLabel:'切换到深色模式',
          themeToLight:'浅色', themeToLightLabel:'切换到浅色模式',
          title:'令制国 · 五畿七道交互地图', pending:'',
          hokkaido:'北海道在明治以前称<b>蝦夷地</b>，是律令「五畿七道」体系之外的化外之地，并无令制国。1869年戊辰战争后改置北海道，五畿七道遂称「五畿八道」。',
          okinawa:'冲绳在明治以前为独立的<b>琉球王国</b>，不属日本令制国体系。1872年设琉球藩，1879年「琉球处分」后置冲绳县。',
          search:'按国名、读音、县名、一宫搜索', searchClear:'清除搜索', searchEmpty:'没有找到',
          grade:'等级', distance:'距离', kokufu:'国府', ichinomiya:'一宫', disputed:'诸说', none:'无记载',
          footNote:'地图为现行都道府县边界。等级与距离据延喜式，国府郡名据和名类聚抄、拾芥抄，一宫据多份名录对照（有诸说者一并列出）。',
          footFont:'标题字体：京华老宋体（特里王）',
          wamyo:'和名抄', jikaisho:'拾芥抄', iroha:'伊吕波字类抄',
          shareText:function(p,prefs){ return p.ja+'（'+p.kana+'）就是今天的'+prefs+'。\n你的家乡古时叫什么国？'; } }
  };
  var lang = 'ja';
  try { var sv = localStorage.getItem('kuni-lang'); if (sv === 'zh' || sv === 'ja') lang = sv; } catch(e){}
  function readTheme(){
    var stored = null;
    try { stored = localStorage.getItem('kuni-theme'); } catch(e){}
    if (stored === 'light' || stored === 'dark') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  var theme = document.documentElement.getAttribute('data-theme');
  if (theme !== 'light' && theme !== 'dark') theme = readTheme();
  function T(k){ return STR[lang][k]; }
  function fld(p, k){ var v = p[k + '_ja']; return (lang === 'ja' && v) ? v : p[k]; }

  var elStage, elMapWrap, elSvg, elLayer, elTip, elTipKanji, elTipKana,
      elHint, elDrawer, elDrawerBody, elDrawerClose, elScrim, elDaoFilter,
      elSearch, elSearchClear, elSearchResults;

  function siteBase(){
    var path = location.pathname || '/';
    if (!/\/$/.test(path) && path.indexOf('.') === -1) path += '/';
    else if (!/\/$/.test(path)) path = path.replace(/[^/]+$/, '');
    return location.origin + path;
  }

  function init(){
    elStage      = document.getElementById('stage');
    elMapWrap    = document.getElementById('mapWrap');
    elSvg        = document.getElementById('mapSvg');
    elLayer      = document.getElementById('mapLayer');
    elTip        = document.getElementById('tip');
    elTipKanji   = document.getElementById('tipKanji');
    elTipKana    = document.getElementById('tipKana');
    elHint       = document.getElementById('hint');
    elDrawer     = document.getElementById('drawer');
    elDrawerBody = document.getElementById('drawerBody');
    elDrawerClose= document.getElementById('drawerClose');
    elScrim      = document.getElementById('scrim');
    elDaoFilter  = document.getElementById('daoFilter');
    elSearch     = document.getElementById('searchInput');
    elSearchClear= document.getElementById('searchClear');
    elSearchResults = document.getElementById('searchResults');
    var tg = document.getElementById('langToggle');
    if (tg) tg.addEventListener('click', function(){
      lang = (lang === 'ja') ? 'zh' : 'ja';
      try { localStorage.setItem('kuni-lang', lang); } catch(e){}
      applyLang();
      applyFilter();
      renderSearch();
      if (selectedPref && regionEls[selectedPref]) renderDrawer(regionEls[selectedPref]);
    });
    var th = document.getElementById('themeToggle');
    if (th) th.addEventListener('click', function(){
      theme = (theme === 'dark') ? 'light' : 'dark';
      try { localStorage.setItem('kuni-theme', theme); } catch(e){}
      applyTheme();
    });
    bindSearch();
    applyLang();
    applyTheme();

    Promise.all([
      fetch('map.json?v=k4').then(function(r){ return r.json(); }),
      fetch('provinces.json?v=k4').then(function(r){ return r.json(); })
    ]).then(function(res){
      mapData  = res[0];
      provData = res[1];
      indexData();
      buildDaoChips();
      function afterDraw(){
        drawMap();
        bindGlobal();
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
      }
      if (document.fonts && document.fonts.ready){
        document.fonts.ready.then(afterDraw).catch(afterDraw);
      } else {
        afterDraw();
      }
    }).catch(function(err){
      elHint.textContent = T('fail');
      if (window.console) console.error('[ryoseikoku] load error:', err);
    });
  }

  function applyLang(){
    document.documentElement.lang = (lang === 'ja') ? 'ja' : 'zh-CN';
    document.title = T('title');
    var q = function(id){ return document.getElementById(id); };
    if (q('lede')) q('lede').innerHTML = T('lede');
    if (elHint) elHint.textContent = T('hint');
    if (elDrawerClose) elDrawerClose.setAttribute('aria-label', T('close'));
    if (elDaoFilter){ elDaoFilter.setAttribute('aria-label', T('filter'));
      var a = elDaoFilter.querySelector('[data-dao="all"]'); if (a) a.textContent = T('all'); }
    if (elSvg) elSvg.setAttribute('aria-label', T('mapLabel'));
    if (elDrawer) elDrawer.setAttribute('aria-label', T('drawer'));
    var tg = q('langToggle'); if (tg){ tg.textContent = T('toggle'); tg.setAttribute('aria-label', T('toggleLabel')); }
    applyTheme();
    if (elSearch){ elSearch.setAttribute('placeholder', T('search')); }
    var sl = q('searchLabel'); if (sl) sl.textContent = T('search');
    if (elSearchClear) elSearchClear.setAttribute('aria-label', T('searchClear'));
    if (q('footNote')) q('footNote').textContent = T('footNote');
    if (q('footFont')) q('footFont').textContent = T('footFont');
  }

  function applyTheme(){
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.getElementById('themeColor') || document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1c1611' : '#e8dcc8');
    var th = document.getElementById('themeToggle');
    if (th){
      var toLight = theme === 'dark';
      th.textContent = T(toLight ? 'themeToLight' : 'themeToDark');
      th.setAttribute('aria-label', T(toLight ? 'themeToLightLabel' : 'themeToDarkLabel'));
    }
  }

  function prefOfProv(pid){
    var key, provs;
    for (key in regionEls){
      if (!regionEls.hasOwnProperty(key)) continue;
      provs = JSON.parse(regionEls[key].getAttribute('data-provs') || '[]');
      if (provs.indexOf(pid) >= 0) return regionEls[key];
    }
    return null;
  }
  function openFromHash(){
    var h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (!h || !provById[h]) return;
    var el = prefOfProv(h);
    if (!el) return;
    selectPref(el, true, h);
    var card = document.getElementById('pc-' + h);
    if (card && card.scrollIntoView) card.scrollIntoView({ block:'start' });
  }
  function prefsOf(pid){
    var out = [], key, info;
    for (key in mapData.paths){
      info = mapData.paths[key];
      if (info.provs && info.provs.indexOf(pid) >= 0) out.push(info.ja);
    }
    return out.join(lang === 'ja' ? '・' : '、');
  }
  function shareProv(pid, btn){
    var p = provById[pid]; if (!p) return;
    var url = siteBase() + '#' + pid;
    var text = STR[lang].shareText(p, prefsOf(pid));
    if (navigator.share){
      navigator.share({ title: p.ja + '（' + p.kana + '）', text: text, url: url }).catch(function(){});
      return;
    }
    var w = window.open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank', 'noopener');
    if (!w && navigator.clipboard){
      navigator.clipboard.writeText(text + '\n' + url).then(function(){ btn.textContent = T('copied'); }).catch(function(){});
    }
  }

  function indexData(){
    var i, p;
    for (i = 0; i < provData.provinces.length; i++){
      p = provData.provinces[i];
      provById[p.id] = p;
    }
    daoMeta = provData.dao || {};
    gradeMeta = provData.grade || {};
    distMeta = provData.distance || {};
  }

  function buildDaoChips(){
    var order = ['kinai','tokaido','tosando','hokurikudo','sanindo','sanyodo','nankaido','saikaido'];
    var i, key, meta, chip, dot;
    for (i = 0; i < order.length; i++){
      key  = order[i];
      meta = daoMeta[key];
      if (!meta) continue;
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'dao-chip';
      chip.setAttribute('data-dao', key);
      dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = 'var(' + meta.color + ')';
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(meta.ja));
      elDaoFilter.appendChild(chip);
    }
    elDaoFilter.addEventListener('click', function(e){
      var btn = e.target.closest ? e.target.closest('.dao-chip') : null;
      if (!btn) return;
      setDao(btn.getAttribute('data-dao'));
    });
  }

  function setDao(dao){
    activeDao = dao;
    var chips = elDaoFilter.querySelectorAll('.dao-chip');
    var i;
    for (i = 0; i < chips.length; i++){
      chips[i].classList.toggle('is-active', chips[i].getAttribute('data-dao') === dao);
    }
    applyFilter();
  }

  function normalize(s){
    return String(s || '').toLowerCase()
      .replace(/[ぁ-ん]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0) + 0x60); })
      .replace(/[āáàâ]/g,'a').replace(/[īíìî]/g,'i').replace(/[ūúùû]/g,'u')
      .replace(/[ēéèê]/g,'e').replace(/[ōóòô]/g,'o')
      .replace(/　/g,' ').trim();
  }

  function haystack(p){
    var g = gradeMeta[p.grade] || {};
    var d = distMeta[p.distance] || {};
    var kf = p.kokufu || {};
    var parts = [p.ja, p.kana, p.romaji, p.id]
      .concat(p.pref || [])
      .concat([g.ja, g.zh, g.kana, d.ja, d.zh, d.kana, kf.gun, kf.wamyo, kf.jikaisho, kf.iroha]);
    var i, s, ichi = p.ichinomiya || [];
    for (i = 0; i < ichi.length; i++){
      s = ichi[i] || {};
      parts.push(s.ja, s.kana);
      if (s.alias && s.alias.length) parts = parts.concat(s.alias);
    }
    if (p.ichinomiya_disputed) parts.push('諸説', '诸说');
    return normalize(parts.filter(Boolean).join(' '));
  }

  function matchesQuery(p, q){
    if (!q) return true;
    return haystack(p).indexOf(q) >= 0;
  }

  function prefMatches(prefName, provIds){
    var i, pv, daoOk, qOk;
    if (!provIds.length){
      daoOk = (activeDao === 'all');
      qOk = !searchQuery || normalize(prefName).indexOf(searchQuery) >= 0;
      return daoOk && qOk;
    }
    daoOk = (activeDao === 'all');
    qOk = !searchQuery;
    for (i = 0; i < provIds.length; i++){
      pv = provById[provIds[i]];
      if (!pv) continue;
      if (!daoOk && pv.dao === activeDao) daoOk = true;
      if (!qOk && matchesQuery(pv, searchQuery)) qOk = true;
    }
    return daoOk && qOk;
  }

  function applyFilter(){
    var filtering = (activeDao !== 'all') || !!searchQuery;
    elMapWrap.classList.toggle('filtering', filtering);
    var key, el, provs;
    for (key in regionEls){
      if (!regionEls.hasOwnProperty(key)) continue;
      el = regionEls[key];
      provs = JSON.parse(el.getAttribute('data-provs') || '[]');
      el.classList.toggle('is-match', !filtering || prefMatches(el.getAttribute('data-pref-name'), provs));
    }
  }

  function bindSearch(){
    if (!elSearch) return;
    var timer = null;
    function onChange(){
      searchQuery = normalize(elSearch.value);
      if (elSearchClear) elSearchClear.hidden = !elSearch.value;
      applyFilter();
      renderSearch();
    }
    elSearch.addEventListener('input', function(){
      clearTimeout(timer);
      timer = setTimeout(onChange, 60);
    });
    elSearch.addEventListener('keydown', function(e){
      if (e.key === 'Escape'){ e.preventDefault(); clearSearch(); return; }
      if (e.key === 'Enter'){
        e.preventDefault();
        var first = elSearchResults && elSearchResults.querySelector('[data-id]');
        if (first) openProv(first.getAttribute('data-id'));
      }
    });
    if (elSearchClear) elSearchClear.addEventListener('click', clearSearch);
    document.addEventListener('click', function(e){
      if (!elSearchResults || elSearchResults.hidden) return;
      if (elSearchResults.contains(e.target) || (elSearch && elSearch.contains(e.target))) return;
      elSearchResults.hidden = true;
    });
  }

  function clearSearch(){
    if (elSearch) elSearch.value = '';
    searchQuery = '';
    if (elSearchClear) elSearchClear.hidden = true;
    if (elSearchResults) elSearchResults.hidden = true;
    applyFilter();
  }

  function renderSearch(){
    if (!elSearchResults) return;
    if (!searchQuery){ elSearchResults.hidden = true; elSearchResults.innerHTML = ''; return; }
    var hits = [], i, p;
    for (i = 0; i < provData.provinces.length; i++){
      p = provData.provinces[i];
      if (activeDao !== 'all' && p.dao !== activeDao) continue;
      if (matchesQuery(p, searchQuery)) hits.push(p);
    }
    if (!hits.length){
      elSearchResults.innerHTML = '<li class="search-empty">' + esc(T('searchEmpty')) + '</li>';
      elSearchResults.hidden = false;
      return;
    }
    var html = '';
    for (i = 0; i < Math.min(hits.length, 10); i++){
      p = hits[i];
      html += '<li><button type="button" data-id="' + esc(p.id) + '">' +
        '<span>' + esc(p.ja) + '</span>' +
        '<span class="sr-kana">' + esc(p.kana) + '</span>' +
        '<span class="sr-meta">' + esc(labelOf(gradeMeta[p.grade])) + ' · ' + esc(labelOf(distMeta[p.distance])) + '</span>' +
        '</button></li>';
    }
    elSearchResults.innerHTML = html;
    elSearchResults.hidden = false;
  }

  function openProv(pid){
    var el = prefOfProv(pid);
    if (!el) return;
    if (elSearchResults) elSearchResults.hidden = true;
    selectPref(el, false, pid);
  }

  function labelOf(meta){
    if (!meta) return '';
    if (lang === 'zh' && meta.zh) return meta.zh;
    return meta.ja || '';
  }

  function formatKokufu(p){
    var k = p.kokufu || {};
    var none = T('none');
    if (k.gun) return k.gun;
    var parts = [], key, val, src;
    var keys = ['wamyo','jikaisho','iroha'];
    var any = false;
    for (key of ['wamyo','jikaisho','iroha']){
      if (!Object.prototype.hasOwnProperty.call(k, key)) continue;
      any = true;
      val = k[key];
      src = T(key);
      parts.push((val || none) + '（' + src + '）');
    }
    if (!any) return '';
    if (!k.wamyo && !k.jikaisho && !k.iroha) return none;
    return parts.join('／');
  }

  function formatIchinomiya(p){
    var list = p.ichinomiya || [];
    if (!list.length) return '';
    var parts = [], i, s, t;
    for (i = 0; i < list.length; i++){
      s = list[i] || {};
      t = s.ja || '';
      if (s.kana) t += '（' + s.kana + '）';
      if (t) parts.push(t);
    }
    if (!parts.length) return '';
    t = parts.join('、');
    if (p.ichinomiya_disputed) t += '　' + T('disputed');
    return t;
  }

  function drawMap(){
    elSvg.setAttribute('viewBox', '0 0 ' + mapData.width + ' ' + mapData.height);
    var paths = mapData.paths;
    var key, info, path, fill;

    for (key in paths){
      if (!paths.hasOwnProperty(key)) continue;
      info = paths[key];
      path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', info.d);
      path.setAttribute('class', 'region');
      path.setAttribute('data-pref-id', key);
      path.setAttribute('data-pref-name', info.ja);
      path.setAttribute('data-provs', JSON.stringify(info.provs || []));
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      path.setAttribute('aria-label', info.ja);

      fill = (info.provs && info.provs.length)
              ? 'var(' + daoMeta[provById[info.provs[0]].dao].color + ')'
              : 'var(--dao-none)';
      path.style.fill = fill;

      bindRegion(path);
      elLayer.appendChild(path);
      regionEls[key] = path;
    }

    drawInset();
    applyFilter();
    elHint.classList.remove('hidden');
  }

  function drawInset(){
    if (!mapData.inset) return;
    var ins = mapData.inset, Z = 1.5;
    var cx = ins.x + ins.w / 2, cy = ins.y + ins.h / 2;
    var ok = regionEls['47'];
    if (ok) ok.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') scale(' + Z + ') translate(' + (-cx) + ' ' + (-cy) + ')');
    ins = { x: cx - ins.w * Z / 2, y: cy - ins.h * Z / 2, w: ins.w * Z, h: ins.h * Z };
    var frame = document.createElementNS(SVGNS, 'rect');
    frame.setAttribute('x', ins.x);
    frame.setAttribute('y', ins.y);
    frame.setAttribute('width', ins.w);
    frame.setAttribute('height', ins.h);
    frame.setAttribute('rx', '10');
    frame.setAttribute('class', 'inset-frame');
    elLayer.insertBefore(frame, elLayer.firstChild);

    var label = document.createElementNS(SVGNS, 'text');
    label.setAttribute('x', ins.x + 12);
    label.setAttribute('y', ins.y + 22);
    label.setAttribute('class', 'inset-label');
    label.textContent = '沖縄';
    elLayer.appendChild(label);
  }

  function bindRegion(path){
    if (!isTouch){
      path.addEventListener('mouseenter', function(){
        path.classList.add('is-hover');
        showTip(path);
      });
      path.addEventListener('mousemove', function(e){ moveTip(e); });
      path.addEventListener('mouseleave', function(){
        path.classList.remove('is-hover');
        hideTip();
      });
      path.addEventListener('click', function(){ selectPref(path); });
    } else {
      path.addEventListener('touchend', function(e){
        e.preventDefault();
        selectPref(path);
      }, { passive:false });
      path.addEventListener('click', function(){ selectPref(path); });
    }
    path.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        selectPref(path);
      }
    });
  }

  function showTip(path){
    var provs = JSON.parse(path.getAttribute('data-provs') || '[]');
    var name = path.getAttribute('data-pref-name');
    if (provs.length){
      var first = provById[provs[0]];
      elTipKanji.textContent = first.ja + (provs.length > 1 ? ' …' : '');
      elTipKana.textContent  = first.kana;
    } else {
      elTipKanji.textContent = name;
      elTipKana.textContent  = T('outside');
    }
    elTip.classList.add('show');
  }
  function moveTip(e){
    var rect = elMapWrap.getBoundingClientRect();
    elTip.style.left = (e.clientX - rect.left) + 'px';
    elTip.style.top  = (e.clientY - rect.top)  + 'px';
  }
  function hideTip(){ elTip.classList.remove('show'); }

  function selectPref(path, fromHash, focusId){
    var id = path.getAttribute('data-pref-id');
    var key;
    for (key in regionEls){
      if (regionEls.hasOwnProperty(key)) regionEls[key].classList.remove('is-selected');
    }
    path.classList.add('is-selected');
    selectedPref = id;
    renderDrawer(path);
    openDrawer();
    if (!fromHash){
      var pv = JSON.parse(path.getAttribute('data-provs') || '[]');
      var hashId = focusId || (pv.length ? pv[0] : '');
      if (history.replaceState) history.replaceState(null, '', hashId ? '#' + hashId : location.pathname);
    }
    if (focusId){
      var card = document.getElementById('pc-' + focusId);
      if (card && card.scrollIntoView) card.scrollIntoView({ block:'start' });
    }
    hideTip();
  }

  function renderDrawer(path){
    var prefName = path.getAttribute('data-pref-name');
    var provs    = JSON.parse(path.getAttribute('data-provs') || '[]');
    var html = '';

    html += '<p class="d-pref">PREFECTURE</p>';
    html += '<p class="d-prefname"><b>' + esc(prefName) + '</b>　' + (lang === 'ja' ? '今の都道府県' : '今　現代の行政区') + '</p>';

    if (!provs.length){
      var note = (prefName === '北海道') ? T('hokkaido') : T('okinawa');
      html += '<div class="empty-note">' + note + '</div>';
      elDrawerBody.innerHTML = html;
      return;
    }

    var i, p, meta, gmeta, dmeta, ktext, untr;
    for (i = 0; i < provs.length; i++){
      p = provById[provs[i]];
      if (!p) continue;
      meta = daoMeta[p.dao] || {};
      gmeta = gradeMeta[p.grade] || {};
      dmeta = distMeta[p.distance] || {};
      html += '<div class="prov-card" id="pc-' + esc(p.id) + '">';
      html +=   '<div class="pc-head">';
      html +=     '<span class="pc-kanji">' + esc(p.ja) + '</span>';
      html +=     '<span class="pc-kana">' + esc(p.kana) + '</span>';
      html +=     '<span class="pc-romaji">' + esc(p.romaji) + '</span>';
      html +=   '</div>';
      html +=   '<div class="pc-tags">';
      html +=     '<span class="pc-dao"><span class="dot" style="background:var(' + meta.color + ')"></span>'
                 + esc(meta.ja || '') + '　' + esc(meta.kana || '') + '</span>';
      if (gmeta.ja) html += '<span class="pc-tag">' + esc(T('grade')) + '　' + esc(labelOf(gmeta)) + '</span>';
      if (dmeta.ja) html += '<span class="pc-tag">' + esc(T('distance')) + '　' + esc(labelOf(dmeta)) + '</span>';
      html +=   '</div>';
      ktext = formatKokufu(p);
      if (ktext){
        html += '<div class="pc-row"><div class="pc-label">' + T('kokufu') + '</div><div class="pc-text">' + esc(ktext) + '</div></div>';
      }
      var itext = formatIchinomiya(p);
      if (itext){
        html += '<div class="pc-row"><div class="pc-label">' + T('ichinomiya') + '</div><div class="pc-text">' + esc(itext) + '</div></div>';
      }
      untr = (lang === 'ja' && !p.origin_ja);
      html +=   '<div class="pc-row"><div class="pc-label">' + T('origin') + '</div><div class="pc-text"' + (untr ? ' lang="zh-CN"' : '') + '>' + esc(fld(p, 'origin')) + '</div></div>';
      html +=   '<div class="pc-row"><div class="pc-label">' + T('ref') + '</div><div class="pc-text ref"' + (untr ? ' lang="zh-CN"' : '') + '>' + esc(fld(p, 'ref')) + '</div></div>';
      if (untr) html += '<p class="pc-pending">' + T('pending') + '</p>';
      html +=   '<button type="button" class="pc-share" data-share="' + esc(p.id) + '">' + T('share') + '</button>';
      html += '</div>';
    }
    elDrawerBody.innerHTML = html;
    elDrawerBody.scrollTop = 0;
  }

  function openDrawer(){
    elDrawer.classList.add('open');
    elDrawer.setAttribute('aria-hidden', 'false');
    elScrim.hidden = false;
    requestAnimationFrame(function(){ elScrim.classList.add('show'); });
  }
  function closeDrawer(){
    elDrawer.classList.remove('open');
    elDrawer.setAttribute('aria-hidden', 'true');
    elScrim.classList.remove('show');
    setTimeout(function(){ elScrim.hidden = true; }, 420);
    if (selectedPref && regionEls[selectedPref]){
      regionEls[selectedPref].classList.remove('is-selected');
    }
    selectedPref = null;
    if (history.replaceState && location.hash) history.replaceState(null, '', location.pathname);
  }

  function bindGlobal(){
    elDrawerClose.addEventListener('click', closeDrawer);
    elScrim.addEventListener('click', closeDrawer);
    elDrawerBody.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('.pc-share') : null;
      if (b) shareProv(b.getAttribute('data-share'), b);
    });
    if (elSearchResults){
      elSearchResults.addEventListener('click', function(e){
        var b = e.target.closest ? e.target.closest('[data-id]') : null;
        if (b) openProv(b.getAttribute('data-id'));
      });
    }
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && elDrawer.classList.contains('open')) closeDrawer();
    });
  }

  function esc(s){
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
