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