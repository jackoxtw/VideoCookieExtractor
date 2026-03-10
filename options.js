let customMessages = null;

async function getMessage(key, substitutions) {
    if (customMessages && customMessages[key]) {
        let msg = customMessages[key].message;
        if (substitutions) {
            if (!Array.isArray(substitutions)) substitutions = [substitutions];
            substitutions.forEach((s, i) => {
                msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), s);
                // 處理命名佔位符，如果有的話
                if (customMessages[key].placeholders) {
                    for (let pName in customMessages[key].placeholders) {
                        if (customMessages[key].placeholders[pName].content === `$${i + 1}`) {
                            msg = msg.replace(new RegExp(`\\$${pName}\\$`, 'g'), s);
                        }
                    }
                }
            });
        }
        return msg;
    }
    return chrome.i18n.getMessage(key, substitutions);
}

async function initI18n() {
    const { ui_language = 'auto' } = await chrome.storage.local.get('ui_language');
    if (ui_language !== 'auto') {
        try {
            const resp = await fetch(chrome.runtime.getURL(`_locales/${ui_language}/messages.json`));
            customMessages = await resp.json();
        } catch (e) {
            console.error("Failed to load custom language", e);
        }
    } else {
        customMessages = null;
    }

    const elements = document.querySelectorAll('[data-i18n]');
    for (const el of elements) {
        const key = el.getAttribute('data-i18n');
        const message = await getMessage(key);
        if (message) {
            if (el.tagName === 'TITLE') {
                document.title = message;
            } else if (el.children.length > 0 && el.tagName !== 'BUTTON') {
                el.innerHTML = message;
            } else {
                el.textContent = message;
            }
        }
    }

    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    for (const el of placeholders) {
        const key = el.getAttribute('data-i18n-placeholder');
        const message = await getMessage(key);
        if (message) el.placeholder = message;
    }

    // 更新語系選擇器狀態
    const langSelect = document.getElementById('langSelect');
    if (langSelect) langSelect.value = ui_language;
}

// 監聽語系切換
document.getElementById('langSelect')?.addEventListener('change', async (e) => {
    const newLang = e.target.value;
    await chrome.storage.local.set({ ui_language: newLang });
    location.reload(); // 重新整理完整套用語系
});

const PLATFORMS = {
    disney: {
        name: "Disney+",
        domains: ["disneyplus.com", "disney.com", "bamgrid.com"],
        mainDomain: "disneyplus.com",
        idCookie: "dve_user_id"
    },
    netflix: {
        name: "Netflix",
        domains: ["netflix.com"],
        mainDomain: "netflix.com",
        idCookie: "NetflixId"
    },
    hbo: {
        name: "HBO Max / Max",
        domains: ["hbomax.com", "max.com"],
        mainDomain: "max.com",
        idCookie: "token"
    },
    amazon: {
        name: "Prime Video",
        domains: ["primevideo.com", "amazon.com"],
        mainDomain: "primevideo.com",
        idCookie: "ubid-main"
    }
};

async function startApp() {
    await initI18n();
    await loadProfiles();
}

async function loadProfiles() {
    const { profiles = [], activeProfiles = {} } = await chrome.storage.local.get(['profiles', 'activeProfiles']);
    const container = document.getElementById('profileList');
    const stats = document.getElementById('stats');
    const emptyState = document.getElementById('emptyState');
    const selects = document.querySelectorAll('.p-select');

    // 初始化平台分身選單 (排除語系選單)
    for (const s of selects) {
        if (s.dataset.platform) {
            s.innerHTML = `<option value="">${await getMessage('loadingProfiles')}</option>`;
        }
    }

    stats.textContent = await getMessage('savedProfilesCount', [profiles.length]);
    if (profiles.length === 0) {
        emptyState.style.display = "block";
        container.innerHTML = "";
        return;
    }
    emptyState.style.display = "none";
    container.innerHTML = "";

    // 按平台分組
    const grouped = {};
    profiles.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 預先取得目前的選擇狀態，避免在迴圈中頻繁讀取儲存空間
    const { activeProfiles: currentActiveProfiles = {} } = await chrome.storage.local.get('activeProfiles');

    for (const p of profiles) {
        if (!grouped[p.platform]) {
            grouped[p.platform] = {
                name: p.platformName,
                items: []
            };
        }
        grouped[p.platform].items.push(p);

        // 填入下拉選單
        const platform = PLATFORMS[p.platform];
        if (!platform) continue;

        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;

        // 使用 querySelector 尋找對應平台的下拉選單
        const platformSelect = document.querySelector(`.p-select[data-platform="${p.platform}"]`);
        if (platformSelect) {
            // 如果是目前啟用的，選中它
            if (currentActiveProfiles[p.platform] === p.id) {
                option.selected = true;
            }
            platformSelect.appendChild(option);
        }
    }

    // 依平台順序生成列表
    for (const key in grouped) {
        const group = grouped[key];

        const groupDiv = document.createElement('div');
        groupDiv.className = 'platform-group';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'platform-title';
        titleDiv.textContent = group.name;
        groupDiv.appendChild(titleDiv);

        const groupList = document.createElement('div');
        groupList.className = 'profile-list';

        for (const p of group.items) {
            const item = document.createElement('div');
            item.className = 'profile-item';
            const dateStr = new Date(p.date).toLocaleString();

            item.innerHTML = `
                <div class="profile-info">
                    <div class="profile-name">${p.name}</div>
                    <div class="profile-meta">
                        ${await getMessage('createTime', [dateStr])} • ${await getMessage('cookiesCount', [p.data.cookies.length])}
                    </div>
                </div>
                <div class="actions">
                    <button class="btn-switch" data-id="${p.id}" style="background: var(--success); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer;">⚡ ${await getMessage('save')}</button>
                    <button class="btn-export" data-id="${p.id}" title="${await getMessage('exportFile')}">📤 ${await getMessage('exportFile')}</button>
                    <button class="btn-edit" data-id="${p.id}">✏️ ${await getMessage('saveChanges')}</button>
                    <button class="btn-delete" data-id="${p.id}">🗑️ ${await getMessage('delete')}</button>
                </div>
            `;
            groupList.appendChild(item);
        }

        groupDiv.appendChild(groupList);
        container.appendChild(groupDiv);
    }

    // 重新綁定事件
    container.querySelectorAll('.btn-switch').forEach(btn => {
        btn.addEventListener('click', () => switchToProfile(btn.dataset.id));
    });
    container.querySelectorAll('.btn-export').forEach(btn => {
        btn.addEventListener('click', () => exportProfile(btn.dataset.id));
    });
    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteProfile(btn.dataset.id));
    });
}

// 監聽選單變化
document.querySelectorAll('.p-select').forEach(select => {
    select.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) switchToProfile(id);
    });
});

// --- 切換邏輯移植 ---
async function switchToProfile(id) {
    try {
        const { profiles = [] } = await chrome.storage.local.get('profiles');
        const profile = profiles.find(p => p.id === id);
        if (!profile) return showToast(await getMessage('profileNotFound'));

        const platform = PLATFORMS[profile.platform];
        if (!platform) return showToast(await getMessage('unsupportedPlatform'));

        showToast(await getMessage('switchingTo', [profile.name]));

        for (const domain of platform.domains) {
            const cookies = await chrome.cookies.getAll({ domain: domain });
            for (const cookie of cookies) {
                const url = "https://" + cookie.domain.replace(/^\./, "") + cookie.path;
                await chrome.cookies.remove({ url, name: cookie.name });
            }
        }

        await restoreCookies(profile.data.cookies, platform.domains);
        const storageRestored = await setStorageData({
            local: profile.data.localStorage,
            session: profile.data.sessionStorage
        });

        const { activeProfiles = {} } = await chrome.storage.local.get('activeProfiles');
        activeProfiles[profile.platform] = id;
        await chrome.storage.local.set({ activeProfiles });

        let msg = await getMessage('switchedTo', [profile.name]);
        if (!storageRestored) msg += await getMessage('goToPlatformPageToLoad');
        showToast(msg);
        loadProfiles(); // 重新整理狀態
    } catch (err) {
        showToast(err.message === "無法在系統頁面執行。請開啟對應串流平台網頁。" ? await getMessage('cannotRunOnSystemPage') : await getMessage('switchFailed', [err.message]));
    }
}

async function restoreCookies(cookies, allowedDomains) {
    const now = Date.now() / 1000;
    const oneMonthSec = 30 * 24 * 60 * 60;
    const oneYearSec = 365 * 24 * 60 * 60;

    for (const cookie of cookies) {
        const isTarget = allowedDomains.some(d => cookie.domain.includes(d));
        if (!isTarget) continue;

        let url = "https://" + cookie.domain.replace(/^\./, "") + cookie.path;
        delete cookie.hostOnly;
        delete cookie.session;

        // 智慧型續命：如果到期時間不到一個月，自動續期一年
        let expirationDate = cookie.expirationDate;
        if (expirationDate && (expirationDate - now < oneMonthSec)) {
            expirationDate = now + oneYearSec;
        }

        const newCookie = {
            url: url,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite,
            storeId: cookie.storeId,
            expirationDate: expirationDate
        };
        try { await chrome.cookies.set(newCookie); } catch (e) { }
    }
}

async function setStorageData(data) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
        throw new Error("無法在系統頁面執行。請開啟對應串流平台網頁。");
    }
    const platform = await getCurrentPlatform(tab);
    if (!platform) return false;

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (storageData) => {
            if (storageData.local) {
                for (const key in storageData.local) localStorage.setItem(key, storageData.local[key]);
            }
            if (storageData.session) {
                for (const key in storageData.session) sessionStorage.setItem(key, storageData.session[key]);
            }
        },
        args: [data]
    });
    return true;
}

async function getCurrentPlatform(tab) {
    if (!tab || !tab.url) return null;
    for (const key in PLATFORMS) {
        if (PLATFORMS[key].domains.some(d => tab.url.includes(d))) return { key, ...PLATFORMS[key] };
    }
    return null;
}

function showToast(msg) {
    const toast = document.getElementById('statusToast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// 刪除
async function deleteProfile(id) {
    if (!confirm(await getMessage('confirmDelete'))) return;

    const { profiles = [] } = await chrome.storage.local.get('profiles');
    const filtered = profiles.filter(p => p.id !== id);
    await chrome.storage.local.set({ profiles: filtered });

    showToast(await getMessage('profileDeleted'));
    loadProfiles();
}

// 更名邏輯
let currentEditId = null;
function openEditModal(id) {
    currentEditId = id;
    chrome.storage.local.get('profiles', ({ profiles = [] }) => {
        const p = profiles.find(x => x.id === id);
        if (p) {
            document.getElementById('editNameInput').value = p.name;
            document.getElementById('editModal').style.display = "flex";
            document.getElementById('editNameInput').focus();
        }
    });
}

function closeModal() {
    document.getElementById('editModal').style.display = "none";
}

document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const newName = document.getElementById('editNameInput').value.trim();
    if (!newName) return;

    const { profiles = [] } = await chrome.storage.local.get('profiles');
    const index = profiles.findIndex(p => p.id === currentEditId);
    if (index !== -1) {
        profiles[index].name = newName;
        await chrome.storage.local.set({ profiles });
        showToast(await getMessage('nameUpdated'));
        closeModal();
        loadProfiles();
    }
});

// 單獨匯出
async function exportProfile(id) {
    const { profiles = [] } = await chrome.storage.local.get('profiles');
    const p = profiles.find(x => x.id === id);
    if (!p) return;

    const exportData = {
        exportDate: new Date().toISOString(),
        note: `Exported from Stream Session Pro - Profile: ${p.name}`,
        platform: p.platform,
        cookies: p.data.cookies,
        localStorage: p.data.localStorage,
        sessionStorage: p.data.sessionStorage
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${p.platform}_${p.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(await getMessage('profileExported'));
}

// 批次匯出
document.getElementById('exportAllBtn').addEventListener('click', async () => {
    const { profiles = [] } = await chrome.storage.local.get('profiles');
    if (profiles.length === 0) return showToast(await getMessage('noProfilesToBackup'));

    const data = {
        exportDate: new Date().toISOString(),
        backupType: "all_profiles",
        profiles: profiles
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streaming_profiles_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(await getMessage('backupComplete'));
});

// 匯入邏輯 (含自動偵測)
async function handleImport() {
    const jsonStr = document.getElementById('importArea').value.trim();
    if (!jsonStr) return showToast(await getMessage('importPlaceholder'));

    try {
        const data = JSON.parse(jsonStr);
        let profilesToImport = [];

        // 偵測格式
        const dateObj = data.exportDate ? new Date(data.exportDate) : new Date();
        const importTimeStr = dateObj.toLocaleString();

        if (data.backupType === "all_profiles" && Array.isArray(data.profiles)) {
            // 完整備份格式
            profilesToImport = data.profiles;
        } else {
            // 單一或全平台(舊版)格式，需要拆分
            const cookies = data.cookies || (Array.isArray(data) ? data : []);
            const foundPlatforms = new Set();
            for (const k in PLATFORMS) {
                if (cookies.some(c => PLATFORMS[k].domains.some(d => c.domain.includes(d)))) {
                    foundPlatforms.add(k);
                }
            }

            if (foundPlatforms.size > 0) {
                if (foundPlatforms.size > 1) {
                    // 全平台資料，詢問是否由擴充功能自動拆分儲存為分身
                    if (confirm(await getMessage('confirmAutoSaveProfiles', [foundPlatforms.size]))) {
                        for (const pk of foundPlatforms) {
                            profilesToImport.push({
                                id: Date.now().toString() + pk + Math.random().toString(36).substr(2, 5),
                                name: `Imported-${PLATFORMS[pk].name}-${importTimeStr}`,
                                platform: pk,
                                platformName: PLATFORMS[pk].name,
                                date: new Date().toISOString(),
                                data: {
                                    cookies: cookies.filter(c => PLATFORMS[pk].domains.some(d => c.domain.includes(d))),
                                    localStorage: data.localStorage || {},
                                    sessionStorage: data.sessionStorage || {}
                                }
                            });
                        }
                    }
                } else { // Single platform or user declined auto-split
                    const pk = Array.from(foundPlatforms)[0]; // Get the single platform key
                    profilesToImport.push({
                        id: Date.now().toString() + pk + Math.random().toString(36).substr(2, 5),
                        name: `Imported-${PLATFORMS[pk].name}-${importTimeStr}`,
                        platform: pk,
                        platformName: PLATFORMS[pk].name,
                        date: new Date().toISOString(),
                        data: {
                            cookies: cookies.filter(c => PLATFORMS[pk].domains.some(d => c.domain.includes(d))),
                            localStorage: data.localStorage || {},
                            sessionStorage: data.sessionStorage || {}
                        }
                    });
                }
            }
        }

        if (profilesToImport.length > 0) {
            const { profiles = [] } = await chrome.storage.local.get('profiles');
            const finalToImport = [];

            for (const p of profilesToImport) {
                const platform = PLATFORMS[p.platform];
                if (platform && platform.idCookie) {
                    const idCookieName = platform.idCookie;
                    const incomingIdValue = p.data.cookies.find(c => c.name === idCookieName)?.value;

                    if (incomingIdValue) {
                        const duplicate = profiles.find(ep => {
                            if (ep.platform !== p.platform) return false;
                            const existingCookies = ep.data.cookies || [];
                            return existingCookies.find(c => c.name === idCookieName)?.value === incomingIdValue;
                        });

                        if (duplicate) {
                            if (!confirm(await getMessage('confirmDuplicateImport', [platform.name, duplicate.name]))) {
                                continue; // 跳過此分身
                            }
                        }
                    }
                }
                finalToImport.push(p);
            }

            if (finalToImport.length > 0) {
                const combined = [...profiles, ...finalToImport];
                await chrome.storage.local.set({ profiles: combined });
                document.getElementById('importArea').value = "";
                showToast(await getMessage('importSuccessCount', [finalToImport.length]));
                loadProfiles();
            } else {
                showToast(await getMessage('noProfilesImported'));
            }
        } else {
            showToast(await getMessage('unrecognizedFormat'));
        }
    } catch (e) {
        console.error(e);
        showToast(await getMessage('importFailedFormatError'));
    }
}

document.getElementById('importBtn').addEventListener('click', handleImport);

// 初始化
startApp();
