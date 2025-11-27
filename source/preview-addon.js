// preview-addon.js — docked preview with TIFF fallback via ExifTool thumbnail
(function () {
  const PANE_W = 420;
  const css = `
  .dbm-preview{position:fixed;right:16px;width:${PANE_W}px;background:#0b1020;border:1px solid #222;border-radius:14px;
    box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:9999;display:flex;flex-direction:column;max-height:calc(100vh - 120px)}
  .dbm-preview-head{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #1f2336;color:#cfd3df;font-size:14px}
  .dbm-preview-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 90px)}
  .dbm-preview-actions{display:flex;gap:6px}
  .dbm-btn{border:1px solid #2a2f45;background:#141a2b;color:#e6e6e6;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer}
  .dbm-preview-body{padding:10px;min-height:260px;display:grid;place-items:center}
  .dbm-preview-media{max-width:100%;max-height:100%;border-radius:10px;background:#0f1322}
  .dbm-preview-empty{opacity:.7;font-size:13px;text-align:center;padding:12px}
  @media (max-width:1100px){.dbm-preview{width:320px}}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const pane = document.createElement('aside');
  pane.className = 'dbm-preview';
  pane.innerHTML = `
    <div class="dbm-preview-head">
      <strong class="dbm-preview-title" id="dbm_prev_name">No file selected</strong>
      <div class="dbm-preview-actions">
        <button class="dbm-btn" id="dbm_prev_dock">⟷ Dock</button>
        <button class="dbm-btn" id="dbm_prev_hide">✕ Hide (F9)</button>
      </div>
    </div>
    <div class="dbm-preview-body">
      <img id="dbm_prev_img" class="dbm-preview-media" hidden />
      <video id="dbm_prev_video" class="dbm-preview-media" controls hidden></video>
      <div id="dbm_prev_empty" class="dbm-preview-empty">Select a PNG / JPG / TIFF / WEBP or MP4 / MOV to preview.</div>
    </div>
  `;
  document.body.appendChild(pane);

  function positionBelowHeader(){
    const header = document.querySelector('.app-header');
    const top = header ? (header.getBoundingClientRect().bottom + 8 + window.scrollY) : (16 + window.scrollY);
    pane.style.top = top + 'px';
  }
  function applyDocked(docked){
    document.body.style.marginRight = docked ? (PANE_W + 32) + 'px' : '0';
    pane.style.right = '16px';
    localStorage.setItem('dbm_preview_docked', docked ? '1' : '0');
    positionBelowHeader();
  }
  window.addEventListener('resize', positionBelowHeader);
  window.addEventListener('scroll', positionBelowHeader);
  applyDocked(localStorage.getItem('dbm_preview_docked') !== '0');
  document.getElementById('dbm_prev_hide').addEventListener('click', () => { pane.style.display='none'; document.body.style.marginRight='0'; localStorage.setItem('dbm_preview_hidden','1'); });
  document.getElementById('dbm_prev_dock').addEventListener('click', () => { const next = !(localStorage.getItem('dbm_preview_docked') !== '0'); applyDocked(next); });
  if(localStorage.getItem('dbm_preview_hidden') === '1'){ pane.style.display='none'; }

  const nameEl  = pane.querySelector('#dbm_prev_name');
  const imgEl   = pane.querySelector('#dbm_prev_img');
  const videoEl = pane.querySelector('#dbm_prev_video');
  const emptyEl = pane.querySelector('#dbm_prev_empty');
  const fileListEl = document.getElementById('file-list') || document.body;

  const toFileURL = p => 'file:///' + String(p).replace(/\\/g, '/');
  const isVideo   = p => /\.(mp4|mov|m4v)$/i.test(p);
  const isImage   = p => /\.(png|jpe?g|tiff?|webp)$/i.test(p);
  const isTiff    = p => /\.(tif|tiff)$/i.test(p);
  const looksLikePath = s => /^[A-Za-z]:\\/.test(s);

  function hideAll(){ imgEl.hidden = true; videoEl.hidden = true; emptyEl.hidden = false; }

  async function setPreview(fp){
    if(!fp){ nameEl.textContent='No file selected'; hideAll(); return; }
    nameEl.textContent = fp;

    // ordinary images
    if (/\.(png|jpe?g|webp)$/i.test(fp)) {
      imgEl.src = toFileURL(fp);
      imgEl.hidden = false; videoEl.hidden = true; emptyEl.hidden = true;
      return;
    }

    // videos
    if (isVideo(fp)) {
      videoEl.src = toFileURL(fp);
      videoEl.hidden = false; imgEl.hidden = true; emptyEl.hidden = true;
      return;
    }

    // TIFF: try embedded preview via ExifTool
    if (isTiff(fp)) {
      try {
        const res = await window.dbm.previewThumb(fp);
        if (res?.ok && res.base64) {
          imgEl.src = `data:${res.mime||'image/jpeg'};base64,${res.base64}`;
          imgEl.hidden = false; videoEl.hidden = true; emptyEl.hidden = true;
          return;
        }
      } catch (e) {
        console.error('TIFF preview error:', e);
      }
      hideAll(); emptyEl.textContent = 'Cannot preview this TIFF (unsupported compression).';
      return;
    }

    hideAll(); emptyEl.textContent = 'No preview for this file type.';
  }

  function pathFromRow(row){
    const p = row.querySelector && row.querySelector('.file-path');
    if (p && p.textContent && looksLikePath(p.textContent.trim())) return p.textContent.trim();
    const text = row.innerText || row.textContent || '';
    const m = text.match(/[A-Za-z]:\\[^\n\r]+/);
    return m ? m[0] : null;
  }
  function wireRow(row){
    if (!row || row.dataset && row.dataset.dbmPrevWired) return;
    const fp = pathFromRow(row); if(!fp) return;
    row.dataset.dbmPrevWired = '1';
    row.addEventListener('click', () => setPreview(fp));
  }
  function wireAll(){
    const rows = (fileListEl.querySelectorAll && fileListEl.querySelectorAll('.file-item')) || [];
    rows.forEach(wireRow);
    if (!pane.dataset.dbmHasShown && rows.length){
      const fp = pathFromRow(rows[0]); if (fp) { setPreview(fp); pane.dataset.dbmHasShown='1'; }
    }
  }
  wireAll();
  new MutationObserver(wireAll).observe(fileListEl, { childList: true, subtree: true });

  window.addEventListener('keydown', (e)=>{ if(e.key==='F9'){ if(pane.style.display==='none'){ pane.style.display=''; applyDocked(localStorage.getItem('dbm_preview_docked')!=='0'); } else { pane.style.display='none'; document.body.style.marginRight='0'; } }});
  window.DBMPreview = { set: setPreview, dock: applyDocked };
  positionBelowHeader();
})();
