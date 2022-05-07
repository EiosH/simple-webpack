const path = require("path");
const EzioPlugin = require("./plugins/ezio-plugin");

module.exports = {
  mode: "development",
  entry: "./demo/index.ts",
  output: "./output/boundle.js",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "babel-loader",
          // 应该应用的 loader，它相对上下文解析
          options: {
            presets: ["@babel/preset-typescript"],
          },
        },
      },
      {
        test: /\.js$/,
        use: {
          loader: path.resolve(__dirname, "./loaders/ezio-loader.js"),
          options: {
            name: "ezio",
          },
        },
      },
    ],
  },
  plugins: [
    new EzioPlugin({
      name: "ezio",
    }),
  ],
};
