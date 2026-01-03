/**
 * 人生覆盤系統 - 主應用邏輯
 */
import { Storage, WeekUtils, DateUtils } from './storage.js';
import { createRadarChart, createBarChart, updateHeatmapCell, calculateHeatmapAverages } from './charts.js';

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
    'life-calculator': { title: '活多久計算機', init: initLifeCalculator },
    'weekly-review': { title: '週復盤表', init: initWeeklyReview },
    'monthly-summary': { title: '月總覆盤表', init: initMonthlySummary }
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMobileMenu();
    navigateTo(state.currentPage);
});

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
        const response = await fetch(`pages/${pageId}.html`);
        container.innerHTML = await response.text();
        if (pages[pageId].init) {
            await pages[pageId].init();
        }
    } catch (e) {
        container.innerHTML = `<div class="card"><p>載入失敗: ${e.message}</p></div>`;
    }
}

// ===== 水庫評量表 - 事件 =====
const EVENT_OPTIONS = ['睡覺', '吃飯', '聚會', '工作', '開會'];

async function initReservoirEvents() {
    const weekKey = WeekUtils.getWeekKey(state.currentWeek);
    const data = await Storage.load(`events_${weekKey}`, generateEmptyEventsData());

    updateWeekDisplay();
    renderEventsTable(data);

    document.getElementById('prev-week')?.addEventListener('click', () => changeWeek(-7));
    document.getElementById('next-week')?.addEventListener('click', () => changeWeek(7));
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
    state.currentWeek.setDate(state.currentWeek.getDate() + days);
    initReservoirEvents();
}

function updateWeekDisplay() {
    const start = WeekUtils.getWeekStart(state.currentWeek);
    const end = WeekUtils.getWeekEnd(state.currentWeek);
    const display = document.getElementById('week-display');
    if (display) display.textContent = `${WeekUtils.formatShort(start)} - ${WeekUtils.formatShort(end)}`;
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

    document.getElementById('prev-week')?.addEventListener('click', () => { changeWeek(-7); });
    document.getElementById('next-week')?.addEventListener('click', () => { changeWeek(7); });
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

    if (birthInput && saved.birthDate) {
        birthInput.value = saved.birthDate;
        calculateLife(saved.birthDate);
    }

    const todayInput = document.getElementById('today-date');
    if (todayInput) todayInput.value = WeekUtils.formatFull(new Date());

    birthInput?.addEventListener('change', async (e) => {
        await Storage.save('life_calculator', { birthDate: e.target.value });
        calculateLife(e.target.value);
    });
}

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
}

// ===== 週復盤表 =====
async function initWeeklyReview() {
    updateMonthDisplay();
    await renderWeeklyReviewTables();

    document.getElementById('prev-month')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month')?.addEventListener('click', () => changeMonth(1));
    document.getElementById('add-task')?.addEventListener('click', addWeeklyTask);
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
                <th>週一</th><th>週二</th><th>週三</th><th>週四</th><th>週五</th><th>週六</th><th>週日</th>
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
        const actual = [task.mon, task.tue, task.wed, task.thu, task.fri, task.sat, task.sun].filter(v => v).length;
        const percent = task.target ? Math.round((actual / task.target) * 100) : 0;
        return `
      <tr>
        <td><select data-week="${weekKey}" data-index="${i}" data-field="category" onchange="saveWeeklyTask(this)">
          <option value="工作" ${task.category === '工作' ? 'selected' : ''}>工作</option>
          <option value="生活" ${task.category === '生活' ? 'selected' : ''}>生活</option>
          <option value="家庭" ${task.category === '家庭' ? 'selected' : ''}>家庭</option>
        </select></td>
        <td><input type="text" value="${task.name || ''}" data-week="${weekKey}" data-index="${i}" data-field="name" onchange="saveWeeklyTask(this)"></td>
        <td><input type="number" min="0" value="${task.target || ''}" data-week="${weekKey}" data-index="${i}" data-field="target" onchange="saveWeeklyTask(this)"></td>
        <td class="text-center">${actual}</td>
        <td class="text-center ${percent >= 100 ? 'text-success' : percent >= 60 ? 'text-warning' : 'text-danger'}">${percent}%</td>
        ${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => `
          <td class="checkbox-wrapper"><input type="checkbox" ${task[day] ? 'checked' : ''} data-week="${weekKey}" data-index="${i}" data-field="${day}" onchange="saveWeeklyTask(this)"></td>
        `).join('')}
        <td class="text-center">${actual}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteWeeklyTask('${weekKey}', ${i})">×</button></td>
      </tr>
    `;
    }).join('');
}

window.addWeeklyTaskToWeek = async function (weekKey) {
    const data = await Storage.load(`weekly_${weekKey}`, { tasks: [] });
    data.tasks.push({ category: '工作', name: '', target: 1 });
    await Storage.save(`weekly_${weekKey}`, data);
    await renderWeeklyReviewTables();
};

window.saveWeeklyTask = async function (el) {
    const { week, index, field } = el.dataset;
    const data = await Storage.load(`weekly_${week}`, { tasks: [] });

    if (el.type === 'checkbox') {
        data.tasks[index][field] = el.checked;
    } else {
        data.tasks[index][field] = el.value;
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

    document.getElementById('prev-month')?.addEventListener('click', () => { changeMonth(-1); });
    document.getElementById('next-month')?.addEventListener('click', () => { changeMonth(1); });
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
