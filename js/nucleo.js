const $=id=>document.getElementById(id);
const fmt=n=>n==null?'—':'$'+Math.round(n).toLocaleString('es-AR');
const fmtPct=n=>(n*100).toFixed(1)+'%';
const fmtCh=n=>n==null?'—':(n>=0?'+':'')+n.toFixed(2)+'%';

// THEME
// Tres estados, no dos: sin atributo la app sigue al tema del sistema, y el
// atributo aparece sólo cuando el usuario elige a mano. Antes se forzaba
// siempre un valor explícito con "oscuro" por defecto, así que la preferencia
// del celular no se miraba nunca.
function temaEfectivo(){
  const puesto=document.documentElement.getAttribute('data-theme');
  if(puesto) return puesto;
  return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
function pintarBotonTema(){
  const b=$('theme-btn');
  if(b) b.textContent=temaEfectivo()==='dark'?'☀️':'🌙';
}
function toggleTheme(){
  // Se invierte lo que se está VIENDO, no el atributo: sin esto, el primer
  // toque con el sistema en oscuro escribía "dark" y no pasaba nada.
  const nuevo=temaEfectivo()==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',nuevo);
  pintarBotonTema();
  try{localStorage.setItem('prt',nuevo);}catch(e){}
  refrescarColoresDeGraficos();
}

// Los gráficos se dibujan en canvas: no heredan colores del CSS y hay que
// repintarlos a mano cuando cambia el tema. Estaba suelto dentro de
// toggleTheme(); ahora es una función aparte porque también hace falta cuando
// el tema lo cambia el sistema y el usuario nunca eligió a mano.
function refrescarColoresDeGraficos(){
  setTimeout(()=>{
    const opts=cDef();
    [chart,chartEsc].forEach(c=>{
      c.options.plugins.tooltip=opts.plugins.tooltip;
      c.options.scales.x.ticks.color=opts.scales.x.ticks.color;
      c.options.scales.x.border.color=opts.scales.x.border.color;
      c.options.scales.y.ticks.color=opts.scales.y.ticks.color;
      c.options.scales.y.border.color=opts.scales.y.border.color;
      c.update();
    });
    const dOpts=donutOpts();
    [dCat,dAsset].forEach(c=>{
      c.options.plugins.tooltip=dOpts.plugins.tooltip;
      c.update();
    });
  },50);
}
function loadTheme(){
  try{
    const t=localStorage.getItem('prt');
    // Sin elección guardada NO se pone atributo: así manda el sistema.
    if(t==='dark'||t==='light') document.documentElement.setAttribute('data-theme',t);
    else document.documentElement.removeAttribute('data-theme');
  }catch(e){}
  pintarBotonTema();
  // Si nunca eligió a mano y el sistema cambia (modo noche automático), la app
  // acompaña sin necesidad de recargar.
  try{
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{
      if(!document.documentElement.getAttribute('data-theme')){
        pintarBotonTema();
        if(typeof refrescarColoresDeGraficos==='function') refrescarColoresDeGraficos();
      }
    });
  }catch(e){}
}

// STORAGE
const LS1='planRetiro_cartera_v1',LS2='planRetiro_params_v1',LS3='planRetiro_snapshots_v1';
// La cartera pasó de ser una lista suelta a ser varias carteras. Para no tocar
// las ~30 funciones que trabajan sobre `assets`, ese sigue siendo el arreglo de
// trabajo: contiene lo que estás VIENDO. La fuente de la verdad es `carteras`,
// y saveAssets() devuelve lo visible a la cartera que corresponda.
//
// Cada activo lleva un `cId` con la cartera a la que pertenece. Eso es lo que
// permite que en la vista "Todo" se pueda editar y vender igual: cada fila sabe
// de dónde salió.
function saveAssets(){
  try{
    if(carteraActiva===TODAS){
      carteras.forEach(c=>c.assets=[]);
      assets.forEach(a=>{const c=carteraPorId(a.cId)||carteras[0];a.cId=c.id;c.assets.push(a);});
    }else{
      const c=carteraPorId(carteraActiva);
      if(c){assets.forEach(a=>a.cId=c.id);c.assets=assets;}
    }
    localStorage.setItem(LS1,JSON.stringify({carteras,carteraActiva,assetIdCounter}));
  }catch(e){}
}

function loadAssets(){
  try{
    const r=localStorage.getItem(LS1);
    if(!r){carteras=[nuevaCarteraVacia('Principal')];carteraActiva=carteras[0].id;assets=[];return;}
    const p=JSON.parse(r);
    if(Array.isArray(p.carteras)&&p.carteras.length){
      carteras=p.carteras.map(c=>({id:Number(c.id),nombre:c.nombre||'Cartera',
        assets:(c.assets||[]).map(a=>({...a,id:Number(a.id),cId:Number(c.id)}))}));
    }else{
      // Formato viejo: una sola lista suelta. Se convierte en la cartera
      // "Principal" para que nadie tenga que rearmar nada a mano.
      carteras=[{id:1,nombre:'Principal',
        assets:(p.assets||[]).map(a=>({...a,id:Number(a.id),cId:1}))}];
    }
    assetIdCounter=p.assetIdCounter||carteras.reduce((s,c)=>s+c.assets.length,0);
    carteraActiva=(p.carteraActiva===TODAS||carteras.some(c=>c.id===p.carteraActiva))
      ?p.carteraActiva:carteras[0].id;
    assets=assetsVisibles();
  }catch(e){
    carteras=[nuevaCarteraVacia('Principal')];carteraActiva=carteras[0].id;assets=[];
  }
}

function nuevaCarteraVacia(nombre){
  const id=carteras.length?Math.max(...carteras.map(c=>c.id))+1:1;
  return {id,nombre,assets:[]};
}
function carteraPorId(id){return carteras.find(c=>c.id===id);}
function assetsVisibles(){
  return carteraActiva===TODAS
    ? carteras.flatMap(c=>c.assets)
    : (carteraPorId(carteraActiva)||{assets:[]}).assets;
}
function nombreCarteraActiva(){
  return carteraActiva===TODAS?'Todo':(carteraPorId(carteraActiva)||{}).nombre||'Cartera';
}

// ── SELECTOR DE CARTERA ─────────────────────────────────────────────────────
function renderSelectorCarteras(){
  const cont=$('cartera-selector');
  if(!cont)return;
  // Con una sola cartera el selector no aporta nada y ocupa lugar.
  if(carteras.length<2){cont.innerHTML='';cont.style.display='none';return;}
  cont.style.display='';
  const btn=(id,txt)=>`<button class="toggle-btn${carteraActiva===id?' active':''}" onclick="cambiarCartera(${typeof id==='string'?`'${id}'`:id})">${txt}</button>`;
  cont.innerHTML=carteras.map(c=>btn(c.id,c.nombre)).join('')+btn(TODAS,'Todo');
}

function cambiarCartera(id){
  if(carteraActiva===id)return;
  saveAssets();               // asegurar que lo visible quede guardado antes de soltar
  carteraActiva=id;
  assets=assetsVisibles();
  saveAssets();               // persiste la cartera activa elegida
  renderSelectorCarteras();
  renderCartera();
  // Los precios viven en cada activo y sobreviven al cambio, así que sólo se
  // vuelve a pedir si alguno todavía no tiene precio (recién agregado o
  // restaurado desde GitHub).
  if(assets.some(a=>!a.price)&&assets.length)refreshPrices();
  if(typeof populateHistSeriesSelect==='function')populateHistSeriesSelect();
  if(typeof renderHistChart==='function')renderHistChart();
  if(typeof renderMonthlySummary==='function')renderMonthlySummary();
  if(typeof renderSalesHistory==='function')renderSalesHistory();
  if(typeof syncCarteraToGitHub==='function')syncCarteraToGitHub();
}

// ── GESTOR DE CARTERAS (crear / renombrar / borrar) ─────────────────────────
function abrirGestorCarteras(){renderGestorCarteras();$('carteras-modal').style.display='flex';}

function renderGestorCarteras(){
  const cont=$('carteras-lista');
  if(!cont)return;
  cont.innerHTML=carteras.map(c=>{
    const n=c.assets.length;
    return `<div class="cartera-fila">
      <input type="text" value="${(c.nombre||'').replace(/"/g,'&quot;')}" data-cid="${c.id}" maxlength="24">
      <span class="cf-meta">${n} activo${n===1?'':'s'}</span>
      ${carteras.length>1?`<button onclick="borrarCartera(${c.id})" title="Borrar">🗑</button>`:''}
    </div>`;
  }).join('');
}

function agregarCartera(){
  if(carteras.length>=6){alert('Seis carteras ya son muchas para elegir de un vistazo.');return;}
  guardarNombresCarteras();
  carteras.push(nuevaCarteraVacia('Cartera '+(carteras.length+1)));
  saveAssets();renderGestorCarteras();renderSelectorCarteras();
}

function borrarCartera(id){
  const c=carteraPorId(id);
  if(!c)return;
  if(carteras.length<2){alert('Tiene que quedar al menos una cartera.');return;}
  if(c.assets.length&&!confirm(`"${c.nombre}" tiene ${c.assets.length} activo${c.assets.length===1?'':'s'}. Si la borrás se van con ella. ¿Seguro?`))return;
  guardarNombresCarteras();
  carteras=carteras.filter(x=>x.id!==id);
  if(carteraActiva===id)carteraActiva=carteras[0].id;
  assets=assetsVisibles();
  saveAssets();
  renderGestorCarteras();renderSelectorCarteras();renderCartera();
  if(typeof renderHistChart==='function')renderHistChart();
  if(typeof syncCarteraToGitHub==='function')syncCarteraToGitHub();
}

// Los nombres se escriben en inputs sueltos; esto los vuelca al modelo antes de
// cualquier operación que redibuje la lista (si no, se perderían al tipear).
function guardarNombresCarteras(){
  document.querySelectorAll('#carteras-lista input[data-cid]').forEach(inp=>{
    const c=carteraPorId(Number(inp.dataset.cid));
    const v=inp.value.trim();
    if(c&&v)c.nombre=v;
  });
}

function guardarGestorCarteras(){
  guardarNombresCarteras();
  saveAssets();
  renderSelectorCarteras();renderCartera();
  if(typeof renderHistChart==='function')renderHistChart();
  if(typeof renderMonthlySummary==='function')renderMonthlySummary();
  if(typeof syncCarteraToGitHub==='function')syncCarteraToGitHub();
  $('carteras-modal').style.display='none';
}
function saveParams(){try{const p={};Object.keys(SL).forEach(id=>{const e=$(id);if(e)p[id]=e.value;});localStorage.setItem(LS2,JSON.stringify(p));}catch(e){}}
function loadParams(){try{const r=localStorage.getItem(LS2);if(!r)return;const p=JSON.parse(r);
  // El deslizador de alquileres se llamaba "alquiler" a secas, igual que el del
  // presupuesto, y al unir las dos mitades uno tapaba al otro. Se renombró éste
  // porque es un supuesto a futuro y no un dato cargado a mano. Como el nombre
  // del elemento es también la clave con la que se guardaba el valor, sin esto
  // la fila volvía a cero en silencio.
  if(p.alquiler!=null&&p.alquilerRetiro==null){p.alquilerRetiro=p.alquiler;delete p.alquiler;
    try{localStorage.setItem(LS2,JSON.stringify(p));}catch(e){}}
  Object.entries(p).forEach(([id,v])=>{const e=$(id);if(e){const nv=parseFloat(v);if(!isNaN(nv)&&nv>parseFloat(e.max))e.max=Math.ceil(nv/50)*50;e.value=v;}});}catch(e){}}
const LS4='planRetiro_dates_v1';
function saveDates(){try{localStorage.setItem(LS4,JSON.stringify({fechaNacimiento:$('fechaNacimiento').value,fechaInicioInversion:$('fechaInicioInversion').value}));}catch(e){}}
function loadDates(){try{const r=localStorage.getItem(LS4);if(!r)return;const p=JSON.parse(r);if(p.fechaNacimiento)$('fechaNacimiento').value=p.fechaNacimiento;if(p.fechaInicioInversion)$('fechaInicioInversion').value=p.fechaInicioInversion;}catch(e){}}
const MS_YEAR=365.2425*24*3600*1000;
function computeExactAge(){
  const fn=$('fechaNacimiento').value;
  const info=$('edad-exacta-info');
  if(!fn){info.textContent='';return;}
  const birth=new Date(fn+'T00:00:00');
  const now=new Date();
  const years=(now-birth)/MS_YEAR;
  if(years<0){info.textContent='La fecha es en el futuro';return;}
  const yrs=Math.floor(years),days=Math.round((years-yrs)*365.2425);
  info.textContent=`Edad exacta: ${yrs} años y ${days} días (${years.toFixed(2)} años)`;
  const e=$('edadActual');
  const rounded=Math.round(years);
  if(e&&rounded>=parseFloat(e.min)&&rounded<=parseFloat(e.max)){
    e.value=rounded;
    const ve=$('v-edadActual');if(ve)ve.textContent=SL.edadActual.d(rounded);
  }
  updateYearsToRetirement();
}
function updateYearsToRetirement(){
  const fn=$('fechaNacimiento').value;
  const sub=$('kpi-proy-sub');
  if(!fn||!sub)return;
  const birth=new Date(fn+'T00:00:00');
  const er=gv('edadRetiro');
  const retDate=new Date(birth.getFullYear()+er,birth.getMonth(),birth.getDate());
  const now=new Date();
  const yrsReal=(retDate-now)/MS_YEAR;
  if(yrsReal>0)sub.textContent='en '+LC.nA+' años (real: '+yrsReal.toFixed(1)+' años exactos)';
}
function computeInvestingTime(){
  const fi=$('fechaInicioInversion').value;
  const info=$('tiempo-invirtiendo-info');
  if(!fi){info.textContent='';return;}
  const start=new Date(fi+'T00:00:00');
  const now=new Date();
  const years=(now-start)/MS_YEAR;
  if(years<0){info.textContent='La fecha es en el futuro';return;}
  const yrs=Math.floor(years),months=Math.floor((years-yrs)*12);
  info.textContent=`Invirtiendo hace ${yrs} años y ${months} meses`;
}
$('fechaNacimiento').addEventListener('change',()=>{computeExactAge();recalc();updateYearsToRetirement();saveDates();});
$('fechaInicioInversion').addEventListener('change',()=>{computeInvestingTime();saveDates();if(typeof renderEnCamino==='function')renderEnCamino();});
function syncCarteraToCapital(){
  const tv=assets.reduce((s,a)=>s+a.qty*a.price,0);
  if(tv<=0){alert('Tu cartera no tiene valor todavía. Cargá activos primero.');return;}
  const e=$('capitalInicial');
  if(tv>parseFloat(e.max))e.max=Math.ceil(tv/1000)*1000;
  const rv=Math.round(tv);
  e.value=rv;
  const ve=$('v-capitalInicial');if(ve)ve.textContent=SL.capitalInicial.d(rv);
  recalc();saveParams();
  alert('Capital inicial actualizado a '+fmt(tv)+' desde tu cartera.');
}
function saveSnapshot(){
  const total=assets.reduce((s,a)=>s+a.qty*a.price,0);
  const snap={date:new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}),total,count:assets.length};
  try{const s=JSON.parse(localStorage.getItem(LS3)||'[]');s.unshift(snap);if(s.length>24)s.pop();localStorage.setItem(LS3,JSON.stringify(s));renderSnaps();alert('Snapshot: '+fmt(total)+' · '+snap.date);}catch(e){}
}
function renderSnaps(){
  try{
    const s=JSON.parse(localStorage.getItem(LS3)||'[]');
    if(!s.length){$('snapshot-history').style.display='none';return;}
    $('snapshot-history').style.display='';
    $('snapshot-list').innerHTML=s.map(x=>'<div style="display:flex;justify-content:space-between;font-size:.65rem;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--muted)">'+x.date+'</span><span style="font-family:monospace;color:var(--green)">'+fmt(x.total)+'</span></div>').join('');
  }catch(e){}
}

// TABS
function switchView(v,btn){
  // btn puede no venir: la barra unificada llama a esta función sin botón, y
  // antes eso tiraba error antes de alcanzar a cambiar de vista. Si no viene,
  // se busca la pestaña que corresponde.
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
  const pestania=btn||document.querySelector(`.nav-tab[data-vista="${v}"]`);
  if(pestania)pestania.classList.add('active');
  // Acotado a la mitad de retiro: la de presupuesto tiene sus propias pantallas
  // y no hay que tocarlas desde acá.
  document.querySelectorAll('#mitad-retiro .view').forEach(x=>x.classList.remove('active'));
  $('view-'+v).classList.add('active');
  if(v==='cartera')renderCartera();
  const a=$('aside');if(a&&a.classList.contains('open'))toggleSidebar();
}
let curInner='grafico';
function switchInner(n,btn){
  curInner=n;
  document.querySelectorAll('.inner-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  ['grafico','tabla','escenarios','sensibilidad','inversa'].forEach(x=>{const e=$('inner-'+x);if(e)e.style.display='none';});
  const el=$('inner-'+n);if(el)el.style.display='flex';
  if(n==='escenarios')renderEsc();
  if(n==='sensibilidad')renderSens();
  if(n==='inversa')renderInv();
}
function toggleSidebar(){
  const a=document.querySelector('aside'),btn=$('sidebar-toggle'),open=a.classList.toggle('open');
  btn.textContent=open?'✕ Cerrar':'⚙ Params';
}

// SLIDERS
let chartMode='nominal';
function setMode(m){chartMode=m;$('btn-nominal').classList.toggle('active',m==='nominal');$('btn-real').classList.toggle('active',m==='real');recalc();}

const SL={
  edadActual:{d:v=>v+' años'},edadRetiro:{d:v=>v+' años'},vidaEsperada:{d:v=>v+' años'},
  gastoMensual:{d:v=>fmt(v)},inflacion:{d:v=>fmtPct(v)},swr:{d:v=>fmtPct(v)},
  capitalInicial:{d:v=>fmt(v)},ahorroMensual:{d:v=>fmt(v)},crecAhorro:{d:v=>fmtPct(v)},
  retorno:{d:v=>fmtPct(v)},alquilerRetiro:{d:v=>fmt(v)},dividendos:{d:v=>fmt(v)},
  consultoria:{d:v=>fmt(v)},alertaCaida:{d:v=>v+'%'},
  alertaGanancia:{d:v=>v+'%'},alertaGananciaMeses:{d:v=>v==0?'sin límite':v+' meses'}
};
const gv=id=>parseFloat($(id).value);

function adjustSlider(id,delta){
  const e=$(id);if(!e)return;
  let v=parseFloat(e.value)+delta;
  v=Math.max(parseFloat(e.min),Math.min(parseFloat(e.max),v));
  e.value=v;
  const ve=$('v-'+id);if(ve)ve.textContent=SL[id].d(v);
  recalc();saveParams();
}
Object.entries(SL).forEach(([id,cfg])=>{
  const e=$(id);if(!e)return;
  const ve=$('v-'+id);
  e.addEventListener('input',()=>{if(ve)ve.textContent=cfg.d(parseFloat(e.value));recalc();saveParams();if(id==='edadRetiro')updateYearsToRetirement();});
});

// CHARTS
// Lee los colores reales del DOM (resuelve variables CSS)
function getCSSVar(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();}

function cDef(){
  const txt=getCSSVar('--text')||'#e6edf3';
  const mut=getCSSVar('--muted')||'#7d8590';
  const surf2=getCSSVar('--surface2')||'#1c2333';
  const bord=getCSSVar('--border')||'#30363d';
  return {
    responsive:true,maintainAspectRatio:false,animation:{duration:200},
    interaction:{mode:'index',intersect:false},
    plugins:{legend:{display:false},tooltip:{
      backgroundColor:surf2,borderColor:bord,borderWidth:1,
      titleColor:mut,bodyColor:txt,padding:10,
      callbacks:{label:c=>` ${c.dataset.label}: ${fmt(c.parsed.y)}`}
    }},
    scales:{
      x:{ticks:{color:mut,font:{family:'JetBrains Mono',size:10},maxTicksLimit:18},grid:{color:'rgba(128,128,128,.12)'},border:{color:bord}},
      y:{ticks:{color:mut,font:{family:'JetBrains Mono',size:10},callback:v=>'$'+(v>=1e6?(v/1e6).toFixed(1)+'M':(v/1e3).toFixed(0)+'K')},grid:{color:'rgba(128,128,128,.12)'},border:{color:bord}}
    }
  };
}

const chart=new Chart($('chart').getContext('2d'),{type:'line',data:{labels:[],datasets:[]},options:cDef()});
const chartEsc=new Chart($('chart-escenarios').getContext('2d'),{type:'line',data:{labels:[],datasets:[]},options:cDef()});
function donutOpts(){
  const txt=getCSSVar('--text')||'#e6edf3';
  const surf2=getCSSVar('--surface2')||'#1c2333';
  const bord=getCSSVar('--border')||'#30363d';
  return {responsive:true,maintainAspectRatio:true,cutout:'72%',plugins:{legend:{display:false},tooltip:{backgroundColor:surf2,borderColor:bord,borderWidth:1,bodyColor:txt,callbacks:{label:c=>` ${c.label}: ${(typeof fmtC==='function'?fmtC:fmt)(c.parsed)}`}}}};
}
const dCat=new Chart($('donut-cat').getContext('2d'),{type:'doughnut',data:{labels:[],datasets:[{data:[],backgroundColor:[],borderWidth:0,hoverOffset:4}]},options:donutOpts()});
const dAsset=new Chart($('donut-asset').getContext('2d'),{type:'doughnut',data:{labels:[],datasets:[{data:[],backgroundColor:[],borderWidth:0,hoverOffset:4}]},options:donutOpts()});

// CALC CORE
let LC={},curMeta=0;

function recalc(){
  const ea=gv('edadActual'),er=gv('edadRetiro'),ev=gv('vidaEsperada');
  const gh=gv('gastoMensual'),inf=gv('inflacion'),swr=gv('swr');
  const ci=gv('capitalInicial'),ai=gv('ahorroMensual'),ca=gv('crecAhorro'),ret=gv('retorno');
  const ip=gv('alquilerRetiro')+gv('dividendos')+gv('consultoria');
  const nA=Math.max(1,er-ea),nR=Math.max(1,ev-er);

  const rA=[]; let cap=ci,aho=ai;
  for(let i=1;i<=nA;i++){
    const cI=cap,aA=aho*12,rend=(cI+aA/2)*ret;
    cap=cI+aA+rend;
    rA.push({n:i,e:ea+i,am:aho,aa:aA,rend,cI,cF:cap,cR:cap/Math.pow(1+inf,i),fase:'a'});
    aho*=(1+ca);
  }
  const cR=cap;
  const gA=gh*12*Math.pow(1+inf,nA),meta=gA/swr,gmR=gA/12;
  const rR=[];
  let rm=gmR,cRet=cR,eAg=null;
  for(let i=1;i<=nR;i++){
    const cI=cRet,ra=rm*12,ia=ip*12,rn=Math.max(0,ra-ia);
    const rend=(cI-rn/2)*ret;
    cRet=Math.max(0,cI+rend-rn);
    const edad=er+i;
    if(cRet===0&&eAg===null)eAg=edad;
    rR.push({n:nA+i,e:edad,rm,ra,ia,rend,cI,cF:cRet,cR:cRet/Math.pow(1+inf,nA+i),fase:'r'});
    rm*=(1+inf);
  }
  const pct=cR/meta,rReal=(1+ret)/(1+inf)-1;
  LC={ea,er,ev,gh,inf,swr,ci,ai,ca,ret,ip,nA,nR,rA,rR,cR,meta,gmR,pct,eAg,rReal};

  $('kpi-meta').textContent=fmt(meta);$('kpi-meta-sub').textContent='a los '+er+' años';
  $('kpi-proy').textContent=fmt(cR);$('kpi-proy-sub').textContent='en '+nA+' años';
  const bar=$('kpi-proy-bar');
  bar.style.width=Math.min(pct*100,100)+'%';
  bar.style.background=pct>=1?'var(--green)':pct>=0.7?'var(--orange)':'var(--red)';
  const kp=$('kpi-pct');kp.textContent=(pct*100).toFixed(1)+'%';
  kp.className='kpi-value '+(pct>=1?'green':pct>=0.75?'orange':'red');
  $('kpi-pct-sub').textContent=pct>=1?'✓ Meta alcanzada':fmt(meta-cR)+' de brecha';
  $('kpi-gasto').textContent=fmt(gmR);$('kpi-gasto-sub').textContent=fmtPct(inf)+' inflación / '+nA+' años';
  const du=$('kpi-duracion');
  if(eAg){du.textContent=eAg+' años';du.className='kpi-value red';$('kpi-duracion-sub').textContent='⚠ capital se agota';}
  else{du.textContent=ev+'+ años';du.className='kpi-value green';$('kpi-duracion-sub').textContent='✓ capital sostenible';}

  function hd(id,c){$(id).style.background=c==='green'?'var(--green)':c==='orange'?'var(--orange)':'var(--red)';}
  hd('h-ahorro-dot',ai>=500?'green':ai>=200?'orange':'red');$('h-ahorro-val').textContent=fmt(ai)+'/mes';
  hd('h-retorno-dot',rReal>=0.05?'green':rReal>=0.02?'orange':'red');$('h-retorno-val').textContent=fmtPct(rReal)+' real';
  const br=meta-cR;hd('h-brecha-dot',br<=0?'green':br<meta*0.5?'orange':'red');$('h-brecha-val').textContent=br<=0?'Sin brecha':fmt(br);
  hd('h-plan-dot',pct>=1?'green':pct>=0.7?'orange':'red');$('h-plan-val').textContent=pct>=1?'En camino ✓':pct>=0.7?'Ajustar':'Revisar';

  const lb=[],dA=[],dRet=[],dRl=[],dM=[];
  rA.forEach(r=>{lb.push(r.e);dA.push(chartMode==='nominal'?r.cF:null);dRet.push(null);dRl.push(r.cR);dM.push(meta);});
  lb.push(er);dA.push(null);dRet.push(chartMode==='nominal'?cR:null);dRl.push(cR/Math.pow(1+inf,nA));dM.push(meta);
  rR.forEach(r=>{lb.push(r.e);dA.push(null);dRet.push(chartMode==='nominal'?r.cF:null);dRl.push(r.cR);dM.push(meta);});
  chart.data.labels=lb;
  chart.data.datasets=[
    {label:'Capital acumulado',data:dA,borderColor:'#58a6ff',backgroundColor:'rgba(88,166,255,.07)',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,fill:true,tension:0.3,spanGaps:false},
    {label:'Capital en retiro',data:dRet,borderColor:'#f85149',backgroundColor:'rgba(248,81,73,.05)',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,fill:true,tension:0.3,spanGaps:false},
    {label:'Capital real (hoy)',data:dRl,borderColor:'#bc8cff',backgroundColor:'rgba(188,140,255,.05)',borderWidth:2,borderDash:[4,3],pointRadius:0,pointHoverRadius:5,fill:chartMode==='real',tension:0.3,spanGaps:true},
    {label:'Meta',data:dM,borderColor:'#3fb950',borderDash:[6,4],borderWidth:1.5,pointRadius:0,fill:false}
  ];
  chart.update();

  const tb=$('tabla-body');tb.innerHTML='';
  [...rA,...rR].forEach(r=>{
    const tr=document.createElement('tr');
    if(r.fase==='r')tr.classList.add('ret-row');
    const tag=`<span class="phase-tag ${r.fase==='a'?'tag-a':'tag-r'}">${r.fase==='a'?'ACU':'RET'}</span>`;
    let c3,c4,est;
    if(r.fase==='a'){c3=fmt(r.am);c4=fmt(r.aa);est='<span class="st-ok">↑ Acumulando</span>';}
    else{c3='<span style="color:var(--red)">'+fmt(r.rm)+'</span>';c4='<span style="color:var(--red)">'+fmt(r.ra)+'</span>';est=r.cF===0?'<span class="st-bad">⚠ Agotado</span>':r.cF<r.cI?'<span class="st-warn">↓ Bajando</span>':'<span class="st-ok">↑ Creciendo</span>';}
    tr.innerHTML=`<td>${r.n}${tag}</td><td>${r.e}</td><td>${c3}</td><td>${c4}</td><td>${fmt(r.rend)}</td><td>${fmt(r.cI)}</td><td style="font-weight:600">${fmt(r.cF)}</td><td style="color:#bc8cff;font-weight:600">${fmt(r.cR)}</td><td>${est}</td>`;
    tb.appendChild(tr);
  });

  if(curInner==='escenarios')renderEsc();
  if(curInner==='sensibilidad')renderSens();
  if(curInner==='inversa')renderInv();
  curMeta=meta;renderCartera();
  if(typeof renderEnCamino==='function')renderEnCamino();
}

function renderEsc(){
  const {ea,er,nA,ci,ai,ca,inf,meta}=LC;
  const escs=[{l:'Pesimista (6%)',r:0.06,c:'#f85149',d:[5,3]},{l:'Base ('+fmtPct(LC.ret)+')',r:LC.ret,c:'#d29922',d:[]},{l:'Optimista (12%)',r:0.12,c:'#3fb950',d:[]}];
  const lb=[];for(let i=1;i<=nA;i++)lb.push(ea+i);
  const ds=escs.map(e=>{
    const data=[];let c=ci,a=ai;
    for(let i=0;i<nA;i++){const aA=a*12;c=c+aA+(c+aA/2)*e.r;data.push(c);a*=(1+ca);}
    return {label:e.l,data,borderColor:e.c,backgroundColor:'transparent',borderWidth:2.5,borderDash:e.d,pointRadius:0,pointHoverRadius:5,fill:false,tension:0.3};
  });
  ds.push({label:'Meta',data:Array(nA).fill(meta),borderColor:'#3fb950',borderDash:[6,4],borderWidth:1.5,pointRadius:0,fill:false,backgroundColor:'transparent'});
  chartEsc.data.labels=lb;chartEsc.data.datasets=ds;chartEsc.update();
}

function renderSens(){
  const {ci,ca,nA,meta}=LC;
  const ahs=[200,300,500,700,1000,1500,2000,3000];
  const rets=[0.05,0.06,0.07,0.08,0.09,0.10,0.12,0.15];
  let h='<table class="sens-table"><thead><tr><th>↓Aho / Ret→</th>';
  rets.forEach(r=>h+=`<th>${(r*100).toFixed(0)}%</th>`);
  h+='</tr></thead><tbody>';
  ahs.forEach(a=>{
    h+=`<tr><td>$${a}</td>`;
    rets.forEach(r=>{
      let c=ci,ah=a;
      for(let i=0;i<nA;i++){const aA=ah*12;c=c+aA+(c+aA/2)*r;ah*=(1+ca);}
      const p=c/meta;
      const cl=p>=1?'sens-cell-great':p>=0.8?'sens-cell-good':p>=0.5?'sens-cell-ok':'sens-cell-bad';
      h+=`<td class="${cl}">${(p*100).toFixed(0)}%</td>`;
    });
    h+='</tr>';
  });
  h+='</tbody></table>';
  $('sens-table-wrap').innerHTML=h;
}

function renderInv(){
  const {ci,ai,ca,ret,nA,meta,cR,swr}=LC;
  function proj(a,r,n,c){let cap=c,ah=a;for(let i=0;i<n;i++){const aA=ah*12;cap=cap+aA+(cap+aA/2)*r;ah*=(1+ca);}return cap;}
  let lo=0,hi=50000;
  for(let i=0;i<60;i++){const m=(lo+hi)/2;proj(m,ret,nA,ci)<meta?lo=m:hi=m;}
  $('inv-ahorro').textContent=fmt((lo+hi)/2);
  $('inv-ahorro-sub').textContent='vs tu ahorro actual '+fmt(ai)+'/mes';
  const vfA=proj(ai,ret,nA,0),vfF=Math.pow(1+ret,nA);
  $('inv-capital').textContent=fmt(Math.max(0,(meta-vfA)/vfF));
  let c=ci,a=ai,anos=0;
  while(c<meta&&anos<100){const aA=a*12;c=c+aA+(c+aA/2)*ret;a*=(1+ca);anos++;}
  $('inv-anos').textContent=c>=meta?anos+' años':'> 100 años';
  $('inv-anos-sub').textContent=c>=meta?'Llegás a los '+(LC.ea+anos)+' años':'No llegás con los parámetros actuales';
  $('inv-retiro').textContent=fmt(cR*swr/12);
}

// CARTERA
let assets=[],assetIdCounter=0;
// `carteras` es la fuente de la verdad; `assets` es solo lo que se está viendo.
let carteras=[],carteraActiva=null;
const TODAS='__todas__';
const PAL=['#58a6ff','#3fb950','#bc8cff','#d29922','#f85149','#39d353','#79c0ff','#ffa657','#ff7b72','#a5d6ff'];
const CL={crypto:'Crypto',stock:'Acción/ETF',cash:'USD/USDT'};

function updateTickerHint(){
  const cat=$('new-cat').value;
  $('ticker-hint').style.display=(cat==='metal'||cat==='cash')?'':'none';
  if(cat==='metal')$('ticker-hint').innerHTML='Formato Twelve Data: <b>XAU/USD</b> (oro) o <b>XAG/USD</b> (plata)';
  if(cat==='cash'){$('ticker-hint').innerHTML='Usá <b>USD</b> como ticker. El precio siempre es $1.';$('new-price').value='1';$('new-cost').value='1';}
}
function addAsset(){
  const nm=$('new-name').value.trim(),tk=$('new-ticker').value.trim().toUpperCase();
  const cat=$('new-cat').value,qty=parseFloat($('new-qty').value),price=parseFloat($('new-price').value);
  const cost=parseFloat($('new-cost').value)||price;
  if(!nm||!tk||isNaN(qty)||qty<=0||isNaN(price)||price<0){alert('Completá todos los campos.');return;}
  // En la vista "Todo" no se sabría a cuál de las carteras mandarlo.
  if(carteraActiva===TODAS){alert('Elegí una cartera antes de agregar un activo — en la vista "Todo" no se sabe a cuál va.');return;}
  const existing=assets.find(a=>a.ticker===tk&&a.cat===cat);
  if(existing){
    const oldQty=existing.qty,oldCost=existing.costBasis||existing.price;
    const newQty=oldQty+qty;
    existing.costBasis=((oldQty*oldCost)+(qty*cost))/newQty;
    existing.qty=newQty;
    existing.price=price;
    if(nm)existing.name=nm;
    if(!existing.boughtDate)existing.boughtDate=new Date().toISOString().slice(0,10);
  }else{
    assets.push({id:++assetIdCounter,cId:carteraActiva,name:nm,ticker:tk,cat,qty,price,costBasis:cost,change24h:null,lastUpdate:null,boughtDate:new Date().toISOString().slice(0,10)});
  }
  saveAssets();
  ['new-name','new-ticker','new-qty','new-price','new-cost'].forEach(id=>$(id).value='');
  renderCartera();
}
function removeAsset(id){assets=assets.filter(a=>a.id!=id);saveAssets();renderCartera();}

function renderCartera(){
  const F=typeof fmtC==='function'?fmtC:fmt;
  const al=gv('alertaCaida');
  const tv=assets.reduce((s,a)=>s+a.qty*a.price,0);
  const tc=assets.reduce((s,a)=>s+a.qty*(a.costBasis||a.price),0);
  const tp=tv-tc,pp=tc>0?tp/tc:0;
  $('ck-total').textContent=F(tv);
  const pe=$('ck-pnl');
  pe.textContent=(tp>=0?'+':'')+F(tp)+' ('+fmtCh(pp*100)+')';
  pe.className='ckpi-val '+(tp>=0?'green':'red');
  const pb=$('ck-pnl-bar');pb.style.width=Math.min(Math.abs(pp)*100,100)+'%';pb.style.background=tp>=0?'var(--green)':'var(--red)';
  const w=assets.filter(a=>a.change24h!=null);
  if(w.length){
    const tY=w.reduce((s,a)=>s+a.qty*a.price/(1+a.change24h/100),0);
    const tN=w.reduce((s,a)=>s+a.qty*a.price,0);
    const ch=tY>0?(tN-tY)/tY*100:0,df=tN-tY;
    const ce=$('ck-24h');ce.textContent=(ch>=0?'+':'')+ch.toFixed(2)+'% ('+F(df)+')';ce.className='ckpi-val '+(ch>=0?'green':'red');
  }else{$('ck-24h').textContent='—';$('ck-24h').className='ckpi-val';}
  const pm=curMeta>0?tv/curMeta:0;
  $('ck-meta').textContent=(pm*100).toFixed(1)+'%';
  const mb=$('ck-meta-bar');mb.style.width=Math.min(pm*100,100)+'%';mb.style.background=pm>=1?'var(--green)':pm>=0.5?'var(--orange)':'var(--red)';
  const crs=assets.filter(a=>a.cat==='crypto'),sts=assets.filter(a=>a.cat==='stock'),mts=assets.filter(a=>a.cat==='metal'),chs=assets.filter(a=>a.cat==='cash');
  const tC=crs.reduce((s,a)=>s+a.qty*a.price,0),tS=sts.reduce((s,a)=>s+a.qty*a.price,0),tM=mts.reduce((s,a)=>s+a.qty*a.price,0),tCh=chs.reduce((s,a)=>s+a.qty*a.price,0);
  const agp=gv('alertaGanancia'),agm=gv('alertaGananciaMeses');
  rTbl('tbody-crypto',crs,tv,'cat-crypto',al,agp,agm);rTbl('tbody-stocks',sts,tv,'cat-etf',al,agp,agm);rTbl('tbody-metal',mts,tv,'cat-metal',al,agp,agm);rTbl('tbody-cash',chs,tv,'cat-cash',al,agp,agm);
  $('section-crypto').style.display=crs.length?'':'none';$('section-stocks').style.display=sts.length?'':'none';$('section-metal').style.display=mts.length?'':'none';$('section-cash').style.display=chs.length?'':'none';
  $('total-crypto').textContent=crs.length?F(tC):'';$('total-stocks').textContent=sts.length?F(tS):'';$('total-metal').textContent=mts.length?F(tM):'';$('total-cash').textContent=chs.length?F(tCh):'';
  $('pct-crypto').textContent=tv>0&&crs.length?(tC/tv*100).toFixed(1)+'%':'';
  $('pct-stocks').textContent=tv>0&&sts.length?(tS/tv*100).toFixed(1)+'%':'';
  $('pct-metal').textContent=tv>0&&mts.length?(tM/tv*100).toFixed(1)+'%':'';
  $('pct-cash').textContent=tv>0&&chs.length?(tCh/tv*100).toFixed(1)+'%':'';
  const cd=[],cc=[],cl=[];
  if(tC>0){cd.push(tC);cc.push('#58a6ff');cl.push('Crypto');}
  if(tS>0){cd.push(tS);cc.push('#3fb950');cl.push('Acciones/ETFs');}
  if(tM>0){cd.push(tM);cc.push('#f0b429');cl.push('Metales');}
  if(tCh>0){cd.push(tCh);cc.push('#39d353');cl.push('USD/USDT');}
  dCat.data.labels=cl;dCat.data.datasets[0].data=cd;dCat.data.datasets[0].backgroundColor=cc;dCat.update();
  $('donut-total-val').textContent=F(tv);
  const cleg=$('cat-legend');cleg.innerHTML='';
  cl.forEach((l,i)=>{const p=tv>0?(cd[i]/tv*100).toFixed(1)+'%':'0%';cleg.innerHTML+=`<div class="cat-leg-row"><div class="cat-leg-left"><div class="cat-dot" style="background:${cc[i]}"></div><span>${l}</span></div><span class="cat-leg-pct">${p} · ${F(cd[i])}</span></div>`;});
  const so=[...assets].sort((a,b)=>b.qty*b.price-a.qty*a.price);
  dAsset.data.labels=so.map(a=>a.ticker);dAsset.data.datasets[0].data=so.map(a=>a.qty*a.price);dAsset.data.datasets[0].backgroundColor=so.map((_,i)=>PAL[i%PAL.length]);dAsset.update();
  $('donut-asset-val').textContent=so[0]?so[0].ticker:'—';
  const aleg=$('asset-legend');aleg.innerHTML='';
  so.forEach((a,i)=>{const v=a.qty*a.price,p=tv>0?(v/tv*100).toFixed(1)+'%':'0%',c=PAL[i%PAL.length];aleg.innerHTML+=`<div class="cat-leg-row"><div class="cat-leg-left"><div class="cat-dot" style="background:${c}"></div><span>${a.ticker}</span></div><span class="cat-leg-pct">${p} · ${F(v)}</span></div>`;});
  renderSnaps();
}

function rTbl(tbId,list,tv,bc,al,agp,agm){
  const tb=$(tbId);tb.innerHTML='';
  list.forEach(a=>{
    const v=a.qty*a.price,p=tv>0?(v/tv*100).toFixed(1)+'%':'—';
    const cost=a.qty*(a.costBasis||a.price),pnl=v-cost,ppnl=cost>0?pnl/cost*100:0;
    const pc=pnl>=0?'pnl-pos':'pnl-neg';
    const cc=a.change24h==null?'change-neu':a.change24h>=0?'change-pos':'change-neg';
    const alert=a.change24h!=null&&Math.abs(a.change24h)>=al?'<span class="alert-badge">⚠'+a.change24h.toFixed(1)+'%</span>':'';
    let gainAlert='';
    if(agp!=null&&ppnl>=agp){
      let monthsHeld=null;
      if(a.boughtDate){monthsHeld=(Date.now()-new Date(a.boughtDate+'T00:00:00').getTime())/(1000*3600*24*30.44);}
      if(agm===0||monthsHeld==null||monthsHeld<=agm){
        const monthsTxt=monthsHeld!=null?' en '+Math.max(1,Math.round(monthsHeld))+'m':'';
        gainAlert='<span class="alert-badge gain-badge">🎯+'+ppnl.toFixed(0)+'%'+monthsTxt+'</span>';
      }
    }
    const ts=a.lastUpdate?'<span class="price-ts">'+a.lastUpdate+'</span>':'';
    tb.innerHTML+=`<tr>
      <td><span class="asset-name">${a.name}${alert}${gainAlert}</span><span class="asset-ticker">${a.ticker} <span class="cat-badge ${bc}">${CL[a.cat]||a.cat}</span></span></td>
      <td>${a.qty.toLocaleString('es-AR',{maximumFractionDigits:6})}</td>
      <td>${typeof fmtPrice==='function'?fmtPrice(a.price):'$'+a.price.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:6})}${ts}</td>
      <td style="font-weight:600">${typeof fmtC==='function'?fmtC(v):'$'+Math.round(v).toLocaleString('es-AR')}</td>
      <td class="${pc}">${pnl>=0?'+':''}${typeof fmtC==='function'?fmtC(pnl):fmt(pnl)}<br><span style="font-size:.6rem">${(ppnl>=0?'+':'')+ppnl.toFixed(1)}%</span></td>
      <td class="${cc}">${fmtCh(a.change24h)}</td>
      <td style="color:var(--muted)">${p}</td>
      <td style="display:flex;gap:3px;justify-content:center;align-items:center">
        ${a.cat!=='cash'?`<button class="sell-btn" onclick="openSellModal(${a.id})" title="Vender / pasar a USD">💵</button>`:''}
        <button class="edit-btn" onclick="openEditModal(${a.id})" title="Editar precio de compra / cantidad">✏</button>
        <button class="del-btn" onclick="removeAsset(${a.id})" title="Eliminar">✕</button>
      </td>
    </tr>`;
  });
}

// PRICES
const TDK='b02a61d5eb77400dba83ed33448b639d';
const GM={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',BNB:'binancecoin',XRP:'ripple',ADA:'cardano',DOGE:'dogecoin',AVAX:'avalanche-2',LINK:'chainlink',DOT:'polkadot',MATIC:'matic-network',UNI:'uniswap',ATOM:'cosmos',LTC:'litecoin',NEAR:'near',FTM:'fantom',ALGO:'algorand',SHIB:'shiba-inu',TRX:'tron',XLM:'stellar',VET:'vechain',SAND:'the-sandbox',MANA:'decentraland',AXS:'axie-infinity',AAVE:'aave',MKR:'maker'};

function setStatus(st,msg){$('status-dot').className='status-dot '+st;$('status-msg').textContent=msg;}

// ── RESOLVER EL NOMBRE INTERNO DE UNA CRIPTO ────────────────────────────────
// CoinGecko no busca por ticker sino por un id propio ("bitcoin", no "BTC").
// GM tiene los de las 26 más conocidas; para cualquier otra se probaba con el
// ticker en minúscula, que casi nunca coincide — CKB es "nervos-network", así
// que la moneda quedaba sin precio y el robot cortaba la medición.
//
// Ahora la que no está en la lista se busca sola, una vez, y se recuerda.
const LS_CG_IDS='planRetiro_cg_ids_v1';
let cgIds={};
try{cgIds=JSON.parse(localStorage.getItem(LS_CG_IDS))||{};}catch(e){cgIds={};}
function guardarCgIds(){try{localStorage.setItem(LS_CG_IDS,JSON.stringify(cgIds));}catch(e){}}

function cgIdDe(ticker){
  const t=(ticker||'').toUpperCase();
  return GM[t]||(cgIds[t]&&cgIds[t].id)||null;
}

// Devuelve {id, nombre} o null. Entre varias monedas con el mismo símbolo se
// queda con la de mayor capitalización, que es la que la gente quiere decir; el
// nombre se guarda para poder mostrar cuál eligió y que no sea a ciegas.
async function resolverCgId(ticker){
  const t=(ticker||'').toUpperCase();
  if(GM[t])return {id:GM[t],nombre:t};
  if(cgIds[t])return cgIds[t];
  try{
    const r=await fetch('https://api.coingecko.com/api/v3/search?query='+encodeURIComponent(t));
    if(!r.ok)return null;
    const d=await r.json();
    const exactas=(d.coins||[]).filter(c=>(c.symbol||'').toUpperCase()===t);
    if(!exactas.length)return null;
    exactas.sort((a,b)=>(a.market_cap_rank??1e9)-(b.market_cap_rank??1e9));
    const elegida={id:exactas[0].id,nombre:exactas[0].name};
    cgIds[t]=elegida;guardarCgIds();
    return elegida;
  }catch(e){return null;}
}

async function fetchCrypto(list){
  if(!list.length)return;
  // Antes de pedir precios hay que saber el id de cada una; las desconocidas se
  // resuelven una sola vez y después salen de la memoria.
  const desconocidas=[...new Set(list.map(a=>a.ticker.toUpperCase()).filter(t=>!cgIdDe(t)))];
  if(desconocidas.length)await Promise.all(desconocidas.map(t=>resolverCgId(t)));

  const idPorTicker={};
  list.forEach(a=>{const id=cgIdDe(a.ticker);if(id)idPorTicker[a.ticker]=id;});
  const ids=[...new Set(Object.values(idPorTicker))].join(',');
  if(!ids){list.forEach(a=>{a.lastUpdate='⚠ no encontrado';});return;}
  try{
    const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+ids+'&vs_currencies=usd&include_24hr_change=true');
    if(!r.ok)throw new Error();
    const d=await r.json();
    list.forEach(a=>{
      const id=idPorTicker[a.ticker];
      if(id&&d[id]){a.price=d[id].usd;a.change24h=d[id].usd_24h_change;a.lastUpdate=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});a.cgId=id;}
      else if(!id)a.lastUpdate='⚠ no encontrado';
    });
  }catch(e){list.forEach(a=>{if(!a.lastUpdate)a.lastUpdate='⚠ error';});}
}

async function fetchOne(a){
  const ts=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  try{
    const r=await fetch('https://api.twelvedata.com/quote?symbol='+a.ticker.toUpperCase()+'&apikey='+TDK);
    if(!r.ok)throw new Error();
    const d=await r.json();
    if(d.code||d.status==='error'){a.lastUpdate='⚠ no encontrado';return false;}
    const pr=parseFloat(d.close),pv=parseFloat(d.previous_close);
    if(!isNaN(pr)&&pr>0){a.price=pr;a.change24h=(!isNaN(pv)&&pv>0)?(pr-pv)/pv*100:null;a.lastUpdate=ts;return true;}
    a.lastUpdate='⚠ sin datos';return false;
  }catch(e){a.lastUpdate='⚠ error red';return false;}
}

async function fetchStocks(list){
  if(!list.length)return;
  const B=8;
  for(let i=0;i<list.length;i+=B){
    const g=list.slice(i,i+B);
    if(g.length===1){await fetchOne(g[0]);continue;}
    const syms=g.map(a=>a.ticker.toUpperCase()).join(',');
    const ts=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    try{
      const r=await fetch('https://api.twelvedata.com/quote?symbol='+syms+'&apikey='+TDK);
      if(!r.ok)throw new Error();
      const data=await r.json();
      g.forEach(a=>{const d=data[a.ticker.toUpperCase()]||data;if(d.code||d.status==='error'){a.lastUpdate='⚠ no encontrado';return;}const pr=parseFloat(d.close),pv=parseFloat(d.previous_close);if(!isNaN(pr)&&pr>0){a.price=pr;a.change24h=(!isNaN(pv)&&pv>0)?(pr-pv)/pv*100:null;a.lastUpdate=ts;}else{a.lastUpdate='⚠ sin datos';}});
    }catch(e){await Promise.allSettled(g.map(a=>fetchOne(a)));}
  }
}

async function refreshPrices(){
  // Se actualizan los precios de TODAS las carteras, no sólo la que estás
  // viendo: si no, al pasar a la otra te encontrarías valores viejos, y la
  // vista "Todo" sumaría una cartera con precios de ayer. El costo en llamadas
  // es el mismo — los tickers repetidos entre carteras viajan en el mismo
  // pedido y se resuelven con una sola respuesta.
  const todos=carteras.length?carteras.flatMap(c=>c.assets):assets;
  if(!todos.length){setStatus('','No hay activos.');return;}
  const btn=$('btn-refresh');btn.classList.add('loading');$('refresh-icon').textContent='⟳';
  setStatus('loading','Actualizando precios...');
  await Promise.all([fetchCrypto(todos.filter(a=>a.cat==='crypto')),fetchStocks(todos.filter(a=>a.cat==='stock'||a.cat==='metal'))]);
  renderCartera();saveAssets();btn.classList.remove('loading');
  // La portada usa el valor vivo (cantidad × precio). Los precios llegan async,
  // después del primer dibujo de Inicio, así que se la redibuja para que el
  // patrimonio quede con el precio recién traído y no con el cacheado.
  if(typeof renderInicio==='function')renderInicio();
  if(typeof renderEnCamino==='function')renderEnCamino();
  setStatus('ok','Actualizado · '+new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
}

// MODAL EDITAR
let editingId=null;
function openEditModal(id){
  const a=assets.find(x=>x.id==id);
  if(!a)return;
  editingId=id;
  const v=a.qty*a.price;
  const cost=a.qty*(a.costBasis||a.price);
  const pnl=v-cost;
  $('modal-info').innerHTML=
    '<b>'+a.name+' ('+a.ticker+')</b><br>'+
    'Precio actual: <span>$'+a.price.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:6})+'</span><br>'+
    'Cantidad actual: <span>'+a.qty.toLocaleString('es-AR',{maximumFractionDigits:6})+'</span><br>'+
    'Precio de compra actual: <span>'+(a.costBasis?'$'+a.costBasis.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:6}):'No definido')+'</span><br>'+
    'P&L actual: <span style="color:'+(pnl>=0?'var(--green)':'var(--red)')+'">'+(pnl>=0?'+':'')+fmt(pnl)+'</span>';
  $('modal-cost').value=a.costBasis||a.price;
  $('modal-qty').value=a.qty;
  $('edit-modal').style.display='flex';
  setTimeout(()=>$('modal-cost').focus(),100);
}
function closeModal(){
  $('edit-modal').style.display='none';
  $('carteras-modal').style.display='none';
  editingId=null;
}
function saveModal(){
  if(!editingId)return;
  const a=assets.find(x=>x.id===editingId);
  if(!a)return;
  const cost=parseFloat($('modal-cost').value);
  const qty=parseFloat($('modal-qty').value);
  if(!isNaN(cost)&&cost>=0)a.costBasis=cost;
  if(!isNaN(qty)&&qty>0)a.qty=qty;
  saveAssets();renderCartera();closeModal();
}
// Cerrar modal con Escape
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

// INIT
loadTheme();loadAssets();loadParams();loadDates();
Object.entries(SL).forEach(([id,cfg])=>{const e=$(id),ve=$('v-'+id);if(e&&ve)ve.textContent=cfg.d(parseFloat(e.value));});
['tabla','escenarios','sensibilidad','inversa'].forEach(n=>{const e=$('inner-'+n);if(e)e.style.display='none';});
$('inner-grafico').style.display='flex';
computeExactAge();computeInvestingTime();
recalc();renderSelectorCarteras();renderCartera();updateYearsToRetirement();
if(assets.length>0){setStatus('loading','Cargando precios actualizados...');refreshPrices();}

// SW
if('serviceWorker' in navigator){
  const sw=`const C='pr-v3';self.addEventListener('install',e=>{self.skipWaiting();});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});self.addEventListener('fetch',e=>{if(e.request.url.includes('twelvedata')||e.request.url.includes('coingecko'))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});`;
  navigator.serviceWorker.register(URL.createObjectURL(new Blob([sw],{type:'application/javascript'})),{scope:'/'}).catch(()=>{});
}
