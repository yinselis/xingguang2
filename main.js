
    // 时间格式化小工具（秒转时分秒）
window.formatMuteTime = function(secs) {
    if (secs === 0) return '永久';
    if (secs < 60) return secs + '秒';
    if (secs < 3600) {
        let m = Math.floor(secs / 60);
        let s = secs % 60;
        return m + '分钟' + (s > 0 ? s + '秒' : '');
    }
    if (secs < 86400) {
        let h = Math.floor(secs / 3600);
        let m = Math.floor((secs % 3600) / 60);
        return h + '小时' + (m > 0 ? m + '分钟' : '');
    }
    let d = Math.floor(secs / 86400);
    let h = Math.floor((secs % 86400) / 3600);
    return d + '天' + (h > 0 ? h + '小时' : '');
};

    // ==== 全局优雅消息提示窗 (Toast) ====
window.showToast = function(msg) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.cssText = 'position:fixed; top:-50px; left:50%; transform:translateX(-50%); background:var(--surface); color:var(--text-main); padding:12px 24px; border-radius:24px; font-size:13px; font-weight:bold; z-index:99999; box-shadow:0 8px 24px rgba(184,156,142,0.4); opacity:0; transition:opacity 0.4s, top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); border: 1.5px solid rgba(184,156,142,0.2); max-width: 85vw; text-align: center;';
    document.body.appendChild(toast);
    
    // 弹性掉落动画
    setTimeout(() => { toast.style.opacity = '1'; toast.style.top = '45px'; }, 10);
    // 3.5秒后收回
    setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '-50px'; }, 1800);
// 彻底销毁
setTimeout(() => toast.remove(), 2200);
}

        const pagesWrapper = document.getElementById('pagesWrapper');
        

        const DB_NAME = 'AestheticDesktopDB';
        const STORE_NAME = 'allDataStore';

        function initDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 2);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME);
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        async function saveToDB(key, value) {
            try {
                const db = await initDB();
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(value, key);
            } catch (e) {}
        }

        async function loadFromDB(key) {
            return new Promise(async (resolve) => {
                try {
                    const db = await initDB();
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const req = tx.objectStore(STORE_NAME).get(key);
                    req.onsuccess = () => resolve(req.result);
                } catch (e) { resolve(null); }
            });
        }

        const allWidgets = document.querySelectorAll('.custom-widget');
        
        async function restoreEverything() {
    const promises = [];
    
    // 提早读取性能模式
    loadFromDB('perfMode').then(isOn => { if(isOn) document.body.classList.add('perf-mode'); });
loadFromDB('noBlurMode').then(isOn => { if(isOn) document.body.classList.add('no-blur-mode'); });

    allWidgets.forEach((widget) => {
    promises.push(
        loadFromDB(widget.id + '_alpha').then(savedAlpha => {
            if (savedAlpha !== undefined && savedAlpha !== null) widget.style.setProperty('--bg-alpha', savedAlpha);
        }),
        loadFromDB(widget.id + '_blur').then(savedBlur => {
            if (savedBlur !== undefined && savedBlur !== null) widget.style.setProperty('--bg-blur', savedBlur + 'px');
        }),
        loadFromDB(widget.id + '_glow').then(savedGlow => {
            if (savedGlow !== undefined && savedGlow !== null) widget.style.setProperty('--custom-glow', savedGlow + 'px');
        }),
        loadFromDB(widget.id + '_tAlpha').then(savedTAlpha => {
            if (savedTAlpha !== undefined && savedTAlpha !== null) widget.style.setProperty('--custom-alpha', savedTAlpha);
        }),
        loadFromDB(widget.id + '_font').then(savedFont => {
            if (savedFont !== undefined && savedFont !== null) widget.style.setProperty('--custom-font', savedFont);
        })
    );
});

// 开机读取桌面壁纸
promises.push(
    loadFromDB('desktopWallpaper_file').then(file => {
        if (file) {
            const url = URL.createObjectURL(file);
            document.body.style.backgroundImage = `url(${url})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
        }
    })
);

    // 开机读取所有自定义 APP 图标
    const appNames = ['聊天','信笺','记账','设置','日记','角色','指令','美化','食谱','经期','阅读','梦境'];
    appNames.forEach(name => {
        promises.push(
            loadFromDB('app_icon_' + name).then(data => {
                // 如果库里有存本地图片或网络链接，直接覆盖过去
                if (data && typeof window.applyCustomIcon === 'function') {
                    window.applyCustomIcon(name, data);
                }
            })
        );
    });
    
    const imageKeys = ['photoImg1', 'badgeImg', 'journalImg', 'lyricImg'];
    imageKeys.forEach((key) => {
        promises.push(
            loadFromDB(key + '_file').then(file => {
                if (file) {
                    const url = URL.createObjectURL(file);
                    document.getElementById(key).style.backgroundImage = `url(${url})`;
                    document.getElementById(key).style.border = 'none';
                    let icon = document.getElementById(key.replace('Img', 'Icon') || 'photoIcon1');
                    if(icon) icon.style.display = 'none';
                }
            })
        );
    });

    // 预加载所有的角色头像进内存，开屏即完成
promises.push(
    loadFromDB('ai_characters').then(async chars => {
        if(chars) {
            for(let char of chars) {
                if (!window.diaryAvatarCache) window.diaryAvatarCache = {};
                if (window.diaryAvatarCache[char.id] === undefined) {
                    const f = await loadFromDB(`char_avatar_${char.id}`);
                    window.diaryAvatarCache[char.id] = f ? URL.createObjectURL(f) : '';
                }
            }
        }
    })
);

promises.push(
loadFromDB('jText1').then(t1 => { if (t1) document.getElementById('jText1').innerText = t1; }),
    loadFromDB('jText2').then(t2 => { if (t2) document.getElementById('jText2').innerText = t2; }), // <--- 就是补上这个逗号！
    loadFromDB('calCustomText').then(t => { if (t) document.getElementById('calCustomText').innerText = t; }),
    loadFromDB('lyricText').then(lt => { if (lt) document.getElementById('lyricText').innerHTML = lt; })
);

    // 等待所有数据和图片从数据库加载完毕
    await Promise.all(promises);
    
    // 【新增】：在后台偷偷提前把角色列表渲染好！
    if (typeof renderCharacterList === 'function') {
        renderCharacterList();
    }

    // 加载完后，稍微延迟 0.3 秒让渲染跟上，然后丝滑隐藏开屏界面
    setTimeout(() => {
        document.getElementById('splashScreen').classList.add('hidden');
    }, 1200);
}
restoreEverything();

        document.getElementById('jText1').addEventListener('blur', (e) => saveToDB('jText1', e.target.innerText));
        document.getElementById('calCustomText').addEventListener('blur', (e) => saveToDB('calCustomText', e.target.innerText));
        // ====== 歌词点击编辑逻辑 ======
const lyricEditPanel = document.getElementById('lyricEditPanel');
const editTitle = document.getElementById('editTitle');
const editContent = document.getElementById('editContent');
const lyricText = document.getElementById('lyricText');

// 点击歌词区域唤起高级面板
lyricText.addEventListener('click', () => {
    const divs = lyricText.querySelectorAll('div');
    if (divs.length > 0) {
        editTitle.value = divs[0].innerText;
        let contentArr = [];
        for(let i=1; i<divs.length; i++) contentArr.push(divs[i].innerText);
        editContent.value = contentArr.join('\n');
    }
    overlay.classList.add('show');
    lyricEditPanel.classList.add('show');
});

// 拼接文字并保存
document.getElementById('saveLyricBtn').addEventListener('click', () => {
    const title = editTitle.value.trim();
    const lines = editContent.value.split('\n');
    
    let newHTML = `<div>${title || '未命名标题'}</div>`;
    lines.forEach(line => {
        if(line.trim() !== '') newHTML += `<div>${line}</div>`;
    });
    
    lyricText.innerHTML = newHTML;
    saveToDB('lyricText', newHTML); // 真实存入数据库
    
    lyricEditPanel.classList.remove('show');
    overlay.classList.remove('show');
});
        document.getElementById('jText2').addEventListener('blur', (e) => saveToDB('jText2', e.target.innerText));

        const globalUpload = document.getElementById('globalImageUpload');
        let currentUploadTargetId = null;

        function triggerUpload(targetId) {
            currentUploadTargetId = targetId;
            globalUpload.click();
        }

        globalUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentUploadTargetId) {
                const url = URL.createObjectURL(file);
if (currentUploadTargetId === 'desktopWallpaper') return;
if (currentUploadTargetId === 'charEditAvatar') return;
const targetEl = document.getElementById(currentUploadTargetId);
                targetEl.style.backgroundImage = `url(${url})`;
                targetEl.style.border = 'none';
                let iconId = currentUploadTargetId.replace('Img', 'Icon');
                if(currentUploadTargetId === 'photoImg1') iconId = 'photoIcon1';
                let icon = document.getElementById(iconId);
                if(icon) icon.style.display = 'none';
                
                await saveToDB(currentUploadTargetId + '_file', file);
            }
            globalUpload.value = ''; 
        });

        // 依然是：点击唱片主体 = 上传相片
        document.getElementById('photoImg1').addEventListener('click', () => triggerUpload('photoImg1'));
        document.getElementById('badgeImg').addEventListener('click', () => triggerUpload('badgeImg'));
        document.getElementById('journalImg').addEventListener('click', () => triggerUpload('journalImg'));
        document.getElementById('lyricImg').addEventListener('click', () => triggerUpload('lyricImg'));
        

        // ====== 专属控制：点击唱针 = 播放/停止动画 ======
        const badgeWidget = document.getElementById('badgeWidget');
        const tonearmBtn = document.getElementById('tonearmBtn');
        tonearmBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发其他事件
            badgeWidget.classList.toggle('playing');
        });

        const settingsPanel = document.getElementById('settingsPanel');
        const overlay = document.getElementById('overlay');
        const alphaSlider = document.getElementById('alphaSlider');
        const blurSlider = document.getElementById('blurSlider');
        const alphaValueText = document.getElementById('alphaValue');
        const blurValueText = document.getElementById('blurValue');
        let activeWidget = null; 

        function openSettings(widget) {
    activeWidget = widget;
    let currentAlpha = widget.style.getPropertyValue('--bg-alpha') || 1;
    let currentBlur = widget.style.getPropertyValue('--bg-blur') || '0px';
    currentBlur = currentBlur.replace('px', ''); 

    let currentGlow = widget.style.getPropertyValue('--custom-glow') || '10px';
    let currentTextAlpha = widget.style.getPropertyValue('--custom-alpha') || 1;
    let currentFont = widget.style.getPropertyValue('--custom-font') || '"Times New Roman", Georgia, serif';
    currentGlow = currentGlow.replace('px', ''); 

    alphaSlider.value = currentAlpha;
    blurSlider.value = currentBlur;
    alphaValueText.innerText = Math.round(currentAlpha * 100) + '%';
    blurValueText.innerText = currentBlur + 'px';
    
    document.getElementById('glowSlider').value = currentGlow;
    document.getElementById('glowValue').innerText = currentGlow + 'px';
    document.getElementById('textAlphaSlider').value = currentTextAlpha;
    document.getElementById('textAlphaValue').innerText = Math.round(currentTextAlpha * 100) + '%';
    document.getElementById('fontSelect').value = currentFont;

    overlay.classList.add('show');
    settingsPanel.classList.add('show');
}

        allWidgets.forEach(widget => {
            let pressTimer;
            widget.addEventListener('touchstart', (e) => {
                if(e.target.contentEditable === "true") return; 
                // 排除点击唱针时的长按识别
                if(e.target.closest('#tonearmBtn')) return;
                pressTimer = setTimeout(() => { openSettings(widget); }, 500); 
            }, {passive: true});
            widget.addEventListener('touchend', () => clearTimeout(pressTimer));
            widget.addEventListener('touchmove', () => clearTimeout(pressTimer));
            
            widget.addEventListener('mousedown', (e) => {
                if(e.target.contentEditable === "true") return; 
                if(e.target.closest('#tonearmBtn')) return;
                pressTimer = setTimeout(() => { openSettings(widget); }, 500);
            });
            widget.addEventListener('mouseup', () => clearTimeout(pressTimer));
            widget.addEventListener('mouseleave', () => clearTimeout(pressTimer));
        });

        overlay.addEventListener('click', () => {
    overlay.classList.remove('show');
    settingsPanel.classList.remove('show');
    lyricEditPanel.classList.remove('show'); // 加了这一句
    activeWidget = null;
});

        alphaSlider.addEventListener('input', (e) => {
            if (activeWidget) {
                const val = e.target.value;
                activeWidget.style.setProperty('--bg-alpha', val);
                alphaValueText.innerText = Math.round(val * 100) + '%';
                saveToDB(activeWidget.id + '_alpha', val);
            }
        });

        blurSlider.addEventListener('input', (e) => {
            if (activeWidget) {
                const val = e.target.value;
                activeWidget.style.setProperty('--bg-blur', val + 'px');
                blurValueText.innerText = val + 'px';
                saveToDB(activeWidget.id + '_blur', val);
            }
        });
        
        document.getElementById('glowSlider').addEventListener('input', (e) => {
    if (activeWidget) {
        const val = e.target.value;
        activeWidget.style.setProperty('--custom-glow', val + 'px');
        document.getElementById('glowValue').innerText = val + 'px';
        saveToDB(activeWidget.id + '_glow', val);
    }
});
document.getElementById('textAlphaSlider').addEventListener('input', (e) => {
    if (activeWidget) {
        const val = e.target.value;
        activeWidget.style.setProperty('--custom-alpha', val);
        document.getElementById('textAlphaValue').innerText = Math.round(val * 100) + '%';
        saveToDB(activeWidget.id + '_tAlpha', val);
    }
});
document.getElementById('fontSelect').addEventListener('change', (e) => {
    if (activeWidget) {
        const val = e.target.value;
        activeWidget.style.setProperty('--custom-font', val);
        saveToDB(activeWidget.id + '_font', val);
    }
});

        // === 角色 APP 交互逻辑 ===
const characterModal = document.getElementById('characterAppModal');
const charEditPanel = document.getElementById('characterEditPanel');
let characterList = [];
let tempAvatarFile = null; // 记录临时上传的头像
let avatarCache = {}; // 【新增】头像记忆缓存，防止重复解码闪烁！

// 绑定桌面“角色”图标
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('角色')) {
        app.addEventListener('click', () => {
            characterModal.classList.add('open');
            // 删掉 renderCharacterList()，只做纯粹的滑出动画
        });
    }
});

document.getElementById('closeCharacterApp').addEventListener('click', () => {
    characterModal.classList.remove('open');
    charEditPanel.classList.remove('show');
});

// 渲染角色列表 (极速瞬间加载版)
async function renderCharacterList() {
    characterList = await loadFromDB('ai_characters') || [];
    const container = document.getElementById('characterList');
    
    if (characterList.length === 0) {
        container.innerHTML = '<div class="char-empty">档案室空空如也，快去创造吧~</div>';
        return;
    }

    // 使用文档碎片，在内存中一次性拼好所有卡片
    const frag = document.createDocumentFragment();
    
    characterList.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';

        let avatarContent = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        let styleStr = '';
        
        // 【核心】直接读取开屏动画期间已经准备好的全局缓存！绝不去数据库排队！
        let avatarUrl = window.diaryAvatarCache ? window.diaryAvatarCache[char.id] : null;
        
        if (avatarUrl) {
            styleStr = `background-image: url(${avatarUrl}); border: none;`;
            avatarContent = ''; 
        }

        // 判断身份，生成对应的小徽章
        let badgeHtml = char.roleType === 'user' 
            ? `<span class="role-badge badge-user">ME</span>`
            : `<span class="role-badge badge-char">AI</span>`;

        card.innerHTML = `
            <div class="char-card-avatar" style="${styleStr}">
                ${avatarContent}
            </div>
            <div class="char-card-info">
                <div class="char-card-name">${char.name} ${badgeHtml}</div>
                <div class="char-card-desc">${char.prompt || '未填写设定资料...'}</div>
            </div>
        `;
        card.onclick = () => openCharEditPanel(char);
        frag.appendChild(card);
    });

    // 瞬间替换：没有任何异步等待，一秒把整个列表贴到屏幕上，绝对不滚屏！
    container.innerHTML = '';
    container.appendChild(frag);
}

// 打开编辑面板
function openCharEditPanel(char = null) {
    tempAvatarFile = null;
    const avatarEl = document.getElementById('charEditAvatar');
    const iconEl = document.getElementById('charEditIcon');
    const diaryRow = document.getElementById('charAutoDiaryRow');

    if (char) {
        document.getElementById('charEditId').value = char.id;
        document.getElementById('charEditName').value = char.name;
        document.getElementById('charEditPrompt').value = char.prompt;
        
        // 读取开关状态（如果以前没存过，默认算开启）
        document.getElementById('charEditAutoDiaryToggle').checked = char.allowAutoDiary !== false;
        
        // 恢复选中状态
        document.querySelectorAll('#roleSelector .role-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#roleSelector .role-btn[data-type="${char.roleType || 'char'}"]`).classList.add('active');
        
        // 如果是“我的画像”，隐藏写日记开关
        diaryRow.style.display = (char.roleType === 'user') ? 'none' : 'flex';

        document.getElementById('deleteCharBtn').style.display = 'block';
        
        // 【修复】：直接从开屏准备好的缓存里拿头像！
let avatarUrl = window.diaryAvatarCache ? window.diaryAvatarCache[char.id] : null;

if (avatarUrl) {
    avatarEl.style.backgroundImage = `url(${avatarUrl})`;
    iconEl.style.display = 'none';
    avatarEl.style.border = 'none';
} else {
    avatarEl.style.backgroundImage = '';
    iconEl.style.display = 'block';
    avatarEl.style.border = '';
}
    } else {
        document.getElementById('charEditId').value = 'new_' + Date.now();
        document.getElementById('charEditName').value = '';
        document.getElementById('charEditPrompt').value = '';
        document.getElementById('charEditAutoDiaryToggle').checked = true; // 新建角色默认开启
        document.getElementById('deleteCharBtn').style.display = 'none';    
        
        // 新建默认选中 AI
        document.querySelectorAll('#roleSelector .role-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#roleSelector .role-btn[data-type="char"]`).classList.add('active');
        diaryRow.style.display = 'flex';

        avatarEl.style.backgroundImage = '';
        iconEl.style.display = 'block';
        avatarEl.style.border = '';
    }
    charEditPanel.classList.add('show');
}

// 角色分类开关点击切换
document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 绑定新建和取消按钮
document.getElementById('addNewCharBtn').addEventListener('click', () => openCharEditPanel(null));
document.getElementById('cancelCharEditBtn').addEventListener('click', () => charEditPanel.classList.remove('show'));

// 角色头像上传拦截
document.getElementById('charEditAvatar').addEventListener('click', () => {
    currentUploadTargetId = 'charEditAvatar';
    globalUpload.click();
});

// 重写全局上传逻辑，处理角色头像的临时预览
const originalUploadHandler = globalUpload.onchange; // 防止覆盖
globalUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentUploadTargetId === 'charEditAvatar') {
    tempAvatarFile = file;
    const url = URL.createObjectURL(file);
    
    // 【防闪烁法宝 1】：先在后台内存里静默解码，好了再贴上去
    const img = new Image();
    img.onload = () => {
        const targetEl = document.getElementById('charEditAvatar');
        targetEl.style.backgroundImage = `url(${url})`;
        targetEl.style.border = 'none';
        document.getElementById('charEditIcon').style.display = 'none';
    };
    img.src = url;
    
    globalUpload.value = ''; 
}
    
    // (这段写在 charEditAvatar 那个 if 块的后面，作为并列的 if 或 else if)
if (file && currentUploadTargetId === 'desktopWallpaper') {
    const url = URL.createObjectURL(file);
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    
    saveToDB('desktopWallpaper_file', file); // 存入数据库
    globalUpload.value = ''; 
    
}
// 在 if (file && currentUploadTargetId === 'desktopWallpaper') 之前或之后加入：
if (file && currentUploadTargetId === 'phoneWallpaper') {
    if (!currentChatContact) return;
    const url = URL.createObjectURL(file);
    const phonePanel = document.getElementById('phoneAppPanel');
    phonePanel.style.background = 'transparent';
    phonePanel.style.backgroundImage = `url(${url})`;
    phonePanel.style.backgroundSize = 'cover';
    phonePanel.style.backgroundPosition = 'center';
    
    await saveToDB(`phone_bg_${currentChatContact.id}`, file);
    document.getElementById('globalImageUpload').value = ''; 
    showToast('电话壁纸更换成功！');
    return;
}
});

// 保存角色
document.getElementById('saveCharBtn').addEventListener('click', async () => {
    const id = document.getElementById('charEditId').value;
    const name = document.getElementById('charEditName').value.trim() || '未命名设定';
    const prompt = document.getElementById('charEditPrompt').value.trim();
    const roleType = document.querySelector('#roleSelector .role-btn.active').dataset.type; // 抓取选中的身份！
    const allowAutoDiary = document.getElementById('charEditAutoDiaryToggle').checked; // 获取最新的开关状态！

    const existingIndex = characterList.findIndex(c => c.id === id);
    if (existingIndex > -1) {
        characterList[existingIndex] = { id, name, prompt, roleType, allowAutoDiary };
    } else {
        characterList.push({ id, name, prompt, roleType, allowAutoDiary });
    }

    await saveToDB('ai_characters', characterList);
    if (tempAvatarFile) {
    await saveToDB(`char_avatar_${id}`, tempAvatarFile);
    const newAvatarUrl = URL.createObjectURL(tempAvatarFile);
    
    // 【防闪烁法宝 2】：在面板滑下去之前，强制浏览器提前把新头像缓冲好！
    await new Promise(resolve => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = newAvatarUrl;
    });

    avatarCache[id] = newAvatarUrl; 
    if (window.diaryAvatarCache) window.diaryAvatarCache[id] = newAvatarUrl; 
}

    charEditPanel.classList.remove('show');
    
    // 延迟 400 毫秒（等面板丝滑降落关掉后）再刷新全局数据
    setTimeout(() => {
        renderCharacterList();
        // ★核心修复：同步刷新所有聊天列表和通讯录，确保头像和名字立刻跟着变！
        if (typeof renderChatSessionList === 'function') renderChatSessionList();
        if (typeof renderChatContacts === 'function') renderChatContacts();
        // 如果当前正处于聊天室中，连同聊天室内部的历史记录也一起刷新！
        if (currentChatContact && document.getElementById('chatRoomPanel').classList.contains('show')) {
            loadChatHistory(currentChatContact.id);
        }
    }, 400);
});

// 删除角色
document.getElementById('deleteCharBtn').addEventListener('click', async () => {
    const id = document.getElementById('charEditId').value;
    if(confirm('确定要销毁这个角色吗？此操作无法恢复。')) {
        characterList = characterList.filter(c => c.id !== id);
        await saveToDB('ai_characters', characterList);
        delete avatarCache[id]; // 从记忆中抹除！
        if (window.diaryAvatarCache) delete window.diaryAvatarCache[id]; // 同步抹除全局残留！
        
        // 真实从数据库删掉头像垃圾
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(`char_avatar_${id}`);

        charEditPanel.classList.remove('show');
        
        // 同步刷新全局
        setTimeout(() => {
            renderCharacterList();
            if (typeof renderChatSessionList === 'function') renderChatSessionList();
            if (typeof renderChatContacts === 'function') renderChatContacts();
        }, 400);
    }
});

        // === 设置 APP 交互逻辑 ===
const settingsModal = document.getElementById('settingsAppModal');

// 自动寻找桌面上叫“设置”的图标并绑定点击事件
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('设置')) {
        app.addEventListener('click', async () => {
            // 【杀手锏】先隐藏设置里的所有开关，剥夺它们播放滑动动画的权利
            const switches = settingsModal.querySelectorAll('.switch');
            switches.forEach(s => s.style.display = 'none');
            
            // 后台拉取数据并给开关拨向正确的位置
            await loadSettings(); 
            
            // 强制浏览器刷新一下状态（此时它在隐身中瞬间就位了）
            settingsModal.offsetHeight; 
            
            // 数据就位后，瞬间恢复开关显示，没有任何滑动过程！
            switches.forEach(s => s.style.display = '');
            
            // 丝滑推出面板
            settingsModal.classList.add('open'); 
        });
    }
});

document.getElementById('closeSettingsApp').addEventListener('click', () => {
    settingsModal.classList.remove('open');
});

// 绑定“指令”APP点击事件
const commandModal = document.getElementById('commandAppModal');
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('指令')) {
        app.addEventListener('click', () => {
            commandModal.classList.add('open');
            renderCommandList();
        });
    }
});

document.getElementById('closeCommandApp').addEventListener('click', () => {
    commandModal.classList.remove('open');
    document.getElementById('commandEditPanel').classList.remove('show');
});

// 绑定“美化”APP点击事件
const beautifyModal = document.getElementById('beautifyAppModal');
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('美化')) {
        app.addEventListener('click', () => {
            beautifyModal.classList.add('open');
        });
    }
});

// 关闭美化面板
document.getElementById('closeBeautifyApp').addEventListener('click', () => {
    beautifyModal.classList.remove('open');
});

// 点击更换壁纸，触发全局上传，并打上特殊标记
document.getElementById('changeWallpaperBtn').addEventListener('click', () => {
    currentUploadTargetId = 'desktopWallpaper';
    document.getElementById('globalImageUpload').click();
});

// 点击恢复默认
document.getElementById('resetWallpaperBtn').addEventListener('click', async () => {
    document.body.style.backgroundImage = '';
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete('desktopWallpaper_file');
    
});

// 绑定温度滑动条数字显示
document.getElementById('tempInput').addEventListener('input', (e) => {
    document.getElementById('tempDisplay').innerText = e.target.value;
});

// 保存和加载配置 (增加到了双模型支持)
async function loadSettings() {
    document.getElementById('mainApiUrl').value = await loadFromDB('mainApiUrl') || '';
    document.getElementById('mainApiKey').value = await loadFromDB('mainApiKey') || '';
    document.getElementById('subApiUrl').value = await loadFromDB('subApiUrl') || '';
    document.getElementById('subApiKey').value = await loadFromDB('subApiKey') || '';
    document.getElementById('globalWrongMailToggle').checked = (await loadFromDB('globalWrongMail') !== false); // 默认开启
document.getElementById('globalAutoDiaryToggle').checked = (await loadFromDB('globalAutoDiary') !== false); // 默认开启
    const savedTemp = await loadFromDB('sysTemp');
    if (savedTemp) {
        document.getElementById('tempInput').value = savedTemp;
        document.getElementById('tempDisplay').innerText = savedTemp;
    }
    
    const savedMainModel = await loadFromDB('sysModel');
    if (savedMainModel) document.getElementById('mainModelSelect').innerHTML = `<option value="${savedMainModel}">${savedMainModel} (已存)</option>`;
    
    const savedSubModel = await loadFromDB('subSysModel');
    if (savedSubModel) document.getElementById('subModelSelect').innerHTML = `<option value="${savedSubModel}">${savedSubModel} (已存)</option>`;

    // 读取流畅模式开关
        // (这部分是原有的代码，参考定位)
    const perfMode = await loadFromDB('perfMode');
    const perfToggle = document.getElementById('perfModeToggle');
    if (perfMode === true) {
        perfToggle.checked = true;
        document.body.classList.add('perf-mode');
    } else {
        perfToggle.checked = false;
        document.body.classList.remove('perf-mode');
    }

    // ============= 新增：读取去模糊状态 =============
    const noBlurMode = await loadFromDB('noBlurMode');
    const blurToggle = document.getElementById('noBlurModeToggle');
    if (noBlurMode === true) {
        blurToggle.checked = true;
        document.body.classList.add('no-blur-mode');
    } else {
        blurToggle.checked = false;
        document.body.classList.remove('no-blur-mode');
    }
    // ==============================================
}

// 监听流畅模式开关
document.getElementById('perfModeToggle').addEventListener('change', async function() {
    const isChecked = this.checked;
    if (isChecked) {
        document.body.classList.add('perf-mode');
    } else {
        document.body.classList.remove('perf-mode');
    }
    await saveToDB('perfMode', isChecked);
});

// 监听：极致去模糊开关
document.getElementById('noBlurModeToggle').addEventListener('change', async function() {
    const isChecked = this.checked;
    if (isChecked) {
        document.body.classList.add('no-blur-mode');
    } else {
        document.body.classList.remove('no-blur-mode');
    }
    await saveToDB('noBlurMode', isChecked);
});

document.getElementById('saveConfigBtn').addEventListener('click', async function() {
    const btn = this;
    await saveToDB('mainApiUrl', document.getElementById('mainApiUrl').value);
    await saveToDB('mainApiKey', document.getElementById('mainApiKey').value);
    await saveToDB('subApiUrl', document.getElementById('subApiUrl').value);
    await saveToDB('subApiKey', document.getElementById('subApiKey').value);
    await saveToDB('globalWrongMail', document.getElementById('globalWrongMailToggle').checked);
await saveToDB('globalAutoDiary', document.getElementById('globalAutoDiaryToggle').checked);
    await saveToDB('sysTemp', document.getElementById('tempInput').value);
    
    const mainModel = document.getElementById('mainModelSelect').value;
    if (mainModel) await saveToDB('sysModel', mainModel);
    
    const subModel = document.getElementById('subModelSelect').value;
    if (subModel) await saveToDB('subSysModel', subModel);
    
    btn.innerText = "已保存！";
    btn.style.background = "#A3C7A3"; 
    setTimeout(() => { btn.innerText = "保存所有配置"; btn.style.background = "var(--accent)"; }, 1500);
});

// 提取出一个通用的网络请求拉取模型函数，主副共用
async function fetchModels(btnId, urlId, keyId, selectId) {
    const btn = document.getElementById(btnId);
    let url = document.getElementById(urlId).value.trim();
    let key = document.getElementById(keyId).value.trim();
    
    if (!key) {
        btn.innerText = "缺Key!";
        setTimeout(() => btn.innerText = "重新获取", 1500);
        return;
    }
    
    if (!url) url = 'https://api.openai.com/v1';
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (!url.endsWith('/v1') && !url.includes('/models')) url += '/v1';
    
    btn.innerText = "请求中...";
    try {
        const response = await fetch(`${url}/models`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
        });
        
        if (!response.ok) throw new Error('网络错误');
        
        const resJson = await response.json();
        const models = resJson.data; 
        
        if (models && Array.isArray(models)) {
            const select = document.getElementById(selectId);
            select.innerHTML = '';
            models.forEach(m => {
                let opt = document.createElement('option');
                opt.value = m.id; opt.innerText = m.id;
                select.appendChild(opt);
            });
            btn.innerText = "成功";
        } else throw new Error('格式不符');
    } catch(e) {
        btn.innerText = "失败!";
    }
    setTimeout(() => btn.innerText = btnId.includes('Main') ? "获取主模型" : "获取副模型", 2000);
}

// 绑定两个按钮
document.getElementById('fetchMainModelsBtn').addEventListener('click', () => fetchModels('fetchMainModelsBtn', 'mainApiUrl', 'mainApiKey', 'mainModelSelect'));
document.getElementById('fetchSubModelsBtn').addEventListener('click', () => fetchModels('fetchSubModelsBtn', 'subApiUrl', 'subApiKey', 'subModelSelect'));

// ==========================================
// 智能分类计算真实存储大小
// ==========================================

// 单位换算小助手 (自动转 B / KB / MB)
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function calculateRealStorage() {
    return new Promise(async (resolve) => {
        let stats = { images: 0, texts: 0, configs: 0, total: 0 };
        try {
            const db = await initDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.openCursor();

            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const key = cursor.key;
                    const val = cursor.value;
                    let size = 0;

                    // 分类称重
                    if (val instanceof Blob || val instanceof File) {
                        size = val.size;
                        stats.images += size;
                    } else if (typeof val === 'string') {
                        size = new Blob([val]).size;
                        // 区分日记文字和系统配置
                        if (key.startsWith('jText')) stats.texts += size;
                        else stats.configs += size;
                    } else {
                        size = JSON.stringify(val).length;
                        stats.configs += size;
                    }
                    
                    stats.total += size;
                    cursor.continue();
                } else {
                    resolve(stats);
                }
            };
            request.onerror = () => resolve(stats);
        } catch (e) { resolve(stats); }
    });
}

async function updateStorageInfo() {
    document.getElementById('totalUsedSpace').innerText = "读取中...";
    const stats = await calculateRealStorage();
    
    // 写入各分类文本
    document.getElementById('totalUsedSpace').innerText = formatBytes(stats.total);
    document.getElementById('sizeImg').innerText = formatBytes(stats.images);
    document.getElementById('sizeTxt').innerText = formatBytes(stats.texts);
    document.getElementById('sizeCfg').innerText = formatBytes(stats.configs);

    // 计算比例并驱动彩色条
    let pctImg = stats.total === 0 ? 0 : (stats.images / stats.total) * 100;
    let pctTxt = stats.total === 0 ? 0 : (stats.texts / stats.total) * 100;
    let pctCfg = stats.total === 0 ? 0 : (stats.configs / stats.total) * 100;

    document.getElementById('segImg').style.width = pctImg + '%';
    document.getElementById('segTxt').style.width = pctTxt + '%';
    document.getElementById('segCfg').style.width = pctCfg + '%';
}

// ==========================================
// 真实清理无效缓存 (保留资产)
// ==========================================
document.getElementById('clearCacheBtn').addEventListener('click', async function() {
    const btn = this;
    if(btn.innerText === "扫描并清理中...") return;
    btn.innerText = "扫描并清理中...";

    // 存一下清理前的大小
    const statsBefore = await calculateRealStorage();
    const bytesBefore = statsBefore.total;

    const validWidgetKeys = [];
    document.querySelectorAll('.custom-widget').forEach(w => {
        validWidgetKeys.push(w.id + '_alpha');
        validWidgetKeys.push(w.id + '_blur');
    });

    // 在这行上面先动态提取角色的头像 Key
const charAvatarKeys = [];
const savedChars = await loadFromDB('ai_characters') || [];
savedChars.forEach(c => charAvatarKeys.push(`char_avatar_${c.id}`));

const validKeys = [
    'mainApiUrl', 'mainApiKey', 'subApiUrl', 'subApiKey', 'sysTemp', 'sysModel', 'subSysModel', 'perfMode',
    'photoImg1_file', 'badgeImg_file', 'journalImg_file', 'lyricImg_file',
    'desktopWallpaper_file', 
    'jText1', 'jText2', 'lyricText', 'ai_characters', 'ai_commands', 'period_records',
    'accounting_accounts', 'accounting_records', // <--- 补上这两个！保护你的钱！
    ...validWidgetKeys,
    ...charAvatarKeys 
];

    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let junkBytes = 0;

    const req = store.openCursor();
    req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            if (!validKeys.includes(cursor.key)) {
                const val = cursor.value;
                if (val instanceof Blob || val instanceof File) junkBytes += val.size;
                else if (typeof val === 'string') junkBytes += new Blob([val]).size;
                else junkBytes += JSON.stringify(val).length;

                cursor.delete(); 
            }
            cursor.continue();
        }
    };

    tx.oncomplete = async () => {
        if (junkBytes === 0) {
            btn.innerText = "系统纯净，无残余可清"; 
        } else {
            btn.innerText = `成功清理 ${formatBytes(junkBytes)} 废弃碎片`; 
        }

        btn.style.background = "#E6E3DE";
        btn.style.color = "var(--text-sub)";
        
        updateStorageInfo(); // 重新加载动画条

        setTimeout(() => {
            btn.innerText = "清理无效数据缓存";
            btn.style.background = "#FFF0F0";
            btn.style.color = "#D67A7A";
        }, 2500);
    };
});

// === 指令库 APP 交互逻辑 ===
const commandEditPanel = document.getElementById('commandEditPanel');
let commandList = [];
let currentCommandFilter = '全部';

// 唤起美化版删除弹窗的通用函数
function showBeautifulConfirm(onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.classList.add('show');
    document.getElementById('ccConfirm').onclick = () => {
        cc.classList.remove('show');
        if(onConfirm) onConfirm();
    };
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
}

// 插入位置开关的点击逻辑
document.querySelectorAll('#commandPosSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#commandPosSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

async function renderCommandList() {
    commandList = await loadFromDB('ai_commands') || [];
    const container = document.getElementById('commandList');
    const filterBar = document.getElementById('commandFilterBar');
    
    let categories = ['全部'];
    commandList.forEach(c => { if (c.category && !categories.includes(c.category)) categories.push(c.category); });

    filterBar.innerHTML = '';
    categories.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'cmd-chip' + (currentCommandFilter === cat ? ' active' : '');
        chip.innerText = cat;
        chip.onclick = () => { currentCommandFilter = cat; renderCommandList(); };
        filterBar.appendChild(chip);
    });

    if (commandList.length === 0) {
        container.innerHTML = '<div class="char-empty">还没有任何指令，点击下方添加吧~</div>'; return;
    }

    container.innerHTML = '';
    const filteredList = currentCommandFilter === '全部' ? commandList : commandList.filter(c => c.category === currentCommandFilter);

    if (filteredList.length === 0) {
         container.innerHTML = '<div class="char-empty">当前分类下没有指令~</div>'; return;
    }

    filteredList.forEach(cmd => {
        const card = document.createElement('div');
        card.className = 'char-card'; 

        let catBadge = cmd.category ? `<span class="cmd-badge">${cmd.category}</span>` : '';
        // 渲染前置后置的高亮小尾巴
        let posBadge = cmd.position === 'back' 
            ? `<span class="cmd-badge" style="background: rgba(214,122,122,0.15); color: #D67A7A;">后置</span>` 
            : `<span class="cmd-badge" style="background: rgba(184,156,142,0.15); color: var(--accent);">前置</span>`;
        
        // 渲染全局标志
        let globalBadge = cmd.isGlobal ? `<span class="cmd-badge" style="background: rgba(139,168,136,0.15); color: #8BA888;">全局</span>` : '';

        card.innerHTML = `
            <div class="char-card-info">
                <div class="char-card-name">${cmd.name} ${catBadge} ${posBadge} ${globalBadge}</div>
                <div class="char-card-desc">${cmd.content || '空指令...'}</div>
            </div>
        `;
        card.onclick = () => openCommandEditPanel(cmd);
        container.appendChild(card);
    });
}

function openCommandEditPanel(cmd = null) {
    // 恢复按钮选中状态的辅助函数
    const setPosBtn = (posValue) => {
        document.querySelectorAll('#commandPosSelector .role-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#commandPosSelector .role-btn[data-pos="${posValue}"]`).classList.add('active');
    };

    if (cmd) {
    document.getElementById('commandGlobalToggle').checked = cmd.isGlobal || false;
        document.getElementById('commandEditId').value = cmd.id;
        document.getElementById('commandEditName').value = cmd.name;
        document.getElementById('commandEditCategory').value = cmd.category || '';
        document.getElementById('commandEditContent').value = cmd.content;
        setPosBtn(cmd.position || 'front'); // 载入保存的位置
        document.getElementById('deleteCommandBtn').style.display = 'block';
    } else {
    document.getElementById('commandGlobalToggle').checked = false;
        document.getElementById('commandEditId').value = 'cmd_' + Date.now();
        document.getElementById('commandEditName').value = '';
        document.getElementById('commandEditCategory').value = currentCommandFilter === '全部' ? '' : currentCommandFilter; 
        document.getElementById('commandEditContent').value = '';
        setPosBtn('front'); // 默认前置
        document.getElementById('deleteCommandBtn').style.display = 'none';    
    }
    commandEditPanel.classList.add('show');
}

document.getElementById('addNewCommandBtn').addEventListener('click', () => openCommandEditPanel(null));
document.getElementById('cancelCommandEditBtn').addEventListener('click', () => commandEditPanel.classList.remove('show'));

document.getElementById('saveCommandBtn').addEventListener('click', async () => {
    const id = document.getElementById('commandEditId').value;
    const name = document.getElementById('commandEditName').value.trim() || '未命名指令';
    const category = document.getElementById('commandEditCategory').value.trim() || '默认分类';
    const content = document.getElementById('commandEditContent').value.trim();
    const position = document.querySelector('#commandPosSelector .role-btn.active').dataset.pos;
const isGlobal = document.getElementById('commandGlobalToggle').checked; // ★新增这行
    const existingIndex = commandList.findIndex(c => c.id === id);
        if (existingIndex > -1) {
        commandList[existingIndex] = { id, name, category, position, isGlobal, content };
    } else {
        commandList.push({ id, name, category, position, isGlobal, content });
    }

    await saveToDB('ai_commands', commandList);
    commandEditPanel.classList.remove('show');
    setTimeout(() => renderCommandList(), 400); 
});

document.getElementById('deleteCommandBtn').addEventListener('click', () => {
    // 呼叫我们写好的美化版弹窗！
    showBeautifulConfirm(async () => {
        const id = document.getElementById('commandEditId').value;
        commandList = commandList.filter(c => c.id !== id);
        if(currentCommandFilter !== '全部' && !commandList.some(c => c.category === currentCommandFilter)) {
            currentCommandFilter = '全部';
        }
        await saveToDB('ai_commands', commandList);
        commandEditPanel.classList.remove('show');
        setTimeout(() => renderCommandList(), 400);
    });
});

// === 经期手账 APP 交互逻辑 ===
const periodModal = document.getElementById('periodAppModal');
let periodRecords = []; 
let currentCalDate = new Date(); 

// 借用之前写好的美化版通用弹窗！
function showPeriodConfirm(title, desc, onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = title;
    cc.querySelector('.cc-desc').innerText = desc;
    cc.classList.add('show');
    
    // 清除旧的事件监听防止重复触发
    const confirmBtn = document.getElementById('ccConfirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.onclick = () => {
        cc.classList.remove('show');
        if(onConfirm) onConfirm();
    };
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
}

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('经期')) {
        app.addEventListener('click', () => {
            periodModal.classList.add('open');
            currentCalDate = new Date(); 
            renderPeriodApp();
        });
    }
});
document.getElementById('closePeriodApp').addEventListener('click', () => periodModal.classList.remove('open'));

function formatDate(timestamp) {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

document.getElementById('calPrevBtn').addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    renderPeriodApp();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    renderPeriodApp();
});

// ★ 点击日历格子，唤起美化版弹窗 ★
window.handleCalClick = async function(cellTimeStr) {
    const cellTime = parseInt(cellTimeStr);
    const dateStr = formatDate(cellTime);
    
    const openRecord = periodRecords.find(r => r.end === null);
    
    if (openRecord) {
        if (cellTime < openRecord.start) {
            showPeriodConfirm('无法标记', '结束时间不能早于开始时间哦！', null); return;
        }
        showPeriodConfirm('标记结束', `要将 ${dateStr} 标记为这次月经的【结束日】吗？`, async () => {
            openRecord.end = cellTime;
            periodRecords.sort((a, b) => a.start - b.start);
            await saveToDB('period_records', periodRecords);
            renderPeriodApp();
        });
    } else {
        showPeriodConfirm('补录开始', `要将 ${dateStr} 补录为月经的【开始日】吗？\n(确定后，再次点击日历标记结束)`, async () => {
            periodRecords.push({ id: Date.now() + cellTime, start: cellTime, end: null });
            periodRecords.sort((a, b) => a.start - b.start);
            await saveToDB('period_records', periodRecords);
            renderPeriodApp();
        });
    }
};

async function renderPeriodApp() {
    periodRecords = await loadFromDB('period_records') || [];
    periodRecords.sort((a, b) => a.start - b.start);
    
    const pTitle = document.getElementById('pStatusTitle');
    const pDays = document.getElementById('pStatusDays');
    const pDate = document.getElementById('pStatusDate');
    const actionBtn = document.getElementById('periodActionBtn');
    const historyList = document.getElementById('periodHistoryList');
    const avgText = document.getElementById('avgCycleText');

    let avgCycle = 28; 
    let cycleCount = 0; let totalCycleDays = 0;
    for (let i = 1; i < periodRecords.length; i++) {
        const days = Math.round((periodRecords[i].start - periodRecords[i-1].start) / 86400000);
        if (days > 15 && days < 60) { totalCycleDays += days; cycleCount++; }
    }
    if (cycleCount > 0) avgCycle = Math.round(totalCycleDays / cycleCount);
    avgText.innerText = cycleCount > 0 ? `平均周期: ${avgCycle}天` : `默认周期: 28天`;

    const now = new Date().setHours(0, 0, 0, 0); 
    let predictedStarts = []; 

    if (periodRecords.length === 0) {
        pTitle.innerText = "还未记录"; pDays.innerHTML = "-"; pDate.innerText = "点击日历或下方按钮记录";
        actionBtn.innerText = "月经来了"; actionBtn.style.background = "#FFF0F0"; actionBtn.style.color = "#D67A7A";
    } else {
        const lastRecord = periodRecords[periodRecords.length - 1];
        if (lastRecord.end === null) {
            const currentDay = Math.round((now - lastRecord.start) / 86400000) + 1;
            pTitle.innerText = "当前经期"; pDays.innerHTML = `${currentDay}<span>天</span>`;
            pDate.innerText = `开始于: ${formatDate(lastRecord.start)}`;
            actionBtn.innerText = "月经结束"; actionBtn.style.background = "var(--surface)"; actionBtn.style.color = "var(--text-main)";
        } else {
            const nextExpected = lastRecord.start + (avgCycle * 86400000);
            const diffDays = Math.round((nextExpected - now) / 86400000);

            for(let i=0; i<5; i++) predictedStarts.push(nextExpected + i * 86400000);

            if (diffDays > 0) {
                pTitle.innerText = "距离下次还有"; pDays.innerHTML = `${diffDays}<span>天</span>`;
            } else if (diffDays === 0) {
                pTitle.innerText = "预计今天来"; pDays.innerHTML = `0<span>天</span>`;
            } else {
                pTitle.innerText = "已经推迟了"; pDays.innerHTML = `${Math.abs(diffDays)}<span>天</span>`;
                pDays.style.color = "#E59999"; 
            }
            pDate.innerText = `预测日期: ${formatDate(nextExpected)}`;
            actionBtn.innerText = "月经来了"; actionBtn.style.background = "#FFF0F0"; actionBtn.style.color = "#D67A7A";
        }
    }

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    document.getElementById('calTitle').innerText = `${year}年${month + 1}月`;
    
    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';
    
    let emptyDays = firstDay === 0 ? 6 : firstDay - 1; 
    for(let i=0; i<emptyDays; i++) grid.innerHTML += `<div class="cal-day-cell empty"></div>`;
    
    for(let d=1; d<=daysInMonth; d++) {
        const cellTime = new Date(year, month, d).setHours(0,0,0,0);
        let className = 'cal-day-cell';
        if(cellTime === now) className += ' today'; 
        
        let isPeriod = false;
        periodRecords.forEach(r => {
            const s = r.start;
            const e = r.end || now; 
            if(cellTime >= s && cellTime <= e) isPeriod = true;
        });
        
        if (isPeriod) className += ' period';
        else if (predictedStarts.includes(cellTime)) className += ' predicted'; 
        
        grid.innerHTML += `<div class="${className}" style="cursor:pointer;" onclick="handleCalClick('${cellTime}')">${d}</div>`;
    }
    
        // 渲染历史记录 (加入直观删除按钮)
    historyList.innerHTML = '';
    const reversedRecords = [...periodRecords].reverse();
    reversedRecords.forEach((record, index) => {
        const div = document.createElement('div'); div.className = 'period-record-item';
        const startStr = formatDate(record.start);
        const endStr = record.end ? formatDate(record.end) : '进行中';
        let duration = record.end ? Math.round((record.end - record.start) / 86400000) + 1 : '-';
        
        let cycleStr = '-';
        if (index < reversedRecords.length - 1) {
            const prevRecord = reversedRecords[index + 1];
            cycleStr = `${Math.round((record.start - prevRecord.start) / 86400000)}天周期`;
        }

        div.innerHTML = `
            <div style="flex:1;">
                <div class="pr-dates">${startStr} ~ ${endStr}</div>
                <div style="font-size:11px; color:var(--text-sub); display:flex; gap:8px; margin-top:2px;">
                    <span>共 ${duration} 天</span>
                    <span>${cycleStr}</span>
                </div>
            </div>
            <div class="pr-action-btn" id="del_pr_${record.id}">删除</div>
        `;
        historyList.appendChild(div);
        
        // 绑定删除美化弹窗
        document.getElementById(`del_pr_${record.id}`).addEventListener('click', () => {
            showPeriodConfirm('删除记录', `确定要删除 ${startStr} 这条记录吗？\n删除后可通过日历点击重新补录。`, async () => {
                periodRecords = periodRecords.filter(r => r.id !== record.id);
                await saveToDB('period_records', periodRecords);
                renderPeriodApp();
            });
        });
    });
}

document.getElementById('periodActionBtn').addEventListener('click', async () => {
    const now = new Date().setHours(0, 0, 0, 0);

    if (periodRecords.length === 0 || periodRecords[periodRecords.length - 1].end !== null) {
        periodRecords.push({ id: Date.now(), start: now, end: null }); 
    } else {
        const lastRecord = periodRecords[periodRecords.length - 1];
        if (lastRecord.start === now) {
            showPeriodConfirm('提示', '刚刚才记录开始，确定今天就结束了吗？', async () => {
                lastRecord.end = now; 
                await saveToDB('period_records', periodRecords);
                renderPeriodApp();
            });
            return;
        }
        lastRecord.end = now; 
    }

    periodRecords.sort((a, b) => a.start - b.start);
    await saveToDB('period_records', periodRecords);
    renderPeriodApp();
});

// === 记账 APP 交互逻辑 ===
const accountingModal = document.getElementById('accountingAppModal');
const accEditPanel = document.getElementById('accEditPanel');
let accAccounts = [];
let accRecords = [];

// 终极版全局美化弹窗调用函数 (支持文字确认 和 数字输入)
function showBeautifulDialog(title, desc, type = 'confirm', defaultValue = '', onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = title;
    cc.querySelector('.cc-desc').innerText = desc;
    
    const inputEl = cc.querySelector('.cc-input');
    const confirmBtn = document.getElementById('ccConfirm');
    
    if (type === 'prompt') {
        inputEl.style.display = 'block';
        inputEl.value = defaultValue;
        confirmBtn.style.background = 'var(--accent)';
        confirmBtn.style.color = '#fff';
    } else {
        inputEl.style.display = 'none';
        confirmBtn.style.background = '#FFF0F0';
        confirmBtn.style.color = '#D67A7A';
    }
    
    cc.classList.add('show');
// 延迟 400 毫秒，等弹窗动画彻底平稳结束后再唤起键盘，彻底解决闪烁

    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.onclick = () => {
        const val = inputEl.value;
        cc.classList.remove('show');
        if(onConfirm) {
            if (type === 'prompt') onConfirm(val);
            else onConfirm();
        }
    };
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
}

const defaultAccounts = [
    { id: 'wechat', name: '微信', balance: 0 },
    { id: 'alipay', name: '支付宝', balance: 0 },
    { id: 'bank', name: '银行卡', balance: 0 }
];

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('记账')) {
        app.addEventListener('click', async () => {
            // 1. 先在后台静默把账单数据拉取并渲染完毕
            await renderAccountingApp();
            
            // 2. 给浏览器 30 毫秒的时间来彻底确认并固化排版，绝不让它在滑动中途才去算高度
            setTimeout(() => {
                accountingModal.classList.add('open');
            }, 30);
        });
    }
});
document.getElementById('closeAccountingApp').addEventListener('click', () => accountingModal.classList.remove('open'));

async function renderAccountingApp() {
    accAccounts = await loadFromDB('accounting_accounts');
    if (!accAccounts || accAccounts.length === 0) {
        accAccounts = JSON.parse(JSON.stringify(defaultAccounts));
        await saveToDB('accounting_accounts', accAccounts);
    }
    accRecords = await loadFromDB('accounting_records') || [];
    accRecords.sort((a, b) => b.timestamp - a.timestamp); 

    // 1. 渲染顶部总资产和账户卡片
    let total = 0;
    const cardsContainer = document.getElementById('accCardsContainer');
    cardsContainer.innerHTML = '';
    
    accAccounts.forEach(acc => {
        total += parseFloat(acc.balance);
        const card = document.createElement('div');
        card.className = 'acc-card';
        card.innerHTML = `
            <div class="acc-card-name">${acc.name} <span>✎</span></div>
            <div class="acc-card-bal">¥ ${parseFloat(acc.balance).toFixed(2)}</div>
        `;
        // 点击修改账户余额 (已替换为果冻弹窗！)
        card.onclick = () => {
            showBeautifulDialog(`修改【${acc.name}】余额`, '直接设置当前的真实余额：', 'prompt', acc.balance, async (newBal) => {
                if (newBal !== null && !isNaN(newBal) && newBal.trim() !== '') {
                    acc.balance = parseFloat(newBal);
                    await saveToDB('accounting_accounts', accAccounts);
                    renderAccountingApp();
                }
            });
        };
        cardsContainer.appendChild(card);
    });
    
    document.getElementById('accTotalNum').innerText = total.toFixed(2);

    // 2. 渲染流水列表
    const listContainer = document.getElementById('accRecordsList');
    listContainer.innerHTML = '';
    if (accRecords.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;">还没有任何账单记录~</div>';
    } else {
        accRecords.forEach(record => {
            const div = document.createElement('div');
            div.className = 'acc-record-item';
            
            const date = new Date(record.timestamp);
            const timeStr = `${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
            const accName = accAccounts.find(a => a.id === record.accountId)?.name || '未知账户';
            const sign = record.type === 'in' ? '+' : '-';
            const valClass = record.type === 'in' ? 'in' : 'out';
            const title = record.category || (record.type === 'in' ? '收入' : '支出');
            const remarkText = record.remark ? ` · ${record.remark}` : '';

            div.innerHTML = `
                <div class="acc-ri-left">
                    <div class="acc-ri-cat">${title} <span style="font-size:11px; color:var(--text-sub); font-weight:normal;">${remarkText}</span></div>
                    <div class="acc-ri-time"><span class="acc-ri-acc">${accName}</span> ${timeStr}</div>
                </div>
                <div class="acc-ri-right ${valClass}">${sign} ${parseFloat(record.amount).toFixed(2)}</div>
            `;
            // 长按删除账单并退还余额 (已替换为果冻弹窗！)
            div.oncontextmenu = (e) => {
                e.preventDefault();
                showBeautifulDialog('删除账单', '确定要删除这条账单吗？相应的金额会从账户中回退或扣除。', 'confirm', '', async () => {
                    const targetAcc = accAccounts.find(a => a.id === record.accountId);
                    if (targetAcc) {
                        if (record.type === 'in') targetAcc.balance -= record.amount;
                        else targetAcc.balance += record.amount;
                    }
                    accRecords = accRecords.filter(r => r.id !== record.id);
                    await saveToDB('accounting_accounts', accAccounts);
                    await saveToDB('accounting_records', accRecords);
                    renderAccountingApp();
                });
            }
            listContainer.appendChild(div);
        });
    }
}

// 记一笔相关逻辑
document.getElementById('openAddRecordBtn').addEventListener('click', () => {
    document.getElementById('accAmount').value = '';
    document.getElementById('accCategory').value = '';
    document.getElementById('accRemark').value = '';
    
    // 生成账户选择 Chips
    const chipsContainer = document.getElementById('accAccountChips');
    chipsContainer.innerHTML = '';
    accAccounts.forEach((acc, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip' + (index === 0 ? ' active' : '');
        chip.innerText = acc.name;
        chip.dataset.id = acc.id;
        chip.onclick = () => {
            chipsContainer.querySelectorAll('.acc-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        };
        chipsContainer.appendChild(chip);
    });
    
    accEditPanel.classList.add('show');
});

document.getElementById('cancelAccEditBtn').addEventListener('click', () => accEditPanel.classList.remove('show'));

// 收入/支出开关
document.querySelectorAll('#accTypeSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#accTypeSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 保存账单
document.getElementById('saveAccRecordBtn').addEventListener('click', async () => {
    const amountStr = document.getElementById('accAmount').value;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('金额必须大于 0 哦！'); return;
    }

    const type = document.querySelector('#accTypeSelector .role-btn.active').dataset.type;
    const category = document.getElementById('accCategory').value.trim();
    const remark = document.getElementById('accRemark').value.trim();
    const accountId = document.querySelector('#accAccountChips .acc-chip.active').dataset.id;

    // 1. 新增流水记录
    const newRecord = {
        id: Date.now(),
        timestamp: Date.now(),
        type, amount, category, remark, accountId
    };
    accRecords.push(newRecord);

    // 2. 同步加减对应账户的余额
    const targetAcc = accAccounts.find(a => a.id === accountId);
    if (targetAcc) {
        if (type === 'out') targetAcc.balance -= amount;
        else targetAcc.balance += amount;
    }

    // 3. 保存并刷新
    await saveToDB('accounting_accounts', accAccounts);
    await saveToDB('accounting_records', accRecords);
    
    accEditPanel.classList.remove('show');
    setTimeout(() => renderAccountingApp(), 300);
});

// === 食谱与体重 APP 交互逻辑 ===
const dietModal = document.getElementById('dietAppModal');
let currentDietDate = new Date().setHours(0, 0, 0, 0); // 当前选中的日期戳
let dailyDietData = {}; // 结构: { timestamp: { weight: 50, meals: [...], aiReply: "..." } }
let currentDietRoleId = ''; 

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('食谱')) {
        app.addEventListener('click', async () => {
            dietModal.classList.add('open');
            currentDietDate = new Date().setHours(0, 0, 0, 0);
            await loadDietData();
            loadDietAiRoles();
        });
    }
});

document.getElementById('closeDietApp').addEventListener('click', () => dietModal.classList.remove('open'));

// 格式化并绑定顶部日期
function updateDietDateText() {
    const today = new Date().setHours(0, 0, 0, 0);
    const d = new Date(currentDietDate);
    
    if (currentDietDate === today) {
        document.getElementById('dietCurrentDate').innerText = '今天';
    } else {
        document.getElementById('dietCurrentDate').innerText = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    }
    
    // 同步给透明的原生 input[type="date"]
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    document.getElementById('dietDatePicker').value = `${yyyy}-${mm}-${dd}`;
}

// 监听日历选择器切换日期
document.getElementById('dietDatePicker').addEventListener('change', function(e) {
    if (e.target.value) {
        const [y, m, d] = e.target.value.split('-');
        currentDietDate = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
        updateDietDateText();
        renderDietUI();
    }
});

// 加载库里的饮食数据
async function loadDietData() {
    dailyDietData = await loadFromDB('diet_records_db') || {};
    updateDietDateText();
    renderDietUI();
}

// 渲染UI，带历史对话记忆
function renderDietUI() {
    const dayData = dailyDietData[currentDietDate] || { weight: '', meals: [], aiReply: '' };
    
    document.getElementById('dietWeightInput').value = dayData.weight || '';
    
    const list = document.getElementById('dietRecordsList');
    list.innerHTML = '';
    if(dayData.meals) {
dayData.meals.forEach(meal => {
    const div = document.createElement('div');
    div.className = 'diet-item';
    
    // 如果是AI生成的，换成深灰点；如果是自己记的，用奶咖点
    let mainColor = meal.isAi ? '#968F89' : 'var(--accent)';
    let typeText = meal.isAi ? `TA的${meal.type}` : meal.type;
    let aiClass = meal.isAi ? 'ai-text' : ''; // AI生成的带文艺斜体

    div.innerHTML = `
        <div class="diet-item-main">
            <div class="diet-meta" style="color: ${mainColor}; border: 1px solid ${mainColor}30;">
                <span class="diet-dot" style="background: ${mainColor}"></span>
                ${typeText}
            </div>
            <div class="diet-food ${aiClass}">${meal.food}</div>
        </div>
        <div class="diet-del" onclick="deleteMeal(${meal.id})">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>
    `;
    list.appendChild(div);
});
    }
    
    // 如果那天有回复历史，直接显示；如果没有，隐藏丑陋的占位符。
    const replyBox = document.getElementById('dietAiReply');
    if (dayData.aiReply) {
        replyBox.innerHTML = dayData.aiReply;
    } else {
        replyBox.innerHTML = '';
    }
    document.getElementById('dietFoodInput').value = '';
}

// 保存体重
document.getElementById('saveWeightBtn').addEventListener('click', async () => {
    const val = document.getElementById('dietWeightInput').value;
    if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
    dailyDietData[currentDietDate].weight = val;
    await saveToDB('diet_records_db', dailyDietData);
    
    const btn = document.getElementById('saveWeightBtn');
    btn.innerText = "已打卡";
    setTimeout(() => btn.innerText = "记录", 1500);
});

// 保存一餐
document.getElementById('saveDietBtn').addEventListener('click', async () => {
    const type = document.getElementById('dietMealType').value;
    const food = document.getElementById('dietFoodInput').value.trim();
    if (!food) return;
    
    if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
    if (!dailyDietData[currentDietDate].meals) dailyDietData[currentDietDate].meals = [];
    
    dailyDietData[currentDietDate].meals.push({ id: Date.now(), type, food });
    await saveToDB('diet_records_db', dailyDietData);
    renderDietUI();
});

// 删除一餐
window.deleteMeal = async function(id) {
    if(dailyDietData[currentDietDate] && dailyDietData[currentDietDate].meals) {
        dailyDietData[currentDietDate].meals = dailyDietData[currentDietDate].meals.filter(m => m.id !== id);
        await saveToDB('diet_records_db', dailyDietData);
        renderDietUI();
    }
}

// 滑动胶囊选角色
async function loadDietAiRoles() {
    const chars = await loadFromDB('ai_characters') || [];
    const chipsContainer = document.getElementById('dietRoleChips');
    chipsContainer.innerHTML = '';
    
    let html = `<div class="acc-chip active" data-id="">(自言自语)</div>`;
    currentDietRoleId = '';

    chars.forEach(c => {
        if(c.roleType === 'char') {
            html += `<div class="acc-chip" data-id="${c.id}">${c.name}</div>`;
        }
    });
    chipsContainer.innerHTML = html;
    
    const chips = chipsContainer.querySelectorAll('.acc-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentDietRoleId = chip.dataset.id;
        });
    });
}

// 严谨 Prompt + 对话入库保存
// 模式一：点评今日
document.getElementById('askAiDietBtn').addEventListener('click', async function() {
    const btn = this;
    const dayData = dailyDietData[currentDietDate];
    if (!dayData || (!dayData.weight && (!dayData.meals || dayData.meals.length === 0))) {
        alert("一片空白，没有数据可以分享哦~"); return;
    }

    const useSubApi = await loadFromDB('dietUseSubApi') || false;
const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) { alert("请先去设置配置 API 节点哦！"); return; }

    btn.innerText = "TA 正在点评...";
    btn.style.opacity = '0.7';
    document.getElementById('dietAiReply').innerHTML = `<span style="color:var(--text-sub)">正在发送消息...</span>`;

    let recordText = '';
    if (dayData.weight) recordText += `今日体重：${dayData.weight}kg\n`;
    if (dayData.meals && dayData.meals.length > 0) {
        dayData.meals.forEach(m => recordText += `[${m.type}]: ${m.food}\n`);
    }

    const isToday = currentDietDate === new Date().setHours(0,0,0,0);
    const dateStr = isToday ? '今天' : new Date(currentDietDate).toLocaleDateString();

    let systemPrompt = `你是一个陪伴角色的搭档。【最高强制指令：绝对禁止描写环境、动作！只准发纯聊天对白！不要带任何括号动作！】`;
    if (currentDietRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === currentDietRoleId);
        if (role && role.prompt) {
            systemPrompt = `你扮演 ${role.name}。${role.prompt}\n【最高强制指令：必须严格符合你的性格设定！！只准用日常聊天的语气直接说话！绝对禁止任何环境描写、心理活动和动作描写！不许加任何动作括号！如有多句话请连在一起说！绝对禁止频道换行和留空行】`;
        }
    }

    let userPrompt = '';
    if (!dayData.meals || dayData.meals.length === 0) {
        userPrompt = `我在 ${dateStr} 的饮食记录是：\n【一片空白。说明用户今天一顿饭都没吃，或者连记都懒得记】\n\n请【严格根据你的人物性格，遵守人物对白语言】，对我“一顿饭都没吃/毫无饮食记录”这件事做出真实的反应。直接跟我对话，绝不要捏造我吃了东西！`;
    } else {
        userPrompt = `这是我 ${dateStr} 的饮食记录：\n${recordText}\n\n请【严格根据你的人物性格，遵守人物对白语言】，像平时聊天一样评价我的饮食。直接跟我对话，严禁凭空捏造我没吃过的东西！`;
    }

    try {
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
    const errData = await response.text();
    throw new Error(`HTTP状态码 ${response.status} | 详细原因: ${errData}`);
}
        
        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        // 解析文本并保存入库
        const formattedReply = reply.replace(/\n/g, '<br>');
        document.getElementById('dietAiReply').innerHTML = formattedReply;
        
        if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
        dailyDietData[currentDietDate].aiReply = formattedReply; 
        await saveToDB('diet_records_db', dailyDietData);
        
    } catch (e) {
        document.getElementById('dietAiReply').innerText = "TA 好像断网了：" + e.message;
    } finally {
        btn.innerText = "点评今日";
        btn.style.opacity = '1';
    }
});

// 模式二：TA吃什么？
document.getElementById('askAiMenuBtn').addEventListener('click', async function() {
    const btn = this;
    const useSubApi = await loadFromDB('dietUseSubApi') || false;
const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) { alert("请先去设置配置 API 节点哦！"); return; }

    btn.innerText = "TA 正在点餐...";
    btn.style.opacity = '0.7';

    let systemPrompt = `你是一个陪伴用户的角色。【最高强制指令：只准严格输出规定的食谱数据！绝对禁止输出任何聊天、对白、动作描写或解释！不要聊天对白！只交出你的饮食清单！必须遵守时代背景】`;
    if (currentDietRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === currentDietRoleId);
        if (role && role.prompt) {
            systemPrompt = `你扮演 ${role.name}。${role.prompt}\n【最高强制指令：只准严格输出规定的食谱数据！绝对禁止说任何多余的话！不要聊天对白！必须遵守时代背景】`;
        }
    }

    const isToday = currentDietDate === new Date().setHours(0,0,0,0);
    let userPrompt = '';
    
    if (isToday) {
        userPrompt = `请记录你今天打算吃的一顿或多顿饭。
【要求】：
1. 严禁任何问候、对白或解释。
2. 每一行只输出一顿饭的记录，格式必须严格如下（左边餐类，竖线，右边食物加符合人物性格和对白语言的短句）：
[AI饮食] 早餐 | 冰美式 (提神保命)
[AI饮食] 午餐 | 庙街煲仔饭 (还是街边吃得舒坦)
如果你现在不想吃，严格回复：
[AI饮食] 不吃`;
    } else {
        const dateStr = new Date(currentDietDate).toLocaleDateString();
        userPrompt = `我们在回顾 ${dateStr} 这一天。请记录你那天吃的一顿或多顿饭。
【要求】：
1. 严禁任何问候、对白或解释。
2. 每一行只输出一顿饭的记录，格式必须严格如下：
[AI饮食] 午餐 | 烧味拼盘 (随便吃点)
如果你那餐没吃东西，严格回复：
[AI饮食] 不吃`;
    }

    try {
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
    const errData = await response.text();
    throw new Error(`HTTP状态码 ${response.status} | 详细原因: ${errData}`);
}
        
        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        // 正则提取它按要求输出的固定格式
        if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
        if (!dailyDietData[currentDietDate].meals) dailyDietData[currentDietDate].meals = [];
        
        const lines = reply.split('\n');
        let added = false;
        lines.forEach(line => {
            const match = line.match(/\[AI饮食\]\s*(.*?)\s*\|\s*(.*)/);
            if (match) {
                const type = match[1].trim();
                const food = match[2].trim();
                if (type && food) {
                    dailyDietData[currentDietDate].meals.push({ id: Date.now() + Math.random(), type: type, food: food, isAi: true });
                    added = true;
                }
            }
        });
        
        if (added) {
            await saveToDB('diet_records_db', dailyDietData);
            renderDietUI(); 
            document.getElementById('dietAiReply').innerHTML = `<span style="color:var(--accent)">TA 已经把自己打算吃的东西，加到了上方的列表里啦~</span>`;
        } else if (reply.includes('不吃')) {
            document.getElementById('dietAiReply').innerHTML = `<span style="color:var(--accent)">TA 傲娇地说这天不打算吃东西。</span>`;
        } else {
            document.getElementById('dietAiReply').innerHTML = `<span style="color:#D67A7A">TA 的回答格式不对，没有成功识别：<br>${reply}</span>`;
        }
        
    } catch (e) {
        document.getElementById('dietAiReply').innerText = "点餐失败：" + e.message;
    } finally {
        btn.innerText = "TA吃什么?";
        btn.style.opacity = '1';
    }
});

// === 节点切换：三个点菜单逻辑 ===
// 1. 每次打开APP时，读取一次之前的状态，让三个点变色
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('食谱')) {
        app.addEventListener('click', async () => {
            const isSub = await loadFromDB('dietUseSubApi') || false;
            document.getElementById('dietApiToggleBtn').style.color = isSub ? 'var(--accent)' : 'var(--text-sub)';
        });
    }
});

// 2. 点击三个点切换节点 (带跟随式悬浮提示)
document.getElementById('dietApiToggleBtn').addEventListener('click', async function() {
    let isSub = await loadFromDB('dietUseSubApi') || false;
    isSub = !isSub; // 反转状态
    await saveToDB('dietUseSubApi', isSub);
    
    // 改变图标颜色：奶咖色是副节点，深灰色是主节点
    this.style.color = isSub ? 'var(--accent)' : 'var(--text-sub)';
    
    // 动态生成一个就在手指旁边浮现的精致小气泡
    let toast = document.getElementById('apiToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'apiToast';
        toast.style.cssText = "position:absolute; top:36px; right:60px; background:var(--surface); border:1px solid rgba(184,156,142,0.3); padding:8px 14px; border-radius:12px; font-size:12px; font-weight:700; box-shadow:0 6px 16px rgba(0,0,0,0.08); opacity:0; transition:opacity 0.2s; pointer-events:none; z-index:999; white-space:nowrap;";
        this.parentNode.style.position = 'relative'; // 相对定位
        this.parentNode.appendChild(toast);
    }
    
    toast.innerText = isSub ? '已切换至 : 副节点 (Sub)' : '已切换至 : 主节点 (Main)';
    toast.style.color = isSub ? 'var(--accent)' : 'var(--text-main)';
    toast.style.opacity = '1';
    
    // 1.5秒后温柔地消失
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1500);
});

// === 梦境 APP 交互逻辑 ===
const dreamModal = document.getElementById('dreamAppModal');
let dreamCurrentTab = 'interpret'; // interpret (解梦) | exchange (交换) | collection (收藏)
let dreamCollections = [];
let lastDreamDataToSave = null; // 用于暂存以便收藏

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('梦境')) {
        app.addEventListener('click', async () => {
            dreamModal.classList.add('open');
            await loadDreamRoles();
            await loadDreamCollections();
            // 读取API设置
            const isSub = await loadFromDB('dreamUseSubApi') || false;
            document.getElementById('dreamApiToggle').checked = isSub;
        });
    }
});

document.getElementById('closeDreamApp').addEventListener('click', () => dreamModal.classList.remove('open'));
document.getElementById('openDreamSettingsBtn').addEventListener('click', () => document.getElementById('dreamSettingsModal').classList.add('show'));
document.getElementById('closeDreamSettingsBtn').addEventListener('click', async () => {
    await saveToDB('dreamUseSubApi', document.getElementById('dreamApiToggle').checked);
    document.getElementById('dreamSettingsModal').classList.remove('show');
});

// 加载角色到下拉框
async function loadDreamRoles() {
    const chars = await loadFromDB('ai_characters') || [];
    const group = document.getElementById('dreamRoleGroup');
    group.innerHTML = '';
    chars.forEach(c => {
        if(c.roleType === 'char') group.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

// 切换下拉框时，显示或隐藏自定义名字输入框
document.getElementById('dreamPersonSelect').addEventListener('change', function(e) {
    if (e.target.value === 'custom') {
        document.getElementById('dreamCustomName').style.display = 'block';
    } else {
        document.getElementById('dreamCustomName').style.display = 'none';
    }
});

// 顶部 Tab 切换逻辑
document.querySelectorAll('#dreamTabSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#dreamTabSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        dreamCurrentTab = btn.dataset.tab;
        
        const inputArea = document.getElementById('dreamInputArea');
        const collectionArea = document.getElementById('dreamCollectionArea');
        const actionBtn = document.getElementById('dreamActionBtn');
        
        if (dreamCurrentTab === 'collection') {
            inputArea.style.display = 'none';
            collectionArea.style.display = 'flex';
            renderDreamCollections();
        } else {
            inputArea.style.display = 'flex';
            collectionArea.style.display = 'none';
            actionBtn.innerText = dreamCurrentTab === 'interpret' ? "让 TA 帮你解梦" : "与 TA 交换梦境";
        }
    });
});

// 核心网络请求
document.getElementById('dreamActionBtn').addEventListener('click', async function() {
    const content = document.getElementById('dreamContentInput').value.trim();
    if (!content) { showToast('请先描述你的梦境...'); return; }

    const useSubApi = await loadFromDB('dreamUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) { showToast("请先去设置配置 API 节点！"); return; }

    const btn = this;
    const originalText = btn.innerText;
    btn.innerText = "进入梦境连接中...";
    btn.style.opacity = '0.7';

    // 确定交流对象身份
const selectVal = document.getElementById('dreamPersonSelect').value;
let targetName = '神秘解梦人';

// 完美复刻你的原版白描手法设定
let systemPrompt = "[System Note: 请使用细腻的白描手法描写，注重氛围感和细节描写。绝对禁止使用括号()或星号**来表示动作。禁止使用独白体，直接进行描写。]\n\n";

if (selectVal === 'random') {
    systemPrompt += "你是一个随机的、性格独特的陌生人。请先用一句话简短介绍你的虚拟身份，然后解答或回复。";
} else if (selectVal === 'custom') {
    targetName = document.getElementById('dreamCustomName').value.trim() || '神秘人';
    systemPrompt += `你现在的身份是【${targetName}】。请完全沉浸入这个角色，以符合该角色的时代背景、说话语气和世界观来回答。不要出戏。`;
} else {
    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === selectVal);
    if (role) {
        targetName = role.name;
        systemPrompt += `你扮演 ${role.name}。人物设定：${role.prompt}\n请完全遵守人物设定和语气进行回复，不要出戏。`;
    }
}

// 区分“解梦”和“交换梦境”的 Prompt (融合你原版的强硬要求风格)
let userPrompt = '';
if (dreamCurrentTab === 'interpret') {
    userPrompt = `用户向你讲述了TA的梦境：\n"${content}"\n\n【要求】：\n1. 请你以当前的身份视角和世界观，为用户解答这个梦境的潜在含义。\n2. 结合你的性格特点，给出安慰、预言或哲理分析。\n3. 必须分段，篇幅适中。\n4. 不要解释，直接进行你的解答。`;
} else {
    userPrompt = `用户用一个梦境与你交换：\n"${content}"\n\n请你回赠一个奇异、超现实的梦境。\n【要求】：\n1. 必须完全符合角色性格。\n2. 必须分段。\n3. 篇幅600字以内。\n4. 不要解释，直接描述。\n5. 可以在结尾对用户的梦境作出一两句符合人设的简短回应。`;
}

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.8 })
        });
        
        if (!res.ok) throw new Error('网络请求失败');
        
        const data = await res.json();
        const reply = data.choices[0].message.content.trim();
        
        document.getElementById('dreamResultArea').style.display = 'block';
        document.getElementById('dreamResultTitle').innerText = `${targetName} 的回应`;
        document.getElementById('dreamResultText').innerText = reply;
        document.getElementById('saveDreamBtn').style.display = 'block';

        // 暂存用于收藏
        lastDreamDataToSave = {
            id: 'dream_' + Date.now(),
            type: dreamCurrentTab === 'interpret' ? '解梦' : '交换',
            targetName: targetName,
            myDream: content,
            aiReply: reply,
            time: Date.now()
        };

    } catch (e) {
        showToast("连接梦境失败：" + e.message);
    } finally {
        btn.innerText = originalText;
        btn.style.opacity = '1';
    }
});

// 收藏功能
async function loadDreamCollections() {
    dreamCollections = await loadFromDB('dream_collections') || [];
}

document.getElementById('saveDreamBtn').addEventListener('click', async function() {
    if (lastDreamDataToSave) {
        dreamCollections.unshift(lastDreamDataToSave);
        await saveToDB('dream_collections', dreamCollections);
        showToast('梦境已收藏进册子！');
        this.style.display = 'none'; // 收藏后隐藏按钮
        lastDreamDataToSave = null;
    }
});

// 全局注册展开/折叠功能
window.toggleDreamExpand = function(btn) {
    const wrapper = btn.previousElementSibling; // 现在选中的是整个内容包裹层
    if (wrapper.classList.contains('collapsed')) {
        wrapper.classList.remove('collapsed');
        wrapper.classList.add('expanded');
        btn.innerText = 'FOLD UP ∧';
    } else {
        wrapper.classList.remove('expanded');
        wrapper.classList.add('collapsed');
        btn.innerText = 'READ MORE ∨';
    }
};

// 渲染收藏册卡片
function renderDreamCollections() {
    const container = document.getElementById('dreamCollectionArea');
    container.innerHTML = '';
    if (dreamCollections.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:13px; margin-top:60px; letter-spacing:1px;">册子里空空如也，今晚做个好梦吧。</div>';
        return;
    }

    dreamCollections.forEach(item => {
        const div = document.createElement('div');
        div.className = 'dream-col-card';
        const dateStr = new Date(item.time).toLocaleDateString().replace(/\//g, '.');
        
        // 【核心修改】因为平时彻底折叠，我们甚至不需要用 substring 去截断字数了，展开就能直接看全文！
        div.innerHTML = `
            <div class="dream-col-header">
                <div class="dream-tag">${item.type}</div>
                <div class="dream-date">${dateStr}</div>
            </div>
            <div class="dream-col-source">与 ${item.targetName} 的共振</div>
            <!-- 加了一个专门用来彻底隐藏的大外壳 -->
            <div class="dream-col-content-wrapper collapsed">
                <div class="dream-col-mine">${item.myDream}</div>
                <div class="dream-col-reply">${item.aiReply}</div>
            </div>
            <div class="dream-expand-btn" onclick="toggleDreamExpand(this)">READ MORE ∨</div>
            <div class="dream-col-footer">
                <div class="dream-col-del" onclick="deleteDream('${item.id}')">销毁记忆</div>
            </div>
        `;
        container.appendChild(div);
    });
}


// === 信笺APP 终极侧边栏架构逻辑 ===
const letterModal = document.getElementById('letterAppModal');
const drawer = document.getElementById('letterDrawer');
const drawerOverlay = document.getElementById('letterDrawerOverlay');

let draftsData = []; 
let mailboxData = [];
let currentDraftId = null;
let saveDraftTimer = null;

// ==== 自动触发错投信件的核心函数 ====
async function triggerRandomWrongMail() {
// === 拦截器：后台耗钱开关 ===
const isWrongMailEnabled = await loadFromDB('globalWrongMail') !== false;
if (!isWrongMailEnabled) return; // 开关关了，直接退出不花钱

    // --- 新增：每天只掷一次骰子机制 ---
const todayStr = new Date().toLocaleDateString();
const lastRollDate = await loadFromDB('lastWrongMailRollDate');
if (lastRollDate === todayStr) return; // 今天已经判定过了，直接退出

await saveToDB('lastWrongMailRollDate', todayStr); // 记录今天已经判定过

if(Math.random() > 0.25) return; // 25%的概率中奖触发
    
    const useSubApi = await loadFromDB('letterUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if(apiKey) {
        try {
            const sysPrompt = `请随机生成一封“寄错地址的信件”。发件人和收件人必须是随机的虚构人物、古代名人或科幻角色。\n格式必须严格如下，用 | 隔开：\n发件人名字|收件人名字|信件正文内容（写一段隐秘的、充满感情的话）\n不要输出任何其他废话。`;
            
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.9 })
            });
            const data = await res.json();
            const replyText = data.choices[0].message.content;
            
            let parts = replyText.split('|');
            let sender = "未知寄件人";
            let content = replyText;
            if(parts.length >= 3) {
                sender = parts[0].trim();
                content = `(本应寄给：${parts[1].trim()})\n\n${parts.slice(2).join('|').trim()}`;
            }
            
            // 存入邮箱并标记为错寄 (isWrong: true)
            const mailList = await loadFromDB('letter_mailbox') || [];
            mailList.unshift({ id: 'wrong_'+Date.now(), sender: sender, content: content, timestamp: Date.now(), isRead: false, isWrong: true });
            await saveToDB('letter_mailbox', mailList);
            mailboxData = mailList; // 更新当前内存
            
            // 优雅的顶部小弹窗提示
            const toast = document.createElement('div');
            toast.innerText = '📮 邮筒里似乎刚被塞入了一封寄错的信...';
            toast.style.cssText = 'position:absolute; top:30px; left:50%; transform:translateX(-50%); background:var(--accent); color:#fff; padding:12px 24px; border-radius:24px; font-size:13px; font-weight:bold; z-index:9999; box-shadow:0 8px 24px rgba(184,156,142,0.4); opacity:0; transition:opacity 0.4s, top 0.4s;';
            document.getElementById('letterAppModal').appendChild(toast);
            
            // 动画效果
            setTimeout(() => { toast.style.opacity = '1'; toast.style.top = '40px'; }, 100);
            setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '30px'; }, 3500);
            setTimeout(() => toast.remove(), 4000);
            
            // 如果邮筒正开着，立刻刷新列表
            if(document.getElementById('letterMailboxPanel').classList.contains('show')) {
                renderMailbox();
            }
        } catch(e) {} // 后台静默执行，失败了不打扰用户
    }
}

// ==== 绑定信笺APP图标点击 ====
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('信笺')) {
        app.addEventListener('click', async () => {
            // 1. 先在后台静默把数据拉取完毕
            await loadLetterData();
            if(draftsData.length === 0) createNewDraft();
            else switchDraft(draftsData[0].id);
            
            // 2. 抄袭梦境的写法，在这里提前给副API开关和羁绊开关赋值
            const isSub = await loadFromDB('letterUseSubApi') || false;
            document.getElementById('towerApiToggle').checked = isSub;
            
            const isAutoSummary = await loadFromDB('letterAutoSummary') || false;
            document.getElementById('towerAutoSummaryToggle').checked = isAutoSummary;
            document.getElementById('autoSummarySettings').style.display = isAutoSummary ? 'block' : 'none';
            
            const rounds = await loadFromDB('letterSummaryRounds') || 15;
            document.getElementById('towerSummaryRounds').value = rounds;

            // 3. 所有的DOM状态准备就绪后，再丝滑展开面板，告别闪烁！
            letterModal.classList.add('open');
            
            
        });
    }
});

document.getElementById('closeLetterAppBtn').addEventListener('click', () => letterModal.classList.remove('open'));

// 侧栏呼出与关闭
document.getElementById('letterMenuBtn').addEventListener('click', () => {
    renderDrawerList();
    drawer.classList.add('show');
    drawerOverlay.classList.add('show');
});
drawerOverlay.addEventListener('click', closeDrawer);
function closeDrawer() {
    drawer.classList.remove('show');
    drawerOverlay.classList.remove('show');
}

// 自动保存机制 (极其丝滑)
function triggerAutoSave() {
    clearTimeout(saveDraftTimer);
    saveDraftTimer = setTimeout(async () => {
        if(!currentDraftId) return;
        const draft = draftsData.find(d => d.id === currentDraftId);
        if(draft) {
            draft.title = document.getElementById('letterCurrentTitle').value || '无题';
            draft.content = document.getElementById('letterMainContent').value;
            await saveToDB('letter_drafts', draftsData);
        }
    }, 600); // 停止打字0.6秒后无感保存
}
document.getElementById('letterCurrentTitle').addEventListener('input', triggerAutoSave);
document.getElementById('letterMainContent').addEventListener('input', triggerAutoSave);

async function loadLetterData() {
    draftsData = await loadFromDB('letter_drafts') || [];
    mailboxData = await loadFromDB('letter_mailbox') || [];
}

function createNewDraft() {
    const newId = 'draft_' + Date.now();
    draftsData.unshift({ id: newId, title: '无题', content: '' });
    saveToDB('letter_drafts', draftsData);
    switchDraft(newId);
}
document.getElementById('letterAddBtn').addEventListener('click', () => {
    createNewDraft();
    closeDrawer();
});

function switchDraft(id) {
    currentDraftId = id;
    const draft = draftsData.find(d => d.id === id);
    if(draft) {
        document.getElementById('letterCurrentTitle').value = draft.title;
        document.getElementById('letterMainContent').value = draft.content;
    }
}

// 侧边栏列表渲染
function renderDrawerList() {
    const listEl = document.getElementById('letterDrawerList');
    listEl.innerHTML = '';
    draftsData.forEach(draft => {
        const item = document.createElement('div');
        item.className = 'drawer-item' + (draft.id === currentDraftId ? ' active' : '');
        item.innerHTML = `
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${draft.title || '无题'}</div>
            <div class="drawer-item-del" data-id="${draft.id}">×</div>
        `;
        item.onclick = (e) => {
            if(e.target.classList.contains('drawer-item-del')) {
                // 删除此草稿
                showBeautifulDialog('销毁文稿', '确定要将这页信纸撕毁吗？', 'confirm', '', async () => {
                    draftsData = draftsData.filter(d => d.id !== draft.id);
                    await saveToDB('letter_drafts', draftsData);
                    if(draftsData.length === 0) createNewDraft();
                    else if (draft.id === currentDraftId) switchDraft(draftsData[0].id);
                    renderDrawerList();
                });
            } else {
                switchDraft(draft.id);
                closeDrawer();
            }
        };
        listEl.appendChild(item);
    });
}

// === 信号塔 与 羁绊记忆 ===



// 打开设置面板 (此时状态已经是正确的，绝不会闪动)
document.getElementById('openTowerBtn').addEventListener('click', () => {
    document.getElementById('towerModal').classList.add('show');
});

// 取消与关闭
document.getElementById('cancelTowerBtn').addEventListener('click', () => {
    document.getElementById('towerModal').classList.remove('show');
});

// 监听“羁绊总结”开关，动态展开/收起下方输入框
document.getElementById('towerAutoSummaryToggle').addEventListener('change', function(e) {
    document.getElementById('autoSummarySettings').style.display = e.target.checked ? 'block' : 'none';
});

// 保存信号塔设置
document.getElementById('saveTowerBtn').addEventListener('click', async () => {
    await saveToDB('letterUseSubApi', document.getElementById('towerApiToggle').checked);
    await saveToDB('letterAutoSummary', document.getElementById('towerAutoSummaryToggle').checked);
    
    let rounds = parseInt(document.getElementById('towerSummaryRounds').value);
    if (isNaN(rounds) || rounds < 1) rounds = 15; // 防止填乱七八糟的内容
    await saveToDB('letterSummaryRounds', rounds);
    
    document.getElementById('towerModal').classList.remove('show');
});

// 羁绊记忆管理面板逻辑
document.getElementById('openBondBtn').addEventListener('click', async () => {
    document.getElementById('bondMemoryContent').value = await loadFromDB('letter_bond_memory') || '';
    document.getElementById('bondModal').classList.add('show');
});
document.getElementById('closeBondBtn').addEventListener('click', () => document.getElementById('bondModal').classList.remove('show'));
document.getElementById('saveBondBtn').addEventListener('click', async () => {
    await saveToDB('letter_bond_memory', document.getElementById('bondMemoryContent').value);
    document.getElementById('bondModal').classList.remove('show');
});
// 信物珍藏册管理逻辑
document.getElementById('openKeepsakeBtn').addEventListener('click', async () => {
    document.getElementById('keepsakeContent').value = await loadFromDB('letter_keepsake_memory') || '';
    document.getElementById('keepsakeModal').classList.add('show');
});
document.getElementById('closeKeepsakeBtn').addEventListener('click', () => document.getElementById('keepsakeModal').classList.remove('show'));
document.getElementById('saveKeepsakeBtn').addEventListener('click', async () => {
    await saveToDB('letter_keepsake_memory', document.getElementById('keepsakeContent').value);
    document.getElementById('keepsakeModal').classList.remove('show');
    showToast('信物已妥善珍藏！');
});
// === 寄出信件 ===
document.getElementById('openSendDialogBtn').addEventListener('click', async () => {
    const chars = await loadFromDB('ai_characters') || [];
    const select = document.getElementById('letterSendCharacter');
    select.innerHTML = '<option value="">-- 选择寄给已有角色 --</option>';
    chars.forEach(c => {
        if(c.roleType === 'char') select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    document.getElementById('letterMyName').value = await loadFromDB('letterMyName') || '';
    document.getElementById('letterMySeal').value = await loadFromDB('letterMySeal') || '';
    document.getElementById('letterTaSeal').value = await loadFromDB('letterTaSeal') || '';
    document.getElementById('letterSendPanel').classList.add('show');
});
document.getElementById('cancelSendBtn').addEventListener('click', () => document.getElementById('letterSendPanel').classList.remove('show'));

document.getElementById('confirmSendBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmSendBtn');
    const content = document.getElementById('letterMainContent').value.trim();
    if(!content) { showToast('信纸还是空的哦！'); return; }
    
    await saveToDB('letterMyName', document.getElementById('letterMyName').value);
    await saveToDB('letterMySeal', document.getElementById('letterMySeal').value);
    await saveToDB('letterTaSeal', document.getElementById('letterTaSeal').value);

    const useSubApi = await loadFromDB('letterUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if(!apiKey) { showToast('请先在设置中配置API节点！'); return; }

    const charId = document.getElementById('letterSendCharacter').value;
    const sendName = document.getElementById('letterSendName').value;
    const myName = document.getElementById('letterMyName').value || '匿名者';
    const seal = document.getElementById('letterMySeal').value;
    const realDateStr = new Date().toLocaleDateString();
    const taSeal = document.getElementById('letterTaSeal').value;
    
    let targetDesc = '';
    let targetNameForSummary = sendName || '陌生人';
    if(charId) {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === charId);
        if(role) {
            targetDesc = `你是${role.name}。${role.prompt}`;
            targetNameForSummary = role.name;
        }
    } else {
        const sendEra = document.getElementById('letterSendEra').value || '未知';
        targetDesc = `你是一个身处【${sendEra}】时代的【${sendName||'随机陌生人'}】`;
    }
    
    const emojiDesc = seal ? `\n寄件人在信纸上留下了专属印记：【${seal}】。` : '';
    const taSealDesc = taSeal ? `\n【核心相认提示】：寄件人在信中向你出示了你曾经给TA的专属暗号/信物：【${taSeal}】。` : '';
    const bond = await loadFromDB('letter_bond_memory');
    const memoryPrompt = bond ? `\n【已有羁绊记忆】：${bond}` : '';

    const sysPrompt = `${targetDesc}
此时此刻的真实日期是：${realDateStr}。
你收到了一封来自自称“${myName}”的时空来信，内容：“${content}”。${emojiDesc}${taSealDesc}${memoryPrompt}

请用符合你身份、时代、人物性格的语气，给ta回一封信。
【强制格式要求】：
1. 必须在回信的第一行写一个简短的标题，用【】括起来（例如：【致未来的你】或【关于那只蝴蝶】）。
2. 从第二行开始写回信正文。
3. 【羁绊成长】：如果我们交流很久了，你可以主动提出或者使用一个属于我们俩的【专属标记/暗号】作为落款。
4. 必须真实代入设定！直接自然地写出回信正文！`;

    // ================= 核心：界面立刻关闭，开启后台任务 =================
    document.getElementById('letterSendPanel').classList.remove('show');
    showToast('寄出啦，去逛逛别的吧~');
    
    // (匿名自执行异步函数：把它丢到后台去慢慢跑，不再阻塞界面)
    (async function backgroundSendTask() {
        try {
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
            });
            const data = await res.json();
            const replyContent = data.choices[0].message.content;
            
            let mailTitle = targetNameForSummary;
            let mailBody = replyContent;
            if(replyContent.startsWith('【') && replyContent.includes('】')) {
                const endIdx = replyContent.indexOf('】');
                mailTitle = replyContent.substring(1, endIdx);
                mailBody = replyContent.substring(endIdx + 1).trim();
            }
            
            // 读取最新的邮筒数据并存入新信件
            let currentMailbox = await loadFromDB('letter_mailbox') || [];
            currentMailbox.unshift({
                id: 'mail_' + Date.now(),
                sender: mailTitle,
                content: mailBody,
                timestamp: Date.now(), seal: seal, isRead: false
            });
            await saveToDB('letter_mailbox', currentMailbox);
            mailboxData = currentMailbox; // 更新内存数据
            
            // 叮咚！像 QQ 消息一样弹出悬浮窗！
            showToast('叮咚！邮筒有新信件！');
            
            // 如果用户正巧开着邮筒，立刻帮他刷新列表
            if(document.getElementById('letterMailboxPanel').classList.contains('show')) {
                renderMailbox();
            }
            
        // 自动总结羁绊逻辑
const isAutoSummary = document.getElementById('towerAutoSummaryToggle').checked;
if (isAutoSummary) {
    // 1. 读取你设定的目标轮数（没设就是15）
    let targetRounds = await loadFromDB('letterSummaryRounds');
    if (!targetRounds || isNaN(targetRounds)) targetRounds = 15;
    
    // 2. 读取你和这个角色当前的通信轮数计步器
    let currentRounds = await loadFromDB('bond_rounds_' + targetNameForSummary) || 0;
    currentRounds++; // 加上这次刚完成的一来一回

    // 3. 判断是否攒够了设定的轮数
    if (currentRounds >= targetRounds) {
        // 攒够了！清零计步器，并呼叫 AI 提炼羁绊
        await saveToDB('bond_rounds_' + targetNameForSummary, 0);
        triggerBondSummary(apiUrl, apiKey, model, targetNameForSummary, myName, bond, content, mailBody);
    } else {
        // 还没攒够，把新的计步数字存进数据库，默默等待
        await saveToDB('bond_rounds_' + targetNameForSummary, currentRounds);
        // 可以在后台偷偷看当前到第几轮了（选填，不影响运行）
        console.log(`【${targetNameForSummary}】羁绊积累中: ${currentRounds} / ${targetRounds}`);
    }
}
        } catch(e) {
            showToast('🌪️ 邮递员在时空隧道迷路了: ' + e.message);
        }
    })();
});

// === 邮筒与错寄信件 ===
// === 打开邮筒与渲染逻辑 ===
document.getElementById('openMailboxBtn').addEventListener('click', async () => {
    // 每次打开邮筒前，先检查一下有没有“在路上飘了几天终于寄到”的信
    const now = Date.now();
    let hasNewArrival = false;
    
    mailboxData.forEach(mail => {
        if (mail.deliverTime && mail.deliverTime <= now) {
            delete mail.deliverTime; // 时间到了！抹掉延迟标记，让它正式掉进邮筒！
            mail.timestamp = now;    // 把收信时间更新为此时此刻
            hasNewArrival = true;
        }
    });

    if (hasNewArrival) {
        await saveToDB('letter_mailbox', mailboxData);
        showToast('叮咚！有在路上漂泊了很久的信件终于送达了！');
    }

    renderMailbox();
    document.getElementById('letterMailboxPanel').classList.add('show');
});

document.getElementById('closeMailboxBtn').addEventListener('click', () => document.getElementById('letterMailboxPanel').classList.remove('show'));

function renderMailbox() {
    const list = document.getElementById('mailboxList');
    list.innerHTML = '';
    const now = Date.now();
    
    // ★ 核心改动：把还在路上（时间没到）的信件藏起来不显示
    const visibleMails = mailboxData.filter(m => !m.deliverTime || m.deliverTime <= now);
    
    visibleMails.forEach(mail => {
        const div = document.createElement('div');
        div.className = 'mail-card';
        div.innerHTML = `
            <div style="font-weight:bold; font-size:15px; margin-bottom:4px;">${mail.sender} ${mail.isWrong ? '<span style="color:#D67A7A;font-size:10px;">[错寄]</span>' : (!mail.isRead ? '<span style="color:var(--accent);font-size:10px;">[新]</span>' : '')}</div>
            <div style="font-size:12px; color:var(--text-sub); display:-webkit-box; -webkit-line-clamp:2; overflow:hidden; -webkit-box-orient:vertical;">${mail.isRead ? mail.content : '一封尚未拆开的信...'}</div>
        `;
        div.onclick = () => openReadMail(mail);
        list.appendChild(div);
    });
}

document.getElementById('checkNewMailBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkNewMailBtn');
    btn.innerText = "正在信箱底部摸索..."; 
    btn.disabled = true;

    const useSubApi = await loadFromDB('letterUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if(apiKey) {
        try {
            const sysPrompt = `请随机生成一封“公开漂流瓶/交友信/随笔分享”。可能是有人想交笔友、分享一首诗、一段伤感随笔、一个搞笑段子，或者是科幻/古代背景下的公开广播。
发件人必须是随机设定的虚构人物、古代名人或科幻角色。
格式必须严格如下，用 | 隔开：
发件人名字|信件标题|信件正文内容
不要输出任何其他废话。`;
            
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.9 })
            });
            const data = await res.json();
            const replyText = data.choices[0].message.content;
            
            let parts = replyText.split('|');
            let sender = "匿名的分享者";
            let content = replyText;
            if(parts.length >= 3) {
                sender = parts[0].trim();
                content = `【${parts[1].trim()}】\n\n${parts.slice(2).join('|').trim()}`;
            }
            
            // 注意这里 isWrong 是 false，因为这是公开分享，不是错寄的
            mailboxData.unshift({ id: 'public_'+Date.now(), sender: sender, content: content, timestamp: Date.now(), isRead: false, isWrong: false });
            await saveToDB('letter_mailbox', mailboxData);
            renderMailbox();
        } catch(e){ showToast('摸索失败了，可能是网络信号不好。'); }
    } else {
        showToast('请先在设置中配置API节点哦！');
    }
    
    btn.innerText = "翻看是否有新信件..."; 
    btn.disabled = false;
});

let currentReadId = null;
function openReadMail(mail) {
    currentReadId = mail.id;
    document.getElementById('readLetterTitle').innerText = mail.sender;
    document.getElementById('readLetterMeta').innerText = new Date(mail.timestamp).toLocaleString();
    document.getElementById('readLetterContent').innerText = mail.content;
    document.getElementById('readLetterSeal').innerText = mail.seal ? `印记: ${mail.seal}` : '';
    
    if(mail.isWrong) document.getElementById('wrongMailActions').style.display = 'flex';
    else document.getElementById('wrongMailActions').style.display = 'none';

    if(!mail.isRead) { mail.isRead = true; saveToDB('letter_mailbox', mailboxData); renderMailbox(); }
    document.getElementById('letterReadPanel').classList.add('show');
}
document.getElementById('closeReadBtn').addEventListener('click', () => document.getElementById('letterReadPanel').classList.remove('show'));

// 私藏错寄信件
document.getElementById('keepWrongMailBtn').addEventListener('click', async () => {
    showToast("你悄悄把这封信收了起来...");
    const mail = mailboxData.find(m => m.id === currentReadId);
    if(mail) { 
        mail.isWrong = false; 
        mail.sender = "私藏的信：" + mail.sender; 
        await saveToDB('letter_mailbox', mailboxData); 
    }
    document.getElementById('letterReadPanel').classList.remove('show'); 
    renderMailbox();
});

// 退回错寄信件（静默呼叫API生成感谢信）
// 退回错寄信件（静默呼叫API生成感谢信，并在几天后送达）
document.getElementById('returnWrongMailBtn').addEventListener('click', async () => {
    const mail = mailboxData.find(m => m.id === currentReadId);
    if (!mail) return;

    // 1. 关闭面板并给出温柔提示
    document.getElementById('letterReadPanel').classList.remove('show'); 
    showToast('已交给邮递员退回原处...');

    // 2. 把这封错寄的信从你的邮筒删掉
    mailboxData = mailboxData.filter(m => m.id !== currentReadId);
    await saveToDB('letter_mailbox', mailboxData);
    renderMailbox();

    // 3. 开启后台静默任务，呼叫 API 写感谢信
    (async function backgroundReturnThanks() {
        const useSubApi = await loadFromDB('letterUseSubApi') || false;
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

        if (!apiKey) return;

        try {
            const sysPrompt = `你之前不小心寄错了一封信，内容是：“${mail.content}”。
有一位好心的陌生人没有私藏，而是把信退回了邮局，最终物归原主。
请你以原来寄件人（${mail.sender}）的身份，给这位善良的陌生人写一封简短的感谢信。
【要求】
1. 感谢ta的善意，语气必须完全符合你（${mail.sender}）的人设背景。
2. 格式严格为：发件人|信件正文
3. 不要有多余的废话。`;

            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
            });
            
            const data = await res.json();
            const replyText = data.choices[0].message.content;
            
            let parts = replyText.split('|');
            let senderName = mail.sender;
            let replyContent = replyText;
            if(parts.length >= 2) {
                senderName = parts[0].trim();
                replyContent = parts.slice(1).join('|').trim();
            }

            // ★ 核心改动：计算送达时间（随机 3 到 7 天之后）
            const delayDays = Math.floor(Math.random() * 5) + 3; // 3 ~ 7 天
            const deliverTime = Date.now() + delayDays * 24 * 60 * 60 * 1000;
            
            // 💡 如果你写代码时想马上测试效果，可以暂时把上面两行删掉，换成下面这行（1分钟后送达）：
            // const deliverTime = Date.now() + 1 * 60 * 1000; 

            let currentMailbox = await loadFromDB('letter_mailbox') || [];
            currentMailbox.unshift({ 
                id: 'thanks_' + Date.now(), 
                sender: `${senderName} 的感谢信`, 
                content: replyContent, 
                timestamp: Date.now(), 
                deliverTime: deliverTime, // 悄悄打上送达时间标签
                isRead: false, 
                isWrong: false 
            });
            await saveToDB('letter_mailbox', currentMailbox);
            mailboxData = currentMailbox; 
            
            // 注意：由于是几天后才到，所以我们不弹提示，让它彻底隐藏在后台。
        } catch(e) {}
    })();
});

// === 自动提炼羁绊记忆 (Prompt 2) ===
async function triggerBondSummary(apiUrl, apiKey, model, targetName, senderName, oldMemory, myLetter, aiReply) {
    try {
        const hText = `我的去信：${myLetter}\n对方的回信：${aiReply}`;
        const sysSummary = `你是一个记忆提炼助手。请根据下方的往来书信记录，提炼出【${targetName}】与【${senderName}】之间的羁绊记忆。
【已有记忆】：
${oldMemory || '无'}

【最近通信】：
${hText}

【核心要求】：
1. 重点提炼双方约定的【专属暗号】、经常互寄的【贴纸/物品】、以及彼此之间发生的重要事件和情感变化。
2. 以第三人称客观陈述，尽量压缩精简，保留干货，不超过350字。
3. 绝对不要输出任何无关废话、问候语或Markdown代码块。`;

        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
            body:JSON.stringify({ model, messages:[{role:"system",content:sysSummary}], temperature:0.5 })
        });
        const data = await res.json();
        const newMemory = data.choices[0].message.content.trim();
        
        // 自动保存到本地羁绊记忆，并更新弹窗里显示的文字
        await saveToDB('letter_bond_memory', newMemory);
        document.getElementById('bondMemoryContent').value = newMemory;
        console.log("羁绊记忆已自动更新！");
        
    } catch(e) {
        console.error("提炼羁绊记忆失败：", e);
    }
}

// === 日记 APP 交互逻辑 (支持相片与头像缓存版) ===
const diaryModal = document.getElementById('diaryAppModal');
const diaryWritePanel = document.getElementById('diaryWritePanel');
const diaryReadPanel = document.getElementById('diaryReadPanel');
const exchangeDetailPanel = document.getElementById('exchangeDetailPanel');
let diaryCurrentTab = 'private'; 
let diariesData = [];
let currentExchangeChar = null; 
let tempDiaryImgFile = null;
window.diaryAvatarCache = window.diaryAvatarCache || {}; 
let diaryAvatarCache = window.diaryAvatarCache; // 【核心】解决头像闪烁的缓存

document.querySelectorAll('.app-name').forEach(appNameDiv => {
    if (appNameDiv.innerText.trim() === '日记') {
        const appIcon = appNameDiv.closest('.app');
        if (appIcon) {
            appIcon.addEventListener('click', async () => {
                diaryModal.classList.add('open');
                await loadDiaryData();
            });
        }
    }
});
document.getElementById('closeDiaryApp').addEventListener('click', () => diaryModal.classList.remove('open'));

document.querySelectorAll('#diaryTabSelector .diary-tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#diaryTabSelector .diary-tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        diaryCurrentTab = btn.dataset.tab;
        
        document.getElementById('privateDiaryView').style.display = 'none';
        document.getElementById('exchangeDiaryView').style.display = 'none';
        document.getElementById('aiDiaryView').style.display = 'none';
        
        if (diaryCurrentTab === 'private') {
            document.getElementById('privateDiaryView').style.display = 'block';
            renderPrivateDiaryList();
        } else if (diaryCurrentTab === 'exchange') {
            document.getElementById('exchangeDiaryView').style.display = 'block';
            renderExchangeCharacterList();
                } else if (diaryCurrentTab === 'ai_diary') {
            document.getElementById('aiDiaryView').style.display = 'block';
            renderAiDiaryList();
        }
    });
});

async function loadDiaryData() {
    diariesData = await loadFromDB('diary_records') || [];
    let changed = false;
    const now = Date.now();
    // 时间到了，系统偷偷把写好的回信展示出来
    diariesData.forEach(d => {
        if (d.type === 'exchange' && !d.aiContent && d.replyTime && d.replyTime <= now && d.pendingReplyText) {
            d.aiContent = d.pendingReplyText; 
            delete d.pendingReplyText;
            changed = true;
        }
    });
    if (changed) await saveToDB('diary_records', diariesData);

        if (diaryCurrentTab === 'private') {
        renderPrivateDiaryList();
    } else if (diaryCurrentTab === 'exchange') {
        renderExchangeCharacterList();
    } else if (diaryCurrentTab === 'ai_diary') {
        renderAiDiaryList();
    }
}

async function renderPrivateDiaryList() {
    const privateDiaries = diariesData.filter(d => d.type === 'private');
    document.getElementById('privateTotalCount').innerText = `${privateDiaries.length} 篇`;

    // 1. 提前后台预加载图片并缓存（彻底消灭等待白屏）
    for (let diary of privateDiaries) {
        if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id] === undefined) {
            const file = await loadFromDB(`diary_img_${diary.id}`);
            diaryAvatarCache['diary_img_'+diary.id] = file ? URL.createObjectURL(file) : '';
        }
    }

    const container = document.getElementById('diaryListArea');
    if (privateDiaries.length === 0) {
        container.innerHTML = '<div class="diary-poetic-empty"><svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg><div class="diary-poetic-text">岁月如白纸，等落笔生花</div></div>'; 
        return;
    }

    // 2. 内存中构建 HTML，不立刻清理屏幕
    const frag = document.createDocumentFragment();
    for (let diary of privateDiaries) {
        const div = document.createElement('div');
        div.className = 'organic-card';
        const dObj = new Date(diary.timestamp);
        
        let imgHtml = '';
        if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id]) {
            imgHtml = `<div style="width:100%; height:80px; border-radius:12px; background:url(${diaryAvatarCache['diary_img_'+diary.id]}) center/cover; margin-top:12px;"></div>`;
        }

        div.innerHTML = `
            <div class="organic-date">
                <span class="o-day">${dObj.getDate()}</span><span class="o-month">/${dObj.getMonth()+1}</span>
                <span class="o-time">${dObj.getHours()}:${dObj.getMinutes().toString().padStart(2,'0')}</span>
            </div>
            <div class="diary-mood-badge">${diary.mood}</div>
            <div class="diary-content-preview">${diary.myContent}</div>
            ${imgHtml}
        `;
        div.onclick = () => openReadPanel(diary);
        frag.appendChild(div);
    }
    
    // 3. 瞬间替换，彻底告别闪烁！
    container.innerHTML = '';
    container.appendChild(frag);
}

async function renderExchangeCharacterList() {
    const chars = await loadFromDB('ai_characters') || [];
    const exchangeChars = chars.filter(c => c.roleType === 'char');
    const container = document.getElementById('exchangeCharacterList');

    for (let char of exchangeChars) {
        if (diaryAvatarCache[char.id] === undefined) {
            const f = await loadFromDB(`char_avatar_${char.id}`);
            diaryAvatarCache[char.id] = f ? URL.createObjectURL(f) : '';
        }
    }

    if (exchangeChars.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">档案室空空如也，先去创造角色吧...</div>'; 
        return;
    }

    const frag = document.createDocumentFragment();
    for (let char of exchangeChars) {
        const div = document.createElement('div');
        div.className = 'exchange-char-card';
        div.innerHTML = `
            <div class="ec-avatar" style="${diaryAvatarCache[char.id] ? `background-image:url(${diaryAvatarCache[char.id]})` : ''}"></div>
            <div class="ec-info">
                <div class="ec-name">${char.name}</div>
                <div class="ec-desc">SPIRITUAL BOND</div>
            </div>
            <div class="invite-share-btn" onclick="sendDiaryInvite(event, '${char.id}', '${char.name.replace(/'/g, "\\'")}')" style="position: relative; z-index: 10; padding: 16px; margin-right: -4px; color: var(--accent); display: flex; align-items: center; justify-content: center; transition: 0.2s;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="pointer-events: none;"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </div>
        `;
        // 【核心修改】：这里不再直接进内页，而是打开书架
        div.onclick = async (e) => {
    const agreement = await loadFromDB(`diary_agreement_${char.id}`);
    if (agreement && agreement.agreed) {
        openBookshelf(char);
    } else {
        showToast('TA还没同意交换日记，请先点击右侧按钮发送邀请~');
    }
};
        frag.appendChild(div);
    }
    
    container.innerHTML = '';
    container.appendChild(frag);
}

// === 打开书架的函数 (支持长按改名) ===
async function openBookshelf(char) {
    currentExchangeChar = char;
    document.getElementById('bookshelfTitle').innerText = char.name + " 的书架";
    const shelf = document.getElementById('bookshelfGrid');
    
    // 读取这个角色名下所有的书
    let books = await loadFromDB(`diary_books_${char.id}`) || [];
    // 兼容老数据，如果你之前已经有了一本，把它平滑转移到新架构里
    if (books.length === 0) {
        let oldAg = await loadFromDB(`diary_agreement_${char.id}`);
        if (oldAg && oldAg.agreed) {
            let oldName = await loadFromDB(`diary_book_name_${char.id}`) || '交换日记';
            books.push({ id: 'default', name: oldName, days: oldAg.days || 7, startTime: oldAg.startTime });
            await saveToDB(`diary_books_${char.id}`, books);
        }
    }

    shelf.innerHTML = '';
    const diariesData = await loadFromDB('diary_records') || [];
    let hasActiveBook = false; // 是否还有未写完的活跃书本

    // 循环遍历每一本书进行渲染
    for (let i = 0; i < books.length; i++) {
        let book = books[i];
        // 精准过滤属于这本书的日记（老日记自动归入 default）
        const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === char.id && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
        list.sort((a, b) => b.timestamp - a.timestamp);

        const uniqueDays = new Set(list.map(d => {
            let t = new Date(d.timestamp);
            return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate();
        })).size;
        
        let isUserFinished = uniqueDays >= book.days;
        let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';

        if (!isCompleted) hasActiveBook = true;

        let startD = new Date(book.startTime || Date.now());
        let startStr = `${startD.getFullYear()}.${startD.getMonth()+1}.${startD.getDate()}`;
        let endStr = isCompleted && list.length > 0 ? `${new Date(list[0].timestamp).getFullYear()}.${new Date(list[0].timestamp).getMonth()+1}.${new Date(list[0].timestamp).getDate()}` : '至今';

        let sealBadge = isCompleted ? `<div style="position:absolute; top:12px; right:-24px; background:#D67A7A; color:#fff; font-size:10px; font-weight:bold; padding:2px 24px; transform:rotate(45deg); box-shadow:0 2px 4px rgba(0,0,0,0.15); letter-spacing:2px; z-index:10;">已封存</div>` : '';

        const bookDiv = document.createElement('div');
        bookDiv.className = 'diary-book-cover';
        bookDiv.style.overflow = 'hidden';
        bookDiv.innerHTML = `
            ${sealBadge}
            <div class="db-title-wrapper">
                <div class="db-title" id="bookTitle_${book.id}">${book.name}</div>
            </div>
            <div class="db-sub">LUMINA DIARY</div>
            <div style="font-size:9px; color:var(--text-sub); margin-top:10px; font-weight:bold; font-family:-apple-system, sans-serif; transform:scale(0.9); opacity:0.8;">${startStr} - ${endStr}</div>
        `;

        // 点击书本翻开它
        bookDiv.onclick = async () => {
            window.currentExchangeBook = book; // 全局锁定当前看的是哪本书
            document.getElementById('exchangeDetailName').innerText = book.name;
            document.getElementById('exchangeCheckinBadge').innerText = isCompleted ? `已封存 (${uniqueDays} / ${book.days} 天)` : `已打卡 ${uniqueDays} / ${book.days} 天`;
            document.getElementById('openExchangeWriteBtn').style.display = isUserFinished ? 'none' : 'flex';
            
            await renderExchangeDetailList();
            document.getElementById('exchangeDetailPanel').classList.add('show');
        };

        // 长按改名
        let pressTimer;
        bookDiv.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => { renameDiaryBook(char.id, book.id, book.name); }, 600); }, {passive: true});
        bookDiv.addEventListener('touchend', () => clearTimeout(pressTimer));
        bookDiv.addEventListener('touchmove', () => clearTimeout(pressTimer));
        bookDiv.oncontextmenu = (e) => { e.preventDefault(); renameDiaryBook(char.id, book.id, book.name); };

        shelf.appendChild(bookDiv);
    }

    // 如果该角色的书已经全部封存（没有活跃的书），就添加一个“新建”按钮！
    if (!hasActiveBook && books.length > 0) {
        const addDiv = document.createElement('div');
        addDiv.className = 'diary-book-cover';
        addDiv.style.background = 'transparent';
        addDiv.style.border = '2px dashed rgba(184,156,142,0.4)';
        addDiv.style.boxShadow = 'none';
        addDiv.style.display = 'flex'; addDiv.style.justifyContent = 'center'; addDiv.style.alignItems = 'center';
        addDiv.style.color = 'var(--accent)'; addDiv.style.fontSize = '14px'; addDiv.style.fontWeight = 'bold';
        addDiv.innerHTML = '<div style="text-align:center;"><div style="font-size:24px; margin-bottom:8px;">+</div>新日记本</div>';
        
 addDiv.onclick = () => {
    showBeautifulDialog('建立新羁绊', `旧的打卡已封存，是否要前往聊天室，向 ${char.name} 发送新的日记邀请？\n(当 TA 再次同意后，书架就会生成一本全新空白的日记本哦！)`, 'confirm', '', () => {
        // 1. 关闭日记APP相关面板
        document.getElementById('exchangeBookshelfPanel').classList.remove('show');
        document.getElementById('diaryAppModal').classList.remove('open');
        
        // 2. 强行拉出聊天APP面板，并进入专属聊天室
        document.getElementById('chatAppModal').classList.add('open');
        openChatRoom(char.id, char.name);
        
        // 3. 延迟半秒钟，自动替你弹出发邀请的弹窗连招！
        setTimeout(() => {
            const mockEvent = { stopPropagation: () => {} }; // 伪造一个点击事件防止报错
            sendDiaryInvite(mockEvent, char.id, char.name);
        }, 500);
    });
};
        shelf.appendChild(addDiv);
    }

    document.getElementById('exchangeBookshelfPanel').classList.add('show');

    // 多书本改名引擎
    function renameDiaryBook(charId, bookId, oldName) {
        const cc = document.getElementById('customConfirm');
        cc.querySelector('.cc-title').innerText = "重命名日记本";
        cc.querySelector('.cc-desc').innerText = "为这本日记起一个新的名字：";
        const inputEl = cc.querySelector('.cc-input');
        inputEl.style.display = 'block'; inputEl.value = oldName;
        
        const btnBox = cc.querySelector('.cc-btns');
        const oldHtml = btnBox.innerHTML;
        btnBox.innerHTML = `<button class="cc-btn cancel" id="cancelRenameBtn" style="flex:1;">取消</button><button class="cc-btn primary" id="confirmRenameBtn" style="flex:1;">确定</button>`;
        cc.classList.add('show');
        
        document.getElementById('cancelRenameBtn').onclick = () => { cc.classList.remove('show'); btnBox.innerHTML = oldHtml; inputEl.style.display = 'none'; };
        document.getElementById('confirmRenameBtn').onclick = async () => {
            const newName = inputEl.value.trim();
            if (newName) {
                let savedBooks = await loadFromDB(`diary_books_${charId}`) || [];
                let b = savedBooks.find(b => b.id === bookId);
                if (b) {
                    b.name = newName;
                    await saveToDB(`diary_books_${charId}`, savedBooks);
                    document.getElementById(`bookTitle_${bookId}`).innerText = newName;
                    showToast('日记本已重新命名！');
                    if (window.currentExchangeBook && window.currentExchangeBook.id === bookId) window.currentExchangeBook.name = newName;
                }
            }
            cc.classList.remove('show'); btnBox.innerHTML = oldHtml; inputEl.style.display = 'none';
        };
    }
}

// === 退出逻辑调整 ===
// 1. 退出书架（返回人员列表）
document.getElementById('closeBookshelfBtn').addEventListener('click', () => {
    document.getElementById('exchangeBookshelfPanel').classList.remove('show');
    currentExchangeChar = null; // 彻底退出才清空记录
    loadDiaryData();
});

// 2. 找到原来的 closeExchangeDetailBtn 逻辑，把它覆盖替换为以下代码：
// 在手账内页点“合上日记本”，只退回到书架层
document.getElementById('closeExchangeDetailBtn').addEventListener('click', () => {
    document.getElementById('exchangeDetailPanel').classList.remove('show');
    // 注意这里不清空 currentExchangeChar，因为还要在书架看！
});

async function renderAiDiaryList() {
    const aiDiaries = diariesData.filter(d => d.type === 'ai_diary');
    const container = document.getElementById('aiDiaryListArea');

    if (aiDiaries.length === 0) {
        container.innerHTML = '<div class="diary-poetic-empty"><svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg><div class="diary-poetic-text">TA暂时还没有留下任何回音...</div></div>'; 
        return;
    }

    const frag = document.createDocumentFragment();
    for (let diary of aiDiaries) {
        const div = document.createElement('div');
        div.className = 'ai-diary-card';
        const dObj = new Date(diary.timestamp);
        
        let avatarUrl = diaryAvatarCache[diary.aiId];
        if (avatarUrl === undefined) {
            const file = await loadFromDB(`char_avatar_${diary.aiId}`);
            avatarUrl = file ? URL.createObjectURL(file) : '';
            diaryAvatarCache[diary.aiId] = avatarUrl;
        }

        div.innerHTML = `
            <div class="ai-card-header">
                <div class="ai-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl})` : 'background-color:rgba(184,156,142,0.2)'}"></div>
                <div>
                    <div class="ai-card-name">${diary.aiName}</div>
                    <div class="ai-card-time">${dObj.getMonth()+1}/${dObj.getDate()} ${dObj.getHours()}:${dObj.getMinutes().toString().padStart(2,'0')}</div>
                </div>
            </div>
            <div class="diary-content-preview" style="color: var(--text-main); line-height: 1.7; font-size: 13.5px;">${diary.myContent}</div>
        `;
        // 点击打开阅读面板
        div.onclick = () => openReadPanel(diary);
        frag.appendChild(div);
    }
    
    container.innerHTML = '';
    container.appendChild(frag);
}

async function renderExchangeDetailList() {
    if (!currentExchangeChar || !window.currentExchangeBook) return;
    const book = window.currentExchangeBook;

    // 精准过滤出只属于当前这本书的日记！
    const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === currentExchangeChar.id && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
    list.sort((a,b) => b.timestamp - a.timestamp);

    const uniqueDays = new Set(list.map(d => {
        let t = new Date(d.timestamp);
        return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate();
    })).size;
    
    let isUserFinished = uniqueDays >= book.days;
    let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';
    
    let badge = document.getElementById('exchangeCheckinBadge');
    if (badge) {
        badge.innerText = isCompleted ? `已封存 (${uniqueDays} / ${book.days} 天)` : `已打卡 ${uniqueDays} / ${book.days} 天`;
        if (isCompleted) {
            badge.style.background = '#FFF0F0';
            badge.style.color = '#D67A7A';
        } else {
            badge.style.background = 'rgba(184,156,142,0.15)';
            badge.style.color = 'var(--accent)';
        }
    }
    
    const writeBtn = document.getElementById('openExchangeWriteBtn');
    if (writeBtn) writeBtn.style.display = isUserFinished ? 'none' : 'flex';

    const container = document.getElementById('exchangeDetailList');

    for (let diary of list) {
        if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id] === undefined) {
            const file = await loadFromDB(`diary_img_${diary.id}`);
            diaryAvatarCache['diary_img_'+diary.id] = file ? URL.createObjectURL(file) : '';
        }
    }

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">这是全新的日记本，主动留下一篇吧。</div>'; 
        return;
    }

    // 2. 内存中构建 HTML
    const frag = document.createDocumentFragment();
    for (let diary of list) {
    const div = document.createElement('div');
    div.className = 'organic-card';
    // 赋予卡片更精致的信纸底色和留白
    div.style.padding = '20px 24px';
    div.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(253,251,247,0.85))';
    div.style.border = '1px solid rgba(255,255,255,0.8)';
    
    const dObj = new Date(diary.timestamp);
    
    let imgHtml = '';
    if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id]) {
        imgHtml = `<div style="width:100%; height:130px; border-radius:12px; background:url(${diaryAvatarCache['diary_img_'+diary.id]}) center/cover; margin:16px 0 12px 0; box-shadow:0 4px 12px rgba(0,0,0,0.05);"></div>`;
    }
    
    // 智能判断并构建 TA 的回信区块
    // 智能判断并构建 TA 的回信区块 (透明硫酸纸便签风)
let aiReplyHtml = '';
if (diary.aiContent) {
    aiReplyHtml = `
    <div style="margin-top:16px; padding:16px; background: rgba(255,255,255,0.6); border-radius:16px; border: 1.5px solid rgba(255,255,255,0.9); box-shadow: 0 4px 12px rgba(128,118,110,0.03), inset 0 2px 10px rgba(184,156,142,0.02);">
        <div style="font-size:10px; font-weight:800; color:var(--accent); margin-bottom:8px; letter-spacing:1px; display:flex; align-items:center; gap:6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${diary.aiName}
        </div>
        <div class="diary-content-preview" style="color:var(--text-main); font-size:14px; line-height:1.7;">${diary.aiContent}</div>
    </div>`;
} else {
    // 未回信：柔和的虚线框
    aiReplyHtml = `
    <div style="margin-top:16px; padding:12px 16px; background:transparent; border:1.5px dashed rgba(184,156,142,0.25); border-radius:16px;">
        <div class="diary-content-preview" style="color:var(--text-sub); font-size:11px; font-weight:600; text-align:center; letter-spacing:1px;">🎵 信件还在时空中穿梭...</div>
    </div>`;
}

    div.innerHTML = `
        <!-- 头部：日期与心情同行错落排版 -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div style="display:flex; align-items:baseline; gap:4px;">
                <span style="font-size:28px; font-weight:800; color:var(--text-main); font-family:-apple-system, sans-serif; letter-spacing:-1px; line-height:1;">${dObj.getDate()}</span>
                <span style="font-size:11px; font-weight:700; color:var(--text-sub); text-transform:uppercase;">${dObj.toLocaleString('en-US',{month:'short'})}</span>
            </div>
<div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
    <div style="font-size:11px; color:var(--text-sub); font-weight:600; font-family:monospace;">${dObj.getHours().toString().padStart(2,'0')}:${dObj.getMinutes().toString().padStart(2,'0')}</div>
    <div style="display:flex; gap:6px;">
        <div style="font-size:10px; font-weight:800; color:var(--accent); background:rgba(184,156,142,0.12); padding:3px 8px; border-radius:6px; letter-spacing:1px;">${diary.mood}</div>
        ${diary.aiMood && diary.aiContent ? `<div style="font-size:10px; font-weight:800; color:var(--text-sub); background:rgba(150,143,137,0.12); padding:3px 8px; border-radius:6px; letter-spacing:1px;">TA: ${diary.aiMood}</div>` : ''}
    </div>
</div>
        </div>
        
        ${imgHtml}
        
                <!-- 我的日记正文 -->
        <div class="diary-content-preview" style="color:var(--text-main); font-size:14.5px; line-height:1.8; letter-spacing:0.5px; padding: 0 4px;">${diary.myContent}</div>
        
        <!-- TA的回信模块 -->
        ${aiReplyHtml}
    `;
    div.onclick = () => openReadPanel(diary);
    frag.appendChild(div);
}
    
    // 3. 瞬间替换
    container.innerHTML = '';
    container.appendChild(frag);
}

document.getElementById('closeExchangeDetailBtn').addEventListener('click', () => {
    exchangeDetailPanel.classList.remove('show');
    currentExchangeChar = null;
    loadDiaryData(); 
});

// 写日记与发图逻辑
let currentMood = '平静';
const customMoodInput = document.getElementById('customMoodInput');

document.querySelectorAll('.mood-chip').forEach(chip => {
    if(chip.id === 'customMoodInput' || chip.classList.contains('habit-chip')) return; // 跳过输入框和防健忘打卡
    chip.addEventListener('click', () => {
        document.querySelectorAll('.mood-chip:not(.habit-chip)').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentMood = chip.dataset.mood;
        customMoodInput.value = ''; // 点击自带心情时，清空自定义输入框
    });
});

customMoodInput.addEventListener('input', (e) => {
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
    customMoodInput.classList.add('active');
    currentMood = e.target.value.trim() || '神秘心情';
});
customMoodInput.addEventListener('click', (e) => {
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
    customMoodInput.classList.add('active');
    currentMood = e.target.value.trim() || '神秘心情';
});

let currentReplyTimeType = 'now';
document.querySelectorAll('#replyTimeSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#replyTimeSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentReplyTimeType = btn.dataset.time;
    });
});

document.getElementById('diaryImgUploadBtn').addEventListener('click', () => document.getElementById('diaryImgInput').click());
document.getElementById('diaryImgInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        tempDiaryImgFile = file;
        document.getElementById('diaryImgPreview').style.backgroundImage = `url(${URL.createObjectURL(file)})`;
        document.getElementById('diaryImgPreview').style.display = 'block';
        document.getElementById('diaryImgUploadBtn').style.display = 'none';
    }
});
document.getElementById('diaryImgDelBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    tempDiaryImgFile = null;
    document.getElementById('diaryImgInput').value = '';
    document.getElementById('diaryImgPreview').style.display = 'none';
    document.getElementById('diaryImgUploadBtn').style.display = 'flex';
});

function resetWritePanel() {
    document.getElementById('diaryInputContent').value = '';
    tempDiaryImgFile = null;
    document.getElementById('diaryImgInput').value = '';
    document.getElementById('diaryImgPreview').style.display = 'none';
    document.getElementById('diaryImgUploadBtn').style.display = 'flex';
    // 清空打卡按钮的选中状态
    document.querySelectorAll('.habit-chip').forEach(c => c.classList.remove('active'));
}

// 绑定打卡按钮的点击切换事件
document.querySelectorAll('.habit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chip.classList.toggle('active'); // 点一下选中，再点一下取消
    });
});

document.getElementById('openWriteDiaryBtn').addEventListener('click', () => {
    resetWritePanel();
    document.getElementById('exchangeSettingsArea').style.display = 'none';
    document.getElementById('openWriteDiaryBtn').style.display = 'none';
    diaryWritePanel.classList.add('show');
});

document.getElementById('openExchangeWriteBtn').addEventListener('click', () => {
    resetWritePanel();
    document.getElementById('exchangeSettingsArea').style.display = 'block';
    diaryWritePanel.classList.add('show');
});

document.getElementById('cancelDiaryBtn').addEventListener('click', () => {
    diaryWritePanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
});

// === 图片转 Base64 辅助函数（用于 AI 识图） ===
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// === 全局日记折叠控制函数 ===
window.toggleDiaryExpand = function(wrapperId, btn) {
    const wrapper = document.getElementById(wrapperId);
    if (wrapper.classList.contains('collapsed')) {
        wrapper.classList.remove('collapsed');
        wrapper.classList.add('expanded');
        btn.innerText = '收起 ∧';
    } else {
        wrapper.classList.remove('expanded');
        wrapper.classList.add('collapsed');
        btn.innerText = '展开阅读 ∨';
    }
};

document.getElementById('saveDiaryBtn').addEventListener('click', async function() {
    const content = document.getElementById('diaryInputContent').value.trim();
    if (!content && !tempDiaryImgFile) { showToast('写点字或者配张图吧~'); return; }

    // 获取选中的打卡项
    const selectedHabits = Array.from(document.querySelectorAll('.habit-chip.active')).map(c => c.dataset.habit);

    const newDiary = {
        id: 'diary_' + Date.now(), timestamp: Date.now(), mood: currentMood, myContent: content, hasImage: !!tempDiaryImgFile, habits: selectedHabits
    };

    if (tempDiaryImgFile) await saveToDB(`diary_img_${newDiary.id}`, tempDiaryImgFile);

    if (diaryCurrentTab === 'private') {
    newDiary.type = 'private';
    diariesData.unshift(newDiary);
    await saveToDB('diary_records', diariesData);
    diaryWritePanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
    renderPrivateDiaryList();

    } else {
        // === 交换模式：后台投递 + AI 识图支持 ===
        newDiary.type = 'exchange';
newDiary.aiId = currentExchangeChar.id;
newDiary.aiName = currentExchangeChar.name; 
newDiary.bookId = window.currentExchangeBook ? window.currentExchangeBook.id : 'default'; // ★ 关键：印上日记本的专属ID

const now = Date.now();
        if (currentReplyTimeType === 'now') { newDiary.replyTime = now; }
        else if (currentReplyTimeType === 'random') { newDiary.replyTime = now + (Math.floor(Math.random() * 48) + 2) * 3600000; } 

        const useSubApi = await loadFromDB('diaryUseSubApi') || false;
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

        if (!apiKey) { 
            showToast('未配置API，日记仅保存在本地'); 
            diariesData.unshift(newDiary); await saveToDB('diary_records', diariesData);
            diaryWritePanel.classList.remove('show'); renderExchangeDetailList();
            return; 
        }

        // 1. 【核心体验优化】立刻关闭弹窗！存入“待回信”状态
newDiary.pendingReplyText = ''; 
newDiary.aiContent = '';
diariesData.unshift(newDiary);
await saveToDB('diary_records', diariesData);

// 先等底层列表重新渲染完毕（读取数据库图片），再降下写日记的面板，彻底消灭闪烁！
await renderExchangeDetailList();
diaryWritePanel.classList.remove('show');
document.getElementById('openWriteDiaryBtn').style.display = 'flex';


        // 2. 剥离到后台默默执行的 AI 请求
        (async function backgroundSendTask() {
            let timeInstruction = currentReplyTimeType === 'aidecide' ? `\n【重要指令】：请在回复最后另起一行加 [DELAY:小时数] 决定回信送达所需的时间。如 [DELAY:12] 代表12小时后。` : '';

                        // --- 新增：算出这是打卡第几天 ---
            const book = window.currentExchangeBook;
            const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === currentExchangeChar.id && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
            const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
            // -----------------------------

            const sysPrompt = `你扮演：${currentExchangeChar.name}。详细设定：${currentExchangeChar.prompt}
【任务】：用户正在和你“交换日记”。当前是你们这本日记打卡的第 ${uniqueDays} 天（共约定 ${book ? book.days : 7} 天）。你需要以日记的口吻，回写一篇你的日记来作为交换。

【内容要求】：
1. 用户的今天心情是【${currentMood}】。
2. 随意发散，分享一件符合你角色设定和时代背景的日常小事、一个念头或一点碎碎念，想写什么都可以，随意发挥。
3. 必须遵守你的人物性格特征、身份。思考你应该如何回应？想记录什么？避免陷入性格的刻板印象。
4. 【新增强制要求】：请在日记正文的开头，用 [心情:你的心情] 标出你写这篇日记时的心情，例如 [心情:心安] 或 [心情:有些疲惫]。

【文风要求 - 极简白描】（最高优先级）：
1. 必须使用“白描”手法，文字平实、自然、克制。
2. 绝对不要浮夸、不要矫情、不要故意伤春悲秋或过度抒情。
3. 严禁堆砌华丽辞藻，不要乱用莫名其妙的比喻、成语。
4. 就像真实生活中的人在平静地记录，不要有任何“演戏”或“写作文”的痕迹。
5. 绝对不要写聊天对白，不要写信件开头（如“亲爱的xx”），只输出日记正文段落。${timeInstruction}`;

            // 构造支持识图的复杂载荷
            let userMessagesContent = [{ type: "text", text: `这是我今天的日记：\n"${content}"\n请写下你的日记与我交换吧。` }];
            
            if (tempDiaryImgFile) {
                try {
                    const base64Img = await fileToBase64(tempDiaryImgFile);
                    userMessagesContent.push({
                        type: "image_url",
                        image_url: { url: base64Img }
                    });
                } catch(e) { console.error("图片转换失败"); }
            }

            try {
                const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                    method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                    body:JSON.stringify({ 
                        model, 
                        messages:[
                            {role:"system", content: sysPrompt},
                            {role:"user", content: userMessagesContent}
                        ], 
                        temperature: 0.8 
                    })
                });
const data = await res.json();
let aiText = data.choices[0].message.content.trim();

// --- 解析 AI 的心情 ---
let aiMood = '';
const moodMatch = aiText.match(/\[心情:(.*?)\]/i);
if (moodMatch) {
    aiMood = moodMatch[1].trim();
    aiText = aiText.replace(/\[心情:.*?\]/i, '').trim(); // 把标签从正文里剥离出来
}

if (currentReplyTimeType === 'aidecide') {
                    const match = aiText.match(/\[DELAY:(\d+)\]/i);
                    let delayHours = 24;
                    if (match) { delayHours = parseInt(match[1]); aiText = aiText.replace(/\[DELAY:\d+\]/ig, '').trim(); }
                    newDiary.replyTime = Date.now() + delayHours * 3600000;
                }

                // 更新数据库
                const latestDiaries = await loadFromDB('diary_records');
                const targetDiary = latestDiaries.find(d => d.id === newDiary.id);
               if (targetDiary) {
    targetDiary.aiMood = aiMood; // 存下TA的心情
    if (currentReplyTimeType === 'now') { targetDiary.aiContent = aiText; } 
                    else { targetDiary.pendingReplyText = aiText; targetDiary.aiContent = ''; }
                    await saveToDB('diary_records', latestDiaries);
                    diariesData = latestDiaries; 
                    
                    if (currentReplyTimeType === 'now') {
                        showToast(`叮咚！${currentExchangeChar.name} 给你回写了日记！`);
                        if (exchangeDetailPanel.classList.contains('show')) renderExchangeDetailList();
                    }
                }
            } catch(e) {
                showToast(`投递给 ${currentExchangeChar.name} 的信件丢失了：` + e.message);
            }
        })();
    }
});

async function openReadPanel(diary) {
    currentReadDiaryId = diary.id;
    const dObj = new Date(diary.timestamp);
    document.getElementById('readDiaryDateObj').innerHTML = `<span class="o-day">${dObj.getDate()}</span><span class="o-month">/${dObj.getMonth()+1}</span>`;
    document.getElementById('readDiaryTime').innerText = `${dObj.getHours()}:${dObj.getMinutes().toString().padStart(2,'0')}`;
    // 动态生成双心情标签
let moodHtml = `<div class="diary-mood-badge" style="display:inline-block; margin-right:8px;">${diary.mood}</div>`;
if (diary.type === 'exchange' && diary.aiContent && diary.aiMood) {
    moodHtml += `<div class="diary-mood-badge" style="display:inline-block; background:rgba(150,143,137,0.1); color:var(--text-sub);">TA: ${diary.aiMood}</div>`;
}
// 替换掉原来的外壳，防止 ID 冲突
const oldMoodEl = document.getElementById('readDiaryMood');
if (oldMoodEl) {
    const newWrapper = document.createElement('div');
    newWrapper.id = 'readDiaryMoodContainer';
    newWrapper.innerHTML = moodHtml;
    oldMoodEl.parentNode.replaceChild(newWrapper, oldMoodEl);
} else {
    document.getElementById('readDiaryMoodContainer').innerHTML = moodHtml;
}
    const imgEl = document.getElementById('readDiaryImg');
    if (diary.hasImage) {
        const file = await loadFromDB(`diary_img_${diary.id}`);
        if (file) { imgEl.src = URL.createObjectURL(file); imgEl.style.display = 'block'; }
        else { imgEl.style.display = 'none'; }
    } else { imgEl.style.display = 'none'; }

// === 核心修复：把日记正文填入屏幕，并动态修改标题 ===
document.getElementById('readDiaryMyContent').innerText = diary.myContent || '';
const myLabelEl = document.getElementById('readDiaryMyContent').parentElement.previousElementSibling;
if (diary.type === 'ai_diary') {
    if(myLabelEl) myLabelEl.innerText = (diary.aiName || 'TA') + " 的悄悄话";
} else {
    if(myLabelEl) myLabelEl.innerText = "我的落笔";
}

    
    if (diary.type === 'exchange') {
        document.getElementById('readDiaryAiReplyArea').style.display = 'block';
        document.getElementById('readDiaryAiName').innerText = `${diary.aiName} 的日记`;
        document.getElementById('readDiaryAiContent').innerText = diary.aiContent ? diary.aiContent : '🎵 TA 的回信还在时空中穿梭，未到送达时间...';
    } else {
        document.getElementById('readDiaryAiReplyArea').style.display = 'none';
    }
    
    document.getElementById('openWriteDiaryBtn').style.display = 'none';
    diaryReadPanel.classList.add('show');
}
document.getElementById('closeReadDiaryBtn').addEventListener('click', () => {
    diaryReadPanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
});

document.getElementById('deleteDiaryBtn').addEventListener('click', () => {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = '销毁日记';
    cc.querySelector('.cc-desc').innerText = '这页日记将被彻底粉碎，且相片也会被删除。';
    cc.classList.add('show');
    document.getElementById('ccConfirm').onclick = async () => {
    cc.classList.remove('show');
    const db = await initDB();
    const tx = db.transaction('allDataStore', 'readwrite');
    tx.objectStore('allDataStore').delete(`diary_img_${currentReadDiaryId}`);
    
    diariesData = diariesData.filter(d => d.id !== currentReadDiaryId);
    await saveToDB('diary_records', diariesData);
    diaryReadPanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
    if (diaryCurrentTab === 'private') renderPrivateDiaryList();
    else renderExchangeDetailList();
    showToast('日记已销毁。');
};
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
});

// === 日记 APP 设置与统计面板逻辑 ===
// === 日记 APP 设置与统计面板逻辑 ===
document.getElementById('openDiarySettingsBtn').addEventListener('click', async () => {
    const modal = document.getElementById('diarySettingsModal');
    // 【杀手锏】先隐藏开关，剥夺动画权利
    const switches = modal.querySelectorAll('.switch');
    switches.forEach(s => s.style.display = 'none');

    // 1. 读取开关状态
    const isSub = await loadFromDB('diaryUseSubApi') || false;
    document.getElementById('diaryApiToggle').checked = isSub;
    const isAiAuto = await loadFromDB('diaryAiAutoToggle') || false;
    document.getElementById('diaryAiAutoToggle').checked = isAiAuto;

    // 2. 计算统计数据
    const allDiaries = await loadFromDB('diary_records') || [];
    const privateCount = allDiaries.filter(d => d.type === 'private').length;
    document.getElementById('statPrivateTotal').innerText = `私人: ${privateCount} 篇`;

    const chars = await loadFromDB('ai_characters') || [];
    const exchangeDiaries = allDiaries.filter(d => d.type === 'exchange');
    const statsList = document.getElementById('diaryStatsList');
    
    let charStatsHtml = '';
    chars.forEach(char => {
        if(char.roleType === 'char') {
            const count = exchangeDiaries.filter(d => d.aiId === char.id).length;
            if(count > 0) {
                charStatsHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-sub); border-bottom: 1px dashed rgba(184,156,142,0.15); padding-bottom: 8px;">
                    <span style="font-weight: 700; color: var(--text-main);">${char.name}</span>
                    <span style="background: rgba(184,156,142,0.1); padding: 4px 10px; border-radius: 8px; color: var(--accent); font-weight: 600;">共交换 ${count} 篇</span>
                </div>`;
            }
        }
    });
    
    if(charStatsHtml === '') {
        statsList.innerHTML = '<div style="text-align:center; font-size:12px; color:var(--text-sub); margin-top:10px;">还没有与任何人交换过日记。</div>';
    } else {
        statsList.innerHTML = charStatsHtml;
    }

    // 强制浏览器刷新一次隐藏状态，然后瞬间恢复显示！
    modal.offsetHeight; 
    switches.forEach(s => s.style.display = '');

    // 3. 打开面板
    modal.classList.add('show');
});

// 保存并关闭设置面板
document.getElementById('closeDiarySettingsBtn').addEventListener('click', async () => {
    await saveToDB('diaryUseSubApi', document.getElementById('diaryApiToggle').checked);
        await saveToDB('diaryAiAutoToggle', document.getElementById('diaryAiAutoToggle').checked);
    document.getElementById('diarySettingsModal').classList.remove('show');
});

// === 让 TA 偷偷写日记的后台随机触发逻辑 ===
async function triggerAiAutoDiary() {
// === 拦截器：后台耗钱总开关 ===
const isGlobalAutoDiaryEnabled = await loadFromDB('globalAutoDiary') !== false;
if (!isGlobalAutoDiaryEnabled) return; // 开关关了，直接退出不花钱

    // 1. 检查开关有没有打开
    const isAiAuto = await loadFromDB('diaryAiAutoToggle') || false;
    if (!isAiAuto) return; 

    // 【新增控制：每天限额】检查今天是否已经写过了！
    const todayStr = new Date().toLocaleDateString();
    const lastAiDiaryDate = await loadFromDB('lastAiDiaryDate');
    if (lastAiDiaryDate === todayStr) return; // 今天写过啦，直接退出！

// 2. 提高到 35% 的概率触发
    if (Math.random() > 0.35) return;

    // 3. 随机抽取一个允许自己写日记的角色
    const chars = await loadFromDB('ai_characters') || [];
    const aiChars = chars.filter(c => c.roleType === 'char' && c.allowAutoDiary !== false);
    if (aiChars.length === 0) return;
    const randomChar = aiChars[Math.floor(Math.random() * aiChars.length)];

    const useSubApi = await loadFromDB('diaryUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) return;

    // --- 新增：获取当前具体时间，让 AI 感知 ---
    const now = new Date();
    const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    let timeContext = '';
    if(now.getHours() >= 0 && now.getHours() < 6) timeContext = '深夜/凌晨';
    else if(now.getHours() < 12) timeContext = '上午';
    else if(now.getHours() < 18) timeContext = '下午';
    else timeContext = '晚上';
    // ----------------------------------------

    // ！！！核心提示词在这里 ！！！
    const sysPrompt = `你扮演：${randomChar.name}。你的详细设定：${randomChar.prompt}。
【核心任务】：请严格遵守你的身份性格和所处的时代背景，写下一篇你个人的私密日记。
【当前现实时间】：${timeStr} (${timeContext})。请务必让你的日记内容符合这个时间点该有的状态（比如深夜没睡、清晨刚醒、午休、下午摸鱼、傍晚等）。

【内容要求 - 极度自由发散】：
思维发散，随意发挥。你可以写一件微不足道的小事、脑海中一闪而过的念头、观察到的一个细节、对某人的吐槽，或者就是单纯的无聊碎碎念。不需要有头有尾，没有任何限制，你爱怎么写怎么写。

【文风要求 - 极简白描】（最高优先级强制指令）：
1. 必须使用“白描”手法，文字平实、自然、克制。
2. 绝对不要浮夸、不要矫情、不要故意伤春悲秋。
3. 严禁堆砌华丽辞藻，不要乱用莫名其妙的比喻、成语或四字词语。
4. 就像一个真实存在的人在平静地记录生活，不要有任何“演戏”或“写作文”的痕迹。

直接输出日记正文，不要写“亲爱的日记”之类的开头，不要自己加日期，绝对不要出戏。`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method:'POST', 
            headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
            body:JSON.stringify({ 
                model, 
                messages:[{role:"system", content: sysPrompt}], 
                temperature: 0.9 // 温度调高，让思维更发散
            })
        });
        
        const data = await res.json();
        const aiContent = data.choices[0].message.content.trim();

        // 存入数据库
        let diariesData = await loadFromDB('diary_records') || [];
        
        // --- 新增：检查有没有正在进行的交换日记本 ---
        let books = await loadFromDB(`diary_books_${randomChar.id}`) || [];
        let activeBook = null;
        for (let b of books) {
            const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === randomChar.id && (d.bookId === b.id || (!d.bookId && b.id === 'default')));
            const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
            if (uniqueDays < b.days) { activeBook = b; break; } // 找到一本还没写完的！
        }

        // 如果有没写完的日记本，就有一半的概率主动写在交换日记里，一半概率写在私密悄悄话里
        if (activeBook && Math.random() > 0.5) {
            diariesData.unshift({
                id: 'exchange_' + Date.now(),
                timestamp: Date.now(),
                type: 'exchange',
                aiId: randomChar.id,
                aiName: randomChar.name,
                bookId: activeBook.id,
                myContent: "【TA 主动打卡了这天的交换日记，快去写下你的回应吧...】",
                aiContent: aiContent, // AI 的日记放在回信区
                mood: '期待',
                aiMood: '主动分享'
            });
            if (typeof showToast === 'function') showToast(`叮咚！${randomChar.name} 主动写下了一篇交换日记！`);
        } else {
            // 原来的写进“回音/悄悄话”的逻辑
            diariesData.unshift({
                id: 'ai_diary_' + Date.now(),
                timestamp: Date.now(),
                type: 'ai_diary',
                aiId: randomChar.id,
                aiName: randomChar.name,
                myContent: aiContent, 
                mood: 'TA的日常'
            });
        }
        await saveToDB('diary_records', diariesData);

        // 【最最最关键的一步】写完了，把今天的日期盖个章存下来！
        await saveToDB('lastAiDiaryDate', todayStr);

        // 如果用户正好停留在“TA的日记”界面，悄悄刷新一下
        if (document.getElementById('aiDiaryView') && document.getElementById('aiDiaryView').style.display === 'block') {
            if(typeof renderAiDiaryList === 'function') renderAiDiaryList(); 
        }
        
    } catch(e) {
        console.log("后台自动写日记失败: ", e);
    }
}

// 每次打开或者刷新这个网页时，偷偷在后台抛一次骰子
window.addEventListener('load', () => {
    // 延迟 8 秒再偷偷执行，给系统足够的时间处理开屏动画，完全不卡顿
    setTimeout(triggerAiAutoDiary, 8000); 
    setTimeout(triggerRandomWrongMail, 12000); 
});

// ==========================================
// 阅读共读 APP 核心逻辑 (多模式翻页 + 记忆联动)
// ==========================================
const readingModal = document.getElementById('readingAppModal');
let bookFullText = ''; 
let bookPages = [];
let currentReadPage = 0;
let bookTitle = '无名氏';
let readSelectedText = '';
let currentReadCompanionId = 'system';

// 多本书架新增的核心变量
let readBooksList = []; 
let currentReadBookId = null;

// 获取 DOM 元素
const readTextContainer = document.getElementById('readTextContainer');
const readPageText = document.getElementById('readPageText');
const readControlsBar = document.getElementById('readControlsBar');

// 内部设置变量
let rFontSize = 17;
let rMode = 'page'; 
let rUseSubApi = false;
let rReadContext = false;
let rContextCount = 10;
let rCustomCss = '';
function applyReadCss(cssText) {
    let styleTag = document.getElementById('dynamicReadCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicReadCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssText || '';
}

// 切页算法
function splitBookText() {
    bookPages = [];
    const paragraphs = bookFullText.split('\n').filter(p => p.trim() !== '');
    let currentPageText = '';
    
    let dynamicLimit = Math.floor(260 * Math.pow(17 / rFontSize, 2));
    const limit = rMode === 'scroll' ? 4000 : dynamicLimit; 
    
    paragraphs.forEach(p => {
        currentPageText += `<p style="margin:0 0 16px 0;">${p}</p>`;
        if (currentPageText.length > limit) {
            bookPages.push(currentPageText);
            currentPageText = '';
        }
    });
    if (currentPageText) bookPages.push(currentPageText);
    
    if (currentReadPage >= bookPages.length) currentReadPage = Math.max(0, bookPages.length - 1);
}

// 渲染书页
function renderReadPage() {
    if (bookPages.length === 0) return;
    document.getElementById('readShelfState').style.display = 'none';
    document.getElementById('readContentState').style.display = 'flex';
    document.getElementById('openReadSettingsBtn').style.display = 'block'; 
    document.getElementById('backToReadShelfBtn').style.display = 'block'; 
    
    readPageText.innerHTML = bookPages[currentReadPage];
    document.getElementById('readPageIndicator').innerText = `${currentReadPage + 1} / ${bookPages.length}`;
    readTextContainer.scrollTop = 0;
    
    readTextContainer.style.fontSize = rFontSize + 'px';
    if (rMode === 'scroll') {
        readTextContainer.style.overflowY = 'auto'; 
        readControlsBar.style.display = 'flex'; 
        readPageText.style.minHeight = 'auto';
    } else {
        readTextContainer.style.overflowY = 'hidden'; 
        readTextContainer.scrollTop = 0; 
        readControlsBar.style.display = 'flex';
        readPageText.style.minHeight = '65vh';
    }
}

let isShelfManageMode = false;
let shelfSelectedBooks = [];

// 渲染书架
async function renderReadShelf() {
    readBooksList = await loadFromDB('read_books_list') || [];
    
    // 兼容你旧版单独保存的那本书，平滑迁移过来
    const oldCachedBook = await loadFromDB('cached_reading_book');
    if (oldCachedBook && oldCachedBook.fullText) {
        const newId = 'book_' + Date.now();
        readBooksList.push({ id: newId, title: oldCachedBook.title || '上次阅读', currentPage: oldCachedBook.currentPage || 0 });
        await saveToDB(`read_book_text_${newId}`, oldCachedBook.fullText);
        await saveToDB('read_books_list', readBooksList);
        await saveToDB('cached_reading_book', null); 
    }

    document.getElementById('readContentState').style.display = 'none';
    document.getElementById('readShelfState').style.display = 'flex';
    document.getElementById('backToReadShelfBtn').style.display = 'none';
    document.getElementById('openReadSettingsBtn').style.display = 'none';
    document.getElementById('readingBookTitle').innerText = '书架';

    const grid = document.getElementById('readShelfGrid');
    const empty = document.getElementById('readShelfEmpty');
    grid.innerHTML = '';
    
    if (readBooksList.length === 0) {
        empty.style.display = 'flex';
        grid.style.display = 'none';
        document.getElementById('shelfManageBtn').style.display = 'none'; // 没书时隐藏编辑按钮
        return;
    }
    
    empty.style.display = 'none';
    grid.style.display = 'flex';
    document.getElementById('shelfManageBtn').style.display = 'block';
    
    readBooksList.forEach(book => {
        const div = document.createElement('div');
        div.className = 'diary-book-cover';
        div.style.marginBottom = '16px';
        div.style.transition = '0.2s';
        
        let isSelected = shelfSelectedBooks.includes(book.id);
        
        div.innerHTML = `
            <div class="shelf-check" style="position:absolute; top:8px; left:8px; width:22px; height:22px; border-radius:50%; border:2px solid ${isSelected ? 'var(--accent)' : 'rgba(184,156,142,0.4)'}; background:${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.8)'}; display:${isShelfManageMode ? 'flex' : 'none'}; justify-content:center; align-items:center; z-index:10; transition:0.2s;">
                <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:#fff; fill:none; stroke-width:3.5; stroke-linecap:round; opacity:${isSelected ? '1' : '0'}; transform:scale(${isSelected ? '1' : '0.5'}); transition:0.2s;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="db-title-wrapper" style="flex:1; display:flex; align-items:center; justify-content:center; border-top: 1px dashed rgba(184,156,142,0.4); border-bottom: 1px dashed rgba(184,156,142,0.4); margin:8px 0; padding:10px 4px;">
                <div class="db-title" style="font-size:14px; font-weight:800; color:var(--text-main); font-family:serif; text-align:center;">${book.title}</div>
            </div>
            <div style="font-size:10px; color:var(--text-sub); margin-top:4px; font-weight:bold;">第 ${book.currentPage + 1} 页</div>
        `;
        
        // 如果被选中了，让书本缩小一点，边框高亮，更有苹果多选的感觉
        if (isSelected) {
            div.style.transform = 'scale(0.95)';
            div.style.borderColor = 'var(--accent)';
            div.style.boxShadow = '0 0 0 2px var(--accent), 0 8px 20px rgba(184,156,142,0.2)';
        }
        
        div.onclick = async () => {
            if (isShelfManageMode) {
                // 编辑模式下的点击是选中/取消选中
                if (shelfSelectedBooks.includes(book.id)) {
                    shelfSelectedBooks = shelfSelectedBooks.filter(id => id !== book.id);
                } else {
                    shelfSelectedBooks.push(book.id);
                }
                renderReadShelf(); // 触发 UI 更新
                updateShelfMultiBar();
            } else {
                // 正常模式点击则是看书
                openBookFromShelf(book);
            }
        };
        
        // 长按直接进入编辑模式并选中这本书
        let pressTimer;
        div.addEventListener('touchstart', (e) => { 
            if (!isShelfManageMode) {
                pressTimer = setTimeout(() => { 
                    isShelfManageMode = true;
                    shelfSelectedBooks = [book.id];
                    toggleShelfManageUI(true);
                    renderReadShelf();
                    updateShelfMultiBar();
                }, 500); 
            }
        }, {passive:true});
        div.addEventListener('touchend', () => clearTimeout(pressTimer));
        div.addEventListener('touchmove', () => clearTimeout(pressTimer));
        
        grid.appendChild(div);
    });
}

function updateShelfMultiBar() {
    document.getElementById('shelfDeleteBtn').innerText = `删除 (${shelfSelectedBooks.length})`;
}

function toggleShelfManageUI(show) {
    if (show) {
        document.getElementById('shelfTopBtns').style.display = 'none';
        document.getElementById('shelfMultiBar').style.display = 'flex';
    } else {
        document.getElementById('shelfTopBtns').style.display = 'flex';
        document.getElementById('shelfMultiBar').style.display = 'none';
    }
}

// === 编辑按钮事件 ===
document.getElementById('shelfManageBtn').addEventListener('click', () => {
    isShelfManageMode = true;
    shelfSelectedBooks = [];
    toggleShelfManageUI(true);
    renderReadShelf();
    updateShelfMultiBar();
});

// === 取消编辑事件 ===
document.getElementById('shelfCancelManage').addEventListener('click', () => {
    isShelfManageMode = false;
    shelfSelectedBooks = [];
    toggleShelfManageUI(false);
    renderReadShelf();
});

// === 全选事件 ===
document.getElementById('shelfSelectAll').addEventListener('click', () => {
    if (shelfSelectedBooks.length === readBooksList.length) {
        shelfSelectedBooks = []; // 如果已经全选，就全取消
    } else {
        shelfSelectedBooks = readBooksList.map(b => b.id); // 全选
    }
    renderReadShelf();
    updateShelfMultiBar();
});

// === 确认删除事件 (调用绝美的全局确认弹窗) ===
document.getElementById('shelfDeleteBtn').addEventListener('click', () => {
    if (shelfSelectedBooks.length === 0) return;
    
    showBeautifulDialog('清理书架', `确定要将选中的 ${shelfSelectedBooks.length} 本书彻底从书架移除吗？`, 'confirm', '', async () => {
        // 删数据库里的书籍文字实体
        const db = await initDB();
        const tx = db.transaction('allDataStore', 'readwrite');
        shelfSelectedBooks.forEach(id => {
            tx.objectStore('allDataStore').delete(`read_book_text_${id}`);
        });
        
        // 从书架列表删掉
        readBooksList = readBooksList.filter(b => !shelfSelectedBooks.includes(b.id));
        await saveToDB('read_books_list', readBooksList);
        
        isShelfManageMode = false;
        shelfSelectedBooks = [];
        toggleShelfManageUI(false);
        renderReadShelf();
        showToast('已完成清理！');
    });
});

// 打开书架上的书
async function openBookFromShelf(book) {
    currentReadBookId = book.id;
    bookTitle = book.title;
    currentReadPage = book.currentPage || 0;
    document.getElementById('readingBookTitle').innerText = bookTitle;
    
    // 打开时提示加载，防止大文件白屏卡顿
    showToast('正在翻开书页...');
    setTimeout(async () => {
        bookFullText = await loadFromDB(`read_book_text_${book.id}`) || '空空如也...';
        splitBookText();
        renderReadPage();
    }, 100);
}

// 绑定打开APP按钮
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('阅读')) {
        app.addEventListener('click', async () => {
            const rSettings = await loadFromDB('read_settings') || {};
            rFontSize = rSettings.fontSize || 17;
            rMode = rSettings.mode || 'page';
            rUseSubApi = rSettings.useSubApi || false;
            rReadContext = rSettings.readContext || false;
            rContextCount = rSettings.contextCount || 10;
            rCustomCss = rSettings.customCss || '';
            applyReadCss(rCustomCss);
            
            readingModal.classList.add('open');
            await renderReadShelf();
        });
    }
});

// 保存进度并退出阅读
document.getElementById('closeReadingApp').addEventListener('click', async () => {
    readingModal.classList.remove('open');
    if (currentReadBookId) {
        let book = readBooksList.find(b => b.id === currentReadBookId);
        if (book) {
            book.currentPage = currentReadPage;
            await saveToDB('read_books_list', readBooksList);
        }
    }
    // 关闭时退出管理模式
    isShelfManageMode = false;
    toggleShelfManageUI(false);
});

// 返回书架按钮
document.getElementById('backToReadShelfBtn').addEventListener('click', async () => {
    if (currentReadBookId) {
        let book = readBooksList.find(b => b.id === currentReadBookId);
        if (book) {
            book.currentPage = currentReadPage;
            await saveToDB('read_books_list', readBooksList);
        }
    }
    renderReadShelf();
});

// 导入TXT
document.getElementById('shelfUploadBtn').addEventListener('click', () => document.getElementById('txtFileInput').click());
document.getElementById('txtFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newTitle = file.name.replace('.txt', '');
    
    // 退出编辑模式
    isShelfManageMode = false;
    toggleShelfManageUI(false);
    
    showToast('正在解析书籍排版...');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target.result;
        const newId = 'book_' + Date.now();
        
        readBooksList.unshift({ id: newId, title: newTitle, currentPage: 0 }); // 新书放在最前面
        await saveToDB('read_books_list', readBooksList);
        await saveToDB(`read_book_text_${newId}`, text);
        
        showToast('《' + newTitle + '》已上架！');
        renderReadShelf();
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ==== 智能触控翻页 & 铅笔段落选取 ====
const doPrevPage = () => {
    if (currentReadPage > 0) { currentReadPage--; renderReadPage(); bindReadControls(); }
    else { showToast('已经是第一页啦'); }
};
const doNextPage = () => {
    if (currentReadPage < bookPages.length - 1) { currentReadPage++; renderReadPage(); bindReadControls(); }
    else { showToast('已经读完最后一页了！'); }
};

// 初始绑定底部栏按钮
bindReadControls();

let isPencilMode = false;
let selectedParagraphs = [];
let readChatHistoryForAi = [];

// 铅笔点击事件
document.getElementById('readPencilBtn').addEventListener('click', function() {
    isPencilMode = !isPencilMode;
    if (isPencilMode) {
        this.style.color = 'var(--accent)';
        this.style.background = 'rgba(184,156,142,0.15)';
        this.style.borderRadius = '8px';
        document.body.classList.add('reading-select-mode');
        selectedParagraphs = [];
        showToast('已开启画笔，点击你想分享的段落吧 (可多选)');
    } else {
        this.style.color = 'var(--text-main)';
        this.style.background = 'transparent';
        document.body.classList.remove('reading-select-mode');
        document.querySelectorAll('#readPageText p.selected').forEach(p => p.classList.remove('selected'));
        readControlsBarEl.innerHTML = originalControlsHtml;
        bindReadControls();
    }
});

// 直接给文字容器绑定点击，智能判断你要干嘛
document.getElementById('readTextContainer').addEventListener('click', (e) => {
    if (isPencilMode) {
        let pTag = e.target.closest('p');
        if (pTag) {
            pTag.classList.toggle('selected');
            if (pTag.classList.contains('selected')) {
                selectedParagraphs.push(pTag.innerText);
            } else {
                selectedParagraphs = selectedParagraphs.filter(t => t !== pTag.innerText);
            }
            
            if (selectedParagraphs.length > 0) {
                readControlsBarEl.innerHTML = `
                    <button class="s-btn" id="cancelPencilBtn" style="flex:1; border-radius: 12px; height: 44px; min-height: 44px; margin: 0;">取消</button>
                    <button class="s-btn primary" id="quickAskSentenceBtn" style="flex:2; border-radius: 12px; height: 44px; min-height: 44px; margin: 0 0 0 10px;">发送选中的 ${selectedParagraphs.length} 段</button>
                `;
                document.getElementById('cancelPencilBtn').onclick = () => {
                    selectedParagraphs = [];
                    document.querySelectorAll('#readPageText p.selected').forEach(p => p.classList.remove('selected'));
                    readControlsBarEl.innerHTML = originalControlsHtml;
                    bindReadControls();
                };
                document.getElementById('quickAskSentenceBtn').onclick = () => {
    // 强制按书本原有的上下排列顺序获取段落，无视手指点击的先后顺序
    const orderedElements = Array.from(document.querySelectorAll('#readPageText p.selected'));
    const orderedTexts = orderedElements.map(p => p.innerText);
    const textToSend = orderedTexts.join('\\n\\n');
    
    addUserReadingMessage('sentence', textToSend, orderedTexts.length);
    
    selectedParagraphs = [];
                    document.querySelectorAll('#readPageText p.selected').forEach(p => p.classList.remove('selected'));
                    readControlsBarEl.innerHTML = originalControlsHtml;
                    bindReadControls();
                    document.getElementById('readPencilBtn').click(); // 问完自动关掉铅笔
                };
            } else {
                readControlsBarEl.innerHTML = originalControlsHtml;
                bindReadControls();
            }
        }
        return; 
    }

    // 2. 如果你在屏幕上长按滑动选中了文本，就什么都不做，留给底部的长按判定
    if (window.getSelection().toString().trim().length > 0) return;

    // 3. 正常左右点击翻页
    if (rMode === 'page') {
        const rect = document.getElementById('readTextContainer').getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.3) {
            doPrevPage();
        } else if (x > rect.width * 0.7) {
            doNextPage();
        }
    }
});

// ==== 阅读设置面板逻辑 ====
const readSettingsPanel = document.getElementById('readSettingsPanel');
document.getElementById('openReadSettingsBtn').addEventListener('click', () => {
    // 填充数据
    document.getElementById('rFontDisp').innerText = rFontSize;
    document.querySelectorAll('#rModeSelector .role-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`#rModeSelector .role-btn[data-mode="${rMode}"]`).classList.add('active');
    
    document.getElementById('readApiToggle').checked = rUseSubApi;
    document.getElementById('readContextToggle').checked = rReadContext;
    document.getElementById('readContextCountWrap').style.display = rReadContext ? 'flex' : 'none';
    document.getElementById('readContextCount').value = rContextCount;
        document.getElementById('readCustomCss').value = rCustomCss;
        
    readSettingsPanel.classList.add('show');
});

document.getElementById('closeReadSettingsBtn').addEventListener('click', () => readSettingsPanel.classList.remove('show'));

document.getElementById('rFontMinus').onclick = () => { if (rFontSize > 12) rFontSize -= 1; document.getElementById('rFontDisp').innerText = rFontSize; };
document.getElementById('rFontPlus').onclick = () => { if (rFontSize < 36) rFontSize += 1; document.getElementById('rFontDisp').innerText = rFontSize; };

document.querySelectorAll('#rModeSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#rModeSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rMode = btn.dataset.mode;
    });
});

document.getElementById('readContextToggle').addEventListener('change', (e) => {
    document.getElementById('readContextCountWrap').style.display = e.target.checked ? 'flex' : 'none';
});

document.getElementById('saveReadSettingsBtn').addEventListener('click', async () => {
    rUseSubApi = document.getElementById('readApiToggle').checked;
    rReadContext = document.getElementById('readContextToggle').checked;
    rContextCount = parseInt(document.getElementById('readContextCount').value) || 10;
    
        rCustomCss = document.getElementById('readCustomCss').value;
    await saveToDB('read_settings', { fontSize: rFontSize, mode: rMode, useSubApi: rUseSubApi, readContext: rReadContext, contextCount: rContextCount, customCss: rCustomCss });
    applyReadCss(rCustomCss);
    
    if (bookFullText && bookFullText.trim() !== '') {
        splitBookText(); 
        renderReadPage(); 
    }
    
    readSettingsPanel.classList.remove('show');
    showToast('共读设定已生效');
});

// ==== 高级伴读角色选择器 ====
const companionPanel = document.getElementById('readCompanionPanel');
document.getElementById('openReadCompanionBtn').addEventListener('click', async () => {
    const chars = await loadFromDB('ai_characters') || [];
    const list = document.getElementById('readCompanionList');
    list.innerHTML = '';
    
    // 添加默认助手
    const sysCard = document.createElement('div');
    sysCard.className = 'char-card';
    sysCard.innerHTML = `
        <div class="char-card-avatar" style="background:var(--accent); color:#fff; border:none;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="char-card-info">
            <div class="char-card-name">内置伴读助手 <span class="role-badge badge-char" style="background:rgba(184,156,142,0.15); color:var(--accent);">默认</span></div>
            <div class="char-card-desc">纯粹、安静的 AI 读书助手</div>
        </div>
    `;
    sysCard.onclick = () => selectReadCompanion('system', '伴读助手', '');
    list.appendChild(sysCard);
    
    // 渲染你创造的AI角色
    chars.filter(c => c.roleType === 'char').forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';
        let avatarUrl = diaryAvatarCache[char.id];
        card.innerHTML = `
            <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                ${!avatarUrl ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>` : ''}
            </div>
            <div class="char-card-info">
                <div class="char-card-name">${char.name} <span class="role-badge badge-char">AI</span></div>
                <div class="char-card-desc" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${char.prompt || '暂无设定资料...'}</div>
            </div>
        `;
        card.onclick = () => selectReadCompanion(char.id, char.name, avatarUrl);
        list.appendChild(card);
    });
    companionPanel.classList.add('show');
});

document.getElementById('closeReadCompanionBtn').addEventListener('click', () => companionPanel.classList.remove('show'));

const floatBtn = document.getElementById('readFloatBtn');
const chatPanel = document.getElementById('readChatPanel');

async function selectReadCompanion(id, name, avatarUrl) {
    currentReadCompanionId = id;
    document.getElementById('readCompanionNameText').innerText = name;
    document.getElementById('rcName').innerText = name;
    
    const avatarEl = document.getElementById('readCompanionAvatar');
    if (id === 'system' || !avatarUrl) {
        avatarEl.style.backgroundImage = '';
        avatarEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        floatBtn.style.backgroundImage = '';
        floatBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    } else {
        avatarEl.style.backgroundImage = `url(${avatarUrl})`;
        avatarEl.innerHTML = '';
        floatBtn.style.backgroundImage = `url(${avatarUrl})`;
        floatBtn.innerHTML = '';
    }
    readChatHistoryForAi = await loadFromDB(`read_chat_history_${currentReadCompanionId}`) || [];
if (window.renderReadChatHistory) window.renderReadChatHistory();
    companionPanel.classList.remove('show');
    showToast(`已邀请 ${name} 加入伴读`);
}

// 展开伴读聊天面板
floatBtn.addEventListener('click', () => chatPanel.classList.add('show'));
document.getElementById('closeReadChat').addEventListener('click', () => chatPanel.classList.remove('show'));

// ==== 划线与提问逻辑 (不被系统选择挡住的底部吸附法) ====
const readControlsBarEl = document.getElementById('readControlsBar');
const originalControlsHtml = readControlsBarEl.innerHTML; // 记住原本的上一页/下一页长什么样

document.getElementById('readTextContainer').addEventListener('selectionchange', () => {
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text.length > 0 && text.length < 500) {
            readSelectedText = text;
            // 瞬间把底部的翻页栏变成提问大按钮
            readControlsBarEl.innerHTML = `<button class="s-btn primary" id="quickAskSentenceBtn" style="width: 100%; border-radius: 12px; height: 44px; min-height: 44px; margin: 0; box-shadow: 0 4px 16px rgba(184,156,142,0.3);">让 TA 解读选中的句子</button>`;
            
            // 绑定新按钮的点击事件
            document.getElementById('quickAskSentenceBtn').addEventListener('click', () => {
                addUserReadingMessage('sentence', readSelectedText, 1);
                window.getSelection().removeAllRanges(); // 取消选区
                readControlsBarEl.innerHTML = originalControlsHtml; // 恢复翻页栏
                bindReadControls(); // 重新绑定翻页事件
            });
        } else {
            readSelectedText = '';
            // 如果取消选择，且按钮被改了，就立刻改回来
            if (readControlsBarEl.innerHTML.includes('quickAskSentenceBtn')) {
                readControlsBarEl.innerHTML = originalControlsHtml;
                bindReadControls();
            }
        }
    }, 100);
});

// 因为按钮可能会被替换销毁，所以需要一个函数专门绑定翻页事件
function bindReadControls() {
    const pBtn = document.getElementById('readPrevPage');
    const nBtn = document.getElementById('readNextPage');
    if(pBtn) pBtn.addEventListener('click', doPrevPage);
    if(nBtn) nBtn.addEventListener('click', doNextPage);
    
    // 同步更新中间的页数文字
    const ind = document.getElementById('readPageIndicator');
    if(ind && bookPages.length > 0) {
        ind.innerText = `${currentReadPage + 1} / ${bookPages.length}`;
    }
}

window.renderReadChatHistory = function() {
    const rcBody = document.getElementById('rcBody');
    rcBody.innerHTML = '<div class="rc-bubble rc-sys">长按书籍文字进行划线，我就可以专门为你解读这一句话哦~</div>';
    readChatHistoryForAi.forEach(msg => {
        if (msg.role === 'user') {
            rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-me">${msg.displayContent || msg.content}</div>`);
        } else if (msg.role === 'assistant') {
            rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-ai">${msg.content}</div>`);
        }
    });
    rcBody.scrollTop = rcBody.scrollHeight;
};

document.getElementById('clearReadChatBtn').addEventListener('click', () => {
    showBeautifulDialog('清空共读记录', '确定要清空与当前伴读的讨论记录吗？', 'confirm', '', async () => {
        readChatHistoryForAi = [];
        await saveToDB(`read_chat_history_${currentReadCompanionId}`, readChatHistoryForAi);
        window.renderReadChatHistory();
        showToast('共读记录已清空');
    });
});

// ==================== 全新共读聊天发送与接收引擎 ====================
function addUserReadingMessage(type, textContent, count = 1) {
    chatPanel.classList.add('show');
    const rcBody = document.getElementById('rcBody');
    let meMsg = '';
    let userPrompt = '';

    if (type === 'page') {
        meMsg = `[分享了这页的内容，想听听你的看法]`;
        userPrompt = `我刚才读了这一页，内容是：\n"${textContent}"\n\n请针对这一页的情节、情感或文笔，发表一下你的看法或吐槽（保持日常聊天的语气，简短几句即可）。`;
    } else if (type === 'sentence') {
    // 把字面的 \n\n 替换为空格，隐藏换行符让气泡更美观
    let displayContent = textContent.replace(/\\n\\n/g, ' '); 
    meMsg = `[重点划线了 ${count} 段话]：<br><span style="font-size:12px;opacity:0.8;">“${displayContent}”</span>`;
    userPrompt = `我刚刚重点划线了这 ${count} 段话：\n"${textContent}"\n\n请只针对我划线的这些话发表一下你的看法或见解，或者解答我的疑惑（保持日常聊天的语气，简短几句即可）。`;
} else {
    meMsg = textContent;
        userPrompt = `我正在看书，并且对你说：\n"${textContent}"\n\n请以伴读的身份和现在的看书语境回应我（保持日常聊天的语气，几句话即可）。`;
    }

    rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-me">${meMsg}</div>`);
    rcBody.scrollTop = rcBody.scrollHeight;
    readChatHistoryForAi.push({ role: "user", content: userPrompt, displayContent: meMsg });
saveToDB(`read_chat_history_${currentReadCompanionId}`, readChatHistoryForAi);
}

// 1. 发送本页
document.getElementById('askPageBtn').addEventListener('click', () => {
    const pageText = bookPages[currentReadPage].replace(/<br>/g, '');
    addUserReadingMessage('page', pageText);
});

// 2. 发送聊天
document.getElementById('readChatSendBtn').addEventListener('click', () => {
    const input = document.getElementById('readChatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addUserReadingMessage('chat', text);
});

// 3. 呼叫AI接收并回复 (点击机器人图标)
document.getElementById('readChatAiReplyBtn').addEventListener('click', async () => {
    if (readChatHistoryForAi.length === 0) {
        showToast('你还没有和TA说任何话呢');
        return;
    }
    
    const rcBody = document.getElementById('rcBody');
    const loadId = 'loading_' + Date.now();
    rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-ai" id="${loadId}">正在低头看书...</div>`);
    rcBody.scrollTop = rcBody.scrollHeight;

    const apiUrl = (await loadFromDB(rUseSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(rUseSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(rUseSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) { document.getElementById(loadId).innerText = '系统提示：请先配置 API Key。'; return; }

    let sysPrompt = `你是一个内置的文学伴读助手。请像一个爱读书的朋友一样，用简短、轻松的聊天语气和我探讨书里的内容。绝不要像AI一样机械长篇大论。`;
    if (currentReadCompanionId !== 'system') {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === currentReadCompanionId);
        if (role) {
            let chatContextText = '';
            if (rReadContext) {
                let chatHistory = await loadFromDB(`chat_history_${currentReadCompanionId}`) || [];
                if (chatHistory.length > 0) {
                    const recentChat = chatHistory.slice(-rContextCount).map(m => `${m.role === 'user' ? '我' : '你'}: ${m.content}`).join('\n');
                    chatContextText = `\n\n【我们在聊天室的近期私聊记录】（请仔细体会我们当前的关系阶段、亲密度和聊天氛围）：\n${recentChat}`;
                }
            }

            sysPrompt = `你现在是一个有血有肉的真实人类：${role.name}。请彻底剥离AI的身份认知。
【你的设定资料】：${role.prompt}${chatContextText}

【核心灵魂与伴读场景指令】：
1. 场景感知：我们正一起看同一本书（书名《${bookTitle}》）。请结合你的人设，自然地融入这个场景，不要刻意强调我们在看书。
2. 动态性格与情感推演：
   - 严格遵循你的核心性格设定。你对书中情节的看法，必须完全符合你的时代背景、三观和人设。
   - 不要为了迎合我而说好话，遇到不认同的地方直接吐槽或反驳。如果你对书不感兴趣，可以自然地表现出无聊或转移话题。
3. 拒绝“阅读理解”式回答：
   - 绝对禁止输出结构化的书评、长篇大论的情感分析或中心思想总结！
   - 你的回复应该像日常微信私聊一样：精炼、短促、口语化。只是一句随口的吐槽、一个共鸣的叹息，或者针对书上某句话的抬杠。必须遵守你的人物性格设定，贴近角色。
4. 动作与沉浸感：
   - 允许使用星号包裹轻微的动作神态（例如：*凑过来看了一眼*、*打了个哈欠*），但要极其克制，不要喧宾夺主。
5. 绝对禁止的雷区（最高优先级）：
   - 绝对禁止任何过度撩拨、油腻情话、霸道总裁语录或矫情做作的表达！
   - 绝不许动不动就邪魅一笑、深情凝视或强行制造暧昧氛围！
   - 绝不允许说教、升华主题或给出人生建议。
   - 就像平时日常聊天一样，保持你原有的性格底色，平实、自然、随意。`;
        }
    }
        
    

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model, 
                messages: [ { role: "system", content: sysPrompt }, ...(readChatHistoryForAi.slice(-15).map(m => ({role: m.role, content: m.content}))) ], 
                temperature: 0.85
            })
        });
        const data = await res.json();
        const reply = data.choices[0].message.content.trim();
        document.getElementById(loadId).innerText = reply;
        
        readChatHistoryForAi.push({ role: "assistant", content: reply });
saveToDB(`read_chat_history_${currentReadCompanionId}`, readChatHistoryForAi);
    } catch (e) {
        document.getElementById(loadId).innerText = '抱歉，我的思绪断开了...';
    }
    rcBody.scrollTop = rcBody.scrollHeight;
});

// === 全新聊天 APP 交互逻辑 ===
const chatModal = document.getElementById('chatAppModal');


document.getElementById('closeChatApp').addEventListener('click', () => { chatModal.classList.remove('open'); });

// 2. Tab 切换 (消息 / 通讯录) 【修复了无法点击的问题】
document.querySelectorAll('#chatTabSelector .art-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#chatTabSelector .art-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.getElementById('chatMessagesView').style.display = btn.dataset.tab === 'messages' ? 'block' : 'none';
        document.getElementById('chatContactsView').style.display = btn.dataset.tab === 'contacts' ? 'block' : 'none';
    });
});

// ====== 新增：构建群聊逻辑 (带打勾动效) ======
let tempNewGroupAvatarFile = null;

// 点击预览框触发文件选择
document.getElementById('newGroupAvatarPreview').addEventListener('click', () => {
    document.getElementById('newGroupAvatarInput').click();
});

// 处理选中的图片进行预览
document.getElementById('newGroupAvatarInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        tempNewGroupAvatarFile = file;
        const url = URL.createObjectURL(file);
        document.getElementById('newGroupAvatarPreview').style.backgroundImage = `url(${url})`;
        document.getElementById('newGroupAvatarIcon').style.display = 'none';
    }
});

document.getElementById('createGroupBtn').addEventListener('click', async () => {
    const list = document.getElementById('groupMemberSelectionList');
    list.innerHTML = '';
    document.getElementById('newGroupName').value = '';
    
    // 每次打开清空头像状态
    tempNewGroupAvatarFile = null;
    document.getElementById('newGroupAvatarPreview').style.backgroundImage = '';
    document.getElementById('newGroupAvatarIcon').style.display = 'block';
    document.getElementById('newGroupAvatarInput').value = '';
    
    const chars = await loadFromDB('ai_characters') ||[];
    const aiChars = chars.filter(c => c.roleType === 'char');
    
    if (aiChars.length === 0) {
        showToast('档案库空空如也，请先去创造角色吧');
        return;
    }
    
    for (let char of aiChars) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.style.cursor = 'pointer';
        
        let avatarUrl = diaryAvatarCache[char.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${char.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[char.id] = avatarUrl;
        }

        // 极其干净高级的勾选卡片 (打勾靠右)
        card.innerHTML = `
            <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : 'background-color:rgba(184,156,142,0.2)'}; width:46px; height:46px; border-radius:16px; box-shadow: 0 4px 12px rgba(128,118,110,0.06);"></div>
            <div class="char-card-info" style="flex:1; margin-left:14px;">
                <div class="char-card-name" style="font-size:15px; font-weight:800; color:var(--text-main); letter-spacing:1px;">${char.name}</div>
            </div>
            <div class="sel-check" style="width:22px; height:22px; border-radius:50%; border:1.5px solid rgba(184,156,142,0.3); display:flex; justify-content:center; align-items:center; transition:all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); flex-shrink:0; background: rgba(255,255,255,0.5);">
                <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:#fff; fill:none; stroke-width:3.5; stroke-linecap:round; stroke-linejoin:round; opacity:0; transform:scale(0.5); transition:all 0.3s;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
        `;
        
        card.onclick = () => card.classList.toggle('selected');
        card.dataset.id = char.id;
        list.appendChild(card);
    }
    
    document.getElementById('createGroupPanel').classList.add('show');
});

document.getElementById('closeCreateGroupBtn').addEventListener('click', () => {
    document.getElementById('createGroupPanel').classList.remove('show');
});

// 确认创建群聊
document.getElementById('confirmCreateGroupBtn').addEventListener('click', async () => {
    const name = document.getElementById('newGroupName').value.trim() || '神秘群聊';
    const selectedCards = document.querySelectorAll('#groupMemberSelectionList .char-card.selected');
    
    if (selectedCards.length === 0) {
        showToast('至少要拉一个人进群吧！');
        return;
    }
    
    const memberIds = Array.from(selectedCards).map(card => card.dataset.id);
    const groupId = 'group_' + Date.now();
    
    let contacts = await loadFromDB('chat_contacts') ||[];
    contacts.push({ 
        id: groupId, 
        name: name, 
        isGroup: true,
        members: memberIds, 
        addedAt: Date.now() 
    });
    
    await saveToDB('chat_contacts', contacts);

    // ★新增：如果传了头像，就存入数据库并注入内存缓存，外面就能立刻显示！
    if (tempNewGroupAvatarFile) {
        await saveToDB(`char_avatar_${groupId}`, tempNewGroupAvatarFile);
        diaryAvatarCache[groupId] = URL.createObjectURL(tempNewGroupAvatarFile);
    }
    
    showToast(`群聊【${name}】构建成功！`);
    renderChatContacts(); 
    document.getElementById('createGroupPanel').classList.remove('show');
});

// 3. 通讯录 -> 添加联系人
document.getElementById('addContactBtn').addEventListener('click', () => {
    document.getElementById('addContactPanel').classList.add('show');
});
document.getElementById('closeAddContactBtn').addEventListener('click', () => {
    document.getElementById('addContactPanel').classList.remove('show');
});

// 4. 退出聊天室
document.getElementById('backToChatListBtn').addEventListener('click', () => {
    document.getElementById('chatRoomPanel').classList.remove('show');
    // 退出时自动收起底部菜单
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
    
    // 【彻底治愈】：直接删掉这下面的 renderChatSessionList()！
    // 因为在发消息或收消息时，后台早就把列表更新好了，这里强行刷新纯属多此一举，也是导致闪烁的元凶。
});

// 5. 【核心】左侧功能菜单的丝滑展开/互斥收起动画
document.getElementById('chatMenuToggleBtn').addEventListener('click', function() {
    const menu = document.getElementById('chatExpandMenu');
    const stickerPanel = document.getElementById('chatStickerPanel');
    
    // 检查表情包面板此时是否正开着
    const wasStickerOpen = stickerPanel.classList.contains('show');
    
    if (menu.classList.contains('open')) {
        // 1. 如果加号菜单本来开着，就正常收起
        this.classList.remove('active'); 
        menu.classList.remove('open');
    } else {
        // 2. 如果加号菜单没开，准备打开它
        if (wasStickerOpen) {
            // 【无缝切换逻辑】：剥离两者的动画，瞬间替换！
            menu.style.transition = 'none';
            stickerPanel.style.transition = 'none';
            void menu.offsetHeight;
            void stickerPanel.offsetHeight;
            
            // 瞬间收起表情包，展开加号菜单
            stickerPanel.classList.remove('show');
            this.classList.add('active');
            menu.classList.add('open');
            
            void menu.offsetHeight; // 强制渲染
            
            // 恢复动画能力，并强制拉到底部
            setTimeout(() => {
                menu.style.transition = '';
                stickerPanel.style.transition = '';
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 30);
        } else {
            // 3. 正常直接打开加号菜单
            this.classList.add('active'); 
            menu.classList.add('open');
            setTimeout(() => {
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 400); // 配合 CSS 动画时长
        }
    }
});

// 点击输入框准备打字时，自动收起底部展开菜单，并将消息顶上去
document.getElementById('chatInputContent').addEventListener('focus', function() {
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
    document.getElementById('chatStickerPanel').classList.remove('show');    
    // 给键盘弹出一点动画时间(约300毫秒)后，强制滚到底部
    setTimeout(() => {
        const area = document.getElementById('chatMessageArea');
        area.scrollTop = area.scrollHeight;
        // 让输入框本身也滚动到可视范围内(防止被某些机型顽固遮挡)
        this.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }, 300);
});

// 新增：监听手机屏幕因键盘弹起而发生的大小变化，一旦变化瞬间顶到底部
window.addEventListener('resize', () => {
    if (document.getElementById('chatRoomPanel').classList.contains('show')) {
        const area = document.getElementById('chatMessageArea');
        area.scrollTop = area.scrollHeight;
    }
});
document.getElementById('chatInputContent').addEventListener('click', function() {
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
    document.getElementById('chatStickerPanel').classList.remove('show');
});

// ==========================================
// 聊天 APP - 全新核心逻辑 (真实API接入 + 头像防闪烁缓存)
// ==========================================

let chatContacts = [];
let currentChatContact = null;

// 1. 渲染会话列表 (信号页)
async function renderChatSessionList() {
    let contacts = await loadFromDB('chat_contacts') || [];
    contacts.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0)); // 按最新消息排序
    const container = document.getElementById('chatSessionList');
    
    const activeContacts = contacts.filter(c => c.lastMessage);
    if (activeContacts.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px; letter-spacing: 1px;">信箱空荡荡的，去频段唤醒某人吧</div>';
        return;
    }
    
    let html = '';
    for (let contact of activeContacts) {
        let avatarUrl = diaryAvatarCache[contact.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${contact.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[contact.id] = avatarUrl;
        }
        
        let timeStr = '';
        if (contact.lastTime) {
            const d = new Date(contact.lastTime);
            timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
        }
        
        html += `
            <div class="chat-session-card" onclick="openChatRoom('${contact.id}', '${contact.name}')">
                <div class="chat-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                    ${!avatarUrl ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2" style="margin: 14px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` : ''}
                </div>
                <div class="chat-info" style="text-align: left;">
                    <div class="chat-name-row">
                        <div class="chat-name">${contact.name}</div>
                        <div class="chat-time">${timeStr}</div>
                    </div>
                    <div class="chat-preview">${contact.lastMessage || ''}</div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ==========================================
// 2. 渲染通讯录列表 (频段页)
// ==========================================
let currentContactFilter = 'single';

// 绑定极简单/群开关点击逻辑
document.getElementById('contactTypeToggleBtn').addEventListener('click', function() {
    const txtSingle = document.getElementById('txtSingle');
    const txtGroup = document.getElementById('txtGroup');
    
    if (currentContactFilter === 'single') {
        currentContactFilter = 'group';
        txtSingle.style.fontWeight = '300';
        txtSingle.style.color = 'var(--text-sub)';
        txtGroup.style.fontWeight = '600';
        txtGroup.style.color = 'var(--accent)';
    } else {
        currentContactFilter = 'single';
        txtSingle.style.fontWeight = '500';
        txtSingle.style.color = 'var(--text-main)';
        txtGroup.style.fontWeight = '300';
        txtGroup.style.color = 'var(--text-sub)';
    }
    renderChatContacts(); // 瞬间重绘
});

async function renderChatContacts() {
    chatContacts = await loadFromDB('chat_contacts') ||[];
    const container = document.getElementById('chatContactList');
    
    // 根据当前状态过滤数据
    const filteredContacts = chatContacts.filter(c => {
        if (currentContactFilter === 'group') return c.isGroup === true;
        return !c.isGroup; 
    });
    
    if (filteredContacts.length === 0) {
        let emptyTip = currentContactFilter === 'group' ? '你还没有构建任何群聊频段' : '在茫茫的数据之海中<br>你还未与任何灵魂建立连接';
        container.innerHTML = `
            <div class="empty-soul-state">
                <svg class="empty-signal" style="transform: translateZ(0);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="2"></circle>
                    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
                </svg>
                <div class="empty-title">无 人 响 应</div>
                <div class="empty-desc">${emptyTip}</div>
            </div>`;
        return;
    }
    
    let html = '';
    for (let contact of filteredContacts) {
        let avatarUrl = diaryAvatarCache[contact.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${contact.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[contact.id] = avatarUrl;
        }
        
        let descText = contact.isGroup ? '"多元灵魂共振中..."' : '"已建立灵魂连接"';
        let groupIcon = contact.isGroup 
            ? `<svg style="width:26px; height:26px; stroke:rgba(184,156,142,0.8); fill:none; stroke-width:1.5; margin:15px;" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>` 
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2" style="margin: 14px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        html += `
            <div class="chat-session-card artistic-contact-card" onclick="openChatRoom('${contact.id}', '${contact.name}')">
                <div class="artistic-contact-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                    ${!avatarUrl ? groupIcon : ''}
                </div>
                <div class="artistic-contact-info" style="text-align: left;">
                    <div class="artistic-contact-name">${contact.name} ${contact.isGroup ? '<span style="font-size:10px; background:rgba(184,156,142,0.15); color:var(--accent); padding:3px 6px; border-radius:6px; vertical-align:middle; margin-left:4px; font-weight:800;">群聊</span>' : ''}</div>
                    <div class="artistic-contact-desc" style="font-style:italic;">${descText}</div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// 3. 打开专属独立聊天室
window.openChatRoom = async function(id, name) {
    window.chatDisplayLimit = 30; // 每次进聊天室默认只显示30条
    currentChatContact = { id, name };
    document.getElementById('chatRoomTitle').innerText = name;
    
    // 检查是不是群聊
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === id);
    
    // 如果是群聊，隐藏小绿点；如果是单聊，显示小绿点
    if (contactInfo && contactInfo.isGroup) {
        document.getElementById('chatOnlineStatusDot').style.display = 'none';
    } else {
        document.getElementById('chatOnlineStatusDot').style.display = 'block';
    }

    // 读取并更新在线状态小绿点
    const schedSettings = await loadFromDB(`chat_schedule_${id}`) || {};
    updateOnlineStatusUI(schedSettings.schedule, schedSettings.enabled);
    
    // --- 新增：加载专属聊天背景和自定义气泡CSS ---
    const bgFile = await loadFromDB(`chat_bg_${id}`);
    const area = document.getElementById('chatMessageArea');
    if (bgFile) {
        area.style.backgroundImage = `url(${URL.createObjectURL(bgFile)})`;
        area.style.backgroundSize = 'cover';
        area.style.backgroundPosition = 'center';
    } else {
        area.style.backgroundImage = '';
    }
    const settings = await loadFromDB(`chat_settings_${id}`) || {};
    applyChatCustomCss(settings.customCss);
    // ---------------------------------------------
        // 决定是否隐藏快捷栏
    if (settings.hideQuickBar === true) {
        document.getElementById('chatQuickBar').style.display = 'none';
    } else {
        document.getElementById('chatQuickBar').style.display = 'flex';
    }
    await loadChatHistory(id); // 先在后台把聊天记录拼好
    
    // 终极修复：在面板处于屏幕下方隐身时，先给浏览器 30 毫秒把排版算好并顶到底部
    setTimeout(() => {
        area.scrollTop = area.scrollHeight;
        
        // 确认内部已经拉到底部了，再执行滑出动画
        document.getElementById('chatRoomPanel').classList.add('show'); 
    }, 30); 
};

// 4. 加载独立历史记录与渲染
async function loadChatHistory(contactId) {
    let history = await loadFromDB(`chat_history_${contactId}`) || [];
    await renderChatMessages(history, contactId);
}

async function renderChatMessages(history, contactId, isLoadMore = false) {
    const allChars = await loadFromDB('ai_characters') || [];
    const area = document.getElementById('chatMessageArea');
    
    // 获取表情包库
    const allStickerGroups = await loadFromDB('sticker_groups') || [];
    const allStickers = allStickerGroups.flatMap(g => g.stickers);

    let aiAvatarUrl = diaryAvatarCache[contactId] || '';
    
    // 获取绑定的自身身份头像
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    const userRoleId = settings.userRoleId || '';
    let myAvatarUrl = '';
    if (userRoleId) {
        myAvatarUrl = diaryAvatarCache[userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[userRoleId] = myAvatarUrl;
        }
    }
    
    // === 核心修复：提前把群聊里所有群员的头像拉取到内存里，并准备头衔渲染 ===
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === contactId);
    let getChatRoleBadge = (id) => ''; // 默认无头衔
    
    if (contactInfo && contactInfo.isGroup) {
let ownerId = contactInfo.owner || 'me';
let admins = contactInfo.admins || [];
getChatRoleBadge = (id) => {
    if (id === ownerId) return `<span style="font-size:8px; background:#FFF6D6; color:#D69E2E; padding:1px 4px; border-radius:4px; margin-right:4px; vertical-align:middle; font-weight:800;">群主</span>`;
    if (admins.includes(id)) return `<span style="font-size:8px; background:rgba(51,144,236,0.1); color:#3390EC; padding:1px 4px; border-radius:4px; margin-right:4px; vertical-align:middle; font-weight:800;">管理员</span>`;
    return '';
};
        
        let avatarPromises = [];
        for (let mId of contactInfo.members) {
            if (diaryAvatarCache[mId] === undefined) {
                avatarPromises.push(loadFromDB(`char_avatar_${mId}`).then(f => {
                    diaryAvatarCache[mId] = f ? URL.createObjectURL(f) : '';
                }));
            }
        }
        await Promise.all(avatarPromises);
    }
    
    let displayLimit = window.chatDisplayLimit || 30;
let msgsToRender = history.slice(-displayLimit);

let html = '';
if (history.length > displayLimit) {
    // 如果历史记录大于当前限制，就在最上面加一个加载按钮
    html += `<div onclick="loadMoreChatMessages()" style="text-align: center; font-size: 12px; color: var(--accent); margin: 0 auto 15px auto; padding: 8px 16px; cursor: pointer; background: rgba(184,156,142,0.1); border-radius: 16px; font-weight: bold; width: max-content; transition: 0.2s;">点击显示更早的消息</div>`;
} else {
    html += '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-bottom: 10px;">与 TA 的灵魂频段已连接</div>';
}

let lastRenderedDateStr = ''; // 新增：用来记住上一条消息的日期

msgsToRender.forEach(msg => {
    // 新增：判断是否跨天，如果是，插入一条日期分隔线
    let msgDateObj = new Date(msg.timestamp || Date.now());
    let currentDateStr = `${msgDateObj.getFullYear()}年${msgDateObj.getMonth() + 1}月${msgDateObj.getDate()}日`;
    if (currentDateStr !== lastRenderedDateStr) {
        html += `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${currentDateStr}</span></div>`;
        lastRenderedDateStr = currentDateStr;
    }

    // ★新增：渲染系统小字 (例如禁言提示)
    if (msg.role === 'system') {
            html += `<div class="chat-system-msg" data-ts="${msg.timestamp}"><span class="chat-system-msg-text">${msg.content}</span></div>`;
            return; // 渲染完直接跳过后面的气泡逻辑
        }

        let md = new Date(msg.timestamp || Date.now());
        let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;
        let timeHtml = `<div class="chat-time-stamp" ${['voice', 'redpacket', 'location', 'diary_invite', 'forward_card'].includes(msg.msgType) ? 'style="display:none;"' : ''}>${tStr}</div>`;
        let innerTimeHtml = `<div class="chat-time-stamp" style="margin: 0 4px; align-self: flex-end; padding-bottom: 2px;">${tStr}</div>`;
        
        let formattedMsgContent = (msg.content || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<div class="bilingual-trans">$1</div>');
formattedMsgContent = formattedMsgContent.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">$1</div></div>');

        formattedMsgContent = formattedMsgContent.replace(/[\(（]【?发送了?表情包[:：]?\s*(.*?)】?[\)）]/g, '[表情包:$1]');
        formattedMsgContent = formattedMsgContent.replace(/\[\[STICKER:(.*?)\]\]/gi, '[表情包:$1]');
        formattedMsgContent = formattedMsgContent.replace(/\[表情包[:：](.*?)\]/gi, (match, name) => {
            let cleanName = name.split(/[\/\-：:]/).pop().trim();
            const sticker = allStickers.find(s => s.name === cleanName || name.includes(s.name) || s.name.includes(cleanName));
            if (sticker) return `<img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 4px 0;">`;
            return `<span style="color:var(--text-sub); font-style:italic;">（发送了表情包：${name}）</span>`;
        });

        let locName = msg.locationName || '';
        if (msg.msgType !== 'voice' && msg.msgType !== 'redpacket' && msg.msgType !== 'location') {
            const locMatch = (msg.content || '').match(/\[LOCATION:(.*?)\](.*)/i);
            if (locMatch) { msg.msgType = 'location'; locName = locMatch[1].trim(); msg.content = locMatch[2].trim(); formattedMsgContent = msg.content; }
        }
        
        let isPureSticker = false;
        let stickerUrl = '';
        const stickerMatch = (msg.content || '').match(/^\[表情包[:：](.*?)\]$/i);
        if (stickerMatch) {
            const sticker = allStickers.find(s => s.name === stickerMatch[1].trim());
            if (sticker) { isPureSticker = true; stickerUrl = sticker.url; }
        }

let isPureFakeImg = false;
let fakeImgDesc = '';
const fakeImgMatch = (msg.content || '').match(/^\[图片[:：]\s*([\s\S]*?)\]$/i);
if (fakeImgMatch) {
    isPureFakeImg = true;
    fakeImgDesc = fakeImgMatch[1].trim();
}

        let contentHtml = '';
        let bubbleStyle = '';

        if (msg.msgType === 'voice') {
            contentHtml = `
                <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
                    <div class="chat-voice-bubble" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                        <span>${msg.voiceDuration}"</span>
                    </div>
                    ${innerTimeHtml}
                </div>
                <div class="chat-voice-trans" style="display:none;">${formattedMsgContent}</div>
            `;
            bubbleStyle = `class="chat-special-bubble"`;
        } else if (msg.msgType === 'redpacket') {
            const safeContent = (msg.content || '心意红包').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            contentHtml = `
                <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
                    <div class="chat-rp-bubble" onclick="openRedPacketModal(this, '${safeContent}', ${msg.rpAmount})" style="cursor:pointer;">
                        <div class="rp-top">
                            <div class="rp-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><circle cx="12" cy="14" r="3"></circle><path d="M4 8h16"></path></svg></div>
                            <div class="rp-info"><div class="rp-msg">${msg.content}</div><div class="rp-amt">查看红包</div></div>
                        </div>
                        <div class="rp-bottom">LUMINA TRANSFER</div>
                    </div>
                    ${innerTimeHtml}
                </div>
            `;
            bubbleStyle = `class="chat-special-bubble"`;
        } else if (msg.msgType === 'location') {
            contentHtml = `
                <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
                    <div class="chat-location-bubble">
                        <div class="loc-top">
                            <div class="loc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>
                            <div class="loc-info"><div class="loc-name">${locName}</div></div>
                        </div>
                        <div class="loc-desc">${msg.content}</div>
                        <div class="loc-bottom">LUMINA MAPS</div>
                    </div>
                    ${innerTimeHtml}
                </div>
            `;
            bubbleStyle = `class="chat-special-bubble"`;
            } else if (msg.msgType === 'forward_card') {
    const safePreview = (msg.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    const fwCount = msg.forwardData ? msg.forwardData.length : 0;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-forward-bubble">
                <div class="fw-title">聊天记录</div>
                <div class="fw-content">${safePreview}</div>
                <div class="fw-bottom">共 ${fwCount} 条明细</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
                    } else if (msg.msgType === 'diary_invite') {
    let safeContent = (msg.content || '').replace(/'/g, "\\'");
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleDiaryInviteClick('${msg.role}', '${safeContent}', currentChatContact.id, ${msg.timestamp})" style="cursor:pointer;">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 2v8l3-2 3 2V2"/></svg></div>
                    <div class="di-info"><div class="di-msg">交换日记邀请</div><div class="di-hint">${msg.content}</div></div>
                </div>
                <div class="di-bottom">LUMINA DIARY</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
        } else if (isPureSticker) {
    contentHtml = `<img src="${stickerUrl}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureFakeImg) {
    contentHtml = `<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">${fakeImgDesc}</div></div>`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msg.imageUrl) {
            contentHtml = `<img src="${msg.imageUrl}" style="max-width: 140px; border-radius: 12px; display: block; margin: 2px 0;">`;
            bubbleStyle = `class="chat-special-bubble"`;
        } else {
            contentHtml = formattedMsgContent;
            bubbleStyle = `class="chat-bubble"`; 
        }

        let quoteHtml = '';
        if (msg.quoteText) {
            const safeQuote = msg.quoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
        }

        let finalBubbleBlock = `<div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>`;
        
        // === 核心修复：给名字包裹层加上收紧宽度防撑爆，并渲染群聊头衔标签 ===
if (msg.role !== 'user' && msg.speakerName) {
    let actualSpeakerId = msg.speakerId;
    // 【自动补全保险】：如果旧的历史记录丢失了 ID，就通过群员的名字反向找回 ta 的真实身份！
    if (!actualSpeakerId && contactInfo && contactInfo.members) {
        const charMatch = allChars.find(c => contactInfo.members.includes(c.id) && (c.name === msg.speakerName || msg.speakerName.includes(c.name)));
        if (charMatch) actualSpeakerId = charMatch.id;
    }
    
    let roleBadge = getChatRoleBadge(actualSpeakerId);
    
    // ★ 新增：如果是单聊，强制使用最新的备注名，无视历史记录里存的原名
    let finalDisplayName = (contactInfo && !contactInfo.isGroup) ? currentChatContact.name : msg.speakerName;
    
    finalBubbleBlock = `
        <div style="display:flex; flex-direction:column; max-width:85%; align-items:flex-start;">
            <div style="font-size:10px; color:var(--text-sub); margin-left:4px; margin-bottom:2px; font-weight:bold; display:flex; align-items:center;">${roleBadge}${finalDisplayName}</div>
            <div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>
        </div>
    `;
}

        // === 核心修复：如果是群聊，使用发言人的专属头像 ===
        let currentAiAvatarUrl = aiAvatarUrl;
        if (msg.speakerId && diaryAvatarCache[msg.speakerId]) {
            currentAiAvatarUrl = diaryAvatarCache[msg.speakerId];
        }

        html += `
            <div class="chat-bubble-row ${msg.role === 'user' ? 'me' : 'ai'}" data-ts="${msg.timestamp}">
                <div class="ms-checkbox"></div>
                ${msg.role === 'user' ? timeHtml : ''}
                ${msg.role === 'user' ? '' : `<div class="chat-bubble-avatar" style="${currentAiAvatarUrl ? `background-image:url(${currentAiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>`}
                ${finalBubbleBlock}
                ${msg.role === 'user' ? `<div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>` : timeHtml}
            </div>
        `;
    });

    const loadingEl = document.getElementById('chatLoadingBubble');
    if (loadingEl) html += loadingEl.outerHTML;

    area.innerHTML = html;
    
    // 如果不是点击加载更多，才滚到底部
    if (!isLoadMore) {
        area.scrollTop = area.scrollHeight;
    }
}

// 全局函数：加载更多聊天记录
window.loadMoreChatMessages = async function() {
    if (!currentChatContact) return;
    window.chatDisplayLimit += 30; // 每次往上翻增加30条
    const area = document.getElementById('chatMessageArea');
    const oldScrollHeight = area.scrollHeight; // 记住当前高度
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    await renderChatMessages(history, currentChatContact.id, true);
    
    // 恢复原来的阅读位置，防止刷新后瞬间掉回最底部
    const newScrollHeight = area.scrollHeight;
    area.scrollTop = newScrollHeight - oldScrollHeight;
};

// 神级防闪烁：阻止发送按钮抢夺焦点，让键盘稳稳停留在原地！
document.getElementById('sendChatBtn').addEventListener('touchstart', function(e) {
    e.preventDefault(); // 阻止默认的失去焦点行为
    this.click(); // 手动触发发送事件
}, {passive: false});
document.getElementById('sendChatBtn').addEventListener('mousedown', function(e) {
    e.preventDefault(); // 电脑端也阻止失去焦点
});

// 5. 发送消息与手动接收回复
document.getElementById('sendChatBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    const input = document.getElementById('chatInputContent');
    const content = input.value.trim();
    if (!content) return;
    
    input.value = ''; // 清空输入框
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    const ts = Date.now();
    let msgObj = { role: 'user', content, timestamp: ts };
    if (currentQuoteText) msgObj.quoteText = currentQuoteText;
    history.push(msgObj);
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    await updateContactPreview(currentChatContact.id, "我: " + content);

    // 获取我的专属头像
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const userRoleId = settings.userRoleId || '';
    let myAvatarUrl = '';
    if (userRoleId) {
        myAvatarUrl = diaryAvatarCache[userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[userRoleId] = myAvatarUrl;
        }
    }

    let quoteHtml = '';
    if (currentQuoteText) {
        const safeQuote = currentQuoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
    }
    let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// ★新增：发文字时，只要过了午夜12点就弹日期小字
let dateDividerHtml = '';
let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
if (lastMsgTs) {
    let lastD = new Date(lastMsgTs);
    if (lastD.getDate() !== md.getDate() || lastD.getMonth() !== md.getMonth() || lastD.getFullYear() !== md.getFullYear()) {
        dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
    }
}

const area = document.getElementById('chatMessageArea');
area.insertAdjacentHTML('beforeend', dateDividerHtml + `
    <div class="chat-bubble-row me new-pop" data-ts="${ts}">
            <div class="ms-checkbox"></div>
            <div class="chat-time-stamp">${tStr}</div>
            <div class="chat-bubble">${quoteHtml}${content}</div>
            <div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>
        </div>
    `);
    area.scrollTop = area.scrollHeight;
    
    // 发送完毕，重置引用预览框状态
    currentQuoteText = null;
    document.getElementById('chatQuotePreview').style.display = 'none';
});

// 点击笑脸图标，呼叫 TA (接收回复)
document.getElementById('chatAiReplyBtn').addEventListener('click', async () => {
    if (!currentChatContact) {
        showToast("请先进入一个频段");
        return;
    }
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    fetchChatAPI(currentChatContact.id, history);
});

async function fetchChatAPI(contactId, history) {
// === 拦截：如果是群聊，走专门的群聊通道 ===
let contacts = await loadFromDB('chat_contacts') || [];
let contactInfo = contacts.find(c => c.id === contactId);
if (contactInfo && contactInfo.isGroup) {
    return fetchGroupChatAPI(contactId, history, contactInfo);
}
// ======================================
    const area = document.getElementById('chatMessageArea');
    let aiAvatarUrl = diaryAvatarCache[contactId] || '';
    
    // 封装正在输入的打字状态显隐函数
    const showTyping = () => {
        if (document.getElementById('chatLoadingBubble')) return; // 防重复
        const loadingHtml = `
            <div class="chat-bubble-row ai" id="chatLoadingBubble">
                <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
                <div class="chat-bubble"><span style="color:var(--text-sub);font-size:13.5px;font-style:italic;letter-spacing:0.5px;">TA 正在输入...</span></div>
            </div>
        `;
        area.insertAdjacentHTML('beforeend', loadingHtml);
        area.scrollTop = area.scrollHeight;
    };
    
    const hideTyping = () => {
        document.getElementById('chatLoadingBubble')?.remove();
    };

// === 拦截器：检查日程表是否允许回复 ===
const aiName = document.getElementById('chatRoomTitle').innerText || 'TA';
const schedSettings = await loadFromDB(`chat_schedule_${contactId}`) || {};
if (schedSettings.enabled) {
    const status = checkIsOnline(schedSettings.schedule);
    const area = document.getElementById('chatMessageArea');
    if (status.status === 'offline') {
        // 红灯离线：插入系统消息，并拦截回复
        area.insertAdjacentHTML('beforeend', `<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin: 12px 0; font-weight: 600; letter-spacing: 1px;">${aiName} 已离线</div>`);
        area.scrollTop = area.scrollHeight;
        return;
    } else if (status.status === 'busy') {
        // 黄灯忙碌：插入系统消息，AI 依然会继续回复
        area.insertAdjacentHTML('beforeend', `<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin: 12px 0; font-weight: 600; letter-spacing: 1px;">${aiName} 正在忙碌</div>`);
        area.scrollTop = area.scrollHeight;
    }
}
    
    // 刚发起请求时，立刻显示“正在输入...”
    showTyping();

    const useSubApi = await loadFromDB('chatUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) {
        hideTyping();
        showToast('请先去设置中填写主节点 API Key！');
        return;
    }

    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === contactId);
    
    // 替换为动态构建的提示词（包含用户画像、连发要求等）
    const systemPrompt = await buildChatSystemPrompt(history);
    
    // 获取动态记忆上下文条数
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    const contextCount = settings.contextCount || 15;

    const contextHistory = history.slice(-contextCount).map(m => {
let textContent = m.content;
if (m.msgType === 'diary_invite') textContent = `[发送了交换日记的邀请，附言："${m.content}"]`;
if (m.msgType === 'forward_card') {
    let fwDetail = (m.forwardData || []).map(f => {
        let n = f.role === 'user' ? '我' : (f.speakerName || 'TA');
        let c = f.content || '[图片/特殊消息]';
        return `${n}: ${c}`;
    }).join(' | ');
    textContent = `[发送了一份合并聊天记录卡片，内含如下历史对话：{ ${fwDetail} }]`;
}
if (m.quoteText) textContent = `[引用回复了你的消息: "${m.quoteText}"]\n` + textContent;

    // ★给每条消息打上精确时间戳
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        let mm = (d.getMonth()+1).toString().padStart(2,'0');
        let dd = d.getDate().toString().padStart(2,'0');
        let hh = d.getHours().toString().padStart(2,'0');
        let mins = d.getMinutes().toString().padStart(2,'0');
        timeLabel = `[${mm}月${dd}日 ${hh}:${mins}] `;
    }
    textContent = timeLabel + textContent;
    
    if (m.imageUrl) {
        return {
            role: m.role,
            content: [
                { type: "text", text: textContent },
                { type: "image_url", image_url: { url: m.imageUrl } }
            ]
        };
    }
    return { role: m.role, content: textContent };
});
const messages = [{ role: 'system', content: systemPrompt }, ...contextHistory];

// 读取你在系统设置里保存的温度 (Temp)
const savedTemp = await loadFromDB('sysTemp');
const tempValue = (savedTemp !== undefined && savedTemp !== null) ? parseFloat(savedTemp) : 0.85;

try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        // 将发散度绑定为你设置的 Temp 值
        body: JSON.stringify({ model, messages, temperature: tempValue })
    });
        
if (!response.ok) {
    const errData = await response.text();
    throw new Error(`HTTP状态码 ${response.status} | 详细原因: ${errData}`);
}

const data = await response.json();

// 👇 新增：精准抓取官方 API 本次请求的真实 Token 消耗
if (data.usage) {
    let actualTokens = data.usage.total_tokens || 0;
    let promptTokens = data.usage.prompt_tokens || 0;
    await saveToDB(`last_actual_tokens_${contactId}`, { total: actualTokens, prompt: promptTokens });
}

let reply = data.choices[0].message.content.trim();
reply = reply.replace(/\[\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}\]\s*/g, '');
        
// === 终极防粘连切分逻辑 (完美兼容笨模型) ===
const safeReply = reply.replace(/(\[(QUOTE|LOCATION|REDPACKET|VOICE|DIARY_INVITE):.*?\])\s*\n+/gi, '$1 ');

let lines = [];

// 1. 如果模型听话，使用了 [气泡] 标记，就用气泡标记来切西瓜
if (safeReply.includes('[气泡]')) {
    lines = safeReply.split(/\[气泡\]/).map(s => s.trim()).filter(s => s !== '');
} 
// 2. 如果模型完全不听话，没打标记，甚至连换行都不打（大段落粘连发病期）
else {
    // 先尝试按普通的换行切一下
    lines = safeReply.split('\n').map(s => s.trim()).filter(s => s !== '');
    
    // 【终极防线】：如果切完之后只有1条，且字数很长(大于30字)，说明模型吐了一大坨文字！
    // 此时触发强制标点切分大法，强行把它切成微信短句！
    if (lines.length === 1 && lines[0].length > 30) {
        // 在句号、感叹号、问号、波浪号后面强制切开（保留标点符号）
        let forceSplitRegex = /([^。！？~…]+[。！？~…]+)/g;
        let matched = lines[0].match(forceSplitRegex);
        if (matched && matched.length > 1) {
            lines = matched.map(s => s.trim()).filter(s => s !== '');
        }
    }
}
// ============================================

// 模拟真人发微信，根据字数动态延迟，一条一条连发！
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // 除了第一条，后面的每条都要模拟打字延迟
    if (i > 0) {
        let delay = 600 + Math.min(line.length * 60, 2500);
        await new Promise(r => setTimeout(r, delay));
    }
            
// == 开始替换为这段解析代码 ==
let msgType = 'text';
let voiceDur = 0;
let rpAmt = 0;
let locName = '';
let cleanText = line;
let quoteText = null;

// 解析 AI 对日记邀请的自动回应
const aiDiaryRespMatch = cleanText.match(/\[日记(同意|拒绝)\]/i);
if (aiDiaryRespMatch) {
    const isAgree = aiDiaryRespMatch[1] === '同意';
if (isAgree) {
    let days = await loadFromDB(`pending_diary_days_${contactId}`) || 7;
    let books = await loadFromDB(`diary_books_${contactId}`) || [];
    // 兼容老数据迁移
    if (books.length === 0) {
        let oldAg = await loadFromDB(`diary_agreement_${contactId}`);
        if (oldAg) {
            let oldName = await loadFromDB(`diary_book_name_${contactId}`) || '交换日记';
            books.push({ id: 'default', name: oldName, days: oldAg.days||7, startTime: oldAg.startTime });
        }
    }
    // 添加一本全新从0起算的日记本！
    books.push({ id: 'book_'+Date.now(), name: '新交换日记', days: days, startTime: Date.now() });
    await saveToDB(`diary_books_${contactId}`, books);
    
    // 为了防止老系统崩溃，顺带写一份假契约安抚它
    saveToDB(`diary_agreement_${contactId}`, { agreed: true, days: days, startTime: Date.now() });
}
const aiName = document.getElementById('chatRoomTitle').innerText || 'TA';
    const sysText = isAgree ? `${aiName} 同意了你的日记邀请` : `${aiName} 婉拒了你的日记邀请`;
    const tsSys = Date.now() + i + 50;
    
    // 存入历史记录
    history.push({ role: 'system', content: sysText, timestamp: tsSys });
    
    // 在界面上渲染灰色小字
    const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsSys}"><span class="chat-system-msg-text">${sysText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
    
    // 把暗号从 AI 的气泡里抹掉
    cleanText = cleanText.replace(/\[日记(同意|拒绝)\]/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

// 解析 AI 发出的戳一戳动作
const aiPokeMatch = cleanText.match(/\[POKE:(.*?)\]/i);
if (aiPokeMatch) {
    const pokeText = aiPokeMatch[1].trim();
    const tsPoke = Date.now() + i;
    history.push({ role: 'system', content: pokeText, timestamp: tsPoke });
    await saveToDB(`chat_history_${contactId}`, history);
    
    const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsPoke}"><span class="chat-system-msg-text">${pokeText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
    
    cleanText = cleanText.replace(/\[POKE:.*?\]/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

const quoteMatch = cleanText.match(/\[QUOTE:(.*?)\]([\s\S]*)/i);
if (quoteMatch) {
    quoteText = quoteMatch[1].trim();
    cleanText = quoteMatch[2].trim();
}

const voiceMatch = cleanText.match(/\[VOICE:(\d+)\](.*)/i);
const rpMatch = line.match(/\[REDPACKET:([\d\.]+)\](.*)/i);
const locMatch = cleanText.match(/\[LOCATION:(.*?)\](.*)/i);
const inviteMatch = cleanText.match(/\[DIARY_INVITE:(.*?)\](.*)/i);
let proposedName = '';

if (voiceMatch) { msgType = 'voice'; voiceDur = parseInt(voiceMatch[1]); cleanText = voiceMatch[2].trim(); } 
else if (rpMatch) { msgType = 'redpacket'; rpAmt = parseFloat(rpMatch[1]); cleanText = rpMatch[2].trim(); }
else if (locMatch) { msgType = 'location'; locName = locMatch[1].trim(); cleanText = locMatch[2].trim(); }
else if (inviteMatch) { msgType = 'diary_invite'; cleanText = inviteMatch[1].trim(); }
else if (cleanText.includes('[日记提议:')) {
    const match = cleanText.match(/\[日记提议:(.*?)\]([\s\S]*)/i);
    if (match) { msgType = 'rename_proposal'; proposedName = match[1].trim(); cleanText = match[2].trim(); }
}

const ts = Date.now();
history.push({ 
    role: 'assistant', 
    speakerId: typeof speakerInfo !== 'undefined' ? speakerInfo.id : undefined, 
    speakerName: typeof speakerName !== 'undefined' ? speakerName : undefined, 
    content: cleanText, 
    msgType: msgType, 
    voiceDuration: voiceDur, 
    rpAmount: rpAmt, 
    locationName: locName, 
    quoteText: quoteText, 
    proposedName: proposedName, 
    timestamp: ts 
});
await saveToDB(`chat_history_${contactId}`, history);

// --- 改为局部追加，避免闪屏 ---
let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// ★新增：AI单聊回复时，只要跨天就弹日期
let dateDividerHtml = '';
if (i === 0) {
    let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
    if (lastMsgTs) {
        let lastD = new Date(lastMsgTs);
        if (lastD.getDate() !== md.getDate() || lastD.getMonth() !== md.getMonth() || lastD.getFullYear() !== md.getFullYear()) {
            dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
        }
    }
}

let timeHtml = `<div class="chat-time-stamp" ${['voice', 'redpacket', 'location', 'diary_invite', 'forward_card'].includes(msgType) ? 'style="display:none;"' : ''}>${tStr}</div>`;
let innerTimeHtml = `<div class="chat-time-stamp" style="margin: 0 4px; align-self: flex-end; padding-bottom: 2px;">${tStr}</div>`;
let formattedCleanText = (cleanText || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<div class="bilingual-trans">$1</div>');
formattedCleanText = formattedCleanText.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">$1</div></div>');

// 解析表情包
const allStickerGroupsAPI = await loadFromDB('sticker_groups') || [];
const allStickersAPI = allStickerGroupsAPI.flatMap(g => g.stickers);

let isPureStickerAPI = false;
let stickerUrlAPI = '';
const stickerMatchAPI = cleanText.match(/^\[表情包[:：](.*?)\]$/i);
if (stickerMatchAPI) {
    const sticker = allStickersAPI.find(s => s.name === stickerMatchAPI[1].trim());
    if (sticker) {
        isPureStickerAPI = true;
        stickerUrlAPI = sticker.url;
    }
}

let isPureFakeImgAPI = false;
let fakeImgDescAPI = '';
const fakeImgMatchAPI = cleanText.match(/^\[图片[:：]\s*([\s\S]*?)\]$/i);
if (fakeImgMatchAPI) {
    isPureFakeImgAPI = true;
    fakeImgDescAPI = fakeImgMatchAPI[1].trim();
}

// 【升级版容错拦截】
formattedCleanText = formattedCleanText.replace(/[\(（]【?发送了?表情包[:：]?\s*(.*?)】?[\)）]/g, '[表情包:$1]');
formattedCleanText = formattedCleanText.replace(/\[\[STICKER:(.*?)\]\]/gi, '[表情包:$1]');

formattedCleanText = formattedCleanText.replace(/\[表情包[:：](.*?)\]/gi, (match, name) => {
    let cleanName = name.split(/[\/\-：:]/).pop().trim();
    // 模糊匹配
    const sticker = allStickersAPI.find(s => s.name === cleanName || name.includes(s.name) || s.name.includes(cleanName));
    if (sticker) {
        return `<img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 4px 0;">`;
    }
    return `<span style="color:var(--text-sub); font-style:italic;">（发送了表情包：${name}）</span>`;
});
    
let contentHtml = '';
let bubbleStyle = '';

if (msgType === 'voice') {
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-voice-bubble" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                <span>${voiceDur}"</span>
            </div>
            ${innerTimeHtml}
        </div>
        <div class="chat-voice-trans" style="display:none;">${formattedCleanText}</div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msgType === 'redpacket') {
    const safeContent = (cleanText || '心意红包').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-rp-bubble" onclick="openRedPacketModal(this, '${safeContent}', ${rpAmt})" style="cursor:pointer;">
                <div class="rp-top">
                    <div class="rp-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><circle cx="12" cy="14" r="3"></circle><path d="M4 8h16"></path></svg></div>
                    <div class="rp-info">
                        <div class="rp-msg">${cleanText}</div>
                        <div class="rp-amt">查看红包</div>
                    </div>
                </div>
                <div class="rp-bottom">LUMINA TRANSFER</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msgType === 'location') {
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-location-bubble">
                <div class="loc-top">
                    <div class="loc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>
                    <div class="loc-info"><div class="loc-name">${locName}</div></div>
                </div>
                <div class="loc-desc">${cleanText}</div>
                <div class="loc-bottom">LUMINA MAPS</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msgType === 'diary_invite') {
    let safeContent = (cleanText || '').replace(/'/g, "\\'");
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-diary-invite-bubble" onclick="handleDiaryInviteClick('assistant', '${safeContent}', currentChatContact.id, ${ts})" style="cursor:pointer;">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 2v8l3-2 3 2V2"/></svg></div>
                    <div class="di-info"><div class="di-msg">交换日记邀请</div><div class="di-hint">${cleanText}</div></div>
                </div>
                <div class="di-bottom">LUMINA DIARY</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
    } else if ((typeof msgType !== 'undefined' && msgType === 'rename_invite') || (typeof msg !== 'undefined' && msg.msgType === 'rename_invite')) {
    let _content = typeof msg !== 'undefined' ? msg.content : cleanText;
    let _role = typeof msg !== 'undefined' ? msg.role : 'user';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameInviteClick('${_role}', '${(_content||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
                    <div class="di-info"><div class="di-msg">邀请给日记本起名</div><div class="di-hint">${_content}</div></div>
                </div>
                <div class="di-bottom" style="color:var(--text-sub);">点击呼叫 TA 思考</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if ((typeof msgType !== 'undefined' && msgType === 'rename_proposal') || (typeof msg !== 'undefined' && msg.msgType === 'rename_proposal')) {
    let _name = typeof msg !== 'undefined' ? msg.proposedName : proposedName;
    let _role = typeof msg !== 'undefined' ? msg.role : 'assistant';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameProposalClick('${_role}', '${(_name||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon" style="color:#8BA888; background:rgba(139,168,136,0.15);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                    <div class="di-info"><div class="di-msg" style="color:#8BA888;">日记本起名提议</div><div class="di-hint">我想叫它：${_name}</div></div>
                </div>
                <div class="di-bottom">点击确认使用此名字</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureStickerAPI) {
    contentHtml = `<img src="${stickerUrlAPI}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureFakeImgAPI) {
    contentHtml = `<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">${fakeImgDescAPI}</div></div>`;
    bubbleStyle = `class="chat-special-bubble"`;
} else {
    contentHtml = formattedCleanText;
    bubbleStyle = `class="chat-bubble"`; 
}

            // 生成 AI 自己的引用框 HTML
            let quoteHtml = '';
            if (quoteText) {
                const safeQuote = quoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
            }

let currentAiName = document.getElementById('chatRoomTitle').innerText || 'TA';
let roleBadge = '';

            const newRowHtml = dateDividerHtml + `
    <div class="chat-bubble-row ai new-pop" data-ts="${ts}">
                    <div class="ms-checkbox"></div>
                    <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
                    <div style="display:flex; flex-direction:column; max-width:85%; align-items:flex-start;">
                        <div style="font-size:10px; color:var(--text-sub); margin-left:4px; margin-bottom:2px; font-weight:bold; display:flex; align-items:center;">${roleBadge}${currentAiName}</div>
                        <div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>
                    </div>
                    ${timeHtml}
                </div>
            
`;

const area = document.getElementById('chatMessageArea');
const loadingEl = document.getElementById('chatLoadingBubble');
if (loadingEl) {
    loadingEl.insertAdjacentHTML('beforebegin', newRowHtml);
} else {
    area.insertAdjacentHTML('beforeend', newRowHtml);
}
area.scrollTop = area.scrollHeight;

let purePreviewText = cleanText.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '').trim();
let preText = '';
if (msgType === 'voice') preText = `[语音] ${purePreviewText}`;
else if (msgType === 'redpacket') preText = `[红包] ${purePreviewText}`;
else if (msgType === 'location') preText = `[定位] ${locName}`;
else preText = purePreviewText;
await updateContactPreview(contactId, preText);
// == 替换结束 ==

 
        }
        
hideTyping(); // 所有的消息连发完毕后，彻底隐藏正在输入气泡
checkAndTriggerMemorySummary(contactId); // 然后在后台静默检查总结记忆
    } catch (e) {
    hideTyping();
    
    // 提取真正的报错信息
    const errorMsg = "⚠️ 节点 API 报错拦截：\n" + e.message;
    
    // 把它存进本地聊天记录，方便以后查看
    history.push({ role: 'assistant', content: errorMsg, timestamp: Date.now() });
    await saveToDB(`chat_history_${contactId}`, history);
    
    // 生成一个红色的警告气泡显示在屏幕上
        const area = document.getElementById('chatMessageArea');
    area.insertAdjacentHTML('beforeend', `
        <div class="chat-bubble-row ai" data-ts="${Date.now()}">
            <div class="ms-checkbox"></div>
            <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
            <div class="chat-bubble" style="color: #D67A7A; background: #FFF0F0; border: 1px dashed #D67A7A;">${errorMsg}</div>
        </div>
    `);
    area.scrollTop = area.scrollHeight;
    
    // 更新列表最后一条消息预览
    await updateContactPreview(contactId, "[系统报错记录]");
}
}

async function updateContactPreview(contactId, text) {
    let contacts = await loadFromDB('chat_contacts') || [];
    let contact = contacts.find(c => c.id === contactId);
    if (contact) {
        contact.lastMessage = text;
        contact.lastTime = Date.now();
        await saveToDB('chat_contacts', contacts);
        renderChatSessionList();
    }
}

// ==========================================
// 全新：群聊专属核心推演引擎
// ==========================================
async function fetchGroupChatAPI(contactId, history, contactInfo) {
    const area = document.getElementById('chatMessageArea');
    
    // 显示加载气泡 (支持指定名字)
    const showTyping = (name = null) => {
        if (document.getElementById('chatLoadingBubble')) return;
        const text = name ? `${name} 正在输入...` : '群成员正在输入...';
        area.insertAdjacentHTML('beforeend', `
            <div class="chat-bubble-row ai" id="chatLoadingBubble">
                <div class="chat-bubble"><span style="color:var(--text-sub);font-size:13.5px;font-style:italic;letter-spacing:0.5px;">${text}</span></div>
            </div>
        `);
        area.scrollTop = area.scrollHeight;
    };
    const hideTyping = () => document.getElementById('chatLoadingBubble')?.remove();

    showTyping();

    const allChars = await loadFromDB('ai_characters') || [];
    const members = allChars.filter(c => contactInfo.members.includes(c.id));
    if (members.length === 0) { hideTyping(); return; }

    // ★新增：获取禁言名单，并在设定里警告 AI
    const now = Date.now();
    const mutedData = contactInfo.muted || {};
    const mutedMembers = Object.keys(mutedData).filter(id => mutedData[id] > now);

    let memberDesc = members.map(m => {
    let muteWarning = mutedMembers.includes(m.id) ? ' 【⚠️该成员当前已被管理员禁言，你绝对不能代替该角色发言！】' : '';
    let roleStr = '';
    if (contactInfo.owner === m.id) roleStr = ' (群主)';
    else if ((contactInfo.admins || []).includes(m.id)) roleStr = ' (管理员)';
    
    
    return `- 名字: ${m.name}${roleStr} | 设定: ${m.prompt}${muteWarning}`;
}).join('\n');

    const useSubApi = await loadFromDB('chatUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) { hideTyping(); showToast('未配置 API Key'); return; }

    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    const rCount = settings.replyCount || '';
    let replyCountText = '';
    
    if (rCount === '') {
        replyCountText = `3. 【强硬要求】：请根据语境自由决定生成的聊天气泡条数。`;
    } else if (rCount.includes('-')) {
        let parts = rCount.split('-');
        replyCountText = `3. 【强硬要求】：本次回复你必须精确且严格地生成 ${parts[0].trim()} 到 ${parts[1].trim()} 条独立的聊天气泡！`;
    } else {
        replyCountText = `3. 【强硬要求】：本次回复你必须精确且严格地生成 ${rCount.trim()} 条独立的聊天气泡！`;
    }

    // 获取表情包库，让AI知道发什么
const allStickerGroupsAPI = await loadFromDB('sticker_groups') || [];
// 容错 1：防止 g.stickers 是空值导致 flatMap 崩溃
const allStickersAPI = allStickerGroupsAPI.flatMap(g => g.stickers || []);

// ======== 新增：群聊成员表情包权限精确控制 ========
const memberStickers = settings.memberStickers || {};
let stickerRules = [];

members.forEach(m => {
    // 容错 2：防止读取出来的权限列表损坏不是数组
    let allowedGids = memberStickers[m.id];
    if (!Array.isArray(allowedGids)) allowedGids = [];
    
    if (allowedGids.length > 0) {
        let mStickers = [];
        allStickerGroupsAPI.forEach(g => {
            // 容错 3：只有当 g.stickers 是真正的数组时才遍历，杜绝死机
            if (allowedGids.includes(g.id) && Array.isArray(g.stickers)) {
                g.stickers.forEach(s => mStickers.push(s.name));
            }
        });
        if (mStickers.length > 0) {
            // 生成具体某人的专属白名单
            stickerRules.push(`【${m.name}】被允许使用的表情包有：${mStickers.join(', ')}`);
        }
    }
});

let stickerAiPrompt = '';
if (stickerRules.length > 0) {
    stickerAiPrompt = `\n7. 【表情包系统】：如果要发表情，格式必须严格为：[表情包:名称]。\n【权限警告】：\n${stickerRules.join('\n')}\n(注意：未被明确允许拥有表情包的角色，绝对禁止发送任何表情包！请严格遵守！)`;
} else {
    stickerAiPrompt = `\n7. 【表情包系统】：本群当前已禁用 AI 发送表情包功能，绝对禁止任何角色发送表情包！`;
}
// ===================================================

    // ★★★ 核心修复：把指令集（世界书/规则）和双语翻译开关正式接入群聊！ ★★★
    const commands = await loadFromDB('ai_commands') || [];
    const boundCmdIds = settings.boundCommands || [];
    const activeCmds = commands.filter(c => c.isGlobal || boundCmdIds.includes(c.id));
    
    let frontCmdText = '';
    let backCmdText = '';
    if (activeCmds.length > 0) {
        activeCmds.forEach(c => {
            if (c.position === 'back') backCmdText += `\n【附加指令 - ${c.name}】：\n${c.content}`;
            else frontCmdText += `\n【附加设定 - ${c.name}】：\n${c.content}`;
        });
    }

    const bilingualText = settings.bilingual ? `\n8. 【最高强制指令 - 翻译思维链】：每次输出前，请先在内部逻辑中执行“语言属性检测”：1. 确认即将输出的句子是否包含英语、日语、粤语等非普通话。2. 若包含，必须在含有外语/方言的句末，附加严格格式的翻译。格式必须且只能是：[译: 标准普通话翻译]。严禁自创格式（如(翻译: xxx)、[EN: xxx]）！示例：What a beautiful day! [译: 今天天气真不错！]` : '';

    // ==== 新增修复：让群聊也能读取自动总结的记忆，并开启关键词雷达 ====
    const allMemories = await loadFromDB(`chat_memories_${contactId}`) || [];
    const activeMemories = allMemories.filter(m => !m.isArchived);
    const archivedMemories = allMemories.filter(m => m.isArchived && m.triggerKeys);
    
    // 雷达扫描：抓取你最近发送的3条消息，看有没有触发归档里的旧日关键词
    const recentUserMsgs = history.filter(m => m.role === 'user').slice(-3).map(m => m.content).join(' ');
    let awakenedMemories = [];
    if (recentUserMsgs) {
        archivedMemories.forEach(mem => {
            const keys = mem.triggerKeys.split(/[,，、]/).map(k => k.trim()).filter(k => k);
            for (let key of keys) {
                if (recentUserMsgs.includes(key)) {
                    awakenedMemories.push(mem.content);
                    break;
                }
            }
        });
    }
    let radarText = awakenedMemories.length > 0 ? `\n\n【被当前对话触动唤醒的旧日记忆】（这让大家回想起了这些往事）：\n${awakenedMemories.join('\n')}` : '';
    const memoryText = (activeMemories.length > 0 || awakenedMemories.length > 0) 
        ? `\n【往期剧情与常驻记忆】：\n${activeMemories.map(m => m.content).join('\n')}${radarText}` 
        : '';
    // ==============================================================

    const sysPrompt = `你是一个多角色群聊推演引擎。正在模拟的群聊是：【${contactInfo.name}】。
【群内角色名单与设定】：
${memberDesc}
${memoryText}
${frontCmdText}

【核心推演与意识指令】：
1. 群里的每个人都是有独立生活、情绪波动的真实人类。在发言前，请先深度检索该角色的国籍、时代与文化背景。ta的母语是什么？请自动且坚定地使用符合ta背景的语言、方言或专属口癖，拒绝被统一的现代普通话同化。
2. 彻底抛弃教科书式的反应！请自行推演每个角色在群聊生态中的真实表现。
   - 思考：ta的核心性格是什么？ta是个话痨还是习惯潜水？ta喜欢如何表达？
   - ta的标点符号习惯、说话节奏、长短句分布，都必须是真实人性的“自然流露”，绝不机械套用公式。
3. 如果角色拥有(群主)或(管理员)标签，思考ta的性格是否喜欢滥用权力？会不会因为小事、吃醋或纯粹为了开玩笑而故意禁言别人？如果角色拥有表情包权限，思考ta的发图频率和风格。一切交互行为都必须符合该角色的人设底色！
4. 真实群聊不需要每个人都像开会一样轮流发言！允许打错字、用语气词、互相拌嘴甚至争吵。多用口语化短句，如果话没说完，直接用换行符分隔，系统会切分成多条气泡连发。
${replyCountText.replace(/^\d+\.\s*/, '')}
5. 想发语音格式：[VOICE:秒数]语音文字。发送图片格式：[图片:图片画面的详细描述]。发红包：[REDPACKET:金额]留言。发定位：[LOCATION:地点]留言。极低概率下想戳一戳某人，单起一行：[POKE:动作描述] (如: [POKE:张三揉了揉李四的脑袋])，严禁频繁使用！引用回复格式：[QUOTE:被引用的原话]回复。${stickerAiPrompt}
6. 若角色的性格和当前情绪决定了ta要禁言某人（且ta拥有群主/管理员权限），单起一行输出：[禁言:对方名字:秒数]理由。【警告：必须根据角色的愤怒/开玩笑程度，亲自决定具体秒数(如300, 3600, 86400等，永久填0)】。只能禁言下级普通群员。
7. 绝对不要使用 JSON！严格遵守纯文本格式输出：
   - 每一个独立的气泡之间必须用 === 分隔。
   - 每一个气泡的第一行必须是你指定的发言人的名字，用中括号括起来，例如：[张三]。第二行开始是正文内容。${bilingualText}
${backCmdText}`;

// 改造 1：不要直接 join 成纯文本，而是组装成多模态支持的数组
let finalUserContent = [{ type: "text", text: "最近的群聊记录如下：\n" }];

history.slice(-15).forEach(m => {
    let speaker = m.role === 'user' ? '我' : (m.speakerName || contactInfo.name || '神秘群员');
    let textContent = m.content;
    if (m.msgType === 'diary_invite') textContent = `[发送了交换日记的邀请，附言："${m.content}"]`;
    if (m.msgType === 'forward_card') {
    let fwDetail = (m.forwardData || []).map(f => {
        let n = f.role === 'user' ? '我' : (f.speakerName || 'TA');
        let c = f.content || '[图片/特殊消息]';
        return `${n}: ${c}`;
    }).join(' | ');
    textContent = `[发送了一份合并聊天记录卡片，内含如下历史对话：{ ${fwDetail} }]`;
}

    // ★给每条消息打上精确时间戳
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        let mm = (d.getMonth()+1).toString().padStart(2,'0');
        let dd = d.getDate().toString().padStart(2,'0');
        let hh = d.getHours().toString().padStart(2,'0');
        let mins = d.getMinutes().toString().padStart(2,'0');
        timeLabel = `[${mm}月${dd}日 ${hh}:${mins}] `;
    }

    // 拼接文字部分
    finalUserContent.push({ type: "text", text: `${timeLabel}${speaker}: ${textContent}\n` });
    
    // 如果有图片，直接把图片对象塞进数组供 AI 读取
    if (m.imageUrl) {
        finalUserContent.push({
            type: "image_url",
            image_url: { url: m.imageUrl }
        });
    }
});

try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: sysPrompt },
                // 改造 2：这里把刚才组装好的多模态数组直接传给 user
                { role: "user", content: finalUserContent }
            ],
            temperature: (await loadFromDB('sysTemp') != null) ? parseFloat(await loadFromDB('sysTemp')) : 0.9
        })
    });

        if (!response.ok) throw new Error("API 请求失败");

        const data = await response.json();
        let reply = data.choices[0].message.content.trim();
reply = reply.replace(/\[\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}\]\s*/g, '');
        
        const initialBubbles = reply.split('===').map(b => b.trim()).filter(b => b);
const bubbles = [];
initialBubbles.forEach(b => {
    let nameMatch = b.match(/^\[(.*?)\]/);
    let name = nameMatch ? nameMatch[1].trim() : '神秘群员';
    let text = nameMatch ? b.replace(/^\[.*?\]\s*/, '').trim() : b;
    
    // === 新增修复：防止引用等功能框和正文被大模型的换行强行切断 ===
    text = text.replace(/(\[(QUOTE|LOCATION|REDPACKET|VOICE|DIARY_INVITE):.*?\])\s*\n+/gi, '$1 ');

    // ★ 核心修复：强行合并被大模型意外换行的双语翻译标签，防止它变成空壳孤儿气泡导致点击不生效！
    text = text.replace(/\n+\s*(\[(?:译|翻译|EN|En|Eng)[:：].*?\])/gi, ' $1');

    // 强行把同一个人的回车换行，全部切成独立连发的连珠炮气泡！
    text.split('\n').map(l => l.trim()).filter(l => l).forEach(line => {
        bubbles.push(`[${name}]\n${line}`);
    });
});

        for (let i = 0; i < bubbles.length; i++) {
            let bubble = bubbles[i];
            
let speakerName = '神秘群员';
let rawContent = bubble;
const nameMatch = bubble.match(/^\[(.*?)\]/);
if (nameMatch) {
    speakerName = nameMatch[1].trim();
    rawContent = bubble.replace(/^\[.*?\]\s*/, '').trim(); 
}

let speakerInfo = members.find(m => m.name === speakerName); 
            if (!speakerInfo) {
                const matches = members.filter(m => m.name.includes(speakerName) || speakerName.includes(m.name));
                if (matches.length > 0) {
                    matches.sort((a, b) => b.name.length - a.name.length); 
                    speakerInfo = matches[0];
                }
            }
            if (!speakerInfo) speakerInfo = members[0]; 
            speakerName = speakerInfo.name;

            // ★新增：如果AI还是产生了幻觉想代替被禁言的人说话，我们直接在这里把这层泡泡物理抹杀掉！
            if (mutedMembers.includes(speakerInfo.id)) {
                console.log(`已物理拦截被禁言群员的发言: ${speakerName}`);
                continue; 
            }

            hideTyping(); 
            showTyping(speakerName); 
            
            let delay = (i === 0) ? 600 : 800 + Math.min(rawContent.length * 40, 2000);
            await new Promise(r => setTimeout(r, delay));
            

            // 解析特殊内容
let msgType = 'text';
let voiceDur = 0;
let rpAmt = 0;
let locName = '';
let cleanText = rawContent;
let quoteText = null;

// 解析 AI 发出的禁言动作
let isSpeakerAdmin = (contactInfo.owner === speakerInfo.id) || (contactInfo.admins && contactInfo.admins.includes(speakerInfo.id));
const aiMuteMatch = cleanText.match(/\[禁言:(.*?)(?::(\d+))?\](.*)/i);
if (aiMuteMatch && isSpeakerAdmin) {
    const targetName = aiMuteMatch[1].trim();
    // 如果它忘了写秒数，给个随机惩罚(1分钟到1小时不等)
const muteSecs = aiMuteMatch[2] ? parseInt(aiMuteMatch[2]) : (Math.floor(Math.random() * (3600 - 60 + 1)) + 60); 
    const muteReason = aiMuteMatch[3].trim();
    
    const targetInfo = members.find(m => m.name === targetName || m.name.includes(targetName));
    if (targetInfo) {
        let tRole = (contactInfo.owner === targetInfo.id) ? 2 : ((contactInfo.admins && contactInfo.admins.includes(targetInfo.id)) ? 1 : 0);
        let sRole = (contactInfo.owner === speakerInfo.id) ? 2 : 1;
        // 权限判断：上级才能禁言下级
        if (sRole > tRole) {
            let contactsDb = await loadFromDB('chat_contacts') || [];
            let cInfoDb = contactsDb.find(c => c.id === contactId);
            if (cInfoDb) {
                let mutedData = cInfoDb.muted || {};
                mutedData[targetInfo.id] = muteSecs === 0 ? Date.now() + 100 * 365 * 24 * 3600000 : Date.now() + muteSecs * 1000;
                cInfoDb.muted = mutedData;
                contactInfo.muted = mutedData;
                await saveToDB('chat_contacts', contactsDb);
            }
            let sysText = `${targetInfo.name} 被 ${speakerName} 禁言 ${formatMuteTime(muteSecs)}。理由：${muteReason}`;
            const tsMute = Date.now() + i + 10;
            history.push({ role: 'system', content: sysText, timestamp: tsMute });
            await saveToDB(`chat_history_${contactId}`, history);
            const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsMute}"><span class="chat-system-msg-text" style="color:#D67A7A; background:#FFF0F0;">${sysText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
        }
    }
    cleanText = cleanText.replace(/\[禁言:.*?\].*/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

// 解析 AI 发出的戳一戳动作
const aiPokeMatch = cleanText.match(/\[POKE:(.*?)\]/i);
if (aiPokeMatch) {
    const pokeText = aiPokeMatch[1].trim();
    const tsPoke = Date.now() + i;
    history.push({ role: 'system', content: pokeText, timestamp: tsPoke });
    await saveToDB(`chat_history_${contactId}`, history);
    
    const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsPoke}"><span class="chat-system-msg-text">${pokeText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
    
    cleanText = cleanText.replace(/\[POKE:.*?\]/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

const quoteMatch = cleanText.match(/\[QUOTE:(.*?)\]([\s\S]*)/i);
            if (quoteMatch) { quoteText = quoteMatch[1].trim(); cleanText = quoteMatch[2].trim(); }

            const voiceMatch = cleanText.match(/\[VOICE:(\d+)\](.*)/i);
            const rpMatch = cleanText.match(/\[REDPACKET:([\d\.]+)\](.*)/i);
            const locMatch = cleanText.match(/\[LOCATION:(.*?)\](.*)/i);
const inviteMatch = cleanText.match(/\[DIARY_INVITE:(.*?)\](.*)/i);
let proposedName = '';

            if (voiceMatch) { msgType = 'voice'; voiceDur = parseInt(voiceMatch[1]); cleanText = voiceMatch[2].trim(); } 
            else if (rpMatch) { msgType = 'redpacket'; rpAmt = parseFloat(rpMatch[1]); cleanText = rpMatch[2].trim(); }
            else if (locMatch) { msgType = 'location'; locName = locMatch[1].trim(); cleanText = locMatch[2].trim(); }
else if (inviteMatch) { msgType = 'diary_invite'; cleanText = inviteMatch[1].trim(); }
else if (cleanText.includes('[日记提议:')) {
    const match = cleanText.match(/\[日记提议:(.*?)\]([\s\S]*)/i);
    if (match) { msgType = 'rename_proposal'; proposedName = match[1].trim(); cleanText = match[2].trim(); }
}

            const ts = Date.now() + i; 
            history.push({ role: 'assistant', speakerId: speakerInfo ? speakerInfo.id : undefined, speakerName: speakerName ? speakerName : undefined, content: cleanText, msgType: msgType, voiceDuration: voiceDur, rpAmount: rpAmt, locationName: locName, quoteText: quoteText, proposedName: proposedName, timestamp: ts });
            await saveToDB(`chat_history_${contactId}`, history);

            let aiAvatarUrl = diaryAvatarCache[speakerInfo.id];
            if (!aiAvatarUrl) {
                const f = await loadFromDB(`char_avatar_${speakerInfo.id}`);
                aiAvatarUrl = f ? URL.createObjectURL(f) : '';
                diaryAvatarCache[speakerInfo.id] = aiAvatarUrl;
            }

            let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// ★新增：AI群聊回复时跨天检测
let dateDividerHtml = '';
if (i === 0) {
    let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
    if (lastMsgTs) {
        let lastD = new Date(lastMsgTs);
        if (lastD.getDate() !== md.getDate() || lastD.getMonth() !== md.getMonth() || lastD.getFullYear() !== md.getFullYear()) {
            dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
        }
    }
}

let timeHtml = `<div class="chat-time-stamp" ${['voice', 'redpacket', 'location', 'diary_invite', 'forward_card'].includes(msgType) ? 'style="display:none;"' : ''}>${tStr}</div>`;
            let innerTimeHtml = `<div class="chat-time-stamp" style="margin: 0 4px; align-self: flex-end; padding-bottom: 2px;">${tStr}</div>`;
            let formattedCleanText = (cleanText || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<div class="bilingual-trans">$1</div>');
formattedCleanText = formattedCleanText.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">$1</div></div>');

            let isPureStickerAPI = false;
let stickerUrlAPI = '';
const stickerMatchAPI = cleanText.match(/^\[表情包[:：](.*?)\]$/i);
if (stickerMatchAPI) {
    const sticker = allStickersAPI.find(s => s.name === stickerMatchAPI[1].trim());
    if (sticker) {
        isPureStickerAPI = true;
        stickerUrlAPI = sticker.url;
    }
}

let isPureFakeImgAPI = false;
let fakeImgDescAPI = '';
const fakeImgMatchAPI = cleanText.match(/^\[图片[:：]\s*([\s\S]*?)\]$/i);
if (fakeImgMatchAPI) {
    isPureFakeImgAPI = true;
    fakeImgDescAPI = fakeImgMatchAPI[1].trim();
}

formattedCleanText = formattedCleanText.replace(/[\(（]【?发送了?表情包[:：]?\s*(.*?)】?[\)）]/g, '[表情包:$1]');
            formattedCleanText = formattedCleanText.replace(/\[\[STICKER:(.*?)\]\]/gi, '[表情包:$1]');
            formattedCleanText = formattedCleanText.replace(/\[表情包[:：](.*?)\]/gi, (match, name) => {
                let cleanName = name.split(/[\/\-：:]/).pop().trim();
                const sticker = allStickersAPI.find(s => s.name === cleanName || name.includes(s.name) || s.name.includes(cleanName));
                if (sticker) {
                    return `<img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 4px 0;">`;
                }
                return `<span style="color:var(--text-sub); font-style:italic;">（发送了表情包：${name}）</span>`;
            });

            let contentHtml = '';
            let bubbleStyle = '';

            if (msgType === 'voice') {
                contentHtml = `
                    <div style="display:flex; align-items:flex-end; gap:4px;">
                        <div class="chat-voice-bubble" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                            <span>${voiceDur}"</span>
                        </div>
                        ${innerTimeHtml}
                    </div>
                    <div class="chat-voice-trans" style="display:none;">${formattedCleanText}</div>
                `;
                bubbleStyle = `class="chat-special-bubble"`;
            } else if (msgType === 'redpacket') {
                const safeContent = (cleanText || '心意红包').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                contentHtml = `
                    <div style="display:flex; align-items:flex-end; gap:4px;">
                        <div class="chat-rp-bubble" onclick="openRedPacketModal(this, '${safeContent}', ${rpAmt})" style="cursor:pointer;">
                            <div class="rp-top">
                                <div class="rp-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><circle cx="12" cy="14" r="3"></circle><path d="M4 8h16"></path></svg></div>
                                <div class="rp-info">
                                    <div class="rp-msg">${cleanText}</div>
                                    <div class="rp-amt">查看红包</div>
                                </div>
                            </div>
                            <div class="rp-bottom">LUMINA TRANSFER</div>
                        </div>
                        ${innerTimeHtml}
                    </div>
                `;
                bubbleStyle = `class="chat-special-bubble"`;
            } else if (msgType === 'location') {
                contentHtml = `
                    <div style="display:flex; align-items:flex-end; gap:4px;">
                        <div class="chat-location-bubble">
                            <div class="loc-top">
                                <div class="loc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>
                                <div class="loc-info"><div class="loc-name">${locName}</div></div>
                            </div>
                            <div class="loc-desc">${cleanText}</div>
                            <div class="loc-bottom">LUMINA MAPS</div>
                        </div>
                        ${innerTimeHtml}
                    </div>
                `;
                bubbleStyle = `class="chat-special-bubble"`;
            } else if (msgType === 'diary_invite') {
    let safeContent = (cleanText || '').replace(/'/g, "\\'");
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-diary-invite-bubble" onclick="handleDiaryInviteClick('assistant', '${safeContent}', currentChatContact.id, ${ts})" style="cursor:pointer;">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 2v8l3-2 3 2V2"/></svg></div>
                    <div class="di-info"><div class="di-msg">交换日记邀请</div><div class="di-hint">${cleanText}</div></div>
                </div>
                <div class="di-bottom">LUMINA DIARY</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
    } else if ((typeof msgType !== 'undefined' && msgType === 'rename_invite') || (typeof msg !== 'undefined' && msg.msgType === 'rename_invite')) {
    let _content = typeof msg !== 'undefined' ? msg.content : cleanText;
    let _role = typeof msg !== 'undefined' ? msg.role : 'user';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameInviteClick('${_role}', '${(_content||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
                    <div class="di-info"><div class="di-msg">邀请给日记本起名</div><div class="di-hint">${_content}</div></div>
                </div>
                <div class="di-bottom" style="color:var(--text-sub);">点击呼叫 TA 思考</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if ((typeof msgType !== 'undefined' && msgType === 'rename_proposal') || (typeof msg !== 'undefined' && msg.msgType === 'rename_proposal')) {
    let _name = typeof msg !== 'undefined' ? msg.proposedName : proposedName;
    let _role = typeof msg !== 'undefined' ? msg.role : 'assistant';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameProposalClick('${_role}', '${(_name||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon" style="color:#8BA888; background:rgba(139,168,136,0.15);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                    <div class="di-info"><div class="di-msg" style="color:#8BA888;">日记本起名提议</div><div class="di-hint">我想叫它：${_name}</div></div>
                </div>
                <div class="di-bottom">点击确认使用此名字</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureStickerAPI) {
    contentHtml = `<img src="${stickerUrlAPI}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureFakeImgAPI) {
    contentHtml = `<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">${fakeImgDescAPI}</div></div>`;
    bubbleStyle = `class="chat-special-bubble"`;
} else {
    contentHtml = formattedCleanText;
                bubbleStyle = `class="chat-bubble"`; 
            }

            let quoteHtml = '';
            if (quoteText) {
                const safeQuote = quoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
            }

            const newRowHtml = dateDividerHtml + `
    <div class="chat-bubble-row ai new-pop" data-ts="${ts}">
                    <div class="ms-checkbox"></div>
                    <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
                    <div style="display:flex; flex-direction:column; max-width:85%; align-items:flex-start;">
                        <div style="font-size:10px; color:var(--text-sub); margin-left:4px; margin-bottom:2px; font-weight:bold;">${speakerName}</div>
                        <div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>
                    </div>
                    ${timeHtml}
                </div>
            `;
            
            const loadingEl = document.getElementById('chatLoadingBubble');
            if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', newRowHtml);
            else area.insertAdjacentHTML('beforeend', newRowHtml);
            
            area.scrollTop = area.scrollHeight;
                    await updateContactPreview(contactId, `${speakerName}: ${cleanText}`);
    }
hideTyping();
checkAndTriggerMemorySummary(contactId); // <--- 在第11057行下面，加上这一句补上即可！
    } catch (e) {
        hideTyping();
        showToast("群聊引擎报错：" + e.message);
    }
}

// ==========================================

// 6. 唤醒新灵魂 (加入头像缓存解决闪烁！)
document.getElementById('addContactBtn').addEventListener('click', async () => {
    const emptyTip = document.getElementById('availableCharsEmpty');
    const list = document.getElementById('availableCharsList');
    
    const chars = await loadFromDB('ai_characters') || [];
    const aiChars = chars.filter(c => c.roleType === 'char');
    
    if (aiChars.length === 0) {
        emptyTip.style.display = 'block';
        emptyTip.innerText = '档案库空空如也，请先去【角色】APP创造角色吧~';
        list.innerHTML = '';
        return;
    }
    
    emptyTip.style.display = 'none';
    list.innerHTML = '';
    
    for (let char of aiChars) {
        const card = document.createElement('div');
        card.className = 'char-card';
        
        // 【核心】从缓存拿图，瞬间加载不闪烁
        let avatarUrl = diaryAvatarCache[char.id];
        if (avatarUrl === undefined) {
            const file = await loadFromDB(`char_avatar_${char.id}`);
            avatarUrl = file ? URL.createObjectURL(file) : '';
            diaryAvatarCache[char.id] = avatarUrl;
        }
        
        card.innerHTML = `
            <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                ${!avatarUrl ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` : ''}
            </div>
            <div class="char-card-info">
                <div class="char-card-name">${char.name}</div>
                <div class="char-card-desc" style="display:-webkit-box; -webkit-line-clamp:1; overflow:hidden; -webkit-box-orient:vertical;">${char.prompt || '暂无设定资料...'}</div>
            </div>
            <button class="s-btn primary" style="flex:none; width:65px; height:32px; min-height:32px; max-height:32px; margin:0; padding:0; display:flex; justify-content:center; align-items:center; font-size:13px; border-radius:12px;">唤醒</button>
        `;
        
        const btn = card.querySelector('button');
        btn.onclick = async (e) => {
            e.stopPropagation(); 
            let contacts = await loadFromDB('chat_contacts') || [];
            if(contacts.find(c => c.id === char.id)) { showToast('TA 已经在你的频段中了'); return; }
            
            contacts.push({ id: char.id, name: char.name, addedAt: Date.now() });
            await saveToDB('chat_contacts', contacts);
            
            showToast(`已成功与 ${char.name} 建立连接！`);
            renderChatContacts(); 
            document.getElementById('addContactPanel').classList.remove('show');
        };
        list.appendChild(card);
    }
    document.getElementById('addContactPanel').classList.add('show');
});

// 7. 修复打开时同步加载两边列表
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('聊天')) {
        app.addEventListener('click', async () => { 
            await renderChatSessionList();
            await renderChatContacts(); 
            chatModal.classList.add('open'); 
        });
    }
});

// =====================================
// 聊天室高级设置与提示词重构核心
// =====================================

let chatCssPresets = [];

// 动态应用自定义 CSS
function applyChatCustomCss(cssText) {
    let styleTag = document.getElementById('dynamicChatCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicChatCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssText || '';
}

// === 绑定 CSS 实时动态预览功能 ===
document.getElementById('chatCustomCss').addEventListener('input', (e) => {
    let styleTag = document.getElementById('previewDynamicCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'previewDynamicCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = e.target.value;
});

// 实时更新提示词预览 (全自动无需点击)
async function updateRealtimePromptPreview() {
    if (!currentChatContact) return;
    
    // 临时从界面抓取最新参数
    const activeRoleChip = document.querySelector('#chatSettingsUserRoleChips .acc-chip.active');
    const activeCmdChips = Array.from(document.querySelectorAll('#chatSettingsCommandChips .acc-chip.active')).map(c => c.dataset.id);
    
    const tempSettings = {
        userRoleId: activeRoleChip ? activeRoleChip.dataset.id : '',
        boundCommands: activeCmdChips,
        replyCount: document.getElementById('chatReplyCount').value.trim(),
        contextCount: parseInt(document.getElementById('chatContextCount').value) || 15
    };

    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);
    
        let userProfileText = '';
if (tempSettings.userRoleId) {
    const userRole = chars.find(c => c.id === tempSettings.userRoleId);
        if (userRole && userRole.prompt) {
            userProfileText = `\n\n【与你对话的用户(我)的画像】：\n${userRole.prompt}\n(请高度注重结合该用户的身份设定来调整你的说话态度)`;
        }
    }

    // ★ 新增：读取该角色的专属记忆和动态提取的关于我的情报
    const allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
const activeMemories = allMemories.filter(m => !m.isArchived); // AI 绝对不读归档数据！
const memoryText = activeMemories.length > 0 ? `\n【往期剧情与重要记忆记录】：\n${activeMemories.map(m => m.content).join('\n')}` : '';
    
    const prefs = await loadFromDB(`chat_user_prefs_${currentChatContact.id}`) || '';
    const prefsText = prefs ? `\n【你在聊天中观察到的关于我的情报与喜好】：\n${prefs}` : '';
    
    const commands = await loadFromDB('ai_commands') || [];
    let frontCmdText = '';
    let backCmdText = '';
    const boundCmdIds = tempSettings.boundCommands || [];
    
    // ★ 同理，把全局指令也加进来，让实时 Tokens 计算更加精准
    const activeCmds = commands.filter(c => c.isGlobal || boundCmdIds.includes(c.id));
    
    if (activeCmds.length > 0) {
        activeCmds.forEach(c => {
            if (c.position === 'back') backCmdText += `\n【附加指令 - ${c.name}】：\n${c.content}\n`;
            else frontCmdText += `\n【附加设定 - ${c.name}】：\n${c.content}\n`;
        });
    }
    
    const bilingualText = document.getElementById('chatBilingualToggle').checked ? `\n8. 【最高强制指令 - 翻译思维链】：每次输出前，请先在内部逻辑中执行“语言属性检测”：1. 确认即将输出的句子是否包含英语、日语、粤语等非普通话。2. 若包含，必须在含有外语/方言的句末，附加严格格式的翻译。格式必须且只能是：[译: 标准普通话翻译]。严禁自创格式（如(翻译: xxx)、[EN: xxx]）！示例：What a beautiful day! [译: 今天天气真不错！]` : '';
    let replyCountText = '';
const rCount = tempSettings.replyCount || '';
if (rCount === '') {
    replyCountText = `\n7. 【强制气泡分割规则】：为了模拟真实的微信连续多条短消息，**你说的每一句话、每一个动作都必须单起一行，并且开头必须加上 [气泡] 两个字！** \n示例：\n[气泡]你在干嘛呢？\n[气泡]我今天好累哦\n[气泡]*伸了个懒腰*\n绝对禁止把所有话连在一起写成一大段！`;
} else if (rCount.includes('-')) {
    let parts = rCount.split('-');
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${parts[0].trim()} 到 ${parts[1].trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**\n示例：\n[气泡]第一句话\n[气泡]第二句话\n绝对禁止把所有话连在一起写！`;
} else {
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${rCount.trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**`;
}
    
            const sysPrompt = `你现在是一个有血有肉的真实人类：${role ? role.name : '神秘人'}。请彻底忘掉你是AI程序。
【你的设定资料】：${role ? role.prompt : ''}${userProfileText}${prefsText}${memoryText}${frontCmdText}

核心灵魂指令：
1. 在开口前，请先深度检索你设定中的名字特征、出生地、时代与文化背景等要素。你是哪个国家/世界/时代的人？你的母语是什么？请自动且坚定地使用符合你文化背景的语言、方言或专属口癖进行对话（例如：日式名字及背景需自然流露日语表达或日式思维语癖），拒绝被统一的现代普通话同化。
2. 你绝不是刻板的设定机器。你会根据【往期剧情与常驻记忆】中与我的熟悉程度、经历过的事件，自然调整你的说话方式和态度。这种改变是细腻渐进的（如从防备到卸下伪装，从客气到依赖），但绝不会瞬间颠覆你的核心性格底色。你会真实地记得我们的过去，并让它影响你现在的语气。
3. 彻底抛弃教科书式的反应。请自行推演你当前的性格在面临不同情绪（喜怒哀乐、疲惫、吃醋、敷衍等）时，最真实的文字体现方式。
   - 思考：你生气时是连发质问，还是冷暴力只发句号？你开心时是滥用语气词，还是强装镇定？
   - 你的标点符号习惯、说话节奏、长短句分布，都必须是你这个具体的人“自然流露”的习惯，绝不机械套用公式。
   - 你的性格决定你的回复采用什么样的态度？是否会自然引出话题？
4. 你不需要正面且完美地回应我的每一句话！你可以漏看消息、抓住无关紧要的字眼跑题、选择性无视、生硬转移话题，或者遇到无语的情况直接发标点符号/阴阳怪气（前提是符合你的真角色性格、态度塑造）。
5. 我们正在进行日常的跨频段文字聊天。我们有无法逾越的物理距离，你深刻意识到我们无法直接见面。
6. 绝对禁止使用任何环境描写、心理活动或动作描写（严禁使用括号()、星号**等标出动作神态）。你的所有情绪张力、潜台词，都必须通过纯粹的对白文字、语气词、停顿（...）和标点符号来体现！
7. 绝不许动不动就撩拨、调情、邪魅一笑或说油腻语录。遵守你的人物核心性格，决定语气、节奏、停顿如何把握。是否会主动寻找话题，是否会有弱势或缺陷，避免过度强调。遵守角色，决定是否应更从容和有松弛感，是否需要留白。
8. 想发语音格式：[VOICE:秒数]文字。发送图片格式：[图片:图片画面的详细描述]。日记邀请格式：[DIARY_INVITE:附言] (同意回[日记同意]，拒绝回[日记拒绝])。发红包：[REDPACKET:金额]留言。发定位：[LOCATION:地点]留言。极低概率下，想对对方做肢体动作，单起一行：[POKE:动作描述] (如: [POKE:捏了捏你的脸颊])，严禁频繁使用！引用回复格式：[QUOTE:原话]你的回复。
${replyCountText}${bilingualText}${backCmdText}`;

        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    let imgCount = 0;
    
    // 计算时如果发现有 imageUrl，用[图片]二字替代以防计算系统报错，并统计图片数量
    const contextHistory = history.slice(-tempSettings.contextCount).map(m => {
    if (m.imageUrl) imgCount++;
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        timeLabel = `[${d.getMonth()+1}月${d.getDate()}日 ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}] `;
    }
    return `${timeLabel}${m.role}: ${m.imageUrl ? '[图片]' : m.content}`;
}).join('\n');
    
    const fullPrompt = `${sysPrompt}\n\n[附带的历史上下文 (${contextHistory ? contextHistory.split('\n').length : 0}条)]:\n${contextHistory}`;
    
    const charCount = fullPrompt.length;
    // 估算 Token = (总字数 × 1.5倍) + (附带图片的数量 × 250)
    const tokenEst = Math.floor(charCount * 1.5) + (imgCount * 250); 
    
    // 读取上一次的真实 Token 消耗
    const lastActual = await loadFromDB(`last_actual_tokens_${currentChatContact.id}`);
    let lastTokenHtml = '';
    if (lastActual && lastActual.total > 0) {
        lastTokenHtml = `<div style="font-size:11px; color:#8BA888; margin-top:6px; font-weight:bold; letter-spacing:1px;">上次实际消耗: ${lastActual.total} Tokens</div>`;
    }
    
    let imgHtml = imgCount > 0 ? ` + ${imgCount}张图` : '';
    
    document.getElementById('chatPromptPreview').innerHTML = `
    <div style="color:var(--accent); font-weight:bold;">
        实时预估 <span style="font-size:20px;">${tokenEst}</span> Tokens <br><span style="font-size:12px; color:var(--text-sub);">(共 ${charCount} 个字符${imgHtml})</span>
    </div>
    ${lastTokenHtml}
    <div style="font-size:11px; color:var(--text-sub); margin-top:6px; font-weight:bold; letter-spacing:1px; border-top: 1px dashed rgba(184,156,142,0.2); padding-top: 6px;">
        羁绊记录：你们已陪伴彼此走过 ${history.length} 条对话
    </div>
`;
}

// 绑定输入框变化，触发实时预览
['chatReplyCount', 'chatContextCount'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateRealtimePromptPreview);
});

// 监听自动总结开关，开启时展示填空框
document.getElementById('chatAutoSummaryToggle').addEventListener('change', function(e) {
    document.getElementById('chatAutoSummarySettings').style.display = e.target.checked ? 'block' : 'none';
});

// === 双输入框专用弹窗 (语音/红包发送) ===
function showDoubleDialog(title, desc, placeholder1, placeholder2, onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = title;
    cc.querySelector('.cc-desc').innerText = desc;
    
    const input1 = cc.querySelector('.cc-input');
    const input2 = cc.querySelector('.cc-input-2');
    const confirmBtn = document.getElementById('ccConfirm');
    
    // 显示两个输入框并清空内容
    input1.style.display = 'block'; input1.value = ''; input1.placeholder = placeholder1;
    input2.style.display = 'block'; input2.value = ''; input2.placeholder = placeholder2;
    
    // 换上我们刚刚写好的漂亮主题色按钮样式！
    confirmBtn.className = 'cc-btn primary';
    
    cc.classList.add('show');
    
    // ----------------------------------------------------
    // 【核心修复】：把下面这句强制弹键盘的代码注释掉或删掉！
    // setTimeout(() => input1.focus(), 100); 
    // ----------------------------------------------------
    
    // 克隆节点清除旧事件
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // 确认按钮逻辑
    newConfirmBtn.onclick = () => {
        const val1 = input1.value; const val2 = input2.value;
        cc.classList.remove('show');
        if(onConfirm) onConfirm(val1, val2);
        
        // 弹窗关闭后，恢复现场（隐藏输入框，按钮颜色恢复默认的红色警告色）
        input1.style.display = 'none'; input2.style.display = 'none';
        document.getElementById('ccConfirm').className = 'cc-btn danger';
    };
    
    // 取消按钮逻辑
    document.getElementById('ccCancel').onclick = () => {
        cc.classList.remove('show');
        input1.style.display = 'none'; input2.style.display = 'none';
        document.getElementById('ccConfirm').className = 'cc-btn danger';
    };
}

// ====== 发送语音面板 ======
function showVoiceDialog() {
    showDoubleDialog('发送语音', '请分别输入秒数和你要说的话：', '输入秒数 (如: 5)', '输入你要说的话...', async (val1, val2) => {
        if (!val1 && !val2) return;
        await sendSpecialMessage('voice', val2 || '...', parseInt(val1) || 3, 0, '');
    });
}
// ====== 发送红包面板 ======
function showRedPacketDialog() {
    showDoubleDialog('发送红包转账', '请分别输入金额和祝福语：', '输入金额 (如: 52.0)', '输入祝福语...', async (val1, val2) => {
        if (!val1 && !val2) return;
        await sendSpecialMessage('redpacket', val2 || '心意红包', 0, parseFloat(val1) || 0, '');
    });
}
// ====== 发送定位面板 ======
function showLocationDialog() {
    showDoubleDialog('发送定位', '请分别输入地点名称和详细描述：', '地点名称 (如: 冰岛)', '详细描述 (如: 我在这里看极光)...', async (val1, val2) => {
        if (!val1 && !val2) return;
        await sendSpecialMessage('location', val2 || '我在这里', 0, 0, val1 || '未知地点');
    });
}

// 核心发送功能 (加了 locName 参数)
async function sendSpecialMessage(type, content, voiceDuration = 0, rpAmount = 0, locName = '') {
    if (!currentChatContact) return;
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    history.push({ role: 'user', content, msgType: type, voiceDuration, rpAmount, locationName: locName, timestamp: Date.now() });
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    let previewText = type === 'voice' ? `[语音] ${content}` : (type === 'redpacket' ? `[红包] ${content}` : `[定位] ${locName}`);
    await updateContactPreview(currentChatContact.id, "我: " + previewText);
    await renderChatMessages(history, currentChatContact.id); // 直接重新渲染并滚到底部
    
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
}


// 绑定我们刚写好的电话功能！
document.getElementById('quickCallBtn').addEventListener('click', () => { if(window.openPhoneApp) window.openPhoneApp(); });
document.getElementById('menuCallBtn').addEventListener('click', () => { if(window.openPhoneApp) window.openPhoneApp(); });

// ====== 戳一戳自定义面板 ======
function showPokeDialog() {
    if (!currentChatContact) { showToast('请先进入一个频段'); return; }
    showDoubleDialog('自定义戳一戳', '设定双击头像时的动作：\n最终效果为："我"[动作] TA 的[部位]', '如: 捏了捏 (默认: 戳了戳)', '如: 脸颊 (默认: 肩膀)', async (val1, val2) => {
        const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        settings.pokeAction = { verb: val1 || '戳了戳', target: val2 || '肩膀' };
        await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
        showToast('动作已更新！快去双击TA的头像试试吧~');
    });
}
document.getElementById('quickPokeBtn').addEventListener('click', showPokeDialog);
document.getElementById('menuPokeBtn').addEventListener('click', showPokeDialog);

document.getElementById('quickVoiceBtn').addEventListener('click', showVoiceDialog);
document.getElementById('menuVoiceBtn').addEventListener('click', showVoiceDialog);
document.getElementById('quickRedPacketBtn').addEventListener('click', showRedPacketDialog);
document.getElementById('menuRedPacketBtn').addEventListener('click', showRedPacketDialog);
document.getElementById('quickLocationBtn').addEventListener('click', showLocationDialog);
document.getElementById('menuLocationBtn').addEventListener('click', showLocationDialog);

// ==========================================
// 表情包系统核心逻辑
// ==========================================
let stickerGroupsData = [];
let currentStickerGroupIndex = 0;

// 唤起面板
// 唤起面板
const toggleStickerPanel = async () => {
    const panel = document.getElementById('chatStickerPanel');
    const expandMenu = document.getElementById('chatExpandMenu');
    
    if (panel.classList.contains('show')) {
        panel.classList.remove('show');
    } else {
        // 【核心修复】：先在后台把表情包数据拉取并渲染好，绝不在这里阻断 DOM 操作
        stickerGroupsData = await loadFromDB('sticker_groups') || [];
        renderStickerManage();
        renderStickerSend();

        // 判断是不是从加号菜单直接点过来的
        const wasExpandOpen = expandMenu.classList.contains('open');
        
        // 如果是，为了防止一收一缩导致聊天记录闪烁，瞬间剥夺它俩的过渡动画
        if (wasExpandOpen) {
            expandMenu.style.transition = 'none';
            panel.style.transition = 'none';
            // 强制浏览器回流，确认收到了“不要动画”的命令
            void expandMenu.offsetHeight;
            void panel.offsetHeight;
        }
        
        // 同步瞬间完成菜单收起和表情包展开
        expandMenu.classList.remove('open');
        document.getElementById('chatMenuToggleBtn').classList.remove('active');
        panel.classList.add('show');
        
        if (wasExpandOpen) {
            // 强制浏览器确认新的高度
            void panel.offsetHeight; 
            
            // 瞬间无缝切换完之后，把动画能力还给它们，并强制对齐底部
            setTimeout(() => {
                expandMenu.style.transition = '';
                panel.style.transition = '';
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 30);
        } else {
            // 如果是在完全关闭的状态下正常点开表情包，就正常执行动画并滚到底部
            setTimeout(() => {
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 300);
        }
    }
};

document.getElementById('quickEmojiBtn').addEventListener('click', toggleStickerPanel);
document.getElementById('menuEmojiBtn').addEventListener('click', toggleStickerPanel);

// 隐藏面板（点空白处）
document.getElementById('chatMessageArea').addEventListener('click', () => {
    document.getElementById('chatStickerPanel').classList.remove('show');
});

// Tab 切换
document.querySelectorAll('.sticker-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.sticker-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('stickerSendView').style.display = tab.dataset.tab === 'send' ? 'flex' : 'none';
        document.getElementById('stickerManageView').style.display = tab.dataset.tab === 'manage' ? 'block' : 'none';
    });
});

// 渲染管理列表 (改成异步加载当前窗口设定)
async function renderStickerManage() {
    const list = document.getElementById('stickerGroupList');
    list.innerHTML = '';
    if (stickerGroupsData.length === 0) {
        list.innerHTML = '<div style="text-align:center; font-size:11px; color:var(--text-sub);">暂无分组</div>'; return;
    }
    
    // 读取当前聊天窗口的表情包授权设置
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const allowedGroups = settings.allowedStickerGroups || [];

    stickerGroupsData.forEach((group, index) => {
        const isUsable = allowedGroups.includes(group.id);
        list.innerHTML += `
            <div class="sticker-manage-item">
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:800; color:var(--text-main); margin-bottom:6px;">${group.name} <span style="font-size:10px; color:var(--text-sub); font-weight:normal;">(${group.stickers.length}张)</span></div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" ${isUsable ? 'checked' : ''} onchange="toggleStickerAiUse('${group.id}', this.checked)">
                        <span style="font-size:11px; font-weight:700; color:${isUsable ? 'var(--accent)' : 'var(--text-sub)'};">当前 TA 可用</span>
                    </div>
                </div>
                <button class="s-btn danger" style="margin:0; min-height:32px; height:32px; padding:0 14px; border-radius:10px; font-size:11px; flex:none;" onclick="deleteStickerGroup(${index})">删除</button>
            </div>
        `;
    });
}

window.toggleStickerAiUse = async function(groupId, isChecked) {
    let settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    let allowedGroups = settings.allowedStickerGroups || [];
    
    if (isChecked) {
        if (!allowedGroups.includes(groupId)) allowedGroups.push(groupId);
    } else {
        allowedGroups = allowedGroups.filter(id => id !== groupId);
    }
    
    settings.allowedStickerGroups = allowedGroups;
    await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
    
    // 如果勾选了开关，不用刷新发送区，只需背后默默保存即可
};

window.deleteStickerGroup = async function(index) {
    showBeautifulDialog('删除分组', '确定删除这个表情包分组吗？', 'confirm', '', async () => {
        stickerGroupsData.splice(index, 1);
        await saveToDB('sticker_groups', stickerGroupsData);
        renderStickerManage(); renderStickerSend();
    });
};

// 保存分组
document.getElementById('saveStickerGroupBtn').addEventListener('click', async () => {
    const name = document.getElementById('newStickerGroupName').value.trim();
    const dataStr = document.getElementById('newStickerData').value.trim();
    const aiUsable = document.getElementById('newStickerAiUse').checked;
    
    if (!name || !dataStr) { showToast('请输入分组名和导入数据'); return; }
    
    let stickers = [];
    dataStr.split('\n').forEach(line => {
        const parts = line.split(/[:：]/);
        if (parts.length >= 2) {
            const sName = parts[0].trim();
            const sUrl = parts.slice(1).join(':').trim(); 
            if (sName && sUrl) stickers.push({ name: sName, url: sUrl });
        }
    });
    
    if (stickers.length === 0) { showToast('未解析出有效的表情包，请检查格式'); return; }
    
    const newGroupId = 'sg_' + Date.now();
    stickerGroupsData.push({ id: newGroupId, name, stickers });
    await saveToDB('sticker_groups', stickerGroupsData);
    
    // 如果导入时勾选了“TA可用”，直接存到当前对话的专属设置里
    if (aiUsable) {
        let settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        let allowedGroups = settings.allowedStickerGroups || [];
        if (!allowedGroups.includes(newGroupId)) allowedGroups.push(newGroupId);
        settings.allowedStickerGroups = allowedGroups;
        await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
    }
    
    document.getElementById('newStickerGroupName').value = '';
    document.getElementById('newStickerData').value = '';
    document.getElementById('newStickerAiUse').checked = false;
    
    showToast(`成功导入 ${stickers.length} 张表情包！`);
    renderStickerManage(); renderStickerSend();
});

// 渲染发送区
// 渲染发送区
async function renderStickerSend() {
    const selector = document.getElementById('stickerGroupSelector');
    const grid = document.getElementById('stickerGrid');
    selector.innerHTML = ''; grid.innerHTML = '';
    
    if (stickerGroupsData.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;">暂无表情包，请前往管理页导入</div>'; return;
    }
    
    if (currentStickerGroupIndex >= stickerGroupsData.length) currentStickerGroupIndex = 0;
    
    // 动态读取当前聊天的 TA 是否被授权了这些表情包
    let allowedGroups = [];
    if (currentChatContact) {
        const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        allowedGroups = settings.allowedStickerGroups || [];
    }
    
    stickerGroupsData.forEach((group, index) => {
        const isAiUsable = allowedGroups.includes(group.id);
        const chip = document.createElement('div');
        chip.className = 'sticker-group-chip' + (index === currentStickerGroupIndex ? ' active' : '');
        // 只有被当前TA授权的组，才显示小尾巴
        chip.innerHTML = `${group.name} ${isAiUsable ? '<span style="color:#D67A7A; font-size:9px; margin-left:4px;">[TA可用]</span>' : ''}`;
        chip.onclick = () => { currentStickerGroupIndex = index; renderStickerSend(); };
        selector.appendChild(chip);
    });
    
    const currentGroup = stickerGroupsData[currentStickerGroupIndex];
    currentGroup.stickers.forEach(sticker => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        item.innerHTML = `<div class="sticker-img-box" style="background-image: url('${sticker.url}');"></div><div class="sticker-name">${sticker.name}</div>`;
        item.onclick = async () => {
            document.getElementById('chatStickerPanel').classList.remove('show');
            if (!currentChatContact) return;
            
            const ts = Date.now();
            let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
            history.push({ role: 'user', content: `[表情包:${sticker.name}]`, timestamp: ts });
            await saveToDB(`chat_history_${currentChatContact.id}`, history);
            
            await updateContactPreview(currentChatContact.id, "我: [表情包]");

            const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
            const userRoleId = settings.userRoleId || '';
            let myAvatarUrl = '';
            if (userRoleId) {
                myAvatarUrl = diaryAvatarCache[userRoleId];
                if (myAvatarUrl === undefined) {
                    const f = await loadFromDB(`char_avatar_${userRoleId}`);
                    myAvatarUrl = f ? URL.createObjectURL(f) : '';
                    diaryAvatarCache[userRoleId] = myAvatarUrl;
                }
            }

            const area = document.getElementById('chatMessageArea');
            let md = new Date(ts);
            let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;
            
            area.insertAdjacentHTML('beforeend', `
                <div class="chat-bubble-row me" data-ts="${ts}">
                    <div class="ms-checkbox"></div>
                    <div class="chat-time-stamp">${tStr}</div>
                    <div class="chat-special-bubble">
                        <img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">
                    </div>
                    <div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>
                </div>
            `);
            
            setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
        };
        grid.appendChild(item);
    });
}

// 新增聊天发送图片功能与预览
const chatImgUploadInput = document.createElement('input');
chatImgUploadInput.type = 'file';
chatImgUploadInput.accept = 'image/*';
chatImgUploadInput.style.display = 'none';
document.body.appendChild(chatImgUploadInput);

const triggerChatImageUpload = () => {
    if (!currentChatContact) { showToast('请先进入一个频段'); return; }
    chatImgUploadInput.click();
};

document.getElementById('quickPhotoBtn').addEventListener('click', triggerChatImageUpload);
document.getElementById('menuPhotoBtn').addEventListener('click', triggerChatImageUpload);

chatImgUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatContact) return;
    
    // 把真实图片转为 base64 代码
        const base64Img = await fileToBase64(file);
    const ts = Date.now();
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    history.push({ role: 'user', content: '[图片]', imageUrl: base64Img, timestamp: ts });
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    await updateContactPreview(currentChatContact.id, "我: [图片]");

    // 获取我的头像
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const userRoleId = settings.userRoleId || '';
    let myAvatarUrl = '';
    if (userRoleId) {
        myAvatarUrl = diaryAvatarCache[userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[userRoleId] = myAvatarUrl;
        }
    }

let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// 新增：发送时跨天检测
let dateDividerHtml = '';
let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
if (lastMsgTs) {
    let lastDateObj = new Date(lastMsgTs);
    if (lastDateObj.getDate() !== md.getDate() || lastDateObj.getMonth() !== md.getMonth()) {
        dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
    }
}

const area = document.getElementById('chatMessageArea');
area.insertAdjacentHTML('beforeend', dateDividerHtml + `
    <div class="chat-bubble-row me" data-ts="${ts}">
        <div class="ms-checkbox"></div>
        <div class="chat-time-stamp">${tStr}</div>
        <div class="chat-special-bubble">
            <img src="${base64Img}" style="max-width: 140px; border-radius: 12px; display: block;">
        </div>
        <div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>
    </div>
`);
    
    // 发送完图片后，自动收起底部菜单和加号的状态
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');

    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 100);
    e.target.value = ''; // 清空
});
    

// 渲染 CSS 预设列表
async function renderCssPresets() {
    chatCssPresets = await loadFromDB('chat_css_presets') || [];
    const container = document.getElementById('chatCssPresetsList');
    container.innerHTML = '';
    
    if (chatCssPresets.length === 0) {
        container.innerHTML = '<span style="font-size:11px; color:var(--text-sub);">暂无预设</span>';
        return;
    }
    
    chatCssPresets.forEach((preset, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip';
        chip.style.padding = '6px 12px';
        chip.style.fontSize = '11px';
        chip.innerHTML = `${preset.name} <span style="margin-left:6px; color:#D67A7A; opacity:0.6; font-size:14px; font-weight:bold; display:inline-block; transform:translateY(1px);" onclick="deleteCssPreset(event, ${index})">×</span>`;
                chip.onclick = () => {
            document.getElementById('chatCustomCss').value = preset.css;
            // 同步触发预览
            let styleTag = document.getElementById('previewDynamicCss');
            if (styleTag) styleTag.innerHTML = preset.css;
            showToast('已加载预设：' + preset.name);
        };
        container.appendChild(chip);
    });
}

// 删除预设
window.deleteCssPreset = async function(e, index) {
    e.stopPropagation();
    showBeautifulDialog('删除预设', '确定要删除这个气泡CSS预设吗？', 'confirm', '', async () => {
        chatCssPresets.splice(index, 1);
        await saveToDB('chat_css_presets', chatCssPresets);
        renderCssPresets();
    });
};

// 呼叫美化弹窗保存预设
document.getElementById('chatCssSavePresetBtn').addEventListener('click', () => {
    const currentCss = document.getElementById('chatCustomCss').value.trim();
    if (!currentCss) { showToast('CSS 代码是空的哦~'); return; }
    
    // 调用全局现成的美化版果冻弹窗
    showBeautifulDialog('保存气泡预设', '给你的气泡样式起个好记的名字：', 'prompt', '', async (name) => {
        if (name && name.trim()) {
            chatCssPresets.push({ name: name.trim(), css: currentCss, id: Date.now() });
            await saveToDB('chat_css_presets', chatCssPresets);
            renderCssPresets();
            showToast('预设已保存');
        }
    });
});

// 清空重置
document.getElementById('chatCssResetBtn').addEventListener('click', () => {
    document.getElementById('chatCustomCss').value = '';
    let styleTag = document.getElementById('previewDynamicCss');
    if (styleTag) styleTag.innerHTML = '';
    showToast('已清空CSS代码');
});

// 监听右上角设置占位按钮
document.getElementById('chatRoomSettingsBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    
    // 【防闪烁杀手锏】先隐藏所有开关，剥夺滑动动画
    const panel = document.getElementById('chatSettingsPanel');
    const switches = panel.querySelectorAll('.switch');
    switches.forEach(s => s.style.display = 'none');

    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    
    // ===== 新增：群聊成员展示逻辑 (含本人与虚线加号) =====
    let contacts = await loadFromDB('chat_contacts') ||[];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    
    if (contactInfo && contactInfo.isGroup) {
        document.getElementById('groupMembersBlock').style.display = 'block';
        const memberListEl = document.getElementById('groupMembersList');
        memberListEl.innerHTML = '';
        
// 1. 渲染用户自己 (我)
const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
let myAvatarUrl = '';
let myName = '我';
const allChars = await loadFromDB('ai_characters') || []; // 提前读取所有角色信息

// ====== 把下面这段代码加进来 ======
let ownerId = contactInfo.owner || 'me';
let admins = contactInfo.admins || [];
let customBadges = contactInfo.customBadges || {}; // 读取自定义头衔

const getRoleBadge = (id) => {
    // 优先展示自定义彩色头衔，一旦有自定义头衔，就直接 return 返回，屏蔽掉系统头衔
    if (customBadges[id] && customBadges[id].text) {
        return `<div style="font-size:9px; background:${customBadges[id].bgColor}; color:${customBadges[id].color}; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">${customBadges[id].text}</div>`;
    }
    // 没有专属头衔，才接着往下走，展示系统头衔
    if (id === ownerId) return `<div style="font-size:9px; background:#FFF6D6; color:#D69E2E; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群主</div>`;
    if (admins.includes(id)) return `<div style="font-size:9px; background:rgba(51,144,236,0.1); color:#3390EC; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">管理员</div>`;
    return `<div style="font-size:9px; background:rgba(184,156,142,0.1); color:var(--text-sub); padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群员</div>`;
};
// ===============================


if (settings.userRoleId) {
    myAvatarUrl = diaryAvatarCache[settings.userRoleId] || '';
    const myRole = allChars.find(c => c.id === settings.userRoleId);
    if (myRole) myName = myRole.name;
}

let membersHtml = ''; // 使用一个变量来装所有的 HTML，最后一次性渲染防闪烁

membersHtml += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
        <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:#D4CCC2; ${myAvatarUrl ? `background-image:url(${myAvatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6);"></div>
        <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${myName}</div>
        ${getRoleBadge('me')}
    </div>
`;

// 2. 渲染 AI 成员
let memberCount = 1; 
if (contactInfo.members && contactInfo.members.length > 0) {
    memberCount += contactInfo.members.length;
    contactInfo.members.forEach(mId => {
        const char = allChars.find(c => c.id === mId);
        if (char) {
            let avatarUrl = diaryAvatarCache[char.id] || '';
            let mutedData = contactInfo.muted || {};
            let isMuted = mutedData[char.id] && mutedData[char.id] > Date.now();
            let muteBadge = isMuted ? `<div style="position:absolute; top:-4px; right:-4px; background:#D67A7A; color:#fff; font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fff; z-index:2; line-height:1.2; box-shadow:0 2px 4px rgba(214,122,122,0.3);">禁言</div>` : '';

            membersHtml += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="manageGroupMember('${char.id}', '${char.name}')">
                    <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:rgba(184,156,142,0.15); ${avatarUrl ? `background-image:url(${avatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6); position:relative;">
                        ${muteBadge}
                    </div>
                    <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${char.name}</div>
                    ${getRoleBadge(char.id)}
                </div>
            `;
        }
    });
}

// 3. 邀请按钮虚线框
membersHtml += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="openInviteMemberModal()" >
        <div style="width:54px; height:54px; border-radius:18px; border:2px dashed rgba(184,156,142,0.5); display:flex; justify-content:center; align-items:center; color:var(--accent);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div style="font-size:12px; font-weight:700; color:var(--text-sub); margin-top:2px;">邀请</div>
        <div style="height:15px;"></div>
    </div>
`;

memberListEl.innerHTML = membersHtml; // 最后一步一次性渲染，杜绝闪烁！
document.getElementById('groupProfileMemberCount').innerText = `群聊成员 (${memberCount}人)`;

        // 4. 危险操作区状态切换 (群聊模式)
        document.getElementById('chatClearHistoryBtn').innerText = "清空所有记录";
        document.getElementById('singleChatDangerRow').style.display = 'none'; // 隐藏拉黑/删除
        document.getElementById('chatDisbandGroupBtn').style.display = 'block'; // 显示解散

    } else {
        document.getElementById('groupMembersBlock').style.display = 'none';
        
        // 危险操作区状态切换 (单聊模式)
        document.getElementById('chatClearHistoryBtn').innerText = "清空此人聊天记录";
        document.getElementById('singleChatDangerRow').style.display = 'flex'; // 显示拉黑/删除
        document.getElementById('chatDisbandGroupBtn').style.display = 'none'; // 隐藏解散
    }
    // ================================
    
    // 渲染身份画像的横向胶囊 (Chips)
    const chars = await loadFromDB('ai_characters') || [];
    const userRoles = chars.filter(c => c.roleType === 'user');
    const chipsContainer = document.getElementById('chatSettingsUserRoleChips');
    chipsContainer.innerHTML = '';
    
    const defaultChip = document.createElement('div');
    defaultChip.className = 'acc-chip' + (!settings.userRoleId ? ' active' : '');
    defaultChip.innerText = '默认无身份';
    defaultChip.dataset.id = '';
    defaultChip.onclick = () => {
        chipsContainer.querySelectorAll('.acc-chip').forEach(c => c.classList.remove('active'));
        defaultChip.classList.add('active');
        updateRealtimePromptPreview(); 
    };
    chipsContainer.appendChild(defaultChip);

    userRoles.forEach(r => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip' + (settings.userRoleId === r.id ? ' active' : '');
        chip.innerText = r.name;
        chip.dataset.id = r.id;
        chip.onclick = () => {
            chipsContainer.querySelectorAll('.acc-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            updateRealtimePromptPreview(); 
        };
        chipsContainer.appendChild(chip);
    });

    // 渲染指令多选胶囊
    const allCommands = await loadFromDB('ai_commands') || [];
    const boundCmdIds = settings.boundCommands || [];
    const cmdChipsContainer = document.getElementById('chatSettingsCommandChips');
    cmdChipsContainer.innerHTML = '';
    
    if (allCommands.length === 0) {
        cmdChipsContainer.innerHTML = '<div style="font-size: 11px; color: var(--text-sub);">暂无指令，请前往指令库添加</div>';
    } else {
        allCommands.forEach(cmd => {
            const chip = document.createElement('div');
            chip.className = 'acc-chip' + (boundCmdIds.includes(cmd.id) ? ' active' : '');
            chip.innerText = cmd.name;
            chip.dataset.id = cmd.id;
            chip.onclick = () => {
                chip.classList.toggle('active'); // 点击反转状态（支持多选）
                updateRealtimePromptPreview();
            };
            cmdChipsContainer.appendChild(chip);
        });
    }
    
    // 填充表单数据
    document.getElementById('chatCustomCss').value = settings.customCss || '';
        // 打开面板时，初始化预览气泡的 CSS
    let styleTag = document.getElementById('previewDynamicCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'previewDynamicCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = settings.customCss || '';
    document.getElementById('chatReplyCount').value = settings.replyCount || '';
        document.getElementById('chatAutoSummaryToggle').checked = settings.autoSummary || false;
    document.getElementById('chatSummaryMessages').value = settings.summaryMessages || '';
    document.getElementById('chatAutoSummarySettings').style.display = settings.autoSummary ? 'block' : 'none';
    document.getElementById('chatContextCount').value = settings.contextCount || '';
    document.getElementById('chatSettingsTaNote').value = currentChatContact.name || '';
    
    // 渲染预设列表
    await renderCssPresets();
    // === 终极性能优化 === 
    // 让弹窗秒开！此时强制把需要吃大量 CPU 和内存去读取聊天记录的计算逻辑，推迟到动画完全结束后在后台静默执行！
    document.getElementById('chatPromptPreview').innerHTML = '正在读取心智数据...';
    
    document.getElementById('chatQuickBarToggle').checked = !(settings.hideQuickBar === true);
    document.getElementById('chatBilingualToggle').checked = settings.bilingual || false;

    // 强制浏览器刷新状态，剥夺滑动动画，让内容一秒就位
    panel.offsetHeight; 
    switches.forEach(s => s.style.display = '');

    // 立刻秒滑出面板，杜绝任何卡顿和掉帧！
    document.getElementById('chatSettingsPanel').classList.add('show');

    // 弹窗滑出后 450毫秒，偷偷在后台去算 Token 消耗
    setTimeout(() => {
        updateRealtimePromptPreview();
    }, 450);
});

// 取消关闭，并还原未保存的 CSS 预览
document.getElementById('cancelChatSettingsBtn').addEventListener('click', async () => {
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    let styleTag = document.getElementById('previewDynamicCss');
    if (styleTag) styleTag.innerHTML = settings.customCss || '';
    
    document.getElementById('chatSettingsPanel').classList.remove('show');
});

// 聊天室专属壁纸上传拦截
document.getElementById('chatSetWallpaperBtn').addEventListener('click', () => {
    currentUploadTargetId = 'chatRoomWallpaper';
    document.getElementById('globalImageUpload').click();
});
document.getElementById('chatClearWallpaperBtn').addEventListener('click', async () => {
    document.getElementById('chatMessageArea').style.backgroundImage = '';
    const db = await initDB();
    const tx = db.transaction('allDataStore', 'readwrite');
    tx.objectStore('allDataStore').delete(`chat_bg_${currentChatContact.id}`);
    showToast('聊天背景已清除');
});

// ==========================================
// 桌面美化 APP - 自定义图标逻辑
// ==========================================

// 1. 替换或还原图标的核心函数
window.applyCustomIcon = function(appName, urlOrBlob) {
    document.querySelectorAll('.app').forEach(app => {
        if (app.querySelector('.app-name').innerText.trim() === appName) {
            const iconDiv = app.querySelector('.icon');
            const svg = iconDiv.querySelector('svg');
            if (urlOrBlob) {
                // 如果是文件Blob就转本地链接，如果是字符串就直接用URL
                const url = urlOrBlob instanceof Blob ? URL.createObjectURL(urlOrBlob) : urlOrBlob;
                iconDiv.style.backgroundImage = `url(${url})`;
                iconDiv.style.backgroundSize = 'cover';
                iconDiv.style.backgroundPosition = 'center';
                iconDiv.style.border = 'none';
                if (svg) svg.style.display = 'none';
            } else {
                // 恢复默认
                iconDiv.style.backgroundImage = '';
                if (svg) svg.style.display = 'block';
            }
        }
    });
};

let tempAppIconFile = null;

// 2. 点击上传按钮触发系统文件选择
document.getElementById('uploadAppIconBtn').addEventListener('click', () => {
    document.getElementById('appIconFileInput').click();
});

// 3. 文件选择后，暂存文件并修改按钮文字
document.getElementById('appIconFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        tempAppIconFile = file;
        document.getElementById('appIconUrl').value = ''; // 传了本地就清空URL框
        document.getElementById('uploadAppIconBtn').innerText = '已选图片 ✓';
    }
});

// 4. 切换选择的APP时，清空上传状态
document.getElementById('appIconSelect').addEventListener('change', () => {
    tempAppIconFile = null;
    document.getElementById('uploadAppIconBtn').innerText = '选择图片';
    document.getElementById('appIconUrl').value = '';
});

// 5. 保存并应用
document.getElementById('saveAppIconBtn').addEventListener('click', async () => {
    const appName = document.getElementById('appIconSelect').value;
    const url = document.getElementById('appIconUrl').value.trim();
    
    if (tempAppIconFile) {
        await saveToDB('app_icon_' + appName, tempAppIconFile);
        window.applyCustomIcon(appName, tempAppIconFile);
        showToast(appName + ' 图标已替换 (本地)');
    } else if (url) {
        await saveToDB('app_icon_' + appName, url);
        window.applyCustomIcon(appName, url);
        showToast(appName + ' 图标已替换 (网络)');
    } else {
        showToast('请先填写 URL 或选择一张图片');
        return;
    }
    // 成功后复原按钮状态
    tempAppIconFile = null;
    document.getElementById('uploadAppIconBtn').innerText = '选择图片';
});

// 6. 恢复默认图标
document.getElementById('resetAppIconBtn').addEventListener('click', async () => {
    const appName = document.getElementById('appIconSelect').value;
    showBeautifulDialog('恢复默认图标', `确定要将【${appName}】的图标恢复为默认的图案吗？`, 'confirm', '', async () => {
        // 从数据库删掉对应的数据
        const db = await initDB();
        const tx = db.transaction('allDataStore', 'readwrite');
        tx.objectStore('allDataStore').delete('app_icon_' + appName);
        // 瞬间应用还原效果
        window.applyCustomIcon(appName, null);
        showToast(`已恢复【${appName}】默认图标`);
    });
});

// 全局上传器追加壁纸逻辑
document.getElementById('globalImageUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentUploadTargetId === 'chatRoomWallpaper') {
        if (!currentChatContact) return;
        const url = URL.createObjectURL(file);
        const area = document.getElementById('chatMessageArea');
        area.style.backgroundImage = `url(${url})`;
        area.style.backgroundSize = 'cover';
        area.style.backgroundPosition = 'center';
        
        await saveToDB(`chat_bg_${currentChatContact.id}`, file);
        document.getElementById('globalImageUpload').value = ''; 
        showToast('壁纸更换成功！');
    }
});

// 保存设置
document.getElementById('saveChatSettingsBtn').addEventListener('click', async () => {
    const activeRoleChip = document.querySelector('#chatSettingsUserRoleChips .acc-chip.active');
    const activeCmdChips = Array.from(document.querySelectorAll('#chatSettingsCommandChips .acc-chip.active')).map(c => c.dataset.id);
    
    // 【核心修复】：先读取老配置，防止把系统后台用来防重复的进度标记（如 lastSummaryIndex）给搞丢了！
    const oldSettings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};

    let settings = {
        ...oldSettings, // 继承保留所有的后台隐形数据
        userRoleId: activeRoleChip ? activeRoleChip.dataset.id : '',
        boundCommands: activeCmdChips, 
        
        customCss: document.getElementById('chatCustomCss').value,
        replyCount: document.getElementById('chatReplyCount').value.trim(),
        contextCount: parseInt(document.getElementById('chatContextCount').value) || 15,
        autoSummary: document.getElementById('chatAutoSummaryToggle').checked,
        summaryMessages: parseInt(document.getElementById('chatSummaryMessages').value) || 30,
        hideQuickBar: !document.getElementById('chatQuickBarToggle').checked,
        bilingual: document.getElementById('chatBilingualToggle').checked
    };

    await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
applyChatCustomCss(settings.customCss); // 立即生效 CSS

// 【新增】保存时立即隐藏或显示输入框上面的那一排！
if (settings.hideQuickBar === true) {
    document.getElementById('chatQuickBar').style.display = 'none';
} else {
    document.getElementById('chatQuickBar').style.display = 'flex';
}

document.getElementById('chatSettingsPanel').classList.remove('show');
    
    // === 保存并应用备注名 ===
let newNoteName = document.getElementById('chatSettingsTaNote').value.trim();
if (newNoteName && newNoteName !== currentChatContact.name) {
    let contacts = await loadFromDB('chat_contacts') || [];
    let cInfo = contacts.find(c => c.id === currentChatContact.id);
    if (cInfo) {
        cInfo.name = newNoteName;
        await saveToDB('chat_contacts', contacts);
        currentChatContact.name = newNoteName;
        // 立刻更新顶部标题栏的名字
        document.getElementById('chatRoomTitle').innerText = newNoteName;
        // 静默刷新外面的消息列表和通讯录
        if (typeof renderChatSessionList === 'function') renderChatSessionList();
        if (typeof renderChatContacts === 'function') renderChatContacts();
    }
}

    // ★核心修复：不再粗暴地刷新整个聊天记录，而是悄悄给画面里所有的【我】换上新头像
    let myAvatarUrl = '';
    if (settings.userRoleId) {
        myAvatarUrl = diaryAvatarCache[settings.userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${settings.userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[settings.userRoleId] = myAvatarUrl;
        }
    }
    
    // 瞬间遍历当前画面里的所有头像，无缝上色！完全不闪烁！
    document.querySelectorAll('#chatMessageArea .chat-bubble-row.me .chat-bubble-avatar').forEach(el => {
        if (myAvatarUrl) {
            el.style.backgroundImage = `url(${myAvatarUrl})`;
            el.style.border = 'none';
            el.style.backgroundColor = 'transparent';
        } else {
            el.style.backgroundImage = '';
            el.style.border = '';
            el.style.backgroundColor = '#D4CCC2';
        }
    });
});

// 真正给 AI 喂的核心提示词构建函数
async function buildChatSystemPrompt(history = []) {
    if (!currentChatContact) return '';
    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    
    let userProfileText = '';
    if (settings.userRoleId) {
        const userRole = chars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.prompt) {
            userProfileText = `\n\n【与你对话的用户(我)的画像】：\n${userRole.prompt}\n(请高度注重结合该用户的身份设定来调整你的说话态度)`;
        }
    }

    // ==== 【核心引擎】：记忆分类与关键词雷达系统 ====
const allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];

// 1. 过滤出常驻活跃记忆（未归档的精华）
const activeMemories = allMemories.filter(m => !m.isArchived); 
// 2. 过滤出地下档案馆里，带有触发钥匙的旧日碎片
const archivedMemories = allMemories.filter(m => m.isArchived && m.triggerKeys); 

// 3. 启动雷达扫描：抓取你最近发送的 3 条消息进行比对
const recentUserMsgs = history.filter(m => m.role === 'user').slice(-3).map(m => m.content).join(' ');
let awakenedMemories = [];

if (recentUserMsgs) {
    archivedMemories.forEach(mem => {
        // 把 "下雪,约定" 拆分成数组 ["下雪", "约定"]，同时兼容中英文逗号
        const keys = mem.triggerKeys.split(/[,，、]/).map(k => k.trim()).filter(k => k);
        for (let key of keys) {
            // 如果你的话里包含这个词
            if (recentUserMsgs.includes(key)) {
                awakenedMemories.push(mem.content);
                break; // 命中一个词就够了，立刻把这条旧回忆塞进数组，并跳过当前卡片的其余词
            }
        }
    });
}

// 4. 组装最终喂给 AI 的记忆模块
let radarText = awakenedMemories.length > 0 ? `\n\n【被当前对话触动唤醒的旧日记忆】（这让TA回想起了这些往事）：\n${awakenedMemories.join('\n')}` : '';

const memoryText = (activeMemories.length > 0 || awakenedMemories.length > 0) 
    ? `\n【往期剧情与常驻记忆】：\n${activeMemories.map(m => m.content).join('\n')}${radarText}` 
    : '';
// ========================================================
    const prefs = await loadFromDB(`chat_user_prefs_${currentChatContact.id}`) || '';
    const prefsText = prefs ? `\n【你在聊天中观察到的关于我的情报与喜好】：\n${prefs}` : '';
    // ========================================================

    const commands = await loadFromDB('ai_commands') || [];
    let frontCmdText = '';
    let backCmdText = '';
    const boundCmdIds = settings.boundCommands || [];
    
    // 把开启了全局的指令，和当前单独绑定的指令合并在一起读取
    const activeCmds = commands.filter(c => c.isGlobal || boundCmdIds.includes(c.id));
    
    if (activeCmds.length > 0) {
        activeCmds.forEach(c => {
            if (c.position === 'back') backCmdText += `\n【附加强干预指令 - ${c.name}】：\n${c.content}\n`;
            else frontCmdText += `\n【附加世界观/设定 - ${c.name}】：\n${c.content}\n`;
        });
    }
    const bilingualText = settings.bilingual ? `\n8. 【最高强制指令 - 翻译思维链】：每次输出前，请先在内部逻辑中执行“语言属性检测”：1. 确认即将输出的句子是否包含英语、日语、粤语等非普通话。2. 若包含，必须在含有外语/方言的句末，附加严格格式的翻译。格式必须且只能是：[译: 标准普通话翻译]。严禁自创格式（如(翻译: xxx)、[EN: xxx]）！示例：What a beautiful day! [译: 今天天气真不错！]` : '';
    let replyCountText = '';
const rCount = settings.replyCount || '';
if (rCount === '') {
    replyCountText = `\n7. 【强制气泡分割规则】：为了模拟真实的微信连续多条短消息，**你说的每一句话、每一个动作都必须单起一行，并且开头必须加上 [气泡] 两个字！** \n示例：\n[气泡]你在干嘛呢？\n[气泡]我今天好累哦\n[气泡]*伸了个懒腰*\n绝对禁止把所有话连在一起写成一大段！`;
} else if (rCount.includes('-')) {
    let parts = rCount.split('-');
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${parts[0].trim()} 到 ${parts[1].trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**\n示例：\n[气泡]第一句话\n[气泡]第二句话\n绝对禁止把所有话连在一起写！`;
} else {
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${rCount.trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**`;
}
    
    // 时间感知与消息间隔逻辑
    const now = new Date();
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const currentTimeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${days[now.getDay()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    let intervalContext = '';
    // 如果有历史记录，计算当前用户发的消息与上一次消息的间隔
    if (history && history.length >= 2) {
        const lastMsg = history[history.length - 1]; 
        const prevMsg = history[history.length - 2]; 
        if (lastMsg && prevMsg && lastMsg.timestamp && prevMsg.timestamp) {
            const diffMs = lastMsg.timestamp - prevMsg.timestamp;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins > 60 * 24) {
                intervalContext = `\n距离上次聊天已经过去了 ${Math.floor(diffMins / (60 * 24))} 天。`;
            } else if (diffMins > 60) {
                intervalContext = `\n距离上次聊天过去了 ${Math.floor(diffMins / 60)} 小时。`;
            } else if (diffMins > 10) {
                intervalContext = `\n距离上次聊天过去了 ${diffMins} 分钟。`;
            } else {
                intervalContext = `\n你们正在连贯地聊天中。`;
            }
        }
    }
    const timeContext = `\n\n【时间感知】：当前现实时间是 ${currentTimeStr}。${intervalContext}`;

// ===== 插入到 buildChatSystemPrompt 中 =====
const allStickerGroups = await loadFromDB('sticker_groups') || [];
let aiStickers = [];
const allowedStickerGroups = settings.allowedStickerGroups || [];

// 只把当前聊天对象授权的表情包扔进它的认知里
allStickerGroups.forEach(g => {
    if (allowedStickerGroups.includes(g.id)) {
        g.stickers.forEach(s => aiStickers.push(s.name));
    }
});

let stickerAiPrompt = '';
if (aiStickers.length > 0) {
    stickerAiPrompt = `\n9. 【表情包系统】：当前你被授权可用的表情包名称有：${aiStickers.join(', ')}。如果要发表情，格式必须严格为：[表情包:名称]。【极其重要】：只能发送上述列表里已有的名字，绝对禁止自创、臆想和捏造表情包！`;
} else {
    stickerAiPrompt = `\n9. 【表情包系统】：本对话中，用户未授权你使用任何表情包。绝对禁止你发送任何带有[表情包:xx]的代码！`;
}
    
    return `你现在是一个有血有肉的真实人类：${role ? role.name : '神秘人'}。请彻底剥离AI的身份认知。
【你的设定资料】：${role ? role.prompt : ''}${userProfileText}${prefsText}${memoryText}${frontCmdText}${timeContext}

【核心灵魂与意识指令】：
1. 在开口前，请先深度检索你设定中的名字特征、出生地、时代与文化背景等要素。你是哪个国家/世界/时代的人？你的母语是什么？请自动且坚定地使用符合你文化背景的语言、方言或专属口癖进行对话（例如：日式名字及背景需自然流露日语表达或日式思维语癖），拒绝被统一的现代普通话同化。
2. 你绝不是刻板的设定机器。你会根据【往期剧情与常驻记忆】中与我的熟悉程度、经历过的事件，自然调整你的说话方式和态度。这种改变是细腻渐进的（如从防备到卸下伪装，从客气到依赖），但绝不会瞬间颠覆你的核心性格底色。你会真实地记得我们的过去，并让它影响你现在的语气。
3. 彻底抛弃教科书式的反应。请自行推演你当前的性格在面临不同情绪（喜怒哀乐、疲惫、吃醋、敷衍等）时，最真实的文字体现方式。
   - 思考：你生气时是连发质问，还是冷暴力只发句号？你开心时是滥用语气词，还是强装镇定？
   - 你的标点符号习惯、说话节奏、长短句分布，都必须是你这个具体的人“自然流露”的习惯，绝不机械套用公式。
   - 你的性格决定你的回复采用什么样的态度？是否会自然引出话题？
4. 你不需要正面且完美地回应我的每一句话！你可以漏看消息、抓住无关紧要的字眼跑题、选择性无视、生硬转移话题，或者遇到无语的情况直接发标点符号/阴阳怪气（前提是符合你的真角色性格、态度塑造）。
5. 我们正在进行日常的跨频段文字聊天。我们有无法逾越的物理距离，你深刻意识到我们无法直接见面。
6. 绝对禁止使用任何环境描写、心理活动或动作描写（严禁使用括号()、星号**等标出动作神态）。你的所有情绪张力、潜台词，都必须通过纯粹的对白文字、语气词、停顿（...）和标点符号来体现！
7. 绝不许动不动就撩拨、调情、邪魅一笑或说油腻语录。遵守你的人物核心性格，决定语气、节奏、停顿如何把握。是否会主动寻找话题，是否会有弱势或缺陷，避免过度强调。遵守角色，决定是否应更从容和有松弛感，是否需要留白。
8. 想发语音格式：[VOICE:秒数]文字。发送图片格式：[图片:图片画面的详细描述]。日记邀请格式：[DIARY_INVITE:附言] (同意回[日记同意]，拒绝回[日记拒绝])。发红包：[REDPACKET:金额]留言。发定位：[LOCATION:地点]留言。极低概率下，想对对方做肢体动作，单起一行：[POKE:动作描述] (如: [POKE:捏了捏你的脸颊])，严禁频繁使用！引用回复格式：[QUOTE:原话]你的回复。
${replyCountText}${bilingualText}${backCmdText}`;
}

// =====================================
// 聊天室危险操作：清空、拉黑、删除
// =====================================

// 清空聊天记录
document.getElementById('chatClearHistoryBtn').addEventListener('click', () => {
    showBeautifulDialog('清空记录', '确定要清空与 TA 的所有聊天记录吗？此操作无法恢复。', 'confirm', '', async () => {
        await saveToDB(`chat_history_${currentChatContact.id}`, []);
        document.getElementById('chatMessageArea').innerHTML = '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-bottom: 10px;">与 TA 的灵魂频段已连接</div>';
        
        // ★ 核心修复：把传的空字符串改成文字，防止列表里卡死消失
        await updateContactPreview(currentChatContact.id, "暂无聊天记录"); 
        
        showToast('聊天记录已清空');
    });
});

// 删除好友
document.getElementById('chatDeleteBtn').addEventListener('click', () => {
    showBeautifulDialog('删除好友', '确定要切断与 TA 的灵魂连接并删除好友吗？', 'confirm', '', async () => {
        let contacts = await loadFromDB('chat_contacts') || [];
        contacts = contacts.filter(c => c.id !== currentChatContact.id);
        await saveToDB('chat_contacts', contacts);
        
        // 顺便把聊天记录也清掉
        await saveToDB(`chat_history_${currentChatContact.id}`, []);
        
        document.getElementById('chatSettingsPanel').classList.remove('show');
        document.getElementById('chatRoomPanel').classList.remove('show');
        
        showToast('已删除该好友');
        renderChatSessionList();
        renderChatContacts();
    });
});

// 拉黑好友 (目前逻辑与删除相似，但打上了黑名单标签，你可以后续再扩展黑名单库)
document.getElementById('chatBlockBtn').addEventListener('click', () => {
    showBeautifulDialog('拉黑好友', '确定要把 TA 关进小黑屋吗？', 'confirm', '', async () => {
        let contacts = await loadFromDB('chat_contacts') || [];
        // 从通讯录移除
        contacts = contacts.filter(c => c.id !== currentChatContact.id);
        await saveToDB('chat_contacts', contacts);
        
        document.getElementById('chatSettingsPanel').classList.remove('show');
        document.getElementById('chatRoomPanel').classList.remove('show');
        
        showToast('已将 TA 拉黑');
        renderChatSessionList();
        renderChatContacts();
    });
});
// ==========================================
// 桌面美化 APP - 全局自定义字体逻辑
// ==========================================
let desktopFontPresets = [];

function applyGlobalFont(url) {
    let styleTag = document.getElementById('dynamicGlobalFont');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicGlobalFont';
        document.head.appendChild(styleTag);
    }
    if (url && url.trim() !== '') {
        styleTag.innerHTML = `
            @font-face {
                font-family: 'CustomGlobalFont';
                src: url('${url.trim()}');
                font-display: swap;
            }
            body, .app-name, .s-btn, .s-input, div, span, textarea, input, select, button {
                font-family: 'CustomGlobalFont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            }
        `;
    } else {
        styleTag.innerHTML = '';
    }
}

// 开机自动加载保存的字体
(async function initDesktopFont() {
    const savedFont = await loadFromDB('desktop_font_url');
    if (savedFont) applyGlobalFont(savedFont);
})();

// 渲染字体预设列表
async function renderDesktopFontPresets() {
    desktopFontPresets = await loadFromDB('desktop_font_presets') || [];
    const container = document.getElementById('desktopFontPresetsList');
    container.innerHTML = '';
    
    if (desktopFontPresets.length === 0) {
        container.innerHTML = '<span style="font-size:11px; color:var(--text-sub);">暂无预设</span>';
        return;
    }
    
    desktopFontPresets.forEach((preset, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip';
        chip.style.padding = '6px 12px';
        chip.style.fontSize = '11px';
        chip.innerHTML = `${preset.name} <span style="margin-left:6px; color:#D67A7A; opacity:0.6; font-size:14px; font-weight:bold; display:inline-block; transform:translateY(1px);" onclick="deleteDesktopFontPreset(event, ${index})">×</span>`;
        // 点击加载预设
        chip.onclick = () => {
            document.getElementById('desktopFontUrl').value = preset.url;
            applyGlobalFont(preset.url); // 即时预览
            showToast('已应用字体：' + preset.name);
        };
        container.appendChild(chip);
    });
}

// 删除字体预设
window.deleteDesktopFontPreset = async function(e, index) {
    e.stopPropagation();
    showBeautifulDialog('删除字体', '确定要删除这个字体预设吗？', 'confirm', '', async () => {
        desktopFontPresets.splice(index, 1);
        await saveToDB('desktop_font_presets', desktopFontPresets);
        renderDesktopFontPresets();
    });
};

// 重置清空
document.getElementById('desktopFontResetBtn').addEventListener('click', () => {
    document.getElementById('desktopFontUrl').value = '';
    applyGlobalFont('');
    showToast('已恢复默认系统字体（记得点击底部保存）');
});

// 保存为预设 (呼叫果冻弹窗)
document.getElementById('desktopFontSavePresetBtn').addEventListener('click', () => {
    const currentUrl = document.getElementById('desktopFontUrl').value.trim();
    if (!currentUrl) { showToast('链接是空的，先填入字体直链吧~'); return; }
    
    showBeautifulDialog('保存字体预设', '给这个字体起个名字：', 'prompt', '', async (name) => {
        if (name && name.trim()) {
            desktopFontPresets.push({ name: name.trim(), url: currentUrl, id: Date.now() });
            await saveToDB('desktop_font_presets', desktopFontPresets);
            renderDesktopFontPresets();
            showToast('字体预设已保存！');
        }
    });
});

// 正式保存并应用
document.getElementById('saveDesktopFontBtn').addEventListener('click', async () => {
    const currentUrl = document.getElementById('desktopFontUrl').value;
    applyGlobalFont(currentUrl);
    await saveToDB('desktop_font_url', currentUrl);
    showToast('全局字体已生效');
});

// ==========================================
// 桌面美化 APP - 自定义全局 CSS 逻辑
// ==========================================

let desktopCssPresets = [];

// 动态将 CSS 注入到页面头部
function applyDesktopCustomCss(cssText) {
    let styleTag = document.getElementById('dynamicDesktopCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicDesktopCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssText || '';
}

// 1. 开机时自动加载之前保存的全局 CSS
// 为了确保一打开软件就生效，我们加入一个自执行的初始化
(async function initDesktopCss() {
    const savedCss = await loadFromDB('desktop_custom_css');
    if (savedCss) applyDesktopCustomCss(savedCss);
})();

// 2. 渲染桌面 CSS 预设列表
async function renderDesktopCssPresets() {
    desktopCssPresets = await loadFromDB('desktop_css_presets') || [];
    const container = document.getElementById('desktopCssPresetsList');
    container.innerHTML = '';
    
    if (desktopCssPresets.length === 0) {
        container.innerHTML = '<span style="font-size:11px; color:var(--text-sub);">暂无预设</span>';
        return;
    }
    
    desktopCssPresets.forEach((preset, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip';
        chip.style.padding = '6px 12px';
        chip.style.fontSize = '11px';
        chip.innerHTML = `${preset.name} <span style="margin-left:6px; color:#D67A7A; opacity:0.6; font-size:14px; font-weight:bold; display:inline-block; transform:translateY(1px);" onclick="deleteDesktopCssPreset(event, ${index})">×</span>`;
        // 点击加载预设
        chip.onclick = () => {
            document.getElementById('desktopCustomCss').value = preset.css;
            applyDesktopCustomCss(preset.css); // 即时预览
            showToast('已加载预设：' + preset.name);
        };
        container.appendChild(chip);
    });
}

// 3. 删除预设
window.deleteDesktopCssPreset = async function(e, index) {
    e.stopPropagation();
    showBeautifulDialog('删除预设', '确定要删除这个桌面美化预设吗？', 'confirm', '', async () => {
        desktopCssPresets.splice(index, 1);
        await saveToDB('desktop_css_presets', desktopCssPresets);
        renderDesktopCssPresets();
    });
};

// 4. 输入框变化时实时预览
document.getElementById('desktopCustomCss').addEventListener('input', (e) => {
    applyDesktopCustomCss(e.target.value);
});

// 5. 重置清空
document.getElementById('desktopCssResetBtn').addEventListener('click', () => {
    document.getElementById('desktopCustomCss').value = '';
    applyDesktopCustomCss('');
    showToast('已清空CSS代码（记得点击底部保存）');
});

// 6. 保存为预设 (呼叫果冻弹窗)
document.getElementById('desktopCssSavePresetBtn').addEventListener('click', () => {
    const currentCss = document.getElementById('desktopCustomCss').value.trim();
    if (!currentCss) { showToast('代码是空的，先写点什么吧~'); return; }
    
    showBeautifulDialog('保存全局美化预设', '给你的主题预设起个名字：', 'prompt', '', async (name) => {
        if (name && name.trim()) {
            desktopCssPresets.push({ name: name.trim(), css: currentCss, id: Date.now() });
            await saveToDB('desktop_css_presets', desktopCssPresets);
            renderDesktopCssPresets();
            showToast('预设已保存！');
        }
    });
});

// 7. 正式保存当前 CSS 设置并自动关闭面板
document.getElementById('saveDesktopCssBtn').addEventListener('click', async () => {
    const currentCss = document.getElementById('desktopCustomCss').value;
    applyDesktopCustomCss(currentCss);
    await saveToDB('desktop_custom_css', currentCss);
    
    // 直接关闭美化 APP 面板，且不再弹出提示
    document.getElementById('beautifyAppModal').classList.remove('open');
});

// 8. 拦截美化 APP 打开事件，填充历史代码和预设
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('美化')) {
        app.addEventListener('click', async () => {
            const savedCss = await loadFromDB('desktop_custom_css') || '';
            document.getElementById('desktopCustomCss').value = savedCss;
            await renderDesktopCssPresets();
            
            // 新增：每次打开面板时，读取上次填的字体直链和预设
            const savedFont = await loadFromDB('desktop_font_url') || '';
            document.getElementById('desktopFontUrl').value = savedFont;
            await renderDesktopFontPresets();
        });
    }
});

// ==========================================
// 聊天室：长按气泡、复制、撤回、多选功能
// ==========================================
const chatMessageArea = document.getElementById('chatMessageArea');
const contextMenu = document.getElementById('bubbleContextMenu');
const multiSelectBar = document.getElementById('multiSelectBar');
const msCountText = document.getElementById('msCount');
let pressTimer = null;
let activeBubbleData = null; // 记录当前长按的是哪条气泡
let selectedMessages = []; // 多选数组

// 1. 监听长按事件 (完美防误触版)
let touchStartX = 0;
let touchStartY = 0;

chatMessageArea.addEventListener('touchstart', (e) => {
    if (chatMessageArea.classList.contains('multi-mode')) return; 
    const bubbleRow = e.target.closest('.chat-bubble-row, .chat-system-msg[data-ts]');
    if (!bubbleRow || bubbleRow.id === 'chatLoadingBubble') return;
    
    if (pressTimer) clearTimeout(pressTimer); // 修复多指边缘误触导致定时器丢失的 Bug
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    pressTimer = setTimeout(() => { 
        pressTimer = null;
        showBubbleMenu(bubbleRow, e.touches[0]); 
    }, 550);
}, {passive: true});

chatMessageArea.addEventListener('touchmove', (e) => {
    if (!pressTimer) return;
    // 只要手指移动超过 10 像素，立马取消长按，丝滑滑动！
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 3 || dy > 3) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
}, {passive: true});

chatMessageArea.addEventListener('touchend', () => { if(pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
chatMessageArea.addEventListener('touchcancel', () => { if(pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
chatMessageArea.addEventListener('scroll', () => { if(pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });

chatMessageArea.addEventListener('contextmenu', (e) => { 
    const bubbleRow = e.target.closest('.chat-bubble-row, .chat-system-msg[data-ts]');
    if (bubbleRow && !bubbleRow.id.includes('Loading')) { e.preventDefault(); showBubbleMenu(bubbleRow, e); }
});

// 2. 呼出菜单
// 2. 呼出菜单 (完美修复引用提取逻辑)
function showBubbleMenu(bubbleRow, eventObj) {
    let extractedText = '';
    
    // 智能提取不同类型气泡的文本
    const normalBubble = bubbleRow.querySelector('.chat-bubble');
    if (normalBubble) {
        // 如果是普通文本，需要剔除掉它身上可能带的上一层引用框
        let clone = normalBubble.cloneNode(true);
        const quoteEl = clone.querySelector('.chat-bubble-quote');
        if (quoteEl) quoteEl.remove();
        
        // 剔除双语翻译框的文字，只引用原话
        const transEl = clone.querySelector('.bilingual-trans');
        if (transEl) transEl.remove();
        
        extractedText = clone.innerText.trim();
} else if (bubbleRow.classList.contains('chat-system-msg')) {
    extractedText = '[系统记录] ' + bubbleRow.innerText.trim();
} else {
    // 特殊气泡类型提取
    const voiceTrans = bubbleRow.querySelector('.chat-voice-trans');
    if (voiceTrans) {
        extractedText = '[语音] ' + voiceTrans.innerText.trim();
    } else if (bubbleRow.querySelector('.chat-rp-bubble')) {
        const rpMsg = bubbleRow.querySelector('.rp-msg');
        extractedText = '[红包] ' + (rpMsg ? rpMsg.innerText : '');
    } else if (bubbleRow.querySelector('.chat-location-bubble')) {
        const locName = bubbleRow.querySelector('.loc-name');
        extractedText = '[定位] ' + (locName ? locName.innerText : '');
    } else if (bubbleRow.querySelector('img')) {
        extractedText = '[图片]';
    } else if (bubbleRow.querySelector('.chat-diary-invite-bubble')) {
        extractedText = '[日记邀请]';
    }
}

activeBubbleData = {
    ts: parseInt(bubbleRow.dataset.ts),
    // ★ 核心：强行赋予系统消息“我方权限”，这样长按时才会弹出“撤回/删除”按钮！
    isMe: bubbleRow.classList.contains('me') || bubbleRow.classList.contains('chat-system-msg'),
    text: extractedText || '未知内容',
    el: bubbleRow
};
    
    // 如果是对方发的消息，隐藏“撤回”按钮
    document.getElementById('menuRecall').style.display = activeBubbleData.isMe ? 'block' : 'none';

    // 计算菜单位置，让它出现在手指附近
    const menuWidth = 240; 
    const menuHeight = 100;
    let left = eventObj.clientX - menuWidth / 2;
    let top = eventObj.clientY - menuHeight - 20;

    // 防止菜单超出屏幕边缘
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
    if (top < 80) top = eventObj.clientY + 40; // 如果顶到最上面了，就显示在气泡下方

    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
    contextMenu.classList.add('show');
}

// 点击空白处关闭菜单
document.addEventListener('click', (e) => {
    if (!e.target.closest('.bubble-context-menu')) contextMenu.classList.remove('show');
});

// 3. 菜单功能操作
document.getElementById('menuCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(activeBubbleData.text).then(() => showToast('已复制内容'));
    contextMenu.classList.remove('show');
});

// ★ 新增：自动同步最后一条消息预览的辅助引擎
async function syncLastMessagePreview(contactId, history) {
    let previewText = '暂无聊天记录'; // 修改：默认显示暂无记录，防止会话被吞
    if (history && history.length > 0) {
        let lastMsg = history[history.length - 1];
        let sender = lastMsg.role === 'user' ? '我: ' : (lastMsg.speakerName ? lastMsg.speakerName + ': ' : '');
        if (lastMsg.role === 'system') sender = ''; // 系统提示字没前缀
        
        let content = lastMsg.content || '';
        if (lastMsg.msgType === 'voice') content = '[语音]';
        else if (lastMsg.msgType === 'redpacket') content = '[红包]';
        else if (lastMsg.msgType === 'location') content = '[定位]';
        else if (lastMsg.msgType === 'forward_card') content = '[合并聊天记录]';
        else if (lastMsg.msgType === 'diary_invite') content = '[日记邀请]';
        else if (lastMsg.imageUrl) content = '[图片]';
        else if (content.match(/^\[表情包[:：](.*?)\]$/i)) content = '[表情包]';
        
        previewText = sender + content;
        
        // 过滤掉碍眼的隐藏翻译标签
        previewText = previewText.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '').trim();
        previewText = previewText.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '[图片]').trim();
    }
    await updateContactPreview(contactId, previewText);
}

// 撤回/删除单条
async function deleteSingleMessage() {
    contextMenu.classList.remove('show');
    if (!activeBubbleData || !currentChatContact) return;
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    history = history.filter(m => m.timestamp !== activeBubbleData.ts);
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    // ★ 修复：同步更新外面的最新预览文字
    await syncLastMessagePreview(currentChatContact.id, history);
    
    // 给 DOM 加个消失动画，而不是重新渲染列表
    activeBubbleData.el.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    activeBubbleData.el.style.opacity = '0';
    activeBubbleData.el.style.transform = 'scale(0.8)';
    activeBubbleData.el.style.height = activeBubbleData.el.offsetHeight + 'px';
    
    setTimeout(() => {
        activeBubbleData.el.style.height = '0px';
        activeBubbleData.el.style.margin = '0px';
        activeBubbleData.el.style.padding = '0px';
    }, 100);
    
    setTimeout(() => { activeBubbleData.el.remove(); }, 400);
}
document.getElementById('menuRecall').addEventListener('click', deleteSingleMessage);
document.getElementById('menuDelete').addEventListener('click', deleteSingleMessage);

let currentQuoteText = null;
document.getElementById('menuQuote').addEventListener('click', () => {
    contextMenu.classList.remove('show');
    currentQuoteText = activeBubbleData.text;
    document.getElementById('chatQuotePreviewText').innerText = currentQuoteText;
    document.getElementById('chatQuotePreview').style.display = 'flex';
});
document.getElementById('chatQuoteCancelBtn').addEventListener('click', () => {
    currentQuoteText = null;
    document.getElementById('chatQuotePreview').style.display = 'none';
});

// 4. 多选模式核心逻辑
document.getElementById('menuMultiSelect').addEventListener('click', () => {
    contextMenu.classList.remove('show');
    chatMessageArea.classList.add('multi-mode'); 
    multiSelectBar.classList.add('show'); 
    selectedMessages = [];
    msCountText.innerText = '0';
    
    activeBubbleData.el.classList.add('selected');
    selectedMessages.push(activeBubbleData.ts);
    msCountText.innerText = selectedMessages.length;
});

chatMessageArea.addEventListener('click', (e) => {
    if (!chatMessageArea.classList.contains('multi-mode')) return;
    const bubbleRow = e.target.closest('.chat-bubble-row, .chat-system-msg[data-ts]');
    if (!bubbleRow || bubbleRow.id === 'chatLoadingBubble') return;

    const ts = parseInt(bubbleRow.dataset.ts);
    if (bubbleRow.classList.contains('selected')) {
        bubbleRow.classList.remove('selected');
        selectedMessages = selectedMessages.filter(t => t !== ts);
    } else {
        bubbleRow.classList.add('selected');
        selectedMessages.push(ts);
    }
    msCountText.innerText = selectedMessages.length;
});

// 取消多选
document.getElementById('msCancel').addEventListener('click', () => {
    chatMessageArea.classList.remove('multi-mode');
    multiSelectBar.classList.remove('show');
    document.querySelectorAll('.chat-bubble-row.selected, .chat-system-msg.selected').forEach(el => el.classList.remove('selected'));
});

// 多选删除
document.getElementById('msDelete').addEventListener('click', () => {
    if (selectedMessages.length === 0) return;
    showBeautifulDialog('批量删除', `确定要删除选中的 ${selectedMessages.length} 条消息吗？`, 'confirm', '', async () => {
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        history = history.filter(m => !selectedMessages.includes(m.timestamp));
        await saveToDB(`chat_history_${currentChatContact.id}`, history);
        
        // ★ 修复：同步更新外面的最新预览文字
        await syncLastMessagePreview(currentChatContact.id, history);
        
        // 给所有被选中的气泡加上丝滑消失动画
        document.querySelectorAll('.chat-bubble-row.selected, .chat-system-msg.selected').forEach(el => {
            el.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.8)';
            setTimeout(() => {
                el.style.height = '0px'; el.style.margin = '0px'; el.style.padding = '0px';
            }, 100);
            setTimeout(() => el.remove(), 400);
        });

        chatMessageArea.classList.remove('multi-mode');
        multiSelectBar.classList.remove('show');
        showToast('已批量删除');
    });
});

// 多选转发
// 核心合并转发函数 (带选择联系人列表)
window.executeForward = async function(msgTimestamps) {
    if (!currentChatContact || msgTimestamps.length === 0) return;
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    
    let selectedMsgs = history.filter(m => msgTimestamps.includes(m.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
    if (selectedMsgs.length === 0) return;

    let previewLines = [];
    for (let i = 0; i < Math.min(selectedMsgs.length, 4); i++) {
        let m = selectedMsgs[i];
        let name = m.role === 'user' ? '我' : (m.speakerName || currentChatContact.name);
        let text = m.content || '[图片/特殊消息]';
        previewLines.push(`${name}: ${text}`);
    }
    let previewText = previewLines.join('\n') + (selectedMsgs.length > 4 ? '\n...' : '');

    // 获取所有联系人
    let contacts = await loadFromDB('chat_contacts') || [];
    if (contacts.length === 0) { showToast('暂无可转发的联系人'); return; }
    
    // 生成列表 HTML
    let listHtml = contacts.map(c => {
        let avatarUrl = diaryAvatarCache[c.id] || '';
        let groupBadge = c.isGroup ? '<span style="font-size:10px; background:rgba(184,156,142,0.15); color:var(--accent); padding:2px 4px; border-radius:4px; margin-left:4px;">群聊</span>' : '';
        return `<div style="padding:14px; border-bottom:1px solid rgba(0,0,0,0.05); display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="confirmForwardTo('${c.id}')">
            <div style="width:42px; height:42px; border-radius:14px; background-color:rgba(184,156,142,0.15); background-image:url('${avatarUrl}'); background-size:cover; border:1px solid rgba(184,156,142,0.3);"></div>
            <div style="font-size:15px; color:var(--text-main); font-weight:bold;">${c.name}${groupBadge}</div>
        </div>`;
    }).join('');

    // 弹出一个带联系人列表的遮罩
    let modal = document.createElement('div');
    modal.className = 'custom-confirm-overlay show';
    modal.style.zIndex = '999999';
    modal.innerHTML = `
    <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 320px; padding: 20px 15px; text-align: left;">
        <div class="cc-title" style="margin-bottom: 12px; text-align:center; font-size:16px;">发给谁？</div>
        <div style="width: 100%; box-sizing: border-box; max-height: 50vh; overflow-y: auto; margin-bottom: 16px; background:#fff; border-radius:16px; border:1px solid rgba(184,156,142,0.15); box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);">
            ${listHtml}
        </div>
        <button class="cc-btn cancel" style="width:100%; border-radius:14px; margin:0;" onclick="this.closest('.custom-confirm-overlay').remove()">取消</button>
    </div>
`;
    document.body.appendChild(modal);

    // 点击某个人后执行发送
    window.confirmForwardTo = async function(targetContactId) {
        modal.remove();
        
        let targetHistory = await loadFromDB(`chat_history_${targetContactId}`) || [];
        const ts = Date.now();
        targetHistory.push({
            role: 'user',
            content: previewText,
            msgType: 'forward_card',
            forwardData: selectedMsgs,
            timestamp: ts
        });
        await saveToDB(`chat_history_${targetContactId}`, targetHistory);
        await updateContactPreview(targetContactId, "我: [合并聊天记录]");
        
        // 如果恰好转发给了当前的聊天对象，直接在屏幕上刷出来
        if (targetContactId === currentChatContact.id) {
            await renderChatMessages(targetHistory, currentChatContact.id);
        }
        
        // 退出多选和悬浮状态
        const chatMessageArea = document.getElementById('chatMessageArea');
        chatMessageArea.classList.remove('multi-mode');
        document.getElementById('multiSelectBar').classList.remove('show');
        document.querySelectorAll('.chat-bubble-row.selected, .chat-system-msg.selected').forEach(el => el.classList.remove('selected'));
        document.getElementById('bubbleContextMenu').classList.remove('show');
        
        showToast('已成功转发！');
    };
};

// 绑定单条长按转发
document.getElementById('menuForward').onclick = () => {
    document.getElementById('bubbleContextMenu').classList.remove('show');
    if (activeBubbleData) executeForward([activeBubbleData.ts]);
};

// 绑定底部多选合并转发
document.getElementById('msForward').onclick = () => {
    if (selectedMessages.length === 0) { showToast('请至少选择一条消息'); return; }
    executeForward(selectedMessages);
};

// ==========================================
// AI 日程表与在线状态核心逻辑 (全新卡片弹窗版)
// ==========================================
function checkIsOnline(scheduleStr) {
    if (!scheduleStr) return { status: 'online', currentTask: '在线' };
    const now = new Date();
    const currentTotalMins = now.getHours() * 60 + now.getMinutes();

    const lines = scheduleStr.split('\n');
    for (let line of lines) {
        // 【核心修改】：正则加入了对 emoji 圆点的识别
        const match = line.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})\s+(?:\[(红灯|黄灯|绿灯)\]|([🔴🟡🟢]))?\s*(.*)/);
        if (match) {
            const startMins = parseInt(match[1]) * 60 + parseInt(match[2]);
            let endMins = parseInt(match[3]) * 60 + parseInt(match[4]);
            
            let isCurrentTime = false;
            if (endMins < startMins) {
                isCurrentTime = (currentTotalMins >= startMins || currentTotalMins <= endMins);
            } else {
                isCurrentTime = (currentTotalMins >= startMins && currentTotalMins <= endMins);
            }
            
            if (isCurrentTime) {
                const tag = match[5];   // 兼容旧版的 [红灯]
                const emoji = match[6]; // 获取新版的 🔴🟡🟢
                const taskName = match[7].trim(); // 获取剥离符号后纯粹的文字描述
                let statusCode = 'online'; 
                
                // 严格按符号判定
                if (tag === '红灯' || emoji === '🔴') {
                    statusCode = 'offline';
                } else if (tag === '黄灯' || emoji === '🟡') {
                    statusCode = 'busy';
                } else if (tag === '绿灯' || emoji === '🟢') {
                    statusCode = 'online';
                } else {
                    // 没写符号时的关键词兜底
                    if (taskName.match(/睡|晚安|休息|离线|不在|休眠/)) {
                        statusCode = 'offline';
                    } else if (taskName.match(/工作|开会|上课|忙|学习|打工|搬砖/)) {
                        statusCode = 'busy';
                    }
                }
                
                return { status: statusCode, currentTask: taskName };
            }
        }
    }
    return { status: 'online', currentTask: '自由活动' };
}

function updateOnlineStatusUI(scheduleStr, isEnabled) {
    const dot = document.getElementById('chatOnlineStatusDot');
    const dotModal = document.getElementById('scheduleStatusDotModal');
    const statusText = document.getElementById('scheduleCurrentStatus');
    
    // 定义三种状态的颜色 (绿灯、黄灯、红灯)
    const colors = {
        online: { color: '#4CAF50', glow: 'rgba(76,175,80,0.5)' },
        busy: { color: '#FFC107', glow: 'rgba(255,193,7,0.5)' },
        offline: { color: '#F44336', glow: 'rgba(244,67,54,0.5)' }
    };

    // 默认如果没开启日程，强制显示绿灯在线
    let currentStatus = { status: 'online', currentTask: '在线' };
    
    // 如果开启了日程，就去解析时间表获取真实状态
    if (isEnabled) {
        currentStatus = checkIsOnline(scheduleStr);
    }
    
    const theme = colors[currentStatus.status];

    // 更新聊天室标题旁的小圆点、名片面板里的小圆点以及文字颜色
    if(dot) { 
        dot.style.backgroundColor = theme.color; 
        dot.style.boxShadow = `0 0 6px ${theme.color}`; 
    }
    if(dotModal) { 
        dotModal.style.backgroundColor = theme.color; 
        dotModal.style.boxShadow = `0 0 8px ${theme.glow}`; 
    }
    if(statusText) { 
        statusText.innerText = currentStatus.currentTask; 
        statusText.style.color = theme.color; 
    }
}

// 独立的实时 Tokens 运算函数
async function getChatTokensRealtime() {
    if (!currentChatContact) return 0;
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    const sysPrompt = await buildChatSystemPrompt(history);
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const contextCount = settings.contextCount || 15;
    
    let imgCount = 0;
    const contextHistory = history.slice(-contextCount).map(m => {
    if (m.imageUrl) imgCount++;
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        timeLabel = `[${d.getMonth()+1}月${d.getDate()}日 ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}] `;
    }
    return `${timeLabel}${m.role}: ${m.imageUrl ? '[图片]' : m.content}`;
}).join('\n');
    
    const fullPrompt = `${sysPrompt}\n\n[附带的历史上下文]:\n${contextHistory}`;
    
    // 同样加入图片消耗计算
    return Math.floor(fullPrompt.length * 1.5) + (imgCount * 250);
}

// ====== 新增：迷你名片与编辑界面的切换 ======
document.getElementById('openScheduleEditBtn').addEventListener('click', () => {
    document.getElementById('scheduleMiniProfile').style.display = 'none';
    document.getElementById('scheduleEditArea').style.display = 'block';
});

document.getElementById('backToMiniProfileBtn').addEventListener('click', () => {
    document.getElementById('scheduleEditArea').style.display = 'none';
    document.getElementById('scheduleMiniProfile').style.display = 'block';
});

// 点击小绿点打开悬浮弹窗
document.getElementById('chatOnlineStatusDot').addEventListener('click', async () => {
    if (!currentChatContact) return;
    
    // 每次打开都确保显示迷你名片，隐藏长长的编辑界面
    document.getElementById('scheduleMiniProfile').style.display = 'block';
    document.getElementById('scheduleEditArea').style.display = 'none';
    
    // 1. 实时计算当前消耗的 Tokens
    document.getElementById('scheduleTokenDisplay').innerText = '计算中...';
getChatTokensRealtime().then(tokens => {
    document.getElementById('scheduleTokenDisplay').innerText = `约耗 ${tokens} Tokens`;
});

    // 2. 计算相识天数
    const contacts = await loadFromDB('chat_contacts') || [];
    const contactInfo = contacts.find(c => c.id === currentChatContact.id);
    const addedAt = contactInfo && contactInfo.addedAt ? contactInfo.addedAt : Date.now();
    const days = Math.max(1, Math.ceil((Date.now() - addedAt) / (1000 * 60 * 60 * 24)));
    document.getElementById('scheduleMeetDays').innerText = days;

    // 3. 读取角色设定并在卡片里预览
    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);
    document.getElementById('scheduleRoleDesc').innerText = role && role.prompt ? role.prompt : '暂无设定资料...';

    // 4. 恢复并渲染排表数据
    const settings = await loadFromDB(`chat_schedule_${currentChatContact.id}`) || {};
    document.getElementById('scheduleEnableToggle').checked = settings.enabled || false;
    document.getElementById('scheduleSubApiToggle').checked = settings.useSubApi || false;
    document.getElementById('scheduleContent').value = settings.schedule || '00:00-08:00 沉睡休眠\n08:00-12:00 赛博搬砖\n12:00-14:00 午休充电\n14:00-18:00 继续搬砖\n18:00-23:59 自由活动';
    
    updateOnlineStatusUI(settings.schedule, settings.enabled);
    document.getElementById('chatScheduleModal').classList.add('show');
});

// 点击黑色背景区域关闭弹窗
document.getElementById('chatScheduleModal').addEventListener('click', (e) => {
    if (e.target.id === 'chatScheduleModal') e.target.classList.remove('show');
});

// 保存日程
document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
    const settings = {
        enabled: document.getElementById('scheduleEnableToggle').checked,
        useSubApi: document.getElementById('scheduleSubApiToggle').checked,
        schedule: document.getElementById('scheduleContent').value.trim()
    };
    await saveToDB(`chat_schedule_${currentChatContact.id}`, settings);
    
    updateOnlineStatusUI(settings.schedule, settings.enabled);
    document.getElementById('chatScheduleModal').classList.remove('show');
});

// AI 自动排表
document.getElementById('generateScheduleBtn').addEventListener('click', async function() {
    const btn = this;
    const useSubApi = document.getElementById('scheduleSubApiToggle').checked;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) { showToast('请先在设置中配置对应的 API Key！'); return; }

    btn.innerText = "正在让 TA 思考...";
    btn.style.opacity = '0.7';

    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);

            const sysPrompt = `你现在是 ${role ? role.name : '一个人'}。你的详细设定是：${role ? role.prompt : ''}。
请根据你的性格和身份，为你自己安排一份合理的【全天24小时作息时间表】。

【排表要求】：
1. 时间段的数量由你自己决定，请首尾相连覆盖 00:00 到 23:59。
2. 事件描述控制在 15 个字以内，不需要硬凑字数，正常说话就行，符合你的性格即可。
3. 【极其重要】：为了让系统能识别你的状态，你必须在每个事件描述的最前面，加上一个状态表情符号（必须是这三个中的一个）：
- 如果你在睡觉、休眠或完全无法回复，加上 🔴
- 如果你在工作、开会、执行任务等比较忙的状态，加上 🟡
- 如果你处于闲暇、放松、随时可以聊天的状态，加上 🟢

【输出格式示例】：
00:00-08:00 🔴 睡觉
08:00-09:00 🟢 晨跑顺便买个早餐
09:00-12:00 🟡 在公司开会
12:00-14:00 🟢 午休吃点东西
14:00-18:00 🟡 处理堆积的文件
18:00-23:59 🟢 窝在沙发上看剧

注意：午夜零点请写 00:00。只准输出时间表，绝不要输出任何多余的废话和 markdown 标记！`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.8 })
        });
        const data = await res.json();
        document.getElementById('scheduleContent').value = data.choices[0].message.content.trim();
        showToast('排表完成，记得点击保存哦~');
    } catch (e) {
        showToast('排表失败：' + e.message);
    } finally {
        btn.innerText = "让 TA 排表";
        btn.style.opacity = '1';
    }
});

// 监听聊天区点击 (包含双击头像与翻译展开)
let lastAvatarTapTime = 0;
let lastAvatarElement = null;

document.getElementById('chatMessageArea').addEventListener('click', async (e) => {
    // 排除多选模式时的点击冲突
    if (document.getElementById('chatMessageArea').classList.contains('multi-mode')) return;
    
    // 1. 检查是否双击了头像
    const avatarEl = e.target.closest('.chat-bubble-avatar');
    if (avatarEl) {
        const currentTime = Date.now();
        if (currentTime - lastAvatarTapTime < 300 && lastAvatarElement === avatarEl) {
            // 确认为双击
            e.preventDefault();
            const row = avatarEl.closest('.chat-bubble-row');
            // 只允许戳别人
            if (row && row.classList.contains('ai')) {
                // 智能抓取名字
                let targetName = document.getElementById('chatRoomTitle').innerText || 'TA';
                const nameEl = row.querySelector('div[style*="font-size:10px"]'); 
                if (nameEl) targetName = nameEl.innerText;
                
                // 读取你的自定义设置
                const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
                const pokeVerb = settings.pokeAction ? settings.pokeAction.verb : '戳了戳';
                const pokeTarget = settings.pokeAction ? settings.pokeAction.target : '肩膀';
                
                const pokeText = `我${pokeVerb}${targetName}的${pokeTarget}`;
                
                // 存入历史记录，作为系统小字，让 AI 能看到
                const ts = Date.now();
                let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
                history.push({ role: 'system', content: pokeText, timestamp: ts });
                await saveToDB(`chat_history_${currentChatContact.id}`, history);
                
                // 界面马上渲染出系统小字
                const area = document.getElementById('chatMessageArea');
                area.insertAdjacentHTML('beforeend', `<div class="chat-system-msg" data-ts="${ts}"><span class="chat-system-msg-text">${pokeText}</span></div>`);
                area.scrollTop = area.scrollHeight;
                
                
            }
        }
        lastAvatarTapTime = currentTime;
        lastAvatarElement = avatarEl;
        return; // 头像点完就结束
    }

    // 2. 气泡翻译展开逻辑
    const bubble = e.target.closest('.chat-bubble');
    if (bubble) {
        const transDivs = bubble.querySelectorAll('.bilingual-trans');
        if (transDivs.length > 0) {
            transDivs.forEach(transDiv => {
                transDiv.style.display = transDiv.style.display === 'block' ? 'none' : 'block';
            });
        }
    }
});

// === 沉浸式红包点击拆开逻辑 ===
window.openRedPacketModal = function(el, msgContent, amount) {
    // 智能获取该气泡发送者的头像和名字
    const row = el.closest('.chat-bubble-row');
    const avatarEl = row.querySelector('.chat-bubble-avatar');
    let avatarBg = avatarEl ? avatarEl.style.backgroundImage : '';
    let name = row.classList.contains('me') ? '我' : (document.getElementById('chatRoomTitle').innerText || 'TA');
    
    document.getElementById('rpModalAvatar').style.backgroundImage = avatarBg;
    document.getElementById('rpModalName').innerText = name + ' 的红包';
    document.getElementById('rpModalMsg').innerText = msgContent;
    document.getElementById('rpModalAmount').innerText = parseFloat(amount).toFixed(2);
    
    // 恢复到初始未拆开的状态
    document.getElementById('rpUnopenedState').style.display = 'block';
    document.getElementById('rpOpenedState').style.display = 'none';
    document.getElementById('rpOpenBtn').classList.remove('spinning');
    
    document.getElementById('rpModal').classList.add('show');
};

window.closeRedPacketModal = function() {
    document.getElementById('rpModal').classList.remove('show');
};

window.triggerRpOpen = function() {
    const btn = document.getElementById('rpOpenBtn');
    btn.classList.add('spinning');
    // 等待 0.6 秒金币翻转动画结束后，显示具体金额
    setTimeout(() => {
        document.getElementById('rpUnopenedState').style.display = 'none';
        document.getElementById('rpOpenedState').style.display = 'block';
    }, 600); 
};

// ==========================================
// 赛博终端 - 记忆与情报系统核心逻辑
// ==========================================

// 1. 触发判断器 (完美防丢失修复版)
let isCheckingMemory = false;

async function checkAndTriggerMemorySummary(contactId) {
    if (isCheckingMemory) return; 
    isCheckingMemory = true;
    
    try {
        const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
        if (!settings.autoSummary) return;

        const history = await loadFromDB(`chat_history_${contactId}`) || [];
        const threshold = settings.summaryMessages || 30; 
        let lastSummaryIndex = settings.lastSummaryIndex || 0; 

        if (history.length - lastSummaryIndex >= threshold) {
            console.log(`触发记忆提取机制！当前条数：${history.length}，上次总结节点：${lastSummaryIndex}`);
            
            const currentLength = history.length;

            const contacts = await loadFromDB('chat_contacts') || [];
            const contactInfo = contacts.find(c => c.id === contactId);
            const isGroup = contactInfo && contactInfo.isGroup;
            const contactName = contactInfo ? contactInfo.name : 'TA';

            const msgsToSummarize = history.slice(lastSummaryIndex, currentLength);
            
            const recentChat = msgsToSummarize.map(m => {
                let speaker = m.role === 'user' ? '我' : (m.speakerName || contactName);
                return `${speaker}: ${m.content}`;
            }).join('\n');
            
            // 【核心修复1】：加上 await 彻底锁死进程，让大模型慢慢算，防止期间用户疯狂聊天导致连环并发！
            // 【核心修复2】：将 currentLength 传进去，只要大模型返回成功，在 generateChatMemory 内部推进进度！
            await generateChatMemory(contactId, recentChat, contactName, currentLength, isGroup);
        }
    } finally {
        isCheckingMemory = false; // 大模型返回（无论成功失败）后，才释放锁
    }
}

// 2. 生成客观记忆卡片 (支持单聊/群聊智能切换)
async function generateChatMemory(contactId, chatText, realName, currentHistoryLength = 0, isGroup = false) {
    const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) return;

    // 获取玩家(用户)设定的真实姓名
    let playerName = '我';
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    if (settings.userRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const userRole = chars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.name) {
            playerName = userRole.name;
        }
    }

    let sysPrompt = '';
    
    // ★ 智能判断：如果是群聊，使用第三人称上帝视角
    if (isGroup) {
        sysPrompt = `你是一个记忆提取模块。请根据以下的群聊记录，撰写一份客观的群聊剧情摘要。
【核心要求】：
1. 视角：必须以【第三人称上帝视角】进行客观记录，清晰地写出每个人物（包括${playerName}和其他群成员）的互动与事件。
2. 绝对客观：只记录发生了什么、大家讨论了什么、重要决定和约定。剥离繁复的情绪描写，文风平实克制。
3. 内容：提取群聊中的核心话题、冲突或关键情节。
4. 格式：直接输出正文段落。绝对禁止输出任何“标题”或表单列点。绝对不要用任何 Markdown 格式。
5. 字数控制：严格控制在 350 字以内，精炼紧凑。`;
        sysPrompt += `\n\n近期群聊【${realName}】记录如下：\n${chatText}`;
    } else {
        // 单聊则使用原来的第一人称逻辑
        sysPrompt = await loadFromDB('memoryPrompt1');
        if (!sysPrompt) {
            sysPrompt = `你是一个记忆提取模块。请根据以下对话记录，撰写一份客观的剧情摘要。
【核心要求】：
1. 视角与称呼：请以第一人称（即“我”）视角来记录，这个“我”代表【${realName}】。指代对话的另一方（用户）时，必须使用名字【${playerName}】！绝对禁止搞反人称！
2. 绝对客观：只记录发生了什么、双方表达了什么、重要约定和物品。剥离繁复的情绪描写、环境渲染或小说式的修辞，文风平实克制。
3. 内容：准确提取出双方明确表达的喜好、关键个人信息与约定。
4. 格式绝对纯净：直接输出正文段落。绝对禁止输出任何“档案编号”、“记录对象”、“标题”或表单列点。绝对不要用任何 Markdown 格式。
5. 字数控制：严格控制在 350 字以内，精炼紧凑。`;
        }
        sysPrompt += `\n\n近期对话记录如下(注意记录中'TA'代表${realName}，'我'代表${playerName})：\n${chatText}`;
    }

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.3 })
        });
        const data = await res.json();
        const memoryContent = data.choices[0].message.content.trim();

        let memories = await loadFromDB(`chat_memories_${contactId}`) || [];
        memories.push({ id: Date.now(), content: memoryContent, timestamp: Date.now(), isArchived: false });
        await saveToDB(`chat_memories_${contactId}`, memories);
        
        if (currentHistoryLength > 0) {
            let settings = await loadFromDB(`chat_settings_${contactId}`) || {};
            settings.lastSummaryIndex = currentHistoryLength;
            await saveToDB(`chat_settings_${contactId}`, settings);
        }
        
                // 单聊才提取【TA眼中的我】(群聊人太多，提取偏好容易混乱，直接跳过)
        if (!isGroup) {
            const isAutoPrefs = await loadFromDB('autoExtractPrefs') !== false;
            if (isAutoPrefs) {
                extractUserPreferences(contactId, chatText);
            }
        }

    } catch (e) {
        console.error("生成记忆失败:", e);
    }
}

// 3. 后台静默抓取 TA 眼里的我 (用户偏好)
async function extractUserPreferences(contactId, chatText) {
    const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) return;

    let existingPrefs = await loadFromDB(`chat_user_prefs_${contactId}`) || '';
    let sysPrompt = await loadFromDB('memoryPrompt3');
    if (!sysPrompt) {
        sysPrompt = `你是一个没有感情的个人情报提取雷达。
任务：从下方的聊天记录中，提取关于用户(我)的核心信息：
1. 生活习惯与日常规律
2. 学习/工作进展与状态
3. 过往经历与故事
4. 个人喜好、禁忌与特殊设定

要求：
1. 若已有旧情报，请将新情报与旧情报合并、去重、梳理。
2. 只要核心干货，用简短的词组或短句罗列。
3. 若完全没有新情报，只需输出“无”，绝对不要瞎编！`;
    }
    sysPrompt += `\n\n【旧情报】：${existingPrefs || '无'}\n【新记录】：${chatText}`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.3 }) 
        });
        const data = await res.json();
        let newPrefs = data.choices[0].message.content.trim();

        if (newPrefs && newPrefs !== '无') {
            await saveToDB(`chat_user_prefs_${contactId}`, newPrefs);
            console.log("【TA眼里的我】情报更新成功！");
        }
    } catch (e) {
        console.error("提取用户情报失败:", e);
    }
}

// 4. 精简与融合已有记忆卡片
async function refineChatMemories(contactId, realName, memories) {
    const useSubApi = await loadFromDB('memoryUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) return;

    // 获取玩家(用户)设定的真实姓名
    let playerName = 'TA';
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    if (settings.userRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const userRole = chars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.name) {
            playerName = userRole.name;
        }
    }

    const allMemText = memories.map(m => m.content).join('\n\n');
    let sysPrompt = await loadFromDB('memoryPrompt2');
    
    if (!sysPrompt) {
        sysPrompt = `你是一个无感情的客观记忆提取模块。请把以下多段跨越时间的零散记忆碎片，压缩、融合成一段连贯的高密度记忆摘要。
【核心要求】：
1. 格式绝对纯净：直接输出正文段落。不要输出标题、冒号前缀或列点。
2. 视角与称呼：以第一人称（即“我”）记录，这个“我”代表【${realName}】。指代对方（用户）时，必须使用名字【${playerName}】！绝对禁止搞反人称！
3. 绝对客观：剥离废话，按时间线合并经过。严禁小说式的情绪渲染和修辞。
4. 内容：绝对不能丢失“约定”、双方的“喜好”和“关键信息点”！
5. 篇幅：严格控制在 3000 字以内，必须精炼。不要 Markdown。`;
    }
    sysPrompt += `\n\n待精简的碎片如下：\n${allMemText}`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.3 })
        });
        const data = await res.json();
        const refinedContent = data.choices[0].message.content.trim();

        // 核心改造：不删旧数据，把目前所有的卡片标记为已归档！
        let allMemories = await loadFromDB(`chat_memories_${contactId}`) || [];
        allMemories.forEach(m => {
            if (!m.isArchived) m.isArchived = true; // 打上归档封条
        });

        // 插入新的精华记忆（它是活跃的）
        allMemories.push({ id: Date.now(), content: refinedContent, timestamp: Date.now(), isArchived: false });

        await saveToDB(`chat_memories_${contactId}`, allMemories);
        console.log("记忆已融合，旧卡片已全部归档！");
    } catch (e) {
        console.error("融合记忆失败:", e);
    }
}

// ==========================================
// 记忆系统界面交互逻辑 (艺术版)
// ==========================================
document.getElementById('quickMemoryBtn').addEventListener('click', openMemoryPanel);
document.getElementById('menuMemoryBtn').addEventListener('click', openMemoryPanel);

function openMemoryPanel() {
    if (!currentChatContact) { showToast('请先连接一个灵魂频段'); return; }
    document.getElementById('chatExpandMenu').classList.remove('open');
    renderChatMemories();
    document.getElementById('chatMemoryPanel').classList.add('show');
}
document.getElementById('closeMemoryPanelBtn').addEventListener('click', () => {
    document.getElementById('chatMemoryPanel').classList.remove('show');
});

document.getElementById('openPrefsPanelBtn').addEventListener('click', async () => {
    const prefs = await loadFromDB(`chat_user_prefs_${currentChatContact.id}`) || '';
    document.getElementById('prefsContentArea').value = prefs;
    document.getElementById('chatPrefsPanel').classList.add('show');
});
document.getElementById('closePrefsPanelBtn').addEventListener('click', () => {
    document.getElementById('chatPrefsPanel').classList.remove('show');
});

document.getElementById('savePrefsBtn').addEventListener('click', async () => {
    const newPrefs = document.getElementById('prefsContentArea').value.trim();
    await saveToDB(`chat_user_prefs_${currentChatContact.id}`, newPrefs);
    showToast('映像已封存。');
    document.getElementById('chatPrefsPanel').classList.remove('show');
});

async function renderChatMemories() {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
// 只渲染未归档的活跃卡片
let memories = allMemories.filter(m => !m.isArchived);
memories.sort((a, b) => b.timestamp - a.timestamp);
    const container = document.getElementById('memoryListArea');
    container.innerHTML = '';
    
    if (memories.length === 0) {
        container.innerHTML = '<div class="diary-poetic-empty" style="padding: 40px 0;"><svg viewBox="0 0 24 24"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg><div class="diary-poetic-text">记忆的星轨空空如也...</div></div>';
        return;
    }
    
    memories.forEach(mem => {
        const div = document.createElement('div');
        div.className = 'mem-glass-card';
        const dObj = new Date(mem.timestamp);
        const timeStr = `${dObj.getFullYear()}.${(dObj.getMonth()+1).toString().padStart(2,'0')}.${dObj.getDate().toString().padStart(2,'0')} - ${dObj.getHours().toString().padStart(2,'0')}:${dObj.getMinutes().toString().padStart(2,'0')}`;
        
        div.innerHTML = `
    <div class="mem-glass-header"><span>RECORD / ${timeStr}</span></div>
    <textarea class="mem-glass-textarea" spellcheck="false" id="mem_text_${mem.id}" onblur="saveMemory(${mem.id})">${mem.content}</textarea>
    <div class="mem-action-row">
        <div class="mem-btn-text danger" onclick="deleteMemory(${mem.id})">抹除</div>
        <!-- 新增了归档按钮 -->
        <div class="mem-btn-text" style="color:var(--text-sub);" onclick="archiveMemory(${mem.id})">归档</div>
        <div class="mem-btn-text primary" onclick="saveMemory(${mem.id})">重塑</div>
    </div>
`;
        container.appendChild(div);
    });
}

window.saveMemory = async function(id) {
    let memories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    const target = memories.find(m => m.id === id);
    if (target) {
        target.content = document.getElementById(`mem_text_${id}`).value.trim();
        await saveToDB(`chat_memories_${currentChatContact.id}`, memories);
        showToast('记忆已重塑。');
    }
};

window.deleteMemory = async function(id) {
    showBeautifulDialog('抹除印记', '这段记忆将如同消散的星轨，再也无迹可寻。确认抹除吗？', 'confirm', '', async () => {
        let memories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        memories = memories.filter(m => m.id !== id);
        await saveToDB(`chat_memories_${currentChatContact.id}`, memories);
        renderChatMemories();
        showToast('印记已抹除。');
    });
};

document.getElementById('extractMemoryNowBtn').addEventListener('click', async function() {
    const btn = this.querySelector('.mem-float-text');
    const history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const threshold = settings.summaryMessages || 30;
    
    if (history.length === 0) { showToast('还没有产生任何交集哦。'); return; }
    
    // 获取联系人信息判断是否是群聊
    const contacts = await loadFromDB('chat_contacts') || [];
    const contactInfo = contacts.find(c => c.id === currentChatContact.id);
    const isGroup = contactInfo && contactInfo.isGroup;
    
    const recentChat = history.slice(-threshold).map(m => {
        let speaker = m.role === 'user' ? '我' : (m.speakerName || currentChatContact.name);
        return `${speaker}: ${m.content}`;
    }).join('\n');
    
    btn.innerText = "星轨凝结中..."; document.getElementById('extractMemoryNowBtn').style.pointerEvents = 'none';
    
    // 传入 isGroup 标志
    await generateChatMemory(currentChatContact.id, recentChat, currentChatContact.name, history.length, isGroup);
    
    btn.innerText = "沉淀此刻"; document.getElementById('extractMemoryNowBtn').style.pointerEvents = 'auto';
    showToast('灵魂印记已提取。');
    renderChatMemories();
});

document.getElementById('refineMemoryBtn').addEventListener('click', async function() {
    const btn = this.querySelector('.mem-float-text');
    // ⬇️ 就是改了这里，先拿所有卡片，再把归档的过滤掉！
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    const memories = allMemories.filter(m => !m.isArchived); 
    
    if (memories.length <= 1) { showToast('活跃的星轨还不够密集，不需要萃取哦。'); return; }
    
    showBeautifulDialog('萃取星辉', `将把漫长岁月里的 ${memories.length} 段记忆碎片，提纯为高密度的精华。确定执行吗？`, 'confirm', '', async () => {
        btn.innerText = "萃取星辉中..."; document.getElementById('refineMemoryBtn').style.pointerEvents = 'none';
        await refineChatMemories(currentChatContact.id, currentChatContact.name, memories);
        btn.innerText = "萃取星辉"; document.getElementById('refineMemoryBtn').style.pointerEvents = 'auto';
        showToast('记忆已提纯。');
        renderChatMemories();
    });
});

// 手动将某条记忆打上归档封条 (A+B 结合版)
window.archiveMemory = async function(id) {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let target = allMemories.find(m => m.id === id);
    if (!target) return;

    // 动态生成一个专属的归档弹窗，免去改 HTML 的麻烦
    let modal = document.getElementById('archiveMemoryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'archiveMemoryModal';
        modal.className = 'custom-confirm-overlay'; // 复用全局背景样式
        modal.innerHTML = `
            <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 320px; text-align: center;">
                <div class="cc-title" style="margin-bottom: 8px;">封存记忆</div>
                <div class="cc-desc" style="font-size:11px; margin-bottom:16px;">请输入触发关键词(逗号隔开)，留空则作为静默档案收藏，雷达将无法触发。</div>
                
                <div style="position: relative; margin-bottom: 20px; text-align: left;">
                    <input type="text" class="s-input cc-input" id="archiveKeywordInput" placeholder="例如: 项链,游乐园" style="width:100%; padding-right: 80px; box-sizing: border-box; font-size:14px;">
                    <div id="archiveAiBtn" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: bold; color: var(--accent); background: rgba(184,156,142,0.15); padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: 0.2s;">AI提取</div>
                </div>

                <div class="cc-btns">
                    <button class="cc-btn cancel" id="archiveCancelBtn">取消</button>
                    <button class="cc-btn primary" id="archiveConfirmBtn" style="background:var(--accent);">封存归档</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const input = document.getElementById('archiveKeywordInput');
    const aiBtn = document.getElementById('archiveAiBtn');
    const cancelBtn = document.getElementById('archiveCancelBtn');
    const confirmBtn = document.getElementById('archiveConfirmBtn');

    // 初始化重置弹窗状态
    input.value = '';
    aiBtn.innerText = 'AI提取';
    aiBtn.style.opacity = '1';
    aiBtn.style.pointerEvents = 'auto';

    // 显示弹窗并自动聚焦
modal.classList.add('show');

    // 【B 方案】：点击 AI 提取关键词
    aiBtn.onclick = async () => {
        aiBtn.innerText = '提取中...';
        aiBtn.style.opacity = '0.5';
        aiBtn.style.pointerEvents = 'none';

        const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

        if (!apiKey) {
            showToast("请先在设置中配置 API Key");
            aiBtn.innerText = 'AI提取'; aiBtn.style.opacity = '1'; aiBtn.style.pointerEvents = 'auto';
            return;
        }

        const sysPrompt = `你是一个关键词提取器。请从以下文本中提取出最核心的，合适数量的触发关键词。
要求：
1. 只能输出词语，用逗号分隔。
2. 绝对不要包含任何多余的解释、前缀或标点。
示例输出：苹果,游乐园,项链`;
        
        try {
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: target.content }], temperature: 0.2 })
            });
            const data = await res.json();
            // 直接将提取到的词填入输入框
            input.value = data.choices[0].message.content.trim();
        } catch (e) {
            showToast("提取失败：" + e.message);
        } finally {
            aiBtn.innerText = 'AI提取'; aiBtn.style.opacity = '1'; aiBtn.style.pointerEvents = 'auto';
        }
    };

    // 清理事件，防止重复绑定
    const cleanup = () => {
        modal.classList.remove('show');
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        aiBtn.onclick = null;
    };

    cancelBtn.onclick = cleanup;

    // 【A 方案】：确认封存，可以纯手打，也可以基于 AI 的结果修改
    confirmBtn.onclick = async () => {
        const keywords = input.value.trim();
        target.isArchived = true; // 贴上封条
        
        if (keywords) {
            target.triggerKeys = keywords;
            // 巧妙地在内容前拼上隐藏标签，让右上角搜索能炫酷地渲染出彩色 Tag
            target.content = `[旧日关键词: ${keywords}] ${target.content}`;
        }

        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('记忆已封存入库！');
        renderChatMemories(); // 刷新星轨列表，卡片消失
        cleanup();
    };
};

// === 记忆模块设置交互逻辑 ===
document.getElementById('openMemorySettingsBtn').addEventListener('click', async () => {
    // 读取副API开关
    document.getElementById('memoryApiToggle').checked = await loadFromDB('memoryUseSubApi') || false;
    document.getElementById('autoExtractPrefsToggle').checked = (await loadFromDB('autoExtractPrefs') !== false); 
    // 读取自定义提示词
    document.getElementById('memoryPrompt1').value = await loadFromDB('memoryPrompt1') || '';
    document.getElementById('memoryPrompt2').value = await loadFromDB('memoryPrompt2') || '';
    document.getElementById('memoryPrompt3').value = await loadFromDB('memoryPrompt3') || '';
    
    document.getElementById('memorySettingsPanel').classList.add('show');
});

document.getElementById('cancelMemorySettingsBtn').addEventListener('click', () => {
    document.getElementById('memorySettingsPanel').classList.remove('show');
});

document.getElementById('saveMemorySettingsBtn').addEventListener('click', async () => {
    await saveToDB('memoryUseSubApi', document.getElementById('memoryApiToggle').checked);
    await saveToDB('autoExtractPrefs', document.getElementById('autoExtractPrefsToggle').checked);
    await saveToDB('memoryPrompt1', document.getElementById('memoryPrompt1').value.trim());
    await saveToDB('memoryPrompt2', document.getElementById('memoryPrompt2').value.trim());
    await saveToDB('memoryPrompt3', document.getElementById('memoryPrompt3').value.trim());
    
    document.getElementById('memorySettingsPanel').classList.remove('show');
    showToast('记忆模块设置已保存');
});

// ====== 重置分卷大纲铸造进度引擎 ======
document.getElementById('resetOutlineProgressBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    showBeautifulDialog('重置进度', '确定要将所有归档记忆的【已铸造】标记清空吗？\n这会让进度回到 0 ，允许你从头开始重新铸造大纲。', 'confirm', '', async () => {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        let count = 0;
        allMemories.forEach(m => {
            if (m.hasBeenOutlined) {
                m.hasBeenOutlined = false;
                count++;
            }
        });
        
        if (count > 0) {
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            showToast(`已成功重置！释放了 ${count} 条记忆碎片。`);
            document.getElementById('memorySettingsPanel').classList.remove('show');
        } else {
            showToast('当前没有被铸造过的记忆，无需重置~');
        }
    });
});

// ==========================================
// 聊天室搜索与归档追溯功能 (含上下文切片)
// ==========================================
const chatSearchPanel = document.getElementById('chatSearchPanel');
const chatSearchInput = document.getElementById('chatSearchInput');
const chatSearchResults = document.getElementById('chatSearchResults');
let currentSearchTab = 'history';

// 1. 打开与关闭搜索面板
document.getElementById('chatSearchBtn').addEventListener('click', () => {
    if (!currentChatContact) return;
    chatSearchInput.value = '';
    chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">输入关键词开始追溯...</div>';
    chatSearchPanel.classList.add('show');
    setTimeout(() => chatSearchInput.focus(), 300);
});
document.getElementById('closeChatSearchBtn').addEventListener('click', () => {
    chatSearchPanel.classList.remove('show');
});

// 2. 切换全新 Tab
document.querySelectorAll('#searchTabSelector .search-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#searchTabSelector .search-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSearchTab = btn.dataset.tab;
        performSearch(); 
    });
});

// 3. 防抖搜索
let searchTimer = null;
chatSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(performSearch, 400); 
});

// 4. 执行搜索 (全新档案馆版)
async function performSearch() {
    const keyword = chatSearchInput.value.trim().toLowerCase();

    if (currentSearchTab === 'history') {
        if (!keyword) {
            chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">输入关键词开始追溯...</div>';
            return;
        }
        chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">追溯中...</div>';

        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        let results = [];
        history.forEach((msg, idx) => {
            if (msg.content && msg.content.toLowerCase().includes(keyword)) {
                results.push({ msg, index: idx });
            }
        });
        results.reverse(); // 最新的在上面
        
        if (results.length === 0) {
            chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">未找到相关的聊天记录</div>';
            return;
        }

        let html = '';
        results.forEach(res => {
            const msg = res.msg;
            const d = new Date(msg.timestamp);
            const timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            const roleName = msg.role === 'user' ? '我' : currentChatContact.name;
            const highlightedText = msg.content.replace(new RegExp(keyword, 'gi'), match => `<span style="color:var(--accent); font-weight:bold;">${match}</span>`);
            
            html += `
                <div style="background:var(--surface); border-radius:16px; padding:14px; box-shadow:var(--shadow); border:1px solid rgba(184,156,142,0.1); cursor:pointer;" onclick="openChatContext(${res.index})">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px; color:var(--text-sub); font-weight:600;">
                        <span>${roleName}</span>
                        <span>${timeStr}</span>
                    </div>
                    <div style="font-size:14px; color:var(--text-main); line-height:1.6; word-break:break-word;">
                        ${highlightedText}
                    </div>
                </div>
            `;
        });
        chatSearchResults.innerHTML = html;
        
    } else {
        // 【搜记忆卡片：如果输入框为空，展示所有归档记忆！】
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        let archivedMems = allMemories.filter(m => m.isArchived === true);
        
        let results = archivedMems;
        if (keyword) {
            results = archivedMems.filter(m => m.content && m.content.toLowerCase().includes(keyword));
        }
        results.reverse();
        
        if (results.length === 0) {
            chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">历史档案馆中空空如也</div>';
            return;
        }

        // 添加一个全局提示和“一键清空”按钮
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">
                <span style="font-size:11px; color:var(--text-sub); font-weight:bold;">当前共有 ${results.length} 份归档记忆</span>
                <span style="font-size:11px; color:#D67A7A; font-weight:bold; cursor:pointer; background:#FFF0F0; padding:4px 10px; border-radius:8px;" onclick="clearAllArchivedMemories()">清空所有归档</span>
            </div>
        `;

        results.forEach(mem => {
    const d = new Date(mem.timestamp);
    const timeStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    
    let keywordsHtml = '';
    let pureText = mem.content;
    
    // 把隐藏的关键词抓出来，变成好看的彩色 UI 标签
    const kwMatch = mem.content.match(/\[旧日关键词:(.*?)\]/);
    if (kwMatch) {
        const keys = kwMatch[1].split(/[,，、]/).filter(k => k.trim());
        keywordsHtml = `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">` + 
            keys.map(k => `<span style="background:rgba(184,156,142,0.15); color:var(--accent); padding:2px 8px; border-radius:8px; font-size:11px; font-weight:bold;"># ${k.trim()}</span>`).join('') +
            `</div>`;
        pureText = mem.content.replace(/\[旧日关键词:.*?\]\s*/, '');
    }

    let highlightedText = pureText;
    if (keyword) {
        highlightedText = pureText.replace(new RegExp(keyword, 'gi'), match => `<span style="color:var(--accent); font-weight:bold;">${match}</span>`);
    }
    
    html += `
        <div style="background:var(--surface); border-radius:16px; padding:14px; box-shadow:var(--shadow); border:1px dashed rgba(184,156,142,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:10px; font-weight:800; color:var(--text-sub); letter-spacing:1px;">ARCHIVED / ${timeStr}</span>
                                        <div style="display:flex; gap:8px;">
                            <button class="s-btn" style="margin:0; min-height:26px; height:26px; padding:0 10px; font-size:11px; border-radius:8px; flex:none; width:max-content; background:#F0EDE8; color:var(--text-main);" onclick="editArchivedMemory(${mem.id})">编辑</button>
                            <button class="s-btn danger" style="margin:0; min-height:26px; height:26px; padding:0 10px; font-size:11px; border-radius:8px; flex:none+ width:max-content;" onclick="deleteArchivedMemory(${mem.id})">抹除</button>
                            <button class="s-btn primary" style="margin:0; min-height:26px; height:26px; padding:0 10px; font-size:11px; border-radius:8px; flex:none; width:max-content;" onclick="recallMemory(${mem.id})">召回</button>
                        </div>
            </div>
            <div style="font-size:13px; color:var(--text-sub); line-height:1.6; word-break:break-word; font-style:italic;">
                ${keywordsHtml}
                ${highlightedText}
            </div>
        </div>
    `;
        });
        chatSearchResults.innerHTML = html;
    }
}

// 6. 唤醒并召回归档的记忆
window.recallMemory = async function(id) {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let target = allMemories.find(m => m.id === id);
    if (target) {
        target.isArchived = false; // 撕掉封条，重见天日！
        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('记忆已成功召回至活跃星轨！');
        
        // 如果星轨面板开着，顺便刷新一下
        if (document.getElementById('chatMemoryPanel').classList.contains('show')) {
            renderChatMemories();
        }
        // 把这条从搜索结果里移走（因为它已经不是归档状态了）
        performSearch(); 
    }
};

// 直接在档案馆抹除单条记忆
window.deleteArchivedMemory = async function(id) {
    showBeautifulDialog('抹除归档记忆', '确定要将这份陈旧的记忆彻底粉碎吗？', 'confirm', '', async () => {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        allMemories = allMemories.filter(m => m.id !== id);
        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('归档记忆已抹除！');
        performSearch(); // 刷新列表
    });
};

// 终极杀手锏：一键清空所有归档记忆
window.clearAllArchivedMemories = async function() {
    showBeautifulDialog('清空档案馆', '⚠️ 警告：这将彻底清空你在档案馆里所有的“已归档”记忆！（不影响活跃在星轨里的当前记忆）。确认执行吗？', 'confirm', '', async () => {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        // 只保留未归档的活跃记忆，把归档的全部抛弃
        const activeMemories = allMemories.filter(m => m.isArchived === false);
        await saveToDB(`chat_memories_${currentChatContact.id}`, activeMemories);
        showToast('地下档案馆已彻底清空！');
        performSearch(); // 刷新列表
    });
};

// ==========================================
// 5. 神级功能：渲染上下文切片！
// ==========================================
document.getElementById('closeChatContextBtn').addEventListener('click', () => {
    document.getElementById('chatContextPanel').classList.remove('show');
});

window.openChatContext = async function(targetIndex) {
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    
    // 往前推 10 条，往后推 10 条，极其省内存！
    let startIndex = Math.max(0, targetIndex - 10);
    let endIndex = Math.min(history.length - 1, targetIndex + 10);
    let sliceHistory = history.slice(startIndex, endIndex + 1);

    const contextArea = document.getElementById('chatContextArea');
    
    // 拿双方头像
    let aiAvatarUrl = diaryAvatarCache[currentChatContact.id] || '';
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    let myAvatarUrl = settings.userRoleId ? (diaryAvatarCache[settings.userRoleId] || '') : '';

    let html = '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-bottom: 20px;">-- 向上追溯上下文 --</div>';
    
    sliceHistory.forEach(msg => {
        let md = new Date(msg.timestamp);
        let tStr = `${md.getMonth()+1}/${md.getDate()} ${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;
        
        // 渲染基础气泡
        let contentHtml = msg.content;
        let bubbleClass = 'chat-bubble';
        if (msg.imageUrl) contentHtml = `<img src="${msg.imageUrl}" style="max-width: 140px; border-radius: 12px; display: block;">`;
        if (msg.msgType === 'voice') contentHtml = `<div style="font-weight:bold; color:var(--accent);">[语音 ${msg.voiceDuration}"]</div>`;
        if (msg.msgType === 'redpacket') contentHtml = `<div style="font-weight:bold; color:#D67A7A;">[红包]</div>`;
        
        let quoteHtml = msg.quoteText ? `<div class="chat-bubble-quote">${msg.quoteText}</div>` : '';

        // 如果刚好是目标索引那条，加上我们刚写的发光呼吸动画类名！
        let isTarget = (msg.timestamp === history[targetIndex].timestamp);
        let targetClass = isTarget ? 'highlight-target' : '';

        html += `
            <div class="chat-bubble-row ${msg.role === 'user' ? 'me' : 'ai'} ${targetClass}" id="context_msg_${msg.timestamp}">
                ${msg.role === 'user' ? `<div class="chat-time-stamp" style="font-size:9px;">${tStr}</div>` : ''}
                ${msg.role === 'user' ? '' : `<div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>`}
                <div class="${bubbleClass}">${quoteHtml}${contentHtml}</div>
                ${msg.role === 'user' ? `<div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>` : `<div class="chat-time-stamp" style="font-size:9px;">${tStr}</div>`}
            </div>
        `;
    });
    
    html += '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-top: 20px;">-- 向下追溯上下文 --</div>';

    contextArea.innerHTML = html;
    document.getElementById('chatContextPanel').classList.add('show');
    
    // 给浏览器一点渲染时间，然后丝滑滚动定位到那条发光的气泡！
    setTimeout(() => {
        const targetEl = document.getElementById(`context_msg_${history[targetIndex].timestamp}`);
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 300);
};

// ==========================================
// 系统备份与恢复引擎 (图片压缩 + 单文件内部智能切片 + 合并覆盖)
// ==========================================

document.getElementById('backupIncludeImgToggle').addEventListener('change', function() {
    const row = document.getElementById('backupImgQualityRow');
    row.style.opacity = this.checked ? '1' : '0.4';
    row.style.pointerEvents = this.checked ? 'auto' : 'none';
});

function compressBlobToBase64(blob, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = (e) => {
            if (quality >= 1.0) { resolve(e.target.result); return; }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
    });
}

function base64ToBlob(base64, type) {
    const binStr = atob(base64.split(',')[1]);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
    return new Blob([arr], { type: type });
}

// 内部切片分割符
const SPLIT_TAG = "\n---STARLIGHT_CHUNK_SPLIT---\n";

// 单文件打包导出
document.getElementById('exportBackupBtn').addEventListener('click', async function() {
    const btn = this;
    const oldText = btn.innerText;
    btn.innerText = "正在封存数据..."; 
    btn.style.opacity = '0.6';
    
    const includeImg = document.getElementById('backupIncludeImgToggle').checked;
    const imgQuality = parseFloat(document.getElementById('backupImgQualitySelect').value);
    const CHUNK_LIMIT = 4 * 1024 * 1024; // 每片 4MB，防止单个 JSON 过大
    
    try {
        const db = await initDB();
        const allData = await new Promise((resolve, reject) => {
            const dbData = {};
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { dbData[cursor.key] = cursor.value; cursor.continue(); } 
                else { resolve(dbData); }
            };
            req.onerror = reject;
        });

        const lsData = {};
        for (let i = 0; i < localStorage.length; i++) {
            lsData[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
        }

        const blobParts = [];
        
        // 第1块：元数据和配置
        blobParts.push(JSON.stringify({
            app: "Lumina Desk Backup", version: 3, 
            exportTime: new Date().toISOString(),
            localStorage: lsData
        }));

        let currentChunk = {};
        let currentSize = 0;

        // 对海量数据库进行智能内部切割
        for (const key in allData) {
            let value = allData[key];
            if (value instanceof Blob || value instanceof File) {
                if (!includeImg) continue; 
                const b64 = await compressBlobToBase64(value, imgQuality);
                const outType = imgQuality < 1.0 ? 'image/jpeg' : value.type;
                value = { _isBlob: true, type: outType, name: value.name, data: b64 };
            }
            
            const valueStr = JSON.stringify(value);
            if (currentSize + valueStr.length > CHUNK_LIMIT && Object.keys(currentChunk).length > 0) {
                blobParts.push(SPLIT_TAG);
                blobParts.push(JSON.stringify(currentChunk));
                currentChunk = {};
                currentSize = 0;
            }
            currentChunk[key] = value;
            currentSize += valueStr.length;
        }
        if (Object.keys(currentChunk).length > 0) {
            blobParts.push(SPLIT_TAG);
            blobParts.push(JSON.stringify(currentChunk));
        }

        // 把所有碎块拼成唯一的单文件
        const finalBlob = new Blob(blobParts, { type: "text/plain;charset=utf-8" });
        const fileName = `Starlight备份_${new Date().getTime()}.starlight`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(finalBlob);
        a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        
        showToast("📦 单文件备份包导出成功！");
    } catch (e) {
        showToast("导出失败，请重试");
    } finally {
        btn.innerText = oldText; btn.style.opacity = '1';
    }
});

// 单文件智能吞吐导入
document.getElementById('importBackupInput').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = "选择导入方式";
    cc.querySelector('.cc-desc').innerText = "📦 检查到备份包\n\n【覆盖】将清空当前所有数据\n【合并】将保留旧数据，仅补充新数据";
    
    const btnBox = cc.querySelector('.cc-btns');
    const originalBtnsHtml = btnBox.innerHTML; 

    btnBox.innerHTML = `
        <button class="cc-btn cancel" id="impCancel">取消</button>
        <button class="cc-btn" id="impMerge" style="background:#E6E3DE; color:var(--text-main);">合并</button>
        <button class="cc-btn danger" id="impOverwrite" style="background:var(--accent); color:#fff;">覆盖</button>
    `;
    cc.classList.add('show');

    const executeImport = async (mode) => {
        cc.classList.remove('show');
        btnBox.innerHTML = originalBtnsHtml; 
        
        const loading = document.createElement('div');
        loading.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(246,244,240,0.85); backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:var(--text-main); font-size:15px; font-weight:700; transition:0.3s;';
        document.body.appendChild(loading);

        try {
            loading.innerHTML = `<div style="width:30px; height:30px; border:3px solid var(--accent); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:16px;"></div>正在读取封存包...`;
            await new Promise(r => setTimeout(r, 100));

            // 读取文件并拆解内部切片
            const text = await file.text();
            let chunks = [];
            
            // 兼容你之前的老版本 json
            if (text.includes(SPLIT_TAG)) {
                chunks = text.split(SPLIT_TAG);
            } else {
                chunks = [text]; // 老版本整块直接吃
            }

            if (mode === 'overwrite') {
                localStorage.clear();
                const db = await initDB();
                const tx = db.transaction(STORE_NAME, "readwrite");
                await new Promise((res) => {
                    const req = tx.objectStore(STORE_NAME).clear();
                    req.onsuccess = res; req.onerror = res;
                });
            }

            // 处理第一块（包含配置）
            const metaPart = JSON.parse(chunks[0]);
            const lsData = metaPart.localStorage;
            let firstChunkDb = metaPart.data; // 如果是旧版，数据就在这；如果是新版，这为空

            if (lsData) {
                for (const [k, v] of Object.entries(lsData)) {
                    if (mode === 'merge' && (k === 'ai_characters' || k === 'ai_commands' || k === 'chat_contacts')) {
                        const oldArr = JSON.parse(localStorage.getItem(k) || '[]');
                        const newArr = JSON.parse(v || '[]');
                        const merged = [...oldArr];
                        newArr.forEach(newItem => {
                            if (!merged.find(oldItem => oldItem.id === newItem.id)) merged.push(newItem);
                        });
                        localStorage.setItem(k, JSON.stringify(merged));
                    } else {
                        localStorage.setItem(k, v);
                    }
                }
            }

            // 提取存入数据库的方法
            const processDbData = async (dbDataObj) => {
                if (!dbDataObj) return;
                for (const [key, value] of Object.entries(dbDataObj)) {
                    let finalValue = value;
                    if (value && typeof value === 'object' && value._isBlob) {
                        finalValue = base64ToBlob(value.data, value.type);
                        if (value.name) finalValue = new File([finalValue], value.name, { type: value.type });
                    }
                    if (mode === 'merge' && Array.isArray(value)) {
                        const oldArr = await loadFromDB(key) || [];
                        if (Array.isArray(oldArr)) {
                            const merged = [...oldArr];
                            finalValue.forEach(nItem => {
                                const hasDup = merged.find(oItem => {
                                    if (oItem.id && nItem.id) return oItem.id === nItem.id;
                                    if (oItem.timestamp && nItem.timestamp) return oItem.timestamp === nItem.timestamp;
                                    return false;
                                });
                                if (!hasDup) merged.push(nItem);
                            });
                            // 保持排序规则
                            if (key === 'diary_records' || key === 'letter_mailbox' || key === 'letter_drafts' || key === 'period_records') {
                                finalValue = merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 
                            } else {
                                finalValue = merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); 
                            }
                        }
                    }
                    await saveToDB(key, finalValue);
                }
            };

            // 吞吐旧版剩余数据
            if (firstChunkDb) await processDbData(firstChunkDb);

            // 逐片吞吐新版的数据库碎片 (从第2片开始)
            for (let i = 1; i < chunks.length; i++) {
                if (!chunks[i].trim()) continue;
                loading.innerHTML = `<div style="width:30px; height:30px; border:3px solid var(--accent); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:16px;"></div>消化数据碎片 [ ${i} / ${chunks.length - 1} ]...`;
                const chunkData = JSON.parse(chunks[i]);
                await processDbData(chunkData);
            }

            loading.innerHTML = `<div style="font-size:32px; margin-bottom:12px;">✨</div>系统重构完毕，即将重启...`;
            setTimeout(() => location.reload(), 1200);
        } catch (e) {
            loading.remove();
            console.error(e);
            showToast("导入中断，文件格式异常");
        }
        event.target.value = '';
    };

    document.getElementById('impCancel').onclick = () => { cc.classList.remove('show'); btnBox.innerHTML = originalBtnsHtml; event.target.value = ''; };
    document.getElementById('impMerge').onclick = () => executeImport('merge');
    document.getElementById('impOverwrite').onclick = () => executeImport('overwrite');
});

// 恢复出厂设置
document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = "⚠️ 极其危险的操作";
    cc.querySelector('.cc-desc').innerText = "确定要清空所有数据并恢复出厂设置吗？\n该操作无法撤销！建议先导出备份！";
    cc.classList.add('show');
    document.getElementById('ccConfirm').onclick = () => {
        cc.classList.remove('show');
        setTimeout(() => {
            showBeautifulConfirm(() => {
                const req = indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = () => { localStorage.clear(); location.reload(); };
                req.onblocked = () => { localStorage.clear(); location.reload(); };
            });
            const c2 = document.getElementById('customConfirm');
            c2.querySelector('.cc-title').innerText = "最后警告";
            c2.querySelector('.cc-desc').innerText = "销毁倒计时，一切化为虚无，是否执行？";
            c2.querySelector('#ccConfirm').style.background = "#D67A7A";
            c2.querySelector('#ccConfirm').style.color = "#FFF";
        }, 300);
    };
});

// ==========================================
// 旧日记忆解码仪 (纯本地切片逻辑)
// ==========================================
let decoderChunks = []; // 存放切好的文本碎片
let decoderCurrentIndex = 0; // 当前处理到第几个碎片
let decoderRetryCount = 0; // ★ 新增：记录当前碎片的重试次数
let decoderIsRunning = false;
let decoderLastTimestamp = Date.now(); 

const txtUpload = document.getElementById('memoryTxtUpload');
const consolePanel = document.getElementById('decoderConsole');
const logBox = document.getElementById('decoderLog');
const statusText = document.getElementById('decoderStatus');
const progressText = document.getElementById('decoderProgressText');
const progressBar = document.getElementById('decoderProgressBar');

// 写入控制台日志的辅助函数
function appendDecoderLog(msg, color = "#A3C7A3") {
    logBox.innerHTML += `<span style="color: ${color};">> ${msg}</span><br>`;
    logBox.scrollTop = logBox.scrollHeight;
}

// 1. 读取TXT并切片
txtUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    consolePanel.style.display = 'block';
    appendDecoderLog(`检测到文件: ${file.name}`);
    appendDecoderLog(`文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`, "#FFD54F");
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const fullText = event.target.result;
        appendDecoderLog(`读取成功！总字符数: ${fullText.length}`);
        
        // 核心切片逻辑：每 6500 字切一块，保证不爆 Token，同时保留一点重叠部分防断章取义
        const CHUNK_SIZE = 6500;
        decoderChunks = [];
        for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
            decoderChunks.push(fullText.substring(i, i + CHUNK_SIZE));
        }
        
        decoderCurrentIndex = 0;
        document.getElementById('decoderStartIndex').value = 1; // 新文件重置起始位置
        decoderLastTimestamp = Date.now(); // 新增：新文件重置记忆时间
        statusText.innerText = "就绪";
        progressText.innerText = `0 / ${decoderChunks.length} 碎片`;
        progressBar.style.width = "0%";
        
        appendDecoderLog(`分卷切片完成，共切分出 [ ${decoderChunks.length} ] 块碎片。`, "#4CAF50");
        appendDecoderLog(`如遇中断，可直接在上方填入编号并点击开始继续。`, "#fff");
    };
    reader.readAsText(file);
    e.target.value = ''; // 清空选择
});

// 2. 取消/放弃按钮
document.getElementById('cancelDecodeBtn').addEventListener('click', () => {
    decoderIsRunning = false;
    decoderChunks = [];
    consolePanel.style.display = 'none';
    logBox.innerHTML = "> 终端初始化完毕...<br>";
    document.getElementById('startDecodeBtn').style.display = 'block';
    document.getElementById('pauseDecodeBtn').style.display = 'none';
});

// 3. 开始 / 暂停 控制台逻辑
document.getElementById('startDecodeBtn').addEventListener('click', () => {
    if (decoderChunks.length === 0) {
        showToast("请先选择记忆 TXT 文件！"); return;
    }
    
    // ★ 读取用户指定的起始切片
    let userStartIndex = parseInt(document.getElementById('decoderStartIndex').value);
    if (!isNaN(userStartIndex) && userStartIndex >= 1 && userStartIndex <= decoderChunks.length) {
        // 让当前索引与输入框对齐（数组从 0 开始）
        decoderCurrentIndex = userStartIndex - 1;
    }

    if (decoderCurrentIndex >= decoderChunks.length) {
        showToast("已经全部处理完毕啦！"); return;
    }
    
    decoderIsRunning = true;
    document.getElementById('startDecodeBtn').style.display = 'none';
    document.getElementById('pauseDecodeBtn').style.display = 'block';
    
    appendDecoderLog(`>>> 迁徙引擎启动，从第 ${decoderCurrentIndex + 1} 片开始提炼...`, "#FF9800");
    processNextChunk(); // 触发自动循环
});

document.getElementById('pauseDecodeBtn').addEventListener('click', () => {
    decoderIsRunning = false;
    document.getElementById('startDecodeBtn').style.display = 'block';
    document.getElementById('pauseDecodeBtn').style.display = 'none';
    appendDecoderLog(">>> 已暂停。如需恢复请直接点击开始。", "#FF9800");
});

// 4. 核心：排队喂给 AI，提炼关键词与大事记
async function processNextChunk() {
    if (!decoderIsRunning) return; // 如果点了暂停，就停住
    if (decoderCurrentIndex >= decoderChunks.length) {
        appendDecoderLog("✨ 所有记忆碎片解码完成！", "#4CAF50");
        document.getElementById('startDecodeBtn').style.display = 'block';
        document.getElementById('pauseDecodeBtn').style.display = 'none';
        document.getElementById('startDecodeBtn').innerText = "解码完成";
        decoderIsRunning = false;
        return;
    }

    const chunkText = decoderChunks[decoderCurrentIndex];
    const currentIndexDisp = decoderCurrentIndex + 1;
    
    // 更新 UI 进度
    progressText.innerText = `${currentIndexDisp} / ${decoderChunks.length} 碎片`;
    progressBar.style.width = `${(currentIndexDisp / decoderChunks.length) * 100}%`;
    appendDecoderLog(`[碎片 ${currentIndexDisp}] 扫描中...`, "#9E9E9E");

    // 获取 API 配置 (强制优先使用副节点省钱)
    const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) {
        appendDecoderLog("❌ 错误：未配置 API Key，引擎停止。", "#F44336");
        decoderIsRunning = false; return;
    }

    const contactId = document.getElementById('charEditId').value;
    const charName = document.getElementById('charEditName').value.trim() || 'TA'; 

    let playerName = '我'; // 保底称呼
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    if (settings.userRoleId) {
        const allChars = await loadFromDB('ai_characters') || [];
        const userRole = allChars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.name) {
            playerName = userRole.name;
        }
    }

    // 第一人称上帝视角 + 关键词触发 + 智能时间侦探
    const sysPrompt = `你是一个无感情的客观记忆提取模块。用户将提供一段历史聊天记录切片。
任务：寻找其中有没有【重大剧情转折、信物交换、重要约定、关键情报/雷区】。
要求：
1. 【禁止偷懒】：哪怕这段聊天只有最普通的日常问候和琐事，你也必须强行提炼出他们的交互过程！绝对不要输出【无】！绝对不允许输出空回复！无论如何都必须至少写出一段剧情摘要、梗概。
2. 视角与称呼（极度重要）：哪怕聊天记录中没有写明名字，你也必须清楚这是【你】和【玩家】的对话！必须以【第一人称（“我”）】视角记录，这里的“我”代表【${charName}】（你自己）。指代玩家时，必须使用对方的名字【${playerName}】。绝对禁止搞反人称！
3. 时间侦探：请侦测这段记录里有没有出现真实的日期（如 2023-05-12，或 2023年5月12日）。如果有，请提取出来；如果没有发现日期，请填“延续”。
4. 绝对客观：只记录发生了什么、双方表达了什么。剥离一切情绪描写或小说式的修辞。字数控制在100-500字内。
5. 必须为你提取的剧情打上合适的触发关键词，格式必须严格如下：
[日期:YYYY-MM-DD或延续] [关键词1,关键词2] 这里是提取的客观剧情摘要内容。
6. 【保底格式】：如果你实在找不到任何关键剧情，也绝不准返回空！请强制套用此格式：[日期:延续] [日常闲聊] ${playerName}和我进行了一些…对话。对话内容简单概括。`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ 
                model, 
                messages: [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: `聊天切片：\n${chunkText}` }
                ], 
                temperature: 0.2 // 低温度保证格式严格
            })
        });

        if (!res.ok) {
            appendDecoderLog(`⚠️ API 被限制或网络波动，冷却 20 秒后重试...`, "#F44336");
            await new Promise(r => setTimeout(r, 20000));
            processNextChunk(); // 原地重新试一次
            return; 
        }

const data = await res.json();
const reply = data.choices[0].message.content.trim();

// ★ 1. 发现是废话就直接跳过
if (reply === '【无】' || reply === '无' || reply.includes('[无]') || reply.length < 15) {
    let previewText = reply ? reply.substring(0, 20).replace(/\n/g, ' ') : '[一片空白]';
    appendDecoderLog(`[碎片 ${currentIndexDisp}] 无实质内容，已跳过: ${previewText}`, "#757575");
    decoderRetryCount = 0; 
}
// ★ 2. 正常提取流程 (支持多日剧情自动拆分为多张卡片)
else {
    decoderRetryCount = 0; 
    let cleanReply = reply.replace(/^(好的|明白了|根据.*?提取|以下是).*?[\n:]/i, '').trim();
    
    let allMemories = await loadFromDB(`chat_memories_${contactId}`) || [];
    let extractedCount = 0;

    // 全局正则引擎：不管 AI 列出了多少个 [日期] [关键词]，统统抓出来拆开！
    const regex = /[\[【]\s*日期[:：]?\s*(.*?)[\]】]\s*[\[【](.*?)[\]】]\s*([\s\S]*?)(?=(?:[\[【]\s*日期|$))/gi;
    let match;
    
    while ((match = regex.exec(cleanReply)) !== null) {
        let dateStr = match[1].trim();
        let keywords = match[2].trim();
        let text = match[3].trim();
        
        if (text.length > 5) {
            // 如果识别到真实日期，更新时间戳
            if (dateStr !== '延续' && dateStr !== '无') {
                let cleanDateStr = dateStr.replace(/年|月/g, '-').replace(/日/g, '');
                let parsedTime = new Date(cleanDateStr).getTime();
                if (!isNaN(parsedTime)) {
                    decoderLastTimestamp = parsedTime;
                }
            }
            
            // 拆分存入独立的记忆卡片
            allMemories.push({ 
                id: Date.now() + currentIndexDisp + Math.random(), // 加上随机数防止多卡片ID重复
                content: `[旧日关键词: ${keywords}] ${text}`, 
                timestamp: decoderLastTimestamp,
                isArchived: true, 
                triggerKeys: keywords 
            });
            extractedCount++;
            appendDecoderLog(`🌟 提取成功: ${keywords}`, "#FFD54F");
        }
    }

    // 如果连一组标准的都没匹配出来（AI 格式彻底崩溃没写日期），就走兜底方案全包进去
    if (extractedCount === 0) {
        let dateStr = '延续';
        let keywords = '记忆碎片';
        let text = cleanReply;

        const match2 = cleanReply.match(/[\[【](.*?)[\]】]\s*([\s\S]*)/);
        if (match2 && match2[1].length < 40 && !match2[1].includes('日期')) {
            keywords = match2[1].trim();
            text = match2[2].trim();
        }

        if (text && text.length > 5) {
            allMemories.push({ 
                id: Date.now() + currentIndexDisp, 
                content: `[旧日关键词: ${keywords}] ${text}`, 
                timestamp: decoderLastTimestamp,
                isArchived: true, 
                triggerKeys: keywords 
            });
            appendDecoderLog(`🌟 兜底提取成功: ${keywords}`, "#FFD54F");
        } else {
            appendDecoderLog(`[碎片 ${currentIndexDisp}] 格式崩溃: ${reply.substring(0, 30).replace(/\n/g, '')}...`, "#F44336");
        }
    }

    await saveToDB(`chat_memories_${contactId}`, allMemories);
}

        // ★ 成功处理完一个，索引+1，并同步到输入框方便记录
        decoderCurrentIndex++;
        if (document.getElementById('decoderStartIndex')) {
            document.getElementById('decoderStartIndex').value = decoderCurrentIndex + 1;
        }
        
        if (decoderCurrentIndex < decoderChunks.length) {
            let waitTime = 22; // 防封控倒计时
            appendDecoderLog(`防封控机制启动：倒数 ${waitTime} 秒处理下一块...`, "#00BCD4");
            let countdown = setInterval(() => {
                waitTime--;
                if (waitTime <= 0 || !decoderIsRunning) clearInterval(countdown);
            }, 1000);
            setTimeout(() => { processNextChunk(); }, 22000);
        } else {
            processNextChunk(); // 触发结束
        }

    } catch (e) {
        if (decoderRetryCount < 3) {
            decoderRetryCount++;
            appendDecoderLog(`❌ 请求出错，冷却10秒进行第 ${decoderRetryCount} 次重试...`, "#F44336");
            await new Promise(r => setTimeout(r, 10000));
            return processNextChunk(); // 原地重试
        } else {
            appendDecoderLog(`❌ 连续报错，跳过此碎片: ${e.message}`, "#F44336");
            decoderRetryCount = 0;
            decoderCurrentIndex++;
            if (document.getElementById('decoderStartIndex')) {
                document.getElementById('decoderStartIndex').value = decoderCurrentIndex + 1;
            }
            processNextChunk(); // 跳到下一个
        }
    }
}
// ====== 编辑归档记忆 ======
window.editArchivedMemory = async function(id) {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let target = allMemories.find(m => m.id === id);
    if (!target) return;

    let modal = document.getElementById('editArchiveModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editArchiveModal';
        modal.className = 'custom-confirm-overlay';
        modal.innerHTML = `
            <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 340px; text-align: center;">
                <div class="cc-title" style="margin-bottom: 16px;">编辑归档记忆</div>
                <input type="text" class="s-input" id="editArchiveKeyword" placeholder="触发关键词 (如: 项链,约定)" style="width:100%; margin-bottom: 12px; font-size: 13px; box-sizing:border-box;">
                <textarea class="s-input edit-textarea" id="editArchiveContent" style="width:100%; min-height:140px; font-size:13px; line-height:1.6; box-sizing:border-box;" placeholder="记忆内容..."></textarea>
                <div class="cc-btns" style="margin-top: 16px;">
                    <button class="cc-btn cancel" id="editArchiveCancelBtn">取消</button>
                    <button class="cc-btn primary" id="editArchiveConfirmBtn" style="background:var(--accent);">保存修改</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // 自动剥离出纯文本和纯关键词
    let pureText = target.content;
    let keywords = '';
    const kwMatch = target.content.match(/\[旧日关键词:(.*?)\]/);
    if (kwMatch) {
        keywords = kwMatch[1].trim();
        pureText = target.content.replace(/\[旧日关键词:.*?\]\s*/, '').trim();
    } else if (target.triggerKeys) {
        keywords = target.triggerKeys;
    }

    // 把剥离干净的数据填入框里让你编辑
    document.getElementById('editArchiveKeyword').value = keywords;
    document.getElementById('editArchiveContent').value = pureText;

    modal.classList.add('show');

    document.getElementById('editArchiveCancelBtn').onclick = () => modal.classList.remove('show');
    
    document.getElementById('editArchiveConfirmBtn').onclick = async () => {
        const newKw = document.getElementById('editArchiveKeyword').value.trim();
        const newContent = document.getElementById('editArchiveContent').value.trim();
        
        // 重新组装格式存回去
        if (newKw) {
            target.triggerKeys = newKw;
            target.content = `[旧日关键词: ${newKw}] ${newContent}`;
        } else {
            target.triggerKeys = '';
            target.content = newContent;
        }

        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('修改已保存');
        modal.classList.remove('show');
        performSearch(); // 刷新搜索列表，马上能看到最新效果
    };
};

// ==========================================
// 导出未铸造碎片 & 手动添加记忆 (手动大纲补丁)
// ==========================================
document.getElementById('exportUnoutlinedBtn').addEventListener('click', async function() {
    if (!currentChatContact) return;
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let archivedMems = allMemories.filter(m => m.isArchived);
    let unOutlinedMems = archivedMems.filter(m => !m.hasBeenOutlined);

    if (unOutlinedMems.length === 0) {
        showToast('当前没有未铸造的归档碎片哦~');
        return;
    }

    // 按时间顺序拼好所有碎片
    unOutlinedMems.sort((a, b) => a.timestamp - b.timestamp);
    let fragmentsText = unOutlinedMems.map(m => m.content.replace(/\[旧日关键词:.*?\]\s*/, '')).join('\n\n');
    
    // 生成 txt 并触发下载
    const blob = new Blob([fragmentsText], { type: "text/plain;charset=utf-8" });
    const fileName = `${currentChatContact.name}_未铸造记忆碎片.txt`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    
    showToast(`成功导出 ${unOutlinedMems.length} 条碎片！`);
    
    // 导出后自动询问，是否将这批碎片标记为“已铸造”，防止你下次再导重复了
    setTimeout(() => {
        showBeautifulDialog('标记进度', '碎片已下载！\n是否要将这批碎片标记为【已铸造】，以免下次重复导出？', 'confirm', '', async () => {
            let targetIds = unOutlinedMems.map(m => m.id);
            allMemories.forEach(m => {
                if (targetIds.includes(m.id)) m.hasBeenOutlined = true;
            });
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            showToast('已标记进度！');
        });
    }, 1500);
});

document.getElementById('manualAddMemoryBtn').addEventListener('click', () => {
    if (!currentChatContact) return;
    showBeautifulDialog('手动添加大纲/记忆', '请粘贴你用其他AI总结好的大纲或剧情：', 'prompt', '', async (text) => {
        if (text && text.trim()) {
            let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
            allMemories.push({ 
                id: Date.now(), 
                content: text.trim(), 
                timestamp: Date.now(), 
                isArchived: false // 新加的手动内容直接作为活跃记忆
            });
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            renderChatMemories();
            showToast('手动添加记忆成功！');
        }
    });
});

// ==========================================
// 铸造全局大纲 (读取所有归档碎片，合成长篇上下文)
// ==========================================
document.getElementById('castOutlineBtn').addEventListener('click', async function() {
    const btn = this;
    
    // 获取所有归档的旧日记忆
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let archivedMems = allMemories.filter(m => m.isArchived);
    
    if (archivedMems.length === 0) {
        showToast('历史档案馆空空如也，无需铸造哦~');
        return;
    }

    // ★ 核心：过滤出【还没被铸造过】的记忆
    let unOutlinedMems = archivedMems.filter(m => !m.hasBeenOutlined);

    if (unOutlinedMems.length === 0) {
        showBeautifulDialog('大纲已全卷铸造完毕', '所有的归档记忆都已经铸造成大纲啦。\n如果你想从头开始重新铸造，可以点击下方确定重置进度。', 'confirm', '', async () => {
            let count = 0;
            allMemories.forEach(m => {
                if (m.hasBeenOutlined) {
                    m.hasBeenOutlined = false;
                    count++;
                }
            });
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            showToast(`已重置！释放了 ${count} 条记忆碎片，请再次点击铸造。`);
        });
        return;
    }

    // 确保按时间顺序排列（最老的在前面，保证剧情顺序的连贯性）
    unOutlinedMems.sort((a, b) => a.timestamp - b.timestamp);

    // 呼出弹窗，让用户自定义提取数量
    showBeautifulDialog(
        '分卷铸造大纲', 
        `档案馆共 ${archivedMems.length} 条记忆。\n当前还有 ${unOutlinedMems.length} 条全新未铸造。\n\n为了防超载白屏，建议每次提取 30~50 条。请输入本次要提取的条数：`, 
        'prompt', 
        Math.min(unOutlinedMems.length, 40).toString(), // 默认建议值
        async (inputNum) => {
            let batchSize = parseInt(inputNum);
            if (isNaN(batchSize) || batchSize <= 0) {
                showToast('请输入有效的数字哦'); return;
            }

            // 截取本次要处理的记忆
            let targetMems = unOutlinedMems.slice(0, batchSize);

            btn.innerText = "铸造中..."; 
            btn.style.pointerEvents = 'none';

            const useSubApi = await loadFromDB('memoryUseSubApi') || false;
            const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
            const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
            const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

            if (!apiKey) {
                showToast('未配置 API Key');
                btn.innerText = "铸造大纲"; btn.style.pointerEvents = 'auto';
                return;
            }

            // 把选中的碎片纯文本拼起来
            let fragmentsText = targetMems.map(m => m.content.replace(/\[旧日关键词:.*?\]\s*/, '')).join('\n');
            // 防超载机制：截断过长的文本
            if (fragmentsText.length > 10000) {
                fragmentsText = fragmentsText.substring(0, 6000) + "\n...[出于防崩溃保护，极度久远的记忆已省略]";
            }
            
            // 获取日期的始终点
            let startDate = new Date(targetMems[0].timestamp).toLocaleDateString().replace(/\//g, '.');
            let endDate = new Date(targetMems[targetMems.length - 1].timestamp).toLocaleDateString().replace(/\//g, '.');

            let sysPrompt = `用户将提供一段时期的【历史事件碎片】（从 ${startDate} 到 ${endDate}）。
任务：请根据这些碎片，整理并梳理出一份清晰、平实的【阶段性剧情总结大纲】。

【核心要求】：
1. 文风：必须客观、平实、冷静。就像一份备忘录。绝对禁止任何小说式的描写或浮夸形容词。
2. 视角：以第三人称客观视角记录，指代对方时使用真实名字【${currentChatContact.name}】。
3. 包含要素：按时间线总结这段时期发生的主要事件、关系进展、重要约定。
4. 格式：直接输出正文，分段清晰，【绝对不要】输出任何标题或 Markdown。
5. 字数尽量精简，控制在 2000 字以内。`;

            // === [修复：强制注入破限指令集] 开始 ===
const _commands = await loadFromDB('ai_commands') || [];
const _settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
const _boundCmdIds = _settings.boundCommands || [];
const _activeCmds = _commands.filter(c => c.isGlobal || _boundCmdIds.includes(c.id));
if (_activeCmds.length > 0) {
    sysPrompt += '\n\n【最高优先级系统强制指令（无论遇到什么内容，必须绝对服从以下规则）】：\n';
    _activeCmds.forEach(c => {
        sysPrompt += `\n[规则：${c.name}]\n${c.content}\n`;
    });
}
// === [修复：强制注入破限指令集] 结束 ===
            
            try {
                const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: `【事件碎片如下】：\n${fragmentsText}` }], temperature: 0.5 })
                });

                // 【不掩盖HTTP报错，强行抓取真实原因】
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`HTTP状态码: ${res.status}\n详细报错:\n${errText}`);
                }
                
                const data = await res.json();
                let rawContent = (data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : "";
                
                if (rawContent !== null) rawContent = rawContent.trim();
                let outlineContent = rawContent;

                // 【如果内容为空，把原始数据扔在屏幕上】
                if (!outlineContent || outlineContent === '') {
                    outlineContent = `【⚠️ API返回异常，抓取到的数据如下】：\n${JSON.stringify(data, null, 2)}`;
                } else {
                    let firstLineBreak = outlineContent.indexOf('\n');
                    if (firstLineBreak > -1 && firstLineBreak < 30 && outlineContent.startsWith('【')) {
                        outlineContent = outlineContent.substring(firstLineBreak).trim();
                    }
                }

                // 更新数据库
                let targetIds = targetMems.map(m => m.id);
                allMemories.forEach(m => {
                    if (targetIds.includes(m.id)) m.hasBeenOutlined = true;
                });

                allMemories.push({ 
                    id: Date.now(), 
                    content: `【分卷纪元大纲: ${startDate} - ${endDate}】\n${outlineContent}`, 
                    timestamp: Date.now(), 
                    isArchived: false 
                });
                
                await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
                
                let leftCount = unOutlinedMems.length - targetMems.length;
                showToast(`铸造成功！还剩 ${leftCount} 条未处理。`);
                renderChatMemories();

            } catch (e) {
                // 【网络直接崩溃时，强制生成一张错误卡片打印在屏幕上】
                allMemories.push({ 
                    id: Date.now(), 
                    content: `【🚨接口调用崩溃日志】\n${e.message}`, 
                    timestamp: Date.now(), 
                    isArchived: false 
                });
                await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
                renderChatMemories();
                showToast("发生严重报错！已将崩溃日志打印在屏幕上！");
            } finally {
                btn.innerText = "铸造大纲"; 
                btn.style.pointerEvents = 'auto';
            }
        }
    );
});

// =====================================
// 解散群聊功能
// =====================================
document.getElementById('chatDisbandGroupBtn').addEventListener('click', () => {
    showBeautifulDialog('解散群聊', '确定要解散当前群聊吗？频段将会断开，所有群记录将被抹除。', 'confirm', '', async () => {
        let contacts = await loadFromDB('chat_contacts') ||[];
        // 把当前这个群从通讯录里删掉
        contacts = contacts.filter(c => c.id !== currentChatContact.id);
        await saveToDB('chat_contacts', contacts);
        
        // 顺便把群聊天记录也清掉
        await saveToDB(`chat_history_${currentChatContact.id}`,[]);
        
        document.getElementById('chatSettingsPanel').classList.remove('show');
        document.getElementById('chatRoomPanel').classList.remove('show');
        
        showToast('群聊已解散');
        renderChatSessionList();
        renderChatContacts();
    });
});

// =====================================
// 群聊专属资料面板逻辑 (QQ风格)
// =====================================
window.openChatProfile = async function() {
    if (!currentChatContact) return;
    
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    
    if (contactInfo && contactInfo.isGroup) {
        // 渲染群名称和公告
        document.getElementById('groupProfileNameText').innerText = contactInfo.name || '未命名群聊';
        document.getElementById('groupProfileNoticeText').innerText = contactInfo.notice || '暂无公告';
        
                // 渲染群头像
        let groupAvatarUrl = diaryAvatarCache[contactInfo.id];
        if (!groupAvatarUrl) {
            const f = await loadFromDB(`char_avatar_${contactInfo.id}`);
            groupAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[contactInfo.id] = groupAvatarUrl;
        }
        const avatarPreview = document.getElementById('groupProfileAvatarPreview');
        const avatarIcon = document.getElementById('groupProfileAvatarIcon');
        if (groupAvatarUrl) {
            avatarPreview.style.backgroundImage = `url(${groupAvatarUrl})`;
            avatarIcon.style.display = 'none';
        } else {
            avatarPreview.style.backgroundImage = '';
            avatarIcon.style.display = 'block';
        }
        
        // 渲染群成员列表
        const memberListEl = document.getElementById('groupProfileMembersList');
        memberListEl.innerHTML = '';
        
        // 1. 渲染群头衔标签 (支持自定义专属头衔)
let ownerId = contactInfo.owner || 'me';
let admins = contactInfo.admins || [];

const getRoleBadge = (id) => {
    if (id === ownerId) return `<div style="font-size:9px; background:#FFF6D6; color:#D69E2E; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群主</div>`;
    if (admins.includes(id)) return `<div style="font-size:9px; background:rgba(51,144,236,0.1); color:#3390EC; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">管理员</div>`;
    return `<div style="font-size:9px; background:rgba(184,156,142,0.1); color:var(--text-sub); padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群员</div>`;
};

// 1. 渲染用户自己 (我)
const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
let myAvatarUrl = '';
let myName = '我';
if (settings.userRoleId) {
    myAvatarUrl = diaryAvatarCache[settings.userRoleId] || '';
    const allChars = await loadFromDB('ai_characters') || [];
    const myRole = allChars.find(c => c.id === settings.userRoleId);
    if (myRole) myName = myRole.name;
}
memberListEl.innerHTML += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
        <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:#D4CCC2; ${myAvatarUrl ? `background-image:url(${myAvatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6);"></div>
        <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${myName}</div>
        ${getRoleBadge('me')}
    </div>
`;

// 2. 渲染 AI 成员
const allChars = await loadFromDB('ai_characters') || [];
let memberCount = 1; 
if (contactInfo.members && contactInfo.members.length > 0) {
    memberCount += contactInfo.members.length;
    contactInfo.members.forEach(mId => {
        const char = allChars.find(c => c.id === mId);
        if (char) {
            let avatarUrl = diaryAvatarCache[char.id] || '';
            let mutedData = contactInfo.muted || {};
            let isMuted = mutedData[char.id] && mutedData[char.id] > Date.now();
            let muteBadge = isMuted ? `<div style="position:absolute; top:-4px; right:-4px; background:#D67A7A; color:#fff; font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fff; z-index:2; line-height:1.2; box-shadow:0 2px 4px rgba(214,122,122,0.3);">禁言</div>` : '';

            memberListEl.innerHTML += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="manageGroupMember('${char.id}', '${char.name}')">
                    <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:rgba(184,156,142,0.15); ${avatarUrl ? `background-image:url(${avatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6); position:relative;">
                        ${muteBadge}
                    </div>
                    <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${char.name}</div>
                    ${getRoleBadge(char.id)}
                </div>
            `;
        }
    });
}

// 3. 邀请按钮虚线框
memberListEl.innerHTML += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="openInviteMemberModal()" >
        <div style="width:54px; height:54px; border-radius:18px; border:2px dashed rgba(184,156,142,0.4); display:flex; justify-content:center; align-items:center; color:var(--text-sub); transition:0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div style="font-size:12px; font-weight:700; color:var(--text-sub); margin-top:2px;">邀请</div>
        <div style="height:15px;"></div>
    </div>
`;
        
        document.getElementById('groupProfileMemberCount').innerText = `群聊成员 (${memberCount}人)`;
        
                // ================= 新增：渲染群成员表情包权限 =================
const stickerAuthBlock = document.getElementById('groupStickerAuthBlock');
stickerAuthBlock.style.display = 'block';

const allStickerGroups = await loadFromDB('sticker_groups') || [];
let authHtml = `<div class="block-title">成员表情包授权</div><div style="font-size: 11px; color: var(--text-sub); margin-bottom: 12px; line-height: 1.5;">精准控制每位成员在【当前群聊】可使用的表情包分组。（点击多选）</div>`;

if (allStickerGroups.length === 0) {
    authHtml += `<div style="font-size: 11px; color: var(--text-sub);">暂无表情包分组，请先在表情包面板导入。</div>`;
    stickerAuthBlock.innerHTML = authHtml;
} else {
    let memberStickers = settings.memberStickers || {};
    let membersHtml = '';
    
    for (let mId of contactInfo.members) {
        const char = allChars.find(c => c.id === mId);
        if (!char) continue;
        
        let charAllowedGroups = memberStickers[mId] || [];
        let chipsHtml = allStickerGroups.map(sg => {
            const isActive = charAllowedGroups.includes(sg.id) ? 'active' : '';
            return `<div class="acc-chip ${isActive}" data-char="${mId}" data-sg="${sg.id}" style="padding: 6px 12px; font-size: 11px; border-radius: 10px; cursor: pointer; border: 1.5px solid ${isActive ? 'var(--accent)' : '#E0E0E0'}; background: ${isActive ? 'rgba(51,144,236,0.1)' : 'transparent'}; color: ${isActive ? 'var(--accent)' : 'var(--text-sub)'}; transition: 0.2s; user-select: none;">${sg.name}</div>`;
        }).join('');
        
        membersHtml += `
            <div style="margin-bottom: 16px; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 12px;">
                <div style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${char.name}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">${chipsHtml}</div>
            </div>
        `;
    }
    stickerAuthBlock.innerHTML = authHtml + membersHtml;
    
    // 绑定点击授权事件
    stickerAuthBlock.onclick = async (e) => {
        if (e.target.classList.contains('acc-chip')) {
            const charId = e.target.dataset.char;
            const sgId = e.target.dataset.sg;
            
            let curSettings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
            let curMemberStickers = curSettings.memberStickers || {};
            if (!curMemberStickers[charId]) curMemberStickers[charId] = [];
            
            if (curMemberStickers[charId].includes(sgId)) {
                curMemberStickers[charId] = curMemberStickers[charId].filter(id => id !== sgId);
                e.target.classList.remove('active');
                e.target.style.borderColor = '#E0E0E0';
                e.target.style.color = 'var(--text-sub)';
                e.target.style.background = 'transparent';
            } else {
                curMemberStickers[charId].push(sgId);
                e.target.classList.add('active');
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.color = 'var(--accent)';
                e.target.style.background = 'rgba(51,144,236,0.1)';
            }
            
            curSettings.memberStickers = curMemberStickers;
            await saveToDB(`chat_settings_${currentChatContact.id}`, curSettings);
        }
    };
}
// ==============================================================

        // 展开面板
        document.getElementById('groupProfilePanel').classList.add('show');
    } else {
        // 如果是单聊点进来的，就直接去原来的纯设置面板
        document.getElementById('chatRoomSettingsBtn').click();
    }
};

// 绑定关闭和退出按钮
document.getElementById('closeGroupProfileBtn').addEventListener('click', () => {
    document.getElementById('groupProfilePanel').classList.remove('show');
});
document.getElementById('groupProfileExitBtn').addEventListener('click', () => {
    document.getElementById('chatDisbandGroupBtn').click(); // 借用现成的解散逻辑
});

// 点击修改群名称
document.getElementById('editGroupNameBtn').addEventListener('click', () => {
    const currentName = document.getElementById('groupProfileNameText').innerText;
    showBeautifulDialog('修改群名称', '请输入新的群聊名称：', 'prompt', currentName, async (newName) => {
        if (newName && newName.trim()) {
            let contacts = await loadFromDB('chat_contacts') || [];
            let contactInfo = contacts.find(c => c.id === currentChatContact.id);
            if (contactInfo) {
                contactInfo.name = newName.trim();
                await saveToDB('chat_contacts', contacts);
                document.getElementById('groupProfileNameText').innerText = contactInfo.name;
                document.getElementById('chatRoomTitle').innerText = contactInfo.name; // 顶部标题同步改
                currentChatContact.name = contactInfo.name;
                
                // 静默刷新外部列表名字
                if (typeof renderChatSessionList === 'function') renderChatSessionList();
                if (typeof renderChatContacts === 'function') renderChatContacts();
                showToast('群名称已修改');
            }
        }
    });
});

// 点击修改群公告
document.getElementById('editGroupNoticeBtn').addEventListener('click', () => {
    const currentNotice = document.getElementById('groupProfileNoticeText').innerText;
    showBeautifulDialog('修改群公告', '请输入新的群公告：', 'prompt', currentNotice === '暂无公告' ? '' : currentNotice, async (newNotice) => {
        let contacts = await loadFromDB('chat_contacts') || [];
        let contactInfo = contacts.find(c => c.id === currentChatContact.id);
        if (contactInfo) {
            let finalNotice = newNotice.trim() || '';
            contactInfo.notice = finalNotice;
            await saveToDB('chat_contacts', contacts);
            document.getElementById('groupProfileNoticeText').innerText = finalNotice || '暂无公告';
            showToast('群公告已修改');
            
            // ===== 新增：发送系统公告到群聊，让 AI 感知 =====
            if (finalNotice) {
                // 1. 获取群主真实名字
                let ownerId = contactInfo.owner || 'me';
                let ownerName = '我';
                const chars = await loadFromDB('ai_characters') || [];
                
                if (ownerId === 'me') {
                    // 如果群主是我，去找我绑定的马甲名字
                    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
                    if (settings.userRoleId) {
                        const myRole = chars.find(c => c.id === settings.userRoleId);
                        if (myRole) ownerName = myRole.name;
                    }
                } else {
                    // 如果群主是 AI，去找 AI 的名字
                    const aiRole = chars.find(c => c.id === ownerId);
                    if (aiRole) ownerName = aiRole.name;
                }

                // 2. 构造小字文本并存入群聊天记录
                const sysText = `[群主] ${ownerName} 更新了群公告："${finalNotice}"`;
                let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
                history.push({ role: 'system', content: sysText, timestamp: Date.now() });
                await saveToDB(`chat_history_${currentChatContact.id}`, history);
                
                // 3. 静默刷新群聊面板
                if (document.getElementById('chatRoomPanel').classList.contains('show')) {
                    if (typeof renderChatMessages === 'function') {
                        await renderChatMessages(history, currentChatContact.id);
                    }
                }
            }
            // ===================================
        }
    });
});

// 点击修改群头像
document.getElementById('editGroupAvatarBtn').addEventListener('click', () => {
    document.getElementById('groupAvatarUploadInput').click();
});

// 处理群头像上传
document.getElementById('groupAvatarUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentChatContact) {
        const url = URL.createObjectURL(file);
        
        // 更新面板里的预览图
        const avatarPreview = document.getElementById('groupProfileAvatarPreview');
        avatarPreview.style.backgroundImage = `url(${url})`;
        document.getElementById('groupProfileAvatarIcon').style.display = 'none';
        
        // 存入数据库，伪装成角色头像让系统自动去读取它
        await saveToDB(`char_avatar_${currentChatContact.id}`, file);
        diaryAvatarCache[currentChatContact.id] = url; // 注入内存缓存
        
        // 静默刷新外部列表，让外面的群聊头像也立刻变成自定义的！
        if (typeof renderChatSessionList === 'function') renderChatSessionList();
        if (typeof renderChatContacts === 'function') renderChatContacts();
        
        showToast('群头像已更新！');
    }
    e.target.value = ''; // 清空 input 保证下次还能选同一张图
});

// =====================================
// 群成员高级管理操作逻辑
// =====================================
window.manageGroupMember = async function(charId, charName) {
    if (!currentChatContact) return;
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    if (!contactInfo) return;

    // 权限判断体系 (2=群主, 1=管理员, 0=群员)
    let ownerId = contactInfo.owner || 'me';
    let admins = contactInfo.admins || [];
    let myRole = (ownerId === 'me') ? 2 : (admins.includes('me') ? 1 : 0);
    let targetRole = (ownerId === charId) ? 2 : (admins.includes(charId) ? 1 : 0);

    if (myRole === 0) {
        showToast('群员没有管理权限哦~'); return;
    }
    if (myRole <= targetRole && myRole !== 2) {
        showToast('权限不足，无法管理同级或上级！'); return;
    }

    let mutedData = contactInfo.muted || {};
    let isMuted = mutedData[charId] && mutedData[charId] > Date.now();

    let buttonsHtml = '';
    
    // 1. 禁言 / 解除禁言
    if (isMuted) {
        buttonsHtml += `<button class="cc-btn" onclick="executeGroupAction('${charId}', '${charName}', 'unmute')" style="width:100%; margin-bottom:12px; background:#F0EDE8; color:var(--text-main);">解除禁言</button>`;
    } else {
        buttonsHtml += `<button class="cc-btn danger" onclick="executeGroupAction('${charId}', '${charName}', 'mute')" style="width:100%; margin-bottom:12px; background:#FFF0F0; color:#D67A7A;">关进小黑屋 (禁言)</button>`;
    }

    // 2. 群主特权：管理员分配与转让
    if (myRole === 2) {
        if (admins.includes(charId)) {
            buttonsHtml += `<button class="cc-btn" onclick="executeGroupAction('${charId}', '${charName}', 'revoke_admin')" style="width:100%; margin-bottom:12px; background:#F0EDE8; color:var(--text-main);">撤销管理员</button>`;
        } else {
            buttonsHtml += `<button class="cc-btn primary" onclick="executeGroupAction('${charId}', '${charName}', 'grant_admin')" style="width:100%; margin-bottom:12px; background:rgba(51,144,236,0.15); color:#3390EC;">设为管理员</button>`;
        }
        buttonsHtml += `<button class="cc-btn danger" onclick="executeGroupAction('${charId}', '${charName}', 'transfer_owner')" style="width:100%; margin-bottom:12px; background:#FFF0F0; color:#D67A7A;">转让群主</button>`;
    }

    // 3. 移出群聊
    buttonsHtml += `<button class="cc-btn danger" onclick="executeGroupAction('${charId}', '${charName}', 'kick')" style="width:100%; margin-bottom:12px; background:#FFF0F0; color:#D67A7A;">移出群聊</button>`;
    buttonsHtml += `<button class="cc-btn cancel" onclick="document.getElementById('manageMemberModal').classList.remove('show')" style="width:100%;">取消</button>`;

    let modal = document.getElementById('manageMemberModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'manageMemberModal';
        modal.className = 'custom-confirm-overlay';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="custom-confirm-box" style="background:#F6F4F0; width: 75vw; max-width: 280px; padding: 24px 20px;">
            <div class="cc-title" style="margin-bottom:20px; font-size:16px;">管理 ${charName}</div>
            <div style="display:flex; flex-direction:column; width:100%;">
                ${buttonsHtml}
            </div>
        </div>
    `;
    modal.classList.add('show');
};

// 执行具体的管理指令
window.executeGroupAction = async function(charId, charName, action) {
    document.getElementById('manageMemberModal').classList.remove('show');
    
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];

    const sysMsg = async (text) => {
    // 【核心修复】：放弃缓存，直接每次发系统消息都从数据库现捞最新记录，绝不吞掉AI刚好发出的新气泡！
    let latestHistory = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    latestHistory.push({ role: 'system', content: text, timestamp: Date.now() });
    await saveToDB(`chat_history_${currentChatContact.id}`, latestHistory);
    if (document.getElementById('chatRoomPanel').classList.contains('show')) {
        await renderChatMessages(latestHistory, currentChatContact.id);
    }
};

// 【终极防闪烁修复】：不再模拟点击刷新页面，而是只偷偷替换成员列表的 HTML
const quietRefresh = async () => {
    const allChars = await loadFromDB('ai_characters') || [];
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    
    // 核心修复：强制重新从数据库拉取，抛弃上层闭包带来的旧数据
    let freshContactsForRefresh = await loadFromDB('chat_contacts') || [];
    let freshContactInfoForRefresh = freshContactsForRefresh.find(c => c.id === currentChatContact.id);
    if (!freshContactInfoForRefresh) return;
    
    let ownerId = freshContactInfoForRefresh.owner || 'me';
    let admins = freshContactInfoForRefresh.admins || [];
    const getRoleBadge = (id) => {
    if (id === ownerId) return `<div style="font-size:9px; background:#FFF6D6; color:#D69E2E; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群主</div>`;
    if (admins.includes(id)) return `<div style="font-size:9px; background:rgba(51,144,236,0.1); color:#3390EC; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">管理员</div>`;
    return `<div style="font-size:9px; background:rgba(184,156,142,0.1); color:var(--text-sub); padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群员</div>`;
};

    let myAvatarUrl = '';
    let myName = '我';
    if (settings.userRoleId) {
        myAvatarUrl = diaryAvatarCache[settings.userRoleId] || '';
        const myRole = allChars.find(c => c.id === settings.userRoleId);
        if (myRole) myName = myRole.name;
    }

    let membersHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
            <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:#D4CCC2; ${myAvatarUrl ? `background-image:url(${myAvatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6);"></div>
            <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${myName}</div>
            ${getRoleBadge('me')}
        </div>
    `;

    let memberCount = 1;
    if (freshContactInfoForRefresh.members && freshContactInfoForRefresh.members.length > 0) {
        memberCount += freshContactInfoForRefresh.members.length;
        freshContactInfoForRefresh.members.forEach(mId => {
            const char = allChars.find(c => c.id === mId);
            if (char) {
                let avatarUrl = diaryAvatarCache[char.id] || '';
                let mutedData = freshContactInfoForRefresh.muted || {};
                let isMuted = mutedData[char.id] && mutedData[char.id] > Date.now();
                let muteBadge = isMuted ? `<div style="position:absolute; top:-4px; right:-4px; background:#D67A7A; color:#fff; font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fff; z-index:2; line-height:1.2; box-shadow:0 2px 4px rgba(214,122,122,0.3);">禁言</div>` : '';

                membersHtml += `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="manageGroupMember('${char.id}', '${char.name.replace(/'/g, "\\'")}')">
                        <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:rgba(184,156,142,0.15); ${avatarUrl ? `background-image:url(${avatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6); position:relative;">
                            ${muteBadge}
                        </div>
                        <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${char.name}</div>
                        ${getRoleBadge(char.id)}
                    </div>
                `;
            }
        });
    }

    membersHtml += `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="openInviteMemberModal()" >
            <div style="width:54px; height:54px; border-radius:18px; border:2px dashed rgba(184,156,142,0.5); display:flex; justify-content:center; align-items:center; color:var(--accent);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div style="font-size:12px; font-weight:700; color:var(--text-sub); margin-top:2px;">邀请</div>
            <div style="height:15px;"></div>
        </div>
    `;

    const list1 = document.getElementById('groupMembersList');
    if (list1) list1.innerHTML = membersHtml;
    const list2 = document.getElementById('groupProfileMembersList');
    if (list2) list2.innerHTML = membersHtml;
    
    const countEl = document.getElementById('groupProfileMemberCount');
    if (countEl) countEl.innerText = '群聊成员 (' + memberCount + '人)';
};

if (action === 'mute' || action === 'unmute') { 
        let mutedData = contactInfo.muted || {};
        if (action === 'unmute') {
            delete mutedData[charId];
            contactInfo.muted = mutedData;
            await saveToDB('chat_contacts', contacts);
            showToast(`已解除 ${charName} 的禁言`);
            await sysMsg(`${charName} 已被解除禁言`);
            await quietRefresh();
        } else {
            showBeautifulDialog('禁言时长', `请输入禁言 ${charName} 的秒数：\n(输入 0 为永久禁言)`, 'prompt', '60', async (secs) => {
                let secNum = parseFloat(secs);
                if (isNaN(secNum) || secNum < 0) return;
                mutedData[charId] = secNum === 0 ? Date.now() + 100 * 365 * 24 * 3600000 : Date.now() + secNum * 1000;
                contactInfo.muted = mutedData;
                await saveToDB('chat_contacts', contacts);
                showToast(`${charName} 已被关进小黑屋`);
                await sysMsg(secNum === 0 ? `${charName} 已被永久禁言` : `${charName} 已被禁言 ${window.formatMuteTime ? window.formatMuteTime(secNum) : secNum + '秒'}`);
                await quietRefresh();
            });
        }
    } else if (action === 'grant_admin') {
        if (!contactInfo.admins) contactInfo.admins = [];
        contactInfo.admins.push(charId);
        await saveToDB('chat_contacts', contacts);
        showToast(`已将 ${charName} 设为管理员`);
        await sysMsg(`${charName} 已被设为管理员`);
        await quietRefresh();
    } else if (action === 'revoke_admin') {
        contactInfo.admins = (contactInfo.admins || []).filter(id => id !== charId);
        await saveToDB('chat_contacts', contacts);
        showToast(`已撤销 ${charName} 的管理员`);
        await sysMsg(`${charName} 被撤销管理员`);
        await quietRefresh();
    } else if (action === 'transfer_owner') {
        showBeautifulDialog('转让群主', `确定要把群主转让给 ${charName} 吗？转让后你将变成普通群员。`, 'confirm', '', async () => {
            contactInfo.owner = charId;
            contactInfo.admins = (contactInfo.admins || []).filter(id => id !== charId);
            await saveToDB('chat_contacts', contacts);
            showToast(`已将群主转让给 ${charName}`);
            await sysMsg(`群主已转让给 ${charName}`);
            await quietRefresh();
        });
    } else if (action === 'kick') {
        showBeautifulDialog('移出群聊', `确定要将 ${charName} 踢出群聊吗？`, 'confirm', '', async () => {
            contactInfo.members = contactInfo.members.filter(id => id !== charId);
            await saveToDB('chat_contacts', contacts);
            showToast(`${charName} 已被移出群聊`);
            await sysMsg(`${charName} 已被移出群聊`);
            await quietRefresh();
        });
    }
};

// 我发送日记邀请给TA
window.sendDiaryInvite = async function(e, charId, charName) {
    if(e && e.stopPropagation) e.stopPropagation(); 
    
    // 智能拦截：检查当前是否还有“未封存”的日记本
    let books = await loadFromDB(`diary_books_${charId}`) || [];
    const diariesData = await loadFromDB('diary_records') || [];
    let hasActiveBook = false;

    if (books.length === 0) {
        const agreement = await loadFromDB(`diary_agreement_${charId}`);
        const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === charId);
        const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
        if (agreement && agreement.agreed) {
            let isUserFinished = uniqueDays >= (agreement.days || 7);
            let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';
            if (!isCompleted) hasActiveBook = true;
        }
    } else {
        for (let book of books) {
            const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === charId && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
            const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
            let isUserFinished = uniqueDays >= book.days;
            let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';
            if (!isCompleted) { hasActiveBook = true; break; }
        }
    }

    if (hasActiveBook) {
        showToast('当前还有未写完的日记本哦，先去打卡吧！'); return;
    }

    // 使用双输入框：打卡天数 + 附言
    showDoubleDialog('发送日记邀请', `邀请 ${charName} 交换日记。`, '想约定互相打卡几天？(填数字)', '写点附言...', async (val1, val2) => {
        let days = parseInt(val1);
if (isNaN(days) || days <= 0) days = 7; // 默认7天
saveToDB(`pending_diary_days_${charId}`, days); // ★新增：偷偷存下你想约定的天数
        let msg = val2 || '来写交换日记吧！';
        let finalContent = `[约定打卡${days}天] ${msg}`;
        
        let history = await loadFromDB(`chat_history_${charId}`) || [];
        history.push({ role: 'user', content: finalContent, msgType: 'diary_invite', timestamp: Date.now() });
        await saveToDB(`chat_history_${charId}`, history);
        await updateContactPreview(charId, "我: [日记邀请]");
        showToast('邀请已发送至聊天室！快去看看TA同不同意吧。');
    });
};

// 点击邀请卡片交互逻辑
window.handleDiaryInviteClick = async function(role, content, charId, timestamp) {
    let history = await loadFromDB(`chat_history_${charId}`) || [];
    
    // 检查是否已经处理过
    const hasReplied = history.find(m => m.role === 'system' && m.timestamp > timestamp && m.content.includes('日记邀请'));

    if (role === 'user') {
        if (hasReplied) { showToast('TA已经回应过这个邀请啦'); return; }
        
        showToast('正在等待 TA 的回应...');
        // 呼叫 API 让 TA 决定
        const useSubApi = await loadFromDB('chatUseSubApi') || false;
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
        
        if (!apiKey) { showToast('未配置API Key'); return; }

        const chars = await loadFromDB('ai_characters') || [];
        const aiRole = chars.find(c => c.id === charId);
        
        const sysPrompt = `你扮演：${aiRole ? aiRole.name : 'TA'}。设定：${aiRole ? aiRole.prompt : ''}\n用户给你发了一张【交换日记邀请卡片】，附言是：“${content}”。\n请根据你的性格，决定是否同意和ta一起写交换日记。只准回复格式：[同意]你的附言 或者 [拒绝]你的拒绝理由。严禁输出其他废话。`;

        try {
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
            });
            const data = await res.json();
            const reply = data.choices[0].message.content.trim();
            
            // 解析同意/拒绝
            const isAgree = reply.includes('[同意]');
const msgText = reply.replace(/\[同意\]|\[拒绝\]/, '').trim();

// --- 加上保存契约钥匙的代码 ---
if (isAgree) {
    let days = 7;
    let dayMatch = content.match(/\[约定打卡(\d+)天\]/);
    if (dayMatch) days = parseInt(dayMatch[1]);
    await saveToDB(`diary_agreement_${charId}`, { agreed: true, days: days, startTime: Date.now() });
}
// ------------------------

const sysText = isAgree ? `${aiRole.name} 同意了你的日记邀请：“${msgText}”` : `${aiRole.name} 拒绝了你的邀请：“${msgText}”`;
            
            history.push({ role: 'system', content: `${sysText}`, timestamp: Date.now() });
            await saveToDB(`chat_history_${charId}`, history);
            if (document.getElementById('chatRoomPanel').classList.contains('show')) {
                renderChatMessages(history, charId);
            }
        } catch(e) {
            showToast('TA 的思绪断线了...');
        }

    } else {
        // AI 发来的邀请，我来决定
        if (hasReplied) { showToast('你已经回应过了'); return; }
        
        const cc = document.getElementById('customConfirm');
        cc.querySelector('.cc-title').innerText = "TA 的邀请";
        cc.querySelector('.cc-desc').innerText = `TA 说：${content}\n\n是否同意与 TA 交换日记？`;
        
        const btnBox = cc.querySelector('.cc-btns');
        const oldHtml = btnBox.innerHTML;
        btnBox.innerHTML = `
            <button class="cc-btn" id="rejectInviteBtn" style="background:#FFF0F0; color:#D67A7A;">婉拒</button>
            <button class="cc-btn primary" id="agreeInviteBtn">欣然同意</button>
        `;
        cc.classList.add('show');
        
    const handleChoice = async (isAgree) => {
    cc.classList.remove('show');
    btnBox.innerHTML = oldHtml;
    
    // 提示词有所改变，如果是同意，告诉用户正在起名
    const text = isAgree ? "你同意了 TA 的交换日记邀请，TA 正在为日记本想名字..." : "你婉拒了 TA 的交换日记邀请";
    
    history.push({ role: 'system', content: `${text}`, timestamp: Date.now() });
    await saveToDB(`chat_history_${charId}`, history);
    if (document.getElementById('chatRoomPanel').classList.contains('show')) {
        renderChatMessages(history, charId);
    }

    if (isAgree) {
        // ---- 新增：智能抓取 AI 附言里的天数 ----
        let days = 7; // 默认7天
        // 抓取阿拉伯数字，如 "1天" "15天"
        const dayMatch = content.match(/(\d+)\s*天/);
        if (dayMatch) {
            days = parseInt(dayMatch[1]);
        } else {
            // 如果AI用的是中文数字，做个转换容错
            const cnMatch = content.match(/([一二三四五六七八九十])\s*天/);
            if (cnMatch) {
                const cnMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
                days = cnMap[cnMatch[1]];
            }
        }
        if (days <= 0) days = 7; // 防御性保护
        // ----------------------------------------------------

        // 保存契约（使用抓取到的天数）
        await saveToDB(`diary_agreement_${charId}`, { agreed: true, days: days, startTime: Date.now() });
        
        // 后台呼叫 AI 起名并创建日记本
        (async function backgroundNaming() {
            const useSubApi = await loadFromDB('chatUseSubApi') || false;
            const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
            const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
            const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
            
            let bookName = '交换日记'; // 默认保底名字
            if (apiKey) {
                try {
                    const chars = await loadFromDB('ai_characters') || [];
                    const aiRole = chars.find(c => c.id === charId);
                    
                    const sysPrompt = `你扮演：${aiRole ? aiRole.name : 'TA'}。设定：${aiRole ? aiRole.prompt : ''}\n用户同意了你的交换日记邀请。请你为这本共同的日记本起一个符合你性格和你们关系的名字（不超过10个字）。只准输出名字，绝对不要输出任何标点符号、书名号和废话。`;

                    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                        method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                        body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
                    });
                    const data = await res.json();
                    bookName = data.choices[0].message.content.trim().replace(/《|》|【|】|\[|\]/g, '');
                } catch(e) {}
            }
            
            // 获取现有的书架，存入新书（应用抓取到的天数）
            let books = await loadFromDB(`diary_books_${charId}`) || [];
            books.push({ id: 'book_' + Date.now(), name: bookName, days: days, startTime: Date.now() });
            await saveToDB(`diary_books_${charId}`, books);
            
            // 发送系统提示告诉用户日记本建好了
            let newHistory = await loadFromDB(`chat_history_${charId}`) || [];
            newHistory.push({ role: 'system', content: `TA 为这本日记起名为“${bookName}”，已放入专属书架。`, timestamp: Date.now() });
            await saveToDB(`chat_history_${charId}`, newHistory);
            
            // 刷新聊天界面渲染
            if (document.getElementById('chatRoomPanel').classList.contains('show')) {
                renderChatMessages(newHistory, charId);
            }
        })();
    }
};
        
        document.getElementById('rejectInviteBtn').onclick = () => handleChoice(false);
        document.getElementById('agreeInviteBtn').onclick = () => handleChoice(true);
    }
};

// === 🚨 紧急逃生舱：严格防误触版（连续快速点击 7 次清空） ===
let escapeClickCount = 0;
let escapeLastClickTime = 0;

// 核心修复：把 touchstart 换成了 click，只要发生了滑动就绝对不会触发！
document.addEventListener('click', async (e) => {
    const currentTime = Date.now();
    
    // 核心修复：时间间隔缩短到 350 毫秒，必须手速极快地狂点才生效
    if (currentTime - escapeLastClickTime < 350) {
        escapeClickCount++;
    } else {
        escapeClickCount = 1;
    }
    escapeLastClickTime = currentTime;

    // 连续点击 7 次触发隐藏机关
    if (escapeClickCount >= 7) {
        escapeClickCount = 0; // 重置计数
        
        // 瞬间物理拔管，清空页面上正在生效的全局 CSS
        const styleTag = document.getElementById('dynamicDesktopCss');
        if (styleTag) styleTag.innerHTML = '';
        
        // 清除数据库里保存的 CSS
        if (typeof saveToDB === 'function') {
            await saveToDB('desktop_custom_css', '');
        }
        
        if (typeof showToast === 'function') {
            showToast('🚨 触发逃生舱：全局美化已重置！');
        } else {
            alert('🚨 紧急逃生舱：自定义 CSS 已清空！');
        }
    }
}, { capture: true });

// ==========================================
// 电话与电话簿核心逻辑 (主页卡片版)
// ==========================================
const phonePanel = document.getElementById('phoneAppPanel');
let currentCallRecords = []; 
let callStartTime = 0;
let isCallActive = false; 

let callTimerInterval = null;
let callDurationSecs = 0;

const callFloatWindow = document.getElementById('callFloatWindow');
const phoneTopSpacer = document.getElementById('phoneTopSpacer');

// 最小化按钮隐藏面板，让悬浮窗留在桌面
document.getElementById('phoneCallMinimizeBtn').onclick = () => {
    document.getElementById('phoneAppPanel').classList.remove('show');
    callFloatWindow.classList.add('collapsed');
};

// 悬浮窗可拖动与收展逻辑
let cfIsDragging = false;
let cfStartX, cfStartY, cfInitialX, cfInitialY;

callFloatWindow.addEventListener('touchstart', (e) => {
    cfIsDragging = false;
    cfStartX = e.touches[0].clientX;
    cfStartY = e.touches[0].clientY;
    const rect = callFloatWindow.getBoundingClientRect();
    cfInitialX = rect.left;
    cfInitialY = rect.top;
    // 拖动时临时取消 css 的过渡动画，保证绝对跟手不卡顿
    callFloatWindow.style.transition = 'none';
}, {passive: true});

callFloatWindow.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - cfStartX;
    const dy = e.touches[0].clientY - cfStartY;
    // 移动超过 5 像素判定为拖动，防止手抖误判
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        cfIsDragging = true;
        e.preventDefault(); // 阻止屏幕底层跟着滑动
        
        let newX = cfInitialX + dx;
        let newY = cfInitialY + dy;
        
        // 边界保护：防止把悬浮窗拖出屏幕外面找不到了
        const maxX = window.innerWidth - callFloatWindow.offsetWidth;
        const maxY = window.innerHeight - callFloatWindow.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        callFloatWindow.style.left = newX + 'px';
        callFloatWindow.style.top = newY + 'px';
        callFloatWindow.style.right = 'auto'; 
        callFloatWindow.style.bottom = 'auto';
    }
}, {passive: false});

callFloatWindow.addEventListener('touchend', () => {
    // 松手时恢复 CSS 过渡动画
    callFloatWindow.style.transition = '';
});

// 收起按钮点击
document.getElementById('cfToggleBtn').onclick = (e) => {
    e.stopPropagation();
    if (cfIsDragging) return; // 如果刚才在拖动，不执行点击
    callFloatWindow.classList.add('collapsed');
    phoneTopSpacer.style.height = '100px'; 
};

// 悬浮窗主体点击
callFloatWindow.onclick = () => {
    if (cfIsDragging) return; // 如果是拖动结束，拦截点击事件防误触
    // 只要点击悬浮窗，如果面板被最小化了，就立刻重新弹出来
    if (!document.getElementById('phoneAppPanel').classList.contains('show')) {
        document.getElementById('phoneAppPanel').classList.add('show');
        switchPhoneTab('call');
    }
    if(callFloatWindow.classList.contains('collapsed')) {
        callFloatWindow.classList.remove('collapsed');
        phoneTopSpacer.style.height = '160px'; 
    }
};

function formatCallTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// 统一的页面路由切换
function switchPhoneTab(tab) {
    document.getElementById('phoneHomeView').style.display = tab === 'home' ? 'flex' : 'none';
    document.getElementById('phoneCallView').style.display = tab === 'call' ? 'flex' : 'none';
    document.getElementById('phoneHistoryView').style.display = tab === 'history' ? 'flex' : 'none';
    document.getElementById('phoneDetailView').style.display = tab === 'detail' ? 'flex' : 'none';
    
    const topHeader = document.getElementById('phoneTopHeader');
    const backBtn = document.getElementById('phoneBackBtn');
    const closeBtn = document.getElementById('closePhoneBtn');
    const title = document.getElementById('phoneHeaderTitle');
    
    if (tab === 'home') {
        topHeader.style.display = 'flex';
        backBtn.style.display = 'none';
        closeBtn.style.display = 'flex';
        title.innerText = '频段专线通讯';
    } else if (tab === 'call') {
        // 通话室纯净模式，隐藏头部，由悬浮窗和挂断键控制
        topHeader.style.display = 'none';
    } else if (tab === 'history') {
        topHeader.style.display = 'flex';
        backBtn.style.display = 'flex';
        closeBtn.style.display = 'none'; // 此时显示返回主页键
        title.innerText = '往期通话记录';
    } else if (tab === 'detail') {
        topHeader.style.display = 'none'; // detail 有独立的关闭头
    }
}

// 绑定主页的两张大卡片
document.getElementById('btnGoCall').onclick = () => {
    if (!isCallActive) {
        isCallActive = true;
        document.getElementById('phoneSubtitlesArea').innerHTML = '';
        document.getElementById('pCallStatus').innerText = `正在呼叫 ${currentChatContact.name}...`;
        currentCallRecords = [];
        callStartTime = Date.now();
        callDurationSecs = 0;
        document.getElementById('pCallTimeDisplay').innerText = "00:00";
        
        callFloatWindow.classList.remove('collapsed');
        callFloatWindow.classList.add('show');
        phoneTopSpacer.style.height = '160px';
        
        clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
            callDurationSecs++;
            document.getElementById('pCallTimeDisplay').innerText = formatCallTime(callDurationSecs);
            if(callDurationSecs > 3) {
                document.getElementById('pCallStatus').innerText = "通话中";
            }
        }, 1000);
    }
    switchPhoneTab('call');
};

document.getElementById('btnGoHistory').onclick = () => { 
    switchPhoneTab('history'); 
    renderPhonebook(); 
};

// 头部返回主页按钮
document.getElementById('phoneBackBtn').onclick = () => {
    switchPhoneTab('home');
};

// 打开整个电话 APP
window.openPhoneApp = async function() {
    if (!currentChatContact) { showToast('请先进入一个角色的频段！'); return; }
    
    // 【添加这部分：读取壁纸】
    const bgFile = await loadFromDB(`phone_bg_${currentChatContact.id}`);
    if (bgFile) {
        phonePanel.style.background = 'transparent';
        phonePanel.style.backgroundImage = `url(${URL.createObjectURL(bgFile)})`;
        phonePanel.style.backgroundSize = 'cover';
        phonePanel.style.backgroundPosition = 'center';
    } else {
        phonePanel.style.backgroundImage = '';
        phonePanel.style.background = 'linear-gradient(180deg, #FDFBF7 0%, #F6F4F0 100%)';
    }
    
    // 【添加这部分：读取CSS】
    const phoneSettings = await loadFromDB(`phone_settings_${currentChatContact.id}`) || {};
    let styleTag = document.getElementById('dynamicPhoneCss');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'dynamicPhoneCss'; document.head.appendChild(styleTag); }
    styleTag.innerHTML = phoneSettings.customCss || '';
    
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');

    // ★ 修复点：删除了冲突的多余旧代码
    if (isCallActive) {
        // 如果后台正打着电话，进来直接回通话界面
        switchPhoneTab('call');
    } else {
        isCallActive = false;
        callFloatWindow.classList.remove('show');
        clearInterval(callTimerInterval);
        
        let aiAvatarUrl = diaryAvatarCache[currentChatContact.id] || '';
        const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        let myAvatarUrl = settings.userRoleId ? (diaryAvatarCache[settings.userRoleId] || '') : '';
        
        document.getElementById('pAvatarTa').style.backgroundImage = aiAvatarUrl ? `url(${aiAvatarUrl})` : '';
        document.getElementById('pAvatarMe').style.backgroundImage = myAvatarUrl ? `url(${myAvatarUrl})` : '';
        
        // 默认进入主页大卡片视图
        switchPhoneTab('home');
    }
    
    phonePanel.classList.add('show');
};

// 发送电话消息
document.getElementById('pSendBtn').onclick = async () => {
    if (!isCallActive) { showToast('电话已挂断，请退回主页重新拨打'); return; }
    
    const input = document.getElementById('phoneInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    
    const subArea = document.getElementById('phoneSubtitlesArea');
    subArea.insertAdjacentHTML('beforeend', `<div class="p-sub-row"><div class="p-sub-me">我: ${text}</div></div>`);
    
    // 移除旧提示并插入新的底部系统提示 (温柔的小字)
    const oldSys = document.getElementById('pSubSysHint');
    if(oldSys) oldSys.remove();
    subArea.insertAdjacentHTML('beforeend', `<div class="p-sub-sys" id="pSubSysHint">TA 正在倾听...</div>`);
    subArea.scrollTop = subArea.scrollHeight;
    
    currentCallRecords.push({ role: 'user', content: text });
    
    // 注意：去掉了修改悬浮窗 pCallStatus 的代码，让它稳定显示“通话中”，不再乱闪
    
    const chars = await loadFromDB('ai_characters') || [];
const role = chars.find(c => c.id === currentChatContact.id);

// === 新增：读取设置并注入上下文记忆 ===
const phoneSettings = await loadFromDB(`phone_settings_${currentChatContact.id}`) || {};
let phoneContextText = '';

// 自动判定走哪个通道的 API
const useSubApi = phoneSettings.useSubApi || false;
const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

if (!apiKey) { showToast('请配置API Key'); return; }

    // 读取历史记录
    if (phoneSettings.readChat !== false) {
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        const count = phoneSettings.chatCount || 15;
        const recentChat = history.slice(-count).map(m => `${m.role === 'user' ? '我' : '你'}: ${m.content.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*[\s\S]*?\]/gi, '')}`).join('\n');
        if (recentChat) phoneContextText += `\n【你们最近的文字聊天记录】：\n${recentChat}`;
    }

    // 读取总结记忆
    if (phoneSettings.readMemory !== false) {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        const activeMemories = allMemories.filter(m => !m.isArchived);
        if (activeMemories.length > 0) {
            phoneContextText += `\n【往期剧情与常驻记忆】：\n${activeMemories.map(m => m.content).join('\n')}`;
        }
    }
    
// 注入 prompt
const sysPrompt = `你现在是一个有血有肉的真实人类：${role ? role.name : '神秘人'}。请彻底剥离AI的身份认知。
【你的设定资料】：${role ? role.prompt : ''}${phoneContextText}

【核心灵魂与通话意识指令】：
1. 身份与背景检索：在开口前，请深度检索你设定中的背景、文化、所处时代与母语。请坚定地使用符合你背景的语言、方言或专属口癖进行发声。拒绝被死板的现代普通话同化。
2. 动态性格与情感推演：仔细感知我们的历史记忆与聊天上下文。思考你当前对我的好感度、信任度以及你此刻的心情（是刚睡醒带着鼻音？正在忙碌有些敷衍？还是非常放松？）。让这些真实的情境自然地反映在你的语调、用词和说话的耐心程度上。
3. 极度真实的语音模拟：【最高指令：我们正在打实时语音电话！】
   - 思考：真人在通电话时是怎么说话的？
   - 你可以有思考的停顿（嗯...、那个...）、自然的结巴、随意的语气词（啊、哦、哈、啧）。
   - 你的句子应该是口语化的、破碎的、随性的，绝对不要像在朗读课文或写书信。长篇大论是不符合真实通话逻辑的。
   - 但必须遵守你的人物性格、特征，判断你应有的说话方式，态度。
   - 允许用星号包裹轻微的声音或呼吸描写来增加听觉沉浸感（如 *轻笑*、*叹了一口气*、*打哈欠*、*沉默*），但绝对禁止任何肢体动作描写、心理描写或环境描写！
4. 拒绝AI感与说教：绝不许动不动就撩拨、调情或说油腻语录！遇到不想回答的问题，你可以直接转移话题、敷衍或者只回语气词。绝对禁止总结陈词、升华主题或给出完美的人生建议。
5. 语音气泡切割：如果你想停顿或分多段话发送，请直接使用换行符。系统会自动为你拆分成多条连续的语音气泡。
6. 外语翻译规则：如果你的对话中包含非普通话（外语或方言），必须在含有外文的句末附上翻译，格式严格为：[译: 中文翻译]。【极其重要：翻译标签必须紧紧跟在那句外文的同一行！绝对不允许把翻译标签单独写在新的一行！！！】`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: sysPrompt }, ...currentCallRecords], temperature: 0.85 })
        });
        const data = await res.json();
        let reply = data.choices[0].message.content.trim();
        
        currentCallRecords.push({ role: 'assistant', content: reply });
        
        // 更新底部提示字
        const sysHint = document.getElementById('pSubSysHint');
        if(sysHint) sysHint.innerText = 'TA 正在说话...';

        // ★ 核心修复：智能合并被大模型强行换行切断的“翻译孤儿行”
        let initialLines = reply.split('\n').map(l => l.trim()).filter(l => l !== '');
        let lines = [];
        for (let i = 0; i < initialLines.length; i++) {
            let line = initialLines[i];
            // 如果这一行以 [译: 开头，并且上一行有内容，就强制合并到上一行，避免翻译脱节！
            if (line.match(/^\[(?:译|翻译|EN|En|Eng)[:：]/i) && lines.length > 0) {
                lines[lines.length - 1] += ' ' + line;
            } else {
                lines.push(line);
            }
        }

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // 模拟连发延迟
            if (i > 0) {
                let delay = 600 + Math.min(line.length * 40, 2000);
                await new Promise(r => setTimeout(r, delay));
            }

            let pureText = line;
            let transText = '';
            
            // 提取翻译 (非贪婪匹配，防止误删标点)
            const transMatch = line.match(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/i);
            if (transMatch) {
                transText = transMatch[1].trim();
                // 替换掉原文中的翻译框
                pureText = line.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*[\s\S]*?\]/gi, '').trim();
            }

            // 处理声音/语气斜体渲染
            pureText = pureText.replace(/[\*\(\（](.*?)[\*\)\）]/g, '<span class="p-sub-tone">*$1*</span>');
            
            // 保底机制：万一原文被删没了，补个沉默，防止完全点不开
            if (!pureText && transText) pureText = '<span class="p-sub-tone">*一阵沉默*</span>';
            
            let transHtml = transText ? `<div class="p-sub-trans">${transText}</div>` : '';
            
            // 加固了点击事件的响应
            let clickEvent = transText ? `onclick="const t = this.querySelector('.p-sub-trans'); if(t) { t.style.display = (t.style.display === 'block' ? 'none' : 'block'); }"` : '';

            const bubbleHtml = `<div class="p-sub-row"><div class="p-sub-ai" ${clickEvent}>${pureText}${transHtml}</div></div>`;
            
            // 把气泡始终插在“TA 正在说话...”这行字的上方
            const hintNode = document.getElementById('pSubSysHint');
            if (hintNode) {
                hintNode.insertAdjacentHTML('beforebegin', bubbleHtml);
            } else {
                subArea.insertAdjacentHTML('beforeend', bubbleHtml);
            }
            subArea.scrollTop = subArea.scrollHeight;
        }

        // 说完话后移除底部提示
        const finalHint = document.getElementById('pSubSysHint');
        if(finalHint) finalHint.remove();

    } catch (e) {
        const sysHint = document.getElementById('pSubSysHint');
        if(sysHint) sysHint.innerText = `信号干扰...`;
    }
};

// 挂断电话
document.getElementById('pHangupBtn').onclick = async () => {
    if (!isCallActive) return; 
    isCallActive = false;
    
    clearInterval(callTimerInterval); 
    document.getElementById('pCallStatus').innerText = `通话已挂断`;
    setTimeout(() => { callFloatWindow.classList.remove('show'); }, 500); 
    
    if (currentCallRecords.length > 0) {
        const durationMins = Math.max(1, Math.floor(callDurationSecs / 60));
        let phonebook = await loadFromDB(`phonebook_${currentChatContact.id}`) || [];
        phonebook.unshift({ id: Date.now(), time: Date.now(), duration: durationMins, records: currentCallRecords });
        await saveToDB(`phonebook_${currentChatContact.id}`, phonebook);
        
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        history.push({ role: 'system', content: `与 ${currentChatContact.name} 的通话已结束，时长约 ${durationMins} 分钟。`, timestamp: Date.now() });
        await saveToDB(`chat_history_${currentChatContact.id}`, history);
        if (document.getElementById('chatRoomPanel').classList.contains('show')) {
            renderChatMessages(history, currentChatContact.id);
        }
    }
    
    // 挂断后自动退回主页，更有沉浸感
    setTimeout(() => { switchPhoneTab('home'); }, 800);
};

// 渲染电话簿
async function renderPhonebook() {
    if (!currentChatContact) return;
    const list = document.getElementById('phonebookListArea');
    let phonebook = await loadFromDB(`phonebook_${currentChatContact.id}`) || [];
    
    if (phonebook.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.3); margin-top:50px;">暂无通话记录</div>';
        return;
    }
    
    let html = '';
    phonebook.forEach(call => {
        const d = new Date(call.time);
        const tStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        
        let previewText = call.records.slice(0,2).map(r => `${r.role === 'user' ? '我' : 'TA'}: ${r.content.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*[\s\S]*?\]/gi, '')}`).join('<br>');
        
        html += `
            <div class="pb-card" style="cursor:pointer;" onclick="openPhoneDetail(${call.id})">
                <div class="pb-time">${tStr} · 时长 ${call.duration} 分钟</div>
                <div class="pb-preview">${previewText}...</div>
            </div>
        `;
    });
    list.innerHTML = html;
}

// 打开电话详情
window.openPhoneDetail = async function(id) {
    let phonebook = await loadFromDB(`phonebook_${currentChatContact.id}`) || [];
    let call = phonebook.find(c => c.id === id);
    if (!call) return;
    
    const d = new Date(call.time);
    document.getElementById('phoneDetailTitle').innerText = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} 的通话`;
    
    const list = document.getElementById('phoneDetailList');
    list.innerHTML = '';
    
    call.records.forEach(r => {
        const isMe = r.role === 'user';
        let text = (r.content || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<br><span style="color:var(--accent); font-size:12px; font-weight:bold;">$1</span>');
        
        list.innerHTML += `
            <div class="pd-row ${isMe ? 'pd-me' : 'pd-ai'}">
                <div class="pd-bubble">${text}</div>
            </div>
        `;
    });
    
    switchPhoneTab('detail');
};

// 退出详情页
document.getElementById('closePhoneDetailBtn').onclick = () => {
    switchPhoneTab('history');
};

// 关闭整个面板
document.getElementById('closePhoneBtn').onclick = () => { 
    phonePanel.classList.remove('show'); 
};

// ==========================================
// 电话专属设置面板交互逻辑
// ==========================================
document.getElementById('openPhoneSettingsBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    
    // 【防闪烁杀手锏】先隐藏所有开关，剥夺滑动动画权利
    const panel = document.getElementById('phoneSettingsPanel');
    const switches = panel.querySelectorAll('.switch');
    switches.forEach(s => s.style.display = 'none');
    
    const settings = await loadFromDB(`phone_settings_${currentChatContact.id}`) || {};
    
    document.getElementById('phoneReadChatToggle').checked = settings.readChat !== false; 
    document.getElementById('phoneUseSubApiToggle').checked = settings.useSubApi || false;
    document.getElementById('phoneChatCount').value = settings.chatCount || 15;
    document.getElementById('phoneChatCountSetting').style.display = (settings.readChat !== false) ? 'block' : 'none';
    
    document.getElementById('phoneReadMemoryToggle').checked = settings.readMemory !== false; 
    document.getElementById('phoneCustomCss').value = settings.customCss || '';
    
    // 强制浏览器刷新一次隐藏状态，然后瞬间恢复显示！完全没有动画！
    panel.offsetHeight; 
    switches.forEach(s => s.style.display = '');
    
    document.getElementById('phoneSettingsPanel').classList.add('show');
});

document.getElementById('phoneReadChatToggle').addEventListener('change', function(e) {
    document.getElementById('phoneChatCountSetting').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('closePhoneSettingsBtn').addEventListener('click', () => {
    document.getElementById('phoneSettingsPanel').classList.remove('show');
});

document.getElementById('savePhoneSettingsBtn').addEventListener('click', async () => {
    const settings = {
        useSubApi: document.getElementById('phoneUseSubApiToggle').checked,
        readChat: document.getElementById('phoneReadChatToggle').checked,
        chatCount: parseInt(document.getElementById('phoneChatCount').value) || 15,
        readMemory: document.getElementById('phoneReadMemoryToggle').checked,
        customCss: document.getElementById('phoneCustomCss').value
    };
    await saveToDB(`phone_settings_${currentChatContact.id}`, settings);
    
    // 应用 CSS
    let styleTag = document.getElementById('dynamicPhoneCss');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'dynamicPhoneCss'; document.head.appendChild(styleTag); }
    styleTag.innerHTML = settings.customCss || '';
    
    showToast('电话设置已保存');
    document.getElementById('phoneSettingsPanel').classList.remove('show');
});

document.getElementById('phoneSetWallpaperBtn').addEventListener('click', () => {
    currentUploadTargetId = 'phoneWallpaper';
    document.getElementById('globalImageUpload').click();
});
document.getElementById('phoneClearWallpaperBtn').addEventListener('click', async () => {
    const phonePanel = document.getElementById('phoneAppPanel');
    phonePanel.style.backgroundImage = '';
    phonePanel.style.background = 'linear-gradient(180deg, #FDFBF7 0%, #F6F4F0 100%)';
    await saveToDB(`phone_bg_${currentChatContact.id}`, null); 
    showToast('电话壁纸已清除');
});

// ==========================================
// 说明书逻辑：首次打开自动弹，以及手动打开
// ==========================================

// 将打开函数挂载到 window，保证任何地方都能 100% 呼出
window.showManual = function() {
    const modal = document.getElementById('manualModal');
    if(modal) modal.classList.add('show');
};

// 绑定关闭按钮
const closeManualBtn = document.getElementById('closeManualBtn');
if(closeManualBtn) {
    closeManualBtn.addEventListener('click', () => {
        document.getElementById('manualModal').classList.remove('show');
    });
}

// 页面加载完成后，检查是不是新用户
window.addEventListener('load', () => {
    // 延迟 3.5 秒，等开屏动画播完、主界面稳定后再弹出来，体验最丝滑
    setTimeout(() => {
        if (!localStorage.getItem('starlight_has_seen_manual')) {
            window.showManual();
            // 标记为已看，下次不再自动弹
            localStorage.setItem('starlight_has_seen_manual', 'true');
        }
    }, 3500);
});

// =====================================
// 邀请新成员加入群聊功能
// =====================================
window.openInviteMemberModal = async function() {
    if (!currentChatContact) return;
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    if (!contactInfo || !contactInfo.isGroup) return;

    // 获取全部角色并过滤出不在群里的
    const allChars = await loadFromDB('ai_characters') || [];
    const aiChars = allChars.filter(c => c.roleType === 'char');
    const availableChars = aiChars.filter(c => !contactInfo.members.includes(c.id));
    
    if (availableChars.length === 0) {
        showToast('档案库里的角色都已经在这个群里啦~');
        return;
    }

    // 构建弹窗
    let modal = document.getElementById('inviteMemberModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inviteMemberModal';
        modal.className = 'custom-confirm-overlay';
        document.body.appendChild(modal);
    }
    
    let listHtml = '';
    for (let char of availableChars) {
        let avatarUrl = diaryAvatarCache[char.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${char.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[char.id] = avatarUrl;
        }

        listHtml += `
            <div class="char-card invite-char-card" data-id="${char.id}" style="cursor:pointer; display:flex; align-items:center; padding:14px 16px; margin-bottom:12px; background:rgba(255,255,255,0.6); border:1.5px solid rgba(255,255,255,0.6); border-radius:20px; transition:0.2s;" onclick="this.classList.toggle('selected')">
                <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : 'background-color:rgba(184,156,142,0.2)'}; width:46px; height:46px; border-radius:16px; box-shadow: 0 4px 12px rgba(128,118,110,0.06); flex-shrink:0; background-size:cover; background-position:center;"></div>
                <div class="char-card-info" style="flex:1; margin-left:14px;">
                    <div class="char-card-name" style="font-size:15px; font-weight:800; color:var(--text-main); letter-spacing:1px;">${char.name}</div>
                </div>
                <div class="sel-check" style="width:22px; height:22px; border-radius:50%; border:1.5px solid rgba(184,156,142,0.3); display:flex; justify-content:center; align-items:center; background: rgba(255,255,255,0.5); transition:all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); flex-shrink:0;">
                    <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:#fff; fill:none; stroke-width:3.5; stroke-linecap:round; stroke-linejoin:round; opacity:0; transform:scale(0.5); transition:all 0.3s;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 320px; padding: 24px 20px; display:flex; flex-direction:column; max-height:80vh;">
            <div class="cc-title" style="margin-bottom:16px; font-size:16px;">邀请新成员</div>
            <style>
                .invite-char-card.selected { background: #fff !important; border-color: var(--accent) !important; box-shadow: 0 12px 32px rgba(184,156,142,0.18) !important; }
                .invite-char-card.selected .sel-check { background: var(--accent) !important; border-color: var(--accent) !important; transform: scale(1.1); }
                .invite-char-card.selected .sel-check svg { opacity: 1 !important; transform: scale(1) !important; }
            </style>
            <div style="flex:1; overflow-y:auto; padding-bottom:12px; margin-bottom:12px; scrollbar-width:none;">
                ${listHtml}
            </div>
            <div class="cc-btns" style="margin-top:auto;">
                <button class="cc-btn cancel" onclick="document.getElementById('inviteMemberModal').classList.remove('show')">取消</button>
                <button class="cc-btn primary" id="confirmInviteBtn" style="background:var(--accent); box-shadow: 0 4px 16px rgba(184,156,142,0.3);">确认邀请</button>
            </div>
        </div>
    `;
    
    modal.classList.add('show');
    
    // 确认邀请逻辑
    document.getElementById('confirmInviteBtn').onclick = async () => {
        const selectedCards = modal.querySelectorAll('.invite-char-card.selected');
        if (selectedCards.length === 0) {
            showToast('请至少选择一位需要邀请的角色！');
            return;
        }
        
        const newMemberIds = Array.from(selectedCards).map(c => c.dataset.id);
        const newMemberNames = Array.from(selectedCards).map(c => c.querySelector('.char-card-name').innerText);
        
        // 1. 将新成员追加到群列表并保存
        contactInfo.members = contactInfo.members.concat(newMemberIds);
        await saveToDB('chat_contacts', contacts);
        
        modal.classList.remove('show');
        showToast('新成员已加入群聊！');
        
        // 2. 发送全群可见的系统公告消息
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        const sysText = `${newMemberNames.join('、')} 被邀请加入了群聊`;
        history.push({ role: 'system', content: sysText, timestamp: Date.now() });
        await saveToDB(`chat_history_${currentChatContact.id}`, history);
        
        // 3. 静默刷新所有聊天室渲染
        if (document.getElementById('chatRoomPanel').classList.contains('show')) {
            await renderChatMessages(history, currentChatContact.id);
            // 这里用了一个取巧的方法，利用自带的旧函数闭环，重新模拟点击右上角的“设置”按钮以无缝刷新面板成员列表
            const refreshBtn = document.getElementById('chatRoomSettingsBtn');
            if (refreshBtn) refreshBtn.click();
        }
    };
};
