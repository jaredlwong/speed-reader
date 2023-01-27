import CopyPlugin from "copy-webpack-plugin";
import ESLintPlugin from "eslint-webpack-plugin";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import { join } from "path";
import * as webpack from "webpack";

const srcDir = join(__dirname, "src");

const config: webpack.Configuration = {
  entry: {
    reader: join(srcDir, "reader.tsx"),
    background: join(srcDir, "background.ts"),
    extension: join(srcDir, "extension.ts"),
    app: join(srcDir, "app.tsx"),
  },
  output: {
    path: join(__dirname, "dist/js"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "babel-loader",
          },
          {
            loader: "@linaria/webpack5-loader",
            options: {
              sourceMap: process.env.NODE_ENV !== "production",
            },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.(s)?css$/,
        exclude: /\.module\.(s)?css$/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
            },
          },
          {
            loader: "postcss-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: /\.module\.(s)?css$/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "@teamsupercell/typings-for-css-modules-loader",
          },
          {
            loader: "css-loader",
            options: {
              // modules: true,
              sourceMap: true,
              importLoaders: 1,
              modules: {
                localIdentName: "[local]--[hash:base64:5]",
              },
            },
          },
          {
            loader: "postcss-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    fallback: {
      buffer: require.resolve("buffer/"),
    },
  },
  plugins: [
    new CopyPlugin({
      // the `to` option is relative to the webpack output path (dist/js)
      patterns: [{ from: ".", to: "../", context: "public" }],
      options: {},
    }),
    new ESLintPlugin({
      emitError: true,
      emitWarning: true,
      failOnError: true,
      extensions: ["ts", "tsx", "js", "jsx"],
    }),
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
      },
    }),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ],
};
export default config;
