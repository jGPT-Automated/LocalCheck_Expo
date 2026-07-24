// Wraps app.json so build-time secrets can come from env vars.
// @rnmapbox/maps is a NATIVE module: it needs this plugin + a full EAS build
// (tag → Release iOS) to reach devices — map JS changes after that ship OTA.
//
// MAPBOX_DOWNLOADS_TOKEN: a secret (sk.*) Mapbox token with the
// Downloads:Read scope, set as an EAS environment variable — required for the
// iOS/Android native SDK download during prebuild. The public EXPO_PUBLIC_
// MAPBOX_TOKEN in .env is NOT sufficient for builds (runtime tiles only).
const appJson = require("./app.json");

module.exports = ({ config }) => ({
  ...appJson.expo,
  ...config,
  plugins: [
    ...appJson.expo.plugins,
    [
      "@rnmapbox/maps",
      {
        RNMapboxMapsDownloadToken:
          process.env.MAPBOX_DOWNLOADS_TOKEN ?? undefined,
      },
    ],
  ],
});
