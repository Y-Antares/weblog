/*
 * source/js/Footprint.js
 * 中国地图保留原来的布局、缩放、颜色映射和交互。
 * 仅将有游记的城市光点设为红色；世界地图由独立脚本处理。
 */
(function () {
  'use strict';
  const scriptURL = document.currentScript && document.currentScript.src;
  const assetRoot = new URL('../json/', scriptURL || new URL('../js/Footprint.js', location.href));
  const previous = window.__travelFootprint;
  if (previous) previous.destroy();
  let current = null;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fullNames = {'内蒙古自治区':'内蒙古','广西壮族自治区':'广西','西藏自治区':'西藏','宁夏回族自治区':'宁夏','新疆维吾尔自治区':'新疆','香港特别行政区':'香港','澳门特别行政区':'澳门'};
  const shortName = n => fullNames[n] || n.replace(/省$|市$/, '');
  function getProvinceCounts(data) {
    const counts = {};
    data.forEach(item => { counts[item.province] = (counts[item.province] || 0) + 1; });
    return counts;
  }
  function safeURL(raw) {
    try { const url = new URL(raw, location.href); return /^https?:$/.test(url.protocol) ? url.href : ''; }
    catch (_) { return ''; }
  }
  async function getJSON(name, signal) {
    const response = await fetch(new URL(name,assetRoot), {signal,cache:name === 'footprint.json' ? 'no-cache' : 'default'});
    if (!response.ok) throw new Error(name+' 加载失败（HTTP '+response.status+'）。请检查文件位置并重新运行 hexo generate。');
    return response.json();
  }
  function mount() {
    const container = document.getElementById('footprint');
    if (!container || (current && current.container === container)) return;
    if (current) current.destroy();
    let footprintChart = null, disposed = false, points = [];
    const abort = new AbortController();
    const media = matchMedia('(prefers-color-scheme: dark)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = () => {
      const theme = document.documentElement.getAttribute('data-theme') || document.body.getAttribute('data-theme');
      return theme === 'dark' || (theme !== 'light' && media.matches);
    };
    // 数据项颜色独立设置，切换主题时也保留有游记光点的红色。
    const coloredPoints = () => points.map(point => {
      const color = ((point.posts || []).length || point.url) ? '#e65353' : dark() ? '#ffe0a0' : '#ffffff';
      return {...point,itemStyle:{color,shadowBlur:7,shadowColor:color === '#e65353' ? color : '#4583ae'}};
    });
    const resize = () => { if(footprintChart) footprintChart.resize(); };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (resizeObserver) resizeObserver.observe(container);
    window.addEventListener('resize',resize);
    let applyTheme = () => {};
    const themeObserver = new MutationObserver(() => applyTheme());
    themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    themeObserver.observe(document.body,{attributes:true,attributeFilter:['data-theme']});
    const onMediaChange = () => applyTheme();
    media.addEventListener('change',onMediaChange);
    const lifecycle = new MutationObserver(() => { if(!container.isConnected && current && current.container === container) { current.destroy(); current = null; } });
    lifecycle.observe(document.body,{childList:true,subtree:true});
    current = {container,destroy() { disposed = true; abort.abort(); window.removeEventListener('resize',resize); media.removeEventListener('change',onMediaChange); if(resizeObserver) resizeObserver.disconnect(); themeObserver.disconnect(); lifecycle.disconnect(); if(footprintChart) footprintChart.dispose(); }};
    container.textContent = '正在加载旅行足迹…';
    (async () => {
      try {
        if (!window.echarts) throw new Error('ECharts 加载失败，请检查网络后刷新页面。');
        const [pointData,china] = await Promise.all([getJSON('footprint.json',abort.signal),getJSON('china.json',abort.signal)]);
        if (disposed) return;
        if (!Array.isArray(pointData)) throw new Error('城市数据格式错误。请移除旧版手动维护的 source/json/footprint.json，再重新生成博客。');
        points = pointData;
        china.features.forEach(feature => { if(feature.properties && feature.properties.name) feature.properties.name = shortName(feature.properties.name); });
        echarts.registerMap('travel-china',china);
        const provinceCounts = getProvinceCounts(pointData);
        const provinceData = china.features.filter(f => f.properties && f.properties.name).map(f => ({name:f.properties.name,value:provinceCounts[f.properties.name] || 0}));
        const maxCount = Math.max(...Object.values(provinceCounts),1);
        container.textContent = '';
        footprintChart = echarts.init(container);
        function palette() {
          const isDark = dark();
          return {
            tooltip:{backgroundColor:isDark?'rgba(26,36,48,.97)':'rgba(255,255,255,.97)',borderColor:isDark?'#536579':'#dce5ed',textStyle:{color:isDark?'#e4ecf3':'#263646'}},
            visualMap:{inRange:{color:isDark?['#26394a','#387c99','#62cfdf']:['#e6e6e6','#a7d0ed','#5ab7fb','#409de1','#398cc0','#0e76c0']},textStyle:{color:isDark?'#dce5ed':'#526272'}},
            geo:{itemStyle:{areaColor:isDark?'#26394a':'#e6e6e6',borderColor:isDark?'#7990a2':'#ffffff',borderWidth:1},emphasis:{itemStyle:{areaColor:'#f1b03f'},label:{show:false}}},
            series:[{id:'travel-points',data:coloredPoints(),itemStyle:{color:isDark?'#ffe0a0':'#ffffff',shadowBlur:7,shadowColor:'#4583ae'}}]
          };
        }
        footprintChart.setOption({
          backgroundColor:'transparent',animation:!reducedMotion,
          tooltip:{
            trigger:'item',triggerOn:'click',enterable:true,alwaysShowContent:true,confine:true,borderWidth:1,
            extraCssText:'max-width:260px;max-height:300px;overflow:auto;white-space:normal;line-height:1.7;border-radius:10px;',
            formatter:function(params) {
              const isCity = params.seriesId === 'travel-points';
              const count = provinceCounts[params.name] || 0;
              let content = '<strong style="font-size:16px">'+esc(params.name || '')+'</strong>';
              if (!isCity) content += '<div>'+(count ? '走过 '+count+' 座城市' : '尚未留下足迹')+'</div>';
              else content += '<div>'+esc(params.data.province)+' · '+esc(params.data.description)+'</div>';
              const posts = isCity ? (params.data.posts || []) : pointData.filter(p => p.province === params.name).flatMap(p => p.posts || []);
              const seen = new Set();
              const validPosts = posts.filter(post => {const url = safeURL(post.url); if(!url || seen.has(url)) return false; seen.add(url); return true;});
              if(validPosts.length) {
                content += '<div style="margin-top:9px;font-weight:600">查看相关游记</div>';
                validPosts.forEach(post => { content += '<div><a href="'+esc(safeURL(post.url))+'" target="_blank" rel="noopener noreferrer" style="color:#2b9bc4">'+esc(post.title)+'</a></div>'; });
              }
              return content;
            }
          },
          visualMap:{show:true,seriesIndex:1,min:0,max:maxCount,left:'5%',bottom:'5%',itemWidth:12,itemHeight:100,calculable:false,precision:0,text:['走过城市数','']},
          geo:{map:'travel-china',show:true,roam:true,zoom:1.05,scaleLimit:{min:1,max:8},label:{show:false},top:20,bottom:20,left:8,right:8},
          series:[
            {id:'travel-points',name:'城市足迹',type:reducedMotion?'scatter':'effectScatter',coordinateSystem:'geo',geoIndex:0,data:coloredPoints(),showEffectOn:'render',symbolSize:8,rippleEffect:{scale:3,brushType:'stroke'},z:5,emphasis:{label:{show:true,formatter:'{b}',position:'right',color:dark()?'#ffffff':'#263646'}}},
            {id:'travel-provinces',name:'省份走过城市数',type:'map',map:'travel-china',geoIndex:0,data:provinceData,showLegendSymbol:false}
          ]
        });
        applyTheme = () => { if(footprintChart) footprintChart.setOption(palette()); };
        applyTheme();
        footprintChart.on('click',function(params) {
          if(params.seriesId === 'travel-points' && params.data.url) {const url = safeURL(params.data.url); if(url) window.open(url,'_blank','noopener,noreferrer');}
        });
        footprintChart.getZr().on('click',function(event) { if(!event.target) footprintChart.dispatchAction({type:'hideTip'}); });
        footprintChart.getZr().on('dblclick',function() { footprintChart.setOption({geo:{zoom:1.05,center:null}}); footprintChart.dispatchAction({type:'hideTip'}); });
        resize();
      } catch(error) {
        if(!disposed) { if(footprintChart) { footprintChart.dispose(); footprintChart = null; } container.textContent = error.message; console.error('[旅行足迹]',error); }
      }
    })();
  }
  const events = ['pjax:complete','pjax:success'];
  events.forEach(name => document.addEventListener(name,mount));
  window.__travelFootprint = {destroy() {events.forEach(name => document.removeEventListener(name,mount)); document.removeEventListener('DOMContentLoaded',mount); if(current) current.destroy(); current = null; }};
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
