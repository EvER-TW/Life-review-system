/**
 * 週選擇器模組 - 蝦皮風格週選擇下拉元件
 */

let pickerYear, pickerMonth;
let currentSelectedWeekStart = null;

// 初始化週選擇器
function initWeekPicker() {
    const now = new Date();
    pickerYear = now.getFullYear();
    pickerMonth = now.getMonth();
    renderPickerGrid();
    updatePickerMonthDisplay();

    // 點擊外部關閉
    document.addEventListener('click', (e) => {
        const container = document.querySelector('.week-picker-container');
        if (container && !container.contains(e.target)) {
            closeWeekPicker();
        }
    });
}

// 切換週選擇器顯示
function toggleWeekPicker() {
    const dropdown = document.getElementById('week-picker-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderPickerGrid();
            updatePickerMonthDisplay();
        }
    }
}

// 關閉週選擇器
function closeWeekPicker() {
    const dropdown = document.getElementById('week-picker-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

// 更改選擇器月份
function changePickerMonth(delta) {
    pickerMonth += delta;
    if (pickerMonth > 11) {
        pickerMonth = 0;
        pickerYear++;
    } else if (pickerMonth < 0) {
        pickerMonth = 11;
        pickerYear--;
    }
    renderPickerGrid();
    updatePickerMonthDisplay();
}

// 更新月份顯示
function updatePickerMonthDisplay() {
    const display = document.getElementById('picker-month-display');
    if (display) {
        const months = ['一月', '二月', '三月', '四月', '五月', '六月',
            '七月', '八月', '九月', '十月', '十一月', '十二月'];
        display.textContent = `${pickerYear}年 ${months[pickerMonth]}`;
    }
}

// 渲染日曆格子
function renderPickerGrid() {
    const grid = document.getElementById('week-picker-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const firstDay = new Date(pickerYear, pickerMonth, 1);
    const lastDay = new Date(pickerYear, pickerMonth + 1, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 計算需要從上個月開始的天數（週一開始）
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // 轉換為週一=0

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    // 渲染 6 週
    for (let week = 0; week < 6; week++) {
        const weekRow = document.createElement('div');
        weekRow.className = 'week-row';

        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (week * 7));

        // 檢查是否是選中的週
        if (currentSelectedWeekStart &&
            weekStart.getTime() === currentSelectedWeekStart.getTime()) {
            weekRow.classList.add('selected');
        }

        for (let day = 0; day < 7; day++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + (week * 7) + day);

            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.textContent = cellDate.getDate();

            if (cellDate.getMonth() !== pickerMonth) {
                cell.classList.add('other-month');
            }

            if (cellDate.getTime() === today.getTime()) {
                cell.classList.add('today');
            }

            weekRow.appendChild(cell);
        }

        // 點擊整週選擇
        weekRow.addEventListener('click', () => {
            selectWeek(weekStart);
        });

        grid.appendChild(weekRow);
    }
}

// 選擇週次
function selectWeek(weekStart) {
    currentSelectedWeekStart = weekStart;

    // 更新全域狀態並觸發頁面更新
    if (window.setCurrentWeek) {
        window.setCurrentWeek(weekStart);
    }

    closeWeekPicker();
}

// 選擇今天所在的週
function selectToday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    selectWeek(weekStart);
}

// 設定當前選中的週（供外部呼叫更新狀態）
function setSelectedWeek(date) {
    const dayOfWeek = date.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentSelectedWeekStart = new Date(date);
    currentSelectedWeekStart.setDate(date.getDate() + diff);
    currentSelectedWeekStart.setHours(0, 0, 0, 0);

    pickerYear = currentSelectedWeekStart.getFullYear();
    pickerMonth = currentSelectedWeekStart.getMonth();
}

// 暴露到全域
window.toggleWeekPicker = toggleWeekPicker;
window.changePickerMonth = changePickerMonth;
window.selectToday = selectToday;
window.initWeekPicker = initWeekPicker;
window.setSelectedWeek = setSelectedWeek;

export { initWeekPicker, setSelectedWeek };
