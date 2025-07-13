// src/types/css.d.ts
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}
