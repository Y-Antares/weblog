/*
 * 中国足迹地图
 * 自动使用 Stellar 右栏空间，地图保持等比缩放。
 */

(function () {
  'use strict';

  const scriptURL =
    document.currentScript && document.currentScript.src;

  const assetRoot = new URL(
    '../json/',
    scriptURL || new URL('../js/Footprint.js', location.href)
  );

  if (window.__travelFootprint) {
    window.__travelFootprint.destroy();
  }

  let current = null;

  const esc = value =>
    String(value).replace(
      /[&<>"']/g,
      c =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[c]
    );

  const provinceAliases = {
    内蒙古自治区: '内蒙古',
    广西壮族自治区: '广西',
    西藏自治区: '西藏',
    宁夏回族自治区: '宁夏',
    新疆维吾尔自治区: '新疆',
    香港特别行政区: '香港',
    澳门特别行政区: '澳门'
  };

  function shortName(name) {
    return (
      provinceAliases[name] ||
      name.replace(/省$|市$/, '')
    );
  }

  function safeURL(raw) {
    try {
      const url = new URL(raw, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function installLayoutStyle() {
    if (document.getElementById('footprint-page-layout')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'footprint-page-layout';

    style.textContent = `
      /* 仅地图页主栏延伸到右栏，保留左侧导航。 */
      .l_body:has(#footprint) > .l_main {
        grid-column: 2 / 4;
        min-width: 0;
        width: auto;
        max-width: none;
        margin-right: calc(var(--gap-margin, 16px) * 2);
      }

      .l_body:has(#footprint) > .l_right,
      .l_body:has(#footprint) .float-panel .rightbar-toggle {
        display: none !important;
      }

      /* 覆盖之前 index.md 中内联的固定高度。 */
      #footprint,
      #world-footprint {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        border-radius: 16px;
        overflow: hidden;
      }

      #footprint {
        aspect-ratio: 1.35;
        min-height: 340px !important;
        max-height: 780px;
      }

      #world-footprint {
        aspect-ratio: 2.2;
        min-height: 280px !important;
        max-height: 660px;
      }

      @media (max-width: 667px) {
        .l_body:has(#footprint) > .l_main {
          margin-right: 0;
        }

        #footprint {
          min-height: 360px !important;
        }

        #world-footprint {
          min-height: 300px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function getJSON(name, signal) {
    const response = await fetch(
      new URL(name, assetRoot),
      {
        signal,
        cache:
          name === 'footprint.json'
            ? 'no-cache'
            : 'default'
      }
    );

    if (!response.ok) {
      throw new Error(
        name +
          ' 加载失败（HTTP ' +
          response.status +
          '），请检查文件位置并重新生成博客。'
      );
    }

    return response.json();
  }

  function mount() {
    const container = document.getElementById('footprint');

    if (
      !container ||
      (current && current.container === container)
    ) {
      return;
    }

    if (current) {
      current.destroy();
    }

    installLayoutStyle();

    let chart = null;
    let disposed = false;
    let points = [];

    const abort = new AbortController();

    const media = matchMedia(
      '(prefers-color-scheme: dark)'
    );

    const reducedMotion = matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    function isDark() {
      const theme =
        document.documentElement.getAttribute('data-theme') ||
        document.body.getAttribute('data-theme');

      return (
        theme === 'dark' ||
        (theme !== 'light' && media.matches)
      );
    }

    function coloredPoints() {
      return points.map(point => {
        const hasPosts =
          (point.posts || []).length > 0 ||
          !!point.url;

        const color = hasPosts
          ? '#e65353'
          : isDark()
            ? '#ffe0a0'
            : '#ffffff';

        return {
          ...point,
          itemStyle: {
            color,
            shadowBlur: 7,
            shadowColor: hasPosts
              ? '#e65353'
              : '#4583ae'
          }
        };
      });
    }

    /*
     * 按底图坐标的原始宽高比适配画布。
     * 不通过四边位置强行拉满。
     */
    function resize() {
      if (!chart) return;

      chart.resize();

      const geo = chart.getModel().getComponent('geo');

      if (!geo || !geo.coordinateSystem) return;

      const bounds =
        geo.coordinateSystem.getBoundingRect();

      const ratio = bounds.width / bounds.height;
      const width = chart.getWidth() * 0.94;
      const height = chart.getHeight() * 0.94;

      const size =
        ratio >= 1
          ? Math.min(width, height * ratio)
          : Math.min(height, width / ratio);

      if (Number.isFinite(size) && size > 0) {
        chart.setOption({
          geo: {
            layoutSize: size
          }
        });
      }
    }

    window.addEventListener('resize', resize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null;

    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    let applyTheme = function () {};

    function themeChange() {
      applyTheme();
    }

    const themeObserver =
      new MutationObserver(themeChange);

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    media.addEventListener('change', themeChange);

    const lifecycle = new MutationObserver(() => {
      if (
        !container.isConnected &&
        current &&
        current.container === container
      ) {
        current.destroy();
        current = null;
      }
    });

    lifecycle.observe(document.body, {
      childList: true,
      subtree: true
    });

    current = {
      container,

      destroy() {
        disposed = true;
        abort.abort();

        window.removeEventListener('resize', resize);
        media.removeEventListener('change', themeChange);

        if (resizeObserver) resizeObserver.disconnect();

        themeObserver.disconnect();
        lifecycle.disconnect();

        if (chart) chart.dispose();
      }
    };

    container.textContent = '正在加载旅行足迹…';

    (async function () {
      try {
        if (!window.echarts) {
          throw new Error(
            'ECharts 加载失败，请检查网络后刷新页面。'
          );
        }

        const [pointData, china] = await Promise.all([
          getJSON('footprint.json', abort.signal),
          getJSON('china.json', abort.signal)
        ]);

        if (disposed) return;

        if (!Array.isArray(pointData)) {
          throw new Error(
            '城市数据格式错误，请重新生成博客。'
          );
        }

        points = pointData;

        china.features.forEach(feature => {
          if (
            feature.properties &&
            feature.properties.name
          ) {
            feature.properties.name = shortName(
              feature.properties.name
            );
          }
        });

        echarts.registerMap('travel-china', china);

        const provinceCounts = {};

        points.forEach(point => {
          provinceCounts[point.province] =
            (provinceCounts[point.province] || 0) + 1;
        });

        const provinceData = china.features
          .filter(feature => {
            return (
              feature.properties &&
              feature.properties.name
            );
          })
          .map(feature => ({
            name: feature.properties.name,
            value:
              provinceCounts[feature.properties.name] || 0
          }));

        const maxCount = Math.max(
          ...Object.values(provinceCounts),
          1
        );

        container.textContent = '';
        chart = echarts.init(container);

        function palette() {
          const dark = isDark();

          return {
            tooltip: {
              backgroundColor: dark
                ? 'rgba(26,36,48,.97)'
                : 'rgba(255,255,255,.97)',
              borderColor: dark ? '#536579' : '#dce5ed',
              textStyle: {
                color: dark ? '#e4ecf3' : '#263646'
              }
            },

            visualMap: {
              inRange: {
                color: dark
                  ? ['#26394a', '#387c99', '#62cfdf']
                  : [
                      '#e6e6e6',
                      '#a7d0ed',
                      '#5ab7fb',
                      '#409de1',
                      '#398cc0',
                      '#0e76c0'
                    ]
              },
              textStyle: {
                color: dark ? '#dce5ed' : '#526272'
              }
            },

            geo: {
              itemStyle: {
                areaColor: dark ? '#26394a' : '#e6e6e6',
                borderColor: dark ? '#7990a2' : '#ffffff',
                borderWidth: 1
              },
              emphasis: {
                itemStyle: {
                  areaColor: '#f1b03f'
                },
                label: {
                  show: false
                }
              }
            },

            series: [
              {
                id: 'travel-points',
                data: coloredPoints()
              }
            ]
          };
        }

        function tooltip(params) {
          const isCity =
            params.seriesId === 'travel-points';

          const count =
            provinceCounts[params.name] || 0;

          let content =
            '<strong style="font-size:16px">' +
            esc(params.name || '') +
            '</strong>';

          if (isCity) {
            content +=
              '<div>' +
              esc(params.data.province) +
              ' · ' +
              esc(params.data.description) +
              '</div>';
          } else {
            content +=
              '<div>' +
              (count
                ? '走过 ' + count + ' 座城市'
                : '尚未留下足迹') +
              '</div>';
          }

          const posts = isCity
            ? params.data.posts || []
            : points
                .filter(point => {
                  return point.province === params.name;
                })
                .flatMap(point => point.posts || []);

          const seen = new Set();

          const validPosts = posts.filter(post => {
            const url = safeURL(post.url);

            if (!url || seen.has(url)) return false;

            seen.add(url);
            return true;
          });

          if (validPosts.length) {
            content +=
              '<div style="margin-top:9px;font-weight:600">' +
              '查看相关游记</div>';

            validPosts.forEach(post => {
              content +=
                '<div><a href="' +
                esc(safeURL(post.url)) +
                '" target="_blank"' +
                ' rel="noopener noreferrer"' +
                ' style="color:#2b9bc4">' +
                esc(post.title) +
                '</a></div>';
            });
          }

          return content;
        }

        chart.setOption({
          backgroundColor: 'transparent',
          animation: !reducedMotion,

          tooltip: {
            trigger: 'item',
            triggerOn: 'click',
            enterable: true,
            alwaysShowContent: true,
            confine: true,
            borderWidth: 1,
            extraCssText:
              'max-width:260px;max-height:300px;' +
              'overflow:auto;white-space:normal;' +
              'line-height:1.7;border-radius:10px;',
            formatter: tooltip
          },

          visualMap: {
            show: true,
            seriesIndex: 1,
            min: 0,
            max: maxCount,
            left: '5%',
            bottom: '5%',
            itemWidth: 12,
            itemHeight: 100,
            calculable: false,
            precision: 0,
            text: ['走过城市数', '']
          },

          geo: {
            map: 'travel-china',
            show: true,
            roam: true,
            zoom: 1,

            scaleLimit: {
              min: 0.8,
              max: 8
            },

            label: {
              show: false
            },

            layoutCenter: ['50%', '50%'],
            layoutSize: '92%',

            // 横纵方向采用相同缩放倍率。
            aspectScale: 1
          },

          series: [
            {
              id: 'travel-points',
              name: '城市足迹',

              type: reducedMotion
                ? 'scatter'
                : 'effectScatter',

              coordinateSystem: 'geo',
              geoIndex: 0,
              data: coloredPoints(),

              showEffectOn: 'render',
              symbolSize: 8,

              rippleEffect: {
                scale: 3,
                brushType: 'stroke'
              },

              z: 5,

              emphasis: {
                label: {
                  show: true,
                  formatter: '{b}',
                  position: 'right',
                  color: isDark() ? '#ffffff' : '#263646'
                }
              }
            },

            {
              id: 'travel-provinces',
              name: '省份走过城市数',
              type: 'map',
              map: 'travel-china',
              geoIndex: 0,
              data: provinceData,
              showLegendSymbol: false
            }
          ]
        });

        applyTheme = function () {
          if (chart) chart.setOption(palette());
        };

        applyTheme();

        chart.on('click', params => {
          if (
            params.seriesId === 'travel-points' &&
            params.data.url
          ) {
            const url = safeURL(params.data.url);

            if (url) {
              window.open(
                url,
                '_blank',
                'noopener,noreferrer'
              );
            }
          }
        });

        chart.getZr().on('click', event => {
          if (!event.target) {
            chart.dispatchAction({
              type: 'hideTip'
            });
          }
        });

        chart.getZr().on('dblclick', () => {
          chart.setOption({
            geo: {
              zoom: 1,
              center: null
            }
          });

          chart.dispatchAction({
            type: 'hideTip'
          });
        });

        resize();
      } catch (error) {
        if (!disposed) {
          if (chart) {
            chart.dispose();
            chart = null;
          }

          container.textContent = error.message;
          console.error('[旅行足迹]', error);
        }
      }
    })();
  }

  const events = ['pjax:complete', 'pjax:success'];

  events.forEach(name => {
    document.addEventListener(name, mount);
  });

  window.__travelFootprint = {
    destroy() {
      events.forEach(name => {
        document.removeEventListener(name, mount);
      });

      document.removeEventListener(
        'DOMContentLoaded',
        mount
      );

      if (current) current.destroy();
      current = null;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      mount,
      { once: true }
    );
  } else {
    mount();
  }
})();