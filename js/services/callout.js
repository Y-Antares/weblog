// source/js/callout.js

document.addEventListener("DOMContentLoaded", function() {
    // 使用事件委托，监听所有对 .callout-title 的点击
    document.body.addEventListener("click", function(e) {
        // 查找最近的 .callout-title 父元素，且其所在的 .callout 必须是可折叠的 (.is-collapsible)
        const titleEl = e.target.closest(".callout.is-collapsible .callout-title");
        
        if (titleEl) {
            // 找到对应的 .callout 容器
            const calloutEl = titleEl.closest(".callout");
            if (calloutEl) {
                // 切换 is-collapsed 类，从而触发 CSS 的显示/隐藏
                calloutEl.classList.toggle("is-collapsed");
            }
        }
    });
});