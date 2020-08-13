// @flow
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import chalk from 'chalk';
import * as nodePath from 'path';
import { validateDynamicImportArguments } from './babel-validate-specifier.js';
function getLineCol(node) {
    const loc = node.loc.start;
    return chalk.dim(`[${loc.line}:${loc.column}]`);
}
export default function validate(code, fileLoc, cwd, dist, ignoreExtensions) {
    const ast = parse(code, {
        plugins: ['dynamicImport', 'importMeta'],
        sourceType: 'module',
    });
    const errors = new Set();
    function validateSpecifier(specifier, path) {
        const errors = new Set();
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
            if (!ignoreExtensions && !specifier.endsWith('.js')) {
                errors.add(`${getLineCol(path.node)} "${specifier}": Valid relative imports must include the ".js" file extension.`);
            }
            const absPathToImport = nodePath.resolve(nodePath.dirname(fileLoc), specifier);
            const assetsPath = nodePath.join(cwd, 'assets');
            if (!absPathToImport.startsWith(cwd)) {
                errors.add(`${getLineCol(path.node)} "${specifier}": Valid imports cannot reach outside of the current package.`);
            }
            else if (!absPathToImport.startsWith(assetsPath) && !absPathToImport.startsWith(dist)) {
                errors.add(`${getLineCol(path.node)} "${specifier}": Valid imports can only import from the dist directory or the sibling \`assets/\` directory.`);
            }
            return errors;
        }
        // NOTE(fks): Removed as "too opinionated" (rightfully!).
        // const parts = specifier.split('/').length;
        // if ((specifier.startsWith('@') && parts > 2) || (!specifier.startsWith('@') && parts > 1)) {
        //   errors.add(
        //     `${getLineCol(path.node)} "${specifier}": Avoid directly importing private files inside external packages.`,
        //   );
        //   return errors;
        // }
        return errors;
    }
    traverse(ast, {
        Identifier(path) {
            if (path.node.name === '__dirname') {
                errors.add(`${getLineCol(path.node)} \`__dirname\` is not a valid ESM global. Use \`import.meta.url\` instead.`);
            }
            if (path.node.name === '__filename') {
                errors.add(`${getLineCol(path.node)} \`__filename\` is not a valid ESM global. Use \`import.meta.url\` instead.`);
            }
            if (path.node.name === 'require' && path.parent.type !== 'CallExpression') {
                errors.add(`${getLineCol(path.node)} \`require()\` is not a valid ESM global. Use \`import()\` instead.`);
            }
            if (path.node.name === 'module' &&
                path.parent.type !== 'MemberExpression' &&
                path.parent.type !== 'ObjectProperty') {
                errors.add(`${getLineCol(path.node)} \`module\` is not a valid ESM global. Use \`export\` instead.`);
            }
            // TODO: Lint against other node concepts?
        },
        ImportDeclaration(path) {
            validateSpecifier(path.node.source.value, path).forEach(e => errors.add(e));
        },
        Import(path) {
            if (path.parent.type !== 'CallExpression') {
                errors.add(`${getLineCol(path.node)} \`import()\` should only be used/called directly.`);
                return;
            }
            const results = validateDynamicImportArguments(path);
            if (results.size > 0) {
                results.forEach(e => errors.add(e));
                return;
            }
            validateSpecifier(path.parent.arguments[0].value, path).forEach(e => errors.add(e));
        },
        MetaProperty(path) {
            if (!path.parent.property || path.parent.property.name !== 'url') {
                errors.add(`${getLineCol(path.node)} \`url\` is the only \`import.meta\` property currently supported in spec.`);
            }
        },
    });
    return errors;
}
