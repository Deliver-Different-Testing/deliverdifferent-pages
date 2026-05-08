/* Board Report Annotations — 4-Mode Review System */
const API = 'https://board-report-api-production.up.railway.app';

(function() {
  'use strict';

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const REPORT_SLUG = pathParts.find(p => /\w+-\d{4}/.test(p) || /^fy\d{2}-[a-z0-9-]+$/i.test(p));
  if (!REPORT_SLUG) return;

  let MODE = 'view'; // 'view' | 'review' | 'premeeting' | 'meeting'
  let AUTHOR = localStorage.getItem('board_annotation_author') || '';
  let allComments = [];   // raw from API
  let comments = [];      // filtered for current mode
  let pollTimer = null;
  let activeInput = null;

  // ===== Styles =====
  const style = document.createElement('style');
  style.textContent = `
    .ann-mode-bar { position: fixed; top: 16px; right: 16px; z-index: 100001; display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; transition: right .3s ease; }
    .ann-mode-bar.panel-open { right: 366px; }
    .ann-mode-bar button { border: none; padding: 7px 13px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .2s; box-shadow: 0 2px 8px rgba(0,0,0,.12); white-space: nowrap; }
    .ann-mode-bar button.active { transform: scale(1.05); }
    .ann-mode-bar .m-view { background: #e8e8e8; color: #555; }
    .ann-mode-bar .m-view.active { background: #555; color: #fff; }
    .ann-mode-bar .m-review { background: #fff3e6; color: #c55a00; }
    .ann-mode-bar .m-review.active { background: #fe811a; color: #fff; }
    .ann-mode-bar .m-premeeting { background: #eef6e6; color: #3a7d10; }
    .ann-mode-bar .m-premeeting.active { background: #4caf50; color: #fff; }
    .ann-mode-bar .m-meeting { background: #e6f7fc; color: #1a8ab5; }
    .ann-mode-bar .m-meeting.active { background: #3bc7f4; color: #fff; }
    .ann-mode-bar .ann-user-badge { font-size: 11px; padding: 5px 10px; border-radius: 12px; background: #f0f0f0; color: #666; cursor: pointer; display: flex; align-items: center; gap: 4px; border: 1px solid #ddd; }
    .ann-mode-bar .ann-user-badge:hover { background: #e0e0e0; }

    .ann-panel { position: fixed; top: 0; right: -380px; width: 350px; height: 100vh; background: #fff; border-left: 2px solid #e0e0e0; z-index: 99999; transition: right .3s ease; overflow-y: auto; box-shadow: -4px 0 20px rgba(0,0,0,.1); padding: 56px 16px 16px; font-size: 13px; }
    .ann-panel.open { right: 0; }
    .ann-panel-header { font-weight: 700; font-size: 15px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; }
    .ann-panel-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #888; }
    .ann-panel-mode-label { font-size: 11px; color: #999; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .ann-live-badge { background: #d42b2b; color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 10px; animation: ann-pulse 2s infinite; }
    @keyframes ann-pulse { 0%,100% { opacity: 1; } 50% { opacity: .6; } }

    .ann-comment-card { border-left: 3px solid #ddd; padding: 8px 10px; margin-bottom: 10px; border-radius: 4px; background: #fafafa; cursor: pointer; transition: background .2s; }
    .ann-comment-card:hover { background: #f0f0f0; }
    .ann-comment-card.owner { border-left-color: #fe811a; }
    .ann-comment-card.board { border-left-color: #3bc7f4; }
    .ann-comment-card.resolved { opacity: .5; }
    .ann-comment-card.resolved .ann-comment-text { text-decoration: line-through; }
    .ann-comment-author { font-weight: 700; font-size: 12px; }
    .ann-comment-author.owner { color: #fe811a; }
    .ann-comment-author.board { color: #3bc7f4; }
    .ann-comment-time { font-size: 11px; color: #999; margin-left: 8px; }
    .ann-comment-selected { font-size: 11px; color: #666; font-style: italic; margin: 4px 0; background: #fffde6; padding: 2px 6px; border-radius: 3px; }
    .ann-comment-text { margin-top: 4px; }
    .ann-comment-actions { margin-top: 6px; display: flex; gap: 8px; }
    .ann-comment-actions button { background: none; border: none; font-size: 11px; color: #888; cursor: pointer; padding: 0; }
    .ann-comment-actions button:hover { color: #333; }

    .ann-bubble { position: absolute; right: -36px; width: 24px; height: 24px; border-radius: 50%; background: #3bc7f4; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1000; box-shadow: 0 1px 4px rgba(0,0,0,.2); transition: transform .2s; }
    .ann-bubble:hover { transform: scale(1.2); }
    .ann-bubble.owner { background: #fe811a; }

    [data-ann-hover] { transition: outline .15s; }
    .ann-highlight { outline: 2px solid rgba(59,199,244,.3); outline-offset: 2px; cursor: pointer; }

    .ann-inline-input { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin: 8px 0; box-shadow: 0 2px 8px rgba(0,0,0,.1); z-index: 10000; }
    .ann-inline-input textarea { width: 100%; border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; font-size: 13px; resize: vertical; min-height: 60px; font-family: inherit; }
    .ann-inline-input .ann-input-bar { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
    .ann-inline-input button { padding: 5px 14px; border-radius: 4px; border: none; font-size: 12px; cursor: pointer; font-weight: 600; }
    .ann-inline-input .ann-submit { background: #3bc7f4; color: #fff; }
    .ann-inline-input .ann-cancel { background: #eee; color: #666; }

    @media (max-width: 768px) {
      .ann-panel { width: 100vw; right: -105vw; }
      .ann-panel.open { right: 0; }
      .ann-bubble { right: -28px; width: 20px; height: 20px; font-size: 10px; }
      .ann-mode-bar { top: auto; bottom: 10px; right: 10px; left: 10px; justify-content: center; }
    }
  `;
  document.head.appendChild(style);

  // ===== Owner check =====
  const DRAFT_USERS = ['steveb', 'daneb'];
  function isDraftUser() { return DRAFT_USERS.includes(AUTHOR.toLowerCase().replace(/\s+/g, '')); }

  // ===== Mode Bar =====
  const modeBar = document.createElement('div');
  modeBar.className = 'ann-mode-bar';
  modeBar.innerHTML = `
    <button class="m-view active" data-mode="view">👁 View</button>
    <button class="m-review" data-mode="review" style="display:none">📝 Draft</button>
    <button class="m-premeeting" data-mode="premeeting">📋 Pre-Review</button>
    <button class="m-meeting" data-mode="meeting">💬 Live Meeting</button>
    <span class="ann-user-badge" id="ann-user-badge" title="Click to change name" style="display:none">👤 <span id="ann-user-name"></span></span>
  `;
  document.body.appendChild(modeBar);

  function updateDraftVisibility() {
    const draftBtn = modeBar.querySelector('[data-mode="review"]');
    draftBtn.style.display = isDraftUser() ? '' : 'none';
  }

  // Panel
  const panel = document.createElement('div');
  panel.className = 'ann-panel';
  panel.innerHTML = `
    <div class="ann-panel-header"><span id="ann-panel-title">Comments</span><button class="ann-panel-close">&times;</button></div>
    <div class="ann-panel-mode-label" id="ann-panel-mode-label"></div>
    <div id="ann-panel-body"></div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.ann-panel-close').onclick = () => closePanel();

  // ===== Helpers =====
  function getAnnotatables() { return Array.from(document.querySelectorAll('p, li, td, h2.section-title, h3')); }

  function getElementAnchor(el) {
    let sectionId = null, node = el;
    while (node && node !== document.body) {
      if (node.tagName === 'H2' && node.id) { sectionId = node.id; break; }
      let prev = node.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'H2' && prev.id) { sectionId = prev.id; break; }
        prev = prev.previousElementSibling;
      }
      if (sectionId) break;
      node = node.parentElement;
    }
    return { section_id: sectionId, paragraph_index: getAnnotatables().indexOf(el) };
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function openPanel() { panel.classList.add('open'); modeBar.classList.add('panel-open'); }
  function closePanel() { panel.classList.remove('open'); modeBar.classList.remove('panel-open'); }
  function scrollPanelTo(idx) {
    const card = panel.querySelector(`[data-paragraph-index="${idx}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== Filtering =====
  function filterComments() {
    switch (MODE) {
      case 'review':
        // Steve sees only owner comments
        comments = allComments.filter(c => c.author_role === 'owner');
        break;
      case 'premeeting':
        // Board member sees only their own comments
        comments = allComments.filter(c => c.author === AUTHOR);
        break;
      case 'meeting':
        // Hide resolved comments from Steve and Deane in live meeting
        comments = allComments.filter(c => {
          if (c.status === 'resolved') {
            const name = (c.author || '').toLowerCase().replace(/\s+/g, '');
            if (name === 'steveb' || name === 'steve' || name === 'daneb' || name === 'deane' || name === 'dane') return false;
          }
          return true;
        });
        break;
      case 'view':
      default:
        // All comments visible
        comments = allComments.slice();
        break;
    }
  }

  // ===== API =====
  async function fetchComments() {
    try {
      const r = await fetch(`${API}/api/comments?report_slug=${REPORT_SLUG}`);
      allComments = await r.json();
      filterComments();
    } catch(e) { console.error('Annotation fetch error:', e); }
  }

  async function postComment(data) {
    const r = await fetch(`${API}/api/comments`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ report_slug: REPORT_SLUG, ...data }) });
    return r.json();
  }

  async function updateComment(id, data) {
    const r = await fetch(`${API}/api/comments/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    return r.json();
  }

  async function deleteComment(id) {
    await fetch(`${API}/api/comments/${id}`, { method: 'DELETE' });
  }

  // ===== Rendering =====
  function renderBubbles() {
    document.querySelectorAll('.ann-bubble').forEach(b => b.remove());
    if (MODE === 'view' || comments.length === 0) return;
    const annotatables = getAnnotatables();
    const grouped = {};
    comments.forEach(c => {
      const k = c.paragraph_index ?? -1;
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(c);
    });
    Object.entries(grouped).forEach(([idx, coms]) => {
      const el = annotatables[Number(idx)];
      if (!el) return;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      const bubble = document.createElement('div');
      bubble.className = 'ann-bubble' + (coms.every(c => c.author_role === 'owner') ? ' owner' : '');
      bubble.textContent = coms.length;
      bubble.onclick = (e) => { e.stopPropagation(); openPanel(); scrollPanelTo(Number(idx)); };
      el.appendChild(bubble);
    });
  }

  function renderPanel() {
    const body = document.getElementById('ann-panel-body');
    const title = document.getElementById('ann-panel-title');
    const modeLabel = document.getElementById('ann-panel-mode-label');

    const modeInfo = {
      view:       { title: 'Comments', label: 'View Only — all comments, read-only' },
      review:     { title: '📝 Draft Review', label: "Steve's draft annotations (owner comments only)" },
      premeeting: { title: '📋 Pre-Meeting Review', label: `Showing your comments only (${esc(AUTHOR)})` },
      meeting:    { title: '', label: 'All comments visible — live updates every 5s' },
    };
    const info = modeInfo[MODE];
    if (MODE === 'meeting') {
      title.innerHTML = '<span class="ann-live-badge">🔴 Live</span> Board Meeting';
    } else {
      title.textContent = info.title + ' (' + comments.length + ')';
    }
    modeLabel.textContent = info.label;

    body.innerHTML = '';
    if (comments.length === 0) {
      const emptyMsg = MODE === 'premeeting'
        ? 'No comments from you yet. Click any paragraph to add your review notes.'
        : 'No comments yet';
      body.innerHTML = `<p style="color:#999;text-align:center;margin-top:30px;">${emptyMsg}</p>`;
      return;
    }

    const canEdit = MODE !== 'view';
    comments.forEach(c => {
      const card = document.createElement('div');
      card.className = `ann-comment-card ${c.author_role || 'board'} ${c.status === 'resolved' ? 'resolved' : ''}`;
      card.dataset.paragraphIndex = c.paragraph_index;
      card.dataset.commentId = c.id;
      const time = c.created_at ? new Date(c.created_at + 'Z').toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
      card.innerHTML = `
        <span class="ann-comment-author ${c.author_role || 'board'}">${esc(c.author)}</span><span class="ann-comment-time">${time}</span>
        ${c.selected_text ? `<div class="ann-comment-selected">"${esc(c.selected_text)}"</div>` : ''}
        <div class="ann-comment-text" data-comment-id="${c.id}">${esc(c.comment)}</div>
        ${canEdit ? `<div class="ann-comment-actions">
          <button data-action="edit" data-id="${c.id}">✏️ Edit</button>
          ${c.status !== 'resolved' ? `<button data-action="resolve" data-id="${c.id}">✓ Resolve</button>` : `<button data-action="reopen" data-id="${c.id}">↩ Reopen</button>`}
          <button data-action="delete" data-id="${c.id}">🗑</button>
        </div>` : ''}
      `;
      card.onclick = (e) => {
        if (e.target.dataset.action || e.target.closest('[data-action]')) return;
        const el = getAnnotatables()[c.paragraph_index];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      body.appendChild(card);
    });

    body.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.action === 'edit') {
          startInlineEdit(id, btn.closest('.ann-comment-card'));
          return;
        } else if (btn.dataset.action === 'resolve') {
          await updateComment(id, { status: 'resolved', resolved_at: new Date().toISOString() });
        } else if (btn.dataset.action === 'reopen') {
          await updateComment(id, { status: 'open', resolved_at: null });
        } else if (btn.dataset.action === 'delete') {
          if (confirm('Delete this comment?')) await deleteComment(id);
        }
        await fetchComments();
        render();
      };
    });
  }

  function render() { renderBubbles(); renderPanel(); }

  // ===== Interaction =====
  function setupHover() {
    getAnnotatables().forEach(el => {
      if (el.dataset.annBound) return;
      el.dataset.annBound = '1';
      el.setAttribute('data-ann-hover', '1');
      el.addEventListener('mouseenter', () => { if (MODE !== 'view') el.classList.add('ann-highlight'); });
      el.addEventListener('mouseleave', () => el.classList.remove('ann-highlight'));
      el.addEventListener('click', (e) => {
        if (MODE === 'view') return;
        if (e.target.closest('.ann-inline-input') || e.target.closest('.ann-bubble')) return;
        if (e.target.closest('a')) return;
        e.preventDefault();
        e.stopPropagation();
        const idx = getAnnotatables().indexOf(el);
        const existing = comments.filter(c => c.paragraph_index === idx);
        if (existing.length > 0) {
          openPanel();
          scrollPanelTo(idx);
        } else {
          openCommentInput(el);
        }
      });
    });
  }

  function startInlineEdit(commentId, cardEl) {
    const c = allComments.find(x => String(x.id) === String(commentId));
    if (!c) return;
    const textEl = cardEl.querySelector('.ann-comment-text');
    const actionsEl = cardEl.querySelector('.ann-comment-actions');
    const originalText = c.comment;
    textEl.innerHTML = `<textarea class="ann-edit-textarea" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:6px 8px;font-size:13px;resize:vertical;min-height:60px;font-family:inherit;">${esc(originalText)}</textarea>
      <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:6px;">
        <button class="ann-edit-cancel" style="padding:4px 12px;border-radius:4px;border:none;font-size:12px;cursor:pointer;font-weight:600;background:#eee;color:#666;">Cancel</button>
        <button class="ann-edit-save" style="padding:4px 12px;border-radius:4px;border:none;font-size:12px;cursor:pointer;font-weight:600;background:#3bc7f4;color:#fff;">Save</button>
      </div>`;
    if (actionsEl) actionsEl.style.display = 'none';
    const ta = textEl.querySelector('textarea');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    textEl.querySelector('.ann-edit-cancel').onclick = (e) => {
      e.stopPropagation();
      fetchComments().then(() => render());
    };
    textEl.querySelector('.ann-edit-save').onclick = async (e) => {
      e.stopPropagation();
      const newText = ta.value.trim();
      if (!newText) return;
      await updateComment(commentId, { comment: newText });
      await fetchComments();
      render();
    };
  }

  function openCommentInput(el) {
    if (activeInput) activeInput.remove();
    const sel = window.getSelection();
    const selectedText = sel && sel.toString().trim().length > 0 ? sel.toString().trim().substring(0, 300) : '';
    const anchor = getElementAnchor(el);
    const box = document.createElement('div');
    box.className = 'ann-inline-input';
    box.innerHTML = `
      ${selectedText ? `<div class="ann-comment-selected">"${esc(selectedText)}"</div>` : ''}
      <textarea placeholder="Add a comment…"></textarea>
      <div class="ann-input-bar">
        <button class="ann-cancel">Cancel</button>
        <button class="ann-submit">Comment</button>
      </div>
    `;
    el.after(box);
    activeInput = box;
    const ta = box.querySelector('textarea');
    ta.focus();
    box.querySelector('.ann-cancel').onclick = () => { box.remove(); activeInput = null; };
    box.querySelector('.ann-submit').onclick = async () => {
      const text = ta.value.trim();
      if (!text) return;
      const authorRole = MODE === 'review' ? 'owner' : 'board';
      try {
        const btn = box.querySelector('.ann-submit');
        btn.textContent = 'Saving…';
        btn.disabled = true;
        await postComment({
          section_id: anchor.section_id,
          paragraph_index: anchor.paragraph_index,
          selected_text: selectedText,
          comment: text,
          author: AUTHOR,
          author_role: authorRole
        });
        box.remove();
        activeInput = null;
        await fetchComments();
        render();
        openPanel();
      } catch(e) {
        console.error('Comment save failed:', e);
        alert('Failed to save comment — check console for details.');
      }
    };
    box.onclick = (e) => e.stopPropagation();
  }

  // ===== Author / Mode =====
  function promptAuthor() {
    if (AUTHOR) return true;
    const name = prompt('Enter your name for annotations:');
    if (!name || !name.trim()) return false;
    AUTHOR = name.trim();
    localStorage.setItem('board_annotation_author', AUTHOR);
    return true;
  }

  function updateUserBadge() {
    const badge = document.getElementById('ann-user-badge');
    const nameEl = document.getElementById('ann-user-name');
    if (MODE !== 'view' && AUTHOR) {
      badge.style.display = 'flex';
      nameEl.textContent = AUTHOR;
    } else {
      badge.style.display = 'none';
    }
  }

  document.getElementById('ann-user-badge').onclick = () => {
    const name = prompt('Change your name:', AUTHOR);
    if (name && name.trim()) {
      AUTHOR = name.trim();
      localStorage.setItem('board_annotation_author', AUTHOR);
      filterComments();
      render();
      updateUserBadge();
      updateDraftVisibility();
      // If current mode is review but user is no longer a draft user, switch to view
      if (MODE === 'review' && !isDraftUser()) setMode('view');
    }
  };

  function setMode(mode) {
    if (mode !== 'view' && !promptAuthor()) return;
    MODE = mode;
    modeBar.querySelectorAll('button[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.querySelectorAll('.ann-highlight').forEach(el => el.classList.remove('ann-highlight'));
    if (activeInput) { activeInput.remove(); activeInput = null; }

    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (mode === 'meeting') {
      pollTimer = setInterval(async () => { await fetchComments(); render(); }, 5000);
      openPanel();
    }
    if (mode === 'view') closePanel();
    else openPanel();

    filterComments();
    render();
    updateUserBadge();
    updateDraftVisibility();
  }

  modeBar.querySelectorAll('button[data-mode]').forEach(b => {
    b.onclick = () => setMode(b.dataset.mode);
  });

  // ===== Init =====
  async function init() {
    updateDraftVisibility();
    await fetchComments();
    setupHover();
    render();
  }
  init();
})();
