import { join } from "path";
import CopyPlugin from "copy-webpack-plugin";
import * as webpack from 'webpack';

const srcDir = join(__dirname, "..", "src");

const config: webpack.Configuration = {
    entry: {
        reader: join(srcDir, 'reader.tsx'),
        background: join(srcDir, 'background.ts'),
        extension: join(srcDir, 'extension.ts'),
    },
    output: {
        path: join(__dirname, "../dist/js"),
        filename: "[name].js",
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: [
                    "style-loader",
                    "@teamsupercell/typings-for-css-modules-loader",
                    {
                      loader: "css-loader",
                      options: { modules: true }
                    },
                ],
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    plugins: [
        new CopyPlugin({
            // the `to` option is relative to the webpack output path
            patterns: [{ from: ".", to: "../", context: "public" }],
            options: {},
        }),
    ],
}
export default config;