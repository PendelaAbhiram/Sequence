module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated/plugin must be listed last in plugins
      'react-native-reanimated/plugin',
    ],
  };
};
