const CONFIG = {
  APP_NAME: "BrosGem",

  THEME_STORAGE_KEY: "brosgem_theme",

  AUTH_TOKEN_KEY: "brosgem_auth_token",
  AUTH_USER_KEY: "brosgem_auth_user",

  LEGACY_AUTH_TOKEN_KEYS: ["jwt_token", "token", "auth_token"],

  LEGACY_AUTH_USER_KEYS: ["user_info", "user", "auth_user"],

  DEFAULT_THEME: "dark",

  MOCK_MODE: false,

  API: {
    BASE_URL: "https://auction-backend-8cp7.onrender.com/api",
    TIMEOUT_MS: 12000,
  },

  SOCKET: {
    URL: "https://auction-backend-8cp7.onrender.com",
    RECONNECT_ATTEMPTS: 5,
  },

  ROUTES: {
    HOME: "./index.html",
    COLLECTIONS: "./pages/collections.html",
    LIVE_AUCTIONS: "./pages/live-auctions.html",
    PRODUCT_DETAIL: "./pages/product-detail.html",
    LOGIN: "./pages/login.html",
    REGISTER: "./pages/register.html",
    FORGOT_PASSWORD: "./pages/forgot-password.html",
    ACCOUNT: "./pages/account.html",
    WATCHLIST: "./pages/watchlist.html",
    NOTIFICATIONS: "./pages/notifications.html",
    CONSIGN: "./pages/consign.html",
    CHECKOUT: "./pages/checkout.html",
    ADMIN: "./pages/admin.html",
    PUBLISH_LOT: "./pages/publish-lot.html",
  },

  PAGE_ROUTES: {
    HOME: "../index.html",
    COLLECTIONS: "./collections.html",
    LIVE_AUCTIONS: "./live-auctions.html",
    PRODUCT_DETAIL: "./product-detail.html",
    LOGIN: "./login.html",
    REGISTER: "./register.html",
    FORGOT_PASSWORD: "./forgot-password.html",
    ACCOUNT: "./account.html",
    WATCHLIST: "./watchlist.html",
    NOTIFICATIONS: "./notifications.html",
    CONSIGN: "./consign.html",
    CHECKOUT: "./checkout.html",
    ADMIN: "./admin.html",
    PUBLISH_LOT: "./publish-lot.html",
  },
};

window.BROSGEM_CONFIG = CONFIG;

export default CONFIG;
