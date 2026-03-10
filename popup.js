const statusDiv = document.getElementById('status');
const loginStatusDiv = document.getElementById('loginStatus');

let customMessages = null;

async function getMessage(key, substitutions) {
    if (customMessages && customMessages[key]) {
        let msg = customMessages[key].message;
        if (substitutions) {
            if (!Array.isArray(substitutions)) substitutions = [substitutions];
            substitutions.forEach((s, i) => {
                msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), s);
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

// i18n 初始化
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
            if (el.children.length > 0 && el.tagName !== 'BUTTON') {
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
}

const PLATFORMS = {
    disney: {
        name: "Disney+",
        domains: ["disneyplus.com", "disney.com", "bamgrid.com"],
        mainDomain: "disneyplus.com",
        idCookie: "dve_user_id" // Disney+ 核心用戶 ID
    },
    netflix: {
        name: "Netflix",
        domains: ["netflix.com"],
        mainDomain: "netflix.com",
        idCookie: "NetflixId" // Netflix 核心 Session/User ID
    },
    hbo: {
        name: "HBO Max / Max",
        domains: ["hbomax.com", "max.com"],
        mainDomain: "max.com",
        idCookie: "token" // Max 的識別方式可能較複雜，暫定 token
    },
    amazon: {
        name: "Prime Video",
        domains: ["primevideo.com", "amazon.com"],
        mainDomain: "primevideo.com",
        idCookie: "ubid-main" // Amazon 常用識別
    }
};

function setStatus(msg, color = 'dim') {
    statusDiv.textContent = msg;
    statusDiv.style.opacity = "1";

    const colors = {
        green: "#10b981",
        red: "#ef4444",
        dim: "#94a3b8",
        warning: "#f59e0b"
    };

    statusDiv.style.color = colors[color] || colors.dim;

    if (color === 'green' || color === 'dim') {
        setTimeout(() => {
            statusDiv.style.opacity = "0";
            setTimeout(() => { statusDiv.textContent = ""; }, 300);
        }, 5000);
    }
}

async function getSelectedPlatforms() {
    const checks = document.querySelectorAll('.platform-check:checked');
    return Array.from(checks).map(cb => cb.value);
}

async function getAllCookies(filterPlatforms = null) {
    let allCookies = [];
    const platformsToProcess = filterPlatforms || await getSelectedPlatforms();

    for (const key of platformsToProcess) {
        const platform = PLATFORMS[key];
        if (!platform) continue;
        for (const domain of platform.domains) {
            const cookies = await chrome.cookies.getAll({ domain: domain });
            allCookies = [...allCookies, ...cookies];
        }
    }
    return allCookies;
}

// 取得目前 Tab 對應的平台 (用於 LocalStorage)
async function getCurrentPlatform(tab) {
    if (!tab || !tab.url) return null;
    for (const key in PLATFORMS) {
        const platform = PLATFORMS[key];
        if (platform.domains.some(d => tab.url.includes(d))) {
            return { key, ...platform };
        }
    }
    return null;
}

async function getStorageData() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 檢查是否為限制頁面
    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
        return { local: {}, session: {} };
    }

    // 判斷目前 Tab 屬於哪個平台
    const platform = await getCurrentPlatform(tab);
    if (!platform) {
        return { local: {}, session: {} }; // 不支援的網域，不抓 Storage
    }

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => JSON.stringify({
                local: localStorage,
                session: sessionStorage
            })
        });

        if (results && results[0] && results[0].result) {
            return JSON.parse(results[0].result);
        }
    } catch (e) {
        console.warn("無法存取 Storage:", e);
    }
    return { local: {}, session: {} };
}

async function setStorageData(data) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
        throw new Error("無法在系統頁面執行。請開啟對應串流平台網頁。");
    }

    const platform = await getCurrentPlatform(tab);
    if (!platform) {
        // 如果目前不是支援的平台，我們就只匯入 Cookie，忽略 Storage
        // 但最好提示使用者
        console.warn("目前頁面不屬於任何已知平台，跳過 LocalStorage 還原");
        return false;
    }

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (storageData) => {
            if (storageData.local) {
                for (const key in storageData.local) {
                    localStorage.setItem(key, storageData.local[key]);
                }
            }
            if (storageData.session) {
                for (const key in storageData.session) {
                    sessionStorage.setItem(key, storageData.session[key]);
                }
            }
        },
        args: [data]
    });
    return true; // 成功還原 Storage
}

async function checkLoginStatus() {
    try {
        const selected = await getSelectedPlatforms();
        if (selected.length === 0) {
            loginStatusDiv.textContent = await getMessage('selectAtLeastOne');
            loginStatusDiv.style.background = "rgba(245, 158, 11, 0.1)";
            loginStatusDiv.style.color = "#f59e0b";
            loginStatusDiv.style.borderColor = "rgba(245, 158, 11, 0.3)";
            return;
        }

        const cookies = await getAllCookies(selected);
        if (cookies && cookies.length > 0) {
            loginStatusDiv.textContent = await getMessage('detectedCookies', [cookies.length, selected.length]);
            loginStatusDiv.style.background = "rgba(16, 185, 129, 0.1)";
            loginStatusDiv.style.color = "#10b981";
            loginStatusDiv.style.borderColor = "rgba(16, 185, 129, 0.3)";
        } else {
            loginStatusDiv.textContent = await getMessage('noCookiesDetected');
            loginStatusDiv.style.background = "rgba(239, 68, 68, 0.1)";
            loginStatusDiv.style.color = "#ef4444";
            loginStatusDiv.style.borderColor = "rgba(239, 68, 68, 0.3)";
        }
    } catch (e) {
        loginStatusDiv.textContent = await getMessage('statusUnknown');
        loginStatusDiv.style.background = "rgba(148, 163, 184, 0.1)";
        loginStatusDiv.style.color = "#94a3b8";
        loginStatusDiv.style.borderColor = "var(--border)";
    }
}

// 監聽 Checkbox 變化
document.querySelectorAll('.platform-check').forEach(cb => {
    cb.addEventListener('change', checkLoginStatus);
});

// 全選 / 清空按鈕
document.getElementById('selectAllBtn').addEventListener('click', () => {
    document.querySelectorAll('.platform-check').forEach(cb => cb.checked = true);
    checkLoginStatus();
});
document.getElementById('selectNoneBtn').addEventListener('click', () => {
    document.querySelectorAll('.platform-check').forEach(cb => cb.checked = false);
    checkLoginStatus();
});

// 摺疊邏輯
document.getElementById('togglePlatform').addEventListener('click', () => {
    document.getElementById('platformCard').classList.toggle('open');
});

checkLoginStatus();

// 0. 顯示 Cookies
document.getElementById('showBtn').addEventListener('click', async () => {
    try {
        const cookies = await getAllCookies();
        const storage = await getStorageData();

        const data = {
            note: "Contains Cookies for all platforms, Storage only for current active tab.",
            exportDate: new Date().toISOString(),
            cookies: cookies,
            localStorage: storage.local,
            sessionStorage: storage.session
        };

        const jsonStr = JSON.stringify(data, null, 2);
        document.getElementById('importArea').value = jsonStr;
        setStatus(`已顯示全平台 Cookies`, "green");
    } catch (err) {
        setStatus(err.message, "red");
    }
});

// 1. 複製
document.getElementById('copyBtn').addEventListener('click', async () => {
    try {
        const cookies = await getAllCookies();
        const storage = await getStorageData();

        const data = {
            exportDate: new Date().toISOString(),
            cookies,
            localStorage: storage.local,
            sessionStorage: storage.session
        };
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setStatus(`已複製全平台資料`, "green");
    } catch (err) {
        setStatus(err.message, "red");
    }
});

// 2. 匯出
document.getElementById('exportBtn').addEventListener('click', async () => {
    try {
        const cookies = await getAllCookies();
        const storage = await getStorageData();

        const data = {
            exportDate: new Date().toISOString(),
            cookies,
            localStorage: storage.local,
            sessionStorage: storage.session
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "streaming_session.json";
        a.click();
        URL.revokeObjectURL(url);
        setStatus(`已匯出`, "green");
    } catch (err) {
        setStatus(err.message, "red");
    }
});

// --- 分身管理邏輯 ---

async function saveCurrentProfile(name) {
    if (!name) return setStatus(await getMessage('enterProfileName'), "red");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const platform = await getCurrentPlatform(tab);

    if (!platform) {
        return setStatus(await getMessage('saveOnPlatformPage'), "red");
    }

    const cookies = await chrome.cookies.getAll({ domain: platform.mainDomain });
    // 同時抓取所有關聯網域的 Cookies
    let allCookies = [];
    for (const domain of platform.domains) {
        const domainCookies = await chrome.cookies.getAll({ domain: domain });
        allCookies = [...allCookies, ...domainCookies];
    }

    const storage = await getStorageData();

    const newProfile = {
        id: Date.now().toString(),
        name: name,
        platform: platform.key,
        platformName: platform.name,
        date: new Date().toISOString(),
        data: {
            cookies: allCookies,
            localStorage: storage.local,
            sessionStorage: storage.session
        }
    };

    const { profiles = [] } = await chrome.storage.local.get('profiles');
    profiles.push(newProfile);
    await chrome.storage.local.set({ profiles });

    setStatus(await getMessage('profileSaved', [name]), "green");
    renderProfiles();
}

async function startApp() {
    await initI18n();
    await renderProfiles();
    checkLoginStatus();
}

async function renderProfiles() {
    const { profiles = [], activeProfiles = {} } = await chrome.storage.local.get(['profiles', 'activeProfiles']);
    const selects = document.querySelectorAll('.p-select');

    // 初始化所有平台選單
    for (const s of selects) {
        if (s.dataset.platform) {
            s.innerHTML = `<option value="">${await getMessage('loadingProfiles')}</option>`;
        }
    }

    if (profiles.length === 0) return;

    // 依日期排序，新的在前
    profiles.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 將分身填入對應平台的選單
    for (const p of profiles) {
        const platform = PLATFORMS[p.platform];
        if (!platform) continue;

        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;

        const platformSelect = document.querySelector(`.p-select[data-platform="${p.platform}"]`);
        if (platformSelect) {
            // 如果是目前啟用的，選中它
            if (activeProfiles[p.platform] === p.id) {
                option.selected = true;
            }
            platformSelect.appendChild(option);
        }
    }
}

// 監聽所有下拉選單變化
document.querySelectorAll('.p-select').forEach(select => {
    select.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) {
            switchToProfile(id);
        }
    });
});

async function switchToProfile(id) {
    try {
        const { profiles = [] } = await chrome.storage.local.get('profiles');
        const profile = profiles.find(p => p.id === id);
        if (!profile) return setStatus(await getMessage('profileNotFound'), "red");

        const platform = PLATFORMS[profile.platform];
        if (!platform) return setStatus(await getMessage('unsupportedPlatform'), "red");

        // 1. 清除該平台所有網域的 Cookies
        for (const domain of platform.domains) {
            const cookies = await chrome.cookies.getAll({ domain: domain });
            for (const cookie of cookies) {
                const url = "https://" + cookie.domain.replace(/^\./, "") + cookie.path;
                await chrome.cookies.remove({ url, name: cookie.name });
            }
        }

        // 2. 還原 Cookies
        await restoreCookies(profile.data.cookies, platform.domains);

        // 3. 還原 Storage
        const storageRestored = await setStorageData({
            local: profile.data.localStorage,
            session: profile.data.sessionStorage
        });

        // 4. 紀錄此平台目前啟用的分身
        const { activeProfiles = {} } = await chrome.storage.local.get('activeProfiles');
        activeProfiles[profile.platform] = id;
        await chrome.storage.local.set({ activeProfiles });

        let msg = await getMessage('switchedTo', [profile.name]);
        if (!storageRestored) msg += await getMessage('goToPlatformPageToLoad');
        setStatus(msg, "green");
        checkLoginStatus();
    } catch (err) {
        if (err.message === "無法在系統頁面執行。請開啟對應串流平台網頁。") {
            setStatus(await getMessage('cannotRunOnSystemPage'), "red");
        } else {
            console.error(err);
            setStatus(await getMessage('switchFailed', [err.message]), "red");
        }
    }
}

async function restoreCookies(cookies, allowedDomains) {
    let count = 0;
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
        try {
            await chrome.cookies.set(newCookie);
            count++;
        } catch (e) { }
    }
    return count;
}

// 處理匯入邏輯 (含自動偵測與舊版相容)
async function handleImport(jsonStr) {
    if (!jsonStr) return setStatus("請輸入 JSON", "red");
    try {
        const data = JSON.parse(jsonStr);
        const selected = await getSelectedPlatforms();

        const cookies = data.cookies || (Array.isArray(data) ? data : []);
        const foundPlatforms = new Set();
        for (const k in PLATFORMS) {
            const p = PLATFORMS[k];
            if (cookies.some(c => p.domains.some(d => c.domain.includes(d)))) {
                foundPlatforms.add(k);
            }
        }

        // 解析並格式化匯入時間 (相容處理)
        const dateObj = data.exportDate ? new Date(data.exportDate) : new Date();
        const importTimeStr = dateObj.toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '-');

        if (foundPlatforms.size > 1) {
            // 全平台資料，詢問是否由擴充功能自動拆分儲存為分身
            if (confirm(await getMessage('confirmAutoSaveProfiles', [foundPlatforms.size]))) {
                for (const pk of foundPlatforms) {
                    const platform = PLATFORMS[pk];
                    const pCookies = cookies.filter(c => platform.domains.some(d => c.domain.includes(d)));

                    const { profiles = [] } = await chrome.storage.local.get('profiles');

                    // 檢查重覆用戶
                    const idCookie = platform.idCookie;
                    const incomingIdValue = pCookies.find(c => c.name === idCookie)?.value;

                    if (incomingIdValue) {
                        const duplicate = profiles.find(p => {
                            if (p.platform !== pk) return false;
                            const existingCookies = p.data.cookies || [];
                            return existingCookies.find(c => c.name === idCookie)?.value === incomingIdValue;
                        });

                        if (duplicate) {
                            if (!confirm(await getMessage('confirmDuplicateImport', [platform.name, duplicate.name]))) {
                                continue;
                            }
                        }
                    }

                    profiles.push({
                        id: Date.now().toString() + pk + Math.random().toString(36).substr(2, 5),
                        name: `Imported-${platform.name}-${importTimeStr}`,
                        platform: pk,
                        platformName: platform.name,
                        date: new Date().toISOString(),
                        data: {
                            cookies: pCookies,
                            localStorage: data.localStorage || {},
                            sessionStorage: data.sessionStorage || {}
                        }
                    });
                    await chrome.storage.local.set({ profiles });
                }
                setStatus(await getMessage('autoSplitProfilesSuccess'), "green");
                renderProfiles();
                return;
            }
        }

        // 一般匯入邏輯
        if (selected.length === 0) return setStatus(await getMessage('selectImportPlatform'), "red");

        const allowedDomains = [];
        selected.forEach(k => {
            if (PLATFORMS[k]) allowedDomains.push(...PLATFORMS[k].domains);
        });

        const cookieCount = await restoreCookies(cookies, allowedDomains);
        const storageRestored = await setStorageData({
            local: data.localStorage || {},
            session: data.sessionStorage || {}
        });

        let msg = await getMessage('importedCookies', [cookieCount]);
        if (storageRestored) msg += await getMessage('storageRestored');
        setStatus(msg, "green");
        checkLoginStatus();
    } catch (err) {
        console.error(err);
        setStatus(await getMessage('executionError', [err.message]), "red");
    }
}

// 3. 匯入按鈕綁定
document.getElementById('importBtn').addEventListener('click', () => {
    handleImport(document.getElementById('importArea').value);
});

// 單獨綁定快速儲存
document.getElementById('saveProfileBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('profileName');
    saveCurrentProfile(nameInput.value);
    nameInput.value = "";
});

// 開啟管理頁面
document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
});

// 初始化
startApp();
