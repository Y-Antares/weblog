document.addEventListener('DOMContentLoaded', function () {
    const links = document.querySelectorAll('article.md-text.content a, footer.page-footer.footnote a');
    
    const parentClassesToSkip = [
        'tag-plugin.users-wrap', 
        'tag-plugin.sites-wrap', 
        'tag-plugin.ghcard', 
        'tag-plugin.link.dis-select', 
        'tag-plugin.colorful.note', 
        'social-wrap.dis-select'
    ];

    links.forEach(function(link) {
        
        // 1. 检查链接本身是否为卡片链接
        if (link.classList.contains('card-link')) {
            return; // 直接跳过这个链接
        }

        // 2. 检查父元素
        let skip = false;
        parentClassesToSkip.forEach(pc => {
            if (link.closest(`div.${pc}`)) {
                skip = true;
            }
        });
        if (skip) {
            return; // 跳过这个链接
        }
        
        // 3. 添加图标
        const href = link.getAttribute('href');
        if (href && (href.startsWith('http') || href.startsWith('/'))) {
            link.innerHTML += ` <span style="white-space: nowrap;"><svg width=".7em" height=".7em" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><path d="m13 3l3.293 3.293l-7 7l1.414 1.414l7-7L21 11V3z" fill="currentColor" /><path d="M19 19H5V5h7l-2-2H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2v-5l-2-2v7z" fill="currentColor"></svg></span>`;
        }
    });
});