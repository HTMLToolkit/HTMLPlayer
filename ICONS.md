# Icon System

## Overview

The icon system allows themes to define custom icon sets independently from theme CSS files. Icons are loaded dynamically and can be swapped without changing the visual theme.

## Structure

### Icon Definitions (`*.icons.ts` or `*.icons.tsx`)

Icon files define the icon mappings and (optionally) library helpers for a theme or standalone set:

```typescript
import { Play, Pause, Menu } from "lucide-react";
import type {
  IconDefinition,
  IconDefinitionMap,
  IconLibraryMap,
  IconLibraryConfigMap,
  IconPropTransformer,
} from "../../types/icons";

// Provide the raw exports for any third-party libraries you want to reference.
// Values can be plain objects OR lazy loaders that return a promise of exports.
export const libraries: IconLibraryMap = {
  lucide: {
    Play,
    Pause,
    Menu,
  },
  // tabler: () => import("@tabler/icons-react"),
};

// (Optional) Teach HTMLPlayer how to translate the generic icon props into
// library-specific props. One transformer per library.
const lucidePropTransformer: IconPropTransformer = (props) => ({
  size: props.size,
  color: props.color,
  strokeWidth: props.strokeWidth,
});

export const libraryConfig: IconLibraryConfigMap = {
  lucide: {
    propTransformer: lucidePropTransformer,
  },
};

const lucideIcon = (icon: string, title?: string): IconDefinition => ({
  type: "library",
  library: "lucide",
  icon,
  title,
});

const icons: IconDefinitionMap = {
  play: lucideIcon("Play", "Play"),
  pause: lucideIcon("Pause", "Pause"),
  menu: lucideIcon("Menu")
};

export default icons;
export const metadata = {
  author: "Jane Doe",
  version: "1.2.0",
};
```

### Theme JSON Metadata (`*.theme.json`)

Theme JSON files include icon and theme metadata:

```json
{
  "name": "Blue",
  "author": "NellowTCS",
  "description": "The default blue theme.",
  "version": "1.0",
  "cssFile": "Blue.theme.css",
  "icons": {
    "id": "blue",
    "label": "Blue Icons",
    "description": "Gradient forward icons that pair with the Blue theme.",
    "version": "1.0.0"
  }
}
```

**Icon Metadata Fields:**

- `id` - Unique identifier for the icon set (lowercase)
- `label` - Display name shown in settings
- `description` - Optional description
- `version` - Icon set version
- `inheritsFrom` - Optional parent icon set ID for inheritance
- `author` - Optional author name
- `tags` - Optional array of tags
- `theme` - Optional theme name to associate in UI pickers

> **Automatic IDs** – If you skip `icons.id`, the loader derives a lowercase ID from the theme name or file path. Provide it explicitly when shipping a standalone icon set.

### Optional module metadata (`export const metadata = { ... }`)

Icon definition modules can also export a `metadata` object. Values here follow the same shape as the JSON fields above and act as defaults when the theme JSON omits them.

## Icon Types

### 1. Library Icons

Reference icons from external libraries like lucide-react:

```typescript
play: lucideIcon("Play", "Play");
```

### 2. Custom Component Icons

Use custom React components:

```typescript
customIcon: {
  type: "component",
  component: MyCustomIconComponent,
  props: { /* default props */ },
  title: "Custom Icon"
}
```

### 3. Image Icons

Use image files:

```typescript
customImage: {
  type: "image",
  src: "./image.png",
  alt: "customImage",
  title: "customImage"
}
```

### 4. Inline SVG Icons

Use raw SVG content:

```typescript
import signature from "./signature.svg?raw";

signature: {
  type: "svg-inline",
  content: signature,
  title: "Signature"
}
```

### 5. Library Prop Transformers (optional)

Configure how generic icon props map to library-specific props. The function receives the raw `Icon` component props (size, color, stroke, etc.) and should return the shape that the target library expects. Register the transformer inside `libraryConfig` alongside your `libraries` export.

```typescript
const remixPropTransformer: IconPropTransformer = (props) => ({
  size: props.size ?? 20,
  color: props.color,
});

export const libraryConfig = {
  remix: {
    propTransformer: remixPropTransformer,
  },
};
```

## Using Icons in Components (internal use, not really meant for access from themes)

```tsx
import { Icon } from "../components/Icon";
import { IconRegistryProvider } from "../helpers/iconLoader";

// Wrap your subtree once so useIconRegistry & <Icon> can resolve sets.
<IconRegistryProvider defaultSetId="lucide" rememberSelection>
  <Icon name="play" size={24} />
</IconRegistryProvider>

// Basic usage
<Icon name="play" size={24} />

// With custom props
<Icon
  name="heart"
  size={20}
  fill="currentColor"
  decorative
/>

// From specific icon set
<Icon
  name="menu"
  setId="blue"
/>

// Provide fallback order if the icon might live in multiple packs
<Icon name="visualizerControls" fallbackOrder={["lucide", "material"]} />

// Custom loading / error fallback
<Icon
  name="download"
  fallback={({ isLoading, error }) => (isLoading ? <Spinner /> : <span>{error}</span>)}
/>
```

## Creating a New Icon Set

1. **Create icon file**: `src/themes/MyTheme/MyTheme.icons.ts`
2. **Add metadata to theme JSON**: `src/themes/MyTheme/MyTheme.theme.json`
3. **Define icons**: Export the default icon map plus optional `libraries`, `libraryConfig`, and `metadata`
4. **(Optional) Provide lazy loaders** for large external libraries: `libraries: { phosphor: () => import("@phosphor-icons/react") }`
5. **Icons are automatically discovered** by the icon registry, no manual registration needed

## Independence from Themes

Icon sets are **independent** from theme CSS files:

- You can use icons with any theme
- You can create standalone icon sets without a corresponding theme
- Icon metadata is stored in the theme JSON but icons can be selected separately

## Icon Registry API (again, internal use)

Access the icon registry programmatically:

```typescript
import { useIconRegistry } from "../helpers/iconLoader";

const { currentSet, setIconSet, iconSets, getIconDefinition, loadIcon } =
  useIconRegistry();

// List available icon sets
console.log(iconSets);

// Switch icon set
setIconSet("blue");

// Resolve icon metadata or definitions without rendering
const definition = getIconDefinition("play");
const resolved = await loadIcon("play", {
  fallbackOrder: ["lucide", "material"],
});
```
