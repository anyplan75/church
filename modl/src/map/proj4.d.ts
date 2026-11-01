declare module "proj4" {
  interface Converter {
    defs(name: string, definition: string): void;
    (from: string, to: string, coordinate: [number, number]): [number, number];
  }
  const proj4: Converter;
  export default proj4;
}
