/* 圖片拖入 / 貼上處理 */

import { state, els, setStatus } from './config.js';
import { render } from './markdown.js';

/* 將文字插入編輯器游標位置 */
function insertAtCursor(text) {
    const ed = els.editor;
    const start = ed.selectionStart ?? ed.value.length;
    const end = ed.selectionEnd ?? ed.value.length;
    ed.value = ed.value.slice(0, start) + text + ed.value.slice(end);
    const pos = start + text.length;
    ed.selectionStart = ed.selectionEnd = pos;
    ed.dispatchEvent(new Event('input'));
}

/* 確保有可寫入的資料夾；沒有就提示並回傳 false */
function ensureWritableFolder() {
    if (state.dir && state.active?.parentHandle) return true;
    setStatus('請先「開啟資料夾」並開啟一篇筆記，圖片才能存到本機（與 .md 放在一起）。');
    alert('要插入本機圖片，請先：\n1. 點「開啟資料夾」\n2. 開啟或新增一篇筆記\n\n這樣圖片才能與筆記一起存在本機，重整後也不會消失。');
    return false;
}

/* 把圖片寫入目前筆記所在資料夾的 assets/，回傳相對路徑 */
async function persistImage(file) {
    const parentHandle = state.active.parentHandle;
    const assets = await parentHandle.getDirectoryHandle('assets', { create: true });

    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = `img-${stamp}.${ext}`;

    const fh = await assets.getFileHandle(safeName, { create: true });
    const w = await fh.createWritable();
    await w.write(file);
    await w.close();

    // 圖片與筆記在同一個資料夾的 assets 底下，所以直接使用 ./assets/ 即可
    return `./assets/${safeName}`;
}

/* 處理一批圖片檔 */
export async function handleImageFiles(files) {
    if (!files || files.length === 0) return 0;
    if (!ensureWritableFolder()) return 0;

    let count = 0;
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
            const relPath = await persistImage(file);
            const alt = file.name.replace(/\.[^.]+$/, '');
            insertAtCursor(`![${alt}](${relPath})\n`);
            count++;
            setStatus(`圖片已存到本機：${relPath}`);
        } catch (e) {
            setStatus(`圖片寫入失敗：${e.message}`);
        }
    }
    if (count > 0) render();
    return count;
}

/* 初始化：攔截貼上、拖放圖片 (僅限編輯器內部) */
export function initImageDrop() {
    // 貼上（Ctrl+V）
    els.editor.addEventListener('paste', async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const imageFiles = [];
        for (const it of items) {
            if (it.type.startsWith('image/')) {
                const f = it.getAsFile();
                if (f) imageFiles.push(f);
            }
        }
        if (imageFiles.length === 0) return;
        e.preventDefault();
        await handleImageFiles(imageFiles);
    });

    // 拖放到編輯器
    els.editor.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    });
    els.editor.addEventListener('drop', async (e) => {
        const files = e.dataTransfer?.files;
        if (!files) return;
        const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (images.length === 0) return;
        e.preventDefault();
        e.stopPropagation(); // 阻止冒泡到 mainContent
        await handleImageFiles(images);
    });
}