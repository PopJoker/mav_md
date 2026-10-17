/* 本機圖片解析：把 Markdown 裡的相對路徑圖片，從本機資料夾讀出來轉成 blob URL */

import { state, els } from './config.js';

let activeBlobUrls = new Set();

/* 依相對路徑從 baseDir 找出 FileSystemFileHandle */
async function resolveFileHandle(baseDir, relativePath) {
    if (!baseDir) return null;
    // 處理 ./ 與 ../
    let clean = relativePath.trim();
    if (clean.startsWith('./')) clean = clean.slice(2);

    const parts = clean.split('/').filter(Boolean);
    let dir = baseDir;

    // 如果有多層路徑（例如 assets/xxx.jpg），要先進入資料夾
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part === '..') {
            // 不支援往上跳（瀏覽器 FileSystem API 沒有 parent 存取）
            console.warn('[localimg] 不支援 ../，跳過：', relativePath);
            return null;
        }
        dir = await dir.getDirectoryHandle(part);
    }

    return await dir.getFileHandle(parts[parts.length - 1]);
}

/* 是否為「應該從本機載入」的圖片路徑 */
function isLocalRelative(src) {
    if (!src) return false;
    if (/^(https?:|data:|blob:)/i.test(src)) return false;
    return true;
}

/* 釋放舊的 blob URL */
export function releaseLocalImages() {
    activeBlobUrls.forEach((u) => URL.revokeObjectURL(u));
    activeBlobUrls.clear();
}

/* 主函式 */
export async function hydrateLocalImages() {
    releaseLocalImages();

    const baseDir = state.active?.parentHandle;

    console.log('[localimg] hydrate 開始', {
        baseDir: !!baseDir,
        activeName: state.active?.name,
        parentName: state.active?.parentHandle?.name
    });

    if (!baseDir) {
        console.warn('[localimg] 沒有 parentHandle，無法載入本機圖片');
        return;
    }

    const imgs = Array.from(els.viewer.querySelectorAll('img'))
        .filter((img) => isLocalRelative(img.getAttribute('src')));

    console.log('[localimg] 找到', imgs.length, '張相對路徑圖片');

    for (const img of imgs) {
        const originalSrc = img.getAttribute('src');
        try {
            const fh = await resolveFileHandle(baseDir, originalSrc);
            if (!fh) {
                img.alt = `（路徑解析失敗：${originalSrc}）`;
                continue;
            }
            const file = await fh.getFile();
            const url = URL.createObjectURL(file);
            activeBlobUrls.add(url);
            img.src = url;
            img.dataset.localSrc = originalSrc;
            console.log('[localimg] 成功載入', originalSrc, '->', url);
        } catch (e) {
            console.warn('[localimg] 找不到或讀取失敗:', originalSrc, e.message);
            img.alt = `（找不到圖片：${originalSrc}）`;
            img.title = `錯誤：${e.message}`;
        }
    }
}

window.addEventListener('beforeunload', releaseLocalImages);