import test from "node:test";
import assert from "node:assert/strict";
import { blankState, touch } from "../core.js";
import { TAG_COLORS, TAG_SCORE_RULES, tagScoreEffect, tagScoreAdjustment, opportunityIntentValues, isManualIntentValue, statusesFor } from "../opportunity.js";
import { opportunityCard, decisionMarkup, jobEditor, inferMonthlySalary, editableJobTags, jobTagInputRow, parseEditableJobTags } from "../opportunity-ui.js";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const make = (id, fields) => touch({ id }, fields);
function context(state) {
  return { state, esc,
    btn: (text, action, cls="", extra="") => `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`,
    badge: (text, color="") => `<span class="badge ${color}">${esc(text)}</span>`,
    pageHead: (title, sub, action) => `<header><h1>${esc(title)}</h1><p>${esc(sub)}</p>${action}</header>`,
    textField: (name, title, value, type="text", extra="") => `<label>${title}<input name="${name}" value="${esc(value)}" type="${type}" ${extra}></label>`,
    area: (name, title, value) => `<label>${title}<textarea name="${name}">${esc(value)}</textarea></label>`,
    selectField: (name, title, options) => `<label>${title}<select name="${name}">${options}</select></label>`,
    options: (values, selected) => values.map(value=>`<option ${value===selected?"selected":""}>${esc(value)}</option>`).join(""),
    opts: (values, selected, key, empty) => `<option value="">${esc(empty)}</option>`+values.map(value=>`<option value="${esc(value.id)}" ${value.id===selected?"selected":""}>${esc(value[key])}</option>`).join(""),
  };
}
function fixture(publicMode=false) {
  const state=blankState();
  state.companies=[make("org",{name:"示例单位",kind:publicMode?"public":"enterprise",tags:[{name:"待核实",color:"yellow",weight:8},{name:"资料参考",color:"blue",weight:6}],ratings:{fit:8}})];
  state.jobs=[make("job",{companyId:"org",title:"目标职位",track:publicMode?"civil-service":"enterprise",status:publicMode?"待面试":"约面试",salaryMonthly:20000,months:13,hoursWeek:40})];
  return state;
}
test("yellow tags are risks while blue remains reference-only",()=>{
  assert.deepEqual(TAG_COLORS,["green","red","yellow","blue"]);
  const tags=[{color:"green",weight:12},{color:"red",weight:5},{color:"yellow",weight:99},{color:"blue",weight:77}];
  const before=structuredClone(tags);
  assert.equal(tagScoreAdjustment(tags),-92);assert.equal(tagScoreEffect(tags[2]),-99);assert.equal(tagScoreEffect(tags[3]),0);
  assert.equal(tagScoreEffect({color:"unknown",weight:100}),0);
  assert.equal(tagScoreEffect({color:"green",weight:-1}),0);
  assert.equal(tagScoreAdjustment(tags,{...TAG_SCORE_RULES,yellow:{factor:-.5}}),-42.5);
  assert.deepEqual(tags,before);
});
test("job editor keeps editable salary bounds and turns old conditions into editable tags",()=>{
  assert.equal(inferMonthlySalary({salaryMin:12000,salaryMax:18000}),15000);
  assert.equal(inferMonthlySalary({salary:"1.5-2.5万/月"}),20000);
  assert.equal(inferMonthlySalary({salaryMonthly:0,salaryMin:12000,salaryMax:18000}),0);
  assert.equal(inferMonthlySalary({jd:"职责：用户研究\n薪资：18-24K/月"}),21000);
  assert.equal(inferMonthlySalary({jd:"年薪：20-30万/年"}),"");
  const state=fixture();
  Object.assign(state.jobs[0],{salaryMonthly:undefined,salaryMin:12000,salaryMax:18000,commute:"35 分钟",benefits:"五险一金",tags:[{id:"v4-a",name:"灵活办公",color:"green",detail:"来源说明"}]});
  delete state.jobs[0].salaryMonthly;
  const html=jobEditor(state.jobs[0],context(state));
  assert.match(html,/name="salaryMin"[^>]*value="12000"/);
  assert.match(html,/name="salaryMax"[^>]*value="18000"/);
  assert.ok(!html.includes('name="salaryMonthly"'));
  assert.match(html,/name="jobTagName"[^>]*value="灵活办公"/);
  assert.match(html,/单程通勤：35 分钟/);
  assert.ok(!html.includes('name="commute"'));
  assert.ok(!html.includes('name="benefits"'));
  assert.match(html,/data-action="job-tag-add"/);
  const form=new FormData();
  for(const [id,index,name,color] of [["v4-a","0","弹性工作","green"],["condition-commute","1","通勤 35 分钟","yellow"],["","","额外休假","blue"]]) {
    form.append("jobTagId",id);form.append("jobTagIndex",index);form.append("jobTagName",name);form.append("jobTagColor",color);
  }
  const parsed=parseEditableJobTags(form,editableJobTags(state.jobs[0]),()=>"new-id");
  assert.equal(parsed[0].id,"v4-a");assert.equal(parsed[0].name,"弹性工作");assert.equal(parsed[0].detail,"来源说明");
  assert.equal(parsed[1].color,"yellow");assert.equal(parsed[2].id,"new-id");
});
test("edited, removed and new tags survive a save without restoring old condition fields",()=>{
  const job={track:"enterprise",commute:"30 分钟",tags:[{id:"import-a",name:"旧名称",color:"blue",detail:"原始说明"}]};
  const form=new FormData();
  for(const [id,index,name,color] of [["import-a","0","已核实优点","green"],["","","新增风险","yellow"]]) {
    form.append("jobTagId",id);form.append("jobTagIndex",index);form.append("jobTagName",name);form.append("jobTagColor",color);
  }
  const saved={...job,tags:parseEditableJobTags(form,editableJobTags(job),()=>"new-tag"),conditionTagsMigrated:true};
  assert.deepEqual(saved.tags.map(tag=>tag.id),["import-a","new-tag"]);
  assert.equal(saved.tags[0].color,"green");assert.equal(saved.tags[0].detail,"原始说明");
  assert.deepEqual(editableJobTags(saved).map(tag=>tag.name),["已核实优点","新增风险"]);
  const newRow=jobTagInputRow({},esc);
  assert.match(newRow,/name="jobTagId" value="[^"]+"/);
});
test("manual intent values preserve exact zero and fall back independently per job",()=>{
  const rules={personal:74,interest:61};
  assert.deepEqual(opportunityIntentValues({},rules),{personal:74,employer:61,personalManual:false,employerManual:false});
  assert.deepEqual(opportunityIntentValues({personalIntent:0,employerIntent:100},rules),{personal:0,employer:100,personalManual:true,employerManual:true});
  assert.equal(opportunityIntentValues({personalIntent:null,employerIntent:"20"},rules).personal,74);
  for(const value of [-1,101,Infinity,NaN,null,"50",undefined]) assert.equal(isManualIntentValue(value),false);
});
test("enterprise status choices preserve both V4 seven-stage values and historical archives",()=>{
  const values=statusesFor({track:"enterprise"});
  for(const value of ["未沟通","已沟通","简历已投递","约面试","面试完成","Offer","不通过","关注","沟通","待面试","面试中","结束"]) assert.ok(values.includes(value),value);
  assert.equal(new Set(values).size,values.length);
});
test("new job forms allow a directly entered company with no pre-existing company record",()=>{
  const state=blankState(),html=jobEditor({id:"new"},context(state));
  assert.ok(html.indexOf('name="title"')<html.indexOf('name="companyName"'));
  assert.match(html,/name="companyName"[^>]*required/);
  assert.match(html,/name="companyId"/);
  assert.ok(html.includes("按名称新建或匹配"));
  assert.ok(html.includes("未沟通"));
  assert.ok(html.includes("公务员招录"));
  assert.match(jobEditor({id:"new-public",track:"civil-service"},context(state)),/招录单位名称/);
  assert.match(jobEditor({id:"new-public",track:"civil-service"},context(state)),/data-action="job-tag-add"/);
  const current=fixture();
  assert.match(jobEditor(current.jobs[0],context(current)),/name="companyName" value="示例单位"/);
});
test("opportunity cards put the position first, escape content and delete the job specifically",()=>{
  const state=fixture(),job={...state.jobs[0],title:'<script>职位</script>',personalIntent:0},org={...state.companies[0],name:'<img src=x onerror=1>'};
  const html=opportunityCard(job,org,context(state));
  assert.ok(html.indexOf('&lt;script&gt;职位')<html.indexOf('&lt;img'));
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img '));
  assert.match(html,/data-action="trash-list-record" data-kind="jobs" data-id="job"/);
  assert.match(html,/个人就职意向<\/span><strong>0/);
  assert.ok(html.includes("badge yellow"));assert.ok(html.includes("badge blue"));
  assert.ok(!html.includes("待核实 ·"));assert.ok(!html.includes("资料参考 ·"));
});
test("decision cards expose two independent sliders and keep public raw results distinct",()=>{
  const state=fixture(true);Object.assign(state.jobs[0],{writtenScore:250.5,interviewScore:83.2,finalScore:166.85,rank:2,personalIntent:0,employerIntent:20});
  const html=decisionMarkup({...context(state),mode:"public"});
  assert.equal((html.match(/type="range"/g)||[]).length,2);
  assert.match(html,/data-opportunity-score="personalIntent" data-job-id="job"/);
  assert.match(html,/data-opportunity-score="employerIntent" data-job-id="job"/);
  assert.match(html,/data-action="reset-opportunity-score" data-field="personalIntent"/);
  assert.ok(html.includes("单位意向（个人判断）"));assert.ok(html.includes("招录流程进展"));
  for(const value of ["250.5","83.2","166.85"]) assert.ok(html.includes(value));
  assert.ok(html.includes('class="company-card opportunity-card decision-card"'));
  assert.ok(!html.includes("<table>"));
});


test("salary cards retain explicit pay months and legacy source months remain editable",()=>{
  const state=fixture(),job=state.jobs[0];
  delete job.salaryMonthly;
  delete job.months;
  Object.assign(job,{salary:"25-50K×13个月",salaryMin:25000,salaryMax:50000});
  const before=structuredClone(job);
  assert.match(opportunityCard(job,state.companies[0],context(state)),/月薪 25k~50k × 13个月/);
  assert.match(jobEditor(job,context(state)),/name="months"[^>]*value="13"/);
  assert.deepEqual(job,before);
  job.months=14;
  assert.match(jobEditor(job,context(state)),/name="months"[^>]*value="14"/);
  assert.match(opportunityCard(job,state.companies[0],context(state)),/月薪 25k~50k × 14个月/);
});


test("decision cards omit the decision display while keeping saved choices editable",()=>{
  const state=fixture(),job=state.jobs[0];
  job.decision="接受 Offer";
  job.decisionNotes="虚构决定理由用于测试保留";
  const before=structuredClone(state);
  const html=decisionMarkup({...context(state),mode:"enterprise"});
  assert.ok(!html.includes('class="opportunity-decision"'));
  assert.ok(!html.includes(job.decisionNotes));
  assert.ok(html.includes("编辑岗位与决定"));
  const editor=jobEditor(job,context(state));
  assert.match(editor,/name="decision"/);
  assert.match(editor,/接受 Offer/);
  assert.ok(editor.includes(job.decisionNotes));
  assert.deepEqual(state,before);
});
