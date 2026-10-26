import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium, baseUrl, testOutput, artifactPath } from './browser-support.mjs';
const out=await testOutput(import.meta.url), report={checks:[],errors:[]};
const check=(value,label)=>{assert.ok(value,label);report.checks.push(label)};
const browser=await chromium.launch({headless:true,executablePath:process.env.NEXTROUND_BROWSER,args:['--disable-gpu','--mute-audio']});
const context=await browser.newContext({viewport:{width:505,height:764},reducedMotion:'reduce',serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
const ready=()=>page.locator('html:not([data-starting])').waitFor();
const field=name=>page.locator(`#entity-form [name="${name}"]`);
const saved=()=>page.evaluate(async()=>(await import('./db.js')).loadState({workspace:'formal'}));
async function save(){await page.locator('#entity-form button[type=submit]').click();await page.locator('#editor-dialog').waitFor({state:'detached'})}
try{
 await page.goto(new URL('core.js',baseUrl).href);
 check(await page.evaluate(async()=>(await indexedDB.databases()).length)===0,'Salary checks start in a disposable empty browser archive');
 await page.goto(new URL('#/decision',baseUrl).href);await ready();
 await page.locator('[data-action=new-job]').first().click();
 await field('title').fill('虚构产品岗位');await field('companyName').fill('虚构研究工作室');
 await field('jd').fill('薪资：25k~50k×13个月\n仅为浏览器回归的虚构资料。');
 check(await field('salaryMin').inputValue()==='25000'&&await field('salaryMax').inputValue()==='50000','Pasting an explicit monthly range fills both bounds');
 check(await field('months').inputValue()==='13','Pasting ×13个月 fills the annual pay-month field');
 await save();
 check((await page.locator('.opportunity-card-meta').textContent()).includes('月薪 25k~50k × 13个月'),'The actual decision card displays the explicit monthly multiplier');
 check(await page.locator('.opportunity-decision').count()===0,'The removed decision-status block does not render');
 const before=(await saved()).jobs.find(job=>job.title==='虚构产品岗位');
 check(before.salaryMin===25000&&before.salaryMax===50000&&before.months===13,'The parsed bounds and months are persisted through the normal editor');
 await page.locator('[data-action=edit][data-kind=jobs]').first().click();
 check(await field('months').inputValue()==='13','Reopening the job retains its parsed month count');
 await field('months').fill('14');
 await field('jd').fill('薪资：30k~60k × 16个月\n虚构资料更新，不应覆盖手动薪资字段。');
 check(await field('months').inputValue()==='14','Updating the JD cannot overwrite a manually edited month count');
 check(await field('salaryMin').inputValue()==='25000'&&await field('salaryMax').inputValue()==='50000','Updating the JD preserves existing explicit bounds');
 await save();await page.reload();await ready();
 check((await page.locator('.opportunity-card-meta').textContent()).includes('月薪 25k~50k × 14个月'),'A real reload retains the manually selected month count');
 check(await page.locator('.opportunity-decision').count()===0,'Reload does not restore the deleted decision display');
 await page.locator('[data-action=edit][data-kind=jobs]').first().click();
 check(await field('decision').count()===1,'The saved-decision edit field remains available');
 await page.keyboard.press('Escape');
 await page.screenshot({path:artifactPath('salary-months-505.png',out),fullPage:true});
 check(report.errors.length===0,'No runtime errors in salary editing and rendering');
 report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error}
finally{await writeFile(new URL('VERIFICATION.json',out),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report))}
