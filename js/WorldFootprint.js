/*
 * 独立的世界州／省地图
 * 位于中国地图下方，两张地图互不影响。
 */

(function () {
  'use strict';

  const scriptURL =
    document.currentScript && document.currentScript.src;

  const assets = new URL(
    '../json/',
    scriptURL ||
      new URL('../js/WorldFootprint.js', location.href)
  );

  if (window.__travelWorldFootprint) {
    window.__travelWorldFootprint.destroy();
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

  function safeURL(raw) {
    try {
      const url = new URL(raw, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  async function getJSON(name, signal) {
    const response = await fetch(
      new URL(name, assets),
      {
        signal,
        cache:
          name === 'world-footprint.json'
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
    const container =
      document.getElementById('world-footprint');

    if (
      !container ||
      (current && current.container === container)
    ) {
      return;
    }

    if (current) {
      current.destroy();
    }

    let chart = null;
    let disposed = false;
    let started = false;
    let intersectionObserver = null;
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
            ? '#f3c668'
            : '#c99a30';

        return {
          ...point,
          name: point.id,
          displayName: point.name,

          itemStyle: {
            color,
            shadowBlur: 7,
            shadowColor: color
          }
        };
      });
    }

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

        if (intersectionObserver) {
          intersectionObserver.disconnect();
        }

        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        themeObserver.disconnect();
        lifecycle.disconnect();

        if (chart) chart.dispose();
      }
    };

    async function start() {
      if (started || disposed) return;

      started = true;

      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }

      container.textContent =
        '正在加载世界州省足迹…';

      try {
        if (!window.echarts) {
          throw new Error(
            'ECharts 加载失败，请检查网络后刷新页面。'
          );
        }

        const [data, geoJSON] = await Promise.all([
          getJSON('world-footprint.json', abort.signal),
          getJSON('world-admin1.json', abort.signal)
        ]);

        if (disposed) return;

        if (
          !Array.isArray(data) ||
          !geoJSON ||
          !Array.isArray(geoJSON.features)
        ) {
          throw new Error(
            '世界地图数据格式错误，请重新生成博客。'
          );
        }

        points = data;

        const regions = new Map(
          geoJSON.features
            .filter(feature => {
              return (
                feature.properties &&
                feature.properties.name
              );
            })
            .map(feature => [
              feature.properties.name,
              feature.properties
            ])
        );

        const pointByID = new Map(
          points.map(point => [point.id, point])
        );

        echarts.registerMap(
          'travel-world-admin1',
          geoJSON
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

              borderColor: dark
                ? '#536579'
                : '#dce5ed',

              textStyle: {
                color: dark ? '#e4ecf3' : '#263646'
              }
            },

            visualMap: {
              inRange: {
                color: dark
                  ? ['#26394a', '#62cfdf']
                  : ['#e4e9ed', '#409de1']
              }
            },

            geo: {
              itemStyle: {
                areaColor: dark
                  ? '#26394a'
                  : '#e4e9ed',

                borderColor: dark
                  ? '#7b91a0'
                  : '#ffffff',

                borderWidth: 0.3
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
                id: 'world-points',
                data: coloredPoints(),

                emphasis: {
                  label: {
                    color: dark ? '#ffffff' : '#263646'
                  }
                }
              }
            ]
          };
        }

        function tooltip(params) {
          const isPoint =
            params.seriesId === 'world-points';

          const region = regions.get(params.name);

          const point = isPoint
            ? params.data
            : pointByID.get(params.name);

          const title = isPoint
            ? point.displayName
            : region
              ? region.label
              : params.name;

          const country = region
            ? region.country
            : point
              ? point.country
              : '';

          let content =
            '<strong style="font-size:16px">' +
            esc(title || '') +
            '</strong><div>' +
            esc(country) +
            ' · ' +
            (point
              ? esc(point.description)
              : '尚未留下足迹') +
            '</div>';

          const seen = new Set();

          const posts = (
            point ? point.posts || [] : []
          ).filter(post => {
            const url = safeURL(post.url);

            if (!url || seen.has(url)) return false;

            seen.add(url);
            return true;
          });

          if (posts.length) {
            content +=
              '<div style="margin-top:9px;font-weight:600">' +
              '查看相关游记</div>';

            posts.forEach(post => {
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
              'max-width:270px;max-height:300px;' +
              'overflow:auto;white-space:normal;' +
              'line-height:1.7;border-radius:10px;',

            formatter: tooltip
          },

          visualMap: {
            show: false,
            seriesIndex: 1,
            min: 0,
            max: 1
          },

          geo: {
            map: 'travel-world-admin1',
            show: true,
            roam: true,
            zoom: 1,

            scaleLimit: {
              min: 0.8,
              max: 30
            },

            label: {
              show: false
            },

            layoutCenter: ['50%', '50%'],
            layoutSize: '94%',
            aspectScale: 1
          },

          series: [
            {
              id: 'world-points',
              name: '州省足迹',

              type: reducedMotion
                ? 'scatter'
                : 'effectScatter',

              coordinateSystem: 'geo',
              geoIndex: 0,

              data: coloredPoints(),

              symbolSize: 6,
              showEffectOn: 'render',

              rippleEffect: {
                scale: 3,
                brushType: 'stroke'
              },

              z: 5,

              emphasis: {
                label: {
                  show: true,

                  formatter: params =>
                    params.data.displayName ||
                    params.name,

                  position: 'right'
                }
              }
            },

            {
              id: 'world-regions',
              name: '到访州省',
              type: 'map',
              map: 'travel-world-admin1',
              geoIndex: 0,

              data: Array.from(regions.keys()).map(
                name => ({
                  name,
                  value: pointByID.has(name) ? 1 : 0
                })
              ),

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
            params.seriesId === 'world-points' &&
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

        chart.getZr().on('click', event => {
          if (!event.target) {
            chart.dispatchAction({
              type: 'hideTip'
            });
          }
        });

        const summary = document.getElementById(
          'world-footprint-summary'
        );

        if (summary) {
          summary.textContent =
            '走过 ' +
            new Set(
              points.map(point => point.countryCode)
            ).size +
            ' 个国家／地区 · ' +
            points.length +
            ' 个州／省';
        }

        resize();
      } catch (error) {
        if (!disposed) {
          if (chart) {
            chart.dispose();
            chart = null;
          }

          container.textContent = error.message;
          console.error('[世界足迹]', error);
        }
      }
    }

    // 世界地图滚动到附近时才加载。
    if (typeof IntersectionObserver !== 'undefined') {
      container.textContent =
        '向下浏览，加载世界州省足迹…';

      intersectionObserver = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            start();
          }
        },
        {
          rootMargin: '200px'
        }
      );

      intersectionObserver.observe(container);
    } else {
      start();
    }
  }

  const events = ['pjax:complete', 'pjax:success'];

  events.forEach(name => {
    document.addEventListener(name, mount);
  });

  window.__travelWorldFootprint = {
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