import { PM5CapacitorDriver } from '@readyall/erglink/pm5/capacitor';
import { mobileSQLiteCaptureStore } from '@readyall/erglink/pm5/storage/sqlite';

export const nativeBluetoothService = new PM5CapacitorDriver({
    persistCapture: async (capture, savedAt) => {
        await mobileSQLiteCaptureStore.save(capture, savedAt);
    },
});
