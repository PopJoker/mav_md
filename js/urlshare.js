/* URL 分享：把目前筆記內容編碼到 hash，支援 #share= 與 #url= */

import { $, state, els, setStatus, setDirty } from './config.js';
import { render } from './markdown.js';

export function encodeShare(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach((b) => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - b64.length % 4) : '';
    const bin = atob(b64 + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function copyShareLink() {
    if (!state.active) {
        setStatus('請先開啟資料夾並選擇一篇筆記，才能產生專屬書籤。');
        return;
    }

    const path = state.active.path || state.active.name;
    const url = `${location.origin}${location.pathname}#file=${encodeURIComponent(path)}`;

    const modal = $('shareModal');
    const textarea = $('shareUrlOutput');
    const warning = $('shareWarning');
    const panel = modal.querySelector('div');

    textarea.value = url;

    warning.classList.add('hidden');

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        panel.classList.remove('scale-95');
        panel.classList.add('scale-100');
    });

    $('shareCopyBtn').onclick = async () => {
        try {
            await navigator.clipboard.writeText(url);
            $('shareCopyBtn').textContent = '已複製！';
            setTimeout(() => { $('shareCopyBtn').textContent = '複製連結'; }, 2000);
        } catch {
            textarea.select();
            document.execCommand('copy');
            $('shareCopyBtn').textContent = '已複製！';
            setTimeout(() => { $('shareCopyBtn').textContent = '複製連結'; }, 2000);
        }
    };
}

export function closeShareModal() {
    const modal = $('shareModal');
    const panel = modal.querySelector('div');
    modal.classList.add('opacity-0');
    panel.classList.remove('scale-100');
    panel.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 200);
}

/* --- 新增：專門處理 #file= 的獨立函式 --- */
export async function handleFileHash() {
    const hash = location.hash.slice(1);
    const fileMatch = hash.match(/^file=(.+)$/);

    if (fileMatch) {
        const name = decodeURIComponent(fileMatch[1]);
        const item = state.files.find((f) => f.path === name || f.name === name);

        if (item) {
            // 資料夾已授權且找到檔案，直接開啟
            const { openNote } = await import('./fs.js');
            await openNote(item);
            setStatus(`已從專屬網址開啟「${name}」`);
            // 成功開啟後清除 hash，避免重整時卡住
            history.replaceState(null, '', location.pathname + location.search);
            return true;
        } else {
            // 資料夾未授權或沒找到，顯示上方橫幅提示
            const prompt = $('bookmarkPrompt');
            const text = $('bookmarkPromptText');
            const btn = $('bookmarkOpenBtn');

            if (prompt && text && btn) {
                text.textContent = `書籤要求開啟「${name}」，請授權資料夾。`;
                prompt.classList.remove('hidden');

                btn.onclick = async () => {
                    const { restoreLastOpen, openNote } = await import('./fs.js');
                    await restoreLastOpen(true);

                    const newItem = state.files.find((f) => f.path === name || f.name === name);
                    if (newItem) {
                        await openNote(newItem);
                        prompt.classList.add('hidden');
                        history.replaceState(null, '', location.pathname + location.search);
                    } else {
                        text.textContent = `已授權，但找不到「${name}」。`;
                        btn.classList.add('hidden');
                    }
                };
            }
            return false;
        }
    }
    return false;
}

/* 頁面載入時解析 hash */
export async function loadFromHash() {
    const hash = location.hash.slice(1);
    if (!hash) return false;

    // 優先處理 #file=
    if (hash.startsWith('file=')) {
        return await handleFileHash();
    }

    // #share=
    const shareMatch = hash.match(/^share=(.+)$/);
    if (shareMatch) {
        try {
            const md = decodeShare(shareMatch[1]);
            applyExternalContent(md, '分享的筆記（未儲存）');
            setStatus('已從分享連結載入筆記');
            return true;
        } catch (e) {
            setStatus(`分享連結解析失敗：${e.message}`);
            return false;
        }
    }

    // #url=
    const urlMatch = hash.match(/^url=(.+)$/);
    if (urlMatch) {
        const remote = decodeURIComponent(urlMatch[1]);
        try {
            const res = await fetch(remote);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const md = await res.text();
            applyExternalContent(md, `${remote.split('/').pop()}（遠端）`);
            setStatus(`已從遠端載入：${remote}`);
            return true;
        } catch (e) {
            setStatus(`遠端載入失敗：${e.message}（可能是 CORS 限制）`);
            return false;
        }
    }
    return false;
}

function applyExternalContent(md, title) {
    state.content = md;
    state.active = null;
    state.dirty = true;
    els.editor.value = md;
    $('welcome').classList.add('hidden');
    $('workspace').classList.remove('hidden');
    $('docTitle').textContent = title;
    $('folderName').textContent = '外部內容（未連結檔案）';
    setDirty(true);
    render();
}

export function clearHash() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

export function initShareButton() {
    const btn = $('shareBtn');
    if (btn) btn.onclick = copyShareLink;

    const cancelBtn = $('shareCancelBtn');
    if (cancelBtn) cancelBtn.onclick = closeShareModal;

    const modal = $('shareModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeShareModal();
        });
    }

    // --- 新增：監聽網址變化，如果 hash 變成 #file= 就自動觸發 ---
    window.addEventListener('hashchange', async () => {
        if (location.hash.startsWith('#file=')) {
            await handleFileHash();
        }
    });
}