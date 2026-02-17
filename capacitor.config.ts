import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.umshado.app',
  appName: 'uMshado',
  webDir: 'public',
  server: {
    url: 'https://umshado-app.vercel.app',
    cleartext: true,
  },
};

export default config;
