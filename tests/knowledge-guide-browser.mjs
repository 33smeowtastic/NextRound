import { createHash } from "node:crypto";
import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {GUIDE_COMMANDS,GUIDE_TITLE} from "../knowledge-guide.js";
import {UNIFIED_MODULES} from "../unified-import.js";
const b=await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:["--disable-gpu","--mute-audio"]});
const out = await testOutput(import.meta.url);await mkdir(out,{recursive:true});
const report={date:new Date().toISOString(),checks:[],errors:[]};
let testTheme="dark";
const check=(v,label)=>{assert.ok(v,label);report.checks.push(`[${testTheme}] ${label}`)};
const protocol=await readFile(new URL("../assets/通用AI面试训练协议_公开版_V1.0.md",import.meta.url));
assert.equal(createHash("sha256").update(protocol).digest("hex"),"2ba57798d8c233192a438afc099d4f95503918d0d4f1762360a21f51b938fff0","Protocol source bytes remain unchanged");
const template=await readFile(new URL("../assets/NextRound_AI整理与一键导入通用模板_V1.5.md",import.meta.url));
const payload=JSON.parse(template.toString("utf8").match(/```json\s*\n([\s\S]*?)\n```/)[1]);
for(const module of UNIFIED_MODULES)if(module!=="questions")payload[module]=[];
payload.questions=[payload.questions.find(q=>!q.related_job_ids?.length)];
try {
 for(const [width,height,theme]of [[507,844,"dark"],[390,844,"dark"],[1440,900,"dark"],[507,844,"light"],[390,844,"light"],[1440,900,"light"]]){
  testTheme=theme;
  const c=await b.newContext({viewport:{width,height},reducedMotion:"reduce",serviceWorkers:"block",storageState:{cookies:[],origins:[]}});
  await c.addInitScript(mode=>{if(location.protocol==="http:"||location.protocol==="https:")localStorage.setItem("nextround-theme",mode);window.__copied="";Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__copied=text}}})},theme);
  const p=await c.newPage();p.on("pageerror",e=>report.errors.push(e.message));
  await p.goto(new URL("core.js", baseUrl).href);assert.equal(await p.evaluate(async()=>(await indexedDB.databases()).length),0);
  await p.goto(new URL("#/", baseUrl).href);await p.locator("html:not([data-starting])").waitFor();await p.locator('.entry-cta[href="#/dashboard"]').click();await p.locator('.sidebar>.nav a[href="#/knowledge"]').click();
  const guide=p.locator("[data-knowledge-guide]"),steps=guide.locator(".knowledge-guide-step");
  check(await guide.evaluate(e=>e.open)&&await steps.count()===4&&await guide.locator(".knowledge-guide-step[open]").count()===0,`Empty question bank opens the four-step guide with every step collapsed at ${width}px`);
  assert.equal(await guide.locator("h2").textContent(),GUIDE_TITLE);const text=await p.locator(".knowledge-onboarding").textContent();
  for (const supplied of [
    "不知道该准备哪些面试问题？您可以先让 AI 帮您进行首轮训练，再把训练成果带回 NextRound，反复练习，直到熟练掌握。",
    "下载《通用 AI 面试训练协议》，打开您的 AI，点击聊天框旁的「+」上传文件。",
    "然后发送：", GUIDE_COMMANDS.start,
    "AI 会询问您的目标岗位，逐题进行模拟面试，并帮您发现需要改进的地方。",
    "完成首轮训练后，下载《AI 整理模板》，上传到刚才的 AI 对话中。", "告诉 AI：", GUIDE_COMMANDS.organize,
    "按照模板要求，让 AI 输出可以导入的 JSON 文件，并保存到设备中。",
    "回到「知识库」，点击「导入」，选择刚才 AI 生成的 JSON 文件。", "导入完成后，您就拥有了一份属于自己的面试题库。",
    "现在可以进入「训练室」了。", "NextRound 会从您的知识库中抽取问题，帮助您反复练习回答、提高表达熟练度。",
    "小提示：.md 是一种文本文件，无须安装特殊软件，直接上传给 AI 即可。如果已经准备好了自己的面试题目，也可以点击「新增问题」，手动建立知识库。",
  ]) assert.ok(text.includes(supplied), `Preserved supplied guide copy: ${supplied}`);
  check(!text.includes("你")&&text.includes("AI 会询问您的目标岗位，逐题进行模拟面试，并帮您发现需要改进的地方。")&&text.includes("小提示：.md 是一种文本文件，无须安装特殊软件，直接上传给 AI 即可。"),`User-supplied guide uses 您 and retains its full training instructions and file explanation at ${width}px`);
  check(await guide.locator(".knowledge-guide-step>summary p").count()===0,`Collapsed steps contain only their title at ${width}px`);
  await guide.locator(":scope>summary").click();
  check(await p.locator(".knowledge-onboarding>.knowledge-guide-tip").isVisible()&&!await guide.locator(".knowledge-guide-intro").isVisible(),`The independent file-format hint stays visible when the whole guide is collapsed at ${width}px`);
  await guide.locator(":scope>summary").click();
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:artifactPath(`guide-default-${theme}-${width}.png`, out),fullPage:true});
  await steps.nth(0).locator("summary").click();
  const copy=steps.nth(0).locator('[data-action=guide-copy]');
  check(await copy.locator("svg.led-icon circle").count()>5&&!(await copy.textContent()).trim()&&await copy.getAttribute("aria-label"),`Copy uses an accessible LED icon instead of a text button at ${width}px`);
  const commandBounds=await steps.nth(0).locator('.guide-command').boundingBox(),copyBounds=await copy.boundingBox();check(copyBounds.x>=commandBounds.x+commandBounds.width,`Copy icon sits to the right of its full instruction at ${width}px`);
  await copy.click();assert.equal(await p.evaluate(()=>window.__copied),GUIDE_COMMANDS.start);
  const [download]=await Promise.all([p.waitForEvent("download"),steps.nth(0).locator("a[download]").click()]);assert.equal(download.suggestedFilename(),"通用AI面试训练协议_公开版_V1.0.md");assert.deepEqual(await readFile(await download.path()),protocol);
  check(true,`The first instruction copies literally and protocol download matches the supplied bytes at ${width}px`);
  await steps.nth(1).locator("summary").click();await steps.nth(1).locator('[data-action=guide-copy]').click();assert.equal(await p.evaluate(()=>window.__copied),GUIDE_COMMANDS.organize);
  const [templateDownload]=await Promise.all([p.waitForEvent("download"),steps.nth(1).locator("a[download]").click()]);assert.equal(templateDownload.suggestedFilename(),"NextRound_AI整理与一键导入通用模板_V1.5.md");assert.deepEqual(await readFile(await templateDownload.path()),template);
  check(true,`The second full instruction copies literally and template download preserves its original bytes at ${width}px`);
  for(const [index,purpose]of [[0,"用于开始 AI 首轮训练"],[1,"用于将训练成果整理成题库"]]){
    const trigger=steps.nth(index).locator("[data-help-trigger]");
    await steps.nth(index).locator('.knowledge-guide-actions').evaluate(n=>n.scrollIntoView({block:"center",behavior:"instant"}));
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await trigger.click();const tooltip=p.getByRole("tooltip").filter({hasText:purpose});await tooltip.waitFor({state:"visible"});assert.ok((await tooltip.textContent()).includes("设置 → 使用 AI 协作"));await p.keyboard.press("Escape");
    await steps.nth(index).locator('a[download]').focus();await p.keyboard.press("Tab");await tooltip.waitFor({state:"visible"});await p.keyboard.press("Escape");
    await p.mouse.move(0,0);await trigger.hover();await tooltip.waitFor({state:"visible"});await p.keyboard.press("Escape");
    const row=steps.nth(index).locator('.knowledge-guide-actions'),link=row.locator('a[download]');const linkBox=await link.boundingBox(),helpBox=await trigger.boundingBox();check(Math.abs((linkBox.y+linkBox.height/2)-(helpBox.y+helpBox.height/2))<1,`Download information stays beside .md and works by click, keyboard and hover at ${width}px`);
  }
  check(await guide.locator('.knowledge-guide-location').count()===0,`Download descriptions no longer consume rows beneath the buttons at ${width}px`);
  await steps.nth(0).screenshot({path:artifactPath(`guide-step-refined-${theme}-${width}.png`, out)});
  await p.locator('.side-utilities a[href="#/settings"]').click();const settingHeight=await p.locator('.settings-panel[data-section=backup]>summary').evaluate(n=>n.getBoundingClientRect().height);
  await p.locator('.settings-panel[data-section=ai]>summary').click();check(!(await p.locator('.ai-collaboration-panel').textContent()).includes('位置：'),`AI collaboration omits redundant location rows at ${width}px`);
  await p.locator('.sidebar>.nav a[href="#/train"]').click();await p.locator(".training-layout").waitFor();
  const trainingHeight=await p.locator('.train-config>summary').evaluate(n=>n.getBoundingClientRect().height);check(Math.abs(trainingHeight-settingHeight)<=1,`Training and settings summary heights agree within 1px at ${width}px`);
  await p.locator('.train-config').screenshot({path:artifactPath(`training-fold-refined-${theme}-${width}.png`, out)});
  check(await p.locator('.training-config-help .inline-help').count()===1&&await p.locator('.train-config>summary .inline-help').count()===0&&await p.locator('.training-side>.training-library-hint').count()===1,`Training help stays beside its title outside the summary and the library hint sits below side configuration at ${width}px`);
  await p.locator('[data-action=train-mode][data-mode=self]').click();await p.locator('[data-action=timer-toggle]').click();await p.waitForFunction(()=>document.querySelector('[data-action="timer-toggle"]')?.textContent.includes("暂停训练"));await p.locator('[data-action=timer-toggle]').click();await p.locator('[data-action=timer-reset]').click();check(true,`The guidance does not block free introduction training in an empty profile at ${width}px`);
  await p.locator('.sidebar>.nav a[href="#/knowledge"]').click();await steps.nth(2).locator("summary").click();
  const [chooser]=await Promise.all([p.waitForEvent("filechooser"),steps.nth(2).locator('[data-action=import-unified]').click()]);await chooser.setFiles({name:"guide-questions.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(payload))});await p.locator('[data-action=confirm-unified-import]').click();
  await p.waitForFunction(()=>document.querySelector('[data-knowledge-guide]')&&!document.querySelector('[data-knowledge-guide]').open&&document.querySelectorAll('[data-kind="questions"].row-title').length>0);
  check(true,`Normal JSON preview/confirmation imports a question and automatically collapses the guide at ${width}px`);
  await p.locator('#knowledge-search').fill("无匹配搜索notfound");check(!(await guide.evaluate(e=>e.open))&&await p.getByText("没有找到匹配内容",{exact:true}).count()===1,`Search with zero matches never mistakes a populated bank for an empty bank at ${width}px`);
  await guide.locator(":scope>summary").click();check(await guide.evaluate(e=>e.open),`The collapsed guide remains available on demand after questions exist at ${width}px`);
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Guide and downloads fit ${width}px without horizontal overflow`);
  await c.close();
 }
 assert.deepEqual(report.errors,[]);report.result="PASS";
}catch(e){report.result="FAIL";report.failure=e.stack;throw e;}finally{await writeFile(new URL("VERIFICATION.json",out),JSON.stringify(report,null,2));await b.close();console.log(JSON.stringify(report,null,2))}
