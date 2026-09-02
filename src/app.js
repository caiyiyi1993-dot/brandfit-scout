import { assessInfluencer, parseImport, parsePosts, splitTerms } from "./scoring.js";

const $ = id => document.getElementById(id);
const state = { platform: "youtube", importedPosts: null, result: null, input: null };

function showStep(number) {
  document.querySelectorAll(".form-step").forEach(p => p.classList.toggle("active", p.dataset.panel === String(number)));
  document.querySelectorAll(".step").forEach(s => s.classList.toggle("active", s.dataset.step === String(number)));
  document.querySelector(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll("[data-next]").forEach(btn => btn.addEventListener("click", () => {
  const panel = btn.closest(".form-step");
  const missing = [...panel.querySelectorAll("[required]")].find(el => !el.value.trim());
  if (missing) { missing.focus(); missing.reportValidity(); return; }
  showStep(btn.dataset.next);
}));
document.querySelectorAll("[data-back]").forEach(btn => btn.addEventListener("click", () => showStep(btn.dataset.back)));
document.querySelectorAll(".step").forEach(btn => btn.addEventListener("click", () => {
  if (btn.dataset.step !== "3" || state.result) showStep(btn.dataset.step);
}));

document.querySelectorAll("#toneChips button").forEach(btn => btn.addEventListener("click", () => btn.classList.toggle("selected")));
document.querySelectorAll("#platformTabs button").forEach(btn => btn.addEventListener("click", () => {
  state.platform = btn.dataset.platform;
  document.querySelectorAll("#platformTabs button").forEach(b => b.classList.toggle("active", b === btn));
  $("youtubeFetch").style.display = state.platform === "youtube" ? "block" : "none";
  $("profileUrl").placeholder = state.platform === "instagram" ? "https://www.instagram.com/creator" : state.platform === "tiktok" ? "https://www.tiktok.com/@creator" : "https://www.youtube.com/@creator";
  $("dataStatus").textContent = state.platform === "youtube" ? "支持官方 API" : "导入 / 手动数据";
}));

function setPosts(posts) {
  state.importedPosts = posts;
  $("postsData").value = posts.map(p => `${p.title} | ${p.views || 0} | ${p.likes || 0} | ${p.comments || 0} | ${p.shares || 0}`).join("\n");
  $("postCount").textContent = `${posts.length} 条内容`;
}
$("postsData").addEventListener("input", () => { state.importedPosts = null; $("postCount").textContent = `${parsePosts($("postsData").value).length} 条内容`; });

$("dataFile").addEventListener("change", async event => {
  const file = event.target.files[0]; if (!file) return;
  try { setPosts(parseImport(await file.text(), file.name)); $("dataStatus").textContent = `已导入 ${file.name}`; }
  catch (error) { alert(`导入失败：${error.message}`); }
});

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename }); a.click(); URL.revokeObjectURL(url);
}
$("downloadTemplate").addEventListener("click", () => download("title,views,likes,comments,shares\n示例内容,12000,850,42,16\n", "brandfit-import-template.csv", "text/csv;charset=utf-8"));

async function youtubeGet(endpoint, params, key) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries({ ...params, key }).forEach(([k,v]) => url.searchParams.set(k,v));
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `YouTube API ${response.status}`);
  return body;
}

function parseYoutubeRef(raw) {
  const value = raw.trim();
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const video = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v") || (url.pathname.match(/\/shorts\/([^/?]+)/)?.[1]);
    if (video) return { type: "video", value: video };
    const channel = url.pathname.match(/\/channel\/([^/?]+)/)?.[1]; if (channel) return { type: "channel", value: channel };
    const handle = url.pathname.match(/\/@([^/?]+)/)?.[1]; if (handle) return { type: "handle", value: handle };
  } catch { /* try raw values below */ }
  if (/^UC[\w-]{20,}$/.test(value)) return { type: "channel", value };
  if (value.startsWith("@")) return { type: "handle", value: value.slice(1) };
  throw new Error("请使用 @handle、/channel/ 链接，或任一公开视频链接。");
}

$("fetchYoutubeBtn").addEventListener("click", async () => {
  const key = $("youtubeApiKey").value.trim(), raw = $("profileUrl").value.trim(), message = $("fetchMessage");
  if (!key || !raw) { message.className = "helper error"; message.textContent = "请先填写 YouTube API Key 和账号/视频链接。"; return; }
  message.className = "helper"; message.textContent = "正在读取公开频道与最近 12 条视频…";
  $("fetchYoutubeBtn").disabled = true;
  try {
    const ref = parseYoutubeRef(raw); let channelId;
    if (ref.type === "video") {
      const video = await youtubeGet("videos", { part: "snippet", id: ref.value }, key);
      channelId = video.items?.[0]?.snippet?.channelId;
    } else if (ref.type === "handle") {
      const channel = await youtubeGet("channels", { part: "id", forHandle: ref.value }, key);
      channelId = channel.items?.[0]?.id;
    } else channelId = ref.value;
    if (!channelId) throw new Error("未找到频道；请检查链接或账号是否公开。");
    const channelData = await youtubeGet("channels", { part: "snippet,statistics,contentDetails", id: channelId }, key);
    const channel = channelData.items?.[0]; if (!channel) throw new Error("频道不可访问或不存在。");
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    const list = await youtubeGet("playlistItems", { part: "snippet,contentDetails", playlistId: uploads, maxResults: "12" }, key);
    const ids = list.items.map(i => i.contentDetails.videoId).join(",");
    const videos = ids ? await youtubeGet("videos", { part: "snippet,statistics", id: ids }, key) : { items: [] };
    $("creatorName").value = channel.snippet.title || "";
    $("creatorBio").value = channel.snippet.description || "";
    $("creatorRegion").value = channel.snippet.country || "";
    $("followers").value = channel.statistics.hiddenSubscriberCount ? "" : channel.statistics.subscriberCount || "";
    setPosts(videos.items.map(v => ({ title: v.snippet.title, views: Number(v.statistics.viewCount || 0), likes: Number(v.statistics.likeCount || 0), comments: Number(v.statistics.commentCount || 0), shares: 0 })));
    state.youtubeApiLoaded = true;
    $("dataStatus").textContent = "YouTube 官方 API";
    message.className = "helper success"; message.textContent = `已读取 ${videos.items.length} 条公开视频。分享数不是 YouTube 公开字段，因此按缺失处理。`;
  } catch (error) { message.className = "helper error"; message.textContent = `读取失败：${error.message}。你仍可手动粘贴数据继续评估。`; }
  finally { $("fetchYoutubeBtn").disabled = false; }
});

function collectInput() {
  return {
    brand: { name: $("brandName").value.trim(), description: $("brandDescription").value.trim(), markets: splitTerms($("markets").value), values: splitTerms($("brandValues").value), tones: [...document.querySelectorAll("#toneChips .selected")].map(b=>b.dataset.value), avoidTopics: splitTerms($("avoidTopics").value) },
    creator: { platform: state.platform, url: $("profileUrl").value.trim(), name: $("creatorName").value.trim(), region: $("creatorRegion").value.trim(), bio: $("creatorBio").value.trim(), followers: Number($("followers").value || 0), posts: state.importedPosts || parsePosts($("postsData").value), source: state.youtubeApiLoaded && state.platform === "youtube" ? "youtube-api" : "manual" }
  };
}

function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function renderReport(input, result) {
  const metrics = Object.entries(result.dimensions).map(([name,d]) => `<article class="metric"><div class="metric-top"><span>${esc(name)}</span><strong>${Math.round(d.score)}</strong></div><div class="bar"><i style="width:${d.score}%"></i></div><p>${esc(d.note)}</p></article>`).join("");
  const risks = result.risk.hits.length ? result.risk.hits.map(x=>`<span class="tag risk">${esc(x)}</span>`).join("") : '<span class="tag">公开文本未命中风险词</span>';
  const styles = result.styles.slice(0,4).map(([name,count])=>`<span class="tag">${esc(name)}${count ? ` · ${count}` : ""}</span>`).join("");
  const evidence = input.creator.posts.slice(0,12).map(p=>`<tr><td>${esc(p.title)}</td><td>${p.views.toLocaleString()}</td><td>${p.likes.toLocaleString()}</td><td>${p.comments.toLocaleString()}</td></tr>`).join("");
  $("reportPanel").innerHTML = `
    <div class="section-heading"><div><p class="eyebrow">ASSESSMENT</p><h2>${esc(input.creator.name || "待命名创作者")}</h2></div><span class="status">${esc(input.creator.platform.toUpperCase())}</span></div>
    <div class="score-hero"><div class="score-ring" style="--score:${result.total}"><div class="score-number">${result.total}<small>/ 100</small></div></div><div class="score-copy"><span class="decision">${esc(result.recommendation)}</span><h2>与「${esc(input.brand.name)}」的匹配评估</h2><p>${result.total >= 68 ? "整体信号具有合作潜力，但仍需完成评论抽检、受众后台核验和品牌安全人工复核。" : "当前信号不足以支持直接合作，建议补充数据或先做低成本测试。"}</p><p class="confidence">证据置信度 ${result.confidence}/100 · 基于 ${result.postCount} 条近期内容 · ${input.creator.source === "youtube-api" ? "官方公开 API" : "用户提供的公开数据"}</p></div></div>
    <div class="metrics">${metrics}</div>
    <div class="report-grid">
      <article class="report-card"><h3>内容风格</h3><div class="tag-list">${styles}</div></article>
      <article class="report-card"><h3>地区 / 受众线索</h3><ul>${result.audience.notes.map(n=>`<li>${esc(n)}</li>`).join("")}</ul></article>
      <article class="report-card"><h3>商业化密度</h3><ul>${result.commercial.notes.map(n=>`<li>${esc(n)}</li>`).join("")}</ul></article>
      <article class="report-card"><h3>风险初筛</h3><div class="tag-list">${risks}</div><ul style="margin-top:12px">${result.risk.notes.map(n=>`<li>${esc(n)}</li>`).join("")}</ul></article>
      <article class="report-card full"><h3>互动质量判断</h3><ul>${result.interaction.notes.map(n=>`<li>${esc(n)}</li>`).join("")}</ul></article>
      ${evidence ? `<article class="report-card full"><h3>纳入计算的内容证据</h3><div style="overflow:auto"><table class="evidence-table"><thead><tr><th>内容</th><th>播放/浏览</th><th>点赞</th><th>评论</th></tr></thead><tbody>${evidence}</tbody></table></div></article>` : ""}
      <article class="report-card full"><h3>合作前下一步</h3><ul><li>抽看至少 20 条高赞与最新评论，排除机器人、互赞和不相关互动。</li><li>向创作者索取最近 30–90 天的平台后台受众地区、年龄及性别截图。</li><li>人工查看最近 30 条内容的画面、口播、置顶评论与历史争议；本工具的文本风险初筛不能替代审核。</li><li>${result.recommendation === "谨慎测试" ? "建议先以赠品或低预算内容测试，再按有效观看/转化决定是否扩大。" : "用小范围创意 Brief 校验创作者表达是否能自然承载品牌卖点。"}</li></ul></article>
    </div>`;
}

$("assessmentForm").addEventListener("submit", event => {
  event.preventDefault(); const input = collectInput();
  state.input = input; state.result = assessInfluencer(input); renderReport(input, state.result); showStep(3);
});

$("demoBtn").addEventListener("click", () => {
  $("brandName").value="Luma Outdoor"; $("markets").value="美国, 英国"; $("brandDescription").value="面向城市女性的中高端可持续户外装备，强调真实体验、耐用和轻量设计。"; $("brandValues").value="outdoor, sustainable, honest, women, 户外"; $("avoidTopics").value="gambling, tobacco, dangerous challenge";
  document.querySelectorAll("#toneChips button").forEach(b=>b.classList.toggle("selected",["真实","生活化","冒险"].includes(b.dataset.value)));
  state.platform="youtube"; $("profileUrl").value="https://www.youtube.com/@TrailMia"; $("creatorName").value="Trail Mia"; $("creatorRegion").value="California, USA"; $("creatorBio").value="Honest sustainable outdoor gear reviews and hiking guides for women."; $("followers").value="128000";
  setPosts(parsePosts("48 Hours Hiking Alone | 82000 | 6300 | 284 | 190\nMy honest sustainable gear setup | 54000 | 4100 | 198 | 88\nBeginner hiking guide | 61000 | 4900 | 232 | 120\nWinter layering mistakes #partner | 47000 | 3200 | 156 | 61\nA day on the Pacific Crest Trail | 93000 | 7100 | 344 | 214\nThe truth about ultralight backpacks | 58000 | 4600 | 260 | 105\nSolo camping routine | 77000 | 5900 | 301 | 166\nTrail safety tips | 66000 | 5100 | 278 | 143"));
  $("dataStatus").textContent="示例数据"; showStep(1);
});

$("exportBtn").addEventListener("click", () => {
  if (!state.result) { alert("请先生成评估报告。"); return; }
  download(JSON.stringify({ generatedAt: new Date().toISOString(), input: state.input, assessment: state.result, disclaimer: "用于合作前初筛，不是受众审计、合规结论或合作保证。" }, null, 2), `brandfit-${state.input.creator.name || "creator"}.json`, "application/json");
});
