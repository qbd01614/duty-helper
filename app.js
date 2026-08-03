
const KEY="dutyHelperV1";
const defaultState={
  people:[],
  schedules:{},
  prevShifts:[],
  todos:[],
  outings:[],
  handovers:[],
  reminderTime:"16:00",
  undo:[]
};
let state=load();

function load(){
  try{return {...defaultState,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{return {...defaultState}}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function snapshot(){
  state.undo=state.undo||[];
  state.undo.push(JSON.stringify({...state,undo:[]}));
  if(state.undo.length>10) state.undo.shift();
}
function undo(){
  const last=state.undo?.pop(); if(!last) return alert("沒有可復原的操作");
  const keep=state.undo;
  state={...JSON.parse(last),undo:keep}; save();
}
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function todayISO(d=new Date()){return d.toISOString().slice(0,10)}
function addDays(iso,n){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+n);return todayISO(d)}
function weekRange(iso){const d=new Date(iso+"T00:00:00"), day=(d.getDay()+6)%7; const mon=new Date(d);mon.setDate(d.getDate()-day);const sun=new Date(mon);sun.setDate(mon.getDate()+6);return [todayISO(mon),todayISO(sun)]}
function activePeople(){return state.people.filter(p=>p.status==="正常")}
function htmlTable(headers,rows){
  return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
}
function fmtStatus(c,n){return n>c?`<span class="bad">${n} ⚠</span>`:n===c?`<span class="warn">${n} 已達上限</span>`:`<span class="ok">${n}</span>`}

function currentSchedule(){const d=$("#scheduleDate").value; return state.schedules[d]||[]}
function setCurrentSchedule(arr){const d=$("#scheduleDate").value; state.schedules[d]=arr}

function makePersonOptions(selected=""){
  return `<option value="">未指定</option>`+state.people.map(p=>`<option ${p.name===selected?"selected":""}>${p.name}</option>`).join("")
}

function renderShiftRows(container,arr,isPrev=false){
  container.innerHTML="";
  arr.forEach((s,i)=>{
    const node=$("#shiftRowTemplate").content.cloneNode(true);
    const row=node.querySelector(".shift-row");
    row.querySelector(".shift-start").value=s.start||"";
    row.querySelector(".shift-end").value=s.end||"";
    row.querySelector(".shift-post").value=s.post||"";
    row.querySelector(".shift-person").innerHTML=makePersonOptions(s.person||"");
    row.querySelector(".shift-night").checked=!!s.night;
    row.querySelector(".shift-hard").checked=!!s.hard;
    const update=()=>{
      snapshot();
      const target=isPrev?state.prevShifts:currentSchedule();
      target[i]={
        start:row.querySelector(".shift-start").value,
        end:row.querySelector(".shift-end").value,
        post:row.querySelector(".shift-post").value,
        person:row.querySelector(".shift-person").value,
        night:row.querySelector(".shift-night").checked,
        hard:row.querySelector(".shift-hard").checked
      };
      if(!isPrev)setCurrentSchedule(target);
      save();
    };
    row.querySelectorAll("input,select").forEach(el=>el.onchange=update);
    row.querySelector(".delete-btn").onclick=()=>{
      snapshot(); const target=isPrev?state.prevShifts:currentSchedule();target.splice(i,1);if(!isPrev)setCurrentSchedule(target);save()
    };
    row.querySelector(".fix-btn").onclick=()=>fixShift(i,isPrev);
    container.appendChild(node);
  });
}
function fixShift(index,isPrev){
  const target=isPrev?state.prevShifts:currentSchedule(); const s=target[index];
  const suggestions=getCandidates(s,index,isPrev);
  if(!suggestions.length)return alert("目前沒有符合條件的建議替補人員。");
  const choice=prompt("建議替補：\n"+suggestions.join("\n")+"\n\n請輸入要替換的人名：",suggestions[0]);
  if(!choice || !suggestions.includes(choice))return;
  snapshot();s.person=choice;if(!isPrev)setCurrentSchedule(target);save();
}
function getCandidates(shift,index,isPrev){
  const sched=isPrev?state.prevShifts:currentSchedule();
  const counts=statsForCurrentPeriod();
  return activePeople().filter(p=>{
    if(p.name===shift.person)return false;
    const same=sched.some((x,i)=>i!==index&&x.person===p.name&&x.start===shift.start);
    if(same)return false;
    if(shift.night && (counts.night[p.name]||0)>=3)return false;
    if(shift.hard && hasPreviousHard(p.name))return false;
    return true;
  }).sort((a,b)=>(counts.total[a.name]||0)-(counts.total[b.name]||0)).map(p=>p.name);
}
function hasPreviousHard(name){
  return state.prevShifts.some(s=>s.person===name&&s.hard);
}

function smartAssign(){
  const arr=currentSchedule(); if(!arr.length)return alert("請先新增班次");
  if(!activePeople().length)return alert("請先新增可排哨人員");
  snapshot();
  const totals={};
  activePeople().forEach(p=>totals[p.name]=0);
  arr.forEach((s,idx)=>{
    const cands=getCandidates({...s,person:""},idx,false);
    const pick=(cands.length?cands:activePeople().map(p=>p.name)).sort((a,b)=>(totals[a]||0)-(totals[b]||0))[0];
    s.person=pick; totals[pick]=(totals[pick]||0)+1;
  });
  setCurrentSchedule(arr); save();
}

function statsForCurrentPeriod(){
  const night={},hard={},total={};
  Object.values(state.schedules).flat().forEach(s=>{
    if(!s.person)return;
    total[s.person]=(total[s.person]||0)+1;
    if(s.night)night[s.person]=(night[s.person]||0)+1;
    if(s.hard)hard[s.person]=(hard[s.person]||0)+1;
  });
  return {night,hard,total};
}
function renderStats(){
  const st=statsForCurrentPeriod();
  $("#nightStats").innerHTML=htmlTable(["人員","夜哨次數"],state.people.map(p=>[p.name,fmtStatus(3,st.night[p.name]||0)]));
  $("#hardStats").innerHTML=htmlTable(["人員","艱苦哨次數","狀態"],state.people.map(p=>{
    const conflict=state.prevShifts.some(x=>x.person===p.name&&x.hard)&&currentSchedule().some(x=>x.person===p.name&&x.hard);
    return [p.name,st.hard[p.name]||0,conflict?'<span class="bad">連續 ⚠</span>':'<span class="ok">正常</span>']
  }));
}
function renderOutings(){
  const ref=$("#scheduleDate").value||todayISO(); const [a,b]=weekRange(ref);
  const people=state.people.map(p=>{
    const n=state.outings.filter(o=>o.person===p.name&&o.date>=a&&o.date<=b).length;
    return [p.name,n?`<span class="ok">已外散 ${n} 次</span>`:'<span class="warn">尚未外散</span>']
  });
  $("#outingStats").innerHTML=htmlTable(["人員","本週狀態"],people);
  $("#outingPerson").innerHTML=makePersonOptions();
}
function runChecks(){
  const errors=[],sched=currentSchedule(),st=statsForCurrentPeriod();
  Object.entries(st.night).forEach(([p,n])=>{if(n>3)errors.push(`${p} 夜哨 ${n} 次，超過 3 次`)});
  state.people.forEach(p=>{if(state.prevShifts.some(x=>x.person===p.name&&x.hard)&&sched.some(x=>x.person===p.name&&x.hard))errors.push(`${p} 艱苦哨與前日連續`)});
  sched.forEach((s,i)=>{if(s.person){
    const person=state.people.find(p=>p.name===s.person);
    if(person&&person.status!=="正常")errors.push(`${s.person} 狀態為「${person.status}」卻被排哨`);
    if(sched.some((x,j)=>j!==i&&x.person===s.person&&x.start===s.start))errors.push(`${s.person} 同時段重複勤務`);
  }});
  const ref=$("#scheduleDate").value||todayISO(),[a,b]=weekRange(ref);
  state.people.forEach(p=>{const n=state.outings.filter(o=>o.person===p.name&&o.date>=a&&o.date<=b).length;if(n>1)errors.push(`${p} 本週外散 ${n} 次，超過 1 次`)});
  $("#checkResult").innerHTML=errors.length?`<div class="notice"><b>⚠ 發現 ${errors.length} 項：</b><br>${errors.map(x=>"• "+x).join("<br>")}</div>`:`<div class="notice"><b class="ok">✅ 目前未發現規則衝突</b></div>`;
  return errors;
}
function renderPeople(){
  $("#personList").innerHTML=state.people.map((p,i)=>`<div class="list-item"><div><b>${p.name}</b><br><small>${p.status}</small></div><button data-i="${i}" class="person-del">刪除</button></div>`).join("");
  $$(".person-del").forEach(b=>b.onclick=()=>{snapshot();state.people.splice(+b.dataset.i,1);save()});
}
function renderTodos(){
  $("#todoList").innerHTML=state.todos.map((t,i)=>`<div class="list-item"><div><label><input type="checkbox" data-i="${i}" class="todo-check" ${t.done?"checked":""}> <b>${t.text}</b></label><br><small>${t.time||""}</small></div><button data-i="${i}" class="todo-del">刪除</button></div>`).join("");
  $$(".todo-check").forEach(c=>c.onchange=()=>{snapshot();state.todos[+c.dataset.i].done=c.checked;save()});
  $$(".todo-del").forEach(b=>b.onclick=()=>{snapshot();state.todos.splice(+b.dataset.i,1);save()});
}
function renderHandovers(){
  $("#handoverList").innerHTML=state.handovers.slice().reverse().map(h=>`<div class="list-item"><div><b>${h.date} ${h.from} → ${h.to}</b><br><small>${h.note}</small></div></div>`).join("");
}
function renderDashboard(){
  const tomorrow=addDays(todayISO(),1);
  $("#tomorrowStatus").textContent=(state.schedules[tomorrow]?.length)?"已建立":"尚未完成";
  $("#todoCount").textContent=state.todos.filter(t=>!t.done).length;
  const st=statsForCurrentPeriod();
  $("#nightOverCount").textContent=Object.values(st.night).filter(n=>n>3).length;
  $("#hardConflictCount").textContent=state.people.filter(p=>state.prevShifts.some(x=>x.person===p.name&&x.hard)&&currentSchedule().some(x=>x.person===p.name&&x.hard)).length;
  const time=state.reminderTime||"16:00";
  const now=new Date(), due=new Date(`${todayISO()}T${time}:00`);
  $("#scheduleReminderBox").innerHTML=(!state.schedules[tomorrow]?.length && now>=due)?`<b>⚠ 已超過 ${time}，明日哨表尚未完成。</b>`:`明日哨表：${state.schedules[tomorrow]?.length?"已建立":"尚未完成"}；提醒時間 ${time}`;
}
function renderAll(){
  $("#todayText").textContent=new Date().toLocaleString("zh-TW",{dateStyle:"full",timeStyle:"short"});
  $("#scheduleReminderTime").value=state.reminderTime||"16:00";
  renderPeople(); renderTodos(); renderHandovers();
  renderShiftRows($("#shiftList"),currentSchedule(),false);
  renderShiftRows($("#prevShiftList"),state.prevShifts,true);
  renderStats(); renderOutings(); renderDashboard();
}
function bind(){
  $$(".bottom-nav button").forEach(b=>b.onclick=()=>{$$(".bottom-nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");$$(".page").forEach(p=>p.classList.remove("active"));$("#"+b.dataset.page).classList.add("active")});
  $("#undoBtn").onclick=undo;
  $("#scheduleDate").value=todayISO();
  $("#outingDate").value=todayISO();
  $("#scheduleDate").onchange=renderAll;
  $("#addShiftBtn").onclick=()=>{snapshot();const a=currentSchedule();a.push({start:"08:00",end:"10:00",post:"",person:"",night:false,hard:false});setCurrentSchedule(a);save()};
  $("#addPrevShiftBtn").onclick=()=>{snapshot();state.prevShifts.push({start:"22:00",end:"00:00",post:"",person:"",night:true,hard:false});save()};
  $("#smartAssignBtn").onclick=smartAssign;
  $("#saveScheduleBtn").onclick=()=>{save();alert("哨表已儲存於此手機瀏覽器")};
  $("#runCheckBtn").onclick=runChecks;
  $("#addPersonBtn").onclick=()=>{const name=$("#personName").value.trim();if(!name)return;snapshot();state.people.push({name,status:$("#personStatus").value});$("#personName").value="";save()};
  $("#addTodoBtn").onclick=()=>{const text=$("#todoText").value.trim();if(!text)return;snapshot();state.todos.push({text,time:$("#todoTime").value,done:false});$("#todoText").value="";save()};
  $("#addOutingBtn").onclick=()=>{
    const p=$("#outingPerson").value,d=$("#outingDate").value;if(!p||!d)return;
    const [a,b]=weekRange(d),n=state.outings.filter(o=>o.person===p&&o.date>=a&&o.date<=b).length;
    if(n>=1)return alert(`${p} 本週已外散 1 次，不可再次登記。`);
    snapshot();state.outings.push({person:p,date:d});save()
  };
  $("#saveHandoverBtn").onclick=()=>{snapshot();state.handovers.push({date:new Date().toLocaleString("zh-TW"),from:$("#handoverFrom").value,to:$("#handoverTo").value,note:$("#handoverNote").value});$("#handoverNote").value="";save()};
  $("#saveReminderBtn").onclick=()=>{state.reminderTime=$("#scheduleReminderTime").value;save()};
  $("#clearSessionBtn").onclick=()=>{
    if(!confirm("確定交接完成，要清除本次值星暫存資料嗎？正式哨表、人員與交接簿會保留。"))return;
    if(!confirm("再次確認：此操作會清除待辦、昨日手動哨表與本週外散暫存。"))return;
    snapshot();state.todos=[];state.prevShifts=[];state.outings=[];save();
  };
}
bind(); renderAll();
if("serviceWorker" in navigator){navigator.serviceWorker.register("service-worker.js").catch(()=>{})}
