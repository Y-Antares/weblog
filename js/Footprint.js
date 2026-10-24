/* source/js/Footprint.js：国内城市足迹 + 世界州省足迹 */
(function () {
  'use strict';
  const src = document.currentScript && document.currentScript.src;
  const assets = new URL('../json/',src || new URL('../js/Footprint.js',location.href));
  if(window.__travelFootprint) window.__travelFootprint.destroy();
  let current = null;
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const aliases = {'内蒙古自治区':'内蒙古','广西壮族自治区':'广西','西藏自治区':'西藏','宁夏回族自治区':'宁夏','新疆维吾尔自治区':'新疆','香港特别行政区':'香港','澳门特别行政区':'澳门'};
  const shortName = n => aliases[n] || n.replace(/省$|市$/,'');
  const hasPosts = point => (point.posts && point.posts.length > 0) || !!point.url;
  function safeURL(raw) { try {const u = new URL(raw,location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch(_){return '';} }
  async function json(name,signal) {
    const response = await fetch(new URL(name,assets),{signal,cache:name.includes('footprint')?'no-cache':'default'});
    if(!response.ok) throw new Error(name+' 加载失败（HTTP '+response.status+'），请检查文件位置并重新生成博客。');
    return response.json();
  }
  function mount() {
    const container = document.getElementById('footprint');
    if(!container || (current && current.container === container)) return;
    if(current) current.destroy();
    const abort = new AbortController(), media = matchMedia('(prefers-color-scheme: dark)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let chart = null, disposed = false, sequence = 0, activeMode = 'china', dataset = null;
    const cache = new Map();
    container.textContent = '';
    container.style.position = 'relative';
    const host = document.createElement('div');
    host.style.cssText = 'width:100%;height:100%;';
    const status = document.createElement('div');
    status.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-size:13px;line-height:1.8;background:var(--background,rgba(248,250,252,.92));z-index:3;';
    container.append(host,status);
    const tools = document.createElement('div');
    tools.className = 'travel-map-tools';
    tools.innerHTML = '<style>.travel-map-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0;font-size:12px}.travel-map-tools button{font:inherit;cursor:pointer;border:1px solid rgba(130,150,165,.3);border-radius:8px;padding:7px 13px;background:transparent;color:inherit}.travel-map-tools button[aria-selected="true"]{background:rgba(52,148,188,.13);border-color:#5aa9c5;color:#2c94b5}.travel-map-tools .travel-summary{margin-left:auto;opacity:.65}.travel-map-tools .travel-legend{display:flex;gap:12px;align-items:center}.travel-map-tools .travel-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px}.travel-map-tools .travel-credit{flex-basis:100%;text-align:right;font-size:10px;opacity:.55}.travel-map-tools .travel-credit a{color:inherit}@media(max-width:550px){.travel-map-tools .travel-summary{margin-left:0;flex-basis:100%}}</style><span role="tablist" aria-label="地图范围"><button type="button" role="tab" data-map="china" aria-selected="true">中国</button> <button type="button" role="tab" data-map="world" aria-selected="false">世界 · 州／省</button></span><span class="travel-legend"><span><i class="travel-dot" style="background:#e65353"></i>有游记</span><span><i class="travel-dot" style="background:#c99a30"></i>暂无游记</span></span><span class="travel-summary" aria-live="polite"></span><span class="travel-credit" hidden>世界州省底图：<a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer">geoBoundaries</a>（CC BY 4.0） · 名称及意大利大区：Natural Earth · 中国省界：DataV；边界已简化</span>';
    container.before(tools);
    const buttons = tools.querySelectorAll('[data-map]');
    const summary = tools.querySelector('.travel-summary');
    const credit = tools.querySelector('.travel-credit');
    function dark() {const value=document.documentElement.getAttribute('data-theme')||document.body.getAttribute('data-theme');return value==='dark'||(value!=='light'&&media.matches);}
    function pointData() {
      return dataset.points.map(point=>{
        // 每个数据项设置颜色，主题切换也不会把有游记的红点覆盖。
        const color = hasPosts(point) ? '#e65353' : dark() ? '#f3c668' : '#c99a30';
        return {...point,name:activeMode==='world'?point.id:point.name,displayName:point.name,itemStyle:{color,shadowBlur:7,shadowColor:color}};
      });
    }
    function palette() {
      const isDark=dark();
      return {
        tooltip:{backgroundColor:isDark?'rgba(26,36,48,.97)':'rgba(255,255,255,.97)',borderColor:isDark?'#536579':'#dce5ed',textStyle:{color:isDark?'#e4ecf3':'#263646'}},
        visualMap:{inRange:{color:isDark?['#26394a','#387c99','#62cfdf']:['#e4e9ed','#a7d0ed','#5ab7fb','#409de1','#398cc0','#0e76c0']},textStyle:{color:isDark?'#dce5ed':'#526272'}},
        geo:{itemStyle:{areaColor:isDark?'#26394a':'#e4e9ed',borderColor:isDark?'#7b91a0':'#fff',borderWidth:activeMode==='world'?.3:1},emphasis:{itemStyle:{areaColor:'#f1b03f'},label:{show:false}}},
        series:[{id:'travel-points',data:pointData(),emphasis:{label:{color:isDark?'#fff':'#263646'}}}]
      };
    }
    function tooltip(params) {
      const isPoint=params.seriesId==='travel-points';
      const key=params.name;
      const region=dataset.regions.get(key);
      const point=isPoint?params.data:dataset.pointByRegion.get(key);
      const title=isPoint?(point.displayName||point.name):region?region.label:key;
      let text='<strong style="font-size:16px">'+esc(title||'')+'</strong>';
      if(activeMode==='china') {
        const count=dataset.counts[key]||0;
        text+='<div>'+(isPoint?esc(point.province)+' · '+esc(point.description):count?'走过 '+count+' 座城市':'尚未留下足迹')+'</div>';
      }else {
        text+='<div>'+esc(region?region.country:point?point.country:'')+' · '+(point?esc(point.description):'尚未留下足迹')+'</div>';
      }
      const posts=isPoint?(point.posts||[]):activeMode==='china'?dataset.points.filter(p=>p.province===key).flatMap(p=>p.posts||[]):point?(point.posts||[]):[];
      const seen=new Set();
      const valid=posts.filter(p=>{const url=safeURL(p.url);if(!url||seen.has(url))return false;seen.add(url);return true;});
      if(valid.length){text+='<div style="margin-top:9px;font-weight:600">查看相关游记</div>';valid.forEach(p=>{text+='<div><a href="'+esc(safeURL(p.url))+'" target="_blank" rel="noopener noreferrer" style="color:#2b9bc4">'+esc(p.title)+'</a></div>';});}
      return text;
    }
    function load(mode) {
      if(cache.has(mode))return cache.get(mode);
      const promise=(async()=>{
        const world=mode==='world';
        const [points,geo]=await Promise.all([json(world?'world-footprint.json':'footprint.json',abort.signal),json(world?'world-admin1.json':'china.json',abort.signal)]);
        if(!Array.isArray(points)||!geo||!Array.isArray(geo.features))throw new Error('地图数据格式不正确，请重新生成博客。');
        const regions=new Map(),counts={},pointByRegion=new Map();
        geo.features.forEach(f=>{if(!f.properties)return;if(!world&&f.properties.name)f.properties.name=shortName(f.properties.name);const p=f.properties;if(p.name)regions.set(p.name,{label:world?p.label:p.name,country:p.country||''});});
        points.forEach(p=>{const key=world?p.id:p.province;counts[key]=(counts[key]||0)+1;if(world)pointByRegion.set(key,p);});
        return {points,geo,regions,counts,pointByRegion};
      })().catch(error=>{cache.delete(mode);throw error;});
      cache.set(mode,promise);return promise;
    }
    async function switchMap(mode) {
      const ticket=++sequence;status.hidden=false;status.textContent=mode==='world'?'正在展开世界州省地图…':'正在加载中国足迹…';host.style.visibility='hidden';
      try {
        if(!window.echarts)throw new Error('ECharts 加载失败，请检查网络后刷新页面。');
        const next=await load(mode);if(disposed||ticket!==sequence)return;
        activeMode=mode;dataset=next;
        const world=mode==='world', mapName=world?'travel-world-admin1':'travel-china';
        echarts.registerMap(mapName,dataset.geo);
        if(!chart){chart=echarts.init(host);chart.on('click',params=>{if(params.seriesId==='travel-points'&&params.data.url){const url=safeURL(params.data.url);if(url)window.open(url,'_blank','noopener,noreferrer');}});chart.getZr().on('dblclick',()=>{chart.setOption({geo:{zoom:activeMode==='world'?1:1.02,center:null}});chart.dispatchAction({type:'hideTip'});});chart.getZr().on('click',e=>{if(!e.target)chart.dispatchAction({type:'hideTip'});});}
        const areaData=Array.from(dataset.regions.keys()).map(name=>({name,value:world?(dataset.counts[name]?1:0):dataset.counts[name]||0}));
        chart.setOption({
          backgroundColor:'transparent',animation:!reduced,
          tooltip:{trigger:'item',triggerOn:'click',enterable:true,alwaysShowContent:true,confine:true,borderWidth:1,extraCssText:'max-width:270px;max-height:300px;overflow:auto;white-space:normal;line-height:1.7;border-radius:10px;',formatter:tooltip},
          visualMap:{show:!world,seriesIndex:1,min:0,max:world?1:Math.max(...Object.values(dataset.counts),1),left:'5%',bottom:'5%',itemWidth:12,itemHeight:95,calculable:false,precision:0,text:['走过城市数','']},
          geo:{map:mapName,roam:true,zoom:world?1:1.02,scaleLimit:{min:.8,max:world?30:8},label:{show:false},top:20,bottom:20,left:8,right:8,aspectScale:world?.82:.75},
          series:[
            {id:'travel-points',name:world?'州省足迹':'城市足迹',type:reduced?'scatter':'effectScatter',coordinateSystem:'geo',geoIndex:0,data:pointData(),symbolSize:world?6:8,showEffectOn:'render',rippleEffect:{scale:3,brushType:'stroke'},z:5,emphasis:{label:{show:true,formatter:p=>p.data.displayName||p.name,position:'right'}}},
            {id:'travel-regions',name:world?'到访州省':'省份走过城市数',type:'map',map:mapName,geoIndex:0,data:areaData,showLegendSymbol:false}
          ]
        },true);
        chart.setOption(palette());
        buttons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.map===mode)));
        summary.textContent=world?'走过 '+new Set(dataset.points.map(p=>p.countryCode)).size+' 个国家／地区 · '+dataset.points.length+' 个州／省':'走过 '+Object.keys(dataset.counts).length+' 个省级地区 · '+dataset.points.length+' 个城市／县区';
        credit.hidden=!world;status.hidden=true;host.style.visibility='visible';chart.resize();
      }catch(error){if(!disposed&&ticket===sequence){status.textContent=error.message+' 可再次点击地图按钮重试。';console.error('[旅行足迹]',error);}}
    }
    buttons.forEach(button=>button.addEventListener('click',()=>switchMap(button.dataset.map),{signal:abort.signal}));
    const resize=()=>{if(chart)chart.resize();};window.addEventListener('resize',resize,{signal:abort.signal});
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;if(ro)ro.observe(container);
    const theme=()=>{if(chart&&dataset)chart.setOption(palette());};
    const mo=new MutationObserver(theme);mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});mo.observe(document.body,{attributes:true,attributeFilter:['data-theme']});media.addEventListener('change',theme);
    const lifecycle=new MutationObserver(()=>{if(!container.isConnected&&current&&current.container===container){current.destroy();current=null;}});lifecycle.observe(document.body,{childList:true,subtree:true});
    current={container,destroy(){disposed=true;abort.abort();if(ro)ro.disconnect();mo.disconnect();lifecycle.disconnect();media.removeEventListener('change',theme);if(chart)chart.dispose();tools.remove();}};
    switchMap('china');
  }
  const events=['pjax:complete','pjax:success'];events.forEach(name=>document.addEventListener(name,mount));
  window.__travelFootprint={destroy(){events.forEach(name=>document.removeEventListener(name,mount));document.removeEventListener('DOMContentLoaded',mount);if(current)current.destroy();current=null;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
