// Analytics Module for StudyFlow
import { getState, getSubjectDistribution, getTodayStats, clearHistory } from './state.js';
import { renderDashboard } from './dashboard.js';

export function initAnalytics() {
  const clearBtn = document.getElementById('clear-history-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all focus session history? This will reset your stats and streaks.')) {
        clearHistory();
        renderAnalytics();
        renderDashboard();
      }
    });
  }
}

export function renderAnalytics() {
  const state = getState();

  // 1. Render Subject breakdown pie/donut chart
  renderSubjectBreakdown();

  // 2. Render 7-day Goal Milestone grids
  renderMilestones();

  // 3. Render Session Log Table
  renderSessionLogsTable();
}

function renderSubjectBreakdown() {
  const container = document.getElementById('analytics-subject-breakdown-chart');
  if (!container) return;

  const distribution = getSubjectDistribution();

  if (distribution.length === 0) {
    container.innerHTML = `<div style="font-size: 13px; color: var(--text-tertiary); text-align: center; padding: 20px;">No session metrics logged. Start a timer!</div>`;
    return;
  }

  // Predefined color palette for chart segments
  const colors = [
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#3b82f6'  // Blue
  ];

  // Draw Donut SVG
  const radius = 35;
  const circ = 2 * Math.PI * radius; // ~219.9
  let currentOffset = 0;
  
  let pathsHTML = '';
  let labelsHTML = '<div class="subject-legend" style="display: flex; flex-direction: column; gap: 8px; flex: 1; margin-left: 20px;">';

  distribution.forEach((item, index) => {
    const color = colors[index % colors.length];
    const segmentLength = (item.percentage / 100) * circ;
    
    // Draw SVG circle segments
    pathsHTML += `
      <circle 
        cx="50" cy="50" r="${radius}" 
        fill="none" 
        stroke="${color}" 
        stroke-width="12" 
        stroke-dasharray="${segmentLength} ${circ}" 
        stroke-dashoffset="${-currentOffset}"
        stroke-linecap="round"
        transform="rotate(-90 50 50)"
        style="transition: stroke-dashoffset 0.8s ease;"
      />
    `;

    currentOffset += segmentLength;

    // Build Legend Row
    labelsHTML += `
      <div class="legend-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; display: inline-block;"></span>
          <span style="font-weight: 500;">${item.subject}</span>
        </div>
        <span style="color: var(--text-secondary); font-family: var(--font-mono);">${item.percentage}% (${(item.minutes / 60).toFixed(1)}h)</span>
      </div>
    `;
  });
  
  labelsHTML += '</div>';

  const svgHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 10px;">
      <div style="width: 140px; height: 140px;">
        <svg viewBox="0 0 100 100" style="width:100%; height:100%;">
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--bg-tertiary)" stroke-width="12" />
          ${pathsHTML}
        </svg>
      </div>
      ${labelsHTML}
    </div>
  `;

  container.innerHTML = svgHTML;
}

function renderMilestones() {
  const container = document.getElementById('analytics-milestones');
  if (!container) return;

  const state = getState();
  const dailyTargetMins = state.settings.dailyGoalMinutes || 120;
  
  // Build last 7 days list
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const logs = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Sum focus sessions on this date
    const mins = state.sessions
      .filter(s => s.date === dateStr && s.type === 'pomodoro')
      .reduce((sum, s) => sum + s.duration, 0);

    logs.push({
      dayName: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : weekdays[d.getDay()],
      minutes: mins,
      percentage: Math.min(100, Math.round((mins / dailyTargetMins) * 100))
    });
  }

  // Render HTML
  let html = '';
  // Reverse to show oldest first (from 6 days ago moving to Today)
  logs.reverse().forEach(log => {
    const isReached = log.minutes >= dailyTargetMins;
    const statusText = isReached ? 'REACHED' : `${log.minutes}m`;
    const statusClass = isReached ? 'reached' : 'failed';

    html += `
      <div class="milestone-row">
        <span class="milestone-day">${log.dayName}</span>
        <div class="milestone-bar-container">
          <div class="milestone-bar-progress" style="width: ${log.percentage}%;"></div>
        </div>
        <span class="milestone-status ${statusClass}">${statusText}</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderSessionLogsTable() {
  const tbody = document.getElementById('history-table-body');
  const placeholder = document.getElementById('history-placeholder');
  if (!tbody || !placeholder) return;

  const state = getState();

  if (state.sessions.length === 0) {
    tbody.innerHTML = '';
    placeholder.style.display = 'block';
    return;
  }

  placeholder.style.display = 'none';

  // Sort logs by timestamp desc
  const sortedSessions = [...state.sessions].sort((a,b) => b.timestamp - a.timestamp);

  let html = '';
  sortedSessions.forEach(session => {
    // Format timestamp
    const dateObj = new Date(session.timestamp);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Quality badge color
    const scoreColor = session.score > 90 
      ? 'var(--priority-low)' 
      : session.score > 75 ? 'var(--priority-medium)' : 'var(--priority-high)';

    html += `
      <tr>
        <td style="font-size: 13px;">${dateStr}, ${timeStr}</td>
        <td style="font-weight: 500;">${session.taskTitle}</td>
        <td style="font-family: var(--font-mono); font-size: 13px;">${session.duration} mins</td>
        <td>
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">
            ${session.type}
          </span>
        </td>
        <td>
          <span style="color: ${scoreColor}; font-weight: 600; font-family: var(--font-mono); font-size: 13px;">
            ${session.score}%
          </span>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}
