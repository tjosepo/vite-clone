import { join, resolve } from 'path';
import jsdom from 'jsdom';
import { cwd } from 'process';
import webpack, { Compiler, Dependency, NormalModule, ResolveData  } from 'webpack'
import CommonJsRequireDependency from "webpack/lib/dependencies/CommonJsRequireDependency"

const { JSDOM} = jsdom;
const { Module } = webpack;

class HtmlModule extends Module {
  context: string;
  request: string;
  buildInfo = {
    assets: [] as string[],
    fileDependencies: [] as string[];
  };

  constructor(init: { context: string, request: string }) {
    super("asset/source", init.context);
    this.request = init.request;
    this.context = init.context;
  }

  identifier() {
    return `${this.type}|${this.request}|${this.layer}`
  }

  build: typeof Module.prototype.build = (options, compilation, resolver, fs, callback) => {
    resolver.resolve({}, this.context, this.request, {}, (err, filename) => {
      if (!filename) {
        return;
      }

      fs.readFile(filename, async (err, content) => {
        if (!content) {
          return;
        }

        const html = content instanceof Buffer ? Buffer.from(content).toString("utf-8") : content;
        console.log(html);
        const dom = new JSDOM(html);

        const dependencies: string[] = [];
        dom.window.document.querySelectorAll("script").forEach((script) => {
          dependencies.push(script.src);
          this.buildInfo.fileDependencies.push(script.src);
        });


      });
    });
    callback();
  }
}

interface SpaWebpackPluginOptions {
  indexHtml: string;
}

export class SpaWebpackPlugin {
  options: SpaWebpackPluginOptions;

  constructor(options: SpaWebpackPluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler) {
    const pluginName = SpaWebpackPlugin.name;
    const { webpack } = compiler;
    const context = compiler.options.context ?? cwd();

    const indexHtmlPath = resolve(context, this.options.indexHtml);
    const { Compilation } = webpack;

    console.log("hello from spa plugin", indexHtmlPath);

    // RawSource is one of the "sources" classes that should be used
    // to represent asset sources in compilation.
    const { RawSource } = webpack.sources;

    // compiler.hooks.normalModuleFactory.tap(pluginName, (nmf) => {

    //   nmf.hooks.resolve.tap(pluginName, (resolveData: ResolveData) => {
    //     if (resolveData.request.endsWith(".tsx")) {
    //       console.log("assertions", resolveData.request);
    //     }
    //   });

    //   nmf.hooks.createModule.tap(pluginName, ( createData, resolveData) => {
    //     if(resolveData.request.endsWith(".html")) {
    //       const module = new HtmlModule({ context: resolveData.context, request: resolveData.request });
    //       Compi.fileDependencies.push(...module.fileDependencies)
    //       return module;
    //     }
    //     compilation.
    //   });
    // });

    // Tapping to the "thisCompilation" hook in order to further tap
    // to the compilation process on an earlier stage.
    compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
      compilation.hooks.buildModule.tap(pluginName, (module) => {
        console.log(module.request);
        module.dependencies.push("./src/index.tsx")
        compilation.fileDependencies.add("./src/index.tsx");
        compilation.addModule( new NormalModule({ 
          type: "javascript/auto",
        }));
      });

      compilation.hooks.afterOptimizeChunkIds.tap(pluginName, (chunks) => {
        // console.log("chunks", chunks);
      })

      compilation.hooks.beforeModuleIds.tap(pluginName, (modules) => {

        // console.log("modules", modules[0]);
      });

      // Tapping to the assets processing pipeline on a specific stage.
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        (assets) => {
          // compilation.emitAsset(
          //   this.options.outputFile,
          //   new RawSource(content)
          // );
        }
      );

    });
  }
}
