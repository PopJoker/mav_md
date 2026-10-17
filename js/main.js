/* 進入點：組裝所有模組、綁定按鈕 */

import {
    $, state, els, colorInputs, defaults, setStatus, setDirty
} from './config.js';
import {
    loadPrefs, savePrefs, applyColors, applyManifest
} from './prefs.js';
import {
    registerServiceWorker, initInstallPrompt, initIconWizard,
    openIconWizard, showToast
} from './pwa.js';
import {
    addRow, openFolder, openFile, newFile, save, saveAs,
    renameFile, moveFile, restoreLastOpen
} from './fs.js';
import {
    initResizers, updatePanels, applyPaneWidths, toggleTOC,
    setCurrentWidths, getPaneWidths, getCurrentWidths
} from './panels.js';
import { render } from './markdown.js';
import { storeHandle } from './storage.js';
import { loadFromHash, initShareButton, copyShareLink } from './urlshare.js';
import { initImageDrop } from './images.js';

/* ---------- 初始化偏好 ---------- */
const prefs = loadPrefs();
applyColors(prefs.colors);
if (prefs.folder) $('folderName').textContent = prefs.folder;

const initialAccent = /^#[0-9a-f]{6}$/i.test(prefs.colors?.accent || '')
    ? prefs.colors.accent
    : '#6558d3';
applyManifest(initialAccent);

const savePrefsWithWidths = () => savePrefs(getPaneWidths());

/* ---------- 顏色輸入 ---------- */
for (const [key, input] of Object.entries(colorInputs)) {
    input.addEventListener('input', () => {
        const c = {};
        for (const k in colorInputs) c[k] = colorInputs[k].value;
        applyColors(c);
        savePrefsWithWidths();
        if (key === 'accent') openIconWizard(input.value);
    });
}
$('resetColors').onclick = () => { applyColors(defaults); savePrefsWithWidths(); };

/* ---------- 側邊欄 & 主按鈕 ---------- */
$('toggleSidebar').onclick = () => els.sidebar.classList.toggle('collapsed');

$('openFolder').onclick = openFolder;
$('openFile').onclick = openFile;
$('newFile').onclick = newFile;

$('saveBtn').onclick = save;
$('saveAsBtn').onclick = saveAs;
$('renameBtn').onclick = renameFile;
$('moveBtn').onclick = moveFile;

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
    }
});

/* ---------- 齒輪選單 ---------- */
const gear = $('toolsGear'), toolsMenu = $('toolsMenu');
gear.onclick = () => {
    const open = gear.getAttribute('aria-expanded') !== 'true';
    gear.setAttribute('aria-expanded', String(open));
    gear.setAttribute('aria-label', open ? '收合編輯設定' : '開啟編輯設定');
    toolsMenu.classList.toggle('hidden', !open);
};
document.addEventListener('click', (e) => {
    if (!gear.parentElement.contains(e.target)) {
        gear.setAttribute('aria-expanded', 'false');
        gear.setAttribute('aria-label', '開啟編輯設定');
        toolsMenu.classList.add('hidden');
    }
});

/* ---------- 面板切換 ---------- */
$('editToggle').onclick = () => { state.showEditor = !state.showEditor; updatePanels(); };
$('previewToggle').onclick = () => { state.showPreview = !state.showPreview; updatePanels(); };
$('tocToggleTop').onclick = toggleTOC;

/* ---------- 搜尋 ---------- */
$('search').oninput = (e) => {
    const q = e.target.value.trim().toLocaleLowerCase();
    els.tree.querySelectorAll('.tree-row').forEach((r) => {
        r.hidden = !!q && !r.dataset.path.toLocaleLowerCase().includes(q);
        if (q) {
            let n = r.parentElement;
            while (n && n !== els.tree) {
                if (n.tagName === 'DETAILS') n.open = true;
                n = n.parentElement;
            }
        }
    });
};

/* ---------- 下載範例 ---------- */
$('downloadExampleBtn').onclick = async () => {
    try {
        const res = await fetch('./example.md');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Markdown語法範例.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        state.content = md;
        els.editor.value = md;
        setDirty(false);
        $('welcome').classList.add('hidden');
        $('workspace').classList.remove('hidden');
        render();
        $('docTitle').textContent = 'Markdown語法範例.md（未儲存）';
        setStatus('已下載並載入範例，記得按「儲存」留存變更');
    } catch (e) {
        setStatus(`範例載入失敗：${e.message}`);
    }
};

/* ---------- 編輯器輸入 ---------- */
els.editor.addEventListener('input', () => {
    setDirty(els.editor.value !== state.content);
    render();
});

/* ---------- 恢復上次開啟 ---------- */
$('resumeLastBtn').onclick = () => restoreLastOpen(true);

/* ---------- 拖曳上傳 (統一由 main 處理) ---------- */
function initDragAndDrop() {
    const main = $('mainContent');
    const hasFsHandle = 'getAsFileSystemHandle' in DataTransferItem.prototype;

    // 阻止瀏覽器預設的檔案開啟行為
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    // 顯示提示框（如果是圖片就不顯示）
    main.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // 判斷是否為圖片，若包含圖片則不顯示提示框
            const hasFiles = e.dataTransfer.items && e.dataTransfer.items.length > 0;
            let isOnlyImages = hasFiles;
            if (hasFiles) {
                for (const item of e.dataTransfer.items) {
                    if (item.kind === 'file' && !item.type.startsWith('image/')) {
                        isOnlyImages = false;
                        break;
                    }
                }
            }

            // 只有當拖曳的不是純圖片時，才加上提示框
            if (!isOnlyImages) {
                main.classList.add('dragover');
            } else {
                main.classList.remove('dragover');
            }
        }
    });

    // 離開時移除提示框
    main.addEventListener('dragleave', (e) => {
        if (!main.contains(e.relatedTarget)) {
            main.classList.remove('dragover');
        }
    });

    // 放下檔案
    main.addEventListener('drop', async (e) => {
        e.preventDefault();
        main.classList.remove('dragover'); // 立即移除提示框

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        // 1. 處理圖片
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            const { handleImageFiles } = await import('./images.js');
            if (!els.editor.value) {
                $('welcome').classList.add('hidden');
                $('workspace').classList.remove('hidden');
            }
            await handleImageFiles(imageFiles);
            // 如果拖入的全是圖片，處理完就結束
            if (imageFiles.length === files.length) return;
        }

        // 2. 處理資料夾或 .md 檔案
        const items = e.dataTransfer?.items;
        if (hasFsHandle && items && items.length > 0) {
            const handles = [];
            for (const item of items) {
                if (item.kind !== 'file') continue;
                try {
                    const handle = await item.getAsFileSystemHandle();
                    if (handle) handles.push(handle);
                } catch { /* 略 */ }
            }
            if (handles.length > 0) {
                await handleDroppedHandles(handles);
                return;
            }
        }

        const mdFiles = Array.from(files).filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
        if (mdFiles.length > 0) {
            await handleDroppedFiles(mdFiles);
        } else if (imageFiles.length === 0) {
            setStatus('拖入的檔案不是 Markdown 或圖片。');
        }
    });
}

async function handleDroppedHandles(handles) {
    const { confirmDiscard, scan, activate, addRow } = await import('./fs.js');
    if (!await confirmDiscard()) return;
    let openedFile = false;

    for (const handle of handles) {
        if (handle.kind === 'directory') {
            state.dir = handle;
            await storeHandle('directory', handle);
            state.files = [];
            state.active = null;
            els.tree.replaceChildren();
            $('folderName').textContent = handle.name;
            await scan(handle);
            savePrefsWithWidths();
            setStatus(`${state.files.length} 個筆記 · 已載入資料夾「${handle.name}」`);
            if (!state.files.length) els.tree.textContent = '此資料夾還沒有 Markdown 筆記。';
        } else if (handle.kind === 'file') {
            const file = await handle.getFile();
            if (!/\.(md|markdown|txt)$/i.test(file.name)) continue;
            let item = state.files.find((f) => f.handle === handle);
            if (!item) {
                item = { name: file.name, path: file.name, handle, parentHandle: state.dir };
                state.files.push(item);
                addRow(item);
            }
            const { openNote } = await import('./fs.js');
            await openNote(item);
            openedFile = true;
        }
    }
    return openedFile;
}

async function handleDroppedFiles(files) {
    const { confirmDiscard } = await import('./fs.js');
    if (!await confirmDiscard()) return;
    let opened = false;
    for (const file of files) {
        state.content = await file.text();
        els.editor.value = state.content;
        setDirty(true);
        $('welcome').classList.add('hidden');
        $('workspace').classList.remove('hidden');
        render();
        $('docTitle').textContent = `${file.name}（拖入，未連結原檔）`;
        $('folderName').textContent = '拖入檔案（唯讀）';
        setStatus('拖入檔案：可編輯，但需「另存新檔」才能寫回本機');
        opened = true;
    }
}

/* ---------- 啟動 ---------- */
initShareButton();
initImageDrop(); // 只處理編輯器內的貼上與拖放

(async () => {
    // 1. 先嘗試恢復上次資料夾（但不強制，以防卡住）
    await restoreLastOpen();

    // 2. 解析 Hash，如果是 #file= 會在上方顯示「點我授權」按鈕
    await loadFromHash();
})();

registerServiceWorker();
initInstallPrompt();
initIconWizard();
initDragAndDrop(); // 處理整個頁面的拖放

setCurrentWidths(prefs.widths);
initResizers();
updatePanels();

requestAnimationFrame(() => applyPaneWidths(getCurrentWidths()));
window.addEventListener('resize', () => applyPaneWidths(getCurrentWidths()));