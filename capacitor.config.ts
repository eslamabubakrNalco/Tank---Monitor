import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eslamabubakr.waterwise',
  appName: 'WaterWise Calculator',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    Preferences: {
      group: 'WaterWiseStorage',
    },
  },
};

export default config;
