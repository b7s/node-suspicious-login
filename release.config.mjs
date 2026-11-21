const parserOpts = {
  breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES", "BREAKING-CHANGE"],
};

export default {
  branches: ["develop"],
  plugins: [
    ["@semantic-release/commit-analyzer", { parserOpts }],
    ["@semantic-release/release-notes-generator", { parserOpts }],
    ["@semantic-release/npm", { npmPublish: false, tarballDir: "dist" }],
    ["@semantic-release/github", {
      assets: "dist/*.tgz",
      successComment: false,
      failComment: false,
      releasedLabels: false,
    }],
  ],
};
