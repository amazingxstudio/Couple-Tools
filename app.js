        document.addEventListener('contextmenu', e => { if (e.target.tagName === 'IMG') e.preventDefault(); }, false);
        localforage.config({ name: 'Couple_Tools_DB', storeName: 'app_data' });

        let appData = {
            theme: 'theme-default',
            profile1: { img: null, name: '', nickname: '', birthday: '', telegram: '', email: '', phones: '' },
            profile3: { img: null, name: '', nickname: '', birthday: '', telegram: '', email: '', phones: '' },
            startDate: null,
            gallery: [],
            favorites: [],
            songs: [],
            songFavorites: [],
            scrollingText: '',
            calendarData: {},
            aod: { clockType: '2', bgImage: null },
            tgAccounts: [],
            readyMessages: [],
            selectedAccIndex: 0,
            msgBg: null,
            shuffleMode: false,
            songAlbumArts: {}
        };
        let currentImgIndex = 0,
            currentSongIndex = 0,
            isPlaying = false,
            loopMode = 'all',
            tempGalleryEdit = [],
            confirmCallback = null;
        let pendingMsgIndex = -1;
        let songRemoveTarget = -1;
        let streakRestorePending = false;
        let restoreCallback = null;
        let gyroActive = false;
        let gyroFrame = null;

        let scrollTextAnimId = null;
        let scrollTextPos = 0;
        const scrollTextSpeed = 0.6;

        // ===== DATE FORMAT HELPER =====
        function formatDateDDMMYYYY(dateStr) {
            if (!dateStr) return '-';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return dateStr;
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        function formatDateFromObj(date) {
            if (!date) return '-';
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${d}/${m}/${y}`;
        }

        // ===== SCROLLING TEXT ANIMATION =====
        function startScrollingTextAnimation() {
            const el = document.getElementById('dcScrollingText');
            if (!el) return;
            const container = el.parentElement;
            if (!container) return;
            const containerWidth = container.clientWidth || 200;
            const textWidth = el.scrollWidth || 200;

            if (textWidth <= containerWidth) {
                el.style.transform = 'translateX(0)';
                el.style.textAlign = 'center';
                el.style.width = '100%';
                if (scrollTextAnimId) { cancelAnimationFrame(scrollTextAnimId);
                    scrollTextAnimId = null; }
                return;
            }

            el.style.textAlign = 'left';
            el.style.width = 'auto';
            if (scrollTextPos === 0) { scrollTextPos = containerWidth; }
            if (scrollTextAnimId) { cancelAnimationFrame(scrollTextAnimId);
                scrollTextAnimId = null; }

            function animate() {
                scrollTextPos -= scrollTextSpeed;
                if (scrollTextPos < -textWidth) { scrollTextPos = containerWidth; }
                el.style.transform = `translateX(${scrollTextPos}px)`;
                scrollTextAnimId = requestAnimationFrame(animate);
            }
            animate();
        }

        function updateScrollingText() {
            const el = document.getElementById('dcScrollingText');
            if (!el) return;
            if (appData.scrollingText && appData.scrollingText.trim()) {
                el.textContent = appData.scrollingText;
            } else {
                el.textContent = 'Forever together';
            }
            setTimeout(startScrollingTextAnimation, 50);
        }

        // ===== DATE COUNTER UPDATE =====
        function updateDateCounter() {
            const daysEl = document.getElementById('counterDays');
            const monthsEl = document.getElementById('counterMonths');
            const yearsEl = document.getElementById('counterYears');
            if (!appData.startDate) {
                daysEl.textContent = '0';
                monthsEl.textContent = '0';
                yearsEl.textContent = '0';
                return;
            }
            const start = new Date(appData.startDate);
            const now = new Date();
            let years = now.getFullYear() - start.getFullYear();
            let months = now.getMonth() - start.getMonth();
            let days = now.getDate() - start.getDate();
            if (days < 0) { months--;
                const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                days += prevMonth.getDate(); }
            if (months < 0) { years--;
                months += 12; }
            const totalDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            daysEl.textContent = totalDays;
            monthsEl.textContent = months + years * 12;
            yearsEl.textContent = years;
        }

        // ===== BIRTHDAY PICKER STATE =====
        let birthdayPickerTarget = 'boy';
        let bpYear = 2000,
            bpMonth = 0,
            bpDay = 1;

        // ===== PHONE STATE =====
        let phoneTarget = 'boy';
        let phoneNumbers = [];

        // ===== FILE INPUT HANDLER =====
        // FIX (2026-08-23): previously this function updated the same badge
        // twice — once via the generic ".file-upload-card" lookup, and again
        // via a duplicate id-specific block below it — which is why picking
        // 1 file displayed "2 files". The badge now reflects exactly what is
        // currently selected in `input.files` (which is also exactly what
        // saveAllSettings()/uploadMemory() will actually upload), updated
        // through a single code path only.
        function handleFileInput(input) {
            const count = input.files ? input.files.length : 0;
            const label = count === 1 ? 'file' : 'files';

            const card = input.closest('.file-upload-card');
            if (card) {
                const badge = card.querySelector('.file-badge');
                if (badge) {
                    const icon = badge.querySelector('i') ? badge.querySelector('i').className : 'fas fa-file';
                    badge.innerHTML = `<i class="${icon}"></i> ${count} ${label}`;
                    badge.setAttribute('data-count', count);
                }
            }

            if (count > 0) input.classList.add('uploaded');
            else input.classList.remove('uploaded');
        }

        function updateAllFileCounts() {
            const updateBadge = (id, count) => {
                const b = document.getElementById(id);
                if (b) {
                    const label = count === 1 ? 'file' : 'files';
                    b.innerHTML = `<i class="fas fa-file-image"></i> ${count} ${label}`;
                    b.setAttribute('data-count', count);
                }
            };
            updateBadge('gallery-badge', appData.gallery.length);
            updateBadge('songs-badge', appData.songs.length);
            updateBadge('profile1-badge', appData.profile1.img ? 1 : 0);
            updateBadge('profile3-badge', appData.profile3.img ? 1 : 0);
            // memory badge handled separately
            const mb = document.getElementById('memory-badge');
            if (mb) {
                const d = appData.calendarData[selCalDateStr];
                const cnt = d && d.memories ? d.memories.length : 0;
                const label = cnt === 1 ? 'file' : 'files';
                mb.innerHTML = `<i class="fas fa-file-image"></i> ${cnt} ${label}`;
                mb.setAttribute('data-count', cnt);
            }
        }

        // ===== FIELD FOCUS HELPER =====
        function focusField(id) {
            const el = document.getElementById(id);
            if (el) { el.focus();
                el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }

        // ===== STREAK =====
        let streak = { count: 0, lastDate: '', restores: 3, month: new Date().getMonth(), peak: 0, firstStreakDate: '',
            restoresUsed: 0 };

        function getLocalDateStr() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }

        function getDateOnly(date) {
            return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }

        function saveStreak() { localStorage.setItem('ember_streak', JSON.stringify(streak)); }

        function loadStreak() {
            const s = localStorage.getItem('ember_streak');
            if (s) {
                const p = JSON.parse(s);
                streak.count = p.count ?? 0;
                streak.lastDate = p.lastDate ?? '';
                streak.restores = p.restores ?? 3;
                streak.month = p.month ?? new Date().getMonth();
                streak.peak = p.peak ?? 0;
                streak.firstStreakDate = p.firstStreakDate ?? '';
                streak.restoresUsed = p.restoresUsed ?? 0;
            } else {
                streak.count = 1;
                streak.lastDate = getLocalDateStr();
                streak.restores = 3;
                streak.month = new Date().getMonth();
                streak.peak = 1;
                streak.firstStreakDate = getLocalDateStr();
                streak.restoresUsed = 0;
                saveStreak();
            }
        }

        function getBaseRestores() { return streak.count >= 50 ? 5 : 3; }

        function refreshRestores() {
            const currentMonth = new Date().getMonth();
            if (streak.month !== currentMonth) {
                streak.month = currentMonth;
                streak.restoresUsed = 0;
                streak.restores = getBaseRestores();
                saveStreak();
            } else {
                const base = getBaseRestores();
                const available = base - streak.restoresUsed;
                streak.restores = Math.max(0, available);
                saveStreak();
            }
        }

        function useRestore() {
            if (streak.restores <= 0) return false;
            streak.restores--;
            streak.restoresUsed++;
            saveStreak();
            return true;
        }

        function isStreakBroken() {
            if (streak.count === 0 || !streak.lastDate) return false;
            const today = getLocalDateStr();
            if (streak.lastDate === today) return false;
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yestStr = getDateOnly(yesterday);
            return streak.lastDate !== yestStr && streak.lastDate !== today;
        }

        function checkAndPromptRestore() {
            const appContainer = document.getElementById('appContainer');
            if (appContainer.style.display === 'none') return;
            refreshRestores();
            if (!isStreakBroken()) { renderFloatingUI();
                updateModalUI(); return; }
            if (streak.restores <= 0) { breakStreak(); return; }
            const overlay = document.getElementById('streakRestoreOverlay');
            document.getElementById('restoreStreakDisplay').innerText = streak.count;
            document.getElementById('restoreAvailableCount').innerText = streak.restores;
            overlay.classList.add('active');
            const floatIcon = document.getElementById('streakIcon');
            floatIcon.className = 'streak-fire-icon streak-fire-inactive';
            const floatEl = document.getElementById('floatingStreak');
            floatEl.className = 'floating-streak streak-fire-inactive';
            streakRestorePending = true;
            const confirmBtn = document.getElementById('restoreBtnConfirm');
            const ignoreBtn = document.getElementById('restoreBtnIgnore');
            const newConfirm = confirmBtn.cloneNode(true);
            const newIgnore = ignoreBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            ignoreBtn.parentNode.replaceChild(newIgnore, ignoreBtn);
            newConfirm.addEventListener('click', function() {
                if (streak.restores <= 0) { showCustomAlert("No restores remaining this month."); return; }
                useRestore();
                streak.lastDate = getLocalDateStr();
                if (streak.count > streak.peak) streak.peak = streak.count;
                saveStreak();
                streakRestorePending = false;
                document.getElementById('streakRestoreOverlay').classList.remove('active');
                renderFloatingUI();
                updateModalUI();
                showCustomAlert("Streak restored! You're back on track.");
            });
            newIgnore.addEventListener('click', function() {
                breakStreak();
                document.getElementById('streakRestoreOverlay').classList.remove('active');
                streakRestorePending = false;
                showCustomAlert("Streak broken. Starting fresh from 1.");
            });
        }

        function breakStreak() { streak.count = 1;
            streak.lastDate = getLocalDateStr();
            streak.firstStreakDate = getLocalDateStr();
            saveStreak();
            renderFloatingUI();
            updateModalUI(); }

        function getStreakLevel(count) {
            if (count >= 200) return { name: "MYTHIC DRAGON", next: "MAXIMUM", nextTarget: 200 };
            if (count >= 100) return { name: "INFERNO LEGEND", next: "Mythic Dragon", nextTarget: 200 };
            if (count >= 50) return { name: "BLAZE MASTER", next: "Inferno Legend", nextTarget: 100 };
            if (count >= 10) return { name: "PHOENIX RISING", next: "Blaze Master", nextTarget: 50 };
            if (count >= 3) return { name: "EMBER GUARDIAN", next: "Phoenix Rising", nextTarget: 10 };
            return { name: "SPARK BEGINNER", next: "Ember Guardian", nextTarget: 3 };
        }

        function getFireClass(count) {
            if (count >= 200) return 'streak-fire-200';
            if (count >= 100) return 'streak-fire-100';
            if (count >= 50) return 'streak-fire-50';
            if (count >= 10) return 'streak-fire-10';
            if (count >= 3) return 'streak-fire-3';
            return 'streak-fire-default';
        }

        function renderFloatingUI() {
            const btn = document.getElementById('floatingStreak');
            const icon = document.getElementById('streakIcon');
            if (isStreakBroken() && streakRestorePending) {
                btn.className = 'floating-streak streak-fire-inactive';
                icon.className = 'streak-fire-icon streak-fire-inactive';
            } else {
                btn.className = `floating-streak ${getFireClass(streak.count)}`;
                icon.className = `streak-fire-icon ${getFireClass(streak.count)}`;
            }
            document.getElementById('floatStreakNum').innerText = streak.count;
        }

        function buildMilestoneRow(current) {
            const m = [3, 10, 50, 100, 200];
            let html = '';
            m.forEach((t, i) => {
                const reached = current >= t;
                let fclass = 'streak-fire-default';
                if (reached) {
                    if (t >= 200) fclass = 'streak-fire-200';
                    else if (t >= 100) fclass = 'streak-fire-100';
                    else if (t >= 50) fclass = 'streak-fire-50';
                    else if (t >= 10) fclass = 'streak-fire-10';
                    else if (t >= 3) fclass = 'streak-fire-3';
                }
                html += `<div class="dest-node"><div class="dest-fire ${fclass}"><i class="fas fa-fire"></i></div><span class="dest-label">${t}</span></div>`;
                if (i !== m.length - 1) html += `<span class="dash-sep">—</span>`;
            });
            return html;
        }

        function updateModalUI() {
            refreshRestores();
            const c = streak.count;
            const lvl = getStreakLevel(c);
            document.getElementById('modalStreakCount').innerText = c;
            document.getElementById('streakUnitText').innerText = c === 1 ? 'day' : 'days';
            const giant = document.getElementById('modalGiantFlame');
            giant.className = `giant-flame ${getFireClass(c)}`;
            giant.innerHTML = '<i class="fas fa-fire"></i>';
            document.getElementById('levelBadge').innerText = lvl.name;
            if (lvl.nextTarget && lvl.nextTarget !== 200) {
                document.getElementById('nextLevelInfo').innerHTML = `${lvl.next} · ${lvl.nextTarget-c} days to go`;
            } else if (c >= 200) {
                document.getElementById('nextLevelInfo').innerHTML = 'Peak mastery · eternal flame';
            } else {
                document.getElementById('nextLevelInfo').innerHTML = `${lvl.nextTarget-c} days until ${lvl.next}`;
            }
            document.getElementById('milestoneRow').innerHTML = buildMilestoneRow(c);
            document.getElementById('peakStreakVal').innerText = streak.peak;
            let mastery = "Ember";
            if (c >= 200) mastery = "Dragon Mythic";
            else if (c >= 100) mastery = "Inferno Lord";
            else if (c >= 50) mastery = "Blaze Sovereign";
            else if (c >= 10) mastery = "Phoenix";
            else if (c >= 3) mastery = "Guardian";
            else mastery = "Spark";
            document.getElementById('masteryLevel').innerHTML = mastery;
            // DD/MM/YYYY format for streak start
            if (streak.firstStreakDate) {
                const parts = streak.firstStreakDate.split('-');
                document.getElementById('streakStartHint').innerHTML = `${parts[2]}/${parts[1]}/${parts[0]}`;
            } else {
                document.getElementById('streakStartHint').innerHTML = 'today';
            }
            document.getElementById('restoreCountDisplay').innerText = streak.restores;
        }

        function openStreakModal() { updateModalUI();
            document.getElementById('streakModal').classList.add('active'); }

        function closeStreakModal() { document.getElementById('streakModal').classList.remove('active'); }

        // ===== FLOATING DRAG =====
        const floatEl = document.getElementById('floatingStreak');
        let isDragging = false,
            dragOccurred = false,
            dragStartX, dragStartY, initialLeft, initialTop;

        function constrainPos(left, top) {
            const maxX = window.innerWidth - floatEl.offsetWidth - 12;
            const maxY = window.innerHeight - floatEl.offsetHeight - 24;
            return { x: Math.min(maxX, Math.max(8, left)), y: Math.min(maxY, Math.max(60, top)) };
        }

        function snapToEdge(left) {
            const center = window.innerWidth / 2;
            const btnCenter = left + floatEl.offsetWidth / 2;
            return btnCenter < center ? 12 : window.innerWidth - floatEl.offsetWidth - 12;
        }

        function onMove(e) {
            if (!isDragging) return;
            e.preventDefault();
            let cx, cy;
            if (e.touches) { cx = e.touches[0].clientX;
                cy = e.touches[0].clientY; } else { cx = e.clientX;
                cy = e.clientY; }
            let dx = cx - dragStartX,
                dy = cy - dragStartY;
            let newLeft = initialLeft + dx,
                newTop = initialTop + dy;
            const b = constrainPos(newLeft, newTop);
            floatEl.style.left = b.x + 'px';
            floatEl.style.top = b.y + 'px';
            dragOccurred = true;
        }

        function onUp(e) {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            floatEl.style.transition = 'left 0.22s cubic-bezier(0.2,0.95,0.4,1.1)';
            const curLeft = parseFloat(floatEl.style.left);
            floatEl.style.left = snapToEdge(curLeft) + 'px';
            setTimeout(() => { floatEl.style.transition = ''; }, 240);
            if (!dragOccurred) { openStreakModal(); }
            dragOccurred = false;
        }

        function onDown(e) {
            e.preventDefault();
            isDragging = true;
            dragOccurred = false;
            let cx, cy;
            if (e.touches) { cx = e.touches[0].clientX;
                cy = e.touches[0].clientY; } else { cx = e.clientX;
                cy = e.clientY; }
            dragStartX = cx;
            dragStartY = cy;
            initialLeft = parseFloat(floatEl.style.left);
            initialTop = parseFloat(floatEl.style.top);
            floatEl.style.transition = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        }
        floatEl.addEventListener('mousedown', onDown);
        floatEl.addEventListener('touchstart', onDown, { passive: false });

        function initStreakPosition() {
            let initTop = 180;
            const profile = document.querySelector('.oval-btn');
            if (profile) { const rect = profile.getBoundingClientRect();
                initTop = rect.top + 60; if (initTop + 90 > window.innerHeight - 60) initTop = window.innerHeight - 110; }
            floatEl.style.top = initTop + 'px';
            floatEl.style.left = '22px';
            setTimeout(() => { const left = parseFloat(floatEl.style.left); if (!isNaN(left)) floatEl.style.left = snapToEdge(
                    left) + 'px'; }, 50);
        }

        // ===== ALERT / CONFIRM =====
        function showCustomAlert(msg) {
            document.getElementById('alertMessage').innerText = msg;
            document.getElementById('customAlertOverlay').style.display = 'flex';
        }

        function closeCustomAlert() { document.getElementById('customAlertOverlay').style.display = 'none'; }

        function showCustomConfirm(msg, cb, ct = 'Confirm') {
            document.getElementById('confirmMessage').innerText = msg;
            confirmCallback = cb;
            document.getElementById('confirmYesBtn').innerText = ct;
            document.getElementById('customConfirmOverlay').style.display = 'flex';
        }

        function closeCustomConfirm() {
            document.getElementById('customConfirmOverlay').style.display = 'none';
            confirmCallback = null;
        }
        document.getElementById('confirmYesBtn').addEventListener('click', () => { if (confirmCallback) { const cb =
                    confirmCallback;
                confirmCallback = null;
                cb(); } closeCustomConfirm(); });

        // ===== THEME TRANSITION =====
        let themeTransitionActive = false;

        function setTheme(theme, el) {
            if (themeTransitionActive) return;
            themeTransitionActive = true;
            const overlay = document.getElementById('themeTransitionOverlay');
            const blurLayer = document.getElementById('themeBlurLayer');
            overlay.style.display = 'block';
            overlay.style.zIndex = '9999999';
            blurLayer.style.opacity = '0';
            requestAnimationFrame(() => { overlay.classList.add('active');
                blurLayer.style.opacity = '1'; });
            setTimeout(() => {
                document.body.className = theme;
                appData.theme = theme;
                localforage.setItem('core_data', appData);
                document.querySelectorAll('.theme-circle').forEach(c => c.classList.remove('active'));
                if (el) el.classList.add('active');
                else {
                    const themeMap = { 'theme-default': 'tc-default', 'theme-pink': 'tc-pink', 'theme-ocean': 'tc-ocean',
                        'theme-sunset': 'tc-sunset', 'theme-dark': 'tc-dark', 'theme-colorful': 'tc-colorful' };
                    const t = document.querySelector(`.${themeMap[theme]}`);
                    if (t) t.classList.add('active');
                }
                updateMsgBg();
                setTimeout(() => {
                    overlay.classList.remove('active');
                    blurLayer.style.opacity = '0';
                    setTimeout(() => { overlay.style.display = 'none';
                        overlay.style.zIndex = '-1';
                        themeTransitionActive = false; }, 400);
                }, 600);
            }, 800);
        }

        // ===== MSG BG =====
        function updateMsgBg() {
            const container = document.getElementById('msgBgPremium');
            if (appData.msgBg) {
                const overlay = document.createElement('div');
                overlay.id = 'msgUserBgOverlay';
                overlay.style.cssText =
                    `position:absolute;inset:0;background:url(${appData.msgBg}) center/cover;opacity:0.9;z-index:-1;pointer-events:none;`;
                const existing = document.getElementById('msgUserBgOverlay');
                if (existing) existing.remove();
                container.appendChild(overlay);
            } else {
                const existing = document.getElementById('msgUserBgOverlay');
                if (existing) existing.remove();
            }
        }

        function setupMsgTopBarLongPress() {
            const bar = document.getElementById('msgTopBar');
            let timer = null;
            const start = () => { timer = setTimeout(() => { document.getElementById('msgBgUploadOverlay').style
                        .display = 'flex';
                    timer = null; }, 400); };
            const cancel = () => { if (timer) { clearTimeout(timer);
                    timer = null; } };
            bar.addEventListener('mousedown', start);
            bar.addEventListener('mouseup', cancel);
            bar.addEventListener('mouseleave', cancel);
            bar.addEventListener('touchstart', start, { passive: true });
            bar.addEventListener('touchend', cancel);
            bar.addEventListener('touchcancel', cancel);
        }

        async function uploadMsgBg(input) {
            if (!input.files || input.files.length === 0) return;
            const file = input.files[0];
            appData.msgBg = await fileToBase64(file);
            localforage.setItem('core_data', appData);
            updateMsgBg();
            showCustomAlert("Background updated!");
            input.value = '';
            input.classList.remove('uploaded');
            closeModal('msgBgUploadOverlay');
        }

        function restoreMsgBg() {
            appData.msgBg = null;
            localforage.setItem('core_data', appData);
            updateMsgBg();
            showCustomAlert("Restored to default background.");
            closeModal('msgBgUploadOverlay');
        }

        // ===== AOD =====
        async function uploadAODBg(input) {
            if (!input.files || input.files.length === 0) return;
            const file = input.files[0];
            appData.aod.bgImage = await fileToBase64(file);
            localforage.setItem('core_data', appData);
            if (document.getElementById('aodPage').style.display === 'flex') {
                const aod = document.getElementById('aodPage');
                aod.style.backgroundImage =
                    `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url(${appData.aod.bgImage})`;
                aod.style.backgroundSize = 'cover';
                showCustomAlertOnAOD("AOD Background updated!");
            } else { showCustomAlert("AOD Background updated!"); }
            document.getElementById('aodBgResetModal').classList.remove('hidden');
            input.value = '';
            input.classList.remove('uploaded');
        }

        function showCustomAlertOnAOD(msg) {
            const overlay = document.getElementById('customAlertOverlay');
            const origZ = overlay.style.zIndex;
            overlay.style.zIndex = '10000000';
            document.getElementById('alertMessage').innerText = msg;
            overlay.style.display = 'flex';
            const origClose = document.getElementById('alertSingleBtn').onclick;
            document.getElementById('alertSingleBtn').onclick = function() {
                overlay.style.zIndex = origZ || '9999999';
                closeCustomAlert();
                document.getElementById('alertSingleBtn').onclick = origClose;
            };
        }

        function resetAODBackground() {
            showCustomConfirm("Reset AOD background to default black?", () => {
                appData.aod.bgImage = null;
                localforage.setItem('core_data', appData);
                if (document.getElementById('aodPage').style.display === 'flex') {
                    const aod = document.getElementById('aodPage');
                    aod.style.background = '#000';
                    aod.style.backgroundImage = 'none';
                    showCustomAlertOnAOD("AOD background reset.");
                } else { showCustomAlert("AOD background reset."); }
                document.getElementById('aodBgResetModal').classList.add('hidden');
            });
        }

        // Gyroscope for Framed Clock
        function startGyroscope() {
            if (gyroActive) return;
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission ===
                'function') {
                DeviceOrientationEvent.requestPermission().then(response => {
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                        gyroActive = true;
                    }
                }).catch(() => {});
            } else if (typeof DeviceOrientationEvent !== 'undefined') {
                window.addEventListener('deviceorientation', handleOrientation);
                gyroActive = true;
            }
        }

        function stopGyroscope() {
            if (gyroActive) {
                window.removeEventListener('deviceorientation', handleOrientation);
                gyroActive = false;
                // Reset transform
                const wrapper = document.getElementById('aodClockWrapper');
                if (wrapper) {
                    const framed = wrapper.querySelector('.aod-framed-clock');
                    if (framed) {
                        framed.style.transform = 'rotateX(0deg) rotateY(0deg)';
                    }
                }
            }
        }

        function handleOrientation(event) {
            const beta = event.beta || 0;
            const gamma = event.gamma || 0;
            const rotX = beta * 0.03;
            const rotY = gamma * 0.03;
            const wrapper = document.getElementById('aodClockWrapper');
            if (wrapper) {
                const framed = wrapper.querySelector('.aod-framed-clock');
                if (framed) {
                    framed.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
                }
            }
        }

        // ===== DEV CONTACT =====
        function openDevContact() { document.getElementById('devContactOverlay').style.display = 'flex'; }

        function closeDevContact() { document.getElementById('devContactOverlay').style.display = 'none'; }

        // ===== BIRTHDAY PICKER =====
        function openBirthdayPicker(target) {
            birthdayPickerTarget = target;
            let currentDate = target === 'boy' ? appData.profile1.birthday : appData.profile3.birthday;
            let d = currentDate ? new Date(currentDate) : new Date(2000, 0, 1);
            if (isNaN(d.getTime())) d = new Date(2000, 0, 1);
            bpYear = d.getFullYear();
            bpMonth = d.getMonth();
            bpDay = d.getDate();
            renderBPPicker();
            document.getElementById('birthdayPickerModal').style.display = 'flex';
        }

        function renderBPPicker() {
            const days = document.getElementById('bp-days');
            const months = document.getElementById('bp-months');
            const years = document.getElementById('bp-years');
            years.innerHTML = '<div style="height:80px;"></div>';
            for (let y = 1900; y <= 2050; y++) { years.innerHTML +=
                    `<div class="date-item ${y===bpYear?'selected':''}" onclick="bpSelect('year',${y})">${y}</div>`; }
            years.innerHTML += '<div style="height:80px;"></div>';
            const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            months.innerHTML = '<div style="height:80px;"></div>';
            mNames.forEach((m, i) => { months.innerHTML +=
                    `<div class="date-item ${i===bpMonth?'selected':''}" onclick="bpSelect('month',${i})">${m}</div>`; });
            months.innerHTML += '<div style="height:80px;"></div>';
            let dim = new Date(bpYear, bpMonth + 1, 0).getDate();
            if (bpDay > dim) bpDay = dim;
            days.innerHTML = '<div style="height:80px;"></div>';
            for (let d = 1; d <= dim; d++) { days.innerHTML +=
                    `<div class="date-item ${d===bpDay?'selected':''}" onclick="bpSelect('day',${d})">${String(d).padStart(2,'0')}</div>`; }
            days.innerHTML += '<div style="height:80px;"></div>';
            setTimeout(alignBPScrolls, 50);
        }

        function bpSelect(type, val) { if (type === 'year') bpYear = val; if (type === 'month') bpMonth = val; if (type ===
                'day') bpDay = val;
            renderBPPicker(); }

        function alignBPScrolls() {
            ['bp-days', 'bp-months', 'bp-years'].forEach(id => { const el = document.getElementById(id); const s = el
                    .querySelector('.selected'); if (s) el.scrollTo({ top: s.offsetTop - 85, behavior: 'smooth' }); });
        }

        function confirmBirthdayPicker() {
            const ds =
                `${bpYear}-${String(bpMonth+1).padStart(2,'0')}-${String(bpDay).padStart(2,'0')}`;
            const displayDate = `${String(bpDay).padStart(2,'0')}/${String(bpMonth+1).padStart(2,'0')}/${bpYear}`;

            if (birthdayPickerTarget === 'boy') {
                appData.profile1.birthday = ds;
                document.getElementById('set-p1-birthday').value = ds;
                document.getElementById('set-p1-birthday-display').innerText = displayDate;
                const icon = document.getElementById('icon-p1-bday');
                if (icon) { icon.classList.add('show', 'active-icon'); }
                const card = document.getElementById('set-p1-birthday-display').closest('.field-card');
                if (card) card.classList.add('has-value');
            } else {
                appData.profile3.birthday = ds;
                document.getElementById('set-p3-birthday').value = ds;
                document.getElementById('set-p3-birthday-display').innerText = displayDate;
                const icon = document.getElementById('icon-p3-bday');
                if (icon) { icon.classList.add('show', 'active-icon'); }
                const card = document.getElementById('set-p3-birthday-display').closest('.field-card');
                if (card) card.classList.add('has-value');
            }
            closeModal('birthdayPickerModal');
            // Notification မပေါ်တော့ပါ
        }

        // ======================================================
        // ===== 📱 PHONE NUMBERS MANAGEMENT =====
        // ======================================================
        function openPhoneModal(target) {
            phoneTarget = target;
            // Load existing numbers from hidden input (appData is not directly used)
            const hiddenInput = document.getElementById(target === 'boy' ? 'set-p1-phones' : 'set-p3-phones');
            const existing = hiddenInput.value || '';
            phoneNumbers = existing.split('|').map(s => s.trim()).filter(s => s !== '');
            document.getElementById('phone-input').value = '';
            renderPhoneModalList();
            document.getElementById('phoneModal').style.display = 'flex';
        }

        function renderPhoneModalList() {
            const list = document.getElementById('modal-phone-list');
            if (!list) return;
            list.innerHTML = '';
            if (phoneNumbers.length === 0) {
                list.innerHTML = '<p style="opacity:0.6;font-size:0.9rem;text-align:center;padding:8px 0;">No numbers added yet.</p>';
                return;
            }
            phoneNumbers.forEach((num, idx) => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);';
                div.innerHTML = `<span style="font-size:14px;">${num}</span><button onclick="removePhoneFromModal(${idx})" style="background:none;border:none;color:#ff5252;cursor:pointer;font-weight:bold;padding:0 8px;font-size:16px;transition:0.2s;" onmouseover="this.style.color='#ff6b6b'" onmouseout="this.style.color='#ff5252'">✕</button>`;
                list.appendChild(div);
            });
        }

        function removePhoneFromModal(index) {
            phoneNumbers.splice(index, 1);
            renderPhoneModalList();
            // Update hidden input and UI immediately
            updatePhoneHiddenInputAndUI();
        }

        function confirmAddPhone() {
            const input = document.getElementById('phone-input');
            const val = input.value.trim();
            if (val) {
                phoneNumbers.push(val);
                renderPhoneModalList();
                input.value = '';
                input.focus();
                // Update hidden input and UI immediately
                updatePhoneHiddenInputAndUI();
            }
        }

        function updatePhoneHiddenInputAndUI() {
            const hiddenInput = document.getElementById(phoneTarget === 'boy' ? 'set-p1-phones' : 'set-p3-phones');
            if (hiddenInput) {
                hiddenInput.value = phoneNumbers.join(' | ');
            }
            // Update phone tags in settings
            const oldTarget = phoneTarget;
            renderPhoneTagsUI();
            // Update icon
            const iconId = phoneTarget === 'boy' ? 'icon-p1-phones' : 'icon-p3-phones';
            const icon = document.getElementById(iconId);
            if (phoneNumbers.length > 0) {
                if (icon) { icon.classList.add('show', 'active-icon'); }
            } else {
                if (icon) { icon.classList.remove('show', 'active-icon'); }
            }
        }

        function renderPhoneTagsUI() {
            const container = document.getElementById(phoneTarget === 'boy' ? 'p1-phone-container' : 'p3-phone-container');
            if (!container) return;
            container.innerHTML = '';

            const hiddenInput = document.getElementById(phoneTarget === 'boy' ? 'set-p1-phones' : 'set-p3-phones');
            const numbers = hiddenInput.value.split('|').map(s => s.trim()).filter(s => s !== '');

            if (numbers.length === 0) return;

            numbers.forEach((num, idx) => {
                if (idx > 0) {
                    const sep = document.createElement('span');
                    sep.className = 'phone-separator';
                    sep.textContent = ' | ';
                    container.appendChild(sep);
                }
                const tag = document.createElement('span');
                tag.className = 'phone-tag';
                tag.textContent = num;
                container.appendChild(tag);
            });
            const iconId = phoneTarget === 'boy' ? 'icon-p1-phones' : 'icon-p3-phones';
            const icon = document.getElementById(iconId);
            if (icon) { icon.classList.add('show', 'active-icon'); }
        }

        // ===== FIELD ICON LOGIC =====
        function initFieldIcons() {
            const cards = document.querySelectorAll('.field-card');
            cards.forEach(card => {
                const input = card.querySelector('.field-input');
                const icon = card.querySelector('.field-icon');
                const clickable = card.dataset.field;

                if (input && input.value && input.value.trim() !== '') {
                    if (icon) { icon.classList.add('show', 'active-icon'); }
                    card.classList.add('has-value');
                }

                if (clickable === 'p1-bday' || clickable === 'p3-bday') {
                    const display = card.querySelector('.birthday-value');
                    if (display && display.innerText.trim() !== '') {
                        if (icon) { icon.classList.add('show', 'active-icon'); }
                        card.classList.add('has-value');
                    }
                }
                if (clickable === 'p1-phones' || clickable === 'p3-phones') {
                    const hidden = card.querySelector('input[type="hidden"]');
                    if (hidden && hidden.value && hidden.value.trim() !== '') {
                        if (icon) { icon.classList.add('show', 'active-icon'); }
                        card.classList.add('has-value');
                    }
                }

                const showIcon = () => {
                    if (icon) { icon.classList.add('show', 'active-icon'); }
                    card.classList.add('has-value');
                };

                if (input) {
                    input.addEventListener('focus', showIcon);
                    input.addEventListener('input', () => {
                        if (input.value.trim() !== '') {
                            if (icon) { icon.classList.add('show', 'active-icon'); }
                            card.classList.add('has-value');
                        }
                    });
                }

                card.addEventListener('click', showIcon);
            });
        }

        // ===== ON LOAD =====
        window.onload = async () => {
            const saved = await localforage.getItem('core_data');
            if (saved) {
                appData = { ...appData, ...saved };
                if (!appData.calendarData) appData.calendarData = {};
                if (!appData.aod) appData.aod = { clockType: '2', bgImage: null };
                if (!appData.tgAccounts) appData.tgAccounts = [];
                if (!appData.readyMessages) appData.readyMessages = [];
                if (!appData.msgBg) appData.msgBg = null;
                if (!appData.songFavorites) appData.songFavorites = [];
                if (!appData.songAlbumArts) appData.songAlbumArts = {};
                if (appData.shuffleMode === undefined) appData.shuffleMode = false;
                if (appData.aod.clockType === '1') appData.aod.clockType = '2';
            }
            loadStreak();
            const today = getLocalDateStr();
            if (streak.lastDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yestStr = getDateOnly(yesterday);
                if (streak.lastDate === yestStr) {
                    streak.count++;
                    streak.lastDate = today;
                    if (streak.count > streak.peak) streak.peak = streak.count;
                    refreshRestores();
                    saveStreak();
                    renderFloatingUI();
                    updateModalUI();
                } else if (streak.lastDate && streak.lastDate !== today && streak.lastDate !== '') {
                    streakRestorePending = true;
                }
            }
            refreshRestores();
            renderFloatingUI();
            initStreakPosition();
            setTimeout(() => {
                if (isStreakBroken() && streakRestorePending) { checkAndPromptRestore(); } else { renderFloatingUI(); }
            }, 500);

            let aodType = appData.aod.clockType || '2';
            if (aodType === '1') aodType = '2';
            setAODType(aodType);

            document.body.className = appData.theme || 'theme-default';
            document.querySelectorAll('.theme-circle').forEach(c => c.classList.remove('active'));
            const themeMap = { 'theme-default': 'tc-default', 'theme-pink': 'tc-pink', 'theme-ocean': 'tc-ocean',
                'theme-sunset': 'tc-sunset', 'theme-dark': 'tc-dark', 'theme-colorful': 'tc-colorful' };
            const tc = document.querySelector(`.${themeMap[appData.theme]}`);
            if (tc) tc.classList.add('active');
            updateUI();
            setTimeout(startScrollingTextAnimation, 200);
            startNumber10Animation();
            setupBottomNavInteractions();
            setupMsgTopBarLongPress();
            document.getElementById('audio-player').addEventListener('ended', () => {
                if (loopMode === 'one') { const a = document.getElementById('audio-player');
                    a.currentTime = 0;
                    a.play(); } else nextSong();
            });
            setupLongPressBtn6();
            setupLongPressSend();
            if (appData.startDate) {
                document.getElementById('settingsDateBtnText').innerText = formatDateDDMMYYYY(appData.startDate);
                document.getElementById('date-display').innerText = formatDateDDMMYYYY(appData.startDate);
                updateDateCounter();
            }
            if (appData.aod.bgImage) document.getElementById('aodBgResetModal').classList.remove('hidden');
            else document.getElementById('aodBgResetModal').classList.add('hidden');
            updateMsgBg();
            updateSongFavUI();
            updateShuffleUI();
            updateAllFileCounts();
            updateScrollingText();

            // Load birthday data
            if (appData.profile1.birthday) {
                document.getElementById('set-p1-birthday').value = appData.profile1.birthday;
                document.getElementById('set-p1-birthday-display').innerText = formatDateDDMMYYYY(appData.profile1.birthday);
                const icon = document.getElementById('icon-p1-bday');
                if (icon) { icon.classList.add('show', 'active-icon'); }
                const card = document.getElementById('set-p1-birthday-display').closest('.field-card');
                if (card) card.classList.add('has-value');
            }
            if (appData.profile3.birthday) {
                document.getElementById('set-p3-birthday').value = appData.profile3.birthday;
                document.getElementById('set-p3-birthday-display').innerText = formatDateDDMMYYYY(appData.profile3.birthday);
                const icon = document.getElementById('icon-p3-bday');
                if (icon) { icon.classList.add('show', 'active-icon'); }
                const card = document.getElementById('set-p3-birthday-display').closest('.field-card');
                if (card) card.classList.add('has-value');
            }

            // Load phone numbers into UI - from appData to hidden inputs
            document.getElementById('set-p1-phones').value = appData.profile1.phones || '';
            document.getElementById('set-p3-phones').value = appData.profile3.phones || '';
            
            // Render phone tags for both profiles
            phoneTarget = 'boy';
            renderPhoneTagsUI();
            phoneTarget = 'girl';
            renderPhoneTagsUI();

            // Load profile names etc
            document.getElementById('set-p1-name').value = appData.profile1.name || '';
            document.getElementById('set-p1-nickname').value = appData.profile1.nickname || '';
            document.getElementById('set-p1-tg').value = appData.profile1.telegram || '';
            document.getElementById('set-p1-email').value = appData.profile1.email || '';

            document.getElementById('set-p3-name').value = appData.profile3.name || '';
            document.getElementById('set-p3-nickname').value = appData.profile3.nickname || '';
            document.getElementById('set-p3-tg').value = appData.profile3.telegram || '';
            document.getElementById('set-p3-email').value = appData.profile3.email || '';

            document.getElementById('set-scrolling-text').value = appData.scrollingText || '';

            initFieldIcons();

            if (appData.songs.length > 0) {
                for (let i = 0; i < appData.songs.length; i++) {
                    if (!appData.songAlbumArts[i]) { try { await extractAlbumArt(i); } catch (e) {} }
                }
                loadCurrentSong();
            }

            setInterval(updateDateCounter, 60000);
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible')
                    updateDateCounter(); });
            window.addEventListener('resize', () => { setTimeout(startScrollingTextAnimation, 100); });
        };

        // ===== MUSIC =====
        function cleanSongName(n) { return n.replace(/\.(mp3|m4a|wav|aac|flac|ogg)/gi, '').replace(/\(128k\)|\(256k\)/gi, '')
                .replace(/_/g, ' ').trim(); }

        function extractAlbumArt(index) {
            return new Promise((resolve) => {
                const song = appData.songs[index];
                if (!song) { resolve(null); return; }
                try {
                    const base64Data = song.data.split(',')[1];
                    if (!base64Data) { resolve(null); return; }
                    const binaryString = atob(base64Data);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
                    const blob = new Blob([bytes], { type: 'audio/mpeg' });
                    const url = URL.createObjectURL(blob);
                    if (typeof jsmediatags !== 'undefined') {
                        jsmediatags.read(url, {
                            onSuccess: (tag) => {
                                const picture = tag.tags.picture;
                                if (picture) {
                                    const base64String = picture.data.reduce((acc, byte) => acc + String
                                        .fromCharCode(byte), '');
                                    const imgSrc = `data:${picture.format};base64,${btoa(base64String)}`;
                                    appData.songAlbumArts[index] = imgSrc;
                                    localforage.setItem('core_data', appData);
                                    if (index === currentSongIndex) loadCurrentSong();
                                    resolve(imgSrc);
                                } else { resolve(null); }
                            },
                            onError: () => { resolve(null); }
                        });
                    } else { resolve(null); }
                } catch (e) { resolve(null); }
            });
        }

        function startNumber10Animation() {
            const st = document.getElementById('song-text');
            const c = document.querySelector('.song-marquee-container');
            let x = c.clientWidth;

            function anim() {
                x -= 0.8;
                if (x < -st.clientWidth) x = c.clientWidth;
                st.style.transform = `translate3d(${x}px,0,0)`;
                requestAnimationFrame(anim);
            }
            anim();
        }
        let audioCtx, analyser, source, dataArray, bufferLength;

        function setupVisualizer() {
            if (!audioCtx) {
                audioCtx = new(window.AudioContext || window.webkitAudioContext)();
                analyser = audioCtx.createAnalyser();
                const a = document.getElementById('audio-player');
                source = audioCtx.createMediaElementSource(a);
                source.connect(analyser);
                analyser.connect(audioCtx.destination);
                analyser.fftSize = 64;
                bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                drawVisualizer();
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }

        function drawVisualizer() {
            requestAnimationFrame(drawVisualizer);
            if (!isPlaying) return;
            analyser.getByteFrequencyData(dataArray);
            const bars = document.querySelectorAll('.v-bar');
            for (let i = 0; i < bars.length; i++) { let val = dataArray[i] / 255;
                bars[i].style.height = Math.max(4, val * 24) + 'px'; }
        }

        function loadCurrentSong() {
            const a = document.getElementById('audio-player');
            const wrapper = document.getElementById('albumArtWrapper');
            const img = document.getElementById('album-art');
            const placeholder = wrapper.querySelector('.music-icon-placeholder');
            if (appData.songs.length > 0) {
                const s = appData.songs[currentSongIndex];
                document.getElementById('song-text').innerText = cleanSongName(s.name);
                const albumArt = appData.songAlbumArts[currentSongIndex];
                if (albumArt) {
                    img.src = albumArt;
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                } else {
                    img.style.display = 'none';
                    placeholder.style.display = 'flex';
                    placeholder.innerHTML = '<i class="fas fa-music"></i>';
                }
                if (a.src !== s.data) { a.src = s.data; if (isPlaying) a.play(); }
                updateSongFavUI();
            } else {
                document.getElementById('song-text').innerText = "No Songs Available";
                img.style.display = 'none';
                placeholder.style.display = 'flex';
                placeholder.innerHTML = '<i class="fas fa-music"></i>';
            }
        }

        function toggleMusic() {
            const a = document.getElementById('audio-player');
            if (appData.songs.length === 0) return;
            setupVisualizer();
            if (isPlaying) { a.pause();
                document.querySelectorAll('.v-bar').forEach(b => b.style.height = '4px'); } else { a.play(); }
            isPlaying = !isPlaying;
            document.getElementById('icon-play').style.display = isPlaying ? 'none' : 'block';
            document.getElementById('icon-pause').style.display = isPlaying ? 'block' : 'none';
        }

        function getNextShuffleIndex() {
            if (appData.songs.length <= 1) return 0;
            let idx;
            let attempts = 0;
            do { idx = Math.floor(Math.random() * appData.songs.length);
                attempts++; } while (idx === currentSongIndex && attempts < 20);
            return idx;
        }

        function nextSong() {
            if (appData.songs.length <= 1) return;
            if (appData.shuffleMode) { currentSongIndex = getNextShuffleIndex(); } else { currentSongIndex = (currentSongIndex +
                    1) % appData.songs.length; }
            loadCurrentSong();
            if (isPlaying) { document.getElementById('audio-player').play(); }
        }

        function prevSong() {
            if (appData.songs.length <= 1) return;
            if (appData.shuffleMode) { currentSongIndex = getNextShuffleIndex(); } else { currentSongIndex = (currentSongIndex -
                    1 + appData.songs.length) % appData.songs.length; }
            loadCurrentSong();
            if (isPlaying) { document.getElementById('audio-player').play(); }
        }

        function toggleLoopMode() {
            loopMode = loopMode === 'all' ? 'one' : 'all';
            document.getElementById('icon-loop-all').style.display = loopMode === 'all' ? 'block' : 'none';
            document.getElementById('icon-loop-one').style.display = loopMode === 'one' ? 'block' : 'none';
            showCustomAlert(loopMode === 'all' ? "Playing All Songs" : "Repeating One Song");
        }

        function toggleShuffle() {
            appData.shuffleMode = !appData.shuffleMode;
            localforage.setItem('core_data', appData);
            updateShuffleUI();
            showCustomAlert(appData.shuffleMode ? "Shuffle ON" : "Shuffle OFF");
        }

        function updateShuffleUI() {
            const btn = document.getElementById('shuffle-btn');
            if (appData.shuffleMode) { btn.style.color = '#6e8efb';
                btn.style.borderColor = '#6e8efb'; } else { btn.style.color = 'inherit';
                btn.style.borderColor = 'var(--btn-border)'; }
        }

        function toggleSongFav() {
            if (appData.songs.length === 0) return;
            const idx = appData.songFavorites.indexOf(currentSongIndex);
            if (idx > -1) appData.songFavorites.splice(idx, 1);
            else appData.songFavorites.push(currentSongIndex);
            localforage.setItem('core_data', appData);
            updateSongFavUI();
        }

        function updateSongFavUI() {
            const btn = document.getElementById('fav-song-btn');
            if (appData.songFavorites.includes(currentSongIndex)) btn.classList.add('active');
            else btn.classList.remove('active');
        }

        // ===== SONG LIST =====
        function openSongList() {
            const container = document.getElementById('song-list-container');
            const savedScroll = container.scrollTop;
            container.innerHTML = '';
            songRemoveTarget = -1;
            if (appData.songs.length === 0) {
                container.innerHTML = '<p style="text-align:center;opacity:0.6;padding:30px;">No songs uploaded yet.</p>';
            } else {
                appData.songs.forEach((song, i) => {
                    const isFav = appData.songFavorites.includes(i);
                    const isCurrent = i === currentSongIndex;
                    const div = document.createElement('div');
                    div.className = `song-list-item${isCurrent ? ' current' : ''}`;
                    div.innerHTML = `
                        <span class="now-playing-indicator">${isCurrent ? '▶' : ''}</span>
                        <span class="song-name" style="${isCurrent ? 'color:#6e8efb;font-weight:bold;' : ''}">${cleanSongName(song.name)}</span>
                        <div style="display:flex;align-items:center;gap:6px;">
                            ${isFav ? '<span class="fav-indicator"><i class="fas fa-heart"></i></span>' : ''}
                        </div>
                        <div class="song-remove-overlay" id="song-remove-${i}">
                            <button class="song-remove-btn" onclick="removeSong(${i})">✕ Remove</button>
                        </div>
                    `;
                    let timer = null;
                    const start = () => {
                        timer = setTimeout(() => {
                            document.querySelectorAll('.song-remove-overlay').forEach(o => o.classList
                                .remove('show'));
                            const ov = document.getElementById(`song-remove-${i}`);
                            if (ov) { ov.classList.add('show');
                                songRemoveTarget = i; }
                            timer = null;
                        }, 400);
                    };
                    const cancel = () => { if (timer) { clearTimeout(timer);
                            timer = null; } };
                    div.addEventListener('mousedown', start);
                    div.addEventListener('mouseup', cancel);
                    div.addEventListener('mouseleave', cancel);
                    div.addEventListener('touchstart', start, { passive: true });
                    div.addEventListener('touchend', cancel);
                    div.addEventListener('touchcancel', cancel);
                    div.addEventListener('click', (e) => {
                        if (e.target.closest('.song-remove-btn')) return;
                        if (e.target.closest('.song-remove-overlay')) return;
                        if (i !== currentSongIndex) {
                            currentSongIndex = i;
                            loadCurrentSong();
                            if (!isPlaying) { toggleMusic(); } else { document.getElementById('audio-player')
                                .play(); }
                            openSongList();
                        }
                    });
                    container.appendChild(div);
                });
                container.scrollTop = savedScroll;
            }
            const musicBox = document.querySelector('.music-bar-container');
            const modal = document.getElementById('songListModal');
            const modalBox = modal.querySelector('.modal-box');
            if (musicBox) {
                const rect = musicBox.getBoundingClientRect();
                modalBox.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
                modalBox.style.top = 'auto';
                modalBox.style.left = '50%';
                modalBox.style.transform = 'translateX(-50%)';
                modalBox.style.maxHeight = '45vh';
            }
            document.getElementById('songListModal').style.display = 'flex';
        }

        function removeSong(i) {
            showCustomConfirm(`Remove "${cleanSongName(appData.songs[i].name)}" from playlist?`, () => {
                appData.songs.splice(i, 1);
                appData.songFavorites = appData.songFavorites.filter(idx => idx !== i).map(idx => idx > i ? idx - 1 :
                idx);
                const oldAlbumArts = appData.songAlbumArts;
                appData.songAlbumArts = {};
                Object.keys(oldAlbumArts).forEach(k => {
                    const idx = parseInt(k);
                    if (idx < i) appData.songAlbumArts[idx] = oldAlbumArts[idx];
                    else if (idx > i) appData.songAlbumArts[idx - 1] = oldAlbumArts[idx];
                });
                if (currentSongIndex >= appData.songs.length) currentSongIndex = Math.max(0, appData.songs.length - 1);
                localforage.setItem('core_data', appData);
                updateAllFileCounts();
                loadCurrentSong();
                openSongList();
                showCustomAlert("Song removed.");
                document.querySelectorAll('.song-remove-overlay').forEach(o => o.classList.remove('show'));
                songRemoveTarget = -1;
            });
        }

        // ===== SETTINGS SAVE =====
        function fileToBase64(f) { return new Promise((res, rej) => { const r = new FileReader();
                r.readAsDataURL(f);
                r.onload = () => res(r.result);
                r.onerror = rej; }); }

        async function saveAllSettings() {
            const btn = document.getElementById('save-settings-btn');
            btn.innerText = 'Processing...';
            try {
                const p1 = document.getElementById('set-profile-1').files[0];
                if (p1) appData.profile1.img = await fileToBase64(p1);
                appData.profile1.name = document.getElementById('set-p1-name').value;
                appData.profile1.nickname = document.getElementById('set-p1-nickname').value;
                appData.profile1.telegram = document.getElementById('set-p1-tg').value;
                appData.profile1.email = document.getElementById('set-p1-email').value;
                appData.profile1.phones = document.getElementById('set-p1-phones').value;

                const p3 = document.getElementById('set-profile-3').files[0];
                if (p3) appData.profile3.img = await fileToBase64(p3);
                appData.profile3.name = document.getElementById('set-p3-name').value;
                appData.profile3.nickname = document.getElementById('set-p3-nickname').value;
                appData.profile3.telegram = document.getElementById('set-p3-tg').value;
                appData.profile3.email = document.getElementById('set-p3-email').value;
                appData.profile3.phones = document.getElementById('set-p3-phones').value;

                const gFiles = document.getElementById('set-gallery').files;
                if (gFiles.length > 0) { for (let i = 0; i < gFiles.length; i++) { appData.gallery.push(await fileToBase64(
                            gFiles[i])); } }
                const sFiles = document.getElementById('set-songs').files;
                if (sFiles.length > 0) {
                    for (let i = 0; i < sFiles.length; i++) {
                        const data = await fileToBase64(sFiles[i]);
                        const idx = appData.songs.length;
                        appData.songs.push({ name: sFiles[i].name, data: data });
                        setTimeout(() => { extractAlbumArt(idx); }, 100);
                    }
                }
                appData.scrollingText = document.getElementById('set-scrolling-text').value || '';
                await localforage.setItem('core_data', appData);
                showCustomAlert("Database Saved!");
            } catch (e) { console.error(e);
                showCustomAlert("Error saving data."); }
            btn.innerText = 'Save &amp; Update App';
            document.querySelectorAll('.file-input').forEach(el => { el.value = '';
                el.classList.remove('uploaded'); });
            updateUI();
            updateSongFavUI();
            updateAllFileCounts();
            updateDateCounter();
            updateScrollingText();
            closeSettingsPage();
        }

        // ===== AOD =====
        let aodInterval;

        function setAODType(type) {
            appData.aod.clockType = type;
            document.querySelectorAll('.aod-btn').forEach(b => b.classList.remove('active'));
            const tb = document.getElementById(`aod-btn-${type}`);
            if (tb) tb.classList.add('active');
            localforage.setItem('core_data', appData);
            const aodPage = document.getElementById('aodPage');
            if (aodPage.style.display === 'flex') { clearInterval(aodInterval);
                renderAODClock();
                aodInterval = setInterval(renderAODClock, 1000);
                if (type === '3') {
                    startGyroscope();
                } else {
                    stopGyroscope();
                }
            }
        }

        function openAODSettings() { document.getElementById('aodSettingsModal').style.display = 'flex'; }

        function renderAODClock() {
            const wrap = document.getElementById('aodClockWrapper');
            const d = new Date();
            const h = d.getHours(),
                m = d.getMinutes(),
                s = d.getSeconds();
            const hh = String(h).padStart(2, '0'),
                mm = String(m).padStart(2, '0');
            const dateStr = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
            const timeStr = `${hh}:${mm}`;
            const type = appData.aod.clockType || '2';
            let html = '';
            switch (type) {
                case '2':
                    html = `<div class="c-type-2">${timeStr}</div><div class="aod-date">${dateStr}</div>`;
                    break;
                case '3':
                    html = `<div class="aod-framed-clock"><div class="time-text">${timeStr}</div><div class="date-text">${dateStr}</div></div>`;
                    break;
                case '4':
                    html = `<div class="c-type-4">${timeStr}</div><div class="aod-date">${dateStr}</div>`;
                    break;
                case '5':
                    html = buildAnalogClock(h, m, s);
                    break;
                default:
                    html = `<div class="c-type-2">${timeStr}</div><div class="aod-date">${dateStr}</div>`;
            }
            wrap.innerHTML = html;
            if (type === '5') {
                const secHand = wrap.querySelector('.second');
                if (secHand) { const deg = (s / 60) * 360;
                    secHand.style.transform = `rotate(${deg}deg)`; }
                const hourHand = wrap.querySelector('.hour');
                if (hourHand) { const deg = (h % 12) * 30 + m * 0.5;
                    hourHand.style.transform = `rotate(${deg}deg)`; }
                const minHand = wrap.querySelector('.minute');
                if (minHand) { const deg = m * 6;
                    minHand.style.transform = `rotate(${deg}deg)`; }
            }
            if (type === '3' && gyroActive) {}
        }

        function buildAnalogClock(h, m, s) {
            const hourDeg = (h % 12) * 30 + m * 0.5;
            const minDeg = m * 6;
            const secDeg = s * 6;
            let digitHtml = '';
            for (let i = 1; i <= 12; i++) {
                const ang = i * 30 - 90;
                const rad = ang * Math.PI / 180;
                const r = 130;
                const cx = 160 + Math.cos(rad) * r;
                const cy = 160 + Math.sin(rad) * r;
                digitHtml +=
                    `<div class="digit" style="position:absolute;font-size:20px;font-weight:300;color:rgba(255,255,255,0.8);transform:translate(-50%,-50%);left:${cx}px;top:${cy}px;text-shadow:0 0 12px rgba(255,255,255,0.05);">${i}</div>`;
            }
            return `<div class="aod-analog" style="position:relative;width:320px;height:320px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.2);box-shadow:0 0 60px rgba(0,0,0,0.6);flex-shrink:0;">
            ${digitHtml}
            <div class="hand hour" style="position:absolute;bottom:50%;left:50%;transform-origin:bottom center;border-radius:6px;width:5px;height:80px;margin-left:-2.5px;background:#fff;box-shadow:0 0 12px rgba(255,255,255,0.15);transform:rotate(${hourDeg}deg);"></div>
            <div class="hand minute" style="position:absolute;bottom:50%;left:50%;transform-origin:bottom center;border-radius:4px;width:4px;height:115px;margin-left:-2px;background:#ddd;box-shadow:0 0 8px rgba(255,255,255,0.1);transform:rotate(${minDeg}deg);"></div>
            <div class="hand second" style="position:absolute;bottom:50%;left:50%;transform-origin:bottom center;border-radius:4px;background:#ff4d6d;width:2px;height:125px;margin-left:-1px;box-shadow:0 0 20px rgba(255,77,109,0.4);transform:rotate(${secDeg}deg);"></div>
            <div class="center-dot" style="position:absolute;top:50%;left:50%;width:14px;height:14px;background:#ff4d6d;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;box-shadow:0 0 24px rgba(255,77,109,0.3);"></div>
          </div><div class="aod-date" style="margin-top:20px;">${new Date().toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'})}</div>`;
        }

        function openAOD() {
            const aod = document.getElementById('aodPage');
            if (appData.aod.bgImage) {
                aod.style.backgroundImage =
                    `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url(${appData.aod.bgImage})`;
                aod.style.backgroundSize = 'cover';
            } else { aod.style.background = '#000';
                aod.style.backgroundImage = 'none'; }
            aod.style.display = 'flex';
            clearInterval(aodInterval);
            renderAODClock();
            aodInterval = setInterval(renderAODClock, 1000);
            if (appData.aod.clockType === '3') {
                startGyroscope();
            }
        }

        function closeAOD() {
            document.getElementById('aodPage').style.display = 'none';
            clearInterval(aodInterval);
            stopGyroscope();
        }

        // ===== BOTTOM NAV =====
        let clickCount = 0;
        let clickTimer = null;

        function setupBottomNavInteractions() {
            const b = document.getElementById('bottom-nav');
            b.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                clickCount++;
                if (clickTimer) { clearTimeout(clickTimer);
                    clickTimer = null; }
                clickTimer = setTimeout(() => { clickCount = 0;
                    clickTimer = null; }, 500);
                if (clickCount >= 3) {
                    clickCount = 0;
                    if (clickTimer) { clearTimeout(clickTimer);
                        clickTimer = null; }
                    const aod = document.getElementById('aodPage');
                    if (aod.style.display === 'flex') closeAOD();
                    else openAOD();
                }
            });
            let pressTimer = null;
            const startPress = (e) => { if (e.target.closest('button')) return;
                pressTimer = setTimeout(() => { openSocialPanel();
                    pressTimer = null; }, 400); };
            const endPress = () => { if (pressTimer) { clearTimeout(pressTimer);
                    pressTimer = null; } };
            b.addEventListener('mousedown', startPress);
            b.addEventListener('mouseup', endPress);
            b.addEventListener('mouseleave', endPress);
            b.addEventListener('touchstart', startPress, { passive: true });
            b.addEventListener('touchend', endPress);
            b.addEventListener('touchcancel', endPress);
        }
        document.addEventListener('dblclick', function(e) {
            const aod = document.getElementById('aodPage');
            if (aod.style.display === 'flex' && !e.target.closest('.aod-menu-btn') && !e.target.closest(
                    '.modal-box') && !e.target.closest('.aod-analog') && !e.target.closest(
                    '.aod-framed-clock')) { closeAOD(); }
        });

        // ===== SOCIAL PANEL =====
        function openSocialPanel() { const p = document.getElementById('social-panel');
            p.style.display = 'flex';
            setTimeout(() => p.classList.add('show'), 10); }

        function closeSocialPanel() { const p = document.getElementById('social-panel');
            p.classList.remove('show');
            setTimeout(() => p.style.display = 'none', 400); }

        // ===== CALENDAR =====
        let currCalDate = new Date(),
            selCalDateStr = null,
            currentNoteCat = '';

        function openCalendar() {
            document.getElementById('calendarPage').style.display = 'flex';
            currCalDate = new Date();
            renderCalendar();
            const today =
                `${currCalDate.getFullYear()}-${String(currCalDate.getMonth()+1).padStart(2,'0')}-${String(currCalDate.getDate()).padStart(2,'0')}`;
            selectDate(today);
        }

        function closeCalendar() { document.getElementById('calendarPage').style.display = 'none';
            selCalDateStr = null;
            document.getElementById('date-details').style.display = 'none'; }
        let dpYear = new Date().getFullYear(),
            dpMonth = new Date().getMonth(),
            dpDay = new Date().getDate();

        function openDatePickerForCalendar() {
            dpYear = currCalDate.getFullYear();
            dpMonth = currCalDate.getMonth();
            dpDay = currCalDate.getDate();
            renderDPColumns();
            document.getElementById('customDateModal').style.display = 'flex';
            window._settingsDatePicker = false;
        }

        function openDatePickerForSettings() {
            const d = appData.startDate ? new Date(appData.startDate) : new Date();
            dpYear = d.getFullYear();
            dpMonth = d.getMonth();
            dpDay = d.getDate();
            renderDPColumns();
            document.getElementById('customDateModal').style.display = 'flex';
            window._settingsDatePicker = true;
        }

        function renderDPColumns() {
            const days = document.getElementById('dp-days');
            const months = document.getElementById('dp-months');
            const years = document.getElementById('dp-years');
            years.innerHTML = '<div style="height:80px;"></div>';
            for (let y = 1990; y <= 2050; y++) { years.innerHTML +=
                    `<div class="date-item ${y===dpYear?'selected':''}" onclick="dpSelect('year',${y})">${y}</div>`; }
            years.innerHTML += '<div style="height:80px;"></div>';
            const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            months.innerHTML = '<div style="height:80px;"></div>';
            mNames.forEach((m, i) => { months.innerHTML +=
                    `<div class="date-item ${i===dpMonth?'selected':''}" onclick="dpSelect('month',${i})">${m}</div>`; });
            months.innerHTML += '<div style="height:80px;"></div>';
            let dim = new Date(dpYear, dpMonth + 1, 0).getDate();
            if (dpDay > dim) dpDay = dim;
            days.innerHTML = '<div style="height:80px;"></div>';
            for (let d = 1; d <= dim; d++) { days.innerHTML +=
                    `<div class="date-item ${d===dpDay?'selected':''}" onclick="dpSelect('day',${d})">${String(d).padStart(2,'0')}</div>`; }
            days.innerHTML += '<div style="height:80px;"></div>';
            setTimeout(alignDPScrolls, 50);
        }

        function dpSelect(type, val) { if (type === 'year') dpYear = val; if (type === 'month') dpMonth = val; if (type ===
                'day') dpDay = val;
            renderDPColumns(); }

        function alignDPScrolls() {
            ['dp-days', 'dp-months', 'dp-years'].forEach(id => { const el = document.getElementById(id); const s = el
                    .querySelector('.selected'); if (s) el.scrollTo({ top: s.offsetTop - 85, behavior: 'smooth' }); });
        }

        function confirmCustomDate() {
            const ds =
                `${dpYear}-${String(dpMonth+1).padStart(2,'0')}-${String(dpDay).padStart(2,'0')}`;
            if (window._settingsDatePicker) {
                document.getElementById('settingsDateBtnText').innerText = formatDateDDMMYYYY(ds);
                window._settingsDatePicker = false;
                appData.startDate = ds;
                document.getElementById('date-display').innerText = formatDateDDMMYYYY(ds);
                updateDateCounter();
            } else { currCalDate = new Date(dpYear, dpMonth, dpDay);
                selectDate(ds); }
            closeModal('customDateModal');
        }

        function renderCalendar() {
            const y = currCalDate.getFullYear(),
                m = currCalDate.getMonth();
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            document.getElementById('cal-month-year').innerText = `${monthNames[m]} ${y}`;
            const first = new Date(y, m, 1).getDay();
            const dim = new Date(y, m + 1, 0).getDate();
            const grid = document.getElementById('cal-days-grid');
            grid.innerHTML = '';
            for (let i = 0; i < first; i++) grid.innerHTML += '<div></div>';
            let start = appData.startDate ? new Date(appData.startDate) : null;
            let annivDay = start ? start.getDate() : null;
            const today =
                `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;

            let boyBday = null,
                girlBday = null;
            if (appData.profile1.birthday) {
                const bd = new Date(appData.profile1.birthday);
                if (!isNaN(bd.getTime())) boyBday = { month: bd.getMonth(), day: bd.getDate(), year: bd.getFullYear() };
            }
            if (appData.profile3.birthday) {
                const bd = new Date(appData.profile3.birthday);
                if (!isNaN(bd.getTime())) girlBday = { month: bd.getMonth(), day: bd.getDate(), year: bd.getFullYear() };
            }

            for (let i = 1; i <= dim; i++) {
                const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
                const cdate = new Date(y, m, i);
                let isToday = ds === today;
                let isActive = ds === selCalDateStr;
                let showHeart = false;
                if (start && i === annivDay && cdate >= new Date(start.getFullYear(), start.getMonth(), start.getDate()))
                    showHeart = true;
                let annivHtml = showHeart ? `<div style="font-size:10px;margin-top:2px;">❤️</div>` : '';
                let dotsHtml = '';
                if (appData.calendarData[ds] && appData.calendarData[ds].notes && appData.calendarData[ds].notes.length >
                    0) { dotsHtml =
                        `<div style="width:4px;height:4px;background:currentColor;border-radius:50%;margin-top:2px;"></div>`; }

                let bdayClass = '';
                let bdayLabel = '';
                const isBoyBday = boyBday && boyBday.month === m && boyBday.day === i && y >= boyBday.year;
                const isGirlBday = girlBday && girlBday.month === m && girlBday.day === i && y >= girlBday.year;

                if (isBoyBday && isGirlBday) {
                    bdayClass = 'birthday-both';
                    const boyNick = appData.profile1.nickname?.trim();
                    const girlNick = appData.profile3.nickname?.trim();
                    if (boyNick && girlNick) { bdayLabel = `${boyNick} & ${girlNick}`; } else if (boyNick) { bdayLabel =
                            boyNick; } else if (girlNick) { bdayLabel = girlNick; }
                } else if (isBoyBday) { bdayClass = 'birthday-boy';
                    bdayLabel = appData.profile1.nickname?.trim() || ''; } else if (isGirlBday) { bdayClass =
                        'birthday-girl';
                    bdayLabel = appData.profile3.nickname?.trim() || ''; }

                let bdayHtml = '';
                if (bdayLabel) {
                    bdayHtml =
                        `<div class="birthday-badge" style="font-size:7px;opacity:0.9;margin-top:1px;">${bdayLabel}</div>`;
                }

                const extraClasses = bdayClass ? ` ${bdayClass}` : '';
                const dayHtml = `
                    <div class="cal-day ${isToday?'today':''} ${isActive?'active-day':''}${extraClasses}" onclick="selectDate('${ds}')">
                        ${i}
                        ${annivHtml}
                        ${dotsHtml}
                        ${bdayHtml}
                    </div>
                `;
                grid.innerHTML += dayHtml;
            }
        }

        function changeMonth(dir) { currCalDate.setMonth(currCalDate.getMonth() + dir);
            renderCalendar(); }

        function selectDate(ds) {
            selCalDateStr = ds;
            renderCalendar();
            document.getElementById('date-details').style.display = 'block';

            const p = new Date(ds);
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const day = p.getDate();
            const year = p.getFullYear();
            const dayOfWeek = dayNames[p.getDay()];

            const dayStr = String(day).padStart(2, '0');
            const monthStr = String(p.getMonth() + 1).padStart(2, '0');
            const yearStr = year;
            let displayText = `${dayStr}/${monthStr}/${yearStr} (${dayOfWeek})`;
            let anniversaryText = '';
            let birthdayText = '';

            let isAnniversary = false;
            if (appData.startDate) {
                const start = new Date(appData.startDate);
                if (start.getMonth() === p.getMonth() && start.getDate() === p.getDate()) {
                    isAnniversary = true;
                    anniversaryText = '❤️ OUR ANNIVERSARY';
                }
            }

            let isBirthday = false;
            let birthdayLabel = '';
            const boyNick = appData.profile1.nickname?.trim();
            const girlNick = appData.profile3.nickname?.trim();

            if (appData.profile1.birthday) {
                const bd = new Date(appData.profile1.birthday);
                if (bd.getMonth() === p.getMonth() && bd.getDate() === p.getDate()) {
                    isBirthday = true;
                    if (boyNick) birthdayLabel = `${boyNick}'s Birthday 🎂`;
                }
            }
            if (appData.profile3.birthday) {
                const bd = new Date(appData.profile3.birthday);
                if (bd.getMonth() === p.getMonth() && bd.getDate() === p.getDate()) {
                    isBirthday = true;
                    if (girlNick) {
                        if (birthdayLabel) { birthdayLabel = `${birthdayLabel} & ${girlNick}'s Birthday 🎂`; } else {
                            birthdayLabel = `${girlNick}'s Birthday 🎂`; }
                    }
                }
            }

            let extraText = '';
            if (isAnniversary && isBirthday) {
                extraText = `<span style="color:#ff4757;font-weight:700;">${anniversaryText} & ${birthdayLabel}</span>`;
            } else if (isAnniversary) {
                extraText = `<span style="color:#ff4757;font-weight:700;">${anniversaryText}</span>`;
            } else if (isBirthday) {
                extraText = `<span style="color:#ff4757;font-weight:700;">${birthdayLabel}</span>`;
            }

            if (extraText) {
                displayText = `${dayStr}/${monthStr}/${yearStr} (${dayOfWeek})<br>${extraText}`;
            }

            document.getElementById('selected-date-text').innerHTML = displayText;
            renderNotes();

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (p <= today) { document.getElementById('memory-upload-section').style.display = 'block';
                renderMemories(); } else { document.getElementById('memory-upload-section').style.display = 'none'; }
        }

        function addNoteModal(cat) { currentNoteCat = cat;
            document.getElementById('note-modal-title').innerText = `Add ${cat}`;
            document.getElementById('note-text').value = '';
            document.getElementById('noteModal').style.display = 'flex'; }

        function saveNote() {
            const t = document.getElementById('note-text').value.trim();
            if (t) {
                if (!appData.calendarData[selCalDateStr]) appData.calendarData[selCalDateStr] = { notes: [], memories: [] };
                if (!appData.calendarData[selCalDateStr].notes) appData.calendarData[selCalDateStr].notes = [];
                appData.calendarData[selCalDateStr].notes.push({ cat: currentNoteCat, text: t });
                localforage.setItem('core_data', appData);
                renderNotes();
                renderCalendar();
            }
            closeModal('noteModal');
        }

        function renderNotes() {
            const c = document.getElementById('notes-container');
            c.innerHTML = '';
            const d = appData.calendarData[selCalDateStr];
            if (d && d.notes && d.notes.length > 0) {
                d.notes.forEach((n, i) => {
                    let bg = 'rgba(255,255,255,0.4)';
                    if (document.body.classList.contains('theme-dark') || document.body.classList.contains(
                            'theme-colorful')) bg = 'rgba(255,255,255,0.1)';
                    if (n.cat === 'Note') bg = 'rgba(110,142,251,0.3)';
                    if (n.cat === 'Promises') bg = 'rgba(76,175,80,0.3)';
                    if (n.cat === 'Fault') bg = 'rgba(244,67,54,0.3)';
                    if (n.cat === 'Event') bg = 'rgba(255,152,0,0.3)';
                    c.innerHTML +=
                        `<div style="padding:12px;border-radius:12px;background:${bg};margin-bottom:10px;position:relative;font-size:14px;border:1px solid rgba(255,255,255,0.2);"><strong style="font-size:12px;opacity:0.8;display:block;margin-bottom:4px;">${n.cat}</strong>${n.text}<button onclick="deleteNote(${i})" style="position:absolute;top:10px;right:10px;background:transparent;border:none;color:inherit;opacity:0.6;cursor:pointer;">✕</button></div>`;
                });
            } else { c.innerHTML =
                    '<div style="opacity:0.6;font-size:14px;text-align:center;padding:10px;">No notes for this date.</div>'; }
        }

        function deleteNote(i) {
            showCustomConfirm("Delete this note?", () => {
                appData.calendarData[selCalDateStr].notes.splice(i, 1);
                localforage.setItem('core_data', appData);
                renderNotes();
                renderCalendar();
            });
        }

        async function uploadMemory(input) {
            if (!input.files || input.files.length === 0) return;
            if (!appData.calendarData[selCalDateStr]) appData.calendarData[selCalDateStr] = { notes: [], memories: [] };
            if (!appData.calendarData[selCalDateStr].memories) appData.calendarData[selCalDateStr].memories = [];
            for (let i = 0; i < input.files.length; i++) {
                appData.calendarData[selCalDateStr].memories.push(await fileToBase64(input.files[i]));
            }
            localforage.setItem('core_data', appData);
            renderMemories();
            input.value = '';
            input.classList.remove('uploaded');
            updateAllFileCounts();
        }

        function renderMemories() {
            const c = document.getElementById('memories-container');
            c.innerHTML = '';
            const d = appData.calendarData[selCalDateStr];
            if (d && d.memories && d.memories.length > 0) {
                d.memories.forEach((img, i) => {
                    const el = document.createElement('img');
                    el.src = img;
                    el.className = 'memory-thumb';
                    let timer;
                    const start = () => { timer = setTimeout(() => { deleteMemory(i); }, 800); };
                    const cancel = () => { clearTimeout(timer); };
                    el.addEventListener('touchstart', start, { passive: true });
                    el.addEventListener('touchend', cancel);
                    el.addEventListener('mousedown', start);
                    el.addEventListener('mouseup', cancel);
                    el.addEventListener('mouseleave', cancel);
                    el.addEventListener('click', () => { document.getElementById('full-image').src = img;
                        document.getElementById('imageViewer').style.display = 'flex'; });
                    c.appendChild(el);
                });
            }
            updateAllFileCounts();
        }

        function deleteMemory(i) {
            showCustomConfirm("Delete this memory?", () => {
                appData.calendarData[selCalDateStr].memories.splice(i, 1);
                localforage.setItem('core_data', appData);
                renderMemories();
                updateAllFileCounts();
            });
        }

        // ===== MESSAGE PAGE =====
        function openMessagePage() { document.getElementById('messagePage').style.display = 'flex';
            renderChatHistory();
            renderAccountsList(); }

        function closeMessagePage() { document.getElementById('messagePage').style.display = 'none';
            closeAccountsPopup(); }

        function setupLongPressSend() {
            const btn = document.getElementById('msg-send-btn');
            let timer;
            const start = (e) => { e.preventDefault();
                timer = setTimeout(() => { openAccountsPopup(); }, 50); };
            const cancel = () => { clearTimeout(timer); };
            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', (e) => { clearTimeout(timer); if (e.cancelable) e.preventDefault();
                sendChat(); });
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', () => { clearTimeout(timer);
                sendChat(); });
            btn.addEventListener('mouseleave', cancel);
            document.getElementById('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e
                    .preventDefault();
                    sendChat(); } });
        }

        function openAccountsPopup() { document.getElementById('accounts-popup').classList.add('show'); }

        function closeAccountsPopup() {
            document.getElementById('accounts-popup').classList.remove('show');
            document.querySelectorAll('.acc-actions-overlay').forEach(el => el.classList.remove('show'));
        }

        function openAddAccountModal() { document.getElementById('addAccountOverlay').style.display = 'flex'; }

        async function saveNewAccount() {
            const file = document.getElementById('new-acc-photo').files[0];
            const tg = document.getElementById('new-acc-tg').value.trim();
            const nick = document.getElementById('new-acc-nick').value.trim();
            if (!tg || !nick) { showCustomAlert("Please enter Telegram username and nickname."); return; }
            let photo = 'https://via.placeholder.com/40';
            if (file) photo = await fileToBase64(file);
            appData.tgAccounts.push({ photo: photo, tg: tg, nick: nick });
            appData.selectedAccIndex = appData.tgAccounts.length - 1;
            localforage.setItem('core_data', appData);
            document.getElementById('new-acc-photo').value = '';
            document.getElementById('new-acc-photo').classList.remove('uploaded');
            document.getElementById('new-acc-tg').value = '';
            document.getElementById('new-acc-nick').value = '';
            closeModal('addAccountOverlay');
            renderAccountsList();
        }

        function renderAccountsList() {
            const c = document.getElementById('accounts-list');
            c.innerHTML = '';
            if (appData.tgAccounts.length === 0) { c.innerHTML =
                    '<p style="font-size:12px;opacity:0.6;">No accounts added.</p>'; return; }
            appData.tgAccounts.forEach((a, i) => {
                const sel = i === appData.selectedAccIndex ? 'selected' : '';
                const div = document.createElement('div');
                div.className = `acc-item ${sel}`;
                div.innerHTML = `
                    <img src="${a.photo}">
                    <div class="acc-info"><span class="acc-name">${a.nick}</span><span class="acc-user">${a.tg}</span></div>
                    <span class="acc-check">✔</span>
                    <div class="acc-actions-overlay" id="acc-actions-${i}">
                        <button class="acc-action-btn acc-edit" onclick="editAccount(${i})">✎ Edit</button>
                        <button class="acc-action-btn acc-del" onclick="deleteAccount(${i})"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                `;
                let timer = null;
                const start = () => {
                    timer = setTimeout(() => {
                        document.querySelectorAll('.acc-actions-overlay').forEach(o => o.classList.remove(
                            'show'));
                        const ov = div.querySelector('.acc-actions-overlay');
                        if (ov) { ov.classList.add('show'); }
                        timer = null;
                    }, 800);
                };
                const cancel = () => { if (timer) { clearTimeout(timer);
                        timer = null; } };
                div.addEventListener('mousedown', start);
                div.addEventListener('mouseup', cancel);
                div.addEventListener('mouseleave', cancel);
                div.addEventListener('touchstart', start, { passive: true });
                div.addEventListener('touchend', cancel);
                div.addEventListener('touchcancel', cancel);
                div.addEventListener('click', (e) => {
                    if (e.target.closest('.acc-action-btn')) return;
                    if (e.target.closest('.acc-actions-overlay')) return;
                    document.querySelectorAll('.acc-actions-overlay').forEach(o => o.classList.remove('show'));
                    selectAccount(i);
                });
                c.appendChild(div);
            });
        }

        function selectAccount(i) { appData.selectedAccIndex = i;
            localforage.setItem('core_data', appData);
            renderAccountsList();
            setTimeout(closeAccountsPopup, 200); }

        function editAccount(i) {
            const acc = appData.tgAccounts[i];
            document.getElementById('new-acc-tg').value = acc.tg;
            document.getElementById('new-acc-nick').value = acc.nick;
            document.getElementById('addAccountOverlay').style.display = 'flex';
            const origSave = window.saveNewAccount;
            window.saveNewAccount = async function() {
                const tg = document.getElementById('new-acc-tg').value.trim();
                const nick = document.getElementById('new-acc-nick').value.trim();
                if (!tg || !nick) { showCustomAlert("Please enter all fields."); return; }
                const file = document.getElementById('new-acc-photo').files[0];
                if (file) acc.photo = await fileToBase64(file);
                acc.tg = tg;
                acc.nick = nick;
                localforage.setItem('core_data', appData);
                document.getElementById('new-acc-photo').value = '';
                document.getElementById('new-acc-photo').classList.remove('uploaded');
                document.getElementById('new-acc-tg').value = '';
                document.getElementById('new-acc-nick').value = '';
                closeModal('addAccountOverlay');
                renderAccountsList();
                window.saveNewAccount = origSave;
                showCustomAlert("Account updated!");
            };
            const origCancel = document.querySelector('#addAccountOverlay .btn-danger').onclick;
            document.querySelector('#addAccountOverlay .btn-danger').onclick = function() {
                window.saveNewAccount = origSave;
                document.querySelector('#addAccountOverlay .btn-danger').onclick = origCancel;
                closeModal('addAccountOverlay');
            };
            document.querySelectorAll('.acc-actions-overlay').forEach(o => o.classList.remove('show'));
        }

        function deleteAccount(i) {
            showCustomConfirm(`Delete account "${appData.tgAccounts[i].nick}"?`, () => {
                appData.tgAccounts.splice(i, 1);
                if (appData.selectedAccIndex >= appData.tgAccounts.length) appData.selectedAccIndex = Math.max(0,
                    appData.tgAccounts.length - 1);
                localforage.setItem('core_data', appData);
                renderAccountsList();
                showCustomAlert("Account deleted.");
                document.querySelectorAll('.acc-actions-overlay').forEach(o => o.classList.remove('show'));
            });
        }

        function openAddReadyMsgModal(editIndex = -1) {
            document.getElementById('edit-ready-index').value = editIndex;
            if (editIndex >= 0) {
                document.getElementById('ready-msg-title').innerText = "Edit Message";
                document.getElementById('new-ready-msg').value = appData.readyMessages[editIndex].text;
            } else {
                document.getElementById('ready-msg-title').innerText = "Add Ready-made Message";
                document.getElementById('new-ready-msg').value = '';
            }
            document.getElementById('addReadyMsgOverlay').style.display = 'flex';
        }

        async function saveReadyMsg() {
            const t = document.getElementById('new-ready-msg').value.trim();
            if (!t) return;
            const idx = parseInt(document.getElementById('edit-ready-index').value);
            if (idx >= 0) { appData.readyMessages[idx].text = t; } else { appData.readyMessages.push({ text: t }); }
            localforage.setItem('core_data', appData);
            closeModal('addReadyMsgOverlay');
            renderChatHistory();
        }

        function showEditDeleteModal(msg, index) { pendingMsgIndex = index;
            document.getElementById('editDeleteMsg').innerText = msg;
            document.getElementById('editDeleteModal').style.display = 'flex'; }

        function confirmEditDelete(action) {
            closeModal('editDeleteModal');
            if (pendingMsgIndex === -1) return;
            const idx = pendingMsgIndex;
            pendingMsgIndex = -1;
            if (action === 'edit') editReadyMsg(idx);
            else if (action === 'delete') deleteReadyMsg(idx);
        }

        function renderChatHistory() {
            const c = document.getElementById('chat-history');
            c.innerHTML = '';
            if (appData.readyMessages.length === 0) {
                c.innerHTML = '<p style="text-align:center;opacity:0.9;margin-top:50px;">No messages saved yet.</p>';
                return;
            }
            appData.readyMessages.forEach((msg, i) => {
                const b = document.createElement('div');
                b.className = 'chat-bubble right';
                b.innerText = msg.text;
                b.dataset.index = i;
                let timer = null;
                const start = () => { timer = setTimeout(() => { showEditDeleteModal(msg.text, i);
                        timer = null; }, 400); };
                const cancel = () => { if (timer) { clearTimeout(timer);
                        timer = null; } };
                b.addEventListener('mousedown', start);
                b.addEventListener('mouseup', cancel);
                b.addEventListener('mouseleave', cancel);
                b.addEventListener('touchstart', start, { passive: true });
                b.addEventListener('touchend', cancel);
                b.addEventListener('touchcancel', cancel);
                b.addEventListener('click', (e) => {
                    if (document.getElementById('editDeleteModal').style.display === 'flex') return;
                    document.getElementById('chat-input').value = msg.text;
                    document.getElementById('chat-input').focus();
                });
                c.appendChild(b);
            });
            c.scrollTop = c.scrollHeight;
        }

        function editReadyMsg(i) { openAddReadyMsgModal(i); }

        function deleteReadyMsg(i) {
            showCustomConfirm(`Delete this message?`, () => {
                appData.readyMessages.splice(i, 1);
                localforage.setItem('core_data', appData);
                renderChatHistory();
                showCustomAlert("Message deleted.");
            });
        }

        function sendChat() {
            const t = document.getElementById('chat-input').value.trim();
            if (!t) return;
            if (appData.tgAccounts.length === 0) {
                showCustomAlert("Please long-press Send to add a Telegram account.");
                return;
            }
            const acc = appData.tgAccounts[appData.selectedAccIndex];
            const un = acc.tg.replace('@', '');
            window.open(`https://t.me/${un}?text=${encodeURIComponent(t)}`, '_blank');
            document.getElementById('chat-input').value = '';
        }

        // ===== GALLERY =====
        function updateUI() {
            if (appData.profile1.img) {
                const btn1 = document.getElementById('btn-1');
                btn1.innerHTML = `<img src="${appData.profile1.img}" class="profile-img" style="width:100%;height:100%;border-radius:50%;object-fit:cover;image-rendering:auto;">`;
            }
            if (appData.profile3.img) {
                const btn3 = document.getElementById('btn-3');
                btn3.innerHTML = `<img src="${appData.profile3.img}" class="profile-img" style="width:100%;height:100%;border-radius:50%;object-fit:cover;image-rendering:auto;">`;
            }
            if (appData.startDate) {
                document.getElementById('date-display').innerText = formatDateDDMMYYYY(appData.startDate);
            } else {
                document.getElementById('date-display').innerText = 'Set Date';
            }
            updateGalleryUI();
            loadCurrentSong();
            updateAllFileCounts();
            updateDateCounter();
            updateScrollingText();
        }

        function showProfileInfo(num) {
            const p = num === 1 ? appData.profile1 : appData.profile3;
            const img = document.getElementById('view-profile-img');
            if (p.img) { img.src = p.img;
                img.style.display = 'block'; } else { img.style.display = 'none'; }
            document.getElementById('view-profile-name').innerText = p.name || (num === 1 ? 'Add Boy' : 'Add Girl');
            document.getElementById('view-profile-nickname').innerText = p.nickname || '-';
            document.getElementById('view-profile-birthday').innerText = p.birthday ? formatDateDDMMYYYY(p.birthday) : '-';
            let tg = '-';
            if (p.telegram) {
                let link = p.telegram.startsWith('http') ? p.telegram : `https://t.me/${p.telegram.replace('@','')}`;
                tg = `<a href="${link}" target="_blank" style="color:#0088cc;text-decoration:none;font-weight:bold;">${p.telegram}</a>`;
            }
            document.getElementById('view-profile-tg').innerHTML = tg;
            document.getElementById('view-profile-email').innerHTML = p.email ?
                `<a href="mailto:${p.email}" style="color:#0088cc;text-decoration:none;font-weight:bold;">${p.email}</a>` :
                '-';

            // === PHONE NUMBERS - တစ်လိုင်းလျှင်တစ်ခု ===
            const phones = p.phones ? p.phones.split('|').map(s => s.trim()).filter(s => s) : [];
            const container = document.getElementById('view-profile-phones-container');
            const listEl = document.getElementById('view-profile-phones-list');
            
            if (phones.length > 0) {
                let ph = '';
                phones.forEach(pt => {
                    ph += `<a href="tel:${pt}">
                        <svg viewBox="0 0 24 24"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.14v-3.49c0-.54-.45-.99-.99-.99z"/></svg>
                        ${pt}
                    </a>`;
                });
                listEl.innerHTML = ph;
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }

            document.getElementById('profileOverlay').style.display = 'flex';
        }

        function updateGalleryUI() {
            const bg4 = document.getElementById('bg-layer-4');
            const bg6 = document.getElementById('bg-layer-6');
            const like = document.getElementById('like-btn');
            if (appData.gallery.length > 0) {
                document.getElementById('img-placeholder-4').style.display = 'none';
                let cur = appData.gallery[currentImgIndex];
                bg4.style.backgroundImage = `url(${cur})`;
                if (appData.favorites.includes(cur)) like.classList.add('liked');
                else like.classList.remove('liked');
                if (appData.gallery.length > 1) {
                    document.getElementById('img-placeholder-6').style.display = 'none';
                    let next = (currentImgIndex + 1) % appData.gallery.length;
                    bg6.style.backgroundImage = `url(${appData.gallery[next]})`;
                } else { bg6.style.backgroundImage = `url(${appData.gallery[0]})`; }
            } else {
                bg4.style.backgroundImage = 'none';
                bg6.style.backgroundImage = 'none';
                like.classList.remove('liked');
                document.getElementById('img-placeholder-4').style.display = 'block';
                document.getElementById('img-placeholder-6').style.display = 'block';
            }
        }

        function viewBigImage() { if (appData.gallery.length > 0) { document.getElementById('full-image').src = appData
                    .gallery[currentImgIndex];
                document.getElementById('imageViewer').style.display = 'flex'; } }

        function closeImageViewer() { document.getElementById('imageViewer').style.display = 'none'; }

        function toggleLike(e) {
            e.stopPropagation();
            if (appData.gallery.length === 0) return;
            const cur = appData.gallery[currentImgIndex];
            const idx = appData.favorites.indexOf(cur);
            if (idx > -1) appData.favorites.splice(idx, 1);
            else appData.favorites.push(cur);
            localforage.setItem('core_data', appData);
            updateGalleryUI();
        }

        function openFavGallery() {
            const c = document.getElementById('fav-gallery-container');
            c.innerHTML = '';
            if (appData.favorites.length === 0) { c.innerHTML =
                    '<p style="text-align:center;width:100%;color:#aaa;">No favorite images yet.</p>'; } else {
                appData.favorites.forEach(img => { const el = document.createElement('img');
                    el.src = img;
                    el.className = 'fav-item';
                    c.appendChild(el); });
            }
            document.getElementById('favGalleryPage').style.display = 'flex';
        }

        function closeFavGallery() { document.getElementById('favGalleryPage').style.display = 'none'; }

        function setupLongPressBtn6() {
            const btn = document.getElementById('btn-6');
            let timer;
            const start = () => { timer = setTimeout(() => { openEditGalleryModal(); }, 400); };
            const cancel = () => { clearTimeout(timer); };
            btn.addEventListener('touchstart', start, { passive: true });
            btn.addEventListener('touchend', cancel);
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', cancel);
            btn.addEventListener('mouseleave', cancel);
        }

        function openEditGalleryModal() {
          document.getElementById('editGalleryOverlay').style.display = 'flex';
          const loader = document.getElementById('gallery-loader');
          const grid = document.getElementById('edit-gallery-grid');
          loader.style.display = 'flex';
          grid.innerHTML = '';
  
          setTimeout(() => {
            tempGalleryEdit = [...appData.gallery];
            renderEditGallery();
            loader.style.display = 'none';
          }, 300);
        }

        function renderEditGallery() {
            const g = document.getElementById('edit-gallery-grid');
            g.innerHTML = '';
            tempGalleryEdit.forEach((img, i) => { g.innerHTML +=
                    `<div class="edit-thumb-container"><img src="${img}" class="edit-thumb"><button class="delete-btn" onclick="removeTempGalleryImg(${i})">✕</button></div>`; });
        }

        function removeTempGalleryImg(i) { tempGalleryEdit.splice(i, 1);
            renderEditGallery(); }

        function saveEditedGallery() {
            appData.gallery = [...tempGalleryEdit];
            appData.favorites = appData.favorites.filter(img => appData.gallery.includes(img));
            if (currentImgIndex >= appData.gallery.length) currentImgIndex = 0;
            localforage.setItem('core_data', appData);
            updateGalleryUI();
            updateAllFileCounts();
            closeModal('editGalleryOverlay');
        }

        function prevImage() { if (appData.gallery.length === 0) return;
            currentImgIndex = (currentImgIndex - 1 + appData.gallery.length) % appData.gallery.length;
            updateGalleryUI(); }

        function nextImage() { if (appData.gallery.length === 0) return;
            currentImgIndex = (currentImgIndex + 1) % appData.gallery.length;
            updateGalleryUI(); }

        // ===== MISC =====
        function toggleGuide() { const b = document.getElementById('guideBody'); const a = document.getElementById(
                'guideArrow');
            b.classList.toggle('open');
            a.classList.toggle('open'); }

        function closeModal(id) { document.getElementById(id).style.display = 'none'; }

        function openSettingsPage() { populateSettingsForm();
            document.getElementById('settingsPage').style.display = 'flex'; }

        function closeSettingsPage() { document.getElementById('settingsPage').style.display = 'none'; }

        function populateSettingsForm() {
            document.getElementById('set-p1-name').value = appData.profile1.name || '';
            document.getElementById('set-p1-nickname').value = appData.profile1.nickname || '';
            if (appData.profile1.birthday) {
                document.getElementById('set-p1-birthday').value = appData.profile1.birthday;
                document.getElementById('set-p1-birthday-display').innerText = formatDateDDMMYYYY(appData.profile1.birthday);
                const icon = document.getElementById('icon-p1-bday');
                if (icon) { icon.classList.add('show', 'active-icon'); }
                const card = document.getElementById('set-p1-birthday-display').closest('.field-card');
                if (card) card.classList.add('has-value');
            }
            document.getElementById('set-p1-tg').value = appData.profile1.telegram || '';
            document.getElementById('set-p1-email').value = appData.profile1.email || '';
            document.getElementById('set-p1-phones').value = appData.profile1.phones || '';
            phoneTarget = 'boy';
            renderPhoneTagsUI();

            document.getElementById('set-p3-name').value = appData.profile3.name || '';
            document.getElementById('set-p3-nickname').value = appData.profile3.nickname || '';
            if (appData.profile3.birthday) {
                document.getElementById('set-p3-birthday').value = appData.profile3.birthday;
                document.getElementById('set-p3-birthday-display').innerText = formatDateDDMMYYYY(appData.profile3.birthday);
                const icon = document.getElementById('icon-p3-bday');
                if (icon) { icon.classList.add('show', 'active-icon'); }
                const card = document.getElementById('set-p3-birthday-display').closest('.field-card');
                if (card) card.classList.add('has-value');
            }
            document.getElementById('set-p3-tg').value = appData.profile3.telegram || '';
            document.getElementById('set-p3-email').value = appData.profile3.email || '';
            document.getElementById('set-p3-phones').value = appData.profile3.phones || '';
            phoneTarget = 'girl';
            renderPhoneTagsUI();

            document.getElementById('settingsDateBtnText').innerText = appData.startDate ? formatDateDDMMYYYY(appData.startDate) : 'Select Date';
            document.getElementById('set-scrolling-text').value = appData.scrollingText || '';
            updateAllFileCounts();
            initFieldIcons();
        }

        if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register(
                'sw.js').catch(() => {}); }); }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const appContainer = document.getElementById('appContainer');
                if (appContainer.style.display !== 'none') {
                    const overlay = document.getElementById('streakRestoreOverlay');
                    if (!overlay.classList.contains('active') && isStreakBroken()) {
                        if (!streakRestorePending) {
                            streakRestorePending = true;
                            checkAndPromptRestore();
                        }
                    }
                }
                updateDateCounter();
            }
        });

        window.addEventListener('load', function() {
            setTimeout(() => {
                const appContainer = document.getElementById('appContainer');
                if (appContainer.style.display !== 'none') {
                    if (isStreakBroken() && !streakRestorePending) {
                        streakRestorePending = true;
                        checkAndPromptRestore();
                    }
                }
            }, 800);
        });

        window.addEventListener('resize', updateDateCounter);

        // ===== MESSAGE PAGE: KEYBOARD-AWARE INPUT BAR =====
        // FIX (2026-08-23): previously the whole page shifted/shrank when the
        // iOS keyboard opened (default browser behavior). The body already
        // has overflow:hidden so nothing else can scroll — this listener uses
        // the visualViewport API to move ONLY the message input bar up by
        // exactly the keyboard's height, via a transform. The background,
        // top bar, and chat history never move or resize.
        (function setupKeyboardAwareInputBar() {
            if (!window.visualViewport) return;
            const vv = window.visualViewport;
            let rafId = null;

            function applyOffset() {
                rafId = null;
                const bar = document.getElementById('chatInputBarContainer');
                const msgPage = document.getElementById('messagePage');
                if (!bar || !msgPage) return;
                if (getComputedStyle(msgPage).display === 'none') {
                    bar.style.transform = '';
                    return;
                }
                const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                bar.style.transform = keyboardHeight > 10 ? `translateY(-${keyboardHeight}px)` : '';
            }

            function onViewportChange() {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(applyOffset);
            }

            vv.addEventListener('resize', onViewportChange);
            vv.addEventListener('scroll', onViewportChange);

            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.addEventListener('blur', () => {
                    const bar = document.getElementById('chatInputBarContainer');
                    if (bar) bar.style.transform = '';
                });
            }
        })();

        // ===== MOBILE DEBUG OVERLAY (iOS diagnostics) =====
        // Temporary: catches any JS error and shows it directly on screen so
        // issues can be diagnosed on a phone without needing a computer.
        // Safe to remove once the "nothing works on iOS" issue is confirmed fixed.
        (function setupMobileDebugOverlay() {
            const box = document.createElement('div');
            box.id = 'debugErrorOverlay';
            box.style.cssText = 'display:none;position:fixed;left:0;right:0;bottom:0;max-height:40vh;overflow:auto;' +
                'background:rgba(20,0,0,0.92);color:#ff6b6b;font:11px/1.4 monospace;padding:10px;' +
                'padding-bottom:calc(10px + env(safe-area-inset-bottom, 0px));z-index:99999999;white-space:pre-wrap;';
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(box));
            function report(msg) {
                if (!box.parentNode) document.body.appendChild(box);
                box.style.display = 'block';
                box.textContent += msg + '\n\n';
            }
            window.addEventListener('error', (e) => {
                report(`JS Error: ${e.message}\nFile: ${e.filename}:${e.lineno}:${e.colno}`);
            });
            window.addEventListener('unhandledrejection', (e) => {
                report(`Promise rejection: ${e.reason}`);
            });
        })();
