/* localStorage 偏好、顏色套用、manifest 產生 */

import { $, state, defaults, colorInputs, mix } from './config.js';

const PREFS_KEY = 'MavMD設定';

/* 讀取偏好 */
export function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); }
    catch { return {}; }
}

/* 儲存偏好（會 callback 給外部提供 paneWidths） */
export function savePrefs(paneWidths) {
    try {
        const payload = {
            colors: Object.fromEntries(
                Object.entries(colorInputs).map(([key, input]) => [key, input.value])
            ),
            folder: state.dir?.name || ''
        };
        if (paneWidths) payload.widths = paneWidths;
        localStorage.setItem(PREFS_KEY, JSON.stringify(payload));
    } catch { /* 略 */ }
}

/* 套用顏色 */
export function applyColors(colors = {}) {
    for (const key in defaults) {
        const value = /^#[0-9a-f]{6}$/i.test(colors[key] || '') ? colors[key] : defaults[key];
        colorInputs[key].value = value;

        const cssVar =
            key === 'background' ? 'canvas'
                : key === 'surface' ? 'surface'
                    : key === 'text' ? 'ink'
                        : 'accent';
        document.documentElement.style.setProperty(`--${cssVar}`, value);

        if (key === 'accent') {
            document.documentElement.style.setProperty('--accent-soft', mix(value, '#ffffff', .9));
            let meta = document.querySelector('meta[name="theme-color"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'theme-color';
                document.head.appendChild(meta);
            }
            meta.content = value;
        }
    }
}

/* ---------- Manifest 產生 ---------- */
function makePngIconDataUrl(color, size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = size * 0.166;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.57}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', size / 2, size * 0.55);

    return canvas.toDataURL('image/png');
}

export function buildManifest(accent) {
    return {
        name: 'MavMD Markdown 工作台',
        short_name: 'MavMD',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f8fc',
        theme_color: accent,
        icons: [
            { src: makePngIconDataUrl(accent, 192), sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: makePngIconDataUrl(accent, 512), sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
    };
}

export function applyManifest(accent) {
    const data = buildManifest(accent);
    $('pwaManifest').href =
        'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data));
    return data;
}

export function makeIconPreview(color, size) {
    return makePngIconDataUrl(color, size);
}