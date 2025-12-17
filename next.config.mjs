/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: function (config, { isServer }) {
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
            layers: true,
            topLevelAwait: true,
        };
        // Fix for MeshSDK / WebAssembly issues
        config.module.rules.push({
            test: /\.wasm$/,
            type: "webassembly/async",
        });

        config.output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm';
        return config;
    },
};

export default nextConfig;
