import assert from "node:assert/strict";
import { assessInfluencer, parseImport, parseNumber, parsePosts } from "../src/scoring.js";

assert.equal(parseNumber("12.5k"), 12500);
assert.equal(parseNumber("3.2万"), 32000);
assert.equal(parsePosts("A | 1,000 | 50 | 4 | 2")[0].views, 1000);
assert.equal(parseImport('title,views,likes,comments,shares\n"Gear, honestly",1000,80,10,5', "x.csv")[0].title, "Gear, honestly");

const strong = assessInfluencer({
  brand: { values: ["outdoor", "sustainable"], tones: ["真实", "冒险"], avoidTopics: ["gambling"], markets: ["美国"] },
  creator: { platform: "youtube", source: "youtube-api", name: "Trail Mia", region: "California USA", bio: "Honest sustainable outdoor gear reviews", followers: 100000, posts: [
    { title: "Honest outdoor gear review", views: 80000, likes: 5200, comments: 360, shares: 110 },
    { title: "Sustainable hiking guide", views: 72000, likes: 4700, comments: 310, shares: 95 },
    { title: "Camping tips #partner", views: 76000, likes: 4900, comments: 330, shares: 100 }
  ]}
});
assert.ok(strong.total >= 75, `expected strong fit, got ${strong.total}`);
assert.ok(strong.confidence >= 60);
assert.equal(strong.risk.hits.length, 0);

const risky = assessInfluencer({
  brand: { values: ["wellness"], tones: ["专业"], avoidTopics: ["crypto"], markets: ["英国"] },
  creator: { platform: "tiktok", source: "manual", name: "X", region: "", bio: "casino betting crypto promo code", followers: 90000, posts: [{ title: "Use my code #ad", views: 1000, likes: 2, comments: 0, shares: 0 }] }
});
assert.ok(risky.risk.score <= 52);
assert.notEqual(risky.recommendation, "优先洽谈");

console.log("scoring tests passed");
