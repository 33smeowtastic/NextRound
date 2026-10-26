import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, baseUrl, testOutput, artifactPath } from './browser-support.mjs';
const require=createRequire(import.meta.url), axePath=require.resolve('axe-core/axe.min.js');
const out=await testOutput(import.meta.url);
const report={date:new Date().toISOString(),checks:[],axe:[],layouts:[],errors:[],manualReviewRequired:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio']});
const check=(value,label)=>{assert.ok(value,label);report.checks.push(label)};
const ready=page=>page.locator('html:not([data-starting])').waitFor();
const layout=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const route=async(page,name)=>{await page.evaluate(name=>location.hash='/'+name,name);await layout(page);await page.locator('.shell').waitFor()};
const axe=async(page,label)=>{
 if(!await page.evaluate(()=>!!window.axe))await page.addScriptTag({path:axePath});
 const result=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
 const summarize=rule=>({id:rule.id,impact:rule.impact,nodes:rule.nodes.map(node=>({target:node.target,summary:node.failureSummary}))});
 report.axe.push({label,violations:result.violations.map(summarize),incomplete:result.incomplete.map(summarize)});
 if(result.incomplete.length)report.manualReviewRequired.push({label,rules:result.incomplete.map(rule=>rule.id)});
 check(result.violations.length===0,`${label}: no automatic WCAG A/AA violations`);
};
const namedDialog=async(page,id)=>{
 const dialog=page.locator('#'+id);await dialog.waitFor();
 check(await dialog.evaluate(node=>{const title=document.getElementById(node.getAttribute('aria-labelledby'));return node.open&&!!title?.textContent.trim()}),id+': native dialog has its visible accessible title');
 check(await dialog.evaluate(node=>node.contains(document.activeElement)),id+': initial focus is inside the modal');
 return dialog;
};
const noOverflow=async(page,label)=>check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': no document horizontal overflow');
try{
 for(const theme of ['dark','light']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(theme=>{if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('nextround-theme',theme)},theme);
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(new URL('core.js',baseUrl).href);
  check(await page.evaluate(async()=>(await indexedDB.databases()).length)===0,theme+': starts in disposable storage');
  await page.goto(new URL('#/settings',baseUrl).href);await ready(page);
  check(await page.locator('.side-utilities a[href="#/settings"]').getAttribute('aria-current')==='page',theme+': direct settings navigation announces the current page on first render');
  await page.goto(baseUrl);await ready(page);
  check(await page.locator('main.portal').count()===1,theme+': homepage has one main landmark');
  await axe(page,theme+' homepage');
  await page.locator('[data-action=demo]').click();await page.locator('.shell').waitFor();
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});await layout(page);
   for(const name of ['knowledge','train','companies','settings']){
    await route(page,name);await noOverflow(page,`${theme} ${name} ${width}`);
    await axe(page,`${theme} ${name} ${width}`);
   }
  }
  await page.setViewportSize({width:390,height:844});await layout(page);await route(page,'knowledge');
  const scripts=page.locator('[data-tab=scripts]');await scripts.focus();await scripts.press('Enter');
  check(await scripts.getAttribute('aria-pressed')==='true'&&await scripts.evaluate(node=>node===document.activeElement),theme+': keyboard group selection keeps focus and announces pressed state after render');
  const lamp=page.locator('.side-utilities [data-action=toggle-theme]');
  await lamp.focus();await lamp.press('Enter');
  check(await lamp.evaluate(node=>node===document.activeElement),theme+': keyboard theme switching preserves its logical focus target');
  await lamp.click();check(await lamp.evaluate(node=>node===document.activeElement),theme+': pointer theme switching preserves its logical focus target');
  const newScript=page.locator('[data-action=new-script]').first();await newScript.focus();await newScript.press('Enter');
  const editor=await namedDialog(page,'editor-dialog');
  check(await page.locator('#entity-form input[name=title]').evaluate(node=>node===document.activeElement),theme+': entity editor starts on its title field');
  for(let i=0;i<14;i++){await page.keyboard.press('Tab');check(await editor.evaluate(node=>node.contains(document.activeElement)),theme+': native Tab remains inside the modal '+i)}
  const focusStyle=await page.evaluate(()=>{const s=getComputedStyle(document.activeElement);return{style:s.outlineStyle,width:parseFloat(s.outlineWidth),color:s.outlineColor}});
  check(focusStyle.style!=='none'&&focusStyle.width>=2,theme+': keyboard focus uses a visible outline');
  if(theme==='light')check(focusStyle.color==='rgb(117, 87, 41)',theme+': focus uses the dark brown contrasting signal');
  await axe(page,theme+' named entity dialog');
  await page.keyboard.press('Escape');await editor.waitFor({state:'detached'});
  check(await newScript.evaluate(node=>node===document.activeElement),theme+': Escape returns focus to the re-rendered opener');
  await page.locator('[data-tab=questions]').click();await page.locator('[data-action=new-question]').first().click();await namedDialog(page,'editor-dialog');
  await page.locator('#entity-form [name=text]').fill('Synthetic accessibility regression question');
  await page.locator('#entity-form button[type=submit]').click();
  const invalid=page.locator('#entity-form [name=difficulty]');
  check(await invalid.getAttribute('aria-invalid')==='true'&&(await invalid.getAttribute('aria-describedby')).includes('form-error')&&await invalid.evaluate(node=>node===document.activeElement),theme+': business validation links the visible error to and focuses the invalid field');
  await invalid.selectOption('人间');await page.locator('#entity-form button[type=submit]').click();await page.locator('#editor-dialog').waitFor({state:'detached'});
  await route(page,'dashboard');const agendaOpener=page.locator('.agenda-quick-actions [data-action=agenda-new]');await agendaOpener.click();await namedDialog(page,'agenda-dialog');await page.keyboard.press('Escape');await page.locator('#agenda-dialog').waitFor({state:'detached'});
  check(await agendaOpener.evaluate(node=>node===document.activeElement),theme+': agenda Escape returns focus to its opener');
  await route(page,'settings');await page.locator('.settings-panel[data-section=backup]>summary').click();const trashOpener=page.locator('[data-action=trash]');await trashOpener.click();await namedDialog(page,'trash-dialog');await page.keyboard.press('Escape');await page.locator('#trash-dialog').waitFor({state:'detached'});
  check(await trashOpener.evaluate(node=>node===document.activeElement),theme+': trash Escape returns focus to its opener');
  await route(page,'analytics');await page.locator('[data-action=trace]').first().click();await namedDialog(page,'trace-dialog');await page.keyboard.press('Escape');await page.locator('#trace-dialog').waitFor({state:'detached'});
  await route(page,'knowledge');
  const template=await readFile(new URL('../assets/NextRound_AI整理与一键导入通用模板_V1.4_面试题三级难度.md',import.meta.url),'utf8');const payload=JSON.parse(template.match(/```json\s*\n([\s\S]*?)\n```/)[1]);
  for(const module of ['companies','jobs','introductions','cards','schedules','interviews'])payload[module]=[];
  payload.questions=[payload.questions.find(question=>!question.related_job_ids?.length)];
  const choosing=page.waitForEvent('filechooser');await page.locator('[data-action=import-unified]').first().click();const chooser=await choosing;await chooser.setFiles({name:'accessibility-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});await namedDialog(page,'unified-import-dialog');
  const moduleToggle=page.locator('[data-unified-module=companies]');await moduleToggle.focus();await moduleToggle.press('Space');
  check(await moduleToggle.evaluate(node=>node===document.activeElement),theme+': import preview preserves checkbox focus when recomputing its rows');
  await page.keyboard.press('Escape');await page.locator('#unified-import-dialog').waitFor({state:'detached'});
  await route(page,'train');
  await page.locator('.training-stage [data-mode=questions]').focus();
  const stageFocus=await page.locator('.training-stage').evaluate(stage=>{
   const focus=getComputedStyle(document.activeElement),background=getComputedStyle(stage).backgroundColor;
   const luminance=color=>{const channels=color.match(/[\d.]+/g).slice(0,3).map(value=>{const channel=Number(value)/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4});return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722};
   const a=luminance(focus.outlineColor),b=luminance(background);
   return{outline:focus.outlineColor,width:parseFloat(focus.outlineWidth),style:focus.outlineStyle,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
  check(stageFocus.style!=='none'&&stageFocus.width>=2&&stageFocus.ratio>=3,theme+': actual keyboard outline contrasts at least 3:1 against the dark training base');
  report.layouts.push({theme,stageFocus});
  check(await page.locator('.train-config>summary button').count()===0&&await page.locator('.training-config-help button').count()===1,theme+': disclosure summary and help are separate keyboard targets');
  for(const width of [320,390,720]){
   await page.setViewportSize({width,height:844});await layout(page);
   const headingGeometry=await page.locator('.training-config-block').evaluate(block=>{const title=block.querySelector('summary h2').getBoundingClientRect(),button=block.querySelector('.help-trigger').getBoundingClientRect(),summary=block.querySelector('summary').getBoundingClientRect();return{titleRight:title.right,buttonLeft:button.left,buttonRight:button.right,summaryRight:summary.right,buttonWidth:button.width}});
   check(headingGeometry.buttonLeft>=headingGeometry.titleRight-1&&headingGeometry.buttonRight<=headingGeometry.summaryRight-12,`${theme} ${width}: training help never overlaps its title or disclosure arrow`);
   check(await page.locator('#train-company').evaluate(node=>parseFloat(getComputedStyle(node).fontSize)>=16),`${theme} ${width}: mobile fields use readable 16px text`);
   await noOverflow(page,`${theme} training ${width}`);report.layouts.push({theme,width,headingGeometry});
  }
  await page.setViewportSize({width:320,height:844});await layout(page);await route(page,'knowledge');
  await page.locator('.row-title[data-kind=questions]').first().focus();
  for(let i=0;i<24;i++){
   await page.keyboard.press('Tab');
   const hit=await page.evaluate(()=>{const active=document.activeElement;if(!active.closest('.shell')||active.closest('.site-legal'))return null;const box=active.getBoundingClientRect(),at=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return{label:active.getAttribute('aria-label')||active.textContent?.trim(),obscured:!!at?.closest('.site-legal'),visible:box.bottom>0&&box.top<innerHeight}});
   if(hit)check(hit.visible&&!hit.obscured,`${theme}: keyboard focus stays clear of the protected footer (${hit.label})`);
  }
  await page.screenshot({path:artifactPath('keyboard-'+theme+'-320.png',out),fullPage:false});
  await context.close();
 }
 check(report.errors.length===0,'No browser runtime errors');report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error}
finally{await writeFile(new URL('VERIFICATION.json',out),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({result:report.result,checks:report.checks.length,axeScans:report.axe.length,manualReviewRequired:report.manualReviewRequired,errors:report.errors,failure:report.failure}));}
