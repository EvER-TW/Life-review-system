/**
 * 人生覆盤系統 - 主應用邏輯
 */
import { Storage, WeekUtils, DateUtils } from './storage.js';
import { createRadarChart, createBarChart, updateHeatmapCell, calculateHeatmapAverages } from './charts.js';
import { checkLoginStatus } from './auth.js';
import { initWeekPicker, setSelectedWeek } from './week-picker.js';

// 當前狀態
const state = {
    currentPage: 'reservoir-events',
    currentWeek: new Date(),
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    charts: {}
};

// 頁面配置
const pages = {
    'reservoir-events': { title: '水庫評量表 - 事件', init: initReservoirEvents },
    'productivity-heatmap': { title: '週生產力熱力圖', init: initProductivityHeatmap },
    'reservoir-status': { title: '水庫現況表', init: initReservoirStatus },
    'life-calculator': { title: '人生 100', init: initLifeCalculator },
    'weekly-review': { title: '週復盤表', init: initWeeklyReview },
    'monthly-summary': { title: '月總覆盤表', init: initMonthlySummary },
    'reservoir-rating': { title: '水庫評量表 - 長期', init: initReservoirRating },
    'learning-plan': { title: '學習計畫', init: initLearningPlan },
    'fnga-osm': { title: 'FNGA-OSM 目標規劃', init: initFNGAOSM }
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // 先檢查登入狀態，登入後才初始化應用
    if (checkLoginStatus()) {
        initApp();
    } else {
        // 如果未登入，監聽登入成功事件
        window.addEventListener('userLoggedIn', initApp, { once: true });
    }
});

// 初始化應用
let appInitialized = false;
function initApp() {
    if (appInitialized) return;
    appInitialized = true;

    initNavigation();
    initMobileMenu();
    navigateTo(state.currentPage);
}

// 導航初始化
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page) navigateTo(page);
        });
    });
}

// 手機選單
function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    toggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}

// 頁面導航
function navigateTo(pageId) {
    const page = pages[pageId];
    if (!page) return;

    state.currentPage = pageId;

    // 更新導航狀態
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });

    // 更新頁面標題
    document.getElementById('page-title').textContent = page.title;

    // 載入頁面內容
    loadPageContent(pageId);

    // 關閉手機選單
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('active');
}

// 載入頁面
async function loadPageContent(pageId) {
    const container = document.getElementById('page-content');
    try {
        // Add timestamp to prevent caching
        const response = await fetch(`pages/${pageId}.html?t=${Date.now()}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();

        // Prevent recursive loading (if server returns index.html instead of partial)
        if (html.includes('<!DOCTYPE html>') || html.includes('<html')) {
            throw new Error('Server returned full page instead of fragment. Please restart server.');
        }

        container.innerHTML = html;
        if (pages[pageId].init) {
            await pages[pageId].init();
        }
    } catch (e) {
        console.error('Page load error:', e);
        container.innerHTML = `<div class="card">
            <h3 class="text-danger">載入失敗</h3>
            <p>${e.message}</p>
            <p class="text-muted">請確認伺服器正在執行，且 pages 資料夾中有對應的 .html 檔案。</p>
        </div>`;
    }
}

// ===== 水庫評量表 - 事件 =====
const EVENT_OPTIONS = ['睡覺', '吃飯', '聚會', '工作', '開會'];

async function initReservoirEvents() {
    const weekKey = WeekUtils.getWeekKey(state.currentWeek);
    const data = await Storage.load(`events_${weekKey}`, generateEmptyEventsData());

    updateWeekDisplay();
    renderEventsTable(data);

    // 初始化週選擇器
    initWeekPicker();
    setSelectedWeek(state.currentWeek);
}

function renderEventSelect(day, hour, field, value) {
    const isCustom = value && !EVENT_OPTIONS.includes(value);

    let html = `<select class="form-select event-select ${isCustom ? 'hidden' : ''}" data-day="${day}" data-hour="${hour}" data-field="${field}">
    <option value="">--請選擇--</option>
    ${EVENT_OPTIONS.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('')}
    <option value="custom">➕ 新增項目...</option>
  </select>`;

    html += `<input type="text" class="form-input event-custom-input ${isCustom ? '' : 'hidden'}" 
            data-day="${day}" data-hour="${hour}" data-field="${field}" 
            value="${value}" placeholder="輸入項目...">`;

    return html;
}

function renderScoreSelect(day, hour, field, value) {
    return `<select class="form-select score-select" data-day="${day}" data-hour="${hour}" data-field="${field}">
    <option value="">-</option>
    ${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<option value="${n}" ${parseInt(value) === n ? 'selected' : ''}>${n}</option>`).join('')}
  </select>`;
}

function handleEventSelectChange(e) {
    if (e.target.value === 'custom') {
        e.target.classList.add('hidden');
        const input = e.target.nextElementSibling;
        input.classList.remove('hidden');
        input.focus();
    } else {
        saveEventsData();
    }
}

function handleCustomInputBlur(e) {
    if (!e.target.value) {
        e.target.classList.add('hidden');
        const select = e.target.previousElementSibling;
        select.classList.remove('hidden');
        select.value = '';
        saveEventsData();
    }
}

function generateEmptyEventsData() {
    const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const days = Array(7).fill(null).map(() => {
        const dayObj = {};
        for (let i = 0; i < 24; i++) dayObj[i] = { input: '', inputScore: '', output: '', outputScore: '' };
        return dayObj;
    });
    return { hours, days };
}

function changeWeek(days) {
    // 建立新的 Date 物件，避免 mutation 問題
    const newDate = new Date(state.currentWeek.getTime());
    newDate.setDate(newDate.getDate() + days);
    state.currentWeek = newDate;

    // 根據當前頁面重新初始化
    if (state.currentPage === 'reservoir-events') {
        initReservoirEvents();
    } else if (state.currentPage === 'productivity-heatmap') {
        initProductivityHeatmap();
    }
}

// 設定當前週（供週選擇器呼叫）
function setCurrentWeek(weekStart) {
    state.currentWeek = new Date(weekStart);

    if (state.currentPage === 'reservoir-events') {
        initReservoirEvents();
    } else if (state.currentPage === 'productivity-heatmap') {
        initProductivityHeatmap();
    }
}

// 暴露到全域
window.setCurrentWeek = setCurrentWeek;

function updateWeekDisplay() {
    const start = WeekUtils.getWeekStart(state.currentWeek);
    const end = WeekUtils.getWeekEnd(state.currentWeek);
    const display = document.getElementById('week-display');

    // 格式化：如果跨年顯示完整年份，否則只在開頭顯示年份
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    let displayText;
    if (startYear === endYear) {
        displayText = `${startYear}/${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
    } else {
        displayText = `${startYear}/${start.getMonth() + 1}/${start.getDate()} - ${endYear}/${end.getMonth() + 1}/${end.getDate()}`;
    }

    if (display) display.textContent = displayText;

    // 更新日期選擇器（如果存在）
    const datePicker = document.getElementById('week-date-picker');
    if (datePicker) {
        // 設定為週的第一天
        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, '0');
        const dd = String(start.getDate()).padStart(2, '0');
        datePicker.value = `${yyyy}-${mm}-${dd}`;
    }
}

function renderEventsTable(data) {
    const tbody = document.getElementById('events-tbody');
    if (!tbody) return;

    tbody.innerHTML = data.hours.map((hour, i) => `
    <tr>
      <td class="text-center">${hour}</td>
      ${Array(7).fill(0).map((_, d) => {
        // 修正數據讀取：如果新結構尚未生效，提供兼容或預設值
        const dayData = data.days[d] && data.days[d][i] ? data.days[d][i] :
            (data.days[d] ? data.days[d] : {}); // fallback for old struct if any (though we will fix struct next)

        const inputVal = dayData.input || '';
        const inputScore = dayData.inputScore || '';
        const outputVal = dayData.output || '';
        const outputScore = dayData.outputScore || '';

        return `
        <td>${renderEventSelect(d, i, 'input', inputVal)}</td>
        <td>${renderScoreSelect(d, i, 'inputScore', inputScore)}</td>
        <td>${renderEventSelect(d, i, 'output', outputVal)}</td>
        <td>${renderScoreSelect(d, i, 'outputScore', outputScore)}</td>
        `;
    }).join('')}
    </tr>
  `).join('');

    tbody.querySelectorAll('select.event-select').forEach(select => {
        select.addEventListener('change', handleEventSelectChange);
    });

    tbody.querySelectorAll('input.event-custom-input').forEach(input => {
        input.addEventListener('change', () => saveEventsData());
        input.addEventListener('blur', handleCustomInputBlur);
    });

    tbody.querySelectorAll('select.score-select').forEach(select => {
        select.addEventListener('change', () => saveEventsData());
    });
}

async function saveEventsData() {
    const weekKey = WeekUtils.getWeekKey(state.currentWeek);
    const data = generateEmptyEventsData();

    // Capture values from Selects
    document.querySelectorAll('#events-tbody select').forEach(el => {
        const { day, hour, field } = el.dataset;
        if (day === undefined) return;
        if (el.value !== 'custom' && el.value) {
            data.days[day][hour][field] = el.value;
        }
    });

    // Capture values from Inputs (overwrites Select if visible)
    document.querySelectorAll('#events-tbody input').forEach(el => {
        const { day, hour, field } = el.dataset;
        if (day === undefined) return;
        if (!el.classList.contains('hidden')) {
            data.days[day][hour][field] = el.value;
        }
    });

    await Storage.save(`events_${weekKey}`, data);
}

// ===== 週生產力熱力圖 =====
async function initProductivityHeatmap() {
    const weekKey = WeekUtils.getWeekKey(state.currentWeek);
    const data = await Storage.load(`heatmap_${weekKey}`, generateEmptyHeatmapData());

    updateWeekDisplay();
    renderHeatmapTable(data);
    renderRadarChart(data);

    // 初始化週選擇器
    initWeekPicker();
    setSelectedWeek(state.currentWeek);
}

function generateEmptyHeatmapData() {
    return Array(7).fill(null).map(() => Array(24).fill(0));
}

function renderHeatmapTable(data) {
    const tbody = document.getElementById('heatmap-tbody');
    if (!tbody) return;

    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:01-${String(i + 1).padStart(2, '0')}:00`);
    const averages = calculateHeatmapAverages(data);

    tbody.innerHTML = hours.map((hour, i) => {
        const cells = data.map((day, d) => {
            const val = day[i] || 0;
            return `<td class="heat-cell" data-value="${val}"><input type="number" min="1" max="5" data-day="${d}" data-hour="${i}" value="${val || ''}"></td>`;
        }).join('');
        return `<tr><td>${hour}</td>${cells}<td class="heat-cell" data-value="${averages[i]}">${averages[i] || ''}</td></tr>`;
    }).join('');

    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const { day, hour } = input.dataset;
            data[day][hour] = parseInt(input.value) || 0;
            updateHeatmapCell(input.parentElement, input.value);
            await Storage.save(`heatmap_${WeekUtils.getWeekKey(state.currentWeek)}`, data);
            renderRadarChart(data);
        });
    });
}

function renderRadarChart(data) {
    const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const averages = calculateHeatmapAverages(data);

    if (state.charts.radar) state.charts.radar.destroy();
    state.charts.radar = createRadarChart('radar-chart', labels, averages);
}

// ===== 水庫現況表 =====
async function initReservoirStatus() {
    const data = await Storage.load('reservoir_status', { positive: [], negative: [] });
    renderStatusTable('positive', data.positive);
    renderStatusTable('negative', data.negative);

    document.getElementById('add-positive')?.addEventListener('click', () => addStatusRow('positive'));
    document.getElementById('add-negative')?.addEventListener('click', () => addStatusRow('negative'));
}

function renderStatusTable(type, rows) {
    const tbody = document.getElementById(`${type}-tbody`);
    if (!tbody) return;

    tbody.innerHTML = rows.map((row, i) => `
    <tr>
      <td><input type="text" value="${row.status || ''}" data-field="status"></td>
      <td><input type="text" value="${row.person || ''}" data-field="person"></td>
      <td><input type="text" value="${row.personEffect || ''}" data-field="personEffect"></td>
      <td><input type="text" value="${row.event || ''}" data-field="event"></td>
      <td><input type="text" value="${row.eventEffect || ''}" data-field="eventEffect"></td>
      <td><input type="text" value="${row.time || ''}" data-field="time"></td>
      <td><input type="text" value="${row.timeEffect || ''}" data-field="timeEffect"></td>
      <td><input type="text" value="${row.place || ''}" data-field="place"></td>
      <td><input type="text" value="${row.placeEffect || ''}" data-field="placeEffect"></td>
      <td><input type="text" value="${row.thing || ''}" data-field="thing"></td>
      <td><input type="text" value="${row.thingEffect || ''}" data-field="thingEffect"></td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteStatusRow('${type}', ${i})">×</button></td>
    </tr>
  `).join('');

    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => saveStatusData(type));
    });
}

async function addStatusRow(type) {
    const data = await Storage.load('reservoir_status', { positive: [], negative: [] });
    data[type].push({});
    await Storage.save('reservoir_status', data);
    renderStatusTable(type, data[type]);
}

window.deleteStatusRow = async function (type, index) {
    const data = await Storage.load('reservoir_status', { positive: [], negative: [] });
    data[type].splice(index, 1);
    await Storage.save('reservoir_status', data);
    renderStatusTable(type, data[type]);
};

async function saveStatusData(type) {
    const data = await Storage.load('reservoir_status', { positive: [], negative: [] });
    data[type] = [];

    document.querySelectorAll(`#${type}-tbody tr`).forEach(row => {
        const rowData = {};
        row.querySelectorAll('input').forEach(input => {
            rowData[input.dataset.field] = input.value;
        });
        data[type].push(rowData);
    });

    await Storage.save('reservoir_status', data);
}

// ===== 活多久計算機 =====
async function initLifeCalculator() {
    const saved = await Storage.load('life_calculator', { birthDate: '' });
    const birthInput = document.getElementById('birth-date');

    // Render on init if birth date exists
    if (birthInput && saved.birthDate) {
        birthInput.value = saved.birthDate;
        calculateLife(saved.birthDate);
        renderLife100Grid(saved.birthDate);
    }

    const todayInput = document.getElementById('today-date');
    if (todayInput) todayInput.value = WeekUtils.formatFull(new Date());

    birthInput?.addEventListener('change', async (e) => {
        await Storage.save('life_calculator', { birthDate: e.target.value });
        calculateLife(e.target.value);
        renderLife100Grid(e.target.value);
    });
}

// ... Life calculation helpers same as before ...

// MULTI-SELECT STATE
window.selectedCells = new Set(); // Stores "age-month" strings

async function renderLife100Grid(birthDateStr) {
    const container = document.getElementById('life-100-grid');
    if (!container) return;

    const birthDate = new Date(birthDateStr);
    const birthYear = birthDate.getFullYear();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const lifeData = await Storage.load('life_100_data', {});
    let html = '';

    // Loop 100 down to 0
    for (let age = 100; age >= 0; age--) {
        const year = birthYear + age;

        let monthsHtml = '';
        const yearData = lifeData[age] || {};
        const monthsData = yearData.months || {};

        for (let m = 1; m <= 12; m++) {
            const mData = monthsData[m] || { mood: 'default', event: '' };
            const isCurrent = (year === currentYear && m === currentMonth);

            let moodClass = '';
            if (mData.mood === 'normal') moodClass = 'mood-normal';
            if (mData.mood === 'positive') moodClass = 'mood-positive';
            if (mData.mood === 'negative') moodClass = 'mood-negative';

            const currentClass = isCurrent ? 'is-current' : '';
            // Show event text if exists (truncated)
            const eventText = mData.event ? `<span class="cell-event">${mData.event.substring(0, 8)}${mData.event.length > 8 ? '...' : ''}</span>` : '';

            monthsHtml += `
            <div class="life-month-item ${moodClass} ${currentClass}" 
                 id="month-cell-${age}-${m}"
                 data-age="${age}"
                 data-month="${m}"
                 data-year="${year}">
                <span class="cell-month">${m}月</span>
                ${eventText}
            </div>`;
        }

        html += `
        <div class="life-year-row">
            <div class="life-year-header">
                <span class="life-year-label">${age} 歲</span>
                <span class="life-year-sub">${year}</span>
            </div>
            <div class="life-months-container">
                ${monthsHtml}
            </div>
        </div>`;
    }

    container.innerHTML = html;

    // === EVENT LISTENERS ===
    let isDragging = false;
    let dragStartCell = null;

    // Double-click: Open editor for single cell directly
    container.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('.life-month-item');
        if (cell) {
            const age = parseInt(cell.dataset.age);
            const month = parseInt(cell.dataset.month);
            const year = parseInt(cell.dataset.year);
            // Clear previous selection and select only this one
            clearSelection();
            window.selectedCells.add(`${age}-${month}`);
            cell.classList.add('ui-selected');
            updateSelectionBar();
            openBatchEditor(); // Open editor immediately
        }
    });

    // Mouse down: Start drag or single click
    container.addEventListener('mousedown', (e) => {
        const cell = e.target.closest('.life-month-item');
        if (cell) {
            isDragging = true;
            dragStartCell = cell;
            // If not holding Ctrl/Cmd, clear previous selection
            if (!e.ctrlKey && !e.metaKey) {
                clearSelection();
            }
            toggleSelection(
                parseInt(cell.dataset.age),
                parseInt(cell.dataset.month),
                parseInt(cell.dataset.year)
            );
        }
    });

    // Mouse move: Drag to select multiple
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const cell = e.target.closest('.life-month-item');
        if (cell && !cell.classList.contains('ui-selected')) {
            window.selectedCells.add(`${cell.dataset.age}-${cell.dataset.month}`);
            cell.classList.add('ui-selected');
            updateSelectionBar();
        }
    });

    // Mouse up: End drag
    document.addEventListener('mouseup', () => {
        isDragging = false;
        dragStartCell = null;
    });
}

// SELECTION LOGIC
// SELECTION LOGIC
// SELECTION LOGIC
function toggleSelection(age, month, year) {
    const key = `${age}-${month}`;
    const cell = document.getElementById(`month-cell-${age}-${month}`);

    if (window.selectedCells.has(key)) {
        window.selectedCells.delete(key);
        cell.classList.remove('ui-selected');
    } else {
        window.selectedCells.add(key);
        cell.classList.add('ui-selected');
    }

    updateSelectionBar();
}

window.clearSelection = function () {
    window.selectedCells.forEach(key => {
        const [a, m] = key.split('-');
        document.getElementById(`month-cell-${a}-${m}`)?.classList.remove('ui-selected');
    });
    window.selectedCells.clear();
    updateSelectionBar();
};

function updateSelectionBar() {
    const bar = document.getElementById('selection-bar');
    const countSpan = document.getElementById('selection-count');

    if (window.selectedCells.size > 0) {
        bar.classList.remove('hidden');
        countSpan.textContent = window.selectedCells.size;
    } else {
        bar.classList.add('hidden');
    }
}

// BATCH EDITOR
window.openBatchEditor = function () {
    if (window.selectedCells.size === 0) return;

    const modal = document.getElementById('life-month-modal');
    modal.classList.remove('hidden');

    // Reset form
    document.getElementById('editor-title').textContent = `編輯已被選取的 ${window.selectedCells.size} 個月份`;
    document.getElementById('editor-event').value = ''; // Reset event for batch
    setEditorMood('normal'); // Default Reset
}

// Set mood in editor and update button states
window.setEditorMood = function (mood) {
    document.getElementById('editor-mood').value = mood;
    document.querySelectorAll('.mood-btn').forEach(btn => {
        if (btn.dataset.value === mood) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
};

window.closeMonthEditor = function () {
    document.getElementById('life-month-modal').classList.add('hidden');
};

// BATCH SAVE
window.saveCurrentMonthData = async function () {
    const mood = document.getElementById('editor-mood').value;
    const event = document.getElementById('editor-event').value;

    const lifeData = await Storage.load('life_100_data', {});

    // Iterate all selected cells
    for (let key of window.selectedCells) {
        const [age, month] = key.split('-');

        if (!lifeData[age]) lifeData[age] = {};
        if (!lifeData[age].months) lifeData[age].months = {};

        let currentData = lifeData[age].months[month] || {};

        lifeData[age].months[month] = {
            mood: mood,
            event: event || currentData.event // Only overwrite event if new one provided
        };

        // Update UI
        const cell = document.getElementById(`month-cell-${age}-${month}`);
        if (cell) {
            cell.className = `life-month-item mood-${mood} ${cell.classList.contains('is-current') ? 'is-current' : ''} ui-selected`;
        }
    }

    await Storage.save('life_100_data', lifeData);

    // Feedback
    const btn = document.querySelector('#life-month-modal .btn-primary');
    const originalText = btn.textContent;
    btn.textContent = '已儲存！';
    setTimeout(() => {
        btn.textContent = originalText;
        closeMonthEditor();
        clearSelection(); // Clear selection after save
    }, 500);
};

// ... Life calculation helpers same as before ...



function calculateLife(birthDate) {
    if (!birthDate) return;

    const birth = new Date(birthDate);
    const today = new Date();
    const days = DateUtils.daysBetween(birth, today);
    const weeks = DateUtils.weeksBetween(birth, today);
    const years = DateUtils.calculateAge(birthDate);

    document.getElementById('age-years').textContent = years;
    document.getElementById('age-days').textContent = days.toLocaleString();
    document.getElementById('age-weeks').textContent = weeks;

    // 更新人生進度條（假設平均壽命 100 歲 - Set to 100 for Life 100 concept）
    const ageInYears = (today - birth) / (365.25 * 24 * 60 * 60 * 1000);
    const percent = Math.min(100, (ageInYears / 100 * 100)).toFixed(1);
    const progressBar = document.getElementById('life-progress');
    const percentDisplay = document.getElementById('life-percent');
    if (progressBar) progressBar.style.width = percent + '%';
    if (percentDisplay) percentDisplay.textContent = percent;

    // Update summary text
    document.getElementById('life-expectancy-label').textContent = '假設平均壽命 100 歲';
}



// ===== 週復盤表 =====
async function initWeeklyReview() {
    updateMonthDisplay();
    await renderWeeklyReviewTables();

    // 使用 onclick 避免重複綁定
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    if (prevBtn) prevBtn.onclick = () => changeMonth(-1);
    if (nextBtn) nextBtn.onclick = () => changeMonth(1);
}

function changeMonth(delta) {
    state.currentMonth += delta;
    if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    initWeeklyReview();
}

function updateMonthDisplay() {
    const display = document.getElementById('month-display');
    if (display) display.textContent = `${state.currentYear}年${state.currentMonth + 1}月`;
}

async function renderWeeklyReviewTables() {
    const container = document.getElementById('weekly-tables');
    if (!container) return;

    const weeks = WeekUtils.getMonthWeeks(state.currentYear, state.currentMonth);

    // 平行載入所有週的資料
    const weeksData = await Promise.all(weeks.map(async week => {
        const data = await Storage.load(`weekly_${week.key}`, { tasks: [] });
        return { week, data };
    }));

    container.innerHTML = weeksData.map(({ week, data }) => `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${week.label}</h3>
          <button class="btn btn-primary btn-sm" onclick="addWeeklyTaskToWeek('${week.key}')">+ 新增</button>
        </div>
        <div class="editable-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>類別</th><th>週項目</th><th>目標</th><th>實際</th><th>完成%</th>
                <th>週日</th><th>週一</th><th>週二</th><th>週三</th><th>週四</th><th>週五</th><th>週六</th>
                <th>總投入</th><th>操作</th>
              </tr>
            </thead>
            <tbody id="weekly-${week.key}">
              ${renderWeeklyTaskRows(week.key, data.tasks)}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
}

function renderWeeklyTaskRows(weekKey, tasks) {
    return tasks.map((task, i) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const actual = days.filter(day => task[day]).length;
        const percent = task.target ? Math.round((actual / task.target) * 100) : 0;
        const percentClass = percent >= 100 ? 'text-success' : percent >= 60 ? 'text-warning' : 'text-danger';

        // 生成每天的 checkbox
        const checkboxCells = days.map(day =>
            `<td><div class="checkbox-wrapper"><input type="checkbox" ${task[day] === true ? 'checked' : ''} data-week="${weekKey}" data-index="${i}" data-field="${day}" title="${day}" onchange="saveWeeklyTask(this)"></div></td>`
        ).join('');

        return `<tr>
            <td><select data-week="${weekKey}" data-index="${i}" data-field="category" onchange="saveWeeklyTask(this)">
                <option value="工作" ${task.category === '工作' ? 'selected' : ''}>工作</option>
                <option value="生活" ${task.category === '生活' ? 'selected' : ''}>生活</option>
                <option value="家庭" ${task.category === '家庭' ? 'selected' : ''}>家庭</option>
            </select></td>
            <td><input type="text" value="${task.name || ''}" data-week="${weekKey}" data-index="${i}" data-field="name" onchange="saveWeeklyTask(this)"></td>
            <td><input type="number" min="0" value="${task.target || ''}" data-week="${weekKey}" data-index="${i}" data-field="target" onchange="saveWeeklyTask(this)"></td>
            <td class="text-center">${actual}</td>
            <td class="text-center ${percentClass}">${percent}%</td>
            ${checkboxCells}
            <td class="text-center">${actual}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteWeeklyTask('${weekKey}', ${i})">×</button></td>
        </tr>`;
    }).join('');
}

window.addWeeklyTaskToWeek = async function (weekKey) {
    const data = await Storage.load(`weekly_${weekKey}`, { tasks: [] });
    data.tasks.push({
        category: '工作',
        name: '',
        target: 1,
        mon: false,
        tue: false,
        wed: false,
        thu: false,
        fri: false,
        sat: false,
        sun: false
    });
    await Storage.save(`weekly_${weekKey}`, data);
    await renderWeeklyReviewTables();
};

window.saveWeeklyTask = async function (el) {
    const { week, index, field } = el.dataset;
    console.log(`Saving task: week=${week}, index=${index}, field=${field}`);

    const data = await Storage.load(`weekly_${week}`, { tasks: [] });

    if (el.type === 'checkbox') {
        data.tasks[index][field] = el.checked; // Boolean
        console.log(`Value (Checkbox): ${el.checked}`);
    } else {
        data.tasks[index][field] = el.value;
        console.log(`Value (Input): ${el.value}`);
    }

    await Storage.save(`weekly_${week}`, data);
    await renderWeeklyReviewTables();
};

window.deleteWeeklyTask = async function (weekKey, index) {
    const data = await Storage.load(`weekly_${weekKey}`, { tasks: [] });
    data.tasks.splice(index, 1);
    await Storage.save(`weekly_${weekKey}`, data);
    await renderWeeklyReviewTables();
};

// ===== 月總覆盤表 =====
async function initMonthlySummary() {
    updateMonthDisplay();
    await renderMonthlySummary();

    // 使用 onclick 避免重複綁定
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    if (prevBtn) prevBtn.onclick = () => changeMonth(-1);
    if (nextBtn) nextBtn.onclick = () => changeMonth(1);
}

async function renderMonthlySummary() {
    const container = document.getElementById('summary-content');
    if (!container) return;

    const weeks = WeekUtils.getMonthWeeks(state.currentYear, state.currentMonth);
    const taskStats = {};

    // 平行載入
    await Promise.all(weeks.map(async week => {
        const data = await Storage.load(`weekly_${week.key}`, { tasks: [] });
        data.tasks.forEach(task => {
            if (!task.name) return;
            if (!taskStats[task.name]) {
                taskStats[task.name] = { category: task.category, totalTarget: 0, totalActual: 0 };
            }
            taskStats[task.name].totalTarget += parseInt(task.target) || 0;
            taskStats[task.name].totalActual += [task.mon, task.tue, task.wed, task.thu, task.fri, task.sat, task.sun].filter(v => v).length;
        });
    }));

    const labels = Object.keys(taskStats);
    const percentages = labels.map(name => {
        const stat = taskStats[name];
        return stat.totalTarget ? Math.round((stat.totalActual / stat.totalTarget) * 100) : 0;
    });

    container.innerHTML = `
    <div class="card">
      <h3 class="card-title">月度目標完成率</h3>
      <div class="chart-container"><canvas id="monthly-chart"></canvas></div>
    </div>
    <div class="card">
      <table class="data-table">
        <thead><tr><th>類別</th><th>項目</th><th>目標總次數</th><th>實際總次數</th><th>完成率</th></tr></thead>
        <tbody>
          ${labels.map(name => {
        const stat = taskStats[name];
        const pct = stat.totalTarget ? Math.round((stat.totalActual / stat.totalTarget) * 100) : 0;
        return `
              <tr>
                <td><span class="tag tag-${stat.category === '工作' ? 'work' : stat.category === '生活' ? 'life' : 'family'}">${stat.category}</span></td>
                <td>${name}</td>
                <td class="text-center">${stat.totalTarget}</td>
                <td class="text-center">${stat.totalActual}</td>
                <td class="text-center ${pct >= 100 ? 'text-success' : pct >= 60 ? 'text-warning' : 'text-danger'}">${pct}%</td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>
  `;

    if (labels.length > 0) {
        createBarChart('monthly-chart', labels, percentages);
    }
}

// 匯出功能
window.exportData = Storage.downloadBackup.bind(Storage);

// ===== 水庫評量表 - 長期 =====
const RATING_QUESTIONS = [
    '1個月內能順利輸入能量',
    '1個月內感覺到能量充沛',
    '過去1年能穩定輸入能量',
    '過去1年經常感到能量充沛',
    '能夠保持12小時持續輸出',
    '輸出的能量品質穩定良好',
    '你對他人的貢獻良多',
    '你對他人的貢獻品質良好',
    '他人對你的貢獻很多',
    '他人對你的貢獻品質良好'
];

async function initReservoirRating() {
    const data = await Storage.load('reservoir_rating', {});
    renderRatingTable(data);
}

function renderRatingTable(data) {
    const tbody = document.getElementById('rating-tbody');
    if (!tbody) return;

    tbody.innerHTML = RATING_QUESTIONS.map((q, i) => `
        <tr>
            <td>${q}</td>
            ${[1, 2, 3, 4, 5].map(score => `
                <td>
                    <input type="radio" name="q${i}" value="${score}" 
                           ${data[i] == score ? 'checked' : ''} 
                           onchange="saveRating(${i}, ${score})">
                </td>
            `).join('')}
        </tr>
    `).join('');

    updateRatingSums(data);
}

window.saveRating = async function (questionIndex, score) {
    const data = await Storage.load('reservoir_rating', {});
    data[questionIndex] = score;
    await Storage.save('reservoir_rating', data);
    updateRatingSums(data);
};

function updateRatingSums(data) {
    const sums = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;

    Object.values(data).forEach(score => {
        if (score >= 1 && score <= 5) {
            sums[score]++;
            total += score;
        }
    });

    [1, 2, 3, 4, 5].forEach(s => {
        const el = document.getElementById(`sum-${s}`);
        if (el) el.textContent = sums[s];
    });

    const totalEl = document.getElementById('total-score');
    if (totalEl) totalEl.innerHTML = `<strong>${total}</strong> / ${RATING_QUESTIONS.length * 5}`;
}

// ===== 學習計畫 =====
async function initLearningPlan() {
    const data = await Storage.load('learning_plan', { rows: [] });
    renderLearningTable(data.rows);
}

function renderLearningTable(rows) {
    const tbody = document.getElementById('learning-tbody');
    if (!tbody) return;

    tbody.innerHTML = rows.map((row, i) => `
        <tr>
            <td><select data-index="${i}" data-field="mindset" onchange="saveLearningRow(this)">
                <option value="學會之前不停止" ${row.mindset === '學會之前不停止' ? 'selected' : ''}>學會之前不停止</option>
                <option value="體驗過就好" ${row.mindset === '體驗過就好' ? 'selected' : ''}>體驗過就好</option>
                <option value="考核！" ${row.mindset === '考核！' ? 'selected' : ''}>考核！</option>
            </select></td>
            <td><input type="text" value="${row.why || ''}" data-index="${i}" data-field="why" onchange="saveLearningRow(this)"></td>
            <td><input type="text" value="${row.expected || ''}" data-index="${i}" data-field="expected" onchange="saveLearningRow(this)"></td>
            <td><input type="text" value="${row.how || ''}" data-index="${i}" data-field="how" onchange="saveLearningRow(this)"></td>
            <td><textarea data-index="${i}" data-field="steps" onchange="saveLearningRow(this)">${row.steps || ''}</textarea></td>
            <td><input type="number" min="1" value="${row.times || 1}" data-index="${i}" data-field="times" onchange="saveLearningRow(this)"></td>
            <td><input type="number" min="0" value="${row.hours || 0}" data-index="${i}" data-field="hours" onchange="saveLearningRow(this)"></td>
            <td><input type="text" value="${row.standard || ''}" data-index="${i}" data-field="standard" onchange="saveLearningRow(this)"></td>
            <td><input type="checkbox" ${row.done ? 'checked' : ''} data-index="${i}" data-field="done" onchange="saveLearningRow(this)"></td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteLearningRow(${i})">×</button></td>
        </tr>
    `).join('');
}

window.addLearningRow = async function () {
    const data = await Storage.load('learning_plan', { rows: [] });
    data.rows.push({
        mindset: '學會之前不停止',
        why: '',
        expected: '',
        how: '',
        steps: '',
        times: 1,
        hours: 0,
        standard: '',
        done: false
    });
    await Storage.save('learning_plan', data);
    renderLearningTable(data.rows);
};

window.saveLearningRow = async function (el) {
    const { index, field } = el.dataset;
    const data = await Storage.load('learning_plan', { rows: [] });

    if (el.type === 'checkbox') {
        data.rows[index][field] = el.checked;
    } else if (el.type === 'number') {
        data.rows[index][field] = parseInt(el.value) || 0;
    } else {
        data.rows[index][field] = el.value;
    }

    await Storage.save('learning_plan', data);
};

window.deleteLearningRow = async function (index) {
    const data = await Storage.load('learning_plan', { rows: [] });
    data.rows.splice(index, 1);
    await Storage.save('learning_plan', data);
    renderLearningTable(data.rows);
};

// ===== FNGA-OSM =====
async function initFNGAOSM() {
    const data = await Storage.load('fnga_osm', {});

    // Populate all fields
    const fields = [
        'fn-future-state', 'fn-now-state', 'fn-future-purpose', 'fn-now-purpose',
        'ga-original-action', 'ga-gap-reason', 'ga-new-action',
        'gsm-goal', 'gsm-strategy', 'gsm-metrics'
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && data[id]) {
            el.value = data[id];
        }
    });
}

window.saveFNGA = async function () {
    const fields = [
        'fn-future-state', 'fn-now-state', 'fn-future-purpose', 'fn-now-purpose',
        'ga-original-action', 'ga-gap-reason', 'ga-new-action',
        'gsm-goal', 'gsm-strategy', 'gsm-metrics'
    ];

    const data = {};
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) data[id] = el.value;
    });

    await Storage.save('fnga_osm', data);
};
