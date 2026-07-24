// *.md files are bundled as plain strings by md-transformer.js.
declare module '*.md' {
  const content: string;
  export default content;
}
