// Notes Workspace Module for StudyFlow
import { getState, addNotePage, updateNotePage, deleteNotePage, saveState } from './state.js';
import { switchTab } from './router.js';

let activePageId = null;
let activeBlockId = null;
let selectedSlashIndex = 0;

export function initNotes() {
  // Sidebar "Add Page" button
  const addPageBtn = document.getElementById('add-page-btn');
  if (addPageBtn) {
    addPageBtn.addEventListener('click', () => {
      const page = addNotePage('New Lecture Note', 'General');
      activePageId = page.id;
      renderNotes();
      const layout = document.querySelector('.notes-workspace-layout');
      if (layout) {
        layout.classList.add('show-editor');
      }
    });
  }

  const createFirstBtn = document.getElementById('editor-create-first-page-btn');
  if (createFirstBtn) {
    createFirstBtn.addEventListener('click', () => {
      const page = addNotePage('Biology 101 - Cell Structure', 'Biology');
      activePageId = page.id;
      renderNotes();
      const layout = document.querySelector('.notes-workspace-layout');
      if (layout) {
        layout.classList.add('show-editor');
      }
    });
  }

  // Back button for mobile view
  const backBtn = document.getElementById('notes-back-to-sidebar-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const layout = document.querySelector('.notes-workspace-layout');
      if (layout) {
        layout.classList.remove('show-editor');
      }
    });
  }

  const createFirstBtnEmpty = document.getElementById('editor-create-first-page-btn');
  
  // Page Title rename listener
  const titleInput = document.getElementById('editor-page-title');
  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      if (activePageId) {
        updateNotePage(activePageId, { title: e.target.value });
        // Update title in sidebar in real-time
        const sidebarItem = document.querySelector(`.notes-page-item[data-page-id="${activePageId}"] .page-title-txt`);
        if (sidebarItem) {
          sidebarItem.textContent = e.target.value || 'Untitled Page';
        }
      }
    });
  }

  // Delete page listener
  const deleteBtn = document.getElementById('delete-current-page-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (activePageId && confirm('Delete this entire notes page? This action cannot be undone.')) {
        deleteNotePage(activePageId);
        activePageId = null;
        renderNotes();
      }
    });
  }

  // Bind Slash Commands Menu item clicks
  document.querySelectorAll('.slash-item').forEach(item => {
    item.addEventListener('click', () => {
      const blockType = item.getAttribute('data-block-type');
      executeSlashCommand(blockType);
    });
  });

  // Hide slash menu when clicking outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('slash-menu');
    if (menu && !menu.contains(e.target) && !e.target.classList.contains('editor-block') && !e.target.classList.contains('block-todo-content')) {
      hideSlashMenu();
    }
  });
}

export function renderNotes() {
  const state = getState();
  
  // Set default opening page from dashboard navigation if activePageId was set on window object
  if (window.activePageId) {
    activePageId = window.activePageId;
    window.activePageId = null; // reset
  }

  // 1. Render Sidebar Page List
  renderSidebarPages(state);

  // If no pages exist or activePageId is null, show empty state
  if (state.notes.length === 0) {
    activePageId = null;
  } else if (!activePageId) {
    // Pick the most recent note by default
    const sorted = [...state.notes].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    activePageId = sorted[0].id;
  }

  const layout = document.querySelector('.notes-workspace-layout');
  if (layout && !activePageId) {
    layout.classList.remove('show-editor');
  }

  const emptyState = document.getElementById('editor-empty-state');
  const activeState = document.getElementById('editor-active-state');

  if (!activePageId) {
    emptyState.style.display = 'flex';
    activeState.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  activeState.style.display = 'flex';

  const page = state.notes.find(n => n.id === activePageId);
  if (!page) {
    activePageId = null;
    renderNotes();
    return;
  }

  // Set Page Meta Elements
  const subjectMeta = document.getElementById('editor-page-subject');
  subjectMeta.textContent = page.subject || 'General';
  
  const titleInput = document.getElementById('editor-page-title');
  titleInput.value = page.title;

  // 2. Render Blocks Workspace
  const container = document.getElementById('editor-blocks-container');
  container.innerHTML = '';

  page.blocks.forEach(block => {
    const blockEl = createBlockElement(block, page.id);
    container.appendChild(blockEl);
  });

  lucide.createIcons({ attrs: { class: 'lucide-icon' } });
}

function renderSidebarPages(state) {
  const container = document.getElementById('notes-pages-tree');
  if (!container) return;

  if (state.notes.length === 0) {
    container.innerHTML = `<div style="font-size: 11px; color: var(--text-tertiary); text-align: center; padding: 16px;">No pages yet</div>`;
    return;
  }

  let html = '';
  // Sort by updatedAt desc
  const sortedNotes = [...state.notes].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  sortedNotes.forEach(note => {
    const isActive = note.id === activePageId ? 'active' : '';
    html += `
      <div class="notes-page-item ${isActive}" data-page-id="${note.id}">
        <div class="page-item-label">
          <i data-lucide="file-text"></i>
          <span class="page-title-txt">${note.title || 'Untitled Page'}</span>
        </div>
        <button class="item-delete-btn" data-action="delete-page" title="Delete Page">
          <i data-lucide="x"></i>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
  lucide.createIcons({ attrs: { class: 'lucide-icon' } });

  // Bind sidebar click actions
  container.querySelectorAll('.notes-page-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // If delete button was clicked, don't switch page
      if (e.target.closest('[data-action="delete-page"]')) {
        e.stopPropagation();
        const pageId = item.getAttribute('data-page-id');
        if (confirm('Delete this notes page?')) {
          deleteNotePage(pageId);
          if (activePageId === pageId) activePageId = null;
          renderNotes();
        }
        return;
      }
      
      activePageId = item.getAttribute('data-page-id');
      renderNotes();
      const layout = document.querySelector('.notes-workspace-layout');
      if (layout) {
        layout.classList.add('show-editor');
      }
    });
  });
}

function createBlockElement(block, pageId) {
  // 1. Check if Todo Block Wrapper
  if (block.type === 'todo') {
    const wrapper = document.createElement('div');
    wrapper.className = `block-todo-wrapper editor-block-row`;
    wrapper.setAttribute('data-block-id', block.id);

    const cb = document.createElement('div');
    cb.className = `block-todo-cb ${block.checked ? 'checked' : ''}`;
    
    const content = document.createElement('div');
    content.className = 'block-todo-content';
    content.contentEditable = true;
    content.innerHTML = block.content;
    content.setAttribute('placeholder', 'To-do item');

    wrapper.appendChild(cb);
    wrapper.appendChild(content);

    // Click checkbox
    cb.addEventListener('click', () => {
      cb.classList.toggle('checked');
      block.checked = cb.classList.contains('checked');
      saveActivePage();
      
      // Update check class on content for strike-through styling
      if (block.checked) {
        content.classList.add('checked');
      } else {
        content.classList.remove('checked');
      }
    });

    bindBlockKeyboardEvents(content, block.id, pageId);
    return wrapper;
  }

  // 2. Standard Blocks
  const el = document.createElement('div');
  el.className = `editor-block block-${block.type}`;
  el.contentEditable = true;
  el.setAttribute('data-block-id', block.id);
  el.innerHTML = block.content;

  // Add custom placeholders
  let pl = '';
  if (block.type === 'text') pl = 'Type / for commands...';
  else if (block.type === 'h1') pl = 'Heading 1';
  else if (block.type === 'h2') pl = 'Heading 2';
  else if (block.type === 'h3') pl = 'Heading 3';
  else if (block.type === 'callout') pl = 'Callout info block';
  else if (block.type === 'code') pl = 'Write code here...';

  if (pl) el.setAttribute('placeholder', pl);

  bindBlockKeyboardEvents(el, block.id, pageId);
  return el;
}

function bindBlockKeyboardEvents(el, blockId, pageId) {
  // Input tracking
  el.addEventListener('input', () => {
    const text = el.innerText;
    
    // Save block contents
    const state = getState();
    const page = state.notes.find(n => n.id === pageId);
    if (page) {
      const block = page.blocks.find(b => b.id === blockId);
      if (block) {
        block.content = el.innerHTML; // save innerHTML to preserve markdown/spacing
      }
      saveState();
    }

    // Trigger Slash Command Menu
    if (text.endsWith('/')) {
      activeBlockId = blockId;
      showSlashMenu(el);
    } else {
      hideSlashMenu();
    }
  });

  // Hotkeys & Navigation
  el.addEventListener('keydown', (e) => {
    const state = getState();
    const page = state.notes.find(n => n.id === pageId);
    if (!page) return;

    const blockIndex = page.blocks.findIndex(b => b.id === blockId);
    const slashMenu = document.getElementById('slash-menu');
    const isMenuOpen = slashMenu && slashMenu.style.display === 'block';

    // If Slash Menu is open, route keys to menu list selection
    if (isMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSlashMenu(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSlashMenu(-1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectSlashMenuItem();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideSlashMenu();
        return;
      }
    }

    // Standard Workspace Keys
    // 1. ENTER KEY -> Insert new block
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const newBlock = {
        id: `b-${Date.now()}`,
        type: 'text',
        content: ''
      };
      
      // Insert after current block
      page.blocks.splice(blockIndex + 1, 0, newBlock);
      saveState();
      
      renderNotes();
      
      // Focus the newly created block
      setTimeout(() => {
        const nextBlockEl = document.querySelector(`[data-block-id="${newBlock.id}"]`);
        if (nextBlockEl) {
          const editable = nextBlockEl.classList.contains('block-todo-wrapper')
            ? nextBlockEl.querySelector('.block-todo-content')
            : nextBlockEl;
          editable.focus();
        }
      }, 20);
      return;
    }

    // 2. BACKSPACE -> Delete empty block
    if (e.key === 'Backspace') {
      const textLength = el.innerText.trim().length;
      if (textLength === 0 && page.blocks.length > 1) {
        e.preventDefault();
        
        // Remove block
        page.blocks.splice(blockIndex, 1);
        saveState();
        
        renderNotes();

        // Focus previous block
        setTimeout(() => {
          const prevBlock = page.blocks[Math.max(0, blockIndex - 1)];
          if (prevBlock) {
            const prevBlockEl = document.querySelector(`[data-block-id="${prevBlock.id}"]`);
            if (prevBlockEl) {
              const editable = prevBlockEl.classList.contains('block-todo-wrapper')
                ? prevBlockEl.querySelector('.block-todo-content')
                : prevBlockEl;
              editable.focus();
              
              // Move cursor to end of text
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(editable);
              range.collapse(false); // collapse to end
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        }, 20);
      }
      return;
    }

    // 3. ARROW UP/DOWN Navigation
    if (e.key === 'ArrowUp') {
      const prevBlock = page.blocks[blockIndex - 1];
      if (prevBlock) {
        e.preventDefault();
        const prevBlockEl = document.querySelector(`[data-block-id="${prevBlock.id}"]`);
        const editable = prevBlockEl.classList.contains('block-todo-wrapper')
          ? prevBlockEl.querySelector('.block-todo-content')
          : prevBlockEl;
        editable.focus();
      }
    }
    
    if (e.key === 'ArrowDown') {
      const nextBlock = page.blocks[blockIndex + 1];
      if (nextBlock) {
        e.preventDefault();
        const nextBlockEl = document.querySelector(`[data-block-id="${nextBlock.id}"]`);
        const editable = nextBlockEl.classList.contains('block-todo-wrapper')
          ? nextBlockEl.querySelector('.block-todo-content')
          : nextBlockEl;
        editable.focus();
      }
    }
  });
}

function saveActivePage() {
  const state = getState();
  const page = state.notes.find(n => n.id === activePageId);
  if (page) {
    page.updatedAt = new Date().toISOString();
    saveState();
  }
}

// Slash Command Menu display logic
function showSlashMenu(targetEl) {
  const menu = document.getElementById('slash-menu');
  if (!menu) return;

  const rect = targetEl.getBoundingClientRect();
  const editor = document.querySelector('.notes-editor-container');
  const editorRect = editor.getBoundingClientRect();

  // Position absolute relative to editor window
  const top = rect.bottom - editorRect.top + editor.scrollTop + 6;
  const left = rect.left - editorRect.left;

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.display = 'block';

  // Highlight first item
  selectedSlashIndex = 0;
  updateSlashSelection();
}

function hideSlashMenu() {
  const menu = document.getElementById('slash-menu');
  if (menu) {
    menu.style.display = 'none';
  }
}

function navigateSlashMenu(offset) {
  const items = document.querySelectorAll('.slash-item');
  if (items.length === 0) return;

  selectedSlashIndex += offset;
  if (selectedSlashIndex < 0) selectedSlashIndex = items.length - 1;
  if (selectedSlashIndex >= items.length) selectedSlashIndex = 0;

  updateSlashSelection();
}

function updateSlashSelection() {
  const items = document.querySelectorAll('.slash-item');
  items.forEach((item, index) => {
    if (index === selectedSlashIndex) {
      item.classList.add('focused');
      // Scroll into view if needed
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('focused');
    }
  });
}

function selectSlashMenuItem() {
  const items = document.querySelectorAll('.slash-item');
  const activeItem = items[selectedSlashIndex];
  if (activeItem) {
    const blockType = activeItem.getAttribute('data-block-type');
    executeSlashCommand(blockType);
  }
}

function executeSlashCommand(blockType) {
  if (!activePageId || !activeBlockId) return;

  const state = getState();
  const page = state.notes.find(n => n.id === activePageId);
  if (!page) return;

  const block = page.blocks.find(b => b.id === activeBlockId);
  if (block) {
    // Clear trailing '/' from content
    let content = block.content;
    if (content.endsWith('/')) {
      content = content.slice(0, -1);
    }
    
    block.type = blockType;
    block.content = content;
    
    // For todo list, add check parameter
    if (blockType === 'todo') {
      block.checked = false;
    }

    saveState();
    hideSlashMenu();
    renderNotes();

    // Re-focus formatted block
    setTimeout(() => {
      const blockEl = document.querySelector(`[data-block-id="${activeBlockId}"]`);
      if (blockEl) {
        const editable = blockEl.classList.contains('block-todo-wrapper')
          ? blockEl.querySelector('.block-todo-content')
          : blockEl;
        editable.focus();
      }
      activeBlockId = null;
    }, 30);
  }
}
