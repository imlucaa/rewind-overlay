// The page's backdrop: a soft light falling from the notch and fine film grain over everything. Static CSS (no canvas, no animation), so it costs nothing after the first paint. Styles in styles/motion.css.
export function Backdrop() {
  return (
    <div aria-hidden="true" className="backdrop pointer-events-none fixed inset-0 -z-10">
      <div className="backdrop-light" />
      <div className="backdrop-grain" />
    </div>
  );
}
