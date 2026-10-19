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

/* ---------- 新增筆記：自訂 modal（與 shareModal 相同顯示邏輯，避免跑版） ---------- */

/* 收集目前資料夾內所有子資料夾（含根目錄，路徑用 '' 表示） */
async function collectSubDirs(dir, path = '', out = [{ label: '（根目錄）', path: '', handle: dir }]) {
    try {
        for await (const e of dir.values()) {
            if (e.kind !== 'directory') continue;
            const p = path ? `${path}/${e.name}` : e.name;
            out.push({ label: p, path: p, handle: e });
            await collectSubDirs(e, p, out);
        }
    } catch { /* 略過無法列舉的資料夾 */ }
    return out;
}

/* 依相對路徑從 rootDir 取得（或建立）目標子資料夾 handle */
async function resolveDirByPath(rootDir, relPath) {
    if (!relPath) return rootDir;
    let dir = rootDir;
    for (const part of relPath.split('/').filter(Boolean)) {
        dir = await dir.getDirectoryHandle(part, { create: true });
    }
    return dir;
}

/* 目前 active 筆記所在的相對資料夾路徑（預設存放位置用） */
function getParentPathOfActive() {
    const p = state.active?.path;
    if (!p || !p.includes('/')) return '';
    return p.slice(0, p.lastIndexOf('/'));
}

function closeNewNoteModal() {
    const modal = $('newNoteModal');
    if (!modal) return;
    const panel = modal.querySelector('div');
    modal.classList.add('opacity-0');
    panel.classList.remove('scale-100');
    panel.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
}

function openNewNoteModal() {
    const modal = $('newNoteModal');
    if (!modal) { setStatus('找不到新增筆記視窗元素。'); return; }

    const nameInput = $('newNoteName');
    const dirSelect = $('newNoteDir');
    const dirHint = $('newNoteDirHint');
    const hint = $('newNoteHint');
    const panel = modal.querySelector('div');

    // 填入存放位置清單
    dirSelect.innerHTML = '';
    if (state.dir) {
        const rootOpt = document.createElement('option');
        rootOpt.value = '';
        rootOpt.textContent = '（根目錄）';
        dirSelect.appendChild(rootOpt);

        collectSubDirs(state.dir).then((dirs) => {
            const prevValue = dirSelect.value;
            dirSelect.innerHTML = '';
            dirSelect.appendChild(rootOpt);
            for (const d of dirs) {
                if (!d.path) continue;
                const opt = document.createElement('option');
                opt.value = d.path;
                opt.textContent = d.label;
                dirSelect.appendChild(opt);
            }
            const want = prevValue || getParentPathOfActive();
            if (want) {
                const matched = Array.from(dirSelect.options).find((o) => o.value === want);
                if (matched) matched.selected = true;
            }
        });

        dirHint.textContent = '只列出已開啟資料夾內的子資料夾。';
    } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '（尚未開啟資料夾，建立時會另存新檔）';
        dirSelect.appendChild(opt);
        dirHint.textContent = '尚未開啟資料夾，建立時會跳出另存新檔對話框。';
    }

    nameInput.value = '新筆記';
    hint.classList.add('hidden');
    hint.textContent = '';

    // 顯示：先移除 hidden，下一幀再處理 opacity / scale（與 shareModal 一致）
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        panel.classList.remove('scale-95');
        panel.classList.add('scale-100');
        nameInput.focus();
        nameInput.select();
    });

    $('newNoteCancel').onclick = closeNewNoteModal;

    $('newNoteConfirm').onclick = async () => {
        const raw = nameInput.value;
        const fileName = validName(raw);
        if (!fileName) {
            hint.textContent = '請輸入有效檔名。';
            hint.classList.remove('hidden');
            return;
        }

        try {
            /* 情況 A：已有資料夾 → 直接寫入指定子資料夾（不需要任何 picker） */
            if (state.dir) {
                const relPath = dirSelect.value;
                const targetDir = await resolveDirByPath(state.dir, relPath);

                let exists = false;
                try {
                    await targetDir.getFileHandle(fileName);
                    exists = true;
                } catch (e) {
                    if (e.name !== 'NotFoundError') throw e;
                }

                const handle = await targetDir.getFileHandle(fileName, { create: true });
                if (!exists) await writeHandle(handle, '');

                closeNewNoteModal();
                await rebuildTree();

                const fullPath = relPath ? `${relPath}/${fileName}` : fileName;
                const createdItem =
                    state.files.find((f) => f.path === fullPath)
                    || { name: fileName, path: fullPath, handle, parentHandle: targetDir };

                if (exists) {
                    const f = await handle.getFile();
                    state.content = await f.text();
                    els.editor.value = state.content;
                    setDirty(false);
                    activate(createdItem);
                    showWorkspace();
                    render();
                    setStatus(`「${fullPath}」已存在，已為你開啟原檔案。`);
                } else {
                    state.content = '';
                    els.editor.value = '';
                    activate(createdItem);
                    showWorkspace();
                    setDirty(false);
                    els.editor.focus();
                    setStatus(`新筆記已建立：${fullPath}`);
                }
                return;
            }

            /* 情況 B：尚未開啟資料夾 → Save Picker
               此按鈕 click 為新鮮手勢，呼叫 picker 是安全的 */
            if (!('showSaveFilePicker' in window)) {
                hint.textContent = '此瀏覽器不支援另存新檔，請先「開啟資料夾」。';
                hint.classList.remove('hidden');
                return;
            }

            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'Markdown 文件', accept: { 'text/markdown': ['.md'] } }]
            });

            const file = await handle.getFile();
            const item = {
                name: file.name,
                path: file.name,
                handle,
                parentHandle: null
            };
            state.files.push(item);

            closeNewNoteModal();
            await rebuildTree();

            state.content = '';
            els.editor.value = '';
            activate(item);
            showWorkspace();
            setDirty(false);
            els.editor.focus();
            setStatus('新筆記已建立，編輯後按「儲存」');
        } catch (e) {
            if (e.name === 'AbortError') return; // 使用者取消 picker，保留 modal
            hint.textContent = `建立失敗：${e.message}`;
            hint.classList.remove('hidden');
        }
    };
}

export async function newFile() {
    if (!await confirmDiscard()) return;
    openNewNoteModal();
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