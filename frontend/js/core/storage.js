const storage = {
    get(key, fallbackValue = null) {
        try {
            const rawValue = window.localStorage.getItem(key);

            if (rawValue === null || rawValue === undefined) {
                return fallbackValue;
            }

            return JSON.parse(rawValue);
        } catch (error) {
            console.warn(`[storage] Cannot read key "${key}"`, error);
            return fallbackValue;
        }
    },

    getRaw(key, fallbackValue = null) {
        try {
            const rawValue = window.localStorage.getItem(key);

            if (rawValue === null || rawValue === undefined) {
                return fallbackValue;
            }

            return rawValue;
        } catch (error) {
            console.warn(`[storage] Cannot read raw key "${key}"`, error);
            return fallbackValue;
        }
    },

    set(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`[storage] Cannot write key "${key}"`, error);
            return false;
        }
    },

    setRaw(key, value) {
        try {
            window.localStorage.setItem(key, String(value));
            return true;
        } catch (error) {
            console.warn(`[storage] Cannot write raw key "${key}"`, error);
            return false;
        }
    },

    remove(key) {
        try {
            window.localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`[storage] Cannot remove key "${key}"`, error);
            return false;
        }
    },

    clear() {
        try {
            window.localStorage.clear();
            return true;
        } catch (error) {
            console.warn("[storage] Cannot clear localStorage", error);
            return false;
        }
    }
};

export default storage;