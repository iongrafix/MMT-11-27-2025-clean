// Renderer script for Media Meta Tagger
// Connects the HTML UI to the Electron preload API (window.mmt)

const btnSelect = document.getElementById('btnSelect');
const btnRead   = document.getElementById('btnRead');
const btnClear  = document.getElementById('btnClear');
const btnApply  = document.getElementById('btnApply');
const btnLogs   = document.getElementById('btnLogs');

const titleInput    = document.getElementById('title');
const commentsInput = document.getElementById('comments');
const tagsWinInput  = document.getElementById('tagsWin');
const tagsMacInput  = document.getElementById('tagsMac');

const activeFileSpan = document.getElementById('activeFile');
const previewOutput  = document.getElementById('preview');
const previewMeta    = document.getElementById('previewMeta');
const logOutput      = document.getElementById('log');
const statusBar      = document.getElementById('status');

let currentFile = null;

function setStatus(message, isError = false) {
  if (!statusBar) return;
  statusBar.textContent = message || '';
  statusBar.style.color = isError ? '#ff6b6b' : '#ddd';
}

function appendLog(line) {
  if (!logOutput) return;
  const atBottom =
    logOutput.scrollTop + logOutput.clientHeight >= logOutput.scrollHeight - 4;
  logOutput.textContent += (line.endsWith('\n') ? line : line + '\n');
  if (atBottom) {
    logOutput.scrollTop = logOutput.scrollHeight;
  }
}

function parseTags(str) {
  if (!str) return [];
  return str
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTags(arr) {
  if (!arr || !arr.length) return '';
  return arr.join(', ');
}

function describeExt(file) {
  if (!file) return '';
  const lower = file.toLowerCase();
  if (lower.match(/\.(mp4|mov)$/)) return 'Video';
  if (lower.match(/\.(jpe?g|png|tiff?|gif|webp|heic)$/)) return 'Image';
  return 'File';
}

function renderPreview(file) {
  if (!previewOutput || !previewMeta) return;
  previewOutput.innerHTML = '';
  previewMeta.innerHTML = '';

  if (!file) return;

  const kind = describeExt(file);
  const lower = file.toLowerCase();

  if (lower.match(/\.(mp4|mov)$/)) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = `file://${file}`;
    video.style.maxWidth = '100%';
    video.style.maxHeight = '260px';
    previewOutput.appendChild(video);
  } else if (lower.match(/\.(jpe?g|png|tiff?|gif|webp|heic)$/)) {
    const img = document.createElement('img');
    img.src = `file://${file}`;
    img.alt = file;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '260px';
    previewOutput.appendChild(img);
  } else {
    const pre = document.createElement('pre');
    pre.textContent = file;
    previewOutput.appendChild(pre);
  }

  const meta = document.createElement('div');
  meta.className = 'preview-meta-inner';
  meta.innerHTML = `
    <div><strong>Type:</strong> ${kind}</div>
    <div><strong>Path:</strong> ${file}</div>
  `;
  previewMeta.appendChild(meta);
}

async function handleSelect() {
  try {
    setStatus('Choosing file...');
    const file = await window.mmt.openFile();
    if (!file) {
      setStatus('No file selected.');
      return;
    }
    currentFile = file;
    activeFileSpan.textContent = file;

    titleInput.value = '';
    commentsInput.value = '';
    tagsWinInput.value = '';
    tagsMacInput.value = '';

    renderPreview(file);
    setStatus('File selected. Click "Read Metadata" to load current values.');
  } catch (err) {
    console.error(err);
    setStatus('Error selecting file: ' + err.message, true);
  }
}

async function handleRead() {
  try {
    if (!currentFile) {
      setStatus('Please select a file first.', true);
      return;
    }
    setStatus('Reading metadata...');

    const res = await window.mmt.readWin(currentFile);
    if (!res || !res.ok) {
      setStatus(
        'Failed to read metadata: ' +
          (res && res.error ? res.error : 'Unknown error'),
        true
      );
      return;
    }

    titleInput.value = res.title || '';
    commentsInput.value = res.comments || '';
    tagsWinInput.value = joinTags(res.windowsTags || res.tagsWin || []);
    tagsMacInput.value = joinTags(res.macTags || res.tagsMac || []);

    setStatus('Metadata loaded from file.');
  } catch (err) {
    console.error(err);
    setStatus('Error reading metadata: ' + err.message, true);
  }
}

async function handleApply() {
  try {
    if (!currentFile) {
      setStatus('Please select a file first.', true);
      return;
    }

    const payload = {
      file: currentFile,
      title: titleInput.value || '',
      comments: commentsInput.value || '',
      windowsTags: parseTags(tagsWinInput.value),
      macTags: parseTags(tagsMacInput.value),
    };

    setStatus('Writing metadata...');
    const res = await window.mmt.writeWin(payload);
    if (!res || !res.ok) {
      setStatus(
        'Failed to write metadata: ' +
          (res && res.error ? res.error : 'Unknown error'),
        true
      );
      return;
    }

    setStatus('Metadata applied successfully.');
  } catch (err) {
    console.error(err);
    setStatus('Error writing metadata: ' + err.message, true);
  }
}

async function handleClear() {
  try {
    if (!currentFile) {
      setStatus('Please select a file first.', true);
      return;
    }

    setStatus('Clearing metadata...');
    const res = await window.mmt.clear(currentFile);
    if (!res || !res.ok) {
      setStatus(
        'Failed to clear metadata: ' +
          (res && res.error ? res.error : 'Unknown error'),
        true
      );
      return;
    }

    titleInput.value = '';
    commentsInput.value = '';
    tagsWinInput.value = '';
    tagsMacInput.value = '';

    setStatus('Title, comments, and tags cleared.');
  } catch (err) {
    console.error(err);
    setStatus('Error clearing metadata: ' + err.message, true);
  }
}

function handleOpenLogs() {
  window.mmt.openLogs();
}

// Wire up events
btnSelect?.addEventListener('click', handleSelect);
btnRead?.addEventListener('click', handleRead);
btnApply?.addEventListener('click', handleApply);
btnClear?.addEventListener('click', handleClear);
btnLogs?.addEventListener('click', handleOpenLogs);

// Live log feed from main process
if (window.mmt && typeof window.mmt.onLog === 'function') {
  window.mmt.onLog((line) => appendLog(line));
}

setStatus('Ready. Select a file to begin.');
