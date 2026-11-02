/** Static export: the same `out/` folder ships to the web and into the Android app via Capacitor. */
const config = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
};
export default config;
