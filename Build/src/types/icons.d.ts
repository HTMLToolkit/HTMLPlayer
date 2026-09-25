import type { ComponentType, SVGProps } from "react";

export type IconLibrary = string;

export type IconLibraryModule =
  | Record<string, unknown>
  | (() => Promise<Record<string, unknown>> | Record<string, unknown>);

export type IconLibraryMap = Record<string, IconLibraryModule>;

export type IconPropTransformer = (props: {
  size?: number | string;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}) => Record<string, unknown>;

export interface IconLibraryConfig {
  module: IconLibraryModule;
  propTransformer?: IconPropTransformer;
}

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
  id?: string;
  label?: string;
  description?: string;
  version?: string;
  theme?: string;
  inheritsFrom?: string;
  author?: string;
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
  ResolvedComponentIcon | ResolvedImageIcon | ResolvedInlineSvgIcon;

export interface IconLookupOptions {
  setId?: string;
  fallbackOrder?: string[];
}
