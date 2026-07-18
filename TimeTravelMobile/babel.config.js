function transformImportMeta({ types: t }) {
  function createProcessEnvNode() {
    return t.memberExpression(
      t.memberExpression(t.identifier("process"), t.identifier("env")),
      t.identifier("NODE_ENV"),
    );
  }

  function createImportMetaReplacement() {
    return t.objectExpression([
      t.objectProperty(
        t.identifier("env"),
        t.objectExpression([
          t.objectProperty(t.identifier("MODE"), createProcessEnvNode()),
          t.objectProperty(
            t.identifier("DEV"),
            t.binaryExpression(
              "!==",
              createProcessEnvNode(),
              t.stringLiteral("production"),
            ),
          ),
          t.objectProperty(
            t.identifier("PROD"),
            t.binaryExpression(
              "===",
              createProcessEnvNode(),
              t.stringLiteral("production"),
            ),
          ),
        ]),
      ),
      t.objectProperty(t.identifier("url"), t.stringLiteral("")),
    ]);
  }

  return {
    name: "transform-import-meta",
    visitor: {
      MetaProperty(path) {
        if (
          path.node.meta.name === "import" &&
          path.node.property.name === "meta"
        ) {
          path.replaceWith(createImportMetaReplacement());
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      transformImportMeta,
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./src",
            "@components": "./src/components",
            "@features": "./src/features",
            "@hooks": "./src/hooks",
            "@services": "./src/services",
            "@stores": "./src/stores",
            "@theme": "./src/theme",
            "@types": "./src/types",
            "@utils": "./src/utils",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
