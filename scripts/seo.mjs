import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SEO_PUBLIC_FILES = ["about/index.html", "en/index.html", "seo.css", "robots.txt", "sitemap.xml", "examples/interview-prep.json", "examples/interview-prep.md"];
const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const verificationNames = Object.freeze({ google: "google-site-verification", bing: "msvalidate.01", baidu: "baidu-site-verification" });
/** These are public ownership tokens, never API credentials or session data. */
export function verificationMetadata(verification) {
  if (verification === undefined) return "";
  if (!verification || typeof verification !== "object" || Array.isArray(verification) || ![Object.prototype, null].includes(Object.getPrototypeOf(verification))) throw new Error("SEO verification must be a public-token object");
  for (const key of Object.keys(verification)) {
    if (!Object.hasOwn(verificationNames, key)) throw new Error("Unsupported SEO verification provider");
    if (typeof verification[key] !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(verification[key])) throw new Error("Invalid public SEO verification token");
  }
  return Object.entries(verificationNames)
    .filter(([provider]) => Object.hasOwn(verification, provider))
    .map(([provider, name]) => `<meta name="${name}" content="${escape(verification[provider])}">`)
    .join("");
}
export function productionUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("SEO site URL must be a public HTTPS directory without credentials, query or fragment");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
const copy = {
  zh: {
    lang: "zh-CN", locale: "zh_CN", title: "下一场 NextRound｜本地面试训练与备考工作区",
    description: "将外部 AI 面试对话沉淀为可校验、可追溯、可复练的本地准备资产。支持岗位、题库、训练录音、面试复盘与完整备份。",
    action: "打开 NextRound", eyebrow: "下一场 · NextRound", heading: "让面试准备留下可以反复练习的资产。",
    intro: "NextRound 是本地优先、离线可用的个人面试训练与备考工作区，适用于企业求职、公务员及事业单位招录。界面主要使用中文，开源 README 提供中英文说明。",
    featuresTitle: "当前可以做什么", features: ["整理岗位和招录单位、题目、答案、自我介绍及内容卡片。", "按天堂、人间、地狱难度抽题，计时练习、本地录音，并保存手动自评与复盘。", "关联面试现场问题与准备资料，追溯反馈并按透明规则比较岗位。", "预览统一 JSON 后再导入，保留重复/冲突边界；完整备份包含录音与附件。"],
    workflowTitle: "AI 与应用如何配合", workflow: ["下载训练协议，在您选择的外部 AI 工具中完成首轮训练。", "让 AI 使用整理模板输出结构化 JSON；核对内容，并移除不希望提供的个人信息。", "回到 NextRound 预览导入，再进行本地复练、编辑和记录。"],
    privacyTitle: "数据留在哪里", privacy: "业务记录保存在当前浏览器来源的 IndexedDB。应用没有账号、云同步、内置模型调用、统计埋点或自动上传业务记录。向外部 AI 提供材料是用户主动操作，适用该服务的规则。", risk: "清除浏览器站点数据、使用隐私窗口或更换设备可能让您无法继续访问原记录。完整 JSON 备份未加密，请妥善保管并定期导出。",
    exampleTitle: "先用虚构示例试一遍", example: "示例包含三道完全虚构题，覆盖天堂、人间、地狱，不需要提供真实简历。下载后在应用的 JSON 导入入口预览确认，再进入训练室。", download: "下载虚构 JSON 示例", guide: "阅读示例说明", protocol: "下载 AI 训练协议", template: "下载 AI 整理模板",
    limitsTitle: "当前边界", limits: "当前没有独立的熟练度算法或间隔重复系统；自评由用户填写。Ritual 入口仍在建设中。真实手机传感器、真实麦克风与操作系统安装仍需对应环境验证。", license: "代码采用 MIT；插画、BGM 和品牌素材按独立条款随本项目分发。", licensing: "查看素材条款", version: "应用版本"
  },
  en: {
    lang: "en", locale: "en_US", title: "NextRound | Local interview practice and preparation workspace",
    description: "Turn external AI interview conversations into local preparation assets you can validate, trace and rehearse. Organize roles, questions, recordings, reviews and full backups.",
    action: "Open NextRound", eyebrow: "NextRound", heading: "Keep interview preparation ready for the next rehearsal.",
    intro: "NextRound is a local-first, offline-capable workspace for personal interview preparation, including company applications and public-sector recruitment. The app interface is primarily Chinese; the open-source README provides complete Chinese and English instructions.",
    featuresTitle: "What is available", features: ["Organize roles, organizations, questions, answers, introductions and reusable content cards.", "Practice questions at Heaven, Human and Hell difficulty, use timers and local recordings, and save manual self-ratings and reviews.", "Connect actual interview questions with preparation records, trace feedback and compare opportunities using transparent rules.", "Preview unified JSON before import and preserve duplicate/conflict boundaries. Full backups include recordings and attachments."],
    workflowTitle: "How AI and the app work together", workflow: ["Download the training protocol and practice in an external AI tool of your choice.", "Ask that tool to produce structured JSON with the organization template. Review the content and remove information you do not want to share.", "Preview and confirm the import in NextRound, then rehearse, edit and review locally."],
    privacyTitle: "Where your data stays", privacy: "Business records are stored in IndexedDB for the current browser origin. The app has no account, cloud sync, built-in model API, analytics or automatic upload of business records. Sharing materials with an external AI is your own action and is subject to that service's rules.", risk: "Clearing site data, using private browsing or changing devices can remove access to your records. Full JSON backups are not encrypted: keep them secure and export them regularly.",
    exampleTitle: "Try a fictional example first", example: "The example contains three entirely fictional questions at Heaven, Human and Hell difficulty. No real resume is required. Download it, preview and confirm it in the app's JSON import flow, then open the training room.", download: "Download fictional JSON", guide: "Read the example guide", protocol: "Download the AI training protocol", template: "Download the AI organization template",
    limitsTitle: "Current boundaries", limits: "There is no independent mastery algorithm or spaced repetition system; self-ratings are entered manually. Ritual is still under construction. Real phone sensors, real microphones and OS installation require checks in their target environments.", license: "Code is MIT-licensed. Illustrations, BGM and branding use separate project-scoped asset terms.", licensing: "Read the asset terms", version: "Application version"
  }
};
function metadata(site, route, language, version) {
  const c = copy[language], canonical = new URL(route, site).href;
  const alternatives = route ? `<link rel="alternate" hreflang="zh-CN" href="${new URL("about/", site).href}"><link rel="alternate" hreflang="en" href="${new URL("en/", site).href}"><link rel="alternate" hreflang="x-default" href="${new URL("about/", site).href}">` : "";
  const schema = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "NextRound", url: site.href, applicationCategory: "BusinessApplication", operatingSystem: "Web browser", softwareVersion: version, description: c.description, inLanguage: "zh-CN", isAccessibleForFree: true };
  return `<link rel="canonical" href="${escape(canonical)}">${alternatives}<meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="website"><meta property="og:site_name" content="NextRound"><meta property="og:locale" content="${c.locale}"><meta property="og:title" content="${escape(c.title)}"><meta property="og:description" content="${escape(c.description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${new URL("assets/icon-512.png", site).href}"><meta name="twitter:card" content="summary"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`;
}
function introPage(site, language, version) {
  const c = copy[language], route = language === "zh" ? "about/" : "en/";
  return `<!doctype html><html lang="${c.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(c.title)}</title><meta name="description" content="${escape(c.description)}"><link rel="icon" href="../assets/icon.svg"><link rel="stylesheet" href="../seo.css">${metadata(site, route, language, version)}</head><body><header><a class="brand" href="../">NextRound</a><nav aria-label="Language"><a href="../about/" lang="zh-CN" hreflang="zh-CN">中文</a><a href="../en/" lang="en" hreflang="en">English</a></nav></header><main><h1>${c.heading}</h1><p class="lead">${c.intro}</p><p><a class="open" href="../">${c.action}<span aria-hidden="true"> →</span></a></p><section><h2>${c.featuresTitle}</h2><ul>${c.features.map(text => `<li>${text}</li>`).join("")}</ul></section><section><h2>${c.workflowTitle}</h2><ol>${c.workflow.map(text => `<li>${text}</li>`).join("")}</ol><p><a href="../assets/通用AI面试训练协议_公开版_V1.0.md" download>${c.protocol}</a> · <a href="../assets/NextRound_AI整理与一键导入通用模板_V1.4_面试题三级难度.md" download>${c.template}</a></p></section><section><h2>${c.exampleTitle}</h2><p>${c.example}</p><p><a href="../examples/interview-prep.json" download>${c.download}</a> · <a href="../examples/interview-prep.md">${c.guide}</a></p></section><section><h2>${c.privacyTitle}</h2><p>${c.privacy}</p><p>${c.risk}</p></section><section><h2>${c.limitsTitle}</h2><p>${c.limits}</p><p>${c.license} <a href="../ASSET-LICENSE.md">${c.licensing}</a></p></section><p class="version">${c.version} ${escape(version)}</p></main><footer><a href="https://www.brothforge.com/faq/copyright">© 2026 Brothforge</a> · <a href="../LICENSE">MIT</a></footer></body></html>\n`;
}
export async function seoArtifacts(directory) {
  const config = JSON.parse(await readFile(path.join(directory, "seo.config.json"), "utf8"));
  const site = productionUrl(process.env.NEXTROUND_SITE_URL || config.siteUrl);
  if (config.searchAccess !== "allow" || !["disallow", "allow"].includes(config.trainingAccess)) throw new Error("Unsupported crawler policy");
  const verification = verificationMetadata(config.verification);
  const { version } = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  const files = new Map();
  files.set("seo.config.json", Buffer.from(JSON.stringify({ ...config, siteUrl: site.href }, null, 2) + "\n"));
  let index = await readFile(path.join(directory, "index.html"), "utf8");
  index = index.replace(/\s*<!-- nextround:seo:start -->[\s\S]*?<!-- nextround:seo:end -->\s*/g, "\n");
  index = index.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escape(copy.zh.description)}">`);
  index = index.replace("</head>", `    <!-- nextround:seo:start -->\n    ${metadata(site, "", "zh", version)}${verification}\n    <!-- nextround:seo:end -->\n  </head>`);
  files.set("index.html", Buffer.from(index));
  files.set("about/index.html", Buffer.from(introPage(site, "zh", version)));
  files.set("en/index.html", Buffer.from(introPage(site, "en", version)));
  const denied = config.trainingAccess === "disallow" ? ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"].map(bot => `User-agent: ${bot}\nDisallow: /\n`).join("\n") : "";
  files.set("robots.txt", Buffer.from(`# Search and AI retrieval allowed; training preferences are separate.\n${denied}\nUser-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", site).href}\n`));
  const alternatives = `<xhtml:link rel="alternate" hreflang="zh-CN" href="${new URL("about/", site).href}"/><xhtml:link rel="alternate" hreflang="en" href="${new URL("en/", site).href}"/><xhtml:link rel="alternate" hreflang="x-default" href="${new URL("about/", site).href}"/>`;
  files.set("sitemap.xml", Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${["", "about/", "en/"].map(route => `<url><loc>${new URL(route, site).href}</loc>${route ? alternatives : ""}</url>`).join("")}</urlset>\n`));
  return files;
}
export async function syncSeo(directory) {
  const files = await seoArtifacts(directory);
  for (const [relative, bytes] of files) { const destination = path.join(directory, relative); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, bytes); }
  return files;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = await syncSeo(root);
  console.log(JSON.stringify({ generated: [...files.keys()], siteUrl: productionUrl(process.env.NEXTROUND_SITE_URL || JSON.parse(await readFile(path.join(root, "seo.config.json"), "utf8")).siteUrl).href }));
}
