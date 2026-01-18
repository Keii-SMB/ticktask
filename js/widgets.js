// ========================================
// WORLD CLOCK
// ========================================
const timezones = [
    { city: 'New York', zone: 'America/New_York', country: 'USA' },
    { city: 'Los Angeles', zone: 'America/Los_Angeles', country: 'USA' },
    { city: 'London', zone: 'Europe/London', country: 'UK' },
    { city: 'Paris', zone: 'Europe/Paris', country: 'France' },
    { city: 'Berlin', zone: 'Europe/Berlin', country: 'Germany' },
    { city: 'Tokyo', zone: 'Asia/Tokyo', country: 'Japan' },
    { city: 'Seoul', zone: 'Asia/Seoul', country: 'South Korea' },
    { city: 'Singapore', zone: 'Asia/Singapore', country: 'Singapore' },
    { city: 'Sydney', zone: 'Australia/Sydney', country: 'Australia' },
    { city: 'Dubai', zone: 'Asia/Dubai', country: 'UAE' },
    { city: 'Mumbai', zone: 'Asia/Kolkata', country: 'India' },
    { city: 'Hong Kong', zone: 'Asia/Hong_Kong', country: 'China' },
    { city: 'Jakarta', zone: 'Asia/Jakarta', country: 'Indonesia' },
    { city: 'Bangkok', zone: 'Asia/Bangkok', country: 'Thailand' },
    { city: 'Moscow', zone: 'Europe/Moscow', country: 'Russia' },
    { city: 'Toronto', zone: 'America/Toronto', country: 'Canada' },
    { city: 'São Paulo', zone: 'America/Sao_Paulo', country: 'Brazil' },
    { city: 'Cairo', zone: 'Africa/Cairo', country: 'Egypt' },
    { city: 'Amsterdam', zone: 'Europe/Amsterdam', country: 'Netherlands' },
    { city: 'Stockholm', zone: 'Europe/Stockholm', country: 'Sweden' }
];

let clockInterval = null;

function initWorldClock() {
    if (!clockInterval) {
        clockInterval = setInterval(updateClocks, 1000);
    }
}

function generateWorldClockPanel() {
    const worldClocks = state.worldClocks.map(tz => {
        const time = new Date().toLocaleTimeString('en-US', { timeZone: tz.zone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const localOffset = new Date().getTimezoneOffset();
        const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: tz.zone }));
        const localDate = new Date(new Date().toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
        const diff = Math.round((tzDate - localDate) / (1000 * 60 * 60));
        const diffStr = diff >= 0 ? `+${diff}h` : `${diff}h`;

        return `
            <div class="world-clock-item" data-zone="${tz.zone}">
                <div class="clock-city">${tz.city}, ${tz.country}</div>
                <div class="clock-time" data-zone="${tz.zone}">${time}</div>
                <div class="clock-diff">${diffStr} from local</div>
                <button class="delete-clock"><i data-lucide="x"></i></button>
            </div>
        `;
    }).join('');

    return `
        <section class="tool-panel glass" id="world-clock-panel">
            <div class="panel-header">
                <h2>World Clock</h2>
                <button class="icon-btn" id="add-clock-btn" title="Add Clock"><i data-lucide="plus"></i></button>
            </div>
            <div class="world-clock-container" id="world-clock-container">
                <div class="local-time glass-light">
                    <div class="clock-label">Local Time</div>
                    <div class="clock-time" id="local-time">${new Date().toLocaleTimeString()}</div>
                    <div class="clock-date" id="local-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                <div class="world-clocks" id="world-clocks">${worldClocks}</div>
            </div>
        </section>
    `;
}

function initWorldClockEvents() {
    document.getElementById('add-clock-btn')?.addEventListener('click', () => openModal('clock-modal'));

    document.getElementById('world-clocks')?.addEventListener('click', (e) => {
        if (e.target.closest('.delete-clock')) {
            const item = e.target.closest('.world-clock-item');
            const zone = item.dataset.zone;
            state.worldClocks = state.worldClocks.filter(c => c.zone !== zone);
            saveState();
            renderCurrentTool();
        }
    });
}

function updateClocks() {
    const localTime = document.getElementById('local-time');
    const localDate = document.getElementById('local-date');
    if (localTime) localTime.textContent = new Date().toLocaleTimeString();
    if (localDate) localDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    document.querySelectorAll('.world-clock-item .clock-time').forEach(el => {
        const zone = el.dataset.zone;
        if (zone) {
            el.textContent = new Date().toLocaleTimeString('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    });
}

// ========================================
// CALENDAR
// ========================================
let currentCalendarDate = new Date();

function initCalendar() { }

function generateCalendarPanel() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthName = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    let days = '';

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        days += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = isCurrentMonth && today.getDate() === i;
        days += `<div class="calendar-day ${isToday ? 'today' : ''}">${i}</div>`;
    }

    // Next month days
    const totalCells = 42;
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
        days += `<div class="calendar-day other-month">${i}</div>`;
    }

    return `
        <section class="tool-panel glass" id="calendar-panel">
            <div class="panel-header">
                <h2>Calendar</h2>
                <div class="calendar-nav">
                    <button class="icon-btn" id="prev-month"><i data-lucide="chevron-left"></i></button>
                    <span class="calendar-month" id="calendar-month">${monthName}</span>
                    <button class="icon-btn" id="next-month"><i data-lucide="chevron-right"></i></button>
                </div>
            </div>
            <div class="calendar-container">
                <div class="calendar-weekdays">
                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>
                <div class="calendar-days" id="calendar-days">${days}</div>
            </div>
        </section>
    `;
}

function initCalendarEvents() {
    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCurrentTool();
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCurrentTool();
    });
}

// ========================================
// CURRENCY CONVERTER
// ========================================
const exchangeRates = {
    USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.50, IDR: 15650, CNY: 7.24, KRW: 1320, SGD: 1.34, AUD: 1.53, CAD: 1.36
};

function initCurrency() { }

function generateCurrencyPanel() {
    const currencies = Object.keys(exchangeRates).map(code => {
        const flags = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', IDR: '🇮🇩', CNY: '🇨🇳', KRW: '🇰🇷', SGD: '🇸🇬', AUD: '🇦🇺', CAD: '🇨🇦' };
        return `<option value="${code}">${flags[code]} ${code}</option>`;
    }).join('');

    return `
        <section class="tool-panel glass" id="currency-panel">
            <div class="panel-header">
                <h2>Currency Converter</h2>
            </div>
            <div class="currency-container">
                <div class="currency-input-group">
                    <label>Amount</label>
                    <div class="currency-input-wrapper">
                        <input type="number" class="currency-amount" id="currency-amount" value="1" min="0">
                        <select class="currency-select" id="currency-from">${currencies}</select>
                    </div>
                </div>
                <button class="swap-currency-btn" id="swap-currency"><i data-lucide="arrow-down-up"></i></button>
                <div class="currency-input-group">
                    <label>Converted To</label>
                    <div class="currency-input-wrapper">
                        <div class="currency-result" id="currency-result">0.92</div>
                        <select class="currency-select" id="currency-to">${currencies.replace('value="EUR"', 'value="EUR" selected')}</select>
                    </div>
                </div>
                <div class="currency-rate" id="currency-rate">1 USD = 0.92 EUR</div>
            </div>
        </section>
    `;
}

function initCurrencyEvents() {
    const amount = document.getElementById('currency-amount');
    const from = document.getElementById('currency-from');
    const to = document.getElementById('currency-to');
    const swap = document.getElementById('swap-currency');

    const convert = () => {
        const val = parseFloat(amount?.value) || 0;
        const fromRate = exchangeRates[from?.value] || 1;
        const toRate = exchangeRates[to?.value] || 1;
        const result = (val / fromRate) * toRate;

        const resultEl = document.getElementById('currency-result');
        const rateEl = document.getElementById('currency-rate');

        if (resultEl) resultEl.textContent = result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (rateEl) rateEl.textContent = `1 ${from?.value} = ${(toRate / fromRate).toFixed(4)} ${to?.value}`;
    };

    amount?.addEventListener('input', convert);
    from?.addEventListener('change', convert);
    to?.addEventListener('change', convert);
    swap?.addEventListener('click', () => {
        const temp = from.value;
        from.value = to.value;
        to.value = temp;
        convert();
    });

    convert();
}

// ========================================
// AUTH UI
// ========================================
window.renderLoginModal = () => {
    console.log("Rendering Login Modal...");
    const container = document.getElementById('modals-container');
    container.innerHTML = `
        <div class="login-overlay">
            <div class="login-modal" id="login-modal-content">
                <button class="login-close-btn" onclick="closeLoginModal()">
                    <i data-lucide="x"></i>
                </button>
                <div class="login-logo">🔹🔹🔹</div>
                <h1 class="login-title">Welcome Back</h1>
                <p class="login-subtitle">Sign in to sync your dashboard</p>

                <!-- Initial View: Providers -->
                <div id="auth-providers" class="auth-buttons">
                    <button class="auth-btn" onclick="loginWithGoogle()">
                        <i data-lucide="mail"></i> Continue with Google
                    </button>
                    <button class="auth-btn" onclick="loginWithGitHub()">
                        <i data-lucide="github"></i> Continue with GitHub
                    </button>
                    <button class="auth-btn" onclick="showPhoneLogin()">
                        <i data-lucide="phone"></i> Continue with Phone
                    </button>
                    <button class="auth-btn" onclick="showEmailLogin()">
                        <i data-lucide="at-sign"></i> Continue with Email
                    </button>
                    
                    <div class="divider"><span>or</span></div>
                    
                    <button class="auth-btn" onclick="loginAsGuest()">
                        <i data-lucide="user"></i> Continue as Guest
                    </button>
                </div>

                <!-- Email Form (Hidden) -->
                <div id="auth-email-form" style="display:none; text-align:left">
                     <div class="input-group">
                        <input type="email" id="email-in" class="glass-input" placeholder="Email Address">
                        <input type="password" id="pass-in" class="glass-input" placeholder="Password">
                    </div>
                    <button class="auth-btn primary" onclick="loginWithEmail()">Sign In</button>
                    <div style="margin-top:10px;text-align:center">
                        <a href="#" style="font-size:0.8rem;color:#666" onclick="showProviders()">Back to options</a>
                    </div>
                </div>

                <!-- Phone Form (Hidden) -->
                <div id="auth-phone-form" style="display:none; text-align:left">
                     <div class="input-group">
                        <input type="tel" id="phone-in" class="glass-input" placeholder="+1 555-0123">
                    </div>
                    <button class="auth-btn primary" id="phone-sign-btn" onclick="loginWithPhone()">Send Code</button>
                    <div style="margin-top:10px;text-align:center">
                        <a href="#" style="font-size:0.8rem;color:#666" onclick="showProviders()">Back to options</a>
                    </div>
                </div>

            </div>
        </div>
    `;
    lucide.createIcons();
};

// UI Helpers
window.showEmailLogin = () => {
    document.getElementById('auth-providers').style.display = 'none';
    document.getElementById('auth-email-form').style.display = 'block';
};

window.showPhoneLogin = () => {
    document.getElementById('auth-providers').style.display = 'none';
    document.getElementById('auth-phone-form').style.display = 'block';
};

window.showProviders = () => {
    document.getElementById('auth-email-form').style.display = 'none';
    document.getElementById('auth-phone-form').style.display = 'none';
    document.getElementById('auth-providers').style.display = 'flex';
};

window.closeLoginModal = () => {
    const overlay = document.querySelector('.login-overlay');
    if (overlay) overlay.remove();

    // Auto-return to previous tool OR calculator
    const targetTool = window.lastActiveTool || 'calculator';
    const toolBtn = document.querySelector(`[data-tool="${targetTool}"]`);
    if (toolBtn) toolBtn.click();

    delete window.lastActiveTool;
};


// QUICK LINKS
// ========================================
function initQuickLinks() {
    if (state.quickLinks.length === 0) {
        state.quickLinks = [
            { id: 1, title: 'Google', url: 'https://google.com', icon: 'search' },
            { id: 2, title: 'GitHub', url: 'https://github.com', icon: 'github' },
            { id: 3, title: 'YouTube', url: 'https://youtube.com', icon: 'youtube' }
        ];
    }
}

function generateQuickLinksPanel() {
    const links = state.quickLinks.map(link => `
            < a href = "${link.url}" target = "_blank" class= "quick-link" data - id="${link.id}" >
            <div class="quick-link-icon-wrapper" style="background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2)">
                <i data-lucide="${link.icon}"></i>
            </div>
            <span class="quick-link-title">${link.title}</span>
            <button class="quick-link-delete" onclick="event.preventDefault(); deleteQuickLink(${link.id})"><i data-lucide="x"></i></button>
        </a >
        `).join('');

    return `
        < section class="tool-panel glass wide" id = "quick-links-panel" >
            <div class="panel-header">
                <h2>Quick Links</h2>
                <button class="icon-btn" id="add-link-btn" title="Add Link"><i data-lucide="plus"></i></button>
            </div>
            <div class="quick-links-grid" id="quick-links-grid">
                ${links || '<div class="empty-state"><i data-lucide="link"></i><p>No links yet. Click + to add one!</p></div>'}
            </div>
        </section >
        `;
}

function initQuickLinksEvents() {
    document.getElementById('add-link-btn')?.addEventListener('click', () => openModal('link-modal'));
}

window.deleteQuickLink = function (id) {
    state.quickLinks = state.quickLinks.filter(l => l.id !== id);
    saveState();
    renderApp(); // Was renderCurrentTool
};

// ========================================
// MODALS
// ========================================
function generateModals() {
    const timezoneItems = timezones.map(tz => `
        < div class="timezone-item" data - zone="${tz.zone}" data - city="${tz.city}" data - country="${tz.country}" >
            <div class="timezone-item-city">${tz.city}, ${tz.country}</div>
            <div class="timezone-item-zone">${tz.zone}</div>
        </div >
        `).join('');

    return `
        < !--Clock Modal-- >
        <div class="modal" id="clock-modal">
            <div class="modal-content glass">
                <div class="modal-header">
                    <h3>Add World Clock</h3>
                    <button class="modal-close" onclick="closeModal('clock-modal')"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <input type="text" class="modal-input" id="timezone-search" placeholder="Search country or city...">
                    <div class="timezone-list" id="timezone-list">${timezoneItems}</div>
                </div>
            </div>
        </div>
        
        <!--Link Modal-- >
        <div class="modal" id="link-modal">
            <div class="modal-content glass">
                <div class="modal-header">
                    <h3>Add Quick Link</h3>
                    <button class="modal-close" onclick="closeModal('link-modal')"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <input type="text" class="modal-input" id="link-title" placeholder="Title (e.g., GitHub)">
                        <input type="url" class="modal-input" id="link-url" placeholder="URL (e.g., https://github.com)">
                            <div class="link-icon-picker" id="link-icon-picker">
                                <button class="icon-option selected" data-icon="globe"><i data-lucide="globe"></i></button>
                                <button class="icon-option" data-icon="search"><i data-lucide="search"></i></button>
                                <button class="icon-option" data-icon="github"><i data-lucide="github"></i></button>
                                <button class="icon-option" data-icon="youtube"><i data-lucide="youtube"></i></button>
                                <button class="icon-option" data-icon="mail"><i data-lucide="mail"></i></button>
                                <button class="icon-option" data-icon="briefcase"><i data-lucide="briefcase"></i></button>
                                <button class="icon-option" data-icon="shopping-cart"><i data-lucide="shopping-cart"></i></button>
                                <button class="icon-option" data-icon="book"><i data-lucide="book"></i></button>
                                <button class="icon-option" data-icon="music"><i data-lucide="music"></i></button>
                                <button class="icon-option" data-icon="video"><i data-lucide="video"></i></button>
                                <button class="icon-option" data-icon="code"><i data-lucide="code"></i></button>
                                <button class="icon-option" data-icon="cloud"><i data-lucide="cloud"></i></button>
                            </div>
                        </div>
                        <button class="icon-option" data-icon="🎬">🎬</button>
                        <button class="icon-option" data-icon="🎵">🎵</button>
                        <button class="icon-option" data-icon="📚">📚</button>
                        <button class="icon-option" data-icon="🛒">🛒</button>
                        <button class="icon-option" data-icon="💬">💬</button>
                </div>
                <button class="modal-submit" id="submit-link">Add Link</button>
            </div>
        </div>
        </div >
        
        < !--Tag Modal-- >
        <div class="modal" id="tag-modal">
            <div class="modal-content glass">
                <div class="modal-header">
                    <h3>Add Tag</h3>
                    <button class="modal-close" onclick="closeModal('tag-modal')"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <input type="text" class="modal-input" id="tag-input" placeholder="Tag name...">
                        <div class="tag-colors" id="tag-colors">
                            <button class="color-option selected" data-color="#ff6b6b" style="background:#ff6b6b"></button>
                            <button class="color-option" data-color="#ffa502" style="background:#ffa502"></button>
                            <button class="color-option" data-color="#2ed573" style="background:#2ed573"></button>
                            <button class="color-option" data-color="#1e90ff" style="background:#1e90ff"></button>
                            <button class="color-option" data-color="#a55eea" style="background:#a55eea"></button>
                            <button class="color-option" data-color="#ff6b81" style="background:#ff6b81"></button>
                        </div>
                        <button class="modal-submit" id="submit-tag">Add Tag</button>
                </div>
            </div>
        </div>
    `;
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        initModalEvents(modalId);
        lucide.createIcons();
    }
}

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
};

function initModalEvents(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modalId);
    });

    if (modalId === 'clock-modal') {
        const search = document.getElementById('timezone-search');
        search?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.timezone-item').forEach(item => {
                const city = item.dataset.city.toLowerCase();
                const country = item.dataset.country.toLowerCase();
                item.style.display = (city.includes(query) || country.includes(query)) ? '' : 'none';
            });
        });

        document.querySelectorAll('.timezone-item').forEach(item => {
            item.addEventListener('click', () => {
                const exists = state.worldClocks.some(c => c.zone === item.dataset.zone);
                if (!exists) {
                    state.worldClocks.push({
                        city: item.dataset.city,
                        country: item.dataset.country,
                        zone: item.dataset.zone
                    });
                    saveState();
                }
                closeModal('clock-modal');
                renderCurrentTool();
            });
        });
    }

    if (modalId === 'link-modal') {
        document.querySelectorAll('#link-icon-picker .icon-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#link-icon-picker .icon-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        document.getElementById('submit-link')?.addEventListener('click', () => {
            const title = document.getElementById('link-title')?.value;
            const url = document.getElementById('link-url')?.value;
            const icon = document.querySelector('#link-icon-picker .icon-option.selected')?.dataset.icon || '🌐';

            if (title && url) {
                state.quickLinks.push({ id: Date.now(), title, url, icon });
                saveState();
                closeModal('link-modal');
                renderCurrentTool();
            }
        });
    }

    if (modalId === 'tag-modal') {
        document.querySelectorAll('#tag-colors .color-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#tag-colors .color-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        document.getElementById('submit-tag')?.addEventListener('click', () => {
            const name = document.getElementById('tag-input')?.value;
            const color = document.querySelector('#tag-colors .color-option.selected')?.dataset.color || '#007AFF';

            if (name) {
                const exists = state.tags.some(t => t.name === name);
                if (!exists) {
                    state.tags.push({ name, color });
                    if (state.currentNote) {
                        state.currentNote.tags = state.currentNote.tags || [];
                        state.currentNote.tags.push(name);
                    }
                    saveState();
                }
                closeModal('tag-modal');
                renderCurrentTool();
            }
        });
    }
}
