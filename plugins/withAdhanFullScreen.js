/**
 * pass 83-31 — withAdhanFullScreen (Expo config plugin).
 *
 * The adhan notification must LIFT OVER the lock screen / a call
 * ("draw over other apps"). The manifest already declares
 * USE_FULL_SCREEN_INTENT, but expo-notifications creates Android channels
 * WITHOUT a full-screen intent — so the adhan lands as an ordinary
 * heads-up instead. This plugin patches the packaged
 * AndroidXNotificationsChannelManager at prebuild so the 'adhan' channel
 * always carries a full-screen intent that opens the app.
 *
 * Android 13+ still asks the user to allow "Alarms & reminders"/full-screen
 * notifications — one system prompt, standard for prayer apps.
 */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MANAGER_REL = 'src/main/java/expo/modules/notifications/notifications/channels/managers/AndroidXNotificationsChannelManager.java';

function patchManager(androidRoot) {
  const file = path.join(androidRoot, MANAGER_REL);
  if (!fs.existsSync(file)) {
    console.warn('withAdhanFullScreen: manager file not found — expo-notifications layout changed?');
    return;
  }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('DeenLink-83-31-FULLSCREEN')) return; /* idempotent */

  /* 1. keep a Context reference */
  const fieldAnchor = 'private final SoundResolver mSoundResolver;';
  if (!s.includes(fieldAnchor)) return;
  s = s.replace(
    fieldAnchor,
    fieldAnchor + '\n  /* DeenLink-83-31-FULLSCREEN — context for the adhan full-screen intent */\n  private final android.content.Context mContext;',
  );

  const ctorAnchor = '    mNotificationsChannelGroupManager = groupManager;\n  }';
  if (!s.includes(ctorAnchor)) return;
  s = s.replace(
    ctorAnchor,
    '    mNotificationsChannelGroupManager = groupManager;\n    mContext = context;\n  }',
  );

  /* 2. attach the full-screen intent when the 'adhan' channel is created/updated */
  const createAnchor = '    NotificationChannel channel = new NotificationChannel(channelId, name, importance);\n    configureChannelWithOptions(channel, channelOptions);';
  if (!s.includes(createAnchor)) return;
  s = s.replace(
    createAnchor,
    `    NotificationChannel channel = new NotificationChannel(channelId, name, importance);
    configureChannelWithOptions(channel, channelOptions);
    /* DeenLink-83-31-FULLSCREEN — adhan channel lifts over the lock screen */
    if ("adhan".equals(channelId) && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      try {
        android.content.Intent launch = mContext != null && mContext.getPackageManager() != null
          ? mContext.getPackageManager().getLaunchIntentForPackage(mContext.getPackageName())
          : null;
        if (launch != null) {
          android.app.PendingIntent pi = android.app.PendingIntent.getActivity(
            mContext, 918273, launch,
            android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT);
          channel.setFullScreenIntent(pi, true);
        }
      } catch (Exception e) { /* never block channel creation */ }
    }`,
  );

  fs.writeFileSync(file, s);
  console.log('withAdhanFullScreen: patched adhan channel with full-screen intent');
}

function withManifestPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest = manifest.manifest || {};
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] || [];
    const has = manifest.manifest['uses-permission'].some(
      (p) => p.$ && p.$['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT',
    );
    if (!has) {
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.USE_FULL_SCREEN_INTENT' },
      });
    }
    return config;
  });
}

module.exports = function withAdhanFullScreen(config) {
  config = withManifestPermission(config);
  return withDangerousMod(config, [
    'android',
    (config) => {
      patchManager(path.join(config.modRequest.platformProjectRoot, 'app'));
      return config;
    },
  ]);
};
