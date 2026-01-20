Source code lives in a [yarn workspace](https://classic.yarnpkg.com/lang/en/docs/workspaces/) within the `langchain_soniox/src/` directory.

By default, there is a single entrypoint under `langchain_soniox/src/index.ts` that you should re-export all relevant classes and functions from.
If you want to add more entrypoints, add them in `langchain_soniox/scripts/create-entrypoints.js`.

To build your source code, run the following commands:

```bash
$ cd langchain-soniox
$ yarn build
```

The build process will automatically create build artifacts for both ESM and CJS.

You'll need to run the above command before publishing new versions!

```bash
$ npm publish
```

Prettier and ESLint are also configured:

```bash
$ yarn format
$ yarn lint
```

As well as Jest for testing. Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ yarn test
$ SONIOX_API_KEY=<key> yarn test:int
```
