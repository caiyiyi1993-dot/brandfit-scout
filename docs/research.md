# 免费数据源与开源方案调研

更新时间：2026-09-02

## 结论

目前不存在一个同时满足“免费、官方、无需创作者授权、可稳定读取 Instagram/TikTok/YouTube 任意账号完整公开数据”的统一接口。可持续的免费 MVP 应采用分层策略：

1. YouTube 使用官方 Data API 自动读取。
2. Instagram/TikTok 默认接受用户依据公开页面整理的 CSV/JSON，或由创作者提供后台导出。
3. 官方 OAuth 作为后续增强，只读取已授权创作者。
4. 非官方抓取器做成可替换、默认关闭的适配器，并在启用前审查平台条款与当地法律。

## 平台能力与限制

### YouTube

官方 YouTube Data API v3 对公开只读数据最友好：`channels.list` 可返回频道简介、国家、订阅数、总观看量和公开视频数量；订阅数可能隐藏，公开值也会做三位有效数字处理。`videos.list` 可获取标题、描述、标签、观看、点赞和评论，单次调用成本 1 配额单位。

Google 默认给启用 API 的项目每天 10,000 配额单位。应避免为“最近上传”使用成本 100 的 `search.list`，而是取频道 uploads playlist 后用 `playlistItems.list`；本 MVP 正是这个路径，一次频道评估通常为 3 个低成本 list 调用。

官方资料：

- [YouTube Data API 概览](https://developers.google.com/youtube/v3/getting-started)
- [Channel resource 字段](https://developers.google.com/youtube/v3/docs/channels)
- [Videos.list 与 1 单位成本](https://developers.google.com/youtube/v3/docs/videos/list)
- [Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)

缺口：公开视频 API 不提供受众年龄/性别/国家分布，也没有公开分享数。这些需要频道主通过 YouTube Analytics 授权或提供截图。

### Instagram

Meta 的 Instagram API 主要面向专业账号（Business / Creator）及其被授权管理的数据。Facebook Login 路径不能访问普通 Consumer 账号；读取其他专业账号的基础信息和指标也受权限、账号关系及应用审核约束。因此不能依赖官方 API 免费读取任意候选人的完整内容和受众画像。

参考：[Meta 官方 Instagram API Postman 文档](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)

降级策略：

- MVP：用户录入公开 Bio、粉丝量及近期贴文的公开互动数，或导入 CSV/JSON。
- 合作推进后：邀请创作者授权专业账号，或提供 30–90 天 Insights 截图/导出。
- 不把地区文本线索写成“受众地区”；报告始终标明它只是线索。

### TikTok

TikTok Display API 可返回用户基本资料和近期/指定公开视频，但需要 TikTok Login 与 `user.info.basic`、`video.list` 等权限，也就是创作者授权。Research API 能访问更广的公开账号、内容和评论，但只对特定地区、机构和研究目的的合格研究者开放，不适合作为一般品牌营销 SaaS 的数据底座。

官方资料：

- [TikTok Display API Overview](https://developers.tiktok.com/docs/en/display-api-overview)
- [TikTok Research API](https://developers.tiktok.com/products/research-api/)

降级策略：与 Instagram 相同，默认导入公开信号；合作进入候选名单后再走创作者授权或后台截图。

## 开源 / 免费方案盘点

| 方案 | 作用 | 可借鉴点 | 不直接作为默认依赖的原因 |
|---|---|---|---|
| [InfluenceX](https://github.com/oratis/influencex) | 自托管 KOL 工作流、发现、触达、ROI | 活动与漏斗管理框架完整 | Instagram/TikTok 依赖第三方采集服务，部署栈较重，重点不是品牌调性评分 |
| [Instaloader](https://github.com/instaloader/instaloader) | Instagram 公开内容下载/元数据访问 | 成熟 Python 数据结构与导出能力 | 非官方路径，页面/登录限制变化会导致失效；需要单独做合规评估 |
| [TikTok-Api](https://github.com/davidteather/TikTok-Api) | 非官方 TikTok Python 封装 | 能访问登录墙外的部分公开数据 | 项目自身提醒 TikTok 结构会变化；常需要浏览器自动化、cookie 或代理，稳定性不足 |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | 多站点媒体与元数据提取 | 适合经许可的本地研究与证据归档 | 不是营销分析 API；支持会随站点变化，且下载行为需要额外审查权限与条款 |
| [Social Blade](https://socialblade.com/) | 多平台公开趋势查看 | 可用于人工交叉验证规模与趋势 | 免费页面能力和可用性会变化，没有提供本 MVP 可依赖的免费统一 API |

## 为什么不承诺“假粉识别”

仅凭公开点赞、评论、播放数无法可靠证明假粉。可做的是异常提示：互动率极低、评论/点赞比过低、播放量波动异常、重复或无关评论占比高。但最后两项需要抽取评论文本并人工或模型复核。MVP 因此使用“互动质量”与“需要抽检”，不输出未经支持的“真粉率”。

## 推荐的后续增强顺序

1. 增加候选人批量导入、对比与短名单。
2. 增加品牌可编辑词表、阈值和权重模板。
3. 接入 YouTube 评论抽样，并对重复、无关和模板化评论做质量提示。
4. 增加 Creator Data Pack：让候选人上传官方后台受众截图/CSV，报告中区分“公开信号”和“创作者授权证据”。
5. 在有真实需求后再接 Instagram/TikTok OAuth；不要先把时间花在持续对抗页面变化的抓取器上。
