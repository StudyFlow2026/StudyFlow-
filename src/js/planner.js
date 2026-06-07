// Kanban Task Planner Module for StudyFlow
import { getState, addTask, updateTask, deleteTask, getAllSubjects, saveState } from './state.js';

let activeDragTaskId = null;

export function initPlanner() {
  // Bind Add Task Button triggers
  document.querySelectorAll('.add-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStatus = btn.getAttribute('data-status');
      openTaskModal({ status: targetStatus });
    });
  });

  const quickTaskBtn = document.getElementById('quick-task-btn');
  if (quickTaskBtn) {
    quickTaskBtn.addEventListener('click', () => {
      openTaskModal({ status: 'todo' });
    });
  }

  // Bind Close modal handlers
  const closeModalBtns = document.querySelectorAll('.close-modal-btn');
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', closeTaskModal);
  });

  // Modal Spinner Buttons for Pomodoros
  const decBtn = document.getElementById('pomo-dec');
  const incBtn = document.getElementById('pomo-inc');
  const pomoInput = document.getElementById('task-pomos-input');

  if (decBtn && incBtn && pomoInput) {
    decBtn.addEventListener('click', () => {
      let val = parseInt(pomoInput.value) || 1;
      if (val > 1) pomoInput.value = val - 1;
    });
    incBtn.addEventListener('click', () => {
      let val = parseInt(pomoInput.value) || 1;
      if (val < 10) pomoInput.value = val + 1;
    });
  }

  // Modal Form submission
  const taskForm = document.getElementById('task-modal-form');
  if (taskForm) {
    taskForm.addEventListener('submit', handleTaskFormSubmit);
  }

  // Search & Filter Listeners
  const searchInput = document.getElementById('planner-search');
  if (searchInput) {
    searchInput.addEventListener('input', renderPlanner);
  }

  const subjectFilter = document.getElementById('planner-subject-filter');
  if (subjectFilter) {
    subjectFilter.addEventListener('change', renderPlanner);
  }

  // Drag and Drop Board Handlers
  setupDragAndDrop();
}

export function renderPlanner() {
  const state = getState();
  const searchVal = document.getElementById('planner-search')?.value.toLowerCase() || '';
  const filterSub = document.getElementById('planner-subject-filter')?.value || 'all';

  // Update Subjects Dropdown Filter
  populateSubjectDropdown();

  // Clear card zones
  const todoCol = document.getElementById('cards-todo');
  const progressCol = document.getElementById('cards-inprogress');
  const completedCol = document.getElementById('cards-completed');

  if (!todoCol || !progressCol || !completedCol) return;

  todoCol.innerHTML = '';
  progressCol.innerHTML = '';
  completedCol.innerHTML = '';

  let countTodo = 0;
  let countProgress = 0;
  let countCompleted = 0;

  // Render cards
  state.tasks.forEach(task => {
    // 1. Apply Search Filter
    const matchesSearch = task.title.toLowerCase().includes(searchVal) || 
                          (task.subject && task.subject.toLowerCase().includes(searchVal));
    
    // 2. Apply Subject Tag Filter
    const matchesSubject = filterSub === 'all' || task.subject === filterSub;

    if (!matchesSearch || !matchesSubject) return;

    // Create card element
    const cardEl = createTaskCardEl(task);

    // Append to correct container
    if (task.status === 'todo') {
      todoCol.appendChild(cardEl);
      countTodo++;
    } else if (task.status === 'inprogress') {
      progressCol.appendChild(cardEl);
      countProgress++;
    } else if (task.status === 'completed') {
      completedCol.appendChild(cardEl);
      countCompleted++;
    }
  });

  // Update counts
  document.getElementById('count-todo').textContent = countTodo;
  document.getElementById('count-inprogress').textContent = countProgress;
  document.getElementById('count-completed').textContent = countCompleted;

  // Bind Actions on Card Elements
  bindCardEvents();

  // Re-create icons
  lucide.createIcons({ attrs: { class: 'lucide-icon' } });
}

function createTaskCardEl(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.setAttribute('draggable', 'true');
  card.setAttribute('data-id', task.id);

  // Due Date Formatting & Overdue check
  let dueHtml = '';
  if (task.dueDate) {
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = task.dueDate < today && task.status !== 'completed';
    const classVal = isOverdue ? 'card-due-indicator overdue' : 'card-due-indicator';
    
    dueHtml = `
      <div class="${classVal}">
        <i data-lucide="calendar"></i>
        <span>${task.dueDate} ${isOverdue ? '(Overdue)' : ''}</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="card-tags-row">
      <span class="subject-label">${task.subject || 'General'}</span>
      <span class="priority-label ${task.priority}" title="${task.priority} priority"></span>
    </div>
    <h4>${task.title}</h4>
    <div class="card-footer-row">
      <div class="card-pomo-tally">
        <i data-lucide="tomato"></i>
        <span>${task.completedPomos || 0}/${task.estimatedPomos} pomos</span>
      </div>
      ${dueHtml}
      <div class="card-actions-menu">
        <button class="card-action-btn edit-task-btn" title="Edit Task"><i data-lucide="edit-3"></i></button>
        <button class="card-action-btn delete-task-btn" title="Delete Task"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  `;

  return card;
}

function bindCardEvents() {
  // Edit Card Event
  document.querySelectorAll('.edit-task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.task-card');
      const taskId = card.getAttribute('data-id');
      const state = getState();
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        openTaskModal(task);
      }
    });
  });

  // Delete Card Event
  document.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.task-card');
      const taskId = card.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this study task?')) {
        deleteTask(taskId);
        renderPlanner();
      }
    });
  });

  // Drag listeners
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', () => {
      activeDragTaskId = card.getAttribute('data-id');
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      activeDragTaskId = null;
    });
  });
}

function setupDragAndDrop() {
  const columns = document.querySelectorAll('.column-cards');

  columns.forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragenter', (e) => {
      e.preventDefault();
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', () => {
      col.classList.remove('drag-over');
      if (activeDragTaskId) {
        const columnParent = col.closest('.kanban-column');
        const targetStatus = columnParent.getAttribute('data-status');
        
        updateTask(activeDragTaskId, { status: targetStatus });
        renderPlanner();
      }
    });
  });
}

function populateSubjectDropdown() {
  const filterDropdown = document.getElementById('planner-subject-filter');
  if (!filterDropdown) return;

  const currentSelection = filterDropdown.value;
  const subjects = getAllSubjects();

  let html = `<option value="all">All Subjects</option>`;
  subjects.forEach(sub => {
    html += `<option value="${sub}">${sub}</option>`;
  });

  filterDropdown.innerHTML = html;
  filterDropdown.value = currentSelection; // keep selection

  // Also populate HTML5 datalist for task modal
  const datalist = document.getElementById('subjects-list');
  if (datalist) {
    let datalistHtml = '';
    subjects.forEach(sub => {
      datalistHtml += `<option value="${sub}">`;
    });
    datalist.innerHTML = datalistHtml;
  }
}

// Modal Toggle Helpers
export function openTaskModal(task = {}) {
  const modal = document.getElementById('task-modal');
  if (!modal) return;

  // Set titles and fill fields
  const titleEl = document.getElementById('task-modal-title');
  titleEl.textContent = task.id ? 'Edit Study Task' : 'Create Study Task';

  document.getElementById('task-modal-id').value = task.id || '';
  document.getElementById('task-modal-status').value = task.status || 'todo';
  document.getElementById('task-title-input').value = task.title || '';
  document.getElementById('task-subject-input').value = task.subject || '';
  document.getElementById('task-priority-input').value = task.priority || 'medium';
  document.getElementById('task-pomos-input').value = task.estimatedPomos || 2;
  document.getElementById('task-due-input').value = task.dueDate || '';

  modal.style.display = 'flex';
}

export function closeTaskModal() {
  const modal = document.getElementById('task-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function handleTaskFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('task-modal-id').value;
  const status = document.getElementById('task-modal-status').value;
  const title = document.getElementById('task-title-input').value;
  const subject = document.getElementById('task-subject-input').value || 'General';
  const priority = document.getElementById('task-priority-input').value;
  const estimatedPomos = parseInt(document.getElementById('task-pomos-input').value) || 2;
  const dueDate = document.getElementById('task-due-input').value;

  const taskData = { title, subject, priority, status, estimatedPomos, dueDate };

  if (id) {
    // Update existing task
    updateTask(id, taskData);
  } else {
    // Add new task
    addTask(taskData);
  }

  closeTaskModal();
  renderPlanner();
}
