// Dashboard module for StudyFlow
import { getState, getTodayStats, getWeeklyStudyData, updateTask, saveState } from './state.js';
import { switchTab } from './router.js';

export function renderDashboard() {
  const stats = getTodayStats();
  const state = getState();

  // 1. Render Metrics Cards
  const hours = Math.floor(stats.focusMinutes / 60);
  const mins = stats.focusMinutes % 60;
  
  document.getElementById('stat-focus-time').textContent = `${hours}h ${mins}m`;
  
  // Completed tasks tally
  const completedTasks = state.tasks.filter(t => t.status === 'completed').length;
  document.getElementById('stat-tasks-done').textContent = `${completedTasks} / ${state.tasks.length}`;
  const rate = state.tasks.length > 0 ? Math.round((completedTasks / state.tasks.length) * 100) : 0;
  document.getElementById('stat-tasks-rate').textContent = `${rate}% completed`;
  
  // Streak
  document.getElementById('sidebar-streak-count').textContent = stats.streak;
  document.getElementById('stat-streak').textContent = `${stats.streak} Days`;
  document.getElementById('stat-streak-msg').textContent = stats.streak > 0 
    ? 'Keep the flame burning!' 
    : 'Complete a focus session today!';

  // Focus Score
  document.getElementById('stat-focus-score').textContent = `${stats.focusScore}%`;
  document.getElementById('stat-score-msg').textContent = stats.focusScore > 85
    ? 'Excellent focus quality!'
    : stats.focusScore > 50 ? 'Good concentration today' : 'Keep practicing mindfulness';

  // 2. Render Goal Circle Ring
  const dailyGoalMins = state.settings.dailyGoalMinutes || 120;
  const goalPercentage = Math.min(100, Math.round((stats.focusMinutes / dailyGoalMins) * 100));
  
  document.getElementById('dashboard-goal-percentage').textContent = `${goalPercentage}%`;
  document.getElementById('dashboard-goal-duration').textContent = `${(stats.focusMinutes / 60).toFixed(1)} / ${(dailyGoalMins / 60).toFixed(1)} hours`;
  
  const ring = document.getElementById('dashboard-goal-ring');
  if (ring) {
    // Circumference = 2 * PI * r = 2 * 3.14159 * 42 ≈ 263.89 => Round to 264
    const offset = 264 - (goalPercentage / 100) * 264;
    ring.style.strokeDashoffset = offset;
  }

  // 3. Render SVG Chart
  renderWeeklyChart();

  // 4. Render Today's Tasks (max 3 items)
  renderTasksWidget();

  // 5. Render Recent Notes (max 3 items)
  renderNotesWidget();
}

function renderWeeklyChart() {
  const container = document.getElementById('weekly-svg-chart-container');
  if (!container) return;

  const weeklyData = getWeeklyStudyData();
  const maxHours = Math.max(...weeklyData.map(d => d.hours), 4); // default scale max to 4 hours

  const width = 450;
  const height = 200;
  const paddingBottom = 25;
  const paddingTop = 15;
  const paddingLeft = 30;
  const paddingRight = 10;

  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;

  const barCount = weeklyData.length;
  const barSpacing = graphWidth / barCount;
  const barWidth = 24;

  let gridLines = '';
  // 4 horizontal gridlines
  for (let i = 0; i <= 4; i++) {
    const yVal = paddingTop + (graphHeight / 4) * i;
    const hourVal = (maxHours - (maxHours / 4) * i).toFixed(1);
    gridLines += `
      <line x1="${paddingLeft}" y1="${yVal}" x2="${width - paddingRight}" y2="${yVal}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 4" />
      <text x="${paddingLeft - 8}" y="${yVal + 4}" fill="var(--text-tertiary)" font-size="10" font-family="var(--font-sans)" text-anchor="end">${hourVal}h</text>
    `;
  }

  let barsHTML = '';
  weeklyData.forEach((day, index) => {
    const x = paddingLeft + (barSpacing * index) + (barSpacing / 2) - (barWidth / 2);
    // Scale height linearly
    const barHeight = (day.hours / maxHours) * graphHeight;
    const y = height - paddingBottom - barHeight;

    barsHTML += `
      <g>
        <rect class="bar-chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 2)}" rx="4" fill="url(#chart-grad)" />
        <text class="bar-chart-text" x="${x + barWidth / 2}" y="${height - 6}">${day.label}</text>
        <title>${day.label}: ${day.hours} hours study time</title>
      </g>
    `;
  });

  const svgContent = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-primary)" />
          <stop offset="100%" stop-color="var(--accent-secondary)" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${barsHTML}
    </svg>
  `;

  container.innerHTML = svgContent;
}

function renderTasksWidget() {
  const container = document.getElementById('widget-today-tasks');
  if (!container) return;

  const state = getState();
  // Show active tasks, sort by high priority first, max 3 items
  const activeTasks = state.tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 3);

  if (activeTasks.length === 0) {
    container.innerHTML = `<div class="list-placeholder">No active tasks. Create one to get started!</div>`;
    return;
  }

  let html = '';
  activeTasks.forEach(task => {
    const isChecked = task.status === 'completed' ? 'checked' : '';
    html += `
      <div class="widget-item-task" data-id="${task.id}">
        <div class="task-item-left">
          <div class="task-cb ${isChecked}" data-action="toggle-task">
            ${isChecked ? '<i data-lucide="check"></i>' : ''}
          </div>
          <span class="task-label-text">${task.title}</span>
        </div>
        <span class="task-tag" style="background: rgba(var(--accent-secondary-rgb), 0.1); color: var(--accent-secondary); font-size: 9px; padding: 2px 6px; border-radius: 8px;">
          ${task.subject || 'General'}
        </span>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons({ attrs: { class: 'lucide-icon' } });

  // Bind toggle action
  container.querySelectorAll('[data-action="toggle-task"]').forEach(cb => {
    cb.addEventListener('click', (e) => {
      const card = e.target.closest('.widget-item-task');
      const taskId = card.getAttribute('data-id');
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
        updateTask(taskId, { status: nextStatus });
        renderDashboard(); // re-render
      }
    });
  });
}

function renderNotesWidget() {
  const container = document.getElementById('widget-recent-notes');
  if (!container) return;

  const state = getState();
  // Sort notes by last modified date desc
  const recentNotes = [...state.notes]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);

  if (recentNotes.length === 0) {
    container.innerHTML = `<div class="list-placeholder">No notes found. Write your first page in Notes!</div>`;
    return;
  }

  let html = '';
  recentNotes.forEach(note => {
    const formattedDate = new Date(note.updatedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    html += `
      <div class="widget-item-note" data-page-id="${note.id}">
        <div class="note-item-left">
          <i data-lucide="file-text"></i>
          <span>${note.title}</span>
        </div>
        <span class="note-time-label">Edited ${formattedDate}</span>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons({ attrs: { class: 'lucide-icon' } });

  // Bind click action
  container.querySelectorAll('.widget-item-note').forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page-id');
      
      // We will set target page ID in global namespace or standard exports so notes views know what to load
      window.activePageId = pageId;
      switchTab('notes');
    });
  });
}
