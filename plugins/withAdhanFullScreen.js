/**
 * withAdhanFullScreen (Expo config plugin).
 *
 * WHAT IT DOES NOW — two independent halves, and only one of them works:
 *
 *  1. `withManifestPermission` adds android.permission.USE_FULL_SCREEN_INTENT
 *     to the manifest. VERIFIED WORKING: I ran `expo prebuild --platform android`
 *     on 2026-10-20 and the permission is present in the generated
 *     android/app/src/main/AndroidManifest.xml.
 *
 *  2. `patchManager` was supposed to patch expo-notifications'
 *     AndroidXNotificationsChannelManager.java so the 'adhan' channel calls
 *     channel.setFullScreenIntent(...) and therefore lifts over the lock screen
 *     or an ongoing call. THIS HALF IS DEAD ON SDK 57 and has been for as long
 *     as this project has been on SDK 57 (expo 57.0.16, expo-notifications
 *     57.0.17).
 *
 * WHY IT IS DEAD. The patch edits a .java file inside the generated android/
 * project. Since the Expo modules are shipped as prebuilt AARs rather than
 * source, `android/app/src/main/java/` contains only `org/` — there is no
 * `expo/modules/notifications/...` tree to patch. Verified by prebuild, not
 * guessed. `expo-notifications` declares no way to set a full-screen intent on a
 * channel from JS either (`setNotificationChannelAsync` has no such option), so
 * there is no supported JS-side replacement.
 *
 * WHAT THAT MEANS IN PRACTICE. The adhan still fires as a MAX-importance
 * heads-up notification with sound and vibration on the dedicated 'adhan'
 * channel, including when the app is closed. It does NOT lift a full-screen
 * activity over the lock screen or over a call. That is a real reduction from
 * what the original comment promised, and on Android 14+ a full-screen intent
 * also needs the user to grant "Alarms & reminders" special access unless the
 * app is a default alarm/calling app — so even a working patch would not be
 * unconditional.
 *
 * RESTORING IT properly means adding a small native module (Kotlin) that builds
 * the 'adhan' NotificationChannel itself with setFullScreenIntent, registered at
 * application start. That is deliberate native work which cannot be verified in
 * this environment — there is no Android SDK, no emulator and no device here —
 * so it is NOT being attempted blind under an active Play review. The previous
 * version of this file silently returned from four different places, which is
 * how a dead patch stayed in the build config looking alive. Every failure path
 * below now prints, and the summary line states plainly whether the patch was
 * applied.
 */
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MANAGER_REL = 'src/main/java/expo/modules/notifications/notifications/channels/managers/AndroidXNotificationsChannelManager.java';
const MARKER = 'DeenLink-83-31-FULLSCREEN';

function patchManager(androidRoot) {
  const file = path.join(androidRoot, MANAGER_REL);
  if (!fs.existsSync(file)) {
    console.warn(
      '\nwithAdhanFullScreen: FULL-SCREEN INTENT PATCH NOT APPLIED.\n' +
      '  Expected source file: ' + MANAGER_REL + '\n' +
      '  Reason: expo-notifications ships as a prebuilt AAR on SDK 57, so that\n' +
      '          Java file does not exist in the generated android/ project.\n' +
      '  Effect: the adhan arrives as a MAX-importance heads-up notification\n' +
      '          (sound + vibration, works with the app closed) but does NOT lift\n' +
      '          a full-screen activity over the lock screen or a call.\n' +
      '  USE_FULL_SCREEN_INTENT is still declared in the manifest, so nothing is\n' +
      '  lost if the patch is restored later. Restoring it needs a small native\n' +
      '  Kotlin module that builds the adhan channel itself — see the header of\n' +
      '  plugins/withAdhanFullScreen.js.\n'
    );
    return false;
  }

  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARKER)) {
    console.log('withAdhanFullScreen: already patched (idempotent)');
    return true;
  }

  /* Each anchor used to `return` with no output at all, so a layout change in
   * expo-notifications looked exactly like success. Report which one moved. */
  const fieldAnchor = 'private final SoundResolver mSoundResolver;';
  if (!s.includes(fieldAnchor)) {
    console.warn('withAdhanFullScreen: NOT APPLIED - field anchor missing (SoundResolver field moved or was renamed)');
    return false;
  }
  s = s.replace(
    fieldAnchor,
    fieldAnchor + '\n  /* ' + MARKER + ' — context for the adhan full-screen intent */\n  private final android.content.Context mContext;',
  );

  const ctorAnchor = '    mNotificationsChannelGroupManager = groupManager;\n  }';
  if (!s.includes(ctorAnchor)) {
    console.warn('withAdhanFullScreen: NOT APPLIED - constructor anchor missing');
    return false;
  }
  s = s.replace(
    ctorAnchor,
    '    mNotificationsChannelGroupManager = groupManager;\n    mContext = context;\n  }',
  );

  const createAnchor = '    NotificationChannel channel = new NotificationChannel(channelId, name, importance);\n    configureChannelWithOptions(channel, channelOptions);';
  if (!s.includes(createAnchor)) {
    console.warn('withAdhanFullScreen: NOT APPLIED - channel-creation anchor missing');
    return false;
  }
  s = s.replace(
    createAnchor,
    `    NotificationChannel channel = new NotificationChannel(channelId, name, importance);
    configureChannelWithOptions(channel, channelOptions);
    /* ${MARKER} — adhan channel lifts over the lock screen */
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
  return true;
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

/* Exported for the prebuild self-check (scripts/verify-android-build.mjs), which
 * asserts the permission half works and records that the patch half did not. */
module.exports.patchManager = patchManager;
module.exports.MANAGER_REL = MANAGER_REL;
