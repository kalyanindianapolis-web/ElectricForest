import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.happyforest.crew',
  appName: 'Happy Forest',
  webDir: 'dist',
  backgroundColor: '#10210a',
  ios: { backgroundColor: '#10210a', contentInset: 'never' },
  android: { backgroundColor: '#10210a' },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,        // we hide it from JS once React mounts
      backgroundColor: '#10210a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
