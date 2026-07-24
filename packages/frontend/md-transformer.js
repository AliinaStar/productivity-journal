// Metro transformer that bundles *.md files as plain-string modules, so a
// screen can `import policy from '.../privacy-policy.md'` and render its text.
// This lets the privacy policy live in exactly one place (docs/privacy-policy.md)
// instead of being copied into the i18n bundles.
//
// Anything that is not Markdown is handed straight to Expo's default
// transformer, untouched.
const upstream = require('@expo/metro-config/build/babel-transformer');

module.exports.transform = function transform(props) {
  if (props.filename.endsWith('.md')) {
    return upstream.transform({
      ...props,
      src: `module.exports = ${JSON.stringify(props.src)};`,
    });
  }
  return upstream.transform(props);
};
