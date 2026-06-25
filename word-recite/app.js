const BOOKS_KEY = 't0mtalking-books-v1';
const STATE_KEY = 't0mtalking-state-v1';
if (!localStorage.getItem(BOOKS_KEY) && localStorage.getItem('wildwords-books-v1')) localStorage.setItem(BOOKS_KEY, localStorage.getItem('wildwords-books-v1'));
if (!localStorage.getItem(STATE_KEY) && localStorage.getItem('wildwords-state-v1')) localStorage.setItem(STATE_KEY, localStorage.getItem('wildwords-state-v1'));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let customBooks = read(BOOKS_KEY, []);
let state = read(STATE_KEY, { activeBook: 'botany-pdf', progress: {}, today: {}, selectedChapter: {}, reviewLog: [], lastReviewed: {} });
state.progress ||= {};
state.today ||= {};
state.selectedChapter ||= {};
state.reviewLog ||= [];
state.lastReviewed ||= {};
let books = [...window.DEFAULT_BOOKS, ...customBooks];
let mode = 'flash';
let currentIndex = 0;
let queue = [];
let meaningVisible = false;
let spellChecked = false;

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function save() {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(customBooks));
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
function activeBook() {
  return books.find((book) => book.id === state.activeBook) || books[0];
}
function allWords(book = activeBook()) {
  return book.chapters.flatMap((chapter) => chapter.words.map((word) => ({ ...word, chapterId: chapter.id, chapterName: chapter.name })));
}
function selectedChapter() {
  const book = activeBook();
  return state.selectedChapter[book.id] || 'all';
}
function rebuildQueue(reset = true) {
  const chapterId = selectedChapter();
  queue = allWords().filter((word) => chapterId === 'all' || word.chapterId === chapterId);
  if (reset) currentIndex = 0;
  if (currentIndex >= queue.length) currentIndex = 0;
  renderCard();
}
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function wordStatus(id, value, options = {}) {
  if (value) state.progress[id] = value;
  const day = localDate();
  state.lastReviewed[id] = day;
  state.today[day] = (state.today[day] || 0) + 1;
  if (options.spelling) state.reviewLog.push({ wordId: id, date: day, result: value, input: options.input || '' });
  save();
  renderHeader();
  if (!options.silent) toast(value === 'known' ? '记住了，继续保持' : '已加入待巩固');
  if (options.advance !== false) next();
}
function todayCount() {
  return state.today[localDate()] || 0;
}

function renderHeader() {
  const book = activeBook();
  $('#bookIcon').textContent = book.icon || '📘';
  $('#bookName').textContent = book.name;
  $('#bookMeta').textContent = `${book.chapters.length} 个章节 · ${allWords(book).length} 个词`;
  $('#todayCount').textContent = todayCount();
  $('#switcherMenu').innerHTML = books.map((item) => `<button data-book="${item.id}"><span>${item.icon || '📘'}</span><span><b>${escapeHtml(item.name)}</b><small>${allWords(item).length} 个词</small></span></button>`).join('');
}
function renderChapters() {
  const book = activeBook();
  const selected = selectedChapter();
  $('#chapterList').innerHTML = `<button class="chapter-button ${selected === 'all' ? 'active' : ''}" data-chapter="all">全部词汇 <span>${allWords(book).length}</span></button>` + book.chapters.map((chapter) => `<button class="chapter-button ${selected === chapter.id ? 'active' : ''}" data-chapter="${chapter.id}" title="${escapeHtml(chapter.title || '')}">${escapeHtml(chapter.name)} <span>${chapter.words.length}</span></button>`).join('');
}
function renderCard() {
  const word = queue[currentIndex];
  meaningVisible = false;
  spellChecked = false;
  $('#flashCard').classList.remove('revealed');
  $('#spellCard').classList.remove('answered', 'wrong-answer');
  $('#spellFeedback').textContent = '';
  $('#spellFeedback').className = 'feedback';
  $('#spellInput').value = '';
  $('#spellInput').disabled = false;
  $('#checkSpell').textContent = '检查答案';
  if (!word) {
    $('#flashTerm').textContent = '暂无词汇';
    $('#flashMeaning').textContent = '请新增词书或选择其他章节';
    $('#flashNote').textContent = '';
    $('#sessionLabel').textContent = '0 / 0';
    $('#sessionBar').style.width = '0';
    return;
  }
  $('#flashTerm').textContent = word.term;
  $('#flashMeaning').textContent = word.meaning;
  $('#flashNote').textContent = word.note || '这个词暂时没有补充提示。';
  $('#flashChapter').textContent = word.chapterName;
  $('#spellMeaning').textContent = word.meaning;
  $('#spellHint').textContent = word.note || `首字母：${word.term.charAt(0)}`;
  $('#sessionLabel').textContent = `${currentIndex + 1} / ${queue.length}`;
  $('#sessionBar').style.width = `${(currentIndex + 1) / queue.length * 100}%`;
}
function renderBooks() {
  $('#bookGrid').innerHTML = books.map((book) => `<article class="book-item"><span class="book-icon">${book.icon || '📘'}</span><h3>${escapeHtml(book.name)}</h3><p>${escapeHtml(book.description || '自定义词书')}</p><footer><span>${book.chapters.length} 章 · ${allWords(book).length} 词</span><div><button class="use" data-use="${book.id}">${book.id === state.activeBook ? '学习中' : '开始学习'}</button>${book.id !== 'zoology-final' ? `<button class="delete" data-delete="${book.id}" aria-label="删除">删除</button>` : ''}</div></footer></article>`).join('');
}
function renderProgress() {
  const values = Object.values(state.progress);
  $('#knownStat').textContent = values.filter((v) => v === 'known').length;
  $('#againStat').textContent = values.filter((v) => v === 'again').length;
  $('#todayStat').textContent = todayCount();
  $('#bookProgress').innerHTML = books.map((book) => {
    const words = allWords(book);
    const known = words.filter((word) => state.progress[word.id] === 'known').length;
    const pct = words.length ? Math.round(known / words.length * 100) : 0;
    return `<div class="progress-row"><header><b>${book.icon || '📘'} ${escapeHtml(book.name)}</b><span>${known} / ${words.length} · ${pct}%</span></header><div class="progress-track"><i style="width:${pct}%"></i></div></div>`;
  }).join('') || '<p class="empty">还没有学习记录。</p>';
  renderReviewHistory();
}
function wordLookup() {
  const lookup = new Map();
  books.forEach((book) => allWords(book).forEach((word) => lookup.set(word.id, { ...word, bookName: book.name })));
  return lookup;
}
function dateLabel(date) {
  if (date === localDate()) return `今天 · ${date}`;
  return date;
}
function groupedHistory(items, rowRenderer) {
  if (!items.length) return '<p class="review-empty">暂时没有记录。</p>';
  const groups = items.reduce((result, item) => ((result[item.date] ||= []).push(item), result), {});
  return Object.keys(groups).sort().reverse().map((date) => `<section class="date-group"><h3>${dateLabel(date)}</h3>${groups[date].map(rowRenderer).join('')}</section>`).join('');
}
function renderReviewHistory() {
  const lookup = wordLookup();
  const mistakes = state.reviewLog.filter((entry) => entry.result === 'again' && lookup.has(entry.wordId)).slice().reverse();
  $('#mistakeCount').textContent = mistakes.length;
  $('#mistakeHistory').innerHTML = groupedHistory(mistakes, (entry) => {
    const word = lookup.get(entry.wordId);
    return `<article class="review-word"><b>${escapeHtml(word.term)}</b><span class="meaning">${escapeHtml(word.meaning)}</span><span class="attempt">你的拼写：${escapeHtml(entry.input || '（未填写）')}<br>正确答案：${escapeHtml(word.term)}</span><small class="book-tag">${escapeHtml(word.bookName)} · ${escapeHtml(word.chapterName)}</small></article>`;
  });
  const pending = [...lookup.values()].filter((word) => state.progress[word.id] === 'again').map((word) => ({ ...word, date: state.lastReviewed[word.id] || localDate() }));
  $('#reviewCount').textContent = pending.length;
  $('#reviewHistory').innerHTML = groupedHistory(pending, (word) => `<article class="review-word"><b>${escapeHtml(word.term)}</b><span class="meaning">${escapeHtml(word.meaning)}</span><small class="book-tag">${escapeHtml(word.bookName)} · ${escapeHtml(word.chapterName)}</small></article>`);
}
function renderAll() {
  renderHeader();
  renderChapters();
  rebuildQueue();
  renderBooks();
  renderProgress();
}
function useBook(id) {
  state.activeBook = id;
  save();
  renderAll();
  showPage('study');
}
function showPage(page) {
  $$('.page').forEach((el) => el.classList.toggle('active', el.id === `${page}Page`));
  $$('.nav-link').forEach((el) => el.classList.toggle('active', el.dataset.page === page));
  if (page === 'books') renderBooks();
  if (page === 'progress') renderProgress();
}
function next() { if (queue.length) { currentIndex = (currentIndex + 1) % queue.length; renderCard(); } }
function previous() { if (queue.length) { currentIndex = (currentIndex - 1 + queue.length) % queue.length; renderCard(); } }
function toggleMeaning() {
  meaningVisible = !meaningVisible;
  $('#flashCard').classList.toggle('revealed', meaningVisible);
}
function normalize(value) { return value.toLowerCase().trim().replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' '); }
function checkSpell() {
  const word = queue[currentIndex];
  if (!word) return;
  if (spellChecked) return next();
  const rawAnswer = $('#spellInput').value.trim();
  if (!rawAnswer) return toast('请先输入拼写');
  const answer = normalize(rawAnswer);
  const expected = normalize(word.term);
  const ok = answer === expected;
  spellChecked = true;
  $('#spellFeedback').innerHTML = ok ? `✓ 拼写正确<span class="spell-answer">答案：${escapeHtml(word.term)}</span>` : `✕ 拼写错误<span class="spell-answer">你的答案：${escapeHtml(rawAnswer)}<br>正确答案：${escapeHtml(word.term)}</span>`;
  $('#spellFeedback').className = `feedback ${ok ? 'good' : 'bad'}`;
  $('#spellCard').classList.add('answered');
  $('#spellCard').classList.toggle('wrong-answer', !ok);
  $('#spellInput').disabled = true;
  $('#checkSpell').textContent = '下一个单词 →';
  wordStatus(word.id, ok ? 'known' : 'again', { spelling: true, input: rawAnswer, advance: false, silent: true });
  renderProgress();
}
function speak(event) {
  event.stopPropagation();
  const word = queue[currentIndex];
  if (!word || !('speechSynthesis' in window)) return toast('当前浏览器不支持朗读');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.term);
  utterance.lang = 'en-US';
  utterance.rate = .82;
  speechSynthesis.speak(utterance);
}
function parseText(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const parts = line.split(/\s*[|｜\t]\s*|\s*,\s*(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((part) => part.replace(/^"|"$/g, '').trim());
    return { id: `custom-${Date.now()}-${index}`, term: parts[0] || '', meaning: parts[1] || '', note: parts.slice(2).join('；') };
  }).filter((word) => word.term && word.meaning);
}
function parseImport(text, fileName = '') {
  if (fileName.toLowerCase().endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
    const parsed = JSON.parse(text);
    const source = Array.isArray(parsed) ? parsed : parsed.words || [];
    return source.map((item, index) => typeof item === 'string' ? parseText(item)[0] : ({ id: `custom-${Date.now()}-${index}`, term: item.term || item.word || item.english || '', meaning: item.meaning || item.translation || item.chinese || '', note: item.note || item.example || item.hint || '' })).filter((word) => word.term && word.meaning);
  }
  return parseText(text);
}
function wordsToText(words) { return words.map((word) => [word.term, word.meaning, word.note].filter(Boolean).join(' | ')).join('\n'); }
function createBook(form) {
  const data = new FormData(form);
  const words = parseText(data.get('words'));
  if (!words.length) return toast('没有识别到有效词汇，请检查格式');
  const id = `book-${Date.now()}`;
  const book = { id, name: data.get('name').trim(), description: data.get('description').trim() || '自定义学习词书', icon: '📗', createdAt: new Date().toISOString(), chapters: [{ id: `${id}-chapter-1`, name: '全部词汇', title: '', words }] };
  customBooks.push(book);
  books = [...window.DEFAULT_BOOKS, ...customBooks];
  state.activeBook = id;
  save();
  $('#addBookDialog').close();
  form.reset();
  renderAll();
  showPage('study');
  toast(`已导入 ${words.length} 个词`);
}
function deleteBook(id) {
  const book = books.find((item) => item.id === id);
  if (!book || !confirm(`确定删除“${book.name}”吗？学习记录也将一并清除。`)) return;
  const ids = new Set(allWords(book).map((word) => word.id));
  Object.keys(state.progress).forEach((id) => { if (ids.has(id)) delete state.progress[id]; });
  customBooks = customBooks.filter((item) => item.id !== id);
  books = [...window.DEFAULT_BOOKS, ...customBooks];
  if (state.activeBook === id) state.activeBook = 'zoology-final';
  save(); renderAll(); toast('词书已删除');
}
function escapeHtml(value) {
  const node = document.createElement('div'); node.textContent = value || ''; return node.innerHTML;
}
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 1800);
}

$$('.nav-link').forEach((button) => button.onclick = () => showPage(button.dataset.page));
$('#bookSwitcher').onclick = () => $('#switcherMenu').classList.toggle('open');
$('#switcherMenu').onclick = (event) => { const button = event.target.closest('[data-book]'); if (button) { $('#switcherMenu').classList.remove('open'); useBook(button.dataset.book); } };
$('#chapterList').onclick = (event) => { const button = event.target.closest('[data-chapter]'); if (!button) return; state.selectedChapter[activeBook().id] = button.dataset.chapter; save(); renderChapters(); rebuildQueue(); };
$('#selectAll').onclick = () => { state.selectedChapter[activeBook().id] = 'all'; save(); renderChapters(); rebuildQueue(); };
$$('.tabs button').forEach((button) => button.onclick = () => { mode = button.dataset.mode; $$('.tabs button').forEach((item) => item.classList.toggle('active', item === button)); $('#flashCard').hidden = mode !== 'flash'; $('#spellCard').hidden = mode !== 'spell'; if (mode === 'spell') $('#spellInput').focus(); });
$('#flashCard').onclick = toggleMeaning;
$('#speakButton').onclick = speak;
$('#nextWord').onclick = next;
$('#prevWord').onclick = previous;
$('#knownWord').onclick = () => queue[currentIndex] && wordStatus(queue[currentIndex].id, 'known');
$('#againWord').onclick = () => queue[currentIndex] && wordStatus(queue[currentIndex].id, 'again');
$('#checkSpell').onclick = checkSpell;
$('#spellInput').onkeydown = (event) => { if (event.key === 'Enter') checkSpell(); };
$('#shuffle').onclick = () => { queue.sort(() => Math.random() - .5); currentIndex = 0; renderCard(); toast('顺序已打乱'); };
$('#openAddBook').onclick = () => $('#addBookDialog').showModal();
$('#closeDialog').onclick = $('#cancelDialog').onclick = () => $('#addBookDialog').close();
$('#addBookForm').onsubmit = (event) => { event.preventDefault(); createBook(event.currentTarget); };
$('#importFile').onchange = async (event) => {
  const file = event.target.files[0]; if (!file) return;
  try { const words = parseImport(await file.text(), file.name); if (!words.length) throw new Error(); $('#addBookForm textarea[name="words"]').value = wordsToText(words); toast(`识别到 ${words.length} 个词，可继续编辑`); } catch { toast('文件无法识别，请使用示例格式'); }
};
$('#bookGrid').onclick = (event) => { const use = event.target.closest('[data-use]'); const del = event.target.closest('[data-delete]'); if (use) useBook(use.dataset.use); if (del) deleteBook(del.dataset.delete); };
document.addEventListener('keydown', (event) => {
  if (!$('#studyPage').classList.contains('active') || event.target.matches('input,textarea')) return;
  if (event.code === 'Space' && mode === 'flash') { event.preventDefault(); toggleMeaning(); }
  if (event.key === 'ArrowRight') next();
  if (event.key === 'ArrowLeft') previous();
  if (event.key === '1' && queue[currentIndex]) wordStatus(queue[currentIndex].id, 'again');
  if (event.key === '2' && queue[currentIndex]) wordStatus(queue[currentIndex].id, 'known');
});
document.addEventListener('click', (event) => { if (!event.target.closest('.book-switcher') && !event.target.closest('.switcher-menu')) $('#switcherMenu').classList.remove('open'); });

renderAll();
