
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


        document.getElementById('jText1').addEventListener('blur', (e) => saveToDB('jText1', e.target.innerText));
        document.getElementById('calCustomText').addEventListener('blur', (e) => saveToDB('calCustomText', e.target.innerText));