const COMMERCIAL_TERMS = [
  "#ad", "#ads", "#sponsored", "#partner", "paid partnership", "gifted", "affiliate",
  "use my code", "discount code", "promo code", "sponsor", "ambassador", "合作", "广告", "赞助", "折扣码", "推广"
];

const UNIVERSAL_RISKS = {
  "博彩/投机": ["casino", "gambling", "betting", "sportsbook", "slots", "博彩", "下注", "赌场"],
  "烟草/受管制品": ["vape", "vaping", "tobacco", "cigarette", "nicotine", "电子烟", "烟草"],
  "仇恨或攻击性表达": ["hate speech", "racial slur", "仇恨", "歧视", "种族主义"],
  "危险行为": ["dangerous challenge", "do not try", "reckless", "危险挑战", "请勿模仿"],
  "争议性成人内容": ["nsfw", "onlyfans", "explicit content", "成人内容"]
};

const STYLE_LEXICON = {
  "教育/知识": ["how to", "guide", "tutorial", "tips", "explained", "learn", "教程", "技巧", "科普", "指南", "测评"],
  "生活方式": ["day in my life", "routine", "vlog", "lifestyle", "with me", "日常", "生活", "vlog", "记录"],
  "测评/推荐": ["review", "tested", "comparison", "unboxing", "honest", "best", "测评", "开箱", "推荐", "实测", "对比"],
  "娱乐/幽默": ["funny", "comedy", "prank", "pov", "challenge", "搞笑", "整蛊", "挑战", "段子"],
  "美学/灵感": ["aesthetic", "cinematic", "inspiration", "design", "style", "氛围", "美学", "穿搭", "灵感"],
  "冒险/户外": ["hiking", "camping", "outdoor", "trail", "climbing", "adventure", "徒步", "露营", "户外", "攀岩", "探险"]
};

const REGION_ALIASES = {
  "美国": ["usa", "united states", "new york", "los angeles", "california", "美国", "纽约", "洛杉矶"],
  "英国": ["uk", "united kingdom", "london", "britain", "英国", "伦敦"],
  "德国": ["germany", "berlin", "deutschland", "德国", "柏林"],
  "法国": ["france", "paris", "法国", "巴黎"],
  "加拿大": ["canada", "toronto", "vancouver", "加拿大", "多伦多", "温哥华"],
  "澳大利亚": ["australia", "sydney", "melbourne", "澳大利亚", "悉尼", "墨尔本"],
  "东南亚": ["singapore", "malaysia", "thailand", "indonesia", "philippines", "vietnam", "新加坡", "马来西亚", "泰国", "印尼", "菲律宾", "越南"]
};

const TONE_TO_STYLE = {
  "专业": ["教育/知识", "测评/推荐"], "教育": ["教育/知识"], "生活化": ["生活方式"],
  "幽默": ["娱乐/幽默"], "高端": ["美学/灵感"], "极简": ["美学/灵感"],
  "冒险": ["冒险/户外"], "真实": ["生活方式", "测评/推荐"]
};

export function splitTerms(value = "") {
  return value.split(/[，,;；\n]/).map(v => v.trim()).filter(Boolean);
}

export function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const clean = String(value ?? "").trim().toLowerCase().replace(/,/g, "");
  const match = clean.match(/^([\d.]+)\s*([kmb万亿]?)$/i);
  if (!match) return Number(clean.replace(/[^\d.]/g, "")) || 0;
  const multipliers = { k: 1e3, m: 1e6, b: 1e9, "万": 1e4, "亿": 1e8, "": 1 };
  return Math.round(Number(match[1]) * multipliers[match[2]]);
}

export function parsePosts(text = "") {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split("|").map(x => x.trim());
    return { title: parts[0] || `内容 ${index + 1}`, views: parseNumber(parts[1]), likes: parseNumber(parts[2]), comments: parseNumber(parts[3]), shares: parseNumber(parts[4]) };
  });
}

function csvRows(text) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

export function parseImport(text, filename = "") {
  if (filename.toLowerCase().endsWith(".json") || text.trim().startsWith("[")) {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : parsed.posts;
    if (!Array.isArray(items)) throw new Error("JSON 需要是数组，或包含 posts 数组。");
    return items.map((p, i) => ({ title: p.title || p.caption || `内容 ${i + 1}`, views: parseNumber(p.views), likes: parseNumber(p.likes), comments: parseNumber(p.comments), shares: parseNumber(p.shares) }));
  }
  const rows = csvRows(text); if (!rows.length) return [];
  const header = rows.shift().map(x => x.trim().toLowerCase());
  const aliases = { title: ["title", "caption", "text", "标题", "文案"], views: ["views", "plays", "浏览", "播放"], likes: ["likes", "点赞"], comments: ["comments", "评论"], shares: ["shares", "分享"] };
  const idx = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, header.findIndex(h => names.includes(h))]));
  if (idx.title < 0) throw new Error("CSV 缺少 title/caption（标题/文案）列。");
  return rows.map((r, i) => ({ title: r[idx.title] || `内容 ${i + 1}`, views: parseNumber(r[idx.views]), likes: parseNumber(r[idx.likes]), comments: parseNumber(r[idx.comments]), shares: parseNumber(r[idx.shares]) }));
}

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const median = arr => { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b), m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const containsAny = (text, terms) => terms.some(term => text.includes(term.toLowerCase()));

function tokenMatch(text, terms) {
  const valid = terms.map(t => t.toLowerCase()).filter(t => t.length > 1);
  const hits = valid.filter(t => text.includes(t));
  return { hits: [...new Set(hits)], coverage: valid.length ? hits.length / valid.length : 0 };
}

function classifyStyles(posts, bio) {
  const counts = {};
  const corpus = `${bio} ${posts.map(p => p.title).join(" ")}`.toLowerCase();
  for (const [style, words] of Object.entries(STYLE_LEXICON)) counts[style] = words.filter(w => corpus.includes(w)).length;
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).filter(([,n])=>n>0);
  return sorted.length ? sorted : [["未识别出明显风格", 0]];
}

function interactionScore(posts, platform) {
  const valid = posts.filter(p => p.views > 0);
  if (!valid.length) return { score: 35, rate: 0, consistency: 0, notes: ["缺少可用的播放/浏览数据，互动质量仅能低置信度估计。"] };
  const rates = valid.map(p => (p.likes + p.comments + p.shares) / p.views * 100);
  const rate = median(rates);
  const target = { youtube: 4, instagram: 3, tiktok: 6 }[platform] || 4;
  const rateScore = clamp(rate / target * 75, 15, 92);
  const views = valid.map(p=>p.views), avg=mean(views);
  const cv = avg ? Math.sqrt(mean(views.map(v=>(v-avg)**2))) / avg : 2;
  const consistency = clamp(100 - cv * 38);
  const commentLike = mean(valid.map(p => p.likes ? p.comments / p.likes : 0));
  const qualityBonus = clamp(commentLike / .06 * 10, 0, 10);
  const score = clamp(rateScore * .72 + consistency * .2 + qualityBonus);
  const notes = [`中位互动率 ${rate.toFixed(2)}%（按播放/浏览计算）。`, `内容表现稳定度 ${Math.round(consistency)}/100。`];
  if (cv > 1.2) notes.push("播放量波动较大，平均值可能被少数爆款抬高。");
  if (commentLike < .01) notes.push("评论/点赞比偏低，建议人工抽看评论相关性与重复度。");
  return { score, rate, consistency, notes };
}

function commercialScore(posts) {
  if (!posts.length) return { score: 45, density: 0, marked: [], notes: ["缺少近期内容，无法判断商业化密度。"] };
  const marked = posts.filter(p => containsAny(p.title.toLowerCase(), COMMERCIAL_TERMS));
  const density = marked.length / posts.length;
  let score;
  if (density <= .08) score = 75;
  else if (density <= .3) score = 90;
  else if (density <= .5) score = 65;
  else score = clamp(65 - (density - .5) * 100, 20, 65);
  const notes = [`${marked.length}/${posts.length} 条内容含明确商业合作标记（${(density*100).toFixed(0)}%）。`];
  if (!marked.length) notes.push("未发现披露词不等于没有商业合作，需人工查看画面、链接和置顶评论。");
  if (density > .5) notes.push("商业内容占比较高，品牌信息可能面临注意力稀释。");
  return { score, density, marked: marked.map(p=>p.title), notes };
}

function riskScore(corpus, avoidTopics) {
  const hits = [];
  for (const [label, words] of Object.entries(UNIVERSAL_RISKS)) if (containsAny(corpus, words)) hits.push(label);
  for (const term of avoidTopics) if (corpus.includes(term.toLowerCase())) hits.push(`品牌禁区：${term}`);
  const unique = [...new Set(hits)];
  return { score: clamp(100 - unique.length * 24, 10, 100), hits: unique, notes: unique.length ? ["文本命中仅表示需要复核上下文，不等同于违规结论。"] : ["公开文本未命中已配置的高风险词；仍建议人工抽看内容与评论。"] };
}

function audienceScore(corpus, markets) {
  const clues = [];
  for (const [region, aliases] of Object.entries(REGION_ALIASES)) if (containsAny(corpus, aliases)) clues.push(region);
  const marketHits = markets.filter(m => corpus.includes(m.toLowerCase()) || clues.includes(m) || Object.entries(REGION_ALIASES).some(([r,a]) => r===m && containsAny(corpus,a)));
  const score = markets.length ? clamp(38 + marketHits.length / markets.length * 52 + (clues.length ? 6 : 0), 25, 96) : (clues.length ? 65 : 40);
  return { score, clues, marketHits, notes: [clues.length ? `发现地区线索：${clues.join("、")}。` : "未发现可靠地区线索。", "这不是受众人口画像；合作前应向创作者索取平台后台受众截图。"] };
}

function confidenceScore(input, posts) {
  let points = 15;
  if (input.creator.bio?.trim()) points += 15;
  if (input.creator.followers > 0) points += 10;
  if (input.creator.region?.trim()) points += 8;
  points += Math.min(posts.length, 10) * 3.5;
  if (posts.filter(p=>p.views>0 && p.likes>=0 && p.comments>=0).length >= Math.min(5, posts.length) && posts.length) points += 12;
  if (input.creator.source === "youtube-api") points += 5;
  return clamp(points);
}

export function assessInfluencer(input) {
  const posts = input.creator.posts || [];
  const corpus = `${input.creator.name || ""} ${input.creator.region || ""} ${input.creator.bio || ""} ${posts.map(p=>p.title).join(" ")}`.toLowerCase();
  const values = input.brand.values || [];
  const brandMatch = tokenMatch(corpus, values);
  const styles = classifyStyles(posts, input.creator.bio || "");
  const expectedStyles = [...new Set((input.brand.tones || []).flatMap(t => TONE_TO_STYLE[t] || []))];
  const foundStyles = styles.filter(([,n])=>n>0).map(([s])=>s);
  const styleHits = expectedStyles.filter(s=>foundStyles.includes(s));
  const brandScore = clamp(42 + brandMatch.coverage * 48 + (styleHits.length ? 8 : 0));
  const styleScore = expectedStyles.length ? clamp(45 + styleHits.length / expectedStyles.length * 50) : (foundStyles.length ? 70 : 45);
  const interaction = interactionScore(posts, input.creator.platform);
  const commercial = commercialScore(posts);
  const risk = riskScore(corpus, input.brand.avoidTopics || []);
  const audience = audienceScore(corpus, input.brand.markets || []);
  const dimensions = {
    "品牌调性": { score: brandScore, weight: .30, note: brandMatch.hits.length ? `命中品牌主题：${brandMatch.hits.join("、")}` : "未在公开文本中找到明确品牌主题重合" },
    "内容风格": { score: styleScore, weight: .15, note: foundStyles.length ? `主要风格：${foundStyles.slice(0,3).join("、")}` : "需要人工判断视觉与叙事风格" },
    "受众/地区": { score: audience.score, weight: .15, note: audience.notes[0] },
    "商业化适配": { score: commercial.score, weight: .10, note: commercial.notes[0] },
    "品牌安全": { score: risk.score, weight: .15, note: risk.hits.length ? `需复核：${risk.hits.join("、")}` : "文本初筛未命中风险项" },
    "互动质量": { score: interaction.score, weight: .15, note: interaction.notes[0] }
  };
  const total = Math.round(Object.values(dimensions).reduce((sum,d)=>sum+d.score*d.weight,0));
  const confidence = Math.round(confidenceScore(input, posts));
  let recommendation = total >= 80 && risk.score >= 70 ? "优先洽谈" : total >= 68 && risk.score >= 50 ? "进入人工复核" : total >= 52 ? "谨慎测试" : "暂不建议合作";
  if (confidence < 45 && recommendation === "优先洽谈") recommendation = "进入人工复核";
  return { total, confidence, recommendation, dimensions, styles, brandHits: brandMatch.hits, interaction, commercial, risk, audience, postCount: posts.length };
}
