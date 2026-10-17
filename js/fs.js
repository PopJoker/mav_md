/* 檔案系統操作：開資料夾/檔案、scan、openNote、save、rename、move */

import {
    $, state, els, setStatus, setDirty, showWorkspace, validName
} from './config.js';
import { storeHandle, getStoredHandle, permit } from './storage.js';
import { savePrefs } from './prefs.js';
import { render } from './markdown.js';

/* ---------- 樹狀結構 ---------- */
export function addRow(item, parent = els.tree) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'tree-row flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm';
    row.dataset.path = item.path;
    row.title = item.path;

    const icon = document.createElement('span');
    icon.textContent = '▤';
    icon.className = 'shrink-0';

    const name = document.createElement('span');
    name.textContent = item.name;

    row.append(icon, name);
    row.onclick = () => openNote(item);
    parent.append(row);
}

export async function scan(dir, path = '', parent = els.tree) {
    const entries = [];
    for await (const e of dir.values()) entries.push(e);
    entries.sort((a, b) => a.kind === b.kind
        ? a.name.localeCompare(b.name, undefined, { numeric: true })
        : a.kind === 'directory' ? -1 : 1);

    for (const e of entries) {
        const p = path ? `${path}/${e.name}` : e.name;
        if (e.kind === 'directory') {
            const d = document.createElement('details');
            d.className = 'mb-1';
            d.open = path === '';
            const s = document.createElement('summary');
            s.className = 'cursor-pointer rounded-lg px-3 py-2 text-sm font-medium';
            s.textContent = `▸ ${e.name}`;
            const child = document.createElement('div');
            child.className = 'ml-3 border-l pl-2';
            child.style.borderColor = 'var(--line)';
            d.append(s, child);
            s.onclick = () => setTimeout(() => {
                s.textContent = `${d.open ? '▾' : '▸'} ${e.name}`;
            }, 0);
            parent.append(d);
            await scan(e, p, child);
        } else if (/\.(md|markdown|txt)$/i.test(e.name)) {
            const item = { name: e.name, path: p, handle: e, parentHandle: dir };
            state.files.push(item);
            addRow(item, parent);
        }
    }
}

export async function rebuildTree() {
    els.tree.replaceChildren();
    if (state.dir) {
        const activePath = state.active?.path;
        state.files = [];
        await scan(state.dir);
        state.active = state.files.find((item) => item.path === activePath) || state.active;
        if (state.active) activate(state.active);
    } else {
        state.files.forEach((item) => addRow(item));
    }
}

export function activate(item) {
    state.active = item;
    els.tree.querySelectorAll('.tree-row').forEach((r) => {
        r.setAttribute('aria-current', String(r.dataset.path === item.path));
    });
    $('folderName').textContent = item.name;
    $('docTitle').textContent = item.path;
    storeHandle('activeFile', item.handle);
}

export async function confirmDiscard() {
    if (!state.dirty) return true;
    return confirm('目前筆記有尚未儲存的修改。要放棄修改並繼續嗎？');
}

export async function openNote(item) {
    if (!await confirmDiscard()) return;
    try {
        const f = await item.handle.getFile();
        state.content = await f.text();
        activate(item);
        await storeHandle('activeFile', item.handle);
        els.editor.value = state.content;
        setDirty(false);
        showWorkspace();
        render();
        setStatus(`${(f.size / 1024).toFixed(1)} KB · 本機檔案`);
    } catch (e) {
        setStatus(`讀取失敗：${e.message}`);
    }
}

/* ---------- 讀寫 ---------- */
export async function writeHandle(handle, content) {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
}

export async function save() {
    if (!state.active) { setStatus('請先建立或開啟筆記。'); return; }
    try {
        await writeHandle(state.active.handle, els.editor.value);
        state.content = els.editor.value;
        setDirty(false);
        setStatus('已儲存至本機檔案');
        render();
    } catch (e) {
        setStatus(`儲存失敗：${e.message}。可嘗試「另存新檔」。`);
    }
}

/* ---------- 開資料夾 / 開檔案 ---------- */
export async function chooseTargetDirectory() {
    if (!('showDirectoryPicker' in window)) throw Error('請使用支援資料夾存取的 Chrome／Edge');
    return await window.showDirectoryPicker({
        mode: 'readwrite',
        ...(state.dir ? { startIn: state.dir } : {})
    });
}

export async function openFolder() {
    if (!('showDirectoryPicker' in window)) {
        setStatus('請使用支援資料夾存取的 Chrome／Edge。');
        return;
    }
    if (!await confirmDiscard()) return;
    try {
        const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
        state.dir = dir;
        await storeHandle('directory', dir);
        state.files = [];
        state.active = null;
        els.tree.replaceChildren();
        $('folderName').textContent = dir.name;
        await scan(dir);
        savePrefs();
        setStatus(`${state.files.length} 個筆記 · 資料夾可讀寫`);
        if (!state.files.length) {
            els.tree.textContent = '此資料夾還沒有 Markdown 筆記。按「新增筆記」建立。';
        }
    } catch (e) {
        if (e.name !== 'AbortError') setStatus(`開啟失敗：${e.message}`);
    }
}

export async function openFile() {
    if (!await confirmDiscard()) return;
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'Markdown 文件',
                accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] }
            }]
        });
        let item = state.files.find((f) => f.handle === handle);
        if (!item) {
            const f = await handle.getFile();
            item = { name: f.name, path: f.name, handle, parentHandle: state.dir };
            state.files.push(item);
            await rebuildTree();
        }
        await openNote(item);
    } catch (e) {
        if (e.name !== 'AbortError') setStatus(`開啟失敗：${e.message}`);
    }
}

/* ---------- 新增 / 另存 / 改名 / 移動 ---------- */
export async function newFile() {
    if (!await confirmDiscard()) return;
    let name = prompt('新筆記名稱（可不輸入 .md）：', '新筆記');
    if (name === null) return;
    name = validName(name);
    if (!name) return;

    try {
        let handle, parentHandle = state.dir;
        if (state.dir) {
            const target = await chooseTargetDirectory();
            parentHandle = target;
            handle = await target.getFileHandle(name, { create: true });
        } else if ('showSaveFilePicker' in window) {
            handle = await window.showSaveFilePicker({
                suggestedName: name,
                types: [{ description: 'Markdown 文件', accept: { 'text/markdown': ['.md'] } }]
            });
        } else throw Error('請先開啟資料夾，或使用支援另存新檔的 Chrome／Edge');

        await rebuildTree();

        const newPath = parentHandle && state.dir
            ? (parentHandle === state.dir ? name : `${parentHandle.name}/${name}`)
            : name;
        const createdItem = state.files.find((f) => f.path === newPath)
            || { name: handle.name || name, path: newPath, handle, parentHandle };

        state.content = '';
        els.editor.value = '';
        activate(createdItem);
        showWorkspace();
        setDirty(false);
        els.editor.focus();
        setStatus('新筆記已建立，編輯後按「儲存」');
    } catch (e) {
        if (e.name !== 'AbortError') setStatus(`建立失敗：${e.message}`);
    }
}

export async function saveAs() {
    try {
        if (!('showSaveFilePicker' in window)) throw Error('瀏覽器不支援另存新檔');
        const handle = await window.showSaveFilePicker({
            suggestedName: state.active?.name || '新筆記.md',
            types: [{ description: 'Markdown 文件', accept: { 'text/markdown': ['.md'] } }]
        });
        await writeHandle(handle, els.editor.value);
        const file = await handle.getFile();
        const item = { name: file.name, path: file.name, handle, parentHandle: state.dir };
        state.files.push(item);
        await rebuildTree();
        activate(item);
        state.content = els.editor.value;
        setDirty(false);
        setStatus('已另存至本機');
    } catch (e) {
        if (e.name !== 'AbortError') setStatus(`另存失敗：${e.message}`);
    }
}

export async function renameFile() {
    const item = state.active;
    if (!item) return;
    const typed = prompt('輸入新的檔名（可不輸入 .md）：', item.name);
    if (typed === null) return;
    const name = validName(typed);
    if (!name || name === item.name) return;

    if (state.files.some((f) =>
        f !== item && f.parentHandle === item.parentHandle &&
        f.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        setStatus('同一資料夾已有相同檔名。');
        return;
    }

    try {
        const file = await item.handle.getFile();
        try {
            await item.parentHandle.getFileHandle(name);
            setStatus('同名檔案已存在，未改名。');
            return;
        } catch (checkError) {
            if (checkError.name !== 'NotFoundError') throw checkError;
        }
        const replacement = await item.parentHandle.getFileHandle(name, { create: true });
        await writeHandle(replacement, await file.text());
        await item.parentHandle.removeEntry(item.name);
        item.name = name;
        item.handle = replacement;
        const prefix = item.path.includes('/')
            ? item.path.slice(0, item.path.lastIndexOf('/') + 1) : '';
        item.path = prefix + name;
        activate(item);
        await rebuildTree();
        setStatus('檔名已更新');
    } catch (e) {
        setStatus(`改名失敗：${e.message}`);
    }
}

export async function moveFile() {
    const item = state.active;
    if (!item) return;
    if (!await confirmDiscard()) return;
    try {
        const target = await chooseTargetDirectory();
        if (target === item.parentHandle) {
            setStatus('筆記已在所選資料夾中。');
            return;
        }
        const file = await item.handle.getFile();
        try {
            await target.getFileHandle(item.name);
            setStatus('目標資料夾已有相同檔名，未進行移動。');
            return;
        } catch (checkError) {
            if (checkError.name !== 'NotFoundError') throw checkError;
        }
        const nextHandle = await target.getFileHandle(item.name, { create: true });
        await writeHandle(nextHandle, await file.text());
        await item.parentHandle.removeEntry(item.name);
        item.handle = nextHandle;
        item.parentHandle = target;
        item.path = `${target.name}/${item.name}`;
        state.content = await file.text();
        els.editor.value = state.content;
        setDirty(false);
        activate(item);
        await rebuildTree();
        setStatus(`已移動至「${target.name}」`);
    } catch (e) {
        if (e.name !== 'AbortError') setStatus(`移動失敗：${e.message}`);
    }
}

/* ---------- 恢復上次開啟 ---------- */
export async function restoreLastOpen(fromClick = false) {
    const savedDir = await getStoredHandle('directory');
    const savedFile = await getStoredHandle('activeFile');
    try {
        let needsPermission = false;
        if (savedDir && await permit(savedDir, fromClick)) {
            state.dir = savedDir;
            $('folderName').textContent = savedDir.name;
            els.tree.replaceChildren();
            await scan(savedDir);
            setStatus(`${state.files.length} 個筆記 · 已恢復資料夾「${savedDir.name}」`);
        } else if (savedDir) {
            needsPermission = true;
            setStatus('上次的資料夾已記住；瀏覽器需要重新授權才能自動開啟。');
        }
        if (savedFile && await permit(savedFile, fromClick)) {
            let item = null;
            for (const candidate of state.files) {
                try {
                    if (await candidate.handle.isSameEntry(savedFile)) { item = candidate; break; }
                } catch { /* 略 */ }
            }
            if (!item) {
                const f = await savedFile.getFile();
                item = { name: f.name, path: f.name, handle: savedFile, parentHandle: null };
                state.files.push(item);
                addRow(item);
            }
            await openNote(item);
            setStatus(`已自動開啟「${item.name}」`);
        } else if (savedFile) needsPermission = true;

        $('resumeLastBtn').classList.toggle('hidden', !needsPermission);
        if (fromClick) $('resumeLastBtn').classList.add('hidden');
    } catch (e) {
        $('resumeLastBtn').classList.remove('hidden');
        setStatus(`恢復上次開啟項目失敗：${e.message}；按下「重新授權」或手動重新開啟。`);
    }
}