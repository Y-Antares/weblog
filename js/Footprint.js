/*
 * 文件位置：source/js/Footprint.js
 *
 * 自动读取：
 * source/json/china.json
 * 自动生成的 /json/footprint.json
 *
 * 日常不要在此文件填写城市。
 */

(function () {
  'use strict';

  const scriptURL =
    document.currentScript &&
    document.currentScript.src;

  const assetRoot = new URL(
    '../json/',
    scriptURL ||
      new URL('../js/Footprint.js', location.href)
  );

  const previous = window.__travelFootprint;

  if (previous) {
    previous.destroy();
  }

  let current = null;

  function escapeHTML(value) {
    return String(value).replace(
      /[&<>"']/g,
      character => {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[character];
      }
    );
  }

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

  /*
   * 与参考文章一样：
   * 每个城市对所属省份贡献一个计数。
   *
   * 南京、苏州 → 江苏：2
   */
  function getProvinceCounts(data) {
    const counts = {};

    data.forEach(item => {
      counts[item.province] =
        (counts[item.province] || 0) + 1;
    });

    return counts;
  }

  function safeURL(raw) {
    try {
      const url = new URL(raw, location.href);

      return /^https?:$/.test(url.protocol)
        ? url.href
        : '';
    } catch (error) {
      return '';
    }
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
          '）。请检查文件位置并重新运行 hexo generate。'
      );
    }

    return response.json();
  }

  function mount() {
    const container =
      document.getElementById('footprint');

    if (
      !container ||
      (current && current.container === container)
    ) {
      return;
    }

    if (current) {
      current.destroy();
    }

    let footprintChart = null;
    let disposed = false;

    const abort = new AbortController();

    const media = matchMedia(
      '(prefers-color-scheme: dark)'
    );

    const reducedMotion = matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    function isDark() {
      const theme =
        document.documentElement.getAttribute(
          'data-theme'
        ) ||
        document.body.getAttribute('data-theme');

      return (
        theme === 'dark' ||
        (theme !== 'light' && media.matches)
      );
    }

    function resize() {
      if (footprintChart) {
        footprintChart.resize();
      }
    }

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(resize)
        : null;

    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', resize);

    let applyTheme = function () {};

    const themeObserver = new MutationObserver(
      function () {
        applyTheme();
      }
    );

    themeObserver.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ['data-theme']
      }
    );

    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    function onMediaChange() {
      applyTheme();
    }

    media.addEventListener(
      'change',
      onMediaChange
    );

    // 离开页面时释放实例，兼容 PJAX。
    const lifecycle = new MutationObserver(
      function () {
        if (
          !container.isConnected &&
          current &&
          current.container === container
        ) {
          current.destroy();
          current = null;
        }
      }
    );

    lifecycle.observe(document.body, {
      childList: true,
      subtree: true
    });

    current = {
      container,

      destroy() {
        disposed = true;

        abort.abort();

        window.removeEventListener(
          'resize',
          resize
        );

        media.removeEventListener(
          'change',
          onMediaChange
        );

        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        themeObserver.disconnect();
        lifecycle.disconnect();

        if (footprintChart) {
          footprintChart.dispose();
        }
      }
    };

    container.textContent =
      '正在加载旅行足迹…';

    (async function () {
      try {
        if (!window.echarts) {
          throw new Error(
            'ECharts 加载失败，请检查网络后刷新页面。'
          );
        }

        const results = await Promise.all([
          getJSON(
            'footprint.json',
            abort.signal
          ),
          getJSON(
            'china.json',
            abort.signal
          )
        ]);

        const pointData = results[0];
        const china = results[1];

        if (disposed) {
          return;
        }

        if (!Array.isArray(pointData)) {
          throw new Error(
            '城市数据格式错误。请移除旧版手动维护的 source/json/footprint.json，再重新生成博客。'
          );
        }

        // 让地图省名与城市数据中的省份简称一致。
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

        echarts.registerMap(
          'travel-china',
          china
        );

        const provinceCounts =
          getProvinceCounts(pointData);

        const provinceData = china.features
          .filter(feature => {
            return (
              feature.properties &&
              feature.properties.name
            );
          })
          .map(feature => {
            const name =
              feature.properties.name;

            return {
              name,
              value:
                provinceCounts[name] || 0
            };
          });

        const maxCount = Math.max(
          ...Object.values(provinceCounts),
          1
        );

        container.textContent = '';

        footprintChart =
          echarts.init(container);

        function getPalette() {
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
                color: dark
                  ? '#e4ecf3'
                  : '#263646'
              }
            },

            visualMap: {
              inRange: {
                color: dark
                  ? [
                      '#26394a',
                      '#387c99',
                      '#62cfdf'
                    ]
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
                color: dark
                  ? '#dce5ed'
                  : '#526272'
              }
            },

            geo: {
              itemStyle: {
                areaColor: dark
                  ? '#26394a'
                  : '#e6e6e6',

                borderColor: dark
                  ? '#7990a2'
                  : '#ffffff',

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

                itemStyle: {
                  color: dark
                    ? '#ffe0a0'
                    : '#ffffff',

                  shadowBlur: 7,
                  shadowColor: '#4583ae'
                }
              }
            ]
          };
        }

        const option = {
          backgroundColor: 'transparent',

          animation: !reducedMotion,

          tooltip: {
            trigger: 'item',

            // 点击显示，并允许鼠标移入点击文章链接。
            triggerOn: 'click',
            enterable: true,
            alwaysShowContent: true,
            confine: true,

            borderWidth: 1,

            extraCssText: [
              'max-width:260px',
              'max-height:300px',
              'overflow:auto',
              'white-space:normal',
              'line-height:1.7',
              'border-radius:10px'
            ].join(';'),

            formatter(params) {
              const isCity =
                params.seriesId ===
                'travel-points';

              const count =
                provinceCounts[
                  params.name
                ] || 0;

              let content =
                '<strong style="font-size:16px">' +
                escapeHTML(
                  params.name || ''
                ) +
                '</strong>';

              if (isCity) {
                content +=
                  '<div>' +
                  escapeHTML(
                    params.data.province
                  ) +
                  ' · ' +
                  escapeHTML(
                    params.data.description
                  ) +
                  '</div>';
              } else {
                content +=
                  '<div>' +
                  (count
                    ? '走过 ' +
                      count +
                      ' 座城市'
                    : '尚未留下足迹') +
                  '</div>';
              }

              const posts = isCity
                ? params.data.posts || []
                : pointData
                    .filter(point => {
                      return (
                        point.province ===
                        params.name
                      );
                    })
                    .flatMap(point => {
                      return (
                        point.posts || []
                      );
                    });

              const seen = new Set();

              const validPosts =
                posts.filter(post => {
                  const url = safeURL(
                    post.url
                  );

                  if (
                    !url ||
                    seen.has(url)
                  ) {
                    return false;
                  }

                  seen.add(url);
                  return true;
                });

              if (validPosts.length) {
                content +=
                  '<div style="' +
                  'margin-top:9px;' +
                  'font-weight:600">' +
                  '查看相关游记' +
                  '</div>';

                validPosts.forEach(
                  post => {
                    content +=
                      '<div><a href="' +
                      escapeHTML(
                        safeURL(post.url)
                      ) +
                      '" target="_blank"' +
                      ' rel="noopener noreferrer"' +
                      ' style="color:#2b9bc4">' +
                      escapeHTML(
                        post.title
                      ) +
                      '</a></div>';
                  }
                );
              }

              return content;
            }
          },

          visualMap: {
            show: true,

            // 只关联省份系列，城市光点不参与着色。
            seriesIndex: 1,

            min: 0,
            max: maxCount,

            left: '5%',
            bottom: '5%',

            itemWidth: 12,
            itemHeight: 100,

            calculable: false,
            precision: 0,

            text: [
              '走过城市数',
              ''
            ]
          },

          geo: {
            map: 'travel-china',

            show: true,
            roam: true,
            zoom: 1.05,

            scaleLimit: {
              min: 1,
              max: 8
            },

            label: {
              show: false
            },

            top: 20,
            bottom: 20,
            left: 8,
            right: 8
          },

          series: [
            // 第一组：城市涟漪点。
            {
              id: 'travel-points',

              name: '城市足迹',

              type: reducedMotion
                ? 'scatter'
                : 'effectScatter',

              coordinateSystem: 'geo',
              geoIndex: 0,

              data: pointData,

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

                  color: isDark()
                    ? '#ffffff'
                    : '#263646'
                }
              }
            },

            // 第二组：按走过城市数量给省份着色。
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
        };

        footprintChart.setOption(option);

        applyTheme = function () {
          if (footprintChart) {
            footprintChart.setOption(
              getPalette()
            );
          }
        };

        applyTheme();

        // 单篇游记：点击城市光点直接打开。
        // 多篇游记：在提示框内选择文章。
        footprintChart.on(
          'click',
          function (params) {
            if (
              params.seriesId ===
                'travel-points' &&
              params.data.url
            ) {
              const url = safeURL(
                params.data.url
              );

              if (url) {
                window.open(
                  url,
                  '_blank',
                  'noopener,noreferrer'
                );
              }
            }
          }
        );

        // 点击地图空白处关闭提示框。
        footprintChart
          .getZr()
          .on('click', function (event) {
            if (!event.target) {
              footprintChart.dispatchAction({
                type: 'hideTip'
              });
            }
          });

        // 双击地图恢复初始位置。
        footprintChart
          .getZr()
          .on('dblclick', function () {
            footprintChart.setOption({
              geo: {
                zoom: 1.05,
                center: null
              }
            });

            footprintChart.dispatchAction({
              type: 'hideTip'
            });
          });

        resize();
      } catch (error) {
        if (!disposed) {
          if (footprintChart) {
            footprintChart.dispose();
            footprintChart = null;
          }

          container.textContent =
            error.message;

          console.error(
            '[旅行足迹]',
            error
          );
        }
      }
    })();
  }

  const events = [
    'pjax:complete',
    'pjax:success'
  ];

  events.forEach(name => {
    document.addEventListener(
      name,
      mount
    );
  });

  window.__travelFootprint = {
    destroy() {
      events.forEach(name => {
        document.removeEventListener(
          name,
          mount
        );
      });

      document.removeEventListener(
        'DOMContentLoaded',
        mount
      );

      if (current) {
        current.destroy();
      }

      current = null;
    }
  };

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      mount,
      { once: true }
    );
  } else {
    mount();
  }
})();