/* 三欄寬度控制、resizer、顯示/隱藏 */

import { $, state, els, DEFAULT_WIDTHS, MIN_WIDTHS } from './config.js';
import { savePrefs } from './prefs.js';

let currentWidths = { ...DEFAULT_WIDTHS };

export function setCurrentWidths(widths) {
    // 確保傳入的寬度是有效的數字，否則使用預設值
    const safeWidths = {};
    for (const key of ['editor', 'preview', 'toc']) {
        const val = widths?.[key];
        safeWidths[key] = (typeof val === 'number' && !isNaN(val) && val > 0) ? val : DEFAULT_WIDTHS[key];
    }
    currentWidths = { ...DEFAULT_WIDTHS, ...safeWidths };
}

export function getCurrentWidths() {
    return currentWidths;
}

export function getPaneWidths() {
    const c = $('resizerContainer');
    const total = c.clientWidth || 1;
    return {
        editor: els.editorPane.offsetWidth / total,
        preview: els.previewPane.offsetWidth / total,
        toc: els.tocPane.offsetWidth / total
    };
}

export function applyPaneWidths(widths) {
    const container = $('resizerContainer');
    const total = container.clientWidth;
    if (!total) return;

    const { showEditor, showPreview, showTOC } = state;

    const resizers = [];
    if (showEditor && showPreview) resizers.push($('resizer1'));
    if ((showEditor || showPreview) && showTOC) resizers.push($('resizer2'));

    const resizerWidth = resizers.reduce((sum, r) => sum + r.offsetWidth + 16, 0);
    const usable = Math.max(0, total - resizerWidth);

    const w = { ...widths };
    if (!showEditor && showPreview) { w.preview += w.editor; w.editor = 0; }
    if (!showPreview && showEditor) { w.editor += w.preview; w.preview = 0; }
    if (!showEditor && !showPreview && showTOC) { w.toc = 1; w.editor = 0; w.preview = 0; }
    if (!showTOC) w.toc = 0;

    const sum = w.editor + w.preview + w.toc || 1;
    w.editor /= sum; w.preview /= sum; w.toc /= sum;

    let tocPx = showTOC ? Math.round(usable * w.toc) : 0;
    if (showTOC) tocPx = Math.max(MIN_WIDTHS.toc, tocPx);

    let editorPx = showEditor ? Math.round(usable * w.editor) : 0;
    let previewPx = showPreview ? Math.round(usable * w.preview) : 0;

    if (showEditor) editorPx = Math.max(MIN_WIDTHS.editor, editorPx);
    if (showPreview) previewPx = Math.max(MIN_WIDTHS.preview, previewPx);

    const diff = usable - (editorPx + previewPx + tocPx);
    if (diff !== 0) {
        if (showPreview && previewPx + diff >= MIN_WIDTHS.preview) previewPx += diff;
        else if (showEditor && editorPx + diff >= MIN_WIDTHS.editor) editorPx += diff;
        else if (showTOC) tocPx += diff;
    }

    els.editorPane.style.flex = showEditor ? `0 0 ${editorPx}px` : '0 0 0px';
    els.previewPane.style.flex = showPreview ? `0 0 ${previewPx}px` : '0 0 0px';
    els.tocPane.style.flex = showTOC ? `0 0 ${tocPx}px` : '0 0 0px';

    els.editorPane.style.display = showEditor ? 'flex' : 'none';
    els.previewPane.style.display = showPreview ? 'flex' : 'none';
    els.tocPane.style.display = showTOC ? 'flex' : 'none';

    const r1 = $('resizer1'), r2 = $('resizer2');
    r1.style.display = (showEditor && showPreview) ? 'block' : 'none';
    r2.style.display = ((showEditor || showPreview) && showTOC) ? 'block' : 'none';
}

export function updatePanels() {
    $('editToggle').textContent = state.showEditor ? '隱藏編輯' : '顯示編輯';
    $('previewToggle').textContent = state.showPreview ? '隱藏預覽' : '顯示預覽';
    $('editToggle').setAttribute('aria-pressed', String(state.showEditor));
    $('previewToggle').setAttribute('aria-pressed', String(state.showPreview));
    applyPaneWidths(currentWidths);
}

export function toggleTOC() {
    state.showTOC = !state.showTOC;
    const btn = $('tocToggleTop');
    btn.textContent = state.showTOC ? '隱藏導覽' : '顯示導覽';
    btn.setAttribute('aria-expanded', String(state.showTOC));
    updatePanels();
}

export function initResizers() {
    const container = $('resizerContainer');
    const r1 = $('resizer1');
    const r2 = $('resizer2');

    let drag = null;

    function onDown(e, which) {
        drag = {
            which,
            startX: e.clientX,
            containerRect: container.getBoundingClientRect(),
            editorW: els.editorPane.offsetWidth,
            previewW: els.previewPane.offsetWidth,
            tocW: els.tocPane.offsetWidth
        };
        r1.classList.add('dragging');
        r2.classList.add('dragging');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    }

    function onMove(e) {
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        let { editorW, previewW, tocW } = drag;
        const { showEditor, showPreview, showTOC } = state;

        if (drag.which === 'resizer1') {
            let newEditor = editorW + dx;
            let newPreview = previewW - dx;
            if (newEditor < MIN_WIDTHS.editor) {
                newEditor = MIN_WIDTHS.editor;
                newPreview = editorW + previewW - MIN_WIDTHS.editor;
            }
            if (newPreview < MIN_WIDTHS.preview) {
                newPreview = MIN_WIDTHS.preview;
                newEditor = editorW + previewW - MIN_WIDTHS.preview;
            }
            editorW = newEditor;
            previewW = newPreview;
        } else if (drag.which === 'resizer2') {
            if (showPreview) {
                let newPreview = previewW + dx;
                let newTOC = tocW - dx;
                if (newPreview < MIN_WIDTHS.preview) {
                    newPreview = MIN_WIDTHS.preview;
                    newTOC = previewW + tocW - MIN_WIDTHS.preview;
                }
                if (newTOC < MIN_WIDTHS.toc) {
                    newTOC = MIN_WIDTHS.toc;
                    newPreview = previewW + tocW - MIN_WIDTHS.toc;
                }
                previewW = newPreview;
                tocW = newTOC;
            } else if (showEditor) {
                let newEditor = editorW + dx;
                let newTOC = tocW - dx;
                if (newEditor < MIN_WIDTHS.editor) {
                    newEditor = MIN_WIDTHS.editor;
                    newTOC = editorW + tocW - MIN_WIDTHS.editor;
                }
                if (newTOC < MIN_WIDTHS.toc) {
                    newTOC = MIN_WIDTHS.toc;
                    newEditor = editorW + tocW - MIN_WIDTHS.toc;
                }
                editorW = newEditor;
                tocW = newTOC;
            }
        }

        els.editorPane.style.flex = showEditor ? `0 0 ${Math.round(editorW)}px` : '0 0 0px';
        els.previewPane.style.flex = showPreview ? `0 0 ${Math.round(previewW)}px` : '0 0 0px';
        els.tocPane.style.flex = showTOC ? `0 0 ${Math.round(tocW)}px` : '0 0 0px';
    }

    function onUp() {
        if (drag) {
            const total = els.editorPane.offsetWidth + els.previewPane.offsetWidth + els.tocPane.offsetWidth || 1;
            // 確保儲存的比例總和為 1
            const e = els.editorPane.offsetWidth / total;
            const p = els.previewPane.offsetWidth / total;
            currentWidths = { editor: e, preview: p, toc: 1 - e - p };
            savePrefs(currentWidths);
        }
        drag = null;
        r1.classList.remove('dragging');
        r2.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }

    r1.addEventListener('mousedown', (e) => onDown(e, 'resizer1'));
    r2.addEventListener('mousedown', (e) => onDown(e, 'resizer2'));

    // 使用 ResizeObserver 監聽容器尺寸變化，並加上強制延遲確保佈局完成
    let rafId = null;
    const observer = new ResizeObserver(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            applyPaneWidths(currentWidths);
        });
    });
    observer.observe(container);

    // 視窗大小改變時也觸發
    window.addEventListener('resize', () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            applyPaneWidths(currentWidths);
        });
    });
}