/* Markdown 渲染、slug、TOC */

import { state, els } from './config.js';
import { openNote } from './fs.js';
import { hydrateLocalImages, releaseLocalImages } from './localimg.js';
const blobUrls = new Set();

export function trackBlobUrl(url) {
    if (url.startsWith('blob:')) blobUrls.add(url);
}

window.addEventListener('beforeunload', () => {
    blobUrls.forEach((u) => URL.revokeObjectURL(u));
});

/* 支援中文（全 Unicode 字母/數字） */
export function slugify(text) {
    return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-]/gu, '')
        .replace(/\-+/g, '-')
        .replace(/^-|-$/g, '');
}

// 把 render 改成 async
export async function render() {
    releaseLocalImages();
    const source = els.editor.value.replace(
        /\[\[([^\]\vert{}]+)(?:\Vert{}([^\]]+))?\]\]/g,
        (_, target, label) =>
            `[${label || target}](wiki:${encodeURIComponent(target.trim())})`
    );

    // 1. 解析
    let html = marked.parse(source, { gfm: true });

    // 2. 補 id
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const usedIds = new Set();
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
        let id = slugify(h.textContent) || `heading-${usedIds.size}`;
        const base = id;
        let n = 1;
        while (usedIds.has(id)) id = `${base}-${n++}`;
        usedIds.add(id);
        h.id = id;
    });
    html = doc.body.innerHTML;

    // 3. 消毒
    els.viewer.innerHTML = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

    // 4. 語法高亮
    els.viewer.querySelectorAll('pre code').forEach((b) => hljs.highlightElement(b));

    // 5. 複製按鈕
    els.viewer.querySelectorAll('pre').forEach((preBlock) => {
        if (preBlock.querySelector('.copy-code-btn')) return;
        const codeElement = preBlock.querySelector('code');
        if (!codeElement) return;
        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.textContent = '複製';
        btn.title = '複製程式碼';
        btn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                btn.textContent = '已複製!';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = '複製'; btn.classList.remove('copied'); }, 2000);
            });
        };
        preBlock.appendChild(btn);
    });

    // 6. wiki 連結
    els.viewer.querySelectorAll('a[href^="wiki:"]').forEach((a) => {
        const t = decodeURIComponent(a.getAttribute('href').slice(5))
            .replace(/\.(md|markdown|txt)$/i, '').toLocaleLowerCase();
        const match = state.files.find((f) =>
            f.name.replace(/\.(md|markdown|txt)$/i, '').toLocaleLowerCase() === t ||
            f.path.replace(/\.(md|markdown|txt)$/i, '').toLocaleLowerCase() === t
        );
        if (match) {
            a.href = '#';
            a.onclick = (e) => { e.preventDefault(); openNote(match); };
        } else {
            a.removeAttribute('href');
            a.title = '找不到對應筆記';
        }
    });

    // 7. TOC
    generateTOC();

    // 8. 載入本機圖片（await 確保完成）
    await hydrateLocalImages();
}

export function generateTOC() {
    const tocContainer = els.tocContainer;
    tocContainer.innerHTML = '';
    const headings = els.viewer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
        tocContainer.innerHTML = '<span class="text-xs" style="color:var(--muted)">尚無標題</span>';
        return;
    }
    headings.forEach((heading) => {
        if (!heading.id) {
            heading.id = slugify(heading.textContent)
                || `heading-${Math.random().toString(36).slice(2, 8)}`;
        }
        const link = document.createElement('a');
        link.href = `#${heading.id}`;
        link.className = 'toc-item';
        link.textContent = heading.textContent;
        const level = parseInt(heading.tagName.substring(1));
        link.style.paddingLeft = `${(level - 1) * 10}px`;
        link.onclick = (e) => {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        tocContainer.appendChild(link);
    });
}