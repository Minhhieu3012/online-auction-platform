const AUCTION_ITEMS = [
    {
        id: "lot-842",
        lotNumber: "Lot #842",
        type: "Horology",
        icon: "◷",
        title: "The Midnight Chronograph",
        description: "Private collection chronograph with current bid at $285,000.",
        href: "pages/product-detail.html?id=842",
        currentBid: "$285,000",
        estimate: "$220,000 - $340,000",
        status: "Active",
        keywords: [
            "midnight",
            "chronograph",
            "watch",
            "horology",
            "lot 842",
            "842",
            "timepiece",
            "private collection"
        ]
    },
    {
        id: "lot-118",
        lotNumber: "Lot #118",
        type: "Fine Art",
        icon: "◇",
        title: "Fragmented Echo",
        description: "Contemporary fine art work with current bid at $1,220,000.",
        href: "pages/product-detail.html?id=118",
        currentBid: "$1,220,000",
        estimate: "$900,000 - $1.4M",
        status: "Active",
        keywords: [
            "fragmented",
            "echo",
            "fine art",
            "painting",
            "lot 118",
            "118",
            "artwork",
            "contemporary"
        ]
    },
    {
        id: "lot-883",
        lotNumber: "Lot #883",
        type: "Automotive",
        icon: "◈",
        title: "1962 GTO Heritage",
        description: "Collector-grade automotive icon with current bid at $3,800,000.",
        href: "pages/product-detail.html?id=883",
        currentBid: "$3,800,000",
        estimate: "$3.4M - $4.2M",
        status: "Active",
        keywords: [
            "1962",
            "gto",
            "heritage",
            "car",
            "automotive",
            "collector car",
            "lot 883",
            "883"
        ]
    },
    {
        id: "lot-254",
        lotNumber: "Lot #254",
        type: "Jewelry",
        icon: "◇",
        title: "Imperial Sapphire Necklace",
        description: "High jewelry lot with current bid at $295,000.",
        href: "pages/product-detail.html?id=254",
        currentBid: "$295,000",
        estimate: "$220,000 - $350,000",
        status: "Active",
        keywords: [
            "imperial",
            "sapphire",
            "necklace",
            "jewelry",
            "high jewelry",
            "lot 254",
            "254",
            "gem"
        ]
    },
    {
        id: "lot-402",
        lotNumber: "Lot #402",
        type: "Horology",
        icon: "◷",
        title: "Patek Philippe Ref. 2499",
        description: "Rare watch lot closing soon with current bid at $1,450,000.",
        href: "pages/product-detail.html?id=402",
        currentBid: "$1,450,000",
        estimate: "$1.2M - $1.8M",
        status: "Closing Soon",
        keywords: [
            "patek",
            "philippe",
            "2499",
            "watch",
            "horology",
            "lot 402",
            "402",
            "closing soon"
        ]
    },
    {
        id: "lot-721",
        lotNumber: "Lot #721",
        type: "Jewelry",
        icon: "◇",
        title: "Diamond Tennis Bracelet",
        description: "Jewelry lot closing soon with current bid at $81,000.",
        href: "pages/product-detail.html?id=721",
        currentBid: "$81,000",
        estimate: "$68,000 - $92,000",
        status: "Closing Soon",
        keywords: [
            "diamond",
            "tennis",
            "bracelet",
            "jewelry",
            "lot 721",
            "721",
            "closing soon"
        ]
    },
    {
        id: "lot-007",
        lotNumber: "Lot #007",
        type: "Automotive",
        icon: "◈",
        title: "1964 Aston Martin DB5",
        description: "Scheduled collector car lot starting at $750,000.",
        href: "pages/product-detail.html?id=7",
        currentBid: "Not open",
        estimate: "$800,000 - $1.1M",
        status: "Scheduled",
        keywords: [
            "aston",
            "martin",
            "db5",
            "1964",
            "automotive",
            "car",
            "lot 007",
            "007",
            "scheduled"
        ]
    },
    {
        id: "lot-611",
        lotNumber: "Lot #611",
        type: "Jewelry",
        icon: "◇",
        title: "Rare Emerald Signet Ring",
        description: "Scheduled jewelry lot starting at $30,000.",
        href: "pages/product-detail.html?id=611",
        currentBid: "Not open",
        estimate: "$42,000 - $66,000",
        status: "Scheduled",
        keywords: [
            "emerald",
            "signet",
            "ring",
            "jewelry",
            "lot 611",
            "611",
            "scheduled"
        ]
    },
    {
        id: "lot-319",
        lotNumber: "Lot #319",
        type: "Collectibles",
        icon: "▣",
        title: "Art Deco Vase",
        description: "Ended collectible lot with final bid at $42,500.",
        href: "pages/product-detail.html?id=319",
        currentBid: "$42,500",
        estimate: "$38,000 - $48,000",
        status: "Ended",
        keywords: [
            "art deco",
            "vase",
            "collectibles",
            "lot 319",
            "319",
            "ended"
        ]
    },
    {
        id: "lot-520",
        lotNumber: "Lot #520",
        type: "Horology",
        icon: "◷",
        title: "Private Estate Timepiece",
        description: "Ended horology lot with final bid at $138,000.",
        href: "pages/product-detail.html?id=520",
        currentBid: "$138,000",
        estimate: "$120,000 - $160,000",
        status: "Ended",
        keywords: [
            "private",
            "estate",
            "timepiece",
            "watch",
            "horology",
            "lot 520",
            "520",
            "ended"
        ]
    }
];

let isInitialized = false;

const state = {
    isOpen: false,
    query: "",
    activeIndex: 0
};

function isCurrentPageInsidePagesFolder() {
    return window.location.pathname.includes("/pages/");
}

function resolveHref(href) {
    const insidePages = isCurrentPageInsidePagesFolder();

    if (href.startsWith("pages/")) {
        return insidePages ? `./${href.replace("pages/", "")}` : `./${href}`;
    }

    return href;
}

function normalizeText(value) {
    return String(value || "").toLowerCase().trim();
}

function getSearchableText(item) {
    return [
        item.lotNumber,
        item.type,
        item.title,
        item.description,
        item.currentBid,
        item.estimate,
        item.status,
        ...(item.keywords || [])
    ].map(normalizeText).join(" ");
}

function getFilteredItems() {
    const query = normalizeText(state.query);

    if (!query) {
        return AUCTION_ITEMS;
    }

    const queryParts = query.split(/\s+/).filter(Boolean);

    return AUCTION_ITEMS
        .map((item) => {
            const searchableText = getSearchableText(item);
            const normalizedTitle = normalizeText(item.title);
            const normalizedLotNumber = normalizeText(item.lotNumber);
            const normalizedType = normalizeText(item.type);
            const normalizedStatus = normalizeText(item.status);

            const score = queryParts.reduce((total, part) => {
                if (normalizedLotNumber.includes(part)) {
                    return total + 6;
                }

                if (normalizedTitle.includes(part)) {
                    return total + 5;
                }

                if (normalizedType.includes(part)) {
                    return total + 3;
                }

                if (normalizedStatus.includes(part)) {
                    return total + 2;
                }

                if (searchableText.includes(part)) {
                    return total + 1;
                }

                return total;
            }, 0);

            return {
                item,
                score
            };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);
}

function groupItems(items) {
    return items.reduce((groups, item) => {
        const groupName = item.status;

        if (!groups[groupName]) {
            groups[groupName] = [];
        }

        groups[groupName].push(item);

        return groups;
    }, {});
}

function createCommandPaletteTemplate() {
    return `
        <div class="command-palette-shell" data-command-palette hidden>
            <section class="command-palette" role="dialog" aria-modal="true" aria-label="Search auction lots">
                <div class="command-palette-top">
                    <label class="command-palette-search">
                        <span class="command-palette-search-icon">⌕</span>
                        <input
                            type="search"
                            placeholder="Search auction lots by name, lot number, category, or status..."
                            autocomplete="off"
                            data-command-input
                        />
                        <span class="command-palette-shortcut">Esc</span>
                    </label>

                    <div class="command-palette-meta">
                        <span><strong data-command-count>0</strong> lots found</span>
                        <span>↑ ↓ to navigate · Enter to open lot · Ctrl/Cmd + K to search</span>
                    </div>
                </div>

                <div class="command-palette-body">
                    <div class="command-results" data-command-results></div>

                    <aside class="command-detail" data-command-detail></aside>
                </div>
            </section>
        </div>
    `;
}

function ensureCommandPalette() {
    const existingPalette = document.querySelector("[data-command-palette]");

    if (existingPalette) {
        return existingPalette;
    }

    const wrapper = document.createElement("div");
    wrapper.innerHTML = createCommandPaletteTemplate();

    const palette = wrapper.firstElementChild;
    document.body.appendChild(palette);

    return palette;
}

function createResultButton(item, index) {
    return `
        <button
            type="button"
            class="command-result ${index === state.activeIndex ? "is-active" : ""}"
            data-command-result-index="${index}"
        >
            <span class="command-result-icon">${item.icon}</span>

            <span class="command-result-content">
                <span>${item.lotNumber} · ${item.type}</span>
                <strong>${item.title}</strong>
                <p>${item.description}</p>
            </span>

            <span class="command-result-action">${item.status}</span>
        </button>
    `;
}

function createEmptyTemplate() {
    return `
        <div class="command-empty">
            <div>
                <span>◇</span>
                <h3>No lots found</h3>
                <p>Try searching by lot number, asset name, category, status, or keyword such as watch, diamond, car, art.</p>
            </div>
        </div>
    `;
}

function renderResults() {
    const resultsContainer = document.querySelector("[data-command-results]");
    const countElement = document.querySelector("[data-command-count]");

    if (!resultsContainer) {
        return;
    }

    const items = getFilteredItems();

    if (state.activeIndex >= items.length) {
        state.activeIndex = Math.max(0, items.length - 1);
    }

    if (countElement) {
        countElement.textContent = String(items.length);
    }

    if (!items.length) {
        resultsContainer.innerHTML = createEmptyTemplate();
        renderDetail(null);
        return;
    }

    const groupedItems = groupItems(items);
    let currentIndex = 0;

    resultsContainer.innerHTML = Object.entries(groupedItems).map(([groupName, groupItemsList]) => {
        const groupMarkup = groupItemsList.map((item) => {
            const result = createResultButton(item, currentIndex);
            currentIndex += 1;
            return result;
        }).join("");

        return `
            <section class="command-group">
                <h3 class="command-group-title">${groupName}</h3>
                ${groupMarkup}
            </section>
        `;
    }).join("");

    document.querySelectorAll("[data-command-result-index]").forEach((button) => {
        button.addEventListener("mouseenter", () => {
            state.activeIndex = Number(button.dataset.commandResultIndex);
            renderDetail(getFilteredItems()[state.activeIndex]);
            updateActiveResult();
        });

        button.addEventListener("click", () => {
            const targetItem = getFilteredItems()[Number(button.dataset.commandResultIndex)];
            openItem(targetItem);
        });
    });

    renderDetail(items[state.activeIndex]);
}

function updateActiveResult() {
    document.querySelectorAll("[data-command-result-index]").forEach((button) => {
        button.classList.toggle("is-active", Number(button.dataset.commandResultIndex) === state.activeIndex);
    });

    const activeButton = document.querySelector(`[data-command-result-index="${state.activeIndex}"]`);

    if (activeButton) {
        activeButton.scrollIntoView({
            block: "nearest"
        });
    }
}

function renderDetail(item) {
    const detailContainer = document.querySelector("[data-command-detail]");

    if (!detailContainer) {
        return;
    }

    if (!item) {
        detailContainer.innerHTML = `
            <article class="command-detail-card">
                <span class="command-detail-icon">◇</span>
                <p class="command-detail-category">No Selection</p>
                <h2 class="command-detail-title">No lot found</h2>
                <p class="command-detail-description">
                    Search again with another keyword to find an auction item by name, category, status, or lot number.
                </p>
            </article>
        `;
        return;
    }

    detailContainer.innerHTML = `
        <article class="command-detail-card">
            <span class="command-detail-icon">${item.icon}</span>

            <p class="command-detail-category">${item.lotNumber} · ${item.type}</p>
            <h2 class="command-detail-title">${item.title}</h2>

            <p class="command-detail-description">${item.description}</p>

            <div class="command-detail-grid">
                <div>
                    <span>Current Bid</span>
                    <strong>${item.currentBid}</strong>
                </div>

                <div>
                    <span>Estimate</span>
                    <strong>${item.estimate}</strong>
                </div>

                <div>
                    <span>Status</span>
                    <strong>${item.status}</strong>
                </div>

                <div>
                    <span>Category</span>
                    <strong>${item.type}</strong>
                </div>
            </div>

            <a href="${resolveHref(item.href)}" class="button button-primary command-detail-link">
                View Lot
            </a>
        </article>
    `;
}

function openItem(item) {
    if (!item) {
        return;
    }

    window.location.href = resolveHref(item.href);
}

function openPalette() {
    const palette = ensureCommandPalette();
    const input = palette.querySelector("[data-command-input]");

    state.isOpen = true;
    palette.hidden = false;

    window.setTimeout(() => {
        input?.focus();
        input?.select();
    }, 0);

    renderResults();
}

function closePalette() {
    const palette = document.querySelector("[data-command-palette]");

    if (!palette) {
        return;
    }

    state.isOpen = false;
    palette.hidden = true;
}

function togglePalette() {
    if (state.isOpen) {
        closePalette();
    } else {
        openPalette();
    }
}

function bindOpenButtons() {
    document.querySelectorAll("[data-command-palette-open]").forEach((button) => {
        if (button.dataset.commandPaletteBound === "true") {
            return;
        }

        button.dataset.commandPaletteBound = "true";
        button.addEventListener("click", () => {
            openPalette();
        });
    });
}

function bindCommandPaletteEvents() {
    const palette = ensureCommandPalette();
    const input = palette.querySelector("[data-command-input]");

    input?.addEventListener("input", () => {
        state.query = input.value;
        state.activeIndex = 0;
        renderResults();
    });

    palette.addEventListener("click", (event) => {
        if (event.target === palette) {
            closePalette();
        }
    });

    bindOpenButtons();

    document.addEventListener("keydown", (event) => {
        const isModifierK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
        const isSlashShortcut = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
        const isTypingInField = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

        if (isModifierK) {
            event.preventDefault();
            togglePalette();
            return;
        }

        if (isSlashShortcut && !state.isOpen && !isTypingInField) {
            event.preventDefault();
            openPalette();
            return;
        }

        if (!state.isOpen) {
            return;
        }

        const items = getFilteredItems();

        if (event.key === "Escape") {
            event.preventDefault();
            closePalette();
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            state.activeIndex = Math.min(items.length - 1, state.activeIndex + 1);
            renderDetail(items[state.activeIndex]);
            updateActiveResult();
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            state.activeIndex = Math.max(0, state.activeIndex - 1);
            renderDetail(items[state.activeIndex]);
            updateActiveResult();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            openItem(items[state.activeIndex]);
        }
    });
}

function initCommandPalette() {
    if (isInitialized) {
        bindOpenButtons();
        return;
    }

    isInitialized = true;

    ensureCommandPalette();
    bindCommandPaletteEvents();
    renderResults();
}

export {
    initCommandPalette
};