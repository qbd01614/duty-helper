

/* ===== V2 special-duty rules ===== */
function v2Interval(start,end){
  const cv=t=>{const [h,m]=String(t||"00:00").split(":").map(Number);return h*60+m};
  let a=cv(start), b=cv(end); if(b<=a)b+=1440; return [a,b];
}
function v2Overlap(a,b,c,d){ return Math.max(a,c)<Math.min(b,d); }
function v2StatusRule(person,shift){
  if(!person) return {ok:false,reason:"未指定人員"};
  const st=person.status, [a,b]=v2Interval(shift.start,shift.end);
  if(["休假","公差","受訓","不可排哨"].includes(st))
    return {ok:false,reason:st+"，不可排哨"};
  if(st==="會客室" && v2Overlap(a,b,480,1320))
    return {ok:false,reason:"會客室：08:00～22:00 不排哨，22:00後才可排"};
  if(st==="當日18休假" && b>960)
    return {ok:false,reason:"當日18休假：班次不可碰到16:00以後"};
  if(st==="隔日08休假" && b>300)
    return {ok:false,reason:"隔日08休假：班次不可碰到05:00以後"};
  return {ok:true,reason:"符合特殊勤務規則"};
}

/* Extend personnel status selector */
document.addEventListener("DOMContentLoaded",()=>{
  const sel=document.querySelector("#personStatus");
  if(sel){
    ["會客室","當日18休假","隔日08休假"].forEach(v=>{
      if(![...sel.options].some(o=>o.value===v || o.text===v)){
        const o=document.createElement("option");o.value=v;
        o.textContent=v==="會客室"?"會客室（08–22不排）":v==="當日18休假"?"當日18休假（16後不排）":"隔日08休假（05後不排）";
        sel.appendChild(o);
      }
    });
  }
});
