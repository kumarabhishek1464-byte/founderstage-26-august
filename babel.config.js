/**
 * Deliberately minimal.
 *
 * `babel-preset-expo` already resolves and injects `react-native-worklets/plugin`
 * automatically whenever the package is installed (see
 * babel-preset-expo/build/configs/expo.js). Adding it here as well double-transforms
 * worklets and produces confusing runtime failures in Reanimated.
 *
 * So: do not add `react-native-worklets/plugin` or `react-native-reanimated/plugin`
 * to this file. If you believe a worklet is not being transformed, check that
 * `react-native-worklets` is installed rather than adding the plugin.
 */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
  };
};
