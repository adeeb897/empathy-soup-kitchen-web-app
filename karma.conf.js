/**
 * Karma configuration.
 *
 * Exists for one reason: Chrome refuses to start as root without --no-sandbox,
 * which is how it runs inside CI containers and dev containers. Without a
 * launcher that passes that flag, `ng test` cannot run there at all.
 *
 * Use the plain `ChromeHeadless` browser on a normal workstation; use
 * `ChromeHeadlessNoSandbox` in a container:
 *
 *   ng test --watch=false --browsers=ChromeHeadlessNoSandbox
 */
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
    ],
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
