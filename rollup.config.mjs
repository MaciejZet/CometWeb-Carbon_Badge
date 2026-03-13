import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
    input: 'src/index.ts',
    output: [
        {
            file: 'dist/cometweb-carbon-badge.esm.js',
            format: 'es',
            sourcemap: false,
        },
        {
            file: 'dist/cometweb-carbon-badge.umd.js',
            format: 'umd',
            name: 'CometWebCarbonBadge',
            sourcemap: false,
        },
    ],
    plugins: [
        typescript({
            tsconfig: './tsconfig.json',
            declaration: true,
            declarationDir: 'dist',
        }),
        terser({
            compress: {
                drop_console: true,
                passes: 2,
            },
            mangle: true,
        }),
    ],
};
