import { useLayoutEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function TicketBarcode({ stayId }) {
  const ref = useRef(null);
  const code = `SF-${stayId}`;
  useLayoutEffect(() => {
    const svg = ref.current;
    JsBarcode(svg, code, {
      format: "CODE128",
      width: 1,
      height: 32,
      displayValue: false,
      margin: 0,
      marginLeft: 10,
      marginRight: 10,
    });
    // Three dots per module on a typical 203 dpi thermal printer.
    svg.setAttribute("width", `${svg.viewBox.baseVal.width * 0.375}mm`);
    svg.setAttribute("height", "12mm");
  }, [code]);
  return (
    <figure className="sf-ticket-code">
      <svg ref={ref} aria-hidden="true" focusable="false" />
      <figcaption>{code}</figcaption>
    </figure>
  );
}
