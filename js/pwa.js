/* Service Worker 註冊、install prompt、icon wizard、toast */

import { $ } from './config.js';
import { applyManifest, makeIconPreview } from './prefs.js';

/* ---------- SW 註冊（外部檔案） ---------- */
export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('SW 註冊成功:', reg.scope))
            .catch((err) => console.error('SW 註冊失敗:', err));
    });
}

/* ---------- PWA 安裝按鈕 ---------- */
let deferredPrompt = null;

export function initInstallPrompt() {
    const installBtn = $('installPwaBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn?.classList.remove('hidden');
    });

    if (installBtn) {
        installBtn.onclick = async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') installBtn.classList.add('hidden');
            deferredPrompt = null;
        };
    }

    window.addEventListener('appinstalled', () => {
        installBtn?.classList.add('hidden');
        console.log('MavMD PWA 已成功安裝至桌面');
    });
}

export function hasDeferredPrompt() {
    return !!deferredPrompt;
}

/* ---------- Icon Wizard ---------- */
let pendingAccent = null;

export function openIconWizard(accent) {
    pendingAccent = accent;
    $('iconPreview192').src = makeIconPreview(accent, 192);
    $('iconPreview512').src = makeIconPreview(accent, 512);
    $('iconWizard').classList.add('show');
    $('iconWizard').setAttribute('aria-hidden', 'false');
}

export function closeIconWizard() {
    $('iconWizard').classList.remove('show');
    $('iconWizard').setAttribute('aria-hidden', 'true');
    pendingAccent = null;
}

/* ---------- Toast ---------- */
export function showToast(text, actionLabel, actionFn, duration = 8000) {
    const toast = $('iconToast');
    $('iconToastText').textContent = text;

    const btn = $('iconToastAction');
    if (actionLabel && actionFn) {
        btn.textContent = actionLabel;
        btn.classList.remove('hidden');
        btn.onclick = () => {
            actionFn();
            toast.classList.remove('show');
        };
    } else {
        btn.classList.add('hidden');
        btn.onclick = null;
    }

    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ---------- 綁定 wizard 事件 ---------- */
export function initIconWizard() {
    $('iconWizardCancel').onclick = closeIconWizard;

    $('iconWizardConfirm').onclick = () => {
        if (!pendingAccent) return closeIconWizard();
        const accent = pendingAccent;
        applyManifest(accent);
        closeIconWizard();

        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;

        if (hasDeferredPrompt()) {
            showToast('App 圖示已更新，下次安裝時會套用新顏色。');
        } else if (isStandalone) {
            showToast(
                'App 圖示已更新。已安裝的 App 需卸載後重新安裝才會換圖示。',
                '了解', () => { }
            );
        } else {
            showToast('App 圖示已更新。若你已安裝過 App，請卸載後重新安裝才會生效。');
        }
    };

    $('iconWizard').addEventListener('click', (e) => {
        if (e.target === $('iconWizard')) closeIconWizard();
    });
}