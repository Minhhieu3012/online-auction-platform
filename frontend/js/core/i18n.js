import storage from "./storage.js";

const LANGUAGE_STORAGE_KEY = "trinity_piece_language";
const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "vi"];

const TRANSLATIONS = {
    en: {
        "nav.home": "Home",
        "nav.collections": "Collections",
        "nav.liveAuctions": "Live Auctions",
        "nav.privateTreaty": "Private Treaty",
        "nav.valuations": "Valuations",
        "nav.signIn": "Sign In",
        "nav.register": "Register",
        "nav.switchLanguage": "Switch language",

        "home.title": "Curated assets. Real-time bidding. Verified trust.",
        "home.eyebrow": "Bid Beyond Ownership",
        "home.description": "Access rare objects through a transparent auction experience designed for collectors, sellers, and administrators who demand speed, precision, and security.",
        "home.exploreCollections": "Explore Collections",
        "home.viewActiveLots": "View Active Lots",
        "home.aiFraud": "AI Fraud Detection",
        "home.aiFraudDesc": "Multi-layer shill-bidding surveillance.",
        "home.realTime": "Real-time Bidding",
        "home.realTimeDesc": "Live auction updates without refresh.",
        "home.secureCustody": "Secure Custody",
        "home.secureCustodyDesc": "Verified settlement and protected records.",
        "home.liveAuctions": "Live Auctions",
        "home.timeEssence": "Time is of the essence",
        "home.viewAllLots": "View All Lots",
        "home.protocol": "The Trinity Protocol",
        "home.protocolTitle": "A clean three-step auction journey",
        "home.protocolDesc": "From account verification to real-time bidding and final settlement, every interaction is designed to feel calm, premium, and trustworthy.",
        "home.step1": "Know Your Collector",
        "home.step1Desc": "Every participant passes account validation before entering private auction rooms.",
        "home.step2": "The Digital Gavel",
        "home.step2Desc": "Place manual or proxy bids through a latency-focused interface monitored in real time.",
        "home.step3": "Vault Settlement",
        "home.step3Desc": "Winning bids move into payment pending and complete after verified transaction flow.",
        "home.ctaEyebrow": "Elevate Your Portfolio",
        "home.ctaTitle": "Join a verified auction ecosystem built for rare assets.",
        "home.ctaDesc": "Start as a collector, seller, or administrator with an interface prepared for real-time auctions, AI alerts, and secure payment status tracking.",
        "home.createAccount": "Create Professional Account",

        "collections.eyebrow": "Curated Exclusivity",
        "collections.title": "Live Auctions",
        "collections.category": "Category",
        "collections.allCategories": "All Categories",
        "collections.all": "All",
        "collections.active": "Active",
        "collections.scheduled": "Scheduled",
        "collections.closing": "Closing",
        "collections.ended": "Ended",
        "collections.searchPlaceholder": "Find specific objects...",
        "collections.sortEnding": "Ending Soonest",
        "collections.sortHighest": "Highest Bid",
        "collections.sortNewest": "Newest",
        "collections.sortMostBids": "Most Bids",
        "collections.lotsFound": "{count} lots found",
        "collections.sortBy": "Sort by:",
        "collections.showing": "Showing {visible} of {total} lots",
        "collections.loadMore": "Load More Collections",
        "collections.noLots": "No lots matched your search",
        "collections.noLotsDesc": "Try another keyword, category, or auction status.",
        "collections.resetFilters": "Reset Filters",
        "collections.viewDetails": "View Details",
        "collections.estimate": "Estimate",
        "collections.currentBid": "Current Bid",
        "collections.startingBid": "Starting Bid",
        "collections.notOpen": "Not Open",
        "collections.bids": "{count} bids",
        "collections.endsIn": "Ends In:",
        "collections.startsIn": "Starts In:",
        "collections.auctionEnded": "Auction Ended",

        "detail.currentBid": "Current Bid",
        "detail.liveNow": "Live Now",
        "detail.closingIn": "Closing In",
        "detail.estimatedFinish": "Estimated Finish",
        "detail.hours": "Hours",
        "detail.minutes": "Minutes",
        "detail.seconds": "Seconds",
        "detail.minBid": "Min bid: {amount}",
        "detail.enableProxy": "Enable Proxy Bidding",
        "detail.proxyTooltip": "Proxy bidding lets you set your maximum price. The system will automatically raise your bid by the minimum increment only when needed, helping you stay leading without manually bidding every time.",
        "detail.maxBidLimit": "Maximum bid limit",
        "detail.placeBid": "Place Bid Now",
        "detail.bidHistory": "Bid History",
        "detail.activeBids": "{count} Active Bids",
        "detail.bidder": "Bidder",
        "detail.amount": "Amount",
        "detail.time": "Time",
        "detail.downloadHistory": "Download Full History",
        "detail.uiSimulation": "UI Simulation",
        "detail.uiSimulationDesc": "Use these buttons to test states before connecting backend and Socket.io.",
        "detail.simulateBid": "Simulate New Bid",
        "detail.simulateSoftClose": "Simulate Soft Close",
        "detail.clickToEnlarge": "Click to enlarge • Hover to inspect",
        "detail.lightboxCaption": "Move your cursor across the image to inspect details.",
        "detail.lightboxCaption360": "This lot supports a future 360° media viewer. Move your cursor to inspect the image now.",
        "detail.auctionProtocol": "Auction Protocol",
        "detail.startingPrice": "Starting Price",
        "detail.bidIncrement": "Bid Increment",
        "detail.auctionType": "Auction Type",
        "detail.english": "English",
        "detail.provenance": "Provenance",
        "detail.condition": "Condition",
        "detail.more": "+{count} More",
        "detail.view360": "360° View",

        "toast.bidRejected": "Bid Rejected",
        "toast.bidRejectedDesc": "Your bid must be at least {amount}.",
        "toast.proxyInvalid": "Proxy Bid Invalid",
        "toast.proxyInvalidDesc": "Maximum proxy bid must be greater than or equal to your bid.",
        "toast.proxyEnabled": "Proxy Bidding Enabled",
        "toast.proxyEnabledDesc": "Set your maximum bid limit to let the system bid for you.",
        "toast.proxyActivated": "Proxy Bid Activated",
        "toast.bidPlaced": "Bid Placed",
        "toast.newBid": "New Bid Received",
        "toast.auctionExtended": "Auction Extended",
        "toast.auctionExtendedDesc": "Soft-close activated. The auction was extended by 30 seconds.",
        "toast.preview360": "360° Preview Ready",
        "toast.preview360Desc": "This lot is prepared for a 360° viewer. Backend media upload can connect later.",
        "toast.manualBidPrefix": "Your manual bid was placed at",
        "toast.proxyBidPrefix": "Your proxy bidding limit started at",
        "toast.externalBidPrefix": "{bidder} placed"
    },

    vi: {
        "nav.home": "Trang chủ",
        "nav.collections": "Bộ sưu tập",
        "nav.liveAuctions": "Đấu giá trực tiếp",
        "nav.privateTreaty": "Giao dịch riêng",
        "nav.valuations": "Định giá",
        "nav.signIn": "Đăng nhập",
        "nav.register": "Đăng ký",
        "nav.switchLanguage": "Đổi ngôn ngữ",

        "home.title": "Tài sản tuyển chọn. Đấu giá thời gian thực. Niềm tin được xác thực.",
        "home.eyebrow": "Đấu giá vượt ngoài sở hữu",
        "home.description": "Khám phá các vật phẩm hiếm thông qua trải nghiệm đấu giá minh bạch, được thiết kế cho nhà sưu tầm, người bán và quản trị viên cần tốc độ, độ chính xác và sự an toàn.",
        "home.exploreCollections": "Khám phá bộ sưu tập",
        "home.viewActiveLots": "Xem phiên đang đấu",
        "home.aiFraud": "AI phát hiện gian lận",
        "home.aiFraudDesc": "Giám sát nhiều lớp chống đẩy giá ảo.",
        "home.realTime": "Đấu giá real-time",
        "home.realTimeDesc": "Cập nhật phiên đấu giá tức thời, không cần tải lại.",
        "home.secureCustody": "Lưu ký an toàn",
        "home.secureCustodyDesc": "Xác thực thanh toán và bảo vệ lịch sử giao dịch.",
        "home.liveAuctions": "Đấu giá trực tiếp",
        "home.timeEssence": "Thời gian là yếu tố quyết định",
        "home.viewAllLots": "Xem tất cả lô",
        "home.protocol": "Quy trình Trinity",
        "home.protocolTitle": "Hành trình đấu giá ba bước tinh gọn",
        "home.protocolDesc": "Từ xác thực tài khoản, đấu giá thời gian thực đến hoàn tất thanh toán, mọi tương tác đều được thiết kế cao cấp, rõ ràng và đáng tin cậy.",
        "home.step1": "Xác thực nhà sưu tầm",
        "home.step1Desc": "Mỗi người tham gia cần được xác thực trước khi vào phòng đấu giá riêng.",
        "home.step2": "Chiếc búa số",
        "home.step2Desc": "Đặt giá thủ công hoặc tự động qua giao diện tốc độ cao được giám sát real-time.",
        "home.step3": "Hoàn tất giao dịch",
        "home.step3Desc": "Giá thắng chuyển sang trạng thái chờ thanh toán và hoàn tất sau khi giao dịch được xác thực.",
        "home.ctaEyebrow": "Nâng tầm bộ sưu tập",
        "home.ctaTitle": "Tham gia hệ sinh thái đấu giá xác thực dành cho tài sản hiếm.",
        "home.ctaDesc": "Bắt đầu với vai trò nhà sưu tầm, người bán hoặc quản trị viên trong giao diện sẵn sàng cho đấu giá real-time, cảnh báo AI và theo dõi thanh toán an toàn.",
        "home.createAccount": "Tạo tài khoản chuyên nghiệp",

        "collections.eyebrow": "Tuyển chọn độc quyền",
        "collections.title": "Đấu giá trực tiếp",
        "collections.category": "Danh mục",
        "collections.allCategories": "Tất cả danh mục",
        "collections.all": "Tất cả",
        "collections.active": "Đang đấu",
        "collections.scheduled": "Sắp diễn ra",
        "collections.closing": "Sắp kết thúc",
        "collections.ended": "Đã kết thúc",
        "collections.searchPlaceholder": "Tìm vật phẩm cụ thể...",
        "collections.sortEnding": "Sắp kết thúc nhất",
        "collections.sortHighest": "Giá cao nhất",
        "collections.sortNewest": "Mới nhất",
        "collections.sortMostBids": "Nhiều lượt bid nhất",
        "collections.lotsFound": "{count} lô được tìm thấy",
        "collections.sortBy": "Sắp xếp:",
        "collections.showing": "Đang hiển thị {visible} / {total} lô",
        "collections.loadMore": "Tải thêm bộ sưu tập",
        "collections.noLots": "Không có lô phù hợp",
        "collections.noLotsDesc": "Thử từ khóa, danh mục hoặc trạng thái đấu giá khác.",
        "collections.resetFilters": "Đặt lại bộ lọc",
        "collections.viewDetails": "Xem chi tiết",
        "collections.estimate": "Ước tính",
        "collections.currentBid": "Giá hiện tại",
        "collections.startingBid": "Giá khởi điểm",
        "collections.notOpen": "Chưa mở",
        "collections.bids": "{count} lượt bid",
        "collections.endsIn": "Kết thúc sau:",
        "collections.startsIn": "Bắt đầu sau:",
        "collections.auctionEnded": "Đã kết thúc",

        "detail.currentBid": "Giá hiện tại",
        "detail.liveNow": "Đang diễn ra",
        "detail.closingIn": "Kết thúc sau",
        "detail.estimatedFinish": "Dự kiến kết thúc",
        "detail.hours": "Giờ",
        "detail.minutes": "Phút",
        "detail.seconds": "Giây",
        "detail.minBid": "Giá tối thiểu: {amount}",
        "detail.enableProxy": "Bật đặt giá tự động",
        "detail.proxyTooltip": "Đặt giá tự động cho phép bạn đặt mức giá tối đa. Hệ thống sẽ tự tăng giá theo bước tối thiểu khi cần, giúp bạn giữ vị trí dẫn đầu mà không phải bid thủ công liên tục.",
        "detail.maxBidLimit": "Giới hạn giá tối đa",
        "detail.placeBid": "Đặt giá ngay",
        "detail.bidHistory": "Lịch sử đặt giá",
        "detail.activeBids": "{count} lượt bid",
        "detail.bidder": "Người bid",
        "detail.amount": "Số tiền",
        "detail.time": "Thời gian",
        "detail.downloadHistory": "Tải toàn bộ lịch sử",
        "detail.uiSimulation": "Mô phỏng UI",
        "detail.uiSimulationDesc": "Dùng các nút này để test trạng thái trước khi kết nối backend và Socket.io.",
        "detail.simulateBid": "Mô phỏng bid mới",
        "detail.simulateSoftClose": "Mô phỏng gia hạn giờ",
        "detail.clickToEnlarge": "Nhấp để phóng to • Rê chuột để xem kỹ",
        "detail.lightboxCaption": "Di chuyển chuột trên ảnh để xem chi tiết.",
        "detail.lightboxCaption360": "Vật phẩm này đã sẵn sàng cho trình xem 360° trong tương lai. Hiện tại có thể rê chuột để xem kỹ ảnh.",
        "detail.auctionProtocol": "Quy tắc đấu giá",
        "detail.startingPrice": "Giá khởi điểm",
        "detail.bidIncrement": "Bước giá",
        "detail.auctionType": "Loại đấu giá",
        "detail.english": "English",
        "detail.provenance": "Nguồn gốc",
        "detail.condition": "Tình trạng",
        "detail.more": "+{count} ảnh",
        "detail.view360": "Xem 360°",

        "toast.bidRejected": "Bid bị từ chối",
        "toast.bidRejectedDesc": "Giá đặt phải tối thiểu {amount}.",
        "toast.proxyInvalid": "Đặt giá tự động không hợp lệ",
        "toast.proxyInvalidDesc": "Giới hạn giá tự động phải lớn hơn hoặc bằng giá bạn đặt.",
        "toast.proxyEnabled": "Đã bật đặt giá tự động",
        "toast.proxyEnabledDesc": "Thiết lập mức giá tối đa để hệ thống tự bid giúp bạn.",
        "toast.proxyActivated": "Đã kích hoạt đặt giá tự động",
        "toast.bidPlaced": "Đặt giá thành công",
        "toast.newBid": "Có lượt bid mới",
        "toast.auctionExtended": "Phiên đấu giá được gia hạn",
        "toast.auctionExtendedDesc": "Soft-close đã kích hoạt. Phiên đấu giá được cộng thêm 30 giây.",
        "toast.preview360": "Đã sẵn sàng xem 360°",
        "toast.preview360Desc": "Vật phẩm này đã chuẩn bị cho trình xem 360°. Sau này có thể nối upload media từ backend.",
        "toast.manualBidPrefix": "Bạn đã đặt giá thủ công ở mức",
        "toast.proxyBidPrefix": "Giới hạn đặt giá tự động của bạn bắt đầu ở mức",
        "toast.externalBidPrefix": "{bidder} vừa đặt"
    }
};

let currentLanguage = normalizeLanguage(storage.get(LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE));
const languageSubscribers = new Set();

function normalizeLanguage(language) {
    if (SUPPORTED_LANGUAGES.includes(language)) {
        return language;
    }

    return DEFAULT_LANGUAGE;
}

function interpolate(template, params = {}) {
    return Object.entries(params).reduce((result, [key, value]) => {
        return result.replaceAll(`{${key}}`, String(value));
    }, template);
}

function t(key, params = {}) {
    const dictionary = TRANSLATIONS[currentLanguage] || TRANSLATIONS[DEFAULT_LANGUAGE];
    const fallbackDictionary = TRANSLATIONS[DEFAULT_LANGUAGE];

    const template = dictionary[key] || fallbackDictionary[key] || key;

    return interpolate(template, params);
}

function getLanguage() {
    return currentLanguage;
}

function updateLanguageButtons() {
    const nextLanguage = currentLanguage === "en" ? "VI" : "EN";

    document.querySelectorAll("[data-language-label]").forEach((element) => {
        element.textContent = nextLanguage;
    });

    document.querySelectorAll("[data-language-toggle]").forEach((button) => {
        button.setAttribute("aria-label", t("nav.switchLanguage"));
        button.setAttribute("title", t("nav.switchLanguage"));
    });
}

function translateDocument(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = t(element.dataset.i18n);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
        element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });

    root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
        element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });

    root.querySelectorAll("[data-i18n-title]").forEach((element) => {
        element.setAttribute("title", t(element.dataset.i18nTitle));
    });

    updateLanguageButtons();
}

function notifySubscribers() {
    languageSubscribers.forEach((callback) => {
        callback(currentLanguage);
    });
}

function setLanguage(language) {
    const normalizedLanguage = normalizeLanguage(language);

    currentLanguage = normalizedLanguage;
    storage.set(LANGUAGE_STORAGE_KEY, normalizedLanguage);

    document.documentElement.setAttribute("lang", normalizedLanguage);
    translateDocument();
    notifySubscribers();

    return normalizedLanguage;
}

function toggleLanguage() {
    const nextLanguage = currentLanguage === "en" ? "vi" : "en";
    return setLanguage(nextLanguage);
}

function bindLanguageToggles() {
    document.querySelectorAll("[data-language-toggle]").forEach((button) => {
        button.addEventListener("click", toggleLanguage);
    });
}

function onLanguageChange(callback) {
    languageSubscribers.add(callback);

    return () => {
        languageSubscribers.delete(callback);
    };
}

function initI18n() {
    document.documentElement.setAttribute("lang", currentLanguage);
    bindLanguageToggles();
    translateDocument();
}

export {
    initI18n,
    translateDocument,
    t,
    getLanguage,
    setLanguage,
    toggleLanguage,
    onLanguageChange
};