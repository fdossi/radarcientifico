"use strict";
const $=id=>document.getElementById(id);
const state={rows:[],status:{},filtered:[],page:1,pageSize:12,charts:[],view:"opportunities"};
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=d=>d?new Date(d).toLocaleDateString("pt-BR",{timeZone:"UTC"}):"Não informado";
const money=n=>n==null?"Não informado":Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function unique(key){return [...new Set(state.rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"))}
function populate(id,values){const el=$(id),selected=el.value;el.replaceChildren(new Option("Todas",""));values.forEach(v=>el.add(new Option(v,v)));el.value=values.includes(selected)?selected:""}
function initFilters(){populate("category",unique("category"));populate("institution",unique("institution"));populate("state",unique("uf"));populate("dashInstitution",unique("institution"));populate("dashCategory",unique("category"));populate("dashState",unique("uf"))}
function card(r){const status=r.status==="fonte_indica_aberto"?"Listada como aberta na fonte":"Situação não verificada";
const tags=[r.category,r.level,r.uf].filter(Boolean).map(t=>'<span class="tag">'+safe(t)+'</span>').join("");
return '<article class="op-card"><div class="card-top"><div><div class="agency">'+safe(r.institution)+' · '+safe(r.uf||"—")+'</div><h3>'+safe(r.title)+'</h3></div><span class="badge '+(r.status==="fonte_indica_aberto"?"green":"")+'">'+safe(status)+'</span></div><div class="chips">'+tags+'</div><div class="card-bottom"><span>Prazo: '+fmtDate(r.deadline)+' · Valor: '+money(r.amount_brl)+'</span><div class="actions"><button class="secondary" data-save="'+safe(r.id)+'">Salvar</button><a class="primary" href="'+safe(r.url)+'" target="_blank" rel="noopener noreferrer">Fonte oficial ↗</a></div></div></article>'}
function filter(){const q=$("search").value.trim().toLocaleLowerCase("pt-BR"),cat=$("category").value,inst=$("institution").value,uf=$("state").value,st=$("statusFilter").value;
let rows=state.rows.filter(r=>(!q||[r.title,r.institution,r.category,r.level,r.uf].join(" ").toLocaleLowerCase("pt-BR").includes(q))&&(!cat||r.category===cat)&&(!inst||r.institution===inst)&&(!uf||r.uf===uf)&&(!st||r.status===st));
if($("sort").value==="name")rows.sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"));else if($("sort").value==="institution")rows.sort((a,b)=>a.institution.localeCompare(b.institution,"pt-BR"));else rows.sort((a,b)=>(b.first_seen||"").localeCompare(a.first_seen||""));
state.filtered=rows;const pages=Math.max(1,Math.ceil(rows.length/state.pageSize));state.page=Math.min(state.page,pages);
$("resultCount").textContent=rows.length;const part=rows.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
$("cards").innerHTML=part.length?part.map(card).join(""):'<div class="empty">Nenhuma oportunidade encontrada. Ajuste os filtros ou verifique a situação das fontes na metodologia.</div>';
$("pageInfo").textContent=state.page+" / "+pages;$("prev").disabled=state.page===1;$("next").disabled=state.page===pages;}
function downloadCsv(){const header=["id","institution","title","url","category","level","uf","deadline","amount_brl","status","first_seen"];const content=[header.join(";"),...state.filtered.map(r=>header.map(k=>'"'+String(r[k]??"").replace(/"/g,'""')+'"').join(";"))].join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+content],{type:"text/csv;charset=utf-8"}));a.download="radar-cientifico-oportunidades.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function countBy(rows,key){const out=new Map();rows.forEach(r=>{let k=r[key]||"Não informado";out.set(k,(out.get(k)||0)+1)});return [...out].sort((a,b)=>b[1]-a[1])}
function draw(id,option){const dom=$(id);if(!window.echarts){dom.textContent="Gráficos indisponíveis: biblioteca não carregada.";return}let chart=echarts.getInstanceByDom(dom)||echarts.init(dom,null,{renderer:"canvas"});chart.setOption(option,true);if(!state.charts.includes(chart))state.charts.push(chart)}
const axis={axisLabel:{color:"#a6b8c9"},axisLine:{lineStyle:{color:"#41536b"}},splitLine:{lineStyle:{color:"#2c3a4d"}}};
function dashboard(){const inst=$("dashInstitution").value,cat=$("dashCategory").value,uf=$("dashState").value;const rows=state.rows.filter(r=>(!inst||r.institution===inst)&&(!cat||r.category===cat)&&(!uf||r.uf===uf));
$("kRecords").textContent=rows.length.toLocaleString("pt-BR");$("kAgencies").textContent=new Set(rows.map(r=>r.institution)).size;$("kInnovation").textContent=rows.filter(r=>["Inovação","Startups"].includes(r.category)).length;$("kCoverage").textContent=(state.status.sources_ok??0)+"/"+(state.status.sources_total??0);
const stamp=$("terminalUpdated");if(stamp)stamp.textContent=state.status.updated_at?"Última atualização: "+new Date(state.status.updated_at).toLocaleString("pt-BR"):"Última atualização: —";
const months=countBy(rows.map(r=>({...r,month:r.first_seen?.slice(0,7)||"Sem data"})),"month").sort((a,b)=>a[0].localeCompare(b[0]));
const base={backgroundColor:"transparent",textStyle:{color:"#b9ccdb"},tooltip:{trigger:"axis"},grid:{left:55,right:22,top:28,bottom:48},xAxis:{type:"category",...axis},yAxis:{type:"value",minInterval:1,...axis}};
draw("timeChart",{...base,xAxis:{...base.xAxis,data:months.map(x=>x[0])},series:[{type:"line",data:months.map(x=>x[1]),smooth:true,areaStyle:{color:"rgba(56,177,207,.12)"},lineStyle:{color:"#62d8e8",width:2},itemStyle:{color:"#62d8e8"}}]});
const rank=countBy(rows,"institution").slice(0,12).reverse();
draw("rankChart",{backgroundColor:"transparent",tooltip:{trigger:"axis"},grid:{left:110,right:22,top:12,bottom:27},xAxis:{type:"value",minInterval:1,...axis},yAxis:{type:"category",data:rank.map(x=>x[0]),axisLabel:{color:"#b8c9da",width:90,overflow:"truncate"},axisLine:{show:false}},series:[{type:"bar",data:rank.map(x=>x[1]),itemStyle:{color:"#4db9d0"},barMaxWidth:17}]});
const cats=countBy(rows,"category");draw("categoryChart",{backgroundColor:"transparent",tooltip:{trigger:"item"},legend:{bottom:0,textStyle:{color:"#a9bacb"}},series:[{type:"pie",radius:["42%","70%"],center:["50%","43%"],label:{color:"#d8e5ed"},data:cats.map(([name,value])=>({name,value}))}]});
const states=countBy(rows,"uf");draw("ufChart",{...base,xAxis:{...base.xAxis,data:states.map(x=>x[0])},series:[{type:"bar",data:states.map(x=>x[1]),itemStyle:{color:"#52c5a8"},barMaxWidth:36}]});
$("terminalTable").querySelector("tbody").innerHTML=rows.slice(0,60).map(r=>'<tr><td>'+safe(r.institution)+'</td><td><a target="_blank" rel="noopener noreferrer" href="'+safe(r.url)+'">'+safe(r.title.slice(0,75))+'</a></td><td>'+safe(r.category)+'</td><td>'+safe(r.uf)+'</td><td>'+money(r.amount_brl)+'</td><td>'+safe(r.status==="fonte_indica_aberto"?"Fonte: aberta":"Não verificada")+'</td></tr>').join("")||'<tr><td colspan="6">Nenhum registro disponível.</td></tr>';
setTimeout(()=>state.charts.forEach(c=>c.resize()),100)}
function switchView(name){state.view=name;document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!==name));document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===name));if(name==="dashboard")dashboard();history.replaceState(null,"","#"+name)}
async function boot(){try{const [r,s]=await Promise.all([fetch("./data/opportunities.json?"+Date.now(),{cache:"no-store"}),fetch("./data/status.json?"+Date.now(),{cache:"no-store"})]);if(!r.ok||!s.ok)throw Error("Falha ao ler snapshots");state.rows=await r.json();state.status=await s.json();if(!Array.isArray(state.rows))throw Error("Dados não são lista");
$("heroTotal").textContent=state.rows.length;$("heroSources").textContent=state.status.sources_ok??0;$("lastUpdate").textContent=state.status.updated_at?"Última verificação: "+new Date(state.status.updated_at).toLocaleString("pt-BR"):"Aguardando primeira coleta";
$("health").textContent="Fontes com sucesso: "+(state.status.sources_ok??0)+" / "+(state.status.sources_total??0)+". Erros da última execução: "+(state.status.errors?.length??0)+". Fontes catalogadas: "+(state.status.sources_catalogued??0)+".";
initFilters();filter();if(state.view==="dashboard")dashboard();
}catch(e){$("cards").innerHTML='<div class="empty">Não foi possível carregar os dados: '+safe(e.message)+'</div>';}}
document.querySelectorAll(".nav").forEach(el=>el.addEventListener("click",()=>switchView(el.dataset.view)));
for(const id of ["search","category","institution","state","statusFilter","sort"])$(id).addEventListener(id==="search"?"input":"change",()=>{state.page=1;filter()});
for(const id of ["dashInstitution","dashCategory","dashState"])$(id).addEventListener("change",dashboard);
document.querySelectorAll(".chip").forEach(btn=>btn.addEventListener("click",()=>{$("category").value=btn.dataset.cat;document.querySelectorAll(".chip").forEach(b=>b.classList.toggle("selected",b===btn));state.page=1;filter()}));
$("prev").addEventListener("click",()=>{state.page--;filter();$("cards").scrollIntoView({block:"start"})});
$("next").addEventListener("click",()=>{state.page++;filter();$("cards").scrollIntoView({block:"start"})});
$("exportCsv").addEventListener("click",downloadCsv);
$("cards").addEventListener("click",e=>{const id=e.target.closest("[data-save]")?.dataset.save;if(!id)return;let saved=[];try{saved=JSON.parse(localStorage.getItem("radar-saved")||"[]")}catch{}saved=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];localStorage.setItem("radar-saved",JSON.stringify(saved));e.target.textContent=saved.includes(id)?"Salvo ✓":"Salvar"});
$("themeToggle").addEventListener("click",()=>document.body.classList.toggle("compact"));
window.addEventListener("resize",()=>state.charts.forEach(c=>c.resize()));
const initial=location.hash.slice(1);if(["opportunities","dashboard","methodology"].includes(initial))switchView(initial);
boot();
