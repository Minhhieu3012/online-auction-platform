const CONFIG = {
    APP_NAME: "Trinity Piece",

    THEME_STORAGE_KEY: "trinity_piece_theme",

    DEFAULT_THEME: "dark",

    ROUTES: {
        HOME: "./index.html",
        COLLECTIONS: "./pages/collections.html",
        PRODUCT_DETAIL: "./pages/product-detail.html",
        LOGIN: "./pages/login.html",
        REGISTER: "./pages/register.html",
        PROFILE: "./pages/profile.html",
        SELLER_DASHBOARD: "./pages/seller-dashboard.html",
        AUCTION_FORM: "./pages/auction-form.html",
        ADMIN_DASHBOARD: "./pages/admin-dashboard.html"
    },

    MOCK_MODE: true,

    API: {
        BASE_URL: "http://localhost:3000/api",
        TIMEOUT_MS: 12000
    },

    SOCKET: {
        URL: "http://localhost:3000",
        RECONNECT_ATTEMPTS: 5
    }
};

export default CONFIG;