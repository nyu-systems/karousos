import resolve from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import ts from 'rollup-plugin-typescript2'
import pkg from './package.json'

export default {
    input: 'src/index.ts',
    output: [
        {
            file: pkg.main,
            format: 'cjs',
            sourcemap: true
        }
    ],
    external: [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
    ],
    plugins: [
        resolve({}),
        ts(),
        terser(),
    ]
}


