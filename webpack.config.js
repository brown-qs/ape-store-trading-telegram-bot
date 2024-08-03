const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const TerserWebpackPlugin = require("terser-webpack-plugin");
module.exports = {
  mode: "production",
  optimization: {
    splitChunks: {
      chunks: "all",
      minSize: 30 * 1024, // more than the30kbOnly then will be divided
    },
    minimize: false,
    minimizer: [
      // Configure the compression plan of the production environment：jsandcss
      new TerserWebpackPlugin({
        exclude: /\/mysql/,
        // Open multi -process packaging
        parallel: true,
        terserOptions: {
          output: {
            // Whether to output the code with strong readability，That is, the space and the component will be retained，The default is output，In order to achieve a better compression effect，Can be set tofalse
            beautify: false,
            // Whether to keep the annotation in the code，Default，In order to achieve a better compression effect，Can be set tofalse
            comments: false,
          },
          compress: {
            // WhetherUglifyJSOutput warning information when you delete the unused code，The default is output，Can be set tofalseClose these warnings that have little role
            warnings: false,
            // Whether to delete everything in the codeconsoleSentence，Default is not deleted，After opening，Will delete allconsoleSentence
            drop_console: false,
            drop_debugger: true,
            // Whether it is embedded, although it has been defined，But only one time variable is used，For example var x = 1; y = x, Convert y = 5, The default is not converted，In order to achieve a better compression effect，Can be set tofalse
            collapse_vars: true,
            // Whether to extract many times but not defined as a static value referenced by variables，For example x = 'xxx'; y = 'xxx'  Convertvar a = 'xxxx'; x = a; y = a; The default is not converted，In order to achieve a better compression effect，Can be set tofalse
            reduce_vars: false,
          },
        },
      }),
    ],
  },
  entry: () => {
    return "./index.ts";
  },
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "[name].js",
    library: "dandao", // The specified is your userequireTime module name
    libraryTarget: "umd", // libraryTargetCan generate differentumdCode,Can justcommonjsstandard，It can also refer toamdstandard，It can be just passedscriptTag introduced
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  target: "node",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader",
        },
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [new CleanWebpackPlugin()],
};
