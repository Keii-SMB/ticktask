// Daily Hub - Main Application
// ========================================

// App State
const state = {
    currentTool: 'calculator',
    notes: [],
    currentNote: null,
    tags: [],
    stickyNotes: [],
    todos: [],
    todoFilter: 'all',
    pomodoro: { mode: 'work', time: 25 * 60, isRunning: false, sessions: 0, totalTime: 0 },
    worldClocks: [],
    quickLinks: [],
    quickLinks: [],
    holidays: {},
};

// Make state globally accessible
window.appState = state;




// Initialize Lucide Icons and Smooth Scroll
let lenis = null;
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initApp();

    // Initialize Lenis for smooth scrolling
    if (typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            smoothTouch: false,
            touchMultiplier: 2
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }
});

// Load state from localStorage
function loadState() {
    const saved = localStorage.getItem('dailyHubState');
    if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(state, parsed);
    }
}

// Save state to localStorage
// ========================================
// CLOUD SYNC LOGIC
// ========================================
window.saveToCloud = () => {
    if (!window.currentUser || !window.db) return;

    const dataToSave = {
        notes: state.notes,
        tags: state.tags,
        folders: state.folders,
        expandedFolders: state.expandedFolders,
        stickyNotes: state.stickyNotes,
        todos: state.todos,
        worldClocks: state.worldClocks,
        quickLinks: state.quickLinks,
        pomodoro: { sessions: state.pomodoro.sessions, totalTime: state.pomodoro.totalTime },
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    window.db.collection('users').doc(window.currentUser.uid).set(dataToSave, { merge: true })
        .then(() => console.log("Cloud Saved"))
        .catch(e => console.error("Cloud Save Error:", e));
};

window.loadFromCloud = () => {
    if (!window.currentUser || !window.db) return;

    window.db.collection('users').doc(window.currentUser.uid).get()
        .then((doc) => {
            if (doc.exists) {
                const cloudData = doc.data();
                // Merge cloud data into state
                Object.assign(state, cloudData);
                console.log("Cloud Loaded");
                saveState(false); // Update local storage, false to skip cloud loop
                renderApp();
                renderCurrentTool();
                // Re-init engines if needed
                fetchHolidays(new Date().getFullYear());
            } else {
                console.log("No cloud data yet. First save will create it.");
                saveToCloud(); // Create initial doc
            }
        })
        .catch((error) => {
            console.error("Error getting document:", error);
        });
};

// Save state to localStorage (and Cloud)
function saveState(syncToCloud = true) {
    localStorage.setItem('dailyHubState', JSON.stringify({
        notes: state.notes,
        tags: state.tags,
        folders: state.folders,
        expandedFolders: state.expandedFolders,
        stickyNotes: state.stickyNotes,
        todos: state.todos,
        worldClocks: state.worldClocks,
        quickLinks: state.quickLinks,
        pomodoro: { sessions: state.pomodoro.sessions, totalTime: state.pomodoro.totalTime }
    }));

    if (syncToCloud && window.saveToCloud) window.saveToCloud();
}

// Initialize Application
function initApp() {
    loadState();
    migrateQuickLinks(); // Fix old emoji icons
    initDefaults();
    renderApp();
    initNavigation();
    startClockInterval();

    fetchHolidays(new Date().getFullYear());

}

function migrateQuickLinks() {
    // Migration: specific mapping for old emojis
    const emojiMap = {
        '🔍': 'search', '💻': 'github', '🎬': 'youtube', '📧': 'mail', '🌐': 'globe',
        '🎵': 'music', '📚': 'book', '☁️': 'cloud', '🛒': 'shopping-cart'
    };
    let updated = false;
    state.quickLinks.forEach(link => {
        if (emojiMap[link.icon]) {
            link.icon = emojiMap[link.icon];
            updated = true;
        } else if (!link.icon.match(/^[a-z0-9-]+$/)) {
            // If it's still non-standard and not in map, fallback to globe
            link.icon = 'globe';
            updated = true;
        }
    });
    if (updated) saveState();
}

// Global helper to re-render the current view
// This is called by widgets.js
window.renderCurrentTool = function () {
    renderApp();
};

async function fetchHolidays(year) {
    if (state.holidays[year]) return; // Already fetched

    try {
        const response = await fetch(`https://libur.deno.dev/api?year=${year}`);
        const data = await response.json();

        // Ensure year bucket exists
        if (!state.holidays[year]) state.holidays[year] = {};

        // Parse api response
        // libur.deno.dev likely returns array of objects
        const holidays = Array.isArray(data) ? data : (data.data || []);

        holidays.forEach(holiday => {
            // Support possible field variations
            const dateRaw = holiday.holiday_date || holiday.date;
            const name = holiday.holiday_name || holiday.name || holiday.summary;

            if (dateRaw && name) {
                const date = new Date(dateRaw);
                const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
                state.holidays[year][dateStr] = name;
            }
        });

        // Re-render if calendar is visible in DOM (regardless of currentTool)
        const calendarPanel = document.getElementById('calendar-panel');
        if (calendarPanel) {
            calendarPanel.outerHTML = renderCalendar();
            initCalendarEvents();
            lucide.createIcons(); // Re-render icons after DOM update
        }
    } catch (e) {
        console.error('Failed to fetch holidays:', e);
    }
}

function initDefaults() {
    // Folders
    if (!state.folders || state.folders.length === 0) {
        state.folders = [{ id: 'default', name: 'All Notes' }];
    }
    state.expandedFolders = state.expandedFolders || ['default'];

    // Notes
    if (state.notes.length === 0) {
        state.notes.push({
            id: Date.now(),
            title: 'Welcome to Documents',
            content: '<h2>Welcome to TickTask Documents!</h2><p>This is a <strong>rich text editor</strong> with full formatting support:</p><ul><li><strong>Bold</strong>, <em>Italic</em>, <u>Underline</u></li><li>Headings (H1, H2, H3)</li><li>Text alignment</li><li>Bullet and numbered lists</li><li>Text colors and highlighting</li></ul><p>Try creating folders and organizing your documents with drag &amp; drop!</p>',
            tags: [],
            folderId: 'default',
            updatedAt: new Date().toISOString()
        });
    }
    state.currentNote = state.notes[0];

    // Sticky Notes
    if (state.stickyNotes.length === 0) {
        state.stickyNotes.push({
            id: Date.now(),
            content: 'Click the + button to add more sticky notes!',
            color: 'yellow'
        });
    }

    // Quick Links
    if (state.quickLinks.length === 0) {
        state.quickLinks = [
            { id: 1, title: 'Google', url: 'https://google.com', icon: 'search' },
            { id: 2, title: 'GitHub', url: 'https://github.com', icon: 'github' },
            { id: 3, title: 'YouTube', url: 'https://youtube.com', icon: 'youtube' }
        ];
    }

    // Pomodoro - ensure all values are properly set
    if (!state.pomodoro.mode) state.pomodoro.mode = 'work';
    if (!state.pomodoro.time || isNaN(state.pomodoro.time)) {
        const times = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
        state.pomodoro.time = times[state.pomodoro.mode] || 25 * 60;
    }
    if (typeof state.pomodoro.sessions !== 'number') state.pomodoro.sessions = 0;
    if (typeof state.pomodoro.totalTime !== 'number') state.pomodoro.totalTime = 0;
    state.pomodoro.isRunning = false;
}

// Navigation
function initNavigation() {
    const dock = document.getElementById('dock');
    dock.addEventListener('click', (e) => {
        const item = e.target.closest('.dock-item');
        if (item) {
            setActiveTool(item.dataset.tool);
        }
    });
}

function setActiveTool(tool) {
    state.currentTool = tool;

    // Update dock item active states
    document.querySelectorAll('.dock-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tool === tool);
    });

    // Hide all panels, show the selected one (NO animation, instant switch)
    document.querySelectorAll('.tool-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`${tool}-panel`);
    if (activePanel) {
        activePanel.classList.add('active');
    }
}

function renderApp() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        ${renderCalculator()}
        ${renderNotepad()}
        ${renderStickyNotes()}
        ${renderTodo()}
        ${renderPomodoro()}
        ${renderWorldClock()}
        ${renderCalendar()}
        ${renderCurrency()}
        ${renderQuickLinks()}
        ${renderModals()}
    `;
    lucide.createIcons();
    initAllEvents();
    setActiveTool(state.currentTool);
}

// ========================================
// CALCULATOR
// ========================================
let calcDisplay = '0';
let calcHistory = '';
let calcOperator = null;
let calcPrevValue = null;
let calcWaitingForOperand = false;

function renderCalculator() {
    return `
        <section class="tool-panel glass" id="calculator-panel">
            <div class="panel-header">
                <h2>Calculator</h2>
            </div>
            <div class="calculator">
                <div class="calc-display">
                    <div class="calc-history" id="calc-history">${calcHistory}</div>
                    <div class="calc-input" id="calc-input">${calcDisplay}</div>
                </div>
                <div class="calc-buttons" id="calc-buttons">
                    <button class="calc-btn func" data-action="clear">AC</button>
                    <button class="calc-btn func" data-action="negate">±</button>
                    <button class="calc-btn func" data-action="percent">%</button>
                    <button class="calc-btn operator" data-action="divide">÷</button>
                    <button class="calc-btn number" data-value="7">7</button>
                    <button class="calc-btn number" data-value="8">8</button>
                    <button class="calc-btn number" data-value="9">9</button>
                    <button class="calc-btn operator" data-action="multiply">×</button>
                    <button class="calc-btn number" data-value="4">4</button>
                    <button class="calc-btn number" data-value="5">5</button>
                    <button class="calc-btn number" data-value="6">6</button>
                    <button class="calc-btn operator" data-action="subtract">−</button>
                    <button class="calc-btn number" data-value="1">1</button>
                    <button class="calc-btn number" data-value="2">2</button>
                    <button class="calc-btn number" data-value="3">3</button>
                    <button class="calc-btn operator" data-action="add">+</button>
                    <button class="calc-btn number zero" data-value="0">0</button>
                    <button class="calc-btn number" data-value=".">.</button>
                    <button class="calc-btn equals" data-action="equals">=</button>
                </div>
            </div>
        </section>
    `;
}

function initCalculatorEvents() {
    document.getElementById('calc-buttons')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.calc-btn');
        if (!btn) return;

        if (btn.dataset.value) inputNumber(btn.dataset.value);
        else if (btn.dataset.action) handleCalcAction(btn.dataset.action);
        updateCalcDisplay();
    });

    document.addEventListener('keydown', (e) => {
        if (state.currentTool !== 'calculator') return;
        if (/[0-9.]/.test(e.key)) inputNumber(e.key);
        else if (e.key === '+') handleCalcAction('add');
        else if (e.key === '-') handleCalcAction('subtract');
        else if (e.key === '*') handleCalcAction('multiply');
        else if (e.key === '/') handleCalcAction('divide');
        else if (e.key === 'Enter' || e.key === '=') handleCalcAction('equals');
        else if (e.key === 'Escape') handleCalcAction('clear');
        updateCalcDisplay();
    });
}

function inputNumber(num) {
    if (calcWaitingForOperand) {
        calcDisplay = num === '.' ? '0.' : num;
        calcWaitingForOperand = false;
    } else {
        if (num === '.' && calcDisplay.includes('.')) return;
        calcDisplay = calcDisplay === '0' && num !== '.' ? num : calcDisplay + num;
    }
}

function handleCalcAction(action) {
    const current = parseFloat(calcDisplay);

    switch (action) {
        case 'clear':
            calcDisplay = '0'; calcHistory = ''; calcOperator = null; calcPrevValue = null; calcWaitingForOperand = false;
            break;
        case 'negate': calcDisplay = String(-current); break;
        case 'percent': calcDisplay = String(current / 100); break;
        case 'add': case 'subtract': case 'multiply': case 'divide':
            if (calcOperator && !calcWaitingForOperand) {
                calcPrevValue = calculate(calcPrevValue, current, calcOperator);
                calcDisplay = String(calcPrevValue);
            } else { calcPrevValue = current; }
            calcOperator = action;
            calcHistory = `${calcPrevValue} ${getOperatorSymbol(action)}`;
            calcWaitingForOperand = true;
            break;
        case 'equals':
            if (calcOperator && calcPrevValue !== null) {
                const result = calculate(calcPrevValue, current, calcOperator);
                calcHistory = `${calcPrevValue} ${getOperatorSymbol(calcOperator)} ${current} =`;
                calcDisplay = String(result);
                calcOperator = null; calcPrevValue = null; calcWaitingForOperand = true;
            }
            break;
    }
}

function calculate(a, b, op) {
    switch (op) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': return b !== 0 ? a / b : 'Error';
    }
}

function getOperatorSymbol(op) {
    return { add: '+', subtract: '−', multiply: '×', divide: '÷' }[op] || '';
}

function updateCalcDisplay() {
    const input = document.getElementById('calc-input');
    const history = document.getElementById('calc-history');
    if (input) input.textContent = calcDisplay;
    if (history) history.textContent = calcHistory;
}

// ========================================
// NOTEPAD (Rich Text Editor)
// ========================================
function renderNotepad() {
    // Get current tag filter
    const currentTag = state.currentTagFilter || 'all';

    // Build folder structure with accordion
    const folders = state.folders || [{ id: 'default', name: 'All Notes' }];
    const expandedFolders = state.expandedFolders || ['default'];

    const folderList = folders.map(folder => {
        // Filter notes by folder AND tag
        let folderNotes = state.notes.filter(n => (n.folderId || 'default') === folder.id);
        if (currentTag !== 'all') {
            folderNotes = folderNotes.filter(n => n.tags && n.tags.includes(currentTag));
        }
        const isExpanded = expandedFolders.includes(folder.id);

        const noteItems = folderNotes.map(note => `
            <div class="note-item ${note.id === state.currentNote?.id ? 'active' : ''}" data-id="${note.id}">
                <div class="note-item-content">
                    <div class="note-item-title">${note.title || 'Untitled'}</div>
                    <div class="note-item-preview">${stripHtml(note.content || '').substring(0, 50) || 'No content'}</div>
                    <div class="note-item-date">${formatDate(note.updatedAt)}</div>
                </div>
                <button class="note-delete-btn" data-note-id="${note.id}" title="Delete note"><i data-lucide="trash-2"></i></button>
            </div>
        `).join('');

        return `
            <div class="folder-accordion" data-folder="${folder.id}">
                <div class="folder-header ${isExpanded ? 'expanded' : ''}" data-folder="${folder.id}">
                    <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="folder-chevron"></i>
                    <i data-lucide="folder${isExpanded ? '-open' : ''}" class="folder-icon"></i>
                    <span class="folder-name">${folder.name}</span>
                    <span class="folder-count">${folderNotes.length}</span>
                    <div class="folder-actions">
                        <button class="folder-add-note-btn" data-folder="${folder.id}" title="Add note to folder"><i data-lucide="plus"></i></button>
                        ${folder.id !== 'default' ? `<button class="folder-delete-btn" data-folder="${folder.id}" title="Delete folder"><i data-lucide="trash-2"></i></button>` : ''}
                    </div>
                </div>
                <div class="folder-content ${isExpanded ? 'expanded' : ''}" data-folder="${folder.id}">
                    <div class="folder-content-inner">
                        ${noteItems || '<p class="empty-hint">No documents</p>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const tagFilters = [`<button class="tag-btn ${currentTag === 'all' ? 'active' : ''}" data-tag="all">All</button>`];
    state.tags.forEach(tag => tagFilters.push(`<button class="tag-btn ${currentTag === tag.name ? 'active' : ''}" data-tag="${tag.name}" style="border-color:${tag.color};${currentTag === tag.name ? 'background:' + tag.color + ';color:white;' : ''}">${tag.name}<span class="delete-tag-btn" data-tag="${tag.name}" title="Delete tag">×</span></button>`));

    const noteTags = (state.currentNote?.tags || []).map(tagName => {
        const tag = state.tags.find(t => t.name === tagName);
        return tag ? `<span class="note-tag" style="background:${tag.color}">${tag.name}<button class="remove-tag-btn" data-tag="${tagName}">×</button></span>` : '';
    }).join('');

    return `
        <section class="tool-panel glass wide" id="notepad-panel">
            <div class="panel-header">
                <h2>Documents</h2>
                <div class="panel-actions">
                    <button class="icon-btn" id="new-folder-btn" title="New Folder"><i data-lucide="folder-plus"></i></button>
                    <button class="icon-btn" id="new-note-btn" title="New Document"><i data-lucide="plus"></i></button>
                </div>
            </div>
            <div class="notepad-container">
                <div class="notes-sidebar">
                    <div class="notes-search"><i data-lucide="search"></i><input type="text" placeholder="Search documents..." id="notes-search"></div>
                    <div class="tags-filter" id="tags-filter">${tagFilters.join('')}</div>
                    <div class="folders-accordion-list" id="folders-list">${folderList}</div>
                </div>
                <div class="note-editor">
                    <div class="note-editor-header">
                        <button class="mobile-back-btn" onclick="window.backToNotesList()" style="display:none"><i data-lucide="arrow-left"></i> Back</button>
                        <input type="text" class="note-title" id="note-title" placeholder="Document title..." value="${state.currentNote?.title || ''}">
                        <div class="note-tags" id="note-tags">${noteTags}<button class="add-tag-btn" id="add-tag-btn"><i data-lucide="tag"></i></button></div>
                    </div>
                    
                    <!-- Rich Text Toolbar -->
                    <div class="editor-toolbar" id="editor-toolbar">
                        <div class="toolbar-group">
                            <button class="toolbar-btn" data-cmd="bold" title="Bold (Ctrl+B)"><i data-lucide="bold"></i></button>
                            <button class="toolbar-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i data-lucide="italic"></i></button>
                            <button class="toolbar-btn" data-cmd="underline" title="Underline (Ctrl+U)"><i data-lucide="underline"></i></button>
                            <button class="toolbar-btn" data-cmd="strikeThrough" title="Strikethrough"><i data-lucide="strikethrough"></i></button>
                        </div>
                        <div class="toolbar-separator"></div>
                        <div class="toolbar-group">
                            <button class="toolbar-btn" data-cmd="justifyLeft" title="Align Left"><i data-lucide="align-left"></i></button>
                            <button class="toolbar-btn" data-cmd="justifyCenter" title="Align Center"><i data-lucide="align-center"></i></button>
                            <button class="toolbar-btn" data-cmd="justifyRight" title="Align Right"><i data-lucide="align-right"></i></button>
                            <button class="toolbar-btn" data-cmd="justifyFull" title="Justify"><i data-lucide="align-justify"></i></button>
                        </div>
                        <div class="toolbar-separator"></div>
                        <div class="toolbar-group">
                            <button class="toolbar-btn" data-cmd="insertUnorderedList" title="Bullet List"><i data-lucide="list"></i></button>
                            <button class="toolbar-btn" data-cmd="insertOrderedList" title="Numbered List"><i data-lucide="list-ordered"></i></button>
                            <button class="toolbar-btn" data-cmd="indent" title="Indent"><i data-lucide="indent"></i></button>
                            <button class="toolbar-btn" data-cmd="outdent" title="Outdent"><i data-lucide="outdent"></i></button>
                        </div>
                        <div class="toolbar-separator"></div>
                        
                        <!-- Paragraph Style Popup -->
                        <div class="toolbar-group">
                            <div class="toolbar-btn-container" id="paragraph-popup-container">
                                <button class="toolbar-btn toolbar-btn-with-arrow" id="paragraph-popup-btn" title="Paragraph Style">
                                    <i data-lucide="pilcrow"></i>
                                    <i data-lucide="chevron-down" class="arrow-icon"></i>
                                </button>
                                <div class="liquid-popup paragraph-selector-popup" id="paragraph-popup">
                                    <div class="popup-title">Paragraph Style</div>
                                    <div class="paragraph-list">
                                        <div class="paragraph-option active" data-format="p">
                                            <span class="para-label">Normal</span>
                                            <i data-lucide="check" class="check-icon"></i>
                                        </div>
                                        <div class="paragraph-option h1" data-format="h1">
                                            <span class="para-label">Heading 1</span>
                                            <i data-lucide="check" class="check-icon"></i>
                                        </div>
                                        <div class="paragraph-option h2" data-format="h2">
                                            <span class="para-label">Heading 2</span>
                                            <i data-lucide="check" class="check-icon"></i>
                                        </div>
                                        <div class="paragraph-option h3" data-format="h3">
                                            <span class="para-label">Heading 3</span>
                                            <i data-lucide="check" class="check-icon"></i>
                                        </div>
                                        <div class="paragraph-option" data-format="blockquote">
                                            <span class="para-label">Quote</span>
                                            <i data-lucide="check" class="check-icon"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Font Selector Popup -->
                        <div class="toolbar-group">
                            <div class="toolbar-btn-container" id="font-popup-container">
                                <button class="toolbar-btn toolbar-btn-with-arrow" id="font-popup-btn" title="Font Family">
                                    <i data-lucide="type"></i>
                                    <i data-lucide="chevron-down" class="arrow-icon"></i>
                                </button>
                                <div class="liquid-popup font-selector-popup" id="font-popup">
                                    <div class="font-search">
                                        <i data-lucide="search"></i>
                                        <input type="text" placeholder="Search fonts..." id="font-search-input">
                                    </div>
                                    <div class="font-list" id="font-list">
                                        <div class="font-option active" data-font="Inter" style="font-family: Inter">
                                            <span class="font-name">Inter</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                        <div class="font-option" data-font="Arial" style="font-family: Arial">
                                            <span class="font-name">Arial</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                        <div class="font-option" data-font="Georgia" style="font-family: Georgia">
                                            <span class="font-name">Georgia</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                        <div class="font-option" data-font="Times New Roman" style="font-family: 'Times New Roman'">
                                            <span class="font-name">Times New Roman</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                        <div class="font-option" data-font="Courier New" style="font-family: 'Courier New'">
                                            <span class="font-name">Courier New</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                        <div class="font-option" data-font="Verdana" style="font-family: Verdana">
                                            <span class="font-name">Verdana</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                        <div class="font-option" data-font="Comic Sans MS" style="font-family: 'Comic Sans MS'">
                                            <span class="font-name">Comic Sans</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                        <div class="font-option" data-font="Trebuchet MS" style="font-family: 'Trebuchet MS'">
                                            <span class="font-name">Trebuchet MS</span>
                                            <i data-lucide="check"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Text Size Popup -->
                        <div class="toolbar-group">
                            <div class="toolbar-btn-container" id="size-popup-container">
                                <button class="toolbar-btn toolbar-btn-with-arrow" id="size-popup-btn" title="Text Size">
                                    <i data-lucide="a-large-small"></i>
                                    <i data-lucide="chevron-down" class="arrow-icon"></i>
                                </button>
                                <div class="liquid-popup size-selector-popup" id="size-popup">
                                    <div class="popup-title">Text Size</div>
                                    <div class="size-slider-container">
                                        <div class="size-slider-header">
                                            <span class="size-label">Size</span>
                                            <span class="size-value" id="size-value">16px</span>
                                        </div>
                                        <input type="range" class="size-slider" id="size-slider" min="10" max="48" value="16">
                                    </div>
                                    <div class="size-presets">
                                        <button class="size-preset" data-size="12">12</button>
                                        <button class="size-preset active" data-size="16">16</button>
                                        <button class="size-preset" data-size="20">20</button>
                                        <button class="size-preset" data-size="24">24</button>
                                        <button class="size-preset" data-size="32">32</button>
                                        <button class="size-preset" data-size="40">40</button>
                                        <button class="size-preset" data-size="48">48</button>
                                        <button class="size-preset" data-size="64">64</button>
                                    </div>
                                    <div class="size-preview" id="size-preview" style="font-size: 16px;">Preview Text</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="toolbar-separator"></div>
                        
                        <!-- Text Color Popup -->
                        <div class="toolbar-group">
                            <div class="toolbar-btn-container" id="text-color-popup-container">
                                <button class="toolbar-btn toolbar-btn-with-arrow" id="text-color-popup-btn" title="Text Color">
                                    <i data-lucide="baseline"></i>
                                    <div class="toolbar-color-indicator" id="text-color-indicator" style="background: #ffffff;"></div>
                                    <i data-lucide="chevron-down" class="arrow-icon"></i>
                                </button>
                                <div class="liquid-popup color-picker-popup" id="text-color-popup">
                                    <div class="popup-title"><i data-lucide="palette"></i> Text Color</div>
                                    <div class="color-preview-bar">
                                        <div class="color-preview-swatch" id="text-color-preview" style="background: #ffffff;"></div>
                                    </div>
                                    <div class="color-presets" id="text-color-presets">
                                        <button class="color-preset" data-color="#ffffff" style="background: #ffffff;"></button>
                                        <button class="color-preset" data-color="#000000" style="background: #000000;"></button>
                                        <button class="color-preset" data-color="#636e72" style="background: #636e72;"></button>
                                        <button class="color-preset" data-color="#b2bec3" style="background: #b2bec3;"></button>
                                        <button class="color-preset" data-color="#ff6b6b" style="background: #ff6b6b;"></button>
                                        <button class="color-preset" data-color="#ee5a24" style="background: #ee5a24;"></button>
                                        <button class="color-preset" data-color="#ffa502" style="background: #ffa502;"></button>
                                        <button class="color-preset" data-color="#ffd93d" style="background: #ffd93d;"></button>
                                        <button class="color-preset" data-color="#6bcb77" style="background: #6bcb77;"></button>
                                        <button class="color-preset" data-color="#1dd1a1" style="background: #1dd1a1;"></button>
                                        <button class="color-preset" data-color="#00cec9" style="background: #00cec9;"></button>
                                        <button class="color-preset" data-color="#74b9ff" style="background: #74b9ff;"></button>
                                        <button class="color-preset" data-color="#4d96ff" style="background: #4d96ff;"></button>
                                        <button class="color-preset" data-color="#6c5ce7" style="background: #6c5ce7;"></button>
                                        <button class="color-preset" data-color="#9b59b6" style="background: #9b59b6;"></button>
                                        <button class="color-preset" data-color="#e84393" style="background: #e84393;"></button>
                                        <button class="color-preset" data-color="#fd79a8" style="background: #fd79a8;"></button>
                                        <button class="color-preset" data-color="#fab1a0" style="background: #fab1a0;"></button>
                                        <button class="color-preset" data-color="#ffeaa7" style="background: #ffeaa7;"></button>
                                        <button class="color-preset" data-color="#55efc4" style="background: #55efc4;"></button>
                                    </div>
                                    <div class="rgb-inputs-container">
                                        <div class="rgb-input-group">
                                            <input type="number" id="text-r-input" min="0" max="255" value="255">
                                            <label class="r">R</label>
                                        </div>
                                        <div class="rgb-input-group">
                                            <input type="number" id="text-g-input" min="0" max="255" value="255">
                                            <label class="g">G</label>
                                        </div>
                                        <div class="rgb-input-group">
                                            <input type="number" id="text-b-input" min="0" max="255" value="255">
                                            <label class="b">B</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Highlight Color Popup -->
                            <div class="toolbar-btn-container" id="highlight-color-popup-container">
                                <button class="toolbar-btn toolbar-btn-with-arrow" id="highlight-color-popup-btn" title="Highlight Color">
                                    <i data-lucide="highlighter"></i>
                                    <div class="toolbar-color-indicator" id="highlight-color-indicator" style="background: #ffff00;"></div>
                                    <i data-lucide="chevron-down" class="arrow-icon"></i>
                                </button>
                                <div class="liquid-popup color-picker-popup" id="highlight-color-popup">
                                    <div class="popup-title"><i data-lucide="highlighter"></i> Highlight</div>
                                    <div class="color-preview-bar">
                                        <div class="color-preview-swatch" id="highlight-color-preview" style="background: #ffff00;"></div>
                                    </div>
                                    <div class="color-presets" id="highlight-color-presets">
                                        <button class="color-preset" data-color="#ffff00" style="background: #ffff00;"></button>
                                        <button class="color-preset" data-color="#00ff00" style="background: #00ff00;"></button>
                                        <button class="color-preset" data-color="#00ffff" style="background: #00ffff;"></button>
                                        <button class="color-preset" data-color="#ff00ff" style="background: #ff00ff;"></button>
                                        <button class="color-preset" data-color="#ff6b6b" style="background: #ff6b6b;"></button>
                                        <button class="color-preset" data-color="#ffa502" style="background: #ffa502;"></button>
                                        <button class="color-preset" data-color="#6bcb77" style="background: #6bcb77;"></button>
                                        <button class="color-preset" data-color="#4d96ff" style="background: #4d96ff;"></button>
                                        <button class="color-preset" data-color="#dfe6e9" style="background: #dfe6e9;"></button>
                                        <button class="color-preset" data-color="#b2bec3" style="background: #b2bec3;"></button>
                                        <button class="color-preset" data-color="#ffeaa7" style="background: #ffeaa7;"></button>
                                        <button class="color-preset" data-color="#81ecec" style="background: #81ecec;"></button>
                                        <button class="color-preset" data-color="#fab1a0" style="background: #fab1a0;"></button>
                                        <button class="color-preset" data-color="#a29bfe" style="background: #a29bfe;"></button>
                                        <button class="color-preset" data-color="#fd79a8" style="background: #fd79a8;"></button>
                                        <button class="color-preset" data-color="#74b9ff" style="background: #74b9ff;"></button>
                                    </div>
                                    <div class="rgb-inputs-container">
                                        <div class="rgb-input-group">
                                            <input type="number" id="highlight-r-input" min="0" max="255" value="255">
                                            <label class="r">R</label>
                                        </div>
                                        <div class="rgb-input-group">
                                            <input type="number" id="highlight-g-input" min="0" max="255" value="255">
                                            <label class="g">G</label>
                                        </div>
                                        <div class="rgb-input-group">
                                            <input type="number" id="highlight-b-input" min="0" max="255" value="0">
                                            <label class="b">B</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="toolbar-separator"></div>
                        <div class="toolbar-group">
                            <button class="toolbar-btn" data-cmd="removeFormat" title="Clear Formatting"><i data-lucide="eraser"></i></button>
                            <button class="toolbar-btn" data-cmd="undo" title="Undo"><i data-lucide="undo"></i></button>
                            <button class="toolbar-btn" data-cmd="redo" title="Redo"><i data-lucide="redo"></i></button>
                        </div>
                    </div>
                    
                    <!-- Rich Text Editor (contenteditable) -->
                    <div class="note-content-editor" id="note-content" contenteditable="true" placeholder="Start writing your document...">${state.currentNote?.content || ''}</div>
                    
                    <div class="note-footer">
                        <span class="note-date">Last edited: ${state.currentNote ? new Date(state.currentNote.updatedAt).toLocaleString() : 'Never'}</span>
                        <div class="note-footer-actions">
                            <button class="footer-btn" id="export-note-btn" title="Export"><i data-lucide="download"></i></button>
                            <button class="footer-btn danger" id="delete-note-btn" title="Delete"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;
}

// Helper functions
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

window.backToNotesList = function () {
    document.querySelector('.notepad-container')?.classList.remove('show-editor');
};

function initNotepadEvents() {
    // New document - always add to "All Notes" folder
    document.getElementById('new-note-btn')?.addEventListener('click', () => {
        const note = { id: Date.now(), title: '', content: '', tags: [], folderId: 'default', updatedAt: new Date().toISOString() };
        state.notes.unshift(note); state.currentNote = note;
        // Ensure default folder is expanded
        if (!state.expandedFolders.includes('default')) {
            state.expandedFolders.push('default');
        }
        saveState(); renderApp();
    });

    // New folder - open custom modal
    document.getElementById('new-folder-btn')?.addEventListener('click', () => {
        openModal('folder-modal');
    });

    // Title input
    document.getElementById('note-title')?.addEventListener('input', (e) => {
        if (state.currentNote) { state.currentNote.title = e.target.value; state.currentNote.updatedAt = new Date().toISOString(); saveState(); updateNotesList(); }
    });

    // Rich text editor content
    const editor = document.getElementById('note-content');
    editor?.addEventListener('input', () => {
        if (state.currentNote) { state.currentNote.content = editor.innerHTML; state.currentNote.updatedAt = new Date().toISOString(); saveState(); }
    });

    // Toolbar buttons
    document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.execCommand(btn.dataset.cmd, false, null);
            editor?.focus();
        });
    });

    // =============================================
    // LIQUID GLASS POPUP EVENT HANDLERS
    // =============================================

    // Store saved selection to restore after popup interactions
    let savedSelection = null;

    function saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            savedSelection = selection.getRangeAt(0).cloneRange();
        }
    }

    function restoreSelection() {
        if (savedSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(savedSelection);
        }
    }

    // Close all popups function
    function closeAllPopups() {
        document.querySelectorAll('.liquid-popup').forEach(popup => popup.classList.remove('active'));
        document.querySelectorAll('.toolbar-btn-container').forEach(container => container.classList.remove('active'));
    }

    // Close all popups when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.toolbar-btn-container') && !e.target.closest('.liquid-popup')) {
            closeAllPopups();
        }
    });

    // Generic popup toggle function
    function setupPopupToggle(btnId, popupId, containerId) {
        const btn = document.getElementById(btnId);
        const popup = document.getElementById(popupId);
        const container = document.getElementById(containerId);

        btn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Save current selection before opening popup
            saveSelection();

            const isCurrentlyActive = popup?.classList.contains('active');

            // Close all popups first
            closeAllPopups();

            // Toggle this popup (open if was closed)
            if (!isCurrentlyActive) {
                popup?.classList.add('active');
                container?.classList.add('active');
            }
        });
    }

    // Setup all popup toggles
    setupPopupToggle('paragraph-popup-btn', 'paragraph-popup', 'paragraph-popup-container');
    setupPopupToggle('font-popup-btn', 'font-popup', 'font-popup-container');
    setupPopupToggle('size-popup-btn', 'size-popup', 'size-popup-container');
    setupPopupToggle('text-color-popup-btn', 'text-color-popup', 'text-color-popup-container');
    setupPopupToggle('highlight-color-popup-btn', 'highlight-color-popup', 'highlight-color-popup-container');

    // Prevent popup clicks from closing
    document.querySelectorAll('.liquid-popup').forEach(popup => {
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Paragraph style selection
    document.getElementById('paragraph-popup')?.addEventListener('click', (e) => {
        const option = e.target.closest('.paragraph-option');
        if (option) {
            const format = option.dataset.format;
            restoreSelection();
            document.execCommand('formatBlock', false, format);
            // Update active state
            document.querySelectorAll('.paragraph-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            closeAllPopups();
            editor?.focus();
        }
    });

    // Font family selection - FIXED
    document.getElementById('font-list')?.addEventListener('click', (e) => {
        const option = e.target.closest('.font-option');
        if (option) {
            const font = option.dataset.font;
            restoreSelection();

            // Use execCommand for font change
            document.execCommand('fontName', false, font);

            // Update active state
            document.querySelectorAll('.font-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            closeAllPopups();
            editor?.focus();

            // Save note content
            if (state.currentNote) {
                state.currentNote.content = editor.innerHTML;
                state.currentNote.updatedAt = new Date().toISOString();
                saveState();
            }
        }
    });

    // Font search
    document.getElementById('font-search-input')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.font-option').forEach(option => {
            const fontName = option.dataset.font.toLowerCase();
            option.style.display = fontName.includes(query) ? '' : 'none';
        });
    });

    // Prevent font search from losing selection
    document.getElementById('font-search-input')?.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    // Text size slider - FIXED v2
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    const sizePreview = document.getElementById('size-preview');
    let lastAppliedSize = '16';

    function applyFontSize(size) {
        restoreSelection();

        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            // Use execCommand with a different approach - delete and wrap
            const range = selection.getRangeAt(0);

            // Get the selected text content
            const selectedContent = range.extractContents();

            // Create wrapper span
            const span = document.createElement('span');
            span.style.fontSize = size + 'px';
            span.appendChild(selectedContent);

            // Insert the wrapped content
            range.insertNode(span);

            // Re-select the span contents so user can apply more changes
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);

            // Save this new selection
            savedSelection = newRange.cloneRange();
            lastAppliedSize = size;
        }

        editor?.focus();

        // Save note content
        if (state.currentNote && editor) {
            state.currentNote.content = editor.innerHTML;
            state.currentNote.updatedAt = new Date().toISOString();
            saveState();
        }
    }

    // Update display while sliding, apply on release
    sizeSlider?.addEventListener('input', (e) => {
        const size = e.target.value;
        if (sizeValue) sizeValue.textContent = size + 'px';
        if (sizePreview) sizePreview.style.fontSize = size + 'px';

        // Update preset active state
        document.querySelectorAll('.size-preset').forEach(p => {
            p.classList.toggle('active', p.dataset.size === size);
        });
    });

    // Apply size on mouseup (slider release)
    sizeSlider?.addEventListener('mouseup', (e) => {
        applyFontSize(e.target.value);
    });

    // Also apply on change for keyboard/touch
    sizeSlider?.addEventListener('change', (e) => {
        if (e.target.value !== lastAppliedSize) {
            applyFontSize(e.target.value);
        }
    });

    // Size presets - FIXED v2 with re-selection
    document.querySelectorAll('.size-preset').forEach(preset => {
        preset.addEventListener('click', (e) => {
            e.stopPropagation();
            const size = preset.dataset.size;
            if (sizeSlider) sizeSlider.value = size;
            if (sizeValue) sizeValue.textContent = size + 'px';
            if (sizePreview) sizePreview.style.fontSize = size + 'px';

            // Update active state
            document.querySelectorAll('.size-preset').forEach(p => p.classList.remove('active'));
            preset.classList.add('active');

            applyFontSize(size);
        });
    });

    // =============================================
    // COLOR PICKER - SIMPLIFIED (Presets + RGB only)
    // =============================================

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
    }

    // Simplified color picker - just presets and RGB inputs
    function setupColorPicker(prefix, command) {
        const preview = document.getElementById(`${prefix}-color-preview`);
        const indicator = document.getElementById(`${prefix}-color-indicator`);
        const rInput = document.getElementById(`${prefix}-r-input`);
        const gInput = document.getElementById(`${prefix}-g-input`);
        const bInput = document.getElementById(`${prefix}-b-input`);
        const presets = document.getElementById(`${prefix}-color-presets`);

        let currentColor = prefix === 'highlight' ? '#ffff00' : '#ffffff';

        function updateColorDisplay(r, g, b) {
            currentColor = rgbToHex(r, g, b);
            if (preview) preview.style.background = currentColor;
            if (indicator) indicator.style.background = currentColor;
            if (rInput) rInput.value = r;
            if (gInput) gInput.value = g;
            if (bInput) bInput.value = b;
        }

        function applyColor() {
            restoreSelection();
            document.execCommand(command, false, currentColor);

            // Save note content
            if (state.currentNote && editor) {
                state.currentNote.content = editor.innerHTML;
                state.currentNote.updatedAt = new Date().toISOString();
                saveState();
            }
        }

        // Color presets
        presets?.addEventListener('click', (e) => {
            e.stopPropagation();
            const preset = e.target.closest('.color-preset');
            if (preset) {
                currentColor = preset.dataset.color;

                // Parse hex to RGB
                const r = parseInt(currentColor.slice(1, 3), 16);
                const g = parseInt(currentColor.slice(3, 5), 16);
                const b = parseInt(currentColor.slice(5, 7), 16);

                updateColorDisplay(r, g, b);
                applyColor();
            }
        });

        // RGB inputs
        [rInput, gInput, bInput].forEach(input => {
            input?.addEventListener('input', () => {
                const r = Math.max(0, Math.min(255, parseInt(rInput?.value) || 0));
                const g = Math.max(0, Math.min(255, parseInt(gInput?.value) || 0));
                const b = Math.max(0, Math.min(255, parseInt(bInput?.value) || 0));

                updateColorDisplay(r, g, b);
                applyColor();
            });

            input?.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });
    }

    // Initialize both color pickers
    setupColorPicker('text', 'foreColor');
    setupColorPicker('highlight', 'hiliteColor');

    // Keyboard shortcuts
    editor?.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b': e.preventDefault(); document.execCommand('bold'); break;
                case 'i': e.preventDefault(); document.execCommand('italic'); break;
                case 'u': e.preventDefault(); document.execCommand('underline'); break;
            }
        }
    });

    // Delete note
    document.getElementById('delete-note-btn')?.addEventListener('click', () => {
        if (state.currentNote && confirm('Delete this document?')) {
            state.notes = state.notes.filter(n => n.id !== state.currentNote.id);
            state.currentNote = state.notes[0] || null;
            saveState(); renderApp();
        }
    });

    // Export note
    document.getElementById('export-note-btn')?.addEventListener('click', () => {
        if (state.currentNote) {
            const blob = new Blob([state.currentNote.content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${state.currentNote.title || 'document'}.html`;
            a.click(); URL.revokeObjectURL(url);
        }
    });

    // Note tags container - use event delegation for dynamic buttons
    document.getElementById('note-tags')?.addEventListener('click', (e) => {
        // Add tag button
        const addBtn = e.target.closest('.add-tag-btn');
        if (addBtn) {
            openModal('tag-modal');
            return;
        }

        // Remove tag from current note
        const removeBtn = e.target.closest('.remove-tag-btn');
        if (removeBtn && state.currentNote) {
            const tagName = removeBtn.dataset.tag;
            state.currentNote.tags = state.currentNote.tags.filter(t => t !== tagName);
            saveState();
            updateNoteTagsDisplay();
        }
    });

    // Tag filter click - filter notes by tag (like manga genres)
    document.getElementById('tags-filter')?.addEventListener('click', (e) => {
        // Delete tag globally
        const deleteBtn = e.target.closest('.delete-tag-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const tagName = deleteBtn.dataset.tag;
            showConfirmModal(
                'Delete Tag',
                `Delete tag "${tagName}" from all documents?`,
                () => {
                    // Remove tag from global list
                    state.tags = state.tags.filter(t => t.name !== tagName);
                    // Remove tag from all notes
                    state.notes.forEach(note => {
                        if (note.tags) note.tags = note.tags.filter(t => t !== tagName);
                    });
                    // Reset filter if we were filtering by this tag
                    if (state.currentTagFilter === tagName) state.currentTagFilter = 'all';
                    saveState();
                    renderApp();
                }
            );
            return;
        }

        // Filter by tag
        const tagBtn = e.target.closest('.tag-btn');
        if (tagBtn) {
            const tagName = tagBtn.dataset.tag;
            state.currentTagFilter = tagName;
            renderApp();
        }
    });

    // Note selection (from accordion folders)
    document.getElementById('folders-list')?.addEventListener('click', (e) => {
        // Note delete button click
        const noteDeleteBtn = e.target.closest('.note-delete-btn');
        if (noteDeleteBtn) {
            e.stopPropagation();
            const noteId = parseInt(noteDeleteBtn.dataset.noteId);
            const note = state.notes.find(n => n.id === noteId);
            showConfirmModal(
                'Delete Document',
                `Delete "${note?.title || 'Untitled'}"? This cannot be undone.`,
                () => {
                    state.notes = state.notes.filter(n => n.id !== noteId);
                    if (state.currentNote?.id === noteId) {
                        state.currentNote = state.notes[0] || null;
                    }
                    saveState();
                    renderApp();
                }
            );
            return;
        }

        // Note item click
        const noteItem = e.target.closest('.note-item');
        if (noteItem) {
            const noteId = parseInt(noteItem.dataset.id);
            state.currentNote = state.notes.find(n => n.id === noteId);
            // Update active state without full re-render
            document.querySelectorAll('.note-item').forEach(el => el.classList.remove('active'));
            noteItem.classList.add('active');
            // Update editor content
            document.getElementById('note-title').value = state.currentNote?.title || '';
            document.getElementById('note-content').innerHTML = state.currentNote?.content || '';
            // Update note tags display
            updateNoteTagsDisplay();

            // Mobile: Show Editor
            document.querySelector('.notepad-container')?.classList.add('show-editor');
            return;
        }

        // Folder add-note button click
        const folderAddNoteBtn = e.target.closest('.folder-add-note-btn');
        if (folderAddNoteBtn) {
            e.stopPropagation();
            const folderId = folderAddNoteBtn.dataset.folder;
            const newNote = { id: Date.now(), title: '', content: '', tags: [], folderId, createdAt: Date.now(), updatedAt: Date.now() };
            state.notes.unshift(newNote);
            state.currentNote = newNote;
            // Ensure folder is expanded
            if (!state.expandedFolders.includes(folderId)) {
                state.expandedFolders.push(folderId);
            }
            saveState();
            renderApp();
            // Focus on title
            setTimeout(() => document.getElementById('note-title')?.focus(), 100);
            return;
        }

        // Folder delete button click
        const folderDeleteBtn = e.target.closest('.folder-delete-btn');
        if (folderDeleteBtn) {
            e.stopPropagation();
            const folderId = folderDeleteBtn.dataset.folder;
            const folder = state.folders.find(f => f.id === folderId);
            showConfirmModal(
                'Delete Folder',
                `Delete "${folder?.name || 'this folder'}"? Notes will be moved to All Notes.`,
                () => {
                    // Move notes to default folder
                    state.notes.forEach(n => {
                        if (n.folderId === folderId) n.folderId = 'default';
                    });
                    // Remove folder
                    state.folders = state.folders.filter(f => f.id !== folderId);
                    state.expandedFolders = state.expandedFolders.filter(id => id !== folderId);
                    saveState();
                    renderApp();
                }
            );
            return;
        }

        // Folder header click - toggle expand/collapse (NO full re-render)
        const folderHeader = e.target.closest('.folder-header');
        if (folderHeader) {
            const folderId = folderHeader.dataset.folder;
            const folderAccordion = folderHeader.closest('.folder-accordion');
            const folderContent = folderAccordion?.querySelector('.folder-content');
            const chevron = folderHeader.querySelector('.folder-chevron');
            const folderIcon = folderHeader.querySelector('.folder-icon');

            state.expandedFolders = state.expandedFolders || ['default'];

            if (state.expandedFolders.includes(folderId)) {
                // Collapse
                state.expandedFolders = state.expandedFolders.filter(id => id !== folderId);
                folderHeader.classList.remove('expanded');
                folderContent?.classList.remove('expanded');
                if (chevron) chevron.setAttribute('data-lucide', 'chevron-right');
                if (folderIcon) folderIcon.setAttribute('data-lucide', 'folder');
            } else {
                // Expand
                state.expandedFolders.push(folderId);
                folderHeader.classList.add('expanded');
                folderContent?.classList.add('expanded');
                if (chevron) chevron.setAttribute('data-lucide', 'chevron-down');
                if (folderIcon) folderIcon.setAttribute('data-lucide', 'folder-open');
            }
            // Re-render just the icons
            lucide.createIcons();
            saveState();
        }
    });

    // Search
    document.getElementById('notes-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.note-item').forEach(item => {
            const note = state.notes.find(n => n.id === parseInt(item.dataset.id));
            const matches = (note.title + stripHtml(note.content)).toLowerCase().includes(query);
            item.style.display = matches ? '' : 'none';
        });
    });

    // Drag and drop for notes
    initHyperOptimizedDragDrop();
}

function initNoteDragDrop() {
    const foldersList = document.getElementById('folders-list');
    if (!foldersList) return;

    // Shared State
    let draggedNoteId = null;
    let draggedElement = null;
    let dragGhost = null;
    let startX = 0, startY = 0;
    let isDragging = false;
    let edgeScrollInterval = null;
    let longPressTimer = null; // For Mobile

    // Helper: Create Ghost
    function createDragGhost(noteItem, x, y) {
        const ghost = noteItem.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: ${noteItem.offsetWidth}px;
            opacity: 0.8;
            pointer-events: none;
            z-index: 9999;
            transform: translate(${x - 50}px, ${y - 20}px) rotate(2deg);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            will-change: transform;
        `;
        document.body.appendChild(ghost);
        return ghost;
    }

    // --- SHARED LOGIC ---

    function moveDragLogic(clientX, clientY) {
        if (!isDragging || !dragGhost) return;

        // Move ghost
        dragGhost.style.transform = `translate(${clientX - 50}px, ${clientY - 20}px) rotate(2deg)`;

        // Edge scroll
        const foldersRect = foldersList.getBoundingClientRect();
        const maxScrollSpeed = 12;
        const edgeThreshold = 80;

        if (edgeScrollInterval) {
            clearInterval(edgeScrollInterval);
            edgeScrollInterval = null;
        }

        if (clientY > foldersRect.top && clientY < foldersRect.bottom) {
            const distFromTop = clientY - foldersRect.top;
            const distFromBottom = foldersRect.bottom - clientY;

            if (distFromTop < edgeThreshold) {
                const speed = maxScrollSpeed * (1 - distFromTop / edgeThreshold);
                edgeScrollInterval = setInterval(() => { foldersList.scrollTop -= Math.max(1, speed); }, 16);
            } else if (distFromBottom < edgeThreshold) {
                const speed = maxScrollSpeed * (1 - distFromBottom / edgeThreshold);
                edgeScrollInterval = setInterval(() => { foldersList.scrollTop += Math.max(1, speed); }, 16);
            }
        }

        // Highlight Drop Target
        const elemBelow = document.elementFromPoint(clientX, clientY);
        const folderHeader = elemBelow?.closest('.folder-header');
        const folderContent = elemBelow?.closest('.folder-content');
        const noteItem = elemBelow?.closest('.note-item');

        let targetHeader = null;
        if (folderHeader) {
            targetHeader = folderHeader;
        } else if (noteItem && noteItem !== draggedElement) {
            targetHeader = noteItem.closest('.folder-accordion')?.querySelector('.folder-header');
        } else if (folderContent) {
            targetHeader = folderContent.closest('.folder-accordion')?.querySelector('.folder-header');
        }

        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        if (targetHeader) targetHeader.classList.add('drag-over');
    }

    function endDragLogic(clientX, clientY) {
        if (isDragging && draggedNoteId) {
            const elemBelow = document.elementFromPoint(clientX, clientY);
            const folderHeader = elemBelow?.closest('.folder-header');
            const folderContent = elemBelow?.closest('.folder-content');
            const noteItem = elemBelow?.closest('.note-item');

            let targetFolderId = null;
            let targetAccordion = null;

            if (folderHeader) {
                targetFolderId = folderHeader.dataset.folder;
                targetAccordion = folderHeader.closest('.folder-accordion');
            } else if (noteItem && noteItem !== draggedElement) {
                targetAccordion = noteItem.closest('.folder-accordion');
                targetFolderId = targetAccordion?.dataset.folder;
            } else if (folderContent) {
                targetFolderId = folderContent.dataset.folder;
                targetAccordion = folderContent.closest('.folder-accordion');
            }

            if (targetFolderId) {
                const note = state.notes.find(n => n.id === draggedNoteId);
                if (note && note.folderId !== targetFolderId && draggedElement) {
                    note.folderId = targetFolderId;

                    // Expand target folder
                    if (!state.expandedFolders.includes(targetFolderId)) {
                        state.expandedFolders.push(targetFolderId);
                        const targetHeader = targetAccordion?.querySelector('.folder-header');
                        const targetContent = targetAccordion?.querySelector('.folder-content');
                        if (targetContent && targetHeader) {
                            targetHeader.classList.add('expanded');
                            targetContent.classList.add('expanded');
                        }
                    }

                    // Move DOM
                    const targetWrapper = targetAccordion?.querySelector('.folder-content-inner');
                    if (targetWrapper) {
                        const emptyHint = targetWrapper.querySelector('.empty-hint');
                        if (emptyHint) emptyHint.remove();
                        targetWrapper.appendChild(draggedElement);
                    }

                    updateFolderCounts();
                    saveState();
                }
            }
        }

        // Cleanup
        if (dragGhost) { dragGhost.remove(); dragGhost = null; }
        if (draggedElement) draggedElement.classList.remove('dragging');
        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.body.style.userSelect = '';
        document.body.style.overflow = ''; // Restore Scroll
        if (edgeScrollInterval) { clearInterval(edgeScrollInterval); edgeScrollInterval = null; }
        draggedNoteId = null;
        draggedElement = null;
        isDragging = false;
    }

    // --- MOUSE EVENTS ---

    foldersList.addEventListener('mousedown', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn') || e.button !== 0) return;

        startX = e.clientX;
        startY = e.clientY;
        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;
    });

    document.addEventListener('mousemove', (e) => {
        if (!draggedNoteId || !draggedElement) return;

        if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, e.clientX, e.clientY);
            document.body.style.userSelect = 'none';
        }

        if (isDragging) moveDragLogic(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', (e) => {
        endDragLogic(e.clientX, e.clientY);
    });

    // --- TOUCH EVENTS (Long Press) ---

    foldersList.addEventListener('touchstart', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn')) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;

        // Start Long Press Timer (500ms)
        longPressTimer = setTimeout(() => {
            // Trigger Drag
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, startX, startY);

            // Haptic Feedback
            if (navigator.vibrate) navigator.vibrate(50);

            // Lock Scroll
            document.body.style.overflow = 'hidden';

            longPressTimer = null;
        }, 500);
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];

        // If moving while timer is pending => Cancel Timer (It's a scroll)
        if (longPressTimer) {
            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                draggedNoteId = null;
            }
        }

        if (isDragging) {
            e.preventDefault(); // Stop scrolling
            moveDragLogic(touch.clientX, touch.clientY);
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (isDragging) {
            const touch = e.changedTouches[0];
            endDragLogic(touch.clientX, touch.clientY);
        } else {
            // Reset if tap ended without drag
            draggedNoteId = null;
            draggedElement = null;
        }
    });
}

function updateFolderCounts() {
    document.querySelectorAll('.folder-accordion').forEach(accordion => {
        const folderId = accordion.dataset.folder;
        const count = state.notes.filter(n => (n.folderId || 'default') === folderId).length;
        const countEl = accordion.querySelector('.folder-count');
        if (countEl) countEl.textContent = count;
    });
}

function updateNotesList() {
    const item = document.querySelector(`.note-item[data-id="${state.currentNote?.id}"]`);
    if (item) {
        const titleEl = item.querySelector('.note-item-title');
        if (titleEl) titleEl.textContent = state.currentNote.title || 'Untitled';
    }
}

function updateNoteTagsDisplay() {
    const tagsContainer = document.getElementById('note-tags');
    if (!tagsContainer) return;

    const noteTags = (state.currentNote?.tags || []).map(tagName => {
        const tag = state.tags.find(t => t.name === tagName);
        return tag ? `<span class="note-tag" style="background:${tag.color}">${tag.name}<button class="remove-tag-btn" data-tag="${tagName}">×</button></span>` : '';
    }).join('');

    tagsContainer.innerHTML = noteTags + '<button class="add-tag-btn" id="add-tag-btn"><i data-lucide="tag"></i></button>';
    lucide.createIcons();
}

// ========================================
// STICKY NOTES
// ========================================
const stickyColors = ['yellow', 'pink', 'blue', 'green', 'purple'];

function renderStickyNotes() {
    const stickies = state.stickyNotes.map(note => `
        <div class="sticky-note ${note.color}" data-id="${note.id}">
            <div class="sticky-note-header">
                <button class="sticky-color-btn" title="Change Color"><i data-lucide="palette"></i></button>
                <button class="sticky-delete-btn" title="Delete"><i data-lucide="x"></i></button>
            </div>
            <textarea class="sticky-note-content" placeholder="Write something...">${note.content}</textarea>
        </div>
    `).join('');

    return `
        <section class="tool-panel glass wide" id="sticky-notes-panel">
            <div class="panel-header">
                <h2>Sticky Notes</h2>
                <button class="icon-btn" id="add-sticky-btn" title="Add Sticky Note"><i data-lucide="plus"></i></button>
            </div>
            <div class="sticky-notes-container" id="sticky-notes-container">
                ${stickies || '<div class="empty-state"><i data-lucide="sticky-note"></i><p>No sticky notes yet.</p></div>'}
            </div>
        </section>
    `;
}

function initStickyNotesEvents() {
    document.getElementById('add-sticky-btn')?.addEventListener('click', () => {
        state.stickyNotes.push({ id: Date.now(), content: '', color: stickyColors[Math.floor(Math.random() * stickyColors.length)] });
        saveState(); renderApp();
    });
    document.getElementById('sticky-notes-container')?.addEventListener('click', (e) => {
        const sticky = e.target.closest('.sticky-note'); if (!sticky) return;
        const id = parseInt(sticky.dataset.id);
        if (e.target.closest('.sticky-delete-btn')) { state.stickyNotes = state.stickyNotes.filter(n => n.id !== id); saveState(); renderApp(); }
        else if (e.target.closest('.sticky-color-btn')) {
            const note = state.stickyNotes.find(n => n.id === id);
            if (note) { note.color = stickyColors[(stickyColors.indexOf(note.color) + 1) % stickyColors.length]; saveState(); renderApp(); }
        }
    });
    document.getElementById('sticky-notes-container')?.addEventListener('input', (e) => {
        if (e.target.classList.contains('sticky-note-content')) {
            const id = parseInt(e.target.closest('.sticky-note').dataset.id);
            const note = state.stickyNotes.find(n => n.id === id);
            if (note) { note.content = e.target.value; saveState(); }
        }
    });
}

// ========================================
// TO-DO LIST
// ========================================
function renderTodo() {
    const filtered = state.todos.filter(t => state.todoFilter === 'all' || (state.todoFilter === 'active' && !t.completed) || (state.todoFilter === 'completed' && t.completed));
    const items = filtered.map(t => `
        <li class="todo-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
            <div class="todo-checkbox ${t.completed ? 'checked' : ''}">${t.completed ? '<i data-lucide="check"></i>' : ''}</div>
            <span class="todo-text">${t.text}</span>
            <span class="todo-priority-badge ${t.priority}">${t.priority}</span>
            <button class="todo-delete"><i data-lucide="trash-2"></i></button>
        </li>
    `).join('');
    const remaining = state.todos.filter(t => !t.completed).length;

    return `
        <section class="tool-panel glass" id="todo-panel">
            <div class="panel-header">
                <h2>To-Do List</h2>
                <div class="todo-filters">
                    <button class="filter-btn ${state.todoFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                    <button class="filter-btn ${state.todoFilter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
                    <button class="filter-btn ${state.todoFilter === 'completed' ? 'active' : ''}" data-filter="completed">Done</button>
                </div>
            </div>
            <div class="todo-container">
                <div class="todo-input-container">
                    <input type="text" class="todo-input" id="todo-input" placeholder="Add a new task...">
                    
                    <div class="priority-dropdown" id="priority-dropdown">
                        <button class="priority-trigger" id="priority-trigger" data-value="medium">
                            <span class="priority-label">Medium</span>
                            <i data-lucide="chevron-down"></i>
                        </button>
                        <div class="priority-menu" id="priority-menu">
                            <div class="priority-option" data-value="low"><span class="dot low"></span>Low</div>
                            <div class="priority-option selected" data-value="medium"><span class="dot medium"></span>Medium</div>
                            <div class="priority-option" data-value="high"><span class="dot high"></span>High</div>
                        </div>
                    </div>

                    <button class="add-todo-btn" id="add-todo-btn"><i data-lucide="plus"></i></button>
                </div>
                <ul class="todo-list" id="todo-list">${items || '<div class="empty-state"><i data-lucide="check-square"></i><p>No tasks yet.</p></div>'}</ul>
                <div class="todo-footer"><span>${remaining} task${remaining !== 1 ? 's' : ''} remaining</span><button class="clear-completed-btn" id="clear-completed-btn">Clear Completed</button></div>
            </div>
        </section>
    `;
}

function initTodoEvents() {
    const addTodo = () => {
        const input = document.getElementById('todo-input');
        const priorityTrigger = document.getElementById('priority-trigger');
        const priority = priorityTrigger ? priorityTrigger.dataset.value : 'medium';

        if (!input.value.trim()) return;
        state.todos.push({ id: Date.now(), text: input.value.trim(), priority, completed: false });
        input.value = ''; // specific clear to avoid full re-render flickering slightly
        saveState(); renderApp();
        // Re-focus input
        setTimeout(() => document.getElementById('todo-input')?.focus(), 0);
    };

    document.getElementById('add-todo-btn')?.addEventListener('click', addTodo);
    document.getElementById('todo-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTodo(); });
    document.getElementById('clear-completed-btn')?.addEventListener('click', () => { state.todos = state.todos.filter(t => !t.completed); saveState(); renderApp(); });
    document.querySelectorAll('.todo-filters .filter-btn').forEach(btn => btn.addEventListener('click', () => { state.todoFilter = btn.dataset.filter; renderApp(); }));

    document.getElementById('todo-list')?.addEventListener('click', (e) => {
        const item = e.target.closest('.todo-item'); if (!item) return;
        const id = parseInt(item.dataset.id);
        if (e.target.closest('.todo-checkbox')) { const t = state.todos.find(t => t.id === id); if (t) { t.completed = !t.completed; saveState(); renderApp(); } }
        else if (e.target.closest('.todo-delete')) { state.todos = state.todos.filter(t => t.id !== id); saveState(); renderApp(); }
    });

    // Custom Priority Dropdown Events
    const dropdown = document.getElementById('priority-dropdown');
    const trigger = document.getElementById('priority-trigger');
    const menu = document.getElementById('priority-menu');

    if (trigger && menu) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('active');
            trigger.classList.toggle('active');
        });

        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.priority-option');
            if (option) {
                e.stopPropagation();
                const value = option.dataset.value; // low, medium, high
                const label = option.textContent.trim();

                // Update trigger
                trigger.dataset.value = value;
                trigger.querySelector('.priority-label').textContent = option.textContent.trim(); // keep text only

                // Update selection UI
                menu.querySelectorAll('.priority-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                // Close menu
                menu.classList.remove('active');
                trigger.classList.remove('active');
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                menu.classList.remove('active');
                trigger.classList.remove('active');
            }
        });
    }
}

// ========================================
// POMODORO TIMER
// ========================================
let pomodoroInterval = null;
const pomodoroTimes = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };

function renderPomodoro() {
    const mins = Math.floor(state.pomodoro.time / 60);
    const secs = state.pomodoro.time % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const circumference = 2 * Math.PI * 90;
    const progress = 1 - (state.pomodoro.time / pomodoroTimes[state.pomodoro.mode]);
    const labels = { work: 'Focus Time', short: 'Short Break', long: 'Long Break' };

    return `
        <section class="tool-panel glass" id="pomodoro-panel">
            <div class="panel-header"><h2>Pomodoro Timer</h2></div>
            <div class="pomodoro-container">
                <div class="pomodoro-tabs">
                    <button class="pomo-tab ${state.pomodoro.mode === 'work' ? 'active' : ''}" data-mode="work">Focus</button>
                    <button class="pomo-tab ${state.pomodoro.mode === 'short' ? 'active' : ''}" data-mode="short">Short Break</button>
                    <button class="pomo-tab ${state.pomodoro.mode === 'long' ? 'active' : ''}" data-mode="long">Long Break</button>
                </div>
                <div class="pomodoro-timer">
                    <svg class="timer-ring" viewBox="0 0 200 200">
                        <circle class="timer-ring-bg" cx="100" cy="100" r="90"/>
                        <circle class="timer-ring-progress" cx="100" cy="100" r="90" id="timer-progress" style="stroke-dasharray:${circumference};stroke-dashoffset:${circumference * progress}"/>
                    </svg>
                    <div class="timer-display"><span class="timer-time" id="timer-time">${timeStr}</span><span class="timer-label">${labels[state.pomodoro.mode]}</span></div>
                </div>
                <div class="pomodoro-controls">
                    <button class="pomo-btn" id="pomo-start"><i data-lucide="${state.pomodoro.isRunning ? 'pause' : 'play'}"></i><span>${state.pomodoro.isRunning ? 'Pause' : 'Start'}</span></button>
                    <button class="pomo-btn" id="pomo-reset"><i data-lucide="rotate-ccw"></i><span>Reset</span></button>
                </div>
                <div class="pomodoro-stats">
                    <div class="stat-item"><span class="stat-value">${state.pomodoro.sessions}</span><span class="stat-label">Sessions</span></div>
                    <div class="stat-item"><span class="stat-value">${Math.floor(state.pomodoro.totalTime / 60)}m</span><span class="stat-label">Total Focus</span></div>
                </div>
            </div>
        </section>
    `;
}

function initPomodoroEvents() {
    document.getElementById('pomo-start')?.addEventListener('click', () => {
        const btn = document.getElementById('pomo-start');
        if (state.pomodoro.isRunning) {
            clearInterval(pomodoroInterval);
            state.pomodoro.isRunning = false;
            // Update button without re-render
            if (btn) {
                btn.innerHTML = '<i data-lucide="play"></i><span>Start</span>';
                lucide.createIcons();
            }
        } else {
            state.pomodoro.isRunning = true;
            pomodoroInterval = setInterval(tickPomodoro, 1000);
            // Update button without re-render
            if (btn) {
                btn.innerHTML = '<i data-lucide="pause"></i><span>Pause</span>';
                lucide.createIcons();
            }
        }
    });
    document.getElementById('pomo-reset')?.addEventListener('click', () => {
        clearInterval(pomodoroInterval);
        state.pomodoro.time = pomodoroTimes[state.pomodoro.mode];
        state.pomodoro.isRunning = false;
        updatePomodoroDisplay();
        // Update button
        const btn = document.getElementById('pomo-start');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i><span>Start</span>';
            lucide.createIcons();
        }
    });
    document.querySelectorAll('.pomo-tab').forEach(tab => tab.addEventListener('click', () => {
        state.pomodoro.mode = tab.dataset.mode;
        state.pomodoro.time = pomodoroTimes[tab.dataset.mode];
        state.pomodoro.isRunning = false;
        clearInterval(pomodoroInterval);
        // Update tabs active state
        document.querySelectorAll('.pomo-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        // Update display
        updatePomodoroDisplay();
        // Update label
        const labels = { work: 'Focus Time', short: 'Short Break', long: 'Long Break' };
        const labelEl = document.querySelector('.timer-label');
        if (labelEl) labelEl.textContent = labels[state.pomodoro.mode];
        // Update button
        const btn = document.getElementById('pomo-start');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i><span>Start</span>';
            lucide.createIcons();
        }
    }));
}

function tickPomodoro() {
    if (state.pomodoro.time > 0) {
        state.pomodoro.time--;
        if (state.pomodoro.mode === 'work') state.pomodoro.totalTime++;
        updatePomodoroDisplay();
    } else {
        clearInterval(pomodoroInterval); state.pomodoro.isRunning = false;
        if (state.pomodoro.mode === 'work') state.pomodoro.sessions++;
        saveState(); playBeep(); renderApp();
    }
}

function updatePomodoroDisplay() {
    const mins = Math.floor(state.pomodoro.time / 60);
    const secs = state.pomodoro.time % 60;
    const el = document.getElementById('timer-time');
    if (el) el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const circumference = 2 * Math.PI * 90;
    const progress = 1 - (state.pomodoro.time / pomodoroTimes[state.pomodoro.mode]);
    const ring = document.getElementById('timer-progress');
    if (ring) ring.style.strokeDashoffset = circumference * progress;
}

function playBeep() {
    try {
        const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 800; gain.gain.value = 0.3;
        osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch (e) { }
}

// ========================================
// WORLD CLOCK
// ========================================


function startClockInterval() {
    clockInterval = setInterval(updateClocks, 1000);
}

function renderWorldClock() {
    const clocks = state.worldClocks.map(tz => {
        const time = new Date().toLocaleTimeString('en-US', { timeZone: tz.zone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<div class="world-clock-item" data-zone="${tz.zone}">
            <div class="clock-city">${tz.city}, ${tz.country}</div>
            <div class="clock-time" data-zone="${tz.zone}">${time}</div>
            <button class="delete-clock"><i data-lucide="x"></i></button>
        </div>`;
    }).join('');

    return `
        <section class="tool-panel glass" id="world-clock-panel">
            <div class="panel-header"><h2>World Clock</h2><button class="icon-btn" id="add-clock-btn"><i data-lucide="plus"></i></button></div>
            <div class="world-clock-container">
                <div class="local-time glass-light">
                    <div class="clock-label">Local Time</div>
                    <div class="clock-time" id="local-time">${new Date().toLocaleTimeString()}</div>
                    <div class="clock-date" id="local-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div class="world-clocks" id="world-clocks">${clocks}</div>
            </div>
        </section>
    `;
}

function initWorldClockEvents() {
    document.getElementById('add-clock-btn')?.addEventListener('click', () => openModal('clock-modal'));
    document.getElementById('world-clocks')?.addEventListener('click', (e) => {
        if (e.target.closest('.delete-clock')) {
            const zone = e.target.closest('.world-clock-item').dataset.zone;
            state.worldClocks = state.worldClocks.filter(c => c.zone !== zone);
            saveState(); renderApp();
        }
    });
}

function updateClocks() {
    const lt = document.getElementById('local-time');
    const ld = document.getElementById('local-date');
    if (lt) lt.textContent = new Date().toLocaleTimeString();
    if (ld) ld.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    document.querySelectorAll('.world-clock-item .clock-time').forEach(el => {
        if (el.dataset.zone) el.textContent = new Date().toLocaleTimeString('en-US', { timeZone: el.dataset.zone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
}

// ========================================
// CALENDAR
// ========================================


function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthName = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    let days = '';
    for (let i = firstDay - 1; i >= 0; i--) days += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    for (let i = 1; i <= daysInMonth; i++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const holidayName = state.holidays[year] ? state.holidays[year][dateKey] : null;
        const isHoliday = !!holidayName;
        const isToday = isCurrentMonth && today.getDate() === i;

        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (isHoliday) classes += ' holiday';

        // Add holiday text label
        const holidayLabel = isHoliday ? `<div class="holiday-label">${holidayName}</div>` : '';

        days += `<div class="${classes}" title="${holidayName || ''}">
            <span class="day-number">${i}</span>
            ${holidayLabel}
        </div>`;
    }
    const remaining = 42 - (firstDay + daysInMonth);
    for (let i = 1; i <= remaining; i++) days += `<div class="calendar-day other-month">${i}</div>`;

    return `
        <section class="tool-panel glass" id="calendar-panel">
            <div class="panel-header">
                <h2>Calendar</h2>
                <div class="calendar-nav">
                    <button class="icon-btn" id="prev-month"><i data-lucide="chevron-left"></i></button>
                    <span class="calendar-month">${monthName}</span>
                    <button class="icon-btn" id="next-month"><i data-lucide="chevron-right"></i></button>
                </div>
            </div>
            <div class="calendar-container">
                <div class="calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
                <div class="calendar-days">${days}</div>
            </div>
        </section>
    `;
}

function initCalendarEvents() {
    document.getElementById('prev-month')?.addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderApp(); });
    document.getElementById('next-month')?.addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderApp(); });
}

// ========================================
// CURRENCY CONVERTER
// ========================================
// Live rates will be fetched from API
let liveExchangeRates = { ...exchangeRates }; // Fallback to static rates
let ratesLastUpdated = null;

async function fetchLiveRates() {
    try {
        // Using FxRatesAPI with cache busting
        const response = await fetch(`https://api.fxratesapi.com/latest?_=${new Date().getTime()}`);
        if (response.ok) {
            const data = await response.json();
            liveExchangeRates = {
                USD: 1,
                EUR: data.rates.EUR,
                GBP: data.rates.GBP,
                JPY: data.rates.JPY,
                IDR: data.rates.IDR,
                CNY: data.rates.CNY,
                KRW: data.rates.KRW,
                SGD: data.rates.SGD,
                AUD: data.rates.AUD,
                CAD: data.rates.CAD
            };
            // Format time from timestamp if available, otherwise current time
            const date = data.timestamp ? new Date(data.timestamp * 1000) : new Date();
            ratesLastUpdated = date.toLocaleTimeString();
            console.log('Live exchange rates updated (FxRatesAPI):', liveExchangeRates);

            // Update UI if it exists
            const updatedEl = document.getElementById('currency-updated');
            if (updatedEl) updatedEl.textContent = 'Updated: ' + ratesLastUpdated;

            // Trigger recalculation if inputs exist
            if (document.getElementById('currency-amount')) {
                document.getElementById('currency-amount').dispatchEvent(new Event('input'));
            }
        }
    } catch (e) {
        console.log('Exchange rate API failed, using fallback:', e);
        const updatedEl = document.getElementById('currency-updated');
        if (updatedEl) updatedEl.textContent = 'Using cached rates (API failed)';
    }
}

// Fetch rates on load
fetchLiveRates();

function renderCurrency() {
    const opts = Object.keys(liveExchangeRates).map(c => {
        const flags = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', IDR: '🇮🇩', CNY: '🇨🇳', KRW: '🇰🇷', SGD: '🇸🇬', AUD: '🇦🇺', CAD: '🇨🇦' };
        return `<option value="${c}">${flags[c]} ${c}</option>`;
    }).join('');

    return `
        <section class="tool-panel glass" id="currency-panel">
            <div class="panel-header">
                <h2>Currency Converter</h2>
                <button class="icon-btn" id="refresh-rates" title="Refresh Rates"><i data-lucide="refresh-cw"></i></button>
            </div>
            <div class="currency-container">
                <div class="currency-input-group"><label>Amount</label><div class="currency-input-wrapper">
                    <input type="number" class="currency-amount" id="currency-amount" value="1" min="0">
                    <select class="currency-select" id="currency-from">${opts}</select>
                </div></div>
                <button class="swap-currency-btn" id="swap-currency"><i data-lucide="arrow-down-up"></i></button>
                <div class="currency-input-group"><label>Converted To</label><div class="currency-input-wrapper">
                    <div class="currency-result" id="currency-result">0.00</div>
                    <select class="currency-select" id="currency-to">${opts.replace('value="EUR"', 'value="EUR" selected')}</select>
                </div></div>
                <div class="currency-rate" id="currency-rate">1 USD = -- EUR</div>
                <div class="currency-updated" id="currency-updated">${ratesLastUpdated ? 'Updated: ' + ratesLastUpdated : 'Fetching live rates...'}</div>
            </div>
        </section>
    `;
}

function initCurrencyEvents() {
    const convert = () => {
        const amt = parseFloat(document.getElementById('currency-amount')?.value) || 0;
        const from = document.getElementById('currency-from')?.value;
        const to = document.getElementById('currency-to')?.value;
        const result = (amt / liveExchangeRates[from]) * liveExchangeRates[to];
        const rate = (liveExchangeRates[to] / liveExchangeRates[from]).toFixed(4);
        document.getElementById('currency-result').textContent = result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('currency-rate').textContent = `1 ${from} = ${rate} ${to}`;
    };
    document.getElementById('currency-amount')?.addEventListener('input', convert);
    document.getElementById('currency-from')?.addEventListener('change', convert);
    document.getElementById('currency-to')?.addEventListener('change', convert);
    document.getElementById('swap-currency')?.addEventListener('click', () => {
        const from = document.getElementById('currency-from');
        const to = document.getElementById('currency-to');
        const temp = from.value; from.value = to.value; to.value = temp; convert();
    });
    document.getElementById('refresh-rates')?.addEventListener('click', async () => {
        ratesLastUpdated ? 'Updated: ' + ratesLastUpdated : 'Using cached rates';
        setTimeout(() => btn.classList.remove('spinning'), 500);
    });
    convert();
}

// ========================================
// QUICK LINKS
// ========================================
// Icon to color mapping for macOS style
const iconColors = {
    'search': '#4285F4', 'globe': '#34A853', 'github': '#6e5494', 'youtube': '#FF0000',
    'twitter': '#1DA1F2', 'instagram': '#E4405F', 'linkedin': '#0077B5', 'mail': '#EA4335',
    'shopping-cart': '#FF9900', 'book-open': '#6366F1', 'music': '#1DB954', 'film': '#E50914',
    'message-circle': '#25D366', 'cloud': '#0078D4', 'file-text': '#F9AB00', 'code': '#24292E',
    'settings': '#8E8E93', 'folder': '#67B8DE', 'heart': '#FF2D55', 'star': '#FFD60A'
};

function renderQuickLinks() {
    const links = state.quickLinks.map(l => {
        const iconColor = iconColors[l.icon] || '#007AFF';
        return `
            <a href="${l.url}" target="_blank" class="quick-link" data-id="${l.id}">
                <div class="quick-link-icon-wrapper" style="background: ${iconColor}20; border-color: ${iconColor}40">
                    <i data-lucide="${l.icon}" style="color: ${iconColor}"></i>
                </div>
                <span class="quick-link-title">${l.title}</span>
                <button class="quick-link-delete" onclick="event.preventDefault();deleteQuickLink(${l.id})"><i data-lucide="x"></i></button>
            </a>
        `;
    }).join('');

    return `
        <section class="tool-panel glass wide" id="quick-links-panel">
            <div class="panel-header"><h2>Quick Links</h2><button class="icon-btn" id="add-link-btn"><i data-lucide="plus"></i></button></div>
            <div class="quick-links-grid">${links || '<div class="empty-state"><i data-lucide="link"></i><p>No links yet.</p></div>'}</div>
        </section>
    `;
}

function initQuickLinksEvents() {
    document.getElementById('add-link-btn')?.addEventListener('click', () => openModal('link-modal'));
}

window.deleteQuickLink = (id) => { state.quickLinks = state.quickLinks.filter(l => l.id !== id); saveState(); renderApp(); };

// ========================================
// MODALS
// ========================================
function renderModals() {
    const tzItems = timezones.map(tz => `<div class="timezone-item" data-zone="${tz.zone}" data-city="${tz.city}" data-country="${tz.country}"><div class="timezone-item-city">${tz.city}, ${tz.country}</div><div class="timezone-item-zone">${tz.zone}</div></div>`).join('');

    return `
        <div class="modal" id="clock-modal"><div class="modal-content glass">
            <div class="modal-header"><h3>Add World Clock</h3><button class="modal-close" onclick="closeModal('clock-modal')"><i data-lucide="x"></i></button></div>
            <div class="modal-body"><input type="text" class="modal-input" id="timezone-search" placeholder="Search country or city..."><div class="timezone-list" id="timezone-list">${tzItems}</div></div>
        </div></div>
        <div class="modal" id="link-modal"><div class="modal-content glass">
            <div class="modal-header"><h3>Add Quick Link</h3><button class="modal-close" onclick="closeModal('link-modal')"><i data-lucide="x"></i></button></div>
            <div class="modal-body">
                <input type="text" class="modal-input" id="link-title" placeholder="Title">
                <input type="url" class="modal-input" id="link-url" placeholder="URL">
                <p class="picker-label">Choose Icon</p>
                <div class="link-icon-picker" id="link-icon-picker">
                    <button class="icon-option selected" data-icon="globe" style="--icon-color:#34A853"><i data-lucide="globe"></i></button>
                    <button class="icon-option" data-icon="search" style="--icon-color:#4285F4"><i data-lucide="search"></i></button>
                    <button class="icon-option" data-icon="github" style="--icon-color:#6e5494"><i data-lucide="github"></i></button>
                    <button class="icon-option" data-icon="youtube" style="--icon-color:#FF0000"><i data-lucide="youtube"></i></button>
                    <button class="icon-option" data-icon="twitter" style="--icon-color:#1DA1F2"><i data-lucide="twitter"></i></button>
                    <button class="icon-option" data-icon="mail" style="--icon-color:#EA4335"><i data-lucide="mail"></i></button>
                    <button class="icon-option" data-icon="shopping-cart" style="--icon-color:#FF9900"><i data-lucide="shopping-cart"></i></button>
                    <button class="icon-option" data-icon="book-open" style="--icon-color:#6366F1"><i data-lucide="book-open"></i></button>
                    <button class="icon-option" data-icon="music" style="--icon-color:#1DB954"><i data-lucide="music"></i></button>
                    <button class="icon-option" data-icon="film" style="--icon-color:#E50914"><i data-lucide="film"></i></button>
                    <button class="icon-option" data-icon="message-circle" style="--icon-color:#25D366"><i data-lucide="message-circle"></i></button>
                    <button class="icon-option" data-icon="code" style="--icon-color:#24292E"><i data-lucide="code"></i></button>
                </div>
                <button class="modal-submit" id="submit-link">Add Link</button>
            </div>
        </div></div>
        <div class="modal" id="tag-modal"><div class="modal-content glass">
            <div class="modal-header"><h3>Add Tag</h3><button class="modal-close" onclick="closeModal('tag-modal')"><i data-lucide="x"></i></button></div>
            <div class="modal-body">
                <div class="existing-tags-section" id="existing-tags-section">
                    <p class="section-label">Select existing tag:</p>
                    <div class="existing-tags-list" id="existing-tags-list"></div>
                </div>
                <div class="new-tag-section">
                    <p class="section-label">Or create new tag:</p>
                    <input type="text" class="modal-input" id="tag-input" placeholder="Tag name...">
                    <div class="tag-colors"><button class="color-option selected" data-color="#ff6b6b" style="background:#ff6b6b"></button><button class="color-option" data-color="#ffa502" style="background:#ffa502"></button><button class="color-option" data-color="#2ed573" style="background:#2ed573"></button><button class="color-option" data-color="#1e90ff" style="background:#1e90ff"></button><button class="color-option" data-color="#a55eea" style="background:#a55eea"></button></div>
                    <button class="modal-submit" id="submit-tag">Create & Add Tag</button>
                </div>
            </div>
        </div></div>
        <div class="modal" id="folder-modal"><div class="modal-content glass">
            <div class="modal-header"><h3>Create New Folder</h3><button class="modal-close" onclick="closeModal('folder-modal')"><i data-lucide="x"></i></button></div>
            <div class="modal-body">
                <div class="folder-icon-preview"><i data-lucide="folder-plus"></i></div>
                <input type="text" class="modal-input" id="folder-name-input" placeholder="Folder name..." autocomplete="off">
                <button class="modal-submit" id="submit-folder">Create Folder</button>
            </div>
        </div></div>
        <div class="modal" id="confirm-modal"><div class="modal-content glass" style="max-width:400px">
            <div class="modal-header"><h3 id="confirm-title">Confirm</h3><button class="modal-close" onclick="closeModal('confirm-modal')"><i data-lucide="x"></i></button></div>
            <div class="modal-body" style="text-align:center">
                <div class="confirm-icon"><i data-lucide="alert-triangle"></i></div>
                <p id="confirm-message" style="margin-bottom:var(--space-lg)">Are you sure?</p>
                <div class="confirm-buttons">
                    <button class="modal-submit danger" id="confirm-yes">Delete</button>
                    <button class="modal-submit secondary" onclick="closeModal('confirm-modal')">Cancel</button>
                </div>
            </div>
        </div></div>
    `;
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');

        // Special handling for tag modal - populate existing tags
        if (id === 'tag-modal') {
            populateExistingTags();
        }

        // Only init events if not already initialized
        if (!modal.dataset.initialized) {
            initModalEvents(id);
            modal.dataset.initialized = 'true';
        }
        lucide.createIcons();
        // Focus input if exists
        modal.querySelector('input')?.focus();
    }
}

function populateExistingTags() {
    const listEl = document.getElementById('existing-tags-list');
    const sectionEl = document.getElementById('existing-tags-section');
    if (!listEl || !sectionEl) return;

    // Get tags that the current note doesn't have yet
    const noteTags = state.currentNote?.tags || [];
    const availableTags = state.tags.filter(t => !noteTags.includes(t.name));

    if (availableTags.length === 0) {
        sectionEl.style.display = 'none';
    } else {
        sectionEl.style.display = 'block';
        listEl.innerHTML = availableTags.map(tag =>
            `<button class="existing-tag-option" data-tag="${tag.name}" style="background:${tag.color}">${tag.name}</button>`
        ).join('');
    }
}

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        // Clear input values
        modal.querySelectorAll('input').forEach(input => input.value = '');
    }
};

// Custom confirm modal function
let confirmCallback = null;
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = onConfirm;
    openModal('confirm-modal');
    lucide.createIcons();

    // Setup confirm button (only once)
    const confirmBtn = document.getElementById('confirm-yes');
    if (confirmBtn && !confirmBtn.dataset.initialized) {
        confirmBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            closeModal('confirm-modal');
            confirmCallback = null;
        });
        confirmBtn.dataset.initialized = 'true';
    }
}

function initModalEvents(id) {
    const modal = document.getElementById(id);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(id); });

    if (id === 'clock-modal') {
        document.getElementById('timezone-search')?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('.timezone-item').forEach(item => {
                item.style.display = (item.dataset.city.toLowerCase().includes(q) || item.dataset.country.toLowerCase().includes(q)) ? '' : 'none';
            });
        });
        document.querySelectorAll('.timezone-item').forEach(item => item.addEventListener('click', () => {
            if (!state.worldClocks.some(c => c.zone === item.dataset.zone)) {
                state.worldClocks.push({ city: item.dataset.city, country: item.dataset.country, zone: item.dataset.zone });
                saveState();
            }
            closeModal('clock-modal'); renderApp();
        }));
    }

    if (id === 'link-modal') {
        document.querySelectorAll('#link-icon-picker .icon-option').forEach(btn => btn.addEventListener('click', () => {
            document.querySelectorAll('#link-icon-picker .icon-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        }));
        document.getElementById('submit-link')?.addEventListener('click', () => {
            const title = document.getElementById('link-title')?.value;
            const url = document.getElementById('link-url')?.value;
            const icon = document.querySelector('#link-icon-picker .icon-option.selected')?.dataset.icon || '🌐';
            if (title && url) { state.quickLinks.push({ id: Date.now(), title, url, icon }); saveState(); closeModal('link-modal'); renderApp(); }
        });
    }

    if (id === 'tag-modal') {
        // Color selection
        document.querySelectorAll('.tag-colors .color-option').forEach(btn => btn.addEventListener('click', () => {
            document.querySelectorAll('.tag-colors .color-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        }));

        // Handle clicking existing tags
        document.getElementById('existing-tags-list')?.addEventListener('click', (e) => {
            const tagBtn = e.target.closest('.existing-tag-option');
            if (tagBtn) {
                const tagName = tagBtn.dataset.tag;
                if (state.currentNote && tagName) {
                    state.currentNote.tags = state.currentNote.tags || [];
                    if (!state.currentNote.tags.includes(tagName)) {
                        state.currentNote.tags.push(tagName);
                        saveState();
                        renderApp();

                        // FORCE KEEP EDITOR OPEN
                        if (window.innerWidth <= 768) {
                            setTimeout(() => {
                                document.querySelector('.notepad-container')?.classList.add('show-editor');
                            }, 50);
                        }
                    }
                    closeModal('tag-modal');
                }
            }
        });

        // Handle creating new tag
        document.getElementById('submit-tag')?.addEventListener('click', () => {
            const nameInput = document.getElementById('tag-input');
            const name = nameInput?.value?.trim();
            const color = document.querySelector('.tag-colors .color-option.selected')?.dataset.color || '#007AFF';

            if (name) {
                // Check if tag already exists
                const existingTag = state.tags.find(t => t.name.toLowerCase() === name.toLowerCase());

                if (existingTag) {
                    // Tag exists, just add it to note
                    if (state.currentNote) {
                        state.currentNote.tags = state.currentNote.tags || [];
                        if (!state.currentNote.tags.includes(existingTag.name)) {
                            state.currentNote.tags.push(existingTag.name);
                        }
                    }
                } else {
                    // Create new tag
                    state.tags.push({ name, color });
                    if (state.currentNote) {
                        state.currentNote.tags = state.currentNote.tags || [];
                        state.currentNote.tags.push(name);
                    }
                }
                saveState();
                closeModal('tag-modal');
                renderApp();
            }
        });

        // Enter key to submit
        document.getElementById('tag-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('submit-tag')?.click();
        });
    }

    if (id === 'folder-modal') {
        const input = document.getElementById('folder-name-input');
        input?.focus();
        document.getElementById('submit-folder')?.addEventListener('click', () => {
            const name = input?.value?.trim();
            if (name) {
                state.folders = state.folders || [{ id: 'default', name: 'All Notes' }];
                const newFolderId = 'folder-' + Date.now();
                state.folders.push({ id: newFolderId, name });
                state.expandedFolders = state.expandedFolders || [];
                state.expandedFolders.push(newFolderId);
                saveState(); closeModal('folder-modal'); renderApp();
            }
        });
        // Enter key to submit
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('submit-folder')?.click();
        });
    }
}

function initAllEvents() {
    initCalculatorEvents();
    initNotepadEvents();
    initStickyNotesEvents();
    initTodoEvents();
    initPomodoroEvents();
    initWorldClockEvents();
    initCalendarEvents();
    initCurrencyEvents();

    initQuickLinksEvents();
}

function initOptimizedDragDrop() {
    const foldersList = document.getElementById('folders-list');
    if (!foldersList) return;

    // Shared State
    let draggedNoteId = null;
    let draggedElement = null;
    let dragGhost = null;
    let startX = 0, startY = 0;
    let isDragging = false;
    let edgeScrollInterval = null;
    let longPressTimer = null;

    // Performance Optimization
    let dragRAF = null;
    let cachedFoldersRect = null;

    // Helper: Create Ghost
    function createDragGhost(noteItem, x, y) {
        const ghost = noteItem.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: ${noteItem.offsetWidth}px;
            opacity: 0.9;
            pointer-events: none;
            /* NUCLEAR Z-INDEX OPTION: Max Safe Integer */
            z-index: 2147483647 !important;
            transform: translate(${x - 50}px, ${y - 20}px) rotate(2deg) scale(1.05);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            will-change: transform;
            backdrop-filter: blur(5px);
            background: rgba(30,30,40, 0.95);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 12px;
        `;
        document.body.appendChild(ghost);
        return ghost;
    }

    // --- SHARED LOGIC ---

    function updateDragVisuals(clientX, clientY) {
        if (!isDragging || !dragGhost) return;

        // Move ghost
        dragGhost.style.transform = `translate(${clientX - 50}px, ${clientY - 20}px) rotate(2deg) scale(1.05)`;

        // Edge scroll (Use cached rect)
        const foldersRect = cachedFoldersRect || foldersList.getBoundingClientRect();
        const maxScrollSpeed = 20; // Super fast scroll
        const edgeThreshold = 120; // Huge hit area

        if (edgeScrollInterval) {
            clearInterval(edgeScrollInterval);
            edgeScrollInterval = null;
        }

        if (clientY > foldersRect.top && clientY < foldersRect.bottom) {
            const distFromTop = clientY - foldersRect.top;
            const distFromBottom = foldersRect.bottom - clientY;

            if (distFromTop < edgeThreshold) {
                const speed = maxScrollSpeed * (1 - distFromTop / edgeThreshold);
                edgeScrollInterval = setInterval(() => { foldersList.scrollTop -= Math.max(3, speed); }, 16);
            } else if (distFromBottom < edgeThreshold) {
                const speed = maxScrollSpeed * (1 - distFromBottom / edgeThreshold);
                edgeScrollInterval = setInterval(() => { foldersList.scrollTop += Math.max(3, speed); }, 16);
            }
        }

        // Highlight Drop Target
        const elemBelow = document.elementFromPoint(clientX, clientY);
        const folderHeader = elemBelow?.closest('.folder-header');
        const folderContent = elemBelow?.closest('.folder-content');
        const noteItem = elemBelow?.closest('.note-item');

        let targetHeader = null;
        if (folderHeader) {
            targetHeader = folderHeader;
        } else if (noteItem && noteItem !== draggedElement) {
            targetHeader = noteItem.closest('.folder-accordion')?.querySelector('.folder-header');
        } else if (folderContent) {
            targetHeader = folderContent.closest('.folder-accordion')?.querySelector('.folder-header');
        }

        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        if (targetHeader) targetHeader.classList.add('drag-over');

        dragRAF = null;
    }

    function endDragLogic(clientX, clientY) {
        if (dragRAF) { cancelAnimationFrame(dragRAF); dragRAF = null; }

        if (isDragging && draggedNoteId) {
            const elemBelow = document.elementFromPoint(clientX, clientY);
            // Hide ghost to peek below? No, elementFromPoint works fine with pointer-events: none

            const folderHeader = elemBelow?.closest('.folder-header');
            const folderContent = elemBelow?.closest('.folder-content');
            const noteItem = elemBelow?.closest('.note-item');

            let targetFolderId = null;
            let targetAccordion = null;

            if (folderHeader) {
                targetFolderId = folderHeader.dataset.folder;
                targetAccordion = folderHeader.closest('.folder-accordion');
            } else if (noteItem && noteItem !== draggedElement) {
                targetAccordion = noteItem.closest('.folder-accordion');
                targetFolderId = targetAccordion?.dataset.folder;
            } else if (folderContent) {
                targetFolderId = folderContent.dataset.folder;
                targetAccordion = folderContent.closest('.folder-accordion');
            }

            if (targetFolderId) {
                const note = state.notes.find(n => n.id === draggedNoteId);
                if (note && note.folderId !== targetFolderId && draggedElement) {
                    note.folderId = targetFolderId;

                    // Expand target folder
                    if (!state.expandedFolders.includes(targetFolderId)) {
                        state.expandedFolders.push(targetFolderId);
                        const targetHeader = targetAccordion?.querySelector('.folder-header');
                        const targetContent = targetAccordion?.querySelector('.folder-content');
                        if (targetContent && targetHeader) {
                            targetHeader.classList.add('expanded');
                            targetContent.classList.add('expanded');
                        }
                    }

                    // Move DOM
                    const targetWrapper = targetAccordion?.querySelector('.folder-content-inner');
                    if (targetWrapper) {
                        const emptyHint = targetWrapper.querySelector('.empty-hint');
                        if (emptyHint) emptyHint.remove();
                        targetWrapper.appendChild(draggedElement);
                    }

                    updateFolderCounts();
                    saveState();
                }
            }
        }

        // Cleanup
        if (dragGhost) { dragGhost.remove(); dragGhost = null; }
        if (draggedElement) draggedElement.classList.remove('dragging');
        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.body.style.userSelect = '';
        document.body.style.overflow = '';
        if (edgeScrollInterval) { clearInterval(edgeScrollInterval); edgeScrollInterval = null; }
        draggedNoteId = null;
        draggedElement = null;
        isDragging = false;
        cachedFoldersRect = null;
    }

    // --- MOUSE EVENTS ---

    foldersList.addEventListener('mousedown', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn') || e.button !== 0) return;

        startX = e.clientX;
        startY = e.clientY;
        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;
        cachedFoldersRect = foldersList.getBoundingClientRect();
    });

    document.addEventListener('mousemove', (e) => {
        if (!draggedNoteId || !draggedElement) return;

        if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, e.clientX, e.clientY);
            document.body.style.userSelect = 'none';
        }

        if (isDragging) {
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(e.clientX, e.clientY));
        }
    });

    document.addEventListener('mouseup', (e) => {
        endDragLogic(e.clientX, e.clientY);
    });

    // --- TOUCH EVENTS (Long Press) ---

    foldersList.addEventListener('touchstart', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn')) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;
        cachedFoldersRect = foldersList.getBoundingClientRect();

        longPressTimer = setTimeout(() => {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, startX, startY);
            if (navigator.vibrate) navigator.vibrate(50);
            document.body.style.overflow = 'hidden';
            longPressTimer = null;
        }, 500);
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];

        // If moving while timer is pending => Cancel Timer (It's a scroll)
        if (longPressTimer) {
            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                clearTimeout(longPressTimer); longPressTimer = null; draggedNoteId = null;
            }
        }

        if (isDragging) {
            e.preventDefault();
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(touch.clientX, touch.clientY));
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

        if (isDragging) {
            const touch = e.changedTouches[0];
            endDragLogic(touch.clientX, touch.clientY);
        } else {
            // Reset if tap ended without drag
            draggedNoteId = null;
            draggedElement = null;
        }
    });
}

function initSuperOptimizedDragDrop() {
    const foldersList = document.getElementById('folders-list');
    if (!foldersList) return;

    // Shared State
    let draggedNoteId = null;
    let draggedElement = null;
    let dragGhost = null;
    let startX = 0, startY = 0;
    let isDragging = false;
    let edgeScrollInterval = null;
    let longPressTimer = null;
    let currentScrollSpeed = 0;

    // Performance Optimization
    let dragRAF = null;
    let cachedFoldersRect = null;

    // Helper: Create Ghost
    function createDragGhost(noteItem, x, y) {
        const ghost = noteItem.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: ${noteItem.offsetWidth}px;
            opacity: 0.95;
            pointer-events: none;
            z-index: 2147483647 !important;
            transform: translate(${x - 50}px, ${y - 20}px) rotate(2deg) scale(1.05);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            will-change: transform;
            backdrop-filter: blur(5px);
            background: rgba(30,30,40, 0.95);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 12px;
        `;
        document.body.appendChild(ghost);
        return ghost;
    }

    // --- SHARED LOGIC ---

    function updateDragVisuals(clientX, clientY) {
        if (!isDragging || !dragGhost) return;

        // Move ghost
        dragGhost.style.transform = `translate(${clientX - 50}px, ${clientY - 20}px) rotate(2deg) scale(1.05)`;

        // Edge scroll (Use cached rect)
        const foldersRect = cachedFoldersRect || foldersList.getBoundingClientRect();
        const maxScrollSpeed = 25;
        const edgeThreshold = 100; // Hit area from edge

        // Calculate Scroll Speed
        let newSpeed = 0;

        // Mobile-friendly Viewport check
        // We use the viewport because the folders list might be taking up the whole screen
        const viewportHeight = window.innerHeight;

        // Distance from Top/Bottom of Viewport (or Folders Rect if smaller)
        const topEdgeDist = clientY - foldersRect.top;
        const bottomEdgeDist = foldersRect.bottom - clientY;

        if (topEdgeDist < edgeThreshold && topEdgeDist > -50) {
            // Near Top
            newSpeed = -Math.max(5, maxScrollSpeed * (1 - topEdgeDist / edgeThreshold));
        } else if (bottomEdgeDist < edgeThreshold && bottomEdgeDist > -50) {
            // Near Bottom
            newSpeed = Math.max(5, maxScrollSpeed * (1 - bottomEdgeDist / edgeThreshold));
        }

        currentScrollSpeed = newSpeed;

        // Manage Interval
        if (currentScrollSpeed !== 0) {
            if (!edgeScrollInterval) {
                // Start Interval
                edgeScrollInterval = setInterval(() => {
                    if (currentScrollSpeed !== 0) {
                        foldersList.scrollTop += currentScrollSpeed;
                    }
                }, 16);
            }
        } else {
            // Stop Interval
            if (edgeScrollInterval) {
                clearInterval(edgeScrollInterval);
                edgeScrollInterval = null;
            }
        }

        // Highlight Drop Target
        // Hide ghost momentarily to check element below? No, pointer-events:none handles it.
        const elemBelow = document.elementFromPoint(clientX, clientY);
        const folderHeader = elemBelow?.closest('.folder-header');
        const folderContent = elemBelow?.closest('.folder-content');
        const noteItem = elemBelow?.closest('.note-item');

        let targetHeader = null;
        if (folderHeader) {
            targetHeader = folderHeader;
        } else if (noteItem && noteItem !== draggedElement) {
            targetHeader = noteItem.closest('.folder-accordion')?.querySelector('.folder-header');
        } else if (folderContent) {
            targetHeader = folderContent.closest('.folder-accordion')?.querySelector('.folder-header');
        }

        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        if (targetHeader) targetHeader.classList.add('drag-over');

        dragRAF = null;
    }

    function endDragLogic(clientX, clientY) {
        if (dragRAF) { cancelAnimationFrame(dragRAF); dragRAF = null; }
        if (edgeScrollInterval) { clearInterval(edgeScrollInterval); edgeScrollInterval = null; }

        if (isDragging && draggedNoteId) {
            const elemBelow = document.elementFromPoint(clientX, clientY);

            const folderHeader = elemBelow?.closest('.folder-header');
            const folderContent = elemBelow?.closest('.folder-content');
            const noteItem = elemBelow?.closest('.note-item');

            let targetFolderId = null;
            let targetAccordion = null;

            if (folderHeader) {
                targetFolderId = folderHeader.dataset.folder;
                targetAccordion = folderHeader.closest('.folder-accordion');
            } else if (noteItem && noteItem !== draggedElement) {
                targetAccordion = noteItem.closest('.folder-accordion');
                targetFolderId = targetAccordion?.dataset.folder;
            } else if (folderContent) {
                targetFolderId = folderContent.dataset.folder;
                targetAccordion = folderContent.closest('.folder-accordion');
            }

            if (targetFolderId) {
                const note = state.notes.find(n => n.id === draggedNoteId);
                if (note && note.folderId !== targetFolderId && draggedElement) {
                    note.folderId = targetFolderId;

                    // Expand target folder
                    if (!state.expandedFolders.includes(targetFolderId)) {
                        state.expandedFolders.push(targetFolderId);
                        const targetHeader = targetAccordion?.querySelector('.folder-header');
                        const targetContent = targetAccordion?.querySelector('.folder-content');
                        if (targetContent && targetHeader) {
                            targetHeader.classList.add('expanded');
                            targetContent.classList.add('expanded');
                        }
                    }

                    // Move DOM
                    const targetWrapper = targetAccordion?.querySelector('.folder-content-inner');
                    if (targetWrapper) {
                        const emptyHint = targetWrapper.querySelector('.empty-hint');
                        if (emptyHint) emptyHint.remove();
                        targetWrapper.appendChild(draggedElement);
                    }

                    updateFolderCounts();
                    saveState();
                }
            }
        }

        // Cleanup
        if (dragGhost) { dragGhost.remove(); dragGhost = null; }
        if (draggedElement) draggedElement.classList.remove('dragging');
        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.body.style.userSelect = '';
        document.body.style.overflow = '';
        draggedNoteId = null;
        draggedElement = null;
        isDragging = false;
        cachedFoldersRect = null;
    }

    // --- MOUSE EVENTS ---

    foldersList.addEventListener('mousedown', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn') || e.button !== 0) return;

        startX = e.clientX;
        startY = e.clientY;
        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;
        cachedFoldersRect = foldersList.getBoundingClientRect();
    });

    document.addEventListener('mousemove', (e) => {
        if (!draggedNoteId || !draggedElement) return;

        if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, e.clientX, e.clientY);
            document.body.style.userSelect = 'none';
        }

        if (isDragging) {
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(e.clientX, e.clientY));
        }
    });

    document.addEventListener('mouseup', (e) => {
        endDragLogic(e.clientX, e.clientY);
    });

    // --- TOUCH EVENTS (Long Press) ---

    foldersList.addEventListener('touchstart', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn')) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;
        cachedFoldersRect = foldersList.getBoundingClientRect();

        longPressTimer = setTimeout(() => {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, startX, startY);
            if (navigator.vibrate) navigator.vibrate(50);
            document.body.style.overflow = 'hidden';
            longPressTimer = null;
        }, 500);
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];

        // If moving while timer is pending => Cancel Timer (It's a scroll)
        if (longPressTimer) {
            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                clearTimeout(longPressTimer); longPressTimer = null; draggedNoteId = null;
            }
        }

        if (isDragging) {
            e.preventDefault();
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(touch.clientX, touch.clientY));
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

        if (isDragging) {
            const touch = e.changedTouches[0];
            endDragLogic(touch.clientX, touch.clientY);
        } else {
            // Reset if tap ended without drag
            draggedNoteId = null;
            draggedElement = null;
        }
    });
}

function initUltraOptimizedDragDrop() {
    const foldersList = document.getElementById('folders-list');
    if (!foldersList) return;

    // Shared State
    let draggedNoteId = null;
    let draggedElement = null;
    let dragGhost = null;
    let startX = 0, startY = 0;
    let isDragging = false;
    let edgeScrollInterval = null;
    let longPressTimer = null;
    let currentScrollSpeed = 0;
    let dragRAF = null;

    // Helper: Create Ghost
    function createDragGhost(noteItem, x, y) {
        const ghost = noteItem.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: ${noteItem.offsetWidth}px;
            opacity: 0.95;
            pointer-events: none;
            z-index: 2147483647 !important;
            transform: translate(${x - 50}px, ${y - 20}px) rotate(2deg) scale(1.05);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            will-change: transform;
            backdrop-filter: blur(5px);
            background: rgba(30,30,40, 0.95);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 12px;
        `;
        document.body.appendChild(ghost);
        return ghost;
    }

    // --- SHARED LOGIC ---

    function updateDragVisuals(clientX, clientY) {
        if (!isDragging || !dragGhost) return;

        // Move ghost
        dragGhost.style.transform = `translate(${clientX - 50}px, ${clientY - 20}px) rotate(2deg) scale(1.05)`;

        // --- SCROLL LOGIC (Container Based) ---
        const rect = foldersList.getBoundingClientRect();
        const threshold = 100; // Hit area size
        const maxSpeed = 25;   // Max scroll pixels per frame

        let newSpeed = 0;

        // Check if pointer is vertically within the "active" zone of the list
        if (clientX > rect.left - 50 && clientX < rect.right + 50) {

            const distFromTop = clientY - rect.top;
            const distFromBottom = rect.bottom - clientY;

            // Scroll Up
            if (distFromTop < threshold) {
                const intensity = Math.max(0, 1 - (distFromTop / threshold));
                newSpeed = -(5 + (maxSpeed * intensity));
                if (distFromTop < 0) newSpeed = -maxSpeed;
            }
            // Scroll Down
            else if (distFromBottom < threshold) {
                const intensity = Math.max(0, 1 - (distFromBottom / threshold));
                newSpeed = (5 + (maxSpeed * intensity));
                if (distFromBottom < 0) newSpeed = maxSpeed;
            }
        }

        currentScrollSpeed = newSpeed;

        // Manage Interval
        if (currentScrollSpeed !== 0) {
            if (!edgeScrollInterval) {
                edgeScrollInterval = setInterval(() => {
                    if (currentScrollSpeed !== 0) {
                        foldersList.scrollTop += currentScrollSpeed;
                    }
                }, 16);
            }
        } else {
            if (edgeScrollInterval) {
                clearInterval(edgeScrollInterval);
                edgeScrollInterval = null;
            }
        }

        // --- HIT TESTING ---
        const elemBelow = document.elementFromPoint(clientX, clientY);
        if (!elemBelow) {
            dragRAF = null;
            return;
        }

        const folderHeader = elemBelow.closest('.folder-header');
        const folderContent = elemBelow.closest('.folder-content');
        const noteItem = elemBelow.closest('.note-item');

        let targetHeader = null;
        if (folderHeader) {
            targetHeader = folderHeader;
        } else if (noteItem && noteItem !== draggedElement) {
            targetHeader = noteItem.closest('.folder-accordion')?.querySelector('.folder-header');
        } else if (folderContent) {
            targetHeader = folderContent.closest('.folder-accordion')?.querySelector('.folder-header');
        }

        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        if (targetHeader) targetHeader.classList.add('drag-over');

        dragRAF = null;
    }

    function endDragLogic(clientX, clientY) {
        if (dragRAF) { cancelAnimationFrame(dragRAF); dragRAF = null; }
        if (edgeScrollInterval) { clearInterval(edgeScrollInterval); edgeScrollInterval = null; }

        if (isDragging && draggedNoteId) {
            const elemBelow = document.elementFromPoint(clientX, clientY);

            const folderHeader = elemBelow?.closest('.folder-header');
            const folderContent = elemBelow?.closest('.folder-content');
            const noteItem = elemBelow?.closest('.note-item');

            let targetFolderId = null;
            let targetAccordion = null;

            if (folderHeader) {
                targetFolderId = folderHeader.dataset.folder;
                targetAccordion = folderHeader.closest('.folder-accordion');
            } else if (noteItem && noteItem !== draggedElement) {
                targetAccordion = noteItem.closest('.folder-accordion');
                targetFolderId = targetAccordion?.dataset.folder;
            } else if (folderContent) {
                targetFolderId = folderContent.dataset.folder;
                targetAccordion = folderContent.closest('.folder-accordion');
            }

            if (targetFolderId) {
                const note = state.notes.find(n => n.id === draggedNoteId);
                if (note && note.folderId !== targetFolderId && draggedElement) {
                    note.folderId = targetFolderId;

                    // Expand target folder
                    if (!state.expandedFolders.includes(targetFolderId)) {
                        state.expandedFolders.push(targetFolderId);
                        const targetHeader = targetAccordion?.querySelector('.folder-header');
                        const targetContent = targetAccordion?.querySelector('.folder-content');
                        if (targetContent && targetHeader) {
                            targetHeader.classList.add('expanded');
                            targetContent.classList.add('expanded');
                        }
                    }

                    // Move DOM
                    const targetWrapper = targetAccordion?.querySelector('.folder-content-inner');
                    if (targetWrapper) {
                        const emptyHint = targetWrapper.querySelector('.empty-hint');
                        if (emptyHint) emptyHint.remove();
                        targetWrapper.appendChild(draggedElement);
                    }

                    updateFolderCounts();
                    saveState();
                }
            }
        }

        // Cleanup
        if (dragGhost) { dragGhost.remove(); dragGhost = null; }
        if (draggedElement) draggedElement.classList.remove('dragging');
        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.body.style.userSelect = '';
        document.body.style.overflow = '';
        draggedNoteId = null;
        draggedElement = null;
        isDragging = false;
    }

    // --- MOUSE EVENTS ---

    foldersList.addEventListener('mousedown', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn') || e.button !== 0) return;

        startX = e.clientX;
        startY = e.clientY;
        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;
    });

    document.addEventListener('mousemove', (e) => {
        if (!draggedNoteId || !draggedElement) return;

        if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, e.clientX, e.clientY);
            document.body.style.userSelect = 'none';
        }

        if (isDragging) {
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(e.clientX, e.clientY));
        }
    });

    document.addEventListener('mouseup', (e) => {
        endDragLogic(e.clientX, e.clientY);
    });

    // --- TOUCH EVENTS (Long Press) ---

    foldersList.addEventListener('touchstart', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn')) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;

        longPressTimer = setTimeout(() => {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, startX, startY);
            if (navigator.vibrate) navigator.vibrate(50);
            document.body.style.overflow = 'hidden';
            longPressTimer = null;
        }, 300);
    }, { passive: false });

    // Attach to document
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];

        if (longPressTimer) {
            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                clearTimeout(longPressTimer); longPressTimer = null; draggedNoteId = null;
            }
        }

        if (isDragging) {
            e.preventDefault();
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(touch.clientX, touch.clientY));
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

        if (isDragging) {
            const touch = e.changedTouches[0];
            endDragLogic(touch.clientX, touch.clientY);
        } else {
            draggedNoteId = null;
            draggedElement = null;
        }
    });
}

function initHyperOptimizedDragDrop() {
    // Use .notes-sidebar as scroll container (it's the actual scrollable element on mobile)
    const scrollContainer = document.querySelector('.notes-sidebar') || document.getElementById('folders-list');
    const foldersList = document.getElementById('folders-list');
    if (!foldersList) return;

    // Shared State
    let draggedNoteId = null;
    let draggedElement = null;
    let dragGhost = null;
    let startX = 0, startY = 0;

    // Auto-Scroll State
    let isDragging = false;
    let scrollInterval = null;
    let scrollSpeed = 0;

    // Timers & Frames
    let longPressTimer = null;
    let dragRAF = null;

    // Helper: Create Ghost - Liquid Glass macOS Style
    function createDragGhost(noteItem, x, y) {
        const ghost = noteItem.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: ${noteItem.offsetWidth}px;
            opacity: 1;
            pointer-events: none;
            z-index: 2147483647 !important;
            transform: translate(${x - 50}px, ${y - 20}px) scale(1.02);
            
            /* Liquid Glass Effect */
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(40px) saturate(180%);
            -webkit-backdrop-filter: blur(40px) saturate(180%);
            
            /* Glassy Border */
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 16px;
            
            /* Layered Shadows for Depth */
            box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.4),
                0 0 0 1px rgba(255, 255, 255, 0.05) inset,
                0 1px 0 rgba(255, 255, 255, 0.1) inset;
            
            will-change: transform;
        `;
        document.body.appendChild(ghost);
        return ghost;
    }

    // --- SCROLL ENGINE (INTERVAL-BASED, DECOUPLED FROM TOUCH) ---
    function startAutoScroll() {
        if (scrollInterval) return; // Already running
        scrollInterval = setInterval(() => {
            if (scrollContainer && scrollSpeed !== 0) {
                scrollContainer.scrollTop += scrollSpeed;
            }
        }, 20); // 50fps for faster scrolling
    }

    function stopAutoScroll() {
        if (scrollInterval) {
            clearInterval(scrollInterval);
            scrollInterval = null;
        }
    }

    // --- VISUAL INTERACTION ENGINE ---
    function updateDragVisuals(clientX, clientY) {
        if (!isDragging || !dragGhost) return;

        // 1. Move Ghost - Smooth macOS style
        dragGhost.style.transform = `translate(${clientX - 50}px, ${clientY - 20}px) scale(1.02)`;

        // 2. Calculate Auto-Scroll Speed
        const viewportHeight = window.innerHeight;
        const topThreshold = 100;
        const bottomThreshold = 100;
        const maxScrollSpeed = 15; // Gentle speed

        const oldSpeed = scrollSpeed;
        scrollSpeed = 0;

        if (clientY < topThreshold) {
            const intensity = 1 - (clientY / topThreshold);
            scrollSpeed = -(5 + (maxScrollSpeed * intensity)); // Min 5px
        } else if (clientY > (viewportHeight - bottomThreshold)) {
            const distFromBottom = viewportHeight - clientY;
            const intensity = 1 - (distFromBottom / bottomThreshold);
            scrollSpeed = (5 + (maxScrollSpeed * intensity)); // Min 5px
        }

        // Start/stop scroll only when needed
        if (scrollSpeed !== 0 && oldSpeed === 0) {
            startAutoScroll();
        } else if (scrollSpeed === 0 && oldSpeed !== 0) {
            stopAutoScroll();
        }

        // 3. Highlight Drop Target
        // We hide the ghost momentarily? No, elementFromPoint works with pointer-events: none
        const elemBelow = document.elementFromPoint(clientX, clientY);
        if (!elemBelow) { dragRAF = null; return; }

        const folderHeader = elemBelow.closest('.folder-header');
        const folderContent = elemBelow.closest('.folder-content');
        const noteItem = elemBelow.closest('.note-item');

        let targetHeader = null;
        if (folderHeader) {
            targetHeader = folderHeader;
        } else if (noteItem && noteItem !== draggedElement) {
            targetHeader = noteItem.closest('.folder-accordion')?.querySelector('.folder-header');
        } else if (folderContent) {
            targetHeader = folderContent.closest('.folder-accordion')?.querySelector('.folder-header');
        }

        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        if (targetHeader) targetHeader.classList.add('drag-over');

        dragRAF = null;
    }

    function endDragLogic(clientX, clientY) {
        // Stop Everything
        if (dragRAF) { cancelAnimationFrame(dragRAF); dragRAF = null; }
        if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null; }
        scrollSpeed = 0;

        if (isDragging && draggedNoteId) {
            const elemBelow = document.elementFromPoint(clientX, clientY);

            const folderHeader = elemBelow?.closest('.folder-header');
            const folderContent = elemBelow?.closest('.folder-content');
            const noteItem = elemBelow?.closest('.note-item');

            let targetFolderId = null;
            let targetAccordion = null;

            if (folderHeader) {
                targetFolderId = folderHeader.dataset.folder;
                targetAccordion = folderHeader.closest('.folder-accordion');
            } else if (noteItem && noteItem !== draggedElement) {
                targetAccordion = noteItem.closest('.folder-accordion');
                targetFolderId = targetAccordion?.dataset.folder;
            } else if (folderContent) {
                targetFolderId = folderContent.dataset.folder;
                targetAccordion = folderContent.closest('.folder-accordion');
            }

            if (targetFolderId) {
                const note = state.notes.find(n => n.id === draggedNoteId);
                if (note && note.folderId !== targetFolderId && draggedElement) {
                    note.folderId = targetFolderId;

                    // Expand target folder
                    if (!state.expandedFolders.includes(targetFolderId)) {
                        state.expandedFolders.push(targetFolderId);
                        const targetHeader = targetAccordion?.querySelector('.folder-header');
                        const targetContent = targetAccordion?.querySelector('.folder-content');
                        if (targetContent && targetHeader) {
                            targetHeader.classList.add('expanded');
                            targetContent.classList.add('expanded');
                        }
                    }

                    // Move DOM
                    const targetWrapper = targetAccordion?.querySelector('.folder-content-inner');
                    if (targetWrapper) {
                        const emptyHint = targetWrapper.querySelector('.empty-hint');
                        if (emptyHint) emptyHint.remove();
                        targetWrapper.appendChild(draggedElement);
                    }

                    updateFolderCounts();
                    saveState();
                }
            }
        }

        // Cleanup
        if (dragGhost) { dragGhost.remove(); dragGhost = null; }
        if (draggedElement) draggedElement.classList.remove('dragging');
        document.querySelectorAll('.folder-header.drag-over').forEach(el => el.classList.remove('drag-over'));
        document.body.style.userSelect = '';
        document.body.style.overflow = '';
        draggedNoteId = null;
        draggedElement = null;
        isDragging = false;
    }

    // --- INPUT LISTENERS ---

    // Mouse
    foldersList.addEventListener('mousedown', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn') || e.button !== 0) return;

        startX = e.clientX;
        startY = e.clientY;
        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;
    });

    document.addEventListener('mousemove', (e) => {
        if (!draggedNoteId || !draggedElement) return;

        if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, e.clientX, e.clientY);
            document.body.style.userSelect = 'none';
        }

        if (isDragging) {
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(e.clientX, e.clientY));
        }
    });

    document.addEventListener('mouseup', (e) => {
        endDragLogic(e.clientX, e.clientY);
    });

    // Touch
    foldersList.addEventListener('touchstart', (e) => {
        const noteItem = e.target.closest('.note-item');
        if (!noteItem || e.target.closest('.note-delete-btn')) return;

        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;

        draggedNoteId = parseInt(noteItem.dataset.id);
        draggedElement = noteItem;

        // Mobile Optimization: Prevent scrolling while trying to initiate potential drag
        // But we want to allow scrolling if they just flick up/down effectively...
        // Using a timer nicely handles this.

        longPressTimer = setTimeout(() => {
            isDragging = true;
            draggedElement.classList.add('dragging');
            dragGhost = createDragGhost(draggedElement, startX, startY);
            if (navigator.vibrate) navigator.vibrate(50);

            // LOCK BODY SCROLL during drag
            document.body.style.overflow = 'hidden';

            longPressTimer = null;
        }, 300);
    }, { passive: false });

    // Touch Move on DOCUMENT to catch everything
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];

        // Break timer if moved too much before long press
        if (longPressTimer) {
            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
                clearTimeout(longPressTimer); longPressTimer = null; draggedNoteId = null;
            }
        }

        if (isDragging) {
            e.preventDefault(); // Stop native scrolling
            if (!dragRAF) dragRAF = requestAnimationFrame(() => updateDragVisuals(touch.clientX, touch.clientY));
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }

        if (isDragging) {
            const touch = e.changedTouches[0];
            endDragLogic(touch.clientX, touch.clientY);
        } else {
            draggedNoteId = null;
            draggedElement = null;
        }
    });
}
