# scan-unused-assets

Scan Unused Assets in Your Project

## Description

`scan-unused-assets` is a command-line tool that helps you find unused image assets in your JavaScript or TypeScript project. By identifying and removing unused images, you can reduce your project's size and optimize performance.

## Features

- **Supports Multiple Image Formats**: PNG, JPG, JPEG, SVG, ICO, and more.
- **Customizable Scan Directories**: Specify target folders to scan. (TBD 後續開發...)
- **Total Size Calculation**: Calculates the total size of unused images to help you understand potential space savings.

## Installation

### Install via npm or yarn (Recommended)

If the package is published on npm, you can install it as a development dependency:

```bash
npm install --save-dev scan-unused-assets

yarn add --dev scan-unused-assets

```
## Usage

### Add to package.json

```json
{
  "scripts": {
    "unused:assets": "scan-unused-assets"
  }
}
```

### Run

```bash
npm run unused:assets

yarn unused:assets
```

## Dependencies

- @babel/parser and @babel/traverse: For parsing and traversing code files.
- glob: For file pattern matching.
- jsonc-parser: For parsing JSON with comments, useful for parsing configuration files.
- tsconfig-paths: For resolving TypeScript path aliases.
