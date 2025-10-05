# Icon System

## Overview

The icon system allows themes to define custom icon sets independently from theme CSS files. Icons are loaded dynamically and can be swapped without changing the visual theme.

## Structure

### Icon Definitions (`*.icons.ts` or `*.icons.tsx`)

Icon files define the icon mappings for a theme:

```typescript
import * as lucideIcons from "lucide-react";
import type {
  IconDefinition,
  IconDefinitionMap,
  IconLibraryMap,
} from "../../types/icons";

export const libraries: IconLibraryMap = {
  lucide: lucideIcons,
};

const lucideIcon = (
  icon: keyof typeof lucideIcons,
  title?: string
): IconDefinition => ({
  type: "library",
  library: "lucide",
  icon,
  title,
});

const icons: IconDefinitionMap = {
  play: lucideIcon("Play", "Play"),
  pause: lucideIcon("Pause", "Pause"),
  menu: lucideIcon("Menu"),
  // ... more icons
};

export default icons;
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

## Icon Types

### 1. Library Icons
Reference icons from external libraries like lucide-react:

```typescript
play: lucideIcon("Play", "Play")
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
themeBadge: {
  type: "image",
  src: "/icon-1024.png",
  alt: "HTMLPlayer badge",
  title: "HTMLPlayer badge"
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

## Using Icons in Components (internal use, not really meant for access from themes)

```tsx
import { Icon } from '../components/Icon';

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
```

## Creating a New Icon Set

1. **Create icon file**: `src/themes/MyTheme/MyTheme.icons.ts`
2. **Add metadata to theme JSON**: `src/themes/MyTheme/MyTheme.theme.json`
3. **Define icons**: Export icon definitions and libraries
4. **Icons are automatically discovered** by the icon registry

## Independence from Themes

Icon sets are **independent** from theme CSS files:
- You can use icons with any theme
- You can create standalone icon sets without a corresponding theme
- Icon metadata is stored in the theme JSON but icons can be selected separately

## Icon Registry API (again, internal use)

Access the icon registry programmatically:

```typescript
import { useIconRegistry } from '../helpers/iconRegistry';

const { currentSet, setIconSet, iconSets } = useIconRegistry();

// List available icon sets
console.log(iconSets);

// Switch icon set
setIconSet('blue');
```