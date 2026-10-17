/* 共用 DOM 查詢、state、常數 */

export const $ = (id) => document.getElementById(id);

export const state = {
    files: [],
    active: null,
    dir: null,
    content: '',
    dirty: false,
    showEditor: true,
    showPreview: true,
    showTOC: true
};

export const defaults = {
    accent: '#6558d3',
    background: '#f7f8fc',
    surface: '#ffffff',
    text: '#263148'
};

export const colorInputs = {
    accent: $('accentColor'),
    background: $('backgroundColor'),
    surface: $('surfaceColor'),
    text: $('textColor')
};

export const DEFAULT_WIDTHS = { editor: 0.34, preview: 0.44, toc: 0.22 };
export const MIN_WIDTHS = { editor: 160, preview: 160, toc: 140 };

/* 主要 DOM 快取（皆為 getter，避免模組載入順序問題） */
export const els = {
    get tree() { return $('fileTree'); },
    get viewer() { return $('viewer'); },
    get editor() { return $('editor'); },
    get tocContainer() { return $('tocContainer'); },
    get sidebar() { return $('sidebar'); },
    get editorPane() { return $('editorPane'); },
    get previewPane() { return $('previewPane'); },
    get tocPane() { return $('tocPane'); }
};

/* 狀態列文字 */
export const setStatus = (text) => { $('status').textContent = text; };

/* Dirty 狀態 */
export function setDirty(value) {
    state.dirty = value;
    const el = $('saveState');
    el.textContent = value ? '有未儲存的變更' : '已儲存';
    el.style.color = value ? '#c2410c' : 'var(--muted)';
}

/* 顯示工作區 */
export function showWorkspace() {
    $('welcome').classList.add('hidden');
    $('workspace').classList.remove('hidden');
}

/* 顏色混合 */
export function mix(color, white, amount) {
    return '#' + [1, 3, 5].map((i) =>
        Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - amount) + parseInt(white.slice(i, i + 2), 16) * amount)
            .toString(16).padStart(2, '0')
    ).join('');
}

/* 檔名驗證 */
export function validName(value) {
    let name = value.trim().replace(/[\\/:*?"<>|]/g, '-');
    if (name && !/\.(md|markdown|txt)$/i.test(name)) name += '.md';
    return name;
}