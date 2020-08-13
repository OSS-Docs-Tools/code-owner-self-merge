<p align="center">
  <img alt="Logo" src="https://i.imgur.com/MsQMjew.png" width="420">
</p>

<p align="center">
  <strong>standard-pkg</strong> • Build strict, ES2019 distributions from your project.
</p>

- 🗓 Updates yearly with the latest ECMAScript spec.
- ⚡️ Powered by Babel; Automatically includes any custom/experimental plugins found in your babel config.
- 📦 Used internally by most [@pika/pack](https://github.com/pikapkg/pack) build pipelines.

```
$ npm install -g standard-pkg
$ standard-pkg --src src/ --dist lib/
  » Building src/ → lib/...
  » Linting lib/...
  ✓ 0 issues found.
```


## Why?

### Lint Your Package to Strict ES2019 Spec

```
$ standard-pkg --dist lib/
  » Linting lib/...
  ⚠️ [lib/index.js 2:0] Imported file does not exist.
                        Missing file extension for import "./some/import".
  ✘  1 issues found.
```


### Publish Modern JavaScript With Your Package

```json
{
  "scripts": {"build": "standard-pkg --src src/ --lib lib/"},
  "esnext": "lib/index.js"
}
```


### Use Existing Tools with Experimental Language Features

Standard-pkg builds to a standard language target for other tooling to consume (or to publish directly with your package). This is especially useful if you're using TypeScript or experimental language features that your tooling may not support.


## Exceptions

While we try to match the ES2019 spec as strictly as possible, the following exceptions are required to support some common use-cases where no other workaround exists:

1. Supports bare module specifiers: This is the npm standard, and modern tooling like bundlers support it.
1. Supports dynamic `import()`: This is a [stage 4 proposal](https://github.com/tc39/proposal-dynamic-import) which allows dynamically importing modules.
1. Supports `import.meta.url`: This is a [stage 3 proposal](https://github.com/tc39/proposal-import-meta) which allows modules to read their location (filepath or URL).
