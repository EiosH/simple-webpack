const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

const { AsyncHook, SyncHook } = require("./tapable");

enum DependencyType {
  NORMAL = 0,
  LAZY = 1,
}
interface Dependency {
  fileName: string;
  type?: DependencyType;
}
interface Module {
  fileName: string;
  dependencies: Dependency[];
  code: string;
  id: number;
  map: Record<string, number>;
}

interface Rule {
  test: RegExp;
  use: {
    loader: string;
    options: Record<string, any>;
  };
}

interface Plugin_ {
  apply(compiler: Compiler): void;
}
interface Config {
  entry: string;
  output: string;
  module?: {
    rules?: Rule[];
  };
  plugins?: Plugin_[];
}

const createModule = (fileName: string, id: number, rules?: Rule[]) => {
  const buffer = fs.readFileSync(fileName, "utf-8");

  let code: string = buffer;
  if (rules?.length) {
    for (let rule of rules.reverse()) {
      const { test, use } = rule;
      const { loader, options } = use || {};

      if (test.test(fileName)) {
        if (loader === "babel-loader") {
          code = babel.transformSync(code, {
            filename: "file.ts",
            ...options,
          }).code;
        } else {
          code = require(loader)(code, options);
        }
      }
    }
  }

  const ast = parser.parse(code, { sourceType: "module" });

  // 依赖收集
  const dependencies: Dependency[] = [];

  // 使用 traverse 来遍历 AST
  traverse(ast, {
    ImportDeclaration({ node }: { node: any }) {
      let path = node.source.value;
      dependencies.push({
        fileName: path,
      });
    },

    CallExpression(path: { node: any }) {
      const { node } = path;

      if (node.callee.type === "Import") {
        const path = node.arguments[0].value;
        dependencies.push({
          fileName: path,
          type: DependencyType.LAZY,
        });
      }
    },
  });

  // 将抽象语法树转换成浏览器可以运行的代码
  code = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  }).code;

  return {
    fileName,
    dependencies,
    code,
    id,
    map: {},
  } as Module;
};

function createDependenceMap(fileName: string, rules?: Rule[]) {
  let globalId = 0;
  const fileNameQueue = [fileName];
  const moduleQueue: Array<Module & { lazy: boolean }> = [];
  const lazyModuleQueue: string[] = [];

  for (let index = 0; index < fileNameQueue.length; index++) {
    const filename = fileNameQueue[index];
    const module = createModule(filename, Number(index), rules);
    moduleQueue.push({
      ...module,
      lazy: lazyModuleQueue.includes(module.fileName),
    });

    module.dependencies.forEach(({ fileName: dependencePath, type }) => {
      module.map[dependencePath] = ++globalId;
      const dirname = path.dirname(fileName);
      const absolutePath = `./${path.join(dirname, dependencePath)}`;

      fileNameQueue.push(absolutePath);
      if (type === DependencyType.LAZY) {
        lazyModuleQueue.push(absolutePath);
      }
    });
  }

  // 返回模块队列
  return moduleQueue;
}

function getBoundle(dependenceGraph: Array<Module & { lazy: boolean }>) {
  let modules = "";

  // 对依赖模块进行处理
  dependenceGraph.forEach((module) => {
    modules += `${module.id}: [
       function (require, module, exports) {
         ${
           module.lazy
             ? `
             const res = new Promise((resolve, reject) => {
              resolve({a:1})

              const document = self.document;
              const script = document.createElement("script");
              script.src = "../output/${module.id}.js";
              document.head.append(script);
              script.onload = ()=>{
                self.lazyChunk${module.id}(require, module, exports)

                resolve(exports)
              };
              script.onerror = reject;
            });

            return res
        `
             : module.code
         }
       },
       ${JSON.stringify(module.map)},
     ],`;

    if (module.lazy) {
      write(
        `./output/${module.id}.js`,
        `
        self.lazyChunk${module.id} = (require, module, exports) => {
          ${module.code}
        }`
      );
    }
  });

  modules = modules.slice(0, -1);

  // 进行逻辑整合
  const result = `
     (function(modules) {
      function moduleEnv(index) {
        const [code, map] = modules[index];
        
        function require(name) {
          return moduleEnv(map[name])
        }

        const module = { exports: {} }
        code(require, module, module.exports)
        return module.exports
      }
      moduleEnv(0)
     })({${modules}})
   `;
  return result;
}

const write = (output: string, code: string) => {
  fs.writeFileSync(output, code);
};

const getConfig = () => {
  let config: Config = {
    entry: "./index.ts",
    output: "./output/boundle.js",
  };

  try {
    config = require("../webpack.config");
  } catch (e) {}

  return config;
};

class Compiler {
  config: Config;
  hooks: any;

  constructor(config: Config) {
    this.config = config;
    this.hooks = {
      run: new AsyncHook(),
      beforeRun: new AsyncHook(),
      compile: new SyncHook(),
    };
  }

  run() {
    const boundle = this.compile();

    this.hooks.beforeRun.promise(this).then(() => {
      this.hooks.run.callAsync(this, (err: any) => {
        if (err) return;

        this.hooks.compile.call(this);
        write(this.config.output, boundle);
      });
    });
  }

  compile() {
    const dependenceMap = createDependenceMap(
      this.config.entry,
      this.config?.module?.rules
    );

    const boundle = getBoundle(dependenceMap);

    return boundle;
  }
}

const webpack = (options: Config) => {
  const compiler = new Compiler(options);

  const plugins = options?.plugins;

  if (plugins?.length) {
    for (let plugin of plugins) {
      plugin.apply(compiler);
    }
  }

  compiler.run();
};

webpack(getConfig());
