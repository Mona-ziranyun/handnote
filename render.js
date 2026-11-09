/* 手绘笔记渲染引擎：大纲数据 + 样式 → 纸面 DOM + Rough.js 手绘覆盖层 */
(function () {
  const PAPERS = [
    { id: 'cream-ruled', name: '米黄横线纸', bg: '#fbf3df', line: 'rgba(176,146,96,.28)', kind: 'ruled', noise: true },
    { id: 'white-ruled', name: '白色横线纸', bg: '#ffffff', line: 'rgba(110,130,165,.22)', kind: 'ruled' },
    { id: 'grid', name: '方格纸', bg: '#fffdf7', line: 'rgba(140,155,180,.20)', kind: 'grid' },
    { id: 'blank', name: '纯白纸', bg: '#ffffff', kind: 'blank' },
    { id: 'dot', name: '点阵纸', bg: '#fffefa', line: 'rgba(120,130,150,.35)', kind: 'dot' },
    { id: 'kraft', name: '牛皮纸', bg: '#ead9bb', line: 'rgba(120,90,50,.18)', kind: 'blank', noise: true },
    { id: 'board', name: '黑板', bg: '#2f3d37', line: 'rgba(255,255,255,.05)', kind: 'blank', noise: true, dark: true },
  ];

  // text 主体 / red 批注 / blue 逻辑 / hy 黄高光 / hr 红高光 / head 标题底色 / c3 第三色
  const PALETTES = [
    { id: 'mine', name: '我的笔记', text: '#1b1b1b', red: '#e0352b', blue: '#1d5fd1', hy: 'rgba(255,221,64,.62)', hr: 'rgba(255,132,124,.40)', head: 'rgba(255,221,64,.62)', c3: '#2f9e6b' },
    { id: 'classic', name: '经典红蓝', text: '#222222', red: '#e1322a', blue: '#1f4e9a', hy: 'rgba(244,206,92,.62)', hr: 'rgba(255,140,130,.38)', head: 'rgba(164,198,236,.62)', c3: '#d08a12' },
    { id: 'navy', name: '深海蓝', text: '#132a4a', red: '#2b6cb0', blue: '#3c8dce', hy: 'rgba(160,205,240,.62)', hr: 'rgba(120,170,230,.40)', head: 'rgba(170,210,240,.65)', c3: '#5aa0c8' },
    { id: 'mono', name: '铅灰', text: '#1a1a1a', red: '#3d3d3d', blue: '#6b6b6b', hy: 'rgba(200,200,200,.6)', hr: 'rgba(160,160,160,.45)', head: 'rgba(210,210,210,.7)', c3: '#888888' },
    { id: 'warm', name: '暖棕', text: '#4a2a1c', red: '#d2602a', blue: '#8a4b2c', hy: 'rgba(246,196,150,.65)', hr: 'rgba(235,150,120,.42)', head: 'rgba(246,196,150,.65)', c3: '#b9852f' },
    { id: 'mint', name: '薄荷绿', text: '#1d3a33', red: '#e2604f', blue: '#24886a', hy: 'rgba(170,230,200,.70)', hr: 'rgba(255,160,145,.40)', head: 'rgba(170,230,200,.70)', c3: '#2b7bb9' },
    { id: 'chalk', name: '粉笔白', text: '#f2efe6', red: '#ff9a8a', blue: '#9fcfff', hy: 'rgba(255,230,120,.32)', hr: 'rgba(255,140,130,.30)', head: 'rgba(255,255,255,.16)', c3: '#b9f0a4' },
  ];

  const FONTS = [
    { id: 'xiaolai', name: '小赖手写体（随性手写）', family: 'Xiaolai', file: 'fonts/Xiaolai-Regular.woff2' },
    { id: 'marker', name: '霞鹜漫黑（马克笔粗体）', family: 'LXGW Marker Gothic', file: 'fonts/LXGWMarkerGothic-Regular.woff2' },
    { id: 'wenkai', name: '霞鹜文楷（清晰硬笔）', family: 'LXGW WenKai', file: 'fonts/LXGWWenKai-Regular.woff2' },
    { id: 'mashan', name: '马善政手写体', family: 'Ma Shan Zheng', file: 'fonts/MaShanZheng-Regular.woff2' },
    { id: 'longcang', name: '龙藏手写体', family: 'Long Cang', file: 'fonts/LongCang-Regular.woff2' },
    { id: 'kuaile', name: '站酷快乐体', family: 'ZCOOL KuaiLe', file: 'fonts/ZCOOLKuaiLe-Regular.woff2' },
    { id: 'zhimang', name: '志莽行书', family: 'Zhi Mang Xing', file: 'fonts/ZhiMangXing-Regular.woff2' },
    { id: 'local', name: '本机已安装字体…', family: '', file: '' },
  ];

  const SIZES = {
    long: { name: '长图', w: 860, h: 0 },
    xhs: { name: '小红书 3:4', w: 860, h: 1147 },
    a4: { name: 'A4 竖版', w: 860, h: 1216 },
    square: { name: '正方形', w: 860, h: 860 },
  };

  // 手绘简笔图标（24×24 坐标系）。字符串=路径；'O cx cy r'=圆；对象 {d, f} 带填充（f: hy/red/blue/c3/text/soft）
  const ICONS = {
    '星': [{ d: 'M12 2.5 L14.8 8.6 L21.4 9.3 L16.4 13.7 L17.9 20.3 L12 16.9 L6.1 20.3 L7.6 13.7 L2.6 9.3 L9.2 8.6 Z', f: 'hy' }],
    '勾': ['M3.5 12.5 L9.5 18.5 L20.5 5.5'],
    '叉': ['M5 5 L19 19', 'M19 5 L5 19'],
    '旗': ['M5 22 L5 3', { d: 'M5 3.5 L19.5 7 L5 11.5 Z', f: 'red' }],
    '终点': ['M4 22 L4 3', 'M4 3.5 C9 1.8 13 5.5 20 3.6 L20 13 C13 15 9 11.2 4 13', { d: 'M4 3.5 L8 3 L8 7.8 L4 8.2 Z', f: 'text' }, { d: 'M12 4.3 L16 4.6 L16 9.2 L12 8.8 Z', f: 'text' }, { d: 'M8 7.8 L12 8.8 L12 12.4 L8 11.6 Z', f: 'text' }, { d: 'M16 9.2 L20 8.6 L20 13 L16 13.6 Z', f: 'text' }],
    '灯泡': [{ d: 'M12 2.5 C7.5 2.5 5 5.8 5 9.2 C5 12 7 13.6 8.4 15.4 L8.6 17.6 L15.4 17.6 L15.6 15.4 C17 13.6 19 12 19 9.2 C19 5.8 16.5 2.5 12 2.5 Z', f: 'hy' }, 'M9 20.3 L15 20.3', 'M10.2 22.5 L13.8 22.5'],
    '心': [{ d: 'M12 20.5 C5 15.5 2.5 12 2.5 8.6 C2.5 5.6 4.8 3.6 7.4 3.6 C9.4 3.6 11 4.8 12 6.6 C13 4.8 14.6 3.6 16.6 3.6 C19.2 3.6 21.5 5.6 21.5 8.6 C21.5 12 19 15.5 12 20.5 Z', f: 'red' }],
    '相机': ['M2.5 8 L7.5 8 L9 5.5 L15 5.5 L16.5 8 L21.5 8 L21.5 19.5 L2.5 19.5 Z', { d: 'O 12 13.4 4.2', f: 'soft' }, 'O 12 13.4 1.8', 'M18 10.3 L19.5 10.3'],
    '场记板': ['M3 10 L21 10 L21 21 L3 21 Z', { d: 'M3 10 L2.4 6.2 L20 3.4 L20.6 7.2 Z', f: 'text' }, 'M7 9.5 L9 6', 'M12 8.8 L14 5.3', 'M17 8 L19 4.6', 'M3 14 L21 14'],
    '麦克风': [{ d: 'M9 4.5 C9 1.8 15 1.8 15 4.5 L15 11 C15 13.8 9 13.8 9 11 Z', f: 'soft' }, 'M5.5 10 C5.5 17.5 18.5 17.5 18.5 10', 'M12 16.2 L12 21', 'M8.5 21.3 L15.5 21.3'],
    '电脑': ['M4 4.5 L20 4.5 L20 15.5 L4 15.5 Z', 'M1.8 19.2 L22.2 19.2 L20.5 15.8 L3.5 15.8 Z', { d: 'M6.5 10 L8.5 10 L9.5 7.5 L11.5 13 L13 8.2 L14 10 L17.5 10', c: 'blue' }],
    '图片': ['M3 5 L21 5 L21 19 L3 19 Z', 'M3 16 L9 10 L13 14 L16 11 L21 16', { d: 'O 16.5 8.6 1.7', f: 'hy' }],
    '人': ['O 12 6.8 3.6', 'M4.5 21.5 C4.5 13.8 19.5 13.8 19.5 21.5'],
    '人群': ['O 8.5 8 3.1', 'O 16.3 8.6 2.6', 'M2.3 20.5 C2.3 13.5 14.7 13.5 14.7 20.5', 'M14.2 13.8 C17.5 13.2 21.7 14.6 21.7 20'],
    '笑脸': ['O 12 12 9.2', 'M7.8 13.8 C9.4 16.8 14.6 16.8 16.2 13.8', 'M9 9.2 L9 10.4', 'M15 9.2 L15 10.4'],
    '对话': ['M2.5 3.5 L14.5 3.5 L14.5 11.8 L8 11.8 L4.8 15 L5.4 11.8 L2.5 11.8 Z', 'M16.8 7.5 L21.5 7.5 L21.5 16 L19.2 16 L19.8 19.2 L16 16 L9.8 16 L9.8 14', 'M5.5 7.6 L5.6 7.7', 'M8.5 7.6 L8.6 7.7', 'M11.5 7.6 L11.6 7.7'],
    '靶心': ['O 11 13 9.3', { d: 'O 11 13 5.6', f: 'red' }, { d: 'O 11 13 2', f: 'soft' }, 'M11 13 L21 3', 'M17.5 2.8 L21.2 2.8 L21.2 6.5'],
    '漏斗': [{ d: 'M2.5 4 L21.5 4 L14 12.5 L14 19 L10 21.3 L10 12.5 Z', f: 'soft' }, 'M2.5 4 C3 6.2 21 6.2 21.5 4'],
    '车': [{ d: 'M2.3 16.2 L2.3 12 L5 7.5 L16.8 7.5 L19.8 11.8 L21.7 12.4 L21.7 16.2 Z', f: 'soft' }, 'O 7 16.6 2.3', 'O 17 16.6 2.3', 'M6 8 L5 11.8 L19.5 11.8', 'M11.5 7.6 L11.5 11.8'],
    '山': [{ d: 'M1.5 20 L8.5 7.5 L12 13 L15.5 6.5 L22.5 20 Z', f: 'soft' }, 'M6.7 10.8 L8.5 7.5 L10.2 10.3 L8.6 9.6 Z'],
    '树': ['M12 21.5 L12 12.5', 'M9 21.5 L15 21.5', { d: 'M12 2.8 C6.2 2.8 4.2 7.8 6.6 10.8 C4 14 8 16.8 12 14.6 C16 16.8 20 14 17.4 10.8 C19.8 7.8 17.8 2.8 12 2.8 Z', f: 'c3' }],
    '太阳': [{ d: 'O 12 12 4.6', f: 'hy' }, 'M12 2 L12 4.5', 'M12 19.5 L12 22', 'M2 12 L4.5 12', 'M19.5 12 L22 12', 'M4.9 4.9 L6.7 6.7', 'M17.3 17.3 L19.1 19.1', 'M4.9 19.1 L6.7 17.3', 'M17.3 6.7 L19.1 4.9'],
    '剪刀': ['O 6.5 17.5 3', 'O 17.5 17.5 3', 'M8.6 15.3 L18.5 2.5', 'M15.4 15.3 L5.5 2.5'],
    '播放': ['M2.5 3.5 L21.5 3.5 L21.5 17 L2.5 17 Z', { d: 'M9.8 7 L15.6 10.2 L9.8 13.5 Z', f: 'red' }, 'M7 20.5 L17 20.5'],
    '清单': ['M4.5 2.8 L19.5 2.8 L19.5 21.5 L4.5 21.5 Z', { d: 'M7.5 7.8 L8.8 9.2 L11 6.4', c: 'red' }, 'M13 8 L17 8', { d: 'M7.5 12.8 L8.8 14.2 L11 11.4', c: 'red' }, 'M13 13 L17 13', 'M7.5 17.8 L17 17.8'],
    '购物车': ['M1.8 3.8 L5 3.8 L7.5 15 L18.5 15 L20.6 7 L6 7', 'O 9 19 1.7', 'O 17 19 1.7'],
    '闪电': [{ d: 'M13.5 2 L5 13.6 L11 13.6 L9.8 22 L19 9.6 L13 9.6 Z', f: 'hy' }],
    '地球': [{ d: 'O 12 12 9.2', f: 'soft' }, 'M2.8 12 L21.2 12', 'M12 2.8 C7 7 7 17 12 21.2', 'M12 2.8 C17 7 17 17 12 21.2'],
    '奖杯': [{ d: 'M7 3 L17 3 L17 9 C17 13.5 7 13.5 7 9 Z', f: 'hy' }, 'M7 5 C2.8 5 3 10.5 7.6 10.8', 'M17 5 C21.2 5 21 10.5 16.4 10.8', 'M12 13.3 L12 17', 'M8 21.3 L16 21.3 L15 17 L9 17 Z'],
    '钱': [{ d: 'O 12 12 9.2', f: 'hy' }, 'M8.6 6.8 L12 11.3 L15.4 6.8', 'M12 11.3 L12 18', 'M8.8 12.6 L15.2 12.6', 'M8.8 15.2 L15.2 15.2'],
    '铅笔': [{ d: 'M3.8 20.2 L5 15 L16 4 L20 8 L9 19 Z', f: 'hy' }, 'M14 6 L18 10', 'M5 15 L9 19'],
    '书': [{ d: 'M2.5 5 C6 3.8 9.5 4 12 6 C14.5 4 18 3.8 21.5 5 L21.5 19.5 C18 18.3 14.5 18.5 12 20.5 C9.5 18.5 6 18.3 2.5 19.5 Z', f: 'soft' }, 'M12 6 L12 20.5'],
    '闹钟': ['O 12 13 8.5', 'M12 8 L12 13 L15.5 15', 'M3.5 5 L7 2.4', 'M20.5 5 L17 2.4'],
    '问号': ['M8.5 8.5 C8.5 5 15.5 4.5 15.5 8.8 C15.5 11.5 12 11.8 12 15', 'M12 19 L12 20'],
    '感叹': ['M12 3.5 L12 15', 'M12 19 L12 20.5'],
    '火箭': [{ d: 'M12 2 C16.5 5.5 17 11 15 16 L9 16 C7 11 7.5 5.5 12 2 Z', f: 'soft' }, { d: 'O 12 8.8 1.8', f: 'red' }, 'M9 13 L5.5 17 L8.5 17.5', 'M15 13 L18.5 17 L15.5 17.5', { d: 'M10 18 L12 22 L14 18', c: 'red' }],
  };
  const ICON_KEYS = Object.keys(ICONS);

  // 按关键词自动配图（从上到下优先）
  const ICON_RULES = [
    ['场记板', /vlog|Vlog|VLOG|拍成|短视频|视频/],
    ['麦克风', /声音|配音|录音|画外音|独白|对白|口播|说什么/],
    ['剪刀', /剪辑|后期|拍后|剪/],
    ['播放', /复盘|回看|播放|回放/],
    ['终点', /结尾|收尾|终点|结束|涩话|升华/],
    ['靶心', /目的|目标|定位|核心|重点/],
    ['漏斗', /选题|筛选|漏斗|转化|受众/],
    ['闪电', /爆点|开头|吸引|钩子|突发|前置/],
    ['相机', /拍摄|拍|镜头|摄影|相机|画面/],
    ['笑脸', /心态|情绪|感受|亲和|开心/],
    ['人群', /观众|用户|团队|互动|博主|记住|人设|个人|面试官|候选人/],
    ['书', /叙事|故事|学习|方法|知识|课|阅读/],
    ['钱', /薪资|收益|成本|回报|赚|价格|预算|薪/],
    ['购物车', /购物|买|消费/],
    ['地球', /旅行|旅程|出行|世界|出国/],
    ['奖杯', /风格|优势|成果|成就|出彩/],
    ['对话', /沟通|交流|面试|表达|提问|问题|聊/],
    ['清单', /案例|速查|整理|清单|准备|步骤|SOP|流程|行动|计划|必做|执行/],
    ['灯泡', /想法|灵感|思维|技巧|原则|为什么|思考|启发/],
    ['闹钟', /时间|日程|效率|习惯/],
    ['火箭', /增长|成长|提升|进阶|发展/],
    ['铅笔', /笔记|写作|写|记录/],
  ];
  function autoIcon(text) {
    const t = String(text || '');
    for (const [k, re] of ICON_RULES) if (re.test(t)) return k;
    return '';
  }

  // ---------- 工具 ----------
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0 || 1; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function hexA(hex, a) {
    if (!hex || hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const CIRCLED = '⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
  const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
  function circled(n) { return CIRCLED[n] || `(${n})`; }

  // ---------- 行内语法 ----------
  function inline(raw) {
    let s = raw
      .replace(/<->|↔|⇄|⇆/g, '\u0001')
      .replace(/<-|←/g, '\u0005')
      .replace(/-->|⟶/g, '\u0004')
      .replace(/=>|⇒/g, '\u0003')
      .replace(/->|→/g, '\u0002');
    s = esc(s);
    s = s.replace(/\[\[(.+?)\]\]/g, '<span class="pill">$1</span>');
    s = s.replace(new RegExp('\\[(' + ICON_KEYS.join('|') + ')\\]', 'g'), (m, k) => `<span class="ic" data-ic="${k}"></span>`);
    s = s
      .replace(/\*\*(.+?)\*\*/g, '<span class="mk hy">$1</span>')
      .replace(/==(.+?)==/g, '<span class="mk hr">$1</span>')
      .replace(/!!(.+?)!!/g, '<span class="ink-r">$1</span>')
      .replace(/\^\^(.+?)\^\^/g, '<span class="ink-b">$1</span>')
      .replace(/__(.+?)__/g, '<span class="wavy">$1</span>')
      .replace(/\(\((.+?)\)\)/g, '<span class="circ">$1</span>');
    s = s
      .replace(/\u0001/g, '<span class="arr" data-k="d"></span>')
      .replace(/\u0005/g, '<span class="arr" data-k="l"></span>')
      .replace(/\u0004/g, '<span class="arr long" data-k="r"></span>')
      .replace(/\u0003/g, '<span class="arr" data-k="b"></span>')
      .replace(/\u0002/g, '<span class="arr" data-k="r"></span>');
    return s;
  }

  const visLen = (t) => t.replace(/\*\*|==|!!|\^\^|__|\(\(|\)\)|\[\[|\]\]/g, '').replace(/\[[^\]]{1,3}\]/g, '').trim().length;
  function flowHTML(t, ind) {
    const nodes = t.split(/\s*(?:->|→)\s*/).filter((n) => n.length);
    return `<div class="ln flow"${ind}>` + nodes.map((n) => {
      const plain = /^(==.+==|\*\*.+\*\*)$/.test(n.replace(/\[[^\]]{1,3}\]\s*/g, '').trim());
      const short = plain && visLen(n) <= 8;
      return `<span class="fnode${plain ? ' nobox' : ''}${short ? ' short' : ''}">${inline(n)}</span>`;
    }).join('<span class="arr" data-k="r"></span>') + '</div>';
  }
  function isAutoFlow(t, style) {
    if (!style || !style.flowBox) return false;
    if (/<->|↔|-->|=>/.test(t)) return false;
    const nodes = t.split(/\s*(?:->|→)\s*/);
    if (nodes.length < 4) return false;
    return nodes.every((n) => { const l = visLen(n); return l >= 1 && l <= 11 && !/[：:，,；;。]/.test(n.replace(/\(\(.*?\)\)/g, '')); });
  }
  function itemHTML(text, style) {
    const lines = String(text || '').split('\n');
    let out = '';
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (/^\s*\|.*\|\s*$/.test(L)) {
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim());
          if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
          i++;
        }
        i--;
        out += '<table class="tb">' + rows.map((r, ri) => '<tr>' + r.map((c) => `<td>${ri === 0 ? `<span class="mk hy">${inline(c)}</span>` : inline(c)}</td>`).join('') + '</tr>').join('') + '</table>';
        continue;
      }
      const indent = (L.match(/^(\s*)/)[1].replace(/\t/g, '  ').length / 2) | 0;
      const ind = indent ? ` style="margin-left:${indent * 1.3}em"` : '';
      const t = L.trim();
      let m;
      if (!t) out += '<div class="ln gap"></div>';
      else if (/^#{1,4}\s+/.test(t)) out += `<div class="ln sub"${ind}><span class="subt">${inline(t.replace(/^#+\s+/, ''))}</span></div>`;
      else if (/^>>\s*/.test(t)) out += flowHTML(t.replace(/^>>\s*/, ''), ind);
      else if (isAutoFlow(t, style)) out += flowHTML(t, ind);
      else if (/^>\s?/.test(t)) out += `<div class="ln note"${ind}>${inline(t.replace(/^>\s?/, ''))}</div>`;
      else if (/^[-*•]\s+/.test(t)) out += `<div class="ln bl"${ind}><span class="bdot"></span><span class="lt">${inline(t.replace(/^[-*•]\s+/, ''))}</span></div>`;
      else if ((m = t.match(/^(\d{1,2})[.、)）]\s*/))) out += `<div class="ln nm"${ind}><span class="num">${circled(+m[1])}</span><span class="lt">${inline(t.slice(m[0].length))}</span></div>`;
      else out += `<div class="ln"${ind}>${inline(t)}</div>`;
    }
    return out;
  }

  function chapLabel(doc, idx, style) {
    const ch = doc.chapters[idx];
    const n = idx + 1;
    if (style.layout === 'sop' || style.layout === 'mind' || style.layout === 'sketch' || style.numbering === 'none') return inline(ch.title);
    const pre = style.numbering === 'num' ? `${n}. ` : style.numbering === 'circle' ? `${circled(n)} ` : `${CN_NUM[n] || n}、`;
    return esc(pre) + inline(ch.title);
  }

  // ---------- 结构 ----------
  function buildHTML(doc, style) {
    const items = (ch) => ch.items.map((it) => `<div class="item" data-id="${it.id}" data-chap="${ch.id}">${itemHTML(it.text, style)}</div>`).join('');
    const hasIcon = (t) => new RegExp('\\[(' + ICON_KEYS.join('|') + ')\\]').test(t);
    const autoIc = (t) => (style.autoIcon !== false && !hasIcon(t) ? autoIcon(t) : '');
    let head = '';
    if (style.showHead !== false && style.layout === 'sketch') {
      const ti = autoIc(doc.title);
      head = `<div class="nt-head sk-head">
        <div class="sk-title-row">${ti ? `<span class="ic huge" data-ic="${ti}"></span>` : ''}<span class="nt-title" data-field="title">${inline(doc.title || '未命名笔记')}</span><span class="sk-ticks"></span></div>
        <div class="sk-meta">${doc.subtitle ? `<span class="nt-sub" data-field="subtitle">${inline(doc.subtitle)}</span>` : ''}${doc.author ? `<span class="nt-author" data-field="author">${inline(doc.author)}</span>` : ''}</div>
      </div>`;
    } else if (style.showHead !== false && style.layout !== 'mind') {
      head = `<div class="nt-head">
        <div class="nt-title" data-field="title">${inline(doc.title || '未命名笔记')}</div>
        ${doc.subtitle ? `<div><span class="nt-sub" data-field="subtitle">${inline(doc.subtitle)}</span></div>` : ''}
        ${doc.author ? `<div class="nt-author" data-field="author">${inline(doc.author)}</div>` : ''}
      </div>`;
    }
    let body = '';
    if (style.layout === 'sop') {
      body = `<div class="nb L-sop">` + doc.chapters.map((ch, i) => `
        <section class="chap step" data-id="${ch.id}">
          <div class="step-num"><span>${i + 1}</span></div>
          <div class="step-body">
            <div class="ch-head"><span class="hd">${chapLabel(doc, i, style)}</span></div>
            <div class="ch-items cols-${ch.cols || 1}">${items(ch)}</div>
          </div>
        </section>`).join('') + `</div>`;
    } else if (style.layout === 'mind') {
      body = `<div class="nb L-mind">
        <div class="m-root" data-field="title">${inline(doc.title || '中心主题')}${doc.subtitle ? `<div style="font-size:.62em;color:var(--c-red);margin-top:.3em">${inline(doc.subtitle)}</div>` : ''}</div>
        <div class="m-branches">` + doc.chapters.map((ch, i) => `
          <div class="m-branch chap" data-id="${ch.id}" data-bi="${i}">
            <div class="m-node"><span class="hd">${chapLabel(doc, i, style)}</span></div>
            <div class="m-leaves">${ch.items.map((it) => `<div class="item m-leaf" data-id="${it.id}" data-chap="${ch.id}">${itemHTML(it.text, style)}</div>`).join('')}</div>
          </div>`).join('') + `</div></div>`;
    } else if (style.layout === 'sketch') {
      let k = style._numStart || 0;
      const secs = doc.chapters.map((ch) => {
        const title = (ch.title || '').trim();
        const ic = title ? autoIc(title) : '';
        const selfNum = isSelfNumbered(title);
        let num = '';
        if (title && !selfNum && style.numbering !== 'none') {
          k++;
          num = style.numbering === 'cn' ? `<span class="hnum plain">${CN_NUM[k] || k}、</span>` : `<span class="hnum">${k}</span>`;
        }
        const span = ['full', 'wide', 'narrow'].includes(ch.span) ? ch.span : 'half';
        return { span, html: `<section class="chap sk-${span}" data-id="${ch.id}" data-span="${span}">
          ${title ? `<div class="ch-head">${num}<span class="hd">${inline(title)}</span>${ic ? `<span class="ic big" data-ic="${ic}"></span>` : ''}</div>` : ''}
          <div class="ch-items cols-${ch.cols || 1}">${items(ch)}</div>
        </section>` };
      });
      // 连续的非整幅章节组成一个“拼版带”，整幅章节单独成带
      const bands = [];
      secs.forEach((x) => {
        if (x.span === 'full') bands.push({ full: true, list: [x] });
        else {
          const kind = x.span === 'half' ? 'half' : 'wn';
          const last = bands[bands.length - 1];
          if (last && !last.full && last.kind === kind) last.list.push(x); else bands.push({ full: false, kind, list: [x] });
        }
      });
      body = `<div class="nb L-sketch"><div class="sk-bands">` + bands.map((bd) => {
        if (bd.full) return `<div class="sk-band full">${bd.list[0].html}</div>`;
        const wn = bd.list.some((x) => x.span === 'wide' || x.span === 'narrow');
        return `<div class="sk-band${wn ? ' wn' : ''}"><div class="sk-col">${bd.list.map((x) => x.html).join('')}</div><div class="sk-col"></div></div>`;
      }).join('') + `</div></div>`;
    } else {
      body = `<div class="nb L-class">` + doc.chapters.map((ch, i) => `
        ${i > 0 ? '<div class="divider"></div>' : ''}
        <section class="chap" data-id="${ch.id}">
          <div class="ch-head"><span class="hd">${chapLabel(doc, i, style)}</span></div>
          <div class="ch-items cols-${ch.cols || 1}">${items(ch)}</div>
        </section>`).join('') + `</div>`;
    }
    const foot = style.showFoot !== false && doc.footer ? `<div class="nt-foot" data-field="footer">${itemHTML(doc.footer, null)}</div>` : '';
    return `<div class="page-inner">${head}${body}${foot}</div>`;
  }

  function resolvePalette(style) {
    const base = PALETTES.find((p) => p.id === style.palette) || PALETTES[0];
    const p = Object.assign({}, base);
    if (style.custom) for (const k of ['text', 'red', 'blue']) if (style.custom[k]) p[k] = style.custom[k];
    if (style.custom && style.custom.hy) p.hy = hexA(style.custom.hy, 0.6);
    if (style.custom && style.custom.head) p.head = hexA(style.custom.head, 0.6);
    return p;
  }
  function resolveHeadFont(style) {
    if (!style.headFont || style.headFont === 'same') return resolveFont(style);
    const f = FONTS.find((x) => x.id === style.headFont);
    return f && f.file ? f : resolveFont(style);
  }
  function resolveFont(style) {
    const f = FONTS.find((x) => x.id === style.font) || FONTS[0];
    if (f.id === 'local') return { family: style.localFont || 'Kaiti SC', file: '' };
    return f;
  }

  function paperBackground(paper, lh, padTop) {
    const layers = [], sizes = [], pos = [];
    if (paper.kind === 'ruled') {
      layers.push(`linear-gradient(to bottom, transparent ${lh - 1.2}px, ${paper.line} ${lh - 1.2}px, ${paper.line} ${lh}px)`);
      sizes.push(`100% ${lh}px`); pos.push(`0 ${padTop + 6}px`);
    } else if (paper.kind === 'grid') {
      layers.push(`linear-gradient(${paper.line} 1px, transparent 1px)`, `linear-gradient(90deg, ${paper.line} 1px, transparent 1px)`);
      sizes.push('28px 28px', '28px 28px'); pos.push('0 0', '0 0');
    } else if (paper.kind === 'dot') {
      layers.push(`radial-gradient(${paper.line} 1.1px, transparent 1.4px)`);
      sizes.push('26px 26px'); pos.push('13px 13px');
    }
    if (false && paper.noise) {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${paper.dark ? 1 : 0.35} 0 0 0 0 ${paper.dark ? 1 : 0.25} 0 0 0 0 ${paper.dark ? 1 : 0.1} 0 0 0 ${paper.dark ? 0.07 : 0.09} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
      layers.push(`url("data:image/svg+xml;utf8,${svg.replace(/"/g, "'").replace(/#/g, '%23')}")`);
      sizes.push('220px 220px'); pos.push('0 0');
    }
    return { image: layers.join(','), size: sizes.join(','), position: pos.join(',') };
  }

  // 每个字轻微上下浮动，模拟手写的基线不齐
  function jitterChars(root, amount, seed) {
    const R = rng(seed);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) { const n = walker.currentNode; if (n.nodeValue.trim()) nodes.push(n); }
    for (const n of nodes) {
      const frag = document.createDocumentFragment();
      for (const ch of n.nodeValue) {
        if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
        const sp = document.createElement('span');
        sp.className = 'c';
        sp.textContent = ch;
        const dy = (R() - 0.5) * amount * 1.6;
        if (amount > 0.05) sp.style.top = dy.toFixed(2) + 'px';
        frag.appendChild(sp);
      }
      n.parentNode.replaceChild(frag, n);
    }
  }

  function isSelfNumbered(title) { return /^([A-Za-z0-9]{1,2}[.、．)]|[①-⑳]|[一二三四五六七八九十]+、)/.test(title); }
  function countNumbered(chapters) { return chapters.filter((c) => (c.title || '').trim() && !isSelfNumbered(c.title.trim())).length; }
  // 手账风瀑布流：按实际高度把章节分到较短的一栏
  function balanceBands(page) {
    page.querySelectorAll('.sk-band:not(.full)').forEach((band) => {
      const [c0, c1] = band.querySelectorAll(':scope > .sk-col');
      const list = Array.from(c0.children);
      const wn = band.classList.contains('wn');
      const hs = list.map((el) => el.offsetHeight);
      let h0 = 0, h1 = 0;
      list.forEach((el, i) => {
        const sp = el.dataset.span;
        let to;
        if (wn && sp === 'wide') to = 0; else if (wn && sp === 'narrow') to = 1;
        else if (i === 0) to = 0; else if (i === 1 && !wn) to = 1;
        else to = h0 <= h1 ? 0 : 1;
        (to === 0 ? c0 : c1).appendChild(el);
        if (to === 0) h0 += hs[i]; else h1 += hs[i];
      });
    });
  }

  // 导出前冻结换行：在页面实际折行处插入硬换行，并禁止再自动换行，保证导出图与页面一模一样
  const BLOCK_SEL = '.ln, td, .fnode, .nt-title, .nt-sub, .nt-author, .hd, .m-root';
  function freezeLines(page) {
    const items = [];
    page.querySelectorAll('.page-inner .c, .page-inner .arr, .page-inner .ic').forEach((el) => {
      const block = el.closest(BLOCK_SEL);
      if (!block) return;
      const r = el.getBoundingClientRect();
      const off = parseFloat(el.style.top) || 0;
      items.push({ el, block, top: r.top - off, bottom: r.bottom - off });
    });
    let lastBlock = null, lineBottom = 0;
    const breaks = [];
    for (const it of items) {
      const c = (it.top + it.bottom) / 2;
      if (it.block !== lastBlock) lineBottom = it.bottom;
      else if (c > lineBottom) { breaks.push(it.el); lineBottom = it.bottom; }
      else lineBottom = Math.max(lineBottom, it.bottom);
      lastBlock = it.block;
    }
    breaks.forEach((el) => el.parentNode.insertBefore(document.createElement('br'), el));
    page.classList.add('frozen');
  }

  // ---------- 主渲染 ----------
  async function render(page, doc, style, opts = {}) {
    const paper = PAPERS.find((p) => p.id === style.paper) || PAPERS[1];
    const pal = resolvePalette(style);
    const font = resolveFont(style);
    const size = SIZES[style.pageSize] || SIZES.long;
    const ink = style.inkOpacity == null ? 0.92 : style.inkOpacity;

    page.className = 'page' + (size.h ? ' fixed' : '') + (opts.editing ? ' editing' : '');
    page.style.width = size.w + 'px';
    page.style.height = size.h ? size.h + 'px' : '';
    page.style.background = paper.bg;
    const hfont = resolveHeadFont(style);
    page.style.setProperty('--note-font', `"${font.family}", "Xiaolai", "LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", cursive`);
    page.style.setProperty('--head-font', `"${hfont.family}", "${font.family}", "Xiaolai", "Kaiti SC", cursive`);
    page.classList.add('lay-' + (style.layout || 'class'));
    page.style.setProperty('--c-text', hexA(pal.text, ink));
    page.style.setProperty('--c-red', hexA(pal.red, Math.min(1, ink + 0.05)));
    page.style.setProperty('--c-blue', hexA(pal.blue, Math.min(1, ink + 0.05)));
    page.style.setProperty('--c-head-ink', hexA(pal.text, ink));
    const w = style.weight || 400;
    page.style.setProperty('--stroke', (Math.max(0, w - 400) / 300 * 0.85).toFixed(2) + 'px');
    page.style.fontWeight = 400;

    page.innerHTML = buildHTML(doc, style) + (paper.noise
      ? `<svg class="paper-noise" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="pn-${paper.id}"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${paper.dark ? 1 : 0.35} 0 0 0 0 ${paper.dark ? 1 : 0.25} 0 0 0 0 ${paper.dark ? 1 : 0.1} 0 0 0 ${paper.dark ? 0.07 : 0.09} 0"/></filter><rect width="100%" height="100%" filter="url(#pn-${paper.id})"/></svg>`
      : '');
    const inner = page.querySelector('.page-inner');

    try {
      if (font.file) await document.fonts.load(`20px "${font.family}"`, '笔记ABC');
      if (hfont.file) await document.fonts.load(`20px "${hfont.family}"`, '笔记ABC');
    } catch (e) {}

    const seed = hash((doc.id || '') + (style.seedBump || 0));
    jitterChars(inner, (style.jitter == null ? 1 : style.jitter), seed);
    if (style.layout === 'sketch') balanceBands(page);
    // 字号：长图用设定字号，固定尺寸自动缩放以塞进页面
    let fs = 21 * (style.fontScale || 1);
    // 标题、章节名等单行元素超出宽度时单独缩小
    const shrinkRows = () => {
      page.querySelectorAll('.sk-title-row, .L-sketch .ch-head').forEach((row) => {
        const t = row.querySelector('.nt-title, .hd');
        if (!t) return;
        t.style.fontSize = '';
        const kids = Array.from(row.children);
        const need = kids.reduce((a, c) => { const cs = getComputedStyle(c); return a + c.offsetWidth + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight); }, 0) + (parseFloat(getComputedStyle(row).columnGap) || 0) * (kids.length - 1);
        if (need > row.clientWidth + 1) {
          const base = parseFloat(getComputedStyle(t).fontSize);
          const k = (row.clientWidth - (need - t.offsetWidth)) / t.offsetWidth;
          t.style.fontSize = Math.max(8, base * Math.min(1, k) * 0.97) + 'px';
        }
      });
    };
    const apply = (f) => { page.style.fontSize = f + 'px'; if (style.layout === 'sketch') shrinkRows(); };
    apply(fs);
    if (size.h) {
      // 内容少时放大填满页面（最多 1.7 倍），内容多时缩小
      let lo = 9, hi = fs * 1.7, best = lo;
      apply(hi);
      if (inner.scrollHeight <= size.h) best = hi;
      else {
        for (let k = 0; k < 9; k++) {
          const mid = (lo + hi) / 2; apply(mid);
          if (inner.scrollHeight <= size.h) { best = mid; lo = mid; } else hi = mid;
        }
      }
      fs = best; apply(fs);
    }
    const lh = fs * 1.75;
    const bg = paperBackground(paper, lh, 54);
    page.style.backgroundImage = bg.image;
    page.style.backgroundSize = bg.size;
    page.style.backgroundPosition = bg.position;


    drawOverlay(page, style, pal, seed);
    if (opts.freeze) freezeLines(page);
    return { fontSize: fs, overflow: size.h ? inner.scrollHeight > size.h + 2 : false };
  }

  // ---------- Rough 覆盖层 ----------
  function drawOverlay(page, style, pal, baseSeed) {
    page.querySelectorAll('.ov').forEach((n) => n.remove());
    const W = page.offsetWidth, H = page.offsetHeight;
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (cls) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'ov ' + cls); s.setAttribute('width', W); s.setAttribute('height', H); s.setAttribute('viewBox', `0 0 ${W} ${H}`); page.appendChild(s); return s; };
    const back = mk('back'), front = mk('front');
    const brush = style.brush || 'pencil';
    const jit = style.jitter == null ? 1 : style.jitter;
    const bw = style.brushWidth || 2;
    const ink = style.inkOpacity == null ? 0.92 : style.inkOpacity;

    // 粉笔/铅笔质感滤镜
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<filter id="f-chalk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.6"/><feComposite operator="in" in2="SourceGraphic"/></filter>
      <filter id="f-pencil"><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.5" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`;
    front.appendChild(defs);
    const gF = document.createElementNS(NS, 'g');
    const gB = document.createElementNS(NS, 'g');
    if (brush === 'chalk') gF.setAttribute('filter', 'url(#f-chalk)');
    if (brush === 'pencil') gF.setAttribute('filter', 'url(#f-pencil)');
    gF.setAttribute('opacity', Math.min(1, ink + 0.05));
    front.appendChild(gF); back.appendChild(gB);

    const rc = rough.svg(front);
    let sc = 0;
    const seed = () => ((baseSeed + (++sc) * 7919) % 2147483646) + 1;
    const lineOpt = (o = {}) => {
      const base = brush === 'marker'
        ? { roughness: 0.25 + jit * 0.45, bowing: 0.6 + jit * 0.6, strokeWidth: bw * 1.7, disableMultiStroke: true }
        : brush === 'chalk'
          ? { roughness: 0.9 + jit * 1.0, bowing: 1 + jit, strokeWidth: bw * 1.35 }
          : { roughness: 0.45 + jit * 0.85, bowing: 0.8 + jit, strokeWidth: bw * 0.9 };
      return Object.assign(base, { seed: seed() }, o);
    };
    const add = (g, n) => { if (n) { n.querySelectorAll('path').forEach((p) => { p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }); g.appendChild(n); } };

    const pr = page.getBoundingClientRect();
    const k = pr.width / W || 1;
    const rel = (r) => ({ x: (r.left - pr.left) / k, y: (r.top - pr.top) / k, w: r.width / k, h: r.height / k });
    const box = (el) => rel(el.getBoundingClientRect());
    const R = rng(baseSeed + 99);

    const hlStyle = style.hlStyle || 'solid';
    function highlight(r, color, top = 0.16, bottom = 0.96) {
      const j = 1.5 + jit * 1.6;
      const x = r.x, y = r.y, w = r.w, h = r.h;
      const pts = [
        [x - 3 + (R() - 0.5) * j, y + h * top + (R() - 0.5) * j],
        [x + w + 3 + (R() - 0.5) * j, y + h * (top - 0.04) + (R() - 0.5) * j],
        [x + w + 2 + (R() - 0.5) * j, y + h * bottom + (R() - 0.5) * j],
        [x - 2 + (R() - 0.5) * j, y + h * (bottom + 0.02) + (R() - 0.5) * j],
      ];
      const n = hlStyle === 'hachure'
        ? rough.svg(back).polygon(pts, { fill: color, fillStyle: 'hachure', hachureGap: 2.6, fillWeight: 2.4, hachureAngle: -50, stroke: 'none', roughness: 1.1, seed: seed() })
        : rough.svg(back).polygon(pts, { fill: color, fillStyle: 'solid', stroke: 'none', roughness: 0.8 + jit * 0.5, seed: seed() });
      gB.appendChild(n);
    }
    function lineRects(el) {
      // 多行行内元素按行拆分
      const rs = Array.from(el.getClientRects()).map(rel).filter((r) => r.w > 2);
      const merged = [];
      for (const r of rs) {
        const last = merged[merged.length - 1];
        if (last && Math.abs(last.y - r.y) < r.h * 0.5) { const x2 = Math.max(last.x + last.w, r.x + r.w); last.x = Math.min(last.x, r.x); last.w = x2 - last.x; last.h = Math.max(last.h, r.h); }
        else merged.push(Object.assign({}, r));
      }
      return merged;
    }
    function arrow(x1, y, x2, color, kind, sw) {
      const o = lineOpt({ stroke: color });
      if (sw) o.strokeWidth = sw;
      const hs = Math.max(5, (x2 - x1) * 0.22);
      const wob = (R() - 0.5) * jit * 1.5;
      add(gF, rc.line(x1, y + wob, x2, y, o));
      const head = (x, dir) => {
        add(gF, rc.line(x, y, x - dir * hs, y - hs * 0.62, lineOpt({ stroke: color, strokeWidth: o.strokeWidth, roughness: o.roughness * 0.6 })));
        add(gF, rc.line(x, y, x - dir * hs, y + hs * 0.62, lineOpt({ stroke: color, strokeWidth: o.strokeWidth, roughness: o.roughness * 0.6 })));
      };
      if (kind === 'l') head(x1, -1); else head(x2, 1);
      if (kind === 'd') head(x1, -1);
    }

    const layout = style.layout || 'class';
    const SK = layout === 'sketch';
    function roundRect(x, y, w, h, rr, o) {
      rr = Math.min(rr, h / 2, w / 2);
      const d = `M${x + rr} ${y} L${x + w - rr} ${y} Q${x + w} ${y} ${x + w} ${y + rr} L${x + w} ${y + h - rr} Q${x + w} ${y + h} ${x + w - rr} ${y + h} L${x + rr} ${y + h} Q${x} ${y + h} ${x} ${y + h - rr} L${x} ${y + rr} Q${x} ${y} ${x + rr} ${y} Z`;
      add(gF, rc.path(d, o));
    }
    // 1. 章节标题底色（手账风：黄色马克笔压在字的下半部）
    page.querySelectorAll('.hd').forEach((el) => lineRects(el).forEach((r) => SK ? highlight(r, pal.hy, 0.42, 1.02) : highlight(r, pal.head, 0.22, 0.98)));
    if (SK) {
      const t = page.querySelector('.sk-head .nt-title');
      if (t) lineRects(t).forEach((r) => highlight({ x: r.x - 6, y: r.y, w: r.w + 12, h: r.h }, pal.hy, 0.5, 0.98));
      page.querySelectorAll('.hnum:not(.plain)').forEach((el) => {
        const r = box(el); const d = Math.max(r.w, r.h) * 1.05;
        add(gF, rc.circle(r.x + r.w / 2, r.y + r.h / 2 + 1, d, lineOpt({ stroke: pal.text, strokeWidth: bw * 1.15 })));
      });
      const ticks = page.querySelector('.sk-ticks');
      if (ticks) { const r = box(ticks); for (let i = 0; i < 3; i++) { const a = -0.9 + i * 0.6; const cx = r.x + 6, cy = r.y + r.h * 0.45; add(gF, rc.line(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, cx + Math.cos(a) * 20, cy + Math.sin(a) * 20, lineOpt({ stroke: pal.red, strokeWidth: bw * 1.1 }))); } }
    }
    // 2. 文字高光
    page.querySelectorAll('.mk.hy').forEach((el) => lineRects(el).forEach((r) => highlight(r, pal.hy, 0.3, 0.98)));
    page.querySelectorAll('.mk.hr').forEach((el) => lineRects(el).forEach((r) => highlight(r, pal.hr, 0.3, 0.98)));
    page.querySelectorAll('.ln.sub .subt').forEach((el) => lineRects(el).forEach((r) => {
      add(gF, rc.line(r.x, r.y + r.h * 0.95, r.x + r.w, r.y + r.h * 0.92, lineOpt({ stroke: pal.blue })));
    }));

    // 3. 箭头
    page.querySelectorAll('.arr').forEach((el) => {
      const r = box(el);
      const kind = el.dataset.k;
      const color = kind === 'b' ? pal.red : pal.blue;
      const inRed = el.closest('.ink-r');
      arrow(r.x + 2, r.y + r.h * 0.55, r.x + r.w - 2, inRed ? pal.red : color, kind, kind === 'b' ? bw * 1.5 : null);
    });

    // 4. 波浪线（标题里改为红色马克笔直线）
    page.querySelectorAll('.nt-title .wavy').forEach((el) => lineRects(el).forEach((r) => {
      add(gF, rc.line(r.x, r.y + r.h * 0.97, r.x + r.w, r.y + r.h * 0.94, lineOpt({ stroke: pal.red, strokeWidth: bw * 1.6 })));
    }));
    page.querySelectorAll('.wavy').forEach((el) => !el.closest('.nt-title') && lineRects(el).forEach((r) => {
      const pts = []; const y = r.y + r.h * 0.97; const step = 7;
      for (let x = r.x, i = 0; x <= r.x + r.w + 0.1; x += step / 2, i++) pts.push([x, y + (i % 2 ? 2.2 : -2.2)]);
      add(gF, rc.curve(pts, lineOpt({ stroke: pal.red, roughness: 0.4 + jit * 0.3 })));
    }));
    // 5. 圈注
    page.querySelectorAll('.circ').forEach((el) => {
      lineRects(el).forEach((r) => add(gF, rc.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w + 14, r.h + 6, lineOpt({ stroke: pal.red }))));
    });
    // 6. 项目符号
    page.querySelectorAll('.bdot').forEach((el) => {
      const r = box(el);
      add(gF, rc.circle(r.x + r.w * 0.38, r.y + r.h * 0.62, Math.max(5, r.h * 0.26), lineOpt({ stroke: pal.blue, fill: pal.blue, fillStyle: 'solid', strokeWidth: 1 })));
    });
    // 7. 简笔图标（黑色线条 + 少量彩色色块）
    const FILL = { hy: pal.hy, red: hexA(pal.red, 0.85), blue: hexA(pal.blue, 0.8), soft: hexA(pal.blue, 0.16), c3: hexA(pal.c3, 0.5), text: pal.text };
    page.querySelectorAll('.ic').forEach((el) => {
      const r = box(el); const s = Math.min(r.w, r.h * 1.1) / 24;
      const ox = r.x + (r.w - 24 * s) / 2, oy = r.y + (r.h - 24 * s) / 2;
      const shapes = ICONS[el.dataset.ic] || [];
      const color = el.closest('.ink-b') ? pal.blue : el.closest('.ink-r') ? pal.red : pal.text;
      const big = el.classList.contains('big') || el.classList.contains('huge');
      const sw = big ? Math.max(1.3, bw * 0.9) : Math.max(1, bw * 0.7);
      const iconOpt = (o) => lineOpt(Object.assign({ roughness: (0.35 + jit * 0.45), bowing: 0.6, strokeWidth: sw }, o));
      shapes.forEach((sh) => {
        const d = typeof sh === 'string' ? sh : sh.d;
        const fill = typeof sh === 'object' && sh.f ? FILL[sh.f] : undefined;
        const stroke = typeof sh === 'object' && sh.c ? (pal[sh.c] || color) : color;
        const fo = fill ? { fill, fillStyle: hlStyle === 'hachure' ? 'hachure' : 'solid', hachureGap: 2.2 } : {};
        if (d[0] === 'O') {
          const [cx, cy, rr] = d.slice(2).split(' ').map(Number);
          add(gF, rc.circle(ox + cx * s, oy + cy * s, rr * 2 * s, iconOpt(Object.assign({ stroke }, fo))));
          return;
        }
        const td = d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (m, a, b) => `${(ox + a * s).toFixed(1)} ${(oy + b * s).toFixed(1)}`);
        add(gF, rc.path(td, iconOpt(Object.assign({ stroke }, fo))));
      });
    });
    // 7b. 流程方框 / 圆角框
    page.querySelectorAll('.fnode:not(.nobox)').forEach((el) => {
      const r = box(el);
      roundRect(r.x, r.y, r.w, r.h, 6, lineOpt({ stroke: pal.blue, strokeWidth: Math.max(1, bw * 0.85) }));
    });
    page.querySelectorAll('.pill').forEach((el) => lineRects(el).forEach((r) => {
      roundRect(r.x - 1, r.y + 1, r.w + 2, r.h - 2, r.h / 2, lineOpt({ stroke: pal.text, strokeWidth: Math.max(1, bw * 0.75) }));
    }));
    // 8. 表格线
    page.querySelectorAll('.tb').forEach((tb) => {
      const t = box(tb);
      const rows = Array.from(tb.rows);
      rows.forEach((tr, i) => { if (i === 0) return; const r = box(tr); add(gF, rc.line(t.x, r.y, t.x + t.w, r.y, lineOpt({ stroke: hexA(pal.text, 0.55), strokeWidth: Math.max(0.8, bw * 0.55) }))); });
      if (SK) { roundRect(t.x, t.y, t.w, t.h, 3, lineOpt({ stroke: pal.text, strokeWidth: Math.max(1, bw * 0.8) })); }
      if (rows[0]) Array.from(rows[0].cells).forEach((td, i) => { if (i === 0) return; const r = box(td); add(gF, rc.line(r.x, t.y + 2, r.x, t.y + t.h - 2, lineOpt({ stroke: hexA(pal.text, 0.55), strokeWidth: Math.max(0.8, bw * 0.55) }))); });
    });

    // 9. 标题区
    const sub = page.querySelector('.nt-sub');
    if (sub && !SK) { const r = box(sub); add(gF, rc.curve([[r.x - 4, r.y + r.h], [r.x + r.w * 0.5, r.y + r.h + 2.5], [r.x + r.w + 6, r.y + r.h - 1]], lineOpt({ stroke: pal.red }))); }
    const foot = page.querySelector('.nt-foot');
    if (foot) { const r = box(foot); add(gF, rc.line(r.x, r.y, r.x + r.w, r.y, lineOpt({ stroke: hexA(pal.text, 0.6), strokeWidth: Math.max(0.8, bw * 0.6) }))); }

    if (sub && SK) { const r = box(sub); add(gF, rc.line(r.x - 2, r.y + r.h + 1, r.x + r.w + 4, r.y + r.h, lineOpt({ stroke: pal.red, strokeWidth: bw * 1.1 }))); }
    // 10. 版式相关
    if (SK) {
      const bandsEl = page.querySelector('.sk-bands');
      if (bandsEl) {
        const G = box(bandsEl);
        const bandGap = parseFloat(getComputedStyle(bandsEl).rowGap) || 14;
        const blue = (x1, y1, x2, y2) => add(gF, rc.line(x1, y1 + (R() - 0.5) * 2, x2 + (R() - 0.5) * 2, y2 + (R() - 0.5) * 2, lineOpt({ stroke: pal.blue, strokeWidth: Math.max(1, bw * 0.9) })));
        page.querySelectorAll('.sk-band').forEach((band, bi) => {
          const B = box(band);
          if (bi > 0) blue(G.x, B.y - bandGap / 2, G.x + G.w, B.y - bandGap / 2);
          const cols = band.querySelectorAll(':scope > .sk-col');
          if (cols.length === 2 && cols[1].children.length) {
            const c0 = box(cols[0]), c1 = box(cols[1]);
            const x = (c0.x + c0.w + c1.x) / 2;
            blue(x, B.y + 4, x, B.y + B.h - 2);
          }
          cols.forEach((col) => {
            const gap = parseFloat(getComputedStyle(col).rowGap) || 14;
            Array.from(col.children).forEach((sec, i) => {
              if (i === 0) return;
              const r = box(sec); const C = box(col);
              blue(C.x, r.y - gap / 2, C.x + C.w, r.y - gap / 2);
            });
          });
        });
      }
    } else if (layout === 'class') {
      page.querySelectorAll('.divider').forEach((el) => {
        const r = box(el); const y = r.y + r.h * 0.5;
        add(gF, rc.line(r.x + 30, y, r.x + r.w - 30, y + (R() - 0.5) * 3, lineOpt({ stroke: pal.red, strokeWidth: bw * 1.1 })));
      });
      page.querySelectorAll('.ch-items').forEach((el) => {
        const cols = el.classList.contains('cols-4') ? 4 : el.classList.contains('cols-3') ? 3 : el.classList.contains('cols-2') ? 2 : 1;
        if (cols < 2) return;
        const r = box(el);
        const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
        const cw = (r.w - gap * (cols - 1)) / cols;
        for (let i = 1; i < cols; i++) {
          const x = r.x + cw * i + gap * (i - 0.5);
          add(gF, rc.line(x, r.y + 6, x + (R() - 0.5) * 3, r.y + r.h - 8, lineOpt({ stroke: pal.red })));
        }
      });
    } else if (layout === 'sop') {
      const nums = Array.from(page.querySelectorAll('.step-num'));
      nums.forEach((el, i) => {
        const r = box(el);
        add(gF, rc.circle(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.98, lineOpt({ stroke: pal.red, fill: pal.head, fillStyle: hlStyle === 'hachure' ? 'hachure' : 'solid', hachureGap: 3 })));
        if (i < nums.length - 1) {
          const n = box(nums[i + 1]);
          const x = r.x + r.w / 2, y1 = r.y + r.h + 6, y2 = n.y - 6;
          if (y2 - y1 > 14) {
            add(gF, rc.line(x, y1, x + (R() - 0.5) * 2, y2, lineOpt({ stroke: pal.blue, strokeLineDash: brush === 'marker' ? undefined : [7, 6] })));
            add(gF, rc.line(x, y2, x - 6, y2 - 9, lineOpt({ stroke: pal.blue })));
            add(gF, rc.line(x, y2, x + 6, y2 - 9, lineOpt({ stroke: pal.blue })));
          }
        }
      });
    } else if (layout === 'mind') {
      const colors = [pal.red, pal.blue, pal.c3, pal.text];
      const root = page.querySelector('.m-root');
      if (root) {
        const r = box(root);
        add(gF, rc.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w + 26, r.h + 14, lineOpt({ stroke: pal.red, fill: pal.hy, fillStyle: hlStyle === 'hachure' ? 'hachure' : 'solid', hachureGap: 3, strokeWidth: bw * 1.2 })));
        const rx = r.x + r.w + 13, ry = r.y + r.h / 2;
        page.querySelectorAll('.m-branch').forEach((br, i) => {
          const c = colors[i % colors.length];
          const node = box(br.querySelector('.m-node'));
          const nx = node.x - 2, ny = node.y + node.h / 2;
          add(gF, rc.path(`M${rx} ${ry} C ${rx + 30} ${ry}, ${nx - 34} ${ny}, ${nx} ${ny}`, lineOpt({ stroke: c, strokeWidth: bw * 1.4 })));
          const ex = node.x + node.w + 4;
          br.querySelectorAll('.m-leaf').forEach((lf) => {
            const l = box(lf);
            const firstLine = lf.querySelector('.ln, .tb');
            const fl = firstLine ? box(firstLine) : l;
            const ly = fl.y + fl.h - 1;
            add(gF, rc.path(`M${ex} ${ny} C ${ex + 22} ${ny}, ${l.x - 26} ${ly}, ${l.x} ${ly}`, lineOpt({ stroke: c })));
            add(gF, rc.line(l.x, ly, l.x + Math.min(l.w, 260), ly, lineOpt({ stroke: c, strokeWidth: Math.max(1, bw * 0.7) })));
          });
        });
      }
    }
  }

  window.NoteRender = { countNumbered, render, PAPERS, PALETTES, FONTS, SIZES, ICONS, ICON_KEYS, autoIcon, resolveHeadFont, resolveFont, resolvePalette, itemHTML, inline, hexA };
})();
