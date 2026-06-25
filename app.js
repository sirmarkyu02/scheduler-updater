/**
 * Automated School Scheduler Pro - Ultimate Edition
 * Intellectual Property of John Marq E. Ramos © 2026
 * Upgraded with IndexedDB & Custom UI Feedback
 */

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const Config = {
    VERSION: "v6.3 Ultimate",
    CURRENT_VERSION: "6.3",
    REMOTE_KEYS_URL: "https://sirmarkyu02.github.io/scheduler-updater/keys.json",
    REMOTE_VERSION_URL: "https://sirmarkyu02.github.io/scheduler-updater/version.json",
    START_MINS: 450,
    END_MINS: 1080,
    PIXELS_PER_HALF_HOUR: 40,
    WEEKDAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    COLORS: ['#fee2e2', '#dbeafe', '#dcfce7', '#fef9c3', '#f3e8ff', '#fce7f3', '#ffedd5', '#e0f2fe', '#ccfbf1'],
    STORAGE_KEY: 'schoolSchedulerProUltimateData',
    STORAGE_BACKUP_KEY: 'schoolSchedulerProUltimateData_PreviousSession'
};

const State = {
    roomsPool: [], teachersPool: [], subjectsPool: [], sectionsPool: [], excludedRooms: [], scheduledClasses: [],
    classIdCounter: 0, currentEditingId: null, currentViewingId: null,
    originalEditTeacher: '', originalEditSection: '',
    currentBackupName: "New Session", maxTeacherHours: 27, colorIndex: 0
};

// Security Check
(function verifyIntellectualPropertyIntegrity() {
    const absoluteCreator = "John Marq E. Ramos";
    const currentMetadataSignature = document.querySelector('meta[name="author"]')?.getAttribute('content');
    if (currentMetadataSignature !== absoluteCreator) {
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:20%; font-family:sans-serif;'>System execution disabled. Please restore attribution credentials to original software author John Marq E. Ramos.</h2>";
        throw new Error("Application Authorization Revoked.");
    }
})();

console.log(
    `%c━ Automated School Scheduler Pro ${Config.VERSION} ━\n%cIntellectual Property of John Marq E. Ramos\n%cAll Rights Reserved © 2026`,
    "color: #4f46e5; font-size: 16px; font-weight: bold; font-family: sans-serif;",
    "color: #0f172a; font-size: 13px; font-weight: 600; font-family: sans-serif;",
    "color: #64748b; font-size: 11px; font-family: sans-serif;"
);

// ==========================================
// 2. CUSTOM UI FRAMEWORK (Toasts & Modals)
// ==========================================
const AppUI = {
    showToast: (msg, type = 'info') => {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        
        toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },
    
    showConfirm: (msg) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('customConfirmOverlay');
            document.getElementById('confirmMessage').innerText = msg;
            overlay.style.display = 'flex';
            
            const btnYes = document.getElementById('confirmBtnYes');
            const btnNo = document.getElementById('confirmBtnNo');
            
            const cleanup = () => {
                overlay.style.display = 'none';
                btnYes.removeEventListener('click', onYes);
                btnNo.removeEventListener('click', onNo);
            };
            
            const onYes = () => { cleanup(); resolve(true); };
            const onNo = () => { cleanup(); resolve(false); };
            
            btnYes.addEventListener('click', onYes);
            btnNo.addEventListener('click', onNo);
        });
    },

    clearAllErrors: () => {
        ['sidebarErrorBanner', 'topbarErrorBanner', 'modalErrorBanner'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
    },
    
    showSidebarError: (msg) => { let b = document.getElementById('sidebarErrorBanner'); b.innerText = msg; b.style.display = 'block'; },
    showTopbarError: (msg) => { let b = document.getElementById('topbarErrorBanner'); b.innerText = msg; b.style.display = 'block'; setTimeout(() => b.style.display='none', 5000); }
};

// ==========================================
// 3. STORAGE & ACTIVATION (IndexedDB)
// ==========================================

async function checkActivation() {
    const overlay = document.getElementById("activationOverlay");
    // We now store the ACTUAL key, not just "true", so we can re-verify it
    const savedKey = await localforage.getItem("schedulerProUltimateKey");

    if (!savedKey) {
        overlay.style.display = "flex";
        return;
    }

    try {
        // Silently verify the saved key against the live server on boot
        const response = await fetch(`${Config.REMOTE_KEYS_URL}?nocache=${Date.now()}`);
        if (response.ok) {
            const data = await response.json();
            
            // Check if the server still lists this key as valid
            if (data.validKeys && data.validKeys.includes(savedKey)) {
                overlay.style.display = "none";
            } else {
                // Key was removed from GitHub (Revoked!)
                await localforage.removeItem("schedulerProUltimateKey");
                overlay.style.display = "flex";
                const errorEl = document.getElementById("activationError");
                errorEl.innerText = "Your activation key has been revoked or expired.";
                errorEl.style.display = "block";
            }
        } else {
            // Network error (GitHub down), allow offline access
            console.warn("Activation Server unreachable. Bypassing strict check for offline mode.");
            overlay.style.display = "none";
        }
    } catch (error) {
        // No internet connection, allow offline access to prevent locking teachers out
        console.warn("User is offline. Bypassing strict check.");
        overlay.style.display = "none";
    }
}

window.verifyActivation = async function() {
    const input = document.getElementById("activationKeyInput").value.trim();
    const errorEl = document.getElementById("activationError");
    const activateBtn = document.querySelector("#activationOverlay .btn-primary");

    if (!input) return;

    // UX: Show loading state
    activateBtn.innerText = "Verifying...";
    activateBtn.disabled = true;
    errorEl.style.display = "none";

    try {
        // Fetch valid keys from GitHub
        const response = await fetch(`${Config.REMOTE_KEYS_URL}?nocache=${Date.now()}`);
        if (!response.ok) throw new Error("Server not reachable");

        const data = await response.json();

        // Validate input against the remote array
        if (data.validKeys && data.validKeys.includes(input)) {
            // Save the valid key to IndexedDB
            await localforage.setItem("schedulerProUltimateKey", input); 
            document.getElementById("activationOverlay").style.display = "none";
            AppUI.showToast("Activation Successful! Welcome to Scheduler Pro " + Config.VERSION, 'success');
        } else {
            errorEl.innerText = "Invalid activation code. Access Denied.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error(error);
        errorEl.innerText = "Unable to connect to activation server. Check your internet connection.";
        errorEl.style.display = "block";
    } finally {
        // Restore button state
        activateBtn.innerText = "Activate Software";
        activateBtn.disabled = false;
    }
};

async function saveToLocal() {
    const data = {
        roomsPool: State.roomsPool, teachersPool: State.teachersPool, subjectsPool: State.subjectsPool, sectionsPool: State.sectionsPool, excludedRooms: State.excludedRooms, scheduledClasses: State.scheduledClasses, classIdCounter: State.classIdCounter, colorIndex: State.colorIndex, currentBackupName: State.currentBackupName,
        prefs: {
            font: document.getElementById('prefFont').value, size: document.getElementById('prefSize').value, align: document.getElementById('prefAlign').value,
            titleBold: document.getElementById('prefTitleBold').checked, titleItalic: document.getElementById('prefTitleItalic').checked,
            detBold: document.getElementById('prefDetailsBold').checked, detItalic: document.getElementById('prefDetailsItalic').checked,
            maxTeacherHours: State.maxTeacherHours
        }
    };
    try {
        await localforage.setItem(Config.STORAGE_KEY, data);
        const ind = document.getElementById('autoSaveIndicator'); 
        ind.style.opacity = '1'; 
        setTimeout(() => ind.style.opacity = '0.3', 2000);
    } catch (error) {
        console.error("Storage error:", error);
        AppUI.showToast("Storage failed. Please ensure your browser supports IndexedDB.", "error");
    }
}

async function loadFromLocal() {
    try {
        const data = await localforage.getItem(Config.STORAGE_KEY);
        if (data) {
            State.roomsPool = data.roomsPool || []; State.teachersPool = data.teachersPool || []; State.subjectsPool = data.subjectsPool || []; State.sectionsPool = data.sectionsPool || [];
            State.excludedRooms = data.excludedRooms || []; State.scheduledClasses = data.scheduledClasses || []; State.classIdCounter = data.classIdCounter || 0; State.colorIndex = data.colorIndex || 0;
            State.currentBackupName = data.currentBackupName || "New Session";
            
            let badgeText = document.getElementById('backupNameText'); if (badgeText) badgeText.innerText = State.currentBackupName;
            
            if (data.prefs) {
                document.getElementById('prefFont').value = data.prefs.font || "'Inter', 'Segoe UI', Tahoma, Geneva, sans-serif";
                document.getElementById('prefSize').value = data.prefs.size || "12";
                document.getElementById('fontSizeLabel').innerText = (data.prefs.size || "12") + 'px';
                document.getElementById('prefAlign').value = data.prefs.align || "left";
                if(data.prefs.titleBold !== undefined) document.getElementById('prefTitleBold').checked = data.prefs.titleBold;
                if(data.prefs.titleItalic !== undefined) document.getElementById('prefTitleItalic').checked = data.prefs.titleItalic;
                if(data.prefs.detBold !== undefined) document.getElementById('prefDetailsBold').checked = data.prefs.detBold;
                if(data.prefs.detItalic !== undefined) document.getElementById('prefDetailsItalic').checked = data.prefs.detItalic;
                if(data.prefs.maxTeacherHours !== undefined) {
                    State.maxTeacherHours = data.prefs.maxTeacherHours;
                    document.getElementById('targetTeachHours').value = State.maxTeacherHours;
                }
            }
        }
    } catch(e) { console.error("Could not load storage", e); }
}

// ==========================================
// 4. CORE HELPERS & UI TOGGLES
// ==========================================
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

function isSharedRoom(roomName) {
    if(!roomName) return false; let r = roomName.toLowerCase().trim();
    return r === 'faculty' || r === 'consultation room';
}

function toggleSidebarMenu() { document.querySelector('.sidebar').classList.toggle('hidden'); }
function toggleFullscreenMode() {
    let target = document.getElementById('timetableContainer');
    if (!document.fullscreenElement) { target.requestFullscreen().catch(err => AppUI.showToast(`Fullscreen failed`, 'error')); } 
    else { document.exitFullscreen(); }
}

function togglePanel(panelId, headerEl) {
    const panel = document.getElementById(panelId); const icon = headerEl.querySelector('.toggle-icon');
    if (panel.classList.contains('active')) { panel.classList.remove('active'); icon.style.transform = 'rotate(0deg)'; } 
    else { panel.classList.add('active'); icon.style.transform = 'rotate(180deg)'; }
}
function toggleAdvancedMenus() {
    const wrapper = document.getElementById('advancedMenusWrapper');
    wrapper.style.display = wrapper.style.display === 'none' ? 'flex' : 'none';
}

window.toggleWorkloadMatrix = function() {
    const container = document.getElementById('workloadContainer');
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        setTimeout(() => {
            container.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    } else {
        container.style.display = 'none';
    }
};

// ==========================================
// 5. SESSION MANAGEMENT
// ==========================================
window.startNewSession = async function() {
    if (await AppUI.showConfirm("Start a new session? Everything will be deleted from the previous session. Your existing data will be saved to a 'Previous Session' state.")) {
        const currentData = { roomsPool: State.roomsPool, teachersPool: State.teachersPool, subjectsPool: State.subjectsPool, sectionsPool: State.sectionsPool, excludedRooms: State.excludedRooms, scheduledClasses: State.scheduledClasses, classIdCounter: State.classIdCounter, colorIndex: State.colorIndex, currentBackupName: State.currentBackupName, prefs: { maxTeacherHours: State.maxTeacherHours } };
        try { await localforage.setItem(Config.STORAGE_BACKUP_KEY, currentData); } catch (e) { console.error("Backup failed."); }

        State.roomsPool = []; State.teachersPool = []; State.subjectsPool = []; State.sectionsPool = []; State.excludedRooms = []; State.scheduledClasses = []; State.classIdCounter = 0; State.colorIndex = 0;
        State.currentBackupName = "New Session"; 
        
        document.getElementById('backupNameText').innerText = State.currentBackupName; document.getElementById('viewMode').value = 'all'; 
        
        ['subject', 'description', 'newRoomInput', 'newTeacherInput', 'newSectionInput', 'newSubjectInput'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).value = '';
        });
        
        updateFilterOptions(null, true); triggerUpdate(); 
        AppUI.showToast("A fresh new session has started!", "success");
    }
};

window.clearTimetable = async function() {
    if (await AppUI.showConfirm("Clear the entire timetable? Pools will remain, but all classes and breaks will be deleted.")) {
        State.scheduledClasses = []; State.classIdCounter = 0; State.colorIndex = 0;
        updateFilterOptions(null, true); triggerUpdate();
        AppUI.showToast("Timetable Cleared.", "success");
    }
};

// ==========================================
// 6. RESOURCE MANAGEMENT (Rooms, Subjects, etc.)
// ==========================================
function setDropdownToFixedValue(dropdownId, value) {
    let dropdown = document.getElementById(dropdownId);
    if (dropdown) { dropdown.innerHTML = `<option value="${value}">${value}</option>`; dropdown.value = value; dropdown.disabled = true; }
}

function resetDropdownToPool(dropdownId, includeAuto = false) {
    let dropdown = document.getElementById(dropdownId); if(!dropdown) return;
    dropdown.innerHTML = includeAuto ? '<option value="auto">Auto-Assign (Any Vacant)</option>' : '';
    State.roomsPool.forEach(room => { let r = room.trim(); if(r.length > 0) dropdown.innerHTML += `<option value="${r}">${r}</option>`; });
    dropdown.disabled = false;
}

function toggleExcludeRooms() {
    const roomSel = document.getElementById('preferredRoom'); const excludeDiv = document.getElementById('excludeRoomContainer');
    if(roomSel && excludeDiv) excludeDiv.style.display = roomSel.value === 'auto' ? 'flex' : 'none';
}

function renderExcludeRoomList() {
    const container = document.getElementById('excludeRoomList'); if (!container) return; container.innerHTML = '';
    State.roomsPool.sort().forEach(r => {
        if (!isSharedRoom(r)) { 
            let isChecked = State.excludedRooms.includes(r) ? 'checked' : '';
            container.innerHTML += `<div class="checkbox-item"><input type="checkbox" value="${r}" class="exclude-room-cb" onchange="updateExcludeRoomsArr()" ${isChecked}><label>${r}</label></div>`; 
        }
    });
}

window.updateExcludeRoomsArr = function() {
    State.excludedRooms = [];
    document.querySelectorAll('.exclude-room-cb:checked').forEach(cb => State.excludedRooms.push(cb.value));
    saveToLocal();
};

window.updateMaxHours = function() {
    let val = parseFloat(document.getElementById('targetTeachHours').value);
    if (!isNaN(val) && val > 0) { State.maxTeacherHours = val; saveToLocal(); renderWorkloadAnalytics(); }
};

function triggerUpdate() { 
    renderClasses(); saveToLocal(); renderRoomsUi(); renderTeachersUi(); renderSubjectsUi(); renderSectionsUi();
}

function renderUiList(pool, containerId, editFn, removeFn, emptyMsg) {
    const container = document.getElementById(containerId); if(!container) return; container.innerHTML = '';
    if (pool.length === 0) { container.innerHTML = `<div class="empty-list">${emptyMsg}</div>`; return; }
    pool.forEach((item, index) => {
        let row = document.createElement('div'); row.className = "list-item";
        row.innerHTML = `<span>${escapeHTML(item)}</span><div class="list-actions"><button class="btn-secondary btn-small" onclick="${editFn}(${index})">Edit</button><button class="btn-danger btn-small" onclick="${removeFn}(${index})">Remove</button></div>`;
        container.appendChild(row);
    });
}

function renderRoomsUi() {
    renderUiList(State.roomsPool, 'roomsUiList', 'editRoomInline', 'removeRoomInline', 'No rooms in pool');
    renderExcludeRoomList();
}

window.addRoomFromUI = function() {
    AppUI.clearAllErrors(); let input = document.getElementById('newRoomInput'); let val = input.value.trim(); if(!val) return;
    if(State.roomsPool.map(r => r.toLowerCase()).includes(val.toLowerCase())) { AppUI.showSidebarError("Room exists."); return; }
    State.roomsPool.push(val); input.value = '';
    if(['class', 'homeroom', 'studentOrg', 'commonTime'].includes(document.getElementById('taskType').value)) {
        let currentPref = document.getElementById('preferredRoom').value; resetDropdownToPool('preferredRoom', true);
        if (currentPref === 'auto' || State.roomsPool.includes(currentPref)) { if (document.getElementById('taskType').value !== 'commonTime') document.getElementById('preferredRoom').value = currentPref; }
    }
    triggerUpdate();
};

window.editRoomInline = async function(index) {
    let oldName = State.roomsPool[index]; let newName = prompt("Edit Room Name:", oldName);
    if(!newName || newName.trim() === oldName) return; newName = newName.trim();
    if(State.roomsPool.map(r => r.toLowerCase()).includes(newName.toLowerCase())) { AppUI.showToast("Name exists.", "error"); return; }
    State.scheduledClasses.forEach(c => { if(!c.isLunch && c.room === oldName) c.room = newName; });
    if(State.excludedRooms.includes(oldName)) State.excludedRooms[State.excludedRooms.indexOf(oldName)] = newName;
    State.roomsPool[index] = newName;
    if(['class', 'homeroom', 'studentOrg', 'commonTime'].includes(document.getElementById('taskType').value)) {
        resetDropdownToPool('preferredRoom', true);
        if (document.getElementById('taskType').value === 'commonTime') setDropdownToFixedValue('preferredRoom', 'Faculty');
    }
    updateFilterOptions(document.getElementById('viewMode').value === 'room' && document.getElementById('filterValue').value === oldName ? newName : true, false); triggerUpdate();
};

window.removeRoomInline = async function(index) {
    let roomName = State.roomsPool[index];
    if(State.scheduledClasses.some(c => !c.isLunch && c.room === roomName)) {
        if(!(await AppUI.showConfirm(`Warning: Classes assigned to "${roomName}". Proceed?`))) return;
    }
    State.roomsPool.splice(index, 1); State.excludedRooms = State.excludedRooms.filter(r => r !== roomName);
    if(['class', 'homeroom', 'studentOrg', 'commonTime'].includes(document.getElementById('taskType').value)) {
        resetDropdownToPool('preferredRoom', true); if (document.getElementById('taskType').value === 'commonTime') setDropdownToFixedValue('preferredRoom', 'Faculty');
    }
    updateFilterOptions(true, false); triggerUpdate();
};

function populateDatalist(pool, listId1, listId2) {
    const list1 = document.getElementById(listId1); const list2 = document.getElementById(listId2);
    if(list1) list1.innerHTML = ''; if(list2) list2.innerHTML = '';
    pool.sort().forEach(item => {
        if(list1) list1.innerHTML += `<option value="${escapeHTML(item)}">`;
        if(list2) list2.innerHTML += `<option value="${escapeHTML(item)}">`;
    });
}

function renderSubjectsUi() {
    if (State.subjectsPool.length === 0 && State.scheduledClasses.length > 0) {
        let set = new Set(); State.scheduledClasses.forEach(c => { if (!c.isLunch && ['class','homeroom','studentOrg','commonTime'].includes(c.taskType) && c.subject) set.add(c.subject.trim()); });
        State.subjectsPool = Array.from(set).sort();
    }
    populateDatalist(State.subjectsPool, 'subjectDatalist', 'editSubjectDatalist');
    renderUiList(State.subjectsPool, 'subjectsUiList', 'editSubjectInline', 'removeSubjectInline', 'No subjects');
}

window.addSubjectFromUI = function() {
    AppUI.clearAllErrors(); let input = document.getElementById('newSubjectInput'); let val = input.value.trim(); if (!val) return;
    if (State.subjectsPool.map(s => s.toLowerCase()).includes(val.toLowerCase())) { AppUI.showSidebarError("Subject exists."); return; }
    State.subjectsPool.push(val); input.value = ''; triggerUpdate();
};

window.editSubjectInline = function(index) {
    let oldName = State.subjectsPool[index]; let newName = prompt("Edit Subject:", oldName);
    if(!newName || newName.trim() === oldName) return; newName = newName.trim();
    if(State.subjectsPool.map(s => s.toLowerCase()).includes(newName.toLowerCase())) { AppUI.showToast("Name exists.", "error"); return; }
    State.scheduledClasses.forEach(c => { if (!c.isLunch && c.subject === oldName) c.subject = newName; }); State.subjectsPool[index] = newName; triggerUpdate();
};

window.removeSubjectInline = async function(index) {
    let subName = State.subjectsPool[index];
    if (!(await AppUI.showConfirm(`Delete subject "${subName}" and ALL associated classes?`))) return;
    State.scheduledClasses = State.scheduledClasses.filter(c => c.isLunch || c.subject !== subName); State.subjectsPool.splice(index, 1); triggerUpdate();
};

function renderSectionsUi() {
    if (State.sectionsPool.length === 0 && State.scheduledClasses.length > 0) {
        let set = new Set(); State.scheduledClasses.forEach(c => {
            if (!c.isLunch && c.section && c.section !== 'N/A') set.add(c.section.trim());
            else if (c.isLunch && c.targetType === 'section' && c.targetName) set.add(c.targetName.trim());
        }); State.sectionsPool = Array.from(set).sort();
    }
    let pop = (el) => { if (!el) return; el.innerHTML = ''; el.disabled = false; if (State.sectionsPool.length === 0) { el.innerHTML = '<option value="" disabled selected>Add in Setup</option>'; return; } State.sectionsPool.sort().forEach(sec => el.innerHTML += `<option value="${escapeHTML(sec)}">${escapeHTML(sec)}</option>`); };
    let taskType = document.getElementById('taskType') ? document.getElementById('taskType').value : 'class';
    if (['class','homeroom','studentOrg'].includes(taskType)) pop(document.getElementById('section'));
    let editTaskType = document.getElementById('editTaskType') ? document.getElementById('editTaskType').value : 'class';
    if (['class','homeroom','studentOrg'].includes(editTaskType)) pop(document.getElementById('editSection'));
    renderUiList(State.sectionsPool, 'sectionsUiList', 'editSectionInline', 'removeSectionInline', 'No sections');
    handleBreakTargetChange();
}

window.addSectionFromUI = function() {
    AppUI.clearAllErrors(); let input = document.getElementById('newSectionInput'); let val = input.value.trim(); if (!val) return;
    if (State.sectionsPool.map(s => s.toLowerCase()).includes(val.toLowerCase())) { AppUI.showSidebarError("Section exists."); return; }
    State.sectionsPool.push(val); input.value = ''; triggerUpdate();
};

window.editSectionInline = function(index) {
    let oldName = State.sectionsPool[index]; let newName = prompt("Edit Section:", oldName);
    if(!newName || newName.trim() === oldName) return; newName = newName.trim();
    if(State.sectionsPool.map(s => s.toLowerCase()).includes(newName.toLowerCase())) { AppUI.showToast("Name exists.", "error"); return; }
    State.scheduledClasses.forEach(c => { if (!c.isLunch && c.section === oldName) c.section = newName; else if (c.isLunch && c.targetType === 'section' && c.targetName === oldName) c.targetName = newName; });
    State.sectionsPool[index] = newName; updateFilterOptions(document.getElementById('viewMode').value === 'section' && document.getElementById('filterValue').value === oldName ? newName : true, false); triggerUpdate();
};

window.removeSectionInline = async function(index) {
    let secName = State.sectionsPool[index];
    if (!(await AppUI.showConfirm(`Delete section "${secName}" and ALL records?`))) return;
    State.scheduledClasses = State.scheduledClasses.filter(c => { if (!c.isLunch && c.section === secName) return false; if (c.isLunch && c.targetType === 'section' && c.targetName === secName) return false; return true; });
    State.sectionsPool.splice(index, 1); updateFilterOptions(true, false); triggerUpdate();
};

function renderTeachersUi() {
    if (State.teachersPool.length === 0 && State.scheduledClasses.length > 0) {
        let set = new Set(); State.scheduledClasses.forEach(c => {
            if (!c.isLunch && c.teacher && c.teacher !== 'ALL TEACHERS') set.add(c.teacher.trim());
            else if (c.isLunch && c.targetType === 'teacher' && c.targetName) set.add(c.targetName.trim());
        }); State.teachersPool = Array.from(set).sort();
    }
    const tSel = document.getElementById('teacher'); const eSel = document.getElementById('editTeacher');
    if (tSel) tSel.innerHTML = ''; if (eSel) eSel.innerHTML = '';
    if (State.teachersPool.length === 0) {
        if(tSel) tSel.innerHTML = '<option value="" disabled selected>Add in Setup</option>';
        if(eSel) eSel.innerHTML = '<option value="" disabled selected>No teachers</option>';
    } else {
        State.teachersPool.sort().forEach(t => {
            if(tSel) tSel.innerHTML += `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`;
            if(eSel) eSel.innerHTML += `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`;
        });
    }
    renderUiList(State.teachersPool, 'teachersUiList', 'editTeacherInline', 'removeTeacherInline', 'No teachers');
    handleBreakTargetChange();
}

window.addTeacherFromUI = function() {
    AppUI.clearAllErrors(); let input = document.getElementById('newTeacherInput'); let val = input.value.trim(); if (!val) return;
    if (State.teachersPool.map(t => t.toLowerCase()).includes(val.toLowerCase())) { AppUI.showSidebarError("Teacher exists."); return; }
    State.teachersPool.push(val); input.value = ''; triggerUpdate();
};

window.editTeacherInline = function(index) {
    let oldName = State.teachersPool[index]; let newName = prompt("Edit Teacher:", oldName);
    if(!newName || newName.trim() === oldName) return; newName = newName.trim();
    if(State.teachersPool.map(t => t.toLowerCase()).includes(newName.toLowerCase())) { AppUI.showToast("Name exists.", "error"); return; }
    State.scheduledClasses.forEach(c => { if (!c.isLunch && c.teacher === oldName) c.teacher = newName; else if (c.isLunch && c.targetType === 'teacher' && c.targetName === oldName) c.targetName = newName; });
    State.teachersPool[index] = newName; updateFilterOptions(document.getElementById('viewMode').value === 'teacher' && document.getElementById('filterValue').value === oldName ? newName : true, false); triggerUpdate();
};

window.removeTeacherInline = async function(index) {
    let teacherName = State.teachersPool[index];
    if (!(await AppUI.showConfirm(`Delete teacher "${teacherName}" and ALL tasks?`))) return;
    State.scheduledClasses = State.scheduledClasses.filter(c => { if (!c.isLunch && c.teacher === teacherName) return false; if (c.isLunch && c.targetType === 'teacher' && c.targetName === teacherName) return false; return true; });
    State.teachersPool.splice(index, 1); updateFilterOptions(true, false); triggerUpdate();
};

// ==========================================
// 7. FORM LOGIC & CONFLICT DETECTION
// ==========================================
window.handleTaskTypeChange = function() {
    let type = document.getElementById('taskType').value; let subInput = document.getElementById('subject');
    subInput.disabled = false; document.getElementById('section').disabled = false; 
    document.getElementById('preferredRoom').disabled = false; document.getElementById('teacher').disabled = false;
    renderTeachersUi();

    if(type === 'admin') { subInput.value = 'Administrative Task'; subInput.disabled = true; setDropdownToFixedValue('section', 'N/A'); setDropdownToFixedValue('preferredRoom', 'Faculty'); } 
    else if(type === 'consult') { subInput.value = 'Consultation Time'; subInput.disabled = true; setDropdownToFixedValue('section', 'N/A'); setDropdownToFixedValue('preferredRoom', 'Consultation Room'); } 
    else if(type === 'homeroom') { subInput.value = 'Homeroom'; subInput.disabled = true; renderSectionsUi(); resetDropdownToPool('preferredRoom', true); } 
    else if(type === 'studentOrg') { subInput.value = 'Student Org in Club'; subInput.disabled = true; renderSectionsUi(); resetDropdownToPool('preferredRoom', true); } 
    else if(type === 'commonTime') { subInput.value = 'Common Time / Meeting'; setDropdownToFixedValue('teacher', 'ALL TEACHERS'); setDropdownToFixedValue('section', 'N/A'); setDropdownToFixedValue('preferredRoom', 'Faculty'); } 
    else { subInput.value = ''; renderSectionsUi(); resetDropdownToPool('preferredRoom', true); }
    toggleExcludeRooms();
};

function generateTimeSlots() { let slots = []; for (let t = Config.START_MINS; t < Config.END_MINS; t += 30) slots.push(t); return slots; }
const timeSlots = generateTimeSlots();

function minutesToTimeStr(min) {
    let h = Math.floor(min / 60); let m = min % 60; let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function checkHardConflict(proposed, timelineContext, currentId = null) {
    for (let t = proposed.start; t < proposed.start + proposed.duration; t += 30) {
        if (!timeSlots.includes(t)) return true; 
        let overlap = timelineContext.some(c => {
            if (currentId !== null && c.id === currentId) return false;
            let matchTime = (c.day === proposed.day && t >= c.start && t < (c.start + c.duration));
            if (!matchTime) return false;

            if (proposed.taskType === 'commonTime' || c.taskType === 'commonTime') {
                if (proposed.isLunch && proposed.targetType === 'section') return false;
                if (c.isLunch && c.targetType === 'section') return false;
                return true; 
            }

            if (proposed.isLunch) {
                if (c.isLunch) return (c.targetType === proposed.targetType && c.targetName === proposed.targetName);
                return proposed.targetType === 'teacher' ? (c.teacher === proposed.targetName) : (c.section === proposed.targetName);
            } else {
                if (c.isLunch) return c.targetType === 'teacher' ? (proposed.teacher === c.targetName) : (proposed.section === c.targetName);
                let sectionConflict = (proposed.section !== 'N/A' && c.section === proposed.section);
                let roomConflict = false;
                if (!isSharedRoom(proposed.room)) roomConflict = (c.room === proposed.room);
                return (roomConflict || c.teacher === proposed.teacher || sectionConflict);
            }
        });
        if (overlap) return true;
    }
    return false;
}

function checkFatigue(proposed, timelineContext, currentId = null) {
    if (proposed.isLunch) return false; 
    let dynamicTimeline = currentId !== null ? timelineContext.filter(c => c.id !== currentId) : timelineContext;
    return checkTargetFatigue('teacher', proposed.teacher, proposed, dynamicTimeline) || (proposed.section !== 'N/A' && checkTargetFatigue('section', proposed.section, proposed, dynamicTimeline));
}

function checkTargetFatigue(type, name, proposed, dynamicTimeline) {
    let daily = dynamicTimeline.filter(c => {
        if (c.day !== proposed.day) return false;
        if (c.taskType === 'commonTime') return type === 'teacher';
        if (c.isLunch) return c.targetType === type && c.targetName === name;
        return type === 'teacher' ? c.teacher === name : c.section === name;
    });
    let totalTimeline = [...daily, proposed].sort((a,b) => a.start - b.start);
    let continuous = 0; let prevEnd = null; let sequenceIncludesProposed = false;
    for (let block of totalTimeline) {
        if (block.isLunch || block.taskType !== 'class') { continuous = 0; prevEnd = block.start + block.duration; sequenceIncludesProposed = false; continue; }
        if (prevEnd === null || block.start === prevEnd) continuous += block.duration; else { continuous = block.duration; sequenceIncludesProposed = false; }
        if (block === proposed) sequenceIncludesProposed = true;
        if (continuous > 270 && sequenceIncludesProposed) return true; 
        prevEnd = block.start + block.duration;
    }
    return false;
}

window.handleAddSchedule = async function() {
    AppUI.clearAllErrors();
    let taskType = document.getElementById('taskType').value;
    let teacher = document.getElementById('teacher') ? document.getElementById('teacher').value : '';
    let subject = document.getElementById('subject').value.trim();
    let section = document.getElementById('section') ? document.getElementById('section').value : '';
    let description = document.getElementById('description').value.trim();
    let totalMins = parseFloat(document.getElementById('totalHours').value) * 60;
    let sessionDuration = parseFloat(document.getElementById('duration').value) * 60;
    let preferredRoom = document.getElementById('preferredRoom').value;
    
    let allowedDays = []; Config.WEEKDAYS.forEach(d => { if(document.getElementById(`day-${d}`).checked) allowedDays.push(d); });
    if (taskType === 'commonTime') { teacher = 'ALL TEACHERS'; section = 'N/A'; }
    if(!teacher || !subject || !section) { AppUI.showSidebarError("Complete Teacher, Subject, and Section."); return; }
    if(allowedDays.length === 0) { AppUI.showSidebarError("Pick at least one allowed weekday."); return; }

    if (!State.subjectsPool.includes(subject) && ['class', 'homeroom', 'studentOrg', 'commonTime'].includes(taskType)) { State.subjectsPool.push(subject); renderSubjectsUi(); }

    let requiredDurations = []; let remainingMins = totalMins;
    while (remainingMins > 0) { if (remainingMins >= sessionDuration) { requiredDurations.push(sessionDuration); remainingMins -= sessionDuration; } else { requiredDurations.push(remainingMins); remainingMins = 0; } }
    let sessionsNeeded = requiredDurations.length;

    if (totalMins % sessionDuration !== 0) {
        let blockStrings = requiredDurations.map(m => (m / 60).toFixed(1) + "h").join(", ");
        if (!(await AppUI.showConfirm(`Total time doesn't divide evenly. Will schedule exact blocks of: ${blockStrings}. Proceed?`))) return;
    }

    let temporaryAllocations = []; let color = Config.COLORS[State.colorIndex % Config.COLORS.length]; let sessionsBooked = 0;

    if (taskType === 'class') {
        if (sessionsNeeded > allowedDays.length) { AppUI.showSidebarError(`Error: Need ${sessionsNeeded} sessions, but only picked ${allowedDays.length} days.`); return; }
        let tempAllocations = [];
        for (let day of allowedDays) {
            if (sessionsBooked >= sessionsNeeded) break; 
            let daySuccess = false; let targetRooms = preferredRoom === 'auto' ? State.roomsPool.filter(r => !isSharedRoom(r) && r.trim().length > 0 && !State.excludedRooms.includes(r)) : [preferredRoom];
            let currentBlockDuration = requiredDurations[sessionsBooked];

            for (let slot of timeSlots) {
                for (let room of targetRooms) {
                    let proposed = { id: State.classIdCounter + tempAllocations.length, isLunch: false, taskType, teacher, subject, section, description, day, start: slot, duration: currentBlockDuration, room, color };
                    let timelineContext = State.scheduledClasses.concat(temporaryAllocations, tempAllocations);
                    if (!checkHardConflict(proposed, timelineContext) && !checkFatigue(proposed, timelineContext)) { tempAllocations.push(proposed); daySuccess = true; sessionsBooked++; break; }
                }
                if (daySuccess) break; 
            }
        }
        if (sessionsBooked < sessionsNeeded) { AppUI.showSidebarError(`Scheduling Failed: Found slots for ${sessionsBooked}/${sessionsNeeded} sessions.`); return; }
        temporaryAllocations.push(...tempAllocations); State.classIdCounter += tempAllocations.length; 
    } else {
        let sessionsPerDay = {}; allowedDays.forEach(d => sessionsPerDay[d] = 0);
        let balancingRemainder = sessionsNeeded; while(balancingRemainder > 0) { for(let day of allowedDays) { if(balancingRemainder > 0) { sessionsPerDay[day]++; balancingRemainder--; } } }
        for (let day of allowedDays) {
            let targetForThisDay = sessionsPerDay[day]; let bookedForThisDay = 0;
            for (let slot of timeSlots) {
                if (bookedForThisDay >= targetForThisDay) break;
                let targetRooms = preferredRoom === 'auto' ? State.roomsPool.filter(r => !isSharedRoom(r) && r.trim().length > 0 && !State.excludedRooms.includes(r)) : [preferredRoom];
                for (let room of targetRooms) {
                    let currentBlockDuration = requiredDurations[sessionsBooked];
                    let proposed = { id: State.classIdCounter, isLunch: false, taskType, teacher, subject, section, description, day, start: slot, duration: currentBlockDuration, room, color };
                    let timelineContext = State.scheduledClasses.concat(temporaryAllocations);
                    if (!checkHardConflict(proposed, timelineContext) && !checkFatigue(proposed, timelineContext)) { temporaryAllocations.push(proposed); State.classIdCounter++; bookedForThisDay++; sessionsBooked++; break; }
                }
            }
        }
        if (sessionsBooked < sessionsNeeded) { AppUI.showSidebarError(`Scheduling Failed: Found slots for ${sessionsBooked}/${sessionsNeeded} sessions.`); return; }
    }
    
    State.scheduledClasses = State.scheduledClasses.concat(temporaryAllocations); document.getElementById('description').value = '';
    if(taskType === 'class') State.colorIndex++; 
    
    const mode = document.getElementById('viewMode').value; let focusOnNewItem = true; 
    if (mode === 'teacher') focusOnNewItem = teacher; else if (mode === 'section') focusOnNewItem = section; else if (mode === 'room' && preferredRoom !== 'auto') focusOnNewItem = preferredRoom;
    updateFilterOptions(focusOnNewItem, false); triggerUpdate();
};

window.handleBreakTargetChange = function() {
    let type = document.getElementById('breakTargetType').value; let targetSel = document.getElementById('breakTargetName');
    targetSel.innerHTML = ''; let pool = type === 'teacher' ? State.teachersPool : State.sectionsPool;
    pool.sort().forEach(item => { targetSel.innerHTML += `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`; });
};

window.handleAddBreak = function() {
    AppUI.clearAllErrors();
    let targetType = document.getElementById('breakTargetType').value; let targetName = document.getElementById('breakTargetName').value;
    let start = parseInt(document.getElementById('breakStart').value); let duration = parseInt(document.getElementById('breakDuration').value);
    let allowedDays = []; Config.WEEKDAYS.forEach(d => { if(document.getElementById(`b-day-${d}`).checked) allowedDays.push(d); });
    if(!targetName) { AppUI.showSidebarError("Specify Target name."); return; }
    if(allowedDays.length === 0) { AppUI.showSidebarError("Pick at least one day for the break."); return; }

    let temporaryAllocations = [];
    for(let day of allowedDays) {
        let proposed = { id: State.classIdCounter, isLunch: true, targetType, targetName, day, start, duration };
        if (checkHardConflict(proposed, State.scheduledClasses)) { AppUI.showSidebarError(`Conflict: ${targetName} already scheduled on ${day}.`); return; }
        temporaryAllocations.push(proposed); State.classIdCounter++;
    }
    State.scheduledClasses = State.scheduledClasses.concat(temporaryAllocations);
    const mode = document.getElementById('viewMode').value; updateFilterOptions(mode === targetType ? targetName : true, false); triggerUpdate();
};

// ==========================================
// 8. DRAG AND DROP LOGIC
// ==========================================
window.allowDrop = (ev) => ev.preventDefault();
window.dragStart = (ev, id) => { AppUI.clearAllErrors(); ev.dataTransfer.setData("classId", id); setTimeout(() => { let el = document.getElementById(`card-${id}`); if(el) el.classList.add('dragging'); }, 0); };
window.dragEnd = (ev, id) => { let el = document.getElementById(`card-${id}`); if(el) el.classList.remove('dragging'); };

window.handleDrop = async function(ev, day) {
    ev.preventDefault(); let id = parseInt(ev.dataTransfer.getData("classId"));
    let el = document.getElementById(`card-${id}`); if(el) el.classList.remove('dragging');

    let targetArea = document.getElementById(`area-${day}`); 
    let rect = targetArea.getBoundingClientRect(); let y = ev.clientY - rect.top;
    let height = targetArea.offsetHeight || 840; let percent = y / height;
    let rawMins = percent * (Config.END_MINS - Config.START_MINS);
    let newStart = Config.START_MINS + (Math.round(rawMins / 30) * 30);
    
    let originalClass = State.scheduledClasses.find(c => c.id === id); if (!originalClass) return;
    if (newStart < Config.START_MINS) newStart = Config.START_MINS; if (newStart + originalClass.duration > Config.END_MINS) newStart = Config.END_MINS - originalClass.duration;
    
    let proposedUpdate = { ...originalClass, day: day, start: newStart };
    if (checkHardConflict(proposedUpdate, State.scheduledClasses, id)) { AppUI.showTopbarError("Move aborted: Room or Schedule Conflict."); return; }
    if (!proposedUpdate.isLunch && checkFatigue(proposedUpdate, State.scheduledClasses, id)) { if(!(await AppUI.showConfirm("Warning: Exceeds 4.5 continuous teaching hours. Move anyway?"))) return; }
    
    State.scheduledClasses[State.scheduledClasses.findIndex(c => c.id === id)] = proposedUpdate; triggerUpdate();
};

// ==========================================
// 9. RENDERING (Grid, Cards, Analytics)
// ==========================================
function buildCalendarGrid() {
    const wrapper = document.getElementById('calendarWrapper'); wrapper.innerHTML = '';
    let timeCol = document.createElement('div'); timeCol.className = 'time-labels'; timeCol.innerHTML = '<div class="time-label-header"></div>';
    timeSlots.forEach(slot => { timeCol.innerHTML += `<div class="time-slot-label">${minutesToTimeStr(slot)}</div>`; });
    wrapper.appendChild(timeCol);

    Config.WEEKDAYS.forEach(day => {
        let dayCol = document.createElement('div'); dayCol.className = 'day-column'; dayCol.id = `col-${day}`;
        dayCol.innerHTML = `<div class="day-header">${day}</div><div class="day-events-area" id="area-${day}" ondragover="allowDrop(event)" ondrop="handleDrop(event, '${day}')"></div><div class="column-resizer"></div>`;
        wrapper.appendChild(dayCol);
    });
    initResizers();
}

let isResizing = false; let currentResizer = null; let startX = 0; let startWidth = 0;
function initResizers() {
    document.querySelectorAll('.column-resizer').forEach(resizer => {
        resizer.addEventListener('mousedown', function(e) {
            isResizing = true; currentResizer = e.target; startX = e.pageX; startWidth = currentResizer.parentElement.offsetWidth;
            currentResizer.classList.add('resizing'); document.body.classList.add('resizing-active'); e.preventDefault(); 
        });
    });
}
document.addEventListener('mousemove', function(e) {
    if (!isResizing || !currentResizer) return;
    const newWidth = Math.max(120, startWidth + (e.pageX - startX));
    const col = currentResizer.parentElement; col.style.flex = 'none'; col.style.width = newWidth + 'px'; col.style.minWidth = newWidth + 'px';
});
document.addEventListener('mouseup', function(e) {
    if (isResizing) { isResizing = false; if (currentResizer) currentResizer.classList.remove('resizing'); currentResizer = null; document.body.classList.remove('resizing-active'); }
});
window.resetColumnWidths = function() { document.querySelectorAll('.day-column').forEach(col => { col.style.flex = '1'; col.style.width = ''; col.style.minWidth = '120px'; }); };

function renderClasses() {
    Config.WEEKDAYS.forEach(day => { let area = document.getElementById(`area-${day}`); if(area) area.innerHTML = ''; });
    const prefFont = document.getElementById('prefFont').value; const prefSize = document.getElementById('prefSize').value + 'px'; const prefAlign = document.getElementById('prefAlign').value;
    const titleStyle = `font-weight: ${document.getElementById('prefTitleBold').checked ? 'bold' : 'normal'}; font-style: ${document.getElementById('prefTitleItalic').checked ? 'italic' : 'normal'};`;
    const detStyle = `font-weight: ${document.getElementById('prefDetailsBold').checked ? 'bold' : 'normal'}; font-style: ${document.getElementById('prefDetailsItalic').checked ? 'italic' : 'normal'};`;

    let classesToRender = getFilteredClasses();
    classesToRender.forEach(c => {
        let area = document.getElementById(`area-${c.day}`); if(!area) return;
        let topPosition = ((c.start - Config.START_MINS) / 30) * Config.PIXELS_PER_HALF_HOUR; let cardHeight = (c.duration / 30) * Config.PIXELS_PER_HALF_HOUR;
        let overlaps = classesToRender.filter(other => other.day === c.day && Math.max(c.start, other.start) < Math.min(c.start + c.duration, other.start + other.duration)).sort((a, b) => a.id - b.id);
        let widthPercent = 100 / overlaps.length; let leftPercent = overlaps.findIndex(o => o.id === c.id) * widthPercent;

        let card = document.createElement('div'); card.id = `card-${c.id}`; card.className = c.isLunch ? 'class-card lunch-card' : 'class-card';
        card.setAttribute('draggable', 'true'); card.setAttribute('ondragstart', `dragStart(event, ${c.id})`); card.setAttribute('ondragend', `dragEnd(event, ${c.id})`);
        
        if(!c.isLunch) {
            if (c.taskType === 'admin') { card.style.backgroundColor = '#fef08a'; card.style.borderLeftColor = '#ca8a04'; } 
            else if (c.taskType === 'consult') { card.style.backgroundColor = '#e9d5ff'; card.style.borderLeftColor = '#9333ea'; } 
            else if (c.taskType === 'homeroom') { card.style.backgroundColor = '#cffafe'; card.style.borderLeftColor = '#06b6d4'; } 
            else if (c.taskType === 'studentOrg') { card.style.backgroundColor = '#fce7f3'; card.style.borderLeftColor = '#db2777'; } 
            else if (c.taskType === 'commonTime') { card.style.backgroundColor = '#fde047'; card.style.borderLeftColor = '#ca8a04'; }
            else { card.style.backgroundColor = c.color || '#e0f2fe'; }
        }
        
        card.style.fontFamily = prefFont; card.style.fontSize = prefSize; card.style.textAlign = prefAlign;
        card.style.top = `${topPosition}px`; card.style.height = `${cardHeight}px`; card.style.width = `${widthPercent}%`; card.style.left = `${leftPercent}%`; card.style.zIndex = 20 + Math.floor(topPosition); 
        card.setAttribute('onclick', `openViewModal(${c.id})`); card.title = "Click to view details, or drag to move";

        let safeSub = escapeHTML(c.subject); let safeT = escapeHTML(c.teacher); let safeSec = escapeHTML(c.section); let safeRm = escapeHTML(c.room); let safeTgt = escapeHTML(c.targetName);
        let descHtml = c.description ? `<div class="card-detail" style="font-style: italic; color: #475569; margin-top: 4px;">💬 ${escapeHTML(c.description)}</div>` : '';

        if (c.isLunch) { card.innerHTML = `<div class="card-subject" style="text-align:center; margin-top:4px; ${titleStyle}">☕ BREAK</div><div class="card-detail" style="text-align:center; ${detStyle}">${safeTgt}</div>`; } 
        else if (c.taskType === 'commonTime') { card.innerHTML = `<div class="card-subject" style="${titleStyle}">👥 ${safeSub}</div><div class="card-detail" style="${detStyle}">All Teachers</div><div class="card-detail" style="${detStyle}">Room: ${safeRm}</div>${descHtml}`; } 
        else if (['admin','consult'].includes(c.taskType)) { let emoji = c.taskType === 'admin' ? '📁' : '🗣️'; card.innerHTML = `<div class="card-subject" style="${titleStyle}">${emoji} ${safeSub}</div><div class="card-detail" style="${detStyle}">Teacher: ${safeT}</div><div class="card-detail" style="${detStyle}">Room: ${safeRm}</div>${descHtml}`; } 
        else { card.innerHTML = `<div class="card-subject" style="${titleStyle}">${safeSub}</div><div class="card-detail" style="${detStyle}">Section: ${safeSec}</div><div class="card-detail" style="${detStyle}">Teacher: ${safeT}</div><div class="card-detail" style="${detStyle}">Room: ${safeRm}</div>${descHtml}`; }
        area.appendChild(card);
    });
    renderWorkloadAnalytics(); handleFilterValueChange(true);
}

function getFilteredClasses() {
    const mode = document.getElementById('viewMode').value; const filterValue = document.getElementById('filterValue').value;
    return State.scheduledClasses.filter(c => {
        if (mode === 'all') { if (c.isLunch && c.targetType === 'teacher') return false; return true; }
        if (c.taskType === 'commonTime') { if (mode === 'teacher') return true; if (mode === 'room') return c.room === filterValue; return false; }
        if (c.isLunch) {
            if (mode === 'teacher') return c.targetType === 'teacher' && c.targetName === filterValue;
            if (mode === 'section') return c.targetType === 'section' && c.targetName === filterValue;
            return false;
        } else {
            if (mode === 'teacher') return c.teacher === filterValue;
            if (mode === 'section') return c.section === filterValue;
            if (mode === 'room') return c.room === filterValue;
        }
    });
}

function renderWorkloadAnalytics() {
    let container = document.getElementById('workloadAnalyticsContainer'); if(!container) return;
    let metrics = {}; State.teachersPool.forEach(t => { metrics[t] = { classMins: 0, adminMins: 0, consultMins: 0, homeroomMins: 0, orgMins: 0 }; });
    State.scheduledClasses.forEach(c => {
        if(c.taskType === 'commonTime') { State.teachersPool.forEach(t => { if(metrics[t]) metrics[t].adminMins += c.duration; }); } 
        else if(!c.isLunch && c.teacher && metrics[c.teacher]) {
            if(c.taskType === 'class') metrics[c.teacher].classMins += c.duration; else if(c.taskType === 'admin') metrics[c.teacher].adminMins += c.duration; else if(c.taskType === 'consult') metrics[c.teacher].consultMins += c.duration; else if(c.taskType === 'homeroom') metrics[c.teacher].homeroomMins += c.duration; else if(c.taskType === 'studentOrg') metrics[c.teacher].orgMins += c.duration;
        }
    });
    let html = `<table class="workload-table"><thead><tr><th>Teacher</th><th>Regular Class</th><th>Admin Task</th><th>Consultation</th><th>Homeroom</th><th>Student Org</th><th>Total Logged Hours</th><th>Status</th></tr></thead><tbody>`;
    State.teachersPool.sort().forEach(t => {
        let m = metrics[t]; let regularHours = m.classMins / 60; let totalHours = (m.classMins + m.adminMins + m.consultMins + m.homeroomMins + m.orgMins) / 60;
        let statusLabel = '<span class="load-ok">Balanced</span>'; let rowClass = '';
        if (totalHours === 0) { statusLabel = '<span style="color:#94a3b8;">Inactive</span>'; } else if (regularHours > State.maxTeacherHours) { statusLabel = `<span class="load-alert">⚠️ Overload (+${(regularHours - State.maxTeacherHours).toFixed(1)}h)</span>`; rowClass = 'class="row-overload"'; } else if (regularHours < State.maxTeacherHours) { statusLabel = `<span class="load-alert-under">📉 Underload (-${(State.maxTeacherHours - regularHours).toFixed(1)}h)</span>`; }
        html += `<tr ${rowClass}><strong><td>${escapeHTML(t)}</td></strong><td>${(m.classMins/60).toFixed(1)}h</td><td>${(m.adminMins/60).toFixed(1)}h</td><td>${(m.consultMins/60).toFixed(1)}h</td><td>${(m.homeroomMins/60).toFixed(1)}h</td><td>${(m.orgMins/60).toFixed(1)}h</td><td><strong>${totalHours.toFixed(1)} hrs</strong></td><td>${statusLabel}</td></tr>`;
    });
    html += '</tbody></table>'; container.innerHTML = html;
}

window.handleFilterValueChange = function(onlyAnalytics = false) {
    if(!onlyAnalytics) renderClasses();
    const mode = document.getElementById('viewMode').value; const filterVal = document.getElementById('filterValue').value;
    const analyticsPanel = document.getElementById('analyticsPanel');
    if (mode === 'teacher' && filterVal) {
        let teachMins = 0, adminMins = 0, consultMins = 0, otherMins = 0;
        State.scheduledClasses.forEach(c => {
            if (!c.isLunch && (c.teacher === filterVal || c.taskType === 'commonTime')) {
                if (c.taskType === 'admin' || c.taskType === 'commonTime') adminMins += c.duration;
                else if (c.taskType === 'consult') consultMins += c.duration;
                else if (c.taskType === 'class') teachMins += c.duration;
                else otherMins += c.duration;
            }
        });
        document.getElementById('teachHoursBadge').innerHTML = `📖 ${(teachMins / 60).toFixed(1)}h Teaching`; document.getElementById('adminHoursBadge').innerHTML = `📁 ${(adminMins / 60).toFixed(1)}h Admin`; document.getElementById('consultHoursBadge').innerHTML = `🗣️ ${(consultMins / 60).toFixed(1)}h Consult`; document.getElementById('totalHoursBadge').innerHTML = `⏱️ ${((teachMins + adminMins + consultMins + otherMins) / 60).toFixed(1)}h Total`;
        analyticsPanel.style.display = 'flex';
    } else { analyticsPanel.style.display = 'none'; }
    if (!onlyAnalytics && filterVal && filterVal !== "(No data)") {
        if (mode === 'teacher') document.getElementById('teacher').value = filterVal;
        else if (mode === 'section') document.getElementById('section').value = filterVal;
        else if (mode === 'room') {
            if (!['class','homeroom','studentOrg','commonTime'].includes(document.getElementById('taskType').value)) { document.getElementById('taskType').value = 'class'; handleTaskTypeChange(); }
            document.getElementById('preferredRoom').value = filterVal; toggleExcludeRooms();
        }
    }
};

function updateFilterOptions(autoSelectVal = null, triggerSync = false) {
    const mode = document.getElementById('viewMode').value; const filterSelect = document.getElementById('filterValue'); const currentValue = filterSelect.value;
    if (mode === 'all') { filterSelect.style.display = 'none'; renderClasses(); return; }
    filterSelect.style.display = 'block'; filterSelect.innerHTML = '';
    
    let optionsSet = new Set();
    State.scheduledClasses.forEach(c => {
        if(c.isLunch) { if (mode === 'teacher' && c.targetType === 'teacher') optionsSet.add(c.targetName); if (mode === 'section' && c.targetType === 'section') optionsSet.add(c.targetName); } 
        else { if (mode === 'teacher' && c.teacher !== 'ALL TEACHERS') optionsSet.add(c.teacher); if (mode === 'section' && c.section !== 'N/A') optionsSet.add(c.section); if (mode === 'room') optionsSet.add(c.room); }
    });
    if (mode === 'room') State.roomsPool.forEach(r => optionsSet.add(r)); if (mode === 'teacher') State.teachersPool.forEach(t => optionsSet.add(t)); if (mode === 'section') State.sectionsPool.forEach(s => optionsSet.add(s));
    
    if (optionsSet.size === 0) { filterSelect.innerHTML = '<option value="">(No data)</option>'; } 
    else {
        Array.from(optionsSet).sort().forEach(opt => {
            let optionEl = document.createElement('option'); optionEl.value = opt; optionEl.innerText = opt;
            if ((autoSelectVal && typeof autoSelectVal === 'string' && opt === autoSelectVal) || (autoSelectVal === true && opt === currentValue)) optionEl.selected = true;
            filterSelect.appendChild(optionEl);
        });
    }
    renderClasses(); if (triggerSync) handleFilterValueChange(true);
}

// ==========================================
// 10. MODALS (View, Edit, Setup)
// ==========================================
window.openViewModal = function(id) {
    AppUI.clearAllErrors(); State.currentViewingId = id; const target = State.scheduledClasses.find(c => c.id === id); if (!target) return;
    document.getElementById('viewModalOverlay').style.display = 'flex';
    let icon = '📚'; let title = ''; let subtitle = `${target.day} • ${minutesToTimeStr(target.start)} - ${minutesToTimeStr(target.start + target.duration)}`;
    let body = ''; let safeTarget = escapeHTML(target.targetName); let safeTeacher = escapeHTML(target.teacher); let safeSubject = escapeHTML(target.subject); let safeSection = escapeHTML(target.section); let safeRoom = escapeHTML(target.room);

    if (target.isLunch) { icon = '☕'; title = 'Break / Lunch'; body = `<strong>Target:</strong> ${safeTarget} (${target.targetType})<br>`; } 
    else {
        if (target.taskType === 'admin') icon = '📁'; else if (target.taskType === 'consult') icon = '🗣️'; else if (target.taskType === 'homeroom') icon = '🏠'; else if (target.taskType === 'studentOrg') icon = '♣️'; else if (target.taskType === 'commonTime') icon = '👥';
        title = safeSubject; body += `<div style="margin-bottom: 4px;"><strong>Teacher:</strong> ${safeTeacher}</div>`;
        if(['class', 'homeroom', 'studentOrg'].includes(target.taskType)) body += `<div style="margin-bottom: 4px;"><strong>Section:</strong> ${safeSection}</div>`;
        body += `<div style="margin-bottom: 4px;"><strong>Room:</strong> ${safeRoom}</div>`;
        if(target.description) body += `<div class="desc-box">💬 ${escapeHTML(target.description)}</div>`;
    }
    body += `<div class="duration-box">⏳ Duration: ${(target.duration / 60).toFixed(1)} hrs (${target.duration} mins)</div>`;
    document.getElementById('viewIcon').innerText = icon; document.getElementById('viewTitle').innerText = title; document.getElementById('viewSubtitle').innerText = subtitle; document.getElementById('viewBody').innerHTML = body;
};

window.closeViewModal = function() { document.getElementById('viewModalOverlay').style.display = 'none'; State.currentViewingId = null; };
window.proceedToEdit = function() { if(State.currentViewingId !== null) { let id = State.currentViewingId; closeViewModal(); openEditModal(id); } };

window.openEditModal = function(id) {
    AppUI.clearAllErrors(); State.currentEditingId = id; const target = State.scheduledClasses.find(c => c.id === id); if (!target) return;
    State.originalEditTeacher = target.teacher; State.originalEditSection = target.section;

    if (target.isLunch) {
        document.getElementById('modalTitle').innerText = "Modify Break"; document.getElementById('regularClassFields').style.display = 'none';
        document.getElementById('editLunchGroup').style.display = 'flex'; document.getElementById('editLunchLabel').innerText = target.targetType === 'teacher' ? 'Teacher Name' : 'Section Name';
        let lunchTargetSel = document.getElementById('editLunchTarget'); lunchTargetSel.innerHTML = '';
        let pool = target.targetType === 'teacher' ? State.teachersPool : State.sectionsPool; pool.sort().forEach(item => { lunchTargetSel.innerHTML += `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`; });
        lunchTargetSel.value = target.targetName;
    } else {
        document.getElementById('modalTitle').innerText = "Modify Task"; document.getElementById('regularClassFields').style.display = 'block'; document.getElementById('editLunchGroup').style.display = 'none';
        document.getElementById('editTaskType').value = target.taskType || 'class';
        let eTSel = document.getElementById('editTeacher'); eTSel.innerHTML = ''; State.teachersPool.sort().forEach(t => eTSel.innerHTML += `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`);
        if (target.teacher !== 'N/A' && target.teacher !== 'ALL TEACHERS' && !State.teachersPool.includes(target.teacher)) eTSel.innerHTML += `<option value="${escapeHTML(target.teacher)}">${escapeHTML(target.teacher)} (Unlisted)</option>`;
        eTSel.value = target.teacher;
        let eSSel = document.getElementById('editSection'); eSSel.innerHTML = ''; State.sectionsPool.sort().forEach(s => eSSel.innerHTML += `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`);
        if (target.section !== 'N/A' && !State.sectionsPool.includes(target.section)) eSSel.innerHTML += `<option value="${escapeHTML(target.section)}">${escapeHTML(target.section)} (Unlisted)</option>`;
        eSSel.value = target.section;

        document.getElementById('editSubject').value = target.subject; document.getElementById('editDescription').value = target.description || '';
        handleEditTaskTypeChange();
        if (target.taskType === 'commonTime') { setDropdownToFixedValue('editTeacher', 'ALL TEACHERS'); setDropdownToFixedValue('editSection', 'N/A'); }
        
        filterAvailableRoomsInEdit();
        let editRoomEl = document.getElementById('editRoom');
        if (!Array.from(editRoomEl.options).some(opt => opt.value === target.room)) editRoomEl.innerHTML += `<option value="${target.room}">${target.room} (Unlisted)</option>`;
        editRoomEl.value = target.room;
    }
    document.getElementById('editDay').value = target.day; document.getElementById('editStart').value = target.start; document.getElementById('editDuration').value = target.duration; document.getElementById('editModalOverlay').style.display = 'flex';
};

window.closeEditModal = function() { document.getElementById('editModalOverlay').style.display = 'none'; State.currentEditingId = null; };

window.handleEditTaskTypeChange = function() {
    let type = document.getElementById('editTaskType').value; let subInput = document.getElementById('editSubject');
    subInput.disabled = false; document.getElementById('editSection').disabled = false; document.getElementById('editRoom').disabled = false; document.getElementById('editTeacher').disabled = false;
    renderTeachersUi();
    let editSectionSel = document.getElementById('editSection'); editSectionSel.innerHTML = ''; State.sectionsPool.sort().forEach(s => editSectionSel.innerHTML += `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`);

    if(type === 'admin') { subInput.value = 'Administrative Task'; subInput.disabled = true; setDropdownToFixedValue('editSection', 'N/A'); setDropdownToFixedValue('editRoom', 'Faculty'); } 
    else if(type === 'consult') { subInput.value = 'Consultation Time'; subInput.disabled = true; setDropdownToFixedValue('editSection', 'N/A'); setDropdownToFixedValue('editRoom', 'Consultation Room'); } 
    else if(type === 'homeroom') { subInput.value = 'Homeroom'; subInput.disabled = true; if (State.originalEditSection && State.originalEditSection !== 'N/A') document.getElementById('editSection').value = State.originalEditSection; if (State.originalEditTeacher && State.originalEditTeacher !== 'ALL TEACHERS') document.getElementById('editTeacher').value = State.originalEditTeacher; } 
    else if(type === 'studentOrg') { subInput.value = 'Student Org in Club'; subInput.disabled = true; if (State.originalEditSection && State.originalEditSection !== 'N/A') document.getElementById('editSection').value = State.originalEditSection; if (State.originalEditTeacher && State.originalEditTeacher !== 'ALL TEACHERS') document.getElementById('editTeacher').value = State.originalEditTeacher; } 
    else if(type === 'commonTime') { subInput.value = 'Common Time / Meeting'; setDropdownToFixedValue('editTeacher', 'ALL TEACHERS'); setDropdownToFixedValue('editSection', 'N/A'); setDropdownToFixedValue('editRoom', 'Faculty'); } 
    else { if (State.originalEditSection && State.originalEditSection !== 'N/A') document.getElementById('editSection').value = State.originalEditSection; if (State.originalEditTeacher && State.originalEditTeacher !== 'ALL TEACHERS') document.getElementById('editTeacher').value = State.originalEditTeacher; }
    filterAvailableRoomsInEdit();
};

window.filterAvailableRoomsInEdit = function() {
    const editRoomSel = document.getElementById('editRoom'); if (!editRoomSel) return;
    let currentSelectedRoom = editRoomSel.value; const selectedDay = document.getElementById('editDay').value; const selectedStart = parseInt(document.getElementById('editStart').value); const selectedDuration = parseInt(document.getElementById('editDuration').value); const selectedEnd = selectedStart + selectedDuration;
    editRoomSel.innerHTML = '';
    
    let taskType = document.getElementById('editTaskType').value;
    if(taskType === 'admin') { setDropdownToFixedValue('editRoom', 'Faculty'); return; } else if(taskType === 'consult') { setDropdownToFixedValue('editRoom', 'Consultation Room'); return; } else if(taskType === 'commonTime') { setDropdownToFixedValue('editRoom', 'Faculty'); return; } else { editRoomSel.disabled = false; }
    const originalClass = State.scheduledClasses.find(c => c.id === State.currentEditingId);

    State.roomsPool.sort().forEach(r => {
        if (isSharedRoom(r)) { editRoomSel.innerHTML += `<option value="${r}">${r}</option>`; return; }
        const isOccupied = State.scheduledClasses.some(c => {
            if (c.id === State.currentEditingId) return false;
            if (c.day === selectedDay && !c.isLunch && c.room === r) { const cEnd = c.start + c.duration; return (selectedStart < cEnd) && (selectedEnd > c.start); }
            return false;
        });
        if (!isOccupied) editRoomSel.innerHTML += `<option value="${r}">${r}</option>`;
    });
    if (Array.from(editRoomSel.options).some(opt => opt.value === currentSelectedRoom)) editRoomSel.value = currentSelectedRoom; else if (originalClass && originalClass.room && Array.from(editRoomSel.options).some(opt => opt.value === originalClass.room)) editRoomSel.value = originalClass.room;
};

window.saveEditClass = async function() {
    if (State.currentEditingId === null) return; const modalError = document.getElementById('modalErrorBanner'); modalError.style.display = 'none';
    let original = State.scheduledClasses.find(c => c.id === State.currentEditingId);
    let day = document.getElementById('editDay').value; let start = parseInt(document.getElementById('editStart').value); let duration = parseFloat(document.getElementById('editDuration').value);
    let proposedUpdate;

    if (original.isLunch) {
        let targetName = document.getElementById('editLunchTarget').value.trim();
        if(!targetName) { modalError.innerText = "Target name required."; modalError.style.display = 'block'; return; }
        proposedUpdate = { ...original, targetName, day, start, duration };
    } else {
        let taskType = document.getElementById('editTaskType').value; let teacher = document.getElementById('editTeacher') ? document.getElementById('editTeacher').value : '';
        let subject = document.getElementById('editSubject').value.trim(); let section = document.getElementById('editSection') ? document.getElementById('editSection').value : '';
        let description = document.getElementById('editDescription').value.trim(); let room = document.getElementById('editRoom').value;
        if (taskType === 'commonTime') { teacher = 'ALL TEACHERS'; section = 'N/A'; }
        if (!teacher || !subject || !section) { modalError.innerText = "Please complete all fields."; modalError.style.display = 'block'; return; }
        proposedUpdate = { ...original, taskType, teacher, subject, section, description, room, day, start, duration };
    }
    if (checkHardConflict(proposedUpdate, State.scheduledClasses, State.currentEditingId)) { modalError.innerText = "Time/Room Conflict detected."; modalError.style.display = 'block'; return; }
    if (!proposedUpdate.isLunch && checkFatigue(proposedUpdate, State.scheduledClasses, State.currentEditingId)) { if(!(await AppUI.showConfirm("Warning: Exceeds 4.5 continuous hours. Save anyway?"))) return; }

    let index = State.scheduledClasses.findIndex(c => c.id === State.currentEditingId);
    if (index !== -1) State.scheduledClasses[index] = proposedUpdate;
    if (!proposedUpdate.isLunch && !State.subjectsPool.includes(proposedUpdate.subject) && ['class', 'homeroom', 'studentOrg', 'commonTime'].includes(proposedUpdate.taskType)) { State.subjectsPool.push(proposedUpdate.subject); renderSubjectsUi(); }
    closeEditModal(); updateFilterOptions(true, false); triggerUpdate(); AppUI.showToast("Changes saved successfully.", "success");
};

window.deleteClassFromModal = async function() {
    if (State.currentEditingId === null) return;
    if (await AppUI.showConfirm("Permanently remove this record?")) { State.scheduledClasses = State.scheduledClasses.filter(c => c.id !== State.currentEditingId); closeEditModal(); updateFilterOptions(true, false); triggerUpdate(); AppUI.showToast("Record deleted.", "success"); }
};

// ==========================================
// 11. IMPORT / EXPORT / PRINT
// ==========================================
window.addEventListener('beforeprint', () => {
    const mode = document.getElementById('viewMode').value; const filterVal = document.getElementById('filterValue').value;
    let headerText = "All Timetables Overview";
    if (mode !== 'all' && filterVal) headerText = `${mode.charAt(0).toUpperCase() + mode.slice(1)}: ${filterVal}`;
    document.getElementById('printHeader').innerText = headerText; document.getElementById('printFooter').innerText = `Printed on: ${new Date().toLocaleString()} | Scheduler Pro ${Config.VERSION}`;
});

window.exportBackup = function() {
    const data = { roomsPool: State.roomsPool, teachersPool: State.teachersPool, subjectsPool: State.subjectsPool, sectionsPool: State.sectionsPool, excludedRooms: State.excludedRooms, scheduledClasses: State.scheduledClasses, classIdCounter: State.classIdCounter, colorIndex: State.colorIndex, currentBackupName: State.currentBackupName, prefs: { font: document.getElementById('prefFont').value, size: document.getElementById('prefSize').value, align: document.getElementById('prefAlign').value, titleBold: document.getElementById('prefTitleBold').checked, titleItalic: document.getElementById('prefTitleItalic').checked, detBold: document.getElementById('prefDetailsBold').checked, detItalic: document.getElementById('prefDetailsItalic').checked, maxTeacherHours: State.maxTeacherHours } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    saveAs(blob, `Scheduler_Backup_${new Date().getTime()}.json`);
    AppUI.showToast("Backup saved.", "success");
};

window.triggerImport = function() { document.getElementById('importBackupFile').click(); };

window.importBackup = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            State.roomsPool = data.roomsPool || []; State.teachersPool = data.teachersPool || []; State.subjectsPool = data.subjectsPool || []; State.sectionsPool = data.sectionsPool || []; State.excludedRooms = data.excludedRooms || []; State.scheduledClasses = data.scheduledClasses || []; State.classIdCounter = data.classIdCounter || 0; State.colorIndex = data.colorIndex || 0;
            State.currentBackupName = file.name.replace('.json', ''); document.getElementById('backupNameText').innerText = State.currentBackupName;
            
            if (data.prefs) {
                document.getElementById('prefFont').value = data.prefs.font || "'Inter', 'Segoe UI', Tahoma, Geneva, sans-serif"; document.getElementById('prefSize').value = data.prefs.size || "12"; document.getElementById('fontSizeLabel').innerText = (data.prefs.size || "12") + 'px'; document.getElementById('prefAlign').value = data.prefs.align || "left";
                if(data.prefs.titleBold !== undefined) document.getElementById('prefTitleBold').checked = data.prefs.titleBold; if(data.prefs.titleItalic !== undefined) document.getElementById('prefTitleItalic').checked = data.prefs.titleItalic; if(data.prefs.detBold !== undefined) document.getElementById('prefDetailsBold').checked = data.prefs.detBold; if(data.prefs.detItalic !== undefined) document.getElementById('prefDetailsItalic').checked = data.prefs.detItalic;
                if(data.prefs.maxTeacherHours !== undefined) { State.maxTeacherHours = data.prefs.maxTeacherHours; document.getElementById('targetTeachHours').value = State.maxTeacherHours; }
            }
            triggerUpdate(); AppUI.showToast("Backup loaded successfully!", "success");
        } catch (err) { AppUI.showToast("Invalid backup file format.", "error"); }
        event.target.value = ''; 
    };
    reader.readAsText(file);
};

window.exportToCSV = function() {
    let csv = "ID,Type,Day,Start Time,Duration (Mins),Teacher,Subject,Section,Room,Description\n";
    State.scheduledClasses.sort((a,b) => a.start - b.start).forEach(c => {
        let startStr = minutesToTimeStr(c.start);
        if (c.isLunch) { csv += `${c.id},Break,${c.day},${startStr},${c.duration},${c.targetType === 'teacher' ? c.targetName : ''},BREAK,${c.targetType === 'section' ? c.targetName : ''},,\n`; } 
        else { csv += `${c.id},${c.taskType},${c.day},${startStr},${c.duration},"${c.teacher}","${c.subject}","${c.section}","${c.room}","${c.description || ''}"\n`; }
    });
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), "Timetable_Raw.csv");
    AppUI.showToast("CSV Exported", "success");
};

window.exportStyledExcel = function() {
    if (typeof ExcelJS === 'undefined') { AppUI.showToast("Required ExcelJS library unavailable.", "error"); return; }
    let wb = new ExcelJS.Workbook(); let ws = wb.addWorksheet("Timetable");
    ws.columns = [ { header: 'Day', key: 'day', width: 15 }, { header: 'Time', key: 'time', width: 20 }, { header: 'Type', key: 'type', width: 15 }, { header: 'Teacher / Target', key: 'teacher', width: 25 }, { header: 'Subject', key: 'subject', width: 25 }, { header: 'Section', key: 'section', width: 20 }, { header: 'Room', key: 'room', width: 20 }, { header: 'Description Notes', key: 'notes', width: 30 } ];
    ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; ws.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    State.scheduledClasses.sort((a,b) => { let dayOrder = { 'Monday':1, 'Tuesday':2, 'Wednesday':3, 'Thursday':4, 'Friday':5 }; if (dayOrder[a.day] !== dayOrder[b.day]) return dayOrder[a.day] - dayOrder[b.day]; return a.start - b.start; }).forEach(c => {
        if (c.isLunch) { ws.addRow({ day: c.day, time: minutesToTimeStr(c.start), type: 'Break / Lunch', teacher: c.targetName, subject: '☕ BREAK', section: 'N/A', room: 'N/A', notes: '' }); } 
        else { ws.addRow({ day: c.day, time: minutesToTimeStr(c.start), type: c.taskType, teacher: c.teacher, subject: c.subject, section: c.section, room: c.room, notes: c.description || '' }); }
    });
    wb.xlsx.writeBuffer().then(buffer => { saveAs(new Blob([buffer], { type: "application/octet-stream" }), "Timetable_Excel_Export.xlsx"); AppUI.showToast("Excel File Exported", "success"); });
};

// ==========================================
// 12. INITIALIZATION
// ==========================================
async function initData() {
    let breakStartSelect = document.getElementById('breakStart'); let editStartSelect = document.getElementById('editStart');
    timeSlots.forEach(slot => {
        let timeStr = minutesToTimeStr(slot);
        breakStartSelect.innerHTML += `<option value="${slot}" ${slot === 720 ? 'selected' : ''}>${timeStr}</option>`;
        editStartSelect.innerHTML += `<option value="${slot}">${timeStr}</option>`;
    });
    
    // Await local storage fetch BEFORE building the interface
    await loadFromLocal(); 
    checkActivation();
    buildCalendarGrid(); renderRoomsUi(); renderTeachersUi(); renderSubjectsUi(); renderSectionsUi();
    handleTaskTypeChange(); updateFilterOptions(null, false);
}

// Start App
document.addEventListener('DOMContentLoaded', initData);

window.exportStyledExcel = function() {
    if (typeof ExcelJS === 'undefined') { AppUI.showToast("Required ExcelJS library unavailable.", "error"); return; }
    let wb = new ExcelJS.Workbook(); let ws = wb.addWorksheet("Timetable");
    ws.columns = [ { header: 'Day', key: 'day', width: 15 }, { header: 'Time', key: 'time', width: 20 }, { header: 'Type', key: 'type', width: 15 }, { header: 'Teacher / Target', key: 'teacher', width: 25 }, { header: 'Subject', key: 'subject', width: 25 }, { header: 'Section', key: 'section', width: 20 }, { header: 'Room', key: 'room', width: 20 }, { header: 'Description Notes', key: 'notes', width: 30 } ];
    ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; ws.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    State.scheduledClasses.sort((a,b) => { let dayOrder = { 'Monday':1, 'Tuesday':2, 'Wednesday':3, 'Thursday':4, 'Friday':5 }; if (dayOrder[a.day] !== dayOrder[b.day]) return dayOrder[a.day] - dayOrder[b.day]; return a.start - b.start; }).forEach(c => {
        if (c.isLunch) { ws.addRow({ day: c.day, time: minutesToTimeStr(c.start), type: 'Break / Lunch', teacher: c.targetName, subject: '☕ BREAK', section: 'N/A', room: 'N/A', notes: '' }); } 
        else { ws.addRow({ day: c.day, time: minutesToTimeStr(c.start), type: c.taskType, teacher: c.teacher, subject: c.subject, section: c.section, room: c.room, notes: c.description || '' }); }
    });
    wb.xlsx.writeBuffer().then(buffer => { saveAs(new Blob([buffer], { type: "application/octet-stream" }), "Timetable_Excel_Export.xlsx"); AppUI.showToast("Excel File Exported", "success"); });
};

// ==========================================
// 11.5 AUTOMATED UPDATE SYSTEM
// ==========================================
function isNewerVersion(current, remote) {
    const currentParts = current.split('.').map(Number);
    const remoteParts = remote.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, remoteParts.length); i++) {
        const localNum = currentParts[i] || 0;
        const remoteNum = remoteParts[i] || 0;
        
        if (remoteNum > localNum) return true;
        if (localNum > remoteNum) return false;
    }
    return false;
}

window.manualCheckForUpdates = async function() {
    AppUI.clearAllErrors();
    AppUI.showToast("Checking for updates...", "info");

    try {
        const response = await fetch(`${Config.REMOTE_VERSION_URL}?nocache=${new Date().getTime()}`);
        if (!response.ok) throw new Error("Network response was not stable.");
        
        const updateData = await response.json();
        
        if (updateData && updateData.version && isNewerVersion(Config.CURRENT_VERSION, updateData.version)) {
            document.getElementById('newVersionNumber').innerText = updateData.version;
            
            const changelogContainer = document.getElementById('changelogContent');
            changelogContainer.innerHTML = '';
            
            if (Array.isArray(updateData.changelog)) {
                updateData.changelog.forEach(change => {
                    const li = document.createElement('li');
                    li.textContent = change;
                    changelogContainer.appendChild(li);
                });
            } else {
                changelogContainer.innerHTML = '<li>General improvements and performance stability fixes.</li>';
            }
            
            const downloadBtn = document.getElementById('downloadUpdateBtn');
            downloadBtn.onclick = () => {
                if (updateData.downloadUrl) {
                    window.open(updateData.downloadUrl, '_blank');
                } else {
                    AppUI.showToast("Download URL not found.", "error");
                }
            };
            
            document.getElementById('updateModal').style.display = 'flex';
        } else {
            AppUI.showToast(`Running latest build: ${Config.VERSION}`, "success");
        }
    } catch (error) {
        console.error("Update system error:", error);
        AppUI.showToast("Unable to reach the update server. Check connection.", "error");
    }
};

// ==========================================
// 12. INITIALIZATION
// ==========================================
async function initData() {
    let breakStartSelect = document.getElementById('breakStart'); let editStartSelect = document.getElementById('editStart');
    timeSlots.forEach(slot => {
        let timeStr = minutesToTimeStr(slot);
        breakStartSelect.innerHTML += `<option value="${slot}" ${slot === 720 ? 'selected' : ''}>${timeStr}</option>`;
        editStartSelect.innerHTML += `<option value="${slot}">${timeStr}</option>`;
    });
    
    await loadFromLocal(); 
    checkActivation();
    buildCalendarGrid(); renderRoomsUi(); renderTeachersUi(); renderSubjectsUi(); renderSectionsUi();
    handleTaskTypeChange(); updateFilterOptions(null, false);
}

// Start App
document.addEventListener('DOMContentLoaded', initData);