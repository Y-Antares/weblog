/* source/js/WorldFootprint.js：独立的世界州／省地图，不修改中国地图。 */
(function () {
  'use strict';
  const src = document.currentScript && document.currentScript.src;
  const assets = new URL('../json/',src || new URL('../js/WorldFootprint.js',location.href));
  if(window.__travelWorldFootprint)window.__travelWorldFootprint.destroy();
  let current=null;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeURL(raw){try{const u=new URL(raw,location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch(_){return '';}}
  async function json(name,signal){const r=await fetch(new URL(name,assets),{signal,cache:name==='world-footprint.json'?'no-cache':'default'});if(!r.ok)throw new Error(name+' 加载失败（HTTP '+r.status+'），请检查文件位置并重新生成博客。');return r.json();}
  function mount(){
    const container=document.getElementById('world-footprint');
    if(!container||(current&&current.container===container))return;
    if(current)current.destroy();
    let chart=null,disposed=false,started=false,io=null,points=[];
    const abort=new AbortController(),media=matchMedia('(prefers-color-scheme: dark)');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark=()=>{const t=document.documentElement.getAttribute('data-theme')||document.body.getAttribute('data-theme');return t==='dark'||(t!=='light'&&media.matches);};
    const coloredPoints=()=>points.map(p=>{const color=(p.posts||[]).length||p.url?'#e65353':dark()?'#f3c668':'#c99a30';return{...p,name:p.id,displayName:p.name,itemStyle:{color,shadowBlur:7,shadowColor:color}};});
    const resize=()=>{if(chart)chart.resize();};window.addEventListener('resize',resize);
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;if(ro)ro.observe(container);
    let applyTheme=()=>{};const theme=()=>applyTheme();
    const mo=new MutationObserver(theme);mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});mo.observe(document.body,{attributes:true,attributeFilter:['data-theme']});media.addEventListener('change',theme);
    const lifecycle=new MutationObserver(()=>{if(!container.isConnected&&current&&current.container===container){current.destroy();current=null;}});lifecycle.observe(document.body,{childList:true,subtree:true});
    current={container,destroy(){disposed=true;abort.abort();window.removeEventListener('resize',resize);media.removeEventListener('change',theme);if(io)io.disconnect();if(ro)ro.disconnect();mo.disconnect();lifecycle.disconnect();if(chart)chart.dispose();}};
    async function start(){
      if(started||disposed)return;started=true;if(io)io.disconnect();container.textContent='正在加载世界州省足迹…';
      try{
        if(!window.echarts)throw new Error('ECharts 加载失败，请检查网络后刷新页面。');
        const[data,geo]=await Promise.all([json('world-footprint.json',abort.signal),json('world-admin1.json',abort.signal)]);if(disposed)return;
        if(!Array.isArray(data)||!geo||!Array.isArray(geo.features))throw new Error('世界地图数据格式错误，请重新生成博客。');
        points=data;
        const regions=new Map(geo.features.filter(f=>f.properties&&f.properties.name).map(f=>[f.properties.name,f.properties]));
        const pointByID=new Map(points.map(p=>[p.id,p]));
        echarts.registerMap('travel-world-admin1',geo);container.textContent='';chart=echarts.init(container);
        function palette(){const isDark=dark();return{
          tooltip:{backgroundColor:isDark?'rgba(26,36,48,.97)':'rgba(255,255,255,.97)',borderColor:isDark?'#536579':'#dce5ed',textStyle:{color:isDark?'#e4ecf3':'#263646'}},
          visualMap:{inRange:{color:isDark?['#26394a','#62cfdf']:['#e4e9ed','#409de1']}},
          geo:{itemStyle:{areaColor:isDark?'#26394a':'#e4e9ed',borderColor:isDark?'#7b91a0':'#ffffff',borderWidth:.3},emphasis:{itemStyle:{areaColor:'#f1b03f'},label:{show:false}}},
          series:[{id:'world-points',data:coloredPoints(),emphasis:{label:{color:isDark?'#fff':'#263646'}}}]
        };}
        function tooltip(params){
          const isPoint=params.seriesId==='world-points',region=regions.get(params.name),point=isPoint?params.data:pointByID.get(params.name);
          const title=isPoint?point.displayName:region?region.label:params.name;
          const country=region?region.country:point?point.country:'';
          let text='<strong style="font-size:16px">'+esc(title||'')+'</strong><div>'+esc(country)+' · '+(point?esc(point.description):'尚未留下足迹')+'</div>';
          const seen=new Set(),posts=(point?(point.posts||[]):[]).filter(p=>{const u=safeURL(p.url);if(!u||seen.has(u))return false;seen.add(u);return true;});
          if(posts.length){text+='<div style="margin-top:9px;font-weight:600">查看相关游记</div>';posts.forEach(p=>{text+='<div><a href="'+esc(safeURL(p.url))+'" target="_blank" rel="noopener noreferrer" style="color:#2b9bc4">'+esc(p.title)+'</a></div>';});}return text;
        }
        chart.setOption({
          backgroundColor:'transparent',animation:!reduced,
          tooltip:{trigger:'item',triggerOn:'click',enterable:true,alwaysShowContent:true,confine:true,borderWidth:1,extraCssText:'max-width:270px;max-height:300px;overflow:auto;white-space:normal;line-height:1.7;border-radius:10px;',formatter:tooltip},
          visualMap:{show:false,seriesIndex:1,min:0,max:1},
          geo:{map:'travel-world-admin1',show:true,roam:true,zoom:1,scaleLimit:{min:.8,max:30},label:{show:false},top:20,bottom:20,left:8,right:8,aspectScale:.82},
          series:[
            {id:'world-points',name:'州省足迹',type:reduced?'scatter':'effectScatter',coordinateSystem:'geo',geoIndex:0,data:coloredPoints(),symbolSize:6,showEffectOn:'render',rippleEffect:{scale:3,brushType:'stroke'},z:5,emphasis:{label:{show:true,formatter:p=>p.data.displayName||p.name,position:'right'}}},
            {id:'world-regions',name:'到访州省',type:'map',map:'travel-world-admin1',geoIndex:0,data:Array.from(regions.keys()).map(name=>({name,value:pointByID.has(name)?1:0})),showLegendSymbol:false}
          ]
        });
        applyTheme=()=>{if(chart)chart.setOption(palette());};applyTheme();
        chart.on('click',params=>{if(params.seriesId==='world-points'&&params.data.url){const u=safeURL(params.data.url);if(u)window.open(u,'_blank','noopener,noreferrer');}});
        chart.getZr().on('dblclick',()=>{chart.setOption({geo:{zoom:1,center:null}});chart.dispatchAction({type:'hideTip'});});
        chart.getZr().on('click',e=>{if(!e.target)chart.dispatchAction({type:'hideTip'});});
        const summary=document.getElementById('world-footprint-summary');if(summary)summary.textContent='走过 '+new Set(points.map(p=>p.countryCode)).size+' 个国家／地区 · '+points.length+' 个州／省';
        resize();
      }catch(error){if(!disposed){if(chart){chart.dispose();chart=null;}container.textContent=error.message;console.error('[世界足迹]',error);}}
    }
    // 滚动到世界地图附近才加载它的边界，不影响上方中国地图。
    if(typeof IntersectionObserver!=='undefined'){
      container.textContent='向下浏览，加载世界州省足迹…';
      io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))start();},{rootMargin:'200px'});io.observe(container);
    }else start();
  }
  const events=['pjax:complete','pjax:success'];events.forEach(name=>document.addEventListener(name,mount));
  window.__travelWorldFootprint={destroy(){events.forEach(name=>document.removeEventListener(name,mount));document.removeEventListener('DOMContentLoaded',mount);if(current)current.destroy();current=null;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
