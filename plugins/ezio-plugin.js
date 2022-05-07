class EzioPlugin {
  constructor(options) {
    this.options = options;
  }
  apply(compiler) {
    compiler.hooks.run.tapAsync("EzioPlugin", (compiler, callback) => {
      console.log("start to run " + this.options.name);

      setTimeout(() => {
        console.log("Done with async run...");
        callback();
      }, 1000);
    });

    compiler.hooks.beforeRun.tapPromise("EzioPlugin", (compiler) => {
      return new Promise((resolve) => {
        console.log("start to beforeRun " + this.options.name);

        setTimeout(() => {
          console.log("Done with async beforeRun...");
          resolve();
        }, 1000);
      });
    });

    compiler.hooks.compile.tap("EzioPlugin", (compiler) => {
      console.log("start to compile ");
    });
  }
}

module.exports = EzioPlugin;
