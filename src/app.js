/* 令制国マップ */
(function(){
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var TAP_MIN = 44;
  var LABEL_MIN = 56;
  var PAD = 0.12;
  var ZOOM_MAX = 24;
  var PAN_PAD = 0.05;
  var ANIM_IN = 320;
  var ANIM_OUT = 260;
  var FLASH_MS = 600;
  var NEIGHBOR = 3;
  var MAP_W = 1100;
  var MAP_H = 909;

  var mapData = null;
  var provData = null;
  var regions = null;
  var provById = {};
  var daoMeta = {};
  var gradeMeta = {};
  var distMeta = {};
  var regionEls = {};
  var kuniEls = {};
  var kuniInfo = {};
  var outsideEls = {};
  var activeDao = 'all';
  var searchQuery = '';
  var selectedId = null;
  var selectedKind = null; /* 'kuni' | 'outside' */
  var flashTimer = null;
  var insetXform = null;
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  var STR = {
    ja: { lede:'地図をタップすると、今の都道府県が千年前の国名に戻ります。<br>陸奥から薩摩まで、六十八国。それぞれに由来があります。',
          all:'すべて', hint:'地域をタップして旧国名を見る', fail:'地図データの読み込みに失敗しました。再読み込みしてください',
          close:'閉じる', filter:'道で絞り込む', mapLabel:'日本の令制国地図', drawer:'令制国の詳細', origin:'由来', ref:'歴史・文学',
          outside:'令制国の外', share:'この国をシェア', copied:'リンクをコピーしました',
          toggle:'日本語 / 中文', toggleLabel:'中文に切り替え',
          themeToDark:'ダーク', themeToDarkLabel:'ダークモードに切り替え',
          themeToLight:'ライト', themeToLightLabel:'ライトモードに切り替え',
          title:'令制国 · あなたの地元、昔は何国？',
          pending:'（日本語訳は準備中です。中国語の原文を表示しています）',
          hokkaido:'明治以前の北海道は<b>蝦夷地</b>と呼ばれ、律令の「五畿七道」の外にあったため、令制国は置かれていません。1869年（明治2年）に北海道と改称され、五畿七道は「五畿八道」となりました。',
          okinawa:'明治以前の沖縄は独立した<b>琉球王国</b>で、令制国の体系には含まれません。1872年に琉球藩が置かれ、1879年の「琉球処分」で沖縄県となりました。',
          search:'国名・読み・県名・一宮・道名で探す', searchClear:'検索を消す', searchEmpty:'見つかりませんでした',
          grade:'等級', distance:'距離', kokufu:'国府', ichinomiya:'一宮', disputed:'諸説あり', none:'記載なし',
          prefLabel:'現在の都府県', nation:'全国', nationAria:'全国を表示', crumbAria:'表示範囲',
          hokkaidoName:'北海道', ryukyuName:'琉球',
          footNote:'地図の境界は、幕末期の村域データをもとにした令制国の復元です（典拠に基づく近似的な再構成）。等級と距離は延喜式、国府の郡名は和名類聚抄・拾芥抄、一宮は複数の名簿を照合した社名です（諸説のある国は併記）。',
          footFont:'見出し書体：京華老宋体（特里王）',
          wamyo:'和名抄', jikaisho:'拾芥抄', iroha:'伊呂波字類抄',
          skipSearch:'検索へ', skipMap:'地図へ', skipNote:'地図をスキップ',
          shown:function(name){ return name+'を表示しています'; },
          closed:'詳細を閉じました',
          shareText:function(p,prefs){ return p.ja+'（'+p.kana+'）は、今の'+prefs+'。\nあなたの地元は昔、何国？'; } },
    zh: { lede:'点亮一方水土，唤回它千年前的旧名。<br>从陆奥到萨摩，六十八国，皆有来处。',
          all:'全部', hint:'轻触任一区域 · 查看旧国名', fail:'地图数据加载失败，请刷新重试',
          close:'关闭', filter:'按道筛选', mapLabel:'日本令制国地图', drawer:'令制国详情', origin:'由来', ref:'史 · 文',
          outside:'令制国外', share:'分享这个国', copied:'链接已复制',
          toggle:'日本語 / 中文', toggleLabel:'切换到日语',
          themeToDark:'深色', themeToDarkLabel:'切换到深色模式',
          themeToLight:'浅色', themeToLightLabel:'切换到浅色模式',
          title:'令制国 · 五畿七道交互地图', pending:'',
          hokkaido:'北海道在明治以前称<b>蝦夷地</b>，是律令「五畿七道」体系之外的化外之地，并无令制国。1869年戊辰战争后改置北海道，五畿七道遂称「五畿八道」。',
          okinawa:'冲绳在明治以前为独立的<b>琉球王国</b>，不属日本令制国体系。1872年设琉球藩，1879年「琉球处分」后置冲绳县。',
          search:'按国名、读音、县名、一宫、道名搜索', searchClear:'清除搜索', searchEmpty:'没有找到',
          grade:'等级', distance:'距离', kokufu:'国府', ichinomiya:'一宫', disputed:'诸说', none:'无记载',
          prefLabel:'现在的都府县', nation:'全国', nationAria:'返回全国', crumbAria:'当前范围',
          hokkaidoName:'北海道', ryukyuName:'琉球',
          footNote:'地图边界是根据幕末期村域数据复原的令制国范围（依据出典的近似重建）。等级与距离据延喜式，国府郡名据和名类聚抄、拾芥抄，一宫据多份名录对照（有诸说者一并列出）。',
          footFont:'标题字体：京华老宋体（特里王）',
          wamyo:'和名抄', jikaisho:'拾芥抄', iroha:'伊吕波字类抄',
          skipSearch:'跳到搜索', skipMap:'跳到地图', skipNote:'跳过地图',
          shown:function(name){ return '正在显示'+name; },
          closed:'已关闭详情',
          shareText:function(p,prefs){ return p.ja+'（'+p.kana+'）就是今天的'+prefs+'。\n你的家乡古时叫什么国？'; } }
  };

  var lang = 'ja';
  try {
    var qlang = new URLSearchParams(location.search).get('lang');
    if (qlang === 'zh' || qlang === 'ja') lang = qlang;
    else {
      var sv = localStorage.getItem('kuni-lang');
      if (sv === 'zh' || sv === 'ja') lang = sv;
    }
  } catch(e){}

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

  var elStage, elMapWrap, elSvg, elLayer, elKuniLayer, elTip, elTipKanji, elTipKana,
      elHint, elDrawer, elDrawerBody, elDrawerClose, elDrawerHandle, elScrim, elDaoFilter,
      elSearch, elSearchClear, elSearchResults, elCrumb, elLabels, elSea;

  var vb = { x:0, y:0, w:MAP_W, h:MAP_H };
  var worldLimit = { x:0, y:0, w:MAP_W, h:MAP_H };
  var animFrame = 0;
  var navStack = [{ level:'full' }];
  var histLock = false;
  var pendingFit = null;
  var neighborOf = null;
  var manualZoom = false;
  var drawerHeight = 'half';

  function siteBase(){
    var path = location.pathname || '/';
    if (!/\/$/.test(path) && path.indexOf('.') === -1) path += '/';
    else if (!/\/$/.test(path)) path = path.replace(/[^/]+$/, '');
    return location.origin + path;
  }

  function currentUrl(frame){
    var u = new URL(location.href);
    if (lang === 'zh') u.searchParams.set('lang', 'zh');
    else u.searchParams.delete('lang');
    var hash = '';
    if (frame && frame.level === 'detail' && frame.kind === 'kuni' && frame.id) hash = frame.id;
    else if (frame && frame.level === 'kuni' && frame.id) hash = frame.id;
    return u.pathname + u.search + (hash ? ('#' + hash) : '');
  }

  function syncLangUrl(){
    if (histLock) return;
    try {
      history.replaceState(history.state, '', currentUrl(topFrame()));
    } catch(e){}
  }

  var bootHash = '';
  function init(){
    try { bootHash = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch(e){ bootHash=''; }
    elStage      = document.getElementById('stage');
    elMapWrap    = document.getElementById('mapWrap');
    elSvg        = document.getElementById('mapSvg');
    elLayer      = document.getElementById('mapLayer');
    elKuniLayer  = document.getElementById('kuniLayer');
    elTip        = document.getElementById('tip');
    elTipKanji   = document.getElementById('tipKanji');
    elTipKana    = document.getElementById('tipKana');
    elHint       = document.getElementById('hint');
    elDrawer     = document.getElementById('drawer');
    elDrawerBody = document.getElementById('drawerBody');
    elDrawerClose= document.getElementById('drawerClose');
    elDrawerHandle= document.getElementById('drawerHandle');
    elScrim      = document.getElementById('scrim');
    elDaoFilter  = document.getElementById('daoFilter');
    elSearch     = document.getElementById('searchInput');
    elSearchClear= document.getElementById('searchClear');
    elSearchResults = document.getElementById('searchResults');
    elCrumb      = document.getElementById('crumb');
    elLabels     = document.getElementById('kuniLabels');
    elSea        = document.getElementById('mapSea');
    var tg = document.getElementById('langToggle');
    if (tg) tg.addEventListener('click', function(){
      lang = (lang === 'ja') ? 'zh' : 'ja';
      try { localStorage.setItem('kuni-lang', lang); } catch(e){}
      applyLang();
      applyFilter();
      renderSearch();
      updateLabels();
      if (selectedId) renderDrawer();
      syncLangUrl();
    });
    var th = document.getElementById('themeToggle');
    if (th) th.addEventListener('click', function(){
      theme = (theme === 'dark') ? 'light' : 'dark';
      try { localStorage.setItem('kuni-theme', theme); } catch(e){}
      applyTheme();
      updateLabels();
    });
    bindSearch();
    applyLang();
    applyTheme();

    Promise.all([
      fetch('map.json?v=__ASSET_VERSION__').then(function(r){ return r.json(); }),
      fetch('provinces.json?v=__ASSET_VERSION__').then(function(r){ return r.json(); }),
      fetch('kuni-regions.json?v=__ASSET_VERSION__').then(function(r){ return r.json(); })
    ]).then(function(res){
      mapData  = res[0];
      provData = res[1];
      regions  = res[2];
      MAP_W = mapData.width; MAP_H = mapData.height;
      vb = { x:0, y:0, w:MAP_W, h:MAP_H };
      indexData();
      buildDaoChips();
      function afterDraw(){
        drawMap();
        bindGlobal();
        var landingHash = bootHash || decodeURIComponent((location.hash || '').replace(/^#/, ''));
        initHistory();
        if (landingHash && provById[landingHash]){
          selectTarget('kuni', landingHash, { fromHash:true });
        } else {
          openFromHash();
        }
        window.addEventListener('hashchange', function(){
          if (histLock) return;
          openFromHash();
        });
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
    if (elCrumb) elCrumb.setAttribute('aria-label', T('crumbAria'));
    var tg = q('langToggle');
    if (tg){
      tg.setAttribute('aria-label', T('toggleLabel'));
    }
    applyTheme();
    if (elSearch){ elSearch.setAttribute('placeholder', T('search')); }
    var sl = q('searchLabel'); if (sl) sl.textContent = T('search');
    if (elSearchClear) elSearchClear.setAttribute('aria-label', T('searchClear'));
    if (q('footNote')) q('footNote').textContent = T('footNote');
    if (q('footFont')) q('footFont').textContent = T('footFont');
    if (q('skipSearch')) q('skipSearch').textContent = T('skipSearch');
    if (q('skipMap')) q('skipMap').textContent = T('skipMap');
    if (q('skipNote')) q('skipNote').textContent = T('skipNote');
    renderCrumb();
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

  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width:640px)').matches;
  }
  function reducedMotion(){
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function indexData(){
    var i, p, id, info;
    for (i = 0; i < provData.provinces.length; i++){
      p = provData.provinces[i];
      provById[p.id] = p;
    }
    daoMeta = provData.dao || {};
    gradeMeta = provData.grade || {};
    distMeta = provData.distance || {};
    kuniInfo = (regions && regions.kuni) || {};
    for (id in kuniInfo){
      if (!kuniInfo.hasOwnProperty(id)) continue;
      info = kuniInfo[id];
      info.bb = { x:info.bbox[0], y:info.bbox[1], w:info.bbox[2], h:info.bbox[3] };
    }
  }

  function buildDaoChips(){
    var order = ['kinai','tokaido','tosando','hokurikudo','sanindo','sanyodo','nankaido','saikaido'];
    var i, key, meta, chip, dot;
    for (i = 0; i < order.length; i++){
      key = order[i];
      meta = daoMeta[key] || {};
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
      setDao(btn.getAttribute('data-dao'), true);
    });
  }

  function setDao(dao, fromChip){
    activeDao = dao;
    var chips = elDaoFilter.querySelectorAll('.dao-chip');
    var i;
    for (i = 0; i < chips.length; i++){
      chips[i].classList.toggle('is-active', chips[i].getAttribute('data-dao') === dao);
    }
    applyFilter();
    if (fromChip){
      manualZoom = false;
      if (dao === 'all') goToLevel('full');
      else enterDao(dao, false);
    }
  }

  /* Fold CJK variants that show up in kuni / dao names, so a simplified
     or traditional query still hits the Japanese shinjitai form in the data.
     Display names are left untouched. */
  var CJK_FOLD = {
    '东':'東','阳':'陽','阴':'陰','陆':'陸','总':'総','备':'備',
    '艺':'芸','藝':'芸','丰':'豊','豐':'豊','对':'対','對':'対',
    '岛':'島','后':'後','预':'予','預':'予','贺':'賀','萨':'薩',
    '隐':'隠','隱':'隠','壹':'壱','骏':'駿','远':'遠','摄':'摂',
    '张':'張','藏':'蔵','纪':'紀','赞':'讃','讚':'讃','國':'国',
    '奧':'奥','见':'見','云':'雲','绳':'縄','冲':'沖'
  };

  var searchActive = -1;
  var SEARCH_CAP = 16;

  function normalize(s){
    return String(s || '').toLowerCase()
      .replace(/[ぁ-ん]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0) + 0x60); })
      .replace(/./g, function(ch){ return CJK_FOLD[ch] || ch; })
      .replace(/[āáàâ]/g,'a').replace(/[īíìî]/g,'i').replace(/[ūúùû]/g,'u')
      .replace(/[ēéèê]/g,'e').replace(/[ōóòô]/g,'o')
      .replace(/　/g,' ').trim();
  }

  function haystack(p){
    var g = gradeMeta[p.grade] || {};
    var d = distMeta[p.distance] || {};
    var kf = p.kokufu || {};
    var dao = daoMeta[p.dao] || {};
    var parts = [p.ja, p.kana, p.romaji, p.id, p.dao, dao.ja, dao.kana]
      .concat(p.pref || [])
      .concat([g.ja, g.zh, g.kana, d.ja, d.zh, d.kana, kf.gun, kf.wamyo, kf.jikaisho, kf.iroha]);
    var i, s, ichi = p.ichinomiya || [];
    for (i = 0; i < ichi.length; i++){
      s = ichi[i] || {};
      parts.push(s.ja, s.kana);
      if (s.alias && s.alias.length) parts = parts.concat(s.alias);
    }
    if (p.ichinomiya_disputed) parts.push('諸説', '诸说', '諸説あり');
    return normalize(parts.filter(Boolean).join(' '));
  }

  function matchesQuery(p, q){
    if (!q) return true;
    return haystack(p).indexOf(q) >= 0;
  }

  function outsideNames(id){
    if (id === 'hokkaido'){
      return ['北海道', 'ほっかいどう', 'hokkaido', '蝦夷地', 'えぞち', 'えぞ', 'ezo', 'ezochi'];
    }
    return ['琉球', 'りゅうきゅう', 'ryukyu', '沖縄', 'おきなわ', 'okinawa', '冲绳', '琉球王国'];
  }

  function outsideHaystack(id){
    return normalize(outsideNames(id).join(' '));
  }

  function outsideMatches(id){
    if (activeDao !== 'all') return false;
    if (!searchQuery) return true;
    return outsideHaystack(id).indexOf(searchQuery) >= 0;
  }

  function kuniMatches(id){
    var p = provById[id];
    if (!p) return false;
    if (activeDao !== 'all' && p.dao !== activeDao) return false;
    return matchesQuery(p, searchQuery);
  }

  function applyFilter(){
    var filtering = (activeDao !== 'all') || !!searchQuery;
    elMapWrap.classList.toggle('filtering', filtering);
    var key, el, provs, i, any;
    for (key in regionEls){
      if (!regionEls.hasOwnProperty(key)) continue;
      el = regionEls[key];
      provs = JSON.parse(el.getAttribute('data-provs') || '[]');
      if (!provs.length){
        el.classList.toggle('is-match', !filtering || (activeDao === 'all' && (!searchQuery || normalize(el.getAttribute('data-name') || '').indexOf(searchQuery) >= 0)));
        continue;
      }
      any = false;
      for (i = 0; i < provs.length; i++){
        if (kuniMatches(provs[i])) { any = true; break; }
      }
      el.classList.toggle('is-match', !filtering || any);
    }
    for (key in kuniEls){
      if (!kuniEls.hasOwnProperty(key)) continue;
      var kMatch = !filtering || kuniMatches(key);
      kuniEls[key].classList.toggle('is-match', kMatch);
      kuniEls[key].setAttribute('tabindex', kMatch ? '0' : '-1');
    }
    for (key in outsideEls){
      if (!outsideEls.hasOwnProperty(key)) continue;
      var oMatch = !filtering || outsideMatches(key);
      outsideEls[key].classList.toggle('is-match', oMatch);
      outsideEls[key].setAttribute('tabindex', oMatch ? '0' : '-1');
    }
    updateLabels();
  }

  function searchButtons(){
    if (!elSearchResults) return [];
    return elSearchResults.querySelectorAll('button[data-id]');
  }

  function setSearchActive(i){
    var buttons = searchButtons();
    var j, btn;
    if (!buttons.length){
      searchActive = -1;
      if (elSearch) elSearch.removeAttribute('aria-activedescendant');
      return;
    }
    if (i < 0) i = buttons.length - 1;
    if (i >= buttons.length) i = 0;
    searchActive = i;
    for (j = 0; j < buttons.length; j++){
      btn = buttons[j];
      btn.classList.toggle('is-active', j === i);
      btn.setAttribute('aria-selected', j === i ? 'true' : 'false');
    }
    if (elSearch) elSearch.setAttribute('aria-activedescendant', buttons[i].id);
    if (buttons[i].scrollIntoView) buttons[i].scrollIntoView({ block:'nearest' });
  }

  function setSearchExpanded(open){
    if (elSearch) elSearch.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function bindSearch(){
    if (!elSearch) return;
    var timer = null;
    elSearch.setAttribute('role', 'combobox');
    elSearch.setAttribute('aria-autocomplete', 'list');
    elSearch.setAttribute('aria-controls', 'searchResults');
    setSearchExpanded(false);
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
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        if (!elSearchResults || elSearchResults.hidden || !searchButtons().length) return;
        e.preventDefault();
        if (searchActive < 0) setSearchActive(0);
        else setSearchActive(searchActive + (e.key === 'ArrowDown' ? 1 : -1));
        return;
      }
      if (e.key === 'Enter'){
        e.preventDefault();
        var buttons = searchButtons();
        var target = (searchActive >= 0 && buttons[searchActive]) ? buttons[searchActive] : buttons[0];
        if (target){
          openFromKeyboard = true;
          focusRestore = elSearch;
          openSearchHit(target.getAttribute('data-kind') || 'kuni', target.getAttribute('data-id'));
        }
      }
    });
    if (elSearchClear) elSearchClear.addEventListener('click', clearSearch);
    document.addEventListener('click', function(e){
      if (!elSearchResults || elSearchResults.hidden) return;
      if (elSearchResults.contains(e.target) || (elSearch && elSearch.contains(e.target))) return;
      elSearchResults.hidden = true;
      setSearchExpanded(false);
    });
  }

  function clearSearch(){
    if (elSearch) elSearch.value = '';
    searchQuery = '';
    searchActive = -1;
    if (elSearch) elSearch.removeAttribute('aria-activedescendant');
    if (elSearchClear) elSearchClear.hidden = true;
    if (elSearchResults){ elSearchResults.hidden = true; elSearchResults.innerHTML = ''; }
    setSearchExpanded(false);
    applyFilter();
  }

  function renderSearch(){
    if (!elSearchResults) return;
    searchActive = -1;
    if (elSearch) elSearch.removeAttribute('aria-activedescendant');
    if (!searchQuery){ elSearchResults.hidden = true; elSearchResults.innerHTML = ''; setSearchExpanded(false); return; }
    var hits = [], i, p, id, html, meta, outs;
    if (provData && provData.provinces){
      for (i = 0; i < provData.provinces.length; i++){
        p = provData.provinces[i];
        if (activeDao !== 'all' && p.dao !== activeDao) continue;
        if (matchesQuery(p, searchQuery)) hits.push({ kind:'kuni', p:p });
      }
    }
    if (activeDao === 'all'){
      outs = ['hokkaido', 'ryukyu'];
      for (i = 0; i < outs.length; i++){
        id = outs[i];
        if (outsideHaystack(id).indexOf(searchQuery) >= 0){
          hits.unshift({ kind:'outside', id:id });
        }
      }
    }
    if (!hits.length){
      elSearchResults.innerHTML = '<li class="search-empty">' + esc(T('searchEmpty')) + '</li>';
      elSearchResults.hidden = false;
      setSearchExpanded(true);
      return;
    }
    html = '';
    for (i = 0; i < Math.min(hits.length, SEARCH_CAP); i++){
      if (hits[i].kind === 'outside'){
        id = hits[i].id;
        html += '<li><button type="button" role="option" id="sr-' + esc(id) + '" data-kind="outside" data-id="' + esc(id) + '" aria-selected="false">' +
          '<span>' + esc(id === 'hokkaido' ? T('hokkaidoName') : T('ryukyuName')) + '</span>' +
          '<span class="sr-kana">' + esc(id === 'hokkaido' ? 'ほっかいどう' : 'りゅうきゅう') + '</span>' +
          '<span class="sr-meta">' + esc(T('outside')) + '</span>' +
          '</button></li>';
        continue;
      }
      p = hits[i].p;
      meta = (labelOf(gradeMeta[p.grade]) + ' · ' + labelOf(distMeta[p.distance])).replace(/^ · | · $/g, '');
      html += '<li><button type="button" role="option" id="sr-' + esc(p.id) + '" data-kind="kuni" data-id="' + esc(p.id) + '" aria-selected="false">' +
        '<span>' + esc(p.ja) + '</span>' +
        '<span class="sr-kana">' + esc(p.kana) + '</span>' +
        '<span class="sr-meta">' + esc(meta) + '</span>' +
        '</button></li>';
    }
    elSearchResults.innerHTML = html;
    elSearchResults.hidden = false;
    setSearchExpanded(true);
  }

  function openSearchHit(kind, id){
    if (elSearchResults) elSearchResults.hidden = true;
    setSearchExpanded(false);
    selectTarget(kind === 'outside' ? 'outside' : 'kuni', id, { fromSearch:true });
  }

  function openProv(pid){
    openSearchHit('kuni', pid);
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

  function prefsOf(pid){
    var p = provById[pid];
    if (!p || !p.pref) return '';
    return p.pref.join(lang === 'ja' ? '・' : '、');
  }

  function shareProv(pid, btn){
    var p = provById[pid]; if (!p) return;
    var url = siteBase();
    if (lang === 'zh') url += (url.indexOf('?') >= 0 ? '&' : '?') + 'lang=zh';
    url += '#' + pid;
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

  function drawMap(){
    setVB({ x:0, y:0, w:MAP_W, h:MAP_H }, true);
    var paths = mapData.paths;
    var key, info, path, fill;

    for (key in paths){
      if (!paths.hasOwnProperty(key)) continue;
      info = paths[key];
      path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', info.d);
      path.setAttribute('class', 'region');
      path.setAttribute('data-id', key);
      path.setAttribute('data-name', info.ja || '');
      if (info.kind === 'outside' || key === 'hokkaido' || key === 'ryukyu'){
        path.setAttribute('data-provs', '[]');
        fill = 'var(--dao-none)';
      } else {
        var dao = info.dao || (provById[key] && provById[key].dao);
        path.setAttribute('data-provs', JSON.stringify([key]));
        fill = (dao && daoMeta[dao]) ? 'var(' + daoMeta[dao].color + ')' : 'var(--dao-none)';
      }
      path.style.fill = fill;
      elLayer.appendChild(path);
      regionEls[key] = path;
    }

    drawInset();

    var id, rec, hit;
    for (id in kuniInfo){
      if (!kuniInfo.hasOwnProperty(id)) continue;
      rec = kuniInfo[id];
      hit = document.createElementNS(SVGNS, 'path');
      hit.setAttribute('d', rec.d);
      hit.setAttribute('class', 'kuni-hit');
      hit.id = 'kuni-' + id;
      hit.setAttribute('data-id', id);
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', rec.ja);
      bindHit(hit, 'kuni', id);
      elKuniLayer.appendChild(hit);
      kuniEls[id] = hit;
    }
    var outs = (regions && regions.outside) || {};
    for (id in outs){
      if (!outs.hasOwnProperty(id)) continue;
      rec = outs[id];
      hit = document.createElementNS(SVGNS, 'path');
      hit.setAttribute('d', rec.d);
      hit.setAttribute('class', 'outside-hit');
      hit.id = 'outside-' + id;
      hit.setAttribute('data-id', id);
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', rec.ja);
      if (id === 'ryukyu' && insetXform){
        hit.setAttribute('transform', insetXform);
      }
      bindHit(hit, 'outside', id);
      elKuniLayer.appendChild(hit);
      outsideEls[id] = hit;
    }

    computeWorldLimit();
    applyFilter();
    elHint.classList.remove('hidden');
    updateLabels();
  }

  function drawInset(){
    if (!mapData.inset) return;
    var ins = mapData.inset, Z = 1.5;
    var cx = ins.x + ins.w / 2, cy = ins.y + ins.h / 2;
    insetXform = 'translate(' + cx + ' ' + cy + ') scale(' + Z + ') translate(' + (-cx) + ' ' + (-cy) + ')';
    var ok = regionEls['ryukyu'];
    if (ok) ok.setAttribute('transform', insetXform);
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
    label.id = 'insetLabel';
    label.textContent = '沖縄';
    elLayer.appendChild(label);
    insetXformBox = ins;
  }

  var insetXformBox = null;

  function bindHit(el, kind, id){
    if (!isTouch){
      el.addEventListener('mouseenter', function(){
        showTip(kind, id);
      });
      el.addEventListener('mousemove', function(e){ moveTip(e); });
      el.addEventListener('mouseleave', function(){ hideTip(); });
    }
    el.addEventListener('click', function(e){
      e.stopPropagation();
      if (skipNextClick) { skipNextClick = false; return; }
      handleTap(kind, id);
    });
    el.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        openFromKeyboard = true;
        focusRestore = el;
        handleTap(kind, id);
      }
    });
  }

  function showTip(kind, id){
    if (kind === 'kuni'){
      var p = provById[id];
      if (!p) return;
      elTipKanji.textContent = p.ja;
      elTipKana.textContent  = p.kana;
    } else {
      elTipKanji.textContent = id === 'hokkaido' ? T('hokkaidoName') : T('ryukyuName');
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


  /* ---------- viewBox, fit, animation ---------- */

  function easeGlideFn(){
    var p1x=0.16, p1y=1, p2x=0.3, p2y=1;
    function A(a1,a2){ return 1-3*a2+3*a1; }
    function B(a1,a2){ return 3*a2-6*a1; }
    function C(a1){ return 3*a1; }
    function calc(t,a1,a2){ return ((A(a1,a2)*t + B(a1,a2))*t + C(a1))*t; }
    function slope(t,a1,a2){ return 3*A(a1,a2)*t*t + 2*B(a1,a2)*t + C(a1); }
    return function(x){
      if (x<=0) return 0; if (x>=1) return 1;
      var t=x, i, d, s;
      for (i=0;i<8;i++){
        s = slope(t,p1x,p2x);
        if (Math.abs(s)<1e-6) break;
        d = calc(t,p1x,p2x)-x;
        t -= d/s;
      }
      return calc(t,p1y,p2y);
    };
  }
  var easeGlide = easeGlideFn();

  function fmtVB(b){ return b.x + ' ' + b.y + ' ' + b.w + ' ' + b.h; }
  function copyVB(b){ return { x:b.x, y:b.y, w:b.w, h:b.h }; }

  function setVB(b, instant){
    vb = copyVB(b);
    elSvg.setAttribute('viewBox', fmtVB(vb));
    elMapWrap.classList.toggle('is-zoomed', zoomFactor() > 1.02);
    updateInsetLabel();
    updateLabels();
  }

  function zoomFactor(){ return MAP_W / vb.w; }

  function computeWorldLimit(){
    var minx=Infinity, miny=Infinity, maxx=-Infinity, maxy=-Infinity, id, b, t;
    function add(x,y,w,h){
      minx=Math.min(minx,x); miny=Math.min(miny,y);
      maxx=Math.max(maxx,x+w); maxy=Math.max(maxy,y+h);
    }
    for (id in kuniInfo){
      b = displayBBox('kuni', id);
      add(b.x,b.y,b.w,b.h);
    }
    b = displayBBox('outside', 'hokkaido');
    if (b) add(b.x,b.y,b.w,b.h);
    b = displayBBox('outside', 'ryukyu');
    if (b) add(b.x,b.y,b.w,b.h);
    if (insetXformBox) add(insetXformBox.x, insetXformBox.y, insetXformBox.w, insetXformBox.h);
    var pw = (maxx-minx)*PAN_PAD, ph = (maxy-miny)*PAN_PAD;
    worldLimit = { x:minx-pw, y:miny-ph, w:(maxx-minx)+2*pw, h:(maxy-miny)+2*ph };
  }

  function transformPoint(x, y){
    if (!insetXformBox || !mapData.inset) return { x:x, y:y };
    var ins = mapData.inset, Z=1.5;
    var cx = ins.x + ins.w/2, cy = ins.y + ins.h/2;
    return { x: cx + (x-cx)*Z, y: cy + (y-cy)*Z };
  }

  function displayBBox(kind, id){
    var rec, b, p1, p2, p3, p4;
    if (kind === 'kuni'){
      rec = kuniInfo[id];
      if (!rec) return null;
      return { x:rec.bb.x, y:rec.bb.y, w:rec.bb.w, h:rec.bb.h, cx:rec.cx, cy:rec.cy };
    }
    rec = regions.outside && regions.outside[id];
    if (!rec) return null;
    b = { x:rec.bbox[0], y:rec.bbox[1], w:rec.bbox[2], h:rec.bbox[3], cx:rec.cx, cy:rec.cy };
    if (id === 'ryukyu'){
      p1 = transformPoint(b.x, b.y);
      p2 = transformPoint(b.x+b.w, b.y);
      p3 = transformPoint(b.x, b.y+b.h);
      p4 = transformPoint(b.x+b.w, b.y+b.h);
      var xs=[p1.x,p2.x,p3.x,p4.x], ys=[p1.y,p2.y,p3.y,p4.y];
      var minx=Math.min.apply(null,xs), miny=Math.min.apply(null,ys);
      var maxx=Math.max.apply(null,xs), maxy=Math.max.apply(null,ys);
      var c = transformPoint(b.cx, b.cy);
      if (insetXformBox){
        minx=Math.min(minx, insetXformBox.x);
        miny=Math.min(miny, insetXformBox.y);
        maxx=Math.max(maxx, insetXformBox.x+insetXformBox.w);
        maxy=Math.max(maxy, insetXformBox.y+insetXformBox.h);
      }
      return { x:minx, y:miny, w:maxx-minx, h:maxy-miny, cx:c.x, cy:c.y };
    }
    return b;
  }

  function unionBBox(list){
    var minx=Infinity, miny=Infinity, maxx=-Infinity, maxy=-Infinity, i, b;
    for (i=0;i<list.length;i++){
      b = list[i];
      if (!b) continue;
      minx=Math.min(minx,b.x); miny=Math.min(miny,b.y);
      maxx=Math.max(maxx,b.x+b.w); maxy=Math.max(maxy,b.y+b.h);
    }
    if (!isFinite(minx)) return null;
    return { x:minx, y:miny, w:maxx-minx, h:maxy-miny };
  }

  function daoBBox(dao){
    var list=[], id, rec;
    if (dao === 'hokkaido' || dao === 'ryukyu') return displayBBox('outside', dao);
    for (id in kuniInfo){
      rec = kuniInfo[id];
      if (rec.dao === dao) list.push(displayBBox('kuni', id));
    }
    return unionBBox(list);
  }

  function inflate(b, p){
    return { x:b.x - b.w*p, y:b.y - b.h*p, w:b.w*(1+2*p), h:b.h*(1+2*p) };
  }

  function visibleFractions(opts){
    var wrap = elMapWrap.getBoundingClientRect();
    var left=0, top=0, right=wrap.width, bottom=wrap.height;
    var drawerOpen = opts && opts.forDrawer ? true : (elDrawer && elDrawer.classList.contains('open'));
    if (drawerOpen){
      if (isMobile()){
        var dh;
        if (elDrawer.classList.contains('open') && elDrawer.querySelector('.drawer-inner')){
          var ir = elDrawer.getBoundingClientRect();
          dh = Math.max(0, wrap.bottom - ir.top);
        } else {
          dh = window.innerHeight * 0.44;
        }
        bottom = Math.max(80, wrap.height - Math.max(0, (wrap.bottom - (window.innerHeight - dh))));
        /* visible height inside wrap = distance from wrap.top to drawer.top */
        var drawerTop = window.innerHeight - dh;
        bottom = Math.max(60, Math.min(wrap.height, drawerTop - wrap.top));
      } else {
        var panel = 360;
        var avail = window.innerWidth - panel;
        if (wrap.right > avail) right = Math.max(120, avail - wrap.left);
      }
    }
    var fw = Math.max(0.2, (right-left)/wrap.width);
    var fh = Math.max(0.2, (bottom-top)/wrap.height);
    var fx = left/wrap.width, fy = top/wrap.height;
    return { fx:fx, fy:fy, fw:fw, fh:fh };
  }

  function clampPan(b){
    var out = copyVB(b);
    var lim = worldLimit;
    if (out.w >= lim.w) out.x = lim.x + (lim.w - out.w)/2;
    else out.x = Math.min(Math.max(out.x, lim.x), lim.x + lim.w - out.w);
    if (out.h >= lim.h) out.y = lim.y + (lim.h - out.h)/2;
    else out.y = Math.min(Math.max(out.y, lim.y), lim.y + lim.h - out.h);
    /* also stay reasonably inside the canvas when close to 1x */
    return out;
  }

  function canvasAspect(){
    var r = elSvg && elSvg.getBoundingClientRect();
    if (r && r.width > 1 && r.height > 1) return r.width / r.height;
    return MAP_W / MAP_H;
  }

  function fitBBox(bbox, opts){
    if (!bbox || bbox.w <= 0 || bbox.h <= 0) return { x:0, y:0, w:MAP_W, h:MAP_H };
    var padded = inflate(bbox, PAD);
    var aspect = canvasAspect();
    var vis = visibleFractions(opts || {});
    var vh = Math.max(padded.w / (vis.fw * aspect), padded.h / vis.fh);
    var vw = aspect * vh;
    var minVW = MAP_W / ZOOM_MAX, maxVW = MAP_W;
    if (vw < minVW){ vw = minVW; vh = vw / aspect; }
    if (vw > maxVW){ vw = maxVW; vh = vw / aspect; }
    var cx = padded.x + padded.w/2, cy = padded.y + padded.h/2;
    var out = {
      x: cx - (vis.fx + vis.fw/2) * vw,
      y: cy - (vis.fy + vis.fh/2) * vh,
      w: vw,
      h: vh
    };
    return clampPan(out);
  }

  function animateTo(target, duration){
    if (animFrame) cancelAnimationFrame(animFrame);
    if (!duration || reducedMotion()){
      setVB(target);
      return Promise.resolve();
    }
    var from = copyVB(vb);
    var t0 = performance.now();
    return new Promise(function(resolve){
      function step(now){
        var t = Math.min(1, (now - t0) / duration);
        var e = easeGlide(t);
        setVB({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          w: from.w + (target.w - from.w) * e,
          h: from.h + (target.h - from.h) * e
        });
        if (t < 1) animFrame = requestAnimationFrame(step);
        else { animFrame = 0; setVB(target); resolve(); }
      }
      animFrame = requestAnimationFrame(step);
    });
  }

  function durationFor(target){
    return (target.w > vb.w + 0.5) ? ANIM_OUT : ANIM_IN;
  }

  function zoomToBBox(bbox, opts){
    var target = (opts && opts.full) ? { x:0, y:0, w:MAP_W, h:MAP_H } : fitBBox(bbox, opts);
    return animateTo(target, durationFor(target));
  }

  function screenBox(kind, id){
    var b = displayBBox(kind, id);
    if (!b) return { w:0, h:0, short:0, left:0, top:0 };
    var r = elSvg.getBoundingClientRect();
    var sx = r.width / vb.w, sy = r.height / vb.h;
    return {
      w: b.w * sx,
      h: b.h * sy,
      short: Math.min(b.w * sx, b.h * sy),
      left: r.left + (b.x - vb.x) * sx,
      top: r.top + (b.y - vb.y) * sy,
      cx: r.left + (b.cx - vb.x) * sx,
      cy: r.top + (b.cy - vb.y) * sy
    };
  }

  function updateInsetLabel(){
    var lab = document.getElementById('insetLabel');
    if (!lab) return;
    var scale = vb.w / MAP_W;
    lab.setAttribute('font-size', String(Math.max(4, 13 * scale)));
  }

  /* ---------- labels ---------- */

  function updateLabels(){
    if (!elLabels || !kuniInfo) return;
    var r = elSvg.getBoundingClientRect();
    var wrap = elMapWrap.getBoundingClientRect();
    var sx = r.width / vb.w, sy = r.height / vb.h;
    var items = [], id, rec, b, wpx, name, lw, lh, left, top, filtering;
    filtering = elMapWrap.classList.contains('filtering');
    for (id in kuniInfo){
      if (!kuniInfo.hasOwnProperty(id)) continue;
      rec = kuniInfo[id];
      b = rec.bb;
      wpx = b.w * sx;
      if (wpx < LABEL_MIN) continue;
      if (filtering && kuniEls[id] && !kuniEls[id].classList.contains('is-match')) continue;
      name = rec.ja;
      lw = name.length * 12 + 8;
      lh = (selectedId === id && selectedKind === 'kuni') ? 18 : 16;
      left = r.left + (rec.cx - vb.x) * sx - wrap.left;
      top = r.top + (rec.cy - vb.y) * sy - wrap.top;
      if (left < -20 || top < -20 || left > wrap.width + 20 || top > wrap.height + 20) continue;
      items.push({
        id:id, name:name, area:rec.area, left:left, top:top,
        box:{ x:left-lw/2, y:top-lh/2, w:lw, h:lh },
        selected: selectedId === id && selectedKind === 'kuni'
      });
    }
    items.sort(function(a,c){ return c.area - a.area; });
    var placed = [], i, j, it, ok;
    function overlap(a,b){
      return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
    }
    for (i=0;i<items.length;i++){
      it = items[i]; ok = true;
      for (j=0;j<placed.length;j++){
        if (overlap(it.box, placed[j].box)){ ok = false; break; }
      }
      it.show = ok;
      if (ok) placed.push(it);
    }
    var html = '', sel;
    for (i=0;i<items.length;i++){
      it = items[i];
      if (!it.show) continue;
      sel = it.selected ? ' is-selected' : '';
      html += '<span class="kuni-label' + sel + '" data-id="' + esc(it.id) +
        '" style="left:' + it.left.toFixed(1) + 'px;top:' + it.top.toFixed(1) + 'px">' +
        esc(it.name) + '</span>';
    }
    elLabels.innerHTML = html;
  }


  /* ---------- history / breadcrumb ---------- */

  function topFrame(){ return navStack[navStack.length-1]; }
  function navDepth(){ return navStack.length - 1; }

  function initHistory(){
    var first = { level:'full' };
    navStack = [first];
    try { history.replaceState({ kuniDepth:0, frame:first }, '', currentUrl(first)); } catch(e){}
    window.addEventListener('popstate', onPopState);
    renderCrumb();
  }

  function onPopState(e){
    var depth = (e.state && typeof e.state.kuniDepth === 'number') ? e.state.kuniDepth : 0;
    histLock = true;
    while (navDepth() > depth) navStack.pop();
    if (e.state && e.state.frame) navStack[navStack.length-1] = e.state.frame;
    if (navStack.length === 0) navStack = [{ level:'full' }];
    applyFrame(topFrame(), true);
    histLock = false;
  }

  function pushFrame(frame){
    navStack.push(frame);
    if (!histLock){
      try { history.pushState({ kuniDepth:navDepth(), frame:frame }, '', currentUrl(frame)); } catch(e){}
    }
  }

  function replaceFrame(frame){
    navStack[navStack.length-1] = frame;
    if (!histLock){
      try { history.replaceState({ kuniDepth:navDepth(), frame:frame }, '', currentUrl(frame)); } catch(e){}
    }
  }

  function replaceLevel(level, frame){
    var i;
    for (i=0;i<navStack.length;i++){
      if (navStack[i].level === level) navStack[i] = frame;
    }
    if (topFrame().level === level) replaceFrame(frame);
  }

  function applyFrame(frame, fromPop){
    var target, bbox;
    manualZoom = !!(frame && frame.manual);
    neighborOf = frame && frame.neighborOf || null;
    if (!frame || frame.level === 'full'){
      closeDrawerUI();
      clearSelection();
      zoomToBBox(null, { full:true });
      if (!fromPop) { /* already at state */ }
    } else if (frame.level === 'dao'){
      closeDrawerUI();
      if (frame.kind === 'outside') {
        /* keep no kuni selection */
        if (selectedKind === 'kuni') clearSelection();
      } else if (selectedKind === 'kuni' && selectedId) {
        /* closing? no, dao has no drawer */
      }
      if (selectedId && frame.level !== 'detail') {
        /* leaving detail handled separately */
      }
      clearSelection();
      bbox = frame.vbBox || (frame.dao ? daoBBox(frame.dao) : null);
      if (bbox) zoomToBBox(bbox, {});
      else if (frame.vb) animateTo(frame.vb, durationFor(frame.vb));
    } else if (frame.level === 'kuni'){
      closeDrawerUI();
      clearSelection();
      if (frame.vb) animateTo(frame.vb, durationFor(frame.vb));
      else if (frame.id && frame.kind === 'kuni') zoomToBBox(displayBBox('kuni', frame.id), {});
    } else if (frame.level === 'detail'){
      if (frame.kind && frame.id) {
        applySelection(frame.kind, frame.id);
        openDrawerUI();
      }
      if (frame.vb) animateTo(frame.vb, durationFor(frame.vb));
      else refitSelection();
    }
    renderCrumb();
  }

  function goToLevel(level){
    var i, idx = -1;
    if (level === 'full'){
      if (navDepth() === 0){ applyFrame({ level:'full' }); renderCrumb(); return; }
      histLock = false;
      try { history.go(-navDepth()); } catch(e){ navStack=[{level:'full'}]; applyFrame(topFrame()); }
      return;
    }
    for (i=0;i<navStack.length;i++){
      if (navStack[i].level === level) idx = i;
    }
    if (idx < 0) return;
    var steps = navDepth() - idx;
    if (steps <= 0){ applyFrame(topFrame()); return; }
    try { history.go(-steps); } catch(e){}
  }

  function navBack(){
    if (navDepth() === 0) return false;
    try { history.back(); } catch(e){}
    return true;
  }

  function daoName(dao){
    if (dao === 'hokkaido') return T('hokkaidoName');
    if (dao === 'ryukyu') return T('ryukyuName');
    var m = daoMeta[dao];
    return m ? m.ja : dao;
  }

  function renderCrumb(){
    if (!elCrumb) return;
    var frame = topFrame() || { level:'full' };
    var show = frame.level !== 'full' && (zoomFactor() > 1.02 || frame.level === 'detail' || frame.level === 'dao' || frame.level === 'kuni');
    if (!show && !manualZoom){
      elCrumb.hidden = true;
      elCrumb.classList.remove('is-on');
      elCrumb.innerHTML = '';
      return;
    }
    var parts = [];
    parts.push({ key:'full', label:T('nation'), aria:T('nationAria') });
    if (manualZoom){
      /* only 全国 */
    } else {
      var dao = frame.dao;
      var kid = (frame.kind === 'kuni') ? frame.id : null;
      if (!dao && kid && provById[kid]) dao = provById[kid].dao;
      if (frame.kind === 'outside') dao = frame.id;
      if (dao) parts.push({ key:'dao', dao:dao, label:daoName(dao) });
      if (frame.level === 'detail' && kid && provById[kid]){
        parts.push({ key:'kuni', id:kid, label:provById[kid].ja });
      }
    }
    var html = '<ol>';
    var i;
    for (i=0;i<parts.length;i++){
      html += '<li><button type="button" data-crumb="' + esc(parts[i].key) + '"' +
        (parts[i].dao ? (' data-dao="' + esc(parts[i].dao) + '"') : '') +
        (parts[i].aria ? (' aria-label="' + esc(parts[i].aria) + '"') : '') +
        '>' + esc(parts[i].label) + '</button></li>';
    }
    html += '</ol>';
    elCrumb.innerHTML = html;
    elCrumb.hidden = false;
    requestAnimationFrame(function(){ elCrumb.classList.add('is-on'); });
  }

  function onCrumbClick(e){
    var btn = e.target.closest ? e.target.closest('[data-crumb]') : null;
    if (!btn) return;
    var key = btn.getAttribute('data-crumb');
    manualZoom = false;
    if (key === 'full') goToLevel('full');
    else if (key === 'dao') goToLevel('dao');
  }

  /* ---------- selection / tap ---------- */

  function clearSelection(){
    var key;
    selectedId = null;
    selectedKind = null;
    for (key in kuniEls){
      if (kuniEls.hasOwnProperty(key)) kuniEls[key].classList.remove('is-selected');
    }
    for (key in outsideEls){
      if (outsideEls.hasOwnProperty(key)) outsideEls[key].classList.remove('is-selected');
    }
    updateLabels();
  }

  function flashHit(kind, id){
    var el = (kind === 'kuni') ? kuniEls[id] : outsideEls[id];
    if (!el) return;
    if (flashTimer) clearTimeout(flashTimer);
    var key, cur;
    for (key in kuniEls){ if (kuniEls.hasOwnProperty(key)) kuniEls[key].classList.remove('is-flash'); }
    for (key in outsideEls){ if (outsideEls.hasOwnProperty(key)) outsideEls[key].classList.remove('is-flash'); }
    el.classList.add('is-flash');
    flashTimer = setTimeout(function(){ el.classList.remove('is-flash'); }, FLASH_MS);
  }

  function applySelection(kind, id){
    clearSelection();
    selectedId = id;
    selectedKind = kind;
    var el = (kind === 'kuni') ? kuniEls[id] : outsideEls[id];
    if (el) el.classList.add('is-selected');
    renderDrawer();
    hideTip();
    updateLabels();
  }

  /**
   * Isolated tap entry. Size-based one/two/three-step:
   * ≥44px short side → select; else zoom to dao + flash;
   * still <44px → zoom to bbox×3; then select.
   * Search / hash / chips use selectTarget() directly.
   */
  function handleTap(kind, id){
    if (selectedKind === kind && selectedId === id) return;
    if (kind === 'kuni'){
      var short = screenBox('kuni', id).short;
      var p = provById[id];
      var dao = p ? p.dao : null;
      var frame = topFrame();
      if (short >= TAP_MIN){
        selectTarget('kuni', id);
        return;
      }
      /* too small: zoom first */
      if (!frame || frame.level === 'full' || frame.manual || (frame.dao && frame.dao !== dao && frame.level !== 'kuni' && frame.level !== 'detail')){
        enterDao(dao, false);
        flashHit('kuni', id);
        neighborOf = null;
        return;
      }
      if (neighborOf !== id){
        enterNeighborZoom(id, dao);
        flashHit('kuni', id);
        return;
      }
      selectTarget('kuni', id);
      return;
    }
    /* outside: 北海道 / 琉球 are large at full view; still follow the same rule */
    var os = screenBox('outside', id).short;
    if (os >= TAP_MIN){
      selectTarget('outside', id);
      return;
    }
    enterDao(id, true);
    flashHit('outside', id);
  }

  function enterDao(dao, isOutside){
    manualZoom = false;
    neighborOf = null;
    var bbox = isOutside ? displayBBox('outside', dao) : daoBBox(dao);
    var target = fitBBox(bbox, {});
    var frame = {
      level:'dao',
      dao:dao,
      kind: isOutside ? 'outside' : 'dao',
      id: isOutside ? dao : undefined,
      vb: target,
      vbBox: bbox
    };
    var top = topFrame();
    if (top.level === 'full' || top.level === 'kuni' || top.level === 'detail'){
      /* going to dao from full: push. from detail/kuni: should be back, but chip can jump */
      if (top.level === 'full') pushFrame(frame);
      else replaceFrame(frame);
    } else if (top.level === 'dao'){
      replaceFrame(frame);
    } else {
      pushFrame(frame);
    }
    zoomToBBox(bbox, {});
    renderCrumb();
  }

  function enterNeighborZoom(id, dao){
    manualZoom = false;
    neighborOf = id;
    var b = displayBBox('kuni', id);
    var box = { x:b.x - b.w, y:b.y - b.h, w:b.w*NEIGHBOR, h:b.h*NEIGHBOR };
    var target = fitBBox(box, {});
    var frame = { level:'dao', dao:dao, kind:'dao', vb:target, vbBox:box, neighborOf:id };
    /* stay at dao history level */
    if (topFrame().level === 'dao') replaceFrame(frame);
    else pushFrame(frame);
    zoomToBBox(box, {});
    renderCrumb();
  }

  function selectTarget(kind, id, opts){
    opts = opts || {};
    manualZoom = false;
    var bbox = displayBBox(kind, id);
    var dao = (kind === 'kuni' && provById[id]) ? provById[id].dao : id;
    applySelection(kind, id);
    openDrawerUI();
    var fit = fitBBox(bbox, { forDrawer:true });
    zoomToBBox(bbox, { forDrawer:true });

    if (histLock || opts.fromPop) { renderCrumb(); return; }

    var top = topFrame();
    var kuniFrame = { level:'kuni', dao:dao, kind:kind, id:id, vb:fit };
    var detailFrame = { level:'detail', dao:dao, kind:kind, id:id, vb:fit };

    if (top.level === 'full' || !top.level){
      var daoBox = (kind === 'kuni') ? daoBBox(dao) : bbox;
      pushFrame({ level:'dao', dao:dao, kind:(kind==='outside'?'outside':'dao'), id:(kind==='outside'?id:undefined), vb:fitBBox(daoBox, {}), vbBox:daoBox });
      pushFrame(kuniFrame);
      pushFrame(detailFrame);
    } else if (top.level === 'dao'){
      pushFrame(kuniFrame);
      pushFrame(detailFrame);
    } else if (top.level === 'kuni'){
      if (top.id !== id || top.kind !== kind) replaceFrame(kuniFrame);
      pushFrame(detailFrame);
    } else if (top.level === 'detail'){
      /* same-level switch: replace detail and the kuni frame below */
      replaceFrame(detailFrame);
      var i;
      for (i=navStack.length-2;i>=0;i--){
        if (navStack[i].level === 'kuni'){ navStack[i] = kuniFrame; break; }
      }
    }
    renderCrumb();
  }

  function refitSelection(){
    if (!selectedId) return;
    var bbox = displayBBox(selectedKind, selectedId);
    if (bbox) zoomToBBox(bbox, { forDrawer:true });
  }

  function openFromHash(){
    var h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (!h || !provById[h]) return;
    if (selectedKind === 'kuni' && selectedId === h && elDrawer.classList.contains('open')) return;
    selectTarget('kuni', h, { fromHash:true });
    var card = document.getElementById('pc-' + h);
    if (card && card.scrollIntoView) card.scrollIntoView({ block:'start' });
  }

  function handleSea(){
    /* deselect, keep zoom. If drawer open, this is one history step back from detail,
       but zoom must stay — replace the detail frame's back target? 
       Spec: closing by tapping sea = deselect, zoom stays.
       Use history.back only if the previous frame has the same viewBox; else replace. */
    if (elDrawer.classList.contains('open')){
      closeDrawerKeepZoom();
    } else if (selectedId){
      clearSelection();
      renderCrumb();
    }
  }


  function announce(msg){
    var el = document.getElementById('mapStatus');
    if (!el) return;
    el.textContent = '';
    window.setTimeout(function(){ el.textContent = msg || ''; }, 40);
  }

  function callStr(key, arg){
    var fn = STR[lang] && STR[lang][key];
    return typeof fn === 'function' ? fn(arg) : (T(key) || '');
  }

  var focusRestore = null;
  var openFromKeyboard = false;

  function focusDrawer(){
    if (!elDrawerBody) return;
    var heading = elDrawerBody.querySelector('h2, .pc-kanji, .d-prefname b');
    if (heading){
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus();
    } else if (elDrawerClose){
      elDrawerClose.focus();
    }
  }

  /* ---------- drawer ---------- */

  function renderDrawer(){
    if (!selectedId){ elDrawerBody.innerHTML = ''; return; }
    var html = '';
    if (selectedKind === 'outside'){
      var name = selectedId === 'hokkaido' ? T('hokkaidoName') : T('ryukyuName');
      var note = selectedId === 'hokkaido' ? T('hokkaido') : T('okinawa');
      html += '<p class="d-pref">' + esc(T('prefLabel')) + '</p>';
      html += '<h2 class="d-prefname"><b>' + esc(name) + '</b></h2>';
      html += '<div class="empty-note">' + note + '</div>';
      elDrawerBody.innerHTML = html;
      return;
    }
    var p = provById[selectedId];
    if (!p){ elDrawerBody.innerHTML = ''; return; }
    var meta = daoMeta[p.dao] || {};
    var gmeta = gradeMeta[p.grade] || {};
    var dmeta = distMeta[p.distance] || {};
    var formal = p.ja + '国（' + p.kana + 'のくに）';
    html += '<div class="prov-card" id="pc-' + esc(p.id) + '">';
    html +=   '<div class="d-summary">';
    html +=     '<div class="pc-head">';
    html +=       '<h2 class="pc-kanji">' + esc(p.ja) + '国</h2>';
    html +=       '<span class="pc-kana">' + esc(p.kana + 'のくに') + '</span>';
    html +=       '<span class="visually-hidden">' + esc(formal) + '</span>';
    html +=       '<span class="pc-romaji">' + esc(p.romaji) + '</span>';
    html +=     '</div>';
    html +=     '<div class="pc-tags">';
    html +=       '<span class="pc-dao"><span class="dot" style="background:var(' + meta.color + ')"></span>'
                 + esc(meta.ja || '') + '　' + esc(meta.kana || '') + '</span>';
    html +=     '</div>';
    var itext = formatIchinomiya(p);
    if (itext){
      html += '<div class="pc-row"><div class="pc-label">' + T('ichinomiya') + '</div><div class="pc-text">' + esc(itext) + '</div></div>';
    }
    html +=     '<p class="d-prefname">' + esc(T('prefLabel')) + '　<b>' + esc(prefsOf(p.id)) + '</b></p>';
    html +=   '</div>';
    html +=   '<div class="d-full">';
    html +=     '<div class="pc-tags">';
    if (gmeta.ja) html += '<span class="pc-tag">' + esc(T('grade')) + '　' + esc(labelOf(gmeta)) + '</span>';
    if (dmeta.ja) html += '<span class="pc-tag">' + esc(T('distance')) + '　' + esc(labelOf(dmeta)) + '</span>';
    html +=     '</div>';
    var ktext = formatKokufu(p);
    if (ktext){
      html += '<div class="pc-row"><div class="pc-label">' + T('kokufu') + '</div><div class="pc-text">' + esc(ktext) + '</div></div>';
    }
    var untr = (lang === 'ja' && !p.origin_ja);
    html +=   '<div class="pc-row"><div class="pc-label">' + T('origin') + '</div><div class="pc-text"' + (untr ? ' lang="zh-CN"' : '') + '>' + esc(fld(p, 'origin')) + '</div></div>';
    html +=   '<div class="pc-row"><div class="pc-label">' + T('ref') + '</div><div class="pc-text ref"' + (untr ? ' lang="zh-CN"' : '') + '>' + esc(fld(p, 'ref')) + '</div></div>';
    if (untr) html += '<p class="pc-pending">' + T('pending') + '</p>';
    html +=   '<button type="button" class="pc-share" data-share="' + esc(p.id) + '">' + T('share') + '</button>';
    html +=   '</div>';
    html += '</div>';
    elDrawerBody.innerHTML = html;
    elDrawerBody.scrollTop = 0;
  }

  function syncMobileMapFrame(){
    if (!elMapWrap || !elSvg) return;
    var sheet = isMobile() && document.body.classList.contains('has-sheet') && elDrawer && elDrawer.classList.contains('open');
    if (!sheet){
      elMapWrap.style.height = '';
      elSvg.style.height = '';
      elSvg.style.aspectRatio = '';
      return;
    }
    var wrapTop = elMapWrap.getBoundingClientRect().top;
    var drawerTop = elDrawer.getBoundingClientRect().top;
    var h = Math.max(160, Math.floor(drawerTop - wrapTop));
    elMapWrap.style.height = h + 'px';
    elSvg.style.height = h + 'px';
    elSvg.style.aspectRatio = 'auto';
  }

  function ensureMapVisible(){
    if (!isMobile() || !elMapWrap) return;
    var wrap = elMapWrap.getBoundingClientRect();
    var top = 8;
    var y = Math.max(0, (window.scrollY || window.pageYOffset || 0) + wrap.top - top);
    var root = document.scrollingElement || document.documentElement;
    if (root) root.scrollTop = y;
    else window.scrollTo(0, y);
    syncMobileMapFrame();
  }

  function openDrawerUI(){
    drawerHeight = isMobile() ? 'half' : 'full';
    elDrawer.classList.remove('height-half', 'height-full');
    elDrawer.classList.add('open', 'height-' + drawerHeight);
    if (isMobile()){
      elDrawer.style.setProperty('--drawer-h', drawerHeight === 'full' ? 'min(96vh, 100svh)' : '44vh');
      if (elDrawerHandle) elDrawerHandle.hidden = false;
    } else {
      if (elDrawerHandle) elDrawerHandle.hidden = true;
    }
    elDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.toggle('has-panel', !isMobile());
    if (isMobile()){
      elScrim.hidden = true;
      elScrim.classList.remove('show');
      document.body.classList.add('has-sheet');
      ensureMapVisible();
      requestAnimationFrame(function(){ ensureMapVisible(); });
      setTimeout(function(){ ensureMapVisible(); if (selectedId) refitSelection(); }, reducedMotion() ? 0 : 280);
    } else {
      elScrim.classList.remove('show');
      elScrim.hidden = true;
    }
    if (openFromKeyboard){
      openFromKeyboard = false;
      requestAnimationFrame(focusDrawer);
    }
    var shownName = '';
    if (selectedKind === 'outside'){
      shownName = selectedId === 'hokkaido' ? T('hokkaidoName') : T('ryukyuName');
    } else if (selectedId && provById[selectedId]){
      shownName = provById[selectedId].ja;
    }
    if (shownName) announce(callStr('shown', shownName));
  }

  function closeDrawerUI(){
    var wasOpen = elDrawer.classList.contains('open');
    elDrawer.classList.remove('open', 'height-half', 'height-full');
    elDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-panel', 'has-sheet');
    syncMobileMapFrame();
    elScrim.classList.remove('show');
    setTimeout(function(){ if (!elDrawer.classList.contains('open')) elScrim.hidden = true; }, 420);
    if (wasOpen) announce(T('closed'));
    if (focusRestore && typeof focusRestore.focus === 'function'){
      var back = focusRestore;
      focusRestore = null;
      try { back.focus(); } catch (e) {}
    }
  }

  var keepZoomOnPop = false;

  function closeDrawerKeepZoom(){
    if (topFrame().level === 'detail'){
      keepZoomOnPop = true;
      navBack();
      return;
    }
    closeDrawerUI();
    clearSelection();
    renderCrumb();
  }

  function closeDrawerViaBack(){
    closeDrawerKeepZoom();
  }

  /* wrap onPopState to honor keepZoomOnPop — patch applyFrame path */
  var _applyFrame = applyFrame;
  applyFrame = function(frame, fromPop){
    var keep = keepZoomOnPop;
    var saved = copyVB(vb);
    keepZoomOnPop = false;
    if (keep && fromPop){
      closeDrawerUI();
      clearSelection();
      renderCrumb();
      /* do not animate to the previous viewBox */
      return;
    }
    _applyFrame(frame, fromPop);
  };

  function bindDrawerDrag(){
    if (!elDrawerHandle) return;
    var startY=0, startH=0, dragging=false;
    function hNow(){
      var inn = document.getElementById('drawerInner');
      return inn ? inn.getBoundingClientRect().height : window.innerHeight * 0.44;
    }
    elDrawerHandle.addEventListener('pointerdown', function(e){
      if (!isMobile() || !elDrawer.classList.contains('open')) return;
      dragging = true;
      startY = e.clientY;
      startH = hNow();
      try { elDrawerHandle.setPointerCapture(e.pointerId); } catch(err){}
      e.preventDefault();
    });
    elDrawerHandle.addEventListener('pointermove', function(e){
      if (!dragging) return;
      var next = startH + (startY - e.clientY);
      var min = window.innerHeight * 0.2, max = window.innerHeight * 0.96;
      next = Math.min(max, Math.max(min, next));
      elDrawer.style.setProperty('--drawer-h', next + 'px');
    });
    function endDrag(e){
      if (!dragging) return;
      dragging = false;
      var h = hNow();
      var vh = window.innerHeight;
      var dy = startY - (e && e.clientY || startY);
      if (h < vh * 0.30 || (dy < -40 && h < vh * 0.5)){
        elDrawer.style.removeProperty('--drawer-h');
        closeDrawerKeepZoom();
        return;
      }
      if (h > vh * 0.70 || dy > 50){
        drawerHeight = 'full';
        elDrawer.classList.remove('height-half');
        elDrawer.classList.add('height-full');
        elDrawer.style.setProperty('--drawer-h', 'min(96vh, 100svh)');
      } else {
        drawerHeight = 'half';
        elDrawer.classList.remove('height-full');
        elDrawer.classList.add('height-half');
        elDrawer.style.setProperty('--drawer-h', '44vh');
      }
      setTimeout(function(){ syncMobileMapFrame(); refitSelection(); }, 80);
    }
    elDrawerHandle.addEventListener('pointerup', endDrag);
    elDrawerHandle.addEventListener('pointercancel', endDrag);
  }


  /* ---------- pinch / pan / wheel / double-tap ---------- */

  var skipNextClick = false;
  var lastTapAt = 0, lastTapX = 0, lastTapY = 0;
  var pointers = {};
  var pinching = false;
  var panning = false;
  var panLast = null;
  var pinchStart = null;

  function svgFromClient(cx, cy){
    var r = elSvg.getBoundingClientRect();
    return {
      x: vb.x + (cx - r.left) / r.width * vb.w,
      y: vb.y + (cy - r.top) / r.height * vb.h
    };
  }

  function zoomAround(clientX, clientY, factor){
    var p = svgFromClient(clientX, clientY);
    var newW = Math.min(MAP_W, Math.max(MAP_W / ZOOM_MAX, vb.w / factor));
    var newH = newW / canvasAspect();
    var nx = p.x - (p.x - vb.x) * (newW / vb.w);
    var ny = p.y - (p.y - vb.y) * (newH / vb.h);
    setVB(clampPan({ x:nx, y:ny, w:newW, h:newH }));
    markManual();
  }

  function markManual(){
    manualZoom = zoomFactor() > 1.02;
    if (!manualZoom){
      /* arrived back at 1x */
      renderCrumb();
      return;
    }
    var top = topFrame();
    var frame = { level: top.level === 'detail' ? 'detail' : 'dao', dao: top.dao, kind:top.kind, id:top.id, vb:copyVB(vb), manual:true };
    /* don't push; just mark and update breadcrumb. History level stays so Back still works. */
    topFrame().manual = true;
    topFrame().vb = copyVB(vb);
    renderCrumb();
  }

  function pointerCount(){ return Object.keys(pointers).length; }

  function onPointerDown(e){
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers[e.pointerId] = { x:e.clientX, y:e.clientY };
    if (pointerCount() >= 2){
      pinching = true;
      panning = false;
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinchStart = {
        dist: Math.hypot(a.x-b.x, a.y-b.y) || 1,
        midX: (a.x+b.x)/2,
        midY: (a.y+b.y)/2,
        vb: copyVB(vb)
      };
      skipNextClick = true;
    } else if (zoomFactor() > 1.02){
      panning = false;
      panLast = { x:e.clientX, y:e.clientY, moved:false };
    }
  }

  function onPointerMove(e){
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = { x:e.clientX, y:e.clientY };
    if (pinching && pointerCount() >= 2 && pinchStart){
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var dist = Math.hypot(a.x-b.x, a.y-b.y) || 1;
      var midX = (a.x+b.x)/2, midY = (a.y+b.y)/2;
      var factor = dist / pinchStart.dist;
      /* compute from pinchStart.vb */
      var orig = pinchStart.vb;
      var p = /* point in orig vb */ (function(){
        var r = elSvg.getBoundingClientRect();
        return {
          x: orig.x + (pinchStart.midX - r.left) / r.width * orig.w,
          y: orig.y + (pinchStart.midY - r.top) / r.height * orig.h
        };
      })();
      var newW = Math.min(MAP_W, Math.max(MAP_W / ZOOM_MAX, orig.w / factor));
      var newH = newW / canvasAspect();
      var nx = p.x - (p.x - orig.x) * (newW / orig.w);
      var ny = p.y - (p.y - orig.y) * (newH / orig.h);
      /* also pan mid movement */
      var r = elSvg.getBoundingClientRect();
      nx -= (midX - pinchStart.midX) / r.width * newW;
      ny -= (midY - pinchStart.midY) / r.height * newH;
      setVB(clampPan({ x:nx, y:ny, w:newW, h:newH }));
      e.preventDefault();
    } else if (panLast && pointerCount() === 1 && zoomFactor() > 1.02){
      var dx = e.clientX - panLast.x, dy = e.clientY - panLast.y;
      if (!panning && Math.hypot(dx,dy) < 8) return;
      panning = true;
      skipNextClick = true;
      var r = elSvg.getBoundingClientRect();
      setVB(clampPan({
        x: vb.x - dx / r.width * vb.w,
        y: vb.y - dy / r.height * vb.h,
        w: vb.w, h: vb.h
      }));
      panLast = { x:e.clientX, y:e.clientY, moved:true };
      e.preventDefault();
    }
  }

  function onPointerUp(e){
    var wasPinch = pinching;
    delete pointers[e.pointerId];
    if (pointerCount() < 2){
      if (pinching) markManual();
      pinching = false;
      pinchStart = null;
    }
    if (pointerCount() === 0){
      if (panning) markManual();
      panning = false;
      panLast = null;
    }
  }

  function onDoubleZoom(clientX, clientY){
    zoomAround(clientX, clientY, 2);
  }

  function maybeDoubleTap(e){
    var now = Date.now();
    var dt = now - lastTapAt;
    var dist = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);
    lastTapAt = now; lastTapX = e.clientX; lastTapY = e.clientY;
    if (dt > 0 && dt < 300 && dist < 28){
      skipNextClick = true;
      onDoubleZoom(e.clientX, e.clientY);
      lastTapAt = 0;
      return true;
    }
    return false;
  }

  function bindMapGestures(){
    elMapWrap.addEventListener('pointerdown', onPointerDown);
    elMapWrap.addEventListener('pointermove', onPointerMove, { passive:false });
    elMapWrap.addEventListener('pointerup', onPointerUp);
    elMapWrap.addEventListener('pointercancel', onPointerUp);
    elMapWrap.addEventListener('pointerdown', function(e){
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      maybeDoubleTap(e);
    });
    elMapWrap.addEventListener('wheel', function(e){
      if (!e.ctrlKey) return; /* normal wheel scrolls the page */
      e.preventDefault();
      var factor = Math.exp(-e.deltaY * 0.01);
      zoomAround(e.clientX, e.clientY, factor);
    }, { passive:false });
    if (elSea){
      elSea.addEventListener('click', function(e){
        if (skipNextClick){ skipNextClick = false; return; }
        handleSea();
      });
    }
  }

  /* ---------- global binds ---------- */

  function bindGlobal(){
    elDrawerClose.addEventListener('click', function(){ closeDrawerViaBack(); });
    elScrim.addEventListener('click', function(){ closeDrawerKeepZoom(); });
    elDrawerBody.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('.pc-share') : null;
      if (b) shareProv(b.getAttribute('data-share'), b);
    });
    if (elSearchResults){
      elSearchResults.addEventListener('click', function(e){
        var b = e.target.closest ? e.target.closest('[data-id]') : null;
        if (b) openSearchHit(b.getAttribute('data-kind') || 'kuni', b.getAttribute('data-id'));
      });
    }
    if (elCrumb) elCrumb.addEventListener('click', onCrumbClick);
    document.addEventListener('keydown', function(e){
      if (e.key !== 'Escape') return;
      if (elSearchResults && !elSearchResults.hidden){ clearSearch(); return; }
      if (navDepth() > 0){
        e.preventDefault();
        navBack();
      }
    });
    bindDrawerDrag();
    bindMapGestures();
    window.addEventListener('resize', function(){
      syncMobileMapFrame();
      if (selectedId && elDrawer.classList.contains('open')) refitSelection();
      else updateLabels();
    });
    window.addEventListener('scroll', function(){
      if (isMobile() && document.body.classList.contains('has-sheet')) syncMobileMapFrame();
    }, { passive:true });
  }

  function esc(s){
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* test hook (e2e): dispatch a tap without waiting on pixel-size hit targets */
  window.__kuniTest = {
    tap: function(kind, id){ handleTap(kind, id); },
    select: function(kind, id){ selectTarget(kind, id); },
    viewBox: function(){ return fmtVB(vb); },
    nav: function(){ return navStack.map(function(f){ return f.level; }); },
    zoom: function(){ return zoomFactor(); },
    selected: function(){ return { kind:selectedKind, id:selectedId }; },
    screenShort: function(kind, id){ return screenBox(kind, id).short; },
    constants: function(){ return { TAP_MIN:TAP_MIN, LABEL_MIN:LABEL_MIN, ZOOM_MAX:ZOOM_MAX }; }
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
