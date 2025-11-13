import type { ComponentType, SVGProps } from "react";

export type IconLibrary = string;

export type IconLibraryModule =
  | Record<string, unknown>
  | (() => Promise<Record<string, unknown>> | Record<string, unknown>);

export type IconLibraryMap = Record<string, IconLibraryModule>;

/**
 * Function to transform icon props for a specific library
 * Takes the generic icon props and returns library-specific props
 */
export type IconPropTransformer = (props: {
  size?: number | string;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}) => Record<string, any>;

export type IconLibraryConfig = {
  module: IconLibraryModule;
  propTransformer?: IconPropTransformer;
};

export type IconLibraryConfigMap = Record<
  string,
  IconLibraryModule | IconLibraryConfig
>;

export type IconDefinition =
  | LibraryIconDefinition
  | ComponentIconDefinition
  | ImageIconDefinition
  | InlineSvgIconDefinition;

export interface LibraryIconDefinition {
  type: "library";
  library: IconLibrary;
  icon: string;
  title?: string;
}

export interface ComponentIconDefinition {
  type: "component";
  component: ComponentType<SVGProps<SVGSVGElement>>;
  props?: Record<string, unknown>;
  title?: string;
}

export interface ImageIconDefinition {
  type: "image";
  src: string;
  alt?: string;
  title?: string;
}

export interface InlineSvgIconDefinition {
  type: "svg-inline";
  content: string;
  viewBox?: string;
  alt?: string;
  title?: string;
}

export type IconDefinitionMap = Record<string, IconDefinition>;

export interface IconSetMetadata {
  /**
   * Unique identifier that can be used to switch between icon sets.
   * Falls back to the derived theme name when omitted.
   */
  id?: string;
  /** Human readable display name */
  label?: string;
  /** Optional description for UI pickers */
  description?: string;
  /** Version or revision for the icon bundle */
  version?: string;
  /** Theme this icon pack belongs to */
  theme?: string;
  /** Parent icon set id used as fallback */
  inheritsFrom?: string;
  /** Optional author attribution */
  author?: string;
  /** Arbitrary tags for filtering */
  tags?: string[];
}

export interface IconSetModule {
  default: IconDefinitionMap;
  metadata?: IconSetMetadata;
  libraries?: IconLibraryMap;
  libraryConfig?: IconLibraryConfigMap;
}

export interface ResolvedComponentIcon {
  type: "component";
  Component: ComponentType<SVGProps<SVGSVGElement>>;
  defaultProps?: Record<string, unknown>;
  propTransformer?: IconPropTransformer;
  title?: string;
}

export interface ResolvedImageIcon {
  type: "image";
  src: string;
  alt?: string;
  title?: string;
}

export interface ResolvedInlineSvgIcon {
  type: "svg-inline";
  content: string;
  viewBox?: string;
  alt?: string;
  title?: string;
}

export type ResolvedIcon =
  | ResolvedComponentIcon
  | ResolvedImageIcon
  | ResolvedInlineSvgIcon;

export interface IconLookupOptions {
  /** Force lookup to a specific icon set id */
  setId?: string;
  /** Fallback order override */
  fallbackOrder?: string[];
}
