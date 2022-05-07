module.exports = function (source, options) {
  return `${source}
  console.log("loader 执行了 ${options.name}")
  // ezio love ${options.name}
  `;
};
